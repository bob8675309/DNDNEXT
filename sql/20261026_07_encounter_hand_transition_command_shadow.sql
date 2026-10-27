-- EXPERIMENTAL SHADOW command, NOT a combat action / focus authority.
-- Mutates ONLY the encounter_hand_snapshot_*_shadow_v1 records and its own
-- idempotency ledger. Never spends Action/Bonus/Reaction or touches HP/slots.
-- Prerequisite: 20261026_05 and _06.
begin;

create table if not exists public.encounter_hand_transition_requests_shadow_v1 (
  request_id uuid primary key,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  participant_id uuid not null references public.encounter_participants(id) on delete cascade,
  hand text not null check (hand in ('main','off')),
  requested_item_id uuid,
  expected_snapshot_version integer not null check(expected_snapshot_version>0),
  requested_round integer not null check(requested_round>=1),
  requested_turn_index integer not null check(requested_turn_index>=0),
  requested_by uuid not null,
  applied boolean not null default false,
  result jsonb not null,
  created_at timestamptz not null default timezone('utc',now())
);
-- This is a separate experimental quota, NOT official D&D action economy.
-- One applied experimental hand change per participant and turn.
create unique index if not exists encounter_hand_shadow_one_applied_per_turn
  on public.encounter_hand_transition_requests_shadow_v1(
    participant_id,requested_round,requested_turn_index)
  where applied;
alter table public.encounter_hand_transition_requests_shadow_v1 enable row level security;
revoke all on public.encounter_hand_transition_requests_shadow_v1
  from public,anon,authenticated;
grant select,insert,update,delete
  on public.encounter_hand_transition_requests_shadow_v1 to service_role;

create or replace function public.commit_encounter_hand_transition_shadow_v1(
  p_participant_id uuid,
  p_hand text,
  p_target_item_id uuid,
  p_expected_snapshot_version integer,
  p_expected_round integer,
  p_expected_turn_index integer,
  p_request_id uuid
) returns jsonb
language plpgsql volatile security definer
set search_path=pg_catalog,public,private,auth
as $command$
declare
 v_uid uuid:=auth.uid();
 v_hand text:=lower(btrim(coalesce(p_hand,'')));
 v_p public.encounter_participants%rowtype;
 v_e public.encounters%rowtype;
 v_header public.encounter_hand_snapshot_header_shadow_v1%rowtype;
 v_existing public.encounter_hand_transition_requests_shadow_v1%rowtype;
 v_source_id uuid;
 v_other_id uuid;
 v_original_id uuid;
 v_operation text;
 v_applied boolean;
 v_next_version integer;
 v_result jsonb;
begin
 if p_participant_id is null or p_request_id is null
    or v_hand not in ('main','off')
    or p_expected_snapshot_version is null or p_expected_snapshot_version<1
    or p_expected_round is null or p_expected_round<1
    or p_expected_turn_index is null or p_expected_turn_index<0 then
   raise exception 'Participant, hand, request, version and turn identity required'
     using errcode='22023';
 end if;
 if v_uid is null
    or not coalesce(public.encounter_can_control_participant_v1(p_participant_id),false) then
   raise exception 'Not authorized to modify encounter shadow hands'
     using errcode='42501';
 end if;

 -- Same order as the canonical movement/end-turn RPCs: participant, encounter.
 select * into v_p from public.encounter_participants
   where id=p_participant_id for update;
 if not found or v_p.character_id is null then
   raise exception 'Encounter participant must have a character'
     using errcode='22023';
 end if;
 if not coalesce(private.can_manage_character_progression_v1(v_p.character_id),false)
 or not coalesce(private.can_access_character_v1(v_p.character_id,'inventory'),false) then
   raise exception 'Character progression/inventory permission required'
     using errcode='42501';
 end if;
 select * into v_e from public.encounters where id=v_p.encounter_id for update;
 if not found then raise exception 'Encounter not found' using errcode='22023'; end if;

 -- A replay must be identical in actor, participant, hand, requested item
 -- and expected version/round/turn. It returns its ORIGINAL stored result,
 -- without applying another change (even after the turn has advanced).
 select * into v_existing
 from public.encounter_hand_transition_requests_shadow_v1
 where request_id=p_request_id for update;
 if found then
   if v_existing.participant_id is distinct from p_participant_id
   or v_existing.encounter_id is distinct from v_e.id
   or v_existing.hand is distinct from v_hand
   or v_existing.requested_item_id is distinct from p_target_item_id
   or v_existing.expected_snapshot_version is distinct from p_expected_snapshot_version
   or v_existing.requested_round is distinct from p_expected_round
   or v_existing.requested_turn_index is distinct from p_expected_turn_index
   or v_existing.requested_by is distinct from v_uid then
     raise exception 'Request UUID already used for different command'
       using errcode='23505';
   end if;
   return v_existing.result;
 end if;

 if v_e.status<>'active'
   or v_e.active_participant_id is distinct from v_p.id
   or coalesce(v_p.is_defeated,false)
   or v_e.round is distinct from p_expected_round
   or v_e.turn_index is distinct from p_expected_turn_index then
   raise exception 'Hand transition requires the current undefeated active turn'
     using errcode='55000';
 end if;

 -- Explicit inventory locks precede header locking: the inventory mutation
 -- trigger also acquires an inventory row then updates that same header.
 -- This prevents a transfer/unequip racing with a committed hand change.
 for v_source_id in
   select distinct ids.id from (
     select inventory_item_id as id
       from public.encounter_hand_snapshot_items_shadow_v1
       where participant_id=p_participant_id
     union all select p_target_item_id
   ) ids
   where ids.id is not null order by ids.id
 loop
   perform 1 from public.inventory_items where id=v_source_id for update;
   if not found then
     raise exception 'Captured or requested inventory item disappeared'
       using errcode='55000';
   end if;
 end loop;

 select * into v_header
 from public.encounter_hand_snapshot_header_shadow_v1
 where participant_id=p_participant_id for update;
 if not found or v_header.invalidated
    or v_header.version<>p_expected_snapshot_version then
   raise exception 'Hand snapshot missing, invalidated or stale'
     using errcode='55000';
 end if;

 -- Every remaining row must still be independently eligible. A stale
 -- physical custody change must fail closed even if a trigger was missing.
 if exists(
    select 1 from public.encounter_hand_snapshot_items_shadow_v1 h
    where h.participant_id=p_participant_id
    and not private.character_staged_hand_item_valid_v1(
      v_p.character_id,h.inventory_item_id)
 ) then
   raise exception 'Captured hand inventory no longer valid'
     using errcode='55000';
 end if;
 select h.inventory_item_id into v_original_id
  from public.encounter_hand_snapshot_items_shadow_v1 h
  where h.participant_id=p_participant_id and h.hand=v_hand;
 select h.inventory_item_id into v_other_id
  from public.encounter_hand_snapshot_items_shadow_v1 h
  where h.participant_id=p_participant_id and h.hand<>v_hand;
 if p_target_item_id is not null then
   if p_target_item_id=v_other_id then
     raise exception 'The same item cannot occupy both hands'
       using errcode='23514';
   end if;
   if not private.character_staged_hand_item_valid_v1(
       v_p.character_id,p_target_item_id) then
     raise exception 'Requested item is not exclusively equipped and owned'
       using errcode='23514';
   end if;
 end if;

 v_operation:=case
   when v_original_id is not distinct from p_target_item_id then 'no_change'
   when p_target_item_id is null then 'stow'
   when v_original_id is null then 'draw'
   else 'replace' end;
 v_applied:=(v_operation<>'no_change');
 if v_applied and exists (
   select 1 from public.encounter_hand_transition_requests_shadow_v1 r
   where r.participant_id=p_participant_id
     and r.requested_round=p_expected_round
     and r.requested_turn_index=p_expected_turn_index
     and r.applied
 ) then
   raise exception 'One experimental shadow hand change already applied this turn'
     using errcode='55000';
 end if;

 if v_applied then
   if p_target_item_id is null then
     delete from public.encounter_hand_snapshot_items_shadow_v1 h
       where h.participant_id=p_participant_id and h.hand=v_hand;
   else
     insert into public.encounter_hand_snapshot_items_shadow_v1(
       participant_id,hand,inventory_item_id)
     values(p_participant_id,v_hand,p_target_item_id)
     on conflict(participant_id,hand) do update set
       inventory_item_id=excluded.inventory_item_id;
   end if;
   update public.encounter_hand_snapshot_header_shadow_v1 h
     set version=h.version+1
     where h.participant_id=p_participant_id and not h.invalidated
     returning version into v_next_version;
 else
   v_next_version:=v_header.version;
 end if;

 v_result:=jsonb_build_object(
   'schemaVersion',1,'requestId',p_request_id,
   'participantId',p_participant_id,'characterId',v_p.character_id,
   'encounterId',v_e.id,'round',p_expected_round,
   'turnIndex',p_expected_turn_index,'hand',v_hand,
   'operation',v_operation,'priorInventoryItemId',v_original_id,
   'requestedInventoryItemId',p_target_item_id,
   'previousSnapshotVersion',p_expected_snapshot_version,
   'snapshotVersion',v_next_version,
   'shadowHandStateTransitioned',v_applied,
   'experimentalOnePerTurnLimit',true,
   'canonicalActionSpent',false,'canonicalBonusActionSpent',false,
   'canonicalReactionSpent',false,'combatLogWritten',false,
   'activeHandsVerified',false,'actionCostVerified',false,
   'twoHandedAndShieldRulesVerified',false,
   'focusBonusApplied',false,'combatConsumerEnforced',false
 );
 insert into public.encounter_hand_transition_requests_shadow_v1(
   request_id,encounter_id,participant_id,hand,requested_item_id,
   expected_snapshot_version,requested_round,requested_turn_index,
   requested_by,applied,result
 ) values(
   p_request_id,v_e.id,p_participant_id,v_hand,p_target_item_id,
   p_expected_snapshot_version,p_expected_round,p_expected_turn_index,
   v_uid,v_applied,v_result
 );
 return v_result;
end;
$command$;

revoke all on function public.commit_encounter_hand_transition_shadow_v1(
 uuid,text,uuid,integer,integer,integer,uuid)
 from public,anon,authenticated;
grant execute on function public.commit_encounter_hand_transition_shadow_v1(
 uuid,text,uuid,integer,integer,integer,uuid)
 to authenticated;
comment on function public.commit_encounter_hand_transition_shadow_v1(
 uuid,text,uuid,integer,integer,integer,uuid) is
'Atomically changes SHADOW ONLY encounter hand IDs using request replay and exact turn/version checks. One experimental transition per turn; no canonical action cost or effect authority.';

commit;

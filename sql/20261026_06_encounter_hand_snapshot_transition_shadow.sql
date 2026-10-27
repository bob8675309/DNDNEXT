-- STAGED, NOT LIVE: encounter-scoped hand snapshot and turn-scoped
-- draw/stow/switch PREVIEW only. No combat state, action economy, item state,
-- attunement or focus bonus consumers use these tables or functions.
-- Prerequisites: 20261026_05_character_hand_loadout_staging.sql and
-- existing encounter participant/control functions.
begin;

create table if not exists public.encounter_hand_snapshot_header_shadow_v1 (
  participant_id uuid primary key references public.encounter_participants(id)
    on delete cascade,
  version integer not null default 1 check(version>0),
  captured_by uuid not null,
  captured_at timestamptz not null default timezone('utc',now())
);
create table if not exists public.encounter_hand_snapshot_items_shadow_v1 (
  participant_id uuid not null references
    public.encounter_hand_snapshot_header_shadow_v1(participant_id)
    on delete cascade,
  hand text not null check(hand in ('main','off')),
  inventory_item_id uuid not null references public.inventory_items(id)
    on delete cascade,
  primary key(participant_id,hand),
  unique(participant_id,inventory_item_id)
);
create index if not exists encounter_hand_snapshot_item_shadow_idx
 on public.encounter_hand_snapshot_items_shadow_v1(inventory_item_id);
alter table public.encounter_hand_snapshot_header_shadow_v1 enable row level security;
alter table public.encounter_hand_snapshot_items_shadow_v1 enable row level security;
revoke all on public.encounter_hand_snapshot_header_shadow_v1
 from public,anon,authenticated;
revoke all on public.encounter_hand_snapshot_items_shadow_v1
 from public,anon,authenticated;
grant select,insert,update,delete on
 public.encounter_hand_snapshot_header_shadow_v1,
 public.encounter_hand_snapshot_items_shadow_v1
 to service_role;

create or replace function public.get_encounter_hand_snapshot_shadow_v1(
 p_participant_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $get$
declare
 v_p public.encounter_participants%rowtype;
 v_header public.encounter_hand_snapshot_header_shadow_v1%rowtype;
 v_items jsonb:='[]'::jsonb;
begin
 if p_participant_id is null then
   raise exception 'Participant is required' using errcode='22023';
 end if;
 if auth.uid() is null
   or not coalesce(public.encounter_can_control_participant_v1(p_participant_id),false)
 then
   raise exception 'Not authorized to inspect participant hand state'
     using errcode='42501';
 end if;
 select * into v_p from public.encounter_participants where id=p_participant_id;
 if not found or v_p.character_id is null then
   raise exception 'Participant must be linked to a character'
     using errcode='22023';
 end if;
 select * into v_header from public.encounter_hand_snapshot_header_shadow_v1
   where participant_id=p_participant_id;
 select coalesce(jsonb_agg(jsonb_build_object(
   'hand',h.hand,'inventoryItemId',h.inventory_item_id,
   'currentEquipSlot',i.equip_slot,
   'stillValid',private.character_staged_hand_item_valid_v1(
      v_p.character_id,h.inventory_item_id)
 ) order by h.hand),'[]'::jsonb)
 into v_items from public.encounter_hand_snapshot_items_shadow_v1 h
 join public.inventory_items i on i.id=h.inventory_item_id
 where h.participant_id=p_participant_id;
 return jsonb_build_object(
   'schemaVersion',1,'participantId',p_participant_id,
   'characterId',v_p.character_id,
   'initialized',v_header.participant_id is not null,
   'snapshotVersion',v_header.version,
   'capturedAt',v_header.captured_at,
   'hands',v_items,
   'activeHandsVerified',false,
   'actionEconomyVerified',false,
   'focusBonusApplied',false,
   'combatConsumerEnforced',false
 );
end;
$get$;
revoke all on function public.get_encounter_hand_snapshot_shadow_v1(uuid)
 from public,anon,authenticated;
grant execute on function public.get_encounter_hand_snapshot_shadow_v1(uuid)
 to authenticated;

-- Captures a COPY of intended precombat hands for ONE encounter participant.
-- Never called by combat launch, cast functions or existing UI. A player
-- cannot re-capture during active combat or other terminal encounter states.
create or replace function public.capture_encounter_hand_snapshot_shadow_v1(
 p_participant_id uuid
) returns jsonb
language plpgsql volatile security definer
set search_path=pg_catalog,public,private,auth
as $capture$
declare
 v_p public.encounter_participants%rowtype;
 v_e public.encounters%rowtype;
 v_row record;
 v_version integer;
begin
 if p_participant_id is null then
   raise exception 'Participant is required' using errcode='22023';
 end if;
 if auth.uid() is null
   or not coalesce(public.encounter_can_control_participant_v1(p_participant_id),false)
 then
   raise exception 'Not authorized for encounter participant' using errcode='42501';
 end if;
 select * into v_p from public.encounter_participants
   where id=p_participant_id for update;
 if not found or v_p.character_id is null then
   raise exception 'Participant must be a linked character' using errcode='22023';
 end if;
 if not coalesce(private.can_manage_character_progression_v1(v_p.character_id),false)
 or not coalesce(private.can_access_character_v1(v_p.character_id,'inventory'),false)
 then raise exception 'Cannot capture equipment for this character'
   using errcode='42501'; end if;
 select * into v_e from public.encounters where id=v_p.encounter_id for update;
 if not found or v_e.status not in ('draft','ready','initiative') then
   raise exception 'Hand snapshot may only be captured before active combat'
     using errcode='55000';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(
    'character-hand-loadout:'||v_p.character_id::text,0));
 -- Do not accept stale source claims. Stage setter uses same advisory
 -- transaction lock, and inventory updates take row locks.
 for v_row in
   select h.hand,h.inventory_item_id from
     public.character_hand_loadout_staging_v1 h
   where h.character_id=v_p.character_id order by h.inventory_item_id
 loop
   perform 1 from public.inventory_items
     where id=v_row.inventory_item_id for update;
   if not found or not private.character_staged_hand_item_valid_v1(
     v_p.character_id,v_row.inventory_item_id)
   then raise exception 'Staged hand item lost verified equipment custody'
     using errcode='23514'; end if;
 end loop;
 insert into public.encounter_hand_snapshot_header_shadow_v1
   (participant_id,version,captured_by)
 values(p_participant_id,1,auth.uid())
 on conflict(participant_id) do update set
   version=public.encounter_hand_snapshot_header_shadow_v1.version+1,
   captured_by=excluded.captured_by,
   captured_at=timezone('utc',now())
 returning version into v_version;
 delete from public.encounter_hand_snapshot_items_shadow_v1
   where participant_id=p_participant_id;
 insert into public.encounter_hand_snapshot_items_shadow_v1
   (participant_id,hand,inventory_item_id)
 select p_participant_id,h.hand,h.inventory_item_id from
   public.character_hand_loadout_staging_v1 h
 where h.character_id=v_p.character_id;
 return public.get_encounter_hand_snapshot_shadow_v1(p_participant_id);
end;
$capture$;
revoke all on function public.capture_encounter_hand_snapshot_shadow_v1(uuid)
 from public,anon,authenticated;
grant execute on function public.capture_encounter_hand_snapshot_shadow_v1(uuid)
 to authenticated;

-- Action-time preflight ONLY. Does NOT draw/stow/change a hand, decrement
-- action/bonus/reaction, emit combat logs, or provide focus eligibility.
-- Expected snapshotVersion refuses stale open browser dialogs.
create or replace function public.preview_encounter_hand_transition_shadow_v1(
 p_participant_id uuid,p_hand text,p_target_item_id uuid,
 p_expected_snapshot_version integer
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $preview$
declare
 v_p public.encounter_participants%rowtype;
 v_e public.encounters%rowtype;
 v_snapshot jsonb;
 v_other_id uuid;
 v_before_id uuid;
 v_action text;
 v_hand text:=lower(btrim(coalesce(p_hand,'')));
 v_item record;
begin
 if p_participant_id is null
    or v_hand not in ('main','off')
    or p_expected_snapshot_version is null
    or p_expected_snapshot_version<1 then
   raise exception 'Participant, hand and expected version are required'
     using errcode='22023';
 end if;
 if auth.uid() is null
   or not coalesce(public.encounter_can_control_participant_v1(p_participant_id),false)
 then
   raise exception 'Not authorized to preview participant action'
     using errcode='42501';
 end if;
 select * into v_p from public.encounter_participants where id=p_participant_id;
 if not found or v_p.character_id is null then
   raise exception 'Participant must have a character'
     using errcode='22023'; end if;
 select * into v_e from public.encounters where id=v_p.encounter_id;
 if not found or v_e.status<>'active'
    or v_e.active_participant_id is distinct from v_p.id
    or coalesce(v_p.is_defeated,false) then
   raise exception 'Only the active, undefeated participant may preview a hand change'
     using errcode='55000';
 end if;
 v_snapshot:=public.get_encounter_hand_snapshot_shadow_v1(p_participant_id);
 if v_snapshot->>'initialized'<>'true'
    or (v_snapshot->>'snapshotVersion')::integer<>p_expected_snapshot_version then
   raise exception 'Encounter hand snapshot is absent or stale'
     using errcode='55000'; end if;
 if exists(
   select 1 from jsonb_array_elements(v_snapshot->'hands') x
   where x->>'stillValid'<>'true'
 ) then
   raise exception 'Snapshot contains invalidated equipment'
      using errcode='55000'; end if;
 select h.inventory_item_id into v_before_id
  from public.encounter_hand_snapshot_items_shadow_v1 h
  where h.participant_id=p_participant_id and h.hand=v_hand;
 select h.inventory_item_id into v_other_id
  from public.encounter_hand_snapshot_items_shadow_v1 h
  where h.participant_id=p_participant_id
    and h.hand<>v_hand;
 if p_target_item_id is not null then
   if p_target_item_id=v_other_id then
     raise exception 'One physical item cannot occupy both hands'
       using errcode='23514';
   end if;
   select i.id into v_item from public.inventory_items i
    where i.id=p_target_item_id;
   if not found or not private.character_staged_hand_item_valid_v1(
       v_p.character_id,p_target_item_id) then
     raise exception 'Requested item is not exclusively owned and equipped in a weapon slot'
       using errcode='23514';
   end if;
 end if;
 v_action:=case when v_before_id is not distinct from p_target_item_id then 'no_change'
                when p_target_item_id is null then 'stow'
                when v_before_id is null then 'draw'
                else 'replace' end;
 return jsonb_build_object(
   'schemaVersion',1,'participantId',p_participant_id,
   'characterId',v_p.character_id,
   'snapshotVersion',p_expected_snapshot_version,
   'hand',v_hand,'priorInventoryItemId',v_before_id,
   'requestedInventoryItemId',p_target_item_id,
   'otherHandInventoryItemId',v_other_id,
   'proposedCommand',v_action,
   'actionCostVerified',false,
   'twoHandedAndShieldRulesVerified',false,
   'weaponSwapApplied',false,
   'activeHandsVerified',false,
   'focusBonusApplied',false,
   'combatConsumerEnforced',false
 );
end;
$preview$;
revoke all on function public.preview_encounter_hand_transition_shadow_v1(uuid,text,uuid,integer)
 from public,anon,authenticated;
grant execute on function public.preview_encounter_hand_transition_shadow_v1(uuid,text,uuid,integer)
 to authenticated;

-- Existing inventory transfer/equip/source mutation invalidates encounter
-- hand snapshots only; no existing combat/equipment writer is modified.
create or replace function private.invalidate_encounter_hand_snapshot_shadow_v1()
returns trigger
language plpgsql volatile security definer
set search_path=pg_catalog,public,private
as $clear$
begin
 if old.owner_id is distinct from new.owner_id
 or old.owner_type is distinct from new.owner_type
 or old.is_equipped is distinct from new.is_equipped
 or old.equip_slot is distinct from new.equip_slot
 or old.item_id is distinct from new.item_id
 or old.item_rarity is distinct from new.item_rarity
 or old.card_payload is distinct from new.card_payload then
   delete from public.encounter_hand_snapshot_items_shadow_v1
     where inventory_item_id=new.id;
 end if;
 return new;
end;
$clear$;
drop trigger if exists invalidate_encounter_hand_snapshot_shadow_v1
 on public.inventory_items;
create trigger invalidate_encounter_hand_snapshot_shadow_v1
after update of owner_id,owner_type,is_equipped,equip_slot,item_id,item_rarity,card_payload
on public.inventory_items
for each row execute function private.invalidate_encounter_hand_snapshot_shadow_v1();
revoke all on function private.invalidate_encounter_hand_snapshot_shadow_v1()
 from public,anon,authenticated;

comment on table public.encounter_hand_snapshot_header_shadow_v1 is
'Shadow-only precombat capture metadata. Not an action-time held/worn or focus effect authority.';
comment on table public.encounter_hand_snapshot_items_shadow_v1 is
'Shadow-only participant hand candidate IDs, invalidated on equipment changes; never consumed by combat.';
comment on function public.preview_encounter_hand_transition_shadow_v1(uuid,text,uuid,integer) is
'Turn-authorized, read-only, optimistic-versioned draw/stow/replace preview. Does NOT enact transitions or consume action economy.';
commit;

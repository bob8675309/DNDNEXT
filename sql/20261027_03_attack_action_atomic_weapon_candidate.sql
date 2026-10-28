-- DRAFT, NOT DEPLOYED. A service_role-only *candidate* for atomic weapon
-- Attack-action event execution. No browser EXECUTE; no UI calls; existing
-- public.encounter_weapon_attack_v1 / unarmed / opportunity writers unchanged.
-- Depends on #291 source capacity and #292 read contracts.
begin;
create table if not exists public.encounter_weapon_action_candidate_sessions_v1(
 action_id uuid primary key,
 encounter_id uuid not null references public.encounters(id) on delete cascade,
 participant_id uuid not null references public.encounter_participants(id) on delete cascade,
 character_id uuid not null references public.characters(id) on delete cascade,
 round integer not null check(round>=1),
 turn_index integer not null check(turn_index>=0),
 requested_by uuid not null,
 attacks_allowed integer not null check(attacks_allowed between 1 and 4),
 attacks_resolved integer not null default 0
    check(attacks_resolved>=0 and attacks_resolved<=attacks_allowed),
 source_budget jsonb not null,
 created_at timestamptz not null default timezone('utc',now()),
 unique(participant_id,round,turn_index)
);
create table if not exists public.encounter_weapon_action_candidate_events_v1(
 request_id uuid primary key,
 action_id uuid not null references
    public.encounter_weapon_action_candidate_sessions_v1(action_id)
    on delete cascade,
 participant_id uuid not null references public.encounter_participants(id)
    on delete cascade,
 target_participant_id uuid not null references public.encounter_participants(id)
    on delete cascade,
 inventory_item_id uuid not null references public.inventory_items(id),
 event_ordinal integer not null check(event_ordinal between 1 and 4),
 requested_by uuid not null,
 result jsonb not null,
 created_at timestamptz not null default timezone('utc',now()),
 unique(action_id,event_ordinal)
);
alter table public.encounter_weapon_action_candidate_sessions_v1 enable row level security;
alter table public.encounter_weapon_action_candidate_events_v1 enable row level security;
revoke all on public.encounter_weapon_action_candidate_sessions_v1 from public,anon,authenticated;
revoke all on public.encounter_weapon_action_candidate_events_v1 from public,anon,authenticated;
grant select,insert,update,delete on public.encounter_weapon_action_candidate_sessions_v1,
  public.encounter_weapon_action_candidate_events_v1 to service_role;

create or replace function private.encounter_weapon_attack_atomic_candidate_v1(
 p_attacker_id uuid,p_target_id uuid,p_inventory_item_id uuid,
 p_action_id uuid,p_request_id uuid,p_expected_round integer,
 p_expected_turn_index integer,p_expected_ordinal integer
) returns jsonb
language plpgsql volatile security definer
set search_path=pg_catalog,public,private,auth
as $candidate$
declare
 v_uid uuid:=auth.uid();
 v_a public.encounter_participants%rowtype;
 v_t public.encounter_participants%rowtype;
 v_e public.encounters%rowtype;
 v_existing public.encounter_weapon_action_candidate_events_v1%rowtype;
 v_session public.encounter_weapon_action_candidate_sessions_v1%rowtype;
 v_budget jsonb;
 v_inventory public.inventory_items%rowtype;
 v_key text;
 v_profile jsonb;
 v_targeting jsonb;
 v_roll_info jsonb;
 v_damage_info jsonb;
 v_result jsonb;
 v_dist integer;
 v_reach integer;
 v_normal integer;
 v_long integer;
 v_is_ranged boolean;
 v_is_thrown boolean;
 v_long_disadvantage boolean:=false;
 v_base_disadvantage boolean:=false;
 v_roll integer;
 v_roll2 integer;
 v_total integer;
 v_ac integer;
 v_hit boolean;
 v_crit boolean;
 v_dice_count integer;
 v_die_size integer;
 v_damage_roll integer:=0;
 v_raw_damage integer:=0;
 v_i integer;
begin
 if p_attacker_id is null or p_target_id is null or p_inventory_item_id is null
 or p_action_id is null or p_request_id is null
 or p_expected_round is null or p_expected_round<1
 or p_expected_turn_index is null or p_expected_turn_index<0
 or p_expected_ordinal is null or p_expected_ordinal<1 then
   raise exception 'Actor, target, weapon, action and exact event/turn required'
     using errcode='22023';
 end if;
 if p_attacker_id=p_target_id or p_action_id=p_request_id then
   raise exception 'Actor/target and action/event IDs must be distinct'
     using errcode='22023';
 end if;
 if v_uid is null
 or not coalesce(public.encounter_can_control_participant_v1(p_attacker_id),false) then
   raise exception 'Unauthorized attack controller' using errcode='42501';
 end if;

 -- Canonical lock order for weapon attacks: attacker, target, encounter.
 -- In particular, lock actor before consulting an event retry so no second
 -- concurrent request can change its Action or event ordinal.
 select * into v_a from public.encounter_participants
   where id=p_attacker_id for update;
 if not found or v_a.character_id is null then
   raise exception 'Attacker must have a character' using errcode='55000';
 end if;
 select * into v_t from public.encounter_participants
   where id=p_target_id and encounter_id=v_a.encounter_id for update;
 if not found then raise exception 'Target outside encounter' using errcode='55000'; end if;
 select * into v_e from public.encounters
   where id=v_a.encounter_id for update;
 if not found then raise exception 'Encounter missing' using errcode='55000'; end if;

 -- Exact retry reuses its prior result even when target is now defeated or
 -- encounter turn advanced; never reroll or re-consume one-shot effects.
 select * into v_existing from public.encounter_weapon_action_candidate_events_v1
   where request_id=p_request_id for update;
 if found then
   if v_existing.action_id is distinct from p_action_id
   or v_existing.participant_id is distinct from p_attacker_id
   or v_existing.target_participant_id is distinct from p_target_id
   or v_existing.inventory_item_id is distinct from p_inventory_item_id
   or v_existing.event_ordinal is distinct from p_expected_ordinal
   or v_existing.requested_by is distinct from v_uid
   or not exists(
     select 1 from public.encounter_weapon_action_candidate_sessions_v1 s
     where s.action_id=p_action_id and s.encounter_id=v_e.id
       and s.round=p_expected_round
       and s.turn_index=p_expected_turn_index
   ) then
     raise exception 'Request UUID reused for different Attack event'
       using errcode='23505';
   end if;
   return v_existing.result;
 end if;
 if v_e.status<>'active' or v_e.active_participant_id is distinct from v_a.id
 or v_e.round is distinct from p_expected_round
 or v_e.turn_index is distinct from p_expected_turn_index
 or coalesce(v_a.is_defeated,false) or coalesce(v_t.is_defeated,false) then
   raise exception 'Wrong active turn or defeated participant'
     using errcode='55000';
 end if;

 select * into v_session from public.encounter_weapon_action_candidate_sessions_v1
 where action_id=p_action_id for update;
 if found then
   if v_session.participant_id<>v_a.id or v_session.encounter_id<>v_e.id
   or v_session.character_id<>v_a.character_id
   or v_session.round<>v_e.round or v_session.turn_index<>v_e.turn_index
   or v_session.requested_by<>v_uid
   or p_expected_ordinal<>v_session.attacks_resolved+1
   or v_session.attacks_resolved>=v_session.attacks_allowed
   or v_a.action_available then
     raise exception 'Attack action session/ordinal/Action state invalid'
       using errcode='55000';
   end if;
 else
   if p_expected_ordinal<>1 or not v_a.action_available then
     raise exception 'First event must spend the available Action'
       using errcode='55000';
   end if;
   if exists(select 1 from public.encounter_weapon_action_candidate_sessions_v1
     where participant_id=v_a.id and round=v_e.round and turn_index=v_e.turn_index)
   or exists(select 1 from public.encounter_attack_action_sessions_shadow_v1
     where participant_id=v_a.id and round=v_e.round and turn_index=v_e.turn_index) then
     raise exception 'Another Attack session already exists in this turn'
       using errcode='55000';
   end if;
   v_budget:=private.encounter_attack_capacity_source_shadow_v1(v_a.character_id);
   if v_budget->>'sourceReady' is distinct from 'true'
   or coalesce((v_budget->>'attacksAllowed')::integer,0) not between 1 and 4 then
     raise exception 'Unverified base class Attack capacity'
       using errcode='55000';
   end if;
 end if;

 -- Existing canonical weapon/unarmed commands may have attacked already.
 -- Permit only events explicitly owned by THIS candidate action session.
 if exists(
   select 1 from public.encounter_combat_log l
   where l.encounter_id=v_e.id and l.actor_participant_id=v_a.id
   and l.round=v_e.round and l.turn_index=v_e.turn_index
   and l.event_type in ('weapon_attack','unarmed_strike')
   and not exists(
     select 1 from public.encounter_weapon_action_candidate_events_v1 x
     where x.action_id=p_action_id
       and x.request_id::text=l.detail->>'requestId'
   )
 ) then
   raise exception 'Unrelated canonical attack already occurred this turn'
     using errcode='55000';
 end if;
 if exists(select 1 from public.encounter_command_requests
   where request_id=p_request_id) then
   raise exception 'Event request UUID is already used by another canonical command'
     using errcode='23505';
 end if;
 -- Only exact, character-exclusive inventory custody and catalogue identity.
 if not private.character_staged_hand_item_valid_v1(
   v_a.character_id,p_inventory_item_id) then
   raise exception 'Weapon ownership/equipment source unverified'
     using errcode='55000';
 end if;
 select * into v_inventory from public.inventory_items
   where id=p_inventory_item_id and is_equipped for update;
 if not found then raise exception 'Weapon not equipped' using errcode='55000'; end if;
 v_key:=coalesce(nullif(btrim(v_inventory.card_payload->>'item_key'),''),
   nullif(btrim(v_inventory.card_payload->>'item_id'),''),
   nullif(btrim(v_inventory.item_id),''));
 if not exists(select 1 from public.items_catalog where item_key=v_key) then
   raise exception 'Exact catalogue weapon source missing' using errcode='55000';
 end if;

 v_profile:=public.encounter_weapon_profile_internal_v1(v_a.id,p_inventory_item_id);
 if v_profile is null
 or v_profile->>'inventoryItemId' is distinct from p_inventory_item_id::text
 or coalesce(v_profile->>'damageDice','') !~ '^[1-9][0-9]*d[1-9][0-9]*$'
 then raise exception 'Canonical weapon profile unavailable'
   using errcode='55000'; end if;
 v_targeting:=public.encounter_targeting_context_internal_v1(v_a.id,v_t.id);
 if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then
   raise exception 'LOS or total cover blocks attack' using errcode='55000';
 end if;
 v_dist:=coalesce((v_targeting->>'distanceFt')::integer,0);
 v_reach:=coalesce((v_profile->>'reachFt')::integer,5);
 v_normal:=coalesce((v_profile->>'normalRangeFt')::integer,v_reach);
 v_long:=coalesce((v_profile->>'longRangeFt')::integer,v_normal);
 v_is_ranged:=coalesce((v_profile->>'isRanged')::boolean,false);
 v_is_thrown:=coalesce((v_profile->>'isThrown')::boolean,false);
 if v_is_ranged then
   if v_dist>v_long then raise exception 'Beyond long range' using errcode='55000'; end if;
   v_long_disadvantage:=v_dist>v_normal;
 elsif v_dist<=v_reach then v_long_disadvantage:=false;
 elsif v_is_thrown then
   if v_dist>v_long then raise exception 'Beyond thrown range' using errcode='55000'; end if;
   v_long_disadvantage:=v_dist>v_normal;
 else raise exception 'Beyond melee reach' using errcode='55000'; end if;
 v_base_disadvantage:=coalesce(v_t.dodging,false) or v_long_disadvantage;
 v_ac:=coalesce(v_t.armor_class,10)
      +coalesce((v_targeting->>'coverAcBonus')::integer,0);

 -- All validation above is reversible. From here onwards the SAME database
 -- transaction owns the Action, attack roll/one-shot effect, damage and log.
 -- PostgreSQL rolls back them ALL on any exception.
 if not found then null; end if; -- PL/pgSQL FOUND is not used as session state.
 if v_session.action_id is null then
   insert into public.encounter_weapon_action_candidate_sessions_v1(
    action_id,encounter_id,participant_id,character_id,round,turn_index,
    requested_by,attacks_allowed,source_budget
   ) values(p_action_id,v_e.id,v_a.id,v_a.character_id,v_e.round,v_e.turn_index,
     v_uid,(v_budget->>'attacksAllowed')::integer,v_budget);
   update public.encounter_participants
     set action_available=false,updated_at=timezone('utc',now())
     where id=v_a.id;
 end if;
 v_roll_info:=private.encounter_resolve_attack_roll_v1(
   v_a.id,v_t.id,v_base_disadvantage);
 v_roll:=coalesce((v_roll_info->>'roll')::integer,1);
 v_roll2:=nullif(v_roll_info->>'secondRoll','')::integer;
 v_total:=v_roll+coalesce((v_profile->>'attackBonus')::integer,0);
 v_crit:=v_roll=20;
 v_hit:=case when v_roll=1 then false when v_crit then true
          else v_total>=v_ac end;
 v_dice_count:=split_part(v_profile->>'damageDice','d',1)::integer;
 v_die_size:=split_part(v_profile->>'damageDice','d',2)::integer;
 if v_dice_count not between 1 and 32 or v_die_size not between 1 and 100 then
   raise exception 'Invalid weapon damage dice' using errcode='55000';
 end if;
 if v_crit then v_dice_count:=v_dice_count*2; end if;
 if v_hit then
   for v_i in 1..v_dice_count loop
     v_damage_roll:=v_damage_roll+floor(random()*v_die_size)::integer+1;
   end loop;
   v_raw_damage:=greatest(0,v_damage_roll
     +coalesce((v_profile->>'abilityMod')::integer,0)
     +coalesce((v_profile->>'magicBonus')::integer,0));
   v_damage_info:=public.encounter_apply_damage_internal_v1(
     v_t.id,v_raw_damage,v_profile->>'damageType');
 else
   v_damage_info:=jsonb_build_object(
     'targetId',v_t.id,'damageType',v_profile->>'damageType',
     'rawDamage',0,'resistant',false,'immune',false,'vulnerable',false,
     'damage',0,'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,
     'defeated',v_t.is_defeated);
 end if;
 v_result:=jsonb_build_object(
   'requestId',p_request_id,'actionRequestId',p_action_id,
   'attackOrdinal',p_expected_ordinal,
   'attacksAllowed',coalesce(v_session.attacks_allowed,
       (v_budget->>'attacksAllowed')::integer),
   'attackerId',v_a.id,'targetId',v_t.id,'inventoryItemId',p_inventory_item_id,
   'weapon',v_profile->>'name','distanceFt',v_dist,
   'roll',v_roll,'secondRoll',v_roll2,
   'advantage',coalesce((v_roll_info->>'advantage')::boolean,false),
   'disadvantage',coalesce((v_roll_info->>'disadvantage')::boolean,false),
   'guidingBoltAdvantage',coalesce(
       (v_roll_info->>'guidingBoltAdvantage')::boolean,false),
   'guidingBoltEffectConsumed',coalesce(
       (v_roll_info->>'guidingBoltEffectConsumed')::boolean,false),
   'advantageCanceledByDisadvantage',coalesce(
       (v_roll_info->>'advantageCanceledByDisadvantage')::boolean,false),
   'longRangeDisadvantage',v_long_disadvantage,
   'dodging',v_t.dodging,'attackBonus',(v_profile->>'attackBonus')::integer,
   'total',v_total,'baseTargetAc',coalesce(v_t.armor_class,10),
   'coverAcBonus',(v_targeting->>'coverAcBonus')::integer,
   'targetAc',v_ac,'coverLevel',v_targeting->>'coverLevel',
   'hit',v_hit,'critical',v_crit,'damageDice',v_profile->>'damageDice',
   'damageRoll',v_damage_roll,'damageType',v_profile->>'damageType',
   'rawDamage',v_raw_damage,'damage',(v_damage_info->>'damage')::integer,
   'resistant',(v_damage_info->>'resistant')::boolean,
   'immune',(v_damage_info->>'immune')::boolean,
   'vulnerable',(v_damage_info->>'vulnerable')::boolean,
   'targetHp',(v_damage_info->>'targetHp')::integer,
   'targetTempHp',(v_damage_info->>'targetTempHp')::integer,
   'defeated',(v_damage_info->>'defeated')::boolean,
   'targeting',v_targeting,'profile',v_profile,'attackRoll',v_roll_info,
   'canonicalActionSpentOnce',true,
   'actionSpentThisEvent',p_expected_ordinal=1,
   'weaponGripVerified',false,'attunementEffectsEnforced',false,
   'allAttackFeatureExceptionsVerified',false,'battleboardConsumerEnabled',false
 );
 insert into public.encounter_command_requests(
   request_id,encounter_id,participant_id,command_type,requested_by,result
 ) values(p_request_id,v_e.id,v_a.id,'weapon_attack',v_uid,v_result);
 insert into public.encounter_combat_log(
   encounter_id,round,turn_index,actor_participant_id,
   target_participant_id,event_type,summary,detail
 ) values(v_e.id,v_e.round,v_e.turn_index,v_a.id,v_t.id,
   'weapon_attack',
   v_a.display_name||case when v_hit then ' hit ' else ' missed ' end
      ||v_t.display_name||' with '||(v_profile->>'name')||'.',v_result);
 update public.encounter_weapon_action_candidate_sessions_v1
   set attacks_resolved=attacks_resolved+1 where action_id=p_action_id;
 insert into public.encounter_weapon_action_candidate_events_v1(
   request_id,action_id,participant_id,target_participant_id,
   inventory_item_id,event_ordinal,requested_by,result
 ) values(p_request_id,p_action_id,v_a.id,v_t.id,p_inventory_item_id,
   p_expected_ordinal,v_uid,v_result);
 update public.encounters set version=version+1,
   updated_at=timezone('utc',now()) where id=v_e.id;
 return v_result;
end;
$candidate$;
revoke all on function private.encounter_weapon_attack_atomic_candidate_v1(
 uuid,uuid,uuid,uuid,uuid,integer,integer,integer)
 from public,anon,authenticated;
grant execute on function private.encounter_weapon_attack_atomic_candidate_v1(
 uuid,uuid,uuid,uuid,uuid,integer,integer,integer)
 to service_role;
comment on function private.encounter_weapon_attack_atomic_candidate_v1(
 uuid,uuid,uuid,uuid,uuid,integer,integer,integer)
 is 'DRAFT, SERVICE_ROLE ONLY and NOT WIRED. Atomic candidate for one Action and several weapon attack events; incomplete special feature/hand/attunement parity. Never deploy as public RPC.';
commit;

-- DRAFT ONLY: source-derived Attack action slot budgeting and atomic shadow
-- event sequence. DOES NOT CALL canonical attack/damage writers or spend Action.
-- Supports only EXACT PHB/XPHB base-class features; subclass/multiclass
-- attack substitutions are NOT assumed eligible.
begin;

create or replace function private.encounter_attack_capacity_source_shadow_v1(
 p_character_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $capacity$
declare
 v_count integer;
 v_class text;
 v_book text;
 v_level integer;
 v_supported boolean;
 v_feature_count integer:=0;
 v_max integer:=1;
 v_features jsonb:='[]'::jsonb;
 v_status text;
begin
 if p_character_id is null then
   raise exception 'Character id required' using errcode='22023';
 end if;
 select count(*),min(lower(btrim(c.class_key))),
   min(upper(btrim(c.source))),min(cp.class_level)
   into v_count,v_class,v_book,v_level
 from public.character_progression cp
 join public.class_catalog c on c.id=cp.class_id
 where cp.character_id=p_character_id;
 if v_count<>1 or v_level is null or v_level<1 then
   return jsonb_build_object(
     'schemaVersion',1,'characterId',p_character_id,'sourceReady',false,
     'sourceStatus','progression_missing_or_multiclass_ambiguous',
     'attacksAllowed',null,'sourceFeatures','[]'::jsonb,
     'subclassFeaturesVerified',false,'specialAttackReplacementsVerified',false,
     'combatConsumerEnforced',false
   );
 end if;

 v_supported:=v_book in ('PHB','XPHB') and v_class in
   ('fighter','barbarian','monk','paladin','ranger','warlock',
    'wizard','sorcerer','cleric','druid','rogue','bard');
 if not v_supported then
   return jsonb_build_object(
     'schemaVersion',1,'characterId',p_character_id,'classKey',v_class,
     'classSource',v_book,'classLevel',v_level,'sourceReady',false,
     'sourceStatus','unsupported_class_source_or_special_progression',
     'attacksAllowed',null,'sourceFeatures','[]'::jsonb,
     'subclassFeaturesVerified',false,'specialAttackReplacementsVerified',false,
     'combatConsumerEnforced',false
   );
 end if;

 -- Must match the EXACT class / source / level / base-class feature record.
 -- Never use an unrelated subclass Extra Attack row such as Valor Bard,
 -- Bladesinger Wizard or Artificer Armorer/Battle Smith.
 select count(*),coalesce(max(case
   when v_class='fighter' and v_book='XPHB'
     and f.name='Three Extra Attacks' and f.level=20 then 4
   when v_class='fighter' and v_book='XPHB'
     and f.name='Two Extra Attacks' and f.level=11 then 3
   when v_class='fighter' and v_book='PHB'
     and f.name='Extra Attack (3)' and f.level=20 then 4
   when v_class='fighter' and v_book='PHB'
     and f.name='Extra Attack (2)' and f.level=11 then 3
   when f.name='Extra Attack' and f.level=5
     and v_class in ('fighter','barbarian','monk','paladin','ranger') then 2
   else null end),1),
   coalesce(jsonb_agg(jsonb_build_object(
     'featureKey',f.feature_key,'name',f.name,'level',f.level,
     'source',f.source,'classSource',f.class_source
   ) order by f.level,f.feature_key),'[]'::jsonb)
 into v_feature_count,v_max,v_features
 from public.class_feature_catalog f
 where lower(btrim(f.class_key))=v_class
   and upper(btrim(f.class_source))=v_book
   and upper(btrim(f.source))=v_book
   and lower(btrim(f.feature_type))='class'
   and f.subclass_name is null
   and f.level<=v_level
   and (
     (v_class='fighter' and (
       (v_book='XPHB' and (
         (f.name='Extra Attack' and f.level=5)
         or (f.name='Two Extra Attacks' and f.level=11)
         or (f.name='Three Extra Attacks' and f.level=20)))
       or (v_book='PHB' and (
         (f.name='Extra Attack' and f.level=5)
         or (f.name='Extra Attack (2)' and f.level=11)
         or (f.name='Extra Attack (3)' and f.level=20)))))
     or (v_class in ('barbarian','monk','paladin','ranger')
       and f.name='Extra Attack' and f.level=5)
   );

 -- A canonical tier MUST have its source feature; missing catalogue data
 -- cannot silently grant or silently misstate a level-5+ Attack budget.
 v_status:=case
   when v_class='fighter' and v_level>=20 and v_max<>4
     then 'missing_source_fighter_three_extra_attacks'
   when v_class='fighter' and v_level>=11 and v_max<3
     then 'missing_source_fighter_two_extra_attacks'
   when v_class='fighter' and v_level>=5 and v_max<2
     then 'missing_source_extra_attack'
   when v_class in ('barbarian','monk','paladin','ranger')
      and v_level>=5 and v_max<2
     then 'missing_source_extra_attack'
   when v_max>1 then 'base_class_feature_verified'
   else 'baseline_one_attack_subclass_rules_unverified'
 end;
 return jsonb_build_object(
   'schemaVersion',1,'characterId',p_character_id,
   'classKey',v_class,'classSource',v_book,'classLevel',v_level,
   'sourceReady',v_status not like 'missing_source_%',
   'sourceStatus',v_status,'attacksAllowed',v_max,
   'sourceFeatureCount',v_feature_count,'sourceFeatures',v_features,
   'baseClassFeatureVerified',v_max>1,
   'subclassFeaturesVerified',false,'multiclassVerified',false,
   'specialAttackReplacementsVerified',false,'bonusAttackFeaturesVerified',false,
   'combatConsumerEnforced',false
 );
end;
$capacity$;

create table if not exists public.encounter_attack_action_sessions_shadow_v1(
 action_request_id uuid primary key,
 encounter_id uuid not null references public.encounters(id) on delete cascade,
 participant_id uuid not null references public.encounter_participants(id)
   on delete cascade,
 character_id uuid not null references public.characters(id) on delete cascade,
 round integer not null check(round>=1),
 turn_index integer not null check(turn_index>=0),
 requested_by uuid not null,
 attacks_allowed integer not null check(attacks_allowed between 1 and 4),
 attacks_recorded integer not null default 0
   check(attacks_recorded>=0 and attacks_recorded<=attacks_allowed),
 budget_source jsonb not null,
 opened_at timestamptz not null default timezone('utc',now()),
 unique(participant_id,round,turn_index)
);
create table if not exists public.encounter_attack_events_shadow_v1(
 request_id uuid primary key,
 action_request_id uuid not null
   references public.encounter_attack_action_sessions_shadow_v1(action_request_id)
   on delete cascade,
 participant_id uuid not null references public.encounter_participants(id)
   on delete cascade,
 event_ordinal integer not null check(event_ordinal between 1 and 4),
 requested_by uuid not null,
 result jsonb not null,
 created_at timestamptz not null default timezone('utc',now()),
 unique(action_request_id,event_ordinal)
);
alter table public.encounter_attack_action_sessions_shadow_v1 enable row level security;
alter table public.encounter_attack_events_shadow_v1 enable row level security;
revoke all on public.encounter_attack_action_sessions_shadow_v1
  from public,anon,authenticated;
revoke all on public.encounter_attack_events_shadow_v1
  from public,anon,authenticated;
grant select,insert,update,delete on
 public.encounter_attack_action_sessions_shadow_v1,
 public.encounter_attack_events_shadow_v1 to service_role;

create or replace function public.begin_encounter_attack_action_shadow_v1(
 p_participant_id uuid,p_request_id uuid,p_expected_round integer,
 p_expected_turn_index integer
) returns jsonb
language plpgsql volatile security definer
set search_path=pg_catalog,public,private,auth
as $begin$
declare
 v_actor uuid:=auth.uid();
 v_p public.encounter_participants%rowtype;
 v_e public.encounters%rowtype;
 v_existing public.encounter_attack_action_sessions_shadow_v1%rowtype;
 v_budget jsonb;
 v_result jsonb;
begin
 if p_participant_id is null or p_request_id is null
   or p_expected_round is null or p_expected_round<1
   or p_expected_turn_index is null or p_expected_turn_index<0 then
   raise exception 'Participant, request and exact turn required' using errcode='22023';
 end if;
 if v_actor is null
   or not coalesce(public.encounter_can_control_participant_v1(p_participant_id),false)
 then raise exception 'Not authorized for participant' using errcode='42501'; end if;
 select * into v_p from public.encounter_participants
   where id=p_participant_id for update;
 if not found or v_p.character_id is null then
   raise exception 'Character participant required' using errcode='22023'; end if;
 select * into v_e from public.encounters where id=v_p.encounter_id for update;
 if not found then raise exception 'Encounter not found' using errcode='P0002'; end if;

 select * into v_existing from public.encounter_attack_action_sessions_shadow_v1
 where action_request_id=p_request_id for update;
 if found then
   if v_existing.participant_id is distinct from p_participant_id
   or v_existing.encounter_id is distinct from v_e.id
   or v_existing.round is distinct from p_expected_round
   or v_existing.turn_index is distinct from p_expected_turn_index
   or v_existing.requested_by is distinct from v_actor then
     raise exception 'Attack action request UUID reused with conflicting payload'
       using errcode='23505';
   end if;
   return jsonb_build_object(
     'actionRequestId',v_existing.action_request_id,
     'participantId',v_existing.participant_id,
     'round',v_existing.round,'turnIndex',v_existing.turn_index,
     'attacksAllowed',v_existing.attacks_allowed,
     'attacksRecorded',v_existing.attacks_recorded,
     'sourceStatus',v_existing.budget_source->'sourceStatus',
     'replayed',true,'shadowOnly',true,
     'canonicalActionSpent',false,'combatConsumerEnforced',false
   );
 end if;
 if v_e.status<>'active' or v_e.active_participant_id is distinct from v_p.id
 or coalesce(v_p.is_defeated,false) or v_e.round<>p_expected_round
 or v_e.turn_index<>p_expected_turn_index or not v_p.action_available then
   raise exception 'Cannot begin shadow Attack action outside active available turn'
     using errcode='55000';
 end if;
 if exists (
   select 1 from public.encounter_attack_action_sessions_shadow_v1 s
   where s.participant_id=p_participant_id
     and s.round=p_expected_round and s.turn_index=p_expected_turn_index
 ) then
   raise exception 'Only one experimental Attack action sequence per participant-turn'
     using errcode='55000';
 end if;
 if exists (
   select 1 from public.encounter_combat_log l
   where l.encounter_id=v_e.id and l.actor_participant_id=v_p.id
     and l.round=v_e.round and l.turn_index=v_e.turn_index
     and l.event_type in ('weapon_attack','unarmed_strike')
 ) then
   raise exception 'Canonical attack already occurred this turn'
     using errcode='55000';
 end if;
 v_budget:=private.encounter_attack_capacity_source_shadow_v1(v_p.character_id);
 if v_budget->>'sourceReady' is distinct from 'true' then
   raise exception 'Character attack capacity has unresolved catalogue sources'
     using errcode='55000';
 end if;
 insert into public.encounter_attack_action_sessions_shadow_v1(
   action_request_id,encounter_id,participant_id,character_id,round,
   turn_index,requested_by,attacks_allowed,budget_source)
 values(p_request_id,v_e.id,v_p.id,v_p.character_id,v_e.round,
   v_e.turn_index,v_actor,(v_budget->>'attacksAllowed')::integer,v_budget);
 return jsonb_build_object(
   'actionRequestId',p_request_id,'participantId',v_p.id,
   'round',v_e.round,'turnIndex',v_e.turn_index,
   'attacksAllowed',(v_budget->>'attacksAllowed')::integer,
   'attacksRecorded',0,'budgetSource',v_budget,
   'replayed',false,'shadowOnly',true,
   'canonicalActionSpent',false,'combatConsumerEnforced',false
 );
end;
$begin$;

create or replace function public.record_encounter_attack_event_shadow_v1(
 p_participant_id uuid,p_action_request_id uuid,p_request_id uuid,
 p_expected_ordinal integer
) returns jsonb
language plpgsql volatile security definer
set search_path=pg_catalog,public,private,auth
as $record$
declare
 v_actor uuid:=auth.uid();
 v_p public.encounter_participants%rowtype;
 v_e public.encounters%rowtype;
 v_session public.encounter_attack_action_sessions_shadow_v1%rowtype;
 v_existing public.encounter_attack_events_shadow_v1%rowtype;
 v_result jsonb;
begin
 if p_participant_id is null or p_action_request_id is null
 or p_request_id is null or p_expected_ordinal is null
 or p_expected_ordinal<1 then
   raise exception 'Participant, action, event request and ordinal required'
     using errcode='22023';
 end if;
 if v_actor is null
   or not coalesce(public.encounter_can_control_participant_v1(p_participant_id),false)
 then raise exception 'Not authorized for participant' using errcode='42501'; end if;
 select * into v_p from public.encounter_participants
   where id=p_participant_id for update;
 if not found or v_p.character_id is null then
   raise exception 'Character participant required' using errcode='22023'; end if;
 select * into v_e from public.encounters where id=v_p.encounter_id for update;
 if not found then raise exception 'Encounter not found' using errcode='P0002'; end if;

 select * into v_existing from public.encounter_attack_events_shadow_v1
 where request_id=p_request_id for update;
 if found then
   if v_existing.participant_id is distinct from p_participant_id
   or v_existing.action_request_id is distinct from p_action_request_id
   or v_existing.event_ordinal is distinct from p_expected_ordinal
   or v_existing.requested_by is distinct from v_actor then
     raise exception 'Attack event request UUID reused with different payload'
       using errcode='23505';
   end if;
   return v_existing.result;
 end if;
 select * into v_session from public.encounter_attack_action_sessions_shadow_v1
 where action_request_id=p_action_request_id and participant_id=p_participant_id
 for update;
 if not found or v_session.character_id<>v_p.character_id then
   raise exception 'Attack action session missing or belongs to other character'
     using errcode='55000';
 end if;
 if v_e.status<>'active' or v_e.active_participant_id is distinct from v_p.id
 or coalesce(v_p.is_defeated,false)
 or v_e.id<>v_session.encounter_id or v_e.round<>v_session.round
 or v_e.turn_index<>v_session.turn_index or not v_p.action_available then
   raise exception 'Cannot record attack outside original active available turn'
     using errcode='55000';
 end if;
 if exists (
   select 1 from public.encounter_combat_log l
   where l.encounter_id=v_e.id and l.actor_participant_id=v_p.id
     and l.round=v_e.round and l.turn_index=v_e.turn_index
     and l.event_type in ('weapon_attack','unarmed_strike')
 ) then
   raise exception 'Canonical attack occurred; shadow sequence is no longer current'
     using errcode='55000';
 end if;
 if p_expected_ordinal<>v_session.attacks_recorded+1
   or v_session.attacks_recorded>=v_session.attacks_allowed then
   raise exception 'Attack ordinal is stale, skipped or exceeds source-derived capacity'
     using errcode='55000';
 end if;
 update public.encounter_attack_action_sessions_shadow_v1
   set attacks_recorded=attacks_recorded+1
 where action_request_id=p_action_request_id;
 v_result:=jsonb_build_object(
   'eventRequestId',p_request_id,'actionRequestId',p_action_request_id,
   'participantId',p_participant_id,'round',v_session.round,
   'turnIndex',v_session.turn_index,'attackOrdinal',p_expected_ordinal,
   'attacksAllowed',v_session.attacks_allowed,
   'attacksRecorded',p_expected_ordinal,
   'attacksRemaining',v_session.attacks_allowed-p_expected_ordinal,
   'simulatedAttackSlotOnly',true,'attackRollMade',false,
   'damageApplied',false,'canonicalActionSpent',false,
   'combatLogWritten',false,'physicalEquipmentChanged',false,
   'weaponInteractionCharged',false,'combatConsumerEnforced',false
 );
 insert into public.encounter_attack_events_shadow_v1(
   request_id,action_request_id,participant_id,event_ordinal,requested_by,result)
 values(p_request_id,p_action_request_id,p_participant_id,
   p_expected_ordinal,v_actor,v_result);
 return v_result;
end;
$record$;

revoke all on function private.encounter_attack_capacity_source_shadow_v1(uuid)
 from public,anon,authenticated;
grant execute on function private.encounter_attack_capacity_source_shadow_v1(uuid)
 to service_role;
revoke all on function public.begin_encounter_attack_action_shadow_v1(
 uuid,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.record_encounter_attack_event_shadow_v1(
 uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.begin_encounter_attack_action_shadow_v1(
 uuid,uuid,integer,integer) to authenticated;
grant execute on function public.record_encounter_attack_event_shadow_v1(
 uuid,uuid,uuid,integer) to authenticated;
comment on table public.encounter_attack_action_sessions_shadow_v1 is
'Experimental source-derived attack-slot budget, not gameplay Attack action.';
comment on table public.encounter_attack_events_shadow_v1 is
'Idempotent simulated per-attack slots only; never rolls, deals damage or spends Action.';
commit;

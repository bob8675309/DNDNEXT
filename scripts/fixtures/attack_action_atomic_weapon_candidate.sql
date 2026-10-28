\set ON_ERROR_STOP on
-- PG16 DISPOSABLE ONLY: all earlier source/grant/hand/weapon-profile tests,
-- with an explicit deterministic test double for irreversible roll and
-- damage helpers (the original production helpers remain untouched).
\i scripts/fixtures/attack_resolver_preflight_parity_shadow.sql

alter table public.encounter_participants
 add column display_name text not null default 'Fixture Combatant',
 add column temp_hp integer not null default 0,
 add column updated_at timestamptz not null default timezone('utc',now());
alter table public.encounters
 add column updated_at timestamptz not null default timezone('utc',now());
alter table public.encounter_combat_log
 add column target_participant_id uuid,
 add column summary text;
create table public.fixture_damage_fault (
 id integer primary key, should_fail boolean not null default false
);
insert into public.fixture_damage_fault values(1,false);
create table public.encounter_timed_effects(
 id uuid primary key,participant_id uuid not null,
 source_participant_id uuid,effect_key text not null,
 remaining_target_turn_starts integer not null default 1
);
create or replace function private.encounter_resolve_attack_roll_v1(
 p_attacker_id uuid,p_target_id uuid,p_base_disadvantage boolean default false
) returns jsonb
language plpgsql volatile security definer
set search_path=pg_catalog,public,private
as $roll$
declare
 v_eff uuid;v_adv boolean:=false;
 v_e public.encounters%rowtype;
begin
 select id into v_eff from public.encounter_timed_effects
 where participant_id=p_target_id
 and effect_key='guiding_bolt_next_attack_advantage'
 and remaining_target_turn_starts>0
 order by id limit 1 for update;
 if found then
   v_adv:=true;
   delete from public.encounter_timed_effects where id=v_eff;
   select e.* into v_e from public.encounters e
    join public.encounter_participants p on p.encounter_id=e.id
    where p.id=p_attacker_id;
   insert into public.encounter_combat_log(
     encounter_id,round,turn_index,actor_participant_id,
     target_participant_id,event_type,summary,detail)
    values(v_e.id,v_e.round,v_e.turn_index,p_attacker_id,p_target_id,
    'effect_consumed','Fixture Guiding Bolt consumed',
    jsonb_build_object('effectId',v_eff));
 end if;
 return jsonb_build_object(
  'roll',17,'secondRoll',case when v_adv then 10 else null end,
  'advantage',v_adv and not p_base_disadvantage,
  'disadvantage',coalesce(p_base_disadvantage,false) and not v_adv,
  'guidingBoltAdvantage',v_adv,'guidingBoltEffectConsumed',v_adv,
  'advantageCanceledByDisadvantage',v_adv and p_base_disadvantage
 );
end;
$roll$;
create or replace function public.encounter_apply_damage_internal_v1(
 p_target_id uuid,p_amount integer,p_damage_type text
) returns jsonb
language plpgsql volatile security definer
set search_path=pg_catalog,public,private
as $damage$
declare
 v_t public.encounter_participants%rowtype;
 v_temp integer;v_hp integer;v_applied integer;v_raw integer;
begin
 if exists(select 1 from public.fixture_damage_fault where should_fail) then
   raise exception 'Injected damage failure for rollback verification'
     using errcode='P0001';
 end if;
 select * into strict v_t from public.encounter_participants
  where id=p_target_id for update;
 v_raw:=greatest(p_amount,0);
 v_temp:=greatest(v_t.temp_hp,0);
 v_hp:=v_t.current_hp;
 v_applied:=greatest(v_raw-v_temp,0);
 v_temp:=greatest(v_temp-v_raw,0);
 v_hp:=greatest(v_hp-v_applied,0);
 update public.encounter_participants
 set current_hp=v_hp,temp_hp=v_temp,is_defeated=v_hp<=0
 where id=p_target_id;
 return jsonb_build_object(
   'targetId',p_target_id,'rawDamage',v_raw,
   'damage',v_raw,'damageType',p_damage_type,
   'resistant',false,'immune',false,'vulnerable',false,
   'targetHp',v_hp,'targetTempHp',v_temp,'defeated',v_hp<=0
 );
end;
$damage$;
\i sql/20261027_03_attack_action_atomic_weapon_candidate.sql

do $test$
declare
 a uuid:='dddddddd-0000-4000-8000-000000000001';
 t uuid:='dddddddd-0000-4000-8000-000000000002';
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 e uuid:='ffffffff-0000-4000-8000-000000000001';
 sword uuid:='eeeeeeee-0000-4000-8000-000000000050';
 bow uuid:='eeeeeeee-0000-4000-8000-000000000051';
 unknown_weapon uuid:='eeeeeeee-0000-4000-8000-000000000052';
 v_action_id uuid:='eeeeaa00-0000-4000-8000-000000000001';
 event1 uuid:='eeeebb00-0000-4000-8000-000000000001';
 event2 uuid:='eeeebb00-0000-4000-8000-000000000002';
 event3 uuid:='eeeebb00-0000-4000-8000-000000000003';
 event4 uuid:='eeeebb00-0000-4000-8000-000000000004';
 effect uuid:='aaaaffff-0000-4000-8000-000000000001';
 v jsonb;
 first_result jsonb;
 duplicate_result jsonb;
 hp_before integer;
 temp_before integer;
 req_before integer;
 log_before integer;
 blocked boolean;
begin
 if has_table_privilege('anon','public.encounter_weapon_action_candidate_sessions_v1','SELECT')
 or has_table_privilege('authenticated','public.encounter_weapon_action_candidate_events_v1','INSERT')
 or has_function_privilege('anon',
   'private.encounter_weapon_attack_atomic_candidate_v1(uuid,uuid,uuid,uuid,uuid,integer,integer,integer)','EXECUTE')
 or has_function_privilege('authenticated',
   'private.encounter_weapon_attack_atomic_candidate_v1(uuid,uuid,uuid,uuid,uuid,integer,integer,integer)','EXECUTE')
 or not has_function_privilege('service_role',
   'private.encounter_weapon_attack_atomic_candidate_v1(uuid,uuid,uuid,uuid,uuid,integer,integer,integer)','EXECUTE')
 then raise exception 'Atomic candidate exposed to browser roles'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 update public.character_progression
 set class_id='eeeeeeee-aaaa-4000-8000-000000000011',class_level=11
 where character_id=c;
 update public.encounters
 set status='active',active_participant_id=a,round=6,turn_index=0 where id=e;
 update public.encounter_participants
 set action_available=true,is_defeated=false,current_hp=100,temp_hp=0
 where id=a;
 update public.encounter_participants
 set is_defeated=false,current_hp=100,temp_hp=5,armor_class=12,dodging=false
 where id=t;
 update public.fixture_weapon_targeting_context
 set distance_ft=5,has_los=true,cover_bonus=0 where id=1;
 insert into public.encounter_timed_effects(id,participant_id,source_participant_id,effect_key)
 values(effect,t,a,'guiding_bolt_next_attack_advantage');
 select current_hp,temp_hp into hp_before,temp_before
 from public.encounter_participants where id=t;
 select count(*) into req_before from public.encounter_command_requests;
 select count(*) into log_before from public.encounter_combat_log;

 -- Induce an error AFTER the roll helper consumes Guiding Bolt, and after
 -- the Action/session have been staged. The entire SQL statement must roll
 -- back all of those effects. DO EXCEPTION creates a PG subtransaction.
 update public.fixture_damage_fault set should_fail=true where id=1;
 blocked:=false;
 begin
   perform private.encounter_weapon_attack_atomic_candidate_v1(
      a,t,sword,v_action_id,event1,6,0,1);
 exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Fault injection failed to abort attack'; end if;
 update public.fixture_damage_fault set should_fail=false where id=1;
 if (select count(*) from public.encounter_timed_effects where id=effect)<>1
 or (select action_available from public.encounter_participants where id=a) is distinct from true
 or (select current_hp from public.encounter_participants where id=t)<>hp_before
 or (select temp_hp from public.encounter_participants where id=t)<>temp_before
 or exists(select 1 from public.encounter_weapon_action_candidate_sessions_v1 where action_id=v_action_id)
 or exists(select 1 from public.encounter_weapon_action_candidate_events_v1 where request_id=event1)
 or (select count(*) from public.encounter_command_requests)<>req_before
 or (select count(*) from public.encounter_combat_log)<>log_before then
   raise exception 'Failed attack partially spent Action, effect, HP or log';
 end if;

 first_result:=private.encounter_weapon_attack_atomic_candidate_v1(
      a,t,sword,v_action_id,event1,6,0,1);
 if first_result->>'attacksAllowed'<>'3'
 or first_result->>'actionSpentThisEvent'<>'true'
 or first_result->>'guidingBoltEffectConsumed'<>'true'
 or first_result->>'hit'<>'true'
 or first_result->>'battleboardConsumerEnabled'<>'false'
 or (select action_available from public.encounter_participants where id=a) is distinct from false
 or (select count(*) from public.encounter_timed_effects where id=effect)<>0
 or (select attacks_resolved from public.encounter_weapon_action_candidate_sessions_v1
  where action_id=v_action_id)<>1 then
  raise exception 'First atomic attack did not spend exactly one Action/effect %',first_result;
 end if;
 duplicate_result:=private.encounter_weapon_attack_atomic_candidate_v1(
      a,t,sword,v_action_id,event1,6,0,1);
 if duplicate_result is distinct from first_result then
   raise exception 'First attack replay changed saved roll/result'; end if;
 if (select count(*) from public.encounter_combat_log
   where event_type='weapon_attack' and detail->>'requestId'=event1::text)<>1
 or (select count(*) from public.encounter_combat_log
   where event_type='effect_consumed')<>1 then
   raise exception 'Replay duplicated combat or Guiding Bolt log'; end if;

 blocked:=false;
 begin perform private.encounter_weapon_attack_atomic_candidate_v1(
   a,t,bow,v_action_id,event1,6,0,1);
 exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Request UUID reused against a different weapon'; end if;
 blocked:=false;
 begin perform private.encounter_weapon_attack_atomic_candidate_v1(
   a,t,bow,v_action_id,event3,6,0,3);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Skipped attack ordinal accepted'; end if;
 blocked:=false;
 begin perform private.encounter_weapon_attack_atomic_candidate_v1(
   a,t,unknown_weapon,v_action_id,event2,6,0,2);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Unverified catalogue source accepted'; end if;

 v:=private.encounter_weapon_attack_atomic_candidate_v1(
   a,t,bow,v_action_id,event2,6,0,2);
 if v->>'attackOrdinal'<>'2'
 or v->>'actionSpentThisEvent'<>'false'
 or v->>'guidingBoltEffectConsumed'<>'false'
 then raise exception 'Second attack spent Action or reused one-shot effect %',v; end if;
 v:=private.encounter_weapon_attack_atomic_candidate_v1(
   a,t,sword,v_action_id,event3,6,0,3);
 if v->>'attackOrdinal'<>'3'
 or v->>'actionSpentThisEvent'<>'false'
 or (select attacks_resolved from public.encounter_weapon_action_candidate_sessions_v1
  where action_id=v_action_id)<>3
 then raise exception 'Third sourced attack failed %',v; end if;
 blocked:=false;
 begin perform private.encounter_weapon_attack_atomic_candidate_v1(
   a,t,sword,v_action_id,event4,6,0,4);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Attack exceeded Fighter 11 source capacity'; end if;
 if (select count(*) from public.encounter_combat_log
   where round=6 and turn_index=0 and event_type='weapon_attack')<>3
 or (select count(*) from public.encounter_command_requests
   where request_id in(event1,event2,event3))<>3
 or (select count(*) from public.encounter_weapon_action_candidate_events_v1
   where action_id=v_action_id)<>3 then
   raise exception 'Atomic executor did not make precisely three combat events'; end if;
 -- Replaying after turn end still returns unchanged stored result.
 update public.encounters set round=7,turn_index=1,active_participant_id=t where id=e;
 duplicate_result:=private.encounter_weapon_attack_atomic_candidate_v1(
   a,t,sword,v_action_id,event1,6,0,1);
 if duplicate_result is distinct from first_result then
   raise exception 'Old attack replay rerolled after the turn advanced'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000009',true);
 blocked:=false;
 begin perform private.encounter_weapon_attack_atomic_candidate_v1(
   a,t,sword,v_action_id,event1,6,0,1);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Other user replayed an authorized attack'; end if;

 -- This fixture deliberately uses deterministic doubles for roll + damage.
 -- It verifies the transaction's atomicity and canonical helper invocation,
 -- not the real RNG, every resistance, geometry or subclass exception.
end $test$;
select 'Atomic weapon candidate: one Action/three attacks, exact replay, Guiding Bolt once, failed-transaction rollback and ACL passed' result;

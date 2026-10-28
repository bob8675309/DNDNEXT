\set ON_ERROR_STOP on
-- Disposable PostgreSQL 16 ONLY. Reuse the full #293 atomic candidate and
-- inherited source, spell, inventory, Attack-action and preflight regressions.
\i scripts/fixtures/attack_action_atomic_weapon_candidate.sql

-- The older #293 fixture deliberately used minimal actor/effect tables.
-- Extend ONLY this disposable database to match fields read by the currently
-- deployed canonical helpers.
alter table public.encounter_participants
 add column damage_resistances text[] not null default '{}'::text[],
 add column damage_immunities text[] not null default '{}'::text[],
 add column damage_vulnerabilities text[] not null default '{}'::text[];
alter table public.encounter_timed_effects
 add column created_at timestamptz not null default timezone('utc',now());

-- Replace test doubles with the exact checked-in latest canonical sources:
-- Vicious Mockery + Guiding Bolt roll, equipment mitigation, and
-- Resistance -> flat typed reduction -> vulnerability -> temp HP -> HP.
\i scripts/fixtures/canonical_live_roll_damage_helpers_pg16.sql

insert into public.items_catalog(item_key,item_rarity,item_name,payload) values
 ('Fixture Ward|XDMG','rare','Fixture Ward',
  '{"resist":["fire"],"damageReductionByType":{"fire":10}}'::jsonb),
 ('Second Ward|XDMG','rare','Second Ward',
  '{"damageReductionByType":{"fire":3}}'::jsonb);
insert into public.inventory_items(
 id,item_id,item_name,item_rarity,card_payload,owner_type,owner_id,
 is_equipped,equip_slot,item_type
) values
 ('eeeeeeee-0000-4000-8000-000000000061','Fixture Ward|XDMG',
  'Fixture Ward','rare','{}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000002',true,'armor','Armor'),
 ('eeeeeeee-0000-4000-8000-000000000062','Second Ward|XDMG',
  'Second Ward','rare','{}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000002',true,'accessory','Other');
do $verify$
declare
 a uuid:='dddddddd-0000-4000-8000-000000000001';
 t uuid:='dddddddd-0000-4000-8000-000000000002';
 e uuid:='ffffffff-0000-4000-8000-000000000001';
 sword uuid:='eeeeeeee-0000-4000-8000-000000000050';
 action_id uuid:='eeeb0000-0000-4000-8000-000000000001';
 event1 uuid:='eeec0000-0000-4000-8000-000000000001';
 event2 uuid:='eeec0000-0000-4000-8000-000000000002';
 g1 uuid:='aabb0000-0000-4000-8000-000000000001';
 m1 uuid:='aabb0000-0000-4000-8000-000000000002';
 g2 uuid:='aabb0000-0000-4000-8000-000000000003';
 m2 uuid:='aabb0000-0000-4000-8000-000000000004';
 g3 uuid:='aabb0000-0000-4000-8000-000000000005';
 m3 uuid:='aabb0000-0000-4000-8000-000000000006';
 v jsonb;
 first_result jsonb;
 replay jsonb;
 before_effect_logs integer;
 before_hp integer;
 before_temp integer;
 before_requests integer;
 before_attack_events integer;
 before_versions bigint;
 blocked boolean;
begin
 if has_function_privilege('anon','private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean)','EXECUTE')
 or has_function_privilege('authenticated','private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean)','EXECUTE')
 or has_function_privilege('anon','public.encounter_apply_damage_internal_v1(uuid,integer,text)','EXECUTE')
 or has_function_privilege('authenticated','public.encounter_apply_damage_internal_v1(uuid,integer,text)','EXECUTE')
 then raise exception 'Canonical combat helpers exposed to browser'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 update public.encounters
  set status='active',active_participant_id=a,round=8,turn_index=0
  where id=e;
 update public.encounter_participants
  set action_available=true,is_defeated=false,current_hp=100,temp_hp=0,
      damage_resistances='{}'::text[],damage_immunities='{}'::text[],
      damage_vulnerabilities='{}'::text[] where id=a;
 update public.encounter_participants
  set action_available=true,is_defeated=false,current_hp=100,temp_hp=4,
      armor_class=12,damage_resistances='{}'::text[],
      damage_immunities='{}'::text[],
      damage_vulnerabilities=array['fire']::text[]
  where id=t;

 -- The live helper applies equipment Resistance first, then highest
 -- matching flat damage reduction, then Vulnerability, then temp HP.
 v:=public.encounter_apply_damage_internal_v1(t,31,'fire');
 if v->>'equipmentResistance'<>'true'
 or v->>'resistant'<>'true'
 or v->>'damageAfterResistance'<>'15'
 or v->>'flatReductionAvailable'<>'10'
 or v->>'flatReductionApplied'<>'10'
 or v->>'damageAfterFlatReduction'<>'5'
 or v->>'vulnerable'<>'true'
 or v->>'damage'<>'10'
 or v->>'targetTempHp'<>'0'
 or v->>'targetHp'<>'94'
 or not (v->'mitigationSources' ? 'Fixture Ward')
 then raise exception 'Live Resistance-flat-vulnerability-temp HP order changed %',v; end if;

 -- Flat reductions do not stack additively (10+3 is NOT 13).
 update public.encounter_participants
   set current_hp=100,temp_hp=4,damage_vulnerabilities='{}'::text[]
 where id=t;
 v:=public.encounter_apply_damage_internal_v1(t,31,'fire');
 if v->>'flatReductionAvailable'<>'10' or v->>'flatReductionApplied'<>'10'
 or v->>'damage'<>'5' or v->>'targetTempHp'<>'0'
 or v->>'targetHp'<>'99' then
 raise exception 'Highest-only flat reduction or temp HP mitigation broke %',v; end if;

 -- Small Resistance-reduced damage is fully consumed by the flat reduction.
 update public.encounter_participants set current_hp=100,temp_hp=4 where id=t;
 v:=public.encounter_apply_damage_internal_v1(t,5,'fire');
 if v->>'damageAfterResistance'<>'2'
 or v->>'flatReductionApplied'<>'2'
 or v->>'damage'<>'0' or v->>'targetHp'<>'100'
 or v->>'targetTempHp'<>'4' then
 raise exception 'Small resisted damage was not fully reduced %',v; end if;

 update public.encounter_participants
 set current_hp=100,temp_hp=4,damage_immunities=array['fire']::text[] where id=t;
 v:=public.encounter_apply_damage_internal_v1(t,31,'fire');
 if v->>'immune'<>'true' or v->>'damage'<>'0'
 or v->>'flatReductionApplied'<>'0' or v->>'targetHp'<>'100'
 or v->>'targetTempHp'<>'4' then
 raise exception 'Immunity failed to override equipment reductions %',v; end if;

 -- Removing equipped protection leaves Vulnerability alone: 10 -> 20,
 -- which first consumes 4 temporary HP, then 16 real HP.
 update public.inventory_items set is_equipped=false
 where id in ('eeeeeeee-0000-4000-8000-000000000061',
              'eeeeeeee-0000-4000-8000-000000000062');
 update public.encounter_participants
 set current_hp=100,temp_hp=4,damage_immunities='{}'::text[],
     damage_vulnerabilities=array['fire']::text[] where id=t;
 v:=public.encounter_apply_damage_internal_v1(t,10,'fire');
 if v->>'equipmentResistance'<>'false'
 or v->>'flatReductionAvailable'<>'0' or v->>'damage'<>'20'
 or v->>'targetTempHp'<>'0' or v->>'targetHp'<>'84' then
 raise exception 'Unequipped item incorrectly mitigated damage %',v; end if;
 blocked:=false;
 begin perform public.encounter_apply_damage_internal_v1(t,-1,'fire');
 exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'Negative raw damage was accepted'; end if;

 -- Both opposing one-use effects are consumed exactly once even if their
 -- Advantage and Disadvantage cancel. Neither yields a second d20.
 insert into public.encounter_timed_effects(
  id,participant_id,source_participant_id,effect_key)
 values
 (g1,t,a,'guiding_bolt_next_attack_advantage'),
 (m1,a,t,'vicious_mockery_next_attack_disadvantage');
 select count(*) into before_effect_logs
 from public.encounter_combat_log where event_type='effect_consumed';
 v:=private.encounter_resolve_attack_roll_v1(a,t,false);
 if v->>'guidingBoltEffectConsumed'<>'true'
 or v->>'viciousMockeryEffectConsumed'<>'true'
 or v->>'advantageCanceledByDisadvantage'<>'true'
 or v->>'advantage'<>'false' or v->>'disadvantage'<>'false'
 or v->>'secondRoll' is not null
 or (v->>'roll')::integer not between 1 and 20 then
 raise exception 'Opposing one-shot effects were not canceled/consumed %',v; end if;
 if exists(select 1 from public.encounter_timed_effects where id in(g1,m1))
 or (select count(*) from public.encounter_combat_log
     where event_type='effect_consumed')<>before_effect_logs+2 then
 raise exception 'One-use effects were not consumed and logged exactly once'; end if;
 v:=private.encounter_resolve_attack_roll_v1(a,t,false);
 if v->>'guidingBoltEffectConsumed'<>'false'
 or v->>'viciousMockeryEffectConsumed'<>'false'
 or (select count(*) from public.encounter_combat_log
     where event_type='effect_consumed')<>before_effect_logs+2
 then raise exception 'Second roll reused one-shot effect %',v; end if;

 insert into public.encounter_timed_effects(
   id,participant_id,source_participant_id,effect_key)
 values(g2,t,a,'guiding_bolt_next_attack_advantage');
 v:=private.encounter_resolve_attack_roll_v1(a,t,false);
 if v->>'advantage'<>'true' or v->>'disadvantage'<>'false'
 or v->>'secondRoll' is null or v->>'guidingBoltEffectConsumed'<>'true'
 or (v->>'roll')::integer<>greatest((v->>'firstRoll')::integer,
                                      (v->>'secondRoll')::integer)
 then raise exception 'Guiding Bolt did not choose higher of two d20 %',v; end if;

 insert into public.encounter_timed_effects(
   id,participant_id,source_participant_id,effect_key)
 values(m2,a,t,'vicious_mockery_next_attack_disadvantage');
 v:=private.encounter_resolve_attack_roll_v1(a,t,false);
 if v->>'advantage'<>'false' or v->>'disadvantage'<>'true'
 or v->>'secondRoll' is null or v->>'viciousMockeryEffectConsumed'<>'true'
 or (v->>'roll')::integer<>least((v->>'firstRoll')::integer,
                                   (v->>'secondRoll')::integer)
 then raise exception 'Vicious Mockery did not choose lower of two d20 %',v; end if;

 -- Savepoint rollback test using the EXACT live helper bodies: all effects,
 -- HP and event logs restored even after the helper writes its log rows.
 update public.encounter_participants set current_hp=100,temp_hp=4,
  damage_vulnerabilities='{}'::text[] where id=t;
 update public.inventory_items set is_equipped=true
 where id='eeeeeeee-0000-4000-8000-000000000061';
 insert into public.encounter_timed_effects(
   id,participant_id,source_participant_id,effect_key)
 values(g3,t,a,'guiding_bolt_next_attack_advantage'),
       (m3,a,t,'vicious_mockery_next_attack_disadvantage');
 select current_hp,temp_hp into before_hp,before_temp
  from public.encounter_participants where id=t;
 select count(*) into before_effect_logs from public.encounter_combat_log
  where event_type='effect_consumed';
 blocked:=false;
 begin
   perform private.encounter_resolve_attack_roll_v1(a,t,false);
   perform public.encounter_apply_damage_internal_v1(t,31,'fire');
   raise exception 'Injected full-helper rollback' using errcode='P0001';
 exception when raise_exception then blocked:=true; end;
 if not blocked or (select count(*) from public.encounter_timed_effects
    where id in(g3,m3))<>2
 or (select current_hp from public.encounter_participants where id=t)<>before_hp
 or (select temp_hp from public.encounter_participants where id=t)<>before_temp
 or (select count(*) from public.encounter_combat_log
    where event_type='effect_consumed')<>before_effect_logs then
 raise exception 'Full canonical helper rollback left irreversible effects'; end if;

 -- Test real helper invocation THROUGH the #293 candidate, with no roll/
 -- damage stubs remaining. 1 on d20 misses even vs low AC, so avoid flaky
 -- hit assumptions: one-use effect consumption and replay are deterministic.
 update public.encounter_participants set armor_class=1,temp_hp=0,
  current_hp=100,damage_resistances='{}'::text[],
  damage_immunities='{}'::text[],damage_vulnerabilities='{}'::text[]
 where id=t;
 select count(*) into before_effect_logs from public.encounter_combat_log
  where event_type='effect_consumed';
 select count(*) into before_requests from public.encounter_command_requests;
 select count(*) into before_attack_events from public.encounter_weapon_action_candidate_events_v1;
 select version into before_versions from public.encounters where id=e;
 first_result:=private.encounter_weapon_attack_atomic_candidate_v1(
   a,t,sword,action_id,event1,8,0,1);
 if first_result->>'viciousMockeryDisadvantage'<>'true'
 or first_result->>'viciousMockeryEffectConsumed'<>'true'
 or first_result->>'guidingBoltEffectConsumed'<>'true'
 or first_result->>'advantageCanceledByDisadvantage'<>'true'
 or first_result->>'actionSpentThisEvent'<>'true'
 or first_result->>'battleboardConsumerEnabled'<>'false'
 or first_result->'damageMitigation' is null
 or (select count(*) from public.encounter_timed_effects where id in(g3,m3))<>0
 or (select count(*) from public.encounter_combat_log
    where event_type='effect_consumed')<>before_effect_logs+2 then
 raise exception 'Candidate lost actual live one-use roll/damage helper state %',first_result; end if;
 replay:=private.encounter_weapon_attack_atomic_candidate_v1(
   a,t,sword,action_id,event1,8,0,1);
 if replay is distinct from first_result
 or (select count(*) from public.encounter_combat_log
    where event_type='effect_consumed')<>before_effect_logs+2
 or (select count(*) from public.encounter_command_requests)<>before_requests+1
 or (select count(*) from public.encounter_weapon_action_candidate_events_v1)<>before_attack_events+1
 or (select version from public.encounters where id=e)<>before_versions+1
 then raise exception 'Canonical helper candidate retry replayed roll, mitigation or event'; end if;
 v:=private.encounter_weapon_attack_atomic_candidate_v1(
   a,t,sword,action_id,event2,8,0,2);
 if v->>'attackOrdinal'<>'2'
 or v->>'actionSpentThisEvent'<>'false'
 or v->>'guidingBoltEffectConsumed'<>'false'
 or v->>'viciousMockeryEffectConsumed'<>'false'
 or (select count(*) from public.encounter_combat_log
    where event_type='effect_consumed')<>before_effect_logs+2
 then raise exception 'Second real-helper attack consumed Action or another one-shot %',v; end if;
end $verify$;
select 'Live-sourced Guiding Bolt/Vicious Mockery rolls, equipment mitigation order, savepoint rollback and multiattack candidate parity passed' result;

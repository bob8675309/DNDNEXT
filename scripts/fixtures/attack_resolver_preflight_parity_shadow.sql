\set ON_ERROR_STOP on
-- Disposable PG16 suite. Inherits all attack-budget + hand/source regression
-- fixtures, including the original legacy weapon profile implementation.
\i scripts/fixtures/attack_action_source_budget_shadow.sql

-- Only target geometry is a fixture double. Production code calls the
-- ACTUAL encounter_targeting_context_internal_v1 unmodified.
create table public.fixture_weapon_targeting_context(
 id integer primary key default 1,
 distance_ft integer not null,
 has_los boolean not null,
 cover_bonus integer not null
);
insert into public.fixture_weapon_targeting_context values(1,5,true,0);
create or replace function public.encounter_targeting_context_internal_v1(
 p_attacker_id uuid,p_target_id uuid
) returns jsonb
language sql stable security definer
set search_path=pg_catalog,public
as $fixture$
 select jsonb_build_object(
   'attackerId',p_attacker_id,'targetId',p_target_id,
   'distanceFt',v.distance_ft,'hasLineOfSight',v.has_los,
   'coverAcBonus',v.cover_bonus,
   'coverLevel',case when v.cover_bonus=5 then 'three_quarters'
                     when v.cover_bonus=2 then 'half' else 'none' end)
 from public.fixture_weapon_targeting_context v where v.id=1;
$fixture$;

insert into public.items_catalog(item_key,item_rarity,item_name,payload)
 values('Preflight Sword|XPHB','mundane','Preflight Sword',
  '{"weapon":true,"type":"M","item_type":"melee weapon","weaponCategory":"martial","dmg1":"1d8","dmgType":"S","property":[]}'::jsonb),
 ('Preflight Bow|XPHB','mundane','Preflight Bow',
  '{"weapon":true,"type":"R","item_type":"ranged weapon","weaponCategory":"martial","dmg1":"1d8","dmgType":"P","range":"20/60","property":[]}'::jsonb);
insert into public.inventory_items(
 id,item_id,item_name,item_rarity,card_payload,owner_type,owner_id,
 is_equipped,equip_slot,item_type
) values
 ('eeeeeeee-0000-4000-8000-000000000050','Preflight Sword|XPHB',
  'Preflight Sword','mundane','{}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000001',true,'weapon_1','melee weapon'),
 ('eeeeeeee-0000-4000-8000-000000000051','Preflight Bow|XPHB',
  'Preflight Bow','mundane','{}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000001',true,'weapon_2','ranged weapon'),
 ('eeeeeeee-0000-4000-8000-000000000052','Unknown Preflight Sword',
  'Unknown Preflight Sword','mundane',
  '{"weapon":true,"type":"M","item_type":"melee weapon","dmg1":"1d8","dmgType":"S"}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000001',true,'weapon_3','melee weapon');

\i sql/20261027_02_attack_resolver_preflight_parity_shadow.sql

do $test$
declare
 p uuid:='dddddddd-0000-4000-8000-000000000001';
 other_p uuid:='dddddddd-0000-4000-8000-000000000002';
 e uuid:='ffffffff-0000-4000-8000-000000000001';
 action_id uuid:='ddee0000-0000-4000-8000-000000000001';
 sword uuid:='eeeeeeee-0000-4000-8000-000000000050';
 bow uuid:='eeeeeeee-0000-4000-8000-000000000051';
 unsupported uuid:='eeeeeeee-0000-4000-8000-000000000052';
 v jsonb;
 baseline jsonb;
 target jsonb;
 requests_before jsonb;
 requests_after jsonb;
 combat_before jsonb;
 combat_after jsonb;
 inventory_before jsonb;
 inventory_after jsonb;
 slots_before jsonb;
 slots_after jsonb;
 fx_before jsonb;
 fx_after jsonb;
 events_before jsonb;
 events_after jsonb;
 blocked boolean;
begin
 if has_function_privilege('anon','private.encounter_weapon_event_resolver_preflight_shadow_v1(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 or has_function_privilege('authenticated','private.encounter_weapon_event_resolver_preflight_shadow_v1(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 or not has_function_privilege('service_role','private.encounter_weapon_event_resolver_preflight_shadow_v1(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 then raise exception 'Weapon resolver preflight callable by browser'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 update public.encounters set status='active',active_participant_id=p,
   round=5,turn_index=0 where id=e;
 update public.encounter_participants
 set action_available=true,is_defeated=false where id=p;
 perform public.begin_encounter_attack_action_shadow_v1(p,action_id,5,0);

 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)
 into inventory_before from public.inventory_items x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.participant_id,x.slot_level),'[]'::jsonb)
 into slots_before from public.encounter_spell_slots x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)
 into combat_before from public.encounter_participants x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.request_id),'[]'::jsonb)
 into requests_before from public.encounter_command_requests x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.request_id),'[]'::jsonb)
 into events_before from public.encounter_attack_events_shadow_v1 x;

 baseline:=public.encounter_weapon_profile_internal_v1(p,sword);
 v:=private.encounter_weapon_event_resolver_preflight_shadow_v1(
   p,action_id,other_p,sword,1);
 if v->'canonicalWeaponProfile' is distinct from baseline
 or v->>'exactCatalogMatch'<>'true'
 or v->>'attackOrdinal'<>'1'
 or v->>'baseDisadvantage'<>'false'
 or v->>'projectedTargetAc' is null
 or v->>'attackRollMade'<>'false'
 or v->>'guidingBoltEffectConsumed'<>'false'
 or v->>'damageApplied'<>'false'
 or v->>'canonicalActionSpent'<>'false'
 or v->>'combatConsumerEnforced'<>'false'
 then raise exception 'Exact canonical profile preview overclaimed effects %',v; end if;
 if (select count(*) from public.encounter_attack_events_shadow_v1
      where action_request_id=action_id)<>0 then
   raise exception 'Preflight reserved an attack slot'; end if;

 update public.fixture_weapon_targeting_context
 set distance_ft=35,cover_bonus=2,has_los=true where id=1;
 v:=private.encounter_weapon_event_resolver_preflight_shadow_v1(
   p,action_id,other_p,bow,1);
 target:=public.encounter_targeting_context_internal_v1(p,other_p);
 if v->'canonicalTargeting' is distinct from target
 or v->>'distanceFt'<>'35'
 or v->>'longRangeDisadvantage'<>'true'
 or v->>'projectedTargetAc' is null
 or v->>'baseDisadvantage'<>'true'
 then raise exception 'Canonical ranged long/normal distance or cover calculation diverged %',v; end if;

 update public.fixture_weapon_targeting_context set has_los=false where id=1;
 blocked:=false;
 begin perform private.encounter_weapon_event_resolver_preflight_shadow_v1(
    p,action_id,other_p,bow,1);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Blocked LOS accepted'; end if;

 update public.fixture_weapon_targeting_context set has_los=true,distance_ft=61 where id=1;
 blocked:=false;
 begin perform private.encounter_weapon_event_resolver_preflight_shadow_v1(
    p,action_id,other_p,bow,1);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Beyond-long-range bow accepted'; end if;

 update public.fixture_weapon_targeting_context set distance_ft=11 where id=1;
 blocked:=false;
 begin perform private.encounter_weapon_event_resolver_preflight_shadow_v1(
    p,action_id,other_p,sword,1);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Beyond-melee-reach sword accepted'; end if;

 update public.fixture_weapon_targeting_context set distance_ft=5 where id=1;
 blocked:=false;
 begin perform private.encounter_weapon_event_resolver_preflight_shadow_v1(
    p,action_id,other_p,unsupported,1);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Unknown catalogue item accepted as trusted weapon'; end if;
 blocked:=false;
 begin perform private.encounter_weapon_event_resolver_preflight_shadow_v1(
    p,action_id,p,sword,1);
 exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'Self-target accepted'; end if;
 blocked:=false;
 begin perform private.encounter_weapon_event_resolver_preflight_shadow_v1(
    p,action_id,other_p,sword,2);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Skipped attack ordinal accepted by resolver preflight'; end if;

 -- The real resolver must remain the sole place that consumes a one-shot
 -- advantage effect. This readonly shadow MUST NEVER call it.
 update public.encounter_participants set action_available=false where id=p;
 blocked:=false;
 begin perform private.encounter_weapon_event_resolver_preflight_shadow_v1(
    p,action_id,other_p,sword,1);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Canonical Action-spent preflight bypassed'; end if;
 update public.encounter_participants set action_available=true where id=p;
 update public.encounters set active_participant_id=other_p where id=e;
 blocked:=false;
 begin perform private.encounter_weapon_event_resolver_preflight_shadow_v1(
    p,action_id,other_p,sword,1);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Out-of-turn resolver preview accepted'; end if;
 update public.encounters set active_participant_id=p where id=e;

 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)
 into inventory_after from public.inventory_items x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.participant_id,x.slot_level),'[]'::jsonb)
 into slots_after from public.encounter_spell_slots x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)
 into combat_after from public.encounter_participants x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.request_id),'[]'::jsonb)
 into requests_after from public.encounter_command_requests x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.request_id),'[]'::jsonb)
 into events_after from public.encounter_attack_events_shadow_v1 x;
 if inventory_before is distinct from inventory_after
 or slots_before is distinct from slots_after
 or combat_before is distinct from combat_after
 or requests_before is distinct from requests_after
 or events_before is distinct from events_after then
   raise exception 'Read-only resolver preflight changed game, idempotency or attack slots'; end if;
end $test$;
select 'Canonical weapon profile, LOS/range/cover, source trust and zero irreversible resolver side effects passed' as result;

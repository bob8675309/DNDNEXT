\set ON_ERROR_STOP on
-- Fully isolated PostgreSQL16. Compose all prior sourced combat/attunement
-- and canonical event audit fixtures without invoking the real attack writer.
\i scripts/fixtures/encounter_attack_action_sequence_audit_shadow.sql
-- Model the actual catalogue fields used for exact base-class grant resolution.
create table public.class_feature_catalog(
 id uuid primary key,feature_key text,feature_type text,name text,
 source text,class_key text,class_source text,subclass_name text,
 level smallint,description text
);
insert into public.class_catalog(
 id,class_key,class_name,source,ruleset,spellcasting_ability,caster_progression,prepared_spells_formula
) values
('eeeeeeee-aaaa-4000-8000-000000000011','fighter','Fighter','XPHB','2024',null,null,null),
('eeeeeeee-aaaa-4000-8000-000000000012','fighter','Fighter','PHB','2014',null,null,null),
('eeeeeeee-aaaa-4000-8000-000000000013','barbarian','Barbarian','XPHB','2024',null,null,null);
insert into public.class_feature_catalog(
 id,feature_key,feature_type,name,source,class_key,class_source,subclass_name,level,description
) values
('ffff0000-0000-4000-8000-000000000005','class:fighter:xphb::extra-attack:xphb:5','class','Extra Attack','XPHB','fighter','XPHB',null,5,'Attack twice'),
('ffff0000-0000-4000-8000-000000000011','class:fighter:xphb::two-extra-attacks:xphb:11','class','Two Extra Attacks','XPHB','fighter','XPHB',null,11,'Attack three times'),
('ffff0000-0000-4000-8000-000000000020','class:fighter:xphb::three-extra-attacks:xphb:20','class','Three Extra Attacks','XPHB','fighter','XPHB',null,20,'Attack four times'),
('ffff0000-0000-4000-8000-000000000105','class:fighter:phb::extra-attack:phb:5','class','Extra Attack','PHB','fighter','PHB',null,5,'Attack twice'),
('ffff0000-0000-4000-8000-000000000111','class:fighter:phb::extra-attack-2:phb:11','class','Extra Attack (2)','PHB','fighter','PHB',null,11,'Attack three times'),
('ffff0000-0000-4000-8000-000000000120','class:fighter:phb::extra-attack-3:phb:20','class','Extra Attack (3)','PHB','fighter','PHB',null,20,'Attack four times'),
('ffff0000-0000-4000-8000-000000000205','class:barbarian:xphb::extra-attack:xphb:5','class','Extra Attack','XPHB','barbarian','XPHB',null,5,'Attack twice'),
('ffff0000-0000-4000-8000-000000000300','subclass:fighter:xphb:spoof:extra-attack:xphb:1','subclass','Extra Attack','XPHB','fighter','XPHB','Spoof',1,'Must not grant'),
('ffff0000-0000-4000-8000-000000000301','subclass:wizard:xphb:bladesinger:extra-attack:frhof:6','subclass','Extra Attack','FRHoF','wizard','XPHB','Bladesinger',6,'Subclass alone unverified'),
('ffff0000-0000-4000-8000-000000000302','class:fighter:phb::extra-attack-2:xphb:11','class','Extra Attack (2)','XPHB','fighter','PHB',null,11,'Cross-source must not grant');

\i sql/20261027_01_attack_action_source_budget_shadow.sql
do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 c2 uuid:='cccccccc-0000-4000-8000-000000000002';
 p uuid:='dddddddd-0000-4000-8000-000000000001';
 p2 uuid:='dddddddd-0000-4000-8000-000000000002';
 e uuid:='ffffffff-0000-4000-8000-000000000001';
 fighter uuid:='eeeeeeee-aaaa-4000-8000-000000000011';
 fighter_phb uuid:='eeeeeeee-aaaa-4000-8000-000000000012';
 barbarian uuid:='eeeeeeee-aaaa-4000-8000-000000000013';
 wizard uuid:='eeeeeeee-aaaa-4000-8000-000000000002';
 base_request uuid:='ddaa0000-0000-4000-8000-000000000001';
 alt_request uuid:='ddaa0000-0000-4000-8000-000000000002';
 evt1 uuid:='ddbb0000-0000-4000-8000-000000000001';
 evt2 uuid:='ddbb0000-0000-4000-8000-000000000002';
 evt3 uuid:='ddbb0000-0000-4000-8000-000000000003';
 evt4 uuid:='ddbb0000-0000-4000-8000-000000000004';
 v jsonb;
 result1 jsonb;
 replay jsonb;
 blocked boolean;
 slots_before jsonb;
 slots_after jsonb;
 equipment_before jsonb;
 equipment_after jsonb;
 participants_before jsonb;
 participants_after jsonb;
 hands_before jsonb;
 hands_after jsonb;
begin
 if has_table_privilege('anon','public.encounter_attack_action_sessions_shadow_v1','SELECT')
 or has_table_privilege('authenticated','public.encounter_attack_events_shadow_v1','INSERT')
 or has_function_privilege('anon','public.begin_encounter_attack_action_shadow_v1(uuid,uuid,integer,integer)','EXECUTE')
 or has_function_privilege('anon','public.record_encounter_attack_event_shadow_v1(uuid,uuid,uuid,integer)','EXECUTE')
 or has_function_privilege('authenticated','private.encounter_attack_capacity_source_shadow_v1(uuid)','EXECUTE')
 or not has_function_privilege('authenticated','public.begin_encounter_attack_action_shadow_v1(uuid,uuid,integer,integer)','EXECUTE')
 then raise exception 'Attack action shadow ACL failure'; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 update public.character_progression set class_id=fighter,class_level=4 where character_id=c;
 v:=private.encounter_attack_capacity_source_shadow_v1(c);
 if (v->>'attacksAllowed')::integer<>1 or v->>'sourceReady'<>'true'
 or v->>'baseClassFeatureVerified'<>'false'
 then raise exception 'Level 4 fighter gained unearned Extra Attack %',v; end if;
 update public.character_progression set class_level=5 where character_id=c;
 v:=private.encounter_attack_capacity_source_shadow_v1(c);
 if (v->>'attacksAllowed')::integer<>2
 or v->>'sourceStatus'<>'base_class_feature_verified'
 then raise exception 'XPHB Fighter Extra Attack level 5 missing %',v; end if;
 update public.character_progression set class_level=11 where character_id=c;
 v:=private.encounter_attack_capacity_source_shadow_v1(c);
 if (v->>'attacksAllowed')::integer<>3
 then raise exception 'XPHB Fighter two Extra Attacks tier missing %',v; end if;
 update public.character_progression set class_level=20 where character_id=c;
 v:=private.encounter_attack_capacity_source_shadow_v1(c);
 if (v->>'attacksAllowed')::integer<>4
 then raise exception 'XPHB Fighter three Extra Attacks tier missing %',v; end if;

 update public.character_progression set class_id=fighter_phb,class_level=11 where character_id=c;
 v:=private.encounter_attack_capacity_source_shadow_v1(c);
 if (v->>'attacksAllowed')::integer<>3
 or v->>'classSource'<>'PHB'
 then raise exception 'PHB Fighter sourced progression mixed 2024 tiers %',v; end if;

 update public.character_progression set class_id=barbarian,class_level=5 where character_id=c;
 v:=private.encounter_attack_capacity_source_shadow_v1(c);
 if (v->>'attacksAllowed')::integer<>2
 then raise exception 'Barbarian base class level 5 Extra Attack missing %',v; end if;

 update public.character_progression set class_id=wizard,class_level=6 where character_id=c;
 v:=private.encounter_attack_capacity_source_shadow_v1(c);
 if (v->>'attacksAllowed')::integer<>1
 or v->>'baseClassFeatureVerified'<>'false'
 or v->>'subclassFeaturesVerified'<>'false'
 then raise exception 'Unselected Wizard Bladesinger subclass grant was silently assumed %',v; end if;
 update public.character_progression set class_id=fighter,class_level=11 where character_id=c;
 delete from public.class_feature_catalog
 where feature_key='class:fighter:xphb::two-extra-attacks:xphb:11';
 v:=private.encounter_attack_capacity_source_shadow_v1(c);
 if v->>'sourceReady'<>'false'
 or v->>'sourceStatus'<>'missing_source_fighter_two_extra_attacks'
 then raise exception 'Missing required exact source feature quietly granted attacks %',v; end if;
 blocked:=false;
 update public.encounters set status='active',active_participant_id=p,round=4,turn_index=0 where id=e;
 update public.encounter_participants set action_available=true,is_defeated=false where id=p;
 begin perform public.begin_encounter_attack_action_shadow_v1(p,base_request,4,0);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Missing feature source permitted Attack action shadow'; end if;
 insert into public.class_feature_catalog(
 id,feature_key,feature_type,name,source,class_key,class_source,subclass_name,level,description
 ) values('ffff0000-0000-4000-8000-000000000011',
 'class:fighter:xphb::two-extra-attacks:xphb:11','class','Two Extra Attacks',
 'XPHB','fighter','XPHB',null,11,'Attack three times');

 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb)
 into equipment_before from public.inventory_items i;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into slots_before from public.encounter_spell_slots s;
 select coalesce(jsonb_agg(to_jsonb(ep) order by ep.id),'[]'::jsonb)
 into participants_before from public.encounter_participants ep;
 select coalesce(jsonb_agg(to_jsonb(h) order by h.participant_id,h.hand),'[]'::jsonb)
 into hands_before from public.encounter_hand_snapshot_items_shadow_v1 h;

 v:=public.begin_encounter_attack_action_shadow_v1(p,base_request,4,0);
 if v->>'attacksAllowed'<>'3'
 or v->>'canonicalActionSpent'<>'false'
 or v->>'combatConsumerEnforced'<>'false'
 then raise exception 'Fighter 11 attack sequence did not derive THREE shadow slots %',v; end if;
 replay:=public.begin_encounter_attack_action_shadow_v1(p,base_request,4,0);
 if replay->>'replayed'<>'true'
 or replay->>'attacksAllowed'<>'3'
 then raise exception 'Identical Attack action replay did not match capacity %',replay; end if;
 blocked:=false;
 begin perform public.begin_encounter_attack_action_shadow_v1(p,alt_request,4,0);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Duplicate different Attack action request accepted same turn'; end if;
 blocked:=false;
 begin perform public.begin_encounter_attack_action_shadow_v1(p,base_request,5,0);
 exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Reused Attack action UUID accepted changed turn'; end if;

 result1:=public.record_encounter_attack_event_shadow_v1(p,base_request,evt1,1);
 if result1->>'attackOrdinal'<>'1'
 or result1->>'attacksRemaining'<>'2'
 or result1->>'damageApplied'<>'false'
 or result1->>'canonicalActionSpent'<>'false'
 then raise exception 'First simulated attack spent Action or damaged target %',result1; end if;
 replay:=public.record_encounter_attack_event_shadow_v1(p,base_request,evt1,1);
 if replay is distinct from result1 then
 raise exception 'Identical event replay incremented ordinal'; end if;
 blocked:=false;
 begin perform public.record_encounter_attack_event_shadow_v1(p,base_request,evt3,3);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Skipped attack ordinal accepted'; end if;
 blocked:=false;
 begin perform public.record_encounter_attack_event_shadow_v1(p,base_request,evt1,2);
 exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Reused event UUID allowed different attack ordinal'; end if;

 v:=public.record_encounter_attack_event_shadow_v1(p,base_request,evt2,2);
 if v->>'attacksRemaining'<>'1' then
 raise exception 'Second simulated attack lacks derived budget %',v; end if;
 v:=public.record_encounter_attack_event_shadow_v1(p,base_request,evt3,3);
 if v->>'attacksRemaining'<>'0' then
 raise exception 'Third simulated attack lacks correct remaining count %',v; end if;
 blocked:=false;
 begin perform public.record_encounter_attack_event_shadow_v1(p,base_request,evt4,4);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Fourth attack exceeded Fighter level 11 source capacity'; end if;

 -- Canonical Action spending by another writer blocks NEW simulated events.
 -- A genuinely identical retry remains idempotent, never re-enacts anything.
 update public.encounter_participants set action_available=false where id=p;
 replay:=public.record_encounter_attack_event_shadow_v1(p,base_request,evt1,1);
 if replay is distinct from result1 then
 raise exception 'Replay after canonical Action spent was not idempotent'; end if;
 blocked:=false;
 begin perform public.record_encounter_attack_event_shadow_v1(p,base_request,evt4,4);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Canonical Action-spent guard bypassed'; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000009',true);
 blocked:=false;
 begin perform public.record_encounter_attack_event_shadow_v1(p,base_request,evt1,1);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Other account replayed shadow Attack event'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);

 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb)
 into equipment_after from public.inventory_items i;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into slots_after from public.encounter_spell_slots s;
 -- Fixture changed p.action_available explicitly; restore to compare without
 -- hiding a real command mutation.
 update public.encounter_participants set action_available=true where id=p;
 select coalesce(jsonb_agg(to_jsonb(ep) order by ep.id),'[]'::jsonb)
 into participants_after from public.encounter_participants ep;
 select coalesce(jsonb_agg(to_jsonb(h) order by h.participant_id,h.hand),'[]'::jsonb)
 into hands_after from public.encounter_hand_snapshot_items_shadow_v1 h;
 if equipment_after is distinct from equipment_before
 or slots_after is distinct from slots_before
 or participants_after is distinct from participants_before
 or hands_after is distinct from hands_before then
 raise exception 'Shadow Attack sequence touched real equipment, combat, spells or hands'; end if;
end $test$;
select 'Source-derived Fighter/Barbarian attack budgets, idempotent ordered shadow events and resource isolation passed' result;

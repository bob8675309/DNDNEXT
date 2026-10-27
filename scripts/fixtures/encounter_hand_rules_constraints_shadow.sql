\set ON_ERROR_STOP on
-- Disposable PG16 only: exact prior source/owner/turn/transition suites first.
\i scripts/fixtures/encounter_hand_transition_command_shadow.sql
-- The production normalized spells catalogue has these typed component
-- columns; the older tactical fixture intentionally modelled a narrow slice.
alter table public.spells_catalog add column components_v boolean,
 add column components_s boolean, add column components_m boolean,
 add column material_text text;
update public.spells_catalog set components_v=true,components_s=true,
  components_m=false where spell_key='eldritch-blast|xphb';
update public.spells_catalog set components_v=true,components_s=true,
  components_m=true,material_text='a twig struck by lightning'
  where spell_key='witch-bolt|xphb';
update public.spells_catalog set components_v=true,components_s=false,
  components_m=false where spell_key='sacred-flame|xphb';

insert into public.items_catalog(item_key,item_rarity,item_name,payload) values
 ('Greatsword|XPHB','mundane','Greatsword',
  '{"type":"M|XPHB","item_type":"Melee Weapon","property":["H","2H"],"propertiesText":"Heavy, Two-Handed"}'::jsonb),
 ('Longsword|XPHB','mundane','Longsword',
  '{"type":"M|XPHB","item_type":"Melee Weapon","property":["V"],"propertiesText":"Versatile"}'::jsonb),
 ('Shield|XPHB','mundane','Shield',
  '{"type":"S|XPHB","item_type":"Shield","property":[]}'::jsonb),
 ('Animated Shield|XDMG','very rare','Animated Shield',
  '{"type":"S|XPHB","item_type":"Shield","property":[]}'::jsonb);
insert into public.inventory_items(
 id,item_id,item_name,item_rarity,card_payload,owner_type,owner_id,
 is_equipped,equip_slot,item_type
) values
 ('eeeeeeee-0000-4000-8000-000000000040','Greatsword|XPHB',
  'Greatsword','mundane','{}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000001',true,'weapon_1','Melee Weapon'),
 ('eeeeeeee-0000-4000-8000-000000000041','Longsword|XPHB',
  'Longsword','mundane','{}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000001',true,'weapon_2','Melee Weapon'),
 ('eeeeeeee-0000-4000-8000-000000000042','Shield|XPHB',
  'Shield','mundane','{}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000001',true,'weapon_3','Shield'),
 ('eeeeeeee-0000-4000-8000-000000000043','Animated Shield|XDMG',
  'Animated Shield','very rare','{}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000001',true,'weapon_3','Shield'),
 ('eeeeeeee-0000-4000-8000-000000000044','Unknown Practice Sword',
  'Unknown Practice Sword','mundane','{}'::jsonb,
  'character','cccccccc-0000-4000-8000-000000000001',true,'weapon_2','Melee Weapon');
\i sql/20261026_08_encounter_hand_rules_constraints_shadow.sql

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 p uuid:='dddddddd-0000-4000-8000-000000000001';
 e uuid:='ffffffff-0000-4000-8000-000000000001';
 sword uuid:='eeeeeeee-0000-4000-8000-000000000040';
 versatile uuid:='eeeeeeee-0000-4000-8000-000000000041';
 shield uuid:='eeeeeeee-0000-4000-8000-000000000042';
 animated uuid:='eeeeeeee-0000-4000-8000-000000000043';
 unknown_item uuid:='eeeeeeee-0000-4000-8000-000000000044';
 blast uuid:='eeeeeeee-cccc-4000-8000-000000000001';
 witch uuid:='eeeeeeee-cccc-4000-8000-000000000002';
 other_spell uuid:='eeeeeeee-cccc-4000-8000-000000000004';
 r jsonb;
 hands jsonb;
 target jsonb;
 spell jsonb;
 slots_before jsonb;
 slots_after jsonb;
 combat_before jsonb;
 combat_after jsonb;
 blocked boolean;
begin
 if has_function_privilege('anon',
   'private.encounter_hand_rules_constraints_shadow_v1(uuid,uuid)','EXECUTE')
 or has_function_privilege('authenticated',
   'private.encounter_hand_rules_constraints_shadow_v1(uuid,uuid)','EXECUTE')
 or not has_function_privilege('service_role',
   'private.encounter_hand_rules_constraints_shadow_v1(uuid,uuid)','EXECUTE')
 then raise exception 'Private hand rules audit callable by browser roles'; end if;

 perform set_config('fixture.role','service_role',true);
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into slots_before from public.encounter_spell_slots s;
 select coalesce(jsonb_agg(to_jsonb(ep) order by ep.id),'[]'::jsonb)
 into combat_before from public.encounter_participants ep;

 -- Fresh precombat recaptures are an explicit disposable fixture action.
 update public.encounters set status='ready',active_participant_id=null where id=e;
 perform public.set_character_hand_loadout_staging_v1(c,sword,shield);
 perform public.capture_encounter_hand_snapshot_shadow_v1(p);
 update public.encounters set status='active',active_participant_id=p where id=e;

 r:=private.encounter_hand_rules_constraints_shadow_v1(p,witch);
 if (r->>'occupiedHands')::integer<>2
 or (r->>'unoccupiedHands')::integer<>0
 or r->>'activeHandsVerified'<>'false'
 or r->>'combatConsumerEnforced'<>'false'
 or r->>'attackActionInteractionPaid'<>'false'
 or r->>'shieldUtilizeActionPaid'<>'false'
 then raise exception 'Occupied hand review falsely charged canonical actions %',r; end if;
 select value into target from jsonb_array_elements(r->'capturedHands')
 where value->>'inventoryItemId'=sword::text;
 if target->>'catalogExactMatch'<>'true'
 or target->>'twoHandedPropertyObserved'<>'true'
 or target->>'versatilePropertyObserved'<>'false'
 or target->>'twoHandedAttackGripConflictCandidate'<>'true'
 or target->>'twoHandedAttackGripVerified'<>'false'
 or target->>'attackActionWeaponInteractionContext'<>'true'
 then raise exception 'Exact 2H Greatsword with occupied off-hand was misclassified %',target; end if;
 select value into target from jsonb_array_elements(r->'capturedHands')
 where value->>'inventoryItemId'=shield::text;
 if target->>'shieldTypeCandidate'<>'true'
 or target->>'shieldDonDoffUtilizeContext'<>'true'
 or target->>'shieldDonDoffPaid'<>'false'
 or target->>'attackEquipInteractionPaid'<>'false'
 then raise exception 'Shield incorrectly treated as Attack weapon/free swap %',target; end if;
 spell:=r->'spellComponents';
 if spell->'componentSource'->>'somatic'<>'true'
 or spell->'componentSource'->>'material'<>'true'
 or spell->'componentSource'->>'materialText'<>'a twig struck by lightning'
 or spell->>'somaticHandSignal'<>'requires_verified_somatic_exception_or_free_hand'
 or spell->>'materialAccessSignal'<>'focus_or_component_access_unverified'
 or spell->>'spellCastEligibilityVerified'<>'false'
 then raise exception 'S/M spell cast called allowed/blocked without proof %',spell; end if;

 r:=private.encounter_hand_rules_constraints_shadow_v1(p,blast);
 spell:=r->'spellComponents';
 if spell->>'materialAccessSignal'<>'no_material_component'
 or spell->>'somaticHandSignal'<>'requires_verified_somatic_exception_or_free_hand'
 then raise exception 'S-only spell components were lost %',spell; end if;

 blocked:=false;
 begin perform private.encounter_hand_rules_constraints_shadow_v1(p,other_spell);
 exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'Other character spell assignment was trusted'; end if;

 -- No companion shield: 2H attack grip conflict clears, but never becomes
 -- an authoritative "attack allowed" or "both hands free" decision.
 update public.encounters set status='ready',active_participant_id=null where id=e;
 perform public.set_character_hand_loadout_staging_v1(c,sword,null);
 perform public.capture_encounter_hand_snapshot_shadow_v1(p);
 update public.encounters set status='active',active_participant_id=p where id=e;
 r:=private.encounter_hand_rules_constraints_shadow_v1(p,witch);
 select value into target from jsonb_array_elements(r->'capturedHands')
 where value->>'inventoryItemId'=sword::text;
 if target->>'twoHandedAttackGripConflictCandidate'<>'false'
 or target->>'twoHandedAttackGripVerified'<>'false'
 or (r->>'unoccupiedHands')::integer<>1
 or r->'spellComponents'->>'somaticHandSignal'<>'free_hand_slot_candidate_not_grip_proof'
 or r->'spellComponents'->>'materialAccessSignal'<>'free_hand_slot_candidate_not_material_proof'
 then raise exception 'Two-handed equipment/one empty hand overclaimed cast readiness %',r; end if;

 -- Versatile is a damage/attack grip option, not a mandatory second hand.
 update public.encounters set status='ready',active_participant_id=null where id=e;
 perform public.set_character_hand_loadout_staging_v1(c,versatile,shield);
 perform public.capture_encounter_hand_snapshot_shadow_v1(p);
 update public.encounters set status='active',active_participant_id=p where id=e;
 r:=private.encounter_hand_rules_constraints_shadow_v1(p,null);
 select value into target from jsonb_array_elements(r->'capturedHands')
 where value->>'inventoryItemId'=versatile::text;
 if target->>'versatilePropertyObserved'<>'true'
 or target->>'twoHandedPropertyObserved'<>'false'
 or target->>'twoHandedAttackGripConflictCandidate'<>'false'
 or r->'spellComponents' is distinct from 'null'::jsonb then
   raise exception 'Versatile longsword was misread as mandatory 2H %',r; end if;

 -- Magic Animated Shield is an exception-rich item. Source type matches
 -- Shield, but movement/don/doff special features stay UNVERIFIED.
 update public.encounters set status='ready',active_participant_id=null where id=e;
 perform public.set_character_hand_loadout_staging_v1(c,versatile,animated);
 perform public.capture_encounter_hand_snapshot_shadow_v1(p);
 update public.encounters set status='active',active_participant_id=p where id=e;
 r:=private.encounter_hand_rules_constraints_shadow_v1(p,null);
 select value into target from jsonb_array_elements(r->'capturedHands')
 where value->>'inventoryItemId'=animated::text;
 if target->>'shieldTypeCandidate'<>'true'
 or target->>'animatedShieldExceptionVerified'<>'false'
 or target->>'shieldDonDoffPaid'<>'false' then
   raise exception 'Animated Shield exception was incorrectly auto-enforced %',target; end if;

 -- An unknown source is never invented from a display name.
 update public.encounters set status='ready',active_participant_id=null where id=e;
 perform public.set_character_hand_loadout_staging_v1(c,unknown_item,null);
 perform public.capture_encounter_hand_snapshot_shadow_v1(p);
 update public.encounters set status='active',active_participant_id=p where id=e;
 r:=private.encounter_hand_rules_constraints_shadow_v1(p,null);
 select value into target from jsonb_array_elements(r->'capturedHands')
 where value->>'inventoryItemId'=unknown_item::text;
 if target->>'catalogExactMatch'<>'false'
 or target->>'twoHandedPropertyObserved'<>'false'
 or not (r->'unresolvedRuleSignals' ? 'missing_exact_catalogue_property_source')
 then raise exception 'Unknown custom item gained imagined official property %',r; end if;

 -- Invalidated capture fails closed and no data is auto-healed.
 update public.inventory_items set card_payload=card_payload || '{"custom":"changed"}'::jsonb
 where id=unknown_item;
 blocked:=false;
 begin perform private.encounter_hand_rules_constraints_shadow_v1(p,null);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Invalidated source snapshot still passed rules audit'; end if;

 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into slots_after from public.encounter_spell_slots s;
 if slots_before is distinct from slots_after then
   raise exception 'Rules audit changed tactical spell slots'; end if;
 select coalesce(jsonb_agg(to_jsonb(ep) order by ep.id),'[]'::jsonb)
 into combat_after from public.encounter_participants ep;
 if combat_before is distinct from combat_after then
   raise exception 'Rules audit spent canonical attack/bonus/reaction or changed HP'; end if;
end $test$;
select 'Hand item properties, shield action context, spell S/M components and unchanged gameplay source audit passed' result;

\set ON_ERROR_STOP on
-- Disposable PG16, not production. Compose the original tactical profiles
-- and the prior exact-assignment preflight fixtures with real-schema roles.
\i scripts/fixtures/attuned_tactical_spell_execution_preflight_shadow.sql
\i sql/20261026_03_attuned_focus_provenance_shadow.sql

insert into public.items_catalog(item_key,item_rarity,item_name,payload) values
 ('+1 Amulet of the Devout|TCE','uncommon','+1 Amulet of the Devout',
  '{"bonusSpellAttack":"+1","bonusSpellSaveDc":"+1"}'::jsonb);
insert into public.inventory_items(
 id,item_id,item_name,item_rarity,card_payload,owner_type,owner_id,
 is_equipped,equip_slot,item_type
) values
 ('eeeeeeee-0000-4000-8000-000000000033','+1 Amulet of the Devout|TCE',
 '+1 Amulet of the Devout','uncommon','{}'::jsonb,
 'character','cccccccc-0000-4000-8000-000000000001',true,'neck','amulet');

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 other uuid:='cccccccc-0000-4000-8000-000000000002';
 p uuid:='dddddddd-0000-4000-8000-000000000001';
 other_p uuid:='dddddddd-0000-4000-8000-000000000002';
 blast uuid:='eeeeeeee-cccc-4000-8000-000000000001';
 wizard_spell uuid:='eeeeeeee-cccc-4000-8000-000000000004';
 rod uuid:='eeeeeeee-0000-4000-8000-000000000030';
 wand uuid:='eeeeeeee-0000-4000-8000-000000000031';
 grimoire uuid:='eeeeeeee-0000-4000-8000-000000000032';
 amulet uuid:='eeeeeeee-0000-4000-8000-000000000033';
 r jsonb;
 item jsonb;
 original_slots jsonb;
 final_slots jsonb;
begin
 if has_function_privilege('anon',
  'private.encounter_attuned_focus_provenance_shadow_v1(uuid,uuid)','EXECUTE')
 or has_function_privilege('authenticated',
  'private.encounter_attuned_focus_provenance_shadow_v1(uuid,uuid)','EXECUTE')
 or not has_function_privilege('service_role',
  'private.encounter_attuned_focus_provenance_shadow_v1(uuid,uuid)','EXECUTE')
 then raise exception 'Focus provenance diagnostic exposed to browser credentials'; end if;
 perform set_config('fixture.role','service_role',true);
 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into original_slots from public.encounter_spell_slots s;
 -- Inherited fixture ended with attunement OFF.
 r:=private.encounter_attuned_focus_provenance_shadow_v1(p,blast);
 if r->>'attunementEnabled'<>'false'
 or r->>'consumerEnforced'<>'false'
 or r->>'heldOrWornVerified'<>'false'
 or r->>'stackingVerified'<>'false'
 or r->>'focusBonusApplied'<>'false'
 then raise exception 'OFF diagnostic changed canonical spell behavior %',r; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(true);
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 perform public.set_character_rest_magic_choices_v1(c,array[rod,wand,amulet]);
 r:=private.encounter_attuned_focus_provenance_shadow_v1(p,blast);
 if r->>'spellOriginSignal'<>'class_label_matches_progression_but_spell_list_unverified'
    or (r->>'selectedFocusCount')::integer<>3
    or (r->>'plausibleFocusCount')::integer<>3
    or r->>'sourceProofReady'<>'false'
    or r->>'spellSourceVerified'<>'false'
    or r->>'focusBonusApplied'<>'false'
    or not (r->'unresolved' ? 'multiple_selected_focus_sources_no_stacking_rule')
    or not (r->'unresolved' ? 'multiple_plausible_focus_sources_unresolved')
 then raise exception 'Three selected focuses falsely proved holding or stacking %',r; end if;

 select value into item from jsonb_array_elements(r->'focusSignals')
 where value->>'inventoryItemId'=rod::text;
 if item->>'requirement'<>'held'
 or item->>'slotSignal'<>'hand_slot_candidate_not_active_hold_proof'
 or item->>'activeHoldVerified'<>'false'
 or item->>'bonusApplied'<>'false'
 then raise exception 'Main-hand Rod equated to actively held proof %',item; end if;
 select value into item from jsonb_array_elements(r->'focusSignals')
 where value->>'inventoryItemId'=amulet::text;
 if item->>'requirement'<>'worn'
 or item->>'slotSignal'<>'wear_slot_candidate_not_worn_proof'
 or item->>'wornConditionVerified'<>'false'
 then raise exception 'Neck Amulet equated to verified worn effect %',item; end if;

 -- DNDNext weapon slots can be equipped in the inventory without proving
 -- which hand actively wields the Rod while casting.
 update public.inventory_items set equip_slot='weapon_1' where id=rod;
 r:=private.encounter_attuned_focus_provenance_shadow_v1(p,blast);
 select value into item from jsonb_array_elements(r->'focusSignals')
 where value->>'inventoryItemId'=rod::text;
 if item->>'slotSignal'<>'weapon_slot_does_not_prove_active_hold'
    or item->>'activeHoldVerified'<>'false'
 then raise exception 'Weapon_1 Rod was misclassified as proven held %',item; end if;

 -- A focus marked equipped in an incompatible slot cannot satisfy held,
 -- and no attunement source may silently assert it is actually in hand.
 update public.inventory_items set equip_slot='backpack' where id=wand;
 r:=private.encounter_attuned_focus_provenance_shadow_v1(p,blast);
 select value into item from jsonb_array_elements(r->'focusSignals')
 where value->>'inventoryItemId'=wand::text;
 if item->>'slotSignal'<>'slot_not_sufficient_for_required_condition'
    or item->>'slotCouldBeCompatible'<>'false'
    or (r->>'plausibleFocusCount')::integer<>2
 then raise exception 'Backpack Wand falsely counted as held candidate %',r; end if;

 -- Spell assignments labeled as item-granted must never automatically
 -- be recognized as class-list Warlock spells merely by current class.
 update public.character_spells set source_type='item',source_label='Item'
 where id=blast;
 r:=private.encounter_attuned_focus_provenance_shadow_v1(p,blast);
 if r->>'spellOriginSignal'<>'nonclass_assignment_requires_provenance'
    or (r->>'plausibleFocusCount')::integer<>0
    or not (r->'unresolved' ? 'spell_origin_unverified')
 then raise exception 'Item-provided spell borrowed Warlock class provenance %',r; end if;
 update public.character_spells set source_type='class',source_label='Wrong'
 where id=blast;
 r:=private.encounter_attuned_focus_provenance_shadow_v1(p,blast);
 if r->>'spellOriginSignal'<>'assignment_class_label_mismatch'
 then raise exception 'Forged class label not flagged %',r; end if;
 update public.character_spells set source_type='class',source_label='Warlock'
 where id=blast;

 perform public.set_character_rest_magic_choices_v1(other,array[grimoire]);
 r:=private.encounter_attuned_focus_provenance_shadow_v1(other_p,wizard_spell);
 select value into item from jsonb_array_elements(r->'focusSignals')
 where value->>'inventoryItemId'=grimoire::text;
 if r->>'spellOriginSignal'<>'class_label_matches_progression_but_spell_list_unverified'
    or item->>'requirement'<>'held'
    or item->>'slotSignal'<>'hand_slot_candidate_not_active_hold_proof'
    or item->>'sourceSpellListMembershipVerified'<>'false'
 then raise exception 'Wizard Grimoire matching progression was overstated as proven %',r; end if;

 -- No diagnostic may execute a spell or modify any cached slots.
 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into final_slots from public.encounter_spell_slots s;
 if final_slots is distinct from original_slots then
  raise exception 'Provenance shadow changed encounter spell slots'; end if;
end $test$;
select 'Focus provenance: equipped hand/weapon/neck signals, class-source hints, ambiguity and immutable spells/slots passed' as result;

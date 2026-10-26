\set ON_ERROR_STOP on
-- Disposable PG16 only: all inherited profile, item, source and spell-slot
-- fixtures run first, then specific execution preflight is installed.
\i scripts/fixtures/attuned_tactical_spellcasting_shadow.sql
\i sql/20261026_02_attuned_spell_execution_preflight_shadow.sql

-- Add a save-only class spell; the Wand's spell-attack-only bonus must not
-- become a saving-throw DC bonus.
insert into public.spells_catalog values
('eeeeeeee-bbbb-4000-8000-000000000003','sacred-flame|xphb','Sacred Flame',
'XPHB',0,'evocation','action','60 feet',false,null,'["dex"]'::jsonb,'1d8','["radiant"]',null);
insert into public.character_spells(
 id,character_id,spell_id,source_type,source_label,prepared,always_available,
 uses_max,uses_remaining,recharge,casting_stat,save_dc_override,attack_bonus_override
) values
 ('eeeeeeee-cccc-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000001',
 'eeeeeeee-bbbb-4000-8000-000000000003','class','Warlock',true,true,
 null,null,null,'cha',null,null);

-- Another character has a Wizard class and independently owned Grimoire.
insert into public.class_level_progression values
 ('eeeeeeee-aaaa-4000-8000-000000000002',6,3,'[0,0,0,0,0,0,0,0,0]'::jsonb);
update public.character_progression set class_id='eeeeeeee-aaaa-4000-8000-000000000002'
where character_id='cccccccc-0000-4000-8000-000000000002';
update public.character_sheets
set sheet='{"abilities":{"int":{"score":18},"cha":{"score":12}},"proficiencyBonus":3}'::jsonb
where character_id='cccccccc-0000-4000-8000-000000000002';
insert into public.items_catalog(item_key,item_rarity,item_name,payload) values
 ('+1 Arcane Grimoire|TCE','uncommon','+1 Arcane Grimoire',
  '{"bonusSpellAttack":"+1","bonusSpellSaveDc":"+1"}'::jsonb);
insert into public.inventory_items(
 id,item_id,item_name,item_rarity,card_payload,owner_type,owner_id,
 is_equipped,equip_slot,item_type
) values
 ('eeeeeeee-0000-4000-8000-000000000032','+1 Arcane Grimoire|TCE',
 '+1 Arcane Grimoire','uncommon','{}'::jsonb,
 'character','cccccccc-0000-4000-8000-000000000002',true,'off_hand','book');
insert into public.character_spells(
 id,character_id,spell_id,source_type,source_label,prepared,always_available,
 uses_max,uses_remaining,recharge,casting_stat,save_dc_override,attack_bonus_override
) values
 ('eeeeeeee-cccc-4000-8000-000000000004','cccccccc-0000-4000-8000-000000000002',
 'eeeeeeee-bbbb-4000-8000-000000000001','class','Wizard',true,true,
 null,null,null,'int',null,null);

do $test$
declare
 p uuid:='dddddddd-0000-4000-8000-000000000001';
 other_p uuid:='dddddddd-0000-4000-8000-000000000002';
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 other uuid:='cccccccc-0000-4000-8000-000000000002';
 blast uuid:='eeeeeeee-cccc-4000-8000-000000000001';
 witch uuid:='eeeeeeee-cccc-4000-8000-000000000002';
 save_spell uuid:='eeeeeeee-cccc-4000-8000-000000000003';
 wizard_spell uuid:='eeeeeeee-cccc-4000-8000-000000000004';
 staff uuid:='eeeeeeee-0000-4000-8000-000000000002';
 rod uuid:='eeeeeeee-0000-4000-8000-000000000030';
 wand uuid:='eeeeeeee-0000-4000-8000-000000000031';
 grimoire uuid:='eeeeeeee-0000-4000-8000-000000000032';
 r jsonb;
 focus_entry jsonb;
 initial_slots jsonb;
 final_slots jsonb;
 blocked boolean;
begin
 perform set_config('fixture.role','service_role',true);
 if has_function_privilege('anon',
     'private.encounter_attuned_spell_execution_preflight_shadow_v1(uuid,uuid)','EXECUTE')
   or has_function_privilege('authenticated',
     'private.encounter_attuned_spell_execution_preflight_shadow_v1(uuid,uuid)','EXECUTE')
   or not has_function_privilege('service_role',
     'private.encounter_attuned_spell_execution_preflight_shadow_v1(uuid,uuid)','EXECUTE')
 then raise exception 'Private spell preflight ACL exposed to public roles'; end if;

 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
   into initial_slots from public.encounter_spell_slots s;

 -- Inherited tactical profile fixtures finish with OFF; no attunement
 -- selection may be needed and the result must be byte-equal profile JSON.
 r:=private.encounter_attuned_spell_execution_preflight_shadow_v1(p,blast);
 if r->>'attunementEnabled'<>'false'
   or r->'baselineProfile' is distinct from r->'shadowProfile'
   or r->>'writerExecuted'<>'false'
   or r->>'focusApplied'<>'false'
   or r->>'consumerEnforced'<>'false'
 then raise exception 'OFF spell execution preflight changed existing profile %',r; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(true);
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 perform public.set_character_rest_magic_choices_v1(c,array[]::uuid[]);
 r:=private.encounter_attuned_spell_execution_preflight_shadow_v1(p,blast);
 if (r->>'baselineAttackBonus')::integer<>6
 or (r->>'shadowAttackBonus')::integer<>6
 or (r->>'baselineSaveDc')::integer<>14
 or (r->>'shadowSaveDc')::integer<>14
 or r->>'focusApplied'<>'false'
 or r->>'executionParityReady'<>'false'
 then raise exception 'Unselected Warlock spell attack/DC preflight mismatch %',r; end if;
 select value into focus_entry from jsonb_array_elements(r->'focusSourceCandidates')
 where value->>'inventoryItemId'=rod::text;
 if focus_entry->>'scopeStatus'<>'warlock_spell_candidate_requires_held_proof'
 or focus_entry->>'magicRiderEligible'<>'false'
 or focus_entry->>'appliedToPreflight'<>'false'
 then raise exception 'Warlock-only Rod misclassified or applied while unchosen %',focus_entry; end if;
 select value into focus_entry from jsonb_array_elements(r->'focusSourceCandidates')
 where value->>'inventoryItemId'=wand::text;
 if focus_entry->>'scopeStatus'<>'spell_attack_candidate_requires_held_proof'
 or focus_entry->>'bonusOnlySpellAttack'<>'true'
 or focus_entry->>'heldOrWornConfirmed'<>'false'
 then raise exception 'Wand attack-only holding restriction skipped %',focus_entry; end if;

 r:=private.encounter_attuned_spell_execution_preflight_shadow_v1(p,save_spell);
 select value into focus_entry from jsonb_array_elements(r->'focusSourceCandidates')
 where value->>'inventoryItemId'=wand::text;
 if focus_entry->>'scopeStatus'<>'spell_has_no_attack_roll'
 or r->>'spellAttackType' is not null
 then raise exception 'Wand bonus erroneously eligible for save-only spell %',focus_entry; end if;

 perform public.set_character_rest_magic_choices_v1(c,array[staff,rod,wand]);
 r:=private.encounter_attuned_spell_execution_preflight_shadow_v1(p,blast);
 if (r->>'baselineAttackBonus')::integer<>6
   or (r->>'shadowAttackBonus')::integer<>8
   or (r->>'baselineSaveDc')::integer<>14
   or (r->>'shadowSaveDc')::integer<>16
   or (r->>'selectedCastingScore')::integer<>20
   or r->>'focusApplied'<>'false'
   or not (r->'unresolvedSources' ? 'selected_focus_requires_condition_and_stacking_proof')
 then raise exception 'Selected CHA shadow or unverified focus stacking mismatch %',r; end if;
 select value into focus_entry from jsonb_array_elements(r->'focusSourceCandidates')
 where value->>'inventoryItemId'=rod::text;
 if focus_entry->>'magicRiderEligible'<>'true'
 or focus_entry->>'sourceSpellClassVerified'<>'false'
 or focus_entry->>'appliedToPreflight'<>'false'
 then raise exception 'Selected Rod wrongly called source-verified/activated %',focus_entry; end if;

 r:=private.encounter_attuned_spell_execution_preflight_shadow_v1(p,witch);
 if (r->>'baselineAttackBonus')::integer<>11
 or (r->>'shadowAttackBonus')::integer<>11
 or (r->>'baselineSaveDc')::integer<>19
 or (r->>'shadowSaveDc')::integer<>19
 or not (r->'overrideSourceWarnings' ? 'attack_bonus_override_origin_unverified')
 or not (r->'overrideSourceWarnings' ? 'save_dc_override_origin_unverified')
 or r->'knownSpells' is distinct from r->'baselineProfile'->'knownSpells'
 then raise exception 'Per-spell explicit overrides were overwritten by attunement %',r; end if;

 -- A Warlock profile alone does not prove a particular spell was acquired
 -- from its Warlock class list. A changed assignment source is unresolved.
 update public.character_spells set source_type='item',source_label='Item'
 where id=blast;
 r:=private.encounter_attuned_spell_execution_preflight_shadow_v1(p,blast);
 select value into focus_entry from jsonb_array_elements(r->'focusSourceCandidates')
 where value->>'inventoryItemId'=rod::text;
 if focus_entry->>'scopeStatus'<>'spell_class_attribution_unverified'
 then raise exception 'Item-provided spell borrowed Warlock-only rod effect %',focus_entry; end if;
 update public.character_spells set source_type='class',source_label='Warlock'
 where id=blast;

 -- Another character is a Wizard; its separate Grimoire is an eligible
 -- Wizard candidate, but the source is not physically proven held.
 perform public.set_character_rest_magic_choices_v1(other,array[grimoire]);
 r:=private.encounter_attuned_spell_execution_preflight_shadow_v1(other_p,wizard_spell);
 if r->>'castingAbility'<>'int'
 or (r->>'shadowAttackBonus')::integer<>7
 then raise exception 'Wizard spell preflight class/ability mismatch %',r; end if;
 select value into focus_entry from jsonb_array_elements(r->'focusSourceCandidates')
 where value->>'inventoryItemId'=grimoire::text;
 if focus_entry->>'scopeStatus'<>'wizard_spell_candidate_requires_held_proof'
 or focus_entry->>'selectedForCharacter'<>'true'
 or focus_entry->>'appliedToPreflight'<>'false'
 then raise exception 'Wizard-only Grimoire was wrongly applied or scoped %',focus_entry; end if;

 -- Exact character spell assignment ownership is mandatory; caller cannot
 -- preflight another character's assignment using the wrong participant.
 blocked:=false;
 begin perform private.encounter_attuned_spell_execution_preflight_shadow_v1(p,wizard_spell);
 exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'Other character spell assignment was accepted'; end if;
 blocked:=false;
 begin perform private.encounter_attuned_spell_execution_preflight_shadow_v1(p,null);
 exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'Null spell assignment was accepted'; end if;

 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
   into final_slots from public.encounter_spell_slots s;
 if final_slots is distinct from initial_slots then
   raise exception 'Read-only spell preflight mutated encounter spell slot snapshots'; end if;
end $test$;
select 'Specific spell preflight OFF parity, Warlock/Wizard focuses, assignments, overrides and immutable resources passed' as result;

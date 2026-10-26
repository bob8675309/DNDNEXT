\set ON_ERROR_STOP on
\i scripts/fixtures/attuned_focus_provenance_shadow.sql
-- The production spells_catalog already has classes text[], while the
-- prior narrow tactical fixture omits it. Model its real schema here.
alter table public.spells_catalog add column classes text[];
update public.spells_catalog set classes=array['Warlock']::text[]
where spell_key='eldritch-blast|xphb';
update public.spells_catalog set classes=array['Warlock']::text[]
where spell_key='witch-bolt|xphb';
update public.spells_catalog set classes=array['Cleric']::text[]
where spell_key='sacred-flame|xphb';
\i sql/20261026_04_attuned_spell_list_hand_evidence.sql

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 other uuid:='cccccccc-0000-4000-8000-000000000002';
 p uuid:='dddddddd-0000-4000-8000-000000000001';
 other_p uuid:='dddddddd-0000-4000-8000-000000000002';
 blast uuid:='eeeeeeee-cccc-4000-8000-000000000001';
 wizard_spell uuid:='eeeeeeee-cccc-4000-8000-000000000004';
 save_spell uuid:='eeeeeeee-cccc-4000-8000-000000000003';
 rod uuid:='eeeeeeee-0000-4000-8000-000000000030';
 wand uuid:='eeeeeeee-0000-4000-8000-000000000031';
 shared uuid:='eeeeeeee-0000-4000-8000-000000000009';
 r jsonb;
 entry jsonb;
 old_slots jsonb;
 new_slots jsonb;
begin
 if has_function_privilege('anon',
     'private.encounter_attuned_spell_list_hand_evidence_v1(uuid,uuid)','EXECUTE')
 or has_function_privilege('authenticated',
     'private.encounter_attuned_spell_list_hand_evidence_v1(uuid,uuid)','EXECUTE')
 or not has_function_privilege('service_role',
     'private.encounter_attuned_spell_list_hand_evidence_v1(uuid,uuid)','EXECUTE')
 then raise exception 'Read-only spell class/hand evidence exposed to browser roles'; end if;

 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into old_slots from public.encounter_spell_slots s;

 -- OFF must not require proof, change spell stats, or modify resources.
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000001',true);
 perform public.set_campaign_attunement_rule_v1(false);
 r:=private.encounter_attuned_spell_list_hand_evidence_v1(p,blast);
 if r->>'attunementEnabled'<>'false'
   or r->>'classGrantVerified'<>'false'
   or r->>'focusBonusApplied'<>'false'
   or r->>'consumerEnforced'<>'false'
   or r->>'classSpellListStatus'<>'attunement_off_not_evaluated'
 then raise exception 'OFF class evidence changed original spell behavior %',r; end if;

 perform public.set_campaign_attunement_rule_v1(true);
 r:=private.encounter_attuned_spell_list_hand_evidence_v1(p,blast);
 if r->>'classSpellListStatus'<>'catalog_lists_class_but_grant_unverified'
 or r->>'catalogSpellListMembership'<>'true'
 or r->>'spellListMembershipObserved'<>'true'
 or r->>'classGrantVerified'<>'false'
 or r->>'activeHandsVerified'<>'false'
 or r->>'focusBonusApplied'<>'false'
 or (r->>'ambiguousWeaponFocusSlots')::integer<>1
 then raise exception 'Exact XPHB Warlock class-list observation overstated entitlement %',r; end if;

 -- The same exact spell identity is NOT listed for Wizard in the seeded
 -- source; same item/phrase alone cannot create a Wizard class spell.
 r:=private.encounter_attuned_spell_list_hand_evidence_v1(other_p,wizard_spell);
 if r->>'classSpellListStatus'<>'exact_catalog_does_not_list_class'
 or r->>'catalogSpellListMembership'<>'false'
 or r->>'classGrantVerified'<>'false'
 then raise exception 'Spell source class mismatch was not caught %',r; end if;
 update public.spells_catalog set classes=array['Warlock','Wizard']::text[]
 where spell_key='eldritch-blast|xphb';
 r:=private.encounter_attuned_spell_list_hand_evidence_v1(other_p,wizard_spell);
 if r->>'classSpellListStatus'<>'catalog_lists_class_but_grant_unverified'
 or r->>'classGrantVerified'<>'false'
 then raise exception 'Catalog Wizard membership incorrectly certified grant %',r; end if;

 -- Missing catalogue class list cannot be treated as eligible even if
 -- the assignment says the correct class and character is that class.
 update public.spells_catalog set classes=array[]::text[]
 where spell_key='eldritch-blast|xphb';
 r:=private.encounter_attuned_spell_list_hand_evidence_v1(p,blast);
 if r->>'classSpellListStatus'<>'catalog_class_list_missing'
    or r->>'spellListMembershipObserved'<>'false'
 then raise exception 'Missing exact source class-list was assumed %',r; end if;
 update public.spells_catalog set classes=array['Warlock']::text[]
 where spell_key='eldritch-blast|xphb';

 -- Sacred Flame is Cleric-only in this fixture, but assignment is labeled
 -- Warlock. It is a valid spell entry, not a verified Warlock spell grant.
 r:=private.encounter_attuned_spell_list_hand_evidence_v1(p,save_spell);
 if r->>'classSpellListStatus'<>'exact_catalog_does_not_list_class'
 then raise exception 'Incorrectly categorized class spell was accepted %',r; end if;

 update public.character_spells set source_type='item',source_label='Item'
 where id=blast;
 r:=private.encounter_attuned_spell_list_hand_evidence_v1(p,blast);
 if r->>'classSpellListStatus'<>'not_class_granted_assignment'
 or r->>'classGrantVerified'<>'false'
 then raise exception 'Item-provided spell silently acquired class provenance %',r; end if;
 update public.character_spells set source_type='class',source_label='Warlock'
 where id=blast;

 -- A rod in weapon_1 remains an ambiguous storage/equipment signal.
 update public.inventory_items set equip_slot='main_hand' where id=rod;
 update public.inventory_items set equip_slot='off_hand' where id=wand;
 r:=private.encounter_attuned_spell_list_hand_evidence_v1(p,blast);
 if (r->>'explicitHandSlotsWithConflicts')::integer<>0
 or (r->>'explicitHandOccupants')::integer<>2
 or r->>'activeHandsVerified'<>'false'
 then raise exception 'Two different hand-slot entries called active-held proof %',r; end if;

 -- Legacy can claim two items in the same hand. The audit must catch it,
 -- without unequipping either one or assigning a hand at cast time.
 update public.inventory_items set equip_slot='main_hand' where id=wand;
 r:=private.encounter_attuned_spell_list_hand_evidence_v1(p,blast);
 if (r->>'explicitHandSlotsWithConflicts')::integer<>1
 or not (r->'sourceUnresolved' ? 'multiple_equipped_items_same_hand_slot')
 then raise exception 'Same-hand focus conflict not detected %',r; end if;
 select value into entry from jsonb_array_elements(r->'handSlotEvidence')
 where value->>'equipSlot'='main_hand';
 if (entry->>'equippedCount')::integer<>2
 or entry->>'conflicted'<>'true'
 or entry->>'activeHoldVerified'<>'false'
 then raise exception 'Main-hand collision representation invalid %',entry; end if;

 -- Account-owned physical item can appear on two editable characters.
 -- Its custody must NOT be asserted just because it occupies a hand slot.
 update public.inventory_items set equip_slot='off_hand' where id=shared;
 r:=private.encounter_attuned_spell_list_hand_evidence_v1(p,blast);
 if not (r->'sourceUnresolved' ? 'shared_account_hand_custody_unverified')
    or r->>'activeHandsVerified'<>'false'
 then raise exception 'Shared account physical hand claim was treated as owned %',r; end if;

 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into new_slots from public.encounter_spell_slots s;
 if new_slots is distinct from old_slots then
   raise exception 'Hand/source audit touched a live spell-slot snapshot'; end if;
end $test$;
select 'Exact spell-list membership and conservative hand-slot conflict evidence passed' as result;

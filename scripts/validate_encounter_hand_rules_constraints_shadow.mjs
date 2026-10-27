import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
const sql=read("sql/20261026_08_encounter_hand_rules_constraints_shadow.sql");
const fixture=read("scripts/fixtures/encounter_hand_rules_constraints_shadow.sql");
const wf=read(".github/workflows/validate-encounter-hand-rules-constraints-shadow.yml");
const prior=read("sql/20261026_07_encounter_hand_transition_command_shadow.sql");
for(const m of [
 "private.encounter_hand_rules_constraints_shadow_v1",
 "public.get_encounter_hand_snapshot_shadow_v1",
 "private.character_staged_hand_item_valid_v1",
 "v_snapshot->>'snapshotInvalidated'",
 "ic.item_key=v_key",
 "coalesce(v_catalog,'{}'::jsonb)",
 "v_payload->'property'",
 "jsonb_array_elements_text(v_props)",
 "'2H'","'V'",
 "'twoHandedPropertyObserved',v_two_handed",
 "'versatilePropertyObserved',v_versatile",
 "'shieldDonDoffUtilizeContext',v_shield",
 "'twoHandedAttackGripConflictCandidate'",
 "'twoHandedAttackGripVerified',false",
 "v_spell.components_s",
 "v_spell.components_m",
 "v_spell.material_text",
 "where id=p_spell_assignment_id and character_id=v_character",
 "'warCasterExceptionVerified',false",
 "'materialCostConsumptionVerified',false",
 "'spellFocusSubstitutionVerified',false",
 "'spellCastEligibilityVerified',false",
 "'attackActionInteractionPaid',false",
 "'shieldUtilizeActionPaid',false",
 "'activeHandsVerified',false",
 "'focusBonusApplied',false",
 "'combatConsumerEnforced',false",
 "revoke all on function private.encounter_hand_rules_constraints_shadow_v1",
 "to service_role",
]) assert.ok(sql.includes(m),"Missing exact catalogue/hand spell gate "+m);
for(const bad of [
 "update public.", "insert into public.", "delete from public.",
 "public.encounter_cast_spell_v", "public.encounter_weapon_attack",
 "public.encounter_spellcasting_profile_v2",
 "update public.encounter_participants",
 "update public.encounter_hand_snapshot_items_shadow_v1",
]) assert.ok(!sql.toLowerCase().includes(bad.toLowerCase()),"Unacceptable mutation or consumer "+bad);
assert.ok(prior.includes("'canonicalActionSpent',false"),"Prior shadow action/economy boundary changed");
for(const marker of [
 "encounter_hand_transition_command_shadow.sql",
 "20261026_08_encounter_hand_rules_constraints_shadow.sql",
 "Exact 2H Greatsword with occupied off-hand was misclassified",
 "Shield incorrectly treated as Attack weapon/free swap",
 "S/M spell cast called allowed/blocked without proof",
 "S-only spell components were lost",
 "Other character spell assignment was trusted",
 "Versatile longsword was misread as mandatory 2H",
 "Animated Shield exception was incorrectly auto-enforced",
 "Unknown custom item gained imagined official property",
 "Invalidated source snapshot still passed rules audit",
 "Rules audit changed tactical spell slots",
 "Rules audit spent canonical attack/bonus/reaction",
]) assert.ok(fixture.includes(marker),"Missing PG16 invariant "+marker);
for(const marker of ["validate_encounter_hand_rules_constraints_shadow.mjs","encounter_hand_rules_constraints_shadow.sql"])assert.ok(wf.includes(marker),"Missing CI stage "+marker);
console.log("Handedness/shield/spell components exact-source diagnostics and isolation checks passed");

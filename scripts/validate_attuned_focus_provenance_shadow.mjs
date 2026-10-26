import assert from "node:assert/strict";
import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8");
const sql=read("sql/20261026_03_attuned_focus_provenance_shadow.sql");
const fixture=read("scripts/fixtures/attuned_focus_provenance_shadow.sql");
const wf=read(".github/workflows/validate-attuned-focus-provenance-shadow.yml");
const prior=read("sql/20261026_02_attuned_spell_execution_preflight_shadow.sql");
const gate=read("sql/20261025_04_character_effect_source_gate_shadow.sql");
for(const token of [
  "private.encounter_attuned_focus_provenance_shadow_v1",
  "private.encounter_attuned_spell_execution_preflight_shadow_v1(",
  "private.character_magic_effect_source_gate_shadow_v1(",
  "v_item.equip_slot",
  "v_assignment.source_type",
  "v_assignment.source_label",
  "public.character_progression cp",
  "public.class_catalog cc",
  "class_label_matches_progression_but_spell_list_unverified",
  "multiclass_or_progression_ambiguous",
  "assignment_class_label_mismatch",
  "hand_slot_candidate_not_active_hold_proof",
  "weapon_slot_does_not_prove_active_hold",
  "wear_slot_candidate_not_worn_proof",
  "slot_not_sufficient_for_required_condition",
  "multiple_selected_focus_sources_no_stacking_rule",
  "multiple_plausible_focus_sources_unresolved",
  "accountScopeAmbiguous",
  "'activeHoldVerified',false",
  "'sourceSpellListMembershipVerified',false",
  "'wornConditionVerified',false",
  "'stackingVerified',false",
  "'focusBonusApplied',false",
  "'consumerEnforced',false",
  "revoke all on function private.encounter_attuned_focus_provenance_shadow_v1",
  "to service_role"
]) assert.ok(sql.includes(token),"Focus provenance proof contract missing: "+token);
const lowered=sql.toLowerCase();
for(const bad of [
  "update public.", "insert into public.", "delete from public.",
  "public.encounter_spellcasting_profile_v2(",
  "public.encounter_cast_spell_v", "private.sync_character_spell_slots_v1(",
  "create or replace function public."
]) assert.ok(!lowered.includes(bad),"Focus source audit must not write/cast/sync: "+bad);
for(const token of [
  "character_magic_effect_source_gate_shadow_v1",
  "claimedByAnotherCharacter",
  "accountScopeAmbiguous"
]) assert.ok(gate.includes(token),"Trusted character source gate changed: "+token);
assert.ok(prior.includes("'appliedToPreflight',false"));
for(const token of [
  "attuned_tactical_spell_execution_preflight_shadow.sql",
  "20261026_03_attuned_focus_provenance_shadow.sql",
  "Main-hand Rod equated to actively held proof",
  "Neck Amulet equated to verified worn effect",
  "Weapon_1 Rod was misclassified",
  "Backpack Wand falsely counted",
  "Item-provided spell borrowed Warlock class provenance",
  "Forged class label not flagged",
  "Wizard Grimoire matching progression was overstated",
  "Provenance shadow changed encounter spell slots",
]) assert.ok(fixture.includes(token),"Isolated provenance regression missing: "+token);
for(const token of [
  "validate_attuned_tactical_spell_execution_preflight.mjs",
  "validate_attuned_focus_provenance_shadow.mjs",
  "attuned_focus_provenance_shadow.sql"
]) assert.ok(wf.includes(token),"Focus provenance workflow missing "+token);
console.log("Focus origin, slot signals, non-stacking and unchanged casting authority source contracts passed.");

import assert from "node:assert/strict";
import fs from "node:fs";
const read=(path)=>fs.readFileSync(path,"utf8");
const shadow=read("sql/20261026_02_attuned_spell_execution_preflight_shadow.sql");
const fixture=read("scripts/fixtures/attuned_tactical_spell_execution_preflight_shadow.sql");
const combat=read("pages/encounters/combat.js");
const casting=read("sql/20260728_01_tactical_toll_the_dead.sql");
const attack=read("sql/20260729_04_tactical_guiding_bolt.sql");
const bridge=read("sql/20260802_05_tactical_character_resource_bridge_profile.sql");
const workflow=read(".github/workflows/validate-attuned-tactical-spell-execution-preflight.yml");

for(const token of [
 "private.encounter_attuned_spell_execution_preflight_shadow_v1",
 "private.encounter_attuned_spellcasting_shadow_v1(p_participant_id)",
 "private.character_attuned_ability_shadow_v1(v_participant.character_id)",
 "private.encounter_ability_score_v1(v_participant.character_id,v_casting)",
 "where id=p_assignment_id and character_id=v_participant.character_id",
 "coalesce(v_assignment.attack_bonus_override,v_base_mod+v_prof)",
 "coalesce(v_assignment.save_dc_override,8+v_base_mod+v_prof)",
 "coalesce(v_assignment.attack_bonus_override,v_next_mod+v_prof)",
 "coalesce(v_assignment.save_dc_override,8+v_next_mod+v_prof)",
 "warlock_spell_candidate_requires_held_proof",
 "spell_class_attribution_unverified",
 "wizard_spell_candidate_requires_held_proof",
 "spell_attack_candidate_requires_held_proof",
 "spell_has_no_attack_roll",
 "spell_candidate_requires_worn_proof",
 "'heldOrWornConfirmed',false",
 "'sourceSpellClassVerified',false",
 "'stackingVerified',false",
 "'focusApplied',false",
 "'writerExecuted',false",
 "'executionParityReady',false",
 "'consumerEnforced',false",
 "revoke all on function private.encounter_attuned_spell_execution_preflight_shadow_v1",
 "to service_role",
]) assert.ok(shadow.includes(token),"Spell execution preflight contract missing: "+token);

const lower=shadow.toLowerCase();
for(const forbidden of [
  "update public.", "insert into public.", "delete from public.",
  "perform public.encounter_cast_spell_",
  "public.encounter_spellcasting_profile_v2(",
  "private.sync_character_spell_slots_v1(",
  "create or replace function public.encounter_cast_spell",
]) assert.ok(!lower.includes(forbidden),"Read-only spell execution preflight must not write/cast/sync: "+forbidden);

// Check actual character sheet + encounter writer source paths rather than
// assuming the aggregate profile DC is what every spell execution uses.
for(const token of [
  "v_casting_score:=private.encounter_ability_score_v1",
  "v_save_dc:=coalesce(v_assignment.save_dc_override",
]) assert.ok(casting.includes(token),"Original save spell still needs source-specific parity: "+token);
for(const token of [
  "v_casting_score:=private.encounter_ability_score_v1",
  "v_attack_bonus:=coalesce(v_assignment.attack_bonus_override",
]) assert.ok(attack.includes(token),"Original attack spell still needs source-specific parity: "+token);
for(const token of [
  'key === "healing-word|xphb"',
  '"encounter_cast_spell_v13"',
  '"encounter_cast_spell_v12"',
  '"encounter_cast_spell_v11"',
  '"encounter_cast_spell_v10"',
  '"encounter_cast_spell_v3"',
  '"encounter_cast_spell_v2"',
  '"encounter_cast_spell_v1"',
]) assert.ok(combat.includes(token),"Active UI casting RPC routing changed: "+token);
assert.ok(bridge.includes("private.sync_character_spell_slots_v1"),
 "Profile v2 resource synchronization must be isolated from diagnostic preflight");

for(const token of [
  "attuned_tactical_spellcasting_shadow.sql",
  "Warlock-only Rod misclassified",
  "Wand bonus erroneously eligible for save-only spell",
  "Selected CHA shadow or unverified focus stacking mismatch",
  "Per-spell explicit overrides were overwritten",
  "Item-provided spell borrowed Warlock-only rod effect",
  "Wizard-only Grimoire was wrongly applied",
  "Other character spell assignment was accepted",
  "Read-only spell preflight mutated encounter spell slot snapshots",
]) assert.ok(fixture.includes(token),"Isolated preflight fixture missing: "+token);
for(const token of [
  "validate_attuned_tactical_spellcasting_shadow.mjs",
  "validate_attuned_tactical_spell_execution_preflight.mjs",
  "attuned_tactical_spell_execution_preflight_shadow.sql",
]) assert.ok(workflow.includes(token),"PR workflow missing verification: "+token);

console.log("Spell execution preflight is service-only/read-only and source-gated; active UI routing, per-spell override math and v2 resource sync boundary checked.");

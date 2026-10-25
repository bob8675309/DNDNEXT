import assert from "node:assert/strict";
import fs from "node:fs";
const read = (path) => fs.readFileSync(path,"utf8");
const legacy = read("sql/20260801_03_shared_equipment_effects_pipeline.sql");
const prior = read("sql/20261025_06_character_attuned_ac_saves_shadow.sql");
const source = read("sql/20261025_07_character_attuned_ability_shadow.sql");
const fixture = read("scripts/fixtures/character_attuned_ability_shadow.sql");
const workflow = read(".github/workflows/validate-character-attuned-ability-shadow.yml");
for (const k of [
  "private.character_attuned_ability_shadow_v1",
  "private.character_attuned_ac_saves_shadow_v1(p_character_id)",
  "v_gate->'items'",
  "v_modifiers->'abilities'",
  "v_modifiers->'abilityScores'",
  "v_modifiers->'abilityMods'",
  "v_modifiers->'abilityModifiers'",
  "v_catalog,'{}'::jsonb) || coalesce(v_item.card_payload",
  "'{scoreBonus}'",
  "'{effectiveScore}'",
  "'{modBonus}'",
  "'{effectiveMod}'",
  "greatest(1,least(30,v_base+v_score_bonus))",
  "floor((v_score-10)/2.0)",
  "v_category='medium'",
  "v_category='light'",
  "v_category='heavy'",
  "v_ac_unresolved_reason:='manual_sheet_ac_override'",
  "v_new_applied-v_old_applied",
  "'acDexRecalculationComplete'",
  "'fullEffectConsumerParityReady',false",
  "'consumerEnforced',false",
  "revoke all on function private.character_attuned_ability_shadow_v1",
]) assert.ok(source.includes(k), "Indirect ability contract missing: "+k);
for (const forbidden of [
  "update public.characters",
  "update public.inventory_items",
  "update public.character_sheets",
  "update public.encounter_participants",
  "create or replace function private.character_equipment_effects_v1",
  "create or replace function public.encounter_canonical_combat_snapshot_v1",
]) assert.ok(!source.toLowerCase().includes(forbidden),"Shadow incorrectly mutates live authority: "+forbidden);
for(const k of ["v_score_bonuses := jsonb_set(","v_mod_bonuses := jsonb_set(",
  "v_dex_applied := case v_armor_category",
  "greatest(1,least(30,",
]) assert.ok(legacy.includes(k),"Legacy ability/armor algorithm changed or unverified: "+k);
assert.ok(prior.includes("private.character_attuned_ac_saves_shadow_v1"),"Prerequisite direct shadow missing");
for(const k of [
  "character_attuned_ac_saves_shadow.sql",
  "character_attuned_ability_shadow.sql",
  "Medium armor DEX cap",
  "Light armor DEX decrease",
  "Manual sheet AC",
  "Unverified abilities bypassed",
  "exact baseline",
]) assert.ok(fixture.includes(k), "Missing disposable parity scenario: "+k);
for(const k of ["validate_shared_equipment_effects_pipeline.mjs",
 "validate_attuned_ac_saves_shadow.mjs","validate_attuned_ability_shadow.mjs",
 "character_attuned_ability_shadow.sql"]) assert.ok(workflow.includes(k),"CI chain missing: "+k);
console.log("Trusted source-derived ability score/modifier shadow preserves physical armor and original numeric authority.");

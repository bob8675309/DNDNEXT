import assert from "node:assert/strict";
import fs from "node:fs";
const read=(path)=>fs.readFileSync(path,"utf8");
const legacy=read("sql/20260727_12_tactical_spell_foundation.sql");
const copy=read("scripts/fixtures/legacy_tactical_spellcasting_profile_v1.sql");
const shadow=read("sql/20261026_01_attuned_tactical_spellcasting_shadow.sql");
const fixture=read("scripts/fixtures/attuned_tactical_spellcasting_shadow.sql");
const workflow=read(".github/workflows/validate-attuned-tactical-spellcasting-shadow.yml");

const abilityStart=legacy.indexOf("create or replace function private.encounter_ability_score_v1(");
const abilityEnd=legacy.indexOf("create or replace function private.initialize_encounter_spell_slots_v1(",abilityStart);
const profileStart=legacy.indexOf("create or replace function public.encounter_spellcasting_profile_v1(");
const profileEnd=legacy.indexOf("\ndo $postconditions$",profileStart);
assert.ok(abilityStart>=0&&abilityEnd>abilityStart&&profileStart>=0&&profileEnd>profileStart);
assert.ok(copy.includes(legacy.slice(abilityStart,abilityEnd).trim()),
  "Fixture ability score helper drifted from source-controlled canonical SQL");
assert.ok(copy.includes(legacy.slice(profileStart,profileEnd).trim()),
  "Fixture spellcasting profile drifted from source-controlled canonical SQL");
for(const marker of [
  "private.encounter_attuned_spellcasting_shadow_v1",
  "public.encounter_spellcasting_profile_v1(p_participant_id)",
  "private.character_attuned_ability_shadow_v1(v_participant.character_id)",
  "private.character_magic_effect_source_gate_shadow_v1(v_participant.character_id)",
  "v_ability_result#>>array['shadow','abilities',v_casting,'effectiveMod']",
  "v_ability_result#>>array['shadow','abilities',v_casting,'effectiveScore']",
  "'{spellAttackBonus}'",
  "'{spellSaveDc}'",
  "v_candidate->'slotSnapshot' is not distinct from v_original->'slotSnapshot'",
  "v_candidate->'knownSpells' is not distinct from v_original->'knownSpells'",
  "per_spell_override_origins_unverified",
  "focus_class_spell_applicability_and_stacking_unverified",
  "bonusSpellAttack",
  "bonusSpellSaveDc",
  "'appliedToShadow',false",
  "'consumerEnforced',false",
  "'tacticalSpellParityReady',false",
  "'focusBonusApplicabilityVerified',false",
  "revoke all on function private.encounter_attuned_spellcasting_shadow_v1",
  "to service_role"
]) assert.ok(shadow.includes(marker),"Tactical spell source/effect guard missing: "+marker);
for(const forbidden of [
  "update public.encounter_spell_slots",
  "insert into public.encounter_spell_slots",
  "update public.encounter_participants",
  "update public.character_spells",
  "create or replace function public.encounter_spellcasting_profile_v1",
  "create or replace function public.encounter_cast_spell_"
]) assert.ok(!shadow.toLowerCase().includes(forbidden),"Shadow changed authoritative spell consumer: "+forbidden);
for(const marker of [
 "attuned_weapon_profile_shadow.sql",
 "legacy_tactical_spellcasting_profile_v1.sql",
 "20261026_01_attuned_tactical_spellcasting_shadow.sql",
 "+1 Rod of the Pact Keeper|XDMG",
 "+1 Wand of the War Mage|XDMG",
 "Tactical spell OFF original profile or slot parity failed",
 "ON without chosen focus/ability changed tactical spell state",
 "Chosen Staff CHA ability source or slot snapshot mismatch",
 "Two selected focus bonuses wrongly stacked",
 "Shared account focus source leaked",
 "Unauthorized tactical profile read",
 "OFF after ON changed canonical tactical spell/slot output"
]) assert.ok(fixture.includes(marker),"Tactical spell fixture missing: "+marker);
for(const marker of [
 "validate_player_sheet_actions.mjs",
 "validate_attuned_player_sheet_spells_shadow.mjs",
 "validate_attuned_tactical_spellcasting_shadow.mjs",
 "attuned_tactical_spellcasting_shadow.sql"
]) assert.ok(workflow.includes(marker),"Tactical spell exact-head workflow missing: "+marker);
console.log("Exact canonical tactical spell profile and inert eligible-casting/focus-audit shadow source contracts passed.");

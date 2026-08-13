import fs from "node:fs";

const migration = fs.readFileSync("sql/20260808_44_wizard_spell_mastery_runtime.sql", "utf8");
const helperRepair = fs.readFileSync("sql/20260809_76_wizard_runtime_helper_repair.sql", "utf8");
const tracker = fs.readFileSync("components/CharacterSheetResourceTracker.js", "utf8");
const classExtensions = fs.readFileSync("utils/classFeatureChoiceExtensions.js", "utf8");
const classChoices = fs.readFileSync("utils/classFeatureChoices.js", "utf8");
const rest = fs.readFileSync("sql/20260802_03_character_sheet_spell_resources.sql", "utf8");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`);
};

for (const token of [
  "create table if not exists private.character_spell_mastery",
  "level1_spell_id uuid not null",
  "level2_spell_id uuid not null",
  "wizard_spell_mastery_candidate_v1",
  "s.level=p_expected_level",
  "in ('action','1 action')",
  "lower(c)='wizard'",
  "private.wizard_spellbook_has_spell_v1",
  "apply_wizard_spell_mastery_overlay_v1",
  "clear_wizard_spell_mastery_overlay_v1",
  "'spellMastery',true",
  "'spellMasteryPriorPrepared',cs.prepared",
  "'spellMasteryPriorAlwaysAvailable',cs.always_available",
  "prepared=coalesce((cs.raw_payload->>'spellMasteryPriorPrepared')::boolean,false)",
  "always_available=coalesce((cs.raw_payload->>'spellMasteryPriorAlwaysAvailable')::boolean,false)",
  "if v_mastery.character_id is not null then",
  "v_progression.class_level<18",
  "rest_type='long_rest'",
  "v_latest_long_rest>v_unlock_after",
  "configure_character_spell_mastery_v1",
  "private.can_manage_character_spell_resources_v1",
  "private.character_active_encounter_v1",
  "v_change_count>1",
  "Finish a new Long Rest before replacing a Spell Mastery selection.",
  "character_sheet_resource_profile_v2",
  "'spellMastery',v_mastery",
]) need(migration, token);

for (const token of [
  "create or replace function private.can_manage_character_spell_resources_v1",
  "select private.can_manage_character_progression_v1(p_character_id)",
  "revoke all on function private.can_manage_character_spell_resources_v1(uuid) from public,anon,authenticated",
]) need(helperRepair, token, "shared spell-resource authorization repair");

forbid(migration, "insert into public.character_spells", "duplicate Spell Mastery spellbook membership insertion");
forbid(migration, "uses_max=", "finite Spell Mastery at-will use counter");
forbid(migration, "uses_remaining=", "finite Spell Mastery at-will use counter");

for (const token of [
  'configure_character_spell_mastery_v1',
  'spellMastery?.eligible',
  'spellMastery?.replacementAvailable',
  'Spell Mastery • at will',
  'Level 1 mastered spell',
  'Level 2 mastered spell',
  'Replace Mastered Spell',
  'Set Spell Mastery',
  'masteryChangeCount === 1',
  'profile?.restResult',
  'reloadResourceProfile(profile.restResult)',
  'table: "character_spells"',
]) need(tracker, token);

forbid(classExtensions, 'id: "wizard-spell-mastery"', "permanent Forge Spell Mastery group");
forbid(classExtensions, 'label: "Spell Mastery"', "explicit permanent Forge Spell Mastery group");
need(classChoices, '.filter((group) => group.cadence === "creation"', "creation-only permanent class-choice output");

for (const token of [
  "v_rest_type not in ('short_rest','long_rest')",
  "insert into public.character_rest_log",
  "rest_type='long_rest'",
]) need(rest, token);

console.log("Wizard Spell Mastery runtime eligibility, shared authorization dependency, at-will overlay, Long-Rest one-spell replacement, encounter lock, sheet UI, and non-Forge cadence contracts validated.");

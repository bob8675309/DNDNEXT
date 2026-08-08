import fs from "node:fs";

const choices = fs.readFileSync("utils/classFeatureChoices.js", "utf8");
const migration = fs.readFileSync("sql/20260808_41_player_forge_wizard_savant_materialization.sql", "utf8");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`);
};

need(choices, "function expandWizardSavantGroups", "Forge Savant cumulative expander");
need(choices, "const maximumLevel = Math.max(2, Math.min(9, Math.ceil(Number(level || 1) / 2)))", "Wizard starting-level Savant cumulative count");
need(choices, "count: maximumLevel", "cumulative Savant selection count");
need(choices, "Choose the two spells granted at level 3 plus one additional spell for each higher spell-slot level this starting Wizard has reached.", "Savant chronology helper text");

for (const token of [
  "player_forge_wizard_savant_expected_count_v1",
  "materialize_player_forge_wizard_savant_v1",
  "shared_character_forge_player_v2",
  "wizard_savant_school_v1(new.subclass_name)",
  "v_expected:=private.player_forge_wizard_savant_expected_count_v1",
  "jsonb_array_length(v_selected)<>v_expected",
  "spells_catalog_preferred",
  "v_spell.school<>v_school",
  "v_cantrip_count>2",
  "v_slot_cap:=case when v_slot<=2 then 2 else v_slot end",
  "v_slot>2 and coalesce((v_choice->>'level')::integer,0)<1",
  "v_granted_level:=case when v_slot<=2 then 3 else (v_slot*2)-1 end",
  "wizard_spellbook_has_spell_v1",
  "'class-feature',v_source_key,v_feature_name",
  "'wizardSpellbook',true",
  "'prepared,always_available,casting_stat,raw_payload'",
  "character_progression_materialize_player_forge_wizard_savant_v1",
  "deferrable initially deferred",
]) need(migration, token);

forbid(migration, "'class',v_source_key,v_feature_name", "Savant stored as ordinary base-Wizard rows");
forbid(migration, "update public.character_sheets set sheet", "Forge Savant materializer rewriting the validated sheet projection");

console.log("Higher-level Player Forge Wizard Savant chronology and spellbook materialization contract validated.");

import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("sql/20260808_52_astral_trance_runtime.sql");
const panel = read("components/CharacterAstralTrancePanel.js");
const sheetPanel = read("components/CharacterSheetPanel.js");
const runtime = read("utils/characterRuntimeProficiencies.js");
const actions = read("utils/characterSheetActions.js");
const forgeCore = read("components/NpcForgeCoreSupport.js");
const forgeController = read("components/useNpcForgeController.js");
const forgeDerived = read("components/useNpcForgeDerivedModel.js");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing Astral Trance contract ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden Astral Trance contract ${label}: ${token}`);
};

for (const token of [
  "'astral-trance'",
  "'Astral Trance'",
  "'AAG'",
  "'long_rest'",
  "character_has_astral_trance_v1",
  "astral_trance_skill_options_v1",
  "astral_trance_training_options_v1",
  "lower(i.item_name) not in ('musket','pistol')",
  "clear_astral_trance_runtime_projection_v1",
  "new.rest_type='long_rest'",
  "after insert on public.character_rest_log",
  "character_rest_expire_astral_trance_v1",
  "get_character_astral_trance_v1",
  "configure_character_astral_trance_v1",
  "Finish a Long Rest before choosing Astral Trance proficiencies.",
  "Astral Trance proficiencies are already chosen for the current Long Rest.",
  "'{runtimeProficiencies,astralTrance}'",
  "v_sheet:=v_sheet #- array['runtimeProficiencies','astralTrance']",
  "Both expire at the next Long Rest",
]) need(migration, token);

for (const token of [
  "get_character_astral_trance_v1",
  "configure_character_astral_trance_v1",
  "Long-Rest choice",
  "Finish a Long Rest",
  "Choose for this Long Rest",
  "last until the next Long Rest",
]) need(panel, token);

for (const token of [
  'import CharacterAstralTrancePanel from "./CharacterAstralTrancePanel";',
  'import { projectCharacterSheetRuntimeProficiencies } from "../utils/characterRuntimeProficiencies";',
  "runtimeDisplayDraft",
  "projectCharacterSheetRuntimeProficiencies(draft || {})",
  "sheet={runtimeDisplayDraft}",
  "<CharacterAstralTrancePanel",
]) need(sheetPanel, token);

for (const token of [
  "astralTranceRuntimeState",
  "runtimeProficiency: \"astral-trance\"",
  "projectCharacterSheetRuntimeProficiencies",
  "hasRuntimeWeaponProficiency",
  "state.trainingKind !== \"weapon\"",
]) need(runtime, token);

for (const token of [
  'import { hasRuntimeWeaponProficiency } from "./characterRuntimeProficiencies";',
  "if (hasRuntimeWeaponProficiency(sheet, name)) return true;",
]) need(actions, token);

// Astral Trance is explicitly runtime-only: do not add it to Forge choice state.
for (const source of [forgeCore, forgeController, forgeDerived]) {
  forbid(source, "astralTrance", "Forge Astral Trance state");
  forbid(source, "Astral Trance", "Forge Astral Trance choice");
}
forbid(migration, "speciesTraitChoices", "permanent species-choice mutation");
forbid(migration, "speciesChoiceFeats", "permanent species-choice mutation");
forbid(migration, "classFeatureChoices", "permanent class-choice mutation");
forbid(migration, "update public.players", "account-wide sheet projection");

for (const source of [migration, panel, sheetPanel, runtime, actions]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "weather"]) {
    forbid(source, token, `protected world boundary ${token}`);
  }
}

console.log("Astral Trance source eligibility, Long-Rest expiry/configuration, non-destructive skill/weapon overlays, runtime UI, Forge exclusion, firearm exclusion, and protected boundaries validated.");

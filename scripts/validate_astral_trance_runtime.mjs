import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("sql/20260808_52_astral_trance_runtime.sql");
const skillCorrection = read("sql/20260808_53_astral_trance_skill_key_correction.sql");
const speciesCorrection = read("sql/20260808_54_astral_trance_species_key_correction.sql");
const panel = read("components/CharacterAstralTrancePanel.js");
const restSyncBridge = read("components/CharacterSheetRestSyncBridge.js");
const sheetPanel = read("components/CharacterSheetPanel.js");
const runtime = read("utils/characterRuntimeProficiencies.js");
const actions = read("utils/characterSheetActions.js");
const forgeCore = read("components/NpcForgeCoreSupport.js");
const forgeController = read("components/useNpcForgeController.js");
const forgeDerived = read("components/useNpcForgeDerivedModel.js");
const forgeSpeciesRuntime = read("utils/playerForgeSpeciesRuntimeChoices.js");

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
  "create or replace function private.astral_trance_skill_key_v1",
  "when 'animalhandling' then 'animalHandling'",
  "when 'sleightofhand' then 'sleightOfHand'",
]) need(skillCorrection, token);

for (const token of [
  "create or replace function private.character_has_astral_trance_v1",
  "v_species='astralelf'",
  "v_source='AAG'",
]) need(speciesCorrection, token);

for (const token of [
  "get_character_astral_trance_v1",
  "configure_character_astral_trance_v1",
  "Long-Rest choice",
  "Finish a Long Rest",
  "Choose for this Long Rest",
  "last until the next Long Rest",
  'import CharacterSheetRestSyncBridge from "./CharacterSheetRestSyncBridge";',
  "<CharacterSheetRestSyncBridge characterId={characterId} onSheetUpdated={onSheetUpdated} />",
]) need(panel, token);

for (const token of [
  '[aria-label="Spell resources and rests"]',
  'label === "Short Rest" || label === "Long Rest"',
  "[200, 650, 1300, 2400]",
  'from("character_sheets")',
  'select("sheet,updated_at")',
  "onSheetUpdatedRef.current?.(data.sheet)",
]) need(restSyncBridge, token);
for (const token of ["setInterval", "postgres_changes"]) forbid(restSyncBridge, token, `bounded Rest sync ${token}`);

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
  'applyRuntimeSkill(next, astral.skillKey, "astral-trance")',
  "runtimeProficiency: marker",
  "projectCharacterSheetRuntimeProficiencies",
  "hasRuntimeWeaponProficiency",
  'trainingMatches(astralTranceRuntimeState(sheet), "weapon", weaponName)',
]) need(runtime, token);

for (const token of [
  'import { hasRuntimeWeaponProficiency } from "./characterRuntimeProficiencies.js";',
  "if (hasRuntimeWeaponProficiency(sheet, name)) return true;",
]) need(actions, token);

for (const source of [forgeCore, forgeController, forgeDerived]) {
  forbid(source, "astralTrance", "Forge Astral Trance state");
  forbid(source, "Astral Trance", "Forge Astral Trance choice");
}
for (const token of [
  'identity.name === "astral elf"',
  'identity.source === "AAG"',
  'trait === "astral trance"',
  "return false",
]) need(forgeSpeciesRuntime, token, `generic Forge exclusion ${token}`);
forbid(migration, "speciesTraitChoices", "permanent species-choice mutation");
forbid(migration, "speciesChoiceFeats", "permanent species-choice mutation");
forbid(migration, "classFeatureChoices", "permanent class-choice mutation");
forbid(migration, "update public.players", "account-wide sheet projection");

for (const source of [migration, skillCorrection, speciesCorrection, panel, restSyncBridge, sheetPanel, runtime, actions, forgeSpeciesRuntime]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "weather"]) {
    forbid(source, token, `protected world boundary ${token}`);
  }
}

console.log("Astral Trance source eligibility, complete skill mapping, compact Astral Elf identity, Long-Rest expiry/configuration, runtime-only Forge exclusion, bounded post-Rest sheet sync, non-destructive additive skill/weapon overlays, firearm exclusion, and protected boundaries validated.");

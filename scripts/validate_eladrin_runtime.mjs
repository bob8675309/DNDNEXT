import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const need = (source, token, label = token) => { if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`); };
const forbid = (source, token, label = token) => { if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`); };

const migration = read("sql/20260809_68_eladrin_season_trance_runtime.sql");
const forge = read("utils/playerForgeSpeciesRuntimeChoices.js");
const panel = read("components/CharacterEladrinRuntimePanel.js");
const host = read("components/CharacterSpeciesReplaceableCantripPanel.js");
const runtime = read("utils/characterRuntimeProficiencies.js");

for (const token of [
  "'Eladrin','MPMM'",
  "'eladrin-season'",
  "'eladrin-trance-training'",
  "'autumn'",
  "'winter'",
  "'spring'",
  "'summer'",
  "'long_rest'",
  "private.species_runtime_latest_long_rest_v1",
  "private.species_runtime_active_encounter_v1",
  "private.astral_trance_training_options_v1()",
  "Choose two different Eladrin Trance proficiencies.",
  "Finish a Long Rest before configuring Eladrin Trance proficiencies.",
  "Finish a newer Long Rest before changing Eladrin Season.",
  "character_progression_materialize_eladrin_season_v1",
  "character_rest_log_expire_eladrin_trance_v1",
  "coalesce(jsonb_typeof(v_sheet->'runtimeFeatures'),'')<>'object'",
  "coalesce(jsonb_typeof(v_sheet->'runtimeProficiencies'),'')<>'object'",
  "revoke all on function public.get_character_eladrin_season_v1(uuid) from public,anon",
  "revoke all on function public.configure_character_eladrin_trance_v1(uuid,uuid,uuid) from public,anon",
  "grant execute on function public.get_character_eladrin_season_v1(uuid) to authenticated,service_role",
  "grant execute on function public.configure_character_eladrin_trance_v1(uuid,uuid,uuid) to authenticated,service_role",
]) need(migration, token);
for (const token of ["rest_type='long'", "'Eladrin','XPHB'", "source_type='class'"]) forbid(migration, token);

for (const token of [
  'identity.name === "eladrin" && identity.source === "MPMM"',
  'id: "species-runtime-eladrin-season"',
  'ownerKey: "eladrin-season"',
  'label: "Eladrin Season"',
  'replacementCadence: "long-rest"',
  'feyStepLevel: 3',
]) need(forge, token);
forbid(forge, "eladrin-trance-training", "Eladrin Trance incorrectly added as creation-time Forge choice");

for (const token of [
  "get_character_eladrin_season_v1",
  "configure_character_eladrin_season_v1",
  "get_character_eladrin_trance_v1",
  "configure_character_eladrin_trance_v1",
  "Current season",
  "Weapon or tool 1",
  "Weapon or tool 2",
  "firstTraining === secondTraining",
]) need(panel, token);

need(host, 'import CharacterEladrinRuntimePanel from "./CharacterEladrinRuntimePanel";', "Eladrin runtime panel import");
need(host, "const eladrinPanel = <CharacterEladrinRuntimePanel", "Eladrin downstream composition");
need(host, "return eladrinPanel;", "Eladrin reachability when cantrip family is absent");

for (const token of [
  "eladrinTranceRuntimeState",
  'sheet?.runtimeProficiencies?.eladrinTrance',
  "trainings.length !== 2",
  "eladrinTrainingMatches",
  'eladrinTrainingMatches(sheet, "weapon", weaponName)',
  'eladrinTrainingMatches(sheet, "tool", toolName)',
]) need(runtime, token);

for (const source of [migration, forge, panel, host, runtime]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "weather"]) forbid(source, token, `protected world boundary ${token}`);
}

console.log("Eladrin initial/replacement season authority, post-Long-Rest two-choice Trance training, additive weapon/tool projection, downstream runtime reachability, explicit ACLs, and protected boundaries validated.");

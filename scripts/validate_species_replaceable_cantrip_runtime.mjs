import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const need = (source, token, label = token) => { if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`); };
const forbid = (source, token, label = token) => { if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`); };

const migration = read("sql/20260809_67_species_replaceable_cantrip_runtime.sql");
const panel = read("components/CharacterSpeciesReplaceableCantripPanel.js");
const host = read("components/CharacterSpeciesRestProficiencyPanel.js");
const speciesChoices = read("utils/playerForgeSpeciesChoices.js");

for (const token of [
  "'Khoravar','EFA'",
  "'Elf','XPHB'",
  "'high-elf-lineage-cantrip'",
  "'khoravar-fey-gift-cantrip'",
  "'Prestidigitation'",
  "'Friends'",
  "jsonb_build_array('Wizard')",
  "jsonb_build_array('Cleric','Druid','Wizard')",
  "source_type='species'",
  "'species',v_feature_key",
  "'long_rest'",
  "private.species_runtime_latest_long_rest_v1",
  "private.character_active_encounter_v1",
  "character_progression_materialize_species_cantrip_v1",
  "shared_character_forge_player_v2",
  "source-fixed initial Species cantrip has not been materialized",
  "Finish a newer Long Rest before replacing this Species cantrip.",
  "Choose a different cantrip from the current Species cantrip.",
  "coalesce(jsonb_typeof(v_sheet->'runtimeFeatures'),'')<>'object'",
  "revoke all on function public.get_character_species_replaceable_cantrip_v1(uuid) from public,anon",
  "revoke all on function public.configure_character_species_replaceable_cantrip_v1(uuid,uuid) from public,anon",
  "grant execute on function public.get_character_species_replaceable_cantrip_v1(uuid) to authenticated,service_role",
  "grant execute on function public.configure_character_species_replaceable_cantrip_v1(uuid,uuid) to authenticated,service_role",
]) need(migration, token);

for (const token of ["rest_type='long'", "'Khoravar','MPMM'", "source_type='class'"]) forbid(migration, token);

for (const token of [
  "get_character_species_replaceable_cantrip_v1",
  "configure_character_species_replaceable_cantrip_v1",
  "Long-Rest replacement",
  "Replacement cantrip",
  "Spellcasting ability",
  "replacementOptions",
]) need(panel, token);

need(host, 'import CharacterSpeciesReplaceableCantripPanel from "./CharacterSpeciesReplaceableCantripPanel";', "Species cantrip panel import");
need(host, "const cantripPanel = <CharacterSpeciesReplaceableCantripPanel", "Species cantrip downstream composition");
need(host, "if (!mode || (!loading && !profile && !error)) return cantripPanel;", "downstream reachability when proficiency family is absent");

// The permanent High Elf/Khoravar spellcasting-ability fields remain in the generic Species source-choice builder.
need(speciesChoices, "spellcasting-ability", "High Elf permanent lineage casting ability");
need(speciesChoices, "feature-ability", "Khoravar permanent feature casting ability");
forbid(speciesChoices, "replaceable-cantrip", "runtime cantrip accidentally added as permanent Forge selection");

for (const source of [migration, panel, host]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "weather"]) forbid(source, token, `protected world boundary ${token}`);
}

console.log("Species fixed-initial/Long-Rest-replaceable cantrip authority, permanent casting-ability separation, downstream runtime UI, explicit ACLs, and protected boundaries validated.");

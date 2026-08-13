import fs from "node:fs";

const migration = fs.readFileSync("sql/20260809_69_boon_energy_resistance_runtime.sql", "utf8");
const provenance = fs.readFileSync("sql/20260809_70_boon_energy_resistance_provenance_fix.sql", "utf8");
const normalize = fs.readFileSync("utils/featSourceChoiceNormalization.js", "utf8");
const panel = fs.readFileSync("components/CharacterBoonEnergyResistancePanel.js", "utf8");
const currency = fs.readFileSync("components/CharacterCurrencyBadge.js", "utf8");

const need = (source, token) => { if (!source.includes(token)) throw new Error(`Missing Boon Energy Resistance contract: ${token}`); };
const forbid = (source, token) => { if (source.includes(token)) throw new Error(`Forbidden Boon Energy Resistance crossover: ${token}`); };

for (const token of [
  'featName === "boon of energy resistance"',
  'id: "energy-resistances"',
  'kind: "energy-resistance"',
  'count: 2',
  'replacementCadence: "long_rest"',
  'runtimeFeature: "boon-energy-resistance"',
  '"Acid"', '"Cold"', '"Fire"', '"Lightning"', '"Necrotic"', '"Poison"', '"Psychic"', '"Radiant"', '"Thunder"',
]) need(normalize, token);

for (const token of [
  "boon_energy_resistance_feature_key_v1",
  "boon_energy_resistance_options_v1",
  "boon_energy_resistance_choices_v1",
  "validate_boon_energy_resistance_pair_v1",
  "character_option_grant_instance_boon_energy_resistance_v1",
  "after insert on public.character_option_grant_instances",
  "character_runtime_feature_choices",
  "feature_key like 'boon-energy-resistance:%'",
  "rest_type='long_rest'",
  "get_character_boon_energy_resistance_v1",
  "configure_character_boon_energy_resistance_v1",
  "character_active_encounter_v1",
  "runtimeFeatures,boonEnergyResistance",
  "character_runtime_damage_resistances_v1",
  "revoke all on function public.get_character_boon_energy_resistance_v1(uuid) from public,anon",
  "revoke all on function public.configure_character_boon_energy_resistance_v1(uuid,text,text[]) from public,anon",
]) need(migration, token);

for (const token of [
  "v_had_runtime boolean:=false",
  "v_had_runtime:=found and jsonb_typeof(v_runtime.state->'resistances')='array'",
  "case when v_had_runtime then 'long_rest_replacement' else 'legacy_initial_configuration' end",
  "case when v_had_runtime then coalesce(v_runtime.state->'resistances','[]'::jsonb) else '[]'::jsonb end",
  "revoke all on function public.configure_character_boon_energy_resistance_v1(uuid,text,text[]) from public,anon",
]) need(provenance, token);

for (const token of [
  'get_character_boon_energy_resistance_v1',
  'configure_character_boon_energy_resistance_v1',
  'Choose two different Energy Resistances.',
  'Replace Resistances',
]) need(panel, token);

for (const token of [
  'import CharacterBoonEnergyResistancePanel from "./CharacterBoonEnergyResistancePanel";',
  '<CharacterBoonEnergyResistancePanel characterId={characterId} />',
  'if (!characterId) return null;',
]) need(currency, token);

for (const source of [migration, provenance, normalize, panel, currency]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "player_wallets"]) forbid(source, token);
}
for (const source of [migration, provenance]) {
  for (const token of ["insert into public.inventory_items", "update public.encounter_participants", "insert into public.encounter_participants"]) forbid(source, token);
}

console.log("Boon of Energy Resistance per-feat-instance acquisition pair, Long-Rest replacement, deterministic provenance, runtime projection, ACLs, and protected boundaries validated.");

import fs from "node:fs";

const migration = fs.readFileSync("sql/20260809_78_armorer_armor_model_runtime.sql", "utf8");
const fiendish = fs.readFileSync("sql/20260808_57_fiendish_resilience_runtime.sql", "utf8");
const panel = fs.readFileSync("components/CharacterArmorerArmorModelPanel.js", "utf8");
const host = fs.readFileSync("components/CharacterCurrencyBadge.js", "utf8");
const parser = fs.readFileSync("utils/classFeatureChoiceParsing.js", "utf8");
const choices = fs.readFileSync("utils/classFeatureChoices.js", "utf8");

const need = (source, token, label = token) => { if (!source.includes(token)) throw new Error(`Missing Armor Model contract (${label}): ${token}`); };
const forbid = (source, token, label = token) => { if (source.includes(token)) throw new Error(`Forbidden Armor Model crossover (${label}): ${token}`); };

for (const token of [
  "character_runtime_feature_choices_cadence_chk",
  "'short_or_long_rest'::text",
  "character_has_smiths_tools_v1",
  "public.inventory_items",
  "character_permissions",
  "Smith's Tools",
  "armorer_armor_model_options_v1",
  "jsonb_path_query",
  'refSubclassFeature',
  "subclass_name,''))='armorer'",
  "armorer_armor_model_context_v1",
  "v_progression.subclass_source",
  "v_source<>upper(btrim(coalesce(v_class.source,'')))",
  "lower(f.name)='armor model'",
  "sync_armorer_armor_model_projection_v1",
  "runtimeFeatures,armorerArmorModel",
  "get_character_armorer_armor_model_v1",
  "configure_character_armorer_armor_model_v1",
  "private.can_manage_character_progression_v1",
  "private.character_active_encounter_v1",
  "rest_type in ('short_rest','long_rest')",
  "artificer-armorer-armor-model",
  "'short_or_long_rest'",
  "configuredBy','initial_selection'",
  "configuredBy','rest_replacement'",
  "Finish a newer Short Rest or Long Rest before changing Armor Model.",
  "inventory before configuring Armor Model.",
  "revoke all on function public.get_character_armorer_armor_model_v1(uuid) from public,anon",
  "revoke all on function public.configure_character_armorer_armor_model_v1(uuid,text) from public,anon",
]) need(migration, token);

need(fiendish, "'short_or_long_rest'", "existing Fiendish cadence dependency");
need(fiendish, "configure_character_fiendish_resilience_v1", "existing Fiendish configure RPC");

for (const token of [
  "get_character_armorer_armor_model_v1",
  "configure_character_armorer_armor_model_v1",
  "p_model_key",
  "Armorer runtime",
  "Armor Model",
  "Smith&apos;s Tools",
  "Short Rest or Long Rest",
  "Choose Model",
  "Change Model",
  "selectedKey",
  "selectedOption",
]) need(panel, token);

for (const token of [
  'import CharacterArmorerArmorModelPanel from "./CharacterArmorerArmorModelPanel";',
  '<CharacterArmorerArmorModelPanel characterId={characterId} />',
]) need(host, token);

need(parser, '"armor model"', "rest-configurable Forge suppression");
need(parser, "REST_RECONFIGURABLE_FEATURES", "rest-configurable feature set");
need(parser, 'return "short-rest";', "rest cadence classification");
need(choices, '.filter((group) => group.cadence === "creation"', "creation-only permanent class-choice output");

for (const source of [migration, panel, host]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "player_wallets"]) forbid(source, token);
}
for (const token of [
  "insert into public.inventory_items",
  "update public.inventory_items",
  "delete from public.inventory_items",
  "update public.encounter_participants",
  "insert into public.encounter_participants",
]) forbid(migration, token);

forbid(migration, "values ('dreadnaught'", "hard-coded source option list");
forbid(migration, "values ('guardian'", "hard-coded source option list");

console.log("Armorer Armor Model source-derived EFA/TCE options, immediate initial selection, Smith's Tools possession gate, Short/Long-Rest replacement, shared cadence compatibility, encounter lock, ACLs, Forge suppression, host wiring, and protected boundaries validated.");

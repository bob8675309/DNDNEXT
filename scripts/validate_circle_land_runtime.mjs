import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("sql/20260808_58_circle_land_runtime.sql");
const correction = read("sql/20260808_59_circle_land_source_matrix_correction.sql");
const panel = read("components/CharacterCircleLandPanel.js");
const runtimeHost = read("components/CharacterFiendishResiliencePanel.js");
const forgeCore = read("components/NpcForgeCoreSupport.js");
const forgeController = read("components/useNpcForgeController.js");
const forgeDerived = read("components/useNpcForgeDerivedModel.js");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing Circle of the Land contract ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden Circle of the Land contract ${label}: ${token}`);
};

for (const token of [
  "circle_land_source_table_v1",
  "jsonb_path_query",
  "node ? 'rows'",
  "node ? 'colLabels'",
  "%arid%",
  "%polar%",
  "%temperate%",
  "%tropical%",
  "circle_land_spell_names_from_cell_v1",
  "{@spell",
  "spells_catalog_preferred",
  "circle_land_spell_matrix_v1",
  "character_has_circle_land_spells_v1",
  "lower(f.name)='circle spells'",
  "circle_land_spells_acquired_at_v1",
  "character_level_events",
  "clear_circle_land_runtime_v1",
  "delete from public.character_spells",
  "source_key='circle-of-the-land'",
  "character_rest_expire_circle_land_v1",
  "new.rest_type='long_rest'",
  "get_character_circle_land_v1",
  "configure_character_circle_land_v1",
  "'cadence','long_rest'",
  "v_latest_long_rest>v_acquired_at",
  "Finish a Long Rest after gaining Circle Spells",
  "private.character_active_encounter_v1(p_character_id)",
  "Circle of the Land spells cannot be changed while this character is in an active encounter.",
  "'class-feature','circle-of-the-land','Circle Spells',true,true,true",
  "null,null,null,'wis'",
  "'{runtimeFeatures,circleOfTheLand}'",
]) need(migration, token);

for (const token of [
  "v_land_col integer",
  "Circle Spells source table is missing the % column.",
  "distinct on (spell->>'spellId')",
  "jsonb_agg(d.spell order by d.spell->>'name')",
]) need(correction, token);

// Source matrix must stay source-derived. These are representative remembered
// Circle spell names that must not be baked into the migration source.
for (const token of [
  "Fire Bolt",
  "Burning Hands",
  "Ray of Frost",
  "Misty Step",
  "Web",
  "Fireball",
  "Ice Storm",
  "Wall of Stone",
]) {
  forbid(`${migration}\n${correction}`, token, `hardcoded Circle spell ${token}`);
}

forbid(`${migration}\n${correction}`, "source_type='class'", "ordinary Druid spell-source mutation");
forbid(`${migration}\n${correction}`, "update public.players", "account-wide sheet projection");
forbid(`${migration}\n${correction}`, "encounter_participants", "tactical snapshot mutation");
forbid(`${migration}\n${correction}`, "admin_add_encounter_participant", "combat participant patch");

for (const token of [
  "get_character_circle_land_v1",
  "configure_character_circle_land_v1",
  "Long-Rest choice",
  "Circle Spells",
  "Arid, Polar, Temperate, or Tropical",
  "Choose Land for this Long Rest",
  "package expires",
  "imported XPHB Circle Spells table",
  "always prepared",
]) need(panel, token);

for (const token of [
  'import CharacterCircleLandPanel from "./CharacterCircleLandPanel";',
  "<CharacterCircleLandPanel",
]) need(runtimeHost, token);

for (const source of [forgeCore, forgeController, forgeDerived]) {
  forbid(source, "circleOfTheLand", "Forge Circle of the Land runtime state");
  forbid(source, "Circle Spells", "Forge Circle Spells rest choice");
}

for (const source of [migration, correction, panel, runtimeHost]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "weather"]) {
    forbid(source, token, `protected world boundary ${token}`);
  }
}

console.log("Circle of the Land source-table parsing, four-land Long-Rest cadence, post-acquisition first rest, automatic prior-package expiry, Wisdom class-feature spell materialization, source-derived level scaling, encounter lock, Forge exclusion, tactical isolation, and protected world boundaries validated.");

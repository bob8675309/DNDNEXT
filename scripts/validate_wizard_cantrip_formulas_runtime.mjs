import fs from "node:fs";

const migration = fs.readFileSync("sql/20260809_77_wizard_cantrip_formulas_runtime.sql", "utf8");
const panel = fs.readFileSync("components/CharacterWizardCantripFormulasPanel.js", "utf8");
const host = fs.readFileSync("components/CharacterCurrencyBadge.js", "utf8");
const extensions = fs.readFileSync("utils/classFeatureChoiceExtensions.js", "utf8");

const need = (source, token) => { if (!source.includes(token)) throw new Error(`Missing Cantrip Formulas contract: ${token}`); };
const forbid = (source, token) => { if (source.includes(token)) throw new Error(`Forbidden Cantrip Formulas crossover: ${token}`); };

for (const token of [
  "wizard_cantrip_formulas_feature_level_v1",
  "Cantrip Formulas",
  "upper(coalesce(f.class_source,''))='PHB'",
  "upper(coalesce(f.source,''))='TCE'",
  "isClassFeatureVariant",
  "character_class_feature_acquired_at_v1",
  "'wizard','PHB'",
  "wizard_cantrip_formulas_context_v1",
  "wizard_cantrip_formulas_options_v1",
  "public.spells_catalog_preferred",
  "s.level=0",
  "lower(c)='wizard'",
  "cs.source_type='class'",
  "and cs.known",
  "not exists(",
  "sync_wizard_cantrip_formulas_projection_v1",
  "runtimeFeatures,wizardCantripFormulas",
  "get_character_wizard_cantrip_formulas_v1",
  "configure_character_wizard_cantrip_formulas_v1",
  "private.can_manage_character_spell_resources_v1",
  "character_active_encounter_v1",
  "rest_type='long_rest'",
  "wizard-cantrip-formulas",
  "Cantrip Formulas has already been used for this Long Rest.",
  "The character already knows the selected replacement cantrip.",
  "update public.character_spells",
  "set spell_id=p_to_spell_id",
  "where id=p_from_assignment_id and character_id=p_character_id",
  "configuredBy','long_rest_replacement'",
  "revoke all on function public.get_character_wizard_cantrip_formulas_v1(uuid) from public,anon",
  "revoke all on function public.configure_character_wizard_cantrip_formulas_v1(uuid,uuid,uuid) from public,anon",
]) need(migration, token);

for (const token of [
  "get_character_wizard_cantrip_formulas_v1",
  "configure_character_wizard_cantrip_formulas_v1",
  "p_from_assignment_id",
  "p_to_spell_id",
  "Long-Rest feature",
  "Replace known cantrip",
  "Learn instead",
  "Replace Cantrip",
  "PHB Wizard",
]) need(panel, token);

for (const token of [
  'import CharacterWizardCantripFormulasPanel from "./CharacterWizardCantripFormulasPanel";',
  '<CharacterWizardCantripFormulasPanel characterId={characterId} />',
]) need(host, token);

forbid(extensions, 'label: "Cantrip Formulas"', "permanent Forge Cantrip Formulas group");
forbid(extensions, 'id: "wizard-cantrip-formulas"', "permanent Forge Cantrip Formulas group");

for (const source of [migration, panel, host]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "player_wallets"]) forbid(source, token);
}
for (const token of [
  "insert into public.character_spells",
  "delete from public.character_spells",
  "source_type='class-feature'",
  "source_type='species'",
]) forbid(migration, token);

console.log("PHB/TCE Wizard Cantrip Formulas source gating, Long-Rest cadence, in-place class cantrip replacement, duplicate-known guard, encounter lock, ACLs, host wiring, and protected boundaries validated.");

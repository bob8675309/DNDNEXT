import fs from "node:fs";

const migration = fs.readFileSync("sql/20260809_74_wizard_memorize_spell_runtime.sql", "utf8");
const panel = fs.readFileSync("components/CharacterWizardMemorizeSpellPanel.js", "utf8");
const host = fs.readFileSync("components/CharacterCurrencyBadge.js", "utf8");

const need = (source, token) => { if (!source.includes(token)) throw new Error(`Missing Memorize Spell contract: ${token}`); };
const forbid = (source, token) => { if (source.includes(token)) throw new Error(`Forbidden Memorize Spell crossover: ${token}`); };

for (const token of [
  "wizard_memorize_spell_feature_level_v1",
  "wizard_memorize_spell_context_v1",
  "wizard_memorize_spell_options_v1",
  "wizard_spellbook_has_spell_v1",
  "character_class_feature_acquired_at_v1",
  "rest_type='short_rest'",
  "wizard-memorize-spell",
  "s.level>=1",
  "not coalesce(cs.always_available,false)",
  "not coalesce(cs.prepared,false)",
  "character_active_encounter_v1",
  "The spell being replaced must be a currently prepared Wizard spell that is not always prepared.",
  "The replacement spell must currently be unprepared.",
  "update public.character_spells set prepared=false",
  "update public.character_spells set prepared=true",
  "configuredBy','short_rest_replacement'",
  "runtimeFeatures,wizardMemorizeSpell",
  "get_character_wizard_memorize_spell_v1",
  "configure_character_wizard_memorize_spell_v1",
  "revoke all on function public.get_character_wizard_memorize_spell_v1(uuid) from public,anon",
  "revoke all on function public.configure_character_wizard_memorize_spell_v1(uuid,uuid,uuid) from public,anon",
]) need(migration, token);

for (const token of [
  "get_character_wizard_memorize_spell_v1",
  "configure_character_wizard_memorize_spell_v1",
  "Unprepare",
  "Prepare instead",
  "Short-Rest feature",
  "Memorize Spell changes preparation only; it never changes spellbook membership.",
]) need(panel, token);

for (const token of [
  'import CharacterWizardMemorizeSpellPanel from "./CharacterWizardMemorizeSpellPanel";',
  '<CharacterWizardMemorizeSpellPanel characterId={characterId} />',
]) need(host, token);

for (const source of [migration, panel, host]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "player_wallets"]) forbid(source, token);
}
for (const token of [
  "insert into public.character_spells",
  "delete from public.character_spells",
  "always_available=false",
  "always_available=true",
  "update public.encounter_participants",
  "insert into public.encounter_participants",
]) forbid(migration, token);

console.log("Wizard Memorize Spell Short-Rest prepared-spell replacement, spellbook immutability, active-encounter lock, ACLs, and protected boundaries validated.");

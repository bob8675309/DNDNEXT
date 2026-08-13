import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("sql/20260808_56_dread_allegiance_runtime.sql");
const panel = read("components/CharacterDreadAllegiancePanel.js");
const runtimeHost = read("components/CharacterAstralTrancePanel.js");
const forgeCore = read("components/NpcForgeCoreSupport.js");
const forgeController = read("components/useNpcForgeController.js");
const forgeDerived = read("components/useNpcForgeDerivedModel.js");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing Dread Allegiance contract ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden Dread Allegiance contract ${label}: ${token}`);
};

for (const token of [
  "character_has_dread_allegiance_v1",
  "private.normalize_player_choice_name_v1(cp.subclass_name)='scionofthethree'",
  "cp.class_level>=3",
  "dread_allegiance_options_v1",
  "(1,'bane','Bane','psychic','Minor Illusion')",
  "(2,'bhaal','Bhaal','poison','Blade Ward')",
  "(3,'myrkul','Myrkul','necrotic','Chill Touch')",
  "spells_catalog_preferred",
  "character_runtime_damage_resistances_v1",
  "get_character_dread_allegiance_v1",
  "configure_character_dread_allegiance_v1",
  "'featureKey','dread-allegiance'",
  "'cadence','long_rest'",
  "'canConfigure',not v_configured",
  "'canReplace',v_can_replace",
  "v_latest_long_rest>v_runtime.replacement_anchor_at",
  "Finish a newer Long Rest before changing Dread Allegiance.",
  "private.character_active_encounter_v1(p_character_id)",
  "Dread Allegiance cannot be changed while this character is in an active encounter.",
  "delete from public.character_spells",
  "source_type='class-feature'",
  "source_key='dread-allegiance'",
  "'Dread Allegiance',true,true,true",
  "null,null,null,'int'",
  "'runtimeFeatureKey','dread-allegiance'",
  "'{runtimeFeatures,dreadAllegiance}'",
  "previousAllegiance",
]) need(migration, token);

// Current allegiance persists across rest; there is no auto-expiry trigger.
forbid(migration, "expire_dread_allegiance", "automatic allegiance expiry");
forbid(migration, "after insert on public.character_rest_log", "Long-Rest expiry trigger");
forbid(migration, "encounter_participants", "tactical snapshot mutation");
forbid(migration, "admin_add_encounter_participant", "combat participant patch");
forbid(migration, "update public.players", "account-wide sheet projection");

for (const token of [
  "get_character_dread_allegiance_v1",
  "configure_character_dread_allegiance_v1",
  "Dread Allegiance",
  "Bane, Bhaal, or Myrkul",
  "Resistance",
  "Cantrip",
  "Intelligence",
  "Change Allegiance",
  "current choice remains active until you replace it",
]) need(panel, token);

for (const token of [
  'import CharacterDreadAllegiancePanel from "./CharacterDreadAllegiancePanel";',
  "<CharacterDreadAllegiancePanel",
]) need(runtimeHost, token);

for (const source of [forgeCore, forgeController, forgeDerived]) {
  forbid(source, "dreadAllegiance", "Forge Dread Allegiance state");
  forbid(source, "Dread Allegiance", "Forge Dread Allegiance choice");
}

for (const source of [migration, panel, runtimeHost]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "weather"]) {
    forbid(source, token, `protected world boundary ${token}`);
  }
}

console.log("Dread Allegiance XPHB Scion eligibility, Bane/Bhaal/Myrkul source packages, class-feature cantrip replacement, runtime resistance, immediate initial choice, persistent current allegiance, one change after newer Long Rest, encounter lock, Forge exclusion, tactical-boundary isolation, and protected world boundaries validated.");

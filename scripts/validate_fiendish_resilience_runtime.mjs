import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("sql/20260808_57_fiendish_resilience_runtime.sql");
const panel = read("components/CharacterFiendishResiliencePanel.js");
const runtimeHost = read("components/CharacterDreadAllegiancePanel.js");
const forgeCore = read("components/NpcForgeCoreSupport.js");
const forgeController = read("components/useNpcForgeController.js");
const forgeDerived = read("components/useNpcForgeDerivedModel.js");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing Fiendish Resilience contract ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden Fiendish Resilience contract ${label}: ${token}`);
};

for (const token of [
  "character_has_fiendish_resilience_v1",
  "lower(f.name)='fiendish resilience'",
  "upper(f.class_source)='XPHB'",
  "private.normalize_player_choice_name_v1(f.subclass_name)=private.normalize_player_choice_name_v1(cp.subclass_name)",
  "fiendish_resilience_acquired_at_v1",
  "character_level_events",
  "Direct higher-level Forge creation",
  "fiendish_resilience_options_v1",
  "(1,'acid','Acid')",
  "(2,'bludgeoning','Bludgeoning')",
  "(12,'thunder','Thunder')",
  "character_runtime_damage_resistances_v1",
  "feature_key in ('dread-allegiance','fiendish-resilience')",
  "get_character_fiendish_resilience_v1",
  "configure_character_fiendish_resilience_v1",
  "'cadence','short_or_long_rest'",
  "rest_type in ('short_rest','long_rest')",
  "v_latest_rest>v_acquired_at",
  "Finish a Short or Long Rest after gaining Fiendish Resilience before choosing a resistance.",
  "Finish a newer Short or Long Rest before changing Fiendish Resilience.",
  "private.character_active_encounter_v1(p_character_id)",
  "Fiendish Resilience cannot be changed while this character is in an active encounter.",
  "'{runtimeFeatures,fiendishResilience}'",
  "previousResistance",
]) need(migration, token);

forbid(migration, "'force','Force'", "Force resistance option");
forbid(migration, "expire_fiendish_resilience", "automatic resistance expiry");
forbid(migration, "after insert on public.character_rest_log", "rest expiry trigger");
forbid(migration, "encounter_participants", "tactical snapshot mutation");
forbid(migration, "admin_add_encounter_participant", "combat participant patch");
forbid(migration, "update public.players", "account-wide sheet projection");

for (const token of [
  "get_character_fiendish_resilience_v1",
  "configure_character_fiendish_resilience_v1",
  "Short / Long Rest choice",
  "Current resistance",
  "Choose a damage type",
  "Change Resistance",
  "damage type other than Force",
  "Finish a Short or Long Rest after gaining Fiendish Resilience",
  "current resistance persists",
]) need(panel, token);

for (const token of [
  'import CharacterFiendishResiliencePanel from "./CharacterFiendishResiliencePanel";',
  "<CharacterFiendishResiliencePanel",
]) need(runtimeHost, token);

for (const source of [forgeCore, forgeController, forgeDerived]) {
  forbid(source, "fiendishResilience", "Forge Fiendish Resilience state");
  forbid(source, "Fiendish Resilience", "Forge Fiendish Resilience choice");
}

for (const source of [migration, panel, runtimeHost]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "weather"]) {
    forbid(source, token, `protected world boundary ${token}`);
  }
}

console.log("Fiendish Resilience source eligibility, post-acquisition first-rest requirement, 12 non-Force damage types, persistent current resistance, one change after newer Short or Long Rest, shared runtime-resistance helper, encounter lock, Forge exclusion, tactical-boundary isolation, and protected world boundaries validated.");

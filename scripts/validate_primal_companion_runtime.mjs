import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("sql/20260808_55_primal_companion_runtime.sql");
const panel = read("components/CharacterPrimalCompanionPanel.js");
const sheetPanel = read("components/CharacterSheetPanel.js");
const forgeCore = read("components/NpcForgeCoreSupport.js");
const forgeController = read("components/useNpcForgeController.js");
const forgeDerived = read("components/useNpcForgeDerivedModel.js");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing Primal Companion contract ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden Primal Companion contract ${label}: ${token}`);
};

for (const token of [
  "character_has_primal_companion_v1",
  "private.normalize_player_choice_name_v1(cp.subclass_name)='beastmaster'",
  "upper(btrim(coalesce(cp.subclass_source,'')))='XPHB'",
  "cp.class_level>=3",
  "primal_companion_options_v1",
  "'land','name','Beast of the Land'",
  "'sea','name','Beast of the Sea'",
  "'sky','name','Beast of the Sky'",
  "get_character_primal_companion_v1",
  "configure_character_primal_companion_v1",
  "'featureKey','primal-companion'",
  "'cadence','long_rest'",
  "'canConfigure',not v_configured",
  "'canReplace',v_can_replace",
  "v_latest_long_rest>v_runtime.replacement_anchor_at",
  "v_anchor:=timezone('utc',now())",
  "v_anchor:=v_latest_long_rest",
  "previousCompanion",
  "Finish a newer Long Rest before replacing the current Primal Companion.",
  "private.character_active_encounter_v1(p_character_id)",
  "Primal Companion cannot be changed while this character is in an active encounter.",
  "'{runtimeCompanions,primalCompanion}'",
  "appearance must be between 1 and 80 characters",
]) need(migration, token);

// The current beast persists across rest. No Long-Rest expiry trigger belongs here.
forbid(migration, "expire_primal_companion", "automatic companion expiry");
forbid(migration, "after insert on public.character_rest_log", "Long-Rest deletion trigger");
forbid(migration, "delete from public.character_runtime_feature_choices", "runtime companion deletion");
forbid(migration, "update public.players", "account-wide projection");

for (const token of [
  "get_character_primal_companion_v1",
  "configure_character_primal_companion_v1",
  "Summon Initial Companion",
  "Summon Replacement",
  "Current form",
  "Animal appearance",
  "current beast remains until you replace it",
  "Long Rest opens one replacement opportunity",
]) need(panel, token);

for (const token of [
  'import CharacterPrimalCompanionPanel from "./CharacterPrimalCompanionPanel";',
  "<CharacterPrimalCompanionPanel",
]) need(sheetPanel, token);

// Runtime choice only: do not add a permanent Primal Companion form to Forge state.
for (const source of [forgeCore, forgeController, forgeDerived]) {
  forbid(source, "primalCompanion", "Forge Primal Companion state");
  forbid(source, "Primal Companion", "Forge Primal Companion choice");
}

for (const source of [migration, panel, sheetPanel]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "weather"]) {
    forbid(source, token, `protected world boundary ${token}`);
  }
}

console.log("Primal Companion XPHB Beast Master eligibility, immediate initial summon, persistent current beast, one replacement after a newer Long Rest, active-encounter lock, runtime sheet UI, Forge exclusion, and protected boundaries validated.");

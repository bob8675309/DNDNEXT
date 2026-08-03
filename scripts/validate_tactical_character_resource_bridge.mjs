import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const coreSql = read("sql/20260802_04_tactical_character_resource_bridge_core.sql");
const profileSql = read("sql/20260802_05_tactical_character_resource_bridge_profile.sql");
const lockSql = read("sql/20260802_06_character_resource_active_encounter_lock.sql");
const bridge = read("components/TacticalCharacterResourceBridge.js");
const bridgeStyles = read("styles/TacticalCharacterResourceBridge.module.css");
const tracker = read("components/CharacterSheetResourceTracker.js");
const trackerStyles = read("styles/CharacterSheetResourceTracker.module.css");
const app = read("pages/_app.js");
const combat = read("pages/encounters/combat.js");
const pkg = read("package.json");
const runner = read("scripts/vercel_build_v2.mjs");

for (const token of [
  "private.initialize_encounter_spell_slots_v1",
  "public.character_spell_slots",
  "private.refresh_encounter_spell_slots_from_characters_v1",
  "encounter_spell_slots_refresh_on_activation",
  "private.mirror_encounter_spell_slot_spend_v1",
  "encounter_spell_slot_character_spend_bridge",
  "current_setting('dndnext.resource_bridge_sync'",
]) {
  assert(coreSql.includes(token), `Core tactical resource bridge is missing: ${token}`);
}
assert(coreSql.includes("v_slot.slots_remaining"), "New encounter participants must seed current persistent remaining slots");
assert(!coreSql.includes("update public.encounters\n  set version"), "Resource bridge must not alter encounter version ownership");
assert(!coreSql.includes("MapPageClient"), "Resource bridge must not introduce world-map behavior");

for (const token of [
  "public.encounter_spellcasting_profile_v2",
  "public.encounter_spellcasting_profile_v1(p_participant_id)",
  "persistentSlotState",
  "persistentSlotMismatch",
  "persistentResourcesLinked",
  "resourceBridgeVersion",
]) {
  assert(profileSql.includes(token), `Tactical resource profile v2 is missing: ${token}`);
}
assert(!profileSql.includes("alter function public.encounter_spellcasting_profile_v1"), "Tactical bridge must leave the existing spell profile v1 contract unchanged");

for (const token of [
  "private.character_active_encounter_v1",
  "private.assert_character_resource_not_active_v1",
  "character_spell_slots_active_encounter_guard",
  "character_spell_uses_active_encounter_guard",
  "character_rest_active_encounter_guard",
  "dndnext.resource_bridge_context",
  "public.character_sheet_resource_profile_v2",
  "character_spell_slots_authenticated_read",
  "alter publication supabase_realtime add table public.character_spell_slots",
]) {
  assert(lockSql.includes(token), `Active encounter sheet lock is missing: ${token}`);
}
assert(lockSql.includes("'encounter_spend'"), "Battle-board slot spending must bypass sheet locks only through explicit trigger context");

for (const token of [
  "encounter_spellcasting_profile_v2",
  "persistentSlotState",
  "persistentSlotMismatch",
  "Battle-board casts spend both ledgers",
  "Existing battle counts were preserved",
  "character_spell_slots",
  "encounter_spell_slots",
  "createPortal",
  "MutationObserver",
]) {
  assert(bridge.includes(token), `Battle-board resource bridge UI is missing: ${token}`);
}
assert(bridge.includes('table: "encounters"') && bridge.includes('active_participant_id'), "Battle-board bridge must follow the active encounter participant");
assert(!bridge.includes("encounter_cast_spell"), "Bridge UI must not replace or bypass tactical spell RPC dispatch");
assert(bridgeStyles.includes(".mismatch") && bridgeStyles.includes(".linked"), "Battle-board bridge status styles are incomplete");

for (const token of [
  "character_sheet_resource_profile_v2",
  "encounterLocked",
  "Battle-board controlled",
  "currently controls spell resources",
  "character_spell_slots",
  'table: "encounters"',
  "updateSpellRows(root, liveProfile)",
  "locked={encounterLocked}",
]) {
  assert(tracker.includes(token), `Sheet resource tracker bridge is missing: ${token}`);
}
assert(trackerStyles.includes(".rootLocked") && trackerStyles.includes(".lockNotice"), "Sheet active-encounter lock styles are incomplete");

assert(app.includes('import TacticalCharacterResourceBridge from "../components/TacticalCharacterResourceBridge";'), "App shell must import the tactical character resource bridge");
assert(app.includes("<TacticalCharacterResourceBridge />"), "App shell must mount the tactical character resource bridge");

for (const token of [
  '"encounter_cast_spell_v13"',
  '"encounter_cast_allocated_spell_v1"',
  '"encounter_cast_directional_area_spell_v2"',
  '"encounter_cast_area_spell_v1"',
]) {
  assert(combat.includes(token), `Existing tactical spell dispatch contract is missing: ${token}`);
}
assert(!combat.includes("MapPageClient"), "Combat page must not introduce world-map behavior");

assert(pkg.includes('"check:tactical-character-resource-bridge": "node scripts/validate_tactical_character_resource_bridge.mjs"'), "Package script for tactical character resource bridge is missing");
assert(runner.includes("validate_tactical_character_resource_bridge.mjs"), "Production build runner must validate the tactical character resource bridge");

console.log("Tactical character resource bridge validation passed.");

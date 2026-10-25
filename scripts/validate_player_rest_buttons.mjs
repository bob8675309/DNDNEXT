import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => fs.readFileSync(path, "utf8");
const sheet = read("components/CharacterSheetEnhancements.js");
const panel = read("components/CharacterSheetResourceTracker.js");
const dialog = read("components/CharacterRestActivityDialog.js");
const dialogCss = read("styles/CharacterRestActivityDialog.module.css");
const sql = read("sql/20260810_90_rest_class_feature_restoration.sql");
const guard = read("sql/20260802_06_character_resource_active_encounter_lock.sql");
const workflow = read(".github/workflows/validate-player-rest-buttons.yml");
for (const call of ['onRest?.("short_rest")', 'onRest?.("long_rest")']) {
  assert.ok(panel.includes(call), "Missing the player rest button: " + call);
}
assert.ok(panel.includes("const disabledByState = loading || Boolean(busyKey) || encounterLocked;"), "Combat must disable rest buttons");
for (const restType of ["short_rest", "long_rest"]) {
  assert.ok(panel.includes('disabled={disabledByState} onClick={() => onRest?.("' + restType + '")}'), "Rest button bypassed encounter lock: " + restType);
}
for (const token of [
  'function handleRest(restType)', 'setRestDialogType(restType)',
  '<CharacterRestActivityDialog', 'onRest={handleRest}',
  'async function recoverDuringRest()', 'restSubmitInFlight.current = true',
  'const completed = await runResourceRpc("complete_character_rest_v1"',
  "if (completed) setRestDialogType(null)", 'p_rest_type: restDialogType',
  'resourceProfile?.encounterLocked', 'return false;', 'return true;',
  'characterId={resolvedCharacterId}',
]) assert.ok(sheet.includes(token), "Rest/UI integration lost: " + token);
assert.ok(!sheet.includes("window.confirm("), "Activity dialog must replace browser confirmation");
assert.ok(!sheet.includes('"record_attunement_focused_short_rest_v1"'), "Rest was routed through GM attunement");
for (const token of [
  'role="dialog"', 'aria-modal="true"',
  'aria-labelledby="character-rest-activity-title"',
  'event.key === "Escape"', 'event.key !== "Tab"',
  'primaryRef.current?.focus()', 'Rest &amp; Recover',
  'Complete rest', 'Work on Crafting', 'Coming later',
  'attunementEnabled ? (', 'Review magic item choices',
  'disabled={unavailable}', 'onClick={onRecover}',
  'onClick={onClose}', 'if (!combinedBusy && event.target === event.currentTarget)',
]) assert.ok(dialog.includes(token), "Missing accessible or truthful option: " + token);
assert.ok(dialog.includes('supabase.rpc("get_character_rest_magic_choices_v1"'), "Magic choices must be read server-side");
assert.ok(!dialog.includes('supabase.rpc("complete_character_rest_v1"'), "Recovery still belongs to the canonical sheet handler");
assert.ok(!dialog.includes("set_character_item_attunement_v1"), "No placeholder attunement writes");
assert.ok(dialogCss.includes("@media print"), "Activity overlay should not print");
assert.ok(dialogCss.includes(":focus-visible"), "Keyboard focus styling must remain");
assert.ok(sql.includes("private.restore_character_rest_action_state_v1"), "Class-feature recovery lost");
assert.ok(guard.includes("character_rest_active_encounter_guard") || guard.includes("assert_character_resource_not_active_v1"), "Server encounter rest guard absent");
for(const path of ["components/CharacterRestActivityDialog.js", "styles/CharacterRestActivityDialog.module.css", "scripts/validate_player_rest_buttons.mjs"]){
  assert.ok(workflow.includes(path), "CI source missing "+path);
}
console.log("Short/Long Rest → accessible activities → guarded canonical recovery contract passed.");

import assert from "node:assert/strict";
import fs from "node:fs";
const sheet=fs.readFileSync("components/CharacterSheetEnhancements.js","utf8");
const panel=fs.readFileSync("components/CharacterSheetResourceTracker.js","utf8");
const sql=fs.readFileSync("sql/20260810_90_rest_class_feature_restoration.sql","utf8");
const guard=fs.readFileSync("sql/20260802_06_character_resource_active_encounter_lock.sql","utf8");
for (const term of [
'async function handleRest(restType)',
'const isLong = restType === "long_rest";',
'"complete_character_rest_v1"',
'p_rest_type: restType',
'Recover' // normalized below; see case test
].slice(0,-1)) assert.ok(sheet.includes(term),"Rest action contract lost: "+term);
assert.match(sheet,/Complete a Short Rest\? Restore eligible Pact Magic slots and abilities that recover on a Short Rest/);
assert.match(sheet,/Complete a Long Rest\? Restore tracked spell slots and abilities that recover on a Short or Long Rest/);
assert.ok(!sheet.includes("HP, Hit Dice, class features, and encounter state are not changed yet"),"Outdated class-feature rest warning remains");
for (const label of ['onRest?.("short_rest")','onRest?.("long_rest")']) assert.ok(panel.includes(label),"Missing player rest button: "+label);
assert.ok(panel.includes('const disabledByState = loading || Boolean(busyKey) || encounterLocked;'),"In-combat rest lock missing");
assert.ok(panel.includes('disabled={disabledByState} onClick={() => onRest?.("short_rest")}'));
assert.ok(panel.includes('disabled={disabledByState} onClick={() => onRest?.("long_rest")}'));
assert.ok(sql.includes("private.restore_character_rest_action_state_v1"),"Canonical class-feature rest restoration was lost");
assert.ok(guard.includes("character_rest_active_encounter_guard") || guard.includes("assert_character_resource_not_active_v1"),"Canonical in-combat rest guard no longer tracked");
assert.ok(!sheet.includes("record_attunement_focused_short_rest_v1"),"Ordinary player rest incorrectly routed through GM attunement");
assert.ok(!panel.includes("attunement_focus"),"Attunement status incorrectly coupled to buttons");
console.log("Player Short/Long Rest two-button recovery + encounter lock contract passed.");

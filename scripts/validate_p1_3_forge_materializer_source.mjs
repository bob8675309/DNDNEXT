#!/usr/bin/env node
// Minimal offline source/fixture validation; executable PG17 is separate.
import fs from "node:fs";
import assert from "node:assert/strict";
const read=x=>fs.readFileSync(x,"utf8");
const original=read("scripts/fixtures/p1_3_forge_materializer_original_functions_pg17.sql");
const setup=read("scripts/fixtures/p1_3_forge_materializer_lock_setup_pg17.sql");
const harness=read("scripts/test_p1_3_forge_materializer_lock_pg17.mjs");
const required=[
["materialize_player_forge_starting_equipment_v1","653e1b9d7cc47dcff2cef33a674b97f4"],
["materialize_player_forge_starting_equipment_trigger_v1","23fa54dd0a6d7b42b802d613f39ea27c"],
["sync_character_progression_from_sheet_v1","bb1a3a2d1600ce33cd4fcadac5e0f3a9"]
];
for(const [fn,hash] of required) {
  assert.ok(original.includes("FUNCTION private."+fn), "Missing exact original "+fn);
  assert.ok(original.includes(hash),"Original fingerprint missing "+hash);
}
for(const token of [
 "from public.character_progression",
 "from public.character_sheets",
 "for update;",
 "from public.character_permissions cp",
 "insert into public.inventory_items",
 "insert into public.character_currency"
]) assert.ok(original.includes(token),"Expected source lock/resource path absent: "+token);
for(const token of [
 "CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_starting_equipme",
 "DEFERRABLE INITIALLY DEFERRED",
 "CREATE TRIGGER sync_character_progression_from_sheet_v1",
 "AFTER INSERT OR UPDATE OF sheet",
 "DO $not_yet$",
 "PASS F01"
]) assert.ok(setup.includes(token),"Missing deferred materializer proof "+token);
for(const token of [
 "SET deadlock_timeout='150ms'",
 "pg_advisory_xact_lock(31900,1)",
 "wait_event_type",
 "deadlock detected",
 "PASS F02",
 "PASS F03",
 "DISPOSABLE_PG17_ONLY"
]) assert.ok(harness.includes(token),"Missing multi-session source lock proof "+token);
for(const s of [setup,harness]){
 assert.ok(!s.includes("ucggczovhmauhshvhusx"),"Must never reference production project");
 assert.ok(!s.includes("service_role"),"Must never load service credentials");
}
console.log("P1.3 exact-source Forge P/S/trigger fixture paths and guard boundaries PASS (static only).");

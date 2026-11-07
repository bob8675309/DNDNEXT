#!/usr/bin/env node
// Minimal offline source/fixture validation; executable PG17 is separate.
import fs from "node:fs";
import assert from "node:assert/strict";
const read=x=>fs.readFileSync(x,"utf8");
const original=read("scripts/fixtures/p1_3_forge_materializer_original_functions_pg17.sql");
const setup=read("scripts/fixtures/p1_3_forge_materializer_lock_setup_pg17.sql");
const harness=read("scripts/test_p1_3_forge_materializer_lock_pg17.mjs");
const adminOriginal=read("scripts/fixtures/p1_3_admin_progression_original_pg17.sql");
const adminExtension=read("scripts/fixtures/p1_3_admin_progression_race_extension_pg17.sql");
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
assert.ok(adminOriginal.includes("CREATE OR REPLACE FUNCTION public.set_character_progression_v1("),
 "Missing original Admin progression v1 source");
assert.ok(adminOriginal.includes("eb467b7c7a8d548581a36cfcb0d8f77b"),
 "Admin source checksum annotation must match read-only live pg_get_functiondef");
for(const part of [
 "on conflict (character_id) do update set",
 "insert into public.character_sheets",
 "on conflict (character_id) do update set sheet",
 "insert into public.character_level_events"
]) assert.ok(adminOriginal.includes(part),"Missing original Admin CP->CS->event path "+part);
for(const part of [
 "CREATE SCHEMA auth",
 "private.require_character_admin_v1",
 "public.get_character_progression_v1(uuid)",
 "scripts/fixtures/p1_3_admin_progression_original_pg17.sql",
 "md5(pg_get_functiondef",
 "eb467b7c7a8d548581a36cfcb0d8f77b",
 "Original Admin/Forge CP-CS source hash drift"
]) assert.ok(adminExtension.includes(part),"Missing isolated admin source fixture "+part);
for(const part of [
 "PASS F04",
 "PASS F05",
 "adminProgressionCall",
 "original Admin progression CP->CS",
 "original CS note -> CP sync",
 "40P01|deadlock detected",
 "synthetic CP-first",
 "adminProgressionRaceNote"
]) assert.ok(harness.includes(part),"Missing timed source/Admin CP-CS race assertion "+part);
for(const s of [setup,harness,adminOriginal,adminExtension]){
 assert.ok(!s.includes("ucggczovhmauhshvhusx"),"Must never reference production project");
 assert.ok(!s.includes("service_role"),"Must never load service credentials");
}
console.log("P1.3 original source materializer and Admin progression CP/CS inversion F01-F05 fixture gates PASS (static only).");

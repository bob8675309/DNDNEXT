#!/usr/bin/env node
// Source fidelity / no-unreviewed-mutation gate for held Forge replay candidate.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const original=readFileSync("scripts/fixtures/forge_creation_original_functions_pg17.sql","utf8");
const candidate=readFileSync("sql/candidates/20261105_player_creation_immutable_intent_v1.sql","utf8");
const fixture=readFileSync("scripts/fixtures/forge_creation_replay_candidate_pg17.sql","utf8");
const creator=readFileSync("scripts/fixtures/forge_creator_trigger_original_stage3_pg17.sql","utf8");
const gear=readFileSync("scripts/fixtures/forge_materializer_original_functions_pg17.sql","utf8");
const gearExtension=readFileSync("scripts/fixtures/forge_materializer_local_auth_extension_pg17.sql","utf8");
const localAuth=readFileSync("scripts/test_forge_immutable_creation_replay_local_auth.mjs","utf8");

function source(name) {
 const marker="CREATE OR REPLACE FUNCTION public."+name+"(";
 const from=original.indexOf(marker);
 assert.ok(from>=0,"missing exact original "+name);
 const to=original.indexOf("$function$;",from);
 assert.ok(to>from,"missing function terminator for "+name);
 return original.slice(from,to+"$function$;".length);
}
const v2=source("create_player_character_v2");
const v3=source("create_player_character_v3");
const admin=source("create_character_v1");
assert.ok(v2.includes("insert into public.character_level_events"),"v2 event source missing");
assert.ok(v3.includes("delete from public.character_spells"),"v3 replay mutation source missing");
assert.ok(v3.includes("public.create_player_character_v2(p_payload, v_proxy)"),"v3 nested source anchor changed");
assert.ok(admin.includes("private.require_character_admin_v1()"),"Admin auth source missing");
const privateV2=v2.replace(
 "CREATE OR REPLACE FUNCTION public.create_player_character_v2(",
 "CREATE OR REPLACE FUNCTION private.create_player_character_v2_source_20261105("
);
const privateV3=v3.replace(
 "CREATE OR REPLACE FUNCTION public.create_player_character_v3(",
 "CREATE OR REPLACE FUNCTION private.create_player_character_v3_source_20261105("
).replace(
 "public.create_player_character_v2(p_payload, v_proxy)",
 "private.create_player_character_v2_source_20261105(p_payload, v_proxy)"
);
const originalLegacyClause="insert into public.players(user_id, name, sheet, updated_at) values(v_user, v_name, v_sheet, now()) on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now();";
const preservedLegacyClause="insert into public.players(user_id, name, sheet, updated_at) values(v_user, v_name, v_sheet, now()) on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now() where public.players.sheet = '{}'::jsonb;";
assert.equal(privateV2.split(originalLegacyClause).length,2,
 "Private source v2 original legacy update must have exactly one anchor");
assert.ok(candidate.includes(privateV2.replace(originalLegacyClause,preservedLegacyClause)),
 "Private v2 must equal original except private name and PR319's ONE legacy-sheet clause");
assert.ok(!candidate.includes(privateV2),
 "Unprotected legacy snapshot source must not survive in the candidate");
assert.ok(candidate.includes(privateV3),"Private v3 changed more than approved private name + nested call");
for (const [name,hash] of [
 ["v2","0351f0a00acae023278e1b8b065b00c9"],
 ["v3","6ba73e6f12fcf826cc0a739cce45ff40"]
]) assert.ok(candidate.includes(hash),"Missing live source MD5 "+name);
for (const str of [
 "sha256(convert_to(jsonb_build_array(",
 "ON CONFLICT(request_id) DO NOTHING",
 "FOR UPDATE",
 "Creation request ID already used for different character or spell selections",
 "historical",
 "creation_api IN ('player-v2','player-v3')",
 "character_id uuid UNIQUE REFERENCES public.characters(id) ON DELETE SET NULL",
 "REVOKE ALL ON private.player_creation_intent_reservations_v1 FROM PUBLIC,anon,authenticated",
 "REVOKE ALL ON FUNCTION private.create_player_character_v2_source_20261105",
 "REVOKE ALL ON FUNCTION private.create_player_character_v3_source_20261105",
 "CREATE OR REPLACE FUNCTION public.create_player_character_v2(",
 "CREATE OR REPLACE FUNCTION public.create_player_character_v3("
]) assert.ok(candidate.toLowerCase().includes(str.toLowerCase()),"Missing immutable request guard: "+str);
for (const str of ["FCR-B00","FCR-01","FCR-02","FCR-03","FCR-04","FCR-05",
 "create_player_character_v3","create_player_character_v2","create_character_v1",
 "Changed v3 magic accepted","Legacy unverified nonce incorrectly accepted",
 "Revoked creator re-read cached creation","characters_capture_creator_at_insert_v1"
]) assert.ok((fixture+"\n"+creator).includes(str),"Missing fixture coverage: "+str);
for (const str of ["INSERT INTO private.character_creator_attribution","CREATE TRIGGER characters_capture_creator_at_insert_v1",
 "auth.uid() IS NOT NULL"])
 assert.ok(creator.includes(str),"Creator trigger lost source candidate contract: "+str);
assert.ok(!candidate.includes("https://") && !candidate.includes("SUPABASE_SERVICE_ROLE_KEY"),"Candidate unexpectedly embeds URLs/secret names");
for (const [fn,digest] of [
 ["materialize_player_forge_starting_equipment_trigger_v1","23fa54dd0a6d7b42b802d613f39ea27c"],
 ["materialize_player_forge_starting_equipment_v1","653e1b9d7cc47dcff2cef33a674b97f4"],
 ["sync_character_progression_from_sheet_v1","bb1a3a2d1600ce33cd4fcadac5e0f3a9"]
]) {
 assert.ok(gear.includes(digest), "Missing original deployed MD5 annotation "+fn);
 assert.ok(gear.includes("CREATE OR REPLACE FUNCTION private."+fn+"("),
 "Missing original deployed function body "+fn);
}
assert.ok(gearExtension.includes("DEFERRABLE INITIALLY DEFERRED FOR EACH ROW"),
 "Original equipment trigger must remain deferred");
assert.ok(gearExtension.includes("EXECUTE FUNCTION private.sync_character_progression_from_sheet_v1()"),
 "Original sheet/progression trigger must be installed in supplemental slice");
for (const token of ["J10","J11","J12","J13","J14","J15","J16",
 "forge_materializer_local_auth_extension_pg17.sql","startingEquipmentSelections"])
 assert.ok(localAuth.includes(token), "Missing signed-in creation and gear regression "+token);
console.log("PASS source: original Admin/v2/v3 snapshots, v2/v3 source-pinned private wrappers with one PR319 snapshot safeguard, nonce fingerprint and authorization static contract.");

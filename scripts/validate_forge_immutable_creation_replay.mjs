#!/usr/bin/env node
// Source fidelity / no-unreviewed-mutation gate for held Forge replay candidate.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const original=readFileSync("scripts/fixtures/forge_creation_original_functions_pg17.sql","utf8");
const candidate=readFileSync("sql/candidates/20261105_player_creation_immutable_intent_v1.sql","utf8");
const fixture=readFileSync("scripts/fixtures/forge_creation_replay_candidate_pg17.sql","utf8");
const creator=readFileSync("scripts/fixtures/forge_creator_trigger_original_stage3_pg17.sql","utf8");
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
assert.ok(candidate.includes(privateV2),"Private v2 changed more than approved function name");
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
for (const str of ["FCR-B00","FCR-01","FCR-02","FCR-03","FCR-04",
 "create_player_character_v3","create_player_character_v2","create_character_v1",
 "Changed v3 magic accepted","Legacy unverified nonce incorrectly accepted",
 "Revoked creator re-read cached creation","characters_capture_creator_at_insert_v1"
]) assert.ok((fixture+"\n"+creator).includes(str),"Missing fixture coverage: "+str);
for (const str of ["INSERT INTO private.character_creator_attribution","CREATE TRIGGER characters_capture_creator_at_insert_v1",
 "auth.uid() IS NOT NULL"])
 assert.ok(creator.includes(str),"Creator trigger lost source candidate contract: "+str);
assert.ok(!candidate.includes("https://") && !candidate.includes("SUPABASE_SERVICE_ROLE_KEY"),"Candidate unexpectedly embeds URLs/secret names");
console.log("PASS source: original Admin/v2/v3 snapshots, v2/v3 private exact-source wrappers, nonce fingerprint and authorization static contract.");

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
const originalEquipmentValidator=readFileSync("scripts/fixtures/forge_equipment_validator_original_pg17.sql","utf8");
const equipmentValidatorExtension=readFileSync("scripts/fixtures/forge_equipment_validator_local_auth_extension_pg17.sql","utf8");
const originalSheetAuthority=readFileSync("scripts/fixtures/forge_sheet_authority_tags_original_pg17.sql","utf8");
const sheetAuthorityExtension=readFileSync("scripts/fixtures/forge_sheet_authority_tags_local_auth_extension_pg17.sql","utf8");
const progressionOriginal=readFileSync("scripts/fixtures/forge_progression_authority_original_pg17.sql","utf8");
const progressionExtension=readFileSync("scripts/fixtures/forge_progression_authority_local_auth_extension_pg17.sql","utf8");
const featSource=readFileSync("scripts/fixtures/forge_feat_materializer_original_pg17.sql","utf8");
const featSupport=readFileSync("scripts/fixtures/forge_feat_materializer_discriminators_original_pg17.sql","utf8");
const featSetup=readFileSync("scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql","utf8");
const creatorSeed=readFileSync("sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql","utf8");



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
assert.ok(originalEquipmentValidator.includes("41cb1758bd2e1eb9b3998389deabb49b"),
 "Missing independently rechecked original deferred sheet equipment validator hash");
assert.ok(originalEquipmentValidator.includes("CREATE OR REPLACE FUNCTION private.validate_player_forge_starting_equipment_sheet_v1()"),
 "Original sheet equipment validator source missing");
assert.ok(equipmentValidatorExtension.includes("EXECUTE FUNCTION private.validate_player_forge_starting_equipment_sheet_v1()"),
 "Missing exact deferred sheet validator trigger");
for(const [fn,hash] of [
 ["guard_direct_character_authority_mutation_v1","04596b0a3fdfb71c1b357056e8c6023b"],
 ["sync_player_character_tags_from_sheet_v1","a135ca951f81d2a9546d783afe665c52"],
 ["derive_player_character_tags_v1","d62bab7f326330ddbeb6ccede172d19f"],
 ["player_character_tag_slug_v1","aba97a1c7478159d182e38cda4ca8383"]
]) {
 assert.ok(originalSheetAuthority.includes("CREATE OR REPLACE FUNCTION private."+fn+"("),
 "Original sheet authority/tag helper missing "+fn);
 assert.ok(originalSheetAuthority.includes(hash),
 "Live source fingerprint lost for "+fn);
}
assert.ok(sheetAuthorityExtension.includes("BEFORE INSERT OR UPDATE OF sheet ON public.character_sheets"),
 "Missing original pre-write sheet authority guard trigger timing");
assert.ok(sheetAuthorityExtension.includes("AFTER INSERT OR UPDATE OF sheet ON public.character_sheets"),
 "Missing original tag sync trigger timing");
assert.ok(sheetAuthorityExtension.includes("EXECUTE FUNCTION private.guard_direct_character_authority_mutation_v1()"),
 "Missing original authority trigger handler");
assert.ok(sheetAuthorityExtension.includes("EXECUTE FUNCTION private.sync_player_character_tags_from_sheet_v1()"),
 "Missing original tag trigger handler");
assert.ok(sheetAuthorityExtension.includes("CREATE POLICY local_forge_sheet_update_editor"),
 "Missing local editor-only auth write fixture (not production RLS)");
for(const [name,hash] of [
 ["validate_player_forge_authority_payload_v1","48006f8db76e9b32c96fcd2b6a4b3080"],
 ["validate_player_forge_feat_instances_v1","409802af8c5255171ff41bb4a0da694f"],
 ["normalize_player_choice_name_v1","dd8cdd5b47efe99b1cfff9c2bf7635dd"],
 ["player_forge_choice_option_is_valid_v1","586637a9e0e55e19ee335c3efd6ea2b9"],
 ["character_source_priority_v1","fdcc080cd95e6ce282631191869893c1"]
]) {
 assert.ok(progressionOriginal.includes("CREATE OR REPLACE FUNCTION "+
   (name==="character_source_priority_v1"?"public.":"private.")+name+"("),
 "Missing original progression authority function "+name);
 assert.ok(progressionOriginal.includes(hash),"Original progression source hash missing for "+name);
 assert.ok(progressionExtension.includes(hash),"Missing local source fidelity gate "+name);
}
for(const token of ["CREATE VIEW public.character_option_catalog_all_preferred",
 "CREATE VIEW public.character_option_catalog_preferred",
 "private.player_forge_source_choice_legacy_v1",
 "EXECUTE FUNCTION private.validate_player_forge_authority_payload_v1()",
 "DEFERRABLE INITIALLY DEFERRED FOR EACH ROW"]) {
 assert.ok(progressionExtension.includes(token),"Missing full source-aware progression fixture element: "+token);
}
for(const hash of ["c27c4181a51cfd018bbb8244e9931550","35cb3d6560ffde5a94b019a9f373f65d","30939673464de80a0791a89017d48065","c56af0b4f49f024a18baf396eeb2d1e2"]) {
 assert.ok(featSource.includes(hash) && featSetup.includes(hash),"Missing source-exact original feat grant function/hash "+hash);
}
for(const hash of ["3801761f8bc46c5af10fca5e5ae73e60","be000f9e6d6e129cb9505b110a1021ed"]) {
 assert.ok(featSupport.includes(hash) && featSetup.includes(hash),"Missing original feat family discriminator "+hash);
}
for(const token of ["CREATE TABLE public.character_option_grant_instances","CREATE TABLE public.character_option_grants","ENABLE ROW LEVEL SECURITY","materialize_player_forge_feat_instances_v1()","guard_direct_character_authority_mutation_v1()"]) {
 assert.ok(featSetup.includes(token),"Missing original feat materializer fixture contract "+token);
}
for(const token of [
 "CREATE FUNCTION private.seed_verified_forge_progression_creator_v1()",
 "BEFORE INSERT ON public.character_progression",
 "NEW.created_by := v_actor",
 "ca.creator_user_id",
 "ca.recorded_at=transaction_timestamp()",
 "cs.sheet #>> '{meta,creator}'",
 "'shared_character_forge_player_v2'",
 "auth.uid()",
 "'bb1a3a2d1600ce33cd4fcadac5e0f3a9'",
 "'c27c4181a51cfd018bbb8244e9931550'",
 "REVOKE ALL ON FUNCTION private.seed_verified_forge_progression_creator_v1()"
]) assert.ok(creatorSeed.includes(token),"Creator provenance research candidate missing "+token);
// Inspect executable SQL, not explanatory comments that explicitly say
// there is no FOR UPDATE or historical DML. A real lock clause still fails.
const creatorSeedExecutable=creatorSeed.split("\\n").filter(line=>
 !line.trimStart().startsWith("--")).join("\\n");
for(const unsafe of [
 "FOR UPDATE","FOR SHARE",
 "UPDATE public.character_option_grants",
 "UPDATE public.character_option_grant_instances",
 "ALTER TABLE public.character_progression",
 "GRANT EXECUTE ON FUNCTION private.seed_verified_forge_progression_creator_v1"
]) assert.ok(!creatorSeedExecutable.includes(unsafe),"Creator provenance candidate unexpectedly expands row locks/grants: "+unsafe);
assert.ok(gearExtension.includes("DEFERRABLE INITIALLY DEFERRED FOR EACH ROW"),
 "Original equipment trigger must remain deferred");
assert.ok(gearExtension.includes("EXECUTE FUNCTION private.sync_character_progression_from_sheet_v1()"),
 "Original sheet/progression trigger must be installed in supplemental slice");
for (const token of ["J10","J11","J12","J13","J14","J15","J16","J17","J18","J19","J20","J21","J22","J23","J24","J25","J26","J27","J28","J29","J30","J31","J32","J33","J34","J35","J36","J37","J38","J39","J40","J41","J42","J43","J44","J45","J46","J47","J48","J49","J50","J51","J52","J53","J54","J55","J56","J57","J58","J59","J60",
 "forge_materializer_local_auth_extension_pg17.sql","startingEquipmentSelections"])
 assert.ok(localAuth.includes(token), "Missing signed-in creation and gear regression "+token);
console.log("PASS source: original Admin/v2/v3 snapshots, v2/v3 source-pinned private wrappers with one PR319 snapshot safeguard, nonce fingerprint and authorization static contract.");

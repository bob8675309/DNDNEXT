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
const giRaceFixture=readFileSync("scripts/fixtures/forge_gi_cp_cs_local_jwt_race_pg17.sql","utf8");
const originalMerchantBuy=readFileSync("scripts/fixtures/forge_original_merchant_buy_source_pg17.sql","utf8");
const merchantWriterSetup=readFileSync("scripts/fixtures/forge_merchant_inventory_live_writer_local_auth_pg17.sql","utf8");



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
const creatorSeedExecutable=creatorSeed.split("\n").filter(line=>
 !line.trimStart().startsWith("--")).join("\n");
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
// Bounded actual original G/I concurrency: the timed wrappers are test-only
// and must never be mistaken for an owner-approved production lock design.
for(const token of [
 "private.materialize_player_forge_feat_instances_v1()",
 "private.materialize_player_forge_starting_equipment_v1(uuid)",
 "private.sync_character_progression_from_sheet_v1()",
 "c27c4181a51cfd018bbb8244e9931550",
 "653e1b9d7cc47dcff2cef33a674b97f4",
 "bb1a3a2d1600ce33cd4fcadac5e0f3a9",
 "test_forge_gear_cp_prelock_v1",
 "test_forge_sheet_note_hold_v1",
 "pg_advisory_xact_lock(9360,1)",
 "FOR UPDATE",
 "current_setting('p13.forge_gi_hold',true)",
 "SECURITY INVOKER",
 "NOTIFY pgrst,'reload schema'",
 "REVOKE ALL ON FUNCTION public.test_forge_gear_cp_prelock_v1"
]) assert.ok(giRaceFixture.includes(token),"Missing source-test-only G/I lock regression guard "+token);
for(const unsafe of ["ucggczovhmauhshvhusx","SUPABASE_SERVICE_ROLE_KEY",
 "CREATE TABLE public.character_option_grant_instances",
 "CREATE TABLE public.inventory_items"])
 assert.ok(!giRaceFixture.includes(unsafe),"G/I lock fixture must not replace canonical persisted source schema "+unsafe);
for(const j of ["J63","J64","J65","J66","J67","J68","J69"])
 assert.ok(localAuth.includes(j),"Missing genuine local JWT G/I concurrency assertion "+j);
assert.ok(localAuth.includes("40P01")&&localAuth.includes("giInstBefore")&&
 localAuth.includes("giInvBefore")&&localAuth.includes("independentVerified"),
 "G/I original source concurrency must preserve grant/inventory fingerprints and nonce retry");
for(const token of [
 "CREATE OR REPLACE FUNCTION public.buy_from_merchant(",
 "1dbe8c24c4c718396d7256f6f7465354",
 "from public.character_stock",
 "for update",
 "insert into public.player_wallets",
 "insert into public.inventory_items",
 "update public.character_stock",
 "delete from public.character_stock"
]) assert.ok(originalMerchantBuy.toLowerCase().includes(token.toLowerCase()),
 "Missing source-exact original stock/wallet/item purchase path: "+token);
for(const token of [
 "CREATE TABLE public.player_wallets","CREATE TABLE public.player_recipes",
 "ALTER TABLE public.character_stock","updated_at timestamptz",
 "scripts/fixtures/forge_original_merchant_buy_source_pg17.sql",
 "md5(pg_get_functiondef",
 "1dbe8c24c4c718396d7256f6f7465354",
 "REVOKE ALL ON FUNCTION public.buy_from_merchant",
 "GRANT EXECUTE ON FUNCTION public.buy_from_merchant",
 "NOTIFY pgrst,'reload schema'"
]) assert.ok(merchantWriterSetup.includes(token),
 "Missing isolated original merchant inventory writer source/ACL gate: "+token);
for(const token of ["J70","J71","J72","J73","J74","J75","J76","J77",
 "p13-inventory-concurrency-dagger","p13-inventory-concurrency-rope",
 "Not enough stock","Insufficient funds","Stock not found",
 "FOR UPDATE","oneRace","twoRace"])
 assert.ok(localAuth.includes(token),"Missing real JWT original I-write concurrency assertion "+token);
for(const forbidden of ["ucggczovhmauhshvhusx","SUPABASE_SERVICE_ROLE_KEY"]){
 assert.ok(!merchantWriterSetup.includes(forbidden)&&!originalMerchantBuy.includes(forbidden),
 "Merchant stock test fixtures must not contain production project/key references");
}
for (const token of ["J10","J11","J12","J13","J14","J15","J16","J17","J18","J19","J20","J21","J22","J23","J24","J25","J26","J27","J28","J29","J30","J31","J32","J33","J34","J35","J36","J37","J38","J39","J40","J41","J42","J43","J44","J45","J46","J47","J48","J49","J50","J51","J52","J53","J54","J55","J56","J57","J58","J59","J60","J61","J62",
 "forge_materializer_local_auth_extension_pg17.sql","startingEquipmentSelections"])
 assert.ok(localAuth.includes(token), "Missing signed-in creation and gear regression "+token);
console.log("PASS source: original Admin/v2/v3 snapshots, v2/v3 source-pinned private wrappers with one PR319 snapshot safeguard, nonce fingerprint and authorization static contract.");


const workflow=readFileSync(".github/workflows/validate-forge-immutable-creation-replay.yml","utf8");
const ownerHandlers=readFileSync("scripts/fixtures/forge_owner_constraint_original_inventory_handlers_pg17.sql","utf8");
const ownerSetup=readFileSync("scripts/fixtures/forge_owner_constraint_deferred_creation_local_auth_pg17.sql","utf8");
for(const [fn,md5] of [
 ["apply_structured_crafting_traits_v1","108bfc2599d75e7298f65ce326f16173"],
 ["apply_smithing_affinity_polish_v4","5d51cf335ff880939ae0df4c4152bdbd"]
]){
 assert.ok(ownerHandlers.includes("CREATE OR REPLACE FUNCTION private."+fn+"("),
 "Missing unmodified live original inventory trigger handler "+fn);
 assert.ok(ownerHandlers.includes(md5),"Live original inventory handler hash absent: "+fn);
 assert.ok(ownerSetup.includes(md5),"Runtime original inventory handler MD5 drift gate missing "+fn);
}
for(const token of [
 "current_database()<>'postgres'",
 "private.player_creation_intent_reservations_v1",
 "private.materialize_player_forge_starting_equipment_v1(uuid)",
 "23fa54dd0a6d7b42b802d613f39ea27c",
 "653e1b9d7cc47dcff2cef33a674b97f4",
 "inventory_items_owner_type_check",
 "inventory_items_owner_type_chk",
 "NOT VALID",
 "ADD CONSTRAINT",
 "t.tgdeferrable",
 "CREATE TRIGGER inventory_items_apply_structured_crafting_traits_v1",
 "CREATE TRIGGER zz_inventory_items_apply_smithing_affinity_polish_v4",
 "DO $gate$","DO $source$","DO $parity$"
]) assert.ok(ownerSetup.includes(token),"Missing owner CHECK/deferred original source safety gate: "+token);
for(const token of [
 "PASS J78","PASS J79","PASS J80","PASS J81","PASS J82","PASS J83","PASS J84",
 "blockedOwnerCreate","verifiedGrantPayload","call2(people.PLAYER.client,blockedOwnerCreate)",
 "DROP CONSTRAINT inventory_items_owner_type_chk",
 "ADD CONSTRAINT inventory_items_owner_type_chk",
 "23514","stateCounts","inventory_items_owner_type_chk",
 "grantFingerprint","aggFingerprint","rowFingerprint","PASS LOCAL REAL GoTrue J00-J84"
]) assert.ok(localAuth.includes(token),"Missing authenticated end-to-end original Forge owner CHECK case: "+token);
for(const path of [
 "forge_owner_constraint_original_inventory_handlers_pg17.sql",
 "forge_owner_constraint_deferred_creation_local_auth_pg17.sql"
])assert.ok(workflow.includes(path),"Workflow must trigger on new owner CHECK research fixture: "+path);
for(const unsafe of ["ucggczovhmauhshvhusx","SERVICE_ROLE_KEY","SUPABASE_SERVICE_ROLE_KEY"]){
 assert.ok(!ownerHandlers.includes(unsafe)&&!ownerSetup.includes(unsafe),
 "No production project IDs or privileged API keys allowed in owner CHECK scratch source");
}
for(const token of [
 'assert.match(blockedOld.error.message||"",/inventory_items_owner_type_chk/',
 'assert.match(blockedAgainResult.error.message||"",/inventory_items_owner_type_chk/'
]) assert.ok(localAuth.includes(token),"Test harness must pass an actual RegExp to Node assert.match: "+token);
assert.ok(localAuth.includes("gmNoGearPayload") &&
 localAuth.includes('rpc(people.ADMIN.client,"create_character_v1"') &&
 !localAuth.includes('noGearPayload=fighter('),
 "J80 control must use valid original GM non-Forge NPC RPC, not invalid unselected Forge package");
console.log("PASS STATIC J78-J84 source-original inventory handlers, exact old/new live owner-type CHECKs, signed creator deferred-COMMIT failure/clean rollback/scratch-only cause-control. DATABASE ACCEPTANCE MUST BE SEPARATE.");


const ownerPermissionOriginal=readFileSync("scripts/fixtures/forge_inventory_access_original_pg17.sql","utf8");
const ownerLiveRls=readFileSync("scripts/fixtures/forge_inventory_policy_source_local_auth_pg17.sql","utf8");
const ownerReviewCandidate=readFileSync("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql","utf8");
assert.ok(ownerPermissionOriginal.includes("CREATE OR REPLACE FUNCTION private.can_access_character_v1(") &&
 ownerPermissionOriginal.includes("97b5e6b059e6467e24c4283fe420c83e"),
 "J85+ source-original character inventory access helper fingerprint required");
for(const token of [
 "current_database()<>'postgres'",
 "inventory_items_owner_type_chk",
 "private.test_admins",
 "ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY",
 "CREATE POLICY inventory_items_insert_owner_or_admin",
 "CREATE POLICY inventory_items_select_owner_or_admin",
 "CREATE POLICY inventory_items_update_owner_or_admin",
 "CREATE POLICY inventory_items_delete_owner_or_admin",
 "GRANT SELECT,INSERT,UPDATE,DELETE ON public.inventory_items TO authenticated",
 "GRANT EXECUTE ON FUNCTION private.can_access_character_v1(uuid,text) TO authenticated",
 "NOTIFY pgrst,'reload schema'"
])assert.ok(ownerLiveRls.includes(token),"Missing original reduced live policy fixture "+token);
for(const token of [
 "NOT A MIGRATION","BEGIN;","COMMIT;","lock_timeout = '2s'",
 "DO $preflight$","DO $postflight$",
 "inventory_items_owner_type_chk","DROP CONSTRAINT inventory_items_owner_type_chk",
 "private.can_access_character_v1(owner_id::uuid, 'inventory')",
 "owner_id ~* '^[0-9a-f]{8}",
 "ALTER POLICY inventory_items_insert_owner_or_admin",
 "ALTER POLICY inventory_items_update_owner_or_admin",
 "ALTER POLICY inventory_items_delete_owner_or_admin",
 "ALTER POLICY inventory_items_select_owner_or_admin",
 "owner_type IS DISTINCT FROM 'character'",
 "97b5e6b059e6467e24c4283fe420c83e",
 "653e1b9d7cc47dcff2cef33a674b97f4"
])assert.ok(ownerReviewCandidate.includes(token),"Missing review candidate release guard "+token);
for(const token of [
 "PASS J85","PASS J86","PASS J87","PASS J88","PASS J89",
 "PASS J90","PASS J91","PASS J92","PASS J93",
 "sqlFile(\"sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql\")",
 "public.inventory_items WHERE id","revokedInventory",
 "directForbidden","blockedConversion","secureForge",
 "adminAssigned","PASS LOCAL REAL GoTrue J00-J93"
])assert.ok(localAuth.includes(token),"Missing signed-in RLS acceptance "+token);
for(const path of [
 "forge_inventory_access_original_pg17.sql",
 "forge_inventory_policy_source_local_auth_pg17.sql",
 "20261105_inventory_character_owner_constraint_and_dml_review_v1.sql"
])assert.ok(workflow.includes(path),"CI must follow owner security fixture "+path);
for(const unsafe of ["ucggczovhmauhshvhusx","SUPABASE_SERVICE_ROLE_KEY","SERVICE_ROLE_KEY"]){
 assert.ok(!ownerReviewCandidate.includes(unsafe)&&!ownerLiveRls.includes(unsafe)&&
 !ownerPermissionOriginal.includes(unsafe),"Forbidden production project or API key "+unsafe);
}
assert.ok(ownerReviewCandidate.includes("IF NOT EXISTS (") &&
 !ownerReviewCandidate.includes("v_old record") &&
 !ownerReviewCandidate.includes("definition INTO"),
 "J85+ guard uses catalog EXISTS, not error-prone SELECT INTO record alias");
// Catch SQL string-generation hazards before spending a free GoTrue CI run.
// In particular, using String.replace with a replacement containing "$'"
// can splice the original suffix into a UUID regex and duplicate migration DDL.
const onlyOne=(pattern,description,expected)=>assert.equal(
 (ownerReviewCandidate.match(pattern)||[]).length,expected,description);
onlyOne(/^BEGIN;$/gm,"Owner candidate must have one transaction BEGIN",1);
onlyOne(/^COMMIT;$/gm,"Owner candidate must have one transaction COMMIT",1);
onlyOne(/^DO \$preflight\$$/gm,"One source preflight DO block",1);
onlyOne(/^DO \$postflight\$$/gm,"One source postflight DO block",1);
onlyOne(/^END \$postflight\$;$/gm,"One postflight DO terminator",1);
onlyOne(/^ALTER TABLE public\.inventory_items DROP CONSTRAINT inventory_items_owner_type_chk;$/gm,
 "Only one obsolete CHECK DROP",1);
onlyOne(/^ALTER POLICY inventory_items_/gm,"Exactly four inventory policy mutations",4);
onlyOne(/^ALTER POLICY inventory_items_select_owner_or_admin/gm,
 "Exactly one SELECT policy mutation",1);
assert.ok(ownerReviewCandidate.includes("owner_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'"),
 "Full guarded UUID regex required; no string-substitution truncation");
const afterOwnerCommit=ownerReviewCandidate.slice(
 ownerReviewCandidate.indexOf("\nCOMMIT;")+"\nCOMMIT;".length).trim();
assert.ok(afterOwnerCommit.startsWith("-- NOT IN THIS CANDIDATE") &&
 !/\bALTER POLICY\b|\bDO \$postflight\$/.test(afterOwnerCommit),
 "No executable DDL or duplicate postflight SQL after COMMIT");

console.log("PASS STATIC J85-J93 exact source character authorization helper, live four RLS policies, guarded combined owner CHECK and policy review SQL, original JWT insert/update/read/revocation/Admin and creation checks (runtime separate).");

const sourceCash=readFileSync("scripts/fixtures/forge_market_cash_original_functions_pg17.sql","utf8");
const sourceMarket=readFileSync("scripts/fixtures/forge_v3_market_source_local_auth_extension_pg17.sql","utf8");
for(const [name,hash] of [
 ["private.player_forge_cash_equipment_option_v1","78231b02e56477cedd90992e42826597"],
 ["private.format_copper_currency_v1","f7f8dce93e3d20a5c35fccee0bcf374b"]
]){
 assert.ok(sourceCash.includes("CREATE OR REPLACE FUNCTION "+name+"("),"Missing unchanged source cash helper: "+name);
 assert.ok(sourceCash.includes(hash)&&sourceMarket.includes(hash),"Missing source cash/format live MD5 gate: "+name);
}
for(const t of [
 "current_database()<>'postgres'","private.test_admins",
 "public.create_player_character_v3(jsonb,jsonb,jsonb)",
 "653e1b9d7cc47dcff2cef33a674b97f4",
 "startingEquipment","class_key='fighter'","source='XPHB'",
 "dndnext-homebrew","NOTIFY pgrst,'reload schema'",
 "v_cash->>'key'<>'C'","<>15500"
])assert.ok(sourceMarket.includes(t),"Missing J94 original source market gate "+t);
for(let i=94;i<=102;i++){
 const t="PASS J"+i;
 assert.ok(localAuth.includes(t),"Missing live JWT source market test "+t);
}
for(const t of [
 "call3(who.client,payload,[])",
 "marketPurchases","merchantId","stockId",
 "getStock(marketStock)","rowFingerprint",
 "source_breakdown->>'marketBudgetCopper'",
 "Recipes are not starting-equipment purchases",
 "Not enough stock remains","PASS LOCAL REAL GoTrue J00-J102"
])assert.ok(localAuth.includes(t),"Missing original market test assertion "+t);
for(const path of [
 "forge_market_cash_original_functions_pg17.sql",
 "forge_v3_market_source_local_auth_extension_pg17.sql",
 "validate_forge_inventory_ui_release_contract.mjs"
])assert.ok(workflow.includes(path),"Missing Vercel-free workflow change for source market path "+path);
for(const unsafe of ["ucggczovhmauhshvhusx","SERVICE_ROLE_KEY","SUPABASE_SERVICE_ROLE_KEY"]){
 assert.ok(!sourceCash.includes(unsafe)&&!sourceMarket.includes(unsafe),"Live credentials forbidden in J94");
}
assert.ok(localAuth.includes('draft.sheet.background="Soldier"') &&
 localAuth.includes('draft.sheet.meta={backgroundSource:"XPHB"}') &&
 localAuth.includes('backgroundId:id(9150)'),
 "J94+ market input must satisfy unchanged original sheet Background name/source/ID validator (J17 fixture)");
console.log("PASS STATIC J94-J102 source-original Fighter C cash alternative, unchanged market/formatter helpers, real JWT source v3 and hardened RLS acceptance contract. Browser execution remains a separate gate.");



const highRiskOriginal=readFileSync("scripts/fixtures/forge_high_risk_original_progression_triggers_pg17.sql","utf8");
const highRiskFixture=readFileSync("scripts/fixtures/forge_high_risk_progression_local_auth_pg17.sql","utf8");
for(const [fn,hash] of [
 ["materialize_player_forge_source_magic_v1","4c35eaab8dff7d3d15b64ed71881d4a6"],
 ["validate_and_materialize_player_forge_class_options_v1","6df5aee6f0519c9c77758d6e887ed8e4"],
 ["validate_player_forge_starting_magic_exactness_v1","ba645ad0f2c17addad0b40e0602c2ac8"]
]){
 assert.ok(highRiskOriginal.includes("CREATE OR REPLACE FUNCTION private."+fn+"("),
 "J103 original trigger source body absent: "+fn);
 assert.ok(highRiskOriginal.includes(hash)&&highRiskFixture.includes(hash),
 "J103 original trigger pg_get_functiondef fingerprint gate missing: "+fn);
}
for(const token of [
 "current_database()<>'postgres'",
 "private.test_admins",
 "player_creation_intent_reservations_v1",
 "character_option_grant_instances",
 "CREATE TABLE public.class_feature_option_catalog",
 "CREATE TABLE public.character_class_option_grant_instances",
 "NOT a database migration",
 "DEFERRABLE INITIALLY DEFERRED",
 "CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_source_magic_v1",
 "CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_class_options_v1",
 "CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_starting_magic_exac",
 "AND tgenabled='O' AND tgdeferrable AND tginitdeferred)<>3"
])assert.ok(highRiskFixture.includes(token),"Missing J103 source trigger/staging safety gate "+token);
for(let i=103;i<=108;i++)
 assert.ok(localAuth.includes("PASS J"+i),"Missing J103–J108 authentic acceptance "+i);
for(const token of [
 "invalidClass.error.message","invalidMagic.error.message",
 "Eldritch Invocation source choices are only valid for an XPHB Warlock",
 "Unsupported Forge source-magic owner type alchemy",
 "source_market","marketDraft","threeTriggerFighter",
 "triggerAbortCounts","PASS LOCAL REAL GoTrue J00-J108"
])assert.ok(localAuth.includes(token) || (token==="source_market"&&localAuth.includes("sourceMarketCharacter")),
 "Missing high-risk regression contract: "+token);
for(const path of [
 "forge_high_risk_original_progression_triggers_pg17.sql",
 "forge_high_risk_progression_local_auth_pg17.sql"
])assert.ok(workflow.includes(path),"Missing high-risk original workflow path: "+path);
for(const unsafe of ["ucggczovhmauhshvhusx","SERVICE_ROLE_KEY","SUPABASE_SERVICE_ROLE_KEY"]){
 assert.ok(!highRiskOriginal.includes(unsafe) && !highRiskFixture.includes(unsafe),
 "Production project or privileged key forbidden in scratch source");
}
console.log("PASS STATIC J103–J108 original live source handler fingerprints and deferred trigger timing, real JWT v2/v3 positive and source-choice negative contract. Not full 31-trigger parity.");

const warlockHelpers=readFileSync("scripts/fixtures/forge_warlock_invocation_original_slot_helpers_pg17.sql","utf8");
const warlockStage=readFileSync("scripts/fixtures/forge_warlock_invocation_positive_local_auth_pg17.sql","utf8");
for(const [fn,hash] of [
 ["xphb_warlock_invocation_count_v1","61c83f0172b33386f0a50435c2fe1ddb"],
 ["xphb_warlock_invocation_slot_level_v1","942dd3a4e08b8874f3e42cbbb8323038"]
]){
 assert.ok(warlockHelpers.includes("CREATE OR REPLACE FUNCTION private."+fn+"("),
 "J109 original live Warlock helper body missing "+fn);
 assert.ok(warlockHelpers.includes(hash)&&warlockStage.includes(hash),
 "J109 live original helper PG17 MD5 gate missing "+fn);
}
for(const token of [
 "current_database()<>'postgres'",
 "private.test_admins",
 "private.player_creation_intent_reservations_v1",
 "public.character_class_option_grant_instances",
 "character_progression_validate_player_forge_class_options_v1",
 "6df5aee6f0519c9c77758d6e887ed8e4",
 "INSERT INTO public.class_catalog",
 "INSERT INTO public.class_feature_option_catalog",
 "3abe1beb-5669-46a8-9743-49a47b8de126",
 "391a8820-aea1-495a-a532-05f9811b14d4",
 "c6f61c62-d36c-4a9b-b44a-cbafd4ff47d0",
 "6792abd0-1fd9-44fb-ae4c-56c307ab791a",
 "v_cash->>'key'<>'B'","<>10000",
 "NOTIFY pgrst,'reload schema'"
])assert.ok(warlockStage.includes(token),"J109 source Warlock fixture gate missing "+token);
for(let i=109;i<=116;i++)assert.ok(localAuth.includes("PASS J"+i),"Missing real JWT J109–J116 contract "+i);
for(const token of [
 "warlockInvocationSlot",
 "warlock-invocation-slot-1",
 "optional-feature:armor-of-shadows|XPHB",
 "optional-feature:devils-sight|XPHB",
 "optional-feature:eldritch-mind|XPHB",
 "v3market(approvedWarlock)",
 "Source-original signed Warlock",
 "character_class_option_grant_instances",
 "Warlock level 1 requires exactly 1",
 "not available at the acquisition level",
 "permanent dependent creation choice",
 "PASS LOCAL REAL GoTrue J00-J116"
])assert.ok(localAuth.includes(token),"Missing original authenticated Warlock positive/negative proof "+token);
for(const file of [
 "forge_warlock_invocation_original_slot_helpers_pg17.sql",
 "forge_warlock_invocation_positive_local_auth_pg17.sql"
])assert.ok(workflow.includes(file),"GitHub Actions must re-run on Warlock fixture "+file);
for(const token of ["ucggczovhmauhshvhusx","SUPABASE_SERVICE_ROLE_KEY","SERVICE_ROLE_KEY"])
 assert.ok(!warlockHelpers.includes(token) && !warlockStage.includes(token),
 "No live project id or secret embedded in disposable Warlock source");
console.log("PASS STATIC J109–J116 source-original Warlock level-1 invocation count and catalog, true JWT v3 positive/negative, nonce, G/GI/I/C/S contract; full browser remains a separate gate.");

const originalSpeciesLight=readFileSync("scripts/fixtures/forge_species_light_original_helpers_pg17.sql","utf8");
const speciesLightFixture=readFileSync("scripts/fixtures/forge_species_light_positive_local_auth_pg17.sql","utf8");
for(const [func,hash] of [
 ["player_forge_best_casting_ability_v1","3dce158c3dfe14ff6776855b1ead5022"],
 ["player_forge_json_spell_min_level_v1","c6770a82adc7ee3b79151262474b7aed"],
 ["player_forge_species_spell_choice_limit_v1","c9bc6081a43c52c44c1cf192886456df"],
 ["player_forge_trait_has_spell_v1","deb38940c6249808a39aeb2380e09c16"],
 ["upsert_player_forge_source_magic_spell_v1","2a880d642809146678bd391304d9777c"]
]){
 assert.ok(originalSpeciesLight.includes("CREATE OR REPLACE FUNCTION private."+func+"("),
  "Missing exact original live positive species-magic helper: "+func);
 assert.ok(originalSpeciesLight.includes(hash)&&speciesLightFixture.includes(hash),
  "Missing MD5 live original helper guard: "+func);
}
for(const token of [
 "current_database()<>'postgres'",
 "private.test_admins",
 "public.create_player_character_v3(jsonb,jsonb,jsonb)",
 "4c35eaab8dff7d3d15b64ed71881d4a6",
 "ADD COLUMN uses_max integer",
 "ADD COLUMN uses_remaining integer",
 "ADD COLUMN recharge text",
 "8a29f32a-0695-4aed-b968-9e1616c47a15",
 "species:aasimar|XPHB",
 "Light Bearer",
 "{@spell Light|XPHB}",
 "2b78bd2c-8d8f-4891-814d-a19631bb6b9f",
 "private.player_forge_trait_has_spell_v1(v_trait,'Light')",
 "NOTIFY pgrst,'reload schema'"
])assert.ok(speciesLightFixture.includes(token),"Missing source-positive Aasimar fixture gate: "+token);
for(let i=117;i<=124;i++)assert.ok(localAuth.includes("PASS J"+i),
 "Missing genuine source-positive species JWT runtime contract J"+i);
for(const token of [
 "species-light-bearer",
 "lightSourceGroup",
 "source_type='species'",
 "raw_payload->>'sourceOptionId'",
 "observedCastingStat",
 "KNOWN SOURCE GAP",
 "15000",
 "speciesAbortCounts",
 "Fire Bolt is not granted by species feature Light Bearer",
 "Species feature Light Bearer requires all 1",
 "PASS LOCAL REAL GoTrue J00-J124"
])assert.ok(localAuth.includes(token),"Missing source-magic acceptance assertion: "+token);
for(const f of [
 "forge_species_light_original_helpers_pg17.sql",
 "forge_species_light_positive_local_auth_pg17.sql"
])assert.ok(workflow.includes(f),"CI must re-run source-positive species test on path "+f);
for(const unsafe of ["ucggczovhmauhshvhusx","SUPABASE_SERVICE_ROLE_KEY","SERVICE_ROLE_KEY"]){
 assert.ok(!originalSpeciesLight.includes(unsafe)&&!speciesLightFixture.includes(unsafe),
 "No production project ID or secret in source-positive species fixtures");
}
console.log("PASS STATIC J117–J124 original source species Light Bearer and five helper MD5s, real JWT positive/negative, nonce, deferred spell source/I/C/S, explicit casting ability release gap.");


// J125–J132: source-original character tag guard with disposable authenticated JWTs.
const originalCharacterTagGuard=readFileSync("scripts/fixtures/forge_characters_tag_guard_original_pg17.sql","utf8");
const localCharacterTagGuard=readFileSync("scripts/fixtures/forge_characters_tag_guard_local_auth_pg17.sql","utf8");
assert.ok(originalCharacterTagGuard.includes("CREATE OR REPLACE FUNCTION private.guard_player_character_tag_update_v1()"));
assert.ok(originalCharacterTagGuard.includes("b8b0008a718de1aa3e74d66b30f1a679"));
for(const token of [
 "pg_trigger_depth() = 1","auth.uid() is not null",
 "not private.current_user_is_admin()",
 "Player character tags are managed by campaign authority.","errcode = '42501'"
])assert.ok(originalCharacterTagGuard.includes(token),"Original tag guard body changed: "+token);
for(const token of [
 "current_database()<>'postgres'","170000 AND 179999",
 "private.test_admins","private.sync_player_character_tags_from_sheet_v1",
 "md5(pg_get_functiondef('private.guard_player_character_tag_update_v1()'",
 "b8b0008a718de1aa3e74d66b30f1a679",
 "BEFORE UPDATE OF tags ON public.characters",
 "EXECUTE FUNCTION private.guard_player_character_tag_update_v1()",
 "ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY",
 "CREATE POLICY j125_characters_update_tags_editor",
 "NOTIFY pgrst,'reload schema'"
])assert.ok(localCharacterTagGuard.includes(token),"Original guard or local fixture safety gate missing: "+token);
for(let i=125;i<=132;i++)
 assert.ok(localAuth.includes("PASS J"+i),"Missing signed-in guard acceptance J"+i);
for(const token of [
 "originalTagResources","taggedId","people.PLAYER.client",
 "people.ADMIN.client","people.OUTSIDER.client","makeClient()",
 "sheetWrite","42501","campaign:gm-approved","campaign:keepers",
 "PASS LOCAL REAL GoTrue J00-J132"
])assert.ok(localAuth.includes(token),"Signed-in tag guard coverage missing: "+token);
for(const file of ["forge_characters_tag_guard_original_pg17.sql",
                    "forge_characters_tag_guard_local_auth_pg17.sql"])
 assert.ok(workflow.includes(file),"CI path trigger for new original guard fixture missing: "+file);
for(const forbidden of ["ucggczovhmauhshvhusx","SUPABASE_SERVICE_ROLE_KEY","SERVICE_ROLE_KEY"])
 assert.ok(!originalCharacterTagGuard.includes(forbidden)&&!localCharacterTagGuard.includes(forbidden),
  "Original tag guard fixture contains forbidden live identifier or credential");
console.log("PASS STATIC J125-J132 original source/MD5, trigger timing, reduced local RLS and genuine JWT test contract; no production or full RLS parity.");


// J133–J141: source-original character portrait library ID synchronization.
const portraitSource=readFileSync("scripts/fixtures/forge_characters_portrait_sync_original_pg17.sql","utf8");
const portraitStage=readFileSync("scripts/fixtures/forge_characters_portrait_sync_local_auth_pg17.sql","utf8");
for(const token of [
 "CREATE OR REPLACE FUNCTION private.sync_character_portrait_library_id_v1()",
 "74cb0bf9d7a614a860344f12cf787e05",
 "new.portrait_library_id := null",
 "new.portrait_library_id := v_match",
 "p.storage_path = new.portrait_storage_path",
 "p.public_url = new.portrait_url",
 "p.sort_order, p.name"
])assert.ok(portraitSource.includes(token),"Original portrait library sync source changed: "+token);
for(const token of [
 "current_database()<>'postgres'","170000 AND 179999",
 "private.test_admins","public.npc_portrait_library",
 "md5(pg_get_functiondef('private.sync_character_portrait_library_id_v1()'",
 "74cb0bf9d7a614a860344f12cf787e05",
 "ADD COLUMN name text NOT NULL DEFAULT 'local-fixture'",
 "ADD COLUMN sort_order integer NOT NULL DEFAULT 0",
 "BEFORE INSERT OR UPDATE OF portrait_storage_path, portrait_url, portrait_source ON public.characters",
 "EXECUTE FUNCTION private.sync_character_portrait_library_id_v1()",
 "GRANT UPDATE(portrait_source,portrait_storage_path,portrait_url)",
 "NOTIFY pgrst,'reload schema'"
])assert.ok(portraitStage.includes(token),"Original portrait acceptance fixture missing: "+token);
for(let i=133;i<=141;i++)
 assert.ok(localAuth.includes("PASS J"+i),"Missing original portrait signed JWT acceptance J"+i);
for(const token of [
 "portraitASet","conflictingUrl","urlOnly","inactiveOnly","nonLibrary",
 "gmPortrait","outsiderPortrait","anonPortrait","portraitOwnedBefore",
 "portraitOwnedAfter","PASS LOCAL REAL GoTrue J00-J141"
])assert.ok(localAuth.includes(token),"Missing signed-in portrait source test "+token);
for(const file of [
 "forge_characters_portrait_sync_original_pg17.sql",
 "forge_characters_portrait_sync_local_auth_pg17.sql"
])assert.ok(workflow.includes(file),"PR CI does not watch portrait fixture "+file);
for(const forbidden of ["ucggczovhmauhshvhusx","SUPABASE_SERVICE_ROLE_KEY","SERVICE_ROLE_KEY"])
 assert.ok(!portraitSource.includes(forbidden)&&!portraitStage.includes(forbidden),
  "Original portrait fixture contains live project identifier/secret");
console.log("PASS STATIC J133-J141 original portrait source, MD5, trigger timing, reduced catalog, authenticated JWT tests; production ACL/browser remain separate.");


// J142-J153: original source-exact Fighter subclass timing, edition and real JWT fixture.
const subclassOriginal=readFileSync("scripts/fixtures/forge_subclass_choice_original_pg17.sql","utf8");
const subclassStage=readFileSync("scripts/fixtures/forge_subclass_choice_local_auth_pg17.sql","utf8");
assert.ok(subclassOriginal.includes("CREATE OR REPLACE FUNCTION private.apply_character_forge_subclass_choice_v1()"));
assert.ok(subclassOriginal.includes("273be29420a7274d997642e302604cb7"));
for(const token of [
 "v_creator = 'shared_character_forge_player_v2'",
 "new.class_level >= v_first_available_level",
 "raise exception 'Choose a subclass",
 "v_requested_name",
 "v_requested_source",
 "v_subclass_name",
 "v_subclass_source",
 "new.level_choices",
 "'startingSubclass'"
]) assert.ok(subclassOriginal.includes(token),"Original subclass source drift "+token);
for(const token of [
 "current_database()<>'postgres'",
 "170000 AND 179999",
 "private.player_creation_intent_reservations_v1",
 "private.guard_player_character_tag_update_v1()",
 "private.sync_character_portrait_library_id_v1()",
 "ADD COLUMN level_choices jsonb NOT NULL DEFAULT '{}'::jsonb",
 "'subclass:fighter:xphb:champion:champion:xphb:3'",
 "'subclass:fighter:phb:champion:champion:phb:3'",
 "md5(pg_get_functiondef('private.apply_character_forge_subclass_choice_v1()'",
 "273be29420a7274d997642e302604cb7",
 "BEFORE INSERT ON public.character_progression",
 "EXECUTE FUNCTION private.apply_character_forge_subclass_choice_v1()",
 "NOTIFY pgrst,'reload schema'"
])assert.ok(subclassStage.includes(token),"Original subclass fixture safety/fidelity missing "+token);
for(let i=142;i<=153;i++)
 assert.ok(localAuth.includes("PASS J"+i),"Original subclass signed-JWT case missing J"+i);
for(const token of [
 "subclassDraft","originalSubclassReject","people.PLAYER.client","people.OUTSIDER.client",
 "Choose a subclass for fighter level 3","subclassSource",
 "level_choices#>>'{startingSubclass,creator}'","speciesAbortCounts",
 "replayBefore","PASS LOCAL REAL GoTrue J00-J153"
])assert.ok(localAuth.includes(token),"Original subclass JWT acceptance contract missing "+token);
for(const file of ["forge_subclass_choice_original_pg17.sql","forge_subclass_choice_local_auth_pg17.sql"])
 assert.ok(workflow.includes(file),"PR CI missing subclass path "+file);
for(const forbidden of ["ucggczovhmauhshvhusx","SUPABASE_SERVICE_ROLE_KEY","SERVICE_ROLE_KEY"])
 assert.ok(!subclassOriginal.includes(forbidden)&&!subclassStage.includes(forbidden),
 "Original subclass fixture cannot include deployed project or privileged token");
console.log("PASS STATIC J142-J153 original subclass source-hash, before-insert trigger, reduced PHB/XPHB catalog and real signed JWT tests; full edition policy, permission graph and browser UNPROVEN.");

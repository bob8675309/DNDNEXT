#!/usr/bin/env node
// Static source-integrity and scope guard, NOT concurrent database acceptance.
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
const original=read("scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql");
const setup=read("scripts/fixtures/p1_3_levelup_v5_local_auth_pg17.sql");
const runner=read("scripts/test_p1_3_levelup_v5_real_jwt_local.mjs");
const workflow=read(".github/workflows/validate-p1-3-levelup-v5-auth-locks.yml");
const originalHashes=[
 ["public.complete_character_level_up_v5","02d74b973a763c53c595be20e35e512f"],
 ["public.complete_character_level_up_v4","f8338ef170c6e27b972e777eeae406b8"],
 ["public.complete_character_level_up_v3","4467e166234c67fc12dd73da0e46b379"],
 ["private.complete_character_level_up_base_v3","e33639d549ef557976a3970ea51f5238"],
 ["private.can_manage_character_progression_v1","ac70e4ec033d86c4e0a254d50d429a45"],
 ["private.sync_player_forge_class_spell_summary_v1","5b1b275a268a57591a2e35a05ce7480d"],
 ["private.sync_character_progression_from_sheet_v1","bb1a3a2d1600ce33cd4fcadac5e0f3a9"]
];
for(const [name,md5] of originalHashes){
 assert.ok(original.includes("CREATE OR REPLACE FUNCTION "+name+"("),"Missing exact original "+name);
 assert.ok(original.includes(md5),"Missing original source fingerprint "+name);
 assert.ok(setup.includes(md5),"Runtime PG17 source-hash drift gate missing "+name);
}
for(const token of [
 "private.p13_only_plain_fighter","private.p13_only_empty",
 "Fighter level 2","private.p13_sheet_hold_after_update",
 "CREATE TRIGGER sync_character_progression_from_sheet_v1",
 "AFTER INSERT OR UPDATE OF sheet",
 "SECURITY INVOKER","ENABLE ROW LEVEL SECURITY",
 "character_permissions","GRANT SELECT,UPDATE(sheet,updated_at)",
 "p13_test_levelup_cp_prelock_v1","pg_advisory_xact_lock(9313,1)",
 "NOTIFY pgrst,'reload schema'"])
 assert.ok(setup.includes(token),"Missing guarded local source fixture: "+token);
for(const token of ["PASS F07","PASS F08","PASS F09","PASS F10",
 "40P01","@supabase/supabase-js",
 "auth.getClaims","complete_character_level_up_v5",
 "p13_test_sheet_edit_hold_v1","p13_test_levelup_cp_prelock_v1",
 "observedPrelock","40P01",
 "character_level_events","character_level_up_sessions"])
 assert.ok(runner.includes(token),"Missing real JWT source-levelup test assertion: "+token);
for(const unsafe of ["ucggczovhmauhshvhusx","SUPABASE_SERVICE_ROLE_KEY","SERVICE_ROLE_KEY"]){
 for(const [label,s] of [["source",original],["fixture",setup],["runner",runner],["workflow",workflow]]){
  assert.ok(!s.includes(unsafe),"Forbidden production/auth secret reference in "+label);
 }
}
assert.ok(workflow.includes("supabase@2.120.0"),"Supabase CLI version should stay pinned to installed legacy Auth CI");
assert.ok(workflow.includes("PGPORT: '54322'"),"This suite must use the disposable local Auth-only port");
assert.ok(workflow.includes("stop --no-backup"),"Scratch users and data must be destroyed after completion");
console.log("PASS STATIC P1.3: seven original levelup/sheet source hashes, scoped Fighter-only helper stubs, real JWT + RLS, observable test-only CP advisory prelock and two-session 40P01; NOT runtime acceptance.");

const grantSource=read("scripts/fixtures/p1_3_admin_grant_original_source_pg17.sql");
const grantExtension=read("scripts/fixtures/p1_3_admin_grant_levelup_extension_pg17.sql");
for(const [name,md5] of [
 ["private.current_user_is_admin","1fc5fbcb121b2862eeab869edfb3a209"],
 ["public.is_admin","629e70fee675bf18f353a19d807e4416"],
 ["private.guard_direct_character_authority_mutation_v1","04596b0a3fdfb71c1b357056e8c6023b"],
 ["private.sync_admin_feature_array_v1","f2b6190ecc9400772e054892f63cdc47"],
 ["public.grant_character_option_v1","aa0f6a0c6c6a6f2b9aacf57bd40e434c"]
]){
 assert.ok(grantSource.includes("CREATE OR REPLACE FUNCTION "+name+"("),"Missing original grant source "+name);
 assert.ok(grantSource.includes(md5),"Missing grant original MD5 "+name);
 assert.ok(grantExtension.includes(md5),"Missing runtime drift check for original grant "+name);
}
for(const token of ["private.p13_admin_grant_cs_hold_probe_v1","pg_advisory_xact_lock(9314,1)",
 "p13_test_grant_race_levelup_prelock_v1","pg_advisory_xact_lock(9315,1)",
 "public.grant_character_option_v1(uuid,uuid,text)","RLS parity","ENABLE ROW LEVEL SECURITY"])
 assert.ok(grantExtension.includes(token),"Missing guarded Admin G fixture token "+token);
for(const token of ["PASS F11","PASS F12","PASS F13","PASS F14","PASS F15","PASS F16",
 "grant_character_option_v1","auth.getClaims","gFailures","gGrantResult.error","gc(aRace)","gb(aRace)"])
 assert.ok(runner.includes(token),"Missing actual authenticated G/CP/CS assertion "+token);
for(const token of ["p1_3_admin_grant_original_source_pg17.sql","p1_3_admin_grant_levelup_extension_pg17.sql"])
 assert.ok(workflow.includes(token),"Workflow missing Admin G concurrency coverage path "+token);
for(const unsafe of ["ucggczovhmauhshvhusx","SUPABASE_SERVICE_ROLE_KEY","SERVICE_ROLE_KEY"]){
 assert.ok(!grantSource.includes(unsafe)&&!grantExtension.includes(unsafe),"No production secret/project refs allowed in G fixture");
}
console.log("PASS STATIC P1.3 Admin G F11-F16: exact original grant/guard/source hash declarations, scratch-only timed CS/CP probes, true JWT test cases present (NOT DB acceptance).");

const level4Source=read("scripts/fixtures/p1_3_level4_advancement_original_pg17.sql");
const level4Setup=read("scripts/fixtures/p1_3_level4_advancement_extension_pg17.sql");
for(const [name,hash] of [
 ["private.apply_character_level_advancement_v1","46dd0af4f6ca816422a75e91a292c634"],
 ["private.level_up_advancement_option_id_v1","ee7e6204a499abfe69aaa0c7f304aed2"],
 ["private.level_up_ability_increases_v1","6ac310ae1358a3e827e6b15446d3d5f0"],
 ["private.materialize_level_up_advancement_spells_v1","805b8ea43cdc2b9e4f88f7adb637f0fb"],
 ["private.character_option_prerequisites_met_v1","21f370cac373521d64a55eebbd61d1bd"],
 ["private.level_has_feature_v1","7616660880fb69db21c4d9b2416c1694"],
 ["private.resolve_subclass_choice_v1","df25069121f0889de0574e0a28151301"],
 ["private.materialize_boon_energy_resistance_instance_v1","35cb3d6560ffde5a94b019a9f373f65d"],
 ["private.materialize_cartomancer_instance_v1","30939673464de80a0791a89017d48065"],
 ["private.materialize_feat_runtime_expertise_instance_v1","c56af0b4f49f024a18baf396eeb2d1e2"]
]){
 assert.ok(level4Source.includes("CREATE OR REPLACE FUNCTION "+name+"("),"Missing source-original level4 function "+name);
 assert.ok(level4Source.includes(hash),"Missing original level4 MD5 "+name);
 assert.ok(level4Setup.includes(hash),"Missing original-source level4 runtime MD5 drift gate "+name);
}
for(const token of ["p13_test_level4_advancement_cp_prelock_v1","pg_advisory_xact_lock(9316,1)",
 "private.p13_only_plain_fighter","'Champion'","Ability Score Improvement",
 "character_option_catalog_preferred","character_option_grant_instances_character_id_instance_key_key",
 "CREATE TRIGGER character_option_grant_instance_feat_runtime_expertise_v1",
 "RLS","DO $source_check$","DO $acl$"])
 assert.ok(level4Setup.includes(token),"Missing reduced source-backed Fighter Lv4 setup "+token);
for(const token of ["PASS F17","PASS F18","PASS F19","PASS F20","PASS F21",
 "asiChoice","gCount(l4Race","giCount(l4Race","pg_locks","40P01",
 "character_option_grant_instances","level4(owner,l4Solo)","by(l4Race,asiOption",
 "assert.equal(giCount(l4Race),1)"])
 assert.ok(runner.includes(token) || (token==="pg_locks"&&runner.includes("pollMarker")),
 "Missing signed-in player earned G assertions "+token);
for(const path of ["p1_3_level4_advancement_original_pg17.sql","p1_3_level4_advancement_extension_pg17.sql"])
 assert.ok(workflow.includes(path),"No CI trigger for "+path);
for(const unsafe of ["ucggczovhmauhshvhusx","SUPABASE_SERVICE_ROLE_KEY","SERVICE_ROLE_KEY"]){
 assert.ok(!level4Source.includes(unsafe)&&!level4Setup.includes(unsafe),"Forbidden live project or secret in Lv4 scratch fixture");
}
console.log("PASS STATIC P1.3 F17-F21 original live source/MD5, signed-in Fighter Lv4 ASI G/GI grant + Admin G race, scoped reductions only (NOT runtime acceptance).");

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
 "NOTIFY pgrst,'reload schema'"])
 assert.ok(setup.includes(token),"Missing guarded local source fixture: "+token);
for(const token of ["PASS F07","PASS F08","PASS F09","PASS F10",
 "40P01","@supabase/supabase-js",
 "auth.getClaims","complete_character_level_up_v5",
 "p13_test_sheet_edit_hold_v1",
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
console.log("PASS STATIC P1.3: seven original levelup/sheet source hashes, scoped Fighter-only helper stubs, real JWT + RLS fixture and two-session 40P01 test; NOT runtime acceptance.");

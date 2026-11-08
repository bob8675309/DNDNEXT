#!/usr/bin/env node
// C3R: non-production, pre-commit transaction abort proof for actual stage 1-3.
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const expected={GITHUB_ACTIONS:"true",CI:"true",DNDNEXT_C33_FORGE_PRIVACY_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_ONLY",PGHOST:"127.0.0.1",PGPORT:"54322",PGDATABASE:"postgres"};
for(const [key,value] of Object.entries(expected)) assert.equal(process.env[key],value,"Refuse unsafe C3R execution "+key);
const run=(source,negative=false)=>{
 const p=spawnSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1"],{input:source,env:{...process.env,PGUSER:"postgres"},encoding:"utf8",timeout:30000});
 if(p.error) throw p.error;
 if(negative){assert.notEqual(p.status,0,"Deliberate late failure did not abort");assert.match(p.stderr,/division by zero/i);}
 else assert.equal(p.status,0,"C3R PG17 SQL failure "+p.stderr);
 return p.stdout.trim();
};
const query=(q)=>run(q+";\n");
function unwrapped(file){
 let s=fs.readFileSync(file,"utf8");
 assert.equal((s.match(/^BEGIN;$/gm)||[]).length,1,"Unexpected candidate BEGIN: "+file);
 assert.equal((s.match(/^COMMIT;$/gm)||[]).length,1,"Unexpected candidate COMMIT: "+file);
 assert.ok(!/^\\/m.test(s),"Unexpected psql command in transaction preview");
 return s.replace(/^BEGIN;$/m,"").replace(/^COMMIT;$/m,"");
}
assert.equal(query("SELECT current_database()"),"postgres");
assert.ok(Number(query("SELECT current_setting('server_version_num')"))>=170000);
assert.equal(query("SELECT to_regclass('private.character_creator_attribution') IS NULL"),"t");
assert.equal(query("SELECT to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NULL"),"t");
const id="00000000-0000-0000-0000-000000009857";
run("INSERT INTO public.characters(id,name,kind,secret) VALUES ('"+id+"','C3R scratch existing NPC','npc','C3R_SYNTHETIC_GM_SECRET');");
const checksumQuery=[
"SELECT md5(concat_ws('|',",
"(SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='character_sheets' AND policyname='character_sheets_select_visible_or_assigned'),",
"md5(pg_get_functiondef('public.get_my_player_characters_v2()'::regprocedure)),",
"md5(pg_get_functiondef('public.get_my_player_character_v1()'::regprocedure)),",
"md5(pg_get_functiondef('public.get_character_secrets_v1(uuid[])'::regprocedure)),",
"md5(pg_get_functiondef('public.set_character_secret_v1(uuid,text)'::regprocedure)),",
"has_column_privilege('authenticated','public.characters','background','SELECT')::text,",
"(SELECT count(*)::text FROM public.characters WHERE secret='C3R_SYNTHETIC_GM_SECRET')))",
].join("\n");
const before=query(checksumQuery);
const stages=[
 "sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql",
 "sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql",
 "sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql",
].map(unwrapped).join("\n");
const preview=[
"DO $c3r$ BEGIN",
"IF to_regclass('private.character_creator_attribution') IS NULL",
"OR to_regclass('public.character_backstory_secrets') IS NULL",
"OR to_regclass('public.character_public_secret_revelations') IS NULL",
"OR to_regprocedure('public.get_npc_dossier_admin_v1(uuid)') IS NULL",
"OR to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NULL",
"OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.characters'::regclass",
" AND tgname IN ('characters_capture_creator_at_insert_v1','characters_guard_player_gm_secret_at_insert_v1') AND NOT tgisinternal)<>2",
"OR has_column_privilege('authenticated','public.characters','background','SELECT')",
"THEN RAISE EXCEPTION 'C3R precommit target not reached'; END IF;",
"END $c3r$;",
].join("\n");
function assertRolledBack(label){
 assert.equal(query(checksumQuery),before,label+" mutated legacy function/RLS/grant or synthetic GM record");
 const absent=query([
 "SELECT to_regclass('private.character_creator_attribution') IS NULL",
 "AND to_regclass('public.character_backstory_secrets') IS NULL",
 "AND to_regclass('public.character_public_secret_revelations') IS NULL",
 "AND to_regprocedure('public.get_npc_dossier_admin_v1(uuid)') IS NULL",
 "AND to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NULL",
 "AND (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.characters'::regclass",
 " AND tgname IN ('characters_capture_creator_at_insert_v1','characters_guard_player_gm_secret_at_insert_v1') AND NOT tgisinternal)=0",
 ].join("\n"));
 assert.equal(absent,"t",label+" left stages partly installed");
 assert.equal(query("SELECT secret FROM public.characters WHERE id='"+id+"'"),"C3R_SYNTHETIC_GM_SECRET");
}
run("BEGIN;\nSET LOCAL lock_timeout='2s';\n"+stages+"\n"+preview+"\nROLLBACK;\n");
assertRolledBack("C3R01 explicit");
console.log("PASS C3R01: real NPC stage1-3 in one precommit transaction, explicit rollback restores function/ACL/RLS/trigger baseline");
run("BEGIN;\nSET LOCAL lock_timeout='2s';\n"+stages+"\n"+preview+"\nSELECT 1 / 0;\nCOMMIT;\n",true);
assertRolledBack("C3R02 forced SQL error");
console.log("PASS C3R02: late statement failure aborts entire original-source staged SQL transaction");
run("DELETE FROM public.characters WHERE id='"+id+"';");
assert.equal(query("SELECT count(*) FROM public.characters WHERE id='"+id+"'"),"0");
console.log("PASS C3R03: synthetic GM sentinel removed, joined signed JWT suite starts from clean fixture");

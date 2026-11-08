#!/usr/bin/env node
// C3.3 review-only composer: NO DB connections. The output is DISPOSABLE ONLY.
// Not a migration; never copy to the live Supabase project or deploy it.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const sources=[
 ["sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql","9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3"],
 ["sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql","afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac"],
 ["sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql","01e48823ac3a46aa5880e98200e97c2595501ce7"],
 ["sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql","4532ddb8db642d0d0ab14646a3e87c034d4134c6"]
];
const protectedTables=["spells_catalog","items_catalog","inventory_items","character_stock"];
function readVerified([file,expected]){
 const raw=fs.readFileSync(path.join(root,file));
 const sha=createHash("sha1").update("blob "+raw.length+"\0").update(raw).digest("hex");
 assert.equal(sha,expected,"Source drift: "+file+" must be re-reviewed");
 const lines=raw.toString("utf8").split(/\r?\n/);
 const begin=lines.flatMap((s,i)=>s.trim()==="BEGIN;"?[i]:[]);
 const commit=lines.flatMap((s,i)=>s.trim()==="COMMIT;"?[i]:[]);
 assert.equal(begin.length,1,"Unexpected candidate transaction BEGIN: "+file);
 assert.equal(commit.length,1,"Unexpected candidate transaction COMMIT: "+file);
 assert.ok(begin[0]<commit[0]);
 assert.ok(lines.every(s=>!s.trimStart().startsWith("\\")),"psql meta commands are not permitted");
 const commands=lines.filter(s=>!s.trimStart().startsWith("--")).join("\n");
 assert.doesNotMatch(commands,/\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i,"Potential destructive candidate: "+file);
 return {file,sha,body:lines.filter((s,i)=>i!==begin[0]&&i!==commit[0]).join("\n")};
}
function digest(t){
 return "md5(coalesce((SELECT string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)) FROM public."+t+" x),''))";
}
const cols=protectedTables.flatMap(t=>["(SELECT count(*) FROM public."+t+") AS "+t+"_count",digest(t)+" AS "+t+"_hash"]).join(",\n");
const temp="CREATE TEMP TABLE c33_preserved_data ON COMMIT DROP AS SELECT "+cols+";";
const before=[
 "-- DISPOSABLE LOCAL PG17 ONLY. NOT A PRODUCTION SQL MIGRATION.",
 "-- All four original Git blobs are pinned; no remote database connection exists in the composer.",
 "BEGIN;",
 "SET LOCAL lock_timeout='2s';",
 "SET LOCAL statement_timeout='120s';",
 "DO $c33local$ BEGIN",
 " IF current_database()<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999",
 " OR to_regclass('private.test_admins') IS NULL OR to_regclass('auth.users') IS NULL",
 " OR to_regclass('private.character_creator_attribution') IS NOT NULL",
 " OR to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NOT NULL",
 " OR to_regclass('public.items_catalog') IS NULL OR to_regclass('public.spells_catalog') IS NULL",
 " OR to_regclass('public.inventory_items') IS NULL OR to_regclass('public.character_stock') IS NULL",
 " OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4",
 " OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass",
 " AND conname IN ('inventory_items_owner_type_check','inventory_items_owner_type_chk'))<>2",
 " OR has_table_privilege('authenticated','public.characters','SELECT')",
 " THEN RAISE EXCEPTION 'C3.3 research bundle refuses any non-disposable or source-drift database'; END IF;",
 "END $c33local$;",
 temp
].join("\n");
const mismatch=protectedTables.flatMap(t=>["b."+t+"_count IS DISTINCT FROM a."+t+"_count","b."+t+"_hash IS DISTINCT FROM a."+t+"_hash"]).join(" OR ");
const after=[
 "DO $c33after$ BEGIN",
 " IF to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NULL",
 " OR to_regprocedure('public.get_npc_dossier_admin_v1(uuid)') IS NULL",
 " OR to_regprocedure('public.get_character_editor_narrative_v1(uuid)') IS NULL",
 " OR to_regprocedure('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)') IS NULL",
 " OR to_regclass('public.character_backstory_secrets') IS NULL",
 " OR to_regclass('public.character_public_secret_revelations') IS NULL",
 " OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass",
 " AND conname='inventory_items_owner_type_chk')<>0",
 " OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass",
 " AND conname='inventory_items_owner_type_check' AND convalidated)<>1",
 " OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4",
 " OR has_column_privilege('authenticated','public.characters','background','SELECT')",
 " THEN RAISE EXCEPTION 'C3.3 research bundle postflight privacy/inventory mismatch'; END IF;",
 " IF EXISTS (SELECT 1 FROM pg_temp.c33_preserved_data b",
 " CROSS JOIN (SELECT "+cols+") a WHERE "+mismatch+")",
 " THEN RAISE EXCEPTION 'C3.3 protected spell/item/stock/inventory data changed'; END IF;",
 "END $c33after$;",
 "NOTIFY pgrst,'reload schema';",
 "COMMIT;"
].join("\n");
export function compose(){
 const stages=sources.map(readVerified);
 const sql=[before,...stages.map((s,i)=>"-- SOURCE STAGE "+(i+1)+" "+s.file+" GIT_BLOB "+s.sha+"\n"+s.body),after].join("\n\n")+"\n";
 assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);
 return {sql,stages:stages.map(s=>({file:s.file,sha:s.sha})),protectedTables};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 const result=compose();
 if(args.length===1&&args[0]==="--check"){
  console.log("PASS C3ATOMIC01: "+JSON.stringify({sourceBlobs:result.stages,protectedTables,oneTransaction:true,disposableOnly:true}));
 }else if(args.length===2&&args[0]==="--out"){
  assert.ok(path.isAbsolute(args[1]),"Output file must be absolute");
  const dest=path.resolve(args[1]);
  assert.ok(!dest.startsWith(root+path.sep),"Output must be outside repository");
  fs.writeFileSync(dest,result.sql,{flag:"wx",mode:0o600});
  console.log("C3ATOMIC generated review-only disposable SQL "+dest);
 }else throw Error("Use --check OR --out /absolute/disposable/file.sql");
}

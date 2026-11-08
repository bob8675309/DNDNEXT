#!/usr/bin/env node
// Local-only, read-only verification of a dated Supabase migration inventory.
// Never connects to the live DB and never alters supabase_migrations.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"docs/data/c33_migration_history_snapshot_2026-11-08.json"),"utf8"));
const walk=(dir)=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{
 const file=path.join(dir,ent.name);return ent.isDirectory()?walk(file):ent.isFile()&&ent.name.endsWith(".sql")?[path.relative(root,file).split(path.sep).join("/")]:[];
}):[];
const stem=rel=>path.basename(rel).replace(/\.sql$/i,"").replace(/^\d{8}_[0-9]{1,3}_/,"").replace(/^\d{14}_/,"").replace(/^\d{8}_/,"").toLowerCase();
const local=walk(path.join(root,"sql")).sort();
const byStem=new Map();
for(const file of local)byStem.set(stem(file),[...(byStem.get(stem(file))||[]),file]);
const computed=manifest.migrations.map(x=>({...x,possible_local_paths:byStem.get(x.name.toLowerCase())||[]}));
assert.deepEqual(computed,manifest.migrations,"Local SQL filenames changed relative to 2026-11-08 remote metadata snapshot; REFRESH inventory after read-only live recheck");
assert.equal(manifest.remote_migration_history_count,manifest.migrations.length);
assert.equal(manifest.remote_records_with_stored_statements,manifest.remote_migration_history_count);
for(const rec of manifest.migrations){
 assert.equal(rec.remote_statement_count,1,"Remote metadata statement count drift, refresh snapshot");
 assert.match(rec.remote_statements_md5,/^[0-9a-f]{32}$/,"Missing non-sensitive recorded statement MD5");
}
assert.equal(new Set(manifest.migrations.map(x=>x.version)).size,manifest.migrations.length,"Duplicate remote migration version");
assert.deepEqual(
 local.filter(path=>!computed.some(m=>m.possible_local_paths.includes(path))),
 manifest.unmatched_local_sql,
 "Local unmatched SQL set changed; REFRESH snapshot, do not auto-repair migration history"
);
assert.equal(local.length,manifest.status.localSqlTotal);
assert.equal(computed.filter(x=>x.possible_local_paths.length===0).length,manifest.status.remoteWithoutFilenameMatch);
assert.equal(computed.filter(x=>x.possible_local_paths.length>1).length,manifest.status.ambiguousMatches);
console.log("PASS C3HIST01 "+JSON.stringify({remote:computed.length,local:local.length,filenameMatched:manifest.status.remoteWithFilenameMatch,remoteUnmatched:manifest.status.remoteWithoutFilenameMatch,ambiguous:manifest.status.ambiguousMatches,localUnmatched:manifest.status.unmatchedLocal,disclaimer:"Names only; not migration body equivalence."}));

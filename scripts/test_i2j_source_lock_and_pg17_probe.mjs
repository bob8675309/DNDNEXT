#!/usr/bin/env node
// I2J executable STATIC tests: no DB, GitHub token, Vercel or production access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(file,args)=>{
 const p=spawnSync(process.execPath,[path.join(root,file),...args],
  {cwd:root,encoding:'utf8',timeout:30000,env:{...process.env}});
 return p;
};
function pass(result,label){
 assert.equal(result.status,0,label+': '+(result.stderr||'')+'\n'+(result.stdout||''));
 return String(result.stdout||'');
}
const source=pass(run('scripts/validate_i2j_cross_pr_source_lock.mjs',[]),'19-record source lock');
assert.match(source,/BLOCKED: original I2C public-v2 source fingerprint/);
const check=pass(run('scripts/release/i2j_disposable_privacy_composition.mjs',['--check']),'PG17 static composition');
assert.match(check,/PASS I2J 7 source-pinned staged bodies/);
assert.match(check,/BLOCKED: source-original I2C public-v2 fingerprint/);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dndnext-i2j-static-'));
try{
 const dest=path.join(tmp,'i2j_rollback_only.sql');
 const result=pass(run('scripts/release/i2j_disposable_privacy_composition.mjs',['--emit-rollback-probe',dest]),'rollback probe generation');
 assert.match(result,/PARTIAL source-only PG17 ROLLBACK probe/);
 const sql=fs.readFileSync(dest,'utf8');
 assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,0);
 assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert.ok(sql.trimEnd().endsWith('ROLLBACK;'),'must never COMMIT');
 const order=[
  'npc_stage1','npc_stage2','npc_stage3','immutable_324','story_nonce_351',
  'option_a_private_v2_371','inventory_stage4'
 ];
 let at=-1;
 for(const id of order){
  const n=sql.indexOf('-- SOURCE '+id+' GIT_BLOB ');
  assert.ok(n>at,'missing or reordered source '+id);
  at=n;
 }
 assert.ok(!sql.includes('-- SOURCE option_a_creation_371 GIT_BLOB'),'I2C must not be silently included');
 assert.match(sql,/I2J refuses non-disposable/);
 assert.match(sql,/OR current_setting\('application_name'\)<>'dndnext-i2j-disposable-pg17'/);
 assert.match(sql,/to_regclass\('private.test_admins'\) IS NULL/);
 assert.match(sql,/reveal\.public_text/);
 assert.match(sql,/__dndnext_private_story_intent_sha256_i1c/);
 const stage4=['ALTER POLICY inventory_items_insert_owner_or_admin',
  'ALTER POLICY inventory_items_update_owner_or_admin',
  'ALTER POLICY inventory_items_delete_owner_or_admin',
  'ALTER POLICY inventory_items_select_owner_or_admin',
  'DROP CONSTRAINT inventory_items_owner_type_chk'];
 let prev=-1;
 for(const key of stage4){const n=sql.lastIndexOf(key);assert.ok(n>prev,'stage4 transactional order '+key);prev=n;}
 const source31=JSON.parse(fs.readFileSync(path.join(root,
  'docs/integration/I2J_ORIGINAL_31_TRIGGER_SOURCE_FINGERPRINTS_2026-11-12.json'),'utf8'));
 assert.equal(source31.entries.length,31);
 const rows=source31.entries.map(e=>e.table_name+'.'+e.trigger_name+':'+e.function_md5+':'+e.trigger_def_md5);
 const digest=createHash('md5').update(rows.join('\n')).digest('hex');
 assert.ok(sql.includes(digest),'original 31-trigger source digest missing');
 const collision=run('scripts/release/i2j_disposable_privacy_composition.mjs',
  ['--emit-rollback-probe',dest]);
 assert.notEqual(collision.status,0,'must reject overwriting prior generated SQL');
 assert.equal(fs.readFileSync(dest,'utf8'),sql,'failed overwrite altered generated SQL');
 console.log('PASS I2J static: manifest, seven exact source blobs, 31-trigger digest, single-BEGIN/ROLLBACK, blocked I2C, and exclusive temp-file emission.');
 console.log('NOT RUN: PostgreSQL, signed roles, 34-writer freeze, full Forge, UI, restore, production.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

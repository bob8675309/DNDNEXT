#!/usr/bin/env node
// I2J source-locked PostgreSQL 17 ROLLBACK probe. NOT a migration.
// Does not connect to any DB. Original I2C public-v2 remains BLOCKED.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=p=>{
 const b=fs.readFileSync(path.join(root,p));
 return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
};
const manifest=JSON.parse(read('docs/integration/I2J_CROSS_PR_SOURCE_LOCK_2026-11-12.json'));
const live31=JSON.parse(read('docs/integration/I2J_ORIGINAL_31_TRIGGER_SOURCE_FINGERPRINTS_2026-11-12.json'));
assert.equal(manifest.schema,'i2j-cross-pr-source-lock-v1');
assert.equal(manifest.source_order_status,'BLOCKED_I2C_PUBLIC_V2_FINGERPRINT_CONTRADICTION');
assert.equal(live31.count,31);
assert.equal(live31.entries.length,31);
const byId=new Map(manifest.sources.map(x=>[x.id,x]));
assert.equal(byId.size,manifest.source_count);
function pinned(id){
 const v=byId.get(id);assert.ok(v,'source id missing '+id);
 const file=v.source_pr==='main' ? v.path : 'scripts/fixtures/i2j/pinned/'+path.basename(v.path);
 assert.equal(sha(file),v.blob_sha,'SOURCE DRIFT '+id);
 return {id,blob:v.blob_sha,path:file,raw:read(file)};
}
const ids=['npc_stage1','npc_stage2','npc_stage3','immutable_324','story_nonce_351',
 'option_a_private_v2_371','inventory_stage4'];
const stages=ids.map(pinned);
const i2c=pinned('option_a_creation_371').raw;
const immutable=stages.find(x=>x.id==='immutable_324').raw;
const originalV2Md5='0351f0a00acae023278e1b8b065b00c9';
assert.ok(immutable.includes("CREATE OR REPLACE FUNCTION public.create_player_character_v2("));
assert.ok(immutable.includes("private.player_creation_intent_reservations_v1"));
assert.ok(immutable.includes("public.create_player_character_v2(jsonb,jsonb)'::regprocedure"));
assert.ok(immutable.includes(originalV2Md5));
assert.ok(i2c.includes("to_regclass('private.player_creation_intent_reservations_v1') IS NULL"));
assert.ok(i2c.includes("'public.create_player_character_v2(jsonb,jsonb)','"+originalV2Md5+"'"));
assert.ok(stages.find(x=>x.id==='npc_stage3').raw.includes('reveal.public_text'));
assert.ok(stages.find(x=>x.id==='story_nonce_351').raw.includes('__dndnext_private_story_intent_sha256_i1c'));
assert.ok(stages.find(x=>x.id==='option_a_private_v2_371').raw.includes('I2D_OPTION_A_PRIVATE_FORGE_LEGACY_FREEZE'));
assert.ok(stages.find(x=>x.id==='inventory_stage4').raw.includes('DROP CONSTRAINT inventory_items_owner_type_chk'));
function cleaned(s){
 let text=s.raw.replace(/\r\n/g,'\n');
 if(['npc_stage1','npc_stage2','npc_stage3','inventory_stage4'].includes(s.id)){
  assert.equal((text.match(/^BEGIN;$/gm)||[]).length,1,'source BEGIN '+s.id);
  assert.equal((text.match(/^COMMIT;$/gm)||[]).length,1,'source COMMIT '+s.id);
  text=text.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
 }else{
  assert.equal((text.match(/^BEGIN;$/gm)||[]).length,0,'unexpected BEGIN '+s.id);
  assert.equal((text.match(/^COMMIT;$/gm)||[]).length,0,'unexpected COMMIT '+s.id);
 }
 text=text.replace(/^\\set ON_ERROR_STOP on\s*$/gm,'')
  .replace(/^\\echo 'PASS [^\n]+'\s*$/gm,'');
 assert.ok(!/^\s*\\/m.test(text),'unexpected psql command in '+s.id);
 const exec=text.split('\n').filter(x=>!x.trimStart().startsWith('--')).join('\n');
 assert.ok(!/^\s*(DROP TABLE|TRUNCATE|DELETE FROM public\.(spells_catalog|items_catalog))\b/im.test(exec),
  'unsafe command '+s.id);
 return '-- SOURCE '+s.id+' GIT_BLOB '+s.blob+'\n'+text;
}
const triggerRows=live31.entries.map(e=>{
 assert.match(e.function_md5,/^[a-f0-9]{32}$/);
 assert.match(e.trigger_def_md5,/^[a-f0-9]{32}$/);
 return e.table_name+'.'+e.trigger_name+':'+e.function_md5+':'+e.trigger_def_md5;
});
assert.equal(new Set(triggerRows).size,31);
const originalDigest=createHash('md5').update(triggerRows.join('\n')).digest('hex');
const countSql=[
 'SELECT count(*)::integer, md5(string_agg(',
 "c.relname||'.'||t.tgname||':'||md5(pg_get_functiondef(p.oid))||':'||md5(pg_get_triggerdef(t.oid,true)),",
 'chr(10) ORDER BY c.relname,t.tgname))',
 'FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid',
 'JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid',
 "WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled<>'D'",
 "AND c.relname IN ('character_progression','character_sheets','characters','inventory_items')",
 "AND t.tgname NOT IN ('characters_capture_creator_at_insert_v1','characters_guard_player_gm_secret_at_insert_v1')"
].join('\n');
function fingerprintBlock(label){
 return [
  'DO $i2j_'+label+'$',
  'DECLARE v_n integer;v_digest text;',
  'BEGIN',
  countSql+' INTO v_n,v_digest;',
  "IF v_n<>31 OR v_digest<>'"+originalDigest+"'",
  "THEN RAISE EXCEPTION 'I2J original 31 trigger fingerprint drift: count % digest %',v_n,v_digest; END IF;",
  'END $i2j_'+label+'$;'
 ].join('\n');
}
const preflight=[
 'DO $i2j_local_gate$',
 'BEGIN',
 "IF current_database()<>'postgres'",
 "OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999",
 "OR current_setting('application_name')<>'dndnext-i2j-disposable-pg17'",
 "OR to_regclass('private.test_admins') IS NULL OR to_regclass('auth.users') IS NULL",
 "OR to_regclass('public.items_catalog') IS NULL OR to_regclass('public.spells_catalog') IS NULL",
 "OR to_regclass('public.character_stock') IS NULL OR to_regclass('public.inventory_items') IS NULL",
 "OR to_regclass('private.player_creation_intent_reservations_v1') IS NOT NULL",
 "OR to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NOT NULL",
 "OR has_table_privilege('authenticated','public.characters','SELECT')",
 "THEN RAISE EXCEPTION 'I2J refuses non-disposable, non-source-original or already staged database'; END IF;",
 'END $i2j_local_gate$;'
].join('\n');
const postflight=[
 'DO $i2j_postflight$',
 'BEGIN',
 "IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.characters'::regclass",
 "AND NOT tgisinternal AND tgname IN ('characters_capture_creator_at_insert_v1',",
 "'characters_guard_player_gm_secret_at_insert_v1'))<>2",
 "OR to_regclass('public.character_backstory_secrets') IS NULL",
 "OR to_regclass('public.character_public_secret_revelations') IS NULL",
 "OR to_regprocedure('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)') IS NULL",
 "OR to_regprocedure('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)') IS NULL",
 "OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass",
 "AND conname='inventory_items_owner_type_chk')",
 "OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass",
 "AND conname='inventory_items_owner_type_check' AND convalidated)",
 "THEN RAISE EXCEPTION 'I2J partial privacy, Story or inventory gate failed'; END IF;",
 'END $i2j_postflight$;'
].join('\n');
const result=[
 '-- I2J PARTIAL ROLLBACK-ONLY PG17 REHEARSAL. NOT A MIGRATION.',
 '-- Requires 31 original source-identical triggers; NEVER alters world map source.',
 '-- Original I2C conflicts with #324; 34/34 frozen account writers NOT integrated.',
 '-- No source-positive result here proves signed GoTrue/browser/restore/release.',
 'BEGIN;', "SET LOCAL lock_timeout='2s';","SET LOCAL statement_timeout='120s';",
 preflight,fingerprintBlock('before'),
 ...stages.map(cleaned),fingerprintBlock('after'),postflight,
 'ROLLBACK;'
].join('\n\n')+'\n';
assert.equal((result.match(/^BEGIN;$/gm)||[]).length,1);
assert.equal((result.match(/^ROLLBACK;$/gm)||[]).length,1);
assert.equal((result.match(/^COMMIT;$/gm)||[]).length,0);
assert.equal((result.match(/^-- SOURCE /gm)||[]).length,7);
const args=process.argv.slice(2);
if(args.length===1 && args[0]==='--check'){
 console.log('PASS I2J 7 source-pinned staged bodies; original 31-trigger fingerprint and rollback-only shape.');
 console.log('BLOCKED: source-original I2C public-v2 fingerprint contradicts #324 immutable wrapper.');
 console.log('NOT RUN: SQL, signed JWT, 34/34 legacy writers, full browser or production.');
}else if(args.length===2 && args[0]==='--emit-rollback-probe'){
 const dest=path.resolve(args[1]);
 assert.ok(path.isAbsolute(args[1])&&dest.endsWith('.sql'),'require absolute .sql path');
 assert.ok(!dest.startsWith(root+path.sep),'must output OUTSIDE repository');
 assert.ok(!fs.existsSync(dest),'output exists');
 fs.writeFileSync(dest,result,{flag:'wx',mode:0o600});
 console.log('EMITTED PARTIAL source-only PG17 ROLLBACK probe '+dest);
}else{
 throw Error('Usage: node scripts/release/i2j_disposable_privacy_composition.mjs --check | --emit-rollback-probe /absolute/outside/repo/probe.sql');
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
 ORIGINALS,parseLocalOptions,readOnlySql,decodeExactFunctionBase64,
 assessOfflineSourceOutputs,writeOfflineBundle,runOfflineExtract
} from './i2j_p4_offline_original_functions_export.mjs';
const bad=(code,fn)=>assert.throws(fn,e=>e.code===code);
const plain=(spec)=>'CREATE OR REPLACE FUNCTION '+spec.signature.split('(')[0]+'(p_character_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RETURN '+ "'{}'::jsonb"+'; END; $$;';
const bodies=Object.fromEntries(ORIGINALS.map(s=>[s.key,plain(s)]));
const fakeOutput=Object.fromEntries(ORIGINALS.map(s=>[s.key,Buffer.from(bodies[s.key],'utf8').toString('base64')+'\n']));
const fakeMd5=Object.fromEntries(ORIGINALS.map(s=>[s.key,createHash('md5').update(bodies[s.key]).digest('hex')]));
const optsBase={port:'54322',user:'postgres',database:'postgres',backupId:'offline-synthetic-backup',restoreReceipt:'synthetic-only-receipt'};
const opts=(dir)=>({...optsBase,outputDir:dir});
test('I2J-P4-01 three exact original signatures and immutable deployed MD5 pins',()=>{
 assert.deepEqual(ORIGINALS.map(s=>s.md5),['28a227a1dfb9a3cc5516c5b7afb874b0','32fa55b69478af07f8f0002b967a5704','05f6d19a7e2f45d890c62c27cb419e7f']);
 assert.equal(new Set(ORIGINALS.map(s=>s.signature)).size,3);
});
test('I2J-P4-02 no offline attestation means CLI refuses',()=>{
 bad('EXPLICIT_LOCAL_RESTORE_ACK_REQUIRED',()=>parseLocalOptions([]));
});
test('I2J-P4-03 reject remote/URI, other hostname, unwanted flags',()=>{
 const base=['--ack-offline-restored-pg17','--backup-id','offline-test-backup','--restore-receipt','offline-restored-test','--output-dir',path.join(os.tmpdir(),'i2j-p4-nonexistent-dir-'+process.pid)];
 bad('INVALID_CLI_OPTIONS',()=>parseLocalOptions([...base,'--host','example.com']));
 bad('INVALID_LOCAL_DB_IDENTITY',()=>parseLocalOptions([...base,'--db-name','postgresql://prod.example']));
 bad('INVALID_LOCAL_DB_IDENTITY',()=>parseLocalOptions([...base,'--db-user','bad@remote']));
});
test('I2J-P4-04 no relative output, no output within checked-out source',()=>{
 const base=['--ack-offline-restored-pg17','--backup-id','offline-test-backup','--restore-receipt','offline-restored-test'];
 bad('ABSOLUTE_OUTPUT_DIRECTORY_REQUIRED',()=>parseLocalOptions([...base,'--output-dir','relative-directory']));
 bad('REFUSE_WRITE_INSIDE_GIT_REPOSITORY',()=>parseLocalOptions([...base,'--output-dir',path.resolve('internal-evidence')]));
});
test('I2J-P4-05 functions queried by static read-only SELECT, not custom SQL or user input',()=>{
 for(const spec of ORIGINALS){
  const query=readOnlySql(spec);
  assert.match(query,/^SELECT regexp_replace\(encode\(convert_to\(pg_get_functiondef\('/);
  assert.ok(query.includes(spec.signature+"'::regprocedure"));
  assert.doesNotMatch(query,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER)\b/i);
 }
 bad('UNKNOWN_FUNCTION',()=>readOnlySql({signature:'private.evil()'}));
});
test('I2J-P4-06 base64 is lossless incl original trailing newline and rejects altered data',()=>{
 for(const spec of ORIGINALS)assert.equal(decodeExactFunctionBase64(fakeOutput[spec.key]),bodies[spec.key]);
 bad('INVALID_FUNCTION_BASE64',()=>decodeExactFunctionBase64('INVALID?'));
 bad('INVALID_FUNCTION_BASE64',()=>decodeExactFunctionBase64(''));
});
test('I2J-P4-07 refuse PG16/PG18/non-numeric server version',()=>{
 for(const v of ['160012','180000','bad',''])bad('NOT_POSTGRESQL_17',()=>assessOfflineSourceOutputs({serverVersion:v,outputs:fakeOutput,expectedMd5:fakeMd5}));
});
test('I2J-P4-08 synthetic source cannot match original source pins',()=>{
 bad('ORIGINAL_FINGERPRINT_MISMATCH_LEVELUP_V2',()=>assessOfflineSourceOutputs({serverVersion:'170005',outputs:fakeOutput}));
});
test('I2J-P4-09 valid synthetic source can be accepted ONLY by explicitly test-injected pins',()=>{
 const r=assessOfflineSourceOutputs({serverVersion:'170005',outputs:fakeOutput,expectedMd5:fakeMd5});
 assert.equal(r.length,3);
 assert.equal(r[0].sha256,createHash('sha256').update(bodies.levelup_v2).digest('hex'));
});
test('I2J-P4-10 missing one original source prevents any bundle write',()=>{
 const missing={...fakeOutput,invocation_recovery:''};
 bad('INVALID_FUNCTION_BASE64',()=>assessOfflineSourceOutputs({serverVersion:'170001',outputs:missing,expectedMd5:fakeMd5}));
});
test('I2J-P4-11 secure local-only synthetic bundle self-asserts lineage and never signed PASS',()=>{
 const out=path.join(os.tmpdir(),'i2j-p4-test-'+process.pid+'-'+Math.floor(Math.random()*1e6));
 const data=assessOfflineSourceOutputs({serverVersion:'170005',outputs:fakeOutput,expectedMd5:fakeMd5});
 try{
  const result=writeOfflineBundle(opts(out),data);
  assert.equal(result.status,'SOURCE_MATCH_CANDIDATE_ONLY');
  assert.equal(result.production_release_allowed,false);
  assert.equal(result.signed_pg17_tests_executed,false);
  for(const spec of ORIGINALS){
   const source=fs.readFileSync(path.join(out,spec.filename),'utf8');
   assert.equal(source,bodies[spec.key]);
   const manifest=JSON.parse(fs.readFileSync(path.join(out,spec.key+'_manifest.json'),'utf8'));
   assert.equal(manifest.source_type,'independent_restored_pg17_pg_get_functiondef');
   assert.equal(manifest.production_release_allowed,false);
  }
  bad('OUTPUT_DIRECTORY_ALREADY_EXISTS',()=>writeOfflineBundle(opts(out),data));
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
test('I2J-P4-12 no psql is needed to prove original MD5 is required before writing',()=>{
 const out=path.join(os.tmpdir(),'i2j-p4-fail-'+process.pid);
 let count=0;
 const fakeRunner=(query)=>{
  count++;
  if(count===1)return '170005';
  if(count===2)return fakeOutput.levelup_v2;
  if(count===3)return fakeOutput.weapon_mastery;
  return '';
 };
 bad('ORIGINAL_FINGERPRINT_MISMATCH_LEVELUP_V2',()=>runOfflineExtract(opts(out),fakeRunner));
 assert.equal(fs.existsSync(out),false);
});

test('I2J-P4-13 invalid PG major stops BEFORE any original function queries',()=>{
 const out=path.join(os.tmpdir(),'i2j-p4-major-bad-'+process.pid);
 let calls=0;
 bad('NOT_POSTGRESQL_17',()=>runOfflineExtract(opts(out),()=>{calls++;return '160012';}));
 assert.equal(calls,1,'Must never read function text from a wrong-major server');
 assert.equal(fs.existsSync(out),false);
});

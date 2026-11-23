// CI executes only in-memory + temporary-file synthetic evidence, NEVER a DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ORIGINALS} from './i2j_original_function_pins.mjs';
import {parseBundleCli,readBundleFiles,inspectBundleFiles,inspectOfflineBundleDirectory} from './i2j_p5_inert_offline_bundle_review.mjs';
const hash=(alg,b)=>createHash(alg).update(b).digest('hex');
const bad=(code,fn)=>assert.throws(fn,e=>e.code===code);
const body=s=>Buffer.from('CREATE OR REPLACE FUNCTION '+s.signature.split('(')[0]+
 '(p_character_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN '+
 "'{}'::jsonb; END; $$;\n-- EXPLICIT SYNTHETIC ONLY "+s.key.padEnd(45,'.'));
const pins=()=>ORIGINALS.map(s=>({...s,md5:hash('md5',body(s))}));
function files(){
 return Object.fromEntries(ORIGINALS.flatMap(s=>{
  const b=body(s);
  const m={manifest_version:s.manifestVersion,source_type:'independent_restored_pg17_pg_get_functiondef',
   postgres_major:17,function_identity:s.signature,backup_id:'synthetic-only-backup-id',
   restore_receipt:'synthetic-only-receipt',function_sha256:hash('sha256',b),function_md5:hash('md5',b),
   evidence_class:'LOCAL_OPERATOR_CLAIM_ONLY_NOT_INDEPENDENTLY_AUTHENTICATED',
   signed_transaction_executed:false,production_release_allowed:false};
  return [[s.filename,b],[s.key+'_manifest.json',Buffer.from(JSON.stringify(m))]];
 }));
}
function change(f,s,cb){
 const key=s.key+'_manifest.json',m=JSON.parse(f[key].toString('utf8'));
 cb(m);f[key]=Buffer.from(JSON.stringify(m));
}
test('I2J-P5-01 original three immutable MD5 pins are unchanged',()=>{
 assert.deepEqual(ORIGINALS.map(s=>s.md5),[
  '28a227a1dfb9a3cc5516c5b7afb874b0',
  '32fa55b69478af07f8f0002b967a5704',
  '05f6d19a7e2f45d890c62c27cb419e7f']);
});
test('I2J-P5-02 synthetic good data gives candidate-only, never signed',()=>{
 const r=inspectBundleFiles(files(),pins());
 assert.equal(r.status,'CANDIDATE_ONLY_NOT_AUTHORIZED');
 assert.equal(r.functions.length,3);
 assert.equal(r.backup_origin_independently_verified,false);
 assert.equal(r.signed_original_red_green_executed,false);
 assert.equal(r.production_release_allowed,false);
});
test('I2J-P5-03 real immutable hashes reject synthetic export',()=>{
 bad('ORIGINAL_MD5_MISMATCH_LEVELUP_V2',()=>inspectBundleFiles(files()));
});
test('I2J-P5-04 even self-consistent mutated bytes do not match original pin',()=>{
 const f=files(),s=ORIGINALS[0];f[s.filename]=Buffer.from(body(s).toString('utf8')+'\n');
 change(f,s,m=>{m.function_md5=hash('md5',f[s.filename]);m.function_sha256=hash('sha256',f[s.filename]);});
 bad('ORIGINAL_MD5_MISMATCH_LEVELUP_V2',()=>inspectBundleFiles(f,pins()));
});
test('I2J-P5-05 bytes drift and false function identity fail independently',()=>{
 const f=files(),s=ORIGINALS[0];f[s.filename]=Buffer.from(body(s).toString('utf8').replace('LANGUAGE','language'));
 bad('FUNCTION_BYTES_TAMPERED_LEVELUP_V2',()=>inspectBundleFiles(f,pins()));
 const g=files();g[s.filename]=Buffer.from(body(s).toString('utf8').replace('complete_character_level_up_v2','another_function'));
 bad('WRONG_FUNCTION_IDENTITY_LEVELUP_V2',()=>inspectBundleFiles(g,pins()));
});
test('I2J-P5-06 false production/pass/version/source assertions rejected',()=>{
 for(const [key,val] of [['production_release_allowed',true],['signed_transaction_executed',true],
  ['postgres_major',16],['source_type','historical_sql'],['evidence_class','SIGNED_RELEASE'],
  ['function_identity','public.other(uuid)']]){
  const f=files();change(f,ORIGINALS[0],m=>{m[key]=val;});
  bad('UNTRUSTED_MANIFEST_CLAIM',()=>inspectBundleFiles(f,pins()));
 }
});
test('I2J-P5-07 mixed backup and receipt identifiers rejected',()=>{
 for(const k of ['backup_id','restore_receipt']){
  const f=files();change(f,ORIGINALS[2],m=>{m[k]='different-backup-1234';});
  bad('MIXED_BACKUP_LINEAGE',()=>inspectBundleFiles(f,pins()));
 }
});
test('I2J-P5-08 missing/extra source files fail',()=>{
 const f=files();delete f[ORIGINALS[1].filename];
 bad('BUNDLE_FILE_SET_MISMATCH',()=>inspectBundleFiles(f,pins()));
 const g=files();g['unapproved.secret']=Buffer.from('test');
 bad('BUNDLE_FILE_SET_MISMATCH',()=>inspectBundleFiles(g,pins()));
});
test('I2J-P5-09 malformed or extra manifest fields fail',()=>{
 const f=files();change(f,ORIGINALS[0],m=>delete m.function_sha256);
 bad('INVALID_MANIFEST_KEYS',()=>inspectBundleFiles(f,pins()));
 const g=files();change(g,ORIGINALS[0],m=>m.production_claim='safe');
 bad('INVALID_MANIFEST_KEYS',()=>inspectBundleFiles(g,pins()));
});
test('I2J-P5-10 invalid hash and inconsistent backup record rejected',()=>{
 const f=files();change(f,ORIGINALS[0],m=>m.function_md5='BAD');
 bad('BAD_HASH_FORMAT',()=>inspectBundleFiles(f,pins()));
 const g=files();change(g,ORIGINALS[0],m=>m.backup_id='bad-url/here');
 bad('INVALID_BACKUP_RECEIPT',()=>inspectBundleFiles(g,pins()));
});
test('I2J-P5-11 UTF8 errors cannot be silently decoded',()=>{
 const f=files(),s=ORIGINALS[1];
 f[s.filename]=Buffer.concat([body(s),Buffer.from([0xff])]);
 bad('NON_UTF8_ARTIFACT',()=>inspectBundleFiles(f,pins()));
});
test('I2J-P5-12 CLI has no host, port, network or hash override',()=>{
 bad('ONLY_BUNDLE_DIR_ALLOWED',()=>parseBundleCli([]));
 bad('ONLY_BUNDLE_DIR_ALLOWED',()=>parseBundleCli(['--bundle-dir','/tmp/foo','--host','prod']));
 bad('ABSOLUTE_BUNDLE_DIR_REQUIRED',()=>parseBundleCli(['--bundle-dir','relative']));
 assert.equal(parseBundleCli(['--bundle-dir','/tmp/dndnext-p5']),'/tmp/dndnext-p5');
});
test('I2J-P5-13 cannot read nonexisting or in-repository evidence',()=>{
 bad('BUNDLE_NOT_FOUND',()=>readBundleFiles(path.join(os.tmpdir(),'missing-i2j-p5-'+process.pid)));
 bad('REFUSE_IN_REPOSITORY_EVIDENCE',()=>readBundleFiles(process.cwd()));
});
test('I2J-P5-14 symlinks and extra directory entries refused',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'i2j-p5-'));
 try{
  const f=files();for(const [name,bytes] of Object.entries(f))fs.writeFileSync(path.join(dir,name),bytes);
  assert.deepEqual(Object.keys(readBundleFiles(dir)).sort(),Object.keys(f).sort());
  bad('ORIGINAL_MD5_MISMATCH_LEVELUP_V2',()=>inspectOfflineBundleDirectory(dir));
  fs.symlinkSync(path.join(dir,ORIGINALS[0].filename),path.join(dir,'extra-link'));
  bad('BUNDLE_FILE_SET_MISMATCH',()=>readBundleFiles(dir));
  fs.unlinkSync(path.join(dir,'extra-link'));
  fs.unlinkSync(path.join(dir,ORIGINALS[0].filename));
  fs.symlinkSync(path.join(dir,ORIGINALS[1].filename),path.join(dir,ORIGINALS[0].filename));
  bad('UNSAFE_EVIDENCE_FILE',()=>readBundleFiles(dir));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('I2J-P5-15 reports do not reveal original code or backup identifiers',()=>{
 const r=JSON.stringify(inspectBundleFiles(files(),pins()));
 assert.ok(!r.includes('CREATE OR REPLACE FUNCTION'));
 assert.ok(!r.includes('synthetic-only-backup-id'));
 assert.ok(!r.includes('synthetic-only-receipt'));
});

test('I2J-P6-16 inert reviewer has no transitive dependency on process-launching exporter',()=>{
 const dir=path.dirname(new URL(import.meta.url).pathname);
 const p5=fs.readFileSync(path.join(dir,'i2j_p5_inert_offline_bundle_review.mjs'),'utf8');
 const pin=fs.readFileSync(path.join(dir,'i2j_original_function_pins.mjs'),'utf8');
 assert.match(p5,/from '\.\/i2j_original_function_pins\.mjs'/);
 assert.doesNotMatch(p5,/from '\.\/i2j_p4_offline_original_functions_export\.mjs'/);
 assert.doesNotMatch(pin,/\bimport\s|\brequire\s*\(|child_process|spawnSync|execSync|psql/i);
 assert.doesNotMatch(p5,/\bspawnSync\s*\(|\bexecSync\s*\(|\bfetch\s*\(/);
 assert.match(p5,/fs\.constants\.O_NOFOLLOW/);
});
test('I2J-P6-17 evidence file open must use descriptor nofollow and verify identity',()=>{
 const dir=path.dirname(new URL(import.meta.url).pathname);
 const code=fs.readFileSync(path.join(dir,'i2j_p5_inert_offline_bundle_review.mjs'),'utf8');
 assert.match(code,/fs\.openSync\(p,fs\.constants\.O_RDONLY\|fs\.constants\.O_NOFOLLOW\)/);
 assert.match(code,/fs\.fstatSync\(fd\)/);
 assert.match(code,/opened\.dev!==s\.dev\|\|opened\.ino!==s\.ino/);
 assert.match(code,/fs\.readFileSync\(fd\)/);
});
test('I2J-P6-18 unsupported NOFOLLOW is documented as a refusal, never a fallback to following links',()=>{
 const dir=path.dirname(new URL(import.meta.url).pathname);
 const code=fs.readFileSync(path.join(dir,'i2j_p5_inert_offline_bundle_review.mjs'),'utf8');
 assert.match(code,/typeof fs\.constants\.O_NOFOLLOW!=='number'\)fail\('NOFOLLOW_UNAVAILABLE'\)/);
 assert.doesNotMatch(code,/fs\.readFileSync\(p\)/);
});

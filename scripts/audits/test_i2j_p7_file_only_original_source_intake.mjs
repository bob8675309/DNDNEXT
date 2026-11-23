// Pure synthetic file-only tests; no PostgreSQL or network operations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ORIGINALS} from './i2j_original_function_pins.mjs';
import {parseP7Options,readRawOfflineInputs,validateRawOfflineInputs,writeP7CandidateBundle,packageExistingOfflineFiles}
 from './i2j_p7_file_only_original_source_intake.mjs';
import {inspectOfflineBundleDirectory} from './i2j_p5_inert_offline_bundle_review.mjs';
const H=(a,x)=>createHash(a).update(x).digest('hex');
const bad=(code,fn)=>assert.throws(fn,e=>e.code===code);
const body=spec=>Buffer.from('CREATE OR REPLACE FUNCTION '+spec.signature.split('(')[0]+
 '(p_character_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN '+
 "'{}'::jsonb; END; $$;\n-- synthetic-not-original: "+spec.key.padEnd(45,'.'));
const mock=()=>Object.fromEntries([
 ['postgres_version_num.txt',Buffer.from('170005\n')],
 ...ORIGINALS.map(s=>[s.filename,body(s)])
]);
const pins=()=>ORIGINALS.map(s=>({...s,md5:H('md5',body(s))}));
const options=(inputDir,outputDir)=>({
 inputDir,outputDir,backupId:'synthetic-offline-backup',restoreReceipt:'synthetic-offline-receipt'
});
const mk=()=>fs.mkdtempSync(path.join(os.tmpdir(),'i2j-p7-'));
test('I2J-P7-01 exact three original deployed-function fingerprints unchanged',()=>{
 assert.deepEqual(ORIGINALS.map(s=>s.md5),[
 '28a227a1dfb9a3cc5516c5b7afb874b0',
 '32fa55b69478af07f8f0002b967a5704',
 '05f6d19a7e2f45d890c62c27cb419e7f']);
});
test('I2J-P7-02 old P4 executable database CLI is disabled even with prior ack',()=>{
 const script=fileURLToPath(new URL('./i2j_p4_offline_original_functions_export.mjs',import.meta.url));
 const result=spawnSync(process.execPath,[script,'--ack-offline-restored-pg17'],{encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/OFFLINE_DATABASE_CONNECTION_CLI_DISABLED_USE_P7_FILE_ONLY_INTAKE/);
 const source=fs.readFileSync(script,'utf8');
 assert.doesNotMatch(source,/node:child_process|\bspawnSync\s*\(|\bexecSync\s*\(|\bloopbackPsql\s*\(/);
});
test('I2J-P7-03 CLI requires explicit file-only acknowledgement',()=>{
 bad('EXPLICIT_OFFLINE_FILE_ACK_REQUIRED',()=>parseP7Options([]));
});
test('I2J-P7-04 remote host, arbitrary SQL, and PG port flags rejected',()=>{
 const args=['--ack-file-only-offline-pg17','--input-dir','/tmp/a','--output-dir','/tmp/b',
  '--backup-id','test-backup-id','--restore-receipt','test-receipt-id'];
 bad('INVALID_OPTION',()=>parseP7Options([...args,'--host','prod-db']));
 bad('INVALID_OPTION',()=>parseP7Options([...args,'--local-port','5432']));
 bad('INVALID_OPTION',()=>parseP7Options([...args,'--sql','SELECT']));
});
test('I2J-P7-05 only absolute paths and non-overlapping folders',()=>{
 const base=['--ack-file-only-offline-pg17','--backup-id','test-backup-id','--restore-receipt','test-receipt-id'];
 bad('ABSOLUTE_DIRECTORY_REQUIRED',()=>parseP7Options([...base,'--input-dir','relative','--output-dir','/tmp/b']));
 bad('OUTPUT_OVERLAPS_INPUT',()=>parseP7Options([...base,'--input-dir','/tmp/a','--output-dir','/tmp/a/output']));
});
test('I2J-P7-06 missing or partial original raw inputs are rejected',()=>{
 const missing=mock();delete missing[ORIGINALS[2].filename];
 bad('MISSING_OR_EXTRA_RAW_INPUT',()=>validateRawOfflineInputs(missing,pins()));
});
test('I2J-P7-07 PostgreSQL 16/18 and forged version text rejected',()=>{
 for(const v of ['160018','180001','17x001','12000']){
  const f=mock();f['postgres_version_num.txt']=Buffer.from(v);
  bad('NOT_PG17',()=>validateRawOfflineInputs(f,pins()));
 }
});
test('I2J-P7-08 synthetic functions never pass immutable CLI fingerprints',()=>{
 bad('HISTORICAL_MD5_MISMATCH_LEVELUP_V2',()=>validateRawOfflineInputs(mock()));
});
test('I2J-P7-09 mock hashes can validate source shape only in test-import API',()=>{
 const accepted=validateRawOfflineInputs(mock(),pins());
 assert.equal(accepted.length,3);
 assert.equal(accepted[0].sha256,H('sha256',body(ORIGINALS[0])));
});
test('I2J-P7-10 altered SQL text with forged matching hash is rejected by original pins',()=>{
 const f=mock();f[ORIGINALS[1].filename]=Buffer.from(body(ORIGINALS[1]).toString()+'\n');
 bad('HISTORICAL_MD5_MISMATCH_LEVELUP_V2',()=>validateRawOfflineInputs(f));
});
test('I2J-P7-11 wrong SQL identity rejected independently',()=>{
 const f=mock(),s=ORIGINALS[1];
 f[s.filename]=Buffer.from(body(s).toString('utf8').replace(s.signature.split('(')[0],'public.other_name'));
 bad('WRONG_FUNCTION_IDENTITY_WEAPON_MASTERY',()=>validateRawOfflineInputs(f,pins()));
});
test('I2J-P7-12 input directory rejects symlink file and unknown extra entry',()=>{
 const d=mk();try{
  for(const [p,bytes] of Object.entries(mock()))fs.writeFileSync(path.join(d,p),bytes);
  assert.deepEqual(Object.keys(readRawOfflineInputs(d)).sort(),Object.keys(mock()).sort());
  fs.writeFileSync(path.join(d,'extra'),Buffer.from('unsafe'));
  bad('MISSING_OR_EXTRA_RAW_INPUT',()=>readRawOfflineInputs(d));
  fs.unlinkSync(path.join(d,'extra'));
  fs.unlinkSync(path.join(d,ORIGINALS[0].filename));
  fs.symlinkSync(path.join(d,ORIGINALS[1].filename),path.join(d,ORIGINALS[0].filename));
  bad('UNSAFE_RAW_INPUT',()=>readRawOfflineInputs(d));
 }finally{fs.rmSync(d,{recursive:true,force:true});}
});
test('I2J-P7-13 source folder under repository rejected',()=>{
 bad('SOURCE_EVIDENCE_INSIDE_REPO',()=>readRawOfflineInputs(process.cwd()));
});
test('I2J-P7-14 exact existing raw inputs yield private P5-compatible candidate only',()=>{
 const input=mk(),parent=mk(),out=path.join(parent,'candidate');
 try{
  for(const [name,bytes] of Object.entries(mock()))fs.writeFileSync(path.join(input,name),bytes);
  const accepted=validateRawOfflineInputs(readRawOfflineInputs(input),pins());
  const result=writeP7CandidateBundle(options(input,out),accepted);
  assert.equal(result.status,'SOURCE_MATCH_CANDIDATE_ONLY');
  assert.equal(result.signed_red_green_executed,false);
  assert.equal(result.production_release_allowed,false);
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'levelup_v2_manifest.json'),'utf8'));
  assert.equal(manifest.source_type,'independent_restored_pg17_pg_get_functiondef');
  assert.equal(manifest.production_release_allowed,false);
  assert.equal(manifest.function_md5,H('md5',body(ORIGINALS[0])));
  assert.equal(fs.readdirSync(out).length,6);
  bad('OUTPUT_ALREADY_EXISTS',()=>writeP7CandidateBundle(options(input,out),accepted));
  // P5 still rejects synthetic specimens on real pinned original MD5.
  bad('ORIGINAL_MD5_MISMATCH_LEVELUP_V2',()=>inspectOfflineBundleDirectory(out));
 }finally{fs.rmSync(input,{recursive:true,force:true});fs.rmSync(parent,{recursive:true,force:true});}
});
test('I2J-P7-15 missing authentic source cannot create candidate output',()=>{
 const input=mk(),parent=mk(),out=path.join(parent,'candidate');
 try{
  for(const [name,bytes] of Object.entries(mock()))fs.writeFileSync(path.join(input,name),bytes);
  bad('HISTORICAL_MD5_MISMATCH_LEVELUP_V2',()=>packageExistingOfflineFiles(options(input,out)));
  assert.equal(fs.existsSync(out),false);
 }finally{fs.rmSync(input,{recursive:true,force:true});fs.rmSync(parent,{recursive:true,force:true});}
});
test('I2J-P7-16 dangerous P4 subprocess cannot be reintroduced via P7',()=>{
 const p=fileURLToPath(new URL('./i2j_p7_file_only_original_source_intake.mjs',import.meta.url));
 const src=fs.readFileSync(p,'utf8');
 assert.doesNotMatch(src,/\b(?:from|require\s*\()\s*['"]node:child_process|\bspawnSync\s*\(|\bexecSync\s*\(|\bfetch\s*\(|\bpg_get_functiondef\s*\(|\bhttp\s*\./i);
 assert.match(src,/from '\.\/i2j_original_function_pins\.mjs'/);
});

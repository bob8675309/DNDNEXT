// I2J-P7: package ONLY preexisting, original-PG17 function text files.
// NO SQL, psql, child_process, network, live database, or credentials.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ORIGINALS} from './i2j_original_function_pins.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const inputNames=Object.freeze(['postgres_version_num.txt',...ORIGINALS.map(s=>s.filename)].sort());
const fail=code=>{const e=new Error('I2J-P7 file-only intake rejected: '+code);e.code=code;throw e;};
const hash=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
const inside=(p,base)=>{const r=path.relative(base,p);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
const utf8=bytes=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('INVALID_UTF8');}};
const isValidId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(x);
function fixedLocation(p){
 if(typeof p!=='string'||!path.isAbsolute(p)||p==='/'||p.includes('\0'))fail('ABSOLUTE_DIRECTORY_REQUIRED');
 return path.resolve(p);
}
export function parseP7Options(argv){
 const args=new Map([['--input-dir','inputDir'],['--output-dir','outputDir'],['--backup-id','backupId'],['--restore-receipt','restoreReceipt']]);
 const seen=new Set();let acknowledged=false;const out={};
 for(let i=0;i<argv.length;i++){
  const key=argv[i];
  if(key==='--ack-file-only-offline-pg17'){if(acknowledged)fail('DUPLICATE_ACK');acknowledged=true;continue;}
  if(!args.has(key)||seen.has(key)||i===argv.length-1||argv[i+1].startsWith('--'))fail('INVALID_OPTION');
  seen.add(key);out[args.get(key)]=argv[++i];
 }
 if(!acknowledged)fail('EXPLICIT_OFFLINE_FILE_ACK_REQUIRED');
 if(!isValidId(out.backupId)||!isValidId(out.restoreReceipt))fail('RESTORE_CLAIMS_REQUIRED');
 out.inputDir=fixedLocation(out.inputDir);
 out.outputDir=fixedLocation(out.outputDir);
 if(out.inputDir===out.outputDir||inside(out.outputDir,out.inputDir))fail('OUTPUT_OVERLAPS_INPUT');
 return Object.freeze(out);
}
function inspectDir(dir){
 let st;try{st=fs.lstatSync(dir);}catch{fail('INPUT_DIR_NOT_FOUND');}
 if(st.isSymbolicLink()||!st.isDirectory())fail('UNSAFE_INPUT_DIRECTORY');
 const real=fs.realpathSync(dir);
 if(inside(real,root))fail('SOURCE_EVIDENCE_INSIDE_REPO');
 return real;
}
export function readRawOfflineInputs(inputDir){
 const real=inspectDir(fixedLocation(inputDir));
 if(fs.readdirSync(real).sort().join('\0')!==inputNames.join('\0'))fail('MISSING_OR_EXTRA_RAW_INPUT');
 if(typeof fs.constants.O_NOFOLLOW!=='number')fail('NOFOLLOW_UNAVAILABLE');
 const out={};
 for(const name of inputNames){
  const p=path.join(real,name);
  const prior=fs.lstatSync(p);
  if(!prior.isFile()||prior.isSymbolicLink()||prior.size>250000)fail('UNSAFE_RAW_INPUT');
  let fd;
  try{fd=fs.openSync(p,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);}catch{fail('UNSAFE_RAW_INPUT');}
  try{
   const actual=fs.fstatSync(fd);
   if(!actual.isFile()||actual.ino!==prior.ino||actual.dev!==prior.dev||actual.size>250000)
    fail('INPUT_CHANGED_DURING_OPEN');
   out[name]=fs.readFileSync(fd);
   if(out[name].length!==actual.size)fail('INPUT_CHANGED_DURING_READ');
  }finally{fs.closeSync(fd);}
 }
 return out;
}
// Testing permits synthetic pins in this pure function. CLI ALWAYS uses ORIGINALS.
export function validateRawOfflineInputs(files,expected=ORIGINALS){
 if(!files||typeof files!=='object'||Array.isArray(files)||
    Object.keys(files).sort().join('\0')!==inputNames.join('\0'))fail('MISSING_OR_EXTRA_RAW_INPUT');
 const vb=files['postgres_version_num.txt'];
 if(!Buffer.isBuffer(vb)||vb.length>12)fail('INVALID_VERSION_TEXT');
 const version=utf8(vb).trim();
 if(!/^\d{6}$/.test(version)||Number(version)<170000||Number(version)>=180000)fail('NOT_PG17');
 if(!Array.isArray(expected)||expected.length!==ORIGINALS.length)fail('INVALID_SOURCE_SET');
 const accepted=[];
 for(let i=0;i<ORIGINALS.length;i++){
  const spec=expected[i],original=ORIGINALS[i];
  if(spec.key!==original.key||spec.signature!==original.signature||spec.filename!==original.filename||
     spec.manifestVersion!==original.manifestVersion)fail('SOURCE_IDENTITY_OVERRIDE');
  const b=files[spec.filename];
  if(!Buffer.isBuffer(b)||b.length<120||b.length>250000)fail('INVALID_FUNCTION_BYTES');
  const text=utf8(b);
  const qualified=spec.signature.slice(0,spec.signature.indexOf('(')).replaceAll('.','\\.');
  if(!new RegExp('^\\s*CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+'+qualified+'\\s*\\(','i').test(text))
   fail('WRONG_FUNCTION_IDENTITY_'+spec.key.toUpperCase());
  const md5=hash('md5',b);
  if(md5!==spec.md5)fail('HISTORICAL_MD5_MISMATCH_'+spec.key.toUpperCase());
  accepted.push(Object.freeze({spec:original,text,md5,sha256:hash('sha256',b)}));
 }
 return Object.freeze(accepted);
}
export function writeP7CandidateBundle(opts,accepted){
 if(!Array.isArray(accepted)||accepted.length!==ORIGINALS.length||
    accepted.some((x,i)=>x.spec!==ORIGINALS[i]))fail('INCOMPLETE_CANDIDATE');
 const output=fixedLocation(opts.outputDir), input=fixedLocation(opts.inputDir);
 if(output===input||inside(output,input))fail('OUTPUT_OVERLAPS_INPUT');
 const inputReal=inspectDir(input);
 const parent=path.dirname(output);
 let realParent;try{realParent=fs.realpathSync(parent);}catch{fail('OUTPUT_PARENT_NOT_FOUND');}
 if(inside(realParent,root)||inside(path.join(realParent,path.basename(output)),inputReal))
  fail('UNSAFE_OUTPUT_PARENT');
 if(fs.existsSync(output))fail('OUTPUT_ALREADY_EXISTS');
 fs.mkdirSync(output,{mode:0o700,recursive:false});
 try{
  for(const {spec,text,md5,sha256} of accepted){
   const manifest={
    manifest_version:spec.manifestVersion,source_type:'independent_restored_pg17_pg_get_functiondef',
    postgres_major:17,function_identity:spec.signature,backup_id:opts.backupId,
    restore_receipt:opts.restoreReceipt,function_sha256:sha256,function_md5:md5,
    evidence_class:'LOCAL_OPERATOR_CLAIM_ONLY_NOT_INDEPENDENTLY_AUTHENTICATED',
    signed_transaction_executed:false,production_release_allowed:false
   };
   fs.writeFileSync(path.join(output,spec.filename),text,{encoding:'utf8',flag:'wx',mode:0o600});
   fs.writeFileSync(path.join(output,spec.key+'_manifest.json'),
    JSON.stringify(manifest,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
  }
 }catch(e){fs.rmSync(output,{recursive:true,force:true});throw e;}
 return Object.freeze({status:'SOURCE_MATCH_CANDIDATE_ONLY',
  imported_originals:accepted.length,backup_origin_verified:false,
  signed_red_green_executed:false,production_release_allowed:false});
}
export function packageExistingOfflineFiles(opts){
 const inputs=readRawOfflineInputs(opts.inputDir);
 const verified=validateRawOfflineInputs(inputs);
 return writeP7CandidateBundle(opts,verified);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  const opts=parseP7Options(process.argv.slice(2));
  process.stdout.write(JSON.stringify(packageExistingOfflineFiles(opts),null,2)+'\n');
 }catch(e){process.stderr.write((e.code||'OFFLINE_SOURCE_INTAKE_BLOCKED')+'\n');process.exitCode=1;}
}

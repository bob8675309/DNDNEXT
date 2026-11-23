// I2J-P5: inert review of three existing offline function/source manifests.
// No SQL, psql, network, child processes, database credentials or filesystem writes.
// Match means source candidate ONLY, never authenticated backup/signed PG17/release.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ORIGINALS} from './i2j_original_function_pins.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash=(alg,b)=>createHash(alg).update(b).digest('hex');
const fail=code=>{const e=new Error('I2J-P5 rejected: '+code);e.code=code;throw e;};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const names=ORIGINALS.flatMap(x=>[x.filename,x.key+'_manifest.json']).sort();
const keys='backup_id evidence_class function_identity function_md5 function_sha256 manifest_version postgres_major production_release_allowed restore_receipt signed_transaction_executed source_type'.split(' ').sort();
const validUtf8=b=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(b);}catch{fail('NON_UTF8_ARTIFACT');}};
function inside(p,folder){const r=path.relative(folder,p);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));}
export function parseBundleCli(args){
 if(args.length!==2||args[0]!=='--bundle-dir')fail('ONLY_BUNDLE_DIR_ALLOWED');
 if(!path.isAbsolute(args[1])||args[1]==='/'||args[1].includes('\0'))fail('ABSOLUTE_BUNDLE_DIR_REQUIRED');
 return args[1];
}
export function readBundleFiles(dir){
 if(typeof dir!=='string'||!path.isAbsolute(dir))fail('ABSOLUTE_BUNDLE_DIR_REQUIRED');
 let stat;try{stat=fs.lstatSync(dir);}catch{fail('BUNDLE_NOT_FOUND');}
 if(stat.isSymbolicLink()||!stat.isDirectory())fail('UNSAFE_BUNDLE_DIRECTORY');
 const actual=fs.realpathSync(dir);
 if(inside(actual,root))fail('REFUSE_IN_REPOSITORY_EVIDENCE');
 if(fs.readdirSync(actual).sort().join('\0')!==names.join('\0'))fail('BUNDLE_FILE_SET_MISMATCH');
 const files={};
 for(const name of names){
  const p=path.join(actual,name),s=fs.lstatSync(p);
  if(!s.isFile()||s.isSymbolicLink()||s.size>250000)fail('UNSAFE_EVIDENCE_FILE');
  // Fail closed where O_NOFOLLOW is unavailable. Never trust a pathname
  // after lstat alone: it could be replaced with a symlink before open().
  if(typeof fs.constants.O_NOFOLLOW!=='number')fail('NOFOLLOW_UNAVAILABLE');
  let fd;
  try{fd=fs.openSync(p,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);}
  catch{fail('UNSAFE_EVIDENCE_FILE');}
  try{
   const opened=fs.fstatSync(fd);
   if(!opened.isFile()||opened.size>250000||opened.dev!==s.dev||opened.ino!==s.ino)
    fail('EVIDENCE_FILE_CHANGED_WHILE_OPENING');
   files[name]=fs.readFileSync(fd);
   if(files[name].length!==opened.size)fail('EVIDENCE_FILE_CHANGED_WHILE_READING');
  }finally{fs.closeSync(fd);}

 }
 return files;
}
// expected hash pins can be overridden ONLY by synthetic callers of this
// exported pure function. The CLI ALWAYS invokes the immutable ORIGINALS.
export function inspectBundleFiles(files,expected=ORIGINALS){
 if(!object(files)||!Array.isArray(expected)||expected.length!==3)fail('INVALID_BUNDLE_INPUT');
 if(Object.keys(files).sort().join('\0')!==names.join('\0'))fail('BUNDLE_FILE_SET_MISMATCH');
 const reviewed=[];let backup=null,receipt=null;
 for(const s of expected){
  const origin=ORIGINALS.find(x=>x.key===s.key);
  if(!origin||origin.signature!==s.signature||origin.filename!==s.filename)fail('UNEXPECTED_SOURCE_SPEC');
  const b=files[s.filename];
  if(!Buffer.isBuffer(b)||b.length<120||b.length>250000)fail('INVALID_FUNCTION_FILE');
  const sql=validUtf8(b);
  const qualifiedName=s.signature.slice(0,s.signature.indexOf('('));
  const regex=new RegExp('^\\s*CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+'+
   qualifiedName.replaceAll('.','\\.')+'\\s*\\(','i');
  if(!regex.test(sql))fail('WRONG_FUNCTION_IDENTITY_'+s.key.toUpperCase());
  const mBuf=files[s.key+'_manifest.json'];
  if(!Buffer.isBuffer(mBuf)||mBuf.length>12000)fail('INVALID_MANIFEST_FILE');
  let m;try{m=JSON.parse(validUtf8(mBuf));}catch{fail('INVALID_MANIFEST_JSON');}
  if(!object(m)||Object.keys(m).sort().join('\0')!==keys.join('\0'))fail('INVALID_MANIFEST_KEYS');
  if(m.manifest_version!==s.manifestVersion||
     m.source_type!=='independent_restored_pg17_pg_get_functiondef'||
     m.postgres_major!==17||m.function_identity!==s.signature||
     m.evidence_class!=='LOCAL_OPERATOR_CLAIM_ONLY_NOT_INDEPENDENTLY_AUTHENTICATED'||
     m.signed_transaction_executed!==false||
     m.production_release_allowed!==false)fail('UNTRUSTED_MANIFEST_CLAIM');
  if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(m.backup_id||'')||
     !/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(m.restore_receipt||''))
   fail('INVALID_BACKUP_RECEIPT');
  if(!/^[a-f0-9]{32}$/.test(m.function_md5||'')||
     !/^[a-f0-9]{64}$/.test(m.function_sha256||''))fail('BAD_HASH_FORMAT');
  if(hash('md5',b)!==m.function_md5||hash('sha256',b)!==m.function_sha256)
   fail('FUNCTION_BYTES_TAMPERED_'+s.key.toUpperCase());
  if(m.function_md5!==s.md5)fail('ORIGINAL_MD5_MISMATCH_'+s.key.toUpperCase());
  if(backup===null){backup=m.backup_id;receipt=m.restore_receipt;}
  else if(m.backup_id!==backup||m.restore_receipt!==receipt)fail('MIXED_BACKUP_LINEAGE');
  reviewed.push(Object.freeze({key:s.key,function_sha256:m.function_sha256,original_md5:m.function_md5}));
 }
 return Object.freeze({status:'CANDIDATE_ONLY_NOT_AUTHORIZED',
  functions:Object.freeze(reviewed),restore_identifiers_consistent:true,
  backup_origin_independently_verified:false,original_role_schema_trigger_equivalence_tested:false,
  signed_original_red_green_executed:false,production_release_allowed:false});
}
export function inspectOfflineBundleDirectory(dir){return inspectBundleFiles(readBundleFiles(dir));}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{process.stdout.write(JSON.stringify(inspectOfflineBundleDirectory(parseBundleCli(process.argv.slice(2))),null,2)+'\n');}
 catch(e){process.stderr.write((e.code||'UNVERIFIED_BUNDLE')+'\n');process.exitCode=1;}
}

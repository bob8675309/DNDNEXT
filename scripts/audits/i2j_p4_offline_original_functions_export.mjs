// I2J-P4 OFFLINE-ONLY export kit. Must never run on hosted/production DB.
// This program executes local read-only SQL only if an operator opts in and
// supplies an independently restored PostgreSQL 17 bound to loopback.
// CI runs ONLY pure synthetic unit tests; it NEVER calls this CLI.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const ORIGINALS=Object.freeze([
 Object.freeze({key:'levelup_v2',signature:'public.complete_character_level_up_v2(uuid,jsonb)',md5:'28a227a1dfb9a3cc5516c5b7afb874b0',filename:'offline_v2_function.txt',manifestVersion:'i2j-v2-offline-pg17-evidence-v1'}),
 Object.freeze({key:'weapon_mastery',signature:'public.configure_character_weapon_mastery_v1(uuid,uuid[])',md5:'32fa55b69478af07f8f0002b967a5704',filename:'offline_weapon_mastery_function.txt',manifestVersion:'i2j-p4-offline-pg17-evidence-v1'}),
 Object.freeze({key:'invocation_recovery',signature:'public.recover_character_invocations_v1(uuid,jsonb)',md5:'05f6d19a7e2f45d890c62c27cb419e7f',filename:'offline_invocation_recovery_function.txt',manifestVersion:'i2j-p4-offline-pg17-evidence-v1'})
]);
const fail=code=>{const e=new Error('I2J-P4 offline extraction REFUSED: '+code);e.code=code;throw e;};
const hex=s=>createHash('sha256').update(s,'utf8').digest('hex');
const md5=s=>createHash('md5').update(s,'utf8').digest('hex');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const isUnderRoot=x=>{const d=path.relative(root,x);return d===''||(!d.startsWith('..'+path.sep)&&d!=='..'&&!path.isAbsolute(d));};
function validName(s){return typeof s==='string'&&/^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(s);}
export function parseLocalOptions(argv){
 const names=new Map([['--local-port','port'],['--db-user','user'],['--db-name','database'],['--output-dir','outputDir'],['--backup-id','backupId'],['--restore-receipt','restoreReceipt']]);
 const opts={port:'54322',user:'postgres',database:'postgres'};
 let ack=false;
 const seen=new Set();
 for(let i=0;i<argv.length;i++){
  const key=argv[i];
  if(key==='--ack-offline-restored-pg17'){if(ack)fail('DUPLICATE_ACK');ack=true;continue;}
  if(!names.has(key)||seen.has(key)||i+1>=argv.length||argv[i+1].startsWith('--'))fail('INVALID_CLI_OPTIONS');
  seen.add(key);opts[names.get(key)]=argv[++i];
 }
 if(!ack)fail('EXPLICIT_LOCAL_RESTORE_ACK_REQUIRED');
 if(!Number.isInteger(Number(opts.port))||Number(opts.port)<1024||Number(opts.port)>65535)fail('INVALID_LOCAL_PORT');
 if(!validName(opts.user)||!validName(opts.database))fail('INVALID_LOCAL_DB_IDENTITY');
 if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(opts.backupId||''))fail('BACKUP_ID_REQUIRED');
 if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(opts.restoreReceipt||''))fail('RESTORE_RECEIPT_REQUIRED');
 if(typeof opts.outputDir!=='string'||!path.isAbsolute(opts.outputDir)||opts.outputDir==='/'||opts.outputDir.includes('\0'))fail('ABSOLUTE_OUTPUT_DIRECTORY_REQUIRED');
 const normalized=path.resolve(opts.outputDir);
 const parent=path.dirname(normalized);
 if(!fs.existsSync(parent))fail('EXISTING_OUTPUT_PARENT_REQUIRED');
 const realParent=fs.realpathSync(parent);
 if(isUnderRoot(path.join(realParent,path.basename(normalized))))fail('REFUSE_WRITE_INSIDE_GIT_REPOSITORY');
 if(fs.existsSync(normalized))fail('OUTPUT_DIRECTORY_ALREADY_EXISTS');
 opts.outputDir=normalized;
 return Object.freeze(opts);
}
export function readOnlySql(spec){
 if(!ORIGINALS.includes(spec))fail('UNKNOWN_FUNCTION');
 // Function identifier is a constant, never assembled from operator input.
 return "SELECT regexp_replace(encode(convert_to(pg_get_functiondef('"+
  spec.signature+"'::regprocedure),'UTF8'),'base64'),'[[:space:]]','','g')";
}
export function decodeExactFunctionBase64(stdout){
 if(typeof stdout!=='string')fail('MISSING_LOCAL_FUNCTION_TEXT');
 const encoded=stdout.trim();
 if(!encoded||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))fail('INVALID_FUNCTION_BASE64');
 const bytes=Buffer.from(encoded,'base64');
 if(bytes.toString('base64')!==encoded||bytes.length<120||bytes.length>250000)fail('INVALID_FUNCTION_BYTES');
 let content;
 try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('FUNCTION_NOT_UTF8');}
 if(!/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\./i.test(content.trim()))fail('FUNCTION_DEFINITION_NOT_FOUND');
 return content;
}
export function assessOfflineSourceOutputs({serverVersion,outputs,expectedMd5=null}){
 const major=Number(String(serverVersion).trim());
 if(!Number.isInteger(major)||major<170000||major>=180000)fail('NOT_POSTGRESQL_17');
 const accepted=[];
 for(const spec of ORIGINALS){
  const body=decodeExactFunctionBase64(outputs?.[spec.key]);
  // Unit tests can inject synthetic fingerprints; the CLI never passes this.
  const expected=expectedMd5?.[spec.key]||spec.md5;
  const actual=md5(body);
  if(actual!==expected)fail('ORIGINAL_FINGERPRINT_MISMATCH_'+spec.key.toUpperCase());
  if(!body.trim().toLowerCase().startsWith('create or replace function '+spec.signature.split('(')[0].toLowerCase()+'(') &&
     !body.trim().toLowerCase().startsWith('create function '+spec.signature.split('(')[0].toLowerCase()+'('))
   fail('FUNCTION_IDENTITY_MISMATCH_'+spec.key.toUpperCase());
  accepted.push(Object.freeze({spec,body,md5:actual,sha256:hex(body)}));
 }
 return Object.freeze(accepted);
}
export function writeOfflineBundle(options,accepted){
 if(!Array.isArray(accepted)||accepted.length!==ORIGINALS.length||
    accepted.some((x,i)=>x.spec!==ORIGINALS[i]))fail('INCOMPLETE_SOURCE_SET');
 // Recheck: user may have created output folder since preflight.
 if(fs.existsSync(options.outputDir))fail('OUTPUT_DIRECTORY_ALREADY_EXISTS');
 fs.mkdirSync(options.outputDir,{recursive:false,mode:0o700});
 try{
  for(const {spec,body,md5:md5Value,sha256} of accepted){
   const sourcePath=path.join(options.outputDir,spec.filename);
   const manifestPath=path.join(options.outputDir,spec.key+'_manifest.json');
   const manifest={
    manifest_version:spec.manifestVersion,
    source_type:'independent_restored_pg17_pg_get_functiondef',
    postgres_major:17,
    function_identity:spec.signature,
    backup_id:options.backupId,
    restore_receipt:options.restoreReceipt,
    function_sha256:sha256,
    function_md5:md5Value,
    evidence_class:'LOCAL_OPERATOR_CLAIM_ONLY_NOT_INDEPENDENTLY_AUTHENTICATED',
    signed_transaction_executed:false,
    production_release_allowed:false
   };
   fs.writeFileSync(sourcePath,body,{encoding:'utf8',flag:'wx',mode:0o600});
   fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
  }
 }catch(e){fs.rmSync(options.outputDir,{recursive:true,force:true});throw e;}
 return Object.freeze({status:'SOURCE_MATCH_CANDIDATE_ONLY',exportedCount:accepted.length,
  root:options.outputDir,independent_backup_provenance_verified:false,
  signed_pg17_tests_executed:false,production_release_allowed:false});
}
export function runOfflineExtract(options,queryRunner){
 if(typeof queryRunner!=='function')fail('QUERY_RUNNER_REQUIRED');
 const ver=queryRunner('SELECT current_setting('+ "'server_version_num'"+')',options);
 const outputs={};
 for(const spec of ORIGINALS)outputs[spec.key]=queryRunner(readOnlySql(spec),options);
 const accepted=assessOfflineSourceOutputs({serverVersion:ver,outputs});
 return writeOfflineBundle(options,accepted);
}
export function loopbackPsql(sql,options){
 // No arbitrary hostname, URL, connection-string database, PG env injection,
 // shell execution, psql stdin, or hidden service-file override.
 const env={PATH:process.env.PATH||'',HOME:process.env.HOME||'',LANG:'C',
  LC_ALL:'C',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'4'};
 const result=spawnSync('psql',['-X','-w','-q','-A','-t','-P','footer=off',
  '-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(options.port),
  '-U',options.user,'-d',options.database,'-c',sql],
  {env,encoding:'utf8',timeout:12000,maxBuffer:650000,shell:false});
 if(result.error||result.status!==0)fail('LOCAL_PSQL_QUERY_FAILED');
 return result.stdout;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  const opts=parseLocalOptions(process.argv.slice(2));
  const status=runOfflineExtract(opts,loopbackPsql);
  // Function bodies, credential data and query output NEVER go to stdout.
  process.stdout.write(JSON.stringify(status,null,2)+'\n');
 }catch(e){
  process.stderr.write((e.code||'OFFLINE_EXTRACTION_REJECTED')+'\n');
  process.exitCode=1;
 }
}

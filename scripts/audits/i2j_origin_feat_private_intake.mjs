// Offline, read-only source intake. Never executes SQL or emits definitions.
import {createHash} from 'node:crypto';
import {readFileSync, realpathSync} from 'node:fs';
import {resolve, relative, isAbsolute, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const rows = [
 ['private','apply_level_up_warlock_invocations_v1','p_character_id uuid, p_to_level integer, p_selections jsonb, p_feat_instances jsonb','ed0655adf02e9413157efe8a8bd414f9',null],
 ['private','apply_source_owned_origin_feat_v1','p_character_id uuid, p_level integer, p_option_id uuid, p_instance jsonb, p_instance_key text, p_owner_type text, p_owner_key text','b7d69d8643a6b2ba2be8efbb4ee41243',['postgres=X/postgres','service_role=X/postgres']],
 ['private','level_up_warlock_invocation_groups_v1','p_character_id uuid, p_to_level integer','8b91253ca4ee176c0261ee9293ae9fae',null],
 ['private','normalize_player_choice_name_v1','p_value text','dd8cdd5b47efe99b1cfff9c2bf7635dd',['postgres=X/postgres','service_role=X/postgres']],
 ['private','origin_feat_choice_rows_v1','p_instance jsonb','057150d304d8176457a0f2d7c122e275',null],
 ['private','origin_feat_skill_choice_valid_v1','p_choice jsonb','834656a216b9ed35dec299ea694b58a2',null],
 ['private','origin_feat_spell_choice_v1','p_choice jsonb','221ff69a6cbc538ee858bee57255ce99',null],
 ['private','origin_feat_tool_choice_valid_v1','p_choice jsonb, p_mode text','8f8c4f640dea212ab2bd9dc04c46b823',null],
 ['private','player_sheet_skill_key_v1','p_value text','3b44b44ce828c6ac46ff9eaa935fa150',null],
 ['private','validate_source_owned_origin_feat_v1','p_character_id uuid, p_level integer, p_option_id uuid, p_instance jsonb','eee232817f6bd71eba8b92a1439a8ebf',['postgres=X/postgres','service_role=X/postgres']],
 ['public','is_preferred_spell_version_v1','p_spell_id uuid','68993ebe31db168b77329aea0f466c5d',['postgres=X/postgres','authenticated=X/postgres','service_role=X/postgres']],
 ['private','xphb_warlock_invocation_count_v1','p_level integer','61c83f0172b33386f0a50435c2fe1ddb',null],
 ['private','xphb_warlock_invocation_slot_level_v1','p_slot integer','942dd3a4e08b8874f3e42cbbb8323038',null]
];
export const pins=Object.freeze(rows.map(([schema,name,args,md5,acl])=>Object.freeze({schema,name,args,md5,owner:'postgres',acl:acl===null?null:Object.freeze(acl)})));
const hash=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
const aclKey=a=>a===null?'null':Array.isArray(a)&&a.every(v=>typeof v==='string')?JSON.stringify([...a].sort()):'invalid';
const identity=(s,n,a)=>s+'.'+n+'('+a+')';

export function verifySourceRows(input, expected=pins){
 if(!Array.isArray(input))throw new Error('expected a JSON array');
 if(input.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw new Error('invalid export row');
 const verified=[];
 for(const p of expected){
  const id=identity(p.schema,p.name,p.args);
  const matches=input.filter(r=>r.schema===p.schema&&r.name===p.name&&r.arguments===p.args);
  if(matches.length!==1)throw new Error('missing or duplicate pinned identity: '+id);
  const r=matches[0];
  if(typeof r.definition!=='string'||!r.definition.startsWith('CREATE OR REPLACE FUNCTION '+id+'\n'))throw new Error('definition identity mismatch: '+id);
  const bytes=Buffer.from(r.definition,'utf8');
  if(r.md5!==p.md5||hash('md5',bytes)!==p.md5)throw new Error('definition fingerprint mismatch: '+id);
  if(r.owner!==p.owner||aclKey(r.acl)!==aclKey(p.acl))throw new Error('exported owner/ACL mismatch: '+id);
  verified.push({identity:id,md5:p.md5,sha256:hash('sha256',bytes),bytes:bytes.length,owner:p.owner,aclMetadataMatches:true,aclRecordedAsNull:p.acl===null});
 }
 return {scope:'offline-export-text-and-metadata-only',verifiedCount:verified.length,verified,installedFingerprintVerified:false,effectivePrivilegesVerified:false,dependencyClosureVerified:false,signedExecution:false,releaseAllowed:false};
}

export function readPrivateExport(path,root=fileURLToPath(new URL('../../',import.meta.url))){
 const file=realpathSync(resolve(path));
 const rel=relative(realpathSync(root),file);
 if(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep))throw new Error('private source input must be outside the repository');
 // A UTF-8 BOM on the JSON envelope is not part of any definition.
 const raw=readFileSync(file);
 const decoded=new TextDecoder('utf-8',{fatal:true}).decode(raw);
 let parsed;
 try{parsed=JSON.parse(decoded);}catch{throw new Error('invalid export JSON');}
 return verifySourceRows(parsed);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)throw new Error('usage: node scripts/audits/i2j_origin_feat_private_intake.mjs <external-export.json>');
  // The CLI never writes files, prints source, or accepts alternative pins.
  console.log(JSON.stringify(readPrivateExport(process.argv[2]),null,2));
 }catch(error){
  // Node filesystem/decoder errors can expose private paths. Never print those.
  const message=error instanceof Error?error.message:'';
  const safe=/^(usage:|private source input|invalid export JSON|expected a JSON array|invalid export row|missing or duplicate pinned identity:|definition identity mismatch:|definition fingerprint mismatch:|exported owner\/ACL mismatch:)/.test(message);
  console.error('I2J private intake rejected: '+(safe?message:'unable to read UTF-8 export'));
  process.exitCode=1;
 }
}

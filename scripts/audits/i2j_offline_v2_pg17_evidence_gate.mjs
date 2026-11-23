// I2J-P1 OFFLINE existing-text-only gate. NEVER executes SQL or connects to a DB.
// SUCCESS = candidate-only, NEVER approved provenance or signed RED/GREEN.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const ORIGINAL_V2_MD5='28a227a1dfb9a3cc5516c5b7afb874b0';
export const ORIGINAL_V2_SIGNATURE='public.complete_character_level_up_v2(uuid,jsonb)';
const digest=(alg,s)=>createHash(alg).update(s,'utf8').digest('hex');
const fail=code=>{const e=new Error('I2J-P1 offline candidate rejected: '+code);e.code=code;throw e};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function inspectI2JV2OfflineEvidence({functionDef,manifest,expectedMd5=ORIGINAL_V2_MD5}){
 if(typeof functionDef!=='string'||!functionDef.trim())fail('FUNCTION_TEXT_REQUIRED');
 if(functionDef.length>250000)fail('FUNCTION_TEXT_TOO_LARGE');
 if(!isObj(manifest))fail('RESTORE_MANIFEST_REQUIRED');
 if(manifest.manifest_version!=='i2j-v2-offline-pg17-evidence-v1'||
    manifest.source_type!=='independent_restored_pg17_pg_get_functiondef'||
    manifest.postgres_major!==17||
    manifest.function_identity!==ORIGINAL_V2_SIGNATURE||
    typeof manifest.backup_id!=='string'||
    !/^[a-z0-9][a-z0-9_.:-]{7,127}$/i.test(manifest.backup_id)||
    typeof manifest.restore_receipt!=='string'||
    manifest.restore_receipt.trim().length<8||
    manifest.restore_receipt.length>2048)fail('RESTORE_PROVENANCE_INCOMPLETE');
 if(!/^[a-f0-9]{64}$/.test(manifest.function_sha256||'')||
    !/^[a-f0-9]{32}$/.test(manifest.function_md5||''))fail('RESTORE_HASHES_REQUIRED');
 const sha256=digest('sha256',functionDef);
 if(sha256!==manifest.function_sha256)fail('ARTIFACT_SHA256_DRIFT');
 if(digest('md5',functionDef)!==manifest.function_md5||
    manifest.function_md5!==expectedMd5)fail('ORIGINAL_V2_MD5_NOT_PROVEN');
 const def=functionDef.trim();
 if(!/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.complete_character_level_up_v2\s*\(/i.test(def))
  fail('NOT_ORIGINAL_V2_FUNCTION_EXPORT');
 if(!/\bRETURNS\s+jsonb\b/i.test(def)||
    !/\bLANGUAGE\s+plpgsql\b/i.test(def)||
    !/\bSECURITY\s+DEFINER\b/i.test(def))fail('FUNCTION_TYPE_OR_AUTHORITY_MISMATCH');
 const delim=/\bAS\s+\$([a-zA-Z0-9_]*)\$/i.exec(def);
 if(!delim)fail('PG_FUNCTION_BODY_MISSING');
 const marker='$'+delim[1]+'$';
 const begin=def.indexOf(marker,delim.index)+marker.length;
 const end=def.lastIndexOf(marker);
 if(end<=begin||end-begin<220)fail('PG_FUNCTION_BODY_INCOMPLETE');
 const body=def.slice(begin,end);
 if(!/\bprivate\.can_manage_character_progression_v1\s*\(\s*p_character_id\s*\)/i.test(body))
  fail('ORIGINAL_MANAGEMENT_GUARD_MISSING');
 if(!/\bpublic\.complete_character_level_up_v1\s*\(\s*p_character_id\s*,\s*v_selections\s*\)/i.test(body))
  fail('DELEGATED_V1_MIRROR_CALL_MISSING');
 if(!/\bprivate\.resolve_subclass_choice_v1\s*\(/i.test(body)||
    !/\bif\s+v_name\s+is\s+not\s+null\s+then\b/i.test(body))
  fail('SUBCLASS_SOURCE_GUARD_MISSING');
 if(!/\bupdate\s+public\.character_sheets\s+set\s+sheet\s*=\s*v_sheet/i.test(body))
  fail('CANONICAL_SUBCLASS_WRITE_MISSING');
 if(!/\bupdate\s+public\.players\s+p\s+set\s+sheet\s*=\s*v_sheet/i.test(body)||
    !/\bwhere\s+p\.user_id\s+in\s*\(\s*select\s+cp\.user_id\s+from\s+public\.character_permissions\s+cp\s+where\s+cp\.character_id\s*=\s*p_character_id/i.test(body))
  fail('LEGACY_ACCOUNT_FANOUT_SOURCE_MISSING');
 return Object.freeze({
  status:'CANDIDATE_ONLY_NOT_AUTHORIZED',
  function_sha256:sha256,
  original_v2_md5_matches_recorded_source:true,
  provided_restore_manifest_is_self_asserted:true,
  independent_backup_lineage_manually_verified:false,
  exact_restored_roles_and_schema_verified:false,
  delegated_v1_signed_retested:false,
  signed_v2_two_mirror_RED_GREEN_executed:false,
  production_release_allowed:false
 });
}
// CLI takes TWO preexisting local text files, no MD5 override, no SQL execution.
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  if(process.argv.length!==4)fail('TWO_OFFLINE_TEXT_PATHS_REQUIRED');
  const functionDef=readFileSync(process.argv[2],'utf8');
  const manifest=JSON.parse(readFileSync(process.argv[3],'utf8'));
  process.stdout.write(JSON.stringify(inspectI2JV2OfflineEvidence({functionDef,manifest}),null,2)+'\n');
 }catch(e){process.stderr.write((e.code||'UNVERIFIED_OFFLINE_EVIDENCE')+'\n');process.exitCode=1;}
}

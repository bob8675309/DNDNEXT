// C34 B14-P20C-P3 OFFLINE evidence gate, NOT a craft transaction.
// Inputs are inert text artifacts from a separately authorized independent
// PG17 restore. No database client, shell, network API, SQL execution,
// Supabase credentials, model-derived SQL, or production inspection.
//
// A PASS means ONLY that a supplied artifact has a plausible complete
// source definition and explicit SHA-256 provenance binding; never that
// backup identity or current live database/schema/cost policy is verified.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const sha256=s=>createHash("sha256").update(s,"utf8").digest("hex");
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const hex=/^[a-f0-9]{64}$/;
const tables=["players","player_plants","plants","player_wallets","player_recipes","recipes","inventory_items","craft_plans","crafting_attempts"];
const fail=(code)=>{const error=new Error("P20C-P3 offline source rejected: "+code);error.code=code;throw error;};
function matchedDefinition(sql){
 const sig=/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"?private"?\.)?"?complete_craft_plan_v1_impl"?\s*\(/gi;
 const matches=[...sql.matchAll(sig)];
 if(matches.length!==1)fail("ORIGINAL_IMPL_DEFINITION_COUNT");
 const after=sql.slice(matches[0].index);
 const next=/\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|TABLE|VIEW)\b/i.exec(after.slice(120));
 const segment=next?after.slice(0,120+next.index):after;
 if(!/\bRETURNS\s+jsonb\b/i.test(segment))fail("ORIGINAL_IMPL_RETURNS");
 if(!/\bLANGUAGE\s+plpgsql\b/i.test(segment))fail("ORIGINAL_IMPL_LANGUAGE");
 if(!/\bSECURITY\s+DEFINER\b/i.test(segment))fail("ORIGINAL_IMPL_SECURITY_NOT_REVIEWED");
 // pg_get_functiondef uses AS $tag$ ... $tag$ (the generated schema export
 // may have an additional harmless final semicolon). Require closing body.
 const body=segment.match(/\bAS\s+\$([a-z0-9_]*)\$/i);
 if(!body)fail("ORIGINAL_IMPL_BODY_MISSING");
 const delimiter="$"+body[1]+"$";
 const first=segment.indexOf(delimiter,body.index);
 const last=segment.lastIndexOf(delimiter);
 if(last<=first||last-first<800)fail("ORIGINAL_IMPL_BODY_TRUNCATED");
 // Structure sanity only, no attempt to interpret PostgreSQL.
 const bodyText=segment.slice(first+delimiter.length,last);
 for(const t of [/\bBEGIN\b/i,/\bEND\s*;/i,/\bv_plan\b/i,/\bv_attempt\b/i])
  if(!t.test(bodyText))fail("ORIGINAL_IMPL_STRUCTURE");
 return {bodyLength:bodyText.length,signature:segment.slice(0,first).trim()};
}
export function inspectP20CP3OfflineRestoreArtifacts({functionSql,schemaSql,manifest}){
 if(typeof functionSql!=="string"||!functionSql.trim())fail("FUNCTION_ARTIFACT_REQUIRED");
 if(typeof schemaSql!=="string"||!schemaSql.trim())fail("SCHEMA_ARTIFACT_REQUIRED");
 if(!isObject(manifest))fail("MANIFEST_REQUIRED");
 if(manifest.source_type!=="independent_offline_pg17_restore"||
    !/^[a-z0-9][a-z0-9_.:-]{7,127}$/i.test(manifest.backup_id||"")||
    manifest.postgres_major!==17)fail("UNVERIFIED_OFFLINE_ORIGIN");
 if(!hex.test(manifest.function_sha256||"")||!hex.test(manifest.schema_sha256||""))
  fail("HASH_MANIFEST_REQUIRED");
 if(sha256(functionSql)!==manifest.function_sha256||
    sha256(schemaSql)!==manifest.schema_sha256)fail("HASH_MISMATCH");
 if(/WARNING:\s*This schema is for context only and is not meant to be run/i.test(schemaSql))
  fail("HISTORICAL_CONTEXT_EXPORT_NOT_RESTORE");
 const found=[];
 for(const t of tables){
  if(!new RegExp("\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:\"?public\"?\\.)?\"?"+t+"\"?\\s*\\(","i").test(schemaSql))
   fail("SCHEMA_TABLE_MISSING_"+t.toUpperCase());
  found.push(t);
 }
 const impl=matchedDefinition(functionSql);
 if(/(?:https?:\/\/|supabase\.co|amazonaws\.com|\.supabase\.in)/i.test(manifest.backup_id))
  fail("NETWORK_IDENTIFIER_UNEXPECTED");
 return Object.freeze({
  status:"CANDIDATE_ONLY_NOT_AUTHORIZED",
  recovery_evidence_found:true,
  signed_pg17_test_run:false,
  backup_lineage_manually_verified:false,
  function_semantics_manually_verified:false,
  current_role_equivalence_tested:false,
  authoritative_craft_price_verified:false,
  plant_and_wallet_signed_consumption_tested:false,
  production_release_allowed:false,
  found_tables:Object.freeze(found),
  function_body_chars:impl.bodyLength,
  function_sha256:manifest.function_sha256,
  schema_sha256:manifest.schema_sha256,
  remaining_gates:Object.freeze([
   "verify independently restored backup lineage and current functions/grants",
   "inspect canonical function and source-owner predicates manually",
   "verify actual plant row identity, recipe unlocks, and craft GP cost",
   "run genuine local signed GoTrue/PostgREST PG17 owner/nonce/debit/rollback tests",
   "run separately reason-audited Admin/GM/DM override tests",
   "preserve original Forge, P20A/B, merchant and independent DB+Storage rollback gates"
  ])
 });
}
// Optional local CLI: three explicit preexisting TEXT files; only reads bytes.
// Usage: node this-file.mjs /path/offline_function.sql /path/offline_schema.sql /path/offline_manifest.json
// Output is status/sha evidence only, never the function body or credentials.
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  if(process.argv.length!==5)fail("THREE_LOCAL_INPUT_FILES_REQUIRED");
  const [func,schema,manifest]=process.argv.slice(2).map(p=>readFileSync(p,"utf8"));
  const result=inspectP20CP3OfflineRestoreArtifacts({
   functionSql:func,schemaSql:schema,manifest:JSON.parse(manifest)
  });
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
 }catch(e){
  process.stderr.write((e.code||"INVALID_OFFLINE_EVIDENCE")+"\n");
  process.exitCode=1;
 }
}

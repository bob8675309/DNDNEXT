import assert from "node:assert/strict";
import fs from "node:fs";
const original=fs.readFileSync("sql/20260810_90_rest_class_feature_restoration.sql","utf8");
const sql=fs.readFileSync("sql/20261024_07_attunement_canonical_rest_log_bridge.sql","utf8");
const tests=fs.readFileSync("scripts/fixtures/attunement_canonical_rest_log_bridge_behavior.sql","utf8");
const workflow=fs.readFileSync(".github/workflows/validate-campaign-attunement-policy.yml","utf8");
const begin="create or replace function public.complete_character_rest_v1";
const getBody=s=>{
  const start=s.indexOf(begin);
  const finish=s.indexOf("\n$$;",start);
  assert.ok(start>=0 && finish>start,"Canonical rest function source not found");
  return s.slice(start,finish+4).trim();
};
const sourceBody=getBody(original);
let newBody=getBody(sql)
.replace("  v_rest_log_id uuid;\n","")
.replace("  ) returning id into v_rest_log_id;","  );")
.replace("      'restLogId',v_rest_log_id,\n","");
assert.equal(newBody,sourceBody,"Canonical rest rules changed beyond additive returned restLogId");
for(const token of [
"revoke all on function public.complete_character_rest_v1(uuid,text) from public,anon",
"grant execute on function public.complete_character_rest_v1(uuid,text) to authenticated,service_role",
"private.attunement_focus_rest_links_v1","rest_logged_unverified",
"security invoker","private.current_user_is_admin()",
"private.can_manage_character_progression_v1(p_character_id)",
"pg_advisory_xact_lock","for update",
"public.complete_character_rest_v1(p_character_id,'short_rest')",
"v_rest_id:=nullif(v_rest#>>'{restResult,restLogId}'",
"'canCreateBond',false","'attunementQualified',false",
"revoke all on function private.record_attunement_focused_short_rest_v1(uuid,uuid)",
"to service_role"
]) assert.ok(sql.includes(token),"Missing safe rest bridge contract: "+token);
for(const term of [
"World hour not elapsed","Service without admin identity",
"Non-admin completed attunement rest","Canonical rest identity",
"Existing canonical Short Rest resource restoration regressed",
"Rest idempotent replay","Active encounter failed to block",
"Failed canonical rest mutated resources despite rollback",
"Canonical focused rest prematurely attuned magic",
"Atomic rest bridge exposed"
]) assert.ok(tests.includes(term),"Missing isolated SQL regression: "+term);
for(const term of [
"20261024_07_attunement_canonical_rest_log_bridge.sql",
"attunement_canonical_rest_log_bridge_behavior.sql",
"validate_attunement_rest_log_bridge.mjs"
]) assert.ok(workflow.includes(term),"CI path not wired: "+term);
console.log("Canonical rest body/source parity and staged transactional bridge contracts passed.");

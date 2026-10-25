import assert from "node:assert/strict";
import fs from "node:fs";
const sql=fs.readFileSync("sql/20261024_05_attunement_rest_class_evidence_readonly.sql","utf8");
const test=fs.readFileSync("scripts/fixtures/attunement_rest_class_evidence_behavior.sql","utf8");
const ci=fs.readFileSync(".github/workflows/validate-campaign-attunement-policy.yml","utf8");
for(const s of ["security invoker","public.character_progression","public.class_catalog","public.character_rest_log","canonical_rest_server_v1","short_rest","interval '1 hour'","identificationRestSeparate","'attunementReady',false","to service_role","revoke all on function private.attunement_rest_class_evidence_v1"]){
 assert.ok(sql.includes(s),"Missing secure source/rest contract: "+s);
}
for(const s of ["Fighter cannot qualify","Wizard prerequisite not projected","Generic short rest incorrectly","Incomplete exclusive focus","Synthetic qualified focus","Two items focused in a single short rest","Long rest falsely"]){
 assert.ok(test.includes(s),"Missing rest/class regression fixture: "+s);
}
for(const s of ["20261024_05_attunement_rest_class_evidence_readonly.sql","attunement_rest_class_evidence_behavior.sql","validate_attunement_rest_class_evidence.mjs"]){
 assert.ok(ci.includes(s),"Missing CI wiring: "+s);
}
console.log("Attunement source/rest evidence contract checks passed.");

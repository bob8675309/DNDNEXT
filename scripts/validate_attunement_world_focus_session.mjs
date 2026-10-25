import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync("sql/20261024_06_attunement_world_focus_session_foundation.sql","utf8");
const fixture=fs.readFileSync("scripts/fixtures/attunement_world_focus_session_behavior.sql","utf8");
const workflow=fs.readFileSync(".github/workflows/validate-campaign-attunement-policy.yml","utf8");
for(const term of ["private.attunement_focus_sessions_v1","public.world_state","private.assert_character_resource_not_active_v1","hashtextextended","request ID","started_world_time+interval '1 hour'","private.passive_equipment_source_gate_v1","private.attunement_rest_class_evidence_v1","'canCreateBond',false","to service_role","security invoker","world_clock_regressed","source_owner_or_class_invalid"]){
 assert.ok(source.includes(term),"Missing secure attempt contract: "+term);
}
for(const term of ["59 game minutes","Simultaneous second attunement","Active encounter resource guard","Rewound world clock","Aborted request ID","Transferred item allowed","Focus progress wrote a false completed rest","Private focus operations exposed"]){
 assert.ok(fixture.includes(term),"Missing behavior fixture "+term);
}
for(const term of ["20261024_06_attunement_world_focus_session_foundation.sql","attunement_world_focus_session_behavior.sql","validate_attunement_world_focus_session.mjs"]){
 assert.ok(workflow.includes(term),"Missing CI integration "+term);
}
assert.ok(!source.includes("insert into public.character_rest_log"));
assert.ok(!source.includes("insert into public.character_item_attunements"));
assert.ok(!source.includes("public.complete_character_rest_v1("));
console.log("Game-clock focus session source contract passed; behavior requires isolated PostgreSQL.");

import fs from "node:fs";
import assert from "node:assert/strict";

const manifest=JSON.parse(fs.readFileSync("scripts/fixtures/verified_item_attunement_2024.json","utf8"));
const sql=fs.readFileSync("sql/20261024_04_verified_attunement_source_rules.sql","utf8");
const projection=fs.readFileSync("sql/20261024_03_passive_equipment_effect_gate_readonly.sql","utf8");
const fixture=fs.readFileSync("scripts/fixtures/verified_attunement_source_rules_behavior.sql","utf8");
const workflow=fs.readFileSync(".github/workflows/validate-campaign-attunement-policy.yml","utf8");

assert.equal(manifest.schemaVersion,1);
assert.equal(manifest.edition,"2024");
assert.ok(manifest.sourceUrl.startsWith("https://www.dndbeyond.com/sources/dnd/br-2024/"));
const keys=manifest.rules.map(x=>x.itemKey);
assert.equal(keys.length,4);
assert.equal(new Set(keys).size,keys.length);
assert.deepEqual(keys.slice().sort(),Array.from(sql.matchAll(/when '([^']+)' then/g),m=>m[1]).sort());
for (const rule of manifest.rules) {
  assert.equal(rule.attunement,"required");
  assert.ok(rule.itemKey.endsWith("|XDMG"));
  assert.ok(sql.includes('"heading":"'+rule.sourceHeading+'"'));
  assert.ok(sql.includes('"classKeys":'+JSON.stringify(rule.requiredClassKeys)));
}
assert.ok(sql.includes("security invoker"));
assert.ok(sql.includes("revoke all on function private.verified_item_attunement_rule_v1"));
assert.ok(sql.includes("to service_role"));
for (const term of ["source_metadata_conflict","verified_br_2024_exact_item_key","attunementEvidence","private.verified_item_attunement_rule_v1(v_key)","eligibleForPassiveMagic',false"]) {
  assert.ok(projection.includes(term),"Missing fail-closed projection integration "+term);
}
for (const term of ["Ring of Fire Resistance|XDMG","source_metadata_conflict","rest_and_prerequisites_unverified","has_function_privilege"]) {
  assert.ok(fixture.includes(term),"Missing critical SQL fixture "+term);
}
for (const file of ["20261024_04_verified_attunement_source_rules.sql","verified_attunement_source_rules_behavior.sql","validate_verified_attunement_sources.mjs"]) {
  assert.ok(workflow.includes(file),"Workflow missing "+file);
}
console.log("Verified 2024 source registry, SQL mapping, conflict and fail-closed contract passed.");

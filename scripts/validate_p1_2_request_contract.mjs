/** Static P1.2 contract coverage ONLY. Does not call Supabase or test live authorization. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = JSON.parse(fs.readFileSync('scripts/fixtures/p1_2_request_contract_matrix.json','utf8'));
const document = fs.readFileSync('docs/P1_2_Command_Replay_Contract_2026-11-01.md','utf8');
const requiredFamilies = ["core_action","move","end_turn","weapon_attack","unarmed_strike","reaction","save","admin_effect","spell_single","spell_selected_area","spell_allocated","spell_point","spell_directional"];
const requiredCases = ["valid_new","exact_authorized_completed_retry","different_requester_same_uuid","different_intent_same_uuid","revoked_controller","pending_result","legacy_null_requester","hidden_result_or_target","old_turn_same_authorized_request"];
assert.equal(source.schema_version,1);
assert.deepEqual(source.families.map(x=>x.id),requiredFamilies);
assert.equal(new Set(source.cases.map(x=>x.id)).size,source.cases.length);
for(const family of source.families) {
 assert(typeof family.rpc==='string' && family.rpc.length>0);
 assert(Array.isArray(family.typed_fields));
 for(const name of requiredCases) {
   const matching=source.cases.filter(x=>x.family===family.id && x.scenario===name);
   assert.equal(matching.length,1, family.id+' / '+name);
   assert(matching[0].expected,'Expected outcome missing');
 }
}
assert(source.special_cases.length>=12);
assert(source.special_cases.some(x=>x.expected==='BLOCKED_P1_5'));
for(const needle of ['PROPOSED; OWNER REVIEW REQUIRED','78 rows','20 with `requested_by IS NULL`','R1','R2','R3','R4','P1.3']) assert(document.includes(needle),'Missing contract requirement: '+needle);
console.log('P1.2 STATIC contract coverage OK: '+source.families.length+' families; '+source.cases.length+' generic cases; '+source.special_cases.length+' special cases. NO runtime security tested.');

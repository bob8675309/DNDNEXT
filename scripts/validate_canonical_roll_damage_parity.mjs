import fs from "node:fs";
import assert from "node:assert/strict";
const read=p=>fs.readFileSync(p,"utf8");
const paths=[
 ["sql/20261016_07_equipped_item_damage_mitigation.sql","private.encounter_equipped_damage_mitigation_v1("],
 ["sql/20261016_08_resistance_before_flat_reduction.sql","public.encounter_apply_damage_internal_v1("],
 ["sql/20260730_02_tactical_vicious_mockery.sql","private.encounter_resolve_attack_roll_v1("]
];
const bundle=read("scripts/fixtures/canonical_live_roll_damage_helpers_pg16.sql");
for(const [path,key] of paths){
 const source=read(path);
 const start=source.toLowerCase().indexOf("create or replace function "+key);
 assert.ok(start>=0,"Missing canonical source "+path);
 const rest=source.slice(start);
 const terminator=rest.indexOf("$function$;")>=0?"$function$;":"$$;";
 const stop=rest.indexOf(terminator);
 assert.ok(stop>0,"Missing source terminator "+path);
 assert.ok(bundle.includes(rest.slice(0,stop+terminator.length)),"Fixture source differs "+path);
}
const sql=read("sql/20261027_03_attack_action_atomic_weapon_candidate.sql");
for(const field of ["'viciousMockeryDisadvantage'","'viciousMockeryEffectConsumed'","'damageMitigation',v_damage_info","'battleboardConsumerEnabled',false"]){
 assert.ok(sql.includes(field),"Missing candidate result field "+field);
}
const tests=read("scripts/fixtures/canonical_roll_damage_parity_candidate.sql");
for(const phrase of ["Live Resistance-flat-vulnerability-temp HP order changed","Opposing one-shot effects were not canceled/consumed","Full canonical helper rollback left irreversible effects","Candidate lost actual live one-use roll/damage helper state","Canonical helper candidate retry replayed roll, mitigation or event"]){
 assert.ok(tests.includes(phrase),"Missing regression "+phrase);
}
assert.ok(!sql.includes("create or replace function public.encounter_weapon_attack_v1"),"Live weapon RPC must be left untouched");
console.log("Exact canonical roll/damage function bodies and complete attack result/rollback test contracts validated.");

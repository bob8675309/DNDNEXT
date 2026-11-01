// P2 source/inventory regression. Static, offline and research-only: verifies
// the 22-entry live snapshot's scope and that our ungranted candidate does not
// silently lose slot-turn enforcement. NOT a fresh live pg_proc check.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { P2_CAST_RPC_SNAPSHOT as rows } from "./fixtures/spell_cast_rpc_live_snapshot_p2.mjs";

const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const names=new Set(rows.map(x=>x.name));
assert.equal(rows.length,22,"Live snapshot must cover all 22 encountered cast RPC names");
assert.equal(names.size,22,"Duplicate RPC name in static audit");
assert.equal(rows.filter(x=>x.kind==="processor").length,14,"Expected 14 direct ledger processors");
assert.equal(rows.filter(x=>x.kind==="wrapper").length,8,"Expected eight routing/slot wrappers");
assert.equal(rows.filter(x=>x.authenticatedExecute).length,18,"Expected 18 authenticated-executable public functions");
assert.equal(rows.filter(x=>!x.authenticatedExecute).length,4,"Expected four ungranted internal historical versions");
for(const x of rows){
  assert.match(x.name,/^encounter_cast_(?:spell_v(?:[1-9]|1[0-3])(?:_pre_1v)?|allocated_spell_v1|area_spell_v1|directional_area_spell_v[12]|point_area_spell_v1)$/);
  assert.match(x.liveBodyMd5,/^[a-f0-9]{32}$/);
  assert.equal(x.historicalProcessingOrder,x.kind==="processor"?"ledger-before-caster-lock":"delegate");
  assert.ok(["target","selected-targets","point","direction","allocations"].includes(x.intent));
}
for(const f of ["encounter_cast_spell_v1_pre_1v","encounter_cast_spell_v5_pre_1v",
 "encounter_cast_spell_v6_pre_1v","encounter_cast_spell_v11_pre_1v"])
  assert.equal(rows.find(x=>x.name===f)?.authenticatedExecute,false,f+" exposure drift");
for(const f of ["encounter_cast_spell_v1","encounter_cast_spell_v11",
  "encounter_cast_spell_v10","encounter_cast_spell_v13",
  "encounter_cast_allocated_spell_v1","encounter_cast_point_area_spell_v1"])
  assert.equal(rows.find(x=>x.name===f)?.authenticatedExecute,true,f+" exposure drift");

const candidate=src("sql/candidates/20261031_fire_bolt_transaction_integrated_candidate.sql");
const name="private.encounter_cast_spell_v11_transaction_candidate_v1";
assert.ok(candidate.includes("create or replace function "+name+"("));
assert.ok(candidate.includes("revoke all on function "+name+"("));
assert.ok(!/\bgrant\s+execute\s+on\s+function/i.test(candidate));
assert.ok(!/\bcreate\s+or\s+replace\s+function\s+public\./i.test(candidate));
const inOrder=[
  "select * into v_c from public.encounter_participants where id=p_caster_id for update",
  "perform private.encounter_enforce_spell_slot_cast_turn_v1(",
  "select * into v_assignment from public.character_spells where id=p_assignment_id and character_id=v_c.character_id for share",
  "select * into v_e from public.encounters where id=v_c.encounter_id for update",
  "select * into v_t from public.encounter_participants where id=p_target_id and encounter_id=v_c.encounter_id for update",
  "if v_role<>'service_role' and (v_uid is null or not public.encounter_can_control_participant_v1(v_c.id))",
  "insert into public.encounter_command_requests",
  "if v_inserted=0 then",
  "return v_existing.result",
  "if v_e.status<>'active'",
  "private.encounter_resolve_attack_roll_v1",
  "update public.encounter_participants set action_available=false",
  "update public.encounter_command_requests set result=v_result"
];
let prev=-1;
for(const needle of inOrder){
  const at=candidate.indexOf(needle);
  assert.ok(at>=0, "Missing locked candidate invariant: "+needle);
  assert.ok(at>prev, "Candidate lock/authorization/order drift: "+needle);
  prev=at;
}
for(const s of ["'fire-bolt|xphb'","'poison-spray|xphb'","'shocking-grasp|xphb'",
  "'ray-of-frost|xphb'","'chill-touch|xphb'","'guiding-bolt|xphb'",
  "return public.encounter_cast_spell_v10","v_assignment.known",
  "v_assignment.source_key","v_assignment.source_label",
  "v_existing.requested_by","v_existing.result->>'targetId'",
  "v_existing.result->>'slotLevel'"])
  assert.ok(candidate.includes(s),"Missing source/intent or source-family marker: "+s);
for(const s of ["private.encounter_enforce_spell_slot_cast_turn_v1",
  "A spell slot has already been expended to cast a spell on this turn"])
  assert.ok(src("scripts/fixtures/fire_bolt_p2_disposable_pg16.sql").includes(s));
assert.ok(src("scripts/fixtures/fire_bolt_p2_transaction_candidate_pg16_checks.sql")
  .includes("Integrated candidate allowed second slotted spell in same turn"));
const racing=src("scripts/fixtures/fire_bolt_p2_transaction_candidate_race.sh");
assert.ok(racing.includes("Refusing nonlocal or non-Fire-Bolt disposable database"));
assert.ok(racing.includes("Competing casts consumed more than one Action"));

console.log("P2 cast inventory PASS: 22 read-only live snapshot entries (14 old-ledger processors, 8 wrappers; 18 authenticated-executable), locked ungranted candidate and slot guard; NO live SQL executed.");

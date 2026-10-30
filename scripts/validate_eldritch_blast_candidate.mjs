import assert from "node:assert/strict";
import fs from "node:fs";
import { eldritchBlastBeamCount, agonizingBlastModifier } from "../utils/eldritchBlastRules.mjs";
const sql=fs.readFileSync("sql/candidates/20261029_eldritch_blast_atomic_candidate.sql","utf8");
for(const [level,beams] of [[1,1],[3,1],[4,1],[5,2],[10,2],[11,3],[16,3],[17,4],[20,4]]) {
  assert.equal(eldritchBlastBeamCount(level),beams);
}
for(const level of [-1,0,21,4.2,"5",null]) {
  assert.throws(()=>eldritchBlastBeamCount(level));
}
const grant={invocationOptionKey:"optional-feature:agonizing-blast|XPHB",chosenSpellKey:"eldritch-blast|XPHB",charismaScore:20};
assert.equal(agonizingBlastModifier(grant),5);
assert.equal(agonizingBlastModifier({...grant,chosenSpellKey:"fire-bolt|XPHB"}),0);
assert.equal(agonizingBlastModifier({...grant,invocationOptionKey:"otherworldly-leap|XPHB"}),0);
assert.equal(agonizingBlastModifier({...grant,charismaScore:8}),-1);
for(const marker of [
 "v_role<>'authenticated' or v_uid is null",
 "v_c.controller_user_id is distinct from v_uid",
 "cp.user_id=v_uid and coalesce(cp.can_edit,false)",
 "for share",
 "v_beams:=case when v_level>=17 then 4 when v_level>=11 then 3",
 "v_targets<>v_beams",
 "p_target_ids[v_i]",
 "lower(catalog.option_key)='optional-feature:agonizing-blast|xphb'",
 "grant_row.choices#>>'{child,metadata,spellKey}'",
 "private.encounter_resolve_attack_roll_v1",
 "public.encounter_apply_damage_internal_v1",
 "'force'",
 "v_roll_data->>'roll'",
 "v_natural<>1",
 "v_natural=20",
 "v_t.ac+coalesce((v_targeting->>'coverAcBonus')",
 "v_raw+v_cha_mod",
 "action_available=false",
 "on conflict(request_id) do nothing",
 "v_prev.requested_by is distinct from v_uid",
 "revoke all on function private.encounter_eldritch_blast_candidate_v1"
]) assert.ok(sql.includes(marker),"Missing SQL contract: "+marker);
assert.ok(!/grant execute on function private\.encounter_eldritch_blast_candidate_v1/i.test(sql));
assert.ok(!sql.includes("service_role' then return true"));
assert.ok(sql.indexOf("select * into v_prev from public.encounter_command_requests") < sql.indexOf("if v_c.is_defeated or not v_c.action_available"),"Authorized duplicate must replay before spent Action");
console.log("Eldritch Blast beam and Agonizing Blast rules + candidate contract PASS");

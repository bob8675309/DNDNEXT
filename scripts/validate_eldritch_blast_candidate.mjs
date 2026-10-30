import assert from "node:assert/strict";
import fs from "node:fs";
import { eldritchBlastBeamCount, agonizingBlastModifier } from "../utils/eldritchBlastRules.mjs";
const sql=fs.readFileSync("sql/candidates/20261029_eldritch_blast_atomic_candidate.sql","utf8");
const shared=fs.readFileSync("sql/candidates/20261030_warlock_cantrip_damage_bonus_candidate.sql","utf8");
for(const [level,beams] of [[1,1],[3,1],[4,1],[5,2],[10,2],[11,3],[16,3],[17,4],[20,4]]) {
  assert.equal(eldritchBlastBeamCount(level),beams);
}
for(const level of [-1,0,21,4.2,"5",null]) {
  assert.throws(()=>eldritchBlastBeamCount(level));
}
const grant={invocationOptionKey:"optional-feature:agonizing-blast|XPHB",chosenSpellKey:"eldritch-blast|XPHB",spellKey:"eldritch-blast|XPHB",charismaScore:20};
assert.equal(agonizingBlastModifier(grant),5);
assert.equal(agonizingBlastModifier({...grant,chosenSpellKey:"fire-bolt|XPHB"}),0);
assert.equal(agonizingBlastModifier({...grant,chosenSpellKey:"toll-the-dead|XPHB",spellKey:"toll-the-dead|XPHB"}),5);
assert.equal(agonizingBlastModifier({...grant,spellKey:"toll-the-dead|XPHB"}),0);
assert.equal(agonizingBlastModifier({...grant,spellKey:undefined}),0);
assert.equal(agonizingBlastModifier({...grant,invocationOptionKey:"otherworldly-leap|XPHB"}),0);
assert.equal(agonizingBlastModifier({...grant,charismaScore:8}),-1);
for(const marker of [
 "v_role<>'authenticated' or v_uid is null",
 "v_c.controller_user_id is distinct from v_uid",
 "not coalesce(v_assignment.known,false)",
 "not coalesce(public.is_admin(v_uid),false)",
 "cp.user_id=v_uid and coalesce(cp.can_edit,false)",
 "for share",
 "v_beams:=case when v_level>=17 then 4 when v_level>=11 then 3",
 "v_targets<>v_beams",
 "p_target_ids[v_i]",
 "private.encounter_warlock_agonizing_bonus_candidate_v1",
 "v_damage_features",
 "private.encounter_resolve_attack_roll_v1",
 "public.encounter_targeting_context_internal_v1(near.id,v_c.id)",
 "public.encounter_apply_damage_internal_v1",
 "'force'",
 "v_roll_data->>'roll'",
 "v_natural<>1",
 "v_natural=20",
 "coalesce(v_t.armor_class,10)+coalesce((v_targeting->>'coverAcBonus')",
 "v_raw+v_invocation_bonus",
 "action_available=false",
 "on conflict(request_id) do nothing",
 "v_prev.requested_by is distinct from v_uid",
 "v_prev.result->'targetIds' is distinct from to_jsonb(p_target_ids)",
 "'targetIds',to_jsonb(p_target_ids)",
 "revoke all on function private.encounter_eldritch_blast_candidate_v1"
]) assert.ok(sql.includes(marker),"Missing SQL contract: "+marker);
for(const marker of [
 "private.encounter_warlock_agonizing_bonus_candidate_v1",
 "lower(catalog.option_key)='optional-feature:agonizing-blast|xphb'",
 "grant_row.choices#>>'{child,metadata,spellKey}'",
 "coalesce(cardinality(s.damage_types),0)>0",
 "lower(cls)='warlock'",
 "lower(coalesce(cs.source_label,''))='warlock'",
 "coalesce(cs.known,false)",
 "select exists (",
 "coalesce(v_level,0)<2",
 "v_modifier:=floor((v_score-10)/2.0)::integer",
 "from public.character_class_option_grant_instances",
 "revoke all on function private.encounter_warlock_agonizing_bonus_candidate_v1"
]) assert.ok(shared.includes(marker),"Missing shared feature source contract: "+marker);
assert.ok(!/grant execute on function private\.encounter_warlock_agonizing_bonus_candidate_v1/i.test(shared));
assert.ok(!/grant execute on function private\.encounter_eldritch_blast_candidate_v1/i.test(sql));
assert.ok(!sql.includes("service_role' then return true"));
assert.ok(!sql.includes("public.encounter_targeting_context_internal_v1(v_c.id,near.id)"),
  "Close-combat visibility must be from enemy toward caster");
const directionFixture=fs.readFileSync("scripts/fixtures/eldritch_blast_candidate_pg16.sql","utf8");
for(const marker of ["caster_cannot_see_enemy","enemy_cannot_see_caster",
  "Enemy sees caster: missing ranged disadvantage",
  "Enemy cannot see caster: false ranged disadvantage"]) {
  assert.ok(directionFixture.includes(marker),"Missing asymmetric sight test "+marker);
}
assert.ok(sql.indexOf("select * into v_prev from public.encounter_command_requests") < sql.indexOf("if v_c.is_defeated or not v_c.action_available"),"Authorized duplicate must replay before spent Action");
console.log("Eldritch Blast beam and Agonizing Blast rules + candidate contract PASS");

const bridge=fs.readFileSync("sql/candidates/20261030_eldritch_blast_authenticated_bridge_candidate.sql","utf8");
assert.match(bridge,/public\.encounter_cast_eldritch_blast_candidate_v1/);
assert.match(bridge,/private\.encounter_eldritch_blast_candidate_v1/);
assert.match(bridge,/auth\.uid\(\)/);
assert.match(bridge,/auth\.jwt\(\)/);
assert.match(bridge,/is_anonymous/);
assert.match(bridge,/revoke all on function public\.encounter_cast_eldritch_blast_candidate_v1/);
assert.doesNotMatch(bridge,/grant execute/i);
assert.doesNotMatch(sql,/v_t\.ac\b/);

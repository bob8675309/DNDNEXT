import assert from "node:assert/strict";
import fs from "node:fs";
import { eldritchBlastPlanBeamCount, eldritchBlastPlanCandidates,
  normalizeEldritchBlastPlan, isEldritchBlastPlanComplete } from "../utils/eldritchBlastPlanner.mjs";
const page=fs.readFileSync("pages/encounters/combat.js","utf8");
const component=fs.readFileSync("components/encounter/EldritchBlastPlanner.js","utf8");
const sql=fs.readFileSync("sql/candidates/20261029_eldritch_blast_atomic_candidate.sql","utf8");
for(const [level,expected] of [[1,1],[4,1],[5,2],[10,2],[11,3],[16,3],[17,4],[20,4]]) {
  assert.equal(eldritchBlastPlanBeamCount(level),expected);
}
for(const invalid of [0,21,-1,2.5,null,"5",undefined]) {
  assert.equal(eldritchBlastPlanBeamCount(invalid),0);
}
const caster={id:"caster",q:0,r:0};
const people=[
 {id:"near",display_name:"Near",q:1,r:0},
 {id:"edge",display_name:"Edge",q:24,r:0},
 {id:"tooFar",q:25,r:0},
 {id:"dead",q:2,r:0,is_defeated:true},
 {id:"secret",q:1,r:1,is_hidden:true},
 {id:"caster",q:0,r:0},
 {id:"broken",q:null,r:1},
 {id:"near",q:2,r:0}
];
const candidates=eldritchBlastPlanCandidates(caster,people);
assert.deepEqual(candidates.map(p=>[p.id,p.distanceFt]),[["near",5],["edge",120]]);
assert.deepEqual(eldritchBlastPlanCandidates(null,people),[]);
assert.deepEqual(eldritchBlastPlanCandidates(caster,null),[]);
assert.deepEqual(normalizeEldritchBlastPlan(["near","near","edge","dead"],candidates,4),
  ["near","near","edge",""]);
assert.equal(isEldritchBlastPlanComplete(["near","near","edge","near"],candidates,4),true);
assert.equal(isEldritchBlastPlanComplete(["near","tooFar"],candidates,2),false);
assert.equal(isEldritchBlastPlanComplete(["near"],candidates,2),false);
assert.equal(isEldritchBlastPlanComplete([],candidates,0),false);
for(const token of [
 'import EldritchBlastPlanner from "../../components/encounter/EldritchBlastPlanner";',
 'const eldritchBlastAssignment = useMemo',
 'manualSpells.find((row)',
 'spellKey(row) === "eldritch-blast|xphb"',
 '<EldritchBlastPlanner','key={`${sessionId}:${active.id}:${eldritchBlastAssignment.assignmentId}`}',
 'caster={active}','participants={participants}','classLevel={spellProfile.classLevel}'
]) assert.ok(page.includes(token),"Missing isolated planner integration: "+token);
const supported=page.match(/const SUPPORTED_SPELL_KEYS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
assert.ok(supported.length>0,"Approved spell set missing");
assert.ok(!supported.includes("eldritch-blast|xphb"),"Unreleased Eldritch Blast must NOT be in automated supported spell set");
assert.ok(page.includes('if (!EB_STAGING_CAST_ENABLED || !canControl || !active?.action_available ||'));
assert.ok(page.includes('return runRpc("encounter_cast_eldritch_blast_candidate_v1", request,'));
assert.ok(page.includes('onCast={EB_STAGING_CAST_ENABLED && hasVerifiedKnownSpellAssignment(eldritchBlastAssignment) ? castEldritchBlast : undefined}'));
assert.ok(!component.includes("supabase") && !component.includes("runRpc(") && !component.includes("fetch("));
for(const token of ["GM-assisted only","onChange={(event) => selectBeam(index, event.target.value)}",
  "No eligible shown creatures within 120 ft","This planner never applies the invocation",
  "key={index}","aria-label={`Eldritch Blast beam ${index + 1} target`}",
  "GM-assisted on production"
]) assert.ok(component.includes(token),"Missing planner UI guard: "+token);
assert.ok(sql.includes("private.encounter_warlock_agonizing_bonus_candidate_v1"),"Authoritative invocation lookup missing");
console.log("Eldritch Blast no-RPC planner: beam scaling, repeated targets, range, stale targets, hidden/defeated filtering and UI isolation PASS");

import assert from "node:assert/strict";
import fs from "node:fs";
import { isEldritchBlastStagingCastAllowed, buildEldritchBlastStagingRequest,
  summarizeEldritchBlastCast } from "../utils/eldritchBlastStagingCast.mjs";
const prodRef="ucggczovhmauhshvhusx", stagingRef="zzzzzzzzzzzzzzzzzzzz";
const ok={enabled:true,supabaseUrl:`https://${stagingRef}.supabase.co/`,stagingProjectRef:stagingRef,vercelEnv:"preview"};
assert.equal(isEldritchBlastStagingCastAllowed(ok),true);
for(const bad of [
 {},{...ok,enabled:false},{...ok,enabled:"true"},
 {...ok,stagingProjectRef:prodRef,supabaseUrl:`https://${prodRef}.supabase.co/`},
 {...ok,supabaseUrl:`https://${prodRef}.supabase.co/`},
 {...ok,stagingProjectRef:"wrong"},
 {...ok,supabaseUrl:"https://example.com/"},
 {...ok,supabaseUrl:`http://${stagingRef}.supabase.co/`},
 {...ok,supabaseUrl:`https://${stagingRef}.supabase.co/other`},
 {...ok,supabaseUrl:`https://${stagingRef}.supabase.co/?foo=bar`},
 {...ok,supabaseUrl:`https://${stagingRef}.supabase.co/#frag`},
 {...ok,vercelEnv:"production"},
]) assert.equal(isEldritchBlastStagingCastAllowed(bad),false,JSON.stringify(bad));
const uid=(n)=>`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
const actor=uid(1),spell=uid(2),a=uid(11),b=uid(12),rid=uid(22);
const base={casterId:actor,assignmentId:spell,targetIds:[a,a,b],
 candidates:[{id:a},{id:b}],beamCount:3,requestId:rid};
assert.deepEqual(buildEldritchBlastStagingRequest(base),{
 p_caster_id:actor,p_assignment_id:spell,p_target_ids:[a,a,b],p_request_id:rid
});
assert.equal(buildEldritchBlastStagingRequest({...base,targetIds:[a,b]}),null);
assert.equal(buildEldritchBlastStagingRequest({...base,targetIds:[a,b,uid(13)]}),null);
assert.equal(buildEldritchBlastStagingRequest({...base,requestId:"invalid"}),null);
assert.equal(buildEldritchBlastStagingRequest({...base,beamCount:0}),null);
const cast={beamCount:2,targetIds:[a,b],beams:[
 {beam:1,targetName:"Goblin",hit:true,total:19,targetAc:12,critical:false,
  damage:{damage:9},agonizingBlastApplied:true,agonizingBlastDamageModifier:5},
 {beam:2,targetName:"Orc",hit:false,total:8,targetAc:16,critical:false}
]};
const summary=summarizeEldritchBlastCast(cast);
for(const x of ["2 independent beams","Goblin","9 Force","Agonizing Blast +5","Orc","miss (8 vs AC 16)","Action spent"])assert.ok(summary.includes(x),x);
assert.match(summarizeEldritchBlastCast({beamCount:2,beams:[],targetIds:[]}),/Refresh the combat log/);
const page=fs.readFileSync("pages/encounters/combat.js","utf8");
const comp=fs.readFileSync("components/encounter/EldritchBlastPlanner.js","utf8");
const approved=page.match(/const SUPPORTED_SPELL_KEYS = new Set\(\[([\s\S]*?)\]\);/)?.[1]||"";
assert.ok(approved && !approved.includes("eldritch-blast|xphb"));
for(const token of [
 "NEXT_PUBLIC_DNDNEXT_EB_STAGING_CASTS","NEXT_PUBLIC_DNDNEXT_EB_STAGING_PROJECT_REF",
 "NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_VERCEL_ENV",
 "if (!EB_STAGING_CAST_ENABLED || !canControl || !active?.action_available ||",
 'runRpc("encounter_cast_eldritch_blast_candidate_v1", request, summarizeEldritchBlastCast)',
 "onCast={EB_STAGING_CAST_ENABLED ? castEldritchBlast : undefined}",
 'row.detail?.beams','beam?.agonizingBlastApplied',
]) assert.ok(page.includes(token),"Missing gated connection: "+token);
assert.ok(!comp.includes("supabase.rpc(") && !comp.includes("runRpc("));
assert.ok(comp.includes("stagingAvailable ? <button") && comp.includes("disabled={!canStageCast || !complete}"));
assert.ok(!page.includes("NEXT_PUBLIC_DNDNEXT_EB_STAGING_CASTS ||"));
console.log("Eldritch Blast staging gate, production refusal, UUID payload and per-beam results PASS");

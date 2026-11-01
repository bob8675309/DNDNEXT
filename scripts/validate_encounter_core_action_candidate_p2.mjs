import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("sql/candidates/20261101_core_action_encounter_first_private_candidate.sql");
const local=read("scripts/fixtures/encounter_core_action_candidate_pg17.sql");
const mock=read("scripts/fixtures/encounter_core_action_candidate_pg16_checks.sql");
const jwt=read("scripts/test_npc_delegated_control_local_auth.mjs");
const gen=read("scripts/fixtures/generate_npc_delegated_local_auth_fixture.mjs");
const original=read("scripts/fixtures/encounter_core_action_live_replay_pg17.sql");
assert.ok(original.includes("74a43a001247f5fa491b057c97ca4014"));
assert.ok(sql.includes("private.encounter_core_action_transaction_candidate_v1"));
assert.ok(!sql.includes("create or replace function public.encounter_use_core_action_v1"));
assert.ok(sql.includes("revoke all on function private.encounter_core_action_transaction_candidate_v1"));
const idx=(s)=>sql.indexOf(s);
const lockEncounter=idx("where id=v_actor_encounter_id for update");
const lockActor=idx("where id=p_participant_id for update");
const checkController=idx("not public.encounter_can_control_participant_v1(v_p.id)");
const readLedger=idx("where request_id=p_request_id for update");
const ledgerInsert=idx("insert into public.encounter_command_requests(");
const replayReturn=idx("return v_existing.result");
assert.ok(lockEncounter>0&&lockEncounter<lockActor&&lockActor<checkController&&
 checkController<readLedger&&readLedger<replayReturn&&replayReturn<ledgerInsert,
 "Candidate must acquire encounter/actor, recheck controller and typed replay before INSERT");
for(const field of ["'version',1","'encounterId',v_e.id","'participantId',v_p.id",
 "'commandType','core_action'","'action',p_action",
 "v_existing.requested_by is distinct from v_uid",
 "v_existing.request_intent is distinct from v_intent",
 "v_existing.result is null",
 "v_existing.result->>'action' is distinct from p_action",
 "v_e.active_participant_id is distinct from v_p.id",
 "v_p.is_defeated","v_p.action_available",
 "movement_bonus_ft+speed_ft","'core_action',v_p.display_name",
 "version=version+1","raise exception 'Request id already in use"])
 assert.ok(sql.includes(field),"Missing canonical original/new-command check "+field);
assert.ok(local.includes("add column request_intent jsonb"));
assert.ok(local.includes("revoke all on function public.p2_local_core_action_candidate"));
assert.ok(local.includes("has_function_privilege('authenticated'"));
assert.ok(mock.includes("private encounter-first") || mock.includes("Core-action"));
assert.ok(gen.includes("scripts/fixtures/encounter_core_action_candidate_pg17.sql"));
for(const field of ["SAFE PRIVATE CORE CANDIDATE","candidateCall(winner,\"dash\",candidateReq)",
 "candidateCall(loser,\"disengage\",r2)",
 "legacy null intent","Pending typed request",
 "Revoked owner with unchanged JWT",
 "exact owner replay","r1=randomUUID(),r2=randomUUID()"])
 assert.ok(jwt.includes(field),"Missing genuine JWT candidate test: "+field);
console.log("PASS: P2 private core-action canonical owner/intent and encounter-first candidate source contracts (no production grants)");

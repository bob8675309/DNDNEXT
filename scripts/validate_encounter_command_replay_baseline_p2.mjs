// P2 held source snapshots, not live SQL. Real three-user GoTrue test
// CHARACTERIZES the original vulnerable core action in local Supabase.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=x=>readFileSync(new URL("../"+x,import.meta.url),"utf8");
const sql=read("scripts/fixtures/encounter_core_action_live_replay_pg17.sql");
const generator=read("scripts/fixtures/generate_npc_delegated_local_auth_fixture.mjs");
const jwt=read("scripts/test_npc_delegated_control_local_auth.mjs");
const audit=read("scripts/audits/encounter_command_replay_lock_readonly_p2.sql");
assert.match(sql,/MD5 74a43a001247f5fa491b057c97ca4014/);
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.encounter_use_core_action_v1/);
assert.match(sql,/if v_inserted=0 then select \* into v_existing/);
assert.match(sql,/return coalesce\(v_existing\.result/);
assert.match(sql,/select \* into v_p from public\.encounter_participants where id=p_participant_id for update/);
assert.match(sql,/not public\.encounter_can_control_participant_v1/);
assert.ok(sql.indexOf("return coalesce(v_existing.result")<
 sql.indexOf("not public.encounter_can_control_participant_v1"),
 "Live legacy replay must be before authorization for this fixture to characterize issue");
assert.ok(!sql.includes("v_existing.requested_by"),
 "Baseline unexpectedly compares cached owner; refresh fixture and audit");
assert.ok(generator.includes("scripts/fixtures/encounter_core_action_live_replay_pg17.sql"));
for(const s of [
 "LEGACY BASELINE CHARACTERIZATION",
 "otherOwner.data,coreFirst.data",
 "revokedReplay.data,coreFirst.data",
 "coreVersionBefore+1",
 "event_type='core_action'",
 "await setGrant(winner,false)"
]) assert.ok(jwt.includes(s),"Signed-in legacy baseline must assert "+s);
for(const s of [
 "pg_get_functiondef(p.oid)","v_existing.requested_by",
 "encounter_resolve_opportunity_reaction_v1",
 "encounter_weapon_attack_v1","encounter_end_turn_v1"
]) assert.ok(audit.includes(s),"Missing live re-audit boundary: "+s);
console.log("PASS: P2 frozen original core-action early replay + real GoTrue cross-controller baseline research contract; this is NOT a deployed fix");

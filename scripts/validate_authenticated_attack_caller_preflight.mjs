import fs from "node:fs";
import assert from "node:assert/strict";
const read=p=>fs.readFileSync(p,"utf8");
const controller=read("sql/20260727_04_authoritative_encounter_turn_movement.sql");
const fixtureCtrl=read("scripts/fixtures/canonical_controller_acl_pg16.sql");
const head=controller.toLowerCase().indexOf("create or replace function public.encounter_can_control_participant_v1(");
assert.ok(head>=0,"No canonical control function");
const tail=controller.slice(head);
const end=tail.indexOf("$function$;");
assert.ok(end>0,"Unterminated canonical control function");
assert.ok(fixtureCtrl.includes(tail.slice(0,end+"$function$;".length)),"Controller fixture differs from production source");
const auth=read("sql/20261027_04_authenticated_attack_caller_preflight_shadow.sql");
for(const s of [
 "v_uid uuid:=auth.uid()","v_role text:=coalesce(auth.role(),'')",
 "v_role is distinct from 'authenticated' or v_uid is null",
 "public.encounter_can_control_participant_v1(p_participant_id)",
 "where id=p_participant_id and encounter_id=p_expected_encounter_id",
 "v_e.active_participant_id is distinct from v_p.id",
 "v_e.round is distinct from p_expected_round",
 "v_e.turn_index is distinct from p_expected_turn_index",
 "private.encounter_attack_capacity_source_shadow_v1",
 "if v_budget->>'sourceReady' is distinct from 'true'",
 "'roleBypassUsed',false","'trustedEndpointIdentityHandoffReady',false",
 "'jwtSignatureVerifiedByDatabase',false","'atomicCandidateCalled',false",
 "'combatConsumerEnabled',false","to authenticated",
 "from public,anon,authenticated,service_role"
])assert.ok(auth.includes(s),"Authorization contract missing "+s);
for(const bad of [
 "public.encounter_weapon_attack_v1(",
 "private.encounter_weapon_attack_atomic_candidate_v1(",
 "public.encounter_unarmed_strike_v1(",
 "insert into public.","update public.","delete from public.",
 "set_config(","p_user_id","p_caller_user_id","p_is_admin"
])assert.ok(!auth.toLowerCase().includes(bad.toLowerCase()),"Forbidden writer/identity bypass "+bad);
const pg=read("scripts/fixtures/authenticated_attack_caller_preflight_shadow.sql");
for(const check of [
 "canonical_roll_damage_parity_candidate.sql",
 "canonical_controller_acl_pg16.sql",
 "request.jwt.claim.sub","request.jwt.claim.role",
 "set role authenticated","set role service_role","set role anon",
 "Permissioned JWT-controlled player preview incorrect",
 "Exact direct participant controller rejected",
 "Foreign player received participant/class data",
 "Trusted admin ownership check failed",
 "Authenticated role with null UID was trusted",
 "Service role JWT claim bypassed user-specific gate",
 "Service-role connection gained player preflight EXECUTE",
 "Anon Postgres role reached authenticated preflight",
 "Live weapon executor accidentally exposed"
])assert.ok(pg.includes(check),"Missing source-aligned security regression "+check);
const wf=read(".github/workflows/validate-authenticated-attack-caller-preflight.yml");
assert.ok(wf.includes("authenticated_attack_caller_preflight_shadow.sql"));
assert.ok(wf.includes("validate_authenticated_attack_caller_preflight.mjs"));
console.log("Authentic controller byte-parity, non-impersonating authenticated caller gate and JWT/role regression contracts passed");

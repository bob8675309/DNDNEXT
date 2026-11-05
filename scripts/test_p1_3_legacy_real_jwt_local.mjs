#!/usr/bin/env node
// P1.3: characterize ORIGINAL legacy public spell RPC with genuine local GoTrue JWTs.
// Expected unsafe results are research evidence, NOT a security acceptance pass.
// GitHub Actions disposable Supabase CLI stack ONLY; never connect to production.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const e = process.env;
assert.equal(e.GITHUB_ACTIONS, "true");
assert.equal(e.CI, "true");
assert.equal(e.DNDNEXT_P13_LOCAL_CI_CONFIRM, "P13_DISPOSABLE_REAL_GOTRUE_ONLY");
assert.equal(e.PGHOST, "127.0.0.1");
assert.equal(e.PGPORT, "54322");
assert.equal(e.PGDATABASE, "postgres");
assert.match(e.DNDNEXT_P13_LOCAL_URL || "", /^http:\/\/127\.0\.0\.1:54321\/?$/);
assert.ok(e.DNDNEXT_P13_LOCAL_ANON_KEY);
const id = n => "00000000-0000-0000-0000-" + String(n).padStart(12, "0");
const caster = id(1011), ally = id(1012), hidden = id(1013);
const freshCaster = id(1014), freshTarget = id(1015);
const spell = id(3011), alternative = id(3012), freshSpell = id(3015);
function db(sql) {
  const p = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-qAt", "-c", sql], {
    encoding: "utf8", timeout: 15000, env: { ...e, PGUSER: "postgres" }
  });
  if (p.status !== 0) throw Error("Disposable DB assertion failed: " + p.stderr);
  return p.stdout.trim();
}
const number = sql => Number(db(sql));
const client = () => createClient(e.DNDNEXT_P13_LOCAL_URL, e.DNDNEXT_P13_LOCAL_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
const cast = (who, actor, assignment, target, level, request) =>
  who.rpc("encounter_cast_spell_v9", {
    p_caster_id: actor, p_assignment_id: assignment, p_target_id: target,
    p_slot_level: level, p_request_id: request
  });
async function control(who, participant) {
  const response = await who.rpc("encounter_can_control_participant_v1", {
    p_participant_id: participant
  });
  assert.ifError(response.error);
  return response.data;
}
async function visible(who, participant) {
  const r = await who.from("encounter_participants").select("id").eq("id", participant);
  assert.ifError(r.error);
  return r.data;
}
function denied(result, reason) {
  assert.ok(result.error, reason + " unexpectedly accepted");
  assert.match(result.error.message, /Not authorized to control this participant/i, reason);
}
const people = [];
const password = "LocalP13-" + randomUUID() + "-X9!";
for (const label of ["GM", "A", "B"]) {
  const supabase = client();
  const email = "p13-local-" + randomUUID() + "@example.invalid";
  const signed = await supabase.auth.signUp({ email, password });
  assert.ifError(signed.error);
  const login = await supabase.auth.signInWithPassword({ email, password });
  assert.ifError(login.error);
  const user = await supabase.auth.getUser();
  const claims = await supabase.auth.getClaims();
  assert.ifError(user.error);
  assert.ifError(claims.error);
  assert.ok(login.data.session?.access_token);
  assert.equal(user.data.user.id, login.data.user.id);
  assert.equal(claims.data.claims.sub, user.data.user.id);
  assert.equal(claims.data.claims.role, "authenticated");
  assert.notEqual(user.data.user.is_anonymous, true);
  assert.notEqual(claims.data.claims.is_anonymous, true);
  assert.match(user.data.user.id, /^[0-9a-f-]{36}$/i);
  people.push({ label, supabase, uid: user.data.user.id });
}
const [gm, a, b] = people;
assert.equal(new Set(people.map(x => x.uid)).size, 3);
db("INSERT INTO public.p13_auth_admins(user_id) VALUES('" + gm.uid + "')");
db("UPDATE public.encounter_participants SET controller_user_id='" + a.uid +
   "' WHERE id IN ('" + caster + "','" + freshCaster + "')");
assert.equal(await control(gm.supabase, caster), true);
assert.equal(await control(a.supabase, caster), true);
assert.equal(await control(b.supabase, caster), false);
console.log("PASS 48: genuine three-account GoTrue GM/direct-player/outsider separation");

const outsiderRequest = randomUUID();
denied(await cast(b.supabase, caster, spell, ally, 1, outsiderRequest), "Outsider cast");
assert.equal(number("SELECT count(*) FROM public.encounter_command_requests WHERE request_id='" + outsiderRequest + "'"), 0);
assert.equal(number("SELECT slots_remaining FROM public.encounter_spell_slots WHERE id='" + id(4011) + "'"), 1);
console.log("PASS 49: outsider new command denied without ledger/slot change");

for (const [assigned, level] of [[id(3013), null], [id(3014), 1]]) {
  const request = randomUUID();
  const outcome = await cast(a.supabase, caster, assigned, ally, level, request);
  assert.ok(outcome.error);
  assert.match(outcome.error.message, /GM-assisted/i);
  assert.equal(number("SELECT count(*) FROM public.encounter_command_requests WHERE request_id='" + request + "'"), 0);
}
const hiddenCast = await cast(a.supabase, caster, spell, hidden, 1, randomUUID());
assert.ok(hiddenCast.error);
assert.match(hiddenCast.error.message, /Target is hidden from this controller/i);
assert.deepEqual(await visible(b.supabase, hidden), []);
assert.equal(number("SELECT slots_remaining FROM public.encounter_spell_slots WHERE id='" + id(4011) + "'"), 1);
console.log("PASS 50: source fallback/hidden target blocked, no slot consumed");

const request = randomUUID();
const success = await cast(a.supabase, caster, spell, ally, 1, request);
assert.ifError(success.error);
assert.equal(success.data.requestId, request);
assert.equal(success.data.spellKey, "cure-wounds|xphb");
assert.equal(success.data.targetId, ally);
assert.equal(number("SELECT slots_remaining FROM public.encounter_spell_slots WHERE id='" + id(4011) + "'"), 0);
assert.equal(db("SELECT action_available FROM public.encounter_participants WHERE id='" + caster + "'"), "f");
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE event_type='spell_cast' AND encounter_id='" + id(901) + "'"), 1);
assert.equal(db("SELECT requested_by FROM public.encounter_command_requests WHERE request_id='" + request + "'"), a.uid);
console.log("PASS 51: genuine signed-in Cure Wounds consumed exactly one Action/slot");

db("UPDATE public.encounter_participants SET is_hidden=true WHERE id='" + ally + "'");
assert.deepEqual(await visible(b.supabase, ally), []);
const stolen = await cast(b.supabase, caster, alternative, hidden, 2, request);
assert.ifError(stolen.error);
assert.deepEqual(stolen.data, success.data);
assert.equal(number("SELECT count(*) FROM public.encounter_combat_log WHERE event_type='spell_cast' AND encounter_id='" + id(901) + "'"), 1);
assert.equal(number("SELECT slots_remaining FROM public.encounter_spell_slots WHERE id='" + id(4011) + "'"), 0);
console.log("PASS 52 [EXPECTED UNSAFE]: different JWT obtained cached result with changed target/assignment/slot");

db("INSERT INTO public.character_permissions(character_id,user_id,can_control,can_edit) VALUES('" +
  id(611) + "','" + b.uid + "',true,false)");
assert.equal(await control(b.supabase, caster), false);
db("UPDATE public.character_permissions SET can_edit=true WHERE character_id='" + id(611) + "' AND user_id='" + b.uid + "'");
assert.equal(await control(b.supabase, caster), true);
db("UPDATE public.character_permissions SET can_edit=false WHERE character_id='" + id(611) + "' AND user_id='" + b.uid + "'");
assert.equal(await control(b.supabase, caster), false);
console.log("PASS 53: original helper excludes combat-only can_control; can_edit grant/revoke works");

db("UPDATE public.encounter_participants SET controller_user_id=NULL WHERE id IN ('" +
  caster + "','" + freshCaster + "')");
assert.equal(await control(a.supabase, caster), false);
assert.equal(await control(a.supabase, freshCaster), false);
const afterRevokeUser = await a.supabase.auth.getUser();
assert.ifError(afterRevokeUser.error);
assert.equal(afterRevokeUser.data.user.id, a.uid);
const freshRequest = randomUUID();
denied(await cast(a.supabase, freshCaster, freshSpell, freshTarget, 1, freshRequest),
       "Revoked fresh caster");
const replay = await cast(a.supabase, caster, spell, ally, 1, request);
assert.ifError(replay.error);
assert.deepEqual(replay.data, success.data);
assert.equal(number("SELECT count(*) FROM public.encounter_command_requests WHERE request_id='" + freshRequest + "'"), 0);
assert.equal(number("SELECT count(*) FROM public.encounter_command_requests"), 1);
assert.equal(number("SELECT slots_remaining FROM public.encounter_spell_slots WHERE id='" + id(4014) + "'"), 1);
console.log("PASS 54 [EXPECTED UNSAFE]: same still-signed-in JWT reused result after controller revocation");

const anon = client();
const anonymous = await cast(anon, caster, spell, ally, 1, request);
assert.ok(anonymous.error, "Anonymous cast unexpectedly executed");
assert.equal(anonymous.error.code, "42501");
assert.deepEqual(await visible(b.supabase, ally), []);
console.log("PASS 55: anonymous cannot invoke v9; hidden target remains RLS-invisible");
console.log("CASES 48-55 passed. Unsafe legacy behavior is baseline evidence, NOT remediation.");

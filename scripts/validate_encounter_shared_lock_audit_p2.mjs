// Research snapshot validation. The records below came from read-only live
// pg_proc/pg_trigger inspection. This does NOT poll Supabase at runtime.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 P2_NON_SPELL_LEDGER_WRITERS as writers,
 P2_ENCOUNTER_TRIGGER_HELPERS as triggers
} from "./fixtures/encounter_nonspell_ledger_live_snapshot_p2.mjs";
import {P2_CAST_RPC_SNAPSHOT as spells} from "./fixtures/spell_cast_rpc_live_snapshot_p2.mjs";
const read = p => readFileSync(new URL("../"+p,import.meta.url),"utf8");
assert.equal(writers.length,8);
assert.equal(new Set(writers.map(w=>w.name)).size,8);
assert.equal(writers.filter(w=>w.replayBeforeController).length,5,
 "Five nonspell ledger-first commands permit replay before controller check");
assert.equal(spells.length,22);
assert.equal(new Set([...writers,...spells].map(w=>w.name)).size,30);
assert.equal(writers.filter(w=>w.order.startsWith("ledger>")).length,5,
 "Five direct ledger-first paths; the admin and save paths differ, reaction locks first");
for(const w of writers) {
 assert.match(w.md5,/^[a-f0-9]{32}$/);
 assert.ok(w.intent&&w.order&&w.critical);
}
const reaction=writers.find(w=>w.name==="encounter_resolve_opportunity_reaction_v1");
assert.match(reaction.order,/^window>reactor>mover>encounter>ledger$/);
assert.match(reaction.critical,/BEFORE controller authorization/);
assert.ok(!reaction.replayBeforeController,
 "Reaction ledger replay is post auth; the separate resolved-window early return is pre auth");
const save=writers.find(w=>w.name==="encounter_roll_save_v1");
const admin=writers.find(w=>w.name==="admin_apply_encounter_effect_v1");
assert.ok(save.order.startsWith("controller-check>"));
assert.ok(admin.order.startsWith("admin-check>"));
assert.equal(triggers.length,6);
assert.equal(triggers.filter(x=>x.table==="encounters").length,3);
assert.equal(new Set(triggers.map(x=>x.trigger)).size,6);
for(const t of triggers) assert.match(t.md5,/^[0-9a-f]{32}$/);
assert.ok(triggers.some(t=>/turn_start/.test(t.trigger)&&/different participant/.test(t.acquires)));
assert.ok(triggers.some(t=>t.table==="encounter_spell_slots"&&/persistent spell-slot/.test(t.acquires)));
const audit=read("scripts/audits/spell_cast_rpc_order_readonly.sql");
assert.ok(audit.includes("p.proname not like 'encounter_cast_%'"));
assert.ok(audit.includes("pg_get_functiondef(p.oid)"));
const mini=read("scripts/fixtures/encounter_global_lock_order_p2_pg16.sh");
assert.match(mini,/Refusing: requires disposable local fire_bolt_p2 database/);
assert.match(mini,/create trigger turn_start_effect/);
assert.match(mini,/run_one 11/);
assert.match(mini,/run_one 12/);
const candidate=read("sql/candidates/20261031_fire_bolt_transaction_integrated_candidate.sql");
assert.ok(candidate.includes("select * into v_c from public.encounter_participants where id=p_caster_id for update"),
 "Held candidate remains caster-first; do not silently declare it safe or promote");
assert.ok(candidate.includes("private.encounter_enforce_spell_slot_cast_turn_v1"));
assert.match(candidate,/revoke all on function private\.encounter_cast_spell_v11_transaction_candidate_v1/);
console.log("P2 shared ledger snapshot PASS: 22 spell + 8 nonspell, five nonspell ledger-before-controller replays, six encounter triggers, locked candidate marked not deployable");

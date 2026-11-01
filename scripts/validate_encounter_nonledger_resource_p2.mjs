// Frozen, read-only research inventory: NOT production behavior or fresh SQL polling.
// Keep CI green only when dated inventory, scope and disposable test remain intact.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 P2_NON_LEDGER_PUBLIC_MUTATORS as writers,
 P2_NON_LEDGER_HELPERS as helpers
} from "./fixtures/encounter_nonledger_resource_snapshot_p2.mjs";
const read = p => readFileSync(new URL("../"+p,import.meta.url),"utf8");
assert.equal(writers.length,10);
assert.equal(helpers.length,7);
const all=[...writers,...helpers];
assert.equal(new Set(all.map(x=>x.name)).size,17);
for(const x of all)assert.match(x.md5,/^[a-f0-9]{32}$/,x.name);
for(const name of [
 "admin_start_encounter_v1","admin_set_encounter_status_v1",
 "admin_set_encounter_turn_marker_v1","complete_character_rest_v1",
 "update_character_spell_slot_v1"
])assert.ok(writers.some(x=>x.name===name),"Missing non-ledger writer "+name);
for(const name of [
 "private.assert_character_resource_not_active_v1",
 "private.guard_character_rest_insert_v1",
 "private.mirror_encounter_spell_slot_spend_v1",
 "private.sync_character_spell_slots_v1"
])assert.ok(helpers.some(x=>x.name===name),"Missing resource guard "+name);
const audit=read("scripts/audits/encounter_nonledger_resource_readonly_p2.sql");
assert.match(audit,/characters_in_two_or_more_active_encounters/);
assert.match(audit,/snapshot_differences/);
assert.match(audit,/pg_get_triggerdef/);
assert.match(audit,/pg_get_function_identity_arguments/);
assert.ok(!/\b(INSERT INTO|UPDATE public|DELETE FROM|ALTER TABLE|CREATE OR REPLACE FUNCTION)\b/i.test(audit),
 "Audit file must remain SELECT only");
const race=read("scripts/fixtures/encounter_shared_character_slot_p2_pg16.sh");
for(const p of [
 "Refusing nonlocal/non-disposable PostgreSQL target",
 "create trigger decrement_persistent",
 "for update",
 "spend 10",
 "spend 20",
 "Synthetic persistent spell slots exhausted",
 "loser rolled back its snapshot"
])assert.ok(race.includes(p),"Missing disposable model guard "+p);
const prior=read("sql/candidates/20261031_fire_bolt_transaction_integrated_candidate.sql");
assert.ok(prior.includes("private.encounter_enforce_spell_slot_cast_turn_v1"));
assert.ok(prior.includes("select * into v_c from public.encounter_participants where id=p_caster_id for update"));
console.log("PASS non-ledger resource research: 10 admin/rest/slot writers, 7 helpers, active-overlap source queries, disposable cross-encounter model, held caster-first candidate NOT releasable");

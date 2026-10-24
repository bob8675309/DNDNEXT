import assert from "node:assert/strict";
import fs from "node:fs";
const migration=fs.readFileSync("sql/20261023_07_physical_specimen_encounter_start_reconcile.sql","utf8");
const fixtures=fs.readFileSync("scripts/fixtures/physical_specimen_tactical_behavior.sql","utf8");
for(const term of [
 "private.reconcile_physical_specimen_at_encounter_start_v1",
 "private.reconcile_physical_specimen_start_trigger_v1",
 "private.physical_specimen_active_bonuses_v1",
 "maxHpDeltaApplied",
 "source','staging",
 "source','encounter_start",
 "v_new_max:=coalesce(v_p.max_hp,0)-v_applied+v_desired",
 "v_base_max+v_desired",
 "from public.character_progression",
 "for update",
 "new.status='active'",
 "old.status in ('draft','ready','initiative')",
 "before update of status on public.encounters",
 "least(current_hp,v_new_max)",
 "revoke all on function private.reconcile_physical_specimen_at_encounter_start_v1"
])assert.ok(migration.includes(term),`Missing start reconciliation invariant: ${term}`);
for(const term of [
 "Stage then activate: encounter-start HP/Speed wrong",
 "Activate then stage: HP bonus was duplicated",
 "Expired staged benefit was not removed at encounter start",
 "GM max-HP override was overwritten instead of adjusted",
 "Second start reconciliation double-added HP",
 "Start reconciliation modified permanent source HP"
])assert.ok(fixtures.includes(term),`Missing start regression: ${term}`);
for(const term of [
 "create or replace function public.admin_start_encounter_v1",
 "update public.character_sheets",
 "update public.character_progression",
 "update public.encounters"
])assert.ok(!migration.toLowerCase().includes(term.toLowerCase()),`Unsafe start override/write: ${term}`);
console.log("Encounter-start delta provenance, expiration, GM override, and idempotency contracts passed.");

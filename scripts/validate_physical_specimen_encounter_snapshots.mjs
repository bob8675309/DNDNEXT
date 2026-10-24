import assert from "node:assert/strict";
import fs from "node:fs";
const sql=fs.readFileSync("sql/20261023_06_physical_specimen_encounter_snapshots.sql","utf8");
const old=fs.readFileSync("sql/20261023_04_physical_specimen_stat_projection.sql","utf8");
const tests=fs.readFileSync("scripts/fixtures/physical_specimen_tactical_behavior.sql","utf8");
for(const x of ["physical_specimen_active_bonuses_v1","physical_specimen_context_v1",
 "physical_specimen_valid_benefit_keys_v1","v_latest_long_rest>v_activated_at",
 "jsonb_typeof(k.value)<>'string'","encounter_canonical_speed_ft_v1",
 "guard_encounter_participant_max_hp_v1","v_base_speed+coalesce",
 "coalesce(v_max,1)+coalesce",
 "revoke all on function public.encounter_canonical_speed_ft_v1(uuid)"
])assert.ok(sql.includes(x),`Missing protection: ${x}`);
for(const x of [
 "public.encounter_canonical_speed_ft_v1(p_character_id)-v_speed_bonus",
 "v_effective_speed:=v_base_speed+v_speed_bonus"
])assert.ok(old.includes(x),`Physical Specimen Speed must not stack twice: ${x}`);
for(const x of [
 "Pre-activated Physical Specimen was lost at staging",
 "Repeated tactical Speed refresh removed or stacked bonus",
 "Long-Rest expired feature leaked into new encounter",
 "Malformed source choices generated live combat bonuses"
])assert.ok(tests.includes(x),`Missing behavioral regression: ${x}`);
for(const x of ["update public.character_sheets","update public.character_progression","alter table public.character_sheets"])
assert.ok(!sql.toLowerCase().includes(x),`Permanent sheet/progression mutation forbidden: ${x}`);
console.log("Physical Specimen encounter HP/Speed carryover contracts passed.");

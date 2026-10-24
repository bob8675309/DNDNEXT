import assert from "node:assert/strict";
import fs from "node:fs";
const sql=fs.readFileSync("sql/20261023_04_physical_specimen_stat_projection.sql","utf8");
for(const token of [
  "get_character_physical_specimen_effective_stats_v1",
  "get_character_physical_specimen_effects_v1(p_character_id)",
  "public.encounter_canonical_speed_ft_v1(p_character_id)",
  "'effectsIntegrated',false",
  "'projectionOnly',true",
  "v_base_max_hp+v_hp_bonus",
  "least(v_base_current_hp,v_effective_max_hp)",
  "v_base_current_hp>v_effective_max_hp",
  "'requiresCanonicalVisionLookup',true",
  "grant execute on function public.get_character_physical_specimen_effective_stats_v1(uuid)"
])assert.ok(sql.includes(token),`Missing additive stat integration boundary: ${token}`);
for(const token of [
  "update public.character_sheets",
  "update public.encounter_participants",
  "insert into public.",
  "delete from public.",
  "update public.character_progression",
  "alter table",
  "create trigger"
])assert.ok(!sql.toLowerCase().includes(token.toLowerCase()),`Stat getter must not mutate data: ${token}`);
console.log("Physical Specimen effective-stat overlay is additive, permission-gated and read-only.");

import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path,"utf8");
const base=read("sql/20261016_07_equipped_item_damage_mitigation.sql");
const current=read("sql/20261016_08_resistance_before_flat_reduction.sql");
const shadow=read("sql/20261025_05_tactical_attuned_mitigation_shadow.sql");
const fixture=read("scripts/fixtures/attuned_tactical_mitigation_shadow.sql");
const workflow=read(".github/workflows/validate-attuned-tactical-mitigation-shadow.yml");

for (const token of [
  "private.encounter_attuned_damage_mitigation_shadow_v1",
  "private.encounter_equipped_damage_mitigation_v1(p_character_id,p_damage_type)",
  "private.character_magic_effect_source_gate_shadow_v1(p_character_id)",
  "v_gate->>'attunementEnabled'='false'",
  "jsonb_array_elements(v_gate->'items')",
  "gate_item->>'magicRiderEligible'='true'",
  "ii.is_equipped is true",
  "character_permissions cp",
  "coalesce(v_catalog, '{}'::jsonb)",
  "coalesce(v_inv.card_payload, '{}'::jsonb)",
  "jsonb_array_elements_text(v_payload->'resist')",
  "damageReductionByType",
  "damage_reduction_by_type",
  "v_flat_reduction := greatest(v_flat_reduction, v_reduction)",
  "'baseline',v_baseline",
  "'shadow',v_shadow",
  "'consumerEnforced',false",
  "revoke all on function private.encounter_attuned_damage_mitigation_shadow_v1",
  "to service_role",
]) assert.ok(shadow.includes(token), "Shadow source contract missing: "+token);
assert.ok(!shadow.includes("update public.encounter_participants"),"Shadow must never mutate combat HP");
assert.ok(!shadow.includes("create or replace function public.encounter_apply_damage_internal_v1"),
  "Shadow must not replace encounter damage authority");
for(const token of [
  "v_adjusted := floor(v_adjusted/2.0)::integer",
  "v_adjusted := greatest(0,v_adjusted-v_flat_reduction)",
]) assert.ok(current.includes(token), "Current authoritative damage order changed: "+token);
assert.ok(base.includes("private.encounter_equipped_damage_mitigation_v1"),
  "Existing unchanged mitigation helper must be available for comparison");
for (const token of [
  "optional_attunement_setting_behavior.sql",
  "optional_rest_magic_item_selection_behavior.sql",
  "character_magic_source_gate_shadow.sql",
  "sql/20261016_07_equipped_item_damage_mitigation.sql",
  "sql/20261025_05_tactical_attuned_mitigation_shadow.sql",
  "30 Fire -> 15 -> 5",
  "Shared account magic mitigation leaked",
  "Unverified rare Cold source obtained",
  "Unequipped item affected baseline"
]) assert.ok(fixture.includes(token), "Isolated tactical parity scenario missing: "+token);
for(const token of [
  "scripts/validate_attuned_tactical_shadow.mjs",
  "validate_tactical_equipped_damage_mitigation.mjs",
  "attuned_tactical_mitigation_shadow.sql",
]) assert.ok(workflow.includes(token),"Exact-head workflow missing "+token);
console.log("Attunement-aware tactical shadow is inert, sourced from real items, and checks legacy Resistance-before-DR parity.");

import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const legacy = read("sql/20260801_03_shared_equipment_effects_pipeline.sql");
const exact = read("scripts/fixtures/legacy_character_equipment_resolver_v1.sql");
const sql = read("sql/20261025_06_character_attuned_ac_saves_shadow.sql");
const fixture = read("scripts/fixtures/character_attuned_ac_saves_shadow.sql");
const workflow = read(".github/workflows/validate-character-attuned-ac-saves-shadow.yml");

const begin = legacy.indexOf("create or replace function private.character_equipment_effects_v1(p_character_id uuid)");
const end = legacy.indexOf("create or replace function public.character_equipment_effects_v1(",begin);
assert.ok(begin >= 0 && end > begin,"Legacy resolver boundaries missing");
assert.equal(exact.slice(exact.indexOf("create or replace function private.character_equipment_effects_v1(")).trim(),
  legacy.slice(begin,end).trim(),
  "Isolated parity resolver must match the original full canonical SQL exactly");

for (const needle of [
  "private.character_attuned_ac_saves_shadow_v1",
  "private.character_equipment_effects_v1(p_character_id)",
  "private.character_magic_effect_source_gate_shadow_v1(p_character_id)",
  "v_gate->>'attunementEnabled'='false'",
  "coalesce(v_catalog,'{}'::jsonb) || coalesce(v_item.card_payload,'{}'::jsonb)",
  "'bonusAc','acBonus','bonus_ac'",
  "'bonusSavingThrow','saveBonus','bonus_saving_throw'",
  "v_modifiers->'saves'",
  "v_shadow_saves:=jsonb_set(",
  "v_ac:=jsonb_set(v_ac,'{total}'",
  "v_ac:=jsonb_set(v_ac,'{otherBonus}'",
  "directAcSavesComparisonComplete",
  "fullEffectConsumerParityReady',false",
  "'consumerEnforced',false",
  "v_payload ? 'ac'",
  "revoke all on function private.character_attuned_ac_saves_shadow_v1",
  "to service_role",
]) assert.ok(sql.includes(needle),"Shadow AC/save invariant missing: "+needle);
for (const forbidden of [
  "update public.character_sheets",
  "update public.inventory_items",
  "update public.encounter_participants",
  "create or replace function private.character_equipment_effects_v1",
  "create or replace function public.character_equipment_effects_v1",
]) assert.ok(!sql.toLowerCase().includes(forbidden),"Shadow must remain inert: "+forbidden);
for (const needle of [
  "character_magic_source_gate_shadow.sql",
  "legacy_character_equipment_resolver_v1.sql",
  "20261025_06_character_attuned_ac_saves_shadow.sql",
  "Breastplate",
  "Animated Shield",
  "Cloak of Protection",
  "bonusAc",
  "source provenance",
  "Shadow AC/saves function leaked role grants",
  "Legacy breastplate shield cloak staff formula unexpected",
  "Unselected magic erroneously removed physical armor",
  "Unverified magic inventory instance bypassed gate",
]) assert.ok(fixture.includes(needle) || (needle === "source provenance" && fixture.includes("unverified origin")),
  "Missing isolated AC/save regression case: "+needle);
for (const needle of [
  "validate_shared_equipment_effects_pipeline.mjs",
  "validate_attuned_ac_saves_shadow.mjs",
  "character_attuned_ac_saves_shadow.sql"
]) assert.ok(workflow.includes(needle),"Workflow missing verification: "+needle);
console.log("Legacy AC/saves resolver exact byte parity, inert shadow boundary and source-level fixture invariants passed.");

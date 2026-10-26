import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => fs.readFileSync(path,"utf8");
const source=read("sql/20261025_08_attuned_armor_shield_source_audit.sql");
const fixture=read("scripts/fixtures/attuned_armor_shield_channel_audit.sql");
const original=read("sql/20260801_03_shared_equipment_effects_pipeline.sql");
const prior=read("sql/20261025_07_character_attuned_ability_shadow.sql");
const workflow=read(".github/workflows/validate-attuned-armor-shield-channels.yml");
for (const token of [
  "private.character_attuned_armor_channel_audit_v1",
  "private.character_attuned_ability_shadow_v1(p_character_id)",
  "private.character_magic_effect_source_gate_shadow_v1(p_character_id)",
  "v_payload:=coalesce(v_catalog,'{}'::jsonb) || coalesce(v_inv.card_payload,'{}'::jsonb)",
  "'bonusAc','acBonus','bonus_ac'",
  "v_catalog->>'ac'",
  "v_inv.card_payload ? 'ac'",
  "v_category='shield' and v_physical_ac is distinct from 2",
  "v_baseline_ac->>'shieldItemId'",
  "v_baseline_ac->>'armorItemId'",
  "v_gate->>'attunementEnabled'",
  "v_direct_audit:=coalesce(v_prior->'directBonusAudit'",
  "'legacyPhysicalAcApplied'",
  "'legacyDirectBonusAc'",
  "'shadowDirectBonusRemoved'",
  "'physicalFieldKeptInShadow'",
  "'sourceChannelProvenanceReady',false",
  "'physicalChannelSourceProofReady',false",
  "'fullEffectConsumerParityReady',false",
  "'consumerEnforced',false",
  "'catalogue_instance_ac_mismatch'",
  "'magic_physical_base_unverified'",
  "revoke all on function private.character_attuned_armor_channel_audit_v1",
  "to service_role",
]) assert.ok(source.includes(token),"Armor/shield source audit missing: "+token);
for(const prohibited of [
  "update public.inventory_items","update public.characters",
  "update public.character_sheets","update public.encounter_participants",
  "create or replace function private.character_equipment_effects_v1",
  "create or replace function public.encounter_canonical_combat_snapshot_v1",
]) assert.ok(!source.toLowerCase().includes(prohibited),"Audit must not change consumer authority: "+prohibited);
assert.ok(prior.includes("private.character_attuned_ability_shadow_v1"));
for (const text of ["v_category='shield'","v_category in ('light','medium','heavy')","v_candidate_ac","v_bonus_ac := v_bonus_ac + v_number"])
  assert.ok(original.includes(text) || text==="v_category in ('light','medium','heavy')" && original.includes("v_category in ('light','medium','heavy')"),
    "Must compare against original armor/bonus field rules: "+text);
for(const token of [
  "character_attuned_ability_shadow.sql",
  "Dwarven Plate|DMG",
  "Arrow-Catching Shield|XDMG",
  "18",
  "legacyDirectBonusAc",
  "shadowDirectBonusRemoved",
  "physicalFieldKeptInShadow",
  "catalogue_instance_ac_mismatch",
  "Item source change failed to revoke prior selection",
  "OFF after instance edit changed canonical equipment"
]) assert.ok(fixture.includes(token),"Fixture missing proof: "+token);
for(const token of ["validate_shared_equipment_effects_pipeline.mjs",
 "validate_attuned_ability_shadow.mjs",
 "validate_attuned_armor_shield_channels.mjs",
 "attuned_armor_shield_channel_audit.sql"]) assert.ok(workflow.includes(token),"Workflow missing check: "+token);
console.log("Armor/shield channel audit is inert, reports provenance uncertainty, and preserves current physical equipment authority.");

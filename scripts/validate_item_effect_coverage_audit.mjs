import fs from "node:fs";
import assert from "node:assert/strict";

// Read-only contract audit. No Supabase connection, mutation, or source patches.
// Run: node scripts/validate_item_effect_coverage_audit.mjs
const read = (path) => fs.readFileSync(path, "utf8");
const files = {
  card: read("components/ItemCard.js"),
  cardText: read("utils/itemCardText.js"),
  local: read("utils/equipmentEffects.js"),
  authoritative: read("utils/authoritativeEquipmentEffects.js"),
  sheetPanel: read("components/CharacterSheetPanel.js"),
  sheet: read("components/CharacterSheet5e.js"),
  weapon: read("sql/20260801_04_shared_equipment_effects_tactical_modifiers.sql"),
  equipment: read("sql/20260801_03_shared_equipment_effects_pipeline.sql"),
  mitigation: read("sql/20261016_07_equipped_item_damage_mitigation.sql"),
  importer: read("scripts/build-all-items.mjs"),
  seed: read("scripts/seed_items_catalog.mjs"),
  docs: read("docs/Item_Character_Effects_Coverage_Audit_2026-10-24.md"),
};
const required = [
  ["importer", "resolveItemCopies"], ["importer", "applyCampaignItemRuleOverrides"],
  ["seed", 'onConflict: "item_key"'],
  ["card", "canonicalItemMechanicFields"], ["card", "mergedItem"],
  ["local", "mergeNumericBonuses"], ["local", "mergeStructuredAdvDis"],
  ["authoritative", "mergeAuthoritativeEquipmentEffects"],
  ["authoritative", 'supabase.rpc("character_equipment_effects_v1"'],
  ["sheetPanel", "mergeAuthoritativeEquipmentEffects"],
  ["sheet", "itemBonuses"],
  ["equipment", "private.character_equipment_effects_v1"],
  ["equipment", "v_item.card_payload"],
  ["equipment", "v_catalog"],
  ["equipment", "'effectiveMod'"],
  ["weapon", "bonusWeapon"],
  ["mitigation", "damageReductionByType"],
  ["mitigation", "resist"],
];
for (const [file, token] of required) assert.ok(files[file].includes(token), `Contract drift: ${file} no longer contains ${token}`);

const mapping = [
  {field:"bonusAc", producer:["importer","card"], consumers:["local","equipment"], status:"confirmed"},
  {field:"bonusSavingThrow", producer:["cardText"], consumers:["local","equipment"], status:"confirmed"},
  {field:"bonusWeapon", producer:["importer"], consumers:["weapon"], status:"separate-weapon-path"},
  {field:"bonusSpellAttack", producer:["cardText"], consumers:[], status:"no-verified-numeric-consumer"},
  {field:"bonusSpellSaveDc", producer:["cardText"], consumers:[], status:"no-verified-numeric-consumer"},
  {field:"bonusProficiencyBonus", producer:["cardText"], consumers:[], status:"no-verified-numeric-consumer"},
  {field:"conditionImmune", producer:["cardText"], consumers:[], status:"unverified"},
  {field:"immune", producer:["cardText"], consumers:[], status:"unverified-equipment-consumer"},
  {field:"resist", producer:["cardText"], consumers:["mitigation"], status:"separate-damage-path"},
  {field:"damageReductionByType", producer:["cardText"], consumers:["mitigation"], status:"separate-damage-path"},
];
for (const row of mapping) {
  assert.ok(row.producer.some(p=>files[p].includes(row.field)), `Producer missing: ${row.field}`);
  for (const p of row.consumers) assert.ok(files[p].includes(row.field), `Consumer missing: ${row.field} in ${p}`);
}
const gaps = mapping.filter(row=>!row.consumers.length);
console.log("Item effects audit: contract checks PASS.");
console.log("Structured field mapping:");
for (const row of mapping) console.log(`  ${row.field}: ${row.status}`);
console.log(`${gaps.length} fields remain explicitly unverified/not wired in this coverage sample; documentation required.`);

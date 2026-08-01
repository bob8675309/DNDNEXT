import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationPath = path.join(root, "sql/20260801_02_equipped_armor_canonical_ac.sql");
const source = fs.readFileSync(migrationPath, "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function abilityModifier(score) {
  return Math.floor((Number(score || 10) - 10) / 2);
}

function calculateAc({ dex, fallbackAc, armorBase = null, armorCategory = null, shieldBonus = 0 }) {
  const dexMod = abilityModifier(dex);
  let baseAc = Number.isFinite(Number(fallbackAc)) ? Number(fallbackAc) : 10 + dexMod;
  if (Number.isFinite(Number(armorBase))) {
    if (armorCategory === "heavy") baseAc = Number(armorBase);
    if (armorCategory === "medium") baseAc = Number(armorBase) + Math.min(dexMod, 2);
    if (armorCategory === "light") baseAc = Number(armorBase) + dexMod;
  }
  return baseAc + Number(shieldBonus || 0);
}

const cases = [
  { name: "Pip unarmored", input: { dex: 12, fallbackAc: 11 }, expected: 11 },
  { name: "Letho studded leather", input: { dex: 20, fallbackAc: 15, armorBase: 12, armorCategory: "light" }, expected: 17 },
  { name: "Raska chain mail and shield", input: { dex: 16, fallbackAc: 13, armorBase: 16, armorCategory: "heavy", shieldBonus: 2 }, expected: 18 },
  { name: "Aurelia scale mail and shield", input: { dex: 8, fallbackAc: 9, armorBase: 14, armorCategory: "medium", shieldBonus: 2 }, expected: 15 },
];

for (const testCase of cases) {
  expect(calculateAc(testCase.input) === testCase.expected, `${testCase.name}: expected AC ${testCase.expected}`);
}

for (const token of [
  "private.encounter_equipped_armor_class_v1",
  "public.encounter_canonical_combat_snapshot_v1",
  "lower(coalesce(i.owner_type, '')) in ('npc', 'merchant', 'character')",
  "from public.character_permissions cp",
  "coalesce(cp.can_edit, false)",
  "lower(coalesce(v_item.equip_slot, '')) = 'body'",
  "when 'medium' then v_armor_base + least(v_dex_mod, 2)",
  "when 'light' then v_armor_base + v_dex_mod",
  "when 'heavy' then v_armor_base",
  "v_final_ac := v_base_ac + v_shield_bonus",
  "if coalesce(v_candidate_ac, 2) > v_shield_bonus then",
  "v_ac_details := private.encounter_equipped_armor_class_v1(p_character_id, v_dex, v_ac)",
  "return jsonb_build_object(\n    'str', v_str,\n    'dex', v_dex,\n    'prof', v_prof,\n    'ac', v_ac,\n    'hp', v_hp",
  "revoke all on function private.encounter_equipped_armor_class_v1",
]) {
  expect(source.includes(token), `Migration missing required token: ${token}`);
}

for (const rawType of ["'s|%'", "'ha|%'", "'ma|%'", "'la|%'"]) {
  expect(source.includes(rawType), `Migration missing raw equipment type support: ${rawType}`);
}

for (const forbidden of [
  "map_routes",
  "map_route_points",
  "locations",
  "world_map",
  "town_map",
  "update public.encounter_participants",
  "update public.encounters",
  "insert into public.encounter",
  "delete from public.encounter",
]) {
  expect(!source.includes(forbidden), `Canonical AC migration must not reference or mutate ${forbidden}`);
}

for (const generatedId of [
  "12e3ef86-1883-4c6c-bd5f-524ee606cc75",
  "68f850b3-3791-411c-9a30-b18e3f8f46d4",
  "f551a180-c33c-4285-ac2a-8a46eaac5707",
  "1e706acc-9333-4a2e-8af4-162b4a473eca",
]) {
  expect(!source.includes(generatedId), "Migration must remain generic and contain no test-character IDs");
}

if (failures.length) {
  console.error("Equipped armor canonical AC validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Equipped armor canonical AC validation passed.");

import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "pages", "items.js");
let source = fs.readFileSync(target, "utf8");

const patchedMarker = "smithing.original_base_dmg1";
if (source.includes(patchedMarker)) {
  console.log("Smithing base-dice patch already present.");
  process.exit(0);
}

const replacements = [
  [
`function weaponBaseDamageProfile(recipe = {}, baseItem = null) {
  const payload = baseItem?.payload || baseItem?.raw?.card_payload || {};
  const source = payload.dmg1 || payload.damage1 || baseItem?.raw?.dmg1 || recipe?.dmg1 || recipe?.item_preview?.damage || payload.damageText || "";
  return parseDiceExpression(source);
}`,
`function weaponBaseDamageProfile(recipe = {}, baseItem = null) {
  const payload = baseItem?.payload || baseItem?.raw?.card_payload || {};
  const smithing = payload?.smithing && typeof payload.smithing === "object" ? payload.smithing : {};
  const source = smithing.original_base_dmg1 || payload?.smithing_result?.originalBaseDamage || payload?.smithing_result?.baseDamage || payload.dmg1 || payload.damage1 || baseItem?.raw?.dmg1 || recipe?.dmg1 || recipe?.item_preview?.damage || payload.damageText || "";
  return parseDiceExpression(source);
}`
  ],
  [
`function weaponSecondaryDamageProfile(recipe = {}, baseItem = null) {
  const payload = baseItem?.payload || baseItem?.raw?.card_payload || {};
  const source = payload.dmg2 || payload.damage2 || baseItem?.raw?.dmg2 || recipe?.dmg2 || recipe?.catalog_item?.dmg2 || "";
  return parseDiceExpression(source);
}`,
`function weaponSecondaryDamageProfile(recipe = {}, baseItem = null) {
  const payload = baseItem?.payload || baseItem?.raw?.card_payload || {};
  const smithing = payload?.smithing && typeof payload.smithing === "object" ? payload.smithing : {};
  const source = smithing.original_base_dmg2 || payload?.smithing_result?.originalSecondaryDamage || payload.dmg2 || payload.damage2 || baseItem?.raw?.dmg2 || recipe?.dmg2 || recipe?.catalog_item?.dmg2 || "";
  return parseDiceExpression(source);
}`
  ],
  ["formatScaledWeaponDamage(baseDice, convertedEffectPct)", "formatScaledWeaponDamage(rawBaseDice, convertedEffectPct)"],
  ["convertsBase && secondaryDice ? formatScaledWeaponDamage(secondaryDice, convertedEffectPct)", "convertsBase && rawSecondaryDice ? formatScaledWeaponDamage(rawSecondaryDice, convertedEffectPct)"],
  ["formatScaledWeaponDamage(baseDice, pct)", "formatScaledWeaponDamage(rawBaseDice, pct)"],
  ["    baseType,\n    convertedBaseType: convertsBase,", "    originalBaseDamage: rawBaseDice ? `${rawBaseDice.count}d${rawBaseDice.size}` : null,\n    originalSecondaryDamage: rawSecondaryDice ? `${rawSecondaryDice.count}d${rawSecondaryDice.size}` : null,\n    baseType,\n    convertedBaseType: convertsBase,"],
  ["matched effect converts the base damage and rounds up to whole weapon dice.", "matched effect converts damage from the weapon’s original base dice."]
];

for (const [before, after] of replacements) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Smithing patch expected one match but found ${count}: ${before.slice(0, 100)}`);
  source = source.replace(before, after);
}

const required = [
  "smithing.original_base_dmg1",
  "smithing.original_base_dmg2",
  "formatScaledWeaponDamage(rawBaseDice, convertedEffectPct)",
  "formatScaledWeaponDamage(rawSecondaryDice, convertedEffectPct)",
  "formatScaledWeaponDamage(rawBaseDice, pct)",
  "originalBaseDamage: rawBaseDice",
  "originalSecondaryDamage: rawSecondaryDice",
  "weapon’s original base dice"
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Smithing patch validation failed: ${token}`);
}

fs.writeFileSync(target, source, "utf8");
console.log("Applied smithing original-base-dice patch to pages/items.js.");

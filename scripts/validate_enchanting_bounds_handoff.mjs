import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "pages", "items.js"), "utf8");

const checks = [
  ["function enchantingSlotProfileForRecipe", "slot profile helper"],
  ["function normalizedEnchantingAppliesTo", "applies-to normalization helper"],
  ["Slot A Arcane Catalyst", "slot A catalyst label"],
  ["Slot B Arcane Catalyst", "slot B catalyst label"],
  ["Slot C Arcane Catalyst", "slot C catalyst label"],
  ["normalizedEnchantingAppliesTo(recipe)", "recipe applies-to check"],
  ["slotProfile.minTier", "slot profile tier bound"],
  ["enchanting_slot: slotProfile.slot", "enchanting slot component metadata"],
  ["min_rarity: slotProfile.minRarity", "minimum rarity component metadata"],
  ["arcane catalyst|sigil dust|planar core|elder star shard|catalyst|rune|sigil|gem|crystal|dust", "enchanting material category regex"],
];

const missing = checks.filter(([token]) => !source.includes(token));
if (missing.length) {
  console.warn("Enchanting bounds handoff is partially applied; missing markers:");
  for (const [, label] of missing) console.warn(`- ${label}`);
} else {
  console.log("Enchanting bounds handoff validated.");
}

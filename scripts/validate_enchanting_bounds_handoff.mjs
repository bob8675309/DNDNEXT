import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "pages", "items.js"), "utf8");

function requireToken(token) {
  if (!source.includes(token)) throw new Error(`Enchanting bounds handoff: missing ${token}`);
}

for (const token of [
  "function enchantingSlotProfileForRecipe",
  "function normalizedEnchantingAppliesTo",
  "Slot A Arcane Catalyst",
  "Slot B Arcane Catalyst",
  "Slot C Arcane Catalyst",
  "normalizedEnchantingAppliesTo(recipe)",
  "slotProfile.minTier",
  "enchanting_slot: slotProfile.slot",
  "min_rarity: slotProfile.minRarity",
  "arcane catalyst|sigil dust|planar core|elder star shard|catalyst|rune|sigil|gem|crystal|dust",
]) requireToken(token);

console.log("Enchanting bounds handoff validated.");

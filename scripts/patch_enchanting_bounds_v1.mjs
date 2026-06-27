import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const target = path.join(process.cwd(), "pages", "items.js");
let source = fs.readFileSync(target, "utf8");

const helperBlock = `function enchantingSlotProfileForRecipe(recipe = {}) {
  const r = rarity(recipe?.rarity || "Common");
  if (r === "Very Rare") return { slot: "C", label: "Slot C Arcane Catalyst", minTier: 3, minRarity: "Rare" };
  if (r === "Rare") return { slot: "B", label: "Slot B Arcane Catalyst", minTier: 2, minRarity: "Uncommon" };
  return { slot: "A", label: "Slot A Arcane Catalyst", minTier: 1, minRarity: "Common" };
}
function normalizedEnchantingAppliesTo(recipe = {}) {
  const raw = Array.isArray(recipe.applies_to) ? recipe.applies_to : String(recipe.category || recipe.family || "").split(/\s*\/\s*|,|\|/);
  const out = raw.map((value) => String(value || "").toLowerCase().trim()).filter(Boolean).map((value) => {
    if (/ammo|ammunition|arrow|bolt/.test(value)) return "ammunition";
    if (/shield/.test(value)) return "shield";
    if (/armor|armour/.test(value)) return "armor";
    if (/weapon|melee|ranged|sword|axe|bow|ammunition/.test(value)) return "weapon";
    return value;
  });
  return Array.from(new Set(out));
}
`;

if (!source.includes("function enchantingSlotProfileForRecipe")) {
  source = replaceOnce(source, 'function physicalItemKind(item = {}) {', `${helperBlock}function physicalItemKind(item = {}) {`, "Enchanting helper insertion");
}

source = replaceOnce(source,
  '  if (recipe.discipline === "Enchanting") {\n    if (!physical) return false;\n    const itemTier = physicalEnhancementTier(item);\n    const minimumTier = Math.max(1, recipePhysicalTier(recipe));\n    return itemTier >= minimumTier && itemTier <= 3;\n  }',
  '  if (recipe.discipline === "Enchanting") {\n    if (!physical) return false;\n    const itemKind = physicalItemKind(item);\n    const appliesTo = normalizedEnchantingAppliesTo(recipe);\n    if (appliesTo.length && itemKind && !appliesTo.includes(itemKind)) return false;\n    const itemTier = physicalEnhancementTier(item);\n    const slotProfile = enchantingSlotProfileForRecipe(recipe);\n    return itemTier >= slotProfile.minTier && itemTier <= 3;\n  }',
  "Enchanting base-item bounds");

source = replaceOnce(source,
  '  const blob = recipeComponentText(recipe);',
  '  if (recipe?.discipline === "Enchanting") {\n    const slotProfile = enchantingSlotProfileForRecipe(recipe);\n    return [{ key: `enchant-${slotProfile.slot.toLowerCase()}-catalyst`, category: "Catalyst", label: slotProfile.label, required: true, enchanting_slot: slotProfile.slot, min_rarity: slotProfile.minRarity }];\n  }\n\n  const blob = recipeComponentText(recipe);',
  "Enchanting catalyst-only component slots");

source = replaceOnce(source,
  '  if (d === "enchanting") {\n    if (category === "catalyst" || category === "monster part") return true;\n    if (category === "ore / metal" || category === "material") return /(mithral|adamant|silver|ruidium|orichalcum|cold iron|obsidian|blood glass|star metal|stygian|moonsilver|riverine|crystal|shard|gem|arcane|planar)/.test(blob);\n    return false;\n  }',
  '  if (d === "enchanting") {\n    return category === "catalyst" || /arcane catalyst|sigil dust|planar core|elder star shard|catalyst|rune|sigil|gem|crystal|dust/.test(blob);\n  }',
  "Enchanting material category bounds");

fs.writeFileSync(target, source, "utf8");

for (const token of ["enchantingSlotProfileForRecipe", "normalizedEnchantingAppliesTo", "Slot A Arcane Catalyst", "slotProfile.minTier"]) {
  if (!source.includes(token)) throw new Error(`Enchanting bounds patch validation failed: ${token}`);
}
console.log("Patched enchanting base item bounds and catalyst formula slots.");

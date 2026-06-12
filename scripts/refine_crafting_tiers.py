from pathlib import Path

path = Path("pages/items.js")
text = path.read_text()

old = '''function isCraftBaseCandidate(item, recipe) {
  if (!item || !recipe) return false;
  const blob = [item.name, item.type, item.rarity, item.payload?.item_type, item.payload?.type, item.payload?.uiType].filter(Boolean).join(" ").toLowerCase();
  if (recipe.kind === "forge" || recipe.kind === "alchemy" || recipe.discipline === "Alchemy") return false;
  if (recipe.discipline === "Smithing") return /(weapon|armor|shield|ammunition|melee|ranged)/.test(blob);
  if (recipe.discipline === "Enchanting") return /(weapon|armor|shield|ammunition|melee|ranged|\+\d+)/.test(blob);
  return true;
}'''

new = '''function physicalEnhancementTier(item = {}) {
  const payload = item?.payload && typeof item.payload === "object" ? item.payload : {};
  const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  const explicit = Number(
    payload.enhancement_tier ?? payload.enhancementTier ?? payload.magic_tier ?? payload.magicTier ?? payload.tier
    ?? raw.enhancement_tier ?? raw.enhancementTier ?? raw.magic_tier ?? raw.magicTier ?? raw.tier ?? 0
  );
  if (explicit >= 1 && explicit <= 4) return explicit;
  const nameBlob = [item?.name, raw?.item_name, payload?.name, payload?.item_name].filter(Boolean).join(" ");
  const match = nameBlob.match(/(?:^|\\s)\\+([1-4])\\b/);
  return match ? Number(match[1]) : 0;
}
function recipePhysicalTier(recipe = {}) {
  const recipeRarity = rarity(recipe.rarity || "");
  if (recipeRarity === "Uncommon") return 1;
  if (recipeRarity === "Rare") return 2;
  if (recipeRarity === "Very Rare") return 3;
  if (recipeRarity === "Legendary") return 4;
  return 0;
}
function isCraftBaseCandidate(item, recipe) {
  if (!item || !recipe) return false;
  const blob = [item.name, item.type, item.rarity, item.payload?.item_type, item.payload?.type, item.payload?.uiType].filter(Boolean).join(" ").toLowerCase();
  const physical = /(weapon|armor|shield|ammunition|melee|ranged)/.test(blob);
  if (recipe.kind === "forge" || recipe.kind === "alchemy" || recipe.discipline === "Alchemy") return false;
  if (recipe.discipline === "Smithing") {
    if (!physical) return false;
    if (recipe.kind !== "temper") return true;
    const targetTier = recipePhysicalTier(recipe);
    return physicalEnhancementTier(item) === Math.max(0, targetTier - 1);
  }
  if (recipe.discipline === "Enchanting") {
    if (!physical) return false;
    const itemTier = physicalEnhancementTier(item);
    const minimumTier = Math.max(1, recipePhysicalTier(recipe));
    return itemTier >= minimumTier && itemTier <= 3;
  }
  return true;
}'''

if old in text:
    path.write_text(text.replace(old, new, 1))
elif "function physicalEnhancementTier" not in text:
    raise RuntimeError("Expected crafting base-candidate block was not found")

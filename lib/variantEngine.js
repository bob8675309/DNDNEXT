// /lib/variantEngine.js
// Combines a mundane base item with up to 4 variant effects.
// - Never pulls magical catalog items as "variants"
// - Skips vestiges
// - Builds a stable item_id
// - Merges descriptions and bumps rarity

// ---- helpers ---------------------------------------------------------------

const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"];

export function slugify(s) {
  return String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

// FNV-1a short hash for stable IDs
export function shortHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  // 8 hex chars is plenty here
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

export function rarityBump(baseRarity = "Common", variants = []) {
  // Each variant can define bump: -1/0/+1/+2, or explicit rarity
  const baseIndex = Math.max(0, RARITY_ORDER.indexOf(baseRarity));
  let index = baseIndex;

  for (const v of variants) {
    if (!v) continue;
    if (v.rarity) {
      index = Math.max(index, RARITY_ORDER.indexOf(v.rarity));
    } else if (typeof v.bump === "number") {
      index = Math.min(RARITY_ORDER.length - 1, Math.max(0, index + v.bump));
    }
  }
  return RARITY_ORDER[index] || baseRarity;
}

export function canonicalizeVariantKey(v) {
  // Prefer a unique key from magicvariants.json; fall back to name
  return v.key || v.id || v.name || v.label || "";
}

export function orderNameParts(baseName, variants) {
  // Convention:
  //  [+N] [prefix…] Base Name [of Suffix …]
  const bonus = variants.find(v => v.category === "bonus");
  const prefixes = variants.filter(v => v.category === "prefix");
  const suffixes = variants.filter(v => v.category === "suffix");

  const parts = [];
  if (bonus && (bonus.label || bonus.name)) parts.push(bonus.label || bonus.name);
  if (prefixes.length) parts.push(prefixes.map(p => p.label || p.name).join(" "));
  parts.push(baseName);
  if (suffixes.length) {
    const suffixStr = suffixes.map(s => s.label || s.name).join(" and ");
    parts.push("of " + suffixStr);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function mergeDescriptions(baseDesc, variants) {
  const bits = [];
  if (baseDesc) bits.push(String(baseDesc).trim());
  for (const v of variants) {
    if (v && v.description) bits.push(String(v.description).trim());
  }
  return bits.filter(Boolean).join("\n\n");
}

export function pickFlavor(name, flavorOverridesMap, baseFlavor) {
  // flavorOverridesMap: { [name]: { flavor } }
  if (name && flavorOverridesMap && flavorOverridesMap[name]?.flavor) {
    return flavorOverridesMap[name].flavor;
  }
  return baseFlavor || null;
}

export function computeItemId(baseName, variants) {
  const key = `${slugify(baseName)}|${variants.map(canonicalizeVariantKey).sort().join("|")}`;
  return `mv-${shortHash(key)}`;
}

// ---- main ------------------------------------------------------------------

export function buildMagicVariant({
  baseItem,        // { name, type, rarity, description, weight, cost, tags? }
  chosenVariants,  // array of <= 4 variant defs from magicvariants.json
  flavorOverrides, // { [itemName]: { flavor } } (optional)
}) {
  const safeVariants = (chosenVariants || []).slice(0, 4).filter(Boolean);

  // Skip vestiges completely (by tag or name)
  if (
    /vestige/i.test(baseItem?.name || "") ||
    (Array.isArray(baseItem?.tags) && baseItem.tags.some(t => /vestige/i.test(String(t))))
  ) {
    throw new Error("Vestige items are excluded from variant building.");
  }

  const item_name = orderNameParts(baseItem.name, safeVariants);
  const item_rarity = rarityBump(baseItem.rarity || "Common", safeVariants);
  const item_description = mergeDescriptions(baseItem.description, safeVariants);
  const item_id = computeItemId(baseItem.name, safeVariants);

  const flavor = pickFlavor(item_name, flavorOverrides);

  return {
    item_id,
    item_name,
    item_type: baseItem.type || null,
    item_rarity,
    item_description,
    item_weight: baseItem.weight ?? null,
    item_cost: null, // per your request: ignore pricing
    flavor,          // not persisted to inventory_items (unless you want to)
  };
}

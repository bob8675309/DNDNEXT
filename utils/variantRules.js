// utils/variantRules.js
// Lightweight rules engine for your "on-the-fly" magic variants.

import mv from "../magicvariants.json";

// crude category test helpers; adjust these to match your item schema
export function isWeapon(item) {
  const t = (item?.item_type || item?.type || "").toLowerCase();
  return t.includes("weapon");
}
export function isArmor(item) {
  const t = (item?.item_type || item?.type || "").toLowerCase();
  return t.includes("armor");
}
export function isShield(item) {
  const n = (item?.item_name || item?.name || "").toLowerCase();
  return n.includes("shield");
}
export function isAmmunition(item) {
  const n = (item?.item_name || item?.name || "").toLowerCase();
  return /(arrow|bolt|bullet|ammunition|shot)/i.test(n);
}

// Basic “vestige” guard by name (builder should not surface these)
const VESTIGE_RE = /\bvestige\b/i;

// We only expose generic variant entries; never force specific named items.
const GENERIC_VARIANT_ALLOW = [
  "weapon",
  "weapon (no damage)",
  "armor",
  "shield",
  "ammunition",
];

// Simple filter that keeps generic variants and drops vestiges/oddities
export function getAllGenericVariants() {
  const arr = mv?.magicvariant ?? [];
  return arr.filter((v) => {
    const n = (v?.name || "").toLowerCase();
    if (VESTIGE_RE.test(n)) return false;
    // gate by generic buckets
    return GENERIC_VARIANT_ALLOW.some((kw) => n.includes(kw));
  });
}

// Given a base item, return a pruned variant list that “makes sense”
export function variantsForBaseItem(base) {
  const all = getAllGenericVariants();
  return all.filter((v) => {
    const n = (v?.name || "").toLowerCase();
    if (isShield(base)) return n.includes("shield") || n.includes("armor");
    if (isAmmunition(base)) return n.includes("ammunition");
    if (isArmor(base)) return n.includes("armor");
    if (isWeapon(base)) return n.includes("weapon") || n.includes("ammunition");
    return false;
  });
}

// Small helpers to detect +X from variant name like "+1 Weapon", "+2 Armor", etc.
function extractPlus(n) {
  const m = /^\s*\+([123])\b/.exec(n);
  return m ? Number(m[1]) : 0;
}

// Apply up to 4 variants. We only touch safe fields and keep it additive.
// - name: decorate
// - computed: { acBonus, attackBonus, damageBonus, notes[] }
// - tags: add variant names
export function applyVariants(baseItem, selectedVariants = []) {
  const max = 4;
  const picked = selectedVariants.slice(0, max);

  const result = {
    ...baseItem,
    // do not mutate the original
    computed: {
      ...(baseItem.computed || {}),
      acBonus: Number(baseItem?.computed?.acBonus || 0),
      attackBonus: Number(baseItem?.computed?.attackBonus || 0),
      damageBonus: Number(baseItem?.computed?.damageBonus || 0),
      notes: [...(baseItem?.computed?.notes || [])],
    },
    tags: new Set([...(baseItem?.tags || [])]),
    variants: [],
  };

  // decorate name as “Base Name (v1, v2, …)”
  const appliedNames = [];

  for (const v of picked) {
    const name = typeof v === "string" ? v : v?.name;
    if (!name) continue;
    appliedNames.push(name);
    result.variants.push(name);
    result.tags.add("Magic");
    result.tags.add(name);

    // add basic math for +1/2/3
    const plus = extractPlus(name);

    if (isShield(baseItem) || isArmor(baseItem)) {
      // +X Armor / +X Shield = AC bump
      if (plus) result.computed.acBonus += plus;
    } else if (isWeapon(baseItem) || isAmmunition(baseItem)) {
      // +X Weapon = to-hit and damage bump
      if (plus) {
        result.computed.attackBonus += plus;
        result.computed.damageBonus += plus;
      }
    }

    // Add a short note so you can reference the original text if needed
    result.computed.notes.push(name);
  }

  const baseName = baseItem.item_name || baseItem.name;
  if (appliedNames.length) {
    result.item_name = `${baseName} (${appliedNames.join(", ")})`;
    result.name = result.item_name;
  } else {
    result.item_name = baseName;
    result.name = baseName;
  }

  result.tags = Array.from(result.tags);
  return result;
}

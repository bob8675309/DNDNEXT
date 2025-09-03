// src/utils/applyVariants.js
const VESTIGE_WORDS = ["vestige","awakened","dormant","exalted"];

export function isVestigeName(name = "") {
  const n = String(name).toLowerCase();
  return VESTIGE_WORDS.some(w => n.includes(w));
}

export function makeDerivedName(baseName, variants) {
  // e.g. "Shortsword" + ["+1", "of Warning"] => "+1 Shortsword of Warning"
  const prefixes = variants.map(v => v.namePrefix || "").filter(Boolean);
  const suffixes = variants.map(v => v.nameSuffix || "").filter(Boolean);
  const prefix = prefixes.length ? prefixes.join(" ") + " " : "";
  const suffix = suffixes.length ? " " + suffixes.join(" ") : "";
  return (prefix + baseName + suffix).replace(/\s+/g, " ").trim();
}

function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }
function clamp(n, mn, mx) { return Math.max(mn, Math.min(mx, n)); }

function mergeTextBlocks(baseText = "", variants) {
  const blocks = [baseText.trim(), ...variants.map(v => (v.textBlock || "").trim())]
    .filter(Boolean);
  return blocks.join("\n\n");
}

function compatible(base, variant) {
  // quick checks; you can expand as needed
  if (variant.excludesVestiges && isVestigeName(base.name)) return false;
  if (variant.forType && !variant.forType.includes(base.type)) return false; // "weapon"|"armor"|"any"
  if (variant.onlyFor && !variant.onlyFor.some(tag => base.tags?.includes(tag))) return false;
  if (variant.notFor && variant.notFor.some(tag => base.tags?.includes(tag))) return false;
  return true;
}

export function applyVariants(baseItem, variantsInput = [], opts = {}) {
  if (!baseItem || typeof baseItem !== "object") throw new Error("No base item");
  if (isVestigeName(baseItem.name)) return baseItem; // skip Vestiges entirely

  // normalize & truncate to 4 distinct variants
  const variants = uniq(variantsInput).slice(0, 4);

  // filter to only those that are compatible with the base (and each other by stackGroup)
  const stackSeen = new Set();
  const chosen = [];
  for (const v of variants) {
    if (!v || !v.id) continue;
    if (!compatible(baseItem, v)) continue;
    if (v.stackGroup) {
      if (stackSeen.has(v.stackGroup)) continue;
      stackSeen.add(v.stackGroup);
    }
    chosen.push(v);
  }

  // start from a clone of the base
  const out = JSON.parse(JSON.stringify(baseItem));

  // name
  out.name = makeDerivedName(baseItem.name, chosen);

  // rarity: accumulate integer deltas then clamp into allowed enum if you use one
  const rarityDelta = chosen.reduce((n, v) => n + (v.rarityDelta || 0), 0);
  out.rarityValue = clamp((baseItem.rarityValue || 0) + rarityDelta, -1, 5); // -1 none/common .. 5 artifact
  // (optional) map rarityValue -> string: you can already have this mapping elsewhere.

  // attunement
  out.attunement = !!(baseItem.attunement || chosen.some(v => v.attunementRequired));

  // numeric bonuses (attack/AC/damage); never touch price per your request
  out.bonusAttack = (out.bonusAttack || 0) + chosen.reduce((n,v)=> n + (v.bonusAttack || 0), 0);
  out.bonusDamage = (out.bonusDamage || 0) + chosen.reduce((n,v)=> n + (v.bonusDamage || 0), 0);
  out.bonusAC     = (out.bonusAC     || 0) + chosen.reduce((n,v)=> n + (v.bonusAC     || 0), 0);

  // damage dice / type overrides (if present)
  const lastReplaceDice  = [...chosen].reverse().find(v => v.damageDiceReplace);
  const lastReplaceType  = [...chosen].reverse().find(v => v.damageTypeReplace);
  if (lastReplaceDice) out.damageDice = lastReplaceDice.damageDiceReplace;
  if (lastReplaceType) out.damageType = lastReplaceType.damageTypeReplace;

  // properties & tags
  out.properties = uniq([...(out.properties || []), ...chosen.flatMap(v => v.addsProperties || [])]);
  out.tags       = uniq([...(out.tags || []),       ...chosen.flatMap(v => v.addsTags || [])]);

  // rules text / description
  out.text = mergeTextBlocks(baseItem.text, chosen);

  // provenance for UI
  out._variants = chosen.map(v => ({ id: v.id, name: v.name }));
  out._isDerived = true;

  return out;
}

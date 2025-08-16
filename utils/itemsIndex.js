// utils/itemsIndex.js
// Builds a by-name catalog from your JSON sources and returns helpers
//
// Shape returned:
// { byKey: { [normName]: ItemRecord }, norm: (s)=>string }
//
// ItemRecord has (at least):
//   name, type, rarity, source, slot, cost, weight
//   attunementText (e.g., "requires attunement" / "requires attunement by a wizard")
//   dmg1, dmg2, dmgType, range, properties (array of codes)
//   damageText (e.g., "1d6 piercing; versatile (1d8)")
//   rangeText (e.g., "Thrown 20/60 ft.")
//   propertiesText (human readable, e.g., "Light, Finesse")
//   loreShort, loreFull  (strings)
//   rulesShort, rulesFull (strings)

export const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();

const DMG = {
  P: "piercing", S: "slashing", B: "bludgeoning",
  R: "radiant", N: "necrotic", F: "fire", C: "cold",
  L: "lightning", A: "acid", T: "thunder",
  Psn: "poison", Psy: "psychic", Frc: "force"
};

const PROP = {
  L: "Light",
  F: "Finesse",
  H: "Heavy",
  R: "Reach",
  T: "Thrown",
  V: "Versatile",
  "2H": "Two-Handed",   // keep quoted to avoid parser errors
  A: "Ammunition",
  LD: "Loading",
  S: "Special",
  RLD: "Reload",
};

function asText(x) {
  if (!x) return "";
  if (Array.isArray(x)) return x.map(asText).join("\n\n");
  if (typeof x === "object" && x.entries) return asText(x.entries);
  return String(x);
}
function joinEntries(entries) {
  if (!entries) return "";
  if (Array.isArray(entries)) return entries.map(asText).filter(Boolean).join("\n\n");
  return asText(entries);
}
function clampChars(s, max = 360) {
  if (!s) return "";
  const clean = s.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

function buildDamageText(dmg1, dmgType, dmg2, props) {
  const dt = DMG[dmgType] || dmgType || "";
  const base = dmg1 ? `${dmg1} ${dt}`.trim() : "";
  const versatile = props?.includes?.("V") && dmg2 ? `versatile (${dmg2})` : "";
  return [base, versatile].filter(Boolean).join("; ");
}

function buildRangeText(range, props) {
  if (!range && !props?.includes?.("T")) return "";
  const r = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if (props?.includes?.("T")) {
    return r ? `Thrown ${r} ft.` : "Thrown";
  }
  return r ? `${r} ft.` : "";
}

function humanProps(props = []) {
  return props.map((p) => PROP[p] || p).join(", ");
}

function attuneText(reqAttune) {
  if (!reqAttune) return "";
  if (reqAttune === true) return "requires attunement";
  return `requires attunement ${String(reqAttune)}`;
}

async function safeJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────
   TYPE CLASSIFICATION (clean, consolidated labels for the UI)
   ────────────────────────────────────────────────────────────── */

export const TYPE_LABEL_ORDER = [
  "Melee Weapon",
  "Ranged Weapon",
  "Armor",
  "Wondrous Item",
  "Potion",
  "Scroll",
  "Jewelry",
  "Instrument",
  "Ammo",
  "Explosives",
  "Trade Goods",
  "Other",
];

export const TYPE_ICON = {
  "Melee Weapon": "🗡️",
  "Ranged Weapon": "🏹",
  "Armor": "🛡️",
  "Wondrous Item": "✨",
  "Potion": "🧪",
  "Scroll": "📜",
  "Jewelry": "💍",
  "Instrument": "🎻",
  "Ammo": "🎯",
  "Explosives": "💣",
  "Trade Goods": "📦",
  "Other": "❓",
};

// Heuristics
const JEWELRY_RX = /\b(ring|amulet|necklace|pendant|bracelet|brooch|circlet|crown|tiara|earring|anklet)\b/i;
const INSTR_RX   = /\b(lute|lyre|flute|fife|horn|drum|pipes|viol|harp|instrument)\b/i;
const AMMO_RX    = /\b(arrow|bolt|bullet|shot|sling bullet|ammunition|ball|quarrel)\b/i;
const EXP_RX     = /^(exp|explosive)/i;
const TRADE_RX   = /^\$/;
const SCROLL_RX  = /^sc/i;
const WAND_ROD_RX = /^(wd|rd)/i;

function looksLikeWeapon(rawType, item) {
  const t = String(rawType || "").toLowerCase();
  if (t.includes("weapon")) return true;
  if (item?.weaponCategory) return true;
  if (item?.dmg1 || item?.dmg2 || item?.dmgType || item?.range) return true;
  return false;
}
function isRanged(item, rawType) {
  const t = String(rawType || "").toLowerCase();
  if (t.includes("ranged")) return true;
  if (Array.isArray(item?.property) && item.property.includes("A")) return true;
  if (/bow|crossbow|sling|gun|pistol|rifle|musket|dart/i.test(String(item?.name))) return true;
  return false;
}

/** Returns one canonical UI type label. */
export function classifyType(rawType, item = {}) {
  const rt = String(rawType || "");

  if (TRADE_RX.test(rt)) return "Trade Goods";
  if (SCROLL_RX.test(rt) || /scroll/i.test(String(item?.name))) return "Scroll";
  if (/potion/i.test(rt) || /potion|elixir|philter|draught/i.test(String(item?.name))) return "Potion";
  if (EXP_RX.test(rt) || /bomb|keg|dynamite|grenade|explosive/i.test(String(item?.name))) return "Explosives";

  if (AMMO_RX.test(String(item?.name))) return "Ammo";

  if (/armor/i.test(rt) || /armor|chain|plate|leather|shield/i.test(String(item?.name)) || item?.ac) {
    return "Armor";
  }

  if (looksLikeWeapon(rt, item)) {
    return isRanged(item, rt) ? "Ranged Weapon" : "Melee Weapon";
  }

  if (JEWELRY_RX.test(String(item?.name))) return "Jewelry";
  if (INSTR_RX.test(String(item?.name)) || /instrument/i.test(rt)) return "Instrument";

  if (WAND_ROD_RX.test(rt)) return "Wondrous Item";
  if (/wondrous/i.test(rt)) return "Wondrous Item";

  return "Other";
}

/** For building the Type dropdown in a nice, stable order. */
export function buildTypeFacets(items) {
  const found = new Set(
    (items || []).map((it) => classifyType(it.item_type || it.type || "", it))
  );
  return TYPE_LABEL_ORDER.filter((lbl) => found.has(lbl));
}

/* ──────────────────────────────────────────────────────────────
   CATALOG LOADER (kept as-is; now you also have classifiers above)
   ────────────────────────────────────────────────────────────── */

export async function loadItemsIndex() {
  // 1) If a merged catalog exists, use it first
  const merged = await safeJson("/items/all-items.json");

  let byKey = {};
  if (Array.isArray(merged) && merged.length) {
    for (const it of merged) {
      const key = norm(it.name || it.item_name);
      if (!key) continue;
      const props = it.property || it.properties;
      const dmgText = buildDamageText(it.dmg1, it.dmgType, it.dmg2, props);
      const rangeText = buildRangeText(it.range, props);
      const propsText = humanProps(props || []);
      byKey[key] = {
        name: it.name || it.item_name,
        type: it.type || it.item_type || null,
        rarity: it.rarity || it.item_rarity || null,
        source: it.source || null,
        slot: it.slot || null,
        cost: it.cost || it.item_cost || null,
        weight: it.weight || it.item_weight || null,
        reqAttune: it.reqAttune || null,
        attunementText: attuneText(it.reqAttune),
        dmg1: it.dmg1 || null,
        dmg2: it.dmg2 || null,
        dmgType: it.dmgType || null,
        range: it.range || null,
        properties: props || [],
        damageText: dmgText,
        rangeText,
        propertiesText: propsText,
        loreFull: it.loreFull || it.lore || "",
        loreShort: it.loreShort || clampChars(it.loreFull || it.lore || "", 360),
        rulesFull: it.rulesFull || it.description || joinEntries(it.entries) || "",
        rulesShort: clampChars(it.rulesFull || it.description || joinEntries(it.entries) || "", 420),
      };
    }
    return { byKey, norm };
  }

  // 2) Otherwise, dynamically merge your four sources
  const [base, fluff, foundry, variants] = await Promise.all([
    safeJson("/items/items-base.json"),
    safeJson("/items/fluff-items.json"),
    safeJson("/items/foundry-items.json"),
    safeJson("/items/magicvariants.json"),
  ]);

  const fluffBy = {};
  if (Array.isArray(fluff)) {
    for (const f of fluff) {
      const k = norm(f.name);
      const lore = joinEntries(f.entries);
      if (k && lore) fluffBy[k] = lore;
    }
  }

  const foundryBy = {};
  if (Array.isArray(foundry)) {
    for (const f of foundry) {
      const k = norm(f.name || f.label);
      if (!k) continue;
      const sys = f.system || f.data || {};
      const desc = asText(sys.description?.value || sys.description || sys.details?.description?.value);
      foundryBy[k] = { desc };
    }
  }

  const variantBy = {};
  if (Array.isArray(variants)) {
    for (const v of variants) {
      const k = norm(v.name);
      if (!k) continue;
      variantBy[k] = v; // rarity, source, etc.
    }
  }

  if (Array.isArray(base)) {
    for (const it of base) {
      const key = norm(it.name);
      if (!key) continue;

      // Prefer variant metadata if present
      const v = variantBy[key] || {};
      const rarity = v.rarity || it.rarity || null;
      const source = v.source || it.source || null;

      const dmgText = buildDamageText(it.dmg1, it.dmgType, it.dmg2, it.property);
      const rangeText = buildRangeText(it.range, it.property);
      const propsText = humanProps(it.property || []);

      // Lore / rules split
      const loreFromFluff = fluffBy[key] || "";
      const entriesText = joinEntries(it.entries);
      const [firstPara, ...rest] = (entriesText || "").split(/\n{2,}/g);
      const possibleLore = loreFromFluff || firstPara || "";
      const rulesText = (loreFromFluff ? entriesText : rest.join("\n\n")) || entriesText || "";
      const foundryDesc = foundryBy[key]?.desc || "";
      const rulesFull = rulesText || foundryDesc;

      byKey[key] = {
        name: it.name,
        type: it.type || null,
        rarity,
        source,
        slot: it.slot || (it.wondrous ? "Wondrous" : null) || it.armor || it.weaponCategory || null,
        cost: it.value || it.cost || null,
        weight: it.weight || null,
        reqAttune: it.reqAttune || null,
        attunementText: attuneText(it.reqAttune),
        dmg1: it.dmg1 || null,
        dmg2: it.dmg2 || null,
        dmgType: it.dmgType || null,
        range: it.range || null,
        properties: it.property || [],
        damageText: dmgText,
        rangeText,
        propertiesText: propsText,
        loreFull: possibleLore,
        loreShort: clampChars(possibleLore, 360),
        rulesFull,
        rulesShort: clampChars(rulesFull, 420),
      };
    }
  }

  return { byKey, norm };
}

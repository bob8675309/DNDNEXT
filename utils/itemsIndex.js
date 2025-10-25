// utils/itemsIndex.js
// Builds a by-name catalog and provides classification helpers.
//
// Exports:
//  - loadItemsIndex(): { byKey: { [normName]: ItemRecord }, norm }
//  - classifyUi(it): { uiType, uiSubKind, rawType }
//  - classifyType(typeString, item): legacy alias that returns uiType (for older code)
//  - TYPE_PILLS: order + icons for Admin pills
//  - titleCase(), humanRarity()
//
// Consolidated uiType buckets:
//  • Melee Weapon, Ranged Weapon, Armor, Shield, Ammunition
//  • Wondrous Item   (umbrella for worn/misc magic; NOT weapons/armor/shield)
//  • Potions & Poisons
//  • Scroll & Focus
//  • Tools           (Tool, Gaming Set, Artisan’s Tools)
//  • Instrument
//  • Rods & Wands    (RD + WD + ST)
//  • Adventuring Gear
//  • Trade Goods
//  • Vehicles & Structures (incl. AIR)
//  • Explosives
//  • Future (AF-tagged tech; hidden from “All”)

const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const stripCode = (s) => String(s || "").split("|")[0];
export const titleCase = (s = "") =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

export function humanRarity(r) {
  const raw = String(r || "").toLowerCase();
  return raw === "none" ? "Mundane" : titleCase(r || "Common");
}

/** Guess a "wondrous sub-kind" label from name/type. */
function guessWondrousSubKind(it) {
  const name = String(it.name || it.item_name || "").toLowerCase();
  const code = stripCode(it.type || it.item_type || "");
  if (code === "RG") return "Ring";

  const tests = [
    ["Boots", /\bboots?\b/],
    ["Gloves", /\b(gloves?|gauntlets?)\b/],
    ["Bracers", /\bbracers?\b/],
    ["Belt", /\bbelt\b/],
    ["Cloak", /\b(cloak|cape|mantle)\b/],
    ["Amulet", /\b(amulet|pendant|talisman|periapt)\b/],
    ["Necklace", /\bnecklace\b/],
    ["Helm", /\b(helm|helmet|hat|circlet|diadem|crown)\b/],
    ["Mask", /\bmask\b/],
    ["Goggles", /\b(goggles|lenses|eyes)\b/],
    ["Ioun Stone", /\b(ioun|ioun stone)\b/],
    ["Bag", /\b(bag of holding|bag|sack|pouch)\b/],
    ["Figurine", /\bfigurine\b/],
    ["Stone", /\bstone\b/],
    ["Wraps", /\bwraps?\b/],
    ["Girdle", /\bgirdle\b/],
  ];
  for (const [label, re] of tests) {
    if (re.test(name)) return label;
  }
  // Slot → hint
  const slot = String(it.slot || it.item_slot || "").toLowerCase();
  if (slot === "feet") return "Boots";
  if (slot === "hands") return "Gloves";
  if (slot === "waist") return "Belt";
  if (slot === "neck") return "Amulet";
  if (slot === "head") return "Helm";
  if (slot === "eyes") return "Goggles";
  if (slot === "finger") return "Ring";
  return null;
}

/** Consolidated classification */
export function classifyUi(it = {}) {
  const raw = stripCode(it.type || it.item_type || "");
  const name = String(it.name || it.item_name || "");

  // Future tech routing (AF tag on properties → only visible under "Future")
  const propsRaw = (it.property || it.properties || []).map(stripCode);
  if (propsRaw.includes("AF")) {
    return { uiType: "Future", uiSubKind: null, rawType: "AF" };
  }

  // Weapons / armor / shield / ammo
  if (raw === "M") return { uiType: "Melee Weapon", uiSubKind: null, rawType: raw };
  if (raw === "R") return { uiType: "Ranged Weapon", uiSubKind: null, rawType: raw };
  if (raw === "S") return { uiType: "Shield", uiSubKind: null, rawType: raw };
  if (raw === "A") return { uiType: "Ammunition", uiSubKind: null, rawType: raw };
  if (raw === "LA" || raw === "MA" || raw === "HA") {
    return { uiType: "Armor", uiSubKind: null, rawType: raw };
  }

  // Tools umbrella
  if (raw === "T" || raw === "GS" || raw === "AT") {
    return { uiType: "Tools", uiSubKind: null, rawType: raw };
  }

  if (raw === "INS") return { uiType: "Instrument", uiSubKind: null, rawType: raw };

  // Consumables / casting
  if (raw === "P" || raw === "IDG" || /\bpoison\b/i.test(name)) {
    return { uiType: "Potions & Poisons", uiSubKind: null, rawType: raw };
  }
  if (raw === "SC" || raw.startsWith("SC") || raw === "SCF" || /\bscroll\b/i.test(name)) {
    return { uiType: "Scroll & Focus", uiSubKind: null, rawType: raw };
  }

  // Rods/Wands + Staff
  if (raw === "RD" || raw === "WD" || raw === "ST") {
    return { uiType: "Rods & Wands", uiSubKind: null, rawType: raw };
  }

  // Gear
  if (raw === "G") return { uiType: "Adventuring Gear", uiSubKind: null, rawType: raw };

  // Trade goods (TG/TB or any "$" code)
  if (raw === "TG" || raw === "TB" || raw.startsWith("$")) {
    return { uiType: "Trade Goods", uiSubKind: null, rawType: raw };
  }

  // Vehicles / structures (include AIR)
  if (raw === "VEH" || raw === "SHP" || raw === "SPC" || raw === "AIR") {
    return { uiType: "Vehicles & Structures", uiSubKind: null, rawType: raw };
  }

  // Explosives (keep a distinct bucket and pill)
  if (raw === "EXP") {
    return { uiType: "Explosives", uiSubKind: null, rawType: raw };
  }

  // Wondrous umbrella (explicit W/RG, Other, or common worn/misc names)
  if (raw === "W" || raw === "RG" || raw === "OTH" || raw === "Oth" || raw === "Other") {
    return { uiType: "Wondrous Item", uiSubKind: guessWondrousSubKind(it), rawType: raw };
  }
  if (/\b(boots?|gloves?|gauntlets?|bracers?|belt|cloak|cape|mantle|amulet|pendant|talisman|periapt|necklace|helm|helmet|hat|circlet|diadem|crown|mask|goggles|lenses|eyes|ioun|bag|pouch|sack|figurine|stone|wraps?|girdle)\b/i.test(name)) {
    return { uiType: "Wondrous Item", uiSubKind: guessWondrousSubKind(it), rawType: raw };
  }

  // Unknown / leave raw in the dropdown for manual sorting later
  return { uiType: null, uiSubKind: null, rawType: raw || "Other" };
}

/** Legacy alias kept for older code paths:
 *  classifyType(typeString, item) -> returns uiType string
 */
export function classifyType(typeString, item = {}) {
  const { uiType } = classifyUi({ ...item, type: typeString || item.type || item.item_type });
  return uiType || null;
}

/** Pills for Admin */
export const TYPE_PILLS = [
  { key: "All", icon: "✨" },
  { key: "Future", icon: "🛸" },
  { key: "Melee Weapon", icon: "⚔️" },
  { key: "Ranged Weapon", icon: "🏹" },
  { key: "Armor", icon: "🛡️" },
  { key: "Shield", icon: "🛡" },
  { key: "Ammunition", icon: "🎯" },
  { key: "Wondrous Item", icon: "🪄" },
  { key: "Potions & Poisons", icon: "🧪" },
  { key: "Scroll & Focus", icon: "📜" },
  { key: "Tools", icon: "🛠️" },
  { key: "Instrument", icon: "🎻" },
  { key: "Rods & Wands", icon: "✨" },
  { key: "Trade Goods", icon: "💰" },
  { key: "Vehicles & Structures", icon: "🚢" },
  { key: "Explosives", icon: "💥" },
  { key: "Adventuring Gear", icon: "🎒" },
];

// ---------- optional text helpers used when we enrich records ----------
const DMG = { P:"piercing", S:"slashing", B:"bludgeoning", R:"radiant", N:"necrotic", F:"fire", C:"cold", L:"lightning", A:"acid", T:"thunder", Psn:"poison", Psy:"psychic", Frc:"force" };
const PROP = { L:"Light", F:"Finesse", H:"Heavy", R:"Reach", T:"Thrown", V:"Versatile", "2H":"Two-Handed", A:"Ammunition", LD:"Loading", S:"Special", RLD:"Reload" };
const asText = (x) => Array.isArray(x) ? x.map(asText).join("\n\n") : (x?.entries ? asText(x.entries) : String(x || ""));
const joinEntries = (e) => Array.isArray(e) ? e.map(asText).filter(Boolean).join("\n\n") : asText(e);
const propsText = (props = []) => props.map((p) => PROP[p] || p).join(", ");

function synthFlavor(it, uiType) {
  const name = it.name || it.item_name || "This item";
  const rareLower = String(it.rarity || it.item_rarity || "Common").toLowerCase();
  // Small, non-repeating fallbacks if all else fails
  if (uiType === "Melee Weapon" || uiType === "Ranged Weapon") {
    return `${name} shows honest craft: clean edge, firm wrap, and the weight of work well done.`;
  }
  if (uiType === "Armor" || uiType === "Shield") {
    return `${name} bears scuffs and careful repair, fittings polished by hands and years.`;
  }
  return `${name} looks authentic and ready for use.`;
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

/** Load a prebuilt catalog if present; otherwise merge and enrich */
export async function loadItemsIndex() {
  // Flavor overrides (support both filenames used across deploys)
  const overrides =
    (await safeJson("/items/flavor-overrides.json")) ||
    (await safeJson("/items/flavor-overrides.finished.json")) ||
    { items: {} };

  const oMap = new Map(Object.entries(overrides.items || {}).map(([k,v]) => [norm(k), v]));

  // Main merged dataset
  const merged =
    (await safeJson("/items/all-items.json")) ||
    []; // tolerate empty in early deploys

  const byKey = {};
  if (Array.isArray(merged) && merged.length) {
    for (const it of merged) {
      const k = norm(it.name || it.item_name);
      if (!k) continue;

      const { uiType, uiSubKind } = classifyUi(it);
      const p = (it.property || it.properties || []).map(stripCode).filter((x)=>x!=="AF");

      // MUNDANE vs MAGIC: only use entries as flavor for mundane items.
      const isMundane = String(it.rarity || it.item_rarity || "").toLowerCase() === "none";
      const entriesText = joinEntries(it.entries);
      let flavor =
        it.flavor ||
        (isMundane ? entriesText : "") ||
        synthFlavor(it, uiType);
      const o = oMap.get(k); if (o && o.flavor) flavor = o.flavor;

      const enriched = {
        ...it,
        flavor,
        item_description: entriesText, // rules text if present
        uiType,
        uiSubKind,
        damageText: (it.damageText || (it.dmg1 ? `${it.dmg1} ${DMG[it.dmgType] || it.dmgType || ""}`.trim() : "")) + (p.includes("V") && it.dmg2 ? `; versatile (${it.dmg2})` : ""),
        rangeText: (it.range ? String(it.range).replace(/ft\.?$/i, "").trim() : ""),
        propertiesText: propsText(p),
      };
      byKey[k] = enriched;
    }
  }

  return { byKey, norm };
}

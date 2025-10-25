// utils/itemsIndex.js
// Builds a by-name catalog and provides classification helpers.
//
// Exports (BC-safe):
//  - loadItemsIndex(): { byKey: { [normName]: ItemRecord }, norm }
//  - classifyUi(it): { uiType, uiSubKind, rawType }
//  - classifyType(typeString, item): string   <-- legacy alias around classifyUi
//  - TYPE_PILLS, titleCase(), humanRarity()

const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const stripCode = (s) => String(s || "").split("|")[0];

export const titleCase = (s = "") =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

export function humanRarity(r) {
  const raw = String(r || "").toLowerCase();
  return raw === "none" ? "Mundane" : titleCase(r || "Common");
}

/** Try to guess a subkind label for Wondrous items */
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
  for (const [label, re] of tests) if (re.test(name)) return label;

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

  const propsRaw = (it.property || it.properties || []).map(stripCode);
  if (propsRaw.includes("AF")) return { uiType: "Future", uiSubKind: null, rawType: "AF" };

  if (raw === "M") return { uiType: "Melee Weapon", uiSubKind: null, rawType: raw };
  if (raw === "R") return { uiType: "Ranged Weapon", uiSubKind: null, rawType: raw };
  if (raw === "S") return { uiType: "Shield", uiSubKind: null, rawType: raw };
  if (raw === "A") return { uiType: "Ammunition", uiSubKind: null, rawType: raw };
  if (raw === "LA" || raw === "MA" || raw === "HA") return { uiType: "Armor", uiSubKind: null, rawType: raw };

  if (raw === "T" || raw === "GS" || raw === "AT") return { uiType: "Tools", uiSubKind: null, rawType: raw };
  if (raw === "INS") return { uiType: "Instrument", uiSubKind: null, rawType: raw };

  if (raw === "P" || raw === "IDG" || /\bpoison\b/i.test(name)) return { uiType: "Potions & Poisons", uiSubKind: null, rawType: raw };
  if (raw === "SC" || raw.startsWith("SC") || raw === "SCF" || /\bscroll\b/i.test(name)) return { uiType: "Scroll & Focus", uiSubKind: null, rawType: raw };

  if (raw === "RD" || raw === "WD" || raw === "ST") return { uiType: "Rods & Wands", uiSubKind: null, rawType: raw };

  if (raw === "G") return { uiType: "Adventuring Gear", uiSubKind: null, rawType: raw };
  if (raw === "TG" || raw === "TB" || raw.startsWith("$")) return { uiType: "Trade Goods", uiSubKind: null, rawType: raw };

  if (raw === "VEH" || raw === "SHP" || raw === "SPC" || raw === "AIR") return { uiType: "Vehicles & Structures", uiSubKind: null, rawType: raw };
  if (raw === "EXP") return { uiType: "Explosives", uiSubKind: null, rawType: raw };

  if (raw === "W" || raw === "RG" || raw === "OTH" || raw === "Oth" || raw === "Other") {
    return { uiType: "Wondrous Item", uiSubKind: guessWondrousSubKind(it), rawType: raw };
  }
  if (/\b(boots?|gloves?|gauntlets?|bracers?|belt|cloak|cape|mantle|amulet|pendant|talisman|periapt|necklace|helm|helmet|hat|circlet|diadem|crown|mask|goggles|lenses|eyes|ioun|bag|pouch|sack|figurine|stone|wraps?|girdle)\b/i.test(name)) {
    return { uiType: "Wondrous Item", uiSubKind: guessWondrousSubKind(it), rawType: raw || "Other" };
  }

  return { uiType: null, uiSubKind: null, rawType: raw || "Other" };
}

/** Legacy alias kept for old imports: classifyType(typeString, item) → uiType */
export function classifyType(_typeString, item = {}) {
  return classifyUi(item).uiType || "Other";
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

// ---------- text helpers used during enrichment ----------
const DMG = { P:"piercing", S:"slashing", B:"bludgeoning", R:"radiant", N:"necrotic", F:"fire", C:"cold", L:"lightning", A:"acid", T:"thunder", Psn:"poison", Psy:"psychic", Frc:"force" };
const PROP = { L:"Light", F:"Finesse", H:"Heavy", R:"Reach", T:"Thrown", V:"Versatile", "2H":"Two-Handed", A:"Ammunition", LD:"Loading", S:"Special", RLD:"Reload" };
const asText = (x) => Array.isArray(x) ? x.map(asText).join("\n\n") : (x?.entries ? asText(x.entries) : String(x || ""));
const joinEntries = (e) => Array.isArray(e) ? e.map(asText).filter(Boolean).join("\n\n") : asText(e);
const propsText = (props = []) => props.map((p) => PROP[p] || p).join(", ");

async function safeJson(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/** Load a prebuilt catalog if present; otherwise merge and enrich.
 *  Also tolerates both filenames for overrides used across your deploys. */
export async function loadItemsIndex() {
  // tolerate either filename to eliminate 404s across deploys
  const overrides =
    (await safeJson("/items/flavor-overrides.json")) ||
    (await safeJson("/items/flavor-overrides.finished.json")) ||
    { items: {} };

  const oMap = new Map(Object.entries(overrides.items || {}).map(([k, v]) => [norm(k), v]));
  const merged = await safeJson("/items/all-items.json");

  const byKey = {};
  if (Array.isArray(merged) && merged.length) {
    for (const it of merged) {
      const k = norm(it.name || it.item_name);
      if (!k) continue;

      const { uiType, uiSubKind } = classifyUi(it);
      const p = (it.property || it.properties || []).map(stripCode).filter((x) => x !== "AF");

      const isMundane = String(it.rarity || it.item_rarity || "").toLowerCase() === "none";
      const entriesText = joinEntries(it.entries);
      let flavor =
        it.flavor ||
        (isMundane ? entriesText : "") ||
        // tiny tasteful fallback
        (() => {
          const name = it.name || it.item_name || "This item";
          if (uiType === "Melee Weapon" || uiType === "Ranged Weapon") {
            return `${name} shows honest craft: clean edge, firm wrap, and the weight of work well done.`;
          }
          if (uiType === "Armor" || uiType === "Shield") {
            return `${name} bears scuffs and careful repair, fittings polished by hands and years.`;
          }
          return `${name} looks authentic and ready for use.`;
        })();

      const o = oMap.get(k);
      if (o?.flavor) flavor = o.flavor;

      byKey[k] = {
        ...it,
        flavor,
        item_description: entriesText, // rules text if present
        uiType,
        uiSubKind,
        damageText:
          (it.damageText ||
            (it.dmg1 ? `${it.dmg1} ${DMG[it.dmgType] || it.dmgType || ""}`.trim() : "")) +
          (p.includes("V") && it.dmg2 ? `; versatile (${it.dmg2})` : ""),
        rangeText: (it.range ? String(it.range).replace(/ft\.?$/i, "").trim() : ""),
        propertiesText: propsText(p),
      };
    }
  }

  return { byKey, norm };
}

// utils/itemsIndex.js
// Builds a by-name catalog and provides classification helpers.
//
// Exports:
//  - loadItemsIndex(): { byKey: { [normName]: ItemRecord }, norm }
//  - classifyUi(it): { uiType, uiSubKind, rawType }
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
//  • Trade Goods     (TG, TB, and ANY type that starts with "$")
//  • Vehicles & Structures (VEH, SHP, SPC, AIR)
//  • Explosives      (EXP)
//  • (unmapped types remain raw for the dropdown)

const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const stripCode = (s) => String(s || "").split("|")[0]; // "LA|XPHB" -> "LA"

export function titleCase(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}

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
  for (const [label, re] of tests) if (re.test(name)) return label;
  return null;
}

/** Consolidate a raw type into a uiType bucket and optional sub-kind (for Wondrous). */
export function classifyUi(it = {}) {
  const raw = stripCode(it.type || it.item_type || "");
  const name = String(it.name || it.item_name || "");

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
  if (/\b(boots?|gloves?|gauntlets?|bracers?|belt|cloak|cape|mantle|amulet|pendant|talisman|periapt|necklace|helm|helmet|hat|circlet|diadem|crown|mask|goggles|lenses|ioun)\b/i.test(name)) {
    return { uiType: "Wondrous Item", uiSubKind: guessWondrousSubKind(it), rawType: raw };
  }

  // Unknown / leave raw in the dropdown for manual sorting later
  return { uiType: null, uiSubKind: null, rawType: raw || "Other" };
}

/** Pills for Admin */
export const TYPE_PILLS = [
  { key: "All", icon: "✨" },
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

function buildDamageText(d1, dt, d2, props) {
  const base = d1 ? `${d1} ${DMG[dt] || dt || ""}`.trim() : "";
  const vers = (props || []).includes("V") && d2 ? `versatile (${d2})` : "";
  return [base, vers].filter(Boolean).join("; ");
}
function buildRangeText(range, props) {
  const r = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if ((props || []).includes("T")) return r ? `Thrown ${r} ft.` : "Thrown";
  return r ? `${r} ft.` : "";
}
function propsText(props = []) {
  return props.map((p) => PROP[stripCode(p)] || stripCode(p)).join(", ");
}

// Sensory flavor if none exists (keeps the top-left box meaningful)
function synthFlavor(it, uiType) {
  const name = it.name || it.item_name || "This item";
  const rare = String(it.rarity || it.item_rarity || "Common");
  const rLower = rare.toLowerCase();

  if (uiType === "Melee Weapon" || uiType === "Ranged Weapon") {
    return `${name} is a ${rLower} ${uiType.toLowerCase()} with balanced heft and the clean smell of oiled steel.`;
  }
  if (uiType === "Armor") {
    return `${name} is a ${rLower} suit of armor—scuffed where it has seen use, with the faint scent of leather and metal polish.`;
  }
  if (uiType === "Shield") {
    return `${name} bears worn paint and the dings of many blocks, the grain smooth under the hand.`;
  }
  if (uiType === "Wondrous Item") {
    return `${name} carries a muted aura—cool to the touch, with a whisper of old magic when handled.`;
  }
  if (uiType === "Potions & Poisons") {
    return `${name} swirls with a telltale hue and scent, its contents clinging to the glass.`;
  }
  if (uiType === "Scroll & Focus") {
    return `${name} brims with etched sigils and the faint crackle of lingering spellwork.`;
  }
  if (uiType === "Tools") {
    return `${name} is well-made and practical—worn edges, neat fittings, and a craftsman’s weight.`;
  }
  if (uiType === "Adventuring Gear") {
    return `${name} is rugged kit for the road—sturdy straps, scuffed buckles, and travel-stained cloth.`;
  }
  if (uiType === "Trade Goods") {
    return `${name} is a merchant’s staple—wrapped, weighed, and ready for barter.`;
  }
  if (uiType === "Instrument") {
    return `${name} is polished and responsive, resonant wood humming at a light touch.`;
  }
  if (uiType === "Explosives") {
    return `${name} smells faintly of sulfur and oil, its weight promising a sudden report.`;
  }
  if (uiType === "Vehicles & Structures") {
    return `${name} is all timber, canvas, and ironwork—built to weather distance and strain.`;
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

/** Load a prebuilt catalog if present; otherwise merge source JSONs and add uiType/uiSubKind. */
export async function loadItemsIndex() {
  const merged = await safeJson("/items/all-items.json");

  const byKey = {};
  if (Array.isArray(merged) && merged.length) {
    for (const it of merged) {
      const k = norm(it.name || it.item_name);
      if (!k) continue;

      const { uiType, uiSubKind } = classifyUi(it);
      const p = it.property || it.properties || [];

      // Prefer existing flavor/entries; only synthesize if truly empty
      const entriesText =
        Array.isArray(it.entries) ? asText(it.entries)
        : (typeof it.entries === "string" ? it.entries : "");
      const flavor = (it.flavor && String(it.flavor).trim())
        ? it.flavor
        : (entriesText && String(entriesText).trim())
          ? entriesText
          : synthFlavor(it, uiType);

      byKey[k] = {
        ...it,
        uiType,
        uiSubKind,
        flavor,
        damageText: it.damageText || buildDamageText(it.dmg1, it.dmgType, it.dmg2, p),
        rangeText: it.rangeText || buildRangeText(it.range, p),
        // Keep propertiesText clean here; ItemCard appends Mastery visually to avoid duplicates
        propertiesText: it.propertiesText || propsText(p),
      };
    }
    return { byKey, norm };
  }

  // Fallback: stitch from individual files (lightweight)
  const [base, fluff] = await Promise.all([
    safeJson("/items/items-base.json"),
    safeJson("/items/fluff-items.json"),
  ]);

  const fluffBy = {};
  if (Array.isArray(fluff)) {
    for (const f of fluff) {
      const k = norm(f.name);
      const lore = joinEntries(f.entries);
      if (k && lore) fluffBy[k] = lore;
    }
  }

  if (Array.isArray(base)) {
    for (const it of base) {
      const k = norm(it.name);
      if (!k) continue;

      const { uiType, uiSubKind } = classifyUi(it);
      const p = it.property || [];
      const entriesText = joinEntries(it.entries);
      const flavor = (fluffBy[k] && String(fluffBy[k]).trim())
        ? fluffBy[k]
        : (entriesText && String(entriesText).trim())
          ? entriesText
          : synthFlavor(it, uiType);

      const enriched = {
        ...it,
        flavor,
        item_description: entriesText, // rules text if present
        uiType,
        uiSubKind,
        damageText: buildDamageText(it.dmg1, it.dmgType, it.dmg2, p),
        rangeText: buildRangeText(it.range, p),
        propertiesText: propsText(p),
      };
      byKey[k] = enriched;
    }
  }

  return { byKey, norm };
}

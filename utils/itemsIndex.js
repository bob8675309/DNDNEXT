// utils/itemsIndex.js
// Builds a by-name catalog and provides classification helpers.
//
// Exports:
//  - loadItemsIndex(): { byKey: { [normName]: ItemRecord }, norm }
//  - classifyUi(it): { uiType, uiSubKind, rawType }
//
// Consolidated uiType buckets:
//  • Melee Weapon, Ranged Weapon, Armor, Shield, Ammunition
//  • Wondrous Item   (umbrella for worn/misc magic; NOT weapons/armor/shield)
//  • Potion, Scroll, Spellcasting Focus
//  • Tools           (Tool, Gaming Set, Artisan’s Tools)
//  • Instrument
//  • Rods & Wands    (RD + WD)
//  • Staff
//  • Adventuring Gear
//  • Trade Goods     (TG, TB, and ANY type that starts with "$")
//  • Vehicles & Structures (VEH, SHP, SPC)
//  • (unmapped types remain raw for the dropdown)

const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const stripCode = (s) => String(s || "").split("|")[0]; // "LA|XPHB" -> "LA"

/** Guess a "wondrous sub-kind" label from name/type. */
function guessWondrousSubKind(it) {
  const name = String(it.name || it.item_name || "").toLowerCase();
  const code = stripCode(it.type || it.item_type || "");

  if (code === "RG") return "Ring"; // explicit type

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
  if (raw === "P") return { uiType: "Potion", uiSubKind: null, rawType: raw };
  if (raw === "SC" || raw.startsWith("SC") || /\bscroll\b/i.test(name)) {
    return { uiType: "Scroll", uiSubKind: null, rawType: raw };
  }
  if (raw === "SCF") return { uiType: "Spellcasting Focus", uiSubKind: null, rawType: raw };

  // Rods/Wands + Staff
  if (raw === "RD" || raw === "WD") return { uiType: "Rods & Wands", uiSubKind: null, rawType: raw };
  if (raw === "ST") return { uiType: "Staff", uiSubKind: null, rawType: raw };

  // Gear
  if (raw === "G") return { uiType: "Adventuring Gear", uiSubKind: null, rawType: raw };

  // Trade goods (TG/TB or any "$" code)
  if (raw === "TG" || raw === "TB" || raw.startsWith("$")) {
    return { uiType: "Trade Goods", uiSubKind: null, rawType: raw };
  }

  // Vehicles / structures
  if (raw === "VEH" || raw === "SHP" || raw === "SPC") {
    return { uiType: "Vehicles & Structures", uiSubKind: null, rawType: raw };
  }

  // Wondrous umbrella (explicit "W" or typical worn/misc names)
  if (raw === "W" || raw === "RG") {
    return { uiType: "Wondrous Item", uiSubKind: guessWondrousSubKind(it), rawType: raw };
  }
  // If name strongly suggests worn/misc magic, treat as Wondrous as well.
  if (/\b(boots?|gloves?|gauntlets?|bracers?|belt|cloak|cape|mantle|amulet|pendant|talisman|periapt|necklace|helm|helmet|hat|circlet|diadem|crown|mask|goggles|lenses|ioun)\b/i.test(name)) {
    return { uiType: "Wondrous Item", uiSubKind: guessWondrousSubKind(it), rawType: raw };
  }

  // Unknown / leave raw in the dropdown for manual sorting later
  return { uiType: null, uiSubKind: null, rawType: raw || "Other" };
}

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

      // Ensure uiType/uiSubKind present even if the file didn’t contain them.
      const { uiType, uiSubKind } = classifyUi(it);
      const p = it.property || it.properties || [];
      byKey[k] = {
        ...it,
        uiType,
        uiSubKind,
        damageText: it.damageText || buildDamageText(it.dmg1, it.dmgType, it.dmg2, p),
        rangeText: it.rangeText || buildRangeText(it.range, p),
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

  if (Array.isArray(base)) {
    for (const it of base) {
      const k = norm(it.name);
      if (!k) continue;
      const { uiType, uiSubKind } = classifyUi(it);
      const p = it.property || [];
      const entriesText = joinEntries(it.entries);
      const enriched = {
        ...it,
        item_description: entriesText,
        uiType,
        uiSubKind,
        damageText: buildDamageText(it.dmg1, it.dmgType, it.dmg2, p),
        rangeText: buildRangeText(it.range, p),
        propertiesText: propsText(p),
      };
      byKey[k] = enriched;
    }
  }

  // Add fluff text if present
  if (Array.isArray(fluff)) {
    for (const f of fluff) {
      const k = norm(f.name);
      const lore = joinEntries(f.entries);
      if (byKey[k] && lore) {
        byKey[k].flavor = lore;
      }
    }
  }

  return { byKey, norm };
}

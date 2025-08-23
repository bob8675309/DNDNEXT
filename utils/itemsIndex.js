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

/* ---------- Bespoke FLAVOR for common mundane items (weapons/armor/ammo) ---------- */
const FLAVOR_OVERRIDES = [
  // Simple weapons
  [/^Club\b/i, n => `${n} is a length of hard wood with a weighted head, the handle sweat-dark and nicked.`],
  [/^Dagger\b/i, n => `${n} sits light and eager in the palm; a narrow blade flashes quick, leather wrap smelling of oil.`],
  [/^Greatclub\b/i, n => `${n} is a knotted staff heavy at one end—simple, rude, and brutal.`],
  [/^Handaxe\b/i, n => `${n} is a broad wedge of iron on a short haft; the bearded edge bites deep.`],
  [/^Javelin\b/i, n => `${n} is a slender ash shaft with a leaf head; the balance begs for a long cast.`],
  [/^Light Hammer\b/i, n => `${n} throws true—compact head, square face, and a leather thong about the grip.`],
  [/^Mace\b/i, n => `${n} carries iron flanges hammered smooth by use, the haft dark with sweat.`],
  [/^Quarterstaff\b/i, n => `${n} is seasoned wood, palm-smooth along its length and tough as old root.`],
  [/^Sickle\b/i, n => `${n} bears a crescent reaping blade; a farmer’s tool that drinks red when needed.`],
  [/^Spear\b/i, n => `${n} is a leaf-bladed spear, straight-grained and keen along the edges.`],
  [/^Light Crossbow\b/i, n => `${n} has an oiled stock and crisp bowstring; the latch snaps with a tidy click.`],
  [/^Dart\b/i, n => `${n} is a short, weighted dart with fletching that whispers when thrown.`],
  [/^Shortbow\b/i, n => `${n} bends smooth and easy; hickory limbs and a taut, singing string.`],
  [/^Sling\b/i, n => `${n} has a braided leather cradle and cord that hums when it whips.`],

  // Martial weapons
  [/^Battleaxe\b/i, n => `${n} is all business: a handspan of iron on a stout ash haft, a crescent that bites and a bearded heel that hooks. The edge shows a hundred small repairs—bright hone lines against darker steel.`],
  [/^Flail\b/i, n => `${n} rattles softly—chain and spiked weight eager to leap.`],
  [/^Glaive\b/i, n => `${n} reaches far: a long pole topped by a curved cleaver’s blade.`],
  [/^Greataxe\b/i, n => `${n} is a two-handed wedge of cruel iron; every stroke wants to hew.`],
  [/^Greatsword\b/i, n => `${n} carries a grave weight—long fuller, clean lines, and a steady promise.`],
  [/^Halberd\b/i, n => `${n} wears an axe-blade, hook, and spike; a soldier’s answer to anything on two legs.`],
  [/^Lance\b/i, n => `${n} is ash and pennon, built to shatter on the charge.`],
  [/^Longsword\b/i, n => `${n} sits with a calm balance—honest polish, tight wrap, and a sure guard.`],
  [/^Maul\b/i, n => `${n} is a quarryman’s nightmare—twin-faced iron meant to break more than bones.`],
  [/^Morningstar\b/i, n => `${n} bristles with studs; the head chews through mail and worse.`],
  [/^Pike\b/i, n => `${n} is twelve feet of argument ending in cold iron.`],
  [/^Rapier\b/i, n => `${n} is a narrow thrusting blade with a swept hilt; quick, cold, and precise.`],
  [/^Scimitar\b/i, n => `${n} bears a gentle curve—saber-bright along its belly.`],
  [/^Shortsword\b/i, n => `${n} is a soldier’s friend—stout, point-hungry, and quick from the sheath.`],
  [/^Trident\b/i, n => `${n} ends in three cruel tines, a fisher’s tool taught wicked manners.`],
  [/^War Pick\b/i, n => `${n} is all beak and bite, meant for iron and skull alike.`],
  [/^Warhammer\b/i, n => `${n} packs a compact head and a will to ruin plate.`],
  [/^Whip\b/i, n => `${n} is a braided lash that cracks like thunder.`],

  // Armor
  [/^Padded\b/i, n => `${n} is a quilted gambeson—soft, sweat-salted, and creaking at the seams.`],
  [/^Leather\b/i, n => `${n} is a cured leather jerkin, supple and quiet under a cloak.`],
  [/^Studded Leather\b/i, n => `${n} shows a scatter of rivets, leather stitched tight over small plates.`],
  [/^Hide\b/i, n => `${n} is rough stitchwork of fur and cured skins, thick with smoke and oil.`],
  [/^Chain Shirt\b/i, n => `${n} is a shirt of interlocking rings that chime softly when moved.`],
  [/^Scale Mail\b/i, n => `${n} glitters with overlapping scales that rasp where they rub.`],
  [/^Breastplate\b/i, n => `${n} is a fitted chest piece over padding; bright where polished, dark where use has dulled it.`],
  [/^Half Plate\b/i, n => `${n} is plates over mail—straps creak, buckles shine, and it moves with surprising grace.`],
  [/^Ring Mail\b/i, n => `${n} is leather studded with rings; heavier than it looks, louder than you’d like.`],
  [/^Chain Mail\b/i, n => `${n} is armor of many rings with coif and chausses; it sighs like rain when lifted.`],
  [/^Splint\b/i, n => `${n} is bands of steel riveted to backing, clacking softly when you walk.`],
  [/^Plate\b/i, n => `${n} is a full harness with steel like a church bell—straps creak and the visor whispers down.`],
  [/^Shield\b/i, n => `${n} bears gouges and guard paint worn smooth from blocks taken square.`],

  // Ammunition
  [/^Arrows?\b/i, n => `${n} are straight-shafted with goose fletching; they smell of pitch and feathers.`],
  [/^Bolts?\b/i, n => `${n} are squat and heavy, their square heads made to punch.`],
  [/^Bullets?\b/i, n => `${n} are smooth pebbles and lead shot that sit snug in a sling’s cradle.`],
];

/** Sensory flavor if none exists (keeps the top-left box meaningful) */
function synthFlavor(it, uiType) {
  const name = it.name || it.item_name || "This item";
  const rareLower = String(it.rarity || it.item_rarity || "Common").toLowerCase();

  // Try bespoke overrides first
  for (const [re, make] of FLAVOR_OVERRIDES) {
    if (re.test(name)) return make(name);
  }

  if (uiType === "Melee Weapon" || uiType === "Ranged Weapon") {
    return `${name} is a ${rareLower} ${uiType.toLowerCase()} with balanced heft and the clean smell of oiled steel.`;
  }
  if (uiType === "Armor") {
    return `${name} is a ${rareLower} suit of armor—scuffed where it has seen use, with the faint scent of leather and metal polish.`;
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

      // MUNDANE vs MAGIC: only use entries as flavor for mundane items.
      const isMundane = String(it.rarity || it.item_rarity || "").toLowerCase() === "none";

      const entriesText =
        Array.isArray(it.entries) ? asText(it.entries)
        : (typeof it.entries === "string" ? it.entries : "");

      const existingFlavor = (it.flavor && String(it.flavor).trim()) ? String(it.flavor).trim() : "";

      const flavor = existingFlavor
        ? existingFlavor
        : (isMundane && entriesText && String(entriesText).trim())
          ? String(entriesText).trim()
          : synthFlavor(it, uiType);

      byKey[k] = {
        ...it,
        uiType,
        uiSubKind,
        flavor,
        damageText: it.damageText || buildDamageText(it.dmg1, it.dmgType, it.dmg2, p),
        rangeText: it.rangeText || buildRangeText(it.range, p),
        // Keep propertiesText clean here; ItemCard appends Mastery visually
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
      const isMundane = String(it.rarity || "").toLowerCase() === "none";

      const flavor =
        (fluffBy[k] && String(fluffBy[k]).trim())
          ? String(fluffBy[k]).trim()
          : (isMundane && entriesText && String(entriesText).trim())
            ? String(entriesText).trim()
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

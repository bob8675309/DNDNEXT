// utils/it// /utils/itemsIndex.js
// Builds a by-name catalog from your JSON sources and returns helpers
//
// Returned shape: { byKey: { [normName]: ItemRecord }, norm, classifyType }
//
// ItemRecord fields (at least):
//   name, type, rarity, source, slot, cost, weight
//   reqAttune, attunementText
//   dmg1, dmg2, dmgType, range, properties (array of codes)
//   damageText, rangeText, propertiesText
//   loreShort, loreFull, rulesShort, rulesFull

export const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();

const DMG = { P: "piercing", S: "slashing", B: "bludgeoning", R: "radiant", N: "necrotic", F: "fire", C: "cold", L: "lightning", A: "acid", T: "thunder", Psn: "poison", Psy: "psychic", Frc: "force" };
const PROP = { L: "Light", F: "Finesse", H: "Heavy", R: "Reach", T: "Thrown", V: "Versatile", "2H": "Two-Handed", A: "Ammunition", LD: "Loading", S: "Special", RLD: "Reload" };

function asText(x) {
  if (!x) return "";
  if (Array.isArray(x)) return x.map(asText).join("\n\n");
  if (typeof x === "object" && x.entries) return asText(x.entries);
  return String(x);
}
function joinEntries(e) {
  if (!e) return "";
  return Array.isArray(e) ? e.map(asText).filter(Boolean).join("\n\n") : asText(e);
}
function clampChars(s, max = 360) {
  if (!s) return "";
  const clean = s.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}
function buildDamageText(d1, dt, d2, props) {
  const dtName = DMG[dt] || dt || "";
  const base = d1 ? `${d1} ${dtName}`.trim() : "";
  const versatile = Array.isArray(props) && props.includes("V") && d2 ? `versatile (${d2})` : "";
  return [base, versatile].filter(Boolean).join("; ");
}
function buildRangeText(range, props) {
  if (!range && !(Array.isArray(props) && props.includes("T"))) return "";
  const r = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if (Array.isArray(props) && props.includes("T")) return r ? `Thrown ${r} ft.` : "Thrown";
  return r ? `${r} ft.` : "";
}
function humanProps(props = []) { return props.map((p) => PROP[p] || p).join(", "); }
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
  } catch { return null; }
}

// ---- Curated UI type classifier (NO weapons/armor/shields under Wondrous) ----
export function classifyType(rawType, it = {}) {
  const t = String(rawType ?? it.type ?? it.item_type ?? "").toUpperCase();
  const name = String(it.name ?? it.item_name ?? "").toLowerCase();

  // Consolidations
  if (t.startsWith("$") || t === "TG" || t === "TB") return "Trade Goods";
  if (t === "RD" || t === "WD") return "Rods & Wands";
  if (t === "AT" || t === "GS" || t === "T") return "Tools";
  if (t === "SHP" || t === "VEH" || t === "SPC") return "Ships/Vehicles";

  // Explicit gear
  if (t === "R") return "Ranged Weapon";
  if (t === "M") return "Melee Weapon";
  if (t === "LA" || t === "MA" || t === "HA") return "Armor";
  if (t === "S") return "Shield";
  if (t === "A") return "Ammunition";
  if (t === "INS") return "Instrument";
  if (t === "P") return "Potion";
  if (t === "SC") return "Scroll";
  if (t === "ST") return "Staff";

  // Heuristics if type missing/odd
  if (hasWeaponStats(it)) return isRanged(it) ? "Ranged Weapon" : "Melee Weapon";
  if (looksLikeArmor(it)) return "Armor";
  if (name.includes("shield")) return "Shield";

  // Wondrous umbrella (worn/held magic that is NOT a weapon/armor/shield)
  if (t === "W" || t === "RG" || t === "SCF") return "Wondrous Item";
  if ((it.slot || it.reqAttune || it.wondrous) && !hasWeaponStats(it) && !looksLikeArmor(it) && !name.includes("shield")) {
    return "Wondrous Item";
  }
  return "Other";
}
function hasWeaponStats(it = {}) {
  if (it.dmg1 || it.dmg2 || it.dmgType) return true;
  if (Array.isArray(it.property) && it.property.length) return true;
  if (it.weaponCategory) return true;
  return false;
}
function isRanged(it = {}) {
  const t = String(it.type ?? it.item_type ?? "").toUpperCase();
  if (t === "R") return true;
  if (typeof it.range === "string" && /\d/.test(it.range)) return true;
  if (Array.isArray(it.property) && it.property.includes("A")) return true;
  return false;
}
function looksLikeArmor(it = {}) {
  const t = String(it.type ?? it.item_type ?? "").toUpperCase();
  if (t === "LA" || t === "MA" || t === "HA") return true;
  if (it.ac || it.armor) return true;
  const nm = String(it.name ?? it.item_name ?? "").toLowerCase();
  return /\b(chain|scale|splint|plate|mail|leather|armor|breastplate|brigandine)\b/.test(nm);
}

// ---- Loader: prefer merged catalog; else merge 4 sources on the fly ----
export async function loadItemsIndex() {
  // 1) Prefer the merged file if present
  const merged = await safeJson("/items/all-items.json");
  let byKey = {};
  if (Array.isArray(merged) && merged.length) {
    for (const it of merged) {
      const key = norm(it.name || it.item_name);
      if (!key) continue;
      const props = it.property || it.properties || [];
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
        properties: props,
        damageText: buildDamageText(it.dmg1, it.dmgType, it.dmg2, props),
        rangeText: buildRangeText(it.range, props),
        propertiesText: humanProps(props),
        loreFull: it.loreFull || it.lore || "",
        loreShort: it.loreShort || clampChars(it.loreFull || it.lore || "", 360),
        rulesFull: it.rulesFull || it.description || joinEntries(it.entries) || "",
        rulesShort: clampChars(it.rulesFull || it.description || joinEntries(it.entries) || "", 420),
      };
    }
    return { byKey, norm, classifyType };
  }

  // 2) Fallback: merge the separate sources client-side
  const [base, fluff, foundry] = await Promise.all([
    safeJson("/items/items-base.json"),
    safeJson("/items/fluff-items.json"),
    safeJson("/items/foundry-items.json"),
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
      if (desc) foundryBy[k] = desc;
    }
  }

  if (Array.isArray(base)) {
    for (const it of base) {
      const key = norm(it.name);
      if (!key) continue;
      const props = it.property || [];
      const entriesText = joinEntries(it.entries);
      const [firstPara, ...rest] = (entriesText || "").split(/\n{2,}/g);

      const lore = fluffBy[key] || firstPara || "";
      const rules = (fluffBy[key] ? entriesText : rest.join("\n\n")) || entriesText || "";
      const foundryDesc = foundryBy[key] || "";

      byKey[key] = {
        name: it.name,
        type: it.type || null,
        rarity: it.rarity || null,
        source: it.source || null,
        slot: it.slot || it.wondrous ? it.wondrous : it.armor ? it.armor : it.weaponCategory || null,
        cost: it.value || it.cost || null,
        weight: it.weight || null,
        reqAttune: it.reqAttune || null,
        attunementText: attuneText(it.reqAttune),
        dmg1: it.dmg1 || null,
        dmg2: it.dmg2 || null,
        dmgType: it.dmgType || null,
        range: it.range || null,
        properties: props,
        damageText: buildDamageText(it.dmg1, it.dmgType, it.dmg2, props),
        rangeText: buildRangeText(it.range, props),
        propertiesText: humanProps(props),
        loreFull: lore,
        loreShort: clampChars(lore, 360),
        rulesFull: rules || foundryDesc,
        rulesShort: clampChars(rules || foundryDesc, 420),
      };
    }
  }

  return { byKey, norm, classifyType };
}

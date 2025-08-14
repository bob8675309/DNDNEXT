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

const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();

const DMG = { P: "piercing", S: "slashing", B: "bludgeoning", R: "radiant", N: "necrotic", F: "fire", C: "cold", L: "lightning", A: "acid", T: "thunder", Psn: "poison", Psy: "psychic", Frc: "force" };

const PROP = {
  L: "Light",
  F: "Finesse",
  H: "Heavy",
  R: "Reach",
  T: "Thrown",
  V: "Versatile",
  2H: "Two-Handed",
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
  return props.map(p => PROP[p] || p).join(", ");
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

export async function loadItemsIndex() {
  // 1) If a merged catalog exists, use it first
  const merged = await safeJson("/items/all-items.json");

  let byKey = {};
  if (Array.isArray(merged) && merged.length) {
    for (const it of merged) {
      const key = norm(it.name || it.item_name);
      if (!key) continue;
      const dmgText = buildDamageText(it.dmg1, it.dmgType, it.dmg2, it.property || it.properties);
      const rangeText = buildRangeText(it.range, it.property || it.properties);
      const propsText = humanProps(it.property || it.properties || []);
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
        properties: it.property || it.properties || [],
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
      // Foundry 5e shapes vary; try a few paths
      const sys = f.system || f.data || {};
      const desc = asText(sys.description?.value || sys.description || sys.details?.description?.value);
      // Some foundry items carry damage parts, but we let base.json lead for weapons.
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

      // Lore: fluff first, else first paragraph of entries
      const loreFromFluff = fluffBy[key] || "";
      const entriesText = joinEntries(it.entries);
      // Try to split rule text from the first “lore-looking” block
      const [firstPara, ...rest] = (entriesText || "").split(/\n{2,}/g);
      const possibleLore = loreFromFluff || firstPara || "";
      const rulesText = (loreFromFluff ? entriesText : rest.join("\n\n")) || entriesText || "";

      // Foundry often has a cleaned description—use it to enrich rules if present
      const foundryDesc = foundryBy[key]?.desc || "";
      const rulesFull = rulesText || foundryDesc;

      byKey[key] = {
        name: it.name,
        type: it.type || null,
        rarity,
        source,
        slot: it.slot || it.wondrous ? it.wondrous : it.armor ? it.armor : it.weaponCategory || null,
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

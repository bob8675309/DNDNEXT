// scripts/build-all-items.mjs
// Build a single public/items/all-items.json that your site reads at runtime.
// - merges official 5eTools JSONs (base + foundry + fluff)
// - prefers 2024 “one” entries over “classic” duplicates
// - normalizes weapon/armor stats (dmg, properties, range, AC, weight, cost)
// - produces helpful derived fields (damageText, rangeText, propertiesText,
//   attunementText, loreShort/rulesShort, uiType)
// - intentionally DOES NOT expand magic variants (keeps the catalog small)
// - keeps structure you’re already rendering against

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "items");

// ---------- helpers ----------
const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const stripTag = (s) => String(s ?? "").split("|")[0];     // e.g. "V|XPHB" -> "V"
const asText = (x) =>
  Array.isArray(x)
    ? x.map(asText).join("\n\n")
    : (x && typeof x === "object" && x.entries) ? asText(x.entries) : String(x ?? "");

const joinEntries = (e) =>
  Array.isArray(e) ? e.map(asText).filter(Boolean).join("\n\n") : asText(e);

const clamp = (s, n = 360) => {
  if (!s) return "";
  const clean = s.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > n ? clean.slice(0, n - 1).trimEnd() + "…" : clean;
};

// damage/props dictionaries
const DMG = {
  P: "piercing", S: "slashing", B: "bludgeoning",
  R: "radiant", N: "necrotic", F: "fire", C: "cold",
  L: "lightning", A: "acid", T: "thunder", Psn: "poison",
  Psy: "psychic", Frc: "force"
};
const PROP = {
  L: "Light",
  F: "Finesse",
  H: "Heavy",
  R: "Reach",
  T: "Thrown",
  V: "Versatile",
  "2H": "Two-Handed",
  A: "Ammunition",
  LD: "Loading",
  S: "Special",
  RLD: "Reload",
};

const attuneText = (req) => !req ? "" : req === true ? "requires attunement" : `requires attunement ${req}`;
const propsText = (props = []) => props.map((p) => PROP[p] || p).join(", ");

const damageText = (d1, dt, d2, props) => {
  const base = d1 ? `${d1} ${DMG[dt] || dt || ""}`.trim() : "";
  const vers = (props || []).includes("V") && d2 ? `versatile (${d2})` : "";
  return [base, vers].filter(Boolean).join("; ");
};
const rangeText = (range, props) => {
  const r = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if ((props || []).includes("T")) return r ? `Thrown ${r} ft.` : "Thrown";
  return r ? `${r} ft.` : "";
};

function classifyType(t, it = {}) {
  // “t” is the short 5eTools code after stripTag(), e.g. "M", "R", "LA"
  switch (t) {
    case "M": return "Melee Weapon";
    case "R": return "Ranged Weapon";
    case "LA":
    case "MA":
    case "HA": return "Armor";
    case "S":  return "Shield";
    case "A":  return "Ammunition";
    case "INS": return "Instrument";
    case "P": return "Potion";
    case "SCF": return "Scroll";
    case "RG": return "Jewelry";
    case "RD":
    case "WD":
    case "ST": return "Rod/Wand/Staff";
    case "W":  return "Wondrous Item";
    default: {
      const n = String(it.name || "").toLowerCase();
      if (/potion|elixir/.test(n)) return "Potion";
      if (/scroll/.test(n)) return "Scroll";
      if (/ring|amulet|necklace|brooch/.test(n)) return "Jewelry";
      if (/arrow|bolt|bullet|ammunition/.test(n)) return "Ammunition";
      if (/drum|flute|lyre|instrument/.test(n)) return "Instrument";
      if (/ingot|gem|trade|spice|silk|tool/.test(n)) return "Trade Good";
      return "Other";
    }
  }
}

// read JSON helper
async function readJSON(rel) {
  try {
    const full = path.join(ROOT, rel);
    const raw = await fs.readFile(full, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// pick ONE of several entries with the same name, preferring 2024 (“one”)
function dedupePreferOne(arr) {
  const out = new Map(); // key: norm(name) -> item
  for (const it of arr || []) {
    const k = norm(it?.name);
    if (!k) continue;
    const existing = out.get(k);
    if (!existing) {
      out.set(k, it);
      continue;
    }
    const oldIsOne = String(existing.edition || "").toLowerCase() === "one";
    const newIsOne = String(it.edition || "").toLowerCase() === "one";
    // prefer “one”; otherwise keep the first version we saw
    if (!oldIsOne && newIsOne) out.set(k, it);
  }
  return Array.from(out.values());
}

// normalize a base item into the shape we render against
function normalizeBase(it, fluffBy, foundryDescBy) {
  const key = norm(it.name);

  // strip source tags from coded fields
  const type = stripTag(it.type);
  const props = (it.property || []).map(stripTag);

  // base text
  const entriesText = joinEntries(it.entries);
  const loreFromFluff = fluffBy[key] || "";
  const [firstPara, ...rest] = (entriesText || "").split(/\n{2,}/g);
  const possibleLore = loreFromFluff || firstPara || "";
  const rulesBody = (loreFromFluff ? entriesText : rest.join("\n\n")) || entriesText || "";
  // Foundry often has a clean text; use it if rules are sparse
  const foundryText = foundryDescBy[key] || "";
  const rulesFull = rulesBody || foundryText || "";

  // cost & weight as readable strings
  const gp = (it.value ?? it.cost);
  const cost = gp == null ? null : `${gp} gp`;
  const w = (it.weight ?? it.item_weight);
  const weight = w == null ? null : `${w} lbs`;

  const dmg1 = it.dmg1 || null;
  const dmg2 = it.dmg2 || null;
  const dmgType = it.dmgType || null;
  const range = it.range || null;

  const obj = {
    // identity/meta
    name: it.name,
    source: it.source || null,
    edition: it.edition || null, // kept for reference
    rarity: it.rarity ?? null,    // may be "none"
    type,                         // normalized 5eTools type code
    weaponCategory: it.weaponCategory || null,
    mastery: Array.isArray(it.mastery) ? it.mastery.map(stripTag) : null,

    // attunement
    reqAttune: it.reqAttune ?? null,
    attunementText: attuneText(it.reqAttune),

    // stats
    dmg1, dmg2, dmgType, range,
    property: props,
    damageText: damageText(dmg1, dmgType, dmg2, props),
    rangeText: rangeText(range, props),
    propertiesText: propsText(props),

    ac: it.ac ?? null,
    stealth: it.stealth ?? null,

    // econ
    cost,
    weight,

    // text
    item_description: rulesFull,
    loreFull: possibleLore,
    loreShort: clamp(possibleLore, 360),
    rulesShort: clamp(rulesFull, 420),

    // ui
    uiType: classifyType(type, it),
  };
  return obj;
}

(async () => {
  // Load everything we might care about (most are optional)
  const base0    = (await readJSON("items-base.json")) || [];
  const base1    = (await readJSON("items.json")) || [];
  const hbItems  = (await readJSON("homebrew-items.json")) || [];

  const fluff    = (await readJSON("fluff-items.json")) || [];
  const foundry  = (await readJSON("foundry-items.json")) || [];

  // we are NOT expanding variants in this build:
  // const variants = (await readJSON("magicvariants.json")) || [];
  // const makecards= (await readJSON("makecards.json")) || [];
  // const hbVars   = (await readJSON("homebrew-variants.json")) || [];

  const patches  = (await readJSON("homebrew-patches.json")) || [];

  // helpful log
  console.log("[build-all-items] Counts:");
  console.log(`  base0 (items-base.json): ${Array.isArray(base0) ? base0.length : 0}`);
  console.log(`  base1 (items.json):      ${Array.isArray(base1) ? base1.length : 0}`);
  console.log(`  hbItems:                 ${hbItems.length}`);
  console.log(`  fluff:                   ${Array.isArray(fluff) ? fluff.length : 0}`);
  console.log(`  foundry:                 ${Array.isArray(foundry) ? foundry.length : 0}`);
  console.log(`  hbPatches:               ${patches.length}`);

  // Build lookup helpers (fluff/foundry by name)
  const fluffBy = Object.fromEntries(
    (fluff || []).map((f) => [norm(f.name), asText(f.entries)])
  );

  const foundryDescBy = {};
  (foundry || []).forEach((f) => {
    const k = norm(f.name || f.label);
    const sys = f.system || f.data || {};
    const desc = asText(sys.description?.value || sys.description || sys.details?.description?.value);
    if (k && desc) foundryDescBy[k] = desc;
  });

  // Prefer edition “one” when duplicates exist (by name)
  const baseMerged = dedupePreferOne([...(base0 || []), ...(base1 || []), ...hbItems]);

  // Normalize + derive
  const normalized = baseMerged.map((it) => normalizeBase(it, fluffBy, foundryDescBy));

  // Apply simple homebrew patches (optional)
  for (const p of patches) {
    const nameEquals = p.nameEquals && norm(p.nameEquals);
    const nameMatches = p.nameMatches ? new RegExp(p.nameMatches, "i") : null;
    const sourceEquals = p.sourceEquals;

    for (const it of normalized) {
      const okName =
        (nameEquals && norm(it.name) === nameEquals) ||
        (nameMatches && nameMatches.test(it.name)) ||
        (!nameEquals && !nameMatches); // if no matcher, apply to all

      const okSource =
        sourceEquals ? String(it.source || "") === String(sourceEquals) : true;

      if (!okName || !okSource) continue;

      if (p.set && typeof p.set === "object") Object.assign(it, p.set);

      if (Array.isArray(p.addEntriesPre) || Array.isArray(p.addEntriesPost)) {
        const pre = (p.addEntriesPre || []).map(asText).join("\n\n");
        const post = (p.addEntriesPost || []).map(asText).join("\n\n");
        it.item_description = [pre, it.item_description || "", post].filter(Boolean).join("\n\n");
        it.rulesShort = clamp(it.item_description, 420);
      }

      if (Array.isArray(p.addProps) || Array.isArray(p.rmProps)) {
        const list = [...(it.property || [])];
        (p.addProps || []).forEach((code) => { if (!list.includes(code)) list.push(code); });
        (p.rmProps || []).forEach((code) => {
          const i = list.indexOf(code); if (i >= 0) list.splice(i, 1);
        });
        it.property = list;
        it.propertiesText = propsText(list);
        it.damageText = damageText(it.dmg1, it.dmgType, it.dmg2, list);
        it.rangeText = rangeText(it.range, list);
      }
    }
  }

  // Final write
  const final = normalized;
  await fs.writeFile(
    path.join(ROOT, "all-items.json"),
    JSON.stringify(final, null, 0),
    "utf8"
  );
  console.log(`[build-all-items] Wrote ${final.length} items → public/items/all-items.json`);
})();

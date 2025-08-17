// scripts/build-all-items.mjs
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "items");

/* -------------------- small utils -------------------- */
const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const asText = (x) =>
  Array.isArray(x)
    ? x.map(asText).join("\n\n")
    : x?.entries
    ? asText(x.entries)
    : String(x ?? "");
const joinEntries = (e) =>
  Array.isArray(e) ? e.map(asText).filter(Boolean).join("\n\n") : asText(e);
const clamp = (s, n = 360) =>
  !s
    ? ""
    : (s = s.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()).length >
      n
    ? s.slice(0, n - 1).trimEnd() + "…"
    : s;

const DMG = {
  P: "piercing",
  S: "slashing",
  B: "bludgeoning",
  R: "radiant",
  N: "necrotic",
  F: "fire",
  C: "cold",
  L: "lightning",
  A: "acid",
  T: "thunder",
  Psn: "poison",
  Psy: "psychic",
  Frc: "force",
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

const damageText = (d1, dt, d2, props) =>
  [
    d1 ? `${d1} ${(DMG[dt] || dt || "").trim()}`.trim() : "",
    (props || []).includes("V") && d2 ? `versatile (${d2})` : "",
  ]
    .filter(Boolean)
    .join("; ");

const rangeText = (range, props) => {
  const r = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if ((props || []).includes("T")) return r ? `Thrown ${r} ft.` : "Thrown";
  return r ? `${r} ft.` : "";
};

const propsText = (props = []) => props.map((p) => PROP[p] || p).join(", ");
const attuneText = (req) =>
  !req ? "" : req === true ? "requires attunement" : `requires attunement ${req}`;

const classifyType = (t, it = {}) => {
  t = String(t || it.type || it.item_type || "");
  if (t === "M") return "Melee Weapon";
  if (t === "R") return "Ranged Weapon";
  if (t === "LA" || t === "MA" || t === "HA") return "Armor";
  if (t === "S") return "Shield";
  if (t === "A") return "Ammunition";
  if (t === "INS") return "Instrument";
  if (t === "P") return "Potion";
  if (t === "SCF") return "Scroll";
  if (t === "RG") return "Jewelry";
  if (t === "RD" || t === "WD" || t === "ST") return "Rod/Wand/Staff";
  if (t === "W") return "Wondrous Item";
  const n = String(it.name || "").toLowerCase();
  if (/potion|elixir/.test(n)) return "Potion";
  if (/scroll/.test(n)) return "Scroll";
  if (/ring|amulet|necklace|brooch/.test(n)) return "Jewelry";
  if (/arrow|bolt|bullet|ammunition/.test(n)) return "Ammunition";
  if (/drum|flute|lyre|instrument/.test(n)) return "Instrument";
  if (/ingot|gem|trade|spice|silk|tool/.test(n)) return "Trade Good";
  return "Other";
};

async function readJSON(rel) {
  try {
    const p = path.join(ROOT, rel);
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Coerce any of your files (array OR object) into an array. */
function toArr(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;

  // common container keys we’ve seen in your dumps
  const keys = [
    "items",
    "item",
    "results",
    "entries",
    "data",
    "list",
    "array",
    "records",
    "variants",
  ];
  for (const k of keys) {
    if (Array.isArray(x[k])) return x[k];
  }
  // sometimes 5eTools packs stuff under .item?.list etc.
  if (x.item && Array.isArray(x.item)) return x.item;
  if (x.item && Array.isArray(x.item.items)) return x.item.items;

  // last resort: object values that are arrays
  for (const v of Object.values(x)) {
    if (Array.isArray(v)) return v;
  }

  return []; // better empty than crash
}

/* ------------- currencies: 5eTools value is in cp ------------- */
function formatCoinFromCp(cp) {
  if (cp == null || isNaN(cp)) return null;
  const n = Number(cp);
  if (n % 100 === 0) return `${n / 100} gp`;
  if (n % 10 === 0) return `${(n / 10).toFixed(0)} sp`;
  return `${n} cp`;
}

/* ---------- field merging helpers ---------- */
function pick(...vals) {
  for (const v of vals) {
    if (v === 0) return 0;
    if (v === false) return false;
    if (v != null) return v;
  }
  return null;
}

function stripPipe(s) {
  if (s == null) return s;
  return String(s).split("|")[0];
}
function stripPipeArray(arr) {
  if (!arr) return [];
  return arr
    .map((p) => (typeof p === "string" ? p.split("|")[0] : p))
    .filter(Boolean);
}

// Prefer “one” over “classic”; otherwise keep the record with more weapon/armor fields filled.
function choosePreferred(records) {
  if (!records.length) return null;
  const one = records.find(
    (r) => String(r.edition || "").toLowerCase() === "one"
  );
  if (one) return one;

  const score = (r) => {
    let s = 0;
    if (r.dmg1) s++;
    if (r.dmg2) s++;
    if (r.dmgType) s++;
    if (r.range) s++;
    if (Array.isArray(r.property) && r.property.length) s++;
    if (r.ac != null) s++;
    return s;
  };
  return [...records].sort((a, b) => score(b) - score(a))[0];
}

/* -------------------- main -------------------- */
(async () => {
  // Core sources (any shape)
  const base0 = toArr(await readJSON("items-base.json")); // structured stats
  const base1 = toArr(await readJSON("items.json"));      // big catalog
  const hbItems = toArr(await readJSON("homebrew-items.json"));

  const fluff = toArr(await readJSON("fluff-items.json"));
  const foundry = toArr(await readJSON("foundry-items.json"));

  // We load variants only to have them available later (no explosion here)
  const variantsOfficial = toArr(await readJSON("magicvariants.json"));
  const variantsMakecards = toArr(await readJSON("makecards.json"));
  const hbPatches = toArr(await readJSON("homebrew-patches.json"));

  console.log("[build-all-items] Counts:");
  console.log(`  base0 (items-base.json): ${base0.length}`);
  console.log(`  base1 (items.json):      ${base1.length}`);
  console.log(`  hbItems:                 ${hbItems.length}`);
  console.log(`  fluff:                   ${fluff.length}`);
  console.log(`  foundry:                 ${foundry.length}`);
  console.log(`  variants (official):     ${variantsOfficial.length}`);
  console.log(`  variants (makecards):    ${variantsMakecards.length}`);
  console.log(`  hbPatches:               ${hbPatches.length}`);

  // Index fluff/foundry for lore/rules text
  const fluffBy = Object.fromEntries(
    fluff.map((f) => [norm(f.name), asText(f.entries)])
  );
  const foundryDescBy = {};
  for (const f of foundry) {
    const k = norm(f.name || f.label);
    const sys = f.system || f.data || {};
    const desc = asText(
      sys.description?.value || sys.description || sys.details?.description?.value
    );
    if (k && desc) foundryDescBy[k] = desc;
  }

  // Group same-name items across sources
  const byName = new Map();
  function push(rec) {
    const k = norm(rec?.name);
    if (!k) return;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(rec);
  }
  [...base0, ...base1, ...hbItems].forEach(push);

  const merged = [];

  for (const [k, records] of byName.entries()) {
    if (!records.length) continue;

    // Normalize type/property for **all** candidates before picking
    for (const r of records) {
      r.type = stripPipe(r.type); // "M|XPHB" → "M"
      r.property = stripPipeArray(r.property || r.properties);
      if (r.properties) delete r.properties;
    }

    const best = choosePreferred(records);
    if (!best) continue;

    const others = records.filter((r) => r !== best);
    const grab = (key) =>
      pick(
        best[key],
        ...others.map((o) => o[key])
      );

    const type = stripPipe(grab("type"));
    const rarity = grab("rarity");
    const source = grab("source");

    const property = stripPipeArray(grab("property"));
    const dmg1 = grab("dmg1");
    const dmg2 = grab("dmg2");
    const dmgType = grab("dmgType");
    const range = grab("range");
    const ac = grab("ac");
    const weight = grab("weight");
    const reqAttune = grab("reqAttune");
    const slot = grab("slot");
    const weaponCategory = grab("weaponCategory");
    const valueCp = Number(grab("value"));

    // Description / lore
    const entriesAll = joinEntries(grab("entries"));
    const loreFirst = fluffBy[k] || entriesAll.split(/\n{2,}/)[0] || "";
    const rulesText =
      (fluffBy[k] ? entriesAll : entriesAll.split(/\n{2,}/).slice(1).join("\n\n")) ||
      entriesAll;
    const foundryRules = foundryDescBy[k] || "";

    const item = {
      name: best.name,
      edition: String(best.edition || "").toLowerCase() || null,
      source: source || null,
      type: type || null,
      rarity: rarity || null,

      // economics
      value: isFinite(valueCp) ? valueCp : null, // raw cp
      cost:
        (isFinite(valueCp) ? formatCoinFromCp(valueCp) : null) ||
        grab("cost") ||
        null,

      // carry
      weight: weight ?? null,

      // combat bits
      property: Array.isArray(property) ? property : [],
      dmg1: dmg1 || null,
      dmg2: dmg2 || null,
      dmgType: dmgType || null,
      range: range || null,
      ac: ac ?? null,
      weaponCategory: weaponCategory || null,

      // attunement / slots
      slot: slot || null,
      reqAttune: reqAttune ?? null,

      // text
      item_description: rulesText || foundryRules || "",
      loreFull: loreFirst,
      loreShort: clamp(loreFirst, 360),
      rulesShort: clamp(rulesText || foundryRules || "", 420),
    };

    // Derived presentation helpers
    const props = item.property || [];
    item.damageText = damageText(item.dmg1, item.dmgType, item.dmg2, props);
    item.rangeText = rangeText(item.range, props);
    item.propertiesText = propsText(props);
    item.attunementText = attuneText(item.reqAttune);
    item.uiType = classifyType(item.type, item);
    if (item.ac != null) item.armorClassText = `AC ${item.ac}`;

    merged.push(item);
  }

  /* ---------- optional post-build patches (homebrew) ---------- */
  for (const p of hbPatches) {
    const test = (it) => {
      if (p.nameEquals && norm(it.name) !== norm(p.nameEquals)) return false;
      if (p.nameMatches && !new RegExp(p.nameMatches, "i").test(it.name)) return false;
      if (p.sourceEquals && String(it.source || "") !== String(p.sourceEquals))
        return false;
      return true;
    };
    for (const it of merged) {
      if (!test(it)) continue;
      if (p.set) Object.assign(it, p.set);
      if (Array.isArray(p.addEntriesPre) || Array.isArray(p.addEntriesPost)) {
        const pre = (p.addEntriesPre || []).map(asText).join("\n\n");
        const post = (p.addEntriesPost || []).map(asText).join("\n\n");
        it.item_description = [pre, it.item_description || "", post]
          .filter(Boolean)
          .join("\n\n");
      }
      if (Array.isArray(p.addProps) || Array.isArray(p.rmProps)) {
        const pr = [...(it.property || [])];
        (p.addProps || []).forEach((code) => {
          if (!pr.includes(code)) pr.push(code);
        });
        (p.rmProps || []).forEach((code) => {
          const i = pr.indexOf(code);
          if (i >= 0) pr.splice(i, 1);
        });
        it.property = pr;
        it.propertiesText = propsText(pr);
        it.damageText = damageText(it.dmg1, it.dmgType, it.dmg2, pr);
        it.rangeText = rangeText(it.range, pr);
      }
    }
  }

  // Final “classic vs one” cleanup per name
  const out = [];
  const seen = new Map(); // name → idx kept
  for (const it of merged) {
    const key = norm(it.name);
    const keptIdx = seen.get(key);
    if (keptIdx == null) {
      seen.set(key, out.push(it) - 1);
      continue;
    }
    const kept = out[keptIdx];
    const keptIsOne = (kept.edition || "") === "one";
    const currIsOne = (it.edition || "") === "one";
    if (currIsOne && !keptIsOne) out[keptIdx] = it;
  }

  await fs.writeFile(
    path.join(ROOT, "all-items.json"),
    JSON.stringify(out, null, 0),
    "utf8"
  );
  console.log(
    `[build-all-items] Wrote ${out.length} items → public/items/all-items.json`
  );
})();

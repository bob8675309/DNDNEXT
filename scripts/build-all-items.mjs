// scripts/build-all-items.mjs
import fs from "node:fs/promises";
import path from "node:path";

/* ========== Paths ========== */
const ROOT = path.join(process.cwd(), "public", "items");

/* ========== Safety / Tunables ========== */
const MAX_VARIANT_ITEMS = 40000; // final guardrail
const LOG_EVERY = 5000;

// Only these base types may receive variants:
const VARIANT_ELIGIBLE_TYPES = new Set(["M", "R", "LA", "MA", "HA", "S", "A"]);

// Only bases with no rarity are variant-eligible (i.e., mundane gear)
const APPLY_VARIANTS_TO_MAGIC = false;

/* ========== IO helpers ========== */
async function readFileJSON(rel) {
  try {
    const raw = await fs.readFile(path.join(ROOT, rel), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function coerceArray(data, candidates = ["item", "items", "itemFluff", "fluff", "variants", "variant", "data", "list"]) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object") {
    for (const key of candidates) {
      const v = data[key];
      if (Array.isArray(v)) return v;
    }
    for (const v of Object.values(data)) if (Array.isArray(v)) return v;
  }
  return [];
}

/* ========== Normalization / Text utils ========== */
const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();

const DMG = { P:"piercing", S:"slashing", B:"bludgeoning", R:"radiant", N:"necrotic", F:"fire", C:"cold", L:"lightning", A:"acid", T:"thunder", Psn:"poison", Psy:"psychic", Frc:"force" };
const PROP = { L:"Light", F:"Finesse", H:"Heavy", R:"Reach", T:"Thrown", V:"Versatile", "2H":"Two-Handed", A:"Ammunition", LD:"Loading", S:"Special", RLD:"Reload" };

const asText = (x) =>
  Array.isArray(x)
    ? x.map(asText).join("\n\n")
    : (x && typeof x === "object" && x.entries)
      ? asText(x.entries)
      : String(x ?? "");
const joinEntries = (e) => Array.isArray(e) ? e.map(asText).filter(Boolean).join("\n\n") : asText(e);

const clamp = (s, n = 360) => {
  if (!s) return "";
  const clean = s.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > n ? clean.slice(0, n - 1).trimEnd() + "…" : clean;
};

const damageText = (d1, dt, d2, props) => {
  const base = d1 ? `${d1} ${(DMG[dt] || dt || "").trim()}`.trim() : "";
  const versatile = (props || []).includes("V") && d2 ? `versatile (${d2})` : "";
  return [base, versatile].filter(Boolean).join("; ");
};
const rangeText = (range, props) => {
  const r = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if ((props || []).includes("T")) return r ? `Thrown ${r} ft.` : "Thrown";
  return r ? `${r} ft.` : "";
};
const propsText = (props = []) => props.map((p) => PROP[p] || p).join(", ");
const attuneText = (req) => req ? (req === true ? "requires attunement" : `requires attunement ${String(req)}`) : "";

/* ========== Classification for UI buckets ========== */
function classifyType(t, it = {}) {
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
}

/* ========== Variant matching DSL ========== */
function stringMatches(reStr, s) { try { return new RegExp(reStr, "i").test(s); } catch { return false; } }
function hasAny(hay = [], needles = []) { const set = new Set((hay || []).map(String)); return (needles || []).some((n) => set.has(String(n))); }

function matchReq(base, req = {}) {
  const t = String(base.type || "");
  const name = String(base.name || "").toLowerCase();
  const ui = classifyType(t, base);
  const props = base.property || base.properties || [];

  const checks = [];
  if (req.typeIn) checks.push(req.typeIn.includes(t));
  if (req.weapon) checks.push(t === "M" || t === "R");
  if (req.melee) checks.push(t === "M");
  if (req.ranged) checks.push(t === "R");
  if (req.armor) checks.push(t === "LA" || t === "MA" || t === "HA");
  if (req.ammo) checks.push(t === "A");
  if (req.shield) checks.push(t === "S");
  if (req.uiTypeIn) checks.push(req.uiTypeIn.includes(ui));

  if (req.nameIncludes) checks.push(req.nameIncludes.some((w) => name.includes(String(w).toLowerCase())));
  if (req.nameMatches) checks.push(stringMatches(req.nameMatches, name));
  if (req.notNameMatches) checks.push(!stringMatches(req.notNameMatches, name));

  if (req.propertyHas) checks.push(hasAny(props, req.propertyHas));
  if (req.propertyNot) checks.push(!hasAny(props, req.propertyNot));

  if (req.not) checks.push(!matchReq(base, req.not));

  return checks.length ? checks.every(Boolean) : true;
}

function parseTypePipe(str) {
  // e.g. "M|R" → ["M","R"]
  return String(str || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function impliedRequiresFromVariant(v) {
  // Prefer explicit requires if present
  if (Array.isArray(v.requires) && v.requires.length) return v.requires;

  // If no requires, try to derive from inherits.type (e.g., "M|R")
  const tPipe = v?.inherits?.type ? parseTypePipe(v.inherits.type) : [];
  const eligible = tPipe.filter((t) => VARIANT_ELIGIBLE_TYPES.has(t));
  if (eligible.length) return [{ typeIn: eligible }];

  // Nothing to constrain → SKIP this variant
  return null;
}

function applyNameVariant(baseName, inh = {}) {
  let name = baseName;
  if (inh.nameRemove) name = name.replace(new RegExp(String(inh.nameRemove) + "$", "i"), "").trim();
  if (inh.namePrefix) name = `${inh.namePrefix}${name}`;
  if (inh.nameSuffix) name = `${name}${inh.nameSuffix}`;
  return name;
}

function makeVariant(base, v) {
  const inh = v.inherits || {};
  const out = { ...base };
  out.isVariant = true;
  out.baseItem = base.name;
  out.variantKey = v.name || v.key || inh.namePrefix || inh.nameSuffix || "variant";

  // id/meta
  out.name = applyNameVariant(base.name, inh);
  out.type = inh.type ? String(inh.type).split("|")[0] : base.type;
  out.rarity = inh.rarity || base.rarity || null;
  out.source = inh.source || base.source || null;
  out.reqAttune = (inh.reqAttune !== undefined) ? inh.reqAttune : (base.reqAttune ?? null);

  // numeric multipliers (value/weight)
  const mult = (raw) => (typeof raw === "number" && isFinite(raw)) ? raw : null;
  const vMult = mult(inh.valueMult);
  const wMult = mult(inh.weightMult);

  if (vMult && /\bgp\b/i.test(String(base.cost || base.value || ""))) {
    const n = +String(base.cost || base.value).match(/([\d.]+)/)?.[1] || 0;
    out.cost = `${(n * vMult).toFixed(2).replace(/\.00$/, "")} gp`;
  }
  if (wMult && base.weight) {
    const n = +String(base.weight).match(/([\d.]+)/)?.[1] || 0;
    out.weight = `${(n * wMult).toFixed(2).replace(/\.00$/, "")} lb`;
  }

  // properties
  const p = [...(out.property || out.properties || [])];
  (inh.addProps || []).forEach((code) => { if (!p.includes(code)) p.push(code); });
  (inh.rmProps || []).forEach((code) => {
    const i = p.indexOf(code); if (i >= 0) p.splice(i, 1);
  });
  if (p.length) out.property = p;

  // arbitrary field sets
  if (inh.set && typeof inh.set === "object") Object.assign(out, inh.set);

  // description augmentation
  const pre = (inh.addEntriesPre || []).map(asText).join("\n\n");
  const post = (inh.addEntriesPost || []).map(asText).join("\n\n");
  const baseRules = out.item_description || "";
  out.item_description = [pre, baseRules, post].filter(Boolean).join("\n\n");

  // recompute derived strings
  const p2 = out.property || out.properties || [];
  out.damageText = damageText(out.dmg1, out.dmgType, out.dmg2, p2);
  out.rangeText = rangeText(out.range, p2);
  out.propertiesText = propsText(p2);
  out.uiType = classifyType(out.type, out);
  out.attunementText = attuneText(out.reqAttune);
  return out;
}

/* ========== Build ========== */
(async () => {
  // Official sources
  const base0   = coerceArray(await readFileJSON("items-base.json"));
  const base1   = coerceArray(await readFileJSON("items.json"));
  const fluff   = coerceArray(await readFileJSON("fluff-items.json"), ["itemFluff", "fluff", "item", "items"]);
  const foundry = coerceArray(await readFileJSON("foundry-items.json"), ["item", "items"]);

  const variants0 = coerceArray(await readFileJSON("magicvariants.json"), ["variants", "variant", "magicvariants", "magicvariant"]);
  const variants1 = coerceArray(await readFileJSON("makecards.json"), ["variants", "variant", "cards"]);

  // Index for helper data (e.g., images)
  const idxRaw = await readFileJSON("index-item.json");
  const idxMap = (() => {
    if (!idxRaw) return {};
    const m = {};
    const arr = Array.isArray(idxRaw) ? idxRaw : Object.values(idxRaw);
    for (const it of arr) {
      if (!it) continue;
      const name = it.name || it.id || it.key;
      if (name) m[norm(name)] = it;
    }
    return m;
  })();

  // Homebrew (optional)
  const hbItems    = coerceArray(await readFileJSON("homebrew-items.json"));
  const hbVariants = coerceArray(await readFileJSON("homebrew-variants.json"), ["variants", "variant"]);
  const hbPatches  = coerceArray(await readFileJSON("homebrew-patches.json"),  ["patches", "patch"]);

  // Compose base pool with provenance tags
  const allBaseRaw = [
    ...base0.map((x) => ({ ...x, _origin: "base0" })),
    ...base1.map((x) => ({ ...x, _origin: "base1" })),
    ...hbItems.map((x) => ({ ...x, _origin: "hb" })),
  ];

  // Diagnostics
  console.log("[build-all-items] Counts:");
  console.log("  base0 (items-base.json):", base0.length);
  console.log("  base1 (items.json):     ", base1.length);
  console.log("  hbItems:                ", hbItems.length);
  console.log("  fluff:                  ", fluff.length);
  console.log("  foundry:                ", foundry.length);
  console.log("  variants (official):    ", variants0.length);
  console.log("  variants (makecards):   ", variants1.length);
  console.log("  hbVariants:             ", hbVariants.length);
  console.log("  hbPatches:              ", hbPatches.length);

  // Index lore and foundry desc
  const fluffBy = {};
  for (const f of fluff) {
    const k = norm(f.name);
    const lore = joinEntries(f.entries);
    if (k && lore) fluffBy[k] = lore;
  }
  const foundryDescBy = {};
  for (const f of foundry) {
    const k = norm(f.name || f.label);
    const sys = f.system || f.data || {};
    const desc = asText(sys.description?.value || sys.description || sys.details?.description?.value);
    if (k && desc) foundryDescBy[k] = desc;
  }

  // Normalize base items
  const baseList = allBaseRaw.map((it) => {
    const k = norm(it.name);
    const entries = joinEntries(it.entries);
    const loreFirst = fluffBy[k] || entries.split(/\n{2,}/)[0] || "";
    const rules = (fluffBy[k] ? entries : entries.split(/\n{2,}/).slice(1).join("\n\n")) || "";
    const props = it.property || it.properties || [];

    const idx = idxMap[k] || {};
    const img = it.img || idx.img || idx.image || null;

    return {
      ...it,
      img: img || null,
      item_description: rules || foundryDescBy[k] || "",
      loreFull: loreFirst,
      loreShort: clamp(loreFirst, 360),
      rulesShort: clamp(rules || foundryDescBy[k] || "", 420),
      damageText: damageText(it.dmg1, it.dmgType, it.dmg2, props),
      rangeText: rangeText(it.range, props),
      propertiesText: propsText(props),
      attunementText: attuneText(it.reqAttune),
      uiType: classifyType(it.type, it),
    };
  });

  // Which base items are variant-eligible?
  const isMundane = (it) => APPLY_VARIANTS_TO_MAGIC ? true : (it.rarity == null || it.rarity === "" || it.rarity === "none");
  const isTypeOK  = (it) => VARIANT_ELIGIBLE_TYPES.has(String(it.type || "").trim());
  const baseVariantPool = baseList.filter((it) => isMundane(it) && isTypeOK(it));

  console.log(`[build-all-items] base items total: ${baseList.length}`);
  console.log(`[build-all-items] base items eligible for variants: ${baseVariantPool.length}`);

  // Normalize variants and derive requires if absent
  const allVariants = [...variants0, ...variants1, ...hbVariants]
    .filter(Boolean)
    .map((v) => {
      const out = { ...v };
      if (!out.inherits) out.inherits = {};
      const reqs = impliedRequiresFromVariant(out);
      if (!reqs) out._skip = true; // no constraints → skip
      else out.requires = reqs;
      return out;
    })
    .filter((v) => !v._skip);

  // Expand variants with early de-dupe and safety cap
  const seenVarKey = new Set(); // (name|source)
  const exploded = [];
  let produced = 0;
  let skippedByCap = 0;

  for (let vi = 0; vi < allVariants.length; vi++) {
    const v = allVariants[vi];
    if (vi % 20 === 0 && vi) console.log(`  … variant ${vi}/${allVariants.length} (produced so far: ${produced})`);

    for (let bi = 0; bi < baseVariantPool.length; bi++) {
      const base = baseVariantPool[bi];

      // final per-variant match against its requires
      if (!v.requires.some((req) => matchReq(base, req))) continue;

      // Predict name/source to de-dupe prior to cloning
      const predName = applyNameVariant(base.name, v.inherits || {});
      const predSource = v.inherits?.source || base.source || "";
      const key = `${norm(predName)}|${String(predSource)}`;
      if (seenVarKey.has(key)) continue;

      if (produced >= MAX_VARIANT_ITEMS) { skippedByCap++; continue; }

      const variant = makeVariant(base, v);
      seenVarKey.add(key);
      exploded.push(variant);
      produced++;

      if (produced % LOG_EVERY === 0) {
        console.log(`    produced variants: ${produced} (cap ${MAX_VARIANT_ITEMS})`);
      }
    }
  }
  if (skippedByCap) console.warn(`⚠ Skipped ${skippedByCap} variant rows due to MAX_VARIANT_ITEMS cap (${MAX_VARIANT_ITEMS}).`);

  // Merge + de-dupe base + variants
  const seen = new Set();
  const all = [];
  for (const it of [...baseList, ...exploded]) {
    const key = `${norm(it.name)}|${String(it.source || "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(it);
  }

  // Post-build patches
  const hbPatchesArr = Array.isArray(hbPatches) ? hbPatches : [];
  for (const p of hbPatchesArr) {
    const matcher = (it) => {
      if (p.nameEquals && norm(it.name) !== norm(p.nameEquals)) return false;
      if (p.nameMatches && !stringMatches(p.nameMatches, it.name)) return false;
      if (p.sourceEquals && String(it.source || "") !== String(p.sourceEquals)) return false;
      return true;
    };
    for (const it of all) {
      if (!matcher(it)) continue;

      if (p.set && typeof p.set === "object") Object.assign(it, p.set);

      if (Array.isArray(p.addEntriesPre) || Array.isArray(p.addEntriesPost)) {
        const pre = (p.addEntriesPre || []).map(asText).join("\n\n");
        const post = (p.addEntriesPost || []).map(asText).join("\n\n");
        it.item_description = [pre, it.item_description || "", post].filter(Boolean).join("\n\n");
      }

      if (Array.isArray(p.addProps) || Array.isArray(p.rmProps)) {
        const props = [...(it.property || it.properties || [])];
        (p.addProps || []).forEach((code) => { if (!props.includes(code)) props.push(code); });
        (p.rmProps || []).forEach((code) => {
          const i = props.indexOf(code); if (i >= 0) props.splice(i, 1);
        });
        it.property = props;
      }

      // recompute derived
      const p2 = it.property || it.properties || [];
      it.damageText = damageText(it.dmg1, it.dmgType, it.dmg2, p2);
      it.rangeText = rangeText(it.range, p2);
      it.propertiesText = propsText(p2);
      it.uiType = classifyType(it.type, it);
      it.attunementText = attuneText(it.reqAttune);
    }
  }

  // Final sanity
  const final = all.filter((it) => it.name && String(it.name).trim().length);

  console.log(`[build-all-items] base items total: ${baseList.length}`);
  console.log(`[build-all-items] variant items kept: ${exploded.length} (produced ${produced}, skippedByCap ${skippedByCap})`);
  console.log(`[build-all-items] total after merge/dedupe: ${final.length}`);

  await fs.writeFile(path.join(ROOT, "all-items.json"), JSON.stringify(final), "utf8");
  console.log(`[build-all-items] Wrote ${final.length} items → public/items/all-items.json`);
})();

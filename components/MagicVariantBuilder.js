// components/MagicVariantBuilder.js
// Parametric Magic Variant Builder
// - Category pills (Weapon/Armor/Shield/Ammunition)
// - Base item dropdown (mundane items for the chosen category)
// - Variant slots: Material, Bonus (+N with N selector), Other A, Other B
// - Live preview + description before applying
//
// Backward compatible: still tolerates legacy 5etools-like catalogs.

import { useEffect, useMemo, useState } from "react";

/* ------------------------ String helpers ------------------------ */
const norm = (s) => String(s || "").trim();
const title = (s) => String(s || "").replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());

function normalizeVariantLabel(label) {
  const s = String(label || "").trim();
  return s.replace(/^(?:weapon|armor|shield|ammunition)\s+of\s+/i, "of ");
}

/* ----------------------- Entries → plaintext -------------------- */
function flattenEntries(entries) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === "string") {
      const t = node.replace(/\{@[^}]+}/g, (m) => {
        const inner = m.slice(2, -1).trim();
        const sp = inner.indexOf(" ");
        if (sp === -1) return inner;
        const tag = inner.slice(0, sp).toLowerCase();
        const rest = inner.slice(sp + 1).trim();
        if (tag === "dc") return `DC ${rest}`;
        if (tag === "damage" || tag === "hit") return rest;
        return rest.split("|")[0];
      });
      out.push(t);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      if (node.entries) walk(node.entries);
      if (node.entry) walk(node.entry);
      if (node.caption) out.push(String(node.caption));
      if (node.rows && Array.isArray(node.rows)) node.rows.forEach(r => Array.isArray(r) && out.push(r.join(" — ")));
    }
  };
  walk(entries);
  return out.join("\n\n").trim();
}

/* ---------------------------- Kinds ----------------------------- */
function guessKind(item) {
  const name = (item?.name || item?.item_name || "").toLowerCase();
  const type = (item?.type || item?.item_type || "").toLowerCase();
  const all = `${name} ${type}`;
  if (/(^|\W)(la|ma|ha|shield|s\|xphb)\b/.test(all) || /armor|shield/.test(all)) return "armor";
  if (/(sword|dagger|axe|mace|bow|crossbow|spear|polearm|maul|staff|club|whip|weapon)/.test(all)) return "weapon";
  if (/ammunition|arrow|bolt|shot|bullet/.test(all)) return "ammunition";
  return "any";
}

function guessVariantKind(v) {
  if (Array.isArray(v?.appliesTo) && v.appliesTo.length) {
    const a = v.appliesTo.map(s => String(s).toLowerCase());
    const w = a.includes("weapon");
    const ar = a.includes("armor");
    const s = a.includes("shield");
    const am = a.includes("ammunition");
    if ([w, ar, s, am].filter(Boolean).length > 1) return "any";
    if (w) return "weapon";
    if (ar) return "armor";
    if (s) return "shield";
    if (am) return "ammunition";
  }
  const name = String(v?.name || "").toLowerCase();
  if (/armor|shield/.test(name)) return "armor";
  if (/weapon|sword|axe|mace|bow|crossbow|spear|whip/.test(name)) return "weapon";
  if (/ammunition|arrow|bolt|shot|bullet/.test(name)) return "ammunition";
  return "any";
}

/* ------------------------- Catalog ingest ----------------------- */
const looksVariant = (v) =>
  v && typeof v === "object" && (
    v.name || v.effects || v.delta || v.mod || v.entries || v.item_description ||
    v.bonusWeapon || v.bonusAc || v.bonusShield || v.bonusSpellAttack || v.bonusSpellSaveDc
  );

function collectVariants(node) {
  const out = [];
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const v of node) out.push(...collectVariants(v));
    return out;
  }
  if (typeof node === "object") {
    if (Array.isArray(node.magicvariant)) return collectVariants(node.magicvariant);
    if (Array.isArray(node.magicvariants)) return collectVariants(node.magicvariants);
    if (Array.isArray(node.variants)) return collectVariants(node.variants);
    if (Array.isArray(node.items)) return collectVariants(node.items);
    if (looksVariant(node)) out.push(node);
    else for (const v of Object.values(node)) out.push(...collectVariants(v));
  }
  return out;
}

function massageCatalog(raw) {
  return raw.map((v) => {
    const inherits = v?.inherits || {};
    const label = normalizeVariantLabel(v?.name || v?.label || v?.title || "");
    const rarity = v?.rarity || inherits?.rarity || "";
    const entries = v?.entries || inherits?.entries || [];
    const text = v?.text || v?.description || flattenEntries(entries);

    // Parametric fields (Option B)
    const options = Array.isArray(v?.options) ? v.options.slice() : null;
    const rarityByValue = v?.rarityByValue || null;
    const appliesTo = Array.isArray(v?.appliesTo) ? v.appliesTo.slice() : null;
    const textByKind = v?.textByKind || null;

    const kind = appliesTo ? guessVariantKind({ appliesTo }) : guessVariantKind(v);

    return {
      ...v,
      name: label || v?.name,
      rarity,
      text,
      options,
      rarityByValue,
      appliesTo,
      textByKind,
      _kind: kind, // weapon | armor | shield | ammunition | any
    };
  });
}

/* ------------------------- Rarity ranking ----------------------- */
const RANK = {
  mundane: 0,
  common: 1,
  uncommon: 2,
  rare: 3,
  veryrare: 4,
  "very rare": 4,
  legendary: 5,
  artifact: 6,
};
function bestRarity(...vals) {
  let best = { v: -1, raw: "" };
  for (const r of vals) {
    if (!r) continue;
    const key = String(r).toLowerCase().replace(/-/g, "");
    const v = RANK[key] ?? -1;
    if (v > best.v) best = { v, raw: r };
  }
  return best.raw || vals.find(Boolean) || "";
}

/* ---------------------- Structured merge ------------------------ */
function applyStructuredChanges(base, parts) {
  const out = { ...base };
  for (const p of parts) {
    const ch = p?.changes || p?.apply || {};
    const setProps = ch.setProps || {};
    const addProps = ch.addProps || {};
    Object.assign(out, setProps);
    for (const [k, v] of Object.entries(addProps)) {
      const cur = Number(out[k] ?? 0);
      const add = Number(v ?? 0);
      if (!Number.isNaN(cur) && !Number.isNaN(add)) out[k] = cur + add;
    }
    if (ch.type) out.type = ch.type;
    if (ch.weight) out.weight = ch.weight;
    if (ch.cost) out.cost = ch.cost;
  }
  return out;
}

/* ----------------------- Bucketing labels ----------------------- */
function bucketOf(v) {
  const label = (v?.name || v?.label || v?.title || "").toLowerCase().trim();
  if (/^\+\d|^\+n\b/.test(label)) return "bonus";
  if (/^(adamantine|mithral|mithril|silver|silvered|cold iron)\b/.test(label)) return "material";
  return "other";
}

/* ---------------------- Name composition ------------------------ */
// Compose using order: Material → +N → Base → "of X and Y" (join rule requested)
function composeNameWithSlots(baseName, { material, bonus, bonusValue, otherA, otherB }) {
  const pre = [];
  const suffixes = [];

  const add = (x) => {
    if (!x) return;
    let lbl = normalizeVariantLabel(x.name || x.label || x.title || "");
    if (!lbl) return;

    // Replace +N placeholder with chosen value
    if (/^\+n\b/i.test(lbl) && bonusValue) lbl = `+${bonusValue}`;

    if (/^\+\d/.test(lbl)) pre.push(lbl);
    else if (bucketOf(x) === "material") pre.unshift(lbl);
    else if (/^of\s+/i.test(lbl)) suffixes.push(lbl.replace(/^of\s+/i, "").trim());
    else suffixes.push(lbl); // conservative → suffix content
  };

  add(material);
  add(bonus);
  add(otherA);
  add(otherB);

  const left = pre.length ? pre.join(" ") + " " : "";
  let right = "";
  if (suffixes.length) {
    // "of A and B" (and C...) — per your rule: second 'of' becomes 'and'
    const first = suffixes[0];
    const rest = suffixes.slice(1);
    right = ` of ${first}${rest.length ? " and " + rest.join(" and ") : ""}`;
  }

  return `${left}${baseName}${right}`.replace(/\s+/g, " ").trim();
}

/* ----------------------- Text resolution ------------------------ */
function resolveVariantText(v, kind, bonusValue) {
  if (!v) return "";
  // Prefer kind-specific text if present
  if (v.textByKind && kind && v.textByKind[kind]) {
    return String(v.textByKind[kind]).replace(/\{N\}/g, String(bonusValue ?? "N"));
  }
  if (v.text) {
    return String(v.text).replace(/\{N\}/g, String(bonusValue ?? "N"));
  }
  const entries = v.entries || v.inherits?.entries;
  return flattenEntries(entries).replace(/\{N\}/g, String(bonusValue ?? "N"));
}

/* --------------------------- UI --------------------------------- */
export default function MagicVariantBuilder({
  open,
  onClose,
  baseItem,
  allItems,       // NEW: list of items to populate base dropdown
  onBuild,
}) {
  /* Load catalog */
  const [catalog, setCatalog] = useState([]);
  useEffect(() => {
    if (!open) return;
    let die = false;
    (async () => {
      try {
        const res = await fetch("/items/magicvariants.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rawList = collectVariants(data);
        const massaged = massageCatalog(rawList);
        if (!die) setCatalog(massaged);
      } catch (e) {
        console.error("Failed to load magicvariants.json", e);
        if (!die) setCatalog([]);
      }
    })();
    return () => { die = true; };
  }, [open]);

  /* Category (explicit selection per your UX) */
  const initialKind = useMemo(() => {
    const k = guessKind(baseItem);
    if (k === "any") return "weapon"; // sensible default
    // map armor vs shield: guessKind returns "armor" for armor or shield; split using baseItem type if possible
    const raw = String(baseItem?.type || baseItem?.item_type || "").toUpperCase();
    if (k === "armor" && raw === "S") return "shield";
    return k;
  }, [baseItem]);
  const [category, setCategory] = useState(initialKind || "weapon");
  useEffect(() => { if (open) setCategory(initialKind || "weapon"); }, [open, initialKind]);

  /* Base item selection (mundane only for the category) */
  const isMundane = (i) => String(i.rarity || i.item_rarity || "").toLowerCase() === "none";
  const baseList = useMemo(() => {
    const items = Array.isArray(allItems) ? allItems : [];
    return items
      .filter(isMundane)
      .filter((i) => {
        const t = i.__cls?.uiType || i.uiType;
        if (category === "weapon") return t === "Melee Weapon" || t === "Ranged Weapon";
        if (category === "armor")  return t === "Armor";
        if (category === "shield") return t === "Shield";
        if (category === "ammunition") return t === "Ammunition";
        return false;
      })
      .sort((a, b) => (a.name || a.item_name || "").localeCompare(b.name || b.item_name || ""));
  }, [allItems, category]);

  const [baseId, setBaseId] = useState(null);
  useEffect(() => {
    // Default to currently selected baseItem if it fits; else first option
    const currentKey = baseItem?.id || baseItem?.item_id || baseItem?.name || baseItem?.item_name || null;
    const fits = currentKey && baseList.some(i => (i.id || i.item_id || i.name || i.item_name) === currentKey);
    setBaseId(fits ? currentKey : (baseList[0]?.id || baseList[0]?.item_id || baseList[0]?.name || baseList[0]?.item_name || null));
  }, [baseItem, baseList]);

  const baseObj = useMemo(() => baseList.find(i => (i.id || i.item_id || i.name || i.item_name) === baseId) || null, [baseList, baseId]);

  /* Filter variants to the category */
  const kindForFilter = category || "any";
  const filtered = useMemo(() => {
    return catalog.filter(v => {
      const k = v?._kind || "any";
      if (kindForFilter === "any") return true;
      if (k === "any") return true;
      // Shields are a subset of armor in many sources—treat explicitly
      if (kindForFilter === "shield") return k === "shield";
      return k === kindForFilter;
    }).sort((a,b) => (a.name || "").localeCompare(b.name || ""));
  }, [catalog, kindForFilter]);

  /* Variant slots */
  const materials = useMemo(() => filtered.filter(v => bucketOf(v) === "material"), [filtered]);
  const bonuses   = useMemo(() => filtered.filter(v => bucketOf(v) === "bonus"), [filtered]);
  const others    = useMemo(() => filtered.filter(v => bucketOf(v) === "other"), [filtered]);

  const [materialKey, setMaterialKey] = useState("");
  const [bonusKey, setBonusKey] = useState("");
  const [bonusValue, setBonusValue] = useState(1);
  const [otherAKey, setOtherAKey] = useState("");
  const [otherBKey, setOtherBKey] = useState("");

  useEffect(() => {
    // reset picks on open/category change
    if (!open) return;
    setMaterialKey(""); setBonusKey(""); setBonusValue(1); setOtherAKey(""); setOtherBKey("");
  }, [open, category]);

  const byKey = (arr) => new Map(arr.map(v => [String(v.key || v.id || v.name), v]));
  const matMap = useMemo(() => byKey(materials), [materials]);
  const bonMap = useMemo(() => byKey(bonuses), [bonuses]);
  const othMap = useMemo(() => byKey(others), [others]);

  const material = materialKey ? matMap.get(materialKey) : null;
  const bonus = bonusKey ? bonMap.get(bonusKey) : null;
  const otherA = otherAKey ? othMap.get(otherAKey) : null;
  const otherB = otherBKey ? othMap.get(otherBKey) : null;

  // If selected bonus has options, clamp bonusValue to them; else ensure +N literal works
  const bonusOptions = useMemo(() => {
    if (!bonus) return null;
    if (Array.isArray(bonus.options) && bonus.options.length) return bonus.options;
    // Fallback: infer from name "+3" etc.
    const m = /^\+(\d+)/.exec(bonus.name || "");
    return m ? [Number(m[1])] : null;
  }, [bonus]);

  useEffect(() => {
    if (!bonusOptions) return;
    if (!bonusOptions.includes(bonusValue)) {
      // default to highest option by your earlier preference
      setBonusValue(Math.max(...bonusOptions));
    }
  }, [bonusOptions, bonusValue]);

  /* Live preview */
  const baseName = baseObj ? (baseObj.name || baseObj.item_name || "Unnamed") : "Unnamed";
  const composedName = composeNameWithSlots(baseName, { material, bonus, bonusValue, otherA, otherB });

  const baseR = baseObj ? (baseObj.rarity || baseObj.item_rarity) : "none";
  const partR_bonus = bonus ? (bonus.rarityByValue ? bonus.rarityByValue[String(bonusValue)] : bonus.rarity) : null;
  const rarity = bestRarity(baseR, material?.rarity, partR_bonus, otherA?.rarity, otherB?.rarity);

  const descPieces = [
    baseObj ? (baseObj.description || baseObj.item_description || "") : "",
    resolveVariantText(material, kindForFilter, null),
    resolveVariantText(bonus, kindForFilter, bonusValue),
    resolveVariantText(otherA, kindForFilter, null),
    resolveVariantText(otherB, kindForFilter, null),
  ].map(norm).filter(Boolean);
  const description = descPieces.join("\n\n");

  /* Build output */
  function buildVariant() {
    if (!baseObj) return;

    const normalizedBase = {
      id: baseObj.id || baseObj.item_id || null,
      name: baseName,
      type: baseObj.type || baseObj.item_type || "",
      rarity: baseR || "",
      description: baseObj.description || baseObj.item_description || "",
      weight: baseObj.weight || baseObj.item_weight || "",
      cost: baseObj.cost || baseObj.item_cost || "",
    };

    const parts = [material, bonus, otherA, otherB].filter(Boolean).map(p => {
      // Store the chosen +N so downstream could inspect it if they want
      if (p === bonus && bonusOptions) return { ...p, __N: bonusValue };
      return p;
    });

    const merged = applyStructuredChanges(normalizedBase, parts);

    // Stable-ish item_id
    const idParts = parts.map((p) => {
      const base = p?.key || p?.id || p?.name || "";
      if (p === bonus && bonusOptions) return `${base}(+${bonusValue})`;
      return base;
    }).filter(Boolean).join("+");

    const item_id = `${(normalizedBase.id || normalizedBase.name).replace(/\s+/g, "_")}::VAR::${idParts || "custom"}`;

    const out = {
      ...merged,
      id: item_id,
      item_id,
      name: composedName,
      item_name: composedName,
      rarity,
      item_rarity: rarity,
      description,
      item_description: description,
      __isVariant: true,
      __variantParts: parts.map(p => p?.key || p?.id || p?.name).filter(Boolean),
    };

    onBuild?.(out);
  }

  if (!open) return null;

  return (
    <div className="modal d-block variant-modal" tabIndex="-1" style={{ background: "rgba(0,0,0,.6)" }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content bg-dark text-light border-secondary">
          <div className="modal-header border-secondary">
            <h5 className="modal-title">Build Magic Variant</h5>
            <button className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
          </div>

          <div className="modal-body">
            {/* Category pills */}
            <div className="mb-3 d-flex gap-2 flex-wrap">
              {["weapon","armor","shield","ammunition"].map(k => (
                <button
                  key={k}
                  className={`btn btn-sm ${category===k ? "btn-primary" : "btn-outline-light"} rounded-pill`}
                  onClick={() => setCategory(k)}
                >
                  {title(k)}
                </button>
              ))}
            </div>

            {/* Base item picker */}
            <div className="row g-2 align-items-end mb-3">
              <div className="col-12 col-md-8">
                <label className="form-label">Base {title(category)} (mundane)</label>
                <select className="form-select"
                        value={baseId || ""}
                        onChange={(e)=>setBaseId(e.target.value)}>
                  {baseList.map((i) => {
                    const key = i.id || i.item_id || i.name || i.item_name;
                    const label = i.name || i.item_name || key;
                    return <option key={key} value={key}>{label}</option>;
                  })}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label">Current Rarity</label>
                <input className="form-control" value={String(baseR || "").trim() || "none"} readOnly />
              </div>
            </div>

            {/* Variant slots */}
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label className="form-label">Material (optional)</label>
                <select className="form-select"
                        value={materialKey}
                        onChange={(e)=>setMaterialKey(e.target.value)}>
                  <option value="">— None —</option>
                  {materials.map(v => {
                    const key = String(v.key || v.id || v.name);
                    return <option key={key} value={key}>{normalizeVariantLabel(v.name)}</option>;
                  })}
                </select>
              </div>

              <div className="col-8 col-md-4">
                <label className="form-label">Bonus (optional)</label>
                <select className="form-select"
                        value={bonusKey}
                        onChange={(e)=>setBonusKey(e.target.value)}>
                  <option value="">— None —</option>
                  {bonuses.map(v => {
                    const key = String(v.key || v.id || v.name);
                    // show +N plainly
                    let lbl = normalizeVariantLabel(v.name);
                    if (/^\+n\b/i.test(lbl)) lbl = "+N";
                    return <option key={key} value={key}>{lbl}</option>;
                  })}
                </select>
              </div>

              <div className="col-4 col-md-2">
                <label className="form-label">Value</label>
                <select className="form-select"
                        value={bonusValue}
                        onChange={(e)=>setBonusValue(Number(e.target.value))}
                        disabled={!bonus || !bonusOptions || bonusOptions.length < 2}>
                  {(bonusOptions || [bonusValue]).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label">Other A (optional)</label>
                <select className="form-select"
                        value={otherAKey}
                        onChange={(e)=>setOtherAKey(e.target.value)}>
                  <option value="">— None —</option>
                  {others.map(v => {
                    const key = String(v.key || v.id || v.name);
                    return <option key={key} value={key}>{normalizeVariantLabel(v.name)}</option>;
                  })}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label">Other B (optional)</label>
                <select className="form-select"
                        value={otherBKey}
                        onChange={(e)=>setOtherBKey(e.target.value)}>
                  <option value="">— None —</option>
                  {others.map(v => {
                    const key = String(v.key || v.id || v.name);
                    return <option key={key} value={key}>{normalizeVariantLabel(v.name)}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* Live Preview */}
            <div className="card bg-black border-secondary mt-3">
              <div className="card-header border-secondary">Preview</div>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="fw-bold">{composedName}</div>
                  <span className="badge bg-secondary">{title(rarity || "none")}</span>
                </div>
                <div className="small text-muted mt-2" style={{ whiteSpace: "pre-wrap" }}>
                  {description || "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer border-secondary">
            <button className="btn btn-outline-light" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!baseObj} onClick={buildVariant}>
              Build Variant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

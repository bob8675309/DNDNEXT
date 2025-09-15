// components/MagicVariantBuilder.js
import React, { useEffect, useMemo, useState } from "react";
import { titleCase } from "../utils/itemsIndex";

/** ---------- tiny helpers ---------- */
const norm = (s = "") => String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[‐–—-]+/g, "-")
  .replace(/\s+/g, " ").trim().toLowerCase();

const RANK = { common:1, mundane:1, uncommon:2, rare:3, "very rare":4, legendary:5, artifact:6 };

function bestRarity(list = []) {
  const r = list.filter(Boolean).map((x)=>String(x).toLowerCase());
  if (!r.length) return null;
  let best = "common", br = 0;
  for (const rr of r) {
    const k = rr in RANK ? rr : rr.replace(/\s+/g," ");
    const rank = RANK[k] || 0;
    if (rank > br) { br = rank; best = rr; }
  }
  return titleCase(best);
}

function rarityFromEnhancement(val, map = {}) {
  const m = map || {};
  const rr = m?.[String(val)];
  return rr ? titleCase(rr) : null;
}

function stripTypeWord(label, kind) {
  // "Silvered Weapon" -> "Silvered", "Mithral Armor" -> "Mithral Armor" (keep)
  const t = {
    weapon: /( weapon\b)/i,
    armor: /( armor\b)/i,
    shield: /( shield\b)/i,
    ammunition: /( ammunition\b| ammo\b)/i
  }[kind] || /( weapon| armor| shield| ammunition)\b/i;
  return String(label || "").replace(t, "");
}

function suffixize(v, kind) {
  // Prefer explicit nameSuffix if provided; else:
  const name = v?.name || "";
  if (v?.nameSuffix) return v.nameSuffix.replace(/\{kind\}/gi, titleCase(kind));
  if (/^\s*of\s+/i.test(name)) return name; // already "of X"
  // e.g. "Dancing", "Vorpal" → "of Dancing"
  return `of ${name}`.replace(/\b(of of)\b/i, "of");
}

function commaJoinWithAnd(parts) {
  // A -> "A"; [A,B] -> "A and B"; [A,B,C] -> "A, B, and C"
  const p = parts.filter(Boolean);
  if (p.length <= 1) return p.join("");
  if (p.length === 2) return `${p[0]} and ${p[1]}`;
  return `${p.slice(0, -1).join(", ")}, and ${p[p.length - 1]}`;
}

/** ---------- loader supports canonical and legacy shapes ---------- */
async function loadCatalog() {
  // Prefer canonical
  const tryOne = async (url) => {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch {}
    return null;
  };
  let j = await tryOne("/items/magicvariants.json");
  if (!j) j = await tryOne("/items/magicvariants.canonical.json");
  return j || { variants: [] };
}

function coerceToCanonical(j) {
  // If already canonical (has "variants" array of slot/appliesTo), return as-is.
  if (j && Array.isArray(j.variants)) return j;

  // Legacy fallback: flatten anything that looks like a variant-like object.
  const out = [];
  const looks = (v) =>
    v && typeof v === "object" && (v.name || v.bonusWeapon || v.bonusAc || v.entries || v.item_description);

  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node === "object") {
      if (looks(node)) out.push(node);
      else for (const v of Object.values(node)) walk(v);
    }
  };
  walk(j);

  // Coarse grouping heuristic for legacy:
  const canon = [];
  for (const v of out) {
    const name = String(v.name || "").trim();
    const lower = name.toLowerCase();
    const entryText = (Array.isArray(v.entries) ? v.entries.join("\n\n") : v.entries) || v.item_description || "";
    // Try to infer a slot/kind
    let slot = "other";
    if (/adamantine/i.test(name)) slot = "material";
    if (/silver/i.test(name) && /weapon|ammun/i.test(name)) slot = "material";
    if (/^\+1|^\+2|^\+3/.test(name)) slot = "bonus";
    canon.push({
      key: norm(name),
      name,
      slot,
      rarity: v.rarity ? String(v.rarity).toLowerCase() : undefined,
      appliesTo: ["weapon","armor","shield","ammunition"], // best-effort
      textByKind: { weapon: entryText, armor: entryText, shield: entryText, ammunition: entryText }
    });
  }
  return { variants: canon };
}

/** Deduplicate + filter by slot/kind */
function uniqueByLabel(list) {
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const k = norm(x.label);
    if (seen.has(k)) continue;
    seen.add(k); out.push(x);
  }
  return out;
}

export default function MagicVariantBuilder({
  open = false,
  onClose = () => {},
  baseItem = null,
  allItems = [],
  onBuild = () => {}
}) {
  const [kind, setKind] = useState("weapon"); // weapon | armor | shield | ammunition
  const [catalog, setCatalog] = useState({ variants: [] });

  // Selected base + slot picks
  const [baseKey, setBaseKey] = useState("");
  const [selMaterial, setSelMaterial] = useState(null);
  const [selBonusKey, setSelBonusKey] = useState(""); // enhancement key
  const [selBonusValue, setSelBonusValue] = useState(1);
  const [selA, setSelA] = useState(null);
  const [selB, setSelB] = useState(null);

  // derive initial kind from baseItem
  useEffect(() => {
    if (!open) return;
    // infer kind from baseItem classification-ish fields
    const raw = (baseItem?.type || baseItem?.item_type || "").split("|")[0];
    const ui = (baseItem?.__cls?.uiType) || "";
    let k = "weapon";
    if (ui === "Armor") k = "armor";
    else if (ui === "Shield") k = "shield";
    else if (ui === "Ammunition") k = "ammunition";
    else if (ui === "Melee Weapon" || ui === "Ranged Weapon") k = "weapon";
    else if (/^(LA|MA|HA)$/.test(raw)) k = "armor";
    else if (/^S$/.test(raw)) k = "shield";
    else if (/^A$/.test(raw)) k = "ammunition";
    setKind(k);
  }, [open, baseItem]);

  // load/normalize catalog
  useEffect(() => {
    if (!open) return;
    let dead = false;
    (async () => {
      const raw = await loadCatalog();
      const canon = coerceToCanonical(raw);
      if (!dead) setCatalog(canon);
    })();
    return () => { dead = true; };
  }, [open]);

  // Filter allItems -> mundane + by kind
  const mundaneByKind = useMemo(() => {
    const isMundane = (it) => String(it.rarity || it.item_rarity || "").toLowerCase() === "none";
    const byKind = (it) => {
      const ui = it.__cls?.uiType || "";
      if (kind === "weapon") return ui === "Melee Weapon" || ui === "Ranged Weapon";
      if (kind === "armor") return ui === "Armor";
      if (kind === "shield") return ui === "Shield";
      if (kind === "ammunition") return ui === "Ammunition";
      return false;
    };
    return (allItems || []).filter((it) => isMundane(it) && byKind(it));
  }, [allItems, kind]);

  // pick a sensible default base when kind changes
  useEffect(() => {
    if (!mundaneByKind.length) return;
    const b = baseItem && mundaneByKind.find((it) => (it.name || it.item_name) === (baseItem.name || baseItem.item_name));
    setBaseKey(b ? (b.id || b.name || b.item_name) : (mundaneByKind[0].id || mundaneByKind[0].name || mundaneByKind[0].item_name));
  }, [mundaneByKind, baseItem]);

  const baseSel = useMemo(() => mundaneByKind.find((it) => String(it.id || it.name || it.item_name) === String(baseKey)) || mundaneByKind[0], [mundaneByKind, baseKey]);

  /** Build option buckets */
  const buckets = useMemo(() => {
    const v = Array.isArray(catalog?.variants) ? catalog.variants : [];
    const forKind = v.filter((x) => !x.appliesTo || x.appliesTo.includes(kind));

    const materials = [];
    const bonus = [];    // only the "+N" enhancement
    const others = [];

    for (const x of forKind) {
      const slot = x.slot || "other";
      const label = String(x.name || x.key || "Unnamed").trim();
      const entry = {
        key: x.key || norm(label),
        label,
        slot,
        rarity: x.rarity ? titleCase(x.rarity) : null,
        rarityByValue: x.rarityByValue || null,
        options: Array.isArray(x.options) ? x.options.slice() : null,
        textByKind: x.textByKind || {},
        nameSuffix: x.nameSuffix || null,
      };
      if (slot === "material") materials.push(entry);
      else if (slot === "bonus" && /^(\+|plus|enhancement)/i.test(label) || entry.key === "enhancement") { bonus.push(entry); }
      else others.push(entry);
    }

    // Dedup + sort
    const byAlpha = (a,b) => a.label.localeCompare(b.label, undefined, { sensitivity:"base" });
    return {
      materials: uniqueByLabel(materials).sort(byAlpha),
      bonus: uniqueByLabel(bonus).sort(byAlpha),
      others: uniqueByLabel(others).sort(byAlpha),
    };
  }, [catalog, kind]);

  // Ensure bonus selection points at the enhancement entry if present
  useEffect(() => {
    const enh = buckets.bonus.find((b) => b.key === "enhancement" || /^\+?n$/i.test(b.label.replace(/\s+/g,"")));
    setSelBonusKey(enh ? enh.key : "");
    setSelBonusValue((prev) => Math.min(Math.max(1, prev || 1), 3));
  }, [buckets]);

  /** Pretty description of each chosen slot */
  const descMaterial = useMemo(() => selMaterial?.textByKind?.[kind] || "", [selMaterial, kind]);
  const descBonus = useMemo(() => {
    if (!selBonusKey) return "";
    const b = buckets.bonus.find((x)=>x.key===selBonusKey);
    if (!b) return "";
    const raw = b.textByKind?.[kind] || "";
    return raw.replace(/\{N\}/g, String(selBonusValue));
  }, [selBonusKey, selBonusValue, buckets, kind]);
  const descA = useMemo(() => selA?.textByKind?.[kind] || "", [selA, kind]);
  const descB = useMemo(() => selB?.textByKind?.[kind] || "", [selB, kind]);

  /** Compose preview name + rarity + rules */
  const composed = useMemo(() => {
    if (!baseSel) return null;
    const baseName = baseSel.item_name || baseSel.name || "Item";

    const prefixes = [];
    if (selMaterial) prefixes.push(stripTypeWord(selMaterial.label, kind).trim());
    if (selBonusKey) prefixes.push(`+${selBonusValue}`);

    const suffixes = [];
    if (selA) suffixes.push(suffixize(selA, kind).replace(/\bof\s+weapon\b/i, "of " + titleCase(kind)));
    if (selB) suffixes.push(suffixize(selB, kind).replace(/\bof\s+weapon\b/i, "of " + titleCase(kind)));

    const prefix = prefixes.filter(Boolean).join(" ");
    const suffixPart = suffixes.length
      ? (" of " + commaJoinWithAnd(suffixes.map(s => s.replace(/^\s*of\s+/i, "").trim())))
      : "";

    const finalName = [prefix, titleCase(baseName)].filter(Boolean).join(" ").trim() + suffixPart;

    // rarity
    const rList = [];
    const baseR = String(baseSel.rarity || baseSel.item_rarity || "").toLowerCase();
    if (baseR && baseR !== "none") rList.push(baseR);
    if (selMaterial?.rarity) rList.push(selMaterial.rarity);
    if (selA?.rarity) rList.push(selA.rarity);
    if (selB?.rarity) rList.push(selB.rarity);
    if (selBonusKey) {
      const enh = buckets.bonus.find((x)=>x.key===selBonusKey);
      const rB = rarityFromEnhancement(selBonusValue, enh?.rarityByValue);
      if (rB) rList.push(rB);
    }
    const finalRarity = bestRarity(rList) || "Uncommon";

    // rules text
    const sections = [];
    if (descMaterial) sections.push(descMaterial);
    if (descBonus) sections.push(descBonus);
    if (descA) sections.push(descA);
    if (descB) sections.push(descB);

    return { name: finalName, rarity: finalRarity, rules: sections.join("\n\n") };
  }, [baseSel, selMaterial, selBonusKey, selBonusValue, selA, selB, buckets, kind, descMaterial, descBonus, descA, descB]);

  /** Build object for Assign flow */
  function handleBuild() {
    if (!baseSel || !composed) return;

    const item = {
      // identity
      id: `VAR-${Date.now()}`,
      source: "Custom",
      image_url: baseSel.image_url || baseSel.img || baseSel.image || "/placeholder.png",
      // names
      name: composed.name,
      item_name: composed.name,
      // type/kind (inherit from base)
      type: baseSel.type || baseSel.item_type || "",
      item_type: baseSel.item_type || baseSel.type || "",
      // rarity + write rules to description
      rarity: composed.rarity.toLowerCase(),
      item_rarity: composed.rarity.toLowerCase(),
      item_description: composed.rules,
      entries: [composed.rules],
      // keep base stats around (weight/cost/etc) — easy to extend later
      item_weight: baseSel.item_weight ?? baseSel.weight ?? null,
      item_cost: baseSel.item_cost ?? baseSel.cost ?? baseSel.value ?? null,
    };

    onBuild(item);
  }

  if (!open) return null;

  return (
    <div className="modal d-block variant-modal" tabIndex="-1" style={{ background: "rgba(0,0,0,.6)" }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content border border-secondary text-white">
          <div className="modal-header border-secondary">
            <h5 className="modal-title">Build Magic Variant</h5>
            <button className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
          </div>

          <div className="modal-body">
            {/* Kind pills */}
            <div className="d-flex gap-2 mb-3">
              {["weapon","armor","shield","ammunition"].map(k => (
                <button
                  key={k}
                  type="button"
                  className={`btn btn-sm ${kind===k ? "btn-light text-dark" : "btn-outline-light"}`}
                  onClick={() => setKind(k)}
                >
                  {titleCase(k)}
                </button>
              ))}
            </div>

            {/* Top row: base + current rarity */}
            <div className="row g-2 align-items-end mb-2">
              <div className="col-12 col-lg-6">
                <label className="form-label fw-semibold">Base {titleCase(kind)} (mundane)</label>
                <select
                  className="form-select text-white"
                  value={baseKey}
                  onChange={(e)=>setBaseKey(e.target.value)}
                >
                  {mundaneByKind.map(it => {
                    const name = it.item_name || it.name;
                    return <option key={it.id || name} value={it.id || name}>{name}</option>;
                  })}
                </select>
              </div>
              <div className="col-6 col-lg-3">
                <label className="form-label fw-semibold">Current Rarity</label>
                <div className="form-control text-white">{composed?.rarity || "—"}</div>
              </div>
            </div>

            {/* Row 2: Material + Bonus */}
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-6 col-lg-6">
                <label className="form-label fw-semibold">Material (optional)</label>
                <select
                  className="form-select text-white"
                  value={selMaterial?.key || ""}
                  onChange={(e)=>{
                    const v = buckets.materials.find(x=>x.key===e.target.value) || null;
                    setSelMaterial(v);
                  }}
                >
                  <option value="">— none —</option>
                  {buckets.materials.map(o => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
                {descMaterial && <div className="small mt-1">{descMaterial}</div>}
              </div>

              <div className="col-12 col-md-6 col-lg-6">
                <label className="form-label fw-semibold">Bonus (optional)</label>
                <div className="input-group">
                  <select
                    className="form-select text-white"
                    value={selBonusKey}
                    onChange={(e)=>setSelBonusKey(e.target.value)}
                  >
                    <option value="">— none —</option>
                    {buckets.bonus.map(o => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                  <span className="input-group-text">Value</span>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    max={(buckets.bonus.find(b=>b.key===selBonusKey)?.options?.slice(-1)[0]) || 3}
                    value={selBonusValue}
                    onChange={(e)=>setSelBonusValue(Number(e.target.value)||1)}
                  />
                </div>
                {descBonus && <div className="small mt-1">{descBonus}</div>}
              </div>
            </div>

            {/* Row 3: Others A/B */}
            <div className="row g-2 align-items-end mt-1">
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold">Other A (optional)</label>
                <select
                  className="form-select text-white"
                  value={selA?.key || ""}
                  onChange={(e)=>setSelA(buckets.others.find(x=>x.key===e.target.value) || null)}
                >
                  <option value="">— none —</option>
                  {buckets.others.map(o => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
                {descA && <div className="small mt-1">{descA}</div>}
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold">Other B (optional)</label>
                <select
                  className="form-select text-white"
                  value={selB?.key || ""}
                  onChange={(e)=>setSelB(buckets.others.find(x=>x.key===e.target.value) || null)}
                >
                  <option value="">— none —</option>
                  {buckets.others.map(o => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
                {descB && <div className="small mt-1">{descB}</div>}
              </div>
            </div>

            {/* Preview */}
            <div className="mt-3">
              <div className="fw-semibold mb-1">Preview</div>
              <div className="card bg-dark border-secondary text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <div className="fw-bold">{composed?.name || "—"}</div>
                    <div className="text-white-50 small">{composed?.rarity || ""}</div>
                  </div>
                  {composed?.rules ? (
                    <div className="mt-2" style={{ whiteSpace: "pre-line" }}>
                      {composed.rules}
                    </div>
                  ) : (
                    <div className="text-white-50 fst-italic">Select options to see the combined rules text.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer border-secondary">
            <button className="btn btn-outline-light" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleBuild} disabled={!baseSel}>Build Variant</button>
          </div>
        </div>
      </div>
    </div>
  );
}

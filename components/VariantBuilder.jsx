// components/VariantBuilder.jsx
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import ItemCard from "./ItemCard";

/* ----------------------- helpers & constants ----------------------- */
const RARITY_ORDER = ["common","uncommon","rare","very rare","legendary","artifact"];
const FUTURE_NAME_RE = /\b(antimatter|automatic|assault\s*rifle|sniper|carbine|pistol|rifle|revolver|shotgun|smg|submachine|laser|plasma|gauss|power(?:ed)?\s*armor)\b/i;
const isVestigeName = (n) => /\b(dormant|awakened|exalted)\b/i.test(n || "");
const isMundaneWeaponOrArmor = (it) => {
  if (!it || typeof it !== "object") return false;
  const r = String(it.rarity || "none").toLowerCase();
  if (r !== "none") return false;
  const t = String(it.uiType || it.type || "");
  return /weapon|armor|shield/i.test(t);
};
const isFutureThing = (it) => {
  const t = String(it.uiType || it.type || "");
  if (/future/i.test(t)) return true;
  return FUTURE_NAME_RE.test(String(it.name || ""));
};
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
const deepMerge = (target, patch) => {
  if (patch == null) return target;
  const out = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null) continue;
    const cur = out[k];
    if (Array.isArray(v)) out[k] = uniq([...(Array.isArray(cur) ? cur : []), ...v]);
    else if (typeof v === "object" && !Array.isArray(v)) out[k] = deepMerge(cur || {}, v);
    else out[k] = v;
  }
  return out;
};
const getRarityRank = (r) => {
  const i = RARITY_ORDER.indexOf(String(r || "").toLowerCase());
  return i === -1 ? -1 : i;
};
const pickMaxRarity = (a, b) => (getRarityRank(b) > getRarityRank(a) ? b : a);
const normBonus = (val) => {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const m = String(val).match(/[+-]?(\d+)/);
  return m ? Number(m[1]) : null;
};
function renderVariantName(baseName, variants) {
  const prefixes = [], suffixOf = [], extras = [];
  variants.forEach((v) => {
    if (!v) return;
    const nm = String(v.name || v.label || "").trim();
    if (v.nameTemplate) {
      let out = v.nameTemplate.replaceAll("{base}", baseName).replaceAll("{name}", nm);
      const b = normBonus(v.bonusWeapon || v.bonusAc || v.bonusSpellAttack);
      if (b != null) out = out.replaceAll("{bonus}", String(b));
      baseName = out;
      return;
    }
    if (/^\+\d/.test(nm)) prefixes.push(nm);
    else if (/\bof\b/i.test(nm)) suffixOf.push(nm.replace(/^[^o]*of\s+/i, "of "));
    else if (v.prefix) prefixes.push(v.prefix);
    else if (v.of) suffixOf.push("of " + v.of);
    else if (v.suffix) suffixOf.push(v.suffix.startsWith("of ") ? v.suffix : "of " + v.suffix);
    else extras.push(nm);
  });
  const pre = prefixes.concat(extras).join(" ").trim();
  const suf = suffixOf.join(" and ").trim();
  return [pre, baseName, suf].filter(Boolean).join(pre ? " " : "").replace(/\s+of\s+$/, "");
}
function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a);
  a.click(); a.remove(); URL.revokeObjectURL(url);
}
function composeItem(base, variantList, allItems) {
  if (!base) return null;
  const variants = variantList.filter(Boolean);
  const out = JSON.parse(JSON.stringify(base));
  out._composed = true;
  out.baseItem = base.baseItem || base.name;
  let accRarity = "common";
  variants.forEach((v) => (accRarity = pickMaxRarity(accRarity, v.rarity)));
  out.rarity = accRarity;

  variants.forEach((v) => {
    const generic = { ...(v.effects || {}), ...(v.delta || {}), ...(v.mod || {}), ...v };
    ["name","id","category","tags","source","page","prefix","suffix","of","nameTemplate","rarity"]
      .forEach((k) => delete generic[k]);

    // highest numeric bonuses win
    ["bonusWeapon","bonusAc","bonusShield","bonusSpellAttack","bonusSpellSaveDc"].forEach((k) => {
      const curN = normBonus(out[k]);
      const nextN = normBonus(v[k] ?? generic[k]);
      if (nextN != null && (curN == null || nextN > curN)) out[k] = `+${nextN}`;
      delete generic[k];
    });

    // union arrays (common D&D keys)
    ["property","resist","conditionImmune","miscTags","mastery"].forEach((k) => {
      const cur = Array.isArray(out[k]) ? out[k] : [];
      const nxt = Array.isArray(v[k]) ? v[k] : [];
      out[k] = uniq([...cur, ...nxt]);
      delete generic[k];
    });

    // fold text into entries + item_description
    const entryBits = [];
    if (v.entries?.length) entryBits.push(...v.entries);
    if (typeof v.item_description === "string") entryBits.push(v.item_description);
    if (entryBits.length) {
      out.entries = [...(out.entries || []), ...entryBits];
      out.item_description = [
        ...(Array.isArray(out.item_description) ? out.item_description : [out.item_description].filter(Boolean)),
        ...entryBits,
      ].join("\n\n");
    }

    Object.assign(out, deepMerge(out, generic));
  });

  out.name = renderVariantName(base.name, variants);

  // flag if you landed on a canon magic item
  if (allItems?.length) {
    const canon = allItems.find((x) => String(x.name).toLowerCase() === out.name.toLowerCase());
    if (canon && String(canon.rarity || "none").toLowerCase() !== "none") {
      out._matchesCanon = true;
      out._canonSource = `${canon.source || ""}${canon.page ? ` p.${canon.page}` : ""}`.trim();
    }
  }

  if (variants.length > 0 && out.rarity === "none") out.rarity = "uncommon";
  return out;
}

// flatten text for tooltips
function flattenText(entries) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === "string") { out.push(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.entries) { walk(node.entries); return; }
    if (node.items) { walk(node.items); return; }
    if (node.entry) { walk(node.entry); return; }
    if (node.name && node.entries) { out.push(`${node.name}. ${[].concat(node.entries).join(" ")}`); return; }
    if (node.name && node.entry) { out.push(`${node.name}. ${[].concat(node.entry).join(" ")}`); return; }
  };
  walk(entries);
  return out.join(" ");
}
const summarize = (v) => {
  let s = "";
  if (Array.isArray(v?.entries)) s = flattenText(v.entries);
  else if (typeof v?.item_description === "string") s = v.item_description;
  s = String(s).replace(/\{@[^}]+\}/g, "").replace(/\s+/g, " ").trim();
  return s.length > 260 ? s.slice(0, 260) + "…" : s;
};

/* ----------------------------- UI bits ----------------------------- */
function SearchList({ items, onSelect, placeholder = "Search..." }) {
  const [q, setQ] = useState("");
  const [tip, setTip] = useState({ show: false, text: "", x: 0, y: 0 });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((it) => it.label.toLowerCase().includes(s)) : items;
  }, [q, items]);

  return (
    <div className="card h-100">
      <div className="card-header fw-bold small">{placeholder}</div>
      <div className="card-body d-flex flex-column">
        <input
          type="text"
          className="form-control mb-2"
          placeholder="Type to filter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="overflow-auto border rounded p-2" style={{ maxHeight: "18rem" }}>
          {filtered.map((it) => (
            <button
              key={it.id}
              type="button"
              className="btn btn-sm btn-outline-light w-100 text-start mb-1"
              onClick={() => onSelect(it)}
              onMouseEnter={(e) => setTip({ show: !!it.hint, text: it.hint || "", x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setTip((t) => ({ ...t, x: e.clientX, y: e.clientY }))}
              onMouseLeave={() => setTip({ show: false, text: "", x: 0, y: 0 })}
              title={it.hint || it.label}
            >
              <strong>{it.label}</strong> {it.sub && <small className="text-muted">— {it.sub}</small>}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-muted small text-center py-2">No matches</div>
          )}
        </div>
      </div>

      {/* floating tooltip (fixed; won't get clipped by scrollers) */}
      {tip.show && (
        <div
          className="vb-tip"
          style={{ left: tip.x + 14, top: tip.y + 16 }}
        >
          {tip.text}
        </div>
      )}

      <style jsx>{`
        .vb-tip {
          position: fixed;
          max-width: min(420px, 70vw);
          z-index: 9999;
          background: rgba(20, 16, 29, 0.98);
          color: #fff;
          border: 1px solid #4c3f6b;
          padding: .5rem .65rem;
          border-radius: .5rem;
          box-shadow: 0 8px 24px rgba(0,0,0,.45);
          font-size: .9rem;
          line-height: 1.25rem;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
function Pill({ children }) {
  return <span className="badge bg-secondary rounded-pill me-1">{children}</span>;
}

/* -------------------------- main component ------------------------- */
export default function VariantBuilder({ allItems, magicVariants, onApply }) {
  allItems = allItems || (typeof window !== "undefined" ? window.__ALL_ITEMS__ : []) || [];
  magicVariants = magicVariants || (typeof window !== "undefined" ? window.__MAGIC_VARIANTS__ : []) || [];

  // Bases: mundane weapon/armor/shield, no vestige states, no future tech/power armor
  const bases = useMemo(() => (
    allItems
      .filter(isMundaneWeaponOrArmor)
      .filter((b) => !isVestigeName(b.name))
      .filter((b) => !isFutureThing(b))
      .map((b, i) => ({
        id: `b-${i}`,
        raw: b,
        label: b.name,
        sub: b.uiType || b.type || "",
        hint: b.propertiesText || "",
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ), [allItems]);

  // Variants: drop vestige states & duplicates (case-insensitive by name). Add tooltip text.
  const variants = useMemo(() => {
    const arr = (magicVariants || [])
      .filter((v) => v && (v.name || v.label) && !isVestigeName(v.name))
      .map((v, i) => ({
        id: `v-${i}`,
        raw: v,
        label: v.name || v.label,
        sub: v.rarity || "",
        hint: summarize(v),
      }));
    const seen = new Set();
    const deduped = [];
    for (const it of arr) {
      const k = String(it.label).trim().toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(it);
    }
    deduped.sort((a, b) => a.label.localeCompare(b.label));
    return deduped;
  }, [magicVariants]);

  const [selectedBase, setSelectedBase] = useState(null);
  const [selectedVariants, setSelectedVariants] = useState([]);

  const composed = useMemo(
    () => composeItem(selectedBase?.raw, selectedVariants, allItems),
    [selectedBase, selectedVariants, allItems]
  );

  const addVariant = (v) => {
    if (!v?.raw) return;
    if (selectedVariants.length >= 4) return;
    setSelectedVariants((prev) => (prev.find((x) => x.name === v.raw.name) ? prev : [...prev, v.raw]));
  };
  const removeVariant = (name) => setSelectedVariants((prev) => prev.filter((x) => x.name !== name));
  const clearAll = () => setSelectedVariants([]);

  /* ------------------------------ render ---------------------------- */
  return (
    <div className="container-fluid py-3">
      <div className="row g-3">
        <div className="col-lg-4">
          <SearchList items={bases} onSelect={setSelectedBase} placeholder="Choose base (weapon/armor)" />
        </div>

        <div className="col-lg-4">
          <SearchList items={variants} onSelect={addVariant} placeholder="Add up to 4 variants" />
          <div className="mt-2">
            {selectedVariants.map((v) => (
              <motion.div layout key={v.name} className="d-inline-block me-2 mb-2">
                <span className="badge bg-light text-dark border">
                  {v.name}
                  <button
                    type="button"
                    className="btn-close btn-close-sm ms-2"
                    onClick={() => removeVariant(v.name)}
                  />
                </span>
              </motion.div>
            ))}
            {selectedVariants.length > 0 && (
              <button className="btn btn-sm btn-outline-secondary ms-2" onClick={clearAll}>
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header fw-bold small">Result</div>
            <div className="card-body">
              {!selectedBase && <div className="text-muted">Pick a base to begin.</div>}

              {selectedBase && (
                <>
                  {/* Real item preview (same card users see) */}
                  <div className="mb-3">
                    <ItemCard item={composed || selectedBase.raw} />
                  </div>

                  {composed?._matchesCanon && (
                    <div className="alert alert-warning mt-2 small">
                      Heads-up: this name matches a canon magic item ({composed._canonSource}).
                    </div>
                  )}

                  <div className="small text-uppercase text-muted mb-1">JSON</div>
                  <div className="border rounded bg-dark p-2 overflow-auto" style={{ maxHeight: "14rem" }}>
                    <pre className="small mb-0 text-light">{JSON.stringify(composed || selectedBase.raw, null, 2)}</pre>
                  </div>

                  <div className="d-flex gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() =>
                        downloadJSON(
                          `${(composed?.name || selectedBase.label).replace(/[^a-z0-9]+/gi, "-")}.json`,
                          composed || selectedBase.raw
                        )
                      }
                    >
                      Export JSON
                    </button>
                    {onApply && composed && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => onApply(composed)}
                      >
                        Use in Admin
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 small text-muted mt-2">
          <strong>Rules:</strong> Bases = mundane Weapon/Armor/Shield from <code>all-items.json</code>.{" "}
          Variants = <code>magicvariants.json</code> (no vestige states; duplicates removed). Arrays merged, numeric bonuses keep highest.
        </div>
      </div>
    </div>
  );
}

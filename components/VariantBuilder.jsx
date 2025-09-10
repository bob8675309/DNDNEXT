// components/VariantBuilder.jsx
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import ItemCard from "./ItemCard";

/* ----------------- helpers ----------------- */
const RARITY_ORDER = ["common","uncommon","rare","very rare","legendary","artifact"];
const getRarityRank = (r) => {
  const i = RARITY_ORDER.indexOf(String(r || "").toLowerCase());
  return i === -1 ? -1 : i;
};
const pickMaxRarity = (a, b) => (getRarityRank(b) > getRarityRank(a) ? b : a);

const isVestigeName = (n) => /\b(dormant|awakened|exalted)\b/i.test(n || "");

const isMundaneWeaponOrArmor = (it) => {
  if (!it || typeof it !== "object") return false;
  const r = String(it.rarity || "none").toLowerCase();
  if (r !== "none") return false;
  const t = String(it.uiType || it.type || "");
  return /weapon|armor|shield/i.test(t);
};

// ban obvious future-tech
const isFutureTech = (it) => {
  const n = String(it.name || "").toLowerCase();
  return /(antimatter|automatic|pistol|rifle|revolver|shotgun|grenade|bomb|power armor)/i.test(n);
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

function composeItem(base, variantList, allItems) {
  if (!base) return null;
  const variants = variantList.filter(Boolean);
  const out = JSON.parse(JSON.stringify(base));
  out._composed = true;
  out.baseItem = base.baseItem || base.name;

  // rarity: keep the highest
  let accRarity = "common";
  variants.forEach((v) => (accRarity = pickMaxRarity(accRarity, v.rarity)));
  out.rarity = accRarity;

  variants.forEach((v) => {
    const generic = { ...(v.effects || {}), ...(v.delta || {}), ...(v.mod || {}), ...v };
    ["name","id","category","tags","source","page","prefix","suffix","of","nameTemplate","rarity"]
      .forEach((k) => delete generic[k]);

    // numeric bonuses (take the max)
    ["bonusWeapon","bonusAc","bonusShield","bonusSpellAttack","bonusSpellSaveDc"].forEach((k) => {
      const curN = normBonus(out[k]);
      const nextN = normBonus(v[k] ?? generic[k]);
      if (nextN != null && (curN == null || nextN > curN)) out[k] = `+${nextN}`;
      delete generic[k];
    });

    // union arrays
    ["property","resist","conditionImmune","miscTags","mastery"].forEach((k) => {
      const cur = Array.isArray(out[k]) ? out[k] : [];
      const nxt = Array.isArray(v[k]) ? v[k] : [];
      out[k] = uniq([...cur, ...nxt]);
      delete generic[k];
    });

    // copy text into entries/description
    const entryBits = [];
    if (Array.isArray(v.entries) && v.entries.length) entryBits.push(...v.entries);
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

  // flag if we matched a canon magic item name
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

/* ----------- small reusable list (now supports hover) ----------- */
function SearchList({ items, onSelect, onHover, placeholder = "Search..." }) {
  const [q, setQ] = useState("");
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
              className="btn btn-sm w-100 text-start mb-1"
              onClick={() => onSelect?.(it)}
              onMouseEnter={() => onHover?.(it)}
              onMouseLeave={() => onHover?.(null)}
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
    </div>
  );
}

function Pill({ children }) {
  return <span className="badge bg-secondary rounded-pill me-1">{children}</span>;
}

/* ======================= MAIN ======================= */
export default function VariantBuilder({ allItems, magicVariants, onApply }) {
  allItems = allItems || (typeof window !== "undefined" ? window.__ALL_ITEMS__ : []) || [];
  magicVariants = magicVariants || (typeof window !== "undefined" ? window.__MAGIC_VARIANTS__ : []) || [];

  /* ----- base-kind pill toggle ----- */
  const [baseKind, setBaseKind] = useState("weapon"); // "weapon" | "armor"
  const isArmor = (x) => /armor|shield/i.test(String(x.raw?.uiType || x.raw?.type || ""));
  const isWeapon = (x) => /weapon/i.test(String(x.raw?.uiType || x.raw?.type || ""));

  /* ----- bases (mundane only, no future tech) ----- */
  const basesAll = useMemo(() => (
    allItems
      .filter((b) => isMundaneWeaponOrArmor(b) && !isFutureTech(b))
      .map((b, i) => ({
        id: `b-${i}`,
        raw: b,
        label: b.name,
        sub: b.uiType || b.type || "",
        hint: b.propertiesText || ""
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ), [allItems]);

  const bases = useMemo(() => {
    return basesAll.filter((b) => baseKind === "weapon" ? isWeapon(b) : isArmor(b));
  }, [basesAll, baseKind]);

  /* ----- variants (dedup + nicer labels + hover help) ----- */
  const [hoveredVariant, setHoveredVariant] = useState(null);

  const stripWeaponArmorOf = (name) =>
    String(name || "").replace(/^\s*(weapon|armor)\s+of\s+/i, "of ");

  const variants = useMemo(() => {
    const seen = new Map(); // key: displayLabel -> item
    (magicVariants || [])
      .filter((v) => v && v.name && !isVestigeName(v.name))
      .forEach((v, i) => {
        const lbl = stripWeaponArmorOf(v.name);
        if (seen.has(lbl)) return; // dedupe by label
        const hint = Array.isArray(v.entries) && v.entries.length
          ? (typeof v.entries[0] === "string" ? v.entries[0] : JSON.stringify(v.entries[0]))
          : (v.item_description || v.description || "");
        seen.set(lbl, {
          id: `v-${i}`,
          raw: v,
          label: lbl,
          sub: v.rarity || "",
          hint
        });
      });
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [magicVariants]);

  /* ----- selection + composed result ----- */
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

  /* ------------------ render ------------------ */
  return (
    <div className="container-fluid py-3">
      <div className="row g-3">
        {/* Bases column */}
        <div className="col-lg-4">
          <div className="d-flex gap-2 mb-2">
            <button
              type="button"
              className={`btn btn-sm rounded-pill ${baseKind === "weapon" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setBaseKind("weapon")}
              title="Show mundane weapons"
            >
              Weapons
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill ${baseKind === "armor" ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setBaseKind("armor")}
              title="Show mundane armor & shields"
            >
              Armor / Shield
            </button>
          </div>
          <SearchList items={bases} onSelect={setSelectedBase} placeholder="Choose base (weapon/armor)" />
        </div>

        {/* Variants column */}
        <div className="col-lg-4 position-relative">
          <SearchList
            items={variants}
            onSelect={addVariant}
            onHover={setHoveredVariant}
            placeholder="Add up to 4 variants"
          />
          {hoveredVariant && (
            <div
              className="card shadow position-absolute"
              style={{ right: "-1rem", top: "-.5rem", width: "22rem", zIndex: 20 }}
              onMouseLeave={() => setHoveredVariant(null)}
            >
              <div className="card-header fw-semibold small">{hoveredVariant.label}</div>
              <div className="card-body small" style={{ whiteSpace: "pre-wrap" }}>
                {hoveredVariant.hint || "—"}
              </div>
            </div>
          )}

          <div className="mt-2">
            {selectedVariants.map((v) => (
              <motion.div layout key={v.name} className="d-inline-block me-2 mb-2">
                <span className="badge bg-light text-dark border">
                  {stripWeaponArmorOf(v.name)}
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

        {/* Result column */}
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header fw-bold small">Result</div>
            <div className="card-body">
              {!selectedBase && <div className="text-muted">Pick a base to begin.</div>}

              {selectedBase && (
                <>
                  {/* Nice item card preview */}
                  <div className="mb-3">
                    <ItemCard item={composed || selectedBase.raw} />
                  </div>

                  {/* JSON + actions */}
                  <div className="small text-uppercase text-muted mb-1">JSON</div>
                  <div className="border rounded bg-light p-2 overflow-auto" style={{ maxHeight: "14rem" }}>
                    <pre className="small mb-0">{JSON.stringify(composed || selectedBase.raw, null, 2)}</pre>
                  </div>

                  <div className="d-flex gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        const data = composed || selectedBase.raw;
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${(data.name || "item").replace(/[^a-z0-9]+/gi, "-")}.json`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      }}
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
          <strong>Rules:</strong> Bases = mundane Weapon/Armor/Shield from <code>all-items.json</code>.  
          Variants = <code>magicvariants.json</code> (no vestige states). Arrays merged, numeric bonuses keep highest.
        </div>
      </div>
    </div>
  );
}

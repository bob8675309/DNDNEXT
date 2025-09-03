// components/VariantBuilder.jsx
import React, { useMemo, useState } from "react";

/** ---------------- helpers ---------------- */
const RARITY_ORDER = ["common","uncommon","rare","very rare","legendary","artifact"];
const isVestigeName = (n) => /\b(dormant|awakened|exalted)\b/i.test(n || "");
const isMundaneWeaponOrArmor = (it) => {
  if (!it || typeof it !== "object") return false;
  const r = String(it.rarity || "none").toLowerCase();
  if (r !== "none") return false; // mundane only
  const t = String(it.uiType || it.type || "");
  return /weapon|armor|shield/i.test(t);
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
// Build name like “+1 Shortsword of Warning, Flaming”
function renderVariantName(baseName, variants) {
  const prefixes = [], suffixOf = [], extras = [];
  variants.forEach((v) => {
    if (!v) return;
    const nm = String(v.name || v.label || "").trim();
    if (v.nameTemplate) {
      let out = v.nameTemplate.replaceAll("{base}", baseName).replaceAll("{name}", nm);
      const b = normBonus(v.bonusWeapon || v.bonusAc || v.bonusSpellAttack);
      if (b != null) out = out.replaceAll("{bonus}", String(b));
      baseName = out; return;
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
    ["name","id","category","tags","source","page","prefix","suffix","of","nameTemplate","rarity"].forEach((k) => delete generic[k]);

    ["bonusWeapon","bonusAc","bonusShield","bonusSpellAttack","bonusSpellSaveDc"].forEach((k) => {
      const cur = out[k]; const curN = normBonus(cur);
      const nextN = normBonus(v[k] ?? generic[k]);
      if (nextN != null && (curN == null || nextN > curN)) out[k] = `+${nextN}`;
      delete generic[k];
    });

    ["property","resist","conditionImmune","miscTags","mastery"].forEach((k) => {
      const cur = Array.isArray(out[k]) ? out[k] : [];
      const nxt = Array.isArray(v[k]) ? v[k] : [];
      out[k] = uniq([...cur, ...nxt]);
      delete generic[k];
    });

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

/** ---------------- small subcomponents ---------------- */
function SearchList({ items, onSelect, title = "Search" }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((it) => it.label.toLowerCase().includes(s)) : items;
  }, [q, items]);
  return (
    <div className="card h-100">
      <div className="card-header py-2"><strong>{title}</strong></div>
      <div className="card-body">
        <input
          className="form-control form-control-sm mb-2"
          placeholder="Type to filter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="border rounded p-2" style={{ maxHeight: "18rem", overflow: "auto" }}>
          {filtered.map((it) => (
            <button
              key={it.id}
              className="btn btn-sm w-100 text-start mb-1 btn-outline-secondary"
              onClick={() => onSelect(it)}
              title={it.hint || it.label}
            >
              <span className="fw-semibold">{it.label}</span>
              {it.sub && <span className="text-muted small"> — {it.sub}</span>}
            </button>
          ))}
          {filtered.length === 0 && <div className="text-center text-muted small py-2">No matches</div>}
        </div>
      </div>
    </div>
  );
}
const Pill = ({ children }) => (
  <span className="badge bg-secondary rounded-pill me-1">{children}</span>
);

/** ---------------- main ---------------- */
export default function VariantBuilder({ allItems, magicVariants, onApply }) {
  // Fallback to globals if props aren’t provided
  // eslint-disable-next-line no-undef
  allItems = allItems || (typeof window !== "undefined" ? window.__ALL_ITEMS__ : []) || [];
  // eslint-disable-next-line no-undef
  magicVariants = magicVariants || (typeof window !== "undefined" ? window.__MAGIC_VARIANTS__ : []) || [];

  const bases = useMemo(() => (
    allItems
      .filter(isMundaneWeaponOrArmor)
      .map((b, i) => ({ id: `b-${i}`, raw: b, label: b.name, sub: b.uiType || b.type || "", hint: b.propertiesText || "" }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ), [allItems]);

  const variants = useMemo(() => (
    magicVariants
      .filter((v) => v && v.name && !isVestigeName(v.name))
      .map((v, i) => ({ id: `v-${i}`, raw: v, label: v.name, sub: v.rarity || "", hint: (v.entries && v.entries[0]) || "" }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ), [magicVariants]);

  const [selectedBase, setSelectedBase] = useState(null);
  const [selectedVariants, setSelectedVariants] = useState([]);
  const composed = useMemo(() => composeItem(selectedBase?.raw, selectedVariants, allItems), [selectedBase, selectedVariants, allItems]);

  const addVariant = (v) => {
    if (!v?.raw) return;
    if (selectedVariants.length >= 4) return;
    setSelectedVariants((prev) => (prev.find((x) => x.name === v.raw.name) ? prev : [...prev, v.raw]));
  };
  const removeVariant = (name) => setSelectedVariants((prev) => prev.filter((x) => x.name !== name));
  const clearAll = () => setSelectedVariants([]);

  return (
    <div className="container-fluid">
      <div className="row g-3">
        {/* Choose Base */}
        <div className="col-12 col-lg-4">
          <SearchList items={bases} onSelect={setSelectedBase} title="Choose base (weapon/armor)" />
        </div>

        {/* Add Variants */}
        <div className="col-12 col-lg-4">
          <SearchList items={variants} onSelect={addVariant} title="Add up to 4 variants" />
          <div className="mt-2">
            {selectedVariants.map((v) => (
              <span key={v.name} className="badge bg-light text-dark border me-2 mb-2">
                {v.name}
                <button className="btn btn-sm btn-link ms-2 p-0" onClick={() => removeVariant(v.name)} title="Remove">✕</button>
              </span>
            ))}
            {selectedVariants.length > 0 && (
              <button className="btn btn-sm btn-outline-secondary ms-1" onClick={clearAll}>Clear</button>
            )}
          </div>
        </div>

        {/* Preview & Export */}
        <div className="col-12 col-lg-4">
          <div className="card h-100">
            <div className="card-header py-2"><strong>Result</strong></div>
            <div className="card-body">
              {!selectedBase && <div className="text-muted small">Pick a base to begin.</div>}
              {selectedBase && (
                <>
                  <div className="mb-2">
                    <div className="text-uppercase text-muted small">Name</div>
                    <div className="fw-semibold">{composed?.name || selectedBase.label}</div>
                  </div>

                  <div className="row g-2 small">
                    <div className="col-6">
                      <div className="text-uppercase text-muted small">Base</div>
                      <div>{selectedBase.label}</div>
                    </div>
                    <div className="col-6">
                      <div className="text-uppercase text-muted small">Rarity</div>
                      <div>{(composed?.rarity || "uncommon").replace(/\b\w/g, (m) => m.toUpperCase())}</div>
                    </div>
                    <div className="col-12">
                      <div className="text-uppercase text-muted small">Bonuses</div>
                      <div>
                        {composed?.bonusWeapon && <Pill>Attack/Damage {composed.bonusWeapon}</Pill>}
                        {composed?.bonusAc && <Pill>AC {composed.bonusAc}</Pill>}
                        {composed?.bonusSpellAttack && <Pill>Spell ATK {composed.bonusSpellAttack}</Pill>}
                        {composed?.bonusSpellSaveDc && <Pill>Save DC {composed.bonusSpellSaveDc}</Pill>}
                        {!composed?.bonusWeapon && !composed?.bonusAc && !composed?.bonusSpellAttack && !composed?.bonusSpellSaveDc && (
                          <span className="text-muted">—</span>
                        )}
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="text-uppercase text-muted small">Traits</div>
                      <div>
                        {(composed?.property || []).slice(0, 6).map((p) => (<Pill key={p}>{p}</Pill>))}
                        {(composed?.property || []).length === 0 && <span className="text-muted">—</span>}
                      </div>
                    </div>
                  </div>

                  {composed?._matchesCanon && (
                    <div className="alert alert-warning p-2 mt-2 mb-0 small">
                      Heads-up: this name matches a canon magic item in your database ({composed._canonSource}).
                    </div>
                  )}

                  <hr />

                  <div className="text-uppercase text-muted small mb-1">JSON</div>
                  <div className="border rounded p-2" style={{ maxHeight: "14rem", overflow: "auto" }}>
                    <pre className="small m-0">{JSON.stringify(composed || selectedBase.raw, null, 2)}</pre>
                  </div>

                  <div className="d-flex gap-2 pt-2">
                    <button
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
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => onApply(composed)}>
                        Use in Admin
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 small text-muted pt-1">
          <strong>Rules:</strong> Bases are **mundane** Weapon/Armor/Shield from <code>all-items.json</code>.
          Variants come from <code>magicvariants.json</code>. Arrays are unioned; numeric bonuses keep the highest.
          Vestige states are hidden.
        </div>
      </div>
    </div>
  );
}

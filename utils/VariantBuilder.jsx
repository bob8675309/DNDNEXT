// /components/VariantBuilderModal.jsx
// Simple headless modal to pick a mundane base (weapon/armor), add up to 4 variants,
// preview the name/description live, and save.

import { useEffect, useMemo, useState } from "react";
import { buildMagicVariant, slugify } from "../lib/variantEngine";

// Utility: best-effort adapter for your catalog shapes.
// Accepts an array of items with flexible keys and filters to (non-magical) weapons/armor.
function adaptBaseCatalog(catalog) {
  if (!Array.isArray(catalog)) return [];
  return catalog
    .map((raw) => {
      const name = raw.name || raw.item_name || raw.title || "";
      const type = raw.type || raw.item_type || raw.category || "";
      const rarity = raw.rarity || raw.item_rarity || raw.tier || "Common";
      const description = raw.description || raw.item_description || "";
      const weight = raw.weight || raw.item_weight || null;
      const cost = raw.cost || raw.item_cost || null;
      const tags =
        raw.tags ||
        raw.item_tags ||
        (Array.isArray(raw.properties) ? raw.properties : null) ||
        [];

      return { name, type, rarity, description, weight, cost, tags };
    })
    // mundane weapon/armor filter (keeps simple bases, excludes obvious magic)
    .filter((it) => {
      const t = String(it.type || "").toLowerCase();
      const isWA = /weapon|armor/i.test(t) || /(sword|bow|mace|axe|spear|shield|mail|leather|plate)/i.test(it.name);
      const looksMagic = /spell|scroll|wand|staff|ring|amulet|rod|cloak|\+\d|\bof\b/i.test(it.name);
      const isVestige = /vestige/i.test(it.name) || (it.tags || []).some((x) => /vestige/i.test(String(x)));
      return isWA && !looksMagic && !isVestige;
    });
}

function groupVariants(vcat) {
  // Expecting magicvariants.json like:
  // { "variants": [ { key, name, label, category: "bonus|prefix|suffix", bump?, rarity?, description }, ... ] }
  const byCat = { bonus: [], prefix: [], suffix: [] };
  const all = Array.isArray(vcat?.variants) ? vcat.variants : [];
  for (const v of all) {
    const cat = (v.category || "").toLowerCase();
    if (cat === "bonus") byCat.bonus.push(v);
    else if (cat === "prefix") byCat.prefix.push(v);
    else if (cat === "suffix") byCat.suffix.push(v);
  }
  return byCat;
}

export default function VariantBuilderModal({
  isOpen,
  onClose,
  onSave,             // async ({dbPayload}) => void
  baseCatalog,        // array of items
  variantsCatalog,    // magicvariants.json object
  flavorOverridesMap, // { [itemName]: { flavor } } (optional)
}) {
  const [query, setQuery] = useState("");
  const [selectedBase, setSelectedBase] = useState(null);
  const [chosen, setChosen] = useState([]); // up to 4

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedBase(null);
      setChosen([]);
    }
  }, [isOpen]);

  const bases = useMemo(() => adaptBaseCatalog(baseCatalog), [baseCatalog]);
  const filteredBases = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bases.slice(0, 50);
    return bases.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 100);
  }, [bases, query]);

  const groups = useMemo(() => groupVariants(variantsCatalog), [variantsCatalog]);

  const preview = useMemo(() => {
    try {
      if (!selectedBase) return null;
      const dbPayload = buildMagicVariant({
        baseItem: selectedBase,
        chosenVariants: chosen,
        flavorOverrides: flavorOverridesMap,
      });
      return dbPayload;
    } catch (e) {
      return { error: e?.message || String(e) };
    }
  }, [selectedBase, chosen, flavorOverridesMap]);

  function toggleVariant(v) {
    setChosen((prev) => {
      const exists = prev.find((p) => (p.key || p.name) === (v.key || v.name));
      if (exists) return prev.filter((p) => (p.key || p.name) !== (v.key || v.name));
      if (prev.length >= 4) return prev; // max 4
      return [...prev, v];
    });
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Build Magic Variant</h2>
          <button
            className="rounded-lg border px-3 py-1 hover:bg-gray-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* Step 1: pick base */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Base (mundane weapon/armor)</label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Search base (e.g., shortsword, shield, plate)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-3 max-h-64 overflow-auto rounded-lg border">
              {filteredBases.map((b) => (
                <button
                  key={slugify(b.name)}
                  className={`block w-full px-3 py-2 text-left hover:bg-gray-50 ${selectedBase?.name === b.name ? "bg-gray-100" : ""}`}
                  onClick={() => setSelectedBase(b)}
                >
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-gray-500">
                    {b.type || "Item"} • {b.rarity || "Common"}
                  </div>
                </button>
              ))}
              {filteredBases.length === 0 && (
                <div className="p-3 text-sm text-gray-500">No results.</div>
              )}
            </div>
          </div>

          {/* Step 2: choose up to 4 variants */}
          <div>
            <label className="mb-2 block text-sm font-medium">Variants (up to 4)</label>
            <div className="grid grid-cols-3 gap-3">
              {["bonus", "prefix", "suffix"].map((cat) => (
                <div key={cat} className="rounded-lg border p-2">
                  <div className="mb-1 text-xs font-semibold uppercase text-gray-600">
                    {cat}
                  </div>
                  <div className="max-h-52 overflow-auto">
                    {(groups[cat] || []).map((v) => {
                      const active = !!chosen.find((p) => (p.key || p.name) === (v.key || v.name));
                      return (
                        <button
                          key={v.key || v.name}
                          onClick={() => toggleVariant(v)}
                          className={`mb-1 block w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-100 ${
                            active ? "bg-indigo-50 border border-indigo-200" : "border border-transparent"
                          }`}
                          title={v.description || ""}
                        >
                          {(v.label || v.name) || "(unnamed)"}
                        </button>
                      );
                    })}
                    {(groups[cat] || []).length === 0 && (
                      <div className="p-2 text-xs text-gray-500">—</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Tip: the “bonus” bucket is where +1/+2/+3 normally lives; “prefix/suffix” for properties like *Warning*, *Flame Tongue*, etc. Vestiges are automatically excluded.
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="mt-6 rounded-xl border p-4">
          <div className="mb-2 text-sm font-semibold">Preview</div>
          {!selectedBase && <div className="text-sm text-gray-500">Pick a base to see preview…</div>}

          {preview?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {preview.error}
            </div>
          )}

          {selectedBase && !preview?.error && (
            <>
              <div className="text-lg font-bold">{preview.item_name}</div>
              <div className="text-xs text-gray-600">
                {preview.item_type || "Item"} • {preview.item_rarity}
              </div>
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm">
                {preview.item_description || "(no description)"}
              </pre>
            </>
          )}
        </div>

        {/* Save */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="rounded-lg border px-3 py-2 hover:bg-gray-100" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-lg bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={!selectedBase || !!preview?.error}
            onClick={async () => {
              const dbPayload = {
                item_id: preview.item_id,
                item_name: preview.item_name,
                item_type: preview.item_type,
                item_rarity: preview.item_rarity,
                item_description: preview.item_description,
                item_weight: preview.item_weight,
                item_cost: preview.item_cost,
              };
              await onSave({ dbPayload, preview });
            }}
          >
            Save to Inventory
          </button>
        </div>
      </div>
    </div>
  );
}

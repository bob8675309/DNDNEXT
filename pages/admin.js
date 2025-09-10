// pages/admin.js
import { useEffect, useMemo, useState } from "react";
import AssignItemButton from "../components/AssignItemButton";
import ItemCard from "../components/ItemCard";
import { classifyUi, TYPE_PILLS, titleCase } from "../utils/itemsIndex";
import dynamic from "next/dynamic";

// Load the Variant Builder on the client only
const VariantBuilder = dynamic(() => import("../components/VariantBuilder"), { ssr: false });

export default function AdminPanel() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("All");
  const [type, setType] = useState("All");
  const [selected, setSelected] = useState(null);

  // Modal + data for builder
  const [showBuilder, setShowBuilder] = useState(false);
  const [magicVariants, setMagicVariants] = useState(null); // null until fetched
  const [stagedCustom, setStagedCustom] = useState(null);   // composed item from builder

  /* ----------------- Variant file normalizer (robust) ----------------- */
  const looksVariant = (v) =>
    v && typeof v === "object" && (
      v.name || v.effects || v.delta || v.mod || v.entries || v.item_description ||
      v.bonusWeapon || v.bonusAc || v.bonusShield || v.bonusSpellAttack || v.bonusSpellSaveDc
    );

  // Recursively collect variants from ANY shape (array, items[], maps, nested)
  function collectVariants(node) {
    const out = [];
    if (!node) return out;

    if (Array.isArray(node)) {
      for (const v of node) {
        if (looksVariant(v)) out.push(v);
        else out.push(...collectVariants(v));
      }
      return out;
    }

    if (typeof node === "object") {
      if (looksVariant(node)) {
        out.push(node);
      } else if (Array.isArray(node.items)) {
        out.push(...collectVariants(node.items));
      } else {
        for (const [k, v] of Object.entries(node)) {
          const kids = collectVariants(v);
          for (const child of kids) {
            if (!child.name && typeof k === "string") child.name = k;
            out.push(child);
          }
        }
      }
    }
    return out;
  }
  const normalizeVariants = (vjson) => collectVariants(vjson);

  /* -------------------------- Data loading --------------------------- */
  // Initial load: base items
  useEffect(() => {
    let die = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/items/all-items.json");
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (!die) {
          setItems(list);
          if (typeof window !== "undefined") window.__ALL_ITEMS__ = list; // optional global
        }
      } catch (e) {
        console.error("Failed to load all-items.json:", e);
      } finally {
        if (!die) {
          setLoading(false);
          setLoaded(true);
        }
      }
    })();
    return () => { die = true; };
  }, []);

  // Lazy-load variants when opening builder (supports arrays, items[], or map)
  useEffect(() => {
    if (!showBuilder || magicVariants) return;
    let dead = false;
    (async () => {
      try {
        const r = await fetch("/items/magicvariants.json");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const vjson = await r.json();
        const vlist = normalizeVariants(vjson);
        if (!dead) {
          setMagicVariants(vlist);
          if (typeof window !== "undefined") window.__MAGIC_VARIANTS__ = vlist; // optional global
        }
      } catch (e) {
        console.error("Failed to load magicvariants.json:", e);
        if (!dead) setMagicVariants([]); // avoid spinner lock
      }
    })();
    return () => { dead = true; };
  }, [showBuilder, magicVariants]);

  /* ------------------------ Filtering helpers ------------------------ */
  // Rarities ("none" → Mundane)
  const rarities = useMemo(() => {
    const set = new Set(items.map((i) => String(i.rarity || i.item_rarity || "")).filter(Boolean));
    const pretty = new Set([...set].map((r) => (r.toLowerCase() === "none" ? "Mundane" : titleCase(r))));
    return ["All", ...Array.from(pretty).sort()];
  }, [items]);

  // Attach uiType once for cheaper filtering
  const itemsWithUi = useMemo(
    () => items.map((it) => ({ ...it, __cls: classifyUi(it) })),
    [items]
  );

  // Build dropdown options: consolidated + any remaining raw codes
  const typeOptions = useMemo(() => {
    const known = new Set(TYPE_PILLS.map((p) => p.key));
    const consolidated = new Set(itemsWithUi.map((it) => it.__cls.uiType).filter(Boolean));
    const raw = new Set(itemsWithUi.map((it) => (!it.__cls.uiType ? it.__cls.rawType : null)).filter(Boolean));
    return ["All", ...Array.from(new Set([...known, ...consolidated])).sort(), ...Array.from(raw).sort()];
  }, [itemsWithUi]);

  // Filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (itemsWithUi || []).filter((it) => {
      const name = (it.name || it.item_name || "").toLowerCase();
      const rRaw = String(it.rarity || it.item_rarity || "");
      const rPretty = rRaw.toLowerCase() === "none" ? "Mundane" : titleCase(rRaw);
      const uiType = it.__cls.uiType;
      const rawType = it.__cls.rawType;

      const okText = !q || name.includes(q);
      const okR = rarity === "All" || rPretty === rarity;

      let okT = true;
      if (type !== "All") okT = uiType ? uiType === type : rawType === type;

      const isFuture = it.__cls.uiType === "Future";
      if (type === "All" && isFuture) return false;

      return okText && okR && okT;
    });
  }, [itemsWithUi, search, rarity, type]);

  useEffect(() => {
    if (!selected && filtered.length) setSelected(filtered[0]);
  }, [filtered, selected]);

  /* ----------------------------- Modal ------------------------------- */
  function Modal({ open, onClose, children }) {
    if (!open) return null;
    return (
      <div
        className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
        style={{ background: "rgba(0,0,0,.7)", zIndex: 1050 }}
        role="dialog"
        aria-modal="true"
      >
        {/* Dark container so text is bright */}
        <div
          className="variant-modal admin-dark rounded shadow p-3"
          style={{ width: "min(1100px, 96vw)", maxHeight: "92vh", overflow: "auto" }}
        >
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h5 m-0">Build Magic Variant</h2>
            <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Close</button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  /* ----------------------------- Render ------------------------------ */
  return (
    <div className="container my-4 admin-dark">
      <h1 className="h3 mb-3">🧭 Admin Dashboard</h1>

      {/* Controls */}
      <div className="row g-2 align-items-end">
        <div className="col-12 col-lg-4">
          <label className="form-label fw-semibold">Search</label>
          <input
            className="form-control"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Mace of Disruption"
          />
        </div>

        <div className="col-6 col-lg-3">
          <label className="form-label fw-semibold">Rarity</label>
          <select
            className="form-select"
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
          >
            {rarities.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="col-6 col-lg-3">
          <label className="form-label fw-semibold">Type</label>
          <select
            className="form-select"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="col-12 col-lg-2 d-flex gap-2">
          <button
            className="btn btn-outline-secondary flex-fill"
            disabled={loading || loaded}
          >
            {loaded ? "Loaded" : loading ? "Loading…" : "Load Items"}
          </button>

          {/* Open builder */}
          <button
            className="btn btn-primary flex-fill"
            onClick={() => { setShowBuilder(true); setStagedCustom(null); }}
            title="Build a magic variant from a mundane base"
          >
            Build Magic Variant
          </button>
        </div>
      </div>

      {/* Type pills */}
      <div className="mb-3 d-flex flex-wrap gap-2">
        {TYPE_PILLS.map((p) => {
          const active = type === p.key || (p.key === "All" && type === "All");
          return (
            <button
              key={p.key}
              type="button"
              className={`btn btn-sm ${active ? "btn-light text-dark" : "btn-outline-light"}`}
              onClick={() => setType(p.key)}
              title={p.key}
            >
              <span className="me-1">{p.icon}</span>
              {p.key}
            </button>
          );
        })}
      </div>

      <div className="row g-3">
        {/* Results list */}
        <div className="col-12 col-lg-5">
          <div className="list-group list-group-flush">
            {filtered.map((it, i) => {
              const active = selected === it && !stagedCustom;
              const name = it.name || it.item_name;
              const rRaw = String(it.rarity || it.item_rarity || "");
              const rPretty = rRaw.toLowerCase() === "none" ? "Mundane" : titleCase(rRaw);
              const label = it.__cls.uiType || titleCase(it.__cls.rawType);

              return (
                <button
                  key={it.id || i}
                  className={`list-group-item list-group-item-action ${active ? "active" : "bg-dark text-light"}`}
                  onClick={() => { setSelected(it); setStagedCustom(null); }}
                >
                  <div className="d-flex justify-content-between">
                    <span className="fw-semibold">{name}</span>
                    <span className="badge bg-secondary ms-2">{rPretty || "—"}</span>
                  </div>
                  <div className="small text-muted">{label}</div>
                </button>
              );
            })}
            {filtered.length === 0 && <div className="p-3 text-muted">No matches.</div>}
          </div>
        </div>

        {/* Preview + Assign */}
        <div className="col-12 col-lg-7">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h2 className="h5 m-0">Preview</h2>
            {(stagedCustom || selected) && (
              <AssignItemButton
                item={{
                  ...(stagedCustom || selected),
                  // Ensure a stable ID for custom items so Assign works
                  id: (stagedCustom?.id) || (selected?.id) || `VAR-${Date.now()}`,
                }}
              />
            )}
          </div>

          {!(stagedCustom || selected) ? (
            <div className="text-muted fst-italic">Select an item to preview.</div>
          ) : (
            <div className="row g-3">
              <div className="col-12 col-md-10 col-lg-9">
                <ItemCard item={stagedCustom || selected} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Builder modal */}
      <Modal open={showBuilder} onClose={() => setShowBuilder(false)}>
        {(!items.length || magicVariants === null) ? (
          <div className="text-muted">Loading…</div>
        ) : (
          <VariantBuilder
            allItems={items}
            magicVariants={magicVariants}
            onApply={(obj) => {
              // Give it a temporary ID and UI classification for downstream components
              const withId = { id: `VAR-${Date.now()}`, ...obj, __cls: classifyUi(obj) };
              setStagedCustom(withId);
              setShowBuilder(false);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

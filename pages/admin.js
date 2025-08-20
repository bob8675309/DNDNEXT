// pages/admin.js
import { useEffect, useMemo, useState } from "react";
import AssignItemButton from "../components/AssignItemButton";
import ItemCard from "../components/ItemCard";
import { classifyUi } from "../utils/itemsIndex";

// Icon pills for consolidated buckets
const TYPE_PILLS = [
  { id: "All",               label: "All",                  emoji: "✨" },
  { id: "Melee Weapon",      label: "Melee",                emoji: "⚔️" },
  { id: "Ranged Weapon",     label: "Ranged",               emoji: "🏹" },
  { id: "Armor",             label: "Armor",                emoji: "🛡️" },
  { id: "Shield",            label: "Shield",               emoji: "🛡" },
  { id: "Ammunition",        label: "Ammo",                 emoji: "🎯" },
  { id: "Wondrous Item",     label: "Wondrous",             emoji: "🪄" },
  { id: "Potion",            label: "Potion",               emoji: "🧪" },
  { id: "Scroll",            label: "Scroll",               emoji: "📜" },
  { id: "Tools",             label: "Tools",                emoji: "🧰" },
  { id: "Instrument",        label: "Instrument",           emoji: "🎻" },
  { id: "Rods & Wands",      label: "Rods & Wands",         emoji: "🪄" },
  { id: "Staff",             label: "Staff",                emoji: "🪄" },
  { id: "Adventuring Gear",  label: "Gear",                 emoji: "🎒" },
  { id: "Spellcasting Focus",label: "Focus",                emoji: "🔮" },
  { id: "Trade Goods",       label: "Trade Goods",          emoji: "💰" },
  { id: "Vehicles & Structures", label: "Vehicles",         emoji: "🚢" },
];

// Fallback prettifier for any raw types we still expose in the dropdown
function titleCase(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}

export default function AdminPanel() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("All");
  const [type, setType] = useState("All");   // consolidated OR a raw code
  const [selected, setSelected] = useState(null);

  async function ensureLoaded() {
    if (loaded) return;
    try {
      setLoading(true);
      const res = await fetch("/items/all-items.json");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch {
      setItems([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => ensureLoaded(), 300);
    return () => clearTimeout(t);
  }, []);

  const rarities = useMemo(() => {
    const set = new Set(items.map((i) => i.rarity || i.item_rarity || "").filter(Boolean));
    // Map "none" to "Mundane" (so it matches the card language)
    const pretty = new Set([...set].map(r => (String(r).toLowerCase() === "none" ? "Mundane" : r)));
    return ["All", ...Array.from(pretty).sort()];
  }, [items]);

  // Build the dropdown list: consolidated + unsorted raw codes
  const { consolidatedTypes, unsortedRaw } = useMemo(() => {
    const cons = new Set();
    const raw = new Set();
    for (const it of items) {
      const { uiType, rawType } = classifyUi(it);
      if (uiType) cons.add(uiType);
      else if (rawType) raw.add(rawType);
    }
    return { consolidatedTypes: Array.from(cons).sort(), unsortedRaw: Array.from(raw).sort() };
  }, [items]);

  const typeOptions = useMemo(() => {
    return ["All", ...consolidatedTypes, ...unsortedRaw];
  }, [consolidatedTypes, unsortedRaw]);

  // Filtering
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items || []).filter((it) => {
      const name = (it.name || it.item_name || "").toLowerCase();
      const r = String(it.rarity || it.item_rarity || "");
      const { uiType, rawType } = classifyUi(it);

      const okText = !q || name.includes(q);
      const okR = rarity === "All" || r === rarity || (rarity === "Mundane" && r.toLowerCase() === "none");

      // If the filter matches a consolidated bucket, compare to uiType;
      // otherwise treat it as a raw code we haven't mapped yet.
      let okT = true;
      if (type !== "All") {
        okT = uiType ? uiType === type : rawType === type;
      }

      return okText && okR && okT;
    });
  }, [items, search, rarity, type]);

  useEffect(() => {
    if (!selected && filtered.length) setSelected(filtered[0]);
  }, [filtered, selected]);

  return (
    <div className="container my-4 admin-dark">
      <h1 className="h3 mb-3">🧭 Admin Dashboard</h1>

      {/* Controls */}
      <div className="row g-3 align-items-end mb-2">
        <div className="col-12 col-lg-5">
          <label className="form-label fw-semibold">Search by name</label>
          <div className="input-group">
            <span className="input-group-text">🔎</span>
            <input
              type="text"
              className="form-control"
              value={search}
              onFocus={ensureLoaded}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Mace of Disruption"
            />
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <label className="form-label fw-semibold">Rarity</label>
          <select
            className="form-select"
            value={rarity}
            onFocus={ensureLoaded}
            onChange={(e) => setRarity(e.target.value)}
          >
            {rarities.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="col-6 col-lg-2">
          <label className="form-label fw-semibold">Type</label>
          <select
            className="form-select"
            value={type}
            onFocus={ensureLoaded}
            onChange={(e) => setType(e.target.value)}
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t in {} ? t : titleCase(t)}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12 col-lg-2">
          <button
            className="btn btn-outline-secondary w-100"
            onClick={ensureLoaded}
            disabled={loading || loaded}
          >
            {loaded ? "Loaded" : loading ? "Loading…" : "Load Items"}
          </button>
        </div>
      </div>

      {/* NEW: Type filter pills (replaces old slot pills) */}
      <div className="mb-3 d-flex flex-wrap gap-2">
        {TYPE_PILLS.map((p) => {
          const active = type === p.id || (p.id === "All" && type === "All");
          return (
            <button
              key={p.id}
              type="button"
              className={`btn btn-sm ${active ? "btn-light text-dark" : "btn-outline-light"}`}
              onClick={() => setType(p.id)}
              onFocus={ensureLoaded}
              title={p.label}
            >
              <span className="me-1">{p.emoji}</span>
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="row g-4">
        {/* Results list */}
        <div className="col-12 col-lg-5">
          <div className="card bg-dark text-light border-0 shadow-sm">
            <div className="card-header d-flex justify-content-between align-items-center bg-dark border-light-subtle">
              <span className="fw-semibold">Results</span>
              <span className="text-muted small">{filtered.length}</span>
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: 520, overflowY: "auto" }}>
              {!loaded && <div className="p-3 text-muted">Start typing to load the catalog…</div>}

              {loaded && filtered.slice(0, 250).map((it, i) => {
                const active = selected === it;
                const name = it.name || it.item_name;
                const r = String(it.rarity || it.item_rarity || "");
                const { uiType } = classifyUi(it);

                return (
                  <button
                    key={it.id || i}
                    className={`list-group-item list-group-item-action ${active ? "active" : "bg-dark text-light"}`}
                    onClick={() => setSelected(it)}
                  >
                    <div className="d-flex justify-content-between">
                      <span className="fw-semibold">{name}</span>
                      <span className="badge bg-secondary ms-2">{r || "—"}</span>
                    </div>
                    <div className="small text-muted">{uiType || titleCase(strip(it.type || it.item_type))}</div>
                  </button>
                );
              })}

              {loaded && filtered.length === 0 && <div className="p-3 text-muted">No matches.</div>}
            </div>
          </div>
        </div>

        {/* Preview + Assign */}
        <div className="col-12 col-lg-7">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h2 className="h5 m-0">Preview</h2>
            {selected && <AssignItemButton item={selected} />}
          </div>

          {!selected ? (
            <div className="text-muted fst-italic">Select an item to preview.</div>
          ) : (
            <div className="row g-3">
              <div className="col-12 col-md-10 col-lg-9">
                <ItemCard item={selected} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// local
function strip(s) { return String(s || "").split("|")[0]; }

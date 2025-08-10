import { useEffect, useMemo, useState } from "react";
import AssignItemButton from "@/components/AssignItemButton";
import ItemCard from "@/components/ItemCard";

export default function AdminPanel() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("All");
  const [type, setType] = useState("All");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

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

  // Lazy-load when user focuses or types
  function onFocusSearch() { ensureLoaded(); }

  useEffect(() => {
    // Optional: prefetch quietly after mount
    const t = setTimeout(() => ensureLoaded(), 500);
    return () => clearTimeout(t);
  }, []);

  const rarities = useMemo(() => {
    const set = new Set(items.map((i) => i.rarity || i.item_rarity).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [items]);

  const types = useMemo(() => {
    const set = new Set(items.map((i) => i.type || i.item_type).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items || []).filter((it) => {
      const n = (it.name || it.item_name || "").toLowerCase();
      const r = (it.rarity || it.item_rarity || "").toString();
      const t = (it.type || it.item_type || "").toString();
      const okText = !q || n.includes(q);
      const okR = rarity === "All" || r === rarity;
      const okT = type === "All" || t === type;
      return okText && okR && okT;
    });
  }, [items, search, rarity, type]);

  useEffect(() => {
    if (!selected && filtered.length) setSelected(filtered[0]);
  }, [filtered, selected]);

  return (
    <div className="container my-4">
      <h1 className="h3 mb-3">Admin • Item Catalog</h1>

      <div className="row g-3 align-items-end mb-3">
        <div className="col-12 col-lg-5">
          <label className="form-label fw-semibold">Search by name</label>
          <div className="input-group">
            <span className="input-group-text">🔎</span>
            <input
              type="text"
              className="form-control"
              value={search}
              onFocus={onFocusSearch}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Mace of Disruption"
            />
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <label className="form-label fw-semibold">Rarity</label>
          <select className="form-select" value={rarity} onChange={(e) => setRarity(e.target.value)} onFocus={onFocusSearch}>
            {rarities.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="col-6 col-lg-2">
          <label className="form-label fw-semibold">Type</label>
          <select className="form-select" value={type} onChange={(e) => setType(e.target.value)} onFocus={onFocusSearch}>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-lg-2">
          <button className="btn btn-outline-secondary w-100" onClick={ensureLoaded} disabled={loading || loaded}>
            {loaded ? "Loaded" : (loading ? "Loading…" : "Load Items")}
          </button>
        </div>
      </div>

      <div className="row g-4">
        {/* Results list */}
        <div className="col-12 col-lg-5">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Results</span>
              <span className="text-muted small">{filtered.length}</span>
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: 520, overflowY: "auto" }}>
              {!loaded && <div className="p-3 text-muted">Start typing to load the catalog…</div>}
              {loaded && filtered.slice(0, 200).map((it, i) => {
                const id = it.id || i;
                const active = selected && (selected === it);
                return (
                  <button
                    key={id}
                    className={`list-group-item list-group-item-action d-flex justify-content-between ${active ? "active" : ""}`}
                    onClick={() => setSelected(it)}
                  >
                    <span className="text-truncate">{it.name || it.item_name}</span>
                    <span className="ms-2 badge bg-secondary">{(it.rarity || it.item_rarity || "").toString()}</span>
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
            {selected && (
              <div>
                <AssignItemButton item={selected} />
              </div>
            )}
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

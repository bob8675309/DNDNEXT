import { useEffect, useMemo, useState } from "react";
import AssignItemButton from "../components/AssignItemButton";
import ItemCard from "../components/ItemCard";

export default function AdminPanel() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("All");
  const [type, setType] = useState("All");
  const [loading, setLoading] = useState(false);

  // Load from /public/items
  async function loadItems() {
    try {
      setLoading(true);
      const res = await fetch("/items/all-items.json");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Auto-load once; remove if you prefer manual
    loadItems();
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
    return items.filter((it) => {
      const n = (it.name || it.item_name || "").toLowerCase();
      const r = it.rarity || it.item_rarity || "";
      const t = it.type || it.item_type || "";
      const okText = !q || n.includes(q) || t.toLowerCase().includes(q) || r.toLowerCase().includes(q);
      const okR = rarity === "All" || r === rarity;
      const okT = type === "All" || t === type;
      return okText && okR && okT;
    });
  }, [items, search, rarity, type]);

  return (
    <div className="container my-4">
      <h1 className="h3 mb-3">Admin • Item Catalog</h1>

      <div className="row g-3 align-items-end mb-3">
        <div className="col-12 col-lg-4">
          <label className="form-label fw-semibold">Search</label>
          <div className="input-group">
            <span className="input-group-text">🔎</span>
            <input
              type="text"
              className="form-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, type, or rarity…"
            />
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <label className="form-label fw-semibold">Rarity</label>
          <select className="form-select" value={rarity} onChange={(e) => setRarity(e.target.value)}>
            {rarities.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="col-6 col-lg-3">
          <label className="form-label fw-semibold">Type</label>
          <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="col-12 col-lg-2 d-flex gap-2">
          <button className="btn btn-primary w-100" onClick={loadItems} disabled={loading}>
            {loading ? "Loading…" : "Load Items"}
          </button>
        </div>
      </div>

      <div className="row g-3">
        {filtered.map((item, idx) => (
          <div key={item.id || idx} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
            <div className="w-100 d-flex flex-column">
              <ItemCard item={item} />
              <div className="mt-2 d-flex justify-content-end">
                <AssignItemButton item={item} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!filtered.length && (
        <div className="text-center text-muted py-5">No items match your filters.</div>
      )}
    </div>
  );
}

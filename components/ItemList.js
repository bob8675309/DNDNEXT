// /components/ItemList.js
import { useState, useMemo } from "react";
import ItemCard from "./ItemCard";

export default function ItemList({ items = [] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const name = (it.name || it.item_name || "").toLowerCase();
      const type = (it.type || it.item_type || "").toLowerCase();
      const rarity = (it.rarity || it.item_rarity || "").toLowerCase();
      return name.includes(q) || type.includes(q) || rarity.includes(q);
    });
  }, [items, search]);

  return (
    <div className="container my-4">
      <div className="row justify-content-between align-items-end g-3 mb-3">
        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold">Search</label>
          <div className="input-group">
            <span className="input-group-text">🔎</span>
            <input
              type="text"
              className="form-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, type, or rarity…"
            />
          </div>
        </div>
      </div>

      <div className="row g-3">
        {filtered.map((item, index) => (
          <div key={item.id || index} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
            <ItemCard item={item} />
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-muted mt-4">No items match your search.</div>
      )}
    </div>
  );
}


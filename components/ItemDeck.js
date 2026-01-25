//   /components/ItemDeck.js
import { useMemo, useState } from "react";
import ItemCard from "./ItemCard";

const RARITIES = ["All", "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"];

export default function ItemDeck({ items = [] }) {
  const [dealtCards, setDealtCards] = useState([]);
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("All");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items || []).filter((it) => {
      const name = (it.name || it.item_name || "").toLowerCase();
      const type = (it.type || it.item_type || "").toLowerCase();
      const r   = (it.rarity || it.item_rarity || "");
      const rarityOk = rarity === "All" ? true : r === rarity;
      const textOk = !q || name.includes(q) || type.includes(q);
      return rarityOk && textOk;
    });
  }, [items, search, rarity]);

  function dealOne() {
    if (!filtered.length) return;
    const dealtSet = new Set(dealtCards);
    const pool = filtered.filter((it) => !dealtSet.has(it));
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setDealtCards((prev) => [...prev, pick]);
  }

  function resetDeck() {
    setDealtCards([]);
  }

  return (
    <div className="container my-4">
      {/* Controls */}
      <div className="row g-3 align-items-end mb-3">
        <div className="col-12 col-md-5">
          <label className="form-label fw-semibold">Search</label>
          <div className="input-group">
            <span className="input-group-text">🔎</span>
            <input
              type="text"
              className="form-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or type…"
            />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label fw-semibold">Rarity</label>
          <select className="form-select" value={rarity} onChange={(e) => setRarity(e.target.value)}>
            {RARITIES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-4 d-flex gap-2">
          <button className="btn btn-primary flex-grow-1" onClick={dealOne}>
            Deal a Card
          </button>
          <button className="btn btn-outline-secondary" onClick={resetDeck}>
            Reset
          </button>
        </div>
      </div>

      {/* Dealt cards */}
      <div className="row g-3">
        {dealtCards.map((item, index) => (
          <div key={item.id || index} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
            <ItemCard item={item} />
          </div>
        ))}
      </div>

      {!dealtCards.length && (
        <div className="text-muted text-center py-5">No cards dealt yet. Use “Deal a Card”.</div>
      )}
    </div>
  );
}

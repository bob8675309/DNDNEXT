import { useState, useEffect } from "react";
import { FaSearch } from "react-icons/fa";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminPanel() {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    async function fetchItems() {
      const res = await fetch("/items/all-items.json");
      const data = await res.json();
      setItems(data);
      setFilteredItems(data);
    }
    fetchItems();
  }, []);

  useEffect(() => {
    const filtered = items.filter((item) => {
      return (
        item.name.toLowerCase().includes(search.toLowerCase()) &&
        (!rarity || item.rarity === rarity) &&
        (!type || item.type === type)
      );
    });
    setFilteredItems(filtered);
  }, [search, rarity, type, items]);

  return (
    <div className="container py-5">
      <h1 className="mb-4">Admin Dashboard</h1>

      <div className="card p-3 mb-4">
        <div className="row g-3 align-items-center">
          <div className="col-md-4">
            <label className="form-label fw-bold">Search</label>
            <div className="input-group">
              <span className="input-group-text">
                <FaSearch />
              </span>
              <input
                type="text"
                className="form-control"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
              />
            </div>
          </div>
          <div className="col-md-4">
            <label className="form-label fw-bold">Rarity</label>
            <select className="form-select" value={rarity} onChange={(e) => setRarity(e.target.value)}>
              <option value="">All</option>
              <option value="Common">Common</option>
              <option value="Uncommon">Uncommon</option>
              <option value="Rare">Rare</option>
              <option value="Very Rare">Very Rare</option>
              <option value="Legendary">Legendary</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label fw-bold">Type</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All</option>
              <option value="Weapon">Weapon</option>
              <option value="Armor">Armor</option>
              <option value="Potion">Potion</option>
              <option value="Scroll">Scroll</option>
              <option value="Wondrous Item">Wondrous Item</option>
            </select>
          </div>
        </div>
      </div>

      <div className="row row-cols-1 row-cols-md-3 g-4">
        {filteredItems.map((item) => (
          <div className="col" key={item.name}>
            <div className="card h-100 border-dark shadow-sm">
              <div className="card-body">
                <h5 className="card-title fw-bold">{item.name}</h5>
                <div className="mb-2">
                  <Image
                    src={item.image_url || "/placeholder.png"}
                    alt={item.name}
                    width={300}
                    height={200}
                    className="img-fluid rounded border"
                  />
                </div>
                <p className="card-text small">
                  <strong>Rarity:</strong> {item.rarity || "Unknown"}<br />
                  <strong>Type:</strong> {item.type || "Unknown"}<br />
                  <strong>Slot:</strong> {item.slot || "—"}
                </p>
              </div>
              <div className="card-footer text-end">
                <button className="btn btn-sm btn-primary">Assign</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// /pages/items.js

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "../components/ItemCard";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchItems() {
      const { data, error } = await supabase.from("items").select("*");
      if (!error && data) setItems(data);
    }
    fetchItems();
  }, []);

  const filtered = items.filter(item =>
    item.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#191d24] text-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">All Items</h1>
      <div className="mb-6">
        <input
          className="w-full p-3 rounded border border-zinc-700 bg-zinc-800 text-white placeholder-gray-400"
          type="text"
          placeholder="Search items by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item, i) => (
          <ItemCard key={item.id || i} item={item} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center text-gray-400 mt-12">
          No items match your search.
        </div>
      )}
    </div>
  );
}

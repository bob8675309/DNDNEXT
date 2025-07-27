// /components/ItemList.js

import { useState } from "react";
import ItemCard from "./ItemCard";

export default function ItemList({ items }) {
  const [search, setSearch] = useState("");

  const filtered = items
    ? items.filter(item =>
        item.name?.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <div className="p-6 max-w-screen-xl mx-auto text-white">
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
        {filtered.map((item, index) => (
          <ItemCard key={item.id || index} item={item} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center text-gray-400 mt-12">No items match your search.</div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
// /components/ItemList.js

import ItemCard from "./ItemCard";

export default function ItemList({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-gray-400 p-8 text-center italic">
        No items to display.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-2">
      {items.map((item, i) => (
        <ItemCard key={item.id || i} item={item} />
      ))}
    </div>
  );
}

  useEffect(() => {
    fetch("/items/all-items.json")
      .then(res => res.json())
      .then(data => setItems(data))
      .catch(err => console.error("Failed to load items:", err));
  }, []);

  const filtered = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

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
          <ItemCard key={index} item={item} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-400 mt-12">No items match your search.</div>
      )}
    </div>
  );
}

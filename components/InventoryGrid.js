// /components/InventoryGrid.js

import ItemCard from "./ItemCard";

export default function InventoryGrid({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-gray-400 p-8 text-center italic">
        Inventory is empty.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
      {items.map((item, i) => (
        <ItemCard key={item.id || i} item={item} />
      ))}
    </div>
  );
}

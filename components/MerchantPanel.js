// /components/MerchantPanel.js

import ItemCard from "./ItemCard";

export default function MerchantPanel({ merchant }) {
  if (!merchant) return null;
  const items = merchant.inventory || [];

  return (
    <div className="p-4">
      <h2 className="font-bold text-xl text-yellow-300 mb-2">{merchant.name}'s Wares</h2>
      {items.length === 0 ? (
        <div className="text-gray-400 italic mb-4">No items available.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <ItemCard key={item.id || i} item={item} />
          ))}
        </div>
      )}
      <div className="mt-4 text-xs text-gray-400">
        Location: {merchant.roaming_spot?.locationName || "Unknown"}
      </div>
    </div>
  );
}

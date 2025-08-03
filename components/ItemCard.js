// /components/ItemCard.js

import { useState } from "react";
import { FaInfoCircle, FaStar } from "react-icons/fa";

// Helper: Map item rarity to border/background color
const rarityColors = {
  common: "border-gray-400 bg-gray-800",
  uncommon: "border-green-500 bg-green-950",
  rare: "border-blue-500 bg-blue-950",
  veryrare: "border-purple-600 bg-purple-950",
  legendary: "border-yellow-400 bg-yellow-900",
  artifact: "border-red-600 bg-red-950",
};

export default function ItemCard({ item, showDetails = false }) {
  const [hover, setHover] = useState(false);

  if (!item) return null;
  const {
    name,
    icon,
    image,
    description,
    rarity = "common",
    type,
    attunement,
    slot,
    quantity,
  } = item;

  const border = rarityColors[rarity?.toLowerCase()] || rarityColors["common"];

  return (
    <div
      className={`relative w-44 min-h-24 max-w-xs p-2 rounded-2xl shadow-md transition
        cursor-pointer group flex flex-col justify-between border-2 ${border}
        hover:scale-105 hover:z-20 bg-gradient-to-b from-black/60 to-gray-900`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      tabIndex={0}
    >
      {/* Top Row: Icon/Image + Name */}
      <div className="flex items-center gap-2">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-10 h-10 object-contain rounded-lg border"
          />
        ) : icon ? (
          <span className="text-3xl">{icon}</span>
        ) : (
          <FaStar className="text-3xl" />
        )}
        <div className="flex-1 min-w-0">
          <div
            className="truncate font-bold text-base text-gray-100"
            title={name}
          >
            {name}
          </div>
          <div className="text-xs text-gray-400 capitalize">{type}</div>
        </div>
        {/* Rarity Tag */}
        <span
          className={`ml-1 px-2 py-0.5 rounded-xl text-xs font-bold capitalize 
            ${rarity === "rare"
              ? "bg-blue-800 text-blue-200"
              : rarity === "uncommon"
              ? "bg-green-800 text-green-200"
              : rarity === "veryrare"
              ? "bg-purple-800 text-purple-100"
              : rarity === "legendary"
              ? "bg-yellow-700 text-yellow-100"
              : rarity === "artifact"
              ? "bg-red-700 text-red-100"
              : "bg-gray-700 text-gray-200"
            }`}
        >
          {rarity}
        </span>
      </div>
      {/* Bottom Row: Slot, Quantity, Attunement */}
      <div className="flex items-center mt-1 justify-between">
        {slot && (
          <span className="text-xs text-cyan-300 italic">{slot}</span>
        )}
        {quantity !== undefined && (
          <span className="ml-auto mr-2 text-xs text-gray-300">
            x{quantity}
          </span>
        )}
        {attunement && (
          <span className="ml-2 px-2 py-0.5 bg-fuchsia-900 text-fuchsia-200 rounded text-xs">
            Requires Attunement
          </span>
        )}
        {/* Info icon for details */}
        <span
          className="ml-2 text-gray-400 hover:text-blue-400"
          tabIndex={0}
          aria-label="Show details"
        >
          <FaInfoCircle />
        </span>
      </div>
      {/* Tooltip/Popover */}
      {(hover || showDetails) && (
        <div className="absolute left-1/2 top-12 z-30 w-72 -translate-x-1/2 bg-[#191d24] border border-gray-800 shadow-2xl rounded-xl px-4 py-3 text-sm text-gray-100 pointer-events-none">
          <div className="font-bold text-base mb-1">{name}</div>
          <div className="mb-2 italic text-xs text-gray-400">{type}</div>
          <div className="">{description}</div>
        </div>
      )}
    </div>
  );
}
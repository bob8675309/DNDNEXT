// /components/MapOverlay.js

import { X, MapPin, User, Store } from "lucide-react"; // Use icons as needed, or replace with your SVGs

export default function MapOverlay({
  open,
  onClose,
  title = "Map Details",
  children,
  merchants = [],
  players = [],
  style = {},
}) {
  if (!open) return null;

  return (
    <div
      className="fixed top-6 right-6 z-50 w-[380px] max-w-[90vw] shadow-2xl rounded-2xl border border-gray-800 bg-[#23272f] text-gray-100 animate-in fade-in duration-200"
      style={style}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-lg">{title}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-red-500 rounded p-1 transition"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="px-5 py-4 space-y-4">
        {/* Merchants Section */}
        {merchants && merchants.length > 0 && (
          <div>
            <h3 className="text-blue-300 text-sm font-bold mb-1">Merchants</h3>
            <ul className="space-y-1">
              {merchants.map((merchant) => (
                <li
                  key={merchant.id}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#292e39] cursor-pointer group"
                  // onClick={() => ...open merchant inventory...}
                >
                  <Store className="w-4 h-4 text-yellow-400 group-hover:text-yellow-300" />
                  <span className="font-semibold">{merchant.name}</span>
                  <span className="ml-auto text-xs text-gray-400">{merchant.locationName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Players Section */}
        {players && players.length > 0 && (
          <div>
            <h3 className="text-green-300 text-sm font-bold mb-1">Players</h3>
            <ul className="space-y-1">
              {players.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#262b31] cursor-pointer"
                  // onClick={() => ...center map on player...}
                >
                  <User className="w-4 h-4 text-green-400" />
                  <span className="font-semibold">{player.username}</span>
                  <span className="ml-auto text-xs text-gray-400">{player.locationName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Custom Children */}
        {children}
      </div>
    </div>
  );
}
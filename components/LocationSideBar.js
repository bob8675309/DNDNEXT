// /components/LocationSidebar.js

import { X } from "lucide-react";

export default function LocationSidebar({ open, location, onClose, isAdmin }) {
  if (!open || !location) return null;

  return (
    <aside
      className={`
        fixed right-0 top-0 z-50 h-full w-[350px] max-w-[90vw]
        bg-[#23272f] border-l border-gray-800 shadow-2xl
        flex flex-col transition-transform duration-300
        ${open ? "translate-x-0" : "translate-x-full"}
      `}
      style={{ minWidth: "320px" }}
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {location.icon && (
            <span className="text-2xl">{location.icon}</span>
          )}
          <span className="font-bold text-xl">{location.name}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-red-400 rounded p-1 transition"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {location.description && (
          <div className="text-base text-gray-200">{location.description}</div>
        )}
        {/* Add more info as needed */}
        <div className="text-xs text-gray-400">
          X: {location.x}&nbsp; Y: {location.y}
        </div>
        {/* Admin Controls */}
        {isAdmin && (
          <div className="mt-6 border-t border-gray-700 pt-4">
            <div className="font-semibold text-yellow-300 mb-2">Admin Tools</div>
            <button className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 transition mb-2 block w-full">
              Edit Location
            </button>
            <button className="bg-red-800 text-white px-4 py-2 rounded hover:bg-red-900 transition block w-full">
              Delete Location
            </button>
            {/* Add additional admin controls as needed */}
          </div>
        )}
      </div>
    </aside>
  );
}

// /components/MapOverlay.js

import { X } from "lucide-react";

export default function MapOverlay({
  open,
  onClose,
  title = "Details",
  children,
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
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

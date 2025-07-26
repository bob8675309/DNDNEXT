import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Main Map component: receives locations, npcs, quests, etc as props
export default function Map({
  locations = [],
  flags = [],
  npcs = [],
  quests = [],
  player = null,
  onLocationClick = () => {},
  onMapClick = () => {},
  mapImage = "/map-background.jpg",
}) {
  const mapRef = useRef(null);

  // Map click handler (for placing flags, etc)
  const handleMapClick = (e) => {
    if (onMapClick && mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      onMapClick({ x, y, event: e });
    }
  };

  // Location click handler
  const handleLocationMarkerClick = (loc, e) => {
    e.stopPropagation();
    if (onLocationClick) onLocationClick(loc.id);
  };

  return (
    <div
      className="relative w-full h-[600px] bg-black overflow-hidden rounded-lg shadow-lg select-none"
      style={{ maxWidth: "1000px", margin: "0 auto" }}
    >
      {/* Map image */}
      <img
        ref={mapRef}
        src={mapImage}
        alt="Campaign Map"
        className="absolute top-0 left-0 w-full h-full object-cover"
        draggable={false}
        onClick={handleMapClick}
        style={{ zIndex: 1, cursor: "crosshair" }}
      />

      {/* Locations: render a marker for each */}
      {locations.map((loc) => (
        <div
          key={loc.id}
          className="absolute flex flex-col items-center group"
          style={{
            left: `${loc.x}%`,
            top: `${loc.y}%`,
            zIndex: 20,
            cursor: "pointer",
            pointerEvents: "auto",
            transform: "translate(-50%, -100%)" // centers pin tip
          }}
          onClick={(e) => handleLocationMarkerClick(loc, e)}
        >
          {/* Location marker: could be a custom SVG or icon */}
          <svg width="36" height="36">
            <circle
              cx="18"
              cy="18"
              r="12"
              fill="#b4d455"
              stroke="#2b2b2b"
              strokeWidth="3"
            />
          </svg>
          <span className="bg-gray-900 text-xs px-2 py-1 rounded shadow-lg mt-1 opacity-80 group-hover:opacity-100 transition">
            {loc.name}
          </span>
        </div>
      ))}

      {/* Flags (optional) */}
      <AnimatePresence>
        {flags.map((flag) => (
          <motion.div
            key={flag.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute"
            style={{
              left: `${flag.x}%`,
              top: `${flag.y}%`,
              zIndex: 5,
              pointerEvents: "none",
              transform: "translate(-50%, -100%)"
            }}
          >
            <svg height="32" width="32">
              <circle
                cx="16"
                cy="16"
                r="10"
                fill={flag.color || "red"}
                stroke="white"
                strokeWidth="2"
              />
            </svg>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

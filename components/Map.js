import React, { useState, useEffect, useRef } from "react";
import supabase from "../utils/supabaseClient"; // Corrected import path!
import { motion, AnimatePresence } from "framer-motion";
import { locationData as defaultLocationData } from "./MapNpcsQuests";

const Map = ({
  player,
  npcs = [],
  quests = [],
  editable = false,
  onFlagPlaced,
  initialFlags = [],
  mapImage = "/map-background.jpg",
}) => {
  const [flags, setFlags] = useState(initialFlags);
  const [locations, setLocations] = useState(defaultLocationData || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);

  useEffect(() => {
    async function fetchLocations() {
      setLoading(true);
      const { data, error } = await supabase.from("locations").select("*");
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      if (data && data.length) {
        setLocations(data);
      }
      setLoading(false);
    }
    fetchLocations();
  }, []);

  // Update flags if initialFlags prop changes
  useEffect(() => {
    setFlags(initialFlags);
  }, [initialFlags]);

  // Place or move flag on map click
  const handleMapClick = (e) => {
    if (!editable && !onFlagPlaced) return; // Only allow if editable or handler present
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newFlag = {
      id: player?.id || Date.now(),
      playerId: player?.id,
      color: player?.color || "red",
      x,
      y,
    };

    // Only one flag per player
    const updatedFlags = [
      ...flags.filter((f) => f.playerId !== newFlag.playerId),
      newFlag,
    ];
    setFlags(updatedFlags);
    if (onFlagPlaced) onFlagPlaced(newFlag);
  };

  // Remove a flag (admin or editable only)
  const handleFlagRemove = (flagId) => {
    if (!editable) return;
    setFlags((prev) => prev.filter((f) => f.id !== flagId));
  };

  // Optionally, handle dragging/placement for admins

  return (
    <div className="relative w-full h-[600px] bg-black overflow-hidden rounded-lg shadow-lg select-none">
      {error && (
        <div className="absolute top-0 left-0 right-0 p-2 bg-red-700 text-white z-20 text-center">
          Error: {error}
        </div>
      )}
      <img
        ref={mapRef}
        src={mapImage}
        alt="Campaign Map"
        className="absolute top-0 left-0 w-full h-full object-cover"
        draggable={false}
        onClick={handleMapClick}
        style={{ zIndex: 1, cursor: editable || onFlagPlaced ? "crosshair" : "default" }}
      />

      {/* Flags */}
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
              pointerEvents: "auto",
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
            {editable && (
              <button
                className="absolute -top-3 -right-3 bg-black text-white rounded-full px-1 text-xs"
                onClick={() => handleFlagRemove(flag.id)}
                style={{ zIndex: 20 }}
              >
                ×
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* NPCs */}
      {npcs.map((npc) => (
        <div
          key={npc.id}
          className="absolute flex flex-col items-center"
          style={{
            left: `${npc.x}%`,
            top: `${npc.y}%`,
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <span
            className="bg-yellow-700 text-xs px-2 py-1 rounded shadow-lg"
            style={{ marginBottom: 2 }}
          >
            {npc.name}
          </span>
          <svg height="28" width="28">
            <rect
              x="6"
              y="6"
              width="16"
              height="16"
              fill="gold"
              stroke="black"
              strokeWidth="2"
              rx="3"
            />
          </svg>
        </div>
      ))}

      {/* Quests */}
      {quests.map((quest) => (
        <div
          key={quest.id}
          className="absolute flex flex-col items-center"
          style={{
            left: `${quest.x}%`,
            top: `${quest.y}%`,
            zIndex: 11,
            pointerEvents: "none",
          }}
        >
          <span className="bg-blue-800 text-xs px-2 py-1 rounded shadow-lg" style={{ marginBottom: 2 }}>
            {quest.title}
          </span>
          <svg height="28" width="28">
            <polygon
              points="14,4 24,24 4,24"
              fill="deepskyblue"
              stroke="black"
              strokeWidth="2"
            />
          </svg>
        </div>
      ))}

      {/* Loading spinner (optional) */}
      {loading && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50 z-50">
          <span className="text-white text-lg">Loading...</span>
        </div>
      )}
    </div>
  );
};

export default Map;




import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import LocationSideBar from "../components/LocationSideBar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// If you want to modularize later, move the map image/svg logic to its own MapDisplay component
export default function MapPage() {
  const [locations, setLocations] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [quests, setQuests] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapDimensions, setMapDimensions] = useState({ width: 1920, height: 1080 });

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fetch all data from Supabase directly
        const { data: locs, error: locErr } = await supabase.from("locations").select("*");
        const { data: npcs, error: npcErr } = await supabase.from("npcs").select("*");
        const { data: quests, error: questErr } = await supabase.from("quests").select("*");

        if (locErr || npcErr || questErr) {
          setError("Failed to load map data.");
        } else {
          setLocations(locs || []);
          setNpcs(npcs || []);
          setQuests(quests || []);
        }
      } catch (err) {
        setError("Failed to load map data.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Join full NPCs and quests for the selected location
  function getLocationWithDetails(location) {
    if (!location) return null;
    const fullNpcs =
      Array.isArray(location.npcs) && typeof location.npcs[0] === "object"
        ? location.npcs
        : npcs.filter((npc) => location.npcs?.includes(npc.id));
    const fullQuests =
      Array.isArray(location.quests) && typeof location.quests[0] === "object"
        ? location.quests
        : quests.filter((quest) => location.quests?.includes(quest.id));
    return { ...location, npcs: fullNpcs, quests: fullQuests };
  }

  // Map click handler (for pins)
  function handleLocationClick(locationId) {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return;
    setSelectedLocation(getLocationWithDetails(loc));
  }

  function handleMapLoad(e) {
    setMapDimensions({
      width: e.target.naturalWidth,
      height: e.target.naturalHeight,
    });
  }

  if (loading) return <div className="p-6 text-2xl">Loading map...</div>;
  if (error) return <div className="p-6 text-red-700 text-xl">{error}</div>;

  return (
    <div className="relative min-h-screen bg-gray-900">
      {/* The map image */}
      <img
        src="/Wmap.jpg" // use your actual file path for the world map image!
        alt="World Map"
        className="w-full h-auto"
        onLoad={handleMapLoad}
        style={{ maxHeight: "90vh" }}
      />

      {/* SVG location pins */}
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={mapDimensions.width}
        height={mapDimensions.height}
        style={{
          width: "100%",
          height: "100%",
          zIndex: 10,
          pointerEvents: "none",
          position: "absolute",
        }}
      >
        {locations.map((loc) => {
          const x = Number(loc.x) || 0;
          const y = Number(loc.y) || 0;
          return (
            <circle
              key={loc.id}
              cx={x}
              cy={y}
              r={18}
              fill="rgba(234,179,8,0.88)" // amber-400
              stroke="#78350f" // amber-900
              strokeWidth={3}
              className="cursor-pointer pointer-events-auto transition hover:scale-110"
              onClick={() => handleLocationClick(loc.id)}
            />
          );
        })}
      </svg>

      {/* Sidebar */}
      <LocationSideBar
        location={selectedLocation}
        onClose={() => setSelectedLocation(null)}
      />

      {/* Overlay */}
      {selectedLocation && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-40"
          onClick={() => setSelectedLocation(null)}
        />
      )}
    </div>
  );
}

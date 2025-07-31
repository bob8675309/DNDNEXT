import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import LocationSideBar from "../components/LocationSideBar";

// Lazy-load map if it uses heavy dependencies
const MapDisplay = dynamic(() => import("../components/MapDisplay"), { ssr: false });

export default function MapPage() {
  const [locations, setLocations] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [quests, setQuests] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch all data on mount
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Replace with your actual API endpoints or util functions
        const [locRes, npcRes, questRes] = await Promise.all([
          fetch("/api/locations"),
          fetch("/api/npcs"),
          fetch("/api/quests"),
        ]);
        const [locs, npcs, quests] = await Promise.all([
          locRes.json(),
          npcRes.json(),
          questRes.json(),
        ]);
        setLocations(locs);
        setNpcs(npcs);
        setQuests(quests);
        setLoading(false);
      } catch (err) {
        setError("Failed to load map data.");
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Helper: join full NPCs and quests to location
  function getLocationWithDetails(location) {
    if (!location) return null;
    // If already has npcs as objects, use as-is
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

  // Handle clicking a location on the map
  function handleLocationClick(locationId) {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return;
    setSelectedLocation(getLocationWithDetails(loc));
  }

  // Handle closing the sidebar
  function handleCloseSideBar() {
    setSelectedLocation(null);
  }

  if (loading) return <div className="p-6 text-2xl">Loading map...</div>;
  if (error) return <div className="p-6 text-red-700 text-xl">{error}</div>;

  return (
    <div className="relative min-h-screen bg-gray-900">
      <MapDisplay
        locations={locations}
        onLocationClick={handleLocationClick}
      />

      {/* Right-side Location Sidebar */}
      <LocationSideBar
        location={selectedLocation}
        onClose={handleCloseSideBar}
      />

      {/* Overlay when sidebar is open (optional for UX) */}
      {selectedLocation && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-40"
          onClick={handleCloseSideBar}
        />
      )}
    </div>
  );
}

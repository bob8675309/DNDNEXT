import React, { useEffect, useState } from "react";
import supabase from "../utils/supabaseClient";
import dynamic from "next/dynamic";

// Dynamically import the Map and Side Panel for edit-in-map
const Map = dynamic(() => import("../components/Map"), { ssr: false });
const LocationSidePanel = dynamic(() => import("../components/LocationSidePanel"), { ssr: false });

export default function NPCListPage() {
  const [locations, setLocations] = useState([]);
  const [allNpcs, setAllNpcs] = useState([]);
  const [search, setSearch] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    async function fetchAll() {
      const { data, error } = await supabase.from("locations").select("*");
      if (error) {
        console.error(error);
        return;
      }
      setLocations(data || []);
      // Flatten NPCs and store location info
      const merged = [];
      (data || []).forEach(loc => {
        (loc.npcs || []).forEach(npc => {
          merged.push({
            ...npc,
            locationId: loc.id,
            locationName: loc.name,
            locationObj: loc
          });
        });
      });
      merged.sort((a, b) => a.name.localeCompare(b.name));
      setAllNpcs(merged);
    }
    fetchAll();
  }, []);

  const filtered = allNpcs.filter(npc =>
    npc.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Handler to open map and focus on the selected location
  const handleEditInMap = (locObj) => {
    setShowMap(true);
    setSelectedLocation(locObj);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold text-center mb-6">All NPCs</h1>
      <input
        className="mb-4 p-2 border rounded w-full text-black"
        placeholder="Search by name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div>
        {filtered.map(npc => (
          <div key={npc.name + "_" + npc.locationId} className="mb-4 p-4 border rounded bg-gray-800 shadow">
            <h4 className="font-bold text-lg">{npc.name}</h4>
            <p><strong>Role:</strong> {npc.role}</p>
            <p><strong>Faction:</strong> {npc.faction}</p>
            <p><strong>Personality:</strong> {npc.personality}</p>
            <p><strong>Backstory:</strong> {npc.backstory}</p>
            <p>
              <strong>Location:</strong> <span className="text-blue-300">{npc.locationName}</span>
            </p>
            <button
              className="mt-2 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              onClick={() => handleEditInMap(npc.locationObj)}
            >
              Edit in Map
            </button>
          </div>
        ))}
      </div>
      {/* Map and Side Panel for edit-in-map */}
      {showMap && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-70 z-40" onClick={() => setShowMap(false)} />
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1">
              <Map
                locations={locations}
                onLocationClick={id => {
                  const loc = locations.find(l => l.id === id);
                  setSelectedLocation(loc);
                }}
              />
            </div>
            <LocationSidePanel
              location={selectedLocation}
              onClose={() => setShowMap(false)}
              onLocationUpdate={(updatedLoc) => {
                setLocations(locs => locs.map(l => l.id === updatedLoc.id ? updatedLoc : l));
                setSelectedLocation(updatedLoc);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

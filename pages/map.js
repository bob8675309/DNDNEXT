import dynamic from "next/dynamic";
import React from "react";
import { locationData } from "../components/MapNpcsQuests";

// Extract coordinates and names for map markers
const locations = [
  {
    id: "prescott-farm",
    name: "Prescott Farm",
    x: 20, // percent across image
    y: 78, // percent down image
  },
  {
    id: "gray-hall",
    name: "Gray Hall",
    x: 65,
    y: 20,
  },
  {
    id: "fort-tiber",
    name: "Fort Tiber",
    x: 42,
    y: 51,
  },
];

// Sample player & overlays for demo/testing
const samplePlayer = {
  id: "player1",
  color: "red"
};

const sampleNpcs = [
  { id: "npc1", name: "Eldrin the Wise", x: 40, y: 60 }
];
const sampleQuests = [
  { id: "quest1", title: "Recover the Gem", x: 70, y: 20 }
];

// Dynamic import for SSR safety
const Map = dynamic(() => import("../components/Map"), { ssr: false });
const MapNpcsQuests = dynamic(() => import("../components/MapNpcsQuests"), { ssr: false });

export default function MapPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-center py-4">Interactive Campaign Map</h1>
        <Map
          locations={locations}
          player={samplePlayer}
          npcs={sampleNpcs}
          quests={sampleQuests}
        />
      </div>
      <aside className="md:w-1/3 w-full bg-gray-900 p-4 overflow-y-auto">
        <MapNpcsQuests locations={locationData} />
      </aside>
    </div>
  );
}

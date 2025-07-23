import dynamic from "next/dynamic";
import React from "react";

// Dynamically import components to avoid SSR conflicts
const Map = dynamic(() => import("../components/Map"), { ssr: false });
const MapNpcsQuests = dynamic(() => import("../components/MapNpcsQuests"), { ssr: false });

// Dummy data for testing; replace with Supabase calls or props
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

export default function MapPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <h1 className="text-3xl font-bold text-center py-4">Interactive Campaign Map</h1>

      {/* The Map component receives player, npcs, and quests as props */}
      <Map
        player={samplePlayer}
        npcs={sampleNpcs}
        quests={sampleQuests}
      />

      {/* Optional: Overlay manager */}
      <div className="p-4">
        <MapNpcsQuests
          npcs={sampleNpcs}
          quests={sampleQuests}
          onNpcUpdate={() => {}}
          onQuestUpdate={() => {}}
        />
      </div>
    </div>
  );
}

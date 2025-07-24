import React, { useState, useEffect } from "react";
import NpcEditor from "./npcs";
import QuestEditor from "./quests";

const LocationSidePanel = ({ location, onClose, onLocationUpdate }) => {
  const [tab, setTab] = useState("npcs");
  const [currentLoc, setCurrentLoc] = useState(location);

  useEffect(() => {
    setCurrentLoc(location);
  }, [location]);

  const handleNpcsChange = (npcs) => {
    const updated = { ...currentLoc, npcs };
    setCurrentLoc(updated);
    if (onLocationUpdate) onLocationUpdate(updated);
  };
  const handleQuestsChange = (quests) => {
    const updated = { ...currentLoc, quests };
    setCurrentLoc(updated);
    if (onLocationUpdate) onLocationUpdate(updated);
  };

  if (!currentLoc) return null;

  return (
    <aside className="fixed right-0 top-0 h-full w-96 bg-gray-900 text-white shadow-xl z-40 flex flex-col border-l border-gray-700">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div>
          <h2 className="text-2xl font-bold">{currentLoc.name}</h2>
          {currentLoc.description && (
            <p className="text-gray-300 text-sm">{currentLoc.description}</p>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl ml-2">
            ×
          </button>
        )}
      </div>
      <div className="flex border-b border-gray-800">
        <button
          className={`flex-1 py-2 font-semibold ${tab === "npcs" ? "bg-gray-800" : ""}`}
          onClick={() => setTab("npcs")}
        >
          NPCs
        </button>
        <button
          className={`flex-1 py-2 font-semibold ${tab === "quests" ? "bg-gray-800" : ""}`}
          onClick={() => setTab("quests")}
        >
          Quests
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === "npcs" && (
          <NpcEditor location={currentLoc} onChange={handleNpcsChange} />
        )}
        {tab === "quests" && (
          <QuestEditor location={currentLoc} onChange={handleQuestsChange} />
        )}
      </div>
    </aside>
  );
};

export default LocationSidePanel;

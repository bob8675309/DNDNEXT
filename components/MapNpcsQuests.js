// /components/MapNpcsQuests.js

import React from "react";

export default function MapNpcsQuests({ npcs = [], quests = [], onNpcClick, onQuestClick }) {
  return (
    <div>
      <div className="mb-2">
        <h3 className="font-semibold text-lg text-cyan-400 mb-1">NPCs on Map</h3>
        <ul className="space-y-1">
          {npcs.length === 0 && (
            <li className="text-gray-400 italic">No NPCs on map.</li>
          )}
          {npcs.map((npc) => (
            <li
              key={npc.id}
              className="cursor-pointer hover:text-cyan-300"
              onClick={() => onNpcClick && onNpcClick(npc)}
            >
              {npc.name}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold text-lg text-amber-400 mb-1">Quests</h3>
        <ul className="space-y-1">
          {quests.length === 0 && (
            <li className="text-gray-400 italic">No quests active.</li>
          )}
          {quests.map((quest) => (
            <li
              key={quest.id}
              className="cursor-pointer hover:text-amber-300"
              onClick={() => onQuestClick && onQuestClick(quest)}
            >
              {quest.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

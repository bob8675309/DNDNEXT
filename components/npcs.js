// /components/npcs.js

import InventoryGrid from "./InventoryGrid";

export default function NpcCard({ npc }) {
  if (!npc) return null;
  return (
    <div className="bg-[#23272f] p-4 rounded-xl shadow border border-gray-800 mb-4">
      <div className="font-bold text-lg text-cyan-300">{npc.name}</div>
      {npc.description && <div className="text-sm text-gray-300 mb-2">{npc.description}</div>}
      {npc.inventory && npc.inventory.length > 0 && (
        <>
          <div className="text-xs font-bold text-gray-400 mb-1 mt-2">Inventory:</div>
          <InventoryGrid items={npc.inventory} />
        </>
      )}
    </div>
  );
}

// /pages/npcs.js

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import InventoryGrid from "../components/InventoryGrid";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function NpcsPage() {
  const [npcs, setNpcs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNpcs() {
      const { data, error } = await supabase.from("npcs").select("*");
      if (!error && data) setNpcs(data);
      setLoading(false);
    }
    fetchNpcs();
  }, []);

  if (loading) {
    return <div className="p-8 text-gray-400">Loading NPCs...</div>;
  }

  if (!npcs.length) {
    return <div className="p-8 text-gray-400">No NPCs found.</div>;
  }

  return (
    <div className="min-h-screen bg-[#191d24] text-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">NPCs</h1>
      <div className="space-y-8">
        {npcs.map(npc => (
          <div key={npc.id} className="bg-[#23272f] p-6 rounded-xl shadow border border-gray-800">
            <div className="text-xl font-semibold mb-2">{npc.name}</div>
            <div className="text-sm text-gray-400 mb-2">{npc.description}</div>
            {npc.inventory && npc.inventory.length > 0 && (
              <>
                <div className="font-bold text-gray-300 mb-1">Inventory:</div>
                <InventoryGrid items={npc.inventory} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export const NPCEditor = () => {
  const [npcs, setNpcs] = useState([]);
  const [newNpc, setNewNpc] = useState({
    name: "",
    role: "",
    faction: "",
    personality: "",
    backstory: "",
    location: ""
  });

  useEffect(() => {
    const fetchNPCs = async () => {
      const { data, error } = await supabase.from("npcs").select("*");
      if (error) console.error("Error loading NPCs:", error);
      else setNpcs(data);
    };
    fetchNPCs();
  }, []);

  const handleChange = (e) => {
    setNewNpc({ ...newNpc, [e.target.name]: e.target.value });
  };

  const handleAdd = async () => {
    const { data, error } = await supabase.from("npcs").insert([newNpc]).select();
    if (error) console.error("Error adding NPC:", error);
    else {
      setNpcs([...npcs, data[0]]);
      setNewNpc({ name: "", role: "", faction: "", personality: "", backstory: "", location: "" });
    }
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("npcs").delete().eq("id", id);
    if (error) console.error("Error deleting NPC:", error);
    else setNpcs(npcs.filter((n) => n.id !== id));
  };

  return (
    <div>
      <div className="mb-6 p-4 border rounded bg-white shadow">
        <h3 className="text-lg font-semibold mb-2">Add New NPC</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(newNpc).map((key) => (
            <input
              key={key}
              name={key}
              value={newNpc[key]}
              onChange={handleChange}
              placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
              className="border p-2 rounded"
            />
          ))}
        </div>
        <button
          onClick={handleAdd}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add NPC
        </button>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Existing NPCs</h3>
        {npcs.map((npc) => (
          <div key={npc.id} className="mb-4 p-4 border rounded bg-white shadow">
            <h4 className="font-bold">{npc.name}</h4>
            <p><strong>Role:</strong> {npc.role}</p>
            <p><strong>Faction:</strong> {npc.faction}</p>
            <p><strong>Personality:</strong> {npc.personality}</p>
            <p><strong>Backstory:</strong> {npc.backstory}</p>
            <p><strong>Location:</strong> {npc.location}</p>
            <button
              onClick={() => handleDelete(npc.id)}
              className="mt-2 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};


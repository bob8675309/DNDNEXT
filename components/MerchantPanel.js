import React, { useEffect, useState } from 'react';
import supabase from '../utils/supabaseClient';

export default function MerchantPanel() {
  const [merchants, setMerchants] = useState([]);
  const [name, setName] = useState("");

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    const { data, error } = await supabase.from("merchants").select("*");
    if (!error) setMerchants(data);
  };

  const addMerchant = async () => {
    if (!name) return;
    await supabase.from("merchants").insert({ name, x: 50, y: 50, inventory: [] });
    setName("");
    fetchMerchants();
  };

  const removeMerchant = async (id) => {
    await supabase.from("merchants").delete().eq("id", id);
    fetchMerchants();
  };

  return (
    <div className="text-white">
      <h2 className="text-xl font-bold mb-4">Manage Merchants</h2>
      <div className="mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-black p-2 rounded mr-2"
          placeholder="New merchant name"
        />
        <button onClick={addMerchant} className="bg-green-600 px-4 py-2 rounded">
          Add
        </button>
      </div>
      <ul>
        {merchants.map((m) => (
          <li key={m.id} className="mb-2 flex justify-between items-center">
            <span>{m.name} ({m.x}, {m.y})</span>
            <button onClick={() => removeMerchant(m.id)} className="bg-red-600 px-2 py-1 rounded">
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import supabase from '../supabaseClient';
// /components/InventoryGrid.js

import ItemCard from "./ItemCard";

export default function InventoryGrid({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-gray-400 p-8 text-center italic">
        Inventory empty.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
      {items.map((item, i) => (
        <ItemCard key={item.id || i} item={item} />
      ))}
    </div>
  );
}

  // Load user and inventory
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        fetchInventory(user.id);
      }
    };
    fetchUser();
  }, []);

  const fetchInventory = async (user_id) => {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', user_id);
    if (error) console.error('Fetch error:', error);
    else setInventory(data);
  };

  const addItem = async (item) => {
    const { error } = await supabase.from('inventory_items').insert([
      {
        user_id: user.id,
        item_id: item.id,
        item_name: item.name,
        item_type: item.type,
        item_rarity: item.rarity,
        item_description: item.description,
        item_weight: item.weight,
        item_cost: item.cost,
      }
    ]);
    if (error) console.error('Insert error:', error);
    else fetchInventory(user.id); // refresh list
  };

  const removeItem = async (id) => {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id);
    if (error) console.error('Delete error:', error);
    else fetchInventory(user.id); // refresh list
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Your Inventory</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {inventory.map(item => (
          <div key={item.id} className="relative">
            <ItemCard item={item} />
            <button
              onClick={() => removeItem(item.id)}
              className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

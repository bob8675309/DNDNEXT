// /pages/deck.js

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "../components/ItemCard";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ItemDeckPage() {
  const [items, setItems] = useState([]);
  const [dealtCards, setDealtCards] = useState([]);

  useEffect(() => {
    async function fetchItems() {
      const { data, error } = await supabase.from("items").select("*");
      if (!error && data) setItems(data);
    }
    fetchItems();
  }, []);

  const dealCard = () => {
    if (!items || items.length === 0) return;
    const undealt = items.filter(item => !dealtCards.includes(item));
    if (undealt.length === 0) return;
    const newCard = undealt[Math.floor(Math.random() * undealt.length)];
    setDealtCards(prev => [...prev, newCard]);
  };

  return (
    <div className="min-h-screen bg-[#191d24] text-gray-100 p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Deal Item Cards</h1>
        <button
          onClick={dealCard}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
        >
          Deal a Card
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {dealtCards.map((item, index) => (
          <ItemCard key={item.id || index} item={item} />
        ))}
      </div>
      {dealtCards.length === 0 && (
        <div className="text-center text-gray-400 mt-12">
          No cards have been dealt yet.
        </div>
      )}
    </div>
  );
}

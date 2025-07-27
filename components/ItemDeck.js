// /components/ItemDeck.js

import { useState } from "react";
import ItemCard from "./ItemCard";

export default function ItemDeck({ items }) {
  const [dealtCards, setDealtCards] = useState([]);

  const dealCard = () => {
    if (!items || items.length === 0) return;
    const undealt = items.filter(item => !dealtCards.includes(item));
    if (undealt.length === 0) return;
    const newCard = undealt[Math.floor(Math.random() * undealt.length)];
    setDealtCards(prev => [...prev, newCard]);
  };

  if (!items || items.length === 0) {
    return (
      <div className="text-gray-400 p-8 text-center italic">
        Deck is empty.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-white">Dealt Item Cards</h2>
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
    </div>
  );
}


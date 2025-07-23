import React, { useState, useEffect } from "react";
import ItemCard from "./ItemCard";

export default function ItemDeck() {
  const [allItems, setAllItems] = useState([]);
  const [dealtCards, setDealtCards] = useState([]);

  useEffect(() => {
    fetch("/items/all-items.json")
      .then(res => res.json())
      .then(data => setAllItems(data))
      .catch(err => console.error("Failed to load items:", err));
  }, []);

  const dealCard = () => {
    const remainingItems = allItems.filter(item => !dealtCards.includes(item));
    if (remainingItems.length === 0) return;

    const newCard = remainingItems[Math.floor(Math.random() * remainingItems.length)];
    setDealtCards(prev => [...prev, newCard]);
  };

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
          <ItemCard key={index} item={item} />
        ))}
      </div>
    </div>
  );
}

// /components/AlchemyPanel.js

import ItemCard from "./ItemCard";

export default function AlchemyPanel({ plants = [], recipes = [] }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="font-bold text-lg text-green-400 mb-2">Found Plants</h2>
        {plants.length === 0 ? (
          <div className="text-gray-400 italic">No plants found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {plants.map((plant, i) => (
              <ItemCard key={plant.id || i} item={plant} />
            ))}
          </div>
        )}
      </div>
      <div>
        <h2 className="font-bold text-lg text-blue-400 mb-2">Craftable Recipes</h2>
        {recipes.length === 0 ? (
          <div className="text-gray-400 italic">No recipes available.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {recipes.map((recipe, i) => (
              <ItemCard key={recipe.id || i} item={recipe} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
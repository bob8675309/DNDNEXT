import React, { useState, useEffect } from "react";
import supabase from "../utils/supabaseClient";

export default function AlchemyPanel() {
  const [plants, setPlants] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [roll, setRoll] = useState(1);
  const [selectedPlant, setSelectedPlant] = useState(null);

  useEffect(() => { fetchAlchemyData(); }, []);
  useEffect(() => {
    const match = plants.find(p => p.roll === Number(roll));
    setSelectedPlant(match || null);
  }, [roll, plants]);

  const fetchAlchemyData = async () => {
    const { data: plantData } = await supabase.from("plants").select("*");
    const { data: recipeData } = await supabase.from("recipes").select("*");
    setPlants(plantData || []);
    setRecipes(recipeData || []);
  };

  const relatedRecipes = selectedPlant
    ? recipes.filter(r => (r.ingredients || []).some(ing => ing.toLowerCase() === selectedPlant.name.toLowerCase()))
    : [];

  return (
    <div className="text-white mt-12">
      <h2 className="text-xl font-bold mb-4">Alchemy Panel</h2>
      <label className="block mb-2">Enter d30 Roll (1-30):</label>
      <input type="number" min="1" max="30" value={roll}
        onChange={(e) => setRoll(e.target.value)}
        className="text-black px-3 py-2 rounded mb-4 w-24" />
      {selectedPlant && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold">{selectedPlant.name}</h3>
          <p><strong>Rarity:</strong> {selectedPlant.rarity}</p>
          <p><strong>Effect:</strong> {selectedPlant.effect}</p>
          <p><strong>Found in:</strong> {selectedPlant.found_in}</p>
        </div>
      )}
      {relatedRecipes.length > 0 && (
        <div>
          <h4 className="text-md font-semibold mb-2">Usable in Potions:</h4>
          <ul className="list-disc list-inside">
            {relatedRecipes.map(r => (
              <li key={r.id}><strong>{r.name}:</strong> {r.description}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

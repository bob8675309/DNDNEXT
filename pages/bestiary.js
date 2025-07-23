import React from "react";
import bestiary from "../data/bestiary.json";

export default function Bestiary() {
  return (
    <div className="p-10">
      <h2>Bestiary</h2>
      <ul>
        {bestiary.map((creature) => (
          <li key={creature.name}>
            <h4>{creature.name}</h4>
            <p>{creature.challenge_rating}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

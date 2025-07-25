// /pages/bestiary.js
import React from "react";

// --- Kaorti and related monsters for your campaign ---
const bestiary = [
  {
    name: "Lesser Kaorti",
    type: "Aberration",
    challenge: "2",
    description:
      "Larval-stage Kaorti, a mass of ichor and warped flesh, consumed by madness. Most are feral and unintelligent, but a few survive long enough to master ichor-shaping and condense armor.",
    abilities: [
      "Ichor Bite",
      "Warped Resilience",
      "Maddening Screech",
      "Ichor Splash (short cooldown)",
      "Reshape Flesh (short cooldown)"
    ]
  },
  {
    name: "Ascended Kaorti Fighter",
    type: "Aberration",
    challenge: "5",
    description:
      "Kaorti who have mastered ichor-shaping, condensing their form into black armor-like shells. Retain fragments of combat training.",
    abilities: [
      "Ichor Blade",
      "Chitin Armor",
      "Paralyzing Strike",
      "Ichor Javelin (short cooldown)",
      "Shell Harden (short cooldown)"
    ]
  },
  {
    name: "Kaorti Infiltrator",
    type: "Aberration",
    challenge: "4",
    description:
      "Kaorti that specialize in shapeshifting and illusion, able to impersonate victims and sow chaos.",
    abilities: [
      "False Visage",
      "Invisibility",
      "Whispered Madness",
      "Ichor Doppelganger (short cooldown)",
      "Unravel Reality (short cooldown)"
    ]
  },
  {
    name: "Kaorti Warlock/Cleric",
    type: "Aberration",
    challenge: "6",
    description:
      "Kaorti deeply connected to Zurguth, wielding corrupting magic, curses, and the power of the Far Realm.",
    abilities: [
      "Warp Reality",
      "Eldritch Blast",
      "Kaorti Hex",
      "Ichor Ritual (short cooldown)",
      "Invoke Zurguth (short cooldown)"
    ]
  },
  {
    name: "Kaorti Thrall",
    type: "Aberration",
    challenge: "Varies",
    description:
      "Any beast or monster infected and reshaped by Kaorti ichor. They become clone-like, obedient to the Kaorti's will.",
    abilities: [
      "Ferocious Bite",
      "Ichor Spray",
      "Unnatural Strength"
    ]
  },
  {
    name: "Chuck (Aboleth Ally)",
    type: "Aberration",
    challenge: "10",
    description:
      "Chuck is an Aboleth disguised as a portly, auburn-haired knight in silver plate armor. When in danger, he reverts to his aboleth form and uses powerful psionics. If killed, returns to Zurguth in the Far Realm.",
    abilities: [
      "Psionic Lash",
      "Maddening Illusion",
      "Tentacle Slam",
      "Revert to True Form",
      "Summon Kaorti Thralls"
    ]
  },
  {
    name: "True Kaorti (Far Realm)",
    type: "Aberration",
    challenge: "???",
    description:
      "The original twelve Quin wizards, now ancient, immortal Kaorti in the Far Realm. They act as a hive mind, issuing commands to all lesser Kaorti through dreams and whispers.",
    abilities: [
      "Hive Mind Command",
      "Dream Invasion",
      "Rift Manipulation",
      "Ichor Flood",
      "Eldritch Edict"
    ]
  }
];

// --- Component Render ---
export default function BestiaryPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Kaorti Bestiary</h1>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {bestiary.map((monster) => (
          <div key={monster.name} className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-purple-400 mb-2">{monster.name}</h2>
            <div className="mb-2 text-sm text-gray-300 italic">{monster.type} (CR {monster.challenge})</div>
            <p className="mb-2">{monster.description}</p>
            {monster.abilities && (
              <ul className="list-disc pl-5 mb-2">
                {monster.abilities.map((ab, i) => (
                  <li key={i}>{ab}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

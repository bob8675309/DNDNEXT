import {
  FaBookOpen,
  FaComments,
  FaEye,
  FaFistRaised,
  FaShieldAlt,
  FaShoePrints,
} from "react-icons/fa";

const ICONS = Object.freeze({
  str: FaFistRaised,
  dex: FaShoePrints,
  con: FaShieldAlt,
  int: FaBookOpen,
  wis: FaEye,
  cha: FaComments,
});

export const ABILITY_SHORT_GUIDE = Object.freeze({
  str: "Physical power and carrying capacity.",
  dex: "Agility, reflexes, and fine motor control.",
  con: "Health, stamina, and toughness.",
  int: "Reasoning, memory, and knowledge.",
  wis: "Perception, awareness, and intuition.",
  cha: "Personality, influence, and presence.",
});

export const ABILITY_WALL_COPY = Object.freeze({
  str: "Power, Athletics, melee combat",
  dex: "Agility, Acrobatics, Stealth, finesse",
  con: "Health, endurance, resilience",
  int: "Knowledge, Arcana, Investigation",
  wis: "Perception, Insight, survival",
  cha: "Presence, Persuasion, deception",
});

export const ABILITY_DETAILED_GUIDE = Object.freeze({
  str: {
    description: "Strength measures physical power: how forcefully a character can lift, push, climb, grapple, and strike.",
    uses: [
      "Athletics checks for climbing, jumping, swimming, grappling, and shoving.",
      "Attack and damage rolls with most melee weapons.",
      "Carrying capacity and saves against effects that physically move or restrain you.",
    ],
  },
  dex: {
    description: "Dexterity measures agility, reflexes, balance, and precise control of movement.",
    uses: [
      "Acrobatics, Sleight of Hand, and Stealth checks.",
      "Initiative, Armor Class in lighter armor, and ranged or finesse weapon attacks.",
      "Saving throws to dodge explosions, traps, breath weapons, and similar hazards.",
    ],
  },
  con: {
    description: "Constitution measures health, stamina, durability, and the ability to endure hardship.",
    uses: [
      "Maximum hit points gained at every character level.",
      "Concentration saves while maintaining spells after taking damage.",
      "Saves against poison, disease, exhaustion, and other bodily threats.",
    ],
  },
  int: {
    description: "Intelligence measures reasoning, memory, education, and the ability to uncover useful facts.",
    uses: [
      "Arcana, History, Investigation, Nature, and Religion checks.",
      "Recalling lore, recognizing clues, and making logical deductions.",
      "Spellcasting for Artificers, Wizards, and features that name Intelligence.",
    ],
  },
  wis: {
    description: "Wisdom measures awareness, intuition, empathy, and practical understanding of the world.",
    uses: [
      "Animal Handling, Insight, Medicine, Perception, and Survival checks.",
      "Noticing hidden creatures, danger, motives, and changes in the environment.",
      "Spellcasting for Clerics, Druids, and Rangers, plus many mental saving throws.",
    ],
  },
  cha: {
    description: "Charisma measures confidence, presence, social influence, and force of personality.",
    uses: [
      "Deception, Intimidation, Performance, and Persuasion checks.",
      "Leading, negotiating, entertaining, and imposing your will in social scenes.",
      "Spellcasting for Bards, Paladins, Sorcerers, and Warlocks.",
    ],
  },
});

export default function NpcForgeAbilityGlyph({ ability = "str", compact = false }) {
  const Icon = ICONS[ability] || ICONS.str;
  return <span className={`npc-forge-ability-glyph is-${ability}${compact ? " is-compact" : ""}`} aria-hidden="true"><Icon focusable="false" /></span>;
}

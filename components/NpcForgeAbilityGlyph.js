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

export default function NpcForgeAbilityGlyph({ ability = "str", compact = false }) {
  const Icon = ICONS[ability] || ICONS.str;
  return <span className={`npc-forge-ability-glyph is-${ability}${compact ? " is-compact" : ""}`} aria-hidden="true"><Icon focusable="false" /></span>;
}

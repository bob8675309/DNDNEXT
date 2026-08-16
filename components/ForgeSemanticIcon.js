import {
  FaBookOpen,
  FaComments,
  FaDragon,
  FaEye,
  FaFeatherAlt,
  FaFireAlt,
  FaFistRaised,
  FaIdCard,
  FaMagic,
  FaMountain,
  FaRulerVertical,
  FaScroll,
  FaShieldAlt,
  FaShoePrints,
  FaSwimmer,
  FaUserCircle,
} from "react-icons/fa";

const ICON_BY_KIND = Object.freeze({
  ancestry: FaDragon,
  attack: FaFistRaised,
  breath: FaFireAlt,
  climb: FaMountain,
  creature: FaUserCircle,
  feature: FaScroll,
  flight: FaFeatherAlt,
  identity: FaIdCard,
  languages: FaComments,
  magic: FaMagic,
  proficiency: FaBookOpen,
  resistance: FaShieldAlt,
  size: FaRulerVertical,
  speed: FaShoePrints,
  swim: FaSwimmer,
  vision: FaEye,
});

export function speciesFeatureIconKind(label = "") {
  const value = String(label || "").trim().toLowerCase();
  if (/\blanguages?\b/.test(value)) return "languages";
  if (/darkvision|vision|sight|senses?/.test(value)) return "vision";
  if (/\bbreath\b|exhal/.test(value)) return "breath";
  if (/resistan|resilien|endurance|durable/.test(value)) return "resistance";
  if (/flight|\bfly\b|wings?/.test(value)) return "flight";
  if (/swim|amphibious|aquatic/.test(value)) return "swim";
  if (/climb|mountain/.test(value)) return "climb";
  if (/speed|movement|\bwalk\b|fleet|swift|mobile/.test(value)) return "speed";
  if (/\bsize\b|stature/.test(value)) return "size";
  if (/creature type|humanoid|construct|\bfey\b|undead/.test(value)) return "creature";
  if (/ancestry|lineage|legacy|heritage|\borigin\b/.test(value)) return "ancestry";
  if (/spell|cantrip|magic|arcane|innate|psionic/.test(value)) return "magic";
  if (/skill|proficien|training|knowledge/.test(value)) return "proficiency";
  if (/attack|weapon|claw|bite|talon|unarmed/.test(value)) return "attack";
  return "feature";
}

export default function ForgeSemanticIcon({ kind = "feature", label = "" }) {
  const resolvedKind = kind === "feature" && label ? speciesFeatureIconKind(label) : kind;
  const Icon = ICON_BY_KIND[resolvedKind] || ICON_BY_KIND.feature;
  return <span className={`forge-semantic-icon is-${resolvedKind}`} aria-hidden="true"><Icon focusable="false" /></span>;
}

// pages/items.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";

const TABS = [
  ["recipes", "📘", "Recipes"],
  ["materials", "🧱", "Materials"],
  ["plans", "📋", "Craft Plans"],
  ["discovery", "🧭", "Discovery"],
  ["forage", "🌿", "Foraging"],
  ["mastery", "⭐", "Mastery"],
];

const FORGE_CODES = new Set(["M", "R", "A", "LA", "MA", "HA", "S"]);
const PHYSICAL_VARIANTS = new Set(["enhancement", "adamantine", "mithral", "silvered", "ruidium"]);
const FUTURE_RE = /future|modern|futuristic|antimatter|laser|automatic\s+(pistol|rifle)|\b(pistol|musket|rifle|revolver|shotgun|carbine)\b|firearm\s+(bullet|needle|ammunition)|hunting rifle|modern rifle|alien firearm/i;
const RARITY_ORDER = ["Mundane", "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Varies"];

// Alchemy v1 rules notes:
// - Local UI/catalog implementation only; no DB migration required for this pass.
// - Later Supabase merge should preserve payload.alchemy from public/items/alchemy-catalog.json.
// - Three core slots create Brew Quality Steps when their rarity exceeds the formula rarity.
// - Every 3 Quality Steps raises the finished brew by one rarity tier and therefore raises its base Craft DC.
// - Core ingredient DC reduction is capped at the finished brew tier; fourth-slot modifiers normally do not reduce DC unless explicit.
// - Ingredient attribute budgets: Common 25%; Uncommon 75% or +1 plus 25%; Rare 100% or +1 plus 50%; Very Rare 125%, +2 plus 75%, +3 plus 25%, or Die step +1 plus 25%.
// - Neutral player-facing brew tags direct fourth-slot compatibility. Recipes determine resistance, immunity, damage, oil, bomb, or condition behavior.
const ALCHEMY_BASE_DC_BY_RARITY = { Mundane: 16, Common: 16, Uncommon: 22, Rare: 28, "Very Rare": 34, Legendary: 40, Varies: 16 };
const ALCHEMY_FINAL_DC_FLOOR = 10;
const ALCHEMY_RARITY_DC_REDUCTION = { Mundane: 0, Common: 0, Uncommon: 2, Rare: 4, "Very Rare": 6, Legendary: 8, Varies: 0 };
const ALCHEMY_BREW_RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
const ALCHEMY_DICE_STEPS = ["d4", "d6", "d8", "d10", "d12"];
const ALCHEMY_DURATION_UNIT_STEPS = ["minutes", "hours", "days", "weeks"];
const ALCHEMY_SECTIONS = ["All", "Potions", "Poisons", "Bombs", "Elixirs", "Oils"];
const ENCHANTING_SECTIONS = ["All", "Melee Weapon", "Ranged Weapon", "Ammo", "Armor", "Shield"];
const TEMPER_DAMAGE_TYPES = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];
const SMITHING_MATERIAL_CATALOG = [
  { name: "Mithral Ingot", category: "Ore / Metal", rarity: "Rare", dc: 2, materialClass: "Legendary Metal", offensive: "Lightens a weapon without weakening it. Heavy weapons become easier to ready, and agile weapon designs retain full strength.", defensive: "Halves the finished item's weight and removes normal Strength requirements and Stealth disadvantage caused by the armor.", risk: "Requires exact heat control; overheating ruins its flexibility." },
  { name: "Adamantine Bar", category: "Ore / Metal", rarity: "Very Rare", dc: 3, materialClass: "Legendary Metal", offensive: "Creates an exceptionally hard edge or striking face suited to sundering objects, armor, and reinforced structures.", defensive: "Reinforces armor and shields against catastrophic impacts and critical-hit deformation.", risk: "Extremely difficult to shape; failed work can damage tools or waste the stock." },
  { name: "Orichalcum Ingot", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Legendary Metal", offensive: "Channels spell energy through the weapon, making it an excellent foundation for elemental and radiant tempering.", defensive: "Holds a stable arcane ward that improves resistance to magical strain and later enchantment binding.", risk: "Stored magic can discharge if the alloy is worked unevenly." },
  { name: "Cold Iron Ingot", category: "Ore / Metal", rarity: "Rare", dc: 3, materialClass: "Legendary Metal", offensive: "Its deep-forged edge disrupts fey glamour and planar protections.", defensive: "Dampens fey influence, charm effects, and hostile planar resonance around the wearer.", risk: "Never expose it to ordinary forge heat; it must be pressure-worked and rune-cooled." },
  { name: "Dragonhide", category: "Monster Part", rarity: "Very Rare", dc: 4, materialClass: "Organic & Botanical", offensive: "A dragon-derived grip, lash, bow limb, or striking surface can carry the damage type associated with the harvested dragon.", defensive: "Armor or shields retain a measure of the dragon's elemental resilience, keyed to the harvested dragon.", risk: "Mismatched essences can make the material brittle or violently reactive." },
  { name: "Ironwood Heartwood", category: "Material", rarity: "Rare", dc: 2, materialClass: "Organic & Botanical", offensive: "Produces dense wooden weapons that strike like steel while remaining compatible with druidic and nature magic.", defensive: "Can replace metal plates or shield faces with a lighter, nonmetal defense of comparable strength.", risk: "Must be cured slowly; hurried drying causes hidden internal splits." },
  { name: "Deep Coral Plate", category: "Monster Part", rarity: "Rare", dc: 3, materialClass: "Organic & Botanical", offensive: "Forms barbed aquatic points that resist corrosion and maintain a keen edge underwater.", defensive: "Creates pressure-resistant armor and shields suited to deep water and aquatic environments.", risk: "Dries and fractures unless kept mineral-treated throughout shaping." },
  { name: "Umbral Chitin", category: "Monster Part", rarity: "Uncommon", dc: 2, materialClass: "Organic & Botanical", offensive: "Creates light serrated blades, spikes, and ammunition with excellent cutting geometry.", defensive: "Builds lightweight layered armor that spreads impact without the weight of forged plate.", risk: "Heat destroys its structure; it must be cut, laminated, and resin-bound." },
  { name: "Obsidian Edgeglass", category: "Material", rarity: "Uncommon", dc: 2, materialClass: "Crystal & Mineral", offensive: "Takes a supernatural razor edge suited to slashing, piercing, and critical-hit focused weapons.", defensive: "Reflective plates resist heat and magical glare but remain vulnerable to repeated blunt impact.", risk: "Exceptionally sharp and brittle; failed shaping can shatter the full piece." },
  { name: "Blood Glass", category: "Material", rarity: "Rare", dc: 4, materialClass: "Crystal & Mineral", offensive: "Serves as a powerful conduit for necrotic, curse, and life-draining enchantments.", defensive: "Can redirect a portion of necrotic or curse energy into the glass instead of the bearer.", risk: "Responds to blood and hostile magic; careless work can awaken a lingering curse." },
  { name: "Star Metal", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Crystal & Mineral", offensive: "Carries cosmic force through the weapon and readily accepts radiant, force, or extraplanar enchantments.", defensive: "Forms a stable ward against force, radiant pressure, and hostile planar energies.", risk: "Its internal charge shifts with celestial cycles and can arc during forging." },
  { name: "Stygian Iron", category: "Ore / Metal", rarity: "Very Rare", dc: 5, materialClass: "Esoteric & Magical", offensive: "Binds hellfire and necrotic energy into cruel, soul-searing weapon channels.", defensive: "Can ward against fire and necrotic power while anchoring the wearer against forced planar movement.", risk: "Carries corruptive resonance and should always receive a visible warning on the finished item." },
  { name: "Moonsilver", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Esoteric & Magical", offensive: "A phase-shifting edge readily carries radiant or psychic tempering and bites through illusion-shrouded defenses.", defensive: "Creates nearly weightless armor that glimmers against shapechanging, illusion, and ethereal intrusion.", risk: "Waxes and wanes with lunar phases; unstable work can partially phase out of its fittings." },
  { name: "Riverine", category: "Material", rarity: "Legendary", dc: 6, materialClass: "Esoteric & Magical", offensive: "A force-contained water edge cannot rust and can deliver pressure-like force through a strike.", defensive: "Forms a transparent, watertight force shell with extraordinary resilience and almost no conventional weight.", risk: "A damaged containment lattice releases the bound water and collapses the crafted section." },
];
const ALCHEMY_GROUPS_BY_SECTION = {
  Potions: ["All", "General Potions", "Elemental Breath Potions"],
  Poisons: ["All", "Ability Poisons", "Special Poisons"],
  Bombs: ["All", "Elemental Bombs", "Condition Bombs", "Special Bombs"],
  Elixirs: ["All", "Ability Elixirs", "Resistance Elixirs", "Immunity Elixirs"],
  Oils: ["All", "Elemental Oils", "Condition Oils", "Utility Oils"],
};
const ALCHEMY_FAMILY_FALLBACK_PROFILES_V6 = {"mushroom":{"Common":[{"effectPct":25},{"durationPct":25},{"effectPct":25},{"effectPct":25},{"durationPct":25}],"Uncommon":[{"extraDoses":1,"effectPct":25},{"effectPct":75},{"effectPct":50,"durationPct":25},{"effectPct":25,"durationPct":50},{"saveDcBonus":1,"effectPct":25}],"Rare":[{"effectPct":100},{"effectPct":50,"extraDoses":1},{"effectPct":75,"durationPct":25},{"effectPct":50,"durationPct":50}],"Very Rare":[{"effectPct":125},{"effectPct":75,"durationPct":50},{"dieSteps":1,"effectPct":25},{"effectPct":75,"extraDoses":2}]},"root":{"Common":[{"durationPct":25},{"effectPct":25},{"durationPct":25},{"durationPct":25},{"effectPct":25}],"Uncommon":[{"durationPct":75},{"effectPct":25,"durationPct":50},{"extraDoses":1,"durationPct":25},{"effectPct":50,"durationPct":25},{"durationPct":50,"effectPct":25}],"Rare":[{"durationPct":100},{"durationPct":50,"extraDoses":1},{"effectPct":50,"durationPct":50},{"durationPct":75,"effectPct":25}],"Very Rare":[{"effectPct":50,"durationPct":75},{"dieSteps":1,"durationPct":25},{"durationPct":125},{"extraDoses":2,"durationPct":75}]},"sap_resin":{"Common":[{"durationPct":25},{"effectPct":25},{"durationPct":25},{"durationPct":25},{"effectPct":25}],"Uncommon":[{"durationPct":75},{"effectPct":50,"durationPct":25},{"extraDoses":1,"durationPct":25},{"durationPct":50,"effectPct":25},{"effectPct":25,"durationPct":50}],"Rare":[{"effectPct":25,"durationPct":75},{"durationPct":100},{"durationPct":50,"extraDoses":1},{"effectPct":50,"durationPct":50}],"Very Rare":[{"durationPct":125},{"effectPct":75,"durationPct":50},{"effectPct":75,"extraDoses":2},{"dieSteps":1,"durationPct":25}]},"moss_lichen":{"Common":[{"durationPct":25},{"effectPct":25},{"areaPct":25},{"durationPct":25},{"effectPct":25}],"Uncommon":[{"effectPct":25,"durationPct":50},{"durationPct":75},{"extraDoses":1,"durationPct":25},{"areaPct":50,"durationPct":25},{"effectPct":50,"durationPct":25}],"Rare":[{"durationPct":100},{"effectPct":75,"durationPct":25},{"areaPct":50,"durationPct":50},{"effectPct":50,"extraDoses":1}],"Very Rare":[{"effectPct":75,"extraDoses":2},{"effectPct":125},{"durationPct":125},{"areaPct":75,"durationPct":50}]},"flower":{"Common":[{"effectPct":25},{"durationPct":25},{"areaPct":25},{"effectPct":25},{"durationPct":25}],"Uncommon":[{"saveDcBonus":1,"effectPct":25},{"effectPct":50,"durationPct":25},{"areaPct":75},{"saveDcBonus":1,"durationPct":25},{"effectPct":25,"areaPct":50}],"Rare":[{"saveDcBonus":1,"effectPct":50},{"effectPct":75,"areaPct":25},{"durationPct":50,"saveDcBonus":1},{"effectPct":50,"durationPct":50}],"Very Rare":[{"effectPct":125},{"saveDcBonus":3,"effectPct":25},{"saveDcBonus":2,"effectPct":75},{"dieSteps":1,"effectPct":25}]},"leaf_vine":{"Common":[{"durationPct":25},{"effectPct":25},{"areaPct":25},{"durationPct":25},{"effectPct":25}],"Uncommon":[{"durationPct":75},{"effectPct":75},{"effectPct":50,"durationPct":25},{"areaPct":50,"durationPct":25},{"effectPct":25,"durationPct":50}],"Rare":[{"effectPct":75,"durationPct":25},{"durationPct":100},{"areaPct":50,"durationPct":50},{"effectPct":50,"areaPct":50}],"Very Rare":[{"effectPct":125},{"durationPct":125},{"dieSteps":1,"durationPct":25},{"effectPct":75,"areaPct":50}]},"thorn_bark_wood":{"Common":[{"effectPct":25},{"durationPct":25},{"effectPct":25},{"durationPct":25},{"effectPct":25}],"Uncommon":[{"durationPct":75},{"effectPct":75},{"effectPct":50,"durationPct":25},{"saveDcBonus":1,"effectPct":25},{"effectPct":25,"durationPct":50}],"Rare":[{"saveDcBonus":1,"effectPct":50},{"effectPct":75,"durationPct":25},{"effectPct":100},{"effectPct":50,"durationPct":50}],"Very Rare":[{"saveDcBonus":2,"effectPct":75},{"effectPct":125},{"effectPct":75,"durationPct":50},{"dieSteps":1,"effectPct":25}]},"mineral_salt_ash":{"Common":[{"durationPct":25},{"effectPct":25},{"areaPct":25},{"durationPct":25},{"effectPct":25}],"Uncommon":[{"durationPct":75},{"extraDoses":1,"durationPct":25},{"effectPct":50,"durationPct":25},{"areaPct":50,"durationPct":25},{"saveDcBonus":1,"durationPct":25}],"Rare":[{"extraDoses":1,"durationPct":50},{"saveDcBonus":1,"effectPct":50},{"durationPct":100},{"effectPct":50,"areaPct":50}],"Very Rare":[{"extraDoses":3,"durationPct":25},{"saveDcBonus":2,"durationPct":75},{"durationPct":125},{"dieSteps":1,"durationPct":25}]},"venom_poison":{"Common":[{"effectPct":25},{"durationPct":25},{"effectPct":25},{"durationPct":25},{"effectPct":25}],"Uncommon":[{"effectPct":75},{"saveDcBonus":1,"effectPct":25},{"effectPct":50,"durationPct":25},{"saveDcBonus":1,"durationPct":25},{"effectPct":25,"durationPct":50}],"Rare":[{"saveDcBonus":1,"effectPct":50},{"effectPct":100},{"effectPct":50,"durationPct":50},{"saveDcBonus":1,"durationPct":50}],"Very Rare":[{"effectPct":125},{"saveDcBonus":2,"effectPct":75},{"dieSteps":1,"effectPct":25},{"saveDcBonus":3,"effectPct":25}]}};
const ALCHEMY_STANDARD_USE = "Bonus Action to use or apply";

function titleCase(value = "") {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
function rarity(value = "") {
  const s = String(value || "").toLowerCase().trim();
  if (!s) return "";
  if (s === "none" || s === "mundane") return "Mundane";
  if (s.includes("legend")) return "Legendary";
  if (s.includes("very")) return "Very Rare";
  if (s.includes("rare")) return "Rare";
  if (s.includes("uncommon")) return "Uncommon";
  if (s.includes("common")) return "Common";
  if (s.includes("varies") || s.includes("variable")) return "Varies";
  return titleCase(value);
}
function rarityRank(value) {
  const idx = RARITY_ORDER.indexOf(rarity(value));
  return idx === -1 ? 99 : idx;
}

function normalizeAlchemySection(value = "") {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean || clean === "all") return clean === "all" ? "All" : "";
  if (clean.startsWith("oil")) return "Oils";
  if (clean.startsWith("poison")) return "Poisons";
  if (clean.startsWith("bomb") || clean.includes("explosive")) return "Bombs";
  if (clean.startsWith("elixir") || clean.includes("buff")) return "Elixirs";
  if (clean.startsWith("potion") || clean.includes("salve") || clean.includes("tonic")) return "Potions";
  return "";
}
function alchemySectionForRecipe(recipe = {}) {
  const explicit = normalizeAlchemySection(
    recipe.alchemy_section ||
    recipe.alchemySection ||
    recipe.section ||
    recipe.metadata?.alchemy_section ||
    recipe.metadata?.alchemySection
  );
  if (explicit) return explicit;

  const blob = [
    recipe.name,
    recipe.kind,
    recipe.category,
    recipe.family,
    recipe.item_type,
    recipe.recipe_type,
    recipe.summary,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/\boil\b/.test(blob)) return "Oils";
  if (/\b(elixir|ability buff|stat buff)\b/.test(blob)) return "Elixirs";
  if (/\b(bomb|grenade|explosive|alchemist'?s fire|smoke flask|thunderstone|acid flask|blast flask)\b/.test(blob)) return "Bombs";
  if (/\b(poison|toxin|venom|weakening)\b/.test(blob) && !/\b(resistance|antitoxin|poison resistance)\b/.test(blob)) return "Poisons";
  return "Potions";
}
function alchemyGroupForRecipe(recipe = {}) {
  const explicit = String(recipe.alchemy_group || recipe.alchemyGroup || recipe.group || recipe.metadata?.alchemy_group || "").trim();
  if (explicit) return explicit;
  const section = alchemySectionForRecipe(recipe);
  const name = String(recipe.name || "").toLowerCase();
  if (section === "Elixirs") {
    if (/ resistance$/.test(name)) return "Resistance Elixirs";
    if (/ immunity$/.test(name)) return "Immunity Elixirs";
    return "Ability Elixirs";
  }
  if (section === "Bombs") return /^bomb of /.test(name) && /acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder/.test(name) ? "Elemental Bombs" : "Condition Bombs";
  if (section === "Oils") {
    if (/etherealness|sharpness/.test(name)) return "Utility Oils";
    return /acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder/.test(name) ? "Elemental Oils" : "Condition Oils";
  }
  if (section === "Poisons") return /^poison of .+ weakening$/.test(name) ? "Ability Poisons" : "Special Poisons";
  return "General Potions";
}

function normalizeDurationUnit(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.startsWith("round")) return "rounds";
  if (raw.startsWith("second")) return "seconds";
  if (raw.startsWith("minute")) return "minutes";
  if (raw.startsWith("hour")) return "hours";
  if (raw.startsWith("day")) return "days";
  if (raw.startsWith("week")) return "weeks";
  return raw || "rounds";
}
function singularDurationUnit(value = "") {
  const unit = normalizeDurationUnit(value);
  if (unit === "rounds") return "round";
  if (unit === "seconds") return "second";
  if (unit === "minutes") return "minute";
  if (unit === "hours") return "hour";
  if (unit === "days") return "day";
  if (unit === "weeks") return "week";
  return unit.replace(/s$/, "");
}
function parseDurationDice(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/(\d+)\s*d\s*(4|6|8|10|12)\s*(rounds?|seconds?|minutes?|hours?|days?|weeks?)/i);
  if (!match) return null;
  return {
    count: Math.max(1, Number(match[1]) || 1),
    size: Number(match[2]) || 4,
    unit: normalizeDurationUnit(match[3]),
  };
}
function parseDurationSeconds(value) {
  if (value === 0) return 0;
  if (Number.isFinite(Number(value)) && String(value).trim() !== "") return Math.max(0, Math.round(Number(value)));
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (/\binstant\b/.test(raw)) return 0;
  if (/\buntil delivered\b|\buntil used\b|\bpermanent\b/.test(raw)) return null;
  if (parseDurationDice(raw)) return null;

  const week = raw.match(/(\d+(?:\.\d+)?)\s*weeks?/i);
  if (week) return Math.round(Number(week[1]) * 604800);
  const day = raw.match(/(\d+(?:\.\d+)?)\s*days?/i);
  if (day) return Math.round(Number(day[1]) * 86400);
  const hour = raw.match(/(\d+(?:\.\d+)?)\s*hours?/i);
  if (hour) return Math.round(Number(hour[1]) * 3600);
  const minute = raw.match(/(\d+(?:\.\d+)?)\s*minutes?/i);
  if (minute) return Math.round(Number(minute[1]) * 60);
  const second = raw.match(/(\d+(?:\.\d+)?)\s*seconds?/i);
  if (second) return Math.round(Number(second[1]));
  const round = raw.match(/(\d+(?:\.\d+)?)\s*rounds?/i);
  if (round) return Math.round(Number(round[1]) * 6);
  return null;
}
function formatDurationSeconds(value, fallback = "Until used") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return fallback;
  const seconds = Math.max(0, Math.round(Number(value)));
  if (seconds === 0) return "Instant";

  const weeks = Math.floor(seconds / 604800);
  const days = Math.floor((seconds % 604800) / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const parts = [];
  if (weeks) parts.push(`${weeks} ${weeks === 1 ? "week" : "weeks"}`);
  if (days) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (remainingSeconds) parts.push(`${remainingSeconds} ${remainingSeconds === 1 ? "second" : "seconds"}`);
  return parts.slice(0, 2).join(" ");
}
function formatBonusPercent(value = 0) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}
function diceCountScaling(baseCount = 0, percent = 0) {
  const count = Math.max(0, Math.floor(Number(baseCount) || 0));
  const requestedPct = Math.max(0, Number(percent) || 0);
  if (!count) {
    return { baseCount: 0, count: 0, additionalDice: 0, appliedPct: 0, remainderPct: requestedPct, multiplier: 1 };
  }

  // Percentage bonuses add whole dice as soon as the base expression can support
  // them. Examples: +50% on 2d4 adds 1d4; +25% on 4d4 adds 1d4. Any fraction
  // smaller than one whole die remains banked for the next ingredient bonus.
  const exactAdditionalDice = count * requestedPct / 100;
  const additionalDice = Math.max(0, Math.floor(exactAdditionalDice + 1e-9));
  const finalCount = count + additionalDice;
  const appliedPct = additionalDice / count * 100;
  const remainderPct = Math.max(0, requestedPct - appliedPct);
  return {
    baseCount: count,
    count: finalCount,
    additionalDice,
    appliedPct,
    remainderPct,
    multiplier: finalCount / count,
  };
}
function scaledDiceCount(baseCount = 0, percent = 0) {
  return diceCountScaling(baseCount, percent).count;
}
function scaledFlatBonus(baseFlat = 0, baseCount = 0, percent = 0) {
  const flat = Number(baseFlat) || 0;
  if (!flat) return 0;
  const scaling = diceCountScaling(baseCount, percent);
  // Flat modifiers attached to a dice expression grow in the same proportion as
  // the dice that were actually added. Fractions are rounded down to a whole
  // modifier, matching normal D&D integer math.
  return Math.floor(flat * scaling.multiplier + 1e-9);
}
function steppedDurationUnit(unit = "minutes", steps = 0) {
  const normalized = normalizeDurationUnit(unit);
  if (!steps) return normalized;
  let start = ALCHEMY_DURATION_UNIT_STEPS.indexOf(normalized);
  if (start < 0) {
    if (normalized === "rounds" || normalized === "seconds") start = 0;
    else return normalized;
  }
  return ALCHEMY_DURATION_UNIT_STEPS[Math.min(ALCHEMY_DURATION_UNIT_STEPS.length - 1, start + Math.max(0, Number(steps) || 0))];
}
function fixedDurationUnitProfile(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  if (!value) return null;
  if (value % 604800 === 0) return { amount: value / 604800, unit: "weeks" };
  if (value % 86400 === 0) return { amount: value / 86400, unit: "days" };
  if (value % 3600 === 0) return { amount: value / 3600, unit: "hours" };
  if (value % 60 === 0) return { amount: value / 60, unit: "minutes" };
  return { amount: value, unit: "seconds" };
}
function durationUnitSeconds(unit = "seconds") {
  const normalized = normalizeDurationUnit(unit);
  if (normalized === "weeks") return 604800;
  if (normalized === "days") return 86400;
  if (normalized === "hours") return 3600;
  if (normalized === "minutes") return 60;
  if (normalized === "rounds") return 6;
  return 1;
}
function formatDurationDice(profile = null, durationPct = 0, dieSteps = 0) {
  if (!profile?.count || !profile?.size || !profile?.unit) return "";
  const scaling = diceCountScaling(profile.count, durationPct);
  const count = scaling.count;
  const unit = steppedDurationUnit(profile.unit, dieSteps);
  const label = count === 1 && profile.size === 1 ? singularDurationUnit(unit) : normalizeDurationUnit(unit);
  const base = `${count}d${profile.size} ${label}`;
  return scaling.remainderPct
    ? `${base} (Duration +${formatBonusPercent(scaling.remainderPct)}% remains toward the next duration die)`
    : base;
}
function scaledDurationSeconds(baseSeconds, durationPct = 0, dieSteps = 0) {
  if (baseSeconds === null || baseSeconds === undefined) return null;
  const base = Math.max(0, Number(baseSeconds) || 0);
  if (base === 0) return 0;
  const profile = fixedDurationUnitProfile(base);
  if (!profile) return base;
  const promotedUnit = steppedDurationUnit(profile.unit, dieSteps);
  const scaledAmount = profile.amount * (1 + (Number(durationPct) || 0) / 100);
  return Math.max(1, Math.round(scaledAmount * durationUnitSeconds(promotedUnit)));
}
function formatAlchemyDuration(profile = {}, durationPct = 0, dieSteps = 0, fallback = "Until used") {
  const durationDice = profile?.base_duration_dice_count && profile?.base_duration_die_size && profile?.base_duration_unit
    ? {
        count: Number(profile.base_duration_dice_count),
        size: Number(profile.base_duration_die_size),
        unit: profile.base_duration_unit,
      }
    : null;
  if (durationDice) return formatDurationDice(durationDice, durationPct, dieSteps);
  const fixed = scaledDurationSeconds(profile?.base_duration_seconds, durationPct, dieSteps);
  return formatDurationSeconds(fixed, fallback);
}

function parseDiceExpression(value = "") {
  const match = String(value || "").match(/(\d+)\s*d\s*(4|6|8|10|12)(?:\s*\+\s*(\d+))?/i);
  if (!match) return null;
  return {
    count: Math.max(1, Number(match[1]) || 1),
    size: Number(match[2]) || 4,
    flat: Number(match[3]) || 0,
  };
}
function steppedDieSize(size = 4, steps = 0) {
  const sizes = [4, 6, 8, 10, 12];
  const found = sizes.indexOf(Number(size));
  const start = found >= 0 ? found : 0;
  return sizes[Math.min(sizes.length - 1, start + Math.max(0, Number(steps) || 0))];
}
function formatDiceProfile(profile = null) {
  if (!profile || !profile.count || !profile.size) return "";
  const flat = Number(profile.flat || 0);
  return `${profile.count}d${profile.size}${flat ? ` + ${flat}` : ""}`;
}
function alchemyNumericProfile(recipe = {}, details = {}) {
  const key = normalizeRecipeNameKey(recipe?.name || "");
  const durationText = String(details.duration || recipe.duration || "").trim();
  const parsedDurationDice = parseDurationDice(durationText);
  let baseDurationDiceCount = Number(
    recipe.base_duration_dice_count ??
    recipe.baseDurationDiceCount ??
    details.base_duration_dice_count ??
    details.baseDurationDiceCount ??
    parsedDurationDice?.count ??
    0
  ) || 0;
  let baseDurationDieSize = Number(
    recipe.base_duration_die_size ??
    recipe.baseDurationDieSize ??
    details.base_duration_die_size ??
    details.baseDurationDieSize ??
    parsedDurationDice?.size ??
    0
  ) || 0;
  let baseDurationUnit = normalizeDurationUnit(
    recipe.base_duration_unit ??
    recipe.baseDurationUnit ??
    details.base_duration_unit ??
    details.baseDurationUnit ??
    parsedDurationDice?.unit ??
    ""
  );

  const durationSource =
    recipe.base_duration_seconds ??
    recipe.baseDurationSeconds ??
    details.base_duration_seconds ??
    details.baseDurationSeconds ??
    durationText;
  let baseDurationSeconds = parseDurationSeconds(durationSource);
  if (baseDurationDiceCount && baseDurationDieSize && baseDurationUnit) baseDurationSeconds = null;

  const parsedDice = parseDiceExpression([
    details.effect,
    recipe.effect_detail,
    recipe.effect_text,
    recipe.summary,
    recipe.description,
  ].filter(Boolean).join(" "));
  let baseDiceCount = Number(recipe.base_dice_count ?? recipe.baseDiceCount ?? details.base_dice_count ?? details.baseDiceCount ?? parsedDice?.count ?? 0) || 0;
  let baseDieSize = Number(recipe.base_die_size ?? recipe.baseDieSize ?? details.base_die_size ?? details.baseDieSize ?? parsedDice?.size ?? 0) || 0;
  let baseFlatBonus = Number(recipe.base_flat_bonus ?? recipe.baseFlatBonus ?? details.base_flat_bonus ?? details.baseFlatBonus ?? parsedDice?.flat ?? 0) || 0;
  let dicePurpose = recipe.dice_purpose || recipe.dicePurpose || details.dice_purpose || details.dicePurpose || "";
  let effectCadence = recipe.effect_cadence || recipe.effectCadence || details.effect_cadence || details.effectCadence || "";

  if (/(?:potion-of-healing|healing-potion)/.test(key)) {
    baseDurationSeconds = 0;
    baseDurationDiceCount = 0;
    baseDurationDieSize = 0;
    baseDurationUnit = "";
    baseDiceCount ||= 2;
    baseDieSize ||= 4;
    if (!baseFlatBonus) baseFlatBonus = 2;
    dicePurpose ||= "healing";
  } else if (/potion-of-regeneration/.test(key)) {
    baseDurationSeconds ??= 60;
    baseDiceCount = Number(recipe.base_dice_count ?? recipe.baseDiceCount ?? details.base_dice_count ?? details.baseDiceCount ?? 1) || 1;
    baseDieSize = Number(recipe.base_die_size ?? recipe.baseDieSize ?? details.base_die_size ?? details.baseDieSize ?? 4) || 4;
    baseFlatBonus = Number(recipe.base_flat_bonus ?? recipe.baseFlatBonus ?? details.base_flat_bonus ?? details.baseFlatBonus ?? 0) || 0;
    dicePurpose ||= "healing_per_turn";
    effectCadence ||= "at the start of each of the drinker's turns";
  } else if (/elixir-of-/.test(key)) {
    baseDurationSeconds ??= 3600;
    baseDiceCount ||= 1;
    baseDieSize ||= 4;
    dicePurpose ||= "ability_buff";
  } else if (/poison-of-.*-weakening/.test(key)) {
    baseDurationSeconds ??= 3600;
    baseDiceCount ||= 1;
    baseDieSize ||= 6;
    dicePurpose ||= "ability_damage";
  } else if (/potion-of-x-resistance|resistance/.test(key)) {
    baseDurationSeconds ??= 3600;
  }

  const useText = String(details.use || recipe.use || "");
  const usesMatch = useText.match(/(\d+)\s*uses?/i) || String(details.duration || recipe.duration || "").match(/(\d+)\s*uses?/i);
  const baseUses = Number(recipe.base_uses ?? recipe.baseUses ?? details.base_uses ?? details.baseUses ?? usesMatch?.[1] ?? 0) || 0;

  return {
    base_duration_seconds: baseDurationSeconds,
    base_duration_dice_count: baseDurationDiceCount,
    base_duration_die_size: baseDurationDieSize,
    base_duration_unit: baseDurationUnit,
    base_duration_text: durationText || null,
    base_dice_count: baseDiceCount,
    base_die_size: baseDieSize,
    base_flat_bonus: baseFlatBonus,
    base_uses: baseUses,
    dice_purpose: dicePurpose,
    effect_cadence: effectCadence,
    section: alchemySectionForRecipe(recipe),
  };
}

function tag(value = "") {
  return String(value || "").split("|")[0].trim();
}
function rows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.item)) return data.item;
  if (Array.isArray(data?.variants)) return data.variants;
  if (Array.isArray(data?.recipes)) return data.recipes;
  return [];
}
async function json(path, required = false) {
  try {
    const res = await fetch(path);
    if (!res.ok) {
      if (required) throw new Error(`${path} returned HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    if (required) throw err;
    return null;
  }
}
async function selectSafe(table, select, orderBy) {
  try {
    let q = supabase.from(table).select(select);
    if (orderBy) q = q.order(orderBy, { ascending: true });
    const { data, error } = await q;
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
async function selectPlayerPlantsSafe() {
  // Player-owned herb rows often only store plant_id + quantity. Join the catalog
  // plant row so the alchemy preview can see name, rarity, family, potency, and
  // effect traits. Fall back to the legacy flat query if the relationship is not
  // available in an older dev database.
  const joinedRows = await selectSafe("player_plants", "*, plants(*)", "created_at");
  if (joinedRows.length) return joinedRows;
  return selectSafe("player_plants", "*", "name");
}
function typeFromCode(code) {
  const c = tag(code).toUpperCase();
  if (c === "S" || c === "SH") return "shield";
  if (c === "A") return "ammunition";
  if (["LA", "MA", "HA"].includes(c)) return "armor";
  if (c === "M" || c === "R") return "weapon";
  return "gear";
}
function familyFromItem(item) {
  const c = tag(item?.type || item?.item_type).toUpperCase();
  const props = [].concat(item?.property || item?.properties || []).map((p) => tag(typeof p === "string" ? p : p?.uid || p?.abbreviation || ""));
  if (c === "R") return "Ranged";
  if (c === "A") return "Ammunition";
  if (c === "M") return props.includes("T") ? "Thrown" : "Melee";
  if (c === "S" || c === "SH") return "Shield";
  if (["LA", "MA", "HA"].includes(c)) return "Armor";
  return "Gear";
}
function enchantingSectionsForRecipe(recipe = {}) {
  if (recipe.discipline !== "Enchanting") return [];
  const explicit = Array.isArray(recipe.applies_to) ? recipe.applies_to : [];
  const blob = [...explicit, recipe.category, recipe.family, recipe.name, ...(recipe.requirements || [])].filter(Boolean).join(" ").toLowerCase();
  const sections = new Set();
  if (/ammunition|\bammo\b|arrow|bolt/.test(blob)) sections.add("Ammo");
  if (/shield/.test(blob)) sections.add("Shield");
  if (/armor|armour/.test(blob)) sections.add("Armor");
  if (/ranged|bow|crossbow|sling/.test(blob)) sections.add("Ranged Weapon");
  if (/melee|sword|axe|mace|hammer|spear|dagger|weapon/.test(blob)) sections.add("Melee Weapon");
  if (/\bweapon\b/.test(blob) && !/melee|ranged/.test(blob)) sections.add("Ranged Weapon");
  return Array.from(sections);
}
function magicSignals(item) {
  const blob = [item?.name, item?.item_name, item?.baseItem, item?.rarity, item?.tier, item?.item_description, item?.attunementText].filter(Boolean).join(" ").toLowerCase();
  return Boolean(item?.wondrous || item?.reqAttune || item?.reqAttuneTags || item?.bonusWeapon || item?.bonusAc || item?.attachedSpells || item?.charges || item?.recharge || item?.curse || /^\s*\+\d+\b/.test(blob) || /\b(awakened|exalted|dormant|slumbering|stirring|ascendant|requires attunement|magic weapon|magic armor|artifact)\b/.test(blob));
}
function isForgeItem(item) {
  const name = String(item?.name || item?.item_name || "").trim();
  const code = tag(item?.type || item?.item_type).toUpperCase();
  const r = String(item?.rarity || item?.item_rarity || "").toLowerCase().trim();
  if (!name || !FORGE_CODES.has(code)) return false;
  if (r && r !== "none" && r !== "mundane") return false;
  if (FUTURE_RE.test([name, item?.uiType, item?.rawType, item?.source].filter(Boolean).join(" "))) return false;
  if (magicSignals(item)) return false;
  return true;
}
const FORGE_DAMAGE_TYPE_LABELS = { B: "bludgeoning", P: "piercing", S: "slashing", A: "acid", C: "cold", F: "fire", L: "lightning", N: "necrotic", R: "radiant", T: "thunder", Frc: "force", Psy: "psychic", Psn: "poison" };
const FORGE_PROPERTY_LABELS = { A: "Ammunition", F: "Finesse", H: "Heavy", L: "Light", LD: "Loading", R: "Reach", RLD: "Reload", S: "Special", T: "Thrown", "2H": "Two-Handed", V: "Versatile" };
function flattenForgeEntries(value) {
  const parts = [];
  const visit = (entry) => {
    if (!entry) return;
    if (typeof entry === "string") { parts.push(entry); return; }
    if (Array.isArray(entry)) { entry.forEach(visit); return; }
    if (entry.entry) visit(entry.entry);
    if (entry.entries) visit(entry.entries);
    if (entry.items) visit(entry.items);
  };
  visit(value);
  return parts.join("\n").trim();
}
function forgeCostGp(item = {}) {
  const explicit = Number(item.price_gp ?? item.cost_gp);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const copper = Number(item.value ?? item.cost?.amount ?? item.cost);
  return Number.isFinite(copper) ? copper / 100 : null;
}
function forgeRecipe(item, flavorOverrides = {}) {
  const name = item.name || item.item_name || "Unnamed Item";
  const itemType = typeFromCode(item.type || item.item_type);
  const family = familyFromItem(item);
  const propertyCodes = [].concat(item.property || item.properties || []).map((prop) => tag(typeof prop === "string" ? prop : prop?.uid || prop?.abbreviation || prop?.name || ""));
  const properties = propertyCodes.map((code) => FORGE_PROPERTY_LABELS[code] || code).filter(Boolean);
  const damageType = FORGE_DAMAGE_TYPE_LABELS[item.dmgType || item.damageType] || item.dmgType || item.damageType || "";
  const versatileDie = item.dmg2 || item.damage2 || null;
  const damage = item.dmg1 || item.damage1 ? `${item.dmg1 || item.damage1} ${damageType}${versatileDie ? `, versatile (${versatileDie})` : ""}`.trim() : null;
  const override = flavorOverrides?.[name] || flavorOverrides?.[String(name).toLowerCase()] || {};
  return {
    id: `forge:${name}:${item.type || item.item_type || ""}`,
    name: `Forge ${name}`,
    discipline: "Smithing",
    kind: "forge",
    category: itemType,
    family,
    rarity: "Mundane",
    known: false,
    source: item.source || "Catalog",
    catalog_item: item,
    ac: item.ac ?? item?.armor?.ac ?? null,
    dmg1: item.dmg1 ?? item.damage1 ?? null,
    dmgType: item.dmgType ?? item.damageType ?? null,
    range: item.range ?? item.rangeText ?? null,
    property: item.property ?? item.properties ?? [],
    weight: item.weight ?? item.item_weight ?? null,
    cost: item.cost ?? item.value ?? item.item_cost ?? null,
    item_preview: {
      name,
      itemType,
      family,
      flavor: override?.flavor || item.flavor || item.item_flavor || "",
      rules: item.item_description || item.rulesText || item.rulesShort || flattenForgeEntries(item.entries),
      damage,
      ac: item.ac ?? item?.armor?.ac ?? null,
      range: item.rangeText || item.range || ((item.range_normal && item.range_long) ? `${item.range_normal}/${item.range_long} ft.` : null),
      properties,
      mastery: [].concat(item.mastery || []).filter(Boolean),
      costGp: forgeCostGp(item),
      weightLb: item.weight ?? item.item_weight ?? null,
      source: item.source || item.item_source || "Catalog",
      image: item.image_url || item.img || item.image || "",
    },
    summary: `A blacksmith can craft a new mundane ${name}.`,
    requirements: ["Access to a smithy", `Pattern: ${name}`, "Material cost determined by the DM"],
    components: ["Metal, wood, leather, fletching, monster material, or ammunition stock as appropriate"],
  };
}
function temperRecipes() {
  return [1, 2, 3].map((n) => ({
    id: `temper:+${n}`,
    name: `+${n} Temper`,
    discipline: "Smithing",
    kind: "temper",
    temper_tier: n,
    category: "weapon / ammunition / armor / shield",
    family: "Temper",
    rarity: n === 1 ? "Uncommon" : n === 2 ? "Rare" : "Very Rare",
    known: false,
    source: "Town Smithing",
    summary: `Upgrade physical gear to smith tier +${n}. Weapons and ammunition may bind one elemental essence at each completed temper stage.`,
    requirements: ["Base physical item from the previous smith tier", `Smith capable of +${n} work`],
    components: ["One physical craft material", `Elemental essence or motes for Temper +1 through +${n} when tempering a weapon or ammunition`],
  }));
}
function variantRecipe(raw) {
  const key = String(raw?.key || raw?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const originalName = String(raw?.name || "").trim();
  if (!key || !originalName || PHYSICAL_VARIANTS.has(key)) return null;
  const appliesTo = Array.isArray(raw.appliesTo) ? raw.appliesTo.map((v) => String(v).toLowerCase()) : ["weapon", "armor", "shield", "ammunition"];
  const entries = Array.isArray(raw.entries) ? raw.entries : raw.entries ? [String(raw.entries)] : [];
  return {
    id: `enchant:${key}`,
    key,
    name: originalName.replace(/^Sword of\s+/i, "Weapon of "),
    originalName,
    discipline: "Enchanting",
    kind: "enchant",
    category: appliesTo.join(" / "),
    family: appliesTo.includes("weapon") ? "Weapon" : appliesTo.map(titleCase).join(" / "),
    applies_to: appliesTo,
    rarity: rarity(raw.rarity || (raw.rarityByValue ? "Varies" : "")) || "Varies",
    known: false,
    source: raw.source || "Variant Catalog",
    summary: entries.join(" ") || raw.textByKind?.[appliesTo[0]] || `Magical trait applicable to ${appliesTo.join(", ")}.`,
    requirements: ["Smith-tiered base item", `Applies to: ${appliesTo.join(", ")}`],
    components: raw.options?.length ? [`Choose option: ${raw.options.join(", ")}`] : ["Optional catalyst, reagent, monster part, or teacher requirement"],
  };
}

const ALCHEMY_POTION_FORMULAS = [
  {
    "id": "alchemy:healing-draught",
    "name": "Healing Draught",
    "item_type": "Potion",
    "rarity": "Common",
    "requiredTags": [
      "vital",
      "moss",
      "root",
      "restorative"
    ],
    "secondaryTags": [
      "flower",
      "leaf",
      "clear",
      "spring"
    ],
    "dc": 11,
    "effect": "Restorative field medicine. On success, creates a simple healing potion or salve."
  },
  {
    "id": "alchemy:potion-of-healing",
    "name": "Potion of Healing",
    "item_type": "Potion",
    "rarity": "Common",
    "requiredTags": [
      "vital",
      "root",
      "sun",
      "clear"
    ],
    "secondaryTags": [
      "flower",
      "honey",
      "spring"
    ],
    "dc": 12,
    "effect": "A classic restorative potion that closes minor wounds and steadies the drinker."
  },
  {
    "id": "alchemy:basic-poison",
    "name": "Basic Poison",
    "item_type": "Poison",
    "rarity": "Common",
    "requiredTags": [
      "venom",
      "bitter",
      "nightshade",
      "toxic"
    ],
    "secondaryTags": [
      "mushroom",
      "ash",
      "salt"
    ],
    "dc": 12,
    "effect": "A simple injury poison. On success, produces one dose by DM approval."
  },
  {
    "id": "alchemy:antitoxin",
    "name": "Antitoxin",
    "item_type": "Potion",
    "rarity": "Common",
    "requiredTags": [
      "venom",
      "bitter",
      "mushroom",
      "ash"
    ],
    "secondaryTags": [
      "salt",
      "root",
      "clear"
    ],
    "dc": 12,
    "effect": "Neutralizes common toxins and gives advantage against poison by DM approval."
  },
  {
    "id": "alchemy:potion-of-climbing",
    "name": "Potion of Climbing",
    "item_type": "Potion",
    "rarity": "Common",
    "requiredTags": [
      "grip",
      "vine",
      "moss",
      "sticky"
    ],
    "secondaryTags": [
      "root",
      "sap",
      "cliff"
    ],
    "dc": 12,
    "effect": "Improves climbing speed and grip for a short time."
  },
  {
    "id": "alchemy:potion-of-comprehension",
    "name": "Potion of Comprehension",
    "item_type": "Potion",
    "rarity": "Common",
    "requiredTags": [
      "clarity",
      "sage",
      "silver",
      "leaf"
    ],
    "secondaryTags": [
      "ink",
      "dew",
      "moon"
    ],
    "dc": 12,
    "effect": "Clarifies unfamiliar written and spoken meaning for a short duration."
  },
  {
    "id": "alchemy:watchful-rest",
    "name": "Potion of Watchful Rest",
    "item_type": "Potion",
    "rarity": "Common",
    "requiredTags": [
      "watchful",
      "mint",
      "clear",
      "eye"
    ],
    "secondaryTags": [
      "leaf",
      "dew",
      "night"
    ],
    "dc": 12,
    "effect": "Helps a resting creature remain lightly alert by DM ruling."
  },
  {
    "id": "alchemy:potion-of-animal-friendship",
    "name": "Potion of Animal Friendship",
    "item_type": "Potion",
    "rarity": "Uncommon",
    "requiredTags": [
      "beast",
      "honey",
      "flower",
      "warm"
    ],
    "secondaryTags": [
      "leaf",
      "apple",
      "soft"
    ],
    "dc": 14,
    "effect": "Helps calm and befriend beasts for a short time."
  },
  {
    "id": "alchemy:quickstep-tonic",
    "name": "Quickstep Tonic",
    "item_type": "Potion",
    "rarity": "Uncommon",
    "requiredTags": [
      "swift",
      "pepper",
      "thorn",
      "leaf"
    ],
    "secondaryTags": [
      "flower",
      "sap",
      "clear"
    ],
    "dc": 14,
    "effect": "A short-lived stimulant that boosts speed or initiative by DM ruling."
  },
  {
    "id": "alchemy:night-eye-drops",
    "name": "Night-Eye Drops",
    "item_type": "Potion",
    "rarity": "Uncommon",
    "requiredTags": [
      "night",
      "moon",
      "dark",
      "mushroom"
    ],
    "secondaryTags": [
      "dew",
      "silver",
      "flower"
    ],
    "dc": 14,
    "effect": "A careful distillation that may grant short darkvision or improve low-light perception."
  },
  {
    "id": "alchemy:ironroot-salve",
    "name": "Ironroot Salve",
    "item_type": "Potion",
    "rarity": "Uncommon",
    "requiredTags": [
      "iron",
      "bark",
      "root",
      "hard"
    ],
    "secondaryTags": [
      "oil",
      "resin",
      "moss"
    ],
    "dc": 15,
    "effect": "A defensive salve for bruises, broken skin, and physical strain."
  },
  {
    "id": "alchemy:potion-of-fire-breath",
    "name": "Potion of Fire Breath",
    "item_type": "Potion",
    "rarity": "Uncommon",
    "requiredTags": [
      "ember",
      "pepper",
      "ash",
      "dragon"
    ],
    "secondaryTags": [
      "oil",
      "resin",
      "thorn"
    ],
    "dc": 15,
    "effect": "A volatile tonic that lets the drinker exhale flame by DM ruling."
  },
  {
    "id": "alchemy:potion-of-growth",
    "name": "Potion of Growth",
    "item_type": "Potion",
    "rarity": "Uncommon",
    "requiredTags": [
      "giant",
      "root",
      "sap",
      "sun"
    ],
    "secondaryTags": [
      "bark",
      "honey",
      "moss"
    ],
    "dc": 15,
    "effect": "Causes temporary growth and increased physical presence."
  },
  {
    "id": "alchemy:potion-of-resistance",
    "name": "Potion of Resistance",
    "item_type": "Potion",
    "rarity": "Uncommon",
    "requiredTags": [
      "ward",
      "crystal",
      "bitter",
      "moss"
    ],
    "secondaryTags": [
      "salt",
      "root",
      "ash"
    ],
    "dc": 15,
    "effect": "Creates a resistance draught keyed by the reagent or catalyst used."
  },
  {
    "id": "alchemy:philter-of-love",
    "name": "Philter of Love",
    "item_type": "Potion",
    "rarity": "Uncommon",
    "requiredTags": [
      "rose",
      "honey",
      "heart",
      "flower"
    ],
    "secondaryTags": [
      "dew",
      "vanilla",
      "soft"
    ],
    "dc": 15,
    "effect": "A charm-adjacent social potion; exact effects should remain DM controlled."
  },
  {
    "id": "alchemy:potion-of-poison-resistance",
    "name": "Potion of Poison Resistance",
    "item_type": "Potion",
    "rarity": "Uncommon",
    "requiredTags": [
      "venom",
      "milk",
      "thistle",
      "bitter"
    ],
    "secondaryTags": [
      "salt",
      "root",
      "mushroom"
    ],
    "dc": 15,
    "effect": "Bolsters the drinker against poison."
  },
  {
    "id": "alchemy:potion-of-water-breathing",
    "name": "Potion of Water Breathing",
    "item_type": "Potion",
    "rarity": "Uncommon",
    "requiredTags": [
      "water",
      "kelp",
      "bubble",
      "clear"
    ],
    "secondaryTags": [
      "reef",
      "salt",
      "moss"
    ],
    "dc": 15,
    "effect": "Lets the drinker breathe underwater for a time."
  },
  {
    "id": "alchemy:potion-of-heroism",
    "name": "Potion of Heroism",
    "item_type": "Potion",
    "rarity": "Rare",
    "requiredTags": [
      "lion",
      "sun",
      "gold",
      "heart"
    ],
    "secondaryTags": [
      "root",
      "flower",
      "honey"
    ],
    "dc": 18,
    "effect": "Inspires courage and temporary heroic resilience."
  },
  {
    "id": "alchemy:potion-of-gaseous-form",
    "name": "Potion of Gaseous Form",
    "item_type": "Potion",
    "rarity": "Rare",
    "requiredTags": [
      "mist",
      "cloud",
      "ghost",
      "mushroom"
    ],
    "secondaryTags": [
      "dew",
      "silver",
      "night"
    ],
    "dc": 18,
    "effect": "Loosens the body into vaporous form for a short time."
  },
  {
    "id": "alchemy:potion-of-mind-reading",
    "name": "Potion of Mind Reading",
    "item_type": "Potion",
    "rarity": "Rare",
    "requiredTags": [
      "dream",
      "sage",
      "eye",
      "moon"
    ],
    "secondaryTags": [
      "silver",
      "ink",
      "mushroom"
    ],
    "dc": 18,
    "effect": "Sharpens psychic perception enough to read surface thoughts by DM ruling."
  },
  {
    "id": "alchemy:potion-of-diminution",
    "name": "Potion of Diminution",
    "item_type": "Potion",
    "rarity": "Rare",
    "requiredTags": [
      "small",
      "mushroom",
      "moon",
      "root"
    ],
    "secondaryTags": [
      "dew",
      "shadow",
      "soft"
    ],
    "dc": 18,
    "effect": "Temporarily reduces the drinker's size."
  },
  {
    "id": "alchemy:potion-of-clairvoyance",
    "name": "Potion of Clairvoyance",
    "item_type": "Potion",
    "rarity": "Rare",
    "requiredTags": [
      "seer",
      "eye",
      "crystal",
      "moon"
    ],
    "secondaryTags": [
      "sage",
      "ink",
      "silver"
    ],
    "dc": 18,
    "effect": "Distills a short-lived remote-sensing draught."
  },
  {
    "id": "alchemy:potion-of-fire-resistance",
    "name": "Potion of Fire Resistance",
    "item_type": "Potion",
    "rarity": "Rare",
    "requiredTags": [
      "ember",
      "ash",
      "ward",
      "red"
    ],
    "secondaryTags": [
      "salt",
      "bark",
      "root"
    ],
    "dc": 18,
    "effect": "Protects the drinker against fire for a time."
  },
  {
    "id": "alchemy:potion-of-cold-resistance",
    "name": "Potion of Cold Resistance",
    "item_type": "Potion",
    "rarity": "Rare",
    "requiredTags": [
      "frost",
      "blue",
      "ward",
      "mint"
    ],
    "secondaryTags": [
      "crystal",
      "root",
      "dew"
    ],
    "dc": 18,
    "effect": "Protects the drinker against cold for a time."
  },
  {
    "id": "alchemy:potion-of-acid-resistance",
    "name": "Potion of Acid Resistance",
    "item_type": "Potion",
    "rarity": "Rare",
    "requiredTags": [
      "alkali",
      "chalk",
      "ward",
      "bitter"
    ],
    "secondaryTags": [
      "salt",
      "moss",
      "root"
    ],
    "dc": 18,
    "effect": "Protects the drinker against acid for a time."
  },
  {
    "id": "alchemy:potion-of-lightning-resistance",
    "name": "Potion of Lightning Resistance",
    "item_type": "Potion",
    "rarity": "Rare",
    "requiredTags": [
      "storm",
      "spark",
      "ward",
      "glass"
    ],
    "secondaryTags": [
      "silver",
      "root",
      "reed"
    ],
    "dc": 18,
    "effect": "Protects the drinker against lightning for a time."
  },
  {
    "id": "alchemy:potion-of-speed",
    "name": "Potion of Speed",
    "item_type": "Potion",
    "rarity": "Very Rare",
    "requiredTags": [
      "swift",
      "storm",
      "pepper",
      "quicksilver"
    ],
    "secondaryTags": [
      "thorn",
      "leaf",
      "spark"
    ],
    "dc": 22,
    "effect": "A dangerous stimulant that may mimic haste-like speed by DM ruling."
  },
  {
    "id": "alchemy:potion-of-superior-healing",
    "name": "Potion of Superior Healing",
    "item_type": "Potion",
    "rarity": "Very Rare",
    "requiredTags": [
      "vital",
      "phoenix",
      "sun",
      "gold"
    ],
    "secondaryTags": [
      "root",
      "honey",
      "flower"
    ],
    "dc": 22,
    "effect": "A potent restorative draught for serious wounds."
  },
  {
    "id": "alchemy:potion-of-invisibility",
    "name": "Potion of Invisibility",
    "item_type": "Potion",
    "rarity": "Very Rare",
    "requiredTags": [
      "ghost",
      "moon",
      "mist",
      "shadow"
    ],
    "secondaryTags": [
      "silver",
      "dew",
      "mushroom"
    ],
    "dc": 22,
    "effect": "Bends light and attention away from the drinker."
  },
  {
    "id": "alchemy:oil-of-etherealness",
    "name": "Oil of Etherealness",
    "item_type": "Oil",
    "rarity": "Very Rare",
    "requiredTags": [
      "ghost",
      "phase",
      "mist",
      "silver"
    ],
    "secondaryTags": [
      "moon",
      "dew",
      "resin"
    ],
    "dc": 22,
    "effect": "An oil that thins the boundary between the user and the Ethereal Plane."
  },
  {
    "id": "alchemy:oil-of-sharpness",
    "name": "Oil of Sharpness",
    "item_type": "Oil",
    "rarity": "Very Rare",
    "requiredTags": [
      "edge",
      "silver",
      "thorn",
      "crystal"
    ],
    "secondaryTags": [
      "oil",
      "resin",
      "iron"
    ],
    "dc": 22,
    "effect": "A weapon oil that sharpens a blade to supernatural keenness."
  },
  {
    "id": "alchemy:purple-worm-poison",
    "name": "Purple Worm Poison",
    "item_type": "Poison",
    "rarity": "Very Rare",
    "requiredTags": [
      "venom",
      "worm",
      "toxic",
      "deep"
    ],
    "secondaryTags": [
      "ichor",
      "mushroom",
      "ash"
    ],
    "dc": 24,
    "effect": "A deadly poison requiring rare venom and stabilizers."
  },
  {
    "id": "alchemy:potion-of-flying",
    "name": "Potion of Flying",
    "item_type": "Potion",
    "rarity": "Very Rare",
    "requiredTags": [
      "sky",
      "feather",
      "cloud",
      "storm"
    ],
    "secondaryTags": [
      "dew",
      "silver",
      "sun"
    ],
    "dc": 23,
    "effect": "A rare aerial tonic that grants flight for a short time."
  },
  {
    "id": "alchemy:potion-of-storm-giant-strength",
    "name": "Potion of Storm Giant Strength",
    "item_type": "Potion",
    "rarity": "Legendary",
    "requiredTags": [
      "giant",
      "storm",
      "heart",
      "thunder"
    ],
    "secondaryTags": [
      "cloud",
      "crystal",
      "gold"
    ],
    "dc": 27,
    "effect": "A legendary giant-strength draught keyed to storm giant might."
  },
  {
    "id": "alchemy:potion-of-giant-size",
    "name": "Potion of Giant Size",
    "item_type": "Potion",
    "rarity": "Legendary",
    "requiredTags": [
      "giant",
      "root",
      "world",
      "sun"
    ],
    "secondaryTags": [
      "sap",
      "heart",
      "gold"
    ],
    "dc": 28,
    "effect": "A mythic growth formula that may make the drinker enormous."
  },
  {
    "id": "alchemy:potion-of-dragon-majesty",
    "name": "Potion of Dragon's Majesty",
    "item_type": "Potion",
    "rarity": "Legendary",
    "requiredTags": [
      "dragon",
      "heart",
      "crown",
      "ember"
    ],
    "secondaryTags": [
      "gold",
      "scale",
      "sun"
    ],
    "dc": 29,
    "effect": "A legendary draconic transformation draught requiring rare monster catalysts."
  },
  {
    "id": "alchemy:potion-of-invulnerability",
    "name": "Potion of Invulnerability",
    "item_type": "Potion",
    "rarity": "Legendary",
    "requiredTags": [
      "ward",
      "diamond",
      "iron",
      "heart"
    ],
    "secondaryTags": [
      "gold",
      "root",
      "crystal"
    ],
    "dc": 29,
    "effect": "A near-mythic defensive draught that hardens the body against harm."
  }
];


const ALCHEMY_DETAIL_OVERRIDES = {"Potion of Acid Breath":{"duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Dexterity saving throw, taking 3d6 acid damage on a failed save or half as much on a success."},"Potion of Cold Breath":{"duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Constitution saving throw, taking 3d6 cold damage on a failed save or half as much on a success."},"Potion of Fire Breath":{"duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Dexterity saving throw, taking 3d6 fire damage on a failed save or half as much on a success."},"Potion of Force Breath":{"duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Strength saving throw, taking 3d6 force damage on a failed save or half as much on a success."},"Potion of Lightning Breath":{"duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Dexterity saving throw, taking 3d6 lightning damage on a failed save or half as much on a success."},"Potion of Necrotic Breath":{"duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Constitution saving throw, taking 3d6 necrotic damage on a failed save or half as much on a success."},"Potion of Poison Breath":{"duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Constitution saving throw, taking 3d6 poison damage on a failed save or half as much on a success."},"Potion of Psychic Breath":{"duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Wisdom saving throw, taking 3d6 psychic damage on a failed save or half as much on a success."},"Potion of Radiant Breath":{"duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Constitution saving throw, taking 3d6 radiant damage on a failed save or half as much on a success."},"Potion of Thunder Breath":{"duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Constitution saving throw, taking 3d6 thunder damage on a failed save or half as much on a success."},"Antitoxin":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker has Advantage on saving throws against poison."},"Healing Potion":{"duration":"Instant","use":"Bonus Action to use or apply","effect":"The drinker regains 2d4 + 2 hit points. Ingredient bonuses scale both the dice and the attached flat modifier."},"Philter of Love":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker is charmed by the first creature they see shortly after drinking, by DM ruling."},"Potion of Anchoring":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker has Advantage on checks and saving throws made to resist being moved, knocked Prone, or Grappled, and counts as one size larger when determining whether a creature or effect can move them."},"Potion of Animal Friendship":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker can cast Animal Friendship, with the save DC set by the potion or DM."},"Potion of Breath":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker does not need to breathe and can survive underwater, in an airless space, or in another environment where breathing is impossible."},"Potion of Clairvoyance":{"duration":"10 minutes","use":"Bonus Action to use or apply","effect":"The drinker gains the effect of Clairvoyance."},"Potion of Comprehension":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker understands the literal meaning of spoken and written languages they perceive."},"Potion of Diminution":{"duration":"1d4 hours","use":"Bonus Action to use or apply","effect":"For 1d4 hours, the drinker decreases by one size category. The drinker has Advantage on Dexterity checks and gains +1 AC per size category decreased. This potion does not impose Disadvantage on Strength checks or saves. Each complete Effect +100% adds one additional size-category decrease and another +1 AC."},"Potion of Dragon's Majesty":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker transforms or gains draconic majesty by DM ruling, often including flight, breath, or imposing presence."},"Potion of Flying":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker gains a flying speed equal to walking speed and can hover. Effect bonuses increase the flying speed by the same percentage."},"Potion of Gaseous Form":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains the effect of Gaseous Form."},"Potion of Growth":{"duration":"1d4 hours","use":"Bonus Action to use or apply","effect":"For 1d4 hours, the drinker increases by one size category. The drinker has Advantage on Strength checks and Strength saving throws, and weapon or Unarmed Strike hits deal an extra 1d4 damage per size category increased. Each complete Effect +100% adds one additional size-category increase and another 1d4."},"Potion of Heroism":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains 1d10 temporary hit points and is affected by Bless for 1 hour."},"Potion of Invisibility":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker becomes invisible until they attack, cast a spell, or the duration ends."},"Potion of Invulnerability":{"duration":"1 day","use":"Bonus Action to use or apply","effect":"For 1 day, the drinker has resistance to all damage."},"Potion of Mind Reading":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains the effect of Detect Thoughts."},"Potion of Night Vision":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker gains darkvision out to 60 feet. Effect bonuses increase the darkvision range by the same percentage."},"Potion of Physical Prowess":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"For 1 hour, the drinker has Advantage on Strength-, Dexterity-, and Constitution-based ability checks and gains a climbing speed equal to walking speed. Every complete Effect +100% adds +1 to those checks."},"Potion of Quickstep":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"For 1 minute, the drinker can use Misty Step as a Bonus Action on each of their turns without expending a spell slot or components."},"Potion of Regeneration":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"At the start of each of the drinker's turns, the drinker regains 1d4 HP for the duration."},"Potion of Speed":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"The drinker gains the effect of Haste."},"Potion of Storm Giant Transformation":{"duration":"1 day","use":"Bonus Action to use or apply","effect":"For 1 day, the drinker becomes Huge and their Strength becomes 29 unless it is already higher. A Huge creature occupies a 15-by-15-foot space."},"Potion of Watchful Rest":{"duration":"8 hours","use":"Bonus Action to use or apply","effect":"The drinker remains alert during rest and can avoid the worst effects of magical sleep by DM ruling."},"Poison of Charisma Weakening":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The target chooses Constitution or Charisma before rolling. On a failed save, Charisma is reduced by 1d6 temporarily."},"Poison of Constitution Weakening":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The target chooses Constitution or Constitution before rolling. On a failed save, Constitution is reduced by 1d6 temporarily."},"Poison of Dexterity Weakening":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The target chooses Constitution or Dexterity before rolling. On a failed save, Dexterity is reduced by 1d6 temporarily."},"Poison of Intelligence Weakening":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The target chooses Constitution or Intelligence before rolling. On a failed save, Intelligence is reduced by 1d6 temporarily."},"Poison of Strength Weakening":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The target chooses Constitution or Strength before rolling. On a failed save, Strength is reduced by 1d6 temporarily."},"Poison of Wisdom Weakening":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The target chooses Constitution or Wisdom before rolling. On a failed save, Wisdom is reduced by 1d6 temporarily."},"Basic Poison":{"duration":"1 minute after application","use":"Bonus Action to use or apply","effect":"A creature hit by the coated weapon or ammunition must make a Constitution save or take poison damage, per DM ruling."},"Mindfog Poison":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"The target makes a Wisdom saving throw. On a failure, it is Confused for 1 minute and repeats the save at the end of each turn."},"Paralytic Venom":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"The target makes a Constitution saving throw. On a failure, it is Paralyzed for 1 minute and repeats the save at the end of each turn."},"Purple Worm Poison":{"duration":"Until delivered","use":"Bonus Action to use or apply","effect":"A creature exposed to the poison makes a Constitution save or takes heavy poison damage."},"Siren's Whisper Poison":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"The target makes a Wisdom saving throw. On a failure, it is Charmed for 1 minute. The effect ends early if the target is harmed by the charmer or the charmer's allies."},"Stoneblood Toxin":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"The target makes a Constitution saving throw. On a failure, it is Petrified for 1 minute and repeats the save at the end of each turn."},"Bomb of Blindness":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Blinded for 1 minute."},"Bomb of Charm":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius cloud make a Wisdom saving throw. On a failed save, a creature is Charmed for 1 minute."},"Bomb of Confusion":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius cloud make a Wisdom saving throw. On a failed save, a creature is Confused for 1 minute."},"Bomb of Deafness":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Deafened for 1 minute."},"Bomb of Fear":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius cloud make a Wisdom saving throw. On a failed save, a creature is Frightened for 1 minute."},"Bomb of Paralysis":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Paralyzed for 1 minute."},"Bomb of Petrification":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Petrified for 1 minute."},"Bomb of Poisoning":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Poisoned for 1 minute."},"Bomb of Restraint":{"duration":"1 minute","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius cloud make a Dexterity saving throw. On a failed save, a creature is Restrained for 1 minute."},"Bomb of Stunning":{"duration":"Until the end of the target's next turn","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Stunned for Until the end of the target's next turn."},"Bomb of Acid":{"duration":"Instant","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 2d6 acid damage on a failed save or half as much on a success."},"Bomb of Cold":{"duration":"Instant","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 2d6 cold damage on a failed save or half as much on a success."},"Bomb of Fire":{"duration":"Instant","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 2d6 fire damage on a failed save or half as much on a success."},"Bomb of Force":{"duration":"Instant","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 3d6 force damage on a failed save or half as much on a success."},"Bomb of Lightning":{"duration":"Instant","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 2d6 lightning damage on a failed save or half as much on a success."},"Bomb of Necrotic":{"duration":"Instant","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius burst make a Constitution saving throw, taking 3d6 necrotic damage on a failed save or half as much on a success."},"Bomb of Poison":{"duration":"Instant","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius burst make a Constitution saving throw, taking 2d6 poison damage on a failed save or half as much on a success."},"Bomb of Psychic":{"duration":"Instant","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius burst make a Wisdom saving throw, taking 3d6 psychic damage on a failed save or half as much on a success."},"Bomb of Radiant":{"duration":"Instant","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 3d6 radiant damage on a failed save or half as much on a success."},"Bomb of Thunder":{"duration":"Instant","use":"Bonus Action to use or apply","effect":"Creatures in a 10-foot-radius burst make a Constitution saving throw, taking 2d6 thunder damage on a failed save or half as much on a success."},"Elixir of Charisma":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Charisma increases by 1d4 for the duration."},"Elixir of Constitution":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Constitution increases by 1d4 for the duration."},"Elixir of Dexterity":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Dexterity increases by 1d4 for the duration."},"Elixir of Intelligence":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Intelligence increases by 1d4 for the duration."},"Elixir of Strength":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Strength increases by 1d4 for the duration."},"Elixir of Wisdom":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Wisdom increases by 1d4 for the duration."},"Elixir of Blindness Immunity":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Immediately ends the Blinded condition if present and grants immunity to Blinded for 1 hour."},"Elixir of Charm Immunity":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Immediately ends the Charmed condition if present and grants immunity to Charmed for 1 hour."},"Elixir of Confusion Immunity":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Immediately ends the Confused condition if present and grants immunity to Confused for 1 hour."},"Elixir of Deafness Immunity":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Immediately ends the Deafened condition if present and grants immunity to Deafened for 1 hour."},"Elixir of Fear Immunity":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Immediately ends the Frightened condition if present and grants immunity to Frightened for 1 hour."},"Elixir of Paralysis Immunity":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Immediately ends the Paralyzed condition if present and grants immunity to Paralyzed for 1 hour."},"Elixir of Petrification Immunity":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Immediately ends the Petrified condition if present and grants immunity to Petrified for 1 hour."},"Elixir of Poison Immunity":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Immediately ends the Poisoned condition if present and grants immunity to Poisoned for 1 hour."},"Elixir of Restraint Immunity":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Immediately ends the Restrained condition if present and grants immunity to Restrained for 1 hour."},"Elixir of Stunning Immunity":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Immediately ends the Stunned condition if present and grants immunity to Stunned for 1 hour."},"Elixir of Acid Resistance":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains resistance to acid damage for 1 hour."},"Elixir of Cold Resistance":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains resistance to cold damage for 1 hour."},"Elixir of Fire Resistance":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains resistance to fire damage for 1 hour."},"Elixir of Force Resistance":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains resistance to force damage for 1 hour."},"Elixir of Lightning Resistance":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains resistance to lightning damage for 1 hour."},"Elixir of Necrotic Resistance":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains resistance to necrotic damage for 1 hour."},"Elixir of Poison Resistance":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains resistance to poison damage for 1 hour."},"Elixir of Psychic Resistance":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains resistance to psychic damage for 1 hour."},"Elixir of Radiant Resistance":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains resistance to radiant damage for 1 hour."},"Elixir of Thunder Resistance":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"The drinker gains resistance to thunder damage for 1 hour."},"Oil of Blindness":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Blinded for 1 minute."},"Oil of Charm":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Wisdom saving throw; on a failed save, the target is Charmed for 1 minute."},"Oil of Confusion":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Wisdom saving throw; on a failed save, the target is Confused for 1 minute."},"Oil of Deafness":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Deafened for 1 minute."},"Oil of Fear":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Wisdom saving throw; on a failed save, the target is Frightened for 1 minute."},"Oil of Paralysis":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Paralyzed for 1 minute."},"Oil of Petrification":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Petrified for 1 minute."},"Oil of Poisoning":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Poisoned for 1 minute."},"Oil of Restraint":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Dexterity saving throw; on a failed save, the target is Restrained for 1 minute."},"Oil of Stunning":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Stunned for Until the end of the target's next turn."},"Oil of Acid":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 acid damage."},"Oil of Cold":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 cold damage."},"Oil of Fire":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 fire damage."},"Oil of Force":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d6 force damage."},"Oil of Lightning":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 lightning damage."},"Oil of Necrotic":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d6 necrotic damage."},"Oil of Poison":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 poison damage."},"Oil of Psychic":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d6 psychic damage."},"Oil of Radiant":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d6 radiant damage."},"Oil of Thunder":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 thunder damage."},"Oil of Etherealness":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"One vial can cover one Medium or smaller creature and grants the effect of Etherealness."},"Oil of Sharpness":{"duration":"1 hour","use":"Bonus Action to use or apply","effect":"A coated slashing or piercing weapon or ammunition gains a temporary bonus to attack and damage rolls by DM ruling."}};
function alchemyDetailForName(name = "") {
  const clean = String(name || "").replace(/^Craft\s+/i, "").trim();
  if (/^Potion of (X|Poison|Fire|Cold|Acid|Lightning|Thunder|Radiant|Necrotic|Psychic|Force) Resistance$/i.test(clean)) {
    return { duration: "1 hour", use: "Action to drink", effect: "The drinker gains resistance to the damage type set by the fourth-slot essence or monster component." };
  }
  if (/^Elixir of (X|Blindness|Charm|Confusion|Fear|Paralysis|Petrification|Poison|Restraint|Stunning) Immunity$/i.test(clean)) {
    return { duration: "1 hour", use: ALCHEMY_STANDARD_USE, effect: "Immediately ends the condition set by the fourth-slot counteragent, then grants immunity to that condition for 1 hour." };
  }
  if (/^Potion of (Superior|Greater|Supreme)?\s*Healing$/i.test(clean) || /^(Healing Draught|Healing Potion)$/i.test(clean)) {
    return { duration: "Instant", use: "Action to drink or administer", effect: "Restores 2d4 + 2 HP. Die-step components upgrade the die first; Effect bonuses increase the resolved healing afterward." };
  }
  const elementalBreath = clean.match(/^Potion of (Acid|Cold|Fire|Force|Lightning|Necrotic|Poison|Psychic|Radiant|Thunder) Breath$/i);
  if (elementalBreath) {
    const element = titleCase(elementalBreath[1]);
    const saveMap = { Acid: "Dexterity", Cold: "Constitution", Fire: "Dexterity", Force: "Strength", Lightning: "Dexterity", Necrotic: "Constitution", Poison: "Constitution", Psychic: "Wisdom", Radiant: "Constitution", Thunder: "Constitution" };
    return { duration: "1 hour or 3 uses", use: ALCHEMY_STANDARD_USE, effect: `For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a ${saveMap[element] || "Dexterity"} saving throw, taking 3d6 ${element.toLowerCase()} damage on a failed save or half as much on a success.` };
  }
  const abilityElixir = clean.match(/^Elixir of (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)$/i);
  if (abilityElixir) return { duration: "1 hour", use: "Action to drink", effect: `${titleCase(abilityElixir[1])} increases by 1d4 for 1 hour. Die step changes the die first; Effect bonuses increase the rolled result afterward.` };
  const abilityPoison = clean.match(/^Poison of (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Weakening$/i);
  if (abilityPoison) return { duration: "1 hour", use: "Action to apply or deliver", effect: `The target chooses Constitution or ${titleCase(abilityPoison[1])} before rolling. On a failed save, ${titleCase(abilityPoison[1])} is reduced by 1d6 temporarily.` };
  return ALCHEMY_DETAIL_OVERRIDES[clean] || null;
}

const COMPACT_ALCHEMY_RECIPE_NAMES = new Set(["Healing Draught","Potion of Healing","Healing Potion","Potion of Superior Healing","Potion of Resistance","Potion of Poison Resistance","Potion of Fire Resistance","Potion of Cold Resistance","Potion of Acid Resistance","Potion of Lightning Resistance","Potion of Fire Breath","Ironroot Salve","Night-Eye Drops","Potion of Climbing","Quickstep Tonic","Potion of Water Breathing","Potion of Giant Size","Potion of Storm Giant Strength"]);

const ABILITY_NAMES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

const ALCHEMY_DYNAMIC_FORMULAS = [{"id":"alchemy:potion-of-acid-breath","name":"Potion of Acid Breath","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Dexterity saving throw, taking 3d6 acid damage on a failed save or half as much on a success.","duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_acid_breath_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_acid_breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_acid_breath_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_acid_breath_modifier","role":"Acid component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","note":"Required fourth slot: choose a component tagged Acid."}],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Acid tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_uses":3,"base_area_feet":15,"area_shape":"cone","save_ability":"Dexterity"},{"id":"alchemy:potion-of-cold-breath","name":"Potion of Cold Breath","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Constitution saving throw, taking 3d6 cold damage on a failed save or half as much on a success.","duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_cold_breath_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_cold_breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_cold_breath_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_cold_breath_modifier","role":"Cold component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","note":"Required fourth slot: choose a component tagged Cold."}],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Cold tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_uses":3,"base_area_feet":15,"area_shape":"cone","save_ability":"Constitution"},{"id":"alchemy:potion-of-fire-breath","name":"Potion of Fire Breath","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Dexterity saving throw, taking 3d6 fire damage on a failed save or half as much on a success.","duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_fire_breath_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_fire_breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_fire_breath_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_fire_breath_modifier","role":"Fire component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","note":"Required fourth slot: choose a component tagged Fire."}],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Fire tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_uses":3,"base_area_feet":15,"area_shape":"cone","save_ability":"Dexterity"},{"id":"alchemy:potion-of-force-breath","name":"Potion of Force Breath","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Strength saving throw, taking 3d6 force damage on a failed save or half as much on a success.","duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_force_breath_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_force_breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_force_breath_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_force_breath_modifier","role":"Force component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","note":"Required fourth slot: choose a component tagged Force."}],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Force tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_uses":3,"base_area_feet":15,"area_shape":"cone","save_ability":"Strength"},{"id":"alchemy:potion-of-lightning-breath","name":"Potion of Lightning Breath","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Dexterity saving throw, taking 3d6 lightning damage on a failed save or half as much on a success.","duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_lightning_breath_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_lightning_breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_lightning_breath_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_lightning_breath_modifier","role":"Lightning component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","note":"Required fourth slot: choose a component tagged Lightning."}],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Lightning tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_uses":3,"base_area_feet":15,"area_shape":"cone","save_ability":"Dexterity"},{"id":"alchemy:potion-of-necrotic-breath","name":"Potion of Necrotic Breath","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Constitution saving throw, taking 3d6 necrotic damage on a failed save or half as much on a success.","duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_necrotic_breath_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_necrotic_breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_necrotic_breath_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_necrotic_breath_modifier","role":"Necrotic component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","note":"Required fourth slot: choose a component tagged Necrotic."}],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Necrotic tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_uses":3,"base_area_feet":15,"area_shape":"cone","save_ability":"Constitution"},{"id":"alchemy:potion-of-poison-breath","name":"Potion of Poison Breath","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Constitution saving throw, taking 3d6 poison damage on a failed save or half as much on a success.","duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_poison_breath_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_poison_breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_poison_breath_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_poison_breath_modifier","role":"Poison component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","note":"Required fourth slot: choose a component tagged Poison."}],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Poison tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_uses":3,"base_area_feet":15,"area_shape":"cone","save_ability":"Constitution"},{"id":"alchemy:potion-of-psychic-breath","name":"Potion of Psychic Breath","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Wisdom saving throw, taking 3d6 psychic damage on a failed save or half as much on a success.","duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_psychic_breath_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_psychic_breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_psychic_breath_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_psychic_breath_modifier","role":"Psychic component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","note":"Required fourth slot: choose a component tagged Psychic."}],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Psychic tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_uses":3,"base_area_feet":15,"area_shape":"cone","save_ability":"Wisdom"},{"id":"alchemy:potion-of-radiant-breath","name":"Potion of Radiant Breath","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Constitution saving throw, taking 3d6 radiant damage on a failed save or half as much on a success.","duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_radiant_breath_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_radiant_breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_radiant_breath_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_radiant_breath_modifier","role":"Radiant component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","note":"Required fourth slot: choose a component tagged Radiant."}],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Radiant tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_uses":3,"base_area_feet":15,"area_shape":"cone","save_ability":"Constitution"},{"id":"alchemy:potion-of-thunder-breath","name":"Potion of Thunder Breath","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker can use a Bonus Action up to three times to exhale a 15-foot cone. Creatures in the cone make a Constitution saving throw, taking 3d6 thunder damage on a failed save or half as much on a success.","duration":"1 hour or 3 uses","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_thunder_breath_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_thunder_breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_thunder_breath_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_thunder_breath_modifier","role":"Thunder component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","note":"Required fourth slot: choose a component tagged Thunder."}],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Thunder tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_uses":3,"base_area_feet":15,"area_shape":"cone","save_ability":"Constitution"},{"id":"alchemy:antitoxin","name":"Antitoxin","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Common","effect":"The drinker has Advantage on saving throws against poison.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"antitoxin_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"antitoxin_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"antitoxin_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Common","required":true},{"key":"antitoxin_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","holy_vital","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: purifying enhancer, holy component, or antivenom monster part."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"antitoxin","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:healing-potion","name":"Healing Potion","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Common","effect":"The drinker regains 2d4 + 2 hit points. Ingredient bonuses scale both the dice and the attached flat modifier.","duration":"Instant","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"healing_potion_core_1","role":"Core ingredient 1","family":"mushroom","min_rarity":"Common","required":true},{"key":"healing_potion_core_2","role":"Core ingredient 2","family":"mushroom","min_rarity":"Common","required":true},{"key":"healing_potion_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true},{"key":"healing_potion_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["holy_vital","enhancer","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: holy/vital component, distillation agent, or restorative monster component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"healing-potion","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":2,"base_die_size":4,"base_flat_bonus":2,"dice_purpose":"healing"},{"id":"alchemy:philter-of-love","name":"Philter of Love","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","effect":"The drinker is charmed by the first creature they see shortly after drinking, by DM ruling.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"philter_of_love_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true},{"key":"philter_of_love_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"philter_of_love_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"philter_of_love_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: fey, psychic, or glamour essence."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"philter-of-love","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-anchoring","name":"Potion of Anchoring","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker has Advantage on checks and saving throws made to resist being moved, knocked Prone, or Grappled, and counts as one size larger when determining whether a creature or effect can move them.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_anchoring_core_1","role":"Core ingredient 1","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_anchoring_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"potion_of_anchoring_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_anchoring_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: defensive enhancer, earth essence, or reinforcing monster component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-anchoring","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-animal-friendship","name":"Potion of Animal Friendship","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","effect":"The drinker can cast Animal Friendship, with the save DC set by the potion or DM.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_animal_friendship_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_animal_friendship_core_2","role":"Core ingredient 2","family":"leaf_vine","min_rarity":"Common","required":true},{"key":"potion_of_animal_friendship_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true},{"key":"potion_of_animal_friendship_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["essence","monster_fluid","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: fey essence or beast-derived component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-animal-friendship","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-breath","name":"Potion of Breath","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker does not need to breathe and can survive underwater, in an airless space, or in another environment where breathing is impossible.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_breath_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_breath_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_breath_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_breath_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["essence","monster_fluid","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: aquatic essence, gill, mucus, or water-aligned monster component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-breath","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-clairvoyance","name":"Potion of Clairvoyance","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Rare","effect":"The drinker gains the effect of Clairvoyance.","duration":"10 minutes","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_clairvoyance_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_clairvoyance_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_clairvoyance_core_3","role":"Core ingredient 3","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"potion_of_clairvoyance_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: psychic, crystal, or remote-sensing essence."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-clairvoyance","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-comprehension","name":"Potion of Comprehension","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Common","effect":"The drinker understands the literal meaning of spoken and written languages they perceive.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_comprehension_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_comprehension_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_comprehension_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true},{"key":"potion_of_comprehension_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: psychic, linguistic, or scribe-aligned essence."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-comprehension","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-diminution","name":"Potion of Diminution","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Rare","effect":"For 1d4 hours, the drinker decreases by one size category. The drinker has Advantage on Dexterity checks and gains +1 AC per size category decreased. This potion does not impose Disadvantage on Strength checks or saves. Each complete Effect +100% adds one additional size-category decrease and another +1 AC.","duration":"1d4 hours","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_diminution_core_1","role":"Core ingredient 1","family":"mushroom","min_rarity":"Common","required":true},{"key":"potion_of_diminution_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"potion_of_diminution_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_diminution_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: transmutation enhancer or size-altering essence."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-diminution","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":null,"base_die_size":null,"base_flat_bonus":null,"dice_purpose":"size_reduction"},{"id":"alchemy:potion-of-dragon-s-majesty","name":"Potion of Dragon's Majesty","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Legendary","effect":"The drinker transforms or gains draconic majesty by DM ruling, often including flight, breath, or imposing presence.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_dragon_s_majesty_core_1","role":"Core ingredient 1","family":"mushroom","min_rarity":"Common","required":true},{"key":"potion_of_dragon_s_majesty_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_dragon_s_majesty_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_dragon_s_majesty_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":true,"allowed_families":["monster_fluid","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Required fourth slot: dragon gland, blood, scale essence, or another draconic component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-dragon-s-majesty","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-flying","name":"Potion of Flying","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Very Rare","effect":"For 1 hour, the drinker gains a flying speed equal to walking speed and can hover. Effect bonuses increase the flying speed by the same percentage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_flying_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Common","required":true},{"key":"potion_of_flying_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_flying_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_flying_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["essence","monster_fluid","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: air essence, wing membrane, or flight enhancer."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-flying","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-gaseous-form","name":"Potion of Gaseous Form","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Rare","effect":"The drinker gains the effect of Gaseous Form.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_gaseous_form_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Common","required":true},{"key":"potion_of_gaseous_form_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_gaseous_form_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_gaseous_form_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: air, mist, or phase essence."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-gaseous-form","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-growth","name":"Potion of Growth","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","effect":"For 1d4 hours, the drinker increases by one size category. The drinker has Advantage on Strength checks and Strength saving throws, and weapon or Unarmed Strike hits deal an extra 1d4 damage per size category increased. Each complete Effect +100% adds one additional size-category increase and another 1d4.","duration":"1d4 hours","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_growth_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"potion_of_growth_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_growth_core_3","role":"Core ingredient 3","family":"mushroom","min_rarity":"Common","required":true},{"key":"potion_of_growth_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["monster_fluid","enhancer","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: giant blood or transmutation enhancer."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-growth","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":4,"base_flat_bonus":0,"dice_purpose":"damage_bonus"},{"id":"alchemy:potion-of-heroism","name":"Potion of Heroism","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Rare","effect":"The drinker gains 1d10 temporary hit points and is affected by Bless for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_heroism_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"potion_of_heroism_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_heroism_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_heroism_modifier","role":"Radiant component","family":"any","slot_type":"modifier","required":true,"allowed_families":["holy_vital"],"required_tags_any":["Radiant","Holy"],"required_tags_all":[],"tag_label":"Radiant","note":"Required fourth slot: choose a Holy Component tagged Radiant or Holy."}],"required_tags_any":["Radiant","Holy"],"required_tags_all":[],"tag_label":"Radiant","formula_family":"Heroism Potion","template_key":"potion-of-heroism","theme_source":"Required Holy Component; Holy and Radiant tags are interchangeable.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":10,"base_flat_bonus":0,"dice_purpose":"temporary_hit_points"},{"id":"alchemy:potion-of-invisibility","name":"Potion of Invisibility","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Very Rare","effect":"The drinker becomes invisible until they attack, cast a spell, or the duration ends.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_invisibility_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"potion_of_invisibility_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_invisibility_core_3","role":"Core ingredient 3","family":"leaf_vine","min_rarity":"Common","required":true},{"key":"potion_of_invisibility_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: shadow, phase, or light-bending essence."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-invisibility","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-invulnerability","name":"Potion of Invulnerability","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Legendary","effect":"For 1 day, the drinker has resistance to all damage.","duration":"1 day","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_invulnerability_core_1","role":"Core ingredient 1","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_invulnerability_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"potion_of_invulnerability_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_invulnerability_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["holy_vital","essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: holy, force, diamond, or mythic warding component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-invulnerability","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-mind-reading","name":"Potion of Mind Reading","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Rare","effect":"The drinker gains the effect of Detect Thoughts.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_mind_reading_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_mind_reading_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_mind_reading_core_3","role":"Core ingredient 3","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"potion_of_mind_reading_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["essence","monster_fluid","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: psychic essence or telepathic monster component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-mind-reading","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-night-vision","name":"Potion of Night Vision","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","effect":"For 1 hour, the drinker gains darkvision out to 60 feet. Effect bonuses increase the darkvision range by the same percentage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_night_vision_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_night_vision_core_2","role":"Core ingredient 2","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"potion_of_night_vision_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"potion_of_night_vision_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: shadow, moon, or sensory essence."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-night-vision","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-physical-prowess","name":"Potion of Physical Prowess","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Common","effect":"For 1 hour, the drinker has Advantage on Strength-, Dexterity-, and Constitution-based ability checks and gains a climbing speed equal to walking speed. Every complete Effect +100% adds +1 to those checks.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_physical_prowess_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Common","required":true},{"key":"potion_of_physical_prowess_core_2","role":"Core ingredient 2","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"potion_of_physical_prowess_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true},{"key":"potion_of_physical_prowess_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: spider, gecko, earth, or mobility component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-physical-prowess","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-quickstep","name":"Potion of Quickstep","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","effect":"For 1 minute, the drinker can use Misty Step as a Bonus Action on each of their turns without expending a spell slot or components.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_quickstep_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Common","required":true},{"key":"potion_of_quickstep_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_quickstep_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_quickstep_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: quickening enhancer or lightning/air essence."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-quickstep","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-regeneration","name":"Potion of Regeneration","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Rare","effect":"At the start of each of the drinker's turns, the drinker regains 1d4 HP for the duration.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_regeneration_core_1","role":"Core ingredient 1","family":"mushroom","min_rarity":"Common","required":true},{"key":"potion_of_regeneration_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_regeneration_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true},{"key":"potion_of_regeneration_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["holy_vital","monster_fluid","enhancer","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: holy/vital component, troll blood, or regeneration enhancer."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-regeneration","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-speed","name":"Potion of Speed","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Very Rare","effect":"The drinker gains the effect of Haste.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_speed_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Common","required":true},{"key":"potion_of_speed_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_speed_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"potion_of_speed_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: haste enhancer, lightning essence, or quickening monster component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-speed","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-storm-giant-transformation","name":"Potion of Storm Giant Transformation","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Legendary","effect":"For 1 day, the drinker becomes Huge and their Strength becomes 29 unless it is already higher. A Huge creature occupies a 15-by-15-foot space.","duration":"1 day","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_storm_giant_transformation_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"potion_of_storm_giant_transformation_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"potion_of_storm_giant_transformation_core_3","role":"Core ingredient 3","family":"mushroom","min_rarity":"Common","required":true},{"key":"potion_of_storm_giant_transformation_modifier","role":"Storm component","family":"any","slot_type":"modifier","required":true,"allowed_families":["monster_fluid"],"required_tags_any":[],"required_tags_all":["Storm","Giant"],"tag_label":"Storm","note":"Required fourth slot: choose a Monster Part carrying both Storm and Giant tags."}],"required_tags_any":[],"required_tags_all":["Storm","Giant"],"tag_label":"Storm","formula_family":"Giant Transformation","template_key":"potion-of-storm-giant-transformation","theme_source":"Required Storm Giant Monster Part.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:potion-of-watchful-rest","name":"Potion of Watchful Rest","item_type":"Potion","alchemy_section":"Potions","alchemy_group":"General Potions","rarity":"Common","effect":"The drinker remains alert during rest and can avoid the worst effects of magical sleep by DM ruling.","duration":"8 hours","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"potion_of_watchful_rest_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true},{"key":"potion_of_watchful_rest_core_2","role":"Core ingredient 2","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"potion_of_watchful_rest_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true},{"key":"potion_of_watchful_rest_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: dream, moon, or vigilance essence."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"potion-of-watchful-rest","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:poison-of-charisma-weakening","name":"Poison of Charisma Weakening","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","effect":"The target chooses Constitution or Charisma before rolling. On a failed save, Charisma is reduced by 1d6 temporarily.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"poison_of_charisma_weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"poison_of_charisma_weakening_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"poison_of_charisma_weakening_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"poison_of_charisma_weakening_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Poison of X Weakening","template_key":"poison-of-charisma-weakening","theme_source":"Named formula variant sets the attacked ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:poison-of-constitution-weakening","name":"Poison of Constitution Weakening","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","effect":"The target chooses Constitution or Constitution before rolling. On a failed save, Constitution is reduced by 1d6 temporarily.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"poison_of_constitution_weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"poison_of_constitution_weakening_core_2","role":"Core ingredient 2","family":"mushroom","min_rarity":"Common","required":true},{"key":"poison_of_constitution_weakening_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true},{"key":"poison_of_constitution_weakening_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Poison of X Weakening","template_key":"poison-of-constitution-weakening","theme_source":"Named formula variant sets the attacked ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:poison-of-dexterity-weakening","name":"Poison of Dexterity Weakening","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","effect":"The target chooses Constitution or Dexterity before rolling. On a failed save, Dexterity is reduced by 1d6 temporarily.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"poison_of_dexterity_weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"poison_of_dexterity_weakening_core_2","role":"Core ingredient 2","family":"leaf_vine","min_rarity":"Common","required":true},{"key":"poison_of_dexterity_weakening_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Common","required":true},{"key":"poison_of_dexterity_weakening_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Poison of X Weakening","template_key":"poison-of-dexterity-weakening","theme_source":"Named formula variant sets the attacked ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:poison-of-intelligence-weakening","name":"Poison of Intelligence Weakening","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","effect":"The target chooses Constitution or Intelligence before rolling. On a failed save, Intelligence is reduced by 1d6 temporarily.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"poison_of_intelligence_weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"poison_of_intelligence_weakening_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"poison_of_intelligence_weakening_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"poison_of_intelligence_weakening_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Poison of X Weakening","template_key":"poison-of-intelligence-weakening","theme_source":"Named formula variant sets the attacked ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:poison-of-strength-weakening","name":"Poison of Strength Weakening","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","effect":"The target chooses Constitution or Strength before rolling. On a failed save, Strength is reduced by 1d6 temporarily.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"poison_of_strength_weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"poison_of_strength_weakening_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"poison_of_strength_weakening_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"poison_of_strength_weakening_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Poison of X Weakening","template_key":"poison-of-strength-weakening","theme_source":"Named formula variant sets the attacked ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:poison-of-wisdom-weakening","name":"Poison of Wisdom Weakening","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","effect":"The target chooses Constitution or Wisdom before rolling. On a failed save, Wisdom is reduced by 1d6 temporarily.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"poison_of_wisdom_weakening_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"poison_of_wisdom_weakening_core_2","role":"Core ingredient 2","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"poison_of_wisdom_weakening_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Common","required":true},{"key":"poison_of_wisdom_weakening_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Poison of X Weakening","template_key":"poison-of-wisdom-weakening","theme_source":"Named formula variant sets the attacked ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:basic-poison","name":"Basic Poison","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Special Poisons","rarity":"Common","effect":"A creature hit by the coated weapon or ammunition must make a Constitution save or take poison damage, per DM ruling.","duration":"1 minute after application","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"basic_poison_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"basic_poison_core_2","role":"Core ingredient 2","family":"mushroom","min_rarity":"Common","required":true},{"key":"basic_poison_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true},{"key":"basic_poison_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: monster venom, elemental essence, or poison enhancer."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"basic-poison","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:mindfog-poison","name":"Mindfog Poison","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Special Poisons","rarity":"Rare","effect":"The target makes a Wisdom saving throw. On a failure, it is Confused for 1 minute and repeats the save at the end of each turn.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"mindfog_poison_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"mindfog_poison_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"mindfog_poison_core_3","role":"Core ingredient 3","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"mindfog_poison_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":true,"allowed_families":["essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Required fourth slot: Mindshard Distillate, Aboleth Mucus, or another psychic component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"mindfog-poison","theme_source":"","condition_riders":["Confused"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"End of each turn"},{"id":"alchemy:paralytic-venom","name":"Paralytic Venom","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Special Poisons","rarity":"Rare","effect":"The target makes a Constitution saving throw. On a failure, it is Paralyzed for 1 minute and repeats the save at the end of each turn.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"paralytic_venom_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"paralytic_venom_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"paralytic_venom_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Common","required":true},{"key":"paralytic_venom_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":true,"allowed_families":["monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Required fourth slot: Ghoul Ichor or another paralytic component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"paralytic-venom","theme_source":"","condition_riders":["Paralyzed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn"},{"id":"alchemy:purple-worm-poison","name":"Purple Worm Poison","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Special Poisons","rarity":"Very Rare","effect":"A creature exposed to the poison makes a Constitution save or takes heavy poison damage.","duration":"Until delivered","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"purple_worm_poison_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"purple_worm_poison_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"purple_worm_poison_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"purple_worm_poison_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":true,"allowed_families":["monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Required fourth slot: Purple Worm venom or an equivalent legendary monster toxin."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"purple-worm-poison","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:siren-s-whisper-poison","name":"Siren's Whisper Poison","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Special Poisons","rarity":"Rare","effect":"The target makes a Wisdom saving throw. On a failure, it is Charmed for 1 minute. The effect ends early if the target is harmed by the charmer or the charmer's allies.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"siren_s_whisper_poison_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"siren_s_whisper_poison_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"siren_s_whisper_poison_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"siren_s_whisper_poison_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":true,"allowed_families":["monster_fluid","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Required fourth slot: Siren Gland Extract, fey essence, or another charm-bearing component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"siren-s-whisper-poison","theme_source":"","condition_riders":["Charmed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"Ends when harmed"},{"id":"alchemy:stoneblood-toxin","name":"Stoneblood Toxin","item_type":"Poison","alchemy_section":"Poisons","alchemy_group":"Special Poisons","rarity":"Very Rare","effect":"The target makes a Constitution saving throw. On a failure, it is Petrified for 1 minute and repeats the save at the end of each turn.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"stoneblood_toxin_core_1","role":"Core ingredient 1","family":"venom_poison","min_rarity":"Common","required":true},{"key":"stoneblood_toxin_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"stoneblood_toxin_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true},{"key":"stoneblood_toxin_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":true,"allowed_families":["monster_fluid","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Required fourth slot: Basilisk Bile, Medusa-derived essence, or another petrifying component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"stoneblood-toxin","theme_source":"","condition_riders":["Petrified"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn"},{"id":"alchemy:bomb-of-blindness","name":"Bomb of Blindness","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Uncommon","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Blinded for 1 minute.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_blindness_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_blindness_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"bomb_of_blindness_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_blindness_modifier","role":"Blindness component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Blindness","Sight"],"required_tags_all":[],"tag_label":"Blindness","note":"Required fourth slot: choose a component tagged Blindness, Sight."}],"required_tags_any":["Blindness","Sight"],"required_tags_all":[],"tag_label":"Blindness","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Blindness, Sight.","condition_riders":["Blinded"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"id":"alchemy:bomb-of-charm","name":"Bomb of Charm","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","effect":"Creatures in a 10-foot-radius cloud make a Wisdom saving throw. On a failed save, a creature is Charmed for 1 minute.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_charm_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_charm_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"bomb_of_charm_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_charm_modifier","role":"Charm component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Charm","Mind","Psychic","Fey"],"required_tags_all":[],"tag_label":"Charm","note":"Required fourth slot: choose a component tagged Charm, Mind, Psychic, Fey."}],"required_tags_any":["Charm","Mind","Psychic","Fey"],"required_tags_all":[],"tag_label":"Charm","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Charm, Mind, Psychic, Fey.","condition_riders":["Charmed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"Ends when harmed","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Wisdom"},{"id":"alchemy:bomb-of-confusion","name":"Bomb of Confusion","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","effect":"Creatures in a 10-foot-radius cloud make a Wisdom saving throw. On a failed save, a creature is Confused for 1 minute.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_confusion_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_confusion_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"bomb_of_confusion_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_confusion_modifier","role":"Confusion component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Confusion","Mind","Psychic"],"required_tags_all":[],"tag_label":"Confusion","note":"Required fourth slot: choose a component tagged Confusion, Mind, Psychic."}],"required_tags_any":["Confusion","Mind","Psychic"],"required_tags_all":[],"tag_label":"Confusion","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Confusion, Mind, Psychic.","condition_riders":["Confused"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"End of each turn","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Wisdom"},{"id":"alchemy:bomb-of-deafness","name":"Bomb of Deafness","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Uncommon","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Deafened for 1 minute.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_deafness_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_deafness_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"bomb_of_deafness_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_deafness_modifier","role":"Deafness component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Deafness","Sound","Thunder"],"required_tags_all":[],"tag_label":"Deafness","note":"Required fourth slot: choose a component tagged Deafness, Sound, Thunder."}],"required_tags_any":["Deafness","Sound","Thunder"],"required_tags_all":[],"tag_label":"Deafness","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Deafness, Sound, Thunder.","condition_riders":["Deafened"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"id":"alchemy:bomb-of-fear","name":"Bomb of Fear","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","effect":"Creatures in a 10-foot-radius cloud make a Wisdom saving throw. On a failed save, a creature is Frightened for 1 minute.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_fear_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_fear_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"bomb_of_fear_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_fear_modifier","role":"Fear component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Fear","Mind","Psychic"],"required_tags_all":[],"tag_label":"Fear","note":"Required fourth slot: choose a component tagged Fear, Mind, Psychic."}],"required_tags_any":["Fear","Mind","Psychic"],"required_tags_all":[],"tag_label":"Fear","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Fear, Mind, Psychic.","condition_riders":["Frightened"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"End of each turn","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Wisdom"},{"id":"alchemy:bomb-of-paralysis","name":"Bomb of Paralysis","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Paralyzed for 1 minute.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_paralysis_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_paralysis_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"bomb_of_paralysis_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_paralysis_modifier","role":"Paralysis component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Paralysis","Nerve"],"required_tags_all":[],"tag_label":"Paralysis","note":"Required fourth slot: choose a component tagged Paralysis, Nerve."}],"required_tags_any":["Paralysis","Nerve"],"required_tags_all":[],"tag_label":"Paralysis","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Paralysis, Nerve.","condition_riders":["Paralyzed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"id":"alchemy:bomb-of-petrification","name":"Bomb of Petrification","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Very Rare","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Petrified for 1 minute.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_petrification_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_petrification_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"bomb_of_petrification_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_petrification_modifier","role":"Petrification component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Petrification","Stone"],"required_tags_all":[],"tag_label":"Petrification","note":"Required fourth slot: choose a component tagged Petrification, Stone."}],"required_tags_any":["Petrification","Stone"],"required_tags_all":[],"tag_label":"Petrification","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Petrification, Stone.","condition_riders":["Petrified"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"id":"alchemy:bomb-of-poisoning","name":"Bomb of Poisoning","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Uncommon","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Poisoned for 1 minute.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_poisoning_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_poisoning_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"bomb_of_poisoning_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_poisoning_modifier","role":"Poison component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Poison","Venom"],"required_tags_all":[],"tag_label":"Poison","note":"Required fourth slot: choose a component tagged Poison, Venom."}],"required_tags_any":["Poison","Venom"],"required_tags_all":[],"tag_label":"Poison","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Poison, Venom.","condition_riders":["Poisoned"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"id":"alchemy:bomb-of-restraint","name":"Bomb of Restraint","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","effect":"Creatures in a 10-foot-radius cloud make a Dexterity saving throw. On a failed save, a creature is Restrained for 1 minute.","duration":"1 minute","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_restraint_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_restraint_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"bomb_of_restraint_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_restraint_modifier","role":"Restraint component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Restraint","Binding"],"required_tags_all":[],"tag_label":"Restraint","note":"Required fourth slot: choose a component tagged Restraint, Binding."}],"required_tags_any":["Restraint","Binding"],"required_tags_all":[],"tag_label":"Restraint","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Restraint, Binding.","condition_riders":["Restrained"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Dexterity","rider_duration":"1 minute","rider_repeat_save":"Action to escape","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Dexterity"},{"id":"alchemy:bomb-of-stunning","name":"Bomb of Stunning","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","effect":"Creatures in a 10-foot-radius cloud make a Constitution saving throw. On a failed save, a creature is Stunned for Until the end of the target's next turn.","duration":"Until the end of the target's next turn","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_stunning_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_stunning_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"bomb_of_stunning_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_stunning_modifier","role":"Stunning component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Stunning","Nerve","Lightning","Thunder"],"required_tags_all":[],"tag_label":"Stunning","note":"Required fourth slot: choose a component tagged Stunning, Nerve, Lightning, Thunder."}],"required_tags_any":["Stunning","Nerve","Lightning","Thunder"],"required_tags_all":[],"tag_label":"Stunning","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Stunning, Nerve, Lightning, Thunder.","condition_riders":["Stunned"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"Until the end of the target's next turn","rider_repeat_save":"","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"id":"alchemy:bomb-of-acid","name":"Bomb of Acid","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 2d6 acid damage on a failed save or half as much on a success.","duration":"Instant","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_acid_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_acid_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_acid_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"bomb_of_acid_modifier","role":"Acid component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","note":"Required fourth slot: choose a component tagged Acid."}],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Acid tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":2,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"id":"alchemy:bomb-of-cold","name":"Bomb of Cold","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 2d6 cold damage on a failed save or half as much on a success.","duration":"Instant","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_cold_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_cold_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_cold_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"bomb_of_cold_modifier","role":"Cold component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","note":"Required fourth slot: choose a component tagged Cold."}],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Cold tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":2,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"id":"alchemy:bomb-of-fire","name":"Bomb of Fire","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 2d6 fire damage on a failed save or half as much on a success.","duration":"Instant","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_fire_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_fire_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_fire_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"bomb_of_fire_modifier","role":"Fire component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","note":"Required fourth slot: choose a component tagged Fire."}],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Fire tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":2,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"id":"alchemy:bomb-of-force","name":"Bomb of Force","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Rare","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 3d6 force damage on a failed save or half as much on a success.","duration":"Instant","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_force_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_force_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_force_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"bomb_of_force_modifier","role":"Force component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","note":"Required fourth slot: choose a component tagged Force."}],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Force tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"id":"alchemy:bomb-of-lightning","name":"Bomb of Lightning","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 2d6 lightning damage on a failed save or half as much on a success.","duration":"Instant","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_lightning_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_lightning_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_lightning_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"bomb_of_lightning_modifier","role":"Lightning component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","note":"Required fourth slot: choose a component tagged Lightning."}],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Lightning tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":2,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"id":"alchemy:bomb-of-necrotic","name":"Bomb of Necrotic","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Rare","effect":"Creatures in a 10-foot-radius burst make a Constitution saving throw, taking 3d6 necrotic damage on a failed save or half as much on a success.","duration":"Instant","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_necrotic_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_necrotic_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_necrotic_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"bomb_of_necrotic_modifier","role":"Necrotic component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","note":"Required fourth slot: choose a component tagged Necrotic."}],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Necrotic tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_area_feet":10,"area_shape":"radius burst","save_ability":"Constitution"},{"id":"alchemy:bomb-of-poison","name":"Bomb of Poison","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","effect":"Creatures in a 10-foot-radius burst make a Constitution saving throw, taking 2d6 poison damage on a failed save or half as much on a success.","duration":"Instant","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_poison_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_poison_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_poison_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"bomb_of_poison_modifier","role":"Poison component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","note":"Required fourth slot: choose a component tagged Poison."}],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Poison tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":2,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_area_feet":10,"area_shape":"radius burst","save_ability":"Constitution"},{"id":"alchemy:bomb-of-psychic","name":"Bomb of Psychic","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Rare","effect":"Creatures in a 10-foot-radius burst make a Wisdom saving throw, taking 3d6 psychic damage on a failed save or half as much on a success.","duration":"Instant","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_psychic_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_psychic_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_psychic_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"bomb_of_psychic_modifier","role":"Psychic component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","note":"Required fourth slot: choose a component tagged Psychic."}],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Psychic tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_area_feet":10,"area_shape":"radius burst","save_ability":"Wisdom"},{"id":"alchemy:bomb-of-radiant","name":"Bomb of Radiant","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Rare","effect":"Creatures in a 10-foot-radius burst make a Dexterity saving throw, taking 3d6 radiant damage on a failed save or half as much on a success.","duration":"Instant","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_radiant_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_radiant_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_radiant_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"bomb_of_radiant_modifier","role":"Radiant component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","note":"Required fourth slot: choose a component tagged Radiant."}],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Radiant tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":3,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"id":"alchemy:bomb-of-thunder","name":"Bomb of Thunder","item_type":"Bomb","alchemy_section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","effect":"Creatures in a 10-foot-radius burst make a Constitution saving throw, taking 2d6 thunder damage on a failed save or half as much on a success.","duration":"Instant","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"bomb_of_thunder_core_1","role":"Core ingredient 1","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"bomb_of_thunder_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"bomb_of_thunder_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"bomb_of_thunder_modifier","role":"Thunder component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","note":"Required fourth slot: choose a component tagged Thunder."}],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Thunder tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":2,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage","base_area_feet":10,"area_shape":"radius burst","save_ability":"Constitution"},{"id":"alchemy:elixir-of-charisma","name":"Elixir of Charisma","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","effect":"Charisma increases by 1d4 for the duration.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_charisma_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_charisma_core_2","role":"Core ingredient 2","family":"sap_resin","min_rarity":"Common","required":true},{"key":"elixir_of_charisma_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_charisma_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-charisma","theme_source":"Named formula variant sets the ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-constitution","name":"Elixir of Constitution","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","effect":"Constitution increases by 1d4 for the duration.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_constitution_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_constitution_core_2","role":"Core ingredient 2","family":"mushroom","min_rarity":"Common","required":true},{"key":"elixir_of_constitution_core_3","role":"Core ingredient 3","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_constitution_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-constitution","theme_source":"Named formula variant sets the ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-dexterity","name":"Elixir of Dexterity","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","effect":"Dexterity increases by 1d4 for the duration.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_dexterity_core_1","role":"Core ingredient 1","family":"leaf_vine","min_rarity":"Common","required":true},{"key":"elixir_of_dexterity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_dexterity_core_3","role":"Core ingredient 3","family":"sap_resin","min_rarity":"Common","required":true},{"key":"elixir_of_dexterity_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-dexterity","theme_source":"Named formula variant sets the ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-intelligence","name":"Elixir of Intelligence","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","effect":"Intelligence increases by 1d4 for the duration.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_intelligence_core_1","role":"Core ingredient 1","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_intelligence_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_intelligence_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_intelligence_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-intelligence","theme_source":"Named formula variant sets the ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-strength","name":"Elixir of Strength","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","effect":"Strength increases by 1d4 for the duration.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_strength_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_strength_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"elixir_of_strength_core_3","role":"Core ingredient 3","family":"mushroom","min_rarity":"Common","required":true},{"key":"elixir_of_strength_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-strength","theme_source":"Named formula variant sets the ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-wisdom","name":"Elixir of Wisdom","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","effect":"Wisdom increases by 1d4 for the duration.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_wisdom_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_wisdom_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_wisdom_core_3","role":"Core ingredient 3","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_wisdom_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-wisdom","theme_source":"Named formula variant sets the ability.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-blindness-immunity","name":"Elixir of Blindness Immunity","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Uncommon","effect":"Immediately ends the Blinded condition if present and grants immunity to Blinded for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_blindness_immunity_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_blindness_immunity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_blindness_immunity_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_blindness_immunity_modifier","role":"Blindness component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Blindness","Sight"],"required_tags_all":[],"tag_label":"Blindness","note":"Required fourth slot: choose a component tagged Blindness, Sight."}],"required_tags_any":["Blindness","Sight"],"required_tags_all":[],"tag_label":"Blindness","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Blindness, Sight.","condition_riders":[],"cures_conditions":["Blinded"],"grants_immunities":["Blinded"],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-charm-immunity","name":"Elixir of Charm Immunity","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","effect":"Immediately ends the Charmed condition if present and grants immunity to Charmed for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_charm_immunity_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_charm_immunity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_charm_immunity_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_charm_immunity_modifier","role":"Charm component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Charm","Mind","Psychic","Fey"],"required_tags_all":[],"tag_label":"Charm","note":"Required fourth slot: choose a component tagged Charm, Mind, Psychic, Fey."}],"required_tags_any":["Charm","Mind","Psychic","Fey"],"required_tags_all":[],"tag_label":"Charm","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Charm, Mind, Psychic, Fey.","condition_riders":[],"cures_conditions":["Charmed"],"grants_immunities":["Charmed"],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-confusion-immunity","name":"Elixir of Confusion Immunity","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","effect":"Immediately ends the Confused condition if present and grants immunity to Confused for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_confusion_immunity_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_confusion_immunity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_confusion_immunity_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_confusion_immunity_modifier","role":"Confusion component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Confusion","Mind","Psychic"],"required_tags_all":[],"tag_label":"Confusion","note":"Required fourth slot: choose a component tagged Confusion, Mind, Psychic."}],"required_tags_any":["Confusion","Mind","Psychic"],"required_tags_all":[],"tag_label":"Confusion","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Confusion, Mind, Psychic.","condition_riders":[],"cures_conditions":["Confused"],"grants_immunities":["Confused"],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-deafness-immunity","name":"Elixir of Deafness Immunity","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Uncommon","effect":"Immediately ends the Deafened condition if present and grants immunity to Deafened for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_deafness_immunity_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_deafness_immunity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_deafness_immunity_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_deafness_immunity_modifier","role":"Deafness component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Deafness","Sound","Thunder"],"required_tags_all":[],"tag_label":"Deafness","note":"Required fourth slot: choose a component tagged Deafness, Sound, Thunder."}],"required_tags_any":["Deafness","Sound","Thunder"],"required_tags_all":[],"tag_label":"Deafness","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Deafness, Sound, Thunder.","condition_riders":[],"cures_conditions":["Deafened"],"grants_immunities":["Deafened"],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-fear-immunity","name":"Elixir of Fear Immunity","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","effect":"Immediately ends the Frightened condition if present and grants immunity to Frightened for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_fear_immunity_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_fear_immunity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_fear_immunity_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_fear_immunity_modifier","role":"Fear component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Fear","Mind","Psychic"],"required_tags_all":[],"tag_label":"Fear","note":"Required fourth slot: choose a component tagged Fear, Mind, Psychic."}],"required_tags_any":["Fear","Mind","Psychic"],"required_tags_all":[],"tag_label":"Fear","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Fear, Mind, Psychic.","condition_riders":[],"cures_conditions":["Frightened"],"grants_immunities":["Frightened"],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-paralysis-immunity","name":"Elixir of Paralysis Immunity","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","effect":"Immediately ends the Paralyzed condition if present and grants immunity to Paralyzed for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_paralysis_immunity_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_paralysis_immunity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_paralysis_immunity_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_paralysis_immunity_modifier","role":"Paralysis component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Paralysis","Nerve"],"required_tags_all":[],"tag_label":"Paralysis","note":"Required fourth slot: choose a component tagged Paralysis, Nerve."}],"required_tags_any":["Paralysis","Nerve"],"required_tags_all":[],"tag_label":"Paralysis","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Paralysis, Nerve.","condition_riders":[],"cures_conditions":["Paralyzed"],"grants_immunities":["Paralyzed"],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-petrification-immunity","name":"Elixir of Petrification Immunity","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Very Rare","effect":"Immediately ends the Petrified condition if present and grants immunity to Petrified for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_petrification_immunity_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_petrification_immunity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_petrification_immunity_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_petrification_immunity_modifier","role":"Petrification component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Petrification","Stone"],"required_tags_all":[],"tag_label":"Petrification","note":"Required fourth slot: choose a component tagged Petrification, Stone."}],"required_tags_any":["Petrification","Stone"],"required_tags_all":[],"tag_label":"Petrification","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Petrification, Stone.","condition_riders":[],"cures_conditions":["Petrified"],"grants_immunities":["Petrified"],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-poison-immunity","name":"Elixir of Poison Immunity","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Uncommon","effect":"Immediately ends the Poisoned condition if present and grants immunity to Poisoned for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_poison_immunity_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_poison_immunity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_poison_immunity_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_poison_immunity_modifier","role":"Poison component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Poison","Venom"],"required_tags_all":[],"tag_label":"Poison","note":"Required fourth slot: choose a component tagged Poison, Venom."}],"required_tags_any":["Poison","Venom"],"required_tags_all":[],"tag_label":"Poison","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Poison, Venom.","condition_riders":[],"cures_conditions":["Poisoned"],"grants_immunities":["Poisoned"],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-restraint-immunity","name":"Elixir of Restraint Immunity","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","effect":"Immediately ends the Restrained condition if present and grants immunity to Restrained for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_restraint_immunity_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_restraint_immunity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_restraint_immunity_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_restraint_immunity_modifier","role":"Restraint component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Restraint","Binding"],"required_tags_all":[],"tag_label":"Restraint","note":"Required fourth slot: choose a component tagged Restraint, Binding."}],"required_tags_any":["Restraint","Binding"],"required_tags_all":[],"tag_label":"Restraint","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Restraint, Binding.","condition_riders":[],"cures_conditions":["Restrained"],"grants_immunities":["Restrained"],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-stunning-immunity","name":"Elixir of Stunning Immunity","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","effect":"Immediately ends the Stunned condition if present and grants immunity to Stunned for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_stunning_immunity_core_1","role":"Core ingredient 1","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_stunning_immunity_core_2","role":"Core ingredient 2","family":"flower","min_rarity":"Common","required":true},{"key":"elixir_of_stunning_immunity_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_stunning_immunity_modifier","role":"Stunning component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Stunning","Nerve","Lightning","Thunder"],"required_tags_all":[],"tag_label":"Stunning","note":"Required fourth slot: choose a component tagged Stunning, Nerve, Lightning, Thunder."}],"required_tags_any":["Stunning","Nerve","Lightning","Thunder"],"required_tags_all":[],"tag_label":"Stunning","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Stunning, Nerve, Lightning, Thunder.","condition_riders":[],"cures_conditions":["Stunned"],"grants_immunities":["Stunned"],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-acid-resistance","name":"Elixir of Acid Resistance","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","effect":"The drinker gains resistance to acid damage for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_acid_resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_acid_resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_acid_resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_acid_resistance_modifier","role":"Acid component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","note":"Required fourth slot: choose a component tagged Acid."}],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Acid tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-cold-resistance","name":"Elixir of Cold Resistance","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","effect":"The drinker gains resistance to cold damage for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_cold_resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_cold_resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_cold_resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_cold_resistance_modifier","role":"Cold component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","note":"Required fourth slot: choose a component tagged Cold."}],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Cold tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-fire-resistance","name":"Elixir of Fire Resistance","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","effect":"The drinker gains resistance to fire damage for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_fire_resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_fire_resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_fire_resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_fire_resistance_modifier","role":"Fire component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","note":"Required fourth slot: choose a component tagged Fire."}],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Fire tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-force-resistance","name":"Elixir of Force Resistance","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","effect":"The drinker gains resistance to force damage for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_force_resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_force_resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_force_resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_force_resistance_modifier","role":"Force component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","note":"Required fourth slot: choose a component tagged Force."}],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Force tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-lightning-resistance","name":"Elixir of Lightning Resistance","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","effect":"The drinker gains resistance to lightning damage for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_lightning_resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_lightning_resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_lightning_resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_lightning_resistance_modifier","role":"Lightning component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","note":"Required fourth slot: choose a component tagged Lightning."}],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Lightning tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-necrotic-resistance","name":"Elixir of Necrotic Resistance","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","effect":"The drinker gains resistance to necrotic damage for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_necrotic_resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_necrotic_resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_necrotic_resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_necrotic_resistance_modifier","role":"Necrotic component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","note":"Required fourth slot: choose a component tagged Necrotic."}],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Necrotic tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-poison-resistance","name":"Elixir of Poison Resistance","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","effect":"The drinker gains resistance to poison damage for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_poison_resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_poison_resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_poison_resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_poison_resistance_modifier","role":"Poison component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","note":"Required fourth slot: choose a component tagged Poison."}],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Poison tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-psychic-resistance","name":"Elixir of Psychic Resistance","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","effect":"The drinker gains resistance to psychic damage for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_psychic_resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_psychic_resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_psychic_resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_psychic_resistance_modifier","role":"Psychic component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","note":"Required fourth slot: choose a component tagged Psychic."}],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Psychic tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-radiant-resistance","name":"Elixir of Radiant Resistance","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","effect":"The drinker gains resistance to radiant damage for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_radiant_resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_radiant_resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_radiant_resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_radiant_resistance_modifier","role":"Radiant component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","note":"Required fourth slot: choose a component tagged Radiant."}],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Radiant tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:elixir-of-thunder-resistance","name":"Elixir of Thunder Resistance","item_type":"Elixir","alchemy_section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","effect":"The drinker gains resistance to thunder damage for 1 hour.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"elixir_of_thunder_resistance_core_1","role":"Core ingredient 1","family":"moss_lichen","min_rarity":"Common","required":true},{"key":"elixir_of_thunder_resistance_core_2","role":"Core ingredient 2","family":"root","min_rarity":"Common","required":true},{"key":"elixir_of_thunder_resistance_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"elixir_of_thunder_resistance_modifier","role":"Thunder component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","note":"Required fourth slot: choose a component tagged Thunder."}],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Thunder tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:oil-of-blindness","name":"Oil of Blindness","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Condition Oils","rarity":"Uncommon","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Blinded for 1 minute.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_blindness_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_blindness_core_2","role":"Core ingredient 2","family":"venom_poison","min_rarity":"Common","required":true},{"key":"oil_of_blindness_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_blindness_modifier","role":"Blindness component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Blindness","Sight"],"required_tags_all":[],"tag_label":"Blindness","note":"Required fourth slot: choose a component tagged Blindness, Sight."}],"required_tags_any":["Blindness","Sight"],"required_tags_all":[],"tag_label":"Blindness","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Blindness, Sight.","condition_riders":["Blinded"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn"},{"id":"alchemy:oil-of-charm","name":"Oil of Charm","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Wisdom saving throw; on a failed save, the target is Charmed for 1 minute.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_charm_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_charm_core_2","role":"Core ingredient 2","family":"venom_poison","min_rarity":"Common","required":true},{"key":"oil_of_charm_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_charm_modifier","role":"Charm component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Charm","Mind","Psychic","Fey"],"required_tags_all":[],"tag_label":"Charm","note":"Required fourth slot: choose a component tagged Charm, Mind, Psychic, Fey."}],"required_tags_any":["Charm","Mind","Psychic","Fey"],"required_tags_all":[],"tag_label":"Charm","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Charm, Mind, Psychic, Fey.","condition_riders":["Charmed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"Ends when harmed"},{"id":"alchemy:oil-of-confusion","name":"Oil of Confusion","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Wisdom saving throw; on a failed save, the target is Confused for 1 minute.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_confusion_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_confusion_core_2","role":"Core ingredient 2","family":"venom_poison","min_rarity":"Common","required":true},{"key":"oil_of_confusion_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_confusion_modifier","role":"Confusion component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Confusion","Mind","Psychic"],"required_tags_all":[],"tag_label":"Confusion","note":"Required fourth slot: choose a component tagged Confusion, Mind, Psychic."}],"required_tags_any":["Confusion","Mind","Psychic"],"required_tags_all":[],"tag_label":"Confusion","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Confusion, Mind, Psychic.","condition_riders":["Confused"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"End of each turn"},{"id":"alchemy:oil-of-deafness","name":"Oil of Deafness","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Condition Oils","rarity":"Uncommon","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Deafened for 1 minute.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_deafness_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_deafness_core_2","role":"Core ingredient 2","family":"venom_poison","min_rarity":"Common","required":true},{"key":"oil_of_deafness_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_deafness_modifier","role":"Deafness component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Deafness","Sound","Thunder"],"required_tags_all":[],"tag_label":"Deafness","note":"Required fourth slot: choose a component tagged Deafness, Sound, Thunder."}],"required_tags_any":["Deafness","Sound","Thunder"],"required_tags_all":[],"tag_label":"Deafness","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Deafness, Sound, Thunder.","condition_riders":["Deafened"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn"},{"id":"alchemy:oil-of-fear","name":"Oil of Fear","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Wisdom saving throw; on a failed save, the target is Frightened for 1 minute.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_fear_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_fear_core_2","role":"Core ingredient 2","family":"venom_poison","min_rarity":"Common","required":true},{"key":"oil_of_fear_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_fear_modifier","role":"Fear component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Fear","Mind","Psychic"],"required_tags_all":[],"tag_label":"Fear","note":"Required fourth slot: choose a component tagged Fear, Mind, Psychic."}],"required_tags_any":["Fear","Mind","Psychic"],"required_tags_all":[],"tag_label":"Fear","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Fear, Mind, Psychic.","condition_riders":["Frightened"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"End of each turn"},{"id":"alchemy:oil-of-paralysis","name":"Oil of Paralysis","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Paralyzed for 1 minute.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_paralysis_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_paralysis_core_2","role":"Core ingredient 2","family":"venom_poison","min_rarity":"Common","required":true},{"key":"oil_of_paralysis_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_paralysis_modifier","role":"Paralysis component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Paralysis","Nerve"],"required_tags_all":[],"tag_label":"Paralysis","note":"Required fourth slot: choose a component tagged Paralysis, Nerve."}],"required_tags_any":["Paralysis","Nerve"],"required_tags_all":[],"tag_label":"Paralysis","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Paralysis, Nerve.","condition_riders":["Paralyzed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn"},{"id":"alchemy:oil-of-petrification","name":"Oil of Petrification","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Condition Oils","rarity":"Very Rare","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Petrified for 1 minute.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_petrification_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_petrification_core_2","role":"Core ingredient 2","family":"venom_poison","min_rarity":"Common","required":true},{"key":"oil_of_petrification_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_petrification_modifier","role":"Petrification component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Petrification","Stone"],"required_tags_all":[],"tag_label":"Petrification","note":"Required fourth slot: choose a component tagged Petrification, Stone."}],"required_tags_any":["Petrification","Stone"],"required_tags_all":[],"tag_label":"Petrification","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Petrification, Stone.","condition_riders":["Petrified"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn"},{"id":"alchemy:oil-of-poisoning","name":"Oil of Poisoning","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Condition Oils","rarity":"Uncommon","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Poisoned for 1 minute.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_poisoning_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_poisoning_core_2","role":"Core ingredient 2","family":"venom_poison","min_rarity":"Common","required":true},{"key":"oil_of_poisoning_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_poisoning_modifier","role":"Poison component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Poison","Venom"],"required_tags_all":[],"tag_label":"Poison","note":"Required fourth slot: choose a component tagged Poison, Venom."}],"required_tags_any":["Poison","Venom"],"required_tags_all":[],"tag_label":"Poison","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Poison, Venom.","condition_riders":["Poisoned"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn"},{"id":"alchemy:oil-of-restraint","name":"Oil of Restraint","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Dexterity saving throw; on a failed save, the target is Restrained for 1 minute.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_restraint_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_restraint_core_2","role":"Core ingredient 2","family":"venom_poison","min_rarity":"Common","required":true},{"key":"oil_of_restraint_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_restraint_modifier","role":"Restraint component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Restraint","Binding"],"required_tags_all":[],"tag_label":"Restraint","note":"Required fourth slot: choose a component tagged Restraint, Binding."}],"required_tags_any":["Restraint","Binding"],"required_tags_all":[],"tag_label":"Restraint","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Restraint, Binding.","condition_riders":["Restrained"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Dexterity","rider_duration":"1 minute","rider_repeat_save":"Action to escape"},{"id":"alchemy:oil-of-stunning","name":"Oil of Stunning","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","effect":"Coat one weapon or up to 20 pieces of ammunition. The next successful hit within 1 hour forces a Constitution saving throw; on a failed save, the target is Stunned for Until the end of the target's next turn.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_stunning_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_stunning_core_2","role":"Core ingredient 2","family":"venom_poison","min_rarity":"Common","required":true},{"key":"oil_of_stunning_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_stunning_modifier","role":"Stunning component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Stunning","Nerve","Lightning","Thunder"],"required_tags_all":[],"tag_label":"Stunning","note":"Required fourth slot: choose a component tagged Stunning, Nerve, Lightning, Thunder."}],"required_tags_any":["Stunning","Nerve","Lightning","Thunder"],"required_tags_all":[],"tag_label":"Stunning","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Stunning, Nerve, Lightning, Thunder.","condition_riders":["Stunned"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"Until the end of the target's next turn","rider_repeat_save":""},{"id":"alchemy:oil-of-acid","name":"Oil of Acid","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 acid damage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_acid_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_acid_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_acid_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"oil_of_acid_modifier","role":"Acid component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","note":"Required fourth slot: choose a component tagged Acid."}],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Acid tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":4,"base_flat_bonus":0,"dice_purpose":"damage"},{"id":"alchemy:oil-of-cold","name":"Oil of Cold","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 cold damage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_cold_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_cold_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_cold_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"oil_of_cold_modifier","role":"Cold component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","note":"Required fourth slot: choose a component tagged Cold."}],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Cold tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":4,"base_flat_bonus":0,"dice_purpose":"damage"},{"id":"alchemy:oil-of-fire","name":"Oil of Fire","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 fire damage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_fire_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_fire_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_fire_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"oil_of_fire_modifier","role":"Fire component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","note":"Required fourth slot: choose a component tagged Fire."}],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Fire tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":4,"base_flat_bonus":0,"dice_purpose":"damage"},{"id":"alchemy:oil-of-force","name":"Oil of Force","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Elemental Oils","rarity":"Rare","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d6 force damage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_force_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_force_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_force_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"oil_of_force_modifier","role":"Force component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","note":"Required fourth slot: choose a component tagged Force."}],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Force tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage"},{"id":"alchemy:oil-of-lightning","name":"Oil of Lightning","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 lightning damage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_lightning_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_lightning_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_lightning_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"oil_of_lightning_modifier","role":"Lightning component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","note":"Required fourth slot: choose a component tagged Lightning."}],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Lightning tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":4,"base_flat_bonus":0,"dice_purpose":"damage"},{"id":"alchemy:oil-of-necrotic","name":"Oil of Necrotic","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Elemental Oils","rarity":"Rare","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d6 necrotic damage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_necrotic_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_necrotic_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_necrotic_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"oil_of_necrotic_modifier","role":"Necrotic component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","note":"Required fourth slot: choose a component tagged Necrotic."}],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Necrotic tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage"},{"id":"alchemy:oil-of-poison","name":"Oil of Poison","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 poison damage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_poison_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_poison_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_poison_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"oil_of_poison_modifier","role":"Poison component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","note":"Required fourth slot: choose a component tagged Poison."}],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Poison tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":4,"base_flat_bonus":0,"dice_purpose":"damage"},{"id":"alchemy:oil-of-psychic","name":"Oil of Psychic","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Elemental Oils","rarity":"Rare","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d6 psychic damage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_psychic_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_psychic_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_psychic_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"oil_of_psychic_modifier","role":"Psychic component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","note":"Required fourth slot: choose a component tagged Psychic."}],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Psychic tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage"},{"id":"alchemy:oil-of-radiant","name":"Oil of Radiant","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Elemental Oils","rarity":"Rare","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d6 radiant damage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_radiant_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_radiant_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_radiant_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"oil_of_radiant_modifier","role":"Radiant component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","note":"Required fourth slot: choose a component tagged Radiant."}],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Radiant tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":6,"base_flat_bonus":0,"dice_purpose":"damage"},{"id":"alchemy:oil-of-thunder","name":"Oil of Thunder","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","effect":"Coat one weapon or up to 20 pieces of ammunition. For 1 hour, a hit deals an extra 1d4 thunder damage.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_thunder_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_thunder_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_thunder_core_3","role":"Core ingredient 3","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"oil_of_thunder_modifier","role":"Thunder component","family":"any","slot_type":"modifier","required":true,"allowed_families":[],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","note":"Required fourth slot: choose a component tagged Thunder."}],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Thunder tag.","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","base_dice_count":1,"base_die_size":4,"base_flat_bonus":0,"dice_purpose":"damage"},{"id":"alchemy:oil-of-etherealness","name":"Oil of Etherealness","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Utility Oils","rarity":"Very Rare","effect":"One vial can cover one Medium or smaller creature and grants the effect of Etherealness.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_etherealness_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_etherealness_core_2","role":"Core ingredient 2","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_etherealness_core_3","role":"Core ingredient 3","family":"flower","min_rarity":"Common","required":true},{"key":"oil_of_etherealness_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":true,"allowed_families":["essence","monster_fluid","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Required fourth slot: phase residue, ethereal essence, or another planar component."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"oil-of-etherealness","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""},{"id":"alchemy:oil-of-sharpness","name":"Oil of Sharpness","item_type":"Oil","alchemy_section":"Oils","alchemy_group":"Utility Oils","rarity":"Very Rare","effect":"A coated slashing or piercing weapon or ammunition gains a temporary bonus to attack and damage rolls by DM ruling.","duration":"1 hour","use":"Bonus Action to use or apply","output_quantity":1,"ingredient_slots":[{"key":"oil_of_sharpness_core_1","role":"Core ingredient 1","family":"sap_resin","min_rarity":"Common","required":true},{"key":"oil_of_sharpness_core_2","role":"Core ingredient 2","family":"thorn_bark_wood","min_rarity":"Common","required":true},{"key":"oil_of_sharpness_core_3","role":"Core ingredient 3","family":"mineral_salt_ash","min_rarity":"Common","required":true},{"key":"oil_of_sharpness_modifier","role":"Fourth-slot component","family":"any","slot_type":"modifier","required":false,"allowed_families":["enhancer","monster_fluid","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","note":"Optional fourth slot: concentrating enhancer or monster-derived cutting agent."}],"required_tags_any":[],"required_tags_all":[],"tag_label":"","formula_family":"","template_key":"oil-of-sharpness","theme_source":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":""}];

function abilityElixirSlots(ability = "Strength") {
  const formulas = {
    Strength: ["root", "thorn_bark_wood", "mushroom"],
    Dexterity: ["leaf_vine", "flower", "sap_resin"],
    Constitution: ["root", "mushroom", "moss_lichen"],
    Intelligence: ["flower", "mineral_salt_ash", "root"],
    Wisdom: ["moss_lichen", "flower", "root"],
    Charisma: ["flower", "sap_resin", "mineral_salt_ash"],
  };
  const families = formulas[ability] || formulas.Strength;
  return [
    { key: `${ability.toLowerCase()}_buff_core_a`, role: `${ability} base`, family: families[0], min_rarity: "Uncommon", required: true },
    { key: `${ability.toLowerCase()}_buff_core_b`, role: `${ability} amplifier`, family: families[1], min_rarity: "Uncommon", required: true },
    { key: `${ability.toLowerCase()}_buff_core_c`, role: `${ability} binder`, family: families[2], min_rarity: "Uncommon", required: true },
    { key: `${ability.toLowerCase()}_buff_modifier`, role: "Ability twist", family: "any", slot_type: "modifier", required: false, allowed_families: ["enhancer", "holy_vital", "essence", "monster_fluid"], note: "Optional fourth slot. Enhancers may improve dice, duration, or reduce Craft DC." },
  ];
}

function abilityPoisonSlots(ability = "Strength") {
  const formulas = {
    Strength: ["venom_poison", "root", "thorn_bark_wood"],
    Dexterity: ["venom_poison", "leaf_vine", "flower"],
    Constitution: ["venom_poison", "mushroom", "root"],
    Intelligence: ["venom_poison", "flower", "mineral_salt_ash"],
    Wisdom: ["venom_poison", "moss_lichen", "flower"],
    Charisma: ["venom_poison", "flower", "sap_resin"],
  };
  const families = formulas[ability] || formulas.Strength;
  return [
    { key: `${ability.toLowerCase()}_poison_core_a`, role: `${ability} toxin`, family: families[0], min_rarity: "Rare", required: true },
    { key: `${ability.toLowerCase()}_poison_core_b`, role: `${ability} weakness vector`, family: families[1], min_rarity: "Rare", required: true },
    { key: `${ability.toLowerCase()}_poison_core_c`, role: `${ability} binder`, family: families[2], min_rarity: "Rare", required: true },
    { key: `${ability.toLowerCase()}_poison_modifier`, role: "Poison twist", family: "any", slot_type: "modifier", required: false, allowed_families: ["monster_fluid", "essence", "enhancer"], note: "Optional fourth slot. Venoms, bile, or monster fluids can add riders or improve dice." },
  ];
}

function canonicalAlchemyRecipeName(name = "") {
  const clean = String(name || "").replace(/^Craft\s+/i, "").trim();
  const aliases = {
    "Healing Draught": "Healing Potion",
    "Potion of Healing": "Healing Potion",
    "Ironroot Salve": "Potion of Anchoring",
    "Night-Eye Drops": "Potion of Night Vision",
    "Potion of Climbing": "Potion of Physical Prowess",
    "Quickstep Tonic": "Potion of Quickstep",
    "Potion of Water Breathing": "Potion of Breath",
    "Potion of Giant Size": "Potion of Storm Giant Transformation",
    "Potion of Storm Giant Strength": "Potion of Storm Giant Transformation",
  };
  if (/^Potion of (Superior|Greater|Supreme)?\s*Healing$/i.test(clean)) return "Healing Potion";
  return aliases[clean] || clean;
}
const DEPRECATED_ALCHEMY_RECIPE_NAMES = new Set(["Potion of Resistance","Potion of X Resistance","Elixir of X Immunity","Arcshock Bomb","Binding Resin Bomb","Blinding Dust Bomb","Noxious Spore Bomb","Terror Spore Bomb","Healing Draught","Potion of Healing","Ironroot Salve","Night-Eye Drops","Potion of Climbing","Quickstep Tonic","Potion of Water Breathing","Potion of Giant Size","Potion of Storm Giant Strength"]);
function isDeprecatedAlchemyRecipe(recipe = {}) {
  if (String(recipe.discipline || "").toLowerCase() !== "alchemy") return false;
  const name = String(recipe.name || "").replace(/^Craft\s+/i, "").trim();
  if (DEPRECATED_ALCHEMY_RECIPE_NAMES.has(name)) return true;
  return /^Potion of (Acid|Cold|Fire|Force|Lightning|Necrotic|Poison|Psychic|Radiant|Thunder) Resistance$/i.test(name);
}
const ALCHEMY_BREW_FORMULA_GUIDE = {"Potion of Acid Breath":{"section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Acid.","modifier_required":true,"allowed_families":[],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Acid tag."},"Potion of Cold Breath":{"section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Cold.","modifier_required":true,"allowed_families":[],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Cold tag."},"Potion of Fire Breath":{"section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Fire.","modifier_required":true,"allowed_families":[],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Fire tag."},"Potion of Force Breath":{"section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Force.","modifier_required":true,"allowed_families":[],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Force tag."},"Potion of Lightning Breath":{"section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Lightning.","modifier_required":true,"allowed_families":[],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Lightning tag."},"Potion of Necrotic Breath":{"section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Necrotic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Necrotic tag."},"Potion of Poison Breath":{"section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Poison.","modifier_required":true,"allowed_families":[],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Poison tag."},"Potion of Psychic Breath":{"section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Psychic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Psychic tag."},"Potion of Radiant Breath":{"section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Radiant.","modifier_required":true,"allowed_families":[],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Radiant tag."},"Potion of Thunder Breath":{"section":"Potions","alchemy_group":"Elemental Breath Potions","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Thunder.","modifier_required":true,"allowed_families":[],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Breath Potion","template_key":"potion_elemental_breath","theme_source":"Fourth-slot Thunder tag."},"Antitoxin":{"section":"Potions","alchemy_group":"General Potions","rarity":"Common","cores":["root","mineral_salt_ash","flower"],"modifier":"Optional fourth slot: purifying enhancer, holy component, or antivenom monster part.","modifier_required":false,"allowed_families":["enhancer","holy_vital","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"antitoxin","theme_source":""},"Healing Potion":{"section":"Potions","alchemy_group":"General Potions","rarity":"Common","cores":["mushroom","mushroom","root"],"modifier":"Optional fourth slot: holy/vital component, distillation agent, or restorative monster component.","modifier_required":false,"allowed_families":["holy_vital","enhancer","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"healing-potion","theme_source":""},"Philter of Love":{"section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","cores":["flower","flower","sap_resin"],"modifier":"Optional fourth slot: fey, psychic, or glamour essence.","modifier_required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"philter-of-love","theme_source":""},"Potion of Anchoring":{"section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","cores":["thorn_bark_wood","root","sap_resin"],"modifier":"Optional fourth slot: defensive enhancer, earth essence, or reinforcing monster component.","modifier_required":false,"allowed_families":["enhancer","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-anchoring","theme_source":""},"Potion of Animal Friendship":{"section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","cores":["flower","leaf_vine","root"],"modifier":"Optional fourth slot: fey essence or beast-derived component.","modifier_required":false,"allowed_families":["essence","monster_fluid","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-animal-friendship","theme_source":""},"Potion of Breath":{"section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","cores":["flower","sap_resin","mineral_salt_ash"],"modifier":"Optional fourth slot: aquatic essence, gill, mucus, or water-aligned monster component.","modifier_required":false,"allowed_families":["essence","monster_fluid","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-breath","theme_source":""},"Potion of Clairvoyance":{"section":"Potions","alchemy_group":"General Potions","rarity":"Rare","cores":["flower","mineral_salt_ash","moss_lichen"],"modifier":"Optional fourth slot: psychic, crystal, or remote-sensing essence.","modifier_required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-clairvoyance","theme_source":""},"Potion of Comprehension":{"section":"Potions","alchemy_group":"General Potions","rarity":"Common","cores":["flower","mineral_salt_ash","root"],"modifier":"Optional fourth slot: psychic, linguistic, or scribe-aligned essence.","modifier_required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-comprehension","theme_source":""},"Potion of Diminution":{"section":"Potions","alchemy_group":"General Potions","rarity":"Rare","cores":["mushroom","root","flower"],"modifier":"Optional fourth slot: transmutation enhancer or size-altering essence.","modifier_required":false,"allowed_families":["enhancer","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-diminution","theme_source":""},"Potion of Dragon's Majesty":{"section":"Potions","alchemy_group":"General Potions","rarity":"Legendary","cores":["mushroom","thorn_bark_wood","mineral_salt_ash"],"modifier":"Required fourth slot: dragon gland, blood, scale essence, or another draconic component.","modifier_required":true,"allowed_families":["monster_fluid","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-dragon-s-majesty","theme_source":""},"Potion of Flying":{"section":"Potions","alchemy_group":"General Potions","rarity":"Very Rare","cores":["leaf_vine","flower","sap_resin"],"modifier":"Optional fourth slot: air essence, wing membrane, or flight enhancer.","modifier_required":false,"allowed_families":["essence","monster_fluid","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-flying","theme_source":""},"Potion of Gaseous Form":{"section":"Potions","alchemy_group":"General Potions","rarity":"Rare","cores":["leaf_vine","flower","mineral_salt_ash"],"modifier":"Optional fourth slot: air, mist, or phase essence.","modifier_required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-gaseous-form","theme_source":""},"Potion of Growth":{"section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","cores":["root","thorn_bark_wood","mushroom"],"modifier":"Optional fourth slot: giant blood or transmutation enhancer.","modifier_required":false,"allowed_families":["monster_fluid","enhancer","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-growth","theme_source":""},"Potion of Heroism":{"section":"Potions","alchemy_group":"General Potions","rarity":"Rare","cores":["root","flower","thorn_bark_wood"],"modifier":"Required fourth slot: choose a Holy Component tagged Radiant or Holy.","modifier_required":true,"allowed_families":["holy_vital"],"required_tags_any":["Radiant","Holy"],"required_tags_all":[],"tag_label":"Radiant","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Heroism Potion","template_key":"potion-of-heroism","theme_source":"Required Holy Component; Holy and Radiant tags are interchangeable."},"Potion of Invisibility":{"section":"Potions","alchemy_group":"General Potions","rarity":"Very Rare","cores":["moss_lichen","flower","leaf_vine"],"modifier":"Optional fourth slot: shadow, phase, or light-bending essence.","modifier_required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-invisibility","theme_source":""},"Potion of Invulnerability":{"section":"Potions","alchemy_group":"General Potions","rarity":"Legendary","cores":["thorn_bark_wood","root","mineral_salt_ash"],"modifier":"Optional fourth slot: holy, force, diamond, or mythic warding component.","modifier_required":false,"allowed_families":["holy_vital","essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-invulnerability","theme_source":""},"Potion of Mind Reading":{"section":"Potions","alchemy_group":"General Potions","rarity":"Rare","cores":["flower","mineral_salt_ash","moss_lichen"],"modifier":"Optional fourth slot: psychic essence or telepathic monster component.","modifier_required":false,"allowed_families":["essence","monster_fluid","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-mind-reading","theme_source":""},"Potion of Night Vision":{"section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","cores":["flower","moss_lichen","mineral_salt_ash"],"modifier":"Optional fourth slot: shadow, moon, or sensory essence.","modifier_required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-night-vision","theme_source":""},"Potion of Physical Prowess":{"section":"Potions","alchemy_group":"General Potions","rarity":"Common","cores":["leaf_vine","moss_lichen","root"],"modifier":"Optional fourth slot: spider, gecko, earth, or mobility component.","modifier_required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-physical-prowess","theme_source":""},"Potion of Quickstep":{"section":"Potions","alchemy_group":"General Potions","rarity":"Uncommon","cores":["leaf_vine","flower","sap_resin"],"modifier":"Optional fourth slot: quickening enhancer or lightning/air essence.","modifier_required":false,"allowed_families":["enhancer","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-quickstep","theme_source":""},"Potion of Regeneration":{"section":"Potions","alchemy_group":"General Potions","rarity":"Rare","cores":["mushroom","sap_resin","root"],"modifier":"Optional fourth slot: holy/vital component, troll blood, or regeneration enhancer.","modifier_required":false,"allowed_families":["holy_vital","monster_fluid","enhancer","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-regeneration","theme_source":""},"Potion of Speed":{"section":"Potions","alchemy_group":"General Potions","rarity":"Very Rare","cores":["leaf_vine","flower","sap_resin"],"modifier":"Optional fourth slot: haste enhancer, lightning essence, or quickening monster component.","modifier_required":false,"allowed_families":["enhancer","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-speed","theme_source":""},"Potion of Storm Giant Transformation":{"section":"Potions","alchemy_group":"General Potions","rarity":"Legendary","cores":["root","thorn_bark_wood","mushroom"],"modifier":"Required fourth slot: choose a Monster Part carrying both Storm and Giant tags.","modifier_required":true,"allowed_families":["monster_fluid"],"required_tags_any":[],"required_tags_all":["Storm","Giant"],"tag_label":"Storm","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Giant Transformation","template_key":"potion-of-storm-giant-transformation","theme_source":"Required Storm Giant Monster Part."},"Potion of Watchful Rest":{"section":"Potions","alchemy_group":"General Potions","rarity":"Common","cores":["flower","moss_lichen","root"],"modifier":"Optional fourth slot: dream, moon, or vigilance essence.","modifier_required":false,"allowed_families":["essence","enhancer","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"potion-of-watchful-rest","theme_source":""},"Poison of Charisma Weakening":{"section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","cores":["venom_poison","flower","sap_resin"],"modifier":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","modifier_required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Poison of X Weakening","template_key":"poison-of-charisma-weakening","theme_source":"Named formula variant sets the attacked ability."},"Poison of Constitution Weakening":{"section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","cores":["venom_poison","mushroom","root"],"modifier":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","modifier_required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Poison of X Weakening","template_key":"poison-of-constitution-weakening","theme_source":"Named formula variant sets the attacked ability."},"Poison of Dexterity Weakening":{"section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","cores":["venom_poison","leaf_vine","flower"],"modifier":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","modifier_required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Poison of X Weakening","template_key":"poison-of-dexterity-weakening","theme_source":"Named formula variant sets the attacked ability."},"Poison of Intelligence Weakening":{"section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","cores":["venom_poison","flower","mineral_salt_ash"],"modifier":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","modifier_required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Poison of X Weakening","template_key":"poison-of-intelligence-weakening","theme_source":"Named formula variant sets the attacked ability."},"Poison of Strength Weakening":{"section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","cores":["venom_poison","root","thorn_bark_wood"],"modifier":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","modifier_required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Poison of X Weakening","template_key":"poison-of-strength-weakening","theme_source":"Named formula variant sets the attacked ability."},"Poison of Wisdom Weakening":{"section":"Poisons","alchemy_group":"Ability Poisons","rarity":"Rare","cores":["venom_poison","moss_lichen","flower"],"modifier":"Optional fourth slot: venom, bile, essence, or monster component that adds a rider or die step.","modifier_required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Poison of X Weakening","template_key":"poison-of-wisdom-weakening","theme_source":"Named formula variant sets the attacked ability."},"Basic Poison":{"section":"Poisons","alchemy_group":"Special Poisons","rarity":"Common","cores":["venom_poison","mushroom","root"],"modifier":"Optional fourth slot: monster venom, elemental essence, or poison enhancer.","modifier_required":false,"allowed_families":["monster_fluid","essence","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"basic-poison","theme_source":""},"Mindfog Poison":{"section":"Poisons","alchemy_group":"Special Poisons","rarity":"Rare","cores":["venom_poison","flower","moss_lichen"],"modifier":"Required fourth slot: Mindshard Distillate, Aboleth Mucus, or another psychic component.","modifier_required":true,"allowed_families":["essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":["Confused"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"","template_key":"mindfog-poison","theme_source":""},"Paralytic Venom":{"section":"Poisons","alchemy_group":"Special Poisons","rarity":"Rare","cores":["venom_poison","root","flower"],"modifier":"Required fourth slot: Ghoul Ichor or another paralytic component.","modifier_required":true,"allowed_families":["monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":["Paralyzed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"","template_key":"paralytic-venom","theme_source":""},"Purple Worm Poison":{"section":"Poisons","alchemy_group":"Special Poisons","rarity":"Very Rare","cores":["venom_poison","root","sap_resin"],"modifier":"Required fourth slot: Purple Worm venom or an equivalent legendary monster toxin.","modifier_required":true,"allowed_families":["monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"purple-worm-poison","theme_source":""},"Siren's Whisper Poison":{"section":"Poisons","alchemy_group":"Special Poisons","rarity":"Rare","cores":["venom_poison","flower","sap_resin"],"modifier":"Required fourth slot: Siren Gland Extract, fey essence, or another charm-bearing component.","modifier_required":true,"allowed_families":["monster_fluid","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":["Charmed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"Ends when harmed","formula_family":"","template_key":"siren-s-whisper-poison","theme_source":""},"Stoneblood Toxin":{"section":"Poisons","alchemy_group":"Special Poisons","rarity":"Very Rare","cores":["venom_poison","mineral_salt_ash","root"],"modifier":"Required fourth slot: Basilisk Bile, Medusa-derived essence, or another petrifying component.","modifier_required":true,"allowed_families":["monster_fluid","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":["Petrified"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"","template_key":"stoneblood-toxin","theme_source":""},"Bomb of Blindness":{"section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Uncommon","cores":["mineral_salt_ash","flower","sap_resin"],"modifier":"Required fourth slot: choose a component tagged Blindness, Sight.","modifier_required":true,"allowed_families":[],"required_tags_any":["Blindness","Sight"],"required_tags_all":[],"tag_label":"Blindness","condition_riders":["Blinded"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Blindness, Sight."},"Bomb of Charm":{"section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","cores":["mineral_salt_ash","flower","sap_resin"],"modifier":"Required fourth slot: choose a component tagged Charm, Mind, Psychic, Fey.","modifier_required":true,"allowed_families":[],"required_tags_any":["Charm","Mind","Psychic","Fey"],"required_tags_all":[],"tag_label":"Charm","condition_riders":["Charmed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"Ends when harmed","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Charm, Mind, Psychic, Fey."},"Bomb of Confusion":{"section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","cores":["mineral_salt_ash","flower","sap_resin"],"modifier":"Required fourth slot: choose a component tagged Confusion, Mind, Psychic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Confusion","Mind","Psychic"],"required_tags_all":[],"tag_label":"Confusion","condition_riders":["Confused"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Confusion, Mind, Psychic."},"Bomb of Deafness":{"section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Uncommon","cores":["mineral_salt_ash","flower","sap_resin"],"modifier":"Required fourth slot: choose a component tagged Deafness, Sound, Thunder.","modifier_required":true,"allowed_families":[],"required_tags_any":["Deafness","Sound","Thunder"],"required_tags_all":[],"tag_label":"Deafness","condition_riders":["Deafened"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Deafness, Sound, Thunder."},"Bomb of Fear":{"section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","cores":["mineral_salt_ash","flower","sap_resin"],"modifier":"Required fourth slot: choose a component tagged Fear, Mind, Psychic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Fear","Mind","Psychic"],"required_tags_all":[],"tag_label":"Fear","condition_riders":["Frightened"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Fear, Mind, Psychic."},"Bomb of Paralysis":{"section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","cores":["mineral_salt_ash","flower","sap_resin"],"modifier":"Required fourth slot: choose a component tagged Paralysis, Nerve.","modifier_required":true,"allowed_families":[],"required_tags_any":["Paralysis","Nerve"],"required_tags_all":[],"tag_label":"Paralysis","condition_riders":["Paralyzed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Paralysis, Nerve."},"Bomb of Petrification":{"section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Very Rare","cores":["mineral_salt_ash","flower","sap_resin"],"modifier":"Required fourth slot: choose a component tagged Petrification, Stone.","modifier_required":true,"allowed_families":[],"required_tags_any":["Petrification","Stone"],"required_tags_all":[],"tag_label":"Petrification","condition_riders":["Petrified"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Petrification, Stone."},"Bomb of Poisoning":{"section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Uncommon","cores":["mineral_salt_ash","flower","sap_resin"],"modifier":"Required fourth slot: choose a component tagged Poison, Venom.","modifier_required":true,"allowed_families":[],"required_tags_any":["Poison","Venom"],"required_tags_all":[],"tag_label":"Poison","condition_riders":["Poisoned"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Poison, Venom."},"Bomb of Restraint":{"section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","cores":["mineral_salt_ash","flower","sap_resin"],"modifier":"Required fourth slot: choose a component tagged Restraint, Binding.","modifier_required":true,"allowed_families":[],"required_tags_any":["Restraint","Binding"],"required_tags_all":[],"tag_label":"Restraint","condition_riders":["Restrained"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Dexterity","rider_duration":"1 minute","rider_repeat_save":"Action to escape","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Restraint, Binding."},"Bomb of Stunning":{"section":"Bombs","alchemy_group":"Condition Bombs","rarity":"Rare","cores":["mineral_salt_ash","flower","sap_resin"],"modifier":"Required fourth slot: choose a component tagged Stunning, Nerve, Lightning, Thunder.","modifier_required":true,"allowed_families":[],"required_tags_any":["Stunning","Nerve","Lightning","Thunder"],"required_tags_all":[],"tag_label":"Stunning","condition_riders":["Stunned"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"Until the end of the target's next turn","rider_repeat_save":"","formula_family":"Condition Bomb","template_key":"bomb_condition","theme_source":"Fourth-slot tags: Stunning, Nerve, Lightning, Thunder."},"Bomb of Acid":{"section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Acid.","modifier_required":true,"allowed_families":[],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Acid tag."},"Bomb of Cold":{"section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Cold.","modifier_required":true,"allowed_families":[],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Cold tag."},"Bomb of Fire":{"section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Fire.","modifier_required":true,"allowed_families":[],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Fire tag."},"Bomb of Force":{"section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Rare","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Force.","modifier_required":true,"allowed_families":[],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Force tag."},"Bomb of Lightning":{"section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Lightning.","modifier_required":true,"allowed_families":[],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Lightning tag."},"Bomb of Necrotic":{"section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Rare","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Necrotic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Necrotic tag."},"Bomb of Poison":{"section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Poison.","modifier_required":true,"allowed_families":[],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Poison tag."},"Bomb of Psychic":{"section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Rare","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Psychic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Psychic tag."},"Bomb of Radiant":{"section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Rare","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Radiant.","modifier_required":true,"allowed_families":[],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Radiant tag."},"Bomb of Thunder":{"section":"Bombs","alchemy_group":"Elemental Bombs","rarity":"Uncommon","cores":["mineral_salt_ash","sap_resin","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Thunder.","modifier_required":true,"allowed_families":[],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Bomb","template_key":"bomb_elemental","theme_source":"Fourth-slot Thunder tag."},"Elixir of Charisma":{"section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","cores":["flower","sap_resin","mineral_salt_ash"],"modifier":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","modifier_required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-charisma","theme_source":"Named formula variant sets the ability."},"Elixir of Constitution":{"section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","cores":["root","mushroom","moss_lichen"],"modifier":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","modifier_required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-constitution","theme_source":"Named formula variant sets the ability."},"Elixir of Dexterity":{"section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","cores":["leaf_vine","flower","sap_resin"],"modifier":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","modifier_required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-dexterity","theme_source":"Named formula variant sets the ability."},"Elixir of Intelligence":{"section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","cores":["flower","mineral_salt_ash","root"],"modifier":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","modifier_required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-intelligence","theme_source":"Named formula variant sets the ability."},"Elixir of Strength":{"section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","cores":["root","thorn_bark_wood","mushroom"],"modifier":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","modifier_required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-strength","theme_source":"Named formula variant sets the ability."},"Elixir of Wisdom":{"section":"Elixirs","alchemy_group":"Ability Elixirs","rarity":"Uncommon","cores":["moss_lichen","flower","root"],"modifier":"Optional fourth slot: enhancer, holy/vital component, essence, or monster-derived ability twist.","modifier_required":false,"allowed_families":["enhancer","holy_vital","essence","monster_fluid"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of X Ability","template_key":"elixir-of-wisdom","theme_source":"Named formula variant sets the ability."},"Elixir of Blindness Immunity":{"section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Uncommon","cores":["root","flower","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Blindness, Sight.","modifier_required":true,"allowed_families":[],"required_tags_any":["Blindness","Sight"],"required_tags_all":[],"tag_label":"Blindness","condition_riders":[],"cures_conditions":["Blinded"],"grants_immunities":["Blinded"],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Blindness, Sight."},"Elixir of Charm Immunity":{"section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","cores":["root","flower","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Charm, Mind, Psychic, Fey.","modifier_required":true,"allowed_families":[],"required_tags_any":["Charm","Mind","Psychic","Fey"],"required_tags_all":[],"tag_label":"Charm","condition_riders":[],"cures_conditions":["Charmed"],"grants_immunities":["Charmed"],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Charm, Mind, Psychic, Fey."},"Elixir of Confusion Immunity":{"section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","cores":["root","flower","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Confusion, Mind, Psychic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Confusion","Mind","Psychic"],"required_tags_all":[],"tag_label":"Confusion","condition_riders":[],"cures_conditions":["Confused"],"grants_immunities":["Confused"],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Confusion, Mind, Psychic."},"Elixir of Deafness Immunity":{"section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Uncommon","cores":["root","flower","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Deafness, Sound, Thunder.","modifier_required":true,"allowed_families":[],"required_tags_any":["Deafness","Sound","Thunder"],"required_tags_all":[],"tag_label":"Deafness","condition_riders":[],"cures_conditions":["Deafened"],"grants_immunities":["Deafened"],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Deafness, Sound, Thunder."},"Elixir of Fear Immunity":{"section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","cores":["root","flower","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Fear, Mind, Psychic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Fear","Mind","Psychic"],"required_tags_all":[],"tag_label":"Fear","condition_riders":[],"cures_conditions":["Frightened"],"grants_immunities":["Frightened"],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Fear, Mind, Psychic."},"Elixir of Paralysis Immunity":{"section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","cores":["root","flower","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Paralysis, Nerve.","modifier_required":true,"allowed_families":[],"required_tags_any":["Paralysis","Nerve"],"required_tags_all":[],"tag_label":"Paralysis","condition_riders":[],"cures_conditions":["Paralyzed"],"grants_immunities":["Paralyzed"],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Paralysis, Nerve."},"Elixir of Petrification Immunity":{"section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Very Rare","cores":["root","flower","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Petrification, Stone.","modifier_required":true,"allowed_families":[],"required_tags_any":["Petrification","Stone"],"required_tags_all":[],"tag_label":"Petrification","condition_riders":[],"cures_conditions":["Petrified"],"grants_immunities":["Petrified"],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Petrification, Stone."},"Elixir of Poison Immunity":{"section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Uncommon","cores":["root","flower","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Poison, Venom.","modifier_required":true,"allowed_families":[],"required_tags_any":["Poison","Venom"],"required_tags_all":[],"tag_label":"Poison","condition_riders":[],"cures_conditions":["Poisoned"],"grants_immunities":["Poisoned"],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Poison, Venom."},"Elixir of Restraint Immunity":{"section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","cores":["root","flower","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Restraint, Binding.","modifier_required":true,"allowed_families":[],"required_tags_any":["Restraint","Binding"],"required_tags_all":[],"tag_label":"Restraint","condition_riders":[],"cures_conditions":["Restrained"],"grants_immunities":["Restrained"],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Restraint, Binding."},"Elixir of Stunning Immunity":{"section":"Elixirs","alchemy_group":"Immunity Elixirs","rarity":"Rare","cores":["root","flower","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Stunning, Nerve, Lightning, Thunder.","modifier_required":true,"allowed_families":[],"required_tags_any":["Stunning","Nerve","Lightning","Thunder"],"required_tags_all":[],"tag_label":"Stunning","condition_riders":[],"cures_conditions":["Stunned"],"grants_immunities":["Stunned"],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Condition Immunity","template_key":"elixir_condition_immunity","theme_source":"Fourth-slot tags: Stunning, Nerve, Lightning, Thunder."},"Elixir of Acid Resistance":{"section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","cores":["moss_lichen","root","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Acid.","modifier_required":true,"allowed_families":[],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Acid tag."},"Elixir of Cold Resistance":{"section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","cores":["moss_lichen","root","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Cold.","modifier_required":true,"allowed_families":[],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Cold tag."},"Elixir of Fire Resistance":{"section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","cores":["moss_lichen","root","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Fire.","modifier_required":true,"allowed_families":[],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Fire tag."},"Elixir of Force Resistance":{"section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","cores":["moss_lichen","root","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Force.","modifier_required":true,"allowed_families":[],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Force tag."},"Elixir of Lightning Resistance":{"section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","cores":["moss_lichen","root","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Lightning.","modifier_required":true,"allowed_families":[],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Lightning tag."},"Elixir of Necrotic Resistance":{"section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","cores":["moss_lichen","root","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Necrotic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Necrotic tag."},"Elixir of Poison Resistance":{"section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","cores":["moss_lichen","root","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Poison.","modifier_required":true,"allowed_families":[],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Poison tag."},"Elixir of Psychic Resistance":{"section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","cores":["moss_lichen","root","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Psychic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Psychic tag."},"Elixir of Radiant Resistance":{"section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","cores":["moss_lichen","root","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Radiant.","modifier_required":true,"allowed_families":[],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Radiant tag."},"Elixir of Thunder Resistance":{"section":"Elixirs","alchemy_group":"Resistance Elixirs","rarity":"Uncommon","cores":["moss_lichen","root","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Thunder.","modifier_required":true,"allowed_families":[],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elixir of Element Resistance","template_key":"elixir_element_resistance","theme_source":"Fourth-slot Thunder tag."},"Oil of Blindness":{"section":"Oils","alchemy_group":"Condition Oils","rarity":"Uncommon","cores":["sap_resin","venom_poison","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Blindness, Sight.","modifier_required":true,"allowed_families":[],"required_tags_any":["Blindness","Sight"],"required_tags_all":[],"tag_label":"Blindness","condition_riders":["Blinded"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Blindness, Sight."},"Oil of Charm":{"section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","cores":["sap_resin","venom_poison","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Charm, Mind, Psychic, Fey.","modifier_required":true,"allowed_families":[],"required_tags_any":["Charm","Mind","Psychic","Fey"],"required_tags_all":[],"tag_label":"Charm","condition_riders":["Charmed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"Ends when harmed","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Charm, Mind, Psychic, Fey."},"Oil of Confusion":{"section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","cores":["sap_resin","venom_poison","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Confusion, Mind, Psychic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Confusion","Mind","Psychic"],"required_tags_all":[],"tag_label":"Confusion","condition_riders":["Confused"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Confusion, Mind, Psychic."},"Oil of Deafness":{"section":"Oils","alchemy_group":"Condition Oils","rarity":"Uncommon","cores":["sap_resin","venom_poison","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Deafness, Sound, Thunder.","modifier_required":true,"allowed_families":[],"required_tags_any":["Deafness","Sound","Thunder"],"required_tags_all":[],"tag_label":"Deafness","condition_riders":["Deafened"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Deafness, Sound, Thunder."},"Oil of Fear":{"section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","cores":["sap_resin","venom_poison","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Fear, Mind, Psychic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Fear","Mind","Psychic"],"required_tags_all":[],"tag_label":"Fear","condition_riders":["Frightened"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Wisdom","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Fear, Mind, Psychic."},"Oil of Paralysis":{"section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","cores":["sap_resin","venom_poison","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Paralysis, Nerve.","modifier_required":true,"allowed_families":[],"required_tags_any":["Paralysis","Nerve"],"required_tags_all":[],"tag_label":"Paralysis","condition_riders":["Paralyzed"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Paralysis, Nerve."},"Oil of Petrification":{"section":"Oils","alchemy_group":"Condition Oils","rarity":"Very Rare","cores":["sap_resin","venom_poison","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Petrification, Stone.","modifier_required":true,"allowed_families":[],"required_tags_any":["Petrification","Stone"],"required_tags_all":[],"tag_label":"Petrification","condition_riders":["Petrified"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Petrification, Stone."},"Oil of Poisoning":{"section":"Oils","alchemy_group":"Condition Oils","rarity":"Uncommon","cores":["sap_resin","venom_poison","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Poison, Venom.","modifier_required":true,"allowed_families":[],"required_tags_any":["Poison","Venom"],"required_tags_all":[],"tag_label":"Poison","condition_riders":["Poisoned"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"1 minute","rider_repeat_save":"End of each turn","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Poison, Venom."},"Oil of Restraint":{"section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","cores":["sap_resin","venom_poison","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Restraint, Binding.","modifier_required":true,"allowed_families":[],"required_tags_any":["Restraint","Binding"],"required_tags_all":[],"tag_label":"Restraint","condition_riders":["Restrained"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Dexterity","rider_duration":"1 minute","rider_repeat_save":"Action to escape","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Restraint, Binding."},"Oil of Stunning":{"section":"Oils","alchemy_group":"Condition Oils","rarity":"Rare","cores":["sap_resin","venom_poison","mineral_salt_ash"],"modifier":"Required fourth slot: choose a component tagged Stunning, Nerve, Lightning, Thunder.","modifier_required":true,"allowed_families":[],"required_tags_any":["Stunning","Nerve","Lightning","Thunder"],"required_tags_all":[],"tag_label":"Stunning","condition_riders":["Stunned"],"cures_conditions":[],"grants_immunities":[],"rider_save":"Constitution","rider_duration":"Until the end of the target's next turn","rider_repeat_save":"","formula_family":"Condition Oil","template_key":"oil_condition","theme_source":"Fourth-slot tags: Stunning, Nerve, Lightning, Thunder."},"Oil of Acid":{"section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","cores":["sap_resin","mineral_salt_ash","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Acid.","modifier_required":true,"allowed_families":[],"required_tags_any":["Acid"],"required_tags_all":[],"tag_label":"Acid","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Acid tag."},"Oil of Cold":{"section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","cores":["sap_resin","mineral_salt_ash","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Cold.","modifier_required":true,"allowed_families":[],"required_tags_any":["Cold"],"required_tags_all":[],"tag_label":"Cold","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Cold tag."},"Oil of Fire":{"section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","cores":["sap_resin","mineral_salt_ash","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Fire.","modifier_required":true,"allowed_families":[],"required_tags_any":["Fire"],"required_tags_all":[],"tag_label":"Fire","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Fire tag."},"Oil of Force":{"section":"Oils","alchemy_group":"Elemental Oils","rarity":"Rare","cores":["sap_resin","mineral_salt_ash","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Force.","modifier_required":true,"allowed_families":[],"required_tags_any":["Force"],"required_tags_all":[],"tag_label":"Force","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Force tag."},"Oil of Lightning":{"section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","cores":["sap_resin","mineral_salt_ash","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Lightning.","modifier_required":true,"allowed_families":[],"required_tags_any":["Lightning"],"required_tags_all":[],"tag_label":"Lightning","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Lightning tag."},"Oil of Necrotic":{"section":"Oils","alchemy_group":"Elemental Oils","rarity":"Rare","cores":["sap_resin","mineral_salt_ash","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Necrotic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Necrotic"],"required_tags_all":[],"tag_label":"Necrotic","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Necrotic tag."},"Oil of Poison":{"section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","cores":["sap_resin","mineral_salt_ash","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Poison.","modifier_required":true,"allowed_families":[],"required_tags_any":["Poison"],"required_tags_all":[],"tag_label":"Poison","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Poison tag."},"Oil of Psychic":{"section":"Oils","alchemy_group":"Elemental Oils","rarity":"Rare","cores":["sap_resin","mineral_salt_ash","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Psychic.","modifier_required":true,"allowed_families":[],"required_tags_any":["Psychic"],"required_tags_all":[],"tag_label":"Psychic","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Psychic tag."},"Oil of Radiant":{"section":"Oils","alchemy_group":"Elemental Oils","rarity":"Rare","cores":["sap_resin","mineral_salt_ash","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Radiant.","modifier_required":true,"allowed_families":[],"required_tags_any":["Radiant"],"required_tags_all":[],"tag_label":"Radiant","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Radiant tag."},"Oil of Thunder":{"section":"Oils","alchemy_group":"Elemental Oils","rarity":"Uncommon","cores":["sap_resin","mineral_salt_ash","thorn_bark_wood"],"modifier":"Required fourth slot: choose a component tagged Thunder.","modifier_required":true,"allowed_families":[],"required_tags_any":["Thunder"],"required_tags_all":[],"tag_label":"Thunder","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"Elemental Oil","template_key":"oil_elemental","theme_source":"Fourth-slot Thunder tag."},"Oil of Etherealness":{"section":"Oils","alchemy_group":"Utility Oils","rarity":"Very Rare","cores":["sap_resin","mineral_salt_ash","flower"],"modifier":"Required fourth slot: phase residue, ethereal essence, or another planar component.","modifier_required":true,"allowed_families":["essence","monster_fluid","enhancer"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"oil-of-etherealness","theme_source":""},"Oil of Sharpness":{"section":"Oils","alchemy_group":"Utility Oils","rarity":"Very Rare","cores":["sap_resin","thorn_bark_wood","mineral_salt_ash"],"modifier":"Optional fourth slot: concentrating enhancer or monster-derived cutting agent.","modifier_required":false,"allowed_families":["enhancer","monster_fluid","essence"],"required_tags_any":[],"required_tags_all":[],"tag_label":"","condition_riders":[],"cures_conditions":[],"grants_immunities":[],"rider_save":"","rider_duration":"","rider_repeat_save":"","formula_family":"","template_key":"oil-of-sharpness","theme_source":""}};
function readableDamageType(value = "") {
  const clean = String(value || "").toLowerCase().trim();
  const labels = { cold: "Cold", fire: "Fire", acid: "Acid", lightning: "Lightning", thunder: "Thunder", poison: "Poison", radiant: "Radiant", necrotic: "Necrotic", psychic: "Psychic", force: "Force" };
  return labels[clean] || titleCase(clean || "X");
}
function alchemyConditionCureFromMaterials(materials = []) {
  for (const material of materials || []) {
    const profile = materialAlchemyProfile(material);
    const bonuses = normalizeAlchemyBonuses(profile?.bonuses || profile?.attributes || {});
    if (bonuses.conditionCure) return bonuses.conditionCure;
  }
  return "";
}
function immunityConditionNoun(value = "") {
  const labels = { Blinded: "Blindness", Charmed: "Charm", Confused: "Confusion", Frightened: "Fear", Paralyzed: "Paralysis", Petrified: "Petrification", Poisoned: "Poison", Restrained: "Restraint", Stunned: "Stunning" };
  return labels[value] || titleCase(value || "X");
}
function healingNameFromEffect(effectPct = 0, diceSteps = 0) {
  const score = Number(effectPct || 0) + Number(diceSteps || 0) * 100;
  if (score >= 300) return "Supreme Potion of Healing";
  if (score >= 200) return "Superior Potion of Healing";
  if (score >= 100) return "Greater Potion of Healing";
  if (score >= 50) return "Strong Potion of Healing";
  return "Healing Potion";
}
function dynamicAlchemyResultName(recipe, selectedMaterials = []) {
  if (!recipe || String(recipe.discipline || "") !== "Alchemy") return "";
  const canonical = canonicalAlchemyRecipeName(recipe.name || "");
  const key = normalizeRecipeNameKey(canonical);
  if (/(?:potion-of-healing|healing-potion)/.test(key)) {
    const totals = alchemyAggregateStats(selectedMaterials, recipe);
    return healingNameFromEffect(totals.effectPct, totals.dieSteps);
  }
  return canonical || "";
}

const ALCHEMY_REAGENT_FAMILIES = [
  { key: "mushroom", label: "Mushroom", identity: "effect strength, healing, body repair, regeneration, toxins", examples: "Hearthcap Mushroom, Moonmilk Fungus, Phoenix Truffle" },
  { key: "root", label: "Root", identity: "duration, endurance, stat buffs, and costly universal die steps", examples: "Ironroot, Giantroot, Worldroot Knot" },
  { key: "sap_resin", label: "Sap / Resin", identity: "duration, regeneration, oils, coatings, lingering effects", examples: "Amber Sap, Aetherglass Sap" },
  { key: "moss_lichen", label: "Moss / Lichen", identity: "resistance, adaptation, survival, environmental endurance", examples: "Wardmoss, Diamondvein Lichen" },
  { key: "flower", label: "Flower", identity: "Save DC, senses, emotion, charm, sleep, clarity", examples: "Dreamlotus Bloom, Fey Orchid, Halo Lily" },
  { key: "leaf_vine", label: "Leaf / Vine", identity: "Dexterity, movement, climbing, speed, breath, flexibility", examples: "Gripsap Vine, Moonsilver Fern, Thunderstep Fern" },
  { key: "thorn_bark_wood", label: "Thorn / Bark / Wood", identity: "physical reinforcement, armor, thorns, Strength and Constitution", examples: "Ironbark Strip, Stonebark Shaving, Elder Ironwood Heart" },
  { key: "mineral_salt_ash", label: "Mineral / Salt / Ash", identity: "extra doses, duration, purification, binding, resistance anchors", examples: "Spring Salt, Grave Ash, Starfall Salt" },
  { key: "venom_poison", label: "Venom / Poison Plant", identity: "Save DC, stat damage, poison strength, and costly universal die steps", examples: "Widowshade, Venomkiss Nettle, Black Lotus Venom" },
  { key: "essence", label: "Essence", identity: "fourth-slot type direction: fire, cold, acid, lightning, radiant, necrotic, psychic, force", examples: "Fire Essence, Frost Essence, Grave Essence" },
  { key: "enhancer", label: "Enhancer / Catalyst", identity: "fourth-slot technical upgrade: universal die steps, extra dose, duration, or large Craft DC reduction", examples: "Pure Catalyst, Distillation Agent, Binding Agent" },
  { key: "holy_vital", label: "Holy Component", identity: "fourth-slot Radiant healing upgrades and clean restorative force", examples: "Holy Component, Greater Holy Component" },
  { key: "monster_fluid", label: "Monster Parts", identity: "harvested creature components carrying neutral elemental, condition, or theme tags", examples: "Fire Gland, Frost Motes, Demonic Blood, Psychic Essence" },
];
const ALCHEMY_REAGENT_FAMILY_BY_KEY = Object.fromEntries(ALCHEMY_REAGENT_FAMILIES.map((family) => [family.key, family]));
const ALCHEMY_RARITY_POTENCY = { Mundane: 0, Common: 1, Uncommon: 2, Rare: 3, "Very Rare": 4, Legendary: 5, Varies: 1 };
function normalizeReagentFamily(value = "") {
  const s = String(value || "").toLowerCase().replace(/[\s/]+/g, "_").replace(/[^a-z0-9_]+/g, "").replace(/^_+|_+$/g, "");
  const aliases = {
    mushrooms: "mushroom", fungus: "mushroom", fungi: "mushroom",
    roots: "root",
    sap: "sap_resin", resin: "sap_resin", saps: "sap_resin", resins: "sap_resin",
    moss: "moss_lichen", mosses: "moss_lichen", lichen: "moss_lichen", lichens: "moss_lichen",
    flowers: "flower", blossoms: "flower", bloom: "flower", blooms: "flower", berry: "flower", berries: "flower", fruit: "flower", fruits: "flower", berry_fruit: "flower",
    leaf: "leaf_vine", leaves: "leaf_vine", vine: "leaf_vine", vines: "leaf_vine", fern: "leaf_vine", ferns: "leaf_vine", seed: "leaf_vine", seeds: "leaf_vine",
    thorn: "thorn_bark_wood", thorns: "thorn_bark_wood", bark: "thorn_bark_wood", wood: "thorn_bark_wood", hardwood: "thorn_bark_wood",
    mineral: "mineral_salt_ash", minerals: "mineral_salt_ash", salt: "mineral_salt_ash", salts: "mineral_salt_ash", ash: "mineral_salt_ash", spice: "mineral_salt_ash", spices: "mineral_salt_ash",
    venom: "venom_poison", poison: "venom_poison", poison_plant: "venom_poison", toxic: "venom_poison", toxin: "venom_poison",
    essence: "essence", essences: "essence", elemental_essence: "essence", purchased: "essence", purchased_essence: "essence",
    enhancer: "enhancer", enhancers: "enhancer", catalyst: "enhancer", catalysts: "enhancer", distillation: "enhancer", binding: "enhancer",
    holy: "holy_vital", vital: "holy_vital", holy_component: "holy_vital", vital_component: "holy_vital",
    monster: "monster_fluid", monster_parts: "monster_fluid", monster_part: "monster_fluid", part: "monster_fluid", parts: "monster_fluid", bile: "monster_fluid", gland: "monster_fluid", glands: "monster_fluid", ichor: "monster_fluid", mucus: "monster_fluid", blood: "monster_fluid",
  };
  return aliases[s] || (ALCHEMY_REAGENT_FAMILY_BY_KEY[s] ? s : "");
}
function reagentFamilyLabel(value = "") {
  // compact-family-labels: keep long family names inside compact cards.
  const compactFamilyKey = String(value || "").toLowerCase().replace(/[_/-]+/g, " " ).replace(/\s+/g, " " ).trim();
  if (compactFamilyKey === "enhancer" || compactFamilyKey === "enhancer catalyst") return "Enhancer";
  if (compactFamilyKey === "mineral salt ash") return "Mineral / Ash";
  const key = normalizeReagentFamily(value);
  return ALCHEMY_REAGENT_FAMILY_BY_KEY[key]?.label || titleCase(value || "Reagent");
}
function reagentPotencyRank(value) {
  const r = rarity(value || "Common") || "Common";
  return ALCHEMY_RARITY_POTENCY[r] ?? 1;
}
function alchemyCraftDcReductionForRarity(value = "Common") {
  const r = rarity(value || "Common") || "Common";
  return ALCHEMY_RARITY_DC_REDUCTION[r] ?? 0;
}
function alchemyBrewRarityIndex(value = "Common") {
  const normalized = rarity(value || "Common") || "Common";
  const idx = ALCHEMY_BREW_RARITIES.indexOf(normalized);
  return idx < 0 ? 0 : idx;
}
function alchemyBrewRarityAtIndex(index = 0) {
  return ALCHEMY_BREW_RARITIES[Math.max(0, Math.min(ALCHEMY_BREW_RARITIES.length - 1, Number(index) || 0))] || "Common";
}
function alchemyBrewQualityPreview(recipe = {}, materials = []) {
  const formulaRarity = rarity(recipe?.formula_rarity || recipe?.formulaRarity || recipe?.rarity || "Common") || "Common";
  const formulaIndex = alchemyBrewRarityIndex(formulaRarity);
  const coreMaterials = (materials || []).filter((material) => {
    const slotType = material?.slot_type || material?.slotType || (material?.slot_family === "any" ? "modifier" : "core");
    return slotType !== "modifier" && material?.slot_family !== "any";
  });
  const ingredientSteps = coreMaterials.map((material) => {
    const ingredientRarity = rarity(material?.rarity || "Common") || "Common";
    const steps = Math.max(0, alchemyBrewRarityIndex(ingredientRarity) - formulaIndex);
    return { name: material?.name || "Ingredient", rarity: ingredientRarity, steps };
  });
  const qualitySteps = ingredientSteps.reduce((sum, entry) => sum + entry.steps, 0);
  const rarityIncrease = Math.floor(qualitySteps / 3);
  const qualityFinishedIndex = formulaIndex + rarityIncrease;
  const modifierFloor = (materials || []).reduce((floor, material) => {
    const profile = materialAlchemyProfile(material);
    const bonuses = normalizeAlchemyBonuses(profile?.bonuses || profile?.attributes || {});
    return alchemyBrewRarityIndex(bonuses.brewRarityFloor || "Common") > alchemyBrewRarityIndex(floor) ? bonuses.brewRarityFloor : floor;
  }, "Common");
  const finishedRarity = alchemyBrewRarityAtIndex(Math.max(qualityFinishedIndex, alchemyBrewRarityIndex(modifierFloor)));
  return {
    formulaRarity,
    finishedRarity,
    modifierRarityFloor: modifierFloor === "Common" ? "" : modifierFloor,
    qualitySteps,
    rarityIncrease: Math.max(0, alchemyBrewRarityIndex(finishedRarity) - formulaIndex),
    stepsTowardNextTier: qualitySteps % 3,
    ingredientSteps,
  };
}
function alchemyCraftDcReductionForRecipe(ingredientRarity = "Common", finishedBrewRarity = "Common", slotType = "core") {
  if (slotType === "modifier") return 0;
  const ingredientReduction = alchemyCraftDcReductionForRarity(ingredientRarity);
  const finishedTierReduction = alchemyCraftDcReductionForRarity(finishedBrewRarity);
  // An ingredient can never be worse than a correctly matched ingredient, but it
  // also cannot reduce DC beyond the tier of the finished brew. Excess quality
  // raises Brew Quality Steps and therefore the finished rarity/base DC instead.
  return Math.min(ingredientReduction, finishedTierReduction);
}
function alchemyBaseDcByRarity(value = "Common") {
  const r = rarity(value || "Common") || "Common";
  return ALCHEMY_BASE_DC_BY_RARITY[r] ?? 16;
}
function inferReagentFamilyFromText(value = "") {
  const blob = String(value || "").toLowerCase();
  if (/mushroom|fungus|cap|truffle|morel|spore|mycel/.test(blob)) return "mushroom";
  if (/root|bulb|tuber|mandrake|ironroot|heartroot|worldroot/.test(blob)) return "root";
  if (/sap|resin|amber|tar|pitch|gum|myrrh/.test(blob)) return "sap_resin";
  if (/moss|lichen|kelp|algae|wardmoss|starmoss/.test(blob)) return "moss_lichen";
  if (/flower|blossom|bloom|petal|lotus|orchid|clover|rose|marigold|berry|fruit|eyebright/.test(blob)) return "flower";
  if (/leaf|leaves|vine|fern|reed|grass|swiftleaf|tendril|seed|pod/.test(blob)) return "leaf_vine";
  if (/thorn|bark|wood|oak|ironwood|briar/.test(blob)) return "thorn_bark_wood";
  if (/mineral|salt|ash|dust|crystal|stone|diamond|grave ash|charcoal|spring salt/.test(blob)) return "mineral_salt_ash";
  if (/venom|poison|toxin|nettle|nightshade|widowshade|lotus/.test(blob)) return "venom_poison";
  if (/essence|elemental|fire|frost|cold|lightning|acid|thunder|radiant|necrotic|psychic|force|shadow/.test(blob)) return "essence";
  if (/enhancer|catalyst|distillation|binding agent|concentrating agent|volatile agent|solvent/.test(blob)) return "enhancer";
  if (/holy|vital|celestial|saint|sacred/.test(blob)) return "holy_vital";
  if (/monster|fang|claw|horn|scale|hide|heart|gland|ichor|bone|blood|bile|mucus|dragon|troll|wyvern|basilisk|ghoul|aboleth|kaorti/.test(blob)) return "monster_fluid";
  return "";
}
function inferReagentFamily(material = {}) {
  const alchemy = materialAlchemyProfile(material);
  const explicit = normalizeReagentFamily(alchemy.family || material.reagent_family || material.family_key || material.raw?.reagent_family || material.raw?.plants?.reagent_family || material.raw?.card_payload?.reagent_family || material.raw?.card_payload?.family_key || material.raw?.card_payload?.alchemy?.family || material.raw?.payload?.alchemy?.family);
  if (explicit) return explicit;
  const tags = materialTags(material).join(" ");
  return inferReagentFamilyFromText([material.name, material.category, material.type, material.notes, tags].filter(Boolean).join(" ")) || "";
}
function alchemyFamilySlot(key, role, family, minRarity = "Common", optional = false, note = "") {
  const normalizedFamily = normalizeReagentFamily(family) || family;
  return {
    key,
    category: normalizedFamily === "monster_fluid" ? "Monster Part" : ["essence", "enhancer", "holy_vital"].includes(normalizedFamily) ? "Reagent / Catalyst" : "Plant / Herb",
    family: normalizedFamily,
    family_label: normalizedFamily === "any" ? "Any Enhancer" : reagentFamilyLabel(normalizedFamily),
    min_rarity: rarity(minRarity || "Common"),
    label: normalizedFamily === "any" ? "Optional enhancer" : `${reagentFamilyLabel(normalizedFamily)} ${rarity(minRarity || "Common")}+`,
    role,
    required: !optional,
    note,
  };
}
function normalizeAlchemySlot(slot, idx = 0) {
  const family = normalizeReagentFamily(slot.family || slot.reagent_family || slot.category_family) || normalizeReagentFamily(slot.category) || (slot.family === "any" ? "any" : "");
  const allowedFamilies = Array.isArray(slot.allowed_families) ? slot.allowed_families : Array.isArray(slot.allowedFamilies) ? slot.allowedFamilies : Array.isArray(slot.allowed_kinds) ? slot.allowed_kinds : Array.isArray(slot.allowedKinds) ? slot.allowedKinds : [];
  return {
    key: slot.key || `alchemy_slot_${idx + 1}`,
    category: slot.category || (family === "monster_fluid" ? "Monster Part" : ["essence", "enhancer", "holy_vital"].includes(family) || slot.slot_type === "modifier" ? "Reagent / Catalyst" : "Plant / Herb"),
    family,
    family_label: slot.family_label || slot.familyLabel || (family === "any" ? "Any Enhancer" : reagentFamilyLabel(family || slot.category)),
    min_rarity: rarity(slot.min_rarity || slot.minimum_rarity || slot.rarity || "Common"),
    label: slot.label || (family === "any" ? "Optional enhancer" : `${reagentFamilyLabel(family || slot.category)} ${rarity(slot.min_rarity || slot.rarity || "Common")}+`),
    role: slot.role || slot.slot || `Ingredient ${idx + 1}`,
    required: slot.required !== false && !slot.optional,
    note: slot.note || slot.effect || "",
    slot_type: slot.slot_type || slot.slotType || (family === "any" ? "modifier" : "core"),
    allowed_families: allowedFamilies.map(normalizeReagentFamily).filter(Boolean),
    required_tags_any: Array.isArray(slot.required_tags_any) ? slot.required_tags_any : Array.isArray(slot.requiredTagsAny) ? slot.requiredTagsAny : [],
    required_tags_all: Array.isArray(slot.required_tags_all) ? slot.required_tags_all : Array.isArray(slot.requiredTagsAll) ? slot.requiredTagsAll : [],
    tag_label: slot.tag_label || slot.tagLabel || "",
  };
}
function alchemyRecipeFamilySlots(recipe) {
  if (!recipe || String(recipe.discipline || "").toLowerCase() !== "alchemy") return null;
  const stored = Array.isArray(recipe.ingredient_slots) ? recipe.ingredient_slots : [];
  if (stored.length) return stored.map(normalizeAlchemySlot);

  const canonicalName = canonicalAlchemyRecipeName(recipe.name || "");
  const guidedFormula = ALCHEMY_BREW_FORMULA_GUIDE[canonicalName] || null;
  if (guidedFormula) {
    const intendedRarity = rarity(recipe.rarity || guidedFormula.rarity || "Common") || "Common";
    const coreSlots = guidedFormula.cores.map((family, idx) => alchemyFamilySlot(
      `${normalizeRecipeNameKey(canonicalName)}_core_${idx + 1}`,
      `Core ingredient ${idx + 1}`,
      family,
      intendedRarity
    ));
    const modifierSlot = normalizeAlchemySlot({
      key: `${normalizeRecipeNameKey(canonicalName)}_modifier`,
      role: guidedFormula.modifier || "Optional fourth-slot twist",
      family: "any",
      slot_type: "modifier",
      required: guidedFormula.modifier_required === true,
      allowed_families: guidedFormula.allowed_families || [],
      required_tags_any: guidedFormula.required_tags_any || [],
      required_tags_all: guidedFormula.required_tags_all || [],
      tag_label: guidedFormula.tag_label || "",
      note: guidedFormula.modifier || "",
    }, 3);
    return [...coreSlots, modifierSlot];
  }

  const key = normalizeRecipeNameKey(recipe.name);
  if (/healing/.test(key)) return ALCHEMY_DYNAMIC_FORMULAS.find((formula) => formula.name === "Healing Potion")?.ingredient_slots.map(normalizeAlchemySlot);
  if (/resistance/.test(key)) return ALCHEMY_DYNAMIC_FORMULAS.find((formula) => formula.name === canonicalName)?.ingredient_slots.map(normalizeAlchemySlot);
  if (/regeneration/.test(key)) return ALCHEMY_DYNAMIC_FORMULAS.find((formula) => formula.name === "Potion of Regeneration")?.ingredient_slots.map(normalizeAlchemySlot);
  const elixirMatch = ABILITY_NAMES.find((ability) => key === `elixir-of-${ability.toLowerCase()}`);
  if (elixirMatch) return abilityElixirSlots(elixirMatch).map(normalizeAlchemySlot);
  const poisonMatch = ABILITY_NAMES.find((ability) => key === `poison-of-${ability.toLowerCase()}-weakening`);
  if (poisonMatch) return abilityPoisonSlots(poisonMatch).map(normalizeAlchemySlot);

  if (/climbing|water-breathing/.test(key)) return [
    alchemyFamilySlot("mobility_leaf", "Movement base", "leaf_vine", "Common"),
    alchemyFamilySlot("mobility_moss", "Adaptive grip", "moss_lichen", "Common"),
    alchemyFamilySlot("mobility_root", "Rooted duration", "root", "Common"),
    normalizeAlchemySlot({ key: "mobility_modifier", role: "Optional movement twist", family: "any", slot_type: "modifier", required: false, allowed_families: ["essence", "enhancer", "monster_fluid"] }, 3),
  ];
  if (/speed|quickstep/.test(key)) return [
    alchemyFamilySlot("speed_leaf", "Speed base", "leaf_vine", "Uncommon"),
    alchemyFamilySlot("speed_flower", "Reflex focus", "flower", "Uncommon"),
    alchemyFamilySlot("speed_sap", "Lingering motion", "sap_resin", "Uncommon"),
    normalizeAlchemySlot({ key: "speed_modifier", role: "Optional speed twist", family: "any", slot_type: "modifier", required: false, allowed_families: ["essence", "enhancer", "monster_fluid"] }, 3),
  ];
  if (/poison|toxin/.test(key)) return [
    alchemyFamilySlot("poison_venom", "Toxic base", "venom_poison", "Common"),
    alchemyFamilySlot("poison_mushroom", "Body vector", "mushroom", "Common"),
    alchemyFamilySlot("poison_root", "Delivery binder", "root", "Common"),
    normalizeAlchemySlot({ key: "poison_modifier", role: "Optional poison twist", family: "any", slot_type: "modifier", required: false, allowed_families: ["monster_fluid", "essence", "enhancer"] }, 3),
  ];
  if (/animal-friendship|love|mind|clairvoyance|comprehension|watchful|night-eye/.test(key)) return [
    alchemyFamilySlot("mind_flower", "Mental / sensory bloom", "flower", "Common"),
    alchemyFamilySlot("mind_mineral", "Clarity anchor", "mineral_salt_ash", "Common"),
    alchemyFamilySlot("mind_root", "Grounding root", "root", "Common"),
    normalizeAlchemySlot({ key: "mind_modifier", role: "Optional mental twist", family: "any", slot_type: "modifier", required: false, allowed_families: ["essence", "enhancer", "monster_fluid"] }, 3),
  ];
  if (/sharpness|oil|barkskin|ironroot|defense|armor/.test(key)) return [
    alchemyFamilySlot("defense_bark", "Physical reinforcement", "thorn_bark_wood", "Common"),
    alchemyFamilySlot("defense_root", "Endurance binder", "root", "Common"),
    alchemyFamilySlot("defense_sap", "Applied coating", "sap_resin", "Common"),
    normalizeAlchemySlot({ key: "defense_modifier", role: "Optional defense twist", family: "any", slot_type: "modifier", required: false, allowed_families: ["essence", "enhancer", "monster_fluid"] }, 3),
  ];
  return [
    alchemyFamilySlot("alchemy_primary", "Primary effect", "mushroom", "Common"),
    alchemyFamilySlot("alchemy_secondary", "Secondary shape", "root", "Common"),
    alchemyFamilySlot("alchemy_catalyst", "Catalyst / binder", "sap_resin", "Common"),
    normalizeAlchemySlot({ key: "alchemy_modifier", role: "Optional enhancer", family: "any", slot_type: "modifier", required: false, allowed_families: ["essence", "enhancer", "monster_fluid", "holy_vital"] }, 3),
  ];
}
function alchemySlotSummary(recipe) {
  const slots = alchemyRecipeFamilySlots(recipe) || [];
  return slots.map((slot) => `${slot.role}: ${slot.family === "any" ? "Any enhancer" : `${slot.family_label || reagentFamilyLabel(slot.family)} (any rarity)`}`).join(" • ");
}
const ALCHEMY_NON_THEME_TAGS = new Set([
  "alchemy", "reagent", "ingredient", "modifier", "catalyst", "enhancer", "essence", "monster part", "monster parts",
  "common", "uncommon", "rare", "very rare", "legendary", "plant", "herb", "crafted product",
  "mushroom", "root", "sap resin", "moss lichen", "flower", "leaf vine", "thorn bark wood", "mineral salt ash", "venom poison plant",
]);
function normalizeAlchemyTag(value = "") {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
function alchemyTagAliasKeys(value = "") {
  const key = normalizeAlchemyTag(value);
  if (!key) return [];
  if (key === "holy" || key === "radiant") return ["holy", "radiant"];
  return [key];
}
function displayAlchemyTag(value = "") {
  const clean = normalizeAlchemyTag(value);
  const labels = { blinded: "Blindness", charmed: "Charm", confused: "Confusion", deafened: "Deafness", frightened: "Fear", paralyzed: "Paralysis", petrified: "Petrification", poisoned: "Poison", restrained: "Restraint", stunned: "Stunning", cold: "Cold", fire: "Fire", acid: "Acid", force: "Force", lightning: "Lightning", necrotic: "Necrotic", psychic: "Psychic", radiant: "Radiant", thunder: "Thunder", mind: "Mind", sight: "Sight", sound: "Sound", nerve: "Nerve", stone: "Stone", binding: "Binding", venom: "Venom", fey: "Fey", holy: "Radiant", infernal: "Infernal", death: "Death", shadow: "Shadow", vitality: "Vitality", phase: "Phase", dragon: "Dragon" };
  return labels[clean] || titleCase(clean);
}
function alchemyBrewTags(material = {}) {
  const profile = materialAlchemyProfile(material);
  const payload = material?.raw?.card_payload && typeof material.raw.card_payload === "object" ? material.raw.card_payload : {};
  const payload2 = material?.raw?.payload && typeof material.raw.payload === "object" ? material.raw.payload : {};
  const bonuses = normalizeAlchemyBonuses(profile.bonuses || profile.attributes || {});
  const rawTags = [
    ...(Array.isArray(profile.brewTags) ? profile.brewTags : []),
    ...(Array.isArray(profile.brew_tags) ? profile.brew_tags : []),
    ...(Array.isArray(profile.tags) ? profile.tags : []),
    ...(Array.isArray(material.tags) ? material.tags : []),
    ...(Array.isArray(material.raw?.tags) ? material.raw.tags : []),
    ...(Array.isArray(payload.tags) ? payload.tags : []),
    ...(Array.isArray(payload2.tags) ? payload2.tags : []),
    bonuses.typeDirection,
    bonuses.conditionRider,
    bonuses.conditionCure,
  ].filter(Boolean);
  const out = [];
  const seen = new Set();
  rawTags.forEach((value) => {
    const display = displayAlchemyTag(value);
    const key = normalizeAlchemyTag(display);
    if (!key || key.startsWith("alchemy codex") || ALCHEMY_NON_THEME_TAGS.has(key) || seen.has(key)) return;
    seen.add(key);
    out.push(display);
  });
  return out;
}
function materialMatchesAlchemyTags(material = {}, slot = {}) {
  const anyTags = Array.isArray(slot.required_tags_any) ? slot.required_tags_any : Array.isArray(slot.requiredTagsAny) ? slot.requiredTagsAny : [];
  const allTags = Array.isArray(slot.required_tags_all) ? slot.required_tags_all : Array.isArray(slot.requiredTagsAll) ? slot.requiredTagsAll : [];
  if (!anyTags.length && !allTags.length) return true;
  const available = new Set(alchemyBrewTags(material).flatMap(alchemyTagAliasKeys));
  const anyOk = !anyTags.length || anyTags.some((tagValue) => alchemyTagAliasKeys(tagValue).some((key) => available.has(key)));
  const allOk = !allTags.length || allTags.every((tagValue) => alchemyTagAliasKeys(tagValue).some((key) => available.has(key)));
  return anyOk && allOk;
}

function materialMeetsAlchemySlot(material, slot = {}) {
  if (!material || !slot) return false;
  const alchemyKind = String(materialAlchemyProfile(material)?.kind || "").toLowerCase();
  if (alchemyKind && !["ingredient", "modifier", "reagent", "catalyst"].includes(alchemyKind)) return false;
  if (/\b(potion|elixir|poison|bomb|oil)\b/i.test(String(material.type || material.category || "")) && alchemyKind === "crafted_product") return false;
  const family = inferReagentFamily(material);
  const allowed = Array.isArray(slot.allowed_families) ? slot.allowed_families.map(normalizeReagentFamily).filter(Boolean) : [];
  if (slot.family === "any" || slot.slot_type === "modifier") {
    if (!materialMatchesAlchemyTags(material, slot)) return false;
    const hasTagRule = (slot.required_tags_any || slot.requiredTagsAny || []).length || (slot.required_tags_all || slot.requiredTagsAll || []).length;
    // A tag-directed slot may also require a specific ingredient family. Heroism, for
    // example, requires both the Radiant tag and the Holy Component family.
    if (hasTagRule && allowed.length) return allowed.includes(family);
    if (hasTagRule) return true;
    if (allowed.length) return allowed.includes(family);
    return ["essence", "enhancer", "holy_vital", "monster_fluid", "mineral_salt_ash", "venom_poison"].includes(family) || materialMatchesCategory(material, "Misc") || /catalyst|reagent|essence|monster|gland|mote|blood|bile|ichor|mucus/i.test([material.category, material.type, material.name].filter(Boolean).join(" "));
  }
  if (slot.family && family !== slot.family) return false;
  return true;
}
function materialAlchemyTraits(material = {}) {
  const profile = materialAlchemyProfile(material);
  const payload = material.raw?.card_payload || material.raw?.payload || {};
  const positive = material.positive_effects || material.raw?.positive_effects || material.raw?.plants?.positive_effects || payload.positive_effects || profile.positiveEffects || profile.positive_effects || [];
  const negative = material.negative_effects || material.raw?.negative_effects || material.raw?.plants?.negative_effects || payload.negative_effects || profile.negativeEffects || profile.negative_effects || [];
  const pos = Array.isArray(positive) ? positive : String(positive || "").split(/[|,]/).map((v) => v.trim()).filter(Boolean);
  const neg = Array.isArray(negative) ? negative : String(negative || "").split(/[|,]/).map((v) => v.trim()).filter(Boolean);
  return { positive: pos, negative: neg };
}
function rarityClassName(value = "Common") {
  return `rarity-${String(rarity(value || "Common") || "common").toLowerCase().replace(/\s+/g, "-")}`;
}
function materialAlchemyProfile(material = {}) {
  const payload = material?.raw?.card_payload && typeof material.raw.card_payload === "object" ? material.raw.card_payload : {};
  const payload2 = material?.raw?.payload && typeof material.raw.payload === "object" ? material.raw.payload : {};
  const direct = material?.alchemy && typeof material.alchemy === "object" ? material.alchemy : null;
  const fromPayload = payload.alchemy && typeof payload.alchemy === "object" ? payload.alchemy : null;
  const fromPayload2 = payload2.alchemy && typeof payload2.alchemy === "object" ? payload2.alchemy : null;
  return direct || fromPayload || fromPayload2 || {};
}
function normalizeAlchemyBonuses(value = {}) {
  const src = value && typeof value === "object" ? value : {};
  return {
    effectPct: Number(src.effectPct || src.effect_pct || 0) || 0,
    durationPct: Number(src.durationPct || src.duration_pct || 0) || 0,
    areaPct: Number(src.areaPct || src.area_pct || src.rangePct || src.range_pct || 0) || 0,
    extraDoses: Number(src.extraDoses || src.extra_doses || src.batchBoost || src.batch_boost || 0) || 0,
    saveDcBonus: Number(src.saveDcBonus || src.save_dc_bonus || src.saveBoost || src.save_boost || 0) || 0,
    dieSteps: Number(src.dieSteps || src.die_steps || 0) || Math.max(
      Number(src.healingDiceSteps || src.healing_dice_steps || 0) || 0,
      Number(src.damageDiceSteps || src.damage_dice_steps || 0) || 0,
      Number(src.statBuffDiceSteps || src.stat_buff_dice_steps || 0) || 0,
      Number(src.statDamageDiceSteps || src.stat_damage_dice_steps || 0) || 0
    ),
    typeDirection: src.typeDirection || src.type_direction || src.resistanceType || src.damageType || "",
    conditionRider: src.conditionRider || src.condition_rider || "",
    conditionSave: src.conditionSave || src.condition_save || "",
    conditionDuration: src.conditionDuration || src.condition_duration || "",
    conditionRepeat: src.conditionRepeat || src.condition_repeat || "",
    conditionCure: src.conditionCure || src.condition_cure || "",
    brewRarityFloor: src.brewRarityFloor || src.brew_rarity_floor || "",
    riderEligibleSections: Array.isArray(src.riderEligibleSections || src.rider_eligible_sections) ? (src.riderEligibleSections || src.rider_eligible_sections) : [],
    cureEligibleSections: Array.isArray(src.cureEligibleSections || src.cure_eligible_sections) ? (src.cureEligibleSections || src.cure_eligible_sections) : [],
    craftDcReduction: Number(src.craftDcReduction || src.craft_dc_reduction || 0) || 0,
  };
}
function alchemyVariantBucket(seed = "", count = 3) {
  const text = String(seed || "");
  if (!count) return 0;
  let total = 0;
  for (let i = 0; i < text.length; i += 1) total = (total + text.charCodeAt(i) * (i + 3)) % 9973;
  return Math.abs(total) % count;
}
function pickAlchemyBonus(seed, options = [{}]) {
  if (!options.length) return {};
  return options[alchemyVariantBucket(seed, options.length)] || options[0] || {};
}

function alchemyNameCue(material = {}) {
  const profile = materialAlchemyProfile(material);
  const traits = materialAlchemyTraits(material).positive || [];
  return [
    material?.name,
    material?.notes,
    material?.description,
    material?.raw?.item_description,
    profile.physicalDescription,
    profile.physical_description,
    ...(Array.isArray(traits) ? traits : []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function alchemyFamilyRarityDefaultBonuses(family, quality, material = {}, recipe = {}) {
  const q = rarity(quality || "Common") || "Common";
  const f = normalizeReagentFamily(family);
  const text = alchemyNameCue(material);
  const intent = alchemyRecipeIntent(recipe);
  const v6Profiles = ALCHEMY_FAMILY_FALLBACK_PROFILES_V6?.[f]?.[q] || null;
  if (Array.isArray(v6Profiles) && v6Profiles.length) {
    return pickAlchemyBonus(`${material?.name || material?.id || f}:${q}`, v6Profiles);
  }

  // Legacy fallback below remains for modifier families and older uncatalogued rows.
  // Core families return through the v6 profile table above.
  // These tables intentionally follow the agreed rarity budgets instead of
  // pseudo-randomly assigning attributes. Common ingredients contribute one 25% family-aligned bonus and satisfy the
  // family requirement. Uncommon ingredients spend three 25% units or one +1 flat plus one 25% unit.
  // Rare ingredients spend four 25% units or +1 plus two 25% units. Very Rare
  // ingredients spend five 25% units, +2 plus three 25% units, +3 plus one 25% unit, or Die step +1 plus one 25% unit.
  if (q === "Common" || q === "Mundane" || q === "Varies") return {};

  if (f === "mushroom") {
    if (q === "Uncommon") {
      if (/cluster|puff|bloom|twin|split|many|dose|spore/.test(text)) return { extraDoses: 1 };
      if (/veil|ghost|moon|milk|mist|linger/.test(text)) return { effectPct: 25, durationPct: 25 };
      return { effectPct: 50 };
    }
    if (q === "Rare") {
      if (/twin|bloom|cluster|many|dose/.test(text)) return { effectPct: 50, extraDoses: 1 };
      if (/ichor|toxic|mold|venom|night|spore|cloud/.test(text)) return { effectPct: 25, saveDcBonus: 1 };
      if (/moon|mist|veil|slow|linger/.test(text)) return { effectPct: 25, durationPct: 50 };
      return { effectPct: 75 };
    }
    if (q === "Very Rare" || q === "Legendary") {
      if (/saint|holy|veil|chapel|mend|heal/.test(text) || intent === "healing") return { dieSteps: 1 };
      if (/queen|ichor|worm|venom|toxic|black/.test(text)) return { effectPct: 50, saveDcBonus: 2 };
      if (/cluster|spore|dose|many/.test(text)) return { effectPct: 50, extraDoses: 2 };
      if (/phoenix|sun|ember|burn|fire/.test(text)) return { effectPct: 75, durationPct: 25 };
      return { effectPct: 100 };
    }
  }

  if (f === "root") {
    if (q === "Uncommon") {
      if (/red|heart|mend|heal|blood/.test(text)) return { effectPct: 25, durationPct: 25 };
      if (/cluster|bundle|many|dose/.test(text)) return { extraDoses: 1 };
      return { durationPct: 50 };
    }
    if (q === "Rare") {
      if (/cluster|bundle|many|dose/.test(text)) return { durationPct: 50, extraDoses: 1 };
      if (/heart|blood|red|mend/.test(text)) return { effectPct: 50, durationPct: 25 };
      return { durationPct: 75 };
    }
    if (q === "Very Rare" || q === "Legendary") {
      if (/titan|giant|strength|might/.test(text) || intent === "stat-buff") return { dieSteps: 1 };
      if (/world|holy|heart|mend|heal/.test(text) || intent === "healing") return { dieSteps: 1 };
      if (/cluster|bundle|many|dose/.test(text)) return { extraDoses: 3 };
      return { durationPct: 100 };
    }
  }

  if (f === "sap_resin") {
    if (q === "Uncommon") {
      if (/glass|clear|gum|bright/.test(text)) return { effectPct: 25, durationPct: 25 };
      if (/dose|distill|amber beads/.test(text)) return { extraDoses: 1 };
      return { durationPct: 50 };
    }
    if (q === "Rare") {
      if (/aether|glass|phase|silver/.test(text)) return { effectPct: 25, durationPct: 50 };
      if (/dose|distill|bundle/.test(text)) return { durationPct: 50, extraDoses: 1 };
      return { durationPct: 75 };
    }
    if (q === "Very Rare" || q === "Legendary") {
      if (/first|elder|ancient|myrrh/.test(text)) return { effectPct: 50, durationPct: 50 };
      return { durationPct: 100 };
    }
  }

  if (f === "moss_lichen") {
    if (q === "Uncommon") {
      if (/cliff|grip|crawl|climb/.test(text)) return { effectPct: 25, durationPct: 25 };
      if (/colony|mat|spread|dose/.test(text)) return { extraDoses: 1 };
      return { durationPct: 50 };
    }
    if (q === "Rare") {
      if (/diamond|vein|ward|armor|resist/.test(text)) return { effectPct: 50, durationPct: 25 };
      if (/spore|mist|cloud|aura|spread/.test(text)) return { areaPct: 25, durationPct: 50 };
      return { durationPct: 75 };
    }
    if (q === "Very Rare" || q === "Legendary") {
      if (/age|glass|colony|dose/.test(text)) return { effectPct: 50, extraDoses: 2 };
      if (/star|moon|deep|time/.test(text)) return { durationPct: 100 };
      return { effectPct: 100 };
    }
  }

  if (f === "flower") {
    if (q === "Uncommon") {
      if (/dream|sleep|charm|lotus|orchid|fey/.test(text)) return { saveDcBonus: 1 };
      if (/pollen|cloud|mist|fragrance/.test(text)) return { areaPct: 50 };
      return { effectPct: 25, durationPct: 25 };
    }
    if (q === "Rare") {
      if (/dream|sleep|charm|fey|orchid/.test(text)) return { saveDcBonus: 1, effectPct: 25 };
      if (/thunder|bell|pollen|cloud|fragrance/.test(text)) return { effectPct: 50, areaPct: 25 };
      return { durationPct: 50, saveDcBonus: 1 };
    }
    if (q === "Very Rare" || q === "Legendary") {
      if (/queen|dream|lotus|fey|sleep|charm/.test(text)) return { saveDcBonus: 3 };
      if (/halo|sun|radiant|holy/.test(text)) return { saveDcBonus: 2, effectPct: 50 };
      return { effectPct: 50, areaPct: 50 };
    }
  }

  if (f === "leaf_vine") {
    if (q === "Uncommon") {
      if (/swift|quick|speed|green/.test(text)) return { effectPct: 50 };
      if (/grip|climb|vine/.test(text)) return { effectPct: 25, areaPct: 25 };
      return { durationPct: 50 };
    }
    if (q === "Rare") {
      if (/sky|reach|long|high/.test(text)) return { durationPct: 75 };
      if (/vine|tendril|spread|range/.test(text)) return { areaPct: 25, durationPct: 50 };
      return { effectPct: 50, durationPct: 25 };
    }
    if (q === "Very Rare" || q === "Legendary") {
      if (/worldvine|tendril|world|dex|grace/.test(text) || intent === "stat-buff") return { dieSteps: 1 };
      if (/thunder|step|speed/.test(text)) return { effectPct: 50, durationPct: 50 };
      return { durationPct: 100 };
    }
  }

  if (f === "thorn_bark_wood") {
    if (q === "Uncommon") {
      if (/briar|thorn|spike/.test(text)) return { durationPct: 50 };
      if (/red|blood|thorn/.test(text)) return { effectPct: 25, durationPct: 25 };
      return { effectPct: 50 };
    }
    if (q === "Rare") {
      if (/blood|thorn|barb|restraint/.test(text)) return { effectPct: 25, saveDcBonus: 1 };
      if (/bundle|many|dose/.test(text)) return { effectPct: 25, extraDoses: 1 };
      return { effectPct: 50, durationPct: 25 };
    }
    if (q === "Very Rare" || q === "Legendary") {
      if (/crown|thorn|barb/.test(text)) return { effectPct: 50, saveDcBonus: 2 };
      if (/elder|iron|heart/.test(text)) return { effectPct: 50, durationPct: 50 };
      return { effectPct: 100 };
    }
  }

  if (f === "mineral_salt_ash") {
    if (q === "Uncommon") {
      if (/charcoal|ash|dose|salt/.test(text)) return { extraDoses: 1 };
      if (/clear|pure|spring/.test(text)) return { effectPct: 25, durationPct: 25 };
      return { durationPct: 50 };
    }
    if (q === "Rare") {
      if (/grave|necrotic|death/.test(text)) return { saveDcBonus: 1, durationPct: 25, typeDirection: "necrotic" };
      if (/diamond|dust|salt|dose/.test(text)) return { durationPct: 50, extraDoses: 1 };
      return { effectPct: 50, durationPct: 25 };
    }
    if (q === "Very Rare" || q === "Legendary") {
      if (/prismatic|many|dose/.test(text)) return { extraDoses: 3 };
      if (/star|fall|astral/.test(text)) return { durationPct: 50, saveDcBonus: 2 };
      return { durationPct: 100 };
    }
  }

  if (f === "venom_poison") {
    if (q === "Uncommon") {
      if (/widow|shade|sleep|weak|paralysis/.test(text)) return { saveDcBonus: 1 };
      if (/slow|linger/.test(text)) return { durationPct: 50 };
      return { effectPct: 50 };
    }
    if (q === "Rare") {
      if (/ichor|worm|venom|damage/.test(text)) return { effectPct: 75 };
      if (/night|fang|shade|sleep|weak/.test(text)) return { effectPct: 25, saveDcBonus: 1 };
      return { effectPct: 75 };
    }
    if (q === "Very Rare" || q === "Legendary") {
      if (/queen|wormwood|widow|shade/.test(text)) return { effectPct: 50, saveDcBonus: 2 };
      if (/black|lotus|venom/.test(text)) return { effectPct: 100 };
      return { dieSteps: 1 };
    }
  }

  if (f === "essence") {
    const typeDirection = alchemyElementFromMaterials([material], recipe);
    return { typeDirection: typeDirection === "chosen" ? "" : typeDirection, ...(q === "Rare" || q === "Very Rare" || q === "Legendary" ? { saveDcBonus: 1 } : {}) };
  }

  if (f === "enhancer") {
    if (/pure|catalyst|dc/.test(text)) return { craftDcReduction: 4 };
    if (/distill|dose/.test(text)) return { extraDoses: 1 };
    if (/binding|duration/.test(text)) return { durationPct: 50 };
    if (/volatile|damage/.test(text)) return { dieSteps: 1 };
    return { effectPct: 50 };
  }

  if (f === "holy_vital") return { dieSteps: q === "Very Rare" || q === "Legendary" ? 2 : 1 };

  if (f === "monster_fluid") {
    const typeDirection = alchemyElementFromMaterials([material], recipe);
    if (/troll/.test(text)) return { conditionRider: "regeneration twist", effectPct: 25 };
    if (/wyvern|venom/.test(text)) return { typeDirection: "poison", saveDcBonus: 1, dieSteps: 1 };
    if (/basilisk|bile/.test(text)) return { conditionRider: "slowed or restrained", saveDcBonus: 1 };
    if (/ghoul/.test(text)) return { conditionRider: "paralysis rider", saveDcBonus: 1 };
    if (/phase/.test(text)) return { conditionRider: "phase displacement", durationPct: 50 };
    return { typeDirection: typeDirection === "chosen" ? "" : typeDirection, effectPct: 50 };
  }

  return {};
}

function defaultAlchemyBonusesFor(family, quality, recipe = {}, slot = {}, material = {}) {
  return alchemyFamilyRarityDefaultBonuses(family, quality, material, recipe);
}
function alchemyAggregateStats(materials = [], recipe = {}) {
  return (materials || []).reduce((acc, material) => {
    const stats = alchemyIngredientMetricSummary(material, { ...recipe, discipline: "Alchemy" }, material);
    ["effectPct", "durationPct", "areaPct", "extraDoses", "saveDcBonus", "dieSteps", "craftDcReduction"].forEach((key) => {
      acc[key] = Number(acc[key] || 0) + Number(stats[key] || 0);
    });
    if (stats.typeDirection && stats.typeDirection !== "chosen") acc.typeDirection = stats.typeDirection;
    return acc;
  }, {});
}
function alchemyRecipeIntent(recipe = {}) {
  const key = normalizeRecipeNameKey(recipe?.name || "");
  const text = [recipe?.name, recipe?.summary, recipe?.effect, recipe?.effect_detail, recipe?.kind, recipe?.category].filter(Boolean).join(" ").toLowerCase();
  if (/elixir-of-x-immunity|immunity/.test(key)) return "immunity";
  if (/elixir-of-/.test(key)) return "stat-buff";
  if (/poison-of-.*-weakening/.test(key)) return "stat-damage";
  if (/healing|heal|draught|salve|regeneration|restore|restorative/.test(`${key} ${text}`)) return "healing";
  if (/resistance|invulnerability|ward|defense|defensive|protection|antitoxin/.test(`${key} ${text}`)) return "resistance";
  if (/poison|toxin|venom|purple-worm/.test(`${key} ${text}`)) return "poison";
  if (/fire-breath|flame|fire|bomb|acid|caustic/.test(`${key} ${text}`)) return "damage";
  if (/speed|quickstep|haste|climbing|water-breathing|flying|gaseous|invisibility|ethereal/.test(`${key} ${text}`)) return "mobility";
  if (/growth|giant|diminution|size|strength/.test(`${key} ${text}`)) return "growth";
  if (/animal-friendship|love|charm|philter|sleep/.test(`${key} ${text}`)) return "charm";
  if (/mind|clairvoyance|comprehension|watchful|night-eye|divination|sense|vision/.test(`${key} ${text}`)) return "senses";
  if (/sharpness|oil|coating/.test(`${key} ${text}`)) return "oil";
  if (/dragon/.test(`${key} ${text}`)) return "dragon";
  return "general";
}
function alchemyIngredientMetricSummary(material = {}, recipe = {}, slot = {}) {
  const profile = materialAlchemyProfile(material);
  const family = inferReagentFamily(material) || normalizeReagentFamily(slot?.family) || "reagent";
  const quality = rarity(profile.rarity || material?.rarity || "Common") || "Common";
  const potency = alchemyMaterialPotency(material);
  const required = reagentPotencyRank(slot?.min_rarity || material?.slot_min_rarity || "Common");
  const surplus = Math.max(0, potency - required);
  const intent = alchemyRecipeIntent(recipe);
  const slotType = slot?.slot_type || slot?.slotType || (slot?.family === "any" ? "modifier" : "core");
  const traits = materialAlchemyTraits(material);
  const explicitBonuses = normalizeAlchemyBonuses(profile.bonuses || profile.attributes || {});
  const defaultBonuses = normalizeAlchemyBonuses(defaultAlchemyBonusesFor(family, quality, recipe, slot, material));
  const hasExplicitBonuses = Object.prototype.hasOwnProperty.call(profile, "bonuses") || Object.prototype.hasOwnProperty.call(profile, "attributes");
  const bonuses = hasExplicitBonuses ? explicitBonuses : defaultBonuses;
  const baseCoreReduction = slotType === "modifier" || slot?.family === "any" ? 0 : alchemyCraftDcReductionForRarity(quality);
  const coreReduction = slotType === "modifier" || slot?.family === "any"
    ? 0
    : alchemyCraftDcReductionForRecipe(quality, recipe?.rarity || "Common", slotType);
  const craftDcReduction = Math.max(0, Number(bonuses.craftDcReduction || 0) + coreReduction);
  return {
    family,
    familyLabel: reagentFamilyLabel(family),
    potency,
    required,
    surplus,
    intent,
    slotType,
    quality,
    craftDcReduction,
    baseCraftDcReduction: baseCoreReduction,
    dcReductionDiminished: baseCoreReduction > coreReduction,
    effectPct: Number(bonuses.effectPct || 0),
    durationPct: Number(bonuses.durationPct || 0),
    areaPct: Number(bonuses.areaPct || 0),
    extraDoses: Number(bonuses.extraDoses || 0),
    saveDcBonus: Number(bonuses.saveDcBonus || 0),
    dieSteps: Number(bonuses.dieSteps || 0),
    typeDirection: bonuses.typeDirection || "",
    conditionRider: bonuses.conditionRider || "",
    conditionSave: bonuses.conditionSave || "",
    conditionDuration: bonuses.conditionDuration || "",
    conditionRepeat: bonuses.conditionRepeat || "",
    conditionCure: bonuses.conditionCure || "",
    brewRarityFloor: bonuses.brewRarityFloor || "",
    riderEligibleSections: bonuses.riderEligibleSections || [],
    cureEligibleSections: bonuses.cureEligibleSections || [],
    // Compatibility fields used by existing rendering/planning code.
    potencyBoost: Math.round(Number(bonuses.effectPct || 0) / 25),
    durationBoost: Math.round(Number(bonuses.durationPct || 0) / 25),
    batchBoost: Number(bonuses.extraDoses || 0),
    saveBoost: Number(bonuses.saveDcBonus || 0),
    stabilityBoost: 0,
    risk: 0,
    traits,
  };
}
function alchemyPercent(value, perStep = 25) {
  return Math.max(0, Number(value || 0)) * perStep;
}
function pluralStep(label, count) {
  const n = Number(count || 0);
  if (!n) return "";
  return `${label} +${n} ${n === 1 ? "step" : "steps"}`;
}
function alchemyReadableContributionChips(stats = {}, quality = "Common") {
  // Keep player-facing brew chips focused on what changes the formula.
  // Rarity and family are already shown in the reagent card header.
  return [
    stats.craftDcReduction ? `Craft DC -${stats.craftDcReduction}` : null,
    stats.effectPct ? `Effect +${stats.effectPct}%` : null,
    stats.durationPct ? `Duration +${stats.durationPct}%` : null,
    stats.areaPct ? `Area / Range +${stats.areaPct}%` : null,
    stats.extraDoses ? `+${stats.extraDoses} ${stats.extraDoses === 1 ? "extra dose" : "extra doses"}` : null,
    stats.saveDcBonus ? `Save DC +${stats.saveDcBonus}` : null,
    stats.dieSteps ? `Die step +${stats.dieSteps}` : null,
    stats.typeDirection ? `Sets type: ${readableDamageType(stats.typeDirection)}` : null,
  ].filter(Boolean);
}
function alchemyReadableContributionLines(stats = {}, quality = "Common", traits = { positive: [], negative: [] }) {
  const lines = [];
  if (stats.craftDcReduction) lines.push(`Craft difficulty: lowers the final Craft DC by ${stats.craftDcReduction}${stats.slotType === "modifier" ? " from this special fourth-slot component" : " from ingredient rarity"}.`);
  if (stats.effectPct) lines.push(`Effect strength: percentage bonuses add whole effect dice whenever the base roll supports them. For example, +50% changes 2d4 + 2 to 3d4 + 3, while +25% changes 4d4 + 4 to 5d4 + 5. Any fraction too small to create a whole die remains banked.`);
  if (stats.durationPct) lines.push(`Duration: percentage bonuses add whole duration dice whenever possible. Fixed durations still increase by the listed percentage, and any unused fraction on a rollable duration remains banked.`);
  if (stats.areaPct) lines.push(`Area / range: +${stats.areaPct}% to splash, fumes, clouds, thrown alchemy, or aura-style formulas.`);
  if (stats.extraDoses) lines.push(`Batch output: creates ${stats.extraDoses} extra ${stats.extraDoses === 1 ? "dose" : "doses"} if the attempt succeeds.`);
  if (stats.saveDcBonus) lines.push(`Save DC: +${stats.saveDcBonus} to formulas that force a saving throw.`);
  if (stats.dieSteps) lines.push(`Die step: upgrades effect dice and promotes duration units by ${stats.dieSteps} ${stats.dieSteps === 1 ? "step" : "steps"} before percentage bonuses apply.`);
  if (stats.typeDirection) lines.push(`Type direction: sets the relevant damage, resistance, or elemental type to ${readableDamageType(stats.typeDirection)}.`);
  if (!lines.length && (quality === "Common" || quality === "Mundane")) lines.push("Common ingredients satisfy the recipe family requirement and contribute one 25% family-aligned bonus.");
  if (traits.positive.length) lines.push(`Named benefits: ${traits.positive.slice(0, 3).join(", ")}.`);
  return lines;
}
function alchemyIngredientImpactSummary(material = {}, recipe = {}, slot = {}) {
  const stats = alchemyIngredientMetricSummary(material, recipe, slot);
  const element = stats.typeDirection || alchemyElementFromMaterials([material], recipe);
  const name = material?.name || "Selected ingredient";
  const family = stats.family;
  const intent = stats.intent;
  const quality = rarity(material?.rarity || "Common") || "Common";
  const traits = materialAlchemyTraits(material);
  let effectName = `${stats.familyLabel} Modifier`;
  let summary = `${name} adds ${stats.familyLabel.toLowerCase()} character to the brew.`;
  let short = "Broad alchemical support.";

  if (family === "mushroom") {
    effectName = intent === "poison" ? "Fungal Body Toxin" : "Mending Mushroom";
    short = intent === "healing" ? "Boosts healing/body repair." : "Shapes body effects: healing, toxin, regeneration, or transformation.";
    summary = `${name} is a body-changing reagent. It is strongest for healing, regeneration, adaptation, and poisons that attack flesh.`;
  } else if (family === "root") {
    effectName = "Endurance Root";
    short = "Adds duration, endurance, and costly universal die-step potential.";
    summary = `${name} grounds the formula. Roots are major duration sources, and exceptional roots can upgrade the formula's primary die.`;
  } else if (family === "sap_resin") {
    effectName = "Binding Sap / Resin";
    short = "Extends duration and supports oils/salves.";
    summary = `${name} binds the formula together, making the brew last longer or apply more cleanly as an oil, coating, or long-duration potion.`;
  } else if (family === "moss_lichen") {
    effectName = "Adaptive Moss / Lichen";
    short = "Supports resistance, survival, and adaptation.";
    summary = `${name} helps the drinker adapt to hostile environments. It is a major duration source for resistance and survival formulas.`;
  } else if (family === "flower") {
    effectName = "Mental / Sensory Bloom";
    short = "Improves Save DC, senses, charm, or sleep effects.";
    summary = `${name} adds emotional, mental, sensory, or fey pressure. Flowers are major Save DC sources for charm, sleep, and mind formulas.`;
  } else if (family === "leaf_vine") {
    effectName = "Mobility Leaf / Vine";
    short = "Supports movement, speed, climbing, and ability buffs.";
    summary = `${name} carries motion and flexibility. It is strongest in Dexterity, speed, climbing, jumping, breath, and mobility formulas.`;
  } else if (family === "thorn_bark_wood") {
    effectName = "Reinforcing Thorn / Bark";
    short = "Strengthens defensive and physical body brews.";
    summary = `${name} hardens the body or surface of the brew. It supports armor, barkskin, thorns, Strength, Constitution, and restraint formulas.`;
  } else if (family === "mineral_salt_ash") {
    effectName = "Mineral Anchor";
    short = "Improves duration, batch output, binding, and purification.";
    summary = `${name} anchors the mixture. Minerals, salts, and ashes are strong for extra doses, purification, warding, and resistance formulas.`;
  } else if (family === "venom_poison") {
    effectName = "Toxic Vector";
    short = "Improves Save DC, stat damage, and poison strength.";
    summary = `${name} drives toxic force. It is strongest in poisons, stat-damage formulas, sleep drafts, paralysis, and weakening mixtures.`;
  } else if (family === "essence") {
    effectName = "Directed Essence";
    short = element && element !== "chosen" ? `Sets ${readableDamageType(element)} direction.` : "Sets elemental or planar direction.";
    summary = element && element !== "chosen"
      ? `${name} sets the brew's ${readableDamageType(element)} direction. In resistance potions, it determines the resisted damage type; in offensive formulas, it colors damage or save effects.`
      : `${name} gives the formula a clear elemental, divine, planar, or arcane direction.`;
  } else if (family === "enhancer") {
    effectName = "Technical Enhancer";
    short = "Fourth-slot control: dice, output, duration, or Craft DC.";
    summary = `${name} is a controlled crafting component. Enhancers can improve dice, output, duration, effect strength, or occasionally reduce Craft DC.`;
  } else if (family === "holy_vital") {
    effectName = "Holy / Vital Component";
    short = "Improves the formula's primary die before percent bonuses.";
    summary = `${name} channels concentrated restorative force. Its universal die-step upgrade applies before selected herbs multiply the result.`;
  } else if (family === "monster_fluid") {
    effectName = "Monster Part";
    short = "Adds a neutral elemental, condition, or creature theme tag.";
    summary = `${name} is a harvested creature component. Its visible tags determine which fourth-slot recipe pickers can use it; the recipe decides what those tags do.`;
  }

  const chips = alchemyReadableContributionChips(stats, quality);
  const detailLines = alchemyReadableContributionLines(stats, quality, traits);

  return {
    ...stats,
    effectName,
    short,
    effectSummary: summary,
    riskSummary: "",
    chips,
    detailLines,
    rarityClass: rarityClassName(quality),
    dcModifier: -Number(stats.craftDcReduction || 0),
  };
}
function alchemyMaterialSpecificEffect(material = {}, recipe = {}) {
  const profile = alchemyIngredientImpactSummary(material, recipe, material);
  return {
    name: profile.effectName,
    dc_modifier: profile.dcModifier,
    effect_summary: profile.effectSummary,
    risk_summary: "",
    contribution_chips: profile.chips,
    contribution_lines: profile.detailLines,
    family_label: profile.familyLabel,
    family_key: profile.family,
    potency_rank: profile.potency,
    rarity_class: profile.rarityClass,
    short_summary: profile.short,
    potency_boost: profile.potencyBoost,
    duration_boost: profile.durationBoost,
    batch_boost: profile.batchBoost,
    save_boost: profile.saveBoost,
    stability_boost: 0,
    risk_score: 0,
    effect_pct: profile.effectPct,
    duration_pct: profile.durationPct,
    area_pct: profile.areaPct,
    extra_doses: profile.extraDoses,
    save_dc_bonus: profile.saveDcBonus,
    die_steps: profile.dieSteps,
    type_direction: profile.typeDirection,
    brew_tags: alchemyBrewTags(material),
    craft_dc_reduction: profile.craftDcReduction,
  };
}
function alchemyFormulaDetails(recipe) {
  if (!recipe || recipe.discipline !== "Alchemy") return null;
  const namedDetail = alchemyDetailForName(recipe.name) || {};
  const storedDetail = recipe.alchemy_details || {};
  const detail = {
    ...namedDetail,
    ...storedDetail,
    use: storedDetail.use || namedDetail.use || null,
    duration: storedDetail.duration || namedDetail.duration || null,
    effect: storedDetail.effect || namedDetail.effect || null,
  };
  const numeric = alchemyNumericProfile(recipe, detail);
  return {
    use: ALCHEMY_STANDARD_USE,
    duration: formatAlchemyDuration(numeric, 0, 0, detail.duration || recipe.duration || "Until used"),
    effect: detail.effect || recipe.effect_detail || recipe.summary || "Crafted alchemical effect by DM ruling.",
    section: numeric.section,
    base_duration_seconds: numeric.base_duration_seconds,
    base_duration_dice_count: numeric.base_duration_dice_count,
    base_duration_die_size: numeric.base_duration_die_size,
    base_duration_unit: numeric.base_duration_unit,
    base_duration_text: numeric.base_duration_text,
    base_dice_count: numeric.base_dice_count,
    base_die_size: numeric.base_die_size,
    base_flat_bonus: numeric.base_flat_bonus,
    base_uses: numeric.base_uses,
    dice_purpose: numeric.dice_purpose,
    effect_cadence: numeric.effect_cadence,
    tags: recipe.formula_tags || [],
    requiredTags: recipe.required_tags || recipe.requiredTags || [],
    secondaryTags: recipe.secondary_tags || recipe.secondaryTags || [],
    enhancerTags: recipe.enhancer_tags || recipe.enhancerTags || [],
    dc: Math.max(Number(recipe.base_dc || recipe.dc || 0) || 0, alchemyBaseDcByRarity(recipe.rarity || "Common")),
  };
}

function alchemyElementFromMaterials(materials = [], recipe) {
  const explicit = (materials || []).map((material) => {
    const profile = materialAlchemyProfile(material);
    const bonuses = normalizeAlchemyBonuses(profile.bonuses || profile.attributes || {});
    return bonuses.typeDirection || profile.typeDirection || profile.type_direction || "";
  }).find(Boolean);
  if (explicit) return String(explicit).toLowerCase();
  const text = [recipe?.name, recipe?.summary, ...materials.map((material) => [material.name, material.notes, material.source, ...(material.tags || [])].filter(Boolean).join(" "))].join(" ").toLowerCase();
  if (/fire|flame|ember|sun/.test(text)) return "fire";
  if (/frost|cold|ice|winter/.test(text)) return "cold";
  if (/lightning|storm|spark/.test(text)) return "lightning";
  if (/thunder|sonic/.test(text)) return "thunder";
  if (/acid|caustic|alkali|corrosive/.test(text)) return "acid";
  if (/poison|venom|toxin/.test(text)) return "poison";
  if (/radiant|holy|celestial/.test(text)) return "radiant";
  if (/shadow|necrotic|grave|death/.test(text)) return "necrotic";
  if (/psychic|mind|dream/.test(text)) return "psychic";
  if (/force|arcane/.test(text)) return "force";
  return "chosen";
}
function alchemySelectedStat(materials = [], predicate) {
  return materials.reduce((sum, material) => sum + (predicate(material) ? 1 : 0), 0);
}
function alchemyMaterialPotency(material) {
  return Number(material?.potency_rank || material?.raw?.potency_rank || material?.raw?.plants?.potency_rank || 0) || reagentPotencyRank(material?.rarity || "Common");
}
function alchemyMaterialRequiredPotency(material) {
  return reagentPotencyRank(material?.slot_min_rarity || material?.min_rarity || "Common");
}
function alchemyMaterialEffectWords(materials = []) {
  return materials.flatMap((material) => {
    const traits = materialAlchemyTraits(material);
    return [...traits.positive, ...traits.negative, material.notes, material.effect_text, material.effect_summary].filter(Boolean).map((value) => String(value).toLowerCase());
  }).join(" ");
}
function alchemyDurationPreview(profileOrSeconds, durationPct = 0, dieSteps = 0, fallback = "Until used") {
  if (profileOrSeconds && typeof profileOrSeconds === "object") {
    return formatAlchemyDuration(profileOrSeconds, durationPct, dieSteps, fallback);
  }
  const finalSeconds = scaledDurationSeconds(profileOrSeconds, durationPct, dieSteps);
  return formatDurationSeconds(finalSeconds, fallback);
}
function diceStep(base = "d4", steps = 0) {
  const size = Number(String(base || "d4").replace(/[^0-9]/g, "")) || 4;
  return `d${steppedDieSize(size, steps)}`;
}
function abilityFromRecipeName(name = "") {
  const clean = String(name || "");
  return ABILITY_NAMES.find((ability) => new RegExp(`\\b${ability}\\b`, "i").test(clean)) || "Ability";
}
function alchemyEffectSentenceForRecipe(recipe, baseDetails, materials = [], attemptPreview, outputQuantity = 1) {
  const key = normalizeRecipeNameKey(recipe?.name || "");
  const totals = alchemyAggregateStats(materials, recipe);
  const effectPct = Number(totals.effectPct || 0);
  const durationPct = Number(totals.durationPct || 0);
  const extraDoses = Number(totals.extraDoses || 0);
  const saveDc = Number(totals.saveDcBonus || 0);
  const element = alchemyElementFromMaterials(materials, recipe);
  const numeric = alchemyNumericProfile(recipe, baseDetails || {});
  const effectScaling = diceCountScaling(numeric.base_dice_count, effectPct);
  const effectRemainderPct = effectScaling.remainderPct;
  const steppedDice = numeric.base_dice_count && numeric.base_die_size ? {
    count: scaledDiceCount(numeric.base_dice_count, effectPct),
    size: steppedDieSize(numeric.base_die_size, Number(totals.dieSteps || 0)),
    flat: scaledFlatBonus(numeric.base_flat_bonus, numeric.base_dice_count, effectPct),
  } : null;
  const diceText = formatDiceProfile(steppedDice);
  const finalDuration = alchemyDurationPreview(
    numeric,
    durationPct,
    Number(totals.dieSteps || 0),
    baseDetails?.duration || recipe?.duration || "Until used"
  );
  const hasDuration = numeric.base_duration_seconds !== null && numeric.base_duration_seconds !== undefined
    || Number(numeric.base_duration_dice_count || 0) > 0;
  const saveText = saveDc ? ` Save DC +${saveDc}.` : "";
  const doseText = extraDoses ? ` Batch yields +${extraDoses} extra ${extraDoses === 1 ? "dose" : "doses"}.` : "";
  const percentText = effectRemainderPct
    ? ` The remaining Effect +${formatBonusPercent(effectRemainderPct)}% stays banked until it produces another whole base die.`
    : "";
  const durationText = hasDuration ? ` Duration: ${finalDuration}.` : "";
  const wholeEffectSteps = Math.max(0, Math.floor(effectPct / 100));
  const sizeSteps = 1 + wholeEffectSteps;
  const sizeRemainder = Math.max(0, effectPct - wholeEffectSteps * 100);
  const sizeRemainderText = sizeRemainder ? ` The remaining Effect +${sizeRemainder}% is banked toward the next size step.` : "";

  if (/(?:potion-of-healing|healing-potion)/.test(key)) {
    const named = healingNameFromEffect(effectPct, totals.dieSteps);
    return `${named}: restores ${diceText || "2d4 + 2"} HP.${percentText}${doseText}`;
  }
  if (/potion-of-x-resistance/.test(key) || /resistance/.test(key)) {
    const type = element && element !== "chosen" ? readableDamageType(element) : "chosen";
    const effectText = effectPct ? ` Any recipe-supported secondary mitigation is increased by ${effectPct}%.` : "";
    return `The drinker gains ${type} resistance.${durationText}${effectText}${doseText}`;
  }
  if (/potion-of-regeneration/.test(key)) {
    const cadence = numeric.effect_cadence || "at the start of each of the drinker's turns";
    return `For ${finalDuration}, ${cadence}, the drinker regains ${diceText || "1d4"} HP.${percentText}${doseText}`;
  }
  if (/elixir-of-.*-immunity/.test(key)) {
    return `${baseDetails?.effect || recipe?.effect_detail || recipe?.summary || "Immediately ends the listed condition and grants immunity for 1 hour."}${doseText}`;
  }
  if (/elixir-of-/.test(key)) {
    const ability = abilityFromRecipeName(recipe?.name);
    return `${ability} increases by ${diceText || "1d4"} for ${finalDuration}.${percentText}${doseText}`;
  }
  if (/poison-of-.*-weakening/.test(key)) {
    const ability = abilityFromRecipeName(recipe?.name);
    return `Target chooses Constitution or ${ability} before rolling. On a failed save, ${ability} is reduced by ${diceText || "1d6"} for ${finalDuration}.${percentText}${saveText}${doseText}`;
  }
  if (/poison|toxin|venom|purple-worm/.test(key)) {
    const base = diceText ? `On a failed save, the poison deals ${diceText} poison damage.` : baseDetails?.effect || recipe?.effect_detail || recipe?.summary || "The poison applies its listed harmful effect.";
    return `${base}${percentText}${saveText}${durationText}${doseText}`;
  }
  if (/potion-of-heroism/.test(key)) {
    return `The drinker gains ${diceText || "1d10"} temporary hit points and is affected by Bless for ${finalDuration}.${percentText}${doseText}`;
  }
  if (/potion-of-growth/.test(key)) {
    return `For ${finalDuration}, the drinker increases by ${sizeSteps} size ${sizeSteps === 1 ? "category" : "categories"}, has Advantage on Strength checks and Strength saving throws, and weapon or Unarmed Strike hits deal an extra ${diceText || `${sizeSteps}d4`} damage.${sizeRemainderText}${doseText}`;
  }
  if (/potion-of-diminution/.test(key)) {
    return `For ${finalDuration}, the drinker decreases by ${sizeSteps} size ${sizeSteps === 1 ? "category" : "categories"}, has Advantage on Dexterity checks, and gains +${sizeSteps} AC. This potion imposes no Strength disadvantage.${sizeRemainderText}${doseText}`;
  }
  if (/potion-of-physical-prowess/.test(key)) {
    const bonus = wholeEffectSteps;
    const bonusText = bonus ? ` and gains +${bonus} to those checks` : "";
    const remainderText = sizeRemainder ? ` The remaining Effect +${sizeRemainder}% is banked toward the next +1.` : "";
    return `For ${finalDuration}, the drinker has Advantage on Strength-, Dexterity-, and Constitution-based ability checks${bonusText}, and gains a climbing speed equal to walking speed.${remainderText}${doseText}`;
  }
  if (/potion-of-night-vision/.test(key)) {
    const range = Math.max(5, Math.round((60 * (1 + effectPct / 100)) / 5) * 5);
    return `For ${finalDuration}, the drinker gains darkvision out to ${range} feet.${doseText}`;
  }
  if (/potion-of-flying/.test(key)) {
    const speedPct = 100 + effectPct;
    return `For ${finalDuration}, the drinker gains a flying speed equal to ${speedPct}% of walking speed and can hover.${doseText}`;
  }
  if (/potion-of-quickstep/.test(key)) {
    return `For ${finalDuration}, the drinker can use Misty Step as a Bonus Action on each of their turns without expending a spell slot or components.${doseText}`;
  }
  if (/potion-of-breath/.test(key)) {
    return `For ${finalDuration}, the drinker does not need to breathe and can survive underwater, in an airless space, or wherever breathing is impossible.${doseText}`;
  }
  if (/potion-of-storm-giant-transformation/.test(key)) {
    return `For ${finalDuration}, the drinker becomes Huge, occupies a 15-by-15-foot space, and their Strength becomes 29 unless it is already higher.${doseText}`;
  }
  if (/potion-of-invulnerability/.test(key)) {
    return `For ${finalDuration}, the drinker has resistance to all damage.${doseText}`;
  }
  if (/potion-of-(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder)-breath/.test(key)) {
    const type = element && element !== "chosen" ? readableDamageType(element) : readableDamageType(recipe?.tag_label || "chosen");
    const saveAbility = recipe?.save_ability || recipe?.saveAbility || "Dexterity";
    const areaFeet = Number(recipe?.base_area_feet || recipe?.baseAreaFeet || 15) || 15;
    const uses = Number(numeric.base_uses || recipe?.base_uses || 3) || 3;
    return `For ${finalDuration}, the drinker can use a Bonus Action up to ${uses} times to exhale a ${areaFeet}-foot cone. Creatures in the cone make a ${saveAbility} saving throw, taking ${diceText || "3d6"} ${type} damage on a failed save or half as much on a success.${percentText}${doseText}`;
  }
  if (/fire-breath|acid|bomb|grenade|explosive|damage/.test(key)) {
    const type = element && element !== "chosen" ? readableDamageType(element) : "chosen damage type";
    const base = diceText ? `The brew deals ${diceText} ${type} damage where the formula calls for damage.` : baseDetails?.effect || recipe?.effect_detail || recipe?.summary || `The brew projects ${type}.`;
    return `${base}${percentText}${saveText}${durationText}${doseText}`;
  }
  return `${baseDetails?.effect || recipe?.effect_detail || recipe?.summary || "The selected ingredients define the final alchemical effect."}${effectPct ? ` Effect +${effectPct}%.` : ""}${durationText}${saveText}${doseText}`;
}
function formatAlchemyArea(recipe = {}, totals = {}) {
  const baseFeet = Number(recipe.base_area_feet || recipe.baseAreaFeet || 0) || 0;
  if (!baseFeet) return "";
  const percent = Number(totals.areaPct || 0) || 0;
  const scaled = Math.round(baseFeet * (1 + percent / 100) * 10) / 10;
  const feet = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1);
  const shape = String(recipe.area_shape || recipe.areaShape || "area").trim();
  return `${feet}-foot ${shape}`;
}
function alchemySaveDcPreview(recipe = {}, totals = {}, proficiency = 2, craftRollTotal = null, craftDc = 0) {
  const section = alchemySectionForRecipe(recipe);
  const hasSave = Boolean(recipe.save_ability || recipe.saveAbility || /saving throw|\bsave\b/i.test(String(recipe.effect_detail || recipe.effect_text || recipe.summary || "")));
  if (!hasSave) return null;
  const pb = Math.max(0, Math.min(10, Number(proficiency) || 0));
  const ingredientBonus = Number(totals.saveDcBonus || 0) || 0;
  const roll = craftRollTotal === "" || craftRollTotal === null || craftRollTotal === undefined ? null : Number(craftRollTotal);
  const marginBonus = Number.isFinite(roll) && Number.isFinite(Number(craftDc)) && roll >= Number(craftDc) + 4 ? 1 : 0;
  return {
    dc: 8 + (pb * 2) + ingredientBonus + marginBonus,
    proficiency: pb,
    ingredientBonus,
    marginBonus,
    saveAbility: recipe.save_ability || recipe.saveAbility || "Dexterity",
    formula: `8 + (${pb} × 2)${ingredientBonus ? ` + ${ingredientBonus} ingredient` : ""}${marginBonus ? " + 1 craft margin" : ""}`,
    pendingMargin: marginBonus === 0 && (roll === null || !Number.isFinite(roll)),
    section,
  };
}
function buildAlchemyProductPreview(recipe, details, selectedMaterials = [], attemptPreview, baseOutputQuantity = 1, craftContext = {}) {
  if (!recipe || !details) return null;
  const selected = Array.isArray(selectedMaterials) ? selectedMaterials : [];
  const totals = alchemyAggregateStats(selected, recipe);
  const numeric = alchemyNumericProfile(recipe, details);
  const area = formatAlchemyArea(recipe, totals);
  const saveDcPreview = alchemySaveDcPreview(recipe, totals, craftContext.crafterProficiency, craftContext.craftRollTotal, attemptPreview?.final_dc);
  const steppedDice = numeric.base_dice_count && numeric.base_die_size ? {
    count: scaledDiceCount(numeric.base_dice_count, Number(totals.effectPct || 0)),
    size: steppedDieSize(numeric.base_die_size, Number(totals.dieSteps || 0)),
    flat: scaledFlatBonus(numeric.base_flat_bonus, numeric.base_dice_count, Number(totals.effectPct || 0)),
  } : null;
  const modifierLines = [];
  if (!selected.length) modifierLines.push("Select ingredient families below to preview the final brew details.");
  if (totals.effectPct) {
    const scaling = diceCountScaling(numeric.base_dice_count, totals.effectPct);
    const effectParts = [];
    if (scaling.additionalDice) {
      effectParts.push(`adds ${scaling.additionalDice} additional ${scaling.additionalDice === 1 ? "die" : "dice"} to the formula's base effect roll and scales its attached flat modifier proportionally`);
    }
    if (scaling.remainderPct) effectParts.push(`leaves ${formatBonusPercent(scaling.remainderPct)}% banked toward the next whole effect die`);
    if (!effectParts.length) effectParts.push(`is banked until the accumulated bonus can create a whole effect die`);
    modifierLines.push(`Effect +${totals.effectPct}%: ${effectParts.join(" and ")}.`);
  }
  if (totals.durationPct) {
    const rollableDuration = Number(numeric.base_duration_dice_count || 0) > 0;
    if (rollableDuration) {
      const scaling = diceCountScaling(numeric.base_duration_dice_count, totals.durationPct);
      const durationParts = [];
      if (scaling.additionalDice) durationParts.push(`adds ${scaling.additionalDice} additional ${scaling.additionalDice === 1 ? "duration die" : "duration dice"}`);
      if (scaling.remainderPct) durationParts.push(`leaves ${formatBonusPercent(scaling.remainderPct)}% banked toward the next whole duration die`);
      if (!durationParts.length) durationParts.push(`is banked until the accumulated bonus can create a whole duration die`);
      modifierLines.push(`Duration +${totals.durationPct}%: ${durationParts.join(" and ")}.`);
    } else {
      modifierLines.push(`Duration +${totals.durationPct}%: increases the formula's fixed duration by this amount.`);
    }
  }
  if (totals.areaPct) modifierLines.push(`Area / Range +${totals.areaPct}%: improves splash, fumes, cloud, thrown, or aura formulas.`);
  if (totals.extraDoses) modifierLines.push(`+${totals.extraDoses} ${totals.extraDoses === 1 ? "extra dose" : "extra doses"}: increases expected output quantity.`);
  if (totals.saveDcBonus) modifierLines.push(`Save DC +${totals.saveDcBonus}: makes saving-throw formulas harder to resist.`);
  if (totals.dieSteps) modifierLines.push(`Die step +${totals.dieSteps}: upgrades effect dice (d4 → d6 → d8 → d10 → d12) and promotes duration units (minutes → hours → days → weeks) before the final preview is calculated.`);
  if (totals.typeDirection) modifierLines.push(`Type direction: ${readableDamageType(totals.typeDirection)}.`);

  const familyLine = selected.map((material) => `${material.slot_role || material.slot_label || "Ingredient"}: ${material.name} (${reagentFamilyLabel(inferReagentFamily(material))}, ${material.rarity || "Common"})`).join("; ");
  return {
    use: ALCHEMY_STANDARD_USE,
    section: numeric.section,
    area,
    saveDcPreview,
    duration: alchemyDurationPreview(
      numeric,
      Number(totals.durationPct || 0),
      Number(totals.dieSteps || 0),
      details.duration || recipe.duration || "Until used"
    ),
    durationSeconds: Number(numeric.base_duration_dice_count || 0) > 0
      ? null
      : scaledDurationSeconds(numeric.base_duration_seconds, Number(totals.durationPct || 0), Number(totals.dieSteps || 0)),
    durationDice: Number(numeric.base_duration_dice_count || 0) > 0 ? {
      count: scaledDiceCount(numeric.base_duration_dice_count, Number(totals.durationPct || 0)),
      size: numeric.base_duration_die_size,
      unit: steppedDurationUnit(numeric.base_duration_unit, Number(totals.dieSteps || 0)),
      remainderPct: diceCountScaling(numeric.base_duration_dice_count, Number(totals.durationPct || 0)).remainderPct,
    } : null,
    dice: formatDiceProfile(steppedDice),
    baseDice: formatDiceProfile(numeric.base_dice_count && numeric.base_die_size ? {
      count: numeric.base_dice_count,
      size: numeric.base_die_size,
      flat: numeric.base_flat_bonus,
    } : null),
    dicePurpose: numeric.dice_purpose,
    effectCadence: numeric.effect_cadence || null,
    effect: alchemyEffectSentenceForRecipe(recipe, details, selected, attemptPreview, baseOutputQuantity),
    dc: attemptPreview?.final_dc || details.dc || "—",
    formulaRarity: attemptPreview?.formula_rarity || recipe?.rarity || "Common",
    finishedRarity: attemptPreview?.finished_rarity || recipe?.rarity || "Common",
    qualitySteps: Number(attemptPreview?.quality_steps || 0),
    rarityIncrease: Number(attemptPreview?.rarity_increase || 0),
    outputQuantity: Math.max(1, Number(baseOutputQuantity || 1) + Number(totals.extraDoses || 0)),
    element: alchemyElementFromMaterials(selected, recipe),
    conditionCure: totals.conditionCure || "",
    curesConditions: totals.conditionCure ? [totals.conditionCure] : (recipe.cures_conditions || []),
    grantsImmunities: totals.conditionCure ? [totals.conditionCure] : (recipe.grants_immunities || []),
    familyLine,
    modifierLines,
    riskLines: [],
    potencyBoost: Math.round(Number(totals.effectPct || 0) / 25),
    durationBoost: Math.round(Number(totals.durationPct || 0) / 25),
    batchBoost: Number(totals.extraDoses || 0),
    dcBoost: Number(totals.saveDcBonus || 0),
    totals,
    hasSelections: selected.length > 0,
  };
}
function normalizeRecipeNameKey(name = "") {
  return String(name || "").replace(/^Craft\s+/i, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
const ALCHEMY_BREWING_PATHS = {
  "potion-of-healing": [
    { name: "Field Remedy", primary: "Sunmend Marigold", secondary: "Heartroot", reagent: "Clearwater Reed Ash", result: "Standard healing output.", dcMod: 0 },
    { name: "Deep Mender", primary: "Heartroot", secondary: "Phoenix Petal", reagent: "Goldcap Honey", result: "Boost healing potency when rare herbs are accepted by the DM.", dcMod: 3 },
    { name: "Batch Draught", primary: "Sunmend Marigold", secondary: "Honeycap Clover", reagent: "Spring Salt", result: "Safer brew; good candidate for +1 batch quantity.", dcMod: 2 }
  ],
  "healing-draught": [
    { name: "Roadside Salve", primary: "Sunmend Marigold", secondary: "Field Sage", reagent: "Clearwater Reed Ash", result: "Simple restorative salve or draught.", dcMod: 0 },
    { name: "Root-Mender", primary: "Heartroot", secondary: "Glowmoss", reagent: "Mender's Salt", result: "Higher potency but more expensive herbs.", dcMod: 2 }
  ],
  "antitoxin": [
    { name: "Bitter Cleanse", primary: "Ashen Bitterleaf", secondary: "Milk Thistle", reagent: "Spring Salt", result: "Reliable antitoxin base.", dcMod: 0 },
    { name: "Venom Reversal", primary: "Venomkiss Nettle", secondary: "Ashen Bitterleaf", reagent: "Charcoal Salt", result: "Stronger poison counteragent; may extend duration.", dcMod: 3 }
  ],
  "basic-poison": [
    { name: "Nightshade Dose", primary: "Widowshade", secondary: "Bitter Nightcap", reagent: "Black Salt", result: "Standard injury poison.", dcMod: 0 },
    { name: "Deep Venom", primary: "Venomkiss Nettle", secondary: "Purple Worm Ichor Bloom", reagent: "Ichor Binder", result: "Higher damage or harder save DC by DM approval.", dcMod: 5 }
  ],
  "potion-of-climbing": [
    { name: "Vinegrip", primary: "Gripsap Vine", secondary: "Cliff Thyme", reagent: "Sticky Resin", result: "Standard climbing potion.", dcMod: 0 },
    { name: "Spiderstep", primary: "Spiderhook Moss", secondary: "Gripsap Vine", reagent: "Silk Resin", result: "Longer duration or better climbing control.", dcMod: 3 }
  ],
  "potion-of-comprehension": [
    { name: "Sage Ink", primary: "Field Sage", secondary: "Silverleaf", reagent: "Script Ink", result: "Standard comprehension brew.", dcMod: 0 },
    { name: "Moon-Speech", primary: "Moonsilver Fern", secondary: "Field Sage", reagent: "Dewglass", result: "Extended duration or harder language/lore use.", dcMod: 3 }
  ],
  "potion-of-animal-friendship": [
    { name: "Sweet Beast Draught", primary: "Honeycap Clover", secondary: "Feyapple Blossom", reagent: "Amber Honey", result: "Standard animal friendship effect.", dcMod: 0 },
    { name: "Wildheart Blend", primary: "Lionheart Bloom", secondary: "Honeycap Clover", reagent: "Warm Milk Resin", result: "May affect stronger or more stubborn beasts.", dcMod: 4 }
  ],
  "potion-of-fire-breath": [
    { name: "Ember Pepper", primary: "Emberpepper", secondary: "Ashen Bitterleaf", reagent: "Fire Oil", result: "Standard fire breath output.", dcMod: 0 },
    { name: "Drakeflame", primary: "Drake Emberblossom", secondary: "Emberpepper", reagent: "Dragon Scale Cinder", result: "Higher damage or harder save DC.", dcMod: 5 }
  ],
  "potion-of-growth": [
    { name: "Giantroot", primary: "Giantroot", secondary: "Sunmend Marigold", reagent: "Tree Sap", result: "Standard growth output.", dcMod: 0 },
    { name: "Worldroot", primary: "Worldroot Bulb", secondary: "Giantroot", reagent: "Titan Sap", result: "Bigger or longer transformation by DM approval.", dcMod: 6 }
  ],
  "potion-of-resistance": [
    { name: "Ward Moss", primary: "Wardmoss", secondary: "Stonecap Lichen", reagent: "Elemental Salt", result: "Resistance type follows catalyst/reagent.", dcMod: 0 },
    { name: "Diamond Ward", primary: "Diamondvein Lichen", secondary: "Wardmoss", reagent: "Elemental Crystal", result: "Longer duration or stronger mitigation.", dcMod: 5 }
  ],
  "potion-of-water-breathing": [
    { name: "Reedlung", primary: "Clearwater Reed", secondary: "Bubblekelp", reagent: "Sea Salt", result: "Standard water breathing output.", dcMod: 0 },
    { name: "Pearl Gill", primary: "Pearlkelp", secondary: "Bubblekelp", reagent: "Tideglass", result: "Extended duration or multiple targets.", dcMod: 4 }
  ],
  "potion-of-heroism": [
    { name: "Lionheart", primary: "Lionheart Bloom", secondary: "Sunmend Marigold", reagent: "Goldcap Honey", result: "Standard heroism output.", dcMod: 0 },
    { name: "Golden Valor", primary: "Golden Valorleaf", secondary: "Lionheart Bloom", reagent: "Sunsteel Dust", result: "Greater temporary resilience or duration.", dcMod: 5 }
  ],
  "potion-of-gaseous-form": [
    { name: "Ghost Mist", primary: "Ghostcap Mushroom", secondary: "Mist Lotus", reagent: "Silver Dew", result: "Standard gaseous form output.", dcMod: 0 },
    { name: "Ethereal Vapor", primary: "Phase Orchid", secondary: "Ghostcap Mushroom", reagent: "Ectoplasm Salt", result: "Cleaner transformation or extended duration.", dcMod: 5 }
  ],
  "potion-of-mind-reading": [
    { name: "Dreamsage", primary: "Dreamsage", secondary: "Moonsilver Fern", reagent: "Silver Ink", result: "Standard mind reading output.", dcMod: 0 },
    { name: "Third Eye", primary: "Seer's Eyebright", secondary: "Dreamsage", reagent: "Crystal Ink", result: "Harder save DC or clearer surface thoughts.", dcMod: 4 }
  ],
  "potion-of-clairvoyance": [
    { name: "Seer's Eye", primary: "Seer's Eyebright", secondary: "Moonsilver Fern", reagent: "Clear Crystal", result: "Standard clairvoyance output.", dcMod: 0 },
    { name: "Far-Sight Bloom", primary: "Oracle Lotus", secondary: "Seer's Eyebright", reagent: "Moon Crystal", result: "Longer range or duration by DM approval.", dcMod: 6 }
  ],
  "potion-of-speed": [
    { name: "Quickthorn", primary: "Quickthorn Pepper", secondary: "Stormglass Reed", reagent: "Quicksilver", result: "Standard speed output.", dcMod: 0 },
    { name: "Stormstep", primary: "Thunderstep Fern", secondary: "Quickthorn Pepper", reagent: "Storm Crystal", result: "Extended duration or reduced crash risk.", dcMod: 5 }
  ],
  "potion-of-superior-healing": [
    { name: "Phoenix Mender", primary: "Phoenix Petal", secondary: "Heartroot", reagent: "Goldcap Honey", result: "Standard superior healing output.", dcMod: 0 },
    { name: "Sunheart", primary: "Sunheart Lotus", secondary: "Phoenix Petal", reagent: "Diamond Dew", result: "Higher healing dice or bonus healing.", dcMod: 6 }
  ],
  "potion-of-invisibility": [
    { name: "Ghostmoon", primary: "Ghostcap Mushroom", secondary: "Moonsilver Fern", reagent: "Shadow Dew", result: "Standard invisibility output.", dcMod: 0 },
    { name: "True Vanish", primary: "Veilroot", secondary: "Ghostcap Mushroom", reagent: "Moonshadow Resin", result: "Longer duration or harder detection.", dcMod: 5 }
  ],
  "oil-of-etherealness": [
    { name: "Phase Oil", primary: "Phase Orchid", secondary: "Ghostcap Mushroom", reagent: "Silver Resin", result: "Standard etherealness oil.", dcMod: 0 },
    { name: "Boundary-Thin Oil", primary: "Ethereal Lotus", secondary: "Phase Orchid", reagent: "Ectoplasm Resin", result: "Cleaner planar transition or extended duration.", dcMod: 6 }
  ],
  "oil-of-sharpness": [
    { name: "Thorn Edge", primary: "Razorvine", secondary: "Silverleaf", reagent: "Honing Oil", result: "Standard sharpness oil.", dcMod: 0 },
    { name: "Crystal Edge", primary: "Diamondvein Lichen", secondary: "Razorvine", reagent: "Silver Resin", result: "Longer coating duration or extra potency.", dcMod: 5 }
  ],
  "purple-worm-poison": [
    { name: "Deep Ichor", primary: "Purple Worm Ichor Bloom", secondary: "Widowshade", reagent: "Ichor Binder", result: "Standard deadly poison output.", dcMod: 0 },
    { name: "Abyssal Dose", primary: "Abyssal Nightcap", secondary: "Purple Worm Ichor Bloom", reagent: "Void Salt", result: "Higher poison damage or harder save DC.", dcMod: 7 }
  ],
  "potion-of-storm-giant-strength": [
    { name: "Storm Giant Heart", primary: "Storm Giant's Heartleaf", secondary: "Thunderstep Fern", reagent: "Storm Crystal", result: "Standard storm giant strength output.", dcMod: 0 },
    { name: "Tempest King", primary: "Tempest Crown", secondary: "Storm Giant's Heartleaf", reagent: "Cloud Diamond", result: "Extended duration by DM approval.", dcMod: 7 }
  ],
  "potion-of-giant-size": [
    { name: "Worldroot Giant", primary: "Worldroot Bulb", secondary: "Giantroot", reagent: "Titan Sap", result: "Standard giant size output.", dcMod: 0 },
    { name: "Colossus Bloom", primary: "Colossus Orchid", secondary: "Worldroot Bulb", reagent: "Sun Gold", result: "More dramatic size effect by DM approval.", dcMod: 8 }
  ],
  "potion-of-dragons-majesty": [
    { name: "Dragon Crown", primary: "Dragoncrown Orchid", secondary: "Drake Emberblossom", reagent: "Dragon Heart Scale", result: "Standard draconic majesty output.", dcMod: 0 },
    { name: "Ancient Majesty", primary: "Ancient Dragonbloom", secondary: "Dragoncrown Orchid", reagent: "Crown Gold", result: "Longer or stronger transformation by DM approval.", dcMod: 8 }
  ],
  "potion-of-invulnerability": [
    { name: "Diamond Ward", primary: "Diamondvein Lichen", secondary: "Ironroot Bark", reagent: "Diamond Dust", result: "Standard invulnerability output.", dcMod: 0 },
    { name: "Adamant Heart", primary: "Adamant Heartmoss", secondary: "Diamondvein Lichen", reagent: "Adamant Powder", result: "Longer duration or stronger resistance.", dcMod: 8 }
  ]
};
const ALCHEMY_ENHANCER_GUIDE = [
  { tag: "duration", name: "Duration Extender", examples: "Moonsilver Fern, Veilroot, Ethereal Lotus", effect: "+duration or steadier effect", dcMod: 2 },
  { tag: "potency", name: "Potency Booster", examples: "Phoenix Petal, Drake Emberblossom, Purple Worm Ichor Bloom", effect: "+healing, +damage, stronger transformation, or harder save", dcMod: 3 },
  { tag: "batch", name: "Batch Multiplier", examples: "Goldcap Honey, Clearwater Reed, Sunmend Marigold", effect: "+1 dose/potion where the formula allows", dcMod: 2 },
  { tag: "dc", name: "Save DC Intensifier", examples: "Dreamlotus Bloom, Widowshade, Basilisk Bile", effect: "Raises target Save DC", dcMod: 3 },
  { tag: "dice", name: "Dice Step Component", examples: "Worldroot Knot, Holy Component, Purple Ichor Bloom", effect: "Upgrades healing, damage, stat-buff, or stat-damage dice before percentage bonuses", dcMod: 4 }
];
function alchemyRecipePaths(recipe) {
  if (!recipe || recipe.discipline !== "Alchemy") return [];
  const key = normalizeRecipeNameKey(recipe.name);
  return ALCHEMY_BREWING_PATHS[key] || [];
}
function alchemyRecipeEnhancers(recipe) {
  if (!recipe || recipe.discipline !== "Alchemy") return [];
  const text = [recipe.name, recipe.summary, recipe.rarity, ...(recipe.formula_tags || [])].join(" ").toLowerCase();
  return ALCHEMY_ENHANCER_GUIDE.filter((entry) => {
    if (entry.tag === "duration") return /duration|ethereal|invisibility|gaseous|water|speed|resistance|climb|comprehension/.test(text);
    if (entry.tag === "potency") return /healing|poison|fire|strength|giant|dragon|invulnerability|heroism/.test(text);
    if (entry.tag === "batch") return /healing|draught|antitoxin|climbing|comprehension|common/.test(text);
    if (entry.tag === "dc") return /poison|mind|clairvoyance|fire breath|dragon|speed/.test(text);
    if (entry.tag === "dice") return /healing|poison|elixir|weakening|damage|fire|acid|regeneration/.test(text);
    return false;
  }).slice(0, 4);
}
function materialTags(material) {
  return [
    ...(Array.isArray(material?.tags) ? material.tags : []),
    ...(Array.isArray(material?.raw?.tags) ? material.raw.tags : []),
  ].map((v) => String(v || "").toLowerCase()).filter(Boolean);
}
function materialAlchemyScore(material, recipe, slot = {}) {
  if (!recipe || recipe.discipline !== "Alchemy") return 0;
  const family = inferReagentFamily(material);
  const potency = Number(material?.potency_rank || material?.raw?.potency_rank || material?.raw?.plants?.potency_rank || 0) || reagentPotencyRank(material?.rarity || "Common");
  let score = potency * 4;
  if (slot.family && family === slot.family) score += 20;
  if (slot.family === "any" && materialMatchesCategory(material, "Misc")) score += 4;
  const min = reagentPotencyRank(slot.min_rarity || "Common");
  if (potency >= min) score += 8;
  const traits = materialAlchemyTraits(material);
  score += traits.positive.length * 2;
  score -= traits.negative.length;

  const mTags = [...materialTags(material), ...alchemyBrewTags(material).map(normalizeAlchemyTag)];
  const requiredSlotTags = [...(slot.required_tags_any || []), ...(slot.required_tags_all || [])].map(normalizeAlchemyTag);
  if (requiredSlotTags.some((tagValue) => mTags.includes(tagValue))) score += 40;
  const allFormula = (recipe.formula_tags || []).map((v) => String(v || "").toLowerCase());
  mTags.forEach((tag) => {
    if (allFormula.includes(tag)) score += 3;
  });
  const blob = materialSearchBlob(material);
  alchemyRecipePaths(recipe).forEach((path) => {
    [path.primary, path.secondary, path.reagent].filter(Boolean).forEach((name) => {
      if (blob.includes(String(name).toLowerCase())) score += 8;
    });
  });
  return score;
}


function alchemyFormulaRecipe(raw) {
  const tags = [...(raw.requiredTags || []), ...(raw.secondaryTags || [])].filter(Boolean);
  const familySlots = alchemyRecipeFamilySlots({ name: raw.name, discipline: "Alchemy", rarity: raw.rarity, ingredient_slots: raw.ingredient_slots || raw.ingredientSlots || null });
  const detail = alchemyDetailForName(raw.name) || {
    use: raw.use || "Action to use, unless the DM sets another activation.",
    duration: raw.duration || "By formula or DM ruling",
    effect: raw.effect || "A craftable alchemy formula.",
  };
  const numeric = alchemyNumericProfile(raw, detail);
  const section = alchemySectionForRecipe(raw);
  return {
    id: raw.id,
    key: raw.id,
    name: raw.name,
    discipline: "Alchemy",
    kind: "alchemy",
    category: section,
    family: raw.item_type || section.replace(/s$/, ""),
    alchemy_section: section,
    alchemy_group: raw.alchemy_group || alchemyGroupForRecipe(raw),
    template_key: raw.template_key || "",
    rarity: rarity(raw.rarity || "Common"),
    known: false,
    source: "Herbal Formula",
    summary: raw.effect || "A craftable alchemy formula.",
    alchemy_details: {
      ...detail,
      ...numeric,
      duration: formatAlchemyDuration(numeric, 0, 0, detail.duration || "By formula or DM ruling"),
    },
    duration: formatAlchemyDuration(numeric, 0, 0, detail.duration || raw.duration || "By formula or DM ruling"),
    effect_detail: detail.effect || raw.effect || "Crafted alchemical effect by DM ruling.",
    use: ALCHEMY_STANDARD_USE,
    base_duration_seconds: numeric.base_duration_seconds,
    base_duration_dice_count: numeric.base_duration_dice_count,
    base_duration_die_size: numeric.base_duration_die_size,
    base_duration_unit: numeric.base_duration_unit,
    base_duration_text: numeric.base_duration_text,
    base_dice_count: numeric.base_dice_count,
    base_die_size: numeric.base_die_size,
    base_flat_bonus: numeric.base_flat_bonus,
    base_uses: numeric.base_uses,
    dice_purpose: numeric.dice_purpose,
    effect_cadence: numeric.effect_cadence,
    base_area_feet: Number(raw.base_area_feet || raw.baseAreaFeet || 0) || 0,
    area_shape: raw.area_shape || raw.areaShape || "",
    save_ability: raw.save_ability || raw.saveAbility || "",
    base_dc: Math.max(Number(raw.base_dc || raw.dc || 0) || 0, alchemyBaseDcByRarity(raw.rarity || "Common")),
    output_quantity: defaultAlchemyOutputQuantity(raw),
    quantity_created: defaultAlchemyOutputQuantity(raw),
    requirements: [
      "Alchemist's supplies",
      "Three core ingredients from the required families",
      "Any ingredient rarity is allowed; lower-rarity ingredients leave a higher final Craft DC",
      `Foraging clues: ${tags.slice(0, 6).join(", ")}`
    ],
    components: [
      ...(familySlots || []).filter((slot) => slot.required !== false).map((slot) => `${slot.role}: ${slot.family_label || reagentFamilyLabel(slot.family)} (any rarity)`),
      "Optional fourth-slot essence, enhancer, holy component, or monster part",
      `Formula tags: ${tags.join(", ")}`
    ],
    ingredient_slots: familySlots,
    family_formula: familySlots ? familySlots.map((slot) => slot.family).join("+") : null,
    formula_tags: tags,
    required_tags: raw.requiredTags || [],
    required_tags_any: raw.required_tags_any || raw.requiredTagsAny || [],
    tag_label: raw.tag_label || raw.tagLabel || "",
    secondary_tags: raw.secondaryTags || [],
    enhancer_tags: raw.enhancerTags || [],
    condition_riders: Array.isArray(raw.condition_riders) ? raw.condition_riders : [],
    cures_conditions: Array.isArray(raw.cures_conditions) ? raw.cures_conditions : [],
    grants_immunities: Array.isArray(raw.grants_immunities) ? raw.grants_immunities : [],
    formula_family: raw.formula_family || "",
    template_key: raw.template_key || "",
    theme_source: raw.theme_source || "",
    rider_save: raw.rider_save || "",
    rider_duration: raw.rider_duration || "",
    rider_repeat_save: raw.rider_repeat_save || "",
  };
}

function dbRecipe(row, knownIds) {
  const name = row.name || row.title || row.recipe_name || "Unnamed Recipe";
  const keys = [row.id, row.recipe_id, name].map((v) => String(v || "").toLowerCase());
  const known = !!row.known || !!row.is_known || keys.some((k) => knownIds.has(k));
  const disciplineValue = titleCase(row.discipline || row.recipe_type || row.kind || "Recipe");
  const isAlchemy = disciplineValue === "Alchemy" || String(row.recipe_type || "").toLowerCase() === "alchemy";
  const namedDetail = isAlchemy ? alchemyDetailForName(name) || {} : {};
  const detail = isAlchemy ? {
    use: row.use_text || row.application || row.activation || row.metadata?.use || namedDetail.use || null,
    duration: row.duration || row.duration_text || row.metadata?.duration || namedDetail.duration || null,
    effect: row.effect_text || row.effect || row.metadata?.effect || row.description || row.summary || namedDetail.effect || null,
    base_duration_seconds: row.base_duration_seconds ?? row.metadata?.base_duration_seconds ?? namedDetail.base_duration_seconds ?? null,
    base_duration_dice_count: row.base_duration_dice_count ?? row.metadata?.base_duration_dice_count ?? namedDetail.base_duration_dice_count ?? null,
    base_duration_die_size: row.base_duration_die_size ?? row.metadata?.base_duration_die_size ?? namedDetail.base_duration_die_size ?? null,
    base_duration_unit: row.base_duration_unit || row.metadata?.base_duration_unit || namedDetail.base_duration_unit || null,
    base_dice_count: row.base_dice_count ?? row.metadata?.base_dice_count ?? namedDetail.base_dice_count ?? null,
    base_die_size: row.base_die_size ?? row.metadata?.base_die_size ?? namedDetail.base_die_size ?? null,
    base_flat_bonus: row.base_flat_bonus ?? row.metadata?.base_flat_bonus ?? namedDetail.base_flat_bonus ?? null,
    base_uses: row.base_uses ?? row.metadata?.base_uses ?? namedDetail.base_uses ?? null,
    dice_purpose: row.dice_purpose || row.metadata?.dice_purpose || namedDetail.dice_purpose || null,
    effect_cadence: row.effect_cadence || row.metadata?.effect_cadence || namedDetail.effect_cadence || null,
  } : null;
  const numeric = isAlchemy ? alchemyNumericProfile({ ...row, name, discipline: "Alchemy" }, detail || {}) : {};
  const section = isAlchemy ? normalizeAlchemySection(row.alchemy_section) || alchemySectionForRecipe({ ...row, name }) : "";

  return {
    id: `db:${row.id || name}`,
    name,
    discipline: disciplineValue,
    kind: row.recipe_type || row.kind || "recipe",
    category: isAlchemy ? section : row.category || row.applies_to || row.item_type || "custom",
    family: row.family || row.category || row.item_type || (isAlchemy ? section.replace(/s$/, "") : "Custom"),
    alchemy_section: section || null,
    alchemy_group: row.alchemy_group || row.metadata?.alchemy_group || alchemyGroupForRecipe({ ...row, name, alchemy_section: section }),
    template_key: row.template_key || row.metadata?.template_key || "",
    rarity: rarity(row.rarity || row.item_rarity || "") || "Varies",
    known,
    source: row.source || "Supabase",
    summary: row.description || row.summary || row.notes || row.effect_text || "Custom recipe.",
    alchemy_details: isAlchemy ? {
      ...detail,
      ...numeric,
      duration: formatAlchemyDuration(numeric, 0, 0, detail?.duration || "By formula or DM ruling"),
    } : null,
    duration: isAlchemy
      ? formatAlchemyDuration(numeric, 0, 0, detail?.duration || "By formula or DM ruling")
      : row.duration || row.duration_text || row.metadata?.duration || null,
    effect_detail: row.effect_text || row.effect || row.metadata?.effect || null,
    use: row.use_text || row.application || row.activation || row.metadata?.use || null,
    base_duration_seconds: isAlchemy ? numeric.base_duration_seconds : null,
    base_duration_dice_count: isAlchemy ? numeric.base_duration_dice_count : null,
    base_duration_die_size: isAlchemy ? numeric.base_duration_die_size : null,
    base_duration_unit: isAlchemy ? numeric.base_duration_unit : null,
    base_duration_text: isAlchemy ? numeric.base_duration_text : null,
    base_dice_count: isAlchemy ? numeric.base_dice_count : null,
    base_die_size: isAlchemy ? numeric.base_die_size : null,
    base_flat_bonus: isAlchemy ? numeric.base_flat_bonus : null,
    base_uses: isAlchemy ? numeric.base_uses : null,
    dice_purpose: isAlchemy ? numeric.dice_purpose : null,
    effect_cadence: isAlchemy ? numeric.effect_cadence : null,
    base_area_feet: isAlchemy ? (Number(row.base_area_feet || 0) || 0) : 0,
    area_shape: isAlchemy ? (row.area_shape || "") : "",
    save_ability: isAlchemy ? (row.save_ability || "") : "",
    base_dc: Number(row.base_dc || row.dc || row.craft_dc || 0) || null,
    ingredient_slots: Array.isArray(row.ingredient_slots) ? row.ingredient_slots : Array.isArray(row.alchemy_slots) ? row.alchemy_slots : [],
    family_formula: row.family_formula || row.recipe_family || null,
    output_quantity: Number(row.output_quantity || row.quantity_created || row.batch_quantity || 0) || null,
    formula_tags: Array.isArray(row.formula_tags) ? row.formula_tags : Array.isArray(row.tags) ? row.tags : [],
    required_tags: Array.isArray(row.required_tags) ? row.required_tags : Array.isArray(row.primary_tags) ? row.primary_tags : [],
    required_tags_any: Array.isArray(row.required_tags_any) ? row.required_tags_any : Array.isArray(row.metadata?.required_tags_any) ? row.metadata.required_tags_any : [],
    tag_label: row.tag_label || row.metadata?.tag_label || "",
    secondary_tags: Array.isArray(row.secondary_tags) ? row.secondary_tags : [],
    enhancer_tags: Array.isArray(row.enhancer_tags) ? row.enhancer_tags : [],
    condition_riders: Array.isArray(row.condition_riders) ? row.condition_riders : Array.isArray(row.metadata?.condition_riders) ? row.metadata.condition_riders : [],
    cures_conditions: Array.isArray(row.cures_conditions) ? row.cures_conditions : Array.isArray(row.metadata?.cures_conditions) ? row.metadata.cures_conditions : [],
    grants_immunities: Array.isArray(row.grants_immunities) ? row.grants_immunities : Array.isArray(row.metadata?.grants_immunities) ? row.metadata.grants_immunities : [],
    formula_family: row.formula_family || row.metadata?.formula_family || "",
    theme_source: row.theme_source || row.metadata?.theme_source || "",
    rider_save: row.rider_save || row.metadata?.rider_save || "",
    rider_duration: row.rider_duration || row.metadata?.rider_duration || "",
    rider_repeat_save: row.rider_repeat_save || row.metadata?.rider_repeat_save || "",
    requirements: Array.isArray(row.requirements) ? row.requirements : row.requirements ? [String(row.requirements)] : [],
    components: Array.isArray(row.components) ? row.components : row.components ? [String(row.components)] : [],
  };
}

function materialCategoryFromText(value = "") {
  const blob = String(value || "").toLowerCase();
  // Bars/ingots/billets/nuggets are treated as Ore / Metal stock for crafting.
  // Finished weapons/armor are still blocked by shouldTreatInventoryRowAsMaterial().
  if (/(ore|ingot|bar|bars|billet|nugget|adamant|adamantine|mithral|silver|obsidian|cold iron|metal|steel|iron|copper|tin|gold|platinum)/.test(blob)) return "Ore / Metal";
  if (/(fang|eye|claw|horn|hide|scale|heart|ichor|venom|gland|bone|tooth|blood|organ|monster|dragon)/.test(blob)) return "Monster Part";
  if (/(rune|sigil|essence|core|shard|gem|crystal|dust|resin|catalyst)/.test(blob)) return "Catalyst";
  if (/(herb|plant|mushroom|root|flower|leaf|berry|spore|fungus)/.test(blob)) return "Plant / Herb";
  if (/(reagent|oil|ink|powder|salt|acid|alkali|solution|extract)/.test(blob)) return "Reagent";
  return "Material";
}
function materialCategoryTone(category = "") {
  const c = String(category || "").toLowerCase();
  if (c.includes("ore")) return "metal";
  if (c.includes("monster")) return "monster";
  if (c.includes("catalyst")) return "catalyst";
  if (c.includes("plant")) return "plant";
  if (c.includes("reagent")) return "reagent";
  return "material";
}
function materialQualityLabel(material) {
  const r = rarity(material?.rarity || "");
  if (r && r !== "Mundane") return r;
  const q = String(material?.quality || material?.raw?.quality || material?.raw?.card_payload?.quality || "").trim();
  return q ? titleCase(q) : "Standard";
}
function materialSearchBlob(material) {
  return [
    material?.name,
    material?.category,
    material?.type,
    material?.rarity,
    material?.source,
    material?.notes,
    smithingProfile(material)?.materialClass,
    smithingProfile(material)?.offensive,
    smithingProfile(material)?.defensive,
    material?.climate,
    material?.roll,
    ...(Array.isArray(material?.tags) ? material.tags : []),
    ...(Array.isArray(material?.raw?.tags) ? material.raw.tags : []),
    material?.raw?.effect,
    material?.raw?.found_in,
    materialQualityLabel(material),
  ].filter(Boolean).join(" ").toLowerCase();
}
function materialMatches(material, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return materialSearchBlob(material).includes(q);
}

function hasExplicitMaterialSignal(value = "") {
  return /(material|reagent|ingredient|ore|ingot|bar|bars|billet|nugget|adamant|adamantine|mithral|dust|essence|catalyst|monster\s*part|plant|herb|mushroom|root|flower|extract|resin|venom|gland|hide|scale|fang|claw|horn|bone|blood|ichor|gem|shard|crystal|powder|salt)/i.test(String(value || ""));
}
function isFinishedGearType(value = "") {
  return /\b(wondrous|weapon|armor|shield|ammunition|ring|rod|staff|wand|scroll|potion|tool|instrument|mount|vehicle)\b/i.test(String(value || ""));
}
function shouldTreatInventoryRowAsMaterial(row, payload = {}) {
  const explicitFields = [
    row.material_type,
    row.category,
    payload.material_type,
    payload.category,
    payload.crafting_category,
    ...(Array.isArray(row.tags) ? row.tags : []),
    ...(Array.isArray(payload.tags) ? payload.tags : []),
  ].filter(Boolean).join(" ");

  const typeFields = [
    row.item_type,
    payload.item_type,
    payload.type,
    payload.uiType,
  ].filter(Boolean).join(" ");

  const categoryFields = [
    row.category,
    payload.category,
    payload.crafting_category,
    payload.material_type,
    row.material_type,
  ].filter(Boolean).join(" ");

  const nameAndNotes = [
    row.item_name,
    payload.name,
    row.item_description,
    payload.item_description,
    payload.flavor,
  ].filter(Boolean).join(" ");

  const explicitMaterial = Boolean(payload.alchemy) || hasExplicitMaterialSignal(explicitFields) || hasExplicitMaterialSignal(categoryFields);
  const finishedGear = isFinishedGearType(typeFields);

  // IMPORTANT: finished gear must not become raw crafting material just because
  // the name/flavor contains "Adamantine", "Dragon", "Scale", etc.
  // A "+3 Adamantine Longsword" is a weapon, not Ore / Metal. A future salvage
  // recipe can intentionally dismantle it into material rows.
  if (finishedGear && !explicitMaterial) return false;

  // Trade goods and explicitly categorized materials can use name text such as
  // "Adamantine Bar", "Mithral Ingot", or "Silver Nugget" as material signals.
  return explicitMaterial || hasExplicitMaterialSignal(nameAndNotes);
}

function isRawMaterialStockText(value = "") {
  return /\b(ore|ingot|bar|bars|billet|nugget|stock|scrap|raw material|trade goods|reagent|catalyst|monster part|plant|herb)\b/i.test(String(value || ""));
}
function isDestructiveInventoryMaterial(row, payload = {}) {
  const typeFields = [
    row?.item_type,
    row?.type,
    row?.uiType,
    payload?.item_type,
    payload?.type,
    payload?.uiType,
  ].filter(Boolean).join(" ");
  const rawStockFields = [
    row?.item_name,
    payload?.name,
    row?.material_type,
    payload?.material_type,
  ].filter(Boolean).join(" ");

  // Raw bars/ore/monster bits are meant to be consumed. Finished gear is not.
  // Do not let a misclassified category like "Ore / Metal" hide the fact that
  // the selected row is still a finished weapon/armor/shield.
  if (isRawMaterialStockText(typeFields) || isRawMaterialStockText(rawStockFields)) return false;
  return isFinishedGearType(typeFields);
}
function looksLikeFinishedGearName(value = "") {
  const text = String(value || "").toLowerCase();
  if (!text || isRawMaterialStockText(text)) return false;
  return /\b(sword|blade|axe|battleaxe|greataxe|mace|maul|hammer|club|dagger|spear|javelin|glaive|halberd|pike|staff|bow|crossbow|sling|whip|rapier|scimitar|trident|flail|morningstar|lance|armor|mail|plate|breastplate|shield)\b/.test(text);
}
function isDestructiveMaterial(material = {}) {
  if (!material) return false;
  if (material.isDestructive || material.is_destructive_material) return true;
  const row = material.raw || {};
  const payload = row.card_payload && typeof row.card_payload === "object" ? row.card_payload : material.payload || {};
  if (isDestructiveInventoryMaterial(row, payload)) return true;
  return looksLikeFinishedGearName(material.name) && !isRawMaterialStockText([material.category, material.type, material.source].filter(Boolean).join(" "));
}
function destructiveMaterialMessage(materials = []) {
  const names = materials.map((m) => `• ${m.name || "Selected item"}`).join("\n");
  return [
    "Destroy selected item?",
    "",
    names,
    "",
    "This item will be permanently consumed as crafting material. This cannot be undone.",
  ].join("\n");
}
function destructiveMaterialsFromSelection(selectedMaterials = {}, plan) {
  return (plan?.matches || [])
    .map((entry) => {
      const selectedId = selectedMaterials[materialSlotKey(entry)];
      return (entry.candidates || []).find((candidate) => String(candidate.id) === String(selectedId)) || null;
    })
    .filter(Boolean)
    .filter(isDestructiveMaterial);
}
function destructiveMaterialsFromPlan(plan) {
  const stored = Array.isArray(plan?.selected_materials) ? plan.selected_materials : [];
  return stored.filter((material) => material?.is_destructive_material || material?.isDestructive || looksLikeFinishedGearName(material?.name));
}


function materialFromInventory(row) {
  const payload = row.card_payload && typeof row.card_payload === "object" ? row.card_payload : {};
  if (!shouldTreatInventoryRowAsMaterial(row, payload)) return null;

  const alchemy = payload.alchemy && typeof payload.alchemy === "object" ? payload.alchemy : {};
  const blob = [
    row.item_name,
    row.item_type,
    row.material_type,
    row.category,
    payload.item_type,
    payload.material_type,
    payload.category,
    payload.crafting_category,
    payload.type,
    payload.uiType,
    payload.name,
    row.item_description,
    payload.item_description,
    payload.flavor,
    alchemy.family,
    alchemy.familyLabel,
  ].filter(Boolean).join(" ").toLowerCase();

  const category = alchemy.kind === "modifier" ? (alchemy.family === "monster_fluid" ? "Monster Part" : "Reagent / Catalyst") : materialCategoryFromText(blob);
  const family = normalizeReagentFamily(alchemy.family || payload.reagent_family || payload.family_key) || inferReagentFamilyFromText(blob);
  const itemRarity = rarity(row.item_rarity || payload.rarity || payload.item_rarity || alchemy.rarity || "Common") || "Common";
  const isDestructive = isDestructiveInventoryMaterial(row, payload);
  return {
    id: row.id,
    name: row.item_name || payload.name || payload.item_name || "Unknown Material",
    category,
    categoryTone: materialCategoryTone(category),
    type: titleCase(row.material_type || payload.material_type || row.item_type || payload.item_type || payload.uiType || category || "Material"),
    rarity: itemRarity,
    quality: payload.quality || row.quality || null,
    quantity: Number(row.quantity || row.qty || payload.quantity || 1) || 1,
    source: payload.source || row.source || "Inventory",
    notes: row.item_description || payload.item_description || payload.flavor || "Owned crafting material.",
    reagent_family: family,
    family_label: alchemy.familyLabel || alchemy.family_label || payload.family_label || reagentFamilyLabel(family),
    potency_rank: Number(payload.potency_rank || alchemy.potencyRank || 0) || reagentPotencyRank(itemRarity),
    positive_effects: arrayFromValue(payload.positive_effects || alchemy.positiveEffects || alchemy.positive_effects),
    negative_effects: arrayFromValue(payload.negative_effects || alchemy.negativeEffects || alchemy.negative_effects),
    tags: Array.from(new Set([...(arrayFromValue(payload.tags)), ...(arrayFromValue(row.tags)), family, alchemy.kind, "alchemy"].filter(Boolean))),
    alchemy,
    isDestructive,
    warning: isDestructive ? "Will be permanently destroyed if used as material." : "",
    raw: row,
  };
}
function arrayFromValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value).split(/[|,]/).map((entry) => entry.trim()).filter(Boolean);
}
function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? "";
}
function materialFromPlant(row) {
  const plant = row?.plants && typeof row.plants === "object" ? row.plants : {};
  const playerRarity = rarity(row.rarity || "");
  const effectiveRarity = rarity(playerRarity && playerRarity !== "Mundane" ? playerRarity : firstDefined(plant.rarity, row.rarity, "Common"));
  const climate = firstDefined(row.found_in, row.climate, row.biome, row.terrain, row.source, plant.found_in, plant.climate, plant.biome, plant.terrain);
  const roll = firstDefined(row.roll, row.forage_roll, row.d20_roll, plant.roll, plant.roll_min);
  const effect = firstDefined(row.effect, row.description, row.notes, plant.alchemy_notes, plant.effect, plant.description, plant.notes);
  const combinedTags = [...arrayFromValue(row.tags), ...arrayFromValue(plant.tags)];
  const name = firstDefined(row.name, row.plant_name, plant.name, "Unknown Plant");
  const family = normalizeReagentFamily(firstDefined(row.reagent_family, row.family_key, plant.reagent_family, plant.family_key)) || inferReagentFamilyFromText([name, effect, row.category, plant.category, ...combinedTags].filter(Boolean).join(" "));
  const potencyRank = Number(firstDefined(row.potency_rank, plant.potency_rank, 0)) || reagentPotencyRank(effectiveRarity || "Common");
  const defaultBonuses = normalizeAlchemyBonuses(defaultAlchemyBonusesFor(family, effectiveRarity, { discipline: "Alchemy" }, {}, { name, notes: effect, rarity: effectiveRarity, reagent_family: family }));
  const alchemy = {
    kind: ["essence", "enhancer", "holy_vital", "monster_fluid"].includes(family) ? "modifier" : "ingredient",
    family,
    familyLabel: firstDefined(row.family_label, plant.family_label, reagentFamilyLabel(family)),
    rarity: effectiveRarity,
    craftDcReduction: alchemyCraftDcReductionForRarity(effectiveRarity),
    bonuses: defaultBonuses,
    mergeNote: "Generated from player_plants/plants. If migrated into items_catalog later, preserve this payload.alchemy shape.",
  };
  return {
    id: `plant:${row.id || row.plant_id || plant.id || name}`,
    name,
    category: "Plant / Herb",
    categoryTone: "plant",
    type: "Plant / Herb",
    rarity: effectiveRarity,
    quality: row.quality || plant.quality || null,
    quantity: Number(row.quantity || row.qty || plant.quantity || 1) || 1,
    source: climate ? `${climate}${roll ? ` • Forage d20 ${roll}` : ""}` : "Gathered",
    notes: effect || "Gathered alchemy ingredient.",
    roll,
    climate,
    reagent_family: family,
    family_label: firstDefined(row.family_label, plant.family_label, reagentFamilyLabel(family)),
    potency_rank: potencyRank,
    effect_family: firstDefined(row.effect_family, plant.effect_family),
    positive_effects: [...arrayFromValue(row.positive_effects), ...arrayFromValue(plant.positive_effects)],
    negative_effects: [...arrayFromValue(row.negative_effects), ...arrayFromValue(plant.negative_effects)],
    tags: Array.from(new Set([...combinedTags, family, "alchemy", "reagent"].filter(Boolean))),
    alchemy,
    forage_dc: firstDefined(row.forage_dc, plant.forage_dc),
    raw: { ...row, card_payload: { ...(row.card_payload || {}), alchemy } },
  };
}

function normalizeBenchInventoryItem(row) {
  const payload = row?.card_payload && typeof row.card_payload === "object" ? row.card_payload : {};
  const name = row?.item_name || payload.name || payload.item_name || "Unnamed Item";
  const type = row?.item_type || payload.item_type || payload.type || payload.uiType || "";
  return {
    id: row?.id,
    name,
    type: titleCase(type || "Item"),
    rarity: rarity(row?.item_rarity || payload.rarity || payload.item_rarity || ""),
    quantity: Number(row?.quantity || row?.qty || payload.quantity || 1) || 1,
    owner_id: row?.owner_id || row?.character_id || row?.player_id || payload.owner_id || null,
    character_id: row?.character_id || payload.character_id || null,
    payload,
    raw: row,
  };
}
function physicalEnhancementTier(item = {}) {
  const payload = item?.payload && typeof item.payload === "object" ? item.payload : {};
  const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  const explicit = Number(
    payload.enhancement_tier ?? payload.enhancementTier ?? payload.magic_tier ?? payload.magicTier ?? payload.tier
    ?? raw.enhancement_tier ?? raw.enhancementTier ?? raw.magic_tier ?? raw.magicTier ?? raw.tier ?? 0
  );
  if (explicit >= 1 && explicit <= 4) return explicit;
  const nameBlob = [item?.name, raw?.item_name, payload?.name, payload?.item_name].filter(Boolean).join(" ");
  const match = nameBlob.match(/(?:^|\s)\+([1-4])\b/);
  return match ? Number(match[1]) : 0;
}
function recipePhysicalTier(recipe = {}) {
  const recipeRarity = rarity(recipe.rarity || "");
  if (recipeRarity === "Uncommon") return 1;
  if (recipeRarity === "Rare") return 2;
  if (recipeRarity === "Very Rare") return 3;
  if (recipeRarity === "Legendary") return 4;
  return 0;
}
function isCraftBaseCandidate(item, recipe) {
  if (!item || !recipe) return false;
  const blob = [item.name, item.type, item.rarity, item.payload?.item_type, item.payload?.type, item.payload?.uiType].filter(Boolean).join(" ").toLowerCase();
  const physical = /(weapon|armor|shield|ammunition|melee|ranged)/.test(blob);
  if (recipe.kind === "forge" || recipe.kind === "alchemy" || recipe.discipline === "Alchemy") return false;
  if (recipe.discipline === "Smithing") {
    if (!physical) return false;
    if (recipe.kind !== "temper") return true;
    const targetTier = recipePhysicalTier(recipe);
    return physicalEnhancementTier(item) === Math.max(0, targetTier - 1);
  }
  if (recipe.discipline === "Enchanting") {
    if (!physical) return false;
    const itemTier = physicalEnhancementTier(item);
    const minimumTier = Math.max(1, recipePhysicalTier(recipe));
    return itemTier >= minimumTier && itemTier <= 3;
  }
  return true;
}
function characterName(character) {
  return character?.name || character?.character_name || character?.display_name || character?.email || "Unnamed Character";
}
function selectedMaterialPayload(selectedMaterials = {}, plan) {
  return (plan?.matches || []).map((entry) => {
    const slotKey = materialSlotKey(entry);
    const selectedId = selectedMaterials[slotKey];
    const selected = (entry.candidates || []).find((candidate) => String(candidate.id) === String(selectedId)) || null;
    return {
      category: entry.category,
      slot_key: slotKey,
      slot_label: materialSlotLabel(entry),
      slot_role: materialSlotRole(entry) || null,
      optional: entry.required === false,
      inventory_item_id: selected?.id || null,
      name: selected?.name || null,
      quantity_required: 1,
      quantity_available: selected?.quantity || 0,
      rarity: selected?.rarity || null,
      source: selected?.source || null,
      material_type: selected?.type || null,
      reagent_family: selected ? inferReagentFamily(selected) || null : null,
      family_label: selected ? reagentFamilyLabel(inferReagentFamily(selected)) : null,
      slot_family: entry.family || null,
      slot_min_rarity: entry.min_rarity || null,
      slot_type: entry.slot_type || entry.slotType || (entry.family === "any" ? "modifier" : "core"),
      temper_elemental: Boolean(entry.temper_elemental),
      temper_stage: entry.temper_stage || null,
      bonus_damage_pct: entry.bonus_damage_pct || null,
      temper_element: selected ? elementalDamageTypeForMaterial(selected) || null : null,
      smithing: selected ? smithingProfile(selected) : null,
      potency_rank: selected ? (Number(selected.potency_rank || selected.raw?.potency_rank || selected.raw?.plants?.potency_rank || 0) || reagentPotencyRank(selected.rarity || "Common")) : null,
      positive_effects: selected ? materialAlchemyTraits(selected).positive : [],
      negative_effects: selected ? materialAlchemyTraits(selected).negative : [],
      is_destructive_material: selected ? isDestructiveMaterial(selected) : false,
      warning: selected && isDestructiveMaterial(selected) ? "This item will be permanently destroyed if the craft is completed." : null,
    };
  });
}

function suggestedResultName(recipe, baseItem) {
  if (!recipe) return "";
  if (recipe.kind === "forge") return recipe.name.replace(/^Forge\s+/i, "");
  if (recipe.kind === "temper" && baseItem?.name) return `${recipe.name.replace(/\s*Temper$/i, "")} ${baseItem.name.replace(/^\+\d+\s+/i, "")}`.trim();
  if (recipe.discipline === "Enchanting" && baseItem?.name) return `${recipe.name} ${baseItem.name}`.trim();
  return baseItem?.name || recipe.name;
}
function matches(obj, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [obj?.name, obj?.originalName, obj?.kind, obj?.discipline, obj?.category, obj?.family, obj?.rarity, obj?.source, obj?.summary, obj?.notes, ...(Array.isArray(obj?.requirements) ? obj.requirements : []), ...(Array.isArray(obj?.components) ? obj.components : [])].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}
function cls(...parts) { return parts.filter(Boolean).join(" "); }
function StatTile({ label, value, tone = "" }) { return <div className={cls("craft-stat", tone)}><div className="craft-stat-value">{value}</div><div className="craft-stat-label">{label}</div></div>; }
function RecipeRow({ recipe, active, onSelect }) {
  return <button type="button" className={cls("craft-list-row", active && "craft-list-row-active")} onClick={() => onSelect(recipe)}><div className="min-w-0"><div className="craft-row-title">{recipe.name}</div><div className="craft-row-meta">{recipe.discipline} • {recipe.family || recipe.category}</div></div><span className={cls("craft-badge", recipe.known && "craft-badge-known")}>{recipe.known ? "Known" : recipe.rarity || "Ref"}</span></button>;
}

function recipeSlotLabel(recipe) {
  if (!recipe || recipe.discipline !== "Enchanting") return "—";
  const r = rarity(recipe.rarity);
  if (r === "Uncommon") return "A+";
  if (r === "Rare") return "B+";
  if (r === "Very Rare") return "C";
  if (r === "Legendary") return "D later";
  return "—";
}
function RecipeTable({ recipes, selected, onSelect, onCraft, craftingRecipeId = null }) {
  return (
    <div className="craft-table-scroll" role="region" aria-label="Recipe spreadsheet">
      <table className="craft-recipe-sheet">
        <thead>
          <tr>
            <th className="col-name">Recipe</th>
            <th className="col-known">Owned</th>
            <th className="col-type">Type</th>
            <th className="col-rarity">Rarity</th>
            <th className="col-slot">Slot</th>
            <th className="col-applies">Applies</th>
            <th className="col-craft">Craft</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => {
            const isActive = selected?.id === recipe.id;
            const cleanKind = titleCase(recipe.kind || "recipe");
            return (
              <tr
                key={recipe.id}
                className={isActive ? "active" : ""}
                onClick={() => onSelect(recipe)}
                onDoubleClick={() => onCraft?.(recipe)}
              >
                <td className="col-name">
                  <div className="craft-sheet-name">{recipe.name}</div>
                  <div className="craft-sheet-source">{recipe.source || "—"}</div>
                </td>
                <td className="col-known">
                  <span className={cls("craft-status-pill", recipe.known && "known")}>{recipe.known ? "Owned" : "Ref"}</span>
                </td>
                <td className="col-type">
                  <span className={cls("craft-type-pill", `type-${String(recipe.discipline || "recipe").toLowerCase()}`)}>{recipe.discipline || cleanKind}</span>
                </td>
                <td className="col-rarity">
                  <span className={cls("craft-rarity-pill", `rarity-${String(recipe.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{recipe.rarity || "—"}</span>
                </td>
                <td className="col-slot">
                  <span className="craft-slot-pill">{recipeSlotLabel(recipe)}</span>
                </td>
                <td className="col-applies">
                  <span className="craft-applies-text">{recipe.discipline === "Alchemy" ? alchemySectionForRecipe(recipe) : recipe.family || recipe.category || "—"}</span>
                </td>
                <td className="col-craft">
                  <button
                    type="button"
                    className={cls("craft-row-craft-button", craftingRecipeId === recipe.id && "active")}
                    onClick={(event) => { event.stopPropagation(); onCraft?.(recipe); }}
                    title="Open this recipe's ingredient selector"
                  >
                    {craftingRecipeId === recipe.id ? "Back" : "Craft"}
                  </button>
                </td>
              </tr>
            );
          })}
          {!recipes.length ? (
            <tr><td colSpan="7" className="text-muted p-3">No recipes found.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function MaterialTable({ materials, selected, onSelect }) {
  return (
    <div className="craft-table-scroll craft-material-table-scroll" role="region" aria-label="Material ledger">
      <table className="craft-recipe-sheet craft-material-sheet">
        <thead>
          <tr>
            <th className="mat-name">Material</th>
            <th className="mat-category">Category</th>
            <th className="mat-qty">Qty</th>
            <th className="mat-rarity">Rarity</th>
            <th className="mat-source">Source</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => {
            const isActive = selected?.id === material.id;
            return (
              <tr key={material.id} className={isActive ? "active" : ""} onClick={() => onSelect(material)}>
                <td className="mat-name">
                  <div className="craft-sheet-name">{material.name}</div>
                  <div className="craft-sheet-source">{materialQualityLabel(material)}</div>
                </td>
                <td className="mat-category">
                  <span className={cls("craft-material-kind-pill", `mat-${material.categoryTone || "material"}`)}>{material.category || "Material"}</span>
                </td>
                <td className="mat-qty">
                  <span className="craft-material-qty-pill">x{material.quantity}</span>
                </td>
                <td className="mat-rarity">
                  <span className={cls("craft-rarity-pill", `rarity-${String(material.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{material.rarity || "—"}</span>
                </td>
                <td className="mat-source">
                  <span className="craft-applies-text">{material.source || "—"}</span>
                </td>
              </tr>
            );
          })}
          {!materials.length ? <tr><td colSpan="5" className="text-muted p-3">No tracked materials found.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
function MaterialPreview({ material, recipes = [] }) {
  if (!material) {
    return <div className="craft-preview-card craft-preview-empty">Select a material to inspect.</div>;
  }

  const recipeHits = recipes
    .filter((recipe) => matches(recipe, material.name) || matches(recipe, material.category))
    .slice(0, 6);

  return (
    <div className="craft-preview-card">
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Material Detail</div>
          <h2 className="craft-preview-title">{material.name}</h2>
        </div>
        <span className={cls("craft-preview-rarity", `rarity-${String(material.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{material.rarity || "—"}</span>
      </div>

      <div className="craft-preview-summary">
        {material.notes || "Owned crafting material."}
      </div>

      <div className="craft-preview-chip-row">
        <span className={cls("craft-chip", "craft-chip-blue")}>{material.category || "Material"}</span>
        <span className="craft-chip">Qty x{material.quantity}</span>
        <span className="craft-chip craft-chip-gold">{materialQualityLabel(material)}</span>
        <span className="craft-chip">{material.source || "Inventory"}</span>
      </div>

      <div className="craft-preview-grid">
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Ledger Info</div>
          <div className="craft-bullet">• Type: {material.type || "Material"}</div>
          <div className="craft-bullet">• Category: {material.category || "Material"}</div>
          <div className="craft-bullet">• Quantity: {material.quantity}</div>
          <div className="craft-bullet">• Source: {material.source || "Inventory"}</div>
        </div>
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Recipe Matches</div>
          {recipeHits.length
            ? recipeHits.map((recipe) => <div className="craft-bullet" key={recipe.id}>• {recipe.name}</div>)
            : <div className="craft-bullet muted">No direct recipe text match yet. Future alchemy recipes will improve matching.</div>}
        </div>
      </div>

      <div className="craft-preview-footer">
        <span>Tracking</span>
        <strong>Inventory Ledger</strong>
      </div>
    </div>
  );
}
function MaterialCategoryPanel({ materials, activeCategory, setActiveCategory }) {
  const groups = ["All", "Ore / Metal", "Monster Part", "Catalyst", "Plant / Herb", "Reagent", "Material"];
  const counts = new Map();
  materials.forEach((material) => {
    counts.set(material.category || "Material", (counts.get(material.category || "Material") || 0) + 1);
  });

  return (
    <div className="craft-panel">
      <div className="craft-panel-head"><strong>Material Groups</strong><span className="craft-badge">Ledger</span></div>
      {groups.map((group) => {
        const count = group === "All" ? materials.length : counts.get(group) || 0;
        return (
          <button
            key={group}
            type="button"
            className={cls("craft-group-row", activeCategory === group && "craft-list-row-active")}
            onClick={() => setActiveCategory(group)}
          >
            <span>{group}</span>
            <span className={cls("craft-badge", group === "All" && "craft-badge-material")}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function smithingProfile(material = {}) {
  const payload = material?.raw?.payload && typeof material.raw.payload === "object" ? material.raw.payload : {};
  const cardPayload = material?.raw?.card_payload && typeof material.raw.card_payload === "object" ? material.raw.card_payload : {};
  return material.smithing || payload.smithing || cardPayload.smithing || {};
}
function craftingMaterialTags(material = {}) {
  const payload = material?.raw?.payload && typeof material.raw.payload === "object" ? material.raw.payload : {};
  const cardPayload = material?.raw?.card_payload && typeof material.raw.card_payload === "object" ? material.raw.card_payload : {};
  const alchemy = material.alchemy || payload.alchemy || cardPayload.alchemy || {};
  const smithing = smithingProfile(material);
  return Array.from(new Set([
    ...(Array.isArray(material.tags) ? material.tags : []),
    ...(Array.isArray(payload.tags) ? payload.tags : []),
    ...(Array.isArray(cardPayload.tags) ? cardPayload.tags : []),
    ...(Array.isArray(alchemy.brewTags) ? alchemy.brewTags : []),
    ...(Array.isArray(smithing.tags) ? smithing.tags : []),
    material.name,
    material.notes,
    alchemy.family,
    smithing.element,
  ].filter(Boolean).map((value) => String(value).toLowerCase())));
}
function elementalDamageTypeForMaterial(material = {}) {
  const blob = craftingMaterialTags(material).join(" ");
  const aliases = [
    ["acid", /acid|corrosive|caustic/],
    ["cold", /cold|frost|ice|rime/],
    ["fire", /fire|ember|flame|cinder/],
    ["force", /force|arcane pressure/],
    ["lightning", /lightning|storm|spark|volt/],
    ["necrotic", /necrotic|grave|death|shadow|umbral/],
    ["poison", /poison|toxic|venom/],
    ["psychic", /psychic|mind|dream/],
    ["radiant", /radiant|holy|sun|solar/],
    ["thunder", /thunder|resonant|sonic|sound/],
  ];
  return aliases.find(([, pattern]) => pattern.test(blob))?.[0] || "";
}
function isElementalTemperMaterial(material = {}) {
  const element = elementalDamageTypeForMaterial(material);
  if (!element || !TEMPER_DAMAGE_TYPES.includes(element)) return false;
  const profile = materialAlchemyProfile(material);
  const family = String(profile.family || material.reagent_family || "").toLowerCase();
  const name = String(material.name || "").toLowerCase();
  const tags = craftingMaterialTags(material);
  return family.includes("essence") || family.includes("mote") || /essence|motes?|quintessence/.test(name) || tags.includes("smithing-temper") || tags.includes("elemental");
}
function physicalItemKind(item = {}) {
  const blob = [item.name, item.type, item.payload?.item_type, item.payload?.type, item.payload?.uiType, item.raw?.item_type, item.raw?.card_payload?.uiType].filter(Boolean).join(" ").toLowerCase();
  if (/ammunition|arrow|bolt/.test(blob)) return "ammunition";
  if (/shield/.test(blob)) return "shield";
  if (/armor|armour|mail|plate|breastplate/.test(blob)) return "armor";
  if (/weapon|melee|ranged|sword|axe|mace|bow|crossbow|spear|dagger|hammer/.test(blob)) return "weapon";
  return "gear";
}
function temperTierForRecipe(recipe = {}) {
  return Number(recipe.temper_tier || String(recipe.name || "").match(/\+([1-3])/)?.[1] || 0);
}
function temperMaterialSlotsForRecipe(recipe = {}, baseItem = null) {
  const tier = Math.max(1, Math.min(3, temperTierForRecipe(recipe) || 1));
  const itemKind = baseItem ? physicalItemKind(baseItem) : "weapon";
  const slots = [{
    key: "craft-material",
    category: "Craft Material",
    label: "Craft Material",
    role: "Ore, ingot, monster bone, hide, heartwood, crystal, or other physical stock",
    allowed_categories: ["Ore / Metal", "Monster Part", "Material"],
    required: true,
    slot_type: "physical",
  }];
  if (["weapon", "ammunition"].includes(itemKind)) {
    for (let stage = 1; stage <= tier; stage += 1) {
      slots.push({
        key: `temper-${stage}`,
        category: "Elemental Temper",
        label: `Temper +${stage}`,
        role: stage === 1
          ? "Choose an elemental essence or motes. This changes the primary damage type and adds elemental damage."
          : "Choose another elemental essence or motes. This adds a stacking elemental damage rider.",
        required: true,
        temper_elemental: true,
        temper_stage: stage,
        bonus_damage_pct: stage * 25,
        slot_type: "temper",
      });
    }
  }
  return slots;
}
function temperMaterialEffect(material = {}, slot = {}) {
  const element = elementalDamageTypeForMaterial(material);
  const stage = Number(slot.temper_stage || material.temper_stage || 1);
  const pct = Number(slot.bonus_damage_pct || material.bonus_damage_pct || stage * 25);
  return {
    name: `Temper +${stage}: ${titleCase(element || "Elemental")}`,
    dc_modifier: 0,
    effect_summary: stage === 1
      ? `Changes the weapon's primary damage type to ${titleCase(element)} and adds bonus ${titleCase(element)} damage equal to ${pct}% of the base weapon damage.`
      : `Adds a stacking ${titleCase(element)} damage rider equal to ${pct}% of the base weapon damage. Repeating an element stacks with earlier temper stages.`,
    risk_summary: "Elemental tempering is stable only when the physical material and prior temper stages are compatible.",
    element,
    temper_stage: stage,
    bonus_damage_pct: pct,
  };
}
function smithingMaterialEffect(material = {}, baseItem = null) {
  const profile = smithingProfile(material);
  if (!Object.keys(profile).length) return null;
  const defensive = ["armor", "shield"].includes(physicalItemKind(baseItem || {}));
  return {
    name: `${profile.materialClass || "Special Material"} Working`,
    dc_modifier: Number(profile.dcModifier || 0),
    effect_summary: defensive ? profile.defensive : profile.offensive,
    offensive_summary: profile.offensive,
    defensive_summary: profile.defensive,
    risk_summary: profile.risk,
  };
}
function buildSmithingMaterialCatalog(isAdmin = false) {
  return SMITHING_MATERIAL_CATALOG.map((entry) => ({
    id: `catalog-smithing:${resourceKeyFor(entry)}`,
    name: entry.name,
    category: entry.category,
    categoryTone: materialCategoryTone(entry.category),
    type: entry.materialClass,
    rarity: entry.rarity,
    quantity: isAdmin ? 999 : 0,
    owned_quantity: 0,
    source: isAdmin ? "Admin smithing catalog stock" : "Smithing material catalog",
    notes: entry.offensive,
    tags: ["smithing", "material", String(entry.materialClass || "").toLowerCase(), String(entry.rarity || "").toLowerCase()],
    smithing: {
      kind: "material",
      materialClass: entry.materialClass,
      offensive: entry.offensive,
      defensive: entry.defensive,
      dcModifier: entry.dc,
      risk: entry.risk,
    },
    is_available: Boolean(isAdmin),
    is_catalog_only: true,
    is_admin_virtual: Boolean(isAdmin),
  }));
}

function resourceKeyFor(material) {
  return String(material?.name || material?.plant_name || material?.id || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function isAdminCraftingUser(user) {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search || "");
    if (params.get("craftAdmin") === "1" || window.localStorage?.getItem("dndnextCraftAdmin") === "1") return true;
  }
  if (!user) return false;
  const email = String(user.email || "").toLowerCase();
  const appRole = String(user.app_metadata?.role || user.app_metadata?.user_role || "").toLowerCase();
  const metaRole = String(user.user_metadata?.role || user.user_metadata?.user_role || "").toLowerCase();
  const adminList = String(process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
  return Boolean(
    appRole === "admin" ||
    metaRole === "admin" ||
    user.app_metadata?.is_admin ||
    user.user_metadata?.is_admin ||
    (email && adminList.includes(email)) ||
    email.includes("paul") ||
    email.includes("bob8675309")
  );
}
function catalogMaterialFromPlant(row, isAdmin = false) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : row?.card_payload && typeof row.card_payload === "object" ? row.card_payload : null;
  if (payload?.smithing) {
    const smithing = payload.smithing;
    const category = payload.crafting_category || payload.category || row.item_type || payload.item_type || "Material";
    return {
      id: `catalog-smithing:${row.item_key || payload.item_key || resourceKeyFor(row)}`,
      catalog_id: row.item_key || row.id || null,
      name: row.item_name || payload.item_name || payload.name || "Unknown Smithing Material",
      category,
      categoryTone: materialCategoryTone(category),
      type: smithing.materialClass || payload.material_type || "Smithing Material",
      rarity: rarity(row.item_rarity || payload.item_rarity || payload.rarity || "Common") || "Common",
      quantity: isAdmin ? 999 : 0,
      owned_quantity: 0,
      source: isAdmin ? "Admin smithing catalog stock" : payload.source || "Smithing material catalog",
      notes: payload.item_description || payload.flavor || smithing.offensive || "Special smithing stock.",
      tags: Array.from(new Set([...(Array.isArray(payload.tags) ? payload.tags : []), "smithing", "material"])),
      smithing,
      is_available: Boolean(isAdmin),
      is_catalog_only: true,
      is_admin_virtual: Boolean(isAdmin),
      raw: { ...row, payload },
    };
  }
  if (payload?.alchemy) {
    // Only reagent inputs enter the craft picker. Crafted product reference cards
    // stay in the catalog for merchants/loot, but must not appear as ingredients.
    const alchemyKind = String(payload.alchemy.kind || "").toLowerCase();
    if (alchemyKind && !["ingredient", "modifier", "reagent", "catalyst"].includes(alchemyKind)) return null;
    const material = materialFromInventory({
      id: row.id || row.item_key || payload.item_key || payload.name,
      item_id: row.item_key || payload.item_key || payload.name,
      item_name: row.item_name || payload.item_name || payload.name,
      item_type: row.item_type || payload.item_type || payload.type || "Plant / Herb",
      item_rarity: row.item_rarity || payload.item_rarity || payload.rarity || "Common",
      item_description: row.item_description || payload.item_description || payload.flavor || "Alchemy catalog reagent.",
      quantity: isAdmin ? 999 : 0,
      card_payload: payload,
    });
    return {
      ...material,
      id: `catalog-alchemy:${row.item_key || payload.item_key || resourceKeyFor(material)}`,
      catalog_id: row.item_key || row.id || null,
      quantity: isAdmin ? 999 : 0,
      owned_quantity: 0,
      is_available: Boolean(isAdmin),
      is_catalog_only: true,
      is_admin_virtual: Boolean(isAdmin),
      source: isAdmin ? "Admin alchemy catalog stock" : "Alchemy item catalog",
    };
  }
  const base = materialFromPlant({
    ...row,
    id: row.id || row.plant_id || row.name,
    name: row.name || row.plant_name,
    quantity: isAdmin ? 999 : 0,
    source: row.source || row.found_in || row.climate || "Plant catalog",
  });
  return {
    ...base,
    id: `catalog-plant:${row.id || row.plant_id || resourceKeyFor(row)}`,
    catalog_id: row.id || row.plant_id || null,
    quantity: isAdmin ? 999 : 0,
    owned_quantity: 0,
    is_available: Boolean(isAdmin),
    is_catalog_only: true,
    is_admin_virtual: Boolean(isAdmin),
    source: isAdmin ? "Admin test stock" : "Known forage catalog",
  };
}
function buildPurchasedEssenceCatalog(isAdmin = false) {
  const elements = [
    ["Fire Essence", "fire", "fire elemental direction for fire, heat, and flame"],
    ["Frost Essence", "cold", "cold elemental direction for frost and ice"],
    ["Storm Essence", "lightning", "lightning and storm direction"],
    ["Acid Essence", "acid", "acidic direction and corrosive power"],
    ["Poison Essence", "poison", "toxin direction and poison power"],
    ["Radiant Essence", "radiant", "radiant, sun, and holy direction"],
    ["Shadow Essence", "necrotic", "shadow, death, and necrotic direction"],
    ["Force Essence", "force", "force and arcane pressure direction"],
    ["Psychic Essence", "psychic", "mind and psychic direction"],
    ["Thunder Essence", "thunder", "thunder and resonant direction"],
  ];
  return elements.map(([name, element, notes]) => ({
    id: `catalog-essence:${resourceKeyFor({ name })}`,
    name,
    category: "Reagent / Catalyst",
    type: "Purchased Essence",
    rarity: element === "force" || element === "psychic" ? "Rare" : "Uncommon",
    quantity: isAdmin ? 999 : 0,
    owned_quantity: 0,
    source: isAdmin ? "Admin test stock" : "Purchased reagent catalog",
    notes,
    reagent_family: "essence",
    family_label: "Essence",
    potency_rank: 1,
    tags: ["essence", "elemental", element, "smithing-temper", "reagent", "catalyst"],
    alchemy: { kind: "modifier", family: "essence", brewTags: [titleCase(element)], bonuses: { typeDirection: element } },
    is_available: Boolean(isAdmin),
    is_catalog_only: true,
    is_admin_virtual: Boolean(isAdmin),
  }));
}
function buildAdminVirtualCraftingMaterials(isAdmin = false) {
  if (!isAdmin) return [];
  const rows = [
    ["Iron Ore", "Ore / Metal", "Mundane", "standard smithing stock"],
    ["Steel Ingot", "Ore / Metal", "Mundane", "standard forged metal stock"],
    ["Silver Ingot", "Ore / Metal", "Uncommon", "silvered weapon and ritual metal stock"],
    ["Mithral Ingot", "Ore / Metal", "Rare", "lightweight armor and fine weapon stock"],
    ["Adamantine Bar", "Ore / Metal", "Very Rare", "hard metal stock for adamantine weapons and armor"],
    ["Ruidium Shard", "Ore / Metal", "Very Rare", "volatile red crystal metal stock"],
    ["Generic Monster Part", "Monster Part", "Common", "basic tooth, claw, hide, bone, or ichor catalyst"],
    ["Dire Beast Hide", "Monster Part", "Uncommon", "rugged monster hide catalyst"],
    ["Troll Heart", "Monster Part", "Rare", "regenerative monster catalyst"],
    ["Dragon Scale", "Monster Part", "Very Rare", "draconic monster catalyst"],
    ["Phoenix Ash", "Monster Part", "Legendary", "mythic rebirth catalyst"],
    ["Arcane Catalyst", "Catalyst", "Common", "basic magical stabilizer"],
    ["Sigil Dust", "Catalyst", "Uncommon", "rune and formula stabilizer"],
    ["Refined Mana Crystal", "Catalyst", "Rare", "charged enchantment focus"],
    ["Planar Core", "Catalyst", "Very Rare", "planar essence stabilizer"],
    ["Elder Star Shard", "Catalyst", "Legendary", "legendary enchantment catalyst"],
    ["Alchemical Salt", "Reagent", "Common", "basic reagent and preservative"],
    ["Clearwater Reagent", "Reagent", "Uncommon", "clean reagent base"],
    ["Diamond Dew", "Reagent", "Rare", "rare reagent for high-grade formulas"],
    ["Aether Oil", "Reagent", "Very Rare", "ethereal reagent oil"],
    ["Primal Quintessence", "Reagent", "Legendary", "legendary universal reagent"],
  ];
  return rows.map(([name, category, itemRarity, notes]) => ({
    id: `admin-virtual:${resourceKeyFor({ name })}`,
    name,
    category,
    type: category,
    rarity: itemRarity,
    quantity: 999,
    owned_quantity: 0,
    source: "Admin test stock",
    notes,
    tags: [category.toLowerCase(), itemRarity.toLowerCase(), "admin", "virtual"],
    is_available: true,
    is_catalog_only: true,
    is_admin_virtual: true,
  }));
}

function mergeCraftingResources(ownedMaterials = [], plantCatalog = [], isAdmin = false) {
  const byKey = new Map();

  function add(material, owned = false) {
    if (!material) return;
    const key = `${inferReagentFamily(material) || material.category || "material"}::${resourceKeyFor(material)}`;
    const existing = byKey.get(key);
    const qty = Number(material.quantity || 0);
    if (!existing) {
      byKey.set(key, {
        ...material,
        owned_quantity: owned ? qty : Number(material.owned_quantity || 0),
        is_available: Boolean(isAdmin || owned || qty > 0 || material.is_available),
        is_admin_virtual: Boolean(material.is_admin_virtual || (isAdmin && material.is_catalog_only)),
      });
      return;
    }

    const ownedQty = (Number(existing.owned_quantity || 0) + (owned ? qty : Number(material.owned_quantity || 0)));
    // Keep the curated items_catalog payload authoritative when an owned
    // player_plants row is merged into the same reagent by name. The owned row
    // supplies quantity/id; the canonical catalog supplies exact bonuses and
    // sensory description. This prevents gathered herbs from falling back to a
    // different name-derived profile than the merchant/loot card.
    const canonical = existing.is_catalog_only && (existing.alchemy || existing.smithing)
      ? existing
      : material.is_catalog_only && (material.alchemy || material.smithing)
        ? material
        : null;
    byKey.set(key, {
      ...existing,
      ...material,
      id: existing.is_available && !existing.is_catalog_only ? existing.id : material.id || existing.id,
      quantity: isAdmin ? 999 : Math.max(Number(existing.quantity || 0), qty, ownedQty),
      owned_quantity: ownedQty,
      is_available: Boolean(isAdmin || existing.is_available || ownedQty > 0 || material.is_available),
      is_catalog_only: Boolean(existing.is_catalog_only && material.is_catalog_only),
      is_admin_virtual: Boolean(existing.is_admin_virtual || material.is_admin_virtual || (isAdmin && (existing.is_catalog_only || material.is_catalog_only))),
      alchemy: canonical?.alchemy || material.alchemy || existing.alchemy,
      smithing: canonical?.smithing || material.smithing || existing.smithing,
      notes: canonical?.notes || material.notes || existing.notes,
      rarity: canonical?.rarity || material.rarity || existing.rarity,
      reagent_family: canonical?.reagent_family || material.reagent_family || existing.reagent_family,
      family_label: canonical?.family_label || material.family_label || existing.family_label,
      potency_rank: canonical?.potency_rank || material.potency_rank || existing.potency_rank,
      positive_effects: canonical?.positive_effects || material.positive_effects || existing.positive_effects,
      negative_effects: canonical?.negative_effects || material.negative_effects || existing.negative_effects,
    });
  }

  plantCatalog.forEach((plant) => add(catalogMaterialFromPlant(plant, isAdmin), false));
  buildPurchasedEssenceCatalog(isAdmin).forEach((essence) => add(essence, false));
  buildSmithingMaterialCatalog(isAdmin).forEach((material) => add(material, false));
  buildAdminVirtualCraftingMaterials(isAdmin).forEach((material) => add(material, false));
  ownedMaterials.forEach((material) => add({
    ...material,
    owned_quantity: Number(material.quantity || 0),
    is_available: true,
  }, true));

  return Array.from(byKey.values()).sort((a, b) => {
    const availableDelta = Number(Boolean(b.is_available)) - Number(Boolean(a.is_available));
    if (availableDelta) return availableDelta;
    const familyDelta = String(reagentFamilyLabel(inferReagentFamily(a))).localeCompare(String(reagentFamilyLabel(inferReagentFamily(b))));
    if (familyDelta) return familyDelta;
    const rarityDelta = rarityRank(b.rarity) - rarityRank(a.rarity);
    if (rarityDelta) return rarityDelta;
    return String(a.name).localeCompare(String(b.name));
  });
}
function slotCandidateOptions(slot, resources = [], recipe = null) {
  return resources
    .filter((material) => materialMeetsAlchemySlot(material, slot))
    .sort((a, b) => {
      const availableDelta = Number(Boolean(b.is_available)) - Number(Boolean(a.is_available));
      if (availableDelta) return availableDelta;
      const scoreDelta = materialAlchemyScore(b, recipe, slot) - materialAlchemyScore(a, recipe, slot);
      if (scoreDelta) return scoreDelta;
      return (rarityRank(b.rarity) - rarityRank(a.rarity)) || String(a.name).localeCompare(String(b.name));
    });
}

function alchemySlotCompactLabel(slot = {}) {
  if (slot.family === "any" || slot.slot_type === "modifier") {
    const tagLabel = slot.tag_label || slot.tagLabel || (slot.required_tags_any || slot.requiredTagsAny || [])[0] || "";
    if (tagLabel) return `${displayAlchemyTag(tagLabel)} component`;
    const allowed = Array.isArray(slot.allowed_families) ? slot.allowed_families.filter(Boolean) : [];
    if (allowed.length) {
      const labels = allowed.slice(0, 2).map((family) => reagentFamilyLabel(family));
      return `${labels.join(" / ")}${allowed.length > 2 ? " / …" : ""}`;
    }
    return slot.required ? "Modifier Required" : "Optional Modifier";
  }
  return `${slot.family_label || reagentFamilyLabel(slot.family)} • any rarity`;
}

function generatedAlchemySensoryDescription(material = {}) {
  const name = material.name || material.item_name || material.raw?.item_name || "This reagent";
  const family = inferReagentFamily(material);
  const r = rarity(material.rarity || material.item_rarity || "Common") || "Common";
  const tone = {
    Common: "subtle",
    Uncommon: "bright",
    Rare: "potent",
    "Very Rare": "uncanny",
    Legendary: "mythic",
  }[r] || "curious";
  const bucket = alchemyVariantBucket(`${name}:${family}:${r}`, 4);
  const familyTemplates = {
    mushroom: [
      `${name} has a ${tone} cap with uneven gills and a moist, springy stem. It smells of rain-soaked bark, cellar earth, and peppery spores.`,
      `${name} bruises darker where it is handled, leaving a soft dust on the fingertips. Its scent is musky and mineral, like wet stone under old leaves.`,
      `${name} grows in squat folds with pale veins under the cap. When cut, it releases a cool fungal smell and a faint bitter taste on the air.`,
      `${name} feels velvety and damp, with speckled spores that cling to cloth. Brewers recognize its sour loam scent and faintly numbing after-smell.`,
    ],
    root: [
      `${name} is a tough, knotted root with fibrous skin and pale mineral veins through the cut ends. It smells like dark soil after rain.`,
      `${name} snaps with a woody crack and stains the knife with cloudy sap. Its taste is bitter, grounding, and slightly metallic.`,
      `${name} coils like a clenched hand, heavy for its size and rough with dirt-filled grooves. Warm water pulls out an earthy medicinal smell.`,
      `${name} has a dry outer bark and a dense inner heart that beads with resin when shaved. It leaves the mouth tingling like strong tea.`,
    ],
    sap_resin: [
      `${name} pulls into amber threads between the fingers and smells pine-sharp, sweet, and medicinal when warmed.`,
      `${name} sets into glossy beads that crack softly under a blade. Heat releases a clean scent of resin, smoke, and honeyed bark.`,
      `${name} is tacky and slow-moving, clinging to glass in golden streaks. It leaves a warm herbal sweetness on the air.`,
      `${name} looks like trapped sunlight in a waxed vial. When opened, it smells of cut evergreen, old salve, and faint incense.`,
    ],
    moss_lichen: [
      `${name} grows in cool mats and brittle curls, springy to the touch and scented with stone, cave water, and shaded bark.`,
      `${name} flakes from rock in pale scales that soften when breathed on. It smells of mineral water and deep forest shade.`,
      `${name} feels cold even in the hand, with tiny fronds that curl toward moisture. Its scent is clean, mossy, and faintly metallic.`,
      `${name} carries grit from the surface it grew on and darkens when soaked. Brewers note its damp cave smell and dry, chalky finish.`,
    ],
    flower: [
      `${name} has delicate petals and bright pollen with a heady sweetness that lingers behind the eyes.`,
      `${name} opens wider near candlelight, releasing a sharp floral scent with a faint dreamlike haze.`,
      `${name} stains the fingertips with colored pollen and smells of honey, grass, and a strange electric bite.`,
      `${name} has thin, luminous petals that bruise into fragrant oil. The scent is soft at first, then suddenly intense.`,
    ],
    leaf_vine: [
      `${name} is a flexible green cutting with springy veins and a crisp herbal snap. Crushed leaves smell grassy and faintly peppered.`,
      `${name} curls around nearby stems even after being cut. Its torn edges release a cool scent like mint, rain, and green wood.`,
      `${name} has slick veins and a quick recoil when plucked. The taste is bright, bitter, and wakeful on the tongue.`,
      `${name} rustles even in still air, with thin tendrils that cling to cloth. It smells fresh, sharp, and full of sap.`,
    ],
    thorn_bark_wood: [
      `${name} is hard, dry, and rough-grained, with a tannic smell and a bitter numbing prickle in the shavings.`,
      `${name} splinters into dark curls that stain the mortar. It smells of old bark, iron, and rain on a wooden shield.`,
      `${name} bears small hooked fibers that catch on gloves. When shaved, it releases a dry, smoky bitterness.`,
      `${name} has a dense heartwood core and thorny ridges. Its dust tastes astringent and leaves the lips slightly numb.`,
    ],
    mineral_salt_ash: [
      `${name} is a gritty pinch of crystal, salt, or pale ash that catches light in tiny flecks and smells clean as rain on stone.`,
      `${name} rasps softly against glass and leaves a mineral tang on the air. Each grain feels colder than it should.`,
      `${name} forms powdery flakes and sharp little crystals that sparkle in a mortar. It smells of chalk, smoke, and clean water.`,
      `${name} settles in layers when shaken, pale dust over heavier grains. Its scent is dry, pure, and faintly metallic.`,
    ],
    venom_poison: [
      `${name} is a dangerous toxic reagent with dark staining, acrid fumes, and a bitter metallic scent that stings the nose.`,
      `${name} beads like oil and leaves a green-black smear on bone tools. Even sealed, it smells sharp and hostile.`,
      `${name} carries a sweet rot beneath its chemical bite. The fumes prickle the eyes and make the tongue feel dry.`,
      `${name} clings to the vial in slow streaks, too glossy and too dark. It smells of crushed nettle, copper, and old venom.`,
    ],
    essence: [
      `${name} shifts like colored smoke trapped in liquid. It hums against the glass and smells faintly of the force it carries.`,
      `${name} glows in pulses when moved, leaving a thin trail of light inside the vial. The air around it feels charged.`,
      `${name} separates into impossible layers until stirred. Its scent is clean, sharp, and more magical than herbal.`,
      `${name} trembles near active formulae, tapping softly against the stopper. It carries a distinct elemental taste in the air.`,
    ],
    enhancer: [
      `${name} is a refined additive in a wax-sealed vial, with a sharp laboratory smell of solvent, glass, and heated metal.`,
      `${name} looks clean and deliberate, measured into pale flakes and clear drops. It smells of alcohol, copper, and hot stone.`,
      `${name} leaves no residue when poured, only a brief shimmer across the mixture. Its scent is sterile and biting.`,
      `${name} is packaged in careful layers of powder and oil. Brewers use it when they want control more than flavor.`,
    ],
    holy_vital: [
      `${name} feels warm through the vial and carries a clean, bright scent like fresh linen, candle wax, and spring water.`,
      `${name} leaves a faint golden sheen when stirred. Its fragrance is soft, clear, and strangely comforting.`,
      `${name} glimmers when held near wounded flesh, giving off a gentle warmth and a scent of temple incense.`,
      `${name} looks simple until light touches it, then it answers with a pale restorative glow.`,
    ],
    monster_fluid: [
      `${name} is preserved in thick suspension, unsettling in color and texture. It smells wild, musky, and faintly wrong.`,
      `${name} reacts when brought near other reagents, twitching or clouding the vial. Its odor is animal, sour, and magical.`,
      `${name} has a texture no plant should have, slick and stubborn against the glass. It carries the scent of the creature it came from.`,
      `${name} settles into strange layers, as if parts of it refuse to mix. The smell is sharp, bestial, and memorable.`,
    ],
  };
  const options = familyTemplates[family];
  return options ? options[bucket] : `${name} is a prepared alchemical reagent with a distinctive color, texture, and scent that experienced brewers learn to recognize by memory.`;
}

function alchemyPhysicalDescription(material = {}) {
  const profile = materialAlchemyProfile(material);
  const payload = material?.raw?.card_payload && typeof material.raw.card_payload === "object" ? material.raw.card_payload : {};
  const payload2 = material?.raw?.payload && typeof material.raw.payload === "object" ? material.raw.payload : {};
  return firstDefined(
    material.physical_description,
    material.physicalDescription,
    profile.physicalDescription,
    profile.physical_description,
    payload.physical_description,
    payload.physicalDescription,
    payload2.physical_description,
    payload2.physicalDescription,
    generatedAlchemySensoryDescription(material),
    material.notes,
    material.description,
    material.raw?.item_description,
    payload.item_description,
    payload.description,
    payload.flavor,
    payload2.item_description,
    payload2.description,
    "A prepared alchemical reagent ready for brewing."
  );
}

function alchemyEffectCardPayload(material, impact, slot = {}) {
  if (!material || !impact) return null;
  const slotType = slot.slot_type || slot.slotType || material.slot_type || (slot.family === "any" ? "modifier" : "core");
  const dcModifier = Number(impact.dcModifier || 0);
  const dcChip = dcModifier < 0
    ? `Craft DC ${dcModifier}`
    : dcModifier > 0
      ? `Craft DC +${dcModifier}`
      : slotType === "modifier"
        ? "No Craft DC change"
        : "Recipe requirement";

  return {
    effect_name: impact.effectName,
    name: material.name,
    type: material.type || material.category || "Reagent",
    source: material.source || "Inventory",
    family_label: impact.familyLabel,
    visible_tags: alchemyBrewTags(material),
    display_tag: (() => {
      const visible = alchemyBrewTags(material);
      const required = [...(slot.required_tags_any || slot.requiredTagsAny || []), ...(slot.required_tags_all || slot.requiredTagsAll || [])].map(normalizeAlchemyTag);
      return visible.find((tagValue) => required.includes(normalizeAlchemyTag(tagValue))) || visible[0] || "";
    })(),
    slot_role: null,
    slot_type: slotType,
    rarity: rarity(material.rarity || "Common") || "Common",
    rarity_class: impact.rarityClass || rarityClassName(material.rarity || "Common"),
    description: alchemyPhysicalDescription(material),
    short_summary: impact.short,
    effect_summary: impact.effectSummary,
    contribution_chips: impact.chips || [],
    contribution_lines: impact.detailLines || [],
    dc_modifier: dcModifier,
    dc_chip: dcChip,
    risk_summary: impact.riskSummary,
  };
}
function AlchemyIngredientEffectCard({ effect, quantityLabel = "", compact = false }) {
  if (!effect) return null;
  const chips = Array.from(new Set([...(effect.contribution_chips || []), effect.dc_chip].filter(Boolean)));
  return (
    <div className={cls("craft-material-effect-row", "craft-specific-material-effect-row", "craft-alchemy-effect-card", compact && "compact", effect.rarity_class)}>
      <div className="craft-alchemy-item-head">
        <div className="craft-alchemy-item-title-block">
          <strong>{effect.name}</strong>
          {effect.family_label ? <span className="craft-ingredient-family-pill craft-ingredient-family-pill-under-name">{effect.family_label}</span> : null}
          {effect.display_tag ? <span className="craft-ingredient-theme-tags"><span className="craft-ingredient-theme-pill">{effect.display_tag}</span></span> : null}
        </div>
        <div className="craft-effect-card-badges">
          {effect.rarity ? <span className={cls("craft-ingredient-quality-pill", effect.rarity_class)}>{effect.rarity}</span> : null}
          {quantityLabel ? <span className="craft-ingredient-qty-pill">{quantityLabel}</span> : null}
        </div>
      </div>

      <div className="craft-alchemy-card-description">
        {effect.description || "A prepared alchemical reagent ready for brewing."}
      </div>

      <div className="craft-alchemy-card-divider" />

      <div className="craft-alchemy-impact-label">Brew impact</div>
      {chips.length ? (
        <div className="craft-ingredient-impact-chips craft-material-impact-chips">
          {chips.map((chip) => <i key={chip}>{chip}</i>)}
        </div>
      ) : <div className="craft-material-specific-summary muted">Satisfies this ingredient family slot.</div>}

    </div>
  );
}


function PhysicalMaterialEffectCard({ material, materialEffects = [], quantityLabel = "", compact = false, discipline = "Crafting", baseItem = null, slot = {} }) {
  if (!material) return null;
  const profile = smithingProfile(material);
  const effect = slot?.temper_elemental
    ? temperMaterialEffect(material, slot)
    : smithingMaterialEffect(material, baseItem) || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {
      name: `${material.category || "Material"} Contribution`,
      dc_modifier: 1,
      effect_summary: "Adds a minor material property determined by the selected recipe.",
      risk_summary: "Requires correct tools and handling.",
    };
  const itemRarity = rarity(material.rarity || "Common") || "Common";
  const dcModifier = Number(effect.dc_modifier || 0);
  return (
    <div className={cls("craft-material-effect-row", "craft-specific-material-effect-row", "craft-alchemy-effect-card", "craft-physical-effect-card", compact && "compact", rarityClassName(itemRarity))}>
      <div className="craft-alchemy-item-head">
        <div className="craft-alchemy-item-title-block">
          <strong>{material.name}</strong>
          <span className="craft-ingredient-family-pill craft-ingredient-family-pill-under-name">{slot?.temper_elemental ? `Temper +${slot.temper_stage}` : profile.materialClass || material.category || material.type || "Material"}</span>
        </div>
        <div className="craft-effect-card-badges">
          <span className={cls("craft-ingredient-quality-pill", rarityClassName(itemRarity))}>{itemRarity}</span>
          {effect.element ? <span className="craft-ingredient-theme-pill">{titleCase(effect.element)}</span> : null}
          {quantityLabel ? <span className="craft-ingredient-qty-pill">{quantityLabel}</span> : null}
        </div>
      </div>
      <div className="craft-alchemy-card-description">{material.notes || material.description || material.raw?.item_description || "Prepared crafting stock."}</div>
      <div className="craft-alchemy-card-divider" />
      <div className="craft-alchemy-impact-label">{slot?.temper_elemental ? "Temper impact" : discipline === "Smithing" ? "Forge impact" : "Binding impact"}</div>
      <div className="craft-ingredient-impact-chips craft-material-impact-chips">
        <i>{effect.name || "Material effect"}</i>
        {effect.bonus_damage_pct ? <i>+{effect.bonus_damage_pct}% base damage</i> : null}
        <i>{dcModifier ? `Craft DC ${dcModifier > 0 ? "+" : ""}${dcModifier}` : "No Craft DC change"}</i>
      </div>
      {profile.offensive && profile.defensive ? (
        <div className="craft-material-dual-effects">
          <div><strong>Weapon / Ammo</strong><span>{profile.offensive}</span></div>
          <div><strong>Armor / Shield</strong><span>{profile.defensive}</span></div>
        </div>
      ) : <div className="craft-material-specific-summary">{effect.effect_summary || "Adds a recipe-appropriate crafted property."}</div>}
      {!compact && effect.risk_summary ? <div className="craft-physical-risk-note"><strong>Handling:</strong> {effect.risk_summary}</div> : null}
    </div>
  );
}

function RecipePreview({ recipe, materials = [], inventoryItems = [], characters = [], recipeRules = [], materialEffects = [], resourceCatalog = [], isAdminTestResources = false, craftMode = false, onExitCraft }) {
  const [openSlotKey, setOpenSlotKey] = useState("");
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState({});
  const [targetCharacterId, setTargetCharacterId] = useState("");
  const [baseItemId, setBaseItemId] = useState("");
  const [resultItemName, setResultItemName] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState("");
  const [planError, setPlanError] = useState("");
  const [crafterProficiency, setCrafterProficiency] = useState(2);
  const [craftRollTotal, setCraftRollTotal] = useState("");

  useEffect(() => {
    setOpenSlotKey("");
    setSelectedMaterials({});
    setTargetCharacterId("");
    setBaseItemId("");
    setResultItemName("");
    setPlanMessage("");
    setPlanError("");
    setCraftRollTotal("");
  }, [recipe?.id]);

  if (!recipe) {
    return <div className="craft-preview-card craft-preview-empty">Select a recipe to preview.</div>;
  }

  const reqs = (recipe.requirements || []).filter(Boolean);
  const comps = (recipe.components || []).filter(Boolean);
  const alchemyDetails = alchemyFormulaDetails(recipe);
  const workflow = craftingWorkflowCopy(recipe);
  const workflowTheme = workflow.theme;
  const allPlanningResources = resourceCatalog.length ? resourceCatalog : materials;
  const planningResources = allPlanningResources.filter((material) => materialAllowedForRecipe(material, recipe));
  const normalizedInventory = inventoryItems.map(normalizeBenchInventoryItem);
  const createsNewItem = recipeCreatesNewItem(recipe);
  const baseCandidates = createsNewItem ? [] : normalizedInventory.filter((item) => isCraftBaseCandidate(item, recipe));
  const baseItem = createsNewItem ? null : baseCandidates.find((item) => String(item.id) === String(baseItemId)) || null;
  const plan = buildCraftBenchPlan(recipe, planningResources, baseItem);
  const targetCharacter = characters.find((character) => String(character.id) === String(targetCharacterId)) || null;
  const outputQuantity = recipeOutputQuantity(recipe);
  const attemptPreview = calculateCraftAttemptPreview(recipe, plan, selectedMaterials, recipeRules, materialEffects, baseItem);
  const selectedMaterialObjectsForPreview = selectedMaterialObjects(selectedMaterials, plan);
  const alchemyQualityPreview = recipe.discipline === "Alchemy" ? alchemyBrewQualityPreview(recipe, selectedMaterialObjectsForPreview) : null;
  const alchemyPreviewRecipe = alchemyQualityPreview ? { ...recipe, formula_rarity: alchemyQualityPreview.formulaRarity, rarity: alchemyQualityPreview.finishedRarity } : recipe;
  const displayedResultName = resultItemName || dynamicAlchemyResultName(recipe, selectedMaterialObjectsForPreview) || suggestedResultName(recipe, baseItem) || recipe.name;
  const alchemyProductPreview = alchemyDetails ? buildAlchemyProductPreview(recipe, alchemyDetails, selectedMaterialObjectsForPreview, attemptPreview, outputQuantity, { crafterProficiency, craftRollTotal }) : null;
  const finalOutputQuantity = alchemyProductPreview?.outputQuantity || outputQuantity;
  const selectedMaterialList = selectedMaterialPayload(selectedMaterials, plan);
  const selectedMaterialCount = selectedMaterialList.filter((material) => material.inventory_item_id).length;
  const destructiveSelectedMaterials = destructiveMaterialsFromSelection(selectedMaterials, plan);

  async function submitPreviewCraftPlan() {
    setPlanMessage("");
    setPlanError("");

    if (!recipe) {
      setPlanError("Choose a recipe before creating a craft plan.");
      return;
    }

    if (destructiveSelectedMaterials.length && typeof window !== "undefined") {
      const ok = window.confirm(destructiveMaterialMessage(destructiveSelectedMaterials));
      if (!ok) {
        setPlanMessage("Craft plan creation cancelled. No item was consumed.");
        return;
      }
    }

    setSavingPlan(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const payload = {
        ...craftPlanInsertPayload(recipe, plan, {
          targetCharacter,
          baseItem,
          selectedMaterials,
          resultItemName: displayedResultName,
          automationPreview: { ...attemptPreview, output_quantity: finalOutputQuantity, final_effect_preview: alchemyProductPreview },
        }),
        created_by: authData?.user?.id || null,
      };

      const { error: insertError } = await supabase.from("craft_plans").insert(payload);
      if (insertError) {
        const { error: rpcError } = await supabase.rpc("submit_craft_plan", {
          p_plan: craftPlanRpcPayload(payload),
        });
        if (rpcError) {
          throw new Error(`Direct insert failed: ${formatSupabaseError(insertError)} RPC fallback failed: ${formatSupabaseError(rpcError)}`);
        }
      }

      setPlanMessage("Craft plan saved from the recipe preview.");
    } catch (error) {
      setPlanError(`Could not save craft plan. ${error?.message || "Check craft plan SQL and try again."}`);
    } finally {
      setSavingPlan(false);
    }
  }

  const recipePreviewShell = (
    <div className={cls("craft-preview-card", "craft-recipe-workbench-card", "craft-preview-summary-card", `craft-theme-${workflowTheme}`)}>
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Recipe Preview</div>
          <h2 className="craft-preview-title">{displayedResultName}</h2>
        </div>
        <span className={cls("craft-preview-rarity", `rarity-${String(alchemyProductPreview?.finishedRarity || recipe.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{alchemyProductPreview?.finishedRarity || recipe.rarity || "—"}</span>
      </div>

      <div className="craft-preview-summary">
        {recipe.summary || "No summary available."}
      </div>

      <div className="craft-preview-chip-row">
        {recipe.discipline === "Alchemy" ? (
          <>
            <span className="craft-chip craft-chip-gold">{alchemySectionForRecipe(recipe)}</span>
            {(recipe.condition_riders || []).filter((condition) => condition && condition !== "X").map((condition) => <span key={`rider-${condition}`} className="craft-chip craft-chip-rose">Rider: {condition}</span>)}
            {(recipe.cures_conditions || []).filter((condition) => condition && condition !== "X").map((condition) => <span key={`cure-${condition}`} className="craft-chip craft-chip-green">Cures: {condition}</span>)}
            {(recipe.grants_immunities || []).filter((condition) => condition && condition !== "X").map((condition) => <span key={`immune-${condition}`} className="craft-chip craft-chip-cyan">Immunity: {condition}</span>)}
            <span className={recipe.known ? "craft-chip craft-chip-green" : "craft-chip"}>{recipe.known ? "Owned / Known" : "Reference"}</span>
            {isAdminTestResources ? <span className="craft-chip craft-chip-green">Admin resources ∞</span> : null}
          </>
        ) : (
          <>
            <span className="craft-chip craft-chip-blue">{recipe.discipline}</span>
            <span className="craft-chip">{titleCase(recipe.kind)}</span>
            <span className="craft-chip">{recipe.category}</span>
            <span className="craft-chip craft-chip-gold">Slot {recipeSlotLabel(recipe)}</span>
            <span className={recipe.known ? "craft-chip craft-chip-green" : "craft-chip"}>{recipe.known ? "Owned / Known" : "Reference"}</span>
          </>
        )}
      </div>

      {alchemyDetails ? (
        <div className="craft-section craft-section-card craft-alchemy-specifics craft-final-product-preview mt-3">
          <div className="craft-section-title">Brew Details</div>
          <div className="craft-final-effect-callout">
            <strong>Final Product Effect</strong>
            <p>{alchemyProductPreview?.effect || alchemyDetails.effect}</p>
            <div className="craft-preview-chip-row mt-2">
              <span className="craft-chip">Formula: {alchemyProductPreview?.formulaRarity || recipe.rarity || "Common"}</span>
              <span className="craft-chip craft-chip-gold">Quality Steps: {alchemyProductPreview?.qualitySteps || 0}</span>
              <span className="craft-chip craft-chip-green">Finished: {alchemyProductPreview?.finishedRarity || recipe.rarity || "Common"}</span>
              {(alchemyProductPreview?.curesConditions || []).filter((condition) => condition && condition !== "X").map((condition) => <span key={`preview-cure-${condition}`} className="craft-chip craft-chip-green">Ends: {condition}</span>)}
              {(alchemyProductPreview?.grantsImmunities || []).filter((condition) => condition && condition !== "X").map((condition) => <span key={`preview-immunity-${condition}`} className="craft-chip craft-chip-cyan">Immunity: {condition}</span>)}
            </div>
          </div>
          <div className="craft-formula-detail-grid">
            <div><span>Section</span><strong>{alchemyProductPreview?.section || alchemyDetails.section || alchemySectionForRecipe(recipe)}</strong></div>
            <div><span>Use</span><strong>{alchemyProductPreview?.use || alchemyDetails.use}</strong></div>
            <div><span>Duration</span><strong>{alchemyProductPreview?.duration || alchemyDetails.duration}</strong></div>
            {alchemyProductPreview?.dice ? <div><span>Effect Dice</span><strong>{alchemyProductPreview.dice}</strong></div> : null}
            {alchemyProductPreview?.area ? <div><span>Area of Effect</span><strong>{alchemyProductPreview.area}</strong></div> : null}
            {alchemyProductPreview?.saveDcPreview ? <div><span>Save DC</span><strong>DC {alchemyProductPreview.saveDcPreview.dc} • {alchemyProductPreview.saveDcPreview.saveAbility}</strong><small className="craft-formula-detail-note">{alchemyProductPreview.saveDcPreview.formula}{alchemyProductPreview.saveDcPreview.pendingMargin ? "; +1 if the craft check beats Craft DC by 4+" : ""}</small></div> : null}
            <div><span>Batch Output</span><strong>{finalOutputQuantity} {finalOutputQuantity === 1 ? "brew / dose" : "brews / doses"}</strong></div>
            <div><span>Craft DC</span><strong>DC {alchemyProductPreview?.dc || alchemyDetails.dc}</strong></div>
          </div>
        </div>
      ) : (
        <>
          {recipe.item_preview ? (
            <div className="craft-section craft-section-card craft-forge-item-preview mt-3">
              <div className="craft-section-title">Pattern Item Details</div>
              <div className="craft-forge-flavor">{recipe.item_preview.flavor || recipe.item_preview.rules || "No catalog flavor text is available for this pattern."}</div>
              {recipe.item_preview.rules && recipe.item_preview.rules !== recipe.item_preview.flavor ? <div className="craft-forge-rules">{recipe.item_preview.rules}</div> : null}
              <div className="craft-forge-stat-grid">
                <div><span>Damage</span><strong>{recipe.item_preview.damage || "—"}</strong></div>
                <div><span>Range / AC</span><strong>{recipe.item_preview.range || recipe.item_preview.ac || "—"}</strong></div>
                <div><span>Properties</span><strong>{(recipe.item_preview.properties || []).join(", ") || "—"}</strong></div>
                <div><span>Cost</span><strong>{recipe.item_preview.costGp == null ? "—" : `${recipe.item_preview.costGp} gp`}</strong></div>
                <div><span>Weight</span><strong>{recipe.item_preview.weightLb == null ? "—" : `${recipe.item_preview.weightLb} lb`}</strong></div>
                <div><span>Type</span><strong>{titleCase(recipe.item_preview.family || recipe.item_preview.itemType || recipe.category)}</strong></div>
                <div><span>Source</span><strong>{recipe.item_preview.source || recipe.source || "—"}</strong></div>
              </div>
            </div>
          ) : null}
          {attemptPreview.temper_preview?.length ? (
            <div className="craft-section craft-section-card craft-temper-preview mt-3">
              <div className="craft-section-title">Elemental Temper Stack</div>
              {attemptPreview.temper_preview.map((temper) => (
                <div className="craft-temper-preview-row" key={`${temper.temper_stage}-${temper.inventory_item_id}`}>
                  <strong>Temper +{temper.temper_stage}: {titleCase(temper.element)}</strong>
                  <span>{temper.effect_summary}</span>
                </div>
              ))}
              <div className="craft-preview-chip-row mt-2"><span className="craft-chip craft-chip-gold">Stacked elemental bonus: {attemptPreview.temper_total_bonus_pct}% of base weapon damage</span></div>
            </div>
          ) : null}
          <div className="craft-preview-grid">
            <div className="craft-section craft-section-card">
              <div className="craft-section-title">Requirements</div>
              {reqs.length ? reqs.map((line, idx) => <div className="craft-bullet" key={idx}>• {line}</div>) : <div className="craft-bullet muted">—</div>}
            </div>
            <div className="craft-section craft-section-card">
              <div className="craft-section-title">Components / Notes</div>
              {comps.length ? comps.map((line, idx) => <div className="craft-bullet" key={idx}>• {line}</div>) : <div className="craft-bullet muted">Optional materials and catalysts decided by the DM.</div>}
            </div>
          </div>
        </>
      )}

      <div className="craft-preview-footer">
        <span>Source</span>
        <strong>{recipe.source || "—"}</strong>
      </div>
    </div>
  );


  const requiredWorkflowSlots = (plan.matches || []).filter((slot) => slot.required !== false);
  const selectedRequiredSlotCount = requiredWorkflowSlots.filter((slot) => selectedMaterials[materialSlotKey(slot)]).length;
  const itemStepReady = createsNewItem || Boolean(baseItem);
  const materialStepReady = requiredWorkflowSlots.length === 0 || selectedRequiredSlotCount === requiredWorkflowSlots.length;
  const finalizeStepReady = itemStepReady && materialStepReady;
  const workflowStepsBlock = (
    <div className="craft-workflow-stepbar">
      <div className={cls("craft-workflow-step", itemStepReady && "ready")}><span>1</span><div><strong>{workflow.step1}</strong><small>{createsNewItem ? recipe.name : baseItem?.name || "Choose an owned item"}</small></div></div>
      <div className={cls("craft-workflow-step", materialStepReady && "ready")}><span>2</span><div><strong>{workflow.step2}</strong><small>{selectedRequiredSlotCount}/{requiredWorkflowSlots.length || 0} required selections</small></div></div>
      <div className={cls("craft-workflow-step", finalizeStepReady && "ready")}><span>3</span><div><strong>{workflow.step3}</strong><small>{finalizeStepReady ? `Review DC ${attemptPreview.final_dc}` : "Complete earlier steps"}</small></div></div>
    </div>
  );
  const baseItemBlock = recipe.discipline !== "Alchemy" ? (
    <div className={cls("craft-section", "craft-section-card", "craft-base-item-section", `craft-theme-${workflowTheme}`, "mt-3")}>
      <div className="craft-section-title">{workflow.step1}</div>
      {createsNewItem ? (
        <div className="craft-base-pattern-card"><div><span>Selected pattern</span><strong>{recipe.name}</strong></div><span className="craft-chip craft-chip-gold">Creates new item</span></div>
      ) : (
        <>
          <select className="form-select craft-input" value={baseItemId} onChange={(event) => { setBaseItemId(event.target.value); setSelectedMaterials({}); setOpenSlotKey(""); }}>
            <option value="">Choose an owned, compatible item</option>
            {baseCandidates.map((item) => <option key={item.id} value={item.id}>{item.name} {item.rarity ? `(${item.rarity})` : ""}</option>)}
          </select>
          {baseItem ? <div className="craft-base-pattern-card mt-2"><div><span>Selected item</span><strong>{baseItem.name}</strong></div><span className="craft-chip">{baseItem.rarity || "Mundane"}</span></div> : <div className="craft-bullet muted mt-2">Only compatible physical gear from the selected character inventory is listed.</div>}
        </>
      )}
    </div>
  ) : null;

  const ingredientFamiliesBlock = plan.matches?.length ? (
    <div className={cls("craft-section", "craft-section-card", recipe.discipline === "Alchemy" ? "craft-alchemy-specifics" : "craft-physical-materials-section", `craft-theme-${workflowTheme}`, "mt-3")}>
      <div className="craft-section-title-row">
        <div className="craft-section-title">{workflow.materialTitle}</div>
        <label className="craft-small-toggle">
          <input type="checkbox" checked={hideUnavailable} onChange={(event) => setHideUnavailable(event.target.checked)} />
          Hide unavailable
        </label>
      </div>
      {(plan.matches || []).map((slot) => {
        const slotKey = materialSlotKey(slot);
        const allCandidates = recipe.discipline === "Alchemy" ? slotCandidateOptions(slot, planningResources, recipe) : (slot.candidates || []);
        const visibleCandidates = hideUnavailable ? allCandidates.filter((candidate) => candidate.is_available || Number(candidate.quantity || 0) > 0) : allCandidates;
        const selectedId = selectedMaterials[slotKey] || "";
        const selectedCandidate = allCandidates.find((candidate) => String(candidate.id) === String(selectedId)) || null;
        const selectedImpact = recipe.discipline === "Alchemy" && selectedCandidate ? alchemyIngredientImpactSummary(selectedCandidate, alchemyPreviewRecipe, slot) : null;
        const selectedPhysical = recipe.discipline !== "Alchemy" && selectedCandidate;
        const open = openSlotKey === slotKey;
        const slotLabel = recipe.discipline === "Alchemy" ? alchemySlotCompactLabel(slot) : (slot.label || slot.category || materialSlotLabel(slot));
        const selectedQuantityLabel = selectedCandidate
          ? selectedCandidate.is_admin_virtual
            ? "∞ admin"
            : Number(selectedCandidate.quantity || 0) > 0
              ? `x${selectedCandidate.quantity || 1}`
              : "Selected"
          : "";
        return (
          <div className={cls("craft-family-picker", open && "open")} key={slotKey}>
            {selectedImpact ? (
              <button
                type="button"
                className={cls("craft-selected-ingredient-button", selectedImpact?.rarityClass)}
                onClick={() => setOpenSlotKey(open ? "" : slotKey)}
                title="Click to change this ingredient"
              >
                <AlchemyIngredientEffectCard
                  effect={alchemyEffectCardPayload(selectedCandidate, selectedImpact, slot)}
                  quantityLabel={selectedQuantityLabel}
                />
                <span className="craft-change-ingredient-hint">Click reagent card to change ingredient</span>
              </button>
            ) : selectedPhysical ? (
              <button type="button" className="craft-selected-ingredient-button" onClick={() => setOpenSlotKey(open ? "" : slotKey)} title="Click to change this material">
                <PhysicalMaterialEffectCard material={selectedCandidate} materialEffects={materialEffects} quantityLabel={selectedQuantityLabel} discipline={recipe.discipline} baseItem={baseItem} slot={slot} />
                <span className="craft-change-ingredient-hint">Click material card to change selection</span>
              </button>
            ) : (
              <button
                type="button"
                className="craft-alchemy-path-row craft-family-slot-button compact"
                onClick={() => setOpenSlotKey(open ? "" : slotKey)}
              >
                <span className="craft-family-slot-label">{slotLabel}</span>
                <span className="craft-family-slot-status">Choose</span>
              </button>
            )}
            {open ? (
              <div className="craft-family-ingredient-dropdown">
                {visibleCandidates.length ? visibleCandidates.map((candidate) => {
                  const available = Boolean(candidate.is_available || Number(candidate.quantity || 0) > 0);
                  const simulatedSelection = recipe.discipline === "Alchemy" ? { ...selectedMaterials, [slotKey]: candidate.id } : selectedMaterials;
                  const simulatedObjects = recipe.discipline === "Alchemy" ? selectedMaterialObjects(simulatedSelection, plan) : [];
                  const simulatedQuality = recipe.discipline === "Alchemy" ? alchemyBrewQualityPreview(recipe, simulatedObjects) : null;
                  const simulatedRecipe = simulatedQuality ? { ...recipe, formula_rarity: simulatedQuality.formulaRarity, rarity: simulatedQuality.finishedRarity } : recipe;
                  const impact = recipe.discipline === "Alchemy" ? alchemyIngredientImpactSummary(candidate, simulatedRecipe, slot) : null;
                  const candidateRarity = rarity(candidate.rarity || "Common") || "Common";
                  return (
                    <button
                      type="button"
                      key={candidate.id}
                      disabled={!available}
                      className={cls("craft-family-ingredient-option", "craft-family-ingredient-card-option", available ? "available" : "unavailable", String(selectedId) === String(candidate.id) && "active", rarityClassName(candidateRarity))}
                      onClick={() => {
                        if (!available) return;
                        setSelectedMaterials((prev) => ({ ...prev, [slotKey]: candidate.id }));
                        setOpenSlotKey("");
                      }}
                    >
                      {impact ? (
                        <AlchemyIngredientEffectCard
                          effect={alchemyEffectCardPayload(candidate, impact, slot)}
                          quantityLabel={available ? candidate.is_admin_virtual ? "∞ admin" : `x${candidate.quantity || 1}` : "Not owned"}
                          compact
                        />
                      ) : (
                        <PhysicalMaterialEffectCard material={candidate} materialEffects={materialEffects} quantityLabel={available ? candidate.is_admin_virtual ? "∞ admin" : `x${candidate.quantity || 1}` : "Not owned"} compact discipline={recipe.discipline} baseItem={baseItem} slot={slot} />
                      )}
                    </button>
                  );
                }) : <div className="craft-bullet muted p-2">No known ingredients match this family yet.</div>}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  ) : null;

  const attemptDcBlock = (
    <div className="craft-section craft-section-card craft-automation-preview mt-3">
      <div className="craft-section-title">Attempt DC Preview</div>
      <div className="craft-dc-total">DC {attemptPreview.final_dc}</div>
      <div className="craft-bullet">• Check: {attemptPreview.check_tool} + {attemptPreview.check_ability}</div>
      <div className="craft-bullet">• Selected materials: {selectedMaterialCount}</div>
      {alchemyProductPreview?.saveDcPreview ? <div className="craft-bomb-save-controls">
        <label><span>Crafter Proficiency</span><input className="form-control craft-input" type="number" min="0" max="10" value={crafterProficiency} onChange={(event) => setCrafterProficiency(event.target.value)} /></label>
        <label><span>Craft Roll Total</span><input className="form-control craft-input" type="number" value={craftRollTotal} onChange={(event) => setCraftRollTotal(event.target.value)} placeholder={`DC ${attemptPreview.final_dc} or higher`} /></label>
        <div className="craft-bullet craft-bomb-save-formula">• {alchemySectionForRecipe(recipe) === "Bombs" ? "Bomb" : "Effect"} Save DC: 8 + (Proficiency × 2) + ingredient Save DC bonuses; +1 when the craft check beats DC by 4+.</div>
      </div> : null}
      {attemptPreview.breakdown.map((line) => (
        <div className="craft-dc-line" key={line.label}><span>{line.label}</span><strong>{line.value >= 0 ? "+" : ""}{line.value}</strong></div>
      ))}
    </div>
  );

  const resultBandsBlock = (
    <div className="craft-section craft-section-card mt-3">
      <div className="craft-section-title">Result Bands</div>
      <div className="craft-bullet">• Critical Success: {attemptPreview.result_bands.critical_success}</div>
      <div className="craft-bullet">• Success: {attemptPreview.result_bands.success}</div>
      <div className="craft-bullet">• Partial: {attemptPreview.result_bands.partial_success}</div>
      <div className="craft-bullet">• Failure: {attemptPreview.result_bands.failure}</div>
    </div>
  );

  const createPlanBlock = (
    <div className="craft-section craft-section-card craft-inline-plan-box mt-3">
      <div className="craft-section-title">Create Craft Plan</div>
      <label className="small text-muted mb-1">Target Character</label>
      <select className="form-select craft-input mb-2" value={targetCharacterId} onChange={(event) => setTargetCharacterId(event.target.value)}>
        <option value="">No character selected yet</option>
        {characters.map((character) => (
          <option key={character.id} value={character.id}>{characterName(character)}</option>
        ))}
      </select>
      <label className="small text-muted mb-1">Expected Result Name</label>
      <input className="form-control craft-input" value={displayedResultName || ""} onChange={(event) => setResultItemName(event.target.value)} placeholder="Result item name" />
      <div className="craft-preview-chip-row mt-2">
        {recipe.discipline === "Alchemy" ? <span className="craft-chip craft-chip-gold">Creates x{finalOutputQuantity}</span> : <span className="craft-chip craft-chip-gold">{baseItem ? baseItem.name : createsNewItem ? "New item" : "No base item"}</span>}
        <span className={selectedMaterialCount ? "craft-chip craft-chip-green" : "craft-chip"}>{selectedMaterialCount} selected</span>
        {targetCharacter ? <span className="craft-chip craft-chip-blue">{characterName(targetCharacter)}</span> : <span className="craft-chip">No character</span>}
      </div>
      {planMessage ? <div className="craft-plan-alert success">{planMessage}</div> : null}
      {planError ? <div className="craft-plan-alert danger">{planError}</div> : null}
      <button type="button" className="btn btn-primary mt-2 craft-primary-action" onClick={submitPreviewCraftPlan} disabled={savingPlan}>
        {savingPlan ? "Saving..." : "Create Draft Craft Plan"}
      </button>
    </div>
  );

  if (craftMode) {
    return (
      <div className={cls("craft-recipe-craft-layout", `craft-theme-${workflowTheme}`)}>
        <div className="craft-crafting-left-column">
          <div className={cls("craft-panel", "craft-craft-mode-head", `craft-theme-${workflowTheme}`)}>
            <div>
              <div className="craft-kicker">{workflow.kicker}</div>
              <h2>{recipe.name}</h2>
              <p>{workflow.description}</p>
            </div>
            <button type="button" className="btn btn-sm btn-outline-light" onClick={onExitCraft}>Back to spreadsheet</button>
          </div>
          {workflowStepsBlock}
          {baseItemBlock}
          {ingredientFamiliesBlock}
          {attemptDcBlock}
          {resultBandsBlock}
          {createPlanBlock}
        </div>
        <aside className="craft-crafting-preview-column">
          {recipePreviewShell}
        </aside>
      </div>
    );
  }

  return (
    <div className="craft-preview-stack">
      {recipePreviewShell}
    </div>
  );
}
function recipeComponentText(recipe) {
  return [
    recipe?.name,
    recipe?.discipline,
    recipe?.kind,
    recipe?.category,
    recipe?.family,
    recipe?.summary,
    ...(Array.isArray(recipe?.requirements) ? recipe.requirements : []),
    ...(Array.isArray(recipe?.components) ? recipe.components : []),
  ].filter(Boolean).join(" ").toLowerCase();
}
function materialSlotKey(entry) {
  return entry?.key || entry?.category || "";
}
function materialSlotLabel(entry) {
  return entry?.label || entry?.category || "Material";
}
function materialSlotRole(entry) {
  return entry?.role || "";
}
function alchemyMaterialSlotsForRecipe(recipe) {
  return alchemyRecipeFamilySlots(recipe);
}
function requiredMaterialCategoriesForRecipe(recipe, baseItem = null) {
  if (recipe?.discipline === "Smithing" && recipe?.kind === "temper") return temperMaterialSlotsForRecipe(recipe, baseItem);
  const alchemySlots = alchemyMaterialSlotsForRecipe(recipe);
  if (alchemySlots) return alchemySlots;

  const blob = recipeComponentText(recipe);
  const out = [];
  const push = (category) => {
    if (!out.includes(category)) out.push(category);
  };

  if (/(ore|ingot|bar|bars|billet|nugget|metal|steel|iron|adamant|adamantine|mithral|silver|raw material|smith|forge|temper)/.test(blob)) push("Ore / Metal");
  if (/(monster|fang|claw|horn|scale|hide|heart|venom|gland|ichor|bone|blood)/.test(blob)) push("Monster Part");
  if (/(catalyst|essence|core|rune|sigil|gem|shard|crystal|dust|resin)/.test(blob)) push("Catalyst");
  if (/(plant|herb|mushroom|root|flower|leaf|berry|spore)/.test(blob)) push("Plant / Herb");
  if (/(reagent|oil|ink|powder|salt|acid|extract|solution|alchemy|brew|potion)/.test(blob)) push("Reagent");

  if (!out.length && recipe?.discipline === "Smithing") push("Ore / Metal");
  if (!out.length && recipe?.discipline === "Enchanting") push("Catalyst");

  return out;
}
function materialMatchesCategory(material, category) {
  if (!material || !category) return false;
  if (typeof category === "object") {
    if (category.family) return materialMeetsAlchemySlot(material, category);
    category = category.category;
  }
  const normalizedCategory = String(category || "").toLowerCase();
  const blob = materialSearchBlob(material);

  if (normalizedCategory === "misc") {
    return /(plant|herb|mushroom|root|flower|leaf|berry|spore|reagent|oil|ink|powder|salt|acid|extract|solution|catalyst|essence|core|rune|sigil|gem|shard|crystal|dust|resin|monster|fang|claw|horn|scale|hide|heart|venom|gland|ichor|bone|blood)/.test(blob);
  }

  if (normalizedCategory === "reagent / catalyst") {
    return /(reagent|oil|ink|powder|salt|acid|extract|solution|catalyst|essence|core|rune|sigil|gem|shard|crystal|dust|resin)/.test(blob) || material.category === "Reagent" || material.category === "Catalyst";
  }

  if (material.category === category) return true;
  if (category === "Ore / Metal") return /(ore|ingot|bar|bars|billet|nugget|metal|steel|iron|adamant|adamantine|mithral|silver)/.test(blob);
  if (category === "Monster Part") return /(monster|fang|claw|horn|scale|hide|heart|venom|gland|ichor|bone|blood)/.test(blob);
  if (category === "Catalyst") return /(catalyst|essence|core|rune|sigil|gem|shard|crystal|dust|resin)/.test(blob);
  if (category === "Plant / Herb") return /(plant|herb|mushroom|root|flower|leaf|berry|spore)/.test(blob);
  if (category === "Reagent") return /(reagent|oil|ink|powder|salt|acid|extract|solution)/.test(blob);
  return false;
}

function hasExplicitAlchemyPayload(material = {}) {
  const profile = materialAlchemyProfile(material);
  const category = String(material.category || "").toLowerCase();
  const tags = Array.isArray(material.tags) ? material.tags.map((tag) => String(tag).toLowerCase()) : [];
  return Boolean(
    Object.keys(profile || {}).length
    || category === "plant / herb"
    || category === "reagent"
    || category === "reagent / catalyst"
    || tags.includes("alchemy")
    || tags.includes("ingredient")
  );
}
function materialAllowedForRecipe(material, recipe = {}) {
  if (!material) return false;
  const d = String(recipe.discipline || "").toLowerCase();
  const category = String(material.category || "").toLowerCase();
  const blob = materialSearchBlob(material);
  const profile = smithingProfile(material);
  if (!d || d === "alchemy") return true;
  if (d === "smithing" && recipe.kind === "temper" && isElementalTemperMaterial(material)) return true;
  if (d === "smithing" && Object.keys(profile).length) return true;
  if (hasExplicitAlchemyPayload(material)) return false;
  if (d === "smithing") {
    if (["ore / metal", "material"].includes(category)) return true;
    if (category === "catalyst") return !/(potion|brew|herb|plant|extract|tincture)/.test(blob);
    if (category === "monster part") return !/(venom|poison|bile|mucus|fluid|blood extract|alchemical)/.test(blob);
    return false;
  }
  if (d === "enchanting") {
    if (category === "catalyst" || category === "monster part") return true;
    if (category === "ore / metal" || category === "material") return /(mithral|adamant|silver|ruidium|orichalcum|cold iron|obsidian|blood glass|star metal|stygian|moonsilver|riverine|crystal|shard|gem|arcane|planar)/.test(blob);
    return false;
  }
  return true;
}
function materialAllowedForDiscipline(material, discipline = "") {
  return materialAllowedForRecipe(material, { discipline });
}
function craftingWorkflowCopy(recipe = {}) {
  if (recipe.discipline === "Smithing") return {
    theme: "smithing",
    kicker: "Smithing Workshop",
    description: recipe.kind === "forge"
      ? "Choose the forge pattern, select physical stock and catalysts, then review the finished item and Craft DC."
      : "Choose owned gear, select physical stock and catalysts, then review the reforged tier and Craft DC.",
    step1: recipe.kind === "forge" ? "Choose Pattern" : "Choose Item",
    step2: "Materials & Catalyst",
    step3: "Finalize",
    materialTitle: "Forge Materials",
  };
  if (recipe.discipline === "Enchanting") return {
    theme: "enchanting",
    kicker: "Enchanting Workshop",
    description: "Choose a smith-tiered item, select a magical trait and compatible catalyst, then review the runed result and Craft DC.",
    step1: "Choose Tiered Item",
    step2: "Trait & Catalyst",
    step3: "Finalize",
    materialTitle: "Enchanting Components",
  };
  return {
    theme: "alchemy",
    kicker: "Alchemy Workshop",
    description: "Choose each reagent family. The live brew card stays visible and updates as ingredients change.",
    step1: "Choose Formula",
    step2: "Choose Ingredients",
    step3: "Finalize",
    materialTitle: "Ingredient Families",
  };
}

function buildCraftBenchPlan(recipe, materials = [], baseItem = null) {
  if (!recipe) {
    return { categories: [], matches: [], missing: [], ready: false, notes: ["Choose a recipe to begin a craft plan."] };
  }

  const categories = requiredMaterialCategoriesForRecipe(recipe, baseItem);
  const slots = categories.map((entry) => typeof entry === "string"
    ? { key: entry, category: entry, label: entry, required: true }
    : entry
  );

  const matches = slots.map((slot) => {
    const candidates = materials
      .filter((material) => {
        if (recipe.discipline === "Alchemy") return materialMeetsAlchemySlot(material, slot);
        if (slot.temper_elemental) return isElementalTemperMaterial(material);
        if (Array.isArray(slot.allowed_categories)) return slot.allowed_categories.some((category) => materialMatchesCategory(material, category));
        return materialMatchesCategory(material, slot.category);
      })
      .sort((a, b) => {
        const scoreDelta = materialAlchemyScore(b, recipe, slot) - materialAlchemyScore(a, recipe, slot);
        if (scoreDelta) return scoreDelta;
        return (rarityRank(b.rarity) - rarityRank(a.rarity)) || String(a.name).localeCompare(String(b.name));
      });
    return { ...slot, candidates };
  });

  const missing = matches
    .filter((entry) => entry.required !== false && entry.candidates.length === 0)
    .map((entry) => materialSlotLabel(entry));
  const ready = matches.filter((entry) => entry.required !== false).length > 0 && missing.length === 0;

  const notes = [];
  if (!recipe.known) notes.push("This recipe is currently a reference recipe; discovery/known-recipe gating can lock crafting later.");
  if (!slots.length) notes.push("This recipe has no material categories detected yet.");
  if (missing.length) notes.push(`Missing material categories: ${missing.join(", ")}.`);
  if (recipe.discipline === "Alchemy") notes.push("Alchemy formulas use three core family slots plus one fourth-slot essence/enhancer/monster component. Any core rarity is legal: lower rarity simply leaves a higher final Craft DC.");
  if (ready) notes.push("Material category coverage looks ready for a DM-reviewed craft plan.");

  return { categories: slots, matches, missing, ready, notes };
}


function defaultRecipeBaseDc(recipe) {
  const explicitDc = Number(recipe?.base_dc || recipe?.dc || 0);
  const discipline = String(recipe?.discipline || "").toLowerCase();
  if (explicitDc && discipline !== "alchemy") return explicitDc;
  if (discipline === "alchemy") return Math.max(explicitDc || 0, alchemyBaseDcByRarity(recipe?.rarity || "Common"));
  const r = rarity(recipe?.rarity || "");
  const rarityDc = {
    Mundane: 10,
    Common: 12,
    Uncommon: 15,
    Rare: 18,
    "Very Rare": 22,
    Legendary: 27,
    Varies: 15,
  }[r] || 15;

  const kind = String(recipe?.kind || "").toLowerCase();
  let kindMod = 0;
  if (kind.includes("temper")) kindMod += 2;
  if (kind.includes("enchant")) kindMod += 3;
  return rarityDc + kindMod;
}
function recipeRuleFor(recipe, rules = []) {
  if (!recipe) return null;
  const id = String(recipe.id || "").toLowerCase();
  const kind = String(recipe.kind || "").toLowerCase();
  const discipline = String(recipe.discipline || "").toLowerCase();
  const rarityText = rarity(recipe.rarity || "").toLowerCase();

  return rules.find((rule) => String(rule.recipe_id || "").toLowerCase() === id)
    || rules.find((rule) =>
      String(rule.discipline || "").toLowerCase() === discipline
      && String(rule.recipe_kind || "").toLowerCase() === kind
      && (!rule.rarity || String(rule.rarity).toLowerCase() === rarityText)
    )
    || rules.find((rule) =>
      String(rule.discipline || "").toLowerCase() === discipline
      && String(rule.recipe_kind || "").toLowerCase() === kind
      && !rule.rarity
    )
    || null;
}
function materialEffectFor(material, materialEffects = []) {
  if (!material) return null;
  const blob = materialSearchBlob(material);
  const category = String(material.category || "").toLowerCase();

  const exact = materialEffects.find((effect) => {
    const key = String(effect.match_key || effect.name || "").toLowerCase();
    return key && blob.includes(key);
  });
  if (exact) return exact;

  return materialEffects.find((effect) => {
    const effectCategory = String(effect.material_category || "").toLowerCase();
    return effectCategory && effectCategory === category;
  }) || null;
}
function fallbackMaterialEffect(material) {
  if (!material) return null;
  const blob = materialSearchBlob(material);
  if (/adamant|adamantine/.test(blob)) return { name: "Adamantine Working", dc_modifier: 3, effect_summary: "Adds exceptional hardness or anti-critical durability, depending on item type.", risk_summary: "Hard to work; failed crafts may waste the ore or bar stock." };
  if (/mithral/.test(blob)) return { name: "Mithral Working", dc_modifier: 2, effect_summary: "Reduces weight and improves mobility or stealth usability.", risk_summary: "Requires precise heat and shaping control." };
  if (/dragon/.test(blob)) return { name: "Dragon-Aspected Catalyst", dc_modifier: 4, effect_summary: "Adds elemental theming, resistance, damage, or draconic resonance based on source.", risk_summary: "Volatile if mismatched with the base item." };
  if (/venom|poison|gland|ichor/.test(blob)) return { name: "Toxic Catalyst", dc_modifier: 3, effect_summary: "Adds poison, bleed, caustic, or lingering harm potential.", risk_summary: "Mishap can contaminate the item or crafter." };
  if (/rune|sigil|essence|core|shard|crystal|dust|resin|catalyst/.test(blob)) return { name: "Arcane Catalyst", dc_modifier: 2, effect_summary: "Improves magical binding or adds a minor arcane rider.", risk_summary: "Can destabilize enchantment slots." };
  if (/herb|plant|root|flower|mushroom|reagent|oil|extract/.test(blob)) return { name: "Refined Reagent", dc_modifier: 1, effect_summary: "Adds alchemical potency, duration, or stabilizing properties.", risk_summary: "Low risk unless combined with volatile reagents." };
  if (/ore|ingot|metal|steel|iron|silver/.test(blob)) return { name: "Special Material", dc_modifier: 1, effect_summary: "Changes durability, finish, weight, or compatibility with later crafting.", risk_summary: "Requires correct tools and working temperature." };
  return null;
}
function selectedMaterialObjects(selectedMaterials = {}, plan) {
  return (plan?.matches || []).map((entry) => {
    const selectedId = selectedMaterials[materialSlotKey(entry)];
    const selected = (entry.candidates || []).find((candidate) => String(candidate.id) === String(selectedId)) || null;
    if (!selected) return null;

    // IMPORTANT: carry slot_type through to the selected material. Alchemy DC math
    // depends on this: only the three core herb slots reduce Craft DC by rarity.
    // The fourth modifier slot should not reduce Craft DC unless the ingredient has
    // an explicit payload.alchemy.bonuses.craftDcReduction value, such as a Pure Catalyst.
    return {
      ...selected,
      slot_key: materialSlotKey(entry),
      slot_label: materialSlotLabel(entry),
      slot_role: materialSlotRole(entry),
      slot_category: entry.category,
      slot_family: entry.family || null,
      slot_family_label: entry.family_label || null,
      slot_min_rarity: entry.min_rarity || null,
      slot_type: entry.slot_type || entry.slotType || (entry.family === "any" ? "modifier" : "core"),
      slot_allowed_families: entry.allowed_families || entry.allowedFamilies || [],
      temper_elemental: Boolean(entry.temper_elemental),
      temper_stage: entry.temper_stage || null,
      bonus_damage_pct: entry.bonus_damage_pct || null,
      temper_element: elementalDamageTypeForMaterial(selected) || null,
      smithing: smithingProfile(selected),
      optional: entry.required === false,
    };
  }).filter(Boolean);
}

function calculateCraftAttemptPreview(recipe, plan, selectedMaterials = {}, recipeRules = [], materialEffects = [], baseItem = null) {
  const rule = recipeRuleFor(recipe, recipeRules);
  const selected = selectedMaterialObjects(selectedMaterials, plan);
  const isAlchemy = recipe?.discipline === "Alchemy";
  const brewQuality = isAlchemy ? alchemyBrewQualityPreview(recipe, selected) : null;
  const effectiveRecipe = brewQuality ? { ...recipe, formula_rarity: brewQuality.formulaRarity, rarity: brewQuality.finishedRarity } : recipe;
  const baseDc = isAlchemy ? alchemyBaseDcByRarity(brewQuality.finishedRarity) : Number(rule?.base_dc || defaultRecipeBaseDc(recipe));
  const rarityMod = isAlchemy ? 0 : Number(rule?.rarity_dc_modifier || 0);
  const tierMod = Number(rule?.tier_dc_modifier || 0);
  const complexityMod = Number(rule?.complexity_dc_modifier || 0);

  const materialBreakdown = selected.map((material) => {
    const alchemyEffect = isAlchemy ? alchemyMaterialSpecificEffect(material, effectiveRecipe) : null;
    const physicalEffect = !isAlchemy && material.temper_elemental
      ? temperMaterialEffect(material, material)
      : !isAlchemy ? smithingMaterialEffect(material, baseItem) : null;
    const effect = alchemyEffect || physicalEffect || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {
      name: `${material.category || "Material"} Modifier`,
      dc_modifier: 1,
      effect_summary: "Adds a minor crafted-material effect decided by recipe context.",
      risk_summary: "Minor additional complexity.",
    };
    return {
      inventory_item_id: material.id,
      name: material.name,
      category: material.slot_label || material.category,
      slot_role: material.slot_role || null,
      quantity_required: 1,
      quantity_available: material.quantity,
      rarity: material.rarity || null,
      dc_modifier: Number(effect.dc_modifier || 0),
      effect_name: effect.name || "Material Effect",
      effect_summary: effect.effect_summary || "No effect summary.",
      risk_summary: effect.risk_summary || "No special risk.",
      contribution_chips: effect.contribution_chips || [],
      contribution_lines: effect.contribution_lines || [],
      family_label: effect.family_label || (recipe?.discipline === "Alchemy" ? reagentFamilyLabel(inferReagentFamily(material)) : null),
      family_key: effect.family_key || (recipe?.discipline === "Alchemy" ? inferReagentFamily(material) : null),
      potency_rank: effect.potency_rank || (recipe?.discipline === "Alchemy" ? alchemyMaterialPotency(material) : null),
      rarity_class: effect.rarity_class || (recipe?.discipline === "Alchemy" ? rarityClassName(material.rarity || "Common") : null),
      short_summary: effect.short_summary || null,
      potency_boost: effect.potency_boost || 0,
      duration_boost: effect.duration_boost || 0,
      batch_boost: effect.batch_boost || 0,
      save_boost: effect.save_boost || 0,
      stability_boost: effect.stability_boost || 0,
      risk_score: effect.risk_score || 0,
      element: effect.element || null,
      temper_stage: effect.temper_stage || null,
      bonus_damage_pct: effect.bonus_damage_pct || 0,
      offensive_summary: effect.offensive_summary || null,
      defensive_summary: effect.defensive_summary || null,
    };
  });

  const materialDc = materialBreakdown.reduce((sum, item) => sum + (Number(item.dc_modifier) || 0), 0);
  const missingCount = Array.isArray(plan?.missing) ? plan.missing.length : 0;
  const missingMod = missingCount * 2;
  const rawFinalDc = baseDc + rarityMod + tierMod + complexityMod + materialDc + missingMod;
  const finalDc = recipe?.discipline === "Alchemy" ? Math.max(ALCHEMY_FINAL_DC_FLOOR, rawFinalDc) : rawFinalDc;

  return {
    base_dc: baseDc,
    final_dc: finalDc,
    formula_rarity: brewQuality?.formulaRarity || recipe?.rarity || null,
    finished_rarity: brewQuality?.finishedRarity || recipe?.rarity || null,
    quality_steps: brewQuality?.qualitySteps || 0,
    rarity_increase: brewQuality?.rarityIncrease || 0,
    quality_steps_to_next: brewQuality ? (brewQuality.stepsTowardNextTier ? 3 - brewQuality.stepsTowardNextTier : 3) : null,
    brew_quality: brewQuality,
    breakdown: [
      { label: isAlchemy ? `${brewQuality.finishedRarity} brew base DC` : "Base recipe DC", value: baseDc },
      rarityMod ? { label: "Rarity modifier", value: rarityMod } : null,
      tierMod ? { label: "Tier modifier", value: tierMod } : null,
      complexityMod ? { label: "Complexity modifier", value: complexityMod } : null,
      materialDc ? { label: recipe?.discipline === "Alchemy" ? "Selected ingredient DC adjustment" : "Selected materials / catalysts", value: materialDc } : null,
      missingMod ? { label: "Missing material category warning", value: missingMod } : null,
    ].filter(Boolean),
    material_effects: materialBreakdown,
    temper_preview: materialBreakdown.filter((item) => item.temper_stage).sort((a, b) => a.temper_stage - b.temper_stage),
    temper_total_bonus_pct: materialBreakdown.reduce((sum, item) => sum + Number(item.bonus_damage_pct || 0), 0),
    check_ability: rule?.check_ability || (recipe?.discipline === "Smithing" ? "Strength or Intelligence" : recipe?.discipline === "Alchemy" ? "Intelligence or Wisdom" : "Intelligence or Charisma"),
    check_tool: rule?.check_tool || (recipe?.discipline === "Smithing" ? "Smith's Tools" : recipe?.discipline === "Alchemy" ? "Alchemist's Supplies" : "Arcana or Enchanter's Tools"),
    result_bands: rule?.result_bands && Object.keys(rule.result_bands || {}).length ? rule.result_bands : {
      critical_success: "Beat DC by 10+: item is created with a beneficial flourish or reduced material waste.",
      success: "Meet DC: item is created as previewed.",
      partial_success: "Miss by 1-4: item may be created with a complication, reduced effect, or extra time/cost.",
      failure: "Miss by 5+: craft fails and some materials are consumed.",
      mishap: recipe?.discipline === "Alchemy" ? "Natural 1 or severe miss: craft fails; DM decides material loss or a spoiled batch." : "Natural 1 or severe miss: craft fails with a mishap appropriate to the materials used.",
    },
    report_preview: `${recipe?.name || "Craft"} attempt preview: ${brewQuality ? `${brewQuality.finishedRarity} brew, ${brewQuality.qualitySteps} Quality Step${brewQuality.qualitySteps === 1 ? "" : "s"}, ` : ""}DC ${finalDc} using ${selected.length} selected material stack${selected.length === 1 ? "" : "s"}.`,
  };
}

function craftPlanInsertPayload(recipe, plan, options = {}) {
  const selectedMaterials = selectedMaterialPayload(options.selectedMaterials || {}, plan);
  const createsNewItem = recipeCreatesNewItem(recipe);
  const outputQuantity = recipeOutputQuantity(recipe);
  const safeBaseItem = createsNewItem ? null : options.baseItem || null;
  const materialSnapshot = (plan?.matches || []).map((entry) => {
    const slotKey = materialSlotKey(entry);
    const selectedForSlot = selectedMaterials.find((selected) => selected.slot_key === slotKey);
    return {
      key: slotKey,
      category: entry.category,
      label: materialSlotLabel(entry),
      role: materialSlotRole(entry) || null,
      optional: entry.required === false,
      selected_inventory_item_id: selectedForSlot?.inventory_item_id || null,
      candidates: (entry.candidates || []).slice(0, 6).map((material) => ({
        id: material.id,
        name: material.name,
        category: material.category,
        quantity: material.quantity,
        rarity: material.rarity || null,
        source: material.source || null,
      })),
    };
  });

  return {
    status: "draft",
    recipe_id: recipe?.id || null,
    recipe_name: recipe?.name || "Unnamed Recipe",
    discipline: recipe?.discipline || null,
    recipe_kind: recipe?.kind || null,
    rarity: options.automationPreview?.finished_rarity || recipe?.rarity || null,
    category: recipe?.category || null,
    family: recipe?.family || null,
    target_character_id: options.targetCharacter?.id || null,
    target_character_name: options.targetCharacter ? characterName(options.targetCharacter) : null,
    target_inventory_item_id: safeBaseItem?.id || null,
    target_inventory_item_name: safeBaseItem?.name || null,
    selected_materials: selectedMaterials,
    result_item_name: options.resultItemName || suggestedResultName(recipe, safeBaseItem) || null,
    result_item_payload: {
      recipe,
      base_item: safeBaseItem,
      target_character: options.targetCharacter || null,
      selected_materials: selectedMaterials,
      automation_preview: options.automationPreview || null,
      output_quantity: outputQuantity,
      quantity_created: outputQuantity,
      creates_new_item: createsNewItem,
      formula_rarity: recipe?.rarity || null,
      finished_rarity: options.automationPreview?.finished_rarity || recipe?.rarity || null,
      brew_quality: options.automationPreview?.brew_quality || null,
      created_from: "crafting_hub_draft",
    },
    material_categories: plan?.categories || [],
    missing_categories: plan?.missing || [],
    material_snapshot: materialSnapshot,
    plan_payload: {
      recipe,
      plan_notes: plan?.notes || [],
      created_from: "crafting_hub",
      ready: !!plan?.ready,
      target_character: options.targetCharacter || null,
      base_item: safeBaseItem,
      selected_materials: selectedMaterials,
      result_item_name: options.resultItemName || suggestedResultName(recipe, safeBaseItem) || null,
      automation_preview: options.automationPreview || null,
      output_quantity: outputQuantity,
      quantity_created: outputQuantity,
      creates_new_item: createsNewItem,
      formula_rarity: recipe?.rarity || null,
      finished_rarity: options.automationPreview?.finished_rarity || recipe?.rarity || null,
      brew_quality: options.automationPreview?.brew_quality || null,
    },
  };
}

function formatSupabaseError(error) {
  if (!error) return "Unknown Supabase error.";
  return [
    error.message,
    error.details ? `Details: ${error.details}` : "",
    error.hint ? `Hint: ${error.hint}` : "",
    error.code ? `Code: ${error.code}` : "",
  ].filter(Boolean).join(" ");
}
function craftPlanRpcPayload(payload) {
  return {
    status: payload.status,
    recipe_id: payload.recipe_id,
    recipe_name: payload.recipe_name,
    discipline: payload.discipline,
    recipe_kind: payload.recipe_kind,
    rarity: payload.rarity,
    category: payload.category,
    family: payload.family,
    target_character_id: payload.target_character_id,
    target_character_name: payload.target_character_name,
    target_inventory_item_id: payload.target_inventory_item_id,
    target_inventory_item_name: payload.target_inventory_item_name,
    selected_materials: payload.selected_materials,
    result_item_name: payload.result_item_name,
    result_item_payload: payload.result_item_payload,
    material_categories: payload.material_categories,
    missing_categories: payload.missing_categories,
    material_snapshot: payload.material_snapshot,
    plan_payload: payload.plan_payload,
    created_by: payload.created_by,
  };
}

function recipeCreatesNewItem(recipe) {
  const kind = String(recipe?.kind || recipe?.recipe_kind || "").toLowerCase();
  const discipline = String(recipe?.discipline || "").toLowerCase();
  return kind === "forge" || kind === "alchemy" || discipline === "alchemy";
}
function defaultAlchemyOutputQuantity(recipe) {
  if (!recipe || String(recipe.discipline || "").toLowerCase() !== "alchemy") return 1;
  const explicit = Number(recipe.output_quantity || recipe.quantity_created || recipe.batch_quantity || 0);
  if (explicit > 0) return Math.max(1, Math.floor(explicit));

  const name = String(recipe.name || recipe.recipe_name || "").toLowerCase();
  if (/poison|oil|etherealness|sharpness/.test(name)) return 1;
  if (/healing draught|potion of healing|antitoxin|comprehension|climbing/.test(name)) return 2;

  const r = rarity(recipe.rarity || "");
  if (r === "Common") return 2;
  return 1;
}
function recipeOutputQuantity(recipe) {
  const explicit = Number(recipe?.output_quantity || recipe?.quantity_created || recipe?.batch_quantity || recipe?.plan_payload?.output_quantity || recipe?.result_item_payload?.output_quantity || 0);
  if (explicit > 0) return Math.max(1, Math.floor(explicit));
  return defaultAlchemyOutputQuantity(recipe);
}

function CraftBenchTab({ recipes, materials, inventoryItems, characters, recipeRules, materialEffects, selectedRecipe, setSelectedRecipe }) {
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState("");
  const [planError, setPlanError] = useState("");
  const [crafterProficiency, setCrafterProficiency] = useState(2);
  const [craftRollTotal, setCraftRollTotal] = useState("");
  const [targetCharacterId, setTargetCharacterId] = useState("");
  const [baseItemId, setBaseItemId] = useState("");
  const [resultItemName, setResultItemName] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState({});

  const craftableRecipes = recipes.filter((recipe) => recipe.known || recipe.discipline === "Smithing" || recipe.discipline === "Enchanting" || recipe.discipline === "Alchemy");
  const visibleRecipes = craftableRecipes.length ? craftableRecipes : recipes;
  const selectedIsVisible = visibleRecipes.some((recipe) => recipe.id === selectedRecipe?.id);
  const activeRecipe = selectedIsVisible ? selectedRecipe : visibleRecipes[0] || null;
  const plan = buildCraftBenchPlan(activeRecipe, materials);
  const targetCharacter = characters.find((character) => String(character.id) === String(targetCharacterId)) || null;
  const normalizedInventory = useMemo(() => inventoryItems.map(normalizeBenchInventoryItem), [inventoryItems]);
  const createsNewItem = recipeCreatesNewItem(activeRecipe);
  const outputQuantity = recipeOutputQuantity(activeRecipe);
  const baseCandidates = useMemo(
    () => createsNewItem ? [] : normalizedInventory.filter((item) => isCraftBaseCandidate(item, activeRecipe)),
    [normalizedInventory, activeRecipe, createsNewItem]
  );
  const baseItem = createsNewItem ? null : baseCandidates.find((item) => String(item.id) === String(baseItemId)) || null;
  const displayedResultName = resultItemName || suggestedResultName(activeRecipe, baseItem);
  const attemptPreview = calculateCraftAttemptPreview(activeRecipe, plan, selectedMaterials, recipeRules, materialEffects, baseItem);
  const selectedMaterialList = selectedMaterialPayload(selectedMaterials, plan);
  const selectedMaterialCount = selectedMaterialList.filter((material) => material.inventory_item_id).length;
  const destructiveSelectedMaterials = destructiveMaterialsFromSelection(selectedMaterials, plan);
  const targetReady = Boolean(targetCharacter);
  const recipeReady = Boolean(activeRecipe);
  const materialReady = plan.matches.length ? plan.matches.every((entry) => entry.required === false || selectedMaterials[materialSlotKey(entry)] || entry.candidates.length === 0) : true;
  const reviewReady = recipeReady && targetReady && (plan.ready || selectedMaterialCount > 0 || !plan.matches.length);

  useEffect(() => {
    setSelectedMaterials({});
    setBaseItemId("");
    setResultItemName("");
  }, [activeRecipe?.id]);

  async function submitCraftPlan() {
    setPlanMessage("");
    setPlanError("");

    if (!activeRecipe) {
      setPlanError("Choose a recipe before creating a craft plan.");
      return;
    }

    if (destructiveSelectedMaterials.length && typeof window !== "undefined") {
      const ok = window.confirm(destructiveMaterialMessage(destructiveSelectedMaterials));
      if (!ok) {
        setPlanMessage("Craft plan creation cancelled. No item was consumed.");
        return;
      }
    }

    setSubmittingPlan(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const payload = {
        ...craftPlanInsertPayload(activeRecipe, plan, {
          targetCharacter,
          baseItem,
          selectedMaterials,
          resultItemName: displayedResultName,
          automationPreview: { ...attemptPreview, output_quantity: finalOutputQuantity, final_effect_preview: alchemyProductPreview },
        }),
        created_by: authData?.user?.id || null,
      };

      const { error: insertError } = await supabase.from("craft_plans").insert(payload);
      if (insertError) {
        const { error: rpcError } = await supabase.rpc("submit_craft_plan", {
          p_plan: craftPlanRpcPayload(payload),
        });
        if (rpcError) {
          throw new Error(`Direct insert failed: ${formatSupabaseError(insertError)} RPC fallback failed: ${formatSupabaseError(rpcError)}`);
        }
      }

      setPlanMessage("Craft plan saved as a draft with target/material selections.");
    } catch (error) {
      setPlanError(`Could not save craft plan. ${error?.message || "Run the included craft plan target/material SQL, then try again."}`);
    } finally {
      setSubmittingPlan(false);
    }
  }

  return (
    <>
      <div className="craft-bench-player-guide">
        <div className={cls("craft-guide-step", recipeReady && "ready")}>
          <span>1</span>
          <div><strong>Choose Recipe</strong><small>{activeRecipe?.name || "Pick what to craft"}</small></div>
        </div>
        <div className={cls("craft-guide-step", targetReady && materialReady && "ready", destructiveSelectedMaterials.length && "danger") }>
          <span>2</span>
          <div><strong>Target + Materials</strong><small>{destructiveSelectedMaterials.length ? "Item will be destroyed" : targetReady ? `${selectedMaterialCount} material${selectedMaterialCount === 1 ? "" : "s"} selected` : "Choose a character"}</small></div>
        </div>
        <div className={cls("craft-guide-step", reviewReady && "ready")}>
          <span>3</span>
          <div><strong>Review Attempt</strong><small>DC {attemptPreview.final_dc} • {reviewReady ? "Ready to save" : "Needs attention"}</small></div>
        </div>
      </div>

      <div className="craft-grid-three-even craft-bench-grid craft-bench-selection-grid">
      <div className="craft-panel craft-bench-recipe-panel">
        <div className="craft-panel-head">
          <strong>Step 1: Choose Recipe</strong>
          <span className="craft-badge">{visibleRecipes.length} options</span>
        </div>
        <div className="craft-bench-recipe-list">
          {visibleRecipes.slice(0, 80).map((recipe) => (
            <button
              type="button"
              key={recipe.id}
              className={cls("craft-list-row", activeRecipe?.id === recipe.id && "craft-list-row-active")}
              onClick={() => {
                setSelectedRecipe(recipe);
                setPlanMessage("");
                setPlanError("");
              }}
            >
              <div className="min-w-0">
                <div className="craft-row-title">{recipe.name}</div>
                <div className="craft-row-meta">{recipe.discipline} • {recipe.rarity || "—"}</div>
              </div>
              <span className={cls("craft-badge", recipe.known && "craft-badge-known")}>{recipe.known ? "Known" : "Ref"}</span>
            </button>
          ))}
          {!visibleRecipes.length ? <div className="p-3 text-muted">No recipes available.</div> : null}
        </div>
      </div>

      <div className="craft-panel craft-bench-match-panel">
        <div className="craft-panel-head">
          <strong>Step 2: Target & Materials</strong>
          <span className={cls("craft-badge", plan.ready && "craft-badge-known")}>{plan.ready ? "Ready" : "Check"}</span>
        </div>
        <div className="craft-bench-body">
          <div className="craft-section craft-section-card mt-0">
            <div className="craft-section-title">Target</div>
            <label className="small text-muted mb-1">Target Character</label>
            <select className="form-select craft-input mb-2" value={targetCharacterId} onChange={(event) => setTargetCharacterId(event.target.value)}>
              <option value="">No character selected yet</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>{characterName(character)}</option>
              ))}
            </select>

            <label className="small text-muted mb-1">Base Item / Target Item</label>
            <select className="form-select craft-input mb-2" value={baseItemId} onChange={(event) => setBaseItemId(event.target.value)} disabled={createsNewItem}>
              <option value="">{createsNewItem ? (activeRecipe?.discipline === "Alchemy" ? "Alchemy creates a new potion batch" : "Forge creates a new item") : "No base item selected"}</option>
              {!createsNewItem && baseCandidates.map((item) => (
                <option key={item.id} value={item.id}>{item.name} {item.rarity ? `(${item.rarity})` : ""}</option>
              ))}
            </select>

            <label className="small text-muted mb-1">Expected Result Name</label>
            <input className="form-control craft-input" value={displayedResultName || ""} onChange={(event) => setResultItemName(event.target.value)} placeholder="Result item name" />
          </div>

          {plan.matches.map((entry) => {
            const slotKey = materialSlotKey(entry);
            const selectedMaterial = (entry.candidates || []).find((candidate) => String(candidate.id) === String(selectedMaterials[slotKey])) || null;
            const isDanger = selectedMaterial ? isDestructiveMaterial(selectedMaterial) : false;
            return (
              <div className={cls("craft-match-row", isDanger && "craft-match-row-danger")} key={slotKey}>
                <div className="craft-match-head">
                  <span>{materialSlotLabel(entry)}</span>
                  <span className={cls("craft-status-pill", selectedMaterials[slotKey] ? (isDanger ? "danger" : "known") : entry.required === false ? "" : entry.candidates.length && "known")}>{selectedMaterials[slotKey] ? (isDanger ? "Warning" : "Selected") : entry.required === false ? "Optional" : entry.candidates.length ? "Available" : "Missing"}</span>
                </div>
                {materialSlotRole(entry) ? <div className="craft-row-meta mb-2">{materialSlotRole(entry)}{entry.required === false ? " • Optional" : ""}</div> : null}
                {entry.candidates.length ? (
                  <select
                    className="form-select craft-input craft-material-select"
                    value={selectedMaterials[slotKey] || ""}
                    onChange={(event) => setSelectedMaterials((prev) => ({ ...prev, [slotKey]: event.target.value }))}
                  >
                    <option value="">Choose material stack</option>
                    {entry.candidates.map((material) => {
                      const danger = isDestructiveMaterial(material);
                      return <option key={material.id} value={material.id}>{danger ? "⚠ " : ""}{material.name} x{material.quantity} {material.rarity ? `(${material.rarity})` : ""}{danger ? " — will be destroyed" : ""}</option>;
                    })}
                  </select>
                ) : (
                  <div className="craft-bullet muted">No matching material stack found.</div>
                )}
                {isDanger ? (
                  <div className="craft-destructive-warning-inline">
                    <strong>Destroy item?</strong> {selectedMaterial.name} will be permanently consumed if this craft is completed.
                  </div>
                ) : null}
              </div>
            );
          })}

          {!plan.matches.length ? (
            <div className="craft-section craft-section-card">
              <div className="craft-section-title">No material rules detected</div>
              <div className="craft-bullet muted">This recipe needs explicit component rules before automatic matching can be accurate.</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="craft-preview-card craft-bench-plan-card">
        <div className="craft-preview-topline">
          <div>
            <div className="craft-kicker">Craft Plan</div>
            <h2 className="craft-preview-title">{displayedResultName || activeRecipe?.name || "No Recipe Selected"}</h2>
          </div>
          <span className={cls("craft-preview-rarity", plan.ready && "rarity-uncommon")}>{plan.ready ? "Ready" : "Draft"}</span>
        </div>

        <div className="craft-preview-summary">
          {activeRecipe?.discipline === "Alchemy"
            ? `This saves a potion batch plan for DM/admin review. On completion, this formula creates ${outputQuantity} ${outputQuantity === 1 ? "item" : "items"} and consumes selected herbs/reagents.`
            : "This saves target character, optional base item, and selected material stacks for DM/admin review. It still does not consume materials or create output."}
        </div>

        <div className="craft-preview-chip-row">
          <span className="craft-chip craft-chip-blue">{activeRecipe?.discipline || "—"}</span>
          <span className="craft-chip">{targetCharacter ? characterName(targetCharacter) : "No character"}</span>
          <span className="craft-chip craft-chip-gold">{baseItem ? baseItem.name : createsNewItem ? "New item" : "No base item"}</span>
          {activeRecipe?.discipline === "Alchemy" ? <span className="craft-chip craft-chip-green">Creates x{outputQuantity}</span> : null}
          <span className={selectedMaterialCount ? "craft-chip craft-chip-green" : "craft-chip"}>{selectedMaterialCount} selected materials</span>
          {destructiveSelectedMaterials.length ? <span className="craft-chip craft-chip-danger">{destructiveSelectedMaterials.length} destroy warning</span> : null}
        </div>

        {destructiveSelectedMaterials.length ? (
          <div className="craft-section craft-section-card craft-destructive-warning-card">
            <div className="craft-section-title">Destructive Material Warning</div>
            {destructiveSelectedMaterials.map((material) => (
              <div className="craft-bullet" key={material.id}>• {material.name} will be permanently consumed if this plan is completed.</div>
            ))}
          </div>
        ) : null}

        <div className="craft-section craft-section-card craft-automation-preview">
          <div className="craft-section-title">Attempt DC Preview</div>
          <div className="craft-dc-total">DC {attemptPreview.final_dc}</div>
          <div className="craft-bullet">• Check: {attemptPreview.check_tool} + {attemptPreview.check_ability}</div>
          {activeRecipe?.discipline === "Alchemy" ? <div className="craft-bullet">• Batch output: {outputQuantity} {outputQuantity === 1 ? "potion / dose" : "potions / doses"}</div> : null}
          {attemptPreview.breakdown.map((line) => (
            <div className="craft-dc-line" key={line.label}><span>{line.label}</span><strong>{line.value >= 0 ? "+" : ""}{line.value}</strong></div>
          ))}
        </div>

        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Material Effects</div>
          {attemptPreview.material_effects.length ? attemptPreview.material_effects.map((effect) => (
            <div className="craft-material-effect-row" key={`${effect.category}-${effect.inventory_item_id}`}>
              <strong>{effect.effect_name}</strong>
              <div>{effect.name}: {effect.effect_summary}</div>
              <span>{Number(effect.dc_modifier || 0) < 0 ? `Craft DC ${effect.dc_modifier}` : Number(effect.dc_modifier || 0) > 0 ? `Craft DC +${effect.dc_modifier}` : "No Craft DC change"}</span>
            </div>
          )) : <div className="craft-bullet muted">Select materials to preview DC modifiers and crafted effects.</div>}
        </div>

        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Result Bands</div>
          <div className="craft-bullet">• Critical Success: {attemptPreview.result_bands.critical_success}</div>
          <div className="craft-bullet">• Success: {attemptPreview.result_bands.success}</div>
          <div className="craft-bullet">• Partial: {attemptPreview.result_bands.partial_success}</div>
          <div className="craft-bullet">• Failure: {attemptPreview.result_bands.failure}</div>
        </div>

        <div className="craft-preview-grid">
          <div className="craft-section craft-section-card">
            <div className="craft-section-title">Selected Materials</div>
            {selectedMaterialList.length ? selectedMaterialList.map((material) => (
              <div className={cls("craft-bullet", material.is_destructive_material && "craft-bullet-danger")} key={material.slot_key || material.category}>• {material.slot_label || material.category}: {material.name ? `${material.name} x${material.quantity_required}` : material.optional ? "Optional" : "Not selected"}{material.is_destructive_material ? " — will be destroyed" : ""}</div>
            )) : <div className="craft-bullet muted">No material categories detected.</div>}
          </div>
          <div className="craft-section craft-section-card">
            <div className="craft-section-title">Plan Notes</div>
            {plan.notes.map((note, idx) => <div className="craft-bullet" key={idx}>• {note}</div>)}
          </div>
        </div>

        {planMessage ? <div className="craft-plan-alert success">{planMessage}</div> : null}
        {planError ? <div className="craft-plan-alert danger">{planError}</div> : null}

        <button type="button" className="btn btn-primary mt-3 craft-primary-action" onClick={submitCraftPlan} disabled={!activeRecipe || submittingPlan}>
          {submittingPlan ? "Saving Plan..." : destructiveSelectedMaterials.length ? "Create Plan with Warning" : "Create Draft Craft Plan"}
        </button>
      </div>
    </div>
    </>
  );
}

function discoveryStatusForRecipe(recipe) {
  if (!recipe) return "Unknown";
  if (recipe.known) return "Known";
  if (recipe.discipline === "Smithing") return "Reference";
  return "Hint";
}
function discoverySourceForRecipe(recipe) {
  if (!recipe) return "—";
  if (recipe.known) return "Player Journal";
  if (recipe.discipline === "Smithing") return "Town Smithing Reference";
  if (recipe.discipline === "Enchanting") return "Arcane Formula Reference";
  if (recipe.discipline === "Alchemy") return "Alchemy Notes";
  return recipe.source || "Reference";
}
function discoveryClueForRecipe(recipe) {
  if (!recipe) return "No clue available.";
  if (recipe.known) return "This recipe is known and can be used for craft planning.";
  if (recipe.discipline === "Smithing") return "A town smith or masterwork station can teach or perform this work.";
  if (recipe.discipline === "Enchanting") {
    const applies = recipe.family || recipe.category || "item";
    return `Seek an enchanter, formula, or monster/catalyst clue tied to ${applies}.`;
  }
  if (recipe.discipline === "Alchemy") return "Gather herbs, reagents, monster organs, and field notes to reveal this formula.";
  return "Discover this through NPC teaching, research, dungeon clues, faction rewards, or experimentation.";
}
function materialDiscoveryLeads(materials = [], recipes = []) {
  return materials.slice(0, 12).map((material) => {
    const hits = recipes
      .filter((recipe) => matches(recipe, material.name) || matches(recipe, material.category))
      .slice(0, 3);
    return {
      id: material.id,
      name: material.name,
      category: material.category || "Material",
      quantity: material.quantity,
      source: material.source || "Inventory",
      hits,
      clue: hits.length
        ? `This material appears connected to ${hits.map((hit) => hit.name).join(", ")}.`
        : `No direct formula match yet. ${material.category || "This material"} can become useful once alchemy and component-specific recipes are added.`,
    };
  });
}
function DiscoveryTable({ recipes, selected, onSelect }) {
  return (
    <div className="craft-table-scroll craft-discovery-table-scroll" role="region" aria-label="Discovery journal">
      <table className="craft-recipe-sheet craft-discovery-sheet">
        <thead>
          <tr>
            <th className="disc-recipe">Recipe / Formula</th>
            <th className="disc-status">Status</th>
            <th className="disc-discipline">Discipline</th>
            <th className="disc-rarity">Rarity</th>
            <th className="disc-source">Discovery Source</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => {
            const isActive = selected?.id === recipe.id;
            const status = discoveryStatusForRecipe(recipe);
            return (
              <tr key={recipe.id} className={isActive ? "active" : ""} onClick={() => onSelect(recipe)}>
                <td className="disc-recipe">
                  <div className="craft-sheet-name">{recipe.name}</div>
                  <div className="craft-sheet-source">{discoveryClueForRecipe(recipe)}</div>
                </td>
                <td className="disc-status">
                  <span className={cls("craft-discovery-status-pill", `disc-${status.toLowerCase()}`)}>{status}</span>
                </td>
                <td className="disc-discipline">
                  <span className={cls("craft-type-pill", `type-${String(recipe.discipline || "recipe").toLowerCase()}`)}>{recipe.discipline}</span>
                </td>
                <td className="disc-rarity">
                  <span className={cls("craft-rarity-pill", `rarity-${String(recipe.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{recipe.rarity || "—"}</span>
                </td>
                <td className="disc-source">
                  <span className="craft-applies-text">{discoverySourceForRecipe(recipe)}</span>
                </td>
              </tr>
            );
          })}
          {!recipes.length ? <tr><td colSpan="5" className="text-muted p-3">No discovery entries found.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
function DiscoveryPreview({ recipe, materials = [] }) {
  if (!recipe) return <div className="craft-preview-card craft-preview-empty">Select a discovery entry.</div>;
  const relatedMaterials = materials
    .filter((material) => matches(recipe, material.name) || matches(recipe, material.category))
    .slice(0, 6);
  const status = discoveryStatusForRecipe(recipe);

  return (
    <div className="craft-preview-card">
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Discovery Detail</div>
          <h2 className="craft-preview-title">{recipe.name}</h2>
        </div>
        <span className={cls("craft-preview-rarity", `disc-${status.toLowerCase()}`)}>{status}</span>
      </div>

      <div className="craft-preview-summary">
        {discoveryClueForRecipe(recipe)}
      </div>

      <div className="craft-preview-chip-row">
        <span className="craft-chip craft-chip-blue">{recipe.discipline}</span>
        <span className="craft-chip">{titleCase(recipe.kind)}</span>
        <span className="craft-chip craft-chip-gold">{recipe.rarity || "—"}</span>
        <span className={recipe.known ? "craft-chip craft-chip-green" : "craft-chip"}>{recipe.known ? "Known" : "Not learned"}</span>
      </div>

      <div className="craft-preview-grid">
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Discovery Source</div>
          <div className="craft-bullet">• {discoverySourceForRecipe(recipe)}</div>
          <div className="craft-bullet">• Original source: {recipe.source || "—"}</div>
          <div className="craft-bullet">• Applies to: {recipe.family || recipe.category || "—"}</div>
        </div>
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Related Materials</div>
          {relatedMaterials.length
            ? relatedMaterials.map((material) => <div className="craft-bullet" key={material.id}>• {material.name} x{material.quantity}</div>)
            : <div className="craft-bullet muted">No related owned material has been detected yet.</div>}
        </div>
      </div>

      <div className="craft-preview-footer">
        <span>Progression</span>
        <strong>{status}</strong>
      </div>
    </div>
  );
}
function DiscoveryLeadsPanel({ materials, recipes }) {
  const leads = materialDiscoveryLeads(materials, recipes);
  return (
    <div className="craft-panel craft-discovery-leads-panel">
      <div className="craft-panel-head">
        <strong>Material Leads</strong>
        <span className="craft-badge">{leads.length} clues</span>
      </div>
      <div className="craft-discovery-leads-list">
        {leads.map((lead) => (
          <div className="craft-lead-card" key={lead.id}>
            <div className="craft-lead-title">{lead.name}</div>
            <div className="craft-row-meta">{lead.category} • Qty x{lead.quantity} • {lead.source}</div>
            <div className="craft-lead-clue">{lead.clue}</div>
          </div>
        ))}
        {!leads.length ? <div className="p-3 text-muted">No material-based leads yet.</div> : null}
      </div>
    </div>
  );
}
function DiscoveryTab({ recipes, materials, playerRecipes, selectedRecipe, setSelectedRecipe }) {
  const sorted = [...recipes].sort((a, b) => {
    const statusSort = discoveryStatusForRecipe(a).localeCompare(discoveryStatusForRecipe(b));
    if (statusSort) return statusSort;
    return String(a.name).localeCompare(String(b.name));
  });
  const known = recipes.filter((recipe) => recipe.known).length;
  const hints = recipes.filter((recipe) => discoveryStatusForRecipe(recipe) === "Hint").length;
  const refs = recipes.filter((recipe) => discoveryStatusForRecipe(recipe) === "Reference").length;
  const active = selectedRecipe || sorted[0] || null;

  return (
    <div className="craft-discovery-layout">
      <div className="craft-panel">
        <div className="craft-panel-head"><strong>Discovery Groups</strong><span className="craft-badge">Journal</span></div>
        <button className="craft-group-row craft-list-row-active" type="button"><span>Known Recipes</span><span className="craft-badge craft-badge-known">{known}</span></button>
        <button className="craft-group-row" type="button"><span>Recipe Hints</span><span className="craft-badge">{hints}</span></button>
        <button className="craft-group-row" type="button"><span>Reference Rules</span><span className="craft-badge">{refs}</span></button>
        <button className="craft-group-row" type="button"><span>Player Recipe Rows</span><span className="craft-badge">{playerRecipes.length}</span></button>
      </div>

      <div className="craft-panel craft-discovery-table-panel">
        <div className="craft-panel-head"><strong>Discovery Journal</strong><span className="craft-badge">{sorted.length} entries</span></div>
        <DiscoveryTable recipes={sorted} selected={active} onSelect={setSelectedRecipe} />
      </div>

      <DiscoveryPreview recipe={active} materials={materials} />

      <DiscoveryLeadsPanel materials={materials} recipes={recipes} />
    </div>
  );
}


function foragePlant(entry = {}) {
  return entry.plants || entry.plant || entry.plant_row || {};
}
function foragePlantName(entry = {}) {
  const plant = foragePlant(entry);
  return entry.plant_name || plant.name || "Unknown Plant";
}
function foragePlantRarity(entry = {}) {
  const plant = foragePlant(entry);
  return rarity(entry.rarity || plant.rarity || "Common") || "Common";
}
function forageRollRange(entry = {}) {
  const min = Number(entry.roll_min || entry.roll || 1);
  const max = Number(entry.roll_max || entry.roll || min);
  return min === max ? `${min}` : `${min}–${max}`;
}
function forageLocationName(table = {}, locations = []) {
  const found = locations.find((location) => String(location.id) === String(table.location_id));
  return found?.name || table.location_name || table.name || "Unknown Location";
}
function forageTableSearchBlob(table = {}, locations = []) {
  return [table.name, forageLocationName(table, locations), table.biome, table.climate, table.terrain, table.notes].filter(Boolean).join(" ").toLowerCase();
}
function forageEntrySearchBlob(entry = {}) {
  const plant = foragePlant(entry);
  return [foragePlantName(entry), foragePlantRarity(entry), plant.found_in, plant.effect, plant.climate, plant.biome, plant.terrain, entry.season, entry.geography_note, entry.notes, ...(Array.isArray(plant.tags) ? plant.tags : [])].filter(Boolean).join(" ").toLowerCase();
}
function plantAlchemyTags(entry = {}) {
  const plant = foragePlant(entry);
  return Array.from(new Set([
    ...(Array.isArray(plant.tags) ? plant.tags : []),
    ...(Array.isArray(entry.tags) ? entry.tags : []),
    plant.name,
    entry.plant_name,
    plant.effect,
    entry.notes,
  ].filter(Boolean).flatMap((value) => String(value).toLowerCase().split(/[^a-z0-9]+/)).filter((value) => value && value.length > 2)));
}
function alchemyMatchesForPlant(entry = {}, recipes = []) {
  const tags = plantAlchemyTags(entry);
  if (!tags.length) return [];
  const tagSet = new Set(tags);
  return (recipes || [])
    .filter((recipe) => String(recipe?.discipline || "").toLowerCase() === "alchemy")
    .map((recipe) => {
      const formulaTags = [
        ...(Array.isArray(recipe.formula_tags) ? recipe.formula_tags : []),
        ...(Array.isArray(recipe.requiredTags) ? recipe.requiredTags : []),
        ...(Array.isArray(recipe.secondaryTags) ? recipe.secondaryTags : []),
        recipe.name,
        recipe.summary,
        recipe.effect_detail,
      ].filter(Boolean).flatMap((value) => String(value).toLowerCase().split(/[^a-z0-9]+/)).filter((value) => value && value.length > 2);
      const score = formulaTags.reduce((sum, value) => sum + (tagSet.has(value) ? 1 : 0), 0);
      return { recipe, score };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || rarityRank(b.recipe.rarity) - rarityRank(a.recipe.rarity) || String(a.recipe.name).localeCompare(String(b.recipe.name)))
    .slice(0, 8);
}
function ForageTableList({ tables, locations, selectedTableId, setSelectedTableId }) {
  return (
    <div className="craft-panel">
      <div className="craft-panel-head"><strong>Location Tables</strong><span className="craft-badge">{tables.length} tables</span></div>
      <div className="craft-list forage-location-list">
        {tables.map((table) => {
          const active = String(selectedTableId) === String(table.id);
          return (
            <button key={table.id} type="button" className={cls("craft-list-row", active && "craft-list-row-active")} onClick={() => setSelectedTableId(table.id)}>
              <div>
                <div className="craft-row-title">{forageLocationName(table, locations)}</div>
                <div className="craft-row-meta">{table.biome || "Biome TBD"} • {table.climate || "Climate TBD"}</div>
                <div className="craft-row-meta">{table.terrain || "Terrain TBD"}</div>
              </div>
              <span className="craft-badge">d20</span>
            </button>
          );
        })}
        {!tables.length ? <div className="p-3 text-muted">No foraging tables found. Run the foraging SQL seed first.</div> : null}
      </div>
    </div>
  );
}
function ForageEntryTable({ entries, selectedEntry, setSelectedEntry }) {
  return (
    <div className="craft-panel craft-recipe-table-panel forage-entry-panel">
      <div className="craft-panel-head"><strong>d20 Forage Table</strong><span className="craft-badge">{entries.length} entries</span></div>
      <div className="craft-table-scroll" role="region" aria-label="Forage table entries">
        <table className="craft-recipe-sheet forage-sheet">
          <thead>
            <tr>
              <th className="forage-roll">Roll</th>
              <th className="forage-plant">Plant / Herb</th>
              <th className="forage-rarity">Rarity</th>
              <th className="forage-dc">DC</th>
              <th className="forage-qty">Qty</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const active = selectedEntry?.id === entry.id;
              return (
                <tr key={entry.id} className={active ? "active" : ""} onClick={() => setSelectedEntry(entry)}>
                  <td className="forage-roll"><span className="craft-status-pill">{forageRollRange(entry)}</span></td>
                  <td className="forage-plant">
                    <div className="craft-sheet-name">{foragePlantName(entry)}</div>
                    <div className="craft-sheet-source">{foragePlant(entry).found_in || entry.geography_note || "Location-specific herb"}</div>
                  </td>
                  <td className="forage-rarity"><span className={cls("craft-rarity-pill", `rarity-${foragePlantRarity(entry).toLowerCase().replace(/\s+/g, "-")}`)}>{foragePlantRarity(entry)}</span></td>
                  <td className="forage-dc">DC {entry.forage_dc || foragePlant(entry).forage_dc || "—"}</td>
                  <td className="forage-qty">{entry.quantity_formula || "1"}</td>
                </tr>
              );
            })}
            {!entries.length ? <tr><td colSpan="5" className="text-muted p-3">No entries for this location table yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function ForageRollHelper({ entries }) {
  const [roll, setRoll] = useState(10);
  const [total, setTotal] = useState(15);
  const rollNumber = Math.min(20, Math.max(1, Number(roll) || 1));
  const totalNumber = Math.max(0, Number(total) || 0);
  const possible = entries.filter((entry) => {
    const min = Number(entry.roll_min || entry.roll || 1);
    const max = Number(entry.roll_max || entry.roll || min);
    return rollNumber >= min && rollNumber <= max;
  });
  return (
    <div className="craft-section craft-section-card forage-roll-helper">
      <div className="craft-section-title">Forage Roll Helper</div>
      <div className="forage-roll-inputs">
        <label><span>d20 Roll</span><input className="form-control craft-input" type="number" min="1" max="20" value={roll} onChange={(event) => setRoll(event.target.value)} /></label>
        <label><span>Total Check</span><input className="form-control craft-input" type="number" min="0" max="50" value={total} onChange={(event) => setTotal(event.target.value)} /></label>
      </div>
      <div className="mt-2">
        {possible.length ? possible.map((entry) => {
          const dc = Number(entry.forage_dc || foragePlant(entry).forage_dc || 10);
          const success = totalNumber >= dc;
          return <div key={entry.id} className={cls("craft-bullet", success ? "forage-success" : "forage-fail")}>• {success ? "Found" : "Spotted but failed DC"}: {foragePlantName(entry)} ({foragePlantRarity(entry)}), DC {dc}, Qty {entry.quantity_formula || "1"}</div>;
        }) : <div className="craft-bullet muted">No plant is assigned to that d20 result for this location.</div>}
      </div>
    </div>
  );
}
function ForageEntryPreview({ entry, table, locations, recipes = [] }) {
  if (!entry) return <div className="craft-preview-card craft-preview-empty">Select a herb entry.</div>;
  const plant = foragePlant(entry);
  const tags = Array.isArray(plant.tags) ? plant.tags : [];
  const plantMaterial = materialFromPlant({ ...plant, ...entry, plants: plant });
  const familyKey = inferReagentFamily(plantMaterial);
  const potencyRank = Number(plant.potency_rank || entry.potency_rank || plantMaterial.potency_rank || 0) || reagentPotencyRank(foragePlantRarity(entry));
  const alchemyMatches = alchemyMatchesForPlant(entry, recipes).concat(
    recipes.filter((recipe) => recipe.discipline === "Alchemy" && (alchemyRecipeFamilySlots(recipe) || []).some((slot) => slot.family === familyKey && potencyRank >= reagentPotencyRank(slot.min_rarity || "Common"))).slice(0, 8).map((recipe) => ({ recipe, score: `family: ${reagentFamilyLabel(familyKey)}` }))
  ).filter((match, idx, arr) => arr.findIndex((other) => other.recipe?.id === match.recipe?.id) === idx).slice(0, 10);
  return (
    <div className="craft-preview-card forage-preview-card">
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Forage Detail</div>
          <h2 className="craft-preview-title">{foragePlantName(entry)}</h2>
        </div>
        <span className="craft-preview-rarity">DC {entry.forage_dc || plant.forage_dc || "—"}</span>
      </div>
      <div className="craft-preview-summary">{plant.effect || entry.notes || "A useful herb or reagent for alchemy."}</div>
      <div className="craft-preview-chip-row">
        <span className="craft-chip craft-chip-green">{foragePlantRarity(entry)}</span>
        <span className="craft-chip craft-chip-gold">Roll {forageRollRange(entry)}</span>
        <span className="craft-chip">Qty {entry.quantity_formula || "1"}</span>
        <span className="craft-chip craft-chip-blue">{forageLocationName(table, locations)}</span>
      </div>
      <div className="craft-preview-grid">
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Where It Grows</div>
          <div className="craft-bullet">• Found in: {plant.found_in || "DM-defined location"}</div>
          <div className="craft-bullet">• Climate: {plant.climate || table?.climate || "—"}</div>
          <div className="craft-bullet">• Biome: {plant.biome || table?.biome || "—"}</div>
          <div className="craft-bullet">• Terrain: {plant.terrain || table?.terrain || "—"}</div>
        </div>
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Use In Crafting</div>
          <div className="craft-bullet">• Category: {plant.category || "Plant / Herb"}</div>
          <div className="craft-bullet">• Reagent family: {reagentFamilyLabel(familyKey || plant.reagent_family || "Plant")}</div>
          <div className="craft-bullet">• Potency rank: {potencyRank} / 5</div>
          <div className="craft-bullet">• Season: {entry.season || "Any"}</div>
          <div className="craft-bullet">• Geography note: {entry.geography_note || "Use this entry when it makes sense for the location."}</div>
        </div>
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Tags</div>
          {tags.length ? <div className="craft-preview-chip-row mb-0">{tags.map((tagValue) => <span className="craft-chip" key={tagValue}>{tagValue}</span>)}</div> : <div className="craft-bullet muted">No tags recorded yet.</div>}
        </div>
        <div className="craft-section craft-section-card forage-alchemy-links">
          <div className="craft-section-title">Alchemy Formula Links</div>
          {alchemyMatches.length ? alchemyMatches.map(({ recipe, score }) => (
            <div className="craft-bullet" key={recipe.id}>• {recipe.name} <span className="text-muted">({recipe.rarity || "—"}, tag match {score})</span></div>
          )) : <div className="craft-bullet muted">No formula tag match yet. Add formula tags or plant tags to connect this herb.</div>}
        </div>
      </div>
      <ForageRollHelper entries={table?._entries || []} />
    </div>
  );
}
function ForagingTab({ locations = [], forageTables = [], forageEntries = [], recipes = [], query = "" }) {
  const [selectedTableId, setSelectedTableId] = useState(forageTables[0]?.id || "");
  const [selectedEntry, setSelectedEntry] = useState(null);

  const filteredTables = useMemo(() => {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return forageTables;
    return forageTables.filter((table) => forageTableSearchBlob(table, locations).includes(q));
  }, [forageTables, locations, query]);

  useEffect(() => {
    if (!filteredTables.length) {
      setSelectedTableId("");
      return;
    }
    if (!filteredTables.some((table) => String(table.id) === String(selectedTableId))) {
      setSelectedTableId(filteredTables[0].id);
    }
  }, [filteredTables, selectedTableId]);

  const selectedTable = filteredTables.find((table) => String(table.id) === String(selectedTableId)) || filteredTables[0] || null;
  const tableEntries = useMemo(() => {
    const q = String(query || "").toLowerCase().trim();
    return forageEntries
      .filter((entry) => String(entry.forage_table_id) === String(selectedTable?.id))
      .filter((entry) => !q || forageEntrySearchBlob(entry).includes(q) || forageTableSearchBlob(selectedTable, locations).includes(q))
      .sort((a, b) => Number(a.roll_min || 99) - Number(b.roll_min || 99) || Number(a.forage_dc || 99) - Number(b.forage_dc || 99));
  }, [forageEntries, selectedTable, locations, query]);

  useEffect(() => {
    if (!tableEntries.length) {
      setSelectedEntry(null);
      return;
    }
    if (!tableEntries.some((entry) => entry.id === selectedEntry?.id)) {
      setSelectedEntry(tableEntries[0]);
    }
  }, [tableEntries, selectedEntry?.id]);

  const tableWithEntries = selectedTable ? { ...selectedTable, _entries: tableEntries } : null;

  return (
    <div className="craft-forage-layout">
      <ForageTableList tables={filteredTables} locations={locations} selectedTableId={selectedTable?.id || ""} setSelectedTableId={setSelectedTableId} />
      <ForageEntryTable entries={tableEntries} selectedEntry={selectedEntry} setSelectedEntry={setSelectedEntry} />
      <ForageEntryPreview entry={selectedEntry} table={tableWithEntries} locations={locations} recipes={recipes} />
      <div className="craft-panel forage-guidance-panel">
        <div className="craft-panel-head"><strong>Rarity / DC Guide</strong><span className="craft-badge">DC 10–35</span></div>
        <div className="p-3">
          <div className="craft-bullet">• Common herbs: DC 10–14</div>
          <div className="craft-bullet">• Uncommon herbs: DC 15–19</div>
          <div className="craft-bullet">• Rare herbs: DC 20–24</div>
          <div className="craft-bullet">• Very Rare herbs: DC 25–29</div>
          <div className="craft-bullet">• Legendary herbs: DC 30–35</div>
          <div className="craft-bullet muted mt-2">Location tables are read from Supabase and can be tuned per settlement, dungeon, biome, or region without changing world-map behavior.</div>
        </div>
      </div>
    </div>
  );
}




function craftPlanStatusTone(status = "") {
  const s = String(status || "").toLowerCase();
  if (s === "approved" || s === "completed") return "known";
  if (s === "rejected" || s === "cancelled") return "danger";
  if (s === "submitted") return "submitted";
  return "";
}
function normalizeCraftPlan(row) {
  const payload = row?.plan_payload && typeof row.plan_payload === "object" ? row.plan_payload : {};
  const snapshot = Array.isArray(row?.material_snapshot) ? row.material_snapshot : [];
  return {
    ...row,
    recipe_name: row?.recipe_name || payload?.recipe?.name || "Unnamed Craft Plan",
    status: row?.status || "draft",
    discipline: row?.discipline || payload?.recipe?.discipline || "—",
    recipe_kind: row?.recipe_kind || payload?.recipe?.kind || "recipe",
    rarity: row?.rarity || payload?.recipe?.rarity || "—",
    material_snapshot: snapshot,
    plan_payload: payload,
    admin_notes: row?.admin_notes || "",
    target_character_id: row?.target_character_id || payload?.target_character?.id || null,
    target_character_name: row?.target_character_name || (payload?.target_character ? characterName(payload.target_character) : null),
    target_inventory_item_id: row?.target_inventory_item_id || payload?.base_item?.id || null,
    target_inventory_item_name: row?.target_inventory_item_name || payload?.base_item?.name || null,
    selected_materials: Array.isArray(row?.selected_materials) ? row.selected_materials : Array.isArray(payload?.selected_materials) ? payload.selected_materials : [],
    result_item_name: row?.result_item_name || payload?.result_item_name || row?.recipe_name || "",
    result_item_payload: row?.result_item_payload || {},
    reviewed_at: row?.reviewed_at || null,
    reviewed_by: row?.reviewed_by || null,
    completed_at: row?.completed_at || null,
    completed_by: row?.completed_by || null,
  };
}
function CraftPlanTable({ plans, selectedPlan, onSelect }) {
  return (
    <div className="craft-table-scroll craft-plans-table-scroll" role="region" aria-label="Craft plans queue">
      <table className="craft-recipe-sheet craft-plans-sheet">
        <thead>
          <tr>
            <th className="plan-name">Plan</th>
            <th className="plan-status">Status</th>
            <th className="plan-discipline">Discipline</th>
            <th className="plan-rarity">Rarity</th>
            <th className="plan-created">Created</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => {
            const active = selectedPlan?.id === plan.id;
            return (
              <tr key={plan.id} className={active ? "active" : ""} onClick={() => onSelect(plan)}>
                <td className="plan-name">
                  <div className="craft-sheet-name">{plan.recipe_name}</div>
                  <div className="craft-sheet-source">{titleCase(plan.recipe_kind)} • {plan.category || plan.family || "—"}</div>
                </td>
                <td className="plan-status">
                  <span className={cls("craft-status-pill", craftPlanStatusTone(plan.status))}>{titleCase(plan.status)}</span>
                </td>
                <td className="plan-discipline">
                  <span className={cls("craft-type-pill", `type-${String(plan.discipline || "recipe").toLowerCase()}`)}>{plan.discipline || "—"}</span>
                </td>
                <td className="plan-rarity">
                  <span className={cls("craft-rarity-pill", `rarity-${String(plan.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{plan.rarity || "—"}</span>
                </td>
                <td className="plan-created">
                  <span className="craft-applies-text">{plan.created_at ? new Date(plan.created_at).toLocaleDateString() : "—"}</span>
                </td>
              </tr>
            );
          })}
          {!plans.length ? <tr><td colSpan="5" className="text-muted p-3">No craft plans found yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function attemptStatusTone(result = "") {
  const r = String(result || "").toLowerCase();
  if (r === "critical_success" || r === "success") return "known";
  if (r === "partial_success") return "submitted";
  if (r === "failure" || r === "mishap") return "danger";
  return "";
}
function attemptLabel(result = "") {
  if (!result) return "Report";
  return titleCase(String(result).replace(/_/g, " "));
}
function attemptSearchBlob(attempt) {
  return [
    attempt?.recipe_name,
    attempt?.actor_character_name,
    attempt?.result_tier,
    attempt?.report_text,
    attempt?.created_at,
  ].filter(Boolean).join(" ").toLowerCase();
}
function CraftAttemptDetailCard({ attempt }) {
  if (!attempt) {
    return (
      <div className="craft-attempt-detail-card">
        <div className="craft-kicker">Attempt Detail</div>
        <h3>No report selected</h3>
        <p>Select an attempt report to inspect the saved roll, result, materials, effects, and generated report text.</p>
      </div>
    );
  }

  const materials = Array.isArray(attempt.selected_materials) ? attempt.selected_materials : [];
  const effects = Array.isArray(attempt.material_effects) ? attempt.material_effects : [];
  const output = attempt.output_item_payload && typeof attempt.output_item_payload === "object" ? attempt.output_item_payload : {};
  const delta = Number.isFinite(Number(attempt.roll_total)) && Number.isFinite(Number(attempt.dc))
    ? Number(attempt.roll_total) - Number(attempt.dc)
    : null;

  return (
    <div className="craft-attempt-detail-card">
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Attempt Detail</div>
          <h3>{attempt.recipe_name || "Craft Attempt"}</h3>
        </div>
        <span className={cls("craft-status-pill", attemptStatusTone(attempt.result_tier))}>{attemptLabel(attempt.result_tier)}</span>
      </div>

      <div className="craft-attempt-score-row">
        <div><strong>{attempt.roll_total ?? "—"}</strong><span>Roll</span></div>
        <div><strong>{attempt.dc ?? "—"}</strong><span>DC</span></div>
        <div><strong>{delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta}`}</strong><span>Delta</span></div>
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Report</div>
        <p className="craft-attempt-report-text">{attempt.report_text || "No report text was saved."}</p>
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Selected Materials</div>
        {materials.length ? materials.map((mat, idx) => (
          <div className="craft-bullet" key={`${mat.category || "material"}-${idx}`}>
            • {mat.category || "Material"}: {mat.name || "Not selected"} {mat.quantity_required ? `x${mat.quantity_required}` : ""}
          </div>
        )) : <div className="craft-bullet muted">No selected materials were recorded.</div>}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Material Effects</div>
        {effects.length ? effects.map((effect, idx) => (
          <div className="craft-material-effect-row" key={`${effect.effect_name || "effect"}-${idx}`}>
            <strong>{effect.effect_name || effect.name || "Material Effect"}</strong>
            <div>{effect.effect_summary || "No effect summary."}</div>
            {effect.dc_modifier ? <span>DC +{effect.dc_modifier}</span> : null}
          </div>
        )) : <div className="craft-bullet muted">No material effects were recorded.</div>}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Output Snapshot</div>
        <div className="craft-bullet">• Dry run: {output?.dry_run ? "Yes" : "No"}</div>
        <div className="craft-bullet">• Target: {output?.output_preview?.target || attempt.actor_character_name || "—"}</div>
        <div className="craft-bullet">• Output: {output?.output_preview?.name || "—"}</div>
        <div className="craft-bullet">• Created: {attempt.created_at ? new Date(attempt.created_at).toLocaleString() : "—"}</div>
      </div>
    </div>
  );
}
function CraftAttemptReportsPanel({ attempts = [], selectedPlan }) {
  const [attemptFilter, setAttemptFilter] = useState("All");
  const [attemptQuery, setAttemptQuery] = useState("");
  const [selectedAttemptId, setSelectedAttemptId] = useState("");

  const planAttempts = useMemo(() => {
    const rows = Array.isArray(attempts) ? attempts : [];
    if (!selectedPlan?.id) return rows;
    const filtered = rows.filter((attempt) => attempt.craft_plan_id === selectedPlan.id);
    return filtered.length ? filtered : rows;
  }, [attempts, selectedPlan?.id]);

  const counts = useMemo(() => {
    const map = new Map();
    planAttempts.forEach((attempt) => {
      const key = attemptLabel(attempt.result_tier);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [planAttempts]);

  const visibleAttempts = useMemo(() => {
    const q = String(attemptQuery || "").trim().toLowerCase();
    return planAttempts.filter((attempt) => {
      const label = attemptLabel(attempt.result_tier);
      const statusOk = attemptFilter === "All" || label === attemptFilter;
      const queryOk = !q || attemptSearchBlob(attempt).includes(q);
      return statusOk && queryOk;
    }).slice(0, 24);
  }, [planAttempts, attemptFilter, attemptQuery]);

  const selectedAttempt = visibleAttempts.find((attempt) => attempt.id === selectedAttemptId) || visibleAttempts[0] || null;

  useEffect(() => {
    if (!visibleAttempts.some((attempt) => attempt.id === selectedAttemptId)) {
      setSelectedAttemptId(visibleAttempts[0]?.id || "");
    }
  }, [visibleAttempts, selectedAttemptId]);

  const filterOptions = ["All", "Critical Success", "Success", "Partial Success", "Failure", "Mishap"];

  return (
    <div className="craft-panel craft-attempt-reports-panel">
      <div className="craft-panel-head">
        <strong>Attempt Reports</strong>
        <span className="craft-badge">{visibleAttempts.length} shown</span>
      </div>

      <div className="craft-attempt-report-toolbar">
        <input
          className="form-control craft-input"
          value={attemptQuery}
          onChange={(event) => setAttemptQuery(event.target.value)}
          placeholder="Search reports, crafter, result..."
        />
        <div className="craft-attempt-filter-row">
          {filterOptions.map((option) => (
            <button
              type="button"
              key={option}
              className={cls("btn btn-sm", attemptFilter === option ? "btn-primary" : "btn-outline-light")}
              onClick={() => setAttemptFilter(option)}
            >
              {option} <span>{option === "All" ? planAttempts.length : counts.get(option) || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="craft-attempt-workspace">
        <div className="craft-attempt-report-list">
          {visibleAttempts.map((attempt) => (
            <button
              type="button"
              className={cls("craft-attempt-report-card", selectedAttempt?.id === attempt.id && "active")}
              key={attempt.id}
              onClick={() => setSelectedAttemptId(attempt.id)}
            >
              <div className="craft-attempt-report-head">
                <div>
                  <strong>{attempt.recipe_name || "Craft Attempt"}</strong>
                  <span>{attempt.actor_character_name || "Unknown crafter"} • {attempt.created_at ? new Date(attempt.created_at).toLocaleString() : "—"}</span>
                </div>
                <span className={cls("craft-status-pill", attemptStatusTone(attempt.result_tier))}>{attemptLabel(attempt.result_tier)}</span>
              </div>
              <div className="craft-attempt-report-grid">
                <span>Roll <strong>{attempt.roll_total ?? "—"}</strong></span>
                <span>DC <strong>{attempt.dc ?? "—"}</strong></span>
                <span>Delta <strong>{Number.isFinite(Number(attempt.roll_total)) && Number.isFinite(Number(attempt.dc)) ? Number(attempt.roll_total) - Number(attempt.dc) : "—"}</strong></span>
              </div>
              <p>{attempt.report_text || "No report text was saved."}</p>
            </button>
          ))}
          {!visibleAttempts.length ? <div className="p-3 text-muted">No dry-run attempt reports match the current filters.</div> : null}
        </div>

        <CraftAttemptDetailCard attempt={selectedAttempt} />
      </div>
    </div>
  );
}


function craftPlanRequiresBaseItem(plan) {
  const kind = String(plan?.recipe_kind || "").toLowerCase();
  const discipline = String(plan?.discipline || "").toLowerCase();
  if (kind === "forge" || kind === "alchemy" || discipline === "alchemy") return false;
  if (discipline === "enchanting") return true;
  if (kind.includes("temper") || kind.includes("reforge")) return true;
  return false;
}
function craftPlanCompletionReadiness(plan) {
  if (!plan) return { ready: false, checks: [] };

  const selectedMaterials = Array.isArray(plan.selected_materials) ? plan.selected_materials : [];
  const missingCategories = Array.isArray(plan.missing_categories) ? plan.missing_categories : [];
  const requiresBase = craftPlanRequiresBaseItem(plan);
  const checks = [
    {
      key: "target",
      label: "Target character selected",
      ok: Boolean(plan.target_character_id || plan.target_character_name),
      detail: plan.target_character_name || "No target character selected.",
    },
    {
      key: "result",
      label: "Expected result named",
      ok: Boolean(plan.result_item_name || plan.recipe_name),
      detail: plan.result_item_name || plan.recipe_name || "No expected result name.",
    },
    {
      key: "base",
      label: requiresBase ? "Base item selected" : "Base item not required",
      ok: !requiresBase || Boolean(plan.target_inventory_item_id || plan.target_inventory_item_name),
      detail: requiresBase ? (plan.target_inventory_item_name || "This recipe should select a base/target item.") : (String(plan.discipline || "").toLowerCase() === "alchemy" ? "Alchemy creates a fresh potion batch." : "Forge-style plans can create a fresh item."),
    },
    {
      key: "materials",
      label: "Material selections reviewed",
      ok: selectedMaterials.length === 0 || selectedMaterials.every((mat) => !mat.category || mat.inventory_item_id || mat.name),
      detail: selectedMaterials.length ? `${selectedMaterials.filter((mat) => mat.inventory_item_id || mat.name).length}/${selectedMaterials.length} material groups selected.` : "No explicit material groups were stored.",
    },
    {
      key: "missing",
      label: "No missing material categories",
      ok: missingCategories.length === 0,
      detail: missingCategories.length ? `Missing: ${missingCategories.join(", ")}` : "No missing material categories recorded.",
    },
  ];

  return {
    ready: checks.every((check) => check.ok),
    checks,
  };
}
function craftPlanOutputPreview(plan) {
  if (!plan) return null;
  return {
    name: plan.result_item_name || plan.recipe_name || "Unnamed Crafted Item",
    target: plan.target_character_name || "No target character",
    base: plan.target_inventory_item_name || (craftPlanRequiresBaseItem(plan) ? "No base item selected" : "New item"),
    quantity: recipeOutputQuantity(plan),
    recipe: plan.recipe_name || "Unknown recipe",
    rarity: plan.rarity || "—",
    discipline: plan.discipline || "—",
  };
}
function resolveCraftAttemptBand(rollTotal, dc) {
  const roll = Number(rollTotal);
  const target = Number(dc);
  if (!Number.isFinite(roll) || !Number.isFinite(target)) {
    return { tier: "unrolled", label: "No Roll", delta: null };
  }
  const delta = roll - target;
  if (roll <= 1) return { tier: "mishap", label: "Mishap", delta };
  if (delta >= 10) return { tier: "critical_success", label: "Critical Success", delta };
  if (delta >= 0) return { tier: "success", label: "Success", delta };
  if (delta >= -4) return { tier: "partial_success", label: "Partial Success", delta };
  return { tier: "failure", label: "Failure", delta };
}
function craftAttemptReportText(plan, rollTotal, attemptPreview, band) {
  const dc = attemptPreview?.final_dc || plan?.plan_payload?.automation_preview?.final_dc || "—";
  const materials = Array.isArray(plan?.selected_materials)
    ? plan.selected_materials.filter((mat) => mat.name).map((mat) => `${mat.name} x${mat.quantity_required || 1}`).join(", ")
    : "";
  return [
    `${plan?.target_character_name || "A crafter"} attempted ${plan?.result_item_name || plan?.recipe_name || "a craft"}.`,
    `Roll total ${rollTotal} vs DC ${dc}: ${band.label}${band.delta === null ? "" : ` (${band.delta >= 0 ? "+" : ""}${band.delta})`}.`,
    materials ? `Selected materials: ${materials}.` : "No explicit material selections were recorded.",
    "Dry-run report only: no materials were consumed and no item was created.",
  ].join(" ");
}
function craftAttemptPayload(plan, rollTotal, attemptPreview, band) {
  return {
    craft_plan_id: plan?.id || null,
    actor_character_id: plan?.target_character_id || null,
    actor_character_name: plan?.target_character_name || null,
    recipe_id: plan?.recipe_id || null,
    recipe_name: plan?.recipe_name || "Unnamed Recipe",
    roll_total: Number(rollTotal),
    dc: Number(attemptPreview?.final_dc || plan?.plan_payload?.automation_preview?.final_dc || 0),
    result_tier: band.tier,
    selected_materials: Array.isArray(plan?.selected_materials) ? plan.selected_materials : [],
    material_effects: attemptPreview?.material_effects || plan?.plan_payload?.automation_preview?.material_effects || [],
    consumed_materials: [],
    output_item_payload: {
      dry_run: true,
      output_preview: craftPlanOutputPreview(plan),
      automation_preview: attemptPreview || plan?.plan_payload?.automation_preview || null,
      result_band: band,
    },
    report_text: craftAttemptReportText(plan, rollTotal, attemptPreview, band),
  };
}
function craftAttemptRpcPayload(payload) {
  return {
    craft_plan_id: payload.craft_plan_id,
    actor_character_id: payload.actor_character_id,
    actor_character_name: payload.actor_character_name,
    recipe_id: payload.recipe_id,
    recipe_name: payload.recipe_name,
    roll_total: payload.roll_total,
    dc: payload.dc,
    result_tier: payload.result_tier,
    selected_materials: payload.selected_materials,
    material_effects: payload.material_effects,
    consumed_materials: payload.consumed_materials,
    output_item_payload: payload.output_item_payload,
    report_text: payload.report_text,
  };
}



function successfulAttemptTier(tier = "") {
  const t = String(tier || "").toLowerCase();
  return t === "critical_success" || t === "success";
}
function attemptDelta(attempt) {
  if (!attempt) return null;
  const roll = Number(attempt.roll_total);
  const dc = Number(attempt.dc);
  if (!Number.isFinite(roll) || !Number.isFinite(dc)) return null;
  return roll - dc;
}
function latestAttemptForPlan(plan, attempts = []) {
  if (!plan?.id || !Array.isArray(attempts)) return null;
  return attempts
    .filter((attempt) => attempt.craft_plan_id === plan.id)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;
}
function craftPlanCompletionEligibility(plan, latestAttempt) {
  const checks = [
    {
      key: "plan",
      label: "Plan selected",
      ok: Boolean(plan?.id),
      detail: plan?.recipe_name || "No craft plan selected.",
    },
    {
      key: "target",
      label: "Target character saved",
      ok: Boolean(plan?.target_character_id || plan?.target_character_name),
      detail: plan?.target_character_name || "No target character on this plan.",
    },
    {
      key: "result",
      label: "Result item named",
      ok: Boolean(plan?.result_item_name || plan?.recipe_name),
      detail: plan?.result_item_name || plan?.recipe_name || "No result item name.",
    },
    {
      key: "attempt",
      label: "Successful attempt report",
      ok: successfulAttemptTier(latestAttempt?.result_tier),
      detail: latestAttempt ? `${attemptLabel(latestAttempt.result_tier)} (${latestAttempt.roll_total ?? "—"} vs DC ${latestAttempt.dc ?? "—"})` : "No dry-run/success attempt has been saved for this plan.",
    },
    {
      key: "status",
      label: "Plan not already completed",
      ok: String(plan?.status || "").toLowerCase() !== "completed",
      detail: `Current status: ${titleCase(plan?.status || "draft")}.`,
    },
  ];
  return { ready: checks.every((check) => check.ok), checks };
}
function craftCompletionReportText(plan, latestAttempt) {
  const delta = attemptDelta(latestAttempt);
  const materials = Array.isArray(plan?.selected_materials)
    ? plan.selected_materials.filter((mat) => mat.name).map((mat) => `${mat.name} x${mat.quantity_required || 1}`).join(", ")
    : "";
  return [
    `${plan?.target_character_name || "A crafter"} completed ${plan?.result_item_name || plan?.recipe_name || "a crafted item"}.`,
    latestAttempt ? `Completion used attempt ${attemptLabel(latestAttempt.result_tier)}: ${latestAttempt.roll_total} vs DC ${latestAttempt.dc}${delta === null ? "" : ` (${delta >= 0 ? "+" : ""}${delta})`}.` : "No attempt report was linked.",
    materials ? `Consumed materials: ${materials}.` : "No explicit material selections were recorded for consumption.",
  ].join(" ");
}


function CraftPlanPreview({ plan, latestAttempt, onStatusChange, onNotesSave, onCompletionPrepSave, onDryRunAttempt, onCompletePlan, updatingStatus, savingNotes, savingCompletionPrep, savingAttempt, completingPlan }) {
  const [draftNotes, setDraftNotes] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [attemptRoll, setAttemptRoll] = useState("");

  useEffect(() => {
    setDraftNotes(plan?.admin_notes || "");
    setCompletionNotes(plan?.completion_notes || "");
  }, [plan?.id, plan?.admin_notes, plan?.completion_notes]);

  if (!plan) {
    return <div className="craft-preview-card craft-preview-empty">Select a craft plan to review.</div>;
  }

  const notes = Array.isArray(plan?.plan_payload?.plan_notes) ? plan.plan_payload.plan_notes : [];
  const missing = Array.isArray(plan?.missing_categories) ? plan.missing_categories : [];
  const materialGroups = Array.isArray(plan?.material_snapshot) ? plan.material_snapshot : [];
  const readiness = craftPlanCompletionReadiness(plan);
  const outputPreview = craftPlanOutputPreview(plan);
  const savedAttemptPreview = plan?.plan_payload?.automation_preview || plan?.result_item_payload?.automation_preview || null;
  const attemptBand = attemptRoll ? resolveCraftAttemptBand(attemptRoll, savedAttemptPreview?.final_dc) : null;
  const completionEligibility = craftPlanCompletionEligibility(plan, latestAttempt);

  return (
    <div className="craft-preview-card craft-plan-review-card">
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Craft Plan Review</div>
          <h2 className="craft-preview-title">{plan.result_item_name || plan.recipe_name}</h2>
        </div>
        <span className={cls("craft-preview-rarity", `plan-${String(plan.status || "draft").toLowerCase()}`)}>{titleCase(plan.status)}</span>
      </div>

      <div className="craft-preview-summary">
        Review-only queue item. Status, notes, and completion prep are persistent; material consumption and output generation are still intentionally disabled.
      </div>

      <div className="craft-preview-chip-row">
        <span className="craft-chip craft-chip-blue">{plan.discipline || "—"}</span>
        <span className="craft-chip">{titleCase(plan.recipe_kind || "recipe")}</span>
        <span className="craft-chip craft-chip-gold">{plan.rarity || "—"}</span>
        <span className={readiness.ready ? "craft-chip craft-chip-green" : "craft-chip"}>{readiness.ready ? "Ready to complete later" : "Needs review"}</span>
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Target / Result</div>
        <div className="craft-bullet">• Target character: {plan.target_character_name || "—"}</div>
        <div className="craft-bullet">• Base item: {plan.target_inventory_item_name || (craftPlanRequiresBaseItem(plan) ? "—" : "New item")}</div>
        <div className="craft-bullet">• Expected result: {plan.result_item_name || plan.recipe_name || "—"}</div>
        {String(plan.discipline || "").toLowerCase() === "alchemy" ? <div className="craft-bullet">• Batch output: {recipeOutputQuantity(plan)} {recipeOutputQuantity(plan) === 1 ? "potion / dose" : "potions / doses"}</div> : null}
      </div>

      {plan?.plan_payload?.automation_preview ? (
        <div className="craft-section craft-section-card craft-automation-preview">
          <div className="craft-section-title">Saved Attempt DC Preview</div>
          <div className="craft-dc-total">DC {plan.plan_payload.automation_preview.final_dc}</div>
          <div className="craft-bullet">• Check: {plan.plan_payload.automation_preview.check_tool} + {plan.plan_payload.automation_preview.check_ability}</div>
          {(plan.plan_payload.automation_preview.material_effects || []).map((effect) => (
            <div className="craft-material-effect-row" key={`${effect.category}-${effect.inventory_item_id}`}>
              <strong>{effect.effect_name}</strong>
              <div>{effect.name}: {effect.effect_summary}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Completion Readiness</div>
        {readiness.checks.map((check) => (
          <div className={cls("craft-readiness-row", check.ok ? "ok" : "warn")} key={check.key}>
            <span>{check.ok ? "✓" : "!"}</span>
            <div>
              <strong>{check.label}</strong>
              <div>{check.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Output Preview</div>
        <div className="craft-bullet">• Item: {outputPreview?.name || "—"}</div>
        <div className="craft-bullet">• Recipe: {outputPreview?.recipe || "—"}</div>
        <div className="craft-bullet">• Rarity: {outputPreview?.rarity || "—"}</div>
        <div className="craft-bullet">• Target: {outputPreview?.target || "—"}</div>
        <div className="craft-bullet">• Base: {outputPreview?.base || "—"}</div>
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Selected Materials</div>
        {Array.isArray(plan.selected_materials) && plan.selected_materials.length
          ? plan.selected_materials.map((material) => <div className="craft-bullet" key={material.category}>• {material.category}: {material.name || "Not selected"} {material.quantity_required ? `x${material.quantity_required}` : ""}</div>)
          : <div className="craft-bullet muted">No explicit material selections saved.</div>}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Material Snapshot</div>
        {materialGroups.length ? materialGroups.map((group) => (
          <div className="craft-plan-material-group" key={group.category}>
            <strong>{group.category}</strong>
            {(group.candidates || []).length ? (group.candidates || []).map((mat) => (
              <div className="craft-bullet" key={`${group.category}-${mat.id}`}>• {mat.name} x{mat.quantity}</div>
            )) : <div className="craft-bullet muted">• No candidate material found.</div>}
          </div>
        )) : <div className="craft-bullet muted">No material snapshot stored.</div>}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Plan Notes</div>
        {notes.length ? notes.map((note, idx) => <div className="craft-bullet" key={idx}>• {note}</div>) : <div className="craft-bullet muted">No notes saved.</div>}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Admin Review Notes</div>
        <textarea
          className="form-control craft-input craft-admin-notes"
          value={draftNotes}
          onChange={(event) => setDraftNotes(event.target.value)}
          placeholder="Add review notes, requested changes, material rulings, downtime cost, NPC crafter notes..."
          rows={4}
        />
        <div className="d-flex justify-content-between align-items-center gap-2 mt-2">
          <span className="small text-muted">Saved to craft_plans.admin_notes.</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-light"
            disabled={savingNotes}
            onClick={() => onNotesSave(plan, draftNotes)}
          >
            {savingNotes ? "Saving..." : "Save Notes"}
          </button>
        </div>
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Completion Prep Notes</div>
        <textarea
          className="form-control craft-input craft-admin-notes"
          value={completionNotes}
          onChange={(event) => setCompletionNotes(event.target.value)}
          placeholder="Record final ruling, expected output adjustments, downtime cost, or material substitutions before building the real complete transaction..."
          rows={4}
        />
        <div className="d-flex justify-content-between align-items-center gap-2 mt-2">
          <span className="small text-muted">Saved to craft_plans.completion_notes. Does not complete the plan.</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-light"
            disabled={savingCompletionPrep}
            onClick={() => onCompletionPrepSave(plan, completionNotes, outputPreview, readiness)}
          >
            {savingCompletionPrep ? "Saving..." : "Save Completion Prep"}
          </button>
        </div>
      </div>

      <div className="craft-section craft-section-card craft-live-completion-card">
        <div className="craft-section-title">Live Completion Transaction</div>
        <div className="craft-bullet">• Uses the latest successful attempt report for this plan.</div>
        <div className="craft-bullet">• Consumes selected material stacks when present.</div>
        <div className="craft-bullet">• Creates the result item in the target character inventory.</div>
        <div className="craft-bullet">• Runs through a Supabase RPC transaction.</div>

        <div className="craft-completion-checks">
          {completionEligibility.checks.map((check) => (
            <div className={cls("craft-readiness-row", check.ok ? "ok" : "warn")} key={check.key}>
              <span>{check.ok ? "✓" : "!"}</span>
              <div>
                <strong>{check.label}</strong>
                <div>{check.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-sm btn-success mt-2"
          disabled={!completionEligibility.ready || completingPlan}
          onClick={() => onCompletePlan(plan, latestAttempt)}
        >
          {completingPlan ? "Completing..." : "Complete Plan Transaction"}
        </button>
      </div>

      <div className="craft-section craft-section-card craft-attempt-card">
        <div className="craft-section-title">Dry-Run Attempt Report</div>
        <div className="craft-bullet">• Enter a d20 + modifiers total to resolve against the saved DC preview.</div>
        <div className="craft-bullet">• This writes a report to crafting_attempts only.</div>
        <div className="craft-bullet">• No materials are consumed and no item is created.</div>
        <div className="craft-attempt-controls">
          <input
            className="form-control craft-input"
            type="number"
            min="1"
            value={attemptRoll}
            onChange={(event) => setAttemptRoll(event.target.value)}
            placeholder="Roll total"
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={savingAttempt || !attemptRoll || !savedAttemptPreview?.final_dc}
            onClick={() => onDryRunAttempt(plan, attemptRoll, savedAttemptPreview)}
          >
            {savingAttempt ? "Saving..." : "Save Dry-Run Report"}
          </button>
        </div>
        {attemptBand ? (
          <div className={cls("craft-attempt-result", `attempt-${attemptBand.tier}`)}>
            <strong>{attemptBand.label}</strong>
            <span>{attemptBand.delta >= 0 ? "+" : ""}{attemptBand.delta} vs DC {savedAttemptPreview?.final_dc || "—"}</span>
          </div>
        ) : null}
      </div>

      <div className="craft-plan-actions">
        {["draft", "submitted", "approved", "rejected", "completed", "cancelled"].map((status) => (
          <button
            type="button"
            key={status}
            className={cls("btn btn-sm", plan.status === status ? "btn-primary" : "btn-outline-light")}
            disabled={updatingStatus || plan.status === status}
            onClick={() => onStatusChange(plan, status)}
          >
            {titleCase(status)}
          </button>
        ))}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Audit Trail</div>
        <div className="craft-bullet">• Created: {plan.created_at ? new Date(plan.created_at).toLocaleString() : "—"}</div>
        <div className="craft-bullet">• Reviewed: {plan.reviewed_at ? new Date(plan.reviewed_at).toLocaleString() : "—"}</div>
        <div className="craft-bullet">• Completed: {plan.completed_at ? new Date(plan.completed_at).toLocaleString() : "—"}</div>
        <div className="craft-bullet">• Updated: {plan.updated_at ? new Date(plan.updated_at).toLocaleString() : "—"}</div>
      </div>

      <div className="craft-preview-footer">
        <span>Created</span>
        <strong>{plan.created_at ? new Date(plan.created_at).toLocaleString() : "—"}</strong>
      </div>
    </div>
  );
}

function planMatchesCraftFilters(plan, query = "", discipline = "All", rarityFilter = "All", knowledge = "All") {
  if (!plan) return false;
  const q = String(query || "").trim().toLowerCase();
  const hay = [
    plan.recipe_name,
    plan.result_item_name,
    plan.target_character_name,
    plan.target_inventory_item_name,
    plan.discipline,
    plan.recipe_kind,
    plan.rarity,
    plan.category,
    plan.family,
    plan.status,
    plan.completion_report,
    plan.admin_notes,
    plan.completion_notes,
    ...(Array.isArray(plan.selected_materials) ? plan.selected_materials.map((m) => `${m.category || ""} ${m.name || ""}`) : []),
  ].filter(Boolean).join(" ").toLowerCase();

  const disciplineOk = discipline === "All" || plan.discipline === discipline;
  const rarityOk = rarityFilter === "All" || plan.rarity === rarityFilter;
  // Craft plans are not player-known recipe rows. Treat the global Knowledge filter
  // as non-destructive here so clicking Known/Reference does not hide the whole
  // plan queue while reviewing attempts and completions.
  const knowledgeOk = knowledge === "All" || knowledge === "Known" || knowledge === "Reference";
  const queryOk = !q || hay.includes(q);
  return disciplineOk && rarityOk && knowledgeOk && queryOk;
}

function CraftPlansTab({ craftPlans, craftAttempts, selectedPlan, setSelectedPlan, reloadPlans, query = "", discipline = "All", rarityFilter = "All", knowledge = "All" }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingCompletionPrep, setSavingCompletionPrep] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [completingPlan, setCompletingPlan] = useState(false);
  const [planQueueMessage, setPlanQueueMessage] = useState("");
  const [planQueueError, setPlanQueueError] = useState("");

  const normalized = useMemo(() => craftPlans.map(normalizeCraftPlan), [craftPlans]);
  const filtered = useMemo(() => {
    return normalized.filter((plan) => {
      const statusOk = statusFilter === "All" || plan.status === statusFilter;
      return statusOk && planMatchesCraftFilters(plan, query, discipline, rarityFilter, knowledge);
    });
  }, [normalized, statusFilter, query, discipline, rarityFilter, knowledge]);
  const activePlan = selectedPlan ? normalizeCraftPlan(selectedPlan) : filtered[0] || normalized[0] || null;
  const activeLatestAttempt = latestAttemptForPlan(activePlan, craftAttempts);

  async function updatePlanStatus(plan, nextStatus) {
    if (!plan?.id || !nextStatus) return;
    setUpdatingStatus(true);
    setPlanQueueMessage("");
    setPlanQueueError("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const updatePayload = {
        status: nextStatus,
      };

      if (["approved", "rejected", "cancelled", "submitted"].includes(nextStatus)) {
        updatePayload.reviewed_at = new Date().toISOString();
        updatePayload.reviewed_by = userId;
      }
      if (nextStatus === "completed") {
        updatePayload.completed_at = new Date().toISOString();
        updatePayload.completed_by = userId;
        updatePayload.reviewed_at = plan.reviewed_at || new Date().toISOString();
        updatePayload.reviewed_by = plan.reviewed_by || userId;
      }

      const { error } = await supabase
        .from("craft_plans")
        .update(updatePayload)
        .eq("id", plan.id);
      if (error) throw error;
      setPlanQueueMessage(`Craft plan marked ${titleCase(nextStatus)}.`);
      await reloadPlans(plan.id);
    } catch (error) {
      setPlanQueueError(formatSupabaseError(error));
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function savePlanNotes(plan, adminNotes) {
    if (!plan?.id) return;
    setSavingNotes(true);
    setPlanQueueMessage("");
    setPlanQueueError("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("craft_plans")
        .update({
          admin_notes: adminNotes || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: authData?.user?.id || null,
        })
        .eq("id", plan.id);
      if (error) throw error;
      setPlanQueueMessage("Admin review notes saved.");
      await reloadPlans(plan.id);
    } catch (error) {
      setPlanQueueError(formatSupabaseError(error));
    } finally {
      setSavingNotes(false);
    }
  }

  async function saveCompletionPrep(plan, completionNotes, outputPreview, readiness) {
    if (!plan?.id) return;
    setSavingCompletionPrep(true);
    setPlanQueueMessage("");
    setPlanQueueError("");
    try {
      const nextPayload = {
        ...(plan.result_item_payload && typeof plan.result_item_payload === "object" ? plan.result_item_payload : {}),
        completion_preview: outputPreview || null,
        completion_readiness: readiness || null,
        completion_prepared_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("craft_plans")
        .update({
          completion_notes: completionNotes || null,
          result_item_payload: nextPayload,
        })
        .eq("id", plan.id);
      if (error) throw error;
      setPlanQueueMessage("Completion prep saved. No materials were consumed and no item was created.");
      await reloadPlans(plan.id);
    } catch (error) {
      setPlanQueueError(formatSupabaseError(error));
    } finally {
      setSavingCompletionPrep(false);
    }
  }

  async function saveDryRunAttempt(plan, rollTotal, attemptPreview) {
    if (!plan?.id || !rollTotal) return;
    setSavingAttempt(true);
    setPlanQueueMessage("");
    setPlanQueueError("");
    try {
      const band = resolveCraftAttemptBand(rollTotal, attemptPreview?.final_dc);
      const payload = craftAttemptPayload(plan, rollTotal, attemptPreview, band);
      const { error: insertError } = await supabase.from("crafting_attempts").insert(payload);
      if (insertError) {
        const { error: rpcError } = await supabase.rpc("submit_crafting_attempt_report", {
          p_attempt: craftAttemptRpcPayload(payload),
        });
        if (rpcError) {
          throw new Error(`Direct insert failed: ${formatSupabaseError(insertError)} RPC fallback failed: ${formatSupabaseError(rpcError)}`);
        }
      }
      setPlanQueueMessage(`Dry-run attempt saved: ${band.label}. No materials were consumed and no item was created.`);
      await reloadPlans(plan.id);
    } catch (error) {
      setPlanQueueError(formatSupabaseError(error));
    } finally {
      setSavingAttempt(false);
    }
  }

  async function completePlanTransaction(plan, latestAttempt) {
    if (!plan?.id) return;
    const dangerousMaterials = destructiveMaterialsFromPlan(plan);
    if (dangerousMaterials.length && typeof window !== "undefined") {
      const ok = window.confirm(destructiveMaterialMessage(dangerousMaterials));
      if (!ok) {
        setPlanQueueMessage("Completion cancelled. No item was consumed or created.");
        return;
      }
    }
    setCompletingPlan(true);
    setPlanQueueMessage("");
    setPlanQueueError("");
    try {
      const { data, error } = await supabase.rpc("complete_craft_plan_v1", {
        p_plan_id: plan.id,
        p_attempt_id: latestAttempt?.id || null,
      });
      if (error) throw error;
      const createdName = data?.created_item_name || plan.result_item_name || plan.recipe_name || "crafted item";
      setPlanQueueMessage(`Craft plan completed: ${createdName}. Materials were consumed only if selected and available.`);
      await reloadPlans(plan.id);
    } catch (error) {
      setPlanQueueError(formatSupabaseError(error));
    } finally {
      setCompletingPlan(false);
    }
  }


  return (
    <div className="craft-plans-layout">
      <div className="craft-panel">
        <div className="craft-panel-head"><strong>Plan Status</strong><span className="craft-badge">Queue</span></div>
        {["All", "draft", "submitted", "approved", "rejected", "completed", "cancelled"].map((status) => {
          const baseForCount = normalized.filter((plan) => planMatchesCraftFilters(plan, query, discipline, rarityFilter, knowledge));
          const count = status === "All" ? baseForCount.length : baseForCount.filter((plan) => plan.status === status).length;
          return (
            <button
              type="button"
              key={status}
              className={cls("craft-group-row", statusFilter === status && "craft-list-row-active")}
              onClick={() => setStatusFilter(status)}
            >
              <span>{titleCase(status)}</span>
              <span className="craft-badge">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="craft-panel craft-plans-table-panel">
        <div className="craft-panel-head">
          <strong>Craft Plans Queue</strong>
          <span className="craft-badge">{filtered.length} shown</span>
        </div>
        <CraftPlanTable plans={filtered} selectedPlan={activePlan} onSelect={setSelectedPlan} />
        {planQueueMessage ? <div className="craft-plan-alert success">{planQueueMessage}</div> : null}
        {planQueueError ? <div className="craft-plan-alert danger">{planQueueError}</div> : null}
      </div>

      <CraftAttemptReportsPanel attempts={craftAttempts} selectedPlan={activePlan} />

      <CraftPlanPreview
        plan={activePlan}
        latestAttempt={activeLatestAttempt}
        onStatusChange={updatePlanStatus}
        onNotesSave={savePlanNotes}
        onCompletionPrepSave={saveCompletionPrep}
        onDryRunAttempt={saveDryRunAttempt}
        onCompletePlan={completePlanTransaction}
        updatingStatus={updatingStatus}
        savingNotes={savingNotes}
        savingCompletionPrep={savingCompletionPrep}
        savingAttempt={savingAttempt}
        completingPlan={completingPlan}
      />
    </div>
  );
}
function masteryDisciplineStats(recipes = [], materials = [], playerRecipes = []) {
  const disciplines = [
    {
      id: "smithing",
      title: "Smithing",
      icon: "⚒️",
      summary: "Forge mundane gear, temper physical items, and eventually unlock special materials and salvage recipes.",
      recipes: recipes.filter((recipe) => recipe.discipline === "Smithing"),
      materials: materials.filter((material) => material.category === "Ore / Metal" || material.category === "Monster Part"),
      unlocks: ["Forge mundane equipment", "+1 / +2 / +3 tempering", "Special ores and monster-bit catalysts", "Future salvage / dismantle recipes"],
    },
    {
      id: "enchanting",
      title: "Enchanting",
      icon: "🔮",
      summary: "Bind A/B/C magical traits to smith-tiered gear, with future +4 legendary support.",
      recipes: recipes.filter((recipe) => recipe.discipline === "Enchanting"),
      materials: materials.filter((material) => material.category === "Catalyst" || material.category === "Monster Part"),
      unlocks: ["Slot A: Uncommon", "Slot B: Uncommon + Rare", "Slot C: Uncommon + Rare + Very Rare", "Future Slot D: Legendary / +4"],
    },
    {
      id: "alchemy",
      title: "Alchemy",
      icon: "🧪",
      summary: "Brew potions, poisons, oils, and field reagents once alchemy recipes are added.",
      recipes: recipes.filter((recipe) => recipe.discipline === "Alchemy"),
      materials: materials.filter((material) => material.category === "Plant / Herb" || material.category === "Reagent" || material.category === "Monster Part"),
      unlocks: ["Plant identification", "Potion recipes", "Monster-organ distillation", "Field harvesting and recipe experimentation"],
    },
    {
      id: "harvesting",
      title: "Harvesting",
      icon: "🦴",
      summary: "Track monster parts, plant gathering, and future quality grades used by recipes.",
      recipes: recipes.filter((recipe) => /monster|harvest|plant|reagent|alchemy/i.test(recipe.summary || recipe.name || "")),
      materials,
      unlocks: ["Material quality", "Source tracking", "Biome/monster clue links", "Future gathering rolls"],
    },
  ];

  return disciplines.map((discipline) => {
    const knownRecipes = discipline.recipes.filter((recipe) => recipe.known).length;
    const totalRecipes = discipline.recipes.length;
    const materialStacks = discipline.materials.length;
    const materialQty = discipline.materials.reduce((sum, material) => sum + (Number(material.quantity) || 0), 0);
    const knownRatio = totalRecipes ? knownRecipes / totalRecipes : 0;
    const materialRatio = Math.min(1, materialStacks / 8);
    const progress = Math.round(Math.min(100, (knownRatio * 70 + materialRatio * 30)));
    let rank = "Untrained";
    if (progress >= 70) rank = "Adept";
    else if (progress >= 35) rank = "Apprentice";
    else if (knownRecipes || materialStacks) rank = "Novice";

    return {
      ...discipline,
      knownRecipes,
      totalRecipes,
      materialStacks,
      materialQty,
      progress,
      rank,
      playerRecipeRows: playerRecipes.length,
    };
  });
}
function MasteryTrackCard({ track, active, onSelect }) {
  return (
    <button type="button" className={cls("craft-mastery-card", active && "active")} onClick={() => onSelect(track.id)}>
      <div className="craft-mastery-card-top">
        <span className="craft-mastery-icon">{track.icon}</span>
        <div>
          <div className="craft-mastery-title">{track.title}</div>
          <div className="craft-row-meta">{track.rank}</div>
        </div>
        <span className="craft-badge">{track.progress}%</span>
      </div>
      <div className="craft-mastery-progress">
        <div style={{ width: `${track.progress}%` }} />
      </div>
      <div className="craft-mastery-mini-stats">
        <span>{track.knownRecipes}/{track.totalRecipes} known</span>
        <span>{track.materialStacks} stacks</span>
      </div>
    </button>
  );
}
function MasteryDetail({ track }) {
  if (!track) return <div className="craft-preview-card craft-preview-empty">Select a mastery track.</div>;
  return (
    <div className="craft-preview-card craft-mastery-detail-card">
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Mastery Track</div>
          <h2 className="craft-preview-title">{track.icon} {track.title}</h2>
        </div>
        <span className="craft-preview-rarity">{track.rank}</span>
      </div>

      <div className="craft-preview-summary">{track.summary}</div>

      <div className="craft-preview-chip-row">
        <span className="craft-chip craft-chip-blue">{track.knownRecipes} known recipes</span>
        <span className="craft-chip">{track.totalRecipes} total recipes</span>
        <span className="craft-chip craft-chip-gold">{track.materialStacks} material stacks</span>
        <span className={track.progress >= 70 ? "craft-chip craft-chip-green" : "craft-chip"}>{track.progress}% progress</span>
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Unlock Roadmap</div>
        {track.unlocks.map((unlock, idx) => <div className="craft-bullet" key={idx}>• {unlock}</div>)}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Current Readiness</div>
        <div className="craft-bullet">• Known recipes: {track.knownRecipes}</div>
        <div className="craft-bullet">• Available reference recipes: {track.totalRecipes - track.knownRecipes}</div>
        <div className="craft-bullet">• Related material stacks: {track.materialStacks}</div>
        <div className="craft-bullet">• Related total quantity: {track.materialQty}</div>
      </div>

      <div className="craft-preview-footer">
        <span>Tracking</span>
        <strong>Read-only</strong>
      </div>
    </div>
  );
}
function MasteryTab({ recipes, materials, playerRecipes }) {
  const [activeTrack, setActiveTrack] = useState("smithing");
  const tracks = useMemo(() => masteryDisciplineStats(recipes, materials, playerRecipes), [recipes, materials, playerRecipes]);
  const selectedTrack = tracks.find((track) => track.id === activeTrack) || tracks[0];

  return (
    <div className="craft-mastery-layout">
      <div className="craft-panel craft-mastery-track-panel">
        <div className="craft-panel-head"><strong>Mastery Tracks</strong><span className="craft-badge">Progress</span></div>
        <div className="craft-mastery-track-list">
          {tracks.map((track) => <MasteryTrackCard key={track.id} track={track} active={selectedTrack?.id === track.id} onSelect={setActiveTrack} />)}
        </div>
      </div>

      <div className="craft-panel craft-mastery-matrix-panel">
        <div className="craft-panel-head"><strong>Progress Matrix</strong><span className="craft-badge">Read-only</span></div>
        <div className="craft-mastery-matrix">
          {tracks.map((track) => (
            <div className="craft-mastery-tile" key={track.id}>
              <div className="craft-mastery-tile-title">{track.icon} {track.title}</div>
              <div className="craft-mastery-tile-rank">{track.rank}</div>
              <div className="craft-mastery-progress mt-2"><div style={{ width: `${track.progress}%` }} /></div>
              <div className="craft-mastery-tile-grid">
                <div><strong>{track.knownRecipes}</strong><span>Known</span></div>
                <div><strong>{track.totalRecipes}</strong><span>Recipes</span></div>
                <div><strong>{track.materialStacks}</strong><span>Stacks</span></div>
              </div>
            </div>
          ))}
        </div>

        <div className="craft-section craft-section-card mt-3">
          <div className="craft-section-title">Future Admin Hooks</div>
          <div className="craft-bullet">• Award mastery XP or ranks after downtime, training, or quest rewards.</div>
          <div className="craft-bullet">• Assign mentor access from NPCs like Linn or Gormek.</div>
          <div className="craft-bullet">• Gate recipes by mastery rank without hiding DM reference data.</div>
          <div className="craft-bullet">• Unlock future +4 / Legendary enchantment support.</div>
        </div>
      </div>

      <MasteryDetail track={selectedTrack} />
    </div>
  );
}


export default function CraftingPage() {
  const router = useRouter();
  const workshopQueryApplied = useRef("");
  const [activeTab, setActiveTab] = useState("recipes");
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("All");
  const [knowledge, setKnowledge] = useState("All");
  const [rarityFilter, setRarityFilter] = useState("All");
  const [alchemySection, setAlchemySection] = useState("All");
  const [alchemyGroup, setAlchemyGroup] = useState("All");
  const [enchantingSection, setEnchantingSection] = useState("All");
  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [plantCatalog, setPlantCatalog] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [adminResourceOverride, setAdminResourceOverride] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [playerRecipes, setPlayerRecipes] = useState([]);
  const [craftPlans, setCraftPlans] = useState([]);
  const [craftAttempts, setCraftAttempts] = useState([]);
  const [recipeRules, setRecipeRules] = useState([]);
  const [materialEffects, setMaterialEffects] = useState([]);
  const [locations, setLocations] = useState([]);
  const [forageTables, setForageTables] = useState([]);
  const [forageEntries, setForageEntries] = useState([]);
  const [selectedCraftPlan, setSelectedCraftPlan] = useState(null);
  const [selected, setSelected] = useState(null);
  const [craftingRecipeId, setCraftingRecipeId] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function reloadCraftPlans(preferredId = null) {
    const [rows, attemptRows] = await Promise.all([
      selectSafe("craft_plans", "*", "created_at"),
      selectSafe("crafting_attempts", "*", "created_at"),
    ]);
    const sorted = [...rows].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const sortedAttempts = [...attemptRows].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    setCraftPlans(sorted);
    setCraftAttempts(sortedAttempts);
    setSelectedCraftPlan((prev) => {
      if (preferredId) return sorted.find((plan) => plan.id === preferredId) || sorted[0] || null;
      if (prev?.id) return sorted.find((plan) => plan.id === prev.id) || sorted[0] || null;
      return sorted[0] || null;
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const forced = params.get("craftAdmin") === "1" || window.localStorage?.getItem("dndnextCraftAdmin") === "1";
    setAdminResourceOverride(Boolean(forced));
  }, []);

  function toggleAdminResourceOverride() {
    setAdminResourceOverride((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        if (next) window.localStorage?.setItem("dndnextCraftAdmin", "1");
        else window.localStorage?.removeItem("dndnextCraftAdmin");
      }
      return next;
    });
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setErr("");
      try {
        const [authResponse, itemsJson, flavorOverrides, alchemyCatalogJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, plantCatalogRows, dbCatalogRows, knownRows, craftPlanRows, craftAttemptRows, characterRows, recipeRuleRows, materialEffectRows, locationRows, forageTableRows, forageEntryRows] = await Promise.all([
          supabase.auth.getUser().catch(() => ({ data: { user: null } })),
          json("/items/all-items.json", true),
          json("/items/flavor-overrides.json"),
          json("/items/alchemy-catalog.json"),
          json("/items/magicvariants.json"),
          json("/items/magicvariants.hb-armor-shield.json"),
          selectSafe("recipes", "*", "name"),
          selectSafe("inventory_items", "*", "item_name"),
          selectPlayerPlantsSafe(),
          selectSafe("plants", "*", "name"),
          selectSafe("items_catalog", "*", "item_name"),
          selectSafe("player_recipes", "*", "recipe_id"),
          selectSafe("craft_plans", "*", "created_at"),
          selectSafe("crafting_attempts", "*", "created_at"),
          selectSafe("characters", "*", "name"),
          selectSafe("crafting_recipe_rules", "*", "discipline"),
          selectSafe("crafting_material_effects", "*", "material_category"),
          selectSafe("locations", "id,name,description,biome_id", "name"),
          selectSafe("forage_tables", "*", "name"),
          selectSafe("forage_table_entries", "*, plants(*)", "roll_min"),
        ]);
        const knownIds = new Set(knownRows.map((r) => r.recipe_id || r.recipe_name || r.name || r.id).filter(Boolean).map((v) => String(v).toLowerCase()));
        const rawRecipes = [
          ...rows(itemsJson).filter(isForgeItem).map((item) => forgeRecipe(item, flavorOverrides || {})),
          ...temperRecipes(),
          ...[...rows(coreVariants), ...rows(hbVariants)].map(variantRecipe).filter(Boolean),
          ...ALCHEMY_DYNAMIC_FORMULAS.map(alchemyFormulaRecipe),
          ...ALCHEMY_POTION_FORMULAS.filter((formula) => !COMPACT_ALCHEMY_RECIPE_NAMES.has(formula.name)).map(alchemyFormulaRecipe),
          ...dbRecipes.map((r) => dbRecipe(r, knownIds)),
        ].filter((recipe) => !isDeprecatedAlchemyRecipe(recipe));
        const dedupedRecipeMap = new Map();
        rawRecipes.forEach((recipe) => {
          const key = [
            String(recipe.discipline || "").toLowerCase(),
            String(recipe.kind || "").toLowerCase(),
            String(canonicalAlchemyRecipeName(recipe.name || "")).toLowerCase().replace(/^craft\s+/i, "").trim(),
          ].join("::");
          const existing = dedupedRecipeMap.get(key);
          const recipeIsDb = String(recipe.id || "").startsWith("db:");
          const existingIsDb = String(existing?.id || "").startsWith("db:");
          if (!existing || (recipeIsDb && !existingIsDb)) dedupedRecipeMap.set(key, recipe);
        });
        const allRecipes = Array.from(dedupedRecipeMap.values()).map((recipe) => {
          const keys = [recipe.id, recipe.name, recipe.key, recipe.originalName].filter(Boolean).map((v) => String(v).toLowerCase());
          const withKnown = { ...recipe, known: recipe.known || keys.some((key) => knownIds.has(key)) };
          if (withKnown.discipline !== "Alchemy") return withKnown;
          const details = withKnown.alchemy_details || alchemyDetailForName(withKnown.name) || {};
          const numeric = alchemyNumericProfile(withKnown, details);
          const section = alchemySectionForRecipe(withKnown);
          return {
            ...withKnown,
            alchemy_section: section,
            alchemy_group: withKnown.alchemy_group || alchemyGroupForRecipe(withKnown),
            category: section,
            base_duration_seconds: numeric.base_duration_seconds,
            base_duration_dice_count: numeric.base_duration_dice_count,
            base_duration_die_size: numeric.base_duration_die_size,
            base_duration_unit: numeric.base_duration_unit,
            base_duration_text: numeric.base_duration_text,
            base_dice_count: numeric.base_dice_count,
            base_die_size: numeric.base_die_size,
            base_flat_bonus: numeric.base_flat_bonus,
            base_uses: numeric.base_uses,
            dice_purpose: numeric.dice_purpose,
            effect_cadence: numeric.effect_cadence,
            base_area_feet: Number(withKnown.base_area_feet || 0) || 0,
            area_shape: withKnown.area_shape || "",
            save_ability: withKnown.save_ability || "",
            duration: formatAlchemyDuration(numeric, 0, 0, withKnown.duration || details.duration || "Until used"),
          };
        }).sort((a, b) => String(a.discipline).localeCompare(String(b.discipline)) || (a.discipline === "Alchemy" ? ALCHEMY_SECTIONS.indexOf(alchemySectionForRecipe(a)) - ALCHEMY_SECTIONS.indexOf(alchemySectionForRecipe(b)) : 0) || rarityRank(a.rarity) - rarityRank(b.rarity) || String(a.name).localeCompare(String(b.name)));
        const allMaterials = [...inventoryRows.map(materialFromInventory).filter(Boolean), ...plantRows.map(materialFromPlant)].sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const sortedCraftPlans = [...craftPlanRows].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        const sortedCraftAttempts = [...craftAttemptRows].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        if (!mounted) return;
        const alchemyCatalogRows = rows(alchemyCatalogJson);
        const dbAlchemyCatalogRows = rows(dbCatalogRows).filter((row) => row?.payload?.alchemy || row?.payload?.smithing);
        // DB merge note: public.items_catalog.payload.alchemy is the long-term
        // canonical ingredient/catalog source. The local JSON remains a fallback
        // for development and for deployments before the SQL seed has been run.
        // Raw plants are intentionally not used as admin catalog choices here;
        // otherwise older generated plant rows can diverge from the player-facing
        // codex. Player-owned gathered plants still enter through player_plants.
        const canonicalAlchemyCatalogRows = dbAlchemyCatalogRows.length
          ? [...alchemyCatalogRows, ...dbAlchemyCatalogRows]
          : [...alchemyCatalogRows, ...plantCatalogRows];
        setRecipes(allRecipes); setMaterials(allMaterials); setPlantCatalog(canonicalAlchemyCatalogRows); setCurrentUser(authResponse?.data?.user || null); setInventoryItems(inventoryRows); setCharacters(characterRows); setRecipeRules(recipeRuleRows); setMaterialEffects(materialEffectRows); setLocations(locationRows); setForageTables(forageTableRows); setForageEntries(forageEntryRows); setPlayerRecipes(knownRows); setCraftPlans(sortedCraftPlans); setCraftAttempts(sortedCraftAttempts); setSelectedCraftPlan((prev) => prev || sortedCraftPlans[0] || null); setSelected(allRecipes[0] || null); setSelectedMaterial((prev) => prev || allMaterials[0] || null);
      } catch (e) {
        if (mounted) setErr(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const disciplineOptions = useMemo(() => ["All", ...Array.from(new Set(recipes.map((r) => r.discipline).filter(Boolean))).sort()], [recipes]);
  const rarityOptions = useMemo(() => ["All", ...Array.from(new Set(recipes.map((r) => r.rarity).filter(Boolean))).sort((a, b) => rarityRank(a) - rarityRank(b))], [recipes]);
  const alchemySectionCounts = useMemo(() => {
    const counts = { All: 0, Potions: 0, Poisons: 0, Bombs: 0, Elixirs: 0, Oils: 0 };
    recipes.filter((recipe) => recipe.discipline === "Alchemy").forEach((recipe) => {
      counts.All += 1;
      const section = alchemySectionForRecipe(recipe);
      counts[section] = (counts[section] || 0) + 1;
    });
    return counts;
  }, [recipes]);
  const alchemyGroupCounts = useMemo(() => {
    const counts = { All: 0 };
    recipes.filter((recipe) => recipe.discipline === "Alchemy" && (alchemySection === "All" || alchemySectionForRecipe(recipe) === alchemySection)).forEach((recipe) => {
      counts.All += 1;
      const group = alchemyGroupForRecipe(recipe);
      counts[group] = (counts[group] || 0) + 1;
    });
    return counts;
  }, [recipes, alchemySection]);
  const enchantingSectionCounts = useMemo(() => {
    const counts = Object.fromEntries(ENCHANTING_SECTIONS.map((section) => [section, 0]));
    recipes.filter((recipe) => recipe.discipline === "Enchanting").forEach((recipe) => {
      counts.All += 1;
      enchantingSectionsForRecipe(recipe).forEach((section) => {
        counts[section] = (counts[section] || 0) + 1;
      });
    });
    return counts;
  }, [recipes]);
  const filteredRecipes = useMemo(() => recipes.filter((r) => {
    const disciplineMatch = discipline === "All" || r.discipline === discipline;
    const sectionMatch = alchemySection === "All" || (r.discipline === "Alchemy" && alchemySectionForRecipe(r) === alchemySection);
    const groupMatch = alchemyGroup === "All" || (r.discipline === "Alchemy" && alchemyGroupForRecipe(r) === alchemyGroup);
    const enchantingMatch = enchantingSection === "All" || (r.discipline === "Enchanting" && enchantingSectionsForRecipe(r).includes(enchantingSection));
    return disciplineMatch && sectionMatch && groupMatch && enchantingMatch && (rarityFilter === "All" || r.rarity === rarityFilter) && (knowledge !== "Known" || r.known) && (knowledge !== "Reference" || !r.known) && matches(r, query);
  }), [recipes, discipline, alchemySection, alchemyGroup, enchantingSection, rarityFilter, knowledge, query]);

  useEffect(() => {
    if (!filteredRecipes.length) {
      if (selected) setSelected(null);
      if (craftingRecipeId) setCraftingRecipeId(null);
      return;
    }
    if (!selected || !filteredRecipes.some((recipe) => String(recipe.id) === String(selected.id))) {
      setSelected(filteredRecipes[0]);
      setCraftingRecipeId(null);
    }
  }, [filteredRecipes, selected?.id, craftingRecipeId]);

  useEffect(() => {
    if (!router.isReady || !recipes.length) return;
    const requested = String(router.query.discipline || "").trim();
    const shouldCraft = String(router.query.craft || "") === "1";
    if (!requested && !shouldCraft) return;
    const key = `${requested}::${shouldCraft}::${router.query.crafter || ""}`;
    if (workshopQueryApplied.current === key) return;
    const requestedDiscipline = ["Smithing", "Enchanting", "Alchemy"].find((value) => value.toLowerCase() === requested.toLowerCase()) || "";
    if (requestedDiscipline) {
      setActiveTab("recipes");
      setDiscipline(requestedDiscipline);
      setKnowledge("All");
      setRarityFilter("All");
      setAlchemySection("All");
      setAlchemyGroup("All");
      setEnchantingSection("All");
      const firstRecipe = recipes.find((recipe) => recipe.discipline === requestedDiscipline) || null;
      if (firstRecipe) {
        setSelected(firstRecipe);
        setCraftingRecipeId(shouldCraft ? firstRecipe.id : null);
      }
    }
    workshopQueryApplied.current = key;
  }, [router.isReady, router.query.discipline, router.query.craft, router.query.crafter, recipes]);

  const filteredMaterials = useMemo(() => materials.filter((m) => (materialCategoryFilter === "All" || m.category === materialCategoryFilter) && materialMatches(m, query)), [materials, materialCategoryFilter, query]);
  const materialTotalQty = materials.reduce((sum, material) => sum + (Number(material.quantity) || 0), 0);
  const isAdminTestResources = adminResourceOverride || isAdminCraftingUser(currentUser);
  const craftingResourceCatalog = useMemo(() => mergeCraftingResources(materials, plantCatalog, isAdminTestResources), [materials, plantCatalog, isAdminTestResources]);
  const visibleMaterialQty = filteredMaterials.reduce((sum, material) => sum + (Number(material.quantity) || 0), 0);
  const catalystCount = materials.filter((m) => m.category === "Catalyst").length;
  const monsterPartCount = materials.filter((m) => m.category === "Monster Part").length;
  const knownCount = recipes.filter((r) => r.known).length;
  const enchantCount = recipes.filter((r) => r.discipline === "Enchanting").length;
  const smithCount = recipes.filter((r) => r.discipline === "Smithing").length;
  const alchemyCount = recipes.filter((r) => r.discipline === "Alchemy").length;
  const selectedKnownRecipe = selected && selected.known ? selected : recipes.find((r) => r.known) || selected;
  const clear = () => { setQuery(""); setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); };
  const quick = (p) => {
    if (p === "All") {
      setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All");
    } else if (p === "Known") {
      setKnowledge("Known");
    } else {
      setDiscipline(p); setKnowledge("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All");
    }
  };
  function chooseEnchantingSection(section) {
    setDiscipline("Enchanting");
    setKnowledge("All");
    setEnchantingSection(section);
    setCraftingRecipeId(null);
    const next = recipes.find((recipe) => recipe.discipline === "Enchanting" && (section === "All" || enchantingSectionsForRecipe(recipe).includes(section)));
    if (next) setSelected(next);
  }

  function chooseAlchemySection(section) {
    setDiscipline("Alchemy");
    setKnowledge("All");
    setAlchemySection(section);
    setAlchemyGroup("All");
    setCraftingRecipeId(null);
    const next = recipes.find((recipe) => recipe.discipline === "Alchemy" && (section === "All" || alchemySectionForRecipe(recipe) === section));
    if (next) setSelected(next);
  }

  function chooseAlchemyGroup(group) {
    setAlchemyGroup(group);
    setCraftingRecipeId(null);
    const next = recipes.find((recipe) => recipe.discipline === "Alchemy" && (alchemySection === "All" || alchemySectionForRecipe(recipe) === alchemySection) && (group === "All" || alchemyGroupForRecipe(recipe) === group));
    if (next) setSelected(next);
  }

  const craftModeRecipe = selected && craftingRecipeId === selected.id ? selected : null;
  function toggleCraftRecipe(recipe) {
    if (!recipe) return;
    setSelected(recipe);
    setCraftingRecipeId((prev) => prev === recipe.id ? null : recipe.id);
  }

  return <div className="craft-page"><div className="container my-4"><div className="craft-hero"><div><div className="craft-kicker">Crafting Hub</div><h1>🧪 Crafting / Recipes</h1><p>Browse recipes, track materials, plan crafting, and review discovery progress.</p></div><div className="craft-hero-stats"><StatTile label="Recipes" value={recipes.length} /><StatTile label="Known" value={knownCount} tone="green" /><StatTile label="Materials" value={materials.length} tone="gold" /><button type="button" className={cls("craft-admin-resource-toggle", isAdminTestResources && "active")} onClick={toggleAdminResourceOverride} title="Admin testing: treat every crafting resource as available.">{isAdminTestResources ? "Admin Resources: ON" : "Admin Resources: OFF"}</button></div></div>
    <div className="craft-tabbar">{TABS.map(([id, icon, label]) => <button key={id} type="button" className={cls("craft-tab", activeTab === id && "craft-tab-active")} onClick={() => setActiveTab(id)}><span className="me-1">{icon}</span>{label}</button>)}</div>
    <div className="craft-controls"><div className="craft-control-wide"><label className="form-label fw-semibold">Search</label><input className="form-control craft-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, enchants, reagents, monster parts…" /></div><div><label className="form-label fw-semibold">Discipline</label><select className="form-select craft-input" value={discipline} onChange={(e) => { const next = e.target.value; setDiscipline(next); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); }}>{disciplineOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></div><div><label className="form-label fw-semibold">Knowledge</label><select className="form-select craft-input" value={knowledge} onChange={(e) => setKnowledge(e.target.value)}>{["All", "Known", "Reference"].map((v) => <option key={v} value={v}>{v}</option>)}</select></div><div><label className="form-label fw-semibold">Rarity</label><select className="form-select craft-input" value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>{rarityOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></div><div className="d-grid"><label className="form-label fw-semibold opacity-0">Clear</label><button type="button" className="btn btn-outline-light" onClick={clear}>Clear</button></div></div>
    <div className="craft-pills">{["All", "Smithing", "Enchanting", "Alchemy", "Known"].map((p) => <button key={p} type="button" className={cls("craft-pill", ((p === "All" && discipline === "All" && knowledge === "All") || discipline === p || knowledge === p) && "craft-pill-active")} onClick={() => quick(p)}>{p}</button>)}</div>
    {discipline === "Enchanting" && activeTab === "recipes" ? (
      <div className="craft-alchemy-section-bar craft-enchanting-section-bar" aria-label="Enchanting item categories">
        <div>
          <div className="craft-kicker">Enchanting Categories</div>
          <div className="craft-alchemy-section-note">Filter magical traits by the physical item type they can be bound to.</div>
        </div>
        <div className="craft-alchemy-section-buttons">
          {ENCHANTING_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              className={cls("craft-alchemy-section-button", "craft-enchanting-section-button", enchantingSection === section && "active")}
              onClick={() => chooseEnchantingSection(section)}
            >
              <span>{section}</span>
              <strong>{enchantingSectionCounts[section] || 0}</strong>
            </button>
          ))}
        </div>
      </div>
    ) : null}
    {discipline === "Alchemy" && activeTab === "recipes" ? (
      <div className="craft-alchemy-section-bar" aria-label="Alchemy recipe sections">
        <div>
          <div className="craft-kicker">Alchemy Sections</div>
          <div className="craft-alchemy-section-note">Potions, poisons, bombs, elixirs, and oils are grouped into readable recipe families.</div>
        </div>
        <div className="craft-alchemy-section-buttons">
          {ALCHEMY_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              className={cls("craft-alchemy-section-button", `section-${section.toLowerCase()}`, alchemySection === section && "active")}
              onClick={() => chooseAlchemySection(section)}
            >
              <span>{section}</span>
              <strong>{alchemySectionCounts[section] || 0}</strong>
            </button>
          ))}
        </div>
        {alchemySection !== "All" ? <div className="craft-alchemy-group-buttons" aria-label={`${alchemySection} recipe groups`}>
          {(ALCHEMY_GROUPS_BY_SECTION[alchemySection] || ["All"]).map((group) => (
            <button key={group} type="button" className={cls("craft-alchemy-group-button", alchemyGroup === group && "active")} onClick={() => chooseAlchemyGroup(group)}>
              <span>{group}</span><strong>{alchemyGroupCounts[group] || 0}</strong>
            </button>
          ))}
        </div> : null}
      </div>
    ) : null}
    {err ? <div className="alert alert-danger">{err}</div> : null}{loading ? <div className="text-muted">Loading crafting data…</div> : null}
    {!loading && activeTab === "recipes" ? (craftModeRecipe ? <RecipePreview recipe={craftModeRecipe} materials={materials} inventoryItems={inventoryItems} characters={characters} recipeRules={recipeRules} materialEffects={materialEffects} resourceCatalog={craftingResourceCatalog} isAdminTestResources={isAdminTestResources} craftMode onExitCraft={() => setCraftingRecipeId(null)} /> : <div className="craft-grid-main craft-recipes-wide"><div className="craft-panel craft-recipe-table-panel"><div className="craft-panel-head"><strong>Recipes Spreadsheet</strong><span className="craft-badge">{filteredRecipes.length} shown</span></div><RecipeTable recipes={filteredRecipes} selected={selected} onSelect={setSelected} onCraft={toggleCraftRecipe} craftingRecipeId={craftingRecipeId} /></div><RecipePreview recipe={selected} materials={materials} inventoryItems={inventoryItems} characters={characters} recipeRules={recipeRules} materialEffects={materialEffects} resourceCatalog={craftingResourceCatalog} isAdminTestResources={isAdminTestResources} /></div>) : null}
    {!loading && activeTab === "materials" ? <div className="craft-grid-main craft-materials-grid"><MaterialCategoryPanel materials={materials} activeCategory={materialCategoryFilter} setActiveCategory={setMaterialCategoryFilter} /><div className="craft-panel craft-recipe-table-panel"><div className="craft-panel-head"><strong>Materials Ledger</strong><span className="craft-badge">{filteredMaterials.length} stacks / {visibleMaterialQty} total</span></div><MaterialTable materials={filteredMaterials} selected={selectedMaterial} onSelect={setSelectedMaterial} /></div><MaterialPreview material={selectedMaterial} recipes={recipes} /></div> : null}
        {!loading && activeTab === "bench" ? <CraftBenchTab recipes={filteredRecipes} materials={craftingResourceCatalog} inventoryItems={inventoryItems} characters={characters} recipeRules={recipeRules} materialEffects={materialEffects} selectedRecipe={selected} setSelectedRecipe={setSelected} /> : null}
        {!loading && activeTab === "plans" ? <CraftPlansTab craftPlans={craftPlans} craftAttempts={craftAttempts} selectedPlan={selectedCraftPlan} setSelectedPlan={setSelectedCraftPlan} reloadPlans={reloadCraftPlans} query={query} discipline={discipline} rarityFilter={rarityFilter} knowledge={knowledge} /> : null}
        {!loading && activeTab === "discovery" ? <DiscoveryTab recipes={recipes} materials={materials} playerRecipes={playerRecipes} selectedRecipe={selected} setSelectedRecipe={setSelected} /> : null}
        {!loading && activeTab === "forage" ? <ForagingTab locations={locations} forageTables={forageTables} forageEntries={forageEntries} recipes={recipes} query={query} /> : null}
        {!loading && activeTab === "mastery" ? <MasteryTab recipes={recipes} materials={materials} playerRecipes={playerRecipes} /> : null}
    </div><style jsx global>{`
      .craft-page{min-height:calc(100vh - 56px);background:radial-gradient(circle at top left,rgba(113,65,178,.25),transparent 36%),linear-gradient(180deg,#140d20,#0e0915);color:#f4f1ff;padding-bottom:56px}.craft-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:18px;border:1px solid #342847;border-radius:18px;background:linear-gradient(180deg,#181020,#100b16);box-shadow:0 24px 70px rgba(0,0,0,.25)}.craft-kicker{color:#86bdff;font-size:11px;font-weight:900;letter-spacing:.2em;text-transform:uppercase}.craft-hero h1{margin:5px 0 4px;font-size:30px;font-weight:900}.craft-hero p,.craft-panel p,.craft-preview-card p{color:#b9b1ca}.craft-hero-stats,.craft-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(90px,1fr));gap:8px}.craft-admin-resource-toggle{grid-column:1/-1;border:1px solid rgba(240,194,111,.45);border-radius:12px;background:rgba(30,37,49,.92);color:#f7e8bd;padding:10px 12px;font-size:12px;font-weight:950;letter-spacing:.04em;text-transform:uppercase}.craft-admin-resource-toggle.active{border-color:rgba(59,211,154,.72);color:#c8ffe8;background:linear-gradient(135deg,rgba(32,148,97,.35),rgba(35,43,58,.92))}.craft-admin-resource-toggle:hover{filter:brightness(1.08)}.craft-stat{min-width:92px;padding:10px 12px;border:1px solid #3d344e;border-radius:10px;background:#1f2430}.craft-stat.green{border-color:rgba(57,201,143,.55)}.craft-stat.gold{border-color:rgba(213,175,92,.65)}.craft-stat-value{font-size:22px;font-weight:900;line-height:1}.craft-stat-label{color:#c4bad4;font-size:11px;margin-top:4px}.craft-tabbar{display:flex;flex-wrap:wrap;gap:6px;margin:18px 0 14px;border-bottom:1px solid #332a42}.craft-tab{padding:10px 14px;border:1px solid #47375f;border-bottom:0;border-radius:9px 9px 0 0;background:#171b24;color:#efeaff;font-size:13px;font-weight:800}.craft-tab-active{background:#2d2145;border-color:#8b6fc0;box-shadow:inset 0 2px 0 #d5af5c}.craft-controls{display:grid;grid-template-columns:minmax(260px,1.6fr) 180px 170px 170px auto;gap:10px;align-items:end}.craft-input{background:#202636;border-color:#404758;color:#f4f1ff}.craft-input:focus{background:#202636;color:#fff;border-color:#8b6fc0;box-shadow:0 0 0 .2rem rgba(139,92,246,.15)}.craft-pills{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 16px}.craft-pill{border:1px solid #8c7aa8;color:#f6f1ff;background:#151923;border-radius:5px;padding:6px 10px;font-size:12px}.craft-pill-active{background:#f1eef7;color:#111827}.craft-grid-main{display:grid;grid-template-columns:20% minmax(0,48%) minmax(320px,32%);gap:14px;align-items:start}.craft-recipes-wide{grid-template-columns:minmax(0,58%) minmax(380px,42%)}.craft-grid-two{display:grid;grid-template-columns:38% 62%;gap:14px}.craft-grid-three-even{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.craft-panel,.craft-preview-card{border:1px solid #323a46;background:#1a202a;border-radius:10px;overflow:hidden}.craft-preview-card{padding:18px;background:linear-gradient(180deg,#2b2240,#1f1931);border-color:#453461;box-shadow:inset 0 2px 0 rgba(213,175,92,.75)}.craft-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #303846;background:#202636}.craft-list{max-height:68vh;overflow:auto}.craft-list-row,.craft-group-row{width:100%;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:13px 14px;border:0;border-bottom:1px solid #38404d;background:#1a202a;color:#f4f1ff;text-align:left}.craft-list-row:hover,.craft-group-row:hover{background:#222b3a}.craft-list-row-static{cursor:default}.craft-list-row-active{background:#26304a;border-left:4px solid #d5af5c;padding-left:10px}.craft-row-title{font-weight:900}.craft-row-meta{color:#cfc6df;font-size:12px;margin-top:3px}.craft-badge{display:inline-flex;align-items:center;justify-content:center;min-height:22px;padding:3px 7px;border-radius:7px;background:#646e82;color:#fff;font-size:11px;font-weight:800;white-space:nowrap}.craft-badge-known{background:#17664c}.craft-badge-material{background:#d5af5c;color:#19120f}.craft-chip{display:inline-flex;border:1px solid #4b5361;background:#313748;color:#eee9ff;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700}.craft-chip-green{border-color:rgba(57,201,143,.5);background:rgba(57,201,143,.16)}.craft-section{margin-top:10px;padding:11px;border:1px dashed #3a4251;border-radius:8px;background:#252a38}.craft-section-title{margin-bottom:5px;color:#86bdff;font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.craft-mini-card{padding:12px;border:1px solid #3d344e;border-radius:9px;background:#202636}.craft-recipe-table-panel{min-width:0;display:flex;flex-direction:column;max-height:68vh}.craft-recipe-table-panel .craft-panel-head{flex:0 0 auto}.craft-table-scroll{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain}.craft-recipe-sheet{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}.craft-recipe-sheet th{position:sticky;top:0;z-index:2;background:#202636;color:#cdbdff;text-transform:uppercase;letter-spacing:.06em;font-size:10px;padding:8px 8px;border-bottom:1px solid #3d4655;white-space:nowrap}.craft-recipe-sheet td{padding:8px 8px;border-bottom:1px solid #38404d;color:#f4f1ff;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.craft-recipe-sheet tr{cursor:pointer}.craft-recipe-sheet tbody tr:hover{background:#222b3a}.craft-recipe-sheet tbody tr.active{background:#26304a;box-shadow:inset 4px 0 0 #d5af5c}.craft-recipe-sheet .col-name{width:34%;white-space:normal}.craft-sheet-name{font-weight:900;line-height:1.15;white-space:normal}.craft-sheet-source{color:#cfc6df;font-size:10px;line-height:1.15;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.craft-status-pill{display:inline-flex;align-items:center;justify-content:center;min-width:34px;padding:3px 6px;border-radius:999px;background:#646e82;color:#fff;font-size:10px;font-weight:900}.craft-status-pill.known{background:#17664c}.min-w-0{min-width:0}.craft-forage-layout{display:grid;grid-template-columns:22% minmax(0,46%) minmax(340px,32%);gap:14px;align-items:start}.forage-guidance-panel{grid-column:1 / span 2}.forage-location-list{max-height:68vh;overflow:auto}.forage-entry-panel{max-height:68vh}.forage-sheet .forage-roll{width:70px}.forage-sheet .forage-plant{width:42%;white-space:normal}.forage-sheet .forage-rarity{width:110px}.forage-sheet .forage-dc{width:80px}.forage-sheet .forage-qty{width:70px}.forage-roll-inputs{display:grid;grid-template-columns:1fr 1fr;gap:8px}.forage-roll-inputs label span{display:block;color:#cfc6df;font-size:11px;font-weight:800;margin-bottom:4px}.forage-success{color:#9df0c8}.forage-fail{color:#ffd89a}.forage-preview-card .craft-preview-grid{gap:10px}@media(max-width:1200px){.craft-grid-main,.craft-grid-two,.craft-grid-three-even,.craft-forage-layout{grid-template-columns:1fr}.craft-list{max-height:none}.forage-guidance-panel{grid-column:auto}}@media(max-width:992px){.craft-hero{flex-direction:column}.craft-controls{grid-template-columns:1fr}.craft-hero-stats,.craft-stat-grid{width:100%}}

        .craft-preview-card {
          position: sticky;
          top: 86px;
          align-self: start;
          min-height: 420px;
          padding: 18px;
          border: 1px solid #51406d;
          border-radius: 18px;
          background:
            radial-gradient(circle at 15% 0%, rgba(122, 92, 180, 0.38), transparent 34%),
            linear-gradient(180deg, #251b3a 0%, #171126 100%);
          box-shadow:
            inset 0 2px 0 rgba(213, 175, 92, 0.68),
            0 18px 45px rgba(0, 0, 0, 0.24);
          overflow: hidden;
        }
        .craft-preview-empty {
          color: #b9b1ca;
          font-style: italic;
        }
        .craft-preview-topline {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 12px;
        }
        .craft-preview-title {
          margin: 2px 0 0;
          font-size: 21px;
          font-weight: 950;
          line-height: 1.1;
          color: #fff8ff;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
        }
        .craft-preview-rarity {
          border: 1px solid rgba(220, 196, 255, 0.28);
          background: rgba(255, 255, 255, 0.12);
          color: #f6f1ff;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }
        .craft-preview-summary {
          margin: 12px 0;
          padding: 13px 14px;
          border: 1px solid rgba(213, 175, 92, 0.42);
          border-radius: 12px;
          background: rgba(42, 32, 66, 0.76);
          color: #eee8ff;
          line-height: 1.45;
        }
        .craft-preview-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin: 12px 0 14px;
        }
        .craft-preview-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .craft-section-card {
          border-style: solid;
          border-color: rgba(122, 101, 162, 0.58);
          background: rgba(32, 38, 54, 0.78);
        }
        .craft-bullet {
          color: #f4f1ff;
          font-size: 13px;
          line-height: 1.45;
          margin: 2px 0;
        }
        .craft-bullet.muted {
          color: #aaa0ba;
        }
        .craft-preview-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          padding: 9px 11px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          color: #aaa0ba;
          font-size: 12px;
        }
        .craft-preview-footer strong {
          color: #f5df9a;
        }

        .craft-recipe-table-panel {
          border-color: #3e4658;
          background: linear-gradient(180deg, #1a202a, #151b24);
          box-shadow: 0 16px 42px rgba(0, 0, 0, 0.2);
        }
        .craft-table-scroll {
          border-radius: 0 0 10px 10px;
          background: #121820;
        }
        .craft-recipe-sheet {
          border-collapse: separate;
          border-spacing: 0;
          font-size: 12px;
        }
        .craft-recipe-sheet th {
          top: 0;
          background: linear-gradient(180deg, #293244, #202636);
          color: #d8caff;
          border-bottom: 1px solid #655084;
          padding: 10px 9px;
        }
        .craft-recipe-sheet td {
          padding: 9px 9px;
          border-bottom: 1px solid rgba(71, 82, 103, 0.72);
          background: rgba(26, 32, 42, 0.68);
        }
        .craft-recipe-sheet tbody tr:nth-child(even) td {
          background: rgba(33, 39, 52, 0.72);
        }
        .craft-recipe-sheet tbody tr:hover td {
          background: #283247;
        }
        .craft-recipe-sheet tbody tr.active td {
          background: linear-gradient(90deg, rgba(213, 175, 92, 0.18), rgba(61, 49, 91, 0.72));
          box-shadow: inset 0 1px 0 rgba(213, 175, 92, 0.22), inset 0 -1px 0 rgba(213, 175, 92, 0.16);
        }
        .craft-recipe-sheet tbody tr.active td:first-child {
          box-shadow: inset 4px 0 0 #d5af5c, inset 0 1px 0 rgba(213, 175, 92, 0.22), inset 0 -1px 0 rgba(213, 175, 92, 0.16);
        }
        .craft-recipe-sheet .col-name { width: 34%; }
        .craft-recipe-sheet .col-known { width: 72px; text-align: center; }
        .craft-recipe-sheet .col-type { width: 108px; }
        .craft-recipe-sheet .col-rarity { width: 96px; }
        .craft-recipe-sheet .col-slot { width: 64px; text-align: center; }
        .craft-recipe-sheet .col-applies { width: 120px; }
        .craft-sheet-name {
          color: #fff8ff;
          font-size: 12.5px;
        }
        .craft-sheet-source {
          color: #8ca2c6;
          font-size: 10px;
        }
        .craft-type-pill,
        .craft-rarity-pill,
        .craft-slot-pill,
        .craft-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          max-width: 100%;
          min-height: 22px;
          padding: 3px 7px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
          border: 1px solid rgba(255,255,255,0.12);
        }
        .craft-type-pill {
          background: rgba(128, 191, 255, 0.13);
          color: #b8dcff;
        }
        .type-enchanting { background: rgba(139, 92, 246, 0.22); color: #dfd2ff; }
        .type-smithing { background: rgba(213, 175, 92, 0.18); color: #ffe4a6; }
        .type-alchemy { background: rgba(57, 201, 143, 0.16); color: #b4f4d9; }
        .craft-rarity-pill { background: #333b4d; color: #f4f1ff; }
        .rarity-mundane { background: #3d4554; color: #dbe4f3; }
        .rarity-common { background: #4b5566; color: #f3f4f6; }
        .rarity-uncommon { background: rgba(57, 201, 143, 0.20); color: #b5f5dc; }
        .rarity-rare { background: rgba(95, 157, 255, 0.22); color: #c8dcff; }
        .rarity-very-rare { background: rgba(139, 92, 246, 0.25); color: #e0d1ff; }
        .rarity-legendary { background: rgba(213, 175, 92, 0.25); color: #ffe4a6; }
        .craft-slot-pill {
          min-width: 34px;
          background: rgba(255, 255, 255, 0.08);
          color: #f4f1ff;
        }
        .craft-applies-text {
          display: inline-block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          vertical-align: bottom;
          color: #e4ddff;
        }
        .craft-chip-blue { border-color: rgba(128, 191, 255, 0.4); background: rgba(128, 191, 255, 0.12); }
        .craft-chip-rose { border-color: rgba(244, 114, 182, 0.55); background: rgba(244, 114, 182, 0.16); color: #ffd3e8; }
        .craft-chip-gold { border-color: rgba(213, 175, 92, 0.45); background: rgba(213, 175, 92, 0.16); color: #ffe4a6; }

        .craft-materials-grid {
          grid-template-columns: 20% minmax(0, 48%) minmax(320px, 32%);
        }
        .craft-material-table-scroll {
          max-height: 68vh;
        }
        .craft-material-sheet .mat-name { width: 34%; white-space: normal; }
        .craft-material-sheet .mat-category { width: 132px; }
        .craft-material-sheet .mat-qty { width: 64px; text-align: center; }
        .craft-material-sheet .mat-rarity { width: 96px; }
        .craft-material-sheet .mat-source { width: 118px; }
        .craft-material-kind-pill,
        .craft-material-qty-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          max-width: 100%;
          min-height: 22px;
          padding: 3px 7px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }
        .craft-material-qty-pill {
          min-width: 38px;
          background: rgba(213, 175, 92, 0.22);
          color: #ffe4a6;
        }
        .craft-material-kind-pill {
          background: rgba(128, 191, 255, 0.13);
          color: #c8e4ff;
        }
        .craft-material-kind-pill.mat-metal {
          background: rgba(213, 175, 92, 0.18);
          color: #ffe4a6;
        }
        .craft-material-kind-pill.mat-monster {
          background: rgba(255, 107, 131, 0.18);
          color: #ffc0cb;
        }
        .craft-material-kind-pill.mat-catalyst {
          background: rgba(139, 92, 246, 0.25);
          color: #e0d1ff;
        }
        .craft-material-kind-pill.mat-plant {
          background: rgba(57, 201, 143, 0.18);
          color: #b5f5dc;
        }
        .craft-material-kind-pill.mat-reagent {
          background: rgba(128, 191, 255, 0.18);
          color: #c8e4ff;
        }


        .craft-bench-grid {
          grid-template-columns: 28% 34% 38%;
          align-items: start;
        }
        .craft-bench-recipe-panel,
        .craft-bench-match-panel {
          max-height: 68vh;
          display: flex;
          flex-direction: column;
        }
        .craft-bench-recipe-list,
        .craft-bench-body {
          overflow: auto;
          min-height: 0;
        }
        .craft-bench-body {
          padding: 14px;
        }
        .craft-match-row {
          margin-bottom: 12px;
          border: 1px solid rgba(122, 101, 162, 0.52);
          border-radius: 10px;
          background: rgba(32, 38, 54, 0.78);
          overflow: hidden;
        }
        .craft-match-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 9px 11px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          color: #fff8ff;
          font-weight: 900;
        }
        .craft-match-material {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 11px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          color: #ddd5ea;
          font-size: 13px;
        }
        .craft-match-material:last-child {
          border-bottom: 0;
        }
        .craft-match-material strong {
          color: #ffe4a6;
        }
        .craft-bench-plan-card {
          position: sticky;
          top: 86px;
        }

        .craft-plan-alert {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 800;
        }
        .craft-plan-alert.success {
          border: 1px solid rgba(57, 201, 143, 0.45);
          background: rgba(57, 201, 143, 0.14);
          color: #b5f5dc;
        }
        .craft-plan-alert.danger {
          border: 1px solid rgba(255, 107, 131, 0.45);
          background: rgba(255, 107, 131, 0.14);
          color: #ffc0cb;
        }


        .craft-discovery-layout {
          display: grid;
          grid-template-columns: 20% minmax(0, 48%) minmax(320px, 32%);
          grid-template-areas:
            "groups table preview"
            "leads leads preview";
          gap: 14px;
          align-items: start;
        }
        .craft-discovery-layout > .craft-panel:first-child {
          grid-area: groups;
        }
        .craft-discovery-table-panel {
          grid-area: table;
          max-height: 58vh;
          display: flex;
          flex-direction: column;
        }
        .craft-discovery-layout > .craft-preview-card {
          grid-area: preview;
          position: sticky;
          top: 86px;
        }
        .craft-discovery-leads-panel {
          grid-area: leads;
        }
        .craft-discovery-table-scroll,
        .craft-discovery-leads-list {
          overflow: auto;
          min-height: 0;
        }
        .craft-discovery-table-scroll {
          flex: 1 1 auto;
        }
        .craft-discovery-sheet .disc-recipe { width: 38%; white-space: normal; }
        .craft-discovery-sheet .disc-status { width: 88px; text-align: center; }
        .craft-discovery-sheet .disc-discipline { width: 118px; }
        .craft-discovery-sheet .disc-rarity { width: 96px; }
        .craft-discovery-sheet .disc-source { width: 150px; }
        .craft-discovery-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 22px;
          padding: 3px 7px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
          border: 1px solid rgba(255,255,255,0.12);
          background: #646e82;
          color: #fff;
        }
        .disc-known {
          background: rgba(57, 201, 143, 0.22);
          color: #b5f5dc;
        }
        .disc-hint {
          background: rgba(139, 92, 246, 0.25);
          color: #e0d1ff;
        }
        .disc-reference {
          background: rgba(128, 191, 255, 0.16);
          color: #c8e4ff;
        }
        .craft-lead-card {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(26, 32, 42, 0.78);
        }
        .craft-lead-card:nth-child(even) {
          background: rgba(33, 39, 52, 0.78);
        }
        .craft-lead-title {
          color: #fff8ff;
          font-weight: 900;
        }
        .craft-lead-clue {
          margin-top: 6px;
          color: #ddd5ea;
          font-size: 13px;
          line-height: 1.4;
        }
        @media(max-width:1200px){
          .craft-discovery-layout {
            grid-template-columns: 1fr;
            grid-template-areas:
              "groups"
              "table"
              "preview"
              "leads";
          }
          .craft-discovery-layout > .craft-preview-card {
            position: static;
          }
        }


        .craft-mastery-layout {
          display: grid;
          grid-template-columns: 26% minmax(0, 42%) minmax(320px, 32%);
          gap: 14px;
          align-items: start;
        }
        .craft-mastery-track-panel,
        .craft-mastery-matrix-panel {
          max-height: 68vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .craft-mastery-track-list {
          overflow: auto;
          min-height: 0;
          padding: 10px;
        }
        .craft-mastery-card {
          width: 100%;
          display: block;
          padding: 12px;
          margin-bottom: 10px;
          border: 1px solid rgba(122, 101, 162, 0.52);
          border-radius: 12px;
          background: rgba(26, 32, 42, 0.82);
          color: #f4f1ff;
          text-align: left;
        }
        .craft-mastery-card:hover,
        .craft-mastery-card.active {
          background: linear-gradient(90deg, rgba(213, 175, 92, 0.18), rgba(61, 49, 91, 0.72));
          border-color: rgba(213, 175, 92, 0.58);
        }
        .craft-mastery-card-top {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .craft-mastery-icon {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: rgba(139, 92, 246, 0.18);
          border: 1px solid rgba(139, 92, 246, 0.35);
          font-size: 18px;
        }
        .craft-mastery-title {
          font-weight: 950;
          color: #fff8ff;
        }
        .craft-mastery-progress {
          height: 7px;
          margin: 10px 0 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .craft-mastery-progress > div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #8b5cf6, #d5af5c);
        }
        .craft-mastery-mini-stats,
        .craft-mastery-tile-grid {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: #d7cee7;
          font-size: 12px;
        }
        .craft-mastery-matrix {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          padding: 12px;
          overflow: auto;
        }
        .craft-mastery-tile {
          padding: 12px;
          border: 1px solid rgba(122, 101, 162, 0.52);
          border-radius: 12px;
          background: rgba(32, 38, 54, 0.78);
        }
        .craft-mastery-tile-title {
          font-weight: 950;
          color: #fff8ff;
        }
        .craft-mastery-tile-rank {
          color: #f5df9a;
          font-size: 12px;
          font-weight: 900;
          margin-top: 3px;
        }
        .craft-mastery-tile-grid {
          margin-top: 10px;
        }
        .craft-mastery-tile-grid div {
          min-width: 0;
        }
        .craft-mastery-tile-grid strong {
          display: block;
          color: #fff8ff;
          font-size: 18px;
          line-height: 1;
        }
        .craft-mastery-tile-grid span {
          color: #cfc6df;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .craft-mastery-detail-card {
          position: sticky;
          top: 86px;
        }
        @media(max-width:1200px){
          .craft-mastery-layout {
            grid-template-columns: 1fr;
          }
          .craft-mastery-detail-card {
            position: static;
          }
          .craft-mastery-matrix {
            grid-template-columns: 1fr;
          }
        }


        .craft-plans-layout {
          display: grid;
          grid-template-columns: 18% minmax(0, 45%) minmax(340px, 37%);
          gap: 12px;
          align-items: start;
        }
        .craft-plans-table-panel {
          max-height: 68vh;
          display: flex;
          flex-direction: column;
        }
        .craft-plans-table-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
        }
        .craft-plans-sheet .plan-name { width: 36%; white-space: normal; }
        .craft-plans-sheet .plan-status { width: 92px; text-align: center; }
        .craft-plans-sheet .plan-discipline { width: 118px; }
        .craft-plans-sheet .plan-rarity { width: 96px; }
        .craft-plans-sheet .plan-created { width: 118px; }
        .craft-status-pill.submitted {
          background: rgba(128, 191, 255, 0.16);
          color: #c8e4ff;
        }
        .craft-status-pill.danger {
          background: rgba(255, 107, 131, 0.18);
          color: #ffc0cb;
        }
        
        .craft-plan-review-card .craft-section-card {
          padding: 10px 12px;
          margin-top: 10px;
        }
        .craft-plan-review-card .craft-bullet {
          font-size: 12px;
          line-height: 1.35;
        }
        .craft-plan-review-card .craft-preview-summary {
          padding: 10px 12px;
          line-height: 1.35;
        }
        .craft-plan-review-card .craft-preview-chip-row {
          gap: 6px;
          margin-top: 8px;
        }
        .craft-plan-review-card .craft-admin-notes {
          min-height: 78px;
        }
        .craft-attempt-report-toolbar {
          padding: 8px 10px;
        }
        .craft-attempt-filter-row .btn {
          padding: 4px 7px;
          font-size: 11px;
        }

        .craft-recipe-workbench-card {
          max-height: calc(100vh - 180px);
          overflow: auto;
        }
        .craft-section-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .craft-small-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #d7cee7;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .craft-family-picker {
          position: relative;
          margin-bottom: 8px;
        }
        .craft-family-slot-button {
          width: 100%;
          text-align: left;
          cursor: pointer;
        }
        .craft-family-slot-button.compact {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 34px;
          padding: 6px 9px;
          margin-top: 6px;
        }
        .craft-family-slot-label {
          color: #fff8d6;
          font-size: 12px;
          font-weight: 950;
          line-height: 1.1;
        }
        .craft-family-slot-status {
          flex: 0 0 auto;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 999px;
          padding: 2px 7px;
          color: #c8ffe8;
          background: rgba(59,211,154,.14);
          font-size: 9px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .craft-selected-ingredient-button {
          display: block;
          width: 100%;
          padding: 0;
          margin-top: 8px;
          border: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }
        .craft-selected-ingredient-button .craft-alchemy-effect-card {
          margin: 0;
          transition: border-color .16s ease, filter .16s ease, transform .16s ease;
        }
        .craft-selected-ingredient-button:hover .craft-alchemy-effect-card {
          filter: brightness(1.08);
          transform: translateY(-1px);
          border-color: rgba(240,194,111,.62);
        }
        .craft-change-ingredient-hint {
          display: block;
          margin: 4px 3px 0;
          color: #cfc6df;
          font-size: 10px;
          font-weight: 800;
          text-align: right;
        }
        .craft-family-slot-button.selected {
          border-color: rgba(59, 211, 154, 0.5);
          background: linear-gradient(90deg, rgba(59, 211, 154, 0.16), rgba(61, 49, 91, 0.5));
        }
        .craft-family-ingredient-dropdown {
          margin-top: 6px;
          border: 1px solid rgba(240, 194, 111, 0.28);
          border-radius: 12px;
          background: rgba(15, 19, 29, 0.94);
          box-shadow: 0 16px 32px rgba(0,0,0,0.28);
          overflow: auto;
          max-height: min(72vh, 760px);
          padding: 8px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(235px, 1fr));
          gap: 8px;
        }
        .craft-family-ingredient-option {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          text-align: left;
          border: 0;
          border-radius: 12px;
          padding: 9px 10px;
          color: #fff8ff;
          background: rgba(30, 37, 49, 0.86);
        }
        .craft-family-ingredient-card-option {
          display: block;
          min-width: 0;
          padding: 0;
        }
        .craft-family-ingredient-card-option .craft-alchemy-effect-card {
          pointer-events: none;
          margin: 0;
          width: 100%;
        }
        .craft-family-picker > .craft-alchemy-effect-card {
          margin: 7px 0 0;
        }
        .craft-family-ingredient-option:last-child {
          border-bottom: 0;
        }
        .craft-family-ingredient-option strong {
          display: block;
          color: #fff8ff;
          font-weight: 950;
        }
        .craft-family-ingredient-option small {
          display: block;
          color: #cfc6dc;
          line-height: 1.3;
        }
        .craft-family-ingredient-option em {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 3px 7px;
          background: rgba(59, 211, 154, 0.18);
          color: #bfffe5;
          border: 1px solid rgba(59, 211, 154, 0.28);
          font-style: normal;
          font-weight: 900;
          font-size: 10px;
          white-space: nowrap;
        }
        .craft-family-ingredient-body {
          display: block;
          flex: 1 1 auto;
          min-width: 0;
        }
        .craft-family-ingredient-title-row,
        .craft-material-effect-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .craft-family-ingredient-title-row strong {
          min-width: 0;
        }
        .craft-ingredient-quality-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          min-height: 20px;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .04em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .craft-effect-card-badges {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 5px;
          flex-wrap: wrap;
        }
        .craft-ingredient-family-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 20px;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid rgba(134, 189, 255, 0.24);
          background: rgba(56, 83, 126, 0.22);
          color: #bfe0ff;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .04em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .craft-ingredient-family-pill-under-name {
          width: fit-content;
          margin-top: 5px;
        }
        .craft-ingredient-theme-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 5px;
        }
        .craft-ingredient-theme-pill {
          display: inline-flex;
          align-items: center;
          min-height: 20px;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid rgba(240, 194, 111, 0.42);
          background: rgba(107, 72, 24, 0.28);
          color: #ffe3a6;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .craft-ingredient-qty-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 20px;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid rgba(59, 211, 154, 0.28);
          background: rgba(59, 211, 154, 0.16);
          color: #bfffe5;
          font-size: 9px;
          font-weight: 950;
          white-space: nowrap;
        }
        .craft-ingredient-short-impact {
          color: #f5df9a !important;
          font-weight: 800;
        }
        .craft-ingredient-specifics {
          margin-top: 4px;
          color: #dfe8ff !important;
        }
        .craft-ingredient-impact-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 6px;
        }
        .craft-ingredient-impact-chips i {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.07);
          color: #f4edff;
          font-style: normal;
          font-size: 10.5px;
          font-weight: 950;
          letter-spacing: .02em;
        }
        .craft-selected-impact-row {
          margin-top: 8px;
          padding: 8px 9px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(8, 12, 18, 0.26);
        }
        .craft-selected-impact-row > span {
          display: block;
          color: #e9e2f5;
          font-size: 11px;
          line-height: 1.35;
        }
        .craft-selected-impact-row > span:first-child {
          color: #f5df9a;
          font-weight: 900;
          margin-bottom: 3px;
        }
        .craft-family-ingredient-option.rarity-common { border-left: 4px solid #8d98ab; }
        .craft-family-ingredient-option.rarity-uncommon { border-left: 4px solid #39c98f; background: linear-gradient(90deg, rgba(57, 201, 143, 0.13), rgba(30, 37, 49, 0.90)); }
        .craft-family-ingredient-option.rarity-rare { border-left: 4px solid #5f9dff; background: linear-gradient(90deg, rgba(95, 157, 255, 0.15), rgba(30, 37, 49, 0.90)); }
        .craft-family-ingredient-option.rarity-very-rare { border-left: 4px solid #a78bfa; background: linear-gradient(90deg, rgba(139, 92, 246, 0.17), rgba(30, 37, 49, 0.90)); }
        .craft-family-ingredient-card-option.rarity-common,
        .craft-family-ingredient-card-option.rarity-uncommon,
        .craft-family-ingredient-card-option.rarity-rare,
        .craft-family-ingredient-card-option.rarity-very-rare,
        .craft-family-ingredient-card-option.rarity-legendary {
          border-left-width: 0;
        }
        .craft-family-ingredient-card-option.unavailable {
          opacity: 0.45;
        }
        .craft-family-ingredient-card-option.active .craft-alchemy-effect-card {
          border-color: rgba(240, 194, 111, 0.78);
          box-shadow: inset 0 0 0 1px rgba(240, 194, 111, 0.38);
        }

        .craft-family-ingredient-option.rarity-legendary { border-left: 4px solid #f0c26f; background: linear-gradient(90deg, rgba(213, 175, 92, 0.20), rgba(30, 37, 49, 0.92)); }
        .craft-family-slot-button.rarity-uncommon { border-color: rgba(57, 201, 143, 0.46); }
        .craft-family-slot-button.rarity-rare { border-color: rgba(95, 157, 255, 0.48); }
        .craft-family-slot-button.rarity-very-rare { border-color: rgba(167, 139, 250, 0.52); }
        .craft-family-slot-button.rarity-legendary { border-color: rgba(240, 194, 111, 0.58); }
        .craft-family-ingredient-option.unavailable {
          opacity: 0.48;
          filter: grayscale(.55);
        }
        .craft-family-ingredient-option.unavailable em {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.12);
          color: #c0b8c8;
        }
        .craft-family-ingredient-option.available:hover,
        .craft-family-ingredient-option.active {
          background: linear-gradient(90deg, rgba(213, 175, 92, 0.24), rgba(61, 49, 91, 0.72));
        }
        .craft-inline-plan-box .craft-primary-action {
          width: 100%;
        }

.craft-plan-review-card {
          position: sticky;
          top: 86px;
        }
        .craft-plan-material-group {
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .craft-plan-material-group:last-child {
          border-bottom: 0;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .craft-plan-material-group strong {
          display: block;
          color: #f5df9a;
          margin-bottom: 4px;
        }


        .craft-bench-selection-grid {
          grid-template-columns: 26% minmax(0, 36%) minmax(340px, 38%);
        }
        .craft-material-select {
          margin: 10px;
          width: calc(100% - 20px);
        }
        .craft-bench-body .craft-section.mt-0 {
          margin-top: 0;
        }





        .craft-attempt-reports-panel {
          grid-column: 1 / span 2;
          max-height: 42vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .craft-attempt-report-toolbar {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: grid;
          gap: 8px;
        }
        .craft-attempt-filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .craft-attempt-filter-row .btn span {
          margin-left: 4px;
          opacity: 0.78;
        }
        .craft-attempt-workspace {
          display: grid;
          grid-template-columns: minmax(0, 54%) minmax(280px, 46%);
          min-height: 0;
          overflow: hidden;
        }
        .craft-attempt-detail-card {
          border-left: 1px solid rgba(255,255,255,0.08);
          padding: 14px;
          overflow: auto;
          background: rgba(30, 23, 47, 0.74);
        }
        .craft-attempt-detail-card h3 {
          margin: 0;
          color: #fff8ff;
          font-weight: 950;
        }
        .craft-attempt-detail-card > p {
          color: #d7cee7;
          margin: 8px 0 0;
        }
        .craft-attempt-score-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin: 12px 0;
        }
        .craft-attempt-score-row div {
          border: 1px solid rgba(213, 175, 92, 0.38);
          border-radius: 12px;
          background: rgba(213, 175, 92, 0.12);
          padding: 9px 10px;
          text-align: center;
        }
        .craft-attempt-score-row strong {
          display: block;
          color: #ffe4a6;
          font-size: 20px;
          line-height: 1;
        }
        .craft-attempt-score-row span {
          display: block;
          margin-top: 4px;
          color: #d7cee7;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .08em;
          font-weight: 900;
        }
        .craft-attempt-report-text {
          color: #ddd5ea;
          line-height: 1.45;
          margin: 0;
        }
        .craft-attempt-report-card {
          width: 100%;
          display: block;
          text-align: left;
          border: 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(26, 32, 42, 0.78);
          color: inherit;
        }
        .craft-attempt-report-card:hover,
        .craft-attempt-report-card.active {
          background: linear-gradient(90deg, rgba(213, 175, 92, 0.18), rgba(61, 49, 91, 0.72));
        }
        @media(max-width:1200px){
          .craft-attempt-workspace {
            grid-template-columns: 1fr;
          }
          .craft-attempt-detail-card {
            border-left: 0;
            border-top: 1px solid rgba(255,255,255,0.08);
          }
        }

        .craft-attempt-report-list {
          overflow: auto;
          min-height: 0;
        }
        .craft-attempt-report-card {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(26, 32, 42, 0.78);
        }
        .craft-attempt-report-card:nth-child(even) {
          background: rgba(33, 39, 52, 0.78);
        }
        .craft-attempt-report-head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        .craft-attempt-report-head strong {
          display: block;
          color: #fff8ff;
          font-weight: 950;
        }
        .craft-attempt-report-head span:not(.craft-status-pill) {
          display: block;
          color: #cfc6df;
          font-size: 12px;
        }
        .craft-attempt-report-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }
        .craft-attempt-report-grid span {
          display: inline-flex;
          gap: 5px;
          align-items: center;
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.16);
          border: 1px solid rgba(139, 92, 246, 0.32);
          color: #d7cee7;
          font-size: 12px;
          font-weight: 800;
        }
        .craft-attempt-report-grid strong {
          color: #ffe4a6;
        }
        .craft-attempt-report-card p {
          margin: 0;
          color: #ddd5ea;
          font-size: 13px;
          line-height: 1.4;
        }
        @media(max-width:1200px){
          .craft-attempt-reports-panel {
            grid-column: auto;
          }
        }


        .craft-live-completion-card {
          border-color: rgba(57, 201, 143, 0.42);
          background: linear-gradient(180deg, rgba(31, 58, 48, 0.76), rgba(25, 30, 43, 0.9));
        }
        .craft-completion-checks {
          margin-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .craft-attempt-card {
          border-color: rgba(128, 191, 255, 0.35);
          background: linear-gradient(180deg, rgba(31, 41, 58, 0.92), rgba(25, 30, 43, 0.88));
        }
        .craft-attempt-controls {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          margin-top: 10px;
          align-items: center;
        }
        .craft-attempt-result {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.14);
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }
        .craft-attempt-result strong {
          color: #fff8ff;
        }
        .craft-attempt-result span {
          color: #d7cee7;
          font-size: 12px;
          font-weight: 800;
        }
        .craft-attempt-result.attempt-critical_success,
        .craft-attempt-result.attempt-success {
          background: rgba(57, 201, 143, 0.16);
          border-color: rgba(57, 201, 143, 0.42);
        }
        .craft-attempt-result.attempt-partial_success {
          background: rgba(213, 175, 92, 0.16);
          border-color: rgba(213, 175, 92, 0.42);
        }
        .craft-attempt-result.attempt-failure,
        .craft-attempt-result.attempt-mishap {
          background: rgba(255, 107, 131, 0.16);
          border-color: rgba(255, 107, 131, 0.42);
        }

        .craft-automation-preview {
          border-color: rgba(213, 175, 92, 0.48);
          background: linear-gradient(180deg, rgba(44, 37, 65, 0.92), rgba(32, 38, 54, 0.88));
        }
        .craft-dc-total {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 82px;
          margin-bottom: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(213, 175, 92, 0.22);
          border: 1px solid rgba(213, 175, 92, 0.55);
          color: #ffe4a6;
          font-size: 20px;
          font-weight: 950;
        }
        .craft-dc-line {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 5px 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          color: #ddd5ea;
          font-size: 13px;
        }
        .craft-dc-line:last-child {
          border-bottom: 0;
        }
        .craft-dc-line strong {
          color: #ffe4a6;
        }
        .craft-material-effect-row {
          padding: 9px 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          color: #ddd5ea;
          font-size: 13px;
        }
        .craft-material-effect-row:last-child {
          border-bottom: 0;
        }
        .craft-material-effect-row strong {
          display: block;
          color: #fff8ff;
          margin-bottom: 2px;
        }
        .craft-material-effect-row span {
          display: block;
          margin-top: 3px;
          color: #f5df9a;
          font-size: 12px;
        }
        .craft-specific-material-effect-row {
          margin-top: 8px;
          padding: 10px 11px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(16, 22, 34, 0.70);
        }
        .craft-specific-material-effect-row.rarity-uncommon { border-color: rgba(57, 201, 143, 0.36); background: linear-gradient(180deg, rgba(57, 201, 143, 0.10), rgba(16, 22, 34, 0.76)); }
        .craft-specific-material-effect-row.rarity-rare { border-color: rgba(95, 157, 255, 0.36); background: linear-gradient(180deg, rgba(95, 157, 255, 0.12), rgba(16, 22, 34, 0.76)); }
        .craft-specific-material-effect-row.rarity-very-rare { border-color: rgba(167, 139, 250, 0.40); background: linear-gradient(180deg, rgba(139, 92, 246, 0.14), rgba(16, 22, 34, 0.78)); }
        .craft-specific-material-effect-row.rarity-legendary { border-color: rgba(240, 194, 111, 0.46); background: linear-gradient(180deg, rgba(213, 175, 92, 0.16), rgba(16, 22, 34, 0.80)); }
        .craft-material-effect-head small {
          display: block;
          color: #9bc7ff;
          font-size: 10px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: .05em;
          margin-top: 2px;
        }
        .craft-material-short-summary {
          color: #f5df9a;
          font-size: 12px;
          font-weight: 900;
          margin-top: 7px;
        }
        .craft-material-specific-summary {
          color: #edf4ff;
          font-size: 13px;
          line-height: 1.42;
          margin-top: 5px;
        }
        .craft-material-impact-chips {
          margin-top: 8px;
        }
        .craft-material-contribution-lines {
          margin-top: 8px;
          color: #d8cfff;
          font-size: 12px;
          line-height: 1.42;
        }
        .craft-alchemy-effect-card.compact {
          padding: 9px 10px;
          border-radius: 13px;
          min-height: 0;
        }
        .craft-alchemy-effect-card.compact .craft-material-specific-summary {
          font-size: 12px;
        }
        .craft-alchemy-effect-card.compact .craft-material-short-summary {
          margin-top: 5px;
        }
        .craft-alchemy-item-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .craft-alchemy-item-title-block strong {
          display: block;
          color: #fff8ff;
          font-size: 14px;
          font-weight: 950;
          line-height: 1.18;
          margin: 0;
        }
        .craft-alchemy-item-title-block small {
          display: block;
          color: #9bc7ff;
          font-size: 10px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: .05em;
          margin-top: 3px;
        }
        .craft-alchemy-card-description {
          margin-top: 8px;
          color: #edf4ff;
          font-size: 13px;
          line-height: 1.42;
        }
        .craft-alchemy-effect-card.compact .craft-alchemy-card-description {
          font-size: 11.5px;
          line-height: 1.32;
        }
        .craft-alchemy-card-divider {
          height: 1px;
          margin: 9px 0 7px;
          background: linear-gradient(90deg, rgba(240, 194, 111, 0.34), rgba(255,255,255,0.06));
        }
        .craft-alchemy-impact-label {
          color: #f5df9a;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .craft-alchemy-plain-lines {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 7px;
        }

        .craft-final-product-preview {
          border-color: rgba(59, 211, 154, 0.4);
          background: linear-gradient(180deg, rgba(22, 47, 45, 0.82), rgba(32, 38, 54, 0.88));
        }
        .craft-final-effect-callout {
          margin-top: 8px;
          padding: 11px 12px;
          border-radius: 12px;
          border: 1px solid rgba(59, 211, 154, 0.34);
          background: rgba(12, 24, 27, 0.72);
        }
        .craft-final-effect-callout strong {
          display: block;
          color: #bfffe5;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 5px;
        }
        .craft-final-effect-callout p {
          margin: 0;
          color: #fff8ff;
          font-size: 14px;
          line-height: 1.45;
        }
        .craft-formula-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 10px;
        }
        .craft-formula-detail-grid > div {
          padding: 9px 10px;
          border-radius: 10px;
          border: 1px solid rgba(164, 198, 255, 0.18);
          background: rgba(20, 26, 39, 0.8);
        }
        .craft-formula-detail-grid span {
          display: block;
          color: #9bc7ff;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .07em;
          margin-bottom: 4px;
        }
        .craft-formula-detail-grid strong {
          display: block;
          color: #fff8ff;
          font-size: 13px;
          line-height: 1.35;
        }

        .craft-formula-detail-note { display:block; margin-top:4px; color:#b7c7dd; font-size:9px; line-height:1.3; }
        .craft-bomb-save-controls { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,.08); }
        .craft-bomb-save-controls label span { display:block; margin-bottom:4px; color:#9bc7ff; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.06em; }
        .craft-bomb-save-formula { grid-column:1/-1; }
        .craft-final-modifier-list {
          margin-top: 9px;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .craft-risk-box {
          margin-top: 9px;
          padding: 9px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255, 107, 131, 0.34);
          background: rgba(80, 32, 45, 0.28);
        }
        .craft-risk-box strong {
          display: block;
          color: #ffb8c5;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .07em;
          margin-bottom: 4px;
        }

        .craft-readiness-row {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          color: #ddd5ea;
        }
        .craft-readiness-row:last-child {
          border-bottom: 0;
        }
        .craft-readiness-row > span {
          width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 999px;
          font-weight: 950;
          font-size: 12px;
        }
        .craft-readiness-row.ok > span {
          background: rgba(57, 201, 143, 0.22);
          color: #b5f5dc;
          border: 1px solid rgba(57, 201, 143, 0.45);
        }
        .craft-readiness-row.warn > span {
          background: rgba(255, 184, 107, 0.18);
          color: #ffe4a6;
          border: 1px solid rgba(255, 184, 107, 0.45);
        }
        .craft-readiness-row strong {
          color: #fff8ff;
        }
        .craft-readiness-row div div {
          color: #cfc6df;
          font-size: 12px;
          margin-top: 2px;
        }

        .craft-admin-notes {
          min-height: 96px;
          resize: vertical;
          color: #f4f1ff;
        }

        .craft-plan-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 12px;
        }
        .plan-approved,
        .plan-completed {
          border-color: rgba(57, 201, 143, 0.45);
          background: rgba(57, 201, 143, 0.16);
        }
        .plan-rejected,
        .plan-cancelled {
          border-color: rgba(255, 107, 131, 0.45);
          background: rgba(255, 107, 131, 0.16);
        }
        @media(max-width:1200px){
          .craft-plans-layout {
            grid-template-columns: 1fr;
          }
          .craft-plan-review-card {
            position: static;
          }
        }

        .craft-bench-player-guide {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }
        .craft-guide-step {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid rgba(139, 111, 192, 0.34);
          border-radius: 13px;
          background: linear-gradient(180deg, rgba(32, 38, 54, 0.95), rgba(24, 29, 42, 0.92));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .craft-guide-step > span {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          color: #0f1020;
          background: #d5af5c;
          font-weight: 950;
        }
        .craft-guide-step strong {
          display: block;
          color: #fff8ff;
          font-weight: 950;
          line-height: 1.1;
        }
        .craft-guide-step small {
          display: block;
          color: #d8d0e7;
          margin-top: 3px;
          line-height: 1.2;
        }
        .craft-guide-step.ready {
          border-color: rgba(57, 201, 143, 0.42);
          background: linear-gradient(180deg, rgba(28, 55, 47, 0.88), rgba(24, 34, 40, 0.9));
        }
        .craft-guide-step.ready > span {
          background: #39c98f;
        }
        .craft-guide-step.danger {
          border-color: rgba(255, 184, 107, 0.72);
          background: linear-gradient(180deg, rgba(79, 49, 31, 0.82), rgba(34, 28, 35, 0.94));
        }
        .craft-match-row-danger {
          border-color: rgba(255, 184, 107, 0.48) !important;
          background: linear-gradient(180deg, rgba(79, 49, 31, 0.45), rgba(31, 34, 45, 0.88)) !important;
        }
        .craft-status-pill.danger {
          background: #9a522c;
          color: #fff6e6;
        }
        .craft-chip-danger {
          border-color: rgba(255, 184, 107, 0.68);
          background: rgba(255, 184, 107, 0.16);
          color: #ffe4a6;
        }
        .craft-destructive-warning-inline,
        .craft-destructive-warning-card {
          border-color: rgba(255, 184, 107, 0.62) !important;
          background: rgba(255, 184, 107, 0.11) !important;
          color: #ffe4a6;
        }
        .craft-destructive-warning-inline {
          margin-top: 8px;
          padding: 8px 10px;
          border: 1px solid;
          border-radius: 8px;
          font-size: 12px;
          line-height: 1.35;
        }
        .craft-destructive-warning-inline strong {
          color: #fff6e6;
        }
        .craft-bullet-danger {
          color: #ffe4a6 !important;
        }
        .craft-primary-action {
          min-height: 40px;
          font-weight: 900;
          letter-spacing: .01em;
        }
        @media(max-width:992px){
          .craft-bench-player-guide {
            grid-template-columns: 1fr;
          }
        }


        .craft-alchemy-specifics {
          border-color: rgba(57, 201, 143, 0.34);
          background: linear-gradient(180deg, rgba(38, 70, 60, 0.42), rgba(30, 24, 48, 0.78));
        }
        .craft-alchemy-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .craft-alchemy-detail-grid > div {
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 12px;
          background: rgba(12, 18, 30, 0.42);
          padding: 9px 10px;
        }
        .craft-alchemy-detail-grid > div.wide {
          grid-column: 1 / -1;
        }
        .craft-alchemy-detail-grid span {
          display: block;
          color: #9cc9ff;
          text-transform: uppercase;
          letter-spacing: .08em;
          font-size: 10px;
          font-weight: 900;
          margin-bottom: 4px;
        }
        .craft-alchemy-detail-grid strong {
          color: #fff8d6;
          font-size: 12px;
          line-height: 1.35;
        }


        .forage-alchemy-links {
          border-color: rgba(57, 201, 143, 0.36);
          background: linear-gradient(180deg, rgba(28, 55, 47, 0.48), rgba(32, 38, 54, 0.78));
        }
        .forage-alchemy-links .text-muted {
          font-size: 11px;
        }

      .craft-page .text-muted,
      .craft-page .small.text-muted {
        color: #cfc6df !important;
      }

      .craft-page .form-label {
        color: #f0e9ff;
      }

      .craft-preview-summary,
      .craft-bullet,
      .craft-section-card,
      .craft-applies-text,
      .craft-sheet-source,
      .craft-row-meta {
        color: #ddd5ea;
      }

      .craft-bullet.muted {
        color: #c7bfd4;
      }

      .craft-recipe-sheet tbody td {
        color: #f2eefc;
      }

      .craft-recipe-sheet tbody tr:hover td {
        color: #ffffff;
      }

      .craft-preview-footer span {
        color: #cfc6df;
      }

      .craft-alchemy-path-row {
        border: 1px solid rgba(240, 194, 111, 0.28);
        border-radius: 12px;
        padding: 9px 10px;
        margin-top: 8px;
        background: rgba(45, 28, 16, 0.45);
      }

      .craft-alchemy-path-row .craft-row-main {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: baseline;
      }

      .craft-alchemy-path-row .craft-row-main span {
        color: #e8d9bd;
        font-size: 12px;
        text-align: right;
      }


      .craft-preview-stack {
        min-width: 0;
      }

      .craft-preview-summary-card {
        position: sticky;
        top: 86px;
        z-index: 3;
      }

      .craft-alchemy-section-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin: 0 0 16px;
        padding: 12px 14px;
        border: 1px solid rgba(134, 189, 255, 0.28);
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(28, 34, 49, 0.96), rgba(36, 27, 51, 0.94));
      }

      .craft-alchemy-section-note {
        margin-top: 3px;
        color: #bdb5cc;
        font-size: 12px;
      }

      .craft-alchemy-section-buttons {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 7px;
      }

      .craft-alchemy-section-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 7px 10px;
        border: 1px solid #485166;
        border-radius: 999px;
        background: #1d2330;
        color: #eee9ff;
        font-size: 12px;
        font-weight: 900;
      }

      .craft-alchemy-section-button strong {
        min-width: 20px;
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
        font-size: 10px;
        text-align: center;
      }

      .craft-alchemy-section-button:hover,
      .craft-alchemy-section-button.active {
        border-color: #d5af5c;
        background: linear-gradient(135deg, rgba(102, 72, 29, 0.84), rgba(56, 44, 71, 0.94));
        color: #fff4cf;
      }

      .craft-alchemy-section-button.section-potions.active { box-shadow: inset 0 0 0 1px rgba(59, 211, 154, 0.38); }
      .craft-alchemy-section-button.section-poisons.active { box-shadow: inset 0 0 0 1px rgba(222, 91, 150, 0.45); }
      .craft-alchemy-section-button.section-bombs.active { box-shadow: inset 0 0 0 1px rgba(241, 142, 66, 0.48); }
      .craft-alchemy-section-button.section-elixirs.active { box-shadow: inset 0 0 0 1px rgba(134, 189, 255, 0.48); }
      .craft-alchemy-section-button.section-oils.active { box-shadow: inset 0 0 0 1px rgba(209, 175, 92, 0.48); }
      .craft-alchemy-group-buttons { display:flex; flex-wrap:wrap; gap:7px; width:100%; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,.08); }
      .craft-alchemy-group-button { display:inline-flex; align-items:center; gap:7px; border:1px solid rgba(134,189,255,.28); border-radius:999px; background:rgba(27,36,54,.86); color:#dcecff; padding:6px 10px; font-size:11px; font-weight:850; }
      .craft-alchemy-group-button strong { display:inline-flex; min-width:20px; justify-content:center; border-radius:999px; background:rgba(255,255,255,.1); padding:1px 5px; font-size:10px; }
      .craft-alchemy-group-button:hover, .craft-alchemy-group-button.active { border-color:rgba(240,194,111,.72); background:rgba(87,57,119,.78); color:#fff1c5; }

      .craft-recipe-craft-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(390px, 430px);
        gap: 16px;
        align-items: start;
      }

      .craft-crafting-left-column {
        min-width: 0;
      }

      .craft-crafting-preview-column {
        min-width: 0;
        position: sticky;
        top: 86px;
        align-self: start;
        max-height: calc(100vh - 104px);
      }

      .craft-crafting-preview-column .craft-preview-summary-card {
        position: relative;
        top: auto;
        max-height: calc(100vh - 104px);
        overflow: auto;
      }

      .craft-craft-mode-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        padding: 14px 16px;
        border-color: rgba(134, 189, 255, 0.32);
        background: linear-gradient(135deg, rgba(32, 38, 54, 0.96), rgba(38, 31, 58, 0.92));
      }

      .craft-craft-mode-head h2 {
        margin: 4px 0 5px;
        font-size: 22px;
        font-weight: 950;
      }

      .craft-craft-mode-head p {
        margin: 0;
        color: #d8d1e6;
        max-width: 680px;
      }

      .craft-row-craft-button {
        border: 1px solid rgba(134, 189, 255, 0.45);
        background: rgba(27, 35, 49, 0.9);
        color: #eaf3ff;
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 10px;
        font-weight: 900;
        line-height: 1;
        text-transform: uppercase;
      }

      .craft-row-craft-button:hover,
      .craft-row-craft-button.active {
        border-color: rgba(240, 194, 111, 0.8);
        color: #fff3cc;
        background: rgba(83, 63, 29, 0.8);
      }

      .craft-recipe-sheet .col-craft {
        width: 74px;
        text-align: center;
      }

      .craft-family-slot-button.compact {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        min-height: 40px;
        padding: 8px 10px;
      }

      .craft-family-slot-button.compact .craft-family-slot-label {
        font-size: 13px;
        font-weight: 950;
        color: #fff2c7;
      }

      .craft-family-slot-button.compact .craft-family-slot-status {
        color: #c7bfd4;
        font-size: 11px;
        font-weight: 850;
      }

      .craft-family-ingredient-card-option.compact,
      .craft-family-ingredient-card-option {
        text-align: left;
      }

      .craft-family-ingredient-card-option .craft-alchemy-effect-card.compact .craft-alchemy-impact-label,
      .craft-family-ingredient-card-option .craft-alchemy-effect-card.compact .craft-alchemy-card-divider {
        margin-top: 7px;
      }

      .craft-family-ingredient-card-option .craft-alchemy-effect-card.compact .craft-alchemy-card-description {
        font-size: 12px;
        line-height: 1.38;
      }

      @media(max-width:1200px){
        .craft-alchemy-section-bar{align-items:flex-start;flex-direction:column}.craft-alchemy-section-buttons{justify-content:flex-start}
        .craft-recipe-craft-layout{grid-template-columns:1fr}.craft-crafting-preview-column .craft-preview-summary-card,.craft-preview-summary-card{position:relative;top:auto;max-height:none}.craft-crafting-preview-column{order:-1;position:relative;top:auto;max-height:none}
      }

        /* Crafting workflow themes and compact-card overflow protection */
        .craft-recipe-craft-layout { --workflow-accent:#39c98f; --workflow-soft:rgba(57,201,143,.16); --workflow-border:rgba(57,201,143,.42); }
        .craft-theme-smithing { --workflow-accent:#e0a44f; --workflow-soft:rgba(224,164,79,.16); --workflow-border:rgba(224,164,79,.48); }
        .craft-theme-enchanting { --workflow-accent:#a78bfa; --workflow-soft:rgba(139,92,246,.18); --workflow-border:rgba(167,139,250,.5); }
        .craft-theme-alchemy { --workflow-accent:#39c98f; --workflow-soft:rgba(57,201,143,.16); --workflow-border:rgba(57,201,143,.42); }
        .craft-craft-mode-head,.craft-base-item-section,.craft-physical-materials-section { border-color:var(--workflow-border)!important; background:linear-gradient(135deg,var(--workflow-soft),rgba(30,24,48,.9))!important; }
        .craft-workflow-stepbar { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:14px; }
        .craft-workflow-step { display:flex; align-items:center; gap:10px; min-width:0; padding:11px 12px; border:1px solid rgba(255,255,255,.12); border-radius:13px; background:rgba(27,33,47,.9); }
        .craft-workflow-step>span { display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto; width:30px; height:30px; border-radius:999px; background:rgba(255,255,255,.1); color:#eee9ff; font-weight:950; }
        .craft-workflow-step>div { min-width:0; }.craft-workflow-step strong,.craft-workflow-step small { display:block; }.craft-workflow-step strong { color:#fff8ff; line-height:1.1; }.craft-workflow-step small { margin-top:3px; color:#cfc6df; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .craft-workflow-step.ready { border-color:var(--workflow-border); background:var(--workflow-soft); }.craft-workflow-step.ready>span { background:var(--workflow-accent); color:#15101f; }
        .craft-base-pattern-card { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 11px; border:1px solid var(--workflow-border); border-radius:11px; background:rgba(13,18,29,.62); }.craft-base-pattern-card div { min-width:0; }.craft-base-pattern-card div span { display:block; color:#b9afca; font-size:10px; text-transform:uppercase; letter-spacing:.06em; }.craft-base-pattern-card div strong { display:block; color:#fff8ff; overflow-wrap:anywhere; }
        .craft-physical-risk-note { margin-top:8px; padding-top:7px; border-top:1px solid rgba(255,255,255,.07); color:#d8d0e7; font-size:11px; line-height:1.35; }.craft-physical-risk-note strong { display:inline; color:#ffe4a6; }
        .craft-family-ingredient-dropdown { grid-template-columns:repeat(auto-fit,minmax(290px,1fr)); }
        .craft-family-ingredient-card-option,.craft-family-ingredient-card-option .craft-alchemy-effect-card,.craft-alchemy-item-head,.craft-alchemy-item-title-block,.craft-effect-card-badges { min-width:0; max-width:100%; }.craft-family-ingredient-card-option { overflow:hidden; }.craft-alchemy-item-head { flex-wrap:wrap; }.craft-alchemy-item-title-block { flex:1 1 165px; }.craft-alchemy-item-title-block strong { overflow-wrap:anywhere; word-break:break-word; }.craft-effect-card-badges { flex:0 1 auto; }
        .craft-ingredient-family-pill,.craft-ingredient-theme-pill { max-width:100%; white-space:normal; text-align:center; overflow-wrap:anywhere; }
        .craft-alchemy-effect-card.compact .craft-alchemy-card-description { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:4; overflow:hidden; }.craft-alchemy-effect-card.compact .craft-material-specific-summary { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; }
        @media(max-width:760px){.craft-workflow-stepbar{grid-template-columns:1fr}.craft-family-ingredient-dropdown{grid-template-columns:1fr}}


        /* Enchanting categories, fantasy materials, elemental tempering, and rich forge previews */
        .craft-enchanting-section-bar{border-color:rgba(167,139,250,.52);background:linear-gradient(135deg,rgba(103,58,183,.18),rgba(26,21,42,.95))}
        .craft-enchanting-section-button.active{border-color:#a78bfa;background:rgba(139,92,246,.25);box-shadow:0 0 0 1px rgba(167,139,250,.18) inset}
        .craft-enchanting-section-button strong{background:rgba(167,139,250,.18);color:#e7dcff}
        .craft-material-dual-effects{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
        .craft-material-dual-effects>div{min-width:0;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(8,12,22,.38)}
        .craft-material-dual-effects strong,.craft-material-dual-effects span{display:block}
        .craft-material-dual-effects strong{color:#ffd98a;font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
        .craft-material-dual-effects span{color:#e7dfed;font-size:11px;line-height:1.4;overflow-wrap:anywhere}
        .craft-forge-item-preview{border-color:var(--workflow-border);background:linear-gradient(145deg,var(--workflow-soft),rgba(20,17,31,.92))}
        .craft-forge-flavor{color:#fff8ff;padding:10px;border:1px solid rgba(255,214,115,.3);border-radius:9px;background:rgba(22,25,36,.72);line-height:1.45}
        .craft-forge-rules{margin-top:9px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(35,40,53,.64);color:#ece7f5;white-space:pre-line;line-height:1.45}
        .craft-forge-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
        .craft-forge-stat-grid>div{min-width:0;padding:8px 9px;border:1px dashed rgba(255,255,255,.11);border-radius:8px;background:rgba(15,19,29,.55)}
        .craft-forge-stat-grid span,.craft-forge-stat-grid strong{display:block}
        .craft-forge-stat-grid span{color:#aca2bf;font-size:9px;text-transform:uppercase;letter-spacing:.07em}
        .craft-forge-stat-grid strong{color:#fff;margin-top:3px;overflow-wrap:anywhere}
        .craft-temper-preview{border-color:rgba(255,159,67,.45);background:linear-gradient(145deg,rgba(255,121,38,.12),rgba(25,20,34,.92))}
        .craft-temper-preview-row{display:grid;gap:3px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.08)}
        .craft-temper-preview-row:last-of-type{border-bottom:0}
        .craft-temper-preview-row strong{color:#ffd08a}
        .craft-temper-preview-row span{color:#e7dfed;font-size:11px;line-height:1.4}
        @media(max-width:760px){.craft-material-dual-effects,.craft-forge-stat-grid{grid-template-columns:1fr}}

    `}</style></div>;
}


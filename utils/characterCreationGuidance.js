import { ABILITY_KEYS, SKILL_DEFINITIONS } from "./characterCreation";

export const ABILITY_DESCRIPTIONS = Object.freeze({
  str: "Physical power. Strength affects Athletics, lifting and carrying, grappling, and most heavy melee weapons.",
  dex: "Agility, reflexes, and precision. Dexterity affects Armor Class in lighter armor, initiative, Stealth, Acrobatics, and finesse or ranged attacks.",
  con: "Health and endurance. Constitution increases Hit Points and helps resist poison, exhaustion, and effects that strain the body.",
  int: "Reasoning, memory, and learned knowledge. Intelligence governs Arcana, History, Investigation, Nature, Religion, and Wizard spellcasting.",
  wis: "Awareness, intuition, and practical judgment. Wisdom governs Perception, Insight, Medicine, Survival, and several divine or primal spellcasters.",
  cha: "Force of personality and social presence. Charisma governs persuasion, deception, intimidation, performance, and several innate or pact spellcasters.",
});

export const FALLBACK_SKILL_DESCRIPTIONS = Object.freeze({
  acrobatics: "Stay balanced in a difficult situation or perform an acrobatic stunt.",
  animalHandling: "Calm, train, understand, or control an animal.",
  arcana: "Recall lore about spells, magic, magical traditions, and other planes.",
  athletics: "Climb, jump, swim, grapple, shove, or apply physical force.",
  deception: "Mislead someone through lies, disguise, or carefully hidden truth.",
  history: "Recall events, people, nations, wars, and cultures from the past.",
  insight: "Read a creature's mood, motives, honesty, or likely intentions.",
  intimidation: "Influence someone through threats, pressure, or an imposing presence.",
  investigation: "Search for clues and use deduction to determine how something works.",
  medicine: "Diagnose an illness, identify a cause of death, or stabilize the dying.",
  nature: "Recall lore about terrain, plants, animals, weather, and natural cycles.",
  perception: "Notice something easy to miss through sight, hearing, smell, or other senses.",
  performance: "Entertain through acting, music, dance, storytelling, or another art.",
  persuasion: "Influence someone honestly through reason, tact, empathy, or social grace.",
  religion: "Recall lore about deities, faiths, rites, holy symbols, and religious institutions.",
  sleightOfHand: "Pick a pocket, conceal an object, or perform precise manual trickery.",
  stealth: "Avoid notice by moving quietly, hiding, and using cover or concealment.",
  survival: "Track, navigate, forage, predict hazards, and endure the wilderness.",
});

export const BACKGROUND_SUMMARIES = Object.freeze({
  acolyte: "You served a temple or religious order and learned sacred lore, disciplined study, and care for a community.",
  artisan: "You trained in a skilled trade and learned how to make, evaluate, and sell useful goods.",
  charlatan: "You survived through confidence, false identities, quick hands, and reading what people want to believe.",
  criminal: "You learned to operate outside the law through stealth, deception, careful planning, and underworld contacts.",
  entertainer: "You made a living before audiences through music, acting, dance, spectacle, or athletic performance.",
  farmer: "You developed patience, toughness, practical knowledge, and respect for land, animals, and seasonal work.",
  guard: "You protected a person, place, or community and learned vigilance, discipline, and how to recognize danger.",
  guide: "You led others through dangerous country and learned navigation, survival, observation, and quiet movement.",
  hermit: "You lived apart from society in contemplation, study, healing, or pursuit of a private revelation.",
  merchant: "You traveled or traded for a living and learned negotiation, appraisal, logistics, and how markets behave.",
  noble: "You were raised among privilege, obligations, politics, etiquette, and the expectations of a recognized house.",
  sage: "You devoted yourself to research, records, languages, and the recovery or preservation of knowledge.",
  sailor: "You worked aboard ships or along waterways and learned teamwork, balance, navigation, and life in dangerous weather.",
  scribe: "You copied, translated, organized, or preserved written records and learned careful observation and exact language.",
  soldier: "You served in an organized fighting force and learned endurance, discipline, weapons, and command structures.",
  wayfarer: "You grew accustomed to roads, crowds, uncertainty, and surviving without a secure home or established station.",
  custom: "Define a campaign background when none of the standard histories describe this character.",
});

export const SPECIES_SUMMARIES = Object.freeze({
  aasimar: "Mortals touched by celestial power, often marked by supernatural resilience, healing, and a radiant revelation.",
  dragonborn: "Draconic humanoids whose ancestry grants an elemental breath weapon and resistance to a matching damage type.",
  dwarf: "Stout and resilient folk known for endurance, darkvision, stonecraft, and deep cultural traditions.",
  elf: "Long-lived fey-touched people with keen senses, trance, darkvision, and a lineage such as Drow, High Elf, or Wood Elf.",
  gnome: "Small, clever folk protected by Gnomish Cunning and a magical or inventive lineage.",
  goliath: "Powerfully built descendants of giant-kind whose ancestry grants a distinctive supernatural gift.",
  halfling: "Small, nimble, courageous folk whose luck and natural stealth help them survive danger.",
  human: "Adaptable and resourceful people whose versatility grants an extra skill and an additional Origin feat in the 2024 rules.",
  orc: "Powerful and relentless people with darkvision, bursts of speed, and the endurance to remain standing after severe injury.",
  tiefling: "People with fiendish legacies that grant darkvision, supernatural presence, resistance, and inherited magic.",
  custom: "Use a campaign species or ancestry not yet represented by the imported catalog.",
});

const SKILL_KEY_BY_NORMALIZED_NAME = Object.freeze(Object.fromEntries(SKILL_DEFINITIONS.map((skill) => [
  String(skill.label).toLowerCase().replace(/[^a-z0-9]+/g, ""),
  skill.key,
])));

export function normalizeSkillKey(value) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return SKILL_KEY_BY_NORMALIZED_NAME[normalized] || null;
}

export function classSkillConfiguration(classRow = null) {
  const allSkills = SKILL_DEFINITIONS.map((skill) => skill.key);
  const rawSkills = classRow?.raw_payload?.starting_proficiencies?.skills;
  if (!Array.isArray(rawSkills) || !rawSkills.length) return { count: 2, options: allSkills };

  let count = 0;
  const options = new Set();
  for (const entry of rawSkills) {
    if (Number(entry?.any || 0) > 0) {
      count += Number(entry.any);
      allSkills.forEach((skill) => options.add(skill));
      continue;
    }
    const choose = entry?.choose || entry;
    const from = Array.isArray(choose?.from) ? choose.from : [];
    const entryCount = Number(choose?.count || 0);
    if (entryCount > 0) count += entryCount;
    from.map(normalizeSkillKey).filter(Boolean).forEach((skill) => options.add(skill));
  }
  return {
    count: Math.max(0, count || 2),
    options: options.size ? [...options] : allSkills,
  };
}

export function rollFourDropLowest(random = Math.random) {
  const dice = Array.from({ length: 4 }, () => Math.floor(random() * 6) + 1);
  const droppedIndex = dice.indexOf(Math.min(...dice));
  const total = dice.reduce((sum, die, index) => sum + (index === droppedIndex ? 0 : die), 0);
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, dice, droppedIndex, total };
}

export function rollAbilityPool(random = Math.random) {
  return Array.from({ length: 6 }, () => rollFourDropLowest(random));
}

export function defaultRollAllocation() {
  return {};
}

export function abilityScoresFromRollAllocation(pool = [], allocation = {}) {
  const byId = new Map(pool.map((roll) => [roll.id, roll.total]));
  return Object.fromEntries(ABILITY_KEYS.map((ability) => [ability, Number(byId.get(allocation[ability]) || 10)]));
}

export function flexibleAbilityBoosts(baseScores = {}, boosts = {}) {
  const scores = Object.fromEntries(ABILITY_KEYS.map((ability) => [ability, Math.max(1, Math.min(20, Number(baseScores?.[ability] || 10)))]));
  if (boosts.mode === "three") {
    [...new Set(Array.isArray(boosts.plusOnes) ? boosts.plusOnes : [])]
      .filter((ability) => ABILITY_KEYS.includes(ability))
      .slice(0, 3)
      .forEach((ability) => { scores[ability] = Math.min(20, scores[ability] + 1); });
  } else {
    const plusTwo = ABILITY_KEYS.includes(boosts.plusTwo) ? boosts.plusTwo : null;
    const plusOne = ABILITY_KEYS.includes(boosts.plusOne) && boosts.plusOne !== plusTwo ? boosts.plusOne : null;
    if (plusTwo) scores[plusTwo] = Math.min(20, scores[plusTwo] + 2);
    if (plusOne) scores[plusOne] = Math.min(20, scores[plusOne] + 1);
  }
  return scores;
}

export function startingSpellRequirements(classRow = null, levelRow = null) {
  const cantrips = Math.max(0, Number(levelRow?.cantrips_known || 0));
  if (!classRow?.spellcasting_ability) return { cantrips: 0, leveled: 0, prepared: 0 };
  if (classRow.class_key === "wizard") {
    return { cantrips, leveled: 6, prepared: Math.max(0, Number(levelRow?.spells_known || 4)) };
  }
  const leveled = Math.max(0, Number(levelRow?.spells_known || 0));
  return { cantrips, leveled, prepared: leveled };
}

export function sourceDisplayName(source, ruleset) {
  if (source === "XPHB") return "2024 Player's Handbook";
  if (source === "PHB") return "2014 Player's Handbook";
  if (source === "EFA") return "Eberron: Forge of the Artificer";
  if (source === "TCE") return "Tasha's Cauldron of Everything";
  return ruleset ? `${source || "Campaign"} • ${ruleset}` : source || "Campaign";
}

import { PROFESSION_DEFINITIONS, PROFESSION_KEYS, normalizeProfessionEntry } from "./craftingProfessions";

export const ABILITY_KEYS = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);

export const ABILITY_LABELS = Object.freeze({
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
});

export const SKILL_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "acrobatics", label: "Acrobatics", ability: "dex" }),
  Object.freeze({ key: "animalHandling", label: "Animal Handling", ability: "wis" }),
  Object.freeze({ key: "arcana", label: "Arcana", ability: "int" }),
  Object.freeze({ key: "athletics", label: "Athletics", ability: "str" }),
  Object.freeze({ key: "deception", label: "Deception", ability: "cha" }),
  Object.freeze({ key: "history", label: "History", ability: "int" }),
  Object.freeze({ key: "insight", label: "Insight", ability: "wis" }),
  Object.freeze({ key: "intimidation", label: "Intimidation", ability: "cha" }),
  Object.freeze({ key: "investigation", label: "Investigation", ability: "int" }),
  Object.freeze({ key: "medicine", label: "Medicine", ability: "wis" }),
  Object.freeze({ key: "nature", label: "Nature", ability: "int" }),
  Object.freeze({ key: "perception", label: "Perception", ability: "wis" }),
  Object.freeze({ key: "performance", label: "Performance", ability: "cha" }),
  Object.freeze({ key: "persuasion", label: "Persuasion", ability: "cha" }),
  Object.freeze({ key: "religion", label: "Religion", ability: "int" }),
  Object.freeze({ key: "sleightOfHand", label: "Sleight of Hand", ability: "dex" }),
  Object.freeze({ key: "stealth", label: "Stealth", ability: "dex" }),
  Object.freeze({ key: "survival", label: "Survival", ability: "wis" }),
]);

const ALL_SKILLS = Object.freeze(SKILL_DEFINITIONS.map((skill) => skill.key));

export const CLASS_DEFINITIONS = Object.freeze({
  civilian: Object.freeze({
    key: "civilian",
    label: "No Adventuring Class",
    hitDie: 8,
    primaryAbilities: Object.freeze([]),
    savingThrows: Object.freeze([]),
    skillCount: 2,
    skillOptions: ALL_SKILLS,
    spellcastingAbility: null,
    summary: "A classless townsperson, professional, official, or other non-adventuring NPC.",
  }),
  barbarian: Object.freeze({
    key: "barbarian", label: "Barbarian", hitDie: 12,
    primaryAbilities: Object.freeze(["str"]), savingThrows: Object.freeze(["str", "con"]),
    skillCount: 2, skillOptions: Object.freeze(["animalHandling", "athletics", "intimidation", "nature", "perception", "survival"]),
    spellcastingAbility: null, summary: "A durable warrior driven by battle fury and raw physical power.",
  }),
  bard: Object.freeze({
    key: "bard", label: "Bard", hitDie: 8,
    primaryAbilities: Object.freeze(["cha"]), savingThrows: Object.freeze(["dex", "cha"]),
    skillCount: 3, skillOptions: ALL_SKILLS, spellcastingAbility: "cha",
    summary: "A versatile performer and spellcaster whose talents support allies and shape social encounters.",
  }),
  cleric: Object.freeze({
    key: "cleric", label: "Cleric", hitDie: 8,
    primaryAbilities: Object.freeze(["wis"]), savingThrows: Object.freeze(["wis", "cha"]),
    skillCount: 2, skillOptions: Object.freeze(["history", "insight", "medicine", "persuasion", "religion"]),
    spellcastingAbility: "wis", summary: "A divine spellcaster empowered by faith, doctrine, or sacred service.",
  }),
  druid: Object.freeze({
    key: "druid", label: "Druid", hitDie: 8,
    primaryAbilities: Object.freeze(["wis"]), savingThrows: Object.freeze(["int", "wis"]),
    skillCount: 2, skillOptions: Object.freeze(["arcana", "animalHandling", "insight", "medicine", "nature", "perception", "religion", "survival"]),
    spellcastingAbility: "wis", summary: "A primal spellcaster tied to nature, transformation, and the elemental world.",
  }),
  fighter: Object.freeze({
    key: "fighter", label: "Fighter", hitDie: 10,
    primaryAbilities: Object.freeze(["str", "dex"]), savingThrows: Object.freeze(["str", "con"]),
    skillCount: 2, skillOptions: Object.freeze(["acrobatics", "animalHandling", "athletics", "history", "insight", "intimidation", "perception", "survival"]),
    spellcastingAbility: null, summary: "A trained combatant defined by weapon mastery and battlefield discipline.",
  }),
  monk: Object.freeze({
    key: "monk", label: "Monk", hitDie: 8,
    primaryAbilities: Object.freeze(["dex", "wis"]), savingThrows: Object.freeze(["str", "dex"]),
    skillCount: 2, skillOptions: Object.freeze(["acrobatics", "athletics", "history", "insight", "religion", "stealth"]),
    spellcastingAbility: null, summary: "A disciplined martial artist who channels focus through body and spirit.",
  }),
  paladin: Object.freeze({
    key: "paladin", label: "Paladin", hitDie: 10,
    primaryAbilities: Object.freeze(["str", "cha"]), savingThrows: Object.freeze(["wis", "cha"]),
    skillCount: 2, skillOptions: Object.freeze(["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"]),
    spellcastingAbility: "cha", summary: "An armored champion whose oath fuels martial and divine power.",
  }),
  ranger: Object.freeze({
    key: "ranger", label: "Ranger", hitDie: 10,
    primaryAbilities: Object.freeze(["dex", "wis"]), savingThrows: Object.freeze(["str", "dex"]),
    skillCount: 3, skillOptions: Object.freeze(["animalHandling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"]),
    spellcastingAbility: "wis", summary: "A mobile hunter and explorer skilled in wilderness, tracking, and primal magic.",
  }),
  rogue: Object.freeze({
    key: "rogue", label: "Rogue", hitDie: 8,
    primaryAbilities: Object.freeze(["dex"]), savingThrows: Object.freeze(["dex", "int"]),
    skillCount: 4, skillOptions: Object.freeze(["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "persuasion", "sleightOfHand", "stealth"]),
    spellcastingAbility: null, summary: "A precise specialist who relies on expertise, agility, and opportunistic attacks.",
  }),
  sorcerer: Object.freeze({
    key: "sorcerer", label: "Sorcerer", hitDie: 6,
    primaryAbilities: Object.freeze(["cha"]), savingThrows: Object.freeze(["con", "cha"]),
    skillCount: 2, skillOptions: Object.freeze(["arcana", "deception", "insight", "intimidation", "persuasion", "religion"]),
    spellcastingAbility: "cha", summary: "An innate spellcaster whose magic flows from bloodline, transformation, or supernatural origin.",
  }),
  warlock: Object.freeze({
    key: "warlock", label: "Warlock", hitDie: 8,
    primaryAbilities: Object.freeze(["cha"]), savingThrows: Object.freeze(["wis", "cha"]),
    skillCount: 2, skillOptions: Object.freeze(["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"]),
    spellcastingAbility: "cha", summary: "An occult spellcaster empowered by a pact, patron, or forbidden source.",
  }),
  wizard: Object.freeze({
    key: "wizard", label: "Wizard", hitDie: 6,
    primaryAbilities: Object.freeze(["int"]), savingThrows: Object.freeze(["int", "wis"]),
    skillCount: 2, skillOptions: Object.freeze(["arcana", "history", "insight", "investigation", "medicine", "nature", "religion"]),
    spellcastingAbility: "int", summary: "A learned spellcaster who studies, records, and prepares arcane magic.",
  }),
});

export const CLASS_KEYS = Object.freeze(Object.keys(CLASS_DEFINITIONS));

export const STANDARD_ARRAYS_BY_CLASS = Object.freeze({
  civilian: Object.freeze({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
  barbarian: Object.freeze({ str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 }),
  bard: Object.freeze({ str: 8, dex: 14, con: 12, int: 13, wis: 10, cha: 15 }),
  cleric: Object.freeze({ str: 14, dex: 8, con: 13, int: 10, wis: 15, cha: 12 }),
  druid: Object.freeze({ str: 8, dex: 12, con: 14, int: 13, wis: 15, cha: 10 }),
  fighter: Object.freeze({ str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 }),
  monk: Object.freeze({ str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 }),
  paladin: Object.freeze({ str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 }),
  ranger: Object.freeze({ str: 12, dex: 15, con: 13, int: 8, wis: 14, cha: 10 }),
  rogue: Object.freeze({ str: 12, dex: 15, con: 13, int: 14, wis: 10, cha: 8 }),
  sorcerer: Object.freeze({ str: 10, dex: 13, con: 14, int: 8, wis: 12, cha: 15 }),
  warlock: Object.freeze({ str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 }),
  wizard: Object.freeze({ str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 }),
});

export const SPECIES_DEFINITIONS = Object.freeze({
  aasimar: Object.freeze({ key: "aasimar", label: "Aasimar", speed: 30, lineages: Object.freeze([]), traits: Object.freeze(["Celestial Resistance", "Darkvision", "Healing Hands", "Light Bearer", "Celestial Revelation at level 3"]) }),
  dragonborn: Object.freeze({ key: "dragonborn", label: "Dragonborn", speed: 30, lineages: Object.freeze(["Black", "Blue", "Brass", "Bronze", "Copper", "Gold", "Green", "Red", "Silver", "White"]), traits: Object.freeze(["Draconic Ancestry", "Breath Weapon", "Damage Resistance", "Darkvision", "Draconic Flight at level 5"]) }),
  dwarf: Object.freeze({ key: "dwarf", label: "Dwarf", speed: 30, lineages: Object.freeze([]), traits: Object.freeze(["Darkvision", "Dwarven Resilience", "Dwarven Toughness", "Stonecunning"]) }),
  elf: Object.freeze({ key: "elf", label: "Elf", speed: 30, lineages: Object.freeze(["Drow", "High Elf", "Wood Elf"]), traits: Object.freeze(["Darkvision", "Elven Lineage", "Fey Ancestry", "Keen Senses", "Trance"]) }),
  gnome: Object.freeze({ key: "gnome", label: "Gnome", speed: 30, lineages: Object.freeze(["Forest Gnome", "Rock Gnome"]), traits: Object.freeze(["Darkvision", "Gnomish Cunning", "Gnomish Lineage"]) }),
  goliath: Object.freeze({ key: "goliath", label: "Goliath", speed: 35, lineages: Object.freeze(["Cloud Giant", "Fire Giant", "Frost Giant", "Hill Giant", "Stone Giant", "Storm Giant"]), traits: Object.freeze(["Giant Ancestry", "Large Form at level 5", "Powerful Build"]) }),
  halfling: Object.freeze({ key: "halfling", label: "Halfling", speed: 30, lineages: Object.freeze([]), traits: Object.freeze(["Brave", "Halfling Nimbleness", "Luck", "Naturally Stealthy"]) }),
  human: Object.freeze({ key: "human", label: "Human", speed: 30, lineages: Object.freeze([]), traits: Object.freeze(["Resourceful", "Skillful", "Versatile"]) }),
  orc: Object.freeze({ key: "orc", label: "Orc", speed: 30, lineages: Object.freeze([]), traits: Object.freeze(["Adrenaline Rush", "Darkvision", "Relentless Endurance"]) }),
  tiefling: Object.freeze({ key: "tiefling", label: "Tiefling", speed: 30, lineages: Object.freeze(["Abyssal", "Chthonic", "Infernal"]), traits: Object.freeze(["Darkvision", "Fiendish Legacy", "Otherworldly Presence"]) }),
  custom: Object.freeze({ key: "custom", label: "Custom / Campaign Species", speed: 30, lineages: Object.freeze([]), traits: Object.freeze([]) }),
});

export const SPECIES_KEYS = Object.freeze(Object.keys(SPECIES_DEFINITIONS));

export const BACKGROUND_DEFINITIONS = Object.freeze({
  acolyte: Object.freeze({ key: "acolyte", label: "Acolyte", abilities: Object.freeze(["int", "wis", "cha"]), feat: "Magic Initiate (Cleric)", skills: Object.freeze(["insight", "religion"]), tool: "Calligrapher's Supplies" }),
  artisan: Object.freeze({ key: "artisan", label: "Artisan", abilities: Object.freeze(["str", "dex", "int"]), feat: "Crafter", skills: Object.freeze(["investigation", "persuasion"]), tool: "Artisan's Tools" }),
  charlatan: Object.freeze({ key: "charlatan", label: "Charlatan", abilities: Object.freeze(["dex", "con", "cha"]), feat: "Skilled", skills: Object.freeze(["deception", "sleightOfHand"]), tool: "Forgery Kit" }),
  criminal: Object.freeze({ key: "criminal", label: "Criminal", abilities: Object.freeze(["dex", "con", "int"]), feat: "Alert", skills: Object.freeze(["sleightOfHand", "stealth"]), tool: "Thieves' Tools" }),
  entertainer: Object.freeze({ key: "entertainer", label: "Entertainer", abilities: Object.freeze(["str", "dex", "cha"]), feat: "Musician", skills: Object.freeze(["acrobatics", "performance"]), tool: "Musical Instrument" }),
  farmer: Object.freeze({ key: "farmer", label: "Farmer", abilities: Object.freeze(["str", "con", "wis"]), feat: "Tough", skills: Object.freeze(["animalHandling", "nature"]), tool: "Carpenter's Tools" }),
  guard: Object.freeze({ key: "guard", label: "Guard", abilities: Object.freeze(["str", "int", "wis"]), feat: "Alert", skills: Object.freeze(["athletics", "perception"]), tool: "Gaming Set" }),
  guide: Object.freeze({ key: "guide", label: "Guide", abilities: Object.freeze(["dex", "con", "wis"]), feat: "Magic Initiate (Druid)", skills: Object.freeze(["stealth", "survival"]), tool: "Cartographer's Tools" }),
  hermit: Object.freeze({ key: "hermit", label: "Hermit", abilities: Object.freeze(["con", "wis", "cha"]), feat: "Healer", skills: Object.freeze(["medicine", "religion"]), tool: "Herbalism Kit" }),
  merchant: Object.freeze({ key: "merchant", label: "Merchant", abilities: Object.freeze(["con", "int", "cha"]), feat: "Lucky", skills: Object.freeze(["animalHandling", "persuasion"]), tool: "Navigator's Tools" }),
  noble: Object.freeze({ key: "noble", label: "Noble", abilities: Object.freeze(["str", "int", "cha"]), feat: "Skilled", skills: Object.freeze(["history", "persuasion"]), tool: "Gaming Set" }),
  sage: Object.freeze({ key: "sage", label: "Sage", abilities: Object.freeze(["con", "int", "wis"]), feat: "Magic Initiate (Wizard)", skills: Object.freeze(["arcana", "history"]), tool: "Calligrapher's Supplies" }),
  sailor: Object.freeze({ key: "sailor", label: "Sailor", abilities: Object.freeze(["str", "dex", "wis"]), feat: "Tavern Brawler", skills: Object.freeze(["acrobatics", "perception"]), tool: "Navigator's Tools" }),
  scribe: Object.freeze({ key: "scribe", label: "Scribe", abilities: Object.freeze(["dex", "int", "wis"]), feat: "Skilled", skills: Object.freeze(["investigation", "perception"]), tool: "Calligrapher's Supplies" }),
  soldier: Object.freeze({ key: "soldier", label: "Soldier", abilities: Object.freeze(["str", "dex", "con"]), feat: "Savage Attacker", skills: Object.freeze(["athletics", "intimidation"]), tool: "Gaming Set" }),
  wayfarer: Object.freeze({ key: "wayfarer", label: "Wayfarer", abilities: Object.freeze(["dex", "wis", "cha"]), feat: "Lucky", skills: Object.freeze(["insight", "stealth"]), tool: "Thieves' Tools" }),
  custom: Object.freeze({ key: "custom", label: "Custom / No Standard Background", abilities: Object.freeze(ABILITY_KEYS), feat: "", skills: Object.freeze([]), tool: "" }),
});

export const BACKGROUND_KEYS = Object.freeze(Object.keys(BACKGROUND_DEFINITIONS));

export const FEAT_OPTIONS = Object.freeze([
  { name: "Alert", category: "Origin", minimumLevel: 1 },
  { name: "Crafter", category: "Origin", minimumLevel: 1 },
  { name: "Healer", category: "Origin", minimumLevel: 1 },
  { name: "Lucky", category: "Origin", minimumLevel: 1 },
  { name: "Magic Initiate", category: "Origin", minimumLevel: 1, repeatable: true },
  { name: "Musician", category: "Origin", minimumLevel: 1 },
  { name: "Savage Attacker", category: "Origin", minimumLevel: 1 },
  { name: "Skilled", category: "Origin", minimumLevel: 1, repeatable: true },
  { name: "Tavern Brawler", category: "Origin", minimumLevel: 1 },
  { name: "Tough", category: "Origin", minimumLevel: 1 },
  { name: "Ability Score Improvement", category: "General", minimumLevel: 4, repeatable: true },
  { name: "Actor", category: "General", minimumLevel: 4 },
  { name: "Athlete", category: "General", minimumLevel: 4 },
  { name: "Charger", category: "General", minimumLevel: 4 },
  { name: "Chef", category: "General", minimumLevel: 4 },
  { name: "Crossbow Expert", category: "General", minimumLevel: 4 },
  { name: "Crusher", category: "General", minimumLevel: 4 },
  { name: "Defensive Duelist", category: "General", minimumLevel: 4 },
  { name: "Dual Wielder", category: "General", minimumLevel: 4 },
  { name: "Durable", category: "General", minimumLevel: 4 },
  { name: "Elemental Adept", category: "General", minimumLevel: 4, repeatable: true },
  { name: "Fey-Touched", category: "General", minimumLevel: 4 },
  { name: "Grappler", category: "General", minimumLevel: 4 },
  { name: "Great Weapon Master", category: "General", minimumLevel: 4 },
  { name: "Heavily Armored", category: "General", minimumLevel: 4 },
  { name: "Heavy Armor Master", category: "General", minimumLevel: 4 },
  { name: "Inspiring Leader", category: "General", minimumLevel: 4 },
  { name: "Keen Mind", category: "General", minimumLevel: 4 },
  { name: "Lightly Armored", category: "General", minimumLevel: 4 },
  { name: "Mage Slayer", category: "General", minimumLevel: 4 },
  { name: "Martial Weapon Training", category: "General", minimumLevel: 4 },
  { name: "Medium Armor Master", category: "General", minimumLevel: 4 },
  { name: "Moderately Armored", category: "General", minimumLevel: 4 },
  { name: "Mounted Combatant", category: "General", minimumLevel: 4 },
  { name: "Observant", category: "General", minimumLevel: 4 },
  { name: "Piercer", category: "General", minimumLevel: 4 },
  { name: "Poisoner", category: "General", minimumLevel: 4 },
  { name: "Polearm Master", category: "General", minimumLevel: 4 },
  { name: "Resilient", category: "General", minimumLevel: 4 },
  { name: "Ritual Caster", category: "General", minimumLevel: 4 },
  { name: "Sentinel", category: "General", minimumLevel: 4 },
  { name: "Shadow-Touched", category: "General", minimumLevel: 4 },
  { name: "Sharpshooter", category: "General", minimumLevel: 4 },
  { name: "Shield Master", category: "General", minimumLevel: 4 },
  { name: "Skill Expert", category: "General", minimumLevel: 4 },
  { name: "Skulker", category: "General", minimumLevel: 4 },
  { name: "Slasher", category: "General", minimumLevel: 4 },
  { name: "Speedy", category: "General", minimumLevel: 4 },
  { name: "Spell Sniper", category: "General", minimumLevel: 4 },
  { name: "Telekinetic", category: "General", minimumLevel: 4 },
  { name: "Telepathic", category: "General", minimumLevel: 4 },
  { name: "War Caster", category: "General", minimumLevel: 4 },
  { name: "Weapon Master", category: "General", minimumLevel: 4 },
]);

export const PROFESSION_SERVICE_TAGS = Object.freeze({
  alchemy: "alchemist",
  smithing: "blacksmith",
  scribe: "scribe",
  enchanting: "enchanter",
});

function finiteInt(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

export function clampCharacterLevel(value) {
  return Math.max(1, Math.min(20, finiteInt(value, 1)));
}

export function clampAbilityScore(value) {
  return Math.max(1, Math.min(30, finiteInt(value, 10)));
}

export function proficiencyBonusForLevel(level) {
  return 2 + Math.floor((clampCharacterLevel(level) - 1) / 4);
}

export function abilityModifierForScore(score) {
  return Math.floor((clampAbilityScore(score) - 10) / 2);
}

export function roll4d6DropLowest(random = Math.random) {
  const rolls = Array.from({ length: 4 }, () => Math.floor(random() * 6) + 1).sort((a, b) => a - b);
  return rolls[1] + rolls[2] + rolls[3];
}

export function rollAbilitySet(random = Math.random) {
  return Object.fromEntries(ABILITY_KEYS.map((key) => [key, roll4d6DropLowest(random)]));
}

export function standardAbilityScores(classKey = "civilian") {
  const source = STANDARD_ARRAYS_BY_CLASS[classKey] || STANDARD_ARRAYS_BY_CLASS.civilian;
  return { ...source };
}

export function normalizeAbilityScores(value = {}) {
  return Object.fromEntries(ABILITY_KEYS.map((key) => [key, clampAbilityScore(value?.[key]?.score ?? value?.[key] ?? 10)]));
}

export function applyBackgroundAbilityBoosts(baseScores = {}, backgroundKey = "custom", boosts = {}) {
  const background = BACKGROUND_DEFINITIONS[backgroundKey] || BACKGROUND_DEFINITIONS.custom;
  const allowed = new Set(background.abilities);
  const normalized = normalizeAbilityScores(baseScores);
  const result = { ...normalized };
  const mode = boosts.mode === "three" ? "three" : "twoOne";

  if (mode === "three") {
    const selected = Array.from(new Set(Array.isArray(boosts.plusOnes) ? boosts.plusOnes : []))
      .filter((ability) => allowed.has(ability))
      .slice(0, 3);
    selected.forEach((ability) => {
      result[ability] = Math.min(20, result[ability] + 1);
    });
  } else {
    const plusTwo = allowed.has(boosts.plusTwo) ? boosts.plusTwo : null;
    const plusOne = allowed.has(boosts.plusOne) && boosts.plusOne !== plusTwo ? boosts.plusOne : null;
    if (plusTwo) result[plusTwo] = Math.min(20, result[plusTwo] + 2);
    if (plusOne) result[plusOne] = Math.min(20, result[plusOne] + 1);
  }

  return result;
}

export function defaultBackgroundBoosts(backgroundKey = "custom", classKey = "civilian") {
  const background = BACKGROUND_DEFINITIONS[backgroundKey] || BACKGROUND_DEFINITIONS.custom;
  const classDefinition = CLASS_DEFINITIONS[classKey] || CLASS_DEFINITIONS.civilian;
  const preferred = [
    ...classDefinition.primaryAbilities,
    "con",
    "dex",
    "wis",
    "int",
    "cha",
    "str",
  ].filter((ability, index, values) => values.indexOf(ability) === index && background.abilities.includes(ability));
  return {
    mode: "twoOne",
    plusTwo: preferred[0] || background.abilities[0] || "str",
    plusOne: preferred[1] || background.abilities.find((ability) => ability !== preferred[0]) || "dex",
    plusOnes: background.abilities.slice(0, 3),
  };
}

export function maximumHitPoints({ classKey = "civilian", level = 1, constitutionScore = 10 } = {}) {
  const classDefinition = CLASS_DEFINITIONS[classKey] || CLASS_DEFINITIONS.civilian;
  const resolvedLevel = clampCharacterLevel(level);
  const constitutionModifier = abilityModifierForScore(constitutionScore);
  const firstLevel = Math.max(1, classDefinition.hitDie + constitutionModifier);
  const laterLevelAverage = Math.floor(classDefinition.hitDie / 2) + 1;
  const laterLevelGain = Math.max(1, laterLevelAverage + constitutionModifier);
  return firstLevel + Math.max(0, resolvedLevel - 1) * laterLevelGain;
}

export function normalizeSelectedSkills(classKey = "civilian", selectedSkills = [], backgroundKey = "custom") {
  const classDefinition = CLASS_DEFINITIONS[classKey] || CLASS_DEFINITIONS.civilian;
  const background = BACKGROUND_DEFINITIONS[backgroundKey] || BACKGROUND_DEFINITIONS.custom;
  const allowed = new Set(classDefinition.skillOptions);
  const classSkills = Array.from(new Set(Array.isArray(selectedSkills) ? selectedSkills : []))
    .filter((skill) => allowed.has(skill))
    .slice(0, classDefinition.skillCount);
  return Array.from(new Set([...background.skills, ...classSkills]));
}

export function professionConfiguration(value = {}) {
  return Object.fromEntries(PROFESSION_KEYS.map((key) => {
    const raw = value?.[key] || {};
    const normalized = normalizeProfessionEntry(raw, key);
    return [key, {
      rank: normalized?.rank || 0,
      ability: normalized?.ability || PROFESSION_DEFINITIONS[key].abilities[0],
      offersService: Boolean(raw?.offersService ?? raw?.offers_service),
    }];
  }));
}

export function workshopTagsFromProfessions(value = {}) {
  const professions = professionConfiguration(value);
  return PROFESSION_KEYS
    .filter((key) => professions[key].rank > 0 && professions[key].offersService)
    .map((key) => PROFESSION_SERVICE_TAGS[key]);
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanTextArray(value) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map(cleanText).filter(Boolean)));
}

function speciesLabel(speciesKey, customSpecies) {
  if (speciesKey === "custom") return cleanText(customSpecies) || "Custom Species";
  return SPECIES_DEFINITIONS[speciesKey]?.label || "Unknown Species";
}

function classLabel(classKey) {
  return CLASS_DEFINITIONS[classKey]?.label || CLASS_DEFINITIONS.civilian.label;
}

function backgroundLabel(backgroundKey, customBackground) {
  if (backgroundKey === "custom") return cleanText(customBackground) || "Custom Background";
  return BACKGROUND_DEFINITIONS[backgroundKey]?.label || BACKGROUND_DEFINITIONS.custom.label;
}

export function buildCharacterSheetFromDraft(draft = {}) {
  const classKey = CLASS_DEFINITIONS[draft.classKey] ? draft.classKey : "civilian";
  const backgroundKey = BACKGROUND_DEFINITIONS[draft.backgroundKey] ? draft.backgroundKey : "custom";
  const speciesKey = SPECIES_DEFINITIONS[draft.speciesKey] ? draft.speciesKey : "custom";
  const classDefinition = CLASS_DEFINITIONS[classKey];
  const background = BACKGROUND_DEFINITIONS[backgroundKey];
  const species = SPECIES_DEFINITIONS[speciesKey];
  const level = clampCharacterLevel(draft.level);
  const baseScores = normalizeAbilityScores(draft.baseAbilities || STANDARD_ARRAYS_BY_CLASS[classKey]);
  const finalScores = applyBackgroundAbilityBoosts(baseScores, backgroundKey, draft.backgroundBoosts || defaultBackgroundBoosts(backgroundKey, classKey));
  const skills = normalizeSelectedSkills(classKey, draft.selectedClassSkills, backgroundKey);
  const professionData = professionConfiguration(draft.professions);
  const allFeats = cleanTextArray([background.feat, ...(draft.additionalFeats || [])]);
  const resolvedSpecies = speciesLabel(speciesKey, draft.customSpecies);
  const resolvedBackground = backgroundLabel(backgroundKey, draft.customBackground);
  const lineage = cleanText(draft.lineage);
  const hitPoints = maximumHitPoints({ classKey, level, constitutionScore: finalScores.con });
  const proficiencyBonus = proficiencyBonusForLevel(level);
  const speciesTraits = [...species.traits];
  const extraTraits = cleanTextArray(draft.extraTraits);
  const traitLines = [
    ...allFeats.map((feat) => `Feat: ${feat}`),
    ...speciesTraits.map((trait) => `Species: ${trait}`),
    ...extraTraits,
  ];
  const proficiencies = {
    saves: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { proficient: classDefinition.savingThrows.includes(key) }])),
    skills: Object.fromEntries(SKILL_DEFINITIONS.map((skill) => [skill.key, {
      proficient: skills.includes(skill.key),
      expertise: Array.isArray(draft.expertiseSkills) && draft.expertiseSkills.includes(skill.key),
    }])),
  };
  const spellcasting = classDefinition.spellcastingAbility ? {
    ability: classDefinition.spellcastingAbility,
    abilityLabel: ABILITY_LABELS[classDefinition.spellcastingAbility],
    spellSaveDc: 8 + proficiencyBonus + abilityModifierForScore(finalScores[classDefinition.spellcastingAbility]),
    spellAttackBonus: proficiencyBonus + abilityModifierForScore(finalScores[classDefinition.spellcastingAbility]),
    preparedSpellsText: cleanText(draft.preparedSpellsText),
    catalogStatus: "manual_until_spell_catalog_import",
  } : null;

  return {
    schemaVersion: 1,
    meta: {
      classKey,
      className: classLabel(classKey),
      level,
      speciesKey,
      species: resolvedSpecies,
      lineage: lineage || null,
      backgroundKey,
      background: resolvedBackground,
      originFeat: background.feat || null,
      toolProficiency: background.tool || null,
      creator: "npc_forge_v1",
    },
    classKey,
    className: classLabel(classKey),
    class: classLabel(classKey),
    level,
    species: resolvedSpecies,
    race: resolvedSpecies,
    lineage: lineage || null,
    background: resolvedBackground,
    proficiencyBonus,
    abilities: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { score: finalScores[key] }])),
    proficiencies,
    professions: Object.fromEntries(PROFESSION_KEYS.map((key) => [key, {
      rank: professionData[key].rank,
      ability: professionData[key].ability,
    }])),
    speed: finiteInt(draft.speed, species.speed),
    hp: finiteInt(draft.currentHp, hitPoints),
    maxHp: finiteInt(draft.maxHp, hitPoints),
    tempHp: 0,
    hitDice: `${level}d${classDefinition.hitDie}`,
    feats: allFeats,
    speciesTraits,
    featsTraits: traitLines.join("\n"),
    tools: cleanTextArray([background.tool, ...(draft.additionalTools || [])]),
    attacks: cleanText(draft.attacks),
    equipment: "",
    spellcasting,
    spells: cleanText(draft.preparedSpellsText),
    personality: {
      traits: cleanText(draft.personalityTraits),
      ideals: cleanText(draft.ideals),
      bonds: cleanText(draft.bonds),
      flaws: cleanText(draft.flaws),
    },
    traits: cleanText(draft.personalityTraits),
    ideals: cleanText(draft.ideals),
    bonds: cleanText(draft.bonds),
    flaws: cleanText(draft.flaws),
  };
}

export function buildCharacterCreatePayload(draft = {}) {
  const name = cleanText(draft.name);
  const kind = draft.kind === "merchant" ? "merchant" : "npc";
  const sheet = buildCharacterSheetFromDraft(draft);
  const professionTags = workshopTagsFromProfessions(draft.professions);
  const tags = cleanTextArray([...(draft.tags || []), ...professionTags]);
  const locationId = draft.locationId === "" || draft.locationId === null || draft.locationId === undefined
    ? null
    : Number(draft.locationId);

  return {
    name,
    kind,
    race: sheet.species,
    role: cleanText(draft.role) || (kind === "merchant" ? "Merchant" : sheet.className),
    affiliation: cleanText(draft.affiliation) || null,
    status: "alive",
    description: cleanText(draft.description) || null,
    background: cleanText(draft.backgroundNarrative) || sheet.background,
    motivation: cleanText(draft.motivation) || null,
    quirk: cleanText(draft.quirk) || null,
    mannerism: cleanText(draft.mannerism) || null,
    voice: cleanText(draft.voice) || null,
    secret: cleanText(draft.secret) || null,
    tags,
    storefront_enabled: kind === "merchant" ? Boolean(draft.storefrontEnabled ?? true) : false,
    storefront_title: kind === "merchant" && Boolean(draft.storefrontEnabled ?? true) ? cleanText(draft.storefrontTitle) || `${name}'s Shop` : null,
    storefront_tagline: kind === "merchant" && Boolean(draft.storefrontEnabled ?? true) ? cleanText(draft.storefrontTagline) || null : null,
    location_id: Number.isFinite(locationId) ? locationId : null,
    home_location_id: Number.isFinite(locationId) ? locationId : null,
    is_hidden: true,
    state: "resting",
    sheet,
  };
}

export function validateCharacterDraft(draft = {}) {
  const errors = [];
  if (!cleanText(draft.name)) errors.push("Name is required.");
  if (cleanText(draft.name).length > 120) errors.push("Name must be 120 characters or fewer.");
  if (!SPECIES_DEFINITIONS[draft.speciesKey]) errors.push("Choose a species.");
  if (draft.speciesKey === "custom" && !cleanText(draft.customSpecies)) errors.push("Enter the custom species name.");
  if (!BACKGROUND_DEFINITIONS[draft.backgroundKey]) errors.push("Choose a background.");
  if (!CLASS_DEFINITIONS[draft.classKey]) errors.push("Choose a class or No Adventuring Class.");
  const classDefinition = CLASS_DEFINITIONS[draft.classKey] || CLASS_DEFINITIONS.civilian;
  const selectedClassSkills = Array.from(new Set(Array.isArray(draft.selectedClassSkills) ? draft.selectedClassSkills : []));
  if (selectedClassSkills.length !== classDefinition.skillCount) {
    errors.push(`Choose exactly ${classDefinition.skillCount} class skill${classDefinition.skillCount === 1 ? "" : "s"}.`);
  }
  if (selectedClassSkills.some((skill) => !classDefinition.skillOptions.includes(skill))) {
    errors.push("One or more selected class skills are not available to that class.");
  }
  const background = BACKGROUND_DEFINITIONS[draft.backgroundKey] || BACKGROUND_DEFINITIONS.custom;
  const boosts = draft.backgroundBoosts || {};
  if (boosts.mode === "three") {
    const plusOnes = Array.from(new Set(Array.isArray(boosts.plusOnes) ? boosts.plusOnes : [])).filter((key) => background.abilities.includes(key));
    if (plusOnes.length !== 3) errors.push("Choose three different background abilities for +1 increases.");
  } else if (!background.abilities.includes(boosts.plusTwo) || !background.abilities.includes(boosts.plusOne) || boosts.plusTwo === boosts.plusOne) {
    errors.push("Choose different eligible background abilities for the +2 and +1 increases.");
  }
  const professionData = professionConfiguration(draft.professions);
  PROFESSION_KEYS.forEach((key) => {
    if (professionData[key].offersService && professionData[key].rank === 0) {
      errors.push(`${PROFESSION_DEFINITIONS[key].label} must be proficient before it can be offered as a workshop service.`);
    }
  });
  return errors;
}

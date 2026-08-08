import { formatPlayerFacingText } from "./playerFacingText";
import { normalized, safeText, slug, unique } from "./classFeatureChoiceConstants";

export const STANDARD_LANGUAGES = Object.freeze([
  "Common Sign Language", "Draconic", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc",
]);
export const RARE_LANGUAGES = Object.freeze([
  "Abyssal", "Celestial", "Deep Speech", "Druidic", "Infernal", "Primordial", "Sylvan", "Thieves' Cant", "Undercommon",
]);
const ALL_LANGUAGES = Object.freeze([...STANDARD_LANGUAGES, ...RARE_LANGUAGES]);
const DAMAGE_TYPES = Object.freeze(["Acid", "Cold", "Fire", "Lightning", "Poison"]);
const SCHOOL_NAMES = Object.freeze(["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"]);

const sourceRank = (source) => source === "XPHB" ? 0 : source === "PHB" ? 1 : 2;
const optionKey = (name, source = "CAMPAIGN") => `${slug(name)}|${safeText(source || "CAMPAIGN").toUpperCase()}`;
const array = (value) => Array.isArray(value) ? value : [];
const hasClass = (spell, className) => array(spell?.classes).some((entry) => normalized(entry) === normalized(className));
const spellComponents = (spell) => [spell?.components_v ? "V" : "", spell?.components_s ? "S" : "", spell?.components_m ? "M" : ""].filter(Boolean).join(", ") || "—";

function preferredSpellRows(spells = []) {
  const byName = new Map();
  for (const row of array(spells)) {
    const key = normalized(row?.name);
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing || sourceRank(row?.source) < sourceRank(existing?.source)) byName.set(key, row);
  }
  return [...byName.values()];
}

function spellOption(row) {
  return {
    key: optionKey(row.name, row.source),
    name: row.name,
    source: row.source || "CAMPAIGN",
    kind: "spell",
    referenceType: "spell",
    cardType: "spell",
    description: formatPlayerFacingText(row.description, "No imported spell description is available."),
    minLevel: 1,
    spell: {
      id: row.id,
      spellKey: row.spell_key,
      level: Number(row.level || 0),
      school: row.school || row.school_code || "",
      castingTime: row.casting_time || "—",
      range: row.range_text || "—",
      duration: row.duration_text || "—",
      components: spellComponents(row),
      ritual: Boolean(row.ritual),
      concentration: Boolean(row.concentration),
      damage: row.damage_dice || "",
      damageTypes: array(row.damage_types),
      classes: array(row.classes),
    },
    raw: row,
  };
}

function spellOptions(spells, filters = {}) {
  return preferredSpellRows(spells).filter((row) => {
    const level = Number(row.level || 0);
    if (filters.level != null && level !== Number(filters.level)) return false;
    if (filters.maxLevel != null && level > Number(filters.maxLevel)) return false;
    if (filters.minLevel != null && level < Number(filters.minLevel)) return false;
    if (filters.ritual != null && Boolean(row.ritual) !== Boolean(filters.ritual)) return false;
    if (filters.damageOnly && !array(row.damage_types).length && !safeText(row.damage_dice)) return false;
    if (filters.classes?.length && !filters.classes.some((className) => hasClass(row, className))) return false;
    if (filters.schools?.length && !filters.schools.some((school) => normalized(school) === normalized(row.school || row.school_code))) return false;
    if (filters.castingTimeIncludes) {
      const casting = normalized(row.casting_time);
      const wanted = normalized(filters.castingTimeIncludes);
      if (wanted === "action" ? !["action", "1 action"].includes(casting) : !casting.includes(wanted)) return false;
    }
    if (filters.excludeNames?.some((name) => normalized(name) === normalized(row.name))) return false;
    return true;
  }).map(spellOption).sort((a, b) => Number(a.spell.level) - Number(b.spell.level) || a.name.localeCompare(b.name));
}

function staticOption(name, source, kind, description = "") {
  return {
    key: optionKey(name, source), name, source, kind, referenceType: kind,
    description: description || `Record ${name} as the initial choice for this feature.`, minLevel: 1,
  };
}

function catalogOptions(catalogRows, type, predicate = () => true) {
  return array(catalogRows).filter((row) => row.option_type === type && predicate(row)).map((row) => ({
    key: optionKey(row.name, row.source), name: row.name, source: row.source || "XPHB", kind: type,
    referenceType: type, description: formatPlayerFacingText(row.description, `A source-backed ${type} choice.`), minLevel: 1, raw: row,
  }));
}

function findRow(rows, name, subclass = "") {
  return array(rows).find((row) => normalized(row.name) === normalized(name)
    && (!subclass || [row.subclass_name, row.subclass_short_name].some((value) => normalized(value) === normalized(subclass))));
}

function group({ id, label, row, level, count = 1, kind = "class-feature", options = [], helper = "", activeWhen = null, constraints = null, placement = "class", cadence = "creation" }) {
  return {
    id, label, level: Number(level || row?.level || 1), count: Number(count || 1), kind, required: true,
    sourceFeature: row?.name || label, subclassName: row?.subclass_name || "", helper: helper || formatPlayerFacingText(row?.description, "Complete the choice granted by this feature."),
    options, activeWhen, constraints, placement, cadence,
  };
}

function maximumSpellLevel(classKey, level) {
  const full = ["bard", "cleric", "druid", "sorcerer", "wizard"];
  if (full.includes(classKey)) return Math.min(9, Math.ceil(Number(level || 1) / 2));
  if (["paladin", "ranger"].includes(classKey)) return Math.min(5, Math.ceil(Number(level || 1) / 2));
  if (classKey === "warlock") return Math.min(5, Math.ceil(Number(level || 1) / 2));
  return 0;
}

function selectedNames(groups, selections) {
  return new Set(array(groups).flatMap((candidate) => array(selections?.[candidate.id]).map((key) => candidate.options?.find((option) => option.key === key)?.name)).filter(Boolean).map(normalized));
}

export function classFeatureGroupIsActive(groupRow, groups = [], selections = {}) {
  const rule = groupRow?.activeWhen;
  if (!rule) return true;
  const chosen = selectedNames(groups, selections);
  const names = array(rule.optionNames).map(normalized).filter(Boolean);
  if (!names.length) return true;
  return rule.mode === "all" ? names.every((name) => chosen.has(name)) : names.some((name) => chosen.has(name));
}

export function activeClassFeatureGroups(groups = [], selections = {}) {
  return array(groups).filter((candidate) => classFeatureGroupIsActive(candidate, groups, selections));
}

function addGroup(output, candidate) {
  if (!candidate || candidate.count < 1 || candidate.options.length < candidate.count) return;
  const duplicate = output.some((entry) => entry.id === candidate.id || (
    normalized(entry.sourceFeature) === normalized(candidate.sourceFeature)
    && normalized(entry.label) === normalized(candidate.label)
    && normalized(entry.subclassName) === normalized(candidate.subclassName)
  ));
  if (!duplicate) output.push(candidate);
}

function invocationFollowups(output, baseGroups, catalogRows, spells) {
  const invocationGroup = baseGroups.find((entry) => entry.kind === "eldritch-invocation");
  if (!invocationGroup) return;
  const warlockDamageCantrips = spellOptions(spells, { level: 0, classes: ["Warlock"], damageOnly: true });
  for (const invocation of ["Agonizing Blast", "Eldritch Spear", "Repelling Blast"]) {
    addGroup(output, group({
      id: `warlock-${slug(invocation)}-cantrip`, label: `${invocation}: affected cantrip`, level: 2, count: 1, kind: "spell",
      row: { name: invocation }, options: warlockDamageCantrips,
      helper: `Choose the known Warlock damage cantrip modified by ${invocation}. The chosen cantrip should also be selected on the Spells step.`,
      activeWhen: { optionNames: [invocation] }, constraints: { spellLevel: 0, spellClasses: ["Warlock"], damageOnly: true },
    }));
  }
  addGroup(output, group({
    id: "warlock-lessons-origin-feat", label: "Lessons of the First Ones: Origin feat", level: 2, count: 1, kind: "feat",
    row: { name: "Lessons of the First Ones" },
    options: catalogOptions(catalogRows, "feat", (row) => row.category === "O"),
    helper: "Choose the Origin feat granted by Lessons of the First Ones. Normal feat prerequisites still apply.",
    activeWhen: { optionNames: ["Lessons of the First Ones"] }, constraints: { featCategory: "O" },
  }));
}

export function buildExplicitClassFeatureGroups({ rows = [], selectedClass, level = 1, catalogRows = [], spells = [], baseGroups = [] } = {}) {
  const output = [];
  const classKey = normalized(selectedClass?.class_key).replace(/\s/g, "-");
  const source = selectedClass?.source || "XPHB";
  const skills = catalogOptions(catalogRows, "skill");
  const languages = ALL_LANGUAGES.map((name) => staticOption(name, "XPHB", "language", "A language from the Player's Handbook language tables."));

  invocationFollowups(output, baseGroups, catalogRows, spells);

  const magicalDiscoveries = findRow(rows, "Magical Discoveries", "Lore");
  if (magicalDiscoveries) addGroup(output, group({
    id: "bard-lore-magical-discoveries", label: "Magical Discoveries", row: magicalDiscoveries, count: 2, kind: "spell",
    options: spellOptions(spells, { maxLevel: maximumSpellLevel("bard", level), classes: ["Cleric", "Druid", "Wizard"] }),
    constraints: { maxSpellLevel: maximumSpellLevel("bard", level), spellClasses: ["Cleric", "Druid", "Wizard"] },
  }));

  const primalLore = findRow(rows, "Primal Lore", "Moon");
  if (primalLore) {
    addGroup(output, group({ id: "bard-moon-primal-lore-cantrip", label: "Primal Lore cantrip", row: primalLore, kind: "spell", options: spellOptions(spells, { level: 0, classes: ["Druid"] }), constraints: { spellLevel: 0, spellClasses: ["Druid"] } }));
    addGroup(output, group({ id: "bard-moon-primal-lore-skill", label: "Primal Lore skill", row: primalLore, kind: "skill-choice", options: skills.filter((option) => ["animal handling", "insight", "medicine", "nature", "perception", "survival"].includes(normalized(option.name))) }));
  }

  const blessedStrikes = findRow(rows, "Blessed Strikes");
  if (blessedStrikes) addGroup(output, group({ id: "cleric-blessed-strikes", label: "Blessed Strikes", row: blessedStrikes, options: ["Divine Strike", "Potent Spellcasting"].map((name) => staticOption(name, source, "class-feature")) }));

  const knightlyEnvoy = findRow(rows, "Knightly Envoy", "Banneret");
  if (knightlyEnvoy) addGroup(output, group({ id: "fighter-banneret-skill", label: "Knightly Envoy skill", row: knightlyEnvoy, kind: "skill-choice", options: skills.filter((option) => ["insight", "intimidation", "persuasion", "performance"].includes(normalized(option.name))) }));

  const championStyle = findRow(rows, "Additional Fighting Style", "Champion");
  if (championStyle) addGroup(output, group({
    id: "fighter-champion-additional-fighting-style", label: "Additional Fighting Style", row: championStyle, kind: "fighting-style",
    options: catalogOptions(catalogRows, "feat", (row) => row.category === "FS"), constraints: { featCategory: "FS" },
  }));

  const deftExplorer = findRow(rows, "Deft Explorer");
  if (deftExplorer) addGroup(output, group({ id: "ranger-deft-explorer-languages", label: "Deft Explorer languages", row: deftExplorer, count: 2, kind: "language", options: languages }));

  const thievesCant = findRow(rows, "Thieves' Cant");
  if (thievesCant) addGroup(output, group({ id: "rogue-thieves-cant-language", label: "Thieves' Cant additional language", row: thievesCant, kind: "language", options: languages.filter((option) => normalized(option.name) !== "thieves cant") }));

  const affinity = findRow(rows, "Elemental Affinity", "Draconic");
  if (affinity) addGroup(output, group({ id: "sorcerer-draconic-affinity", label: "Elemental Affinity", row: affinity, kind: "damage-type", options: DAMAGE_TYPES.map((name) => staticOption(name, source, "damage-type")) }));

  for (const [entryLevel, spellLevel] of [[11, 6], [13, 7], [15, 8], [17, 9]]) {
    const arcanum = array(rows).find((row) => normalized(row.name) === "mystic arcanum" && Number(row.level) === entryLevel);
    if (arcanum) addGroup(output, group({
      id: `warlock-mystic-arcanum-${spellLevel}`, label: `Mystic Arcanum: level ${spellLevel} spell`, row: arcanum, kind: "spell",
      options: spellOptions(spells, { level: spellLevel, classes: ["Warlock"] }), constraints: { spellLevel, spellClasses: ["Warlock"] },
    }));
  }

  const savants = array(rows).filter((row) => / savant$/i.test(safeText(row.name)) && Number(row.level) <= Number(level));
  for (const savant of savants) {
    const school = SCHOOL_NAMES.find((name) => normalized(savant.name).startsWith(normalized(name)));
    if (!school) continue;
    addGroup(output, group({
      id: `wizard-${slug(school)}-savant`, label: `${school} Savant spellbook additions`, row: savant, count: 2, kind: "spell",
      options: spellOptions(spells, { maxLevel: 2, classes: ["Wizard"], schools: [school] }),
      constraints: { maxSpellLevel: 2, spellClasses: ["Wizard"], schools: [school] },
    }));
  }

  const signature = findRow(rows, "Signature Spells");
  if (signature) addGroup(output, group({
    id: "wizard-signature-spells",
    label: "Signature Spells",
    row: signature,
    count: 2,
    kind: "spell",
    placement: "spells",
    helper: "Choose two level 3 spells that are actually in this Wizard's finished spellbook. The Spells step limits this list to normal Wizard spellbook selections plus source-owned Savant additions.",
    options: spellOptions(spells, { level: 3, classes: ["Wizard"] }),
    constraints: { spellLevel: 3, spellClasses: ["Wizard"], wizardSpellbookRequired: true, freeCastUses: 1, recharge: "short_rest" },
  }));

  if (classKey === "expert-sidekick") {
    const expertiseRow = findRow(rows, "Expertise");
    const count = Number(level) >= 15 ? 4 : Number(level) >= 3 ? 2 : 0;
    if (expertiseRow && count) addGroup(output, group({ id: "expert-sidekick-expertise", label: "Expertise", row: expertiseRow, count, kind: "expertise", placement: "training", options: skills }));
  }
  const martialRole = findRow(rows, "Martial Role");
  if (martialRole) addGroup(output, group({ id: "warrior-sidekick-role", label: "Martial Role", row: martialRole, options: ["Attacker", "Defender"].map((name) => staticOption(name, source, "class-feature")) }));
  const sidekickSpellcasting = classKey === "spellcaster-sidekick" ? findRow(rows, "Spellcasting") : null;
  if (sidekickSpellcasting) addGroup(output, group({ id: "spellcaster-sidekick-role", label: "Spellcaster role", row: sidekickSpellcasting, options: ["Mage", "Healer", "Prodigy"].map((name) => staticOption(name, source, "class-feature")) }));
  const empoweredSpells = classKey === "spellcaster-sidekick" ? findRow(rows, "Empowered Spells") : null;
  if (empoweredSpells) addGroup(output, group({ id: "spellcaster-sidekick-school", label: "Empowered Spells school", row: empoweredSpells, options: SCHOOL_NAMES.map((name) => staticOption(name, source, "class-feature")) }));

  return output;
}

export function mergeChoiceGroups(primary = [], additions = []) {
  const output = primary.map((entry) => ({ ...entry, options: [...array(entry.options)] }));
  for (const addition of additions) {
    const match = output.find((entry) => entry.id === addition.id);
    if (!match) {
      addGroup(output, addition);
      continue;
    }
    const byKey = new Map(match.options.map((option) => [option.key, option]));
    addition.options.forEach((option) => { if (!byKey.has(option.key)) byKey.set(option.key, option); });
    match.options = [...byKey.values()];
    match.count = Math.max(Number(match.count || 0), Number(addition.count || 0));
  }
  return output;
}

export function flattenActiveClassChoiceSelections(groups = [], selections = {}) {
  return activeClassFeatureGroups(groups, selections).flatMap((candidate) => array(selections?.[candidate.id]).map((key) => {
    const option = candidate.options?.find((entry) => entry.key === key);
    return option ? { group: candidate, option } : null;
  }).filter(Boolean));
}
import { formatPlayerFacingText } from "./playerFacingText";
import { safeText, normalized, slug, unique, ARTIFICER_PLAN_PROGRESSION_EFA } from "./classFeatureChoiceConstants";
import {
  eligibleRows, groupKind, optionNodes, optionNodeCreatesChoice, referencedOptions, permanentChoiceText, namedEntryOptions,
  tablePlanOptions, enrichOptions, mergeProgressionGroups, textChoiceCount,
} from "./classFeatureChoiceParsing";
import {
  activeClassFeatureGroups,
  buildExplicitClassFeatureGroups,
  classFeatureGroupIsActive,
  flattenActiveClassChoiceSelections,
  mergeChoiceGroups,
} from "./classFeatureChoiceExtensions";

export {
  WARLOCK_INVOCATION_PROGRESSION_XPHB, WARLOCK_INVOCATION_PROGRESSION_PHB, BATTLE_MASTER_MANEUVER_PROGRESSION,
  SORCERER_METAMAGIC_PROGRESSION_XPHB, SORCERER_METAMAGIC_PROGRESSION_PHB, ARTIFICER_PLAN_PROGRESSION_EFA,
  ARCANE_SHOT_PROGRESSION, RUNE_KNIGHT_PROGRESSION, FOUR_ELEMENTS_DISCIPLINE_PROGRESSION,
} from "./classFeatureChoiceConstants";
export { activeClassFeatureGroups, classFeatureGroupIsActive } from "./classFeatureChoiceExtensions";

function classHasFeature(rows, name) { return rows.some((row) => normalized(row.name) === normalized(name)); }
function featOptions(catalogRows, predicate) { return (Array.isArray(catalogRows) ? catalogRows : []).filter((row) => row.option_type === "feat" && predicate(row)).map((row) => ({ name: row.name, source: row.source, referenceType: "feat", raw: row })); }
function skillOptions(catalogRows, allowedNames = null) {
  const allowed = allowedNames ? new Set(allowedNames.map(normalized)) : null;
  return (Array.isArray(catalogRows) ? catalogRows : []).filter((row) => row.option_type === "skill" && (!allowed || allowed.has(normalized(row.name)))).map((row) => ({ name: row.name, source: row.source || "XPHB", referenceType: "skill", raw: row }));
}
function fightingStyleOptions(rows, selectedClass, catalogRows) {
  const classKey = normalized(selectedClass?.class_key).replace(/\s/g, "-");
  const feature = rows.find((row) => normalized(row.name) === "fighting style");
  const categories = new Set(["FS", ...(classKey === "paladin" ? ["FS:P"] : []), ...(classKey === "ranger" ? ["FS:R"] : [])]);
  const available = featOptions(catalogRows, (row) => categories.has(row.category));
  if (!feature) return available;
  const description = normalized(feature.description);
  if (/fighting style feat of your choice/.test(description)) return available;
  const explicitlyNamed = available.filter((option) => description.includes(normalized(option.name)));
  return explicitlyNamed.length ? explicitlyNamed : available;
}
function expertiseCount(classKey, level, source = "XPHB") {
  const modern = { bard: [[2, 2], [9, 4]], ranger: [[2, 1], [9, 3]], rogue: [[1, 2], [6, 4]], wizard: [[2, 1]] };
  const legacy = { bard: [[3, 2], [10, 4]], rogue: [[1, 2], [6, 4]] };
  const progression = (safeText(source).toUpperCase() === "XPHB" ? modern : legacy)[classKey] || [];
  return progression.reduce((count, [entryLevel, value]) => Number(level) >= entryLevel ? value : count, 0);
}
function weaponOptions(items = []) {
  const preferred = new Map();
  for (const row of Array.isArray(items) ? items : []) {
    const payload = row.payload || {};
    if (payload.source !== "XPHB" || !payload.weapon || payload.firearm || row.item_rarity !== "mundane") continue;
    const name = safeText(row.item_name || payload.name);
    if (!name || /ammunition|arrow|bolt|needle/i.test(row.item_type || "")) continue;
    const key = normalized(name);
    if (!preferred.has(key)) preferred.set(key, {
      name, source: "XPHB", referenceType: "weapon-mastery", raw: row,
      description: `${payload.weaponCategory === "martial" ? "Martial" : "Simple"} weapon • ${payload.damageText || "weapon damage"}${(payload.mastery || []).length ? ` • Mastery: ${payload.mastery.join(", ")}` : ""}`,
    });
  }
  return [...preferred.values()];
}
function kenseiWeaponCount(level) { return [[3, 2], [6, 3], [11, 4], [17, 5]].reduce((count, [entryLevel, value]) => Number(level) >= entryLevel ? value : count, 0); }
function kenseiWeaponOptions(items = []) {
  return weaponOptions(items).filter((option) => {
    const payload = option.raw?.payload || {};
    const properties = (payload.properties || []).map((value) => normalized(typeof value === "string" ? value : value?.name || value?.key));
    const heavy = properties.includes("heavy") || /\bheavy\b/i.test(payload.propertyText || "");
    const special = properties.includes("special") || /\bspecial\b/i.test(payload.propertyText || "");
    return (!heavy || normalized(option.name) === "longbow") && !special;
  }).map((option) => ({ ...option, referenceType: "kensei-weapon" }));
}
function customGroups(rows, selectedClass, level, catalogRows, items, features) {
  const output = [];
  const classKey = normalized(selectedClass?.class_key).replace(/\s/g, "-");
  if (classHasFeature(rows, "Fighting Style")) {
    const feature = rows.find((row) => normalized(row.name) === "fighting style");
    output.push({
      id: `${classKey}-fighting-style`, label: "Fighting Style", level: feature?.level || 1,
      count: 1, kind: "fighting-style", required: true, sourceFeature: "Fighting Style", subclassName: feature?.subclass_name || "", placement: "class", cadence: "creation",
      options: enrichOptions(fightingStyleOptions(rows, selectedClass, catalogRows), features, "fighting-style"),
    });
  }
  const expertise = expertiseCount(classKey, level, selectedClass?.source);
  if (expertise) {
    const wizardSkills = classKey === "wizard" ? ["Arcana", "History", "Investigation", "Medicine", "Nature", "Religion"] : null;
    output.push({
      id: `${classKey}-expertise`, label: classKey === "wizard" ? "Scholar Expertise" : "Expertise", level: classKey === "rogue" ? 1 : 2,
      count: expertise, kind: "expertise", required: true, sourceFeature: classKey === "wizard" ? "Scholar" : "Expertise", placement: "training", cadence: "creation",
      helper: "Choose from skills the character is already proficient in. Expertise is part of Training because proficiency must be established first.",
      options: enrichOptions(skillOptions(catalogRows, wizardSkills), features, "expertise"),
    });
  }
  const kenseiCount = kenseiWeaponCount(level);
  if (kenseiCount && classHasFeature(rows, "Path of the Kensei")) output.push({
    id: `${classKey}-kensei-weapons`, label: "Kensei Weapons", level: 3, count: kenseiCount, kind: "kensei-weapon", required: true,
    sourceFeature: "Path of the Kensei", placement: "class", cadence: "creation", helper: "Choose the weapon types mastered by the Kensei feature. Heavy and Special weapons are excluded, except the Longbow remains eligible.",
    options: enrichOptions(kenseiWeaponOptions(items), features, "kensei-weapon"),
  });
  return output;
}
function permitsCrossGroupRepeat(sourceFeature = "") { return ["totem spirit", "aspect of the beast", "totemic attunement"].includes(normalized(sourceFeature)); }
function savantSpellOptions(spells = [], school = "", maximumLevel = 2) {
  const preferred = new Map();
  const rank = (source) => source === "XPHB" ? 0 : source === "PHB" ? 1 : 2;
  for (const row of Array.isArray(spells) ? spells : []) {
    const spellLevel = Number(row.level || 0);
    if (spellLevel < 1 || spellLevel > maximumLevel || normalized(row.school || row.school_code) !== normalized(school)) continue;
    if (!(row.classes || []).some((entry) => normalized(entry) === "wizard")) continue;
    const key = normalized(row.name);
    const current = preferred.get(key);
    if (!current || rank(row.source) < rank(current.source)) preferred.set(key, row);
  }
  return [...preferred.values()].map((row) => ({
    key: `${slug(row.name)}|${safeText(row.source || "CAMPAIGN").toUpperCase()}`,
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
      components: [row.components_v ? "V" : "", row.components_s ? "S" : "", row.components_m ? "M" : ""].filter(Boolean).join(", ") || "—",
      ritual: Boolean(row.ritual),
      concentration: Boolean(row.concentration),
      damage: row.damage_dice || "",
      damageTypes: Array.isArray(row.damage_types) ? row.damage_types : [],
      classes: Array.isArray(row.classes) ? row.classes : [],
    },
  })).sort((a, b) => Number(a.spell.level) - Number(b.spell.level) || a.name.localeCompare(b.name));
}
function expandWizardSavantGroups(groups = [], selectedClass, level = 1, spells = []) {
  if (normalized(selectedClass?.class_key) !== "wizard") return groups;
  const startingLevel = Number(level || 1);
  const acquisitions = [
    { level: 3, count: 2, maxSpellLevel: 2 },
    { level: 5, count: 1, maxSpellLevel: 3 },
    { level: 7, count: 1, maxSpellLevel: 4 },
    { level: 9, count: 1, maxSpellLevel: 5 },
    { level: 11, count: 1, maxSpellLevel: 6 },
    { level: 13, count: 1, maxSpellLevel: 7 },
    { level: 15, count: 1, maxSpellLevel: 8 },
    { level: 17, count: 1, maxSpellLevel: 9 },
  ].filter((entry) => entry.level <= startingLevel);
  return groups.flatMap((group) => {
    const match = safeText(group.label).match(/^(.+?) Savant spellbook additions$/i);
    if (!match) return [group];
    const school = match[1];
    return acquisitions.map((acquisition) => ({
      ...group,
      id: acquisition.level === 3 ? group.id : `${group.id}-level-${acquisition.level}`,
      label: acquisition.level === 3 ? `${school} Savant spellbook additions` : `${school} Savant: level ${acquisition.level} spellbook addition`,
      level: acquisition.level,
      count: acquisition.count,
      options: savantSpellOptions(spells, school, acquisition.maxSpellLevel),
      constraints: { minSpellLevel: 1, maxSpellLevel: acquisition.maxSpellLevel, spellClasses: ["Wizard"], schools: [school], wizardSpellbook: true },
      helper: acquisition.level === 3
        ? "Choose the two level 1+ Wizard spells from this school that the Savant feature added to the spellbook at Wizard level 3. Each must be level 1 or 2."
        : `Choose the free level 1+ ${school} Wizard spell added when this Wizard first gained level ${acquisition.maxSpellLevel} spell slots at Wizard level ${acquisition.level}.`,
    }));
  });
}
function configureWizardSignatureGroups(groups = [], selectedClass) {
  if (normalized(selectedClass?.class_key) !== "wizard" || safeText(selectedClass?.source).toUpperCase() !== "XPHB") return groups;
  return groups.map((group) => normalized(group.sourceFeature) === "signature spells" || group.id === "wizard-signature-spells"
    ? {
      ...group,
      id: "wizard-signature-spells",
      placement: "spells",
      allowRepeatAcrossGroups: true,
      constraints: { ...(group.constraints || {}), spellLevel: 3, spellClasses: ["Wizard"], requiresWizardSpellbook: true },
      helper: "Choose two level-3 Wizard spells that are in this character's final spellbook. A level-3 spell selected as one of the normal Wizard spellbook additions on the Spells step can qualify.",
    }
    : group);
}
const EXPLICIT_PROSE_FEATURES = new Set([
  "blessed strikes", "knightly envoy", "deft explorer", "primal companion", "martial role",
]);
function handledByExplicitChoiceEngine(row) { return EXPLICIT_PROSE_FEATURES.has(normalized(row?.name)); }

export function buildClassFeatureChoiceGroups({ selectedClass, level = 1, features = [], selectedSubclass = null, catalogRows = [], items = [], spells = [] } = {}) {
  if (!selectedClass?.class_key) return [];
  const rows = eligibleRows(features, selectedClass, selectedSubclass, level);
  const groups = [];
  rows.forEach((row) => {
    const kind = groupKind(row);
    const nodes = optionNodes(row.entries);
    let addedChoiceGroup = false;
    nodes.forEach((node, index) => {
      if (!optionNodeCreatesChoice(row, node, kind)) return;
      const references = referencedOptions(node.entries || node).map((option) => ({ ...option, source: option.source || row.source || row.class_source || selectedClass.source }));
      if (!references.length) return;
      groups.push({
        id: `${slug(selectedClass.class_key)}-${slug(selectedClass.source)}-${slug(row.subclass_name || "base")}-${Number(row.level || 1)}-${slug(row.name)}-${index}`,
        label: safeText(row.name).replace(/\s+Options$/i, ""), level: Number(row.level || 1), count: Math.max(1, Number(node.count || textChoiceCount(row.description, 1))),
        kind, required: true, sourceFeature: row.name, subclassName: row.subclass_name || "", allowRepeatAcrossGroups: permitsCrossGroupRepeat(row.name), placement: "class", cadence: "creation",
        helper: formatPlayerFacingText(row.description, "Select the required options granted by this feature."), options: enrichOptions(references, features, kind),
      });
      addedChoiceGroup = true;
    });
    if (!addedChoiceGroup && permanentChoiceText(row) && !handledByExplicitChoiceEngine(row)) {
      const directOptions = namedEntryOptions(row.entries).map((option) => ({ ...option, source: option.source || row.source || row.class_source || selectedClass.source }));
      if (directOptions.length) groups.push({
        id: `${slug(selectedClass.class_key)}-${slug(selectedClass.source)}-${slug(row.subclass_name || "base")}-${Number(row.level || 1)}-${slug(row.name)}-named`,
        label: safeText(row.name), level: Number(row.level || 1), count: Math.max(1, textChoiceCount(row.description, 1)), kind, required: true,
        sourceFeature: row.name, subclassName: row.subclass_name || "", allowRepeatAcrossGroups: permitsCrossGroupRepeat(row.name), placement: "class", cadence: "creation",
        helper: formatPlayerFacingText(row.description, "Select the required option granted by this feature."), options: enrichOptions(directOptions, features, kind),
      });
    }
    if (normalized(row.name) === "replicate magic item") {
      const plans = tablePlanOptions(row.entries);
      if (plans.length) groups.push({ id: `${slug(selectedClass.class_key)}-magic-item-plans`, label: "Magic Item Plans", level: 2, count: ARTIFICER_PLAN_PROGRESSION_EFA[Math.max(0, Math.min(19, Number(level) - 1))], kind: "artificer-plan", required: true, sourceFeature: row.name, placement: "class", cadence: "creation", helper: formatPlayerFacingText(row.description), options: enrichOptions(plans, features, "artificer-plan") });
    }
  });
  const merged = mergeProgressionGroups(groups, selectedClass, level);
  const withCustom = merged.map((entry) => ({ ...entry, placement: entry.placement || "class", cadence: entry.cadence || "creation", options: [...(entry.options || [])] }));
  for (const customGroup of customGroups(rows, selectedClass, level, catalogRows, items, features)) {
    const existing = withCustom.find((entry) => entry.kind === customGroup.kind
      && normalized(entry.sourceFeature) === normalized(customGroup.sourceFeature)
      && normalized(entry.subclassName) === normalized(customGroup.subclassName));
    if (!existing) {
      withCustom.push(customGroup);
      continue;
    }
    const byKey = new Map((existing.options || []).map((option) => [option.key, option]));
    (customGroup.options || []).forEach((option) => { if (!byKey.has(option.key)) byKey.set(option.key, option); });
    existing.options = [...byKey.values()];
    existing.count = Math.max(Number(existing.count || 0), Number(customGroup.count || 0));
    existing.placement = customGroup.placement || existing.placement || "class";
    existing.cadence = customGroup.cadence || existing.cadence || "creation";
  }
  const explicit = buildExplicitClassFeatureGroups({ rows, selectedClass, level, catalogRows, spells, baseGroups: withCustom });
  return configureWizardSignatureGroups(
    expandWizardSavantGroups(mergeChoiceGroups(withCustom, explicit), selectedClass, level, spells),
    selectedClass
  )
    .map((group) => ({ ...group, placement: group.placement || "class", cadence: group.cadence || "creation" }))
    .filter((group) => group.cadence === "creation" && group.count > 0 && group.options.length >= group.count)
    .sort((a, b) => Number(a.level) - Number(b.level) || a.label.localeCompare(b.label));
}

export function normalizeClassFeatureSelections(groups = [], selections = {}) {
  const output = {};
  for (const group of groups) {
    const allowed = new Set((group.options || []).map((option) => option.key));
    output[group.id] = unique(selections?.[group.id] || []).filter((key) => allowed.has(key)).slice(0, Number(group.count || 0));
  }
  return output;
}
export function classFeatureGroupsComplete(groups = [], selections = {}, placement = null) {
  return activeClassFeatureGroups(groups, selections)
    .filter((group) => !placement || (group.placement || "class") === placement)
    .every((group) => !group.required || unique(selections?.[group.id] || []).length === Number(group.count || 0));
}
export function toggleClassFeatureSelection(groups = [], selections = {}, groupId, optionKey) {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group || !classFeatureGroupIsActive(group, groups, selections)) return selections;
  const option = group.options.find((candidate) => candidate.key === optionKey);
  if (!option) return selections;
  const selected = unique(selections?.[groupId] || []);
  const exists = selected.includes(optionKey);
  let next = exists ? selected.filter((key) => key !== optionKey) : selected;
  if (!exists) {
    const allSelected = flattenActiveClassChoiceSelections(groups, selections).map((entry) => entry.option);
    if (!group.allowRepeatAcrossGroups && allSelected.some((entry) => normalized(entry.name) === normalized(option.name))) return selections;
    if (option.requires && !allSelected.map((entry) => normalized(entry.name)).includes(normalized(option.requires))) return selections;
    next = selected.length < Number(group.count || 0) ? [...selected, optionKey] : [...selected.slice(1), optionKey];
  }
  return { ...selections, [groupId]: next };
}
export function selectedClassFeatureOptions(groups = [], selections = {}) {
  return flattenActiveClassChoiceSelections(groups, selections).map(({ group, option }) => ({
    groupId: group.id, groupLabel: group.label, groupKind: group.kind, level: group.level, placement: group.placement || "class", cadence: group.cadence || "creation",
    key: option.key, name: option.name, source: option.source, kind: option.kind,
    description: option.description, minLevel: option.minLevel, requires: option.requires || "", followup: option.followup || "",
    cardType: option.cardType || null, spell: option.spell || null,
  }));
}
export function serializeClassFeatureChoices(groups = [], selections = {}) {
  return Object.fromEntries(activeClassFeatureGroups(groups, selections).map((group) => [group.id, {
    label: group.label, kind: group.kind, level: group.level, count: group.count, sourceFeature: group.sourceFeature || group.label,
    subclassName: group.subclassName || null, allowRepeatAcrossGroups: Boolean(group.allowRepeatAcrossGroups), placement: group.placement || "class", cadence: group.cadence || "creation",
    activeWhen: group.activeWhen || null, constraints: group.constraints || null,
    selections: (selections?.[group.id] || []).map((key) => {
      const option = group.options.find((candidate) => candidate.key === key);
      return option ? { key: option.key, name: option.name, source: option.source, kind: option.kind, followup: option.followup || null, spell: option.spell || null } : null;
    }).filter(Boolean),
  }]));
}

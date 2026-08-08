import { ABILITY_LABELS, SKILL_DEFINITIONS, proficiencyBonusForLevel } from "./characterCreation";
import { buildToolOptionCatalog, sourceChoiceFieldIsActive } from "./playerForgeSourceChoices";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");
const array = (value) => Array.isArray(value) ? value : [];
const unique = (values = []) => [...new Set(array(values).map(text).filter(Boolean))];

const ABILITY_OPTIONS = Object.freeze(["str", "dex", "con", "int", "wis", "cha"].map((value) => ({ key: value, value, label: ABILITY_LABELS[value], source: "XPHB", kind: "ability" })));
const SKILL_OPTIONS = Object.freeze(SKILL_DEFINITIONS.map((skill) => ({ key: skill.key, value: skill.key, label: skill.label, source: "XPHB", kind: "skill", metadata: { ability: skill.ability } })));
const DAMAGE_TYPE_OPTIONS = Object.freeze(["Acid", "Cold", "Fire", "Lightning", "Thunder"].map((label) => ({ key: slug(label), value: label, label, source: "XPHB", kind: "damage-type" })));

function sourceRank(source = "") { return source === "XPHB" ? 0 : source === "PHB" ? 1 : 2; }
function preferredSpellRows(spells = []) {
  const byName = new Map();
  for (const spell of array(spells)) {
    const key = norm(spell?.name);
    if (!key) continue;
    const current = byName.get(key);
    if (!current || sourceRank(spell.source) < sourceRank(current.source)) byName.set(key, spell);
  }
  return [...byName.values()];
}
function spellOption(spell) {
  return {
    key: text(spell.id || spell.spell_key || `${slug(spell.name)}|${spell.source || "XPHB"}`), value: text(spell.id || spell.spell_key || spell.name), label: spell.name, source: spell.source || "XPHB", kind: "spell",
    description: text(spell.description), metadata: { spellId: spell.id || null, spellKey: spell.spell_key || null, level: Number(spell.level || 0), school: spell.school || spell.school_code || "", classes: array(spell.classes), ritual: Boolean(spell.ritual), castingTime: spell.casting_time || null },
  };
}
function spellOptions(spells = [], filters = {}) {
  return preferredSpellRows(spells).filter((spell) => {
    if (filters.level != null && Number(spell.level || 0) !== Number(filters.level)) return false;
    if (filters.classes?.length && !filters.classes.some((wanted) => array(spell.classes).some((value) => norm(value) === norm(wanted)))) return false;
    if (filters.schools?.length && !filters.schools.some((wanted) => norm(spell.school || spell.school_code) === norm(wanted))) return false;
    if (filters.ritual != null && Boolean(spell.ritual) !== Boolean(filters.ritual)) return false;
    return true;
  }).map(spellOption).sort((a, b) => Number(a.metadata.level) - Number(b.metadata.level) || a.label.localeCompare(b.label));
}

function field({ id, label, kind, count = 1, options = [], placement = null, cadence = "creation", replacementCadence = null, activeWhen = null, helper = "", metadata = null, distinctFromFieldId = null }) {
  return { id, label, kind, count: Math.max(1, Number(count || 1)), required: true, options, placement, cadence, replacementCadence, activeWhen, helper, metadata, distinctFromFieldId };
}
function group(instance, fields, metadata = {}) {
  const feat = instance.feat || {};
  return {
    id: `feat-${slug(instance.instanceId)}`,
    ownerType: "feat",
    ownerKey: instance.instanceId,
    label: feat.name || "Feat",
    source: feat.source || "XPHB",
    placement: instance.placement || "class",
    level: Math.max(1, Number(instance.level || 1)),
    helper: `Complete the persistent choices owned by ${feat.name || "this feat"}.`,
    fields,
    metadata: {
      featInstanceId: instance.instanceId,
      featOptionId: feat.id || null,
      featOptionKey: feat.option_key || null,
      featName: feat.name || "",
      featSource: feat.source || "XPHB",
      featCategory: feat.category || null,
      repeatable: Boolean(feat.metadata?.repeatable),
      acquisitionOwnerType: instance.ownerType || null,
      acquisitionOwnerKey: instance.ownerKey || null,
      acquisitionLabel: instance.acquisitionLabel || null,
      acquisitionLevel: Math.max(1, Number(instance.level || 1)),
      ...metadata,
    },
  };
}

function abilityFields(feat = {}) {
  const output = [];
  const fixedEffects = [];
  array(feat.metadata?.ability).forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const choose = entry.choose && typeof entry.choose === "object" ? entry.choose : null;
    if (choose) {
      const allowed = array(choose.from).map((key) => ABILITY_OPTIONS.find((option) => option.value === key)).filter(Boolean);
      const amount = Number(choose.amount || entry.amount || 1);
      if (allowed.length) output.push(field({ id: `ability-${index + 1}`, label: amount > 0 ? `Increase an ability by ${amount}` : "Choose ability", kind: "ability", options: allowed.map((option) => ({ ...option, metadata: { ...(option.metadata || {}), effect: "ability-increase", amount } })), metadata: { effect: "ability-increase", amount } }));
      return;
    }
    for (const [ability, amountValue] of Object.entries(entry)) {
      if (!ABILITY_OPTIONS.some((option) => option.value === ability)) continue;
      const amount = Number(amountValue || 0);
      if (amount) fixedEffects.push({ type: "ability-increase", ability, amount });
    }
  });
  return { fields: output, fixedEffects };
}

function abilityScoreImprovementFields(instance) {
  if (norm(instance?.feat?.name) !== "ability score improvement") return [];
  const groupId = `feat-${slug(instance.instanceId)}`;
  const two = ABILITY_OPTIONS.map((option) => ({ ...option, metadata: { ...(option.metadata || {}), effect: "ability-increase", amount: 2 } }));
  const ones = ABILITY_OPTIONS.map((option) => ({ ...option, metadata: { ...(option.metadata || {}), effect: "ability-increase", amount: 1 } }));
  return [
    field({ id: "asi-mode", label: "Ability Score Improvement", kind: "enum", options: [{ key: "plus-two", value: "plus-two", label: "+2 to one ability", kind: "enum", source: instance.feat.source || "XPHB" }, { key: "split", value: "split", label: "+1 to two different abilities", kind: "enum", source: instance.feat.source || "XPHB" }] }),
    field({ id: "asi-plus-two", label: "Increase one ability by 2", kind: "ability", options: two, activeWhen: { groupId, fieldId: "asi-mode", values: ["plus-two"] }, metadata: { effect: "ability-increase", amount: 2 } }),
    field({ id: "asi-plus-ones", label: "Increase two different abilities by 1", kind: "ability", count: 2, options: ones, activeWhen: { groupId, fieldId: "asi-mode", values: ["split"] }, metadata: { effect: "ability-increase", amount: 1 } }),
  ];
}

function skillFields(feat = {}) {
  const output = [];
  array(feat.metadata?.skillProficiencies).forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    if (Number(entry.any || 0) > 0) output.push(field({ id: `skill-${index + 1}`, label: "Choose skill proficiency", kind: "skill", count: Number(entry.any), options: SKILL_OPTIONS }));
    const choose = entry.choose && typeof entry.choose === "object" ? entry.choose : null;
    if (choose) {
      const options = array(choose.from).map((key) => SKILL_OPTIONS.find((option) => norm(option.value) === norm(key))).filter(Boolean);
      if (options.length) output.push(field({ id: `skill-${index + 1}`, label: "Choose skill proficiency", kind: "skill", count: Number(choose.count || 1), options }));
    }
  });
  return output;
}

function toolFields(feat = {}, toolRows = []) {
  const output = [];
  const catalog = buildToolOptionCatalog(toolRows);
  array(feat.metadata?.toolProficiencies).forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    if (Number(entry.anyArtisansTool || 0) > 0) output.push(field({ id: `tool-${index + 1}`, label: "Choose Artisan's Tools", kind: "tool", count: Number(entry.anyArtisansTool), options: catalog.artisan }));
    if (Number(entry.anyMusicalInstrument || 0) > 0) output.push(field({ id: `tool-${index + 1}`, label: "Choose Musical Instruments", kind: "tool", count: Number(entry.anyMusicalInstrument), options: catalog.instruments }));
    if (Number(entry.anyGamingSet || 0) > 0) output.push(field({ id: `tool-${index + 1}`, label: "Choose Gaming Set", kind: "tool", count: Number(entry.anyGamingSet), options: catalog.gaming }));
    const choose = entry.choose && typeof entry.choose === "object" ? entry.choose : null;
    if (choose) {
      const names = array(choose.from).map(norm);
      const options = catalog.all.filter((option) => names.includes(norm(option.label)));
      if (options.length) output.push(field({ id: `tool-${index + 1}`, label: "Choose tool proficiency", kind: "tool", count: Number(choose.count || 1), options }));
    }
  });
  return output;
}

function filterFromChoiceExpression(expression = "") {
  const filters = {};
  for (const part of text(expression).split("|")) {
    const [rawKey, rawValue] = part.split("=");
    const key = norm(rawKey);
    const value = text(rawValue);
    if (!key || !value) continue;
    if (key === "level") filters.level = Number(value);
    if (key === "class") filters.classes = value.split(";").map(text).filter(Boolean);
    if (key === "school") filters.schools = value.split(";").map(text).filter(Boolean);
    if (key.includes("components") || key.includes("miscellaneous")) { if (norm(value).includes("ritual")) filters.ritual = true; }
  }
  return filters;
}

function collectChoiceObjects(node, output = []) {
  if (node == null) return output;
  if (Array.isArray(node)) { node.forEach((value) => collectChoiceObjects(value, output)); return output; }
  if (typeof node !== "object") return output;
  if (typeof node.choose === "string") output.push({ choose: node.choose, count: Number(node.count || 1) });
  Object.values(node).forEach((value) => collectChoiceObjects(value, output));
  return output;
}
function collectFixedSpellTokens(node, output = []) {
  if (node == null) return output;
  if (Array.isArray(node)) { node.forEach((value) => collectFixedSpellTokens(value, output)); return output; }
  if (typeof node === "string" && /^[^|]+\|[A-Z0-9]+$/i.test(node)) { output.push(node); return output; }
  if (typeof node !== "object") return output;
  Object.values(node).forEach((value) => collectFixedSpellTokens(value, output));
  return output;
}
function genericAdditionalSpellFields(feat = {}, spells = []) {
  const fields = [];
  const fixedSpellTokens = [];
  array(feat.metadata?.additionalSpells).forEach((entry, entryIndex) => {
    collectFixedSpellTokens(entry, fixedSpellTokens);
    collectChoiceObjects(entry).forEach((choice, choiceIndex) => {
      const options = spellOptions(spells, filterFromChoiceExpression(choice.choose));
      if (options.length) fields.push(field({ id: `spell-${entryIndex + 1}-${choiceIndex + 1}`, label: Number(choice.count || 1) > 1 ? `Choose ${choice.count} spells` : "Choose spell", kind: "spell", count: Number(choice.count || 1), options, replacementCadence: /whenever you gain/i.test(text(feat.description)) ? "level-up" : null }));
    });
  });
  return { fields, fixedSpellTokens: unique(fixedSpellTokens) };
}

function magicInitiateFields(feat, spells) {
  const lists = ["Cleric", "Druid", "Wizard"];
  const listOptions = lists.map((label) => ({ key: slug(label), value: label, label, source: feat.source || "XPHB", kind: "spell-list" }));
  const fields = [field({ id: "spell-list", label: "Spell list", kind: "spell-list", options: listOptions }), field({ id: "spellcasting-ability", label: "Spellcasting ability", kind: "ability", options: ABILITY_OPTIONS.filter((option) => ["int", "wis", "cha"].includes(option.value)) })];
  lists.forEach((className) => {
    const activeWhen = { groupId: `feat-${slug(feat.__instanceId)}`, fieldId: "spell-list", values: [className] };
    fields.push(field({ id: `cantrips-${slug(className)}`, label: `Choose two ${className} cantrips`, kind: "spell", count: 2, options: spellOptions(spells, { level: 0, classes: [className] }), activeWhen, replacementCadence: "level-up" }));
    fields.push(field({ id: `level-1-${slug(className)}`, label: `Choose a level 1 ${className} spell`, kind: "spell", options: spellOptions(spells, { level: 1, classes: [className] }), activeWhen, replacementCadence: "level-up" }));
  });
  return fields;
}

function specialFields(instance, spells, toolRows) {
  const feat = instance.feat || {};
  const name = norm(feat.name);
  const output = [];
  if (name === "ability score improvement") return abilityScoreImprovementFields(instance);
  if (name === "magic initiate") {
    const decorated = { ...feat, __instanceId: instance.instanceId };
    return magicInitiateFields(decorated, spells);
  }
  if (name === "elemental adept") output.push(field({ id: "damage-type", label: "Energy Mastery damage type", kind: "damage-type", options: DAMAGE_TYPE_OPTIONS }));
  if (name === "skilled") {
    const tools = buildToolOptionCatalog(toolRows).all;
    output.push(field({ id: "skills-or-tools", label: "Choose three skills or tools", kind: "skill-or-tool", count: 3, options: [...SKILL_OPTIONS, ...tools] }));
  }
  if (name === "skill expert") output.push(field({ id: "expertise", label: "Choose a proficient skill for Expertise", kind: "expertise", options: SKILL_OPTIONS, metadata: { requiresExistingOrGrantedProficiency: true } }));
  if (name === "resilient") {
    const ability = array(feat.metadata?.ability)?.[0]?.choose;
    const options = array(ability?.from).map((key) => ABILITY_OPTIONS.find((candidate) => candidate.value === key)).filter(Boolean).map((candidate) => ({ ...candidate, metadata: { effect: "ability-increase", amount: 1, secondaryEffect: "saving-throw-proficiency" } }));
    if (options.length) return [field({ id: "resilient-ability", label: "Choose an ability without saving throw proficiency", kind: "ability", options, metadata: { effect: "ability-increase", amount: 1, secondaryEffect: "saving-throw-proficiency" } })];
  }
  return output;
}

function ritualCasterFields(feat, spells, level) {
  if (norm(feat.name) !== "ritual caster") return [];
  return [field({ id: "ritual-spells", label: `Choose ${proficiencyBonusForLevel(level)} level 1 Ritual spells`, kind: "spell", count: proficiencyBonusForLevel(level), options: spellOptions(spells, { level: 1, ritual: true }), metadata: { growsWithProficiencyBonus: true } })];
}

function featHasSpecialSpellShape(feat) {
  return ["magic initiate", "ritual caster"].includes(norm(feat.name));
}
function featUsesSpecialAbilityShape(feat) {
  return ["ability score improvement", "resilient"].includes(norm(feat.name));
}

export function buildFeatSourceChoiceGroups({ featInstances = [], toolRows = [], spells = [], level = 1 } = {}) {
  const groups = [];
  for (const instance of array(featInstances)) {
    const feat = instance.feat;
    if (!feat?.name) continue;
    const ability = featUsesSpecialAbilityShape(feat) ? { fields: [], fixedEffects: [] } : abilityFields(feat);
    const fields = [...ability.fields, ...skillFields(feat), ...toolFields(feat, toolRows), ...specialFields(instance, spells, toolRows), ...ritualCasterFields(feat, spells, level)];
    let fixedSpellTokens = [];
    if (!featHasSpecialSpellShape(feat)) {
      const spellModel = genericAdditionalSpellFields(feat, spells);
      fields.push(...spellModel.fields);
      fixedSpellTokens = spellModel.fixedSpellTokens;
    }
    const byId = new Map();
    for (const candidate of fields) {
      if (!candidate?.id || !candidate.options?.length) continue;
      if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
    }
    const resolvedFields = [...byId.values()];
    if (!resolvedFields.length && !ability.fixedEffects.length && !fixedSpellTokens.length) continue;
    groups.push(group(instance, resolvedFields, { fixedEffects: ability.fixedEffects, fixedSpellTokens }));
  }
  return groups;
}

export function featGrantInstancesFromSelections({ selectedBackgroundFeat = null, speciesBonusFeat = null, speciesChoiceFeats = [], classChoiceFeats = [], featOptions = [] } = {}) {
  const byName = (name, source = "") => array(featOptions).find((feat) => norm(feat.name) === norm(name) && (!source || feat.source === source)) || array(featOptions).find((feat) => norm(feat.name) === norm(name));
  const output = [];
  if (selectedBackgroundFeat) output.push({ instanceId: "background-feat", ownerType: "background", ownerKey: "background-feat", placement: "background", level: 1, acquisitionLabel: "Background feat", feat: selectedBackgroundFeat });
  if (speciesBonusFeat) output.push({ instanceId: "species-bonus-feat", ownerType: "species-bonus", ownerKey: "species-bonus", placement: "abilities", level: 1, acquisitionLabel: "Species Bonus feat", feat: speciesBonusFeat });
  array(speciesChoiceFeats).forEach((entry, index) => {
    const feat = byName(entry.label || entry.name, entry.source);
    if (feat) output.push({ instanceId: `species-${slug(entry.trait || "trait")}-feat-${index + 1}`, ownerType: "species", ownerKey: entry.trait || "species", placement: "species", level: 1, acquisitionLabel: entry.trait || "Species feat", feat });
  });
  array(classChoiceFeats).forEach((entry, index) => {
    const feat = byName(entry.name, entry.source);
    if (feat) output.push({ instanceId: `class-${slug(entry.groupId || entry.groupLabel || "feature")}-feat-${index + 1}`, ownerType: "class", ownerKey: entry.groupId || entry.groupLabel || "class", placement: entry.placement || "class", level: Number(entry.level || 1), acquisitionLabel: entry.groupLabel || "Class feat", feat });
  });
  const seen = new Set();
  return output.filter((instance) => {
    if (seen.has(instance.instanceId)) return false;
    seen.add(instance.instanceId);
    return true;
  });
}

export function featInstanceSummaries(groups = [], selections = {}) {
  return array(groups).filter((group) => group.ownerType === "feat").map((group) => ({
    instanceId: group.metadata?.featInstanceId || group.ownerKey,
    optionId: group.metadata?.featOptionId || null,
    optionKey: group.metadata?.featOptionKey || null,
    name: group.metadata?.featName || group.label,
    source: group.metadata?.featSource || group.source,
    category: group.metadata?.featCategory || null,
    repeatable: Boolean(group.metadata?.repeatable),
    acquisitionOwnerType: group.metadata?.acquisitionOwnerType || null,
    acquisitionOwnerKey: group.metadata?.acquisitionOwnerKey || null,
    acquisitionLabel: group.metadata?.acquisitionLabel || null,
    acquisitionLevel: Number(group.metadata?.acquisitionLevel || group.level || 1),
    fixedEffects: array(group.metadata?.fixedEffects),
    fixedSpellTokens: array(group.metadata?.fixedSpellTokens),
    choices: Object.fromEntries(array(group.fields).map((fieldRow) => [fieldRow.id, sourceChoiceFieldIsActive(fieldRow, selections) ? array(selections?.[group.id]?.[fieldRow.id]).map((key) => {
      const option = fieldRow.options.find((candidate) => candidate.key === key);
      return option ? { key: option.key, value: option.value, label: option.label, kind: option.kind || fieldRow.kind, source: option.source || group.source, metadata: option.metadata || null } : null;
    }).filter(Boolean) : []])),
  }));
}

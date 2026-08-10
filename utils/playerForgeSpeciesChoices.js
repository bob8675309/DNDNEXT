import { ABILITY_LABELS, SKILL_DEFINITIONS } from "./characterCreation";
import { STANDARD_LANGUAGE_OPTIONS } from "./playerForgeSourceChoices";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");
const array = (value) => Array.isArray(value) ? value : [];
const unique = (values = []) => [...new Set(array(values).map(text).filter(Boolean))];

const ABILITY_OPTIONS = Object.freeze(["int", "wis", "cha"].map((value) => ({ key: value, value, label: ABILITY_LABELS[value], kind: "ability", source: "XPHB" })));
const SKILL_OPTIONS = Object.freeze(SKILL_DEFINITIONS.map((skill) => ({ key: skill.key, value: skill.key, label: skill.label, kind: "skill", source: "XPHB", metadata: { ability: skill.ability } })));
const DAMAGE_OPTIONS = Object.freeze(["Acid", "Cold", "Fire", "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder"].map((label) => ({ key: slug(label), value: label, label, kind: "damage-type", source: "XPHB" })));
const AUTO_CASTING_ABILITIES = Object.freeze(["int", "wis", "cha"]);

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
function spellOptions(spells = [], filters = {}) {
  return preferredSpellRows(spells).filter((spell) => {
    if (filters.level != null && Number(spell.level || 0) !== Number(filters.level)) return false;
    if (filters.names?.length && !filters.names.some((wanted) => norm(wanted) === norm(spell.name))) return false;
    if (filters.classes?.length && !filters.classes.some((wanted) => array(spell.classes).some((value) => norm(value) === norm(wanted)))) return false;
    return true;
  }).map((spell) => ({ key: text(spell.id || spell.spell_key || `${slug(spell.name)}|${spell.source || "XPHB"}`), value: text(spell.id || spell.spell_key || spell.name), label: spell.name, kind: "spell", source: spell.source || "XPHB", description: text(spell.description), metadata: { spellId: spell.id || null, spellKey: spell.spell_key || null, level: Number(spell.level || 0), classes: array(spell.classes), school: spell.school || spell.school_code || "", castingTime: spell.casting_time || null, rangeText: spell.range_text || null, durationText: spell.duration_text || null, damageDice: spell.damage_dice || null, damageTypes: array(spell.damage_types) } })).sort((a, b) => a.label.localeCompare(b.label));
}
function option(label, kind = "enum", metadata = null, source = "XPHB") { return { key: slug(label), value: label, label, kind, source, metadata }; }
function field({ id, label, kind, count = 1, options = [], cadence = "creation", replacementCadence = null, activeWhen = null, helper = "", distinctFromFieldId = null, autoSelect = false, metadata = null }) {
  return { id, label, kind, count: Math.max(1, Number(count || 1)), required: true, options, cadence, replacementCadence, activeWhen, helper, distinctFromFieldId, autoSelect, metadata };
}
function group(species, traitNameValue, fields, level = 1, helper = "", placement = "species", metadata = null) {
  return { id: `species-${slug(species.id || species.name)}-${slug(traitNameValue)}`, ownerType: "species", ownerKey: text(species.id || species.name), label: traitNameValue, source: species.source || "XPHB", placement, level: Math.max(1, Number(level || 1)), fields, helper, metadata };
}
function rawTraits(species) { return array(species?.metadata?.traits).filter((entry) => entry && typeof entry === "object"); }
function traitName(trait) { return text(trait?.name || trait?.title || "Species Feature"); }
function flattenStrings(node, output = []) {
  if (node == null) return output;
  if (typeof node === "string") { output.push(node); return output; }
  if (Array.isArray(node)) { node.forEach((entry) => flattenStrings(entry, output)); return output; }
  if (typeof node !== "object") return output;
  if (node.entry) flattenStrings(node.entry, output);
  if (node.entries) flattenStrings(node.entries, output);
  return output;
}
function traitText(trait) { return flattenStrings(trait).join(" ").replace(/\{@[^ ]+\s+([^}|]+)(?:\|[^}]*)?}/g, "$1").replace(/\s+/g, " ").trim(); }
function collectLists(node, output = []) {
  if (node == null) return output;
  if (Array.isArray(node)) { node.forEach((entry) => collectLists(entry, output)); return output; }
  if (typeof node !== "object") return output;
  if (node.type === "list" && Array.isArray(node.items)) output.push(node.items);
  Object.values(node).forEach((entry) => collectLists(entry, output));
  return output;
}
function collectTables(node, output = []) {
  if (node == null) return output;
  if (Array.isArray(node)) { node.forEach((entry) => collectTables(entry, output)); return output; }
  if (typeof node !== "object") return output;
  if (node.type === "table" && Array.isArray(node.rows)) output.push(node);
  Object.values(node).forEach((entry) => collectTables(entry, output));
  return output;
}
function listNames(items = []) { return array(items).map((item) => text(typeof item === "string" ? item : item?.name || item?.entry)).filter(Boolean); }
function tableFirstColumn(table) { return array(table?.rows).map((row) => text(array(row)[0])).filter(Boolean); }
function namedSkills(raw = "") {
  const output = [];
  for (const match of String(raw).matchAll(/\{@skill\s+([^}|]+)(?:\|[^}]*)?}/gi)) {
    const label = text(match[1]);
    const found = SKILL_OPTIONS.find((entry) => norm(entry.label) === norm(label));
    if (found) output.push(found);
  }
  return [...new Map(output.map((entry) => [entry.key, entry])).values()];
}
function namedSpells(trait) {
  const output = [];
  for (const match of JSON.stringify(trait || {}).matchAll(/\{@spell\s+([^}|]+)(?:\|[^}]*)?}/gi)) output.push(text(match[1]));
  return unique(output);
}
function choiceCount(raw = "", fallback = 1) {
  const match = String(raw).match(/(?:gain proficiency (?:with|in)|choose)\s+(one|two|three|four|\d+)\s+(?:of the following\s+)?skills?/i)
    || String(raw).match(/proficiency (?:with|in)\s+(one|two|three|four|\d+)\s+skills?/i);
  const words = { one: 1, two: 2, three: 3, four: 4 };
  return Math.max(1, Number(words[match?.[1]?.toLowerCase()] || match?.[1] || fallback));
}
function spellChoiceCount(raw = "") {
  const match = String(raw).match(/(?:know|learn|choose)\s+(one|two|three|four|\d+)\s+(?:of the following\s+)?cantrips?/i);
  const words = { one: 1, two: 2, three: 3, four: 4 };
  return Math.max(1, Number(words[match?.[1]?.toLowerCase()] || match?.[1] || 1));
}
function abilityChoiceNeeded(raw = "") {
  const value = norm(raw);
  return value.includes("intelligence wisdom or charisma") && (value.includes("choose when you select") || value.includes("choose the ability when you select") || value.includes("spellcasting ability"));
}
function automaticCastingMetadata(raw = "", sourceFeature = "") {
  return abilityChoiceNeeded(raw) ? { autoCastingAbility: true, allowedCastingAbilities: AUTO_CASTING_ABILITIES, sourceFeature } : { sourceFeature };
}
function skillChoiceFromTrait(species, trait, raw) {
  if (!/proficiency/i.test(raw) || !/skill/i.test(raw) || !/(choice|choose)/i.test(raw)) return null;
  const named = namedSkills(JSON.stringify(trait));
  const count = choiceCount(raw, /two skills of your choice/i.test(raw) ? 2 : 1);
  const options = named.length ? named : SKILL_OPTIONS;
  if (!options.length || count > options.length) return null;
  return field({ id: "skills", label: `Choose ${count === 1 ? "skill proficiency" : `${count} skill proficiencies`}`, kind: "skill", count, options: options.map((entry) => ({ ...entry, source: species.source || entry.source })) });
}
function damageChoiceFromTrait(species, trait, raw) {
  if (!/resistance/i.test(raw) || !/(choice|choose)/i.test(raw)) return null;
  const options = DAMAGE_OPTIONS.filter((entry) => new RegExp(`\\b${entry.label}\\b`, "i").test(raw));
  return options.length > 1 ? field({ id: "damage-type", label: "Choose damage resistance", kind: "damage-type", options: options.map((entry) => ({ ...entry, source: species.source || entry.source })) }) : null;
}
function directCantripChoiceField(species, trait, raw, spells) {
  if (!/cantrip/i.test(raw) || !/(of your choice|choose)/i.test(raw)) return null;
  const names = namedSpells(trait);
  const options = spellOptions(spells, { level: 0, names });
  if (options.length < 2) return null;
  const count = Math.min(spellChoiceCount(raw), options.length);
  return field({ id: "spell", label: count === 1 ? "Choose cantrip" : `Choose ${count} cantrips`, kind: "spell", count, options, metadata: automaticCastingMetadata(raw, traitName(trait)) });
}
function fixedSpeciesSpellFields(species, trait, raw, spells, characterLevel) {
  if (/(?:spell|cantrip)[^.]{0,70}(?:of your choice|choose)/i.test(raw) || /one of the following cantrips/i.test(raw)) return [];
  const names = namedSpells(trait);
  if (!names.length) return [];
  return names.flatMap((name, index) => {
    const optionRows = spellOptions(spells, { names: [name] });
    if (optionRows.length !== 1) return [];
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const levelMatch = raw.match(new RegExp(`(?:starting\\s+at|at)\\s+(\\d+)(?:st|nd|rd|th)?\\s+level[^.]{0,180}?${escaped}`, "i"));
    const acquisitionLevel = Math.max(1, Number(levelMatch?.[1] || 1));
    if (Number(characterLevel || 1) < acquisitionLevel) return [];
    return [field({ id: `fixed-spell-${index + 1}`, label: `${name} — automatic species spell`, kind: "spell", count: 1, options: optionRows, autoSelect: true, metadata: { ...automaticCastingMetadata(raw, traitName(trait)), acquisitionLevel, fixedGrant: true } })];
  });
}
function ancestryTableField(species, trait, label, kind) {
  const table = collectTables(trait)[0];
  const names = tableFirstColumn(table);
  if (!names.length) return null;
  const options = names.map((name, index) => option(name, kind, { row: array(table.rows)[index] || null }, species.source || "XPHB"));
  return field({ id: kind, label, kind, options });
}
function lineageAbilityField(species, id = "spellcasting-ability") {
  return field({ id, label: "Spellcasting ability", kind: "ability", options: ABILITY_OPTIONS.map((entry) => ({ ...entry, source: species.source || entry.source })) });
}
function persistentListField(species, trait, id, label, kind = "enum") {
  const names = listNames(collectLists(trait)[0]);
  return names.length > 1 ? field({ id, label, kind, options: names.map((name) => option(name, kind, null, species.source || "XPHB")) }) : null;
}
function sorcererCantrips(species, spells) { return spellOptions(spells, { level: 0, classes: ["Sorcerer"] }).map((entry) => ({ ...entry, source: entry.source || species.source })); }

function explicitTraitGroups(species, trait, level, spells, featOptions) {
  const name = traitName(trait);
  const key = norm(name);
  const raw = traitText(trait);
  const output = [];
  const add = (fields, entryLevel = 1, helper = raw, placement = "species", metadata = null) => { const valid = array(fields).filter(Boolean); if (valid.length) output.push(group(species, name, valid, entryLevel, helper, placement, metadata)); };

  if (key === "draconic ancestry") add([ancestryTableField(species, trait, "Choose Draconic Ancestor", "ancestry")]);
  else if (key === "elven lineage") add([ancestryTableField(species, trait, "Choose Elven Lineage", "lineage"), lineageAbilityField(species)]);
  else if (key === "gnomish lineage") add([persistentListField(species, trait, "lineage", "Choose Gnomish Lineage", "lineage"), lineageAbilityField(species)]);
  else if (key === "fiendish legacy") add([ancestryTableField(species, trait, "Choose Fiendish Legacy", "legacy"), lineageAbilityField(species)]);
  else if (key === "giant ancestry") add([persistentListField(species, trait, "ancestry", "Choose Giant Ancestry", "ancestry")]);
  else if (key === "shifting") add([persistentListField(species, trait, "shifting", "Choose Shifting benefit", "subtype")]);
  else if (key === "kobold legacy") {
    const legacy = persistentListField(species, trait, "legacy", "Choose Kobold Legacy", "legacy");
    const groupId = `species-${slug(species.id || species.name)}-${slug(name)}`;
    const craftiness = namedSkills(JSON.stringify(trait)).filter((entry) => ["arcana", "investigation", "medicine", "sleightOfHand", "survival"].includes(entry.key));
    add([
      legacy,
      field({ id: "craftiness-skill", label: "Craftiness skill", kind: "skill", options: craftiness.map((entry) => ({ ...entry, source: species.source || entry.source })), activeWhen: { groupId, fieldId: "legacy", values: ["Craftiness"] } }),
      field({ id: "sorcery-cantrip", label: "Draconic Sorcery cantrip", kind: "spell", options: sorcererCantrips(species, spells), activeWhen: { groupId, fieldId: "legacy", values: ["Draconic Sorcery"] } }),
      field({ id: "sorcery-ability", label: "Draconic Sorcery ability", kind: "ability", options: ABILITY_OPTIONS.map((entry) => ({ ...entry, source: species.source || entry.source })), activeWhen: { groupId, fieldId: "legacy", values: ["Draconic Sorcery"] } }),
    ]);
  } else if (key === "animal enhancement") {
    const lists = collectLists(trait);
    const first = listNames(lists[0]);
    const later = listNames(lists[1]);
    const fields = [field({ id: "level-1-enhancement", label: "Level 1 Animal Enhancement", kind: "enhancement", options: first.map((value) => option(value, "enhancement", null, species.source || "XPHB")) })];
    if (Number(level || 1) >= 5) fields.push(field({ id: "level-5-enhancement", label: "Level 5 Animal Enhancement", kind: "enhancement", options: unique([...first, ...later]).map((value) => option(value, "enhancement", null, species.source || "XPHB")), distinctFromFieldId: "level-1-enhancement" }));
    add(fields);
  } else if (key === "feat" && /feat.*choice/i.test(raw)) {
    add([field({ id: "feat", label: "Choose qualifying feat", kind: "feat", options: array(featOptions).map((feat) => ({ key: text(feat.id || feat.option_key || `${slug(feat.name)}|${feat.source || "XPHB"}`), value: text(feat.id || feat.option_key || feat.name), label: feat.name, kind: "feat", source: feat.source || "XPHB", description: text(feat.description), metadata: { optionId: feat.id || null, optionKey: feat.option_key || null, category: feat.category || null } })) })]);
  } else if (key === "variable trait" && /darkvision/i.test(raw) && /skill/i.test(raw)) {
    const groupId = `species-${slug(species.id || species.name)}-${slug(name)}`;
    add([
      field({ id: "trait", label: "Choose Variable Trait", kind: "trait", options: [option("Darkvision", "trait", null, species.source || "XPHB"), option("Skill Proficiency", "trait", null, species.source || "XPHB")] }),
      field({ id: "skill", label: "Choose skill proficiency", kind: "skill", options: SKILL_OPTIONS.map((entry) => ({ ...entry, source: species.source || entry.source })), activeWhen: { groupId, fieldId: "trait", values: ["Skill Proficiency"] } }),
    ]);
  } else {
    const spellChoice = directCantripChoiceField(species, trait, raw, spells);
    const fixedSpells = spellChoice ? [] : fixedSpeciesSpellFields(species, trait, raw, spells, level);
    if (spellChoice || fixedSpells.length) {
      add([spellChoice, ...fixedSpells], 1, `${raw} Spell choices for this feature are completed on the Spells step. The Forge automatically uses the highest eligible spellcasting ability after final ability scores are known.`, "spells", automaticCastingMetadata(raw, name));
    } else {
      const skill = skillChoiceFromTrait(species, trait, raw);
      const damage = damageChoiceFromTrait(species, trait, raw);
      const ability = abilityChoiceNeeded(raw) ? lineageAbilityField(species, "feature-ability") : null;
      add([skill, damage, ability]);
    }
  }
  return output;
}

function speciesLanguageGroups(species) {
  const output = [];
  const entries = array(species?.metadata?.languages);
  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const fields = [];
    if (Number(entry.anyStandard || 0) > 0) fields.push(field({ id: "language", label: "Choose Standard language", kind: "language", count: Number(entry.anyStandard), options: STANDARD_LANGUAGE_OPTIONS.map((choice) => ({ ...choice, source: species.source || choice.source })) }));
    const choose = entry.choose && typeof entry.choose === "object" ? entry.choose : null;
    if (choose) {
      let labels = array(choose.from).map((value) => text(value)).filter((value) => value && norm(value) !== "other");
      if (norm(species.name) === "simic hybrid") labels = ["Elvish", "Vedalken"];
      const options = labels.map((label) => option(label.replace(/^./, (letter) => letter.toUpperCase()), "language", null, species.source || "XPHB"));
      if (options.length) fields.push(field({ id: "language-choice", label: "Choose species language", kind: "language", count: Number(choose.count || 1), options }));
    }
    if (fields.length) output.push({ id: `species-${slug(species.id || species.name)}-languages-${index + 1}`, ownerType: "species", ownerKey: text(species.id || species.name), label: "Species languages", source: species.source || "XPHB", placement: "species", level: 1, fields, helper: "This language is granted by the selected species in addition to any source-defined fixed languages." });
  });
  return output;
}

export function buildSpeciesSourceChoiceGroups({ species = null, level = 1, spells = [], featOptions = [], excludedTraitNames = [] } = {}) {
  if (!species) return [];
  const excluded = new Set(array(excludedTraitNames).map(norm));
  const groups = [];
  for (const trait of rawTraits(species)) {
    const name = traitName(trait);
    if (!name || excluded.has(norm(name))) continue;
    if (["astral trance"].includes(norm(name))) continue;
    groups.push(...explicitTraitGroups(species, trait, level, spells, featOptions));
  }
  groups.push(...speciesLanguageGroups(species));
  return groups.filter((candidate) => candidate.fields.some((fieldRow) => fieldRow.options?.length >= fieldRow.count));
}

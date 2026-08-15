import { ABILITY_KEYS, ABILITY_LABELS, SKILL_DEFINITIONS } from "./characterCreation";
import { RARE_LANGUAGE_OPTIONS, STANDARD_LANGUAGE_OPTIONS } from "./playerForgeSourceChoices";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");
const array = (value) => Array.isArray(value) ? value : [];
const uniqueBy = (values = [], keyFor = (value) => value) => [...new Map(values.map((value) => [keyFor(value), value])).values()];
const SUPPORTED_MAGIC_LISTS = Object.freeze(["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"]);
const MAGIC_LIST_ABILITY = Object.freeze({ bard: "cha", cleric: "wis", druid: "wis", sorcerer: "cha", warlock: "cha", wizard: "int" });
const ENVIRONMENTS = Object.freeze(["Arctic", "Coastal", "Desert", "Forest", "Grassland", "Hill and Mountain", "Swamp", "Subterranean", "Underwater"]);
const HERITAGE_DAMAGE_TYPES = Object.freeze(["Acid", "Cold", "Fire", "Lightning", "Poison", "Thunder"]);
const BREATH_AREAS = Object.freeze([
  { key: "line", label: "30-foot line", value: "30-foot line" },
  { key: "cone", label: "15-foot cone", value: "15-foot cone" },
]);

function baseOption(key, label, kind = "enum", metadata = {}) {
  return { key: text(key || slug(label)), value: text(label), label: text(label), kind, source: "GrimHollowPG24", metadata };
}

function slotOption(fieldId, option) {
  return {
    ...option,
    key: `${fieldId}::${option.key}`,
    metadata: { ...(option.metadata || {}), canonicalKey: option.key, hideSource: true },
  };
}

function selectedKeys(selections = {}, groupId = "", fieldId = "") {
  return array(selections?.[groupId]?.[fieldId]).map(text).filter(Boolean);
}

function canonicalKey(fieldId, selectedKey = "") {
  const prefix = `${fieldId}::`;
  return text(selectedKey).startsWith(prefix) ? text(selectedKey).slice(prefix.length) : text(selectedKey);
}

function selectedCanonicals(selections, groupId, fieldId) {
  return selectedKeys(selections, groupId, fieldId).map((key) => canonicalKey(fieldId, key));
}

function preferredRows(rows = [], nameKey, sourceKey) {
  const rank = (source) => source === "XPHB" ? 0 : source === "PHB" ? 1 : 2;
  const byName = new Map();
  for (const row of array(rows)) {
    const name = text(nameKey(row));
    if (!name) continue;
    const key = norm(name);
    const current = byName.get(key);
    const source = text(sourceKey(row));
    if (!current || rank(source) < rank(sourceKey(current))) byName.set(key, row);
  }
  return [...byName.values()];
}

function itemCatalog(rows = []) {
  const preferred = preferredRows(rows, (row) => row.item_name || row.payload?.name, (row) => row.payload?.source || row.source || "");
  const mapItem = (row, kind) => baseOption(
    text(row.item_key || row.payload?.item_key || `${slug(row.item_name || row.payload?.name)}|${row.payload?.source || row.source || "DND"}`),
    row.item_name || row.payload?.name,
    kind,
    { itemKey: row.item_key || row.payload?.item_key || null, itemType: row.item_type || null, sourceType: row.payload?.type || null },
  );
  const mundane = preferred.filter((row) => norm(row.item_rarity) === "mundane");
  const weapons = mundane
    .filter((row) => ["melee weapon", "ranged weapon"].includes(norm(row.item_type)))
    .filter((row) => !/(?:psychic blade|pistol|musket|firearm)/i.test(text(row.item_name || row.payload?.name)))
    .filter((row) => /^(?:M|R)(?:\||$)/i.test(text(row.payload?.type)))
    .map((row) => mapItem(row, "weapon-proficiency"))
    .sort((a, b) => a.label.localeCompare(b.label));
  const tools = mundane.filter((row) => ["tools", "instrument"].includes(norm(row.item_type))).map((row) => mapItem(row, "tool")).sort((a, b) => a.label.localeCompare(b.label));
  const artisan = mundane.filter((row) => norm(row.item_type) === "tools" && /^AT(?:\||$)/i.test(text(row.payload?.type))).map((row) => mapItem(row, "tool")).sort((a, b) => a.label.localeCompare(b.label));
  const instruments = mundane.filter((row) => norm(row.item_type) === "instrument" || /^INS(?:\||$)/i.test(text(row.payload?.type))).map((row) => mapItem(row, "tool")).sort((a, b) => a.label.localeCompare(b.label));
  return { weapons, tools, artisan, instruments };
}

function preferredSpellRows(spells = []) {
  return preferredRows(spells, (spell) => spell.name, (spell) => spell.source || "");
}

function spellBaseOptions(spells = []) {
  return preferredSpellRows(spells).filter((spell) => [0, 1].includes(Number(spell.level || 0))).flatMap((spell) => {
    const classes = array(spell.classes).map((value) => norm(value)).filter((value) => SUPPORTED_MAGIC_LISTS.includes(value));
    if (!classes.length) return [];
    const key = text(spell.id || spell.spell_key || `${slug(spell.name)}|${spell.source || "XPHB"}`);
    return [{
      key,
      value: text(spell.id || spell.spell_key || spell.name),
      label: spell.name,
      kind: "spell",
      source: spell.source || "XPHB",
      description: text(spell.description),
      metadata: { spellId: spell.id || null, spellKey: spell.spell_key || null, level: Number(spell.level || 0), classes },
    }];
  }).sort((a, b) => Number(a.metadata.level) - Number(b.metadata.level) || a.label.localeCompare(b.label));
}

function field({ id, label, kind = "enum", count = 1, options = [], required = true, helper = "", metadata = null }) {
  return { id, label, kind, count: Math.max(1, Number(count || 1)), required, options: options.map((option) => slotOption(id, option)), cadence: "creation", helper, metadata };
}

function priorParentSlots(primaryFields, selections, primaryGroupId, slotIndex, traitKey) {
  return primaryFields.slice(0, slotIndex).flatMap((candidate, index) => selectedKeys(selections, primaryGroupId, candidate.id)[0] === traitKey ? [{ field: candidate, slotIndex: index }] : []);
}

function priorChildCanonicals(selections, supplementalGroupId, parentSlots, suffix) {
  return parentSlots.flatMap(({ field }) => selectedCanonicals(selections, supplementalGroupId, `${field.id}-${suffix}`));
}

function distinctOptions(baseOptions, already = [], current = []) {
  const blocked = new Set(already.filter((key) => !current.includes(key)));
  return baseOptions.filter((option) => !blocked.has(option.key));
}

function abilityOptions() {
  return ABILITY_KEYS.map((key) => baseOption(key, ABILITY_LABELS[key] || key.toUpperCase(), "ability", { ability: key }));
}

function skillOrToolOptions(items) {
  const skills = SKILL_DEFINITIONS.map((skill) => baseOption(`skill:${skill.key}`, skill.label, "proficiency-expertise", { proficiencyKind: "skill", skillKey: skill.key, ability: skill.ability }));
  const tools = items.tools.map((option) => ({ ...option, key: `tool:${option.key}`, kind: "proficiency-expertise", metadata: { ...(option.metadata || {}), proficiencyKind: "tool" } }));
  return [...skills, ...tools].sort((a, b) => a.label.localeCompare(b.label));
}

function languageOptions() {
  return uniqueBy([...STANDARD_LANGUAGE_OPTIONS, ...RARE_LANGUAGE_OPTIONS]
    .filter((option) => norm(option.label) !== "common")
    .map((option) => baseOption(option.key, option.label, "language", { language: option.value || option.label })), (option) => option.key)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function addDistinctChoice(fields, { id, label, kind, count = 1, baseOptions, prior, current, helper, metadata }) {
  fields.push(field({ id, label, kind, count, options: distinctOptions(baseOptions, prior, current), helper, metadata }));
}

export function buildHeritageTraitSubchoiceGroups({ primaryGroup = null, selections = {}, spells = [], itemRows = [] } = {}) {
  if (!primaryGroup?.metadata?.heritageTraitGroup) return [];
  const primaryFields = array(primaryGroup.fields).filter((entry) => entry.kind === "heritage-trait");
  if (!primaryFields.length) return [];
  const supplementalGroupId = `heritage-subchoices-${primaryGroup.id}`;
  const items = itemCatalog(itemRows);
  const spellOptions = spellBaseOptions(spells);
  const abilities = abilityOptions();
  const environments = ENVIRONMENTS.map((label) => baseOption(slug(label), label, "environment"));
  const damageTypes = HERITAGE_DAMAGE_TYPES.map((label) => baseOption(slug(label), label, "damage-type"));
  const languages = languageOptions();
  const masteryOptions = skillOrToolOptions(items);
  const fields = [];

  primaryFields.forEach((parentField, slotIndex) => {
    const selectedTraitKey = selectedKeys(selections, primaryGroup.id, parentField.id)[0] || "";
    if (!selectedTraitKey) return;
    const selectedTrait = array(parentField.options).find((option) => option.key === selectedTraitKey);
    const traitName = selectedTrait?.label || "";
    const previous = priorParentSlots(primaryFields, selections, primaryGroup.id, slotIndex, selectedTraitKey);
    const occurrence = previous.length + 1;
    const meta = (role) => ({ heritageSubchoice: true, heritageSlot: slotIndex + 1, heritageParentFieldId: parentField.id, heritageTraitKey: selectedTraitKey, heritageTraitName: traitName, role, occurrence });

    if (norm(traitName) === "breath weapon") {
      fields.push(field({ id: `${parentField.id}-breath-damage`, label: `${traitName} — damage type`, kind: "damage-type", options: damageTypes, helper: "Choose this Breath Weapon's damage type.", metadata: meta("breath-damage") }));
      fields.push(field({ id: `${parentField.id}-breath-area`, label: `${traitName} — area`, kind: "area", options: BREATH_AREAS.map((entry) => baseOption(entry.key, entry.label, "area")), helper: "Choose a 30-foot line or 15-foot cone for this Breath Weapon.", metadata: meta("breath-area") }));
      return;
    }

    if (norm(traitName) === "damage resistance") {
      const id = `${parentField.id}-damage-resistance`;
      const current = selectedCanonicals(selections, supplementalGroupId, id);
      const firstParent = previous[0]?.field;
      const firstId = firstParent ? `${firstParent.id}-damage-resistance` : "";
      const first = firstId ? selectedCanonicals(selections, supplementalGroupId, firstId)[0] : "";
      const options = occurrence > 1 ? damageTypes.filter((option) => option.key === first || current.includes(option.key)) : damageTypes;
      fields.push(field({ id, label: `${traitName} — damage type`, kind: "damage-type", options, helper: occurrence > 1 ? "The improved trait applies to the same damage type chosen for the first pick." : "Choose Acid, Cold, Fire, Lightning, Poison, or Thunder.", metadata: meta("damage-resistance") }));
      return;
    }

    if (norm(traitName) === "magical fortification") {
      const id = `${parentField.id}-fortification-ability`;
      const current = selectedCanonicals(selections, supplementalGroupId, id);
      const prior = priorChildCanonicals(selections, supplementalGroupId, previous, "fortification-ability");
      addDistinctChoice(fields, { id, label: `${traitName} — ability`, kind: "ability", baseOptions: abilities, prior, current, helper: "Choose a new ability score for each time you take Magical Fortification.", metadata: meta("fortification-ability") });
      return;
    }

    if (norm(traitName) === "weapon aptitude") {
      const id = `${parentField.id}-weapon-proficiencies`;
      const current = selectedCanonicals(selections, supplementalGroupId, id);
      const prior = priorChildCanonicals(selections, supplementalGroupId, previous, "weapon-proficiencies");
      addDistinctChoice(fields, { id, label: `${traitName} — three weapons`, kind: "weapon-proficiency", count: 3, baseOptions: items.weapons, prior, current, helper: "Choose three new weapons for each Weapon Aptitude pick.", metadata: meta("weapon-proficiencies") });
      if (occurrence === 2) fields.push(field({ id: `${parentField.id}-weapon-specialist`, label: "Weapon Specialist — +1 damage weapon", kind: "weapon-specialist", options: items.weapons, helper: "Choose one weapon with which you have proficiency for the improved trait's +1 damage bonus.", metadata: meta("weapon-specialist") }));
      return;
    }

    if (["environmental awareness", "natural camouflage", "natural movement"].includes(norm(traitName))) {
      const suffix = "environment";
      const id = `${parentField.id}-${suffix}`;
      const current = selectedCanonicals(selections, supplementalGroupId, id);
      const prior = priorChildCanonicals(selections, supplementalGroupId, previous, suffix);
      addDistinctChoice(fields, { id, label: `${traitName} — environment`, kind: "environment", baseOptions: environments, prior, current, helper: "Choose a new environment each time you take this trait.", metadata: meta(suffix) });
      return;
    }

    if (norm(traitName) === "artisanal focus") {
      const suffix = "artisan-tool";
      const id = `${parentField.id}-${suffix}`;
      const current = selectedCanonicals(selections, supplementalGroupId, id);
      const prior = priorChildCanonicals(selections, supplementalGroupId, previous, suffix);
      addDistinctChoice(fields, { id, label: `${traitName} — Artisan's Tool`, kind: "tool", baseOptions: items.artisan, prior, current, helper: "Choose a new Artisan's Tool each time you take Artisanal Focus.", metadata: meta(suffix) });
      return;
    }

    if (norm(traitName) === "instrumentalist") {
      const suffix = "instruments";
      const id = `${parentField.id}-${suffix}`;
      const current = selectedCanonicals(selections, supplementalGroupId, id);
      const prior = priorChildCanonicals(selections, supplementalGroupId, previous, suffix);
      addDistinctChoice(fields, { id, label: `${traitName} — two instruments`, kind: "tool", count: 2, baseOptions: items.instruments, prior, current, helper: "Choose two new Musical Instruments each time you take Instrumentalist.", metadata: meta(suffix) });
      return;
    }

    if (norm(traitName) === "masterful aptitude") {
      const suffix = "expertise";
      const id = `${parentField.id}-${suffix}`;
      const current = selectedCanonicals(selections, supplementalGroupId, id);
      const prior = priorChildCanonicals(selections, supplementalGroupId, previous, suffix);
      addDistinctChoice(fields, { id, label: `${traitName} — existing proficiency`, kind: "proficiency-expertise", baseOptions: masteryOptions, prior, current, helper: "Choose a skill or tool you are already proficient with. Each repeat must use a new proficiency.", metadata: meta(suffix) });
      return;
    }

    if (norm(traitName) === "polyglot") {
      const suffix = "languages";
      const id = `${parentField.id}-${suffix}`;
      const current = selectedCanonicals(selections, supplementalGroupId, id);
      const prior = priorChildCanonicals(selections, supplementalGroupId, previous, suffix);
      addDistinctChoice(fields, { id, label: `${traitName} — two languages`, kind: "language", count: 2, baseOptions: languages, prior, current, helper: "Choose two new languages each time you take Polyglot.", metadata: meta(suffix) });
      return;
    }

    if (norm(traitName) === "magical savvy") {
      const spellFieldId = `${parentField.id}-magical-savvy-spell`;
      const listFieldId = `${parentField.id}-magical-savvy-list`;
      const priorSpellKeys = priorChildCanonicals(selections, supplementalGroupId, previous, "magical-savvy-spell");
      const priorLists = priorChildCanonicals(selections, supplementalGroupId, previous, "magical-savvy-list");
      const currentSpell = selectedCanonicals(selections, supplementalGroupId, spellFieldId)[0] || "";
      const candidates = spellOptions.filter((option) => {
        if (priorSpellKeys.includes(option.key) && option.key !== currentSpell) return false;
        if (Number(option.metadata?.level || 0) === 0) return true;
        if (!priorLists.length) return false;
        return array(option.metadata?.classes).some((classKey) => priorLists.includes(classKey));
      });
      fields.push(field({ id: spellFieldId, label: `${traitName} — ${occurrence === 1 ? "cantrip" : "spell"}`, kind: "spell", options: candidates, helper: occurrence === 1 ? "Your first Magical Savvy pick must be a cantrip." : "Choose a different cantrip, or a level 1 spell from a spell list established by one of your earlier Magical Savvy cantrips.", metadata: meta("magical-savvy-spell") }));
      if (currentSpell) {
        const chosenSpell = spellOptions.find((option) => option.key === currentSpell);
        const currentList = selectedCanonicals(selections, supplementalGroupId, listFieldId)[0] || "";
        const validLists = array(chosenSpell?.metadata?.classes).filter((classKey) => Number(chosenSpell?.metadata?.level || 0) === 0 || priorLists.includes(classKey));
        const listOptions = uniqueBy(validLists.map((classKey) => baseOption(classKey, classKey.replace(/^./, (letter) => letter.toUpperCase()), "spell-list", { classKey, castingAbility: MAGIC_LIST_ABILITY[classKey] || null })), (option) => option.key)
          .filter((option) => !currentList || option.key === currentList || validLists.includes(option.key));
        fields.push(field({ id: listFieldId, label: `${traitName} — spell list`, kind: "spell-list", options: listOptions, helper: "Choose the spell list that grants this spell. That list determines its casting ability and controls which level 1 spells later Magical Savvy picks can select.", metadata: meta("magical-savvy-list") }));
      }
    }
  });

  if (!fields.length) return [];
  return [{
    id: supplementalGroupId,
    ownerType: "species",
    ownerKey: primaryGroup.ownerKey,
    label: "Heritage Traits",
    source: "GrimHollowPG24",
    placement: "species",
    level: 1,
    fields,
    helper: "Complete any choices required by the Heritage Traits you selected above.",
    metadata: { heritageTraitSubchoices: true, parentGroupId: primaryGroup.id },
  }];
}

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");
const array = (value) => Array.isArray(value) ? value : [];
const unique = (values = []) => [...new Set(array(values).map(text).filter(Boolean))];

export const SOURCE_CHOICE_CADENCES = Object.freeze([
  "creation", "level-up", "training", "long-rest", "short-rest", "per-use", "informational",
]);

export const STANDARD_LANGUAGE_OPTIONS = Object.freeze([
  "Common Sign Language", "Draconic", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc",
].map((label) => Object.freeze({ key: slug(label), value: label, label, source: "XPHB", kind: "language" })));

export const RARE_LANGUAGE_OPTIONS = Object.freeze([
  "Abyssal", "Celestial", "Deep Speech", "Druidic", "Infernal", "Primordial", "Sylvan", "Thieves' Cant", "Undercommon",
].map((label) => Object.freeze({ key: slug(label), value: label, label, source: "XPHB", kind: "language" })));

const LANGUAGE_BY_NORM = new Map([...STANDARD_LANGUAGE_OPTIONS, ...RARE_LANGUAGE_OPTIONS, { key: "common", value: "Common", label: "Common", source: "XPHB", kind: "language" }].map((option) => [norm(option.label), option]));

function choiceOption(value, overrides = {}) {
  const label = text(overrides.label || value);
  const key = text(overrides.key || slug(label));
  return { key, value: text(overrides.value || label), label, source: overrides.source || "XPHB", kind: overrides.kind || "enum", ...overrides };
}

function sourceField({ id, label, kind, count = 1, required = true, options = [], cadence = "creation", replacementCadence = null, activeWhen = null, helper = "" }) {
  return {
    id: text(id), label: text(label), kind: text(kind || "enum"), count: Math.max(1, Number(count || 1)), required: Boolean(required),
    options: array(options), cadence: SOURCE_CHOICE_CADENCES.includes(cadence) ? cadence : "creation", replacementCadence, activeWhen, helper: text(helper),
  };
}

function sourceGroup({ id, ownerType, ownerKey, label, source = "XPHB", placement = "origin", level = 1, fields = [], helper = "" }) {
  return { id: text(id), ownerType: text(ownerType), ownerKey: text(ownerKey), label: text(label), source: text(source || "XPHB"), placement: text(placement || "origin"), level: Math.max(1, Number(level || 1)), fields: array(fields), helper: text(helper) };
}

function selectedFor(selections = {}, groupId, fieldId) {
  return unique(selections?.[groupId]?.[fieldId] || []);
}

function activeRuleSatisfied(activeWhen, selections = {}) {
  if (!activeWhen) return true;
  const values = selectedFor(selections, activeWhen.groupId, activeWhen.fieldId).map(norm);
  const wanted = array(activeWhen.values).map(norm).filter(Boolean);
  if (!wanted.length) return true;
  return activeWhen.mode === "all" ? wanted.every((value) => values.includes(value)) : wanted.some((value) => values.includes(value));
}

export function sourceChoiceFieldIsActive(field, selections = {}) {
  return activeRuleSatisfied(field?.activeWhen, selections);
}

export function normalizeSourceChoiceSelections(groups = [], selections = {}) {
  const output = {};
  for (const group of array(groups)) {
    output[group.id] = {};
    for (const field of array(group.fields)) {
      const allowed = new Set(array(field.options).map((option) => option.key));
      output[group.id][field.id] = selectedFor(selections, group.id, field.id).filter((key) => allowed.has(key)).slice(0, Number(field.count || 1));
    }
  }
  return output;
}

export function sourceChoiceFieldComplete(group, field, selections = {}) {
  if (!sourceChoiceFieldIsActive(field, selections)) return true;
  if (!field?.required) return true;
  return selectedFor(selections, group.id, field.id).length === Number(field.count || 1);
}

export function sourceChoiceGroupComplete(group, selections = {}) {
  return array(group?.fields).every((field) => sourceChoiceFieldComplete(group, field, selections));
}

export function sourceChoiceGroupsComplete(groups = [], selections = {}, filters = {}) {
  return array(groups).filter((group) => {
    if (filters.placement && group.placement !== filters.placement) return false;
    if (filters.ownerType && group.ownerType !== filters.ownerType) return false;
    if (filters.maxLevel && Number(group.level || 1) > Number(filters.maxLevel)) return false;
    return true;
  }).every((group) => sourceChoiceGroupComplete(group, selections));
}

export function toggleSourceChoiceSelection(groups = [], selections = {}, groupId, fieldId, optionKey) {
  const group = array(groups).find((entry) => entry.id === groupId);
  const field = group?.fields?.find((entry) => entry.id === fieldId);
  if (!group || !field || !sourceChoiceFieldIsActive(field, selections)) return selections;
  if (!field.options.some((option) => option.key === optionKey)) return selections;
  const selected = selectedFor(selections, groupId, fieldId);
  const next = selected.includes(optionKey)
    ? selected.filter((key) => key !== optionKey)
    : selected.length < Number(field.count || 1)
      ? [...selected, optionKey]
      : Number(field.count || 1) === 1 ? [optionKey] : selected;
  return { ...selections, [groupId]: { ...(selections?.[groupId] || {}), [fieldId]: next } };
}

export function setSourceChoiceSelection(groups = [], selections = {}, groupId, fieldId, optionKeys = []) {
  const group = array(groups).find((entry) => entry.id === groupId);
  const field = group?.fields?.find((entry) => entry.id === fieldId);
  if (!group || !field || !sourceChoiceFieldIsActive(field, selections)) return selections;
  const allowed = new Set(field.options.map((option) => option.key));
  const next = unique(optionKeys).filter((key) => allowed.has(key)).slice(0, Number(field.count || 1));
  return { ...selections, [groupId]: { ...(selections?.[groupId] || {}), [fieldId]: next } };
}

export function selectedSourceChoiceOptions(groups = [], selections = {}, filters = {}) {
  const output = [];
  for (const group of array(groups)) {
    if (filters.placement && group.placement !== filters.placement) continue;
    if (filters.ownerType && group.ownerType !== filters.ownerType) continue;
    for (const field of array(group.fields)) {
      if (!sourceChoiceFieldIsActive(field, selections)) continue;
      for (const key of selectedFor(selections, group.id, field.id)) {
        const option = field.options.find((entry) => entry.key === key);
        if (!option) continue;
        output.push({ groupId: group.id, groupLabel: group.label, ownerType: group.ownerType, ownerKey: group.ownerKey, source: group.source, placement: group.placement, level: group.level, fieldId: field.id, fieldLabel: field.label, fieldKind: field.kind, cadence: field.cadence, replacementCadence: field.replacementCadence, ...option });
      }
    }
  }
  return output;
}

export function serializeSourceChoices(groups = [], selections = {}) {
  return Object.fromEntries(array(groups).map((group) => [group.id, {
    ownerType: group.ownerType,
    ownerKey: group.ownerKey,
    label: group.label,
    source: group.source,
    placement: group.placement,
    level: group.level,
    fields: Object.fromEntries(array(group.fields).map((field) => [field.id, {
      label: field.label,
      kind: field.kind,
      count: field.count,
      cadence: field.cadence,
      replacementCadence: field.replacementCadence || null,
      activeWhen: field.activeWhen || null,
      selections: selectedFor(selections, group.id, field.id).map((key) => {
        const option = field.options.find((entry) => entry.key === key);
        return option ? { key: option.key, value: option.value, label: option.label, source: option.source || group.source, kind: option.kind || field.kind, metadata: option.metadata || null } : null;
      }).filter(Boolean),
    }])),
  }]));
}

function sourceSizeOptions(species = {}) {
  const map = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" };
  return unique(species?.size || []).flatMap((raw) => {
    const value = map[text(raw).toUpperCase()] || Object.values(map).find((name) => norm(name) === norm(raw));
    return value ? [choiceOption(value, { kind: "size", source: species.source || "XPHB" })] : [];
  });
}

export function buildOriginLanguageGroup() {
  return sourceGroup({
    id: "origin-standard-languages",
    ownerType: "origin",
    ownerKey: "origin",
    label: "Origin languages",
    source: "XPHB",
    placement: "species",
    helper: "Common is automatic. Choose two additional Standard languages for the character's origin.",
    fields: [sourceField({ id: "languages", label: "Choose two Standard languages", kind: "language", count: 2, options: STANDARD_LANGUAGE_OPTIONS })],
  });
}

export function buildSpeciesSizeGroup(species = null) {
  const options = sourceSizeOptions(species || {});
  if (!species || options.length <= 1) return null;
  return sourceGroup({
    id: `species-${slug(species.id || species.name)}-size`, ownerType: "species", ownerKey: text(species.id || species.name), label: "Character size", source: species.source || "XPHB", placement: "species",
    helper: "Choose one of the sizes allowed by this species.", fields: [sourceField({ id: "size", label: "Size", kind: "size", options })],
  });
}

function preferredToolRows(rows = []) {
  const rank = (source) => source === "XPHB" ? 0 : source === "PHB" ? 1 : 2;
  const byName = new Map();
  for (const row of array(rows)) {
    const name = text(row.item_name || row.payload?.name);
    if (!name) continue;
    const current = byName.get(norm(name));
    const source = row.payload?.source || row.source || "";
    if (!current || rank(source) < rank(current.payload?.source || current.source || "")) byName.set(norm(name), row);
  }
  return [...byName.values()];
}

export function buildToolOptionCatalog(rows = []) {
  const preferred = preferredToolRows(rows);
  const optionFromRow = (row) => choiceOption(row.item_name || row.payload?.name, { key: text(row.item_key || row.payload?.item_key || `${slug(row.item_name || row.payload?.name)}|${row.payload?.source || "XPHB"}`), source: row.payload?.source || "XPHB", kind: "tool", metadata: { itemKey: row.item_key || row.payload?.item_key || null, itemType: row.item_type || row.payload?.uiType || null, sourceType: row.payload?.type || null } });
  const all = preferred.map(optionFromRow).sort((a, b) => a.label.localeCompare(b.label));
  const artisan = all.filter((option) => /^AT(?:\||$)/i.test(text(option.metadata?.sourceType)));
  const instruments = all.filter((option) => /^INS(?:\||$)/i.test(text(option.metadata?.sourceType)) || norm(option.metadata?.itemType) === "instrument");
  const gaming = all.filter((option) => /^GS(?:\||$)/i.test(text(option.metadata?.sourceType)));
  return { all, artisan, instruments, gaming };
}

function toolChoiceDescriptor(key, value, catalog) {
  const count = Math.max(1, Number(value || 1));
  if (key === "anyArtisansTool") return { count, label: `Choose ${count === 1 ? "an" : count} Artisan's Tool${count === 1 ? "" : "s"}`, options: catalog.artisan };
  if (key === "anyMusicalInstrument") return { count, label: `Choose ${count === 1 ? "a" : count} Musical Instrument${count === 1 ? "" : "s"}`, options: catalog.instruments };
  if (key === "anyGamingSet") return { count, label: `Choose ${count === 1 ? "a" : count} Gaming Set${count === 1 ? "" : "s"}`, options: catalog.gaming };
  return null;
}

export function buildBackgroundSourceChoiceGroups(background = null, toolRows = []) {
  if (!background) return [];
  const groups = [];
  const catalog = buildToolOptionCatalog(toolRows);
  const toolEntries = array(background.metadata?.tools || background.rawPayload?.toolProficiencies || background.raw_payload?.toolProficiencies);
  const descriptors = [];
  for (const entry of toolEntries) {
    if (!entry || typeof entry !== "object") continue;
    for (const [key, value] of Object.entries(entry)) {
      const descriptor = toolChoiceDescriptor(key, value, catalog);
      if (descriptor) descriptors.push(descriptor);
    }
  }
  descriptors.forEach((descriptor, index) => {
    if (!descriptor.options.length) return;
    groups.push(sourceGroup({
      id: `background-${slug(background.id || background.name)}-tool-${index + 1}`, ownerType: "background", ownerKey: text(background.id || background.name), label: "Background tool proficiency", source: background.source || "XPHB", placement: "background",
      helper: "This tool proficiency is granted by the selected background and is separate from campaign crafting-profession training.",
      fields: [sourceField({ id: "tools", label: descriptor.label, kind: "tool", count: descriptor.count, options: descriptor.options })],
    }));
  });

  const languageEntries = array(background.metadata?.languages || background.rawPayload?.languageProficiencies || background.raw_payload?.languageProficiencies);
  languageEntries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const choose = entry.choose && typeof entry.choose === "object" ? entry.choose : null;
    const explicit = array(choose?.from).map((name) => LANGUAGE_BY_NORM.get(norm(name))).filter(Boolean);
    if (explicit.length) groups.push(sourceGroup({
      id: `background-${slug(background.id || background.name)}-language-${index + 1}`, ownerType: "background", ownerKey: text(background.id || background.name), label: "Background language", source: background.source || "XPHB", placement: "background",
      fields: [sourceField({ id: "languages", label: "Choose language", kind: "language", count: Number(choose?.count || 1), options: explicit })],
    }));
    if (Number(entry.anyStandard || 0) > 0) groups.push(sourceGroup({
      id: `background-${slug(background.id || background.name)}-standard-language-${index + 1}`, ownerType: "background", ownerKey: text(background.id || background.name), label: "Background Standard language", source: background.source || "XPHB", placement: "background",
      fields: [sourceField({ id: "languages", label: "Choose Standard language", kind: "language", count: Number(entry.anyStandard || 1), options: STANDARD_LANGUAGE_OPTIONS })],
    }));
  });
  return groups;
}

export function buildClassStartingSourceChoiceGroups(classRow = null, toolRows = []) {
  if (!classRow) return [];
  const catalog = buildToolOptionCatalog(toolRows);
  const start = classRow.raw_payload?.starting_proficiencies || classRow.raw_payload?.startingProficiencies || {};
  const sourceText = array(start.tools).map(text).join(" ");
  const profs = array(start.toolProficiencies);
  const descriptors = [];
  if (/choose one/i.test(sourceText) && /artisan/i.test(sourceText) && /musical instrument/i.test(sourceText) && /\bor\b/i.test(sourceText)) {
    descriptors.push({ count: 1, label: "Choose an Artisan's Tool or Musical Instrument", options: [...catalog.artisan, ...catalog.instruments] });
  } else {
    for (const entry of profs) {
      if (!entry || typeof entry !== "object") continue;
      for (const [key, value] of Object.entries(entry)) {
        const descriptor = toolChoiceDescriptor(key, value, catalog);
        if (descriptor) descriptors.push(descriptor);
      }
    }
  }
  return descriptors.flatMap((descriptor, index) => descriptor.options.length ? [sourceGroup({
    id: `class-${slug(classRow.id || classRow.class_key || classRow.class_name)}-starting-tool-${index + 1}`, ownerType: "class", ownerKey: text(classRow.id || classRow.class_key || classRow.class_name), label: "Class starting tool proficiency", source: classRow.source || "XPHB", placement: "training",
    helper: "Choose the starting tool or instrument proficiency granted by the class.",
    fields: [sourceField({ id: "tools", label: descriptor.label, kind: "tool", count: descriptor.count, options: descriptor.options, cadence: "training" })],
  })] : []);
}

export function buildFoundationSourceChoiceGroups({ selectedSpecies = null, selectedBackground = null, selectedClass = null, toolRows = [] } = {}) {
  const groups = [buildOriginLanguageGroup()];
  const sizeGroup = buildSpeciesSizeGroup(selectedSpecies);
  if (sizeGroup) groups.push(sizeGroup);
  groups.push(...buildBackgroundSourceChoiceGroups(selectedBackground, toolRows));
  groups.push(...buildClassStartingSourceChoiceGroups(selectedClass, toolRows));
  return groups;
}

export function foundationChoiceSummary(groups = [], selections = {}) {
  return selectedSourceChoiceOptions(groups, selections).map((entry) => ({
    ownerType: entry.ownerType, ownerKey: entry.ownerKey, groupId: entry.groupId, groupLabel: entry.groupLabel, fieldId: entry.fieldId, fieldLabel: entry.fieldLabel, kind: entry.fieldKind, value: entry.value, label: entry.label, key: entry.key, source: entry.source, placement: entry.placement, cadence: entry.cadence,
  }));
}

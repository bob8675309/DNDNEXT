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

function sourceField({ id, label, kind, count = 1, required = true, options = [], cadence = "creation", replacementCadence = null, activeWhen = null, helper = "", metadata = null, distinctFromFieldId = null, autoSelect = false }) {
  return {
    id: text(id), label: text(label), kind: text(kind || "enum"), count: Math.max(1, Number(count || 1)), required: Boolean(required),
    options: array(options), cadence: SOURCE_CHOICE_CADENCES.includes(cadence) ? cadence : "creation", replacementCadence, activeWhen, helper: text(helper), metadata, distinctFromFieldId, autoSelect: Boolean(autoSelect),
  };
}

function sourceGroup({ id, ownerType, ownerKey, label, source = "XPHB", placement = "origin", level = 1, fields = [], helper = "", metadata = null }) {
  return { id: text(id), ownerType: text(ownerType), ownerKey: text(ownerKey), label: text(label), source: text(source || "XPHB"), placement: text(placement || "origin"), level: Math.max(1, Number(level || 1)), fields: array(fields), helper: text(helper), metadata };
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

function distinctBlockedKeys(field, group, selections = {}) {
  if (!field?.distinctFromFieldId) return new Set();
  return new Set(selectedFor(selections, group.id, field.distinctFromFieldId));
}

function groupRepeatLimits(group) {
  const raw = group?.metadata?.repeatLimits;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
}

function selectedCountInGroup(group, selections, optionKey, exceptFieldId = "") {
  let count = 0;
  for (const field of array(group?.fields)) {
    if (field.id === exceptFieldId || !sourceChoiceFieldIsActive(field, selections)) continue;
    count += selectedFor(selections, group.id, field.id).filter((key) => key === optionKey).length;
  }
  return count;
}

function groupRepeatLimitsSatisfied(group, selections = {}) {
  const limits = groupRepeatLimits(group);
  if (!limits) return true;
  const counts = new Map();
  for (const field of array(group?.fields)) {
    if (!sourceChoiceFieldIsActive(field, selections)) continue;
    for (const key of selectedFor(selections, group.id, field.id)) counts.set(key, Number(counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].every(([key, count]) => count <= Math.max(1, Number(limits[key] || 1)));
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
  for (const group of array(groups)) {
    for (const field of array(group.fields)) {
      if (!sourceChoiceFieldIsActive(field, output)) {
        output[group.id][field.id] = [];
        continue;
      }
      const blocked = distinctBlockedKeys(field, group, output);
      if (blocked.size) output[group.id][field.id] = selectedFor(output, group.id, field.id).filter((key) => !blocked.has(key)).slice(0, Number(field.count || 1));
    }
  }
  return output;
}

export function sourceChoiceFieldComplete(group, field, selections = {}) {
  if (!sourceChoiceFieldIsActive(field, selections)) return true;
  if (!field?.required) return true;
  const selected = selectedFor(selections, group.id, field.id);
  if (selected.length !== Number(field.count || 1)) return false;
  const blocked = distinctBlockedKeys(field, group, selections);
  return !selected.some((key) => blocked.has(key));
}

export function sourceChoiceGroupComplete(group, selections = {}) {
  return array(group?.fields).every((field) => sourceChoiceFieldComplete(group, field, selections))
    && groupRepeatLimitsSatisfied(group, selections);
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
  const blocked = distinctBlockedKeys(field, group, selections);
  if (blocked.has(optionKey)) return selections;
  const selected = selectedFor(selections, groupId, fieldId);
  const repeatLimits = groupRepeatLimits(group);
  if (!selected.includes(optionKey) && repeatLimits) {
    const limit = Math.max(1, Number(repeatLimits[optionKey] || 1));
    if (selectedCountInGroup(group, selections, optionKey, fieldId) >= limit) return selections;
  }
  const next = selected.includes(optionKey)
    ? selected.filter((key) => key !== optionKey)
    : selected.length < Number(field.count || 1)
      ? [...selected, optionKey]
      : Number(field.count || 1) === 1 ? [optionKey] : selected;
  const candidate = { ...selections, [groupId]: { ...(selections?.[groupId] || {}), [fieldId]: next } };
  return normalizeSourceChoiceSelections(groups, candidate);
}

export function setSourceChoiceSelection(groups = [], selections = {}, groupId, fieldId, optionKeys = []) {
  const group = array(groups).find((entry) => entry.id === groupId);
  const field = group?.fields?.find((entry) => entry.id === fieldId);
  if (!group || !field || !sourceChoiceFieldIsActive(field, selections)) return selections;
  const allowed = new Set(field.options.map((option) => option.key));
  const blocked = distinctBlockedKeys(field, group, selections);
  const repeatLimits = groupRepeatLimits(group);
  const next = unique(optionKeys).filter((key) => {
    if (!allowed.has(key) || blocked.has(key)) return false;
    if (!repeatLimits) return true;
    const limit = Math.max(1, Number(repeatLimits[key] || 1));
    return selectedCountInGroup(group, selections, key, fieldId) < limit;
  }).slice(0, Number(field.count || 1));
  const candidate = { ...selections, [groupId]: { ...(selections?.[groupId] || {}), [fieldId]: next } };
  return normalizeSourceChoiceSelections(groups, candidate);
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
        output.push({ groupId: group.id, groupLabel: group.label, groupMetadata: group.metadata || null, ownerType: group.ownerType, ownerKey: group.ownerKey, source: group.source, placement: group.placement, level: group.level, fieldId: field.id, fieldLabel: field.label, fieldKind: field.kind, fieldMetadata: field.metadata || null, cadence: field.cadence, replacementCadence: field.replacementCadence, ...option });
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
    helper: group.helper || null,
    metadata: group.metadata || null,
    fields: Object.fromEntries(array(group.fields).map((field) => [field.id, {
      label: field.label,
      kind: field.kind,
      count: field.count,
      required: Boolean(field.required),
      cadence: field.cadence,
      replacementCadence: field.replacementCadence || null,
      activeWhen: field.activeWhen || null,
      distinctFromFieldId: field.distinctFromFieldId || null,
      metadata: field.metadata || null,
      selections: sourceChoiceFieldIsActive(field, selections) ? selectedFor(selections, group.id, field.id).map((key) => {
        const option = field.options.find((entry) => entry.key === key);
        return option ? { key: option.key, value: option.value, label: option.label, source: option.source || group.source, kind: option.kind || field.kind, metadata: option.metadata || null } : null;
      }).filter(Boolean) : [],
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

function cleanToolRuleText(value = "") {
  return text(value)
    .replace(/\{@dc\s+([^}]+)}/gi, "DC $1")
    .replace(/\{@(?:item|skill|action|condition|variantrule|language)\s+([^|}]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@[^\s}]+\s+([^|}]+)(?:\|[^}]*)?}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function toolRuleFacts(row = {}) {
  const entries = array(row.payload?.entries);
  const items = entries.flatMap((entry) => entry?.type === "list" ? array(entry.items) : []);
  return items.flatMap((item) => {
    const label = cleanToolRuleText(item?.name || "").replace(/:+$/g, "");
    const value = array(item?.entries).map(cleanToolRuleText).filter(Boolean).join(" ");
    return label && value ? [{ label, value }] : [];
  });
}

export function buildToolOptionCatalog(rows = []) {
  const preferred = preferredToolRows(rows);
  const optionFromRow = (row) => {
    const facts = toolRuleFacts(row);
    const useful = facts.filter((fact) => ["utilize", "craft"].includes(norm(fact.label)));
    return choiceOption(row.item_name || row.payload?.name, {
      key: text(row.item_key || row.payload?.item_key || `${slug(row.item_name || row.payload?.name)}|${row.payload?.source || "XPHB"}`),
      source: row.payload?.source || "XPHB",
      kind: "tool",
      description: useful.map((fact) => `${fact.label}: ${fact.value}`).join(" • "),
      metadata: {
        itemKey: row.item_key || row.payload?.item_key || null,
        itemType: row.item_type || row.payload?.uiType || null,
        sourceType: row.payload?.type || null,
        facts,
      },
    });
  };
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

function toolReferenceOptions(reference, catalog) {
  const raw = text(reference);
  const compact = norm(raw).replace(/\s+/g, "");
  if (["anyartisanstool", "anyartisantool", "artisantools", "artisantool"].includes(compact)) return catalog.artisan;
  if (["anymusicalinstrument", "musicalinstrument", "musicalinstruments"].includes(compact)) return catalog.instruments;
  if (["anygamingset", "gamingset", "gamingsets"].includes(compact)) return catalog.gaming;
  const exact = catalog.all.find((option) => norm(option.label) === norm(raw));
  return exact ? [exact] : [];
}

function dedupeToolOptions(options = []) {
  return [...new Map(array(options).map((option) => [option.key, option])).values()];
}

function fallbackToolOption(reference, source = "XPHB") {
  const raw = text(reference);
  if (!raw) return null;
  return choiceOption(raw.replace(/^./, (letter) => letter.toUpperCase()), { kind: "tool", source });
}

function fixedLanguageOptions(entry = {}, source = "XPHB") {
  return Object.entries(entry).flatMap(([key, value]) => {
    if (key === "choose" || key === "anyStandard" || key === "anyExotic" || !(value === true || Number(value) > 0)) return [];
    const option = LANGUAGE_BY_NORM.get(norm(key));
    return option ? [{ ...option, source: source || option.source }] : [];
  });
}

const RUNE_STYLE_OPTIONS = Object.freeze([
  ["wax-clay", "Wax or clay", "Inscribe runes in wax or clay with a fine metal needle."],
  ["carved-wood", "Carved wood", "Whittle wood into small figurines and mark them with runes."],
  ["glass-beads", "Glass beads", "Engrave runes on glass beads and thread them into necklaces or bracelets."],
  ["stitched-cloth", "Stitched clothing", "Stitch runes into the hems of clothing."],
  ["animal-bones", "Animal bones", "Carve runes on animal bones and cast the bones in meaningful formations."],
  ["carved-candles", "Carved candles", "Draw runes into candles, then melt wax to smooth the engravings."],
].map(([key, label, description]) => Object.freeze(choiceOption(label, { key, value: label, source: "BGG", kind: "enum", description }))));

export function buildBackgroundSourceChoiceGroups(background = null, toolRows = []) {
  if (!background) return [];
  const groups = [];
  const backgroundKey = slug(background.id || background.name);
  const backgroundSource = background.source || "XPHB";
  const clanCrafter = norm(background.name || background.sourceName) === "clan crafter";
  const catalog = buildToolOptionCatalog(toolRows);
  const toolEntries = array(background.metadata?.tools || background.rawPayload?.toolProficiencies || background.raw_payload?.toolProficiencies);
  const descriptors = [];
  const fixedTools = [];
  for (const entry of toolEntries) {
    if (!entry || typeof entry !== "object") continue;
    for (const [key, value] of Object.entries(entry)) {
      if (key === "choose") continue;
      const descriptor = toolChoiceDescriptor(key, value, catalog);
      if (descriptor) {
        descriptors.push(descriptor);
        continue;
      }
      if (!(value === true || Number(value) > 0)) continue;
      const resolved = toolReferenceOptions(key, catalog);
      fixedTools.push(...(resolved.length ? resolved : [fallbackToolOption(key, backgroundSource)].filter(Boolean)));
    }
    const choose = entry.choose && typeof entry.choose === "object" ? entry.choose : null;
    if (choose) {
      const options = dedupeToolOptions(array(choose.from).flatMap((reference) => toolReferenceOptions(reference, catalog)));
      const count = Math.max(1, Math.min(options.length || 1, Number(choose.count || 1)));
      if (options.length) descriptors.push({ count, label: count === 1 ? "Choose a tool proficiency" : `Choose ${count} tool proficiencies`, options });
    }
  }
  const craftExpertiseMetadata = clanCrafter ? { campaignRule: "clan-crafter-craft-expertise", craftExpertise: true } : null;
  const uniqueFixedTools = dedupeToolOptions(fixedTools);
  if (uniqueFixedTools.length) groups.push(sourceGroup({
    id: `background-${backgroundKey}-fixed-tools`, ownerType: "background", ownerKey: text(background.id || background.name), label: "Background fixed tool proficiency", source: backgroundSource, placement: "background",
    helper: clanCrafter ? "This tool is granted by Clan Crafter and counts as Expertise on DnDNext crafting checks made with it." : "These tool proficiencies are granted directly by the selected background.",
    metadata: craftExpertiseMetadata,
    fields: [sourceField({ id: "fixed-tools", label: "Granted tools", kind: "tool", count: uniqueFixedTools.length, options: uniqueFixedTools, autoSelect: true })],
  }));
  descriptors.forEach((descriptor, index) => {
    if (!descriptor.options.length) return;
    groups.push(sourceGroup({
      id: `background-${backgroundKey}-tool-${index + 1}`, ownerType: "background", ownerKey: text(background.id || background.name), label: "Background tool proficiency", source: backgroundSource, placement: "background",
      helper: clanCrafter ? "Choose your Clan Crafter artisan's tool. DnDNext treats this selected craft as Expertise for crafting checks." : "This tool proficiency is granted by the selected background and is separate from campaign crafting-profession training.",
      metadata: craftExpertiseMetadata,
      fields: [sourceField({ id: "tools", label: descriptor.label, kind: "tool", count: descriptor.count, options: descriptor.options })],
    }));
  });

  if (norm(background.name || background.sourceName) === "rune carver") groups.push(sourceGroup({
    id: `background-${backgroundKey}-rune-style`,
    ownerType: "background",
    ownerKey: text(background.id || background.name),
    label: "Rune Styles",
    source: backgroundSource || "BGG",
    placement: "background",
    helper: "Choose the physical medium and style your character normally uses to make runes. This is a persistent roleplaying choice, not a limitation on Rune Shaper magic.",
    metadata: { flavorChoice: true, family: "rune-style" },
    fields: [sourceField({ id: "rune-style", label: "Rune style and medium", kind: "enum", options: RUNE_STYLE_OPTIONS })],
  }));

  const languageEntries = array(background.metadata?.languages || background.rawPayload?.languageProficiencies || background.raw_payload?.languageProficiencies);
  languageEntries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const fixed = fixedLanguageOptions(entry, backgroundSource);
    const fixedKeys = new Set(fixed.map((option) => option.key));
    if (fixed.length) groups.push(sourceGroup({
      id: `background-${backgroundKey}-fixed-language-${index + 1}`, ownerType: "background", ownerKey: text(background.id || background.name), label: "Background fixed language", source: backgroundSource, placement: "background",
      helper: "These languages are granted directly by the selected background source.",
      fields: [sourceField({ id: "fixed-languages", label: "Granted languages", kind: "language", count: fixed.length, options: fixed, autoSelect: true })],
    }));
    const choose = entry.choose && typeof entry.choose === "object" ? entry.choose : null;
    const explicit = array(choose?.from).map((name) => LANGUAGE_BY_NORM.get(norm(name))).filter((option) => option && !fixedKeys.has(option.key));
    if (explicit.length) groups.push(sourceGroup({
      id: `background-${backgroundKey}-language-${index + 1}`, ownerType: "background", ownerKey: text(background.id || background.name), label: "Background language", source: backgroundSource, placement: "background",
      fields: [sourceField({ id: "languages", label: "Choose language", kind: "language", count: Math.max(1, Math.min(explicit.length, Number(choose?.count || 1))), options: explicit })],
    }));
    if (Number(entry.anyStandard || 0) > 0) {
      const standardOptions = STANDARD_LANGUAGE_OPTIONS.filter((option) => !fixedKeys.has(option.key));
      groups.push(sourceGroup({
        id: `background-${backgroundKey}-standard-language-${index + 1}`, ownerType: "background", ownerKey: text(background.id || background.name), label: "Background Standard language", source: backgroundSource, placement: "background",
        fields: [sourceField({ id: "languages", label: "Choose Standard language", kind: "language", count: Math.max(1, Math.min(standardOptions.length, Number(entry.anyStandard || 1))), options: standardOptions })],
      }));
    }
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
    ownerType: entry.ownerType, ownerKey: entry.ownerKey, groupId: entry.groupId, groupLabel: entry.groupLabel, groupMetadata: entry.groupMetadata || null, fieldId: entry.fieldId, fieldLabel: entry.fieldLabel, fieldMetadata: entry.fieldMetadata || null, kind: entry.fieldKind, value: entry.value, label: entry.label, key: entry.key, source: entry.source, placement: entry.placement, level: entry.level, cadence: entry.cadence, replacementCadence: entry.replacementCadence || null, metadata: entry.metadata || null,
  }));
}

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const array = (value) => Array.isArray(value) ? value : [];
const unique = (values) => [...new Set(array(values).map(text).filter(Boolean))];

export const XPHB_INVOCATION_SLOT_LEVELS = Object.freeze([1, 2, 2, 5, 5, 7, 9, 12, 15, 18]);

function sourceRank(source) {
  if (source === "XPHB") return 0;
  if (source === "PHB") return 1;
  return 2;
}

function preferredSpells(rows = []) {
  const byName = new Map();
  for (const row of array(rows)) {
    if (Number(row?.level || 0) !== 0 || !array(row?.classes).some((name) => norm(name) === "warlock")) continue;
    const key = norm(row.name);
    if (!key) continue;
    const current = byName.get(key);
    if (!current || sourceRank(row.source) < sourceRank(current.source)) byName.set(key, row);
  }
  return [...byName.values()];
}

function spellOption(row) {
  return {
    key: text(row.id || row.spell_key || `${norm(row.name)}|${row.source || "XPHB"}`),
    value: text(row.id || row.spell_key || row.name),
    label: row.name,
    source: row.source || "XPHB",
    kind: "spell",
    description: text(row.description),
    metadata: {
      spellId: row.id || null,
      spellKey: row.spell_key || null,
      level: Number(row.level || 0),
      rangeText: row.range_text || null,
      rangeDistance: row.range_distance == null ? null : Number(row.range_distance),
      rangeUnit: row.range_unit || null,
      attackType: row.attack_type || null,
      damageDice: row.damage_dice || null,
      damageTypes: array(row.damage_types),
    },
  };
}

function damageCantrips(spells = [], { attackOnly = false, minRangeFeet = 0 } = {}) {
  return preferredSpells(spells).filter((row) => {
    const hasDamage = array(row.damage_types).length > 0 || text(row.damage_dice);
    if (!hasDamage) return false;
    if (attackOnly && !text(row.attack_type)) return false;
    if (minRangeFeet > 0) {
      const unit = norm(row.range_unit);
      const distance = Number(row.range_distance || 0);
      if (unit === "feet" || unit === "foot" || unit === "ft") return distance >= minRangeFeet;
      if (unit === "miles" || unit === "mile") return distance > 0;
      return false;
    }
    return true;
  }).map(spellOption).sort((a, b) => a.label.localeCompare(b.label));
}

function featOption(row) {
  return {
    key: text(row.id || row.option_key || `${norm(row.name)}|${row.source || "XPHB"}`),
    value: text(row.id || row.option_key || row.name),
    label: row.name,
    source: row.source || "XPHB",
    kind: "feat",
    description: text(row.description),
    metadata: {
      optionId: row.id || null,
      optionKey: row.option_key || null,
      category: row.category || null,
    },
  };
}

function invocationOption(row) {
  return {
    key: row.option_key,
    value: row.option_key,
    label: row.name,
    source: row.source || "XPHB",
    kind: "eldritch-invocation",
    description: text(row.description),
    metadata: {
      optionId: row.id || null,
      optionKey: row.option_key,
      repeatable: Boolean(row.repeatable),
      prerequisites: row.prerequisites || {},
      choiceSchema: row.choice_schema || {},
    },
  };
}

function selectedOption(group, selections, fieldId = "invocation") {
  const key = array(selections?.[group.id]?.[fieldId])[0];
  if (!key) return null;
  return array(group.fields).find((field) => field.id === fieldId)?.options?.find((option) => option.key === key) || null;
}

function previousSelections(groups, selections, beforeIndex) {
  const selected = [];
  for (let index = 0; index < beforeIndex; index += 1) {
    const group = groups[index];
    const invocation = selectedOption(group, selections);
    if (!invocation) continue;
    selected.push({ group, invocation });
  }
  return selected;
}

function childField({ groupId, invocation, spells, featOptions, priorChildren }) {
  const schema = invocation.metadata?.choiceSchema || {};
  const activeWhen = { groupId, fieldId: "invocation", values: [invocation.key] };
  const priorForInvocation = priorChildren.get(norm(invocation.label)) || new Set();
  if (schema.kind === "warlock-damage-cantrip") {
    const options = damageCantrips(spells, { minRangeFeet: Number(schema.minRangeFeet || 0) })
      .filter((option) => !schema.distinctPerRepeat || !priorForInvocation.has(option.key));
    return { id: `child-${norm(invocation.label).replace(/\s+/g, "-")}`, label: `${invocation.label}: affected cantrip`, kind: "spell", count: 1, required: true, options, cadence: "creation", activeWhen, metadata: { invocationOptionKey: invocation.key } };
  }
  if (schema.kind === "warlock-attack-cantrip") {
    const options = damageCantrips(spells, { attackOnly: true })
      .filter((option) => !schema.distinctPerRepeat || !priorForInvocation.has(option.key));
    return { id: `child-${norm(invocation.label).replace(/\s+/g, "-")}`, label: `${invocation.label}: affected cantrip`, kind: "spell", count: 1, required: true, options, cadence: "creation", activeWhen, metadata: { invocationOptionKey: invocation.key } };
  }
  if (schema.kind === "origin-feat") {
    const options = array(featOptions).filter((row) => row.option_type === "feat" && row.category === (schema.category || "O"))
      .map(featOption)
      .filter((option) => !schema.distinctPerRepeat || !priorForInvocation.has(option.key));
    return { id: `child-${norm(invocation.label).replace(/\s+/g, "-")}`, label: `${invocation.label}: Origin feat`, kind: "feat", count: 1, required: true, options, cadence: "creation", activeWhen, metadata: { invocationOptionKey: invocation.key, featCategory: schema.category || "O" } };
  }
  return null;
}

function knownNames(entries = []) {
  return new Set(entries.map((entry) => norm(entry.invocation.label)));
}

function requiredNames(row) {
  return array(row?.prerequisites?.requiresOptions).map(norm).filter(Boolean);
}

function selectedChildKey(group, selections) {
  const invocation = selectedOption(group, selections);
  if (!invocation) return null;
  const child = array(group.fields).find((field) => field.id !== "invocation" && field.activeWhen?.values?.includes(invocation.key));
  return child ? array(selections?.[group.id]?.[child.id])[0] || null : null;
}

export function buildWarlockInvocationSourceGroups({ selectedClass = null, level = 1, optionRows = [], spells = [], featOptions = [], selections = {} } = {}) {
  if (norm(selectedClass?.class_key) !== "warlock" || text(selectedClass?.source).toUpperCase() !== "XPHB") return [];
  const targetLevel = Math.max(1, Math.min(20, Number(level || 1)));
  const slotLevels = XPHB_INVOCATION_SLOT_LEVELS.filter((entryLevel) => entryLevel <= targetLevel);
  const catalogue = array(optionRows).filter((row) => row.option_type === "eldritch-invocation" && row.source === "XPHB" && (!row.class_key || norm(row.class_key) === "warlock"));
  if (!slotLevels.length || !catalogue.length) return [];

  const groups = [];
  const priorChildren = new Map();
  for (let index = 0; index < slotLevels.length; index += 1) {
    const slotLevel = slotLevels[index];
    const prior = previousSelections(groups, selections, index);
    const priorNames = knownNames(prior);
    const groupId = `warlock-invocation-slot-${index + 1}`;
    const currentSelection = array(selections?.[groupId]?.invocation)[0] || "";
    const options = catalogue.filter((row) => {
      const minimum = Math.max(1, Number(row.prerequisites?.minClassLevel || 1));
      if (minimum > slotLevel && row.option_key !== currentSelection) return false;
      if (!row.repeatable && priorNames.has(norm(row.name)) && row.option_key !== currentSelection) return false;
      const requirements = requiredNames(row);
      if (requirements.length && !requirements.every((name) => priorNames.has(name)) && row.option_key !== currentSelection) return false;
      return true;
    }).map(invocationOption).sort((a, b) => a.label.localeCompare(b.label));

    const selectedInvocation = options.find((option) => option.key === currentSelection) || null;
    const fields = [{
      id: "invocation",
      label: `Invocation ${index + 1}`,
      kind: "eldritch-invocation",
      count: 1,
      required: true,
      options,
      cadence: "creation",
      replacementCadence: "level-up",
      metadata: { slot: index + 1, acquisitionLevel: slotLevel },
    }];

    const candidates = selectedInvocation ? [selectedInvocation] : options.filter((option) => Object.keys(option.metadata?.choiceSchema || {}).length > 0);
    for (const invocation of candidates) {
      const child = childField({ groupId, invocation, spells, featOptions, priorChildren });
      if (child) fields.push(child);
    }

    const group = {
      id: groupId,
      ownerType: "class-option",
      ownerKey: `warlock-invocation-${index + 1}`,
      label: `Eldritch Invocation ${index + 1}`,
      source: "XPHB",
      placement: "class",
      level: slotLevel,
      helper: `Invocation slot gained at Warlock level ${slotLevel}. Later level-up replacement is tracked separately from this acquisition.`,
      fields,
      metadata: { family: "eldritch-invocation", slot: index + 1, acquisitionLevel: slotLevel },
    };
    groups.push(group);

    const invocation = selectedInvocation || selectedOption(group, selections);
    const childKey = selectedChildKey(group, selections);
    if (invocation && childKey) {
      const key = norm(invocation.label);
      if (!priorChildren.has(key)) priorChildren.set(key, new Set());
      priorChildren.get(key).add(childKey);
    }
  }
  return groups;
}

export function warlockInvocationSelections(groups = [], selections = {}) {
  return array(groups).flatMap((group) => {
    if (group.metadata?.family !== "eldritch-invocation") return [];
    const invocation = selectedOption(group, selections);
    if (!invocation) return [];
    const child = array(group.fields).find((field) => field.id !== "invocation" && field.activeWhen?.values?.includes(invocation.key));
    const childKey = child ? array(selections?.[group.id]?.[child.id])[0] || null : null;
    const childOption = childKey ? child.options.find((option) => option.key === childKey) || null : null;
    return [{
      instanceId: group.ownerKey,
      slot: group.metadata?.slot || null,
      acquisitionLevel: group.metadata?.acquisitionLevel || group.level,
      optionKey: invocation.metadata?.optionKey || invocation.key,
      optionId: invocation.metadata?.optionId || null,
      name: invocation.label,
      source: invocation.source,
      repeatable: Boolean(invocation.metadata?.repeatable),
      child: childOption ? { fieldId: child.id, kind: child.kind, key: childOption.key, value: childOption.value, label: childOption.label, source: childOption.source, metadata: childOption.metadata || null } : null,
    }];
  });
}

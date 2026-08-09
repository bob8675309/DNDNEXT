const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const array = (value) => Array.isArray(value) ? value : [];

export const EFA_ARTIFICER_PLAN_SLOT_LEVELS = Object.freeze([2, 2, 2, 2, 6, 10, 14, 18]);

function sourceRank(source = "") {
  const key = text(source).toUpperCase();
  if (key === "XDMG") return 0;
  if (key === "EFA") return 1;
  if (key === "DMG") return 2;
  return 3;
}

function preferredMagicItems(rows = []) {
  const byName = new Map();
  for (const row of array(rows)) {
    const name = text(row?.item_name || row?.payload?.name);
    if (!name) continue;
    const key = norm(name);
    const source = text(row?.payload?.source || row?.source);
    const current = byName.get(key);
    if (!current || sourceRank(source) < sourceRank(current?.payload?.source || current?.source)) byName.set(key, row);
  }
  return [...byName.values()];
}

function cursed(row) {
  const value = row?.payload?.curse;
  return value === true || text(value).toLowerCase() === "true";
}

function itemMatchesSchema(row, schema = {}) {
  const rarity = norm(row?.item_rarity || row?.payload?.rarity);
  const type = norm(row?.item_type || row?.payload?.uiType);
  if (schema.rarity && rarity !== norm(schema.rarity)) return false;
  if (schema.excludeCursed && cursed(row)) return false;
  if (schema.itemType) {
    const wondrous = row?.payload?.wondrous === true || type === norm(schema.itemType);
    if (norm(schema.itemType) === "wondrous item" ? !wondrous : type !== norm(schema.itemType)) return false;
  }
  for (const excluded of array(schema.excludeTypes)) {
    if (type.includes(norm(excluded))) return false;
  }
  return true;
}

function itemOption(row) {
  const source = text(row?.payload?.source || row?.source || "CAMPAIGN");
  const id = text(row?.id || row?.item_key || row?.payload?.item_key);
  return {
    key: id,
    value: id,
    label: text(row?.item_name || row?.payload?.name),
    source,
    kind: "item",
    description: text(row?.payload?.rulesShort || row?.payload?.item_description || row?.payload?.description),
    metadata: {
      itemId: row?.id || null,
      itemKey: row?.item_key || row?.payload?.item_key || null,
      itemType: row?.item_type || row?.payload?.uiType || null,
      rarity: row?.item_rarity || row?.payload?.rarity || null,
      source,
    },
  };
}

function planOption(row) {
  return {
    key: row.option_key,
    value: row.option_key,
    label: row.name,
    source: row.source || "EFA",
    kind: "artificer-plan",
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

function selectedOption(group, selections, fieldId = "plan") {
  const key = array(selections?.[group.id]?.[fieldId])[0];
  if (!key) return null;
  return array(group.fields).find((field) => field.id === fieldId)?.options?.find((option) => option.key === key) || null;
}

function selectedChild(group, selections, plan) {
  if (!plan) return null;
  const child = array(group.fields).find((field) => field.id !== "plan" && field.activeWhen?.values?.includes(plan.key));
  const key = child ? array(selections?.[group.id]?.[child.id])[0] : null;
  return key ? child.options?.find((option) => option.key === key) || null : null;
}

function priorState(groups, selections, beforeIndex) {
  const planNames = new Set();
  const wildcardItems = new Map();
  for (let index = 0; index < beforeIndex; index += 1) {
    const group = groups[index];
    const plan = selectedOption(group, selections);
    if (!plan) continue;
    planNames.add(norm(plan.label));
    const child = selectedChild(group, selections, plan);
    if (!child) continue;
    const key = norm(plan.label);
    if (!wildcardItems.has(key)) wildcardItems.set(key, new Set());
    wildcardItems.get(key).add(child.key);
  }
  return { planNames, wildcardItems };
}

function childField({ groupId, plan, itemRows, priorItems }) {
  const schema = plan.metadata?.choiceSchema || {};
  if (schema.kind !== "magic-item") return null;
  const used = priorItems.get(norm(plan.label)) || new Set();
  const options = preferredMagicItems(itemRows)
    .filter((row) => itemMatchesSchema(row, schema))
    .map(itemOption)
    .filter((option) => !schema.distinctPerRepeat || !used.has(option.key))
    .sort((a, b) => a.label.localeCompare(b.label) || a.source.localeCompare(b.source));
  return {
    id: `item-${norm(plan.label).replace(/\s+/g, "-")}`,
    label: `${plan.label}: concrete magic item`,
    kind: "item",
    count: 1,
    required: true,
    options,
    cadence: "creation",
    activeWhen: { groupId, fieldId: "plan", values: [plan.key] },
    metadata: { planOptionKey: plan.key, choiceSchema: schema },
  };
}

export function buildArtificerPlanSourceGroups({ selectedClass = null, level = 1, optionRows = [], itemRows = [], selections = {} } = {}) {
  if (norm(selectedClass?.class_key) !== "artificer" || text(selectedClass?.source).toUpperCase() !== "EFA") return [];
  const targetLevel = Math.max(1, Math.min(20, Number(level || 1)));
  const slotLevels = EFA_ARTIFICER_PLAN_SLOT_LEVELS.filter((entryLevel) => entryLevel <= targetLevel);
  const catalogue = array(optionRows).filter((row) => row.option_type === "artificer-plan" && row.source === "EFA" && norm(row.class_key) === "artificer");
  if (!slotLevels.length || !catalogue.length) return [];

  const groups = [];
  for (let index = 0; index < slotLevels.length; index += 1) {
    const slotLevel = slotLevels[index];
    const groupId = `artificer-plan-slot-${index + 1}`;
    const currentPlanKey = array(selections?.[groupId]?.plan)[0] || "";
    const prior = priorState(groups, selections, index);
    const options = catalogue.filter((row) => {
      const minimum = Math.max(1, Number(row.prerequisites?.minClassLevel || 1));
      if (minimum > targetLevel && row.option_key !== currentPlanKey) return false;
      if (!row.repeatable && prior.planNames.has(norm(row.name)) && row.option_key !== currentPlanKey) return false;
      return true;
    }).map(planOption).sort((a, b) => Number(a.metadata?.prerequisites?.minClassLevel || 1) - Number(b.metadata?.prerequisites?.minClassLevel || 1) || a.label.localeCompare(b.label));

    const selectedPlan = options.find((option) => option.key === currentPlanKey) || null;
    const fields = [{
      id: "plan",
      label: `Magic Item Plan ${index + 1}`,
      kind: "artificer-plan",
      count: 1,
      required: true,
      options,
      cadence: "creation",
      replacementCadence: "level-up",
      metadata: { slot: index + 1, slotAcquisitionLevel: slotLevel },
    }];

    const candidates = selectedPlan ? [selectedPlan] : options.filter((option) => option.metadata?.choiceSchema?.kind === "magic-item");
    for (const plan of candidates) {
      const child = childField({ groupId, plan, itemRows, priorItems: prior.wildcardItems });
      if (child) fields.push(child);
    }

    groups.push({
      id: groupId,
      ownerType: "class-option",
      ownerKey: `artificer-plan-${index + 1}`,
      label: `Magic Item Plan ${index + 1}`,
      source: "EFA",
      placement: "class",
      level: slotLevel,
      helper: `Plan slot originally gained at Artificer level ${slotLevel}. The selected plan must be legal for this starting level; wildcard plans also require one concrete canonical magic item.`,
      fields,
      metadata: { family: "artificer-plan", slot: index + 1, acquisitionLevel: slotLevel, startingLevel: targetLevel },
    });
  }
  return groups;
}

export function artificerPlanSelections(groups = [], selections = {}) {
  return array(groups).flatMap((group) => {
    if (group.metadata?.family !== "artificer-plan") return [];
    const plan = selectedOption(group, selections);
    if (!plan) return [];
    const child = selectedChild(group, selections, plan);
    return [{
      instanceId: group.ownerKey,
      slot: group.metadata?.slot || null,
      acquisitionLevel: group.metadata?.acquisitionLevel || group.level,
      optionKey: plan.metadata?.optionKey || plan.key,
      optionId: plan.metadata?.optionId || null,
      name: plan.label,
      source: plan.source,
      repeatable: Boolean(plan.metadata?.repeatable),
      child: child ? { kind: "item", key: child.key, value: child.value, label: child.label, source: child.source, metadata: child.metadata || null } : null,
    }];
  });
}

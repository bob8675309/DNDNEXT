import { bestEligibleCastingAbility } from "./playerForgeAutomaticCasting";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");
const array = (value) => Array.isArray(value) ? value : [];

const AUTO_CASTING_ABILITIES = Object.freeze(["int", "wis", "cha"]);
const STRIXHAVEN_COLLEGES = Object.freeze({
  lorehold: Object.freeze({ label: "Lorehold", cantrips: ["Light", "Sacred Flame", "Thaumaturgy"], classes: ["Cleric", "Wizard"] }),
  prismari: Object.freeze({ label: "Prismari", cantrips: ["Fire Bolt", "Prestidigitation", "Ray of Frost"], classes: ["Bard", "Sorcerer"] }),
  quandrix: Object.freeze({ label: "Quandrix", cantrips: ["Druidcraft", "Guidance", "Mage Hand"], classes: ["Druid", "Wizard"] }),
  silverquill: Object.freeze({ label: "Silverquill", cantrips: ["Sacred Flame", "Thaumaturgy", "Vicious Mockery"], classes: ["Bard", "Cleric"] }),
  witherbloom: Object.freeze({ label: "Witherbloom", cantrips: ["Chill Touch", "Druidcraft", "Spare the Dying"], classes: ["Druid", "Wizard"] }),
});

function sourceRank(source = "") {
  if (source === "XPHB") return 0;
  if (source === "PHB") return 1;
  return 2;
}

function preferredSpellRows(rows = []) {
  const byName = new Map();
  for (const row of array(rows)) {
    const key = norm(row?.name);
    if (!key) continue;
    const current = byName.get(key);
    if (!current || sourceRank(row.source) < sourceRank(current.source)) byName.set(key, row);
  }
  return [...byName.values()];
}

function spellOption(row) {
  return {
    key: text(row.id || row.spell_key || `${slug(row.name)}|${row.source || "XPHB"}`),
    value: text(row.id || row.spell_key || row.name),
    label: row.name,
    source: row.source || "XPHB",
    kind: "spell",
    description: text(row.description),
    metadata: {
      spellId: row.id || null,
      spellKey: row.spell_key || null,
      level: Number(row.level || 0),
      school: row.school || row.school_code || "",
      classes: array(row.classes),
      castingTime: row.casting_time || null,
      rangeText: row.range_text || null,
      durationText: row.duration_text || null,
      damageDice: row.damage_dice || null,
      damageTypes: array(row.damage_types),
    },
  };
}

function spellOptions(spells = [], { level = null, names = [], classes = [] } = {}) {
  const wantedNames = new Set(array(names).map(norm));
  const wantedClasses = new Set(array(classes).map(norm));
  return preferredSpellRows(spells).filter((row) => {
    if (level != null && Number(row.level || 0) !== Number(level)) return false;
    if (wantedNames.size && !wantedNames.has(norm(row.name))) return false;
    if (wantedClasses.size && !array(row.classes).some((entry) => wantedClasses.has(norm(entry)))) return false;
    return true;
  }).map(spellOption).sort((a, b) => Number(a.metadata.level) - Number(b.metadata.level) || a.label.localeCompare(b.label));
}

function fixedCollegeForBackground(background = null) {
  const name = norm(background?.name || background?.sourceName || "");
  return Object.entries(STRIXHAVEN_COLLEGES).find(([key]) => name.includes(key))?.[0] || "";
}

function strixhavenFields(group, spells, fixedCollege = "") {
  const groupId = group.id;
  const collegeField = fixedCollege ? [] : [{
    id: "college",
    label: "Choose Strixhaven college",
    kind: "enum",
    count: 1,
    required: true,
    options: Object.entries(STRIXHAVEN_COLLEGES).map(([key, entry]) => ({ key, value: entry.label, label: entry.label, source: group.source || "SCC", kind: "enum" })),
    cadence: "creation",
  }];
  const collegeKeys = fixedCollege ? [fixedCollege] : Object.keys(STRIXHAVEN_COLLEGES);
  const spellFields = collegeKeys.flatMap((collegeKey) => {
    const college = STRIXHAVEN_COLLEGES[collegeKey];
    const activeWhen = fixedCollege ? null : { groupId, fieldId: "college", values: [collegeKey] };
    return [
      {
        id: `cantrips-${collegeKey}`,
        label: `${college.label}: choose two cantrips`,
        kind: "spell",
        count: 2,
        required: true,
        options: spellOptions(spells, { level: 0, names: college.cantrips }),
        cadence: "creation",
        activeWhen,
        metadata: { college: college.label, autoCastingAbility: true, allowedCastingAbilities: AUTO_CASTING_ABILITIES },
      },
      {
        id: `level-1-${collegeKey}`,
        label: `${college.label}: choose one level 1 ${college.classes.join(" or ")} spell`,
        kind: "spell",
        count: 1,
        required: true,
        options: spellOptions(spells, { level: 1, classes: college.classes }),
        cadence: "creation",
        activeWhen,
        metadata: { college: college.label, autoCastingAbility: true, allowedCastingAbilities: AUTO_CASTING_ABILITIES },
      },
    ];
  });
  return [...collegeField, ...spellFields];
}

function routeStrixhaven(group, selectedBackground, spells) {
  const fixedCollege = fixedCollegeForBackground(selectedBackground);
  const school = fixedCollege ? STRIXHAVEN_COLLEGES[fixedCollege] : null;
  return {
    ...group,
    placement: "spells",
    resolverPlacement: "spells",
    helper: fixedCollege
      ? `${school.label} is fixed by ${selectedBackground?.name || "the selected background"}. Choose only the spells granted by that college on this step.`
      : "Choose the Strixhaven college, then choose only the spells granted by that college.",
    fields: strixhavenFields(group, spells, fixedCollege),
    metadata: {
      ...(group.metadata || {}),
      sourceMagicFamily: "strixhaven-initiate",
      fixedCollege: school?.label || null,
      autoCastingAbility: true,
      allowedCastingAbilities: AUTO_CASTING_ABILITIES,
    },
  };
}

function routeMagicInitiate(group, finalAbilities = {}, selectedClass = null) {
  const abilityField = (group.fields || []).find((field) => field.id === "spellcasting-ability");
  const allowed = (abilityField?.options || []).map((option) => option.value || option.key).filter((value) => AUTO_CASTING_ABILITIES.includes(String(value).toLowerCase()));
  const resolved = bestEligibleCastingAbility(finalAbilities, allowed.length ? allowed : AUTO_CASTING_ABILITIES, selectedClass?.spellcasting_ability || "");
  const resolvedOption = abilityField?.options?.find((option) => String(option.value || option.key).toLowerCase() === resolved?.key) || null;
  const fields = (group.fields || []).map((field) => field.id !== "spellcasting-ability" ? field : {
    ...field,
    autoSelect: true,
    options: resolvedOption ? [resolvedOption] : field.options,
    metadata: { ...(field.metadata || {}), autoCastingAbility: true, allowedCastingAbilities: AUTO_CASTING_ABILITIES },
  });
  return {
    ...group,
    placement: "spells",
    resolverPlacement: "spells",
    helper: "Choose the spell list and granted spells here. The Forge automatically uses the highest eligible Intelligence, Wisdom, or Charisma score for this feat's spells.",
    fields,
    metadata: {
      ...(group.metadata || {}),
      sourceMagicFamily: "magic-initiate",
      autoCastingAbility: true,
      allowedCastingAbilities: AUTO_CASTING_ABILITIES,
    },
  };
}

function routeAcquisitionPlacement(group) {
  if (group?.metadata?.acquisitionOwnerType !== "species-bonus") return group;
  return {
    ...group,
    placement: "class",
    resolverPlacement: "training",
    helper: `${group.metadata?.featName || group.label || "This feat"} was selected as the Species Bonus. Complete any non-spell choices it owns in Training → Feats & Class Abilities.`,
  };
}

export function routeFeatSourceChoiceGroups({ groups = [], selectedBackground = null, spells = [], finalAbilities = {}, selectedClass = null } = {}) {
  return array(groups).map((rawGroup) => {
    const group = routeAcquisitionPlacement(rawGroup);
    const name = norm(group.metadata?.featName || group.label);
    if (name === "strixhaven initiate") return routeStrixhaven(group, selectedBackground, spells);
    if (name === "magic initiate") return routeMagicInitiate(group, finalAbilities, selectedClass);
    return group;
  }).filter((group) => (group.fields || []).every((field) => !field.required || (field.options || []).length >= Number(field.count || 1)));
}

export { STRIXHAVEN_COLLEGES };

import { bestEligibleCastingAbility } from "./playerForgeAutomaticCasting";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");
const array = (value) => Array.isArray(value) ? value : [];

const AUTO_CASTING_ABILITIES = Object.freeze(["int", "wis", "cha"]);
const AUTO_CASTING_LABELS = Object.freeze({ int: "Intelligence", wis: "Wisdom", cha: "Charisma" });
const TRAINING_PROFICIENCY_FEATS = new Set(["skilled", "crafter", "musician"]);
const STRIXHAVEN_COLLEGES = Object.freeze({
  lorehold: Object.freeze({ label: "Lorehold", cantrips: ["Light", "Sacred Flame", "Thaumaturgy"], classes: ["Cleric", "Wizard"] }),
  prismari: Object.freeze({ label: "Prismari", cantrips: ["Fire Bolt", "Prestidigitation", "Ray of Frost"], classes: ["Bard", "Sorcerer"] }),
  quandrix: Object.freeze({ label: "Quandrix", cantrips: ["Druidcraft", "Guidance", "Mage Hand"], classes: ["Druid", "Wizard"] }),
  silverquill: Object.freeze({ label: "Silverquill", cantrips: ["Sacred Flame", "Thaumaturgy", "Vicious Mockery"], classes: ["Bard", "Cleric"] }),
  witherbloom: Object.freeze({ label: "Witherbloom", cantrips: ["Chill Touch", "Druidcraft", "Spare the Dying"], classes: ["Druid", "Wizard"] }),
});
const HIGH_SORCERY_MOONS = Object.freeze({
  nuitari: Object.freeze({ label: "Nuitari", note: "Black moon", spells: ["Dissonant Whispers", "False Life", "Hex", "Ray of Sickness"] }),
  lunitari: Object.freeze({ label: "Lunitari", note: "Red moon", spells: ["Color Spray", "Disguise Self", "Feather Fall", "Longstrider"] }),
  solinari: Object.freeze({ label: "Solinari", note: "White moon", spells: ["Comprehend Languages", "Detect Evil and Good", "Protection from Evil and Good", "Shield"] }),
});
const GIANT_STRIKES = Object.freeze([
  { key: "cloud", label: "Cloud Strike", facts: [{ label: "Damage", value: "1d4 thunder" }, { label: "Rider", value: "Wisdom save; on a failure you become invisible to that target until your next turn, attack, or spell." }] },
  { key: "fire", label: "Fire Strike", facts: [{ label: "Damage", value: "1d10 fire" }] },
  { key: "frost", label: "Frost Strike", facts: [{ label: "Damage", value: "1d6 cold" }, { label: "Rider", value: "Constitution save; on a failure the target's Speed becomes 0 until your next turn." }] },
  { key: "hill", label: "Hill Strike", facts: [{ label: "Damage", value: "1d6 of the weapon's type" }, { label: "Rider", value: "Strength save; on a failure the target falls Prone." }] },
  { key: "stone", label: "Stone Strike", facts: [{ label: "Damage", value: "1d6 force" }, { label: "Rider", value: "Strength save; on a failure push the target 10 feet directly away." }] },
  { key: "storm", label: "Storm Strike", facts: [{ label: "Damage", value: "1d6 lightning" }, { label: "Rider", value: "Constitution save; on a failure the target has Disadvantage on attack rolls until your next turn." }] },
]);
const OUTER_PLANE_CHOICES = Object.freeze([
  { key: "chaotic", label: "Chaotic Outer Plane", resistance: "Poison", cantrip: "Minor Illusion" },
  { key: "evil", label: "Evil Outer Plane", resistance: "Necrotic", cantrip: "Chill Touch" },
  { key: "good", label: "Good Outer Plane", resistance: "Radiant", cantrip: "Sacred Flame" },
  { key: "lawful", label: "Lawful Outer Plane", resistance: "Force", cantrip: "Guidance" },
  { key: "outlands", label: "The Outlands", resistance: "Psychic", cantrip: "Mage Hand" },
]);

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

function fixedMagicInitiateListForBackground(background = null) {
  if (String(background?.source || "").toUpperCase() !== "XPHB") return "";
  const name = norm(background?.name || background?.sourceName || "");
  if (name === "acolyte") return "Cleric";
  if (name === "guide") return "Druid";
  if (name === "sage") return "Wizard";
  return "";
}

function automaticCastingField(finalAbilities = {}, selectedClass = null, source = "Source") {
  const resolved = bestEligibleCastingAbility(finalAbilities, AUTO_CASTING_ABILITIES, selectedClass?.spellcasting_ability || "");
  const key = AUTO_CASTING_ABILITIES.includes(resolved?.key) ? resolved.key : "int";
  return {
    id: "spellcasting-ability",
    label: "Spellcasting ability",
    kind: "ability",
    count: 1,
    required: true,
    autoSelect: true,
    options: [{ key, value: key, label: AUTO_CASTING_LABELS[key], source, kind: "ability" }],
    cadence: "creation",
    metadata: { autoCastingAbility: true, allowedCastingAbilities: AUTO_CASTING_ABILITIES },
  };
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

function routeMagicInitiate(group, selectedBackground, finalAbilities = {}, selectedClass = null) {
  const abilityField = (group.fields || []).find((field) => field.id === "spellcasting-ability");
  const allowed = (abilityField?.options || []).map((option) => option.value || option.key).filter((value) => AUTO_CASTING_ABILITIES.includes(String(value).toLowerCase()));
  const resolved = bestEligibleCastingAbility(finalAbilities, allowed.length ? allowed : AUTO_CASTING_ABILITIES, selectedClass?.spellcasting_ability || "");
  const resolvedOption = abilityField?.options?.find((option) => String(option.value || option.key).toLowerCase() === resolved?.key) || null;
  const fixedList = fixedMagicInitiateListForBackground(selectedBackground);
  const fields = (group.fields || []).map((field) => {
    if (field.id === "spellcasting-ability") return {
      ...field,
      autoSelect: true,
      options: resolvedOption ? [resolvedOption] : field.options,
      metadata: { ...(field.metadata || {}), autoCastingAbility: true, allowedCastingAbilities: AUTO_CASTING_ABILITIES },
    };
    if (field.id === "spell-list" && fixedList) {
      const option = (field.options || []).find((candidate) => norm(candidate.value || candidate.label || candidate.key) === norm(fixedList));
      return { ...field, autoSelect: true, options: option ? [option] : field.options, metadata: { ...(field.metadata || {}), fixedByBackground: true, fixedList } };
    }
    if (fixedList && /^cantrips-|^level-1-/.test(field.id)) {
      const ownsList = field.id.endsWith(`-${slug(fixedList)}`);
      return ownsList ? { ...field, activeWhen: null } : { ...field, required: false, activeWhen: { groupId: group.id, fieldId: "spell-list", values: [`__inactive-${slug(fixedList)}`] } };
    }
    return field;
  });
  return {
    ...group,
    placement: "spells",
    resolverPlacement: "spells",
    helper: fixedList
      ? `${selectedBackground?.name || "This background"} fixes Magic Initiate to the ${fixedList} spell list. Choose only its two cantrips and one level 1 spell here. The Forge automatically uses the highest eligible Intelligence, Wisdom, or Charisma score for these spells.`
      : "Choose the spell list and granted spells here. The Forge automatically uses the highest eligible Intelligence, Wisdom, or Charisma score for this feat's spells.",
    fields,
    metadata: {
      ...(group.metadata || {}),
      sourceMagicFamily: "magic-initiate",
      fixedSpellList: fixedList || null,
      autoCastingAbility: true,
      allowedCastingAbilities: AUTO_CASTING_ABILITIES,
    },
  };
}

function routeHighSorcery(group, spells = [], finalAbilities = {}, selectedClass = null) {
  const moonOptions = Object.entries(HIGH_SORCERY_MOONS).map(([key, moon]) => ({
    key,
    value: moon.label,
    label: moon.label,
    source: group.source || "DSotDQ",
    kind: "enum",
    description: moon.note,
  }));
  const fields = [{
    id: "moon",
    label: "Moon of High Sorcery",
    kind: "enum",
    count: 1,
    required: true,
    options: moonOptions,
    cadence: "creation",
    helper: "Your moon determines the four level 1 spells from which you choose two.",
  }, {
    id: "wizard-cantrip",
    label: "Choose one Wizard cantrip",
    kind: "spell",
    count: 1,
    required: true,
    options: spellOptions(spells, { level: 0, classes: ["Wizard"] }),
    cadence: "creation",
  }];

  Object.entries(HIGH_SORCERY_MOONS).forEach(([key, moon]) => fields.push({
    id: `moon-spells-${key}`,
    label: `${moon.label}: choose two level 1 spells`,
    kind: "spell",
    count: 2,
    required: true,
    options: spellOptions(spells, { level: 1, names: moon.spells }),
    cadence: "creation",
    activeWhen: { groupId: group.id, fieldId: "moon", values: [key] },
    metadata: { moon: moon.label },
  }));
  fields.push(automaticCastingField(finalAbilities, selectedClass, group.source || "DSotDQ"));

  return {
    ...group,
    placement: "spells",
    resolverPlacement: "spells",
    fields,
    helper: "Choose your moon, one Wizard cantrip, and two level 1 spells from that moon on the Spells step. The Forge automatically uses the highest eligible Intelligence, Wisdom, or Charisma score for these spells.",
    metadata: {
      ...(group.metadata || {}),
      sourceMagicFamily: "initiate-high-sorcery",
      autoCastingAbility: true,
      allowedCastingAbilities: AUTO_CASTING_ABILITIES,
    },
  };
}

function routeStrikeOfGiants(group) {
  return {
    ...group,
    fields: [{
      id: "giant-strike",
      label: "Choose your Giant Strike",
      kind: "enum",
      count: 1,
      required: true,
      options: GIANT_STRIKES.map((entry) => ({
        key: entry.key,
        value: entry.label,
        label: entry.label,
        source: group.source || "BGG",
        kind: "enum",
        description: entry.facts.map((fact) => `${fact.label}: ${fact.value}`).join(" • "),
        metadata: { choiceFamily: "giant-strike", facts: entry.facts },
      })),
      cadence: "creation",
      helper: "This choice determines the extra effect you can apply when the feat triggers. Save DC = 8 + proficiency bonus + Strength or Constitution modifier; uses equal proficiency bonus per Long Rest.",
    }],
    helper: "Choose one Giant Strike. Its damage and rider are shown with the selection instead of repeating all six strike descriptions in the Background dossier.",
    metadata: { ...(group.metadata || {}), choiceFamily: "giant-strike" },
  };
}

function routeScionOuterPlanes(group, finalAbilities = {}, selectedClass = null) {
  return {
    ...group,
    fields: [{
      id: "outer-plane",
      label: "Choose your planar infusion",
      kind: "enum",
      count: 1,
      required: true,
      options: OUTER_PLANE_CHOICES.map((entry) => ({
        key: entry.key,
        value: entry.label,
        label: entry.label,
        source: group.source || "SatO",
        kind: "enum",
        description: `${entry.resistance} resistance • ${entry.cantrip}`,
        metadata: {
          choiceFamily: "outer-plane",
          resistance: entry.resistance,
          cantrip: entry.cantrip,
          facts: [{ label: "Resistance", value: entry.resistance }, { label: "Cantrip", value: entry.cantrip }],
        },
      })),
      cadence: "creation",
      helper: "The chosen plane grants both the listed damage resistance and cantrip.",
    }, automaticCastingField(finalAbilities, selectedClass, group.source || "SatO")],
    helper: "Choose one planar infusion. The Forge keeps the matching resistance and cantrip together and automatically uses the highest eligible Intelligence, Wisdom, or Charisma score for the cantrip.",
    metadata: {
      ...(group.metadata || {}),
      choiceFamily: "outer-plane",
      autoCastingAbility: true,
      allowedCastingAbilities: AUTO_CASTING_ABILITIES,
    },
  };
}

function routeTrainingProficiencyFeat(group) {
  const featName = text(group.metadata?.featName || group.label || "This feat");
  const acquisition = text(group.metadata?.acquisitionLabel || "");
  return {
    ...group,
    placement: "training",
    resolverPlacement: "training",
    helper: `${featName} is already granted${acquisition ? ` by ${acquisition}` : ""}. Complete its skill, tool, or instrument proficiencies in Training → Skills & Proficiencies; these feat-granted proficiencies do not consume the class Training-choice allowance.`,
    metadata: {
      ...(group.metadata || {}),
      resolverPlacement: "training",
      trainingSection: "skills-proficiencies",
      proficiencyFeat: true,
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
    if (name === "magic initiate") return routeMagicInitiate(group, selectedBackground, finalAbilities, selectedClass);
    if (name === "initiate of high sorcery") return routeHighSorcery(group, spells, finalAbilities, selectedClass);
    if (name === "strike of the giants") return routeStrikeOfGiants(group);
    if (name === "scion of the outer planes") return routeScionOuterPlanes(group, finalAbilities, selectedClass);
    if (TRAINING_PROFICIENCY_FEATS.has(name)) return routeTrainingProficiencyFeat(group);
    return group;
  }).filter((group) => (group.fields || []).every((field) => !field.required || (field.options || []).length >= Number(field.count || 1)));
}

export { HIGH_SORCERY_MOONS, GIANT_STRIKES, OUTER_PLANE_CHOICES, STRIXHAVEN_COLLEGES };

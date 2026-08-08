const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const array = (value) => Array.isArray(value) ? value : [];
const unique = (values = []) => [...new Set(array(values).map(text).filter(Boolean))];

const ABILITY_KEYS = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);

function number(value, fallback = 0) {
  const resolved = Number(value);
  return Number.isFinite(resolved) ? resolved : fallback;
}

function normalizedSet(values = []) {
  return new Set(array(values).map(norm).filter(Boolean));
}

function featTokenNames(values = []) {
  return array(values).flatMap((value) => {
    const raw = text(typeof value === "string" ? value : value?.name || value?.label || value?.value);
    if (!raw) return [];
    const first = raw.split("|")[0];
    return unique([raw, first]);
  });
}

function classStartingProficiencies(selectedClass = {}) {
  const payload = selectedClass.raw_payload || selectedClass.rawPayload || {};
  const starting = payload.starting_proficiencies || payload.startingProficiencies || {};
  return {
    armor: unique(starting.armor || []),
    weapons: unique(starting.weapons || []),
  };
}

export function progressionState({
  level = 1,
  abilities = {},
  selectedClass = null,
  selectedSpecies = null,
  selectedBackground = null,
  feats = [],
  features = [],
  armorProficiencies = [],
  weaponProficiencies = [],
  campaigns = [],
  spellcasting = null,
} = {}) {
  const starting = classStartingProficiencies(selectedClass || {});
  const scores = Object.fromEntries(ABILITY_KEYS.map((key) => [key, number(abilities?.[key]?.score ?? abilities?.[key], 10)]));
  const classFeatures = array(selectedClass?.raw_payload?.class_features_by_level || selectedClass?.rawPayload?.class_features_by_level)
    .flatMap((entry) => Array.isArray(entry) ? entry : []);
  const spellcastingFeature = spellcasting == null
    ? Boolean(selectedClass?.spellcasting_ability || norm(selectedClass?.caster_progression).includes("pact") || classFeatures.some((feature) => /spellcasting|pact magic/i.test(text(feature))))
    : Boolean(spellcasting);
  return {
    level: Math.max(1, number(level, 1)),
    abilities: scores,
    classKey: norm(selectedClass?.class_key || selectedClass?.className || selectedClass?.class_name),
    className: text(selectedClass?.class_name || selectedClass?.className),
    species: norm(selectedSpecies?.name || selectedSpecies),
    subrace: norm(selectedSpecies?.lineage || selectedSpecies?.subrace || ""),
    background: norm(selectedBackground?.name || selectedBackground),
    feats: normalizedSet(featTokenNames(feats)),
    features: normalizedSet([...features, ...classFeatures].map((value) => text(value).split("|")[0])),
    armorProficiencies: normalizedSet([...starting.armor, ...armorProficiencies]),
    weaponProficiencies: normalizedSet([...starting.weapons, ...weaponProficiencies]),
    campaigns: normalizedSet(campaigns),
    spellcasting: spellcastingFeature,
  };
}

function levelRequirementSatisfied(requirement, state, acquisitionLevel) {
  if (requirement == null) return true;
  if (typeof requirement === "number") return acquisitionLevel >= requirement;
  if (typeof requirement !== "object") return true;
  const minimum = number(requirement.level, 0);
  if (minimum && acquisitionLevel < minimum) return false;
  const requiredClass = norm(requirement.class?.name || requirement.className || "");
  return !requiredClass || requiredClass === norm(state.className) || requiredClass === state.classKey;
}

function abilityRequirementSatisfied(requirements, state) {
  const entries = array(requirements);
  if (!entries.length) return true;
  return entries.every((entry) => Object.entries(entry || {}).every(([key, minimum]) => !ABILITY_KEYS.includes(key) || number(state.abilities?.[key], 0) >= number(minimum, 0)));
}

function proficiencyRequirementSatisfied(requirements, state) {
  const entries = array(requirements);
  if (!entries.length) return true;
  return entries.every((entry) => {
    const armor = norm(entry?.armor || "");
    if (armor && !state.armorProficiencies.has(armor)) return false;
    const weapon = norm(entry?.weapon || entry?.weaponGroup || "");
    if (weapon && !state.weaponProficiencies.has(weapon)) return false;
    return true;
  });
}

function raceRequirementSatisfied(requirements, state) {
  const entries = array(requirements);
  if (!entries.length) return true;
  return entries.some((entry) => {
    const race = norm(entry?.name || entry);
    if (race === "small race") return false;
    if (race && race !== state.species) return false;
    const subrace = norm(entry?.subrace || "");
    return !subrace || subrace === state.subrace;
  });
}

function backgroundRequirementSatisfied(requirements, state) {
  const entries = array(requirements);
  if (!entries.length) return true;
  return entries.some((entry) => norm(entry?.name || entry) === state.background);
}

function featRequirementSatisfied(requirements, state) {
  const wanted = featTokenNames(requirements).map(norm).filter(Boolean);
  if (!wanted.length) return true;
  return wanted.some((candidate) => state.feats.has(candidate));
}

function featureRequirementSatisfied(requirements, state) {
  const wanted = array(requirements).map(norm).filter(Boolean);
  if (!wanted.length) return true;
  return wanted.some((candidate) => state.features.has(candidate) || (candidate === "spellcasting" && state.spellcasting) || (candidate === "pact magic" && state.spellcasting));
}

const SUPPORTED_PREREQUISITE_KEYS = new Set([
  "level", "ability", "spellcasting2020", "spellcastingFeature", "feature", "proficiency", "feat", "background", "race", "campaign",
]);

function prerequisiteAlternativeResult(alternative = {}, state, acquisitionLevel) {
  const keys = Object.keys(alternative || {});
  const unsupportedKeys = keys.filter((key) => !SUPPORTED_PREREQUISITE_KEYS.has(key));
  if (unsupportedKeys.length) return { eligible: false, supported: false, reasons: [`Unsupported prerequisite: ${unsupportedKeys.join(", ")}`] };
  const reasons = [];
  if (!levelRequirementSatisfied(alternative.level, state, acquisitionLevel)) reasons.push(`Requires level ${typeof alternative.level === "object" ? alternative.level.level : alternative.level}.`);
  if (!abilityRequirementSatisfied(alternative.ability, state)) reasons.push("Required ability score is not high enough yet.");
  if ((alternative.spellcasting2020 || alternative.spellcastingFeature) && !state.spellcasting) reasons.push("Requires Spellcasting or Pact Magic.");
  if (!featureRequirementSatisfied(alternative.feature, state)) reasons.push(`Requires ${array(alternative.feature).join(" or ")}.`);
  if (!proficiencyRequirementSatisfied(alternative.proficiency, state)) reasons.push("Required armor or weapon proficiency is missing.");
  if (!featRequirementSatisfied(alternative.feat, state)) reasons.push("Required earlier feat is missing.");
  if (!backgroundRequirementSatisfied(alternative.background, state)) reasons.push("Required background is missing.");
  if (!raceRequirementSatisfied(alternative.race, state)) reasons.push("Required species or lineage is missing.");
  if (array(alternative.campaign).length && state.campaigns.size && !array(alternative.campaign).some((value) => state.campaigns.has(norm(value)))) reasons.push("This feat is restricted to another campaign setting.");
  return { eligible: reasons.length === 0, supported: true, reasons };
}

export function evaluateFeatPrerequisites(feat = {}, stateInput = {}, acquisitionLevel = null) {
  const state = stateInput?.abilities instanceof Object && stateInput?.armorProficiencies instanceof Set
    ? stateInput
    : progressionState(stateInput);
  const level = Math.max(1, number(acquisitionLevel ?? state.level, state.level));
  const alternatives = array(feat.metadata?.prerequisite || feat.prerequisite || []);
  if (!alternatives.length) return { eligible: true, supported: true, matchedAlternative: null, reasons: [] };
  const results = alternatives.map((alternative) => prerequisiteAlternativeResult(alternative, state, level));
  const matchedIndex = results.findIndex((result) => result.eligible);
  if (matchedIndex >= 0) return { eligible: true, supported: true, matchedAlternative: matchedIndex, reasons: [] };
  const supported = results.some((result) => result.supported);
  const reasons = unique(results.flatMap((result) => result.reasons));
  return { eligible: false, supported, matchedAlternative: null, reasons };
}

export function eligibleAdvancementOptions(options = [], stateInput = {}, acquisitionLevel = 1, { epic = false, includeNonEpicAtEpic = true } = {}) {
  const state = stateInput?.armorProficiencies instanceof Set ? stateInput : progressionState(stateInput);
  return array(options).filter((option) => {
    const type = norm(option.option_type || option.optionType || "feat");
    const category = text(option.category).toUpperCase();
    if (epic) {
      if (type === "boon" || category === "EB") return evaluateFeatPrerequisites(option, state, acquisitionLevel).eligible;
      if (!includeNonEpicAtEpic || category !== "G") return false;
    } else if (type === "boon" || category === "EB" || category !== "G") {
      return false;
    }
    return evaluateFeatPrerequisites(option, state, acquisitionLevel).eligible;
  });
}

export function applyFeatToProgressionState(stateInput = {}, feat = {}, selectedAbilityKeys = []) {
  const state = stateInput?.armorProficiencies instanceof Set ? stateInput : progressionState(stateInput);
  const next = {
    ...state,
    abilities: { ...state.abilities },
    feats: new Set(state.feats),
    features: new Set(state.features),
    armorProficiencies: new Set(state.armorProficiencies),
    weaponProficiencies: new Set(state.weaponProficiencies),
  };
  next.feats.add(norm(feat.name));
  const abilityEffects = array(feat.metadata?.ability);
  for (const effect of abilityEffects) {
    for (const key of ABILITY_KEYS) {
      if (number(effect?.[key], 0)) next.abilities[key] = number(next.abilities[key], 10) + number(effect[key], 0);
    }
    const choose = effect?.choose || null;
    if (!choose) continue;
    const allowed = normalizedSet(choose.from || []);
    const selected = array(selectedAbilityKeys).filter((key) => allowed.has(norm(key)));
    const count = Math.max(1, number(choose.count, 1));
    const amount = Math.max(1, number(choose.amount, 1));
    selected.slice(0, count).forEach((key) => { const normalizedKey = norm(key); if (ABILITY_KEYS.includes(normalizedKey)) next.abilities[normalizedKey] = number(next.abilities[normalizedKey], 10) + amount; });
  }
  const name = norm(feat.name);
  if (name === "lightly armored") next.armorProficiencies.add("light");
  if (name === "moderately armored") { next.armorProficiencies.add("medium"); next.armorProficiencies.add("shield"); }
  if (name === "heavily armored") next.armorProficiencies.add("heavy");
  if (name === "martial weapon training") next.weaponProficiencies.add("martial");
  return next;
}

function semanticGroupKey(group = {}) {
  return [group.ownerType || "class", group.ownerKey || "", group.placement || "class", group.kind || "", group.sourceFeature || group.label || "", group.subclassName || ""].map(norm).join("|");
}

export function classChoiceDeltaGroups(previousGroups = [], nextGroups = [], toLevel = 1) {
  const prior = new Map(array(previousGroups).map((group) => [semanticGroupKey(group), group]));
  return array(nextGroups).flatMap((group) => {
    if (Number(group.level || 1) > Number(toLevel || 1)) return [];
    const before = prior.get(semanticGroupKey(group));
    const previousCount = number(before?.count, 0);
    const nextCount = number(group.count, 0);
    const deltaCount = Math.max(0, nextCount - previousCount);
    if (!deltaCount) return [];
    return [{
      ...group,
      id: `${group.id}-level-${Number(toLevel || 1)}-delta`,
      count: deltaCount,
      cadence: "level-up",
      acquisitionLevel: Number(toLevel || 1),
      cumulativeCountBefore: previousCount,
      cumulativeCountAfter: nextCount,
    }];
  });
}

export function progressionLevels(fromLevel = 1, toLevel = 1) {
  const from = Math.max(1, number(fromLevel, 1));
  const to = Math.max(from, Math.min(20, number(toLevel, from)));
  return Array.from({ length: Math.max(0, to - from) }, (_unused, index) => from + index + 1);
}

export function xpThresholdForLevel(level) {
  const thresholds = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
  const resolved = Math.max(1, Math.min(20, number(level, 1)));
  return thresholds[resolved] || 0;
}

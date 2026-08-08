import { eligibleAdvancementOptions, evaluateFeatPrerequisites, progressionState } from "./characterProgressionResolver";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");
const array = (value) => Array.isArray(value) ? value : [];

function featOption(feat, acquisitionLevel, prerequisiteResult = null) {
  return {
    key: text(feat.id || feat.option_key || `${slug(feat.name)}|${feat.source || "XPHB"}`),
    value: text(feat.id || feat.option_key || feat.name),
    label: feat.name,
    source: feat.source || "XPHB",
    kind: feat.option_type === "boon" || feat.category === "EB" ? "boon" : "feat",
    description: text(feat.description),
    metadata: {
      optionId: feat.id || null,
      optionKey: feat.option_key || null,
      optionType: feat.option_type || "feat",
      category: feat.category || null,
      prerequisiteText: feat.prerequisite_text || null,
      prerequisites: array(feat.metadata?.prerequisite),
      prerequisiteResult,
      acquisitionLevel,
      repeatable: Boolean(feat.metadata?.repeatable),
    },
  };
}

function advancementFeatOptions(options = [], acquisitionLevel = 4, epic = false, state = {}) {
  const eligible = eligibleAdvancementOptions(options, state, acquisitionLevel, { epic, includeNonEpicAtEpic: true });
  return eligible.map((feat) => featOption(feat, acquisitionLevel, evaluateFeatPrerequisites(feat, state, acquisitionLevel))).sort((a, b) => {
    const categoryRank = { EB: 0, G: 1, O: 2 };
    const left = categoryRank[a.metadata.category] ?? 9;
    const right = categoryRank[b.metadata.category] ?? 9;
    return left - right || a.label.localeCompare(b.label);
  });
}

export function buildAdvancementSourceChoiceGroups({
  selectedClass = null,
  selectedSpecies = null,
  selectedBackground = null,
  level = 1,
  classFeatureRows = [],
  featOptions = [],
  abilities = {},
  knownFeats = [],
  armorProficiencies = [],
  weaponProficiencies = [],
  campaigns = [],
  features = [],
  spellcasting = null,
} = {}) {
  if (!selectedClass || Number(level || 1) < 4) return [];
  const source = selectedClass.source || "XPHB";
  const className = selectedClass.class_name || selectedClass.name || "Class";
  const baseState = progressionState({
    level,
    abilities,
    selectedClass,
    selectedSpecies,
    selectedBackground,
    feats: knownFeats,
    armorProficiencies,
    weaponProficiencies,
    campaigns,
    features,
    spellcasting,
  });
  return array(classFeatureRows).filter((row) => {
    if (Number(row.level || 1) > Number(level || 1)) return false;
    if (row.class_source && source && row.class_source !== source) return false;
    if (row.class_name && className && norm(row.class_name) !== norm(className)) return false;
    return ["ability score improvement", "epic boon"].includes(norm(row.name));
  }).map((row) => {
    const acquisitionLevel = Number(row.level || 1);
    const epic = norm(row.name) === "epic boon";
    const stateAtAcquisition = { ...baseState, level: acquisitionLevel };
    const options = advancementFeatOptions(featOptions, acquisitionLevel, epic, stateAtAcquisition);
    return {
      id: `advancement-${slug(selectedClass.id || selectedClass.class_key || className)}-${acquisitionLevel}-${epic ? "epic-boon" : "feat"}`,
      ownerType: "advancement",
      ownerKey: `${selectedClass.class_key || slug(className)}:${acquisitionLevel}`,
      label: epic ? `Level ${row.level} Epic Boon` : `Level ${row.level} Feat`,
      source: row.source || source,
      placement: "advancement",
      level: acquisitionLevel,
      helper: epic
        ? "Choose an Epic Boon for which the character qualifies, or another qualifying General feat if the source feature permits it."
        : "Choose the Ability Score Improvement feat or another General feat for which the character qualifies at this point in progression.",
      metadata: {
        progressionResolver: "characterProgressionResolver",
        prerequisiteTiming: "before-feat-benefits",
        sourceFeature: row.name,
        featureId: row.id || null,
      },
      fields: [{
        id: "feat",
        label: epic ? "Choose Epic Boon or qualifying General feat" : "Choose feat",
        kind: epic ? "boon-or-feat" : "feat",
        count: 1,
        required: true,
        cadence: "level-up",
        options,
        metadata: { sourceFeature: row.name, featureId: row.id || null, featureLevel: acquisitionLevel, prerequisiteEvaluation: "before-feat-benefits" },
      }],
    };
  }).filter((group) => group.fields[0].options.length > 0);
}

export function selectedAdvancementFeats(sourceChoiceSummary = []) {
  return array(sourceChoiceSummary).filter((entry) => entry.ownerType === "advancement" && ["feat", "boon", "boon-or-feat"].includes(entry.kind));
}

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");
const array = (value) => Array.isArray(value) ? value : [];

function minimumFeatLevel(feat = {}) {
  let minimum = 1;
  for (const prerequisite of array(feat.metadata?.prerequisite)) {
    if (Number(prerequisite?.level || 0) > 0) minimum = Math.max(minimum, Number(prerequisite.level));
  }
  return minimum;
}

function featOption(feat, acquisitionLevel) {
  return {
    key: text(feat.id || feat.option_key || `${slug(feat.name)}|${feat.source || "XPHB"}`),
    value: text(feat.id || feat.option_key || feat.name),
    label: feat.name,
    source: feat.source || "XPHB",
    kind: "feat",
    description: text(feat.description),
    metadata: {
      optionId: feat.id || null,
      optionKey: feat.option_key || null,
      category: feat.category || null,
      prerequisiteText: feat.prerequisite_text || null,
      prerequisites: array(feat.metadata?.prerequisite),
      acquisitionLevel,
      repeatable: Boolean(feat.metadata?.repeatable),
    },
  };
}

function advancementFeatOptions(feats = [], acquisitionLevel = 4, epic = false) {
  return array(feats).filter((feat) => {
    if (!feat?.name) return false;
    if (feat.source === "XPHB" && String(feat.category || "").startsWith("FS")) return false;
    if (minimumFeatLevel(feat) > Number(acquisitionLevel || 1)) return false;
    if (epic) return ["EB", "G", "O"].includes(String(feat.category || ""));
    return ["G", "O"].includes(String(feat.category || ""));
  }).map((feat) => featOption(feat, acquisitionLevel)).sort((a, b) => {
    const categoryRank = { EB: 0, G: 1, O: 2 };
    const left = categoryRank[a.metadata.category] ?? 9;
    const right = categoryRank[b.metadata.category] ?? 9;
    return left - right || a.label.localeCompare(b.label);
  });
}

export function buildAdvancementSourceChoiceGroups({ selectedClass = null, level = 1, classFeatureRows = [], featOptions = [] } = {}) {
  if (!selectedClass || Number(level || 1) < 4) return [];
  const source = selectedClass.source || "XPHB";
  const className = selectedClass.class_name || selectedClass.name || "Class";
  return array(classFeatureRows).filter((row) => {
    if (Number(row.level || 1) > Number(level || 1)) return false;
    if (row.class_source && source && row.class_source !== source) return false;
    if (row.class_name && className && norm(row.class_name) !== norm(className)) return false;
    return ["ability score improvement", "epic boon"].includes(norm(row.name));
  }).map((row) => {
    const epic = norm(row.name) === "epic boon";
    const options = advancementFeatOptions(featOptions, Number(row.level || 1), epic);
    return {
      id: `advancement-${slug(selectedClass.id || selectedClass.class_key || className)}-${Number(row.level || 1)}-${epic ? "epic-boon" : "feat"}`,
      ownerType: "advancement",
      ownerKey: `${selectedClass.class_key || slug(className)}:${Number(row.level || 1)}`,
      label: epic ? `Level ${row.level} Epic Boon` : `Level ${row.level} Feat`,
      source: row.source || source,
      placement: "advancement",
      level: Number(row.level || 1),
      helper: epic ? "Choose the Epic Boon or another feat for which the character qualifies." : "Choose the Ability Score Improvement feat or another feat for which the character qualifies.",
      fields: [{
        id: "feat",
        label: epic ? "Choose Epic Boon or qualifying feat" : "Choose feat",
        kind: "feat",
        count: 1,
        required: true,
        cadence: "level-up",
        options,
        metadata: { sourceFeature: row.name, featureId: row.id || null, featureLevel: Number(row.level || 1), prerequisiteEvaluation: "before-feat-benefits" },
      }],
    };
  }).filter((group) => group.fields[0].options.length > 0);
}

export function selectedAdvancementFeats(sourceChoiceSummary = []) {
  return array(sourceChoiceSummary).filter((entry) => entry.ownerType === "advancement" && entry.kind === "feat");
}

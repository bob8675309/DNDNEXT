import { SKILL_DEFINITIONS } from "./characterCreation";
import { buildToolOptionCatalog } from "./playerForgeSourceChoices";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function speciesIdentity(species = null) {
  return {
    name: norm(species?.name || species?.species_name || species?.option_name),
    source: text(species?.source || species?.species_source || species?.metadata?.source).toUpperCase(),
  };
}

function skillOptions() {
  return SKILL_DEFINITIONS.map((skill) => ({
    key: `skill:${skill.key}`,
    value: `skill:${skill.key}`,
    label: skill.label,
    source: "D&D",
    kind: "skill",
    metadata: { kind: "skill", skillKey: skill.key, name: skill.label, ability: skill.ability },
  }));
}

function khoravarOptions(toolRows = []) {
  const tools = buildToolOptionCatalog(toolRows).all.map((option) => ({
    ...option,
    key: `tool:${option.key}`,
    value: `tool:${option.key}`,
    kind: "tool",
    metadata: { ...(option.metadata || {}), kind: "tool", toolKey: option.key, name: option.label },
  }));
  return [...skillOptions(), ...tools].sort((a, b) => a.label.localeCompare(b.label) || a.kind.localeCompare(b.kind));
}

function eladrinSeasonOptions() {
  return [
    { key: "autumn", value: "autumn", label: "Autumn", source: "MPMM", kind: "season", metadata: { feyStepEffect: "charm" } },
    { key: "winter", value: "winter", label: "Winter", source: "MPMM", kind: "season", metadata: { feyStepEffect: "frighten" } },
    { key: "spring", value: "spring", label: "Spring", source: "MPMM", kind: "season", metadata: { feyStepEffect: "ally-teleport" } },
    { key: "summer", value: "summer", label: "Summer", source: "MPMM", kind: "season", metadata: { feyStepEffect: "fire-damage" } },
  ];
}

export function applySpeciesRuntimeChoiceAuthority({ groups = [], species = null, toolRows = [] } = {}) {
  const identity = speciesIdentity(species);
  const next = Array.isArray(groups) ? [...groups] : [];

  // These source traits are rest-configurable runtime authority, not permanent Forge proficiency choices.
  const filtered = next.filter((group) => {
    const trait = norm(group?.label);
    if (identity.name === "githyanki" && identity.source === "MPMM" && trait === "astral knowledge") return false;
    if (identity.name === "khoravar" && identity.source === "EFA" && trait === "skill versatility") return false;
    return true;
  });

  if (identity.name === "khoravar" && identity.source === "EFA") {
    filtered.push({
      id: "species-runtime-khoravar-skill-versatility",
      ownerType: "species-runtime",
      ownerKey: "khoravar-skill-versatility",
      label: "Skill Versatility",
      source: "EFA",
      placement: "training",
      level: 1,
      helper: "Choose one skill or tool proficiency. This is the initial runtime choice; after a Long Rest, you can replace it with another skill or tool.",
      fields: [{
        id: "proficiency",
        label: "Skill or tool proficiency",
        kind: "proficiency",
        count: 1,
        required: true,
        options: khoravarOptions(toolRows),
        cadence: "long-rest",
        replacementCadence: "long-rest",
      }],
      metadata: {
        family: "khoravar-skill-versatility",
        cadence: "long-rest",
        runtimeInitial: true,
        sourceTrait: "Skill Versatility",
      },
    });
  }

  if (identity.name === "eladrin" && identity.source === "MPMM") {
    filtered.push({
      id: "species-runtime-eladrin-season",
      ownerType: "species-runtime",
      ownerKey: "eladrin-season",
      label: "Eladrin Season",
      source: "MPMM",
      placement: "species",
      level: 1,
      helper: "Choose your current Eladrin season. It remains current until you change it after a newer Long Rest; at level 3+, it determines the extra Fey Step effect.",
      fields: [{
        id: "season",
        label: "Current season",
        kind: "season",
        count: 1,
        required: true,
        options: eladrinSeasonOptions(),
        cadence: "acquisition",
        replacementCadence: "long-rest",
      }],
      metadata: {
        family: "eladrin-season",
        cadence: "long-rest",
        runtimeInitial: true,
        sourceTrait: "Fey Step / Season",
        feyStepLevel: 3,
      },
    });
  }

  return filtered;
}

export function speciesRuntimeSelectionSummary(groups = [], selections = {}) {
  return (Array.isArray(groups) ? groups : []).flatMap((group) => {
    if (group.metadata?.family === "khoravar-skill-versatility") {
      const key = Array.isArray(selections?.[group.id]?.proficiency) ? selections[group.id].proficiency[0] : null;
      if (!key) return [];
      const option = group.fields?.[0]?.options?.find((entry) => entry.key === key);
      return option ? [{ groupId: group.id, featureKey: "khoravar-skill-versatility", option }] : [];
    }
    if (group.metadata?.family === "eladrin-season") {
      const key = Array.isArray(selections?.[group.id]?.season) ? selections[group.id].season[0] : null;
      if (!key) return [];
      const option = group.fields?.[0]?.options?.find((entry) => entry.key === key);
      return option ? [{ groupId: group.id, featureKey: "eladrin-season", option }] : [];
    }
    return [];
  });
}

import { buildToolOptionCatalog } from "./playerForgeSourceChoices";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");

const SKILLS = Object.freeze([
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History",
  "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception",
  "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival",
]);

function speciesIdentity(species = null) {
  return {
    name: norm(species?.name || species?.species_name || species?.option_name),
    source: text(species?.source || species?.species_source || species?.metadata?.source).toUpperCase(),
  };
}

function skillOptions() {
  return SKILLS.map((name) => ({
    key: `skill:${slug(name)}`,
    value: `skill:${slug(name)}`,
    label: name,
    source: "D&D",
    kind: "skill",
    metadata: { kind: "skill", skillKey: slug(name), name },
  }));
}

function khoravarOptions(toolRows = []) {
  const tools = buildToolOptionCatalog(toolRows).map((option) => ({
    ...option,
    key: `tool:${option.key}`,
    value: `tool:${option.key}`,
    kind: "tool",
    metadata: { ...(option.metadata || {}), kind: "tool", toolKey: option.key },
  }));
  return [...skillOptions(), ...tools].sort((a, b) => a.label.localeCompare(b.label) || a.kind.localeCompare(b.kind));
}

export function applySpeciesRuntimeChoiceAuthority({ groups = [], species = null, toolRows = [] } = {}) {
  const identity = speciesIdentity(species);
  const next = Array.isArray(groups) ? [...groups] : [];

  // These source traits are Long-Rest runtime authority, not permanent Forge skill choices.
  const filtered = next.filter((group) => {
    if (identity.name === "githyanki" && identity.source === "MPMM" && group.id === "species-trait-astral-knowledge-skill") return false;
    if (identity.name === "khoravar" && identity.source === "MPMM" && group.id === "species-trait-skill-versatility-skill") return false;
    return true;
  });

  if (identity.name === "khoravar" && identity.source === "MPMM") {
    filtered.push({
      id: "species-runtime-khoravar-skill-versatility",
      ownerType: "species-runtime",
      ownerKey: "khoravar-skill-versatility",
      label: "Skill Versatility",
      source: "MPMM",
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

  return filtered;
}

export function speciesRuntimeSelectionSummary(groups = [], selections = {}) {
  return (Array.isArray(groups) ? groups : []).flatMap((group) => {
    if (group.metadata?.family !== "khoravar-skill-versatility") return [];
    const key = Array.isArray(selections?.[group.id]?.proficiency) ? selections[group.id].proficiency[0] : null;
    if (!key) return [];
    const option = group.fields?.[0]?.options?.find((entry) => entry.key === key);
    return option ? [{ groupId: group.id, featureKey: "khoravar-skill-versatility", option }] : [];
  });
}

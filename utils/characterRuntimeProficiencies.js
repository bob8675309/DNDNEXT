function safeText(value) {
  return String(value ?? "").trim();
}

function deepClone(value) {
  try {
    return structuredClone(value ?? {});
  } catch {
    return JSON.parse(JSON.stringify(value ?? {}));
  }
}

function trainingState(state = null) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  if (state.configured === false) return null;
  const skillKey = safeText(state?.skill?.key);
  const trainingName = safeText(state?.training?.name);
  const trainingKind = safeText(state?.training?.kind).toLowerCase();
  if (!skillKey || !trainingName) return null;
  return { ...state, skillKey, trainingName, trainingKind };
}

export function astralTranceRuntimeState(sheet = {}) {
  return trainingState(sheet?.runtimeProficiencies?.astralTrance);
}

export function githyankiAstralKnowledgeRuntimeState(sheet = {}) {
  return trainingState(sheet?.runtimeProficiencies?.githyankiAstralKnowledge);
}

export function khoravarSkillVersatilityRuntimeState(sheet = {}) {
  const state = sheet?.runtimeProficiencies?.khoravarSkillVersatility;
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const proficiency = state?.proficiency;
  if (!proficiency || typeof proficiency !== "object" || Array.isArray(proficiency)) return null;
  const kind = safeText(proficiency.kind || proficiency?.metadata?.kind).toLowerCase();
  const key = safeText(proficiency.key || proficiency.value);
  const skillKey = kind === "skill"
    ? safeText(proficiency?.metadata?.skillKey || (key.startsWith("skill:") ? key.slice(6) : key))
    : "";
  const trainingName = kind === "tool" ? safeText(proficiency.name || proficiency.label || proficiency?.metadata?.name) : "";
  if (kind === "skill" && !skillKey) return null;
  if (kind === "tool" && !trainingName) return null;
  if (!["skill", "tool"].includes(kind)) return null;
  return { ...state, kind, skillKey, trainingName, proficiency };
}

export function eladrinTranceRuntimeState(sheet = {}) {
  const state = sheet?.runtimeProficiencies?.eladrinTrance;
  if (!state || typeof state !== "object" || Array.isArray(state) || state.configured === false) return null;
  const trainings = Array.isArray(state.trainings) ? state.trainings.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) : [];
  if (trainings.length !== 2) return null;
  return { ...state, trainings };
}

function applyRuntimeSkill(next, skillKey, marker) {
  if (!skillKey) return;
  next.proficiencies = next.proficiencies && typeof next.proficiencies === "object" ? next.proficiencies : {};
  next.proficiencies.skills = next.proficiencies.skills && typeof next.proficiencies.skills === "object" ? next.proficiencies.skills : {};
  const permanent = next.proficiencies.skills[skillKey] && typeof next.proficiencies.skills[skillKey] === "object"
    ? next.proficiencies.skills[skillKey]
    : {};
  const priorMarkers = Array.isArray(permanent.runtimeProficiencies)
    ? permanent.runtimeProficiencies
    : permanent.runtimeProficiency
      ? [permanent.runtimeProficiency]
      : [];
  next.proficiencies.skills[skillKey] = {
    ...permanent,
    proficient: true,
    runtimeProficiency: marker,
    runtimeProficiencies: [...new Set([...priorMarkers, marker])],
  };
}

export function projectCharacterSheetRuntimeProficiencies(sheet = {}) {
  const astral = astralTranceRuntimeState(sheet);
  const githyanki = githyankiAstralKnowledgeRuntimeState(sheet);
  const khoravar = khoravarSkillVersatilityRuntimeState(sheet);
  if (!astral && !githyanki && !khoravar) return sheet || {};

  const next = deepClone(sheet || {});
  if (astral) applyRuntimeSkill(next, astral.skillKey, "astral-trance");
  if (githyanki) applyRuntimeSkill(next, githyanki.skillKey, "githyanki-astral-knowledge");
  if (khoravar?.kind === "skill") applyRuntimeSkill(next, khoravar.skillKey, "khoravar-skill-versatility");
  return next;
}

function trainingMatches(state, kind, name) {
  if (!state || state.trainingKind !== kind) return false;
  return safeText(state.trainingName).toLowerCase() === safeText(name).toLowerCase();
}

function eladrinTrainingMatches(sheet = {}, kind = "", name = "") {
  const state = eladrinTranceRuntimeState(sheet);
  if (!state) return false;
  const wantedKind = safeText(kind).toLowerCase();
  const wantedName = safeText(name).toLowerCase();
  return state.trainings.some((training) => safeText(training.kind).toLowerCase() === wantedKind
    && safeText(training.name).toLowerCase() === wantedName);
}

export function hasRuntimeWeaponProficiency(sheet = {}, weaponName = "") {
  return trainingMatches(astralTranceRuntimeState(sheet), "weapon", weaponName)
    || trainingMatches(githyankiAstralKnowledgeRuntimeState(sheet), "weapon", weaponName)
    || eladrinTrainingMatches(sheet, "weapon", weaponName);
}

export function hasRuntimeToolProficiency(sheet = {}, toolName = "") {
  if (trainingMatches(astralTranceRuntimeState(sheet), "tool", toolName)) return true;
  if (trainingMatches(githyankiAstralKnowledgeRuntimeState(sheet), "tool", toolName)) return true;
  if (eladrinTrainingMatches(sheet, "tool", toolName)) return true;
  const khoravar = khoravarSkillVersatilityRuntimeState(sheet);
  return Boolean(khoravar?.kind === "tool" && safeText(khoravar.trainingName).toLowerCase() === safeText(toolName).toLowerCase());
}

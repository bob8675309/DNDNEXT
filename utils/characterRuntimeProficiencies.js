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

export function astralTranceRuntimeState(sheet = {}) {
  const state = sheet?.runtimeProficiencies?.astralTrance;
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  if (state.configured === false) return null;
  const skillKey = safeText(state?.skill?.key);
  const trainingName = safeText(state?.training?.name);
  const trainingKind = safeText(state?.training?.kind).toLowerCase();
  if (!skillKey || !trainingName) return null;
  return { ...state, skillKey, trainingName, trainingKind };
}

export function projectCharacterSheetRuntimeProficiencies(sheet = {}) {
  const state = astralTranceRuntimeState(sheet);
  if (!state) return sheet || {};

  const next = deepClone(sheet || {});
  next.proficiencies = next.proficiencies && typeof next.proficiencies === "object" ? next.proficiencies : {};
  next.proficiencies.skills = next.proficiencies.skills && typeof next.proficiencies.skills === "object" ? next.proficiencies.skills : {};
  const permanent = next.proficiencies.skills[state.skillKey] && typeof next.proficiencies.skills[state.skillKey] === "object"
    ? next.proficiencies.skills[state.skillKey]
    : {};
  next.proficiencies.skills[state.skillKey] = {
    ...permanent,
    proficient: true,
    runtimeProficiency: "astral-trance",
  };
  return next;
}

export function hasRuntimeWeaponProficiency(sheet = {}, weaponName = "") {
  const state = astralTranceRuntimeState(sheet);
  if (!state || state.trainingKind !== "weapon") return false;
  return safeText(state.trainingName).toLowerCase() === safeText(weaponName).toLowerCase();
}

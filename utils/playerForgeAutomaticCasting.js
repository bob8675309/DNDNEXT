import { ABILITY_LABELS } from "./characterCreation";

const STABLE_PRIORITY = Object.freeze(["int", "wis", "cha", "str", "dex", "con"]);

function scoreFor(abilities = {}, key = "") {
  const value = abilities?.[key];
  if (value && typeof value === "object") return Number(value.score ?? value.value ?? 10);
  return Number(value ?? 10);
}

function modifierFor(score) {
  return Math.floor((Number(score || 10) - 10) / 2);
}

export function bestEligibleCastingAbility(abilities = {}, allowed = ["int", "wis", "cha"], classCastingAbility = "") {
  const permitted = [...new Set((Array.isArray(allowed) ? allowed : []).map((key) => String(key || "").trim().toLowerCase()).filter(Boolean))];
  if (!permitted.length) return null;
  const classKey = String(classCastingAbility || "").trim().toLowerCase();
  const ranked = permitted.map((key) => {
    const score = scoreFor(abilities, key);
    return {
      key,
      label: ABILITY_LABELS[key] || key.toUpperCase(),
      score,
      modifier: modifierFor(score),
      classPreferred: key === classKey,
      stableRank: STABLE_PRIORITY.indexOf(key) < 0 ? 99 : STABLE_PRIORITY.indexOf(key),
    };
  }).sort((a, b) => b.modifier - a.modifier
    || Number(b.classPreferred) - Number(a.classPreferred)
    || b.score - a.score
    || a.stableRank - b.stableRank
    || a.key.localeCompare(b.key));
  return ranked[0] || null;
}

export function automaticCastingAbilityLabel(result = null) {
  if (!result) return "Not applicable";
  const modifier = result.modifier >= 0 ? `+${result.modifier}` : String(result.modifier);
  return `${result.label} ${result.score} (${modifier})`;
}

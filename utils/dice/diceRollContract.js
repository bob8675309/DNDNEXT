import { clampDieResult, isDiceType } from "./diceTypes";

export function normalizeVisualDie(input = {}, index = 0) {
  const type = isDiceType(input.type) ? input.type : "d6";
  return {
    id: String(input.id || `die-${index + 1}`),
    type,
    result: clampDieResult(type, input.result),
    accent: String(input.accent || "violet"),
    label: String(input.label || `${type.toUpperCase()} result`),
    detail: input.detail && typeof input.detail === "object" ? input.detail : null,
  };
}

export function normalizeVisualDice(input = []) {
  const seen = new Set();
  return (Array.isArray(input) ? input : []).map(normalizeVisualDie).filter((die) => {
    if (seen.has(die.id)) return false;
    seen.add(die.id);
    return true;
  });
}

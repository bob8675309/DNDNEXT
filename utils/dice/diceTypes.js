export const DICE_TYPES = Object.freeze(["d6", "d8", "d10", "d12", "d20", "resultCube"]);

export const DIE_SIDES = Object.freeze({ d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, resultCube: null });

export function isDiceType(value) {
  return DICE_TYPES.includes(String(value || ""));
}

export function clampDieResult(type, value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return 1;
  const sides = DIE_SIDES[type];
  if (!sides) return number;
  return Math.max(1, Math.min(sides, number));
}

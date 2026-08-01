function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function hasStoredBaseAc(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return Number.isFinite(Number(value));
}

export function calculateUnarmoredBaseAc(storedBaseAc, dexterityModifier) {
  if (hasStoredBaseAc(storedBaseAc)) return Number(storedBaseAc);
  return 10 + finiteNumber(dexterityModifier, 0);
}

export function calculateArmorClass({
  storedBaseAc = null,
  dexterityModifier = 0,
  armor = null,
  shieldBonus = 0,
  otherBonus = 0,
} = {}) {
  const dexMod = finiteNumber(dexterityModifier, 0);
  const shield = finiteNumber(shieldBonus, 0);
  const other = finiteNumber(otherBonus, 0);

  if (armor && typeof armor === "object") {
    const armorBase = finiteNumber(armor.baseAc ?? armor.ac, 0);
    const category = String(armor.category || "").trim().toLowerCase();
    const dexApplied = category === "light"
      ? dexMod
      : category === "medium"
        ? Math.min(dexMod, 2)
        : 0;
    const base = armorBase + dexApplied;
    return {
      total: base + shield + other,
      base,
      dexApplied,
      shieldBonus: shield,
      otherBonus: other,
      source: "armor",
      usedStoredBaseAc: false,
    };
  }

  const base = calculateUnarmoredBaseAc(storedBaseAc, dexMod);
  return {
    total: base + shield + other,
    base,
    dexApplied: hasStoredBaseAc(storedBaseAc) ? 0 : dexMod,
    shieldBonus: shield,
    otherBonus: other,
    source: "base",
    usedStoredBaseAc: hasStoredBaseAc(storedBaseAc),
  };
}

export function calculateInitiativeModifier({
  dexterityModifier = 0,
  checkBonus = 0,
  gearBonus = 0,
  sheetBonus = 0,
} = {}) {
  return finiteNumber(dexterityModifier, 0)
    + finiteNumber(checkBonus, 0)
    + finiteNumber(gearBonus, 0)
    + finiteNumber(sheetBonus, 0);
}

export function passivePerceptionAdjustment(mode) {
  if (mode === "adv") return 5;
  if (mode === "dis") return -5;
  return 0;
}

export function calculatePassivePerception(perceptionCheckBonus, mode = "normal") {
  return 10 + finiteNumber(perceptionCheckBonus, 0) + passivePerceptionAdjustment(mode);
}

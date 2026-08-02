function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function hasStoredBaseAc(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number !== 0;
}

export function calculateUnarmoredBaseAc(storedBaseAc, dexterityModifier, additionalAbilityModifier = 0) {
  if (hasStoredBaseAc(storedBaseAc)) return Number(storedBaseAc);
  return 10 + finiteNumber(dexterityModifier, 0) + finiteNumber(additionalAbilityModifier, 0);
}

export function resolveClassUnarmoredDefense(sheet = {}, abilityModifiers = {}) {
  const classKey = String(sheet?.meta?.classKey || sheet?.classKey || sheet?.className || sheet?.class || "")
    .trim()
    .toLowerCase();
  if (classKey === "barbarian") {
    return { ability: "con", modifier: finiteNumber(abilityModifiers?.con, 0), label: "Barbarian Unarmored Defense" };
  }
  if (classKey === "monk") {
    return { ability: "wis", modifier: finiteNumber(abilityModifiers?.wis, 0), label: "Monk Unarmored Defense" };
  }
  return { ability: null, modifier: 0, label: "" };
}

export function calculateArmorClass({
  storedBaseAc = null,
  dexterityModifier = 0,
  unarmoredDefenseModifier = 0,
  unarmoredDefenseLabel = "",
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

  const featureModifier = finiteNumber(unarmoredDefenseModifier, 0);
  const base = calculateUnarmoredBaseAc(storedBaseAc, dexMod, featureModifier);
  return {
    total: base + shield + other,
    base,
    dexApplied: hasStoredBaseAc(storedBaseAc) ? 0 : dexMod,
    unarmoredDefenseModifier: hasStoredBaseAc(storedBaseAc) ? 0 : featureModifier,
    unarmoredDefenseLabel: hasStoredBaseAc(storedBaseAc) ? "" : String(unarmoredDefenseLabel || ""),
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

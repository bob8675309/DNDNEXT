const DAMAGE_TYPE_LABELS = Object.freeze({
  A: "acid",
  B: "bludgeoning",
  C: "cold",
  F: "fire",
  L: "lightning",
  N: "necrotic",
  P: "piercing",
  I: "poison",
  Y: "psychic",
  R: "radiant",
  S: "slashing",
  T: "thunder",
  O: "force",
});

const SIMPLE_AND_MARTIAL = new Set(["barbarian", "fighter", "paladin", "ranger"]);
const SIMPLE_WEAPONS = new Set(["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"]);

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeName(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanRulesText(value) {
  return safeText(value)
    .replace(/\{@(?:damage|dice|hit|chance)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:spell|item|creature|condition|skill|action|sense|language|race|class|subclass|feat|filter|book|adventure|variantrule)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:b|i|u|note|atk|h|dc)\s+([^}]*)}/gi, "$1")
    .replace(/\{@[a-zA-Z]+\s+([^}]*)}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedClassKey(sheet = {}) {
  return safeText(sheet?.meta?.classKey || sheet?.classKey || sheet?.className || sheet?.class)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function itemPayload(row = {}) {
  return {
    ...(row?.card_payload && typeof row.card_payload === "object" ? row.card_payload : {}),
    ...row,
  };
}

function itemName(row = {}) {
  const payload = itemPayload(row);
  return safeText(payload.item_name || payload.name || row?.item_name || row?.name || "Weapon");
}

function propertyCodes(payload = {}) {
  const values = Array.isArray(payload.property) ? payload.property : [];
  return new Set(values.map((value) => safeText(value).split("|")[0].toUpperCase()).filter(Boolean));
}

function magicWeaponBonus(payload = {}) {
  const raw = safeText(payload.bonusWeapon || payload.bonus_weapon || payload.enhancement_bonus || payload.smith_tier || "0");
  const match = raw.match(/[-+]?\d+/);
  return match ? Number(match[0]) || 0 : 0;
}

function weaponCategory(payload = {}) {
  const explicit = safeText(payload.weaponCategory || payload.weapon_category).toLowerCase();
  if (explicit) return explicit;
  const type = safeText(payload.type).split("|")[0].toUpperCase();
  return type === "M" || type === "R" ? "martial" : "simple";
}

function isWeapon(row = {}) {
  const payload = itemPayload(row);
  const type = safeText(payload.item_type || payload.uiType || payload.type).toLowerCase();
  const typeCode = safeText(payload.type).split("|")[0].toUpperCase();
  return Boolean(payload.weapon)
    || type.includes("weapon")
    || ["M", "R"].includes(typeCode);
}

function explicitWeaponProficiencies(sheet = {}) {
  const candidates = [
    sheet?.weaponProficiencies,
    sheet?.proficiencies?.weapons,
    sheet?.meta?.weaponProficiencies,
  ];
  const values = candidates.find(Array.isArray) || [];
  return values.map((value) => safeText(value).toLowerCase()).filter(Boolean);
}

function isWeaponProficient({ sheet, category, name, properties }) {
  const explicit = explicitWeaponProficiencies(sheet);
  if (explicit.length) {
    const normalizedName = safeText(name).toLowerCase();
    return explicit.some((value) => value === category || value === normalizedName || value.includes(normalizedName));
  }

  const classKey = normalizedClassKey(sheet);
  if (SIMPLE_AND_MARTIAL.has(classKey)) return true;
  if (SIMPLE_WEAPONS.has(classKey)) return category === "simple";
  if (classKey === "monk") return category === "simple" || properties.has("L");
  if (classKey === "rogue") return category === "simple" || properties.has("F") || properties.has("L");
  return false;
}

function usesPactAbility(sheet = {}, row = {}) {
  if (normalizedClassKey(sheet) !== "warlock" || !row?.is_equipped) return false;
  const subclass = safeText(sheet?.meta?.subclass || sheet?.subclass).toLowerCase();
  const featureText = [
    ...(Array.isArray(sheet?.classFeatures) ? sheet.classFeatures : []),
    ...(Array.isArray(sheet?.invocations) ? sheet.invocations : []),
    sheet?.featsTraits,
  ].filter(Boolean).join(" ").toLowerCase();
  return subclass.includes("hexblade") || featureText.includes("pact of the blade") || featureText.includes("hex warrior");
}

function damageTypeLabel(value) {
  const raw = safeText(value);
  return DAMAGE_TYPE_LABELS[raw.toUpperCase()] || raw.toLowerCase();
}

function hasNamedFeature(sheet = {}, featureRows = [], name = "") {
  const target = normalizeName(name);
  if (!target) return false;
  const candidates = [
    ...(Array.isArray(sheet?.speciesTraits) ? sheet.speciesTraits : []),
    ...(Array.isArray(sheet?.classFeatures) ? sheet.classFeatures : []),
    ...(Array.isArray(sheet?.feats) ? sheet.feats : []),
    ...(Array.isArray(featureRows) ? featureRows.map((row) => row?.name) : []),
  ];
  return candidates.some((value) => normalizeName(value) === target || normalizeName(value).startsWith(`${target} `));
}

function itemDescription(row, payload) {
  const entries = Array.isArray(payload?.entries)
    ? payload.entries.filter((entry) => typeof entry === "string").join("\n\n")
    : "";
  return cleanRulesText(payload?.item_description || row?.item_description || payload?.rulesShort || entries);
}

function weaponActions(row, sheet, abilityModifiers, proficiencyBonus, featureRows = []) {
  if (!isWeapon(row)) return [];
  const payload = itemPayload(row);
  const damageDice = safeText(payload.dmg1 || payload.damageDice || payload.damage_dice);
  if (!/^\d+d\d+$/i.test(damageDice)) return [];

  const name = itemName(row);
  const properties = propertyCodes(payload);
  const itemType = safeText(payload.item_type || payload.uiType || row?.item_type).toLowerCase();
  const ranged = itemType.includes("ranged weapon") || safeText(payload.type).split("|")[0].toUpperCase() === "R";
  const thrown = properties.has("T") || safeText(payload.rangeText || payload.range_text).toLowerCase().includes("thrown");
  const finesse = properties.has("F");
  const pactAbility = usesPactAbility(sheet, row);
  const category = weaponCategory(payload);
  const magicBonus = magicWeaponBonus(payload);
  const damageType = damageTypeLabel(payload.dmgType || payload.damageType || payload.damage_type);
  const range = safeText(payload.rangeText || payload.range_text || payload.range);
  const longLimbed = hasNamedFeature(sheet, featureRows, "Long-Limbed");
  const rageState = sheet?.actionState?.rage && typeof sheet.actionState.rage === "object" ? sheet.actionState.rage : {};
  const rageActive = Boolean(rageState.active);
  const rageDamage = rageActive ? Number(sheet?.rageDamageBonus || 0) : 0;
  const modes = !ranged && thrown ? ["melee", "thrown"] : [ranged ? "ranged" : "melee"];
  const description = itemDescription(row, payload);
  const propertyText = safeText(payload.propertiesText || payload.properties_text);
  const mastery = Array.isArray(payload.mastery) ? payload.mastery.map(safeText).filter(Boolean).join(", ") : "";
  const quantity = Math.max(1, Number(row?.quantity || payload?.quantity || 1));
  const baseId = `weapon:${row.id || payload.item_id || name}`;

  return modes.map((mode) => {
    let ability = mode === "ranged" ? "dex" : "str";
    if (finesse && Number(abilityModifiers.dex || 0) > Number(abilityModifiers.str || 0)) ability = "dex";
    if (pactAbility) ability = "cha";

    const proficient = pactAbility || isWeaponProficient({ sheet, category, name, properties });
    const abilityModifier = Number(abilityModifiers[ability] || 0);
    const attackBonus = abilityModifier + (proficient ? Number(proficiencyBonus || 0) : 0) + magicBonus;
    const rageBonus = ability === "str" ? rageDamage : 0;
    const damageBonus = abilityModifier + magicBonus + rageBonus;
    const damage = `${damageDice}${damageBonus ? (damageBonus > 0 ? `+${damageBonus}` : `${damageBonus}`) : ""}${damageType ? ` ${damageType}` : ""}`;
    const baseReach = properties.has("R") ? 10 : 5;
    const effectiveReach = mode === "melee" ? baseReach + (longLimbed ? 5 : 0) : null;
    const distance = mode === "melee" ? `Reach ${effectiveReach} ft.` : range;
    const modeLabel = mode === "melee" ? "Melee" : mode === "thrown" ? "Thrown" : "Ranged";
    const summary = [
      modeLabel,
      `${attackBonus >= 0 ? "+" : ""}${attackBonus} to hit`,
      damage,
      distance,
      proficient ? null : "not proficient",
    ].filter(Boolean).join(" • ");
    const details = [
      `${safeText(payload.item_type || payload.uiType || row?.item_type || "Weapon")}${quantity > 1 ? ` • Quantity ${quantity}` : ""}`,
      propertyText || null,
      mastery ? `Weapon Mastery: ${mastery}` : null,
      longLimbed && mode === "melee" ? "Long-Limbed: +5 feet of reach for melee attacks on your turn." : null,
      rageBonus ? `Rage damage included: +${rageBonus}.` : null,
    ].filter(Boolean);

    return {
      id: modes.length > 1 ? `${baseId}:${mode}` : baseId,
      kind: "weapon-attack",
      group: "Weapons",
      label: name,
      rollLabel: modes.length > 1 ? `${name} (${modeLabel})` : name,
      mode,
      modeLabel,
      attackBonus,
      ability,
      proficient,
      equipped: Boolean(row?.is_equipped),
      quantity,
      damage,
      summary,
      detail: summary,
      description,
      details,
      statusLabel: row?.is_equipped ? "Equipped" : "Carried",
    };
  });
}

function rageAction(sheet = {}, featureRows = []) {
  if (normalizedClassKey(sheet) !== "barbarian" && !hasNamedFeature(sheet, featureRows, "Rage")) return null;
  const feature = (Array.isArray(featureRows) ? featureRows : []).find((row) => normalizeName(row?.name) === "rage");
  const maximum = Math.max(0, Number(sheet?.rages || sheet?.actionState?.rage?.usesMax || 0));
  if (!maximum) return null;
  const state = sheet?.actionState?.rage && typeof sheet.actionState.rage === "object" ? sheet.actionState.rage : {};
  const active = Boolean(state.active);
  const storedRemaining = Number(state.usesRemaining);
  const remaining = Number.isFinite(storedRemaining) ? Math.max(0, Math.min(maximum, storedRemaining)) : maximum;
  const rageDamage = Number(sheet?.rageDamageBonus || 0);
  const summary = [
    active ? "End" : "Activate",
    "Bonus Action",
    active ? "Active" : "Inactive",
    `${remaining}/${maximum} uses`,
    rageDamage ? `+${rageDamage} Strength damage` : null,
  ].filter(Boolean).join(" • ");
  return {
    id: "feature:rage",
    kind: "feature-toggle",
    group: "Abilities",
    actionKey: "rage",
    label: "Rage",
    active,
    usesRemaining: remaining,
    usesMax: maximum,
    summary,
    detail: summary,
    description: safeText(feature?.description) || "Enter Rage as a Bonus Action to gain your Barbarian Rage benefits.",
    details: [
      `Rage damage: +${rageDamage || 0}`,
      `Uses remaining: ${remaining} of ${maximum}`,
      "Activate consumes one use. Ending Rage does not restore it.",
    ],
    statusLabel: active ? "Active" : `${remaining}/${maximum}`,
    primaryLabel: active ? "End Rage" : "Activate Rage",
    resettable: true,
  };
}

function spellAction(row, sheet, abilityModifiers, proficiencyBonus) {
  const spell = row?.spell && typeof row.spell === "object" ? row.spell : row;
  const level = Number(spell?.level || 0);
  const prepared = Boolean(row?.prepared || row?.always_available || level === 0);
  if (!prepared) return null;

  const label = safeText(spell?.name || row?.name || "Spell");
  const castingAbility = safeText(row?.casting_stat || sheet?.spellcasting?.ability || sheet?.meta?.spellcastingAbility || "").toLowerCase();
  const castingModifier = Number(abilityModifiers[castingAbility] || 0);
  const hasAttackOverride = row?.attack_bonus_override !== null && row?.attack_bonus_override !== undefined && safeText(row.attack_bonus_override) !== "";
  const hasSaveOverride = row?.save_dc_override !== null && row?.save_dc_override !== undefined && safeText(row.save_dc_override) !== "";
  const attackOverride = Number(row?.attack_bonus_override);
  const saveOverride = Number(row?.save_dc_override);
  const attackBonus = hasAttackOverride && Number.isFinite(attackOverride)
    ? attackOverride
    : castingModifier + Number(proficiencyBonus || 0);
  const saveDc = hasSaveOverride && Number.isFinite(saveOverride)
    ? saveOverride
    : 8 + castingModifier + Number(proficiencyBonus || 0);
  const attackType = safeText(spell?.attack_type).toLowerCase();
  const saveAbilities = Array.isArray(spell?.saving_throw_abilities) ? spell.saving_throw_abilities.map(safeText).filter(Boolean) : [];
  const damageDice = safeText(spell?.damage_dice);
  const damageTypes = Array.isArray(spell?.damage_types) ? spell.damage_types.map(damageTypeLabel).filter(Boolean) : [];
  const healingDice = safeText(spell?.healing_dice);
  const isAttack = Boolean(attackType && attackType !== "none" && attackType !== "other");
  const usesMax = Number(row?.uses_max);
  const usesRemaining = Number(row?.uses_remaining);
  const hasLimitedUses = row?.uses_max !== null && row?.uses_max !== undefined && Number.isFinite(usesMax) && usesMax > 0;
  const recharge = safeText(row?.recharge).replace(/_/g, " ");
  const pactSlots = Number(sheet?.spellcasting?.pactSlots);
  const pactSlotLevel = Number(sheet?.spellcasting?.pactSlotLevel);
  const pactSlotText = level > 0 && Number.isFinite(pactSlots) && pactSlots > 0
    ? `${pactSlots} level-${Number.isFinite(pactSlotLevel) && pactSlotLevel > 0 ? pactSlotLevel : level} pact slots`
    : "";
  const resourceText = hasLimitedUses
    ? `${Number.isFinite(usesRemaining) ? usesRemaining : usesMax}/${usesMax} uses${recharge ? ` • ${recharge}` : ""}`
    : pactSlotText;
  const kind = isAttack ? "spell-attack" : saveAbilities.length ? "spell-save" : healingDice ? "spell-healing" : "spell-effect";
  const resolution = isAttack
    ? `${attackBonus >= 0 ? "+" : ""}${attackBonus} spell attack`
    : saveAbilities.length
      ? `${saveAbilities.map((value) => value.toUpperCase()).join("/")} save DC ${saveDc}`
      : healingDice
        ? `${healingDice} healing`
        : "Resolve spell effect";

  return {
    id: `spell:${row?.id || spell?.id || label}`,
    kind,
    group: level === 0 ? "Cantrips" : "Prepared Spells",
    label,
    level,
    attackBonus: isAttack ? attackBonus : null,
    saveDc: saveAbilities.length ? saveDc : null,
    saveAbilities,
    damage: [damageDice, damageTypes.join("/")].filter(Boolean).join(" "),
    healing: healingDice,
    summary: [resolution, safeText(spell?.range_text), safeText(spell?.casting_time), resourceText].filter(Boolean).join(" • "),
    detail: [resolution, safeText(spell?.range_text), safeText(spell?.casting_time), resourceText].filter(Boolean).join(" • "),
    description: cleanRulesText(spell?.description || spell?.entries || ""),
    details: [
      level === 0 ? "Cantrip" : `Level ${level} spell`,
      resourceText || null,
    ].filter(Boolean),
    statusLabel: level === 0 ? "Cantrip" : `Level ${level}`,
    resolutionText: [
      `${label}: ${resolution}`,
      damageDice ? `${damageDice}${damageTypes.length ? ` ${damageTypes.join("/")}` : ""} damage` : null,
      healingDice ? `${healingDice} healing` : null,
    ].filter(Boolean).join(" • "),
  };
}

export function buildCharacterSheetActions({
  sheet = {},
  inventoryRows = [],
  spellRows = [],
  featureRows = [],
  abilityModifiers = {},
  proficiencyBonus = 2,
} = {}) {
  const weapons = (Array.isArray(inventoryRows) ? inventoryRows : [])
    .flatMap((row) => weaponActions(row, sheet, abilityModifiers, proficiencyBonus, featureRows))
    .sort((a, b) => Number(b.equipped) - Number(a.equipped) || a.label.localeCompare(b.label) || safeText(a.modeLabel).localeCompare(safeText(b.modeLabel)));
  const spells = (Array.isArray(spellRows) ? spellRows : [])
    .map((row) => spellAction(row, sheet, abilityModifiers, proficiencyBonus))
    .filter(Boolean)
    .sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
  const abilities = [rageAction(sheet, featureRows)].filter(Boolean);
  return [...abilities, ...weapons, ...spells];
}

export function formatInventoryEquipmentText(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const name = itemName(row);
      const quantity = Math.max(1, Number(row?.quantity || 1));
      return `${name}${quantity > 1 ? ` ×${quantity}` : ""}${row?.is_equipped ? " (equipped)" : ""}`;
    })
    .filter(Boolean)
    .join("\n");
}

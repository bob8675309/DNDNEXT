import { buildCharacterSheetActions } from "./characterSheetActions.js";

// SHADOW-ONLY: diagnostic parity with the EXISTING player sheet weapon builder.
// This does not fetch trusted sources or authorize equipment / gameplay effects.
// Input snapshots must come from the server-side private source-gate work; never
// use client-supplied versions as enforcement evidence.
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const MAGICAL_WEAPON_KEYS = ["bonusWeapon", "bonus_weapon", "enhancement_bonus"];

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(label + " must be an object");
  }
}
function numericModifiers(result, label) {
  assertObject(result, label);
  assertObject(result.abilities, label + ".abilities");
  return Object.fromEntries(ABILITIES.map((key) => {
    const value = result.abilities[key]?.effectiveMod;
    if (!Number.isFinite(value)) throw new TypeError(label + " missing numeric " + key);
    return [key, value];
  }));
}
function isWeaponAction(action) {
  return action?.kind === "weapon-attack";
}
function sameData(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function getBonusField(row) {
  // The real sheet uses card_payload followed by row fields, and resolves
  // bonusWeapon -> bonus_weapon -> enhancement_bonus -> smith_tier by truthiness.
  const merged = { ...(row.card_payload || {}), ...row };
  return MAGICAL_WEAPON_KEYS.find((key) => Boolean(merged[key])) || null;
}
function maskMagicWeaponBonus(row) {
  // Zeroing highest-priority bonusWeapon prevents smith_tier and legacy aliases
  // from being mistakenly promoted as magical replacement/stacked bonuses.
  // Do NOT modify the original inventory object or physical weapon fields.
  return {
    ...row,
    bonusWeapon: "0",
    card_payload: { ...(row.card_payload || {}), bonusWeapon: "0" },
  };
}
function modeSummary(action) {
  return (Array.isArray(action.modes) ? action.modes : [action]).map((mode) => ({
    mode: mode.mode,
    ability: mode.ability,
    attackBonus: mode.attackBonus,
    damageFormula: mode.damageFormula,
    damageType: mode.damageType,
    proficient: mode.proficient,
  }));
}

/**
 * Compare player-sheet weapon actions built by the existing code using
 * authoritative-equipment baseline vs. selected-item ability projections.
 * Does not call Supabase, roll dice, mutate inventory or update the UI.
 *
 * No consumer may treat the returned candidate as live sheet/encounter truth.
 * It cannot prove catalog-to-card payload parity, class exception validity,
 * crafted weapon provenance or a server-authorized rest opportunity.
 */
export function compareAttunedPlayerSheetWeaponActions({
  characterId,
  sheet = {},
  inventoryRows = [],
  featureRows = [],
  proficiencyBonus = 2,
  abilityShadow,
  sourceGate,
} = {}) {
  assertObject(abilityShadow, "abilityShadow");
  assertObject(sourceGate, "sourceGate");
  if (!characterId || String(sourceGate.characterId) !== String(characterId)) {
    throw new Error("Exact trusted character identity is required");
  }
  if (sourceGate.schemaVersion !== 1 || sourceGate.consumerEnforced !== false
      || abilityShadow.consumerEnforced !== false
      || typeof sourceGate.attunementEnabled !== "boolean"
      || sourceGate.attunementEnabled !== abilityShadow.attunementEnabled
      || !Array.isArray(sourceGate.items) || !Array.isArray(inventoryRows)) {
    throw new Error("Incompatible server-side shadow and source-gate contracts");
  }
  const baselineModifiers = numericModifiers(abilityShadow.baseline, "abilityShadow.baseline");
  const projectedModifiers = numericModifiers(abilityShadow.shadow, "abilityShadow.shadow");
  const choices = new Map();
  for (const item of sourceGate.items) {
    assertObject(item, "sourceGate.item");
    const id = String(item.inventoryItemId || "");
    if (!id || choices.has(id) || item.physicalEquipped !== true
        || typeof item.magicRiderEligible !== "boolean") {
      throw new Error("Duplicate, unequipped or unverified trusted source identity");
    }
    choices.set(id, item);
  }

  const unresolvedSources = [];
  const candidateInventory = inventoryRows.map((row) => {
    assertObject(row, "inventory row");
    const id = String(row.id || "");
    const bonusField = getBonusField(row);
    if (!row.is_equipped) {
      if (bonusField) unresolvedSources.push({ inventoryItemId: id, reason: "carried_weapon_not_equipped" });
      return row;
    }
    if (!id || !choices.has(id)) {
      throw new Error("Equipped inventory row lacks verified character source: " + id);
    }
    const source = choices.get(id);
    if (source.magicRiderEligible || !sourceGate.attunementEnabled) return row;
    if (!bonusField) {
      const merged = { ...(row.card_payload || {}), ...row };
      if (merged.smith_tier) {
        unresolvedSources.push({ inventoryItemId: id, reason: "smith_tier_physical_or_magic_unknown" });
      }
      return row;
    }
    const merged = { ...(row.card_payload || {}), ...row };
    if (merged.smith_tier) {
      unresolvedSources.push({ inventoryItemId: id, reason: "mixed_smith_and_magical_bonus_unknown" });
    }
    if (source.sourceMagicVerified !== true) {
      unresolvedSources.push({ inventoryItemId: id, reason: "unverified_magic_source_payload" });
    }
    return maskMagicWeaponBonus(row);
  });

  const args = { sheet, featureRows, proficiencyBonus, spellRows: [] };
  const baselineActions = buildCharacterSheetActions({
    ...args, inventoryRows, abilityModifiers: baselineModifiers,
  });
  if (!sourceGate.attunementEnabled) {
    return {
      schemaVersion: 1, characterId, attunementEnabled: false,
      consumerEnforced: false, sheetWeaponParityReady: false,
      baselineActions, shadowActions: baselineActions,
      changes: [], unresolvedSources,
    };
  }
  const shadowActions = buildCharacterSheetActions({
    ...args, inventoryRows: candidateInventory, abilityModifiers: projectedModifiers,
  });
  const expectedIds = baselineActions.map((a) => a.id);
  if (!sameData(expectedIds, shadowActions.map((a) => a.id))) {
    throw new Error("Character sheet action identity or order changed");
  }

  const changes = [];
  for (let index = 0; index < baselineActions.length; index += 1) {
    const before = baselineActions[index], after = shadowActions[index];
    if (!isWeaponAction(before)) {
      if (!sameData(before, after)) {
        throw new Error("Nonweapon character feature changed in weapon shadow");
      }
      continue;
    }
    const baselineModes = modeSummary(before);
    const shadowModes = modeSummary(after);
    if (!sameData(baselineModes, shadowModes)) {
      changes.push({
        actionId: before.id,
        baselineModes, shadowModes,
        sourceInventoryItemId: String(before.id).slice("weapon:".length),
      });
    }
    // Preserve all original action meta, weapon dice, property presentation and
    // equip status. Only ability/attack/damage projection is permitted to differ.
    for (const key of ["id", "kind", "label", "equipped", "quantity", "defaultMode", "statusLabel", "description"]) {
      if (!sameData(before[key], after[key])) {
        throw new Error("Physical weapon action property changed: " + key);
      }
    }
  }
  return {
    schemaVersion: 1, characterId, attunementEnabled: true,
    consumerEnforced: false, sheetWeaponParityReady: false,
    baselineActions, shadowActions, changes, unresolvedSources,
    spellConsumerParityReady: false,
    catalogInstanceParityReady: false,
    serverRestOpportunityVerified: false,
  };
}

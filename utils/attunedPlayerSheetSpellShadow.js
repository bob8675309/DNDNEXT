import { buildCharacterSheetActions } from "./characterSheetActions.js";

// DIAGNOSTIC ONLY. The authoritative equipment/attunement source gate is a
// server-side result; passing a lookalike object here does NOT authorize play.
// No production sheet, spell, combat or database consumer imports this module.
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const SPELL_KINDS = new Set(["spell-attack", "spell-save", "spell-healing", "spell-effect"]);

function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(name + " must be an object");
  }
  return value;
}

function abilityModifiers(snapshot, name) {
  object(snapshot, name);
  object(snapshot.abilities, name + ".abilities");
  return Object.fromEntries(ABILITIES.map((ability) => {
    const modifier = snapshot.abilities[ability]?.effectiveMod;
    if (typeof modifier !== "number" || !Number.isFinite(modifier)) {
      throw new Error(name + " lacks a verified " + ability + " effective modifier");
    }
    return [ability, modifier];
  }));
}

function castingAbilityFor(row, sheet) {
  return String(row?.casting_stat || sheet?.spellcasting?.ability ||
    sheet?.meta?.spellcastingAbility || "").trim().toLowerCase();
}

function overrideStatus(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "none";
  }
  return Number.isFinite(Number(value)) ? "numeric" : "invalid";
}

function spellAction(action) {
  return SPELL_KINDS.has(action?.kind);
}

function equals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function visibleSpellRows(rows) {
  return rows.filter((row) => {
    const spell = row?.spell && typeof row.spell === "object" ? row.spell : row;
    return Boolean(row?.prepared || row?.always_available || Number(spell?.level || 0) === 0);
  });
}

/**
 * Read-only OFF/ON comparison using the UNMODIFIED player sheet action builder.
 *
 * It changes only the effective casting-ability modifiers consumed by
 * spellAction(). Explicit per-spell attack/DC overrides stay exactly as-is;
 * their origins are UNKNOWN and must not be treated as legitimate magical
 * bonuses or used to override a future trusted resolver.
 */
export function compareAttunedPlayerSheetSpells({
  characterId,
  sheet = {},
  spellRows = [],
  proficiencyBonus = 2,
  abilityShadow,
  sourceGate,
} = {}) {
  object(sheet, "sheet");
  object(abilityShadow, "abilityShadow");
  object(sourceGate, "sourceGate");
  if (!characterId || String(sourceGate.characterId) !== String(characterId)) {
    throw new Error("Spell shadow requires the exact selected character identity");
  }
  if (sourceGate.schemaVersion !== 1 || abilityShadow.schemaVersion !== 1 ||
      sourceGate.consumerEnforced !== false || abilityShadow.consumerEnforced !== false ||
      typeof sourceGate.attunementEnabled !== "boolean" ||
      sourceGate.attunementEnabled !== abilityShadow.attunementEnabled ||
      !Array.isArray(sourceGate.items) || !Array.isArray(spellRows)) {
    throw new Error("Incompatible source-gate or ability-shadow contract");
  }

  // OFF must remain EXACT character-sheet behavior even when the campaign has
  // no saved item choices, and without needing the ON ability projection.
  const baselineMods = abilityModifiers(abilityShadow.baseline, "abilityShadow.baseline");
  const actionsFor = (abilityModifiers) => buildCharacterSheetActions({
    sheet, spellRows, abilityModifiers, proficiencyBonus,
    inventoryRows: [], featureRows: [],
  });
  const originalActions = actionsFor(baselineMods);
  const baselineActions = originalActions.filter(spellAction);
  if (!sourceGate.attunementEnabled) {
    return {
      schemaVersion: 1, characterId, attunementEnabled: false,
      consumerEnforced: false, sheetSpellParityReady: false,
      baselineActions, shadowActions: baselineActions,
      changes: [], unresolvedSources: [],
      equipmentSpellBonusProvenanceVerified: false,
      spellDamageRidersVerified: false, tacticalSpellParityReady: false,
    };
  }

  const eligibleMods = abilityModifiers(abilityShadow.shadow, "abilityShadow.shadow");
  const candidateActions = actionsFor(eligibleMods);
  const shadowActions = candidateActions.filter(spellAction);
  if (!equals(originalActions.filter((action) => !spellAction(action)),
              candidateActions.filter((action) => !spellAction(action)))) {
    throw new Error("Spell comparison modified a non-spell class action");
  }
  if (!equals(baselineActions.map((action) => action.id),
              shadowActions.map((action) => action.id))) {
    throw new Error("Spell identity/order changed under attunement");
  }

  const rowsById = new Map();
  for (const row of visibleSpellRows(spellRows)) {
    object(row, "spell row");
    const spell = row.spell && typeof row.spell === "object" ? row.spell : row;
    const id = "spell:" + String(row.id || spell.id || spell.name || "Spell");
    if (rowsById.has(id)) {
      throw new Error("Duplicate visible spell-action identity: " + id);
    }
    rowsById.set(id, row);
  }

  const unresolvedSources = [];
  const changes = [];
  for (let index = 0; index < baselineActions.length; index += 1) {
    const before = baselineActions[index];
    const after = shadowActions[index];
    const row = rowsById.get(before.id);
    if (!row) throw new Error("Original spell action lacks a matching spell assignment");
    const stat = castingAbilityFor(row, sheet);
    const attackOverride = overrideStatus(row.attack_bonus_override);
    const saveOverride = overrideStatus(row.save_dc_override);

    if (!ABILITIES.includes(stat)) {
      unresolvedSources.push({ spellActionId: before.id, reason: "casting_ability_unverified" });
    }
    for (const [field, status] of [
      ["attack_bonus_override", attackOverride],
      ["save_dc_override", saveOverride],
    ]) {
      if (status === "numeric") {
        unresolvedSources.push({
          spellActionId: before.id, field,
          reason: "explicit_spell_override_origin_unverified",
        });
      } else if (status === "invalid") {
        unresolvedSources.push({
          spellActionId: before.id, field,
          reason: "invalid_spell_override_fell_back_to_ability",
        });
      }
    }

    // Damage dice, spell group, slot/charge display, preparation, components
    // and spell descriptions must remain from the original action builder.
    for (const key of [
      "id", "kind", "group", "label", "level", "saveAbilities",
      "damage", "damageFormula", "damageType", "healing",
      "description", "statusLabel",
    ]) {
      if (!equals(before[key], after[key])) {
        throw new Error("Non-numeric spell action property changed: " + key);
      }
    }
    if (before.attackBonus !== after.attackBonus || before.saveDc !== after.saveDc) {
      changes.push({
        spellActionId: before.id,
        castingAbility: stat,
        baselineAttackBonus: before.attackBonus,
        shadowAttackBonus: after.attackBonus,
        baselineSaveDc: before.saveDc,
        shadowSaveDc: after.saveDc,
        attackOverrideStatus: attackOverride,
        saveOverrideStatus: saveOverride,
      });
    }
  }

  // Stored spellcasting attack/DC fields are not read by the current player
  // quick-action builder. Flag them, rather than implying item bonuses or
  // persisted caster overrides were included in this comparison.
  for (const key of ["spellAttackBonus", "spellSaveDc"]) {
    if (sheet?.spellcasting?.[key] != null || sheet?.[key] != null) {
      unresolvedSources.push({ field: key, reason: "stored_spellcasting_stat_not_used_by_quick_actions" });
    }
  }

  return {
    schemaVersion: 1, characterId, attunementEnabled: true,
    consumerEnforced: false, sheetSpellParityReady: false,
    baselineActions, shadowActions, changes, unresolvedSources,
    equipmentSpellBonusProvenanceVerified: false,
    spellDamageRidersVerified: false,
    tacticalSpellParityReady: false,
    spellAssignmentProvenanceVerified: false,
    serverRestOpportunityVerified: false,
  };
}

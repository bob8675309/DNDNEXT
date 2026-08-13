import { maximumSpellLevelFromSlots, normalizedSpellName } from "./playerForgeRules";

const text = (value) => String(value ?? "").trim();
const norm = (value) => normalizedSpellName(value);

const THIRD_CASTER_SLOTS = Object.freeze({
  3: [2], 4: [3], 5: [3], 6: [3], 7: [4, 2], 8: [4, 2], 9: [4, 2], 10: [4, 3], 11: [4, 3], 12: [4, 3],
  13: [4, 3, 2], 14: [4, 3, 2], 15: [4, 3, 2], 16: [4, 3, 3], 17: [4, 3, 3], 18: [4, 3, 3], 19: [4, 3, 3, 1], 20: [4, 3, 3, 1],
});

const THIRD_CASTER_PREPARED = Object.freeze({
  3: 3, 4: 4, 5: 4, 6: 4, 7: 5, 8: 6, 9: 6, 10: 7, 11: 8, 12: 8, 13: 9, 14: 10, 15: 10, 16: 11, 17: 11, 18: 11, 19: 12, 20: 13,
});

function thirdCasterSlots(level) {
  const resolved = Math.max(3, Math.min(20, Number(level || 3)));
  return [...(THIRD_CASTER_SLOTS[resolved] || [])];
}

function thirdCasterPrepared(level) {
  const resolved = Math.max(3, Math.min(20, Number(level || 3)));
  return Number(THIRD_CASTER_PREPARED[resolved] || 3);
}

export function subclassStartingSpellSelectionModel(selectedClass = null, selectedSubclass = null, characterLevel = 1) {
  const level = Math.max(1, Math.min(20, Number(characterLevel || 1)));
  if (level < 3 || !selectedClass || !selectedSubclass) return null;
  const classKey = norm(selectedClass.class_key || selectedClass.class_name);
  const subclassName = norm(selectedSubclass.name);
  const source = selectedSubclass.source || selectedClass.source || "XPHB";
  if (source !== "XPHB") return null;
  const eldritchKnight = classKey === "fighter" && subclassName === "eldritch knight";
  const arcaneTrickster = classKey === "rogue" && subclassName === "arcane trickster";
  if (!eldritchKnight && !arcaneTrickster) return null;
  const slots = thirdCasterSlots(level);
  const totalCantrips = eldritchKnight ? (level >= 10 ? 3 : 2) : (level >= 10 ? 4 : 3);
  const fixedSpells = arcaneTrickster ? [{ name: "Mage Hand", level: 0, prepared: true }] : [];
  const choiceCantrips = Math.max(0, totalCantrips - fixedSpells.length);
  const prepared = thirdCasterPrepared(level);
  return {
    classKey,
    mode: "prepared",
    cantrips: choiceCantrips,
    totalCantrips,
    leveled: prepared,
    prepared,
    maximumSpellLevel: maximumSpellLevelFromSlots(slots),
    spellSlots: slots,
    required: choiceCantrips + prepared > 0,
    sourceType: "subclass",
    sourceKey: `${selectedClass.class_key || classKey}:${selectedSubclass.key || selectedSubclass.name}`,
    sourceLabel: `${selectedSubclass.name} Spellcasting`,
    spellListClass: "Wizard",
    castingAbility: "int",
    fixedSpells,
    replacementCadence: "level-up",
  };
}

export function spellAllowedForStartingModel(spell = {}, model = null, selectedClass = null, expandedSpellNames = []) {
  if (!model || model.mode === "none") return false;
  const name = norm(spell.name);
  const expanded = new Set((Array.isArray(expandedSpellNames) ? expandedSpellNames : []).map(norm));
  if (expanded.has(name)) return true;
  const listClass = text(model.spellListClass || selectedClass?.class_name);
  return Array.isArray(spell.classes) && spell.classes.some((value) => norm(value) === norm(listClass));
}

export function startingSpellSourceForRow(spell = {}, model = null, expandedSpellNames = []) {
  const expanded = new Set((Array.isArray(expandedSpellNames) ? expandedSpellNames : []).map(norm));
  if (expanded.has(norm(spell.name)) && model?.sourceType === "class") return { sourceType: "class", sourceKey: model.sourceKey || model.classKey || "class", accessType: "background-expanded" };
  return { sourceType: model?.sourceType || "class", sourceKey: model?.sourceKey || model?.classKey || "class", accessType: model?.sourceType === "subclass" ? "subclass" : "class-list" };
}

export function serializeStartingMagicSelections(spells = [], selections = {}, model = null) {
  const byId = new Map((Array.isArray(spells) ? spells : []).map((spell) => [String(spell.id), spell]));
  const output = [];
  for (const [spellId, choice] of Object.entries(selections || {})) {
    if (!choice) continue;
    const spell = byId.get(String(spellId));
    if (!spell) continue;
    output.push({
      spell_id: spell.id,
      spell_key: spell.spell_key || null,
      name: spell.name,
      source: spell.source || null,
      level: Number(spell.level || 0),
      prepared: Number(spell.level || 0) === 0 ? true : Boolean(choice.prepared),
      source_type: choice.sourceType || model?.sourceType || "class",
      source_key: choice.sourceKey || model?.sourceKey || model?.classKey || "class",
      access_type: choice.accessType || null,
      casting_ability: model?.castingAbility || null,
      fixed: false,
    });
  }
  for (const fixed of model?.fixedSpells || []) {
    const spell = (Array.isArray(spells) ? spells : []).find((candidate) => norm(candidate.name) === norm(fixed.name));
    if (!spell || output.some((entry) => String(entry.spell_id) === String(spell.id))) continue;
    output.push({ spell_id: spell.id, spell_key: spell.spell_key || null, name: spell.name, source: spell.source || null, level: Number(spell.level || 0), prepared: fixed.prepared !== false, source_type: model?.sourceType || "subclass", source_key: model?.sourceKey || "subclass", access_type: "fixed", casting_ability: model?.castingAbility || null, fixed: true });
  }
  return output;
}

import classProgression from "../../public/spells/class-progression.json";
import { spellMatchesExpandedList } from "../backgroundMechanics.js";

const ABILITY_LABELS = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export function normalizeClassKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .find((part) => Object.prototype.hasOwnProperty.call(classProgression, part)) || "";
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return Math.max(1, Math.min(20, Math.round(number)));
  }
  return 1;
}

export function resolveCharacterSpellProfile(sheet = {}, character = {}) {
  const meta = sheet?.meta && typeof sheet.meta === "object" ? sheet.meta : {};
  const rawClass = sheet.className || sheet.class || sheet.classKey || meta.className || meta.class || meta.classKey || character.className || character.class || character.role || "";
  const classKey = normalizeClassKey(rawClass);
  const rule = classKey ? classProgression[classKey] || null : null;
  const className = rule?.name || String(rawClass || "").trim();
  const level = firstNumber(sheet.level, meta.level, character.level);
  const abilityKey = String(sheet?.spellcasting?.ability || rule?.castingAbility || "").toLowerCase();
  const backgroundExpandedSpells = [
    ...(Array.isArray(sheet.backgroundExpandedSpells) ? sheet.backgroundExpandedSpells : []),
    ...(Array.isArray(sheet?.spellcasting?.backgroundExpandedSpells) ? sheet.spellcasting.backgroundExpandedSpells : []),
    ...(Array.isArray(meta.backgroundExpandedSpells) ? meta.backgroundExpandedSpells : []),
  ];

  return {
    classKey,
    className,
    level,
    rule,
    castingAbility: abilityKey,
    castingAbilityLabel: ABILITY_LABELS[abilityKey] || abilityKey || "Unset",
    backgroundExpandedSpells: [...new Set(backgroundExpandedSpells.map((name) => String(name || "").trim()).filter(Boolean))],
  };
}

export function spellMatchesClass(spell = {}, classKey = "") {
  const normalized = normalizeClassKey(classKey);
  if (!normalized) return false;
  const values = Array.isArray(spell.classes) ? spell.classes : [];
  return values.some((value) => normalizeClassKey(value) === normalized);
}

export function spellMatchesCharacterProfile(spell = {}, profile = {}) {
  return spellMatchesClass(spell, profile?.classKey)
    || spellMatchesExpandedList(spell, profile?.backgroundExpandedSpells || []);
}

export function spellUnlockLevel(spellLevel, rule = null) {
  const level = Number(spellLevel || 0);
  if (level === 0) return rule?.cantripsAtLevel ?? null;
  const value = rule?.spellUnlockLevels?.[String(level)];
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function isSpellUnlockedForCharacter(spell = {}, profile = {}) {
  const spellLevel = Number(spell.level || 0);
  if (!profile?.rule) return true;
  const unlockAt = spellUnlockLevel(spellLevel, profile.rule);
  if (unlockAt == null) return false;
  return Number(profile.level || 1) >= unlockAt;
}

export function highestUnlockedSpellLevel(profile = {}) {
  if (!profile?.rule) return null;
  let highest = profile.rule.cantripsAtLevel && Number(profile.level || 1) >= profile.rule.cantripsAtLevel ? 0 : null;
  for (const [spellLevel, characterLevel] of Object.entries(profile.rule.spellUnlockLevels || {})) {
    if (Number(profile.level || 1) >= Number(characterLevel || 99)) highest = Math.max(highest ?? 0, Number(spellLevel));
  }
  return highest;
}

export function spellLevelLabel(level) {
  const numeric = Number(level || 0);
  return numeric === 0 ? "Cantrip" : `Level ${numeric}`;
}

import { ABILITY_KEYS } from "./characterCreation";

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;
export const POINT_BUY_COSTS = Object.freeze({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 });

function rollDie(random = Math.random) {
  return Math.floor(random() * 6) + 1;
}

function rollId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function rollAbilityTotal(method = "4d6", random = Math.random) {
  if (method === "3d6") {
    const dice = [rollDie(random), rollDie(random), rollDie(random)];
    return { id: rollId(), dice, droppedIndex: -1, total: dice.reduce((sum, die) => sum + die, 0), method };
  }
  const dice = [rollDie(random), rollDie(random), rollDie(random), rollDie(random)];
  const droppedIndex = dice.indexOf(Math.min(...dice));
  return {
    id: rollId(),
    dice,
    droppedIndex,
    total: dice.reduce((sum, die, index) => sum + (index === droppedIndex ? 0 : die), 0),
    method: "4d6",
  };
}

export function rollAbilityPoolForMethod(method = "4d6", random = Math.random) {
  return Array.from({ length: 6 }, () => rollAbilityTotal(method, random));
}

export function emptyPointBuyScores() {
  return Object.fromEntries(ABILITY_KEYS.map((key) => [key, POINT_BUY_MIN]));
}

export function pointBuyCost(scores = {}) {
  return ABILITY_KEYS.reduce((total, key) => {
    const score = Math.max(POINT_BUY_MIN, Math.min(POINT_BUY_MAX, Number(scores?.[key] ?? POINT_BUY_MIN)));
    return total + (POINT_BUY_COSTS[score] ?? 0);
  }, 0);
}

export function pointBuyRemaining(scores = {}) {
  return POINT_BUY_BUDGET - pointBuyCost(scores);
}

export function canSetPointBuyScore(scores = {}, key, nextScore) {
  if (!ABILITY_KEYS.includes(key)) return false;
  const score = Number(nextScore);
  if (!Number.isInteger(score) || score < POINT_BUY_MIN || score > POINT_BUY_MAX) return false;
  return pointBuyRemaining({ ...scores, [key]: score }) >= 0;
}

export function maximumSpellLevelFromSlots(spellSlots) {
  if (!Array.isArray(spellSlots)) return 0;
  let maximum = 0;
  spellSlots.forEach((count, index) => {
    if (Number(count || 0) > 0) maximum = index + 1;
  });
  return maximum;
}

const PREPARED_LIST_CLASSES = new Set(["artificer", "cleric", "druid", "paladin"]);
const KNOWN_LIST_CLASSES = new Set(["bard", "ranger", "sorcerer", "warlock", "spellcaster-sidekick"]);

export function startingSpellSelectionModel(classRow = null, levelRow = null, characterLevel = 1) {
  const classKey = String(classRow?.class_key || "").toLowerCase();
  const spellcasting = Boolean(classRow?.spellcasting_ability);
  if (!spellcasting) {
    return { classKey, mode: "none", cantrips: 0, leveled: 0, prepared: 0, maximumSpellLevel: 0, spellSlots: [], required: false, catalogReady: true };
  }
  const level = Math.max(1, Math.min(20, Number(characterLevel || levelRow?.class_level || 1)));
  const cantrips = Math.max(0, Number(levelRow?.cantrips_known || 0));
  const progressionCount = Math.max(0, Number(levelRow?.spells_known || 0));
  const maximumSpellLevel = Math.max(1, maximumSpellLevelFromSlots(levelRow?.spell_slots));
  const spellSlots = Array.isArray(levelRow?.spell_slots) ? levelRow.spell_slots : [];
  if (classKey === "wizard") {
    const spellbook = 6 + Math.max(0, level - 1) * 2;
    return { classKey, mode: "spellbook", cantrips, leveled: spellbook, prepared: Math.min(spellbook, progressionCount), maximumSpellLevel, spellSlots, required: cantrips + spellbook > 0, catalogReady: true };
  }
  const mode = PREPARED_LIST_CLASSES.has(classKey) ? "prepared" : KNOWN_LIST_CLASSES.has(classKey) ? "known" : "known";
  return { classKey, mode, cantrips, leveled: progressionCount, prepared: progressionCount, maximumSpellLevel, spellSlots, required: cantrips + progressionCount > 0, catalogReady: true };
}

export function countStartingSpellSelections(spells = [], selections = {}) {
  const byId = new Map((Array.isArray(spells) ? spells : []).map((spell) => [String(spell.id), spell]));
  let cantrips = 0;
  let leveled = 0;
  let prepared = 0;
  for (const [spellId, choice] of Object.entries(selections || {})) {
    if (!choice) continue;
    const spell = byId.get(String(spellId));
    if (!spell) continue;
    if (Number(spell.level || 0) === 0) {
      cantrips += 1;
      prepared += 1;
    } else {
      leveled += 1;
      if (choice.prepared) prepared += 1;
    }
  }
  return { cantrips, leveled, prepared };
}

export function validateStartingSpellSelections(model, spells = [], selections = {}) {
  if (!model || model.mode === "none") return [];
  const counts = countStartingSpellSelections(spells, selections);
  const errors = [];
  if (counts.cantrips !== model.cantrips) errors.push(`Choose exactly ${model.cantrips} cantrip${model.cantrips === 1 ? "" : "s"}.`);
  if (counts.leveled !== model.leveled) {
    const label = model.mode === "spellbook" ? "spellbook spell" : model.mode === "prepared" ? "prepared spell" : "known spell";
    errors.push(`Choose exactly ${model.leveled} ${label}${model.leveled === 1 ? "" : "s"}.`);
  }
  if (model.mode === "spellbook" && counts.prepared !== model.prepared + model.cantrips) errors.push(`Prepare exactly ${model.prepared} leveled spell${model.prepared === 1 ? "" : "s"} from the spellbook.`);
  return errors;
}

export function spellChoicesForRpc(spells = [], selections = {}) {
  return (Array.isArray(spells) ? spells : [])
    .filter((spell) => selections?.[spell.id])
    .map((spell) => ({ spell_id: spell.id, prepared: Number(spell.level || 0) === 0 ? true : Boolean(selections[spell.id]?.prepared) }));
}

export function normalizedSpellName(value = "") {
  return String(value || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function spellRowCompleteness(row = {}) {
  return [row.description, row.casting_time, row.range_text, row.duration_text, row.school, row.components_text]
    .reduce((score, value) => score + (String(value || "").trim() ? 1 : 0), 0);
}

export function preferSpellRows(rows = []) {
  const preferred = new Map();
  const sourceRank = (source) => source === "XPHB" ? 0 : source === "PHB" ? 1 : 2;
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = normalizedSpellName(row?.name);
    if (!key) continue;
    const current = preferred.get(key);
    const nextRank = sourceRank(row?.source);
    const currentRank = sourceRank(current?.source);
    if (!current || nextRank < currentRank || (nextRank === currentRank && spellRowCompleteness(row) > spellRowCompleteness(current))) preferred.set(key, row);
  }
  return [...preferred.values()].sort((a, b) => Number(a.level || 0) - Number(b.level || 0) || String(a.name || "").localeCompare(String(b.name || "")));
}

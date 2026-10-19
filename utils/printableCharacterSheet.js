import {
  calculateArmorClass,
  calculateInitiativeModifier,
  calculatePassivePerception,
  resolveClassUnarmoredDefense,
} from "./characterSheetRules.js";
import { buildCharacterSheetActions } from "./characterSheetActions.js";
import { formatPlayerFacingText } from "./playerFacingText.js";

export const PRINTABLE_ABILITIES = Object.freeze([
  { key: "str", name: "Strength", short: "STR" },
  { key: "dex", name: "Dexterity", short: "DEX" },
  { key: "con", name: "Constitution", short: "CON" },
  { key: "int", name: "Intelligence", short: "INT" },
  { key: "wis", name: "Wisdom", short: "WIS" },
  { key: "cha", name: "Charisma", short: "CHA" },
]);

export const PRINTABLE_SKILLS = Object.freeze([
  { key: "acrobatics", name: "Acrobatics", ability: "dex" },
  { key: "animalHandling", name: "Animal Handling", ability: "wis" },
  { key: "arcana", name: "Arcana", ability: "int" },
  { key: "athletics", name: "Athletics", ability: "str" },
  { key: "deception", name: "Deception", ability: "cha" },
  { key: "history", name: "History", ability: "int" },
  { key: "insight", name: "Insight", ability: "wis" },
  { key: "intimidation", name: "Intimidation", ability: "cha" },
  { key: "investigation", name: "Investigation", ability: "int" },
  { key: "medicine", name: "Medicine", ability: "wis" },
  { key: "nature", name: "Nature", ability: "int" },
  { key: "perception", name: "Perception", ability: "wis" },
  { key: "performance", name: "Performance", ability: "cha" },
  { key: "persuasion", name: "Persuasion", ability: "cha" },
  { key: "religion", name: "Religion", ability: "int" },
  { key: "sleightOfHand", name: "Sleight of Hand", ability: "dex" },
  { key: "stealth", name: "Stealth", ability: "dex" },
  { key: "survival", name: "Survival", ability: "wis" },
]);

function safeText(value) {
  return String(value ?? "").trim();
}

function playerFacingText(value, fallback = "") {
  return formatPlayerFacingText(String(value ?? ""), fallback).trim();
}

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function uniqueText(values) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : [values]) {
    const text = safeText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function readableText(value, depth = 0) {
  if (value == null || depth > 5) return "";
  if (typeof value === "string" || typeof value === "number") return playerFacingText(value);
  if (Array.isArray(value)) {
    return playerFacingText(value
      .map((entry) => readableText(entry, depth + 1))
      .filter(Boolean)
      .join("\n"));
  }
  if (typeof value === "object") {
    if (value.entries) return readableText(value.entries, depth + 1);
    if (value.entry) return readableText(value.entry, depth + 1);
    if (value.text) return readableText(value.text, depth + 1);
    if (value.description) return readableText(value.description, depth + 1);
    if (value.name && value.value) return playerFacingText(`${safeText(value.name)}: ${readableText(value.value, depth + 1)}`);
  }
  return "";
}

function modFromScore(score) {
  return Math.floor((finiteNumber(score, 10) - 10) / 2);
}

export function formatPrintableModifier(value) {
  const n = finiteNumber(value, 0);
  return n >= 0 ? `+${n}` : String(n);
}

function rollMode(advantage, disadvantage) {
  if (advantage && disadvantage) return "normal";
  if (advantage) return "adv";
  if (disadvantage) return "dis";
  return "normal";
}

function inventoryName(row) {
  const payload = row?.card_payload || {};
  return safeText(payload.item_name || payload.name || row?.item_name || row?.name || "Unnamed item");
}

function inventoryDescription(row) {
  const payload = row?.card_payload || {};
  return readableText(
    payload.rulesShort
      || payload.item_description
      || payload.description
      || payload.rules
      || payload.entries
      || row?.description
      || ""
  );
}

function inventoryQuantity(row) {
  const value = finiteNumber(row?.quantity ?? row?.qty ?? row?.count, 1);
  return value > 0 ? value : 1;
}

function inventoryCategory(row) {
  const payload = row?.card_payload || {};
  return safeText(payload.uiSubKind || payload.uiType || payload.category || row?.category || "");
}

function spellRowsForPrint(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const spell = row?.spell || {};
      const level = Math.max(0, finiteNumber(spell.level, 0));
      const saveAbilities = Array.isArray(spell.saving_throw_abilities) ? spell.saving_throw_abilities : [];
      const damageTypes = Array.isArray(spell.damage_types) ? spell.damage_types : [];
      const resource = finiteNumber(row?.uses_max, 0) > 0
        ? `${finiteNumber(row?.uses_remaining, 0)}/${finiteNumber(row?.uses_max, 0)} uses${safeText(row?.recharge) ? ` • ${safeText(row.recharge)}` : ""}`
        : "";
      return {
        id: safeText(row?.id || spell?.id || spell?.name),
        name: safeText(spell?.name || "Unnamed spell"),
        level,
        levelLabel: level === 0 ? "Cantrip" : `Level ${level}`,
        prepared: Boolean(row?.prepared),
        alwaysAvailable: Boolean(row?.always_available),
        attackType: safeText(spell?.attack_type),
        saveAbilities: saveAbilities.map((entry) => safeText(entry).toUpperCase()).filter(Boolean),
        damage: [safeText(spell?.damage_dice), damageTypes.join("/")].filter(Boolean).join(" "),
        healing: safeText(spell?.healing_dice),
        castingTime: safeText(spell?.casting_time),
        range: safeText(spell?.range_text),
        duration: safeText(spell?.duration_text),
        description: readableText(spell?.description),
        resource,
      };
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

function featureRowsForPrint(rows = []) {
  const out = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const name = safeText(row?.name);
    if (!name) continue;
    const category = safeText(row?.category || row?.featureType || row?.feature_type || "Feature");
    const source = safeText(row?.source);
    const origin = safeText(row?.origin);
    const description = readableText(row?.description || row?.entries || row?.raw_payload?.entries || "");
    const key = [category, name, source, origin].join("|").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: safeText(row?.id || row?.feature_key || key),
      name,
      category,
      source,
      origin,
      level: Number.isFinite(Number(row?.level)) ? Number(row.level) : null,
      description,
    });
  }
  return out;
}

function notesForPrint(notes = []) {
  return (Array.isArray(notes) ? notes : [])
    .map((row) => ({
      id: safeText(row?.id || row?.created_at || row?.body),
      body: playerFacingText(row?.body),
      scope: safeText(row?.scope),
      createdAt: safeText(row?.created_at),
    }))
    .filter((row) => row.body);
}

function toList(value) {
  if (Array.isArray(value)) return uniqueText(value);
  if (typeof value === "string") {
    return uniqueText(value.split(/[,;\n]+/g).map((part) => part.trim()));
  }
  return [];
}

function classLabel(sheet = {}) {
  const meta = sheet?.meta && typeof sheet.meta === "object" ? sheet.meta : {};
  return safeText(sheet?.className || sheet?.class || meta.className || meta.class);
}

function speciesLabel(sheet = {}, profile = {}) {
  const meta = sheet?.meta && typeof sheet.meta === "object" ? sheet.meta : {};
  return safeText(sheet?.species || sheet?.race || meta.species || profile?.race);
}

function backgroundLabel(sheet = {}, profile = {}) {
  const meta = sheet?.meta && typeof sheet.meta === "object" ? sheet.meta : {};
  return safeText(sheet?.background || meta.background || profile?.background);
}

function normalizeProfile(profile = {}, sheet = {}, locationLabel = "") {
  const personality = sheet?.personality && typeof sheet.personality === "object" ? sheet.personality : {};
  const meta = sheet?.meta && typeof sheet.meta === "object" ? sheet.meta : {};
  return {
    name: safeText(profile?.name || sheet?.name || "Character"),
    kind: safeText(profile?.kind || profile?.type),
    playerName: safeText(profile?.playerName || profile?.player_name || (profile?.kind || profile?.type ? "NPC" : "")),
    role: safeText(profile?.role),
    affiliation: safeText(profile?.affiliation),
    status: safeText(profile?.status),
    location: safeText(profile?.location || locationLabel),
    portraitUrl: safeText(profile?.portraitUrl || profile?.portrait_url),
    species: speciesLabel(sheet, profile),
    lineage: safeText(sheet?.lineage || meta.lineage),
    size: safeText(sheet?.size || meta.size),
    alignment: safeText(sheet?.alignment || meta.alignment),
    className: classLabel(sheet),
    subclass: safeText(sheet?.subclass || meta.subclass),
    level: Math.max(0, finiteNumber(sheet?.level ?? meta.level, 0)),
    background: backgroundLabel(sheet, profile),
    backgroundNarrative: playerFacingText(profile?.backgroundNarrative || profile?.background_narrative || profile?.background || ""),
    description: playerFacingText(profile?.description),
    appearance: playerFacingText(sheet?.appearance),
    motivation: playerFacingText(profile?.motivation),
    quirk: playerFacingText(profile?.quirk),
    mannerism: playerFacingText(profile?.mannerism),
    voice: playerFacingText(profile?.voice),
    secret: playerFacingText(profile?.secret),
    tags: toList(profile?.tags),
    traits: playerFacingText(sheet?.traits ?? personality?.traits),
    ideals: playerFacingText(sheet?.ideals ?? personality?.ideals),
    bonds: playerFacingText(sheet?.bonds ?? personality?.bonds),
    flaws: playerFacingText(sheet?.flaws ?? personality?.flaws),
    age: safeText(profile?.age || sheet?.age || meta.age),
    height: safeText(profile?.height || sheet?.height || meta.height),
    weight: safeText(profile?.weight || sheet?.weight || meta.weight),
    eyes: safeText(profile?.eyes || sheet?.eyes || meta.eyes),
    skin: safeText(profile?.skin || sheet?.skin || meta.skin),
    hair: safeText(profile?.hair || sheet?.hair || meta.hair),
  };
}

export function buildPrintableCharacterSheetModel({
  sheet = {},
  profile = {},
  itemBonuses = null,
  inventoryItems = [],
  spellActions = [],
  featureRows = [],
  notes = [],
  locationLabel = "",
  equipmentBreakdown = [],
} = {}) {
  const s = sheet && typeof sheet === "object" ? sheet : {};
  const bonuses = itemBonuses && typeof itemBonuses === "object" ? itemBonuses : (s.itemBonuses || {});
  const abilityScoreBonuses = bonuses?.abilities && typeof bonuses.abilities === "object" ? bonuses.abilities : {};
  const abilityModBonuses = bonuses?.abilityMods && typeof bonuses.abilityMods === "object" ? bonuses.abilityMods : {};
  const proficiencies = s?.proficiencies && typeof s.proficiencies === "object" ? s.proficiencies : {};
  const saveFlags = proficiencies?.saves && typeof proficiencies.saves === "object" ? proficiencies.saves : {};
  const skillFlags = proficiencies?.skills && typeof proficiencies.skills === "object" ? proficiencies.skills : {};
  const pb = finiteNumber(s?.proficiencyBonus, 2);

  const effectiveAbilityScores = {};
  const abilityModifiers = {};
  for (const ability of PRINTABLE_ABILITIES) {
    const base = finiteNumber(s?.abilities?.[ability.key]?.score, 10);
    const score = Math.max(1, Math.min(30, Math.round(base + finiteNumber(abilityScoreBonuses?.[ability.key], 0))));
    effectiveAbilityScores[ability.key] = score;
    abilityModifiers[ability.key] = modFromScore(score) + finiteNumber(abilityModBonuses?.[ability.key], 0);
  }

  const adv = bonuses?.advantage && typeof bonuses.advantage === "object" ? bonuses.advantage : {};
  const dis = bonuses?.disadvantage && typeof bonuses.disadvantage === "object" ? bonuses.disadvantage : {};

  const abilities = PRINTABLE_ABILITIES.map((ability) => {
    const proficient = Boolean(saveFlags?.[ability.key]?.proficient);
    const saveModifier = abilityModifiers[ability.key]
      + (proficient ? pb : 0)
      + finiteNumber(bonuses?.savesAll, 0)
      + finiteNumber(bonuses?.saves?.[ability.key], 0);
    return {
      ...ability,
      score: effectiveAbilityScores[ability.key],
      modifier: abilityModifiers[ability.key],
      saveModifier,
      saveProficient: proficient,
      saveMode: rollMode(Boolean(adv?.savesAll || adv?.saves?.[ability.key]), Boolean(dis?.savesAll || dis?.saves?.[ability.key])),
    };
  });

  const skills = PRINTABLE_SKILLS.map((skill) => {
    const flags = skillFlags?.[skill.key] || {};
    const proficient = Boolean(flags?.proficient);
    const expertise = Boolean(flags?.expertise);
    const proficiencyPart = proficient ? pb * (expertise ? 2 : 1) : 0;
    const modifier = abilityModifiers[skill.ability]
      + proficiencyPart
      + finiteNumber(bonuses?.skillsAll, 0)
      + finiteNumber(bonuses?.skills?.[skill.key], 0);
    return {
      ...skill,
      modifier,
      proficient,
      expertise,
      mode: rollMode(Boolean(adv?.skillsAll || adv?.skills?.[skill.key]), Boolean(dis?.skillsAll || dis?.skills?.[skill.key])),
    };
  });

  const equipment = bonuses?.equipment && typeof bonuses.equipment === "object" ? bonuses.equipment : {};
  const armor = equipment?.armor && typeof equipment.armor === "object" ? equipment.armor : null;
  const shield = equipment?.shield && typeof equipment.shield === "object" ? equipment.shield : null;
  const unarmoredDefense = resolveClassUnarmoredDefense(s, abilityModifiers);
  const ac = calculateArmorClass({
    storedBaseAc: s?.ac ?? null,
    dexterityModifier: abilityModifiers.dex,
    unarmoredDefenseModifier: unarmoredDefense.modifier,
    unarmoredDefenseLabel: unarmoredDefense.label,
    armor,
    shieldBonus: finiteNumber(shield?.bonusAc, 0),
    otherBonus: finiteNumber(bonuses?.ac, 0),
  });
  const initiative = calculateInitiativeModifier({
    dexterityModifier: abilityModifiers.dex,
    gearBonus: finiteNumber(bonuses?.initiative, 0),
    sheetBonus: finiteNumber(s?.initiative, 0),
  });

  const perception = skills.find((skill) => skill.key === "perception") || { modifier: abilityModifiers.wis, mode: "normal" };
  const passivePerception = calculatePassivePerception(perception.modifier, perception.mode);

  const actionRows = buildCharacterSheetActions({
    sheet: s,
    inventoryRows: inventoryItems,
    spellRows: spellActions,
    featureRows,
    abilityModifiers,
    proficiencyBonus: pb,
  }).map((action) => ({
    id: safeText(action?.id || action?.label),
    group: safeText(action?.group || "Actions"),
    kind: safeText(action?.kind),
    label: safeText(action?.label || "Action"),
    statusLabel: safeText(action?.statusLabel),
    attackBonus: Number.isFinite(Number(action?.attackBonus)) ? Number(action.attackBonus) : null,
    saveDc: Number.isFinite(Number(action?.saveDc)) ? Number(action.saveDc) : null,
    saveAbilities: Array.isArray(action?.saveAbilities) ? action.saveAbilities.map((entry) => safeText(entry).toUpperCase()).filter(Boolean) : [],
    damage: safeText(action?.damage || action?.damageFormula),
    damageType: safeText(action?.damageType),
    healing: safeText(action?.healing),
    summary: readableText(action?.summary),
    detail: readableText(action?.detail),
    resolutionText: readableText(action?.resolutionText),
  }));

  const inventory = (Array.isArray(inventoryItems) ? inventoryItems : [])
    .map((row) => ({
      id: safeText(row?.id || row?.item_id || inventoryName(row)),
      name: inventoryName(row),
      quantity: inventoryQuantity(row),
      equipped: Boolean(row?.is_equipped),
      equipSlot: safeText(row?.equip_slot),
      category: inventoryCategory(row),
      description: inventoryDescription(row),
    }))
    .sort((a, b) => Number(b.equipped) - Number(a.equipped) || a.name.localeCompare(b.name));

  const meta = s?.meta && typeof s.meta === "object" ? s.meta : {};
  const languages = toList(s?.languages ?? meta.languages);
  const tools = uniqueText([
    ...toList(s?.tools),
    ...toList(s?.toolProficiencies),
    ...toList(s?.proficiencies?.tools),
    safeText(meta?.toolProficiency),
  ]);
  const weapons = uniqueText([
    ...toList(s?.weaponProficiencies),
    ...toList(s?.proficiencies?.weapons),
  ]);
  const armorProficiencies = uniqueText([
    ...toList(s?.armorProficiencies),
    ...toList(s?.proficiencies?.armor),
  ]);
  const professions = Object.entries(s?.professions && typeof s.professions === "object" ? s.professions : {})
    .map(([name, value]) => ({
      name,
      rank: finiteNumber(value?.rank, 0),
      ability: safeText(value?.ability).toUpperCase(),
      offersService: Boolean(value?.offersService),
    }))
    .filter((entry) => entry.rank > 0 || entry.offersService);

  const spellcasting = s?.spellcasting && typeof s.spellcasting === "object" ? s.spellcasting : {};
  const castingAbilityKey = safeText(spellcasting?.ability || s?.spellcastingAbility || meta?.spellcastingAbility).toLowerCase();
  const castingAbility = castingAbilityKey ? castingAbilityKey.slice(0, 3).toUpperCase() : "";
  const castingMod = castingAbilityKey && abilityModifiers[castingAbilityKey] != null ? abilityModifiers[castingAbilityKey] : null;
  const spellSaveDc = Number.isFinite(Number(spellcasting?.spellSaveDc ?? s?.spellSaveDc))
    ? Number(spellcasting?.spellSaveDc ?? s?.spellSaveDc)
    : (castingMod == null ? null : 8 + pb + castingMod);
  const spellAttackBonus = Number.isFinite(Number(spellcasting?.spellAttackBonus ?? s?.spellAttackBonus))
    ? Number(spellcasting?.spellAttackBonus ?? s?.spellAttackBonus)
    : (castingMod == null ? null : pb + castingMod);
  const rawSpellSlots = Array.isArray(s?.spellSlots)
    ? s.spellSlots
    : (Array.isArray(spellcasting?.spellSlots) ? spellcasting.spellSlots : []);
  const spellSlots = Array.from({ length: 9 }, (_, index) => Math.max(0, finiteNumber(rawSpellSlots[index], 0)));

  const currencySource = s?.currency && typeof s.currency === "object" ? s.currency : {};
  const currency = {
    cp: Math.max(0, finiteNumber(currencySource.cp ?? s?.cp, 0)),
    sp: Math.max(0, finiteNumber(currencySource.sp ?? s?.sp, 0)),
    ep: Math.max(0, finiteNumber(currencySource.ep ?? s?.ep, 0)),
    gp: Math.max(0, finiteNumber(currencySource.gp ?? s?.gp, 0)),
    pp: Math.max(0, finiteNumber(currencySource.pp ?? s?.pp, 0)),
  };

  return {
    profile: normalizeProfile(profile, s, locationLabel),
    proficiencyBonus: pb,
    hp: {
      current: finiteNumber(s?.hp, 0),
      max: finiteNumber(s?.maxHp, 0),
      temp: finiteNumber(s?.tempHp, 0),
      hitDice: safeText(s?.hitDice),
    },
    speed: safeText(s?.speed || meta.speed || "—"),
    xp: Number.isFinite(Number(s?.xp ?? meta.xp)) ? Number(s?.xp ?? meta.xp) : null,
    xpNext: Number.isFinite(Number(s?.xpNext ?? s?.xpToNext ?? meta.xpNext ?? meta.xpToNext))
      ? Number(s?.xpNext ?? s?.xpToNext ?? meta.xpNext ?? meta.xpToNext)
      : null,
    armorClass: ac.total,
    armorClassDetail: {
      source: ac.source,
      armor: safeText(armor?.name),
      shield: safeText(shield?.name),
      storedBase: Boolean(ac.usedStoredBaseAc),
      unarmoredDefense: safeText(ac.unarmoredDefenseLabel),
    },
    initiative,
    passivePerception,
    abilities,
    skills,
    actions: actionRows,
    features: featureRowsForPrint(featureRows),
    inventory,
    spells: spellRowsForPrint(spellActions),
    notes: notesForPrint(notes),
    languages,
    tools,
    weapons,
    armorProficiencies,
    professions,
    spellcasting: {
      className: classLabel(s),
      ability: castingAbility,
      saveDc: spellSaveDc,
      attackBonus: spellAttackBonus,
      slots: spellSlots,
    },
    currency,
    inspiration: Boolean(s?.inspiration),
    equipmentBreakdown: uniqueText(equipmentBreakdown),
    legacy: {
      attacks: playerFacingText(s?.attacks),
      equipment: playerFacingText(s?.equipment),
      treasure: playerFacingText(s?.treasure),
      spells: playerFacingText(s?.spells),
      featsTraits: playerFacingText(s?.featsTraits),
    },
  };
}

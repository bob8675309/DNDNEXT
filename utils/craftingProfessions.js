export const PROFESSION_DEFINITIONS = Object.freeze({
  alchemy: Object.freeze({
    key: "alchemy",
    label: "Alchemy",
    tool: "Alchemist's Supplies",
    abilities: Object.freeze(["int", "wis"]),
  }),
  smithing: Object.freeze({
    key: "smithing",
    label: "Smithing",
    tool: "Smith's Tools",
    abilities: Object.freeze(["str", "int"]),
  }),
  scribe: Object.freeze({
    key: "scribe",
    label: "Scribe",
    tool: "Calligrapher's Supplies",
    abilities: Object.freeze(["int", "wis"]),
  }),
  enchanting: Object.freeze({
    key: "enchanting",
    label: "Enchanting",
    tool: "Enchanter's Tools",
    abilities: Object.freeze(["int", "cha"]),
  }),
});

export const PROFESSION_KEYS = Object.freeze(Object.keys(PROFESSION_DEFINITIONS));

export const ABILITY_LABELS = Object.freeze({
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
});

const DISCIPLINE_TO_PROFESSION = Object.freeze({
  alchemy: "alchemy",
  smithing: "smithing",
  scribe: "scribe",
  enchanting: "enchanting",
});

const SERVICE_TO_PROFESSION = Object.freeze({
  brew: "alchemy",
  forge_mundane: "smithing",
  reforge: "smithing",
  temper: "smithing",
  imbue: "enchanting",
  inscribe: "scribe",
});

function normalizedToken(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const token = normalizedToken(value);
  return ["true", "yes", "y", "1", "on", "enabled", "service", "provider", "offers service"].includes(token);
}

export function normalizeProfessionKey(value = "") {
  const token = normalizedToken(value).replace(/\s+/g, "");
  if (token === "alchemist" || token === "alchemy") return "alchemy";
  if (token === "smith" || token === "blacksmith" || token === "smithing") return "smithing";
  if (token === "scribe" || token === "scribing" || token === "inscription") return "scribe";
  if (token === "enchanter" || token === "enchanting" || token === "enchantment") return "enchanting";
  return PROFESSION_KEYS.includes(token) ? token : "";
}

export function professionForDiscipline(value = "") {
  return DISCIPLINE_TO_PROFESSION[normalizedToken(value)] || normalizeProfessionKey(value);
}

export function professionForWorkshopService(value = "") {
  return SERVICE_TO_PROFESSION[normalizedToken(value).replace(/\s+/g, "_")] || "";
}

export function normalizeProfessionRank(value) {
  if (typeof value === "string") {
    const token = normalizedToken(value);
    if (token === "expertise" || token === "expert" || token === "master") return 2;
    if (token === "proficient" || token === "trained" || token === "apprentice") return 1;
    if (token === "untrained" || token === "none" || token === "off") return 0;
  }
  const rank = Number(value);
  if (!Number.isFinite(rank)) return 0;
  return Math.max(0, Math.min(2, Math.round(rank)));
}

export function normalizeProfessionEntry(value, professionKey) {
  const key = normalizeProfessionKey(professionKey);
  const definition = PROFESSION_DEFINITIONS[key];
  if (!definition) return null;

  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : typeof value === "number" || typeof value === "string"
      ? { rank: value }
      : {};
  const requestedAbility = normalizedToken(raw.ability || raw.ability_key || raw.stat).slice(0, 3);
  const ability = definition.abilities.includes(requestedAbility)
    ? requestedAbility
    : definition.abilities[0];
  const rank = normalizeProfessionRank(raw.rank ?? raw.proficiency_rank ?? raw.tier ?? raw.proficient);
  const offersService = normalizeBoolean(
    raw.offersService
      ?? raw.offers_service
      ?? raw.workshopService
      ?? raw.workshop_service
      ?? raw.provider
      ?? raw.offers
  );

  return {
    rank,
    ability,
    offersService,
  };
}

export function normalizeProfessions(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(PROFESSION_KEYS.map((key) => [key, normalizeProfessionEntry(source[key], key)]));
}

export function abilityModifier(score) {
  const numeric = Number(score);
  return Math.floor(((Number.isFinite(numeric) ? numeric : 10) - 10) / 2);
}

export function professionModifierFromSheet(sheet = {}, professionKey) {
  const key = normalizeProfessionKey(professionKey);
  const definition = PROFESSION_DEFINITIONS[key];
  if (!definition) return null;

  const rawProfessions = sheet?.professions && typeof sheet.professions === "object" ? sheet.professions : {};
  const explicitlyConfigured = Object.prototype.hasOwnProperty.call(rawProfessions, key);
  const profession = normalizeProfessionEntry(rawProfessions[key], key);
  const abilityScore = Number(sheet?.abilities?.[profession.ability]?.score ?? 10);
  const abilityMod = abilityModifier(abilityScore);
  const proficiencyBonus = Number(sheet?.proficiencyBonus ?? sheet?.proficiency_bonus ?? 2) || 0;
  const proficiencyContribution = proficiencyBonus * profession.rank;

  return {
    key,
    label: definition.label,
    tool: definition.tool,
    allowedAbilities: [...definition.abilities],
    ability: profession.ability,
    abilityLabel: ABILITY_LABELS[profession.ability] || profession.ability.toUpperCase(),
    abilityScore: Number.isFinite(abilityScore) ? abilityScore : 10,
    abilityModifier: abilityMod,
    proficiencyBonus,
    rank: profession.rank,
    rankLabel: profession.rank === 2 ? "Expertise" : profession.rank === 1 ? "Proficient" : "Untrained",
    offersService: profession.offersService,
    proficiencyContribution,
    totalModifier: abilityMod + proficiencyContribution,
    configured: explicitlyConfigured && profession.rank > 0,
  };
}

function pushProviderValue(values, value) {
  if (!value) return;
  if (Array.isArray(value)) return value.forEach((entry) => pushProviderValue(values, entry));
  if (typeof value === "object") return Object.values(value).forEach((entry) => pushProviderValue(values, entry));
  values.push(String(value));
}

function collectExplicitProviderText(character = {}) {
  const values = [];
  [
    character.crafterTypes,
    character.craft_roles,
    character.craftRoles,
    character.crafter_roles,
    character.crafterRoles,
    character.workshop_roles,
    character.workshopRoles,
    character.crafting_roles,
    character.craftingRoles,
    character.services,
    character.tags,
  ].forEach((value) => pushProviderValue(values, value));

  return normalizedToken(values.join(" | "));
}

function sheetFromCharacter(character = {}) {
  if (character?.sheet && typeof character.sheet === "object") return character.sheet;
  if (character?.characterSheet && typeof character.characterSheet === "object") return character.characterSheet;
  if (character?.character_sheet && typeof character.character_sheet === "object") return character.character_sheet;
  if (character?.character_sheets?.sheet && typeof character.character_sheets.sheet === "object") return character.character_sheets.sheet;
  if (Array.isArray(character?.character_sheets) && character.character_sheets[0]?.sheet) return character.character_sheets[0].sheet;
  return null;
}

function professionHasServiceFlag(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (
    Object.prototype.hasOwnProperty.call(value, "offersService")
    || Object.prototype.hasOwnProperty.call(value, "offers_service")
    || Object.prototype.hasOwnProperty.call(value, "workshopService")
    || Object.prototype.hasOwnProperty.call(value, "workshop_service")
    || Object.prototype.hasOwnProperty.call(value, "provider")
    || Object.prototype.hasOwnProperty.call(value, "offers")
  ));
}

function professionServicesFromSheet(sheet = {}) {
  const rawProfessions = sheet?.professions && typeof sheet.professions === "object" ? sheet.professions : null;
  if (!rawProfessions) return null;

  const hasServiceFlags = PROFESSION_KEYS.some((key) => professionHasServiceFlag(rawProfessions[key]));
  if (!hasServiceFlags) return null;

  return PROFESSION_KEYS.filter((key) => {
    const entry = normalizeProfessionEntry(rawProfessions[key], key);
    return entry?.rank > 0 && entry.offersService;
  });
}

export function availableProfessionsForCharacter(character = {}, sheetOverride = null) {
  const sheetProfessions = professionServicesFromSheet(sheetOverride || sheetFromCharacter(character));
  if (sheetProfessions) return sheetProfessions;

  const blob = collectExplicitProviderText(character);
  const result = new Set();

  // Legacy fallback is intentionally limited to explicit service/tag fields.
  // Name, role, affiliation, and storefront copy must not create workshop access.
  if (/\b(alchemist|alchemy)\b/.test(blob)) result.add("alchemy");
  if (/\b(blacksmith|smithing)\b/.test(blob)) result.add("smithing");
  if (/\b(enchanter|enchanting)\b/.test(blob)) result.add("enchanting");
  if (/\b(scribe|scribing)\b/.test(blob)) result.add("scribe");

  return Array.from(result);
}

export function providerOffersProfession(character, professionKey, sheetOverride = null) {
  const key = normalizeProfessionKey(professionKey);
  return Boolean(key && availableProfessionsForCharacter(character, sheetOverride).includes(key));
}

export function buildCrafterProfessionSnapshot(character, sheet, professionKey) {
  const resolved = professionModifierFromSheet(sheet, professionKey);
  if (!resolved) return null;
  return {
    character_id: character?.id || null,
    character_name: character?.name || "Unknown Crafter",
    kind: character?.kind || null,
    profession: resolved.key,
    profession_label: resolved.label,
    ability: resolved.ability,
    ability_label: resolved.abilityLabel,
    ability_score: resolved.abilityScore,
    ability_modifier: resolved.abilityModifier,
    proficiency_bonus: resolved.proficiencyBonus,
    proficiency_rank: resolved.rank,
    proficiency_rank_label: resolved.rankLabel,
    offers_service: resolved.offersService,
    total_modifier: resolved.totalModifier,
    tool: resolved.tool,
    configured: resolved.configured,
  };
}

import { PROFESSION_DEFINITIONS, TRADE_SKILL_KEYS } from "./craftingProfessions";

const normalize = (value = "") => String(value ?? "")
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const TOOL_TO_PROFESSION = Object.freeze(Object.fromEntries(
  TRADE_SKILL_KEYS.flatMap((key) => {
    const definition = PROFESSION_DEFINITIONS[key];
    const tool = normalize(definition?.tool);
    return tool ? [[tool, key]] : [];
  })
));

/**
 * Return the player-facing campaign Trade Skill key represented by a concrete
 * crafting tool. The mapping is derived from PROFESSION_DEFINITIONS so Forge
 * never needs a second hand-maintained Alchemy/Smithing/etc. tool list.
 */
export function professionKeyForTool(value = "") {
  return TOOL_TO_PROFESSION[normalize(value)] || "";
}

export function professionDefinitionForTool(value = "") {
  const key = professionKeyForTool(value);
  return key ? PROFESSION_DEFINITIONS[key] || null : null;
}

export function toolForProfession(professionKey = "") {
  return PROFESSION_DEFINITIONS[professionKey]?.tool || "";
}

export function isCraftingProfessionTool(value = "") {
  return Boolean(professionKeyForTool(value));
}

/**
 * Merge source-granted mapped tool proficiencies into a persisted Trade Skill
 * map. This supports all eight Character Forge Trade Skills. The separate
 * crafting runtime/service authority remains limited by PROFESSION_KEYS.
 */
export function mergeToolGrantedProfessions(professions = {}, toolValues = []) {
  const next = { ...(professions && typeof professions === "object" ? professions : {}) };
  for (const value of Array.isArray(toolValues) ? toolValues : []) {
    const key = professionKeyForTool(value);
    const definition = PROFESSION_DEFINITIONS[key];
    if (!key || !definition) continue;
    const current = next[key] && typeof next[key] === "object" ? next[key] : {};
    next[key] = {
      ...current,
      rank: Math.max(1, Number(current.rank || 0)),
      ability: definition.abilities.includes(current.ability) ? current.ability : definition.abilities[0],
      offersService: Boolean(current.offersService),
    };
  }
  return next;
}

export function professionKeysForTools(toolValues = []) {
  return [...new Set((Array.isArray(toolValues) ? toolValues : [])
    .map(professionKeyForTool)
    .filter(Boolean))];
}

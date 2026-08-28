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
 * Return the Trade Skill associated with a concrete crafting tool. Association
 * is informational/routing data only: owning or gaining the mundane tool does
 * not grant a Trade Skill rank, proficiency, or Expertise.
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
 * Return associated Trade Skill keys without changing character proficiency.
 * This helper must never be used as authority to promote a Trade Skill rank.
 */
export function professionKeysForTools(toolValues = []) {
  return [...new Set((Array.isArray(toolValues) ? toolValues : [])
    .map(professionKeyForTool)
    .filter(Boolean))];
}

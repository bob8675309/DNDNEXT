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
 * Return the Trade Skill associated with a concrete crafting tool.
 * Association alone is informational/routing data: simply owning a mundane tool
 * does not grant a Trade Skill rank or Expertise.
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

export function professionKeysForTools(toolValues = []) {
  return [...new Set((Array.isArray(toolValues) ? toolValues : [])
    .map(professionKeyForTool)
    .filter(Boolean))];
}

/**
 * Some rules sources deliberately use a tool proficiency as the mechanical
 * expression of professional/crafting training. Those sources opt in with
 * grantsMappedTradeSkill metadata. This keeps the compatibility grant attached
 * to the source rule instead of making every copy of the mundane tool a skill.
 *
 * The Crafter feat is another explicit opt-in: its campaign adaptation stores a
 * professionKey on each option and marks the group with crafter-profession-skills.
 */
export function sourceChoiceGrantsTradeSkill(entry = {}) {
  const groupMetadata = entry?.groupMetadata && typeof entry.groupMetadata === "object" ? entry.groupMetadata : {};
  const fieldMetadata = entry?.fieldMetadata && typeof entry.fieldMetadata === "object" ? entry.fieldMetadata : {};
  const optionMetadata = entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
  return Boolean(
    groupMetadata.grantsMappedTradeSkill
      || fieldMetadata.grantsMappedTradeSkill
      || optionMetadata.grantsMappedTradeSkill
      || groupMetadata.campaignRule === "crafter-profession-skills"
      || fieldMetadata.campaignRule === "crafter-profession-skills"
      || optionMetadata.campaignRule === "crafter-profession-skills"
  );
}

export function sourceGrantedTradeSkillKey(entry = {}) {
  if (!sourceChoiceGrantsTradeSkill(entry)) return "";
  const metadataKey = String(entry?.metadata?.professionKey || entry?.fieldMetadata?.professionKey || "");
  if (TRADE_SKILL_KEYS.includes(metadataKey)) return metadataKey;
  return professionKeyForTool(entry?.value || entry?.label || "");
}

export function sourceGrantedTradeSkillKeys(entries = []) {
  return [...new Set((Array.isArray(entries) ? entries : [])
    .map(sourceGrantedTradeSkillKey)
    .filter(Boolean))];
}

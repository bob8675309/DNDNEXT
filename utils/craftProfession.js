export const CRAFT_DISCIPLINES = ["Alchemy", "Smithing", "Enchanting", "Scribe"];

function safeText(value) {
  return String(value ?? "").trim();
}

function collectCapabilityText(value, output = [], depth = 0) {
  if (value == null || depth > 4) return output;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = safeText(value);
    if (text) output.push(text);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectCapabilityText(entry, output, depth + 1));
    return output;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => {
      if (/profession|craft|crafter|skill|role|tag|title|workshop|service|discipline/i.test(key)) {
        output.push(key);
        collectCapabilityText(entry, output, depth + 1);
      }
    });
  }

  return output;
}

export function resolveCraftProfession(character = {}, sheet = {}) {
  const sources = [];

  [
    character?.profession,
    character?.crafting_profession,
    character?.craft_profession,
    character?.crafter_profession,
    character?.crafter_type,
    character?.craft_type,
    character?.role,
    character?.title,
    character?.tags,
    character?.metadata,
    character?.profile,
    character?.capabilities,
    sheet?.profession,
    sheet?.professions,
    sheet?.craftingProfession,
    sheet?.crafting_profession,
    sheet?.crafterProfession,
    sheet?.skills?.profession,
    sheet?.skills?.professions,
    sheet?.profile?.profession,
    sheet?.profile?.professions,
    sheet?.npcProfile?.profession,
    sheet?.npcProfile?.professions,
    sheet?.capabilities,
  ].forEach((entry) => collectCapabilityText(entry, sources));

  const text = sources.join(" | ").toLowerCase();
  if (!text) return null;

  if (/\balchemy\b|\balchemist\b|herbalist|potion|poison|elixir|apothecary|bomb|oil/.test(text)) return "Alchemy";
  if (/\bsmithing\b|\bsmith\b|blacksmith|forge|forgemaster|weaponsmith|armorsmith|armoursmith|temper/.test(text)) return "Smithing";
  if (/\benchanting\b|\benchanter\b|enchant|imbue|arcane artisan|runecrafter|runesmith/.test(text)) return "Enchanting";
  if (/\bscribe\b|scroll|spellbook|inkwright/.test(text)) return "Scribe";

  return null;
}

export function canCraft(character = {}, sheet = {}) {
  const discipline = resolveCraftProfession(character, sheet);
  return !!discipline && discipline !== "Scribe";
}

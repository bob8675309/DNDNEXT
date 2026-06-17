export const ENCHANTING_SLOT_ORDER = Object.freeze(["A", "B", "C"]);

export const ENCHANTING_SLOT_RULES = Object.freeze({
  A: Object.freeze({ key: "A", label: "Slot A", minimumTier: 1, minimumCatalystRarity: "Common", allowedRarities: Object.freeze(["Common", "Uncommon"]) }),
  B: Object.freeze({ key: "B", label: "Slot B", minimumTier: 2, minimumCatalystRarity: "Uncommon", allowedRarities: Object.freeze(["Rare"]) }),
  C: Object.freeze({ key: "C", label: "Slot C", minimumTier: 3, minimumCatalystRarity: "Rare", allowedRarities: Object.freeze(["Very Rare"]) }),
});

const RARITY_ORDER = Object.freeze(["Mundane", "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"]);
const RARITY_RANK = Object.freeze(Object.fromEntries(RARITY_ORDER.map((value, index) => [value, index])));
const TIER_RARITY = Object.freeze({ 1: "Uncommon", 2: "Rare", 3: "Very Rare" });
const PHYSICAL_TYPE_CODES = Object.freeze({ M: "weapon", R: "weapon", A: "ammunition", LA: "armor", MA: "armor", HA: "armor", S: "shield", SH: "shield" });
const DAMAGE_TYPE_CODES = Object.freeze({ B: "bludgeoning", P: "piercing", S: "slashing", A: "acid", C: "cold", F: "fire", L: "lightning", N: "necrotic", R: "radiant", T: "thunder", FRC: "force", PSY: "psychic", PSN: "poison" });

function text(value = "") {
  return String(value ?? "").trim();
}

function normalizedToken(value = "") {
  return text(value).toLowerCase().replace(/[’']/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.filter((entry) => entry !== null && entry !== undefined && entry !== "");
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function dedupe(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    const key = text(typeof value === "string" ? value : JSON.stringify(value));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeEnchantingRarity(value = "") {
  const token = normalizedToken(value);
  if (!token || token === "none" || token === "mundane") return "Mundane";
  if (token.includes("artifact")) return "Artifact";
  if (token.includes("legend")) return "Legendary";
  if (token.includes("very rare")) return "Very Rare";
  if (token.includes("uncommon")) return "Uncommon";
  if (token.includes("rare")) return "Rare";
  if (token.includes("common")) return "Common";
  if (token.includes("varies") || token.includes("variable")) return "Varies";
  return text(value);
}

export function enchantingRarityRank(value = "") {
  return RARITY_RANK[normalizeEnchantingRarity(value)] ?? -1;
}

export function enchantingSlotForRarity(value = "") {
  const rarity = normalizeEnchantingRarity(value);
  if (rarity === "Common" || rarity === "Uncommon") return "A";
  if (rarity === "Rare") return "B";
  if (rarity === "Very Rare") return "C";
  return "";
}

export function enchantingSlotForRecipe(recipe = {}, option = null) {
  return enchantingSlotForRarity(resolveEnchantingRecipeRarity(recipe, option));
}

export function enchantingTierForItem(item = {}) {
  const payload = objectValue(item.payload || item.card_payload || item.raw?.card_payload);
  const raw = objectValue(item.raw);
  const explicit = Number(
    payload.enhancement_tier ?? payload.enhancementTier ?? payload.magic_tier ?? payload.magicTier ?? payload.tier
    ?? raw.enhancement_tier ?? raw.enhancementTier ?? raw.magic_tier ?? raw.magicTier ?? raw.tier ?? 0
  );
  if (explicit >= 1 && explicit <= 3) return explicit;
  const nameBlob = [item.name, item.item_name, raw.item_name, payload.name, payload.item_name].filter(Boolean).join(" ");
  const match = nameBlob.match(/(?:^|\s)\+([1-3])\b/);
  return match ? Number(match[1]) : 0;
}

export function enchantingUnlockedSlots(tier = 0) {
  const value = Math.max(0, Math.min(3, Number(tier) || 0));
  return ENCHANTING_SLOT_ORDER.filter((slot) => ENCHANTING_SLOT_RULES[slot].minimumTier <= value);
}

export function enchantingItemPayload(item = {}) {
  return objectValue(item.payload || item.card_payload || item.raw?.card_payload);
}

function typeCode(value = "") {
  return text(value).split("|")[0].trim().toUpperCase();
}

export function enchantingItemKind(item = {}) {
  const payload = enchantingItemPayload(item);
  const raw = objectValue(item.raw);
  const candidates = [item.type, item.item_type, payload.item_type, payload.type, payload.uiType, raw.item_type, raw.type].filter(Boolean);
  for (const candidate of candidates) {
    const code = typeCode(candidate);
    if (PHYSICAL_TYPE_CODES[code]) return PHYSICAL_TYPE_CODES[code];
  }
  const blob = [item.name, item.item_name, ...candidates].filter(Boolean).join(" ").toLowerCase();
  if (/\bammunition\b|\bammo\b|\barrow\b|\bbolt\b/.test(blob)) return "ammunition";
  if (/\bshield\b/.test(blob)) return "shield";
  if (/\barmor\b|\barmour\b|\bmail\b|\bplate\b|\bbreastplate\b|\bleather\b/.test(blob)) return "armor";
  if (/\bweapon\b|\bsword\b|\baxe\b|\bmace\b|\bhammer\b|\bbow\b|\bcrossbow\b|\bspear\b|\bdagger\b|\bstaff\b|\bwhip\b|\brapier\b|\bscimitar\b|\bsickle\b|\btrident\b|\bflail\b|\blance\b|\bsling\b/.test(blob)) return "weapon";
  return "";
}

export function enchantingWeaponMode(item = {}) {
  if (enchantingItemKind(item) !== "weapon") return "";
  const payload = enchantingItemPayload(item);
  const raw = objectValue(item.raw);
  const code = typeCode(item.type || item.item_type || payload.item_type || payload.type || raw.item_type || raw.type);
  if (code === "R") return "ranged";
  if (code === "M") return "melee";
  const blob = [item.name, item.item_name, item.type, payload.item_type, payload.type, payload.uiType].filter(Boolean).join(" ").toLowerCase();
  return /\bbow\b|\bcrossbow\b|\bsling\b|\bblowgun\b|\branged\b/.test(blob) ? "ranged" : "melee";
}

export function enchantingWeaponFamily(item = {}) {
  const payload = enchantingItemPayload(item);
  const raw = objectValue(item.raw);
  const explicit = text(payload.weapon_family || payload.weaponFamily || raw.weapon_family || raw.weaponFamily);
  if (explicit) return normalizedToken(explicit);
  const name = normalizedToken(item.name || item.item_name || raw.item_name || payload.name || payload.item_name);
  const families = [
    "longsword", "shortsword", "greatsword", "scimitar", "rapier", "dagger", "sickle", "spear", "trident", "lance", "whip",
    "battleaxe", "greataxe", "handaxe", "warhammer", "maul", "mace", "club", "flail", "quarterstaff", "staff",
    "longbow", "shortbow", "crossbow", "sling", "blowgun",
  ];
  return families.find((family) => name.includes(family)) || (name.includes("sword") ? "sword" : name.includes("axe") ? "axe" : name.includes("bow") ? "bow" : "");
}

export function enchantingDamageTypes(item = {}) {
  const payload = enchantingItemPayload(item);
  const raw = objectValue(item.raw);
  const values = [payload.damage_type, payload.damageType, payload.dmgType, raw.damage_type, raw.damageType, raw.dmgType, item.damage_type, item.damageType]
    .flatMap(arrayValue)
    .map((value) => DAMAGE_TYPE_CODES[text(value).toUpperCase()] || normalizedToken(value))
    .filter(Boolean);
  const blob = [payload.damage, payload.damage_text, payload.item_description, raw.item_description, item.description].filter(Boolean).join(" ").toLowerCase();
  ["bludgeoning", "piercing", "slashing", "acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"].forEach((damageType) => {
    if (blob.includes(damageType)) values.push(damageType);
  });
  return dedupe(values);
}

export function resolveEnchantingRecipeRarity(recipe = {}, option = null) {
  const raw = objectValue(recipe.variant || recipe.raw_variant || recipe.rawVariant);
  const rarityByValue = objectValue(raw.rarityByValue || recipe.rarity_by_value || recipe.rarityByValue);
  const key = option === null || option === undefined ? "" : String(option);
  return normalizeEnchantingRarity(rarityByValue[key] || recipe.rarity || raw.rarity || (Object.keys(rarityByValue).length ? "Varies" : ""));
}

export function isEnchantingRecipeFuture(recipe = {}, option = null) {
  const key = normalizedToken(recipe.key || recipe.variant?.key || recipe.name).replace(/\s+/g, "_");
  const recipeRarity = resolveEnchantingRecipeRarity(recipe, option);
  if (recipeRarity === "Legendary" || recipeRarity === "Artifact") return true;
  if (key === "enspell_weapon" || key === "enspell_armor") return true;
  return Boolean(recipe.craft_disabled || recipe.future);
}

export function enchantingRecipeDisabledReason(recipe = {}, option = null) {
  if (recipe.disabled_reason) return text(recipe.disabled_reason);
  const key = normalizedToken(recipe.key || recipe.variant?.key || recipe.name).replace(/\s+/g, "_");
  if (key === "enspell_weapon" || key === "enspell_armor") return "Spell-bound enchantments remain unavailable until the campaign spell catalog is imported.";
  const recipeRarity = resolveEnchantingRecipeRarity(recipe, option);
  if (recipeRarity === "Legendary" || recipeRarity === "Artifact") return "Legendary enchanting is reserved for a later tier beyond the current A/B/C workshop.";
  return "This enchantment is not currently available for crafting.";
}

function recipeVariant(recipe = {}) {
  return objectValue(recipe.variant || recipe.raw_variant || recipe.rawVariant);
}

function recipeAppliesTo(recipe = {}) {
  const raw = recipeVariant(recipe);
  return dedupe(arrayValue(recipe.applies_to || recipe.appliesTo || raw.appliesTo).map((value) => normalizedToken(value).replace(/\s+/g, "")));
}

function recipeRequires(recipe = {}) {
  const raw = recipeVariant(recipe);
  const value = recipe.requires || raw.requires;
  if (Array.isArray(value)) return value.reduce((merged, entry) => ({ ...merged, ...objectValue(entry) }), {});
  return objectValue(value);
}

export function enchantingRequirementCheck(item = {}, recipe = {}, option = null) {
  const kind = enchantingItemKind(item);
  const tier = enchantingTierForItem(item);
  const recipeRarity = resolveEnchantingRecipeRarity(recipe, option);
  const slot = enchantingSlotForRarity(recipeRarity);
  const minimumTier = slot ? ENCHANTING_SLOT_RULES[slot].minimumTier : 99;
  if (!kind || !["weapon", "armor", "shield", "ammunition"].includes(kind)) {
    return { ok: false, reason: "Only weapons, armor, shields, and ammunition can be enchanted.", kind, tier, slot, rarity: recipeRarity };
  }
  if (!slot || isEnchantingRecipeFuture(recipe, option)) {
    return { ok: false, reason: enchantingRecipeDisabledReason(recipe, option), kind, tier, slot, rarity: recipeRarity };
  }
  if (tier < minimumTier || tier > 3) {
    return { ok: false, reason: `${ENCHANTING_SLOT_RULES[slot].label} requires a +${minimumTier} or higher smith-tiered item.`, kind, tier, slot, rarity: recipeRarity };
  }
  const appliesTo = recipeAppliesTo(recipe);
  if (appliesTo.length && !appliesTo.includes(kind)) {
    return { ok: false, reason: `This enchantment applies to ${appliesTo.join(", ")}, not ${kind}.`, kind, tier, slot, rarity: recipeRarity };
  }
  const requires = recipeRequires(recipe);
  const allowedFamilies = arrayValue(requires.weaponFamily || requires.weapon_family).map(normalizedToken);
  const family = enchantingWeaponFamily(item);
  const effectiveFamilies = allowedFamilies.length === 1 && allowedFamilies[0] === "sword" ? [] : allowedFamilies;
  if (kind === "weapon" && effectiveFamilies.length && !effectiveFamilies.some((allowed) => family === allowed || family.includes(allowed) || allowed.includes(family))) {
    return { ok: false, reason: `This pattern requires one of: ${effectiveFamilies.join(", ")}.`, kind, tier, slot, rarity: recipeRarity, family };
  }
  const requiredDamage = arrayValue(requires.damageType || requires.damage_type).map(normalizedToken);
  const damageTypes = enchantingDamageTypes(item);
  if (requiredDamage.length && !requiredDamage.some((allowed) => damageTypes.includes(allowed))) {
    return { ok: false, reason: `This pattern requires ${requiredDamage.join(" or ")} damage.`, kind, tier, slot, rarity: recipeRarity, family, damageTypes };
  }
  return { ok: true, reason: "Compatible", kind, tier, slot, rarity: recipeRarity, family, damageTypes };
}

function normalizeSlotEntry(value, slot = "") {
  const entry = objectValue(value);
  if (!Object.keys(entry).length) return null;
  return {
    slot: slot || text(entry.slot).toUpperCase(),
    key: text(entry.key || entry.id || entry.name),
    name: text(entry.name || entry.label || entry.title || "Unnamed Enchantment"),
    rarity: normalizeEnchantingRarity(entry.rarity || ""),
    source: text(entry.source || "Enchanting"),
    option: entry.option ?? entry.selected_option ?? null,
    effect_text: text(entry.effect_text || entry.effect || entry.text || entry.description),
    entries: dedupe(arrayValue(entry.entries).map((line) => text(line)).filter(Boolean)),
    catalyst: entry.catalyst && typeof entry.catalyst === "object" ? entry.catalyst : null,
    applied_at: entry.applied_at || entry.appliedAt || null,
  };
}

export function normalizeEnchantingSlots(item = {}) {
  const payload = enchantingItemPayload(item);
  const enchanting = objectValue(payload.enchanting);
  const slotsSource = objectValue(enchanting.slots || payload.enchantment_slots || payload.enchanting_slots || payload.magic_slots);
  const result = {};
  ENCHANTING_SLOT_ORDER.forEach((slot) => {
    const normalized = normalizeSlotEntry(slotsSource[slot] || slotsSource[slot.toLowerCase()], slot);
    if (normalized) result[slot] = normalized;
  });
  arrayValue(payload.enchantments || enchanting.enchantments).forEach((entry, index) => {
    const slot = text(entry?.slot).toUpperCase() || ENCHANTING_SLOT_ORDER[index];
    if (!ENCHANTING_SLOT_ORDER.includes(slot) || result[slot]) return;
    const normalized = normalizeSlotEntry(entry, slot);
    if (normalized) result[slot] = normalized;
  });
  return result;
}

export function enchantingBaseName(item = {}) {
  const payload = enchantingItemPayload(item);
  const stored = text(payload.enchanting?.base_name || payload.enchanting?.baseName || payload.crafting?.base_name);
  if (stored) return stored;
  const current = text(item.name || item.item_name || item.raw?.item_name || payload.name || payload.item_name || "Unnamed Item");
  const slots = normalizeEnchantingSlots(item);
  let cleaned = current;
  Object.values(slots).forEach((entry) => {
    if (!entry?.name) return;
    const escaped = entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(`\\s*(?:—|–|-|/|\\|)\\s*${escaped}`, "ig"), "");
  });
  return cleaned.replace(/\s+(?:—|–|-|\/|\|)\s*$/, "").replace(/\s+/g, " ").trim() || current;
}

function shortEnchantName(value = "") {
  return text(value).replace(/^Sword of\s+/i, "").replace(/^Weapon of\s+/i, "").replace(/^Armor of\s+/i, "").replace(/^Shield of\s+/i, "").replace(/^Ammunition of\s+/i, "").replace(/^\+\d+\s*/i, "").trim();
}

export function composeEnchantingResultName(baseName = "", slots = {}) {
  const base = text(baseName || "Enchanted Item");
  const names = ENCHANTING_SLOT_ORDER.map((slot) => shortEnchantName(slots?.[slot]?.name)).filter(Boolean);
  return names.length ? `${base} — ${names.join(" / ")}` : base;
}

function flattenTextEntries(value) {
  const result = [];
  const visit = (node) => {
    if (!node) return;
    if (typeof node === "string") {
      const cleaned = text(node);
      if (cleaned) result.push(cleaned);
      return;
    }
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node === "object") {
      if (node.entry) visit(node.entry);
      if (node.entries) visit(node.entries);
      if (node.items) visit(node.items);
    }
  };
  visit(value);
  return dedupe(result);
}

function itemBaseEntries(item = {}) {
  const payload = enchantingItemPayload(item);
  const stored = arrayValue(payload.enchanting?.base_entries || payload.enchanting?.baseEntries);
  if (stored.length) return flattenTextEntries(stored);
  const existingEnchantEntries = new Set(Object.values(normalizeEnchantingSlots(item)).flatMap((entry) => [entry.effect_text, ...(entry.entries || [])]).map(text).filter(Boolean));
  return flattenTextEntries(payload.entries || item.entries || item.raw?.entries || payload.item_description || item.raw?.item_description)
    .filter((entry) => !existingEnchantEntries.has(text(entry)));
}

function substituteVariantTokens(value = "", context = {}) {
  return text(value)
    .replaceAll("{OPTION}", text(context.option).toUpperCase())
    .replaceAll("{LEVEL}", text(context.option))
    .replaceAll("{N}", text(context.option))
    .replaceAll("{DC}", text(context.dc))
    .replaceAll("{ATK}", text(context.attackBonus))
    .replaceAll("{SCHOOLS}", text(context.schools));
}

export function enchantingVariantEffect(recipe = {}, item = {}, option = null) {
  const raw = recipeVariant(recipe);
  const kind = enchantingItemKind(item);
  const textByKind = objectValue(raw.textByKind || recipe.text_by_kind || recipe.textByKind);
  const dcByValue = objectValue(raw.dcByValue || recipe.dc_by_value || recipe.dcByValue);
  const attackByValue = objectValue(raw.attackBonusByValue || recipe.attack_bonus_by_value || recipe.attackBonusByValue);
  const context = { option, dc: dcByValue[String(option)] ?? "", attackBonus: attackByValue[String(option)] ?? "", schools: raw.schools || recipe.schools || "" };
  const primary = textByKind[kind] || textByKind.weapon || textByKind.armor || textByKind.shield || textByKind.ammunition || recipe.effect_text || recipe.summary;
  return substituteVariantTokens(primary, context);
}

export function enchantingVariantEntries(recipe = {}, item = {}, option = null) {
  const raw = recipeVariant(recipe);
  const effect = enchantingVariantEffect(recipe, item, option);
  const rawEntries = flattenTextEntries(raw.entries || recipe.entries).map((entry) => substituteVariantTokens(entry, { option, schools: raw.schools || recipe.schools || "" }));
  return dedupe([effect, ...rawEntries].filter(Boolean));
}

export function enchantingRecipeOptions(recipe = {}) {
  const raw = recipeVariant(recipe);
  return arrayValue(raw.options || recipe.options);
}

export function enchantingRecipeAffinityTags(recipe = {}, option = null) {
  const raw = recipeVariant(recipe);
  const blob = [recipe.name, recipe.summary, enchantingVariantEffect(recipe, {}, option), option, ...arrayValue(raw.options)].filter(Boolean).join(" ").toLowerCase();
  const tags = [];
  ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder", "bludgeoning", "piercing", "slashing"].forEach((tag) => {
    if (blob.includes(tag)) tags.push(tag);
  });
  if (/holy|divine|sun|radiant/.test(blob)) tags.push("holy", "radiant");
  if (/mind|psychic|dream|thought/.test(blob)) tags.push("mind", "psychic");
  if (/shadow|necrotic|death|wound|life stealing/.test(blob)) tags.push("shadow", "necrotic");
  if (/storm|lightning|thunder|wind|zephyr/.test(blob)) tags.push("storm");
  if (/fey|sylvan|nature|beast/.test(blob)) tags.push("fey", "nature");
  if (/ward|resistance|anchoring|defen/.test(blob)) tags.push("ward");
  return dedupe(tags);
}

function materialBlob(material = {}) {
  const payload = objectValue(material.payload || material.raw?.payload || material.raw?.card_payload);
  return [material.name, material.item_name, material.category, material.type, material.rarity, material.notes, material.description, ...arrayValue(material.tags), ...arrayValue(material.raw?.tags), ...arrayValue(payload.tags)].filter(Boolean).join(" ").toLowerCase();
}

export function isEnchantingCatalyst(material = {}, recipe = {}, slot = "", option = null) {
  if (!material) return false;
  const targetSlot = slot || enchantingSlotForRecipe(recipe, option);
  const rule = ENCHANTING_SLOT_RULES[targetSlot];
  if (!rule) return false;
  const blob = materialBlob(material);
  if (!/catalyst|essence|core|shard|gem|crystal|dust|resin|rune|sigil|quintessence|aether|arcane/.test(blob)) return false;
  return enchantingRarityRank(material.rarity || "Common") >= enchantingRarityRank(rule.minimumCatalystRarity);
}

export function enchantingCatalystEffect(material = {}, recipe = {}, slot = "", option = null) {
  if (!material) return null;
  const targetSlot = slot || enchantingSlotForRecipe(recipe, option);
  const affinities = enchantingRecipeAffinityTags(recipe, option);
  const blob = materialBlob(material);
  const matchedAffinities = affinities.filter((tag) => blob.includes(tag));
  return {
    name: matchedAffinities.length ? "Resonant Arcane Catalyst" : "Arcane Binding Catalyst",
    dc_modifier: 0,
    effect_summary: matchedAffinities.length
      ? `Stabilizes Slot ${targetSlot} and resonates with ${matchedAffinities.join(", ")}.`
      : `Stabilizes the Slot ${targetSlot} binding without changing the Craft DC.`,
    risk_summary: "The catalyst is consumed when the successful enchantment replaces the selected slot.",
    affinity_tags: matchedAffinities,
    applicable_label: "Binding impact",
  };
}

function catalystSnapshot(catalyst = null) {
  if (!catalyst) return null;
  return {
    inventory_item_id: catalyst.existing_work || catalyst.is_admin_virtual ? null : catalyst.id || null,
    name: catalyst.name || catalyst.item_name || "Arcane Catalyst",
    rarity: normalizeEnchantingRarity(catalyst.rarity || "Common"),
    source: catalyst.source || "Inventory",
    tags: dedupe(arrayValue(catalyst.tags)),
    is_admin_virtual: Boolean(catalyst.is_admin_virtual),
  };
}

export function buildEnchantingPreview(recipe = {}, item = null, option = null, catalyst = null) {
  if (!recipe || !item) return null;
  const check = enchantingRequirementCheck(item, recipe, option);
  const slot = check.slot;
  const existingSlots = normalizeEnchantingSlots(item);
  const effectText = enchantingVariantEffect(recipe, item, option);
  const variantEntries = enchantingVariantEntries(recipe, item, option);
  const variant = slot ? {
    slot,
    key: text(recipe.key || recipe.variant?.key || recipe.id || recipe.name),
    name: text(recipe.name || recipe.originalName || "Unnamed Enchantment"),
    rarity: check.rarity,
    source: text(recipe.source || recipe.variant?.source || "Enchanting"),
    option: option === "" ? null : option,
    effect_text: effectText,
    entries: variantEntries,
    catalyst: catalystSnapshot(catalyst),
  } : null;
  const nextSlots = { ...existingSlots };
  if (slot && variant) nextSlots[slot] = variant;
  const baseName = enchantingBaseName(item);
  const baseEntries = itemBaseEntries(item);
  const finalEntries = dedupe([
    ...baseEntries,
    ...ENCHANTING_SLOT_ORDER.flatMap((slotKey) => {
      const entry = nextSlots[slotKey];
      return entry ? [entry.effect_text, ...(entry.entries || [])] : [];
    }),
  ].filter(Boolean));
  const tier = enchantingTierForItem(item);
  const baseRarity = normalizeEnchantingRarity(item.rarity || item.item_rarity || enchantingItemPayload(item).rarity || TIER_RARITY[tier]);
  const outputRarity = enchantingRarityRank(baseRarity) >= enchantingRarityRank(check.rarity) ? baseRarity : check.rarity;
  return {
    valid: check.ok && Boolean(catalyst),
    requirement: check,
    slot,
    slotLabel: slot ? ENCHANTING_SLOT_RULES[slot].label : "Unavailable",
    tier,
    unlockedSlots: enchantingUnlockedSlots(tier),
    baseName,
    baseEntries,
    existingSlots,
    replacedSlot: slot ? existingSlots[slot] || null : null,
    nextSlots,
    variant,
    effectText,
    finalEntries,
    finalName: composeEnchantingResultName(baseName, nextSlots),
    outputRarity,
    catalyst: catalystSnapshot(catalyst),
    catalystRequired: true,
    disabledReason: check.ok ? (!catalyst ? `Choose a compatible catalyst for Slot ${slot}.` : "") : check.reason,
  };
}

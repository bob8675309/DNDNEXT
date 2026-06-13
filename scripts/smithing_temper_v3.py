from pathlib import Path
import re

path = Path("pages/items.js")
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


def replace_between(start_marker, end_marker, replacement, label):
    global text
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f"{label}: start marker not found")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"{label}: end marker not found")
    text = text[:start] + replacement.rstrip() + "\n" + text[end:]


# -----------------------------------------------------------------------------
# Constants and concrete material metadata.
# -----------------------------------------------------------------------------
constants = r'''const ENCHANTING_SECTIONS = ["All", "Melee Weapon", "Ranged Weapon", "Ammo", "Armor", "Shield"];
const TEMPER_DAMAGE_TYPES = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];
const SMITHING_DAMAGE_DIE_STEPS = ["d4", "d6", "d8", "d10", "d12"];
const SMITHING_TEMPER_DC_FLOORS = { 0: 10, 1: 20, 2: 25, 3: 30 };
const SMITHING_ESSENCE_TIERS = {
  mote: { label: "Mote", rarity: "Uncommon", damagePct: 25, dcModifier: 2 },
  shard: { label: "Shard", rarity: "Rare", damagePct: 50, dcModifier: 4 },
  core: { label: "Core", rarity: "Very Rare", damagePct: 75, dcModifier: 6 },
};
const DRAGON_SMITHING_ELEMENTS = [
  ["Black", "acid"], ["White", "cold"], ["Red", "fire"], ["Gold", "fire"], ["Brass", "fire"],
  ["Amethyst", "force"], ["Blue", "lightning"], ["Bronze", "lightning"], ["Topaz", "necrotic"],
  ["Green", "poison"], ["Emerald", "psychic"], ["Crystal", "radiant"], ["Sapphire", "thunder"],
];
const BASE_SMITHING_MATERIAL_CATALOG = [
  {
    name: "Mithral Ingot", category: "Ore / Metal", rarity: "Rare", dc: 2, materialClass: "Legendary Metal",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: [],
    offensive: "Reduce the finished weapon's weight by half. A Heavy weapon loses the Heavy property.",
    defensive: "Halve the finished armor or shield's weight; remove its Strength requirement and Stealth disadvantage.",
    weaponMechanics: { weightMultiplier: 0.5, removeProperties: ["Heavy"] },
    armorMechanics: { weightMultiplier: 0.5, removeStrengthRequirement: true, removeStealthDisadvantage: true },
    risk: "Requires exact heat control; overheating ruins its flexibility."
  },
  {
    name: "Adamantine Bar", category: "Ore / Metal", rarity: "Very Rare", dc: 3, materialClass: "Legendary Metal",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: [],
    offensive: "Increase the weapon's base damage die by two steps (d4 → d8, d6 → d10, d8/d10/d12 → d12).",
    defensive: "Critical hits against the bearer become normal hits.",
    weaponMechanics: { dieSteps: 2 }, armorMechanics: { criticalHitImmunity: true },
    risk: "Extremely difficult to shape; failed work can damage tools or waste the stock."
  },
  {
    name: "Orichalcum Ingot", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Legendary Metal",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["radiant", "force"],
    offensive: "Radiant or Force damage riders on the item are increased by 25%; matching saving-throw effects gain +1 Save DC instead.",
    defensive: "Provides 25% Radiant and 25% Force absorption investment.",
    matchingEffectMultiplier: 1.25, matchingSaveDcBonus: 1,
    armorAbsorption: { radiant: 25, force: 25 },
    risk: "Stored magic can discharge if the alloy is worked unevenly."
  },
  {
    name: "Cold Iron Ingot", category: "Ore / Metal", rarity: "Rare", dc: 3, materialClass: "Legendary Metal",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["fey", "planar"],
    offensive: "The weapon counts as Cold Iron and deals 25% additional base weapon damage against Fey creatures.",
    defensive: "The bearer has Advantage on saving throws against Fey charm and forced planar movement.",
    weaponMechanics: { targetBonusPct: 25, targetTags: ["fey"] },
    armorMechanics: { saveAdvantageTags: ["fey charm", "forced planar movement"] },
    risk: "Never expose it to ordinary forge heat; it must be pressure-worked and rune-cooled."
  },
  {
    name: "Ironwood Heartwood", category: "Material", rarity: "Rare", dc: 2, materialClass: "Organic & Botanical",
    allowedItemKinds: ["weapon", "armor", "shield"], allowedWeaponFamilies: ["ranged", "hafted", "blunt"], affinityTags: ["nature"],
    offensive: "The weapon is nonmetal, retains normal durability, and can serve as a druidic spellcasting focus.",
    defensive: "The armor or shield is nonmetal and weighs 25% less without reducing its Armor Class.",
    weaponMechanics: { nonmetal: true, druidicFocus: true }, armorMechanics: { nonmetal: true, weightMultiplier: 0.75 },
    risk: "Must be cured slowly; hurried drying causes hidden internal splits."
  },
  {
    name: "Deep Coral Plate", category: "Monster Part", rarity: "Rare", dc: 3, materialClass: "Organic & Botanical",
    allowedItemKinds: ["armor", "shield"], affinityTags: ["cold", "water"],
    offensive: "Not valid as the structural body of a weapon.",
    defensive: "Provides 25% Cold absorption investment and removes environmental penalties caused by deep-water pressure.",
    armorAbsorption: { cold: 25 }, armorMechanics: { deepWaterAdapted: true },
    risk: "Dries and fractures unless kept mineral-treated throughout shaping."
  },
  {
    name: "Umbral Chitin", category: "Monster Part", rarity: "Uncommon", dc: 2, materialClass: "Organic & Botanical",
    allowedItemKinds: ["ammunition", "armor", "shield"], affinityTags: ["necrotic", "shadow"],
    offensive: "Ammunition made from the chitin gains 25% Necrotic base-damage investment.",
    defensive: "Reduce the finished armor's weight by 25% and add 25% Necrotic absorption investment.",
    weaponMechanics: { damageInvestment: { necrotic: 25 } }, armorAbsorption: { necrotic: 25 }, armorMechanics: { weightMultiplier: 0.75 },
    risk: "Heat destroys its structure; it must be cut, laminated, and resin-bound."
  },
  {
    name: "Obsidian Edgeglass", category: "Material", rarity: "Uncommon", dc: 2, materialClass: "Crystal & Mineral",
    allowedItemKinds: ["weapon", "ammunition"], allowedWeaponFamilies: ["blade", "piercing", "ammunition"], affinityTags: [],
    offensive: "Increase the weapon's base damage die by one step, but a natural 1 on an attack damages the edge until repaired.",
    defensive: "Not valid as the structural body of armor or a shield.",
    weaponMechanics: { dieSteps: 1, fragileOnNaturalOne: true },
    risk: "Exceptionally sharp and brittle; failed shaping can shatter the full piece."
  },
  {
    name: "Blood Glass", category: "Material", rarity: "Rare", dc: 4, materialClass: "Crystal & Mineral",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["necrotic", "corruption"],
    offensive: "Necrotic or Corruption damage riders are increased by 25%; matching saving-throw effects gain +1 Save DC instead.",
    defensive: "Provides 25% Necrotic absorption investment and Advantage on saves against Corruption effects.",
    matchingEffectMultiplier: 1.25, matchingSaveDcBonus: 1, armorAbsorption: { necrotic: 25 },
    armorMechanics: { saveAdvantageTags: ["corruption"] },
    risk: "Responds to blood and hostile magic; careless work can awaken a lingering curse."
  },
  {
    name: "Star Metal", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Crystal & Mineral",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["force", "radiant"],
    offensive: "Force or Radiant damage riders are increased by 25%; matching saving-throw effects gain +1 Save DC instead.",
    defensive: "Provides 25% Force and 25% Radiant absorption investment.",
    matchingEffectMultiplier: 1.25, matchingSaveDcBonus: 1, armorAbsorption: { force: 25, radiant: 25 },
    risk: "Its internal charge shifts with celestial cycles and can arc during forging."
  },
  {
    name: "Stygian Iron", category: "Ore / Metal", rarity: "Very Rare", dc: 5, materialClass: "Esoteric & Magical",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["fire", "necrotic", "corruption"],
    offensive: "The Initial Temper chooses Fire or Necrotic as the weapon's base damage type. Matching damage effects are increased by 50%; matching saving-throw effects gain +2 Save DC instead.",
    defensive: "Provides 50% Fire and 50% Necrotic absorption investment and Advantage on saves against Corruption.",
    convertsBaseDamage: true, matchingEffectMultiplier: 1.5, matchingSaveDcBonus: 2,
    armorAbsorption: { fire: 50, necrotic: 50 }, armorMechanics: { saveAdvantageTags: ["corruption"] },
    risk: "Carries corruptive resonance and should always receive a visible warning on the finished item."
  },
  {
    name: "Moonsilver", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Esoteric & Magical",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["radiant", "psychic"],
    offensive: "Radiant or Psychic damage riders are increased by 25%; matching saving-throw effects gain +1 Save DC instead.",
    defensive: "Provides 25% Radiant and 25% Psychic absorption investment; the item cannot be forcibly phased out of the bearer's possession.",
    matchingEffectMultiplier: 1.25, matchingSaveDcBonus: 1, armorAbsorption: { radiant: 25, psychic: 25 },
    risk: "Waxes and wanes with lunar phases; unstable work can partially phase out of its fittings."
  },
  {
    name: "Riverine", category: "Material", rarity: "Legendary", dc: 6, materialClass: "Esoteric & Magical",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["force", "water"],
    offensive: "Force damage riders are increased by 50%, and the weapon cannot rust or be corroded.",
    defensive: "Provides 75% Force absorption investment and creates a watertight protective shell.",
    matchingEffectMultiplier: 1.5, matchingSaveDcBonus: 2, armorAbsorption: { force: 75 }, armorMechanics: { watertight: true },
    risk: "A damaged containment lattice releases the bound water and collapses the crafted section."
  },
];
const DRAGON_SMITHING_MATERIAL_CATALOG = DRAGON_SMITHING_ELEMENTS.flatMap(([dragon, element]) => [
  {
    name: `${dragon} Dragonhide`, category: "Monster Part", rarity: "Very Rare", dc: 4, materialClass: "Dragonhide",
    allowedItemKinds: ["armor", "shield"], affinityTags: [element, "dragon"], element,
    offensive: "Not valid as the structural body of a weapon.",
    defensive: `Provides 50% ${titleCase(element)} absorption investment.`,
    armorAbsorption: { [element]: 50 }, risk: "Mismatched elemental work can make the hide brittle or violently reactive."
  },
  {
    name: `${dragon} Dragon Scale`, category: "Monster Part", rarity: "Very Rare", dc: 5, materialClass: "Dragon Scale",
    allowedItemKinds: ["armor", "shield"], affinityTags: [element, "dragon"], element,
    offensive: "Not valid as the structural body of a weapon.",
    defensive: `Provides 50% ${titleCase(element)} absorption investment and +1 AC when used for a complete suit or shield face.`,
    armorAbsorption: { [element]: 50 }, armorMechanics: { acBonus: 1 }, risk: "Scales must be aligned to their natural grain or they shear under impact."
  },
]);
const SMITHING_MATERIAL_CATALOG = [...BASE_SMITHING_MATERIAL_CATALOG, ...DRAGON_SMITHING_MATERIAL_CATALOG];'''
replace_between(
    'const ENCHANTING_SECTIONS = ["All", "Melee Weapon", "Ranged Weapon", "Ammo", "Armor", "Shield"];',
    'const ALCHEMY_GROUPS_BY_SECTION = {',
    constants,
    "smithing constants",
)

# -----------------------------------------------------------------------------
# Recipes: add Initial Temper and clarify that only one essence is chosen per job.
# -----------------------------------------------------------------------------
temper_recipes = r'''function temperRecipes() {
  return [0, 1, 2, 3].map((n) => ({
    id: n === 0 ? "temper:initial" : `temper:+${n}`,
    name: n === 0 ? "Initial Temper" : `+${n} Temper`,
    discipline: "Smithing",
    kind: "temper",
    temper_tier: n,
    category: "weapon / ammunition / armor / shield",
    family: "Temper",
    rarity: n === 0 ? "Uncommon" : n === 1 ? "Uncommon" : n === 2 ? "Rare" : "Very Rare",
    known: false,
    source: "Town Smithing",
    summary: n === 0
      ? "Bind one elemental Mote, Shard, or Core into an existing mundane item as its Initial Temper."
      : `Advance an existing item to Temper +${n} and bind exactly one elemental Mote, Shard, or Core.`,
    requirements: n === 0
      ? ["Compatible mundane physical item", "Access to a smithy"]
      : ["Base physical item from the previous smith tier", `Smith capable of Temper +${n} work`],
    components: ["Exactly one elemental Mote, Shard, or Core for this operation"],
  }));
}'''
replace_between('function temperRecipes() {', 'function variantRecipe(raw) {', temper_recipes, 'temper recipes')

# -----------------------------------------------------------------------------
# Inventory material normalization must preserve smithing metadata.
# -----------------------------------------------------------------------------
replace_once(
    '  const alchemy = payload.alchemy && typeof payload.alchemy === "object" ? payload.alchemy : {};',
    '  const alchemy = payload.alchemy && typeof payload.alchemy === "object" ? payload.alchemy : {};\n  const smithing = payload.smithing && typeof payload.smithing === "object" ? payload.smithing : {};',
    'material inventory smithing profile',
)
replace_once(
    '    tags: Array.from(new Set([...(arrayFromValue(payload.tags)), ...(arrayFromValue(row.tags)), family, alchemy.kind, "alchemy"].filter(Boolean))),\n    alchemy,',
    '    tags: Array.from(new Set([...(arrayFromValue(payload.tags)), ...(arrayFromValue(row.tags)), family, alchemy.kind, smithing.kind, smithing.element, ...(arrayFromValue(smithing.tags)), alchemy.kind ? "alchemy" : null, smithing.kind ? "smithing" : null].filter(Boolean))),\n    alchemy,\n    smithing,',
    'material inventory tags',
)

# -----------------------------------------------------------------------------
# Physical target, essence tier, compatibility, existing-work hydration, previews.
# -----------------------------------------------------------------------------
physical_helpers = r'''function physicalItemKind(item = {}) {
  const blob = [item.name, item.type, item.itemType, item.family, item.category, item.payload?.item_type, item.payload?.type, item.payload?.uiType, item.raw?.item_type, item.raw?.card_payload?.uiType].filter(Boolean).join(" ").toLowerCase();
  if (/ammunition|arrow|bolt/.test(blob)) return "ammunition";
  if (/shield/.test(blob)) return "shield";
  if (/armor|armour|mail|plate|breastplate/.test(blob)) return "armor";
  if (/weapon|melee|ranged|sword|axe|mace|bow|crossbow|spear|dagger|hammer|club|staff|glaive|halberd|pike|rapier|scimitar|trident|flail|lance/.test(blob)) return "weapon";
  return "gear";
}
function smithingTargetItem(recipe = {}, baseItem = null) {
  return baseItem || recipe.item_preview || recipe.catalog_item || { name: recipe.name, type: recipe.category, family: recipe.family, category: recipe.category };
}
function smithingWeaponFamily(item = {}) {
  const blob = [item.name, item.type, item.itemType, item.family, item.category, item.payload?.propertiesText, item.payload?.property, item.raw?.card_payload?.propertiesText].filter(Boolean).join(" ").toLowerCase();
  if (/ammunition|arrow|bolt/.test(blob)) return "ammunition";
  if (/bow|crossbow|sling|ranged/.test(blob)) return "ranged";
  if (/spear|pike|glaive|halberd|staff|club|mace|maul|hammer|axe/.test(blob)) return "hafted";
  if (/dagger|rapier|sword|scimitar|blade/.test(blob)) return "blade";
  if (/piercing|pick|war pick/.test(blob)) return "piercing";
  if (/club|mace|maul|hammer|bludgeoning/.test(blob)) return "blunt";
  return "weapon";
}
function smithingTargetContext(recipe = {}, baseItem = null) {
  const item = smithingTargetItem(recipe, baseItem);
  return { item, itemKind: physicalItemKind(item), weaponFamily: smithingWeaponFamily(item) };
}
function essenceTierForMaterial(material = {}) {
  const profile = smithingProfile(material);
  const explicit = String(profile.essenceTier || profile.essence_tier || material.essence_tier || "").toLowerCase();
  if (SMITHING_ESSENCE_TIERS[explicit]) return explicit;
  const name = String(material.name || "").toLowerCase();
  if (/\bmote\b/.test(name)) return "mote";
  if (/\bshard\b/.test(name)) return "shard";
  if (/\bcore\b/.test(name)) return "core";
  return "";
}
function essenceProfileForMaterial(material = {}) {
  const tier = essenceTierForMaterial(material);
  const tierProfile = SMITHING_ESSENCE_TIERS[tier] || null;
  if (!tierProfile) return null;
  return {
    tier,
    ...tierProfile,
    element: elementalDamageTypeForMaterial(material),
  };
}
function materialCompatibleWithSmithingTarget(material = {}, recipe = {}, baseItem = null) {
  const profile = smithingProfile(material);
  const { itemKind, weaponFamily } = smithingTargetContext(recipe, baseItem);
  const name = String(material.name || "").toLowerCase();
  const role = String(profile.kind || profile.role || "material").toLowerCase();
  if (role && !["material", "stock", "physical"].includes(role)) return false;
  if (/(ash|gland|ichor|bile|venom|blood extract|essence|mote|shard|core|catalyst|sigil|dust)/.test(name)) return false;
  const allowedKinds = Array.isArray(profile.allowedItemKinds) ? profile.allowedItemKinds.map((value) => String(value).toLowerCase()) : [];
  if (allowedKinds.length && !allowedKinds.includes(itemKind)) return false;
  const allowedFamilies = Array.isArray(profile.allowedWeaponFamilies) ? profile.allowedWeaponFamilies.map((value) => String(value).toLowerCase()) : [];
  if (itemKind === "weapon" && allowedFamilies.length && !allowedFamilies.includes(weaponFamily) && !allowedFamilies.includes("weapon")) return false;
  if (profile.requiresElement && !elementalDamageTypeForMaterial(material)) return false;
  if (!allowedKinds.length && String(material.category || "").toLowerCase().includes("monster")) {
    if (/(hide|scale|chitin|carapace|shell|coral)/.test(name)) return ["armor", "shield"].includes(itemKind);
    if (/(sinew|wing membrane)/.test(name)) return itemKind === "weapon" && weaponFamily === "ranged";
    if (/(fang|tooth|claw|talon)/.test(name)) return ["weapon", "ammunition"].includes(itemKind);
    if (/(bone|horn|antler)/.test(name)) return ["weapon", "ammunition", "armor", "shield"].includes(itemKind);
    return false;
  }
  return ["weapon", "ammunition", "armor", "shield"].includes(itemKind);
}
function smithingHistoryFromItem(baseItem = {}) {
  const payload = baseItem?.payload && typeof baseItem.payload === "object" ? baseItem.payload : baseItem?.raw?.card_payload || {};
  const smithing = payload.smithing && typeof payload.smithing === "object" ? payload.smithing : {};
  const selected = Array.isArray(payload.crafting?.selected_materials) ? payload.crafting.selected_materials : [];
  const history = {};
  const materialRecord = selected.find((entry) => entry?.slot_key === "craft-material" || entry?.slot_type === "physical") || (Array.isArray(smithing.materials) ? smithing.materials[0] : null);
  if (materialRecord) history["craft-material"] = materialRecord;
  const tempering = [
    ...(Array.isArray(smithing.tempering) ? smithing.tempering : []),
    ...selected.filter((entry) => entry?.temper_elemental || entry?.slot_type === "temper"),
  ];
  tempering.forEach((entry) => {
    const stage = Number(entry?.temper_stage ?? entry?.stage);
    if (!Number.isFinite(stage) || stage < 0 || stage > 3) return;
    const key = stage === 0 ? "initial-temper" : `temper-${stage}`;
    if (!history[key]) history[key] = entry;
  });
  return history;
}
function existingSmithingCandidate(record = {}, slot = {}) {
  const stage = slot.temper_stage ?? record.temper_stage ?? record.stage ?? null;
  const element = record.temper_element || record.element || "";
  const tier = record.essence_tier || record.essenceTier || "";
  const tierProfile = SMITHING_ESSENCE_TIERS[String(tier).toLowerCase()] || {};
  const name = record.name || record.source_material || (element ? `${titleCase(element)} ${tierProfile.label || "Essence"}` : "Recorded Smithing Work");
  const smithing = record.smithing || {
    kind: slot.temper_elemental ? "temper" : "material",
    element,
    essenceTier: tier,
    damagePct: record.bonus_damage_pct || tierProfile.damagePct || 0,
    dcModifier: record.essence_dc_modifier || tierProfile.dcModifier || 0,
  };
  return {
    id: `existing-smithing:${slot.key || materialSlotKey(slot)}`,
    name,
    category: slot.temper_elemental ? "Elemental Essence" : record.category || "Craft Material",
    type: slot.temper_elemental ? "Completed Temper" : record.material_type || record.material_class || "Recorded Material",
    rarity: rarity(record.rarity || tierProfile.rarity || "Common") || "Common",
    quantity: 1,
    source: "Existing item",
    notes: record.effect || record.effect_summary || record.offensive || record.defensive || "Previously completed smithing work.",
    tags: [element, tier, "smithing", "existing-work"].filter(Boolean),
    smithing,
    temper_stage: stage,
    temper_element: element,
    bonus_damage_pct: Number(record.bonus_damage_pct || tierProfile.damagePct || 0),
    essence_tier: tier,
    existing_work: true,
    is_available: true,
    is_catalog_only: true,
  };
}
function hydrateSmithingPlanWithExisting(plan = {}, baseItem = null) {
  if (!baseItem) return plan;
  const history = smithingHistoryFromItem(baseItem);
  return {
    ...plan,
    matches: (plan.matches || []).map((slot) => {
      const key = materialSlotKey(slot);
      const record = history[key];
      if (!record) return slot;
      const candidate = existingSmithingCandidate(record, slot);
      return {
        ...slot,
        locked: true,
        existing_work: true,
        existing_candidate_id: candidate.id,
        candidates: [candidate, ...(slot.candidates || []).filter((entry) => String(entry.id) !== String(candidate.id))],
      };
    }),
  };
}
function existingSmithingSelectionMap(baseItem = {}) {
  const history = smithingHistoryFromItem(baseItem);
  return Object.fromEntries(Object.keys(history).map((key) => [key, `existing-smithing:${key}`]));
}
'''
replace_between('function physicalItemKind(item = {}) {', 'function temperTierForRecipe(recipe = {}) {', physical_helpers, 'physical smithing helpers')

# -----------------------------------------------------------------------------
# Slot model, essence behavior, and concrete material effects.
# -----------------------------------------------------------------------------
slot_functions = r'''function temperMaterialSlotsForRecipe(recipe = {}, baseItem = null) {
  const isForge = recipe.kind === "forge";
  const targetTier = isForge ? 0 : Math.max(0, Math.min(3, temperTierForRecipe(recipe)));
  const { itemKind } = smithingTargetContext(recipe, baseItem);
  const canTemper = ["weapon", "ammunition", "armor", "shield"].includes(itemKind);
  const slots = [{
    key: "craft-material",
    category: "Craft Material",
    label: "Craft Material",
    role: "Choose compatible physical stock for the selected item class.",
    allowed_categories: ["Ore / Metal", "Monster Part", "Material"],
    required: isForge,
    locked: !isForge,
    existing_only: !isForge,
    physical_material: true,
    slot_type: "physical",
  }];
  if (!canTemper) return slots;
  slots.push({
    key: "initial-temper",
    category: "Elemental Essence",
    label: "Initial Temper",
    role: "Choose one elemental Mote, Shard, or Core. Standard materials retain their normal base damage type; affinity materials can alter it.",
    required: !isForge && targetTier === 0,
    locked: !isForge && targetTier !== 0,
    existing_only: !isForge && targetTier !== 0,
    active_temper_slot: isForge || targetTier === 0,
    temper_elemental: true,
    temper_stage: 0,
    slot_type: "temper",
  });
  for (let stage = 1; stage <= 3; stage += 1) {
    const active = !isForge && stage === targetTier;
    slots.push({
      key: `temper-${stage}`,
      category: "Elemental Essence",
      label: `Temper +${stage}`,
      role: `Choose exactly one elemental Mote, Shard, or Core for Temper +${stage}.`,
      required: active,
      locked: !active,
      existing_only: stage < targetTier,
      future_slot: isForge || stage > targetTier,
      active_temper_slot: active,
      temper_elemental: true,
      temper_stage: stage,
      slot_type: "temper",
    });
  }
  return slots;
}
function temperMaterialEffect(material = {}, slot = {}, baseItem = null, recipe = {}) {
  const essence = essenceProfileForMaterial(material);
  const element = essence?.element || elementalDamageTypeForMaterial(material);
  const stage = Number(slot.temper_stage ?? material.temper_stage ?? 0);
  const pct = Number(essence?.damagePct || material.bonus_damage_pct || 0);
  const dc = material.existing_work ? 0 : Number(essence?.dcModifier || 0);
  const { itemKind } = smithingTargetContext(recipe, baseItem);
  const defensive = ["armor", "shield"].includes(itemKind);
  const stageLabel = stage === 0 ? "Initial Temper" : `Temper +${stage}`;
  return {
    name: `${stageLabel}: ${titleCase(element || "Elemental")} ${essence?.label || "Essence"}`,
    dc_modifier: dc,
    effect_summary: defensive
      ? `Adds ${pct}% ${titleCase(element)} absorption investment to the armor or shield.`
      : `Adds ${titleCase(element)} damage equal to ${pct}% of the weapon's base damage.`,
    risk_summary: "Only one elemental Mote, Shard, or Core can be bound during this temper operation.",
    element,
    temper_stage: stage,
    essence_tier: essence?.tier || "",
    essence_label: essence?.label || "Essence",
    bonus_damage_pct: pct,
    essence_dc_modifier: dc,
  };
}
function smithingMaterialEffect(material = {}, baseItem = null, recipe = {}) {
  const profile = smithingProfile(material);
  if (!Object.keys(profile).length) return null;
  const { itemKind } = smithingTargetContext(recipe, baseItem);
  const defensive = ["armor", "shield"].includes(itemKind);
  const mechanics = defensive ? profile.armorMechanics || {} : profile.weaponMechanics || {};
  return {
    name: `${profile.materialClass || "Special Material"} Working`,
    dc_modifier: material.existing_work ? 0 : Number(profile.dcModifier || 0),
    effect_summary: defensive ? profile.defensive : profile.offensive,
    applicable_label: defensive ? "Armor / Shield Effect" : "Weapon / Ammo Effect",
    mechanics,
    affinity_tags: Array.isArray(profile.affinityTags) ? profile.affinityTags : [],
    risk_summary: profile.risk,
  };
}
function weaponBaseDamageProfile(recipe = {}, baseItem = null) {
  const payload = baseItem?.payload || baseItem?.raw?.card_payload || {};
  const source = payload.dmg1 || payload.damage1 || baseItem?.raw?.dmg1 || recipe?.dmg1 || recipe?.item_preview?.damage || payload.damageText || "";
  return parseDiceExpression(source);
}
function weaponBaseDamageType(recipe = {}, baseItem = null) {
  const payload = baseItem?.payload || baseItem?.raw?.card_payload || {};
  const rawType = payload.dmgType || payload.damageType || payload.damage_type || recipe?.dmgType || "";
  if (FORGE_DAMAGE_TYPE_LABELS[rawType]) return FORGE_DAMAGE_TYPE_LABELS[rawType];
  if (rawType) return String(rawType).toLowerCase();
  const text = [recipe?.item_preview?.damage, payload.damageText].filter(Boolean).join(" ").toLowerCase();
  return TEMPER_DAMAGE_TYPES.find((type) => text.includes(type)) || ["slashing", "piercing", "bludgeoning"].find((type) => text.includes(type)) || "physical";
}
function formatScaledWeaponDamage(baseDice = null, pct = 0) {
  if (!baseDice || !pct) return `${pct}% of base weapon damage`;
  const scaledCount = Number(baseDice.count || 0) * Number(pct || 0) / 100;
  if (Number.isInteger(scaledCount) && scaledCount > 0) return `${scaledCount}d${baseDice.size}`;
  return `${pct}% of ${baseDice.count}d${baseDice.size}`;
}
function effectiveAbsorptionPercent(investment = 0) {
  const value = Math.max(0, Number(investment) || 0);
  return value <= 100 ? value : 100 + (value - 100) / 2;
}
function absorptionOutcomeLabel(investment = 0) {
  const effective = effectiveAbsorptionPercent(investment);
  if (effective < 100) return `${effective}% damage reduction`;
  if (effective === 100) return "Immunity (100% damage reduction)";
  return `Immunity; heal ${effective - 100}% of incoming damage`;
}
function smithingProductPreview(recipe = {}, baseItem = null, selectedMaterials = []) {
  if (recipe?.discipline !== "Smithing") return null;
  const { itemKind } = smithingTargetContext(recipe, baseItem);
  const physical = selectedMaterials.find((entry) => entry?.slot_type === "physical" || entry?.slot_key === "craft-material") || null;
  const profile = physical ? smithingProfile(physical) : {};
  const tempers = selectedMaterials.filter((entry) => entry?.temper_elemental || entry?.slot_type === "temper");
  if (["armor", "shield"].includes(itemKind)) {
    const investment = { ...(profile.armorAbsorption || {}) };
    tempers.forEach((entry) => {
      const element = entry.temper_element || elementalDamageTypeForMaterial(entry);
      const pct = Number(entry.bonus_damage_pct || essenceProfileForMaterial(entry)?.damagePct || 0);
      if (element && pct) investment[element] = Number(investment[element] || 0) + pct;
    });
    return {
      kind: "defensive",
      material: physical?.name || null,
      absorption: Object.entries(investment).map(([element, value]) => ({ element, investment: Number(value), effective: effectiveAbsorptionPercent(value), outcome: absorptionOutcomeLabel(value) })),
    };
  }
  const baseDice = weaponBaseDamageProfile(recipe, baseItem);
  const initial = tempers.find((entry) => Number(entry.temper_stage ?? -1) === 0) || null;
  const initialElement = initial?.temper_element || elementalDamageTypeForMaterial(initial || {});
  const affinity = Array.isArray(profile.affinityTags) ? profile.affinityTags.map((value) => String(value).toLowerCase()) : [];
  const convertsBase = Boolean(profile.convertsBaseDamage && initialElement && affinity.includes(initialElement));
  const baseType = convertsBase ? initialElement : weaponBaseDamageType(recipe, baseItem);
  const riders = {};
  tempers.forEach((entry) => {
    const element = entry.temper_element || elementalDamageTypeForMaterial(entry);
    let pct = Number(entry.bonus_damage_pct || essenceProfileForMaterial(entry)?.damagePct || 0);
    if (!element || !pct) return;
    if (affinity.includes(element)) pct *= Number(profile.matchingEffectMultiplier || 1);
    riders[element] = Number(riders[element] || 0) + pct;
  });
  return {
    kind: "offensive",
    material: physical?.name || null,
    baseDamage: baseDice ? `${baseDice.count}d${baseDice.size}` : recipe?.item_preview?.damage || baseItem?.payload?.damageText || "Base weapon damage",
    baseType,
    convertedBaseType: convertsBase,
    riders: Object.entries(riders).map(([element, pct]) => ({ element, pct, dice: formatScaledWeaponDamage(baseDice, pct) })),
    affinitySaveDcBonus: Number(profile.matchingSaveDcBonus || 0),
  };
}
function applySmithingAttemptPreview(recipe = {}, preview = {}, selectedMaterials = []) {
  if (recipe?.discipline !== "Smithing") return preview;
  const isForge = recipe.kind === "forge";
  const stage = isForge ? 0 : Math.max(0, Math.min(3, temperTierForRecipe(recipe)));
  const activeEssences = selectedMaterials.filter((entry) => (entry?.temper_elemental || entry?.slot_type === "temper") && !entry?.existing_work);
  const essenceDc = activeEssences.reduce((sum, entry) => sum + Number(entry.essence_dc_modifier || essenceProfileForMaterial(entry)?.dcModifier || 0), 0);
  const physicalDc = isForge
    ? selectedMaterials.filter((entry) => (entry?.slot_type === "physical" || entry?.slot_key === "craft-material") && !entry?.existing_work).reduce((sum, entry) => sum + Number(smithingProfile(entry)?.dcModifier || 0), 0)
    : 0;
  const baseRecipeDc = Math.max(10, Number(preview.base_dc || recipe.base_dc || 10) || 10);
  const floor = Number(SMITHING_TEMPER_DC_FLOORS[stage] || 10);
  const finalDc = isForge || stage === 0 ? baseRecipeDc + physicalDc + essenceDc : floor + essenceDc;
  return { ...preview, final_dc: finalDc, smithing_temper_stage: stage, smithing_dc_floor: isForge || stage === 0 ? baseRecipeDc : floor, essence_dc_modifier: essenceDc, physical_material_dc_modifier: physicalDc };
}
'''
replace_between('function temperMaterialSlotsForRecipe(recipe = {}, baseItem = null) {', 'function buildSmithingMaterialCatalog(isAdmin = false) {', slot_functions, 'smithing slot functions')

# Preserve all structured metadata in the fallback catalog.
replace_once(
    '    tags: ["smithing", "material", String(entry.materialClass || "").toLowerCase(), String(entry.rarity || "").toLowerCase()],\n    smithing: {\n      kind: "material",\n      materialClass: entry.materialClass,\n      offensive: entry.offensive,\n      defensive: entry.defensive,\n      dcModifier: entry.dc,\n      risk: entry.risk,\n    },',
    '    tags: ["smithing", "material", String(entry.materialClass || "").toLowerCase(), String(entry.rarity || "").toLowerCase(), ...(entry.affinityTags || [])],\n    smithing: {\n      ...entry,\n      kind: "material",\n      dcModifier: entry.dc,\n    },',
    'fallback material metadata',
)

# Require a recognized Mote, Shard, or Core rather than old generic Essence rows.
replace_once(
    '  return family.includes("essence") || family.includes("mote") || /essence|motes?|quintessence/.test(name) || tags.includes("smithing-temper") || tags.includes("elemental");',
    '  return Boolean(essenceTierForMaterial(material)) && (family.includes("essence") || family.includes("mote") || /mote|shard|core/.test(name) || tags.includes("smithing-temper") || tags.includes("elemental"));',
    'temper material recognition',
)

# Replace essence fallback catalog with 30 tiered variants.
essence_catalog = r'''function buildPurchasedEssenceCatalog(isAdmin = false) {
  const elements = [
    ["Acid", "acid", "caustic elemental power"],
    ["Frost", "cold", "cold and ice"],
    ["Fire", "fire", "fire and heat"],
    ["Force", "force", "force and arcane pressure"],
    ["Storm", "lightning", "lightning and storm charge"],
    ["Shadow", "necrotic", "death, shadow, and necrotic power"],
    ["Poison", "poison", "toxin and venom power"],
    ["Psychic", "psychic", "mind and psychic pressure"],
    ["Radiant", "radiant", "radiant, sun, and holy power"],
    ["Thunder", "thunder", "thunder and resonant force"],
  ];
  return elements.flatMap(([label, element, notes]) => Object.entries(SMITHING_ESSENCE_TIERS).map(([tier, profile]) => {
    const name = `${label} ${profile.label}`;
    return {
      id: `catalog-essence:${resourceKeyFor({ name })}`,
      name,
      category: "Reagent / Catalyst",
      type: "Elemental Essence",
      rarity: profile.rarity,
      quantity: isAdmin ? 999 : 0,
      owned_quantity: 0,
      source: isAdmin ? "Admin test stock" : "Elemental essence catalog",
      notes: `${profile.label} of ${notes}; contributes ${profile.damagePct}% of base weapon damage or ${profile.damagePct}% elemental absorption investment.`,
      reagent_family: "essence",
      family_label: "Essence",
      potency_rank: tier === "mote" ? 1 : tier === "shard" ? 2 : 3,
      tags: ["essence", tier, "elemental", element, "smithing-temper", "reagent", "catalyst"],
      alchemy: { kind: "modifier", family: "essence", familyLabel: "Essence", brewTags: [titleCase(element)], bonuses: { typeDirection: element } },
      smithing: { kind: "temper", materialClass: "Elemental Essence", essenceTier: tier, element, damagePct: profile.damagePct, dcModifier: profile.dcModifier, tags: ["elemental", "smithing-temper", tier, element] },
      essence_tier: tier,
      is_available: Boolean(isAdmin),
      is_catalog_only: true,
      is_admin_virtual: Boolean(isAdmin),
    };
  }));
}'''
replace_between('function buildPurchasedEssenceCatalog(isAdmin = false) {', 'function buildAdminVirtualCraftingMaterials(isAdmin = false) {', essence_catalog, 'tiered essence catalog')

# Remove generic invalid monster components from the admin-only structural stock list.
text = text.replace('    ["Dragon Scale", "Monster Part", "Very Rare", "draconic monster catalyst"],\n', '')
text = text.replace('    ["Phoenix Ash", "Monster Part", "Legendary", "mythic rebirth catalyst"],\n', '')

# -----------------------------------------------------------------------------
# Required slots and candidate filtering.
# -----------------------------------------------------------------------------
replace_once(
    '  if (recipe?.discipline === "Smithing" && recipe?.kind === "temper") return temperMaterialSlotsForRecipe(recipe, baseItem);',
    '  if (recipe?.discipline === "Smithing" && ["forge", "temper"].includes(recipe?.kind)) return temperMaterialSlotsForRecipe(recipe, baseItem);',
    'smithing slot routing',
)
replace_once(
    '        if (slot.temper_elemental) return isElementalTemperMaterial(material);\n        if (Array.isArray(slot.allowed_categories)) return slot.allowed_categories.some((category) => materialMatchesCategory(material, category));',
    '        if (slot.temper_elemental) return isElementalTemperMaterial(material);\n        if (slot.physical_material && recipe.discipline === "Smithing") return materialCompatibleWithSmithingTarget(material, recipe, baseItem);\n        if (Array.isArray(slot.allowed_categories)) return slot.allowed_categories.some((category) => materialMatchesCategory(material, category));',
    'smithing compatibility filter',
)

# -----------------------------------------------------------------------------
# Selected material payload: essence tier determines damage and DC, stage only
# identifies the operation.
# -----------------------------------------------------------------------------
replace_once(
    '      temper_stage: entry.temper_stage || null,\n      bonus_damage_pct: entry.bonus_damage_pct || null,\n      temper_element: selected ? elementalDamageTypeForMaterial(selected) || null : null,\n      smithing: selected ? smithingProfile(selected) : null,',
    '      temper_stage: entry.temper_stage ?? null,\n      bonus_damage_pct: selected && entry.temper_elemental ? essenceProfileForMaterial(selected)?.damagePct || null : null,\n      essence_tier: selected && entry.temper_elemental ? essenceProfileForMaterial(selected)?.tier || null : null,\n      essence_dc_modifier: selected && entry.temper_elemental ? essenceProfileForMaterial(selected)?.dcModifier || 0 : 0,\n      temper_element: selected ? elementalDamageTypeForMaterial(selected) || null : null,\n      smithing: selected ? smithingProfile(selected) : null,\n      existing_work: Boolean(selected?.existing_work),',
    'selected material essence metadata',
)
replace_once(
    '      temper_stage: entry.temper_stage || null,\n      bonus_damage_pct: entry.bonus_damage_pct || null,\n      temper_element: elementalDamageTypeForMaterial(selected) || null,\n      smithing: smithingProfile(selected),',
    '      temper_stage: entry.temper_stage ?? null,\n      bonus_damage_pct: entry.temper_elemental ? essenceProfileForMaterial(selected)?.damagePct || null : null,\n      essence_tier: entry.temper_elemental ? essenceProfileForMaterial(selected)?.tier || null : null,\n      essence_dc_modifier: entry.temper_elemental ? essenceProfileForMaterial(selected)?.dcModifier || 0 : 0,\n      temper_element: elementalDamageTypeForMaterial(selected) || null,\n      smithing: smithingProfile(selected),\n      existing_work: Boolean(selected?.existing_work),',
    'selected object essence metadata',
)
# Stage zero must appear in temper previews.
text = text.replace('materialBreakdown.filter((item) => item.temper_stage).sort((a, b) => a.temper_stage - b.temper_stage)', 'materialBreakdown.filter((item) => item.temper_stage !== null && item.temper_stage !== undefined).sort((a, b) => a.temper_stage - b.temper_stage)')

# -----------------------------------------------------------------------------
# Item eligibility includes Initial Temper and respects exact next smith tier.
# -----------------------------------------------------------------------------
is_candidate = r'''function isCraftBaseCandidate(item, recipe) {
  if (!item || !recipe) return false;
  const blob = [item.name, item.type, item.rarity, item.payload?.item_type, item.payload?.type, item.payload?.uiType].filter(Boolean).join(" ").toLowerCase();
  const physical = /(weapon|armor|shield|ammunition|melee|ranged)/.test(blob);
  if (recipe.kind === "forge" || recipe.kind === "alchemy" || recipe.discipline === "Alchemy") return false;
  if (recipe.discipline === "Smithing") {
    if (!physical) return false;
    if (recipe.kind !== "temper") return true;
    const targetTier = Math.max(0, Math.min(3, temperTierForRecipe(recipe)));
    const currentTier = physicalEnhancementTier(item);
    if (targetTier === 0) return currentTier === 0 && !smithingHistoryFromItem(item)["initial-temper"];
    if (currentTier !== targetTier - 1) return false;
    return !smithingHistoryFromItem(item)[`temper-${targetTier}`];
  }
  if (recipe.discipline === "Enchanting") {
    if (!physical) return false;
    const itemTier = physicalEnhancementTier(item);
    const minimumTier = Math.max(1, recipePhysicalTier(recipe));
    return itemTier >= minimumTier && itemTier <= 3;
  }
  return true;
}'''
replace_between('function isCraftBaseCandidate(item, recipe) {', 'function characterName(character) {', is_candidate, 'base item candidate')

# -----------------------------------------------------------------------------
# Context-sensitive material card: show only the effect that applies.
# -----------------------------------------------------------------------------
physical_card = r'''function PhysicalMaterialEffectCard({ material, materialEffects = [], quantityLabel = "", compact = false, discipline = "Crafting", baseItem = null, recipe = {}, slot = {} }) {
  if (!material) return null;
  const profile = smithingProfile(material);
  const effect = slot?.temper_elemental
    ? temperMaterialEffect(material, slot, baseItem, recipe)
    : smithingMaterialEffect(material, baseItem, recipe) || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {
      name: `${material.category || "Material"} Contribution`,
      dc_modifier: 1,
      effect_summary: "Adds a minor material property determined by the selected recipe.",
      risk_summary: "Requires correct tools and handling.",
    };
  const itemRarity = rarity(material.rarity || "Common") || "Common";
  const dcModifier = Number(effect.dc_modifier || 0);
  const affinityTags = Array.from(new Set([...(effect.affinity_tags || []), effect.element].filter(Boolean)));
  return (
    <div className={cls("craft-material-effect-row", "craft-specific-material-effect-row", "craft-alchemy-effect-card", "craft-physical-effect-card", compact && "compact", material.existing_work && "existing-work", rarityClassName(itemRarity))}>
      <div className="craft-alchemy-item-head">
        <div className="craft-alchemy-item-title-block">
          <strong>{material.name}</strong>
          <span className="craft-ingredient-family-pill craft-ingredient-family-pill-under-name">{slot?.temper_elemental ? (effect.essence_label || "Essence") : profile.materialClass || material.category || material.type || "Material"}</span>
          {affinityTags.length ? <span className="craft-ingredient-theme-tags">{affinityTags.map((tagValue) => <span key={tagValue} className="craft-ingredient-theme-pill">{titleCase(tagValue)}</span>)}</span> : null}
        </div>
        <div className="craft-effect-card-badges">
          <span className={cls("craft-ingredient-quality-pill", rarityClassName(itemRarity))}>{itemRarity}</span>
          {material.existing_work ? <span className="craft-ingredient-qty-pill">Completed</span> : quantityLabel ? <span className="craft-ingredient-qty-pill">{quantityLabel}</span> : null}
        </div>
      </div>
      <div className="craft-alchemy-card-description">{material.notes || material.description || material.raw?.item_description || "Prepared crafting stock."}</div>
      <div className="craft-alchemy-card-divider" />
      <div className="craft-alchemy-impact-label">{slot?.temper_elemental ? "Temper impact" : effect.applicable_label || (discipline === "Smithing" ? "Forge impact" : "Binding impact")}</div>
      <div className="craft-ingredient-impact-chips craft-material-impact-chips">
        <i>{effect.name || "Material effect"}</i>
        {effect.bonus_damage_pct ? <i>{effect.bonus_damage_pct}% base damage / absorption</i> : null}
        <i>{material.existing_work ? "Already applied" : dcModifier ? `Craft DC ${dcModifier > 0 ? "+" : ""}${dcModifier}` : "No Craft DC change"}</i>
      </div>
      <div className="craft-material-specific-summary">{effect.effect_summary || "Adds a recipe-appropriate crafted property."}</div>
      {!compact && effect.risk_summary ? <div className="craft-physical-risk-note"><strong>Handling:</strong> {effect.risk_summary}</div> : null}
    </div>
  );
}'''
replace_between('function PhysicalMaterialEffectCard(', 'function RecipePreview(', physical_card, 'physical material card')

# -----------------------------------------------------------------------------
# Component state: hydrate completed work, enrich plan, apply corrected DC and
# product preview, and prevent editing locked historical/future slots.
# -----------------------------------------------------------------------------
insert_before_empty = '''  useEffect(() => {
    if (recipe?.discipline !== "Smithing" || recipe?.kind !== "temper") return;
    if (!baseItemId) {
      setSelectedMaterials({});
      return;
    }
    const raw = inventoryItems.find((item) => String(item?.id) === String(baseItemId));
    if (!raw) return;
    const hydrated = existingSmithingSelectionMap(normalizeBenchInventoryItem(raw));
    setSelectedMaterials((current) => JSON.stringify(current) === JSON.stringify(hydrated) ? current : hydrated);
    setOpenSlotKey("");
  }, [baseItemId, recipe?.id, inventoryItems]);

'''
replace_once('  if (!recipe) {\n    return <div className="craft-preview-card craft-preview-empty">Select a recipe to preview.</div>;\n  }', insert_before_empty + '  if (!recipe) {\n    return <div className="craft-preview-card craft-preview-empty">Select a recipe to preview.</div>;\n  }', 'smithing history hydration effect')
replace_once(
    '  const plan = buildCraftBenchPlan(recipe, planningResources, baseItem);',
    '  const rawPlan = buildCraftBenchPlan(recipe, planningResources, baseItem);\n  const plan = recipe.discipline === "Smithing" && baseItem ? hydrateSmithingPlanWithExisting(rawPlan, baseItem) : rawPlan;',
    'hydrated smithing plan',
)
replace_once(
    '  const attemptPreview = calculateCraftAttemptPreview(recipe, plan, selectedMaterials, recipeRules, materialEffects, baseItem);\n  const selectedMaterialObjectsForPreview = selectedMaterialObjects(selectedMaterials, plan);',
    '  const selectedMaterialObjectsForPreview = selectedMaterialObjects(selectedMaterials, plan);\n  const rawAttemptPreview = calculateCraftAttemptPreview(recipe, plan, selectedMaterials, recipeRules, materialEffects, baseItem);\n  const attemptPreview = applySmithingAttemptPreview(recipe, rawAttemptPreview, selectedMaterialObjectsForPreview);\n  const smithingPreview = smithingProductPreview(recipe, baseItem, selectedMaterialObjectsForPreview);',
    'smithing preview calculation',
)
replace_once(
    '          <select className="form-select craft-input" value={baseItemId} onChange={(event) => { setBaseItemId(event.target.value); setSelectedMaterials({}); setOpenSlotKey(""); }}>',
    '          <select className="form-select craft-input" value={baseItemId} onChange={(event) => { setBaseItemId(event.target.value); setOpenSlotKey(""); }}>',
    'base item selection hydration',
)
replace_once(
    '        const open = openSlotKey === slotKey;',
    '        const slotLocked = Boolean(slot.locked);\n        const open = !slotLocked && openSlotKey === slotKey;',
    'locked slot state',
)
text = text.replace('onClick={() => setOpenSlotKey(open ? "" : slotKey)} title="Click to change this material"', 'onClick={() => { if (!slotLocked) setOpenSlotKey(open ? "" : slotKey); }} disabled={slotLocked} title={slotLocked ? "Completed or unavailable smithing stage" : "Click to change this material"}')
text = text.replace('discipline={recipe.discipline} baseItem={baseItem} slot={slot}', 'discipline={recipe.discipline} baseItem={baseItem} recipe={recipe} slot={slot}')
text = text.replace('<span className="craft-change-ingredient-hint">Click material card to change selection</span>', '<span className="craft-change-ingredient-hint">{slotLocked ? "Completed smithing work" : "Click material card to change selection"}</span>')
# The empty slot button is the only occurrence with this exact class block.
text = text.replace('className="craft-alchemy-path-row craft-family-slot-button compact"\n                onClick={() => setOpenSlotKey(open ? "" : slotKey)}', 'className={cls("craft-alchemy-path-row", "craft-family-slot-button", "compact", slotLocked && "locked")}\n                onClick={() => { if (!slotLocked) setOpenSlotKey(open ? "" : slotKey); }}\n                disabled={slotLocked}')
text = text.replace('<span className="craft-family-slot-action">Choose</span>', '<span className="craft-family-slot-action">{slotLocked ? (slot.future_slot ? "Later" : "Recorded") : "Choose"}</span>')

# Add Smithing result preview above the requirements grid.
preview_insert = r'''          {smithingPreview ? (
            <div className="craft-section craft-section-card craft-smithing-result-preview mt-3">
              <div className="craft-section-title">Smithing Result Preview</div>
              {smithingPreview.material ? <div className="craft-preview-chip-row"><span className="craft-chip craft-chip-gold">Material: {smithingPreview.material}</span></div> : null}
              {smithingPreview.kind === "offensive" ? (
                <>
                  <div className="craft-smithing-damage-line"><strong>Base weapon:</strong> {smithingPreview.baseDamage} {titleCase(smithingPreview.baseType)}{smithingPreview.convertedBaseType ? " (converted by material affinity and Initial Temper)" : ""}</div>
                  {(smithingPreview.riders || []).map((rider) => <div className="craft-temper-preview-row" key={rider.element}><strong>{titleCase(rider.element)} rider: {rider.dice}</strong><span>{rider.pct}% of base weapon damage after material affinity.</span></div>)}
                  {!smithingPreview.riders?.length ? <div className="craft-bullet muted">Choose an Initial Temper or later temper essence to add elemental damage.</div> : null}
                  {smithingPreview.affinitySaveDcBonus ? <div className="craft-bullet">• Matching non-damage effects gain +{smithingPreview.affinitySaveDcBonus} Save DC instead of the damage multiplier.</div> : null}
                </>
              ) : (
                <>
                  {(smithingPreview.absorption || []).map((entry) => <div className="craft-temper-preview-row" key={entry.element}><strong>{titleCase(entry.element)}: {entry.investment}% investment</strong><span>{entry.outcome}. Investment above 100% advances at half rate.</span></div>)}
                  {!smithingPreview.absorption?.length ? <div className="craft-bullet muted">Choose an elemental material or essence to build damage absorption.</div> : null}
                </>
              )}
            </div>
          ) : null}
'''
replace_once('          <div className="craft-preview-grid">\n            <div className="craft-section craft-section-card">\n              <div className="craft-section-title">Requirements</div>', preview_insert + '          <div className="craft-preview-grid">\n            <div className="craft-section craft-section-card">\n              <div className="craft-section-title">Requirements</div>', 'smithing result preview block')

# Initial stage label in the older stack preview.
text = text.replace('<strong>Temper +{temper.temper_stage}: {titleCase(temper.element)}</strong>', '<strong>{Number(temper.temper_stage) === 0 ? "Initial Temper" : `Temper +${temper.temper_stage}`}: {titleCase(temper.element)}</strong>')

# -----------------------------------------------------------------------------
# Styling for locked history and result preview.
# -----------------------------------------------------------------------------
css_marker = '        /* Enchanting categories, fantasy materials, elemental tempering, and rich forge previews */'
css_add = r'''
        .craft-family-slot-button.locked,.craft-selected-ingredient-button:disabled{cursor:default;opacity:.82}
        .craft-physical-effect-card.existing-work{border-style:dashed;background:linear-gradient(145deg,rgba(77,86,104,.20),rgba(16,20,30,.92))}
        .craft-smithing-result-preview{border-color:rgba(240,169,70,.48);background:linear-gradient(145deg,rgba(105,61,21,.18),rgba(23,19,31,.94))}
        .craft-smithing-damage-line{margin:9px 0;padding:10px;border:1px solid rgba(255,255,255,.10);border-radius:9px;background:rgba(13,17,26,.55);color:#f5edf8;line-height:1.45}
'''
if css_add.strip() not in text:
    replace_once(css_marker, css_marker + css_add, 'smithing v3 css')

# -----------------------------------------------------------------------------
# Verification.
# -----------------------------------------------------------------------------
required = [
    'const SMITHING_ESSENCE_TIERS',
    'name: "Initial Temper"',
    'function materialCompatibleWithSmithingTarget',
    'function smithingHistoryFromItem',
    'function smithingProductPreview',
    'function effectiveAbsorptionPercent',
    'Fire", "fire"',
    'Temper +${stage}',
    'Smithing Result Preview',
    'recipe={recipe} slot={slot}',
]
for token in required:
    if token not in text:
        raise RuntimeError(f"verification token missing: {token}")

path.write_text(text)
print("smithing temper v3 patch applied", len(text), text.count("\\n") + 1)

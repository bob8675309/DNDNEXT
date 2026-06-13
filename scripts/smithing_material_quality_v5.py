from pathlib import Path

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


catalog = r'''const SMITHING_MATERIAL_QUALITY_TIERS = [
  { key: "normal", label: "Normal", bonusPct: 25 },
  { key: "hq", label: "HQ", bonusPct: 50 },
];
const BASE_SMITHING_MATERIAL_CATALOG = [
  {
    name: "Mithral Ingot", category: "Ore / Metal", rarity: "Rare", dc: 2, materialClass: "Legendary Metal", qualityModel: "mithral",
    flavor: "A moon-bright ingot that feels almost weightless, yet rings like tempered steel when struck.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"],
    risk: "Requires exact heat control; overheating ruins its flexibility."
  },
  {
    name: "Adamantine Bar", category: "Ore / Metal", rarity: "Very Rare", dc: 3, materialClass: "Legendary Metal", qualityModel: "adamantine",
    flavor: "A dense charcoal-black bar whose surface resists scratches, sparks, and even the bite of lesser tools.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"],
    risk: "Extremely difficult to shape; failed work can damage tools or waste the stock."
  },
  {
    name: "Orichalcum Ingot", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Legendary Metal", qualityModel: "adaptive",
    flavor: "Gold-red metal threaded with quiet light; nearby runes brighten when it is brought close.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"],
    risk: "Stored magic can discharge if the alloy is worked unevenly."
  },
  {
    name: "Cold Iron Ingot", category: "Ore / Metal", rarity: "Rare", dc: 3, materialClass: "Legendary Metal", qualityModel: "elemental",
    flavor: "Dull gray iron worked without ordinary flame; it leaves a winter-cold ache in bare hands.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["cold", "force"],
    risk: "Never expose it to ordinary forge heat; it must be pressure-worked and rune-cooled."
  },
  {
    name: "Ironwood Heartwood", category: "Material", rarity: "Rare", dc: 2, materialClass: "Organic & Botanical", qualityModel: "ironwood",
    flavor: "Dark living heartwood with a grain like folded iron; fresh cuts bead with amber-green sap.",
    allowedItemKinds: ["weapon", "armor", "shield"], allowedWeaponFamilies: ["ranged", "hafted", "blunt"],
    risk: "Must be cured slowly; hurried drying causes hidden internal splits."
  },
  {
    name: "Deep Coral Plate", category: "Monster Part", rarity: "Rare", dc: 3, materialClass: "Organic & Botanical", qualityModel: "elemental",
    flavor: "Blue-black coral grown under crushing depths, still cool and faintly damp far from the sea.",
    allowedItemKinds: ["armor", "shield"], affinityTags: ["cold", "poison"],
    risk: "Dries and fractures unless kept mineral-treated throughout shaping."
  },
  {
    name: "Umbral Chitin", category: "Monster Part", rarity: "Uncommon", dc: 2, materialClass: "Organic & Botanical", qualityModel: "elemental",
    flavor: "Layered midnight chitin that drinks in torchlight and clicks softly when its plates flex.",
    allowedItemKinds: ["ammunition", "armor", "shield"], affinityTags: ["necrotic", "thunder"],
    risk: "Heat destroys its structure; it must be cut, laminated, and resin-bound."
  },
  {
    name: "Obsidian Edgeglass", category: "Material", rarity: "Uncommon", dc: 2, materialClass: "Crystal & Mineral", qualityModel: "elemental",
    flavor: "Smoky volcanic glass with an impossibly thin edge that catches light in blood-red lines.",
    allowedItemKinds: ["weapon", "ammunition"], allowedWeaponFamilies: ["blade", "piercing", "ammunition"], affinityTags: ["fire", "acid"],
    risk: "Exceptionally sharp and brittle; failed shaping can shatter the full piece."
  },
  {
    name: "Blood Glass", category: "Material", rarity: "Rare", dc: 4, materialClass: "Crystal & Mineral", qualityModel: "elemental",
    flavor: "Deep crimson glass with slow-moving shadows suspended beneath its polished surface.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["poison", "psychic"],
    risk: "Responds to blood and hostile magic; careless work can awaken a lingering curse."
  },
  {
    name: "Star Metal", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Crystal & Mineral", qualityModel: "elemental",
    flavor: "Silver-black meteoric metal dusted with pinpricks of light that drift like a distant night sky.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["force", "lightning"],
    risk: "Its internal charge shifts with celestial cycles and can arc during forging."
  },
  {
    name: "Stygian Iron", category: "Ore / Metal", rarity: "Very Rare", dc: 5, materialClass: "Esoteric & Magical", qualityModel: "elemental",
    flavor: "Pitch-dark iron veined with ember-red and grave-violet light; its warmth fades when no one is watching.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["fire", "necrotic"],
    risk: "Carries corruptive resonance and should always receive a visible warning on the finished item."
  },
  {
    name: "Moonsilver", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Esoteric & Magical", qualityModel: "elemental",
    flavor: "Pale silver that waxes from translucent to mirror-bright as moonlight crosses its surface.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["radiant", "cold"],
    risk: "Waxes and wanes with lunar phases; unstable work can partially phase out of its fittings."
  },
  {
    name: "Riverine", category: "Material", rarity: "Legendary", dc: 6, materialClass: "Esoteric & Magical", qualityModel: "elemental",
    flavor: "A ribbon of living water held inside a flawless transparent force lattice, flowing without spilling.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["force", "thunder"],
    risk: "A damaged containment lattice releases the bound water and collapses the crafted section."
  },
];
const COMMON_SMITHING_MATERIAL_CATALOG = [
  {
    name: "Iron Ore", category: "Ore / Metal", rarity: "Mundane", dc: 1, materialClass: "Base Metal", qualityModel: "elemental",
    flavor: "Rust-red ore shot through with dark metallic veins and coarse stone.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["acid", "thunder"],
    risk: "Impurities must be driven out before the ore can hold an elemental temper."
  },
  {
    name: "Steel Ingot", category: "Ore / Metal", rarity: "Mundane", dc: 1, materialClass: "Base Metal", qualityModel: "elemental",
    flavor: "A clean gray ingot with blue temper lines and a clear bell-like ring.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["fire", "lightning"],
    risk: "Uneven carbon and heat leave weak seams that split under magical stress."
  },
  {
    name: "Silver Ingot", category: "Ore / Metal", rarity: "Uncommon", dc: 1, materialClass: "Special Metal", qualityModel: "elemental",
    flavor: "A bright white ingot that stays cool beside the forge and tarnishes only at the edges.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["radiant", "psychic"],
    risk: "Silver softens quickly and must be alloyed without muddying its magical resonance."
  },
  {
    name: "Ruidium Shard", category: "Material", rarity: "Very Rare", dc: 4, materialClass: "Crystal & Mineral", qualityModel: "elemental",
    flavor: "A translucent crimson crystal-metal shard that pulses with unsettling psychic heat.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["psychic", "necrotic"],
    risk: "Its corruptive pulse can imprint on tools, stock, and careless smiths."
  },
  {
    name: "Generic Monster Part", category: "Monster Part", rarity: "Common", dc: 1, materialClass: "Monster Material", qualityModel: "elemental",
    flavor: "A sorted bundle of horn, bone, tooth, and hide harvested from common beasts.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["acid", "poison"],
    risk: "Mixed tissues cure at different rates and can separate if prepared carelessly."
  },
  {
    name: "Dire Beast Hide", category: "Monster Part", rarity: "Uncommon", dc: 2, materialClass: "Monster Hide", qualityModel: "elemental",
    flavor: "Thick scarred hide with coarse fur still caught along its armored grain.",
    allowedItemKinds: ["armor", "shield"], affinityTags: ["lightning", "poison"],
    risk: "The hide must be stretched along its natural grain or it twists as it dries."
  },
  {
    name: "Troll Heart", category: "Monster Part", rarity: "Rare", dc: 3, materialClass: "Monster Organ", qualityModel: "elemental",
    flavor: "A preserved green-black heart whose torn fibers slowly pull themselves together.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["fire", "poison"],
    risk: "Regenerating tissue can overgrow bindings and must be cauterized during every stage."
  },
  {
    name: "Cursed Bone", category: "Monster Part", rarity: "Uncommon", dc: 2, materialClass: "Monster Bone", qualityModel: "elemental",
    flavor: "Ash-gray bone marked by hairline black runes that seem deeper whenever no one is looking.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["acid", "necrotic"],
    risk: "The curse can migrate into tools or unfinished gear if its runes are broken."
  },
  {
    name: "Giant Bone", category: "Monster Part", rarity: "Uncommon", dc: 2, materialClass: "Monster Bone", qualityModel: "elemental",
    flavor: "A massive ivory section with dense growth rings and the weight of quarried stone.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["cold", "thunder"],
    risk: "Hidden stress fractures spread rapidly unless the bone is cut along its growth rings."
  },
  {
    name: "Refined Mana Crystal", category: "Catalyst", rarity: "Rare", dc: 2, materialClass: "Arcane Catalyst", qualityModel: "universal",
    flavor: "A clear blue crystal cut to hold a steady reservoir of arcane charge.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"],
    risk: "A fractured crystal releases its stored charge through the unfinished item."
  },
];
const DRAGON_SMITHING_MATERIAL_CATALOG = DRAGON_SMITHING_ELEMENTS.flatMap(([dragon, element]) => [
  {
    name: `${dragon} Dragonhide`, category: "Monster Part", rarity: "Very Rare", dc: 4, materialClass: "Dragonhide", qualityModel: "dragon",
    flavor: `Supple ${dragon.toLowerCase()} dragonhide with ${titleCase(element)} energy moving beneath the scales like a slow pulse.`,
    allowedItemKinds: ["armor", "shield"], affinityTags: [element], element,
    risk: "Mismatched elemental work can make the hide brittle or violently reactive."
  },
  {
    name: `${dragon} Dragon Scale`, category: "Monster Part", rarity: "Very Rare", dc: 5, materialClass: "Dragon Scale", qualityModel: "dragon-scale",
    flavor: `A rigid ${dragon.toLowerCase()} dragon scale whose polished ridges shimmer with contained ${titleCase(element)} power.`,
    allowedItemKinds: ["armor", "shield"], affinityTags: [element], element,
    risk: "Scales must be aligned to their natural grain or they shear under impact."
  },
]);
const SMITHING_MATERIAL_CATALOG = [...BASE_SMITHING_MATERIAL_CATALOG, ...COMMON_SMITHING_MATERIAL_CATALOG, ...DRAGON_SMITHING_MATERIAL_CATALOG];'''
replace_between(
    'const BASE_SMITHING_MATERIAL_CATALOG = [',
    'const ALCHEMY_GROUPS_BY_SECTION = {',
    catalog,
    'quality smithing material catalog',
)

replace_once(
    '''function materialQualityLabel(material) {
  const r = rarity(material?.rarity || "");
  if (r && r !== "Mundane") return r;
  const q = String(material?.quality || material?.raw?.quality || material?.raw?.card_payload?.quality || "").trim();
  return q ? titleCase(q) : "Standard";
}''',
    '''function materialQualityLabel(material) {
  const profile = smithingProfile(material);
  if (String(profile.kind || "").toLowerCase() === "material") return smithingMaterialQuality(material);
  const r = rarity(material?.rarity || "");
  if (r && r !== "Mundane") return r;
  const q = String(material?.quality || material?.raw?.quality || material?.raw?.card_payload?.quality || "").trim();
  return q ? titleCase(q) : "Standard";
}''',
    'material quality label',
)

smithing_helpers = r'''function smithingProfile(material = {}) {
  const payload = material?.raw?.payload && typeof material.raw.payload === "object" ? material.raw.payload : {};
  const cardPayload = material?.raw?.card_payload && typeof material.raw.card_payload === "object" ? material.raw.card_payload : {};
  return material.smithing || payload.smithing || cardPayload.smithing || {};
}
function normalizeSmithingMaterialQuality(value = "") {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (/(^|\b)(hq|high[- ]quality|masterwork)(\b|$)/.test(text)) return "HQ";
  if (/(^|\b)(normal|standard)(\b|$)/.test(text)) return "Normal";
  return "";
}
function smithingMaterialQuality(material = {}) {
  const profile = smithingProfile(material);
  const payload = material?.raw?.payload && typeof material.raw.payload === "object" ? material.raw.payload : {};
  const cardPayload = material?.raw?.card_payload && typeof material.raw.card_payload === "object" ? material.raw.card_payload : {};
  return normalizeSmithingMaterialQuality(
    material.quality || profile.quality || payload.quality || cardPayload.quality || material.raw?.quality
  ) || normalizeSmithingMaterialQuality(material.name || material.item_name || material.raw?.item_name) || "Normal";
}
function smithingMaterialQualityKey(material = {}) {
  return smithingMaterialQuality(material) === "HQ" ? "hq" : "normal";
}
function smithingMaterialQualityRank(material = {}) {
  return smithingMaterialQualityKey(material) === "hq" ? 1 : 0;
}
function smithingMaterialBaseName(material = {}) {
  const rawName = String(material?.base_name || material?.baseName || material?.smithing?.baseName || material?.name || material?.item_name || material?.raw?.item_name || "Material").trim();
  return rawName
    .replace(/^(?:hq|high[- ]quality|masterwork|normal|standard)\s+/i, "")
    .replace(/\s*(?:\(|\[|—|-)?\s*(?:hq|high[- ]quality|masterwork|normal|standard)\s*(?:\)|\])?$/i, "")
    .trim() || rawName;
}
function isSmithingMaterialResource(material = {}) {
  const profile = smithingProfile(material);
  if (String(profile.kind || "").toLowerCase() === "material") return true;
  const category = String(material.category || material.raw?.category || material.raw?.card_payload?.crafting_category || "").toLowerCase();
  const name = String(material.name || material.raw?.item_name || "").toLowerCase();
  return /(ore|metal|material|monster|catalyst)/.test(category) && /(ore|ingot|bar|metal|wood|coral|chitin|glass|hide|bone|heart|crystal|riverine)/.test(name);
}
function craftingResourceMergeKey(material = {}) {
  if (isSmithingMaterialResource(material)) {
    return `smithing::${resourceKeyFor({ name: smithingMaterialBaseName(material) })}::${smithingMaterialQualityKey(material)}`;
  }
  return `${inferReagentFamily(material) || material.category || "material"}::${resourceKeyFor(material)}`;
}
'''
replace_between(
    'function smithingProfile(material = {}) {',
    'function craftingMaterialTags(material = {}) {',
    smithing_helpers,
    'smithing quality helpers',
)

replace_once(
    '    quality: payload.quality || row.quality || null,',
    '    quality: smithingMaterialQuality({ name: row.item_name || payload.name || payload.item_name, quality: payload.quality || row.quality, smithing, raw: row }),',
    'inventory smithing quality',
)

replace_once(
    '''      rarity: selected?.rarity || null,
      source: selected?.source || null,''',
    '''      rarity: selected?.rarity || null,
      quality: selected ? smithingMaterialQuality(selected) : null,
      base_name: selected ? smithingMaterialBaseName(selected) : null,
      source: selected?.source || null,''',
    'selected material quality payload',
)

quality_builder = r'''function smithingQualityVariant(entry = {}, tier = SMITHING_MATERIAL_QUALITY_TIERS[0]) {
  const bonusPct = Number(tier.bonusPct || 25);
  const quality = tier.label || "Normal";
  const qualityKey = tier.key || "normal";
  const affinityTags = Array.isArray(entry.affinityTags) ? entry.affinityTags.map(smithingElementTagKey).filter(Boolean) : [];
  const elementLabel = affinityTags.map((tagValue) => smithingElementTagLabel(tagValue)).join(" and ");
  const profile = {
    ...entry,
    kind: "material",
    profileVersion: 5,
    baseName: entry.name,
    quality,
    qualityKey,
    qualityBonusPct: bonusPct,
    affinityTags,
    displayAffinityTags: affinityTags,
    dcModifier: Number(entry.dc || entry.dcModifier || 0),
  };

  if (entry.qualityModel === "elemental") {
    Object.assign(profile, {
      matchingEffectMultiplier: 1 + bonusPct / 100,
      saveDcPerEffectPct: 100,
      convertsBaseDamage: true,
      baseDamageConversion: "matching",
      offensive: `${elementLabel} damage effects are increased by ${bonusPct}%.`,
      defensive: `Provides ${bonusPct}% ${smithingElementTagLabel(affinityTags[0])} and ${bonusPct}% ${smithingElementTagLabel(affinityTags[1])} absorption investment.`,
      armorAbsorption: Object.fromEntries(affinityTags.map((tagValue) => [tagValue, bonusPct])),
    });
  } else if (entry.qualityModel === "dragon" || entry.qualityModel === "dragon-scale") {
    const element = affinityTags[0] || smithingElementTagKey(entry.element);
    Object.assign(profile, {
      affinityTags: [element],
      displayAffinityTags: [element],
      offensive: "Not suitable as a weapon's primary material.",
      defensive: `Provides ${bonusPct}% ${smithingElementTagLabel(element)} absorption investment${entry.qualityModel === "dragon-scale" ? " and +1 AC for a complete suit or shield face" : ""}.`,
      armorAbsorption: { [element]: bonusPct },
      armorMechanics: entry.qualityModel === "dragon-scale" ? { acBonus: 1 } : {},
      convertsBaseDamage: false,
      baseDamageConversion: "none",
    });
  } else if (entry.qualityModel === "adamantine") {
    const dieSteps = qualityKey === "hq" ? 2 : 1;
    Object.assign(profile, {
      affinityTags: [], displayAffinityTags: [], specialTag: "Die Step",
      offensive: `Increase the weapon's base damage die by ${dieSteps === 1 ? "one step" : "two steps"}.`,
      defensive: qualityKey === "hq" ? "Critical hits against the bearer become normal hits." : "Critical hits against the bearer deal one fewer weapon damage die.",
      weaponMechanics: { dieSteps },
      armorMechanics: qualityKey === "hq" ? { criticalHitImmunity: true } : { criticalDamageDieReduction: 1 },
      convertsBaseDamage: false, baseDamageConversion: "none",
    });
  } else if (entry.qualityModel === "mithral") {
    const weightMultiplier = qualityKey === "hq" ? 0.5 : 0.75;
    Object.assign(profile, {
      affinityTags: [], displayAffinityTags: [], specialTag: "Lightweight",
      offensive: qualityKey === "hq" ? "Halve the weapon's weight. Heavy weapons lose the Heavy property." : "Reduce the weapon's weight by 25%.",
      defensive: qualityKey === "hq" ? "Halve the item's weight and remove its Strength requirement and Stealth disadvantage." : "Reduce the item's weight by 25% and remove its Strength requirement.",
      weaponMechanics: qualityKey === "hq" ? { weightMultiplier, removeProperties: ["Heavy"] } : { weightMultiplier },
      armorMechanics: qualityKey === "hq" ? { weightMultiplier, removeStrengthRequirement: true, removeStealthDisadvantage: true } : { weightMultiplier, removeStrengthRequirement: true },
      convertsBaseDamage: false, baseDamageConversion: "none",
    });
  } else if (entry.qualityModel === "ironwood") {
    const weightMultiplier = qualityKey === "hq" ? 0.5 : 0.75;
    Object.assign(profile, {
      affinityTags: [], displayAffinityTags: [], specialTag: "Living Material",
      offensive: qualityKey === "hq" ? "The weapon is nonmetal, weighs 50% less, cannot rust, and can serve as a druidic spellcasting focus." : "The weapon is nonmetal, weighs 25% less, and can serve as a druidic spellcasting focus.",
      defensive: qualityKey === "hq" ? "The item is nonmetal, weighs 50% less, and cannot rust or corrode." : "The item is nonmetal and weighs 25% less without reducing Armor Class.",
      weaponMechanics: { nonmetal: true, druidicFocus: true, weightMultiplier, immuneToRust: qualityKey === "hq" },
      armorMechanics: { nonmetal: true, weightMultiplier, immuneToRust: qualityKey === "hq" },
      convertsBaseDamage: false, baseDamageConversion: "none",
    });
  } else if (entry.qualityModel === "adaptive") {
    Object.assign(profile, {
      affinityTags: [...TEMPER_DAMAGE_TYPES], displayAffinityTags: [], specialTag: "Adaptive",
      matchingEffectMultiplier: 1 + bonusPct / 100,
      saveDcPerEffectPct: 100,
      convertsBaseDamage: true,
      baseDamageConversion: "adaptive",
      offensive: `The Initial Temper sets this material's affinity. Matching elemental effects are increased by ${bonusPct}%.`,
      defensive: `The first elemental temper sets this material's affinity. Matching absorption contributions are increased by ${bonusPct}%.`,
    });
  } else if (entry.qualityModel === "universal") {
    Object.assign(profile, {
      affinityTags: [...TEMPER_DAMAGE_TYPES], displayAffinityTags: [], specialTag: "Universal",
      matchingEffectMultiplier: 1 + bonusPct / 100,
      saveDcPerEffectPct: 100,
      convertsBaseDamage: false,
      baseDamageConversion: "none",
      offensive: `All elemental Essence effects are increased by ${bonusPct}%. The weapon keeps its original base damage type.`,
      defensive: `All elemental Essence absorption contributions are increased by ${bonusPct}%.`,
    });
  }

  return profile;
}
function buildSmithingMaterialCatalog(isAdmin = false) {
  return SMITHING_MATERIAL_CATALOG.flatMap((entry) => SMITHING_MATERIAL_QUALITY_TIERS.map((tier) => {
    const smithing = smithingQualityVariant(entry, tier);
    const qualityKey = smithing.qualityKey;
    const name = qualityKey === "hq" ? `HQ ${entry.name}` : entry.name;
    const flavor = qualityKey === "hq"
      ? `${entry.flavor} This high-quality piece is unusually pure and responsive to careful work.`
      : entry.flavor;
    return {
      id: `catalog-smithing:${resourceKeyFor(entry)}:${qualityKey}`,
      name,
      base_name: entry.name,
      category: entry.category,
      categoryTone: materialCategoryTone(entry.category),
      type: entry.materialClass,
      rarity: entry.rarity,
      quality: smithing.quality,
      quantity: isAdmin ? 999 : 0,
      owned_quantity: 0,
      source: isAdmin ? "Admin smithing catalog stock" : "Smithing material catalog",
      notes: flavor,
      tags: ["smithing", "material", qualityKey, String(entry.materialClass || "").toLowerCase(), String(entry.rarity || "").toLowerCase(), ...(smithing.affinityTags || [])],
      smithing: { ...smithing, flavor },
      is_available: Boolean(isAdmin),
      is_catalog_only: true,
      is_admin_virtual: Boolean(isAdmin),
    };
  }));
}'''
replace_between(
    'function buildSmithingMaterialCatalog(isAdmin = false) {',
    'function resourceKeyFor(material) {',
    quality_builder,
    'smithing quality catalog builder',
)

replace_once(
    '''      rarity: rarity(row.item_rarity || payload.item_rarity || payload.rarity || "Common") || "Common",
      quantity: isAdmin ? 999 : 0,''',
    '''      rarity: rarity(row.item_rarity || payload.item_rarity || payload.rarity || "Common") || "Common",
      quality: smithingMaterialQuality({ name: row.item_name || payload.item_name || payload.name, quality: payload.quality || smithing.quality, smithing, raw: { ...row, payload } }),
      base_name: smithing.baseName || payload.base_name || smithingMaterialBaseName({ name: row.item_name || payload.item_name || payload.name }),
      quantity: isAdmin ? 999 : 0,''',
    'catalog smithing quality fields',
)

admin_rows_old = r'''    ["Iron Ore", "Ore / Metal", "Mundane", "Rust-red ore shot through with dark metallic veins and coarse stone."],
    ["Steel Ingot", "Ore / Metal", "Mundane", "A clean gray ingot with blue temper lines and a clear bell-like ring."],
    ["Silver Ingot", "Ore / Metal", "Uncommon", "A bright white ingot that stays cool beside the forge and tarnishes only at the edges."],
    ["Mithral Ingot", "Ore / Metal", "Rare", "A moon-bright ingot that feels almost weightless, yet rings like tempered steel."],
    ["Adamantine Bar", "Ore / Metal", "Very Rare", "A dense charcoal-black bar that shrugs off scratches, sparks, and lesser tools."],
    ["Ruidium Shard", "Ore / Metal", "Very Rare", "A translucent crimson crystal-metal shard that pulses with unsettling psychic heat."],
    ["Generic Monster Part", "Monster Part", "Common", "A sorted bundle of horn, bone, tooth, and hide harvested from common beasts."],
    ["Dire Beast Hide", "Monster Part", "Uncommon", "Thick scarred hide with coarse fur still caught along its armored grain."],
    ["Troll Heart", "Monster Part", "Rare", "A preserved green-black heart whose torn fibers slowly pull themselves together."],
    ["Arcane Catalyst", "Catalyst", "Common", "A thumb-sized ceramic focus etched with simple stabilizing runes."],
    ["Sigil Dust", "Catalyst", "Uncommon", "Fine silver-violet powder that settles into rune-shaped lines when scattered."],
    ["Refined Mana Crystal", "Catalyst", "Rare", "A clear blue crystal cut to hold a steady reservoir of arcane charge."],'''
admin_rows_new = r'''    ["Arcane Catalyst", "Catalyst", "Common", "A thumb-sized ceramic focus etched with simple stabilizing runes."],
    ["Sigil Dust", "Catalyst", "Uncommon", "Fine silver-violet powder that settles into rune-shaped lines when scattered."],'''
replace_once(admin_rows_old, admin_rows_new, 'remove physical materials from generic admin fallbacks')

replace_once(
    '    const key = `${inferReagentFamily(material) || material.category || "material"}::${resourceKeyFor(material)}`;',
    '    const key = craftingResourceMergeKey(material);',
    'quality-aware resource merge key',
)

replace_once(
    '''    const canonical = existing.is_catalog_only && (existing.alchemy || existing.smithing)
      ? existing
      : material.is_catalog_only && (material.alchemy || material.smithing)
        ? material
        : null;''',
    '''    const existingCanonical = existing.is_catalog_only && (existing.alchemy || existing.smithing) ? existing : null;
    const incomingCanonical = material.is_catalog_only && (material.alchemy || material.smithing) ? material : null;
    const existingVersion = Number(smithingProfile(existingCanonical || {})?.profileVersion || 0);
    const incomingVersion = Number(smithingProfile(incomingCanonical || {})?.profileVersion || 0);
    const canonical = incomingCanonical && (!existingCanonical || incomingVersion > existingVersion)
      ? incomingCanonical
      : existingCanonical || incomingCanonical || null;''',
    'prefer latest smithing catalog profile',
)

replace_once(
    '''      rarity: canonical?.rarity || material.rarity || existing.rarity,
      reagent_family: canonical?.reagent_family || material.reagent_family || existing.reagent_family,''',
    '''      rarity: canonical?.rarity || material.rarity || existing.rarity,
      quality: canonical?.quality || material.quality || existing.quality || (isSmithingMaterialResource(material) || isSmithingMaterialResource(existing) ? smithingMaterialQuality(canonical || material || existing) : null),
      base_name: canonical?.base_name || material.base_name || existing.base_name || (isSmithingMaterialResource(material) || isSmithingMaterialResource(existing) ? smithingMaterialBaseName(canonical || material || existing) : null),
      reagent_family: canonical?.reagent_family || material.reagent_family || existing.reagent_family,''',
    'merge material quality fields',
)

replace_once(
    '''    affinity_tags: Array.isArray(profile.affinityTags) ? profile.affinityTags : [],
    risk_summary: profile.risk,''',
    '''    affinity_tags: Array.isArray(profile.displayAffinityTags) ? profile.displayAffinityTags : Array.isArray(profile.affinityTags) ? profile.affinityTags : [],
    special_tag: profile.specialTag || null,
    quality: profile.quality || smithingMaterialQuality(material),
    risk_summary: profile.risk,''',
    'smithing effect display tags and quality',
)

preview = r'''function smithingProductPreview(recipe = {}, baseItem = null, selectedMaterials = []) {
  if (recipe?.discipline !== "Smithing") return null;
  const { itemKind } = smithingTargetContext(recipe, baseItem);
  const physical = selectedMaterials.find((entry) => entry?.slot_type === "physical" || entry?.slot_key === "craft-material") || null;
  const profile = physical ? smithingProfile(physical) : {};
  const tempers = selectedMaterials.filter((entry) => entry?.temper_elemental || entry?.slot_type === "temper");
  const affinity = smithingElementAffinityTags(profile);
  const affinityMultiplier = Math.max(1, Number(profile.matchingEffectMultiplier || 1));
  const conversionMode = String(profile.baseDamageConversion || (profile.convertsBaseDamage === false ? "none" : "matching")).toLowerCase();
  if (["armor", "shield"].includes(itemKind)) {
    const investment = { ...(profile.armorAbsorption || {}) };
    tempers.forEach((entry) => {
      const element = smithingElementTagKey(entry.temper_element || elementalDamageTypeForMaterial(entry));
      let pct = Number(entry.bonus_damage_pct || essenceProfileForMaterial(entry)?.damagePct || 0);
      if (element && affinity.includes(element)) pct *= affinityMultiplier;
      if (element && pct) investment[element] = Number(investment[element] || 0) + pct;
    });
    return {
      kind: "defensive",
      material: physical ? smithingMaterialBaseName(physical) : null,
      materialQuality: physical ? smithingMaterialQuality(physical) : null,
      absorption: Object.entries(investment).map(([element, value]) => ({ element, investment: Number(value), effective: effectiveAbsorptionPercent(value), outcome: absorptionOutcomeLabel(value) })),
    };
  }
  const rawBaseDice = weaponBaseDamageProfile(recipe, baseItem);
  const baseDice = applySmithingWeaponDieSteps(rawBaseDice, profile);
  const initial = tempers.find((entry) => Number(entry.temper_stage ?? -1) === 0) || null;
  const initialElement = smithingElementTagKey(initial?.temper_element || elementalDamageTypeForMaterial(initial || {}));
  const convertsBase = Boolean(conversionMode !== "none" && initialElement && affinity.includes(initialElement));
  const baseType = convertsBase ? initialElement : weaponBaseDamageType(recipe, baseItem);
  const riders = {};
  let matchingEffectPct = 0;
  tempers.forEach((entry) => {
    const element = smithingElementTagKey(entry.temper_element || elementalDamageTypeForMaterial(entry));
    let pct = Number(entry.bonus_damage_pct || essenceProfileForMaterial(entry)?.damagePct || 0);
    if (!element || !pct) return;
    if (affinity.includes(element)) {
      pct *= affinityMultiplier;
      matchingEffectPct += pct;
    }
    riders[element] = Number(riders[element] || 0) + pct;
  });
  const saveDcPerEffectPct = Math.max(1, Number(profile.saveDcPerEffectPct || 100));
  const affinitySaveDcBonus = Math.floor(matchingEffectPct / saveDcPerEffectPct);
  return {
    kind: "offensive",
    material: physical ? smithingMaterialBaseName(physical) : null,
    materialQuality: physical ? smithingMaterialQuality(physical) : null,
    baseDamage: baseDice ? `${baseDice.count}d${baseDice.size}` : recipe?.item_preview?.damage || baseItem?.payload?.damageText || "Base weapon damage",
    baseType,
    convertedBaseType: convertsBase,
    riders: Object.entries(riders).map(([element, pct]) => ({ element, pct, dice: formatScaledWeaponDamage(baseDice, pct) })),
    affinityEffectPct: matchingEffectPct,
    affinitySaveDcBonus,
    saveDcPerEffectPct,
    materialDieSteps: Number(profile?.weaponMechanics?.dieSteps || 0),
  };
}'''
replace_between(
    'function smithingProductPreview(recipe = {}, baseItem = null, selectedMaterials = []) {',
    'function applySmithingAttemptPreview(',
    preview,
    'quality-aware smithing product preview',
)

replace_once(
    '''      .sort((a, b) => {
        const scoreDelta = materialAlchemyScore(b, recipe, slot) - materialAlchemyScore(a, recipe, slot);
        if (scoreDelta) return scoreDelta;
        return (rarityRank(b.rarity) - rarityRank(a.rarity)) || String(a.name).localeCompare(String(b.name));
      });''',
    '''      .sort((a, b) => {
        if (slot.physical_material) {
          const availableDelta = Number(Boolean(b.is_available)) - Number(Boolean(a.is_available));
          if (availableDelta) return availableDelta;
          const baseNameDelta = smithingMaterialBaseName(a).localeCompare(smithingMaterialBaseName(b));
          if (baseNameDelta) return baseNameDelta;
          return smithingMaterialQualityRank(a) - smithingMaterialQualityRank(b);
        }
        const scoreDelta = materialAlchemyScore(b, recipe, slot) - materialAlchemyScore(a, recipe, slot);
        if (scoreDelta) return scoreDelta;
        return (rarityRank(b.rarity) - rarityRank(a.rarity)) || String(a.name).localeCompare(String(b.name));
      });''',
    'group normal and HQ physical materials',
)

replace_once(
    '  const affinityTags = Array.from(new Set([...(effect.affinity_tags || []), effect.element].filter(Boolean).map(smithingElementTagKey)));',
    '  const affinityTags = Array.from(new Set([...(effect.affinity_tags || []), effect.element].filter(Boolean).map(smithingElementTagKey)));\n  const materialQuality = !slot?.temper_elemental && String(profile.kind || "").toLowerCase() === "material" ? smithingMaterialQuality(material) : "";',
    'material card quality state',
)

replace_once(
    '''          <strong>{material.name}</strong>
          <span className="craft-ingredient-family-pill craft-ingredient-family-pill-under-name">{slot?.temper_elemental ? (effect.essence_label || "Essence") : profile.materialClass || material.category || material.type || "Material"}</span>
          {affinityTags.length ? <span className="craft-ingredient-theme-tags craft-element-tags">{affinityTags.map((tagValue) => <span key={tagValue} className={cls("craft-ingredient-theme-pill", "craft-element-tag", `element-${smithingElementTagKey(tagValue)}`)}>{smithingElementTagLabel(tagValue)}</span>)}</span> : null}''',
    '''          <strong>{slot?.temper_elemental ? material.name : smithingMaterialBaseName(material)}</strong>
          <span className="craft-ingredient-family-pill craft-ingredient-family-pill-under-name">{slot?.temper_elemental ? (effect.essence_label || "Essence") : profile.materialClass || material.category || material.type || "Material"}</span>
          {effect.special_tag ? <span className="craft-ingredient-theme-tags craft-special-material-tags"><span className="craft-ingredient-theme-pill craft-special-material-tag">{effect.special_tag}</span></span> : null}
          {affinityTags.length ? <span className="craft-ingredient-theme-tags craft-element-tags">{affinityTags.map((tagValue) => <span key={tagValue} className={cls("craft-ingredient-theme-pill", "craft-element-tag", `element-${smithingElementTagKey(tagValue)}`)}>{smithingElementTagLabel(tagValue)}</span>)}</span> : null}''',
    'material card title and special tags',
)

replace_once(
    '''          <span className={cls("craft-ingredient-quality-pill", rarityClassName(itemRarity))}>{itemRarity}</span>
          {material.existing_work ? <span className="craft-ingredient-qty-pill">Completed</span> : quantityLabel ? <span className="craft-ingredient-qty-pill">{quantityLabel}</span> : null}''',
    '''          <span className={cls("craft-ingredient-quality-pill", rarityClassName(itemRarity))}>{itemRarity}</span>
          {materialQuality ? <span className={cls("craft-material-quality-pill", materialQuality === "HQ" ? "hq" : "normal")}>{materialQuality}</span> : null}
          {material.existing_work ? <span className="craft-ingredient-qty-pill">Completed</span> : quantityLabel ? <span className="craft-ingredient-qty-pill">{quantityLabel}</span> : null}''',
    'material quality badge',
)

replace_once(
    '{smithingPreview.material ? <div className="craft-preview-chip-row"><span className="craft-chip craft-chip-gold">Material: {smithingPreview.material}</span></div> : null}',
    '{smithingPreview.material ? <div className="craft-preview-chip-row"><span className="craft-chip craft-chip-gold">Material: {smithingPreview.material}</span>{smithingPreview.materialQuality ? <span className={cls("craft-chip", smithingPreview.materialQuality === "HQ" ? "craft-chip-green" : "")}>{smithingPreview.materialQuality}</span> : null}</div> : null}',
    'result preview material quality',
)

old_css = '        .craft-element-tags{gap:3px;margin-top:4px}\n        .craft-element-tag{min-height:15px;padding:1px 5px;font-size:7.5px;line-height:1.1;letter-spacing:.035em;box-shadow:inset 0 0 0 1px rgba(255,255,255,.035)}'
new_css = '''        .craft-physical-effect-card .craft-element-tags{display:flex!important;flex-direction:row!important;align-items:flex-start!important;justify-content:flex-start!important;gap:4px;margin-top:4px;width:fit-content!important;max-width:100%;}
        .craft-physical-effect-card .craft-element-tag{display:inline-flex!important;width:fit-content!important;min-width:0!important;max-width:max-content!important;min-height:15px;padding:1px 6px;font-size:7.5px;line-height:1.1;letter-spacing:.035em;flex:0 0 auto!important;align-self:flex-start!important;justify-content:center;white-space:nowrap;box-shadow:inset 0 0 0 1px rgba(255,255,255,.035)}
        .craft-special-material-tags{width:fit-content!important;max-width:100%;}
        .craft-special-material-tag{width:fit-content!important;min-width:0!important;min-height:16px;padding:1px 6px;font-size:8px;line-height:1.1;white-space:nowrap;}
        .craft-material-quality-pill{display:inline-flex;align-items:center;justify-content:center;min-height:20px;padding:2px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.16);font-size:9px;font-weight:950;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;}
        .craft-material-quality-pill.normal{background:rgba(120,138,164,.16);border-color:rgba(156,176,207,.28);color:#d7e4f8;}
        .craft-material-quality-pill.hq{background:rgba(59,211,154,.18);border-color:rgba(59,211,154,.44);color:#bfffe5;box-shadow:0 0 12px rgba(59,211,154,.12);}'''
replace_once(old_css, new_css, 'compact element tags and quality CSS')

required = [
    'name: "Iron Ore"',
    'affinityTags: ["acid", "thunder"]',
    'name: "Cold Iron Ingot"',
    'affinityTags: ["cold", "force"]',
    'qualityModel: "universal"',
    'function smithingQualityVariant',
    'craftingResourceMergeKey(material)',
    'craft-material-quality-pill',
    'baseDamageConversion: "none"',
    'profileVersion: 5',
]
for token in required:
    if token not in text:
        raise RuntimeError(f"verification token missing: {token}")

path.write_text(text)
print("smithing material quality v5 applied", len(text), text.count("\\n") + 1)

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


catalog = r'''const BASE_SMITHING_MATERIAL_CATALOG = [
  {
    name: "Mithral Ingot", category: "Ore / Metal", rarity: "Rare", dc: 2, materialClass: "Legendary Metal",
    flavor: "A moon-bright ingot that feels almost weightless, yet rings like tempered steel when struck.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: [],
    offensive: "Halve the weapon's weight. Heavy weapons lose the Heavy property.",
    defensive: "Halve the item's weight and remove its Strength requirement and Stealth disadvantage.",
    weaponMechanics: { weightMultiplier: 0.5, removeProperties: ["Heavy"] },
    armorMechanics: { weightMultiplier: 0.5, removeStrengthRequirement: true, removeStealthDisadvantage: true },
    risk: "Requires exact heat control; overheating ruins its flexibility."
  },
  {
    name: "Adamantine Bar", category: "Ore / Metal", rarity: "Very Rare", dc: 3, materialClass: "Legendary Metal",
    flavor: "A dense charcoal-black bar whose surface resists scratches, sparks, and even the bite of lesser tools.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: [],
    offensive: "Increase the weapon's base damage die by two steps.",
    defensive: "Critical hits against the bearer become normal hits.",
    weaponMechanics: { dieSteps: 2 }, armorMechanics: { criticalHitImmunity: true },
    risk: "Extremely difficult to shape; failed work can damage tools or waste the stock."
  },
  {
    name: "Orichalcum Ingot", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Legendary Metal",
    flavor: "Gold-red metal threaded with quiet light; nearby runes brighten when it is brought close.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["radiant", "force"],
    offensive: "Radiant and Force damage effects are increased by 25%.",
    defensive: "Provides 25% Radiant and 25% Force absorption investment.",
    matchingEffectMultiplier: 1.25, saveDcPerEffectPct: 100,
    armorAbsorption: { radiant: 25, force: 25 },
    risk: "Stored magic can discharge if the alloy is worked unevenly."
  },
  {
    name: "Cold Iron Ingot", category: "Ore / Metal", rarity: "Rare", dc: 3, materialClass: "Legendary Metal",
    flavor: "Dull gray iron worked without ordinary flame; it leaves a winter-cold ache in bare hands.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["fey", "planar"],
    offensive: "Deals 25% additional base weapon damage against Fey creatures.",
    defensive: "Grants Advantage against Fey charm and forced planar movement.",
    weaponMechanics: { targetBonusPct: 25, targetTags: ["fey"] },
    armorMechanics: { saveAdvantageTags: ["fey charm", "forced planar movement"] },
    risk: "Never expose it to ordinary forge heat; it must be pressure-worked and rune-cooled."
  },
  {
    name: "Ironwood Heartwood", category: "Material", rarity: "Rare", dc: 2, materialClass: "Organic & Botanical",
    flavor: "Dark living heartwood with a grain like folded iron; fresh cuts bead with amber-green sap.",
    allowedItemKinds: ["weapon", "armor", "shield"], allowedWeaponFamilies: ["ranged", "hafted", "blunt"], affinityTags: ["nature"],
    offensive: "The weapon is nonmetal and can serve as a druidic spellcasting focus.",
    defensive: "The item is nonmetal and weighs 25% less without reducing Armor Class.",
    weaponMechanics: { nonmetal: true, druidicFocus: true }, armorMechanics: { nonmetal: true, weightMultiplier: 0.75 },
    risk: "Must be cured slowly; hurried drying causes hidden internal splits."
  },
  {
    name: "Deep Coral Plate", category: "Monster Part", rarity: "Rare", dc: 3, materialClass: "Organic & Botanical",
    flavor: "Blue-black coral grown under crushing depths, still cool and faintly damp far from the sea.",
    allowedItemKinds: ["armor", "shield"], affinityTags: ["cold", "water"],
    offensive: "Not suitable as a weapon's primary material.",
    defensive: "Provides 25% Cold absorption and ignores deep-water pressure penalties.",
    armorAbsorption: { cold: 25 }, armorMechanics: { deepWaterAdapted: true },
    risk: "Dries and fractures unless kept mineral-treated throughout shaping."
  },
  {
    name: "Umbral Chitin", category: "Monster Part", rarity: "Uncommon", dc: 2, materialClass: "Organic & Botanical",
    flavor: "Layered midnight chitin that drinks in torchlight and clicks softly when its plates flex.",
    allowedItemKinds: ["ammunition", "armor", "shield"], affinityTags: ["necrotic", "shadow"],
    offensive: "Ammunition gains 25% Necrotic base-damage investment.",
    defensive: "Reduce weight by 25% and add 25% Necrotic absorption investment.",
    weaponMechanics: { damageInvestment: { necrotic: 25 } }, armorAbsorption: { necrotic: 25 }, armorMechanics: { weightMultiplier: 0.75 },
    risk: "Heat destroys its structure; it must be cut, laminated, and resin-bound."
  },
  {
    name: "Obsidian Edgeglass", category: "Material", rarity: "Uncommon", dc: 2, materialClass: "Crystal & Mineral",
    flavor: "Smoky volcanic glass with an impossibly thin edge that catches light in blood-red lines.",
    allowedItemKinds: ["weapon", "ammunition"], allowedWeaponFamilies: ["blade", "piercing", "ammunition"], affinityTags: [],
    offensive: "Increase the weapon's base damage die by one step. A natural 1 damages the edge until repaired.",
    defensive: "Not suitable as armor or shield stock.",
    weaponMechanics: { dieSteps: 1, fragileOnNaturalOne: true },
    risk: "Exceptionally sharp and brittle; failed shaping can shatter the full piece."
  },
  {
    name: "Blood Glass", category: "Material", rarity: "Rare", dc: 4, materialClass: "Crystal & Mineral",
    flavor: "Deep crimson glass with slow-moving shadows suspended beneath its polished surface.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["necrotic", "corruption"],
    offensive: "Necrotic and Corruption effects are increased by 25%.",
    defensive: "Provides 25% Necrotic absorption and Advantage against Corruption effects.",
    matchingEffectMultiplier: 1.25, saveDcPerEffectPct: 100, armorAbsorption: { necrotic: 25 },
    armorMechanics: { saveAdvantageTags: ["corruption"] },
    risk: "Responds to blood and hostile magic; careless work can awaken a lingering curse."
  },
  {
    name: "Star Metal", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Crystal & Mineral",
    flavor: "Silver-black meteoric metal dusted with pinpricks of light that drift like a distant night sky.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["force", "radiant"],
    offensive: "Force and Radiant damage effects are increased by 25%.",
    defensive: "Provides 25% Force and 25% Radiant absorption investment.",
    matchingEffectMultiplier: 1.25, saveDcPerEffectPct: 100, armorAbsorption: { force: 25, radiant: 25 },
    risk: "Its internal charge shifts with celestial cycles and can arc during forging."
  },
  {
    name: "Stygian Iron", category: "Ore / Metal", rarity: "Very Rare", dc: 5, materialClass: "Esoteric & Magical",
    flavor: "Pitch-dark iron veined with ember-red and grave-violet light; its warmth fades when no one is watching.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["fire", "necrotic", "corruption"],
    offensive: "Fire and Necrotic damage effects are increased by 50%.",
    defensive: "Provides 50% Fire and 50% Necrotic absorption and Advantage against Corruption.",
    matchingEffectMultiplier: 1.5, saveDcPerEffectPct: 100,
    armorAbsorption: { fire: 50, necrotic: 50 }, armorMechanics: { saveAdvantageTags: ["corruption"] },
    risk: "Carries corruptive resonance and should always receive a visible warning on the finished item."
  },
  {
    name: "Moonsilver", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Esoteric & Magical",
    flavor: "Pale silver that waxes from translucent to mirror-bright as moonlight crosses its surface.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["radiant", "psychic"],
    offensive: "Radiant and Psychic damage effects are increased by 25%.",
    defensive: "Provides 25% Radiant and 25% Psychic absorption and resists forced phasing.",
    matchingEffectMultiplier: 1.25, saveDcPerEffectPct: 100, armorAbsorption: { radiant: 25, psychic: 25 },
    risk: "Waxes and wanes with lunar phases; unstable work can partially phase out of its fittings."
  },
  {
    name: "Riverine", category: "Material", rarity: "Legendary", dc: 6, materialClass: "Esoteric & Magical",
    flavor: "A ribbon of living water held inside a flawless transparent force lattice, flowing without spilling.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["force", "water"],
    offensive: "Force damage effects are increased by 50%. The weapon cannot rust or corrode.",
    defensive: "Provides 75% Force absorption and forms a watertight protective shell.",
    matchingEffectMultiplier: 1.5, saveDcPerEffectPct: 100, armorAbsorption: { force: 75 }, armorMechanics: { watertight: true },
    risk: "A damaged containment lattice releases the bound water and collapses the crafted section."
  },
];
const DRAGON_SMITHING_MATERIAL_CATALOG = DRAGON_SMITHING_ELEMENTS.flatMap(([dragon, element]) => [
  {
    name: `${dragon} Dragonhide`, category: "Monster Part", rarity: "Very Rare", dc: 4, materialClass: "Dragonhide",
    flavor: `Supple ${dragon.toLowerCase()} dragonhide with ${titleCase(element)} energy moving beneath the scales like a slow pulse.`,
    allowedItemKinds: ["armor", "shield"], affinityTags: [element, "dragon"], element,
    offensive: "Not suitable as a weapon's primary material.",
    defensive: `Provides 50% ${titleCase(element)} absorption investment.`,
    armorAbsorption: { [element]: 50 }, risk: "Mismatched elemental work can make the hide brittle or violently reactive."
  },
  {
    name: `${dragon} Dragon Scale`, category: "Monster Part", rarity: "Very Rare", dc: 5, materialClass: "Dragon Scale",
    flavor: `A rigid ${dragon.toLowerCase()} dragon scale whose polished ridges shimmer with contained ${titleCase(element)} power.`,
    allowedItemKinds: ["armor", "shield"], affinityTags: [element, "dragon"], element,
    offensive: "Not suitable as a weapon's primary material.",
    defensive: `Provides 50% ${titleCase(element)} absorption investment and +1 AC for a complete suit or shield face.`,
    armorAbsorption: { [element]: 50 }, armorMechanics: { acBonus: 1 }, risk: "Scales must be aligned to their natural grain or they shear under impact."
  },
]);
const SMITHING_MATERIAL_CATALOG = [...BASE_SMITHING_MATERIAL_CATALOG, ...DRAGON_SMITHING_MATERIAL_CATALOG];'''
replace_between(
    'const BASE_SMITHING_MATERIAL_CATALOG = [',
    'const ALCHEMY_GROUPS_BY_SECTION = {',
    catalog,
    'smithing material catalog',
)

helpers = r'''const SMITHING_ELEMENT_TAG_ALIASES = {
  acid: "acid", cold: "cold", frost: "cold", ice: "cold", fire: "fire", flame: "fire",
  force: "force", lightning: "lightning", storm: "lightning", necrotic: "necrotic", shadow: "necrotic",
  poison: "poison", venom: "poison", psychic: "psychic", mind: "psychic", radiant: "radiant", holy: "radiant",
  thunder: "thunder", sonic: "thunder", corruption: "corruption", water: "water", nature: "nature",
  dragon: "dragon", fey: "fey", planar: "planar",
};
function smithingElementTagKey(value = "") {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-+|-+$/g, "");
  return SMITHING_ELEMENT_TAG_ALIASES[normalized] || normalized || "neutral";
}
function smithingElementTagLabel(value = "") {
  const key = smithingElementTagKey(value);
  const labels = { cold: "Cold", necrotic: "Necrotic", radiant: "Radiant", lightning: "Lightning", corruption: "Corruption" };
  return labels[key] || titleCase(value || key);
}
function smithingElementAffinityTags(profile = {}) {
  return Array.from(new Set((Array.isArray(profile.affinityTags) ? profile.affinityTags : [])
    .map(smithingElementTagKey)
    .filter((tagValue) => TEMPER_DAMAGE_TYPES.includes(tagValue))));
}
'''
replace_once('function physicalItemKind(item = {}) {', helpers + 'function physicalItemKind(item = {}) {', 'smithing element helpers')

replace_once(
    '    role: "Choose one elemental Mote, Shard, or Core. Standard materials retain their normal base damage type; affinity materials can alter it.",',
    '    role: "Choose one elemental Mote, Shard, or Core. If its element matches the craft material, the weapon base damage changes to that element.",',
    'initial temper rule copy',
)

preview_function = r'''function smithingProductPreview(recipe = {}, baseItem = null, selectedMaterials = []) {
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
  const rawBaseDice = weaponBaseDamageProfile(recipe, baseItem);
  const baseDice = applySmithingWeaponDieSteps(rawBaseDice, profile);
  const initial = tempers.find((entry) => Number(entry.temper_stage ?? -1) === 0) || null;
  const initialElement = smithingElementTagKey(initial?.temper_element || elementalDamageTypeForMaterial(initial || {}));
  const affinity = smithingElementAffinityTags(profile);
  const convertsBase = Boolean(initialElement && affinity.includes(initialElement));
  const baseType = convertsBase ? initialElement : weaponBaseDamageType(recipe, baseItem);
  const riders = {};
  let matchingEffectPct = 0;
  tempers.forEach((entry) => {
    const element = smithingElementTagKey(entry.temper_element || elementalDamageTypeForMaterial(entry));
    let pct = Number(entry.bonus_damage_pct || essenceProfileForMaterial(entry)?.damagePct || 0);
    if (!element || !pct) return;
    if (affinity.includes(element)) {
      pct *= Number(profile.matchingEffectMultiplier || 1);
      matchingEffectPct += pct;
    }
    riders[element] = Number(riders[element] || 0) + pct;
  });
  const saveDcPerEffectPct = Math.max(1, Number(profile.saveDcPerEffectPct || 100));
  const affinitySaveDcBonus = Math.floor(matchingEffectPct / saveDcPerEffectPct);
  return {
    kind: "offensive",
    material: physical?.name || null,
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
replace_between('function smithingProductPreview(recipe = {}, baseItem = null, selectedMaterials = []) {', 'function applySmithingAttemptPreview(', preview_function, 'smithing product preview')

replace_once(
    '    notes: entry.offensive,',
    '    notes: entry.flavor || entry.offensive,',
    'fallback material flavor',
)

essence_function = r'''function buildPurchasedEssenceCatalog(isAdmin = false) {
  const elements = [
    ["Acid", "acid", "caustic green light beads across its surface like fresh etching"],
    ["Frost", "cold", "white-blue rime forms around it even beside a hot forge"],
    ["Fire", "fire", "orange sparks curl inside it like a flame trapped beneath glass"],
    ["Force", "force", "clear pressure ripples distort the air around its edges"],
    ["Storm", "lightning", "violet arcs crawl across it with the smell of rain and ozone"],
    ["Shadow", "necrotic", "grave-purple haze coils within it and dulls nearby reflections"],
    ["Poison", "poison", "emerald vapor clings to it with a bitter metallic scent"],
    ["Psychic", "psychic", "rose-violet patterns shift when viewed from the corner of the eye"],
    ["Radiant", "radiant", "warm gold-white light gathers inside it without casting a shadow"],
    ["Thunder", "thunder", "silver-blue rings pulse through it with a low distant hum"],
  ];
  const tierFlavor = {
    mote: (detail) => `A dust-fine elemental mote; ${detail}.`,
    shard: (detail) => `A faceted elemental shard with enough power to vibrate against its wrapping; ${detail}.`,
    core: (detail) => `A dense elemental core that beats with a slow magical pulse; ${detail}.`,
  };
  return elements.flatMap(([label, element, detail]) => Object.entries(SMITHING_ESSENCE_TIERS).map(([tier, profile]) => {
    const name = `${label} ${profile.label}`;
    const flavor = tierFlavor[tier](detail);
    return {
      id: `catalog-essence:${resourceKeyFor({ name })}`,
      name,
      category: "Reagent / Catalyst",
      type: "Elemental Essence",
      rarity: profile.rarity,
      quantity: isAdmin ? 999 : 0,
      owned_quantity: 0,
      source: isAdmin ? "Admin test stock" : "Elemental essence catalog",
      notes: flavor,
      reagent_family: "essence",
      family_label: "Essence",
      potency_rank: tier === "mote" ? 1 : tier === "shard" ? 2 : 3,
      tags: ["essence", tier, "elemental", element, "smithing-temper", "reagent", "catalyst"],
      alchemy: { kind: "modifier", family: "essence", familyLabel: "Essence", brewTags: [titleCase(element)], bonuses: { typeDirection: element } },
      smithing: { kind: "temper", materialClass: "Elemental Essence", essenceTier: tier, element, damagePct: profile.damagePct, dcModifier: profile.dcModifier, flavor, tags: ["elemental", "smithing-temper", tier, element] },
      essence_tier: tier,
      is_available: Boolean(isAdmin),
      is_catalog_only: true,
      is_admin_virtual: Boolean(isAdmin),
    };
  }));
}'''
replace_between('function buildPurchasedEssenceCatalog(isAdmin = false) {', 'function buildAdminVirtualCraftingMaterials(isAdmin = false) {', essence_function, 'tiered essence flavor')

replace_once(
    '{affinityTags.length ? <span className="craft-ingredient-theme-tags">{affinityTags.map((tagValue) => <span key={tagValue} className="craft-ingredient-theme-pill">{titleCase(tagValue)}</span>)}</span> : null}',
    '{affinityTags.length ? <span className="craft-ingredient-theme-tags craft-element-tags">{affinityTags.map((tagValue) => <span key={tagValue} className={cls("craft-ingredient-theme-pill", "craft-element-tag", `element-${smithingElementTagKey(tagValue)}`)}>{smithingElementTagLabel(tagValue)}</span>)}</span> : null}',
    'colored element tag markup',
)

replace_once(
    '<strong>{titleCase(rider.element)} rider: {rider.dice}</strong><span>{rider.pct}% of base weapon damage after material affinity.</span>',
    '<strong>{titleCase(rider.element)} damage: {rider.dice}</strong><span>{rider.pct}% of base weapon damage after material affinity.</span>',
    'player-facing damage wording',
)
replace_once(
    '{smithingPreview.affinitySaveDcBonus ? <div className="craft-bullet">• Matching non-damage effects gain +{smithingPreview.affinitySaveDcBonus} Save DC instead of the damage multiplier.</div> : null}',
    '{smithingPreview.affinityEffectPct ? <div className="craft-bullet">• Matching saving-throw effects gain +1 Save DC per {smithingPreview.saveDcPerEffectPct}% effect. Current matched effect: {smithingPreview.affinityEffectPct}% ({smithingPreview.affinitySaveDcBonus ? `+${smithingPreview.affinitySaveDcBonus} Save DC` : "no Save DC increase yet"}).</div> : null}',
    'save dc player wording',
)

css = r'''
        .craft-element-tags{gap:3px;margin-top:4px}
        .craft-element-tag{min-height:15px;padding:1px 5px;font-size:7.5px;line-height:1.1;letter-spacing:.035em;box-shadow:inset 0 0 0 1px rgba(255,255,255,.035)}
        .craft-element-tag.element-fire{border-color:rgba(255,92,72,.62);background:rgba(143,32,24,.42);color:#ffc0b6}
        .craft-element-tag.element-cold{border-color:rgba(91,190,255,.65);background:rgba(24,78,132,.42);color:#c9efff}
        .craft-element-tag.element-necrotic{border-color:rgba(112,68,170,.70);background:rgba(42,18,73,.72);color:#d9b9ff}
        .craft-element-tag.element-force{border-color:rgba(213,103,255,.62);background:rgba(94,30,126,.48);color:#efc7ff}
        .craft-element-tag.element-lightning{border-color:rgba(255,220,69,.72);background:rgba(111,86,10,.48);color:#fff1a8}
        .craft-element-tag.element-acid{border-color:rgba(159,236,72,.68);background:rgba(51,92,18,.50);color:#d9ffad}
        .craft-element-tag.element-poison{border-color:rgba(69,207,116,.64);background:rgba(21,85,47,.50);color:#baffcf}
        .craft-element-tag.element-psychic{border-color:rgba(255,112,192,.66);background:rgba(113,31,78,.48);color:#ffd0ec}
        .craft-element-tag.element-radiant{border-color:rgba(255,224,121,.74);background:rgba(116,87,18,.48);color:#fff3c2}
        .craft-element-tag.element-thunder{border-color:rgba(131,139,255,.68);background:rgba(48,47,116,.52);color:#d8dcff}
        .craft-element-tag.element-corruption,.craft-element-tag.element-shadow{border-color:rgba(122,53,113,.68);background:rgba(58,18,53,.68);color:#e4addd}
        .craft-element-tag.element-water{border-color:rgba(67,211,210,.62);background:rgba(17,86,88,.48);color:#bff7f5}
        .craft-element-tag.element-nature{border-color:rgba(90,196,104,.62);background:rgba(29,82,38,.48);color:#c7f6cd}
        .craft-element-tag.element-dragon{border-color:rgba(215,140,68,.66);background:rgba(94,48,17,.50);color:#ffd2a5}
        .craft-element-tag.element-fey{border-color:rgba(111,220,214,.64);background:rgba(29,83,85,.50);color:#c9fffb}
        .craft-element-tag.element-planar{border-color:rgba(158,126,255,.66);background:rgba(57,38,113,.52);color:#e1d4ff}
'''
marker = '        /* Enchanting categories, fantasy materials, elemental tempering, and rich forge previews */'
if css.strip() not in text:
    replace_once(marker, marker + css, 'element tag css')

required = [
    'saveDcPerEffectPct: 100',
    'function smithingElementAffinityTags',
    'const convertsBase = Boolean(initialElement && affinity.includes(initialElement));',
    'Math.floor(matchingEffectPct / saveDcPerEffectPct)',
    'craft-element-tag element-',
    'Fire and Necrotic damage effects are increased by 50%.',
    'Increase the weapon\'s base damage die by two steps.',
    'A dense elemental core that beats with a slow magical pulse',
]
for token in required:
    if token not in text:
        raise RuntimeError(f"verification token missing: {token}")

path.write_text(text)
print("smithing card polish v4 applied", len(text), text.count("\\n") + 1)

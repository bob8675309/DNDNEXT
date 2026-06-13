from pathlib import Path

path = Path('pages/items.js')
text = path.read_text()

def replace_once(old,new,label):
    global text
    c=text.count(old)
    if c!=1: raise RuntimeError(f'{label}: expected 1 found {c}')
    text=text.replace(old,new,1)

def insert_before(marker,addition,label):
    global text
    c=text.count(marker)
    if c!=1: raise RuntimeError(f'{label}: marker expected 1 found {c}')
    text=text.replace(marker,addition+marker,1)

helpers = r'''function smithingProfile(material = {}) {
  const payload = material?.raw?.payload && typeof material.raw.payload === "object" ? material.raw.payload : {};
  const cardPayload = material?.raw?.card_payload && typeof material.raw.card_payload === "object" ? material.raw.card_payload : {};
  return material.smithing || payload.smithing || cardPayload.smithing || {};
}
function craftingMaterialTags(material = {}) {
  const payload = material?.raw?.payload && typeof material.raw.payload === "object" ? material.raw.payload : {};
  const cardPayload = material?.raw?.card_payload && typeof material.raw.card_payload === "object" ? material.raw.card_payload : {};
  const alchemy = material.alchemy || payload.alchemy || cardPayload.alchemy || {};
  const smithing = smithingProfile(material);
  return Array.from(new Set([
    ...(Array.isArray(material.tags) ? material.tags : []),
    ...(Array.isArray(payload.tags) ? payload.tags : []),
    ...(Array.isArray(cardPayload.tags) ? cardPayload.tags : []),
    ...(Array.isArray(alchemy.brewTags) ? alchemy.brewTags : []),
    ...(Array.isArray(smithing.tags) ? smithing.tags : []),
    material.name,
    material.notes,
    alchemy.family,
    smithing.element,
  ].filter(Boolean).map((value) => String(value).toLowerCase())));
}
function elementalDamageTypeForMaterial(material = {}) {
  const blob = craftingMaterialTags(material).join(" ");
  const aliases = [
    ["acid", /acid|corrosive|caustic/],
    ["cold", /cold|frost|ice|rime/],
    ["fire", /fire|ember|flame|cinder/],
    ["force", /force|arcane pressure/],
    ["lightning", /lightning|storm|spark|volt/],
    ["necrotic", /necrotic|grave|death|shadow|umbral/],
    ["poison", /poison|toxic|venom/],
    ["psychic", /psychic|mind|dream/],
    ["radiant", /radiant|holy|sun|solar/],
    ["thunder", /thunder|resonant|sonic|sound/],
  ];
  return aliases.find(([, pattern]) => pattern.test(blob))?.[0] || "";
}
function isElementalTemperMaterial(material = {}) {
  const element = elementalDamageTypeForMaterial(material);
  if (!element || !TEMPER_DAMAGE_TYPES.includes(element)) return false;
  const profile = materialAlchemyProfile(material);
  const family = String(profile.family || material.reagent_family || "").toLowerCase();
  const name = String(material.name || "").toLowerCase();
  const tags = craftingMaterialTags(material);
  return family.includes("essence") || family.includes("mote") || /essence|motes?|quintessence/.test(name) || tags.includes("smithing-temper") || tags.includes("elemental");
}
function physicalItemKind(item = {}) {
  const blob = [item.name, item.type, item.payload?.item_type, item.payload?.type, item.payload?.uiType, item.raw?.item_type, item.raw?.card_payload?.uiType].filter(Boolean).join(" ").toLowerCase();
  if (/ammunition|arrow|bolt/.test(blob)) return "ammunition";
  if (/shield/.test(blob)) return "shield";
  if (/armor|armour|mail|plate|breastplate/.test(blob)) return "armor";
  if (/weapon|melee|ranged|sword|axe|mace|bow|crossbow|spear|dagger|hammer/.test(blob)) return "weapon";
  return "gear";
}
function temperTierForRecipe(recipe = {}) {
  return Number(recipe.temper_tier || String(recipe.name || "").match(/\+([1-3])/)?.[1] || 0);
}
function temperMaterialSlotsForRecipe(recipe = {}, baseItem = null) {
  const tier = Math.max(1, Math.min(3, temperTierForRecipe(recipe) || 1));
  const itemKind = baseItem ? physicalItemKind(baseItem) : "weapon";
  const slots = [{
    key: "craft-material",
    category: "Craft Material",
    label: "Craft Material",
    role: "Ore, ingot, monster bone, hide, heartwood, crystal, or other physical stock",
    allowed_categories: ["Ore / Metal", "Monster Part", "Material"],
    required: true,
    slot_type: "physical",
  }];
  if (["weapon", "ammunition"].includes(itemKind)) {
    for (let stage = 1; stage <= tier; stage += 1) {
      slots.push({
        key: `temper-${stage}`,
        category: "Elemental Temper",
        label: `Temper +${stage}`,
        role: stage === 1
          ? "Choose an elemental essence or motes. This changes the primary damage type and adds elemental damage."
          : "Choose another elemental essence or motes. This adds a stacking elemental damage rider.",
        required: true,
        temper_elemental: true,
        temper_stage: stage,
        bonus_damage_pct: stage * 25,
        slot_type: "temper",
      });
    }
  }
  return slots;
}
function temperMaterialEffect(material = {}, slot = {}) {
  const element = elementalDamageTypeForMaterial(material);
  const stage = Number(slot.temper_stage || material.temper_stage || 1);
  const pct = Number(slot.bonus_damage_pct || material.bonus_damage_pct || stage * 25);
  return {
    name: `Temper +${stage}: ${titleCase(element || "Elemental")}`,
    dc_modifier: 0,
    effect_summary: stage === 1
      ? `Changes the weapon's primary damage type to ${titleCase(element)} and adds bonus ${titleCase(element)} damage equal to ${pct}% of the base weapon damage.`
      : `Adds a stacking ${titleCase(element)} damage rider equal to ${pct}% of the base weapon damage. Repeating an element stacks with earlier temper stages.`,
    risk_summary: "Elemental tempering is stable only when the physical material and prior temper stages are compatible.",
    element,
    temper_stage: stage,
    bonus_damage_pct: pct,
  };
}
function smithingMaterialEffect(material = {}, baseItem = null) {
  const profile = smithingProfile(material);
  if (!Object.keys(profile).length) return null;
  const defensive = ["armor", "shield"].includes(physicalItemKind(baseItem || {}));
  return {
    name: `${profile.materialClass || "Special Material"} Working`,
    dc_modifier: Number(profile.dcModifier || 0),
    effect_summary: defensive ? profile.defensive : profile.offensive,
    offensive_summary: profile.offensive,
    defensive_summary: profile.defensive,
    risk_summary: profile.risk,
  };
}
function buildSmithingMaterialCatalog(isAdmin = false) {
  return SMITHING_MATERIAL_CATALOG.map((entry) => ({
    id: `catalog-smithing:${resourceKeyFor(entry)}`,
    name: entry.name,
    category: entry.category,
    categoryTone: materialCategoryTone(entry.category),
    type: entry.materialClass,
    rarity: entry.rarity,
    quantity: isAdmin ? 999 : 0,
    owned_quantity: 0,
    source: isAdmin ? "Admin smithing catalog stock" : "Smithing material catalog",
    notes: entry.offensive,
    tags: ["smithing", "material", String(entry.materialClass || "").toLowerCase(), String(entry.rarity || "").toLowerCase()],
    smithing: {
      kind: "material",
      materialClass: entry.materialClass,
      offensive: entry.offensive,
      defensive: entry.defensive,
      dcModifier: entry.dc,
      risk: entry.risk,
    },
    is_available: Boolean(isAdmin),
    is_catalog_only: true,
    is_admin_virtual: Boolean(isAdmin),
  }));
}

'''
insert_before('function resourceKeyFor(material) {', helpers, 'smithing helpers')

marker = 'function catalogMaterialFromPlant(row, isAdmin = false) {\n  const payload = row?.payload && typeof row.payload === "object" ? row.payload : row?.card_payload && typeof row.card_payload === "object" ? row.card_payload : null;\n'
smith_case = '''function catalogMaterialFromPlant(row, isAdmin = false) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : row?.card_payload && typeof row.card_payload === "object" ? row.card_payload : null;
  if (payload?.smithing) {
    const smithing = payload.smithing;
    const category = payload.crafting_category || payload.category || row.item_type || payload.item_type || "Material";
    return {
      id: `catalog-smithing:${row.item_key || payload.item_key || resourceKeyFor(row)}`,
      catalog_id: row.item_key || row.id || null,
      name: row.item_name || payload.item_name || payload.name || "Unknown Smithing Material",
      category,
      categoryTone: materialCategoryTone(category),
      type: smithing.materialClass || payload.material_type || "Smithing Material",
      rarity: rarity(row.item_rarity || payload.item_rarity || payload.rarity || "Common") || "Common",
      quantity: isAdmin ? 999 : 0,
      owned_quantity: 0,
      source: isAdmin ? "Admin smithing catalog stock" : payload.source || "Smithing material catalog",
      notes: payload.item_description || payload.flavor || smithing.offensive || "Special smithing stock.",
      tags: Array.from(new Set([...(Array.isArray(payload.tags) ? payload.tags : []), "smithing", "material"])),
      smithing,
      is_available: Boolean(isAdmin),
      is_catalog_only: true,
      is_admin_virtual: Boolean(isAdmin),
      raw: { ...row, payload },
    };
  }
'''
replace_once(marker, smith_case, 'smithing catalog case')

start = text.index('function buildPurchasedEssenceCatalog(isAdmin = false) {')
end = text.index('\nfunction buildAdminVirtualCraftingMaterials', start)
old = text[start:end]
new = r'''function buildPurchasedEssenceCatalog(isAdmin = false) {
  const elements = [
    ["Fire Essence", "fire", "fire elemental direction for fire, heat, and flame"],
    ["Frost Essence", "cold", "cold elemental direction for frost and ice"],
    ["Storm Essence", "lightning", "lightning and storm direction"],
    ["Acid Essence", "acid", "acidic direction and corrosive power"],
    ["Poison Essence", "poison", "toxin direction and poison power"],
    ["Radiant Essence", "radiant", "radiant, sun, and holy direction"],
    ["Shadow Essence", "necrotic", "shadow, death, and necrotic direction"],
    ["Force Essence", "force", "force and arcane pressure direction"],
    ["Psychic Essence", "psychic", "mind and psychic direction"],
    ["Thunder Essence", "thunder", "thunder and resonant direction"],
  ];
  return elements.map(([name, element, notes]) => ({
    id: `catalog-essence:${resourceKeyFor({ name })}`,
    name,
    category: "Reagent / Catalyst",
    type: "Purchased Essence",
    rarity: element === "force" || element === "psychic" ? "Rare" : "Uncommon",
    quantity: isAdmin ? 999 : 0,
    owned_quantity: 0,
    source: isAdmin ? "Admin test stock" : "Purchased reagent catalog",
    notes,
    reagent_family: "essence",
    family_label: "Essence",
    potency_rank: 1,
    tags: ["essence", "elemental", element, "smithing-temper", "reagent", "catalyst"],
    alchemy: { kind: "modifier", family: "essence", brewTags: [titleCase(element)], bonuses: { typeDirection: element } },
    is_available: Boolean(isAdmin),
    is_catalog_only: true,
    is_admin_virtual: Boolean(isAdmin),
  }));
}'''
text = text[:start] + new + text[end:]

replace_once(
'''    const canonical = existing.is_catalog_only && existing.alchemy
      ? existing
      : material.is_catalog_only && material.alchemy
        ? material
        : null;''',
'''    const canonical = existing.is_catalog_only && (existing.alchemy || existing.smithing)
      ? existing
      : material.is_catalog_only && (material.alchemy || material.smithing)
        ? material
        : null;''',
'canonical smithing')
replace_once(
'''      alchemy: canonical?.alchemy || material.alchemy || existing.alchemy,
      notes: canonical?.notes || material.notes || existing.notes,''',
'''      alchemy: canonical?.alchemy || material.alchemy || existing.alchemy,
      smithing: canonical?.smithing || material.smithing || existing.smithing,
      notes: canonical?.notes || material.notes || existing.notes,''',
'merge smithing payload')
replace_once(
'''  plantCatalog.forEach((plant) => add(catalogMaterialFromPlant(plant, isAdmin), false));
  buildPurchasedEssenceCatalog(isAdmin).forEach((essence) => add(essence, false));''',
'''  plantCatalog.forEach((plant) => add(catalogMaterialFromPlant(plant, isAdmin), false));
  buildPurchasedEssenceCatalog(isAdmin).forEach((essence) => add(essence, false));
  buildSmithingMaterialCatalog(isAdmin).forEach((material) => add(material, false));''',
'add smithing fallback')

replace_once(
'''    material?.notes,
    material?.climate,''',
'''    material?.notes,
    smithingProfile(material)?.materialClass,
    smithingProfile(material)?.offensive,
    smithingProfile(material)?.defensive,
    material?.climate,''',
'material search smithing')

path.write_text(text)
print('phase2 ok', len(text), text.count('\n')+1)

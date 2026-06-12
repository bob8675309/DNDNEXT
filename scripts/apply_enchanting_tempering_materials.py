from pathlib import Path
import re

PATH = Path("pages/items.js")
text = PATH.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)


def regex_once(pattern, replacement, label, flags=re.S):
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex match, found {count}")


# ---------------------------------------------------------------------------
# Catalog constants and categorization
# ---------------------------------------------------------------------------
replace_once(
    'const ALCHEMY_SECTIONS = ["All", "Potions", "Poisons", "Bombs", "Elixirs", "Oils"];',
    '''const ALCHEMY_SECTIONS = ["All", "Potions", "Poisons", "Bombs", "Elixirs", "Oils"];
const ENCHANTING_SECTIONS = ["All", "Melee Weapon", "Ranged Weapon", "Ammo", "Armor", "Shield"];
const TEMPER_DAMAGE_TYPES = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];
const SMITHING_MATERIAL_CATALOG = [
  { name: "Mithral Ingot", category: "Ore / Metal", rarity: "Rare", dc: 2, materialClass: "Legendary Metal", offensive: "Lightens a weapon without weakening it; heavy weapons become easier to ready and finesse-compatible designs retain full strength.", defensive: "Halves the finished item's weight and removes any normal Strength requirement or Stealth disadvantage caused by the armor.", risk: "Requires exact heat control; overheating ruins its flexibility." },
  { name: "Adamantine Bar", category: "Ore / Metal", rarity: "Very Rare", dc: 3, materialClass: "Legendary Metal", offensive: "Creates an exceptionally hard edge or striking face suited to sundering objects, armor, and reinforced structures.", defensive: "Reinforces armor and shields against catastrophic impacts and critical-hit deformation.", risk: "Extremely difficult to shape; failed work can damage tools or waste the stock." },
  { name: "Orichalcum Ingot", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Legendary Metal", offensive: "Channels spell energy through the weapon, making it an excellent foundation for elemental and radiant tempering.", defensive: "Holds a stable arcane ward that improves resistance to magical strain and later enchantment binding.", risk: "Stored magic can discharge if the alloy is worked unevenly." },
  { name: "Cold Iron Ingot", category: "Ore / Metal", rarity: "Rare", dc: 3, materialClass: "Legendary Metal", offensive: "Its unheated, deep-forged edge disrupts fey glamour and planar protections.", defensive: "Dampens fey influence, charm effects, and hostile planar resonance around the wearer.", risk: "Never expose it to ordinary forge heat; it must be pressure-worked and rune-cooled." },
  { name: "Dragonhide", category: "Monster Part", rarity: "Very Rare", dc: 4, materialClass: "Organic & Botanical", offensive: "A dragon-derived weapon grip, lash, or striking surface can carry the damage type associated with the dragon source.", defensive: "Armor or shields retain a measure of the dragon's elemental resilience, keyed to the harvested dragon.", risk: "Mismatched essences can make the material brittle or violently reactive." },
  { name: "Ironwood Heartwood", category: "Material", rarity: "Rare", dc: 2, materialClass: "Organic & Botanical", offensive: "Produces dense wooden weapons that strike like steel while remaining compatible with druidic and nature magic.", defensive: "Can replace metal plates or shield faces with a lighter, nonmetal defense of comparable strength.", risk: "Must be cured slowly; hurried drying causes hidden internal splits." },
  { name: "Deep Coral Plate", category: "Monster Part", rarity: "Rare", dc: 3, materialClass: "Organic & Botanical", offensive: "Forms barbed aquatic points that resist corrosion and maintain a keen edge underwater.", defensive: "Creates pressure-resistant armor and shields suited to deep water and aquatic environments.", risk: "Dries and fractures unless kept mineral-treated throughout shaping." },
  { name: "Umbral Chitin", category: "Monster Part", rarity: "Uncommon", dc: 2, materialClass: "Organic & Botanical", offensive: "Creates light serrated blades, spikes, and ammunition with excellent cutting geometry.", defensive: "Builds lightweight layered armor that spreads impact without the weight of forged plate.", risk: "Heat destroys its structure; it must be cut, laminated, and resin-bound." },
  { name: "Obsidian Edgeglass", category: "Material", rarity: "Uncommon", dc: 2, materialClass: "Crystal & Mineral", offensive: "Takes a supernatural razor edge suited to slashing, piercing, and critical-hit focused weapons.", defensive: "Reflective plates resist heat and magical glare but remain vulnerable to repeated blunt impact.", risk: "Exceptionally sharp and brittle; failed shaping can shatter the full piece." },
  { name: "Blood Glass", category: "Material", rarity: "Rare", dc: 4, materialClass: "Crystal & Mineral", offensive: "Serves as a powerful conduit for necrotic, curse, and life-draining enchantments.", defensive: "Can redirect a portion of necrotic or curse energy into the glass instead of the bearer.", risk: "Responds to blood and hostile magic; careless work can awaken a lingering curse." },
  { name: "Star Metal", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Crystal & Mineral", offensive: "Carries cosmic force through the weapon and readily accepts radiant, force, or extraplanar enchantments.", defensive: "Forms a stable ward against force, radiant pressure, and hostile planar energies.", risk: "Its internal charge shifts with celestial cycles and can arc during forging." },
  { name: "Stygian Iron", category: "Ore / Metal", rarity: "Very Rare", dc: 5, materialClass: "Esoteric & Magical", offensive: "Binds hellfire and necrotic energy into cruel, soul-searing weapon channels.", defensive: "Can ward against fire and necrotic power while anchoring the wearer against forced planar movement.", risk: "Carries corruptive resonance and should always receive a visible warning on the finished item." },
  { name: "Moonsilver", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Esoteric & Magical", offensive: "A phase-shifting edge readily carries radiant or psychic tempering and bites through illusion-shrouded defenses.", defensive: "Creates nearly weightless armor that glimmers against shapechanging, illusion, and ethereal intrusion.", risk: "Waxes and wanes with lunar phases; unstable work can partially phase out of its fittings." },
  { name: "Riverine", category: "Material", rarity: "Legendary", dc: 6, materialClass: "Esoteric & Magical", offensive: "A force-contained water edge cannot rust and can deliver pressure-like force through a strike.", defensive: "Forms a transparent, watertight force shell with extraordinary resilience and almost no conventional weight.", risk: "A damaged containment lattice releases the bound water and collapses the crafted section." },
];''',
    "catalog constants",
)

# Replace the three compact recipe builders so they retain item stats and applies-to data.
regex_once(
    r'function forgeRecipe\(item\) \{.*?\n\}\nfunction temperRecipes\(\) \{.*?\n\}\nfunction variantRecipe\(raw\) \{.*?\n\}\nfunction dbRecipe',
    r'''function flatRecipeEntries(value) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === "string") { out.push(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.entry) walk(node.entry);
    if (node.entries) walk(node.entries);
    if (node.items) walk(node.items);
  };
  walk(value);
  return out.join("\n").trim();
}
const RECIPE_DAMAGE_TYPES = { P: "piercing", S: "slashing", B: "bludgeoning", R: "radiant", N: "necrotic", F: "fire", C: "cold", L: "lightning", A: "acid", T: "thunder", Psn: "poison", Psy: "psychic", Frc: "force" };
const RECIPE_PROPERTY_NAMES = { L: "Light", F: "Finesse", H: "Heavy", R: "Reach", T: "Thrown", V: "Versatile", "2H": "Two-Handed", A: "Ammunition", LD: "Loading", S: "Special", RLD: "Reload" };
function forgeItemPreview(item = {}, flavorIndex = {}) {
  const code = tag(item.type || item.item_type).toUpperCase();
  const properties = [].concat(item.property || item.properties || []).map((prop) => {
    const clean = tag(typeof prop === "string" ? prop : prop?.name || prop?.uid || "");
    return RECIPE_PROPERTY_NAMES[clean] || clean;
  }).filter(Boolean);
  const damageType = RECIPE_DAMAGE_TYPES[item.dmgType || item.damageType] || item.dmgType || item.damageType || "";
  const damage = item.damageText || item.damage_text || (item.dmg1 ? `${item.dmg1} ${damageType}`.trim() : "—");
  const ac = item.ac ?? item.armor?.ac ?? "—";
  const rawCost = item.price_gp ?? item.item_cost ?? item.cost ?? item.value;
  const costGp = typeof rawCost === "number" ? (item.price_gp != null ? rawCost : rawCost >= 100 ? rawCost / 100 : rawCost) : rawCost;
  const name = item.name || item.item_name || "Unnamed Item";
  const flavor = item.flavor || flavorIndex?.[name]?.flavor || "";
  const rules = item.item_description || item.rulesText || item.rulesShort || flatRecipeEntries(item.entries) || "";
  const range = item.rangeText || item.range || ((item.range_normal && item.range_long) ? `${item.range_normal}/${item.range_long} ft.` : "—");
  return {
    name,
    type: typeFromCode(code),
    family: familyFromItem(item),
    flavor,
    rules,
    damage,
    ac,
    range,
    properties,
    mastery: [].concat(item.mastery || []).filter(Boolean),
    cost_gp: costGp ?? "—",
    weight_lb: item.item_weight ?? item.weight ?? "—",
    source: item.source || item.item_source || "Catalog",
    image: item.image_url || item.img || item.image || "",
  };
}
function forgeRecipe(item, flavorIndex = {}) {
  const name = item.name || item.item_name || "Unnamed Item";
  const itemPreview = forgeItemPreview(item, flavorIndex);
  return {
    id: `forge:${name}:${item.type || item.item_type || ""}`,
    name: `Forge ${name}`,
    discipline: "Smithing",
    kind: "forge",
    category: typeFromCode(item.type || item.item_type),
    family: familyFromItem(item),
    rarity: "Mundane",
    known: false,
    source: item.source || "Catalog",
    summary: `A blacksmith can craft a new mundane ${name}.`,
    requirements: ["Access to a smithy", `Pattern: ${name}`, "Material cost determined by the DM"],
    components: ["Metal, wood, leather, fletching, monster material, or ammunition stock as appropriate"],
    item_preview: itemPreview,
    base_item_payload: item,
  };
}
function temperRecipes() {
  return [1, 2, 3].map((n) => ({
    id: `temper:+${n}`,
    name: `+${n} Temper`,
    discipline: "Smithing",
    kind: "temper",
    temper_tier: n,
    category: "weapon / armor / shield / ammunition",
    family: "Temper",
    rarity: n === 1 ? "Uncommon" : n === 2 ? "Rare" : "Very Rare",
    known: false,
    source: "Town Smithing",
    summary: `Upgrade a physical weapon, ammunition, armor, or shield to smith tier +${n}. Weapons and ammunition can carry one elemental temper per completed tier.`,
    requirements: ["Base physical item from the previous smith tier", `Smith capable of +${n} work`],
    components: ["One physical craft material", `Elemental essence or motes for each temper stage through +${n}`],
  }));
}
function variantRecipe(raw) {
  const key = String(raw?.key || raw?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const originalName = String(raw?.name || "").trim();
  if (!key || !originalName || PHYSICAL_VARIANTS.has(key)) return null;
  const appliesTo = Array.isArray(raw.appliesTo) ? raw.appliesTo.map((v) => String(v).toLowerCase()) : ["weapon", "armor", "shield", "ammunition"];
  const entries = Array.isArray(raw.entries) ? raw.entries : raw.entries ? [String(raw.entries)] : [];
  return {
    id: `enchant:${key}`,
    key,
    name: originalName.replace(/^Sword of\s+/i, "Weapon of "),
    originalName,
    discipline: "Enchanting",
    kind: "enchant",
    category: appliesTo.join(" / "),
    family: appliesTo.includes("weapon") ? "Weapon" : appliesTo.map(titleCase).join(" / "),
    applies_to: appliesTo,
    rarity: rarity(raw.rarity || (raw.rarityByValue ? "Varies" : "")) || "Varies",
    known: false,
    source: raw.source || "Variant Catalog",
    summary: entries.join(" ") || raw.textByKind?.[appliesTo[0]] || `Magical trait applicable to ${appliesTo.join(", ")}.`,
    requirements: ["Smith-tiered base item", `Applies to: ${appliesTo.join(", ")}`],
    components: raw.options?.length ? [`Choose option: ${raw.options.join(", ")}`] : ["Optional catalyst, reagent, monster part, or teacher requirement"],
  };
}
function dbRecipe''',
    "recipe builders",
)

# Enchanting category helpers.
anchor = '''function normalizeDurationUnit(value = "") {'''
insert = r'''function enchantingSectionsForRecipe(recipe = {}) {
  if (recipe.discipline !== "Enchanting") return [];
  const explicit = Array.isArray(recipe.applies_to) ? recipe.applies_to : [];
  const blob = [...explicit, recipe.category, recipe.family, recipe.name, ...(recipe.requirements || [])].filter(Boolean).join(" ").toLowerCase();
  const sections = new Set();
  if (/ammunition|\bammo\b|arrow|bolt/.test(blob)) sections.add("Ammo");
  if (/shield/.test(blob)) sections.add("Shield");
  if (/armor|armour/.test(blob)) sections.add("Armor");
  if (/ranged|bow|crossbow|sling/.test(blob)) sections.add("Ranged Weapon");
  if (/melee|sword|axe|mace|hammer|spear|dagger|weapon/.test(blob)) sections.add("Melee Weapon");
  if (/\bweapon\b/.test(blob) && !/melee|ranged/.test(blob)) sections.add("Ranged Weapon");
  return Array.from(sections);
}

'''
if insert.strip() not in text:
    replace_once(anchor, insert + anchor, "enchanting helpers")

# ---------------------------------------------------------------------------
# Physical material catalog and elemental temper helpers
# ---------------------------------------------------------------------------
anchor = '''function resourceKeyFor(material) {'''
insert = r'''function smithingProfile(material = {}) {
  const payload = material?.raw?.payload && typeof material.raw.payload === "object" ? material.raw.payload : {};
  const cardPayload = material?.raw?.card_payload && typeof material.raw.card_payload === "object" ? material.raw.card_payload : {};
  return material.smithing || payload.smithing || cardPayload.smithing || {};
}
function materialTags(material = {}) {
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
    alchemy.family,
    smithing.element,
  ].filter(Boolean).map((value) => String(value).toLowerCase())));
}
function elementalDamageTypeForMaterial(material = {}) {
  const tags = materialTags(material).join(" ");
  const aliases = [
    ["acid", /acid|corrosive/], ["cold", /cold|frost|ice/], ["fire", /fire|ember|flame/],
    ["force", /force/], ["lightning", /lightning|storm|spark/], ["necrotic", /necrotic|grave|death|shadow/],
    ["poison", /poison|toxic|venom/], ["psychic", /psychic|mind/], ["radiant", /radiant|holy|sun/], ["thunder", /thunder|resonant|sound/],
  ];
  return aliases.find(([, pattern]) => pattern.test(tags))?.[0] || "";
}
function isElementalTemperMaterial(material = {}) {
  const element = elementalDamageTypeForMaterial(material);
  if (!element || !TEMPER_DAMAGE_TYPES.includes(element)) return false;
  const profile = materialAlchemyProfile(material);
  const family = String(profile.family || material.reagent_family || "").toLowerCase();
  const name = String(material.name || "").toLowerCase();
  return family === "essence" || family === "monster_fluid" || /essence|motes?|elemental spark|quintessence/.test(name);
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
  const kind = baseItem ? physicalItemKind(baseItem) : "weapon";
  const slots = [{
    key: "craft-material",
    category: "Craft Material",
    label: "Craft Material",
    role: "Ore, ingot, monster bone, hide, wood, crystal, or other physical stock",
    allowed_categories: ["Ore / Metal", "Monster Part", "Material"],
    required: true,
    slot_type: "physical",
  }];
  if (["weapon", "ammunition"].includes(kind)) {
    for (let stage = 1; stage <= tier; stage += 1) {
      slots.push({
        key: `temper-${stage}`,
        category: "Elemental Temper",
        label: `Temper +${stage}`,
        role: stage === 1 ? "Choose an essence or motes; changes the primary damage type and adds elemental damage." : "Choose another essence or motes; adds a stacking elemental damage rider.",
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
      : `Adds a stacking ${titleCase(element)} damage rider equal to ${pct}% of the base weapon damage. Repeating an element stacks with earlier stages.`,
    risk_summary: "Elemental tempering is stable only when the physical material and prior temper stages are compatible.",
    element,
    temper_stage: stage,
    bonus_damage_pct: pct,
  };
}
function smithingMaterialEffect(material = {}, baseItem = null) {
  const profile = smithingProfile(material);
  if (!Object.keys(profile).length) return null;
  const kind = physicalItemKind(baseItem || {});
  const defensive = ["armor", "shield"].includes(kind);
  return {
    name: `${profile.materialClass || "Special Material"} Working`,
    dc_modifier: Number(profile.dcModifier || 0),
    effect_summary: defensive ? profile.defensive : profile.offensive,
    offensive_summary: profile.offensive,
    defensive_summary: profile.defensive,
    risk_summary: profile.risk,
  };
}

'''
if 'function smithingProfile(material = {})' not in text:
    replace_once(anchor, insert + anchor, "smithing material helpers")

# Teach catalog conversion about smithing rows.
needle = '''  if (payload?.alchemy) {'''
smithing_case = r'''  if (payload?.smithing) {
    const smithing = payload.smithing;
    const category = payload.crafting_category || payload.category || row.item_type || payload.item_type || payload.uiType || "Material";
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
if smithing_case.strip() not in text:
    replace_once(needle, smithing_case + needle, "smithing catalog conversion")

# Add local material fallback to merged resources and retain curated smithing payloads.
replace_once(
    '''  buildPurchasedEssenceCatalog(isAdmin).forEach((essence) => add(essence, false));
  buildAdminVirtualCraftingMaterials(isAdmin).forEach((material) => add(material, false));''',
    '''  buildPurchasedEssenceCatalog(isAdmin).forEach((essence) => add(essence, false));
  buildSmithingMaterialCatalog(isAdmin).forEach((material) => add(material, false));
  buildAdminVirtualCraftingMaterials(isAdmin).forEach((material) => add(material, false));''',
    "merge smithing catalog",
)
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
    "canonical resource selection",
)
replace_once(
    '''      alchemy: canonical?.alchemy || material.alchemy || existing.alchemy,
      notes: canonical?.notes || material.notes || existing.notes,''',
    '''      alchemy: canonical?.alchemy || material.alchemy || existing.alchemy,
      smithing: canonical?.smithing || material.smithing || existing.smithing,
      notes: canonical?.notes || material.notes || existing.notes,''',
    "retain smithing payload",
)

# Ensure synthetic purchased essences carry actual element tags.
regex_once(
    r'function buildPurchasedEssenceCatalog\(isAdmin = false\) \{.*?\n\}',
    r'''function buildPurchasedEssenceCatalog(isAdmin = false) {
  const elements = [
    ["Fire Essence", "fire", "fire elemental direction for fire, heat, and flame"],
    ["Frost Essence", "cold", "cold elemental direction for frost and ice"],
    ["Storm Essence", "lightning", "lightning and thunder direction"],
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
}''',
    "purchased essence catalog",
)

# Material search includes catalog tags and smithing properties.
replace_once(
    '''    material?.notes,
    materialQualityLabel(material),''',
    '''    material?.notes,
    ...(Array.isArray(material?.tags) ? material.tags : []),
    smithingProfile(material)?.materialClass,
    smithingProfile(material)?.offensive,
    smithingProfile(material)?.defensive,
    materialQualityLabel(material),''',
    "material search payload",
)

# ---------------------------------------------------------------------------
# Temper slots, resource filtering, and contextual effects
# ---------------------------------------------------------------------------
replace_once(
    '''function requiredMaterialCategoriesForRecipe(recipe) {
  const alchemySlots = alchemyMaterialSlotsForRecipe(recipe);''',
    '''function requiredMaterialCategoriesForRecipe(recipe, baseItem = null) {
  if (recipe?.discipline === "Smithing" && recipe?.kind === "temper") return temperMaterialSlotsForRecipe(recipe, baseItem);
  const alchemySlots = alchemyMaterialSlotsForRecipe(recipe);''',
    "temper material slots",
)
replace_once(
    '''function buildCraftBenchPlan(recipe, materials = []) {''',
    '''function buildCraftBenchPlan(recipe, materials = [], baseItem = null) {''',
    "bench plan signature",
)
replace_once(
    '''  const categories = requiredMaterialCategoriesForRecipe(recipe);''',
    '''  const categories = requiredMaterialCategoriesForRecipe(recipe, baseItem);''',
    "bench plan categories",
)
replace_once(
    '''      .filter((material) => recipe.discipline === "Alchemy" ? materialMeetsAlchemySlot(material, slot) : materialMatchesCategory(material, slot.category))''',
    '''      .filter((material) => {
        if (recipe.discipline === "Alchemy") return materialMeetsAlchemySlot(material, slot);
        if (slot.temper_elemental) return isElementalTemperMaterial(material);
        if (Array.isArray(slot.allowed_categories)) return slot.allowed_categories.some((category) => materialMatchesCategory(material, category));
        return materialMatchesCategory(material, slot.category);
      })''',
    "bench plan candidate matching",
)

# Replace discipline-only filtering with recipe-aware filtering.
regex_once(
    r'function materialAllowedForDiscipline\(material, discipline = ""\) \{.*?\n\}',
    r'''function materialAllowedForRecipe(material, recipe = {}) {
  if (!material) return false;
  const d = String(recipe.discipline || "").toLowerCase();
  const category = String(material.category || "").toLowerCase();
  const blob = materialSearchBlob(material);
  const profile = smithingProfile(material);
  if (!d || d === "alchemy") return true;
  if (d === "smithing" && recipe.kind === "temper" && isElementalTemperMaterial(material)) return true;
  if (d === "smithing" && Object.keys(profile).length) return true;
  if (hasExplicitAlchemyPayload(material)) return false;
  if (d === "smithing") {
    if (["ore / metal", "material"].includes(category)) return true;
    if (category === "catalyst") return !/(potion|brew|herb|plant|extract|tincture)/.test(blob);
    if (category === "monster part") return !/(venom|poison|bile|mucus|fluid|blood extract|alchemical)/.test(blob);
    return false;
  }
  if (d === "enchanting") {
    if (category === "catalyst" || category === "monster part") return true;
    if (category === "ore / metal" || category === "material") return /(mithral|adamant|silver|ruidium|orichalcum|cold iron|obsidian|blood glass|star metal|stygian|moonsilver|riverine|crystal|shard|gem|arcane|planar)/.test(blob);
    return false;
  }
  return true;
}
function materialAllowedForDiscipline(material, discipline = "") {
  return materialAllowedForRecipe(material, { discipline });
}''',
    "recipe-aware material filter",
)

replace_once(
    '''  const planningResources = allPlanningResources.filter((material) => materialAllowedForDiscipline(material, recipe.discipline));''',
    '''  const planningResources = allPlanningResources.filter((material) => materialAllowedForRecipe(material, recipe));''',
    "recipe preview resource filter",
)
replace_once(
    '''  const plan = buildCraftBenchPlan(recipe, planningResources);''',
    '''  const plan = buildCraftBenchPlan(recipe, planningResources, baseItem);''',
    "recipe preview plan context",
)

# Selected material objects and saved payload retain temper metadata.
replace_once(
    '''      slot_type: entry.slot_type || entry.slotType || (entry.family === "any" ? "modifier" : "core"),
      potency_rank:''',
    '''      slot_type: entry.slot_type || entry.slotType || (entry.family === "any" ? "modifier" : "core"),
      temper_elemental: Boolean(entry.temper_elemental),
      temper_stage: entry.temper_stage || null,
      bonus_damage_pct: entry.bonus_damage_pct || null,
      temper_element: selected ? elementalDamageTypeForMaterial(selected) || null : null,
      smithing: selected ? smithingProfile(selected) : null,
      potency_rank:''',
    "saved material metadata",
)
replace_once(
    '''      slot_allowed_families: entry.allowed_families || entry.allowedFamilies || [],
      optional: entry.required === false,''',
    '''      slot_allowed_families: entry.allowed_families || entry.allowedFamilies || [],
      temper_elemental: Boolean(entry.temper_elemental),
      temper_stage: entry.temper_stage || null,
      bonus_damage_pct: entry.bonus_damage_pct || null,
      optional: entry.required === false,''',
    "selected object temper metadata",
)

# Contextual physical material card with offense/defense lines.
regex_once(
    r'function PhysicalMaterialEffectCard\(\{ material, materialEffects = \[\], quantityLabel = "", compact = false, discipline = "Crafting" \}\) \{.*?\n\}',
    r'''function PhysicalMaterialEffectCard({ material, materialEffects = [], quantityLabel = "", compact = false, discipline = "Crafting", baseItem = null, slot = {} }) {
  if (!material) return null;
  const profile = smithingProfile(material);
  const effect = slot?.temper_elemental
    ? temperMaterialEffect(material, slot)
    : smithingMaterialEffect(material, baseItem) || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {
      name: `${material.category || "Material"} Contribution`,
      dc_modifier: 1,
      effect_summary: "Adds a minor material property determined by the selected recipe.",
      risk_summary: "Requires correct tools and handling.",
    };
  const itemRarity = rarity(material.rarity || "Common") || "Common";
  const dcModifier = Number(effect.dc_modifier || 0);
  return (
    <div className={cls("craft-material-effect-row", "craft-specific-material-effect-row", "craft-alchemy-effect-card", "craft-physical-effect-card", compact && "compact", rarityClassName(itemRarity))}>
      <div className="craft-alchemy-item-head">
        <div className="craft-alchemy-item-title-block">
          <strong>{material.name}</strong>
          <span className="craft-ingredient-family-pill craft-ingredient-family-pill-under-name">{slot?.temper_elemental ? `Temper +${slot.temper_stage}` : profile.materialClass || material.category || material.type || "Material"}</span>
        </div>
        <div className="craft-effect-card-badges">
          <span className={cls("craft-ingredient-quality-pill", rarityClassName(itemRarity))}>{itemRarity}</span>
          {effect.element ? <span className="craft-ingredient-theme-pill">{titleCase(effect.element)}</span> : null}
          {quantityLabel ? <span className="craft-ingredient-qty-pill">{quantityLabel}</span> : null}
        </div>
      </div>
      <div className="craft-alchemy-card-description">{material.notes || material.description || material.raw?.item_description || "Prepared crafting stock."}</div>
      <div className="craft-alchemy-card-divider" />
      <div className="craft-alchemy-impact-label">{slot?.temper_elemental ? "Temper impact" : discipline === "Smithing" ? "Forge impact" : "Binding impact"}</div>
      <div className="craft-ingredient-impact-chips craft-material-impact-chips">
        <i>{effect.name || "Material effect"}</i>
        {effect.bonus_damage_pct ? <i>+{effect.bonus_damage_pct}% base damage</i> : null}
        <i>{dcModifier ? `Craft DC ${dcModifier > 0 ? "+" : ""}${dcModifier}` : "No Craft DC change"}</i>
      </div>
      {profile.offensive && profile.defensive ? (
        <div className="craft-material-dual-effects">
          <div><strong>Weapon / Ammo</strong><span>{profile.offensive}</span></div>
          <div><strong>Armor / Shield</strong><span>{profile.defensive}</span></div>
        </div>
      ) : <div className="craft-material-specific-summary">{effect.effect_summary || "Adds a recipe-appropriate crafted property."}</div>}
      {!compact && effect.risk_summary ? <div className="craft-physical-risk-note"><strong>Handling:</strong> {effect.risk_summary}</div> : null}
    </div>
  );
}''',
    "physical material card",
)

# Pass base item and slot into both selected and candidate cards.
text = text.replace('material={selectedCandidate} materialEffects={materialEffects} quantityLabel={selectedQuantityLabel} discipline={recipe.discipline}', 'material={selectedCandidate} materialEffects={materialEffects} quantityLabel={selectedQuantityLabel} discipline={recipe.discipline} baseItem={baseItem} slot={slot}')
text = text.replace('material={candidate} materialEffects={materialEffects} quantityLabel={available ? candidate.is_admin_virtual ? "∞ admin" : `x${candidate.quantity || 1}` : "Not owned"} compact discipline={recipe.discipline}', 'material={candidate} materialEffects={materialEffects} quantityLabel={available ? candidate.is_admin_virtual ? "∞ admin" : `x${candidate.quantity || 1}` : "Not owned"} compact discipline={recipe.discipline} baseItem={baseItem} slot={slot}')

# Attempt preview accepts base item and exposes temper stages.
replace_once(
    '''function calculateCraftAttemptPreview(recipe, plan, selectedMaterials = {}, recipeRules = [], materialEffects = []) {''',
    '''function calculateCraftAttemptPreview(recipe, plan, selectedMaterials = {}, recipeRules = [], materialEffects = [], baseItem = null) {''',
    "attempt preview signature",
)
replace_once(
    '''    const alchemyEffect = isAlchemy ? alchemyMaterialSpecificEffect(material, effectiveRecipe) : null;
    const effect = alchemyEffect || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {''',
    '''    const alchemyEffect = isAlchemy ? alchemyMaterialSpecificEffect(material, effectiveRecipe) : null;
    const physicalEffect = !isAlchemy && material.temper_elemental
      ? temperMaterialEffect(material, material)
      : !isAlchemy ? smithingMaterialEffect(material, baseItem) : null;
    const effect = alchemyEffect || physicalEffect || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {''',
    "contextual material effect calculation",
)
replace_once(
    '''      risk_score: effect.risk_score || 0,
    };''',
    '''      risk_score: effect.risk_score || 0,
      element: effect.element || null,
      temper_stage: effect.temper_stage || null,
      bonus_damage_pct: effect.bonus_damage_pct || 0,
      offensive_summary: effect.offensive_summary || null,
      defensive_summary: effect.defensive_summary || null,
    };''',
    "attempt effect metadata",
)
replace_once(
    '''    material_effects: materialBreakdown,
    check_ability:''',
    '''    material_effects: materialBreakdown,
    temper_preview: materialBreakdown.filter((item) => item.temper_stage).sort((a, b) => a.temper_stage - b.temper_stage),
    temper_total_bonus_pct: materialBreakdown.reduce((sum, item) => sum + Number(item.bonus_damage_pct || 0), 0),
    check_ability:''',
    "temper preview result",
)
text = text.replace('calculateCraftAttemptPreview(recipe, plan, selectedMaterials, recipeRules, materialEffects);', 'calculateCraftAttemptPreview(recipe, plan, selectedMaterials, recipeRules, materialEffects, baseItem);')
text = text.replace('calculateCraftAttemptPreview(activeRecipe, plan, selectedMaterials, recipeRules, materialEffects);', 'calculateCraftAttemptPreview(activeRecipe, plan, selectedMaterials, recipeRules, materialEffects, baseItem);')

# ---------------------------------------------------------------------------
# Rich forge recipe card and temper summary
# ---------------------------------------------------------------------------
replace_once(
    '''      ) : (
        <div className="craft-preview-grid">
          <div className="craft-section craft-section-card">''',
    '''      ) : (
        <>
          {recipe.item_preview ? (
            <div className="craft-section craft-section-card craft-forge-item-preview mt-3">
              <div className="craft-section-title">Pattern Item Details</div>
              <div className="craft-forge-flavor">{recipe.item_preview.flavor || recipe.item_preview.rules || "No catalog flavor text available."}</div>
              {recipe.item_preview.rules ? <div className="craft-forge-rules">{recipe.item_preview.rules}</div> : null}
              <div className="craft-forge-stat-grid">
                <div><span>Damage</span><strong>{recipe.item_preview.damage || "—"}</strong></div>
                <div><span>Range / AC</span><strong>{recipe.item_preview.range && recipe.item_preview.range !== "—" ? recipe.item_preview.range : recipe.item_preview.ac || "—"}</strong></div>
                <div><span>Properties</span><strong>{(recipe.item_preview.properties || []).join(", ") || "—"}</strong></div>
                <div><span>Cost</span><strong>{recipe.item_preview.cost_gp === "—" ? "—" : `${recipe.item_preview.cost_gp} gp`}</strong></div>
                <div><span>Weight</span><strong>{recipe.item_preview.weight_lb === "—" ? "—" : `${recipe.item_preview.weight_lb} lb`}</strong></div>
                <div><span>Type</span><strong>{titleCase(recipe.item_preview.family || recipe.item_preview.type || recipe.category)}</strong></div>
                <div><span>Source</span><strong>{recipe.item_preview.source || recipe.source || "—"}</strong></div>
              </div>
            </div>
          ) : null}
          {attemptPreview.temper_preview?.length ? (
            <div className="craft-section craft-section-card craft-temper-preview mt-3">
              <div className="craft-section-title">Elemental Temper Stack</div>
              {attemptPreview.temper_preview.map((temper) => (
                <div className="craft-temper-preview-row" key={`${temper.temper_stage}-${temper.inventory_item_id}`}>
                  <strong>Temper +{temper.temper_stage}: {titleCase(temper.element)}</strong>
                  <span>{temper.effect_summary}</span>
                </div>
              ))}
              <div className="craft-preview-chip-row mt-2"><span className="craft-chip craft-chip-gold">Stacked elemental bonus: {attemptPreview.temper_total_bonus_pct}% of base weapon damage</span></div>
            </div>
          ) : null}
          <div className="craft-preview-grid">
          <div className="craft-section craft-section-card">''',
    "rich physical preview start",
)
replace_once(
    '''          </div>
        </div>
      )}''',
    '''          </div>
        </div>
        </>
      )}''',
    "rich physical preview close",
)

# ---------------------------------------------------------------------------
# Load flavor, smithing catalog rows, and filter state/UI
# ---------------------------------------------------------------------------
replace_once(
    '''  const [alchemySection, setAlchemySection] = useState("All");
  const [alchemyGroup, setAlchemyGroup] = useState("All");''',
    '''  const [alchemySection, setAlchemySection] = useState("All");
  const [alchemyGroup, setAlchemyGroup] = useState("All");
  const [enchantingSection, setEnchantingSection] = useState("All");''',
    "enchanting state",
)
replace_once(
    '''const [authResponse, itemsJson, alchemyCatalogJson, coreVariants, hbVariants, dbRecipes,''',
    '''const [authResponse, itemsJson, flavorOverrides, alchemyCatalogJson, coreVariants, hbVariants, dbRecipes,''',
    "load destructuring",
)
replace_once(
    '''          json("/items/all-items.json", true),
          json("/items/alchemy-catalog.json"),''',
    '''          json("/items/all-items.json", true),
          json("/items/flavor-overrides.json"),
          json("/items/alchemy-catalog.json"),''',
    "load flavor file",
)
replace_once(
    '''          ...rows(itemsJson).filter(isForgeItem).map(forgeRecipe),''',
    '''          ...rows(itemsJson).filter(isForgeItem).map((item) => forgeRecipe(item, flavorOverrides || {})),''',
    "forge recipe flavor",
)
replace_once(
    '''        const dbAlchemyCatalogRows = rows(dbCatalogRows).filter((row) => row?.payload?.alchemy);''',
    '''        const dbAlchemyCatalogRows = rows(dbCatalogRows).filter((row) => row?.payload?.alchemy || row?.payload?.smithing);''',
    "load smithing catalog rows",
)

# Add enchanting counts before filtered recipes.
anchor = '''  const filteredRecipes = useMemo(() => recipes.filter((r) => {'''
insert = r'''  const enchantingSectionCounts = useMemo(() => {
    const counts = Object.fromEntries(ENCHANTING_SECTIONS.map((section) => [section, 0]));
    recipes.filter((recipe) => recipe.discipline === "Enchanting").forEach((recipe) => {
      counts.All += 1;
      enchantingSectionsForRecipe(recipe).forEach((section) => { counts[section] = (counts[section] || 0) + 1; });
    });
    return counts;
  }, [recipes]);
'''
if insert.strip() not in text:
    replace_once(anchor, insert + anchor, "enchanting counts")
replace_once(
    '''    const groupMatch = alchemyGroup === "All" || (r.discipline === "Alchemy" && alchemyGroupForRecipe(r) === alchemyGroup);''',
    '''    const groupMatch = alchemyGroup === "All" || (r.discipline === "Alchemy" && alchemyGroupForRecipe(r) === alchemyGroup);
    const enchantingMatch = enchantingSection === "All" || (r.discipline === "Enchanting" && enchantingSectionsForRecipe(r).includes(enchantingSection));''',
    "enchanting filter condition",
)
replace_once(
    '''    return disciplineMatch && sectionMatch && groupMatch && knowledgeMatch && rarityMatch && matches(r, query);''',
    '''    return disciplineMatch && sectionMatch && groupMatch && enchantingMatch && knowledgeMatch && rarityMatch && matches(r, query);''',
    "enchanting filter result",
)
replace_once(
    '''  }), [recipes, discipline, knowledge, rarityFilter, alchemySection, alchemyGroup, query]);''',
    '''  }), [recipes, discipline, knowledge, rarityFilter, alchemySection, alchemyGroup, enchantingSection, query]);''',
    "enchanting filter dependencies",
)

# Reset category state everywhere disciplines are changed or cleared.
text = text.replace('setAlchemySection("All"); setAlchemyGroup("All");', 'setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All");')
text = text.replace('setAlchemySection("All");\n      setAlchemyGroup("All");', 'setAlchemySection("All");\n      setAlchemyGroup("All");\n      setEnchantingSection("All");')

# Insert enchanting category bar immediately before the alchemy category bar.
alchemy_bar = '''            {discipline === "Alchemy" ? (
              <div className="craft-alchemy-section-shell">'''
enchanting_bar = '''            {discipline === "Enchanting" ? (
              <div className="craft-alchemy-section-shell craft-enchanting-section-shell">
                <div className="craft-alchemy-section-copy">
                  <strong>Enchanting Categories</strong>
                  <span>Filter traits by the physical item type they can be bound to.</span>
                </div>
                <div className="craft-alchemy-section-tabs">
                  {ENCHANTING_SECTIONS.map((section) => (
                    <button
                      key={section}
                      type="button"
                      className={cls("craft-alchemy-section-tab", "craft-enchanting-section-tab", enchantingSection === section && "active")}
                      onClick={() => { setEnchantingSection(section); setCraftingRecipeId(null); }}
                    >
                      <span>{section}</span><i>{enchantingSectionCounts[section] || 0}</i>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

'''
if enchanting_bar.strip() not in text:
    replace_once(alchemy_bar, enchanting_bar + alchemy_bar, "enchanting category bar")

# ---------------------------------------------------------------------------
# Styling
# ---------------------------------------------------------------------------
css = r'''

        /* Enchanting category bar, fantasy materials, tempering, and rich forge preview */
        .craft-enchanting-section-shell { border-color: rgba(167,139,250,.52); background: linear-gradient(135deg,rgba(103,58,183,.18),rgba(26,21,42,.95)); }
        .craft-enchanting-section-tab.active { border-color:#a78bfa; background:rgba(139,92,246,.25); box-shadow:0 0 0 1px rgba(167,139,250,.18) inset; }
        .craft-enchanting-section-tab i { background:rgba(167,139,250,.18); color:#e7dcff; }
        .craft-material-dual-effects { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; }
        .craft-material-dual-effects>div { min-width:0; padding:8px; border:1px solid rgba(255,255,255,.08); border-radius:9px; background:rgba(8,12,22,.38); }
        .craft-material-dual-effects strong,.craft-material-dual-effects span { display:block; }
        .craft-material-dual-effects strong { color:#ffd98a; font-size:10px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px; }
        .craft-material-dual-effects span { color:#e7dfed; font-size:11px; line-height:1.4; overflow-wrap:anywhere; }
        .craft-forge-item-preview { border-color:var(--workflow-border); background:linear-gradient(145deg,var(--workflow-soft),rgba(20,17,31,.92)); }
        .craft-forge-flavor { color:#fff8ff; padding:10px; border:1px solid rgba(255,214,115,.3); border-radius:9px; background:rgba(22,25,36,.72); line-height:1.45; }
        .craft-forge-rules { margin-top:9px; padding:10px; border:1px solid rgba(255,255,255,.1); border-radius:9px; background:rgba(35,40,53,.64); color:#ece7f5; white-space:pre-line; line-height:1.45; }
        .craft-forge-stat-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:10px; }
        .craft-forge-stat-grid>div { min-width:0; padding:8px 9px; border:1px dashed rgba(255,255,255,.11); border-radius:8px; background:rgba(15,19,29,.55); }
        .craft-forge-stat-grid span,.craft-forge-stat-grid strong { display:block; }
        .craft-forge-stat-grid span { color:#aca2bf; font-size:9px; text-transform:uppercase; letter-spacing:.07em; }
        .craft-forge-stat-grid strong { color:#fff; margin-top:3px; overflow-wrap:anywhere; }
        .craft-temper-preview { border-color:rgba(255,159,67,.45); background:linear-gradient(145deg,rgba(255,121,38,.12),rgba(25,20,34,.92)); }
        .craft-temper-preview-row { display:grid; gap:3px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.08); }
        .craft-temper-preview-row:last-of-type { border-bottom:0; }
        .craft-temper-preview-row strong { color:#ffd08a; }
        .craft-temper-preview-row span { color:#e7dfed; font-size:11px; line-height:1.4; }
        @media(max-width:760px){.craft-material-dual-effects,.craft-forge-stat-grid{grid-template-columns:1fr}}
'''
if 'Enchanting category bar, fantasy materials, tempering, and rich forge preview' not in text:
    marker = '\n\n    `}</style>'
    idx = text.rfind(marker)
    if idx < 0:
        raise RuntimeError("styled JSX close marker not found")
    text = text[:idx] + css + text[idx:]

# Static checks.
required = [
    'ENCHANTING_SECTIONS',
    'SMITHING_MATERIAL_CATALOG',
    'function temperMaterialSlotsForRecipe',
    'function elementalDamageTypeForMaterial',
    'craft-enchanting-section-shell',
    'Pattern Item Details',
    'Stacked elemental bonus',
    'flavor-overrides.json',
    'payload?.smithing',
]
for token in required:
    if token not in text:
        raise RuntimeError(f"verification token missing: {token}")

PATH.write_text(text)
print("Enchanting filters, fantasy materials, tempering stages, and rich forge preview applied.")

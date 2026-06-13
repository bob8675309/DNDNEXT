from pathlib import Path
import re

src = Path('pages/items.js')
out = src
text = src.read_text()


def replace_once(old, new, label):
    global text
    c = text.count(old)
    if c != 1:
        raise RuntimeError(f'{label}: expected 1, found {c}')
    text = text.replace(old, new, 1)


def insert_before(marker, addition, label):
    global text
    c = text.count(marker)
    if c != 1:
        raise RuntimeError(f'{label}: marker expected 1, found {c}')
    text = text.replace(marker, addition + marker, 1)

replace_once(
    'const ALCHEMY_SECTIONS = ["All", "Potions", "Poisons", "Bombs", "Elixirs", "Oils"];',
    '''const ALCHEMY_SECTIONS = ["All", "Potions", "Poisons", "Bombs", "Elixirs", "Oils"];
const ENCHANTING_SECTIONS = ["All", "Melee Weapon", "Ranged Weapon", "Ammo", "Armor", "Shield"];
const TEMPER_DAMAGE_TYPES = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];
const SMITHING_MATERIAL_CATALOG = [
  { name: "Mithral Ingot", category: "Ore / Metal", rarity: "Rare", dc: 2, materialClass: "Legendary Metal", offensive: "Lightens a weapon without weakening it. Heavy weapons become easier to ready, and agile weapon designs retain full strength.", defensive: "Halves the finished item's weight and removes normal Strength requirements and Stealth disadvantage caused by the armor.", risk: "Requires exact heat control; overheating ruins its flexibility." },
  { name: "Adamantine Bar", category: "Ore / Metal", rarity: "Very Rare", dc: 3, materialClass: "Legendary Metal", offensive: "Creates an exceptionally hard edge or striking face suited to sundering objects, armor, and reinforced structures.", defensive: "Reinforces armor and shields against catastrophic impacts and critical-hit deformation.", risk: "Extremely difficult to shape; failed work can damage tools or waste the stock." },
  { name: "Orichalcum Ingot", category: "Ore / Metal", rarity: "Very Rare", dc: 4, materialClass: "Legendary Metal", offensive: "Channels spell energy through the weapon, making it an excellent foundation for elemental and radiant tempering.", defensive: "Holds a stable arcane ward that improves resistance to magical strain and later enchantment binding.", risk: "Stored magic can discharge if the alloy is worked unevenly." },
  { name: "Cold Iron Ingot", category: "Ore / Metal", rarity: "Rare", dc: 3, materialClass: "Legendary Metal", offensive: "Its deep-forged edge disrupts fey glamour and planar protections.", defensive: "Dampens fey influence, charm effects, and hostile planar resonance around the wearer.", risk: "Never expose it to ordinary forge heat; it must be pressure-worked and rune-cooled." },
  { name: "Dragonhide", category: "Monster Part", rarity: "Very Rare", dc: 4, materialClass: "Organic & Botanical", offensive: "A dragon-derived grip, lash, bow limb, or striking surface can carry the damage type associated with the harvested dragon.", defensive: "Armor or shields retain a measure of the dragon's elemental resilience, keyed to the harvested dragon.", risk: "Mismatched essences can make the material brittle or violently reactive." },
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
    'constants'
)

old_forge = '''function forgeRecipe(item) {
  const name = item.name || item.item_name || "Unnamed Item";
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
    // Keep the source catalog row with the recipe. The live completion RPC uses
    // this snapshot to preserve AC, damage, range, weight, cost, source, and
    // properties when it creates the crafted inventory row.
    catalog_item: item,
    ac: item.ac ?? item?.armor?.ac ?? null,
    dmg1: item.dmg1 ?? item.damage1 ?? null,
    dmgType: item.dmgType ?? item.damageType ?? null,
    range: item.range ?? item.rangeText ?? null,
    property: item.property ?? item.properties ?? [],
    weight: item.weight ?? item.item_weight ?? null,
    cost: item.cost ?? item.value ?? item.item_cost ?? null,
    summary: `A blacksmith can craft a new mundane ${name}.`,
    requirements: ["Access to a smithy", `Pattern: ${name}`, "Material cost determined by the DM"],
    components: ["Metal, wood, leather, fletching, or ammunition stock as appropriate"],
  };
}'''
new_forge = r'''const FORGE_DAMAGE_TYPE_LABELS = { B: "bludgeoning", P: "piercing", S: "slashing", A: "acid", C: "cold", F: "fire", L: "lightning", N: "necrotic", R: "radiant", T: "thunder", Frc: "force", Psy: "psychic", Psn: "poison" };
const FORGE_PROPERTY_LABELS = { A: "Ammunition", F: "Finesse", H: "Heavy", L: "Light", LD: "Loading", R: "Reach", RLD: "Reload", S: "Special", T: "Thrown", "2H": "Two-Handed", V: "Versatile" };
function flattenForgeEntries(value) {
  const parts = [];
  const visit = (entry) => {
    if (!entry) return;
    if (typeof entry === "string") { parts.push(entry); return; }
    if (Array.isArray(entry)) { entry.forEach(visit); return; }
    if (entry.entry) visit(entry.entry);
    if (entry.entries) visit(entry.entries);
    if (entry.items) visit(entry.items);
  };
  visit(value);
  return parts.join("\n").trim();
}
function forgeCostGp(item = {}) {
  const explicit = Number(item.price_gp ?? item.cost_gp);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const copper = Number(item.value ?? item.cost?.amount ?? item.cost);
  return Number.isFinite(copper) ? copper / 100 : null;
}
function forgeRecipe(item, flavorOverrides = {}) {
  const name = item.name || item.item_name || "Unnamed Item";
  const itemType = typeFromCode(item.type || item.item_type);
  const family = familyFromItem(item);
  const propertyCodes = [].concat(item.property || item.properties || []).map((prop) => tag(typeof prop === "string" ? prop : prop?.uid || prop?.abbreviation || prop?.name || ""));
  const properties = propertyCodes.map((code) => FORGE_PROPERTY_LABELS[code] || code).filter(Boolean);
  const damageType = FORGE_DAMAGE_TYPE_LABELS[item.dmgType || item.damageType] || item.dmgType || item.damageType || "";
  const versatileDie = item.dmg2 || item.damage2 || null;
  const damage = item.dmg1 || item.damage1 ? `${item.dmg1 || item.damage1} ${damageType}${versatileDie ? `, versatile (${versatileDie})` : ""}`.trim() : null;
  const override = flavorOverrides?.[name] || flavorOverrides?.[String(name).toLowerCase()] || {};
  return {
    id: `forge:${name}:${item.type || item.item_type || ""}`,
    name: `Forge ${name}`,
    discipline: "Smithing",
    kind: "forge",
    category: itemType,
    family,
    rarity: "Mundane",
    known: false,
    source: item.source || "Catalog",
    catalog_item: item,
    ac: item.ac ?? item?.armor?.ac ?? null,
    dmg1: item.dmg1 ?? item.damage1 ?? null,
    dmgType: item.dmgType ?? item.damageType ?? null,
    range: item.range ?? item.rangeText ?? null,
    property: item.property ?? item.properties ?? [],
    weight: item.weight ?? item.item_weight ?? null,
    cost: item.cost ?? item.value ?? item.item_cost ?? null,
    item_preview: {
      name,
      itemType,
      family,
      flavor: override?.flavor || item.flavor || item.item_flavor || "",
      rules: item.item_description || item.rulesText || item.rulesShort || flattenForgeEntries(item.entries),
      damage,
      ac: item.ac ?? item?.armor?.ac ?? null,
      range: item.rangeText || item.range || ((item.range_normal && item.range_long) ? `${item.range_normal}/${item.range_long} ft.` : null),
      properties,
      mastery: [].concat(item.mastery || []).filter(Boolean),
      costGp: forgeCostGp(item),
      weightLb: item.weight ?? item.item_weight ?? null,
      source: item.source || item.item_source || "Catalog",
      image: item.image_url || item.img || item.image || "",
    },
    summary: `A blacksmith can craft a new mundane ${name}.`,
    requirements: ["Access to a smithy", `Pattern: ${name}`, "Material cost determined by the DM"],
    components: ["Metal, wood, leather, fletching, monster material, or ammunition stock as appropriate"],
  };
}'''
replace_once(old_forge, new_forge, 'forgeRecipe')

old_temper = '''function temperRecipes() {
  return [1, 2, 3].map((n) => ({
    id: `temper:+${n}`,
    name: `+${n} Temper`,
    discipline: "Smithing",
    kind: "temper",
    category: "weapon / armor / shield",
    family: "Temper",
    rarity: n === 1 ? "Uncommon" : n === 2 ? "Rare" : "Very Rare",
    known: false,
    source: "Town Smithing",
    summary: `Upgrade a physical weapon, armor, or shield to smith tier +${n}.`,
    requirements: ["Base physical item", `Smith capable of +${n} work`],
    components: ["Optional ore/material", "Optional monster-bit catalyst"],
  }));
}'''
new_temper = '''function temperRecipes() {
  return [1, 2, 3].map((n) => ({
    id: `temper:+${n}`,
    name: `+${n} Temper`,
    discipline: "Smithing",
    kind: "temper",
    temper_tier: n,
    category: "weapon / ammunition / armor / shield",
    family: "Temper",
    rarity: n === 1 ? "Uncommon" : n === 2 ? "Rare" : "Very Rare",
    known: false,
    source: "Town Smithing",
    summary: `Upgrade physical gear to smith tier +${n}. Weapons and ammunition may bind one elemental essence at each completed temper stage.`,
    requirements: ["Base physical item from the previous smith tier", `Smith capable of +${n} work`],
    components: ["One physical craft material", `Elemental essence or motes for Temper +1 through +${n} when tempering a weapon or ammunition`],
  }));
}'''
replace_once(old_temper, new_temper, 'temperRecipes')

replace_once(
    '''    category: appliesTo.join(" / "),
    family: appliesTo.includes("weapon") ? "Weapon" : appliesTo.map(titleCase).join(" / "),''',
    '''    category: appliesTo.join(" / "),
    family: appliesTo.includes("weapon") ? "Weapon" : appliesTo.map(titleCase).join(" / "),
    applies_to: appliesTo,''',
    'variant applies_to'
)

insert_before('function magicSignals(item) {', r'''function enchantingSectionsForRecipe(recipe = {}) {
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
''', 'enchanting helper')

out.write_text(text)
print('phase1 ok', len(text), text.count('\n')+1)

// pages/items.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const CATALOG_PATHS = {
  allItems: "/items/all-items.json",
  variants: [
    "/items/magicvariants.json",
    "/items/magicvariants.hb-armor-shield.json",
  ],
};

const RARITY_ORDER = ["Mundane", "Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
const PHYSICAL_VARIANT_KEYS = new Set(["enhancement", "adamantine", "mithral", "silvered", "ruidium"]);
const FORGEABLE_TYPE_CODES = new Set(["M", "R", "A", "LA", "MA", "HA", "S"]);
const DAMAGE_TYPES = {
  P: "piercing",
  S: "slashing",
  B: "bludgeoning",
  R: "radiant",
  N: "necrotic",
  F: "fire",
  C: "cold",
  L: "lightning",
  A: "acid",
  T: "thunder",
  Psn: "poison",
  Psy: "psychic",
  Frc: "force",
};

function normalizeText(value = "") {
  return String(value || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function slug(value = "") {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "recipe";
}

function titleCase(value = "") {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stripCatalogTag(value = "") {
  return String(value || "").split("|")[0].trim();
}

function normalizeRarity(value = "") {
  const text = normalizeText(value);
  if (!text || text === "none" || text === "mundane") return "Mundane";
  if (text.includes("legend")) return "Legendary";
  if (text.includes("very")) return "Very Rare";
  if (text.includes("rare")) return "Rare";
  if (text.includes("uncommon")) return "Uncommon";
  if (text.includes("common")) return "Common";
  return titleCase(value);
}

function rarityRank(value) {
  const rarity = normalizeRarity(value);
  const idx = RARITY_ORDER.indexOf(rarity);
  return idx >= 0 ? idx : 0;
}

async function loadJson(path, { optional = false } = {}) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}

function getPayload(item) {
  return item?.card_payload && typeof item.card_payload === "object" ? item.card_payload : item || {};
}

function getItemName(item) {
  const payload = getPayload(item);
  return String(item?.item_name || item?.name || payload.item_name || payload.name || "").trim();
}

function getItemTypeCode(item) {
  const payload = getPayload(item);
  return stripCatalogTag(item?.type || item?.item_type || payload.type || payload.item_type || "").toUpperCase();
}

function getItemUiType(item) {
  const payload = getPayload(item);
  return String(item?.uiType || item?.rawType || item?.item_type || payload.uiType || payload.rawType || payload.item_type || payload.type || item?.type || "");
}

function getPropCodes(item) {
  const payload = getPayload(item);
  const raw = []
    .concat(item?.property || item?.properties || [])
    .concat(payload.property || payload.properties || []);
  const codes = raw
    .map((prop) => (typeof prop === "string" ? prop : prop?.uid || prop?.abbreviation || prop?.abbrev || ""))
    .map(stripCatalogTag)
    .filter(Boolean);

  const text = [item?.propertiesText, payload.propertiesText].filter(Boolean).join(" ").toLowerCase();
  if (text.includes("thrown")) codes.push("T");
  if (text.includes("ammunition")) codes.push("A");
  if (text.includes("finesse")) codes.push("F");
  if (text.includes("two-handed") || /\b2h\b/i.test(text)) codes.push("2H");

  return Array.from(new Set(codes));
}

function buildDamageText(item) {
  const payload = getPayload(item);
  const props = getPropCodes(item);
  const dmg1 = item?.dmg1 || payload.dmg1;
  const dmg2 = item?.dmg2 || payload.dmg2;
  const dmgType = item?.dmgType || payload.dmgType;
  const base = dmg1 ? `${dmg1} ${DAMAGE_TYPES[dmgType] || dmgType || ""}`.trim() : "";
  const versatile = props.includes("V") && dmg2 ? `versatile (${dmg2})` : "";
  return [base, versatile].filter(Boolean).join("; ");
}

function buildRangeText(item) {
  const payload = getPayload(item);
  const props = getPropCodes(item);
  const range = item?.rangeText || payload.rangeText || item?.range || payload.range || "";
  const clean = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if (props.includes("T")) return clean ? `Thrown ${clean} ft.` : "Thrown";
  return clean ? `${clean} ft.` : "";
}

function workshopFamilyForItem(item) {
  const name = getItemName(item).toLowerCase();
  const ui = getItemUiType(item).toLowerCase();
  const code = getItemTypeCode(item);
  const props = getPropCodes(item);

  if (code === "S" || code === "SH" || ui.includes("shield")) return "Shield";
  if (code === "A" || ui.includes("ammunition")) return "Ammunition";
  if (["LA", "MA", "HA"].includes(code) || /armor|armour/.test(ui)) return "Armor";
  if (props.includes("T")) return "Thrown";
  if (code === "R" || /ranged/.test(ui) || /(bow|crossbow|sling|blowgun)/.test(name)) return "Ranged";
  if (code === "M" || /melee/.test(ui) || buildDamageText(item)) return "Melee";
  return "Gear";
}

function isFutureOrModernItem(item) {
  const payload = getPayload(item);
  const blob = [getItemUiType(item), getItemName(item), payload.source, item?.source]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /future|modern|futuristic|antimatter|laser|automatic\s+(pistol|rifle)|\b(pistol|musket|rifle|revolver|shotgun|carbine)\b|firearm\s+(bullet|needle|ammunition)|hunting rifle|modern rifle|alien firearm/.test(blob);
}

function hasMagicSignals(item) {
  const payload = getPayload(item);
  const nameBlob = [getItemName(item), payload.baseItem].filter(Boolean).join(" ").toLowerCase();
  const textBlob = [
    item?.attunementText,
    payload.attunementText,
    item?.tier,
    payload.tier,
    item?.rarity,
    payload.rarity,
    item?.item_description,
    payload.item_description,
  ].filter(Boolean).join(" ").toLowerCase();

  return Boolean(
    item?.wondrous || payload.wondrous || item?.reqAttune || payload.reqAttune ||
    item?.reqAttuneTags || payload.reqAttuneTags || item?.bonusWeapon || payload.bonusWeapon ||
    item?.bonusAc || payload.bonusAc || item?.attachedSpells || payload.attachedSpells ||
    item?.charges || payload.charges || item?.recharge || payload.recharge ||
    item?.curse || payload.curse || item?.sentient || payload.sentient ||
    /^\s*\+\d+\b/.test(nameBlob) ||
    /\b(awakened|exalted|dormant|slumbering|stirring|ascendant)\b/.test(nameBlob) ||
    /\b(of warning|of slaying|of resistance|dragon's wrath|flame tongue|vorpal|vicious|defender|holy avenger|nine lives stealer|berserker|dancing|wounding|life stealing|sharpness|moon-touched|moon touched|walloping|winged|drow \+)\b/.test(nameBlob) ||
    /\b(requires attunement|attunement|magic weapon|magic armor|artifact)\b/.test(textBlob)
  );
}

function isForgeableMundaneTemplate(item) {
  if (!item || typeof item !== "object") return false;
  const name = getItemName(item);
  if (!name) return false;
  const rarity = normalizeRarity(item?.rarity || item?.item_rarity || getPayload(item).rarity || getPayload(item).item_rarity);
  if (rarity !== "Mundane") return false;
  const code = getItemTypeCode(item);
  if (code && !FORGEABLE_TYPE_CODES.has(code)) return false;
  if (isFutureOrModernItem(item)) return false;
  if (hasMagicSignals(item)) return false;
  return ["Melee", "Ranged", "Thrown", "Armor", "Shield", "Ammunition"].includes(workshopFamilyForItem(item));
}

function rowsFromAllItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.item)) return data.item;
  return [];
}

function extractVariantRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.variants)) return data.variants;
  if (Array.isArray(data?.magicvariants)) return data.magicvariants;
  return [];
}

function normalizeVariant(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim();
  if (!name) return null;
  const key = String(raw.key || name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const appliesTo = Array.isArray(raw.appliesTo) && raw.appliesTo.length
    ? raw.appliesTo.map((entry) => String(entry).toLowerCase())
    : ["weapon", "armor", "shield", "ammunition"];
  return {
    ...raw,
    key,
    name,
    displayName: name.replace(/^Sword of\b/i, "Weapon of"),
    rarity: normalizeRarity(raw.rarity || (raw.rarityByValue ? "varies" : "")),
    appliesTo,
    entries: Array.isArray(raw.entries) ? raw.entries : raw.entries ? [String(raw.entries)] : [],
    options: Array.isArray(raw.options) ? raw.options : [],
    requires: raw.requires && typeof raw.requires === "object" ? raw.requires : null,
    textByKind: raw.textByKind && typeof raw.textByKind === "object" ? raw.textByKind : {},
    attunement: !!raw.attunement,
    cursed: !!raw.cursed,
  };
}

function slotForRarity(rarity) {
  switch (normalizeRarity(rarity)) {
    case "Uncommon": return "Slot A";
    case "Rare": return "Slot B";
    case "Very Rare": return "Slot C";
    case "Legendary": return "Future Slot D";
    default: return "—";
  }
}

function recipeSearchText(recipe) {
  return [
    recipe.name,
    recipe.type,
    recipe.service,
    recipe.category,
    recipe.rarity,
    recipe.slot,
    recipe.appliesTo,
    recipe.requirements,
    recipe.description,
    recipe.ingredientsText,
  ].filter(Boolean).join(" ").toLowerCase();
}

function buildRecipeCatalog({ allItems = [], variants = [], dbRecipes = [], knownIds = new Set(), knownNames = new Set() }) {
  const recipes = [];
  const seen = new Set();
  const push = (recipe) => {
    const id = recipe.id || `${recipe.type}:${slug(recipe.name)}`;
    if (seen.has(id)) return;
    seen.add(id);
    recipes.push({
      ...recipe,
      id,
      known: !!recipe.known || knownIds.has(id) || knownNames.has(normalizeText(recipe.name)),
      searchText: "",
    });
  };

  rowsFromAllItems(allItems)
    .filter(isForgeableMundaneTemplate)
    .forEach((item) => {
      const family = workshopFamilyForItem(item);
      const name = getItemName(item);
      push({
        id: `forge:${slug(name)}`,
        name: `Forge ${name}`,
        resultName: name,
        type: "Forge",
        service: "Blacksmith",
        category: family,
        rarity: "Mundane",
        slot: "—",
        appliesTo: family,
        requirements: "Blacksmith forge pattern",
        ingredientsText: "Mundane smithing stock, tools, time, optional physical material/catalyst",
        description: `Create a fresh mundane ${family.toLowerCase()} template that can later be tempered or enchanted.`,
        source: item.source || getPayload(item).source || "Catalog",
      });
    });

  [1, 2, 3].forEach((tier) => {
    push({
      id: `temper:+${tier}`,
      name: `Temper to +${tier}`,
      resultName: `+${tier} item`,
      type: "Temper",
      service: "Blacksmith",
      category: "Weapon / Armor / Shield",
      rarity: tier === 1 ? "Uncommon" : tier === 2 ? "Rare" : "Very Rare",
      slot: `Smith Tier +${tier}`,
      appliesTo: "Weapons, armor, shields",
      requirements: tier === 1 ? "Mundane physical gear" : `Previously tiered or eligible gear, upgraded to +${tier}`,
      ingredientsText: "Base item, forge access, optional material/catalyst",
      description: `Smith-controlled physical enhancement. This is the +N/tier foundation enchanters require before adding A/B/C traits.`,
      source: "Town crafting rules",
    });
  });

  variants.map(normalizeVariant).filter(Boolean).forEach((variant) => {
    const physical = PHYSICAL_VARIANT_KEYS.has(variant.key);
    const type = physical ? "Material" : "Enchantment";
    const service = physical ? "Blacksmith" : "Enchanter";
    const appliesTo = variant.appliesTo.map(titleCase).join(", ");
    const optionText = variant.options.length ? ` Options: ${variant.options.map(titleCase).join(", ")}.` : "";
    const requirements = [];
    if (variant.requires?.weaponFamily?.length) requirements.push(`Weapon family: ${variant.requires.weaponFamily.map(titleCase).join(" or ")}`);
    if (variant.requires?.damageType?.length) requirements.push(`Damage: ${variant.requires.damageType.map(titleCase).join(" or ")}`);
    if (variant.requires?.armorWeight?.length) requirements.push(`Armor weight: ${variant.requires.armorWeight.map(titleCase).join(" or ")}`);
    if (/vorpal/i.test(`${variant.key} ${variant.name}`)) requirements.push("Requires +3");
    const text = variant.entries.join(" ") || Object.values(variant.textByKind || {}).join(" ") || "Magical trait recipe.";

    push({
      id: `${type.toLowerCase()}:${variant.key}`,
      name: variant.displayName || variant.name,
      resultName: variant.displayName || variant.name,
      type,
      service,
      category: appliesTo || "Any",
      rarity: variant.rarity === "Varies" ? "Common" : variant.rarity || "Common",
      slot: physical ? "Smith material" : slotForRarity(variant.rarity),
      appliesTo,
      requirements: requirements.join(" • ") || (physical ? "Physical material workflow" : "Tiered item and matching category"),
      ingredientsText: physical ? "Appropriate physical material and base item" : "Tiered base item, optional catalysts, arcane service",
      description: `${text}${optionText}`,
      source: variant.source || "Magic variants",
      attunement: variant.attunement,
      cursed: variant.cursed,
    });
  });

  (dbRecipes || []).forEach((row) => {
    const ingredients = Array.isArray(row.ingredients)
      ? row.ingredients.map((ing) => typeof ing === "string" ? ing : `${ing?.name || "Ingredient"}${ing?.quantity ? ` x${ing.quantity}` : ""}`).join(", ")
      : row.ingredients && typeof row.ingredients === "object"
        ? Object.entries(row.ingredients).map(([key, value]) => `${titleCase(key)}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join(" • ")
        : "Ingredients not recorded yet";
    push({
      id: row.id,
      name: row.name || "Unnamed recipe",
      resultName: row.name || "Recipe",
      type: "Alchemy",
      service: "Alchemy / Recipe Table",
      category: "Potion / Reagent",
      rarity: normalizeRarity(row.rarity || row.difficulty || "Common"),
      slot: "Known Recipe Table",
      appliesTo: "Consumables, herbs, reagents",
      requirements: "Recipe record in Supabase",
      ingredientsText: ingredients,
      description: row.description || "A discovered or table-authored crafting recipe.",
      source: "Supabase recipes",
      known: knownIds.has(row.id),
    });
  });

  return recipes
    .map((recipe) => ({ ...recipe, searchText: recipeSearchText(recipe) }))
    .sort((a, b) => {
      const typeSort = String(a.type).localeCompare(String(b.type));
      if (typeSort) return typeSort;
      const raritySort = rarityRank(a.rarity) - rarityRank(b.rarity);
      if (raritySort) return raritySort;
      return String(a.name).localeCompare(String(b.name));
    });
}

function classifyMaterial(item) {
  const payload = getPayload(item);
  const blob = [item?.item_name, item?.item_type, item?.item_rarity, payload.item_type, payload.type, payload.uiType, payload.name, payload.flavor]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(ore|ingot|bar|adamant|mithral|silver|silvered|ruidium|cold iron|obsidian|steel|iron|copper|tin|bronze|metal)/.test(blob)) return "Ore / Metal";
  if (/(fang|claw|eye|horn|scale|hide|bone|tooth|heart|gland|venom|ichor|blood|carapace|chitin|feather|monster)/.test(blob)) return "Monster Part";
  if (/(catalyst|rune|sigil|essence|dust|shard|crystal|core|resin|ink|oil)/.test(blob)) return "Catalyst";
  if (/(herb|plant|root|leaf|moss|flower|mushroom|spore|reagent|alchem|potion ingredient)/.test(blob)) return "Reagent / Herb";
  if (/(gem|jewel|ruby|sapphire|emerald|diamond|opal|quartz|amethyst|pearl|topaz|garnet|jade)/.test(blob)) return "Gem / Focus";
  return "Other";
}

function looksLikeCraftingMaterial(item) {
  return classifyMaterial(item) !== "Other";
}

function groupMaterials(inventoryRows = [], plantRows = []) {
  const byKey = new Map();
  const add = (entry) => {
    const key = `${entry.category}:${normalizeText(entry.name)}`;
    const existing = byKey.get(key) || { ...entry, quantity: 0, sources: new Set() };
    existing.quantity += Number(entry.quantity || 1);
    if (entry.source) existing.sources.add(entry.source);
    byKey.set(key, existing);
  };

  inventoryRows.filter(looksLikeCraftingMaterial).forEach((item) => {
    add({
      name: item.item_name || item.item_id || "Unknown material",
      category: classifyMaterial(item),
      rarity: normalizeRarity(item.item_rarity || getPayload(item).rarity || ""),
      quantity: 1,
      source: "Inventory",
      description: item.item_description || getPayload(item).flavor || "Inventory-held crafting material.",
    });
  });

  plantRows.forEach((row) => {
    const plant = row.plants || row.plant || {};
    add({
      name: plant.name || row.name || "Unknown plant",
      category: "Reagent / Herb",
      rarity: normalizeRarity(plant.rarity || row.rarity || "Common"),
      quantity: row.quantity || 1,
      source: "Gathered plants",
      description: [plant.effect, plant.found_in ? `Found in ${plant.found_in}.` : ""].filter(Boolean).join(" ") || "Gathered plant reagent.",
    });
  });

  return Array.from(byKey.values())
    .map((entry) => ({ ...entry, sources: Array.from(entry.sources || []).join(", ") }))
    .sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name)));
}

function FilterPill({ active, children, onClick }) {
  return (
    <button type="button" className={`craft-pill ${active ? "active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function StatCard({ label, value, note }) {
  return (
    <div className="craft-stat-card">
      <div className="craft-eyebrow">{label}</div>
      <div className="craft-stat-value">{value}</div>
      {note ? <div className="craft-muted">{note}</div> : null}
    </div>
  );
}

function RecipeCard({ recipe }) {
  return (
    <article className={`recipe-card ${recipe.known ? "known" : ""}`}>
      <div className="recipe-card-head">
        <div>
          <div className="craft-eyebrow">{recipe.service}</div>
          <h3>{recipe.name}</h3>
        </div>
        <span className={`known-badge ${recipe.known ? "yes" : ""}`}>{recipe.known ? "Known" : "Reference"}</span>
      </div>
      <div className="recipe-tags">
        <span>{recipe.type}</span>
        <span>{recipe.rarity || "—"}</span>
        <span>{recipe.slot || "—"}</span>
      </div>
      <p className="recipe-desc">{recipe.description || "No recipe description recorded yet."}</p>
      <div className="recipe-grid-mini">
        <div><strong>Applies:</strong><br />{recipe.appliesTo || "—"}</div>
        <div><strong>Requires:</strong><br />{recipe.requirements || "—"}</div>
        <div><strong>Ingredients:</strong><br />{recipe.ingredientsText || "—"}</div>
        <div><strong>Source:</strong><br />{recipe.source || "—"}</div>
      </div>
      {(recipe.attunement || recipe.cursed) ? (
        <div className="recipe-flags">
          {recipe.attunement ? <span>Requires attunement</span> : null}
          {recipe.cursed ? <span>Cursed</span> : null}
        </div>
      ) : null}
    </article>
  );
}

function MaterialCard({ material }) {
  return (
    <article className="material-card">
      <div className="material-top">
        <div>
          <div className="craft-eyebrow">{material.category}</div>
          <h3>{material.name}</h3>
        </div>
        <span className="material-qty">×{material.quantity}</span>
      </div>
      <div className="recipe-tags">
        <span>{material.rarity || "—"}</span>
        <span>{material.sources || "Inventory"}</span>
      </div>
      <p>{material.description || "Crafting material."}</p>
    </article>
  );
}

export default function CraftingRecipesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [knownFilter, setKnownFilter] = useState("All");
  const [rarityFilter, setRarityFilter] = useState("All");

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const [{ data: authData }, allItems, ...variantPayloads] = await Promise.all([
          supabase.auth.getSession(),
          loadJson(CATALOG_PATHS.allItems, { optional: true }),
          ...CATALOG_PATHS.variants.map((path, index) => loadJson(path, { optional: index > 0 })),
        ]);

        const user = authData?.session?.user || null;
        let inventoryRows = [];
        let playerRows = [];
        let plantRows = [];
        let dbRecipes = [];
        let knownRows = [];

        if (user?.id) {
          const { data: inv, error: invErr } = await supabase
            .from("inventory_items")
            .select("id,user_id,item_id,item_name,item_type,item_rarity,item_description,item_weight,item_cost,card_payload,owner_type,owner_id,is_equipped")
            .eq("user_id", user.id)
            .or("owner_type.is.null,owner_type.eq.player")
            .order("item_name", { ascending: true });
          if (invErr) console.warn("crafting inventory load skipped", invErr.message);
          inventoryRows = inv || [];

          const { data: players, error: playerErr } = await supabase
            .from("players")
            .select("id,name,user_id")
            .eq("user_id", user.id);
          if (playerErr) console.warn("player profile load skipped", playerErr.message);
          playerRows = players || [];
        }

        const { data: recipeRows, error: recipeErr } = await supabase
          .from("recipes")
          .select("id,name,description,ingredients,created_at")
          .order("name", { ascending: true });
        if (recipeErr) console.warn("recipes table load skipped", recipeErr.message);
        dbRecipes = recipeRows || [];

        const playerId = playerRows?.[0]?.id;
        if (playerId) {
          const [{ data: known, error: knownErr }, { data: plants, error: plantsErr }] = await Promise.all([
            supabase.from("player_recipes").select("recipe_id,discovered_at").eq("player_id", playerId),
            supabase.from("player_plants").select("plant_id,quantity,last_gathered_at,plants(name,rarity,found_in,effect,roll)").eq("player_id", playerId),
          ]);
          if (knownErr) console.warn("known recipes load skipped", knownErr.message);
          if (plantsErr) console.warn("player plants load skipped", plantsErr.message);
          knownRows = known || [];
          plantRows = plants || [];
        }

        const knownIds = new Set((knownRows || []).map((row) => row.recipe_id).filter(Boolean));
        const knownNames = new Set(
          (dbRecipes || [])
            .filter((recipe) => knownIds.has(recipe.id))
            .map((recipe) => normalizeText(recipe.name))
        );
        const variants = variantPayloads.flatMap((payload) => extractVariantRows(payload));
        const builtRecipes = buildRecipeCatalog({ allItems, variants, dbRecipes, knownIds, knownNames });
        const materialRows = groupMaterials(inventoryRows, plantRows);

        if (!alive) return;
        setRecipes(builtRecipes);
        setMaterials(materialRows);
      } catch (err) {
        console.error("Crafting recipes page failed", err);
        if (alive) setError(err?.message || "Failed to load crafting recipes.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => { alive = false; };
  }, []);

  const types = useMemo(() => ["All", ...Array.from(new Set(recipes.map((r) => r.type))).sort(), "Materials"], [recipes]);
  const rarities = useMemo(() => ["All", ...RARITY_ORDER.filter((rarity) => recipes.some((r) => normalizeRarity(r.rarity) === rarity))], [recipes]);

  const visibleRecipes = useMemo(() => {
    const needle = normalizeText(query);
    return recipes.filter((recipe) => {
      if (typeFilter !== "All" && typeFilter !== "Materials" && recipe.type !== typeFilter) return false;
      if (knownFilter === "Known" && !recipe.known) return false;
      if (knownFilter === "Reference" && recipe.known) return false;
      if (rarityFilter !== "All" && normalizeRarity(recipe.rarity) !== rarityFilter) return false;
      if (needle && !recipe.searchText.includes(needle)) return false;
      return true;
    });
  }, [recipes, query, typeFilter, knownFilter, rarityFilter]);

  const visibleMaterials = useMemo(() => {
    const needle = normalizeText(query);
    if (typeFilter !== "Materials") return [];
    return materials.filter((material) => {
      const hay = [material.name, material.category, material.rarity, material.description, material.sources].filter(Boolean).join(" ").toLowerCase();
      if (rarityFilter !== "All" && normalizeRarity(material.rarity) !== rarityFilter) return false;
      return !needle || hay.includes(needle);
    });
  }, [materials, query, typeFilter, rarityFilter]);

  const knownCount = recipes.filter((recipe) => recipe.known).length;
  const enchantCount = recipes.filter((recipe) => recipe.type === "Enchantment").length;
  const materialQty = materials.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <main className="craft-page">
      <section className="craft-hero">
        <div>
          <div className="craft-eyebrow">Crafting archive</div>
          <h1>Recipes, Enchants & Reagents</h1>
          <p>
            A searchable campaign crafting reference for forge patterns, smith tempers, magical enchantments,
            alchemy records, known recipes, and player-held crafting materials.
          </p>
        </div>
        <div className="craft-stat-grid">
          <StatCard label="Recipes indexed" value={recipes.length} note="Forge, temper, enchant, alchemy" />
          <StatCard label="Known recipes" value={knownCount} note="From player_recipes where available" />
          <StatCard label="Enchantments" value={enchantCount} note="Core + HB armor/shield catalogs" />
          <StatCard label="Owned materials" value={materialQty} note="Inventory + gathered plants" />
        </div>
      </section>

      <section className="craft-controls">
        <div className="input-group craft-search">
          <span className="input-group-text">Search</span>
          <input
            className="form-control"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search flame tongue, mithral, potion, shield wall, fang, ore..."
          />
          <button className="btn btn-outline-light" type="button" onClick={() => setQuery("")} disabled={!query}>Clear</button>
        </div>

        <div className="craft-filter-row">
          {types.map((type) => (
            <FilterPill key={type} active={typeFilter === type} onClick={() => setTypeFilter(type)}>{type}</FilterPill>
          ))}
        </div>
        <div className="craft-filter-row compact">
          {["All", "Known", "Reference"].map((entry) => (
            <FilterPill key={entry} active={knownFilter === entry} onClick={() => setKnownFilter(entry)}>{entry}</FilterPill>
          ))}
          {rarities.map((rarity) => (
            <FilterPill key={rarity} active={rarityFilter === rarity} onClick={() => setRarityFilter(rarity)}>{rarity}</FilterPill>
          ))}
        </div>
      </section>

      {error ? <div className="alert alert-danger craft-alert">{error}</div> : null}
      {loading ? <div className="craft-loading">Loading crafting archive...</div> : null}

      {!loading && typeFilter === "Materials" ? (
        <section className="material-grid">
          {visibleMaterials.length ? visibleMaterials.map((material) => <MaterialCard key={`${material.category}-${material.name}`} material={material} />) : (
            <div className="craft-empty">No owned reagents, ores, monster parts, catalysts, or plants matched this filter.</div>
          )}
        </section>
      ) : null}

      {!loading && typeFilter !== "Materials" ? (
        <section className="recipe-grid">
          {visibleRecipes.length ? visibleRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />) : (
            <div className="craft-empty">No recipes matched this filter.</div>
          )}
        </section>
      ) : null}

      <section className="craft-roadmap-note">
        <div className="craft-eyebrow">Next integration point</div>
        <p>
          Discovery is read-ready through the existing <code>recipes</code>, <code>player_recipes</code>,
          <code>plants</code>, and <code>player_plants</code> tables. The next pass can add admin/player actions:
          discover recipe, grant recipe, gather reagent, consume ingredients, and alchemy crafting resolution.
        </p>
      </section>

      <style jsx>{`
        .craft-page {
          min-height: calc(100vh - 58px);
          padding: 2rem clamp(1rem, 3vw, 3rem) 4rem;
          color: #f5edff;
          background:
            radial-gradient(circle at top left, rgba(117, 76, 189, 0.24), transparent 34rem),
            radial-gradient(circle at top right, rgba(32, 140, 164, 0.13), transparent 28rem),
            #10081b;
        }
        .craft-hero,
        .craft-controls,
        .craft-roadmap-note {
          max-width: 1180px;
          margin: 0 auto 1rem;
          border: 1px solid rgba(182, 145, 255, 0.22);
          background: linear-gradient(135deg, rgba(30, 18, 48, 0.96), rgba(18, 13, 31, 0.96));
          border-radius: 20px;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.36);
        }
        .craft-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr);
          gap: 1.25rem;
          padding: 1.35rem;
        }
        .craft-hero h1 {
          margin: 0.2rem 0 0.65rem;
          font-size: clamp(2rem, 4vw, 3.7rem);
          font-weight: 900;
          letter-spacing: -0.06em;
        }
        .craft-hero p,
        .craft-roadmap-note p,
        .recipe-desc,
        .material-card p {
          color: #cfc3df;
          line-height: 1.55;
        }
        .craft-eyebrow {
          color: #8ed8ff;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }
        .craft-muted {
          color: #a99bbb;
          font-size: 0.82rem;
        }
        .craft-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }
        .craft-stat-card,
        .recipe-card,
        .material-card {
          border: 1px solid rgba(182, 145, 255, 0.18);
          background: rgba(35, 24, 55, 0.82);
          border-radius: 16px;
          padding: 1rem;
        }
        .craft-stat-value {
          font-size: 1.9rem;
          font-weight: 900;
          color: #fff;
        }
        .craft-controls {
          padding: 1rem;
        }
        .craft-search :global(.input-group-text),
        .craft-search :global(.form-control) {
          color: #f4edff;
          border-color: rgba(182, 145, 255, 0.32);
          background: rgba(22, 14, 36, 0.96);
        }
        .craft-search :global(.form-control::placeholder) {
          color: #9384aa;
        }
        .craft-filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.85rem;
        }
        .craft-filter-row.compact {
          margin-top: 0.5rem;
        }
        .craft-pill {
          border: 1px solid rgba(182, 145, 255, 0.26);
          color: #dacfff;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 999px;
          padding: 0.38rem 0.75rem;
          font-weight: 700;
          font-size: 0.86rem;
        }
        .craft-pill.active {
          color: #fff;
          border-color: rgba(255, 206, 122, 0.85);
          background: linear-gradient(135deg, rgba(116, 75, 184, 0.9), rgba(76, 51, 121, 0.92));
          box-shadow: 0 0 0 2px rgba(255, 206, 122, 0.08) inset;
        }
        .recipe-grid,
        .material-grid {
          max-width: 1180px;
          margin: 1rem auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(315px, 1fr));
          gap: 1rem;
        }
        .recipe-card,
        .material-card {
          background: linear-gradient(160deg, rgba(35, 24, 55, 0.98), rgba(20, 14, 35, 0.98));
          min-height: 250px;
        }
        .recipe-card.known {
          border-color: rgba(64, 217, 148, 0.44);
          box-shadow: 0 0 0 1px rgba(64, 217, 148, 0.08) inset;
        }
        .recipe-card-head,
        .material-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .recipe-card h3,
        .material-card h3 {
          margin: 0.2rem 0 0;
          font-size: 1.1rem;
          line-height: 1.25;
          font-weight: 900;
        }
        .known-badge,
        .material-qty {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 0.28rem 0.55rem;
          color: #c8badb;
          border: 1px solid rgba(182, 145, 255, 0.22);
          background: rgba(255, 255, 255, 0.06);
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
        }
        .known-badge.yes {
          color: #c9ffe4;
          border-color: rgba(64, 217, 148, 0.46);
          background: rgba(64, 217, 148, 0.12);
        }
        .recipe-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin: 0.8rem 0;
        }
        .recipe-tags span,
        .recipe-flags span {
          border-radius: 999px;
          padding: 0.25rem 0.5rem;
          color: #efe8ff;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(182, 145, 255, 0.18);
          font-size: 0.74rem;
          font-weight: 700;
        }
        .recipe-grid-mini {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
          color: #cfc3df;
          font-size: 0.86rem;
        }
        .recipe-grid-mini div {
          background: rgba(11, 7, 20, 0.38);
          border-radius: 12px;
          padding: 0.62rem;
          border: 1px solid rgba(182, 145, 255, 0.12);
        }
        .recipe-flags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-top: 0.75rem;
        }
        .craft-alert,
        .craft-loading,
        .craft-empty {
          max-width: 1180px;
          margin: 1rem auto;
        }
        .craft-loading,
        .craft-empty {
          color: #cfc3df;
          padding: 1rem;
          border-radius: 16px;
          border: 1px solid rgba(182, 145, 255, 0.18);
          background: rgba(35, 24, 55, 0.75);
        }
        .craft-roadmap-note {
          padding: 1rem;
          margin-top: 1.25rem;
        }
        .craft-roadmap-note code {
          color: #ffd98a;
          margin: 0 0.18rem;
        }
        @media (max-width: 800px) {
          .craft-hero {
            grid-template-columns: 1fr;
          }
          .craft-stat-grid,
          .recipe-grid-mini {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

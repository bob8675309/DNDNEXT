// Shared client-side campaign loot/merchant eligibility helpers.
// SQL mirrors live in the campaign item-pool migration so RPC and fallback rerolls agree.

function text(value = "") { return String(value ?? "").trim(); }
function sourceOf(item = {}) { return text(item.source || item.item_source || item?.payload?.source || item?.card_payload?.source).toUpperCase(); }
function itemName(item = {}) { return text(item.item_name || item.name || item.display_name || item?.payload?.item_name || item?.card_payload?.item_name); }
function itemType(item = {}) { return text(item.item_type || item.uiType || item?.payload?.item_type || item?.payload?.uiType || item?.card_payload?.item_type); }
function merchantTags(item = {}) {
  const raw = item.merchant_tags || item.merchantTags || item?.payload?.merchant_tags || [];
  return Array.isArray(raw) ? raw.map((value) => text(value).toLowerCase()).filter(Boolean) : [];
}

export function isFutureTechItem(item = {}) {
  const name = itemName(item).toLowerCase();
  const type = itemType(item).toLowerCase();
  const age = text(item.age || item.age_category || item.age_group || item?.payload?.age).toLowerCase();
  const properties = item.property || item.properties || item?.payload?.property || item?.card_payload?.property || [];
  const propCodes = Array.isArray(properties) ? properties.map((value) => text(typeof value === "string" ? value.split("|")[0] : value?.name)) : [];
  if (type === "future" || propCodes.includes("AF")) return true;
  if (["futuristic", "modern", "contemporary", "industrial", "victorian", "renaissance"].includes(age)) return true;
  if (/\b(pistol|rifle|musket|revolver|firearm|shotgun|smg|carbine)\b/i.test(name)) return true;
  if (/\b(antimatter|laser|grenade launcher|fragmentation grenade|concussion grenade|sleep grenade|smoke grenade|needler pistol|paralysis pistol|powered armor|robot controller|antigravity belt|spaceship trinket|energy cell)\b/i.test(name)) return true;
  return false;
}

export function isSettingSpecificLootItem(item = {}) {
  const name = itemName(item);
  const type = itemType(item).toLowerCase();
  const rarity = text(item.item_rarity || item.rarity || item?.payload?.item_rarity || item?.payload?.rarity).toLowerCase();
  const price = Number(item.price_gp ?? item?.payload?.price_gp ?? 0);
  return /\btrinket\b/i.test(name)
    && /adventuring gear|gear/.test(type)
    && (!rarity || rarity === "none" || rarity === "mundane" || rarity === "common")
    && (!Number.isFinite(price) || price <= 1);
}

export function isProgressionStateVariant(item = {}) {
  return /\((?:dormant|awakened|exalted)\)\s*$/i.test(itemName(item));
}

export function campaignLootEligible(item = {}, { futureTechEnabled = false } = {}) {
  if (isSettingSpecificLootItem(item)) return false;
  if (isProgressionStateVariant(item)) return false;
  if (!futureTechEnabled && isFutureTechItem(item)) return false;
  return true;
}

const UTILITY_WONDROUS_RE = /\b(bag|boots?|rope|cloak|lantern|compass|map|saddle|horseshoes?|tent|bottle|broom|carpet|quiver|pack|gloves?|goggles|helm|hat)\b/i;

export function merchantThemeAllowsItem(theme = "general", item = {}) {
  const key = text(theme || "general").toLowerCase();
  const type = itemType(item);
  const name = itemName(item);
  const tags = merchantTags(item);
  const has = (...values) => values.some((value) => tags.includes(value));
  const is = (...values) => values.includes(type);
  const utilityWondrous = type === "Wondrous Item" && UTILITY_WONDROUS_RE.test(name);

  if (key === "smith") {
    return is("Melee Weapon", "Ranged Weapon", "Armor", "Shield", "Ammunition", "Ore / Metal", "Material", "Tools", "Explosives", "Future");
  }
  if (key === "weapons") return is("Melee Weapon", "Ranged Weapon", "Ammunition", "Explosives", "Future");
  if (key === "alchemy") {
    return is("Plant / Herb", "Reagent / Catalyst", "Alchemy Modifier", "Catalyst", "Monster Part", "Potion", "Elixir", "Oil", "Poison", "Bomb", "Potions & Poisons");
  }
  if (key === "herbalist") {
    return is("Plant / Herb", "Reagent / Catalyst", "Catalyst", "Potion", "Elixir", "Oil", "Poison", "Potions & Poisons");
  }
  if (key === "arcanist") {
    return is("Scroll & Focus", "Rods & Wands")
      || (is("Wondrous Item") && has("arcanist", "scribe", "scroll", "focus"));
  }
  if (key === "jeweler") return is("Wondrous Item", "Trade Goods") && has("jeweler", "gem", "relic");
  if (key === "clothier") return is("Adventuring Gear", "Armor", "Wondrous Item") && has("clothier", "tailor");
  if (key === "stable") return is("Adventuring Gear", "Tools", "Trade Goods", "Vehicles & Structures") && has("stable");
  if (key === "caravan") {
    return is("Adventuring Gear", "Tools", "Trade Goods", "Vehicles & Structures", "Ammunition") || utilityWondrous;
  }
  return is("Adventuring Gear", "Tools", "Trade Goods", "Ammunition") || utilityWondrous;
}

export function merchantRarityBucket(item = {}) {
  const rarity = text(item.item_rarity || item.rarity || item?.payload?.item_rarity || item?.payload?.rarity).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!rarity || rarity === "none" || rarity === "mundane" || rarity === "common") return "mundane";
  if (rarity === "uncommon") return "uncommon";
  if (rarity === "rare") return "rare";
  if (["very rare", "veryrare", "legendary", "artifact"].includes(rarity)) return "high";
  return "other";
}

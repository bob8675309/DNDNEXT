import { classifyUi } from "./itemsIndex";

const PLACEHOLDER_URLS = new Set(["/placeholder.png", "placeholder.png"]);

const FALLBACKS = {
  "Melee Weapon": { icon: "⚔", label: "Weapon", className: "weapon" },
  "Ranged Weapon": { icon: "➶", label: "Ranged weapon", className: "ranged-weapon" },
  Armor: { icon: "◈", label: "Armor", className: "armor" },
  Shield: { icon: "⬟", label: "Shield", className: "shield" },
  Ammunition: { icon: "➹", label: "Ammunition", className: "ammunition" },
  "Adventuring Gear": { icon: "✦", label: "Adventuring gear", className: "adventuring-gear" },
  Tools: { icon: "⚒", label: "Tools", className: "tools" },
  Instrument: { icon: "♫", label: "Instrument", className: "instrument" },
  "Potions & Poisons": { icon: "⚗", label: "Potion or poison", className: "potion" },
  "Scroll & Focus": { icon: "⌘", label: "Scroll or focus", className: "scroll-focus" },
  "Rods & Wands": { icon: "✧", label: "Rod or wand", className: "wand" },
  "Wondrous Item": { icon: "✵", label: "Wondrous item", className: "wondrous" },
  "Trade Goods": { icon: "◆", label: "Trade goods", className: "trade-goods" },
  "Vehicles & Structures": { icon: "♞", label: "Mount or vehicle", className: "vehicle" },
  Explosives: { icon: "✹", label: "Explosive", className: "explosive" },
  Potion: { icon: "⚗", label: "Potion", className: "potion" },
  Elixir: { icon: "⚗", label: "Elixir", className: "potion" },
  Oil: { icon: "◉", label: "Oil", className: "potion" },
  Poison: { icon: "☠", label: "Poison", className: "potion" },
  Bomb: { icon: "✹", label: "Bomb", className: "explosive" },
  Recipe: { icon: "▤", label: "Recipe", className: "scroll-focus" },
  Material: { icon: "◆", label: "Crafting material", className: "material" },
  "Ore / Metal": { icon: "⬢", label: "Ore or metal", className: "material" },
  "Plant / Herb": { icon: "❧", label: "Herb or reagent", className: "herb" },
  "Reagent / Catalyst": { icon: "✦", label: "Reagent or catalyst", className: "material" },
  "Alchemy Modifier": { icon: "✦", label: "Alchemy modifier", className: "material" },
  Catalyst: { icon: "✦", label: "Catalyst", className: "material" },
  "Monster Part": { icon: "◈", label: "Monster part", className: "material" },
  Future: { icon: "◇", label: "Special item", className: "future" },
};

const NAME_FALLBACKS = [
  [/(backpack|bag|pouch|sack|case|chest|quiver|container)/i, { icon: "▣", label: "Container", className: "container" }],
  [/(herb|root|moss|ash|flower|leaf|bark|seed|sap|reagent|mushroom)/i, { icon: "❧", label: "Herb or reagent", className: "herb" }],
  [/(potion|elixir|draught|oil|poison|tonic|salve)/i, { icon: "⚗", label: "Potion or alchemical item", className: "potion" }],
  [/(scroll|spellbook|book|tome|grimoire|parchment)/i, { icon: "▤", label: "Book or scroll", className: "scroll-focus" }],
  [/(ration|food|bread|meal|water|waterskin)/i, { icon: "◒", label: "Provision", className: "provision" }],
  [/(lantern|lamp|torch|candle|tinderbox)/i, { icon: "☼", label: "Light source", className: "light-source" }],
  [/(rope|chain|cord|twine)/i, { icon: "∞", label: "Rope or chain", className: "rope" }],
  [/(saddle|bridle|harness|mount)/i, { icon: "♞", label: "Mount gear", className: "vehicle" }],
];

function cleanImageUrl(value) {
  const url = String(value || "").trim();
  if (!url || PLACEHOLDER_URLS.has(url.toLowerCase())) return "";
  return url;
}

export function explicitItemImage(item = {}) {
  const payload = item?.card_payload && typeof item.card_payload === "object" ? item.card_payload : {};
  return cleanImageUrl(
    item.image_url
    || payload.image_url
    || item.img
    || payload.img
    || item.image
    || payload.image
    || item.icon_url
    || payload.icon_url
  );
}

export function resolveItemVisual(item = {}) {
  const payload = item?.card_payload && typeof item.card_payload === "object" ? item.card_payload : {};
  const merged = { ...payload, ...item };
  const imageUrl = explicitItemImage(merged);
  const name = String(merged.item_name || merged.name || "Item");
  const classified = classifyUi(merged);
  const uiType = classified?.uiType || merged.item_type || merged.type || "Item";

  let fallback = null;
  for (const [pattern, value] of NAME_FALLBACKS) {
    if (pattern.test(name)) {
      fallback = value;
      break;
    }
  }
  if (!fallback) fallback = FALLBACKS[uiType] || { icon: "✦", label: uiType || "Item", className: "generic" };

  return {
    imageUrl,
    hasImage: Boolean(imageUrl),
    icon: fallback.icon,
    label: fallback.label,
    category: uiType || "Item",
    className: `item-visual-${fallback.className}`,
  };
}

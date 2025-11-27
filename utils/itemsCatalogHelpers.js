// utils/itemsCatalogHelpers.js

const toLower = (s) => String(s || "").toLowerCase();

/** Turn whatever 5etools rarity we have into a clean internal label. */
export function normalizeRarity(itOrRaw) {
  const raw =
    typeof itOrRaw === "string"
      ? itOrRaw
      : itOrRaw?.item_rarity || itOrRaw?.rarity || "";

  let r = toLower(raw).trim();
  if (!r || r === "none") return "mundane";
  if (r.startsWith("unknown")) return "unknown";
  return r; // common, uncommon, rare, very rare, legendary, artifact, varies, …
}

/**
 * Base price in gp using your rules:
 * - Everything is priced in gp (and you can show pp = gp/100 in UI later).
 * - Anything < 1 gp becomes 1 gp.
 * - Uncommon: 1500–3000 gp
 * - Rare: 4000–6000 gp
 * - Very Rare: 8000 gp (flat base; tweak if you want a range later)
 * - Legendary / Artifact: high but mostly kept out of normal merchants
 * - Mundane / Common: use 5e "value" (cp) if present, otherwise a small fallback.
 */
export function basePriceGpForItem(it) {
  const rarity = normalizeRarity(it);
  const randInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  let gp = 0;

  if (rarity === "uncommon") {
    gp = randInt(1500, 3000);
  } else if (rarity === "rare") {
    gp = randInt(4000, 6000);
  } else if (rarity === "very rare") {
    gp = 8000; // single base price; change to a range if you ever want variety
  } else if (rarity === "legendary") {
    gp = 15000;
  } else if (rarity === "artifact") {
    gp = 25000;
  } else {
    // Mundane / Common / Unknown: try to respect 5e price if we have one.
    const val = it.value;
    if (typeof val === "number" && val > 0) {
      // 5etools uses cp; convert cp → gp
      gp = val / 100;
    }

    // Fallbacks for truly unpriced stuff
    if (!gp || !Number.isFinite(gp)) {
      if (rarity === "common") gp = 50; // generic cheap magic-ish thing
      else gp = 10; // mundane fallback
    }
  }

  // Clamp: everything costs at least 1 gp, no fractions.
  gp = Math.max(1, Math.round(gp));
  return gp;
}

/**
 * Auto-assign merchant_tags based on name + uiType + uiSubKind.
 * Tags line up with your THEMES:
 *   smith, weapons, alchemy, herbalist,
 *   caravan, stable, clothier, jeweler,
 *   arcanist, general (+ optional temple/tavern/far_realm).
 */
export function merchantTagsForItem(it) {
  const name = toLower(it.name || it.item_name);
  const ui = toLower(it.uiType || it.item_type);
  const sub = toLower(it.uiSubKind || "");
  const rarity = normalizeRarity(it);

  const tags = new Set();

  const has = (...words) => words.some((w) => name.includes(w));

  // Stable / caravan (mounts, vehicles, travel)
  if (
    ui.includes("vehicles & structures") ||
    has("chariot", "wagon", "cart", "sled", "keelboat", "rowboat", "galley", "ship")
  ) {
    tags.add("caravan");
  }
  if (has("horse", "warhorse", "mastiff", "camel", "donkey", "mule", "pony", "griffon", "wyvern")) {
    tags.add("stable");
    tags.add("caravan");
  }

  // Weapons & armor
  if (["melee weapon", "ranged weapon", "weapon", "ammunition"].includes(ui)) {
    tags.add("smith");
    tags.add("weapons");
  } else if (ui === "armor" || ui === "shield" || ui.includes("armor")) {
    tags.add("smith");
  }

  // Jewellery & accessories
  const subJewelry = [
    "ring",
    "amulet",
    "necklace",
    "bracelet",
    "earring",
    "circlet",
    "crown",
    "diadem",
    "jewelry",
    "periapt",
    "brooch",
    "helm",
    "goggles",
    "mask",
    "bracers",
    "belt",
    "boots",
  ];
  if (subJewelry.includes(sub)) {
    tags.add("jeweler");
  }
  const jewelWords = [
    " ring",
    "ring of",
    "amulet",
    "necklace",
    "bracelet",
    "brooch",
    "circlet",
    "crown",
    "diadem",
    "tiara",
    "jewel",
    "jeweled",
    "jewelled",
    "gem ",
    "ruby",
    "diamond",
    "emerald",
    "sapphire",
    "opal",
    "pearl",
  ];
  if (has(...jewelWords) && !name.includes("ring mail")) {
    tags.add("jeweler");
  }

  // Potions / poisons / alchemy
  if (ui === "potions & poisons") {
    tags.add("alchemy");
  }
  if (
    name.includes("potion of ") ||
    has("elixir", "oil of ", "salve", "unguent", "philter", "venom") ||
    name.includes(" poison")
  ) {
    tags.add("alchemy");
  }

  // Herbalist – raw plants etc.
  if (has("herb", "leaf", "root", "fungus", "mushroom") && !name.includes("potion")) {
    tags.add("herbalist");
    tags.delete("alchemy");
  }

  // Arcane – scrolls, wands, staves, spellbooks, etc.
  if (ui === "scroll & focus" || ui === "rods & wands") {
    tags.add("arcanist");
  }
  if (
    has(
      "spellbook",
      "grimoire",
      "tome",
      "scroll of",
      "wand of",
      "staff of",
      "rod of",
      "orb of",
      "crystal ball",
      "arcane focus",
      "arcane grimoire",
      "wizard spellbook"
    )
  ) {
    tags.add("arcanist");
  }

  // Clothier / tailor
  if (
    has(
      "cloak",
      "robe",
      "robes",
      "clothes",
      "clothing",
      "hat",
      "cap",
      "boots",
      "sandals",
      "slippers",
      "gloves",
      "gauntlets",
      "belt",
      "mask"
    )
  ) {
    tags.add("clothier");
  }

  // Temple / divine
  if (
    has(
      "holy symbol",
      "reliquary",
      "relic",
      "icon of",
      "saint",
      "unholy",
      "sacred",
      "periapt of ",
      "phylactery",
      "bead of"
    )
  ) {
    tags.add("temple");
  }

  // Tavern / provisions
  if (has("ale", "wine", "beer", "ration", "food", "meal", "feast", "bread", "cheese")) {
    tags.add("tavern");
  }

  // Far Realm / aberrant
  if (has("kaorti", "aberrant", "far realm", "eldritch", "tentacle")) {
    tags.add("far_realm");
  }

  // Default: if we haven't tagged it, decide based on uiType/rarity.
  if (!tags.size) {
    if (
      ["adventuring gear", "tools", "instrument", "trade goods", "vehicles & structures", "explosives"].includes(ui)
    ) {
      tags.add("general");
    } else if (
      ui === "wondrous item" ||
      ["common", "uncommon", "rare", "very rare", "legendary", "artifact"].includes(rarity)
    ) {
      tags.add("arcanist");
      tags.add("general");
    } else {
      tags.add("general");
    }
  } else {
    // Specialized items can *also* show up in general stores if you want.
    tags.add("general");
  }

  return Array.from(tags);
}
 
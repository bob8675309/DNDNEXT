#!/usr/bin/env node
// scripts/seed_items_catalog.mjs

import "dotenv/config"; // <-- this loads .env BEFORE we read process.env

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

/* ---------- ENV + SUPABASE CLIENT ---------- */

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Windows-safe __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------- HELPERS (rarity, tags, pricing) ---------- */

function normalizeRarity(item) {
  let r = (item.item_rarity || item.rarity || "").toString().toLowerCase();
  if (!r || r === "none") return "mundane";
  r = r.replace("(magic)", "").trim();
  return r || "mundane";
}

function hasWord(name, words) {
  const n = name.toLowerCase();
  return words.some((w) => n.includes(w));
}

// Your merchant theme tags (JS port of the Python helper we built)
function merchantTagsForItem(item) {
  const tags = new Set();
  const name = (item.name || item.item_name || "").toLowerCase();
  const ui = (item.uiType || item.item_type || "").toLowerCase();
  const sub = (item.uiSubKind || "").toLowerCase();
  const rarity = normalizeRarity(item);

  // Stable / caravan
  if (
    ui.includes("vehicle") ||
    hasWord(name, [
      "chariot",
      "wagon",
      "cart",
      "sled",
      "keelboat",
      "rowboat",
      "galley",
      "ship",
    ])
  ) {
    tags.add("caravan");
  }
  if (
    hasWord(name, [
      "horse",
      "warhorse",
      "mastiff",
      "camel",
      "donkey",
      "mule",
      "pony",
      "griffon",
      "wyvern",
    ])
  ) {
    tags.add("stable");
    tags.add("caravan");
  }

  // Weapons & armor
  if (["melee weapon", "ranged weapon", "weapon", "ammunition"].includes(ui)) {
    tags.add("smith");
    tags.add("weapons");
  } else if (["armor", "shield"].includes(ui) || ui.includes("armor")) {
    tags.add("smith");
  }

  // Jewellery via subtype
  const jewelSubs = [
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
  if (jewelSubs.includes(sub)) tags.add("jeweler");

  // Jewellery via name
  if (
    hasWord(name, [
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
    ]) &&
    !name.includes("ring mail")
  ) {
    tags.add("jeweler");
  }

  // Alchemy / potions / poisons
  if (ui === "potions & poisons") tags.add("alchemy");
  if (
    name.includes("potion of ") ||
    hasWord(name, ["elixir", "oil of ", "salve", "unguent", "philter", "venom"]) ||
    name.includes(" poison")
  ) {
    tags.add("alchemy");
  }

  // Herbalist (non-potion herbs)
  if (
    hasWord(name, ["herb", "leaf", "root", "fungus", "mushroom"]) &&
    !name.includes("potion")
  ) {
    tags.add("herbalist");
    tags.delete("alchemy");
  }

  // Arcane – scrolls, wands, staves, rods, spellbooks, tomes, orbs
  if (["scroll & focus", "rods & wands"].includes(ui)) tags.add("arcanist");
  if (
    hasWord(name, [
      "spellbook",
      "grimoire",
      "tome",
      "scroll of",
      "wand of",
      "staff of",
      "rod of",
      "orb of",
      "orb ",
      "crystal ball",
      "arcane focus",
      "arcane grimoire",
      "wizard spellbook",
    ])
  ) {
    tags.add("arcanist");
  }

  // Clothier / tailor
  if (
    hasWord(name, [
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
      "mask",
    ])
  ) {
    tags.add("clothier");
  }

  // Temple / divine
  if (
    hasWord(name, [
      "holy symbol",
      "reliquary",
      "relic",
      "icon of",
      "saint",
      "unholy",
      "sacred",
      "periapt of ",
      "phylactery",
      "bead of",
    ])
  ) {
    tags.add("temple");
  }

  // Tavern / provisions
  if (
    hasWord(name, [
      "ale",
      "wine",
      "beer",
      "ration",
      "food",
      "meal",
      "feast",
      "bread",
      "cheese",
    ])
  ) {
    tags.add("tavern");
  }

  // Aberrant / Far Realm
  if (
    hasWord(name, ["kaorti", "aberrant", "far realm", "eldritch", "tentacle"])
  ) {
    tags.add("far_realm");
  }

  // Default general / arcanist
  if (!tags.size) {
    if (
      [
        "adventuring gear",
        "tools",
        "instrument",
        "trade goods",
        "vehicles & structures",
        "explosives",
      ].includes(ui)
    ) {
      tags.add("general");
    } else if (
      ui === "wondrous item" ||
      ["common", "uncommon", "rare", "very rare", "legendary", "artifact"].includes(
        rarity
      )
    ) {
      tags.add("arcanist");
      tags.add("general");
    } else {
      tags.add("general");
    }
  } else {
    tags.add("general");
  }

  return Array.from(tags);
}

// NEW gp/pp + rarity bands:
// - everything in gp
// - anything < 1 gp becomes 1 gp
// - Uncommon: 1500–3000 (we'll use 2000 as a base)
// - Rare:     4000–6000 (5000 base)
// - Very rare: 8000 base
function basePriceGpForItem(item) {
  const rarity = normalizeRarity(item);

  // Raw value from 5e.tools (cp or gp)
  let val = typeof item.value === "number" ? item.value : 0;
  let gp = 0;

  if (val > 0) {
    if (val >= 1000) {
      // treat as cp → gp (100 cp = 1 gp)
      gp = val / 100;
    } else {
      // already gp
      gp = val;
    }
  }

  if (gp > 0 && gp < 1) gp = 1; // floor to 1 gp

  // Magic bands – simple constants inside your requested ranges
  switch (rarity) {
    case "uncommon":
      return 2000; // in the 1500–3000 band
    case "rare":
      return 5000; // in the 4000–6000 band
    case "very rare":
      return 8000; // base for very rare
    case "legendary":
      return 15000;
    case "artifact":
      return 50000;
    default: {
      // Mundane / common: use underlying gp, with a minimum of 1 gp
      if (!gp || gp < 1) return 1;
      return Math.round(gp);
    }
  }
}

/* ---------- LOAD all-items.json ---------- */

async function loadItems() {
  // adjust this path if your JSON lives somewhere else
  const itemsPath = path.join(__dirname, "..", "public", "items", "all-items.json");
  const raw = await fs.readFile(itemsPath, "utf8");
  const data = JSON.parse(raw);
  console.log(`Loaded ${data.length} items from ${itemsPath}`);
  return data;
}

/* ---------- MAIN: build rows + seed items_catalog ---------- */

async function main() {
  const items = await loadItems();

  // Wipe existing catalog so we don't get duplicates
  console.log("Clearing existing items_catalog rows…");
  const { error: delErr } = await supabase
    .from("items_catalog")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // simple "delete all" filter

  if (delErr) {
    console.error("Failed to clear items_catalog:", delErr.message || delErr);
    process.exit(1);
  }

  const rows = items.map((it) => {
    const rarity = normalizeRarity(it);
    const price_gp = basePriceGpForItem(it);
    const merchant_tags = merchantTagsForItem(it);

    // stable pseudo-id for the payload
    const item_id = `${it.name || "Item"}|${it.source || "SRC"}`;

    const payload = {
      ...it,
      item_id,
      item_name: it.name,
      item_type: it.uiType || null,
      item_rarity: rarity,
      price_gp,
    };

    return {
      item_name: it.name,
      item_type: it.uiType || null,
      item_rarity: rarity,
      price_gp,
      merchant_tags,
      payload,
    };
  });

  console.log(`Seeding ${rows.length} rows into items_catalog…`);

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("items_catalog").insert(chunk);
    if (error) {
      console.error(
        `Insert error on batch starting at ${i}:`,
        error.message || error
      );
      process.exit(1);
    }
    console.log(
      `Inserted ${Math.min(i + batchSize, rows.length)} / ${rows.length}…`
    );
  }

  console.log("Done seeding items_catalog.");
}

main().catch((err) => {
  console.error("Unexpected error in seed_items_catalog:", err);
  process.exit(1);
});

#!/usr/bin/env node
// scripts/seed_items_catalog.mjs
// Upsert/merge seeder for public.items_catalog (no duplicates)
// Requires schema support: items_catalog.item_key UNIQUE (see SQL in my message).

import "dotenv/config";

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

// Your merchant theme tags
function merchantTagsForItem(item) {
  const tags = new Set();
  const name = (item.name || item.item_name || "").toLowerCase();
  const ui = (item.uiType || item.item_type || "").toLowerCase();
  const sub = (item.uiSubKind || "").toLowerCase();

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

  // Arcane
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
      "hood",
      "mask",
      "belt",
    ])
  ) {
    tags.add("clothier");
  }

  // General fallback
  if (tags.size === 0) tags.add("general");

  return Array.from(tags);
}

function basePriceGpForItem(item) {
  const rarity = normalizeRarity(item);

  // Extract a numeric gp-ish value from common shapes
  let gp = 0;
  const v = item.value || item.cost || item.price || null;

  if (v && typeof v === "object") {
    const amount = Number(v.amount ?? v.quantity ?? v.value ?? 0);
    const unit = String(v.unit ?? v.currency ?? "gp").toLowerCase();
    if (Number.isFinite(amount) && amount > 0) {
      if (unit === "gp") gp = amount;
      else if (unit === "sp") gp = amount / 10;
      else if (unit === "cp") gp = amount / 100;
      else if (unit === "pp") gp = amount * 10;
      else gp = amount;
    }
  } else if (typeof v === "number") {
    gp = v;
  } else if (typeof v === "string") {
    const num = Number(String(v).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(num)) gp = num;
  }

  if (gp > 0 && gp < 1) gp = 1;

  // Magic bands (your requested ranges)
  switch (rarity) {
    case "uncommon":
      return 2000;
    case "rare":
      return 5000;
    case "very rare":
      return 8000;
    case "legendary":
      return 15000;
    case "artifact":
      return 50000;
    default: {
      if (!gp || gp < 1) return 1;
      return Math.round(gp);
    }
  }
}

/* ---------- LOAD all-items.json ---------- */

async function loadItems() {
  const itemsPath = path.join(__dirname, "..", "public", "items", "all-items.json");
  const raw = await fs.readFile(itemsPath, "utf8");
  const data = JSON.parse(raw);
  console.log(`Loaded ${data.length} items from ${itemsPath}`);
  return data;
}

/* ---------- MAIN: build rows + UPSERT items_catalog ---------- */

async function main() {
  const items = await loadItems();

  const rows = items.map((it) => {
    const rarity = normalizeRarity(it);
    const price_gp = basePriceGpForItem(it);
    const merchant_tags = merchantTagsForItem(it);

    // Stable key (must match UNIQUE column items_catalog.item_key)
    // Keep it deterministic but robust.
    const item_key = `${(it.name || "Item").trim()}|${(it.source || "SRC").trim()}`;

    const payload = {
      ...it,
      item_key,
      item_id: item_key, // keep legacy naming in payload so existing code keeps working
      item_name: it.name,
      item_type: it.uiType || null,
      item_rarity: rarity,
      price_gp,
    };

    return {
      item_key,
      item_name: it.name,
      item_type: it.uiType || null,
      item_rarity: rarity,
      price_gp,
      merchant_tags,
      payload,
    };
  });

  console.log(`Upserting ${rows.length} rows into items_catalog (no wipe)…`);

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from("items_catalog")
      .upsert(chunk, { onConflict: "item_key" });

    if (error) {
      console.error(
        `Upsert error on batch starting at ${i}:`,
        error.message || error
      );
      process.exit(1);
    }
    console.log(`Upserted ${Math.min(i + batchSize, rows.length)} / ${rows.length}…`);
  }

  console.log("Done upserting items_catalog.");
}

main().catch((err) => {
  console.error("Unexpected error in seed_items_catalog:", err);
  process.exit(1);
});

#!/usr/bin/env node
// scripts/seed_alchemy_catalog.mjs
// DNDNext alchemy codex v3 DB seed.
//
// Purpose:
// - Mirrors the three-per-rarity public/items/alchemy-catalog.json into public.items_catalog.
// - Mirrors core herb ingredients into public.plants for foraging/player_plants.
// - Does NOT require items_catalog.item_key to be unique.
// - Does NOT delete old rows.
//
// Required env:
//   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Merge note:
// Keep payload.alchemy stable, including bonuses.dieSteps. The Items page, merchant stock, loot tables,
// player inventory, and crafting preview all depend on that object shape.

import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RARITY_RANK = { Common: 1, Uncommon: 2, Rare: 3, "Very Rare": 4, Legendary: 5, Mundane: 0 };
const FORAGE_DC = { Common: 10, Uncommon: 14, Rare: 18, "Very Rare": 24, Legendary: 30, Mundane: 8 };

function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return [];
  return String(value).split(/[,|]/).map((v) => v.trim()).filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(normalizeArray(values)));
}

async function loadAlchemyCatalog() {
  const catalogPath = path.join(__dirname, "..", "public", "items", "alchemy-catalog.json");
  const raw = await fs.readFile(catalogPath, "utf8");
  const data = JSON.parse(raw);
  const rows = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  console.log(`Loaded ${rows.length} rows from ${catalogPath}`);
  return rows;
}

async function maybeSingleBy(table, column, value) {
  if (!value) return null;
  const { data, error } = await supabase.from(table).select("id").eq(column, value).limit(1).maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

async function findItemCatalogRow(row) {
  const byKey = await maybeSingleBy("items_catalog", "item_key", row.item_key);
  if (byKey) return byKey;
  const { data, error } = await supabase.from("items_catalog").select("id").ilike("item_name", row.item_name).limit(1).maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

async function upsertItemCatalog(row) {
  const clean = {
    item_key: row.item_key,
    item_name: row.item_name,
    item_type: row.item_type || row.payload?.item_type || null,
    item_rarity: row.item_rarity || row.payload?.item_rarity || null,
    price_gp: Number(row.price_gp || 0),
    merchant_tags: unique(row.merchant_tags),
    payload: row.payload || {},
  };
  const existing = await findItemCatalogRow(clean);
  if (existing?.id) {
    const { error } = await supabase.from("items_catalog").update(clean).eq("id", existing.id);
    if (error) throw error;
    return "updated";
  }
  const { error } = await supabase.from("items_catalog").insert(clean);
  if (error) throw error;
  return "inserted";
}

async function findPlantRow(name) {
  const { data, error } = await supabase.from("plants").select("id").ilike("name", name).limit(1).maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

function plantRowFromCatalogItem(item) {
  const alchemy = item.payload?.alchemy || {};
  if (alchemy.kind !== "ingredient") return null;
  const rarity = item.item_rarity || alchemy.rarity || "Common";
  return {
    name: item.item_name,
    rarity,
    effect: alchemy.brewImpact || "",
    tags: unique(item.merchant_tags),
    category: "Plant / Herb",
    reagent_family: alchemy.family || null,
    family_label: alchemy.familyLabel || null,
    potency_rank: RARITY_RANK[rarity] || 0,
    effect_family: alchemy.family || null,
    positive_effects: unique(item.payload?.positive_effects || alchemy.brewImpact || []),
    alchemy_notes: alchemy.physicalDescription || item.item_description || item.payload?.item_description || "",
    forage_dc: FORAGE_DC[rarity] || 12,
    found_in: "DNDNext Alchemy Codex",
    updated_at: new Date().toISOString(),
  };
}

async function upsertPlant(item) {
  const clean = plantRowFromCatalogItem(item);
  if (!clean) return "skipped";
  const existing = await findPlantRow(clean.name);
  if (existing?.id) {
    const { error } = await supabase.from("plants").update(clean).eq("id", existing.id);
    if (error) throw error;
    return "updated";
  }
  const { error } = await supabase.from("plants").insert(clean);
  if (error) throw error;
  return "inserted";
}

async function main() {
  const catalog = await loadAlchemyCatalog();
  let itemInserted = 0;
  let itemUpdated = 0;
  let plantInserted = 0;
  let plantUpdated = 0;

  for (const row of catalog) {
    if (!row?.payload?.alchemy) continue;
    const result = await upsertItemCatalog(row);
    if (result === "inserted") itemInserted += 1;
    if (result === "updated") itemUpdated += 1;

    const plantResult = await upsertPlant(row);
    if (plantResult === "inserted") plantInserted += 1;
    if (plantResult === "updated") plantUpdated += 1;
  }

  console.log(`items_catalog: ${itemInserted} inserted, ${itemUpdated} updated`);
  console.log(`plants: ${plantInserted} inserted, ${plantUpdated} updated`);
  console.log("Alchemy catalog seed complete.");
}

main().catch((err) => {
  console.error("Alchemy seed failed:", err?.message || err);
  process.exit(1);
});

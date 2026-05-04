// pages/items.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const TABS = [
  ["recipes", "📘", "Recipes"],
  ["materials", "🧱", "Materials"],
  ["bench", "⚒️", "Craft Bench"],
  ["plans", "📋", "Craft Plans"],
  ["discovery", "🧭", "Discovery"],
  ["mastery", "⭐", "Mastery"],
];

const FORGE_CODES = new Set(["M", "R", "A", "LA", "MA", "HA", "S"]);
const PHYSICAL_VARIANTS = new Set(["enhancement", "adamantine", "mithral", "silvered", "ruidium"]);
const FUTURE_RE = /future|modern|futuristic|antimatter|laser|automatic\s+(pistol|rifle)|\b(pistol|musket|rifle|revolver|shotgun|carbine)\b|firearm\s+(bullet|needle|ammunition)|hunting rifle|modern rifle|alien firearm/i;
const RARITY_ORDER = ["Mundane", "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Varies"];

function titleCase(value = "") {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
function rarity(value = "") {
  const s = String(value || "").toLowerCase().trim();
  if (!s) return "";
  if (s === "none" || s === "mundane") return "Mundane";
  if (s.includes("legend")) return "Legendary";
  if (s.includes("very")) return "Very Rare";
  if (s.includes("rare")) return "Rare";
  if (s.includes("uncommon")) return "Uncommon";
  if (s.includes("common")) return "Common";
  if (s.includes("varies") || s.includes("variable")) return "Varies";
  return titleCase(value);
}
function rarityRank(value) {
  const idx = RARITY_ORDER.indexOf(rarity(value));
  return idx === -1 ? 99 : idx;
}
function tag(value = "") {
  return String(value || "").split("|")[0].trim();
}
function rows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.item)) return data.item;
  if (Array.isArray(data?.variants)) return data.variants;
  if (Array.isArray(data?.recipes)) return data.recipes;
  return [];
}
async function json(path, required = false) {
  try {
    const res = await fetch(path);
    if (!res.ok) {
      if (required) throw new Error(`${path} returned HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    if (required) throw err;
    return null;
  }
}
async function selectSafe(table, select, orderBy) {
  try {
    let q = supabase.from(table).select(select);
    if (orderBy) q = q.order(orderBy, { ascending: true });
    const { data, error } = await q;
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function typeFromCode(code) {
  const c = tag(code).toUpperCase();
  if (c === "S" || c === "SH") return "shield";
  if (c === "A") return "ammunition";
  if (["LA", "MA", "HA"].includes(c)) return "armor";
  if (c === "M" || c === "R") return "weapon";
  return "gear";
}
function familyFromItem(item) {
  const c = tag(item?.type || item?.item_type).toUpperCase();
  const props = [].concat(item?.property || item?.properties || []).map((p) => tag(typeof p === "string" ? p : p?.uid || p?.abbreviation || ""));
  if (c === "R") return "Ranged";
  if (c === "A") return "Ammunition";
  if (c === "M") return props.includes("T") ? "Thrown" : "Melee";
  if (c === "S" || c === "SH") return "Shield";
  if (["LA", "MA", "HA"].includes(c)) return "Armor";
  return "Gear";
}
function magicSignals(item) {
  const blob = [item?.name, item?.item_name, item?.baseItem, item?.rarity, item?.tier, item?.item_description, item?.attunementText].filter(Boolean).join(" ").toLowerCase();
  return Boolean(item?.wondrous || item?.reqAttune || item?.reqAttuneTags || item?.bonusWeapon || item?.bonusAc || item?.attachedSpells || item?.charges || item?.recharge || item?.curse || /^\s*\+\d+\b/.test(blob) || /\b(awakened|exalted|dormant|slumbering|stirring|ascendant|requires attunement|magic weapon|magic armor|artifact)\b/.test(blob));
}
function isForgeItem(item) {
  const name = String(item?.name || item?.item_name || "").trim();
  const code = tag(item?.type || item?.item_type).toUpperCase();
  const r = String(item?.rarity || item?.item_rarity || "").toLowerCase().trim();
  if (!name || !FORGE_CODES.has(code)) return false;
  if (r && r !== "none" && r !== "mundane") return false;
  if (FUTURE_RE.test([name, item?.uiType, item?.rawType, item?.source].filter(Boolean).join(" "))) return false;
  if (magicSignals(item)) return false;
  return true;
}
function forgeRecipe(item) {
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
    summary: `A blacksmith can craft a new mundane ${name}.`,
    requirements: ["Access to a smithy", `Pattern: ${name}`, "Material cost determined by the DM"],
    components: ["Metal, wood, leather, fletching, or ammunition stock as appropriate"],
  };
}
function temperRecipes() {
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
    rarity: rarity(raw.rarity || (raw.rarityByValue ? "Varies" : "")) || "Varies",
    known: false,
    source: raw.source || "Variant Catalog",
    summary: entries.join(" ") || raw.textByKind?.[appliesTo[0]] || `Magical trait applicable to ${appliesTo.join(", ")}.`,
    requirements: ["Smith-tiered base item", `Applies to: ${appliesTo.join(", ")}`],
    components: raw.options?.length ? [`Choose option: ${raw.options.join(", ")}`] : ["Optional catalyst, reagent, monster part, or teacher requirement"],
  };
}
function dbRecipe(row, knownIds) {
  const name = row.name || row.title || row.recipe_name || "Unnamed Recipe";
  const keys = [row.id, row.recipe_id, name].map((v) => String(v || "").toLowerCase());
  const known = !!row.known || !!row.is_known || keys.some((k) => knownIds.has(k));
  return {
    id: `db:${row.id || name}`,
    name,
    discipline: titleCase(row.discipline || row.recipe_type || row.kind || "Recipe"),
    kind: row.recipe_type || row.kind || "recipe",
    category: row.category || row.applies_to || row.item_type || "custom",
    family: row.family || row.category || "Custom",
    rarity: rarity(row.rarity || row.item_rarity || "") || "Varies",
    known,
    source: row.source || "Supabase",
    summary: row.description || row.summary || row.notes || "Custom recipe.",
    requirements: Array.isArray(row.requirements) ? row.requirements : row.requirements ? [String(row.requirements)] : [],
    components: Array.isArray(row.components) ? row.components : row.components ? [String(row.components)] : [],
  };
}

function materialCategoryFromText(value = "") {
  const blob = String(value || "").toLowerCase();
  if (/(ore|ingot|adamant|mithral|silver|obsidian|cold iron|metal|steel|iron|copper|tin|gold|platinum)/.test(blob)) return "Ore / Metal";
  if (/(fang|eye|claw|horn|hide|scale|heart|ichor|venom|gland|bone|tooth|blood|organ|monster|dragon)/.test(blob)) return "Monster Part";
  if (/(rune|sigil|essence|core|shard|gem|crystal|dust|resin|catalyst)/.test(blob)) return "Catalyst";
  if (/(herb|plant|mushroom|root|flower|leaf|berry|spore|fungus)/.test(blob)) return "Plant / Herb";
  if (/(reagent|oil|ink|powder|salt|acid|alkali|solution|extract)/.test(blob)) return "Reagent";
  return "Material";
}
function materialCategoryTone(category = "") {
  const c = String(category || "").toLowerCase();
  if (c.includes("ore")) return "metal";
  if (c.includes("monster")) return "monster";
  if (c.includes("catalyst")) return "catalyst";
  if (c.includes("plant")) return "plant";
  if (c.includes("reagent")) return "reagent";
  return "material";
}
function materialQualityLabel(material) {
  const r = rarity(material?.rarity || "");
  if (r && r !== "Mundane") return r;
  const q = String(material?.quality || material?.raw?.quality || material?.raw?.card_payload?.quality || "").trim();
  return q ? titleCase(q) : "Standard";
}
function materialSearchBlob(material) {
  return [
    material?.name,
    material?.category,
    material?.type,
    material?.rarity,
    material?.source,
    material?.notes,
    materialQualityLabel(material),
  ].filter(Boolean).join(" ").toLowerCase();
}
function materialMatches(material, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return materialSearchBlob(material).includes(q);
}

function hasExplicitMaterialSignal(value = "") {
  return /(material|reagent|ingredient|ore|ingot|dust|essence|catalyst|monster\s*part|plant|herb|mushroom|root|flower|extract|resin|venom|gland|hide|scale|fang|claw|horn|bone|blood|ichor|gem|shard|crystal|powder|salt)/i.test(String(value || ""));
}
function isFinishedGearType(value = "") {
  return /\b(wondrous|weapon|armor|shield|ammunition|ring|rod|staff|wand|scroll|potion|tool|instrument|mount|vehicle)\b/i.test(String(value || ""));
}
function shouldTreatInventoryRowAsMaterial(row, payload = {}) {
  const explicitFields = [
    row.item_type,
    row.material_type,
    row.category,
    payload.item_type,
    payload.material_type,
    payload.category,
    payload.crafting_category,
    payload.uiType,
    ...(Array.isArray(row.tags) ? row.tags : []),
    ...(Array.isArray(payload.tags) ? payload.tags : []),
  ].filter(Boolean).join(" ");

  const typeFields = [
    row.item_type,
    payload.item_type,
    payload.type,
    payload.uiType,
    payload.category,
  ].filter(Boolean).join(" ");

  const nameAndNotes = [
    row.item_name,
    payload.name,
    row.item_description,
    payload.item_description,
    payload.flavor,
  ].filter(Boolean).join(" ");

  const explicitMaterial = hasExplicitMaterialSignal(explicitFields);
  const finishedGear = isFinishedGearType(typeFields);

  // Finished gear should not be counted as material just because its name or text
  // includes "adamantine", "dragon", "giant", "scale", etc. A future salvage/
  // dismantle recipe can intentionally convert these into base materials.
  if (finishedGear && !explicitMaterial) return false;

  return explicitMaterial || hasExplicitMaterialSignal(nameAndNotes);
}

function materialFromInventory(row) {
  const payload = row.card_payload && typeof row.card_payload === "object" ? row.card_payload : {};
  if (!shouldTreatInventoryRowAsMaterial(row, payload)) return null;

  const blob = [
    row.item_name,
    row.item_type,
    row.material_type,
    row.category,
    payload.item_type,
    payload.material_type,
    payload.category,
    payload.crafting_category,
    payload.type,
    payload.uiType,
    payload.name,
    row.item_description,
    payload.item_description,
    payload.flavor,
  ].filter(Boolean).join(" ").toLowerCase();

  const category = materialCategoryFromText(blob);
  return {
    id: row.id,
    name: row.item_name || payload.name || "Unknown Material",
    category,
    categoryTone: materialCategoryTone(category),
    type: titleCase(row.material_type || payload.material_type || row.item_type || payload.item_type || payload.uiType || category || "Material"),
    rarity: rarity(row.item_rarity || payload.rarity || payload.item_rarity || ""),
    quality: payload.quality || row.quality || null,
    quantity: Number(row.quantity || row.qty || payload.quantity || 1) || 1,
    source: payload.source || row.source || "Inventory",
    notes: row.item_description || payload.item_description || payload.flavor || "Owned crafting material.",
    raw: row,
  };
}
function materialFromPlant(row) {
  return {
    id: `plant:${row.id || row.plant_id || row.name || row.plant_name}`,
    name: row.name || row.plant_name || "Unknown Plant",
    category: "Plant / Herb",
    categoryTone: "plant",
    type: "Plant / Herb",
    rarity: rarity(row.rarity || ""),
    quality: row.quality || null,
    quantity: Number(row.quantity || row.qty || 1) || 1,
    source: row.biome || row.source || "Gathered",
    notes: row.description || row.notes || "Gathered alchemy ingredient.",
    raw: row,
  };
}

function normalizeBenchInventoryItem(row) {
  const payload = row?.card_payload && typeof row.card_payload === "object" ? row.card_payload : {};
  const name = row?.item_name || payload.name || payload.item_name || "Unnamed Item";
  const type = row?.item_type || payload.item_type || payload.type || payload.uiType || "";
  return {
    id: row?.id,
    name,
    type: titleCase(type || "Item"),
    rarity: rarity(row?.item_rarity || payload.rarity || payload.item_rarity || ""),
    quantity: Number(row?.quantity || row?.qty || payload.quantity || 1) || 1,
    owner_id: row?.owner_id || row?.character_id || row?.player_id || payload.owner_id || null,
    character_id: row?.character_id || payload.character_id || null,
    payload,
    raw: row,
  };
}
function isCraftBaseCandidate(item, recipe) {
  if (!item || !recipe) return false;
  const blob = [item.name, item.type, item.rarity, item.payload?.item_type, item.payload?.type, item.payload?.uiType].filter(Boolean).join(" ").toLowerCase();
  if (recipe.kind === "forge") return false;
  if (recipe.discipline === "Smithing") return /(weapon|armor|shield|ammunition|melee|ranged)/.test(blob);
  if (recipe.discipline === "Enchanting") return /(weapon|armor|shield|ammunition|melee|ranged|\+\d+)/.test(blob);
  return true;
}
function characterName(character) {
  return character?.name || character?.character_name || character?.display_name || character?.email || "Unnamed Character";
}
function selectedMaterialPayload(selectedMaterials = {}, plan) {
  return (plan?.matches || []).map((entry) => {
    const selectedId = selectedMaterials[entry.category];
    const selected = (entry.candidates || []).find((candidate) => String(candidate.id) === String(selectedId)) || null;
    return {
      category: entry.category,
      inventory_item_id: selected?.id || null,
      name: selected?.name || null,
      quantity_required: 1,
      quantity_available: selected?.quantity || 0,
      rarity: selected?.rarity || null,
      source: selected?.source || null,
    };
  });
}
function suggestedResultName(recipe, baseItem) {
  if (!recipe) return "";
  if (recipe.kind === "forge") return recipe.name.replace(/^Forge\s+/i, "");
  if (recipe.kind === "temper" && baseItem?.name) return `${recipe.name.replace(/\s*Temper$/i, "")} ${baseItem.name.replace(/^\+\d+\s+/i, "")}`.trim();
  if (recipe.discipline === "Enchanting" && baseItem?.name) return `${recipe.name} ${baseItem.name}`.trim();
  return baseItem?.name || recipe.name;
}
function matches(obj, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [obj?.name, obj?.originalName, obj?.kind, obj?.discipline, obj?.category, obj?.family, obj?.rarity, obj?.source, obj?.summary, obj?.notes, ...(Array.isArray(obj?.requirements) ? obj.requirements : []), ...(Array.isArray(obj?.components) ? obj.components : [])].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}
function cls(...parts) { return parts.filter(Boolean).join(" "); }
function StatTile({ label, value, tone = "" }) { return <div className={cls("craft-stat", tone)}><div className="craft-stat-value">{value}</div><div className="craft-stat-label">{label}</div></div>; }
function RecipeRow({ recipe, active, onSelect }) {
  return <button type="button" className={cls("craft-list-row", active && "craft-list-row-active")} onClick={() => onSelect(recipe)}><div className="min-w-0"><div className="craft-row-title">{recipe.name}</div><div className="craft-row-meta">{recipe.discipline} • {recipe.family || recipe.category}</div></div><span className={cls("craft-badge", recipe.known && "craft-badge-known")}>{recipe.known ? "Known" : recipe.rarity || "Ref"}</span></button>;
}

function recipeSlotLabel(recipe) {
  if (!recipe || recipe.discipline !== "Enchanting") return "—";
  const r = rarity(recipe.rarity);
  if (r === "Uncommon") return "A+";
  if (r === "Rare") return "B+";
  if (r === "Very Rare") return "C";
  if (r === "Legendary") return "D later";
  return "—";
}
function RecipeTable({ recipes, selected, onSelect }) {
  return (
    <div className="craft-table-scroll" role="region" aria-label="Recipe spreadsheet">
      <table className="craft-recipe-sheet">
        <thead>
          <tr>
            <th className="col-name">Recipe</th>
            <th className="col-known">Owned</th>
            <th className="col-type">Type</th>
            <th className="col-rarity">Rarity</th>
            <th className="col-slot">Slot</th>
            <th className="col-applies">Applies</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => {
            const isActive = selected?.id === recipe.id;
            const cleanKind = titleCase(recipe.kind || "recipe");
            return (
              <tr
                key={recipe.id}
                className={isActive ? "active" : ""}
                onClick={() => onSelect(recipe)}
              >
                <td className="col-name">
                  <div className="craft-sheet-name">{recipe.name}</div>
                  <div className="craft-sheet-source">{recipe.source || "—"}</div>
                </td>
                <td className="col-known">
                  <span className={cls("craft-status-pill", recipe.known && "known")}>{recipe.known ? "Owned" : "Ref"}</span>
                </td>
                <td className="col-type">
                  <span className={cls("craft-type-pill", `type-${String(recipe.discipline || "recipe").toLowerCase()}`)}>{recipe.discipline || cleanKind}</span>
                </td>
                <td className="col-rarity">
                  <span className={cls("craft-rarity-pill", `rarity-${String(recipe.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{recipe.rarity || "—"}</span>
                </td>
                <td className="col-slot">
                  <span className="craft-slot-pill">{recipeSlotLabel(recipe)}</span>
                </td>
                <td className="col-applies">
                  <span className="craft-applies-text">{recipe.family || recipe.category || "—"}</span>
                </td>
              </tr>
            );
          })}
          {!recipes.length ? (
            <tr><td colSpan="6" className="text-muted p-3">No recipes found.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function MaterialTable({ materials, selected, onSelect }) {
  return (
    <div className="craft-table-scroll craft-material-table-scroll" role="region" aria-label="Material ledger">
      <table className="craft-recipe-sheet craft-material-sheet">
        <thead>
          <tr>
            <th className="mat-name">Material</th>
            <th className="mat-category">Category</th>
            <th className="mat-qty">Qty</th>
            <th className="mat-rarity">Rarity</th>
            <th className="mat-source">Source</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => {
            const isActive = selected?.id === material.id;
            return (
              <tr key={material.id} className={isActive ? "active" : ""} onClick={() => onSelect(material)}>
                <td className="mat-name">
                  <div className="craft-sheet-name">{material.name}</div>
                  <div className="craft-sheet-source">{materialQualityLabel(material)}</div>
                </td>
                <td className="mat-category">
                  <span className={cls("craft-material-kind-pill", `mat-${material.categoryTone || "material"}`)}>{material.category || "Material"}</span>
                </td>
                <td className="mat-qty">
                  <span className="craft-material-qty-pill">x{material.quantity}</span>
                </td>
                <td className="mat-rarity">
                  <span className={cls("craft-rarity-pill", `rarity-${String(material.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{material.rarity || "—"}</span>
                </td>
                <td className="mat-source">
                  <span className="craft-applies-text">{material.source || "—"}</span>
                </td>
              </tr>
            );
          })}
          {!materials.length ? <tr><td colSpan="5" className="text-muted p-3">No tracked materials found.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
function MaterialPreview({ material, recipes = [] }) {
  if (!material) {
    return <div className="craft-preview-card craft-preview-empty">Select a material to inspect.</div>;
  }

  const recipeHits = recipes
    .filter((recipe) => matches(recipe, material.name) || matches(recipe, material.category))
    .slice(0, 6);

  return (
    <div className="craft-preview-card">
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Material Detail</div>
          <h2 className="craft-preview-title">{material.name}</h2>
        </div>
        <span className={cls("craft-preview-rarity", `rarity-${String(material.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{material.rarity || "—"}</span>
      </div>

      <div className="craft-preview-summary">
        {material.notes || "Owned crafting material."}
      </div>

      <div className="craft-preview-chip-row">
        <span className={cls("craft-chip", "craft-chip-blue")}>{material.category || "Material"}</span>
        <span className="craft-chip">Qty x{material.quantity}</span>
        <span className="craft-chip craft-chip-gold">{materialQualityLabel(material)}</span>
        <span className="craft-chip">{material.source || "Inventory"}</span>
      </div>

      <div className="craft-preview-grid">
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Ledger Info</div>
          <div className="craft-bullet">• Type: {material.type || "Material"}</div>
          <div className="craft-bullet">• Category: {material.category || "Material"}</div>
          <div className="craft-bullet">• Quantity: {material.quantity}</div>
          <div className="craft-bullet">• Source: {material.source || "Inventory"}</div>
        </div>
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Recipe Matches</div>
          {recipeHits.length
            ? recipeHits.map((recipe) => <div className="craft-bullet" key={recipe.id}>• {recipe.name}</div>)
            : <div className="craft-bullet muted">No direct recipe text match yet. Future alchemy recipes will improve matching.</div>}
        </div>
      </div>

      <div className="craft-preview-footer">
        <span>Tracking</span>
        <strong>Inventory Ledger</strong>
      </div>
    </div>
  );
}
function MaterialCategoryPanel({ materials, activeCategory, setActiveCategory }) {
  const groups = ["All", "Ore / Metal", "Monster Part", "Catalyst", "Plant / Herb", "Reagent", "Material"];
  const counts = new Map();
  materials.forEach((material) => {
    counts.set(material.category || "Material", (counts.get(material.category || "Material") || 0) + 1);
  });

  return (
    <div className="craft-panel">
      <div className="craft-panel-head"><strong>Material Groups</strong><span className="craft-badge">Ledger</span></div>
      {groups.map((group) => {
        const count = group === "All" ? materials.length : counts.get(group) || 0;
        return (
          <button
            key={group}
            type="button"
            className={cls("craft-group-row", activeCategory === group && "craft-list-row-active")}
            onClick={() => setActiveCategory(group)}
          >
            <span>{group}</span>
            <span className={cls("craft-badge", group === "All" && "craft-badge-material")}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
function RecipePreview({ recipe }) {
  if (!recipe) {
    return <div className="craft-preview-card craft-preview-empty">Select a recipe to preview.</div>;
  }

  const reqs = (recipe.requirements || []).filter(Boolean);
  const comps = (recipe.components || []).filter(Boolean);

  return (
    <div className="craft-preview-card">
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Recipe Preview</div>
          <h2 className="craft-preview-title">{recipe.name}</h2>
        </div>
        <span className={cls("craft-preview-rarity", `rarity-${String(recipe.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{recipe.rarity || "—"}</span>
      </div>

      <div className="craft-preview-summary">
        {recipe.summary || "No summary available."}
      </div>

      <div className="craft-preview-chip-row">
        <span className="craft-chip craft-chip-blue">{recipe.discipline}</span>
        <span className="craft-chip">{titleCase(recipe.kind)}</span>
        <span className="craft-chip">{recipe.category}</span>
        <span className="craft-chip craft-chip-gold">Slot {recipeSlotLabel(recipe)}</span>
        <span className={recipe.known ? "craft-chip craft-chip-green" : "craft-chip"}>{recipe.known ? "Owned / Known" : "Reference"}</span>
      </div>

      <div className="craft-preview-grid">
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Requirements</div>
          {reqs.length ? reqs.map((line, idx) => <div className="craft-bullet" key={idx}>• {line}</div>) : <div className="craft-bullet muted">—</div>}
        </div>
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Components / Notes</div>
          {comps.length ? comps.map((line, idx) => <div className="craft-bullet" key={idx}>• {line}</div>) : <div className="craft-bullet muted">Optional materials and catalysts decided by the DM.</div>}
        </div>
      </div>

      <div className="craft-preview-footer">
        <span>Source</span>
        <strong>{recipe.source || "—"}</strong>
      </div>
    </div>
  );
}


function recipeComponentText(recipe) {
  return [
    recipe?.name,
    recipe?.discipline,
    recipe?.kind,
    recipe?.category,
    recipe?.family,
    recipe?.summary,
    ...(Array.isArray(recipe?.requirements) ? recipe.requirements : []),
    ...(Array.isArray(recipe?.components) ? recipe.components : []),
  ].filter(Boolean).join(" ").toLowerCase();
}
function requiredMaterialCategoriesForRecipe(recipe) {
  const blob = recipeComponentText(recipe);
  const out = [];
  const push = (category) => {
    if (!out.includes(category)) out.push(category);
  };

  if (/(ore|ingot|metal|steel|iron|adamant|mithral|silver|raw material|smith|forge|temper)/.test(blob)) push("Ore / Metal");
  if (/(monster|fang|claw|horn|scale|hide|heart|venom|gland|ichor|bone|blood)/.test(blob)) push("Monster Part");
  if (/(catalyst|essence|core|rune|sigil|gem|shard|crystal|dust|resin)/.test(blob)) push("Catalyst");
  if (/(plant|herb|mushroom|root|flower|leaf|berry|spore)/.test(blob)) push("Plant / Herb");
  if (/(reagent|oil|ink|powder|salt|acid|extract|solution|alchemy|brew|potion)/.test(blob)) push("Reagent");

  if (!out.length && recipe?.discipline === "Smithing") push("Ore / Metal");
  if (!out.length && recipe?.discipline === "Enchanting") push("Catalyst");
  if (!out.length && recipe?.discipline === "Alchemy") push("Reagent");

  return out;
}
function materialMatchesCategory(material, category) {
  if (!material || !category) return false;
  if (material.category === category) return true;
  const blob = materialSearchBlob(material);
  if (category === "Ore / Metal") return /(ore|ingot|metal|steel|iron|adamant|mithral|silver)/.test(blob);
  if (category === "Monster Part") return /(monster|fang|claw|horn|scale|hide|heart|venom|gland|ichor|bone|blood)/.test(blob);
  if (category === "Catalyst") return /(catalyst|essence|core|rune|sigil|gem|shard|crystal|dust|resin)/.test(blob);
  if (category === "Plant / Herb") return /(plant|herb|mushroom|root|flower|leaf|berry|spore)/.test(blob);
  if (category === "Reagent") return /(reagent|oil|ink|powder|salt|acid|extract|solution)/.test(blob);
  return false;
}
function buildCraftBenchPlan(recipe, materials = []) {
  if (!recipe) {
    return { categories: [], matches: [], missing: [], ready: false, notes: ["Choose a recipe to begin a craft plan."] };
  }

  const categories = requiredMaterialCategoriesForRecipe(recipe);
  const matches = categories.map((category) => {
    const candidates = materials
      .filter((material) => materialMatchesCategory(material, category))
      .sort((a, b) => (rarityRank(b.rarity) - rarityRank(a.rarity)) || String(a.name).localeCompare(String(b.name)));
    return { category, candidates };
  });
  const missing = matches.filter((entry) => entry.candidates.length === 0).map((entry) => entry.category);
  const ready = categories.length > 0 && missing.length === 0;

  const notes = [];
  if (!recipe.known) notes.push("This recipe is currently a reference recipe; discovery/known-recipe gating can lock crafting later.");
  if (!categories.length) notes.push("This recipe has no material categories detected yet.");
  if (missing.length) notes.push(`Missing material categories: ${missing.join(", ")}.`);
  if (ready) notes.push("Material category coverage looks ready for a DM-reviewed craft plan.");

  return { categories, matches, missing, ready, notes };
}


function defaultRecipeBaseDc(recipe) {
  const r = rarity(recipe?.rarity || "");
  const rarityDc = {
    Mundane: 10,
    Common: 12,
    Uncommon: 15,
    Rare: 18,
    "Very Rare": 22,
    Legendary: 27,
    Varies: 15,
  }[r] || 15;

  const kind = String(recipe?.kind || "").toLowerCase();
  const discipline = String(recipe?.discipline || "").toLowerCase();
  let kindMod = 0;
  if (kind.includes("temper")) kindMod += 2;
  if (kind.includes("enchant")) kindMod += 3;
  if (discipline === "alchemy") kindMod += 1;
  return rarityDc + kindMod;
}
function recipeRuleFor(recipe, rules = []) {
  if (!recipe) return null;
  const id = String(recipe.id || "").toLowerCase();
  const kind = String(recipe.kind || "").toLowerCase();
  const discipline = String(recipe.discipline || "").toLowerCase();
  const rarityText = rarity(recipe.rarity || "").toLowerCase();

  return rules.find((rule) => String(rule.recipe_id || "").toLowerCase() === id)
    || rules.find((rule) =>
      String(rule.discipline || "").toLowerCase() === discipline
      && String(rule.recipe_kind || "").toLowerCase() === kind
      && (!rule.rarity || String(rule.rarity).toLowerCase() === rarityText)
    )
    || rules.find((rule) =>
      String(rule.discipline || "").toLowerCase() === discipline
      && String(rule.recipe_kind || "").toLowerCase() === kind
      && !rule.rarity
    )
    || null;
}
function materialEffectFor(material, materialEffects = []) {
  if (!material) return null;
  const blob = materialSearchBlob(material);
  const category = String(material.category || "").toLowerCase();

  const exact = materialEffects.find((effect) => {
    const key = String(effect.match_key || effect.name || "").toLowerCase();
    return key && blob.includes(key);
  });
  if (exact) return exact;

  return materialEffects.find((effect) => {
    const effectCategory = String(effect.material_category || "").toLowerCase();
    return effectCategory && effectCategory === category;
  }) || null;
}
function fallbackMaterialEffect(material) {
  if (!material) return null;
  const blob = materialSearchBlob(material);
  if (/adamant/.test(blob)) return { name: "Adamantine Working", dc_modifier: 3, effect_summary: "Adds exceptional hardness or anti-critical durability, depending on item type.", risk_summary: "Hard to work; failed crafts may waste the ore." };
  if (/mithral/.test(blob)) return { name: "Mithral Working", dc_modifier: 2, effect_summary: "Reduces weight and improves mobility or stealth usability.", risk_summary: "Requires precise heat and shaping control." };
  if (/dragon/.test(blob)) return { name: "Dragon-Aspected Catalyst", dc_modifier: 4, effect_summary: "Adds elemental theming, resistance, damage, or draconic resonance based on source.", risk_summary: "Volatile if mismatched with the base item." };
  if (/venom|poison|gland|ichor/.test(blob)) return { name: "Toxic Catalyst", dc_modifier: 3, effect_summary: "Adds poison, bleed, caustic, or lingering harm potential.", risk_summary: "Mishap can contaminate the item or crafter." };
  if (/rune|sigil|essence|core|shard|crystal|dust|resin|catalyst/.test(blob)) return { name: "Arcane Catalyst", dc_modifier: 2, effect_summary: "Improves magical binding or adds a minor arcane rider.", risk_summary: "Can destabilize enchantment slots." };
  if (/herb|plant|root|flower|mushroom|reagent|oil|extract/.test(blob)) return { name: "Refined Reagent", dc_modifier: 1, effect_summary: "Adds alchemical potency, duration, or stabilizing properties.", risk_summary: "Low risk unless combined with volatile reagents." };
  if (/ore|ingot|metal|steel|iron|silver/.test(blob)) return { name: "Special Material", dc_modifier: 1, effect_summary: "Changes durability, finish, weight, or compatibility with later crafting.", risk_summary: "Requires correct tools and working temperature." };
  return null;
}
function selectedMaterialObjects(selectedMaterials = {}, plan) {
  return (plan?.matches || []).map((entry) => {
    const selectedId = selectedMaterials[entry.category];
    return (entry.candidates || []).find((candidate) => String(candidate.id) === String(selectedId)) || null;
  }).filter(Boolean);
}
function calculateCraftAttemptPreview(recipe, plan, selectedMaterials = {}, recipeRules = [], materialEffects = []) {
  const rule = recipeRuleFor(recipe, recipeRules);
  const baseDc = Number(rule?.base_dc || defaultRecipeBaseDc(recipe));
  const rarityMod = Number(rule?.rarity_dc_modifier || 0);
  const tierMod = Number(rule?.tier_dc_modifier || 0);
  const complexityMod = Number(rule?.complexity_dc_modifier || 0);
  const selected = selectedMaterialObjects(selectedMaterials, plan);

  const materialBreakdown = selected.map((material) => {
    const effect = materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {
      name: `${material.category || "Material"} Modifier`,
      dc_modifier: 1,
      effect_summary: "Adds a minor crafted-material effect decided by recipe context.",
      risk_summary: "Minor additional complexity.",
    };
    return {
      inventory_item_id: material.id,
      name: material.name,
      category: material.category,
      quantity_required: 1,
      quantity_available: material.quantity,
      rarity: material.rarity || null,
      dc_modifier: Number(effect.dc_modifier || 0),
      effect_name: effect.name || "Material Effect",
      effect_summary: effect.effect_summary || "No effect summary.",
      risk_summary: effect.risk_summary || "No special risk.",
    };
  });

  const materialDc = materialBreakdown.reduce((sum, item) => sum + (Number(item.dc_modifier) || 0), 0);
  const missingCount = Array.isArray(plan?.missing) ? plan.missing.length : 0;
  const missingMod = missingCount * 2;
  const finalDc = baseDc + rarityMod + tierMod + complexityMod + materialDc + missingMod;

  return {
    base_dc: baseDc,
    final_dc: finalDc,
    breakdown: [
      { label: "Base recipe DC", value: baseDc },
      rarityMod ? { label: "Rarity modifier", value: rarityMod } : null,
      tierMod ? { label: "Tier modifier", value: tierMod } : null,
      complexityMod ? { label: "Complexity modifier", value: complexityMod } : null,
      materialDc ? { label: "Selected materials / catalysts", value: materialDc } : null,
      missingMod ? { label: "Missing material category warning", value: missingMod } : null,
    ].filter(Boolean),
    material_effects: materialBreakdown,
    check_ability: rule?.check_ability || (recipe?.discipline === "Smithing" ? "Strength or Intelligence" : recipe?.discipline === "Alchemy" ? "Intelligence or Wisdom" : "Intelligence or Charisma"),
    check_tool: rule?.check_tool || (recipe?.discipline === "Smithing" ? "Smith's Tools" : recipe?.discipline === "Alchemy" ? "Alchemist's Supplies" : "Arcana or Enchanter's Tools"),
    result_bands: rule?.result_bands && Object.keys(rule.result_bands || {}).length ? rule.result_bands : {
      critical_success: "Beat DC by 10+: item is created with a beneficial flourish or reduced material waste.",
      success: "Meet DC: item is created as previewed.",
      partial_success: "Miss by 1-4: item may be created with a complication, reduced effect, or extra time/cost.",
      failure: "Miss by 5+: craft fails and some materials are consumed.",
      mishap: "Natural 1 or severe miss: craft fails with a mishap appropriate to the materials used.",
    },
    report_preview: `${recipe?.name || "Craft"} attempt preview: DC ${finalDc} using ${selected.length} selected material stack${selected.length === 1 ? "" : "s"}.`,
  };
}

function craftPlanInsertPayload(recipe, plan, options = {}) {
  const selectedMaterials = selectedMaterialPayload(options.selectedMaterials || {}, plan);
  const materialSnapshot = (plan?.matches || []).map((entry) => ({
    category: entry.category,
    selected_inventory_item_id: selectedMaterials.find((selected) => selected.category === entry.category)?.inventory_item_id || null,
    candidates: (entry.candidates || []).slice(0, 6).map((material) => ({
      id: material.id,
      name: material.name,
      category: material.category,
      quantity: material.quantity,
      rarity: material.rarity || null,
      source: material.source || null,
    })),
  }));

  return {
    status: "draft",
    recipe_id: recipe?.id || null,
    recipe_name: recipe?.name || "Unnamed Recipe",
    discipline: recipe?.discipline || null,
    recipe_kind: recipe?.kind || null,
    rarity: recipe?.rarity || null,
    category: recipe?.category || null,
    family: recipe?.family || null,
    target_character_id: options.targetCharacter?.id || null,
    target_character_name: options.targetCharacter ? characterName(options.targetCharacter) : null,
    target_inventory_item_id: options.baseItem?.id || null,
    target_inventory_item_name: options.baseItem?.name || null,
    selected_materials: selectedMaterials,
    result_item_name: options.resultItemName || suggestedResultName(recipe, options.baseItem) || null,
    result_item_payload: {
      recipe,
      base_item: options.baseItem || null,
      target_character: options.targetCharacter || null,
      selected_materials: selectedMaterials,
      automation_preview: options.automationPreview || null,
      created_from: "crafting_hub_draft",
    },
    material_categories: plan?.categories || [],
    missing_categories: plan?.missing || [],
    material_snapshot: materialSnapshot,
    plan_payload: {
      recipe,
      plan_notes: plan?.notes || [],
      created_from: "crafting_hub",
      ready: !!plan?.ready,
      target_character: options.targetCharacter || null,
      base_item: options.baseItem || null,
      selected_materials: selectedMaterials,
      result_item_name: options.resultItemName || suggestedResultName(recipe, options.baseItem) || null,
      automation_preview: options.automationPreview || null,
    },
  };
}

function formatSupabaseError(error) {
  if (!error) return "Unknown Supabase error.";
  return [
    error.message,
    error.details ? `Details: ${error.details}` : "",
    error.hint ? `Hint: ${error.hint}` : "",
    error.code ? `Code: ${error.code}` : "",
  ].filter(Boolean).join(" ");
}
function craftPlanRpcPayload(payload) {
  return {
    status: payload.status,
    recipe_id: payload.recipe_id,
    recipe_name: payload.recipe_name,
    discipline: payload.discipline,
    recipe_kind: payload.recipe_kind,
    rarity: payload.rarity,
    category: payload.category,
    family: payload.family,
    target_character_id: payload.target_character_id,
    target_character_name: payload.target_character_name,
    target_inventory_item_id: payload.target_inventory_item_id,
    target_inventory_item_name: payload.target_inventory_item_name,
    selected_materials: payload.selected_materials,
    result_item_name: payload.result_item_name,
    result_item_payload: payload.result_item_payload,
    material_categories: payload.material_categories,
    missing_categories: payload.missing_categories,
    material_snapshot: payload.material_snapshot,
    plan_payload: payload.plan_payload,
    created_by: payload.created_by,
  };
}

function CraftBenchTab({ recipes, materials, inventoryItems, characters, recipeRules, materialEffects, selectedRecipe, setSelectedRecipe }) {
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState("");
  const [planError, setPlanError] = useState("");
  const [targetCharacterId, setTargetCharacterId] = useState("");
  const [baseItemId, setBaseItemId] = useState("");
  const [resultItemName, setResultItemName] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState({});

  const craftableRecipes = recipes.filter((recipe) => recipe.known || recipe.discipline === "Smithing" || recipe.discipline === "Enchanting");
  const visibleRecipes = craftableRecipes.length ? craftableRecipes : recipes;
  const activeRecipe = selectedRecipe || visibleRecipes[0] || null;
  const plan = buildCraftBenchPlan(activeRecipe, materials);
  const targetCharacter = characters.find((character) => String(character.id) === String(targetCharacterId)) || null;
  const normalizedInventory = useMemo(() => inventoryItems.map(normalizeBenchInventoryItem), [inventoryItems]);
  const baseCandidates = useMemo(
    () => normalizedInventory.filter((item) => isCraftBaseCandidate(item, activeRecipe)),
    [normalizedInventory, activeRecipe]
  );
  const baseItem = baseCandidates.find((item) => String(item.id) === String(baseItemId)) || null;
  const displayedResultName = resultItemName || suggestedResultName(activeRecipe, baseItem);
  const attemptPreview = calculateCraftAttemptPreview(activeRecipe, plan, selectedMaterials, recipeRules, materialEffects);

  useEffect(() => {
    setSelectedMaterials({});
    setBaseItemId("");
    setResultItemName("");
  }, [activeRecipe?.id]);

  async function submitCraftPlan() {
    setPlanMessage("");
    setPlanError("");

    if (!activeRecipe) {
      setPlanError("Choose a recipe before creating a craft plan.");
      return;
    }

    setSubmittingPlan(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const payload = {
        ...craftPlanInsertPayload(activeRecipe, plan, {
          targetCharacter,
          baseItem,
          selectedMaterials,
          resultItemName: displayedResultName,
          automationPreview: attemptPreview,
        }),
        created_by: authData?.user?.id || null,
      };

      const { error: insertError } = await supabase.from("craft_plans").insert(payload);
      if (insertError) {
        const { error: rpcError } = await supabase.rpc("submit_craft_plan", {
          p_plan: craftPlanRpcPayload(payload),
        });
        if (rpcError) {
          throw new Error(`Direct insert failed: ${formatSupabaseError(insertError)} RPC fallback failed: ${formatSupabaseError(rpcError)}`);
        }
      }

      setPlanMessage("Craft plan saved as a draft with target/material selections.");
    } catch (error) {
      setPlanError(`Could not save craft plan. ${error?.message || "Run the included craft plan target/material SQL, then try again."}`);
    } finally {
      setSubmittingPlan(false);
    }
  }

  return (
    <div className="craft-grid-three-even craft-bench-grid craft-bench-selection-grid">
      <div className="craft-panel craft-bench-recipe-panel">
        <div className="craft-panel-head">
          <strong>Step 1: Choose Recipe</strong>
          <span className="craft-badge">{visibleRecipes.length} options</span>
        </div>
        <div className="craft-bench-recipe-list">
          {visibleRecipes.slice(0, 80).map((recipe) => (
            <button
              type="button"
              key={recipe.id}
              className={cls("craft-list-row", activeRecipe?.id === recipe.id && "craft-list-row-active")}
              onClick={() => {
                setSelectedRecipe(recipe);
                setPlanMessage("");
                setPlanError("");
              }}
            >
              <div className="min-w-0">
                <div className="craft-row-title">{recipe.name}</div>
                <div className="craft-row-meta">{recipe.discipline} • {recipe.rarity || "—"}</div>
              </div>
              <span className={cls("craft-badge", recipe.known && "craft-badge-known")}>{recipe.known ? "Known" : "Ref"}</span>
            </button>
          ))}
          {!visibleRecipes.length ? <div className="p-3 text-muted">No recipes available.</div> : null}
        </div>
      </div>

      <div className="craft-panel craft-bench-match-panel">
        <div className="craft-panel-head">
          <strong>Step 2: Target & Materials</strong>
          <span className={cls("craft-badge", plan.ready && "craft-badge-known")}>{plan.ready ? "Ready" : "Check"}</span>
        </div>
        <div className="craft-bench-body">
          <div className="craft-section craft-section-card mt-0">
            <div className="craft-section-title">Target</div>
            <label className="small text-muted mb-1">Target Character</label>
            <select className="form-select craft-input mb-2" value={targetCharacterId} onChange={(event) => setTargetCharacterId(event.target.value)}>
              <option value="">No character selected yet</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>{characterName(character)}</option>
              ))}
            </select>

            <label className="small text-muted mb-1">Base Item / Target Item</label>
            <select className="form-select craft-input mb-2" value={baseItemId} onChange={(event) => setBaseItemId(event.target.value)} disabled={activeRecipe?.kind === "forge"}>
              <option value="">{activeRecipe?.kind === "forge" ? "Forge creates a new item" : "No base item selected"}</option>
              {baseCandidates.map((item) => (
                <option key={item.id} value={item.id}>{item.name} {item.rarity ? `(${item.rarity})` : ""}</option>
              ))}
            </select>

            <label className="small text-muted mb-1">Expected Result Name</label>
            <input className="form-control craft-input" value={displayedResultName || ""} onChange={(event) => setResultItemName(event.target.value)} placeholder="Result item name" />
          </div>

          {plan.matches.map((entry) => (
            <div className="craft-match-row" key={entry.category}>
              <div className="craft-match-head">
                <span>{entry.category}</span>
                <span className={cls("craft-status-pill", entry.candidates.length && "known")}>{selectedMaterials[entry.category] ? "Selected" : entry.candidates.length ? "Available" : "Missing"}</span>
              </div>
              {entry.candidates.length ? (
                <select
                  className="form-select craft-input craft-material-select"
                  value={selectedMaterials[entry.category] || ""}
                  onChange={(event) => setSelectedMaterials((prev) => ({ ...prev, [entry.category]: event.target.value }))}
                >
                  <option value="">Choose material stack</option>
                  {entry.candidates.map((material) => (
                    <option key={material.id} value={material.id}>{material.name} x{material.quantity} {material.rarity ? `(${material.rarity})` : ""}</option>
                  ))}
                </select>
              ) : (
                <div className="craft-bullet muted">No matching material stack found.</div>
              )}
            </div>
          ))}

          {!plan.matches.length ? (
            <div className="craft-section craft-section-card">
              <div className="craft-section-title">No material rules detected</div>
              <div className="craft-bullet muted">This recipe needs explicit component rules before automatic matching can be accurate.</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="craft-preview-card craft-bench-plan-card">
        <div className="craft-preview-topline">
          <div>
            <div className="craft-kicker">Craft Plan</div>
            <h2 className="craft-preview-title">{displayedResultName || activeRecipe?.name || "No Recipe Selected"}</h2>
          </div>
          <span className={cls("craft-preview-rarity", plan.ready && "rarity-uncommon")}>{plan.ready ? "Ready" : "Draft"}</span>
        </div>

        <div className="craft-preview-summary">
          This saves target character, optional base item, and selected material stacks for DM/admin review. It still does not consume materials or create output.
        </div>

        <div className="craft-preview-chip-row">
          <span className="craft-chip craft-chip-blue">{activeRecipe?.discipline || "—"}</span>
          <span className="craft-chip">{targetCharacter ? characterName(targetCharacter) : "No character"}</span>
          <span className="craft-chip craft-chip-gold">{baseItem ? baseItem.name : activeRecipe?.kind === "forge" ? "New item" : "No base item"}</span>
          <span className={Object.values(selectedMaterials).filter(Boolean).length ? "craft-chip craft-chip-green" : "craft-chip"}>{Object.values(selectedMaterials).filter(Boolean).length} selected materials</span>
        </div>

        <div className="craft-section craft-section-card craft-automation-preview">
          <div className="craft-section-title">Attempt DC Preview</div>
          <div className="craft-dc-total">DC {attemptPreview.final_dc}</div>
          <div className="craft-bullet">• Check: {attemptPreview.check_tool} + {attemptPreview.check_ability}</div>
          {attemptPreview.breakdown.map((line) => (
            <div className="craft-dc-line" key={line.label}><span>{line.label}</span><strong>{line.value >= 0 ? "+" : ""}{line.value}</strong></div>
          ))}
        </div>

        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Material Effects</div>
          {attemptPreview.material_effects.length ? attemptPreview.material_effects.map((effect) => (
            <div className="craft-material-effect-row" key={`${effect.category}-${effect.inventory_item_id}`}>
              <strong>{effect.effect_name}</strong>
              <div>{effect.name}: {effect.effect_summary}</div>
              <span>DC +{effect.dc_modifier} • Risk: {effect.risk_summary}</span>
            </div>
          )) : <div className="craft-bullet muted">Select materials to preview DC modifiers and crafted effects.</div>}
        </div>

        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Result Bands</div>
          <div className="craft-bullet">• Critical Success: {attemptPreview.result_bands.critical_success}</div>
          <div className="craft-bullet">• Success: {attemptPreview.result_bands.success}</div>
          <div className="craft-bullet">• Partial: {attemptPreview.result_bands.partial_success}</div>
          <div className="craft-bullet">• Failure: {attemptPreview.result_bands.failure}</div>
        </div>

        <div className="craft-preview-grid">
          <div className="craft-section craft-section-card">
            <div className="craft-section-title">Selected Materials</div>
            {selectedMaterialPayload(selectedMaterials, plan).length ? selectedMaterialPayload(selectedMaterials, plan).map((material) => (
              <div className="craft-bullet" key={material.category}>• {material.category}: {material.name ? `${material.name} x${material.quantity_required}` : "Not selected"}</div>
            )) : <div className="craft-bullet muted">No material categories detected.</div>}
          </div>
          <div className="craft-section craft-section-card">
            <div className="craft-section-title">Plan Notes</div>
            {plan.notes.map((note, idx) => <div className="craft-bullet" key={idx}>• {note}</div>)}
          </div>
        </div>

        {planMessage ? <div className="craft-plan-alert success">{planMessage}</div> : null}
        {planError ? <div className="craft-plan-alert danger">{planError}</div> : null}

        <button type="button" className="btn btn-primary mt-3" onClick={submitCraftPlan} disabled={!activeRecipe || submittingPlan}>
          {submittingPlan ? "Saving Plan..." : "Create Draft Craft Plan"}
        </button>
      </div>
    </div>
  );
}

function discoveryStatusForRecipe(recipe) {
  if (!recipe) return "Unknown";
  if (recipe.known) return "Known";
  if (recipe.discipline === "Smithing") return "Reference";
  return "Hint";
}
function discoverySourceForRecipe(recipe) {
  if (!recipe) return "—";
  if (recipe.known) return "Player Journal";
  if (recipe.discipline === "Smithing") return "Town Smithing Reference";
  if (recipe.discipline === "Enchanting") return "Arcane Formula Reference";
  if (recipe.discipline === "Alchemy") return "Alchemy Notes";
  return recipe.source || "Reference";
}
function discoveryClueForRecipe(recipe) {
  if (!recipe) return "No clue available.";
  if (recipe.known) return "This recipe is known and can be used for craft planning.";
  if (recipe.discipline === "Smithing") return "A town smith or masterwork station can teach or perform this work.";
  if (recipe.discipline === "Enchanting") {
    const applies = recipe.family || recipe.category || "item";
    return `Seek an enchanter, formula, or monster/catalyst clue tied to ${applies}.`;
  }
  if (recipe.discipline === "Alchemy") return "Gather herbs, reagents, monster organs, and field notes to reveal this formula.";
  return "Discover this through NPC teaching, research, dungeon clues, faction rewards, or experimentation.";
}
function materialDiscoveryLeads(materials = [], recipes = []) {
  return materials.slice(0, 12).map((material) => {
    const hits = recipes
      .filter((recipe) => matches(recipe, material.name) || matches(recipe, material.category))
      .slice(0, 3);
    return {
      id: material.id,
      name: material.name,
      category: material.category || "Material",
      quantity: material.quantity,
      source: material.source || "Inventory",
      hits,
      clue: hits.length
        ? `This material appears connected to ${hits.map((hit) => hit.name).join(", ")}.`
        : `No direct formula match yet. ${material.category || "This material"} can become useful once alchemy and component-specific recipes are added.`,
    };
  });
}
function DiscoveryTable({ recipes, selected, onSelect }) {
  return (
    <div className="craft-table-scroll craft-discovery-table-scroll" role="region" aria-label="Discovery journal">
      <table className="craft-recipe-sheet craft-discovery-sheet">
        <thead>
          <tr>
            <th className="disc-recipe">Recipe / Formula</th>
            <th className="disc-status">Status</th>
            <th className="disc-discipline">Discipline</th>
            <th className="disc-rarity">Rarity</th>
            <th className="disc-source">Discovery Source</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => {
            const isActive = selected?.id === recipe.id;
            const status = discoveryStatusForRecipe(recipe);
            return (
              <tr key={recipe.id} className={isActive ? "active" : ""} onClick={() => onSelect(recipe)}>
                <td className="disc-recipe">
                  <div className="craft-sheet-name">{recipe.name}</div>
                  <div className="craft-sheet-source">{discoveryClueForRecipe(recipe)}</div>
                </td>
                <td className="disc-status">
                  <span className={cls("craft-discovery-status-pill", `disc-${status.toLowerCase()}`)}>{status}</span>
                </td>
                <td className="disc-discipline">
                  <span className={cls("craft-type-pill", `type-${String(recipe.discipline || "recipe").toLowerCase()}`)}>{recipe.discipline}</span>
                </td>
                <td className="disc-rarity">
                  <span className={cls("craft-rarity-pill", `rarity-${String(recipe.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{recipe.rarity || "—"}</span>
                </td>
                <td className="disc-source">
                  <span className="craft-applies-text">{discoverySourceForRecipe(recipe)}</span>
                </td>
              </tr>
            );
          })}
          {!recipes.length ? <tr><td colSpan="5" className="text-muted p-3">No discovery entries found.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
function DiscoveryPreview({ recipe, materials = [] }) {
  if (!recipe) return <div className="craft-preview-card craft-preview-empty">Select a discovery entry.</div>;
  const relatedMaterials = materials
    .filter((material) => matches(recipe, material.name) || matches(recipe, material.category))
    .slice(0, 6);
  const status = discoveryStatusForRecipe(recipe);

  return (
    <div className="craft-preview-card">
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Discovery Detail</div>
          <h2 className="craft-preview-title">{recipe.name}</h2>
        </div>
        <span className={cls("craft-preview-rarity", `disc-${status.toLowerCase()}`)}>{status}</span>
      </div>

      <div className="craft-preview-summary">
        {discoveryClueForRecipe(recipe)}
      </div>

      <div className="craft-preview-chip-row">
        <span className="craft-chip craft-chip-blue">{recipe.discipline}</span>
        <span className="craft-chip">{titleCase(recipe.kind)}</span>
        <span className="craft-chip craft-chip-gold">{recipe.rarity || "—"}</span>
        <span className={recipe.known ? "craft-chip craft-chip-green" : "craft-chip"}>{recipe.known ? "Known" : "Not learned"}</span>
      </div>

      <div className="craft-preview-grid">
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Discovery Source</div>
          <div className="craft-bullet">• {discoverySourceForRecipe(recipe)}</div>
          <div className="craft-bullet">• Original source: {recipe.source || "—"}</div>
          <div className="craft-bullet">• Applies to: {recipe.family || recipe.category || "—"}</div>
        </div>
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Related Materials</div>
          {relatedMaterials.length
            ? relatedMaterials.map((material) => <div className="craft-bullet" key={material.id}>• {material.name} x{material.quantity}</div>)
            : <div className="craft-bullet muted">No related owned material has been detected yet.</div>}
        </div>
      </div>

      <div className="craft-preview-footer">
        <span>Progression</span>
        <strong>{status}</strong>
      </div>
    </div>
  );
}
function DiscoveryLeadsPanel({ materials, recipes }) {
  const leads = materialDiscoveryLeads(materials, recipes);
  return (
    <div className="craft-panel craft-discovery-leads-panel">
      <div className="craft-panel-head">
        <strong>Material Leads</strong>
        <span className="craft-badge">{leads.length} clues</span>
      </div>
      <div className="craft-discovery-leads-list">
        {leads.map((lead) => (
          <div className="craft-lead-card" key={lead.id}>
            <div className="craft-lead-title">{lead.name}</div>
            <div className="craft-row-meta">{lead.category} • Qty x{lead.quantity} • {lead.source}</div>
            <div className="craft-lead-clue">{lead.clue}</div>
          </div>
        ))}
        {!leads.length ? <div className="p-3 text-muted">No material-based leads yet.</div> : null}
      </div>
    </div>
  );
}
function DiscoveryTab({ recipes, materials, playerRecipes, selectedRecipe, setSelectedRecipe }) {
  const sorted = [...recipes].sort((a, b) => {
    const statusSort = discoveryStatusForRecipe(a).localeCompare(discoveryStatusForRecipe(b));
    if (statusSort) return statusSort;
    return String(a.name).localeCompare(String(b.name));
  });
  const known = recipes.filter((recipe) => recipe.known).length;
  const hints = recipes.filter((recipe) => discoveryStatusForRecipe(recipe) === "Hint").length;
  const refs = recipes.filter((recipe) => discoveryStatusForRecipe(recipe) === "Reference").length;
  const active = selectedRecipe || sorted[0] || null;

  return (
    <div className="craft-discovery-layout">
      <div className="craft-panel">
        <div className="craft-panel-head"><strong>Discovery Groups</strong><span className="craft-badge">Journal</span></div>
        <button className="craft-group-row craft-list-row-active" type="button"><span>Known Recipes</span><span className="craft-badge craft-badge-known">{known}</span></button>
        <button className="craft-group-row" type="button"><span>Recipe Hints</span><span className="craft-badge">{hints}</span></button>
        <button className="craft-group-row" type="button"><span>Reference Rules</span><span className="craft-badge">{refs}</span></button>
        <button className="craft-group-row" type="button"><span>Player Recipe Rows</span><span className="craft-badge">{playerRecipes.length}</span></button>
      </div>

      <div className="craft-panel craft-discovery-table-panel">
        <div className="craft-panel-head"><strong>Discovery Journal</strong><span className="craft-badge">{sorted.length} entries</span></div>
        <DiscoveryTable recipes={sorted} selected={active} onSelect={setSelectedRecipe} />
      </div>

      <DiscoveryPreview recipe={active} materials={materials} />

      <DiscoveryLeadsPanel materials={materials} recipes={recipes} />
    </div>
  );
}



function craftPlanStatusTone(status = "") {
  const s = String(status || "").toLowerCase();
  if (s === "approved" || s === "completed") return "known";
  if (s === "rejected" || s === "cancelled") return "danger";
  if (s === "submitted") return "submitted";
  return "";
}
function normalizeCraftPlan(row) {
  const payload = row?.plan_payload && typeof row.plan_payload === "object" ? row.plan_payload : {};
  const snapshot = Array.isArray(row?.material_snapshot) ? row.material_snapshot : [];
  return {
    ...row,
    recipe_name: row?.recipe_name || payload?.recipe?.name || "Unnamed Craft Plan",
    status: row?.status || "draft",
    discipline: row?.discipline || payload?.recipe?.discipline || "—",
    recipe_kind: row?.recipe_kind || payload?.recipe?.kind || "recipe",
    rarity: row?.rarity || payload?.recipe?.rarity || "—",
    material_snapshot: snapshot,
    plan_payload: payload,
    admin_notes: row?.admin_notes || "",
    target_character_id: row?.target_character_id || payload?.target_character?.id || null,
    target_character_name: row?.target_character_name || (payload?.target_character ? characterName(payload.target_character) : null),
    target_inventory_item_id: row?.target_inventory_item_id || payload?.base_item?.id || null,
    target_inventory_item_name: row?.target_inventory_item_name || payload?.base_item?.name || null,
    selected_materials: Array.isArray(row?.selected_materials) ? row.selected_materials : Array.isArray(payload?.selected_materials) ? payload.selected_materials : [],
    result_item_name: row?.result_item_name || payload?.result_item_name || row?.recipe_name || "",
    result_item_payload: row?.result_item_payload || {},
    reviewed_at: row?.reviewed_at || null,
    reviewed_by: row?.reviewed_by || null,
    completed_at: row?.completed_at || null,
    completed_by: row?.completed_by || null,
  };
}
function CraftPlanTable({ plans, selectedPlan, onSelect }) {
  return (
    <div className="craft-table-scroll craft-plans-table-scroll" role="region" aria-label="Craft plans queue">
      <table className="craft-recipe-sheet craft-plans-sheet">
        <thead>
          <tr>
            <th className="plan-name">Plan</th>
            <th className="plan-status">Status</th>
            <th className="plan-discipline">Discipline</th>
            <th className="plan-rarity">Rarity</th>
            <th className="plan-created">Created</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => {
            const active = selectedPlan?.id === plan.id;
            return (
              <tr key={plan.id} className={active ? "active" : ""} onClick={() => onSelect(plan)}>
                <td className="plan-name">
                  <div className="craft-sheet-name">{plan.recipe_name}</div>
                  <div className="craft-sheet-source">{titleCase(plan.recipe_kind)} • {plan.category || plan.family || "—"}</div>
                </td>
                <td className="plan-status">
                  <span className={cls("craft-status-pill", craftPlanStatusTone(plan.status))}>{titleCase(plan.status)}</span>
                </td>
                <td className="plan-discipline">
                  <span className={cls("craft-type-pill", `type-${String(plan.discipline || "recipe").toLowerCase()}`)}>{plan.discipline || "—"}</span>
                </td>
                <td className="plan-rarity">
                  <span className={cls("craft-rarity-pill", `rarity-${String(plan.rarity || "varies").toLowerCase().replace(/\s+/g, "-")}`)}>{plan.rarity || "—"}</span>
                </td>
                <td className="plan-created">
                  <span className="craft-applies-text">{plan.created_at ? new Date(plan.created_at).toLocaleDateString() : "—"}</span>
                </td>
              </tr>
            );
          })}
          {!plans.length ? <tr><td colSpan="5" className="text-muted p-3">No craft plans found yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function craftPlanRequiresBaseItem(plan) {
  const kind = String(plan?.recipe_kind || "").toLowerCase();
  const discipline = String(plan?.discipline || "").toLowerCase();
  if (kind === "forge") return false;
  if (discipline === "enchanting") return true;
  if (kind.includes("temper") || kind.includes("reforge")) return true;
  return false;
}
function craftPlanCompletionReadiness(plan) {
  if (!plan) return { ready: false, checks: [] };

  const selectedMaterials = Array.isArray(plan.selected_materials) ? plan.selected_materials : [];
  const missingCategories = Array.isArray(plan.missing_categories) ? plan.missing_categories : [];
  const requiresBase = craftPlanRequiresBaseItem(plan);
  const checks = [
    {
      key: "target",
      label: "Target character selected",
      ok: Boolean(plan.target_character_id || plan.target_character_name),
      detail: plan.target_character_name || "No target character selected.",
    },
    {
      key: "result",
      label: "Expected result named",
      ok: Boolean(plan.result_item_name || plan.recipe_name),
      detail: plan.result_item_name || plan.recipe_name || "No expected result name.",
    },
    {
      key: "base",
      label: requiresBase ? "Base item selected" : "Base item not required",
      ok: !requiresBase || Boolean(plan.target_inventory_item_id || plan.target_inventory_item_name),
      detail: requiresBase ? (plan.target_inventory_item_name || "This recipe should select a base/target item.") : "Forge-style plans can create a fresh item.",
    },
    {
      key: "materials",
      label: "Material selections reviewed",
      ok: selectedMaterials.length === 0 || selectedMaterials.every((mat) => !mat.category || mat.inventory_item_id || mat.name),
      detail: selectedMaterials.length ? `${selectedMaterials.filter((mat) => mat.inventory_item_id || mat.name).length}/${selectedMaterials.length} material groups selected.` : "No explicit material groups were stored.",
    },
    {
      key: "missing",
      label: "No missing material categories",
      ok: missingCategories.length === 0,
      detail: missingCategories.length ? `Missing: ${missingCategories.join(", ")}` : "No missing material categories recorded.",
    },
  ];

  return {
    ready: checks.every((check) => check.ok),
    checks,
  };
}
function craftPlanOutputPreview(plan) {
  if (!plan) return null;
  return {
    name: plan.result_item_name || plan.recipe_name || "Unnamed Crafted Item",
    target: plan.target_character_name || "No target character",
    base: plan.target_inventory_item_name || (craftPlanRequiresBaseItem(plan) ? "No base item selected" : "New item"),
    recipe: plan.recipe_name || "Unknown recipe",
    rarity: plan.rarity || "—",
    discipline: plan.discipline || "—",
  };
}

function resolveCraftAttemptBand(rollTotal, dc) {
  const roll = Number(rollTotal);
  const target = Number(dc);
  if (!Number.isFinite(roll) || !Number.isFinite(target)) {
    return { tier: "unrolled", label: "No Roll", delta: null };
  }
  const delta = roll - target;
  if (roll <= 1) return { tier: "mishap", label: "Mishap", delta };
  if (delta >= 10) return { tier: "critical_success", label: "Critical Success", delta };
  if (delta >= 0) return { tier: "success", label: "Success", delta };
  if (delta >= -4) return { tier: "partial_success", label: "Partial Success", delta };
  return { tier: "failure", label: "Failure", delta };
}
function craftAttemptReportText(plan, rollTotal, attemptPreview, band) {
  const dc = attemptPreview?.final_dc || plan?.plan_payload?.automation_preview?.final_dc || "—";
  const materials = Array.isArray(plan?.selected_materials)
    ? plan.selected_materials.filter((mat) => mat.name).map((mat) => `${mat.name} x${mat.quantity_required || 1}`).join(", ")
    : "";
  return [
    `${plan?.target_character_name || "A crafter"} attempted ${plan?.result_item_name || plan?.recipe_name || "a craft"}.`,
    `Roll total ${rollTotal} vs DC ${dc}: ${band.label}${band.delta === null ? "" : ` (${band.delta >= 0 ? "+" : ""}${band.delta})`}.`,
    materials ? `Selected materials: ${materials}.` : "No explicit material selections were recorded.",
    "Dry-run report only: no materials were consumed and no item was created.",
  ].join(" ");
}
function craftAttemptPayload(plan, rollTotal, attemptPreview, band) {
  return {
    craft_plan_id: plan?.id || null,
    actor_character_id: plan?.target_character_id || null,
    actor_character_name: plan?.target_character_name || null,
    recipe_id: plan?.recipe_id || null,
    recipe_name: plan?.recipe_name || "Unnamed Recipe",
    roll_total: Number(rollTotal),
    dc: Number(attemptPreview?.final_dc || plan?.plan_payload?.automation_preview?.final_dc || 0),
    result_tier: band.tier,
    selected_materials: Array.isArray(plan?.selected_materials) ? plan.selected_materials : [],
    material_effects: attemptPreview?.material_effects || plan?.plan_payload?.automation_preview?.material_effects || [],
    consumed_materials: [],
    output_item_payload: {
      dry_run: true,
      output_preview: craftPlanOutputPreview(plan),
      automation_preview: attemptPreview || plan?.plan_payload?.automation_preview || null,
      result_band: band,
    },
    report_text: craftAttemptReportText(plan, rollTotal, attemptPreview, band),
  };
}

function CraftPlanPreview({ plan, onStatusChange, onNotesSave, onCompletionPrepSave, onDryRunAttempt, updatingStatus, savingNotes, savingCompletionPrep, savingAttempt }) {
  const [draftNotes, setDraftNotes] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [attemptRoll, setAttemptRoll] = useState("");

  useEffect(() => {
    setDraftNotes(plan?.admin_notes || "");
    setCompletionNotes(plan?.completion_notes || "");
  }, [plan?.id, plan?.admin_notes, plan?.completion_notes]);

  if (!plan) {
    return <div className="craft-preview-card craft-preview-empty">Select a craft plan to review.</div>;
  }

  const notes = Array.isArray(plan?.plan_payload?.plan_notes) ? plan.plan_payload.plan_notes : [];
  const missing = Array.isArray(plan?.missing_categories) ? plan.missing_categories : [];
  const materialGroups = Array.isArray(plan?.material_snapshot) ? plan.material_snapshot : [];
  const readiness = craftPlanCompletionReadiness(plan);
  const outputPreview = craftPlanOutputPreview(plan);
  const savedAttemptPreview = plan?.plan_payload?.automation_preview || plan?.result_item_payload?.automation_preview || null;
  const attemptBand = attemptRoll ? resolveCraftAttemptBand(attemptRoll, savedAttemptPreview?.final_dc) : null;

  return (
    <div className="craft-preview-card craft-plan-review-card">
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Craft Plan Review</div>
          <h2 className="craft-preview-title">{plan.result_item_name || plan.recipe_name}</h2>
        </div>
        <span className={cls("craft-preview-rarity", `plan-${String(plan.status || "draft").toLowerCase()}`)}>{titleCase(plan.status)}</span>
      </div>

      <div className="craft-preview-summary">
        Review-only queue item. Status, notes, and completion prep are persistent; material consumption and output generation are still intentionally disabled.
      </div>

      <div className="craft-preview-chip-row">
        <span className="craft-chip craft-chip-blue">{plan.discipline || "—"}</span>
        <span className="craft-chip">{titleCase(plan.recipe_kind || "recipe")}</span>
        <span className="craft-chip craft-chip-gold">{plan.rarity || "—"}</span>
        <span className={readiness.ready ? "craft-chip craft-chip-green" : "craft-chip"}>{readiness.ready ? "Ready to complete later" : "Needs review"}</span>
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Target / Result</div>
        <div className="craft-bullet">• Target character: {plan.target_character_name || "—"}</div>
        <div className="craft-bullet">• Base item: {plan.target_inventory_item_name || "—"}</div>
        <div className="craft-bullet">• Expected result: {plan.result_item_name || plan.recipe_name || "—"}</div>
      </div>

      {plan?.plan_payload?.automation_preview ? (
        <div className="craft-section craft-section-card craft-automation-preview">
          <div className="craft-section-title">Saved Attempt DC Preview</div>
          <div className="craft-dc-total">DC {plan.plan_payload.automation_preview.final_dc}</div>
          <div className="craft-bullet">• Check: {plan.plan_payload.automation_preview.check_tool} + {plan.plan_payload.automation_preview.check_ability}</div>
          {(plan.plan_payload.automation_preview.material_effects || []).map((effect) => (
            <div className="craft-material-effect-row" key={`${effect.category}-${effect.inventory_item_id}`}>
              <strong>{effect.effect_name}</strong>
              <div>{effect.name}: {effect.effect_summary}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Completion Readiness</div>
        {readiness.checks.map((check) => (
          <div className={cls("craft-readiness-row", check.ok ? "ok" : "warn")} key={check.key}>
            <span>{check.ok ? "✓" : "!"}</span>
            <div>
              <strong>{check.label}</strong>
              <div>{check.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Output Preview</div>
        <div className="craft-bullet">• Item: {outputPreview?.name || "—"}</div>
        <div className="craft-bullet">• Recipe: {outputPreview?.recipe || "—"}</div>
        <div className="craft-bullet">• Rarity: {outputPreview?.rarity || "—"}</div>
        <div className="craft-bullet">• Target: {outputPreview?.target || "—"}</div>
        <div className="craft-bullet">• Base: {outputPreview?.base || "—"}</div>
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Selected Materials</div>
        {Array.isArray(plan.selected_materials) && plan.selected_materials.length
          ? plan.selected_materials.map((material) => <div className="craft-bullet" key={material.category}>• {material.category}: {material.name || "Not selected"} {material.quantity_required ? `x${material.quantity_required}` : ""}</div>)
          : <div className="craft-bullet muted">No explicit material selections saved.</div>}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Material Snapshot</div>
        {materialGroups.length ? materialGroups.map((group) => (
          <div className="craft-plan-material-group" key={group.category}>
            <strong>{group.category}</strong>
            {(group.candidates || []).length ? (group.candidates || []).map((mat) => (
              <div className="craft-bullet" key={`${group.category}-${mat.id}`}>• {mat.name} x{mat.quantity}</div>
            )) : <div className="craft-bullet muted">• No candidate material found.</div>}
          </div>
        )) : <div className="craft-bullet muted">No material snapshot stored.</div>}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Plan Notes</div>
        {notes.length ? notes.map((note, idx) => <div className="craft-bullet" key={idx}>• {note}</div>) : <div className="craft-bullet muted">No notes saved.</div>}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Admin Review Notes</div>
        <textarea
          className="form-control craft-input craft-admin-notes"
          value={draftNotes}
          onChange={(event) => setDraftNotes(event.target.value)}
          placeholder="Add review notes, requested changes, material rulings, downtime cost, NPC crafter notes..."
          rows={4}
        />
        <div className="d-flex justify-content-between align-items-center gap-2 mt-2">
          <span className="small text-muted">Saved to craft_plans.admin_notes.</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-light"
            disabled={savingNotes}
            onClick={() => onNotesSave(plan, draftNotes)}
          >
            {savingNotes ? "Saving..." : "Save Notes"}
          </button>
        </div>
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Completion Prep Notes</div>
        <textarea
          className="form-control craft-input craft-admin-notes"
          value={completionNotes}
          onChange={(event) => setCompletionNotes(event.target.value)}
          placeholder="Record final ruling, expected output adjustments, downtime cost, or material substitutions before building the real complete transaction..."
          rows={4}
        />
        <div className="d-flex justify-content-between align-items-center gap-2 mt-2">
          <span className="small text-muted">Saved to craft_plans.completion_notes. Does not complete the plan.</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-light"
            disabled={savingCompletionPrep}
            onClick={() => onCompletionPrepSave(plan, completionNotes, outputPreview, readiness)}
          >
            {savingCompletionPrep ? "Saving..." : "Save Completion Prep"}
          </button>
        </div>
      </div>

      <div className="craft-section craft-section-card craft-attempt-card">
        <div className="craft-section-title">Dry-Run Attempt Report</div>
        <div className="craft-bullet">• Enter a d20 + modifiers total to resolve against the saved DC preview.</div>
        <div className="craft-bullet">• This writes a report to crafting_attempts only.</div>
        <div className="craft-bullet">• No materials are consumed and no item is created.</div>
        <div className="craft-attempt-controls">
          <input
            className="form-control craft-input"
            type="number"
            min="1"
            value={attemptRoll}
            onChange={(event) => setAttemptRoll(event.target.value)}
            placeholder="Roll total"
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={savingAttempt || !attemptRoll || !savedAttemptPreview?.final_dc}
            onClick={() => onDryRunAttempt(plan, attemptRoll, savedAttemptPreview)}
          >
            {savingAttempt ? "Saving..." : "Save Dry-Run Report"}
          </button>
        </div>
        {attemptBand ? (
          <div className={cls("craft-attempt-result", `attempt-${attemptBand.tier}`)}>
            <strong>{attemptBand.label}</strong>
            <span>{attemptBand.delta >= 0 ? "+" : ""}{attemptBand.delta} vs DC {savedAttemptPreview?.final_dc || "—"}</span>
          </div>
        ) : null}
      </div>

      <div className="craft-plan-actions">
        {["draft", "submitted", "approved", "rejected", "completed", "cancelled"].map((status) => (
          <button
            type="button"
            key={status}
            className={cls("btn btn-sm", plan.status === status ? "btn-primary" : "btn-outline-light")}
            disabled={updatingStatus || plan.status === status}
            onClick={() => onStatusChange(plan, status)}
          >
            {titleCase(status)}
          </button>
        ))}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Audit Trail</div>
        <div className="craft-bullet">• Created: {plan.created_at ? new Date(plan.created_at).toLocaleString() : "—"}</div>
        <div className="craft-bullet">• Reviewed: {plan.reviewed_at ? new Date(plan.reviewed_at).toLocaleString() : "—"}</div>
        <div className="craft-bullet">• Completed: {plan.completed_at ? new Date(plan.completed_at).toLocaleString() : "—"}</div>
        <div className="craft-bullet">• Updated: {plan.updated_at ? new Date(plan.updated_at).toLocaleString() : "—"}</div>
      </div>

      <div className="craft-preview-footer">
        <span>Created</span>
        <strong>{plan.created_at ? new Date(plan.created_at).toLocaleString() : "—"}</strong>
      </div>
    </div>
  );
}
function CraftPlansTab({ craftPlans, selectedPlan, setSelectedPlan, reloadPlans }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingCompletionPrep, setSavingCompletionPrep] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [planQueueMessage, setPlanQueueMessage] = useState("");
  const [planQueueError, setPlanQueueError] = useState("");

  const normalized = useMemo(() => craftPlans.map(normalizeCraftPlan), [craftPlans]);
  const filtered = useMemo(() => {
    return normalized.filter((plan) => statusFilter === "All" || plan.status === statusFilter);
  }, [normalized, statusFilter]);
  const activePlan = selectedPlan ? normalizeCraftPlan(selectedPlan) : filtered[0] || normalized[0] || null;

  async function updatePlanStatus(plan, nextStatus) {
    if (!plan?.id || !nextStatus) return;
    setUpdatingStatus(true);
    setPlanQueueMessage("");
    setPlanQueueError("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const updatePayload = {
        status: nextStatus,
      };

      if (["approved", "rejected", "cancelled", "submitted"].includes(nextStatus)) {
        updatePayload.reviewed_at = new Date().toISOString();
        updatePayload.reviewed_by = userId;
      }
      if (nextStatus === "completed") {
        updatePayload.completed_at = new Date().toISOString();
        updatePayload.completed_by = userId;
        updatePayload.reviewed_at = plan.reviewed_at || new Date().toISOString();
        updatePayload.reviewed_by = plan.reviewed_by || userId;
      }

      const { error } = await supabase
        .from("craft_plans")
        .update(updatePayload)
        .eq("id", plan.id);
      if (error) throw error;
      setPlanQueueMessage(`Craft plan marked ${titleCase(nextStatus)}.`);
      await reloadPlans(plan.id);
    } catch (error) {
      setPlanQueueError(formatSupabaseError(error));
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function savePlanNotes(plan, adminNotes) {
    if (!plan?.id) return;
    setSavingNotes(true);
    setPlanQueueMessage("");
    setPlanQueueError("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("craft_plans")
        .update({
          admin_notes: adminNotes || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: authData?.user?.id || null,
        })
        .eq("id", plan.id);
      if (error) throw error;
      setPlanQueueMessage("Admin review notes saved.");
      await reloadPlans(plan.id);
    } catch (error) {
      setPlanQueueError(formatSupabaseError(error));
    } finally {
      setSavingNotes(false);
    }
  }

  async function saveCompletionPrep(plan, completionNotes, outputPreview, readiness) {
    if (!plan?.id) return;
    setSavingCompletionPrep(true);
    setPlanQueueMessage("");
    setPlanQueueError("");
    try {
      const nextPayload = {
        ...(plan.result_item_payload && typeof plan.result_item_payload === "object" ? plan.result_item_payload : {}),
        completion_preview: outputPreview || null,
        completion_readiness: readiness || null,
        completion_prepared_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("craft_plans")
        .update({
          completion_notes: completionNotes || null,
          result_item_payload: nextPayload,
        })
        .eq("id", plan.id);
      if (error) throw error;
      setPlanQueueMessage("Completion prep saved. No materials were consumed and no item was created.");
      await reloadPlans(plan.id);
    } catch (error) {
      setPlanQueueError(formatSupabaseError(error));
    } finally {
      setSavingCompletionPrep(false);
    }
  }

  async function saveDryRunAttempt(plan, rollTotal, attemptPreview) {
    if (!plan?.id || !rollTotal) return;
    setSavingAttempt(true);
    setPlanQueueMessage("");
    setPlanQueueError("");
    try {
      const band = resolveCraftAttemptBand(rollTotal, attemptPreview?.final_dc);
      const payload = craftAttemptPayload(plan, rollTotal, attemptPreview, band);
      const { error } = await supabase.from("crafting_attempts").insert(payload);
      if (error) throw error;
      setPlanQueueMessage(`Dry-run attempt saved: ${band.label}. No materials were consumed and no item was created.`);
    } catch (error) {
      setPlanQueueError(formatSupabaseError(error));
    } finally {
      setSavingAttempt(false);
    }
  }

  return (
    <div className="craft-plans-layout">
      <div className="craft-panel">
        <div className="craft-panel-head"><strong>Plan Status</strong><span className="craft-badge">Queue</span></div>
        {["All", "draft", "submitted", "approved", "rejected", "completed", "cancelled"].map((status) => {
          const count = status === "All" ? normalized.length : normalized.filter((plan) => plan.status === status).length;
          return (
            <button
              type="button"
              key={status}
              className={cls("craft-group-row", statusFilter === status && "craft-list-row-active")}
              onClick={() => setStatusFilter(status)}
            >
              <span>{titleCase(status)}</span>
              <span className="craft-badge">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="craft-panel craft-plans-table-panel">
        <div className="craft-panel-head">
          <strong>Craft Plans Queue</strong>
          <span className="craft-badge">{filtered.length} shown</span>
        </div>
        <CraftPlanTable plans={filtered} selectedPlan={activePlan} onSelect={setSelectedPlan} />
        {planQueueMessage ? <div className="craft-plan-alert success">{planQueueMessage}</div> : null}
        {planQueueError ? <div className="craft-plan-alert danger">{planQueueError}</div> : null}
      </div>

      <CraftPlanPreview
        plan={activePlan}
        onStatusChange={updatePlanStatus}
        onNotesSave={savePlanNotes}
        onCompletionPrepSave={saveCompletionPrep}
        onDryRunAttempt={saveDryRunAttempt}
        updatingStatus={updatingStatus}
        savingNotes={savingNotes}
        savingCompletionPrep={savingCompletionPrep}
        savingAttempt={savingAttempt}
      />
    </div>
  );
}
function masteryDisciplineStats(recipes = [], materials = [], playerRecipes = []) {
  const disciplines = [
    {
      id: "smithing",
      title: "Smithing",
      icon: "⚒️",
      summary: "Forge mundane gear, temper physical items, and eventually unlock special materials and salvage recipes.",
      recipes: recipes.filter((recipe) => recipe.discipline === "Smithing"),
      materials: materials.filter((material) => material.category === "Ore / Metal" || material.category === "Monster Part"),
      unlocks: ["Forge mundane equipment", "+1 / +2 / +3 tempering", "Special ores and monster-bit catalysts", "Future salvage / dismantle recipes"],
    },
    {
      id: "enchanting",
      title: "Enchanting",
      icon: "🔮",
      summary: "Bind A/B/C magical traits to smith-tiered gear, with future +4 legendary support.",
      recipes: recipes.filter((recipe) => recipe.discipline === "Enchanting"),
      materials: materials.filter((material) => material.category === "Catalyst" || material.category === "Monster Part"),
      unlocks: ["Slot A: Uncommon", "Slot B: Uncommon + Rare", "Slot C: Uncommon + Rare + Very Rare", "Future Slot D: Legendary / +4"],
    },
    {
      id: "alchemy",
      title: "Alchemy",
      icon: "🧪",
      summary: "Brew potions, poisons, oils, and field reagents once alchemy recipes are added.",
      recipes: recipes.filter((recipe) => recipe.discipline === "Alchemy"),
      materials: materials.filter((material) => material.category === "Plant / Herb" || material.category === "Reagent" || material.category === "Monster Part"),
      unlocks: ["Plant identification", "Potion recipes", "Monster-organ distillation", "Field harvesting and recipe experimentation"],
    },
    {
      id: "harvesting",
      title: "Harvesting",
      icon: "🦴",
      summary: "Track monster parts, plant gathering, and future quality grades used by recipes.",
      recipes: recipes.filter((recipe) => /monster|harvest|plant|reagent|alchemy/i.test(recipe.summary || recipe.name || "")),
      materials,
      unlocks: ["Material quality", "Source tracking", "Biome/monster clue links", "Future gathering rolls"],
    },
  ];

  return disciplines.map((discipline) => {
    const knownRecipes = discipline.recipes.filter((recipe) => recipe.known).length;
    const totalRecipes = discipline.recipes.length;
    const materialStacks = discipline.materials.length;
    const materialQty = discipline.materials.reduce((sum, material) => sum + (Number(material.quantity) || 0), 0);
    const knownRatio = totalRecipes ? knownRecipes / totalRecipes : 0;
    const materialRatio = Math.min(1, materialStacks / 8);
    const progress = Math.round(Math.min(100, (knownRatio * 70 + materialRatio * 30)));
    let rank = "Untrained";
    if (progress >= 70) rank = "Adept";
    else if (progress >= 35) rank = "Apprentice";
    else if (knownRecipes || materialStacks) rank = "Novice";

    return {
      ...discipline,
      knownRecipes,
      totalRecipes,
      materialStacks,
      materialQty,
      progress,
      rank,
      playerRecipeRows: playerRecipes.length,
    };
  });
}
function MasteryTrackCard({ track, active, onSelect }) {
  return (
    <button type="button" className={cls("craft-mastery-card", active && "active")} onClick={() => onSelect(track.id)}>
      <div className="craft-mastery-card-top">
        <span className="craft-mastery-icon">{track.icon}</span>
        <div>
          <div className="craft-mastery-title">{track.title}</div>
          <div className="craft-row-meta">{track.rank}</div>
        </div>
        <span className="craft-badge">{track.progress}%</span>
      </div>
      <div className="craft-mastery-progress">
        <div style={{ width: `${track.progress}%` }} />
      </div>
      <div className="craft-mastery-mini-stats">
        <span>{track.knownRecipes}/{track.totalRecipes} known</span>
        <span>{track.materialStacks} stacks</span>
      </div>
    </button>
  );
}
function MasteryDetail({ track }) {
  if (!track) return <div className="craft-preview-card craft-preview-empty">Select a mastery track.</div>;
  return (
    <div className="craft-preview-card craft-mastery-detail-card">
      <div className="craft-preview-topline">
        <div>
          <div className="craft-kicker">Mastery Track</div>
          <h2 className="craft-preview-title">{track.icon} {track.title}</h2>
        </div>
        <span className="craft-preview-rarity">{track.rank}</span>
      </div>

      <div className="craft-preview-summary">{track.summary}</div>

      <div className="craft-preview-chip-row">
        <span className="craft-chip craft-chip-blue">{track.knownRecipes} known recipes</span>
        <span className="craft-chip">{track.totalRecipes} total recipes</span>
        <span className="craft-chip craft-chip-gold">{track.materialStacks} material stacks</span>
        <span className={track.progress >= 70 ? "craft-chip craft-chip-green" : "craft-chip"}>{track.progress}% progress</span>
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Unlock Roadmap</div>
        {track.unlocks.map((unlock, idx) => <div className="craft-bullet" key={idx}>• {unlock}</div>)}
      </div>

      <div className="craft-section craft-section-card">
        <div className="craft-section-title">Current Readiness</div>
        <div className="craft-bullet">• Known recipes: {track.knownRecipes}</div>
        <div className="craft-bullet">• Available reference recipes: {track.totalRecipes - track.knownRecipes}</div>
        <div className="craft-bullet">• Related material stacks: {track.materialStacks}</div>
        <div className="craft-bullet">• Related total quantity: {track.materialQty}</div>
      </div>

      <div className="craft-preview-footer">
        <span>Tracking</span>
        <strong>Read-only</strong>
      </div>
    </div>
  );
}
function MasteryTab({ recipes, materials, playerRecipes }) {
  const [activeTrack, setActiveTrack] = useState("smithing");
  const tracks = useMemo(() => masteryDisciplineStats(recipes, materials, playerRecipes), [recipes, materials, playerRecipes]);
  const selectedTrack = tracks.find((track) => track.id === activeTrack) || tracks[0];

  return (
    <div className="craft-mastery-layout">
      <div className="craft-panel craft-mastery-track-panel">
        <div className="craft-panel-head"><strong>Mastery Tracks</strong><span className="craft-badge">Progress</span></div>
        <div className="craft-mastery-track-list">
          {tracks.map((track) => <MasteryTrackCard key={track.id} track={track} active={selectedTrack?.id === track.id} onSelect={setActiveTrack} />)}
        </div>
      </div>

      <div className="craft-panel craft-mastery-matrix-panel">
        <div className="craft-panel-head"><strong>Progress Matrix</strong><span className="craft-badge">Read-only</span></div>
        <div className="craft-mastery-matrix">
          {tracks.map((track) => (
            <div className="craft-mastery-tile" key={track.id}>
              <div className="craft-mastery-tile-title">{track.icon} {track.title}</div>
              <div className="craft-mastery-tile-rank">{track.rank}</div>
              <div className="craft-mastery-progress mt-2"><div style={{ width: `${track.progress}%` }} /></div>
              <div className="craft-mastery-tile-grid">
                <div><strong>{track.knownRecipes}</strong><span>Known</span></div>
                <div><strong>{track.totalRecipes}</strong><span>Recipes</span></div>
                <div><strong>{track.materialStacks}</strong><span>Stacks</span></div>
              </div>
            </div>
          ))}
        </div>

        <div className="craft-section craft-section-card mt-3">
          <div className="craft-section-title">Future Admin Hooks</div>
          <div className="craft-bullet">• Award mastery XP or ranks after downtime, training, or quest rewards.</div>
          <div className="craft-bullet">• Assign mentor access from NPCs like Linn or Gormek.</div>
          <div className="craft-bullet">• Gate recipes by mastery rank without hiding DM reference data.</div>
          <div className="craft-bullet">• Unlock future +4 / Legendary enchantment support.</div>
        </div>
      </div>

      <MasteryDetail track={selectedTrack} />
    </div>
  );
}


export default function CraftingPage() {
  const [activeTab, setActiveTab] = useState("recipes");
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("All");
  const [knowledge, setKnowledge] = useState("All");
  const [rarityFilter, setRarityFilter] = useState("All");
  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [playerRecipes, setPlayerRecipes] = useState([]);
  const [craftPlans, setCraftPlans] = useState([]);
  const [recipeRules, setRecipeRules] = useState([]);
  const [materialEffects, setMaterialEffects] = useState([]);
  const [selectedCraftPlan, setSelectedCraftPlan] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function reloadCraftPlans(preferredId = null) {
    const rows = await selectSafe("craft_plans", "*", "created_at");
    const sorted = [...rows].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    setCraftPlans(sorted);
    setSelectedCraftPlan((prev) => {
      if (preferredId) return sorted.find((plan) => plan.id === preferredId) || sorted[0] || null;
      if (prev?.id) return sorted.find((plan) => plan.id === prev.id) || sorted[0] || null;
      return sorted[0] || null;
    });
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setErr("");
      try {
        const [itemsJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, knownRows, craftPlanRows, characterRows, recipeRuleRows, materialEffectRows] = await Promise.all([
          json("/items/all-items.json", true),
          json("/items/magicvariants.json"),
          json("/items/magicvariants.hb-armor-shield.json"),
          selectSafe("recipes", "*", "name"),
          selectSafe("inventory_items", "*", "item_name"),
          selectSafe("player_plants", "*", "name"),
          selectSafe("player_recipes", "*", "recipe_id"),
          selectSafe("craft_plans", "*", "created_at"),
          selectSafe("characters", "*", "name"),
          selectSafe("crafting_recipe_rules", "*", "discipline"),
          selectSafe("crafting_material_effects", "*", "material_category"),
        ]);
        const knownIds = new Set(knownRows.map((r) => r.recipe_id || r.recipe_name || r.name || r.id).filter(Boolean).map((v) => String(v).toLowerCase()));
        const allRecipes = [
          ...rows(itemsJson).filter(isForgeItem).map(forgeRecipe),
          ...temperRecipes(),
          ...[...rows(coreVariants), ...rows(hbVariants)].map(variantRecipe).filter(Boolean),
          ...dbRecipes.map((r) => dbRecipe(r, knownIds)),
        ].map((recipe) => {
          const keys = [recipe.id, recipe.name, recipe.key, recipe.originalName].filter(Boolean).map((v) => String(v).toLowerCase());
          return { ...recipe, known: recipe.known || keys.some((key) => knownIds.has(key)) };
        }).sort((a, b) => String(a.discipline).localeCompare(String(b.discipline)) || rarityRank(a.rarity) - rarityRank(b.rarity) || String(a.name).localeCompare(String(b.name)));
        const allMaterials = [...inventoryRows.map(materialFromInventory).filter(Boolean), ...plantRows.map(materialFromPlant)].sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const sortedCraftPlans = [...craftPlanRows].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        if (!mounted) return;
        setRecipes(allRecipes); setMaterials(allMaterials); setInventoryItems(inventoryRows); setCharacters(characterRows); setRecipeRules(recipeRuleRows); setMaterialEffects(materialEffectRows); setPlayerRecipes(knownRows); setCraftPlans(sortedCraftPlans); setSelectedCraftPlan((prev) => prev || sortedCraftPlans[0] || null); setSelected(allRecipes[0] || null); setSelectedMaterial((prev) => prev || allMaterials[0] || null);
      } catch (e) {
        if (mounted) setErr(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const disciplineOptions = useMemo(() => ["All", ...Array.from(new Set(recipes.map((r) => r.discipline).filter(Boolean))).sort()], [recipes]);
  const rarityOptions = useMemo(() => ["All", ...Array.from(new Set(recipes.map((r) => r.rarity).filter(Boolean))).sort((a, b) => rarityRank(a) - rarityRank(b))], [recipes]);
  const filteredRecipes = useMemo(() => recipes.filter((r) => (discipline === "All" || r.discipline === discipline) && (rarityFilter === "All" || r.rarity === rarityFilter) && (knowledge !== "Known" || r.known) && (knowledge !== "Reference" || !r.known) && matches(r, query)), [recipes, discipline, rarityFilter, knowledge, query]);
  const filteredMaterials = useMemo(() => materials.filter((m) => (materialCategoryFilter === "All" || m.category === materialCategoryFilter) && materialMatches(m, query)), [materials, materialCategoryFilter, query]);
  const materialTotalQty = materials.reduce((sum, material) => sum + (Number(material.quantity) || 0), 0);
  const visibleMaterialQty = filteredMaterials.reduce((sum, material) => sum + (Number(material.quantity) || 0), 0);
  const catalystCount = materials.filter((m) => m.category === "Catalyst").length;
  const monsterPartCount = materials.filter((m) => m.category === "Monster Part").length;
  const knownCount = recipes.filter((r) => r.known).length;
  const enchantCount = recipes.filter((r) => r.discipline === "Enchanting").length;
  const smithCount = recipes.filter((r) => r.discipline === "Smithing").length;
  const alchemyCount = recipes.filter((r) => r.discipline === "Alchemy").length;
  const selectedKnownRecipe = selected && selected.known ? selected : recipes.find((r) => r.known) || selected;
  const clear = () => { setQuery(""); setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); };
  const quick = (p) => { if (p === "All") { setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); } else if (p === "Known") setKnowledge("Known"); else setDiscipline(p); };

  return <div className="craft-page"><div className="container my-4"><div className="craft-hero"><div><div className="craft-kicker">Crafting Hub</div><h1>🧪 Crafting / Recipes</h1><p>Browse recipes, track materials, plan crafting, and review discovery progress.</p></div><div className="craft-hero-stats"><StatTile label="Recipes" value={recipes.length} /><StatTile label="Known" value={knownCount} tone="green" /><StatTile label="Materials" value={materials.length} tone="gold" /></div></div>
    <div className="craft-tabbar">{TABS.map(([id, icon, label]) => <button key={id} type="button" className={cls("craft-tab", activeTab === id && "craft-tab-active")} onClick={() => setActiveTab(id)}><span className="me-1">{icon}</span>{label}</button>)}</div>
    <div className="craft-controls"><div className="craft-control-wide"><label className="form-label fw-semibold">Search</label><input className="form-control craft-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, enchants, reagents, monster parts…" /></div><div><label className="form-label fw-semibold">Discipline</label><select className="form-select craft-input" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>{disciplineOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></div><div><label className="form-label fw-semibold">Knowledge</label><select className="form-select craft-input" value={knowledge} onChange={(e) => setKnowledge(e.target.value)}>{["All", "Known", "Reference"].map((v) => <option key={v} value={v}>{v}</option>)}</select></div><div><label className="form-label fw-semibold">Rarity</label><select className="form-select craft-input" value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>{rarityOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></div><div className="d-grid"><label className="form-label fw-semibold opacity-0">Clear</label><button type="button" className="btn btn-outline-light" onClick={clear}>Clear</button></div></div>
    <div className="craft-pills">{["All", "Smithing", "Enchanting", "Alchemy", "Known"].map((p) => <button key={p} type="button" className={cls("craft-pill", ((p === "All" && discipline === "All" && knowledge === "All") || discipline === p || knowledge === p) && "craft-pill-active")} onClick={() => quick(p)}>{p}</button>)}</div>
    {err ? <div className="alert alert-danger">{err}</div> : null}{loading ? <div className="text-muted">Loading crafting data…</div> : null}
    {!loading && activeTab === "recipes" ? <div className="craft-grid-main"><div className="craft-panel"><div className="craft-panel-head"><strong>Recipe Groups</strong><span className="craft-badge">Filters</span></div><button className="craft-group-row craft-list-row-active" type="button" onClick={() => setKnowledge("Known")}><span>Known Recipes</span><span className="craft-badge craft-badge-known">{knownCount}</span></button><button className="craft-group-row" type="button" onClick={() => setDiscipline("Smithing")}><span>Smithing</span><span className="craft-badge">{smithCount}</span></button><button className="craft-group-row" type="button" onClick={() => setDiscipline("Enchanting")}><span>Enchanting</span><span className="craft-badge">{enchantCount}</span></button><button className="craft-group-row" type="button" onClick={() => setDiscipline("Alchemy")}><span>Alchemy</span><span className="craft-badge">{alchemyCount}</span></button></div><div className="craft-panel craft-recipe-table-panel"><div className="craft-panel-head"><strong>Recipes Spreadsheet</strong><span className="craft-badge">{filteredRecipes.length} shown</span></div><RecipeTable recipes={filteredRecipes} selected={selected} onSelect={setSelected} /></div><RecipePreview recipe={selected} /></div> : null}
    {!loading && activeTab === "materials" ? <div className="craft-grid-main craft-materials-grid"><MaterialCategoryPanel materials={materials} activeCategory={materialCategoryFilter} setActiveCategory={setMaterialCategoryFilter} /><div className="craft-panel craft-recipe-table-panel"><div className="craft-panel-head"><strong>Materials Ledger</strong><span className="craft-badge">{filteredMaterials.length} stacks / {visibleMaterialQty} total</span></div><MaterialTable materials={filteredMaterials} selected={selectedMaterial} onSelect={setSelectedMaterial} /></div><MaterialPreview material={selectedMaterial} recipes={recipes} /></div> : null}
        {!loading && activeTab === "bench" ? <CraftBenchTab recipes={recipes} materials={materials} inventoryItems={inventoryItems} characters={characters} recipeRules={recipeRules} materialEffects={materialEffects} selectedRecipe={selected} setSelectedRecipe={setSelected} /> : null}
        {!loading && activeTab === "plans" ? <CraftPlansTab craftPlans={craftPlans} selectedPlan={selectedCraftPlan} setSelectedPlan={setSelectedCraftPlan} reloadPlans={reloadCraftPlans} /> : null}
        {!loading && activeTab === "discovery" ? <DiscoveryTab recipes={recipes} materials={materials} playerRecipes={playerRecipes} selectedRecipe={selected} setSelectedRecipe={setSelected} /> : null}
        {!loading && activeTab === "mastery" ? <MasteryTab recipes={recipes} materials={materials} playerRecipes={playerRecipes} /> : null}
    </div><style jsx global>{`
      .craft-page{min-height:calc(100vh - 56px);background:radial-gradient(circle at top left,rgba(113,65,178,.25),transparent 36%),linear-gradient(180deg,#140d20,#0e0915);color:#f4f1ff;padding-bottom:56px}.craft-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:18px;border:1px solid #342847;border-radius:18px;background:linear-gradient(180deg,#181020,#100b16);box-shadow:0 24px 70px rgba(0,0,0,.25)}.craft-kicker{color:#86bdff;font-size:11px;font-weight:900;letter-spacing:.2em;text-transform:uppercase}.craft-hero h1{margin:5px 0 4px;font-size:30px;font-weight:900}.craft-hero p,.craft-panel p,.craft-preview-card p{color:#b9b1ca}.craft-hero-stats,.craft-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(90px,1fr));gap:8px}.craft-stat{min-width:92px;padding:10px 12px;border:1px solid #3d344e;border-radius:10px;background:#1f2430}.craft-stat.green{border-color:rgba(57,201,143,.55)}.craft-stat.gold{border-color:rgba(213,175,92,.65)}.craft-stat-value{font-size:22px;font-weight:900;line-height:1}.craft-stat-label{color:#c4bad4;font-size:11px;margin-top:4px}.craft-tabbar{display:flex;flex-wrap:wrap;gap:6px;margin:18px 0 14px;border-bottom:1px solid #332a42}.craft-tab{padding:10px 14px;border:1px solid #47375f;border-bottom:0;border-radius:9px 9px 0 0;background:#171b24;color:#efeaff;font-size:13px;font-weight:800}.craft-tab-active{background:#2d2145;border-color:#8b6fc0;box-shadow:inset 0 2px 0 #d5af5c}.craft-controls{display:grid;grid-template-columns:minmax(260px,1.6fr) 180px 170px 170px auto;gap:10px;align-items:end}.craft-input{background:#202636;border-color:#404758;color:#f4f1ff}.craft-input:focus{background:#202636;color:#fff;border-color:#8b6fc0;box-shadow:0 0 0 .2rem rgba(139,92,246,.15)}.craft-pills{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 16px}.craft-pill{border:1px solid #8c7aa8;color:#f6f1ff;background:#151923;border-radius:5px;padding:6px 10px;font-size:12px}.craft-pill-active{background:#f1eef7;color:#111827}.craft-grid-main{display:grid;grid-template-columns:20% minmax(0,48%) minmax(320px,32%);gap:14px;align-items:start}.craft-grid-two{display:grid;grid-template-columns:38% 62%;gap:14px}.craft-grid-three-even{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.craft-panel,.craft-preview-card{border:1px solid #323a46;background:#1a202a;border-radius:10px;overflow:hidden}.craft-preview-card{padding:18px;background:linear-gradient(180deg,#2b2240,#1f1931);border-color:#453461;box-shadow:inset 0 2px 0 rgba(213,175,92,.75)}.craft-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #303846;background:#202636}.craft-list{max-height:68vh;overflow:auto}.craft-list-row,.craft-group-row{width:100%;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:13px 14px;border:0;border-bottom:1px solid #38404d;background:#1a202a;color:#f4f1ff;text-align:left}.craft-list-row:hover,.craft-group-row:hover{background:#222b3a}.craft-list-row-static{cursor:default}.craft-list-row-active{background:#26304a;border-left:4px solid #d5af5c;padding-left:10px}.craft-row-title{font-weight:900}.craft-row-meta{color:#cfc6df;font-size:12px;margin-top:3px}.craft-badge{display:inline-flex;align-items:center;justify-content:center;min-height:22px;padding:3px 7px;border-radius:7px;background:#646e82;color:#fff;font-size:11px;font-weight:800;white-space:nowrap}.craft-badge-known{background:#17664c}.craft-badge-material{background:#d5af5c;color:#19120f}.craft-chip{display:inline-flex;border:1px solid #4b5361;background:#313748;color:#eee9ff;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700}.craft-chip-green{border-color:rgba(57,201,143,.5);background:rgba(57,201,143,.16)}.craft-section{margin-top:10px;padding:11px;border:1px dashed #3a4251;border-radius:8px;background:#252a38}.craft-section-title{margin-bottom:5px;color:#86bdff;font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.craft-mini-card{padding:12px;border:1px solid #3d344e;border-radius:9px;background:#202636}.craft-recipe-table-panel{min-width:0;display:flex;flex-direction:column;max-height:68vh}.craft-recipe-table-panel .craft-panel-head{flex:0 0 auto}.craft-table-scroll{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain}.craft-recipe-sheet{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}.craft-recipe-sheet th{position:sticky;top:0;z-index:2;background:#202636;color:#cdbdff;text-transform:uppercase;letter-spacing:.06em;font-size:10px;padding:8px 8px;border-bottom:1px solid #3d4655;white-space:nowrap}.craft-recipe-sheet td{padding:8px 8px;border-bottom:1px solid #38404d;color:#f4f1ff;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.craft-recipe-sheet tr{cursor:pointer}.craft-recipe-sheet tbody tr:hover{background:#222b3a}.craft-recipe-sheet tbody tr.active{background:#26304a;box-shadow:inset 4px 0 0 #d5af5c}.craft-recipe-sheet .col-name{width:34%;white-space:normal}.craft-sheet-name{font-weight:900;line-height:1.15;white-space:normal}.craft-sheet-source{color:#cfc6df;font-size:10px;line-height:1.15;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.craft-status-pill{display:inline-flex;align-items:center;justify-content:center;min-width:34px;padding:3px 6px;border-radius:999px;background:#646e82;color:#fff;font-size:10px;font-weight:900}.craft-status-pill.known{background:#17664c}.min-w-0{min-width:0}@media(max-width:1200px){.craft-grid-main,.craft-grid-two,.craft-grid-three-even{grid-template-columns:1fr}.craft-list{max-height:none}}@media(max-width:992px){.craft-hero{flex-direction:column}.craft-controls{grid-template-columns:1fr}.craft-hero-stats,.craft-stat-grid{width:100%}}

        .craft-preview-card {
          position: sticky;
          top: 86px;
          align-self: start;
          min-height: 420px;
          padding: 18px;
          border: 1px solid #51406d;
          border-radius: 18px;
          background:
            radial-gradient(circle at 15% 0%, rgba(122, 92, 180, 0.38), transparent 34%),
            linear-gradient(180deg, #251b3a 0%, #171126 100%);
          box-shadow:
            inset 0 2px 0 rgba(213, 175, 92, 0.68),
            0 18px 45px rgba(0, 0, 0, 0.24);
          overflow: hidden;
        }
        .craft-preview-empty {
          color: #b9b1ca;
          font-style: italic;
        }
        .craft-preview-topline {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 12px;
        }
        .craft-preview-title {
          margin: 2px 0 0;
          font-size: 21px;
          font-weight: 950;
          line-height: 1.1;
          color: #fff8ff;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
        }
        .craft-preview-rarity {
          border: 1px solid rgba(220, 196, 255, 0.28);
          background: rgba(255, 255, 255, 0.12);
          color: #f6f1ff;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }
        .craft-preview-summary {
          margin: 12px 0;
          padding: 13px 14px;
          border: 1px solid rgba(213, 175, 92, 0.42);
          border-radius: 12px;
          background: rgba(42, 32, 66, 0.76);
          color: #eee8ff;
          line-height: 1.45;
        }
        .craft-preview-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin: 12px 0 14px;
        }
        .craft-preview-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .craft-section-card {
          border-style: solid;
          border-color: rgba(122, 101, 162, 0.58);
          background: rgba(32, 38, 54, 0.78);
        }
        .craft-bullet {
          color: #f4f1ff;
          font-size: 13px;
          line-height: 1.45;
          margin: 2px 0;
        }
        .craft-bullet.muted {
          color: #aaa0ba;
        }
        .craft-preview-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          padding: 9px 11px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          color: #aaa0ba;
          font-size: 12px;
        }
        .craft-preview-footer strong {
          color: #f5df9a;
        }

        .craft-recipe-table-panel {
          border-color: #3e4658;
          background: linear-gradient(180deg, #1a202a, #151b24);
          box-shadow: 0 16px 42px rgba(0, 0, 0, 0.2);
        }
        .craft-table-scroll {
          border-radius: 0 0 10px 10px;
          background: #121820;
        }
        .craft-recipe-sheet {
          border-collapse: separate;
          border-spacing: 0;
          font-size: 12px;
        }
        .craft-recipe-sheet th {
          top: 0;
          background: linear-gradient(180deg, #293244, #202636);
          color: #d8caff;
          border-bottom: 1px solid #655084;
          padding: 10px 9px;
        }
        .craft-recipe-sheet td {
          padding: 9px 9px;
          border-bottom: 1px solid rgba(71, 82, 103, 0.72);
          background: rgba(26, 32, 42, 0.68);
        }
        .craft-recipe-sheet tbody tr:nth-child(even) td {
          background: rgba(33, 39, 52, 0.72);
        }
        .craft-recipe-sheet tbody tr:hover td {
          background: #283247;
        }
        .craft-recipe-sheet tbody tr.active td {
          background: linear-gradient(90deg, rgba(213, 175, 92, 0.18), rgba(61, 49, 91, 0.72));
          box-shadow: inset 0 1px 0 rgba(213, 175, 92, 0.22), inset 0 -1px 0 rgba(213, 175, 92, 0.16);
        }
        .craft-recipe-sheet tbody tr.active td:first-child {
          box-shadow: inset 4px 0 0 #d5af5c, inset 0 1px 0 rgba(213, 175, 92, 0.22), inset 0 -1px 0 rgba(213, 175, 92, 0.16);
        }
        .craft-recipe-sheet .col-name { width: 34%; }
        .craft-recipe-sheet .col-known { width: 72px; text-align: center; }
        .craft-recipe-sheet .col-type { width: 108px; }
        .craft-recipe-sheet .col-rarity { width: 96px; }
        .craft-recipe-sheet .col-slot { width: 64px; text-align: center; }
        .craft-recipe-sheet .col-applies { width: 120px; }
        .craft-sheet-name {
          color: #fff8ff;
          font-size: 12.5px;
        }
        .craft-sheet-source {
          color: #8ca2c6;
          font-size: 10px;
        }
        .craft-type-pill,
        .craft-rarity-pill,
        .craft-slot-pill,
        .craft-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          max-width: 100%;
          min-height: 22px;
          padding: 3px 7px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
          border: 1px solid rgba(255,255,255,0.12);
        }
        .craft-type-pill {
          background: rgba(128, 191, 255, 0.13);
          color: #b8dcff;
        }
        .type-enchanting { background: rgba(139, 92, 246, 0.22); color: #dfd2ff; }
        .type-smithing { background: rgba(213, 175, 92, 0.18); color: #ffe4a6; }
        .type-alchemy { background: rgba(57, 201, 143, 0.16); color: #b4f4d9; }
        .craft-rarity-pill { background: #333b4d; color: #f4f1ff; }
        .rarity-mundane { background: #3d4554; color: #dbe4f3; }
        .rarity-common { background: #4b5566; color: #f3f4f6; }
        .rarity-uncommon { background: rgba(57, 201, 143, 0.20); color: #b5f5dc; }
        .rarity-rare { background: rgba(95, 157, 255, 0.22); color: #c8dcff; }
        .rarity-very-rare { background: rgba(139, 92, 246, 0.25); color: #e0d1ff; }
        .rarity-legendary { background: rgba(213, 175, 92, 0.25); color: #ffe4a6; }
        .craft-slot-pill {
          min-width: 34px;
          background: rgba(255, 255, 255, 0.08);
          color: #f4f1ff;
        }
        .craft-applies-text {
          display: inline-block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          vertical-align: bottom;
          color: #e4ddff;
        }
        .craft-chip-blue { border-color: rgba(128, 191, 255, 0.4); background: rgba(128, 191, 255, 0.12); }
        .craft-chip-gold { border-color: rgba(213, 175, 92, 0.45); background: rgba(213, 175, 92, 0.16); color: #ffe4a6; }

        .craft-materials-grid {
          grid-template-columns: 20% minmax(0, 48%) minmax(320px, 32%);
        }
        .craft-material-table-scroll {
          max-height: 68vh;
        }
        .craft-material-sheet .mat-name { width: 34%; white-space: normal; }
        .craft-material-sheet .mat-category { width: 132px; }
        .craft-material-sheet .mat-qty { width: 64px; text-align: center; }
        .craft-material-sheet .mat-rarity { width: 96px; }
        .craft-material-sheet .mat-source { width: 118px; }
        .craft-material-kind-pill,
        .craft-material-qty-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          max-width: 100%;
          min-height: 22px;
          padding: 3px 7px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }
        .craft-material-qty-pill {
          min-width: 38px;
          background: rgba(213, 175, 92, 0.22);
          color: #ffe4a6;
        }
        .craft-material-kind-pill {
          background: rgba(128, 191, 255, 0.13);
          color: #c8e4ff;
        }
        .craft-material-kind-pill.mat-metal {
          background: rgba(213, 175, 92, 0.18);
          color: #ffe4a6;
        }
        .craft-material-kind-pill.mat-monster {
          background: rgba(255, 107, 131, 0.18);
          color: #ffc0cb;
        }
        .craft-material-kind-pill.mat-catalyst {
          background: rgba(139, 92, 246, 0.25);
          color: #e0d1ff;
        }
        .craft-material-kind-pill.mat-plant {
          background: rgba(57, 201, 143, 0.18);
          color: #b5f5dc;
        }
        .craft-material-kind-pill.mat-reagent {
          background: rgba(128, 191, 255, 0.18);
          color: #c8e4ff;
        }


        .craft-bench-grid {
          grid-template-columns: 28% 34% 38%;
          align-items: start;
        }
        .craft-bench-recipe-panel,
        .craft-bench-match-panel {
          max-height: 68vh;
          display: flex;
          flex-direction: column;
        }
        .craft-bench-recipe-list,
        .craft-bench-body {
          overflow: auto;
          min-height: 0;
        }
        .craft-bench-body {
          padding: 14px;
        }
        .craft-match-row {
          margin-bottom: 12px;
          border: 1px solid rgba(122, 101, 162, 0.52);
          border-radius: 10px;
          background: rgba(32, 38, 54, 0.78);
          overflow: hidden;
        }
        .craft-match-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 9px 11px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          color: #fff8ff;
          font-weight: 900;
        }
        .craft-match-material {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 11px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          color: #ddd5ea;
          font-size: 13px;
        }
        .craft-match-material:last-child {
          border-bottom: 0;
        }
        .craft-match-material strong {
          color: #ffe4a6;
        }
        .craft-bench-plan-card {
          position: sticky;
          top: 86px;
        }

        .craft-plan-alert {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 800;
        }
        .craft-plan-alert.success {
          border: 1px solid rgba(57, 201, 143, 0.45);
          background: rgba(57, 201, 143, 0.14);
          color: #b5f5dc;
        }
        .craft-plan-alert.danger {
          border: 1px solid rgba(255, 107, 131, 0.45);
          background: rgba(255, 107, 131, 0.14);
          color: #ffc0cb;
        }


        .craft-discovery-layout {
          display: grid;
          grid-template-columns: 20% minmax(0, 48%) minmax(320px, 32%);
          grid-template-areas:
            "groups table preview"
            "leads leads preview";
          gap: 14px;
          align-items: start;
        }
        .craft-discovery-layout > .craft-panel:first-child {
          grid-area: groups;
        }
        .craft-discovery-table-panel {
          grid-area: table;
          max-height: 58vh;
          display: flex;
          flex-direction: column;
        }
        .craft-discovery-layout > .craft-preview-card {
          grid-area: preview;
          position: sticky;
          top: 86px;
        }
        .craft-discovery-leads-panel {
          grid-area: leads;
        }
        .craft-discovery-table-scroll,
        .craft-discovery-leads-list {
          overflow: auto;
          min-height: 0;
        }
        .craft-discovery-table-scroll {
          flex: 1 1 auto;
        }
        .craft-discovery-sheet .disc-recipe { width: 38%; white-space: normal; }
        .craft-discovery-sheet .disc-status { width: 88px; text-align: center; }
        .craft-discovery-sheet .disc-discipline { width: 118px; }
        .craft-discovery-sheet .disc-rarity { width: 96px; }
        .craft-discovery-sheet .disc-source { width: 150px; }
        .craft-discovery-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 22px;
          padding: 3px 7px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
          border: 1px solid rgba(255,255,255,0.12);
          background: #646e82;
          color: #fff;
        }
        .disc-known {
          background: rgba(57, 201, 143, 0.22);
          color: #b5f5dc;
        }
        .disc-hint {
          background: rgba(139, 92, 246, 0.25);
          color: #e0d1ff;
        }
        .disc-reference {
          background: rgba(128, 191, 255, 0.16);
          color: #c8e4ff;
        }
        .craft-lead-card {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(26, 32, 42, 0.78);
        }
        .craft-lead-card:nth-child(even) {
          background: rgba(33, 39, 52, 0.78);
        }
        .craft-lead-title {
          color: #fff8ff;
          font-weight: 900;
        }
        .craft-lead-clue {
          margin-top: 6px;
          color: #ddd5ea;
          font-size: 13px;
          line-height: 1.4;
        }
        @media(max-width:1200px){
          .craft-discovery-layout {
            grid-template-columns: 1fr;
            grid-template-areas:
              "groups"
              "table"
              "preview"
              "leads";
          }
          .craft-discovery-layout > .craft-preview-card {
            position: static;
          }
        }


        .craft-mastery-layout {
          display: grid;
          grid-template-columns: 26% minmax(0, 42%) minmax(320px, 32%);
          gap: 14px;
          align-items: start;
        }
        .craft-mastery-track-panel,
        .craft-mastery-matrix-panel {
          max-height: 68vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .craft-mastery-track-list {
          overflow: auto;
          min-height: 0;
          padding: 10px;
        }
        .craft-mastery-card {
          width: 100%;
          display: block;
          padding: 12px;
          margin-bottom: 10px;
          border: 1px solid rgba(122, 101, 162, 0.52);
          border-radius: 12px;
          background: rgba(26, 32, 42, 0.82);
          color: #f4f1ff;
          text-align: left;
        }
        .craft-mastery-card:hover,
        .craft-mastery-card.active {
          background: linear-gradient(90deg, rgba(213, 175, 92, 0.18), rgba(61, 49, 91, 0.72));
          border-color: rgba(213, 175, 92, 0.58);
        }
        .craft-mastery-card-top {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .craft-mastery-icon {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: rgba(139, 92, 246, 0.18);
          border: 1px solid rgba(139, 92, 246, 0.35);
          font-size: 18px;
        }
        .craft-mastery-title {
          font-weight: 950;
          color: #fff8ff;
        }
        .craft-mastery-progress {
          height: 7px;
          margin: 10px 0 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .craft-mastery-progress > div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #8b5cf6, #d5af5c);
        }
        .craft-mastery-mini-stats,
        .craft-mastery-tile-grid {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: #d7cee7;
          font-size: 12px;
        }
        .craft-mastery-matrix {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          padding: 12px;
          overflow: auto;
        }
        .craft-mastery-tile {
          padding: 12px;
          border: 1px solid rgba(122, 101, 162, 0.52);
          border-radius: 12px;
          background: rgba(32, 38, 54, 0.78);
        }
        .craft-mastery-tile-title {
          font-weight: 950;
          color: #fff8ff;
        }
        .craft-mastery-tile-rank {
          color: #f5df9a;
          font-size: 12px;
          font-weight: 900;
          margin-top: 3px;
        }
        .craft-mastery-tile-grid {
          margin-top: 10px;
        }
        .craft-mastery-tile-grid div {
          min-width: 0;
        }
        .craft-mastery-tile-grid strong {
          display: block;
          color: #fff8ff;
          font-size: 18px;
          line-height: 1;
        }
        .craft-mastery-tile-grid span {
          color: #cfc6df;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .craft-mastery-detail-card {
          position: sticky;
          top: 86px;
        }
        @media(max-width:1200px){
          .craft-mastery-layout {
            grid-template-columns: 1fr;
          }
          .craft-mastery-detail-card {
            position: static;
          }
          .craft-mastery-matrix {
            grid-template-columns: 1fr;
          }
        }


        .craft-plans-layout {
          display: grid;
          grid-template-columns: 20% minmax(0, 48%) minmax(320px, 32%);
          gap: 14px;
          align-items: start;
        }
        .craft-plans-table-panel {
          max-height: 68vh;
          display: flex;
          flex-direction: column;
        }
        .craft-plans-table-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
        }
        .craft-plans-sheet .plan-name { width: 36%; white-space: normal; }
        .craft-plans-sheet .plan-status { width: 92px; text-align: center; }
        .craft-plans-sheet .plan-discipline { width: 118px; }
        .craft-plans-sheet .plan-rarity { width: 96px; }
        .craft-plans-sheet .plan-created { width: 118px; }
        .craft-status-pill.submitted {
          background: rgba(128, 191, 255, 0.16);
          color: #c8e4ff;
        }
        .craft-status-pill.danger {
          background: rgba(255, 107, 131, 0.18);
          color: #ffc0cb;
        }
        .craft-plan-review-card {
          position: sticky;
          top: 86px;
        }
        .craft-plan-material-group {
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .craft-plan-material-group:last-child {
          border-bottom: 0;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .craft-plan-material-group strong {
          display: block;
          color: #f5df9a;
          margin-bottom: 4px;
        }


        .craft-bench-selection-grid {
          grid-template-columns: 26% minmax(0, 36%) minmax(340px, 38%);
        }
        .craft-material-select {
          margin: 10px;
          width: calc(100% - 20px);
        }
        .craft-bench-body .craft-section.mt-0 {
          margin-top: 0;
        }




        .craft-attempt-card {
          border-color: rgba(128, 191, 255, 0.35);
          background: linear-gradient(180deg, rgba(31, 41, 58, 0.92), rgba(25, 30, 43, 0.88));
        }
        .craft-attempt-controls {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          margin-top: 10px;
          align-items: center;
        }
        .craft-attempt-result {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.14);
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }
        .craft-attempt-result strong {
          color: #fff8ff;
        }
        .craft-attempt-result span {
          color: #d7cee7;
          font-size: 12px;
          font-weight: 800;
        }
        .craft-attempt-result.attempt-critical_success,
        .craft-attempt-result.attempt-success {
          background: rgba(57, 201, 143, 0.16);
          border-color: rgba(57, 201, 143, 0.42);
        }
        .craft-attempt-result.attempt-partial_success {
          background: rgba(213, 175, 92, 0.16);
          border-color: rgba(213, 175, 92, 0.42);
        }
        .craft-attempt-result.attempt-failure,
        .craft-attempt-result.attempt-mishap {
          background: rgba(255, 107, 131, 0.16);
          border-color: rgba(255, 107, 131, 0.42);
        }

        .craft-automation-preview {
          border-color: rgba(213, 175, 92, 0.48);
          background: linear-gradient(180deg, rgba(44, 37, 65, 0.92), rgba(32, 38, 54, 0.88));
        }
        .craft-dc-total {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 82px;
          margin-bottom: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(213, 175, 92, 0.22);
          border: 1px solid rgba(213, 175, 92, 0.55);
          color: #ffe4a6;
          font-size: 20px;
          font-weight: 950;
        }
        .craft-dc-line {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 5px 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          color: #ddd5ea;
          font-size: 13px;
        }
        .craft-dc-line:last-child {
          border-bottom: 0;
        }
        .craft-dc-line strong {
          color: #ffe4a6;
        }
        .craft-material-effect-row {
          padding: 9px 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          color: #ddd5ea;
          font-size: 13px;
        }
        .craft-material-effect-row:last-child {
          border-bottom: 0;
        }
        .craft-material-effect-row strong {
          display: block;
          color: #fff8ff;
          margin-bottom: 2px;
        }
        .craft-material-effect-row span {
          display: block;
          margin-top: 3px;
          color: #f5df9a;
          font-size: 12px;
        }

        .craft-readiness-row {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          color: #ddd5ea;
        }
        .craft-readiness-row:last-child {
          border-bottom: 0;
        }
        .craft-readiness-row > span {
          width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 999px;
          font-weight: 950;
          font-size: 12px;
        }
        .craft-readiness-row.ok > span {
          background: rgba(57, 201, 143, 0.22);
          color: #b5f5dc;
          border: 1px solid rgba(57, 201, 143, 0.45);
        }
        .craft-readiness-row.warn > span {
          background: rgba(255, 184, 107, 0.18);
          color: #ffe4a6;
          border: 1px solid rgba(255, 184, 107, 0.45);
        }
        .craft-readiness-row strong {
          color: #fff8ff;
        }
        .craft-readiness-row div div {
          color: #cfc6df;
          font-size: 12px;
          margin-top: 2px;
        }

        .craft-admin-notes {
          min-height: 96px;
          resize: vertical;
          color: #f4f1ff;
        }

        .craft-plan-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 12px;
        }
        .plan-approved,
        .plan-completed {
          border-color: rgba(57, 201, 143, 0.45);
          background: rgba(57, 201, 143, 0.16);
        }
        .plan-rejected,
        .plan-cancelled {
          border-color: rgba(255, 107, 131, 0.45);
          background: rgba(255, 107, 131, 0.16);
        }
        @media(max-width:1200px){
          .craft-plans-layout {
            grid-template-columns: 1fr;
          }
          .craft-plan-review-card {
            position: static;
          }
        }

      .craft-page .text-muted,
      .craft-page .small.text-muted {
        color: #cfc6df !important;
      }

      .craft-page .form-label {
        color: #f0e9ff;
      }

      .craft-preview-summary,
      .craft-bullet,
      .craft-section-card,
      .craft-applies-text,
      .craft-sheet-source,
      .craft-row-meta {
        color: #ddd5ea;
      }

      .craft-bullet.muted {
        color: #c7bfd4;
      }

      .craft-recipe-sheet tbody td {
        color: #f2eefc;
      }

      .craft-recipe-sheet tbody tr:hover td {
        color: #ffffff;
      }

      .craft-preview-footer span {
        color: #cfc6df;
      }

    `}</style></div>;
}

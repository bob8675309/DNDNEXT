// pages/items.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const TABS = [
  ["recipes", "📘", "Recipes"],
  ["materials", "🧱", "Materials"],
  ["bench", "⚒️", "Craft Bench"],
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
function materialFromInventory(row) {
  const payload = row.card_payload && typeof row.card_payload === "object" ? row.card_payload : {};
  const blob = [row.item_name, row.item_type, payload.item_type, payload.type, payload.uiType, payload.name].filter(Boolean).join(" ").toLowerCase();
  if (!/(reagent|ore|ingot|dust|hide|scale|core|essence|gem|shard|fang|eye|claw|horn|rune|sigil|heart|ichor|venom|gland|ink|oil|resin|herb|plant|mushroom|root|flower|catalyst|adamant|mithral|silver|obsidian|dragon)/.test(blob)) return null;
  return {
    id: row.id,
    name: row.item_name || payload.name || "Unknown Material",
    type: titleCase(row.item_type || payload.item_type || payload.uiType || "Material"),
    rarity: rarity(row.item_rarity || payload.rarity || payload.item_rarity || ""),
    quantity: Number(row.quantity || row.qty || payload.quantity || 1) || 1,
    source: payload.source || row.source || "Inventory",
    notes: row.item_description || payload.item_description || payload.flavor || "Owned crafting material.",
  };
}
function materialFromPlant(row) {
  return {
    id: `plant:${row.id || row.plant_id || row.name || row.plant_name}`,
    name: row.name || row.plant_name || "Unknown Plant",
    type: "Plant / Herb",
    rarity: rarity(row.rarity || ""),
    quantity: Number(row.quantity || row.qty || 1) || 1,
    source: row.biome || row.source || "Gathered",
    notes: row.description || row.notes || "Gathered alchemy ingredient.",
  };
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
            <th className="col-name">Name</th>
            <th>Known</th>
            <th>Type</th>
            <th>Rarity</th>
            <th>Slot</th>
            <th>Applies</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => {
            const isActive = selected?.id === recipe.id;
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
                <td>
                  <span className={cls("craft-status-pill", recipe.known && "known")}>{recipe.known ? "Yes" : "Ref"}</span>
                </td>
                <td>{recipe.discipline || titleCase(recipe.kind || "recipe")}</td>
                <td>{recipe.rarity || "—"}</td>
                <td>{recipeSlotLabel(recipe)}</td>
                <td>{recipe.family || recipe.category || "—"}</td>
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
function MaterialRow({ material }) {
  return <div className="craft-list-row craft-list-row-static"><div className="min-w-0"><div className="craft-row-title">{material.name}</div><div className="craft-row-meta">{material.type} • {material.rarity || "—"} • {material.source}</div></div><span className="craft-badge craft-badge-material">x{material.quantity}</span></div>;
}
function RecipePreview({ recipe }) {
  if (!recipe) return <div className="craft-panel p-4 text-muted fst-italic">Select a recipe to preview.</div>;
  return <div className="craft-preview-card"><div className="d-flex align-items-start justify-content-between gap-3 mb-2"><div><div className="craft-kicker">Recipe Preview</div><h2 className="h4 m-0">{recipe.name}</h2></div><span className="craft-badge">{recipe.rarity || "—"}</span></div><p className="mb-3">{recipe.summary || "No summary available."}</p><div className="d-flex flex-wrap gap-2 mb-3"><span className="craft-chip">{recipe.discipline}</span><span className="craft-chip">{recipe.kind}</span><span className="craft-chip">{recipe.category}</span><span className={recipe.known ? "craft-chip craft-chip-green" : "craft-chip"}>{recipe.known ? "Known" : "Reference"}</span></div><div className="craft-section"><div className="craft-section-title">Requirements</div>{(recipe.requirements || []).length ? recipe.requirements.map((line, idx) => <div key={idx}>• {line}</div>) : <div>—</div>}</div><div className="craft-section"><div className="craft-section-title">Components / Notes</div>{(recipe.components || []).length ? recipe.components.map((line, idx) => <div key={idx}>• {line}</div>) : <div>Optional materials and catalysts decided by the DM.</div>}</div><div className="small text-muted mt-3">Source: {recipe.source || "—"}</div></div>;
}

export default function CraftingPage() {
  const [activeTab, setActiveTab] = useState("recipes");
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("All");
  const [knowledge, setKnowledge] = useState("All");
  const [rarityFilter, setRarityFilter] = useState("All");
  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [playerRecipes, setPlayerRecipes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setErr("");
      try {
        const [itemsJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, knownRows] = await Promise.all([
          json("/items/all-items.json", true),
          json("/items/magicvariants.json"),
          json("/items/magicvariants.hb-armor-shield.json"),
          selectSafe("recipes", "*", "name"),
          selectSafe("inventory_items", "*", "item_name"),
          selectSafe("player_plants", "*", "name"),
          selectSafe("player_recipes", "*", "recipe_id"),
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
        if (!mounted) return;
        setRecipes(allRecipes); setMaterials(allMaterials); setPlayerRecipes(knownRows); setSelected(allRecipes[0] || null);
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
  const filteredMaterials = useMemo(() => materials.filter((m) => matches(m, query)), [materials, query]);
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
    {!loading && activeTab === "materials" ? <div className="craft-grid-two"><div className="craft-panel"><div className="craft-panel-head"><strong>Owned Materials</strong><span className="craft-badge">{filteredMaterials.length} shown</span></div><div className="craft-list">{filteredMaterials.map((m) => <MaterialRow key={m.id} material={m} />)}{!filteredMaterials.length ? <div className="p-3 text-muted">No tracked materials found.</div> : null}</div></div><div className="craft-panel p-4"><h2 className="h5">Material Ledger</h2><p className="text-muted">This tab tracks reagents, ores, monster parts, catalysts, and gathered plants. The current pass reads from inventory and optional plant tables; later it can add quantity editing and recipe matching.</p><div className="craft-stat-grid mt-3"><StatTile label="Tracked Stacks" value={materials.length} /><StatTile label="Visible Now" value={filteredMaterials.length} /><StatTile label="Known Recipes" value={knownCount} tone="green" /></div></div></div> : null}
    {!loading && activeTab === "bench" ? <div className="craft-grid-three-even"><div className="craft-panel p-4"><div className="craft-kicker">Step 1</div><h2 className="h5">Choose Recipe</h2><p className="text-muted">Use a known recipe as the starting point for a craft plan. This tab is planning-only for now.</p>{selectedKnownRecipe ? <div className="craft-mini-card mt-3"><strong>{selectedKnownRecipe.name}</strong><div className="small text-muted">{selectedKnownRecipe.discipline} • {selectedKnownRecipe.rarity}</div></div> : null}</div><div className="craft-panel p-4"><div className="craft-kicker">Step 2</div><h2 className="h5">Match Materials</h2><p className="text-muted">Future pass: check inventory materials, catalysts, ore, monster parts, town crafter access, and required stations.</p><div className="craft-section"><div className="craft-section-title">Known Material Stacks</div>{materials.slice(0, 5).map((m) => <div key={m.id}>• {m.name} x{m.quantity}</div>)}{!materials.length ? <div>None tracked yet.</div> : null}</div></div><div className="craft-panel p-4"><div className="craft-kicker">Step 3</div><h2 className="h5">Craft Plan</h2><p className="text-muted">Future pass: create an admin-reviewable craft plan instead of instantly consuming items.</p><button type="button" className="btn btn-primary mt-3" disabled>Create Craft Plan Later</button></div></div> : null}
    {!loading && activeTab === "discovery" ? <div className="craft-grid-two"><div className="craft-panel p-4"><h2 className="h5">Discovery Log</h2><p className="text-muted">Foundation tab for learned recipes, partial clues, teachers, dungeon discoveries, monster-part unlocks, and hidden recipe hints.</p><div className="craft-section"><div className="craft-section-title">Current Known Recipe Rows</div>{playerRecipes.length ? `${playerRecipes.length} known recipe records found.` : "No player_recipes rows found yet."}</div></div><div className="craft-panel p-4"><h2 className="h5">Suggested Future Tables</h2><div className="craft-section"><div className="craft-section-title">Discovery Sources</div>NPC teacher, dungeon clue, monster harvest, faction reward, book/research, town service.</div><div className="craft-section"><div className="craft-section-title">Player View</div>Unknown recipes can show hints without revealing the full requirements.</div></div></div> : null}
    {!loading && activeTab === "mastery" ? <div className="craft-grid-three-even"><div className="craft-panel p-4"><h2 className="h5">Smithing</h2><p className="text-muted">Future progression for forge/temper tiers, special materials, and masterwork stations.</p></div><div className="craft-panel p-4"><h2 className="h5">Enchanting</h2><p className="text-muted">Future progression for A/B/C/D slots, legendary +4 work, mentor access, and formula study.</p></div><div className="craft-panel p-4"><h2 className="h5">Alchemy / Harvesting</h2><p className="text-muted">Future progression for plant discovery, monster-part extraction, recipes, and reagent quality.</p></div></div> : null}
    </div><style jsx>{`
      .craft-page{min-height:calc(100vh - 56px);background:radial-gradient(circle at top left,rgba(113,65,178,.25),transparent 36%),linear-gradient(180deg,#140d20,#0e0915);color:#f4f1ff;padding-bottom:56px}.craft-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:18px;border:1px solid #342847;border-radius:18px;background:linear-gradient(180deg,#181020,#100b16);box-shadow:0 24px 70px rgba(0,0,0,.25)}.craft-kicker{color:#86bdff;font-size:11px;font-weight:900;letter-spacing:.2em;text-transform:uppercase}.craft-hero h1{margin:5px 0 4px;font-size:30px;font-weight:900}.craft-hero p,.craft-panel p,.craft-preview-card p{color:#b9b1ca}.craft-hero-stats,.craft-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(90px,1fr));gap:8px}.craft-stat{min-width:92px;padding:10px 12px;border:1px solid #3d344e;border-radius:10px;background:#1f2430}.craft-stat.green{border-color:rgba(57,201,143,.55)}.craft-stat.gold{border-color:rgba(213,175,92,.65)}.craft-stat-value{font-size:22px;font-weight:900;line-height:1}.craft-stat-label{color:#9f96af;font-size:11px;margin-top:4px}.craft-tabbar{display:flex;flex-wrap:wrap;gap:6px;margin:18px 0 14px;border-bottom:1px solid #332a42}.craft-tab{padding:10px 14px;border:1px solid #47375f;border-bottom:0;border-radius:9px 9px 0 0;background:#171b24;color:#efeaff;font-size:13px;font-weight:800}.craft-tab-active{background:#2d2145;border-color:#8b6fc0;box-shadow:inset 0 2px 0 #d5af5c}.craft-controls{display:grid;grid-template-columns:minmax(260px,1.6fr) 180px 170px 170px auto;gap:10px;align-items:end}.craft-input{background:#202636;border-color:#404758;color:#f4f1ff}.craft-input:focus{background:#202636;color:#fff;border-color:#8b6fc0;box-shadow:0 0 0 .2rem rgba(139,92,246,.15)}.craft-pills{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 16px}.craft-pill{border:1px solid #8c7aa8;color:#f6f1ff;background:#151923;border-radius:5px;padding:6px 10px;font-size:12px}.craft-pill-active{background:#f1eef7;color:#111827}.craft-grid-main{display:grid;grid-template-columns:20% minmax(0,48%) minmax(320px,32%);gap:14px;align-items:start}.craft-grid-two{display:grid;grid-template-columns:38% 62%;gap:14px}.craft-grid-three-even{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.craft-panel,.craft-preview-card{border:1px solid #323a46;background:#1a202a;border-radius:10px;overflow:hidden}.craft-preview-card{padding:18px;background:linear-gradient(180deg,#2b2240,#1f1931);border-color:#453461;box-shadow:inset 0 2px 0 rgba(213,175,92,.75)}.craft-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #303846;background:#202636}.craft-list{max-height:68vh;overflow:auto}.craft-list-row,.craft-group-row{width:100%;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:13px 14px;border:0;border-bottom:1px solid #38404d;background:#1a202a;color:#f4f1ff;text-align:left}.craft-list-row:hover,.craft-group-row:hover{background:#222b3a}.craft-list-row-static{cursor:default}.craft-list-row-active{background:#26304a;border-left:4px solid #d5af5c;padding-left:10px}.craft-row-title{font-weight:900}.craft-row-meta{color:#a99fb9;font-size:12px;margin-top:3px}.craft-badge{display:inline-flex;align-items:center;justify-content:center;min-height:22px;padding:3px 7px;border-radius:7px;background:#646e82;color:#fff;font-size:11px;font-weight:800;white-space:nowrap}.craft-badge-known{background:#17664c}.craft-badge-material{background:#d5af5c;color:#19120f}.craft-chip{display:inline-flex;border:1px solid #4b5361;background:#313748;color:#eee9ff;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:700}.craft-chip-green{border-color:rgba(57,201,143,.5);background:rgba(57,201,143,.16)}.craft-section{margin-top:10px;padding:11px;border:1px dashed #3a4251;border-radius:8px;background:#252a38}.craft-section-title{margin-bottom:5px;color:#86bdff;font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.craft-mini-card{padding:12px;border:1px solid #3d344e;border-radius:9px;background:#202636}.craft-recipe-table-panel{min-width:0;display:flex;flex-direction:column;max-height:68vh}.craft-recipe-table-panel .craft-panel-head{flex:0 0 auto}.craft-table-scroll{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain}.craft-recipe-sheet{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}.craft-recipe-sheet th{position:sticky;top:0;z-index:2;background:#202636;color:#cdbdff;text-transform:uppercase;letter-spacing:.06em;font-size:10px;padding:8px 8px;border-bottom:1px solid #3d4655;white-space:nowrap}.craft-recipe-sheet td{padding:8px 8px;border-bottom:1px solid #38404d;color:#f4f1ff;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.craft-recipe-sheet tr{cursor:pointer}.craft-recipe-sheet tbody tr:hover{background:#222b3a}.craft-recipe-sheet tbody tr.active{background:#26304a;box-shadow:inset 4px 0 0 #d5af5c}.craft-recipe-sheet .col-name{width:34%;white-space:normal}.craft-sheet-name{font-weight:900;line-height:1.15;white-space:normal}.craft-sheet-source{color:#a99fb9;font-size:10px;line-height:1.15;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.craft-status-pill{display:inline-flex;align-items:center;justify-content:center;min-width:34px;padding:3px 6px;border-radius:999px;background:#646e82;color:#fff;font-size:10px;font-weight:900}.craft-status-pill.known{background:#17664c}.min-w-0{min-width:0}@media(max-width:1200px){.craft-grid-main,.craft-grid-two,.craft-grid-three-even{grid-template-columns:1fr}.craft-list{max-height:none}}@media(max-width:992px){.craft-hero{flex-direction:column}.craft-controls{grid-template-columns:1fr}.craft-hero-stats,.craft-stat-grid{width:100%}}
    `}</style></div>;
}

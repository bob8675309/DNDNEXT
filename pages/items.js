// pages/items.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const RECIPE_TABS = ["recipes", "materials", "bench", "discovery", "mastery"];
const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
const FORGE_TYPES = new Set(["M", "R", "A", "LA", "MA", "HA", "S"]);
const FUTURE_PATTERN = /future|modern|futuristic|antimatter|laser|automatic\s+(pistol|rifle)|\b(pistol|musket|rifle|revolver|shotgun|carbine)\b|firearm\s+(bullet|needle|ammunition)|hunting rifle|modern rifle|alien firearm/i;
const PHYSICAL_VARIANT_KEYS = new Set(["enhancement", "adamantine", "mithral", "silvered", "ruidium"]);

function titleCase(value = "") {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeRarity(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("legend")) return "Legendary";
  if (text.includes("very")) return "Very Rare";
  if (text.includes("rare")) return "Rare";
  if (text.includes("uncommon")) return "Uncommon";
  if (text.includes("common")) return "Common";
  if (text === "none" || text === "mundane") return "Mundane";
  return value ? titleCase(value) : "";
}

function stripTag(value = "") {
  return String(value || "").split("|")[0].trim();
}

function safeRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.item)) return data.item;
  if (Array.isArray(data?.variants)) return data.variants;
  if (Array.isArray(data?.recipes)) return data.recipes;
  return [];
}

async function fetchJson(path, required = false) {
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

async function safeSelect(table, select, orderBy) {
  try {
    let query = supabase.from(table).select(select);
    if (orderBy) query = query.order(orderBy, { ascending: true });
    const { data, error } = await query;
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function getKindFromTypeCode(code) {
  const raw = stripTag(code).toUpperCase();
  if (raw === "S" || raw === "SH") return "shield";
  if (raw === "A") return "ammunition";
  if (["LA", "MA", "HA"].includes(raw)) return "armor";
  if (raw === "M" || raw === "R") return "weapon";
  return "gear";
}

function isMundaneForgeItem(item) {
  if (!item || typeof item !== "object") return false;
  const name = String(item.name || item.item_name || "");
  const type = stripTag(item.type || item.item_type || "").toUpperCase();
  const rarity = String(item.rarity || item.item_rarity || "").toLowerCase().trim();
  if (!name || !FORGE_TYPES.has(type)) return false;
  if (rarity && rarity !== "none" && rarity !== "mundane") return false;
  if (FUTURE_PATTERN.test([name, item.uiType, item.rawType, item.source].filter(Boolean).join(" "))) return false;
  if (item.reqAttune || item.reqAttuneTags || item.wondrous || item.bonusWeapon || item.bonusAc || item.attachedSpells) return false;
  return true;
}

function forgeRecipeFromItem(item) {
  const name = item.name || item.item_name || "Unnamed Item";
  const kind = getKindFromTypeCode(item.type || item.item_type);
  return {
    id: `forge:${name}:${item.type || kind}`,
    name: `Forge ${name}`,
    kind: "forge",
    discipline: "Smithing",
    category: kind,
    rarity: "Mundane",
    known: false,
    reference: true,
    canCraft: false,
    source: item.source || "Catalog",
    summary: `A blacksmith can craft a new mundane ${name}.`,
    requirements: [`Forge pattern: ${name}`, "Access to a suitable smithy", "Raw material cost determined by DM"],
    components: ["Metal, wood, leather, or ammunition stock as appropriate"],
    raw: item,
  };
}

function temperRecipes() {
  return [1, 2, 3].map((tier) => ({
    id: `temper:+${tier}`,
    name: `+${tier} Temper`,
    kind: "temper",
    discipline: "Smithing",
    category: "weapon / armor / shield",
    rarity: tier === 1 ? "Uncommon" : tier === 2 ? "Rare" : "Very Rare",
    known: false,
    reference: true,
    canCraft: false,
    source: "Town Smithing",
    summary: `Upgrade a physical weapon, armor, or shield to smith tier +${tier}.`,
    requirements: [`Base physical item`, `Smith capable of +${tier} work`],
    components: ["Optional ore/material", "Optional monster-bit catalyst"],
  }));
}

function normalizeVariant(raw, origin = "magicvariants") {
  if (!raw || typeof raw !== "object") return null;
  const key = String(raw.key || raw.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const name = String(raw.name || "").trim();
  if (!key || !name || PHYSICAL_VARIANT_KEYS.has(key)) return null;
  const appliesTo = Array.isArray(raw.appliesTo) ? raw.appliesTo.map((v) => String(v).toLowerCase()) : ["weapon", "armor", "shield", "ammunition"];
  const rarity = normalizeRarity(raw.rarity || (raw.rarityByValue ? "Varies" : ""));
  const source = raw.source || origin;
  const entries = Array.isArray(raw.entries) ? raw.entries : raw.entries ? [String(raw.entries)] : [];
  const summary = entries.join(" ") || raw.textByKind?.[appliesTo[0]] || `Magical trait applicable to ${appliesTo.join(", ")}.`;
  return {
    id: `enchant:${key}`,
    key,
    name: name.replace(/^Sword of\s+/i, "Weapon of "),
    originalName: name,
    kind: "enchant",
    discipline: "Enchanting",
    category: appliesTo.join(" / "),
    rarity: rarity || "Varies",
    known: false,
    reference: true,
    canCraft: false,
    source,
    summary,
    requirements: ["Smith-tiered base item", `Applies to: ${appliesTo.join(", ")}`],
    components: raw.options?.length ? [`Choose option: ${raw.options.join(", ")}`] : ["Optional catalyst or monster part"],
    raw,
  };
}

function recipeFromDb(row) {
  const known = !!row.known || !!row.is_known;
  return {
    id: `db:${row.id || row.name || row.title}`,
    name: row.name || row.title || "Unnamed Recipe",
    kind: row.recipe_type || row.kind || row.discipline || "recipe",
    discipline: titleCase(row.discipline || row.recipe_type || row.kind || "Recipe"),
    category: row.category || row.applies_to || row.item_type || "custom",
    rarity: normalizeRarity(row.rarity || row.item_rarity || ""),
    known,
    reference: !known,
    canCraft: !!row.can_craft,
    source: row.source || "Supabase",
    summary: row.description || row.summary || row.notes || "Custom recipe.",
    requirements: Array.isArray(row.requirements) ? row.requirements : row.requirements ? [String(row.requirements)] : [],
    components: Array.isArray(row.components) ? row.components : row.components ? [String(row.components)] : [],
    raw: row,
  };
}

function materialFromInventory(row) {
  const payload = row.card_payload && typeof row.card_payload === "object" ? row.card_payload : {};
  const blob = [row.item_name, row.item_type, payload.item_type, payload.type, payload.uiType].filter(Boolean).join(" ").toLowerCase();
  const isMaterial = /(reagent|ore|ingot|dust|hide|scale|core|essence|gem|shard|fang|eye|claw|horn|rune|sigil|heart|ichor|venom|gland|ink|oil|resin|herb|plant|mushroom|root|flower|catalyst)/.test(blob);
  if (!isMaterial) return null;
  return {
    id: row.id,
    name: row.item_name || "Unknown Material",
    type: titleCase(row.item_type || payload.item_type || payload.uiType || "Material"),
    rarity: normalizeRarity(row.item_rarity || payload.rarity || payload.item_rarity || ""),
    quantity: Number(row.quantity || row.qty || payload.quantity || 1) || 1,
    source: payload.source || row.source || "Inventory",
    notes: row.item_description || payload.item_description || payload.flavor || "Owned crafting material.",
    raw: row,
  };
}

function materialFromPlant(row) {
  return {
    id: `plant:${row.id || row.plant_id || row.name}`,
    name: row.name || row.plant_name || "Unknown Plant",
    type: "Plant / Herb",
    rarity: normalizeRarity(row.rarity || ""),
    quantity: Number(row.quantity || row.qty || 1) || 1,
    source: row.biome || row.source || "Gathered",
    notes: row.description || row.notes || "Gathered alchemy ingredient.",
    raw: row,
  };
}

function matchesQuery(obj, query) {
  if (!query) return true;
  const hay = Object.values(obj || {}).flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [];
    return [value];
  }).filter(Boolean).join(" ").toLowerCase();
  return hay.includes(query.toLowerCase());
}

function TabButton({ id, label, active, onClick }) {
  return (
    <button type="button" className={`btn btn-sm ${active ? "btn-light text-dark" : "btn-outline-light"}`} onClick={() => onClick(id)}>
      {label}
    </button>
  );
}

function RecipeRow({ recipe, active, onSelect }) {
  return (
    <button type="button" className={`list-group-item list-group-item-action ${active ? "active" : "bg-dark text-light"}`} onClick={() => onSelect(recipe)}>
      <div className="d-flex justify-content-between gap-2">
        <span className="fw-semibold">{recipe.name}</span>
        <span className={`badge ${recipe.known ? "bg-success" : recipe.canCraft ? "bg-info text-dark" : "bg-secondary"}`}>{recipe.known ? "Known" : recipe.canCraft ? "Ready" : recipe.rarity || "Ref"}</span>
      </div>
      <div className="small text-muted">{recipe.discipline} • {recipe.category}</div>
    </button>
  );
}

function RecipePreview({ recipe }) {
  if (!recipe) return <div className="text-muted fst-italic p-3">Select a recipe to preview.</div>;
  return (
    <div className="card sitem-card mb-4">
      <div className="card-header sitem-header d-flex align-items-center justify-content-between">
        <div className="sitem-title">{recipe.name}</div>
        <span className="badge text-bg-secondary ms-2">{recipe.rarity || "—"}</span>
      </div>
      <div className="card-body">
        <div className="d-flex flex-wrap gap-2 mb-3">
          <span className="badge text-bg-dark">{recipe.discipline}</span>
          <span className="badge text-bg-dark">{recipe.kind}</span>
          <span className="badge text-bg-dark">{recipe.category}</span>
          <span className={recipe.known ? "badge text-bg-success" : "badge text-bg-secondary"}>{recipe.known ? "Known" : "Reference"}</span>
        </div>
        <p>{recipe.summary || "No summary available."}</p>
        <div className="sitem-section mt-3">
          <div className="small text-muted mb-1">Requirements</div>
          {(recipe.requirements || []).length ? recipe.requirements.map((line, i) => <div key={i}>• {line}</div>) : <div>—</div>}
        </div>
        <div className="sitem-section mt-3">
          <div className="small text-muted mb-1">Components / Notes</div>
          {(recipe.components || []).length ? recipe.components.map((line, i) => <div key={i}>• {line}</div>) : <div>Optional materials and catalysts decided by the DM.</div>}
        </div>
        <div className="small text-muted mt-3">Source: {recipe.source || "—"}</div>
      </div>
    </div>
  );
}

function MaterialRow({ material }) {
  return (
    <div className="list-group-item bg-dark text-light">
      <div className="d-flex justify-content-between gap-2">
        <span className="fw-semibold">{material.name}</span>
        <span className="badge bg-warning text-dark">x{material.quantity}</span>
      </div>
      <div className="small text-muted">{material.type} • {material.rarity || "—"} • {material.source}</div>
    </div>
  );
}

export default function CraftingPage() {
  const [activeTab, setActiveTab] = useState("recipes");
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("All");
  const [knowledge, setKnowledge] = useState("All");
  const [rarity, setRarity] = useState("All");
  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const [itemsJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, playerRecipeRows] = await Promise.all([
          fetchJson("/items/all-items.json", true),
          fetchJson("/items/magicvariants.json", false),
          fetchJson("/items/magicvariants.hb-armor-shield.json", false),
          safeSelect("recipes", "*", "name"),
          safeSelect("inventory_items", "*", "item_name"),
          safeSelect("player_plants", "*", "name"),
          safeSelect("player_recipes", "*", "recipe_id"),
        ]);

        const knownIds = new Set(playerRecipeRows.map((row) => String(row.recipe_id || row.id || row.recipe_name || row.name || "").toLowerCase()).filter(Boolean));
        const forge = safeRows(itemsJson).filter(isMundaneForgeItem).map(forgeRecipeFromItem);
        const tempers = temperRecipes();
        const variants = [...safeRows(coreVariants), ...safeRows(hbVariants)]
          .map((row) => normalizeVariant(row, row?.source || "Variant Catalog"))
          .filter(Boolean);
        const db = dbRecipes.map(recipeFromDb);
        const allRecipes = [...forge, ...tempers, ...variants, ...db].map((recipe) => {
          const keys = [recipe.id, recipe.name, recipe.key, recipe.originalName].filter(Boolean).map((v) => String(v).toLowerCase());
          return { ...recipe, known: recipe.known || keys.some((key) => knownIds.has(key)) };
        });

        const invMaterials = inventoryRows.map(materialFromInventory).filter(Boolean);
        const plantMaterials = plantRows.map(materialFromPlant).filter(Boolean);
        const allMaterials = [...invMaterials, ...plantMaterials].sort((a, b) => String(a.name).localeCompare(String(b.name)));

        if (!mounted) return;
        setRecipes(allRecipes.sort((a, b) => String(a.name).localeCompare(String(b.name))));
        setMaterials(allMaterials);
        setSelected(allRecipes[0] || null);
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
  const rarityOptions = useMemo(() => ["All", ...Array.from(new Set(recipes.map((r) => r.rarity).filter(Boolean))).sort((a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b))], [recipes]);

  const filteredRecipes = useMemo(() => recipes.filter((recipe) => {
    if (discipline !== "All" && recipe.discipline !== discipline) return false;
    if (rarity !== "All" && recipe.rarity !== rarity) return false;
    if (knowledge === "Known" && !recipe.known) return false;
    if (knowledge === "Reference" && recipe.known) return false;
    return matchesQuery(recipe, query);
  }), [recipes, discipline, rarity, knowledge, query]);

  const filteredMaterials = useMemo(() => materials.filter((material) => matchesQuery(material, query)), [materials, query]);
  const knownCount = recipes.filter((r) => r.known).length;
  const readyCount = recipes.filter((r) => r.canCraft).length;

  return (
    <div className="container my-4 admin-dark">
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div>
          <div className="small text-uppercase text-info fw-bold" style={{ letterSpacing: "0.18em" }}>Crafting Hub</div>
          <h1 className="h3 mb-1">🧪 Crafting / Recipes</h1>
          <div className="text-muted">Browse recipes, track materials, plan crafting, and review discovery progress.</div>
        </div>
        <div className="d-flex gap-2 flex-wrap justify-content-end">
          <span className="badge text-bg-dark">{recipes.length} recipes</span>
          <span className="badge text-bg-success">{knownCount} known</span>
          <span className="badge text-bg-warning text-dark">{materials.length} materials</span>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <TabButton id="recipes" label="Recipes" active={activeTab === "recipes"} onClick={setActiveTab} />
        <TabButton id="materials" label="Materials" active={activeTab === "materials"} onClick={setActiveTab} />
        <TabButton id="bench" label="Craft Bench" active={activeTab === "bench"} onClick={setActiveTab} />
        <TabButton id="discovery" label="Discovery" active={activeTab === "discovery"} onClick={setActiveTab} />
        <TabButton id="mastery" label="Mastery" active={activeTab === "mastery"} onClick={setActiveTab} />
      </div>

      <div className="row g-2 align-items-end mb-2">
        <div className="col-12 col-lg-4">
          <label className="form-label fw-semibold">Search</label>
          <input className="form-control" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, enchants, reagents, monster parts…" />
        </div>
        <div className="col-6 col-lg-2">
          <label className="form-label fw-semibold">Discipline</label>
          <select className="form-select" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
            {disciplineOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="col-6 col-lg-2">
          <label className="form-label fw-semibold">Knowledge</label>
          <select className="form-select" value={knowledge} onChange={(e) => setKnowledge(e.target.value)}>
            {['All', 'Known', 'Reference'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="col-6 col-lg-2">
          <label className="form-label fw-semibold">Rarity</label>
          <select className="form-select" value={rarity} onChange={(e) => setRarity(e.target.value)}>
            {rarityOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="col-6 col-lg-2 d-grid">
          <button type="button" className="btn btn-outline-secondary" onClick={() => { setQuery(''); setDiscipline('All'); setKnowledge('All'); setRarity('All'); }}>Clear</button>
        </div>
      </div>

      <div className="mb-3 d-flex flex-wrap gap-2">
        {['All', 'Smithing', 'Enchanting', 'Alchemy', 'Known'].map((pill) => (
          <button key={pill} type="button" className={`btn btn-sm ${(pill === 'All' && discipline === 'All' && knowledge === 'All') || discipline === pill || knowledge === pill ? 'btn-light text-dark' : 'btn-outline-light'}`} onClick={() => {
            if (pill === 'All') { setDiscipline('All'); setKnowledge('All'); }
            else if (pill === 'Known') setKnowledge('Known');
            else setDiscipline(pill);
          }}>{pill}</button>
        ))}
      </div>

      {err ? <div className="alert alert-danger">{err}</div> : null}
      {loading ? <div className="text-muted">Loading crafting data…</div> : null}

      {!loading && activeTab === "recipes" ? (
        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="list-group list-group-flush">
              {filteredRecipes.map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} active={selected?.id === recipe.id} onSelect={setSelected} />)}
              {!filteredRecipes.length ? <div className="p-3 text-muted">No recipes found.</div> : null}
            </div>
          </div>
          <div className="col-12 col-lg-7"><RecipePreview recipe={selected} /></div>
        </div>
      ) : null}

      {!loading && activeTab === "materials" ? (
        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="list-group list-group-flush">
              {filteredMaterials.map((material) => <MaterialRow key={material.id} material={material} />)}
              {!filteredMaterials.length ? <div className="p-3 text-muted">No tracked materials found.</div> : null}
            </div>
          </div>
          <div className="col-12 col-lg-7">
            <div className="card bg-dark text-light border-secondary">
              <div className="card-body">
                <h2 className="h5">Material Ledger</h2>
                <p className="text-muted">This tab is the foundation for reagents, ores, monster parts, catalysts, and gathered plants. Later it can support direct quantity edits, discovery sources, and recipe matching.</p>
                <div className="row g-2 mt-3">
                  <div className="col"><div className="p-3 border rounded bg-black"><div className="h4">{materials.length}</div><div className="small text-muted">Tracked stacks</div></div></div>
                  <div className="col"><div className="p-3 border rounded bg-black"><div className="h4">{filteredMaterials.length}</div><div className="small text-muted">Visible now</div></div></div>
                  <div className="col"><div className="p-3 border rounded bg-black"><div className="h4">{readyCount}</div><div className="small text-muted">Craftable recipes</div></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && activeTab === "bench" ? (
        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="card bg-dark text-light border-secondary"><div className="card-body"><h2 className="h5">Step 1: Choose Recipe</h2><p className="text-muted">Select a known recipe or reference recipe to plan a craft. This is planning-only for now.</p></div></div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="card bg-dark text-light border-secondary"><div className="card-body"><h2 className="h5">Step 2: Match Materials</h2><p className="text-muted">Future pass: check inventory materials, catalysts, ore, monster parts, and town crafter access.</p></div></div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="card bg-dark text-light border-secondary"><div className="card-body"><h2 className="h5">Step 3: Craft Plan</h2><p className="text-muted">Future pass: create an admin-reviewable craft plan instead of instantly consuming items.</p></div></div>
          </div>
        </div>
      ) : null}

      {!loading && activeTab === "discovery" ? (
        <div className="card bg-dark text-light border-secondary"><div className="card-body"><h2 className="h5">Discovery Log</h2><p className="text-muted">Foundation tab for learned recipes, partial clues, teachers, dungeon discoveries, monster-part unlocks, and hidden recipe hints.</p></div></div>
      ) : null}

      {!loading && activeTab === "mastery" ? (
        <div className="card bg-dark text-light border-secondary"><div className="card-body"><h2 className="h5">Mastery</h2><p className="text-muted">Foundation tab for player crafting progression: Smithing, Enchanting, Alchemy, Harvesting, mentor access, and future +4/legendary unlocks.</p></div></div>
      ) : null}
    </div>
  );
}

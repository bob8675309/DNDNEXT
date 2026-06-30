import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "components", "CraftingWorkspace.js");
let source = fs.readFileSync(target, "utf8");

function replaceRequired(before, after, label) {
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

function replaceBetween(startMarker, endMarker, replacement, label) {
  if (source.includes(replacement)) return;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`${label}: markers not found`);
  source = source.slice(0, start) + replacement + "\n" + source.slice(end);
}

function requireToken(token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}
function requireAbsent(token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

replaceRequired(
  'export default function CraftingWorkspace({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, startView = "recipes", showDisciplineSwitcher = true } = {}) {',
  'export default function CraftingWorkspace({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, isAdmin = false, startView = "recipes", showDisciplineSwitcher = true } = {}) {',
  "CraftingWorkspace admin prop"
);

replaceBetween(
  'function recipeSlotLabel(recipe) {',
  'function MaterialTable({ materials, selected, onSelect }) {',
  String.raw`function recipeSlotLabel(recipe) {
  if (!recipe || recipe.discipline !== "Enchanting") return "—";
  const r = rarity(recipe.rarity);
  if (r === "Uncommon") return "A+";
  if (r === "Rare") return "B+";
  if (r === "Very Rare") return "C";
  if (r === "Legendary") return "D later";
  return "—";
}
function crafterRecipeKey(recipe = {}) {
  return String(recipe.id || recipe.recipe_id || recipe.key || recipe.originalName || recipe.name || "").trim().toLowerCase();
}
function recipeIdForKnownSave(recipe = {}) {
  const value = String(recipe.recipe_id || recipe.id || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : "";
}
function normalizeKnownRecipeRow(row = {}) {
  return String(row.recipe_key || row.recipeKey || row.recipe_id || row.recipeId || row.id || "").trim().toLowerCase();
}
function recipeSortValue(recipe = {}, key = "name") {
  if (key === "known") return recipe.crafterKnown || recipe.known ? 1 : 0;
  if (key === "type") return String(recipe.discipline || recipe.kind || "").toLowerCase();
  if (key === "rarity") return rarityRank(recipe.rarity);
  if (key === "slot") return recipeSlotLabel(recipe);
  if (key === "applies") return String(recipe.discipline === "Alchemy" ? alchemySectionForRecipe(recipe) : recipe.family || recipe.category || "").toLowerCase();
  if (key === "craft") return recipe.kind === "forge" ? 0 : 1;
  return String(recipe.name || "").toLowerCase();
}
function RecipeSortHeader({ label, column, sortSpec, setSortSpec, className = "" }) {
  const active = sortSpec.key === column;
  const arrow = active ? (sortSpec.dir === "asc" ? "▲" : "▼") : "";
  return <th className={className}><button type="button" className={cls("craft-sort-header", active && "active")} onClick={() => setSortSpec((prev) => ({ key: column, dir: prev.key === column && prev.dir === "asc" ? "desc" : "asc" }))}>{label} <span>{arrow}</span></button></th>;
}
function RecipeTable({ recipes, selected, onSelect, onCraft, craftingRecipeId = null, canEditKnown = false, onToggleKnown = null }) {
  const [sortSpec, setSortSpec] = useState({ key: "name", dir: "asc" });
  const sortedRecipes = useMemo(() => {
    const dir = sortSpec.dir === "desc" ? -1 : 1;
    return [...recipes].sort((a, b) => {
      const av = recipeSortValue(a, sortSpec.key);
      const bv = recipeSortValue(b, sortSpec.key);
      if (typeof av === "number" && typeof bv === "number" && av !== bv) return (av - bv) * dir;
      const cmp = String(av).localeCompare(String(bv));
      if (cmp) return cmp * dir;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [recipes, sortSpec]);
  return (
    <div className="craft-table-scroll" role="region" aria-label="Recipe spreadsheet">
      <table className="craft-recipe-sheet">
        <thead>
          <tr>
            <RecipeSortHeader label="Recipe" column="name" className="col-name" sortSpec={sortSpec} setSortSpec={setSortSpec} />
            <RecipeSortHeader label="Known" column="known" className="col-known" sortSpec={sortSpec} setSortSpec={setSortSpec} />
            <RecipeSortHeader label="Type" column="type" className="col-type" sortSpec={sortSpec} setSortSpec={setSortSpec} />
            <RecipeSortHeader label="Rarity" column="rarity" className="col-rarity" sortSpec={sortSpec} setSortSpec={setSortSpec} />
            <RecipeSortHeader label="Slot" column="slot" className="col-slot" sortSpec={sortSpec} setSortSpec={setSortSpec} />
            <RecipeSortHeader label="Applies" column="applies" className="col-applies" sortSpec={sortSpec} setSortSpec={setSortSpec} />
            <RecipeSortHeader label="Craft" column="craft" className="col-craft" sortSpec={sortSpec} setSortSpec={setSortSpec} />
          </tr>
        </thead>
        <tbody>
          {sortedRecipes.map((recipe) => {
            const isActive = selected?.id === recipe.id;
            const cleanKind = titleCase(recipe.kind || "recipe");
            return (
              <tr key={recipe.id} className={isActive ? "active" : ""} onClick={() => onSelect(recipe)} onDoubleClick={() => onCraft?.(recipe)}>
                <td className="col-name"><div className="craft-sheet-name">{recipe.name}</div><div className="craft-sheet-source">{recipe.source || "—"}</div></td>
                <td className="col-known">
                  {canEditKnown ? <label className="craft-known-check" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={!!recipe.crafterKnown} onChange={(event) => onToggleKnown?.(recipe, event.target.checked)} /><span>{recipe.crafterKnown ? "Yes" : "No"}</span></label> : <span className={cls("craft-status-pill", recipe.known && "known")}>{recipe.known ? "Known" : "Ref"}</span>}
                </td>
                <td className="col-type"><span className={cls("craft-type-pill", "type-" + String(recipe.discipline || "recipe").toLowerCase())}>{recipe.discipline || cleanKind}</span></td>
                <td className="col-rarity"><span className={cls("craft-rarity-pill", "rarity-" + String(recipe.rarity || "varies").toLowerCase().replace(/\s+/g, "-"))}>{recipe.rarity || "—"}</span></td>
                <td className="col-slot"><span className="craft-slot-pill">{recipeSlotLabel(recipe)}</span></td>
                <td className="col-applies"><span className="craft-applies-text">{recipe.discipline === "Alchemy" ? alchemySectionForRecipe(recipe) : recipe.family || recipe.category || "—"}</span></td>
                <td className="col-craft"><button type="button" className={cls("craft-row-craft-button", craftingRecipeId === recipe.id && "active")} onClick={(event) => { event.stopPropagation(); onCraft?.(recipe); }} title="Open this recipe's ingredient selector">{craftingRecipeId === recipe.id ? "Back" : "Craft"}</button></td>
              </tr>
            );
          })}
          {!recipes.length ? <tr><td colSpan="7" className="text-muted p-3">No recipes found.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}`,
  "RecipeTable sortable/known replacement"
);

replaceRequired(
  '  const router = useRouter();\n  const lockedDiscipline = normalizeCraftingDisciplineLock(disciplineLock);\n  const isPanelMode = mode !== "page";\n  const workshopQueryApplied = useRef("");',
  '  const router = useRouter();\n  const lockedDiscipline = normalizeCraftingDisciplineLock(disciplineLock);\n  const isPanelMode = mode !== "page";\n  const isNpcCrafterPanel = isPanelMode && !!crafterId;\n  const panelCraftTabs = TABS.filter(([id]) => ["recipes", "forage", "mastery"].includes(id));\n  const workshopQueryApplied = useRef("");',
  "CraftingWorkspace panel mode constants"
);

replaceRequired(
  '  const [loading, setLoading] = useState(true);\n  const [err, setErr] = useState("");',
  '  const [loading, setLoading] = useState(true);\n  const [err, setErr] = useState("");\n  const [crafterKnownRecipeIds, setCrafterKnownRecipeIds] = useState(() => new Set());\n  const [crafterKnownSaveState, setCrafterKnownSaveState] = useState("");',
  "CraftingWorkspace crafter known state"
);

replaceRequired(
  `  function toggleAdminResourceOverride() {
    setAdminResourceOverride((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        if (next) window.localStorage?.setItem("dndnextCraftAdmin", "1");
        else window.localStorage?.removeItem("dndnextCraftAdmin");
      }
      return next;
    });
  }`,
  `  function toggleAdminResourceOverride() {
    setAdminResourceOverride((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        if (next) window.localStorage?.setItem("dndnextCraftAdmin", "1");
        else window.localStorage?.removeItem("dndnextCraftAdmin");
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadCrafterKnownRecipes() {
      if (!isNpcCrafterPanel || !crafterId) {
        setCrafterKnownRecipeIds(new Set());
        setCrafterKnownSaveState("");
        return;
      }

      setCrafterKnownSaveState("");
      const { data, error } = await supabase
        .from("npc_known_recipes")
        .select("recipe_key, recipe_id")
        .eq("character_id", crafterId);

      if (cancelled) return;
      if (error) {
        console.warn("Could not load crafter recipe access", error.message || error);
        setCrafterKnownRecipeIds(new Set());
        setCrafterKnownSaveState("Could not load recipe access.");
        return;
      }

      setCrafterKnownRecipeIds(new Set((data || []).map(normalizeKnownRecipeRow).filter(Boolean)));
    }

    loadCrafterKnownRecipes();
    return () => {
      cancelled = true;
    };
  }, [isNpcCrafterPanel, crafterId]);

  useEffect(() => {
    if (!isPanelMode) return;
    if (["materials", "plans", "discovery"].includes(activeTab)) setActiveTab("recipes");
  }, [isPanelMode, activeTab]);

  async function toggleCrafterKnownRecipe(recipe, nextKnown) {
    if (!isAdmin || !isNpcCrafterPanel || !recipe || !crafterId) return;
    const key = crafterRecipeKey(recipe);
    const recipeId = recipeIdForKnownSave(recipe);
    if (!key) return;

    const previous = new Set(crafterKnownRecipeIds);
    const next = new Set(crafterKnownRecipeIds);
    if (nextKnown) next.add(key);
    else next.delete(key);
    setCrafterKnownRecipeIds(next);
    setCrafterKnownSaveState("Saving recipe access...");

    try {
      if (nextKnown) {
        const { error } = await supabase
          .from("npc_known_recipes")
          .upsert({ character_id: crafterId, recipe_key: key, recipe_id: recipeId || null }, { onConflict: "character_id,recipe_key" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("npc_known_recipes")
          .delete()
          .eq("character_id", crafterId)
          .eq("recipe_key", key);
        if (error) throw error;
      }
      setCrafterKnownSaveState("Recipe access saved.");
    } catch (error) {
      console.error("Could not save crafter recipe access", error);
      setCrafterKnownRecipeIds(previous);
      setCrafterKnownSaveState("Could not save recipe access.");
    }
  }`,
  "CraftingWorkspace DB-backed crafter known toggle helpers"
);

replaceRequired(
  '  const filteredRecipes = useMemo(() => recipes.filter((r) => {\n    const disciplineMatch = discipline === "All" || r.discipline === discipline;',
  '  const effectiveRecipes = useMemo(() => recipes.map((recipe) => {\n    if (!isNpcCrafterPanel) return recipe;\n    const key = crafterRecipeKey(recipe);\n    const crafterKnown = key ? crafterKnownRecipeIds.has(key) : false;\n    return { ...recipe, crafterKnown, known: recipe.known || crafterKnown };\n  }), [recipes, isNpcCrafterPanel, crafterKnownRecipeIds]);\n  const hasCrafterKnownConfig = isNpcCrafterPanel && crafterKnownRecipeIds.size > 0;\n  const filteredRecipes = useMemo(() => effectiveRecipes.filter((r) => {\n    const crafterGate = !isNpcCrafterPanel || isAdmin || !hasCrafterKnownConfig || !!r.crafterKnown;\n    const disciplineMatch = discipline === "All" || r.discipline === discipline;',
  "CraftingWorkspace effective crafter known recipes"
);

replaceRequired(
  '    return disciplineMatch && sectionMatch && groupMatch && enchantingMatch && smithingMatch && (rarityFilter === "All" || r.rarity === rarityFilter) && (knowledge !== "Known" || r.known) && (knowledge !== "Reference" || !r.known) && matches(r, query);\n  }), [recipes, discipline, alchemySection, alchemyGroup, enchantingSection, smithingSection, rarityFilter, knowledge, query]);',
  '    return crafterGate && disciplineMatch && sectionMatch && groupMatch && enchantingMatch && smithingMatch && (rarityFilter === "All" || r.rarity === rarityFilter) && (knowledge !== "Known" || r.known) && (knowledge !== "Reference" || !r.known) && matches(r, query);\n  }), [effectiveRecipes, isNpcCrafterPanel, isAdmin, hasCrafterKnownConfig, discipline, alchemySection, alchemyGroup, enchantingSection, smithingSection, rarityFilter, knowledge, query]);',
  "CraftingWorkspace filtered recipes crafter gate"
);

replaceRequired('  const knownCount = recipes.filter((r) => r.known).length;', '  const knownCount = effectiveRecipes.filter((r) => r.known).length;', "CraftingWorkspace known count from effective recipes");
replaceRequired('  const selectedKnownRecipe = selected && selected.known ? selected : recipes.find((r) => r.known) || selected;', '  const selectedKnownRecipe = selected && selected.known ? selected : effectiveRecipes.find((r) => r.known) || selected;', "CraftingWorkspace selected known recipe from effective recipes");

replaceRequired(
  '  return <div className="craft-page"><div className="container my-4"><div className="craft-hero"><div><div className="craft-kicker">Crafting Hub</div><h1>🧪 Crafting / Recipes</h1><p>Browse recipes, track materials, plan crafting, and review discovery progress.</p></div><div className="craft-hero-stats"><StatTile label="Recipes" value={recipes.length} /><StatTile label="Known" value={knownCount} tone="green" /><StatTile label="Materials" value={materials.length} tone="gold" /><button type="button" className={cls("craft-admin-resource-toggle", isAdminTestResources && "active")} onClick={toggleAdminResourceOverride} title="Admin testing: treat every crafting resource as available.">{isAdminTestResources ? "Admin Resources: ON" : "Admin Resources: OFF"}</button></div></div>',
  '  return <div className={cls("craft-page", isPanelMode && "craft-page-panel-mode")}><div className="container my-4"><div className={cls("craft-hero", isPanelMode && "craft-hero-crafter-assist")}><div><div className="craft-kicker">{isPanelMode ? "Assisting Crafter" : "Crafting Hub"}</div><h1>{isPanelMode ? ((crafter?.name || "Crafter") + " / " + (lockedDiscipline || discipline)) : "🧪 Crafting / Recipes"}</h1><p>{isPanelMode ? ((crafter?.role || crafter?.affiliation || "Town crafter") + ". Choose a recipe this crafter can help with; players use their own materials and receipts stay with the player/admin workflow.") : "Browse recipes, track materials, plan crafting, and review discovery progress."}</p>{isPanelMode && crafterKnownSaveState ? <div className="craft-crafter-save-state">{crafterKnownSaveState}</div> : null}</div><div className="craft-hero-stats"><StatTile label="Recipes" value={filteredRecipes.length || recipes.length} /><StatTile label="Known" value={isNpcCrafterPanel ? crafterKnownRecipeIds.size : knownCount} tone="green" /><StatTile label="Materials" value={materials.length} tone="gold" />{!isPanelMode ? <button type="button" className={cls("craft-admin-resource-toggle", isAdminTestResources && "active")} onClick={toggleAdminResourceOverride} title="Admin testing: treat every crafting resource as available.">{isAdminTestResources ? "Admin Resources: ON" : "Admin Resources: OFF"}</button> : null}</div></div>',
  "CraftingWorkspace panel crafter hero"
);

replaceRequired(
  '<div className="craft-tabbar">{TABS.map(([id, icon, label]) => <button key={id} type="button" className={cls("craft-tab", activeTab === id && "craft-tab-active")} onClick={() => setActiveTab(id)}><span className="me-1">{icon}</span>{label}</button>)}</div>',
  '<div className="craft-tabbar">{(isPanelMode ? panelCraftTabs : TABS).map(([id, icon, label]) => <button key={id} type="button" className={cls("craft-tab", activeTab === id && "craft-tab-active")} onClick={() => setActiveTab(id)}><span className="me-1">{icon}</span>{label}</button>)}</div>',
  "CraftingWorkspace panel tab filter"
);

replaceRequired(
  '<RecipeTable recipes={filteredRecipes} selected={selected} onSelect={setSelected} onCraft={toggleCraftRecipe} craftingRecipeId={craftingRecipeId} />',
  '<RecipeTable recipes={filteredRecipes} selected={selected} onSelect={setSelected} onCraft={toggleCraftRecipe} craftingRecipeId={craftingRecipeId} canEditKnown={isAdmin && isNpcCrafterPanel} onToggleKnown={toggleCrafterKnownRecipe} />',
  "CraftingWorkspace panel recipe table known controls"
);

fs.writeFileSync(target, source, "utf8");

for (const token of [
  "isAdmin = false",
  "function recipeIdForKnownSave",
  "function normalizeKnownRecipeRow",
  "function RecipeSortHeader",
  "canEditKnown={isAdmin && isNpcCrafterPanel}",
  "onToggleKnown={toggleCrafterKnownRecipe}",
  "npc_known_recipes",
  '.select("recipe_key, recipe_id")',
  '.upsert({ character_id: crafterId, recipe_key: key, recipe_id: recipeId || null }, { onConflict: "character_id,recipe_key" })',
  '.delete()',
  "craft-page-panel-mode",
  "panelCraftTabs",
  "crafterGate",
]) {
  requireToken(token, "NPC crafter panel recipe UI patch");
}

for (const token of [
  "known_recipe:",
  "function crafterKnownKeysFrom",
  "crafterTagsKey",
  'supabase.from("characters").update({ tags:',
  'TABS.map(([id, icon, label]) => <button key={id} type="button" className={cls("craft-tab", activeTab === id && "craft-tab-active")} onClick={() => setActiveTab(id)}',
]) {
  requireAbsent(token, "NPC crafter panel recipe UI patch");
}

console.log("Patched NPC crafter panel recipe UI with DB-backed known recipes.");

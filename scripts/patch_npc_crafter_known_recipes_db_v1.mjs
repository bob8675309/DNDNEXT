import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "components", "CraftingWorkspace.js");
let source = fs.readFileSync(target, "utf8");

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

replaceBetween(
  'function crafterRecipeKey(recipe = {}) {',
  'function recipeSortValue(recipe = {}, key = "name") {',
  `function crafterRecipeKey(recipe = {}) {
  return String(recipe.id || recipe.recipe_id || recipe.key || recipe.originalName || recipe.name || "").trim().toLowerCase();
}
function recipeIdForKnownSave(recipe = {}) {
  return String(recipe.id || recipe.recipe_id || "").trim();
}
function normalizeKnownRecipeRow(row = {}) {
  return String(row.recipe_id || row.recipeId || row.id || "").trim().toLowerCase();
}
`,
  "NPC crafter DB known recipe helpers"
);

replaceBetween(
  '  const crafterTagsKey = JSON.stringify(Array.isArray(crafter?.tags) ? crafter.tags : []);',
  '  async function toggleCrafterKnownRecipe(recipe, nextKnown) {',
  `  useEffect(() => {
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
        .select("recipe_id")
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

`,
  "NPC crafter DB known recipe load effect"
);

replaceBetween(
  '  async function toggleCrafterKnownRecipe(recipe, nextKnown) {',
  '  const effectiveRecipes = useMemo(() => recipes.map((recipe) => {',
  `  async function toggleCrafterKnownRecipe(recipe, nextKnown) {
    if (!isAdmin || !isNpcCrafterPanel || !recipe || !crafterId) return;
    const key = crafterRecipeKey(recipe);
    const recipeId = recipeIdForKnownSave(recipe);
    if (!key || !recipeId) return;

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
          .upsert({ character_id: crafterId, recipe_id: recipeId }, { onConflict: "character_id,recipe_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("npc_known_recipes")
          .delete()
          .eq("character_id", crafterId)
          .eq("recipe_id", recipeId);
        if (error) throw error;
      }
      setCrafterKnownSaveState("Recipe access saved.");
    } catch (error) {
      console.error("Could not save crafter recipe access", error);
      setCrafterKnownRecipeIds(previous);
      setCrafterKnownSaveState("Could not save recipe access.");
    }
  }

`,
  "NPC crafter DB known recipe toggle"
);

fs.writeFileSync(target, source, "utf8");

for (const token of [
  "npc_known_recipes",
  "function recipeIdForKnownSave",
  "function normalizeKnownRecipeRow",
  '.select("recipe_id")',
  '.upsert({ character_id: crafterId, recipe_id: recipeId }, { onConflict: "character_id,recipe_id" })',
  ".delete()",
  "crafterGate",
  "canEditKnown={isAdmin && isNpcCrafterPanel}",
]) {
  requireToken(token, "NPC crafter known recipes DB patch");
}

for (const token of [
  "known_recipe:",
  "function crafterKnownKeysFrom",
  "crafterTagsKey",
  'supabase.from("characters").update({ tags:',
]) {
  requireAbsent(token, "NPC crafter known recipes DB patch");
}

console.log("Patched NPC crafter known recipes to use npc_known_recipes table.");

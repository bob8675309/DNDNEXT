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
function requireToken(token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

replaceRequired(
  `        const [authResponse, itemsJson, flavorOverrides, alchemyCatalogJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, plantCatalogRows, dbCatalogRows, knownRows, craftPlanRows, craftAttemptRows, characterRows, playerRows, recipeRuleRows, materialEffectRows, locationRows, forageTableRows, forageEntryRows] = await Promise.all([
          supabase.auth.getUser().catch(() => ({ data: { user: null } })),
          json("/items/all-items.json", true),
          json("/items/flavor-overrides.json"),
          json("/items/alchemy-catalog.json"),
          json("/items/magicvariants.json"),
          json("/items/magicvariants.hb-armor-shield.json"),
          selectSafe("recipes", "*", "name"),
          selectSafe("inventory_items", "*", "item_name"),
          selectPlayerPlantsSafe(),
          selectSafe("plants", "*", "name"),
          selectSafe("items_catalog", "*", "item_name"),
          selectSafe("player_recipes", "*", "recipe_id"),
          selectSafe("craft_plans", "*", "created_at"),
          selectSafe("crafting_attempts", "*", "created_at"),
          selectSafe("characters", "*", "name"),
          selectSafe("players", "*", "name"),
          selectSafe("crafting_recipe_rules", "*", "discipline"),
          selectSafe("crafting_material_effects", "*", "material_category"),
          selectSafe("locations", "id,name,description,biome_id", "name"),
          selectSafe("forage_tables", "*", "name"),
          selectSafe("forage_table_entries", "*, plants(*)", "roll_min"),
        ]);`,
  `        const loadStep = async (label, task, fallback, timeoutMs = 9000) => {
          let timeoutId = null;
          const timeout = new Promise((resolve) => {
            timeoutId = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
          });
          const work = Promise.resolve()
            .then(task)
            .then((value) => ({ value }), (error) => ({ error }));
          const outcome = await Promise.race([work, timeout]);
          if (timeoutId) clearTimeout(timeoutId);
          if (outcome?.timedOut) {
            console.warn("Crafting load step timed out", label);
            return fallback;
          }
          if (outcome?.error) {
            console.warn("Crafting load step failed", label, outcome.error?.message || outcome.error);
            return fallback;
          }
          return outcome?.value ?? fallback;
        };

        const [authResponse, itemsJson, flavorOverrides, alchemyCatalogJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, plantCatalogRows, dbCatalogRows, knownRows, craftPlanRows, craftAttemptRows, characterRows, playerRows, recipeRuleRows, materialEffectRows, locationRows, forageTableRows, forageEntryRows] = await Promise.all([
          loadStep("auth", () => supabase.auth.getUser().catch(() => ({ data: { user: null } })), { data: { user: null } }, 5000),
          loadStep("item catalog json", () => json("/items/all-items.json", true), { items: [] }, 7000),
          loadStep("flavor overrides json", () => json("/items/flavor-overrides.json"), {}, 4000),
          loadStep("alchemy catalog json", () => json("/items/alchemy-catalog.json"), { items: [] }, 7000),
          loadStep("magic variants json", () => json("/items/magicvariants.json"), { items: [] }, 7000),
          loadStep("armor/shield variants json", () => json("/items/magicvariants.hb-armor-shield.json"), { items: [] }, 7000),
          loadStep("recipes", () => selectSafe("recipes", "*", "name"), [], 9000),
          loadStep("inventory items", () => selectSafe("inventory_items", "*", "item_name"), [], 9000),
          loadStep("player plants", () => selectPlayerPlantsSafe(), [], 9000),
          loadStep("plant catalog", () => selectSafe("plants", "*", "name"), [], 9000),
          loadStep("items catalog", () => selectSafe("items_catalog", "*", "item_name"), [], 9000),
          loadStep("player recipes", () => selectSafe("player_recipes", "*", "recipe_id"), [], 9000),
          loadStep("craft plans", () => selectSafe("craft_plans", "*", "created_at"), [], 9000),
          loadStep("craft attempts", () => selectSafe("crafting_attempts", "*", "created_at"), [], 9000),
          loadStep("characters", () => selectSafe("characters", "*", "name"), [], 9000),
          loadStep("players", () => selectSafe("players", "*", "name"), [], 9000),
          loadStep("recipe rules", () => selectSafe("crafting_recipe_rules", "*", "discipline"), [], 9000),
          loadStep("material effects", () => selectSafe("crafting_material_effects", "*", "material_category"), [], 9000),
          loadStep("locations", () => selectSafe("locations", "id,name,description,biome_id", "name"), [], 9000),
          loadStep("forage tables", () => selectSafe("forage_tables", "*", "name"), [], 9000),
          loadStep("forage entries", () => selectSafe("forage_table_entries", "*, plants(*)", "roll_min"), [], 9000),
        ]);`,
  "Crafting workspace nonblocking load steps"
);

fs.writeFileSync(target, source, "utf8");

for (const token of [
  "const loadStep = async (label, task, fallback, timeoutMs = 9000)",
  "Crafting load step timed out",
  "loadStep(\"item catalog json\"",
  "loadStep(\"recipes\"",
  "loadStep(\"forage entries\"",
]) requireToken(token, "Crafting load timeout patch");

console.log("Patched crafting workspace load with per-source timeouts.");

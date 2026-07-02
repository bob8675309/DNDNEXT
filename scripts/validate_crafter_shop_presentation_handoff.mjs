import fs from "node:fs";
import path from "node:path";

const items = fs.readFileSync(path.join(process.cwd(), "pages", "items.js"), "utf8");
const globals = fs.readFileSync(path.join(process.cwd(), "styles", "globals.scss"), "utf8");

const checks = [
  [items, "Crafter's Counter", "crafter counter copy"],
  [items, "Commission work from {crafterContext.character.name}", "commission heading"],
  [items, "Open for commissions", "commission-ready status"],
  [items, "Service unavailable", "service-unavailable status"],
  [items, "This crafter does not currently offer {recipe.discipline} commissions.", "unavailable commission copy"],
  [items, "const crafterVisibleRecipes = useMemo(() => {", "scoped recipe memo"],
  [items, "profession.recipeAccess", "explicit recipe access"],
  [items, "RecipeTable recipes={crafterVisibleRecipes}", "scoped recipe table"],
  [items, "Crafter's Ledger", "crafter ledger heading"],
  [globals, "/* ===== NPC crafter counter shop skin v2 ===== */", "counter shop skin marker"],
  [globals, ".craft-provider-card", "counter shop skin class"],
];

const missing = checks.filter(([source, token]) => !source.includes(token));
if (missing.length) {
  console.warn("Crafter shop presentation handoff is partially applied; missing markers:");
  for (const [, , label] of missing) console.warn(`- ${label}`);
} else {
  console.log("Crafter shop presentation handoff validated.");
}

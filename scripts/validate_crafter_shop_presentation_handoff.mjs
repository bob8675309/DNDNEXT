import fs from "node:fs";
import path from "node:path";

const items = fs.readFileSync(path.join(process.cwd(), "pages", "items.js"), "utf8");
const globals = fs.readFileSync(path.join(process.cwd(), "styles", "globals.scss"), "utf8");

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

for (const token of [
  "Crafter's Counter",
  "Commission work from {crafterContext.character.name}",
  "Open for commissions",
  "Service unavailable",
  "This crafter does not currently offer {recipe.discipline} commissions.",
  "const crafterVisibleRecipes = useMemo(() => {",
  "profession.recipeAccess",
  "RecipeTable recipes={crafterVisibleRecipes}",
  "Crafter's Ledger",
]) requireToken(items, token, "Crafter shop presentation handoff");

requireToken(globals, "/* ===== NPC crafter counter shop skin v2 ===== */", "Crafter counter shop skin");
requireToken(globals, ".craft-provider-card", "Crafter counter shop skin");

console.log("Crafter shop presentation handoff validated.");

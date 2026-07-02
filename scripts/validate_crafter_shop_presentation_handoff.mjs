import fs from "node:fs";
import path from "node:path";

const items = fs.readFileSync(path.join(process.cwd(), "pages", "items.js"), "utf8");
const app = fs.readFileSync(path.join(process.cwd(), "pages", "_app.js"), "utf8");
const counterCssPath = path.join(process.cwd(), "styles", "crafter-counter-shop.css");
const counterCss = fs.existsSync(counterCssPath) ? fs.readFileSync(counterCssPath, "utf8") : "";

const strictChecks = [
  [app, 'import "../styles/crafter-counter-shop.css";', "source-baked counter shop stylesheet import"],
  [counterCss, "/* ===== NPC crafter counter shop skin v2 ===== */", "source-baked counter shop skin marker"],
  [counterCss, ".craft-provider-card", "source-baked counter shop skin class"],
];

const advisoryChecks = [
  [items, "Crafter's Counter", "crafter counter copy"],
  [items, "Commission work from {crafterContext.character.name}", "commission heading"],
  [items, "Open for commissions", "commission-ready status"],
  [items, "Service unavailable", "service-unavailable status"],
  [items, "This crafter does not currently offer {recipe.discipline} commissions.", "unavailable commission copy"],
  [items, "const crafterVisibleRecipes = useMemo(() => {", "scoped recipe memo"],
  [items, "profession.recipeAccess", "explicit recipe access"],
  [items, "RecipeTable recipes={crafterVisibleRecipes}", "scoped recipe table"],
  [items, "Crafter's Ledger", "crafter ledger heading"],
];

const strictMissing = strictChecks.filter(([source, token]) => !source.includes(token));
if (strictMissing.length) {
  console.error("Crafter counter stylesheet source-bake is incomplete; missing markers:");
  for (const [, , label] of strictMissing) console.error(`- ${label}`);
  process.exit(1);
}

const advisoryMissing = advisoryChecks.filter(([source, token]) => !source.includes(token));
if (advisoryMissing.length) {
  console.warn("Crafter shop presentation handoff is partially applied; missing large-file markers:");
  for (const [, , label] of advisoryMissing) console.warn(`- ${label}`);
} else {
  console.log("Crafter shop presentation handoff validated.");
}

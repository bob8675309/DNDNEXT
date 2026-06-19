import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) {
    console.warn(`${label}: expected one match, found ${count}; leaving source unchanged.`);
    return source;
  }
  return source.replace(before, after);
}

function replaceAllSafe(source, before, after) {
  return source.split(before).join(after);
}

const itemsPath = path.join(process.cwd(), "pages", "items.js");
let source = fs.readFileSync(itemsPath, "utf8");
let changed = false;

const beforeError = '  const crafterQueryError = requestedCrafterId && !requestedCrafter ? "The requested crafter could not be loaded." : "";';
const afterError = '  const crafterQueryError = requestedCrafterId && !loading && !requestedCrafter ? "The requested crafter could not be loaded. Please go back to town and open the workshop again." : "";';
if (source.includes(beforeError)) {
  const next = replaceOnce(source, beforeError, afterError, "defer crafter load error until data settles");
  changed = changed || next !== source;
  source = next;
}

const providerBefore = [
  '          <div className="craft-kicker">NPC-Assisted Workshop</div>',
  '          <h3>Working with {crafterContext.character.name}</h3>',
  '          <p>{crafterContext.character.role || crafterContext.character.affiliation || "Town crafter"}</p>',
  '        </div>',
  '        <span className={cls("craft-status-pill", providerValid ? "known" : "danger")}>{providerValid ? "Profession ready" : "Configuration required"}</span>'
].join('\n');
const providerAfter = [
  '          <div className="craft-kicker">Crafter\'s Counter</div>',
  '          <h3>Commission work from {crafterContext.character.name}</h3>',
  '          <p>{crafterContext.character.role || crafterContext.character.affiliation || "Town crafter"} • Browse the counter, choose the job, provide materials, and the NPC handles the profession check.</p>',
  '        </div>',
  '        <span className={cls("craft-status-pill", providerValid ? "known" : "danger")}>{providerValid ? "Open for commissions" : "Service unavailable"}</span>'
].join('\n');
if (source.includes(providerBefore)) {
  const next = replaceOnce(source, providerBefore, providerAfter, "customer-facing crafter heading");
  changed = changed || next !== source;
  source = next;
}

const beforeFallbackText = source;
source = replaceAllSafe(source, "NPC-Assisted Workshop", "Crafter's Counter");
source = replaceAllSafe(source, "Working with {crafterContext.character.name}", "Commission work from {crafterContext.character.name}");
source = replaceAllSafe(source, "Profession ready", "Open for commissions");
source = replaceAllSafe(source, "Configuration required", "Service unavailable");
source = replaceAllSafe(source, "This NPC does not offer {recipe.discipline}.", "This crafter does not currently offer {recipe.discipline} commissions.");
if (source !== beforeFallbackText) changed = true;

const unavailableBefore = '      {!providerOffersRequestedProfession ? <div className="craft-plan-alert danger">This NPC does not offer {recipe.discipline}.</div> : null}';
const unavailableAfter = '      {!providerOffersRequestedProfession ? <div className="craft-plan-alert danger">This crafter does not currently offer {recipe.discipline} commissions.</div> : null}';
if (source.includes(unavailableBefore)) {
  const next = replaceOnce(source, unavailableBefore, unavailableAfter, "customer-facing unavailable copy");
  changed = changed || next !== source;
  source = next;
}

const crafterContextBlock = [
  '  const requestedCrafterId = router.isReady ? String(router.query.crafter || "").trim() : "";',
  '  const requestedTownId = router.isReady ? String(router.query.town || "").trim() : "";',
  '  const requestedCrafter = requestedCrafterId ? characters.find((character) => String(character.id) === requestedCrafterId) || null : null;',
  '  const requestedCrafterTownValid = !requestedCrafter || !requestedTownId || [requestedCrafter.location_id, requestedCrafter.home_location_id].filter(Boolean).some((value) => String(value) === requestedTownId);',
  '  const activeCrafterContext = requestedCrafter ? { character: requestedCrafter, sheet: requestedCrafter.character_sheet || {}, townValid: requestedCrafterTownValid } : null;',
  '  const crafterQueryError = requestedCrafterId && !loading && !requestedCrafter ? "The requested crafter could not be loaded. Please go back to town and open the workshop again." : "";',
  '',
  '  const filteredMaterials = useMemo(() => materials.filter((m) => (materialCategoryFilter === "All" || m.category === materialCategoryFilter) && materialMatches(m, query)), [materials, materialCategoryFilter, query]);'
].join('\n');
const crafterContextWithScope = [
  '  const requestedCrafterId = router.isReady ? String(router.query.crafter || "").trim() : "";',
  '  const requestedTownId = router.isReady ? String(router.query.town || "").trim() : "";',
  '  const requestedCrafter = requestedCrafterId ? characters.find((character) => String(character.id) === requestedCrafterId) || null : null;',
  '  const requestedCrafterTownValid = !requestedCrafter || !requestedTownId || [requestedCrafter.location_id, requestedCrafter.home_location_id].filter(Boolean).some((value) => String(value) === requestedTownId);',
  '  const activeCrafterContext = requestedCrafter ? { character: requestedCrafter, sheet: requestedCrafter.character_sheet || {}, townValid: requestedCrafterTownValid } : null;',
  '  const crafterQueryError = requestedCrafterId && !loading && !requestedCrafter ? "The requested crafter could not be loaded. Please go back to town and open the workshop again." : "";',
  '  const crafterVisibleRecipes = useMemo(() => {',
  '    if (!activeCrafterContext) return filteredRecipes;',
  '    return filteredRecipes.filter((recipe) => {',
  '      const professionKey = professionForDiscipline(recipe.discipline);',
  '      if (!professionKey) return false;',
  '      const profession = activeCrafterContext.sheet?.professions?.[professionKey] || {};',
  '      const explicitAccess = Array.isArray(profession.recipeAccess) ? profession.recipeAccess : Array.isArray(profession.recipes) ? profession.recipes : [];',
  '      const recipeKeys = [recipe.id, recipe.name, recipe.key, recipe.originalName].filter(Boolean).map((value) => String(value).toLowerCase());',
  '      if (explicitAccess.length) {',
  '        const accessKeys = explicitAccess.map((value) => String(value).toLowerCase());',
  '        return recipeKeys.some((key) => accessKeys.includes(key));',
  '      }',
  '      const rank = Number(profession.rank || 0);',
  '      if (rank <= 0) return false;',
  '      if (recipe.discipline === "Smithing" && rarity(recipe.rarity) === "Mundane") return true;',
  '      const cap = rank >= 2 ? "Rare" : "Uncommon";',
  '      return rarityRank(recipe.rarity || "Common") <= rarityRank(cap);',
  '    });',
  '  }, [activeCrafterContext, filteredRecipes]);',
  '',
  '  const filteredMaterials = useMemo(() => materials.filter((m) => (materialCategoryFilter === "All" || m.category === materialCategoryFilter) && materialMatches(m, query)), [materials, materialCategoryFilter, query]);'
].join('\n');
if (source.includes(crafterContextBlock)) {
  const next = replaceOnce(source, crafterContextBlock, crafterContextWithScope, "NPC crafter recipe scope");
  changed = changed || next !== source;
  source = next;
}

const recipeTableBefore = '<strong>Recipes Spreadsheet</strong><span className="craft-badge">{filteredRecipes.length} shown</span></div><RecipeTable recipes={filteredRecipes} selected={selected} onSelect={setSelected} />';
const recipeTableAfter = '<strong>Crafter\'s Ledger</strong><span className="craft-badge">{crafterVisibleRecipes.length} offered</span></div><RecipeTable recipes={crafterVisibleRecipes} selected={selected} onSelect={setSelected} />';
if (source.includes(recipeTableBefore)) {
  const next = replaceOnce(source, recipeTableBefore, recipeTableAfter, "NPC scoped recipe table");
  changed = changed || next !== source;
  source = next;
}

if (changed) {
  fs.writeFileSync(itemsPath, source, "utf8");
  console.log("Applied customer-facing crafter shop presentation and recipe scope patch.");
} else {
  console.log("Crafter shop presentation already current or awaiting profession generation.");
}

const globalsPath = path.join(process.cwd(), "styles", "globals.scss");
let globals = fs.readFileSync(globalsPath, "utf8");
const styleMarker = "/* ===== NPC crafter counter shop skin v2 ===== */";
if (!globals.includes(styleMarker)) {
  globals += `\n\n${styleMarker}\n.craft-provider-card {\n  position: relative;\n  overflow: hidden;\n  border-color: rgba(226, 176, 92, .72) !important;\n  background:\n    radial-gradient(circle at 12% 12%, rgba(246, 204, 119, .18), transparent 32%),\n    linear-gradient(135deg, rgba(75, 48, 31, .94), rgba(28, 23, 38, .96) 48%, rgba(18, 22, 33, .94)) !important;\n  box-shadow: inset 0 0 0 1px rgba(255, 236, 190, .08), 0 18px 42px rgba(0,0,0,.36);\n}\n.craft-provider-card::before {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  background:\n    linear-gradient(90deg, rgba(255,255,255,.04), transparent 28%),\n    repeating-linear-gradient(90deg, rgba(255,255,255,.025) 0 1px, transparent 1px 90px);\n}\n.craft-provider-card > * { position: relative; z-index: 1; }\n.craft-provider-head h3 { color: #fff6db; font-size: clamp(1.25rem, 1vw + 1rem, 1.8rem); }\n.craft-provider-head p { color: #efe2c5; max-width: 760px; }\n.craft-provider-grid > div {\n  border-color: rgba(244, 202, 128, .22) !important;\n  background: linear-gradient(180deg, rgba(20, 16, 24, .62), rgba(8, 8, 12, .72)) !important;\n}\n.craft-provider-layout .craft-step-card {\n  border-color: rgba(226, 176, 92, .52);\n  background: linear-gradient(135deg, rgba(98, 61, 33, .86), rgba(43, 32, 47, .92));\n}\n.craft-provider-layout .craft-step-card-active {\n  background: linear-gradient(135deg, rgba(161, 98, 42, .96), rgba(72, 50, 56, .96));\n}\n.craft-provider-layout .craft-workflow-step-title::before { content: \"Order: \"; color: rgba(255, 230, 160, .65); }\n`;
  fs.writeFileSync(globalsPath, globals, "utf8");
}

for (const token of ["activeCrafterContext", "crafterQueryError"]) {
  if (!source.includes(token)) console.warn(`Crafter shop presentation marker not found yet: ${token}`);
}
if (source.includes("activeCrafterContext") && !source.includes("crafterVisibleRecipes")) {
  console.warn("NPC crafter recipe scope did not apply yet.");
}

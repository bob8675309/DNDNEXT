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
  '          <p>{crafterContext.character.role || crafterContext.character.affiliation || "Town crafter"} • The crafter handles the skill check; you choose the job and materials.</p>',
  '        </div>',
  '        <span className={cls("craft-status-pill", providerValid ? "known" : "danger")}>{providerValid ? "Ready for commission" : "Service unavailable"}</span>'
].join('\n');
if (source.includes(providerBefore)) {
  const next = replaceOnce(source, providerBefore, providerAfter, "customer-facing crafter heading");
  changed = changed || next !== source;
  source = next;
}

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
const recipeTableAfter = '<strong>Recipes Spreadsheet</strong><span className="craft-badge">{crafterVisibleRecipes.length} shown</span></div><RecipeTable recipes={crafterVisibleRecipes} selected={selected} onSelect={setSelected} />';
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

for (const token of ["activeCrafterContext", "crafterQueryError"]) {
  if (!source.includes(token)) console.warn(`Crafter shop presentation marker not found yet: ${token}`);
}
if (source.includes("activeCrafterContext") && !source.includes("crafterVisibleRecipes")) {
  console.warn("NPC crafter recipe scope did not apply yet.");
}

from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def insert_before_once(text, marker, addition, label):
    if text.count(marker) != 1:
        raise RuntimeError(f"{label}: marker count was {text.count(marker)}")
    return text.replace(marker, addition + marker, 1)


# Dark theme readability -----------------------------------------------------
globals_path = Path("styles/globals.scss")
globals_text = globals_path.read_text()
readability_marker = "/* ====================== Dark form readability ====================== */"
if readability_marker not in globals_text:
    globals_text += """

/* ====================== Dark form readability ====================== */
.text-body-secondary,
.form-text {
  color: var(--muted) !important;
}

.form-control:disabled,
.form-control[readonly],
.form-select:disabled {
  background-color: #191329 !important;
  color: #e9e4f7 !important;
  border-color: var(--border) !important;
  opacity: 1 !important;
  -webkit-text-fill-color: #e9e4f7;
}

.form-control:disabled::placeholder,
.form-control[readonly]::placeholder {
  color: #b7aeda !important;
  opacity: 1;
}
"""
globals_path.write_text(globals_text)


# Town workshop --------------------------------------------------------------
town_path = Path("components/TownSheet.js")
town = town_path.read_text()
if "const COMPACT_TOWN_ALCHEMY_RECIPE_NAMES" not in town:
    town = insert_before_once(
        town,
        "function buildAlchemyRecipeRows(plantItems = [], inventoryItems = []) {",
        """const COMPACT_TOWN_ALCHEMY_RECIPE_NAMES = new Set([\n  \"Potion of Climbing\",\n  \"Night-Eye Drops\",\n  \"Ironroot Salve\",\n  \"Potion of Superior Healing\",\n  \"Potion of Storm Giant Strength\",\n  \"Potion of Giant Size\",\n]);\n\n""",
        "town compact formula set",
    )

if "const fullWorkshopDiscipline" not in town:
    town = replace_once(
        town,
        "  return (\n    <div className={styles.modalBackdrop} onClick={onClose}>",
        """  const fullWorkshopDiscipline = selectedService?.id === \"imbue\"\n    ? \"Enchanting\"\n    : selectedService?.id === \"brew\"\n      ? \"Alchemy\"\n      : \"Smithing\";\n  const fullWorkshopHref = {\n    pathname: \"/items\",\n    query: { discipline: fullWorkshopDiscipline, craft: \"1\", crafter: crafter?.id || \"\", from: \"town\" },\n  };\n\n  return (\n    <div className={styles.modalBackdrop} onClick={onClose}>""",
        "town full-workshop context",
    )

if "Open Full Workshop" not in town:
    town = replace_once(
        town,
        """          </div>\n          <button type=\"button\" className=\"btn btn-sm btn-outline-light\" onClick={onClose}>Close</button>\n        </div>\n\n        <section className={cls(styles.drawerItem, styles.builderPanel, toneKey(\"emerald\"))}>""",
        """          </div>\n          <div className=\"d-flex flex-wrap justify-content-end gap-2\">\n            <Link className=\"btn btn-sm btn-warning\" href={fullWorkshopHref}>Open Full Workshop</Link>\n            <button type=\"button\" className=\"btn btn-sm btn-outline-light\" onClick={onClose}>Close</button>\n          </div>\n        </div>\n\n        <section className={cls(styles.drawerItem, styles.builderPanel, toneKey(\"emerald\"))}>""",
        "town full-workshop action",
    )
town_path.write_text(town)


# Crafting hub ---------------------------------------------------------------
items_path = Path("pages/items.js")
items = items_path.read_text()
items = replace_once(
    items,
    'import React, { useEffect, useMemo, useState } from "react";\nimport { supabase } from "../utils/supabaseClient";',
    'import React, { useEffect, useMemo, useRef, useState } from "react";\nimport { useRouter } from "next/router";\nimport { supabase } from "../utils/supabaseClient";',
    "router imports",
)

if "compact-family-labels" not in items:
    match = re.search(r"function reagentFamilyLabel\(([^)]*)\)\s*\{", items)
    if not match:
        raise RuntimeError("reagentFamilyLabel was not found")
    parameter = match.group(1).split("=")[0].strip()
    guard = (
        "\n  // compact-family-labels: keep long family names inside compact cards."
        f"\n  const compactFamilyKey = String({parameter} || \"\").toLowerCase().replace(/[_/-]+/g, \" \" ).replace(/\\s+/g, \" \" ).trim();"
        "\n  if (compactFamilyKey === \"enhancer\" || compactFamilyKey === \"enhancer catalyst\") return \"Enhancer\";"
        "\n  if (compactFamilyKey === \"mineral salt ash\") return \"Mineral / Ash\";"
    )
    items = items[: match.end()] + guard + items[match.end() :]

helpers = r'''
function hasExplicitAlchemyPayload(material = {}) {
  const profile = materialAlchemyProfile(material);
  const category = String(material.category || "").toLowerCase();
  const tags = Array.isArray(material.tags) ? material.tags.map((tag) => String(tag).toLowerCase()) : [];
  return Boolean(
    Object.keys(profile || {}).length
    || category === "plant / herb"
    || category === "reagent"
    || category === "reagent / catalyst"
    || tags.includes("alchemy")
    || tags.includes("ingredient")
  );
}
function materialAllowedForDiscipline(material, discipline = "") {
  if (!material) return false;
  const d = String(discipline || "").toLowerCase();
  if (!d || d === "alchemy") return true;
  const category = String(material.category || "").toLowerCase();
  const blob = materialSearchBlob(material);
  if (hasExplicitAlchemyPayload(material)) return false;
  if (d === "smithing") {
    if (category === "ore / metal") return true;
    if (category === "catalyst") return !/(potion|brew|herb|plant|reagent|essence|extract|tincture)/.test(blob);
    if (category === "monster part") return !/(venom|poison|bile|mucus|fluid|blood extract|alchemical)/.test(blob);
    return false;
  }
  if (d === "enchanting") {
    if (category === "catalyst" || category === "monster part") return true;
    if (category === "ore / metal") return /(mithral|adamant|silver|ruidium|crystal|shard|gem|arcane|planar|star)/.test(blob);
    return false;
  }
  return true;
}
function craftingWorkflowCopy(recipe = {}) {
  if (recipe.discipline === "Smithing") return {
    theme: "smithing",
    kicker: "Smithing Workshop",
    description: recipe.kind === "forge"
      ? "Choose the forge pattern, select physical stock and catalysts, then review the finished item and Craft DC."
      : "Choose owned gear, select physical stock and catalysts, then review the reforged tier and Craft DC.",
    step1: recipe.kind === "forge" ? "Choose Pattern" : "Choose Item",
    step2: "Materials & Catalyst",
    step3: "Finalize",
    materialTitle: "Forge Materials",
  };
  if (recipe.discipline === "Enchanting") return {
    theme: "enchanting",
    kicker: "Enchanting Workshop",
    description: "Choose a smith-tiered item, select a magical trait and compatible catalyst, then review the runed result and Craft DC.",
    step1: "Choose Tiered Item",
    step2: "Trait & Catalyst",
    step3: "Finalize",
    materialTitle: "Enchanting Components",
  };
  return {
    theme: "alchemy",
    kicker: "Alchemy Workshop",
    description: "Choose each reagent family. The live brew card stays visible and updates as ingredients change.",
    step1: "Choose Formula",
    step2: "Choose Ingredients",
    step3: "Finalize",
    materialTitle: "Ingredient Families",
  };
}

'''
if "function materialAllowedForDiscipline" not in items:
    items = insert_before_once(items, "function buildCraftBenchPlan(recipe, materials = []) {", helpers, "discipline resource helpers")

physical_card = r'''
function PhysicalMaterialEffectCard({ material, materialEffects = [], quantityLabel = "", compact = false, discipline = "Crafting" }) {
  if (!material) return null;
  const effect = materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {
    name: `${material.category || "Material"} Contribution`,
    dc_modifier: 1,
    effect_summary: "Adds a minor material property determined by the selected recipe.",
    risk_summary: "Requires correct tools and handling.",
  };
  const itemRarity = rarity(material.rarity || "Common") || "Common";
  const dcModifier = Number(effect.dc_modifier || 0);
  return (
    <div className={cls("craft-material-effect-row", "craft-specific-material-effect-row", "craft-alchemy-effect-card", "craft-physical-effect-card", compact && "compact", rarityClassName(itemRarity))}>
      <div className="craft-alchemy-item-head">
        <div className="craft-alchemy-item-title-block">
          <strong>{material.name}</strong>
          <span className="craft-ingredient-family-pill craft-ingredient-family-pill-under-name">{material.category || material.type || "Material"}</span>
        </div>
        <div className="craft-effect-card-badges">
          <span className={cls("craft-ingredient-quality-pill", rarityClassName(itemRarity))}>{itemRarity}</span>
          {quantityLabel ? <span className="craft-ingredient-qty-pill">{quantityLabel}</span> : null}
        </div>
      </div>
      <div className="craft-alchemy-card-description">{material.notes || material.description || material.raw?.item_description || "Prepared crafting stock."}</div>
      <div className="craft-alchemy-card-divider" />
      <div className="craft-alchemy-impact-label">{discipline === "Smithing" ? "Forge impact" : "Binding impact"}</div>
      <div className="craft-ingredient-impact-chips craft-material-impact-chips">
        <i>{effect.name || "Material effect"}</i>
        <i>{dcModifier ? `Craft DC ${dcModifier > 0 ? "+" : ""}${dcModifier}` : "No Craft DC change"}</i>
      </div>
      <div className="craft-material-specific-summary">{effect.effect_summary || "Adds a recipe-appropriate crafted property."}</div>
      {!compact && effect.risk_summary ? <div className="craft-physical-risk-note"><strong>Handling:</strong> {effect.risk_summary}</div> : null}
    </div>
  );
}

'''
if "function PhysicalMaterialEffectCard" not in items:
    items = insert_before_once(items, "function RecipePreview({ recipe, materials = [], inventoryItems = [], characters = [], recipeRules = [], materialEffects = [], resourceCatalog = [], isAdminTestResources = false, craftMode = false, onExitCraft }) {", physical_card, "physical material card")

items = replace_once(
    items,
    """  const reqs = (recipe.requirements || []).filter(Boolean);\n  const comps = (recipe.components || []).filter(Boolean);\n  const alchemyDetails = alchemyFormulaDetails(recipe);\n  const planningResources = resourceCatalog.length ? resourceCatalog : materials;\n  const normalizedInventory = inventoryItems.map(normalizeBenchInventoryItem);""",
    """  const reqs = (recipe.requirements || []).filter(Boolean);\n  const comps = (recipe.components || []).filter(Boolean);\n  const alchemyDetails = alchemyFormulaDetails(recipe);\n  const workflow = craftingWorkflowCopy(recipe);\n  const workflowTheme = workflow.theme;\n  const allPlanningResources = resourceCatalog.length ? resourceCatalog : materials;\n  const planningResources = allPlanningResources.filter((material) => materialAllowedForDiscipline(material, recipe.discipline));\n  const normalizedInventory = inventoryItems.map(normalizeBenchInventoryItem);""",
    "planning resource scope",
)

items = replace_once(
    items,
    '<div className="craft-preview-card craft-recipe-workbench-card craft-preview-summary-card">',
    '<div className={cls("craft-preview-card", "craft-recipe-workbench-card", "craft-preview-summary-card", `craft-theme-${workflowTheme}`)}>',
    "preview theme",
)

# Insert workflow steps and base item selection before the material section.
workflow_blocks = r'''
  const requiredWorkflowSlots = (plan.matches || []).filter((slot) => slot.required !== false);
  const selectedRequiredSlotCount = requiredWorkflowSlots.filter((slot) => selectedMaterials[materialSlotKey(slot)]).length;
  const itemStepReady = createsNewItem || Boolean(baseItem);
  const materialStepReady = requiredWorkflowSlots.length === 0 || selectedRequiredSlotCount === requiredWorkflowSlots.length;
  const finalizeStepReady = itemStepReady && materialStepReady;
  const workflowStepsBlock = (
    <div className="craft-workflow-stepbar">
      <div className={cls("craft-workflow-step", itemStepReady && "ready")}><span>1</span><div><strong>{workflow.step1}</strong><small>{createsNewItem ? recipe.name : baseItem?.name || "Choose an owned item"}</small></div></div>
      <div className={cls("craft-workflow-step", materialStepReady && "ready")}><span>2</span><div><strong>{workflow.step2}</strong><small>{selectedRequiredSlotCount}/{requiredWorkflowSlots.length || 0} required selections</small></div></div>
      <div className={cls("craft-workflow-step", finalizeStepReady && "ready")}><span>3</span><div><strong>{workflow.step3}</strong><small>{finalizeStepReady ? `Review DC ${attemptPreview.final_dc}` : "Complete earlier steps"}</small></div></div>
    </div>
  );
  const baseItemBlock = recipe.discipline !== "Alchemy" ? (
    <div className={cls("craft-section", "craft-section-card", "craft-base-item-section", `craft-theme-${workflowTheme}`, "mt-3")}>
      <div className="craft-section-title">{workflow.step1}</div>
      {createsNewItem ? (
        <div className="craft-base-pattern-card"><div><span>Selected pattern</span><strong>{recipe.name}</strong></div><span className="craft-chip craft-chip-gold">Creates new item</span></div>
      ) : (
        <>
          <select className="form-select craft-input" value={baseItemId} onChange={(event) => setBaseItemId(event.target.value)}>
            <option value="">Choose an owned, compatible item</option>
            {baseCandidates.map((item) => <option key={item.id} value={item.id}>{item.name} {item.rarity ? `(${item.rarity})` : ""}</option>)}
          </select>
          {baseItem ? <div className="craft-base-pattern-card mt-2"><div><span>Selected item</span><strong>{baseItem.name}</strong></div><span className="craft-chip">{baseItem.rarity || "Mundane"}</span></div> : <div className="craft-bullet muted mt-2">Only compatible physical gear from the selected character inventory is listed.</div>}
        </>
      )}
    </div>
  ) : null;

'''
if "const workflowStepsBlock" not in items:
    items = insert_before_once(items, "  const ingredientFamiliesBlock = plan.matches?.length ? (", workflow_blocks, "workflow steps")

items = replace_once(
    items,
    '<div className="craft-section craft-section-card craft-alchemy-specifics mt-3">\n      <div className="craft-section-title-row">\n        <div className="craft-section-title">{recipe.discipline === "Alchemy" ? "Ingredient Families" : "Material Requirements"}</div>',
    '<div className={cls("craft-section", "craft-section-card", recipe.discipline === "Alchemy" ? "craft-alchemy-specifics" : "craft-physical-materials-section", `craft-theme-${workflowTheme}`, "mt-3")}>\n      <div className="craft-section-title-row">\n        <div className="craft-section-title">{workflow.materialTitle}</div>',
    "themed material section",
)

items = replace_once(
    items,
    '        const selectedImpact = recipe.discipline === "Alchemy" && selectedCandidate ? alchemyIngredientImpactSummary(selectedCandidate, alchemyPreviewRecipe, slot) : null;\n        const open = openSlotKey === slotKey;',
    '        const selectedImpact = recipe.discipline === "Alchemy" && selectedCandidate ? alchemyIngredientImpactSummary(selectedCandidate, alchemyPreviewRecipe, slot) : null;\n        const selectedPhysical = recipe.discipline !== "Alchemy" && selectedCandidate;\n        const open = openSlotKey === slotKey;',
    "selected physical material state",
)

items = replace_once(
    items,
    '''            ) : (\n              <button\n                type="button"\n                className="craft-alchemy-path-row craft-family-slot-button compact"\n                onClick={() => setOpenSlotKey(open ? "" : slotKey)}\n              >''',
    '''            ) : selectedPhysical ? (\n              <button type="button" className="craft-selected-ingredient-button" onClick={() => setOpenSlotKey(open ? "" : slotKey)} title="Click to change this material">\n                <PhysicalMaterialEffectCard material={selectedCandidate} materialEffects={materialEffects} quantityLabel={selectedQuantityLabel} discipline={recipe.discipline} />\n                <span className="craft-change-ingredient-hint">Click material card to change selection</span>\n              </button>\n            ) : (\n              <button\n                type="button"\n                className="craft-alchemy-path-row craft-family-slot-button compact"\n                onClick={() => setOpenSlotKey(open ? "" : slotKey)}\n              >''',
    "selected physical material card",
)

items = replace_once(
    items,
    'className={cls("craft-family-ingredient-option", recipe.discipline === "Alchemy" && "craft-family-ingredient-card-option", available ? "available" : "unavailable", String(selectedId) === String(candidate.id) && "active", recipe.discipline === "Alchemy" && rarityClassName(candidateRarity))}',
    'className={cls("craft-family-ingredient-option", "craft-family-ingredient-card-option", available ? "available" : "unavailable", String(selectedId) === String(candidate.id) && "active", rarityClassName(candidateRarity))}',
    "candidate card classes",
)

items = replace_once(
    items,
    '''                      ) : (\n                        <span className="craft-family-ingredient-body">\n                          <span className="craft-family-ingredient-title-row">\n                            <strong>{candidate.name}</strong>\n                            <span className={cls("craft-ingredient-quality-pill", rarityClassName(candidateRarity))}>{candidateRarity}</span>\n                          </span>\n                        </span>\n                      )}''',
    '''                      ) : (\n                        <PhysicalMaterialEffectCard material={candidate} materialEffects={materialEffects} quantityLabel={available ? candidate.is_admin_virtual ? "∞ admin" : `x${candidate.quantity || 1}` : "Not owned"} compact discipline={recipe.discipline} />\n                      )}''',
    "physical candidate cards",
)

# Base item now appears in step 1, not at the bottom of Finalize.
old_base_selector = '''      {!createsNewItem ? (\n        <>\n          <label className="small text-muted mb-1">Base Item / Target Item</label>\n          <select className="form-select craft-input mb-2" value={baseItemId} onChange={(event) => setBaseItemId(event.target.value)}>\n            <option value="">No base item selected</option>\n            {baseCandidates.map((item) => (\n              <option key={item.id} value={item.id}>{item.name} {item.rarity ? `(${item.rarity})` : ""}</option>\n            ))}\n          </select>\n        </>\n      ) : null}\n\n'''
items = replace_once(items, old_base_selector, "", "remove duplicate base selector")

items = replace_once(
    items,
    '''  if (craftMode) {\n    return (\n      <div className="craft-recipe-craft-layout">\n        <div className="craft-crafting-left-column">\n          <div className="craft-panel craft-craft-mode-head">\n            <div>\n              <div className="craft-kicker">Crafting Recipe</div>\n              <h2>{recipe.name}</h2>\n              <p>Choose each reagent family on the left. The live potion card stays visible on the right and updates as ingredients change.</p>\n            </div>\n            <button type="button" className="btn btn-sm btn-outline-light" onClick={onExitCraft}>Back to spreadsheet</button>\n          </div>\n          {ingredientFamiliesBlock}''',
    '''  if (craftMode) {\n    return (\n      <div className={cls("craft-recipe-craft-layout", `craft-theme-${workflowTheme}`)}>\n        <div className="craft-crafting-left-column">\n          <div className={cls("craft-panel", "craft-craft-mode-head", `craft-theme-${workflowTheme}`)}>\n            <div>\n              <div className="craft-kicker">{workflow.kicker}</div>\n              <h2>{recipe.name}</h2>\n              <p>{workflow.description}</p>\n            </div>\n            <button type="button" className="btn btn-sm btn-outline-light" onClick={onExitCraft}>Back to spreadsheet</button>\n          </div>\n          {workflowStepsBlock}\n          {baseItemBlock}\n          {ingredientFamiliesBlock}''',
    "themed craft mode header",
)

items = replace_once(
    items,
    'export default function CraftingPage() {\n  const [activeTab, setActiveTab] = useState("recipes");',
    'export default function CraftingPage() {\n  const router = useRouter();\n  const workshopQueryApplied = useRef("");\n  const [activeTab, setActiveTab] = useState("recipes");',
    "route-aware crafting page",
)

route_effects = r'''
  useEffect(() => {
    if (!filteredRecipes.length) {
      if (selected) setSelected(null);
      if (craftingRecipeId) setCraftingRecipeId(null);
      return;
    }
    if (!selected || !filteredRecipes.some((recipe) => String(recipe.id) === String(selected.id))) {
      setSelected(filteredRecipes[0]);
      setCraftingRecipeId(null);
    }
  }, [filteredRecipes, selected?.id, craftingRecipeId]);

  useEffect(() => {
    if (!router.isReady || !recipes.length) return;
    const requested = String(router.query.discipline || "").trim();
    const shouldCraft = String(router.query.craft || "") === "1";
    if (!requested && !shouldCraft) return;
    const key = `${requested}::${shouldCraft}::${router.query.crafter || ""}`;
    if (workshopQueryApplied.current === key) return;
    const requestedDiscipline = ["Smithing", "Enchanting", "Alchemy"].find((value) => value.toLowerCase() === requested.toLowerCase()) || "";
    if (requestedDiscipline) {
      setActiveTab("recipes");
      setDiscipline(requestedDiscipline);
      setKnowledge("All");
      setRarityFilter("All");
      setAlchemySection("All");
      setAlchemyGroup("All");
      const firstRecipe = recipes.find((recipe) => recipe.discipline === requestedDiscipline) || null;
      if (firstRecipe) {
        setSelected(firstRecipe);
        setCraftingRecipeId(shouldCraft ? firstRecipe.id : null);
      }
    }
    workshopQueryApplied.current = key;
  }, [router.isReady, router.query.discipline, router.query.craft, router.query.crafter, recipes]);

'''
if "workshopQueryApplied.current" not in items:
    items = insert_before_once(items, '  const filteredMaterials = useMemo(() => materials.filter((m) => (materialCategoryFilter === "All" || m.category === materialCategoryFilter) && materialMatches(m, query)), [materials, materialCategoryFilter, query]);', route_effects, "selection synchronization")

css = r'''

        /* Crafting workflow themes and compact-card overflow protection */
        .craft-recipe-craft-layout { --workflow-accent:#39c98f; --workflow-soft:rgba(57,201,143,.16); --workflow-border:rgba(57,201,143,.42); }
        .craft-theme-smithing { --workflow-accent:#e0a44f; --workflow-soft:rgba(224,164,79,.16); --workflow-border:rgba(224,164,79,.48); }
        .craft-theme-enchanting { --workflow-accent:#a78bfa; --workflow-soft:rgba(139,92,246,.18); --workflow-border:rgba(167,139,250,.5); }
        .craft-theme-alchemy { --workflow-accent:#39c98f; --workflow-soft:rgba(57,201,143,.16); --workflow-border:rgba(57,201,143,.42); }
        .craft-craft-mode-head,.craft-base-item-section,.craft-physical-materials-section { border-color:var(--workflow-border)!important; background:linear-gradient(135deg,var(--workflow-soft),rgba(30,24,48,.9))!important; }
        .craft-workflow-stepbar { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:14px; }
        .craft-workflow-step { display:flex; align-items:center; gap:10px; min-width:0; padding:11px 12px; border:1px solid rgba(255,255,255,.12); border-radius:13px; background:rgba(27,33,47,.9); }
        .craft-workflow-step>span { display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto; width:30px; height:30px; border-radius:999px; background:rgba(255,255,255,.1); color:#eee9ff; font-weight:950; }
        .craft-workflow-step>div { min-width:0; }.craft-workflow-step strong,.craft-workflow-step small { display:block; }.craft-workflow-step strong { color:#fff8ff; line-height:1.1; }.craft-workflow-step small { margin-top:3px; color:#cfc6df; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .craft-workflow-step.ready { border-color:var(--workflow-border); background:var(--workflow-soft); }.craft-workflow-step.ready>span { background:var(--workflow-accent); color:#15101f; }
        .craft-base-pattern-card { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 11px; border:1px solid var(--workflow-border); border-radius:11px; background:rgba(13,18,29,.62); }.craft-base-pattern-card div { min-width:0; }.craft-base-pattern-card div span { display:block; color:#b9afca; font-size:10px; text-transform:uppercase; letter-spacing:.06em; }.craft-base-pattern-card div strong { display:block; color:#fff8ff; overflow-wrap:anywhere; }
        .craft-physical-risk-note { margin-top:8px; padding-top:7px; border-top:1px solid rgba(255,255,255,.07); color:#d8d0e7; font-size:11px; line-height:1.35; }.craft-physical-risk-note strong { display:inline; color:#ffe4a6; }
        .craft-family-ingredient-dropdown { grid-template-columns:repeat(auto-fit,minmax(290px,1fr)); }
        .craft-family-ingredient-card-option,.craft-family-ingredient-card-option .craft-alchemy-effect-card,.craft-alchemy-item-head,.craft-alchemy-item-title-block,.craft-effect-card-badges { min-width:0; max-width:100%; }.craft-family-ingredient-card-option { overflow:hidden; }.craft-alchemy-item-head { flex-wrap:wrap; }.craft-alchemy-item-title-block { flex:1 1 165px; }.craft-alchemy-item-title-block strong { overflow-wrap:anywhere; word-break:break-word; }.craft-effect-card-badges { flex:0 1 auto; }
        .craft-ingredient-family-pill,.craft-ingredient-theme-pill { max-width:100%; white-space:normal; text-align:center; overflow-wrap:anywhere; }
        .craft-alchemy-effect-card.compact .craft-alchemy-card-description { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:4; overflow:hidden; }.craft-alchemy-effect-card.compact .craft-material-specific-summary { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; }
        @media(max-width:760px){.craft-workflow-stepbar{grid-template-columns:1fr}.craft-family-ingredient-dropdown{grid-template-columns:1fr}}
'''
if "Crafting workflow themes and compact-card overflow protection" not in items:
    idx = items.rfind("</style>")
    if idx < 0:
        raise RuntimeError("items.js style close not found")
    items = items[:idx] + css + items[idx:]

for required in [
    "function materialAllowedForDiscipline",
    "function PhysicalMaterialEffectCard",
    "craft-workflow-stepbar",
    "craft-theme-smithing",
    "craft-theme-enchanting",
    "workshopQueryApplied.current",
    "const planningResources = allPlanningResources.filter",
]:
    if required not in items:
        raise RuntimeError(f"missing verification token: {required}")

items_path.write_text(items)
print("Crafting workflow refresh patch applied successfully.")

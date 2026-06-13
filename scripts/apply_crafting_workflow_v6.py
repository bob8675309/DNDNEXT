from pathlib import Path
import re

path = Path("pages/items.js")
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)


def replace_between(start_marker: str, end_marker: str, replacement: str, label: str) -> None:
    global text
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f"{label}: start marker not found")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"{label}: end marker not found")
    text = text[:start] + replacement.rstrip() + "\n" + text[end:]


def regex_once(pattern: str, replacement: str, label: str, flags=re.S) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex match, found {count}")


replace_once(
    '["plans", "📋", "Craft Plans"],',
    '["plans", "📋", "Craft Receipts"],',
    "rename craft plans tab",
)

replace_once(
    'const ENCHANTING_SECTIONS = ["All", "Melee Weapon", "Ranged Weapon", "Ammo", "Armor", "Shield"];',
    'const ENCHANTING_SECTIONS = ["All", "Melee Weapon", "Ranged Weapon", "Ammo", "Armor", "Shield"];\nconst SMITHING_SECTIONS = ["All", "Melee Weapon", "Ranged Weapon", "Ammo", "Armor", "Shield", "Tempering"];\nconst LETHO_TEST_TARGET = { id: "a63208d8-154a-4ace-9162-b19e643c96ce", user_id: "3bbd64cd-4b05-41e9-bca4-520c06333239", name: "Letho", kind: "player", target_type: "player", is_test_target: true };',
    "smithing sections and Letho target",
)

troll_heart = '''  {
    name: "Troll Heart", category: "Monster Part", rarity: "Rare", dc: 3, materialClass: "Monster Organ", qualityModel: "elemental",
    flavor: "A preserved green-black heart whose torn fibers slowly pull themselves together.",
    allowedItemKinds: ["weapon", "ammunition", "armor", "shield"], affinityTags: ["fire", "poison"],
    risk: "Regenerating tissue can overgrow bindings and must be cauterized during every stage."
  },
'''
replace_once(troll_heart, "", "remove Troll Heart forge material")

unified_temper = '''function temperRecipes() {
  return [{
    id: "temper:progression",
    name: "Temper Item",
    discipline: "Smithing",
    kind: "temper",
    progressive_temper: true,
    category: "weapon / ammunition / armor / shield",
    family: "Tempering",
    rarity: "Varies",
    known: false,
    source: "Town Smithing",
    summary: "Advance one existing physical item through its next available elemental temper stage. Initial Temper unlocks Temper +1, then +2, then +3 after each successful craft.",
    requirements: ["Compatible physical item", "The preceding temper stage must already be complete", "Access to a smithy"],
    components: ["Exactly one elemental Mote, Shard, or Core for the currently unlocked stage"],
  }];
}
'''
replace_between("function temperRecipes() {", "function variantRecipe(raw)", unified_temper, "unify temper recipes")

replace_once(
    '''function temperTierForRecipe(recipe = {}) {
  return Number(recipe.temper_tier || String(recipe.name || "").match(/\+([1-3])/)?.[1] || 0);
}''',
    '''function nextTemperStageForItem(item = {}) {
  const history = smithingHistoryFromItem(item);
  if (!history["initial-temper"]) return 0;
  for (let stage = 1; stage <= 3; stage += 1) {
    if (!history[`temper-${stage}`]) return stage;
  }
  return 4;
}
function temperTierForRecipe(recipe = {}, baseItem = null) {
  if (recipe?.progressive_temper || recipe?.id === "temper:progression") return nextTemperStageForItem(baseItem || {});
  return Number(recipe.temper_tier || String(recipe.name || "").match(/\+([1-3])/)?.[1] || 0);
}''',
    "progressive temper stage helper",
)

replace_once(
    'const targetTier = isForge ? 0 : Math.max(0, Math.min(3, temperTierForRecipe(recipe)));',
    'const targetTier = isForge ? 0 : Math.max(0, Math.min(3, temperTierForRecipe(recipe, baseItem)));',
    "temper material slot stage",
)

replace_once(
    '''    if (recipe.kind !== "temper") return true;
    const targetTier = Math.max(0, Math.min(3, temperTierForRecipe(recipe)));
    const currentTier = physicalEnhancementTier(item);
    if (targetTier === 0) return currentTier === 0 && !smithingHistoryFromItem(item)["initial-temper"];
    if (currentTier !== targetTier - 1) return false;
    return !smithingHistoryFromItem(item)[`temper-${targetTier}`];''',
    '''    if (recipe.kind !== "temper") return true;
    if (recipe.progressive_temper || recipe.id === "temper:progression") return nextTemperStageForItem(item) <= 3;
    const targetTier = Math.max(0, Math.min(3, temperTierForRecipe(recipe, item)));
    const currentTier = physicalEnhancementTier(item);
    if (targetTier === 0) return currentTier === 0 && !smithingHistoryFromItem(item)["initial-temper"];
    if (currentTier !== targetTier - 1) return false;
    return !smithingHistoryFromItem(item)[`temper-${targetTier}`];''',
    "progressive temper base candidates",
)

replace_once(
    'if (recipe.kind === "temper" && baseItem?.name) return `${recipe.name.replace(/\\s*Temper$/i, "")} ${baseItem.name.replace(/^\\+\\d+\\s+/i, "")}`.trim();',
    'if (recipe.kind === "temper" && baseItem?.name) { const stage = Math.max(0, Math.min(3, temperTierForRecipe(recipe, baseItem))); const cleanName = baseItem.name.replace(/^\\+\\d+\\s+/i, ""); return stage === 0 ? `Tempered ${cleanName}` : `+${stage} ${cleanName}`; }',
    "progressive temper result name",
)

replace_once(
    '''  const isForge = recipe.kind === "forge";
  const stage = isForge ? 0 : Math.max(0, Math.min(3, temperTierForRecipe(recipe)));
  const activeEssences = selectedMaterials.filter((entry) => (entry?.temper_elemental || entry?.slot_type === "temper") && !entry?.existing_work);''',
    '''  const isForge = recipe.kind === "forge";
  const activeEssences = selectedMaterials.filter((entry) => (entry?.temper_elemental || entry?.slot_type === "temper") && !entry?.existing_work);
  const selectedStage = activeEssences.map((entry) => Number(entry?.temper_stage)).find((value) => Number.isFinite(value));
  const stage = isForge ? 0 : Math.max(0, Math.min(3, Number.isFinite(selectedStage) ? selectedStage : temperTierForRecipe(recipe)));''',
    "attempt preview progressive stage",
)

replace_once(
    '  const materialQuality = !slot?.temper_elemental && String(profile.kind || "").toLowerCase() === "material" ? smithingMaterialQuality(material) : "";',
    '  const materialQuality = !slot?.temper_elemental && String(profile.kind || "").toLowerCase() === "material" ? smithingMaterialQuality(material) : "";\n  const materialQualityBonus = materialQuality ? Number(profile.qualityBonusPct || (materialQuality === "HQ" ? 50 : 25)) : 0;',
    "material quality bonus display value",
)

replace_once(
    '''          <span className={cls("craft-ingredient-quality-pill", rarityClassName(itemRarity))}>{itemRarity}</span>
          {materialQuality ? <span className={cls("craft-material-quality-pill", materialQuality === "HQ" ? "hq" : "normal")}>{materialQuality}</span> : null}''',
    '''          {slot?.temper_elemental ? <span className={cls("craft-ingredient-quality-pill", rarityClassName(itemRarity))}>{itemRarity}</span> : null}
          {materialQuality ? <span className={cls("craft-material-quality-pill", materialQuality === "HQ" ? "hq" : "normal")}>{materialQuality} · {materialQualityBonus}%</span> : null}''',
    "simplify material badges",
)

replace_once(
    '''function characterName(character) {
  return character?.name || character?.character_name || character?.display_name || character?.email || "Unnamed Character";
}''',
    '''function characterName(character) {
  return character?.name || character?.character_name || character?.display_name || character?.email || "Unnamed Character";
}
function mergeCraftTargetOptions(characterRows = [], playerRows = []) {
  const byId = new Map();
  characterRows.forEach((character) => {
    if (!character?.id) return;
    byId.set(String(character.id), { ...character, target_type: character.kind === "merchant" ? "merchant" : "npc" });
  });
  [...playerRows, LETHO_TEST_TARGET].forEach((player) => {
    if (!player?.id) return;
    byId.set(String(player.id), { ...player, kind: "player", target_type: "player" });
  });
  return Array.from(byId.values()).sort((a, b) => characterName(a).localeCompare(characterName(b)));
}''',
    "merge NPC and player craft targets",
)

replace_once(
    'const [authResponse, itemsJson, flavorOverrides, alchemyCatalogJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, plantCatalogRows, dbCatalogRows, knownRows, craftPlanRows, craftAttemptRows, characterRows, recipeRuleRows, materialEffectRows, locationRows, forageTableRows, forageEntryRows] = await Promise.all([',
    'const [authResponse, itemsJson, flavorOverrides, alchemyCatalogJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, plantCatalogRows, dbCatalogRows, knownRows, craftPlanRows, craftAttemptRows, characterRows, playerRows, recipeRuleRows, materialEffectRows, locationRows, forageTableRows, forageEntryRows] = await Promise.all([',
    "load players destructuring",
)

replace_once(
    '          selectSafe("characters", "*", "name"),\n          selectSafe("crafting_recipe_rules", "*", "discipline"),',
    '          selectSafe("characters", "*", "name"),\n          selectSafe("players", "*", "name"),\n          selectSafe("crafting_recipe_rules", "*", "discipline"),',
    "load player targets",
)

replace_once(
    'setCharacters(characterRows);',
    'setCharacters(mergeCraftTargetOptions(characterRows, playerRows));',
    "set merged craft targets",
)

smithing_helpers = '''function smithingSectionsForRecipe(recipe = {}) {
  if (recipe?.discipline !== "Smithing") return [];
  if (recipe?.kind === "temper" || recipe?.progressive_temper) return ["Tempering"];
  const blob = [recipe.name, recipe.family, recipe.category, recipe.item_preview?.family, recipe.item_preview?.itemType, recipe.item_preview?.type].filter(Boolean).join(" ").toLowerCase();
  if (/ammunition|ammo|arrow|bolt|bullet/.test(blob)) return ["Ammo"];
  if (/shield/.test(blob)) return ["Shield"];
  if (/armor|mail|plate|breastplate|hide armor|leather armor/.test(blob)) return ["Armor"];
  if (/ranged|bow|crossbow|sling|blowgun/.test(blob)) return ["Ranged Weapon"];
  if (/weapon|melee|sword|axe|mace|hammer|dagger|spear|staff|whip|rapier|scimitar|trident|flail|lance/.test(blob)) return ["Melee Weapon"];
  return [];
}

'''
replace_once('function variantRecipe(raw) {', smithing_helpers + 'function variantRecipe(raw) {', "smithing section helper")

replace_once(
    '  const [enchantingSection, setEnchantingSection] = useState("All");',
    '  const [enchantingSection, setEnchantingSection] = useState("All");\n  const [smithingSection, setSmithingSection] = useState("All");\n  const [dismissedReviewPlanIds, setDismissedReviewPlanIds] = useState([]);',
    "smithing filter and review state",
)

replace_once(
    '''  const enchantingSectionCounts = useMemo(() => {
    const counts = Object.fromEntries(ENCHANTING_SECTIONS.map((section) => [section, 0]));
    recipes.filter((recipe) => recipe.discipline === "Enchanting").forEach((recipe) => {
      counts.All += 1;
      enchantingSectionsForRecipe(recipe).forEach((section) => {
        counts[section] = (counts[section] || 0) + 1;
      });
    });
    return counts;
  }, [recipes]);''',
    '''  const enchantingSectionCounts = useMemo(() => {
    const counts = Object.fromEntries(ENCHANTING_SECTIONS.map((section) => [section, 0]));
    recipes.filter((recipe) => recipe.discipline === "Enchanting").forEach((recipe) => {
      counts.All += 1;
      enchantingSectionsForRecipe(recipe).forEach((section) => {
        counts[section] = (counts[section] || 0) + 1;
      });
    });
    return counts;
  }, [recipes]);
  const smithingSectionCounts = useMemo(() => {
    const counts = Object.fromEntries(SMITHING_SECTIONS.map((section) => [section, 0]));
    recipes.filter((recipe) => recipe.discipline === "Smithing").forEach((recipe) => {
      counts.All += 1;
      smithingSectionsForRecipe(recipe).forEach((section) => {
        counts[section] = (counts[section] || 0) + 1;
      });
    });
    return counts;
  }, [recipes]);''',
    "smithing section counts",
)

replace_once(
    '''    const enchantingMatch = enchantingSection === "All" || (r.discipline === "Enchanting" && enchantingSectionsForRecipe(r).includes(enchantingSection));
    return disciplineMatch && sectionMatch && groupMatch && enchantingMatch && (rarityFilter === "All" || r.rarity === rarityFilter) && (knowledge !== "Known" || r.known) && (knowledge !== "Reference" || !r.known) && matches(r, query);
  }), [recipes, discipline, alchemySection, alchemyGroup, enchantingSection, rarityFilter, knowledge, query]);''',
    '''    const enchantingMatch = enchantingSection === "All" || (r.discipline === "Enchanting" && enchantingSectionsForRecipe(r).includes(enchantingSection));
    const smithingMatch = smithingSection === "All" || (r.discipline === "Smithing" && smithingSectionsForRecipe(r).includes(smithingSection));
    return disciplineMatch && sectionMatch && groupMatch && enchantingMatch && smithingMatch && (rarityFilter === "All" || r.rarity === rarityFilter) && (knowledge !== "Known" || r.known) && (knowledge !== "Reference" || !r.known) && matches(r, query);
  }), [recipes, discipline, alchemySection, alchemyGroup, enchantingSection, smithingSection, rarityFilter, knowledge, query]);''',
    "smithing section filtering",
)

text = text.replace('setEnchantingSection("All");', 'setEnchantingSection("All"); setSmithingSection("All");')

replace_once(
    '''  function chooseEnchantingSection(section) {
    setDiscipline("Enchanting");''',
    '''  function chooseSmithingSection(section) {
    setDiscipline("Smithing");
    setKnowledge("All");
    setSmithingSection(section);
    setCraftingRecipeId(null);
    const next = recipes.find((recipe) => recipe.discipline === "Smithing" && (section === "All" || smithingSectionsForRecipe(recipe).includes(section)));
    if (next) setSelected(next);
  }
  function chooseEnchantingSection(section) {
    setDiscipline("Enchanting");''',
    "choose smithing section",
)

smithing_bar = '''    {discipline === "Smithing" && activeTab === "recipes" ? (
      <div className="craft-alchemy-section-bar craft-smithing-section-bar" aria-label="Smithing item categories">
        <div>
          <div className="craft-kicker">Smithing Categories</div>
          <div className="craft-alchemy-section-note">Filter forge patterns by item type, or open the single progressive Tempering workflow.</div>
        </div>
        <div className="craft-alchemy-section-buttons">
          {SMITHING_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              className={cls("craft-alchemy-section-button", "craft-smithing-section-button", smithingSection === section && "active")}
              onClick={() => chooseSmithingSection(section)}
            >
              <span>{section}</span>
              <strong>{smithingSectionCounts[section] || 0}</strong>
            </button>
          ))}
        </div>
      </div>
    ) : null}
'''
replace_once('    {discipline === "Enchanting" && activeTab === "recipes" ? (', smithing_bar + '    {discipline === "Enchanting" && activeTab === "recipes" ? (', "render smithing category bar")

replace_once(
    '''    if (!recipe) {
      setPlanError("Choose a recipe before creating a craft plan.");
      return;
    }

    if (destructiveSelectedMaterials.length''',
    '''    if (!recipe) {
      setPlanError("Choose a recipe before submitting a craft attempt.");
      return;
    }
    const requestedRollTotal = Number(craftRollTotal);
    if (!Number.isFinite(requestedRollTotal) || requestedRollTotal < 1) {
      setPlanError("Enter the completed d20 + modifiers total before submitting this craft attempt.");
      return;
    }
    if (!targetCharacter) {
      setPlanError("Choose the character who should receive the crafted result.");
      return;
    }

    if (destructiveSelectedMaterials.length''',
    "validate submitted craft attempt",
)

regex_once(
    r'''      const payload = \{\n        \.\.\.craftPlanInsertPayload\(recipe, plan, \{\n          targetCharacter,\n          baseItem,\n          selectedMaterials,\n          resultItemName: displayedResultName,\n          automationPreview: \{ \.\.\.attemptPreview, output_quantity: finalOutputQuantity, final_effect_preview: alchemyProductPreview \},\n        \}\),\n        created_by: authData\?\.user\?\.id \|\| null,\n      \};''',
    '''      const basePayload = craftPlanInsertPayload(recipe, plan, {
        targetCharacter,
        baseItem,
        selectedMaterials,
        resultItemName: displayedResultName,
        automationPreview: { ...attemptPreview, output_quantity: finalOutputQuantity, final_effect_preview: alchemyProductPreview },
      });
      const submittedAt = new Date().toISOString();
      const payload = {
        ...basePayload,
        status: "submitted",
        plan_payload: {
          ...(basePayload.plan_payload || {}),
          requested_roll_total: requestedRollTotal,
          submitted_for_review_at: submittedAt,
        },
        result_item_payload: {
          ...(basePayload.result_item_payload || {}),
          requested_roll_total: requestedRollTotal,
        },
        created_by: authData?.user?.id || null,
      };''',
    "submit plan as review request",
)

replace_once(
    '      setPlanMessage("Craft plan saved from the recipe preview.");',
    '      setPlanMessage("Craft attempt submitted for admin review.");',
    "submitted plan message",
)

replace_once(
    '''      <label className="small text-muted mb-1">Expected Result Name</label>
      <input className="form-control craft-input" value={displayedResultName || ""} onChange={(event) => setResultItemName(event.target.value)} placeholder="Result item name" />
      <div className="craft-preview-chip-row mt-2">''',
    '''      <label className="small text-muted mb-1">Expected Result Name</label>
      <input className="form-control craft-input mb-2" value={displayedResultName || ""} onChange={(event) => setResultItemName(event.target.value)} placeholder="Result item name" />
      <label className="small text-muted mb-1">Craft Roll Total</label>
      <input className="form-control craft-input" type="number" min="1" max="99" value={craftRollTotal} onChange={(event) => setCraftRollTotal(event.target.value)} placeholder="d20 + modifiers" />
      <div className="craft-form-help">Submit the completed check total. The admin review modal resolves it against DC {attemptPreview.final_dc}.</div>
      <div className="craft-preview-chip-row mt-2">''',
    "craft roll input",
)

replace_once(
    '''      <button type="button" className="btn btn-primary mt-2 craft-primary-action" onClick={submitPreviewCraftPlan} disabled={savingPlan}>
        {savingPlan ? "Saving..." : "Create Draft Craft Plan"}
      </button>''',
    '''      <button type="button" className="btn btn-primary mt-2 craft-primary-action" onClick={submitPreviewCraftPlan} disabled={savingPlan || !craftRollTotal || !targetCharacterId}>
        {savingPlan ? "Submitting..." : "Submit Craft Attempt"}
      </button>''',
    "submit attempt button",
)

components = r'''function requestedCraftRoll(plan = {}) {
  return Number(plan?.plan_payload?.requested_roll_total ?? plan?.result_item_payload?.requested_roll_total ?? 0) || 0;
}
function savedCraftDc(plan = {}) {
  return Number(plan?.plan_payload?.automation_preview?.final_dc ?? plan?.result_item_payload?.automation_preview?.final_dc ?? 0) || 0;
}
function CraftReceiptDetailModal({ plan, attempts = [], onClose }) {
  if (!plan) return null;
  const normalized = normalizeCraftPlan(plan);
  const attempt = latestAttemptForPlan(normalized, attempts);
  const roll = attempt?.roll_total ?? requestedCraftRoll(normalized) || "—";
  const dc = attempt?.dc ?? savedCraftDc(normalized) || "—";
  const band = attempt?.result_tier ? { tier: attempt.result_tier, label: attemptLabel(attempt.result_tier) } : resolveCraftAttemptBand(roll, dc);
  return (
    <div className="craft-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className="craft-modal-card craft-receipt-modal" role="dialog" aria-modal="true" aria-label="Craft receipt detail">
        <div className="craft-modal-head">
          <div><div className="craft-kicker">Craft Receipt</div><h2>{normalized.result_item_name || normalized.recipe_name}</h2></div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
        </div>
        <div className="craft-receipt-summary-grid">
          <div><span>Status</span><strong>{titleCase(normalized.status)}</strong></div>
          <div><span>Target</span><strong>{normalized.target_character_name || "—"}</strong></div>
          <div><span>Recipe</span><strong>{normalized.recipe_name}</strong></div>
          <div><span>Discipline</span><strong>{normalized.discipline || "—"}</strong></div>
          <div><span>Roll / DC</span><strong>{roll} / {dc}</strong></div>
          <div><span>Outcome</span><strong>{band?.label || "Pending"}</strong></div>
          <div><span>Created</span><strong>{normalized.created_at ? new Date(normalized.created_at).toLocaleString() : "—"}</strong></div>
          <div><span>Base Item</span><strong>{normalized.target_inventory_item_name || "New item"}</strong></div>
        </div>
        <div className="craft-section craft-section-card">
          <div className="craft-section-title">Selected Materials</div>
          {normalized.selected_materials?.filter((material) => material?.name).length ? normalized.selected_materials.filter((material) => material?.name).map((material, index) => <div className="craft-bullet" key={`${material.slot_key || material.category}-${index}`}>• {material.slot_label || material.category || "Material"}: {material.name}{material.quality ? ` (${material.quality})` : ""}</div>) : <div className="craft-bullet muted">No explicit materials recorded.</div>}
        </div>
        {(normalized.completion_report || attempt?.report_text || normalized.admin_notes) ? <div className="craft-section craft-section-card"><div className="craft-section-title">Resolution</div>{normalized.completion_report ? <p>{normalized.completion_report}</p> : null}{attempt?.report_text ? <p>{attempt.report_text}</p> : null}{normalized.admin_notes ? <p className="muted">Admin: {normalized.admin_notes}</p> : null}</div> : null}
      </div>
    </div>
  );
}
function CraftReceiptsTab({ craftPlans = [], craftAttempts = [], selectedPlan, setSelectedPlan, query = "", discipline = "All", rarityFilter = "All", knowledge = "All" }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [detailPlan, setDetailPlan] = useState(null);
  const normalized = useMemo(() => craftPlans.map(normalizeCraftPlan), [craftPlans]);
  const filtered = useMemo(() => normalized.filter((plan) => (statusFilter === "All" || plan.status === statusFilter) && planMatchesCraftFilters(plan, query, discipline, rarityFilter, knowledge)), [normalized, statusFilter, query, discipline, rarityFilter, knowledge]);
  const statuses = ["All", "submitted", "completed", "rejected", "approved", "draft", "cancelled"];
  return (
    <div className="craft-panel craft-receipts-panel">
      <div className="craft-panel-head"><div><strong>Craft Receipts</strong><div className="craft-sheet-source">A compact history of submitted attempts and resolved crafts.</div></div><span className="craft-badge">{filtered.length} records</span></div>
      <div className="craft-receipt-toolbar">{statuses.map((status) => <button type="button" key={status} className={cls("btn btn-sm", statusFilter === status ? "btn-primary" : "btn-outline-light")} onClick={() => setStatusFilter(status)}>{titleCase(status)}</button>)}</div>
      <div className="craft-table-scroll craft-receipts-table-scroll">
        <table className="craft-recipe-sheet craft-receipts-sheet">
          <thead><tr><th>Result / Recipe</th><th>Target</th><th>Discipline</th><th>Roll / DC</th><th>Outcome</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {filtered.map((plan) => { const attempt = latestAttemptForPlan(plan, craftAttempts); const roll = attempt?.roll_total ?? requestedCraftRoll(plan) || "—"; const dc = attempt?.dc ?? savedCraftDc(plan) || "—"; const band = attempt?.result_tier ? attemptLabel(attempt.result_tier) : (roll !== "—" && dc !== "—" ? resolveCraftAttemptBand(roll, dc).label : "Pending"); return <tr key={plan.id} className={selectedPlan?.id === plan.id ? "active" : ""} onClick={() => { setSelectedPlan?.(plan); setDetailPlan(plan); }}><td><div className="craft-sheet-name">{plan.result_item_name || plan.recipe_name}</div><div className="craft-sheet-source">{plan.recipe_name}</div></td><td>{plan.target_character_name || "—"}</td><td><span className={cls("craft-type-pill", `type-${String(plan.discipline || "recipe").toLowerCase()}`)}>{plan.discipline || "—"}</span></td><td>{roll} / {dc}</td><td>{band}</td><td><span className={cls("craft-status-pill", craftPlanStatusTone(plan.status))}>{titleCase(plan.status)}</span></td><td>{plan.created_at ? new Date(plan.created_at).toLocaleDateString() : "—"}</td></tr>; })}
            {!filtered.length ? <tr><td colSpan="7" className="text-muted p-3">No craft receipts match the current filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {detailPlan ? <CraftReceiptDetailModal plan={detailPlan} attempts={craftAttempts} onClose={() => setDetailPlan(null)} /> : null}
    </div>
  );
}
function AdminCraftReviewModal({ plan, onClose, onResolved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!plan) return null;
  const normalized = normalizeCraftPlan(plan);
  const roll = requestedCraftRoll(normalized);
  const dc = savedCraftDc(normalized);
  const preview = normalized.plan_payload?.automation_preview || normalized.result_item_payload?.automation_preview || {};
  const band = resolveCraftAttemptBand(roll, dc);
  const materials = normalized.selected_materials?.filter((material) => material?.name) || [];

  async function rejectCraft() {
    setBusy(true); setError("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { error: updateError } = await supabase.from("craft_plans").update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: authData?.user?.id || null, admin_notes: "Rejected from the compact admin craft review." }).eq("id", normalized.id);
      if (updateError) throw updateError;
      await onResolved?.(normalized.id);
    } catch (caught) { setError(formatSupabaseError(caught)); } finally { setBusy(false); }
  }

  async function approveCraft() {
    if (!roll || !dc) { setError("This submission is missing a roll total or saved Craft DC."); return; }
    const dangerous = destructiveMaterialsFromPlan(normalized);
    if (dangerous.length && typeof window !== "undefined" && !window.confirm(destructiveMaterialMessage(dangerous))) return;
    setBusy(true); setError("");
    try {
      const attemptPayload = craftAttemptPayload(normalized, roll, preview, band);
      let attemptId = null;
      const { data: inserted, error: insertError } = await supabase.from("crafting_attempts").insert(attemptPayload).select("id").single();
      if (!insertError) attemptId = inserted?.id || null;
      if (insertError) {
        const { data: rpcData, error: rpcError } = await supabase.rpc("submit_crafting_attempt_report", { p_attempt: craftAttemptRpcPayload(attemptPayload) });
        if (rpcError) throw new Error(`Attempt insert failed: ${formatSupabaseError(insertError)} RPC fallback failed: ${formatSupabaseError(rpcError)}`);
        attemptId = rpcData?.id || rpcData?.attempt_id || null;
      }
      if (!attemptId) {
        const { data: latestRows, error: latestError } = await supabase.from("crafting_attempts").select("id").eq("craft_plan_id", normalized.id).order("created_at", { ascending: false }).limit(1);
        if (latestError) throw latestError;
        attemptId = latestRows?.[0]?.id || null;
      }
      if (successfulAttemptTier(band.tier)) {
        const { error: completionError } = await supabase.rpc("complete_craft_plan_v1", { p_plan_id: normalized.id, p_attempt_id: attemptId });
        if (completionError) throw completionError;
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const { error: updateError } = await supabase.from("craft_plans").update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: authData?.user?.id || null, admin_notes: `Attempt resolved as ${band.label}; no item was created.` }).eq("id", normalized.id);
        if (updateError) throw updateError;
      }
      await onResolved?.(normalized.id);
    } catch (caught) { setError(formatSupabaseError(caught)); } finally { setBusy(false); }
  }

  return (
    <div className="craft-modal-backdrop craft-admin-review-backdrop">
      <div className="craft-modal-card craft-admin-review-modal" role="dialog" aria-modal="true" aria-label="Admin craft review">
        <div className="craft-modal-head"><div><div className="craft-kicker">Admin Craft Review</div><h2>{normalized.result_item_name || normalized.recipe_name}</h2></div><button type="button" className="btn btn-sm btn-outline-light" disabled={busy} onClick={onClose}>Later</button></div>
        <div className={cls("craft-review-outcome", attemptStatusTone(band.tier))}><strong>{band.label}</strong><span>Roll {roll || "—"} vs DC {dc || "—"}{band.delta === null ? "" : ` (${band.delta >= 0 ? "+" : ""}${band.delta})`}</span></div>
        <div className="craft-receipt-summary-grid"><div><span>Target</span><strong>{normalized.target_character_name || "—"}</strong></div><div><span>Recipe</span><strong>{normalized.recipe_name}</strong></div><div><span>Discipline</span><strong>{normalized.discipline || "—"}</strong></div><div><span>Base Item</span><strong>{normalized.target_inventory_item_name || "New item"}</strong></div></div>
        <div className="craft-section craft-section-card"><div className="craft-section-title">Materials</div>{materials.length ? materials.map((material, index) => <div className="craft-bullet" key={`${material.slot_key || material.category}-${index}`}>• {material.slot_label || material.category}: {material.name}{material.quality ? ` (${material.quality})` : ""}</div>) : <div className="craft-bullet muted">No explicit material selection.</div>}</div>
        <div className="craft-review-note">Yes records the submitted roll. Successful rolls complete the transaction and deliver the item; unsuccessful rolls are recorded without creating an item.</div>
        {error ? <div className="craft-plan-alert danger">{error}</div> : null}
        <div className="craft-review-actions"><button type="button" className="btn btn-outline-danger" disabled={busy} onClick={rejectCraft}>No — Reject</button><button type="button" className="btn btn-primary" disabled={busy} onClick={approveCraft}>{busy ? "Resolving..." : "Yes — Resolve Craft"}</button></div>
      </div>
    </div>
  );
}

'''
replace_once('function MasteryDetail({ track }) {', components + 'function MasteryDetail({ track }) {', "receipts and admin review components")

replace_once(
    '<CraftPlansTab craftPlans={craftPlans} craftAttempts={craftAttempts} selectedPlan={selectedCraftPlan} setSelectedPlan={setSelectedCraftPlan} reloadPlans={reloadCraftPlans} query={query} discipline={discipline} rarityFilter={rarityFilter} knowledge={knowledge} />',
    '<CraftReceiptsTab craftPlans={craftPlans} craftAttempts={craftAttempts} selectedPlan={selectedCraftPlan} setSelectedPlan={setSelectedCraftPlan} query={query} discipline={discipline} rarityFilter={rarityFilter} knowledge={knowledge} />',
    "use receipt table",
)

review_state = '''  const isAdminCraftReviewer = isAdminCraftingUser(currentUser);
  const pendingReviewPlan = useMemo(() => craftPlans.map(normalizeCraftPlan).find((plan) => plan.status === "submitted" && !dismissedReviewPlanIds.includes(String(plan.id))) || null, [craftPlans, dismissedReviewPlanIds]);

  useEffect(() => {
    if (!currentUser || !isAdminCraftingUser(currentUser)) return undefined;
    const refresh = () => reloadCraftPlans();
    const interval = setInterval(refresh, 15000);
    const channel = supabase.channel("craft-plan-admin-review-v6")
      .on("postgres_changes", { event: "*", schema: "public", table: "craft_plans" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crafting_attempts" }, refresh)
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [currentUser?.id]);

'''
replace_once('  const craftModeRecipe = selected && craftingRecipeId === selected.id ? selected : null;', review_state + '  const craftModeRecipe = selected && craftingRecipeId === selected.id ? selected : null;', "admin review state and realtime")

replace_once(
    '    </div><style jsx global>{`',
    '''      {isAdminCraftReviewer && pendingReviewPlan ? <AdminCraftReviewModal plan={pendingReviewPlan} onClose={() => setDismissedReviewPlanIds((current) => Array.from(new Set([...current, String(pendingReviewPlan.id)])))} onResolved={async () => { setDismissedReviewPlanIds((current) => current.filter((id) => id !== String(pendingReviewPlan.id))); await reloadCraftPlans(); }} /> : null}
    </div><style jsx global>{`''',
    "render admin review modal",
)

replace_once(
    '.craft-physical-effect-card .craft-element-tag{display:inline-flex!important;width:fit-content!important;min-width:0!important;max-width:max-content!important;min-height:15px;padding:1px 6px;font-size:7.5px;line-height:1.1;letter-spacing:.035em;flex:0 0 auto!important;align-self:flex-start!important;justify-content:center;white-space:nowrap;box-shadow:inset 0 0 0 1px rgba(255,255,255,.035)}',
    '.craft-physical-effect-card .craft-element-tag{display:inline-flex!important;width:fit-content!important;min-width:0!important;max-width:max-content!important;min-height:20px;padding:2px 7px;font-size:9px;font-weight:900;line-height:1.1;letter-spacing:.04em;flex:0 0 auto!important;align-self:flex-start!important;justify-content:center;white-space:nowrap;box-shadow:inset 0 0 0 1px rgba(255,255,255,.035)}',
    "larger elemental tags",
)

css = '''
        .craft-smithing-section-bar{border-color:rgba(240,169,70,.52);background:linear-gradient(135deg,rgba(133,78,24,.20),rgba(30,24,36,.95))}
        .craft-smithing-section-button.active{border-color:#f0a946;background:rgba(197,116,35,.26);box-shadow:0 0 0 1px rgba(240,169,70,.18) inset}
        .craft-smithing-section-button strong{background:rgba(240,169,70,.18);color:#ffe2ae}
        .craft-form-help{margin-top:5px;color:#aaa0ba;font-size:10px;line-height:1.35}
        .craft-receipts-panel{max-height:none}.craft-receipt-toolbar{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-bottom:1px solid #303846}.craft-receipts-table-scroll{max-height:70vh}.craft-receipts-sheet th,.craft-receipts-sheet td{white-space:nowrap}.craft-receipts-sheet td:first-child{white-space:normal;min-width:220px}
        .craft-modal-backdrop{position:fixed;inset:0;z-index:1500;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(5,7,12,.78);backdrop-filter:blur(4px)}
        .craft-modal-card{width:min(760px,96vw);max-height:88vh;overflow:auto;border:1px solid rgba(139,92,246,.70);border-radius:16px;background:linear-gradient(180deg,#241a35,#17121f);box-shadow:0 30px 90px rgba(0,0,0,.65);padding:18px;color:#f4f1ff}
        .craft-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}.craft-modal-head h2{margin:4px 0 0;font-size:23px}.craft-receipt-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}.craft-receipt-summary-grid>div{min-width:0;padding:9px 10px;border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(20,25,36,.64)}.craft-receipt-summary-grid span,.craft-receipt-summary-grid strong{display:block}.craft-receipt-summary-grid span{color:#9fa8ba;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.craft-receipt-summary-grid strong{margin-top:3px;overflow-wrap:anywhere}
        .craft-admin-review-modal{border-color:rgba(240,169,70,.72);box-shadow:0 30px 90px rgba(0,0,0,.70),inset 0 2px 0 rgba(240,169,70,.45)}.craft-review-outcome{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding:12px 14px;border:1px solid rgba(128,191,255,.36);border-radius:10px;background:rgba(34,43,61,.75)}.craft-review-outcome.known{border-color:rgba(59,211,154,.55);background:rgba(27,104,74,.24)}.craft-review-outcome.submitted{border-color:rgba(240,169,70,.55);background:rgba(115,70,20,.24)}.craft-review-outcome.danger{border-color:rgba(255,100,120,.55);background:rgba(108,26,42,.24)}.craft-review-outcome strong{font-size:18px}.craft-review-note{margin:12px 0;color:#c9c1d8;font-size:12px;line-height:1.45}.craft-review-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}
        @media(max-width:760px){.craft-receipt-summary-grid{grid-template-columns:1fr}.craft-modal-backdrop{padding:10px}.craft-review-actions{flex-direction:column-reverse}.craft-review-actions .btn{width:100%}}
'''
replace_once('        .craft-enchanting-section-bar{border-color:', css + '        .craft-enchanting-section-bar{border-color:', "craft v6 CSS")

required_tokens = [
    'id: "temper:progression"',
    'const SMITHING_SECTIONS',
    'name: "Letho"',
    'function CraftReceiptsTab',
    'function AdminCraftReviewModal',
    'Submit Craft Attempt',
    'requested_roll_total',
    'craft-smithing-section-bar',
    'Normal ·',
]
for token in required_tokens:
    if token not in text:
        raise RuntimeError(f"verification token missing: {token}")
if 'name: "Troll Heart", category: "Monster Part"' in text:
    raise RuntimeError("Troll Heart forge material still present")

path.write_text(text)
print("applied crafting workflow v6", len(text), text.count("\n") + 1)

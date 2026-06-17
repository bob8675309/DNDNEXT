import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

function replaceRegexOnce(source, regex, after, label) {
  const matches = source.match(regex);
  if (!matches) throw new Error(`${label}: no match`);
  const duplicateCheck = source.slice((matches.index || 0) + matches[0].length).match(regex);
  if (duplicateCheck) throw new Error(`${label}: more than one match`);
  return source.replace(regex, after);
}

const itemPath = path.join(process.cwd(), "pages", "items.js");
let source = fs.readFileSync(itemPath, "utf8");
const marker = "buildEnchantingPreview";

if (!source.includes(marker)) {
  source = replaceOnce(
    source,
    `import {
  buildCrafterProfessionSnapshot,
  professionForDiscipline,
  providerOffersProfession,
} from "../utils/craftingProfessions";`,
    `import {
  buildCrafterProfessionSnapshot,
  professionForDiscipline,
  providerOffersProfession,
} from "../utils/craftingProfessions";
import {
  ENCHANTING_SLOT_ORDER,
  ENCHANTING_SLOT_RULES,
  buildEnchantingPreview,
  enchantingCatalystEffect,
  enchantingRecipeDisabledReason,
  enchantingRecipeOptions,
  enchantingRequirementCheck,
  enchantingSlotForRecipe,
  isEnchantingCatalyst,
  isEnchantingRecipeFuture,
  resolveEnchantingRecipeRarity,
} from "../utils/enchanting";`,
    "Enchanting helper imports"
  );

  const variantFunction = `function variantRecipe(raw) {
  const key = String(raw?.key || raw?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const originalName = String(raw?.name || "").trim();
  if (!key || !originalName || PHYSICAL_VARIANTS.has(key)) return null;
  const appliesTo = Array.isArray(raw.appliesTo) ? raw.appliesTo.map((value) => String(value).toLowerCase()) : ["weapon", "armor", "shield", "ammunition"];
  const entries = Array.isArray(raw.entries) ? raw.entries : raw.entries ? [String(raw.entries)] : [];
  const options = Array.isArray(raw.options) ? raw.options : [];
  const normalizedName = originalName.replace(/^Sword of\s+/i, "Weapon of ");
  const variant = { ...raw, key, name: normalizedName, originalName, appliesTo };
  const recipeRarity = rarity(raw.rarity || (raw.rarityByValue ? "Varies" : "")) || "Varies";
  const recipeShell = { key, name: normalizedName, rarity: recipeRarity, variant };
  const targetSlot = enchantingSlotForRecipe(recipeShell);
  const future = isEnchantingRecipeFuture(recipeShell);
  const disabledReason = future ? enchantingRecipeDisabledReason(recipeShell) : "";
  const firstKind = appliesTo[0] || "weapon";
  const effectPreview = raw.textByKind?.[firstKind] || raw.textByKind?.weapon || raw.textByKind?.armor || raw.textByKind?.shield || raw.textByKind?.ammunition || entries.join(" ");
  const slotRule = targetSlot ? ENCHANTING_SLOT_RULES[targetSlot] : null;
  return {
    id: \`enchant:\${key}\`,
    key,
    name: normalizedName,
    originalName,
    discipline: "Enchanting",
    kind: "enchant",
    category: appliesTo.join(" / "),
    family: appliesTo.includes("weapon") ? "Weapon" : appliesTo.map(titleCase).join(" / "),
    applies_to: appliesTo,
    rarity: recipeRarity,
    known: false,
    source: raw.source || "Variant Catalog",
    summary: effectPreview || \`Magical trait applicable to \${appliesTo.join(", ")}.\`,
    effect_text: effectPreview || "",
    entries,
    options,
    requires: raw.requires || {},
    text_by_kind: raw.textByKind || {},
    variant,
    slot_key: targetSlot || null,
    craft_disabled: future,
    disabled_reason: disabledReason,
    requirements: future
      ? [disabledReason]
      : [\`Smith-tiered base item with \${slotRule?.label || "an available slot"} unlocked\`, \`Applies to: \${appliesTo.join(", ")}\`],
    components: future
      ? ["Future enchanting content"]
      : [\`One \${slotRule?.minimumCatalystRarity || "Common"} or better arcane catalyst\`, ...(options.length ? [\`Choose option: \${options.join(", ")}\`] : [])],
  };
}`;
  source = replaceRegexOnce(
    source,
    /function variantRecipe\(raw\) \{[\s\S]*?\n\}\n\nconst ALCHEMY_POTION_FORMULAS/,
    `${variantFunction}\n\nconst ALCHEMY_POTION_FORMULAS`,
    "Variant recipe normalization"
  );

  source = replaceRegexOnce(
    source,
    /function isCraftBaseCandidate\(item, recipe\) \{[\s\S]*?\n\}\nfunction characterName/,
    `function isCraftBaseCandidate(item, recipe) {
  if (!item || !recipe) return false;
  const blob = [item.name, item.type, item.rarity, item.payload?.item_type, item.payload?.type, item.payload?.uiType].filter(Boolean).join(" ").toLowerCase();
  const physical = /(weapon|armor|shield|ammunition|melee|ranged)/.test(blob);
  if (recipe.kind === "forge" || recipe.kind === "alchemy" || recipe.discipline === "Alchemy") return false;
  if (recipe.discipline === "Smithing") {
    if (!physical) return false;
    if (recipe.kind !== "temper") return true;
    if (recipe.progressive_temper || recipe.id === "temper:progression") return nextTemperStageForItem(item) <= 3;
    const targetTier = Math.max(0, Math.min(3, temperTierForRecipe(recipe, item)));
    const currentTier = physicalEnhancementTier(item);
    if (targetTier === 0) return currentTier === 0 && !smithingHistoryFromItem(item)["initial-temper"];
    if (currentTier !== targetTier - 1) return false;
    return !smithingHistoryFromItem(item)[\`temper-\${targetTier}\`];
  }
  if (recipe.discipline === "Enchanting") return enchantingRequirementCheck(item, recipe, recipe.selected_option).ok;
  return true;
}
function characterName`,
    "Enchanting base-item validation"
  );

  source = replaceOnce(
    source,
    `function suggestedResultName(recipe, baseItem) {
  if (!recipe) return "";
  if (recipe.kind === "forge") return recipe.name.replace(/^Forge\\s+/i, "");
  if (recipe.kind === "temper" && baseItem?.name) { const stage = Math.max(0, Math.min(3, temperTierForRecipe(recipe, baseItem))); const cleanName = baseItem.name.replace(/^\\+\\d+\\s+/i, ""); return stage === 0 ? \`Tempered \${cleanName}\` : \`+\${stage} \${cleanName}\`; }
  if (recipe.discipline === "Enchanting" && baseItem?.name) return \`\${recipe.name} \${baseItem.name}\`.trim();
  return baseItem?.name || recipe.name;
}`,
    `function suggestedResultName(recipe, baseItem) {
  if (!recipe) return "";
  if (recipe.kind === "forge") return recipe.name.replace(/^Forge\\s+/i, "");
  if (recipe.kind === "temper" && baseItem?.name) { const stage = Math.max(0, Math.min(3, temperTierForRecipe(recipe, baseItem))); const cleanName = baseItem.name.replace(/^\\+\\d+\\s+/i, ""); return stage === 0 ? \`Tempered \${cleanName}\` : \`+\${stage} \${cleanName}\`; }
  if (recipe.discipline === "Enchanting" && baseItem) return buildEnchantingPreview(recipe, baseItem, recipe.selected_option, null)?.finalName || baseItem.name;
  return baseItem?.name || recipe.name;
}`,
    "Enchanting result naming"
  );

  source = replaceRegexOnce(
    source,
    /function recipeSlotLabel\(recipe\) \{[\s\S]*?\n\}\nfunction RecipeTable/,
    `function recipeSlotLabel(recipe) {
  if (!recipe || recipe.discipline !== "Enchanting") return "—";
  return enchantingSlotForRecipe(recipe, recipe.selected_option) || "Future";
}
function RecipeTable`,
    "Exact A/B/C slot labels"
  );

  source = replaceOnce(source, `                onDoubleClick={() => onCraft?.(recipe)}`, `                onDoubleClick={() => { if (!recipe.craft_disabled) onCraft?.(recipe); }}`, "Disable future recipe double-click");
  source = replaceOnce(
    source,
    `                    className={cls("craft-row-craft-button", craftingRecipeId === recipe.id && "active")}
                    onClick={(event) => { event.stopPropagation(); onCraft?.(recipe); }}
                    title="Open this recipe's ingredient selector"
                  >
                    {craftingRecipeId === recipe.id ? "Back" : "Craft"}`,
    `                    className={cls("craft-row-craft-button", craftingRecipeId === recipe.id && "active")}
                    onClick={(event) => { event.stopPropagation(); if (!recipe.craft_disabled) onCraft?.(recipe); }}
                    title={recipe.craft_disabled ? recipe.disabled_reason || "Future enchanting content" : "Open this recipe's ingredient selector"}
                    disabled={Boolean(recipe.craft_disabled)}
                  >
                    {recipe.craft_disabled ? "Future" : craftingRecipeId === recipe.id ? "Back" : "Craft"}`,
    "Disable future recipe craft button"
  );

  source = replaceOnce(
    source,
    `function recipeWithSmithingResult(recipe = {}, preview = null) {`,
    `function recipeWithEnchantingResult(recipe = {}, preview = null) {
  if (recipe?.discipline !== "Enchanting" || !preview) return recipe;
  return {
    ...recipe,
    rarity: preview.outputRarity || recipe.rarity,
    selected_option: preview.variant?.option ?? recipe.selected_option ?? null,
    effect_text: preview.effectText || recipe.effect_text || recipe.summary,
    entries: preview.finalEntries || recipe.entries || [],
    item_description: (preview.finalEntries || []).join("\\n"),
    enchanting_result: preview,
  };
}
function recipeWithSmithingResult(recipe = {}, preview = null) {`,
    "Enchanting recipe payload helper"
  );

  source = replaceOnce(
    source,
    `  const effect = slot?.temper_elemental
    ? temperMaterialEffect(material, slot, baseItem, recipe)
    : smithingMaterialEffect(material, baseItem, recipe) || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {`,
    `  const effect = discipline === "Enchanting"
    ? enchantingCatalystEffect(material, recipe, slot?.enchanting_slot, recipe?.selected_option)
    : slot?.temper_elemental
      ? temperMaterialEffect(material, slot, baseItem, recipe)
      : smithingMaterialEffect(material, baseItem, recipe) || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {`,
    "Enchanting catalyst card effect"
  );

  source = replaceOnce(source, `  const [selectedMaterials, setSelectedMaterials] = useState({});
  const [crafterCharacterId, setCrafterCharacterId] = useState("");`, `  const [selectedMaterials, setSelectedMaterials] = useState({});
  const [enchantOption, setEnchantOption] = useState("");
  const [crafterCharacterId, setCrafterCharacterId] = useState("");`, "Enchanting option state");
  source = replaceOnce(source, `    setSelectedMaterials({});
    setCrafterCharacterId("");`, `    setSelectedMaterials({});
    setEnchantOption("");
    setCrafterCharacterId("");`, "Enchanting option reset");

  source = replaceRegexOnce(
    source,
    /  const reqs = \(recipe\.requirements \|\| \[\]\)\.filter\(Boolean\);[\s\S]*?  const destructiveSelectedMaterials = destructiveMaterialsFromSelection\(selectedMaterials, plan\);/,
    `  const enchantOptions = recipe.discipline === "Enchanting" ? enchantingRecipeOptions(recipe) : [];
  const effectiveEnchantOption = enchantOption === "" ? null : enchantOption;
  const resolvedEnchantRarity = recipe.discipline === "Enchanting" ? resolveEnchantingRecipeRarity(recipe, effectiveEnchantOption) : recipe.rarity;
  const planningRecipe = recipe.discipline === "Enchanting" ? { ...recipe, rarity: resolvedEnchantRarity, selected_option: effectiveEnchantOption } : recipe;
  const reqs = (planningRecipe.requirements || []).filter(Boolean);
  const comps = (planningRecipe.components || []).filter(Boolean);
  const alchemyDetails = alchemyFormulaDetails(planningRecipe);
  const workflow = craftingWorkflowCopy(planningRecipe);
  const workflowTheme = workflow.theme;
  const allPlanningResources = resourceCatalog.length ? resourceCatalog : materials;
  const planningResources = allPlanningResources.filter((material) => materialAllowedForRecipe(material, planningRecipe));
  const normalizedInventory = inventoryItems.map(normalizeBenchInventoryItem);
  const createsNewItem = recipeCreatesNewItem(planningRecipe);
  const baseCandidates = createsNewItem ? [] : normalizedInventory.filter((item) => isCraftBaseCandidate(item, planningRecipe));
  const baseItem = createsNewItem ? null : baseCandidates.find((item) => String(item.id) === String(baseItemId)) || null;
  const rawPlan = buildCraftBenchPlan(planningRecipe, planningResources, baseItem);
  const plan = planningRecipe.discipline === "Smithing" && baseItem ? hydrateSmithingPlanWithExisting(rawPlan, baseItem) : rawPlan;
  const targetCharacter = characters.find((character) => String(character.id) === String(targetCharacterId)) || null;
  const professionKey = professionForDiscipline(planningRecipe.discipline);
  const isNpcAssisted = Boolean(crafterContext?.character);
  const selfCrafterCandidates = characters.filter((character) => character?.kind === "player" || character?.target_type === "player");
  const selfCrafter = !isNpcAssisted ? selfCrafterCandidates.find((character) => String(character.id) === String(crafterCharacterId)) || null : null;
  const activeCrafterCharacter = isNpcAssisted ? crafterContext.character : selfCrafter;
  const activeCrafterSheet = isNpcAssisted ? crafterContext.sheet || {} : selfCrafter?.character_sheet || {};
  const crafterSnapshot = activeCrafterCharacter && professionKey ? buildCrafterProfessionSnapshot(activeCrafterCharacter, activeCrafterSheet, professionKey) : null;
  const providerOffersRequestedProfession = !isNpcAssisted || providerOffersProfession(crafterContext.character, professionKey);
  const providerTownValid = !isNpcAssisted || crafterContext?.townValid !== false;
  const providerValid = !isNpcAssisted || Boolean(providerOffersRequestedProfession && providerTownValid);
  const craftingActorValid = Boolean(activeCrafterCharacter && crafterSnapshot?.configured && providerValid);
  const enteredCraftRoll = Number(craftRollTotal);
  const resolvedCraftRollTotal = craftRollTotal !== "" ? enteredCraftRoll + Number(crafterSnapshot?.total_modifier || 0) : enteredCraftRoll;
  const effectiveCrafterProficiency = Number(crafterSnapshot?.proficiency_bonus || 0);
  const outputQuantity = recipeOutputQuantity(planningRecipe);
  const selectedMaterialObjectsForPreview = selectedMaterialObjects(selectedMaterials, plan);
  const selectedEnchantingCatalyst = planningRecipe.discipline === "Enchanting" ? selectedMaterialObjectsForPreview.find((material) => material.enchanting_catalyst) || null : null;
  const enchantingPreview = planningRecipe.discipline === "Enchanting" && baseItem ? buildEnchantingPreview(planningRecipe, baseItem, effectiveEnchantOption, selectedEnchantingCatalyst) : null;
  const rawAttemptPreview = calculateCraftAttemptPreview(planningRecipe, plan, selectedMaterials, recipeRules, materialEffects, baseItem);
  const attemptPreview = applySmithingAttemptPreview(planningRecipe, rawAttemptPreview, selectedMaterialObjectsForPreview);
  const smithingPreview = smithingProductPreview(planningRecipe, baseItem, selectedMaterialObjectsForPreview);
  const alchemyQualityPreview = planningRecipe.discipline === "Alchemy" ? alchemyBrewQualityPreview(planningRecipe, selectedMaterialObjectsForPreview) : null;
  const alchemyPreviewRecipe = alchemyQualityPreview ? { ...planningRecipe, formula_rarity: alchemyQualityPreview.formulaRarity, rarity: alchemyQualityPreview.finishedRarity } : planningRecipe;
  const displayedResultName = resultItemName || enchantingPreview?.finalName || dynamicAlchemyResultName(planningRecipe, selectedMaterialObjectsForPreview) || suggestedResultName(planningRecipe, baseItem) || planningRecipe.name;
  const alchemyProductPreview = alchemyDetails ? buildAlchemyProductPreview(planningRecipe, alchemyDetails, selectedMaterialObjectsForPreview, attemptPreview, outputQuantity, { crafterProficiency: effectiveCrafterProficiency, craftRollTotal: resolvedCraftRollTotal }) : null;
  const finalOutputQuantity = alchemyProductPreview?.outputQuantity || outputQuantity;
  const selectedMaterialList = selectedMaterialPayload(selectedMaterials, plan);
  const selectedMaterialCount = selectedMaterialList.filter((material) => material.name).length;
  const destructiveSelectedMaterials = destructiveMaterialsFromSelection(selectedMaterials, plan);
  const enchantingOptionRequired = planningRecipe.discipline === "Enchanting" && enchantOptions.length > 0;
  const enchantingOptionReady = !enchantingOptionRequired || effectiveEnchantOption !== null;
  const enchantingRecipeReady = planningRecipe.discipline !== "Enchanting" || Boolean(enchantingPreview?.valid && enchantingOptionReady);`,
    "Enchanting preview derivation"
  );

  source = replaceOnce(
    source,
    `    if (!recipe) {
      setPlanError("Choose a recipe before submitting a craft attempt.");
      return;
    }
    const enteredRoll = Number(craftRollTotal);`,
    `    if (!recipe) {
      setPlanError("Choose a recipe before submitting a craft attempt.");
      return;
    }
    if (planningRecipe.discipline === "Enchanting") {
      if (isEnchantingRecipeFuture(planningRecipe, effectiveEnchantOption)) {
        setPlanError(enchantingRecipeDisabledReason(planningRecipe, effectiveEnchantOption));
        return;
      }
      if (enchantingOptionRequired && !enchantingOptionReady) {
        setPlanError("Choose the enchantment option before submitting this craft attempt.");
        return;
      }
      if (!baseItem) {
        setPlanError("Choose the smith-tiered item that will be replaced by the enchanted result.");
        return;
      }
      if (!enchantingPreview?.requirement?.ok) {
        setPlanError(enchantingPreview?.requirement?.reason || "The selected item is not compatible with this enchantment.");
        return;
      }
      if (!selectedEnchantingCatalyst) {
        setPlanError(\`Choose a compatible catalyst for Slot \${enchantingPreview?.slot || recipeSlotLabel(planningRecipe)}.\`);
        return;
      }
    }
    const enteredRoll = Number(craftRollTotal);`,
    "Enchanting submit validation"
  );

  source = replaceOnce(
    source,
    `      const recipeForPayload = recipeWithSmithingResult(recipe, smithingPreview);
      const basePayload = craftPlanInsertPayload(recipeForPayload, plan, {
        targetCharacter,
        baseItem,
        selectedMaterials,
        resultItemName: displayedResultName,
        automationPreview: { ...attemptPreview, output_quantity: finalOutputQuantity, final_effect_preview: alchemyProductPreview || smithingPreview },
      });`,
    `      const recipeForPayload = recipeWithEnchantingResult(recipeWithSmithingResult(planningRecipe, smithingPreview), enchantingPreview);
      const basePayload = craftPlanInsertPayload(recipeForPayload, plan, {
        targetCharacter,
        baseItem,
        selectedMaterials,
        resultItemName: displayedResultName,
        enchantingPreview,
        automationPreview: { ...attemptPreview, output_quantity: finalOutputQuantity, final_effect_preview: enchantingPreview || alchemyProductPreview || smithingPreview, enchanting: enchantingPreview },
      });`,
    "Enchanting craft-plan payload"
  );

  source = replaceOnce(
    source,
    `        <span className={cls("craft-preview-rarity", \`rarity-\${String(alchemyProductPreview?.finishedRarity || recipe.rarity || "varies").toLowerCase().replace(/\\s+/g, "-")}\`)}>{alchemyProductPreview?.finishedRarity || recipe.rarity || "—"}</span>`,
    `        <span className={cls("craft-preview-rarity", \`rarity-\${String(enchantingPreview?.outputRarity || alchemyProductPreview?.finishedRarity || planningRecipe.rarity || "varies").toLowerCase().replace(/\\s+/g, "-")}\`)}>{enchantingPreview?.outputRarity || alchemyProductPreview?.finishedRarity || planningRecipe.rarity || "—"}</span>`,
    "Enchanting preview rarity"
  );
  source = replaceOnce(source, `        {recipe.summary || "No summary available."}`, `        {enchantingPreview?.effectText || planningRecipe.summary || "No summary available."}`, "Enchanting preview summary");
  source = replaceOnce(
    source,
    `            <span className="craft-chip craft-chip-gold">Slot {recipeSlotLabel(recipe)}</span>
            <span className={recipe.known ? "craft-chip craft-chip-green" : "craft-chip"}>{recipe.known ? "Owned / Known" : "Reference"}</span>`,
    `            <span className="craft-chip craft-chip-gold">Slot {recipeSlotLabel(planningRecipe)}</span>
            {planningRecipe.craft_disabled ? <span className="craft-chip craft-chip-rose">Future</span> : null}
            <span className={planningRecipe.known ? "craft-chip craft-chip-green" : "craft-chip"}>{planningRecipe.known ? "Owned / Known" : "Reference"}</span>`,
    "Enchanting preview chips"
  );

  source = replaceOnce(
    source,
    `      {alchemyDetails ? (`,
    `      {planningRecipe.discipline === "Enchanting" ? (
        <div className="craft-section craft-section-card craft-enchanting-result-preview mt-3">
          <div className="craft-section-title">A/B/C Enchantment Preview</div>
          {!baseItem ? <div className="craft-bullet muted">Choose a smith-tiered item to inspect its unlocked and occupied enchantment slots.</div> : (
            <>
              <div className="craft-enchant-slot-grid">
                {ENCHANTING_SLOT_ORDER.map((slotKey) => {
                  const unlocked = enchantingPreview?.unlockedSlots?.includes(slotKey);
                  const previous = enchantingPreview?.existingSlots?.[slotKey] || null;
                  const next = enchantingPreview?.nextSlots?.[slotKey] || null;
                  const targeted = enchantingPreview?.slot === slotKey;
                  return (
                    <div key={slotKey} className={cls("craft-enchant-slot-card", unlocked ? "unlocked" : "locked", targeted && "targeted", targeted && previous && "replacing")}>
                      <div className="craft-enchant-slot-head"><strong>Slot {slotKey}</strong><span>{unlocked ? targeted ? previous ? "Replace" : "Imbue" : next ? "Inherited" : "Open" : \`Requires +\${ENCHANTING_SLOT_RULES[slotKey].minimumTier}\`}</span></div>
                      {next ? <><div className="craft-enchant-slot-name">{next.name}</div><div className="craft-enchant-slot-rarity">{next.rarity || "—"}</div></> : <div className="craft-enchant-slot-empty">{unlocked ? "No enchantment recorded" : "Locked by smith tier"}</div>}
                      {targeted && previous ? <div className="craft-enchant-replace-note">Replaces {previous.name}; Slots {ENCHANTING_SLOT_ORDER.filter((key) => key !== slotKey).join(" and ")} remain unchanged.</div> : null}
                    </div>
                  );
                })}
              </div>
              {enchantingPreview?.effectText ? <div className="craft-final-effect-callout mt-3"><strong>Target Slot Effect</strong><p>{enchantingPreview.effectText}</p></div> : null}
              <div className="craft-formula-detail-grid mt-3">
                <div><span>Physical Tier</span><strong>+{enchantingPreview?.tier || 0}</strong></div>
                <div><span>Target Slot</span><strong>{enchantingPreview?.slotLabel || "Unavailable"}</strong></div>
                <div><span>Catalyst</span><strong>{enchantingPreview?.catalyst?.name || "Not selected"}</strong></div>
                <div><span>Final Rarity</span><strong>{enchantingPreview?.outputRarity || planningRecipe.rarity || "—"}</strong></div>
              </div>
              {enchantingPreview?.disabledReason ? <div className="craft-plan-alert danger">{enchantingPreview.disabledReason}</div> : null}
            </>
          )}
        </div>
      ) : null}

      {alchemyDetails ? (`,
    "Enchanting A/B/C preview"
  );

  source = replaceOnce(
    source,
    `  const requiredWorkflowSlots = (plan.matches || []).filter((slot) => slot.required !== false);
  const selectedRequiredSlotCount = requiredWorkflowSlots.filter((slot) => selectedMaterials[materialSlotKey(slot)]).length;
  const itemStepReady = createsNewItem || Boolean(baseItem);
  const materialStepReady = requiredWorkflowSlots.length === 0 || selectedRequiredSlotCount === requiredWorkflowSlots.length;
  const finalizeStepReady = itemStepReady && materialStepReady;`,
    `  const requiredWorkflowSlots = (plan.matches || []).filter((slot) => slot.required !== false);
  const selectedRequiredSlotCount = requiredWorkflowSlots.filter((slot) => selectedMaterials[materialSlotKey(slot)]).length;
  const itemStepReady = createsNewItem || Boolean(baseItem && (planningRecipe.discipline !== "Enchanting" || enchantingPreview?.requirement?.ok));
  const materialStepReady = (requiredWorkflowSlots.length === 0 || selectedRequiredSlotCount === requiredWorkflowSlots.length) && enchantingOptionReady;
  const finalizeStepReady = itemStepReady && materialStepReady && enchantingRecipeReady;`,
    "Enchanting workflow readiness"
  );

  source = replaceOnce(
    source,
    `{baseItem ? <div className="craft-base-pattern-card mt-2"><div><span>Selected item</span><strong>{baseItem.name}</strong></div><span className="craft-chip">{baseItem.rarity || "Mundane"}</span></div> : <div className="craft-bullet muted mt-2">Only compatible physical gear from the selected character inventory is listed.</div>}`,
    `{baseItem ? <div className="craft-base-pattern-card mt-2"><div><span>Selected item</span><strong>{baseItem.name}</strong>{planningRecipe.discipline === "Enchanting" ? <small>Unlocked: {enchantingPreview?.unlockedSlots?.map((slot) => \`Slot \${slot}\`).join(", ") || "No slots"}</small> : null}</div><span className="craft-chip">{baseItem.rarity || "Mundane"}</span></div> : <div className="craft-bullet muted mt-2">Only compatible physical gear from the selected character inventory is listed.</div>}`,
    "Enchanting base-item slot summary"
  );

  source = replaceOnce(
    source,
    `  const ingredientFamiliesBlock = plan.matches?.length ? (`,
    `  const enchantingOptionBlock = planningRecipe.discipline === "Enchanting" ? (
    <div className={cls("craft-section", "craft-section-card", "craft-enchant-trait-section", \`craft-theme-\${workflowTheme}\`, "mt-3")}>
      <div className="craft-section-title">Magical Trait</div>
      <div className="craft-base-pattern-card"><div><span>Selected enchantment</span><strong>{planningRecipe.name}</strong><small>Targets Slot {recipeSlotLabel(planningRecipe)}</small></div><span className="craft-chip craft-chip-gold">{planningRecipe.rarity || "Varies"}</span></div>
      {enchantOptions.length ? <label className="craft-enchant-option-field mt-2"><span>Trait option</span><select className="form-select craft-input" value={enchantOption} onChange={(event) => { setEnchantOption(event.target.value); setSelectedMaterials({}); setOpenSlotKey(""); }}><option value="">Choose an option</option>{enchantOptions.map((option) => <option key={String(option)} value={String(option)}>{titleCase(String(option))}</option>)}</select></label> : null}
      {planningRecipe.craft_disabled ? <div className="craft-plan-alert danger">{planningRecipe.disabled_reason || enchantingRecipeDisabledReason(planningRecipe, effectiveEnchantOption)}</div> : null}
    </div>
  ) : null;

  const ingredientFamiliesBlock = plan.matches?.length ? (`,
    "Enchanting trait/option block"
  );
  source = replaceOnce(source, `          {baseItemBlock}
          {ingredientFamiliesBlock}`, `          {baseItemBlock}
          {enchantingOptionBlock}
          {ingredientFamiliesBlock}`, "Render enchanting trait block");
  source = replaceOnce(source, `      <button type="button" className="btn btn-primary mt-2 craft-primary-action" onClick={submitPreviewCraftPlan} disabled={savingPlan || !craftRollTotal || !targetCharacterId || !craftingActorValid}>`, `      <button type="button" className="btn btn-primary mt-2 craft-primary-action" onClick={submitPreviewCraftPlan} disabled={savingPlan || !craftRollTotal || !targetCharacterId || !craftingActorValid || !finalizeStepReady}>`, "Enchanting finalization guard");

  source = replaceOnce(
    source,
    `  if (recipe?.discipline === "Smithing" && ["forge", "temper"].includes(recipe?.kind)) return temperMaterialSlotsForRecipe(recipe, baseItem);
  const alchemySlots = alchemyMaterialSlotsForRecipe(recipe);`,
    `  if (recipe?.discipline === "Smithing" && ["forge", "temper"].includes(recipe?.kind)) return temperMaterialSlotsForRecipe(recipe, baseItem);
  if (recipe?.discipline === "Enchanting") {
    const slot = enchantingSlotForRecipe(recipe, recipe.selected_option);
    const slotRule = ENCHANTING_SLOT_RULES[slot];
    if (!slotRule || isEnchantingRecipeFuture(recipe, recipe.selected_option)) return [];
    return [{ key: \`enchanting-catalyst-\${slot}\`, category: "Catalyst", label: \`Slot \${slot} Arcane Catalyst\`, role: "Binding Catalyst", required: true, enchanting_catalyst: true, enchanting_slot: slot, selected_option: recipe.selected_option ?? null, min_rarity: slotRule.minimumCatalystRarity }];
  }
  const alchemySlots = alchemyMaterialSlotsForRecipe(recipe);`,
    "Enchanting catalyst slot"
  );

  source = replaceOnce(source, `  if (d === "smithing" && Object.keys(profile).length) return true;
  if (hasExplicitAlchemyPayload(material)) return false;`, `  if (d === "smithing" && Object.keys(profile).length) return true;
  if (d === "enchanting" && isEnchantingCatalyst(material, recipe, enchantingSlotForRecipe(recipe, recipe.selected_option), recipe.selected_option)) return true;
  if (hasExplicitAlchemyPayload(material)) return false;`, "Permit shared arcane catalysts in enchanting");
  source = replaceOnce(source, `        if (recipe.discipline === "Alchemy") return materialMeetsAlchemySlot(material, slot);
        if (slot.temper_elemental) return isElementalTemperMaterial(material);`, `        if (recipe.discipline === "Alchemy") return materialMeetsAlchemySlot(material, slot);
        if (slot.enchanting_catalyst) return isEnchantingCatalyst(material, recipe, slot.enchanting_slot, recipe.selected_option);
        if (slot.temper_elemental) return isElementalTemperMaterial(material);`, "Enchanting catalyst filtering");
  source = replaceOnce(
    source,
    `        if (slot.physical_material) {
          const availableDelta = Number(Boolean(b.is_available)) - Number(Boolean(a.is_available));`,
    `        if (slot.enchanting_catalyst) {
          const availableDelta = Number(Boolean(b.is_available)) - Number(Boolean(a.is_available));
          if (availableDelta) return availableDelta;
          const resonanceDelta = Number(enchantingCatalystEffect(b, recipe, slot.enchanting_slot, recipe.selected_option)?.affinity_tags?.length || 0) - Number(enchantingCatalystEffect(a, recipe, slot.enchanting_slot, recipe.selected_option)?.affinity_tags?.length || 0);
          if (resonanceDelta) return resonanceDelta;
          return (rarityRank(b.rarity) - rarityRank(a.rarity)) || String(a.name).localeCompare(String(b.name));
        }
        if (slot.physical_material) {
          const availableDelta = Number(Boolean(b.is_available)) - Number(Boolean(a.is_available));`,
    "Enchanting catalyst sorting"
  );

  source = replaceOnce(source, `      slot_type: entry.slot_type || entry.slotType || (entry.family === "any" ? "modifier" : "core"),
      temper_elemental: Boolean(entry.temper_elemental),`, `      slot_type: entry.slot_type || entry.slotType || (entry.family === "any" ? "modifier" : "core"),
      enchanting_catalyst: Boolean(entry.enchanting_catalyst),
      enchanting_slot: entry.enchanting_slot || null,
      selected_option: entry.selected_option ?? null,
      temper_elemental: Boolean(entry.temper_elemental),`, "Enchanting selected-material payload");
  source = replaceOnce(source, `      slot_allowed_families: entry.allowed_families || entry.allowedFamilies || [],
      temper_elemental: Boolean(entry.temper_elemental),`, `      slot_allowed_families: entry.allowed_families || entry.allowedFamilies || [],
      enchanting_catalyst: Boolean(entry.enchanting_catalyst),
      enchanting_slot: entry.enchanting_slot || null,
      selected_option: entry.selected_option ?? null,
      temper_elemental: Boolean(entry.temper_elemental),`, "Enchanting selected-material object");

  source = replaceOnce(source, `  const materialBreakdown = selected.map((material) => {
    const alchemyEffect = isAlchemy ? alchemyMaterialSpecificEffect(material, effectiveRecipe) : null;
    const physicalEffect = !isAlchemy && material.temper_elemental`, `  const materialBreakdown = selected.map((material) => {
    const alchemyEffect = isAlchemy ? alchemyMaterialSpecificEffect(material, effectiveRecipe) : null;
    const enchantingEffect = recipe?.discipline === "Enchanting" ? enchantingCatalystEffect(material, recipe, material.enchanting_slot, recipe.selected_option) : null;
    const physicalEffect = !isAlchemy && material.temper_elemental`, "Enchanting attempt catalyst effect");
  source = replaceOnce(source, `    const effect = alchemyEffect || physicalEffect || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {`, `    const effect = alchemyEffect || enchantingEffect || physicalEffect || materialEffectFor(material, materialEffects) || fallbackMaterialEffect(material) || {`, "Use enchanting catalyst effect");

  source = replaceOnce(source, `      brew_quality: options.automationPreview?.brew_quality || null,
      created_from: "crafting_hub_draft",`, `      brew_quality: options.automationPreview?.brew_quality || null,
      enchanting: options.enchantingPreview || null,
      replaces_base_item: recipe?.discipline === "Enchanting",
      created_from: "crafting_hub_draft",`, "Enchanting result payload snapshot");
  source = replaceOnce(source, `      brew_quality: options.automationPreview?.brew_quality || null,
    },
  };`, `      brew_quality: options.automationPreview?.brew_quality || null,
      enchanting: options.enchantingPreview || null,
      replaces_base_item: recipe?.discipline === "Enchanting",
    },
  };`, "Enchanting plan payload snapshot");
  source = replaceOnce(source, `    if (recipe.placeholder) {
      setCraftingRecipeId(null);
      return;
    }`, `    if (recipe.placeholder || recipe.craft_disabled) {
      setCraftingRecipeId(null);
      return;
    }`, "Prevent future enchantment craft mode");

  fs.writeFileSync(itemPath, source, "utf8");
  console.log("Applied canonical A/B/C enchanting workshop patch.");
} else {
  console.log("Canonical A/B/C enchanting workshop patch already present.");
}

for (const token of ['from "../utils/enchanting"', "buildEnchantingPreview", "craft-enchant-slot-grid", "enchanting-catalyst-", "enchantingPreview", "replaces_base_item", "recipe.craft_disabled", "finalizeStepReady"]) {
  if (!source.includes(token)) throw new Error(`Enchanting page validation failed: ${token}`);
}

const stylePath = path.join(process.cwd(), "styles", "globals.scss");
let styles = fs.readFileSync(stylePath, "utf8");
const styleMarker = "/* ===== Canonical A/B/C enchanting workshop v1 ===== */";
if (!styles.includes(styleMarker)) {
  styles += `

${styleMarker}
.craft-enchant-trait-section,
.craft-enchanting-result-preview {
  border-color: rgba(171, 112, 255, .45);
  background: radial-gradient(circle at top right, rgba(143, 82, 255, .16), transparent 42%), linear-gradient(145deg, rgba(35, 23, 54, .94), rgba(18, 14, 28, .98));
}
.craft-enchant-option-field { display: grid; gap: .35rem; }
.craft-enchant-option-field > span { color: rgba(255,255,255,.68); font-size: .76rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.craft-enchant-slot-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .65rem; }
.craft-enchant-slot-card { min-height: 126px; padding: .75rem; border: 1px solid rgba(156, 113, 214, .28); border-radius: 12px; background: rgba(10, 8, 17, .56); }
.craft-enchant-slot-card.locked { opacity: .54; border-style: dashed; }
.craft-enchant-slot-card.unlocked { box-shadow: inset 0 0 24px rgba(117, 70, 194, .08); }
.craft-enchant-slot-card.targeted { border-color: rgba(198, 147, 255, .84); box-shadow: inset 0 0 0 1px rgba(198, 147, 255, .22), 0 0 24px rgba(120, 70, 210, .14); }
.craft-enchant-slot-card.replacing { border-color: rgba(244, 166, 94, .82); }
.craft-enchant-slot-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-bottom: .55rem; }
.craft-enchant-slot-head strong { color: #e7d4ff; font-size: .9rem; }
.craft-enchant-slot-head span { color: rgba(255,255,255,.58); font-size: .68rem; text-transform: uppercase; letter-spacing: .06em; }
.craft-enchant-slot-name { color: #fff; font-weight: 750; line-height: 1.25; }
.craft-enchant-slot-rarity,
.craft-enchant-slot-empty,
.craft-enchant-replace-note,
.craft-base-pattern-card small { display: block; margin-top: .3rem; color: rgba(255,255,255,.62); font-size: .72rem; line-height: 1.35; }
.craft-enchant-replace-note { margin-top: .55rem; color: #efbd88; }
.craft-row-craft-button:disabled { cursor: not-allowed; opacity: .52; }
@media (max-width: 760px) { .craft-enchant-slot-grid { grid-template-columns: 1fr; } }
`;
  fs.writeFileSync(stylePath, styles, "utf8");
  console.log("Appended canonical enchanting workshop styles.");
} else {
  console.log("Canonical enchanting workshop styles already present.");
}
if (!styles.includes(".craft-enchant-slot-grid")) throw new Error("Enchanting style validation failed");

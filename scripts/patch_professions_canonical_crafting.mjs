import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one match, found ${count}`);
  }
  return source.replace(before, after);
}

function patchCharacterSheet() {
  const target = path.join(process.cwd(), "components", "CharacterSheet5e.js");
  let source = fs.readFileSync(target, "utf8");
  const marker = "PROFESSION_DEFINITIONS";

  if (!source.includes(marker)) {
    source = replaceOnce(
      source,
      'import { useEffect, useMemo, useState } from "react";',
      `import { useEffect, useMemo, useState } from "react";
import {
  ABILITY_LABELS,
  PROFESSION_DEFINITIONS,
  PROFESSION_KEYS,
  normalizeProfessions,
  professionModifierFromSheet,
} from "../utils/craftingProfessions";`,
      "CharacterSheet5e profession imports"
    );

    source = replaceOnce(
      source,
      `    proficiencies: {
      saves: { ...(prof.saves || {}) },
      skills: { ...(prof.skills || {}) },
    },`,
      `    proficiencies: {
      saves: { ...(prof.saves || {}) },
      skills: { ...(prof.skills || {}) },
    },
    professions: normalizeProfessions(s.professions),`,
      "CharacterSheet5e normalized professions"
    );

    source = replaceOnce(
      source,
      `  function getSaveMod(abilKey) {`,
      `  function setProfessionRank(professionKey, rank) {
    const next = ensureSheetShape(s);
    next.professions = normalizeProfessions(next.professions);
    next.professions[professionKey] = {
      ...next.professions[professionKey],
      rank: Math.max(0, Math.min(2, Number(rank) || 0)),
    };
    patch(next);
  }

  function cycleProfessionRank(professionKey) {
    const current = Number(s.professions?.[professionKey]?.rank || 0);
    setProfessionRank(professionKey, (current + 1) % 3);
  }

  function setProfessionAbility(professionKey, ability) {
    const definition = PROFESSION_DEFINITIONS[professionKey];
    if (!definition?.abilities?.includes(ability)) return;
    const next = ensureSheetShape(s);
    next.professions = normalizeProfessions(next.professions);
    next.professions[professionKey] = {
      ...next.professions[professionKey],
      ability,
    };
    patch(next);
  }

  function professionDetail(professionKey) {
    const abilities = Object.fromEntries(
      ABILITIES.map((ability) => [ability.key, { score: effectiveAbilityScores[ability.key] ?? 10 }])
    );
    return professionModifierFromSheet({ ...s, abilities }, professionKey);
  }

  function getSaveMod(abilKey) {`,
      "CharacterSheet5e profession helpers"
    );

    source = replaceOnce(
      source,
      `          </div>
        </div>

        {/* Column 3 */}`,
      `          </div>

          <div className="csheet-section">
            <div className="csheet-section-title">Professions</div>
            <div className="csheet-list">
              {PROFESSION_KEYS.map((professionKey) => {
                const definition = PROFESSION_DEFINITIONS[professionKey];
                const detail = professionDetail(professionKey);
                const rank = Number(detail?.rank || 0);
                const ability = detail?.ability || definition.abilities[0];
                return (
                  <div key={professionKey} className="csheet-row csheet-profession-row">
                    <ProfToggle
                      state={rank}
                      onCycle={() => cycleProfessionRank(professionKey)}
                      title={editable ? "Cycle: proficient → expertise → off" : detail?.rankLabel || "Untrained"}
                      ariaLabel={`${definition.label} profession proficiency`}
                    />
                    <div className="csheet-profession-main">
                      <button
                        type="button"
                        className="csheet-rollbtn"
                        onClick={() => doRoll(`${definition.label} (${ability.toUpperCase()})`, detail?.totalModifier || 0, "normal")}
                        title={`${definition.tool}: ${detail?.rankLabel || "Untrained"}. Roll d20 + ${ABILITY_LABELS[ability] || ability.toUpperCase()} modifier + profession proficiency.`}
                      >
                        <span className="csheet-rollname">
                          {definition.label} <span className="csheet-sub">({ability.toUpperCase()})</span>
                        </span>
                        <span className="csheet-rollmod">{fmtMod(detail?.totalModifier || 0)}</span>
                      </button>
                      {editable ? (
                        <select
                          className="form-select form-select-sm csheet-profession-ability"
                          value={ability}
                          onChange={(event) => setProfessionAbility(professionKey, event.target.value)}
                          aria-label={`${definition.label} associated ability`}
                        >
                          {definition.abilities.map((abilityKey) => (
                            <option key={abilityKey} value={abilityKey}>{ABILITY_LABELS[abilityKey] || abilityKey.toUpperCase()}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="csheet-profession-tool">{definition.tool} • {detail?.rankLabel || "Untrained"}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="csheet-profession-note">Scribe profile support is active; scroll and spell-transcription recipes remain limited until the campaign spell list is supplied.</div>
          </div>
        </div>

        {/* Column 3 */}`,
      "CharacterSheet5e profession section"
    );

    fs.writeFileSync(target, source, "utf8");
    console.log("Applied unified profession section to CharacterSheet5e.");
  } else {
    console.log("CharacterSheet5e profession patch already present.");
  }

  const required = [
    "PROFESSION_DEFINITIONS",
    "professions: normalizeProfessions",
    "cycleProfessionRank",
    "csheet-profession-row",
    "Scribe profile support is active",
  ];
  for (const token of required) {
    if (!source.includes(token)) throw new Error(`CharacterSheet5e validation failed: ${token}`);
  }
}

function patchItemsPage() {
  const target = path.join(process.cwd(), "pages", "items.js");
  let source = fs.readFileSync(target, "utf8");
  const marker = "buildCrafterProfessionSnapshot";

  if (!source.includes(marker)) {
    source = replaceOnce(
      source,
      'import { supabase } from "../utils/supabaseClient";',
      `import { supabase } from "../utils/supabaseClient";
import {
  buildCrafterProfessionSnapshot,
  professionForDiscipline,
  providerOffersProfession,
} from "../utils/craftingProfessions";`,
      "Crafting page profession imports"
    );

    source = replaceOnce(
      source,
      `const SMITHING_SECTIONS = ["All", "Melee Weapon", "Ranged Weapon", "Ammo", "Armor", "Shield", "Tempering"];
const LETHO_TEST_TARGET`,
      `const SMITHING_SECTIONS = ["All", "Melee Weapon", "Ranged Weapon", "Ammo", "Armor", "Shield", "Tempering"];
const SCRIBE_PLACEHOLDER_RECIPE = {
  id: "scribe:placeholder",
  kind: "placeholder",
  name: "Scribe Workshop (Coming Soon)",
  known: true,
  family: "Transcription",
  rarity: "Varies",
  source: "DNDNext",
  discipline: "Scribe",
  category: "Scrolls & Inscription",
  summary: "Scribe profession setup is available. Scroll, ritual, and spell-transcription recipes will be added after the campaign spell list is supplied.",
  requirements: ["A configured Scribe profession", "A future spell or inscription recipe"],
  components: ["Calligrapher's Supplies", "Ink and parchment"],
  placeholder: true,
};
const LETHO_TEST_TARGET`,
      "Crafting page Scribe placeholder"
    );

    source = replaceOnce(
      source,
      `function RecipePreview({ recipe, materials = [], inventoryItems = [], characters = [], recipeRules = [], materialEffects = [], resourceCatalog = [], isAdminTestResources = false, craftMode = false, onExitCraft }) {`,
      `function RecipePreview({ recipe, materials = [], inventoryItems = [], characters = [], recipeRules = [], materialEffects = [], resourceCatalog = [], isAdminTestResources = false, crafterContext = null, craftMode = false, onExitCraft }) {`,
      "RecipePreview crafter context prop"
    );

    source = replaceOnce(
      source,
      `  const targetCharacter = characters.find((character) => String(character.id) === String(targetCharacterId)) || null;
  const outputQuantity = recipeOutputQuantity(recipe);`,
      `  const targetCharacter = characters.find((character) => String(character.id) === String(targetCharacterId)) || null;
  const professionKey = professionForDiscipline(recipe.discipline);
  const isNpcAssisted = Boolean(crafterContext?.character);
  const crafterSnapshot = isNpcAssisted && professionKey
    ? buildCrafterProfessionSnapshot(crafterContext.character, crafterContext.sheet || {}, professionKey)
    : null;
  const providerOffersRequestedProfession = !isNpcAssisted || providerOffersProfession(crafterContext.character, professionKey);
  const providerTownValid = !isNpcAssisted || crafterContext?.townValid !== false;
  const providerValid = !isNpcAssisted || Boolean(providerOffersRequestedProfession && providerTownValid && crafterSnapshot?.configured);
  const enteredCraftRoll = Number(craftRollTotal);
  const resolvedCraftRollTotal = isNpcAssisted && craftRollTotal !== ""
    ? enteredCraftRoll + Number(crafterSnapshot?.total_modifier || 0)
    : enteredCraftRoll;
  const effectiveCrafterProficiency = isNpcAssisted
    ? Number(crafterSnapshot?.proficiency_bonus || 0)
    : Number(crafterProficiency || 0);
  const outputQuantity = recipeOutputQuantity(recipe);`,
      "RecipePreview profession derivation"
    );

    source = replaceOnce(
      source,
      `  const alchemyProductPreview = alchemyDetails ? buildAlchemyProductPreview(recipe, alchemyDetails, selectedMaterialObjectsForPreview, attemptPreview, outputQuantity, { crafterProficiency, craftRollTotal }) : null;`,
      `  const alchemyProductPreview = alchemyDetails ? buildAlchemyProductPreview(recipe, alchemyDetails, selectedMaterialObjectsForPreview, attemptPreview, outputQuantity, { crafterProficiency: effectiveCrafterProficiency, craftRollTotal: resolvedCraftRollTotal }) : null;`,
      "RecipePreview profession-aware alchemy preview"
    );

    source = replaceOnce(
      source,
      `    const requestedRollTotal = Number(craftRollTotal);
    if (!Number.isFinite(requestedRollTotal) || requestedRollTotal < 1) {
      setPlanError("Enter the completed d20 + modifiers total before submitting this craft attempt.");
      return;
    }`,
      `    const enteredRoll = Number(craftRollTotal);
    if (!Number.isFinite(enteredRoll) || enteredRoll < 1 || (isNpcAssisted && enteredRoll > 20)) {
      setPlanError(isNpcAssisted ? "Enter the raw d20 roll from 1 to 20. The NPC profession modifier is added automatically." : "Enter the completed d20 + modifiers total before submitting this craft attempt.");
      return;
    }
    if (isNpcAssisted && !providerOffersRequestedProfession) {
      setPlanError("This NPC is not configured to provide the selected profession.");
      return;
    }
    if (isNpcAssisted && !providerTownValid) {
      setPlanError("This crafter is not assigned to the town that opened the workshop.");
      return;
    }
    if (isNpcAssisted && !crafterSnapshot?.configured) {
      setPlanError("Profession not configured for this crafter.");
      return;
    }
    const requestedRollTotal = isNpcAssisted
      ? enteredRoll + Number(crafterSnapshot?.total_modifier || 0)
      : enteredRoll;`,
      "RecipePreview raw NPC d20 validation"
    );

    source = replaceOnce(
      source,
      `        plan_payload: {
          ...(basePayload.plan_payload || {}),
          requested_roll_total: requestedRollTotal,
          submitted_for_review_at: submittedAt,
        },
        result_item_payload: {
          ...(basePayload.result_item_payload || {}),
          requested_roll_total: requestedRollTotal,
        },`,
      `        plan_payload: {
          ...(basePayload.plan_payload || {}),
          requested_roll_total: requestedRollTotal,
          craft_roll_input: isNpcAssisted ? enteredRoll : null,
          crafter_snapshot: crafterSnapshot,
          submitted_for_review_at: submittedAt,
        },
        result_item_payload: {
          ...(basePayload.result_item_payload || {}),
          requested_roll_total: requestedRollTotal,
          craft_roll_input: isNpcAssisted ? enteredRoll : null,
          crafter_snapshot: crafterSnapshot,
        },`,
      "Craft plan crafter snapshot"
    );

    source = replaceOnce(
      source,
      `      {alchemyProductPreview?.saveDcPreview ? <div className="craft-bomb-save-controls">
        <label><span>Crafter Proficiency</span><input className="form-control craft-input" type="number" min="0" max="10" value={crafterProficiency} onChange={(event) => setCrafterProficiency(event.target.value)} /></label>
        <label><span>Craft Roll Total</span><input className="form-control craft-input" type="number" value={craftRollTotal} onChange={(event) => setCraftRollTotal(event.target.value)} placeholder={`DC ${attemptPreview.final_dc} or higher`} /></label>`,
      `      {alchemyProductPreview?.saveDcPreview ? <div className="craft-bomb-save-controls">
        {!isNpcAssisted ? <label><span>Crafter Proficiency</span><input className="form-control craft-input" type="number" min="0" max="10" value={crafterProficiency} onChange={(event) => setCrafterProficiency(event.target.value)} /></label> : null}
        <label><span>{isNpcAssisted ? "Raw d20 Roll" : "Craft Roll Total"}</span><input className="form-control craft-input" type="number" min="1" max={isNpcAssisted ? 20 : 99} value={craftRollTotal} onChange={(event) => setCraftRollTotal(event.target.value)} placeholder={isNpcAssisted ? "1–20" : `DC ${attemptPreview.final_dc} or higher`} /></label>`,
      "Alchemy profession roll controls"
    );

    source = replaceOnce(
      source,
      `      <label className="small text-muted mb-1">Craft Roll Total</label>
      <input className="form-control craft-input" type="number" min="1" max="99" value={craftRollTotal} onChange={(event) => setCraftRollTotal(event.target.value)} placeholder="d20 + modifiers" />
      <div className="craft-form-help">Submit the completed check total. The admin review modal resolves it against DC {attemptPreview.final_dc}.</div>`,
      `      <label className="small text-muted mb-1">{isNpcAssisted ? "Raw d20 Roll" : "Craft Roll Total"}</label>
      <input className="form-control craft-input" type="number" min="1" max={isNpcAssisted ? 20 : 99} value={craftRollTotal} onChange={(event) => setCraftRollTotal(event.target.value)} placeholder={isNpcAssisted ? "1–20" : "d20 + modifiers"} />
      <div className="craft-form-help">{isNpcAssisted ? `${crafterContext.character.name} adds ${crafterSnapshot?.total_modifier >= 0 ? "+" : ""}${crafterSnapshot?.total_modifier || 0} from ${crafterSnapshot?.profession_label || "Profession"}. Current resolved total: ${Number.isFinite(resolvedCraftRollTotal) && craftRollTotal !== "" ? resolvedCraftRollTotal : "—"}.` : `Submit the completed check total. The admin review modal resolves it against DC ${attemptPreview.final_dc}.`}</div>`,
      "Craft plan profession roll input"
    );

    source = replaceOnce(
      source,
      `      <button type="button" className="btn btn-primary mt-2 craft-primary-action" onClick={submitPreviewCraftPlan} disabled={savingPlan || !craftRollTotal || !targetCharacterId}>`,
      `      <button type="button" className="btn btn-primary mt-2 craft-primary-action" onClick={submitPreviewCraftPlan} disabled={savingPlan || !craftRollTotal || !targetCharacterId || (isNpcAssisted && !providerValid)}>`,
      "Craft submit provider validation"
    );

    source = replaceOnce(
      source,
      `  if (craftMode) {
    return (
      <div className={cls("craft-recipe-craft-layout", `craft-theme-${workflowTheme}`)}>
        <div className="craft-crafting-left-column">`,
      `  const crafterContextBlock = isNpcAssisted ? (
    <div className={cls("craft-section", "craft-section-card", "craft-provider-card", `craft-theme-${workflowTheme}`)}>
      <div className="craft-provider-head">
        <div>
          <div className="craft-kicker">NPC-Assisted Workshop</div>
          <h3>Working with {crafterContext.character.name}</h3>
          <p>{crafterContext.character.role || crafterContext.character.affiliation || "Town crafter"}</p>
        </div>
        <span className={cls("craft-status-pill", providerValid ? "known" : "danger")}>{providerValid ? "Profession ready" : "Configuration required"}</span>
      </div>
      {crafterSnapshot ? (
        <div className="craft-provider-grid">
          <div><span>Profession</span><strong>{crafterSnapshot.profession_label}</strong></div>
          <div><span>Ability</span><strong>{crafterSnapshot.ability_label} {crafterSnapshot.ability_modifier >= 0 ? "+" : ""}{crafterSnapshot.ability_modifier}</strong></div>
          <div><span>Training</span><strong>{crafterSnapshot.proficiency_rank_label} (PB +{crafterSnapshot.proficiency_bonus})</strong></div>
          <div><span>Craft Modifier</span><strong>{crafterSnapshot.total_modifier >= 0 ? "+" : ""}{crafterSnapshot.total_modifier}</strong></div>
        </div>
      ) : null}
      {!providerOffersRequestedProfession ? <div className="craft-plan-alert danger">This NPC does not offer {recipe.discipline}.</div> : null}
      {!providerTownValid ? <div className="craft-plan-alert danger">This crafter is not assigned to the town that opened the workshop.</div> : null}
      {providerOffersRequestedProfession && !crafterSnapshot?.configured ? <div className="craft-plan-alert danger">Profession not configured for this crafter.</div> : null}
    </div>
  ) : null;

  if (craftMode) {
    return (
      <div className={cls("craft-recipe-craft-layout", `craft-theme-${workflowTheme}`, isNpcAssisted && "craft-provider-layout")}>
        <div className="craft-crafting-left-column">`,
      "NPC-assisted craft layout"
    );

    source = replaceOnce(
      source,
      `          {workflowStepsBlock}
          {baseItemBlock}`,
      `          {crafterContextBlock}
          {workflowStepsBlock}
          {baseItemBlock}`,
      "NPC provider card render"
    );

    source = replaceOnce(
      source,
      `    check_ability: rule?.check_ability || (recipe?.discipline === "Smithing" ? "Strength or Intelligence" : recipe?.discipline === "Alchemy" ? "Intelligence or Wisdom" : "Intelligence or Charisma"),
    check_tool: rule?.check_tool || (recipe?.discipline === "Smithing" ? "Smith's Tools" : recipe?.discipline === "Alchemy" ? "Alchemist's Supplies" : "Arcana or Enchanter's Tools"),`,
      `    check_ability: rule?.check_ability || (recipe?.discipline === "Smithing" ? "Strength or Intelligence" : recipe?.discipline === "Alchemy" ? "Intelligence or Wisdom" : recipe?.discipline === "Scribe" ? "Intelligence or Wisdom" : "Intelligence or Charisma"),
    check_tool: rule?.check_tool || (recipe?.discipline === "Smithing" ? "Smith's Tools" : recipe?.discipline === "Alchemy" ? "Alchemist's Supplies" : recipe?.discipline === "Scribe" ? "Calligrapher's Supplies" : "Enchanter's Tools"),`,
      "Profession check defaults"
    );

    source = replaceOnce(
      source,
      `  if (recipe.discipline === "Enchanting") return {
    theme: "enchanting",
    kicker: "Enchanting Workshop",
    description: "Choose a smith-tiered item, select a magical trait and compatible catalyst, then review the runed result and Craft DC.",
    step1: "Choose Tiered Item",
    step2: "Trait & Catalyst",
    step3: "Finalize",
    materialTitle: "Enchanting Components",
  };
  return {`,
      `  if (recipe.discipline === "Enchanting") return {
    theme: "enchanting",
    kicker: "Enchanting Workshop",
    description: "Choose a smith-tiered item, select a magical trait and compatible catalyst, then review the runed result and Craft DC.",
    step1: "Choose Tiered Item",
    step2: "Trait & Catalyst",
    step3: "Finalize",
    materialTitle: "Enchanting Components",
  };
  if (recipe.discipline === "Scribe") return {
    theme: "scribe",
    kicker: "Scribe Workshop",
    description: "Scribe profession support is active. Scroll and spell-transcription recipes remain a placeholder until the campaign spell list is supplied.",
    step1: "Choose Text",
    step2: "Ink & Materials",
    step3: "Finalize",
    materialTitle: "Scribing Components",
  };
  return {`,
      "Scribe workflow copy"
    );

    source = replaceOnce(
      source,
      `    {
      id: "harvesting",
      title: "Harvesting",
      icon: "🦴",
      summary: "Track monster parts, plant gathering, and future quality grades used by recipes.",
      recipes: recipes.filter((recipe) => /monster|harvest|plant|reagent|alchemy/i.test(recipe.summary || recipe.name || "")),
      materials,
      unlocks: ["Material quality", "Source tracking", "Biome/monster clue links", "Future gathering rolls"],
    },`,
      `    {
      id: "scribe",
      title: "Scribe",
      icon: "📜",
      summary: "Copy scrolls, rituals, maps, contracts, and encoded texts once the campaign spell list and recipe catalog are supplied.",
      recipes: recipes.filter((recipe) => recipe.discipline === "Scribe"),
      materials: materials.filter((material) => /ink|parchment|paper|vellum|quill|reagent|catalyst/i.test([material.name, material.category, material.type].filter(Boolean).join(" "))),
      unlocks: ["Profession profile and associated ability", "Placeholder workshop access", "Future spell transcription", "Future ritual, map, and contract recipes"],
    },`,
      "Replace harvesting mastery with Scribe"
    );

    source = replaceOnce(
      source,
      `          ...ALCHEMY_POTION_FORMULAS.filter((formula) => !COMPACT_ALCHEMY_RECIPE_NAMES.has(formula.name)).map(alchemyFormulaRecipe),
          ...dbRecipes.map((r) => dbRecipe(r, knownIds)),`,
      `          ...ALCHEMY_POTION_FORMULAS.filter((formula) => !COMPACT_ALCHEMY_RECIPE_NAMES.has(formula.name)).map(alchemyFormulaRecipe),
          SCRIBE_PLACEHOLDER_RECIPE,
          ...dbRecipes.map((r) => dbRecipe(r, knownIds)),`,
      "Insert Scribe placeholder recipe"
    );

    source = replaceOnce(
      source,
      `const [authResponse, itemsJson, flavorOverrides, alchemyCatalogJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, plantCatalogRows, dbCatalogRows, knownRows, craftPlanRows, craftAttemptRows, characterRows, playerRows, recipeRuleRows, materialEffectRows, locationRows, forageTableRows, forageEntryRows]`,
      `const [authResponse, itemsJson, flavorOverrides, alchemyCatalogJson, coreVariants, hbVariants, dbRecipes, inventoryRows, plantRows, plantCatalogRows, dbCatalogRows, knownRows, craftPlanRows, craftAttemptRows, characterRows, characterSheetRows, playerRows, recipeRuleRows, materialEffectRows, locationRows, forageTableRows, forageEntryRows]`,
      "Load character sheet rows"
    );

    source = replaceOnce(
      source,
      `          selectSafe("characters", "*", "name"),
          selectSafe("players", "*", "name"),`,
      `          selectSafe("characters", "*", "name"),
          selectSafe("character_sheets", "character_id,sheet,updated_at", "updated_at"),
          selectSafe("players", "*", "name"),`,
      "Character sheets query"
    );

    source = replaceOnce(
      source,
      `setCharacters(mergeCraftTargetOptions(characterRows, playerRows));`,
      `setCharacters(mergeCraftTargetOptions(characterRows, playerRows).map((character) => ({ ...character, character_sheet: (characterSheetRows || []).find((row) => String(row.character_id) === String(character.id))?.sheet || null })));`,
      "Attach character sheets to craft actors"
    );

    source = replaceOnce(
      source,
      `    const requestedDiscipline = ["Smithing", "Enchanting", "Alchemy"].find((value) => value.toLowerCase() === requested.toLowerCase()) || "";`,
      `    const requestedDiscipline = ["Smithing", "Enchanting", "Alchemy", "Scribe"].find((value) => value.toLowerCase() === requested.toLowerCase()) || "";`,
      "Scribe deep-link discipline"
    );

    source = replaceOnce(
      source,
      `        setCraftingRecipeId(shouldCraft ? firstRecipe.id : null);`,
      `        setCraftingRecipeId(shouldCraft && !firstRecipe.placeholder ? firstRecipe.id : null);`,
      "Prevent placeholder craft mode"
    );

    source = replaceOnce(
      source,
      `  const filteredMaterials = useMemo(() => materials.filter((m) => (materialCategoryFilter === "All" || m.category === materialCategoryFilter) && materialMatches(m, query)), [materials, materialCategoryFilter, query]);`,
      `  const requestedCrafterId = router.isReady ? String(router.query.crafter || "").trim() : "";
  const requestedTownId = router.isReady ? String(router.query.town || "").trim() : "";
  const requestedCrafter = requestedCrafterId ? characters.find((character) => String(character.id) === requestedCrafterId) || null : null;
  const requestedCrafterTownValid = !requestedCrafter || !requestedTownId || [requestedCrafter.location_id, requestedCrafter.home_location_id].filter(Boolean).some((value) => String(value) === requestedTownId);
  const activeCrafterContext = requestedCrafter ? { character: requestedCrafter, sheet: requestedCrafter.character_sheet || {}, townValid: requestedCrafterTownValid } : null;
  const crafterQueryError = requestedCrafterId && !requestedCrafter ? "The requested crafter could not be loaded." : "";

  const filteredMaterials = useMemo(() => materials.filter((m) => (materialCategoryFilter === "All" || m.category === materialCategoryFilter) && materialMatches(m, query)), [materials, materialCategoryFilter, query]);`,
      "Resolve requested crafter"
    );

    source = replaceOnce(
      source,
      `  function toggleCraftRecipe(recipe) {
    if (!recipe) return;
    setSelected(recipe);
    setCraftingRecipeId((prev) => prev === recipe.id ? null : recipe.id);
  }`,
      `  function toggleCraftRecipe(recipe) {
    if (!recipe) return;
    setSelected(recipe);
    if (recipe.placeholder) {
      setCraftingRecipeId(null);
      return;
    }
    setCraftingRecipeId((prev) => prev === recipe.id ? null : recipe.id);
  }`,
      "Prevent Scribe placeholder crafting"
    );

    source = replaceOnce(
      source,
      `["All", "Smithing", "Enchanting", "Alchemy", "Known"].map`,
      `["All", "Smithing", "Enchanting", "Alchemy", "Scribe", "Known"].map`,
      "Scribe quick filter"
    );

    source = replaceOnce(
      source,
      `{err ? <div className="alert alert-danger">{err}</div> : null}{loading ? <div className="text-muted">Loading crafting data…</div> : null}`,
      `{err ? <div className="alert alert-danger">{err}</div> : null}{crafterQueryError ? <div className="alert alert-danger">{crafterQueryError}</div> : null}{loading ? <div className="text-muted">Loading crafting data…</div> : null}`,
      "Crafter query error"
    );

    source = replaceOnce(
      source,
      `isAdminTestResources={isAdminTestResources} craftMode onExitCraft={() => setCraftingRecipeId(null)} />`,
      `isAdminTestResources={isAdminTestResources} crafterContext={activeCrafterContext} craftMode onExitCraft={() => setCraftingRecipeId(null)} />`,
      "Pass crafter context to canonical workbench"
    );

    fs.writeFileSync(target, source, "utf8");
    console.log("Applied canonical profession and NPC-assisted crafting patch.");
  } else {
    console.log("Canonical profession crafting patch already present.");
  }

  const required = [
    "buildCrafterProfessionSnapshot",
    "SCRIBE_PLACEHOLDER_RECIPE",
    "crafterContext = null",
    "crafter_snapshot: crafterSnapshot",
    "Profession not configured for this crafter",
    "NPC-Assisted Workshop",
    "character_sheets",
    "activeCrafterContext",
    '"Scribe", "Known"',
  ];
  for (const token of required) {
    if (!source.includes(token)) throw new Error(`Crafting page validation failed: ${token}`);
  }
}

function patchTownSheet() {
  const target = path.join(process.cwd(), "components", "TownSheet.js");
  let source = fs.readFileSync(target, "utf8");
  const marker = "disciplineForCraftType";

  if (!source.includes(marker)) {
    source = replaceOnce(
      source,
      `function CrafterRow({ crafter, onOpenWorkshop }) {
  const types = inferCrafterTypes(crafter);
  const profileHref = crafter?.id ? `/npcs#${crafter.id}` : null;`,
      `function disciplineForCraftType(type) {
  switch (type) {
    case "blacksmith": return "Smithing";
    case "alchemist": return "Alchemy";
    case "enchanter": return "Enchanting";
    case "scribe": return "Scribe";
    default: return "";
  }
}

function CrafterRow({ crafter }) {
  const types = inferCrafterTypes(crafter).filter((type) => disciplineForCraftType(type));
  const workshopLinks = types.map((type) => ({ type, discipline: disciplineForCraftType(type) }));
  const profileHref = crafter?.id ? `/npcs#${crafter.id}` : null;`,
      "Town crafter canonical links"
    );

    source = replaceOnce(
      source,
      `{types.length ? <button type="button" className="btn btn-sm btn-success" onClick={() => onOpenWorkshop(crafter)}>Open Workshop</button> : null}`,
      `{workshopLinks.map((entry) => <Link key={entry.type} className="btn btn-sm btn-success" href={{ pathname: "/items", query: { discipline: entry.discipline, craft: "1", crafter: crafter?.id || "", from: "town", town: crafter?.location_id || crafter?.home_location_id || "" } }}>Open {entry.discipline}</Link>)}`,
      "Town crafter direct canonical workshop links"
    );

    source = replaceOnce(
      source,
      `Blacksmiths, alchemists, enchanters, scribes, and jewelers with clear workshop roles are surfaced here. Generic townsfolk no longer open the crafting workflow by default.`,
      `Blacksmiths, alchemists, enchanters, and scribes with clear workshop roles are surfaced here. Generic townsfolk no longer open the crafting workflow by default. Jewelry remains a future Smithing specialty rather than a separate profession.`,
      "Town crafter profession scope"
    );

    fs.writeFileSync(target, source, "utf8");
    console.log("Routed town crafters directly into the canonical workshop.");
  } else {
    console.log("Town crafter canonical routing already present.");
  }

  const required = [
    "disciplineForCraftType",
    "Open {entry.discipline}",
    'pathname: "/items"',
    "Jewelry remains a future Smithing specialty",
  ];
  for (const token of required) {
    if (!source.includes(token)) throw new Error(`TownSheet profession validation failed: ${token}`);
  }
}

function patchStyles() {
  const target = path.join(process.cwd(), "styles", "globals.scss");
  let source = fs.readFileSync(target, "utf8");
  const marker = "/* ===== Canonical professions and NPC workshops v1 ===== */";

  if (!source.includes(marker)) {
    source += `

${marker}
.csheet-profession-row {
  align-items: flex-start;
}

.csheet-profession-main {
  flex: 1 1 auto;
  min-width: 0;
}

.csheet-profession-ability {
  margin-top: 0.35rem;
  min-height: 30px;
  font-size: 0.76rem;
}

.csheet-profession-tool,
.csheet-profession-note {
  color: rgba(255, 255, 255, 0.64);
  font-size: 0.72rem;
  line-height: 1.35;
}

.csheet-profession-tool {
  padding: 0.2rem 0.35rem 0;
}

.csheet-profession-note {
  margin-top: 0.65rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(169, 137, 220, 0.24);
  border-radius: 8px;
  background: rgba(31, 23, 45, 0.58);
}

.craft-provider-layout {
  position: relative;
}

.craft-provider-layout::before {
  content: "";
  position: absolute;
  inset: -14px;
  pointer-events: none;
  border-radius: 22px;
  background:
    radial-gradient(circle at 12% 5%, rgba(236, 185, 92, 0.12), transparent 34%),
    linear-gradient(135deg, rgba(77, 49, 28, 0.2), transparent 46%);
}

.craft-provider-layout > * {
  position: relative;
  z-index: 1;
}

.craft-provider-card {
  border-color: rgba(233, 184, 93, 0.58);
  background:
    linear-gradient(135deg, rgba(76, 48, 27, 0.72), rgba(24, 20, 31, 0.94)),
    radial-gradient(circle at top right, rgba(220, 158, 63, 0.18), transparent 42%);
  box-shadow: inset 0 0 0 1px rgba(255, 224, 160, 0.06), 0 16px 42px rgba(0, 0, 0, 0.24);
}

.craft-provider-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.craft-provider-head h3 {
  margin: 0.2rem 0 0.25rem;
}

.craft-provider-head p {
  margin: 0;
}

.craft-provider-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
  margin-top: 0.85rem;
}

.craft-provider-grid > div {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid rgba(255, 224, 160, 0.16);
  border-radius: 9px;
  background: rgba(12, 10, 16, 0.42);
}

.craft-provider-grid span {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

@media (max-width: 900px) {
  .craft-provider-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .craft-provider-head {
    display: block;
  }

  .craft-provider-head .craft-status-pill {
    display: inline-flex;
    margin-top: 0.65rem;
  }

  .craft-provider-grid {
    grid-template-columns: 1fr;
  }
}
`;
    fs.writeFileSync(target, source, "utf8");
    console.log("Appended profession and NPC workshop styles.");
  } else {
    console.log("Profession and NPC workshop styles already present.");
  }

  if (!source.includes(".craft-provider-grid")) throw new Error("Profession style validation failed");
}

patchCharacterSheet();
patchItemsPage();
patchTownSheet();
patchStyles();
console.log("Canonical profession crafting patch complete.");

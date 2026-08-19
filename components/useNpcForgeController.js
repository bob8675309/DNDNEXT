import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import { ABILITY_KEYS, ABILITY_LABELS, CLASS_DEFINITIONS, FEAT_OPTIONS, SKILL_DEFINITIONS, SPECIES_DEFINITIONS, buildCharacterCreatePayload } from "../utils/characterCreation";
import { FALLBACK_SKILL_DESCRIPTIONS, abilityScoresFromRollAllocation, defaultRollAllocation, flexibleAbilityBoosts } from "../utils/characterCreationGuidance";
import { extractClassSkillConfiguration, mergePreferredBackgrounds, mergePreferredClasses, mergePreferredSpecies, normalizeSkillKey, optionMatchesQuery, safeText, slug, uniqueText } from "../utils/npcForgeCatalog";
import { emptyPointBuyScores, pointBuyRemaining, rollAbilityPoolForMethod, spellChoicesForRpc, validateStartingSpellSelections } from "../utils/playerForgeRules";
import { normalizeStartingEquipmentSelection, startingEquipmentSelectionComplete } from "../utils/playerForgeStartingEquipment";
import { speciesDefaultCharacterSize } from "../utils/speciesPresentation";
import { clearForgeValidationGuidance, forgeStepGuidanceSelectors, showForgeValidationGuidance } from "../utils/forgeValidationGuidance";
import { generateNpcName } from "../utils/npcNameGenerator";
import { generateNpcStory, generatedStoryLocationLabel } from "../utils/npcStoryGenerator";
import { backgroundFeatRule as getBackgroundFeatRule, backgroundFeatSummary, resolveBackgroundFeatOptions } from "../utils/backgroundMechanics";
import { selectedSubclassOption, useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import useNpcForgeDerivedModel from "./useNpcForgeDerivedModel";
import { NPC_STEP_LABELS, PLAYER_STEP_LABELS, initialDraft, titleForSkill, abilityModifier, proficiencyBonus, maximumHitPoints, sourceLabel, standardScoresForClass, speciesTraits, optionId, assetSummary, toolProficiencyDescription, recoverCreatedCharacter } from "./NpcForgeCoreSupport";

export default function useNpcForgeController({ show, onClose, onCreated, locations = [], mode = "npc", createCharacter = null, onReset = null }) {
  const playerMode = mode === "player";
  const STEP_LABELS = playerMode ? PLAYER_STEP_LABELS : NPC_STEP_LABELS;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => initialDraft());
  const [creating, setCreating] = useState(false);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [error, setError] = useState("");
  const [classRows, setClassRows] = useState([]);
  const [optionRows, setOptionRows] = useState([]);
  const [toolRows, setToolRows] = useState([]);
  const [speciesQuery, setSpeciesQuery] = useState("");
  const [backgroundQuery, setBackgroundQuery] = useState("");
  const [classQuery, setClassQuery] = useState("");
  const [featQuery, setFeatQuery] = useState("");
  const [featToAdd, setFeatToAdd] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [rolls, setRolls] = useState(() => rollAbilityPoolForMethod("4d6"));
  const [allocation, setAllocation] = useState({});
  const [selectedRollId, setSelectedRollId] = useState("");
  const [detail, setDetail] = useState(null);
  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);
  const [spellModel, setSpellModel] = useState(null);
  const [spellRows, setSpellRows] = useState([]);
  const [equipmentModel, setEquipmentModel] = useState(null);
  const { state: classChoiceState } = useNpcForgeClassChoice();
  const selectedSubclass = selectedSubclassOption(classChoiceState);

  useEffect(() => { if (draft.abilityMethod === "3d6" || draft.abilityMethod === "4d6") { setAllocation(defaultRollAllocation(rolls)); setSelectedRollId(""); } }, [rolls]);
  useEffect(() => {
    if (!show) return;
    let active = true;
    setLoadingCatalogs(true); setCatalogError("");
    Promise.all([
      supabase.from("class_catalog_preferred").select("id,class_key,class_name,source,ruleset,edition,hit_die,primary_abilities,saving_throws,spellcasting_ability,caster_progression,summary,raw_payload").order("class_name", { ascending: true }),
      supabase.from("character_option_catalog_preferred").select("id,option_key,option_type,name,source,category,description,prerequisite_text,tags,metadata,raw_payload").in("option_type", ["species", "background", "skill", "feat"]).order("option_type", { ascending: true }).order("name", { ascending: true }).limit(5000),
      supabase.from("items_catalog").select("item_name,item_key,item_type,item_rarity,payload").eq("item_rarity", "mundane").in("item_type", ["Tools", "Instrument"]).order("item_name", { ascending: true }).limit(2000),
    ]).then(([classesResult, optionsResult, toolsResult]) => {
      if (!active) return;
      const firstError = classesResult.error || optionsResult.error || toolsResult.error;
      if (firstError) setCatalogError(firstError.message || "Could not load the preferred character catalogs.");
      setClassRows(classesResult.data || []); setOptionRows(optionsResult.data || []); setToolRows(toolsResult.data || []); setLoadingCatalogs(false);
    });
    return () => { active = false; };
  }, [show]);

  const derived = useNpcForgeDerivedModel({ optionRows, classRows, draft, speciesQuery, backgroundQuery, classQuery, featQuery, rolls, allocation, detail, playerMode, spellModel, spellRows, locations });
  const {
    speciesOptions, backgroundOptions, classOptions, featOptions, selectedSpecies, selectedBackground, selectedClass, selectedBackgroundFeatRule,
    backgroundFeatOptions, selectedBackgroundFeat, speciesBonusFeat, backgroundSpellList, backgroundExpandedSpellNames, backgroundSkillChoiceGroups,
    backgroundSkills, classSkillConfig, skillInfo, selectedSkill, selectedProfession, filteredSpecies, filteredBackgrounds, filteredClasses, filteredFeats,
    baseAbilities, appliedBonus, finalAbilities, classHitDie, dynamicHp, selectedSkillKeys, selectedProfessionServices, selectedTrainedProfessions,
    storyWorldLocation, backgroundMechanicDetails, createPayload,
  } = derived;

  useEffect(() => {
    if (!show || !playerMode || !selectedClass?.id || !selectedBackground?.id) {
      setEquipmentModel(null);
      return undefined;
    }
    let active = true;
    setEquipmentModel({ catalogReady: false, loading: true, level: Number(draft.level || 1) });
    supabase.rpc("get_player_forge_starting_equipment_v1", {
      p_class_id: selectedClass.id,
      p_background_id: selectedBackground.id,
      p_level: Number(draft.level || 1),
    }).then(({ data, error: equipmentError }) => {
      if (!active) return;
      const model = equipmentError ? { catalogReady: false, loading: false, error: equipmentError.message || "Could not load source-backed starting equipment.", level: Number(draft.level || 1) } : { ...(data || {}), loading: false };
      setEquipmentModel(model);
      if (!equipmentError) {
        setDraft((current) => ({
          ...current,
          startingEquipment: {
            ...normalizeStartingEquipmentSelection(model, current.startingEquipment || {}),
            backgroundId: selectedBackground.id,
          },
        }));
      }
    });
    return () => { active = false; };
  }, [show, playerMode, selectedClass?.id, selectedBackground?.id, draft.level]);

  function patch(values) { setDraft((current) => ({ ...current, ...values })); setError(""); clearForgeValidationGuidance(); }
  function resetForm() {
    clearForgeValidationGuidance(); setStep(0); setDraft(initialDraft()); setCreating(false); setCatalogError(""); setError(""); setSpeciesQuery(""); setBackgroundQuery(""); setClassQuery(""); setFeatQuery(""); setFeatToAdd(""); setTagInput(""); setRolls(rollAbilityPoolForMethod("4d6")); setAllocation({}); setSelectedRollId(""); setDetail(null); setPortraitPickerOpen(false); setSpellModel(null); setSpellRows([]); setEquipmentModel(null); onReset?.();
  }
  function handleClose() { if (creating) return; onClose?.(); }
  function handleReset() { if (creating) return; if (typeof window === "undefined" || window.confirm("Reset this Character Forge draft? All entries and selections will be cleared.")) resetForm(); }
  function chooseSpecies(option) { const staticKey = SPECIES_DEFINITIONS[option.key] ? option.key : "custom"; patch({ speciesOptionId: option.id, speciesKey: staticKey, customSpecies: staticKey === "custom" ? option.name : "", lineage: "", size: speciesDefaultCharacterSize(option) }); setDetail({ type: "species", option }); }
  function chooseBackground(option) { const featRule = getBackgroundFeatRule(option); const choices = resolveBackgroundFeatOptions(option, featOptions); patch({ backgroundOptionId: option.id, backgroundKey: "custom", customBackground: option.name, backgroundFeatId: !featRule.requiresChoice && choices.length === 1 ? optionId(choices[0]) : "", backgroundSkillChoices: Object.fromEntries((option.skillRule?.choiceGroups || []).map((group) => [group.id, []])), startingEquipment: {} }); setEquipmentModel(null); setDetail({ type: "background", option }); }
  function chooseClass(option) { const staticKey = CLASS_DEFINITIONS[option.class_key] ? option.class_key : "civilian"; patch({ classOptionId: option.id, classKey: staticKey, selectedClassSkills: [], expertiseSkills: [], baseAbilities: standardScoresForClass(option), spellSelections: {}, startingEquipment: {} }); setSpellModel(null); setSpellRows([]); setEquipmentModel(null); setDetail({ type: "class", option }); }
  function setAbilityMethod(method) { const values = { abilityMethod: method }; if (method === "standard") values.baseAbilities = standardScoresForClass(selectedClass); if (method === "pointBuy") values.baseAbilities = emptyPointBuyScores(); if (method === "3d6" || method === "4d6") { setRolls(rollAbilityPoolForMethod(method)); setAllocation({}); setSelectedRollId(""); } patch(values); }
  function rerollScores() { setRolls(rollAbilityPoolForMethod(draft.abilityMethod)); setAllocation({}); setSelectedRollId(""); }
  function allocateRoll(ability, rollId) { if (!rollId) { setDetail({ type: "ability", key: ability }); return; } setAllocation((current) => { const next = { ...current }; const prior = next[ability]; const other = ABILITY_KEYS.find((key) => key !== ability && next[key] === rollId); next[ability] = rollId; if (other) next[other] = prior; return next; }); setSelectedRollId(""); setError(""); }
  function setAbility(key, value) { setDraft((current) => ({ ...current, baseAbilities: { ...(current.baseAbilities || {}), [key]: Number(value) } })); setDetail({ type: "ability", key }); setError(""); }
  function setSpeciesBonus(values) { setDraft((current) => ({ ...current, speciesBonus: { ...(current.speciesBonus || {}), ...values } })); setError(""); }
  function toggleSpeciesPlusOne(ability) { setDraft((current) => { const selected = uniqueText(current.speciesBonus?.plusOnes || []); const next = selected.includes(ability) ? selected.filter((key) => key !== ability) : selected.length < 3 ? [...selected, ability] : selected; return { ...current, speciesBonus: { ...(current.speciesBonus || {}), mode: "three", plusOnes: next, featId: "" } }; }); }
  function toggleBackgroundSkill(groupId, skillKey, count) { setDraft((current) => { const choices = { ...(current.backgroundSkillChoices || {}) }; const selected = uniqueText(choices[groupId] || []); choices[groupId] = selected.includes(skillKey) ? selected.filter((key) => key !== skillKey) : selected.length < count ? [...selected, skillKey] : [...selected.slice(0, Math.max(0, count - 1)), skillKey]; return { ...current, backgroundSkillChoices: choices }; }); setError(""); }
  function toggleClassSkill(skillKey) { setDraft((current) => { const selected = uniqueText(current.selectedClassSkills || []); const next = selected.includes(skillKey) ? selected.filter((key) => key !== skillKey) : selected.length < classSkillConfig.count ? [...selected, skillKey] : selected; return { ...current, selectedClassSkills: next }; }); setDetail({ type: "skill", key: skillKey }); setError(""); }
  function toggleExpertise(skillKey) { if (playerMode) return; setDraft((current) => { const selected = new Set(current.expertiseSkills || []); selected.has(skillKey) ? selected.delete(skillKey) : selected.add(skillKey); return { ...current, expertiseSkills: [...selected] }; }); }
  function setProfession(key, field, value) { setDraft((current) => ({ ...current, professions: { ...(current.professions || {}), [key]: { ...(current.professions?.[key] || {}), [field]: value, ...(field === "rank" && Number(value) === 0 ? { offersService: false } : {}) } } })); setDetail({ type: "profession", key }); setError(""); }
  function addFeat() { const option = featOptions.find((row) => row.id === featToAdd); if (option) patch({ additionalFeats: uniqueText([...(draft.additionalFeats || []), option.name]) }); setFeatToAdd(""); }
  function addTag() { const value = safeText(tagInput).toLowerCase(); if (value) patch({ tags: uniqueText([...(draft.tags || []), value]) }); setTagInput(""); }
  function generateName() { patch({ name: generateNpcName({ species: selectedSpecies?.name || draft.customSpecies, gender: draft.gender }) }); }
  function choosePortrait(selection) { patch({ portraitLibraryId: selection.portraitLibraryId || "", portraitName: selection.portraitName || "", portraitUrl: selection.portraitUrl || "", portraitStoragePath: selection.portraitStoragePath || "", portraitThumbUrl: selection.portraitThumbUrl || "", portraitShopUrl: selection.portraitShopUrl || "", portraitSource: selection.portraitSource || "library", visualAssetId: selection.visualAssetId || "", spriteKey: selection.spriteKey || "", spritePath: selection.spriteAsset?.sprite_format === "legacy_4dir_3frame_32" ? selection.spritePath || "" : "", spriteScale: Number(selection.spriteScale || 0.7), spriteAsset: selection.spriteAsset || null }); }
  function generateStory() { patch(generateNpcStory({ locations, species: selectedSpecies, background: selectedBackground, classRow: selectedClass, skills: selectedSkillKeys, professions: PROFESSION_KEYS.map((key) => ({ key, ...PROFESSION_DEFINITIONS[key], ...(draft.professions?.[key] || {}) })).filter((entry) => Number(entry.rank || 0) > 0), level: draft.level, identity: { name: draft.name, role: draft.role, affiliation: draft.affiliation, tags: draft.tags, kind: draft.kind, locationId: draft.locationId }, subclass: selectedSubclass })); }

  const stepKey = STEP_LABELS[step]?.toLowerCase();
  function stepErrors(key) {
    const errors = [];
    if (key === "species") { if (!selectedSpecies) errors.push("Choose a species."); }
    if (key === "background") { if (!selectedBackground) errors.push("Choose a background."); if (selectedBackgroundFeatRule.requiresChoice && !selectedBackgroundFeat) errors.push("Choose the feat granted by this background."); }
    if (key === "class") { if (!selectedClass) errors.push("Choose a class or No Adventuring Class."); if (Number(draft.level) < 1 || Number(draft.level) > 20) errors.push("Level must be between 1 and 20."); }
    if (key === "abilities") {
      if ((draft.abilityMethod === "3d6" || draft.abilityMethod === "4d6") && ABILITY_KEYS.some((ability) => !allocation[ability])) errors.push("Assign all six generated totals.");
      if (draft.abilityMethod === "pointBuy" && pointBuyRemaining(draft.baseAbilities) !== 0) errors.push("Spend the full 27-point Point Buy budget.");
      const bonus = draft.speciesBonus || {};
      if (bonus.mode === "feat") { if (!speciesBonusFeat) errors.push("Choose the Species Bonus feat."); }
      else if (bonus.mode === "three") { if (uniqueText(bonus.plusOnes || []).length !== 3) errors.push("Choose three different +1 abilities."); }
      else if (!ABILITY_KEYS.includes(bonus.plusTwo) || !ABILITY_KEYS.includes(bonus.plusOne) || bonus.plusTwo === bonus.plusOne) errors.push("Choose different abilities for the +2 and +1 Species Bonus.");
    }
    if (key === "training") {
      backgroundSkillChoiceGroups.forEach((group) => {
        if (uniqueText(draft.backgroundSkillChoices?.[group.id] || []).length !== group.count) errors.push(`Choose ${group.count} background skill${group.count === 1 ? "" : "s"} in Training.`);
      });
      if ((draft.selectedClassSkills || []).length !== classSkillConfig.count) errors.push(`Choose exactly ${classSkillConfig.count} class skill${classSkillConfig.count === 1 ? "" : "s"}.`);
      if (!playerMode) PROFESSION_KEYS.forEach((professionKey) => { const profession = draft.professions?.[professionKey] || {}; if (profession.offersService && Number(profession.rank || 0) === 0) errors.push(`${PROFESSION_DEFINITIONS[professionKey].label} must be trained before offering service.`); });
    }
    if (key === "spells" && playerMode) { if (!spellModel?.catalogReady) errors.push(spellModel?.error || "Wait for the canonical spell catalogue and class progression to finish loading."); else errors.push(...validateStartingSpellSelections(spellModel, spellRows, draft.spellSelections)); }
    if (key === "equipment" && playerMode) { if (!equipmentModel?.catalogReady) errors.push(equipmentModel?.error || "Wait for source-backed starting equipment to finish loading."); else if (!startingEquipmentSelectionComplete(equipmentModel,draft.startingEquipment || {})) errors.push("Complete the class package, Background package, equipment-category choices, and higher-level wealth roll."); }
    if (key === "identity") { if (!safeText(draft.name)) errors.push("Enter or generate a name."); if (!safeText(draft.role)) errors.push("Enter a role or title."); if (!draft.portraitLibraryId) errors.push("Choose a portrait for this character."); }
    return errors;
  }
  function handleNext() { const errors = stepErrors(stepKey); if (errors.length) { const message = errors.join(" "); setError(message); showForgeValidationGuidance(errors[0], forgeStepGuidanceSelectors(stepKey, errors[0])); return; } clearForgeValidationGuidance(); setStep((current) => Math.min(STEP_LABELS.length - 1, current + 1)); setDetail(null); }
  function handleBack() { clearForgeValidationGuidance(); setError(""); setStep((current) => Math.max(0, current - 1)); setDetail(null); }
  function editStep(key) { const index = STEP_LABELS.findIndex((label) => label.toLowerCase() === key); if (index >= 0) { clearForgeValidationGuidance(); setStep(index); setDetail(null); setError(""); } }

  async function handleCreate() {
    if (creating) return;
    const errors = STEP_LABELS.flatMap((label) => stepErrors(label.toLowerCase()));
    if (errors.length) return setError(uniqueText(errors).join(" "));
    setCreating(true); setError("");
    const requestId = draft.creationRequestId;
    const spellChoices = spellChoicesForRpc(spellRows, draft.spellSelections);
    try {
      let timedOut = false;
      const timeout = new Promise((resolve) => setTimeout(() => { timedOut = true; resolve({ timeout: true }); }, 12000));
      const rpcPromise = createCharacter ? createCharacter(createPayload, spellChoices) : supabase.rpc("create_character_v1", { p_payload: createPayload });
      const result = await Promise.race([rpcPromise, timeout]);
      let createdRow = null;
      if (result?.timeout || timedOut) { createdRow = await recoverCreatedCharacter(requestId); if (!createdRow) { await new Promise((resolve) => setTimeout(resolve, 1200)); createdRow = await recoverCreatedCharacter(requestId); } if (!createdRow) throw new Error("Character creation is taking longer than expected. You can safely retry; this Forge uses the same creation request and will not duplicate a completed character."); }
      else { if (result?.error) throw result.error; const id = typeof result?.data === "string" ? result.data : result?.data?.id || result?.data?.character_id || null; createdRow = { id, kind: createPayload.kind, name: createPayload.name }; }
      const created = { id: createdRow?.id, kind: createdRow?.kind || createPayload.kind, name: createdRow?.name || createPayload.name };
      const callback = onCreated?.(created);
      resetForm();
      Promise.resolve(callback).catch((callbackError) => console.error("NPC Forge post-create refresh failed", callbackError));
    } catch (cause) { setCreating(false); setError(String(cause?.message || cause || "Failed to create character.")); }
  }

  return {
    playerMode, STEP_LABELS, step, setStep, draft, setDraft, creating, loadingCatalogs, catalogError, error, setError,
    speciesQuery, setSpeciesQuery, backgroundQuery, setBackgroundQuery, classQuery, setClassQuery, featQuery, setFeatQuery,
    featToAdd, setFeatToAdd, tagInput, setTagInput, rolls, allocation, selectedRollId, setSelectedRollId, detail, setDetail,
    portraitPickerOpen, setPortraitPickerOpen, spellModel, setSpellModel, spellRows, setSpellRows, equipmentModel, toolRows, speciesOptions, backgroundOptions,
    classOptions, featOptions, selectedSpecies, selectedBackground, selectedClass, selectedSubclass, backgroundFeatOptions, selectedBackgroundFeat, speciesBonusFeat,
    backgroundSpellList, backgroundExpandedSpellNames, backgroundSkillChoiceGroups, backgroundSkills, classSkillConfig, skillInfo,
    selectedSkill, selectedProfession, filteredSpecies, filteredBackgrounds, filteredClasses, filteredFeats, baseAbilities, finalAbilities,
    classHitDie, dynamicHp, selectedSkillKeys, selectedProfessionServices, selectedTrainedProfessions, storyWorldLocation,
    backgroundMechanicDetails, createPayload, stepKey, patch, resetForm, handleClose, handleReset, chooseSpecies, chooseBackground,
    chooseClass, setAbilityMethod, rerollScores, allocateRoll, setAbility, setSpeciesBonus, toggleSpeciesPlusOne, toggleBackgroundSkill,
    toggleClassSkill, toggleExpertise, setProfession, addFeat, addTag, generateName, choosePortrait, generateStory, stepErrors, handleNext,
    handleBack, editStep, handleCreate, locations, sourceLabel, titleForSkill, assetSummary, proficiencyBonus,
  };
}

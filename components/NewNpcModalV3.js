import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { classFeatureGroupsComplete, toggleClassFeatureSelection } from "../utils/classFeatureChoices";
import { normalizeSkillKey } from "../utils/npcForgeCatalog";
import { featInstanceSummaries } from "../utils/playerForgeFeatChoices";
import { setSourceChoiceSelection, toggleSourceChoiceSelection } from "../utils/playerForgeSourceChoices";
import { clearForgeValidationGuidance, showForgeValidationGuidance } from "../utils/forgeValidationGuidance";
import NewNpcModalV3Refined from "./NewNpcModalV3Refined";
import { EMPTY_SPECIES_CHOICE_STATE, NpcForgeSpeciesChoiceContext, serializeSpeciesChoiceState, speciesChoiceStateComplete, speciesFeatChoicesFromState, speciesSkillChoicesFromState, speciesSpellcastingFromChoiceState } from "./NpcForgeSpeciesChoiceContext";
import { classChoiceSelectionSummary, classChoiceStateComplete, classChoiceStateRequiresSelection, classFeatureChoiceStateRequiresSelection, classStepChoiceStateComplete, EMPTY_CLASS_CHOICE_STATE, normalizedClassFeatureChoiceState, NpcForgeClassChoiceContext, selectedSubclassOption, serializeClassChoiceState, trainingClassChoiceStateComplete } from "./NpcForgeClassChoiceContext";
import { EMPTY_SOURCE_CHOICE_STATE, normalizeSourceChoiceState, NpcForgeSourceChoiceContext, serializeSourceChoiceState, sourceChoiceSelectionSummary, sourceChoiceStateComplete } from "./NpcForgeSourceChoiceContext";

const uniqueText = (values = []) => [...new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim()).filter(Boolean))];
function normalizeSpeciesChoiceState(species, rules = [], previous = EMPTY_SPECIES_CHOICE_STATE) {
  if (!species) return { speciesId: "", speciesName: "", rules: [], selections: {} };
  const speciesId = String(species.id || species.name || "");
  const sameSpecies = speciesId && speciesId === previous.speciesId;
  const validRules = Array.isArray(rules) ? rules : [];
  const selections = sameSpecies ? { ...(previous.selections || {}) } : {};
  for (const rule of validRules) {
    const prior = selections[rule.id] || {};
    selections[rule.id] = Object.fromEntries((rule.fields || []).flatMap((field) => {
      const selected = prior[field.id];
      return selected && (field.options || []).some((option) => option.value === selected) ? [[field.id, selected]] : [];
    }));
  }
  return { speciesId, speciesName: species.name || "", rules: validRules, selections };
}
function normalizeClassChoiceState(classRow, options = [], level = 1, catalogReady = false, previous = EMPTY_CLASS_CHOICE_STATE) {
  if (!classRow) return { ...EMPTY_CLASS_CHOICE_STATE, options: [], featureGroups: [], featureSelections: {} };
  const classId = String(classRow.id || classRow.class_key || classRow.class_name || "");
  const resolvedLevel = Math.max(1, Math.min(20, Number(level || 1)));
  const validOptions = Array.isArray(options) ? options : [];
  const sameClass = classId && classId === previous.classId;
  const selected = sameClass ? validOptions.find((option) => option.key === previous.selectedKey) : null;
  const featureGroups = sameClass ? previous.featureGroups || [] : [];
  return { classId, classKey: classRow.class_key || "", className: classRow.class_name || "", classSource: classRow.source || "", level: resolvedLevel, options: validOptions, catalogReady: Boolean(catalogReady), selectedKey: selected && Number(selected.firstLevel || 1) <= resolvedLevel ? selected.key : "", featureGroups, featureSelections: normalizedClassFeatureChoiceState(featureGroups, sameClass ? previous.featureSelections || {} : {}), featureCatalogReady: sameClass ? Boolean(previous.featureCatalogReady) : false };
}
async function persistSpeciesChoices(created, choiceState) {
  if (!created?.id || !(choiceState.rules || []).length || !speciesChoiceStateComplete(choiceState)) return;
  const serializedChoices = serializeSpeciesChoiceState(choiceState);
  const speciesSpells = speciesSpellcastingFromChoiceState(choiceState);
  const { data, error: readError } = await supabase.from("character_sheets").select("sheet").eq("character_id", created.id).single();
  if (readError) throw readError;
  const sheet = data?.sheet && typeof data.sheet === "object" ? data.sheet : {};
  if (choiceState.speciesName && sheet.species && String(sheet.species).toLowerCase() !== String(choiceState.speciesName).toLowerCase()) return;
  const nextSheet = { ...sheet, speciesTraitChoices: serializedChoices, speciesSpells, speciesSpellcasting: speciesSpells.length ? { source: "species", spells: speciesSpells } : sheet.speciesSpellcasting || null, meta: { ...(sheet.meta || {}), speciesTraitChoices: serializedChoices } };
  const { error: updateError } = await supabase.from("character_sheets").update({ sheet: nextSheet }).eq("character_id", created.id);
  if (updateError) throw updateError;
}
function tagSlug(value = "") { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function canonicalSkillKey(value = "") { return normalizeSkillKey(value) || String(value || "").trim(); }
function payloadWithSubclass(payload = {}, classChoiceState = EMPTY_CLASS_CHOICE_STATE) {
  const selected = selectedSubclassOption(classChoiceState);
  if (!selected) return payload;
  const sheet = payload.sheet && typeof payload.sheet === "object" ? payload.sheet : {};
  return { ...payload, sheet: { ...sheet, subclassName: selected.name, subclassSource: selected.source, meta: { ...(sheet.meta || {}), subclassKey: selected.key, subclassName: selected.name, subclassSource: selected.source, subclassEntryLevel: Number(selected.firstLevel || 1) } } };
}
function mergeSkillAuthority(skills = {}, proficient = [], expertise = []) {
  const next = { ...(skills || {}) };
  proficient.forEach((key) => { if (key) next[key] = { ...(next[key] || {}), proficient: true }; });
  expertise.forEach((key) => { if (key) next[key] = { ...(next[key] || {}), proficient: true, expertise: true }; });
  return next;
}
function mergeSaveAuthority(saves = {}, proficient = []) {
  const next = { ...(saves || {}) };
  proficient.forEach((key) => { if (key) next[key] = { ...(next[key] || {}), proficient: true }; });
  return next;
}
function mergedFeatureText(existing = "", additions = []) { return uniqueText([...String(existing || "").split(/\n+/).map((value) => value.trim()).filter(Boolean), ...additions]).join("\n"); }
function featAuthorityFromState(sourceChoiceState = EMPTY_SOURCE_CHOICE_STATE) {
  const instances = featInstanceSummaries(sourceChoiceState.groups || [], sourceChoiceState.selections || {});
  const abilityEffects = [];
  const skillKeys = [];
  const expertiseKeys = [];
  const savingThrowKeys = [];
  const tools = [];
  const spells = [];
  for (const instance of instances) {
    for (const effect of instance.fixedEffects || []) {
      if (effect?.type === "ability-increase") abilityEffects.push({ ...effect, category: instance.category, instanceId: instance.instanceId });
    }
    for (const choices of Object.values(instance.choices || {})) {
      for (const choice of choices || []) {
        if (choice.kind === "skill") skillKeys.push(choice.value);
        if (choice.kind === "expertise") expertiseKeys.push(choice.value);
        if (choice.kind === "tool") tools.push(choice.label || choice.value);
        if (choice.kind === "spell") spells.push({ ...choice, featInstanceId: instance.instanceId, featName: instance.name, featSource: instance.source });
        if (choice.kind === "ability" && choice.metadata?.effect === "ability-increase") abilityEffects.push({ type: "ability-increase", ability: choice.value, amount: Number(choice.metadata?.amount || 1), category: instance.category, instanceId: instance.instanceId });
        if (choice.kind === "ability" && choice.metadata?.secondaryEffect === "saving-throw-proficiency") savingThrowKeys.push(choice.value);
      }
    }
  }
  return { instances, abilityEffects, skillKeys: uniqueText(skillKeys), expertiseKeys: uniqueText(expertiseKeys), savingThrowKeys: uniqueText(savingThrowKeys), tools: uniqueText(tools), spells };
}
function applyFeatAbilityAuthority(sheet = {}, abilityEffects = []) {
  const abilities = { ...(sheet.abilities || {}) };
  const startingCon = Number(abilities.con?.score || 10);
  for (const effect of abilityEffects) {
    if (effect?.type !== "ability-increase" || !abilities[effect.ability]) continue;
    const current = Number(abilities[effect.ability]?.score || 10);
    const cap = String(effect.category || "").toUpperCase() === "EB" ? 30 : 20;
    abilities[effect.ability] = { ...abilities[effect.ability], score: Math.min(cap, current + Math.max(0, Number(effect.amount || 0))) };
  }
  const endingCon = Number(abilities.con?.score || startingCon);
  const level = Math.max(1, Number(sheet.level || sheet.meta?.level || 1));
  const startingModifier = Math.floor((startingCon - 10) / 2);
  const endingModifier = Math.floor((endingCon - 10) / 2);
  const hpAdjustment = (endingModifier - startingModifier) * level;
  return { abilities, hp: Math.max(1, Number(sheet.hp || 1) + hpAdjustment), maxHp: Math.max(1, Number(sheet.maxHp || sheet.hp || 1) + hpAdjustment) };
}
function payloadWithSourceChoices(payload = {}, speciesChoiceState = EMPTY_SPECIES_CHOICE_STATE, classChoiceState = EMPTY_CLASS_CHOICE_STATE, sourceChoiceState = EMPTY_SOURCE_CHOICE_STATE) {
  const sheet = payload.sheet && typeof payload.sheet === "object" ? payload.sheet : {};
  const meta = sheet.meta && typeof sheet.meta === "object" ? sheet.meta : {};
  const proficiencies = sheet.proficiencies && typeof sheet.proficiencies === "object" ? sheet.proficiencies : {};
  const speciesTraitChoices = serializeSpeciesChoiceState(speciesChoiceState);
  const speciesSkillChoices = speciesSkillChoicesFromState(speciesChoiceState);
  const speciesChoiceFeats = speciesFeatChoicesFromState(speciesChoiceState);
  const speciesSpells = speciesSpellcastingFromChoiceState(speciesChoiceState);
  const classFeatureChoices = serializeClassChoiceState(classChoiceState);
  const classFeatureChoiceSummary = classChoiceSelectionSummary(classChoiceState);
  const sourceChoices = serializeSourceChoiceState(sourceChoiceState);
  const sourceChoiceSummary = sourceChoiceSelectionSummary(sourceChoiceState);
  const featAuthority = featAuthorityFromState(sourceChoiceState);
  const classChoiceFeats = classFeatureChoiceSummary.filter((entry) => entry.groupKind === "fighting-style" || entry.kind === "feat");
  const classExpertise = classFeatureChoiceSummary.filter((entry) => entry.groupKind === "expertise").map((entry) => entry.name);
  const classWeaponMasteries = classFeatureChoiceSummary.filter((entry) => entry.groupKind === "weapon-mastery").map((entry) => entry.name);
  const classChoiceLines = classFeatureChoiceSummary.map((entry) => `Class Choice: ${entry.groupLabel} — ${entry.name}`);
  const speciesChoiceLines = [...speciesSkillChoices.map((entry) => `Species Choice: ${entry.trait} — ${entry.label}`), ...speciesChoiceFeats.map((entry) => `Species Choice: ${entry.trait} — ${entry.label}`)];
  const sourceChoiceLines = sourceChoiceSummary.map((entry) => `${entry.ownerType === "origin" ? "Origin" : entry.ownerType[0]?.toUpperCase() + entry.ownerType.slice(1)} Choice: ${entry.groupLabel} — ${entry.label}`);
  const selectedFeatNames = uniqueText([...(Array.isArray(sheet.feats) ? sheet.feats : []), ...speciesChoiceFeats.map((entry) => entry.label), ...classChoiceFeats.map((entry) => entry.name), ...featAuthority.instances.map((entry) => entry.name)]);
  const speciesSkillKeys = speciesSkillChoices.map((entry) => canonicalSkillKey(entry.value));
  const sourceSkillKeys = sourceChoiceSummary.filter((entry) => entry.kind === "skill").map((entry) => canonicalSkillKey(entry.value));
  const sourceExpertiseKeys = sourceChoiceSummary.filter((entry) => entry.kind === "expertise").map((entry) => canonicalSkillKey(entry.value));
  const expertiseKeys = uniqueText([...classExpertise.map(canonicalSkillKey), ...sourceExpertiseKeys, ...featAuthority.expertiseKeys.map(canonicalSkillKey)]);
  const proficientSkillKeys = uniqueText([...speciesSkillKeys, ...sourceSkillKeys, ...featAuthority.skillKeys.map(canonicalSkillKey)]);
  const structuredLanguages = uniqueText(["Common", ...sourceChoiceSummary.filter((entry) => entry.kind === "language").map((entry) => entry.value)]);
  const existingConcreteTools = (Array.isArray(sheet.tools) ? sheet.tools : []).filter((value) => value && !/^any\b/i.test(String(value).trim()));
  const structuredTools = uniqueText([...existingConcreteTools, ...sourceChoiceSummary.filter((entry) => entry.kind === "tool").map((entry) => entry.value), ...featAuthority.tools]);
  const structuredSize = sourceChoiceSummary.find((entry) => entry.kind === "size")?.value || sheet.size;
  const featAdjusted = applyFeatAbilityAuthority(sheet, featAuthority.abilityEffects);
  return { ...payload, sheet: { ...sheet, ...featAdjusted, size: structuredSize, languages: structuredLanguages, tools: structuredTools, feats: selectedFeatNames, featsTraits: mergedFeatureText(sheet.featsTraits, [...speciesChoiceLines, ...classChoiceLines, ...sourceChoiceLines]), speciesTraitChoices, speciesSkillChoices, speciesChoiceFeats, speciesSpells, speciesSpellcasting: speciesSpells.length ? { source: "species", spells: speciesSpells } : sheet.speciesSpellcasting || null, classFeatureChoices, classFeatureChoiceSummary, classChoiceFeats: classChoiceFeats.map((entry) => ({ name: entry.name, source: entry.source, feature: entry.groupLabel })), sourceChoices, sourceChoiceSummary, featGrantInstances: featAuthority.instances, featSpellChoices: featAuthority.spells, weaponMasteries: uniqueText([...(Array.isArray(sheet.weaponMasteries) ? sheet.weaponMasteries : []), ...classWeaponMasteries]), expertiseSkills: uniqueText([...(Array.isArray(sheet.expertiseSkills) ? sheet.expertiseSkills : []), ...expertiseKeys]), proficiencies: { ...proficiencies, saves: mergeSaveAuthority(proficiencies.saves, featAuthority.savingThrowKeys), skills: mergeSkillAuthority(proficiencies.skills, proficientSkillKeys, expertiseKeys) }, meta: { ...meta, size: structuredSize, languages: structuredLanguages, speciesTraitChoices, speciesSkillChoices, speciesChoiceFeats, speciesChoiceFeat: speciesChoiceFeats[0]?.label || null, classFeatureChoices, classFeatureChoiceSummary, classChoiceFeats: classChoiceFeats.map((entry) => entry.name), sourceChoices, sourceChoiceSummary, featGrantInstances: featAuthority.instances, featSpellChoices: featAuthority.spells, weaponMasteries: classWeaponMasteries, expertiseSkills: expertiseKeys } } };
}
function playerForgeProxySpellChoices(spellChoices = [], magicSelections = []) {
  const fallback = Array.isArray(spellChoices) ? spellChoices : [];
  const magic = Array.isArray(magicSelections) ? magicSelections : [];
  if (!magic.length) return fallback;
  return magic
    .filter((entry) => String(entry?.source_type || "class") === "class" && String(entry?.access_type || "class-list") !== "background-expanded")
    .map((entry) => ({ spell_id: entry.spell_id, prepared: Boolean(entry.prepared) }));
}
function playerPayload(payload = {}, spellChoices = [], magicSelections = []) {
  const sheet = payload.sheet && typeof payload.sheet === "object" ? payload.sheet : {};
  const meta = sheet.meta && typeof sheet.meta === "object" ? sheet.meta : {};
  const professions = sheet.professions && typeof sheet.professions === "object" ? sheet.professions : {};
  const tags = ["player-character", tagSlug(meta.speciesKey || sheet.species || sheet.race) ? `species:${tagSlug(meta.speciesKey || sheet.species || sheet.race)}` : "", tagSlug(meta.classKey || sheet.classKey || sheet.className || sheet.class) ? `class:${tagSlug(meta.classKey || sheet.classKey || sheet.className || sheet.class)}` : "", tagSlug(meta.backgroundKey || sheet.background) ? `background:${tagSlug(meta.backgroundKey || sheet.background)}` : "", ...Object.entries(professions).filter(([, entry]) => Number(entry?.rank || 0) > 0).map(([key]) => `profession:${tagSlug(key)}`)].filter(Boolean);
  const casting = Boolean(sheet.spellcasting?.ability || sheet.spellcasting?.abilityLabel);
  const startingMagicSelections = Array.isArray(magicSelections) ? magicSelections : [];
  const hasStartingMagic = startingMagicSelections.length > 0 || (Array.isArray(spellChoices) && spellChoices.length > 0);
  return { ...payload, kind: "npc", tags: [...new Set(tags)], storefront_enabled: false, storefront_title: null, storefront_tagline: null, location_id: null, home_location_id: null, is_hidden: true, state: "resting", role: String(payload.role || sheet.className || sheet.class || "Adventurer").trim() || "Adventurer", sheet: { ...sheet, startingMagicSelections, meta: { ...(sheet.meta || {}), creator: "shared_character_forge_player_v2", startingSpellSelectionPending: casting && !hasStartingMagic } } };
}

export default function NewNpcModalV3(props) {
  const show = Boolean(props?.show);
  const playerMode = props?.mode === "player";
  const [speciesChoiceState, setSpeciesChoiceState] = useState(() => ({ speciesId: "", speciesName: "", rules: [], selections: {} }));
  const [classChoiceState, setClassChoiceState] = useState(() => ({ ...EMPTY_CLASS_CHOICE_STATE, options: [], featureGroups: [], featureSelections: {} }));
  const [sourceChoiceState, setSourceChoiceState] = useState(() => ({ ...EMPTY_SOURCE_CHOICE_STATE, groups: [], selections: {}, scopes: {} }));
  const choiceStateRef = useRef(speciesChoiceState);
  const classChoiceStateRef = useRef(classChoiceState);
  const sourceChoiceStateRef = useRef(sourceChoiceState);
  useEffect(() => { choiceStateRef.current = speciesChoiceState; }, [speciesChoiceState]);
  useEffect(() => { classChoiceStateRef.current = classChoiceState; }, [classChoiceState]);
  useEffect(() => { sourceChoiceStateRef.current = sourceChoiceState; }, [sourceChoiceState]);
  const registerSpecies = useCallback((species, rules = []) => setSpeciesChoiceState((current) => normalizeSpeciesChoiceState(species, rules, current)), []);
  const selectChoice = useCallback((ruleId, fieldId, value) => setSpeciesChoiceState((current) => ({ ...current, selections: { ...(current.selections || {}), [ruleId]: { ...(current.selections?.[ruleId] || {}), [fieldId]: value } } })), []);
  const registerClass = useCallback((classRow, options = [], level = 1, catalogReady = false) => setClassChoiceState((current) => normalizeClassChoiceState(classRow, options, level, catalogReady, current)), []);
  const selectSubclass = useCallback((option) => setClassChoiceState((current) => {
    if (!option) return { ...current, selectedKey: "", featureGroups: [], featureSelections: {}, featureCatalogReady: false };
    const eligible = (current.options || []).find((candidate) => candidate.key === option.key && Number(candidate.firstLevel || 1) <= Number(current.level || 1));
    return eligible ? { ...current, selectedKey: eligible.key, featureGroups: [], featureSelections: {}, featureCatalogReady: false } : current;
  }), []);
  const registerFeatureGroups = useCallback((classRow, groups = [], level = 1, catalogReady = false) => setClassChoiceState((current) => {
    const classId = String(classRow?.id || classRow?.class_key || classRow?.class_name || "");
    if (!classId || classId !== current.classId) return current;
    const validGroups = Array.isArray(groups) ? groups : [];
    return { ...current, level: Math.max(1, Math.min(20, Number(level || 1))), featureGroups: validGroups, featureSelections: normalizedClassFeatureChoiceState(validGroups, current.featureSelections || {}), featureCatalogReady: Boolean(catalogReady) };
  }), []);
  const toggleFeatureOption = useCallback((groupId, optionKey) => setClassChoiceState((current) => ({ ...current, featureSelections: toggleClassFeatureSelection(current.featureGroups || [], current.featureSelections || {}, groupId, optionKey) })), []);
  const registerSourceGroups = useCallback((groups = [], catalogReady = true, scope = "foundation") => setSourceChoiceState((current) => normalizeSourceChoiceState(groups, catalogReady, current, scope)), []);
  const toggleSourceChoice = useCallback((groupId, fieldId, optionKey) => setSourceChoiceState((current) => ({ ...current, selections: toggleSourceChoiceSelection(current.groups || [], current.selections || {}, groupId, fieldId, optionKey) })), []);
  const setSourceChoice = useCallback((groupId, fieldId, optionKeys) => setSourceChoiceState((current) => ({ ...current, selections: setSourceChoiceSelection(current.groups || [], current.selections || {}, groupId, fieldId, optionKeys) })), []);
  const speciesContextValue = useMemo(() => ({ state: speciesChoiceState, registerSpecies, selectChoice }), [registerSpecies, selectChoice, speciesChoiceState]);
  const classContextValue = useMemo(() => ({ state: classChoiceState, registerClass, selectSubclass, registerFeatureGroups, toggleFeatureOption }), [classChoiceState, registerClass, registerFeatureGroups, selectSubclass, toggleFeatureOption]);
  const sourceContextValue = useMemo(() => ({ state: sourceChoiceState, registerGroups: registerSourceGroups, toggleChoice: toggleSourceChoice, setChoice: setSourceChoice }), [registerSourceGroups, setSourceChoice, sourceChoiceState, toggleSourceChoice]);
  const createCharacter = useCallback((originalPayload, spellChoices = []) => {
    if (playerMode && !speciesChoiceStateComplete(choiceStateRef.current)) return Promise.resolve({ data: null, error: { message: "Complete every required Species choice before creating the character." } });
    if (playerMode && !classChoiceStateComplete(classChoiceStateRef.current)) return Promise.resolve({ data: null, error: { message: "Complete the subclass and every required Class, Training, or spellbook-dependent feature choice before creating the character." } });
    if (playerMode && !sourceChoiceStateComplete(sourceChoiceStateRef.current)) return Promise.resolve({ data: null, error: { message: "Complete every required Origin, Background, Class, Ability, Advancement, and Training source choice before creating the character." } });
    const subclassPayload = payloadWithSubclass(originalPayload, classChoiceStateRef.current);
    const payload = payloadWithSourceChoices(subclassPayload, choiceStateRef.current, classChoiceStateRef.current, sourceChoiceStateRef.current);
    if (!playerMode) return supabase.rpc("create_character_v1", { p_payload: payload });
    const magicSelections = Array.isArray(payload?.sheet?.startingMagicSelections) ? payload.sheet.startingMagicSelections : [];
    const proxySpellChoices = playerForgeProxySpellChoices(spellChoices, magicSelections);
    return supabase.rpc("create_player_character_v3", {
      p_payload: playerPayload(payload, proxySpellChoices, magicSelections),
      p_spell_choices: proxySpellChoices,
      p_magic_selections: magicSelections,
    });
  }, [playerMode]);
  useEffect(() => {
    if (!show || typeof document === "undefined") return undefined;
    // Legacy validation marker retained while the interceptor now covers all source choices: blockIncompleteSpeciesChoice
    function blockIncompleteForgeChoice(event) {
      const button = event.target?.closest?.("button");
      const modal = event.target?.closest?.(".npc-forge-modal-v2");
      if (!button || button.textContent?.trim() !== "Continue") {
        if (modal) clearForgeValidationGuidance(modal);
        return;
      }
      const currentStep = modal?.querySelector(".npc-forge-steps button.is-current")?.textContent || "";
      const speciesState = choiceStateRef.current;
      if (/Species/i.test(currentStep) && (speciesState.rules || []).length && !speciesChoiceStateComplete(speciesState)) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
        showForgeValidationGuidance("Choose every required Species feature option.", [".npc-forge-species-choice.is-required", ".npc-forge-species-feature-list .is-required"], modal);
        return;
      }
      const sourceState = sourceChoiceStateRef.current;
      const sourcePlacements = /Species/i.test(currentStep) ? ["species"] : /Background/i.test(currentStep) ? ["background"] : /Class/i.test(currentStep) ? ["class"] : /Abilities/i.test(currentStep) ? ["abilities", "advancement"] : /Training/i.test(currentStep) ? ["training"] : [];
      const incompleteSourcePlacement = sourcePlacements.find((placement) => !sourceChoiceStateComplete(sourceState, { placement }));
      if (playerMode && incompleteSourcePlacement) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
        const selectors = incompleteSourcePlacement === "species"
          ? [".npc-forge-species-fact-choice.is-required", ".npc-forge-species-feature-list .is-required", ".npc-forge-source-choice-group.is-required"]
          : [".npc-forge-source-choice-group.is-required", ".npc-forge-context-row.is-interactive", ".npc-forge-workspace"];
        showForgeValidationGuidance(`Complete the required ${incompleteSourcePlacement} selection.`, selectors, modal);
        return;
      }
      const classState = classChoiceStateRef.current;
      if (playerMode && /Class/i.test(currentStep) && classState.classId && !classStepChoiceStateComplete(classState)) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
        const selectors = classChoiceStateRequiresSelection(classState) && !selectedSubclassOption(classState)
          ? [".npc-forge-class-guide__subclasses.is-required", ".npc-forge-class-guide"]
          : classFeatureChoiceStateRequiresSelection(classState, "class")
            ? [".npc-forge-class-choice-group.is-required", ".npc-forge-class-guide"]
            : [".npc-forge-class-guide"];
        showForgeValidationGuidance("Complete the required Class selection.", selectors, modal);
        return;
      }
      if (playerMode && /Training/i.test(currentStep) && classState.classId && !trainingClassChoiceStateComplete(classState)) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
        showForgeValidationGuidance("Complete the required Training selection.", [".npc-forge-class-choices.is-placement-training .npc-forge-class-choice-group.is-required", ".npc-forge-workspace"], modal);
        return;
      }
      if (playerMode && /Spells/i.test(currentStep) && classState.classId && !classFeatureGroupsComplete(classState.featureGroups || [], classState.featureSelections || {}, "spells")) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
        showForgeValidationGuidance("Complete the required spell selection.", [".npc-forge-class-choices.is-placement-spells .npc-forge-class-choice-group.is-required", ".npc-forge-spell-validation.is-incomplete", ".npc-forge-workspace"], modal);
      }
    }
    document.addEventListener("click", blockIncompleteForgeChoice, true);
    return () => document.removeEventListener("click", blockIncompleteForgeChoice, true);
  }, [playerMode, show]);
  async function handleCreated(created) {
    const snapshot = choiceStateRef.current;
    setSpeciesChoiceState({ speciesId: "", speciesName: "", rules: [], selections: {} });
    setClassChoiceState({ ...EMPTY_CLASS_CHOICE_STATE, options: [], featureGroups: [], featureSelections: {} });
    setSourceChoiceState({ ...EMPTY_SOURCE_CHOICE_STATE, groups: [], selections: {}, scopes: {} });
    await props.onCreated?.(created);
    if (!playerMode) Promise.race([persistSpeciesChoices(created, snapshot), new Promise((_, reject) => setTimeout(() => reject(new Error("species choice persistence timeout")), 5000))]).catch((error) => console.error("Could not persist species choices after character creation", error));
  }
  function resetChoiceState() {
    setSpeciesChoiceState({ speciesId: "", speciesName: "", rules: [], selections: {} });
    setClassChoiceState({ ...EMPTY_CLASS_CHOICE_STATE, options: [], featureGroups: [], featureSelections: {} });
    setSourceChoiceState({ ...EMPTY_SOURCE_CHOICE_STATE, groups: [], selections: {}, scopes: {} });
  }
  return <NpcForgeSpeciesChoiceContext.Provider value={speciesContextValue}><NpcForgeClassChoiceContext.Provider value={classContextValue}><NpcForgeSourceChoiceContext.Provider value={sourceContextValue}><div className={playerMode ? "unified-player-character-forge" : undefined}><NewNpcModalV3Refined {...props} mode={playerMode ? "player" : "npc"} createCharacter={createCharacter} onReset={resetChoiceState} onCreated={handleCreated} /></div></NpcForgeSourceChoiceContext.Provider></NpcForgeClassChoiceContext.Provider><style jsx global>{`
    .npc-forge-context-row-details{width:100%!important;min-width:0!important;grid-template-columns:minmax(0,1fr)!important}.npc-forge-context-row.is-interactive:hover>.npc-forge-context-row-details,.npc-forge-context-row.is-interactive[open]>.npc-forge-context-row-details{display:flex!important;flex-direction:column!important}.npc-forge-context-row-details>*,.npc-forge-context-choice-grid,.npc-forge-context-choice-stack{width:100%!important;min-width:0!important;max-width:none!important}.unified-player-character-forge .npc-forge-backdrop{position:static!important;inset:auto!important;display:block!important;width:100%!important;height:auto!important;min-height:0!important;padding:0!important;background:none!important;backdrop-filter:none!important}.unified-player-character-forge .npc-forge-modal-v2{width:100%!important;max-width:none!important}
  `}</style></NpcForgeSpeciesChoiceContext.Provider>;
}

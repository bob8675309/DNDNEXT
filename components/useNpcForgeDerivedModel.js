import { useMemo } from "react";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import { ABILITY_KEYS, ABILITY_LABELS, CLASS_DEFINITIONS, FEAT_OPTIONS, SKILL_DEFINITIONS, buildCharacterCreatePayload } from "../utils/characterCreation";
import { FALLBACK_SKILL_DESCRIPTIONS, abilityScoresFromRollAllocation, flexibleAbilityBoosts } from "../utils/characterCreationGuidance";
import { extractClassSkillConfiguration, mergePreferredBackgrounds, mergePreferredClasses, mergePreferredSpecies, normalizeSkillKey, optionMatchesQuery, safeText, slug, uniqueText } from "../utils/npcForgeCatalog";
import { spellChoicesForRpc } from "../utils/playerForgeRules";
import { serializeStartingMagicSelections } from "../utils/playerForgeSpellSources";
import { backgroundFeatRule as getBackgroundFeatRule, backgroundFeatSummary, resolveBackgroundFeatOptions } from "../utils/backgroundMechanics";
import { generatedStoryLocationLabel } from "../utils/npcStoryGenerator";
import { titleForSkill, abilityModifier, proficiencyBonus, maximumHitPoints, sourceLabel, standardScoresForClass, speciesTraits, optionId, toolProficiencyDescription } from "./NpcForgeCoreSupport";

export default function useNpcForgeDerivedModel({
  optionRows, classRows, draft, speciesQuery, backgroundQuery, classQuery, featQuery, rolls, allocation, detail, playerMode, spellModel, spellRows, locations,
}) {
const speciesOptions = useMemo(() => mergePreferredSpecies(optionRows), [optionRows]);
const backgroundOptions = useMemo(() => mergePreferredBackgrounds(optionRows), [optionRows]);
const classOptions = useMemo(() => mergePreferredClasses(classRows), [classRows]);
const featOptions = useMemo(() => {
  const imported = optionRows.filter((row) => row.option_type === "feat");
  return imported.length ? imported : FEAT_OPTIONS.map((feat) => ({ id: `fallback-${slug(feat.name)}`, name: feat.name, source: "CAMPAIGN", category: feat.category, description: "Campaign fallback feat." }));
}, [optionRows]);
const selectedSpecies = useMemo(() => speciesOptions.find((row) => optionId(row) === draft.speciesOptionId) || null, [draft.speciesOptionId, speciesOptions]);
const selectedBackground = useMemo(() => backgroundOptions.find((row) => optionId(row) === draft.backgroundOptionId) || null, [backgroundOptions, draft.backgroundOptionId]);
const selectedClass = useMemo(() => classOptions.find((row) => optionId(row) === draft.classOptionId) || null, [classOptions, draft.classOptionId]);
const selectedBackgroundFeatRule = useMemo(() => getBackgroundFeatRule(selectedBackground || {}), [selectedBackground]);
const backgroundFeatOptions = useMemo(() => resolveBackgroundFeatOptions(selectedBackground || {}, featOptions), [featOptions, selectedBackground]);
const selectedBackgroundFeat = useMemo(() => !backgroundFeatOptions.length ? null : !selectedBackgroundFeatRule.requiresChoice ? backgroundFeatOptions[0] : backgroundFeatOptions.find((feat) => optionId(feat) === draft.backgroundFeatId) || null, [backgroundFeatOptions, draft.backgroundFeatId, selectedBackgroundFeatRule.requiresChoice]);
const speciesBonusFeat = useMemo(() => featOptions.find((feat) => optionId(feat) === draft.speciesBonus?.featId) || null, [draft.speciesBonus?.featId, featOptions]);
const backgroundSpellList = selectedBackground?.spellList || [];
const backgroundExpandedSpellNames = selectedBackground?.expandedSpellNames || [];
const backgroundSkillChoiceGroups = selectedBackground?.skillRule?.choiceGroups || [];
const selectedBackgroundChoiceSkills = useMemo(() => backgroundSkillChoiceGroups.flatMap((group) => draft.backgroundSkillChoices?.[group.id] || []), [backgroundSkillChoiceGroups, draft.backgroundSkillChoices]);
const backgroundSkills = uniqueText([...(selectedBackground?.backgroundSkills || []), ...selectedBackgroundChoiceSkills]);
const selectedTrainedProfessions = PROFESSION_KEYS.filter((key) => Number(draft.professions?.[key]?.rank || 0) > 0);
const baseClassSkillConfig = useMemo(() => extractClassSkillConfiguration(selectedClass), [selectedClass]);
const classSkillConfig = useMemo(() => {
  const totalCount = Number(baseClassSkillConfig?.count || 0);
  const professionChoices = playerMode ? selectedTrainedProfessions.length : 0;
  return {
    ...baseClassSkillConfig,
    totalCount,
    professionChoices,
    count: Math.max(0, totalCount - professionChoices),
  };
}, [baseClassSkillConfig, playerMode, selectedTrainedProfessions.length]);
const skillInfo = useMemo(() => {
  const map = new Map();
  optionRows.filter((row) => row.option_type === "skill").forEach((row) => { const key = normalizeSkillKey(row.name); if (key) map.set(key, { key, label: row.name, ability: row.metadata?.ability || row.category, description: row.description, source: row.source }); });
  SKILL_DEFINITIONS.forEach((skill) => { if (!map.has(skill.key)) map.set(skill.key, { ...skill, description: FALLBACK_SKILL_DESCRIPTIONS[skill.key], source: "XPHB" }); });
  return map;
}, [optionRows]);
const selectedSkill = detail?.type === "skill" ? skillInfo.get(detail.key) || null : null;
const selectedProfession = detail?.type === "profession" ? PROFESSION_DEFINITIONS[detail.key] || null : null;
const filteredSpecies = useMemo(() => speciesOptions.filter((row) => optionMatchesQuery(row, speciesQuery)), [speciesOptions, speciesQuery]);
const filteredBackgrounds = useMemo(() => backgroundOptions.filter((row) => optionMatchesQuery(row, backgroundQuery)), [backgroundOptions, backgroundQuery]);
const filteredClasses = useMemo(() => classOptions.filter((row) => optionMatchesQuery({ ...row, name: row.class_name, description: row.summary }, classQuery)), [classOptions, classQuery]);
const filteredFeats = useMemo(() => featOptions.filter((row) => optionMatchesQuery(row, featQuery) && !draft.additionalFeats.includes(row.name)).slice(0, 300), [draft.additionalFeats, featOptions, featQuery]);
const baseAbilities = useMemo(() => (draft.abilityMethod === "3d6" || draft.abilityMethod === "4d6") ? abilityScoresFromRollAllocation(rolls, allocation) : draft.baseAbilities, [allocation, draft.abilityMethod, draft.baseAbilities, rolls]);
const appliedBonus = draft.speciesBonus?.mode === "feat" ? { mode: "twoOne", plusTwo: "", plusOne: "", plusOnes: [] } : draft.speciesBonus;
const finalAbilities = useMemo(() => flexibleAbilityBoosts(baseAbilities, appliedBonus), [appliedBonus, baseAbilities]);
const classHitDie = Number(selectedClass?.hit_die || CLASS_DEFINITIONS[draft.classKey]?.hitDie || 8);
const dynamicHp = maximumHitPoints(classHitDie, draft.level, finalAbilities.con);
const selectedSkillKeys = uniqueText([...backgroundSkills, ...(draft.selectedClassSkills || [])]);
const selectedProfessionServices = PROFESSION_KEYS.filter((key) => draft.professions?.[key]?.offersService);
const storyWorldLocation = generatedStoryLocationLabel(locations, draft.locationId);

const backgroundMechanicDetails = useMemo(() => {
  const skills = (selectedBackground?.backgroundSkills || []).map((key) => ({ label: skillInfo.get(key)?.label || titleForSkill(key), description: skillInfo.get(key)?.description || FALLBACK_SKILL_DESCRIPTIONS[key], source: skillInfo.get(key)?.source || "XPHB" }));
  const skillChoices = backgroundSkillChoiceGroups.map((group) => ({ ...group, options: group.from.map((key) => ({ key, label: skillInfo.get(key)?.label || titleForSkill(key), description: skillInfo.get(key)?.description || FALLBACK_SKILL_DESCRIPTIONS[key], source: skillInfo.get(key)?.source || "XPHB" })) }));
  return { skills, skillChoices, tools: (selectedBackground?.tools || []).map((name) => ({ label: name, description: toolProficiencyDescription(name) })), originFeat: backgroundFeatOptions.map((feat) => ({ label: feat.name, description: feat.description, prerequisite: feat.prerequisite_text, source: feat.source })), originFeatValue: backgroundFeatSummary(selectedBackground || {}, featOptions, selectedBackgroundFeat), featRequiresChoice: selectedBackgroundFeatRule.requiresChoice, spellList: backgroundSpellList };
}, [backgroundFeatOptions, backgroundSkillChoiceGroups, backgroundSpellList, featOptions, selectedBackground, selectedBackgroundFeat, selectedBackgroundFeatRule.requiresChoice, skillInfo]);

const createPayload = useMemo(() => {
  const base = buildCharacterCreatePayload({ ...draft, backgroundBoosts: appliedBonus, baseAbilities });
  const speciesName = selectedSpecies?.name || base.sheet.species;
  const backgroundName = selectedBackground?.name || base.sheet.background;
  const className = selectedClass?.class_name || base.sheet.className;
  const classKey = selectedClass?.class_key || base.sheet.classKey;
  const classSource = selectedClass?.source || "CAMPAIGN";
  const pb = proficiencyBonus(draft.level);
  const feats = uniqueText([selectedBackgroundFeat?.name, speciesBonusFeat?.name, ...(playerMode ? [] : draft.additionalFeats || [])]);
  const saves = selectedClass?.saving_throws || [];
  const tools = selectedBackground?.tools || [];
  const spellChoices = spellChoicesForRpc(spellRows, draft.spellSelections);
  const startingMagicSelections = serializeStartingMagicSelections(spellRows, draft.spellSelections, spellModel);
  const spellNames = spellRows.filter((spell) => draft.spellSelections?.[spell.id]).map((spell) => spell.name);
  const proficiencies = { saves: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { proficient: saves.includes(key) }])), skills: Object.fromEntries(SKILL_DEFINITIONS.map((skill) => [skill.key, { proficient: selectedSkillKeys.includes(skill.key), expertise: !playerMode && (draft.expertiseSkills || []).includes(skill.key) }])) };
  const castingAbility = selectedClass?.spellcasting_ability || null;
  const spellcasting = castingAbility ? { ability: castingAbility, abilityLabel: ABILITY_LABELS[castingAbility] || castingAbility, spellSaveDc: 8 + pb + abilityModifier(finalAbilities[castingAbility]), spellAttackBonus: pb + abilityModifier(finalAbilities[castingAbility]), catalogStatus: "preferred_all_sources", backgroundExpandedSpells: backgroundExpandedSpellNames, selectionMode: spellModel?.mode || null } : null;
  const sheet = {
    ...base.sheet,
    meta: { ...(base.sheet.meta || {}), classKey, className, classSource, rulesetSource: classSource, ruleset: selectedClass?.ruleset || "campaign", speciesKey: selectedSpecies?.key || slug(speciesName), species: speciesName, speciesSource: selectedSpecies?.source || "CAMPAIGN", backgroundKey: selectedBackground?.key || slug(backgroundName), background: backgroundName, backgroundSource: selectedBackground?.source || "CAMPAIGN", originFeat: selectedBackgroundFeat?.name || null, backgroundFeatChoice: selectedBackgroundFeat?.name || null, speciesBonusMode: draft.speciesBonus?.mode, speciesBonusFeat: speciesBonusFeat?.name || null, backgroundSkillChoices: draft.backgroundSkillChoices || {}, backgroundExpandedSpells: backgroundExpandedSpellNames, backgroundSpellList, gender: draft.gender, level: Number(draft.level || 1), creator: "npc_forge_v3", creationRequestId: draft.creationRequestId },
    classKey, className, class: className, level: Number(draft.level || 1), species: speciesName, race: speciesName, background: backgroundName,
    speed: Number(selectedSpecies?.speed || base.sheet.speed || 30), abilities: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { score: finalAbilities[key] }])), proficiencies, proficiencyBonus: pb,
    hp: dynamicHp, maxHp: dynamicHp, hitDice: `${Number(draft.level || 1)}d${classHitDie}`, feats, speciesTraits: speciesTraits(selectedSpecies), professions: draft.professions,
    featsTraits: [...feats.map((feat) => `Feat: ${feat}`), ...speciesTraits(selectedSpecies).map((trait) => `Species: ${trait}`), ...(draft.extraTraits || [])].join("\n"),
    tools: uniqueText([...tools, ...(draft.additionalTools || [])]), spellcasting, spells: spellNames, startingSpellChoices: spellChoices, startingMagicSelections, backgroundExpandedSpells: backgroundExpandedSpellNames, backgroundSpellList,
    portrait: draft.portraitLibraryId ? { libraryId: draft.portraitLibraryId, url: draft.portraitUrl, storagePath: draft.portraitStoragePath, thumbUrl: draft.portraitThumbUrl, shopUrl: draft.portraitShopUrl, source: draft.portraitSource || "library", recommendedMasterSize: "1536x2048", aspectRatio: "3:4" } : base.sheet.portrait,
    visualAsset: draft.visualAssetId ? { id: draft.visualAssetId, ...(draft.spriteAsset || {}) } : null,
  };
  return { ...base, name: safeText(draft.name), race: speciesName, role: safeText(draft.role) || (draft.kind === "merchant" ? "Merchant" : className), affiliation: safeText(draft.affiliation) || null, creation_request_id: draft.creationRequestId, portrait_library_id: draft.portraitLibraryId || null, visual_asset_id: draft.visualAssetId || null, portrait_url: draft.portraitUrl || null, portrait_storage_path: draft.portraitStoragePath || null, portrait_thumb_url: draft.portraitThumbUrl || null, portrait_shop_url: draft.portraitShopUrl || null, portrait_source: draft.portraitSource || (draft.portraitLibraryId ? "library" : "default"), image_url: draft.portraitUrl || null, sprite_key: draft.spriteKey || null, sprite_path: draft.spritePath || null, sprite_scale: Number(draft.spriteScale || 0.7), sheet };
}, [appliedBonus, backgroundExpandedSpellNames, backgroundSpellList, baseAbilities, classHitDie, draft, dynamicHp, finalAbilities, playerMode, selectedBackground, selectedBackgroundFeat, selectedClass, selectedSkillKeys, selectedSpecies, speciesBonusFeat, spellModel, spellRows]);
  return {
    speciesOptions, backgroundOptions, classOptions, featOptions, selectedSpecies, selectedBackground, selectedClass, selectedBackgroundFeatRule,
    backgroundFeatOptions, selectedBackgroundFeat, speciesBonusFeat, backgroundSpellList, backgroundExpandedSpellNames,
    backgroundSkillChoiceGroups, selectedBackgroundChoiceSkills, backgroundSkills, classSkillConfig, skillInfo, selectedSkill, selectedProfession,
    filteredSpecies, filteredBackgrounds, filteredClasses, filteredFeats, baseAbilities, appliedBonus, finalAbilities, classHitDie, dynamicHp,
    selectedSkillKeys, selectedProfessionServices, selectedTrainedProfessions, storyWorldLocation, backgroundMechanicDetails, createPayload,
  };
}
import { useMemo } from "react";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import { ABILITY_KEYS, ABILITY_LABELS, CLASS_DEFINITIONS, FEAT_OPTIONS, SKILL_DEFINITIONS, buildCharacterCreatePayload } from "../utils/characterCreation";
import { FALLBACK_SKILL_DESCRIPTIONS, abilityScoresFromRollAllocation, flexibleAbilityBoosts } from "../utils/characterCreationGuidance";
import { extractClassSkillConfiguration, mergePreferredBackgrounds, mergePreferredClasses, mergePreferredSpecies, normalizeSkillKey, optionMatchesQuery, safeText, slug, uniqueText } from "../utils/npcForgeCatalog";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { spellChoicesForRpc } from "../utils/playerForgeRules";
import { serializeStartingMagicSelections } from "../utils/playerForgeSpellSources";
import { backgroundFeatRule as getBackgroundFeatRule, backgroundFeatSummary, resolveBackgroundFeatOptions } from "../utils/backgroundMechanics";
import { generatedStoryLocationLabel } from "../utils/npcStoryGenerator";
import { titleForSkill, abilityModifier, proficiencyBonus, maximumHitPoints, sourceLabel, standardScoresForClass, speciesTraits, optionId } from "./NpcForgeCoreSupport";

const normalizeDisplayName = (value = "") => safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const TRAINING_PROFICIENCY_FEATS = new Set(["skilled", "crafter", "musician"]);

function cleanSourceRuleString(value = "") {
  return formatPlayerFacingText(String(value || "")
    .replace(/\{@table\s+[^;|}]+;\s*([^|}]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@itemProperty\s+[^|}]+\|[^|}]+\|([^}]+)}/gi, "$1"));
}

function sourceTableParagraph(node = {}) {
  const rows = Array.isArray(node.rows) ? node.rows : [];
  if (!rows.length) return "";
  const labels = Array.isArray(node.colLabels) ? node.colLabels.map(cleanSourceRuleString) : [];
  const pairs = rows.map((row) => {
    const cells = (Array.isArray(row) ? row : [row]).map(cleanSourceRuleString).filter(Boolean);
    if (!cells.length) return "";
    if (cells.length === 2) return `${cells[0]} — ${cells[1]}`;
    return cells.map((cell, index) => labels[index] ? `${labels[index]}: ${cell}` : cell).join(" • ");
  }).filter(Boolean);
  if (!pairs.length) return "";
  const title = cleanSourceRuleString(node.caption || (normalizeDisplayName(labels[0]) === "rune" && normalizeDisplayName(labels[1]) === "spell" ? "Rune Spells" : "Options"));
  return `${title}. ${pairs.join("; ")}`;
}

function flattenSourceRuleEntries(node, output = []) {
  if (node == null) return output;
  if (typeof node === "string") {
    if (/^\s*\{@note\b/i.test(node)) return output;
    const value = cleanSourceRuleString(node);
    if (value) output.push(value);
    return output;
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => flattenSourceRuleEntries(entry, output));
    return output;
  }
  if (typeof node !== "object") return output;
  if (node.type === "table" || node.rows) {
    const tableText = sourceTableParagraph(node);
    if (tableText) output.push(tableText);
    return output;
  }
  if (node.type === "list" && Array.isArray(node.items)) {
    for (const item of node.items) {
      if (typeof item === "string") {
        flattenSourceRuleEntries(item, output);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const heading = cleanSourceRuleString(item.name || "").replace(/[.:]+$/g, "");
      const body = [];
      flattenSourceRuleEntries(item.entries || item.entry || [], body);
      if (heading && body.length) output.push(`${heading}. ${body.join(" ")}`);
      else if (body.length) output.push(...body);
    }
    return output;
  }
  const heading = safeText(node.name);
  if (heading && node.type === "entries") output.push(`${cleanSourceRuleString(heading).replace(/[.:]+$/g, "")}.`);
  if (node.entry) flattenSourceRuleEntries(node.entry, output);
  if (node.entries) flattenSourceRuleEntries(node.entries, output);
  if (node.items) flattenSourceRuleEntries(node.items, output);
  return output;
}

function featDescriptionForBackground(feat = {}) {
  const rawEntries = feat.raw_payload?.entries || feat.rawPayload?.entries;
  const sourceText = rawEntries ? flattenSourceRuleEntries(rawEntries, []).join("\n\n") : "";
  const base = sourceText || formatPlayerFacingText(feat.description, "This feat is granted by the selected background.");
  const name = normalizeDisplayName(feat.name);
  if (!TRAINING_PROFICIENCY_FEATS.has(name)) return base;
  const route = name === "skilled"
    ? "Forge routing. Skilled grants any combination of three skill or tool proficiencies. Choose all three later in Training → Skills & Proficiencies; they do not consume the class Training-choice allowance."
    : name === "crafter"
      ? "Forge routing. Crafter grants three Artisan's Tool proficiencies. Choose those tools later in Training → Skills & Proficiencies."
      : "Forge routing. Musician grants three Musical Instrument proficiencies. Choose those instruments later in Training → Skills & Proficiencies.";
  return `${base}\n\n${route}`;
}

function cleanPrerequisite(value = "") {
  const cleaned = formatPlayerFacingText(value, "").trim();
  if (!cleaned || cleaned === "[]" || cleaned === "{}" || /^none$/i.test(cleaned)) return "";
  return cleaned;
}

const TOOL_GUIDANCE = Object.freeze({
  "alchemists supplies": "Typical uses: identify substances or start a fire. Source crafting examples include acid, alchemist's fire, oil, paper, perfume, and component pouches.",
  "brewers supplies": "Typical uses: identify alcohol or detect a poisoned drink. The 2024 tool rules also list antitoxin as a craftable item.",
  "calligraphers supplies": "Typical uses: produce ornate writing designed to resist forgery. Source crafting examples include ink and spell scrolls.",
  "carpenters tools": "Typical uses: build, repair, seal, or pry wooden doors and containers. Source crafting includes clubs, staves, barrels, chests, ladders, portable rams, and torches.",
  "cartographers tools": "Typical uses: draft maps and record routes or terrain. The source tool rules explicitly support crafting maps.",
  "cobblers tools": "Typical uses: make or modify footwear; the 2024 rules can prepare footwear to aid an Acrobatics check. Source crafting includes climber's kits.",
  "cooks utensils": "Typical uses: improve food, identify spoiled or poisoned food, and prepare travel fare. Source crafting includes rations.",
  "glassblowers tools": "Typical uses: work and inspect glass. Source crafting includes bottles, vials, magnifying glasses, and spyglasses.",
  "jewelers tools": "Typical uses: appraise gems and perform fine setting or metalwork. Source crafting includes arcane focuses and holy symbols.",
  "leatherworkers tools": "Typical uses: decorate, cut, stitch, and shape leather. Source crafting includes leather armor, hide armor, whips, slings, pouches, quivers, cases, backpacks, and waterskins.",
  "masons tools": "Typical uses: cut, mark, or bore stone and perform masonry work. The source rules include chiseling symbols or holes into stone.",
  "painters supplies": "Typical uses: paint recognizable images and decorative work. Source crafting includes certain druidic focuses and holy symbols.",
  "potters tools": "Typical uses: shape and inspect ceramic objects. Source crafting includes jugs and lamps.",
  "smiths tools": "Typical uses: forge and work metal, including prying or reshaping metalwork. Source crafting includes most melee weapons, medium and heavy armor, chains, caltrops, grappling hooks, iron pots, and other metal gear.",
  "tinkers tools": "Typical uses: assemble or repair small mechanisms and scrap-built devices. Source crafting includes locks, lanterns, traps, manacles, mirrors, shovels, whistles, and tinderboxes.",
  "weavers tools": "Typical uses: mend or decorate cloth and weave textile goods. Source crafting includes padded armor, clothing, bedrolls, blankets, nets, rope, sacks, and tents.",
  "woodcarvers tools": "Typical uses: carve patterns and shape wooden equipment. Source crafting includes clubs, staves, many ranged weapons, ammunition, focuses, pens, and needles.",
  "disguise kit": "Typical uses: alter someone's visible appearance with makeup, hair, and costume work. Source crafting includes costumes.",
  "forgery kit": "Typical uses: imitate handwriting and duplicate identifying marks such as wax seals, supporting forged or altered documents.",
  "herbalism kit": "Typical uses: identify plants and prepare herbal goods. Source crafting includes antitoxin, healer's kits, candles, and potions of healing.",
  "navigators tools": "Typical uses: plot a course and determine position from landmarks or the stars.",
  "poisoners kit": "Typical uses: detect poison and prepare poison safely. The 2024 tool rules list basic poison as a craftable item.",
  "thieves tools": "Typical uses: pick locks and disarm traps.",
  "dice set": "Typical uses: play games of chance, recognize cheating, and judge play at the table.",
  "dragonchess set": "Typical uses: play the game, recognize cheating, and use your familiarity with the rules and strategies during play.",
  "playing cards": "Typical uses: play card games, recognize cheating, and judge play at the table.",
  "three dragon ante set": "Typical uses: play the game, recognize cheating, and judge play at the table.",
  "vehicles land": "Typical uses: drive, handle, and maneuver land vehicles when a check is required.",
  "vehicles water": "Typical uses: pilot, handle, and maneuver water vehicles when a check is required.",
});

function backgroundToolDescription(toolName = "") {
  const name = safeText(toolName);
  const key = normalizeDisplayName(name);
  if (TOOL_GUIDANCE[key]) return TOOL_GUIDANCE[key];
  if (/instrument|lute|flute|drum|horn|lyre|viol|shawm|pipes/.test(key)) return "Typical uses: perform a known tune, improvise music, accompany a performance, and demonstrate trained musicianship when an instrument check is called for.";
  if (/gaming|game|cards|dice|dragonchess/.test(key)) return "Typical uses: play the game competently, recognize cheating, and apply trained knowledge of its rules and strategies.";
  if (/artisan/.test(key)) return "Artisan's Tools represent a specific practiced craft. The selected tool determines the materials you can work, the practical tasks you can attempt, and the mundane items you can make with that craft.";
  return `${name} represents specialized practical training. Its proficiency applies when the character uses that tool for a task it was designed to accomplish; source-specific Utilize and Craft options are shown when the catalogue provides them.`;
}

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
  const fixedSkills = (selectedBackground?.backgroundSkills || []).map((key) => ({ label: skillInfo.get(key)?.label || titleForSkill(key), description: skillInfo.get(key)?.description || FALLBACK_SKILL_DESCRIPTIONS[key], source: skillInfo.get(key)?.source || "XPHB" }));
  const skillChoices = backgroundSkillChoiceGroups.map((group) => ({ ...group, options: group.from.map((key) => ({ key, label: skillInfo.get(key)?.label || titleForSkill(key), description: skillInfo.get(key)?.description || FALLBACK_SKILL_DESCRIPTIONS[key], source: skillInfo.get(key)?.source || "XPHB" })) }));
  const skillChoiceSummaries = skillChoices.map((group) => {
    const selected = draft.backgroundSkillChoices?.[group.id] || [];
    const selectedLabels = selected.map((key) => group.options.find((option) => option.key === key)?.label).filter(Boolean);
    const complete = selectedLabels.length === Number(group.count || 1);
    return {
      label: complete ? selectedLabels.join(", ") : `Choose ${group.count} skill${group.count === 1 ? "" : "s"} in Training`,
      description: `This background grants ${group.count} skill proficienc${group.count === 1 ? "y" : "ies"} chosen from ${group.options.map((option) => option.label).join(", ")}. Complete this choice in Training → Skills & Proficiencies. It does not use a class Training choice.`,
      source: selectedBackground?.source || "Source",
      routed: "training",
    };
  });
  return {
    skills: [...fixedSkills, ...skillChoiceSummaries],
    skillChoices,
    tools: (selectedBackground?.tools || []).map((name) => ({ label: name, description: backgroundToolDescription(name) })),
    originFeat: backgroundFeatOptions.map((feat) => ({ label: feat.name, description: featDescriptionForBackground(feat), prerequisite: cleanPrerequisite(feat.prerequisite_text), source: feat.source })),
    originFeatValue: backgroundFeatSummary(selectedBackground || {}, featOptions, selectedBackgroundFeat),
    featRequiresChoice: selectedBackgroundFeatRule.requiresChoice,
    spellList: backgroundSpellList,
  };
}, [backgroundFeatOptions, backgroundSkillChoiceGroups, backgroundSpellList, draft.backgroundSkillChoices, featOptions, selectedBackground, selectedBackgroundFeat, selectedBackgroundFeatRule.requiresChoice, skillInfo]);

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
  const startingEquipmentSelections = playerMode ? { ...(draft.startingEquipment || {}), backgroundId: selectedBackground?.id || null } : null;
  const spellNames = startingMagicSelections.filter((entry) => String(entry?.source_type || "class") === "class").map((entry) => entry.name).filter(Boolean);
  const proficiencies = { saves: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { proficient: saves.includes(key) }])), skills: Object.fromEntries(SKILL_DEFINITIONS.map((skill) => [skill.key, { proficient: selectedSkillKeys.includes(skill.key), expertise: !playerMode && (draft.expertiseSkills || []).includes(skill.key) }])) };
  const castingAbility = selectedClass?.spellcasting_ability || null;
  const spellcasting = castingAbility ? { ability: castingAbility, abilityLabel: ABILITY_LABELS[castingAbility] || castingAbility, spellSaveDc: 8 + pb + abilityModifier(finalAbilities[castingAbility]), spellAttackBonus: pb + abilityModifier(finalAbilities[castingAbility]), catalogStatus: "preferred_all_sources", backgroundExpandedSpells: backgroundExpandedSpellNames, selectionMode: spellModel?.mode || null } : null;
  const sheet = {
    ...base.sheet,
    meta: { ...(base.sheet.meta || {}), classKey, className, classSource, rulesetSource: classSource, ruleset: selectedClass?.ruleset || "campaign", speciesKey: selectedSpecies?.key || slug(speciesName), species: speciesName, speciesSource: selectedSpecies?.source || "CAMPAIGN", backgroundKey: selectedBackground?.key || slug(backgroundName), background: backgroundName, backgroundSource: selectedBackground?.source || "CAMPAIGN", originFeat: selectedBackgroundFeat?.name || null, backgroundFeatChoice: selectedBackgroundFeat?.name || null, speciesBonusMode: draft.speciesBonus?.mode, speciesBonusFeat: speciesBonusFeat?.name || null, backgroundSkillChoices: draft.backgroundSkillChoices || {}, backgroundExpandedSpells: backgroundExpandedSpellNames, backgroundSpellList, startingEquipmentSelections, gender: draft.gender, level: Number(draft.level || 1), creator: "npc_forge_v3", creationRequestId: draft.creationRequestId },
    classKey, className, class: className, level: Number(draft.level || 1), species: speciesName, race: speciesName, background: backgroundName,
    speed: Number(selectedSpecies?.speed || base.sheet.speed || 30), abilities: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { score: finalAbilities[key] }])), proficiencies, proficiencyBonus: pb,
    hp: dynamicHp, maxHp: dynamicHp, hitDice: `${Number(draft.level || 1)}d${classHitDie}`, feats, speciesTraits: speciesTraits(selectedSpecies), professions: draft.professions,
    featsTraits: [...feats.map((feat) => `Feat: ${feat}`), ...speciesTraits(selectedSpecies).map((trait) => `Species: ${trait}`), ...(draft.extraTraits || [])].join("\n"),
    tools: uniqueText([...tools, ...(draft.additionalTools || [])]), spellcasting, spells: spellNames, startingSpellChoices: spellChoices, startingMagicSelections, startingEquipmentSelections, backgroundExpandedSpells: backgroundExpandedSpellNames, backgroundSpellList,
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

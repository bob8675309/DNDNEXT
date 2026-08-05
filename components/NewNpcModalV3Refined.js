import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  ALIGNMENT_OPTIONS,
  CLASS_DEFINITIONS,
  FEAT_OPTIONS,
  SIZE_OPTIONS,
  SKILL_DEFINITIONS,
  SPECIES_DEFINITIONS,
  buildCharacterCreatePayload,
  standardAbilityScores,
} from "../utils/characterCreation";
import {
  FALLBACK_SKILL_DESCRIPTIONS,
  abilityScoresFromRollAllocation,
  defaultRollAllocation,
  flexibleAbilityBoosts,
  rollAbilityPool,
} from "../utils/characterCreationGuidance";
import {
  extractClassSkillConfiguration,
  mergePreferredBackgrounds,
  mergePreferredClasses,
  mergePreferredSpecies,
  normalizeSkillKey,
  optionMatchesQuery,
  safeText,
  slug,
  uniqueText,
} from "../utils/npcForgeCatalog";
import { speciesDefaultCharacterSize } from "../utils/speciesPresentation";
import { generateNpcName } from "../utils/npcNameGenerator";
import { generateNpcStory, generatedStoryLocationLabel } from "../utils/npcStoryGenerator";
import {
  backgroundFeatRule as getBackgroundFeatRule,
  backgroundFeatSummary,
  resolveBackgroundFeatOptions,
} from "../utils/backgroundMechanics";
import NpcForgeContextPanel from "./NpcForgeContextPanel";
import NpcForgePortraitPickerModal from "./NpcForgePortraitPickerModal";

const STEP_LABELS = Object.freeze(["Species", "Background", "Class", "Abilities", "Training", "Identity", "Story", "Review"]);
const EMPTY_PROFESSIONS = Object.freeze(Object.fromEntries(PROFESSION_KEYS.map((key) => [key, {
  rank: 0,
  ability: PROFESSION_DEFINITIONS[key].abilities[0],
  offersService: false,
}])));

function createRequestId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {}
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(-4);
  return `${s4()}${s4()}-${s4()}-4${s4().slice(1)}-${((8 + Math.floor(Math.random() * 4)).toString(16))}${s4().slice(1)}-${s4()}${s4()}${s4()}`;
}

function initialDraft() {
  return {
    creationRequestId: createRequestId(),
    name: "", gender: "neutral", kind: "npc", role: "", affiliation: "",
    speciesOptionId: "", backgroundOptionId: "", classOptionId: "", speciesKey: "",
    customSpecies: "", lineage: "", size: "", alignment: "N", languagesText: "Common",
    appearance: "", backgroundKey: "custom", customBackground: "", backgroundFeatId: "",
    backgroundSkillChoices: {}, classKey: "civilian", level: 1, abilityMethod: "rolled",
    baseAbilities: standardAbilityScores("civilian"),
    backgroundBoosts: { mode: "twoOne", plusTwo: "", plusOne: "", plusOnes: [], allowAny: true },
    selectedClassSkills: [], expertiseSkills: [], professions: JSON.parse(JSON.stringify(EMPTY_PROFESSIONS)),
    additionalFeats: [], extraTraits: [], preparedSpellsText: "", attacks: "", equipment: "",
    treasure: "", description: "", backgroundNarrative: "", motivation: "", personalityTraits: "",
    ideals: "", bonds: "", flaws: "", quirk: "", mannerism: "", voice: "", secret: "",
    tags: [], locationId: "", storefrontEnabled: true, storefrontTitle: "", storefrontTagline: "",
    portraitLibraryId: "", portraitName: "", portraitUrl: "", portraitStoragePath: "", portraitThumbUrl: "", portraitShopUrl: "", portraitSource: "",
    visualAssetId: "", spriteKey: "", spritePath: "", spriteScale: 0.7, spriteAsset: null,
  };
}

function titleForSkill(key) {
  return SKILL_DEFINITIONS.find((skill) => skill.key === key)?.label || key;
}

function toolProficiencyDescription(toolName = "") {
  const name = safeText(toolName);
  const lower = name.toLowerCase();
  if (/woodcarver/.test(lower)) return "Woodcarver's tools shape and repair wooden objects such as arrows, bolts, small carvings, and practical field gear.";
  if (/navigator/.test(lower)) return "Navigator's tools help chart routes, determine position, and avoid becoming lost during travel.";
  if (/thieves/.test(lower)) return "Thieves' tools are used to manipulate locks, disable traps, and work with small mechanical security devices.";
  if (/disguise/.test(lower)) return "A disguise kit helps alter appearance, build a convincing persona, and recognize how another disguise was constructed.";
  if (/forgery/.test(lower)) return "A forgery kit helps reproduce documents, seals, handwriting, and other marks of authenticity.";
  if (/herbalism/.test(lower)) return "An herbalism kit is used to identify, gather, and prepare useful plants and remedies when a rule allows it.";
  if (/poisoner/.test(lower)) return "A poisoner's kit supports identifying, handling, and preparing poisons safely when a rule allows it.";
  if (/gaming set|playing card|dice set|dragonchess|three-dragon/.test(lower)) return `${name} proficiency represents practiced knowledge of its rules, tactics, tells, and social customs.`;
  if (/instrument|lute|flute|drum|horn|viol|lyre|shawm|dulcimer|bagpipe/.test(lower)) return `${name} proficiency covers competent performance, maintenance, and musical knowledge.`;
  if (/vehicle/.test(lower)) return `${name} proficiency applies when handling, controlling, maintaining, or judging that kind of vehicle under difficult conditions.`;
  return `${name} represents specialized practical training. Add the character's proficiency bonus when that training is relevant to the check.`;
}

function abilityModifier(score) { return Math.floor((Number(score || 10) - 10) / 2); }
function modifierLabel(score) { const value = abilityModifier(score); return value >= 0 ? `+${value}` : String(value); }
function proficiencyBonus(level) { return 2 + Math.floor((Math.max(1, Number(level || 1)) - 1) / 4); }
function maximumHitPoints(hitDie, level, constitutionScore) {
  const die = Math.max(4, Number(hitDie || 8));
  const resolvedLevel = Math.max(1, Math.min(20, Number(level || 1)));
  const conModifier = abilityModifier(constitutionScore);
  return Math.max(1, die + conModifier) + Math.max(0, resolvedLevel - 1) * Math.max(1, Math.floor(die / 2) + 1 + conModifier);
}
function sourceLabel(source = "") {
  if (source === "XPHB") return "2024";
  if (source === "PHB") return "2014";
  if (source === "CAMPAIGN") return "Campaign";
  return source || "Unknown";
}
function standardScoresForClass(classRow) {
  if (CLASS_DEFINITIONS[classRow?.class_key]) return standardAbilityScores(classRow.class_key);
  const priorities = uniqueText([...(classRow?.primary_abilities || []), "con", "dex", "wis", "int", "cha", "str"]).filter((key) => ABILITY_KEYS.includes(key));
  const values = [15, 14, 13, 12, 10, 8];
  const scores = Object.fromEntries(ABILITY_KEYS.map((key) => [key, 10]));
  priorities.slice(0, 6).forEach((key, index) => { scores[key] = values[index]; });
  return scores;
}
function speciesTraits(option) {
  if (option?.traits?.length) return option.traits;
  return SPECIES_DEFINITIONS[slug(option?.name)]?.traits || [];
}
function optionId(row) { return safeText(row?.id); }
function assetSummary(asset) {
  if (!asset) return "No linked map sprite yet";
  const dirs = Array.isArray(asset.direction_order) ? asset.direction_order.length : 0;
  const walk = Array.isArray(asset.walk_frames) ? asset.walk_frames.length : 0;
  return `${dirs || 4}-direction • idle + ${walk || 3} walking frames`;
}

function CatalogList({ label, query, onQuery, rows, selectedId, onSelect, emptyText }) {
  return <div className="npc-forge-catalog">
    <div className="npc-forge-catalog-head"><span>{label}</span><strong>{rows.length}</strong></div>
    <input className="npc-forge-search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`} />
    <div className="npc-forge-catalog-list">
      {rows.map((row) => <button key={row.id} type="button" className={selectedId === row.id ? "is-active" : ""} onClick={() => onSelect(row)}><span><strong>{row.name || row.class_name}</strong><small>{sourceLabel(row.source)}</small></span><b>›</b></button>)}
      {!rows.length ? <div className="npc-forge-empty-list">{emptyText}</div> : null}
    </div>
  </div>;
}

function DiceSummary({ roll, index, assignedAbility, selected, onSelect }) {
  return <button type="button" draggable className={`npc-forge-roll-card refined ${selected ? "is-selected" : ""}`} onClick={() => onSelect(roll.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/npc-forge-roll", roll.id); onSelect(roll.id); }} aria-pressed={selected}>
    <small>Die Roll {index + 1}</small><strong>{roll.total}</strong>
    <div>{roll.dice.map((die, dieIndex) => <span key={`${roll.id}-${dieIndex}`} className={dieIndex === roll.droppedIndex ? "is-dropped" : ""}>{die}</span>)}</div>
    <em>{assignedAbility ? `Assigned to ${ABILITY_LABELS[assignedAbility]}` : "Drag or select to assign"}</em>
  </button>;
}

async function recoverCreatedCharacter(requestId) {
  if (!requestId) return null;
  const { data, error } = await supabase.from("characters").select("id,kind,name").eq("creation_request_id", requestId).maybeSingle();
  if (error) return null;
  return data || null;
}

export default function NewNpcModalV3Refined({ show, onClose, onCreated, locations = [], mode = "npc", createCharacter = null, onReset = null }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => initialDraft());
  const [creating, setCreating] = useState(false);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [error, setError] = useState("");
  const [classRows, setClassRows] = useState([]);
  const [optionRows, setOptionRows] = useState([]);
  const [speciesQuery, setSpeciesQuery] = useState("");
  const [backgroundQuery, setBackgroundQuery] = useState("");
  const [classQuery, setClassQuery] = useState("");
  const [featQuery, setFeatQuery] = useState("");
  const [featToAdd, setFeatToAdd] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [rolls, setRolls] = useState(() => rollAbilityPool());
  const [allocation, setAllocation] = useState({});
  const [selectedRollId, setSelectedRollId] = useState("");
  const [detail, setDetail] = useState(null);
  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);
  const playerMode = mode === "player";

  useEffect(() => { setAllocation(defaultRollAllocation(rolls)); setSelectedRollId(""); }, [rolls]);
  useEffect(() => {
    if (!show) return;
    let active = true;
    async function loadCatalogs() {
      setLoadingCatalogs(true); setCatalogError("");
      const [classesResult, optionsResult] = await Promise.all([
        supabase.from("class_catalog_preferred").select("id,class_key,class_name,source,ruleset,edition,hit_die,primary_abilities,saving_throws,spellcasting_ability,caster_progression,summary,raw_payload").order("class_name", { ascending: true }),
        supabase.from("character_option_catalog_preferred").select("id,option_key,option_type,name,source,category,description,prerequisite_text,tags,metadata,raw_payload").in("option_type", ["species", "background", "skill", "feat"]).order("option_type", { ascending: true }).order("name", { ascending: true }).limit(5000),
      ]);
      if (!active) return;
      const firstError = classesResult.error || optionsResult.error;
      if (firstError) setCatalogError(firstError.message || "Could not load the preferred character catalogs. Fallback choices remain available.");
      setClassRows(classesResult.data || []); setOptionRows(optionsResult.data || []); setLoadingCatalogs(false);
    }
    loadCatalogs();
    return () => { active = false; };
  }, [show]);

  const speciesOptions = useMemo(() => mergePreferredSpecies(optionRows), [optionRows]);
  const backgroundOptions = useMemo(() => mergePreferredBackgrounds(optionRows), [optionRows]);
  const classOptions = useMemo(() => mergePreferredClasses(classRows), [classRows]);
  const featOptions = useMemo(() => {
    const imported = optionRows.filter((row) => row.option_type === "feat");
    return imported.length ? imported : FEAT_OPTIONS.map((feat) => ({ id: `fallback-${slug(feat.name)}`, name: feat.name, source: "CAMPAIGN", category: feat.category, description: "Campaign fallback feat." }));
  }, [optionRows]);
  const skillInfo = useMemo(() => {
    const map = new Map();
    optionRows.filter((row) => row.option_type === "skill").forEach((row) => {
      const key = normalizeSkillKey(row.name);
      if (key) map.set(key, { key, label: row.name, ability: row.metadata?.ability || row.category || SKILL_DEFINITIONS.find((skill) => skill.key === key)?.ability, description: row.description, source: row.source });
    });
    SKILL_DEFINITIONS.forEach((skill) => { if (!map.has(skill.key)) map.set(skill.key, { ...skill, description: FALLBACK_SKILL_DESCRIPTIONS[skill.key], source: "XPHB" }); });
    return map;
  }, [optionRows]);

  const selectedSpecies = useMemo(() => speciesOptions.find((row) => optionId(row) === draft.speciesOptionId) || null, [draft.speciesOptionId, speciesOptions]);
  const selectedBackground = useMemo(() => backgroundOptions.find((row) => optionId(row) === draft.backgroundOptionId) || null, [backgroundOptions, draft.backgroundOptionId]);
  const selectedClass = useMemo(() => classOptions.find((row) => optionId(row) === draft.classOptionId) || null, [classOptions, draft.classOptionId]);
  const selectedBackgroundFeatRule = useMemo(() => getBackgroundFeatRule(selectedBackground || {}), [selectedBackground]);
  const backgroundFeatOptions = useMemo(() => resolveBackgroundFeatOptions(selectedBackground || {}, featOptions), [featOptions, selectedBackground]);
  const selectedBackgroundFeat = useMemo(() => {
    if (!backgroundFeatOptions.length) return null;
    if (!selectedBackgroundFeatRule.requiresChoice) return backgroundFeatOptions[0];
    return backgroundFeatOptions.find((feat) => optionId(feat) === draft.backgroundFeatId) || null;
  }, [backgroundFeatOptions, draft.backgroundFeatId, selectedBackgroundFeatRule.requiresChoice]);
  const backgroundSpellList = selectedBackground?.spellList || [];
  const backgroundExpandedSpellNames = selectedBackground?.expandedSpellNames || [];
  const backgroundSkillChoiceGroups = selectedBackground?.skillRule?.choiceGroups || [];
  const selectedBackgroundChoiceSkills = useMemo(() => backgroundSkillChoiceGroups.flatMap((group) => draft.backgroundSkillChoices?.[group.id] || []), [backgroundSkillChoiceGroups, draft.backgroundSkillChoices]);
  const backgroundSkills = uniqueText([...(selectedBackground?.backgroundSkills || []), ...selectedBackgroundChoiceSkills]);
  const classSkillConfig = useMemo(() => extractClassSkillConfiguration(selectedClass), [selectedClass]);
  const selectedSkill = detail?.type === "skill" ? skillInfo.get(detail.key) || null : null;
  const selectedProfession = detail?.type === "profession" ? PROFESSION_DEFINITIONS[detail.key] || null : null;

  const backgroundMechanicDetails = useMemo(() => {
    const skills = (selectedBackground?.backgroundSkills || []).map((key) => {
      const skill = skillInfo.get(key);
      return { label: skill?.label || titleForSkill(key), description: skill?.description || FALLBACK_SKILL_DESCRIPTIONS[key] || "This skill represents trained application of its associated ability.", source: skill?.source || "XPHB" };
    });
    const skillChoices = backgroundSkillChoiceGroups.map((group) => ({ ...group, options: group.from.map((key) => {
      const skill = skillInfo.get(key);
      return { key, label: skill?.label || titleForSkill(key), description: skill?.description || FALLBACK_SKILL_DESCRIPTIONS[key] || "This skill represents trained application of its associated ability.", source: skill?.source || "XPHB" };
    }) }));
    const tools = (selectedBackground?.tools || []).map((name) => ({ label: name, description: toolProficiencyDescription(name) }));
    const originFeat = backgroundFeatOptions.map((feat) => ({ label: feat.name, description: feat.description || "This background grants the selected feat.", prerequisite: feat.prerequisite_text || "", source: feat.source || selectedBackground?.source }));
    return { skills, skillChoices, tools, originFeat, originFeatValue: backgroundFeatSummary(selectedBackground || {}, featOptions, selectedBackgroundFeat), featRequiresChoice: selectedBackgroundFeatRule.requiresChoice, spellList: backgroundSpellList };
  }, [backgroundFeatOptions, backgroundSkillChoiceGroups, backgroundSpellList, featOptions, selectedBackground, selectedBackgroundFeat, selectedBackgroundFeatRule.requiresChoice, skillInfo]);

  const filteredSpecies = useMemo(() => speciesOptions.filter((row) => optionMatchesQuery(row, speciesQuery)), [speciesOptions, speciesQuery]);
  const filteredBackgrounds = useMemo(() => backgroundOptions.filter((row) => optionMatchesQuery(row, backgroundQuery)), [backgroundOptions, backgroundQuery]);
  const filteredClasses = useMemo(() => classOptions.filter((row) => optionMatchesQuery({ ...row, name: row.class_name, description: row.summary }, classQuery)), [classOptions, classQuery]);
  const filteredFeats = useMemo(() => featOptions.filter((row) => optionMatchesQuery(row, featQuery) && !draft.additionalFeats.includes(row.name)).slice(0, 200), [draft.additionalFeats, featOptions, featQuery]);
  const baseAbilities = useMemo(() => draft.abilityMethod === "rolled" ? abilityScoresFromRollAllocation(rolls, allocation) : draft.baseAbilities, [allocation, draft.abilityMethod, draft.baseAbilities, rolls]);
  const finalAbilities = useMemo(() => flexibleAbilityBoosts(baseAbilities, draft.backgroundBoosts), [baseAbilities, draft.backgroundBoosts]);
  const classHitDie = Number(selectedClass?.hit_die || CLASS_DEFINITIONS[draft.classKey]?.hitDie || 8);
  const dynamicHp = maximumHitPoints(classHitDie, draft.level, finalAbilities.con);
  const originFeat = selectedBackgroundFeat?.name || selectedBackground?.originFeat || "None listed";
  const selectedSkillKeys = uniqueText([...backgroundSkills, ...(draft.selectedClassSkills || [])]);
  const selectedProfessionServices = PROFESSION_KEYS.filter((key) => draft.professions?.[key]?.offersService);
  const selectedTrainedProfessions = PROFESSION_KEYS.filter((key) => Number(draft.professions?.[key]?.rank || 0) > 0);
  const allocatedAbilityByRoll = useMemo(() => Object.fromEntries(Object.entries(allocation).map(([ability, rollId]) => [rollId, ability])), [allocation]);
  const storyWorldLocation = generatedStoryLocationLabel(locations, draft.locationId);

  const createPayload = useMemo(() => {
    const base = buildCharacterCreatePayload({ ...draft, baseAbilities });
    const speciesName = selectedSpecies?.name || base.sheet.species;
    const backgroundName = selectedBackground?.name || base.sheet.background;
    const className = selectedClass?.class_name || base.sheet.className;
    const classKey = selectedClass?.class_key || base.sheet.classKey;
    const classSource = selectedClass?.source || "CAMPAIGN";
    const pb = proficiencyBonus(draft.level);
    const traits = speciesTraits(selectedSpecies);
    const feats = uniqueText([selectedBackgroundFeat?.name, ...(draft.additionalFeats || [])]);
    const saves = selectedClass?.saving_throws || [];
    const tools = selectedBackground?.tools || [];
    const proficiencies = {
      saves: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { proficient: saves.includes(key) }])),
      skills: Object.fromEntries(SKILL_DEFINITIONS.map((skill) => [skill.key, { proficient: selectedSkillKeys.includes(skill.key), expertise: (draft.expertiseSkills || []).includes(skill.key) }])),
    };
    const castingAbility = selectedClass?.spellcasting_ability || null;
    const spellcasting = castingAbility ? { ability: castingAbility, abilityLabel: ABILITY_LABELS[castingAbility] || castingAbility, spellSaveDc: 8 + pb + abilityModifier(finalAbilities[castingAbility]), spellAttackBonus: pb + abilityModifier(finalAbilities[castingAbility]), preparedSpellsText: safeText(draft.preparedSpellsText), catalogStatus: "preferred_all_sources", backgroundExpandedSpells: backgroundExpandedSpellNames } : null;
    const sheet = {
      ...base.sheet,
      meta: { ...(base.sheet.meta || {}), classKey, className, classSource, rulesetSource: classSource, ruleset: selectedClass?.ruleset || "campaign", speciesKey: selectedSpecies?.key || slug(speciesName), species: speciesName, speciesSource: selectedSpecies?.source || "CAMPAIGN", backgroundKey: selectedBackground?.key || slug(backgroundName), background: backgroundName, backgroundSource: selectedBackground?.source || "CAMPAIGN", originFeat: selectedBackgroundFeat?.name || null, backgroundFeatChoice: selectedBackgroundFeat?.name || null, backgroundSkillChoices: draft.backgroundSkillChoices || {}, backgroundExpandedSpells: backgroundExpandedSpellNames, backgroundSpellList, gender: draft.gender, level: Number(draft.level || 1), creator: "npc_forge_v3", creationRequestId: draft.creationRequestId },
      classKey, className, class: className, level: Number(draft.level || 1), species: speciesName, race: speciesName, background: backgroundName,
      speed: Number(selectedSpecies?.speed || base.sheet.speed || 30), abilities: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { score: finalAbilities[key] }])), proficiencies, proficiencyBonus: pb,
      hp: dynamicHp, maxHp: dynamicHp, hitDice: `${Number(draft.level || 1)}d${classHitDie}`, feats, speciesTraits: traits,
      featsTraits: [...feats.map((feat) => `Feat: ${feat}`), ...traits.map((trait) => `Species: ${trait}`), ...(draft.extraTraits || [])].join("\n"),
      tools: uniqueText([...tools, ...(draft.additionalTools || [])]), spellcasting, spells: safeText(draft.preparedSpellsText), backgroundExpandedSpells: backgroundExpandedSpellNames, backgroundSpellList,
      portrait: draft.portraitLibraryId ? { libraryId: draft.portraitLibraryId, url: draft.portraitUrl, storagePath: draft.portraitStoragePath, thumbUrl: draft.portraitThumbUrl, shopUrl: draft.portraitShopUrl, source: draft.portraitSource || "library", recommendedMasterSize: "1536x2048", aspectRatio: "3:4" } : base.sheet.portrait,
      visualAsset: draft.visualAssetId ? { id: draft.visualAssetId, ...(draft.spriteAsset || {}) } : null,
    };
    return {
      ...base,
      name: safeText(draft.name),
      race: speciesName,
      role: safeText(draft.role) || (draft.kind === "merchant" ? "Merchant" : className),
      affiliation: safeText(draft.affiliation) || null,
      creation_request_id: draft.creationRequestId,
      portrait_library_id: draft.portraitLibraryId || null,
      visual_asset_id: draft.visualAssetId || null,
      portrait_url: draft.portraitUrl || null,
      portrait_storage_path: draft.portraitStoragePath || null,
      portrait_thumb_url: draft.portraitThumbUrl || null,
      portrait_shop_url: draft.portraitShopUrl || null,
      portrait_source: draft.portraitSource || (draft.portraitLibraryId ? "library" : "default"),
      image_url: draft.portraitUrl || null,
      sprite_key: draft.spriteKey || null,
      sprite_path: draft.spritePath || null,
      sprite_scale: Number(draft.spriteScale || 0.7),
      sheet,
    };
  }, [backgroundExpandedSpellNames, backgroundSpellList, baseAbilities, classHitDie, draft, dynamicHp, finalAbilities, selectedBackground, selectedBackgroundFeat, selectedClass, selectedSkillKeys, selectedSpecies]);

  function patch(values) { setDraft((current) => ({ ...current, ...values })); setError(""); }
  function resetForm() {
    const nextRolls = rollAbilityPool();
    setStep(0); setDraft(initialDraft()); setCreating(false); setLoadingCatalogs(false); setCatalogError(""); setError("");
    setSpeciesQuery(""); setBackgroundQuery(""); setClassQuery(""); setFeatQuery(""); setFeatToAdd(""); setTagInput("");
    setRolls(nextRolls); setAllocation({}); setSelectedRollId(""); setDetail(null); setPortraitPickerOpen(false);
    onReset?.();
  }
  function handleClose() { if (creating) return; onClose?.(); }
  function handleReset() {
    if (creating) return;
    const confirmed = typeof window === "undefined" || window.confirm("Reset this Character Forge draft? All entries and selections will be cleared.");
    if (confirmed) resetForm();
  }
  function chooseSpecies(option) {
    const staticKey = SPECIES_DEFINITIONS[option.key] ? option.key : "custom";
    patch({ speciesOptionId: option.id, speciesKey: staticKey, customSpecies: staticKey === "custom" ? option.name : "", lineage: "", size: speciesDefaultCharacterSize(option) });
    setDetail({ type: "species", option });
  }
  function chooseBackground(option) {
    const featRule = getBackgroundFeatRule(option);
    const choices = resolveBackgroundFeatOptions(option, featOptions);
    const skillChoices = Object.fromEntries((option.skillRule?.choiceGroups || []).map((group) => [group.id, []]));
    patch({ backgroundOptionId: option.id, backgroundKey: "custom", customBackground: option.name, backgroundFeatId: !featRule.requiresChoice && choices.length === 1 ? optionId(choices[0]) : "", backgroundSkillChoices: skillChoices, backgroundBoosts: { mode: "twoOne", plusTwo: "", plusOne: "", plusOnes: [], allowAny: true } });
    setDetail({ type: "background", option });
  }
  function chooseClass(option) {
    const staticKey = CLASS_DEFINITIONS[option.class_key] ? option.class_key : "civilian";
    patch({ classOptionId: option.id, classKey: staticKey, selectedClassSkills: [], expertiseSkills: [], baseAbilities: standardScoresForClass(option) });
    setDetail({ type: "class", option });
  }
  function rerollScores() { setRolls(rollAbilityPool()); setAllocation({}); setSelectedRollId(""); patch({ abilityMethod: "rolled" }); }
  function allocateRoll(ability, rollId) {
    if (!rollId) return;
    setAllocation((current) => {
      const next = { ...current }; const prior = next[ability]; const other = ABILITY_KEYS.find((key) => key !== ability && next[key] === rollId);
      next[ability] = rollId; if (other) next[other] = prior; return next;
    });
    setSelectedRollId(""); setDetail({ type: "ability", key: ability }); setError("");
  }
  function handleAbilityDrop(event, ability) { event.preventDefault(); allocateRoll(ability, event.dataTransfer.getData("text/npc-forge-roll") || selectedRollId); }
  function assignSelectedRoll(ability) { if (selectedRollId) allocateRoll(ability, selectedRollId); else setDetail({ type: "ability", key: ability }); }
  function setAbility(key, value) { setDraft((current) => ({ ...current, abilityMethod: "manual", baseAbilities: { ...(current.baseAbilities || {}), [key]: Math.max(1, Math.min(30, Number(value) || 1)) } })); setDetail({ type: "ability", key }); setError(""); }
  function setBackgroundBoost(field, value) { setDraft((current) => ({ ...current, backgroundBoosts: { ...(current.backgroundBoosts || {}), [field]: value, allowAny: true } })); setError(""); }
  function togglePlusOne(ability) { setDraft((current) => { const selected = uniqueText(current.backgroundBoosts?.plusOnes || []); const next = selected.includes(ability) ? selected.filter((key) => key !== ability) : selected.length < 3 ? [...selected, ability] : selected; return { ...current, backgroundBoosts: { ...(current.backgroundBoosts || {}), mode: "three", plusOnes: next, allowAny: true } }; }); setDetail({ type: "ability", key: ability }); setError(""); }
  function toggleBackgroundSkill(groupId, skillKey, count) {
    setDraft((current) => {
      const choices = { ...(current.backgroundSkillChoices || {}) };
      const selected = uniqueText(choices[groupId] || []);
      choices[groupId] = selected.includes(skillKey) ? selected.filter((key) => key !== skillKey) : selected.length < count ? [...selected, skillKey] : [...selected.slice(0, Math.max(0, count - 1)), skillKey];
      return { ...current, backgroundSkillChoices: choices };
    }); setError("");
  }
  function selectBackgroundFeat(featId) { patch({ backgroundFeatId: featId }); }
  function toggleClassSkill(skillKey) { setDraft((current) => { const selected = uniqueText(current.selectedClassSkills || []); const next = selected.includes(skillKey) ? selected.filter((key) => key !== skillKey) : selected.length < classSkillConfig.count ? [...selected, skillKey] : selected; return { ...current, selectedClassSkills: next }; }); setDetail({ type: "skill", key: skillKey }); setError(""); }
  function toggleExpertise(skillKey) { setDraft((current) => { const selected = new Set(current.expertiseSkills || []); if (selected.has(skillKey)) selected.delete(skillKey); else selected.add(skillKey); return { ...current, expertiseSkills: [...selected] }; }); setDetail({ type: "skill", key: skillKey }); }
  function setProfession(professionKey, field, value) { setDraft((current) => ({ ...current, professions: { ...(current.professions || {}), [professionKey]: { ...(current.professions?.[professionKey] || {}), [field]: value, ...(field === "rank" && Number(value) === 0 ? { offersService: false } : {}) } } })); setDetail({ type: "profession", key: professionKey }); setError(""); }
  function addFeat() { const option = featOptions.find((row) => row.id === featToAdd); if (!option) return; patch({ additionalFeats: uniqueText([...(draft.additionalFeats || []), option.name]) }); setFeatToAdd(""); }
  function addTag() { const value = safeText(tagInput).toLowerCase(); if (!value) return; patch({ tags: uniqueText([...(draft.tags || []), value]) }); setTagInput(""); }
  function generateName() { patch({ name: generateNpcName({ species: selectedSpecies?.name || draft.customSpecies, gender: draft.gender }) }); }
  function choosePortrait(selection) {
    patch({
      portraitLibraryId: selection.portraitLibraryId || "",
      portraitName: selection.portraitName || "",
      portraitUrl: selection.portraitUrl || "",
      portraitStoragePath: selection.portraitStoragePath || "",
      portraitThumbUrl: selection.portraitThumbUrl || "",
      portraitShopUrl: selection.portraitShopUrl || "",
      portraitSource: selection.portraitSource || "library",
      visualAssetId: selection.visualAssetId || "",
      spriteKey: selection.spriteKey || "",
      // Rich 8-direction assets are associated now but are not forced into the legacy 4-dir map renderer.
      spritePath: selection.spriteAsset?.sprite_format === "legacy_4dir_3frame_32" ? selection.spritePath || "" : "",
      spriteScale: Number(selection.spriteScale || 0.7),
      spriteAsset: selection.spriteAsset || null,
    });
  }
  function generateStory() {
    const professions = PROFESSION_KEYS.map((key) => ({ key, ...PROFESSION_DEFINITIONS[key], ...(draft.professions?.[key] || {}) })).filter((entry) => Number(entry.rank || 0) > 0);
    const generated = generateNpcStory({
      locations,
      species: selectedSpecies,
      background: selectedBackground,
      classRow: selectedClass,
      skills: selectedSkillKeys,
      professions,
      level: draft.level,
      identity: { name: draft.name, role: draft.role, affiliation: draft.affiliation, tags: draft.tags, kind: draft.kind, locationId: draft.locationId },
    });
    patch(generated);
  }

  function stepErrors(index) {
    const errors = [];
    if (index === 0) { if (!selectedSpecies) errors.push("Choose a species."); if (draft.alignment && !ALIGNMENT_OPTIONS.some((option) => option.key === String(draft.alignment).toUpperCase())) errors.push("Choose a valid alignment."); if (!safeText(draft.languagesText)) errors.push("Add at least one language."); }
    if (index === 1) {
      if (!selectedBackground) errors.push("Choose a background.");
      if (selectedBackgroundFeatRule.requiresChoice && !selectedBackgroundFeat) errors.push("Choose the feat granted by this background in the Origin Feat information row.");
      backgroundSkillChoiceGroups.forEach((group) => { if (uniqueText(draft.backgroundSkillChoices?.[group.id] || []).length !== group.count) errors.push(`Choose ${group.count} background skill${group.count === 1 ? "" : "s"} in the Skills information row.`); });
    }
    if (index === 2) { if (!selectedClass) errors.push("Choose a class or No Adventuring Class."); if (Number(draft.level || 0) < 1 || Number(draft.level || 0) > 20) errors.push("Level must be between 1 and 20."); }
    if (index === 3) {
      if (draft.abilityMethod === "rolled" && ABILITY_KEYS.some((key) => !allocation[key])) errors.push("Assign all six rolled totals.");
      const boosts = draft.backgroundBoosts || {};
      if (boosts.mode === "three") { if (uniqueText(boosts.plusOnes || []).filter((key) => ABILITY_KEYS.includes(key)).length !== 3) errors.push("Choose three different +1 abilities."); }
      else if (!ABILITY_KEYS.includes(boosts.plusTwo) || !ABILITY_KEYS.includes(boosts.plusOne) || boosts.plusTwo === boosts.plusOne) errors.push("Choose different abilities for the +2 and +1 increases.");
    }
    if (index === 4) {
      if ((draft.selectedClassSkills || []).length !== classSkillConfig.count) errors.push(`Choose exactly ${classSkillConfig.count} class skill${classSkillConfig.count === 1 ? "" : "s"}.`);
      PROFESSION_KEYS.forEach((key) => { const profession = draft.professions?.[key] || {}; if (profession.offersService && Number(profession.rank || 0) === 0) errors.push(`${PROFESSION_DEFINITIONS[key].label} must be trained before this NPC can offer it as a service.`); });
    }
    if (index === 5) { if (!safeText(draft.name)) errors.push("Enter or generate a name."); if (!safeText(draft.role)) errors.push("Enter a role or title so the roster remains useful."); if (!draft.portraitLibraryId) errors.push("Choose a portrait for this character."); }
    return errors;
  }
  function handleNext() { const errors = stepErrors(step); if (errors.length) { setError(errors.join(" ")); return; } setStep((current) => Math.min(STEP_LABELS.length - 1, current + 1)); setDetail(null); }
  function handleBack() { setError(""); setStep((current) => Math.max(0, current - 1)); setDetail(null); }

  async function handleCreate() {
    if (creating) return;
    const errors = STEP_LABELS.flatMap((_label, index) => stepErrors(index));
    if (errors.length) { setError(uniqueText(errors).join(" ")); return; }
    setCreating(true); setError("");
    const requestId = draft.creationRequestId;
    try {
      let timedOut = false;
      const timeout = new Promise((resolve) => setTimeout(() => { timedOut = true; resolve({ timeout: true }); }, 12000));
      const rpcPromise = createCharacter ? createCharacter(createPayload) : supabase.rpc("create_character_v1", { p_payload: createPayload });
      const result = await Promise.race([rpcPromise, timeout]);
      let createdRow = null;
      if (result?.timeout || timedOut) {
        createdRow = await recoverCreatedCharacter(requestId);
        if (!createdRow) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          createdRow = await recoverCreatedCharacter(requestId);
        }
        if (!createdRow) throw new Error("Character creation is taking longer than expected. You can safely retry; this Forge uses the same creation request and will not duplicate a completed character.");
      } else {
        if (result?.error) throw result.error;
        const id = typeof result?.data === "string" ? result.data : result?.data?.id || result?.data?.character_id || null;
        createdRow = { id, kind: createPayload.kind, name: createPayload.name };
      }
      const created = { id: createdRow?.id, kind: createdRow?.kind || createPayload.kind, name: createdRow?.name || createPayload.name };
      resetForm();
      Promise.resolve(onCreated?.(created)).catch((callbackError) => console.error("NPC Forge post-create refresh failed", callbackError));
    } catch (err) {
      setCreating(false);
      setError(String(err?.message || err || "Failed to create character."));
    }
  }

  if (!show) return null;

  return <div className="npc-forge-backdrop" role="presentation"><div className={`npc-forge-modal npc-forge-modal-v2 ${playerMode ? "is-player-mode" : "is-npc-mode"}`} role="dialog" aria-modal="true" aria-labelledby={playerMode ? "player-forge-title" : "npc-forge-title"}>
    <header className="npc-forge-header"><div><div className="npc-forge-kicker">Canonical character system</div><h2 id={playerMode ? "player-forge-title" : "npc-forge-title"}>{playerMode ? "Player Character Forge" : "NPC Forge"}</h2><p>{playerMode ? "Build a player-owned character with the shared canonical Forge. Starting level may be set from 1 to 20." : "Build the rules first, then finish identity and placement. Story generation uses the identity you establish before it."}</p></div><div className="npc-forge-header-actions"><button type="button" className="btn btn-sm btn-outline-warning" onClick={handleReset} disabled={creating}>Reset</button><button type="button" className="btn btn-sm btn-outline-light" onClick={handleClose} disabled={creating}>Close</button></div></header>
    <nav className="npc-forge-steps" aria-label={playerMode ? "Player character creation steps" : "NPC creation steps"}>{STEP_LABELS.map((label, index) => <button key={label} type="button" className={`${index === step ? "is-current" : ""} ${index < step ? "is-complete" : ""}`} onClick={() => { if (index <= step) { setStep(index); setDetail(null); setError(""); } }} disabled={creating || index > step}><span>{index + 1}</span>{label}</button>)}</nav>
    <div className={`npc-forge-body npc-forge-step-${step} ${playerMode ? "is-player-mode" : "is-npc-mode"}`}><section className="npc-forge-workspace">{catalogError ? <div className="npc-forge-catalog-warning">{catalogError}</div> : null}

      {step === 0 ? <div className="npc-forge-section"><div className="npc-forge-section-heading"><div><span>Species</span><h3>Choose ancestry and innate traits</h3></div><p>{loadingCatalogs ? "Loading source catalog…" : `${speciesOptions.length} species available.`}</p></div><CatalogList label="Species" query={speciesQuery} onQuery={setSpeciesQuery} rows={filteredSpecies} selectedId={draft.speciesOptionId} onSelect={chooseSpecies} emptyText="No species match this search." /><div className="npc-forge-form-grid mt-3">{selectedSpecies?.lineages?.length ? <label><span>Lineage / ancestry</span><select value={draft.lineage} onChange={(event) => patch({ lineage: event.target.value })}><option value="">Choose lineage</option>{selectedSpecies.lineages.map((lineage) => <option key={lineage} value={lineage}>{lineage}</option>)}</select></label> : null}<label><span>Gender presentation</span><select value={draft.gender} onChange={(event) => patch({ gender: event.target.value })}><option value="female">Female</option><option value="male">Male</option><option value="neutral">Nonbinary / neutral</option></select></label><label><span>Size</span><select value={draft.size} onChange={(event) => patch({ size: event.target.value })}><option value="">Species default</option>{SIZE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><label><span>Alignment</span><select value={draft.alignment} onChange={(event) => patch({ alignment: event.target.value })}>{ALIGNMENT_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><label className="wide"><span>Languages</span><input value={draft.languagesText} onChange={(event) => patch({ languagesText: event.target.value })} placeholder="Common, Elvish, Dwarvish" /></label></div></div> : null}

      {step === 1 ? <div className="npc-forge-section"><div className="npc-forge-section-heading"><div><span>Background</span><h3>Choose a formative background</h3></div><p>{loadingCatalogs ? "Loading source catalog…" : `${backgroundOptions.length} backgrounds available.`}</p></div><CatalogList label="Backgrounds" query={backgroundQuery} onQuery={setBackgroundQuery} rows={filteredBackgrounds} selectedId={draft.backgroundOptionId} onSelect={chooseBackground} emptyText="No backgrounds match this search." /><div className="npc-forge-workspace-note mt-3">Background rules, source features, required skill or feat choices, and expanded spells are shown in the information panel.</div></div> : null}

      {step === 2 ? <div className="npc-forge-section"><div className="npc-forge-section-heading"><div><span>Class</span><h3>Adventuring progression</h3></div><p>Preferred 2024 versions appear first; classes without a 2024 version remain available.</p></div><div className="npc-forge-level-row"><label><span>Level</span><input type="number" min="1" max="20" value={draft.level} onChange={(event) => patch({ level: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })} /></label><div><span>Proficiency bonus</span><strong>+{proficiencyBonus(draft.level)}</strong></div><div><span>Hit Dice</span><strong>{draft.level}d{classHitDie}</strong></div><div><span>Expected HP</span><strong>{dynamicHp}</strong></div></div><CatalogList label="Classes" query={classQuery} onQuery={setClassQuery} rows={filteredClasses} selectedId={draft.classOptionId} onSelect={chooseClass} emptyText="No classes match this search." /></div> : null}

      {step === 3 ? <div className="npc-forge-section"><div className="npc-forge-section-heading"><div><span>Abilities</span><h3>Generate and allocate ability scores</h3></div><p>Assign each rolled total yourself; no roll is assigned automatically.</p></div><div className="npc-forge-segmented"><button type="button" className={draft.abilityMethod === "rolled" ? "is-active" : ""} onClick={() => patch({ abilityMethod: "rolled" })}>4d6 drop lowest</button><button type="button" className={draft.abilityMethod === "standard" ? "is-active" : ""} onClick={() => patch({ abilityMethod: "standard", baseAbilities: standardScoresForClass(selectedClass) })}>Class standard array</button><button type="button" className={draft.abilityMethod === "manual" ? "is-active" : ""} onClick={() => patch({ abilityMethod: "manual" })}>Manual</button>{draft.abilityMethod === "rolled" ? <button type="button" onClick={rerollScores}>Reroll all six</button> : null}</div>{draft.abilityMethod === "rolled" ? <><div className="npc-forge-ability-drop-grid mt-3">{ABILITY_KEYS.map((key) => { const roll = rolls.find((entry) => entry.id === allocation[key]); const rollIndex = rolls.findIndex((entry) => entry.id === allocation[key]); return <button key={key} type="button" className={selectedRollId ? "is-ready" : ""} onClick={() => assignSelectedRoll(key)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => handleAbilityDrop(event, key)} onMouseEnter={() => setDetail({ type: "ability", key })}><span>{ABILITY_LABELS[key]}</span><strong>{roll?.total ?? "—"}</strong><small>{roll ? `Die Roll ${rollIndex + 1}` : "Drag a Die Roll here to assign"}</small><em>{roll ? `Final ${finalAbilities[key]} (${modifierLabel(finalAbilities[key])})` : "No roll assigned"}</em></button>; })}</div><div className="npc-forge-allocation-instruction">{selectedRollId ? `Die Roll ${rolls.findIndex((roll) => roll.id === selectedRollId) + 1} selected — choose an ability above.` : "Drag a Die Roll card onto an ability above, or click the roll and then the ability."}</div><div className="npc-forge-roll-pool mt-3">{rolls.map((roll, index) => <DiceSummary key={roll.id} roll={roll} index={index} assignedAbility={allocatedAbilityByRoll[roll.id]} selected={selectedRollId === roll.id} onSelect={(rollId) => setSelectedRollId((current) => current === rollId ? "" : rollId)} />)}</div></> : <div className="npc-forge-ability-grid mt-3">{ABILITY_KEYS.map((key) => <label key={key} onMouseEnter={() => setDetail({ type: "ability", key })}><span>{ABILITY_LABELS[key]}</span><input type="number" min="1" max="30" value={draft.baseAbilities?.[key] ?? 10} readOnly={draft.abilityMethod === "standard"} onChange={(event) => setAbility(key, event.target.value)} /><small>Final {finalAbilities[key]} ({modifierLabel(finalAbilities[key])})</small></label>)}</div>}<div className="npc-forge-subheading mt-4">Ability increases <small>Suggested by {selectedBackground?.name || "background"}, but campaign placement is flexible.</small></div><div className="npc-forge-segmented compact"><button type="button" className={draft.backgroundBoosts?.mode !== "three" ? "is-active" : ""} onClick={() => setBackgroundBoost("mode", "twoOne")}>+2 and +1</button><button type="button" className={draft.backgroundBoosts?.mode === "three" ? "is-active" : ""} onClick={() => setBackgroundBoost("mode", "three")}>Three +1s</button></div>{draft.backgroundBoosts?.mode === "three" ? <div className="npc-forge-choice-grid three mt-2">{ABILITY_KEYS.map((key) => <button key={key} type="button" className={`npc-forge-ability-choice ${(draft.backgroundBoosts?.plusOnes || []).includes(key) ? "is-active" : ""} ${(selectedBackground?.recommendedAbilities || []).includes(key) ? "is-recommended" : ""}`} onClick={() => togglePlusOne(key)}><strong>{ABILITY_LABELS[key]}</strong><span>+1</span></button>)}</div> : <div className="npc-forge-form-grid mt-2"><label><span>Increase by 2</span><select value={draft.backgroundBoosts?.plusTwo || ""} onChange={(event) => setBackgroundBoost("plusTwo", event.target.value)}><option value="">Choose ability</option>{ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}{(selectedBackground?.recommendedAbilities || []).includes(key) ? " — suggested" : ""}</option>)}</select></label><label><span>Increase by 1</span><select value={draft.backgroundBoosts?.plusOne || ""} onChange={(event) => setBackgroundBoost("plusOne", event.target.value)}><option value="">Choose ability</option>{ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}{(selectedBackground?.recommendedAbilities || []).includes(key) ? " — suggested" : ""}</option>)}</select></label></div>}</div> : null}

      {step === 4 ? <div className="npc-forge-section"><div className="npc-forge-section-heading"><div><span>Training</span><h3>Skills, expertise, and professions</h3></div><p>Select any entry to read its purpose in the information panel.</p></div><div className="npc-forge-subheading">Background skills</div><div className="npc-forge-chip-row">{backgroundSkills.length ? backgroundSkills.map((key) => <button key={key} type="button" className="is-fixed" onClick={() => setDetail({ type: "skill", key })}>{titleForSkill(key)}</button>) : <span className="is-fixed">No skills listed</span>}</div><div className="npc-forge-subheading mt-4">Class skills <small>{(draft.selectedClassSkills || []).length}/{classSkillConfig.count}</small></div><div className="npc-forge-skill-grid">{classSkillConfig.options.map((key) => { const selected = (draft.selectedClassSkills || []).includes(key); const backgroundGranted = backgroundSkills.includes(key); return <button key={key} type="button" className={`${selected ? "is-active" : ""} ${backgroundGranted ? "is-background" : ""}`} onClick={() => backgroundGranted ? setDetail({ type: "skill", key }) : toggleClassSkill(key)}><span>{titleForSkill(key)}</span><small>{backgroundGranted ? "Background" : selected ? "Selected" : "Available"}</small></button>; })}</div><div className="npc-forge-subheading mt-4">Expertise <small>optional</small></div><div className="npc-forge-chip-row">{selectedSkillKeys.map((key) => <button key={key} type="button" className={(draft.expertiseSkills || []).includes(key) ? "is-active" : ""} onClick={() => toggleExpertise(key)}>{titleForSkill(key)}</button>)}</div><div className="npc-forge-subheading mt-4">Professions</div><div className="npc-forge-profession-list">{PROFESSION_KEYS.map((key) => { const definition = PROFESSION_DEFINITIONS[key]; const profession = draft.professions?.[key] || EMPTY_PROFESSIONS[key]; return <div key={key} className={`npc-forge-profession ${profession.offersService ? "is-provider" : ""}`} onMouseEnter={() => setDetail({ type: "profession", key })}><div><strong>{definition.label}</strong><small>{definition.tool}</small></div><label><span>Rank</span><select value={profession.rank} onChange={(event) => setProfession(key, "rank", Number(event.target.value))}><option value={0}>Untrained</option><option value={1}>Proficient</option><option value={2}>Expertise</option></select></label><label><span>Ability</span><select value={profession.ability} onChange={(event) => setProfession(key, "ability", event.target.value)}>{definition.abilities.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}</select></label><label className="npc-forge-service-toggle"><input type="checkbox" checked={Boolean(profession.offersService)} disabled={Number(profession.rank || 0) === 0} onChange={(event) => setProfession(key, "offersService", event.target.checked)} /><span>Offers workshop service</span></label></div>; })}</div></div> : null}

      {step === 5 ? <div className="npc-forge-section"><div className="npc-forge-section-heading"><div>{playerMode ? <><span>Identity</span><h3>Name and define the character</h3></> : <><span>Identity &amp; placement</span><h3>Name and place the finished character</h3></>}</div><p>Identity is established before Story so generated hooks can use these facts.</p></div><div className="npc-forge-choice-grid two"><button type="button" className={`npc-forge-choice ${draft.kind === "npc" ? "is-active" : ""}`} onClick={() => patch({ kind: "npc", storefrontEnabled: false })}><span className="npc-forge-choice-head"><strong>NPC</strong></span><span className="npc-forge-choice-body">Resident, ruler, enemy, ally, quest figure, or workshop provider.</span></button><button type="button" className={`npc-forge-choice ${draft.kind === "merchant" ? "is-active" : ""}`} onClick={() => patch({ kind: "merchant", storefrontEnabled: true })}><span className="npc-forge-choice-head"><strong>Merchant</strong></span><span className="npc-forge-choice-body">The same character model with storefront and stock capabilities.</span></button></div><div className="npc-forge-form-grid mt-3"><label className="wide"><span>Name *</span><div className="npc-forge-name-row"><input value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Marta Ironroot" /><button type="button" onClick={generateName}>Generate for {selectedSpecies?.name || "species"}</button></div></label><label><span>Role / title *</span><input value={draft.role} onChange={(event) => patch({ role: event.target.value })} placeholder="Master Armorer" /></label><label><span>Affiliation</span><input value={draft.affiliation} onChange={(event) => patch({ affiliation: event.target.value })} placeholder="Gray Hall Smiths' Guild" /></label></div><div className="npc-forge-subheading mt-4">Portrait &amp; map identity</div><div className="npc-forge-identity-art">{draft.portraitUrl ? <img src={draft.portraitUrl} alt="Selected character portrait" /> : <div className="npc-forge-identity-art-empty">Choose a portrait</div>}<div><strong>{draft.portraitName || "Portrait required"}</strong><span>{assetSummary(draft.spriteAsset)}</span><small>{draft.visualAssetId ? "Portrait and sprite are associated in the visual-asset catalog." : "This portrait can receive a matching sprite sheet later without changing the character."}</small><button type="button" onClick={() => setPortraitPickerOpen(true)}>{draft.portraitLibraryId ? "Change portrait" : "Choose portrait"}</button></div></div><div className="npc-forge-subheading mt-4">Roster tags</div><div className="npc-forge-add-row"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder="guild, guard, ally, villain..." /><button type="button" onClick={addTag}>Add</button></div><div className="npc-forge-chip-row mt-2">{(draft.tags || []).map((tag) => <button key={tag} type="button" onClick={() => patch({ tags: draft.tags.filter((value) => value !== tag) })}>{tag} ×</button>)}</div><div className="npc-forge-subheading mt-4">Placement</div><div className="npc-forge-form-grid"><label><span>Starting location</span><select value={draft.locationId} onChange={(event) => patch({ locationId: event.target.value })}><option value="">Not listed</option>{(locations || []).map((location) => <option key={String(location.id)} value={String(location.id)}>{location.name}</option>)}</select></label><div className="npc-forge-callout"><strong>Off-map by default</strong><span>Identity assigns a roster location only. It does not alter routes, movement, sprites, or world-map behavior.</span></div></div>{draft.kind === "merchant" ? <div className="npc-forge-merchant-box mt-4"><label className="npc-forge-service-toggle"><input type="checkbox" checked={Boolean(draft.storefrontEnabled)} onChange={(event) => patch({ storefrontEnabled: event.target.checked })} /><span>Enable storefront</span></label>{draft.storefrontEnabled ? <div className="npc-forge-form-grid mt-2"><label><span>Store title</span><input value={draft.storefrontTitle} onChange={(event) => patch({ storefrontTitle: event.target.value })} placeholder={`${draft.name || "Merchant"}'s Shop`} /></label><label><span>Store tagline</span><input value={draft.storefrontTagline} onChange={(event) => patch({ storefrontTagline: event.target.value })} placeholder="A concise shop description" /></label></div> : null}</div> : null}</div> : null}

      {step === 6 ? <div className="npc-forge-section"><div className="npc-forge-section-heading"><div><span>Story</span><h3>Campaign hooks and usable characterization</h3></div><div className="npc-forge-story-actions"><button type="button" onClick={generateStory}>{playerMode ? "Generate character story & world fit" : "Generate NPC story & world fit"}</button><p>{playerMode ? `Uses ${draft.name || "the character"}'s identity, class, background, and affiliation.` : `Uses ${draft.name || "the character"}'s identity, role, affiliation, tags, and selected location.`}</p></div></div>{storyWorldLocation ? <div className="npc-forge-world-fit"><strong>World fit: {storyWorldLocation}</strong><span>A location chosen on Identity is preserved; otherwise the generator suggests an existing location.</span></div> : null}<div className="npc-forge-form-grid"><label className="wide"><span>Description</span><textarea rows={2} value={draft.description} onChange={(event) => patch({ description: event.target.value })} placeholder="What players notice immediately." /></label><label className="wide"><span>Appearance</span><textarea rows={2} value={draft.appearance} onChange={(event) => patch({ appearance: event.target.value })} placeholder="Age, clothing, posture, notable marks, aura, or monster traits." /></label><label className="wide"><span>Background narrative</span><textarea rows={2} value={draft.backgroundNarrative} onChange={(event) => patch({ backgroundNarrative: event.target.value })} /></label><label><span>Motivation / want</span><textarea rows={2} value={draft.motivation} onChange={(event) => patch({ motivation: event.target.value })} /></label><label><span>Personality traits</span><textarea rows={2} value={draft.personalityTraits} onChange={(event) => patch({ personalityTraits: event.target.value })} /></label><label><span>Ideals</span><textarea rows={2} value={draft.ideals} onChange={(event) => patch({ ideals: event.target.value })} /></label><label><span>Bonds</span><textarea rows={2} value={draft.bonds} onChange={(event) => patch({ bonds: event.target.value })} /></label><label><span>Flaws</span><textarea rows={2} value={draft.flaws} onChange={(event) => patch({ flaws: event.target.value })} /></label><label><span>Quirk</span><textarea rows={2} value={draft.quirk} onChange={(event) => patch({ quirk: event.target.value })} /></label><label><span>Mannerism</span><textarea rows={2} value={draft.mannerism} onChange={(event) => patch({ mannerism: event.target.value })} /></label><label><span>Voice</span><textarea rows={2} value={draft.voice} onChange={(event) => patch({ voice: event.target.value })} /></label><label className="wide"><span>Secret</span><textarea rows={2} value={draft.secret} onChange={(event) => patch({ secret: event.target.value })} /></label><label className="wide"><span>Attacks &amp; actions</span><textarea rows={3} value={draft.attacks} onChange={(event) => patch({ attacks: event.target.value })} placeholder="Concise attacks, actions, reactions, or combat notes." /></label><label className="wide"><span>Equipment</span><textarea rows={2} value={draft.equipment} onChange={(event) => patch({ equipment: event.target.value })} placeholder="Armor, weapons, tools, trinkets, travel gear, or shop gear." /></label><label><span>Treasure / coin</span><input value={draft.treasure} onChange={(event) => patch({ treasure: event.target.value })} placeholder="50 GP, signet ring, ledger..." /></label>{selectedClass?.spellcasting_ability ? <label className="wide"><span>Prepared spells / spell notes</span><textarea rows={3} value={draft.preparedSpellsText} onChange={(event) => patch({ preparedSpellsText: event.target.value })} placeholder="The automatic NPC spellbook pass will replace this free-text bridge." /></label> : null}</div><div className="npc-forge-subheading mt-4">Additional feats</div><input className="npc-forge-search mb-2" value={featQuery} onChange={(event) => setFeatQuery(event.target.value)} placeholder="Search imported feats…" /><div className="npc-forge-add-row"><select value={featToAdd} onChange={(event) => setFeatToAdd(event.target.value)}><option value="">Choose feat</option>{filteredFeats.map((feat) => <option key={feat.id} value={feat.id}>{feat.name} • {sourceLabel(feat.source)}</option>)}</select><button type="button" onClick={addFeat} disabled={!featToAdd}>Add</button></div><div className="npc-forge-chip-row mt-2">{originFeat !== "None listed" ? <span className="is-fixed">{originFeat}</span> : null}{(draft.additionalFeats || []).map((feat) => <button key={feat} type="button" onClick={() => patch({ additionalFeats: draft.additionalFeats.filter((value) => value !== feat) })}>{feat} ×</button>)}</div></div> : null}

      {step === 7 ? <div className="npc-forge-section"><div className="npc-forge-section-heading"><div><span>Review</span><h3>{playerMode ? "Confirm your player character" : "Confirm the canonical character"}</h3></div><p>Creation is idempotent: retrying the same Forge request cannot intentionally create a duplicate.</p></div><div className="npc-forge-review-hero"><div><span>{playerMode ? "Player Character" : draft.kind === "merchant" ? "Merchant" : "NPC"}</span><h3>{createPayload.name}</h3><p>{createPayload.race} • {createPayload.role}{createPayload.affiliation ? ` • ${createPayload.affiliation}` : ""}</p></div><div><strong>Level {draft.level}</strong><span>{selectedClass?.class_name}</span></div></div><div className="npc-forge-review-grid mt-3"><article><span>Portrait</span><strong>{draft.portraitName || "None"}</strong>{draft.portraitUrl ? <img className="npc-forge-review-portrait" src={draft.portraitUrl} alt="" /> : null}<p>{assetSummary(draft.spriteAsset)}</p></article><article><span>Origin</span><strong>{selectedSpecies?.name}</strong><p>{selectedBackground?.name} • {sourceLabel(selectedBackground?.source)} • {originFeat}</p></article><article><span>Class</span><strong>{selectedClass?.class_name} level {draft.level}</strong><p>PB +{proficiencyBonus(draft.level)} • {dynamicHp} HP • {draft.level}d{classHitDie}</p></article><article><span>Training</span><strong>{selectedSkillKeys.length} trained skills</strong><p>{selectedSkillKeys.map(titleForSkill).join(", ") || "None"}</p></article><article><span>{playerMode ? "Professions" : "Workshops"}</span><strong>{playerMode ? (selectedTrainedProfessions.length ? selectedTrainedProfessions.map((key) => PROFESSION_DEFINITIONS[key].label).join(", ") : "No trained professions") : (selectedProfessionServices.length ? selectedProfessionServices.map((key) => PROFESSION_DEFINITIONS[key].label).join(", ") : "No services")}</strong><p>{playerMode ? "Profession training is recorded for the campaign crafting system." : "Only explicitly enabled services appear as workshop providers."}</p></article><article><span>{playerMode ? "Campaign status" : "Placement"}</span><strong>{playerMode ? "Player-owned • off-map" : ((locations || []).find((location) => String(location.id) === String(draft.locationId))?.name || "Not listed")}</strong><p>{playerMode ? "Class, species, background, and trained-profession tags are assigned automatically." : <>Created off-map. {draft.kind === "merchant" && draft.storefrontEnabled ? "Storefront enabled." : "No storefront."}</>}</p></article></div><div className="npc-forge-final-abilities mt-3">{ABILITY_KEYS.map((key) => <div key={key}><span>{key.toUpperCase()}</span><strong>{finalAbilities[key]}</strong><small>{modifierLabel(finalAbilities[key])}</small></div>)}</div><details className="npc-forge-json mt-3"><summary>Review generated sheet JSON</summary><pre>{JSON.stringify(createPayload.sheet, null, 2)}</pre></details></div> : null}

    </section><aside className="npc-forge-preview npc-forge-context-panel"><NpcForgeContextPanel step={step} detail={detail} selectedSpecies={selectedSpecies} selectedBackground={selectedBackground} backgroundMechanicDetails={backgroundMechanicDetails} selectedBackgroundFeat={selectedBackgroundFeat} backgroundFeatOptions={backgroundFeatOptions} backgroundSkillSelections={draft.backgroundSkillChoices || {}} onToggleBackgroundSkill={toggleBackgroundSkill} onSelectBackgroundFeat={selectBackgroundFeat} selectedClass={selectedClass} selectedSkill={selectedSkill} selectedProfession={selectedProfession} rolls={rolls} allocation={allocation} finalAbilities={finalAbilities} draft={{ ...draft, baseAbilities }} /></aside></div>
    {error ? <div className="npc-forge-error" role="alert">{error}</div> : null}
    <footer className="npc-forge-footer"><button type="button" className="btn btn-outline-light" onClick={handleClose} disabled={creating}>Cancel</button><div>{step > 0 ? <button type="button" className="btn btn-outline-light" onClick={handleBack} disabled={creating}>Back</button> : null}{step < STEP_LABELS.length - 1 ? <button type="button" className="btn btn-primary" onClick={handleNext} disabled={creating || loadingCatalogs}>Continue</button> : <button type="button" className="btn btn-success" onClick={handleCreate} disabled={creating}>{creating ? "Forging Character..." : playerMode ? "Create Player Character" : `Create ${draft.kind === "merchant" ? "Merchant" : "NPC"}`}</button>}</div></footer>
    <NpcForgePortraitPickerModal show={portraitPickerOpen} currentPortraitId={draft.portraitLibraryId} onClose={() => setPortraitPickerOpen(false)} onSelect={choosePortrait} />
    <style jsx global>{`
      .npc-forge-modal-v2 .npc-forge-body{grid-template-columns:minmax(0,57fr) minmax(470px,43fr)}
      .npc-forge-workspace-note{padding:11px 13px;border-left:3px solid #58d6c7;border-radius:8px;color:rgba(255,255,255,.66);background:rgba(88,214,199,.07);font-size:.76rem;line-height:1.5}
      .npc-forge-roll-card.refined{appearance:none;width:100%;cursor:grab;text-align:center}.npc-forge-roll-card.refined:active{cursor:grabbing}.npc-forge-roll-card.refined>small{color:#f3bf63;font-size:.65rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.npc-forge-roll-card.refined>em{min-height:28px;color:rgba(255,255,255,.48);font-size:.61rem;font-style:normal;line-height:1.25}.npc-forge-roll-card.refined.is-selected{border-color:#a86cff;box-shadow:0 0 0 3px rgba(168,108,255,.18),inset 0 0 20px rgba(168,108,255,.12);transform:translateY(-2px)}
      .npc-forge-allocation-instruction{margin:12px 0 8px;padding:9px 11px;border-radius:8px;color:#d9c5fa;background:rgba(126,72,199,.1);font-size:.72rem}
      .npc-forge-ability-drop-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.npc-forge-ability-drop-grid button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;align-items:center;min-height:82px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:11px;color:rgba(255,255,255,.72);background:rgba(255,255,255,.026);text-align:left;transition:border-color .12s,background .12s,transform .12s}.npc-forge-ability-drop-grid button:hover,.npc-forge-ability-drop-grid button.is-ready{border-color:rgba(168,108,255,.48);background:rgba(126,72,199,.08)}.npc-forge-ability-drop-grid button.is-ready:hover{transform:translateY(-2px);border-color:#a86cff}.npc-forge-ability-drop-grid span{color:#fff;font-size:.8rem;font-weight:800}.npc-forge-ability-drop-grid strong{grid-row:1/3;grid-column:2;color:#fff3ce;font-size:1.45rem}.npc-forge-ability-drop-grid small{color:#cfb4f7;font-size:.68rem}.npc-forge-ability-drop-grid em{grid-column:1/-1;color:rgba(255,255,255,.52);font-size:.65rem;font-style:normal}
      .npc-forge-story-actions{display:grid;justify-items:end;gap:5px}.npc-forge-story-actions button{padding:7px 11px;border:1px solid rgba(88,214,199,.44);border-radius:8px;color:#c9fff7;background:rgba(42,136,124,.12);font-size:.72rem;font-weight:800}.npc-forge-story-actions button:hover{border-color:#58d6c7;background:rgba(42,136,124,.2)}.npc-forge-story-actions p{margin:0}.npc-forge-world-fit{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;padding:10px 12px;border:1px solid rgba(88,214,199,.22);border-radius:9px;background:rgba(88,214,199,.07)}.npc-forge-world-fit strong{color:#bdfbf2;font-size:.75rem}.npc-forge-world-fit span{color:rgba(255,255,255,.62);font-size:.68rem}
      .npc-forge-identity-art{display:grid;grid-template-columns:110px minmax(0,1fr);gap:14px;align-items:center;padding:12px;border:1px solid rgba(168,108,255,.28);border-radius:11px;background:rgba(126,72,199,.07)}.npc-forge-identity-art>img,.npc-forge-identity-art-empty{width:110px;height:145px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.3)}.npc-forge-identity-art-empty{display:grid;place-items:center;padding:10px;color:rgba(255,255,255,.5);font-size:.72rem;text-align:center}.npc-forge-identity-art>div{display:grid;gap:6px}.npc-forge-identity-art strong{font-size:.88rem;color:#fff}.npc-forge-identity-art span{color:#8ceadd;font-size:.72rem}.npc-forge-identity-art small{color:rgba(255,255,255,.58);line-height:1.45}.npc-forge-identity-art button{justify-self:start;padding:7px 10px;border:1px solid rgba(168,108,255,.5);border-radius:7px;color:#eadfff;background:rgba(126,72,199,.12);font-size:.72rem;font-weight:700}.npc-forge-review-portrait{display:block;width:72px;height:96px;margin:7px 0;object-fit:cover;border-radius:7px;border:1px solid rgba(255,255,255,.12)}
      @media(max-width:1220px){.npc-forge-modal-v2 .npc-forge-body{grid-template-columns:minmax(0,3fr) minmax(380px,2fr)}.npc-forge-ability-drop-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:980px){.npc-forge-modal-v2 .npc-forge-body{grid-template-columns:1fr}.npc-forge-ability-drop-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:720px){.npc-forge-ability-drop-grid{grid-template-columns:1fr}.npc-forge-identity-art{grid-template-columns:1fr}.npc-forge-identity-art>img,.npc-forge-identity-art-empty{width:96px;height:128px}}
    `}</style>
  </div></div>;
}

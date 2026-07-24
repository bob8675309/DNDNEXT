import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  ALIGNMENT_OPTIONS,
  BACKGROUND_DEFINITIONS,
  CLASS_DEFINITIONS,
  FEAT_OPTIONS,
  SIZE_OPTIONS,
  SKILL_DEFINITIONS,
  SPECIES_DEFINITIONS,
  buildCharacterCreatePayload,
  buildCharacterSheetFromDraft,
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
import NpcForgeContextPanel from "./NpcForgeContextPanel";

const STEP_LABELS = Object.freeze([
  "Species",
  "Background",
  "Class",
  "Abilities",
  "Training",
  "Story",
  "Identity",
  "Review",
]);

const EMPTY_PROFESSIONS = Object.freeze(Object.fromEntries(PROFESSION_KEYS.map((key) => [key, {
  rank: 0,
  ability: PROFESSION_DEFINITIONS[key].abilities[0],
  offersService: false,
}])));

function initialDraft() {
  return {
    name: "",
    gender: "neutral",
    kind: "npc",
    role: "",
    affiliation: "",
    speciesOptionId: "",
    backgroundOptionId: "",
    classOptionId: "",
    speciesKey: "",
    customSpecies: "",
    lineage: "",
    size: "",
    alignment: "N",
    languagesText: "Common",
    appearance: "",
    backgroundKey: "custom",
    customBackground: "",
    classKey: "civilian",
    level: 1,
    abilityMethod: "rolled",
    baseAbilities: standardAbilityScores("civilian"),
    backgroundBoosts: { mode: "twoOne", plusTwo: "", plusOne: "", plusOnes: [], allowAny: true },
    selectedClassSkills: [],
    expertiseSkills: [],
    professions: JSON.parse(JSON.stringify(EMPTY_PROFESSIONS)),
    additionalFeats: [],
    extraTraits: [],
    preparedSpellsText: "",
    attacks: "",
    equipment: "",
    treasure: "",
    description: "",
    backgroundNarrative: "",
    motivation: "",
    personalityTraits: "",
    ideals: "",
    bonds: "",
    flaws: "",
    quirk: "",
    mannerism: "",
    voice: "",
    secret: "",
    tags: [],
    locationId: "",
    storefrontEnabled: true,
    storefrontTitle: "",
    storefrontTagline: "",
  };
}

function titleForSkill(key) {
  return SKILL_DEFINITIONS.find((skill) => skill.key === key)?.label || key;
}

function toolProficiencyDescription(toolName = "") {
  const name = safeText(toolName);
  const lower = name.toLowerCase();
  if (/woodcarver/.test(lower)) return "Woodcarver's tools shape and repair wooden objects such as arrows, bolts, small carvings, and practical field gear. Proficiency applies when your training materially helps the check.";
  if (/navigator/.test(lower)) return "Navigator's tools help chart routes, determine position, and avoid becoming lost during travel by sea, sky, or unfamiliar wilderness.";
  if (/thieves/.test(lower)) return "Thieves' tools are used to manipulate locks, disable traps, and work with other small mechanical security devices.";
  if (/disguise/.test(lower)) return "A disguise kit helps alter appearance, build a convincing persona, and recognize how another disguise was constructed.";
  if (/forgery/.test(lower)) return "A forgery kit helps reproduce documents, seals, handwriting, and other marks of authenticity, as well as inspect suspected forgeries.";
  if (/herbalism/.test(lower)) return "An herbalism kit is used to identify, gather, and prepare useful plants and to create remedies when a rule or recipe allows it.";
  if (/poisoner/.test(lower)) return "A poisoner's kit supports identifying, handling, and preparing poisons safely when a rule or recipe allows it.";
  if (/gaming set|playing card|dice set|dragonchess|three-dragon/.test(lower)) return `${name} proficiency represents practiced knowledge of its rules, tactics, tells, and the social customs surrounding play.`;
  if (/instrument|lute|flute|drum|horn|viol|lyre|shawm|dulcimer|bagpipe/.test(lower)) return `${name} proficiency covers competent performance, maintenance, and the musical knowledge needed to entertain or accompany others.`;
  if (/vehicle/.test(lower)) return `${name} proficiency applies when handling, controlling, maintaining, or judging that kind of vehicle under difficult conditions.`;
  if (/tools/.test(lower) || /supplies/.test(lower) || /kit/.test(lower)) return `${name} proficiency lets the character add their proficiency bonus when trained use of this equipment is relevant to an ability check.`;
  return `${name} represents specialized practical training. Add the character's proficiency bonus when that training is relevant to the check.`;
}

function abilityModifier(score) {
  return Math.floor((Number(score || 10) - 10) / 2);
}

function modifierLabel(score) {
  const value = abilityModifier(score);
  return value >= 0 ? `+${value}` : String(value);
}

function proficiencyBonus(level) {
  return 2 + Math.floor((Math.max(1, Number(level || 1)) - 1) / 4);
}

function maximumHitPoints(hitDie, level, constitutionScore) {
  const die = Math.max(4, Number(hitDie || 8));
  const resolvedLevel = Math.max(1, Math.min(20, Number(level || 1)));
  const conModifier = abilityModifier(constitutionScore);
  const first = Math.max(1, die + conModifier);
  const later = Math.max(1, Math.floor(die / 2) + 1 + conModifier);
  return first + Math.max(0, resolvedLevel - 1) * later;
}

function sourceLabel(source = "") {
  if (source === "XPHB") return "2024";
  if (source === "PHB") return "2014";
  if (source === "CAMPAIGN") return "Campaign";
  return source || "Unknown";
}

function standardScoresForClass(classRow) {
  if (CLASS_DEFINITIONS[classRow?.class_key]) return standardAbilityScores(classRow.class_key);
  const priorities = uniqueText([
    ...(classRow?.primary_abilities || []),
    "con",
    "dex",
    "wis",
    "int",
    "cha",
    "str",
  ]).filter((key) => ABILITY_KEYS.includes(key));
  const values = [15, 14, 13, 12, 10, 8];
  const scores = Object.fromEntries(ABILITY_KEYS.map((key) => [key, 10]));
  priorities.slice(0, 6).forEach((key, index) => { scores[key] = values[index]; });
  return scores;
}

function speciesTraits(option) {
  if (option?.traits?.length) return option.traits;
  const staticKey = slug(option?.name);
  return SPECIES_DEFINITIONS[staticKey]?.traits || [];
}

function CatalogList({ label, query, onQuery, rows, selectedId, onSelect, emptyText }) {
  return (
    <div className="npc-forge-catalog">
      <div className="npc-forge-catalog-head">
        <span>{label}</span>
        <strong>{rows.length}</strong>
      </div>
      <input className="npc-forge-search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`} />
      <div className="npc-forge-catalog-list">
        {rows.map((row) => (
          <button key={row.id} type="button" className={selectedId === row.id ? "is-active" : ""} onClick={() => onSelect(row)}>
            <span><strong>{row.name || row.class_name}</strong><small>{sourceLabel(row.source)}</small></span>
            <b>›</b>
          </button>
        ))}
        {!rows.length ? <div className="npc-forge-empty-list">{emptyText}</div> : null}
      </div>
    </div>
  );
}

function DiceSummary({ roll }) {
  if (!roll) return null;
  return (
    <div className="npc-forge-roll-card">
      <strong>{roll.total}</strong>
      <div>{roll.dice.map((die, index) => <span key={`${roll.id}-${index}`} className={index === roll.droppedIndex ? "is-dropped" : ""}>{die}</span>)}</div>
    </div>
  );
}

function optionId(row) {
  return safeText(row?.id);
}

export default function NewNpcModalV2({ show, onClose, onCreated, locations = [] }) {
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
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setAllocation(defaultRollAllocation(rolls));
  }, [rolls]);

  useEffect(() => {
    if (!show) return;
    let active = true;
    async function loadCatalogs() {
      setLoadingCatalogs(true);
      setCatalogError("");
      const [classesResult, optionsResult] = await Promise.all([
        supabase
          .from("class_catalog_preferred")
          .select("id,class_key,class_name,source,ruleset,edition,hit_die,primary_abilities,saving_throws,spellcasting_ability,caster_progression,summary,raw_payload")
          .order("class_name", { ascending: true }),
        supabase
          .from("character_option_catalog_preferred")
          .select("id,option_key,option_type,name,source,category,description,prerequisite_text,tags,metadata")
          .in("option_type", ["species", "background", "skill", "feat"])
          .order("option_type", { ascending: true })
          .order("name", { ascending: true })
          .limit(5000),
      ]);
      if (!active) return;
      const firstError = classesResult.error || optionsResult.error;
      if (firstError) setCatalogError(firstError.message || "Could not load the preferred character catalogs. Fallback choices remain available.");
      setClassRows(classesResult.data || []);
      setOptionRows(optionsResult.data || []);
      setLoadingCatalogs(false);
    }
    loadCatalogs();
    return () => { active = false; };
  }, [show]);

  const speciesOptions = useMemo(() => mergePreferredSpecies(optionRows), [optionRows]);
  const backgroundOptions = useMemo(() => mergePreferredBackgrounds(optionRows), [optionRows]);
  const classOptions = useMemo(() => mergePreferredClasses(classRows), [classRows]);
  const featOptions = useMemo(() => {
    const imported = optionRows.filter((row) => row.option_type === "feat");
    if (imported.length) return imported;
    return FEAT_OPTIONS.map((feat) => ({ id: `fallback-${slug(feat.name)}`, name: feat.name, source: "CAMPAIGN", category: feat.category, description: "Campaign fallback feat." }));
  }, [optionRows]);
  const skillInfo = useMemo(() => {
    const map = new Map();
    optionRows.filter((row) => row.option_type === "skill").forEach((row) => {
      const key = normalizeSkillKey(row.name);
      if (key) map.set(key, { key, label: row.name, ability: row.metadata?.ability || row.category || SKILL_DEFINITIONS.find((skill) => skill.key === key)?.ability, description: row.description, source: row.source });
    });
    SKILL_DEFINITIONS.forEach((skill) => {
      if (!map.has(skill.key)) map.set(skill.key, { ...skill, description: FALLBACK_SKILL_DESCRIPTIONS[skill.key], source: "XPHB" });
    });
    return map;
  }, [optionRows]);

  const selectedSpecies = useMemo(() => speciesOptions.find((row) => optionId(row) === draft.speciesOptionId) || null, [draft.speciesOptionId, speciesOptions]);
  const selectedBackground = useMemo(() => backgroundOptions.find((row) => optionId(row) === draft.backgroundOptionId) || null, [backgroundOptions, draft.backgroundOptionId]);
  const selectedClass = useMemo(() => classOptions.find((row) => optionId(row) === draft.classOptionId) || null, [classOptions, draft.classOptionId]);
  const backgroundMechanicDetails = useMemo(() => {
    const skills = (selectedBackground?.backgroundSkills || []).map((key) => {
      const skill = skillInfo.get(key);
      return {
        label: skill?.label || titleForSkill(key),
        description: skill?.description || FALLBACK_SKILL_DESCRIPTIONS[key] || "This skill represents trained application of the associated ability.",
        source: skill?.source || "XPHB",
      };
    });
    const tools = (selectedBackground?.tools || []).map((name) => ({
      label: name,
      description: toolProficiencyDescription(name),
    }));
    const featName = safeText(selectedBackground?.originFeat);
    const feat = featOptions.find((option) => safeText(option.name).toLowerCase() === featName.toLowerCase());
    const originFeat = featName ? [{
      label: featName,
      description: feat?.description || "This background grants the named Origin feat. Its benefits are added to the completed character sheet.",
      prerequisite: feat?.prerequisite_text || "",
      source: feat?.source || selectedBackground?.source,
    }] : [];
    return { skills, tools, originFeat };
  }, [featOptions, selectedBackground, skillInfo]);
  const classSkillConfig = useMemo(() => extractClassSkillConfiguration(selectedClass), [selectedClass]);
  const selectedSkill = detail?.type === "skill" ? skillInfo.get(detail.key) || null : null;
  const selectedProfession = detail?.type === "profession" ? PROFESSION_DEFINITIONS[detail.key] || null : null;

  const filteredSpecies = useMemo(() => speciesOptions.filter((row) => optionMatchesQuery(row, speciesQuery)), [speciesOptions, speciesQuery]);
  const filteredBackgrounds = useMemo(() => backgroundOptions.filter((row) => optionMatchesQuery(row, backgroundQuery)), [backgroundOptions, backgroundQuery]);
  const filteredClasses = useMemo(() => classOptions.filter((row) => optionMatchesQuery({ ...row, name: row.class_name, description: row.summary }, classQuery)), [classOptions, classQuery]);
  const filteredFeats = useMemo(() => featOptions.filter((row) => optionMatchesQuery(row, featQuery) && !draft.additionalFeats.includes(row.name)).slice(0, 200), [draft.additionalFeats, featOptions, featQuery]);

  const baseAbilities = useMemo(() => {
    if (draft.abilityMethod === "rolled") return abilityScoresFromRollAllocation(rolls, allocation);
    return draft.baseAbilities;
  }, [allocation, draft.abilityMethod, draft.baseAbilities, rolls]);
  const finalAbilities = useMemo(() => flexibleAbilityBoosts(baseAbilities, draft.backgroundBoosts), [baseAbilities, draft.backgroundBoosts]);
  const classHitDie = Number(selectedClass?.hit_die || CLASS_DEFINITIONS[draft.classKey]?.hitDie || 8);
  const sheetPreview = useMemo(() => buildCharacterSheetFromDraft({ ...draft, baseAbilities }), [baseAbilities, draft]);
  const dynamicHp = maximumHitPoints(classHitDie, draft.level, finalAbilities.con);
  const originFeat = selectedBackground?.originFeat || "None listed";
  const backgroundSkills = selectedBackground?.backgroundSkills || [];
  const selectedSkillKeys = uniqueText([...backgroundSkills, ...(draft.selectedClassSkills || [])]);
  const selectedProfessionServices = PROFESSION_KEYS.filter((key) => draft.professions?.[key]?.offersService);

  const createPayload = useMemo(() => {
    const base = buildCharacterCreatePayload({ ...draft, baseAbilities });
    const speciesName = selectedSpecies?.name || base.sheet.species;
    const backgroundName = selectedBackground?.name || base.sheet.background;
    const className = selectedClass?.class_name || base.sheet.className;
    const classKey = selectedClass?.class_key || base.sheet.classKey;
    const classSource = selectedClass?.source || "CAMPAIGN";
    const pb = proficiencyBonus(draft.level);
    const traits = speciesTraits(selectedSpecies);
    const feats = uniqueText([selectedBackground?.originFeat, ...(draft.additionalFeats || [])]);
    const saves = selectedClass?.saving_throws || [];
    const tools = selectedBackground?.tools || [];
    const proficiencies = {
      saves: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { proficient: saves.includes(key) }])),
      skills: Object.fromEntries(SKILL_DEFINITIONS.map((skill) => [skill.key, {
        proficient: selectedSkillKeys.includes(skill.key),
        expertise: (draft.expertiseSkills || []).includes(skill.key),
      }])),
    };
    const castingAbility = selectedClass?.spellcasting_ability || null;
    const spellcasting = castingAbility ? {
      ability: castingAbility,
      abilityLabel: ABILITY_LABELS[castingAbility] || castingAbility,
      spellSaveDc: 8 + pb + abilityModifier(finalAbilities[castingAbility]),
      spellAttackBonus: pb + abilityModifier(finalAbilities[castingAbility]),
      preparedSpellsText: safeText(draft.preparedSpellsText),
      catalogStatus: "preferred_all_sources",
    } : null;

    const sheet = {
      ...base.sheet,
      meta: {
        ...(base.sheet.meta || {}),
        classKey,
        className,
        classSource,
        rulesetSource: classSource,
        ruleset: selectedClass?.ruleset || "campaign",
        speciesKey: selectedSpecies?.key || slug(speciesName),
        species: speciesName,
        speciesSource: selectedSpecies?.source || "CAMPAIGN",
        backgroundKey: selectedBackground?.key || slug(backgroundName),
        background: backgroundName,
        backgroundSource: selectedBackground?.source || "CAMPAIGN",
        originFeat: selectedBackground?.originFeat || null,
        gender: draft.gender,
        level: Number(draft.level || 1),
        creator: "npc_forge_v2",
      },
      classKey,
      className,
      class: className,
      level: Number(draft.level || 1),
      species: speciesName,
      race: speciesName,
      background: backgroundName,
      speed: Number(selectedSpecies?.speed || base.sheet.speed || 30),
      abilities: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { score: finalAbilities[key] }])),
      proficiencies,
      proficiencyBonus: pb,
      hp: dynamicHp,
      maxHp: dynamicHp,
      hitDice: `${Number(draft.level || 1)}d${classHitDie}`,
      feats,
      speciesTraits: traits,
      featsTraits: [...feats.map((feat) => `Feat: ${feat}`), ...traits.map((trait) => `Species: ${trait}`), ...(draft.extraTraits || [])].join("\n"),
      tools: uniqueText([...tools, ...(draft.additionalTools || [])]),
      spellcasting,
      spells: safeText(draft.preparedSpellsText),
    };

    return {
      ...base,
      name: safeText(draft.name),
      race: speciesName,
      role: safeText(draft.role) || (draft.kind === "merchant" ? "Merchant" : className),
      affiliation: safeText(draft.affiliation) || null,
      sheet,
    };
  }, [baseAbilities, classHitDie, draft, dynamicHp, finalAbilities, selectedBackground, selectedClass, selectedSkillKeys, selectedSpecies]);

  function patch(values) {
    setDraft((current) => ({ ...current, ...values }));
    setError("");
  }

  function resetForm() {
    const nextRolls = rollAbilityPool();
    setStep(0);
    setDraft(initialDraft());
    setCreating(false);
    setLoadingCatalogs(false);
    setCatalogError("");
    setError("");
    setSpeciesQuery("");
    setBackgroundQuery("");
    setClassQuery("");
    setFeatQuery("");
    setFeatToAdd("");
    setTagInput("");
    setRolls(nextRolls);
    setAllocation(defaultRollAllocation(nextRolls));
    setDetail(null);
  }

  function handleClose() {
    if (creating) return;
    resetForm();
    onClose?.();
  }

  function chooseSpecies(option) {
    const staticKey = SPECIES_DEFINITIONS[option.key] ? option.key : "custom";
    patch({
      speciesOptionId: option.id,
      speciesKey: staticKey,
      customSpecies: staticKey === "custom" ? option.name : "",
      lineage: "",
      size: speciesDefaultCharacterSize(option),
    });
    setDetail({ type: "species", option });
  }

  function chooseBackground(option) {
    patch({
      backgroundOptionId: option.id,
      backgroundKey: "custom",
      customBackground: option.name,
      backgroundBoosts: { mode: "twoOne", plusTwo: "", plusOne: "", plusOnes: [], allowAny: true },
    });
    setDetail({ type: "background", option });
  }

  function chooseClass(option) {
    const staticKey = CLASS_DEFINITIONS[option.class_key] ? option.class_key : "civilian";
    patch({
      classOptionId: option.id,
      classKey: staticKey,
      selectedClassSkills: [],
      expertiseSkills: [],
      baseAbilities: standardScoresForClass(option),
    });
    setDetail({ type: "class", option });
  }

  function rerollScores() {
    if (typeof window !== "undefined" && !window.confirm("Roll all six ability scores again? The current roll pool will be replaced.")) return;
    setRolls(rollAbilityPool());
    patch({ abilityMethod: "rolled" });
  }

  function allocateRoll(ability, rollId) {
    setAllocation((current) => {
      const next = { ...current };
      const prior = next[ability];
      const other = ABILITY_KEYS.find((key) => key !== ability && next[key] === rollId);
      next[ability] = rollId;
      if (other) next[other] = prior;
      return next;
    });
    setDetail({ type: "ability", key: ability });
    setError("");
  }

  function setAbility(key, value) {
    setDraft((current) => ({
      ...current,
      abilityMethod: "manual",
      baseAbilities: { ...(current.baseAbilities || {}), [key]: Math.max(1, Math.min(30, Number(value) || 1)) },
    }));
    setDetail({ type: "ability", key });
    setError("");
  }

  function setBackgroundBoost(field, value) {
    setDraft((current) => ({ ...current, backgroundBoosts: { ...(current.backgroundBoosts || {}), [field]: value, allowAny: true } }));
    setError("");
  }

  function togglePlusOne(ability) {
    setDraft((current) => {
      const selected = uniqueText(current.backgroundBoosts?.plusOnes || []);
      const next = selected.includes(ability) ? selected.filter((key) => key !== ability) : selected.length < 3 ? [...selected, ability] : selected;
      return { ...current, backgroundBoosts: { ...(current.backgroundBoosts || {}), mode: "three", plusOnes: next, allowAny: true } };
    });
    setDetail({ type: "ability", key: ability });
    setError("");
  }

  function toggleClassSkill(skillKey) {
    setDraft((current) => {
      const selected = uniqueText(current.selectedClassSkills || []);
      const next = selected.includes(skillKey)
        ? selected.filter((key) => key !== skillKey)
        : selected.length < classSkillConfig.count ? [...selected, skillKey] : selected;
      return { ...current, selectedClassSkills: next };
    });
    setDetail({ type: "skill", key: skillKey });
    setError("");
  }

  function toggleExpertise(skillKey) {
    setDraft((current) => {
      const selected = new Set(current.expertiseSkills || []);
      if (selected.has(skillKey)) selected.delete(skillKey);
      else selected.add(skillKey);
      return { ...current, expertiseSkills: [...selected] };
    });
    setDetail({ type: "skill", key: skillKey });
  }

  function setProfession(professionKey, field, value) {
    setDraft((current) => ({
      ...current,
      professions: {
        ...(current.professions || {}),
        [professionKey]: {
          ...(current.professions?.[professionKey] || {}),
          [field]: value,
          ...(field === "rank" && Number(value) === 0 ? { offersService: false } : {}),
        },
      },
    }));
    setDetail({ type: "profession", key: professionKey });
    setError("");
  }

  function addFeat() {
    const option = featOptions.find((row) => row.id === featToAdd);
    if (!option) return;
    patch({ additionalFeats: uniqueText([...(draft.additionalFeats || []), option.name]) });
    setFeatToAdd("");
  }

  function addTag() {
    const value = safeText(tagInput).toLowerCase();
    if (!value) return;
    patch({ tags: uniqueText([...(draft.tags || []), value]) });
    setTagInput("");
  }

  function generateName() {
    const name = generateNpcName({ species: selectedSpecies?.name || draft.customSpecies, gender: draft.gender });
    patch({ name });
  }

  function stepErrors(index) {
    const errors = [];
    if (index === 0) {
      if (!selectedSpecies) errors.push("Choose a species.");
      if (draft.alignment && !ALIGNMENT_OPTIONS.some((option) => option.key === String(draft.alignment).toUpperCase())) errors.push("Choose a valid alignment.");
      if (!safeText(draft.languagesText)) errors.push("Add at least one language.");
    }
    if (index === 1) {
      if (!selectedBackground) errors.push("Choose a background.");
    }
    if (index === 2) {
      if (!selectedClass) errors.push("Choose a class or No Adventuring Class.");
      if (Number(draft.level || 0) < 1 || Number(draft.level || 0) > 20) errors.push("Level must be between 1 and 20.");
    }
    if (index === 3) {
      if (draft.abilityMethod === "rolled" && ABILITY_KEYS.some((key) => !allocation[key])) errors.push("Assign all six rolled totals.");
      const boosts = draft.backgroundBoosts || {};
      if (boosts.mode === "three") {
        if (uniqueText(boosts.plusOnes || []).filter((key) => ABILITY_KEYS.includes(key)).length !== 3) errors.push("Choose three different +1 abilities.");
      } else if (!ABILITY_KEYS.includes(boosts.plusTwo) || !ABILITY_KEYS.includes(boosts.plusOne) || boosts.plusTwo === boosts.plusOne) {
        errors.push("Choose different abilities for the +2 and +1 increases.");
      }
    }
    if (index === 4) {
      if ((draft.selectedClassSkills || []).length !== classSkillConfig.count) errors.push(`Choose exactly ${classSkillConfig.count} class skill${classSkillConfig.count === 1 ? "" : "s"}.`);
      PROFESSION_KEYS.forEach((key) => {
        const profession = draft.professions?.[key] || {};
        if (profession.offersService && Number(profession.rank || 0) === 0) errors.push(`${PROFESSION_DEFINITIONS[key].label} must be trained before this NPC can offer it as a service.`);
      });
    }
    if (index === 6) {
      if (!safeText(draft.name)) errors.push("Enter or generate a name.");
      if (!safeText(draft.role)) errors.push("Enter a role or title so the roster remains useful.");
    }
    return errors;
  }

  function handleNext() {
    const errors = stepErrors(step);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    setStep((current) => Math.min(STEP_LABELS.length - 1, current + 1));
    setDetail(null);
  }

  function handleBack() {
    setError("");
    setStep((current) => Math.max(0, current - 1));
    setDetail(null);
  }

  async function handleCreate() {
    if (creating) return;
    const errors = STEP_LABELS.flatMap((_label, index) => stepErrors(index));
    if (errors.length) {
      setError(uniqueText(errors).join(" "));
      return;
    }
    setCreating(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_character_v1", { p_payload: createPayload });
      if (rpcError) throw rpcError;
      const createdId = typeof data === "string" ? data : data?.id || data?.character_id || null;
      const created = { id: createdId, kind: createPayload.kind, name: createPayload.name };
      resetForm();
      await onCreated?.(created);
    } catch (err) {
      setCreating(false);
      setError(String(err?.message || err || "Failed to create character."));
    }
  }

  if (!show) return null;

  return (
    <div className="npc-forge-backdrop" role="presentation">
      <div className="npc-forge-modal npc-forge-modal-v2" role="dialog" aria-modal="true" aria-labelledby="npc-forge-title">
        <header className="npc-forge-header">
          <div>
            <div className="npc-forge-kicker">Canonical character system</div>
            <h2 id="npc-forge-title">NPC Forge</h2>
            <p>Build the rules first, then finish identity and placement. The right column explains the choice currently being made.</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={handleClose} disabled={creating}>Close</button>
        </header>

        <nav className="npc-forge-steps" aria-label="NPC creation steps">
          {STEP_LABELS.map((label, index) => (
            <button key={label} type="button" className={`${index === step ? "is-current" : ""} ${index < step ? "is-complete" : ""}`} onClick={() => { if (index <= step) { setStep(index); setDetail(null); setError(""); } }} disabled={creating || index > step}>
              <span>{index + 1}</span>{label}
            </button>
          ))}
        </nav>

        <div className="npc-forge-body">
          <section className="npc-forge-workspace">
            {catalogError ? <div className="npc-forge-catalog-warning">{catalogError}</div> : null}

            {step === 0 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Species</span><h3>Choose ancestry and innate traits</h3></div><p>{loadingCatalogs ? "Loading source catalog…" : `${speciesOptions.length} species available.`}</p></div>
                <CatalogList label="Species" query={speciesQuery} onQuery={setSpeciesQuery} rows={filteredSpecies} selectedId={draft.speciesOptionId} onSelect={chooseSpecies} emptyText="No species match this search." />
                <div className="npc-forge-form-grid mt-3">
                  {selectedSpecies?.lineages?.length ? <label><span>Lineage / ancestry</span><select value={draft.lineage} onChange={(event) => patch({ lineage: event.target.value })}><option value="">Choose lineage</option>{selectedSpecies.lineages.map((lineage) => <option key={lineage} value={lineage}>{lineage}</option>)}</select></label> : null}
                  <label><span>Gender presentation</span><select value={draft.gender} onChange={(event) => patch({ gender: event.target.value })}><option value="female">Female</option><option value="male">Male</option><option value="neutral">Nonbinary / neutral</option></select></label>
                  <label><span>Size</span><select value={draft.size} onChange={(event) => patch({ size: event.target.value })}><option value="">Species default</option>{SIZE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
                  <label><span>Alignment</span><select value={draft.alignment} onChange={(event) => patch({ alignment: event.target.value })}>{ALIGNMENT_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
                  <label className="wide"><span>Languages</span><input value={draft.languagesText} onChange={(event) => patch({ languagesText: event.target.value })} placeholder="Common, Elvish, Dwarvish" /></label>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Background</span><h3>Choose a formative background</h3></div><p>{loadingCatalogs ? "Loading source catalog…" : `${backgroundOptions.length} backgrounds available.`}</p></div>
                <CatalogList label="Backgrounds" query={backgroundQuery} onQuery={setBackgroundQuery} rows={filteredBackgrounds} selectedId={draft.backgroundOptionId} onSelect={chooseBackground} emptyText="No backgrounds match this search." />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Class</span><h3>Adventuring progression</h3></div><p>Preferred 2024 versions appear first; classes without a 2024 version remain available.</p></div>
                <div className="npc-forge-level-row">
                  <label><span>Level</span><input type="number" min="1" max="20" value={draft.level} onChange={(event) => patch({ level: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })} /></label>
                  <div><span>Proficiency bonus</span><strong>+{proficiencyBonus(draft.level)}</strong></div>
                  <div><span>Hit Dice</span><strong>{draft.level}d{classHitDie}</strong></div>
                  <div><span>Expected HP</span><strong>{dynamicHp}</strong></div>
                </div>
                <CatalogList label="Classes" query={classQuery} onQuery={setClassQuery} rows={filteredClasses} selectedId={draft.classOptionId} onSelect={chooseClass} emptyText="No classes match this search." />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Abilities</span><h3>Generate and allocate ability scores</h3></div><p>Roll six totals, then assign each total to exactly one ability.</p></div>
                <div className="npc-forge-segmented">
                  <button type="button" className={draft.abilityMethod === "rolled" ? "is-active" : ""} onClick={() => patch({ abilityMethod: "rolled" })}>4d6 drop lowest</button>
                  <button type="button" className={draft.abilityMethod === "standard" ? "is-active" : ""} onClick={() => patch({ abilityMethod: "standard", baseAbilities: standardScoresForClass(selectedClass) })}>Class standard array</button>
                  <button type="button" className={draft.abilityMethod === "manual" ? "is-active" : ""} onClick={() => patch({ abilityMethod: "manual" })}>Manual</button>
                  {draft.abilityMethod === "rolled" ? <button type="button" onClick={rerollScores}>Reroll all six</button> : null}
                </div>

                {draft.abilityMethod === "rolled" ? (
                  <>
                    <div className="npc-forge-roll-pool mt-3">{rolls.map((roll) => <DiceSummary key={roll.id} roll={roll} />)}</div>
                    <div className="npc-forge-allocation-grid mt-3">
                      {ABILITY_KEYS.map((key) => (
                        <label key={key} onMouseEnter={() => setDetail({ type: "ability", key })}>
                          <span>{ABILITY_LABELS[key]}</span>
                          <select value={allocation[key] || ""} onChange={(event) => allocateRoll(key, event.target.value)}>
                            <option value="">Choose roll</option>
                            {rolls.map((roll, index) => <option key={roll.id} value={roll.id}>Roll {index + 1}: {roll.total}</option>)}
                          </select>
                          <strong>{baseAbilities[key]} <small>{modifierLabel(finalAbilities[key])}</small></strong>
                        </label>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="npc-forge-ability-grid mt-3">
                    {ABILITY_KEYS.map((key) => <label key={key} onMouseEnter={() => setDetail({ type: "ability", key })}><span>{ABILITY_LABELS[key]}</span><input type="number" min="1" max="30" value={draft.baseAbilities?.[key] ?? 10} readOnly={draft.abilityMethod === "standard"} onChange={(event) => setAbility(key, event.target.value)} /><small>Final {finalAbilities[key]} ({modifierLabel(finalAbilities[key])})</small></label>)}
                  </div>
                )}

                <div className="npc-forge-subheading mt-4">Ability increases <small>Suggested by {selectedBackground?.name || "background"}, but campaign placement is flexible.</small></div>
                <div className="npc-forge-segmented compact">
                  <button type="button" className={draft.backgroundBoosts?.mode !== "three" ? "is-active" : ""} onClick={() => setBackgroundBoost("mode", "twoOne")}>+2 and +1</button>
                  <button type="button" className={draft.backgroundBoosts?.mode === "three" ? "is-active" : ""} onClick={() => setBackgroundBoost("mode", "three")}>Three +1s</button>
                </div>
                {draft.backgroundBoosts?.mode === "three" ? (
                  <div className="npc-forge-choice-grid three mt-2">{ABILITY_KEYS.map((key) => <button key={key} type="button" className={`npc-forge-ability-choice ${(draft.backgroundBoosts?.plusOnes || []).includes(key) ? "is-active" : ""} ${(selectedBackground?.recommendedAbilities || []).includes(key) ? "is-recommended" : ""}`} onClick={() => togglePlusOne(key)}><strong>{ABILITY_LABELS[key]}</strong><span>+1</span></button>)}</div>
                ) : (
                  <div className="npc-forge-form-grid mt-2">
                    <label><span>Increase by 2</span><select value={draft.backgroundBoosts?.plusTwo || ""} onChange={(event) => setBackgroundBoost("plusTwo", event.target.value)}><option value="">Choose ability</option>{ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}{(selectedBackground?.recommendedAbilities || []).includes(key) ? " — suggested" : ""}</option>)}</select></label>
                    <label><span>Increase by 1</span><select value={draft.backgroundBoosts?.plusOne || ""} onChange={(event) => setBackgroundBoost("plusOne", event.target.value)}><option value="">Choose ability</option>{ABILITY_KEYS.map((key) => <option key={key} value={key}>{ABILITY_LABELS[key]}{(selectedBackground?.recommendedAbilities || []).includes(key) ? " — suggested" : ""}</option>)}</select></label>
                  </div>
                )}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Training</span><h3>Skills, expertise, and professions</h3></div><p>Select any entry to read its purpose in the information panel.</p></div>
                <div className="npc-forge-subheading">Background skills</div>
                <div className="npc-forge-chip-row">{backgroundSkills.length ? backgroundSkills.map((key) => <button key={key} type="button" className="is-fixed" onClick={() => setDetail({ type: "skill", key })}>{titleForSkill(key)}</button>) : <span className="is-fixed">No fixed skills listed</span>}</div>
                <div className="npc-forge-subheading mt-4">Class skills <small>{(draft.selectedClassSkills || []).length}/{classSkillConfig.count}</small></div>
                <div className="npc-forge-skill-grid">
                  {classSkillConfig.options.map((key) => {
                    const selected = (draft.selectedClassSkills || []).includes(key);
                    const backgroundGranted = backgroundSkills.includes(key);
                    return <button key={key} type="button" className={`${selected ? "is-active" : ""} ${backgroundGranted ? "is-background" : ""}`} onClick={() => backgroundGranted ? setDetail({ type: "skill", key }) : toggleClassSkill(key)}><span>{titleForSkill(key)}</span><small>{backgroundGranted ? "Background" : selected ? "Selected" : "Available"}</small></button>;
                  })}
                </div>
                <div className="npc-forge-subheading mt-4">Expertise <small>optional</small></div>
                <div className="npc-forge-chip-row">{selectedSkillKeys.map((key) => <button key={key} type="button" className={(draft.expertiseSkills || []).includes(key) ? "is-active" : ""} onClick={() => toggleExpertise(key)}>{titleForSkill(key)}</button>)}</div>
                <div className="npc-forge-subheading mt-4">Professions</div>
                <div className="npc-forge-profession-list">
                  {PROFESSION_KEYS.map((key) => {
                    const definition = PROFESSION_DEFINITIONS[key];
                    const profession = draft.professions?.[key] || EMPTY_PROFESSIONS[key];
                    return <div key={key} className={`npc-forge-profession ${profession.offersService ? "is-provider" : ""}`} onMouseEnter={() => setDetail({ type: "profession", key })}><div><strong>{definition.label}</strong><small>{definition.tool}</small></div><label><span>Rank</span><select value={profession.rank} onChange={(event) => setProfession(key, "rank", Number(event.target.value))}><option value={0}>Untrained</option><option value={1}>Proficient</option><option value={2}>Expertise</option></select></label><label><span>Ability</span><select value={profession.ability} onChange={(event) => setProfession(key, "ability", event.target.value)}>{definition.abilities.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}</select></label><label className="npc-forge-service-toggle"><input type="checkbox" checked={Boolean(profession.offersService)} disabled={Number(profession.rank || 0) === 0} onChange={(event) => setProfession(key, "offersService", event.target.checked)} /><span>Offers workshop service</span></label></div>;
                  })}
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Story</span><h3>Campaign hooks and usable characterization</h3></div><p>Keep visible information distinct from private motivations and secrets.</p></div>
                <div className="npc-forge-form-grid">
                  <label className="wide"><span>Description</span><textarea rows={2} value={draft.description} onChange={(event) => patch({ description: event.target.value })} placeholder="What players notice immediately." /></label>
                  <label className="wide"><span>Appearance</span><textarea rows={2} value={draft.appearance} onChange={(event) => patch({ appearance: event.target.value })} placeholder="Age, clothing, posture, notable marks, aura, or monster traits." /></label>
                  <label className="wide"><span>Background narrative</span><textarea rows={2} value={draft.backgroundNarrative} onChange={(event) => patch({ backgroundNarrative: event.target.value })} /></label>
                  <label><span>Motivation / want</span><textarea rows={2} value={draft.motivation} onChange={(event) => patch({ motivation: event.target.value })} /></label>
                  <label><span>Personality traits</span><textarea rows={2} value={draft.personalityTraits} onChange={(event) => patch({ personalityTraits: event.target.value })} /></label>
                  <label><span>Ideals</span><textarea rows={2} value={draft.ideals} onChange={(event) => patch({ ideals: event.target.value })} /></label>
                  <label><span>Bonds</span><textarea rows={2} value={draft.bonds} onChange={(event) => patch({ bonds: event.target.value })} /></label>
                  <label><span>Flaws</span><textarea rows={2} value={draft.flaws} onChange={(event) => patch({ flaws: event.target.value })} /></label>
                  <label><span>Quirk</span><textarea rows={2} value={draft.quirk} onChange={(event) => patch({ quirk: event.target.value })} /></label>
                  <label><span>Mannerism</span><textarea rows={2} value={draft.mannerism} onChange={(event) => patch({ mannerism: event.target.value })} /></label>
                  <label><span>Voice</span><textarea rows={2} value={draft.voice} onChange={(event) => patch({ voice: event.target.value })} /></label>
                  <label className="wide"><span>Secret</span><textarea rows={2} value={draft.secret} onChange={(event) => patch({ secret: event.target.value })} /></label>
                  <label className="wide"><span>Attacks & actions</span><textarea rows={3} value={draft.attacks} onChange={(event) => patch({ attacks: event.target.value })} placeholder="Concise attacks, actions, reactions, or combat notes." /></label>
                  <label className="wide"><span>Equipment</span><textarea rows={2} value={draft.equipment} onChange={(event) => patch({ equipment: event.target.value })} placeholder="Armor, weapons, tools, trinkets, travel gear, or shop gear." /></label>
                  <label><span>Treasure / coin</span><input value={draft.treasure} onChange={(event) => patch({ treasure: event.target.value })} placeholder="50 GP, signet ring, ledger..." /></label>
                  {selectedClass?.spellcasting_ability ? <label className="wide"><span>Prepared spells / spell notes</span><textarea rows={3} value={draft.preparedSpellsText} onChange={(event) => patch({ preparedSpellsText: event.target.value })} placeholder="The automatic NPC spellbook pass will replace this free-text bridge." /></label> : null}
                </div>
                <div className="npc-forge-subheading mt-4">Additional feats</div>
                <input className="npc-forge-search mb-2" value={featQuery} onChange={(event) => setFeatQuery(event.target.value)} placeholder="Search imported feats…" />
                <div className="npc-forge-add-row"><select value={featToAdd} onChange={(event) => setFeatToAdd(event.target.value)}><option value="">Choose feat</option>{filteredFeats.map((feat) => <option key={feat.id} value={feat.id}>{feat.name} • {sourceLabel(feat.source)}</option>)}</select><button type="button" onClick={addFeat} disabled={!featToAdd}>Add</button></div>
                <div className="npc-forge-chip-row mt-2">{originFeat !== "None listed" ? <span className="is-fixed">{originFeat}</span> : null}{(draft.additionalFeats || []).map((feat) => <button key={feat} type="button" onClick={() => patch({ additionalFeats: draft.additionalFeats.filter((value) => value !== feat) })}>{feat} ×</button>)}</div>
              </div>
            ) : null}

            {step === 6 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Identity & placement</span><h3>Name the finished character</h3></div><p>Name generation considers the selected species and gender presentation.</p></div>
                <div className="npc-forge-choice-grid two">
                  <button type="button" className={`npc-forge-choice ${draft.kind === "npc" ? "is-active" : ""}`} onClick={() => patch({ kind: "npc", storefrontEnabled: false })}><span className="npc-forge-choice-head"><strong>NPC</strong></span><span className="npc-forge-choice-body">Resident, ruler, enemy, ally, quest figure, or workshop provider.</span></button>
                  <button type="button" className={`npc-forge-choice ${draft.kind === "merchant" ? "is-active" : ""}`} onClick={() => patch({ kind: "merchant", storefrontEnabled: true })}><span className="npc-forge-choice-head"><strong>Merchant</strong></span><span className="npc-forge-choice-body">The same character model with storefront and stock capabilities.</span></button>
                </div>
                <div className="npc-forge-form-grid mt-3">
                  <label className="wide"><span>Name *</span><div className="npc-forge-name-row"><input value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Marta Ironroot" /><button type="button" onClick={generateName}>Generate for {selectedSpecies?.name || "species"}</button></div></label>
                  <label><span>Role / title *</span><input value={draft.role} onChange={(event) => patch({ role: event.target.value })} placeholder="Master Armorer" /></label>
                  <label><span>Affiliation</span><input value={draft.affiliation} onChange={(event) => patch({ affiliation: event.target.value })} placeholder="Gray Hall Smiths' Guild" /></label>
                </div>
                <div className="npc-forge-subheading mt-4">Roster tags</div>
                <div className="npc-forge-add-row"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder="guild, guard, ally, villain..." /><button type="button" onClick={addTag}>Add</button></div>
                <div className="npc-forge-chip-row mt-2">{(draft.tags || []).map((tag) => <button key={tag} type="button" onClick={() => patch({ tags: draft.tags.filter((value) => value !== tag) })}>{tag} ×</button>)}</div>
                <div className="npc-forge-subheading mt-4">Placement</div>
                <div className="npc-forge-form-grid">
                  <label><span>Starting location</span><select value={draft.locationId} onChange={(event) => patch({ locationId: event.target.value })}><option value="">Not listed</option>{(locations || []).map((location) => <option key={String(location.id)} value={String(location.id)}>{location.name}</option>)}</select></label>
                  <div className="npc-forge-callout"><strong>Off-map by default</strong><span>The creator assigns identity and location only. It does not alter routes, movement, sprites, or world-map behavior.</span></div>
                </div>
                {draft.kind === "merchant" ? <div className="npc-forge-merchant-box mt-4"><label className="npc-forge-service-toggle"><input type="checkbox" checked={Boolean(draft.storefrontEnabled)} onChange={(event) => patch({ storefrontEnabled: event.target.checked })} /><span>Enable storefront</span></label>{draft.storefrontEnabled ? <div className="npc-forge-form-grid mt-2"><label><span>Store title</span><input value={draft.storefrontTitle} onChange={(event) => patch({ storefrontTitle: event.target.value })} placeholder={`${draft.name || "Merchant"}'s Shop`} /></label><label><span>Store tagline</span><input value={draft.storefrontTagline} onChange={(event) => patch({ storefrontTagline: event.target.value })} placeholder="A concise shop description" /></label></div> : null}</div> : null}
              </div>
            ) : null}

            {step === 7 ? (
              <div className="npc-forge-section">
                <div className="npc-forge-section-heading"><div><span>Review</span><h3>Confirm the canonical character</h3></div><p>The character and sheet are created atomically. A partial NPC cannot be left behind.</p></div>
                <div className="npc-forge-review-hero"><div><span>{draft.kind === "merchant" ? "Merchant" : "NPC"}</span><h3>{createPayload.name}</h3><p>{createPayload.race} • {createPayload.role}{createPayload.affiliation ? ` • ${createPayload.affiliation}` : ""}</p></div><div><strong>Level {draft.level}</strong><span>{selectedClass?.class_name}</span></div></div>
                <div className="npc-forge-review-grid mt-3">
                  <article><span>Origin</span><strong>{selectedSpecies?.name}</strong><p>{selectedBackground?.name} • {sourceLabel(selectedBackground?.source)} • {originFeat}</p></article>
                  <article><span>Class</span><strong>{selectedClass?.class_name} level {draft.level}</strong><p>PB +{proficiencyBonus(draft.level)} • {dynamicHp} HP • {draft.level}d{classHitDie}</p></article>
                  <article><span>Training</span><strong>{selectedSkillKeys.length} trained skills</strong><p>{selectedSkillKeys.map(titleForSkill).join(", ") || "None"}</p></article>
                  <article><span>Workshops</span><strong>{selectedProfessionServices.length ? selectedProfessionServices.map((key) => PROFESSION_DEFINITIONS[key].label).join(", ") : "No services"}</strong><p>Only explicitly enabled services appear as workshop providers.</p></article>
                  <article><span>Feats</span><strong>{createPayload.sheet.feats.length || 0}</strong><p>{createPayload.sheet.feats.join(", ") || "None"}</p></article>
                  <article><span>Placement</span><strong>{(locations || []).find((location) => String(location.id) === String(draft.locationId))?.name || "Not listed"}</strong><p>Created off-map. {draft.kind === "merchant" && draft.storefrontEnabled ? "Storefront enabled." : "No storefront."}</p></article>
                </div>
                <div className="npc-forge-final-abilities mt-3">{ABILITY_KEYS.map((key) => <div key={key}><span>{key.toUpperCase()}</span><strong>{finalAbilities[key]}</strong><small>{modifierLabel(finalAbilities[key])}</small></div>)}</div>
                <details className="npc-forge-json mt-3"><summary>Review generated sheet JSON</summary><pre>{JSON.stringify(createPayload.sheet, null, 2)}</pre></details>
              </div>
            ) : null}
          </section>

          <aside className="npc-forge-preview npc-forge-context-panel">
            <NpcForgeContextPanel
              step={step}
              detail={detail}
              selectedSpecies={selectedSpecies}
              selectedBackground={selectedBackground}
              backgroundMechanicDetails={backgroundMechanicDetails}
              selectedClass={selectedClass}
              selectedSkill={selectedSkill}
              selectedProfession={selectedProfession}
              rolls={rolls}
              allocation={allocation}
              finalAbilities={finalAbilities}
              draft={draft}
            />
          </aside>
        </div>

        {error ? <div className="npc-forge-error" role="alert">{error}</div> : null}

        <footer className="npc-forge-footer">
          <button type="button" className="btn btn-outline-light" onClick={handleClose} disabled={creating}>Cancel</button>
          <div>
            {step > 0 ? <button type="button" className="btn btn-outline-light" onClick={handleBack} disabled={creating}>Back</button> : null}
            {step < STEP_LABELS.length - 1 ? <button type="button" className="btn btn-primary" onClick={handleNext} disabled={creating || loadingCatalogs}>Continue</button> : <button type="button" className="btn btn-success" onClick={handleCreate} disabled={creating}>{creating ? "Forging Character..." : `Create ${draft.kind === "merchant" ? "Merchant" : "NPC"}`}</button>}
          </div>
        </footer>
      </div>
    </div>
  );
}

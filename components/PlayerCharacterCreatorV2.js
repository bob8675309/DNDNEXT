import { useEffect, useMemo, useState } from "react";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  ALIGNMENT_OPTIONS,
  BACKGROUND_DEFINITIONS,
  BACKGROUND_KEYS,
  CLASS_DEFINITIONS,
  FEAT_OPTIONS,
  SKILL_DEFINITIONS,
  SPECIES_DEFINITIONS,
  SPECIES_KEYS,
  buildCharacterCreatePayload,
} from "../utils/characterCreation";
import {
  ABILITY_DESCRIPTIONS,
  BACKGROUND_SUMMARIES,
  FALLBACK_SKILL_DESCRIPTIONS,
  SPECIES_SUMMARIES,
  abilityScoresFromRollAllocation,
  classSkillConfiguration,
  defaultRollAllocation,
  flexibleAbilityBoosts,
  normalizeSkillKey,
  rollAbilityPool,
  sourceDisplayName,
  startingSpellRequirements,
} from "../utils/characterCreationGuidance";
import { spellLevelLabel } from "../utils/spells/classSpellbookRules";
import { supabase } from "../utils/supabaseClient";

const STEPS = ["Identity", "Origin", "Class & Skills", "Ability Rolls", "Feats", "Spells", "Review"];

function safeText(value) {
  return String(value ?? "").trim();
}

function slug(value) {
  return safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueText(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(safeText).filter(Boolean))];
}

function abilityModifier(score) {
  return Math.floor((Number(score || 10) - 10) / 2);
}

function modifierLabel(score) {
  const value = abilityModifier(score);
  return value >= 0 ? `+${value}` : String(value);
}

function skillLabel(key) {
  return SKILL_DEFINITIONS.find((skill) => skill.key === key)?.label || key;
}

function staticBackgroundChoices() {
  return BACKGROUND_KEYS.map((key) => ({
    id: `static-background-${key}`,
    key,
    name: BACKGROUND_DEFINITIONS[key].label,
    source: "XPHB",
    description: BACKGROUND_SUMMARIES[key] || "A standard campaign background.",
    recommendedAbilities: BACKGROUND_DEFINITIONS[key].abilities || ABILITY_KEYS,
    originFeat: BACKGROUND_DEFINITIONS[key].feat || "",
    metadata: {},
    isStatic: true,
  }));
}

function staticSpeciesChoices() {
  return SPECIES_KEYS.map((key) => ({
    id: `static-species-${key}`,
    key,
    name: SPECIES_DEFINITIONS[key].label,
    source: "XPHB",
    description: SPECIES_SUMMARIES[key] || (SPECIES_DEFINITIONS[key].traits || []).join(", "),
    traits: SPECIES_DEFINITIONS[key].traits || [],
    lineages: SPECIES_DEFINITIONS[key].lineages || [],
    speed: SPECIES_DEFINITIONS[key].speed || 30,
    metadata: {},
    isStatic: true,
  }));
}

function staticFeatChoices() {
  return FEAT_OPTIONS
    .filter((feat) => feat.name !== "Ability Score Improvement")
    .map((feat) => ({
      id: `static-feat-${slug(feat.name)}-${feat.category}`,
      name: feat.name,
      source: "XPHB",
      category: feat.category,
      description: `${feat.category} feat. Detailed source text appears after the character-option catalog is imported.`,
      prerequisite_text: feat.minimumLevel > 1 ? `Level ${feat.minimumLevel}+` : "",
      metadata: { minimumLevel: feat.minimumLevel, repeatable: Boolean(feat.repeatable) },
      isStatic: true,
    }));
}

function extractAbilityChoices(metadata = {}) {
  const found = new Set();
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object") return;
    if (Array.isArray(node.from)) node.from.filter((key) => ABILITY_KEYS.includes(key)).forEach((key) => found.add(key));
    ABILITY_KEYS.forEach((key) => { if (node[key] != null) found.add(key); });
    Object.values(node).forEach(walk);
  }
  walk(metadata.abilities || metadata.ability || []);
  return found.size ? [...found] : ABILITY_KEYS;
}

function extractBackgroundSkills(metadata = {}) {
  const found = new Set();
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object") return;
    Object.entries(node).forEach(([key, value]) => {
      const normalized = normalizeSkillKey(key);
      if (normalized && (value === true || Number(value) > 0)) found.add(normalized);
      if (typeof value === "object") walk(value);
    });
  }
  walk(metadata.skills || []);
  return [...found];
}

function extractBackgroundFeat(metadata = {}) {
  const feats = metadata.feats;
  if (!Array.isArray(feats)) return "";
  for (const entry of feats) {
    if (typeof entry === "string") return entry.split("|")[0];
    if (entry && typeof entry === "object") {
      const name = Object.keys(entry).find((key) => entry[key]);
      if (name) return name.split("|")[0];
    }
  }
  return "";
}

function normalizeImportedBackground(row) {
  return {
    id: row.id,
    key: slug(row.name),
    name: row.name,
    source: row.source,
    description: row.description || "No source description is available.",
    recommendedAbilities: extractAbilityChoices(row.metadata || {}),
    originFeat: extractBackgroundFeat(row.metadata || {}),
    backgroundSkills: extractBackgroundSkills(row.metadata || {}),
    metadata: row.metadata || {},
    isStatic: false,
  };
}

function normalizeImportedSpecies(row) {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    key: slug(row.name),
    name: row.name,
    source: row.source,
    description: row.description || "No source description is available.",
    lore: safeText(metadata.lore),
    traits: Array.isArray(metadata.traits) ? metadata.traits.map((entry) => typeof entry === "string" ? entry : entry?.name).filter(Boolean) : [],
    lineages: metadata.lineage ? [metadata.lineage] : [],
    speed: Number(metadata.speed?.walk || metadata.speed || 30),
    metadata,
    isStatic: false,
  };
}

function classMatchesSpell(spell, classRow) {
  const className = slug(classRow?.class_name);
  const classKey = slug(classRow?.class_key);
  return (spell?.classes || []).some((value) => {
    const candidate = slug(value);
    return candidate === className || candidate === classKey;
  });
}

function spellSort(a, b) {
  return Number(a?.level || 0) - Number(b?.level || 0) || safeText(a?.name).localeCompare(safeText(b?.name));
}

function selectedSpellCounts(spells, selections) {
  let cantrips = 0;
  let leveled = 0;
  let prepared = 0;
  spells.forEach((spell) => {
    const selection = selections[spell.id];
    if (!selection) return;
    if (Number(spell.level || 0) === 0) cantrips += 1;
    else {
      leveled += 1;
      if (selection.prepared) prepared += 1;
    }
  });
  return { cantrips, leveled, prepared };
}

function initialDraft(defaultName = "") {
  return {
    name: safeText(defaultName),
    alignment: "N",
    appearance: "",
    description: "",
    languagesText: "Common",
    speciesChoiceId: "",
    customSpecies: "",
    lineage: "",
    size: "Medium",
    backgroundChoiceId: "",
    customBackground: "",
    classId: "",
    selectedClassSkills: [],
    backgroundBoosts: { mode: "twoOne", plusTwo: "str", plusOne: "dex", plusOnes: [], allowAny: true },
    humanOriginFeatId: "",
    campaignBonusFeatId: "",
    personalityTraits: "",
    ideals: "",
    bonds: "",
    flaws: "",
    motivation: "",
    quirk: "",
  };
}

function finalPayload({ draft, selectedClass, selectedSpecies, selectedBackground, baseScores, finalScores, selectedSkills, bonusFeatNames }) {
  const staticClassKey = CLASS_DEFINITIONS[selectedClass?.class_key] ? selectedClass.class_key : "civilian";
  const staticSpeciesKey = selectedSpecies?.isStatic && SPECIES_DEFINITIONS[selectedSpecies.key] ? selectedSpecies.key : "custom";
  const staticBackgroundKey = selectedBackground?.isStatic && BACKGROUND_DEFINITIONS[selectedBackground.key] ? selectedBackground.key : "custom";
  const baseDraft = {
    ...draft,
    kind: "npc",
    classKey: staticClassKey,
    level: 1,
    speciesKey: staticSpeciesKey,
    customSpecies: staticSpeciesKey === "custom" ? selectedSpecies?.name || draft.customSpecies : "",
    backgroundKey: staticBackgroundKey,
    customBackground: staticBackgroundKey === "custom" ? selectedBackground?.name || draft.customBackground : "",
    baseAbilities: baseScores,
    backgroundBoosts: { ...draft.backgroundBoosts, allowAny: true },
    selectedClassSkills: CLASS_DEFINITIONS[staticClassKey]?.skillOptions?.includes(selectedSkills[0]) ? selectedSkills : [],
    additionalFeats: bonusFeatNames,
    role: selectedClass?.class_name || "Adventurer",
    tags: ["player-character"],
    storefrontEnabled: false,
    backgroundNarrative: selectedBackground?.description || "",
  };
  const payload = buildCharacterCreatePayload(baseDraft);
  const conModifier = abilityModifier(finalScores.con);
  const hitDie = Number(selectedClass?.hit_die || 8);
  const maximumHp = Math.max(1, hitDie + conModifier);
  const classSavingThrows = Array.isArray(selectedClass?.saving_throws) ? selectedClass.saving_throws : [];
  const backgroundSkills = selectedBackground?.backgroundSkills || (selectedBackground?.isStatic ? BACKGROUND_DEFINITIONS[selectedBackground.key]?.skills || [] : []);
  const proficientSkills = new Set([...backgroundSkills, ...selectedSkills]);
  const originFeat = selectedBackground?.originFeat || (selectedBackground?.isStatic ? BACKGROUND_DEFINITIONS[selectedBackground.key]?.feat || "" : "");
  const feats = uniqueText([originFeat, ...bonusFeatNames]);
  const speciesTraits = uniqueText(selectedSpecies?.traits || []);
  const spellAbility = selectedClass?.spellcasting_ability || null;
  const proficiencyBonus = 2;

  payload.name = safeText(draft.name);
  payload.race = selectedSpecies?.name || "Custom Species";
  payload.role = selectedClass?.class_name || "Adventurer";
  payload.description = safeText(draft.description) || null;
  payload.background = selectedBackground?.name || "Custom Background";
  payload.motivation = safeText(draft.motivation) || null;
  payload.quirk = safeText(draft.quirk) || null;
  payload.tags = uniqueText([...(payload.tags || []), "player-character"]);
  payload.is_hidden = true;
  payload.state = "resting";
  payload.location_id = null;
  payload.home_location_id = null;

  payload.sheet = {
    ...(payload.sheet || {}),
    schemaVersion: 2,
    classKey: selectedClass.class_key,
    className: selectedClass.class_name,
    class: selectedClass.class_name,
    classSource: selectedClass.source,
    rulesetSource: selectedClass.source,
    ruleset: selectedClass.ruleset || "campaign",
    level: 1,
    species: selectedSpecies?.name || "Custom Species",
    race: selectedSpecies?.name || "Custom Species",
    lineage: safeText(draft.lineage) || null,
    size: draft.size || "Medium",
    alignment: draft.alignment,
    languages: uniqueText(safeText(draft.languagesText).split(",")),
    appearance: safeText(draft.appearance),
    background: selectedBackground?.name || "Custom Background",
    backgroundSource: selectedBackground?.source || "Campaign",
    proficiencyBonus,
    abilities: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { score: finalScores[key] }])),
    abilityRolls: { method: "4d6_drop_lowest_allocate", baseScores },
    proficiencies: {
      saves: Object.fromEntries(ABILITY_KEYS.map((key) => [key, { proficient: classSavingThrows.includes(key) }])),
      skills: Object.fromEntries(SKILL_DEFINITIONS.map((skill) => [skill.key, { proficient: proficientSkills.has(skill.key), expertise: false }])),
    },
    speed: Number(selectedSpecies?.speed || 30),
    hp: maximumHp,
    maxHp: maximumHp,
    tempHp: 0,
    hitDice: `1d${hitDie}`,
    feats,
    originFeat: originFeat || null,
    campaignBonusFeat: bonusFeatNames.find((name) => name && name !== originFeat) || null,
    speciesTraits,
    featsTraits: [
      ...feats.map((feat) => `Feat: ${feat}`),
      ...speciesTraits.map((trait) => `Species: ${trait}`),
    ].join("\n"),
    spellcasting: spellAbility ? {
      ability: spellAbility,
      abilityLabel: ABILITY_LABELS[spellAbility] || spellAbility,
      spellSaveDc: 8 + proficiencyBonus + abilityModifier(finalScores[spellAbility]),
      spellAttackBonus: proficiencyBonus + abilityModifier(finalScores[spellAbility]),
      catalogStatus: "preferred_all_sources",
    } : null,
    personality: {
      traits: safeText(draft.personalityTraits),
      ideals: safeText(draft.ideals),
      bonds: safeText(draft.bonds),
      flaws: safeText(draft.flaws),
    },
    meta: {
      ...(payload.sheet?.meta || {}),
      classKey: selectedClass.class_key,
      className: selectedClass.class_name,
      classSource: selectedClass.source,
      rulesetSource: selectedClass.source,
      ruleset: selectedClass.ruleset || "campaign",
      level: 1,
      speciesKey: selectedSpecies?.key || slug(selectedSpecies?.name),
      species: selectedSpecies?.name,
      backgroundKey: selectedBackground?.key || slug(selectedBackground?.name),
      background: selectedBackground?.name,
      creator: "player_character_creator_v2",
    },
  };
  return payload;
}

export default function PlayerCharacterCreatorV2({ defaultName = "", onCreated = null, onCancel = null }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => initialDraft(defaultName));
  const [classes, setClasses] = useState([]);
  const [levelRows, setLevelRows] = useState([]);
  const [optionRows, setOptionRows] = useState([]);
  const [spells, setSpells] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [rolls, setRolls] = useState(() => rollAbilityPool());
  const [allocation, setAllocation] = useState(() => ({}));
  const [spellSelections, setSpellSelections] = useState({});
  const [spellQuery, setSpellQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAllocation(defaultRollAllocation(rolls));
  }, [rolls]);

  useEffect(() => {
    let active = true;
    async function loadCatalogs() {
      setLoadingCatalogs(true);
      const [classResult, levelResult, optionResult, spellResult] = await Promise.all([
        supabase
          .from("class_catalog_preferred")
          .select("id,class_key,class_name,source,ruleset,edition,hit_die,primary_abilities,saving_throws,spellcasting_ability,caster_progression,summary,raw_payload")
          .order("class_name", { ascending: true }),
        supabase
          .from("class_level_progression")
          .select("class_id,class_level,cantrips_known,spells_known,spell_slots")
          .eq("class_level", 1),
        supabase
          .from("character_option_catalog_preferred")
          .select("id,option_key,option_type,name,source,category,description,prerequisite_text,tags,metadata")
          .in("option_type", ["background", "species", "skill", "feat"])
          .order("option_type", { ascending: true })
          .order("name", { ascending: true })
          .limit(5000),
        supabase
          .from("spells_catalog_preferred")
          .select("id,name,source,level,school,classes,description")
          .in("level", [0, 1])
          .order("level", { ascending: true })
          .order("name", { ascending: true })
          .limit(2000),
      ]);
      if (!active) return;
      const firstError = classResult.error || levelResult.error || optionResult.error || spellResult.error;
      if (firstError) setError(firstError.message || "Could not load the character creation catalogs.");
      setClasses(classResult.data || []);
      setLevelRows(levelResult.data || []);
      setOptionRows(optionResult.data || []);
      setSpells(spellResult.data || []);
      setLoadingCatalogs(false);
    }
    loadCatalogs();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!safeText(defaultName) || safeText(draft.name)) return;
    setDraft((current) => ({ ...current, name: safeText(defaultName) }));
  }, [defaultName, draft.name]);

  const backgroundOptions = useMemo(() => {
    const imported = optionRows.filter((row) => row.option_type === "background").map(normalizeImportedBackground);
    return imported.length ? imported : staticBackgroundChoices();
  }, [optionRows]);
  const speciesOptions = useMemo(() => {
    const imported = optionRows.filter((row) => row.option_type === "species").map(normalizeImportedSpecies);
    return imported.length ? imported : staticSpeciesChoices();
  }, [optionRows]);
  const featOptions = useMemo(() => {
    const imported = optionRows.filter((row) => row.option_type === "feat");
    return imported.length ? imported : staticFeatChoices();
  }, [optionRows]);
  const skillDescriptions = useMemo(() => {
    const map = { ...FALLBACK_SKILL_DESCRIPTIONS };
    optionRows.filter((row) => row.option_type === "skill").forEach((row) => {
      const key = normalizeSkillKey(row.name);
      if (key && row.description) map[key] = row.description;
    });
    return map;
  }, [optionRows]);

  const selectedClass = useMemo(() => classes.find((row) => row.id === draft.classId) || null, [classes, draft.classId]);
  const selectedLevelRow = useMemo(() => levelRows.find((row) => row.class_id === selectedClass?.id) || null, [levelRows, selectedClass?.id]);
  const selectedSpecies = useMemo(() => speciesOptions.find((row) => row.id === draft.speciesChoiceId) || null, [draft.speciesChoiceId, speciesOptions]);
  const selectedBackground = useMemo(() => backgroundOptions.find((row) => row.id === draft.backgroundChoiceId) || null, [backgroundOptions, draft.backgroundChoiceId]);
  const selectedHumanFeat = useMemo(() => featOptions.find((row) => row.id === draft.humanOriginFeatId) || null, [draft.humanOriginFeatId, featOptions]);
  const selectedCampaignFeat = useMemo(() => featOptions.find((row) => row.id === draft.campaignBonusFeatId) || null, [draft.campaignBonusFeatId, featOptions]);
  const humanSpecies = /(^|\s)human($|\s)/i.test(selectedSpecies?.name || "");
  const skillConfig = useMemo(() => classSkillConfiguration(selectedClass), [selectedClass]);
  const requirements = useMemo(() => startingSpellRequirements(selectedClass, selectedLevelRow), [selectedClass, selectedLevelRow]);
  const baseScores = useMemo(() => abilityScoresFromRollAllocation(rolls, allocation), [allocation, rolls]);
  const finalScores = useMemo(() => flexibleAbilityBoosts(baseScores, draft.backgroundBoosts), [baseScores, draft.backgroundBoosts]);
  const spellCounts = useMemo(() => selectedSpellCounts(spells, spellSelections), [spellSelections, spells]);
  const classSpells = useMemo(() => spells
    .filter((spell) => classMatchesSpell(spell, selectedClass))
    .filter((spell) => {
      const q = safeText(spellQuery).toLowerCase();
      if (!q) return true;
      return [spell.name, spell.school, spell.source, spell.description].filter(Boolean).join(" ").toLowerCase().includes(q);
    })
    .sort(spellSort), [selectedClass, spellQuery, spells]);
  const originFeatOptions = useMemo(() => featOptions.filter((feat) => {
    const category = safeText(feat.category).toLowerCase();
    return category === "o" || category === "origin" || Number(feat.metadata?.minimumLevel || 1) <= 1;
  }), [featOptions]);
  const allocatedIds = useMemo(() => new Set(Object.values(allocation).filter(Boolean)), [allocation]);

  function patch(values) {
    setDraft((current) => ({ ...current, ...values }));
    setError("");
  }

  function chooseClass(classId) {
    setDraft((current) => ({ ...current, classId, selectedClassSkills: [] }));
    setSpellSelections({});
    setError("");
  }

  function toggleSkill(key) {
    setDraft((current) => {
      const selected = current.selectedClassSkills || [];
      const next = selected.includes(key)
        ? selected.filter((value) => value !== key)
        : selected.length < skillConfig.count ? [...selected, key] : selected;
      return { ...current, selectedClassSkills: next };
    });
    setError("");
  }

  function rerollScores() {
    if (typeof window !== "undefined" && !window.confirm("Roll all six ability scores again? The current six rolls will be replaced.")) return;
    setRolls(rollAbilityPool());
    setError("");
  }

  function allocateRoll(ability, rollId) {
    setAllocation((current) => {
      const next = { ...current };
      const prior = next[ability];
      const otherAbility = ABILITY_KEYS.find((key) => key !== ability && next[key] === rollId);
      next[ability] = rollId;
      if (otherAbility) next[otherAbility] = prior;
      return next;
    });
    setError("");
  }

  function setBoost(field, value) {
    setDraft((current) => ({ ...current, backgroundBoosts: { ...current.backgroundBoosts, [field]: value, allowAny: true } }));
    setError("");
  }

  function togglePlusOne(ability) {
    setDraft((current) => {
      const selected = current.backgroundBoosts.plusOnes || [];
      const next = selected.includes(ability)
        ? selected.filter((key) => key !== ability)
        : selected.length < 3 ? [...selected, ability] : selected;
      return { ...current, backgroundBoosts: { ...current.backgroundBoosts, mode: "three", plusOnes: next, allowAny: true } };
    });
    setError("");
  }

  function toggleSpell(spell) {
    setSpellSelections((current) => {
      if (current[spell.id]) {
        const next = { ...current };
        delete next[spell.id];
        return next;
      }
      const cantrip = Number(spell.level || 0) === 0;
      if (cantrip && spellCounts.cantrips >= requirements.cantrips) return current;
      if (!cantrip && spellCounts.leveled >= requirements.leveled) return current;
      const prepared = cantrip || selectedClass?.class_key !== "wizard" || spellCounts.prepared < requirements.prepared;
      return { ...current, [spell.id]: { prepared } };
    });
    setError("");
  }

  function togglePrepared(spellId) {
    setSpellSelections((current) => {
      const selected = current[spellId];
      if (!selected) return current;
      if (!selected.prepared && spellCounts.prepared >= requirements.prepared) return current;
      return { ...current, [spellId]: { ...selected, prepared: !selected.prepared } };
    });
    setError("");
  }

  function validateStep(index) {
    if (index === 0) {
      if (safeText(draft.name).length < 2) return "Enter a character name with at least 2 characters.";
      if (safeText(draft.name).length > 120) return "Character names must be 120 characters or fewer.";
    }
    if (index === 1) {
      if (!selectedSpecies) return "Choose a species.";
      if (!selectedBackground) return "Choose a background.";
      if (selectedSpecies.key === "custom" && !safeText(draft.customSpecies)) return "Enter the campaign species name.";
      if (selectedBackground.key === "custom" && !safeText(draft.customBackground)) return "Enter the campaign background name.";
    }
    if (index === 2) {
      if (!selectedClass) return "Choose a class.";
      if ((draft.selectedClassSkills || []).length !== skillConfig.count) return `Choose exactly ${skillConfig.count} class skill${skillConfig.count === 1 ? "" : "s"}.`;
    }
    if (index === 3) {
      if (allocatedIds.size !== 6 || ABILITY_KEYS.some((key) => !allocation[key])) return "Allocate each of the six rolls to exactly one ability.";
      const boosts = draft.backgroundBoosts;
      if (boosts.mode === "three") {
        if (new Set(boosts.plusOnes || []).size !== 3) return "Choose three different abilities for the three +1 increases.";
      } else if (!boosts.plusTwo || !boosts.plusOne || boosts.plusTwo === boosts.plusOne) {
        return "Choose different abilities for the +2 and +1 increases.";
      }
    }
    if (index === 4) {
      if (humanSpecies && !selectedHumanFeat) return "Choose the extra Origin feat granted by Human Versatile.";
      if (!selectedCampaignFeat) return "Choose the campaign bonus feat granted at level 1.";
    }
    if (index === 5) {
      if (spellCounts.cantrips !== requirements.cantrips) return `Choose exactly ${requirements.cantrips} cantrip${requirements.cantrips === 1 ? "" : "s"}.`;
      if (spellCounts.leveled !== requirements.leveled) return `Choose exactly ${requirements.leveled} level-one spell${requirements.leveled === 1 ? "" : "s"}.`;
      if (spellCounts.prepared !== requirements.prepared) return `Mark exactly ${requirements.prepared} level-one spell${requirements.prepared === 1 ? "" : "s"} as prepared.`;
    }
    return "";
  }

  function nextStep() {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
    setError("");
  }

  function previousStep() {
    setStep((current) => Math.max(0, current - 1));
    setError("");
  }

  async function createCharacter() {
    for (let index = 0; index < STEPS.length - 1; index += 1) {
      const message = validateStep(index);
      if (message) {
        setStep(index);
        setError(message);
        return;
      }
    }
    setCreating(true);
    setError("");
    const bonusFeatNames = uniqueText([selectedHumanFeat?.name, selectedCampaignFeat?.name]);
    const payload = finalPayload({
      draft,
      selectedClass,
      selectedSpecies: selectedSpecies?.key === "custom" ? { ...selectedSpecies, name: safeText(draft.customSpecies) } : selectedSpecies,
      selectedBackground: selectedBackground?.key === "custom" ? { ...selectedBackground, name: safeText(draft.customBackground) } : selectedBackground,
      baseScores,
      finalScores,
      selectedSkills: draft.selectedClassSkills || [],
      bonusFeatNames,
    });
    const spellChoices = spells
      .filter((spell) => spellSelections[spell.id])
      .map((spell) => ({ spell_id: spell.id, prepared: Number(spell.level || 0) === 0 ? true : Boolean(spellSelections[spell.id]?.prepared) }));
    const { data, error: createError } = await supabase.rpc("create_player_character_v1", {
      p_payload: payload,
      p_spell_choices: spellChoices,
    });
    if (createError) {
      setError(createError.message || "Could not create the player character.");
      setCreating(false);
      return;
    }
    await onCreated?.({ id: data, name: draft.name, kind: "npc" });
    setCreating(false);
  }

  const selectedSpellRows = spells.filter((spell) => spellSelections[spell.id]).sort(spellSort);
  const selectedBackgroundRecommended = new Set(selectedBackground?.recommendedAbilities || []);
  const classSourceLabel = selectedClass ? sourceDisplayName(selectedClass.source, selectedClass.ruleset) : "";

  return (
    <div className="player-character-creator-v2">
      <div className="npc-card mb-3 creator-heading">
        <div>
          <div className="spell-admin-kicker">Character Creation</div>
          <h2 className="h4 mb-1">Create your player character</h2>
          <div className="small text-muted">All imported sources are available. When names repeat, the 2024 version is shown instead of the 2014 version.</div>
        </div>
        {typeof onCancel === "function" ? <button type="button" className="btn btn-sm btn-outline-light" onClick={onCancel}>Close</button> : null}
      </div>

      <div className="creator-step-strip mb-3">{STEPS.map((label, index) => <button type="button" key={label} className={index === step ? "active" : index < step ? "complete" : ""} onClick={() => index < step ? setStep(index) : null}>{index + 1}. {label}</button>)}</div>
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {loadingCatalogs ? <div className="alert alert-secondary py-2">Loading classes, descriptions, feats, and the preferred all-source spell catalog…</div> : null}

      {step === 0 ? <section className="npc-card"><div className="npc-card-title">Identity</div><div className="row g-3"><div className="col-12 col-lg-6"><label className="form-label">Character name</label><input className="form-control" value={draft.name} onChange={(event) => patch({ name: event.target.value })} maxLength={120} /></div><div className="col-12 col-lg-6"><label className="form-label">Alignment</label><select className="form-select" value={draft.alignment} onChange={(event) => patch({ alignment: event.target.value })}>{ALIGNMENT_OPTIONS.filter((entry) => entry.key !== "U").map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}</select></div><div className="col-12"><label className="form-label">Appearance</label><textarea className="form-control" rows={3} value={draft.appearance} onChange={(event) => patch({ appearance: event.target.value })} placeholder="Physical appearance, clothing, age, distinguishing features…" /></div><div className="col-12"><label className="form-label">Short description</label><textarea className="form-control" rows={2} value={draft.description} onChange={(event) => patch({ description: event.target.value })} placeholder="What other characters notice first." /></div></div></section> : null}

      {step === 1 ? <section className="npc-card"><div className="npc-card-title">Species and Background</div><div className="row g-3"><div className="col-12 col-lg-6"><label className="form-label">Species</label><select className="form-select" value={draft.speciesChoiceId} onChange={(event) => patch({ speciesChoiceId: event.target.value, lineage: "" })}><option value="">Choose species…</option>{speciesOptions.map((option) => <option key={option.id} value={option.id}>{option.name} • {option.source}</option>)}</select>{selectedSpecies ? <div className="creator-description"><strong>{selectedSpecies.name}</strong><p>{selectedSpecies.description}</p>{selectedSpecies.traits.length ? <small>Traits: {selectedSpecies.traits.join(", ")}</small> : null}</div> : null}</div><div className="col-12 col-lg-6"><label className="form-label">Background</label><select className="form-select" value={draft.backgroundChoiceId} onChange={(event) => patch({ backgroundChoiceId: event.target.value })}><option value="">Choose background…</option>{backgroundOptions.map((option) => <option key={option.id} value={option.id}>{option.name} • {option.source}</option>)}</select>{selectedBackground ? <div className="creator-description"><strong>{selectedBackground.name}</strong><p>{selectedBackground.description}</p><small>Origin feat: {selectedBackground.originFeat || "Source-defined"}</small></div> : null}</div>{selectedSpecies?.key === "custom" ? <div className="col-12 col-lg-6"><label className="form-label">Campaign species name</label><input className="form-control" value={draft.customSpecies} onChange={(event) => patch({ customSpecies: event.target.value })} /></div> : null}{selectedBackground?.key === "custom" ? <div className="col-12 col-lg-6"><label className="form-label">Campaign background name</label><input className="form-control" value={draft.customBackground} onChange={(event) => patch({ customBackground: event.target.value })} /></div> : null}{selectedSpecies?.lineages?.length ? <div className="col-12 col-lg-6"><label className="form-label">Lineage</label><select className="form-select" value={draft.lineage} onChange={(event) => patch({ lineage: event.target.value })}><option value="">Choose lineage…</option>{selectedSpecies.lineages.map((lineage) => <option key={lineage} value={lineage}>{lineage}</option>)}</select></div> : null}<div className="col-12 col-lg-6"><label className="form-label">Languages</label><input className="form-control" value={draft.languagesText} onChange={(event) => patch({ languagesText: event.target.value })} placeholder="Common, Elvish" /></div></div></section> : null}

      {step === 2 ? <section className="npc-card"><div className="npc-card-title">Class and Skills</div><div className="row g-3"><div className="col-12 col-lg-5"><label className="form-label">Class</label><select className="form-select" value={draft.classId} onChange={(event) => chooseClass(event.target.value)}><option value="">Choose class…</option>{classes.map((row) => <option key={row.id} value={row.id}>{row.class_name} • {row.source}</option>)}</select>{selectedClass ? <div className="creator-description"><strong>{selectedClass.class_name}</strong><p>{selectedClass.summary || "No class summary is available."}</p><small>{classSourceLabel} • Hit Die d{selectedClass.hit_die || 8} • Saves: {(selectedClass.saving_throws || []).map((key) => ABILITY_LABELS[key] || key).join(", ")}</small></div> : null}</div><div className="col-12 col-lg-7"><label className="form-label">Choose {skillConfig.count} class skill{skillConfig.count === 1 ? "" : "s"} ({(draft.selectedClassSkills || []).length}/{skillConfig.count})</label><div className="creator-skill-grid">{skillConfig.options.map((key) => <button type="button" key={key} className={`creator-skill ${draft.selectedClassSkills.includes(key) ? "active" : ""}`} onClick={() => toggleSkill(key)}><strong>{skillLabel(key)}</strong><small>{ABILITY_LABELS[SKILL_DEFINITIONS.find((skill) => skill.key === key)?.ability] || ""}</small><span>{skillDescriptions[key]}</span></button>)}</div></div></div></section> : null}

      {step === 3 ? <section className="npc-card"><div className="d-flex align-items-start justify-content-between gap-2 flex-wrap"><div><div className="npc-card-title mb-0">Roll and Allocate Ability Scores</div><div className="small text-muted">Each score rolls 4d6, drops the lowest die, and totals the remaining three. The six totals are then assigned once each.</div></div><button type="button" className="btn btn-sm btn-outline-warning" onClick={rerollScores}>Roll all six again</button></div><div className="roll-pool my-3">{rolls.map((roll, index) => <div key={roll.id} className="roll-card"><span>Roll {index + 1}</span><div>{roll.dice.map((die, dieIndex) => <b key={dieIndex} className={dieIndex === roll.droppedIndex ? "dropped" : ""}>d6: {die}</b>)}</div><strong>Total {roll.total}</strong></div>)}</div><div className="ability-allocation-grid">{ABILITY_KEYS.map((ability) => <div key={ability} className="ability-allocation"><div><strong>{ABILITY_LABELS[ability]}</strong><span>{ABILITY_DESCRIPTIONS[ability]}</span></div><select className="form-select form-select-sm" value={allocation[ability] || ""} onChange={(event) => allocateRoll(ability, event.target.value)}>{rolls.map((roll, index) => <option key={roll.id} value={roll.id}>Roll {index + 1}: {roll.total}{allocatedIds.has(roll.id) && allocation[ability] !== roll.id ? " (assigned)" : ""}</option>)}</select><div className="ability-score-result"><span>Base {baseScores[ability]}</span><strong>Final {finalScores[ability]} ({modifierLabel(finalScores[ability])})</strong></div></div>)}</div><hr /><div className="d-flex align-items-start justify-content-between gap-3 flex-wrap"><div><div className="fw-semibold">Background ability increases</div><div className="small text-muted">Campaign rule: assign the +2/+1 or three +1s to any abilities. {selectedBackground ? `${selectedBackground.name} recommends ${selectedBackground.recommendedAbilities.map((key) => ABILITY_LABELS[key]).join(", ")}.` : ""}</div></div><div className="btn-group btn-group-sm"><button type="button" className={`btn ${draft.backgroundBoosts.mode !== "three" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setBoost("mode", "twoOne")}>+2 and +1</button><button type="button" className={`btn ${draft.backgroundBoosts.mode === "three" ? "btn-warning" : "btn-outline-light"}`} onClick={() => setBoost("mode", "three")}>Three +1s</button></div></div>{draft.backgroundBoosts.mode === "three" ? <div className="boost-grid mt-2">{ABILITY_KEYS.map((ability) => <button type="button" key={ability} className={`btn btn-sm ${(draft.backgroundBoosts.plusOnes || []).includes(ability) ? "btn-warning" : selectedBackgroundRecommended.has(ability) ? "btn-outline-warning" : "btn-outline-light"}`} onClick={() => togglePlusOne(ability)}>{ABILITY_LABELS[ability]} +1</button>)}</div> : <div className="row g-2 mt-1"><div className="col-6"><label className="form-label small">+2 ability</label><select className="form-select" value={draft.backgroundBoosts.plusTwo} onChange={(event) => setBoost("plusTwo", event.target.value)}>{ABILITY_KEYS.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}{selectedBackgroundRecommended.has(ability) ? " • recommended" : ""}</option>)}</select></div><div className="col-6"><label className="form-label small">+1 ability</label><select className="form-select" value={draft.backgroundBoosts.plusOne} onChange={(event) => setBoost("plusOne", event.target.value)}>{ABILITY_KEYS.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}{selectedBackgroundRecommended.has(ability) ? " • recommended" : ""}</option>)}</select></div></div>}</section> : null}

      {step === 4 ? <section className="npc-card"><div className="npc-card-title">Starting Feats</div><div className="small text-muted mb-3">Your background grants its Origin feat. Human Versatile grants another Origin feat. This campaign also grants every player one bonus feat at level 1.</div><div className="row g-3">{humanSpecies ? <div className="col-12 col-lg-6"><label className="form-label">Human Versatile: Origin feat</label><select className="form-select" value={draft.humanOriginFeatId} onChange={(event) => patch({ humanOriginFeatId: event.target.value })}><option value="">Choose Origin feat…</option>{originFeatOptions.map((feat) => <option key={feat.id} value={feat.id}>{feat.name} • {feat.source}</option>)}</select>{selectedHumanFeat ? <div className="creator-description"><strong>{selectedHumanFeat.name}</strong><p>{selectedHumanFeat.description}</p></div> : null}</div> : null}<div className="col-12 col-lg-6"><label className="form-label">Campaign bonus feat</label><select className="form-select" value={draft.campaignBonusFeatId} onChange={(event) => patch({ campaignBonusFeatId: event.target.value })}><option value="">Choose bonus feat…</option>{featOptions.map((feat) => <option key={feat.id} value={feat.id}>{feat.name} • {feat.source}</option>)}</select>{selectedCampaignFeat ? <div className="creator-description"><strong>{selectedCampaignFeat.name}</strong>{selectedCampaignFeat.prerequisite_text ? <small>Prerequisite: {selectedCampaignFeat.prerequisite_text}</small> : null}<p>{selectedCampaignFeat.description}</p></div> : null}</div><div className="col-12"><div className="alert alert-secondary py-2 mb-0">Background feat: <strong>{selectedBackground?.originFeat || "Source-defined"}</strong>{humanSpecies ? ` • Human feat: ${selectedHumanFeat?.name || "not chosen"}` : ""} • Campaign feat: <strong>{selectedCampaignFeat?.name || "not chosen"}</strong></div></div></div></section> : null}

      {step === 5 ? <section className="npc-card"><div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-3"><div><div className="npc-card-title mb-0">Starting Spells</div><div className="small text-muted">{selectedClass ? `${selectedClass.class_name}: ${spellCounts.cantrips}/${requirements.cantrips} cantrips • ${spellCounts.leveled}/${requirements.leveled} level-one spells • ${spellCounts.prepared}/${requirements.prepared} prepared` : "Choose a class first."}</div></div><input className="form-control form-control-sm creator-spell-search" value={spellQuery} onChange={(event) => setSpellQuery(event.target.value)} placeholder="Search spells…" /></div>{requirements.cantrips === 0 && requirements.leveled === 0 ? <div className="alert alert-secondary py-2">This class does not choose class spells at level 1.</div> : null}<div className="creator-spell-list">{classSpells.map((spell) => { const selected = spellSelections[spell.id]; const cantrip = Number(spell.level || 0) === 0; return <div key={spell.id} className={`creator-spell-row ${selected ? "selected" : ""}`}><button type="button" className="creator-spell-main" onClick={() => toggleSpell(spell)}><strong>{spell.name}</strong><small>{spellLevelLabel(spell.level)} • {spell.school || "Spell"} • {spell.source}</small><span>{safeText(spell.description).slice(0, 180)}{safeText(spell.description).length > 180 ? "…" : ""}</span></button>{selected && !cantrip && selectedClass?.class_key === "wizard" ? <label className="form-check form-switch mb-0"><input className="form-check-input" type="checkbox" checked={!!selected.prepared} onChange={() => togglePrepared(spell.id)} /><span className="form-check-label small">Prepared</span></label> : selected ? <span className="badge text-bg-success">Selected</span> : null}</div>; })}</div></section> : null}

      {step === 6 ? <section className="npc-card"><div className="npc-card-title">Review Character</div><div className="row g-3"><div className="col-12 col-lg-6"><div className="creator-review"><span>Name</span><strong>{draft.name}</strong></div><div className="creator-review"><span>Species</span><strong>{selectedSpecies?.key === "custom" ? draft.customSpecies : selectedSpecies?.name}</strong></div><div className="creator-review"><span>Background</span><strong>{selectedBackground?.key === "custom" ? draft.customBackground : selectedBackground?.name}</strong></div><div className="creator-review"><span>Class</span><strong>{selectedClass?.class_name} • Level 1 • {selectedClass?.source}</strong></div><div className="creator-review"><span>Class skills</span><strong>{(draft.selectedClassSkills || []).map(skillLabel).join(", ")}</strong></div></div><div className="col-12 col-lg-6"><div className="review-ability-grid">{ABILITY_KEYS.map((ability) => <div key={ability}><span>{ABILITY_LABELS[ability]}</span><strong>{finalScores[ability]}</strong><small>{modifierLabel(finalScores[ability])}</small></div>)}</div><div className="creator-review mt-2"><span>Feats</span><strong>{uniqueText([selectedBackground?.originFeat, selectedHumanFeat?.name, selectedCampaignFeat?.name]).join(", ") || "None"}</strong></div><div className="creator-review"><span>Starting spells</span><strong>{selectedSpellRows.length ? selectedSpellRows.map((spell) => spell.name).join(", ") : "None"}</strong></div></div><div className="col-12"><label className="form-label">Motivation</label><textarea className="form-control" rows={2} value={draft.motivation} onChange={(event) => patch({ motivation: event.target.value })} placeholder="What drives this character to adventure?" /></div><div className="col-12"><label className="form-label">Personality traits</label><textarea className="form-control" rows={2} value={draft.personalityTraits} onChange={(event) => patch({ personalityTraits: event.target.value })} /></div></div><button type="button" className="btn btn-warning mt-3" disabled={creating} onClick={createCharacter}>{creating ? "Creating character…" : "Create and link character"}</button><div className="small text-muted mt-2">Character, sheet, permissions, class progression, feats, and starting spellbook are committed together or not at all.</div></section> : null}

      <div className="d-flex justify-content-between gap-2 mt-3"><button type="button" className="btn btn-outline-light" disabled={step === 0 || creating} onClick={previousStep}>Back</button>{step < STEPS.length - 1 ? <button type="button" className="btn btn-warning" disabled={loadingCatalogs} onClick={nextStep}>Continue</button> : null}</div>

      <style jsx>{`
        .creator-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
        .creator-step-strip { display:flex; gap:.35rem; overflow:auto; padding-bottom:.2rem; }
        .creator-step-strip button { border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.035); color:rgba(255,255,255,.62); border-radius:999px; padding:.35rem .6rem; white-space:nowrap; font-size:.78rem; }
        .creator-step-strip button.active { color:#18120a; background:#f5be4b; border-color:#f5be4b; }
        .creator-step-strip button.complete { color:#b8e6c3; border-color:rgba(80,190,110,.5); }
        .creator-description { margin-top:.55rem; padding:.65rem; border:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.035); border-radius:.65rem; }
        .creator-description p { margin:.3rem 0; white-space:pre-line; font-size:.86rem; color:rgba(255,255,255,.76); }
        .creator-description small { color:rgba(255,255,255,.58); }
        .creator-skill-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.45rem; max-height:48vh; overflow:auto; }
        .creator-skill { display:grid; gap:.12rem; padding:.6rem; border-radius:.65rem; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.035); color:inherit; text-align:left; }
        .creator-skill.active { border-color:#f5be4b; background:rgba(245,190,75,.12); }
        .creator-skill small { color:#e4bd70; }
        .creator-skill span { color:rgba(255,255,255,.62); font-size:.78rem; }
        .roll-pool { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.5rem; }
        .roll-card { display:grid; gap:.35rem; padding:.65rem; border-radius:.7rem; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.1); }
        .roll-card > span { color:rgba(255,255,255,.58); font-size:.75rem; text-transform:uppercase; }
        .roll-card > div { display:flex; gap:.3rem; flex-wrap:wrap; }
        .roll-card b { padding:.2rem .35rem; border-radius:.35rem; background:rgba(255,255,255,.08); font-size:.78rem; }
        .roll-card b.dropped { text-decoration:line-through; opacity:.45; }
        .ability-allocation-grid { display:grid; gap:.55rem; }
        .ability-allocation { display:grid; grid-template-columns:minmax(220px,1.4fr) minmax(160px,.7fr) minmax(140px,.6fr); gap:.7rem; align-items:center; padding:.65rem; border:1px solid rgba(255,255,255,.09); border-radius:.7rem; background:rgba(255,255,255,.025); }
        .ability-allocation > div:first-child { display:grid; }
        .ability-allocation > div:first-child span { color:rgba(255,255,255,.62); font-size:.79rem; }
        .ability-score-result { display:grid; text-align:right; }
        .ability-score-result span { color:rgba(255,255,255,.58); font-size:.78rem; }
        .boost-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:.4rem; }
        .creator-spell-search { max-width:260px; }
        .creator-spell-list { display:grid; gap:.4rem; max-height:48vh; overflow:auto; }
        .creator-spell-row { display:flex; justify-content:space-between; align-items:center; gap:.6rem; padding:.55rem .65rem; border-radius:.65rem; border:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.035); }
        .creator-spell-row.selected { border-color:#f5be4b; background:rgba(245,190,75,.11); }
        .creator-spell-main { flex:1; min-width:0; display:grid; border:0; background:transparent; color:inherit; text-align:left; padding:0; }
        .creator-spell-main small, .creator-spell-main span { color:rgba(255,255,255,.58); }
        .creator-spell-main span { font-size:.78rem; }
        .creator-review { display:flex; justify-content:space-between; gap:1rem; padding:.55rem 0; border-bottom:1px solid rgba(255,255,255,.08); }
        .creator-review span { color:rgba(255,255,255,.58); }
        .creator-review strong { text-align:right; }
        .review-ability-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.4rem; }
        .review-ability-grid > div { display:grid; text-align:center; padding:.55rem; border-radius:.6rem; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.09); }
        .review-ability-grid span, .review-ability-grid small { color:rgba(255,255,255,.58); font-size:.72rem; }
        @media (max-width:800px) { .creator-skill-grid { grid-template-columns:1fr; } .roll-pool { grid-template-columns:repeat(2,minmax(0,1fr)); } .ability-allocation { grid-template-columns:1fr; } .ability-score-result { text-align:left; } .boost-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .creator-spell-search { max-width:none; width:100%; } }
      `}</style>
    </div>
  );
}

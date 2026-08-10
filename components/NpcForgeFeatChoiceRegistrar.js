import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { buildArtificerPlanSourceGroups } from "../utils/artificerPlanChoices";
import { buildAdvancementSourceChoiceGroups } from "../utils/playerForgeAdvancement";
import { buildFeatSourceChoiceGroups, featGrantInstancesFromSelections } from "../utils/playerForgeFeatChoices";
import { routeFeatSourceChoiceGroups } from "../utils/playerForgeFeatChoiceRouting";
import { buildSpeciesSourceChoiceGroups } from "../utils/playerForgeSpeciesChoices";
import { applySpeciesRuntimeChoiceAuthority } from "../utils/playerForgeSpeciesRuntimeChoices";
import { buildWarlockInvocationSourceGroups } from "../utils/warlockInvocationChoices";
import { classChoiceSelectionSummary, useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import { sourceChoiceSelectionSummary, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import { speciesFeatChoicesFromState, useNpcForgeSpeciesChoices } from "./NpcForgeSpeciesChoiceContext";

const norm = (value) => String(value ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");

function emptyFeatGroup(instance) {
  const feat = instance.feat || {};
  return {
    id: `feat-${slug(instance.instanceId)}`,
    ownerType: "feat",
    ownerKey: instance.instanceId,
    label: feat.name || "Feat",
    source: feat.source || "XPHB",
    placement: instance.placement || "class",
    level: Math.max(1, Number(instance.level || 1)),
    fields: [],
    helper: "This feat has no additional permanent child choice in the current source data.",
    metadata: {
      featInstanceId: instance.instanceId,
      featOptionId: feat.id || null,
      featOptionKey: feat.option_key || null,
      featName: feat.name || "",
      featSource: feat.source || "XPHB",
      featCategory: feat.category || null,
      featOptionType: feat.option_type || "feat",
      repeatable: Boolean(feat.metadata?.repeatable),
      acquisitionOwnerType: instance.ownerType || null,
      acquisitionOwnerKey: instance.ownerKey || null,
      acquisitionLabel: instance.acquisitionLabel || null,
      acquisitionLevel: Math.max(1, Number(instance.level || 1)),
      fixedEffects: [],
      fixedSpellTokens: [],
    },
  };
}

function resolveOption(entry, options = []) {
  const key = String(entry?.key || entry?.value || "");
  const label = norm(entry?.label || entry?.name);
  const source = String(entry?.source || "");
  return options.find((candidate) => key && [candidate.id, candidate.option_key].map(String).includes(key))
    || options.find((candidate) => label && norm(candidate.name) === label && (!source || candidate.source === source))
    || null;
}

export default function NpcForgeFeatChoiceRegistrar({ playerMode = false, controller = null }) {
  const { state: speciesState } = useNpcForgeSpeciesChoices();
  const { state: classState } = useNpcForgeClassChoice();
  const { state: sourceState, registerGroups } = useNpcForgeSourceChoices();
  const [spells, setSpells] = useState([]);
  const [spellCatalogReady, setSpellCatalogReady] = useState(false);
  const [advancementRows, setAdvancementRows] = useState([]);
  const [boonRows, setBoonRows] = useState([]);
  const [advancementReady, setAdvancementReady] = useState(false);
  const [classOptionRows, setClassOptionRows] = useState([]);
  const [classOptionReady, setClassOptionReady] = useState(false);
  const [magicItemRows, setMagicItemRows] = useState([]);
  const [magicItemCatalogReady, setMagicItemCatalogReady] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const selectedClass = controller?.selectedClass;
  const needsInvocations = Boolean(playerMode && norm(selectedClass?.class_key) === "warlock" && String(selectedClass?.source || "").toUpperCase() === "XPHB");
  const needsArtificerPlans = Boolean(playerMode && norm(selectedClass?.class_key) === "artificer" && String(selectedClass?.source || "").toUpperCase() === "EFA");

  useEffect(() => {
    if (!playerMode) {
      setSpells([]);
      setSpellCatalogReady(true);
      setCatalogError("");
      return undefined;
    }
    let active = true;
    setSpellCatalogReady(false);
    setCatalogError("");
    supabase.from("spells_catalog")
      .select("id,spell_key,name,source,level,school,school_code,classes,ritual,casting_time,range_text,range_distance,range_unit,attack_type,duration_text,description,components_v,components_s,components_m,damage_dice,damage_types")
      .order("level", { ascending: true })
      .order("name", { ascending: true })
      .limit(10000)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setCatalogError(error.message || "Could not load the canonical spell catalogue for source choices.");
          setSpells([]);
          setSpellCatalogReady(false);
          return;
        }
        setSpells(data || []);
        setSpellCatalogReady(true);
      });
    return () => { active = false; };
  }, [playerMode]);

  useEffect(() => {
    if (!needsInvocations && !needsArtificerPlans) {
      setClassOptionRows([]);
      setClassOptionReady(true);
      return undefined;
    }
    let active = true;
    setClassOptionReady(false);
    const query = needsInvocations
      ? supabase.from("class_feature_option_catalog")
        .select("id,option_key,option_type,name,source,class_key,feature_types,page,description,prerequisites,additional_spells,repeatable,choice_schema,metadata")
        .eq("option_type", "eldritch-invocation").eq("source", "XPHB").eq("class_key", "warlock")
      : supabase.from("class_feature_option_catalog")
        .select("id,option_key,option_type,name,source,class_key,feature_types,page,description,prerequisites,additional_spells,repeatable,choice_schema,metadata")
        .eq("option_type", "artificer-plan").eq("source", "EFA").eq("class_key", "artificer");
    query.order("name", { ascending: true }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setCatalogError(error.message || `Could not load canonical ${needsInvocations ? "Warlock Invocation" : "Artificer Magic Item Plan"} options.`);
        setClassOptionRows([]);
        setClassOptionReady(false);
        return;
      }
      setClassOptionRows(data || []);
      setClassOptionReady(true);
    });
    return () => { active = false; };
  }, [needsArtificerPlans, needsInvocations]);

  useEffect(() => {
    if (!needsArtificerPlans) {
      setMagicItemRows([]);
      setMagicItemCatalogReady(true);
      return undefined;
    }
    let active = true;
    setMagicItemCatalogReady(false);
    supabase.from("items_catalog")
      .select("id,item_name,item_key,item_type,item_rarity,payload")
      .in("item_rarity", ["common", "uncommon", "rare", "Common", "Uncommon", "Rare"])
      .order("item_name", { ascending: true })
      .limit(10000)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setCatalogError(error.message || "Could not load canonical magic items for Artificer plan choices.");
          setMagicItemRows([]);
          setMagicItemCatalogReady(false);
          return;
        }
        setMagicItemRows(data || []);
        setMagicItemCatalogReady(true);
      });
    return () => { active = false; };
  }, [needsArtificerPlans]);

  useEffect(() => {
    const selected = controller?.selectedClass;
    if (!playerMode || !selected?.class_name || Number(controller?.draft?.level || 1) < 4) {
      setAdvancementRows([]);
      setBoonRows([]);
      setAdvancementReady(true);
      return undefined;
    }
    let active = true;
    setAdvancementReady(false);
    Promise.all([
      supabase.from("class_feature_catalog")
        .select("id,class_name,class_source,name,source,level,description")
        .eq("class_name", selected.class_name)
        .eq("class_source", selected.source)
        .in("name", ["Ability Score Improvement", "Epic Boon"])
        .lte("level", Number(controller?.draft?.level || 1))
        .order("level", { ascending: true }),
      supabase.from("character_option_catalog_preferred")
        .select("id,option_key,option_type,name,source,category,description,prerequisite_text,tags,metadata,raw_payload")
        .eq("option_type", "boon")
        .order("name", { ascending: true })
        .limit(500),
    ]).then(([featureResult, boonResult]) => {
      if (!active) return;
      const error = featureResult.error || boonResult.error;
      if (error) {
        setCatalogError(error.message || "Could not load higher-level advancement features.");
        setAdvancementRows([]);
        setBoonRows([]);
        setAdvancementReady(false);
        return;
      }
      setAdvancementRows(featureResult.data || []);
      setBoonRows(boonResult.data || []);
      setAdvancementReady(true);
    });
    return () => { active = false; };
  }, [controller?.draft?.level, controller?.selectedClass, playerMode]);

  const excludedSpeciesTraits = useMemo(() => (speciesState.rules || []).map((rule) => rule.traitName).filter(Boolean), [speciesState.rules]);
  const baseSpeciesGroups = useMemo(() => buildSpeciesSourceChoiceGroups({
    species: controller?.selectedSpecies || null,
    level: controller?.draft?.level || 1,
    spells,
    featOptions: controller?.featOptions || [],
    excludedTraitNames: excludedSpeciesTraits,
  }), [controller?.draft?.level, controller?.featOptions, controller?.selectedSpecies, excludedSpeciesTraits, spells]);
  const speciesGroups = useMemo(() => applySpeciesRuntimeChoiceAuthority({
    groups: baseSpeciesGroups,
    species: controller?.selectedSpecies || null,
    toolRows: controller?.toolRows || [],
  }), [baseSpeciesGroups, controller?.selectedSpecies, controller?.toolRows]);

  useEffect(() => {
    registerGroups(playerMode ? speciesGroups : [], !playerMode || spellCatalogReady, "species-extra");
  }, [playerMode, registerGroups, speciesGroups, spellCatalogReady]);

  const invocationSelectionSignature = JSON.stringify(Object.entries(sourceState.selections || {})
    .filter(([groupId]) => groupId.startsWith("warlock-invocation-slot-"))
    .sort(([a], [b]) => a.localeCompare(b)));
  const invocationGroups = useMemo(() => buildWarlockInvocationSourceGroups({
    selectedClass: controller?.selectedClass || null,
    level: controller?.draft?.level || 1,
    optionRows: needsInvocations ? classOptionRows : [],
    spells,
    featOptions: controller?.featOptions || [],
    selections: sourceState.selections || {},
  }), [classOptionRows, controller?.draft?.level, controller?.featOptions, controller?.selectedClass, invocationSelectionSignature, needsInvocations, spells, sourceState.selections]);

  const artificerSelectionSignature = JSON.stringify(Object.entries(sourceState.selections || {})
    .filter(([groupId]) => groupId.startsWith("artificer-plan-slot-"))
    .sort(([a], [b]) => a.localeCompare(b)));
  const artificerPlanGroups = useMemo(() => buildArtificerPlanSourceGroups({
    selectedClass: controller?.selectedClass || null,
    level: controller?.draft?.level || 1,
    optionRows: needsArtificerPlans ? classOptionRows : [],
    itemRows: magicItemRows,
    selections: sourceState.selections || {},
  }), [artificerSelectionSignature, classOptionRows, controller?.draft?.level, controller?.selectedClass, magicItemRows, needsArtificerPlans, sourceState.selections]);

  const normalizedClassOptionGroups = useMemo(() => [...invocationGroups, ...artificerPlanGroups], [artificerPlanGroups, invocationGroups]);
  const normalizedClassOptionReady = !playerMode || (classOptionReady
    && (!needsInvocations || spellCatalogReady)
    && (!needsArtificerPlans || magicItemCatalogReady));

  useEffect(() => {
    registerGroups(playerMode ? normalizedClassOptionGroups : [], normalizedClassOptionReady, "class-options");
  }, [normalizedClassOptionGroups, normalizedClassOptionReady, playerMode, registerGroups]);

  const speciesChoiceFeats = useMemo(() => speciesFeatChoicesFromState(speciesState), [speciesState]);
  const classChoices = useMemo(() => classChoiceSelectionSummary(classState), [classState]);
  const classChoiceFeats = useMemo(() => classChoices.filter((entry) => entry.groupKind === "fighting-style" || entry.kind === "feat"), [classChoices]);
  const sourceSummary = sourceChoiceSelectionSummary(sourceState);
  const advancementOptions = useMemo(() => [...(controller?.featOptions || []), ...boonRows], [boonRows, controller?.featOptions]);
  const selectedAdvancementChoices = useMemo(() => sourceSummary
    .filter((entry) => entry.ownerType === "advancement" && ["feat", "boon", "boon-or-feat"].includes(entry.kind))
    .flatMap((entry) => {
      const feat = resolveOption(entry, advancementOptions);
      return feat ? [{ ...entry, feat, acquisitionLevel: Number(entry.level || 1) }] : [];
    }), [advancementOptions, sourceSummary]);
  const knownFeatsForProgression = useMemo(() => [
    controller?.selectedBackgroundFeat,
    controller?.speciesBonusFeat,
    ...speciesChoiceFeats.map((entry) => entry.feat || entry),
    ...classChoiceFeats.map((entry) => entry.option || entry),
  ].filter(Boolean), [classChoiceFeats, controller?.selectedBackgroundFeat, controller?.speciesBonusFeat, speciesChoiceFeats]);

  const advancementGroups = useMemo(() => buildAdvancementSourceChoiceGroups({
    selectedClass: controller?.selectedClass || null,
    selectedSpecies: controller?.selectedSpecies || null,
    selectedBackground: controller?.selectedBackground || null,
    level: controller?.draft?.level || 1,
    classFeatureRows: advancementRows,
    featOptions: advancementOptions,
    abilities: controller?.finalAbilities || {},
    knownFeats: knownFeatsForProgression,
    selectedAdvancementChoices,
    spellcasting: Boolean(controller?.selectedClass?.spellcasting_ability || /pact/i.test(String(controller?.selectedClass?.caster_progression || ""))),
  }), [advancementOptions, advancementRows, controller?.draft?.level, controller?.finalAbilities, controller?.selectedBackground, controller?.selectedClass, controller?.selectedSpecies, knownFeatsForProgression, selectedAdvancementChoices]);

  useEffect(() => {
    registerGroups(playerMode ? advancementGroups : [], !playerMode || advancementReady, "advancement");
  }, [advancementGroups, advancementReady, playerMode, registerGroups]);

  const sourceFeatChoices = sourceSummary.filter((entry) => entry.ownerType !== "feat" && ["feat", "boon", "boon-or-feat"].includes(entry.kind));
  const sourceFeatSignature = JSON.stringify(sourceFeatChoices.map((entry) => [entry.ownerType, entry.groupId, entry.key, entry.label, entry.source, entry.level, entry.placement]));
  const sourceFeatInstances = useMemo(() => sourceFeatChoices.flatMap((entry, index) => {
    const feat = resolveOption(entry, advancementOptions);
    return feat ? [{ instanceId: `source-${slug(entry.ownerType)}-${slug(entry.groupId)}-feat-${index + 1}`, ownerType: entry.ownerType, ownerKey: entry.groupId, placement: entry.placement || "species", level: Number(entry.level || 1), acquisitionLabel: entry.groupLabel || `${entry.ownerType} feat`, feat }] : [];
  }), [advancementOptions, sourceFeatSignature]);
  const baseFeatInstances = useMemo(() => featGrantInstancesFromSelections({
    selectedBackgroundFeat: controller?.selectedBackgroundFeat || null,
    speciesBonusFeat: controller?.speciesBonusFeat || null,
    speciesChoiceFeats,
    classChoiceFeats,
    featOptions: controller?.featOptions || [],
  }), [classChoiceFeats, controller?.featOptions, controller?.selectedBackgroundFeat, controller?.speciesBonusFeat, speciesChoiceFeats]);
  const featInstances = useMemo(() => [...baseFeatInstances, ...sourceFeatInstances], [baseFeatInstances, sourceFeatInstances]);
  const featGroups = useMemo(() => {
    const nested = buildFeatSourceChoiceGroups({ featInstances, toolRows: controller?.toolRows || [], spells, level: controller?.draft?.level || 1 });
    const routed = routeFeatSourceChoiceGroups({ groups: nested, selectedBackground: controller?.selectedBackground || null, spells });
    const byInstance = new Map(routed.map((entry) => [entry.metadata?.featInstanceId || entry.ownerKey, entry]));
    return featInstances.map((instance) => byInstance.get(instance.instanceId) || emptyFeatGroup(instance));
  }, [controller?.draft?.level, controller?.selectedBackground, controller?.toolRows, featInstances, spells]);

  useEffect(() => {
    registerGroups(playerMode ? featGroups : [], !playerMode || spellCatalogReady, "feats");
  }, [featGroups, playerMode, registerGroups, spellCatalogReady]);

  useEffect(() => {
    if (catalogError && controller?.setError) controller.setError((current) => current || catalogError);
  }, [catalogError, controller]);

  return null;
}

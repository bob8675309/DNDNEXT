import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { buildAdvancementSourceChoiceGroups } from "../utils/playerForgeAdvancement";
import { buildFeatSourceChoiceGroups, featGrantInstancesFromSelections } from "../utils/playerForgeFeatChoices";
import { buildSpeciesSourceChoiceGroups } from "../utils/playerForgeSpeciesChoices";
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

export default function NpcForgeFeatChoiceRegistrar({ playerMode = false, controller = null }) {
  const { state: speciesState } = useNpcForgeSpeciesChoices();
  const { state: classState } = useNpcForgeClassChoice();
  const { state: sourceState, registerGroups } = useNpcForgeSourceChoices();
  const [spells, setSpells] = useState([]);
  const [spellCatalogReady, setSpellCatalogReady] = useState(false);
  const [advancementRows, setAdvancementRows] = useState([]);
  const [advancementReady, setAdvancementReady] = useState(false);
  const [catalogError, setCatalogError] = useState("");

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
      .select("id,spell_key,name,source,level,school,school_code,classes,ritual,casting_time,range_text,duration_text,description,components_v,components_s,components_m,damage_dice,damage_types")
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
    const selectedClass = controller?.selectedClass;
    if (!playerMode || !selectedClass?.class_name || Number(controller?.draft?.level || 1) < 4) {
      setAdvancementRows([]);
      setAdvancementReady(true);
      return undefined;
    }
    let active = true;
    setAdvancementReady(false);
    supabase.from("class_feature_catalog")
      .select("id,class_name,class_source,name,source,level,description")
      .eq("class_name", selectedClass.class_name)
      .eq("class_source", selectedClass.source)
      .in("name", ["Ability Score Improvement", "Epic Boon"])
      .lte("level", Number(controller?.draft?.level || 1))
      .order("level", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setCatalogError(error.message || "Could not load higher-level advancement features.");
          setAdvancementRows([]);
          setAdvancementReady(false);
          return;
        }
        setAdvancementRows(data || []);
        setAdvancementReady(true);
      });
    return () => { active = false; };
  }, [controller?.draft?.level, controller?.selectedClass, playerMode]);

  const excludedSpeciesTraits = useMemo(() => (speciesState.rules || []).map((rule) => rule.traitName).filter(Boolean), [speciesState.rules]);
  const speciesGroups = useMemo(() => buildSpeciesSourceChoiceGroups({
    species: controller?.selectedSpecies || null,
    level: controller?.draft?.level || 1,
    spells,
    featOptions: controller?.featOptions || [],
    excludedTraitNames: excludedSpeciesTraits,
  }), [controller?.draft?.level, controller?.featOptions, controller?.selectedSpecies, excludedSpeciesTraits, spells]);
  const advancementGroups = useMemo(() => buildAdvancementSourceChoiceGroups({
    selectedClass: controller?.selectedClass || null,
    level: controller?.draft?.level || 1,
    classFeatureRows: advancementRows,
    featOptions: controller?.featOptions || [],
  }), [advancementRows, controller?.draft?.level, controller?.featOptions, controller?.selectedClass]);

  useEffect(() => {
    registerGroups(playerMode ? speciesGroups : [], !playerMode || spellCatalogReady, "species-extra");
  }, [playerMode, registerGroups, speciesGroups, spellCatalogReady]);
  useEffect(() => {
    registerGroups(playerMode ? advancementGroups : [], !playerMode || advancementReady, "advancement");
  }, [advancementGroups, advancementReady, playerMode, registerGroups]);

  const speciesChoiceFeats = useMemo(() => speciesFeatChoicesFromState(speciesState), [speciesState]);
  const classChoices = useMemo(() => classChoiceSelectionSummary(classState), [classState]);
  const classChoiceFeats = useMemo(() => classChoices.filter((entry) => entry.groupKind === "fighting-style" || entry.kind === "feat"), [classChoices]);
  const sourceFeatChoices = sourceChoiceSelectionSummary(sourceState).filter((entry) => entry.ownerType !== "feat" && entry.kind === "feat");
  const sourceFeatSignature = JSON.stringify(sourceFeatChoices.map((entry) => [entry.ownerType, entry.groupId, entry.key, entry.label, entry.source, entry.level, entry.placement]));
  const sourceFeatInstances = useMemo(() => sourceFeatChoices.flatMap((entry, index) => {
    const feat = (controller?.featOptions || []).find((candidate) => String(candidate.id || "") === String(entry.key || "") || String(candidate.option_key || "") === String(entry.key || "") || (norm(candidate.name) === norm(entry.label) && (!entry.source || candidate.source === entry.source)))
      || (controller?.featOptions || []).find((candidate) => norm(candidate.name) === norm(entry.label));
    return feat ? [{ instanceId: `source-${slug(entry.ownerType)}-${slug(entry.groupId)}-feat-${index + 1}`, ownerType: entry.ownerType, ownerKey: entry.groupId, placement: entry.placement || "species", level: Number(entry.level || 1), acquisitionLabel: entry.groupLabel || `${entry.ownerType} feat`, feat }] : [];
  }), [controller?.featOptions, sourceFeatSignature]);
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
    const byInstance = new Map(nested.map((entry) => [entry.metadata?.featInstanceId || entry.ownerKey, entry]));
    return featInstances.map((instance) => byInstance.get(instance.instanceId) || emptyFeatGroup(instance));
  }, [controller?.draft?.level, controller?.toolRows, featInstances, spells]);

  useEffect(() => {
    registerGroups(playerMode ? featGroups : [], !playerMode || spellCatalogReady, "feats");
  }, [featGroups, playerMode, registerGroups, spellCatalogReady]);

  useEffect(() => {
    if (catalogError && controller?.setError) controller.setError((current) => current || catalogError);
  }, [catalogError, controller]);

  return null;
}

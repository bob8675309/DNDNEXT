import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { buildClassFeatureChoiceGroups } from "../utils/classFeatureChoices";
import { applyClassFeatureOptionAuthority } from "../utils/classFeatureOptionAuthority";
import { guideSubclassFeatures, resolveSubclassCatalog, subclassIntroduction } from "../utils/classes/subclassCompatibility";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

const text = (value) => String(value ?? "").trim();
const normalized = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export const classSourceLabel = (source = "") => source === "XPHB" ? "2024 Player's Handbook" : source === "PHB" ? "2014 Player's Handbook" : source || "Campaign";
export const classFeatureName = (feature) => typeof feature === "string" ? text(feature.split("|")[0]) : text(feature?.name || feature?.label || feature?.title || "Class feature");
export const classSlotSummary = (slots) => {
  if (!slots) return "—";
  if (Array.isArray(slots)) {
    const entries = slots.map((count, index) => Number(count || 0) ? `${index + 1}:${Number(count)}` : "").filter(Boolean);
    return entries.length ? entries.join("  ") : "—";
  }
  const count = Number(slots.pactSlots || 0);
  return count ? `${count} pact slot${count === 1 ? "" : "s"} at level ${Number(slots.pactSlotLevel || 0)}` : "—";
};

function featureLookup(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = normalized(row.name);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function featureDescription(name, level, lookup) {
  const rows = lookup.get(normalized(name)) || [];
  const exact = rows.find((row) => Number(row.level) === Number(level));
  return formatPlayerFacingText(exact?.description || rows[0]?.description, "No imported description is available for this feature yet.");
}

function genericSubclassFeature(name) {
  const key = normalized(name);
  return key === "subclass" || key === "subclass feature" || key.endsWith(" subclass feature");
}

export function useNpcForgeClassGuideModel(selectedClass, level) {
  const [view, setView] = useState("overview");
  const [compareAll, setCompareAll] = useState(false);
  const [previewKey, setPreviewKey] = useState("");
  const [levels, setLevels] = useState([]);
  const [features, setFeatures] = useState([]);
  const [choiceCatalog, setChoiceCatalog] = useState([]);
  const [optionalFeatureCatalog, setOptionalFeatureCatalog] = useState([]);
  const [items, setItems] = useState([]);
  const [spells, setSpells] = useState([]);
  const [loadedId, setLoadedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pinned, setPinned] = useState(null);
  const { state, registerClass, selectSubclass, registerFeatureGroups, toggleFeatureOption } = useNpcForgeClassChoice();
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();
  const currentLevel = Math.max(1, Math.min(20, Number(level || 1)));

  useEffect(() => {
    if (!selectedClass?.id || !selectedClass?.class_key) {
      setLevels([]); setFeatures([]); setChoiceCatalog([]); setOptionalFeatureCatalog([]); setItems([]); setSpells([]); setLoadedId(""); setLoading(false); setError("");
      return;
    }
    let active = true;
    setLoading(true); setLoadedId(""); setLevels([]); setFeatures([]); setChoiceCatalog([]); setOptionalFeatureCatalog([]); setItems([]); setSpells([]); setError("");
    Promise.all([
      supabase.from("class_level_progression")
        .select("class_level,proficiency_bonus,cantrips_known,spells_known,spell_slots,features")
        .eq("class_id", selectedClass.id).order("class_level", { ascending: true }),
      supabase.from("class_feature_catalog")
        .select("id,feature_type,name,source,class_source,subclass_name,subclass_short_name,level,description,entries,raw_payload")
        .eq("class_key", selectedClass.class_key).order("level", { ascending: true }).order("name", { ascending: true }).limit(5000),
      supabase.from("character_option_catalog_preferred")
        .select("id,option_key,option_type,name,source,category,description,prerequisite_text,tags,metadata")
        .in("option_type", ["feat", "skill"]).order("option_type", { ascending: true }).order("name", { ascending: true }).limit(5000),
      supabase.from("class_feature_option_catalog")
        .select("id,option_key,option_type,name,source,class_key,feature_types,page,description,prerequisites,additional_spells,repeatable,choice_schema,metadata")
        .or(`class_key.eq.${selectedClass.class_key},class_key.is.null`)
        .order("option_type", { ascending: true }).order("name", { ascending: true }).limit(5000),
      supabase.from("items_catalog")
        .select("item_key,item_name,item_type,item_rarity,payload")
        .eq("item_rarity", "mundane").limit(5000),
      supabase.from("spells_catalog")
        .select("id,spell_key,name,source,level,school_code,school,classes,ritual,concentration,casting_time,range_text,components_v,components_s,components_m,duration_text,damage_dice,damage_types,description")
        .order("level", { ascending: true }).order("name", { ascending: true }).limit(5000),
    ]).then(([levelResult, featureResult, optionResult, optionalFeatureResult, itemResult, spellResult]) => {
      if (!active) return;
      const failed = levelResult.error || featureResult.error || optionResult.error || optionalFeatureResult.error || itemResult.error || spellResult.error;
      setLevels(levelResult.data || []); setFeatures(featureResult.data || []); setChoiceCatalog(optionResult.data || []); setOptionalFeatureCatalog(optionalFeatureResult.data || []); setItems(itemResult.data || []); setSpells(spellResult.data || []);
      setLoadedId(failed ? "" : String(selectedClass.id));
      setError(failed?.message || ""); setLoading(false);
    }).catch((cause) => {
      if (!active) return;
      setLoadedId(""); setLoading(false); setError(String(cause?.message || cause || "Could not load the class guide."));
    });
    return () => { active = false; };
  }, [selectedClass?.class_key, selectedClass?.id]);

  const baseRows = useMemo(() => features.filter((row) => row.feature_type === "class" && row.class_source === selectedClass?.source), [features, selectedClass?.source]);
  const options = useMemo(() => resolveSubclassCatalog(features, selectedClass?.source), [features, selectedClass?.source]);
  const lookup = useMemo(() => featureLookup(baseRows), [baseRows]);

  useEffect(() => {
    registerClass(selectedClass, options, currentLevel, loadedId === String(selectedClass?.id || ""));
  }, [currentLevel, loadedId, options, registerClass, selectedClass]);

  useEffect(() => {
    const selectedExists = options.some((option) => option.key === state.selectedKey);
    if (selectedExists) setPreviewKey(state.selectedKey);
    else if (!options.some((option) => option.key === previewKey)) setPreviewKey(options[0]?.key || "");
  }, [options, previewKey, state.selectedKey]);

  useEffect(() => { setPinned(null); setCompareAll(false); }, [selectedClass?.id]);

  const preview = options.find((option) => option.key === previewKey) || options[0] || null;
  const selected = options.find((option) => option.key === state.selectedKey) || null;
  const eligible = options.filter((option) => Number(option.firstLevel || 1) <= currentLevel);
  const entryLevel = options.length ? Math.min(...options.map((option) => Number(option.firstLevel || 20))) : null;
  const previewEligible = Boolean(preview && Number(preview.firstLevel || 1) <= currentLevel);
  const rawChoiceGroups = useMemo(() => buildClassFeatureChoiceGroups({
    selectedClass,
    level: currentLevel,
    features,
    selectedSubclass: selected,
    catalogRows: choiceCatalog,
    items,
    spells,
  }), [choiceCatalog, currentLevel, features, items, selected, selectedClass, spells]);
  const normalizedClassOptionFamilies = useMemo(() => new Set((sourceChoiceState.groups || [])
    .filter((group) => group.ownerType === "class-option")
    .map((group) => group.metadata?.family)
    .filter(Boolean)), [sourceChoiceState.groups]);
  const choiceGroups = useMemo(
    () => applyClassFeatureOptionAuthority(rawChoiceGroups, optionalFeatureCatalog, selectedClass)
      .filter((group) => !(normalizedClassOptionFamilies.has("eldritch-invocation") && group.kind === "eldritch-invocation"))
      .filter((group) => !(normalizedClassOptionFamilies.has("artificer-plan") && group.kind === "artificer-plan")),
    [normalizedClassOptionFamilies, optionalFeatureCatalog, rawChoiceGroups, selectedClass]
  );

  useEffect(() => {
    registerFeatureGroups(selectedClass, choiceGroups, currentLevel, loadedId === String(selectedClass?.id || ""));
  }, [choiceGroups, currentLevel, loadedId, registerFeatureGroups, selectedClass]);

  const rows = useMemo(() => levels.map((row) => {
    const baseNames = (Array.isArray(row.features) ? row.features : []).map(classFeatureName).filter(Boolean).filter((name) => !(preview && genericSubclassFeature(name)));
    const subclassRows = preview ? guideSubclassFeatures(preview).filter((feature) => Number(feature.level) === Number(row.class_level)).map((feature) => ({ name: feature.name, source: preview.source, type: "subclass", description: formatPlayerFacingText(feature.description, "No imported description is available.") })) : [];
    return { ...row, guideFeatures: [...baseNames.map((name) => ({ name, source: selectedClass?.source, type: "class", description: featureDescription(name, row.class_level, lookup) })), ...subclassRows] };
  }), [levels, lookup, preview, selectedClass?.source]);

  return {
    view, setView, compareAll, setCompareAll, previewKey, setPreviewKey,
    loading, error, pinned, setPinned, currentLevel, options, preview, selected,
    eligible, entryLevel, previewEligible, rows, intro: subclassIntroduction(preview), selectSubclass,
    choiceGroups, choiceSelections: state.featureSelections || {}, toggleFeatureOption,
  };
}

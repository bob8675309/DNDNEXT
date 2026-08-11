import { useCallback, useEffect, useMemo, useState } from "react";
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

function featureSource(name, level, lookup) {
  const rows = lookup.get(normalized(name)) || [];
  const exact = rows.find((row) => Number(row.level) === Number(level)) || rows[0] || null;
  return {
    description: formatPlayerFacingText(exact?.description, "No imported description is available for this feature yet."),
    entries: exact?.entries ?? null,
    rawPayload: exact?.raw_payload ?? null,
  };
}

function genericSubclassFeature(name) {
  const key = normalized(name);
  return key === "subclass" || key === "subclass feature" || key.endsWith(" subclass feature");
}

function itemSourceRank(source = "") {
  const key = text(source).toUpperCase();
  if (key === "XDMG") return 0;
  if (key === "EFA") return 1;
  if (key === "DMG") return 2;
  return 3;
}

function canonicalItemDescription(row = {}) {
  return text(
    row?.payload?.item_description
    || row?.payload?.description
    || row?.payload?.entriesText
    || row?.payload?.rulesShort,
  );
}

function listedLookupKeys(value = "") {
  const raw = text(value);
  const strippedAvailability = raw
    .replace(/\s+[—–-]\s+(?:yes|no|available|unavailable|eligible|ineligible|locked|unlocked)\s*$/i, "")
    .replace(/\s+\((?:yes|no|available|unavailable|eligible|ineligible|locked|unlocked)\)\s*$/i, "")
    .trim();
  return [...new Set([normalized(raw), normalized(strippedAvailability)].filter(Boolean))];
}

function listedDetailCatalog(optionalRows = [], itemRows = []) {
  const map = new Map();
  for (const row of optionalRows) {
    const key = normalized(row?.name);
    if (!key || !text(row?.description)) continue;
    map.set(key, {
      name: text(row.name),
      source: text(row.source || "Campaign"),
      description: formatPlayerFacingText(row.description),
      detailKind: row.option_type || "class-option",
      prerequisites: row.prerequisites || null,
      metadata: row.metadata || null,
    });
  }

  const preferredItems = new Map();
  for (const row of itemRows) {
    const key = normalized(row?.item_name || row?.payload?.name);
    const description = canonicalItemDescription(row);
    if (!key || !description) continue;
    const source = text(row?.payload?.source || row?.source || "Campaign");
    const current = preferredItems.get(key);
    if (!current || itemSourceRank(source) < itemSourceRank(current.source)) {
      const itemCard = {
        ...(row?.payload && typeof row.payload === "object" ? row.payload : {}),
        item_key: row?.item_key || row?.payload?.item_key || null,
        item_name: text(row?.item_name || row?.payload?.name),
        item_type: row?.item_type || row?.payload?.uiType || row?.payload?.type || null,
        item_rarity: row?.item_rarity || row?.payload?.rarity || null,
        item_description: description,
        source,
      };
      preferredItems.set(key, {
        name: itemCard.item_name,
        source,
        description: formatPlayerFacingText(description),
        detailKind: "item",
        metadata: {
          itemKey: itemCard.item_key,
          itemType: itemCard.item_type,
          rarity: itemCard.item_rarity,
          attunement: row?.payload?.reqAttune || row?.payload?.attunement || null,
          itemCard,
        },
      });
    }
  }
  for (const [key, item] of preferredItems) map.set(key, item);
  return map;
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
  const [detailItems, setDetailItems] = useState([]);
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
      setLevels([]); setFeatures([]); setChoiceCatalog([]); setOptionalFeatureCatalog([]); setItems([]); setDetailItems([]); setSpells([]); setLoadedId(""); setLoading(false); setError("");
      return;
    }
    let active = true;
    setLoading(true); setLoadedId(""); setLevels([]); setFeatures([]); setChoiceCatalog([]); setOptionalFeatureCatalog([]); setItems([]); setDetailItems([]); setSpells([]); setError("");
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
      supabase.from("items_catalog")
        .select("item_key,item_name,item_type,item_rarity,payload")
        .limit(5000),
      supabase.from("spells_catalog")
        .select("id,spell_key,name,source,level,school_code,school,classes,ritual,concentration,casting_time,range_text,components_v,components_s,components_m,duration_text,damage_dice,damage_types,description")
        .order("level", { ascending: true }).order("name", { ascending: true }).limit(5000),
    ]).then(([levelResult, featureResult, optionResult, optionalFeatureResult, itemResult, detailItemResult, spellResult]) => {
      if (!active) return;
      const failed = levelResult.error || featureResult.error || optionResult.error || optionalFeatureResult.error || itemResult.error || detailItemResult.error || spellResult.error;
      setLevels(levelResult.data || []); setFeatures(featureResult.data || []); setChoiceCatalog(optionResult.data || []); setOptionalFeatureCatalog(optionalFeatureResult.data || []); setItems(itemResult.data || []); setDetailItems(detailItemResult.data || []); setSpells(spellResult.data || []);
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
  const listDetailLookup = useMemo(() => listedDetailCatalog(optionalFeatureCatalog, detailItems), [detailItems, optionalFeatureCatalog]);

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
  const invocationSourceActive = normalizedClassOptionFamilies.has("eldritch-invocation");
  const artificerPlanSourceActive = normalizedClassOptionFamilies.has("artificer-plan");
  const choiceGroups = useMemo(
    () => applyClassFeatureOptionAuthority(rawChoiceGroups, optionalFeatureCatalog, selectedClass)
      .filter((group) => !(invocationSourceActive && group.kind === "eldritch-invocation"))
      .filter((group) => !(artificerPlanSourceActive && group.kind === "artificer-plan")),
    [artificerPlanSourceActive, invocationSourceActive, optionalFeatureCatalog, rawChoiceGroups, selectedClass]
  );

  useEffect(() => {
    registerFeatureGroups(selectedClass, choiceGroups, currentLevel, loadedId === String(selectedClass?.id || ""));
  }, [choiceGroups, currentLevel, loadedId, registerFeatureGroups, selectedClass]);

  const rows = useMemo(() => levels.map((row) => {
    const baseNames = (Array.isArray(row.features) ? row.features : []).map(classFeatureName).filter(Boolean).filter((name) => !(preview && genericSubclassFeature(name)));
    const subclassRows = preview ? guideSubclassFeatures(preview).filter((feature) => Number(feature.level) === Number(row.class_level)).map((feature) => ({ name: feature.name, source: preview.source, type: "subclass", description: formatPlayerFacingText(feature.description, "No imported description is available."), entries: feature.entries || null })) : [];
    return {
      ...row,
      guideFeatures: [
        ...baseNames.map((name) => ({ name, source: selectedClass?.source, type: "class", ...featureSource(name, row.class_level, lookup) })),
        ...subclassRows,
      ],
    };
  }), [levels, lookup, preview, selectedClass?.source]);

  const resolveListedDetail = useCallback((label, parentFeature = null, levelOverride = null) => {
    const name = text(label);
    const matched = listedLookupKeys(name).map((key) => listDetailLookup.get(key)).find(Boolean) || null;
    const parentName = text(parentFeature?.name || "class feature");
    return {
      name: matched?.name || name,
      source: matched?.source || text(parentFeature?.source || selectedClass?.source || "Campaign"),
      type: "listed-option",
      level: Number(levelOverride || parentFeature?.level || 0),
      description: matched?.description || `This option is listed under ${parentName}. No separate canonical description is available in the currently loaded catalogues; use the parent feature rules for its mechanical context.`,
      parentFeatureName: parentName,
      detailKind: matched?.detailKind || "listed-option",
      prerequisites: matched?.prerequisites || null,
      metadata: matched?.metadata || null,
    };
  }, [listDetailLookup, selectedClass?.source]);

  return {
    view, setView, compareAll, setCompareAll, previewKey, setPreviewKey,
    loading, error, pinned, setPinned, currentLevel, options, preview, selected,
    eligible, entryLevel, previewEligible, rows, intro: subclassIntroduction(preview), selectSubclass,
    choiceGroups, choiceSelections: state.featureSelections || {}, toggleFeatureOption,
    resolveListedDetail,
  };
}

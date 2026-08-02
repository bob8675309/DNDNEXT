import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { buildCharacterSheetFeatures } from "../utils/characterSheetFeatures";

function safeText(value) {
  return String(value ?? "").trim();
}

function classKeyFromSheet(sheet = {}) {
  return safeText(sheet?.classKey || sheet?.meta?.classKey || sheet?.className || sheet?.class)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sheetFeatureSignature(sheet = {}) {
  return JSON.stringify({
    classKey: sheet?.classKey || sheet?.meta?.classKey || sheet?.className || sheet?.class || "",
    classSource: sheet?.classSource || sheet?.meta?.classSource || sheet?.rulesetSource || sheet?.meta?.rulesetSource || "",
    level: sheet?.level || sheet?.meta?.level || 1,
    subclass: sheet?.subclass || sheet?.meta?.subclass || "",
    subclassSource: sheet?.subclassSource || sheet?.meta?.subclassSource || "",
    species: sheet?.species || sheet?.race || sheet?.meta?.species || "",
    feats: sheet?.feats || [],
    speciesTraits: sheet?.speciesTraits || [],
    classFeatures: sheet?.classFeatures || [],
    featsTraits: sheet?.featsTraits || "",
  });
}

const emptySnapshot = (characterId = "", loading = false) => ({
  characterId,
  inventoryRows: [],
  spellActions: [],
  featureRows: [],
  loading,
  error: "",
});

export default function useNpcSheetActionData({
  characterId,
  sheet,
  enabled = false,
  canCommand = false,
  onSheetUpdated,
  onResult,
}) {
  const id = safeText(characterId);
  const requestRef = useRef(0);
  const activeIdRef = useRef("");
  const [snapshot, setSnapshot] = useState(() => emptySnapshot());
  const [busyKey, setBusyKey] = useState("");
  const featureSignature = useMemo(() => sheetFeatureSignature(sheet || {}), [sheet]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    activeIdRef.current = id;
    setBusyKey("");

    if (!id || !enabled) {
      setSnapshot(emptySnapshot(id, false));
      return undefined;
    }

    let cancelled = false;
    const isCurrent = () => !cancelled && activeIdRef.current === id && requestRef.current === requestId;
    setSnapshot(emptySnapshot(id, true));

    async function run() {
      const inventoryResult = await supabase.rpc("get_character_inventory_v1", { p_character_id: id });
      if (!isCurrent()) return;
      const inventoryRows = inventoryResult.error ? [] : inventoryResult.data || [];

      const assignmentResult = await supabase
        .from("character_spells")
        .select("id,spell_id,prepared,always_available,casting_stat,save_dc_override,attack_bonus_override,uses_max,uses_remaining,recharge")
        .eq("character_id", id);
      if (!isCurrent()) return;

      let spellActions = [];
      if (!assignmentResult.error && assignmentResult.data?.length) {
        const spellIds = [...new Set(assignmentResult.data.map((row) => row.spell_id).filter(Boolean))];
        const catalogResult = await supabase
          .from("spells_catalog")
          .select("id,name,level,attack_type,saving_throw_abilities,damage_dice,damage_types,healing_dice,casting_time,range_text,duration_text,description")
          .in("id", spellIds);
        if (!isCurrent()) return;
        if (!catalogResult.error) {
          const catalogById = new Map((catalogResult.data || []).map((row) => [String(row.id), row]));
          spellActions = assignmentResult.data
            .map((row) => ({ ...row, spell: catalogById.get(String(row.spell_id)) || null }))
            .filter((row) => row.spell);
        }
      }

      const currentSheet = sheet || {};
      const classKey = classKeyFromSheet(currentSheet);
      const speciesName = safeText(currentSheet?.species || currentSheet?.race || currentSheet?.meta?.species);
      const classFeaturePromise = classKey
        ? supabase
          .from("class_feature_catalog")
          .select("id,feature_key,feature_type,name,source,class_key,class_name,class_source,subclass_name,subclass_short_name,level,description,raw_payload")
          .eq("class_key", classKey)
          .order("level", { ascending: true })
          .order("name", { ascending: true })
          .limit(5000)
        : Promise.resolve({ data: [], error: null });
      const speciesPromise = speciesName
        ? supabase
          .from("character_option_catalog_preferred")
          .select("id,option_key,option_type,name,source,description,metadata,raw_payload")
          .eq("option_type", "species")
          .ilike("name", speciesName)
          .limit(1)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [grantResult, progressionResult, classFeatureResult, speciesResult] = await Promise.all([
        supabase.rpc("get_character_option_grants_v1", { p_character_id: id }),
        supabase.rpc("get_character_progression_v1", { p_character_id: id }),
        classFeaturePromise,
        speciesPromise,
      ]);
      if (!isCurrent()) return;

      const featureRows = buildCharacterSheetFeatures({
        sheet: currentSheet,
        grantedOptions: grantResult.error ? [] : grantResult.data || [],
        progression: progressionResult.error ? null : progressionResult.data?.progression || null,
        classRow: progressionResult.error ? null : progressionResult.data?.class || null,
        classFeatureRows: classFeatureResult.error ? [] : classFeatureResult.data || [],
        speciesOption: speciesResult.error ? null : speciesResult.data || null,
      });

      setSnapshot({
        characterId: id,
        inventoryRows,
        spellActions,
        featureRows,
        loading: false,
        error: inventoryResult.error?.message || assignmentResult.error?.message || "",
      });
    }

    void run().catch((error) => {
      if (!isCurrent()) return;
      console.warn("NPC sheet action data could not be loaded", error);
      setSnapshot({ ...emptySnapshot(id, false), error: error?.message || "Could not load sheet actions." });
    });

    return () => {
      cancelled = true;
    };
    // The signature intentionally excludes transient actionState changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, featureSignature, id]);

  const handleActionCommand = useCallback(async (action, operation) => {
    const activeId = safeText(characterId);
    if (!activeId || !canCommand || action?.kind !== "feature-toggle" || !action?.actionKey) return;

    const requestId = requestRef.current;
    setBusyKey(action.id);
    const { data, error } = await supabase.rpc("update_character_sheet_action_state_v1", {
      p_character_id: activeId,
      p_action_key: action.actionKey,
      p_operation: operation,
    });

    if (activeIdRef.current !== activeId || requestRef.current !== requestId) return;

    if (error) {
      onResult?.({
        label: action.label,
        summary: `${action.label}: ${error.message || "Could not update this feature."}`,
      });
      setBusyKey("");
      return;
    }

    if (data?.sheet) onSheetUpdated?.(data.sheet);
    const remaining = Number(data?.usesRemaining ?? data?.uses_remaining);
    const maximum = Number(data?.usesMax ?? data?.uses_max);
    const active = Boolean(data?.active);
    const stateText = operation === "reset" ? "uses reset" : active ? "active" : "ended";
    onResult?.({
      label: action.label,
      summary: `${action.label}: ${stateText}${Number.isFinite(remaining) && Number.isFinite(maximum) ? ` • ${remaining}/${maximum} uses remaining` : ""}`,
    });
    setBusyKey("");
  }, [canCommand, characterId, onResult, onSheetUpdated]);

  const current = snapshot.characterId === id;
  return {
    inventoryRows: current ? snapshot.inventoryRows : [],
    spellActions: current ? snapshot.spellActions : [],
    featureRows: current ? snapshot.featureRows : [],
    loading: Boolean(id && enabled && (!current || snapshot.loading)),
    error: current ? snapshot.error : "",
    busyKey,
    canCommand,
    handleActionCommand,
  };
}

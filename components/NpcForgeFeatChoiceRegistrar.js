import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { buildFeatSourceChoiceGroups, featGrantInstancesFromSelections } from "../utils/playerForgeFeatChoices";
import { classChoiceSelectionSummary, useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import { speciesFeatChoicesFromState, useNpcForgeSpeciesChoices } from "./NpcForgeSpeciesChoiceContext";

export default function NpcForgeFeatChoiceRegistrar({ playerMode = false, controller = null }) {
  const { state: speciesState } = useNpcForgeSpeciesChoices();
  const { state: classState } = useNpcForgeClassChoice();
  const { registerGroups } = useNpcForgeSourceChoices();
  const [spells, setSpells] = useState([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    if (!playerMode) {
      setSpells([]);
      setCatalogReady(true);
      setCatalogError("");
      return undefined;
    }
    let active = true;
    setCatalogReady(false);
    setCatalogError("");
    supabase.from("spells_catalog")
      .select("id,spell_key,name,source,level,school,school_code,classes,ritual,casting_time,range_text,duration_text,description,components_v,components_s,components_m,damage_dice,damage_types")
      .order("level", { ascending: true })
      .order("name", { ascending: true })
      .limit(10000)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setCatalogError(error.message || "Could not load the canonical spell catalogue for feat choices.");
          setSpells([]);
          setCatalogReady(false);
          return;
        }
        setSpells(data || []);
        setCatalogReady(true);
      });
    return () => { active = false; };
  }, [playerMode]);

  const speciesChoiceFeats = useMemo(() => speciesFeatChoicesFromState(speciesState), [speciesState]);
  const classChoices = useMemo(() => classChoiceSelectionSummary(classState), [classState]);
  const classChoiceFeats = useMemo(() => classChoices.filter((entry) => entry.groupKind === "fighting-style" || entry.kind === "feat"), [classChoices]);
  const featInstances = useMemo(() => featGrantInstancesFromSelections({
    selectedBackgroundFeat: controller?.selectedBackgroundFeat || null,
    speciesBonusFeat: controller?.speciesBonusFeat || null,
    speciesChoiceFeats,
    classChoiceFeats,
    featOptions: controller?.featOptions || [],
  }), [classChoiceFeats, controller?.featOptions, controller?.selectedBackgroundFeat, controller?.speciesBonusFeat, speciesChoiceFeats]);
  const featGroups = useMemo(() => buildFeatSourceChoiceGroups({
    featInstances,
    toolRows: controller?.toolRows || [],
    spells,
    level: controller?.draft?.level || 1,
  }), [controller?.draft?.level, controller?.toolRows, featInstances, spells]);

  useEffect(() => {
    registerGroups(playerMode ? featGroups : [], !playerMode || catalogReady, "feats");
  }, [catalogReady, featGroups, playerMode, registerGroups]);

  useEffect(() => {
    if (catalogError && controller?.setError) controller.setError((current) => current || catalogError);
  }, [catalogError, controller]);

  return null;
}

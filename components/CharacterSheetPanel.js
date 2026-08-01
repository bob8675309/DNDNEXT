import { useEffect, useMemo, useState } from "react";
import CharacterSheetPanelBase from "./CharacterSheetPanelBase";
import { supabase } from "../utils/supabaseClient";
import {
  authoritativeEffectsRevision,
  characterIdFromEffectsKey,
  loadAuthoritativeEquipmentEffects,
  mergeAuthoritativeEquipmentEffects,
} from "../utils/authoritativeEquipmentEffects";

/**
 * CharacterSheetPanel
 *
 * Existing callers continue to provide locally parsed item effects. When the
 * existing effectsKey contains a character UUID, this wrapper loads the shared
 * server-authoritative numeric result and replaces only numeric equipment math.
 * Presentation-only text parsing, reminders, warnings, and roll-mode hints stay
 * in the local equipmentEffects pipeline.
 */
export default function CharacterSheetPanel(props) {
  const characterId = useMemo(
    () => characterIdFromEffectsKey(props.effectsKey),
    [props.effectsKey]
  );
  const [authoritativeEffects, setAuthoritativeEffects] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!characterId) {
      setAuthoritativeEffects(null);
      return undefined;
    }

    setAuthoritativeEffects(null);
    loadAuthoritativeEquipmentEffects(supabase, characterId)
      .then((result) => {
        if (!cancelled) setAuthoritativeEffects(result);
      })
      .catch((error) => {
        if (cancelled) return;
        setAuthoritativeEffects(null);
        const code = String(error?.code || "");
        if (code !== "42501" && code !== "PGRST202") {
          console.warn("Authoritative equipment effects unavailable; using local display effects.", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [characterId, props.effectsKey]);

  const mergedItemBonuses = useMemo(
    () => mergeAuthoritativeEquipmentEffects(props.itemBonuses, authoritativeEffects),
    [props.itemBonuses, authoritativeEffects]
  );
  const mergedEffectsKey = `${String(props.effectsKey || "")}|authority:${authoritativeEffectsRevision(authoritativeEffects)}`;

  return (
    <CharacterSheetPanelBase
      {...props}
      itemBonuses={mergedItemBonuses}
      effectsKey={mergedEffectsKey}
    />
  );
}

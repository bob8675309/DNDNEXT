import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// Inventory belongs to an account; magic item selection belongs to one character.
// Character choices come from the authenticated player's server-owned roster,
// never from a display name or an unvalidated URL character ID.
export default function useInventoryAttunement({
  ownerType,
  ownerId,
  sessionUserId,
  requestedCharacterId = "",
  restActivity = false,
  canManage = false,
  inventoryRows = [],
}) {
  const [characters, setCharacters] = useState([]);
  const [characterId, setCharacterId] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const isOwnPlayerInventory = ownerType === "player"
    && Boolean(sessionUserId) && String(ownerId) === String(sessionUserId);

  const inventoryFingerprint = useMemo(
    () => inventoryRows.map((row) =>
      [row.id, row.owner_type, row.owner_id, row.is_equipped, row.equip_slot, row.item_id, row.item_rarity]
        .map((part) => String(part ?? "")).join(":")).join("|"),
    [inventoryRows]
  );

  useEffect(() => {
    let active = true;
    setCharacters([]);
    setCharacterId("");
    setSnapshot(null);
    setError("");
    if (!isOwnPlayerInventory) return () => { active = false; };
    (async () => {
      const { data, error: listError } = await supabase.rpc("get_my_player_characters_v2");
      if (!active) return;
      if (listError) {
        setError(listError.message || "Unable to verify your characters.");
        return;
      }
      const options = [...new Map((Array.isArray(data) ? data : [])
        .filter((entry) => entry?.id)
        .map((entry) => [String(entry.id), { id: String(entry.id), name: String(entry.name || "Character") }])).values()];
      setCharacters(options);
      const requested = String(requestedCharacterId || "");
      setCharacterId(options.find((entry) => entry.id === requested)?.id || options[0]?.id || "");
    })();
    return () => { active = false; };
  }, [isOwnPlayerInventory, requestedCharacterId]);

  useEffect(() => {
    let active = true;
    setSnapshot(null);
    if (!isOwnPlayerInventory || !characterId) return () => { active = false; };
    setLoading(true);
    setError("");
    (async () => {
      const { data, error: loadError } = await supabase.rpc("get_character_rest_magic_choices_v1", {
        p_character_id: characterId,
      });
      if (!active) return;
      if (loadError) setError(loadError.message || "Unable to load character item choices.");
      else if (!data || typeof data.enabled !== "boolean")
        setError("The attunement response is not available.");
      else setSnapshot(data);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [isOwnPlayerInventory, characterId, inventoryFingerprint]);

  const canChange = Boolean(
    canManage && isOwnPlayerInventory && restActivity
    && requestedCharacterId && String(requestedCharacterId) === characterId
    && snapshot?.enabled === true && !loading && !busy
  );

  const onToggle = useCallback(async (itemId, nextSelected) => {
    if (!canChange || savingRef.current || !snapshot || !characterId) return;
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    const candidate = items.find((entry) => String(entry.itemId) === String(itemId));
    if (!candidate?.selectable || Boolean(candidate.isSelected) === Boolean(nextSelected)) return;
    const previouslyChosen = items.filter((entry) => entry.isSelected).map((entry) => String(entry.itemId));
    if (previouslyChosen.length !== Number(snapshot.count)) {
      setError("Item choices have changed. Refresh Inventory before changing attunement.");
      return;
    }
    const selected = nextSelected
      ? [...previouslyChosen, String(itemId)]
      : previouslyChosen.filter((id) => id !== String(itemId));
    if (selected.length > Number(snapshot.maxItems || 3)) {
      setError("The campaign allows a maximum of three attuned items.");
      return;
    }
    savingRef.current = true;
    setBusy(true);
    setError("");
    try {
      const { data, error: saveError } = await supabase.rpc("set_character_rest_magic_choices_v1", {
        p_character_id: characterId,
        p_item_ids: selected,
      });
      if (saveError) throw saveError;
      if (!data || data.enabled !== true || data.effectsEnforced !== false) {
        throw new Error("Could not verify the new attunement selection.");
      }
      setSnapshot(data);
    } catch (err) {
      setError(err?.message || "Could not save attunement selection.");
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }, [canChange, snapshot, characterId]);

  return {
    characters,
    characterId,
    setCharacterId,
    loading,
    error,
    snapshot,
    attunement: snapshot?.enabled === true ? {
      ...snapshot,
      canChange,
      busy,
      error,
      onToggle,
    } : null,
    isOwnPlayerInventory,
    isRestActivity: restActivity,
  };
}

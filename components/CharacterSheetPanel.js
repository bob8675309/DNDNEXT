import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CharacterSheet5e from "./CharacterSheet5e";
import CharacterSheetEnhancements from "./CharacterSheetEnhancements";
import { supabase } from "../utils/supabaseClient";
import {
  authoritativeEffectsRevision,
  characterIdFromEffectsKey,
  loadAuthoritativeEquipmentEffects,
  mergeAuthoritativeEquipmentEffects,
} from "../utils/authoritativeEquipmentEffects";
import { deriveEquippedItemEffects, hashEquippedRowsForKey } from "../utils/equipmentEffects";
import {
  characterIdentityChanged,
  isCurrentCharacterSheetRequest,
  normalizeCharacterIdentity,
} from "../utils/characterSheetIdentity";

function deepClone(obj) {
  try {
    return structuredClone(obj ?? {});
  } catch {
    return JSON.parse(JSON.stringify(obj ?? {}));
  }
}

function ownerTypeFromEffectsKey(effectsKey) {
  const identity = normalizeCharacterIdentity(effectsKey).split("|")[0];
  const separator = identity.indexOf(":");
  if (separator <= 0) return "";
  const ownerType = identity.slice(0, separator).toLowerCase();
  return ["npc", "merchant", "character"].includes(ownerType) ? ownerType : "";
}

function itemName(row) {
  const payload = row?.card_payload || {};
  return normalizeCharacterIdentity(payload.item_name || payload.name || row?.item_name || row?.name);
}

function identityRevision(sheet, rows) {
  let sheetText = "";
  try {
    sheetText = JSON.stringify(sheet || {});
  } catch {
    sheetText = "unserializable";
  }
  return `${sheetText.length}:${hashEquippedRowsForKey(rows || [])}`;
}

/**
 * CharacterSheetPanel
 *
 * Supports both:
 *  - Uncontrolled draft/editMode (default)
 *  - Controlled draft/editMode (when a parent needs to render/edit parts of the sheet elsewhere)
 *
 * Numeric equipment effects are loaded from the shared server resolver when
 * effectsKey contains a character UUID. Existing locally parsed item effects
 * remain the graceful fallback and continue to supply presentation-only text,
 * reminders, warnings, and Advantage/Disadvantage hints.
 */
export default function CharacterSheetPanel({
  sheet,
  characterName,
  nameRight = null,
  metaLine = null,
  profileHref = null,
  profileText = "Profile",
  onOpenProfile = null,
  inventoryHref = null,
  storeHref = null,
  onOpenStore = null,
  storeText = "Store",
  inventoryText = "Inventory",
  editable = false,
  canSave = false,
  onSave,
  onRoll,

  // Optional hard-delete action (usually admin-only, and typically shown only in edit mode)
  onDelete = null,
  deleteDisabled = false,
  deleteTitle = "Delete this character",

  // Optional dirty flag (when parent edits non-sheet fields under the same edit toggle)
  extraDirty = false,

  // Optional controlled state
  draft: controlledDraft,
  setDraft: setControlledDraft,
  editMode: controlledEditMode,
  setEditMode: setControlledEditMode,

  // Display-only overlays (NOT saved into sheet JSON)
  itemBonuses = null,
  equipmentOverride = null,
  equipmentBreakdown = null,
  effectsKey = null,

  // Optional map + location listing controls (saved outside the sheet JSON)
  mapVisible = null,
  onToggleMapVisible = null,
  mapToggleDisabled = false,
  mapToggleTitle = null,

  // Display-only location label shown in the header. This is separate from any
  // legacy "List at Location" toggle and is intended to reflect the selected
  // location from the NPC page dropdown.
  locationLabel = null,

  // Optional editable location control (typically provided by the NPCs page).
  // When editMode is on, this is rendered as a dropdown. When editMode is off,
  // the read-only locationLabel is shown instead.
  locationValue = null,
  locationOptions = null, // array: { id, name }
  onChangeLocation = null,
  locationDisabled = false,

  locationListed = null,
  onToggleLocationListed = null,
  locationToggleDisabled = false,
  locationToggleTitle = null,
}) {
  const sheetRootRef = useRef(null);
  const draftIsControlled = typeof setControlledDraft === "function";
  const editIsControlled = typeof setControlledEditMode === "function";

  const [internalDraft, setInternalDraft] = useState(() => deepClone(sheet || {}));
  const [internalEditMode, setInternalEditMode] = useState(false);

  const draft = draftIsControlled ? controlledDraft ?? {} : internalDraft;
  const setDraft = draftIsControlled ? setControlledDraft : setInternalDraft;

  const editMode = editIsControlled ? !!controlledEditMode : internalEditMode;
  const setEditMode = editIsControlled ? setControlledEditMode : setInternalEditMode;
  const editModeRef = useRef(editMode);

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [authoritativeEffects, setAuthoritativeEffects] = useState(null);
  const [identitySnapshot, setIdentitySnapshot] = useState(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const identityRequestRef = useRef(0);
  const loadedIdentityRef = useRef("");
  const visibilityRefreshRef = useRef(0);
  const characterId = useMemo(() => characterIdFromEffectsKey(effectsKey), [effectsKey]);
  const ownerTypeHint = useMemo(() => ownerTypeFromEffectsKey(effectsKey), [effectsKey]);

  const applyDraftSnapshot = useCallback((nextSheet, { closeEditor = false } = {}) => {
    const next = deepClone(nextSheet || {});
    if (draftIsControlled) setControlledDraft(next);
    else setInternalDraft(next);

    if (closeEditor) {
      if (editIsControlled) setControlledEditMode(false);
      else setInternalEditMode(false);
    }
  }, [draftIsControlled, editIsControlled, setControlledDraft, setControlledEditMode]);

  const loadIdentitySnapshot = useCallback(async ({ hardReset = false, reason = "selection" } = {}) => {
    const requestedCharacterId = normalizeCharacterIdentity(characterId);
    if (!requestedCharacterId) {
      identityRequestRef.current += 1;
      loadedIdentityRef.current = "";
      setIdentitySnapshot(null);
      setAuthoritativeEffects(null);
      setIdentityLoading(false);
      setIdentityError("");
      return null;
    }

    const requestId = ++identityRequestRef.current;
    if (hardReset) {
      loadedIdentityRef.current = requestedCharacterId;
      setIdentitySnapshot(null);
      setAuthoritativeEffects(null);
      setIdentityError("");
      applyDraftSnapshot({}, { closeEditor: true });
      setSaveErr("");
      setSaving(false);
    }
    setIdentityLoading(true);

    const ownerTypePromise = ownerTypeHint
      ? Promise.resolve(ownerTypeHint)
      : supabase
          .from("characters")
          .select("kind")
          .eq("id", requestedCharacterId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) throw error;
            const kind = normalizeCharacterIdentity(data?.kind).toLowerCase();
            return kind === "merchant" ? "merchant" : kind === "npc" ? "npc" : "character";
          });

    const authorityPromise = loadAuthoritativeEquipmentEffects(supabase, requestedCharacterId)
      .then((data) => ({ data, error: null }))
      .catch((error) => ({ data: null, error }));

    try {
      const [sheetResult, resolvedOwnerType, authorityResult] = await Promise.all([
        supabase
          .from("character_sheets")
          .select("sheet")
          .eq("character_id", requestedCharacterId)
          .maybeSingle(),
        ownerTypePromise,
        authorityPromise,
      ]);

      if (!isCurrentCharacterSheetRequest({
        activeCharacterId: characterId,
        requestedCharacterId,
        activeRequestId: identityRequestRef.current,
        requestId,
      })) return null;
      if (sheetResult.error) throw sheetResult.error;

      const equipmentResult = await supabase
        .from("inventory_items")
        .select("*")
        .eq("owner_type", resolvedOwnerType)
        .eq("owner_id", requestedCharacterId)
        .eq("is_equipped", true)
        .order("created_at", { ascending: false });

      if (!isCurrentCharacterSheetRequest({
        activeCharacterId: characterId,
        requestedCharacterId,
        activeRequestId: identityRequestRef.current,
        requestId,
      })) return null;
      if (equipmentResult.error) throw equipmentResult.error;

      const nextSheet = sheetResult.data?.sheet || {};
      const rows = equipmentResult.data || [];
      const derived = deriveEquippedItemEffects(rows);
      const nextAuthority = authorityResult.data && typeof authorityResult.data === "object" ? authorityResult.data : null;
      const nextSnapshot = {
        characterId: requestedCharacterId,
        ownerType: resolvedOwnerType,
        sheet: deepClone(nextSheet),
        rows,
        itemBonuses: derived.effects,
        equipmentBreakdown: derived.breakdown,
        equipmentText: rows.map(itemName).filter(Boolean).join("\n"),
        revision: identityRevision(nextSheet, rows),
        reason,
      };

      setIdentitySnapshot(nextSnapshot);
      setAuthoritativeEffects(nextAuthority);
      setIdentityError("");
      if (hardReset || !editModeRef.current) applyDraftSnapshot(nextSheet, { closeEditor: hardReset });

      if (authorityResult.error) {
        const code = String(authorityResult.error?.code || "");
        if (code !== "42501" && code !== "PGRST202") {
          console.warn("Authoritative equipment effects unavailable; using local display effects.", authorityResult.error);
        }
      }

      return nextSnapshot;
    } catch (error) {
      if (!isCurrentCharacterSheetRequest({
        activeCharacterId: characterId,
        requestedCharacterId,
        activeRequestId: identityRequestRef.current,
        requestId,
      })) return null;
      setIdentityError(String(error?.message || error || "Failed to load the selected character sheet."));
      if (hardReset) {
        setIdentitySnapshot(null);
        setAuthoritativeEffects(null);
      }
      return null;
    } finally {
      if (isCurrentCharacterSheetRequest({
        activeCharacterId: characterId,
        requestedCharacterId,
        activeRequestId: identityRequestRef.current,
        requestId,
      })) {
        setIdentityLoading(false);
      }
    }
  }, [applyDraftSnapshot, characterId, ownerTypeHint]);

  useEffect(() => {
    const nextIdentity = normalizeCharacterIdentity(characterId);
    const hardReset = characterIdentityChanged(loadedIdentityRef.current, nextIdentity);
    void loadIdentitySnapshot({ hardReset, reason: hardReset ? "selection" : "equipment" });
    return () => {
      identityRequestRef.current += 1;
    };
  }, [characterId, effectsKey, loadIdentitySnapshot]);

  const identityReady = !characterId || identitySnapshot?.characterId === characterId;
  const currentSheet = characterId && identityReady ? identitySnapshot?.sheet || {} : sheet || {};
  const currentLocalBonuses = characterId && identityReady ? identitySnapshot?.itemBonuses || {} : itemBonuses;
  const currentEquipmentText = characterId && identityReady ? identitySnapshot?.equipmentText || "" : equipmentOverride;
  const currentEquipmentBreakdown = characterId && identityReady ? identitySnapshot?.equipmentBreakdown || [] : equipmentBreakdown;

  const resolvedItemBonuses = useMemo(
    () => mergeAuthoritativeEquipmentEffects(currentLocalBonuses, identityReady ? authoritativeEffects : null),
    [currentLocalBonuses, authoritativeEffects, identityReady]
  );
  const resolvedEffectsKey = `${String(effectsKey || "")}|identity:${identitySnapshot?.revision || "loading"}|authority:${authoritativeEffectsRevision(identityReady ? authoritativeEffects : null)}`;

  // Keep uncontrolled callers in sync. Identity-aware controlled callers are
  // synchronized only by the guarded snapshot loader above, never by an
  // untagged parent response that may belong to a previous character.
  useEffect(() => {
    if (characterId || draftIsControlled) return;
    applyDraftSnapshot(sheet || {}, { closeEditor: true });
    setSaveErr("");
    setSaving(false);
  }, [applyDraftSnapshot, characterId, draftIsControlled, sheet]);

  // A browser can suspend network work while this tab is hidden. Reconcile the
  // current identity when focus returns, but never overwrite an active edit.
  useEffect(() => {
    if (!characterId || typeof document === "undefined" || typeof window === "undefined") return undefined;

    const refreshVisibleIdentity = () => {
      if (document.visibilityState !== "visible" || editModeRef.current) return;
      const now = Date.now();
      if (now - visibilityRefreshRef.current < 750) return;
      visibilityRefreshRef.current = now;
      void loadIdentitySnapshot({ hardReset: false, reason: "visibility" });
    };

    document.addEventListener("visibilitychange", refreshVisibleIdentity);
    window.addEventListener("focus", refreshVisibleIdentity);
    return () => {
      document.removeEventListener("visibilitychange", refreshVisibleIdentity);
      window.removeEventListener("focus", refreshVisibleIdentity);
    };
  }, [characterId, loadIdentitySnapshot]);

  const sheetDirty = useMemo(() => {
    try {
      return JSON.stringify(draft || {}) !== JSON.stringify(currentSheet || {});
    } catch {
      return true;
    }
  }, [currentSheet, draft]);

  const dirty = sheetDirty || !!extraDirty;

  const saveState = saving ? "Saving…" : dirty ? "Unsaved" : "Saved";

  async function toggleEditOrSave() {
    if (!editable) return;

    // entering edit mode
    if (!editMode) {
      applyDraftSnapshot(currentSheet || {});
      setEditMode(true);
      return;
    }

    // leaving edit mode: save if dirty
    if (!canSave || !onSave) {
      setEditMode(false);
      return;
    }

    if (!dirty) {
      setEditMode(false);
      return;
    }

    setSaving(true);
    setSaveErr("");
    try {
      await onSave(draft || {});
      if (characterId) {
        setIdentitySnapshot((current) => current?.characterId === characterId
          ? { ...current, sheet: deepClone(draft || {}), revision: identityRevision(draft || {}, current.rows || []) }
          : current);
      }
      setEditMode(false);
    } catch (e) {
      setSaveErr(String(e?.message || e || "Failed to save sheet."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={sheetRootRef} className={`csheet ${editMode ? "csheet--edit" : "csheet--view"}`}>
      <div className="csheet-head">
        <div className="csheet-title">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="csheet-name">{characterName || "Character"}</div>
            {nameRight ? <div className="ms-auto">{nameRight}</div> : null}
          </div>
          {metaLine && identityReady ? <div className="csheet-meta">{metaLine}</div> : null}
        </div>

        <div className="csheet-actions">
          {typeof onOpenStore === "function" ? (
            <button
              type="button"
              className="btn btn-sm me-2"
              onClick={onOpenStore}
              title="Open this character's storefront"
              style={{ backgroundColor: "#12c6ff", border: "0", color: "#001019" }}
            >
              {storeText}
            </button>
          ) : storeHref ? (
            <a
              className="btn btn-sm me-2"
              href={storeHref}
              target="_blank"
              rel="noreferrer"
              title="Open this character's storefront"
              style={{ backgroundColor: "#12c6ff", border: "0", color: "#001019" }}
            >
              {storeText}
            </a>
          ) : null}

          {inventoryHref ? (
            <a
              className="btn btn-sm btn-outline-light me-2"
              href={inventoryHref}
              target="_blank"
              rel="noreferrer"
              title="Open this character's inventory"
            >
              {inventoryText}
            </a>
          ) : null}

          {typeof onOpenProfile === "function" ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-info me-2"
              onClick={onOpenProfile}
              title="Open this character profile"
            >
              {profileText}
            </button>
          ) : profileHref ? (
            <a
              className="btn btn-sm btn-outline-info me-2"
              href={profileHref}
              title="Open this character profile"
            >
              {profileText}
            </a>
          ) : null}

          {typeof onToggleMapVisible === "function" && mapVisible !== null ? (
            <button
              type="button"
              className={`btn btn-sm me-2 ${mapVisible ? "btn-outline-warning" : "btn-warning"}`}
              onClick={onToggleMapVisible}
              disabled={!!mapToggleDisabled || saving}
              title={mapToggleTitle || (mapVisible ? "Hide this character from the map" : "Show this character on the map")}
              style={mapVisible ? undefined : { color: "#1a1200" }}
            >
              {mapVisible ? "Hide from Map" : "Add to Map"}
            </button>
          ) : null}

          {locationLabel !== null ? (
            editMode && typeof onChangeLocation === "function" && Array.isArray(locationOptions) ? (
              <select
                className="form-select form-select-sm me-2"
                style={{ minWidth: 220, maxWidth: 260 }}
                value={locationValue || ""}
                disabled={!!locationDisabled || saving}
                onChange={(e) => onChangeLocation(e.target.value || null)}
                title="Set current location (characters listed at a location are off-map until you toggle On Map)"
              >
                <option value="">Not listed</option>
                {locationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            ) : (
              <div
                className="me-2 px-2 py-1 rounded"
                title="Current location listing"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.90)",
                  fontSize: 12,
                  lineHeight: "18px",
                  maxWidth: 260,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {locationLabel}
              </div>
            )
          ) : null}

          {typeof onToggleLocationListed === "function" && locationListed !== null ? (
            <button
              type="button"
              className={`btn btn-sm me-2 ${locationListed ? "btn-outline-warning" : "btn-warning"}`}
              onClick={onToggleLocationListed}
              disabled={!!locationToggleDisabled || saving}
              title={locationToggleTitle || (locationListed ? "Remove this character from the location roster" : "List this character at their selected location")}
              style={locationListed ? undefined : { color: "#1a1200" }}
            >
              {locationListed ? "Not listed" : "List at Location"}
            </button>
          ) : null}

          <span className={`csheet-save-pill ${dirty ? "dirty" : ""}`}>{saveState}</span>
          {editable ? (
            <button className="btn btn-sm btn-outline-light ms-2" onClick={toggleEditOrSave} disabled={saving}>
              {editMode ? "Done" : "Edit"}
            </button>
          ) : null}
          {editMode && typeof onDelete === "function" ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger ms-2"
              onClick={onDelete}
              disabled={!!deleteDisabled || saving}
              title={deleteTitle}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {saveErr ? <div className="alert alert-danger py-2 m-2">{saveErr}</div> : null}
      {identityError ? <div className="alert alert-danger py-2 m-2">{identityError}</div> : null}

      {!identityReady ? (
        <div className="p-3 text-muted" role="status">Loading the selected character sheet…</div>
      ) : (
        <>
          <CharacterSheet5e
            sheet={editMode ? draft || {} : currentSheet || {}}
            onChange={setDraft}
            editable={editMode && editable}
            onRoll={onRoll}
            itemBonuses={resolvedItemBonuses}
            equipmentOverride={currentEquipmentText}
            equipmentBreakdown={currentEquipmentBreakdown}
            effectsKey={resolvedEffectsKey}
          />
          <CharacterSheetEnhancements
            rootRef={sheetRootRef}
            sheet={editMode ? draft || {} : currentSheet || {}}
            onSheetUpdated={(nextSheet) => nextSheet ? setDraft(deepClone(nextSheet)) : null}
          />
          {identityLoading ? <div className="small text-muted px-3 pb-2" role="status">Refreshing this character’s equipment…</div> : null}
        </>
      )}
    </div>
  );
}

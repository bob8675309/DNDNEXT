import { useEffect, useMemo, useState } from "react";
import CharacterSheet5e from "./CharacterSheet5e";

function deepClone(obj) {
  try {
    return structuredClone(obj ?? {});
  } catch {
    return JSON.parse(JSON.stringify(obj ?? {}));
  }
}

/**
 * CharacterSheetPanel
 *
 * Supports both:
 *  - Uncontrolled draft/editMode (default)
 *  - Controlled draft/editMode (when a parent needs to render/edit parts of the sheet elsewhere)
 */
export default function CharacterSheetPanel({
  sheet,
  characterName,
  nameRight = null,
  metaLine = null,
  inventoryHref = null,
  storeHref = null,
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
  const draftIsControlled = typeof setControlledDraft === "function";
  const editIsControlled = typeof setControlledEditMode === "function";

  const [internalDraft, setInternalDraft] = useState(() => deepClone(sheet || {}));
  const [internalEditMode, setInternalEditMode] = useState(false);

  const draft = draftIsControlled ? controlledDraft ?? {} : internalDraft;
  const setDraft = draftIsControlled ? setControlledDraft : setInternalDraft;

  const editMode = editIsControlled ? !!controlledEditMode : internalEditMode;
  const setEditMode = editIsControlled ? setControlledEditMode : setInternalEditMode;

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // Keep draft in sync when selection changes / sheet reloads.
  useEffect(() => {
    const next = deepClone(sheet || {});

    if (draftIsControlled) setControlledDraft(next);
    else setInternalDraft(next);

    if (editIsControlled) setControlledEditMode(false);
    else setInternalEditMode(false);

    setSaveErr("");
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  const sheetDirty = useMemo(() => {
    try {
      return JSON.stringify(draft || {}) !== JSON.stringify(sheet || {});
    } catch {
      return true;
    }
  }, [draft, sheet]);

  const dirty = sheetDirty || !!extraDirty;

  const saveState = saving ? "Saving…" : dirty ? "Unsaved" : "Saved";

  async function toggleEditOrSave() {
    if (!editable) return;

    // entering edit mode
    if (!editMode) {
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
      setEditMode(false);
    } catch (e) {
      setSaveErr(String(e?.message || e || "Failed to save sheet."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`csheet ${editMode ? "csheet--edit" : "csheet--view"}`}>
      <div className="csheet-head">
        <div className="csheet-title">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="csheet-name">{characterName || "Character"}</div>
            {nameRight ? <div className="ms-auto">{nameRight}</div> : null}
          </div>
          {metaLine ? <div className="csheet-meta">{metaLine}</div> : null}
        </div>

        <div className="csheet-actions">
          {storeHref ? (
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

          {editMode && typeof onDelete === "function" ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger me-2"
              onClick={onDelete}
              disabled={!!deleteDisabled || saving}
              title={deleteTitle}
            >
              Delete
            </button>
          ) : null}

          <span className={`csheet-status ${dirty ? "is-dirty" : "is-clean"}`}>{saveState}</span>

          {editable ? (
            <button
              type="button"
              className={`btn btn-sm ${editMode ? "btn-primary" : "btn-outline-light"}`}
              onClick={toggleEditOrSave}
              disabled={saving}
              title={
                editMode
                  ? dirty
                    ? "Save sheet and exit edit mode"
                    : "Exit edit mode"
                  : "Edit character sheet"
              }
            >
              {saving ? "Saving…" : editMode ? (dirty ? "Save" : "Done") : "Edit"}
            </button>
          ) : null}
        </div>
      </div>

      {saveErr ? <div className="alert alert-danger py-2 my-2 mb-0">{saveErr}</div> : null}

      <div className="mt-2">
        <CharacterSheet5e
          sheet={draft || {}}
          editable={!!editable && !!editMode}
          onChange={setDraft}
          onRoll={onRoll}
          itemBonuses={itemBonuses}
          equipmentOverride={equipmentOverride}
          equipmentBreakdown={equipmentBreakdown}
          effectsKey={effectsKey}
        />
      </div>
    </div>
  );
}

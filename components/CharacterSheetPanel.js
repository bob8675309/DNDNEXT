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
  metaLine = null,
  equippedItems = [],    // NEW prop
  inventoryHref = null,
  inventoryText = "Inventory",
  editable = false, // permission to edit (admin)
  canSave = false, // permission to save (admin)
  onSave, // async (nextSheet) => void
  onRoll, // (rollResult) => void

  // Optional dirty flag (when parent edits non-sheet fields under the same edit toggle)
  extraDirty = false,

  // Optional controlled state
  draft: controlledDraft,
  setDraft: setControlledDraft,
  editMode: controlledEditMode,
  setEditMode: setControlledEditMode,
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
          <div className="csheet-name">{characterName || "Character"}</div>
          {metaLine ? <div className="csheet-meta">{metaLine}</div> : null}
        </div>

        <div className="csheet-actions">
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
			equippedItems={equippedItems}   // NEW
/>

      </div>
    </div>
  );
}
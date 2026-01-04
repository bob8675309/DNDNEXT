// components/CharacterSheetPanel.js
import { useEffect, useMemo, useState } from "react";
import CharacterSheet5e from "./CharacterSheet5e";

function deepClone(obj) {
  try {
    return structuredClone(obj ?? {});
  } catch {
    return JSON.parse(JSON.stringify(obj ?? {}));
  }
}

export default function CharacterSheetPanel({
  sheet,
  characterName,
  metaLine = null,
  editable = false, // permission to edit (admin)
  canSave = false,  // permission to save (admin)
  onSave,           // async (nextSheet) => void
  onRoll,           // (rollResult) => void
}) {
  const [draft, setDraft] = useState(() => deepClone(sheet || {}));
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // keep draft in sync when selection changes
  useEffect(() => {
    setDraft(deepClone(sheet || {}));
    setSaveErr("");
    setSaving(false);
    setEditMode(false);
  }, [sheet]);

  const dirty = useMemo(() => {
    try {
      return JSON.stringify(draft || {}) !== JSON.stringify(sheet || {});
    } catch {
      return true;
    }
  }, [draft, sheet]);

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
          <span className={`csheet-status ${dirty ? "is-dirty" : "is-clean"}`}>{saveState}</span>

          {editable ? (
            <button
              type="button"
              className={`btn btn-sm ${editMode ? "btn-primary" : "btn-outline-light"}`}
              onClick={toggleEditOrSave}
              disabled={saving}
              title={editMode ? (dirty ? "Save sheet and exit edit mode" : "Exit edit mode") : "Edit character sheet"}
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
        />
      </div>
    </div>
  );
}

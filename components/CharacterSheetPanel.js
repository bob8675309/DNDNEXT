// /components/CharacterSheetPanel.js
// Simplified character sheet wrapper that handles editing state and save logic.
// Accepts equippedItems and inventoryLinkBase props and passes them through to CharacterSheet5e.

import { useState, useEffect } from "react";
import CharacterSheet5e from "./CharacterSheet5e";

// Compare JSON structures (shallow) for dirty check
function jsonEqual(a, b) {
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return false;
  }
}

export default function CharacterSheetPanel({
  sheet,
  draft,
  setDraft,
  editMode,
  setEditMode,
  characterName,
  metaLine,
  editable = false,
  canSave = false,
  extraDirty = false,
  equippedItems = [],
  inventoryLinkBase = "",
  onSave = () => {},
  onRoll = () => {},
}) {
  // Internal state for dirty tracking
  const [dirty, setDirty] = useState(false);

  // Compute dirty when draft changes
  useEffect(() => {
    setDirty(!jsonEqual(sheet, draft));
  }, [sheet, draft]);

  // Handle toggle edit/save
  async function handleEditToggle() {
    if (!editMode) {
      // entering edit mode
      setEditMode(true);
    } else {
      // leaving edit mode: save
      if (canSave) {
        await onSave(draft);
      }
      setEditMode(false);
    }
  }

  return (
    <div className="csheet-shell">
      {/* Header */}
      <div className="csheet-head d-flex align-items-center gap-2 mb-2">
          <div className="csheet-name flex-grow-1">{characterName || "Character"}</div>
          {metaLine && <div className="csheet-sub small">{metaLine}</div>}
          {editable && (
            <button
              className="btn btn-sm btn-outline-light"
              onClick={handleEditToggle}
            >
              {editMode ? (dirty || extraDirty ? "Save" : "Done") : "Edit"}
            </button>
          )}
      </div>
      {/* Mark dirty status */}
      {editMode && (dirty || extraDirty) && (
        <div className="small text-warning mb-2">Unsaved changes</div>
      )}
      {/* Body: character sheet component */}
      <CharacterSheet5e
        sheet={draft}
        onChange={setDraft}
        editMode={editMode}
        onRoll={onRoll}
        equippedItems={equippedItems}
        inventoryLinkBase={inventoryLinkBase}
      />
    </div>
  );
}
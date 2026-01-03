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

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function roll4d6DropLowest() {
  const rolls = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((a, b) => a - b);
  return rolls[1] + rolls[2] + rolls[3];
}

const ABIL_ORDER = ["str", "dex", "con", "int", "wis", "cha"];

export default function CharacterSheetPanel({
  sheet,
  characterName,
  editable = false,
  canSave = false,
  onSave,     // async (nextSheet) => void
  onRoll,     // (rollResult) => void
}) {
  const [draft, setDraft] = useState(() => deepClone(sheet || {}));
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // keep draft in sync when selection changes
  useEffect(() => {
    setDraft(deepClone(sheet || {}));
    setSaveErr("");
    setSaving(false);
  }, [sheet]);

  const dirty = useMemo(() => {
    try {
      return JSON.stringify(draft || {}) !== JSON.stringify(sheet || {});
    } catch {
      return true;
    }
  }, [draft, sheet]);

  function applyRolledStats() {
    setDraft((prev) => {
      const next = deepClone(prev || {});
      next.abilities = next.abilities || {};
      for (const k of ABIL_ORDER) {
        next.abilities[k] = next.abilities[k] || {};
        next.abilities[k].score = roll4d6DropLowest();
      }
      // default PB if missing (you can change later)
      if (next.proficiencyBonus == null) next.proficiencyBonus = 2;
      return next;
    });
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    setSaveErr("");
    try {
      await onSave(draft || {});
    } catch (e) {
      setSaveErr(String(e?.message || e || "Failed to save sheet."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="csheet">
      <div className="csheet-head">
        <div className="csheet-name">{characterName || "Character"}</div>

        <div className="csheet-actions">
          {editable && (
            <button
              type="button"
              className="btn btn-sm btn-outline-light"
              onClick={applyRolledStats}
              title="Roll 4d6 drop lowest for each ability"
            >
              Roll Stats (4d6 drop low)
            </button>
          )}

          {canSave && onSave && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleSave}
              disabled={!dirty || saving}
              title={!dirty ? "No changes to save" : "Save sheet JSON"}
            >
              {saving ? "Saving…" : dirty ? "Save sheet" : "Saved"}
            </button>
          )}
        </div>
      </div>

      {saveErr ? (
        <div className="alert alert-danger py-2 my-2 mb-0">{saveErr}</div>
      ) : null}

      <div className="mt-2">
        <CharacterSheet5e
          sheet={draft || {}}
          editable={editable}
          onChange={setDraft}
          onRoll={onRoll}
        />
      </div>
    </div>
  );
}

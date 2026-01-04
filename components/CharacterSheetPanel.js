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
  editable = false, // edit mode flag (controlled by parent)
  canSave = false,
  onSave,     // async (nextSheet) => void
  onRoll,     // (rollResult) => void
  meta,       // optional: { race, alignment, classLevel, xp, xpNext }
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

  const metaLine = useMemo(() => {
    const m = meta || {};
    const race = m.race || draft?.race || "";
    const alignment = m.alignment || draft?.alignment || "";
    const classLevel = m.classLevel || draft?.classLevel || "";
    const xp = m.xp ?? draft?.xp;
    const xpNext = m.xpNext ?? draft?.xpNext;

    const parts = [race, alignment, classLevel].filter(Boolean);

    // XP shown only if at least one value exists
    const hasXp = xp != null || xpNext != null;
    if (hasXp) {
      const left = xp != null && xp !== "" ? String(xp) : "—";
      const right = xpNext != null && xpNext !== "" ? String(xpNext) : "—";
      parts.push(`${left}/${right} XP`);
    }

    return parts.join(" • ") || "—";
  }, [meta, draft]);

  const isEditing = !!editable;

  return (
    <div className={`csheet ${isEditing ? "is-edit" : "is-view"}`}>
      <div className="csheet-head">
        <div className="csheet-titlewrap">
          <div className="csheet-name">{characterName || "Character"}</div>
          <div className="csheet-meta">{metaLine}</div>
        </div>

        <div className="csheet-actions">
          {canSave && onSave && isEditing && (
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
          editable={isEditing}
          onChange={setDraft}
          onRoll={onRoll}
          onRollStats={applyRolledStats}
        />
      </div>
    </div>
  );
}

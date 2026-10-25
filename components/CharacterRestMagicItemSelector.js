import { useState } from "react";
import { supabase } from "../utils/supabaseClient";
import styles from "../styles/CharacterRestActivityDialog.module.css";

// This saves choices only. The effects adapter must separately honor these
// choices after source/consumer parity; no magical bonus is changed here.
export default function CharacterRestMagicItemSelector({
  characterId,
  snapshot,
  encounterLocked = false,
  onSaved,
  onBack,
  onBusyChange,
  backRef,
}) {
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  const cap = Number(snapshot?.maxItems) || 3;
  const [chosen, setChosen] = useState(() =>
    items.filter((i) => i?.isSelected).map((i) => String(i.itemId))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(id) {
    if (saving || encounterLocked) return;
    setError("");
    setChosen((previous) => {
      if (previous.includes(id)) return previous.filter((current) => current !== id);
      if (previous.length >= cap) {
        setError("Select no more than " + cap + " magic items.");
        return previous;
      }
      return [...previous, id];
    });
  }

  async function save() {
    if (saving || encounterLocked || !snapshot?.enabled || !characterId) return;
    if (chosen.length > cap) {
      setError("The selected items exceed the campaign limit.");
      return;
    }
    setSaving(true);
    onBusyChange?.(true);
    setError("");
    try {
      const { data, error: saveError } = await supabase.rpc("set_character_rest_magic_choices_v1", {
        p_character_id: characterId,
        p_item_ids: chosen,
      });
      if (saveError) throw saveError;
      if (!data || data.enabled !== true || data.effectsEnforced !== false) {
        throw new Error("The saved selection could not be verified.");
      }
      onSaved?.(data);
    } catch (err) {
      setError(err?.message || "Could not save magic item choices.");
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className={styles.picker}>
      <button
        type="button"
        ref={backRef}
        className={styles.cancel}
        disabled={saving}
        onClick={onBack}
      >Back to activities</button>
      <h3 className={styles.pickerTitle}>Choose your magic items</h3>
      <p className={styles.activityDescription}>
        Select up to {cap} equipped magic items ({chosen.length}/{cap} chosen).
        Items remain equipped; this does not move or destroy gear.
      </p>
      <p className={styles.note}>
        Selection is saved for the optional rule. Applying the limit to magical
        bonuses is not enabled yet.
      </p>
      {!items.length ? (
        <p className={styles.note}>No magic items are assigned to this character. Equip an eligible item to select it.</p>
      ) : (
        <div className={styles.choiceList}>
          {items.map((item) => {
            const id = String(item.itemId);
            const checked = chosen.includes(id);
            const canPick = Boolean(item.selectable) && !encounterLocked;
            return (
              <label className={styles.choiceRow} key={id}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={saving || !canPick || (!checked && chosen.length >= cap)}
                  onChange={() => toggle(id)}
                  aria-label={"Select " + (item.name || "magic item")}
                />
                <span className={styles.choiceText}>
                  <strong>{item.name || "Unnamed magic item"}</strong>
                  <small>{item.rarity || "Unknown rarity"} · {item.slot || "No equipment slot"}{item.reason ? " · " + item.reason : ""}</small>
                </span>
              </label>
            );
          })}
        </div>
      )}
      {encounterLocked ? <p role="alert" className={styles.error}>You cannot change magic items during combat.</p> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <button
        type="button"
        className={styles.saveChoices}
        disabled={saving || encounterLocked || !snapshot?.enabled}
        onClick={save}
      >{saving ? "Saving…" : "Save selected magic items"}</button>
    </div>
  );
}

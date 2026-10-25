import { useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import CharacterRestMagicItemSelector from "./CharacterRestMagicItemSelector";
import { createPortal } from "react-dom";
import styles from "../styles/CharacterRestActivityDialog.module.css";

/**
 * Activity selection is deliberately separate from the canonical rest RPC.
 * Rest & Recover uses the unchanged canonical rest RPC; optional item
 * selection saves choices separately and never activates item effects.
 */
export default function CharacterRestActivityDialog({
  restType,
  characterId,
  busy = false,
  encounterLocked = false,
  error = "",
  onRecover,
  onClose,
}) {
  const primaryRef = useRef(null);
  const pickerBackRef = useRef(null);
  const dialogRef = useRef(null);
  const [selectionState, setSelectionState] = useState(null);
  const [selectionError, setSelectionError] = useState("");
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectionNotice, setSelectionNotice] = useState("");
  const combinedBusy = busy || selectionBusy;
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  onCloseRef.current = onClose;
  busyRef.current = combinedBusy;

  useEffect(() => {
    let mounted = true;
    if (!characterId) return () => { mounted = false; };
    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc("get_character_rest_magic_choices_v1", {
          p_character_id: characterId,
        });
        if (rpcError) throw rpcError;
        if (mounted) setSelectionState(data || null);
      } catch (err) {
        // Optional attunement must never block ordinary Short/Long Rest.
        if (mounted) setSelectionError(err?.message || "Magic item choices are unavailable.");
      }
    })();
    return () => { mounted = false; };
  }, [characterId]);

  useEffect(() => {
    if (pickerOpen) pickerBackRef.current?.focus();
    else primaryRef.current?.focus();
  }, [pickerOpen]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    primaryRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (!busyRef.current) {
          event.preventDefault();
          onCloseRef.current?.();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll("button:not([disabled]), input:not([disabled])") || []);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  if (typeof document === "undefined") return null;

  const isLong = restType === "long_rest";
  const title = isLong ? "Long Rest" : "Short Rest";
  const recoveryDescription = isLong
    ? "Restore tracked spell slots and abilities that recover on a Short or Long Rest."
    : "Restore eligible Pact Magic slots and abilities that recover on a Short Rest.";
  const unavailable = combinedBusy || encounterLocked;
  const attunementEnabled = selectionState?.enabled === true;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (!combinedBusy && event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-rest-activity-title"
        aria-describedby="character-rest-activity-summary"
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Camp &amp; Downtime</span>
            <h2 id="character-rest-activity-title">{title}</h2>
          </div>
          <button type="button" className={styles.close} disabled={combinedBusy} onClick={onClose} aria-label="Close rest activities">
            ×
          </button>
        </header>
        <p className={styles.intro} id="character-rest-activity-summary">
          Choose what your character will do during this rest.
        </p>

        {pickerOpen && attunementEnabled ? (
          <CharacterRestMagicItemSelector
            characterId={characterId}
            snapshot={selectionState}
            encounterLocked={encounterLocked}
            onSaved={(updated) => {
              setSelectionState(updated);
              setPickerOpen(false);
              setSelectionNotice("Magic item choices saved. Existing magical bonuses are unchanged.");
            }}
            onBack={() => setPickerOpen(false)}
            onBusyChange={setSelectionBusy}
            backRef={pickerBackRef}
          />
        ) : (
          <div className={styles.activities}>
            <button
              type="button"
              ref={primaryRef}
              className={styles.recover}
              disabled={unavailable}
              onClick={onRecover}
            >
              <span className={styles.activityTitle}>Rest &amp; Recover</span>
              <span className={styles.activityDescription}>{recoveryDescription}</span>
              <span className={styles.actionLabel}>{busy ? "Recovering…" : "Complete rest"}</span>
            </button>

            {attunementEnabled ? (
              <button
                type="button"
                className={styles.recover}
                disabled={unavailable}
                onClick={() => { setSelectionNotice(""); setPickerOpen(true); }}
              >
                <span className={styles.activityTitle}>Attune / Change Magic Items</span>
                <span className={styles.activityDescription}>Choose up to {selectionState.maxItems} equipped magic items for the optional campaign rule.</span>
                <span className={styles.actionLabel}>Review magic item choices</span>
              </button>
            ) : null}

            <div className={styles.upcoming} aria-disabled="true">
              <span className={styles.activityTitle}>Work on Crafting</span>
              <span className={styles.activityDescription}>Crafting activities will be available in a later update.</span>
              <span className={styles.soon}>Coming later</span>
            </div>
          </div>
        )}
        {selectionNotice ? <p role="status" className={styles.note}>{selectionNotice}</p> : null}

        <p className={styles.note}>
          Rest &amp; Recover restores tracked spells and abilities, not HP or Hit Dice. Item selection does not yet change magical bonuses.
        </p>
        {encounterLocked ? <p role="alert" className={styles.error}>Resting is unavailable during active combat.</p> : null}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        {selectionError && !attunementEnabled ? <p className={styles.note}>Optional magic-item choices are unavailable; normal rest still works.</p> : null}
        <footer className={styles.footer}>
          <button type="button" onClick={onClose} disabled={combinedBusy} className={styles.cancel}>Cancel</button>
        </footer>
      </section>
    </div>,
    document.body
  );
}

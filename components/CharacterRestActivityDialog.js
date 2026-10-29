import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "../styles/CharacterRestActivityDialog.module.css";

/**
 * Activity selection is deliberately separate from the canonical rest RPC.
 * Only Rest & Recover is wired today. Attunement and crafting do not yet
 * have approved rest-activity actions; never pretend they were completed.
 */
export default function CharacterRestActivityDialog({
  restType,
  busy = false,
  encounterLocked = false,
  error = "",
  attunementEnabled = false,
  onRecover,
  onClose,
}) {
  const primaryRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  onCloseRef.current = onClose;
  busyRef.current = busy;

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
      const controls = Array.from(dialogRef.current?.querySelectorAll("button:not([disabled])") || []);
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
  const unavailable = busy || encounterLocked;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onClose?.();
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
          <button type="button" className={styles.close} disabled={busy} onClick={onClose} aria-label="Close rest activities">
            ×
          </button>
        </header>
        <p className={styles.intro} id="character-rest-activity-summary">
          Choose what your character will do during this rest.
        </p>

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
            <div className={styles.upcoming} aria-disabled="true">
              <span className={styles.activityTitle}>Attune / Change Magic Items</span>
              <span className={styles.activityDescription}>Choose magic items during your rest.</span>
              <span className={styles.soon}>Pending campaign-rule integration</span>
            </div>
          ) : null}

          <div className={styles.upcoming} aria-disabled="true">
            <span className={styles.activityTitle}>Work on Crafting</span>
            <span className={styles.activityDescription}>Crafting activities will be available in a later update.</span>
            <span className={styles.soon}>Coming later</span>
          </div>
        </div>

        <p className={styles.note}>
          This control restores tracked spells and abilities, not HP or Hit Dice. Other rest activities will be added without changing the two rest buttons.
        </p>
        {encounterLocked ? <p role="alert" className={styles.error}>Resting is unavailable during active combat.</p> : null}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <footer className={styles.footer}>
          <button type="button" onClick={onClose} disabled={busy} className={styles.cancel}>Cancel</button>
        </footer>
      </section>
    </div>,
    document.body
  );
}

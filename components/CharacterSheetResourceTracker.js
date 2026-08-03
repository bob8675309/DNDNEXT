import styles from "../styles/CharacterSheetResourceTracker.module.css";

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatRestTime(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString();
}

function rechargeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (normalized === "short rest") return "Short Rest";
  if (normalized === "long rest") return "Long Rest";
  return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Manual";
}

function ResourcePips({ maximum, remaining }) {
  const max = Math.max(0, Math.min(12, safeNumber(maximum)));
  const left = Math.max(0, Math.min(max, safeNumber(remaining)));
  if (!max) return null;
  return (
    <span className={styles.pips} aria-label={`${left} of ${max} remaining`}>
      {Array.from({ length: max }, (_, index) => (
        <span key={index} className={`${styles.pip} ${index < left ? styles.pipReady : styles.pipSpent}`} />
      ))}
    </span>
  );
}

function ResourceButtons({ busy, remaining, maximum, onUse, onRestore, label }) {
  const current = safeNumber(remaining);
  const max = safeNumber(maximum);
  return (
    <div className={styles.rowActions}>
      <button type="button" disabled={busy || current <= 0} onClick={onUse} title={`Use one ${label}`}>
        Use
      </button>
      <button type="button" disabled={busy || current >= max} onClick={onRestore} title={`Restore one ${label}`}>
        Restore
      </button>
    </div>
  );
}

export default function CharacterSheetResourceTracker({
  profile = null,
  loading = false,
  error = "",
  busyKey = "",
  onSlotOperation = null,
  onSpellUseOperation = null,
  onRest = null,
}) {
  const slots = Array.isArray(profile?.slots) ? profile.slots : [];
  const limitedSpellUses = Array.isArray(profile?.limitedSpellUses) ? profile.limitedSpellUses : [];
  const restResult = profile?.restResult && typeof profile.restResult === "object" ? profile.restResult : null;

  return (
    <section className={styles.root} aria-label="Spell resources and rests">
      <div className={styles.header}>
        <div>
          <strong>Spell Resources &amp; Rest</strong>
          <span>Persistent in-person tracking</span>
        </div>
        <div className={styles.restButtons}>
          <button type="button" disabled={loading || Boolean(busyKey)} onClick={() => onRest?.("short_rest")}>
            Short Rest
          </button>
          <button type="button" disabled={loading || Boolean(busyKey)} onClick={() => onRest?.("long_rest")}>
            Long Rest
          </button>
        </div>
      </div>

      {loading ? <div className={styles.message}>Loading tracked resources…</div> : null}
      {error ? <div className={`${styles.message} ${styles.error}`} role="alert">{error}</div> : null}

      {!loading && !error ? (
        <>
          {slots.length ? (
            <div className={styles.group}>
              <div className={styles.groupTitle}>Spell Slots</div>
              {slots.map((slot) => {
                const poolKey = String(slot?.poolKey || "spellcasting");
                const level = safeNumber(slot?.slotLevel);
                const maximum = safeNumber(slot?.max);
                const remaining = safeNumber(slot?.remaining);
                const key = `${poolKey}:${level}`;
                const label = poolKey === "pact_magic" ? `Level ${level} Pact Magic slot` : `level ${level} spell slot`;
                return (
                  <div className={styles.resourceRow} key={key}>
                    <div className={styles.resourceIdentity}>
                      <strong>{poolKey === "pact_magic" ? `Pact Magic — Level ${level}` : `Level ${level} Slots`}</strong>
                      <span>{rechargeLabel(slot?.rechargeKey)}</span>
                    </div>
                    <ResourcePips maximum={maximum} remaining={remaining} />
                    <span className={styles.count}>{remaining}/{maximum}</span>
                    <ResourceButtons
                      busy={busyKey.startsWith(`slot:${key}:`)}
                      remaining={remaining}
                      maximum={maximum}
                      label={label}
                      onUse={() => onSlotOperation?.(slot, "use")}
                      onRestore={() => onSlotOperation?.(slot, "restore")}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.message}>This character has no class spell-slot pool.</div>
          )}

          {limitedSpellUses.length ? (
            <div className={styles.group}>
              <div className={styles.groupTitle}>Limited Spell Uses</div>
              {limitedSpellUses.map((entry) => {
                const assignmentId = String(entry?.assignmentId || "");
                const maximum = safeNumber(entry?.max);
                const remaining = safeNumber(entry?.remaining, maximum);
                return (
                  <div className={styles.resourceRow} key={assignmentId || `${entry?.name}-${entry?.level}`}>
                    <div className={styles.resourceIdentity}>
                      <strong>{entry?.name || "Spell"}</strong>
                      <span>{rechargeLabel(entry?.recharge)}</span>
                    </div>
                    <ResourcePips maximum={maximum} remaining={remaining} />
                    <span className={styles.count}>{remaining}/{maximum}</span>
                    <ResourceButtons
                      busy={busyKey.startsWith(`spell:${assignmentId}:`)}
                      remaining={remaining}
                      maximum={maximum}
                      label={`${entry?.name || "spell"} use`}
                      onUse={() => onSpellUseOperation?.(entry, "use")}
                      onRestore={() => onSpellUseOperation?.(entry, "restore")}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className={styles.restHistory}>
            <span><strong>Last Short Rest:</strong> {formatRestTime(profile?.lastShortRest)}</span>
            <span><strong>Last Long Rest:</strong> {formatRestTime(profile?.lastLongRest)}</span>
          </div>

          {restResult ? (
            <div className={styles.result} role="status">
              Rest recorded: restored {safeNumber(restResult.restoredSpellSlots)} spell slot{safeNumber(restResult.restoredSpellSlots) === 1 ? "" : "s"}
              {safeNumber(restResult.restoredSpellUses) ? ` and ${safeNumber(restResult.restoredSpellUses)} limited spell use${safeNumber(restResult.restoredSpellUses) === 1 ? "" : "s"}` : ""}.
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

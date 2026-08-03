import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import styles from "../styles/CharacterSheetResourceTracker.module.css";

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeName(value) {
  return safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
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

function updateSpellRows(root, profile) {
  if (!root || !profile) return;
  const slots = Array.isArray(profile.slots) ? profile.slots : [];
  const limitedUses = Array.isArray(profile.limitedSpellUses) ? profile.limitedSpellUses : [];
  const pactSlot = slots.find((slot) => safeText(slot?.poolKey) === "pact_magic") || null;
  const standardSlots = new Map(
    slots
      .filter((slot) => safeText(slot?.poolKey) === "spellcasting")
      .map((slot) => [safeNumber(slot?.slotLevel), slot])
  );
  const limitedByName = new Map(limitedUses.map((entry) => [normalizeName(entry?.name), entry]));

  for (const group of root.querySelectorAll(".csheet-action-group")) {
    const groupName = safeText(group.querySelector(".csheet-action-group__label span")?.textContent).toLowerCase();
    if (groupName !== "cantrips" && groupName !== "prepared spells") continue;

    for (const item of group.querySelectorAll(".csheet-action-item")) {
      const name = safeText(item.querySelector(".csheet-action-button__name")?.textContent);
      const detail = item.querySelector(".csheet-action-button__detail");
      if (!detail) continue;
      let nextText = safeText(detail.textContent);
      const limited = limitedByName.get(normalizeName(name));

      if (limited) {
        const maximum = safeNumber(limited.max);
        const remaining = safeNumber(limited.remaining, maximum);
        const recharge = safeText(limited.recharge).toLowerCase().replace(/[_-]+/g, " ");
        const replacement = `${remaining}/${maximum} uses${recharge ? ` • ${recharge}` : ""}`;
        nextText = nextText.replace(/\b\d+\/\d+\s+uses(?:\s*•\s*(?:short|long)\s+rest)?/i, replacement);
      } else if (pactSlot && groupName === "prepared spells") {
        const maximum = safeNumber(pactSlot.max);
        const remaining = safeNumber(pactSlot.remaining, maximum);
        const level = safeNumber(pactSlot.slotLevel);
        nextText = nextText.replace(
          /\b\d+(?:\/\d+)?\s+level-\d+\s+pact slots\b/i,
          `${remaining}/${maximum} level-${level} pact slots`
        );
      } else if (groupName === "prepared spells") {
        const tagText = safeText(item.querySelector(".csheet-action-button__tag")?.textContent);
        const levelMatch = tagText.match(/level\s+(\d+)/i);
        const spellLevel = levelMatch ? Number(levelMatch[1]) : 0;
        const slot = standardSlots.get(spellLevel);
        if (slot) {
          const maximum = safeNumber(slot.max);
          const remaining = safeNumber(slot.remaining, maximum);
          const replacement = `${remaining}/${maximum} level-${spellLevel} slots`;
          const pattern = /\b\d+(?:\/\d+)?\s+level-\d+\s+slots\b/i;
          nextText = pattern.test(nextText) ? nextText.replace(pattern, replacement) : `${nextText} • ${replacement}`;
        }
      }

      if (nextText !== detail.textContent) detail.textContent = nextText;
    }
  }
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

function ResourceButtons({ busy, locked, remaining, maximum, onUse, onRestore, label }) {
  const current = safeNumber(remaining);
  const max = safeNumber(maximum);
  const lockTitle = locked ? "The active battle board controls this resource." : "";
  return (
    <div className={styles.rowActions}>
      <button type="button" disabled={locked || busy || current <= 0} onClick={onUse} title={lockTitle || `Use one ${label}`}>
        Use
      </button>
      <button type="button" disabled={locked || busy || current >= max} onClick={onRestore} title={lockTitle || `Restore one ${label}`}>
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
  const rootRef = useRef(null);
  const [liveProfile, setLiveProfile] = useState(profile);
  const [liveError, setLiveError] = useState("");
  const characterId = safeText(profile?.characterId || liveProfile?.characterId);

  useEffect(() => {
    setLiveProfile((current) => {
      if (!profile) return current;
      return {
        ...(current || {}),
        ...profile,
        encounterLocked: current?.encounterLocked ?? profile.encounterLocked,
        activeEncounter: current?.activeEncounter ?? profile.activeEncounter,
        resourceBridgeVersion: current?.resourceBridgeVersion ?? profile.resourceBridgeVersion,
      };
    });
  }, [profile]);

  useEffect(() => {
    if (!characterId) return undefined;
    let active = true;

    async function reload() {
      const { data, error: rpcError } = await supabase.rpc("character_sheet_resource_profile_v2", {
        p_character_id: characterId,
      });
      if (!active) return;
      if (rpcError) {
        setLiveError(rpcError.message || "Could not refresh linked spell resources.");
        return;
      }
      setLiveError("");
      setLiveProfile(data && typeof data === "object" ? data : null);
    }

    reload();
    const channel = supabase.channel(`character-sheet-resource-live-${characterId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "character_spell_slots",
        filter: `character_id=eq.${characterId}`,
      }, reload)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "encounters",
      }, reload)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [characterId]);

  useEffect(() => {
    const root = rootRef.current?.closest?.(".csheet");
    updateSpellRows(root, liveProfile);
  }, [liveProfile]);

  const resolvedProfile = liveProfile || profile;
  const slots = Array.isArray(resolvedProfile?.slots) ? resolvedProfile.slots : [];
  const limitedSpellUses = Array.isArray(resolvedProfile?.limitedSpellUses) ? resolvedProfile.limitedSpellUses : [];
  const restResult = resolvedProfile?.restResult && typeof resolvedProfile.restResult === "object" ? resolvedProfile.restResult : null;
  const encounterLocked = Boolean(resolvedProfile?.encounterLocked);
  const activeEncounterName = safeText(resolvedProfile?.activeEncounter?.encounterName) || "the active encounter";
  const resolvedError = liveError || error;
  const disabledByState = loading || Boolean(busyKey) || encounterLocked;

  return (
    <section ref={rootRef} className={`${styles.root} ${encounterLocked ? styles.rootLocked : ""}`} aria-label="Spell resources and rests">
      <div className={styles.header}>
        <div>
          <strong>Spell Resources &amp; Rest</strong>
          <span>{encounterLocked ? "Battle-board controlled" : "Persistent in-person tracking"}</span>
        </div>
        <div className={styles.restButtons}>
          <button type="button" disabled={disabledByState} onClick={() => onRest?.("short_rest")}>
            Short Rest
          </button>
          <button type="button" disabled={disabledByState} onClick={() => onRest?.("long_rest")}>
            Long Rest
          </button>
        </div>
      </div>

      {encounterLocked ? (
        <div className={styles.lockNotice} role="status">
          <strong>{activeEncounterName}</strong> currently controls spell resources. Casts on the battle board update these totals automatically. Finish or archive the encounter before using sheet-side Use, Restore, Short Rest, or Long Rest.
        </div>
      ) : null}
      {loading ? <div className={styles.message}>Loading tracked resources…</div> : null}
      {resolvedError ? <div className={`${styles.message} ${styles.error}`} role="alert">{resolvedError}</div> : null}

      {!loading && !resolvedError ? (
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
                      locked={encounterLocked}
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
                      locked={encounterLocked}
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
            <span><strong>Last Short Rest:</strong> {formatRestTime(resolvedProfile?.lastShortRest)}</span>
            <span><strong>Last Long Rest:</strong> {formatRestTime(resolvedProfile?.lastLongRest)}</span>
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

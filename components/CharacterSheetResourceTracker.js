import { useCallback, useEffect, useRef, useState } from "react";
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

function masteryNames(profile) {
  const mastery = profile?.spellMastery;
  if (!mastery?.eligible || !mastery?.configured) return new Set();
  return new Set([mastery?.level1Spell?.name, mastery?.level2Spell?.name].map(normalizeName).filter(Boolean));
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
  const masteredNames = masteryNames(profile);

  for (const group of root.querySelectorAll(".csheet-action-group")) {
    const groupName = safeText(group.querySelector(".csheet-action-group__label span")?.textContent).toLowerCase();
    if (groupName !== "cantrips" && groupName !== "prepared spells") continue;

    for (const item of group.querySelectorAll(".csheet-action-item")) {
      const name = safeText(item.querySelector(".csheet-action-button__name")?.textContent);
      const detail = item.querySelector(".csheet-action-button__detail");
      if (!detail) continue;
      let nextText = safeText(detail.textContent);
      const normalizedName = normalizeName(name);
      const limited = limitedByName.get(normalizedName);

      if (masteredNames.has(normalizedName)) {
        nextText = nextText
          .replace(/\s*•?\s*\d+(?:\/\d+)?\s+level-\d+\s+pact slots\b/i, "")
          .replace(/\s*•?\s*\d+(?:\/\d+)?\s+level-\d+\s+slots\b/i, "")
          .replace(/\s*•?\s*Spell Mastery\s*•\s*at will\b/i, "")
          .trim();
        nextText = [nextText, "Spell Mastery • at will"].filter(Boolean).join(" • ");
      } else if (limited) {
        const maximum = safeNumber(limited.max);
        const remaining = safeNumber(limited.remaining, maximum);
        const recharge = safeText(limited.recharge).toLowerCase().replace(/[_-]+/g, " ");
        const resourceLabel = safeText(limited.resourceLabel);
        const useText = `${remaining}/${maximum} uses${recharge ? ` • ${recharge}` : ""}`;
        const replacement = [resourceLabel, useText].filter(Boolean).join(" • ");
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

function MasterySelect({ label, value, options, disabled, onChange }) {
  return (
    <label className={styles.masteryField}>
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose an eligible spell…</option>
        {(Array.isArray(options) ? options : []).map((spell) => (
          <option key={spell.id} value={spell.id}>{spell.name} • {spell.source}</option>
        ))}
      </select>
    </label>
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
  const [masteryLevel1Id, setMasteryLevel1Id] = useState("");
  const [masteryLevel2Id, setMasteryLevel2Id] = useState("");
  const [masteryBusy, setMasteryBusy] = useState(false);
  const [masteryError, setMasteryError] = useState("");
  const characterId = safeText(profile?.characterId || liveProfile?.characterId);

  const reloadResourceProfile = useCallback(async (preservedRestResult = null) => {
    if (!characterId) return null;
    const { data, error: rpcError } = await supabase.rpc("character_sheet_resource_profile_v2", {
      p_character_id: characterId,
    });
    if (rpcError) {
      setLiveError(rpcError.message || "Could not refresh linked spell resources.");
      return null;
    }
    setLiveError("");
    const next = data && typeof data === "object" ? data : null;
    const merged = next && preservedRestResult ? { ...next, restResult: preservedRestResult } : next;
    setLiveProfile(merged);
    return merged;
  }, [characterId]);

  useEffect(() => {
    setLiveProfile((current) => {
      if (!profile) return current;
      const currentCharacterId = safeText(current?.characterId);
      const nextCharacterId = safeText(profile?.characterId);
      if (currentCharacterId && nextCharacterId && currentCharacterId !== nextCharacterId) return profile;
      return {
        ...(current || {}),
        ...profile,
        encounterLocked: current?.encounterLocked ?? profile.encounterLocked,
        activeEncounter: current?.activeEncounter ?? profile.activeEncounter,
        resourceBridgeVersion: current?.resourceBridgeVersion ?? profile.resourceBridgeVersion,
        spellMastery: current?.spellMastery ?? profile.spellMastery,
      };
    });
  }, [profile]);

  useEffect(() => {
    if (!characterId) return undefined;
    let active = true;

    async function reload() {
      if (!active) return;
      await reloadResourceProfile();
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
        table: "character_spells",
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
  }, [characterId, reloadResourceProfile]);

  const restRefreshKey = `${safeText(profile?.lastShortRest)}|${safeText(profile?.lastLongRest)}|${safeText(profile?.restResult?.restType)}`;
  useEffect(() => {
    if (!characterId || !profile?.restResult) return;
    reloadResourceProfile(profile.restResult);
  }, [characterId, reloadResourceProfile, restRefreshKey]);

  const resolvedProfile = liveProfile || profile;
  const spellMastery = resolvedProfile?.spellMastery && typeof resolvedProfile.spellMastery === "object" ? resolvedProfile.spellMastery : null;
  const currentMasteryLevel1Id = safeText(spellMastery?.level1Spell?.id);
  const currentMasteryLevel2Id = safeText(spellMastery?.level2Spell?.id);

  useEffect(() => {
    if (!spellMastery?.eligible) {
      setMasteryLevel1Id("");
      setMasteryLevel2Id("");
      setMasteryError("");
      return;
    }
    setMasteryLevel1Id(currentMasteryLevel1Id);
    setMasteryLevel2Id(currentMasteryLevel2Id);
    setMasteryError("");
  }, [characterId, currentMasteryLevel1Id, currentMasteryLevel2Id, spellMastery?.configured, spellMastery?.eligible]);

  useEffect(() => {
    const root = rootRef.current?.closest?.(".csheet");
    updateSpellRows(root, resolvedProfile);
    if (!root) return undefined;
    const observer = new MutationObserver(() => updateSpellRows(root, resolvedProfile));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [resolvedProfile]);

  const slots = Array.isArray(resolvedProfile?.slots) ? resolvedProfile.slots : [];
  const limitedSpellUses = Array.isArray(resolvedProfile?.limitedSpellUses) ? resolvedProfile.limitedSpellUses : [];
  const restResult = resolvedProfile?.restResult && typeof resolvedProfile.restResult === "object" ? resolvedProfile.restResult : null;
  const encounterLocked = Boolean(resolvedProfile?.encounterLocked);
  const activeEncounterName = safeText(resolvedProfile?.activeEncounter?.encounterName) || "the active encounter";
  const resolvedError = liveError || error;
  const disabledByState = loading || Boolean(busyKey) || encounterLocked;
  const masteryLevel1Changed = Boolean(spellMastery?.configured && masteryLevel1Id && masteryLevel1Id !== currentMasteryLevel1Id);
  const masteryLevel2Changed = Boolean(spellMastery?.configured && masteryLevel2Id && masteryLevel2Id !== currentMasteryLevel2Id);
  const masteryChangeCount = Number(masteryLevel1Changed) + Number(masteryLevel2Changed);
  const masteryCanSubmit = Boolean(
    spellMastery?.eligible
    && masteryLevel1Id
    && masteryLevel2Id
    && !encounterLocked
    && !masteryBusy
    && (!spellMastery?.configured || (spellMastery?.replacementAvailable && masteryChangeCount === 1))
  );

  async function configureSpellMastery() {
    if (!masteryCanSubmit) return;
    setMasteryBusy(true);
    setMasteryError("");
    const { data, error: rpcError } = await supabase.rpc("configure_character_spell_mastery_v1", {
      p_character_id: characterId,
      p_level1_spell_id: masteryLevel1Id,
      p_level2_spell_id: masteryLevel2Id,
    });
    if (rpcError) {
      setMasteryError(rpcError.message || "Could not update Spell Mastery.");
    } else {
      setLiveError("");
      setLiveProfile(data && typeof data === "object" ? data : null);
    }
    setMasteryBusy(false);
  }

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
          <strong>{activeEncounterName}</strong> currently controls spell resources. Casts on the battle board update these totals automatically. Finish or archive the encounter before using sheet-side Use, Restore, Short Rest, Long Rest, or Spell Mastery configuration.
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
                const resourceLabel = safeText(entry?.resourceLabel) || safeText(entry?.name) || "Spell";
                const featureLabel = safeText(entry?.resourceFeature);
                return (
                  <div className={styles.resourceRow} key={assignmentId || `${entry?.name}-${entry?.level}`}>
                    <div className={styles.resourceIdentity}>
                      <strong>{resourceLabel}</strong>
                      <span>{[featureLabel && featureLabel !== resourceLabel ? featureLabel : "", rechargeLabel(entry?.recharge)].filter(Boolean).join(" • ")}</span>
                    </div>
                    <ResourcePips maximum={maximum} remaining={remaining} />
                    <span className={styles.count}>{remaining}/{maximum}</span>
                    <ResourceButtons
                      busy={busyKey.startsWith(`spell:${assignmentId}:`)}
                      locked={encounterLocked}
                      remaining={remaining}
                      maximum={maximum}
                      label={`${resourceLabel} use`}
                      onUse={() => onSpellUseOperation?.(entry, "use")}
                      onRestore={() => onSpellUseOperation?.(entry, "restore")}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          {spellMastery?.eligible ? (
            <div className={styles.masteryPanel}>
              <div className={styles.masteryHeading}>
                <div>
                  <strong>Spell Mastery</strong>
                  <span>Always prepared • cast at will at the spell&apos;s lowest level</span>
                </div>
                {spellMastery.configured ? <span className={styles.masteryState}>{spellMastery.replacementAvailable ? "Long Rest replacement ready" : "Configured"}</span> : <span className={styles.masteryState}>Choose both</span>}
              </div>
              <div className={styles.masteryGrid}>
                <MasterySelect
                  label="Level 1 mastered spell"
                  value={masteryLevel1Id}
                  options={spellMastery.level1Options}
                  disabled={encounterLocked || masteryBusy || (spellMastery.configured && (!spellMastery.replacementAvailable || masteryLevel2Changed))}
                  onChange={setMasteryLevel1Id}
                />
                <MasterySelect
                  label="Level 2 mastered spell"
                  value={masteryLevel2Id}
                  options={spellMastery.level2Options}
                  disabled={encounterLocked || masteryBusy || (spellMastery.configured && (!spellMastery.replacementAvailable || masteryLevel1Changed))}
                  onChange={setMasteryLevel2Id}
                />
              </div>
              <div className={styles.masteryFooter}>
                <span>{spellMastery.configured
                  ? spellMastery.replacementAvailable
                    ? "This completed Long Rest permits replacing one mastered spell with an eligible spell of the same level."
                    : "A future completed Long Rest unlocks one same-level replacement."
                  : "Choose one eligible Action spell of level 1 and one of level 2 from this Wizard's spellbook."}</span>
                <button type="button" disabled={!masteryCanSubmit} onClick={configureSpellMastery}>
                  {masteryBusy ? "Saving…" : spellMastery.configured ? "Replace Mastered Spell" : "Set Spell Mastery"}
                </button>
              </div>
              {masteryError ? <div className={`${styles.message} ${styles.error}`} role="alert">{masteryError}</div> : null}
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../utils/supabaseClient";
import styles from "../styles/TacticalCharacterResourceBridge.module.css";

function text(value) {
  return String(value ?? "").trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function slotKey(row) {
  return `${text(row?.poolKey || "spellcasting")}:${number(row?.slotLevel)}`;
}

function poolLabel(row) {
  const level = number(row?.slotLevel);
  return text(row?.poolKey) === "pact_magic" ? `Pact L${level}` : `L${level}`;
}

function findEncounterSelect(page) {
  return [...page.querySelectorAll(".sidebar .panel select")].find((select) => (
    [...select.options].some((option) => text(option.textContent).toLowerCase().includes("select encounter"))
  )) || null;
}

function ensureTarget(page) {
  const slotRow = page.querySelector(".spell-card .slot-row");
  if (!slotRow) return null;
  let target = page.querySelector(".tactical-character-resource-bridge-slot");
  if (!target) {
    target = document.createElement("div");
    target.className = "tactical-character-resource-bridge-slot";
    slotRow.after(target);
  }
  return target;
}

export default function TacticalCharacterResourceBridge() {
  const [target, setTarget] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [encounter, setEncounter] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  // Realtime events can arrive before React commits a profile update.
  const latestProfileRef = useRef(null);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    let frame = 0;

    const inspect = () => {
      frame = 0;
      const page = document.querySelector(".combat-page");
      if (!page) {
        setTarget(null);
        setSessionId("");
        return;
      }
      const nextTarget = ensureTarget(page);
      setTarget((current) => current === nextTarget ? current : nextTarget);
      const select = findEncounterSelect(page);
      const nextSessionId = text(select?.value);
      setSessionId((current) => current === nextSessionId ? current : nextSessionId);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(inspect);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("change", schedule, true);
    inspect();

    return () => {
      observer.disconnect();
      document.removeEventListener("change", schedule, true);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const load = useCallback(async () => {
    const id = text(sessionId);
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (!id) {
      latestProfileRef.current = null;
      setEncounter(null);
      setProfile(null);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data: encounterRow, error: encounterError } = await supabase
        .from("encounters")
        .select("id,name,status,version,active_participant_id")
        .eq("id", id)
        .single();
      if (encounterError) throw encounterError;
      if (requestRef.current !== requestId) return;
      setEncounter(encounterRow || null);

      const participantId = text(encounterRow?.active_participant_id);
      if (!participantId) {
        latestProfileRef.current = null;
        setProfile(null);
        return;
      }

      const { data, error: profileError } = await supabase.rpc("encounter_spellcasting_profile_v2", {
        p_participant_id: participantId,
      });
      if (profileError) throw profileError;
      if (requestRef.current !== requestId) return;
      const nextProfile = data && typeof data === "object" ? data : null;
      latestProfileRef.current = nextProfile;
      setProfile(nextProfile);
    } catch (loadError) {
      if (requestRef.current !== requestId) return;
      latestProfileRef.current = null;
      setProfile(null);
      setError(loadError?.message || "Could not load linked character spell resources.");
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const encounterId = text(encounter?.id);
    const participantId = text(encounter?.active_participant_id);
    const characterId = text(profile?.characterId);
    if (!encounterId) return undefined;

    const channel = supabase.channel(`tactical-character-resource-bridge-${encounterId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "encounters", filter: `id=eq.${encounterId}` }, load);

    if (participantId) {
      channel.on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "encounter_spell_slots",
        filter: `participant_id=eq.${participantId}`,
      }, load);
    }

    if (characterId) {
      channel.on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "character_spell_slots",
        filter: `character_id=eq.${characterId}`,
      }, (change) => {
        // profile_v2 runs a spell-slot sync. Its UPSERT currently emits UPDATE
        // events even when all slot values are unchanged. Reloading on those
        // echoes would cause a perpetual RPC / Realtime / loading loop.
        const row = change?.new;
        const current = latestProfileRef.current;
        const unchanged = change?.eventType === "UPDATE"
          && row
          && text(current?.characterId) === characterId
          && Array.isArray(current?.persistentSlotState)
          && current.persistentSlotState.some((slot) =>
            text(slot?.poolKey) === text(row.pool_key)
            && number(slot?.slotLevel) === number(row.slot_level)
            && number(slot?.remaining) === number(row.slots_remaining)
            && number(slot?.max) === number(row.slots_max)
            && text(slot?.rechargeKey) === text(row.recharge_key)
          );
        if (!unchanged) void load();
      });
    }

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [encounter?.active_participant_id, encounter?.id, load, profile?.characterId]);

  const rows = useMemo(() => {
    const encounterRows = Array.isArray(profile?.slotSnapshot) ? profile.slotSnapshot : [];
    const persistentRows = Array.isArray(profile?.persistentSlotState) ? profile.persistentSlotState : [];
    const persistentByKey = new Map(persistentRows.map((row) => [slotKey(row), row]));
    return encounterRows.map((row) => ({
      key: slotKey(row),
      label: poolLabel(row),
      encounterRemaining: number(row?.remaining),
      encounterMax: number(row?.max),
      persistent: persistentByKey.get(slotKey(row)) || null,
    }));
  }, [profile]);

  const currentProfile = Boolean(profile
    && text(encounter?.id) === text(sessionId)
    && text(profile?.participantId) === text(encounter?.active_participant_id));

  if (!target) return null;

  return createPortal(
    <section className={styles.root} aria-label="Linked character spell resources">
      {loading && !currentProfile ? <div className={styles.message}>Checking linked Sheet &amp; Rolls resources…</div> : null}
      {error ? <div className={`${styles.message} ${styles.error}`} role="alert">{error}</div> : null}
      {!error && currentProfile && profile?.persistentResourcesLinked ? (
        <>
          <div className={styles.header}>
            <strong>Character Resource Link</strong>
            <span>Battle-board casts spend both ledgers</span>
          </div>
          {rows.length ? (
            <div className={styles.rows}>
              {rows.map((row) => {
                const sheetRemaining = number(row.persistent?.remaining);
                const sheetMax = number(row.persistent?.max);
                const matches = row.persistent
                  && row.encounterRemaining === sheetRemaining
                  && row.encounterMax === sheetMax;
                return (
                  <div className={`${styles.row} ${matches ? styles.synced : styles.mismatch}`} key={row.key}>
                    <strong>{row.label}</strong>
                    <span>Battle {row.encounterRemaining}/{row.encounterMax}</span>
                    <span>Sheet {row.persistent ? `${sheetRemaining}/${sheetMax}` : "missing"}</span>
                  </div>
                );
              })}
            </div>
          ) : <div className={styles.message}>This active participant has no leveled spell-slot pool.</div>}
          {profile?.persistentSlotMismatch ? (
            <div className={styles.warning} role="status">
              This pre-bridge encounter snapshot differs from Sheet &amp; Rolls. Existing battle counts were preserved; every new tactical slot spent now also reduces the character ledger. Newly activated encounters start from the character totals.
            </div>
          ) : (
            <div className={styles.linked} role="status">Battle board and Sheet &amp; Rolls are synchronized.</div>
          )}
        </>
      ) : null}
    </section>,
    target
  );
}

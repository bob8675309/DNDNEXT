import { useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";

function safeText(value) {
  return String(value ?? "").trim();
}

function isRestButton(target) {
  const button = target?.closest?.("button");
  if (!button || !button.closest?.('[aria-label="Spell resources and rests"]')) return false;
  const label = safeText(button.textContent);
  return label === "Short Rest" || label === "Long Rest";
}

export default function CharacterSheetRestSyncBridge({ characterId = "", onSheetUpdated = null }) {
  const id = safeText(characterId);
  const onSheetUpdatedRef = useRef(onSheetUpdated);
  const latestUpdatedAtRef = useRef("");

  useEffect(() => {
    onSheetUpdatedRef.current = onSheetUpdated;
  }, [onSheetUpdated]);

  useEffect(() => {
    if (!id || typeof window === "undefined") return undefined;
    let active = true;
    let inFlight = false;
    const timers = new Set();

    async function syncAuthoritativeSheet() {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const { data, error } = await supabase
          .from("character_sheets")
          .select("sheet,updated_at")
          .eq("character_id", id)
          .maybeSingle();
        if (!active || error || !data?.sheet) return;
        const updatedAt = safeText(data.updated_at);
        if (updatedAt && updatedAt === latestUpdatedAtRef.current) return;
        latestUpdatedAtRef.current = updatedAt;
        onSheetUpdatedRef.current?.(data.sheet);
      } finally {
        inFlight = false;
      }
    }

    function scheduleSync(delay) {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        void syncAuthoritativeSheet();
      }, delay);
      timers.add(timer);
    }

    function handlePotentialRest(event) {
      if (!isRestButton(event.target)) return;
      // React's Rest handler begins the authenticated RPC before this document-level bubble handler runs.
      // Use a small bounded burst instead of continuous polling so the returned Rage/resource sheet revision
      // is reflected promptly even for characters (such as Barbarians) with no spell-slot Realtime event.
      [200, 650, 1300, 2400].forEach(scheduleSync);
    }

    function handleFocus() {
      void syncAuthoritativeSheet();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") void syncAuthoritativeSheet();
    }

    document.addEventListener("click", handlePotentialRest);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      document.removeEventListener("click", handlePotentialRest);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [id]);

  return null;
}

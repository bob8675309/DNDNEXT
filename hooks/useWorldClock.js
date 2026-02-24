// hooks/useWorldClock.js
// Subscribe/poll the authoritative world clock and provide a projected renderWorldTime.
// Isolated so map UI edits are less likely to break movement.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";

export function useWorldClock({ enabled = true, pollMs = 15000 } = {}) {
  const [worldState, setWorldState] = useState(null); // row from public.world_state (id=1)

  // Avoid rerenders per-frame: keep clock data in a ref.
  const clockRef = useRef({ serverWorldMs: null, syncedAtPerf: 0, timeScale: 1 });

  const syncWorldClock = useCallback((wsRow) => {
    if (!wsRow?.world_time) return;
    const ms = new Date(wsRow.world_time).getTime();
    if (!Number.isFinite(ms)) return;
    const scale = Number(wsRow.time_scale ?? wsRow.timeScale ?? 1);
    clockRef.current = {
      serverWorldMs: ms,
      syncedAtPerf: typeof performance !== "undefined" ? performance.now() : Date.now(),
      timeScale: Number.isFinite(scale) ? scale : 1,
    };
  }, []);

  const getRenderWorldMs = useCallback(() => {
    const c = clockRef.current;
    if (!c || !Number.isFinite(c.serverWorldMs)) return null;
    const nowPerf = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsedRealSeconds = Math.max(0, (nowPerf - (c.syncedAtPerf || 0)) / 1000);
    const scale = Number.isFinite(c.timeScale) ? c.timeScale : 1;
    return c.serverWorldMs + elapsedRealSeconds * scale * 1000;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    async function fetchWorldState() {
      const { data, error } = await supabase.from("world_state").select("*").eq("id", 1).maybeSingle();
      if (!alive) return;
      if (error) {
        // Non-fatal: UI can still render static pins.
        console.warn("world_state fetch failed:", error.message);
        return;
      }
      setWorldState(data || null);
      syncWorldClock(data || null);
    }

    fetchWorldState();

    const channel = supabase
      .channel("world-state")
      .on("postgres_changes", { event: "*", schema: "public", table: "world_state" }, (payload) => {
        const row = payload?.new || null;
        if (!row) return;
        setWorldState(row);
        syncWorldClock(row);
      })
      .subscribe();

    const t = setInterval(fetchWorldState, Math.max(2500, pollMs));

    return () => {
      alive = false;
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [enabled, pollMs, syncWorldClock]);

  return {
    worldState,
    getRenderWorldMs,
    ready: Boolean(worldState?.world_time),
    // Exposed for deep debugging if needed.
    _clockRef: clockRef,
  };
}

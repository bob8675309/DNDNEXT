import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

// Admin-facing debug HUD for simulation state.
// This panel is intentionally resilient: it can operate even if some helper RPCs are missing.

function toIsoLocal(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

async function safeRpc(name, args) {
  try {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

async function patchCharacter(characterId, patch) {
  // Prefer update_character RPC if present (it typically handles permissions/admin checks).
  const r1 = await safeRpc("update_character", { p_character_id: characterId, p_patch: patch || {} });
  if (!r1.error) return;

  // Fallback to direct table update.
  const { error } = await supabase.from("characters").update(patch || {}).eq("id", characterId);
  if (error) throw error;
}

export default function MapDebugPanel({ isOpen, onClose, selectedLocation, selectedNpc, selectedMerchant }) {
  const [ws, setWs] = useState(null);
  const [wsErr, setWsErr] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherErr, setWeatherErr] = useState(null);
  const [charLive, setCharLive] = useState(null);
  const [charErr, setCharErr] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  const activeCharInput = selectedNpc || selectedMerchant || null;

  const activeChar = charLive || activeCharInput || null;

  const derived = useMemo(() => {
    if (!ws?.world_time) return null;
    const t = new Date(ws.world_time);
    if (Number.isNaN(t.getTime())) return null;
    const hh = String(t.getUTCHours()).padStart(2, "0");
    const mm = String(t.getUTCMinutes()).padStart(2, "0");
    const ss = String(t.getUTCSeconds()).padStart(2, "0");
    return { timeOfDayUtc: `${hh}:${mm}:${ss} UTC` };
  }, [ws]);

  // World state polling (lightweight)
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;

    async function loadWorldState() {
      setWsErr(null);
      const { data, error } = await supabase.from("world_state").select("*").eq("id", 1).maybeSingle();
      if (!alive) return;
      if (error) {
        setWs(null);
        setWsErr(error.message);
        return;
      }
      setWs(data || null);
    }

    loadWorldState();
    const id = setInterval(loadWorldState, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isOpen]);

  // Selected character live refresh (so drawer targeting always shows real DB truth)
  useEffect(() => {
    if (!isOpen) return;
    const id = activeCharInput?.id;
    if (!id) {
      setCharLive(null);
      setCharErr(null);
      return;
    }

    let alive = true;

    async function loadChar() {
      setCharErr(null);
      const { data, error } = await supabase
        .from("characters")
        .select(
          "id,name,kind,state,is_hidden,route_id,route_mode,location_id,last_known_location_id,projected_destination_id,route_point_seq,current_point_seq,next_point_seq,segment_started_at,segment_ends_at,route_segment_progress,next_action_at,dwell_ends_at,paused_remaining_seconds,camp_reason"
        )
        .eq("id", id)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        setCharLive(null);
        setCharErr(error.message);
        return;
      }
      setCharLive(data || null);
    }

    loadChar();
    const t = setInterval(loadChar, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [isOpen, activeCharInput?.id]);

  const runTick = useCallback(async (n = 1) => {
    const count = Math.max(1, Math.min(50, Number(n) || 1));
    setActionBusy(true);
    setActionMsg(null);
    try {
      for (let i = 0; i < count; i += 1) {
        const { error } = await supabase.rpc("sim_tick_v1");
        if (error) throw error;
      }
      setActionMsg(`Tick requested ×${count}. (sim_tick_v1 has a real-time gate; it may no-op if called too soon.)`);
    } catch (e) {
      setActionMsg(`Tick error: ${e?.message || String(e)}`);
    } finally {
      setActionBusy(false);
    }
  }, []);

  const advanceChars = useCallback(async () => {
    setActionBusy(true);
    setActionMsg(null);
    try {
      if (!ws?.world_time) throw new Error("No world_state.world_time");
      // Prefer the timestamp-taking variant.
      const r = await safeRpc("advance_all_characters_v3", { p_world_time: ws.world_time });
      if (r.error) {
        // Fallback to no-arg wrapper if present.
        const r2 = await safeRpc("advance_all_characters_v3", {});
        if (r2.error) throw r.error;
      }
      setActionMsg("Advanced characters (advance_all_characters_v3)." );
    } catch (e) {
      setActionMsg(`Advance error: ${e?.message || String(e)}`);
    } finally {
      setActionBusy(false);
    }
  }, [ws?.world_time]);

  const forceDue = useCallback(async () => {
    setActionBusy(true);
    setActionMsg(null);
    try {
      const c = activeChar || activeCharInput;
      if (!c?.id) throw new Error("No selected character");

      // Make next_action_at definitely <= world_time.
      const baseMs = ws?.world_time ? new Date(ws.world_time).getTime() : Date.now();
      const dueIso = new Date(baseMs - 5000).toISOString();

      const locId = c.location_id ?? c.last_known_location_id ?? null;

      const patch = {
        // Ensure the scheduler picks it up
        next_action_at: dueIso,

        // Reset movement/camp state
        state: "resting",
        segment_started_at: null,
        segment_ends_at: null,
        route_segment_progress: 0,
        paused_state: null,
        paused_remaining_seconds: null,
        camp_reason: null,
        camp_started_at: null,
        projected_destination_id: null,

        // Make sure dwell doesn't block departure
        dwell_ends_at: null,
        rest_until: null,
      };

      // If the character is off-map but has a last-known location, anchor them so the "resting at location" depart logic can run.
      if (locId != null) {
        patch.location_id = locId;
        patch.last_known_location_id = locId;
      }

      // If they have a route but missing current seq, seed it.
      if (c.route_id != null && (c.current_point_seq == null && c.route_point_seq != null)) {
        patch.current_point_seq = c.route_point_seq;
      }

      await patchCharacter(c.id, patch);
      setActionMsg("Selected character forced due (next_action_at set in the past; movement state reset)." );
    } catch (e) {
      setActionMsg(`Force due error: ${e?.message || String(e)}`);
    } finally {
      setActionBusy(false);
    }
  }, [activeChar?.id, activeCharInput?.id, ws?.world_time]);

  useEffect(() => {
    if (!isOpen) return;
    if (!ws?.world_time) return;

    const biomeId = selectedLocation?.biome_id ?? selectedLocation?.biomes?.id ?? null;
    if (!biomeId) {
      setWeather(null);
      setWeatherErr(null);
      return;
    }

    let alive = true;
    async function loadWeather() {
      setWeatherErr(null);
      const seed = ws?.seed ?? 1337;
      const worldTime = new Date(ws.world_time);
      const dayUtc = new Date(Date.UTC(worldTime.getUTCFullYear(), worldTime.getUTCMonth(), worldTime.getUTCDate()));
      const dayNumber =
        typeof ws?.day_number === "number"
          ? ws.day_number
          : Math.floor((dayUtc.getTime() - Date.UTC(2000, 0, 1)) / 86400000);

      const { data, error } = await supabase.rpc("get_weather_for_biome_day_v1", {
        p_biome_id: biomeId,
        p_day: dayNumber,
        p_seed: seed,
      });
      if (!alive) return;
      if (error) {
        setWeather(null);
        setWeatherErr(error.message);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      setWeather(row || null);
    }

    loadWeather();
    const id = setInterval(loadWeather, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isOpen, ws?.world_time, ws?.seed, ws?.day_number, selectedLocation?.id, selectedLocation?.biome_id, selectedLocation?.biomes?.id]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 9999,
        width: 380,
        maxWidth: "calc(100vw - 24px)",
      }}
    >
      <div className="card shadow" style={{ background: "rgba(10,10,14,0.92)", color: "#eee" }}>
        <div className="card-header d-flex align-items-center justify-content-between" style={{ padding: "0.5rem 0.75rem" }}>
          <div style={{ fontWeight: 700 }}>Sim Debug</div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="card-body" style={{ padding: "0.75rem" }}>
          <div style={{ fontSize: 12, opacity: 0.95 }}>
            <div className="mb-2">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>World</div>
              {wsErr ? (
                <div style={{ color: "#ffb3b3" }}>world_state error: {wsErr}</div>
              ) : ws ? (
                <>
                  <div>world_time: {toIsoLocal(ws.world_time)}</div>
                  <div>time_of_day: {derived?.timeOfDayUtc || "(n/a)"}</div>
                  <div>seed: {ws.seed ?? "(n/a)"}</div>
                  <div>time_scale: {ws.time_scale ?? "(n/a)"}</div>

                  <div className="d-flex gap-2 flex-wrap mt-2">
                    <button type="button" className="btn btn-sm btn-outline-success" onClick={() => runTick(1)} disabled={actionBusy}>
                      Tick ×1
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-success" onClick={() => runTick(10)} disabled={actionBusy}>
                      Tick ×10
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-warning" onClick={advanceChars} disabled={actionBusy} title="Bypasses sim_tick gate; runs advance_all_characters_v3 at current world_time">
                      Advance chars
                    </button>
                  </div>

                  <div className="d-flex gap-2 flex-wrap mt-2">
                    <button type="button" className="btn btn-sm btn-outline-info" onClick={forceDue} disabled={actionBusy || !activeCharInput?.id} title="Sets next_action_at into the past and resets movement state">
                      Force due
                    </button>
                  </div>

                  {actionMsg ? <div className="mt-2" style={{ color: "#cfe9ff" }}>{actionMsg}</div> : null}
                </>
              ) : (
                <div style={{ opacity: 0.75 }}>(no world_state row)</div>
              )}
            </div>

            <div className="mb-2">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Weather</div>
              {!selectedLocation ? (
                <div style={{ opacity: 0.75 }}>(select a location)</div>
              ) : weatherErr ? (
                <div style={{ color: "#ffb3b3" }}>weather error: {weatherErr}</div>
              ) : weather ? (
                <>
                  <div>location: {selectedLocation?.name || selectedLocation?.id}</div>
                  <div>severity: {weather.severity ?? "(n/a)"}</div>
                  <div>multiplier: {weather.multiplier ?? "(n/a)"}</div>
                  <div>blocked: {String(weather.blocked ?? false)}</div>
                </>
              ) : (
                <div style={{ opacity: 0.75 }}>(no weather data)</div>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Character</div>
              {!activeCharInput ? (
                <div style={{ opacity: 0.75 }}>(select an NPC or merchant)</div>
              ) : charErr ? (
                <div style={{ color: "#ffb3b3" }}>character error: {charErr}</div>
              ) : activeChar ? (
                <>
                  <div>name: {activeChar.name}</div>
                  <div>kind: {activeChar.kind || (selectedMerchant ? "merchant" : "npc")}</div>
                  <div>state: {activeChar.state || "(n/a)"}</div>
                  <div>route_id: {activeChar.route_id ?? "(n/a)"}</div>
                  <div>route_mode: {activeChar.route_mode || "(n/a)"}</div>
                  <div>location_id: {activeChar.location_id ?? "(null)"}</div>
                  <div>last_known_location_id: {activeChar.last_known_location_id ?? "(null)"}</div>
                  <div>current_point_seq: {activeChar.current_point_seq ?? "(null)"}</div>
                  <div>next_point_seq: {activeChar.next_point_seq ?? "(null)"}</div>
                  {typeof activeChar.route_segment_progress === "number" ? (
                    <div>progress: {(activeChar.route_segment_progress * 100).toFixed(1)}%</div>
                  ) : null}
                  {activeChar.segment_started_at ? <div>seg_start: {toIsoLocal(activeChar.segment_started_at)}</div> : null}
                  {activeChar.segment_ends_at ? <div>seg_end: {toIsoLocal(activeChar.segment_ends_at)}</div> : null}
                  {activeChar.dwell_ends_at ? <div>dwell_ends: {toIsoLocal(activeChar.dwell_ends_at)}</div> : null}
                  {activeChar.next_action_at ? <div>next_action: {toIsoLocal(activeChar.next_action_at)}</div> : null}
                  {typeof activeChar.paused_remaining_seconds === "number" ? (
                    <div>paused_remaining: {activeChar.paused_remaining_seconds}s</div>
                  ) : null}
                  {activeChar.camp_reason ? <div>camp_reason: {activeChar.camp_reason}</div> : null}
                </>
              ) : (
                <div style={{ opacity: 0.75 }}>(no character data)</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

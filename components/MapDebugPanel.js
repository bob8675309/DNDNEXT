import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

// Lightweight, admin-facing debug HUD for simulation state.
// Fails gracefully when DB functions/columns aren't present.

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

export default function MapDebugPanel({ isOpen, onClose, selectedLocation, selectedNpc, selectedMerchant }) {
  const [ws, setWs] = useState(null);
  const [wsErr, setWsErr] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherErr, setWeatherErr] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  const activeChar = selectedNpc || selectedMerchant || null;
  const [liveChar, setLiveChar] = useState(null);
  const [liveCharErr, setLiveCharErr] = useState(null);

  const derived = useMemo(() => {
    if (!ws?.world_time) return null;
    const t = new Date(ws.world_time);
    if (Number.isNaN(t.getTime())) return null;
    const hh = String(t.getUTCHours()).padStart(2, "0");
    const mm = String(t.getUTCMinutes()).padStart(2, "0");
    const ss = String(t.getUTCSeconds()).padStart(2, "0");
    return { timeOfDayUtc: `${hh}:${mm}:${ss} UTC` };
  }, [ws]);

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

  // Keep the selected character live (drawer selections are otherwise stale and won't reflect movement).
  useEffect(() => {
    if (!isOpen) return;
    const id = activeChar?.id;
    if (!id) {
      setLiveChar(null);
      setLiveCharErr(null);
      return;
    }

    let alive = true;
    async function loadChar() {
      setLiveCharErr(null);
      const select = [
        'id','name','kind','state','route_id','route_mode','route_segment_progress',
        'current_point_seq','next_point_seq','segment_started_at','segment_ends_at','next_action_at',
        'location_id','last_known_location_id','projected_destination_id',
        'paused_state','paused_remaining_seconds','camp_reason',
      ].join(',');
      const { data, error } = await supabase.from('characters').select(select).eq('id', id).maybeSingle();
      if (!alive) return;
      if (error) {
        setLiveChar(null);
        setLiveCharErr(error.message);
        return;
      }
      setLiveChar(data || null);
    }

    loadChar();
    const t = setInterval(loadChar, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [isOpen, activeChar?.id]);

  const runTick = useCallback(
    async (n = 1) => {
      const count = Math.max(1, Math.min(50, Number(n) || 1));
      setActionBusy(true);
      setActionMsg(null);
      try {
        for (let i = 0; i < count; i += 1) {
          const { error } = await supabase.rpc("sim_tick_v1");
          if (error) throw error;
        }
        // NOTE: sim_tick_v1 has an internal real-time gate (it may no-op if called too soon).
        setActionMsg(`Tick requested ×${count}. (If world_state.updated_at is recent, sim_tick_v1 may no-op due to its gate.)`);
      } catch (e) {
        setActionMsg(`Tick error: ${e?.message || String(e)}`);
      } finally {
        setActionBusy(false);
      }
    },
    []
  );

  const updateCharacterPatch = useCallback(async (characterId, patch) => {
    if (!characterId || !patch) return;
    try {
      const { error } = await supabase.rpc('update_character', {
        p_character_id: characterId,
        p_patch: patch,
      });
      if (error) throw error;
    } catch (e) {
      // Fallback if RPC is missing or blocked.
      const { error } = await supabase.from('characters').update(patch).eq('id', characterId);
      if (error) throw error;
    }
  }, []);

  const runAdvanceCharacters = useCallback(async () => {
    if (!ws?.world_time) {
      setActionMsg('Advance chars: world_state not loaded yet.');
      return;
    }
    setActionBusy(true);
    setActionMsg(null);
    try {
      // Prefer the timestamptz signature to bypass sim_tick_v1 real-time gating.
      let res = await supabase.rpc('advance_all_characters_v3', { p_world_time: ws.world_time });
      if (res?.error) {
        // Fallback to no-arg wrapper if overloaded signature resolution fails.
        res = await supabase.rpc('advance_all_characters_v3');
      }
      if (res?.error) throw res.error;
      setActionMsg('Advance chars requested. (This bypasses sim_tick_v1 gating.)');
    } catch (e) {
      setActionMsg(`Advance chars error: ${e?.message || String(e)}`);
    } finally {
      setActionBusy(false);
    }
  }, [ws?.world_time]);

  const forceDueSelected = useCallback(async () => {
    const id = activeChar?.id;
    if (!id) {
      setActionMsg('Force due: select an NPC or merchant first.');
      return;
    }
    if (!ws?.world_time) {
      setActionMsg('Force due: world_state not loaded yet.');
      return;
    }
    setActionBusy(true);
    setActionMsg(null);
    try {
      const base = new Date(ws.world_time);
      const due = new Date(base.getTime() - 1000).toISOString();
      await updateCharacterPatch(id, {
        next_action_at: due,
        state: 'resting',
        segment_started_at: null,
        segment_ends_at: null,
        route_segment_progress: 0,
        paused_state: null,
        paused_remaining_seconds: null,
        camp_reason: null,
      });
      setActionMsg('Selected character forced due (next_action_at moved to the past).');
    } catch (e) {
      setActionMsg(`Force due error: ${e?.message || String(e)}`);
    } finally {
      setActionBusy(false);
    }
  }, [activeChar?.id, ws?.world_time, updateCharacterPatch]);

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

  const showChar = liveChar || activeChar;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 9999,
        width: 360,
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
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={() => runTick(1)}
                      disabled={actionBusy}
                      title="Run sim_tick_v1 once (may no-op if called too soon)"
                    >
                      Tick ×1
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={() => runTick(10)}
                      disabled={actionBusy}
                      title="Run sim_tick_v1 ten times (may no-op due to server gate)"
                    >
                      Tick ×10
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning"
                      onClick={runAdvanceCharacters}
                      disabled={actionBusy}
                      title="Call advance_all_characters_v3 directly (bypasses sim_tick_v1 real-time gate)"
                    >
                      Advance chars
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
              {!showChar ? (
                <div style={{ opacity: 0.75 }}>(select an NPC or merchant)</div>
              ) : (
                <>
                  {liveCharErr ? <div style={{ color: "#ffb3b3" }}>char error: {liveCharErr}</div> : null}
                  <div>name: {showChar.name}</div>
                  <div>kind: {showChar.kind || (selectedMerchant ? "merchant" : "npc")}</div>
                  <div>state: {showChar.state || "(n/a)"}</div>
                  <div>route_id: {showChar.route_id || "(n/a)"}</div>
                  <div>route_mode: {showChar.route_mode || "(n/a)"}</div>
                  {typeof showChar.route_segment_progress === "number" ? (
                    <div>progress: {(showChar.route_segment_progress * 100).toFixed(1)}%</div>
                  ) : null}
                  {showChar.segment_started_at ? <div>seg_start: {toIsoLocal(showChar.segment_started_at)}</div> : null}
                  {showChar.segment_ends_at ? <div>seg_end: {toIsoLocal(showChar.segment_ends_at)}</div> : null}
                  {showChar.next_action_at ? <div>next_action: {toIsoLocal(showChar.next_action_at)}</div> : null}
                  {typeof showChar.paused_remaining_seconds === "number" ? (
                    <div>paused_remaining: {showChar.paused_remaining_seconds}s</div>
                  ) : null}
                  {showChar.camp_reason ? <div>camp_reason: {showChar.camp_reason}</div> : null}

                  <div className="d-flex gap-2 flex-wrap mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-info"
                      onClick={forceDueSelected}
                      disabled={actionBusy}
                      title="Set next_action_at to the past and clear segment fields so the next advance picks them up"
                    >
                      Force due
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

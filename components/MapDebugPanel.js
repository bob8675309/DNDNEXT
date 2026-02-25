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

export default function MapDebugPanel({ isOpen, onClose, selectedLocation, selectedNpc, selectedMerchant, selectedCharacterId }) {
  const [ws, setWs] = useState(null);
  const [wsErr, setWsErr] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherErr, setWeatherErr] = useState(null);
  const [charRow, setCharRow] = useState(null);
  const [charErr, setCharErr] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  const activeChar = charRow || selectedNpc || selectedMerchant || null;

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

  // Load selected character row (so Debug works even when selected from the drawer, not via pin click)
  useEffect(() => {
    if (!isOpen) return;
    const id = selectedCharacterId || activeChar?.id || null;
    if (!id) {
      setCharRow(null);
      setCharErr(null);
      return;
    }
    let alive = true;

    async function loadCharacter() {
      setCharErr(null);
      const { data, error } = await supabase
        .from('characters')
        .select('id,name,kind,state,route_id,route_mode,route_point_seq,current_point_seq,next_point_seq,prev_point_seq,segment_started_at,segment_ends_at,route_segment_progress,rest_until,next_action_at,paused_state,paused_remaining_seconds,camp_reason,x,y,location_id,last_known_location_id,projected_destination_id,roaming_speed')
        .eq('id', id)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        setCharRow(null);
        setCharErr(error.message);
        return;
      }
      setCharRow(data || null);
    }

    loadCharacter();
    const t = setInterval(loadCharacter, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [isOpen, selectedCharacterId, activeChar?.id]);

  const runTick = useCallback(async (n = 1) => {
    const count = Math.max(1, Math.min(50, Number(n) || 1));
    setActionBusy(true);
    setActionMsg(null);
    try {
      for (let i = 0; i < count; i += 1) {
        const { error } = await supabase.rpc('sim_tick_v1');
        if (error) throw error;
      }
      setActionMsg(`Tick requested ×${count}. (sim_tick_v1 may no-op due to its real-time gate.)`);
    } catch (e) {
      setActionMsg(`Tick error: ${e?.message || String(e)}`);
    } finally {
      setActionBusy(false);
    }
  }, []);

  const runAdvance = useCallback(async () => {
    setActionBusy(true);
    setActionMsg(null);
    try {
      const args = ws?.world_time ? { p_now: ws.world_time } : {};
      const { error } = await supabase.rpc('advance_all_characters_v3', args);
      if (error) throw error;
      setActionMsg('advance_all_characters_v3 executed.');
    } catch (e) {
      setActionMsg(`Advance error: ${e?.message || String(e)}`);
    } finally {
      setActionBusy(false);
    }
  }, [ws?.world_time]);

  const forceDue = useCallback(async () => {
    const id = selectedCharacterId || activeChar?.id || null;
    if (!id) return;
    setActionBusy(true);
    setActionMsg(null);
    try {
      const patch = {
        state: 'resting',
        rest_until: null,
        segment_started_at: null,
        segment_ends_at: null,
        next_point_seq: null,
        route_segment_progress: 0,
      };
      const { error } = await supabase.from('characters').update(patch).eq('id', id);
      if (error) throw error;
      setActionMsg('Forced character due (cleared rest/segment). Now click Advance.');
    } catch (e) {
      setActionMsg(`Force due error: ${e?.message || String(e)}`);
    } finally {
      setActionBusy(false);
    }
  }, [selectedCharacterId, activeChar?.id]);

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
                      className="btn btn-sm btn-outline-primary"
                      onClick={runAdvance}
                      disabled={actionBusy}
                      title="Run advance_all_characters_v3 once (bypasses sim_tick gate)"
                    >
                      Advance
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning"
                      onClick={forceDue}
                      disabled={actionBusy || !(selectedCharacterId || activeChar)}
                      title="Clear rest/segment fields for selected character so the planner can schedule immediately"
                    >
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
              {charErr ? <div style={{ color: '#ffb3b3' }}>character error: {charErr}</div> : null}
              {!activeChar ? (
                <div style={{ opacity: 0.75 }}>(select an NPC or merchant)</div>
              ) : (
                <>
                  <div>name: {activeChar.name}</div>
                  <div>kind: {activeChar.kind || (selectedMerchant ? "merchant" : "npc")}</div>
                  <div>state: {activeChar.state || "(n/a)"}</div>
                  <div>route_id: {activeChar.route_id || "(n/a)"}</div>
                  <div>route_mode: {activeChar.route_mode || "(n/a)"}</div>
                  {typeof activeChar.route_segment_progress === "number" ? (
                    <div>progress: {(activeChar.route_segment_progress * 100).toFixed(1)}%</div>
                  ) : null}
                  {activeChar.segment_started_at ? <div>seg_start: {toIsoLocal(activeChar.segment_started_at)}</div> : null}
                  {activeChar.segment_ends_at ? <div>seg_end: {toIsoLocal(activeChar.segment_ends_at)}</div> : null}
                  {activeChar.next_action_at ? <div>next_action: {toIsoLocal(activeChar.next_action_at)}</div> : null}
                  {typeof activeChar.paused_remaining_seconds === "number" ? (
                    <div>paused_remaining: {activeChar.paused_remaining_seconds}s</div>
                  ) : null}
                  {activeChar.camp_reason ? <div>camp_reason: {activeChar.camp_reason}</div> : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EncounterTurnBoard from "../../components/encounter/EncounterTurnBoard";
import { hexDistance, hexKey } from "../../utils/encounterHex";
import { supabase } from "../../utils/supabaseClient";

function requestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-0000-4000-8000-000000000000`.slice(0, 36);
}

export default function EncounterPlayPage() {
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [encounter, setEncounter] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [terrain, setTerrain] = useState([]);
  const [objects, setObjects] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [path, setPath] = useState([]);
  const [canControl, setCanControl] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const activeParticipant = useMemo(() => participants.find((row) => String(row.id) === String(encounter?.active_participant_id || "")) || null, [participants, encounter?.active_participant_id]);
  const terrainByKey = useMemo(() => new Map(terrain.map((row) => [hexKey(row.q, row.r), row])), [terrain]);
  const blockingKeys = useMemo(() => new Set(objects.filter((row) => row.blocks_movement).map((row) => hexKey(row.q, row.r))), [objects]);
  const occupiedKeys = useMemo(() => new Set(participants.filter((row) => !row.is_defeated && String(row.id) !== String(activeParticipant?.id || "")).map((row) => hexKey(row.q, row.r))), [participants, activeParticipant?.id]);
  const speedFt = Number(activeParticipant?.speed_ft || 30);
  const spentFt = Number(activeParticipant?.movement_spent_ft || 0);
  const remainingFt = Math.max(0, speedFt - spentFt);
  const pathCostFt = useMemo(() => path.reduce((sum, hex) => sum + Math.ceil(5 * Number(terrainByKey.get(hexKey(hex.q, hex.r))?.movement_multiplier || 1)), 0), [path, terrainByKey]);

  const loadSessions = useCallback(async () => {
    const { data, error } = await supabase.from("encounters").select("id,map_id,name,status,round,turn_index,active_participant_id,phase,version,updated_at").neq("status", "archived").order("updated_at", { ascending: false });
    if (error) throw error;
    const rows = data || [];
    setSessions(rows);
    setSessionId((current) => current && rows.some((row) => String(row.id) === String(current)) ? current : (rows.find((row) => row.status === "active")?.id || rows[0]?.id || ""));
  }, []);

  const loadEncounter = useCallback(async (nextId) => {
    if (!nextId) { setEncounter(null); setMapData(null); setTerrain([]); setObjects([]); setParticipants([]); return; }
    const encounterRes = await supabase.from("encounters").select("id,map_id,name,status,round,turn_index,active_participant_id,phase,version,updated_at").eq("id", nextId).single();
    if (encounterRes.error) throw encounterRes.error;
    const next = encounterRes.data;
    const [mapRes, terrainRes, objectRes, participantRes] = await Promise.all([
      supabase.from("encounter_maps").select("id,name,description,hex_size,radius").eq("id", next.map_id).single(),
      supabase.from("encounter_hex_overrides").select("map_id,q,r,terrain_type,movement_multiplier,elevation,hazard_key").eq("map_id", next.map_id),
      supabase.from("encounter_map_objects").select("id,map_id,object_type,q,r,blocks_movement,blocks_los,cover_level").eq("map_id", next.map_id),
      supabase.from("encounter_participants").select("id,encounter_id,character_id,display_name,team,controller_user_id,q,r,facing,initiative,initiative_tiebreaker,movement_spent_ft,speed_ft,action_available,bonus_action_available,reaction_available,is_hidden,is_defeated,sprite_asset_id,state,updated_at").eq("encounter_id", nextId).order("initiative", { ascending: false, nullsFirst: false }),
    ]);
    if (mapRes.error) throw mapRes.error;
    if (terrainRes.error) throw terrainRes.error;
    if (objectRes.error) throw objectRes.error;
    if (participantRes.error) throw participantRes.error;
    setEncounter(next); setMapData(mapRes.data); setTerrain(terrainRes.data || []); setObjects(objectRes.data || []); setParticipants(participantRes.data || []);
    setPath([]);
  }, []);

  useEffect(() => { loadSessions().catch((error) => setMessage(error?.message || "Could not load encounters.")); }, [loadSessions]);
  useEffect(() => { loadEncounter(sessionId).catch((error) => setMessage(error?.message || "Could not load encounter.")); }, [loadEncounter, sessionId]);

  useEffect(() => {
    let cancelled = false;
    if (!activeParticipant?.id) { setCanControl(false); return undefined; }
    supabase.rpc("encounter_can_control_participant_v1", { p_participant_id: activeParticipant.id }).then(({ data, error }) => {
      if (!cancelled) setCanControl(!error && Boolean(data));
    });
    return () => { cancelled = true; };
  }, [activeParticipant?.id]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const channel = supabase.channel(`encounter-play-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "encounters", filter: `id=eq.${sessionId}` }, () => { loadSessions().catch(() => {}); loadEncounter(sessionId).catch(() => {}); })
      .on("postgres_changes", { event: "*", schema: "public", table: "encounter_participants", filter: `encounter_id=eq.${sessionId}` }, () => loadEncounter(sessionId).catch(() => {}))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, loadSessions, loadEncounter]);

  function clickHex(hex) {
    if (!activeParticipant || encounter?.status !== "active") { setMessage("Movement is available only during an active encounter turn."); return; }
    if (!canControl) { setMessage("This is not a character you control."); return; }
    const start = { q: Number(activeParticipant.q || 0), r: Number(activeParticipant.r || 0) };
    if (hex.q === start.q && hex.r === start.r) { setPath([]); setMessage(""); return; }
    const existingIndex = path.findIndex((row) => row.q === hex.q && row.r === hex.r);
    if (existingIndex >= 0) { setPath(path.slice(0, existingIndex)); setMessage(""); return; }
    const previous = path[path.length - 1] || start;
    if (hexDistance(previous, hex) !== 1) { setMessage("Build the route one adjacent hex at a time."); return; }
    if (mapData && hexDistance({ q:0, r:0 }, hex) > Number(mapData.radius || 0)) { setMessage("That hex is outside this encounter map."); return; }
    const key = hexKey(hex.q, hex.r);
    if (blockingKeys.has(key) || terrainByKey.get(key)?.terrain_type === "blocked") { setMessage("That hex is blocked."); return; }
    if (occupiedKeys.has(key)) { setMessage("That hex is occupied."); return; }
    const nextCost = pathCostFt + Math.ceil(5 * Number(terrainByKey.get(key)?.movement_multiplier || 1));
    if (nextCost > remainingFt) { setMessage("That path would exceed the active character's remaining Speed."); return; }
    setPath([...path, hex]); setMessage("");
  }

  async function submitMove() {
    if (!activeParticipant || !path.length || saving) return;
    setSaving(true); setMessage("");
    try {
      const { data, error } = await supabase.rpc("encounter_move_active_participant_v1", { p_participant_id: activeParticipant.id, p_path: path, p_request_id: requestId() });
      if (error) throw error;
      setPath([]);
      setMessage(`Move accepted. ${Number(data?.remainingFt ?? data?.remaining_ft ?? 0)} ft. remaining.`);
      await loadEncounter(sessionId);
    } catch (error) { setMessage(error?.message || "Movement was rejected."); }
    finally { setSaving(false); }
  }

  async function endTurn() {
    if (!activeParticipant || saving) return;
    setSaving(true); setMessage("");
    try {
      const { error } = await supabase.rpc("encounter_end_turn_v1", { p_participant_id: activeParticipant.id, p_request_id: requestId() });
      if (error) throw error;
      setPath([]); setMessage("Turn ended.");
      await loadEncounter(sessionId);
    } catch (error) { setMessage(error?.message || "Could not end turn."); }
    finally { setSaving(false); }
  }

  return (
    <main className="play-page">
      <header className="play-header">
        <div><div className="kicker">TACTICAL ENCOUNTER • PHASE 1D</div><h1>Turn Movement</h1><p>One hex is 5 feet. Your browser proposes a route; the server decides whether the movement is legal.</p></div>
        <nav><Link href="/encounters/live">GM Staging</Link><Link href="/encounters">Map Workshop</Link></nav>
      </header>
      {message ? <div className="message">{message}</div> : null}
      <section className="layout">
        <aside className="sidebar">
          <div className="panel"><div className="kicker">Encounter</div><select value={sessionId} onChange={(event) => setSessionId(event.target.value)}><option value="">Select encounter</option>{sessions.map((row) => <option key={row.id} value={row.id}>{row.name} • {row.status}</option>)}</select>{encounter ? <div className="meta"><strong>{encounter.name}</strong><span>{encounter.status} • Round {encounter.round}</span></div> : null}</div>
          <div className="panel"><div className="kicker">Active turn</div>{activeParticipant ? <><h2>{activeParticipant.display_name}</h2><div className="read"><span>Team</span><strong>{activeParticipant.team}</strong></div><div className="read"><span>Speed</span><strong>{speedFt} ft.</strong></div><div className="read"><span>Spent</span><strong>{spentFt} ft.</strong></div><div className="read"><span>Remaining</span><strong>{remainingFt} ft.</strong></div><div className={`control ${canControl ? "yes" : "no"}`}>{canControl ? "You control this turn" : "View only"}</div></> : <p>No active participant.</p>}</div>
          {activeParticipant ? <div className="panel"><div className="kicker">Proposed route</div><h2>{path.length} steps • {pathCostFt} ft.</h2><p>Click adjacent hexes to build the route. Click the starting hex to clear it; click an earlier route hex to trim it.</p><button onClick={submitMove} disabled={!canControl || !path.length || saving || encounter?.status !== "active"}>Move</button><button className="end" onClick={endTurn} disabled={!canControl || saving || encounter?.status !== "active"}>End Turn</button></div> : null}
          <div className="panel"><div className="kicker">Authority boundary</div><ul><li>Only the active participant may move.</li><li>Controller or character edit permission is required.</li><li>Blocked, occupied, non-adjacent, off-board, and over-budget paths are rejected server-side.</li><li>World-map coordinates and route travel are never written here.</li></ul></div>
        </aside>
        <section className="board-panel">{mapData ? <><div className="board-head"><div><span>{mapData.name}</span><strong>1 hex = 5 ft.</strong></div><div><span>Server version</span><strong>{encounter?.version || 0}</strong></div></div><EncounterTurnBoard radius={mapData.radius || 6} hexSize={mapData.hex_size || 38} terrainOverrides={terrain} objects={objects} participants={participants} activeParticipantId={encounter?.active_participant_id} path={path} onHexClick={clickHex} /></> : <div className="empty">Select a live encounter.</div>}</section>
      </section>
      <style jsx>{`
        .play-page{min-height:100vh;background:radial-gradient(circle at 70% 5%,rgba(73,55,98,.28),transparent 36%),linear-gradient(180deg,#080a0c,#101410 58%,#080a0b);color:#f3f0e8;padding:24px}.play-header{max-width:1600px;margin:0 auto 14px;display:flex;justify-content:space-between;gap:24px;padding:18px 20px;border:1px solid rgba(190,151,89,.22);border-radius:14px;background:rgba(12,14,16,.9)}.play-header h1{margin:4px 0;font-size:2rem}.play-header p{margin:0;color:rgba(255,255,255,.62)}.play-header nav{display:flex;gap:8px}.play-header nav :global(a){height:max-content;border:1px solid rgba(208,174,255,.25);border-radius:8px;padding:7px 10px;color:#e6d5fb;text-decoration:none}.kicker{font-size:.65rem;letter-spacing:.12em;color:#c8aee5;font-weight:800}.message{max-width:1600px;margin:0 auto 14px;border:1px solid rgba(208,174,255,.24);background:rgba(94,57,125,.16);border-radius:9px;padding:9px 12px}.layout{max-width:1600px;margin:0 auto;display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px}.sidebar{display:grid;align-content:start;gap:12px}.panel,.board-panel{border:1px solid rgba(255,255,255,.09);background:rgba(13,16,17,.92);border-radius:13px;box-shadow:0 15px 40px rgba(0,0,0,.25)}.panel{padding:15px}.panel h2{font-size:1rem;margin:5px 0 12px}.panel p,.panel li{font-size:.75rem;line-height:1.55;color:rgba(255,255,255,.62)}.panel ul{padding-left:17px;margin:8px 0 0}.panel select{width:100%;background:#090c0e;border:1px solid rgba(255,255,255,.14);color:#eee;border-radius:8px;padding:8px}.meta{display:grid;margin-top:10px}.meta span{font-size:.72rem;color:rgba(255,255,255,.55)}.read{display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.07);padding-top:8px;margin-top:8px;font-size:.76rem}.read span{color:rgba(255,255,255,.55)}.control{margin-top:11px;border-radius:8px;padding:8px;font-size:.72rem}.control.yes{background:rgba(54,132,88,.16);border:1px solid rgba(105,218,145,.28);color:#afe8c4}.control.no{background:rgba(120,87,55,.14);border:1px solid rgba(218,172,105,.22);color:#e3c89f}.panel button{width:100%;margin-top:8px;border:1px solid rgba(143,222,195,.3);background:rgba(54,132,100,.18);color:#b9ead8;border-radius:8px;padding:9px}.panel button.end{border-color:rgba(224,185,112,.28);background:rgba(140,94,43,.16);color:#ecd09d}.panel button:disabled{opacity:.4}.board-panel{padding:14px;min-width:0}.board-head{display:flex;justify-content:space-between;padding:2px 4px 12px}.board-head>div{display:grid}.board-head span{font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5)}.empty{padding:60px;text-align:center;color:rgba(255,255,255,.5)}@media(max-width:980px){.layout{grid-template-columns:1fr}.sidebar{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.play-page{padding:12px}.play-header{display:grid}.sidebar{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
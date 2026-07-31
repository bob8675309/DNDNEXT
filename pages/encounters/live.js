import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EncounterSessionBoard from "../../components/encounter/EncounterSessionBoard";
import { supabase } from "../../utils/supabaseClient";

const TEAMS = ["players", "allies", "enemies", "neutral"];

export default function LiveEncounterPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [maps, setMaps] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [mapData, setMapData] = useState(null);
  const [terrain, setTerrain] = useState([]);
  const [objects, setObjects] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedHex, setSelectedHex] = useState({ q: 0, r: 0 });
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [createMapId, setCreateMapId] = useState("");
  const [createName, setCreateName] = useState("New Tactical Encounter");
  const [stageCharacterId, setStageCharacterId] = useState("");
  const [stageTeam, setStageTeam] = useState("players");
  const [initiativeDraft, setInitiativeDraft] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const activeSession = useMemo(() => sessions.find((row) => String(row.id) === String(sessionId)) || null, [sessions, sessionId]);
  const selectedParticipant = useMemo(() => participants.find((row) => String(row.id) === String(selectedParticipantId)) || null, [participants, selectedParticipantId]);
  const stagedCharacterIds = useMemo(() => new Set(participants.map((row) => String(row.character_id || ""))), [participants]);
  const stagingOpen = ["draft", "ready", "initiative"].includes(activeSession?.status || "");
  const activeParticipant = useMemo(() => participants.find((row) => String(row.id) === String(activeSession?.active_participant_id || "")) || null, [participants, activeSession?.active_participant_id]);
  const initiativesReady = participants.length > 0 && participants.every((row) => row.is_defeated || row.initiative != null);

  const loadFoundation = useCallback(async () => {
    const [mapRes, encounterRes, charRes, authRes] = await Promise.all([
      supabase.from("encounter_maps").select("id,name,description,hex_size,radius,is_active").order("updated_at", { ascending: false }),
      supabase.from("encounters").select("id,map_id,name,status,round,turn_index,active_participant_id,phase,version,updated_at").neq("status", "archived").order("updated_at", { ascending: false }),
      supabase.from("characters").select("id,name,race,role,kind,visual_asset_id,portrait_thumb_url").order("name"),
      supabase.auth.getUser(),
    ]);
    if (mapRes.error) throw mapRes.error;
    if (encounterRes.error) throw encounterRes.error;
    if (charRes.error) throw charRes.error;
    const uid = authRes?.data?.user?.id || null;
    if (uid) {
      const adminRes = await supabase.rpc("is_admin", { uid });
      setIsAdmin(Boolean(adminRes.data));
    }
    setMaps(mapRes.data || []);
    setSessions(encounterRes.data || []);
    setCharacters(charRes.data || []);
    setCreateMapId((current) => current || mapRes.data?.[0]?.id || "");
    setStageCharacterId((current) => current || charRes.data?.[0]?.id || "");
    setSessionId((current) => current && encounterRes.data?.some((row) => String(row.id) === String(current)) ? current : (encounterRes.data?.[0]?.id || ""));
  }, []);

  const loadSession = useCallback(async (nextSessionId) => {
    if (!nextSessionId) {
      setMapData(null); setTerrain([]); setObjects([]); setParticipants([]); return;
    }
    const encounterRes = await supabase.from("encounters").select("id,map_id,name,status,round,turn_index,active_participant_id,phase,version,updated_at").eq("id", nextSessionId).single();
    if (encounterRes.error) throw encounterRes.error;
    const encounter = encounterRes.data;
    const [mapRes, terrainRes, objectRes, participantRes] = await Promise.all([
      supabase.from("encounter_maps").select("id,name,description,hex_size,radius").eq("id", encounter.map_id).single(),
      supabase.from("encounter_hex_overrides").select("map_id,q,r,terrain_type,movement_multiplier,elevation,hazard_key").eq("map_id", encounter.map_id),
      supabase.from("encounter_map_objects").select("id,map_id,object_type,q,r,blocks_movement,blocks_los,cover_level").eq("map_id", encounter.map_id),
      supabase.from("encounter_participants").select("id,encounter_id,character_id,display_name,team,controller_user_id,q,r,facing,initiative,initiative_tiebreaker,is_hidden,is_defeated,sprite_asset_id,state,updated_at").eq("encounter_id", nextSessionId).order("initiative", { ascending: false, nullsFirst: false }),
    ]);
    if (mapRes.error) throw mapRes.error;
    if (terrainRes.error) throw terrainRes.error;
    if (objectRes.error) throw objectRes.error;
    if (participantRes.error) throw participantRes.error;
    setMapData(mapRes.data);
    setTerrain(terrainRes.data || []);
    setObjects(objectRes.data || []);
    setParticipants(participantRes.data || []);
    setSessions((current) => current.map((row) => String(row.id) === String(encounter.id) ? encounter : row));
    setSelectedParticipantId((current) => current && participantRes.data?.some((row) => String(row.id) === String(current)) ? current : (participantRes.data?.[0]?.id || ""));
  }, []);

  useEffect(() => {
    loadFoundation().catch((error) => setMessage(error?.message || "Could not load encounter sessions."));
  }, [loadFoundation]);

  useEffect(() => {
    loadSession(sessionId).catch((error) => setMessage(error?.message || "Could not load selected encounter."));
  }, [loadSession, sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const channel = supabase.channel(`encounter-session-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "encounters", filter: `id=eq.${sessionId}` }, () => {
        loadFoundation().catch(() => {}); loadSession(sessionId).catch(() => {});
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "encounter_participants", filter: `encounter_id=eq.${sessionId}` }, () => loadSession(sessionId).catch(() => {}))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, loadFoundation, loadSession]);

  useEffect(() => {
    if (selectedParticipant) {
      setSelectedHex({ q: Number(selectedParticipant.q || 0), r: Number(selectedParticipant.r || 0) });
      setInitiativeDraft(selectedParticipant.initiative == null ? "" : String(selectedParticipant.initiative));
    }
  }, [selectedParticipant]);

  async function run(task, success) {
    if (saving) return;
    setSaving(true); setMessage("");
    try { await task(); setMessage(success); await loadFoundation(); if (sessionId) await loadSession(sessionId); }
    catch (error) { setMessage(error?.message || "Encounter update failed."); }
    finally { setSaving(false); }
  }

  async function createEncounter() {
    if (!isAdmin || !createMapId) return;
    let createdId = "";
    await run(async () => {
      const res = await supabase.rpc("admin_create_encounter_v1", { p_map_id: createMapId, p_name: createName, p_settings: { workflow: "durable-encounter" } });
      if (res.error) throw res.error;
      createdId = res.data;
    }, "Encounter session created.");
    if (createdId) setSessionId(createdId);
  }

  function setStatus(status) {
    if (!activeSession || !isAdmin) return;
    return run(async () => {
      const res = await supabase.rpc("admin_set_encounter_status_v1", { p_encounter_id: activeSession.id, p_status: status });
      if (res.error) throw res.error;
    }, `Encounter status set to ${status}.`);
  }

  function addParticipant() {
    if (!activeSession || !stageCharacterId || !isAdmin) return;
    return run(async () => {
      const res = await supabase.rpc("admin_add_encounter_participant_v1", {
        p_encounter_id: activeSession.id, p_character_id: stageCharacterId, p_team: stageTeam,
        p_q: selectedHex.q, p_r: selectedHex.r, p_state: { stagedFrom: "encounter-staging" },
      });
      if (res.error) throw res.error;
      setSelectedParticipantId(res.data || "");
    }, "Character staged in encounter.");
  }

  function saveSelectedParticipant() {
    if (!selectedParticipant || !isAdmin) return;
    return run(async () => {
      const res = await supabase.rpc("admin_update_encounter_participant_staging_v1", {
        p_participant_id: selectedParticipant.id,
        p_q: selectedHex.q, p_r: selectedHex.r, p_team: selectedParticipant.team,
        p_controller_user_id: selectedParticipant.controller_user_id,
        p_initiative: initiativeDraft === "" ? null : Number(initiativeDraft),
        p_initiative_tiebreaker: selectedParticipant.initiative_tiebreaker,
        p_is_hidden: selectedParticipant.is_hidden,
        p_state: selectedParticipant.state || {},
      });
      if (res.error) throw res.error;
    }, "Participant staging updated.");
  }

  function removeSelectedParticipant() {
    if (!selectedParticipant || !isAdmin) return;
    return run(async () => {
      const res = await supabase.rpc("admin_remove_encounter_participant_v1", { p_participant_id: selectedParticipant.id });
      if (res.error) throw res.error;
      setSelectedParticipantId("");
    }, "Participant removed from encounter.");
  }

  function startEncounter() {
    if (!activeSession || !isAdmin || !stagingOpen || !initiativesReady) return;
    return run(async () => {
      const res = await supabase.rpc("admin_start_encounter_v1", { p_encounter_id: activeSession.id });
      if (res.error) throw res.error;
    }, "Encounter started. Initiative order and turn resources are server-authoritative.");
  }

  function pauseEncounter() {
    if (activeSession?.status !== "active" || !isAdmin) return;
    return setStatus("paused");
  }

  function resumeEncounter() {
    if (activeSession?.status !== "paused" || !isAdmin) return;
    return setStatus("active");
  }

  function resolveEncounter() {
    if (!activeSession || !isAdmin || !["active", "paused"].includes(activeSession.status)) return;
    return setStatus("resolved");
  }

  function archiveEncounter() {
    if (activeSession?.status !== "resolved" || !isAdmin) return;
    return setStatus("archived");
  }

  return (
    <main className="live-page">
      <header className="live-header">
        <div><div className="kicker">TACTICAL ENCOUNTER SYSTEM • MILESTONE 2</div><h1>Encounter Staging & Control</h1><p>Stage encounter-local participants, set initiative, then start server-authoritative turn play. Tactical state never changes world travel or town position.</p></div>
        <div className="header-links"><Link href="/encounters/play">Turn Play</Link><Link href="/encounters/combat">Combat</Link><Link href="/encounters">Map Workshop</Link><span>{isAdmin ? "GM Control" : "Realtime Viewer"}</span></div>
      </header>
      {message ? <div className="message">{message}</div> : null}
      <section className="layout">
        <aside className="sidebar">
          <div className="panel">
            <div className="kicker">Session library</div><h2>Encounter</h2>
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}><option value="">No encounter selected</option>{sessions.map((row) => <option key={row.id} value={row.id}>{row.name} • {row.status}</option>)}</select>
            {activeSession ? <div className="session-meta"><strong>{activeSession.name}</strong><span>Status {activeSession.status} • Round {activeSession.round} • v{activeSession.version}</span><span>Phase {activeSession.phase}</span></div> : null}
            {isAdmin ? <div className="create"><select value={createMapId} onChange={(e) => setCreateMapId(e.target.value)}>{maps.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select><input value={createName} onChange={(e) => setCreateName(e.target.value)} /><button onClick={createEncounter} disabled={saving || !createMapId}>Create session</button></div> : null}
          </div>

          {activeSession && isAdmin ? <div className="panel"><div className="kicker">Lifecycle</div><h2>GM state</h2>{stagingOpen ? <><div className="status-grid"><button className={activeSession.status === "draft" ? "active" : ""} onClick={() => setStatus("draft")} disabled={saving}>Draft</button><button className={activeSession.status === "ready" ? "active" : ""} onClick={() => setStatus("ready")} disabled={saving}>Ready</button><button className={activeSession.status === "initiative" ? "active" : ""} onClick={() => setStatus("initiative")} disabled={saving}>Initiative</button></div><button className="start" onClick={startEncounter} disabled={saving || !initiativesReady}>Start encounter</button><p>{participants.length === 0 ? "Stage at least one participant before starting." : initiativesReady ? "Start selects the first participant by initiative and initializes turn resources atomically." : "Every non-defeated participant needs an initiative before starting."}</p></> : null}{activeSession.status === "active" ? <><button onClick={pauseEncounter} disabled={saving}>Pause encounter</button><button className="danger" onClick={resolveEncounter} disabled={saving}>Resolve encounter</button></> : null}{activeSession.status === "paused" ? <><button className="start" onClick={resumeEncounter} disabled={saving}>Resume encounter</button><button className="danger" onClick={resolveEncounter} disabled={saving}>Resolve encounter</button></> : null}{activeSession.status === "resolved" ? <><p>Resolved encounters remain readable until archived. Archiving removes them from the normal session lists but preserves the reusable tactical map.</p><button className="danger" onClick={archiveEncounter} disabled={saving}>Archive encounter</button></> : null}</div> : null}

          {activeSession ? <div className="panel"><div className="kicker">Participants</div><h2>{participants.length} staged</h2><div className="participant-list">{participants.map((row) => <button key={row.id} className={String(row.id) === String(selectedParticipantId) ? "selected" : ""} onClick={() => setSelectedParticipantId(row.id)}><span><strong>{row.display_name}</strong><small>{row.team} • {row.q},{row.r}</small></span><em>{row.initiative == null ? "—" : row.initiative}</em></button>)}</div></div> : null}

          {activeSession && isAdmin && stagingOpen ? <div className="panel"><div className="kicker">GM staging</div><h2>Spawn at {selectedHex.q}, {selectedHex.r}</h2><select value={stageCharacterId} onChange={(e) => setStageCharacterId(e.target.value)}>{characters.filter((row) => !stagedCharacterIds.has(String(row.id))).map((row) => <option key={row.id} value={row.id}>{row.name} • {row.race || row.kind}</option>)}</select><select value={stageTeam} onChange={(e) => setStageTeam(e.target.value)}>{TEAMS.map((team) => <option key={team}>{team}</option>)}</select><button onClick={addParticipant} disabled={saving || !stageCharacterId}>Stage character here</button>{selectedParticipant ? <div className="selected-edit"><strong>Edit {selectedParticipant.display_name}</strong><label>Initiative<input type="number" value={initiativeDraft} onChange={(e) => setInitiativeDraft(e.target.value)} /></label><button onClick={saveSelectedParticipant} disabled={saving}>Save position + initiative</button><button className="danger" onClick={removeSelectedParticipant} disabled={saving}>Remove</button></div> : null}</div> : null}

          {activeSession && participants.length ? <div className="panel"><div className="kicker">Turn authority</div><h2>{activeParticipant ? activeParticipant.display_name : "No active turn"}</h2><p>{activeSession.status === "active" ? "Turn ownership advances through the guarded End Turn command. The staging UI does not manually rewrite the active turn." : "The active turn is established when the GM starts the encounter and preserved while paused."}</p></div> : null}
        </aside>

        <section className="board-panel">
          <div className="board-head"><div><span>{mapData?.name || "No saved map"}</span><strong>{activeSession?.name || "Create or select a session"}</strong></div><div><span>Selected spawn hex</span><strong>{selectedHex.q}, {selectedHex.r}</strong></div></div>
          {mapData ? <EncounterSessionBoard radius={mapData.radius || 6} hexSize={mapData.hex_size || 38} selected={selectedHex} onSelect={setSelectedHex} terrainOverrides={terrain} objects={objects} participants={participants} activeParticipantId={activeSession?.active_participant_id} /> : <div className="empty">Select or create an encounter to load its tactical board.</div>}
        </section>
      </section>
      <style jsx>{`
        .live-page{min-height:100vh;padding:24px;background:radial-gradient(circle at 78% 4%,rgba(91,63,118,.22),transparent 34%),linear-gradient(#080a0c,#111512 55%,#080a0b);color:#f3f0e8}.live-header{max-width:1600px;margin:0 auto 14px;display:flex;justify-content:space-between;gap:20px;padding:19px 21px;border:1px solid rgba(190,151,89,.22);border-radius:14px;background:rgba(12,14,16,.9)}.live-header h1{margin:4px 0;font-size:1.9rem}.live-header p{margin:0;color:rgba(255,255,255,.6)}.kicker{font-size:.65rem;letter-spacing:.12em;color:#c8aee5;font-weight:850}.header-links{display:flex;align-items:center;gap:10px}.header-links a,.header-links span{border:1px solid rgba(255,255,255,.13);border-radius:999px;padding:7px 10px;color:#d9cfec;font-size:.72rem}.message{max-width:1600px;margin:0 auto 12px;padding:8px 11px;border:1px solid rgba(208,174,255,.24);border-radius:8px;background:rgba(94,57,125,.16);font-size:.75rem}.layout{max-width:1600px;margin:auto;display:grid;grid-template-columns:330px minmax(0,1fr);gap:15px}.sidebar{display:grid;gap:11px;align-content:start}.panel,.board-panel{border:1px solid rgba(255,255,255,.09);background:rgba(13,16,17,.92);border-radius:12px}.panel{padding:14px}.panel h2{margin:4px 0 10px;font-size:1rem}.panel select,.panel input,.panel button{width:100%;background:#090c0e;border:1px solid rgba(255,255,255,.14);color:#eee;border-radius:7px;padding:7px;margin-top:6px;font-size:.72rem}.panel button{background:rgba(115,75,151,.2);border-color:rgba(205,169,240,.25)}.panel button.start{background:rgba(54,132,88,.2);border-color:rgba(105,218,145,.3);color:#b9ead8}.panel button.active,.panel button.selected{border-color:#caa5ef;background:rgba(117,70,158,.34)}.panel button.danger{border-color:rgba(231,111,101,.35);color:#ffc0ba}.session-meta{display:grid;gap:2px;margin-top:9px;font-size:.71rem}.session-meta span,.panel p{color:rgba(255,255,255,.54);font-size:.69rem}.create{margin-top:10px}.status-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.participant-list{display:grid;gap:5px}.participant-list button{display:flex;justify-content:space-between;align-items:center;text-align:left}.participant-list button span{display:grid}.participant-list small{color:rgba(255,255,255,.5)}.participant-list em{font-style:normal;color:#ead78f}.selected-edit{margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.08)}.selected-edit label{display:grid;margin-top:6px;font-size:.68rem;color:rgba(255,255,255,.55)}.board-panel{padding:13px;min-width:0}.board-head{display:flex;justify-content:space-between;gap:15px;padding:3px 4px 11px}.board-head>div{display:grid}.board-head span{font-size:.64rem;text-transform:uppercase;color:rgba(255,255,255,.48);letter-spacing:.08em}.board-head strong{font-size:.86rem;color:#eadfc7}.empty{min-height:540px;display:grid;place-items:center;border:1px dashed rgba(255,255,255,.12);border-radius:12px;color:rgba(255,255,255,.45)}@media(max-width:1000px){.layout{grid-template-columns:1fr}.sidebar{grid-template-columns:repeat(2,minmax(0,1fr))}.board-panel{grid-column:1/-1}}@media(max-width:680px){.live-page{padding:12px}.live-header{display:grid}.sidebar{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}

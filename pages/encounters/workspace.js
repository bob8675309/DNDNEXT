import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../utils/supabaseClient";
import LiveEncounterPage from "./live";
import EncounterPlayPage from "./play";
import EncounterCombatPage from "./combat";
import EncounterMapWorkshop from "../encounters";
import styles from "../../styles/EncounterWorkspace.module.css";

const VIEWS = [
  { id: "setup", title: "Setup & GM", hint: "Create, stage, initiate, pause, and resolve" },
  { id: "move", title: "Movement & Reactions", hint: "Routes, movement budget, opportunity attacks" },
  { id: "combat", title: "Combat & Spells", hint: "Weapons, actions, spellcasting, and combat history" },
  { id: "map", title: "Map Workshop", hint: "Edit reusable tactical boards" },
];

export default function EncounterWorkspace() {
  const [view, setView] = useState("setup");
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const refreshSessions = useCallback(async () => {
    const { data, error: loadError } = await supabase.from("encounters")
      .select("id,name,status,round,version").neq("status", "archived")
      .order("updated_at", { ascending: false });
    if (loadError) { setError(loadError.message); return; }
    const rows = data || [];
    setSessions(rows);
    setSessionId((current) => rows.some((x) => String(x.id) === String(current))
      ? current : (rows.find((x) => x.status === "active")?.id || rows[0]?.id || ""));
    setError("");
  }, []);
  useEffect(() => { void refreshSessions(); }, [refreshSessions]);
  useEffect(() => {
    const channel = supabase.channel("encounter-workspace-session-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "encounters" }, () => { void refreshSessions(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refreshSessions]);
  const active = sessions.find((row) => String(row.id) === String(sessionId));
  const selection = useCallback((nextId) => setSessionId(nextId), []);
  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>DNDNEXT / TACTICAL ENCOUNTERS</span>
        <h1>Encounter Workspace</h1>
        <p>One home for encounter preparation, turn movement, reactions, attacks, spells, and tactical maps.</p>
      </div>
      <div className={styles.status}>
        <span className={styles.eyebrow}>CURRENT ENCOUNTER</span>
        <select aria-label="Workspace encounter" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          <option value="">Select an encounter</option>
          {sessions.map((row) => <option key={row.id} value={row.id}>{row.name} — {row.status}</option>)}
        </select>
        <span className={styles.meta}>{active ? `${active.status.toUpperCase()} · ROUND ${active.round}` : "Create one in Setup & GM"}</span>
        <button type="button" onClick={() => { void refreshSessions(); }}>Refresh encounter list</button>
      </div>
    </header>
    {error ? <div role="alert" className={styles.error}>Could not refresh encounters: {error}</div> : null}
    <nav className={styles.nav} aria-label="Encounter workspace sections">
      {VIEWS.map((item, index) => <button key={item.id} type="button" aria-current={view === item.id ? "page" : undefined}
        className={view === item.id ? styles.selected : ""} onClick={() => setView(item.id)}>
        <strong>{index + 1}. {item.title}</strong><small>{item.hint}</small>
      </button>)}
    </nav>
    <section className={styles.guide} aria-label="How to use this workspace">
      <strong>{view === "setup" ? "Start here" : view === "move" ? "During a turn" : view === "combat" ? "Resolve the action" : "Prepare the terrain"}</strong>
      <span>{view === "setup" ? "Choose a map, create a session, add characters, set initiatives, then start the encounter."
        : view === "move" ? "Click adjacent hexes to plan a path, then Move. Resolve any opportunity reaction before continuing."
        : view === "combat" ? "Select the active actor, target and available action. The server determines legality and applies the outcome."
        : "Tactical boards are reusable. Editing a map affects every session using that map; review changes before saving."}</span>
      <Link href="/encounters/live">Classic encounter pages</Link>
    </section>
    <div className={styles.surface}>
      {view === "setup" ? <LiveEncounterPage workspaceSessionId={sessionId} onWorkspaceSessionChange={selection} /> : null}
      {view === "move" ? <EncounterPlayPage workspaceSessionId={sessionId} onWorkspaceSessionChange={selection} /> : null}
      {view === "combat" ? <EncounterCombatPage workspaceSessionId={sessionId} onWorkspaceSessionChange={selection} /> : null}
      {view === "map" ? <EncounterMapWorkshop /> : null}
    </div>
  </div>;
}

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EncounterTurnBoard from "../../components/encounter/EncounterTurnBoard";
import { hexDistance } from "../../utils/encounterHex";
import { supabase } from "../../utils/supabaseClient";

function requestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-0000-4000-8000-000000000000`.slice(0, 36);
}

function bonusLabel(value) {
  const n = Number(value || 0);
  return n >= 0 ? `+${n}` : String(n);
}

export default function EncounterCombatPage() {
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [encounter, setEncounter] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [terrain, setTerrain] = useState([]);
  const [objects, setObjects] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [log, setLog] = useState([]);
  const [canControl, setCanControl] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [weapons, setWeapons] = useState([]);
  const [weaponId, setWeaponId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const active = useMemo(() => participants.find((p) => String(p.id) === String(encounter?.active_participant_id || "")) || null, [participants, encounter?.active_participant_id]);
  const targets = useMemo(() => participants.filter((p) => !p.is_defeated && String(p.id) !== String(active?.id || "")), [participants, active?.id]);
  const target = useMemo(() => targets.find((p) => String(p.id) === String(targetId)) || null, [targets, targetId]);
  const weapon = useMemo(() => weapons.find((row) => String(row.inventoryItemId) === String(weaponId)) || null, [weapons, weaponId]);
  const targetDistance = active && target ? hexDistance({ q: Number(active.q || 0), r: Number(active.r || 0) }, { q: Number(target.q || 0), r: Number(target.r || 0) }) : null;
  const targetDistanceFt = targetDistance == null ? null : targetDistance * 5;
  const moveAllowance = Number(active?.speed_ft || 30) + Number(active?.movement_bonus_ft || 0);
  const remainingFt = Math.max(0, moveAllowance - Number(active?.movement_spent_ft || 0));
  const weaponMaxRange = weapon ? Number((weapon.isRanged || weapon.isThrown) ? weapon.longRangeFt : weapon.reachFt) : 0;
  const weaponNormalRange = weapon ? Number((weapon.isRanged || weapon.isThrown) ? weapon.normalRangeFt : weapon.reachFt) : 0;
  const weaponInRange = Boolean(weapon && target && targetDistanceFt <= weaponMaxRange);
  const weaponLongRange = Boolean(weaponInRange && targetDistanceFt > weaponNormalRange);

  const loadSessions = useCallback(async () => {
    const res = await supabase.from("encounters").select("id,map_id,name,status,round,turn_index,active_participant_id,phase,version,updated_at").neq("status", "archived").order("updated_at", { ascending: false });
    if (res.error) throw res.error;
    const rows = res.data || [];
    setSessions(rows);
    setSessionId((current) => current && rows.some((r) => String(r.id) === String(current)) ? current : (rows.find((r) => r.status === "active")?.id || rows[0]?.id || ""));
  }, []);

  const loadEncounter = useCallback(async (id) => {
    if (!id) { setEncounter(null); setParticipants([]); setLog([]); return; }
    const enc = await supabase.from("encounters").select("id,map_id,name,status,round,turn_index,active_participant_id,phase,version,updated_at").eq("id", id).single();
    if (enc.error) throw enc.error;
    const [mapRes, terrainRes, objectRes, participantRes, logRes] = await Promise.all([
      supabase.from("encounter_maps").select("id,name,description,hex_size,radius").eq("id", enc.data.map_id).single(),
      supabase.from("encounter_hex_overrides").select("map_id,q,r,terrain_type,movement_multiplier,elevation,hazard_key").eq("map_id", enc.data.map_id),
      supabase.from("encounter_map_objects").select("id,map_id,object_type,q,r,blocks_movement,blocks_los,cover_level").eq("map_id", enc.data.map_id),
      supabase.from("encounter_participants").select("id,encounter_id,character_id,display_name,team,controller_user_id,q,r,facing,initiative,current_hp,temp_hp,armor_class,movement_spent_ft,movement_bonus_ft,speed_ft,action_available,bonus_action_available,reaction_available,disengaged,dodging,is_hidden,is_defeated,sprite_asset_id,state,updated_at").eq("encounter_id", id).order("initiative", { ascending: false, nullsFirst: false }),
      supabase.from("encounter_combat_log").select("id,encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail,created_at").eq("encounter_id", id).order("id", { ascending: false }).limit(40),
    ]);
    if (mapRes.error) throw mapRes.error;
    if (terrainRes.error) throw terrainRes.error;
    if (objectRes.error) throw objectRes.error;
    if (participantRes.error) throw participantRes.error;
    if (logRes.error) throw logRes.error;
    setEncounter(enc.data); setMapData(mapRes.data); setTerrain(terrainRes.data || []); setObjects(objectRes.data || []); setParticipants(participantRes.data || []); setLog(logRes.data || []);
  }, []);

  const loadWeapons = useCallback(async (participantId) => {
    if (!participantId) { setWeapons([]); setWeaponId(""); return; }
    const { data, error } = await supabase.rpc("encounter_equipped_weapon_profiles_v1", { p_participant_id: participantId });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    setWeapons(rows);
    setWeaponId((current) => current && rows.some((row) => String(row.inventoryItemId) === String(current)) ? current : (rows[0]?.inventoryItemId || ""));
  }, []);

  useEffect(() => { loadSessions().catch((e) => setMessage(e?.message || "Could not load encounters.")); }, [loadSessions]);
  useEffect(() => { loadEncounter(sessionId).catch((e) => setMessage(e?.message || "Could not load combat state.")); }, [loadEncounter, sessionId]);
  useEffect(() => {
    let cancelled = false;
    if (!active?.id) { setCanControl(false); setWeapons([]); setWeaponId(""); return undefined; }
    supabase.rpc("encounter_can_control_participant_v1", { p_participant_id: active.id }).then(({ data, error }) => {
      if (cancelled) return;
      const allowed = !error && Boolean(data);
      setCanControl(allowed);
      if (allowed) loadWeapons(active.id).catch((e) => setMessage(e?.message || "Could not load equipped weapons."));
      else { setWeapons([]); setWeaponId(""); }
    });
    return () => { cancelled = true; };
  }, [active?.id, loadWeapons]);
  useEffect(() => { setTargetId((current) => targets.some((p) => String(p.id) === String(current)) ? current : (targets[0]?.id || "")); }, [targets]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const channel = supabase.channel(`encounter-combat-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "encounters", filter: `id=eq.${sessionId}` }, () => { loadSessions().catch(() => {}); loadEncounter(sessionId).catch(() => {}); })
      .on("postgres_changes", { event: "*", schema: "public", table: "encounter_participants", filter: `encounter_id=eq.${sessionId}` }, () => loadEncounter(sessionId).catch(() => {}))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "encounter_combat_log", filter: `encounter_id=eq.${sessionId}` }, () => loadEncounter(sessionId).catch(() => {}))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, loadSessions, loadEncounter]);

  async function runRpc(name, args, success) {
    if (saving) return;
    setSaving(true); setMessage("");
    try {
      const { data, error } = await supabase.rpc(name, args);
      if (error) throw error;
      setMessage(typeof success === "function" ? success(data) : success);
      await loadEncounter(sessionId);
      if (active?.id && canControl) await loadWeapons(active.id);
    } catch (error) { setMessage(error?.message || "Combat action rejected."); }
    finally { setSaving(false); }
  }

  function coreAction(action) {
    if (!active) return;
    return runRpc("encounter_use_core_action_v1", { p_participant_id: active.id, p_action: action, p_request_id: requestId() }, `${action[0].toUpperCase()}${action.slice(1)} accepted.`);
  }

  function unarmedStrike() {
    if (!active || !target) return;
    return runRpc("encounter_unarmed_strike_v1", { p_attacker_id: active.id, p_target_id: target.id, p_request_id: requestId() }, (data) => data?.hit ? `Hit for ${data.damage} damage.` : `Missed with ${data?.total ?? "?"} vs AC ${data?.targetAc ?? "?"}.`);
  }

  function weaponAttack() {
    if (!active || !target || !weapon) return;
    return runRpc("encounter_weapon_attack_v1", { p_attacker_id: active.id, p_target_id: target.id, p_inventory_item_id: weapon.inventoryItemId, p_request_id: requestId() }, (data) => data?.hit ? `${data.weapon} hit for ${data.damage} ${data.damageType} damage.` : `${data?.weapon || weapon.name} missed with ${data?.total ?? "?"} vs AC ${data?.targetAc ?? "?"}.`);
  }

  return (
    <main className="combat-page">
      <header className="combat-header">
        <div><div className="kicker">TACTICAL ENCOUNTER • PHASE 1F</div><h1>Weapon Combat</h1><p>Equipped weapon statistics are rebuilt from canonical inventory and item-catalog data by the server. Movement remains on the Turn Movement surface.</p></div>
        <nav><Link href="/encounters/play">Turn Movement</Link><Link href="/encounters/live">GM Staging</Link><Link href="/encounters">Map Workshop</Link></nav>
      </header>
      {message ? <div className="message">{message}</div> : null}
      <section className="layout">
        <aside className="sidebar">
          <div className="panel"><div className="kicker">Encounter</div><select value={sessionId} onChange={(e) => setSessionId(e.target.value)}><option value="">Select encounter</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name} • {s.status}</option>)}</select>{encounter ? <div className="meta"><strong>{encounter.name}</strong><span>Round {encounter.round} • Turn {Number(encounter.turn_index || 0) + 1}</span></div> : null}</div>
          <div className="panel"><div className="kicker">Active participant</div>{active ? <><h2>{active.display_name}</h2><div className="read"><span>HP</span><strong>{active.current_hp ?? "—"}{active.temp_hp ? ` +${active.temp_hp}` : ""}</strong></div><div className="read"><span>AC</span><strong>{active.armor_class ?? "—"}</strong></div><div className="read"><span>Movement</span><strong>{remainingFt} ft.</strong></div><div className="resource-row"><span className={active.action_available ? "on" : "off"}>Action</span><span className={active.bonus_action_available ? "on" : "off"}>Bonus</span><span className={active.reaction_available ? "on" : "off"}>Reaction</span></div><div className={`control ${canControl ? "yes" : "no"}`}>{canControl ? "You control this turn" : "View only"}</div></> : <p>No active participant.</p>}</div>
          {active ? <div className="panel"><div className="kicker">Core actions</div><div className="action-grid"><button onClick={() => coreAction("dash")} disabled={!canControl || !active.action_available || saving}>Dash</button><button onClick={() => coreAction("disengage")} disabled={!canControl || !active.action_available || saving}>Disengage</button><button onClick={() => coreAction("dodge")} disabled={!canControl || !active.action_available || saving}>Dodge</button></div><div className="effects">{active.movement_bonus_ft ? <span>Dash +{active.movement_bonus_ft} ft.</span> : null}{active.disengaged ? <span>Disengaged</span> : null}{active.dodging ? <span>Dodging</span> : null}</div></div> : null}
          {active ? <div className="panel"><div className="kicker">Target</div><select value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">Choose target</option>{targets.map((p) => <option key={p.id} value={p.id}>{p.display_name} • {p.team} • HP {p.current_hp ?? "?"}</option>)}</select>{target ? <div className="read"><span>Distance</span><strong>{targetDistanceFt} ft.</strong></div> : null}</div> : null}
          {active ? <div className="panel weapon-card"><div className="kicker">Equipped weapons</div>{weapons.length ? <><select value={weaponId} onChange={(e) => setWeaponId(e.target.value)}>{weapons.map((row) => <option key={row.inventoryItemId} value={row.inventoryItemId}>{row.name}</option>)}</select>{weapon ? <div className="weapon-stats"><span>{weapon.damageDice} {weapon.damageType}</span><span>Attack {bonusLabel(weapon.attackBonus)}</span><span>{weapon.proficient ? "Proficient" : "Not proficient"}</span><span>{weapon.isRanged ? `${weapon.normalRangeFt}/${weapon.longRangeFt} ft.` : weapon.isThrown ? `Reach ${weapon.reachFt}; throw ${weapon.normalRangeFt}/${weapon.longRangeFt} ft.` : `Reach ${weapon.reachFt} ft.`}</span>{weapon.magicBonus ? <span>Magic {bonusLabel(weapon.magicBonus)}</span> : null}{weaponLongRange ? <span className="warn">Long range • disadvantage</span> : null}</div> : null}<button className="attack" onClick={weaponAttack} disabled={!canControl || !active.action_available || !target || !weaponInRange || saving}>Attack with {weapon?.name || "weapon"}</button>{target && weapon && !weaponInRange ? <p className="warn-text">Target is beyond this weapon's supported reach/range.</p> : null}</> : <p>No supported equipped weapon is available. Equip a weapon in Inventory to expose its canonical attack profile here.</p>}</div> : null}
          {active ? <div className="panel"><div className="kicker">Fallback attack</div><h2>Unarmed Strike</h2><button className="attack" onClick={unarmedStrike} disabled={!canControl || !active.action_available || !target || targetDistance > 1 || saving}>Unarmed Strike</button><p>Strength + proficiency vs target AC. A Dodging target imposes disadvantage. Damage remains encounter-local.</p></div> : null}
        </aside>
        <section className="main-column">
          <div className="board-panel">{mapData ? <EncounterTurnBoard radius={mapData.radius || 6} hexSize={mapData.hex_size || 38} terrainOverrides={terrain} objects={objects} participants={participants} activeParticipantId={encounter?.active_participant_id} path={[]} /> : <div className="empty">Select an encounter.</div>}</div>
          <div className="log-panel"><div className="log-head"><span>Combat log</span><strong>{log.length} recent events</strong></div>{log.length ? <div className="log-list">{log.map((row) => <article key={row.id}><div><strong>R{row.round} T{Number(row.turn_index || 0) + 1}</strong><span>{row.event_type.replaceAll("_", " ")}</span></div><p>{row.summary}</p>{row.detail?.damageType && row.detail?.hit ? <small>{row.detail.damage} {row.detail.damageType} damage</small> : null}</article>)}</div> : <p className="empty-log">No combat actions yet.</p>}</div>
        </section>
      </section>
      <style jsx>{`
        .combat-page{min-height:100vh;background:radial-gradient(circle at 74% 4%,rgba(91,55,55,.25),transparent 34%),linear-gradient(180deg,#090a0c,#111311 58%,#080a0b);color:#f3f0e8;padding:24px}.combat-header{max-width:1600px;margin:0 auto 14px;display:flex;justify-content:space-between;gap:20px;padding:18px 20px;border:1px solid rgba(190,151,89,.22);border-radius:14px;background:rgba(12,14,16,.92)}.combat-header h1{margin:4px 0;font-size:2rem}.combat-header p{margin:0;color:rgba(255,255,255,.62)}.combat-header nav{display:flex;gap:8px;flex-wrap:wrap}.combat-header nav :global(a){height:max-content;border:1px solid rgba(208,174,255,.25);border-radius:8px;padding:7px 10px;color:#e6d5fb;text-decoration:none}.kicker{font-size:.65rem;letter-spacing:.12em;color:#c8aee5;font-weight:800}.message{max-width:1600px;margin:0 auto 14px;border:1px solid rgba(208,174,255,.24);background:rgba(94,57,125,.16);border-radius:9px;padding:9px 12px}.layout{max-width:1600px;margin:0 auto;display:grid;grid-template-columns:330px minmax(0,1fr);gap:16px}.sidebar,.main-column{display:grid;align-content:start;gap:12px}.panel,.board-panel,.log-panel{border:1px solid rgba(255,255,255,.09);background:rgba(13,16,17,.92);border-radius:13px;box-shadow:0 15px 40px rgba(0,0,0,.25)}.panel{padding:15px}.panel h2{font-size:1rem;margin:5px 0 12px}.panel p{font-size:.72rem;line-height:1.5;color:rgba(255,255,255,.58)}.panel select{width:100%;background:#090c0e;border:1px solid rgba(255,255,255,.14);color:#eee;border-radius:8px;padding:8px}.meta{display:grid;margin-top:10px}.meta span{font-size:.72rem;color:rgba(255,255,255,.55)}.read{display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.07);padding-top:8px;margin-top:8px;font-size:.76rem}.read span{color:rgba(255,255,255,.56)}.resource-row,.effects,.weapon-stats{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.resource-row span,.effects span,.weapon-stats span{border-radius:999px;padding:4px 7px;font-size:.66rem;border:1px solid rgba(255,255,255,.1)}.resource-row .on{color:#a9ebc1;background:rgba(52,113,75,.18)}.resource-row .off{color:#d69b96;background:rgba(120,55,55,.18)}.effects span,.weapon-stats span{color:#e8d4ff;border-color:rgba(210,174,255,.25)}.weapon-stats .warn{color:#ffd39b;border-color:rgba(255,190,110,.35)}.warn-text{color:#e9b57b!important}.control{margin-top:10px;padding:7px 9px;border-radius:7px;font-size:.72rem}.control.yes{color:#a9ebc1;background:rgba(52,113,75,.18)}.control.no{color:#d69b96;background:rgba(120,55,55,.15)}.action-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.panel button{border:1px solid rgba(208,174,255,.25);background:rgba(118,76,153,.18);color:#eadbff;border-radius:8px;padding:8px;font-size:.72rem}.panel button:disabled{opacity:.4}.panel .attack{width:100%;margin-top:10px;border-color:rgba(242,148,134,.3);background:rgba(128,58,52,.2);color:#ffd0ca}.board-panel{padding:12px;min-width:0}.log-panel{padding:14px}.log-head{display:flex;justify-content:space-between;gap:12px}.log-head span{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#c8aee5}.log-head strong{font-size:.75rem;color:rgba(255,255,255,.58)}.log-list{display:grid;gap:7px;margin-top:10px;max-height:320px;overflow:auto}.log-list article{border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:8px 10px;background:rgba(255,255,255,.02)}.log-list article>div{display:flex;gap:8px}.log-list article strong{font-size:.68rem;color:#e9d9af}.log-list article span{font-size:.68rem;color:rgba(255,255,255,.48);text-transform:capitalize}.log-list p{margin:4px 0 0;font-size:.76rem}.log-list small{display:block;margin-top:3px;color:#d9b88a;font-size:.68rem}.empty,.empty-log{padding:28px;color:rgba(255,255,255,.5)}@media(max-width:980px){.layout{grid-template-columns:1fr}.combat-header{display:grid}}@media(max-width:520px){.action-grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}

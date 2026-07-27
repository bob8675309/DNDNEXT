import { useCallback, useEffect, useMemo, useState } from "react";
import EncounterHexBoard from "../components/encounter/EncounterHexBoard";
import { feetToHexes, hexDistance, hexKey, hexesToFeet } from "../utils/encounterHex";
import { supabase } from "../utils/supabaseClient";

const SPEED_OPTIONS = [20, 25, 30, 35, 40, 50, 60];
const TERRAIN_OPTIONS = ["normal", "difficult", "blocked"];
const OBJECT_TYPES = ["door", "wall", "spawn", "objective", "trap", "chest", "hazard", "decor"];

export default function EncountersPage() {
  const [selected, setSelected] = useState({ q: 0, r: 0 });
  const [speed, setSpeed] = useState(30);
  const [maps, setMaps] = useState([]);
  const [mapId, setMapId] = useState("");
  const [overrides, setOverrides] = useState([]);
  const [objects, setObjects] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [newMapName, setNewMapName] = useState("New Encounter Board");
  const [terrainType, setTerrainType] = useState("normal");
  const [elevation, setElevation] = useState(0);
  const [hazardKey, setHazardKey] = useState("");
  const [objectType, setObjectType] = useState("door");
  const [blocksMovement, setBlocksMovement] = useState(true);
  const [blocksLos, setBlocksLos] = useState(true);

  const activeMap = useMemo(() => maps.find((row) => String(row.id) === String(mapId)) || null, [maps, mapId]);
  const selectedKey = hexKey(selected.q, selected.r);
  const selectedOverride = useMemo(() => overrides.find((row) => hexKey(row.q, row.r) === selectedKey) || null, [overrides, selectedKey]);
  const selectedObjects = useMemo(() => objects.filter((row) => hexKey(row.q, row.r) === selectedKey), [objects, selectedKey]);
  const distanceHexes = useMemo(() => hexDistance({ q: 0, r: 0 }, selected), [selected]);
  const reachable = distanceHexes <= feetToHexes(speed);

  const loadMaps = useCallback(async () => {
    const { data, error } = await supabase
      .from("encounter_maps")
      .select("id,name,description,hex_size,radius,image_bucket,image_path,is_active,metadata,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const rows = data || [];
    setMaps(rows);
    setMapId((current) => current && rows.some((row) => String(row.id) === String(current)) ? current : (rows[0]?.id || ""));
  }, []);

  const loadBoard = useCallback(async (nextMapId) => {
    if (!nextMapId) {
      setOverrides([]);
      setObjects([]);
      return;
    }
    const [terrainRes, objectRes] = await Promise.all([
      supabase.from("encounter_hex_overrides").select("map_id,q,r,terrain_type,movement_multiplier,elevation,hazard_key,metadata,updated_at").eq("map_id", nextMapId),
      supabase.from("encounter_map_objects").select("id,map_id,object_type,q,r,blocks_movement,blocks_los,cover_level,hidden_by_default,interaction_type,state,metadata,updated_at").eq("map_id", nextMapId).order("created_at"),
    ]);
    if (terrainRes.error) throw terrainRes.error;
    if (objectRes.error) throw objectRes.error;
    setOverrides(terrainRes.data || []);
    setObjects(objectRes.data || []);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id || null;
        if (uid) {
          const { data: adminValue } = await supabase.rpc("is_admin", { uid });
          if (active) setIsAdmin(Boolean(adminValue));
        }
        await loadMaps();
      } catch (error) {
        if (active) setMessage(error?.message || "Could not load encounter maps.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadMaps]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadBoard(mapId);
        if (active) setSelected({ q: 0, r: 0 });
      } catch (error) {
        if (active) setMessage(error?.message || "Could not load encounter board data.");
      }
    })();
    return () => { active = false; };
  }, [loadBoard, mapId]);

  useEffect(() => {
    setTerrainType(selectedOverride?.terrain_type || "normal");
    setElevation(Number(selectedOverride?.elevation || 0));
    setHazardKey(selectedOverride?.hazard_key || "");
  }, [selectedOverride]);

  async function createMap() {
    if (!isAdmin || saving) return;
    setSaving(true); setMessage("");
    try {
      const { data, error } = await supabase.rpc("admin_upsert_encounter_map_v1", {
        p_name: newMapName,
        p_description: "GM-authored tactical encounter board",
        p_hex_size: 38,
        p_radius: 6,
        p_is_active: true,
        p_metadata: { phase: "1B" },
      });
      if (error) throw error;
      await loadMaps();
      setMapId(data || "");
      setMessage("Encounter board created.");
    } catch (error) {
      setMessage(error?.message || "Could not create encounter board.");
    } finally { setSaving(false); }
  }

  async function saveHex() {
    if (!isAdmin || !mapId || saving) return;
    setSaving(true); setMessage("");
    try {
      const multiplier = terrainType === "difficult" ? 2 : 1;
      const { error } = await supabase.rpc("admin_set_encounter_hex_v1", {
        p_map_id: mapId,
        p_q: selected.q,
        p_r: selected.r,
        p_terrain_type: terrainType,
        p_movement_multiplier: multiplier,
        p_elevation: Number(elevation || 0),
        p_hazard_key: hazardKey || null,
        p_metadata: {},
      });
      if (error) throw error;
      await loadBoard(mapId);
      setMessage(`Saved hex ${selected.q}, ${selected.r}.`);
    } catch (error) {
      setMessage(error?.message || "Could not save terrain.");
    } finally { setSaving(false); }
  }

  async function addObject() {
    if (!isAdmin || !mapId || saving) return;
    setSaving(true); setMessage("");
    try {
      const { error } = await supabase.rpc("admin_upsert_encounter_map_object_v1", {
        p_map_id: mapId,
        p_object_type: objectType,
        p_q: selected.q,
        p_r: selected.r,
        p_blocks_movement: blocksMovement,
        p_blocks_los: blocksLos,
        p_cover_level: blocksLos ? "total" : "none",
        p_hidden_by_default: objectType === "trap",
        p_interaction_type: ["door", "chest", "objective"].includes(objectType) ? objectType : null,
        p_state: {},
        p_metadata: {},
      });
      if (error) throw error;
      await loadBoard(mapId);
      setMessage(`Added ${objectType} at ${selected.q}, ${selected.r}.`);
    } catch (error) {
      setMessage(error?.message || "Could not add map object.");
    } finally { setSaving(false); }
  }

  async function deleteObject(objectId) {
    if (!isAdmin || !objectId || saving) return;
    setSaving(true); setMessage("");
    try {
      const { error } = await supabase.rpc("admin_delete_encounter_map_object_v1", { p_object_id: objectId });
      if (error) throw error;
      await loadBoard(mapId);
      setMessage("Map object removed.");
    } catch (error) {
      setMessage(error?.message || "Could not remove map object.");
    } finally { setSaving(false); }
  }

  return (
    <main className="encounter-page">
      <div className="encounter-page__frame">
        <header className="encounter-page__header">
          <div>
            <div className="encounter-kicker">TACTICAL ENCOUNTER SYSTEM • PHASE 1B</div>
            <h1>Encounter Map Workshop</h1>
            <p>Persistent GM-authored hex boards. Map definitions are encounter-local and do not alter world/town routes, travel, weather, camps, clocks, or character world positions.</p>
          </div>
          <div className="encounter-phase-badge">{loading ? "Loading" : isAdmin ? "GM Editor" : "Viewer"}</div>
        </header>

        {message ? <div className="encounter-message">{message}</div> : null}

        <section className="encounter-page__layout">
          <aside className="encounter-sidebar">
            <div className="encounter-panel">
              <div className="encounter-panel__kicker">Board library</div>
              <h2>Encounter maps</h2>
              <select value={mapId} onChange={(event) => setMapId(event.target.value)}>
                <option value="">Prototype / no saved map</option>
                {maps.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
              {activeMap ? <div className="map-meta"><strong>{activeMap.name}</strong><span>Radius {activeMap.radius} • hex render {activeMap.hex_size}px</span><span>{activeMap.description || "No description"}</span></div> : null}
              {isAdmin ? <div className="create-row"><input value={newMapName} onChange={(event) => setNewMapName(event.target.value)} /><button type="button" onClick={createMap} disabled={saving}>Create</button></div> : null}
            </div>

            <div className="encounter-panel">
              <div className="encounter-panel__kicker">Movement preview</div>
              <h2>5e scale</h2>
              <label><span>Creature Speed</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{SPEED_OPTIONS.map((value) => <option key={value} value={value}>{value} ft.</option>)}</select></label>
              <div className="encounter-readout"><span>Turn budget</span><strong>{feetToHexes(speed)} hexes</strong></div>
              <div className="encounter-readout"><span>Selected</span><strong>{selected.q}, {selected.r}</strong></div>
              <div className="encounter-readout"><span>Direct distance</span><strong>{hexesToFeet(distanceHexes)} ft.</strong></div>
              <div className={`encounter-validity ${reachable ? "is-valid" : "is-invalid"}`}>{reachable ? "Within base Speed" : "Requires Dash / additional movement"}</div>
            </div>

            {isAdmin && mapId ? (
              <div className="encounter-panel editor-panel">
                <div className="encounter-panel__kicker">GM hex editor</div>
                <h2>Hex {selected.q}, {selected.r}</h2>
                <label><span>Terrain</span><select value={terrainType} onChange={(event) => setTerrainType(event.target.value)}>{TERRAIN_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label><span>Elevation</span><input type="number" value={elevation} onChange={(event) => setElevation(Number(event.target.value))} /></label>
                <label><span>Hazard key</span><input value={hazardKey} onChange={(event) => setHazardKey(event.target.value)} placeholder="optional" /></label>
                <button type="button" onClick={saveHex} disabled={saving}>Save terrain</button>
                <hr />
                <label><span>Add object</span><select value={objectType} onChange={(event) => setObjectType(event.target.value)}>{OBJECT_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label className="check"><input type="checkbox" checked={blocksMovement} onChange={(event) => setBlocksMovement(event.target.checked)} /> Blocks movement</label>
                <label className="check"><input type="checkbox" checked={blocksLos} onChange={(event) => setBlocksLos(event.target.checked)} /> Blocks LOS</label>
                <button type="button" onClick={addObject} disabled={saving}>Add object</button>
                {selectedObjects.length ? <div className="object-list">{selectedObjects.map((row) => <div key={row.id}><span><strong>{row.object_type}</strong><small>{row.blocks_movement ? "blocks movement" : "passable"}</small></span><button type="button" onClick={() => deleteObject(row.id)} disabled={saving}>×</button></div>)}</div> : null}
              </div>
            ) : null}
          </aside>

          <section className="encounter-board-panel">
            <div className="encounter-board-panel__head">
              <div><span>{activeMap ? "Saved encounter map" : "Prototype dungeon chamber"}</span><strong>{activeMap?.name || "Axial hex renderer"}</strong></div>
              <div><span>Scale</span><strong>1 hex = 5 ft.</strong></div>
            </div>
            <EncounterHexBoard
              selected={selected}
              onSelect={setSelected}
              moveSpeedFeet={speed}
              radius={activeMap?.radius || 5}
              hexSize={activeMap?.hex_size || 38}
              terrainOverrides={overrides}
              objects={objects}
              demoTerrain={!activeMap}
              showPrototypeTokens={!activeMap}
            />
          </section>
        </section>
      </div>

      <style jsx>{`
        .encounter-page{min-height:100vh;background:radial-gradient(circle at 70% 5%,rgba(80,61,101,.24),transparent 35%),linear-gradient(180deg,#080a0c,#111512 55%,#080a0b);color:#f3f0e8;padding:28px}.encounter-page__frame{max-width:1580px;margin:0 auto}.encounter-page__header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:14px;padding:20px 22px;border:1px solid rgba(190,151,89,.22);border-radius:14px;background:rgba(12,14,16,.86);box-shadow:0 18px 50px rgba(0,0,0,.32)}.encounter-page__header h1{font-size:2rem;margin:4px 0 5px}.encounter-page__header p{margin:0;max-width:940px;color:rgba(255,255,255,.62);line-height:1.55}.encounter-kicker,.encounter-panel__kicker{font-size:.66rem;letter-spacing:.12em;color:#c8aee5;font-weight:800}.encounter-phase-badge{border:1px solid rgba(143,222,195,.36);background:rgba(69,139,116,.13);color:#a8ead4;border-radius:999px;padding:7px 12px;font-size:.72rem;font-weight:700}.encounter-message{margin:0 0 14px;border:1px solid rgba(208,174,255,.22);background:rgba(94,57,125,.16);border-radius:9px;padding:9px 12px;font-size:.76rem}.encounter-page__layout{display:grid;grid-template-columns:315px minmax(0,1fr);gap:16px}.encounter-sidebar{display:grid;align-content:start;gap:12px}.encounter-panel,.encounter-board-panel{border:1px solid rgba(255,255,255,.09);background:rgba(13,16,17,.91);border-radius:13px;box-shadow:0 15px 40px rgba(0,0,0,.25)}.encounter-panel{padding:16px}.encounter-panel h2{font-size:1.02rem;margin:4px 0 13px}.encounter-panel label{display:grid;gap:5px;color:rgba(255,255,255,.62);font-size:.72rem;margin-top:9px}.encounter-panel select,.encounter-panel input{width:100%;background:#090c0e;border:1px solid rgba(255,255,255,.14);color:#eee;border-radius:8px;padding:8px}.encounter-panel button{border:1px solid rgba(208,174,255,.26);background:rgba(119,76,154,.2);color:#e9d8ff;border-radius:8px;padding:7px 10px;font-size:.72rem}.encounter-panel button:disabled{opacity:.45}.map-meta{display:grid;gap:3px;margin-top:10px;font-size:.72rem}.map-meta span{color:rgba(255,255,255,.55)}.create-row{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:10px}.encounter-readout{display:flex;justify-content:space-between;gap:12px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);font-size:.76rem}.encounter-readout span{color:rgba(255,255,255,.55)}.encounter-validity{margin-top:12px;border-radius:8px;padding:8px 10px;font-size:.72rem}.encounter-validity.is-valid{border:1px solid rgba(98,198,142,.28);background:rgba(58,130,88,.15);color:#aee9c5}.encounter-validity.is-invalid{border:1px solid rgba(221,145,91,.28);background:rgba(145,83,46,.14);color:#f3c29f}.editor-panel hr{border-color:rgba(255,255,255,.1);margin:14px 0}.editor-panel .check{display:flex;align-items:center;gap:7px}.editor-panel .check input{width:auto}.editor-panel>button{width:100%;margin-top:10px}.object-list{display:grid;gap:5px;margin-top:10px}.object-list>div{display:flex;justify-content:space-between;align-items:center;border:1px solid rgba(255,255,255,.08);border-radius:7px;padding:6px 7px}.object-list span{display:grid}.object-list small{color:rgba(255,255,255,.5)}.object-list button{padding:2px 8px}.encounter-board-panel{padding:14px;min-width:0}.encounter-board-panel__head{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:3px 4px 12px}.encounter-board-panel__head>div{display:grid}.encounter-board-panel__head span{font-size:.65rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.08em}.encounter-board-panel__head strong{font-size:.86rem;color:#e9dfc8}@media(max-width:980px){.encounter-page{padding:14px}.encounter-page__layout{grid-template-columns:1fr}.encounter-sidebar{grid-template-columns:repeat(2,minmax(0,1fr))}.editor-panel{grid-column:1/-1}}@media(max-width:650px){.encounter-page__header{display:grid}.encounter-sidebar{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}

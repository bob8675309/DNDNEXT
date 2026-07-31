import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../utils/supabaseClient";

const SMOKE_MAP_KEY = "milestone2-smoke-arena-v1";
const SMOKE_SESSION_KEY = "milestone2-smoke-session-v1";
const SMOKE_MAP_NAME = "Milestone 2 Smoke Arena";

const ACTORS = [
  { name: "Pip Quillspark", team: "allies", q: -3, r: -1, initiative: 18 },
  { name: "Raska Stonejaw", team: "enemies", q: 4, r: 0, initiative: 16 },
  { name: "Letho", team: "players", q: -4, r: 0, initiative: 14 },
  { name: "Aurelia Dawnmere", team: "allies", q: -3, r: 1, initiative: 12 },
];

const TERRAIN = [
  { q: -1, r: 0, terrainType: "difficult", multiplier: 2 },
  { q: 0, r: 1, terrainType: "difficult", multiplier: 2 },
  { q: 1, r: -1, terrainType: "difficult", multiplier: 2 },
];

const OBJECTS = [
  { key: "smoke-pillar", objectType: "wall", q: 0, r: 0, blocksMovement: true, blocksLos: true, coverLevel: "total" },
  { key: "smoke-low-wall", objectType: "wall", q: 1, r: 1, blocksMovement: true, blocksLos: false, coverLevel: "half" },
];

export default function EncounterSmokeSetupPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);

  const actorByName = useMemo(() => new Map(characters.map((row) => [row.name, row])), [characters]);
  const missingActors = useMemo(() => ACTORS.filter((actor) => !actorByName.has(actor.name)).map((actor) => actor.name), [actorByName]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: auth, error: authError }, characterRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("characters").select("id,name,race,role,kind").order("name"),
      ]);
      if (authError) throw authError;
      if (characterRes.error) throw characterRes.error;
      const uid = auth?.user?.id || null;
      let admin = false;
      if (uid) {
        const adminRes = await supabase.rpc("is_admin", { uid });
        if (adminRes.error) throw adminRes.error;
        admin = Boolean(adminRes.data);
      }
      setIsAdmin(admin);
      setCharacters(characterRes.data || []);
    } catch (error) {
      setMessage(error?.message || "Could not load smoke-test prerequisites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function ensureSmokeMap() {
    const existing = await supabase
      .from("encounter_maps")
      .select("id,name,metadata,is_active,updated_at")
      .contains("metadata", { fixtureKey: SMOKE_MAP_KEY })
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (existing.error) throw existing.error;
    if (existing.data?.[0]?.id) return existing.data[0].id;

    const created = await supabase.rpc("admin_upsert_encounter_map_v1", {
      p_map_id: null,
      p_name: SMOKE_MAP_NAME,
      p_description: "Reusable tactical-only arena for Milestone 2 campaign encounter smoke testing.",
      p_hex_size: 38,
      p_radius: 6,
      p_image_bucket: null,
      p_image_path: null,
      p_is_active: true,
      p_metadata: { fixtureKey: SMOKE_MAP_KEY, workflow: "milestone2-smoke", reusable: true },
    });
    if (created.error) throw created.error;
    return created.data;
  }

  async function ensureTerrain(mapId) {
    for (const hex of TERRAIN) {
      const res = await supabase.rpc("admin_set_encounter_hex_v1", {
        p_map_id: mapId,
        p_q: hex.q,
        p_r: hex.r,
        p_terrain_type: hex.terrainType,
        p_movement_multiplier: hex.multiplier,
        p_elevation: 0,
        p_hazard_key: null,
        p_metadata: { fixtureKey: SMOKE_MAP_KEY, purpose: "movement-smoke" },
      });
      if (res.error) throw res.error;
    }
  }

  async function ensureObjects(mapId) {
    const existing = await supabase
      .from("encounter_map_objects")
      .select("id,metadata")
      .eq("map_id", mapId);
    if (existing.error) throw existing.error;

    for (const object of OBJECTS) {
      const current = (existing.data || []).find((row) => row.metadata?.fixtureKey === object.key);
      const res = await supabase.rpc("admin_upsert_encounter_map_object_v1", {
        p_object_id: current?.id || null,
        p_map_id: mapId,
        p_object_type: object.objectType,
        p_q: object.q,
        p_r: object.r,
        p_blocks_movement: object.blocksMovement,
        p_blocks_los: object.blocksLos,
        p_cover_level: object.coverLevel,
        p_hidden_by_default: false,
        p_interaction_type: null,
        p_state: {},
        p_metadata: { fixtureKey: object.key, smokeMapKey: SMOKE_MAP_KEY },
      });
      if (res.error) throw res.error;
    }
  }

  async function ensureSmokeEncounter(mapId) {
    const existing = await supabase
      .from("encounters")
      .select("id,name,status,map_id,settings,updated_at")
      .contains("settings", { fixtureKey: SMOKE_SESSION_KEY })
      .in("status", ["draft", "ready", "initiative", "active", "paused"])
      .order("updated_at", { ascending: false })
      .limit(1);
    if (existing.error) throw existing.error;
    if (existing.data?.[0]?.id) return existing.data[0];

    const created = await supabase.rpc("admin_create_encounter_v1", {
      p_map_id: mapId,
      p_name: "Milestone 2 Durable Smoke Encounter",
      p_settings: { fixtureKey: SMOKE_SESSION_KEY, workflow: "milestone2-smoke", reusableMapKey: SMOKE_MAP_KEY },
    });
    if (created.error) throw created.error;
    return { id: created.data, status: "draft", map_id: mapId };
  }

  async function ensureParticipants(encounterId) {
    const existingRes = await supabase
      .from("encounter_participants")
      .select("id,character_id,controller_user_id,initiative_tiebreaker,is_hidden,state")
      .eq("encounter_id", encounterId);
    if (existingRes.error) throw existingRes.error;
    const existingByCharacter = new Map((existingRes.data || []).map((row) => [String(row.character_id || ""), row]));

    for (const actor of ACTORS) {
      const character = actorByName.get(actor.name);
      if (!character) throw new Error(`Required smoke actor is missing: ${actor.name}`);
      let participant = existingByCharacter.get(String(character.id));

      if (!participant) {
        const added = await supabase.rpc("admin_add_encounter_participant_v1", {
          p_encounter_id: encounterId,
          p_character_id: character.id,
          p_team: actor.team,
          p_q: actor.q,
          p_r: actor.r,
          p_controller_user_id: null,
          p_state: { fixtureKey: SMOKE_SESSION_KEY, stagedFrom: "milestone2-smoke-setup" },
        });
        if (added.error) throw added.error;
        participant = {
          id: added.data,
          character_id: character.id,
          controller_user_id: null,
          initiative_tiebreaker: null,
          is_hidden: false,
          state: { fixtureKey: SMOKE_SESSION_KEY, stagedFrom: "milestone2-smoke-setup" },
        };
      }

      const updated = await supabase.rpc("admin_update_encounter_participant_staging_v1", {
        p_participant_id: participant.id,
        p_q: actor.q,
        p_r: actor.r,
        p_team: actor.team,
        p_controller_user_id: participant.controller_user_id || null,
        p_initiative: actor.initiative,
        p_initiative_tiebreaker: participant.initiative_tiebreaker,
        p_is_hidden: Boolean(participant.is_hidden),
        p_state: participant.state || { fixtureKey: SMOKE_SESSION_KEY },
      });
      if (updated.error) throw updated.error;
    }
  }

  async function prepareSmokeEncounter() {
    if (!isAdmin || saving || missingActors.length) return;
    setSaving(true);
    setMessage("");
    setResult(null);
    try {
      const mapId = await ensureSmokeMap();
      const encounter = await ensureSmokeEncounter(mapId);

      if (["active", "paused"].includes(encounter.status)) {
        setResult({ mapId, encounterId: encounter.id });
        setMessage(`Existing smoke encounter is ${encounter.status}. Reusing it without restaging participants or resetting initiative.`);
        return;
      }

      await ensureTerrain(mapId);
      await ensureObjects(mapId);
      await ensureParticipants(encounter.id);
      const initiative = await supabase.rpc("admin_set_encounter_status_v1", { p_encounter_id: encounter.id, p_status: "initiative" });
      if (initiative.error) throw initiative.error;
      setResult({ mapId, encounterId: encounter.id });
      setMessage("Smoke encounter is staged and ready for GM review. It has not been started.");
    } catch (error) {
      setMessage(error?.message || "Smoke encounter setup failed. Rerun is safe and will reuse partial setup where possible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="smoke-page">
      <section className="card">
        <div className="kicker">TACTICAL ENCOUNTER • MILESTONE 2</div>
        <h1>Durable Smoke Setup</h1>
        <p>This GM-only helper prepares a reusable tactical arena and a staged smoke encounter through the existing guarded RPCs. It does not start combat or modify world/town state.</p>

        <div className="status-grid">
          <div><span>Access</span><strong>{loading ? "Checking…" : isAdmin ? "GM / Admin" : "Admin required"}</strong></div>
          <div><span>Canonical actors</span><strong>{missingActors.length ? `${ACTORS.length - missingActors.length}/${ACTORS.length} ready` : `${ACTORS.length}/${ACTORS.length} ready`}</strong></div>
          <div><span>Map</span><strong>{SMOKE_MAP_NAME}</strong></div>
          <div><span>Start state</span><strong>Initiative staging only</strong></div>
        </div>

        <div className="actors">
          {ACTORS.map((actor) => <div key={actor.name}><strong>{actor.name}</strong><span>{actor.team} • init {actor.initiative} • {actor.q},{actor.r}</span><em>{actorByName.has(actor.name) ? "ready" : "missing"}</em></div>)}
        </div>

        {missingActors.length ? <div className="warning">Missing required actors: {missingActors.join(", ")}</div> : null}
        {message ? <div className="message">{message}</div> : null}

        <button onClick={prepareSmokeEncounter} disabled={loading || saving || !isAdmin || missingActors.length > 0}>
          {saving ? "Preparing smoke encounter…" : "Prepare / repair smoke encounter"}
        </button>

        {result ? <div className="result"><span>Map {result.mapId}</span><span>Encounter {result.encounterId}</span></div> : null}

        <nav>
          <Link href="/encounters/live">Open staging</Link>
          <Link href="/encounters/play">Turn Play</Link>
          <Link href="/encounters/combat">Combat</Link>
          <Link href="/encounters">Map Workshop</Link>
        </nav>
      </section>

      <style jsx>{`
        .smoke-page{min-height:100vh;padding:34px;background:radial-gradient(circle at 78% 8%,rgba(95,66,130,.22),transparent 34%),linear-gradient(#07090b,#111411);color:#f1eee7;display:grid;place-items:start center}.card{width:min(860px,100%);padding:24px;border:1px solid rgba(208,174,255,.2);border-radius:15px;background:rgba(12,15,17,.94);box-shadow:0 18px 60px rgba(0,0,0,.34)}.kicker{font-size:.68rem;letter-spacing:.13em;color:#c9afe7;font-weight:850}.card h1{margin:5px 0 8px}.card>p{margin:0 0 18px;color:rgba(255,255,255,.62);line-height:1.55}.status-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.status-grid>div,.actors>div{padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(255,255,255,.025)}.status-grid span,.actors span{display:block;color:rgba(255,255,255,.5);font-size:.72rem}.status-grid strong{display:block;margin-top:3px}.actors{display:grid;gap:7px;margin:16px 0}.actors>div{display:grid;grid-template-columns:1fr 1fr auto;align-items:center;gap:10px}.actors em{font-style:normal;font-size:.7rem;color:#b9dda7}.warning,.message{margin:10px 0;padding:10px;border-radius:8px;font-size:.78rem}.warning{border:1px solid rgba(238,154,104,.3);background:rgba(154,83,45,.14);color:#ffd1ac}.message{border:1px solid rgba(202,165,239,.26);background:rgba(105,70,140,.15);color:#eadcf8}.card>button{width:100%;margin-top:6px;padding:11px;border:1px solid rgba(202,165,239,.36);border-radius:9px;background:rgba(112,73,151,.27);color:#f5ebff;font-weight:800}.card>button:disabled{opacity:.45}.result{display:grid;gap:3px;margin-top:12px;font-size:.72rem;color:rgba(255,255,255,.58);word-break:break-all}nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}nav a{padding:8px 10px;border:1px solid rgba(255,255,255,.12);border-radius:999px;color:#dac9ef;font-size:.75rem}@media(max-width:700px){.status-grid{grid-template-columns:1fr}.actors>div{grid-template-columns:1fr}.actors em{justify-self:start}}
      `}</style>
    </main>
  );
}

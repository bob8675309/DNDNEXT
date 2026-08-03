import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../utils/supabaseClient";

const MAP_FIXTURE_KEY = "milestone2-smoke-arena-v1";
const SESSION_FIXTURE_KEY = "milestone2-multiplayer-smoke-v1";
const SESSION_NAME = "Milestone 2 Multi-User Smoke Encounter";

const ACTORS = [
  { name: "Leso Varen", team: "players", q: -3, r: -1, initiative: 18, controller: "player" },
  { name: "Dawn Whiteflame", team: "enemies", q: 4, r: 0, initiative: 16, controller: "admin" },
  { name: "Varges", team: "players", q: -3, r: 1, initiative: 14, controller: "player" },
];

const NONTERMINAL_STATUSES = ["draft", "ready", "initiative", "active", "paused"];

function safeText(value) {
  return String(value ?? "").trim();
}

function actorKey(value) {
  return safeText(value).toLowerCase();
}

export default function MultiplayerSmokeSetupPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [mapRow, setMapRow] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [conflicts, setConflicts] = useState([]);

  const characterByName = useMemo(
    () => new Map(characters.map((row) => [actorKey(row.name), row])),
    [characters]
  );
  const adminProfile = useMemo(
    () => profiles.find((row) => safeText(row.role).toLowerCase() === "admin") || null,
    [profiles]
  );
  const controllerByCharacterId = useMemo(() => {
    const next = new Map();
    for (const permission of permissions) {
      if (!permission?.character_id || !permission?.user_id) continue;
      if (!next.has(String(permission.character_id)) || permission.can_edit) {
        next.set(String(permission.character_id), String(permission.user_id));
      }
    }
    return next;
  }, [permissions]);

  const assignments = useMemo(() => ACTORS.map((actor) => {
    const character = characterByName.get(actorKey(actor.name)) || null;
    const controllerUserId = actor.controller === "admin"
      ? adminProfile?.id || null
      : controllerByCharacterId.get(String(character?.id || "")) || null;
    return { ...actor, character, controllerUserId };
  }), [adminProfile?.id, characterByName, controllerByCharacterId]);

  const missingRequirements = useMemo(() => {
    const missing = [];
    if (!mapRow?.id) missing.push("reusable smoke arena");
    if (!adminProfile?.id) missing.push("admin profile");
    for (const assignment of assignments) {
      if (!assignment.character?.id) missing.push(`character ${assignment.name}`);
      else if (!assignment.controllerUserId) missing.push(`controller for ${assignment.name}`);
    }
    return [...new Set(missing)];
  }, [adminProfile?.id, assignments, mapRow?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const authResult = await supabase.auth.getUser();
      if (authResult.error) throw authResult.error;
      const uid = authResult.data?.user?.id || null;
      let admin = false;
      if (uid) {
        const adminResult = await supabase.rpc("is_admin", { uid });
        if (adminResult.error) throw adminResult.error;
        admin = Boolean(adminResult.data);
      }
      setIsAdmin(admin);
      if (!admin) {
        setMapRow(null);
        setEncounter(null);
        setCharacters([]);
        setProfiles([]);
        setPermissions([]);
        setParticipants([]);
        setConflicts([]);
        return;
      }

      const [characterResult, profileResult, permissionResult, mapResult, encounterResult] = await Promise.all([
        supabase.from("characters").select("id,name,kind,role").in("name", ACTORS.map((actor) => actor.name)).order("name"),
        supabase.from("user_profiles").select("id,role"),
        supabase.from("character_permissions").select("character_id,user_id,can_edit,can_inventory"),
        supabase.from("encounter_maps")
          .select("id,name,radius,is_active,metadata,updated_at")
          .contains("metadata", { fixtureKey: MAP_FIXTURE_KEY })
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1),
        supabase.from("encounters")
          .select("id,name,status,version,map_id,active_participant_id,gm_user_id,settings,updated_at")
          .contains("settings", { fixtureKey: SESSION_FIXTURE_KEY })
          .in("status", NONTERMINAL_STATUSES)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);
      for (const result of [characterResult, profileResult, permissionResult, mapResult, encounterResult]) {
        if (result.error) throw result.error;
      }

      const nextCharacters = characterResult.data || [];
      const nextEncounter = encounterResult.data?.[0] || null;
      setCharacters(nextCharacters);
      setProfiles(profileResult.data || []);
      setPermissions(permissionResult.data || []);
      setMapRow(mapResult.data?.[0] || null);
      setEncounter(nextEncounter);

      let nextParticipants = [];
      if (nextEncounter?.id) {
        const participantResult = await supabase
          .from("encounter_participants")
          .select("id,encounter_id,character_id,display_name,team,controller_user_id,q,r,initiative,is_hidden,state")
          .eq("encounter_id", nextEncounter.id)
          .order("initiative", { ascending: false });
        if (participantResult.error) throw participantResult.error;
        nextParticipants = participantResult.data || [];
      }
      setParticipants(nextParticipants);

      const actorIds = nextCharacters.map((row) => row.id).filter(Boolean);
      let nextConflicts = [];
      if (actorIds.length) {
        const activeEncounterResult = await supabase
          .from("encounters")
          .select("id,name,status")
          .eq("status", "active");
        if (activeEncounterResult.error) throw activeEncounterResult.error;
        const otherActive = (activeEncounterResult.data || []).filter((row) => String(row.id) !== String(nextEncounter?.id || ""));
        if (otherActive.length) {
          const activeById = new Map(otherActive.map((row) => [String(row.id), row]));
          const conflictResult = await supabase
            .from("encounter_participants")
            .select("encounter_id,character_id,display_name")
            .in("encounter_id", otherActive.map((row) => row.id))
            .in("character_id", actorIds);
          if (conflictResult.error) throw conflictResult.error;
          nextConflicts = (conflictResult.data || []).map((row) => ({
            ...row,
            encounterName: activeById.get(String(row.encounter_id))?.name || "Active encounter",
          }));
        }
      }
      setConflicts(nextConflicts);
    } catch (error) {
      setMessage(error?.message || "Could not load multi-user smoke-test prerequisites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function prepareEncounter() {
    if (!isAdmin || saving || missingRequirements.length || conflicts.length) return;
    setSaving(true);
    setMessage("");
    try {
      let encounterId = encounter?.id || null;
      let encounterStatus = encounter?.status || "draft";
      if (!encounterId) {
        const created = await supabase.rpc("admin_create_encounter_v1", {
          p_map_id: mapRow.id,
          p_name: SESSION_NAME,
          p_settings: {
            fixtureKey: SESSION_FIXTURE_KEY,
            workflow: "milestone2-multiplayer-smoke",
            reusableMapKey: MAP_FIXTURE_KEY,
            purpose: "three-account ownership and realtime acceptance",
          },
        });
        if (created.error) throw created.error;
        encounterId = created.data;
        encounterStatus = "draft";
      }

      if (["active", "paused"].includes(encounterStatus)) {
        setMessage(`The multi-user smoke encounter is already ${encounterStatus}; staging was not rewritten.`);
        await load();
        return;
      }

      const existingResult = await supabase
        .from("encounter_participants")
        .select("id,character_id,initiative_tiebreaker,is_hidden,state")
        .eq("encounter_id", encounterId);
      if (existingResult.error) throw existingResult.error;
      const existingByCharacter = new Map((existingResult.data || []).map((row) => [String(row.character_id), row]));

      for (const assignment of assignments) {
        let participant = existingByCharacter.get(String(assignment.character.id));
        if (!participant) {
          const added = await supabase.rpc("admin_add_encounter_participant_v1", {
            p_encounter_id: encounterId,
            p_character_id: assignment.character.id,
            p_team: assignment.team,
            p_q: assignment.q,
            p_r: assignment.r,
            p_controller_user_id: assignment.controllerUserId,
            p_state: {
              fixtureKey: SESSION_FIXTURE_KEY,
              controllerRole: assignment.controller,
              stagedFrom: "multiplayer-smoke-setup",
            },
          });
          if (added.error) throw added.error;
          participant = {
            id: added.data,
            character_id: assignment.character.id,
            initiative_tiebreaker: null,
            is_hidden: false,
            state: {},
          };
        }

        const updated = await supabase.rpc("admin_update_encounter_participant_staging_v1", {
          p_participant_id: participant.id,
          p_q: assignment.q,
          p_r: assignment.r,
          p_team: assignment.team,
          p_controller_user_id: assignment.controllerUserId,
          p_initiative: assignment.initiative,
          p_initiative_tiebreaker: participant.initiative_tiebreaker,
          p_is_hidden: Boolean(participant.is_hidden),
          p_state: {
            ...(participant.state || {}),
            fixtureKey: SESSION_FIXTURE_KEY,
            controllerRole: assignment.controller,
            stagedFrom: "multiplayer-smoke-setup",
          },
        });
        if (updated.error) throw updated.error;
      }

      const initiative = await supabase.rpc("admin_set_encounter_status_v1", {
        p_encounter_id: encounterId,
        p_status: "initiative",
      });
      if (initiative.error) throw initiative.error;
      setMessage("Multi-user smoke encounter is staged in initiative order. It has not been started.");
      await load();
    } catch (error) {
      setMessage(error?.message || "Could not prepare the multi-user smoke encounter.");
    } finally {
      setSaving(false);
    }
  }

  async function startEncounter() {
    if (!isAdmin || saving || !encounter?.id || encounter.status !== "initiative" || conflicts.length) return;
    const confirmed = window.confirm(
      "Start the staged three-account smoke encounter now? Open the GM, Player A, and Player B sessions before beginning the turn-sync test."
    );
    if (!confirmed) return;
    setSaving(true);
    setMessage("");
    try {
      const started = await supabase.rpc("admin_start_encounter_v1", { p_encounter_id: encounter.id });
      if (started.error) throw started.error;
      setMessage(`Encounter started. ${started.data?.activeParticipantName || "The initiative leader"} has the first turn.`);
      await load();
    } catch (error) {
      setMessage(error?.message || "Could not start the multi-user smoke encounter.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="multi-smoke-page">
      <section className="setup-card">
        <div className="kicker">TACTICAL ENCOUNTER • MILESTONE 2</div>
        <h1>Three-Account Smoke Setup</h1>
        <p>
          This admin-only surface prepares a fresh encounter on the reusable smoke arena using three canonical characters that do not overlap the preserved Round 6 encounter. Preparation and combat start are separate guarded commands.
        </p>

        <div className="status-grid">
          <div><span>Access</span><strong>{loading ? "Checking…" : isAdmin ? "GM / Admin" : "Admin required"}</strong></div>
          <div><span>Arena</span><strong>{mapRow?.name || "Missing reusable smoke arena"}</strong></div>
          <div><span>Encounter</span><strong>{encounter?.status || "Not prepared"}</strong></div>
          <div><span>Version</span><strong>{encounter?.version ?? "—"}</strong></div>
        </div>

        <div className="assignments">
          {assignments.map((assignment) => {
            const participant = participants.find((row) => String(row.character_id) === String(assignment.character?.id || ""));
            const ready = Boolean(assignment.character?.id && assignment.controllerUserId);
            return <div key={assignment.name}>
              <div>
                <strong>{assignment.name}</strong>
                <span>{assignment.controller === "admin" ? "GM-controlled enemy" : "Player-controlled character"}</span>
              </div>
              <span>Initiative {assignment.initiative} • hex {assignment.q},{assignment.r}</span>
              <em className={ready ? "ready" : "missing"}>{participant ? "staged" : ready ? "ready" : "missing"}</em>
            </div>;
          })}
        </div>

        {missingRequirements.length ? <div className="warning">Missing prerequisites: {missingRequirements.join(", ")}.</div> : null}
        {conflicts.length ? <div className="warning">
          Active-encounter conflict: {conflicts.map((row) => `${row.display_name} in ${row.encounterName}`).join("; ")}. This session cannot start until the conflict is resolved.
        </div> : null}
        {message ? <div className="message" role="status">{message}</div> : null}

        <div className="actions">
          <button type="button" onClick={prepareEncounter} disabled={loading || saving || !isAdmin || missingRequirements.length > 0 || conflicts.length > 0 || ["active", "paused"].includes(encounter?.status)}>
            {saving ? "Working…" : encounter ? "Repair staged assignments" : "Prepare fresh multi-user encounter"}
          </button>
          <button type="button" className="start" onClick={startEncounter} disabled={loading || saving || !isAdmin || encounter?.status !== "initiative" || conflicts.length > 0}>
            Start Encounter
          </button>
        </div>

        <nav>
          <Link href="/encounters/live">GM Staging</Link>
          <Link href="/encounters/play">Turn Movement</Link>
          <Link href="/encounters/combat">Battle Board</Link>
          <Link href="/encounters">Map Workshop</Link>
        </nav>
      </section>

      <style jsx>{`
        .multi-smoke-page{min-height:100vh;padding:34px;background:radial-gradient(circle at 82% 8%,rgba(91,62,132,.25),transparent 35%),linear-gradient(#08090d,#11141a);color:#f3eff8;display:grid;place-items:start center}.setup-card{width:min(900px,100%);padding:24px;border:1px solid rgba(202,174,255,.22);border-radius:16px;background:rgba(13,14,21,.96);box-shadow:0 20px 65px rgba(0,0,0,.38)}.kicker{font-size:.68rem;letter-spacing:.13em;color:#cbb3ec;font-weight:850}.setup-card h1{margin:5px 0 8px}.setup-card>p{margin:0 0 18px;color:rgba(255,255,255,.64);line-height:1.55}.status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.status-grid>div,.assignments>div{padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(255,255,255,.028)}.status-grid span,.assignments span{display:block;color:rgba(255,255,255,.54);font-size:.72rem}.status-grid strong{display:block;margin-top:3px}.assignments{display:grid;gap:8px;margin:16px 0}.assignments>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(10rem,.7fr) auto;align-items:center;gap:12px}.assignments strong{display:block}.assignments em{font-style:normal;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.ready{color:#bce8b1}.missing{color:#ffc3a3}.warning,.message{margin:10px 0;padding:10px;border-radius:8px;font-size:.78rem}.warning{border:1px solid rgba(238,154,104,.32);background:rgba(154,83,45,.15);color:#ffd1ac}.message{border:1px solid rgba(202,165,239,.28);background:rgba(105,70,140,.16);color:#eadcf8}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.actions button{padding:11px;border:1px solid rgba(202,165,239,.38);border-radius:9px;background:rgba(112,73,151,.29);color:#f5ebff;font-weight:800}.actions .start{border-color:rgba(139,224,157,.42);background:rgba(58,128,75,.3)}.actions button:disabled{opacity:.42;cursor:not-allowed}nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}nav a{padding:8px 10px;border:1px solid rgba(255,255,255,.13);border-radius:999px;color:#dac9ef;font-size:.75rem}@media(max-width:780px){.status-grid{grid-template-columns:1fr 1fr}.assignments>div{grid-template-columns:1fr}.actions{grid-template-columns:1fr}}@media(max-width:520px){.status-grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}

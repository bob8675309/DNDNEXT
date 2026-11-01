import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

/**
 * Research candidate, gated by verified admin UI AND a server-authorized RPC.
 * This component never directly writes character_permissions or combat rows.
 * The candidate SQL must be staged and approved before this goes into main.
 */
export default function NpcControlPermissionsPanel({ characterId, isAdmin = false }) {
  const [people, setPeople] = useState([]);
  const [grants, setGrants] = useState([]);
  const [directControllers, setDirectControllers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyUser, setBusyUser] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPeople([]);
      setGrants([]);
      setDirectControllers([]);
      setLoading(true);
      setError("");
      setBusyUser("");
      if (!isAdmin || !characterId) {
        setLoading(false);
        return;
      }
      try {
        const [profiles, players, permissions, assigned] = await Promise.all([
          supabase.from("user_profiles").select("id,role"),
          supabase.from("players").select("user_id,name"),
          supabase.from("character_permissions")
            .select("user_id,can_control,can_edit")
            .eq("character_id", characterId),
          supabase.from("encounter_participants")
            .select("controller_user_id")
            .eq("character_id", characterId),
        ]);
        const failure = [profiles, players, permissions, assigned].find(result => result.error);
        if (failure?.error) throw failure.error;
        if (cancelled) return;
        const names = new Map();
        for (const row of players.data || []) {
          if (row.user_id && row.name && !names.has(String(row.user_id)))
            names.set(String(row.user_id), String(row.name));
        }
        setPeople((profiles.data || [])
          .filter(row => String(row.role || "player").toLowerCase() === "player" && row.id)
          .map(row => ({
            id: String(row.id),
            name: names.get(String(row.id)) || "Player " + String(row.id).slice(0, 8),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)));
        setGrants(permissions.data || []);
        setDirectControllers((assigned.data || []).map(row => row.controller_user_id).filter(Boolean).map(String));
      } catch (e) {
        if (!cancelled) setError(e?.message || "Could not load NPC control assignments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [characterId, isAdmin]);

  const grantByUser = useMemo(() =>
    new Map(grants.map(row => [String(row.user_id), row])),
    [grants]
  );
  const directlyAssigned = useMemo(() => new Set(directControllers), [directControllers]);

  const setControl = async (userId, checked) => {
    if (!isAdmin || !characterId || busyUser || loading) return;
    setBusyUser(userId);
    setError("");
    // Deliberately avoid an optimistic authorization display: the RPC must
    // confirm the new value. Existing can_edit/direct assignment is unchanged.
    const { data, error: saveError } = await supabase.rpc("admin_set_npc_control_v1", {
      p_character_id: characterId,
      p_user_id: userId,
      p_can_control: checked,
    });
    if (saveError) {
      setError(saveError.message || "Control permission was not saved.");
    } else if (data?.userId === userId && data?.characterId === characterId) {
      setGrants(previous => {
        const next = previous.filter(row => String(row.user_id) !== userId);
        next.push({
          user_id: userId,
          can_control: Boolean(data.canControl),
          can_edit: Boolean(data.canEdit),
        });
        return next;
      });
    } else {
      setError("The server returned an unexpected permission record. Refresh before making changes.");
    }
    setBusyUser("");
  };

  if (!isAdmin || !characterId) return null;
  return (
    <section className="card bg-dark text-light border-secondary mb-3" aria-label="NPC player control permissions">
      <div className="card-body">
        <h3 className="h6 mb-2">NPC &amp; Companion Control</h3>
        <p className="small text-secondary mb-3">
          Allow players to take this NPC&apos;s turns or reactions in encounters.
          This does not give access to edit the character sheet, manage inventory, or reveal GM notes.
          More than one player may be assigned.
        </p>
        {error ? (
          <div className="alert alert-warning py-2 small" role="alert">{error}</div>
        ) : null}
        {loading ? <p className="small text-secondary mb-0">Loading player assignments…</p> : null}
        {!loading && !error && people.length === 0 ? (
          <p className="small text-secondary mb-0">No player accounts are available for assignment.</p>
        ) : null}
        {!loading && people.map(player => {
          const grant = grantByUser.get(player.id);
          const granted = Boolean(grant?.can_control);
          const legacyEdit = Boolean(grant?.can_edit);
          const direct = directlyAssigned.has(player.id);
          const busy = busyUser === player.id;
          return (
            <div key={player.id} className="d-flex justify-content-between align-items-center gap-2 py-2 border-top border-secondary">
              <div className="small">
                <div className="fw-semibold">{player.name}</div>
                {legacyEdit || direct ? (
                  <div className="text-warning">
                    {legacyEdit ? "Sheet editing also permits control. " : ""}
                    {direct ? "An encounter has a direct controller assignment." : ""}
                  </div>
                ) : null}
              </div>
              <label className="form-check form-switch mb-0 flex-shrink-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  aria-label={"Allow " + player.name + " to control this NPC"}
                  checked={granted}
                  disabled={Boolean(busyUser) || loading}
                  onChange={event => { void setControl(player.id, event.target.checked); }}
                />
                <span className="form-check-label small">{busy ? "Saving…" : granted ? "Granted" : "Off"}</span>
              </label>
            </div>
          );
        })}
        <p className="small text-secondary mt-2 mb-0">
          Turning this switch off revokes this delegated grant only. Existing sheet-edit rights
          and direct encounter-controller assignments remain effective until changed separately.
        </p>
      </div>
    </section>
  );
}

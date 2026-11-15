import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";

const LEGACY_RIGHTS = [
  { key: "can_edit", label: "Edit sheet", help: "Legacy editing authority; some existing combat RPCs also recognize editors." },
  { key: "can_inventory", label: "Manage inventory", help: "Legacy item, equipment and inventory operations." },
  { key: "can_convert", label: "Convert kind", help: "Legacy character/NPC/merchant conversion authority." },
];
const EMPTY_FLAGS = Object.freeze({ can_edit: false, can_inventory: false, can_convert: false });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function flagsFrom(row) {
  return {
    can_edit: Boolean(row?.can_edit),
    can_inventory: Boolean(row?.can_inventory),
    can_convert: Boolean(row?.can_convert),
  };
}

function sameFlags(a, b) {
  return LEGACY_RIGHTS.every(({ key }) => Boolean(a?.[key]) === Boolean(b?.[key]));
}

function accountLabel(account) {
  const shortId = String(account?.id || "").slice(0, 8);
  const name = String(account?.name || "").trim();
  return name ? `${name} (${shortId}…)` : `Account ${shortId}…`;
}

/**
 * Admin-only editor for EXISTING character_permissions flags.
 * This is deliberately not a delegated combat-control or GM-secret editor.
 * Server-side character_permissions RLS is the actual authority.
 */
export default function AdminCharacterPermissionsPanel({
  characterId = null,
  isAdmin = false,
  players = [],
}) {
  const [grants, setGrants] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [newFlags, setNewFlags] = useState({ ...EMPTY_FLAGS });
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setGrants([]);
    setDrafts({});
    setSelectedAccount("");
    setNewFlags({ ...EMPTY_FLAGS });
    // Keep an explicit conflict/success message visible after refreshing data.
    // A different selected character remounts this panel with clean state.
    setLoading(true);

    if (!isAdmin || !characterId) {
      setLoading(false);
      return () => { active = false; };
    }

    (async () => {
      const [existing, accounts] = await Promise.all([
        supabase.from("character_permissions")
          .select("character_id,user_id,can_edit,can_inventory,can_convert,created_at")
          .eq("character_id", characterId)
          .order("created_at", { ascending: true }),
        supabase.from("user_profiles").select("id,role"),
      ]);
      if (!active) return;
      if (existing.error) {
        setError(existing.error.message || "Could not read character permissions.");
        setLoading(false);
        return;
      }
      if (accounts.error) {
        // Existing grants remain readable even if the account directory is
        // unavailable; do not allow picking unknown users for new grants.
        setError(accounts.error.message || "Could not read account directory.");
      }
      const normalized = Array.isArray(existing.data) ? existing.data : [];
      setGrants(normalized);
      setDrafts(Object.fromEntries(normalized.map((row) => [String(row.user_id), flagsFrom(row)])));
      setProfiles(accounts.error ? [] : (accounts.data || []));
      setLoading(false);
    })().catch((err) => {
      if (!active) return;
      setError(err?.message || "Could not load character permissions.");
      setLoading(false);
    });

    return () => { active = false; };
  }, [characterId, isAdmin, refreshToken]);

  const accounts = useMemo(() => {
    const byId = new Map();
    for (const entry of profiles || []) {
      const id = String(entry?.id || "");
      if (UUID_PATTERN.test(id)) byId.set(id, { id, role: String(entry.role || "") });
    }
    for (const entry of players || []) {
      const id = String(entry?.user_id || "");
      if (!UUID_PATTERN.test(id)) continue;
      const previous = byId.get(id) || { id, role: "" };
      byId.set(id, { ...previous, name: String(entry.name || "") });
    }
    for (const entry of grants || []) {
      const id = String(entry?.user_id || "");
      if (UUID_PATTERN.test(id) && !byId.has(id)) byId.set(id, { id, role: "" });
    }
    return [...byId.values()].sort((a, b) => accountLabel(a).localeCompare(accountLabel(b)));
  }, [grants, players, profiles]);

  const labels = useMemo(() => new Map(accounts.map((entry) => [entry.id, accountLabel(entry)])), [accounts]);
  const grantedIds = useMemo(() => new Set(grants.map((row) => String(row.user_id))), [grants]);
  const candidates = useMemo(() => accounts.filter((entry) =>
    !grantedIds.has(entry.id) && entry.role !== "admin"
  ), [accounts, grantedIds]);

  const saveGrant = async (userId, nextFlags, existing = null) => {
    if (!isAdmin || !characterId || savingUserId !== null || !UUID_PATTERN.test(String(userId || ""))) return;
    const flags = flagsFrom(nextFlags);
    if (!existing && !LEGACY_RIGHTS.some(({ key }) => flags[key])) {
      setError("Choose at least one permission before adding an account.");
      return;
    }
    if (existing && !LEGACY_RIGHTS.some(({ key }) => flags[key]) &&
      !window.confirm("Disable every legacy permission for this account on this character? The player may lose access to its sheet and inventory.")) {
      return;
    }

    setSavingUserId(String(userId));
    setError("");
    setNotice("");
    try {
      let request;
      if (existing) {
        // Optimistic concurrency: changing another Admin's committed flags
        // makes this targeted UPDATE match zero rows rather than overwriting it.
        request = supabase.from("character_permissions")
          .update(flags)
          .eq("character_id", characterId)
          .eq("user_id", userId)
          .eq("can_edit", Boolean(existing.can_edit))
          .eq("can_inventory", Boolean(existing.can_inventory))
          .eq("can_convert", Boolean(existing.can_convert));
      } else {
        // INSERT only; duplicate/parallel grants fail rather than clobber.
        request = supabase.from("character_permissions")
          .insert({ character_id: characterId, user_id: userId, ...flags });
      }
      const result = await request
        .select("character_id,user_id,can_edit,can_inventory,can_convert,created_at")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        setError("Permissions changed in another session. Refresh before saving.");
        setRefreshToken((value) => value + 1);
        return;
      }
      setNotice(`Saved legacy permissions for ${labels.get(String(userId)) || "account"}.`);
      if (!existing) {
        setSelectedAccount("");
        setNewFlags({ ...EMPTY_FLAGS });
      }
      setRefreshToken((value) => value + 1);
    } catch (err) {
      setError(err?.message || "Could not save legacy permissions.");
    } finally {
      setSavingUserId(null);
    }
  };

  if (!isAdmin || !characterId) return null;

  return (
    <details className="card border-secondary bg-transparent mb-3">
      <summary className="card-header py-2" style={{ cursor: "pointer" }}>
        <strong>GM access management</strong>
        <span className="small ms-2 text-secondary">Existing permissions</span>
      </summary>
      <div className="card-body">
        <p className="small text-muted">
          These are the existing database permissions. Combat assignments, temporary NPC control,
          progression authority, and private GM notes are managed separately; no new combat-control
          permission is installed. Editing rights can still grant additional authority through
          legacy RPCs until the coordinated permissions upgrade.
        </p>
        {error ? <div className="alert alert-danger py-2" role="alert">{error}</div> : null}
        {notice ? <div className="alert alert-success py-2" role="status">{notice}</div> : null}
        {loading ? <div className="text-muted small py-2">Loading character permissions…</div> : (
          <div className="table-responsive">
            <table className="table table-dark table-sm table-hover align-middle">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  {LEGACY_RIGHTS.map(({ key, label, help }) =>
                    <th key={key} scope="col" title={help}>{label}</th>
                  )}
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((grant) => {
                  const id = String(grant.user_id);
                  const draft = drafts[id] || flagsFrom(grant);
                  const dirty = !sameFlags(grant, draft);
                  return (
                    <tr key={id}>
                      <th scope="row" className="fw-normal">{labels.get(id) || `Account ${id.slice(0, 8)}…`}</th>
                      {LEGACY_RIGHTS.map(({ key, label }) =>
                        <td key={key}>
                          <input type="checkbox" className="form-check-input" aria-label={`${label} for ${labels.get(id) || id}`}
                            checked={Boolean(draft[key])} disabled={savingUserId !== null}
                            onChange={(event) => setDrafts((prev) => ({
                              ...prev, [id]: { ...draft, [key]: event.target.checked },
                            }))} />
                        </td>
                      )}
                      <td><button type="button" className="btn btn-sm btn-outline-primary"
                        disabled={!dirty || savingUserId !== null}
                        onClick={() => void saveGrant(id, draft, grant)}>
                        {savingUserId === id ? "Saving…" : "Save"}
                      </button></td>
                    </tr>
                  );
                })}
                {!grants.length ? (
                  <tr><td colSpan={5} className="text-muted">No explicit legacy permissions.</td></tr>
                ) : null}
                <tr>
                  <th scope="row">
                    <select className="form-select form-select-sm" value={selectedAccount}
                      disabled={savingUserId !== null || !candidates.length}
                      onChange={(event) => setSelectedAccount(event.target.value)}
                      aria-label="Grant permissions to account">
                      <option value="">Select an account…</option>
                      {candidates.map((account) =>
                        <option key={account.id} value={account.id}>{accountLabel(account)}</option>
                      )}
                    </select>
                  </th>
                  {LEGACY_RIGHTS.map(({ key, label }) =>
                    <td key={key}>
                      <input type="checkbox" className="form-check-input" aria-label={`Grant ${label}`}
                        disabled={savingUserId !== null}
                        checked={Boolean(newFlags[key])}
                        onChange={(event) => setNewFlags((prev) => ({ ...prev, [key]: event.target.checked }))}/>
                    </td>
                  )}
                  <td><button type="button" className="btn btn-sm btn-outline-success"
                    disabled={!selectedAccount || savingUserId !== null || !LEGACY_RIGHTS.some(({ key }) => newFlags[key])}
                    onClick={() => void saveGrant(selectedAccount, newFlags)}>
                    {savingUserId === selectedAccount ? "Adding…" : "Add"}
                  </button></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="d-flex justify-content-end">
          <button className="btn btn-sm btn-outline-secondary" type="button"
            disabled={savingUserId !== null} onClick={() => setRefreshToken((n) => n + 1)}>Refresh permissions</button>
        </div>
        <div className="small text-muted mt-2">
          All changes are scoped to this character and rechecked by the database's Admin-only policies.
          Clearing all three flags leaves the grant row for audit rather than deleting it.
        </div>
      </div>
    </details>
  );
}

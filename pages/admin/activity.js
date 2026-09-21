import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabaseClient";

function dateText(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function AdminActivityPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(null);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: activityError } = await supabase.rpc("get_recent_site_activity_v1");
    if (activityError) {
      setRows([]);
      setError(activityError.message || "Could not load recent activity.");
      setLoading(false);
      return;
    }

    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function authorize() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;

      if (!sessionData?.session?.user) {
        void router.replace("/login?next=/admin/activity");
        return;
      }

      const { data: admin, error: adminError } = await supabase.rpc("is_admin");
      if (!active) return;

      const allowed = !adminError && Boolean(admin);
      setAuthorized(allowed);
      if (!allowed) {
        setLoading(false);
        return;
      }

      await loadActivity();
    }

    void authorize();
    return () => { active = false; };
  }, [loadActivity, router]);

  const accountCount = useMemo(() => rows.filter((row) => row.activity_kind === "account").length, [rows]);
  const visitorCount = useMemo(() => rows.filter((row) => row.activity_kind === "visitor").length, [rows]);

  if (authorized === false) {
    return (
      <main className="container py-5">
        <div className="alert alert-danger">Admin access is required to view site activity.</div>
      </main>
    );
  }

  return (
    <main className="container-fluid py-4 px-3 px-lg-4">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <div className="text-uppercase small fw-bold text-secondary">Admin</div>
          <h1 className="h3 mb-1">Recent site activity</h1>
          <p className="text-muted mb-0">
            Accounts and privacy-minimized visitors active during the last 30 days.
          </p>
        </div>
        <div className="d-flex gap-2">
          <a className="btn btn-outline-secondary" href="/profile?characterProfile=1">Back to account</a>
          <button className="btn btn-primary" type="button" onClick={loadActivity} disabled={loading || authorized !== true}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card shadow-sm h-100"><div className="card-body"><div className="text-muted small">Accounts</div><div className="display-6">{accountCount}</div></div></div>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card shadow-sm h-100"><div className="card-body"><div className="text-muted small">Anonymous visitors</div><div className="display-6">{visitorCount}</div></div></div>
        </div>
      </div>

      <div className="alert alert-info py-2">
        Anonymous visitor tracking starts with this deployment. Existing account creation and last-sign-in timestamps can appear immediately. This tracker does not store IP addresses, user-agent strings, browser fingerprints, or precise location.
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name / Visitor</th>
                <th>Email</th>
                <th>Role</th>
                <th>Account created</th>
                <th>Last sign-in</th>
                <th>First seen</th>
                <th>Last seen</th>
                <th>Visits</th>
                <th>Last page</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-5 text-muted">Loading activity…</td></tr>
              ) : rows.length ? rows.map((row) => (
                <tr key={`${row.activity_kind}:${row.activity_key}`}>
                  <td><span className={`badge ${row.activity_kind === "account" ? "text-bg-primary" : "text-bg-secondary"}`}>{row.activity_kind}</span></td>
                  <td>{row.display_name || "—"}</td>
                  <td>{row.email || "—"}</td>
                  <td className="text-capitalize">{row.role || "—"}</td>
                  <td>{dateText(row.account_created_at)}</td>
                  <td>{dateText(row.last_sign_in_at)}</td>
                  <td>{dateText(row.first_seen)}</td>
                  <td>{dateText(row.last_seen)}</td>
                  <td>{Number(row.visit_count || 0)}</td>
                  <td><code>{row.last_path || "—"}</code></td>
                </tr>
              )) : (
                <tr><td colSpan={10} className="text-center py-5 text-muted">No matching activity in the last 30 days.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

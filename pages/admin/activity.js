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
  const [creationNotices, setCreationNotices] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [noticesError, setNoticesError] = useState("");
  const [reviewingNoticeId, setReviewingNoticeId] = useState(null);

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

  const loadCreationNotices = useCallback(async () => {
    setNoticesLoading(true);
    setNoticesError("");
    const { data, error: noticeError } = await supabase.rpc(
      "get_admin_character_creation_notices_v1", { p_limit: 80 }
    );
    if (noticeError) {
      setCreationNotices([]);
      setNoticesError(
        noticeError.code === "PGRST202"
          ? "Character creation notices require the matching database migration."
          : (noticeError.message || "Could not load character creation notices.")
      );
    } else {
      setCreationNotices(Array.isArray(data) ? data : []);
    }
    setNoticesLoading(false);
  }, []);

  const markCreationNoticeReviewed = useCallback(async (eventId) => {
    if (!eventId || reviewingNoticeId) return;
    setReviewingNoticeId(eventId);
    setNoticesError("");
    const { data, error: reviewError } = await supabase.rpc(
      "review_admin_character_creation_notice_v1", { p_event_id: eventId }
    );
    if (reviewError) {
      setNoticesError(reviewError.message || "Could not mark notice reviewed.");
    } else {
      setCreationNotices((previous) => {
        const oldUnread = Number(previous[0]?.unread_total || 0);
        const wasUnread = previous.some((notice) =>
          notice.event_id === eventId && !notice.reviewed_at
        );
        return previous.map((notice) => ({
          ...notice,
          reviewed_at: notice.event_id === eventId ? data : notice.reviewed_at,
          unread_total: Math.max(0, oldUnread - (wasUnread ? 1 : 0)),
        }));
      });
    }
    setReviewingNoticeId(null);
  }, [reviewingNoticeId]);

  const refreshAll = useCallback(() => {
    void Promise.all([loadActivity(), loadCreationNotices()]);
  }, [loadActivity, loadCreationNotices]);

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

      await Promise.all([loadActivity(), loadCreationNotices()]);
    }

    void authorize();
    return () => { active = false; };
  }, [loadActivity, loadCreationNotices, router]);

  const accountCount = useMemo(() => rows.filter((row) => row.activity_kind === "account").length, [rows]);
  const visitorCount = useMemo(() => rows.filter((row) => row.activity_kind === "visitor").length, [rows]);
  const unreadCreationCount = useMemo(() => Number(creationNotices[0]?.unread_total || 0), [creationNotices]);

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
          <button className="btn btn-primary" type="button" onClick={refreshAll} disabled={(loading || noticesLoading) || authorized !== true}>
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
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card shadow-sm h-100"><div className="card-body"><div className="text-muted small">New characters to review</div><div className="display-6">{noticesLoading ? "—" : unreadCreationCount}</div></div></div>
        </div>
      </div>

      <section className="card shadow-sm mb-4" aria-labelledby="admin-character-notices-heading">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <h2 className="h5 mb-1" id="admin-character-notices-heading">Character creation notices</h2>
            <div className="small text-muted">New characters are created immediately. Review their permissions and add private GM notes afterward in NPC management.</div>
          </div>
          {unreadCreationCount > 0 ? <span className="badge text-bg-warning">{unreadCreationCount} unread</span> : null}
        </div>
        {noticesError ? <div className="alert alert-warning mx-3 mt-3 mb-0" role="alert">{noticesError}</div> : null}
        <div className="table-responsive">
          <table className="table table-striped table-hover align-middle mb-0">
            <thead><tr><th>Character</th><th>Created by</th><th>Created</th><th>Status</th><th>Manage</th></tr></thead>
            <tbody>
              {noticesLoading ? (
                <tr><td colSpan={5} className="text-center py-4 text-muted">Loading character notices…</td></tr>
              ) : creationNotices.length ? creationNotices.map((notice) => (
                <tr key={notice.event_id}>
                  <td className="fw-semibold">{notice.character_name || "Unnamed character"}</td>
                  <td>{notice.creator_email || (notice.created_by ? `Account ${String(notice.created_by).slice(0, 8)}` : "Account unavailable")}</td>
                  <td>{dateText(notice.created_at)}</td>
                  <td>
                    {notice.reviewed_at ? (
                      <span className="badge text-bg-secondary" title={dateText(notice.reviewed_at)}>Reviewed</span>
                    ) : (
                      <button className="btn btn-sm btn-outline-warning" type="button"
                        disabled={Boolean(reviewingNoticeId)}
                        onClick={() => void markCreationNoticeReviewed(notice.event_id)}>
                        {reviewingNoticeId === notice.event_id ? "Saving…" : "Mark reviewed"}
                      </button>
                    )}
                  </td>
                  <td><a className="btn btn-sm btn-outline-primary" href={`/npcs?focus=npc:${encodeURIComponent(notice.character_id)}`}>Open in NPC manager</a></td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="text-center py-4 text-muted">No character creation notices yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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

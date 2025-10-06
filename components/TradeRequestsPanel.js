// components/TradeRequestPanel.js
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function TradeRequestsPanel() {
  const [uid, setUid] = useState(null);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [itemsById, setItemsById] = useState({});
  const [tab, setTab] = useState("incoming");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let unsub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id || null;
      setUid(userId);
      await load(userId);

      const ch = supabase
        .channel("trade-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "trade_requests" }, () => load(userId))
        .subscribe();
      unsub = () => supabase.removeChannel(ch);
    })();
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(userId) {
    if (!userId) return;
    setErr("");
    const [inc, out] = await Promise.all([
      supabase.from("trade_requests").select("*").eq("to_user_id", userId).order("created_at", { ascending: false }),
      supabase.from("trade_requests").select("*").eq("from_user_id", userId).order("created_at", { ascending: false }),
    ]);

    if (!inc.error) setIncoming(inc.data || []);
    if (!out.error) setOutgoing(out.data || []);

    const ids = Array.from(new Set([...(inc.data||[]), ...(out.data||[])].map(r => r.inventory_item_id)));
    if (ids.length) {
      const { data: items } = await supabase
        .from("inventory_items")
        .select("id,item_name,item_rarity,item_type,image_url")
        .in("id", ids);
      const map = {};
      (items||[]).forEach(i => { map[i.id] = i; });
      setItemsById(map);
    } else {
      setItemsById({});
    }
  }

  async function accept(id) {
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.rpc("accept_trade", { p_trade_id: id });
      if (error) throw error;
    } catch (e) {
      setErr(e.message || "Accept failed.");
    } finally {
      setBusy(false);
    }
  }
  async function decline(id) {
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.from("trade_requests").update({ status: "declined" }).eq("id", id);
      if (error) throw error;
    } catch (e) {
      setErr(e.message || "Decline failed.");
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id) {
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.from("trade_requests").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    } catch (e) {
      setErr(e.message || "Cancel failed.");
    } finally {
      setBusy(false);
    }
  }

  const list = tab === "incoming" ? incoming : outgoing;

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div className="btn-group" role="group">
          <button className={`btn btn-sm ${tab==='incoming'?'btn-primary':'btn-outline-primary'}`} onClick={()=>setTab('incoming')}>Incoming</button>
          <button className={`btn btn-sm ${tab==='outgoing'?'btn-primary':'btn-outline-primary'}`} onClick={()=>setTab('outgoing')}>Outgoing</button>
        </div>
        <span className="text-muted small">{list.length} requests</span>
      </div>

      {err && <div className="alert alert-danger m-3 py-2">{err}</div>}

      <div className="list-group list-group-flush" style={{ maxHeight: 420, overflowY: "auto" }}>
        {list.map((r) => {
          const it = itemsById[r.inventory_item_id];
          const who = tab === "incoming" ? r.from_user_id : r.to_user_id;
          const statusBadge = {
            pending: "bg-warning text-dark",
            accepted: "bg-success",
            declined: "bg-secondary",
            cancelled: "bg-secondary",
          }[r.status] || "bg-secondary";

          return (
            <div key={r.id} className="list-group-item">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded" style={{ width: 48, height: 48, overflow: "hidden" }}>
                  <img src={it?.image_url || "/placeholder.png"} alt="" className="img-fluid object-fit-cover" />
                </div>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{it?.item_name || "Item"}</div>
                  <div className="small text-muted">
                    {tab === "incoming" ? "From" : "To"}: {who.slice(0, 8)}… • {new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.message && <div className="small mt-1">{r.message}</div>}
                </div>
                <span className={`badge ${statusBadge} me-2 text-uppercase`}>{r.status}</span>

                {r.status === "pending" && tab === "incoming" && (
                  <div className="btn-group">
                    <button className="btn btn-sm btn-success" onClick={()=>accept(r.id)} disabled={busy}>Accept</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={()=>decline(r.id)} disabled={busy}>Decline</button>
                  </div>
                )}

                {r.status === "pending" && tab === "outgoing" && (
                  <button className="btn btn-sm btn-outline-danger" onClick={()=>cancel(r.id)} disabled={busy}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!list.length && <div className="p-3 text-muted">No {tab} requests.</div>}
      </div>
    </div>
  );
}

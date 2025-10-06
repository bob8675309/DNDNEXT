import { useEffect, useMemo, useState } from "react";
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


const card = typeof it?.card_payload === 'string' ? safeParse(it.card_payload) : (it?.card_payload || {});
const img = card?.image_url || "/placeholder.png";


return (
<div key={r.id} className="list-group-item">
<div className="d-flex align-items-center gap-3">
<div className="rounded" style={{ width: 48, height: 48, overflow: "hidden" }}>
<img src={img} alt="" className="img-fluid object-fit-cover" />
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


function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
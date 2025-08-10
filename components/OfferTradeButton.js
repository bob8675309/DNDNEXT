import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * OfferTradeButton
 * - Creates a pending trade request for a single inventory_items row.
 */
export default function OfferTradeButton({ row }) {
  const [players, setPlayers] = useState([]);
  const [me, setMe] = useState(null);
  const [toId, setToId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const modalId = `offer_${row.id}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id || null;
      setMe(uid);

      // Prefer players table; fallback to user_profiles
      const p = await supabase.from("players").select("user_id, name").order("name", { ascending: true });
      let list = [];
      if (!p.error && p.data?.length) {
        list = p.data.map((r) => ({ id: r.user_id, label: r.name || r.user_id }));
      } else {
        const up = await supabase.from("user_profiles").select("id").order("id");
        if (!up.error && up.data?.length) {
          list = up.data.map((r) => ({ id: r.id, label: r.id }));
        }
      }
      list = list.filter((x) => x.id !== uid); // exclude self
      if (alive) setPlayers(list);
    })();
    return () => { alive = false; };
  }, []);

  async function offer() {
    setBusy(true); setErr(""); setOk("");
    try {
      if (!toId) throw new Error("Pick a recipient.");
      const { error } = await supabase.from("trade_requests").insert({
        inventory_item_id: row.id,
        from_user_id: me,
        to_user_id: toId,
        message: note || null,
      });
      if (error) throw error;
      setOk("Trade request sent.");
      setNote("");
      setToId("");
    } catch (e) {
      setErr(e.message || "Failed to create trade.");
    } finally {
      setBusy(false);
    }
  }

  const itemName = row.item_name || row.name || "Item";

  return (
    <>
      <button className="btn btn-sm btn-outline-secondary" data-bs-toggle="modal" data-bs-target={`#${modalId}`}>
        Offer Trade
      </button>

      <div className="modal fade" id={modalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Offer “{itemName}”</h5>
              <button className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Recipient</label>
                <select className="form-select" value={toId} onChange={(e)=>setToId(e.target.value)}>
                  <option value="">Select a player…</option>
                  {players.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Message (optional)</label>
                <textarea className="form-control" rows={3} value={note} onChange={(e)=>setNote(e.target.value)} />
              </div>
              {ok && <div className="alert alert-success py-2">{ok}</div>}
              {err && <div className="alert alert-danger py-2">{err}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button className="btn btn-primary" onClick={offer} disabled={busy || !toId}>
                {busy ? "Sending…" : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

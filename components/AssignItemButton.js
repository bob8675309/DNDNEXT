// /components/AssignItemButton.js
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * AssignItemButton
 * Opens a modal where admin picks a player and quantity, then inserts rows into `inventory_items`.
 * Columns inserted: user_id, item_id, item_name, item_type, item_rarity, item_description, image_url.
 * Adjust the column names below if your table differs.
 */
export default function AssignItemButton({ item }) {
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(null);
  const [err, setErr] = useState(null);

  const modalId = `assign_${(item.name || item.item_name || "item").replace(/\W+/g,"_")}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      // Try players table; fall back to user_profiles
      const tryPlayers = await supabase.from("players").select("user_id, name").order("name", { ascending: true });
      let list = [];
      if (!tryPlayers.error && tryPlayers.data?.length) {
        list = tryPlayers.data.map(p => ({ id: p.user_id, label: p.name || p.user_id }));
      } else {
        const up = await supabase.from("user_profiles").select("id, role").order("id");
        if (!up.error && up.data?.length) {
          list = up.data.map(u => ({ id: u.id, label: u.id }));
        }
      }
      if (alive) setPlayers(list);
    })();
    return () => { alive = false; };
  }, []);

  const norm = {
    id: item.id || item._id || (item.name || item.item_name || "").toLowerCase().replace(/\W+/g,"-"),
    name: item.item_name || item.name || "Unnamed Item",
    type: item.item_type || item.type || "Wondrous Item",
    rarity: item.item_rarity || item.rarity || "Common",
    description: item.item_description || item.description || item.flavor || "",
    image: item.image_url || item.img || item.image || null,
  };

  async function assign() {
    setBusy(true); setErr(null); setOk(null);
    try {
      if (!playerId) throw new Error("Pick a player.");
      const rows = Array.from({ length: Math.max(1, Number(qty) || 1) }, () => ({
        user_id: playerId,
        item_id: norm.id,
        item_name: norm.name,
        item_type: norm.type,
        item_rarity: norm.rarity,
        item_description: norm.description,
        image_url: norm.image
      }));
      const { error } = await supabase.from("inventory_items").insert(rows);
      if (error) throw error;
      setOk(`Assigned ${rows.length} × ${norm.name}`);
    } catch (e) {
      setErr(e.message || "Failed to assign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="btn btn-sm btn-primary"
        data-bs-toggle="modal"
        data-bs-target={`#${modalId}`}
      >
        Assign
      </button>

      <div className="modal fade" id={modalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Assign “{norm.name}”</h5>
              <button className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Player</label>
                <select className="form-select" value={playerId} onChange={e=>setPlayerId(e.target.value)}>
                  <option value="">Select a player…</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Quantity</label>
                <input type="number" min="1" className="form-control" value={qty} onChange={e=>setQty(e.target.value)} />
              </div>
              {ok && <div className="alert alert-success py-2">{ok}</div>}
              {err && <div className="alert alert-danger py-2">{err}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button className="btn btn-primary" onClick={assign} disabled={busy}>
                {busy ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

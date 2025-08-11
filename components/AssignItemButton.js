// components/AssignItemButton.js
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

function toCostText(v) {
  if (v == null) return null;
  if (typeof v === "number") return `${v} gp`;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const amt = v.amount ?? v.value ?? v.qty ?? null;
    const unit = v.unit ?? v.currency ?? "gp";
    return amt != null ? `${amt} ${unit}` : null;
  }
  return null;
}

function toWeightText(w) {
  if (w == null) return null;
  if (typeof w === "number") return `${w} lbs`;
  if (typeof w === "string") return w;
  if (typeof w === "object") {
    const amt = w.amount ?? w.value ?? w.qty ?? null;
    const unit = w.unit ?? "lbs";
    return amt != null ? `${amt} ${unit}` : null;
  }
  return null;
}

export default function AssignItemButton({ item }) {
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      // prefer players table; fallback to user_profiles
      const p = await supabase.from("players").select("user_id,name").order("name");
      if (!p.error && p.data?.length) {
        setPlayers(p.data.map(r => ({ id: r.user_id, label: r.name || r.user_id })));
      } else {
        const up = await supabase.from("user_profiles").select("id").order("id");
        if (!up.error && up.data?.length) {
          setPlayers(up.data.map(r => ({ id: r.id, label: r.id })));
        }
      }
    })();
  }, []);

  async function assign() {
    if (!playerId || !item) return;
    setBusy(true); setMsg("");

    const norm = {
      id: item.id || item._id || (item.name || item.item_name || "").toLowerCase().replace(/\W+/g, "-"),
      name: item.item_name || item.name || "Unnamed Item",
      type: item.item_type || item.type || "Wondrous Item",
      rarity: item.item_rarity || item.rarity || "common",
      description: item.item_description || item.description || (Array.isArray(item.entries) ? "[See description]" : ""),
      weightText: toWeightText(item.item_weight ?? item.weight),
      costText: toCostText(item.item_cost ?? item.cost ?? item.value),
    };

    const rows = Array.from({ length: Math.max(1, Number(qty) || 1) }, () => ({
      user_id: playerId,
      item_id: norm.id,
      item_name: norm.name,
      item_type: norm.type,
      item_rarity: norm.rarity,
      item_description: norm.description,
      item_weight: norm.weightText,
      item_cost: norm.costText,
    }));

    const { error } = await supabase.from("inventory_items").insert(rows);
    setBusy(false);
    setMsg(error ? `Failed: ${error.message}` : `Assigned ${rows.length} item(s).`);
  }

  const modalId = "assignItemModal";

  return (
    <>
      <button className="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target={`#${modalId}`}>
        Assign
      </button>

      <div className="modal fade" id={modalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Assign “{item?.item_name || item?.name || "Item"}”</h5>
              <button className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Player</label>
                <select className="form-select" value={playerId} onChange={e=>setPlayerId(e.target.value)}>
                  <option value="">-- Select a Player --</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Quantity</label>
                <input type="number" min={1} className="form-control" value={qty}
                       onChange={e=>setQty(e.target.value)} />
              </div>
              {msg && <div className="alert alert-info py-2 mb-0">{msg}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button className="btn btn-primary" onClick={assign} disabled={busy || !playerId}>
                {busy ? "Assigning…" : "Assign Item"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

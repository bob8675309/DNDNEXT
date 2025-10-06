// components/AssignItemButton.js
import { useEffect, useState } from "react";
}, []);


async function assign() {
if (!playerId || !item) return;
setBusy(true); setMsg("");


// Compose a payload ItemCard can render later
const payload = {
name: item.item_name || item.name || "Unnamed Item",
rarity: item.item_rarity || item.rarity || "common",
description: item.item_description || item.description || (Array.isArray(item.entries) ? item.entries.join("\n") : ""),
entries: Array.isArray(item.entries) ? item.entries : undefined,
damageText: item.damageText || item.damage || "",
rangeText: item.rangeText || item.range || "",
propertiesText: item.propertiesText || item.properties || "",
ac: item.ac || "",
flavor: item.flavor || "",
image_url: item.image_url || item.img || item.image || "/placeholder.png",
weightText: toWeightText(item.item_weight ?? item.weight),
costText: toCostText(item.item_cost ?? item.cost ?? item.value),
};


const rows = Array.from({ length: Math.max(1, Number(qty) || 1) }, () => ({
user_id: playerId,
item_id: (item.id || item._id || payload.name.toLowerCase().replace(/\W+/g, "-")),
item_name: payload.name,
item_type: item.item_type || item.type || "Wondrous Item",
item_rarity: payload.rarity,
item_description: payload.description,
item_weight: payload.weightText,
item_cost: payload.costText,
card_payload: payload,
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
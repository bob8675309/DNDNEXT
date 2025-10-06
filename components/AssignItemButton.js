// /components/AssignItemButton.js
item_rarity: norm.rarity,
item_description: norm.description,
item_weight: norm.weightText,
item_cost: norm.costText,
card_payload: payload,
}));


const { error } = await supabase.from("inventory_items").insert(rows);
setBusy(false);
setMsg(error ? `Failed: ${error.message}` : `Assigned ${rows.length} item(s).`);
}


const modalId = `assignItemModal`;


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

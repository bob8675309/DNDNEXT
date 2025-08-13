// pages/items.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { loadItemsIndex } from "../utils/itemsIndex";

/** Safe string normalize if utils/itemsIndex doesn't provide one */
function localNorm(s = "") {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

/** Try to load the items index (util first, then /items/all-items.json fallback) */
async function getItemsIndexResilient() {
  try {
    // Allow either { byKey, norm } or an array like [{ byKey, norm }]
    const idx = await loadItemsIndex();
    const maybe = Array.isArray(idx) ? idx[0] : idx;
    const byKey = maybe?.byKey || {};
    const norm = maybe?.norm || localNorm;
    return { byKey, norm };
  } catch {
    // Fallback: fetch the static JSON and build byKey on the fly
    try {
      const res = await fetch("/items/all-items.json");
      if (res.ok) {
        const all = await res.json();
        const byKey = {};
        for (const it of all || []) {
          if (it?.name) byKey[localNorm(it.name)] = it;
        }
        return { byKey, norm: localNorm };
      }
    } catch {
      // ignore
    }
  }
  return { byKey: {}, norm: localNorm };
}

/** Your SItem-themed card */
function ItemCard({ item }) {
  const {
    item_name,
    item_type,
    item_rarity,
    item_description,
    item_weight,
    item_cost,
    slot,
    source,
  } = item;

  return (
    <div className="card sitem-card mb-4">
      <div className="card-header sitem-header d-flex align-items-center justify-content-between">
        <div className="sitem-title">{item_name}</div>
        {item_rarity ? (
          <span className="badge text-bg-secondary ms-2">{item_rarity}</span>
        ) : (
          <span className="badge text-bg-secondary ms-2">—</span>
        )}
      </div>

      <div className="card-body">
        <div className="row g-3">
          <div className="col-12">
            <div className="sitem-section">
              <div className="small text-muted mb-1">Type</div>
              <div>{item_type || "—"}</div>
            </div>
          </div>

          <div className="col-12">
            <div className="sitem-section">
              <div className="small text-muted mb-1">Description</div>
              <div className="text-wrap">{item_description || "—"}</div>
            </div>
          </div>

          <div className="col-6">
            <div className="sitem-section d-flex justify-content-between align-items-center">
              <div className="small text-muted me-2">Cost</div>
              <span className="badge rounded-pill text-bg-dark">
                {item_cost || "—"}
              </span>
            </div>
          </div>

          <div className="col-6">
            <div className="sitem-section d-flex justify-content-between align-items-center">
              <div className="small text-muted me-2">Weight</div>
              <span className="badge rounded-pill text-bg-dark">
                {item_weight || "—"}
              </span>
            </div>
          </div>

          <div className="col-12 d-flex flex-wrap gap-2">
            {slot ? (
              <span className="badge text-bg-secondary">{`Slot: ${slot}`}</span>
            ) : (
              <span className="badge text-bg-secondary">Slot: —</span>
            )}
            {source ? <span className="badge text-bg-secondary">{source}</span> : null}
          </div>
        </div>
      </div>

      <div className="card-footer sitem-footer">
        <div className="d-flex align-items-center justify-content-end gap-2">
          <button type="button" className="btn btn-sm btn-outline-light">
            More Info
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemsPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Extracted runner so we can reuse for "Reload"
  async function runLoad() {
    setErr("");
    setLoading(true);
    try {
      const [{ byKey, norm }, dbRes] = await Promise.all([
        getItemsIndexResilient(),
        supabase
          .from("inventory_items")
          .select(
            "id, item_name, item_type, item_rarity, item_description, item_weight, item_cost"
          )
          .order("item_name", { ascending: true }),
      ]);

      if (dbRes.error) throw dbRes.error;
      const rows = dbRes.data || [];

     // after: const rows = dbRes.data || [];
// rows already loaded into `rows` and `byKey` is built
let merged;

if ((rows || []).length === 0 && Object.keys(byKey).length) {
  // show catalog as virtual rows when DB is empty/blocked
  merged = Object.values(byKey).map(ref => ({
    id: `cat:${ref.name}`,
    item_name: ref.name,
    item_type: ref.type ?? ref.category ?? null,
    item_rarity: ref.rarity ?? null,
    item_description: ref.description ?? null,
    item_weight: ref.weight ?? null,
    item_cost: ref.cost ?? ref.price ?? null,
    slot: ref.slot ?? null,
    source: ref.source ?? null,
    // short aliases for any components expecting these
    name: ref.name,
    type: ref.type ?? ref.category ?? null,
    rarity: ref.rarity ?? null,
    description: ref.description ?? null,
    weight: ref.weight ?? null,
    cost: ref.cost ?? ref.price ?? null,
  }));
} else {
  // your existing merge logic (unchanged)
  merged = rows.map(r => {
    const ref = byKey[norm(r.item_name)] || null;
    const type        = r.item_type        ?? ref?.type ?? ref?.category ?? null;
    const rarity      = r.item_rarity      ?? ref?.rarity ?? null;
    const description = r.item_description ?? ref?.description ?? null;
    const weight      = r.item_weight      ?? (ref?.weight ?? null);
    const cost        = r.item_cost        ?? (ref?.cost ?? ref?.price ?? null);
    const slot        = r.slot             ?? ref?.slot ?? null;
    const source      = r.source           ?? ref?.source ?? null;

    return {
      ...r,
      item_type: type,
      item_rarity: rarity,
      item_description: description,
      item_weight: weight,
      item_cost: cost,
      slot,
      source,
      name: r.item_name ?? ref?.name ?? null,
      type, rarity, description, weight, cost,
    };
  });
}

setItems(merged);



  // one-shot load on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      await runLoad();
    })();
    return () => {
      mounted = false; // (kept for parity; runLoad guards on setState order anyway)
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      const hay =
        [
          it.item_name,
          it.item_type,
          it.item_rarity,
          it.item_description,
          it.item_cost,
          it.item_weight,
          it.slot,
          it.source,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase() || "";
      return hay.includes(needle);
    });
  }, [items, q]);

  return (
    <div className="container my-3">
      <div className="d-flex align-items-center gap-2 mb-3">
        <div className="input-group">
          <span className="input-group-text">Search</span>
          <input
            className="form-control"
            placeholder="Search by name, type, rarity…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          className="btn btn-outline-secondary"
          onClick={() => setQ("")}
          disabled={!q}
        >
          Clear
        </button>
        <button
          className="btn btn-outline-primary"
          onClick={() => runLoad()}
          disabled={loading}
          title="Reload items (re-fetch DB + index)"
        >
          {loading ? "Loading…" : "Reload"}
        </button>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}
      {loading && <div className="text-muted">Loading items…</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-muted">No items found.</div>
      )}

      <div className="row">
        {filtered.map((it) => (
          <div key={it.id || it.item_name} className="col-12 col-md-6 col-lg-4">
            <ItemCard item={it} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ItemsPage;
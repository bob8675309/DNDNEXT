// pages/items.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { loadItemsIndex } from "../utils/itemsIndex";

/**
 * Safe string normalize if utils/itemsIndex doesn't provide one
 */
function localNorm(s = "") {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Renders one item "card" using your SItem Card styles from globals.scss
 */
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
            {source ? (
              <span className="badge text-bg-secondary">{source}</span>
            ) : null}
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

  // one-shot load on mount
  useEffect(() => {
    let mounted = true;

    async function run() {
      setErr("");
      setLoading(true);
      try {
        // 1) Load index (name → metadata)
        //    Expecting { byKey, norm } from your utils
        let byKey = {};
        let normFn = localNorm;
        try {
          const idx = await loadItemsIndex();
          // Allow loadItemsIndex to return either the mapping directly
          // or an object with fields. Your example showed: [{ byKey, norm }]
          const maybe = Array.isArray(idx) ? idx[0] : idx;
          byKey = maybe?.byKey || {};
          normFn = maybe?.norm || localNorm;
        } catch {
          // As a fallback (client-side only), try reading /items/all-items.json
          // and build byKey on the fly. This keeps functionality intact if the
          // util ever fails.
          try {
            const res = await fetch("/items/all-items.json");
            if (res.ok) {
              const all = await res.json();
              const tmp = {};
              for (const it of all || []) {
                if (it?.name) tmp[localNorm(it.name)] = it;
              }
              byKey = tmp;
              normFn = localNorm;
            }
          } catch {
            // ignore — we’ll just render DB rows
          }
        }

        // 2) Load inventory rows from Supabase
        const { data: rows, error } = await supabase
          .from("inventory_items")
          .select(
            "id, item_name, item_type, item_rarity, item_description, item_weight, item_cost"
          )
          .order("item_name", { ascending: true });

        if (error) throw error;

        // 3) Merge missing fields from index
        const merged = (rows || []).map((r) => {
          const ref = byKey[normFn(r.item_name)];
          if (!ref) return r;
          return {
            ...r,
            item_type: r.item_type ?? ref.type ?? ref.category ?? null,
            item_rarity: r.item_rarity ?? ref.rarity ?? null,
            item_description: r.item_description ?? ref.description ?? null,
            item_weight: r.item_weight ?? (ref.weight ?? null),
            item_cost: r.item_cost ?? (ref.cost ?? ref.price ?? null),
            // bonus fields if present in the index (don’t overwrite DB if present)
            slot: r.slot ?? ref.slot ?? null,
            source: r.source ?? ref.source ?? null,
          };
        });

        if (mounted) setItems(merged);
      } catch (e) {
        if (mounted) setErr(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
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
            placeholder='Search by name, type, rarity…'
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

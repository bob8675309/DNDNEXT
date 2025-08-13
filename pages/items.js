// pages/items.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { loadItemsIndex } from "../utils/itemsIndex";

// ---------- helpers ----------
function normLocal(s = "") {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}
function slugify(s = "") {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ---------- card ----------
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
        <span className="badge text-bg-secondary ms-2">
          {item_rarity || "—"}
        </span>
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
            <span className="badge text-bg-secondary">
              {`Slot: ${slot || "—"}`}
            </span>
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

// ---------- page ----------
export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin gate from user_profiles.role
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } = {} } = await supabase.auth.getUser();
        if (!user) { if (alive) setIsAdmin(false); return; }
        const { data, error } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (error) { if (alive) setIsAdmin(false); return; }
        if (alive) setIsAdmin(data?.role === "admin");
      } catch {
        if (alive) setIsAdmin(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Build a name->ref map, from utils first, fallback to /items/all-items.json
  async function buildIndex() {
    try {
      const idx = await loadItemsIndex();
      const maybe = Array.isArray(idx) ? idx[0] : idx;
      return { byKey: maybe?.byKey || {}, norm: maybe?.norm || normLocal };
    } catch {
      try {
        const res = await fetch("/items/all-items.json");
        if (res.ok) {
          const all = await res.json();
          const byKey = {};
          for (const ref of all || []) {
            if (ref?.name) byKey[normLocal(ref.name)] = ref;
          }
          return { byKey, norm: normLocal };
        }
      } catch { /* ignore */ }
      return { byKey: {}, norm: normLocal };
    }
  }

  async function loadData() {
    setErr("");
    setLoading(true);
    try {
      const { byKey, norm } = await buildIndex();

      const { data: rows, error } = await supabase
        .from("inventory_items")
        .select(
          "id, item_name, item_type, item_rarity, item_description, item_weight, item_cost"
        )
        .order("item_name", { ascending: true });
      if (error) throw error;

      let list;

      if ((rows || []).length === 0 && Object.keys(byKey).length) {
        // DB empty → show catalog as virtual rows
        list = Object.values(byKey).map((ref) => ({
          id: `cat:${ref.name}`,
          item_name: ref.name,
          item_type: ref.type ?? ref.category ?? null,
          item_rarity: ref.rarity ?? null,
          item_description: ref.description ?? null,
          item_weight: ref.weight ?? null,
          item_cost: ref.cost ?? ref.price ?? null,
          slot: ref.slot ?? null,
          source: ref.source ?? null,

          // aliases
          name: ref.name,
          type: ref.type ?? ref.category ?? null,
          rarity: ref.rarity ?? null,
          description: ref.description ?? null,
          weight: ref.weight ?? null,
          cost: ref.cost ?? ref.price ?? null,
        }));
      } else {
        // merge DB rows with catalog
        list = (rows || []).map((r) => {
          const ref = byKey[norm(r.item_name)];
          return {
            ...r,
            item_type: r.item_type ?? ref?.type ?? ref?.category ?? null,
            item_rarity: r.item_rarity ?? ref?.rarity ?? null,
            item_description: r.item_description ?? ref?.description ?? null,
            item_weight: r.item_weight ?? ref?.weight ?? null,
            item_cost: r.item_cost ?? ref?.cost ?? ref?.price ?? null,
            slot: r.slot ?? ref?.slot ?? null,
            source: r.source ?? ref?.source ?? null,

            // aliases
            name: r.item_name,
            type: r.item_type ?? ref?.type ?? ref?.category ?? null,
            rarity: r.item_rarity ?? ref?.rarity ?? null,
            description: r.item_description ?? ref?.description ?? null,
            weight: r.item_weight ?? ref?.weight ?? null,
            cost: r.item_cost ?? ref?.cost ?? ref?.price ?? null,
          };
        });
      }

      setItems(list);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admin-only seeding from catalog → inventory_items (chunked inserts)
  const onSeed = async () => {
    try {
      if (!isAdmin) {
        alert("Admins only.");
        return;
      }
      setErr("");
      setLoading(true);

      const { byKey } = await buildIndex();
      const all = Object.values(byKey);
      if (all.length === 0) throw new Error("Catalog not available.");

      const SEED_COUNT = 200;
      const refs = all.slice(0, SEED_COUNT);

      const rows = refs.map((ref) => ({
        item_id: slugify(ref.name),
        item_name: ref.name,
        item_type: ref.type ?? ref.category ?? null,
        item_rarity: ref.rarity ?? null,
        item_description: ref.description ?? null,
        item_weight: ref.weight ?? null,
        item_cost: ref.cost ?? ref.price ?? null,
        user_id: null, // leave null for global items (adjust if you want per-user)
      }));

      for (const batch of chunk(rows, 50)) {
        const { error } = await supabase.from("inventory_items").insert(batch);
        if (error) throw error;
      }

      await loadData();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;

    return items.filter((it) => {
      const hay = [
        it.item_name,
        it.item_type,
        it.item_rarity,
        it.item_description,
        it.item_cost,
        it.item_weight,
        it.slot,
        it.source,
        // aliases we added so the search also hits the catalog fields
        it.name,
        it.type,
        it.rarity,
        it.description,
        it.cost,
        it.weight,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });
  }, [items, q]);

  return (
    <div className="container my-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
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

        {isAdmin && (
          <button
            className="btn btn-outline-warning ms-auto"
            onClick={onSeed}
            title="Insert a chunk of items from the catalog into inventory_items"
          >
            Seed from catalog
          </button>
        )}
      </div>

      {err && <div className="alert alert-danger">{err}</div>}
      {loading && <div className="text-muted">Loading items…</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-muted">
          No items found.
          {isAdmin && (
            <>
              {" "}
              If your database is empty, click{" "}
              <button
                type="button"
                className="btn btn-sm btn-link p-0 align-baseline"
                onClick={onSeed}
              >
                Seed from catalog
              </button>
              .
            </>
          )}
        </div>
      )}

      <div className="row">
        {filtered.map((it) => (
          <div
            key={it.id || it.item_id || it.item_name}
            className="col-12 col-md-6 col-lg-4"
          >
            <ItemCard item={it} />
          </div>
        ))}
      </div>
    </div>
  );
}

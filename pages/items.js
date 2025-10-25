// pages/items.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { loadItemsIndex, classifyType } from "../utils/itemsIndex";

// local fallback normalizer in case utils changes in the future
function localNorm(s = "") {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

/* ---------- tiny helpers for the stats strip (mirrors utils/itemsIndex) ---------- */
const DMG = { P:"piercing", S:"slashing", B:"bludgeoning", R:"radiant", N:"necrotic", F:"fire", C:"cold", L:"lightning", A:"acid", T:"thunder", Psn:"poison", Psy:"psychic", Frc:"force" };
const PROP = { L:"Light", F:"Finesse", H:"Heavy", R:"Reach", T:"Thrown", V:"Versatile", "2H":"Two-Handed", A:"Ammunition", LD:"Loading", S:"Special", RLD:"Reload" };
const humanProps = (props = []) => props.map((p) => PROP[p] || p).join(", ");
const buildDamageText = (d1, dt, d2, props) => {
  const t = DMG[dt] || dt || "";
  const base = d1 ? `${d1} ${t}`.trim() : "";
  const vers = props?.includes?.("V") && d2 ? `versatile (${d2})` : "";
  return [base, vers].filter(Boolean).join("; ");
};
const buildRangeText = (range, props) => {
  if (!range && !props?.includes?.("T")) return "";
  const r = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if (props?.includes?.("T")) return r ? `Thrown ${r} ft.` : "Thrown";
  return r ? `${r} ft.` : "";
};

function StatsStrip({ item }) {
  const damageText = buildDamageText(item.dmg1, item.dmgType, item.dmg2, item.property);
  const rangeText = buildRangeText(item.range, item.property);
  const propsText = humanProps(item.property || []);
  const show = damageText || rangeText || propsText;
  if (!show) return null;

  return (
    <div className="sitem-section">
      <div className="row g-2">
        {damageText && (
          <div className="col-12 col-md-4">
            <div className="small text-muted mb-1">Damage</div>
            <span className="badge rounded-pill text-bg-dark">{damageText}</span>
          </div>
        )}
        {rangeText && (
          <div className="col-12 col-md-4">
            <div className="small text-muted mb-1">Range</div>
            <span className="badge rounded-pill text-bg-dark">{rangeText}</span>
          </div>
        )}
        {propsText && (
          <div className="col-12 col-md-4">
            <div className="small text-muted mb-1">Properties</div>
            <span className="badge rounded-pill text-bg-dark">{propsText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item }) {
  const {
    item_name, item_type, item_rarity, item_description, item_weight, item_cost, slot, source,
  } = item;

  return (
    <div className="card sitem-card mb-4">
      <div className="card-header sitem-header d-flex align-items-center justify-content-between">
        <div className="sitem-title">{item_name}</div>
        <span className="badge text-bg-secondary ms-2">{item_rarity || "—"}</span>
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

          <div className="col-12">
            <StatsStrip item={item} />
          </div>

          <div className="col-6">
            <div className="sitem-section d-flex justify-content-between align-items-center">
              <div className="small text-muted me-2">Cost</div>
              <span className="badge rounded-pill text-bg-dark">{item_cost || "—"}</span>
            </div>
          </div>

          <div className="col-6">
            <div className="sitem-section d-flex justify-content-between align-items-center">
              <div className="small text-muted me-2">Weight</div>
              <span className="badge rounded-pill text-bg-dark">{item_weight || "—"}</span>
            </div>
          </div>

          <div className="col-12 d-flex flex-wrap gap-2">
            <span className="badge text-bg-secondary">Slot: {slot || "—"}</span>
            {source ? <span className="badge text-bg-secondary">{source}</span> : null}
          </div>
        </div>
      </div>

      <div className="card-footer sitem-footer">
        <div className="d-flex align-items-center justify-content-end gap-2">
          <button type="button" className="btn btn-sm btn-outline-light">More Info</button>
        </div>
      </div>
    </div>
  );
}

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;

    async function run() {
      setErr("");
      setLoading(true);
      try {
        // Load catalog index with BC for different filenames
        let byKey = {};
        let normFn = localNorm;
        try {
          const idx = await loadItemsIndex();
          const obj = Array.isArray(idx) ? idx[0] : idx; // safety
          byKey = obj?.byKey || {};
          normFn = obj?.norm || localNorm;
        } catch {
          byKey = {};
          normFn = localNorm;
        }

        // Database rows
        const { data: rows, error } = await supabase
          .from("inventory_items")
          .select(
            "id, item_name, item_type, item_rarity, item_description, item_weight, item_cost"
          )
          .order("item_name", { ascending: true });

        if (error) throw error;

        // Merge DB with catalog reference (DB wins when present)
        const merged = (rows || []).map((r) => {
          const ref = byKey[normFn(r.item_name)] || {};
          const combined = {
            ...r,
            item_type: r.item_type ?? ref.type ?? ref.category ?? null,
            item_rarity: r.item_rarity ?? ref.rarity ?? null,
            item_description: r.item_description ?? ref.rulesFull ?? ref.description ?? ref.loreFull ?? null,
            item_weight: r.item_weight ?? ref.weight ?? null,
            item_cost: r.item_cost ?? ref.cost ?? ref.price ?? null,
            slot: ref.slot ?? null,
            source: ref.source ?? null,
            // mechanics for stats strip
            dmg1: ref.dmg1 ?? null,
            dmg2: ref.dmg2 ?? null,
            dmgType: ref.dmgType ?? null,
            range: ref.range ?? null,
            property: ref.property ?? ref.properties ?? [],
          };
          return { ...combined, uiType: classifyType(combined.item_type || combined.type || "", combined) };
        });

        if (mounted) setItems(merged);
      } catch (e) {
        if (mounted) setErr(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      const hay = [
        it.item_name, it.item_type, it.item_rarity, it.item_description,
        it.item_cost, it.item_weight, it.slot, it.source, it.uiType,
      ].filter(Boolean).join(" ").toLowerCase();
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
        <button className="btn btn-outline-secondary" onClick={() => setQ("")} disabled={!q}>
          Clear
        </button>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}
      {loading && <div className="text-muted">Loading items…</div>}
      {!loading && filtered.length === 0 && <div className="text-muted">No items found.</div>}

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

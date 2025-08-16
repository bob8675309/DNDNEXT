// pages/items.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { loadItemsIndex } from "../utils/itemsIndex";
import { classifyType } from "../utils/itemsIndex";

const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const truncate = (s, n = 360) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "");

/** ---------- Card + Modal ---------- */
function ItemCard({ item, modalId }) {
  const {
    item_name,
    item_type,
    item_rarity,
    item_description,
    item_weight,
    item_cost,
    slot,
    source,
    // merged (from index)
    type,
    rarity,
    damageText,
    rangeText,
    propertiesText,
    attunementText,
    loreShort,
    loreFull,
    rulesShort,
    rulesFull,
  } = item;

  const showType = item_type || type || "—";
  const showRarity = item_rarity || rarity || "";
  const loreBrief = loreShort || truncate(item_description || "");
  const rulesBrief = rulesShort || truncate(item_description || "", 420);

  return (
    <>
      <div className="card sitem-card mb-4">
        <div className="card-header sitem-header d-flex align-items-center justify-content-between">
          <div className="sitem-title">{item.item_name || item.name}</div>
          <span className="badge text-bg-secondary ms-2">{showRarity || "—"}</span>
        </div>

        <div className="card-body">
          <div className="row g-3">
            {/* Type */}
            <div className="col-12">
              <div className="sitem-section">
                <div className="small text-muted mb-1">Type</div>
                <div>{showType}</div>
              </div>
            </div>

            {/* Lore (truncated) */}
            <div className="col-12">
              <div className="sitem-section">
                <div className="small text-muted mb-1">Description</div>
                <div className="text-wrap">{loreBrief || "—"}</div>
              </div>
            </div>

            {/* Gameplay line */}
            {(damageText || rangeText || propertiesText || attunementText) && (
              <div className="col-12">
                <div className="sitem-section">
                  <div className="small text-muted mb-1">Gameplay</div>
                  <div>
                    {damageText && <><strong>{damageText}</strong></>}{" "}
                    {rangeText && <span className="ms-2">{rangeText}</span>}{" "}
                    {propertiesText && <span className="ms-2">{propertiesText}</span>}{" "}
                    {attunementText && <span className="ms-2 fst-italic">({attunementText})</span>}
                  </div>
                  {rulesBrief && <div className="mt-2">{rulesBrief}</div>}
                </div>
              </div>
            )}

            {/* Badges row */}
            <div className="col-12 d-flex flex-wrap gap-2">
              <span className="badge text-bg-secondary">{`Slot: ${slot || "—"}`}</span>
              {source ? <span className="badge text-bg-secondary">{source}</span> : null}
              {item_cost ? <span className="badge rounded-pill text-bg-dark">{item_cost}</span> : null}
              {item_weight ? <span className="badge rounded-pill text-bg-dark">{item_weight}</span> : null}
            </div>
          </div>
        </div>

        <div className="card-footer sitem-footer">
          <div className="d-flex align-items-center justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-light"
              data-bs-toggle="modal"
              data-bs-target={`#${modalId}`}
            >
              More Info
            </button>
          </div>
        </div>
      </div>

      {/* Modal with full lore + rules */}
      <div className="modal fade" id={modalId} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{item.item_name || item.name}</h5>
              <button className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body">
              {loreFull && (
                <>
                  <div className="fw-semibold mb-1">Lore</div>
                  <div className="mb-3">{loreFull}</div>
                </>
              )}
              {(damageText || rangeText || propertiesText || attunementText) && (
                <>
                  <div className="fw-semibold mb-1">Stats</div>
                  <div className="mb-3">
                    {damageText && <div><strong>{damageText}</strong></div>}
                    {rangeText && <div>{rangeText}</div>}
                    {propertiesText && <div>{propertiesText}</div>}
                    {attunementText && <div className="fst-italic">({attunementText})</div>}
                  </div>
                </>
              )}
              {rulesFull && (
                <>
                  <div className="fw-semibold mb-1">Details</div>
                  <div>{rulesFull}</div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** ---------- Page ---------- */
export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // Load index (merged data for damage/lore/etc.)
        const { byKey, norm: normalize } = await loadItemsIndex();
		
		// after merging DB rows with catalog data:
		const merged = rows.map((r) => {
		const ref = byKey[normFn(r.item_name)];
		const combined = { ...r, /* your existing field merges */, ...(ref || {}) };
			return { ...combined, uiType: classifyType(combined.item_type || combined.type || "", combined) };
			});
			
        // Load inventory rows (these drive which cards to show)
        const { data: rows, error } = await supabase
          .from("inventory_items")
          .select("id, item_name, item_type, item_rarity, item_description, item_weight, item_cost, slot, source")
          .order("item_name", { ascending: true });

        if (error) throw error;

        const merged = (rows || []).map(r => {
          const ref = byKey[normalize(r.item_name)];
          if (!ref) return r; // still show bare DB row
          return {
            ...r,
            // enrich with catalog fields, but never overwrite DB fields if present
            type: r.item_type ?? ref.type ?? null,
            rarity: r.item_rarity ?? ref.rarity ?? null,
            slot: r.slot ?? ref.slot ?? null,
            source: r.source ?? ref.source ?? null,
            // gameplay
            dmg1: ref.dmg1, dmg2: ref.dmg2, dmgType: ref.dmgType, range: ref.range,
            properties: ref.properties,
            damageText: ref.damageText,
            rangeText: ref.rangeText,
            propertiesText: ref.propertiesText,
            attunementText: ref.attunementText,
            // text
            loreShort: ref.loreShort,
            loreFull: ref.loreFull,
            rulesShort: ref.rulesShort,
            rulesFull: ref.rulesFull,
          };
        });

        if (alive) setItems(merged);
      } catch (e) {
        if (alive) setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(it => {
      const hay = [
        it.item_name, it.item_type, it.item_rarity, it.item_description, it.item_cost, it.item_weight,
        it.type, it.rarity, it.slot, it.source,
        it.damageText, it.rangeText, it.propertiesText,
        it.loreFull, it.rulesFull
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
        <button className="btn btn-outline-secondary" onClick={() => setQ("")} disabled={!q}>Clear</button>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}
      {loading && <div className="text-muted">Loading items…</div>}
      {!loading && filtered.length === 0 && <div className="text-muted">No items found.</div>}

      <div className="row">
        {filtered.map((it, i) => (
          <div key={it.id || `${it.item_name}-${i}`} className="col-12 col-md-6 col-lg-4">
            <ItemCard item={it} modalId={`modal-item-${it.id || i}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

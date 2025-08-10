import React, { useId } from "react";

/**
 * SItemCard-styled ItemCard
 * - Works with catalog JSON items and Supabase inventory rows.
 * - Pure Bootstrap + SCSS (see globals.scss additions).
 */
export default function ItemCard({ item = {}, onMore }) {
  // Normalize shapes
  const norm = {
    image:
      item.image_url || item.img || item.image || "/placeholder.png",
    name:
      item.item_name || item.name || "Unnamed Item",
    type:
      item.item_type || item.type || "Wondrous Item",
    rarity:
      item.item_rarity || item.rarity || "Common",
    // "general/flavor" vs "rules" text
    general:
      item.flavor || item.short_description || item.summary || null,
    rules:
      item.rules || item.item_description || item.description || null,
    slot:
      item.slot || item.item_slot || null,
    cost:
      item.item_cost ?? item.cost ?? null,
    weight:
      item.item_weight ?? item.weight ?? null,
    source:
      item.source || item.item_source || null,
    attunement:
      item.attunement || item.requires_attunement || item.attunement_text || null,
    charges:
      item.charges ?? item.item_charges ?? null,
    kaorti:
      item.kaorti ?? item.tags ?? null,
  };

  // Fallback attunement detection
  if (!norm.attunement) {
    const text = [norm.rules, norm.general].filter(Boolean).join(" ").toLowerCase();
    if (text.includes("requires attunement")) norm.attunement = "Requires attunement";
  }

  // If general missing but we have long rules, make a short preview
  if (!norm.general && typeof norm.rules === "string") {
    const firstLine = norm.rules.split(/\n+/)[0];
    norm.general = firstLine.length > 140 ? firstLine.slice(0, 137) + "…" : firstLine;
  }

  const rarityClass = `rarity-${(norm.rarity || "Common").toString().toLowerCase().replace(/\s+/g, "-")}`;
  const modalId = useId().replace(/:/g, "_");
  const dash = (v) => (v === null || v === undefined || v === "" ? "—" : v);

  return (
    <div className={`card sitem-card h-100 ${rarityClass}`}>
      {/* Header banner */}
      <div className="sitem-header">
        <div className="sitem-header-inner">
          <span className="sitem-title">{norm.name}</span>
        </div>
      </div>

      <div className="card-body">
        {/* Rarity / Attunement line */}
        <div className="sitem-meta text-center mb-2">
          <span className="sitem-rarity">{norm.rarity}</span>
          {norm.attunement ? <span className="sitem-attune"> / {norm.attunement}</span> : null}
          {norm.charges != null ? <span className="ms-1 small text-muted">({norm.charges} charges)</span> : null}
          {norm.kaorti ? <span className="badge bg-dark-subtle ms-2 text-body-secondary">Kaorti</span> : null}
        </div>

        {/* Body two-column */}
        <div className="row g-2 align-items-start">
          <div className="col-8">
            <div className="sitem-section sitem-desc">
              {dash(norm.general)}
            </div>
          </div>
          <div className="col-4">
            <div className="sitem-thumb ratio ratio-1x1">
              <img
                src={norm.image}
                alt={norm.name}
                className="img-fluid object-fit-cover rounded"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* Rules block */}
        <div className="sitem-section sitem-rules mt-2" style={{ whiteSpace: "pre-line" }}>
          {dash(norm.rules)}
        </div>

        {/* Footer row: stats + More */}
        <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
          <div className="d-flex gap-2 align-items-center">
            <span className="badge bg-warning text-dark">{dash(norm.cost)} gp</span>
            <span className="badge bg-dark-subtle text-body-secondary">{dash(norm.weight)} lbs</span>
            {norm.slot ? <span className="badge bg-secondary">Slot: {norm.slot}</span> : null}
            {norm.source ? <span className="badge bg-secondary">{norm.source}</span> : null}
          </div>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            data-bs-toggle="modal"
            data-bs-target={`#modal_${modalId}`}
            onClick={() => onMore?.(item)}
          >
            More Info
          </button>
        </div>
      </div>

      {/* Footer banner */}
      <div className="sitem-footer">
        <span className="sitem-type">{norm.type}</span>
      </div>

      {/* Modal */}
      <div className="modal fade" id={`modal_${modalId}`} tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className={`modal-header border-0 ${rarityClass}`}>
              <h5 className="modal-title">{norm.name}</h5>
              <button className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12 col-md-5">
                  <div className="ratio ratio-1x1 bg-body-tertiary rounded">
                    <img
                      src={norm.image}
                      alt={norm.name}
                      className="img-fluid object-fit-contain p-2 rounded"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="col-12 col-md-7">
                  <div className="mb-2">
                    <span className="badge me-2">{norm.rarity}</span>
                    <span className="text-muted">{norm.type}</span>
                    {norm.slot && <span className="text-muted"> • Slot: {norm.slot}</span>}
                    {norm.attunement && <div className="small fst-italic text-danger-emphasis">{norm.attunement}</div>}
                    {norm.charges != null && <div className="small text-muted">{norm.charges} charges</div>}
                    {norm.kaorti && <div className="small"><span className="badge bg-dark-subtle text-body-secondary">Kaorti</span></div>}
                  </div>
                  <div className="mb-2" style={{ whiteSpace: "pre-line" }}>
                    {norm.general}
                  </div>
                  <hr />
                  <div style={{ whiteSpace: "pre-line" }}>
                    {norm.rules}
                  </div>
                  <div className="mt-3 d-flex gap-2">
                    <span className="badge bg-warning text-dark">{dash(norm.cost)} gp</span>
                    <span className="badge bg-dark-subtle text-body-secondary">{dash(norm.weight)} lbs</span>
                    {norm.source && <span className="badge bg-secondary">{norm.source}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer border-0">
              <button className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

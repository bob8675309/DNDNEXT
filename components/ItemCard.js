// /components/ItemCard.js
import React, { useId } from "react";

const TYPE_MAP = {
  // 5eTools style codes → friendly text
  A: "Ammunition",
  AT: "Artisan’s Tools",
  G: "Adventuring Gear",
  GS: "Gaming Set",
  INS: "Instrument",
  LA: "Light Armor",
  MA: "Medium Armor",
  HA: "Heavy Armor",
  M: "Melee Weapon",
  R: "Ranged Weapon",
  S: "Shield",
  SCF: "Spellcasting Focus",
  P: "Potion",
  RD: "Rod",
  RG: "Ring",
  WD: "Wand",
  ST: "Staff",
  W: "Wondrous Item",
  T: "Tool",
};

function titleCase(s) {
  return (s || "").replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
}

function unitToGp(unit) {
  switch ((unit || "").toLowerCase()) {
    case "pp": return 10;
    case "gp": return 1;
    case "sp": return 0.1;
    case "cp": return 0.01;
    default: return 1;
  }
}

function parseValueToGp(v) {
  // Accept number = gp; or {amount, unit}; or string like "2500 gp"
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = v.trim().match(/([\d,.]+)\s*(pp|gp|sp|cp)?/i);
    if (m) {
      const amount = Number(m[1].replace(/,/g, ""));
      const mult = unitToGp(m[2] || "gp");
      return Math.round(amount * mult * 100) / 100;
    }
    return null;
  }
  if (typeof v === "object") {
    const amount = Number(v.amount ?? v.value ?? v.qty ?? 0);
    const mult = unitToGp(v.unit ?? v.currency ?? "gp");
    if (!isFinite(amount)) return null;
    return Math.round(amount * mult * 100) / 100;
  }
  return null;
}

function flattenEntries(entries) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === "string") { out.push(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.entries) { walk(node.entries); return; }
    if (node.items) { walk(node.items); return; }
    if (node.entry) { walk(node.entry); return; }
    if (node.name && node.entries) { out.push(`${node.name}. ${[].concat(node.entries).join(" ")}`); return; }
    if (node.name && node.entry) { out.push(`${node.name}. ${[].concat(node.entry).join(" ")}`); return; }
  };
  walk(entries);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export default function ItemCard({ item = {}, onMore }) {
  // --- normalize 5eTools + your previous shapes
  const typeRaw = item.item_type || item.type;
  const typePretty = TYPE_MAP[typeRaw] || (typeof typeRaw === "string" ? titleCase(typeRaw) : "Wondrous Item");

  const entriesText = item.entries ? flattenEntries(item.entries) : null;
  const longText = item.item_description || item.description || entriesText || item.flavor || "";
  const [general, ...rest] = longText.split(/\n\s*\n/);
  const rulesText = rest.join("\n\n");

  let attune = item.attunement || item.requires_attunement || null;
  if (attune == null && item.reqAttune != null) {
    attune = item.reqAttune === true ? "Requires attunement" :
             typeof item.reqAttune === "string" ? `Requires attunement ${item.reqAttune}` : null;
  }
  if (!attune && longText.toLowerCase().includes("requires attunement")) {
    attune = "Requires attunement";
  }

  const gp = parseValueToGp(item.item_cost ?? item.cost ?? item.value);
  const weight = item.item_weight ?? item.weight ?? null;

  const norm = {
    image: item.image_url || item.img || item.image || "/placeholder.png",
    name: item.item_name || item.name || "Unnamed Item",
    type: typePretty,
    rarity: titleCase(item.item_rarity || item.rarity || "Common"),
    general: general || "—",
    rules: rulesText || "—",
    slot: item.slot || item.item_slot || null,
    cost: gp != null ? gp : "—",
    weight: weight != null ? weight : "—",
    source: item.source || item.item_source || "DMG",
    attunement: attune,
    charges: item.charges ?? item.item_charges ?? null,
    kaorti: item.kaorti ?? (Array.isArray(item.tags) && item.tags.includes("Kaorti")),
  };

  const rarityClass = `rarity-${(norm.rarity || "Common").toLowerCase().replace(/\s+/g, "-")}`;
  const modalId = useId().replace(/:/g, "_");

  return (
    <div className={`card sitem-card h-100 ${rarityClass}`}>
      {/* Header */}
      <div className="sitem-header">
        <div className="sitem-header-inner">
          <span className="sitem-title">{norm.name}</span>
        </div>
      </div>

      <div className="card-body">
        <div className="sitem-meta text-center mb-2">
          <span className="sitem-rarity">{norm.rarity}</span>
          {norm.attunement ? <span className="sitem-attune"> / {norm.attunement}</span> : null}
          {norm.charges != null ? <span className="ms-1 small text-muted">({norm.charges} charges)</span> : null}
          {norm.kaorti ? <span className="badge bg-dark-subtle ms-2 text-body-secondary">Kaorti</span> : null}
        </div>

        <div className="row g-2 align-items-start">
          <div className="col-8">
            <div className="sitem-section sitem-desc">{norm.general}</div>
          </div>
          <div className="col-4">
            <div className="sitem-thumb ratio ratio-1x1">
              <img src={norm.image} alt={norm.name} className="img-fluid object-fit-cover rounded" loading="lazy" />
            </div>
          </div>
        </div>

        <div className="sitem-section sitem-rules mt-2" style={{ whiteSpace: "pre-line" }}>
          {norm.rules}
        </div>

        <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
          <div className="d-flex gap-2 align-items-center">
            <span className="badge bg-warning text-dark">{norm.cost} gp</span>
            <span className="badge bg-dark-subtle text-body-secondary">{norm.weight} lbs</span>
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

      <div className="sitem-footer">
        <span className="sitem-type text-truncate w-100 d-inline-block">{norm.type}</span>
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
                    <img src={norm.image} alt={norm.name} className="img-fluid object-fit-contain p-2 rounded" loading="lazy" />
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
                  <div className="mb-2" style={{ whiteSpace: "pre-line" }}>{norm.general}</div>
                  <hr />
                  <div style={{ whiteSpace: "pre-line" }}>{norm.rules}</div>
                  <div className="mt-3 d-flex gap-2">
                    <span className="badge bg-warning text-dark">{norm.cost} gp</span>
                    <span className="badge bg-dark-subtle text-body-secondary">{norm.weight} lbs</span>
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

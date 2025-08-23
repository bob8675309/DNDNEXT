// components/ItemCard.js
import React, { useId } from "react";
import { classifyUi, titleCase } from "../utils/itemsIndex";

/* ---------- Local helpers ---------- */
const humanRarity = (r) => (String(r || "").toLowerCase() === "none" ? "Mundane" : titleCase(r || "Common"));

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
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = v.trim().match(/([\d,.]+)\s*(pp|gp|sp|cp)?/i);
    if (!m) return null;
    const amount = Number(m[1].replace(/,/g, ""));
    const mult = unitToGp(m[2] || "gp");
    return Math.round(amount * mult * 100) / 100;
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

/* ---------- Stat helpers ---------- */
const DMG = { P:"piercing", S:"slashing", B:"bludgeoning", R:"radiant", N:"necrotic", F:"fire", C:"cold", L:"lightning", A:"acid", T:"thunder", Psn:"poison", Psy:"psychic", Frc:"force" };
const PROP = { L:"Light", F:"Finesse", H:"Heavy", R:"Reach", T:"Thrown", V:"Versatile", "2H":"Two-Handed", A:"Ammunition", LD:"Loading", S:"Special", RLD:"Reload" };
const stripTag = (s) => String(s || "").split("|")[0];
const buildDamageText = (d1, dt, d2, props) => {
  const base = d1 ? `${d1} ${DMG[dt] || dt || ""}`.trim() : "";
  const vers = (props || []).includes("V") && d2 ? `versatile (${d2})` : "";
  return [base, vers].filter(Boolean).join("; ");
};
const buildRangeText = (range, props) => {
  const r = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if ((props || []).includes("T")) return r ? `Thrown ${r} ft.` : "Thrown";
  return r ? `${r} ft.` : "";
};
const humanProps = (props = []) => props.map((p) => PROP[stripTag(p)] || stripTag(p)).join(", ");

/** targeted sensory lines (battleaxe, dagger, etc.) */
function flavorFallback(item, uiType) {
  const n = item.name || item.item_name || "This item";
  if (/\bbattleaxe\b/i.test(n)) {
    return `${n} is all business: a handspan of iron on a stout ash haft, a crescent that bites and a bearded heel that hooks. The edge shows a hundred small repairs—bright hone lines against darker steel.`;
  }
  if (/\bdagger\b/i.test(n)) {
    return `${n} sits light and eager in the palm; the narrow blade flashes quick, the leather wrap smelling faintly of oil.`;
  }
  // generic per-bucket
  const rare = String(item.rarity || item.item_rarity || "common").toLowerCase();
  switch (uiType) {
    case "Melee Weapon":
    case "Ranged Weapon":
      return `${n} is a ${rare} ${uiType.toLowerCase()}—balanced in the hand with well-worn grips and the quiet scent of steel.`;
    case "Armor":
      return `${n} shows careful stitching and honest scuffs; bright where polished, dark where use has dulled it.`;
    case "Shield":
      return `${n} bears layered gouges—proof of blocks taken square and true.`;
    case "Wondrous Item":
      return `${n} carries a hush of old magic, cool to the touch with a faint hum when lifted.`;
    default:
      return `${n} looks and feels authentic, ready for use.`;
  }
}

/* ---------- Card ---------- */
export default function ItemCard({ item = {}, onMore }) {
  const { uiType, uiSubKind } = classifyUi(item);
  const isMundane = String(item.rarity || item.item_rarity || "").toLowerCase() === "none";

  // FLAVOR (top-left): if the item supplies flavor use it; for mundane items use `entries` as flavor;
  // for magic items keep entries for RULES and synthesize a sensory flavor.
  const entriesText = item.entries ? flattenEntries(item.entries) : "";
  const flavorText =
    item.flavor ||
    (isMundane ? entriesText : "") ||
    flavorFallback(item, uiType);

  // RULES (lower long box): prefer item_description; otherwise for magic items use entries as rules.
  const rulesRaw =
    item.item_description ||
    (!isMundane ? entriesText : "") ||
    item.description ||
    "";
  const [rulesFirst, ...rulesRest] = String(rulesRaw).split(/\n\s*\n/);
  const rulesText = [rulesFirst, ...rulesRest].filter(Boolean).join("\n\n");

  // Attunement heuristics
  let attune = item.attunement || item.requires_attunement || item.attunementText || null;
  if (attune == null && item.reqAttune != null) {
    attune = item.reqAttune === true ? "Requires attunement"
      : typeof item.reqAttune === "string" ? `Requires attunement ${item.reqAttune}` : null;
  }
  if (!attune && (flavorText + rulesText).toLowerCase().includes("requires attunement")) {
    attune = "Requires attunement";
  }

  // Econ / stats
  const gp = parseValueToGp(item.item_cost ?? item.cost ?? item.value);
  const weight = item.item_weight ?? item.weight ?? null;
  const propsList = (item.property || item.properties || []).map(stripTag);
  const mastery = Array.isArray(item.mastery) ? item.mastery.map(stripTag) : [];
  const damage = item.damageText || buildDamageText(item.dmg1, item.dmgType, item.dmg2, propsList);
  const range = item.rangeText || buildRangeText(item.range, propsList);
  const baseProps = item.propertiesText || humanProps(propsList);
  const propsText = baseProps + (mastery.length ? (baseProps ? "; " : "") + `Mastery: ${mastery.join(", ")}` : "");
  const acText = item.ac != null ? String(item.ac) : "";

  // Normalized fields
  const rarity = humanRarity(item.item_rarity ?? item.rarity);
  const norm = {
    image: item.image_url || item.img || item.image || "/placeholder.png",
    name: item.item_name || item.name || "Unnamed Item",
    type: uiType || titleCase(stripTag(item.type || item.item_type || "Item")),
    typeHint: uiType === "Wondrous Item" ? uiSubKind : null,
    rarity,
    flavor: flavorText || "—",
    rules: rulesText || "—",
    slot: item.slot || item.item_slot || null,
    cost: gp,
    weight: weight != null ? weight : null,
    source: item.source || item.item_source || "",
    attunement: attune,
    charges: item.charges ?? item.item_charges ?? null,
    kaorti: item.kaorti ?? (Array.isArray(item.tags) && item.tags.includes("Kaorti")),
    dmg: damage || "—",
    rng: range || "—",
    props: propsText || "—",
    ac: acText || "—",
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
        {/* Rarity / attunement */}
        <div className="sitem-meta text-center mb-2">
          <span className="sitem-rarity">{norm.rarity}</span>
          <span className="sitem-attune"> {norm.attunement ? `/ ${norm.attunement}` : "/ —"}</span>
          {norm.charges != null && <span className="ms-1 small text-muted">({norm.charges} charges)</span>}
          {norm.kaorti && <span className="badge bg-dark-subtle ms-2 text-body-secondary">Kaorti</span>}
        </div>

        {/* Top row: FLAVOR + image */}
        <div className="row g-2 align-items-start">
          <div className="col-8">
            <div className="sitem-section sitem-desc" style={{ whiteSpace: "pre-line" }}>
              {norm.flavor}
            </div>
          </div>
          <div className="col-4">
            <div className="sitem-thumb ratio ratio-1x1">
              <img src={norm.image} alt={norm.name} className="img-fluid object-fit-cover rounded" loading="lazy" />
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="sitem-section sitem-rules mt-2" style={{ whiteSpace: "pre-line" }}>
          {norm.rules}
        </div>

        {/* Stats row */}
        <div className="row g-2 mt-2">
          <div className="col-12 col-md-6">
            <div className="sitem-section">
              <div className="small text-muted mb-1">Damage</div>
              <div className="text-wrap">{norm.dmg}</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="sitem-section text-end">
              <div className="small text-muted mb-1">Range</div>
              <div className="text-wrap">{norm.rng}</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="sitem-section text-end">
              <div className="small text-muted mb-1">AC</div>
              <div className="text-wrap">{norm.ac}</div>
            </div>
          </div>
          <div className="col-12">
            <div className="sitem-section">
              <div className="small text-muted mb-1">Properties</div>
              <div className="text-wrap">{norm.props}</div>
            </div>
          </div>
        </div>

        {/* Badges + More Info */}
        <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
          <div className="d-flex gap-2 align-items-center">
            <span className="badge bg-warning text-dark">{norm.cost != null ? `${norm.cost} gp` : "— gp"}</span>
            <span className="badge bg-dark-subtle text-body-secondary">{norm.weight != null ? `${norm.weight} lbs` : "— lbs"}</span>
            <span className="badge bg-secondary">{norm.type}{norm.typeHint ? ` • ${norm.typeHint}` : ""}</span>
            <span className="badge bg-secondary">{norm.source || "—"}</span>
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
        <span className="sitem-type text-truncate w-100 d-inline-block">
          {norm.type}{norm.typeHint ? ` • ${norm.typeHint}` : ""}
        </span>
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
                    {norm.typeHint && <span className="text-muted"> • {norm.typeHint}</span>}
                    <div className="small fst-italic text-danger-emphasis">{norm.attunement || "—"}</div>
                    {norm.charges != null && <div className="small text-muted">{norm.charges} charges</div>}
                    {item.kaorti && <div className="small"><span className="badge bg-dark-subtle text-body-secondary">Kaorti</span></div>}
                  </div>

                  <div className="mb-2" style={{ whiteSpace: "pre-line" }}>{norm.flavor}</div>
                  <hr />
                  <div style={{ whiteSpace: "pre-line" }}>{norm.rules}</div>

                  <hr />
                  <div className="row g-2">
                    <div className="col-6"><strong>Damage:</strong> {norm.dmg}</div>
                    <div className="col-6"><strong>Range:</strong> {norm.rng}</div>
                    <div className="col-6"><strong>AC:</strong> {norm.ac}</div>
                    <div className="col-12"><strong>Properties:</strong> {norm.props}</div>
                  </div>

                  <div className="mt-3 d-flex gap-2">
                    <span className="badge bg-warning text-dark">{norm.cost != null ? `${norm.cost} gp` : "— gp"}</span>
                    <span className="badge bg-dark-subtle text-body-secondary">{norm.weight != null ? `${norm.weight} lbs` : "— lbs"}</span>
                    <span className="badge bg-secondary">{norm.source || "—"}</span>
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

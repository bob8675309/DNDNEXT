import React from "react";

/* -----------------------------------------------------------
   Small, local helpers (kept here so nothing else breaks)
   ----------------------------------------------------------- */
const norm = (s = "") => String(s).toLowerCase().replace(/\s+/g, " ").trim();

// rarity → human text + key for data-rarity
const humanRarity = (r) => {
  const raw = norm(r);
  if (!raw || raw === "none" || raw === "mundane") return "Mundane";
  return r[0].toUpperCase() + String(r).slice(1);
};
const rarityKey = (r) => norm(humanRarity(r)).replace(/\s+/g, "-");

// Damage / range / properties text helpers
const DMG = {
  P: "piercing", S: "slashing", B: "bludgeoning", R: "radiant", N: "necrotic",
  F: "fire", C: "cold", L: "lightning", A: "acid", T: "thunder",
  Psn: "poison", Psy: "psychic", Frc: "force",
};
const PROP = {
  L: "Light", F: "Finesse", H: "Heavy", R: "Reach", T: "Thrown", V: "Versatile",
  "2H": "Two-Handed", A: "Ammunition", LD: "Loading", S: "Special", RLD: "Reload",
};

function humanProps(props = []) {
  return (props || []).map((p) => PROP[p] || p).join(", ");
}
function buildDamageText({ dmg1, dmgType, dmg2, property }) {
  const dt = DMG[dmgType] || dmgType || "";
  const base = dmg1 ? `${dmg1} ${dt}`.trim() : "";
  const versatile = (property || []).includes("V") && dmg2 ? `versatile (${dmg2})` : "";
  return [base, versatile].filter(Boolean).join("; ");
}
function buildRangeText({ range, property }) {
  if (!range && !(property || []).includes("T")) return "";
  const r = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if ((property || []).includes("T")) return r ? `Thrown ${r} ft.` : "Thrown";
  return r ? `${r} ft.` : "";
}

/* -----------------------------------------------------------
   ItemCard
   - Expects the merged shape you already use in Items / Merchant:
     { item_name, item_type, item_rarity, item_description, item_weight,
       item_cost, slot, source, image_url?, dmg1, dmg2, dmgType, range, property }
   - Also accepts `mini` but grid CSS handles size; we don’t switch content.
   ----------------------------------------------------------- */
export default function ItemCard({ item, mini = false }) {
  const name = item.item_name || item.name || "Item";
  const rarityText = humanRarity(item.item_rarity);
  const rarityAttr = rarityKey(item.item_rarity);

  // Prefer precomputed strings if you’ve added them elsewhere; otherwise synthesize.
  const damageText =
    item.damageText ||
    buildDamageText({
      dmg1: item.dmg1,
      dmgType: item.dmgType,
      dmg2: item.dmg2,
      property: item.property,
    });

  const rangeText =
    item.rangeText ||
    buildRangeText({ range: item.range, property: item.property });

  const propsText =
    item.propertiesText || humanProps(item.property || []);

  const hasStats = !!(damageText || rangeText || propsText);

  const typeText = item.item_type || item.type || "—";
  const costText = item.item_cost || "—";
  const weightText = item.item_weight || "—";
  const slotText = item.slot ? `Slot: ${item.slot}` : null;
  const sourceText = item.source || null;

  const rulesText =
    item.item_description ||
    item.description ||
    (item.card_payload && (item.card_payload.rulesFull || item.card_payload.description)) ||
    "—";

  const flavorText =
    item.flavor ||
    (item.card_payload && (item.card_payload.flavor || item.card_payload.loreFull)) ||
    "";

  const img = item.image_url || (item.card_payload && item.card_payload.image_url) || "";

  return (
    <div className="card sitem-card mb-3" data-rarity={rarityAttr} aria-label={`${name} card`}>
      {/* Header */}
      <div className="card-header sitem-header d-flex align-items-center justify-content-between">
        <div className="sitem-title">{name}</div>
        {/* right-side pill: use type; keep the class the same you had before */}
        <span className="badge text-bg-secondary ms-2">
          {typeText}
        </span>
      </div>

      {/* Subheader: rarity line */}
      <div className="px-3 pt-2 text-center text-muted" style={{ fontStyle: "italic" }}>
        {rarityText.toLowerCase()}
      </div>

      {/* Body */}
      <div className="card-body">
        <div className="row g-3">
          {/* FLAVOR (left) */}
          <div className={`col-12 ${img ? "col-lg-7" : "col-lg-12"}`}>
            {flavorText ? (
              <div className="sitem-section">
                <div className="text-wrap">{flavorText}</div>
              </div>
            ) : null}
            {/* Rules / description */}
            <div className="sitem-section mt-2">
              <div className="small text-muted mb-1">Description</div>
              <div className="text-wrap">{rulesText}</div>
            </div>
          </div>

          {/* IMAGE (right) */}
          {img ? (
            <div className="col-12 col-lg-5">
              <div
                className="sitem-section d-flex align-items-center justify-content-center"
                style={{
                  minHeight: 160,
                  background: "rgba(0,0,0,.1)",
                  borderRadius: ".5rem",
                }}
              >
                {/* keep img optional; don’t break layout if fails */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={`${name} illustration`}
                  style={{ maxWidth: "100%", maxHeight: 240, objectFit: "contain" }}
                />
              </div>
            </div>
          ) : null}

          {/* Stats strip */}
          {hasStats ? (
            <div className="col-12">
              <div className="sitem-section">
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <div className="small text-muted mb-1">Damage</div>
                    <span className="badge rounded-pill text-bg-dark">
                      {damageText || "—"}
                    </span>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="small text-muted mb-1">Range / AC</div>
                    <span className="badge rounded-pill text-bg-dark">
                      {rangeText || "—"}
                    </span>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="small text-muted mb-1">Properties</div>
                    <span className="badge rounded-pill text-bg-dark">
                      {propsText || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Cost / Weight */}
          <div className="col-6">
            <div className="sitem-section d-flex justify-content-between align-items-center">
              <div className="small text-muted me-2">Cost</div>
              <span className="badge rounded-pill text-bg-dark">{costText}</span>
            </div>
          </div>
          <div className="col-6">
            <div className="sitem-section d-flex justify-content-between align-items-center">
              <div className="small text-muted me-2">Weight</div>
              <span className="badge rounded-pill text-bg-dark">{weightText}</span>
            </div>
          </div>

          {/* Slot / Source pills */}
          <div className="col-12 d-flex flex-wrap gap-2">
            {slotText ? (
              <span className="badge text-bg-secondary">{slotText}</span>
            ) : (
              <span className="badge text-bg-secondary">Slot: —</span>
            )}
            {sourceText ? (
              <span className="badge text-bg-secondary">{sourceText}</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Footer (kept minimal; same class so your styles apply) */}
      <div className="card-footer sitem-footer">
        {/* Reserved for action buttons in contexts that need them */}
      </div>
    </div>
  );
}

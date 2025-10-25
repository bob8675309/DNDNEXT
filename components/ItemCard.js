// components/ItemCard.js
// Drop-in replacement — keeps your existing markup/classes and adds a rarity accent.
// - Backward compatible with callers: <ItemCard item={...} mini />
// - Preserves .sitem-card / .sitem-header / .sitem-section / .sitem-footer classes
// - Uses enriched fields if present (damageText, rangeText, propertiesText)
// - Non-invasive rarity band: header stripe + soft outer ring via inline style only

import React from "react";

// ---- tiny helpers (mirrors utils/itemsIndex where possible) -----------------
const DMG = { P:"piercing", S:"slashing", B:"bludgeoning", R:"radiant", N:"necrotic", F:"fire", C:"cold", L:"lightning", A:"acid", T:"thunder", Psn:"poison", Psy:"psychic", Frc:"force" };
const PROP = { L:"Light", F:"Finesse", H:"Heavy", R:"Reach", T:"Thrown", V:"Versatile", "2H":"Two-Handed", A:"Ammunition", LD:"Loading", S:"Special", RLD:"Reload" };
const humanProps = (props = []) => props.map((p) => PROP[p] || p).join(", ");
const buildDamageText = (d1, dt, d2, props) => {
  const dtype = DMG[dt] || dt || "";
  const base = d1 ? `${d1} ${dtype}`.trim() : "";
  const versatile = props?.includes?.("V") && d2 ? `versatile (${d2})` : "";
  return [base, versatile].filter(Boolean).join("; ");
};
const buildRangeText = (range, props) => {
  if (!range && !props?.includes?.("T")) return "";
  const r = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if (props?.includes?.("T")) return r ? `Thrown ${r} ft.` : "Thrown";
  return r ? `${r} ft.` : "";
};

// ---- rarity styling (no global CSS required) --------------------------------
const rarityKey = (r) => String(r || "").toLowerCase();
const RARITY_THEME = {
  mundane:   { ring: "rgba(120,120,140,.25)", bar: "#6b7280", text: "mundane" },
  common:    { ring: "rgba(180,180,200,.35)", bar: "#8b8fa6", text: "common" },
  uncommon:  { ring: "rgba(99,102,241,.25)",  bar: "#7c83ff", text: "uncommon" },
  rare:      { ring: "rgba(56,189,248,.28)",  bar: "#38bdf8", text: "rare" },
  "very rare": { ring: "rgba(251,191,36,.28)", bar: "#fbbf24", text: "very rare" },
  legendary: { ring: "rgba(245,158,11,.28)",  bar: "#f59e0b", text: "legendary" },
  artifact:  { ring: "rgba(234,179,8,.32)",   bar: "#eab308", text: "artifact" },
};
const themeFromRarity = (r) => RARITY_THEME[rarityKey(r)] || RARITY_THEME.mundane;

// ---- Stats strip -------------------------------------------------------------
function StatsStrip({ item }) {
  const damageText = item.damageText || buildDamageText(item.dmg1, item.dmgType, item.dmg2, item.property);
  const rangeText  = item.rangeText  || buildRangeText(item.range, item.property);
  const propsText  = item.propertiesText || humanProps(item.property || []);

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
            <div className="small text-muted mb-1">Range / AC</div>
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

// ---- Main Card ---------------------------------------------------------------
export default function ItemCard({ item = {}, mini = false }) {
  const name   = item.item_name || item.name || "Item";
  const type   = item.item_type || item.type || "—";
  const rarity = item.item_rarity || item.rarity || "mundane";
  const desc   = item.item_description || item.description || item.rulesFull || item.loreFull || "—";
  const cost   = item.item_cost || item.cost || item.price || "—";
  const weight = item.item_weight ?? item.weight ?? "—";
  const slot   = item.slot || item.item_slot || null;
  const source = item.source || item.book || null;

  const th = themeFromRarity(rarity);

  // Subtle soft outer ring + header stripe
  const cardStyle = {
    boxShadow: `0 0 0 2px rgba(0,0,0,.2), 0 0 0 6px ${th.ring}`,
    borderRadius: "12px",
  };
  const barStyle = {
    height: 3,
    background: th.bar,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  };

  return (
    <div className={`card sitem-card ${mini ? "mini" : ""}`} style={cardStyle}>
      {/* Header */}
      <div style={barStyle} />
      <div className="card-header sitem-header d-flex align-items-center justify-content-between">
        <div className="sitem-title">{name}</div>
        <div className="d-flex align-items-center gap-2">
          <span className="badge text-bg-secondary text-uppercase">{(type || "—")}</span>
          <span className="badge text-bg-dark">{String(rarity).toLowerCase()}</span>
        </div>
      </div>

      {/* Body */}
      <div className="card-body">
        <div className="row g-3">
          {/* Top description block */}
          <div className="col-12 col-lg-8">
            <div className="sitem-section">
              <div className="small text-muted mb-1">Description</div>
              <div className="text-wrap">{desc}</div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            {/* Reserved for art/image if you wire it later; keep placeholder for layout stability */}
            <div className="sitem-section" style={{minHeight: 120}}>
              <div className="small text-muted mb-1">Image</div>
              <div className="bg-dark bg-opacity-25 rounded w-100 h-100" />
            </div>
          </div>

          {/* Stats strip (damage/range/properties) */}
          <div className="col-12">
            <StatsStrip item={item} />
          </div>

          {/* Cost / Weight */}
          <div className="col-6">
            <div className="sitem-section d-flex justify-content-between align-items-center">
              <div className="small text-muted me-2">Cost</div>
              <span className="badge rounded-pill text-bg-dark">{cost}</span>
            </div>
          </div>
          <div className="col-6">
            <div className="sitem-section d-flex justify-content-between align-items-center">
              <div className="small text-muted me-2">Weight</div>
              <span className="badge rounded-pill text-bg-dark">{weight}</span>
            </div>
          </div>

          {/* Misc pills (slot/source) */}
          {(slot || source) && (
            <div className="col-12 d-flex flex-wrap gap-2">
              {slot && <span className="badge text-bg-secondary">{`Slot: ${slot}`}</span>}
              {source && <span className="badge text-bg-secondary">{source}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Footer (kept for actions; unchanged so existing buttons still work) */}
      <div className="card-footer sitem-footer">
        <div className="d-flex align-items-center justify-content-end gap-2">
          {/* Intentionally simple — your callers can inject actions next to Buy, etc. */}
        </div>
      </div>
    </div>
  );
}

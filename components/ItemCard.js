// components/ItemCard.js
import React, { useEffect, useState } from "react";
import { classifyUi, titleCase } from "../utils/itemsIndex";
import { loadFlavorIndex } from "../utils/flavorIndex";

/* ---------- Local helpers ---------- */
const humanRarity = (r) =>
  (String(r || "").toLowerCase() === "none" ? "Mundane" : titleCase(r || "Common"));

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
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)?$/i);
    if (m) return parseFloat(m[1]) * unitToGp(m[2] || "gp");
  }
  if (typeof v === "object" && v?.amount != null) {
    return Number(v.amount) * unitToGp(v.unit || "gp");
  }
  return null;
}

/** Legacy: flatten complex `entries` structures to text (for flavor fallback only) */
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
  if (!range && !props?.includes?.("T")) return "";
  const r = range ? String(range).replace(/ft\.?$/i, "").trim() : "";
  if (props?.includes?.("T")) return r ? `Thrown ${r} ft.` : "Thrown";
  return r ? `${r} ft.` : "";
};

/* ---------- Card ---------- */
export default function ItemCard({ item = {} }) {
  const { uiType, uiSubKind } = classifyUi(item);

  // Flavor overrides (exact-name index)
  const [flavorIndex, setFlavorIndex] = useState(null);
  useEffect(() => {
    let ok = true;
    loadFlavorIndex().then((idx) => ok && setFlavorIndex(idx)).catch(() => {});
    return () => { ok = false; };
  }, []);

  // Builder bullets (keep only if we don't have item_description)
  const pureStringBullets =
    Array.isArray(item.entries) && item.entries.every((e) => typeof e === "string")
      ? item.entries
      : null;

  const entriesText = flattenEntries(item.entries);

  /* ---------- FLAVOR (top-left) ---------- */
  // Priority: flavor-overrides → item.flavor → flattened `entries` → ""
  const overrideFlavor =
    (flavorIndex && flavorIndex.get(item.item_name || item.name)) || null;
  const flavorText = overrideFlavor || item.flavor || entriesText || "";

  /* ---------- RULES (main text) ---------- */
  // Priority: item_description → builder bullets → "—"
  const hasItemDescription = !!item.item_description;

  /* ---------- Econ + Stats ---------- */
  const gp = parseValueToGp(item.item_cost ?? item.cost ?? item.value);
  const weight = item.item_weight ?? item.weight ?? null;

  const propsList = (item.property || item.properties || []).map(stripTag).filter((p) => p !== "AF");
  const mastery = Array.isArray(item.mastery) ? item.mastery.map(stripTag) : [];

  const damage = item.damageText || buildDamageText(item.dmg1, item.dmgType, item.dmg2, propsList);
  const range = item.rangeText || buildRangeText(item.range, propsList);

  const baseProps =
-   (item.propertiesText ?? null) ??
+   (typeof item.propertiesText === "string" ? item.propertiesText : null) ??
    (propsList.length ? propsList.map((p) => PROP[p] || p).join(", ") : "");

  const propsText = [
    baseProps || "",
    mastery.length ? `Mastery: ${mastery.join(", ")}` : ""
  ].filter(Boolean).join("; ");

  const acText = item.ac != null ? String(item.ac) : "";

  /* ---------- Normalized fields ---------- */
  const rarityRaw = item.item_rarity ?? item.rarity;
  const rarity = (String(rarityRaw || "").toLowerCase() === "none" ? "Mundane" : titleCase(rarityRaw || "Common"));

  const norm = {
    image: item.image_url || item.img || item.image || "/placeholder.png",
    name: item.item_name || item.name || "Unnamed Item",
    type: uiType || titleCase(stripTag(item.type || item.item_type || "Item")),
    typeHint: uiType === "Wondrous Item" ? uiSubKind : null,
    rarity,
    flavor: flavorText || "—",
    cost: gp,
    weight: weight != null ? weight : null,
    source: item.source || item.item_source || "",
    charges: item.charges ?? item.item_charges ?? null,
    kaorti: item.kaorti ?? (Array.isArray(item.tags) && item.tags.includes("Kaorti")),
    dmg: damage || "—",
    rng: range || "—",
    props: propsText || "—",
    ac: acText || "—"
  };

  const rarityClass = `rarity-${(norm.rarity || "Common").toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="card sitem-card mb-4">
      <div className={`card-header sitem-header d-flex align-items-center justify-content-between ${rarityClass}`}>
        <div className="sitem-title fw-semibold">{norm.name}</div>
        <div className="sitem-type small text-uppercase">
          {norm.type}{norm.typeHint ? ` • ${norm.typeHint}` : ""}
        </div>
      </div>

      <div className="card-body">
        {/* Meta line */}
        <div className="sitem-meta text-center mb-2">
          <span className="sitem-rarity">{norm.rarity}</span>
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
              <img
                src={norm.image}
                alt={norm.name}
                className="img-fluid object-fit-cover rounded"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* RULES */}
        <div
          className="sitem-section sitem-rules mt-2"
          style={{ whiteSpace: hasItemDescription ? "pre-line" : (pureStringBullets ? "normal" : "pre-line") }}
        >
          {hasItemDescription ? (
            item.item_description
          ) : pureStringBullets ? (
            <ul className="mb-0">
              {pureStringBullets.map((ln, i) => <li key={i}>{ln}</li>)}
            </ul>
          ) : (
            "—"
          )}
        </div>

        {/* Stats row */}
        <div className="row g-2 mt-2">
          <div className="col-12 col-md-6">
            <div className="sitem-section">
              <div className="small text-muted mb-1">Damage</div>
              <div className="text-wrap">{norm.dmg}</div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="sitem-section">
              <div className="small text-muted mb-1">Range / AC</div>
              <div className="text-wrap">{norm.rng || norm.ac}</div>
            </div>
          </div>

          <div className="col-12">
            <div className="sitem-section">
              <div className="small text-muted mb-1">Properties</div>
              <div className="text-wrap">{norm.props}</div>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="d-flex justify-content-between align-items-center mt-2">
          <div className="d-flex gap-2">
            <span className="badge text-bg-dark">{norm.cost != null ? `${norm.cost} gp` : "— gp"}</span>
            <span className="badge text-bg-dark">{norm.weight != null ? `${norm.weight} lbs` : "— lbs"}</span>
            <span className="badge text-bg-dark">{norm.type}{norm.typeHint ? ` • ${norm.typeHint}` : ""}</span>
            {norm.source && <span className="badge text-bg-secondary">{norm.source}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

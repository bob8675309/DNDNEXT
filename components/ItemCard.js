// components/ItemCard.js
import React, { useEffect, useState } from "react";
import { classifyUi, titleCase } from "../utils/itemsIndex";
import { loadFlavorIndex } from "../utils/flavorIndex";

/* ---------- helpers ---------- */
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

/** Flatten builder-style entries to plain text (fallback flavor) */
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

/* --------- stat builders with LOTS of fallbacks --------- */
const DMG_TEXT = { P:"piercing", S:"slashing", B:"bludgeoning", R:"radiant", N:"necrotic", F:"fire", C:"cold", L:"lightning", A:"acid", T:"thunder", Psn:"poison", Psy:"psychic", Frc:"force" };
const PROP_SHORT = { L:"Light", F:"Finesse", H:"Heavy", R:"Reach", T:"Thrown", V:"Versatile", "2H":"Two-Handed", A:"Ammunition", LD:"Loading", S:"Special", RLD:"Reload" };
const stripTag = (s) => String(s || "").split("|")[0];

function coalesce(...vals) {
  for (const v of vals) if (v != null) return v;
  return null;
}

function buildDamageText(raw) {
  // handle many shapes:
  // - raw.dmg1 + raw.dmgType (+ raw.dmg2 + Versatile)
  // - raw.damage: "1d8 slashing"
  // - raw.damage?: { parts: [["1d8","slashing"], ...] }
  // - raw.card_payload?.damage etc.
  const dmg1 = coalesce(raw.dmg1, raw.damage1, raw.primaryDamage, raw?.damage?.dice, raw?.card_payload?.dmg1);
  const dtypeRaw = coalesce(raw.dmgType, raw.damageType, raw?.damage?.type, raw?.card_payload?.dmgType);
  const dtype = (DMG_TEXT[dtypeRaw] || dtypeRaw || "").toString().trim();

  // parts array form: [["1d8","slashing"], ...]
  if (Array.isArray(raw?.damage?.parts) && raw.damage.parts.length) {
    const [d, t] = raw.damage.parts[0];
    return `${d} ${t || ""}`.trim();
  }

  // single combined string form
  if (typeof raw?.damage === "string") return raw.damage;

  if (dmg1) {
    return `${dmg1} ${dtype}`.trim();
  }
  return "—";
}

function buildRangeText(raw, propsList) {
  // Fallbacks: raw.range, raw.rangeText, raw.range_normal/_long, card_payload.range
  const rTxt = coalesce(
    raw.rangeText, raw.range, raw?.card_payload?.range,
    (raw.range_normal && raw.range_long) ? `${raw.range_normal}/${raw.range_long} ft.` : null
  );
  if (rTxt) return String(rTxt).replace(/ft\.?$/i, "ft.");

  // thrown indicator if props include T
  if (Array.isArray(propsList) && propsList.includes("T")) return "Thrown";
  return "—";
}

function buildPropsText(raw) {
  // props could be short-codes ["L","F"] or objects [{name:"Light"}] or strings
  let arr = coalesce(raw.properties, raw.property, raw.propertiesText, raw?.card_payload?.properties) || [];
  if (typeof arr === "string") arr = arr.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(arr)) arr = [];

  const shortCodes = arr
    .map((p) => typeof p === "string" ? stripTag(p) : stripTag(p?.name))
    .filter(Boolean);

  if (shortCodes.length) {
    return shortCodes.map((s) => PROP_SHORT[s] || s).join(", ");
  }
  return "—";
}

function buildACText(raw) {
  // armor: raw.ac or raw.armor?.ac or card_payload.ac
  const ac = coalesce(raw.ac, raw?.armor?.ac, raw?.card_payload?.ac);
  return ac != null && ac !== "" ? String(ac) : "—";
}

/* ---------- component ---------- */
export default function ItemCard({ item = {} }) {
  const { uiType, uiSubKind } = classifyUi(item);

  // Flavor overrides
  const [flavorIndex, setFlavorIndex] = useState(null);
  useEffect(() => {
    let ok = true;
    loadFlavorIndex().then((idx) => ok && setFlavorIndex(idx)).catch(() => {});
    return () => { ok = false; };
  }, []);

  const pureStringBullets =
    Array.isArray(item.entries) && item.entries.every((e) => typeof e === "string")
      ? item.entries
      : null;

  const entriesText = flattenEntries(item.entries);

  const overrideFlavor = (flavorIndex && flavorIndex.get(item.item_name || item.name)) || null;
  const flavorText = overrideFlavor || item.flavor || entriesText || "";

  const hasItemDescription = !!item.item_description;

  const gp = parseValueToGp(coalesce(item.item_cost, item.cost, item.value));
  const weight = coalesce(item.item_weight, item.weight, item?.card_payload?.weight, null);

  // collect props list raw to pass to range helper
  const rawProps = coalesce(item.property, item.properties, item?.card_payload?.properties, []);

  const dmgText  = buildDamageText(item);
  const rngText  = buildRangeText(item, Array.isArray(rawProps) ? rawProps.map(stripTag) : []);
  const propsTxt = buildPropsText(item);
  const acText   = buildACText(item);

  const rarityRaw = coalesce(item.item_rarity, item.rarity, item?.card_payload?.rarity);
  const rarity = humanRarity(rarityRaw);

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
    dmg: dmgText,
    rng: rngText,
    props: propsTxt,
    ac: acText,
  };

  const rarityClass = `rarity-${(norm.rarity || "Common").toLowerCase().replace(/\s+/g, "-")}`;
  const showRange = norm.rng && norm.rng !== "—";

  return (
    <div className="card sitem-card mb-4">
      <div className={`card-header sitem-header d-flex align-items-center justify-content-between ${rarityClass}`}>
        <div className="sitem-title fw-semibold">{norm.name}</div>
        <div className="sitem-type small text-uppercase">
          {norm.type}{norm.typeHint ? ` • ${norm.typeHint}` : ""}
        </div>
      </div>

      <div className="card-body">
        <div className="sitem-meta text-center mb-2">
          <span className="sitem-rarity">{norm.rarity}</span>
          {norm.charges != null && <span className="ms-1 small text-muted">({norm.charges} charges)</span>}
        </div>

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
              <div className="text-wrap">{showRange ? norm.rng : norm.ac}</div>
            </div>
          </div>

          <div className="col-12">
            <div className="sitem-section">
              <div className="small text-muted mb-1">Properties</div>
              <div className="text-wrap">{norm.props}</div>
            </div>
          </div>
        </div>

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

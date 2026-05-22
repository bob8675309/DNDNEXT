//    components/ItemCard.js
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
  if (typeof v === "number") {
    // 5etools-style mundane item rows often store numeric cost in copper pieces.
    // Crafted/admin custom rows that already pass item_cost/value as text/object
    // still use the unit-aware branches below.
    return v >= 100 ? v / 100 : v;
  }
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)?$/i);
    if (m) return parseFloat(m[1]) * unitToGp(m[2] || "gp");
  }
  if (typeof v === "object") {
    const amount = v.amount ?? v.quantity ?? v.value ?? v.number;
    const unit = v.unit || v.coin || v.currency || "gp";
    if (amount != null) return Number(amount) * unitToGp(unit);
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
function uniqueList(arr) {
  const seen = new Set();
  return arr.filter((value) => {
    const key = String(value || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  // MagicVariantBuilder emits damageText. Catalog rows usually emit dmg1/dmgType.
  // Support both so admin-built variants, catalog items, and craft-completed items
  // render the same card fields.
  const direct = coalesce(raw.damageText, raw?.card_payload?.damageText, raw.damage_text, raw?.card_payload?.damage_text);
  if (direct) return String(direct);

  const dmg1 = coalesce(raw.dmg1, raw.damage1, raw.primaryDamage, raw?.damage?.dice, raw?.card_payload?.dmg1);
  const dtypeRaw = coalesce(raw.dmgType, raw.damageType, raw?.damage?.type, raw?.card_payload?.dmgType);
  const dtype = (DMG_TEXT[dtypeRaw] || dtypeRaw || "").toString().trim();

  if (Array.isArray(raw?.damage?.parts) && raw.damage.parts.length) {
    const [d, t] = raw.damage.parts[0];
    return `${d} ${t || ""}`.trim();
  }

  if (typeof raw?.damage === "string") return raw.damage;

  if (dmg1) return `${dmg1} ${dtype}`.trim();
  return "—";
}

function buildRangeText(raw, propsList) {
  const rTxt = coalesce(
    raw.rangeText, raw.range, raw?.card_payload?.range,
    (raw.range_normal && raw.range_long) ? `${raw.range_normal}/${raw.range_long} ft.` : null
  );
  if (rTxt) return String(rTxt).replace(/ft\.?$/i, "ft.");

  if (Array.isArray(propsList) && propsList.includes("T")) return "Thrown";
  return "—";
}

function buildPropsText(raw) {
  let arr = coalesce(raw.properties, raw.property, raw.propertiesText, raw?.card_payload?.properties, raw?.card_payload?.property) || [];
  if (typeof arr === "string") arr = arr.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(arr)) arr = [];

  const shortCodes = arr
    .map((p) => typeof p === "string" ? stripTag(p) : stripTag(p?.name))
    .filter(Boolean)
    .map((s) => PROP_SHORT[s] || s);

  return uniqueList(shortCodes).join(", ") || "—";
}

function buildACText(raw) {
  const ac = coalesce(raw.ac, raw?.armor?.ac, raw?.card_payload?.ac, raw?.card_payload?.armor?.ac);
  return ac != null && ac !== "" ? String(ac) : "—";
}

function typeFromBuilderCategory(category = "") {
  const c = String(category || "").toLowerCase();
  if (c === "melee") return "Melee Weapon";
  if (c === "ranged") return "Ranged Weapon";
  if (c === "thrown") return "Melee Weapon";
  if (c === "armor") return "Armor";
  if (c === "shield") return "Shield";
  if (c === "ammunition") return "Ammunition";
  return "";
}


const POTION_DETAIL_OVERRIDES = {
  "Oil of Etherealness": { duration: "1 hour", use: "10 minutes to apply", effect: "One vial can cover one Medium or smaller creature and grants the effect of Etherealness." },
  "Oil of Sharpness": { duration: "1 hour", use: "1 minute to apply", effect: "A coated slashing or piercing weapon or ammunition gains a temporary bonus to attack and damage rolls by DM ruling." },
  "Potion of Healing": { duration: "Instant", use: "Action to drink", effect: "The drinker regains 2d4 + 2 HP." },
  "Potion of Superior Healing": { duration: "Instant", use: "Action to drink", effect: "The drinker regains 8d4 + 8 HP." },
  "Potion of Climbing": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains a climbing speed equal to walking speed and Advantage on climbing checks." },
  "Potion of Speed": { duration: "1 minute", use: "Action to drink", effect: "The drinker gains the effect of Haste." },
  "Potion of Invisibility": { duration: "1 hour", use: "Action to drink", effect: "The drinker becomes invisible until they attack, cast a spell, or the duration ends." },
  "Potion of Flying": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains a flying speed equal to walking speed." },
  "Potion of Water Breathing": { duration: "1 hour", use: "Action to drink", effect: "The drinker can breathe underwater." },
  "Potion of Heroism": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains temporary HP and a blessing-like heroic boost by DM ruling." },
  "Potion of Gaseous Form": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains the effect of Gaseous Form." },
  "Potion of Mind Reading": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains the effect of Detect Thoughts." },
  "Potion of Clairvoyance": { duration: "10 minutes", use: "Action to drink", effect: "The drinker gains the effect of Clairvoyance." },
  "Potion of Storm Giant Strength": { duration: "1 hour", use: "Action to drink", effect: "The drinker's Strength becomes 29 unless already equal or higher." },
  "Potion of Invulnerability": { duration: "1 minute", use: "Action to drink", effect: "The drinker gains resistance to all damage." },
  "Potion of Resistance": { duration: "1 hour", use: "Action to drink", effect: "The drinker gains resistance to one damage type chosen by the formula/reagent." },
  "Purple Worm Poison": { duration: "Until delivered", use: "Action to apply", effect: "A creature exposed to the poison makes a Constitution save or takes heavy poison damage by DM ruling." },
};
function isPotionLikeItem(item = {}, type = "") {
  const blob = [type, item.item_type, item.type, item.name, item.item_name, item.category].filter(Boolean).join(" ").toLowerCase();
  return /\b(potion|oil|poison|elixir|philter|tonic|draught|salve|drops)\b/.test(blob);
}
function extractDuration(text = "") {
  const s = String(text || "");
  const patterns = [
    /(?:for|lasts? for|duration:?\s*)(\d+\s*(?:round|minute|hour|day|week)s?)/i,
    /(?:for|lasts? for|duration:?\s*)(1d4\s*hours?|1d4\s*minutes?)/i,
    /(instant(?:aneous)?)/i,
    /(until delivered|until used|until dispelled)/i,
  ];
  for (const rx of patterns) {
    const m = s.match(rx);
    if (m) return m[1].replace(/^instantaneous$/i, "Instant");
  }
  return "";
}
function potionDetailsForItem(item = {}, type = "", ruleText = "", entriesText = "") {
  if (!isPotionLikeItem(item, type)) return null;
  const name = item.item_name || item.name || "";
  const known = POTION_DETAIL_OVERRIDES[name] || {};
  const sourceText = [ruleText, entriesText, item.effect_text, item.effect, item.rulesText].filter(Boolean).join("\n");
  const duration = item.duration || item.duration_text || known.duration || extractDuration(sourceText) || "By item text / DM ruling";
  const use = item.use || item.use_text || item.activation || item.application || known.use || (/oil/i.test(name) ? "Apply as described" : "Action to drink/use");
  const effect = item.effect_detail || item.effect_text || item.effect || known.effect || sourceText || "See item text.";
  return { use, duration, effect };
}

/* ---------- component ---------- */
export default function ItemCard({ item = {} }) {
  const mergedItem = {
    ...(item.card_payload && typeof item.card_payload === "object" ? item.card_payload : {}),
    ...item,
  };
  const { uiType, uiSubKind } = classifyUi(mergedItem);

  const [flavorIndex, setFlavorIndex] = useState(null);
  useEffect(() => {
    let ok = true;
    loadFlavorIndex().then((idx) => ok && setFlavorIndex(idx)).catch(() => {});
    return () => { ok = false; };
  }, []);

  const pureStringBullets =
    Array.isArray(mergedItem.entries) && mergedItem.entries.every((e) => typeof e === "string")
      ? uniqueList(mergedItem.entries)
      : null;

  const entriesText = flattenEntries(mergedItem.entries);

  const overrideFlavor = (flavorIndex && flavorIndex.get(mergedItem.item_name || mergedItem.name)) || null;
  const flavorText = mergedItem.flavor || overrideFlavor || entriesText || "";

  const rawRuleText = coalesce(mergedItem.item_description, mergedItem.rulesText, mergedItem.rules, "");
  const hasItemDescription = !!rawRuleText;
  const potionDetails = potionDetailsForItem(mergedItem, uiType || mergedItem.type || mergedItem.item_type, rawRuleText, entriesText);

  const gp = parseValueToGp(coalesce(mergedItem.item_cost, mergedItem.cost, mergedItem.value));
  const weight = coalesce(mergedItem.item_weight, mergedItem.weight, mergedItem?.card_payload?.weight, null);

  const rawProps = coalesce(mergedItem.property, mergedItem.properties, mergedItem?.card_payload?.properties, []);
  const dmgText  = buildDamageText(mergedItem);
  const rngText  = buildRangeText(mergedItem, Array.isArray(rawProps) ? rawProps.map(stripTag) : []);
  const propsTxt = buildPropsText(mergedItem);
  const acText   = buildACText(mergedItem);

  const rarityRaw = coalesce(mergedItem.item_rarity, mergedItem.rarity, mergedItem?.card_payload?.rarity);
  const rarity = humanRarity(rarityRaw);

  const norm = {
    image: mergedItem.image_url || mergedItem.img || mergedItem.image || "/placeholder.png",
    name: mergedItem.item_name || mergedItem.name || "Unnamed Item",
    type: uiType || typeFromBuilderCategory(mergedItem.category) || titleCase(stripTag(mergedItem.type || mergedItem.item_type || "Item")),
    typeHint: uiType === "Wondrous Item" ? uiSubKind : null,
    rarity,
    flavor: flavorText || "—",
    cost: gp,
    weight: weight != null ? weight : null,
    source: mergedItem.source || mergedItem.item_source || "",
    charges: mergedItem.charges ?? mergedItem.item_charges ?? null,
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

        {potionDetails ? (
          <div className="sitem-section sitem-rules mt-2">
            <div className="small text-muted mb-1 text-uppercase fw-semibold">Potion Details</div>
            <div className="row g-2">
              <div className="col-12 col-md-6"><strong>Use:</strong> {potionDetails.use}</div>
              <div className="col-12 col-md-6"><strong>Duration:</strong> {potionDetails.duration}</div>
              <div className="col-12"><strong>Effect:</strong> {potionDetails.effect}</div>
            </div>
          </div>
        ) : null}

        <div
          className="sitem-section sitem-rules mt-2"
          style={{ whiteSpace: hasItemDescription ? "pre-line" : (pureStringBullets ? "normal" : "pre-line") }}
        >
          {hasItemDescription ? (
            rawRuleText
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
          <div className="d-flex gap-2 flex-wrap">
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

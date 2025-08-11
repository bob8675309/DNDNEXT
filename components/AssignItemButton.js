// Helpers to pull cost/weight from 5eTools or your JSON
function parseValueToText(v) {
  if (v == null) return null;
  if (typeof v === "number") return `${v} gp`;
  if (typeof v === "string") return v;               // e.g., "2500 gp"
  if (typeof v === "object") {
    const amt = v.amount ?? v.value ?? v.qty ?? null;
    const unit = v.unit ?? v.currency ?? "gp";
    return amt != null ? `${amt} ${unit}` : null;
  }
  return null;
}

function parseWeightToText(w) {
  if (w == null) return null;
  if (typeof w === "number") return `${w} lbs`;
  if (typeof w === "string") return w;               // e.g., "2 lbs"
  if (typeof w === "object") {
    const amt = w.amount ?? w.value ?? w.qty ?? null;
    const unit = w.unit ?? "lbs";
    return amt != null ? `${amt} ${unit}` : null;
  }
  return null;
}

const norm = {
  id: item.id || item._id || (item.name || item.item_name || "").toLowerCase().replace(/\W+/g,"-"),
  name: item.item_name || item.name || "Unnamed Item",
  type: item.item_type || item.type || "Wondrous Item",
  rarity: item.item_rarity || item.rarity || "Common",
  description: item.item_description || item.description || (Array.isArray(item.entries) ? "[See description]" : ""),
  image: item.image_url || item.img || item.image || null,
  weightText: parseWeightToText(item.item_weight ?? item.weight),
  costText: parseValueToText(item.item_cost ?? item.cost ?? item.value),
};

const rows = Array.from({ length: Math.max(1, Number(qty) || 1) }, () => ({
  user_id: playerId,
  item_id: norm.id,
  item_name: norm.name,
  item_type: norm.type,
  item_rarity: norm.rarity,
  item_description: norm.description,
  image_url: norm.image,
  item_weight: norm.weightText,
  item_cost: norm.costText
}));
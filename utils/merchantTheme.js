const THEMES = [
  "smith","weapons","alchemy","herbalist","caravan",
  "stable","clothier","jeweler","arcanist","general"
];

function normalizeTheme(raw) {
  const s = String(raw || "").toLowerCase();
  if (THEMES.includes(s)) return s;

  // fuzzy matches (name/icon)
  if (/(smith|anvil|forge|hammer)/.test(s)) return "smith";
  if (/(weapon|blade|sword)/.test(s)) return "weapons";
  if (/(potion|alch)/.test(s)) return "alchemy";
  if (/(leaf|herb|plant)/.test(s)) return "herbalist";
  if (/(camel|caravan|trader)/.test(s)) return "caravan";
  if (/(horse|stable|courier)/.test(s)) return "stable";
  if (/(cloak|cloth|tailor)/.test(s)) return "clothier";
  if (/(gem|jewel)/.test(s)) return "jeweler";
  if (/(book|scribe|tome|arcane|wizard|mage)/.test(s)) return "arcanist";
  return "general";
}

export function themeFromMerchant(m = {}) {
  // Treat merchants.icon as the explicit theme if it matches; otherwise infer from name/icon.
  const explicit = normalizeTheme(m.icon);
  if (explicit !== "general") return explicit;
  return normalizeTheme((m.name || m.icon || ""));
}

export function emojiForTheme(theme) {
  const t = normalizeTheme(theme);
  return ({
    smith: "⚒️",
    weapons: "🗡️",
    alchemy: "🧪",
    herbalist: "🌿",
    caravan: "🐪",
    stable: "🐎",
    clothier: "🧵",
    jeweler: "💎",
    arcanist: "📜",
    general: "🛍️",
  })[t];
}

// Keeping Pill for existing UI bits
export function Pill({ theme, small=false }) {
  const t = normalizeTheme(theme);
  return <span className={`badge ${small ? "bg-secondary" : "text-bg-secondary"}`}>{t}</span>;
}

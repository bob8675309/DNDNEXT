const THEMES = [
  "smith","weapons","alchemy","herbalist","caravan",
  "stable","clothier","jeweler","arcanist","general"
];

function normalizeTheme(raw) {
  const s = String(raw || "").toLowerCase();
  if (THEMES.includes(s)) return s;

  // fuzzy matches (name/icon/role/tags/storefront)
  if (/(smith|blacksmith|anvil|forge|hammer|armorer|armourer)/.test(s)) return "smith";
  if (/(weapon|blade|sword|bowyer|fletcher|arms)/.test(s)) return "weapons";
  if (/(potion|alch|apothecary|bomb|oil|poison|elixir)/.test(s)) return "alchemy";
  if (/(leaf|herb|plant|root|oakshade|botanist|gardener)/.test(s)) return "herbalist";
  if (/(camel|caravan|trader|trade|wagon|peddler|market)/.test(s)) return "caravan";
  if (/(horse|stable|courier|mount|saddle)/.test(s)) return "stable";
  if (/(cloak|cloth|tailor|seamstress|weaver|garb|robe)/.test(s)) return "clothier";
  if (/(gem|jewel|ring|amulet|relic)/.test(s)) return "jeweler";
  if (/(book|scribe|tome|arcane|wizard|mage|archivist|archive|map|scroll|lore|ritual|curio)/.test(s)) return "arcanist";
  return "general";
}

export function backgroundForTheme(theme) {
  const t = String(theme || "").toLowerCase();
  const map = {
    jeweler: "/merchant-backgrounds/jeweler.jpg",
    smith: "/merchant-backgrounds/smith.jpg",
    armorer: "/merchant-backgrounds/smith.jpg",
    fletcher: "/merchant-backgrounds/fletcher.jpg",
    alchemist: "/merchant-backgrounds/alchemist.jpg",
    apothecary: "/merchant-backgrounds/alchemist.jpg",
    herbalist: "/merchant-backgrounds/alchemist.jpg",
    arcane: "/merchant-backgrounds/arcane.jpg",
    arcanist: "/merchant-backgrounds/arcane.jpg",
    occult: "/merchant-backgrounds/arcane.jpg",
    dwarven: "/merchant-backgrounds/dwarven.jpg",
    drow: "/merchant-backgrounds/drow.jpg",
    kaorti: "/merchant-backgrounds/kaorti.jpg",
  };
  return map[t] || "/parchment.jpg";
}

export function themeFromMerchant(m = {}) {
  const merchantRecord = m && typeof m === "object" ? m : {};
  const explicit = normalizeTheme(merchantRecord.icon || merchantRecord.theme || merchantRecord.merchant_theme);
  if (explicit !== "general") return explicit;

  // Exact tags outrank fuzzy identity prose. This order mirrors the database
  // so the storefront art/theme and stock-selection RPC cannot disagree.
  const tagList = (Array.isArray(merchantRecord.tags) ? merchantRecord.tags : String(merchantRecord.tags || "").split(","))
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  const tagged = (value) => tagList.includes(value);
  if (tagged("herbalist")) return "herbalist";
  if (tagged("smith")) return "smith";
  if (tagged("weapons")) return "weapons";
  if (tagged("jeweler")) return "jeweler";
  if (tagged("arcanist")) return "arcanist";
  if (tagged("alchemy") || tagList.some((value) => value.startsWith("profession:alchemy"))) return "alchemy";
  if (tagged("stable")) return "stable";
  if (tagged("caravan")) return "caravan";
  if (tagged("clothier")) return "clothier";
  if (tagged("general")) return "general";

  const identity = [
    merchantRecord.name,
    merchantRecord.role,
    merchantRecord.affiliation,
    merchantRecord.storefront_title,
    merchantRecord.storefront_tagline,
    tagList.join(" "),
  ].filter(Boolean).join(" ");
  return normalizeTheme(identity);
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

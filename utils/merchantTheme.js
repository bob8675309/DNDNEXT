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
  // Explicit icon/theme wins first; then inspect the full storefront identity.
  const explicit = normalizeTheme(m.icon || m.theme || m.merchant_theme);
  if (explicit !== "general") return explicit;
  const tags = Array.isArray(m.tags) ? m.tags.join(" ") : String(m.tags || "");
  const identity = [
    m.name,
    m.role,
    m.affiliation,
    m.storefront_title,
    m.storefront_tagline,
    tags,
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

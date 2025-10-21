// utils/merchantTheme.js

// Theme registry: label, emoji, bootstrap color
const THEME_META = {
  alchemist:   { label: "Alchemist",   icon: "🧪", color: "bg-success" },
  apothecary:  { label: "Apothecary",  icon: "🌿", color: "bg-success" },
  smith:       { label: "Smith",       icon: "⚒️", color: "bg-dark" },
  armorer:     { label: "Armorer",     icon: "🛡️", color: "bg-dark" },
  fletcher:    { label: "Fletcher",    icon: "🏹", color: "bg-warning" },
  arcane:      { label: "Arcane",      icon: "🔮", color: "bg-primary" },
  occult:      { label: "Occult",      icon: "☽",  color: "bg-primary" },
  dwarven:     { label: "Dwarven",     icon: "⛏️", color: "bg-secondary" },
  drow:        { label: "Drow",        icon: "🕷️", color: "bg-secondary" },
  kaorti:      { label: "Kaorti",      icon: "🩸", color: "bg-danger" },
  general:     { label: "General",     icon: "🧳", color: "bg-info" },
};

const DEFAULT_THEME = "general";

// Heuristics: infer from explicit field, tag list, or merchant name/icon.
export function themeFromMerchant(merchant = {}) {
  const name = (merchant.name || "").toLowerCase();
  const icon = (merchant.icon || "").toLowerCase();
  const type = (merchant.type || merchant.theme || "").toLowerCase();
  const tags = Array.isArray(merchant.tags) ? merchant.tags.map(t => (t||"").toLowerCase()) : [];

  const bag = [type, icon, name, ...tags].join(" ");

  if (/alchemist|apothecary|potion|elixir|herb/.test(bag)) return "alchemist";
  if (/smith|forge|anvil|armorer/.test(bag)) return /armor/.test(bag) ? "armorer" : "smith";
  if (/fletcher|bow|arrow|archer|ranger/.test(bag)) return "fletcher";
  if (/arcane|wizard|mage|sorcer|enchanted|scroll/.test(bag)) return "arcane";
  if (/occult|ritual|hex|witch/.test(bag)) return "occult";
  if (/dwarf|dwarven|gray hall/.test(bag)) return "dwarven";
  if (/drow|underdark|spider/.test(bag)) return "drow";
  if (/kaorti|ichor|far ?realm|zurguth/.test(bag)) return "kaorti";

  return DEFAULT_THEME;
}

export function themeMeta(theme) {
  return THEME_META[theme] || THEME_META[DEFAULT_THEME];
}

// Bootstrap pill
export function Pill({ theme, className = "", small = false }) {
  const { label, icon, color } = themeMeta(theme);
  const size = small ? "py-0 px-2" : "py-1 px-2";
  return (
    <span className={`badge rounded-pill ${color} ${size} ${className}`} title={label}>
      <span className="me-1">{icon}</span>
      {!small && <span>{label}</span>}
    </span>
  );
}

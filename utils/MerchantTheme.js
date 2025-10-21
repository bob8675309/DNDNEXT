// /utils/merchantTheme.js
export function themeFromMerchant(m) {
  const s = (m?.icon || m?.name || '').toLowerCase();
  if (s.includes('anvil') || s.includes('smith') || s.includes('forge')) return 'smith';
  if (s.includes('sword') || s.includes('weapon')) return 'weapons';
  if (s.includes('potion') || s.includes('alch')) return 'alchemy';
  if (s.includes('leaf') || s.includes('herb') || s.includes('plant')) return 'herbalist';
  if (s.includes('camel') || s.includes('caravan') || s.includes('trader')) return 'caravan';
  if (s.includes('horse') || s.includes('stable') || s.includes('courier')) return 'stable';
  if (s.includes('cloak') || s.includes('cloth') || s.includes('tailor')) return 'clothier';
  if (s.includes('gem') || s.includes('jewel')) return 'jeweler';
  if (s.includes('book') || s.includes('scribe') || s.includes('tome')) return 'arcanist';
  return 'general';
}

export function Pill({ theme, label }) {
  // minimalist emoji + label pill; swap emojis or replace with SVGs anytime
  const emoji = {
    smith: '⚒️', weapons: '🗡️', alchemy: '🧪', herbalist: '🌿',
    caravan: '🐪', stable: '🐎', clothier: '🧵', jeweler: '💎',
    arcanist: '📜', general: '🛍️'
  }[theme] || '🛍️';

  return (
    <span className={`pill pill-${theme}`} title={label}>
      <span className="pill-ico">{emoji}</span>
      <span className="pill-txt">{label}</span>
    </span>
  );
}

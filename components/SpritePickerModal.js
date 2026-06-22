import { useMemo, useState } from "react";
import { MAP_ICONS_BUCKET, LOCAL_FALLBACK_ICON, mapIconDisplay } from "../utils/mapIcons";

function safeStr(value) {
  return String(value ?? "").trim();
}

export default function SpritePickerModal({
  show = false,
  icons = [],
  value = null,
  characterName = "Character",
  disabled = false,
  onClose,
  onChange,
}) {
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState(null);

  const filtered = useMemo(() => {
    const term = safeStr(query).toLowerCase();
    const base = Array.isArray(icons) ? icons : [];
    const list = term
      ? base.filter((icon) => {
          const hay = [icon?.name, icon?.category, icon?.storage_path]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(term);
        })
      : base;

    return [...list].sort((a, b) => {
      const ao = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : 9999;
      const bo = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : 9999;
      if (ao !== bo) return ao - bo;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [icons, query]);

  if (!show) return null;

  async function choose(nextValue) {
    if (disabled || savingId !== null) return;
    setSavingId(nextValue || "clear");
    try {
      if (typeof onChange === "function") await onChange(nextValue || null);
      onClose?.();
    } finally {
      setSavingId(null);
    }
  }

  const renderIcon = (icon, size = 46) => {
    const disp = mapIconDisplay(icon, { bucket: MAP_ICONS_BUCKET, fallbackSrc: LOCAL_FALLBACK_ICON });
    if (disp?.type === "emoji") {
      return <span className="sprite-picker-emoji" style={{ fontSize: size * 0.72 }}>{disp.emoji}</span>;
    }
    return <img src={disp?.src || LOCAL_FALLBACK_ICON} alt="" loading="lazy" />;
  };

  return (
    <div className="sprite-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? onClose?.() : null}>
      <div className="sprite-picker-modal" role="dialog" aria-modal="true" aria-label="Choose map sprite">
        <div className="sprite-picker-head">
          <div>
            <div className="sprite-picker-kicker">Map sprite</div>
            <h3>Choose sprite for {characterName}</h3>
            <p>This changes the character’s map icon only; it does not change their portrait or profile art.</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
        </div>

        <div className="sprite-picker-toolbar">
          <input
            className="form-control form-control-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sprites…"
          />
          <span>{filtered.length} shown</span>
        </div>

        <div className="sprite-picker-grid">
          <button
            type="button"
            className={`sprite-picker-card ${!value ? "is-current" : ""}`}
            disabled={disabled || savingId !== null}
            onClick={() => choose(null)}
            title="Clear sprite"
          >
            <span className="sprite-picker-image"><img src={LOCAL_FALLBACK_ICON} alt="" /></span>
            <span className="sprite-picker-name">No sprite</span>
            {!value ? <span className="sprite-picker-current">Current</span> : null}
          </button>

          {filtered.map((icon) => {
            const isCurrent = String(icon.id) === String(value);
            return (
              <button
                key={icon.id}
                type="button"
                className={`sprite-picker-card ${isCurrent ? "is-current" : ""}`}
                disabled={disabled || savingId !== null}
                onClick={() => choose(icon.id)}
                title={icon.name || "Map sprite"}
              >
                <span className="sprite-picker-image">{renderIcon(icon)}</span>
                <span className="sprite-picker-name">{icon.name || "Map sprite"}</span>
                {isCurrent ? <span className="sprite-picker-current">Current</span> : null}
                {savingId === icon.id ? <span className="sprite-picker-saving">Saving…</span> : null}
              </button>
            );
          })}

          {!filtered.length ? <div className="sprite-picker-empty">No sprites match that search.</div> : null}
        </div>
      </div>
    </div>
  );
}

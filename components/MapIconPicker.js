import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_ICONS_BUCKET, LOCAL_FALLBACK_ICON, mapIconDisplay } from "../utils/mapIcons";

/**
 * Visual map icon dropdown (image + emoji).
 *
 * Expects icons from public.map_icons (id,name,storage_path,metadata,sort_order,category).
 */
export default function MapIconPicker({
  icons = [],
  value = null,
  onChange,
  disabled = false,
  bucket = MAP_ICONS_BUCKET,
  fallbackSrc = LOCAL_FALLBACK_ICON,
  buttonClassName = "btn btn-sm btn-outline-light",
  buttonStyle,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);

  const selected = useMemo(
    () => (icons || []).find((r) => String(r.id) === String(value)) || null,
    [icons, value]
  );

  const selectedDisp = useMemo(
    () => mapIconDisplay(selected, { bucket, fallbackSrc }),
    [selected, bucket, fallbackSrc]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = Array.isArray(icons) ? icons : [];
    const list = term
      ? base.filter((r) => String(r.name || "").toLowerCase().includes(term))
      : base;

    // Stable-ish ordering: sort_order asc, name asc
    return [...list].sort((a, b) => {
      const ao = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 9999;
      const bo = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 9999;
      if (ao !== bo) return ao - bo;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [icons, q]);

  // click-outside to close
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      const el = wrapRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const renderPreview = (disp, size = 18) => {
    if (disp?.type === "emoji") {
      return (
        <span
          className="mi-emoji"
          aria-hidden="true"
          style={{ fontSize: Math.max(14, size), lineHeight: 1 }}
        >
          {disp.emoji}
        </span>
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="mi-img"
        src={disp?.src || fallbackSrc}
        alt=""
        width={size}
        height={size}
        onError={(e) => {
          if (e?.currentTarget && e.currentTarget.src !== fallbackSrc) e.currentTarget.src = fallbackSrc;
        }}
        style={{ width: size, height: size }}
      />
    );
  };

  return (
    <div ref={wrapRef} className="mi-picker" style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className={buttonClassName}
        style={buttonStyle}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="Choose map icon"
      >
        <span className="d-inline-flex align-items-center gap-2">
          {renderPreview(selectedDisp, 18)}
          <span className="mi-btn-label">{selected?.name || "Map icon…"}</span>
        </span>
      </button>

      {open && !disabled && (
        <div className="mi-popover shadow">
          <div className="mi-popover-head">
            <input
              className="form-control form-control-sm"
              placeholder="Search icons…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>

          <div className="mi-popover-body">
            <button
              type="button"
              className={`mi-item ${!value ? "is-selected" : ""}`}
              onClick={async () => {
                setOpen(false);
                setQ("");
                if (typeof onChange === "function") await onChange(null);
              }}
              title="Clear icon"
            >
              {renderPreview({ type: "image", src: fallbackSrc }, 24)}
              <div className="mi-item-name">(None)</div>
            </button>

            {filtered.map((ic) => {
              const disp = mapIconDisplay(ic, { bucket, fallbackSrc });
              const isSel = String(ic.id) === String(value);
              return (
                <button
                  type="button"
                  key={ic.id}
                  className={`mi-item ${isSel ? "is-selected" : ""}`}
                  onClick={async () => {
                    setOpen(false);
                    setQ("");
                    if (typeof onChange === "function") await onChange(ic.id);
                  }}
                  title={ic.name}
                >
                  {renderPreview(disp, 24)}
                  <div className="mi-item-name">{ic.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

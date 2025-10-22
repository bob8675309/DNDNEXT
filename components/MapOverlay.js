import React from "react";
import { themeFromMerchant, themeMeta } from "../utils/merchantTheme.js";

/**
 * MapOverlay
 * - Merchants render as small tinted "pills" with just an icon.
 * - On hover/focus: show a name bubble; on click: call onOpen(m).
 * - Locations (non-merchant) remain simple dots.
 */
export default function MapOverlay({
  merchants = [],
  locations = [],
  onOpen,                 // <— pass your openMerchant function in map.js
}) {
  return (
    <>
      {/* Merchant pins: icon-only pill; name bubble on hover/focus */}
      {merchants.map((m) => {
        const theme = themeFromMerchant(m);
        const { icon } = themeMeta(theme);
        // Your code already computes % positions; if you pass px, keep it consistent.
        const stylePos = { left: `${m.x}%`, top: `${m.y}%` };

        return (
          <button
            key={`mer-${m.id}`}
            type="button"
            className={`map-pin pin-merchant pin-pill pill-${theme}`}
            style={stylePos}
            onClick={(e) => { e.stopPropagation(); onOpen?.(m); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(m); } }}
            aria-label={m.name}
            title={m.name}
          >
            <span className="pill-ico" aria-hidden="true">{icon}</span>
            {/* Hidden name bubble that appears on hover/focus */}
            <span className="pin-label">{m.name}</span>
          </button>
        );
      })}

      {/* Non-merchant locations (simple markers) */}
      {locations.map((loc) => (
        <div
          key={`loc-${loc.id}`}
          className="map-pin pin-location"
          style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
          tabIndex={0}
          aria-label={loc.name}
        />
      ))}
    </>
  );
}

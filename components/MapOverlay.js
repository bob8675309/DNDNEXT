import React from "react";

export default function MapOverlay({ merchants = [], locations = [], onSelectMerchant }) {
  return (
    <>
      {/* Merchants: icon-only, label on hover/focus */}
      {merchants.map((m) => (
        <div
          key={m.id}
          className="map-pin pin-merchant"
          style={{ left: m.x, top: m.y }}
          tabIndex={0}
          onClick={() => onSelectMerchant?.(m)}
          aria-label={m.name}
        >
          <span className="merchant-icon" />
          <span className="pin-label">{m.name}</span>
        </div>
      ))}

      {/* Non-merchant locations (optional) */}
      {locations.map((loc) => (
        <div
          key={`loc-${loc.id}`}
          className="map-pin pin-location"
          style={{ left: loc.x, top: loc.y }}
          tabIndex={0}
          aria-label={loc.name}
        />
      ))}
    </>
  );
}

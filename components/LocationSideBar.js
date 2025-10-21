/*  components/LocationSideBar.js


import React from "react";
import { themeFromMerchant, Pill } from "../utils/merchantTheme";

/**
 * LocationSideBar (excerpt / full file replacement as needed)
 * - Adds theme pill next to each merchant
 */
export default function LocationSideBar({ location, merchantsHere = [], onSelectMerchant }) {
  if (!location) return null;

  return (
    <div className="loc-panel">
      <div className="loc-sec">
        <div className="loc-sec-title">
          <span>Merchants at this location</span>
        </div>
        {merchantsHere.length === 0 && (
          <div className="text-muted small">No merchants present.</div>
        )}
        {merchantsHere.length > 0 && (
          <ul className="list-unstyled m-0">
            {merchantsHere.map((m) => {
              const theme = themeFromMerchant(m);
              return (
                <li
                  key={m.id}
                  className="loc-item d-flex align-items-center justify-content-between"
                >
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none"
                    onClick={() => onSelectMerchant?.(m)}
                  >
                    {m.name}
                  </button>
                  <Pill theme={theme} small />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

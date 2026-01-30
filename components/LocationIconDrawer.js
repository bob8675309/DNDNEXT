import React, { useMemo, useState } from "react";

export default function LocationIconDrawer({
  open,
  isAdmin,
  icons = [],
  placing,
  placeConfig,
  onClose,
  onPickIcon,
  onTogglePlacing,
  onChangeConfig,
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return icons;
    return (icons || []).filter((i) => String(i.name || "").toLowerCase().includes(qq));
  }, [icons, q]);

  const anchorPresets = [
    { key: "bottom", label: "Bottom Center", ax: 0.5, ay: 1 },
    { key: "center", label: "Center", ax: 0.5, ay: 0.5 },
    { key: "topleft", label: "Top Left", ax: 0, ay: 0 },
    { key: "topright", label: "Top Right", ax: 1, ay: 0 },
    { key: "bottomleft", label: "Bottom Left", ax: 0, ay: 1 },
    { key: "bottomright", label: "Bottom Right", ax: 1, ay: 1 },
  ];

  const currentPresetKey = useMemo(() => {
    const ax = Number(placeConfig?.anchor_x ?? 0.5);
    const ay = Number(placeConfig?.anchor_y ?? 1);
    const hit = anchorPresets.find((p) => p.ax === ax && p.ay === ay);
    return hit?.key || "custom";
  }, [placeConfig]);

  return (
    <div className={`loc-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="loc-drawer__header">
        <div className="loc-drawer__title">Location Markers</div>
        <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>
          ✕
        </button>
      </div>

      {!isAdmin ? (
        <div className="loc-drawer__body">
          <div className="alert alert-secondary mb-0">Admin only.</div>
        </div>
      ) : (
        <div className="loc-drawer__body">
          <div className="mb-2">
            <input
              className="form-control form-control-sm"
              placeholder="Search icons…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="loc-drawer__controls">
            <button
              type="button"
              className={`btn btn-sm ${placing ? "btn-success" : "btn-outline-success"}`}
              onClick={onTogglePlacing}
              disabled={!placeConfig?.icon_id}
              title={!placeConfig?.icon_id ? "Pick an icon first" : ""}
            >
              {placing ? "Placing: ON" : "Placing: OFF"}
            </button>

            <div className="text-muted small ms-2">
              {placing ? "Click map to place. Esc cancels." : "Pick icon to enable placing."}
            </div>
          </div>

          <div className="card card-body bg-dark text-light p-2 mb-2">
            <div className="row g-2">
              <div className="col-12">
                <label className="form-label form-label-sm mb-1">Default Name</label>
                <input
                  className="form-control form-control-sm"
                  value={placeConfig?.name || ""}
                  onChange={(e) => onChangeConfig({ name: e.target.value })}
                  placeholder="(uses icon name if blank)"
                />
              </div>

              <div className="col-6">
                <label className="form-label form-label-sm mb-1">Scale</label>
                <input
                  className="form-control form-control-sm"
                  type="number"
                  step="0.05"
                  min="0.2"
                  max="6"
                  value={String(placeConfig?.scale ?? 1)}
                  onChange={(e) => onChangeConfig({ scale: Number(e.target.value) || 1 })}
                />
              </div>

              <div className="col-6">
                <label className="form-label form-label-sm mb-1">Rotation (°)</label>
                <input
                  className="form-control form-control-sm"
                  type="number"
                  step="1"
                  min="-180"
                  max="180"
                  value={String(placeConfig?.rotation_deg ?? 0)}
                  onChange={(e) => onChangeConfig({ rotation_deg: Number(e.target.value) || 0 })}
                />
              </div>

              <div className="col-12">
                <label className="form-label form-label-sm mb-1">Anchor</label>
                <select
                  className="form-select form-select-sm"
                  value={currentPresetKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    const p = anchorPresets.find((x) => x.key === key);
                    if (p) onChangeConfig({ anchor_x: p.ax, anchor_y: p.ay });
                  }}
                >
                  {anchorPresets.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="loc-icon-grid">
            {filtered.map((i) => {
              const active = String(placeConfig?.icon_id || "") === String(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  className={`loc-icon-card ${active ? "active" : ""}`}
                  onClick={() => onPickIcon(i)}
                  title={i.name}
                >
                  {i.public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.public_url} alt="" />
                  ) : (
                    <div className="loc-icon-card__placeholder">SVG</div>
                  )}
                  <div className="loc-icon-card__name">{i.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

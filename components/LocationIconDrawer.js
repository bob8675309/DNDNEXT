import React, { useMemo, useState } from "react";

export default function LocationIconDrawer({
  open,
  isAdmin,
  icons = [],
  placing,
  placeConfig,
  addMode,
  onToggleAddMode,
  onClose,
  onPickIcon,
  onTogglePlacing,
  onChangeConfig,
  onDeleteIcon,
  onSaveEdit,
  onCancelEdit,
  defaultTab,
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(defaultTab || "markers");
  const isEditing = Boolean(placeConfig?.edit_location_id);

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
          <ul className="nav nav-tabs nav-tabs-dark mb-2" role="tablist">
          </ul>

          {tab === "markers" && (
            <div>
              <div className="loc-drawer__toolbar">
                <input
                  className="form-control form-control-sm"
                  placeholder="Search icons..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light"
                  onClick={() => setIconsVisible((v) => !v)}
                  title={iconsVisible ? "Hide icon list" : "Show icon list"}
                >
                  {iconsVisible ? "Hide icons" : "Show icons"}
                </button>
              </div>

              <div className="loc-drawer__controls">
                <div className="d-flex justify-content-end gap-2 mb-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={onCancelEdit}
                    disabled={!isEditing}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={onSaveEdit}
                    disabled={!isEditing}
                  >
                    Save
                  </button>
                </div>

                <div className="mb-2">
                  <label className="form-label text-muted small">Default Name</label>
                  <input
                    className="form-control form-control-sm"
                    value={placeConfig?.name || ""}
                    onChange={(e) => onChangeConfig({ ...placeConfig, name: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>

                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label text-muted small">Scale</label>
                    <input
                      type="number"
                      step="0.05"
                      className="form-control form-control-sm"
                      value={placeConfig?.scale ?? 1}
                      onChange={(e) => onChangeConfig({ ...placeConfig, scale: Number(e.target.value) })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label text-muted small">Rotation (°)</label>
                    <input
                      type="number"
                      step="1"
                      className="form-control form-control-sm"
                      value={placeConfig?.rotation_deg ?? 0}
                      onChange={(e) => onChangeConfig({ ...placeConfig, rotation_deg: Number(e.target.value) })}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="mb-2">
                  <label className="form-label text-muted small">Anchor</label>
                  <select
                    className="form-select form-select-sm"
                    value={anchorKey}
                    onChange={(e) => {
                      const key = e.target.value;
                      const preset = anchorPresets.find((p) => p.key === key);
                      if (!preset) return;
                      onChangeConfig({ ...placeConfig, anchor_x: preset.ax, anchor_y: preset.ay, anchor: preset.key });
                    }}
                    disabled={!isEditing}
                  >
                    {anchorPresets.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="locHiddenSwitch"
                    checked={!!placeConfig?.is_hidden}
                    onChange={(e) => onChangeConfig({ ...placeConfig, is_hidden: e.target.checked })}
                    disabled={!isEditing}
                  />
                  <label className="form-check-label" htmlFor="locHiddenSwitch">
                    Hidden from players
                  </label>
                </div>
              </div>

              {iconsVisible && (
                <div className="loc-icon-grid">
                  {filteredIcons.map((icon) => {
                    const active = String(placeConfig?.icon_id || "") === String(icon.id);
                    return (
                      <button
                        key={icon.id}
                        type="button"
                        className={`loc-icon-card ${active ? "active" : ""}`}
                        onClick={() => isEditing && onChangeConfig({ ...placeConfig, icon_id: icon.id })}
                        title={icon.name}
                        disabled={!isEditing}
                      >
                        <img src={icon.url} alt={icon.name} />
                        <div className="loc-icon-card__name">{icon.name}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

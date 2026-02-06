import React, { useEffect, useMemo, useState } from "react";

/**
 * LocationIconDrawer
 *
 *
 * This component is used by pages/map.js.
 *
 * IMPORTANT (avoid future regressions):
 * - The global styling lives in styles/globals.scss and expects these class names:
 *   .loc-drawer, .loc-drawer__header, .loc-drawer__title, .loc-drawer__body,
 *   .loc-icon-tabs/.loc-icon-tab, .loc-search,
 *   .loc-icon-grid, .loc-icon-card, .loc-icon-card__name, .loc-icon-card__delete
 *   If you rename these classnames without updating SCSS, the drawer will appear “unstyled” (black/blank).
 */
export default function LocationIconDrawer({
  open,
  isAdmin,
  icons = [],
  placing,
  placeConfig,
  addMode, // legacy name used elsewhere; treated same as placing
  defaultTab = "markers",
  onToggleAddMode, // legacy (optional)
  onClose,
  onPickIcon,
  onDeleteIcon,
  onTogglePlacing,
  onChangeConfig,
  onCancelEdit,
  onSaveEdit,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [search, setSearch] = useState("");
  const [hideIcons, setHideIcons] = useState(false);

  useEffect(() => {
    setActiveTab(defaultTab || "markers");
  }, [defaultTab]);

  const isPlacing = !!placing || !!addMode;

  const filteredIcons = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return icons;
    return icons.filter((ic) => {
      const hay = `${ic.label || ""} ${ic.key || ""} ${ic.id || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [icons, search]);

  if (!open) return null;

  const cfg = placeConfig || {};
  const selectedIconId = cfg.icon_id || cfg.iconId || null;
  const canEdit = !!isAdmin;
  const showEditor = canEdit; // always show editor controls for admin (edit existing OR place new)

  return (
    <div className="loc-drawer open">
      <div className="loc-drawer__header">
        <div className="loc-drawer__title">Location Markers</div>
        <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="loc-drawer__body">
        <div className="loc-icon-tabs" role="tablist" aria-label="Location Marker Tabs">
          <button
            type="button"
            className={`loc-icon-tab ${activeTab === "markers" ? "active" : ""}`}
            role="tab"
            aria-selected={activeTab === "markers"}
            onClick={() => setActiveTab("markers")}
          >
            Markers
          </button>
          <button
            type="button"
            className={`loc-icon-tab ${activeTab === "creatures" ? "active" : ""}`}
            role="tab"
            aria-selected={activeTab === "creatures"}
            onClick={() => setActiveTab("creatures")}
          >
            Creatures
          </button>
        </div>

        {activeTab === "creatures" ? (
          <div className="mt-3" style={{ opacity: 0.9 }}>
            <div className="small text-muted">Creature markers will be added later.</div>
          </div>
        ) : (
          <>
            <div className="d-flex align-items-center gap-2 mt-3">
              <input
                className="loc-search"
                placeholder="Search icons..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setHideIcons((v) => !v)}
                title={hideIcons ? "Show icons" : "Hide icons"}
              >
                {hideIcons ? "Show\nicons" : "Hide\nicons"}
              </button>
            </div>

            {showEditor && (
              <div className="mt-3">
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <div className="small" style={{ opacity: 0.85 }}>
                    {isPlacing
                      ? "Click the map to place the marker."
                      : "Click an existing marker to edit, or enable placing to add a new one."}
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${isPlacing ? "btn-warning" : "btn-outline-secondary"}`}
                      onClick={() => {
                        if (onTogglePlacing) onTogglePlacing();
                        else onToggleAddMode?.();
                      }}
                    >
                      {isPlacing ? "Placing: ON" : "Place Marker"}
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancelEdit}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-sm btn-primary" onClick={onSaveEdit}>
                      Save
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="form-label">Default Name</label>
                  <input
                    className="form-control form-control-sm"
                    /*
                      NOTE (TDZ/name bug):
                      The map page saves the location name from cfg.name.
                      A previous patch used cfg.label here, which made typing a name appear in the UI
                      but never persist (because map.js never read cfg.label).
                    */
                    value={cfg.name || ""}
                    onChange={(e) => onChangeConfig?.({ name: e.target.value })}
                  />
                </div>

                <div className="row g-2 mt-1">
                  <div className="col-6">
                    <label className="form-label">Scale</label>
                    <input
                      className="form-control form-control-sm"
                      type="number"
                      step="0.05"
                      value={cfg.scale ?? 1}
                      onChange={(e) => onChangeConfig?.({ scale: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Rotation (°)</label>
                    <input
                      className="form-control form-control-sm"
                      type="number"
                      step="1"
                      value={cfg.rotation ?? 0}
                      onChange={(e) => onChangeConfig?.({ rotation: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <label className="form-label">Anchor</label>
                  <select
                    className="form-select form-select-sm"
                    value={cfg.anchor || "Bottom Center"}
                    onChange={(e) => onChangeConfig?.({ anchor: e.target.value })}
                  >
                    <option>Center</option>
                    <option>Bottom Center</option>
                    <option>Top Center</option>
                    <option>Left Center</option>
                    <option>Right Center</option>
                  </select>
                </div>

                <div className="form-check form-switch mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="hideFromPlayers"
                    checked={!!cfg.is_hidden}
                    onChange={(e) => onChangeConfig?.({ is_hidden: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="hideFromPlayers">
                    Hidden from players
                  </label>
                </div>
              </div>
            )}

			{!hideIcons && (
				<div className="loc-icon-grid mt-3" role="list">
                {filteredIcons.map((icon) => {
                  const isSelected = selectedIconId === icon.id;
                  return (
                    <div
                      key={icon.id}
								className={`loc-icon-card ${isSelected ? "active" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => onPickIcon?.(icon)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onPickIcon?.(icon);
                      }}
                      title={icon.label}
                    >
								{icon.public_url ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img src={icon.public_url} alt={icon.label || "icon"} />
								) : (
									<div className="loc-icon-card__name">No image</div>
								)}

								<div className="loc-icon-card__name">{icon.label || icon.key || icon.id}</div>

                      {isAdmin ? (
									<button
										type="button"
										className="loc-icon-card__delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm("Delete this icon?")) return;
                            onDeleteIcon?.(icon);
                          }}
                          title="Delete icon"
                        >
                          🗑
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

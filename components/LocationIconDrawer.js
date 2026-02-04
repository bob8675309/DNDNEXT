import React, { useMemo, useState } from "react";

/**
 * LocationIconDrawer
 *
 * Notes:
 * - This drawer is intentionally "Markers-only" (no Add Location tab).
 * - map.js may still pass legacy props (defaultTab/addMode/onToggleAddMode). We accept them but ignore.
 */
export default function LocationIconDrawer({
  isOpen,
  onClose,
  icons = [],
  selectedIconId,
  onSelectIcon,
  onDeleteIcon,
  isAdmin,

  // legacy/compat props
  defaultTab, // unused
  addMode, // unused
  onToggleAddMode, // unused

  // marker editor props
  markerDraft,
  setMarkerDraft,
  onSaveMarker,
  onCancelMarker,
  isSaving,
}) {
  const [search, setSearch] = useState("");
  const [iconsVisible, setIconsVisible] = useState(true);

  const filteredIcons = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return icons;
    return (icons || []).filter((ic) => {
      const name = (ic?.name || "").toLowerCase();
      const path = (ic?.storage_path || "").toLowerCase();
      return name.includes(q) || path.includes(q);
    });
  }, [icons, search]);

  // robust URL resolution
  const getIconUrl = (ic) => {
    return (
      ic?.public_url ||
      ic?.url ||
      // fallback for older rows where only storage_path is available
      (typeof process !== "undefined" &&
      process?.env?.NEXT_PUBLIC_SUPABASE_URL &&
      ic?.storage_path
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/location-icons/${ic.storage_path}`
        : "")
    );
  };

  if (!isOpen) return null;

  return (
    <div className="loc-icon-drawer open">
      <div className="loc-icon-drawer-header">
        <div className="loc-icon-drawer-title">Location Markers</div>
        <button className="loc-icon-drawer-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="loc-icon-drawer-body">
        {/* Search + toggles */}
        <div className="d-flex gap-2 align-items-center mb-2">
          <input
            className="loc-icon-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons..."
          />

          <button
            className="btn btn-sm btn-outline-secondary"
            type="button"
            onClick={() => setIconsVisible((v) => !v)}
            title={iconsVisible ? "Hide icons" : "Show icons"}
          >
            {iconsVisible ? "Hide icons" : "Show icons"}
          </button>
        </div>

        {/* Marker editor (only shows when markerDraft is provided) */}
        {markerDraft && (
          <div className="loc-marker-editor">
            <div className="loc-marker-editor-actions">
              <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                onClick={onCancelMarker}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                type="button"
                onClick={onSaveMarker}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>

            <label className="loc-marker-label">Default Name</label>
            <input
              className="form-control form-control-sm"
              type="text"
              value={markerDraft.name || ""}
              onChange={(e) => setMarkerDraft({ ...markerDraft, name: e.target.value })}
            />

            <div className="loc-marker-row">
              <div className="loc-marker-field">
                <label className="loc-marker-label">Scale</label>
                <input
                  className="form-control form-control-sm"
                  type="number"
                  step="0.05"
                  value={markerDraft.scale ?? 1}
                  onChange={(e) =>
                    setMarkerDraft({
                      ...markerDraft,
                      scale: Number(e.target.value || 1),
                    })
                  }
                />
              </div>
              <div className="loc-marker-field">
                <label className="loc-marker-label">Rotation (°)</label>
                <input
                  className="form-control form-control-sm"
                  type="number"
                  step="1"
                  value={markerDraft.rotation_deg ?? 0}
                  onChange={(e) =>
                    setMarkerDraft({
                      ...markerDraft,
                      rotation_deg: Number(e.target.value || 0),
                    })
                  }
                />
              </div>
            </div>

            <label className="loc-marker-label">Anchor</label>
            <select
              className="form-select form-select-sm"
              value={markerDraft.anchor || "center"}
              onChange={(e) => setMarkerDraft({ ...markerDraft, anchor: e.target.value })}
            >
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
            </select>
          </div>
        )}

        {/* Icon grid */}
        {iconsVisible && (
          <div className="loc-icon-grid" role="list">
            {filteredIcons.map((icon) => {
              const isSelected = icon.id === selectedIconId;
              const url = getIconUrl(icon);
              return (
                <div
                  key={icon.id}
                  className={`loc-icon-card ${isSelected ? "active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectIcon?.(icon)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelectIcon?.(icon);
                  }}
                  title={icon.name}
                >
                  <div className="loc-icon-card-inner">
                    <div className="loc-icon-thumb">
                      {url ? (
                        <img src={url} alt={icon.name} />
                      ) : (
                        <div className="loc-icon-thumb-missing">No image</div>
                      )}
                    </div>
                    <div className="loc-icon-card-name">{icon.name}</div>
                  </div>

                  {isAdmin && (
                    <button
                      className="loc-icon-card__delete"
                      type="button"
                      title="Delete icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteIcon?.(icon);
                      }}
                    >
                      🗑
                    </button>
                  )}
                </div>
              );
            })}

            {filteredIcons.length === 0 && (
              <div className="loc-icon-empty">No icons match your search.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

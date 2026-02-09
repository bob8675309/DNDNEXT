import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

/**
 * LocationIconDrawer
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
  npcs = [],
  locations = [],
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

  // NPC tab handlers
  onNpcSetIcon,
  onNpcSetHidden,
  onNpcDropToMap,
  onNpcSetSprite,
  onNpcSetSpriteScale,
  npcMoveSpeed,
  onNpcSetMoveSpeed,
  activeNpcId,
  onNpcSelect,
  focusNpcInDrawerId,
  onFocusNpcConsumed,
}) {
  // Defensive defaults (kept inside the component body to avoid any edge-case
  // transform/TDZ issues when destructuring defaults are emitted by the bundler)
  const effectiveNpcMoveSpeed =
    typeof npcMoveSpeed === "number" && Number.isFinite(npcMoveSpeed)
      ? npcMoveSpeed
      : 0.15;
  const setNpcMoveSpeed =
    typeof onNpcSetMoveSpeed === "function" ? onNpcSetMoveSpeed : () => {};

  const [activeTab, setActiveTab] = useState(defaultTab);

  // If the map right-clicks an NPC, it can ask the drawer to focus/highlight that NPC.
  useEffect(() => {
    if (!open) return;
    if (!focusNpcInDrawerId) return;
    // Ensure we're on the NPC tab so the item exists.
    setActiveTab("npcs");
    // Select it (so right-click target movement uses the correct NPC).
    onNpcSelect?.(focusNpcInDrawerId);

    // Scroll the list item into view.
    requestAnimationFrame(() => {
    const el = document.querySelector(`[data-npc-id="${focusNpcInDrawerId}"]`);
      if (el?.scrollIntoView) el.scrollIntoView({ block: "center" });
      onFocusNpcConsumed?.();
    });
  }, [open, focusNpcInDrawerId]);

  // Allow parent to switch tabs programmatically (e.g., right-click NPC on the map)
  useEffect(() => {
    if (defaultTab && defaultTab !== activeTab) setActiveTab(defaultTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTab]);
  const [search, setSearch] = useState("");
  const [hideIcons, setHideIcons] = useState(false);

  // NPC tab state
  const [npcSearch, setNpcSearch] = useState("");
  const [npcOnlyOnMap, setNpcOnlyOnMap] = useState(false);
  const [selectedNpcId, setSelectedNpcId] = useState(null);

  // Keep drawer selection in sync with the map's active NPC selection
  useEffect(() => {
    if (activeNpcId && activeNpcId !== selectedNpcId) {
      setSelectedNpcId(activeNpcId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNpcId]);

  // Keep drawer selection in sync with map selection
  useEffect(() => {
    if (activeNpcId && activeNpcId !== selectedNpcId) setSelectedNpcId(activeNpcId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNpcId]);
  const [npcSpriteSearch, setNpcSpriteSearch] = useState("");
  const [npcSpriteFiles, setNpcSpriteFiles] = useState([]);

  // If parent changes defaultTab (e.g. right-click an NPC on the map), follow it.
  useEffect(() => {
    setActiveTab(defaultTab || "markers");
  }, [defaultTab]);

  // Keep drawer selection in sync with the currently "active" NPC on the map.
  useEffect(() => {
    if (activeNpcId) {
      setSelectedNpcId(activeNpcId);
      if (onNpcSelect) onNpcSelect(activeNpcId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNpcId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Storage: bucket "map-icons" folder "npc-icons"
      const { data, error } = await supabase.storage
        .from("map-icons")
        .list("npc-icons", { limit: 500, sortBy: { column: "name", order: "asc" } });

      if (cancelled) return;
      if (error) {
        console.warn("Failed to list npc-icons:", error);
        setNpcSpriteFiles([]);
        return;
      }

      const files = (data || [])
        .filter((f) => f?.name && f.name.toLowerCase().endsWith(".png"))
        .map((f) => {
          const path = `npc-icons/${f.name}`;
          const url = supabase.storage.from("map-icons").getPublicUrl(path)?.data?.publicUrl;
          return { name: f.name, path, url };
        });

      setNpcSpriteFiles(files);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  // Determine the drawer header. When viewing the NPC tab and a character is selected,
  // display the NPC’s name; otherwise default to “Location Markers”.
  const selectedNpcInDrawer = useMemo(() => {
    if (!selectedNpcId) return null;
    return (npcs || []).find((n) => n && n.id === selectedNpcId) || null;
  }, [npcs, selectedNpcId]);

  const drawerTitle = useMemo(() => {
    if (activeTab === "npcs" && selectedNpcInDrawer) {
      return selectedNpcInDrawer.name || "NPC";
    }
    return "Location Markers";
  }, [activeTab, selectedNpcInDrawer]);

  return (
    <div className="loc-drawer open">
      <div className="loc-drawer__header">
        <div className="loc-drawer__title">{drawerTitle}</div>
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

          <button
            type="button"
            className={`loc-icon-tab ${activeTab === "npcs" ? "active" : ""}`}
            role="tab"
            aria-selected={activeTab === "npcs"}
            onClick={() => setActiveTab("npcs")}
          >
            NPCs
          </button>
        </div>

        {activeTab === "creatures" ? (
          <div className="mt-3" style={{ opacity: 0.9 }}>
            <div className="small text-muted">Creature markers will be added later.</div>
          </div>
        ) : activeTab === "npcs" ? (
          <NpcTab
            isAdmin={isAdmin}
            npcs={npcs}
            locations={locations}
            npcSearch={npcSearch}
            setNpcSearch={setNpcSearch}
            npcSpriteFiles={npcSpriteFiles}
            npcSpriteSearch={npcSpriteSearch}
            setNpcSpriteSearch={setNpcSpriteSearch}
            npcOnlyOnMap={npcOnlyOnMap}
            setNpcOnlyOnMap={setNpcOnlyOnMap}
            selectedNpcId={selectedNpcId}
            setSelectedNpcId={setSelectedNpcId}
            onNpcDropToMap={onNpcDropToMap}
            onNpcSetSprite={onNpcSetSprite}
            onNpcSetSpriteScale={onNpcSetSpriteScale}
            onNpcSetHidden={onNpcSetHidden}
            effectiveNpcMoveSpeed={effectiveNpcMoveSpeed}
            setNpcMoveSpeed={setNpcMoveSpeed}
          />
        ) : (
          <MarkersTab
            isAdmin={isAdmin}
            icons={icons}
            filteredIcons={filteredIcons}
            hideIcons={hideIcons}
            setHideIcons={setHideIcons}
            search={search}
            setSearch={setSearch}
            showEditor={showEditor}
            isPlacing={isPlacing}
            cfg={cfg}
            selectedIconId={selectedIconId}
            onPickIcon={onPickIcon}
            onDeleteIcon={onDeleteIcon}
            onTogglePlacing={onTogglePlacing}
            onToggleAddMode={onToggleAddMode}
            onChangeConfig={onChangeConfig}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
          />
        )}
      </div>
    </div>
  );
}

function MarkersTab({
  isAdmin,
  icons,
  filteredIcons,
  hideIcons,
  setHideIcons,
  search,
  setSearch,
  showEditor,
  isPlacing,
  cfg,
  selectedIconId,
  onPickIcon,
  onDeleteIcon,
  onTogglePlacing,
  onToggleAddMode,
  onChangeConfig,
  onCancelEdit,
  onSaveEdit,
}) {
  return (
    <>
      <div className="d-flex align-items-center gap-2 mt-3">
        <input className="loc-search" placeholder="Search icons..." value={search} onChange={(e) => setSearch(e.target.value)} />

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
              {isPlacing ? "Click the map to place the marker." : "Click an existing marker to edit, or enable placing to add a new one."}
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
  );
}

function NpcTab({
  isAdmin,
  npcs,
  locations,
  npcSearch,
  setNpcSearch,
  npcSpriteFiles,
  npcSpriteSearch,
  setNpcSpriteSearch,
  npcOnlyOnMap,
  setNpcOnlyOnMap,
  selectedNpcId,
  setSelectedNpcId,
  onNpcDropToMap,
  effectiveNpcMoveSpeed,
  setNpcMoveSpeed,

  onNpcSetSprite,
  onNpcSetSpriteScale,
  onNpcSetHidden,
}) {
  const locationsById = useMemo(() => {
    const m = new Map();
    (locations || []).forEach((l) => m.set(String(l.id), l));
    return m;
  }, [locations]);

  const filteredNpcs = useMemo(() => {
    const q = (npcSearch || "").trim().toLowerCase();
    const base = (npcs || []).filter((n) => {
      if (!n) return false;
      if (npcOnlyOnMap && (n.location_id != null || n.is_hidden)) return false;
      if (q) {
        const hay = `${n.name || ""} ${n.role || ""} ${n.affiliation || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return base;
  }, [npcs, npcSearch, npcOnlyOnMap]);

  const selectedNpc = useMemo(() => (filteredNpcs || []).find((n) => n.id === selectedNpcId) || (npcs || []).find((n) => n.id === selectedNpcId) || null, [filteredNpcs, npcs, selectedNpcId]);
  const selectedSpritePath = selectedNpc?.sprite_path || null;
  const selectedSpriteScale = typeof selectedNpc?.sprite_scale === "number" ? selectedNpc.sprite_scale : 0.7;

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center gap-2">
        <input
          className="loc-search"
          placeholder="Search NPCs..."
          value={npcSearch}
          onChange={(e) => setNpcSearch(e.target.value)}
        />
        <div className="form-check form-switch" style={{ marginBottom: 0 }}>
          <input
            className="form-check-input"
            type="checkbox"
            id="npcOnlyOnMap"
            checked={npcOnlyOnMap}
            onChange={(e) => setNpcOnlyOnMap(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="npcOnlyOnMap" style={{ opacity: 0.85 }}>
            On map only
          </label>
        </div>
      </div>

      <div className="mt-3" style={{ maxHeight: 260, overflow: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
        {(filteredNpcs || []).map((n) => {
          const atLoc = n.location_id != null ? locationsById.get(String(n.location_id)) : null;
          const status = n.is_hidden ? "Hidden" : n.location_id == null ? "On Map" : "At Location";
          const sub = atLoc ? atLoc.name : n.location_id == null ? "Traveling" : "—";
          const isSelected = selectedNpcId === n.id;
          return (
            <div
              key={n.id}
              data-npc-id={n.id}
              className={`d-flex align-items-center justify-content-between px-2 py-2 ${isSelected ? "bg-dark" : ""}`}
              style={{ cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              onClick={() => {
                setSelectedNpcId(n.id);
              }}
              draggable={!!isAdmin && !n.is_hidden}
              onDragStart={(e) => {
                if (!isAdmin) return;
                // Only makes sense to drop visible NPCs onto the map
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData(
                  "application/x-dndnext",
                  JSON.stringify({ kind: "npc", id: n.id })
                );
              }}
              title={isAdmin ? "Drag onto the map to place/teleport" : ""}
            >
              <div style={{ minWidth: 0 }}>
                <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                  <div className="fw-semibold text-truncate" style={{ maxWidth: 200 }}>{n.name}</div>
                  <span className={`badge ${status === "Hidden" ? "text-bg-secondary" : status === "On Map" ? "text-bg-success" : "text-bg-info"}`}>{status}</span>
                </div>
                <div className="small text-muted text-truncate" style={{ maxWidth: 280 }}>
                  {sub}
                </div>
              </div>

              {isAdmin ? (
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className={`btn btn-sm ${n.is_hidden ? "btn-outline-secondary" : "btn-outline-success"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNpcSetHidden?.(n.id, !n.is_hidden);
                    }}
                    title={n.is_hidden ? "Show" : "Hide"}
                  >
                    {n.is_hidden ? "Show" : "Hide"}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 small" style={{ opacity: 0.85 }}>
        {isAdmin ? "Drag an NPC onto the map to place/teleport their pin." : null}
      </div>

      <div className="mt-3">
        <div className="d-flex align-items-center justify-content-between">
          <div className="fw-semibold">Sprites</div>
          <div className="small text-muted">{selectedNpc ? selectedNpc.name : "Select an NPC"}</div>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2">
          <input
            className="loc-search"
            placeholder="Search sprites..."
            value={npcSpriteSearch}
            onChange={(e) => setNpcSpriteSearch(e.target.value)}
          />
        </div>

        <div className="mt-2 small" style={{ opacity: 0.85 }}>
          Scale
        </div>
        <input
          type="range"
          className="form-range"
          min={0.4}
          max={1.4}
          step={0.05}
          value={selectedSpriteScale}
          onChange={(e) => {
            if (!selectedNpc) return;
            onNpcSetSpriteScale?.(selectedNpc.id, Number(e.target.value));
          }}
          disabled={!selectedNpc}
        />

        <div className="mt-2 small" style={{ opacity: 0.85 }}>
          Move speed
        </div>
        <input
          type="range"
          className="form-range"
          min={0.02}
          max={2.0}
          step={0.01}
          value={effectiveNpcMoveSpeed}
          onChange={(e) => setNpcMoveSpeed?.(Number(e.target.value))}
        />
        <div className="small text-muted" style={{ marginTop: -8 }}>
          {effectiveNpcMoveSpeed.toFixed(2)} (pct/sec)
        </div>
      </div>

      <div
        className="loc-icon-grid mt-2"
        role="list"
        style={{ opacity: selectedNpc ? 1 : 0.45, pointerEvents: selectedNpc ? "auto" : "none" }}
      >
        {(npcSpriteFiles || [])
          .filter((f) => {
            const q = (npcSpriteSearch || "").trim().toLowerCase();
            if (!q) return true;
            return String(f.name || "").toLowerCase().includes(q);
          })
          .map((f) => {
            const isSelected = selectedSpritePath === f.path;
            return (
              <div
                key={`npc-spr-${f.path}`}
                className={`loc-icon-card ${isSelected ? "active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!selectedNpc) return;
                  onNpcSetSprite?.(selectedNpc.id, f.path);
                }}
                title={f.name}
              >
                {/* Cropped preview of frame (0,0) so sheets don't look "blank" */}
                <div
                  className="loc-sprite-preview"
                  style={{
                    backgroundImage: f.url ? `url("${f.url}")` : "none",
                    backgroundRepeat: "no-repeat",
                    // 4 rows (directions) × 3 cols (walk frames)
                    backgroundSize: `${32 * 3}px ${32 * 4}px`,
                    backgroundPosition: "0px 0px",
                  }}
                />
                <div className="loc-icon-card__name">{f.name}</div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

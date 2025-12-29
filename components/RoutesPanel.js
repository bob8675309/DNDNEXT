// components/RoutesPanel.js
import { useMemo } from "react";

export default function RoutesPanel({
  routes,
  visibleRouteIds,
  setVisibleRouteIds,
  routePanelOpen, // not used directly here, but kept for clarity/debug
  isAdmin,
  beginEditRoute,
  beginNewRoute,
  toggleRouteEdit,
  routeEdit,
  draftAnchor,
  draftRouteId,
  draftMeta,
  setDraftMeta,
  setDraftDirty,
  draftDirty,
  draftPoints,
  draftEdges,
  setDraftPoints,
  setDraftEdges,
  setDraftAnchor,
  saveDraftRoute,
}) {
  const routePanelDockStyle = useMemo(
    () => ({
      width: "420px",
      maxWidth: "420px",
      background: "rgba(8, 10, 16, 0.88)",
      borderRight: "2px solid rgba(255,255,255,0.12)",
      borderLeft: "none",
    }),
    []
  );

  return (
    <div
      className="offcanvas offcanvas-start loc-panel"
      id="routePanel"
      style={routePanelDockStyle}
      data-bs-backdrop="false"
      data-bs-scroll="true"
      data-bs-keyboard="true"
      tabIndex="-1"
    >
      <div className="offcanvas-header">
        <h5 className="offcanvas-title">Routes</h5>
        <button className="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close" />
      </div>

      <div className="offcanvas-body">
        <div className="mb-2 small text-muted">Toggle multiple routes visible.</div>

        <div className="d-flex flex-column gap-2">
          {(routes || []).map((r) => {
            const checked = (visibleRouteIds || []).includes(r.id);
            return (
              <div key={r.id} className="d-flex align-items-center gap-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setVisibleRouteIds((prev) => {
                      const set = new Set(prev || []);
                      if (set.has(r.id)) set.delete(r.id);
                      else set.add(r.id);
                      return Array.from(set);
                    });
                  }}
                />
                <span
                  className="badge text-bg-dark"
                  style={{
                    background: r.color || undefined,
                    maxWidth: 240,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={r.route_type}
                >
                  {r.name}
                </span>

                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light ms-auto"
                    onClick={() => beginEditRoute(r.id)}
                    title="Load into editor"
                  >
                    Edit
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Route Editor section */}
        {isAdmin && (
          <>
            <hr className="my-3" style={{ borderColor: "rgba(255,255,255,0.15)" }} />

            <div className="d-flex align-items-center">
              <div>
                <div className="fw-semibold">Route Editor</div>
                <div className="small text-muted">
                  Enable edit mode, then click the map to add/connect points. Click a line to split. Anchor:{" "}
                  <span className="text-light">{draftAnchor ? "set" : "none"}</span>
                </div>
              </div>

              <button
                className={`btn btn-sm ms-auto ${routeEdit ? "btn-info" : "btn-outline-info"}`}
                onClick={toggleRouteEdit}
                title="Toggle route editing"
              >
                {routeEdit ? "Editing" : "Edit Mode"}
              </button>
            </div>

            <div className="mt-2 d-flex flex-column gap-2">
              <button className="btn btn-sm btn-outline-info" onClick={beginNewRoute}>
                New Route (Draft)
              </button>

              <select
                className="form-select form-select-sm"
                value={draftRouteId || ""}
                onChange={(e) => beginEditRoute(e.target.value)}
              >
                <option value="">Edit existing route…</option>
                {(routes || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.route_type || "route"})
                  </option>
                ))}
              </select>

              <input
                className="form-control form-control-sm"
                placeholder="Route name…"
                value={draftMeta.name}
                onChange={(e) => {
                  setDraftMeta((m) => ({ ...m, name: e.target.value }));
                  setDraftDirty(true);
                }}
              />

              <input
                className="form-control form-control-sm"
                placeholder="Route type…"
                value={draftMeta.route_type}
                onChange={(e) => {
                  setDraftMeta((m) => ({ ...m, route_type: e.target.value }));
                  setDraftDirty(true);
                }}
                title="Type any route type you want (trade/excursion/etc)."
              />

              <div className="d-flex align-items-center gap-2">
                <input
                  type="color"
                  className="form-control form-control-sm"
                  style={{ width: 64, padding: "0.15rem" }}
                  value={draftMeta.color || "#00ffff"}
                  onChange={(e) => {
                    setDraftMeta((m) => ({ ...m, color: e.target.value }));
                    setDraftDirty(true);
                  }}
                  title="Route color"
                />

                <label className="form-check ms-1 mb-0 d-flex align-items-center gap-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={!!draftMeta.is_loop}
                    onChange={(e) => {
                      setDraftMeta((m) => ({ ...m, is_loop: e.target.checked }));
                      setDraftDirty(true);
                    }}
                  />
                  <span className="form-check-label text-light">Loop</span>
                </label>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    setDraftPoints((prev) => prev.slice(0, -1));
                    setDraftDirty(true);
                  }}
                  disabled={!draftPoints.length}
                >
                  Undo Point
                </button>

                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    setDraftEdges([]);
                    setDraftAnchor(null);
                    setDraftDirty(true);
                  }}
                  disabled={!draftEdges.length}
                >
                  Clear Edges
                </button>

                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    setDraftPoints([]);
                    setDraftEdges([]);
                    setDraftAnchor(null);
                    setDraftDirty(true);
                  }}
                  disabled={!draftPoints.length && !draftEdges.length}
                >
                  Clear All
                </button>
              </div>

              <button
                className="btn btn-success w-100"
                onClick={saveDraftRoute}
                disabled={draftRouteId != null ? !draftDirty : !draftDirty}
                title="Creates/updates route and saves points+edges"
              >
                Save Route
              </button>

              <div className="d-flex gap-2">
                <span className="badge text-bg-light border">Pts: {draftPoints.length}</span>
                <span className="badge text-bg-light border">Edges: {draftEdges.length}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

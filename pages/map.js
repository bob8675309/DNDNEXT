/* pages/map.js */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import MerchantPanel from "../components/MerchantPanel";
import LocationSideBar from "../components/LocationSideBar";
import { themeFromMerchant as detectTheme, emojiForTheme } from "../utils/merchantTheme";

/* ===== Map calibration (X had been saved in 4:3 space) =====
   Render uses SCALE_*; DB writes use inverse SCALE_*.
   After you re-save everything once, set SCALE_X back to 1.
*/
const SCALE_X = 0.75;
const SCALE_Y = 1.0;

// Map assets (must exist in /public)
const BASE_MAP_SRC = "/Wmap.jpg";
const ROUTES_OVERLAY_SRC = "/Wmap_routes.jpg";

/* Utilities */
const asPct = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  const n = parseFloat(s.replace("%", ""));
  return Number.isFinite(n) ? n : NaN;
};

const slugify = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

// Keep merchant row shape stable for MerchantPanel + roaming fields
const projectMerchantRow = (row) => {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    x: row.x,
    y: row.y,
    inventory: row.inventory,
    icon: row.icon,
    roaming_speed: row.roaming_speed,
    location_id: row.location_id,
    last_known_location_id: row.last_known_location_id,
    projected_destination_id: row.projected_destination_id,
    bg_url: row.bg_url,
    bg_image_url: row.bg_image_url,
    bg_video_url: row.bg_video_url,

    // pathing state (if present in your merchants table)
    route_id: row.route_id,
    route_mode: row.route_mode,
    state: row.state,
    route_point_seq: row.route_point_seq,
    route_segment_progress: row.route_segment_progress,
    current_point_seq: row.current_point_seq,
    next_point_seq: row.next_point_seq,
    segment_started_at: row.segment_started_at,
    segment_ends_at: row.segment_ends_at,
  };
};

export default function MapPage() {
  const [locs, setLocs] = useState([]);
  const [merchants, setMerchants] = useState([]);

  const [addMode, setAddMode] = useState(false);
  const [clickPt, setClickPt] = useState(null); // raw/rendered 0..100 (% of visible map)
  const [err, setErr] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [selLoc, setSelLoc] = useState(null);
  const [selMerchant, setSelMerchant] = useState(null);

  // Reposition dropdowns
  const [repositionLocId, setRepositionLocId] = useState("");
  const [repositionMerchId, setRepositionMerchId] = useState("");

  // Overlays / coords
  const [showRoutesOverlay, setShowRoutesOverlay] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [gridStep, setGridStep] = useState(5); // in DB “map units” (0..100 space)
  const [hoverPt, setHoverPt] = useState(null); // DB coords {x,y}
  const [lastClickPt, setLastClickPt] = useState(null); // DB coords {x,y}

  // Ruler (DB coords; click to start, mouse moves end, click to stop)
  const [rulerArmed, setRulerArmed] = useState(false);
  const [rulerActive, setRulerActive] = useState(false);
  const [rulerStart, setRulerStart] = useState(null); // DB coords {x,y}
  const [rulerEnd, setRulerEnd] = useState(null); // DB coords {x,y}

  // Route builder (admin)
  const [routeEdit, setRouteEdit] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [activeRouteId, setActiveRouteId] = useState("");
  const [newRouteName, setNewRouteName] = useState("");
  const [draftRoutePts, setDraftRoutePts] = useState([]); // DB coords [{x,y}]

  const imgRef = useRef(null);

  /* ---------- Helpers: coordinate conversions ---------- */
  const eventToRawPct = useCallback((e) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    if (px < 0 || py < 0 || px > 1 || py > 1) return null;
    const rawX = Math.round(px * 1000) / 10; // 0..100 with 0.1 precision
    const rawY = Math.round(py * 1000) / 10;
    return { rawX, rawY };
  }, []);

  const rawPctToDb = useCallback((raw) => {
    if (!raw) return null;
    return { x: raw.rawX / SCALE_X, y: raw.rawY / SCALE_Y };
  }, []);

  const dbToRawPct = useCallback((db) => {
    if (!db) return null;
    return { rawX: db.x * SCALE_X, rawY: db.y * SCALE_Y };
  }, []);

  const dist = useCallback((a, b) => {
    if (!a || !b) return 0;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const distanceNow = useMemo(() => {
    if (!rulerStart || !rulerEnd) return null;
    return dist(rulerStart, rulerEnd);
  }, [rulerStart, rulerEnd, dist]);

  /* ---------- Data loaders ---------- */
  const checkAdmin = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return setIsAdmin(false);

    const { data, error } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error(error);
      setIsAdmin(false);
      return;
    }
    setIsAdmin(data?.role === "admin");
  }, []);

  const loadLocations = useCallback(async () => {
    const { data, error } = await supabase.from("locations").select("*").order("id");
    if (error) setErr(error.message);
    setLocs(data || []);
  }, []);

  const loadMerchants = useCallback(async () => {
    const { data, error } = await supabase
      .from("merchants")
      .select(
        [
          "id",
          "name",
          "x",
          "y",
          "inventory",
          "icon",
          "roaming_speed",
          "location_id",
          "last_known_location_id",
          "projected_destination_id",
          "route_id",
          "route_mode",
          "state",
          "route_point_seq",
          "route_segment_progress",
          "current_point_seq",
          "next_point_seq",
          "segment_started_at",
          "segment_ends_at",
          "bg_url",
          "bg_image_url",
          "bg_video_url",
        ].join(",")
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setErr(error.message);
      return;
    }

    const rows = (data || []).map(projectMerchantRow);
    setMerchants(rows);

    // keep open MerchantPanel in sync
    setSelMerchant((prev) => {
      if (!prev) return prev;
      const fresh = rows.find((m) => m.id === prev.id);
      return fresh || prev;
    });
  }, []);

  const loadRoutes = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from("map_routes")
      .select("id,name,code,route_type")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }
    setRoutes(data || []);
    if (!activeRouteId && (data || []).length) setActiveRouteId((data || [])[0].id);
  }, [isAdmin, activeRouteId]);

  const loadRoutePoints = useCallback(
    async (routeId) => {
      if (!isAdmin || !routeId) return;
      const { data, error } = await supabase
        .from("map_route_points")
        .select("seq,x,y")
        .eq("route_id", routeId)
        .order("seq", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }
      setDraftRoutePts(
        (data || []).map((p) => ({
          x: Number(p.x) || 0,
          y: Number(p.y) || 0,
        }))
      );
    },
    [isAdmin]
  );

  /* Initial load */
  useEffect(() => {
    (async () => {
      await checkAdmin();
      await Promise.all([loadLocations(), loadMerchants()]);
    })();
  }, [checkAdmin, loadLocations, loadMerchants]);

  /* Realtime: merchants */
  useEffect(() => {
    const channel = supabase
      .channel("map-merchants")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchants" }, (payload) => {
        setMerchants((current) => {
          const curr = current || [];

          if (payload.eventType === "INSERT") {
            const row = projectMerchantRow(payload.new);
            if (curr.some((m) => m.id === row.id)) {
              return curr.map((m) => (m.id === row.id ? { ...m, ...row } : m));
            }
            return [row, ...curr];
          }

          if (payload.eventType === "UPDATE") {
            const row = projectMerchantRow(payload.new);
            return curr.map((m) => (m.id === row.id ? { ...m, ...row } : m));
          }

          if (payload.eventType === "DELETE") {
            const id = payload.old?.id;
            return curr.filter((m) => m.id !== id);
          }

          return curr;
        });

        // Keep open panel in sync
        if (payload.eventType === "DELETE") {
          const deletedId = payload.old?.id;
          setSelMerchant((prev) => (prev && prev.id === deletedId ? null : prev));
        } else if (payload.new) {
          const row = projectMerchantRow(payload.new);
          setSelMerchant((prev) => (prev && prev.id === row.id ? { ...prev, ...row } : prev));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* Admin: routes */
  useEffect(() => {
    if (!isAdmin) return;
    loadRoutes();
  }, [isAdmin, loadRoutes]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!routeEdit) return;
    if (!activeRouteId) return;
    loadRoutePoints(activeRouteId);
  }, [isAdmin, routeEdit, activeRouteId, loadRoutePoints]);

  /* Offcanvas show when a selection is set */
  useEffect(() => {
    if (!selLoc) return;
    const el = document.getElementById("locPanel");
    if (el && window.bootstrap) window.bootstrap.Offcanvas.getOrCreateInstance(el).show();
  }, [selLoc]);

  useEffect(() => {
    if (!selMerchant) return;
    const el = document.getElementById("merchantPanel");
    if (el && window.bootstrap) window.bootstrap.Offcanvas.getOrCreateInstance(el).show();
  }, [selMerchant]);

  // Ensure dim clears even on ESC/backdrop dismiss
  useEffect(() => {
    const locEl = document.getElementById("locPanel");
    const merEl = document.getElementById("merchantPanel");
    const clearSel = () => {
      setSelLoc(null);
      setSelMerchant(null);
    };
    if (locEl) locEl.addEventListener("hidden.bs.offcanvas", clearSel);
    if (merEl) merEl.addEventListener("hidden.bs.offcanvas", clearSel);
    return () => {
      if (locEl) locEl.removeEventListener("hidden.bs.offcanvas", clearSel);
      if (merEl) merEl.removeEventListener("hidden.bs.offcanvas", clearSel);
    };
  }, []);

  /* ---------- Helper: merchant fallback position ---------- */
  function pinPosForMerchant(m) {
    let x = Number(m.x);
    let y = Number(m.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      const locId = m.location_id ?? m.last_known_location_id;
      const loc = locs.find((l) => String(l.id) === String(locId));
      if (loc) {
        const lx = asPct(loc.x);
        const ly = asPct(loc.y);
        x = Number.isFinite(lx) ? lx : 0;
        y = Number.isFinite(ly) ? ly : 0;
      } else {
        x = 0;
        y = 0;
      }
    }

    x = Math.min(100, Math.max(0, x));
    y = Math.min(100, Math.max(0, y));
    return [x, y];
  }

  /* ---------- Mode toggles ---------- */
  function toggleRuler() {
    setRulerArmed((v) => {
      const next = !v;

      // mutually exclusive modes
      if (next) {
        setAddMode(false);
        setRouteEdit(false);
        setRepositionLocId("");
        setRepositionMerchId("");
      } else {
        setRulerActive(false);
      }

      // keep last measurement visible unless user clears it
      return next;
    });
  }

  function clearRuler() {
    setRulerActive(false);
    setRulerStart(null);
    setRulerEnd(null);
  }

  function toggleRouteEditor() {
    if (!isAdmin) return;
    setRouteEdit((v) => {
      const next = !v;

      // mutually exclusive modes
      if (next) {
        setAddMode(false);
        setRulerArmed(false);
        setRulerActive(false);
        setRepositionLocId("");
        setRepositionMerchId("");
        setShowGrid(true);
      }
      return next;
    });
  }

  async function createRoute() {
    if (!isAdmin) return;
    const name = newRouteName.trim();
    if (!name) return;

    const code = `${slugify(name)}-${Math.random().toString(16).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("map_routes")
      .insert({ name, code, route_type: "teal" })
      .select("id")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setNewRouteName("");
    await loadRoutes();
    if (data?.id) {
      setActiveRouteId(data.id);
      setDraftRoutePts([]);
    }
  }

  async function saveRoutePointsReplace() {
    if (!isAdmin || !activeRouteId) return;
    if (!draftRoutePts.length) {
      alert("No points to save.");
      return;
    }

    // delete existing points then insert new
    const del = await supabase.from("map_route_points").delete().eq("route_id", activeRouteId);
    if (del.error) {
      alert(del.error.message);
      return;
    }

    const payload = draftRoutePts.map((p, i) => ({
      route_id: activeRouteId,
      seq: i + 1,
      x: p.x,
      y: p.y,
    }));

    const ins = await supabase.from("map_route_points").insert(payload);
    if (ins.error) {
      alert(ins.error.message);
      return;
    }

    alert("Route points saved.");
  }

  async function copyText(s) {
    try {
      await navigator.clipboard.writeText(s);
    } catch {
      alert(s); // fallback
    }
  }

  /* ---------- Map click / move ---------- */
  function handleMapClick(e) {
    const raw = eventToRawPct(e);
    if (!raw) return;
    const db = rawPctToDb(raw);
    if (db) setLastClickPt(db);

    // Reposition flows (inverse scale to DB)
    if (repositionLocId && db) {
      (async () => {
        const { error } = await supabase
          .from("locations")
          .update({ x: db.x, y: db.y })
          .eq("id", repositionLocId);

        if (error) alert(error.message);
        setRepositionLocId("");
        await loadLocations();
      })();
      return;
    }

    if (repositionMerchId && db) {
      (async () => {
        const { error } = await supabase
          .from("merchants")
          .update({ x: db.x, y: db.y })
          .eq("id", repositionMerchId);

        if (error) alert(error.message);
        setRepositionMerchId("");
        await loadMerchants();
      })();
      return;
    }

    // Ruler (freeform; no snapping)
    if (rulerArmed && db) {
      if (!rulerActive) {
        setRulerStart(db);
        setRulerEnd(db);
        setRulerActive(true);
      } else {
        setRulerEnd(db);
        setRulerActive(false);
      }
      return;
    }

    // Route builder (admin)
    if (routeEdit && isAdmin && db) {
      setDraftRoutePts((prev) => [...prev, db]);
      return;
    }

    // Add flow (uses raw/rendered coords for preview + modal)
    if (!addMode) return;
    setClickPt({ x: raw.rawX, y: raw.rawY });

    const el = document.getElementById("addLocModal");
    if (el && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(el).show();
  }

  function handleMapMouseMove(e) {
    const raw = eventToRawPct(e);
    if (!raw) {
      setHoverPt(null);
      return;
    }
    const db = rawPctToDb(raw);
    setHoverPt(db);

    if (rulerArmed && rulerActive && db) setRulerEnd(db);
  }

  const gridStyle = useMemo(() => {
    const stepX = Math.max(1, Number(gridStep) || 5) * SCALE_X;
    const stepY = Math.max(1, Number(gridStep) || 5) * SCALE_Y;
    return {
      "--grid-step-x": `${stepX}%`,
      "--grid-step-y": `${stepY}%`,
    };
  }, [gridStep]);

  const rulerRawStart = useMemo(() => dbToRawPct(rulerStart), [rulerStart, dbToRawPct]);
  const rulerRawEnd = useMemo(() => dbToRawPct(rulerEnd), [rulerEnd, dbToRawPct]);
  const hoverRaw = useMemo(() => dbToRawPct(hoverPt), [hoverPt, dbToRawPct]);

  const draftRawPoints = useMemo(() => {
    return (draftRoutePts || [])
      .map((p) => dbToRawPct(p))
      .filter(Boolean)
      .map((p) => `${p.rawX},${p.rawY}`)
      .join(" ");
  }, [draftRoutePts, dbToRawPct]);

  return (
    <div className="container-fluid my-3 map-page">
      {/* Toolbar */}
      <div className="d-flex gap-2 align-items-center mb-2 flex-wrap">
        <button
          className={`btn btn-sm ${addMode ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => {
            setAddMode((v) => {
              const next = !v;
              if (next) {
                setRulerArmed(false);
                setRulerActive(false);
                setRouteEdit(false);
                setRepositionLocId("");
                setRepositionMerchId("");
              }
              return next;
            });
          }}
        >
          {addMode ? "Click on the map…" : "Add Location"}
        </button>

        <button
          className={`btn btn-sm ${showRoutesOverlay ? "btn-secondary" : "btn-outline-secondary"}`}
          onClick={() => setShowRoutesOverlay((v) => !v)}
        >
          Routes Overlay
        </button>

        <button
          className={`btn btn-sm ${showGrid ? "btn-secondary" : "btn-outline-secondary"}`}
          onClick={() => setShowGrid((v) => !v)}
        >
          Grid
        </button>

        {showGrid && (
          <select
            className="form-select form-select-sm"
            style={{ width: 110 }}
            value={gridStep}
            onChange={(e) => setGridStep(Number(e.target.value))}
            title="Grid step"
          >
            <option value={2}>2</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        )}

        <button
          className={`btn btn-sm ${rulerArmed ? "btn-warning" : "btn-outline-warning"}`}
          onClick={toggleRuler}
          title="Ruler: click to start, move, click to stop"
        >
          Ruler
        </button>

        {rulerArmed && (
          <button className="btn btn-sm btn-outline-warning" onClick={clearRuler}>
            Clear
          </button>
        )}

        {isAdmin && (
          <>
            <button
              className={`btn btn-sm ${routeEdit ? "btn-info" : "btn-outline-info"}`}
              onClick={toggleRouteEditor}
              title="Route editor: click map to add points"
            >
              Route Editor
            </button>

            <select
              className="form-select form-select-sm"
              style={{ width: 240 }}
              value={repositionLocId}
              onChange={(e) => {
                setRepositionLocId(e.target.value);
                setRepositionMerchId("");
                setAddMode(false);
                setRulerArmed(false);
                setRouteEdit(false);
              }}
            >
              <option value="">Reposition location…</option>
              {locs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            <select
              className="form-select form-select-sm"
              style={{ width: 240 }}
              value={repositionMerchId}
              onChange={(e) => {
                setRepositionMerchId(e.target.value);
                setRepositionLocId("");
                setAddMode(false);
                setRulerArmed(false);
                setRouteEdit(false);
              }}
            >
              <option value="">Reposition merchant…</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </>
        )}

        {hoverPt && (
          <span className="badge text-bg-dark">
            X {hoverPt.x.toFixed(2)} · Y {hoverPt.y.toFixed(2)}
          </span>
        )}

        {lastClickPt && (
          <button
            className="btn btn-sm btn-outline-dark"
            onClick={() => copyText(`${lastClickPt.x.toFixed(3)}, ${lastClickPt.y.toFixed(3)}`)}
            title="Copy last click (DB coords)"
          >
            Copy Click
          </button>
        )}

        {distanceNow !== null && rulerStart && rulerEnd && (
          <span className={`badge ${rulerActive ? "text-bg-warning" : "text-bg-secondary"}`}>
            {rulerActive ? "Measuring" : "Distance"}: {distanceNow.toFixed(2)}
          </span>
        )}

        {err && <div className="text-danger small">{err}</div>}
      </div>

      {/* Route editor controls */}
      {isAdmin && routeEdit && (
        <div className="d-flex gap-2 align-items-center mb-2 flex-wrap">
          <span className="small text-muted me-1">Click map to add points.</span>

          <select
            className="form-select form-select-sm"
            style={{ width: 260 }}
            value={activeRouteId}
            onChange={(e) => {
              setActiveRouteId(e.target.value);
              setDraftRoutePts([]);
            }}
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.route_type || "route"})
              </option>
            ))}
          </select>

          <input
            className="form-control form-control-sm"
            style={{ width: 240 }}
            placeholder="New route name…"
            value={newRouteName}
            onChange={(e) => setNewRouteName(e.target.value)}
          />

          <button className="btn btn-sm btn-outline-info" onClick={createRoute}>
            Create
          </button>

          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setDraftRoutePts((prev) => prev.slice(0, -1))}
            disabled={!draftRoutePts.length}
          >
            Undo
          </button>

          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setDraftRoutePts([])}
            disabled={!draftRoutePts.length}
          >
            Clear Points
          </button>

          <button
            className="btn btn-sm btn-success"
            onClick={saveRoutePointsReplace}
            disabled={!activeRouteId || !draftRoutePts.length}
          >
            Save Points
          </button>

          <span className="badge text-bg-light border">
            Points: {draftRoutePts.length}
          </span>

          {activeRouteId && (
            <button
              className="btn btn-sm btn-outline-dark"
              onClick={() => copyText(activeRouteId)}
              title="Copy route_id"
            >
              Copy route_id
            </button>
          )}
        </div>
      )}

      {/* Map */}
      <div className="map-shell">
        {/* Visual dim: never blocks clicks */}
        <div className={`map-dim${selLoc || selMerchant ? " show" : ""}`} style={{ pointerEvents: "none" }} />

        <div
          className="map-wrap"
          onClick={handleMapClick}
          onMouseMove={handleMapMouseMove}
          onMouseLeave={() => setHoverPt(null)}
        >
          <img ref={imgRef} src={BASE_MAP_SRC} alt="World map" className="map-img" />

          {/* Overlays (below pins) */}
          {showRoutesOverlay && (
            <img
              src={ROUTES_OVERLAY_SRC}
              alt="Routes overlay"
              className="map-overlay-img map-routes-overlay"
            />
          )}

          {showGrid && <div className="map-grid" style={gridStyle} />}

          {/* Vector overlays (ruler + draft route) */}
          <svg className="map-vectors" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Draft route */}
            {routeEdit && draftRoutePts.length > 0 && (
              <>
                <polyline
                  points={draftRawPoints}
                  fill="none"
                  stroke="rgba(0,200,255,.95)"
                  strokeWidth="0.4"
                />
                {draftRoutePts.map((p, i) => {
                  const raw = dbToRawPct(p);
                  if (!raw) return null;
                  return (
                    <circle
                      key={`pt-${i}`}
                      cx={raw.rawX}
                      cy={raw.rawY}
                      r="0.7"
                      fill="rgba(0,200,255,.95)"
                      stroke="rgba(0,0,0,.5)"
                      strokeWidth="0.2"
                    />
                  );
                })}
              </>
            )}

            {/* Ruler */}
            {rulerStart && rulerEnd && rulerRawStart && rulerRawEnd && (
              <>
                <line
                  x1={rulerRawStart.rawX}
                  y1={rulerRawStart.rawY}
                  x2={rulerRawEnd.rawX}
                  y2={rulerRawEnd.rawY}
                  stroke="rgba(255,193,7,.95)"
                  strokeWidth="0.5"
                />
                <circle
                  cx={rulerRawStart.rawX}
                  cy={rulerRawStart.rawY}
                  r="0.8"
                  fill="rgba(255,193,7,.95)"
                />
                <circle
                  cx={rulerRawEnd.rawX}
                  cy={rulerRawEnd.rawY}
                  r="0.8"
                  fill="rgba(255,193,7,.95)"
                />
              </>
            )}

            {/* Hover marker */}
            {hoverRaw && (rulerArmed || routeEdit) && (
              <circle
                cx={hoverRaw.rawX}
                cy={hoverRaw.rawY}
                r="0.6"
                fill="rgba(255,255,255,.9)"
                stroke="rgba(0,0,0,.6)"
                strokeWidth="0.2"
              />
            )}
          </svg>

          {/* Pins */}
          <div className="map-overlay">
            {/* Locations */}
            {locs.map((l) => {
              const lx = asPct(l.x);
              const ly = asPct(l.y);
              if (!Number.isFinite(lx) || !Number.isFinite(ly)) return null;

              return (
                <button
                  key={l.id}
                  className="map-pin pin-location"
                  style={{ left: `${lx * SCALE_X}%`, top: `${ly * SCALE_Y}%` }}
                  title={l.name}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSelLoc(l);
                    setSelMerchant(null);
                  }}
                />
              );
            })}

            {/* Merchants */}
            {merchants.map((m) => {
              const [mx, my] = pinPosForMerchant(m);
              const theme = detectTheme(m);
              const emoji = emojiForTheme(theme);
              return (
                <button
                  key={`mer-${m.id}`}
                  className={`map-pin pin-merchant pin-pill pill-${theme}`}
                  style={{ left: `${mx * SCALE_X}%`, top: `${my * SCALE_Y}%` }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSelMerchant(m);
                    setSelLoc(null);
                  }}
                  title={m.name}
                >
                  <span className="pill-ico">{emoji}</span>
                  <span className="pin-label">{m.name}</span>
                </button>
              );
            })}

            {/* Add preview */}
            {addMode && clickPt && (
              <div
                className="map-pin"
                style={{
                  left: `${clickPt.x * SCALE_X}%`,
                  top: `${clickPt.y * SCALE_Y}%`,
                  border: "2px dashed #bfa3ff",
                  background: "rgba(126,88,255,.000)",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Add Location Modal */}
      <div className="modal fade" id="addLocModal" tabIndex="-1" aria-hidden>
        <div className="modal-dialog">
          <form
            className="modal-content"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);

              const patch = {
                name: (fd.get("name") || "").toString().trim(),
                description: (fd.get("description") || "").toString().trim() || null,
                x: clickPt ? clickPt.x / SCALE_X : null,
                y: clickPt ? clickPt.y / SCALE_Y : null,
              };

              const { error } = await supabase.from("locations").insert(patch);
              if (error) alert(error.message);
              else {
                await loadLocations();
                setAddMode(false);
                setClickPt(null);
              }
            }}
          >
            <div className="modal-header">
              <h5 className="modal-title">Add Location</h5>
              <button className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <div className="mb-2">
                <label className="form-label">Name</label>
                <input name="name" className="form-control" required />
              </div>
              <div className="mb-2">
                <label className="form-label">Description</label>
                <textarea name="description" className="form-control" rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">
                Cancel
              </button>
              <button className="btn btn-primary" type="submit">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Location Offcanvas */}
      <div
        className="offcanvas offcanvas-end loc-panel"
        id="locPanel"
        data-bs-backdrop="false"
        data-bs-scroll="true"
        data-bs-keyboard="true"
        tabIndex="-1"
      >
        {selLoc && <LocationSideBar location={selLoc} onClose={() => setSelLoc(null)} onReload={loadLocations} />}
      </div>

      {/* Merchant Offcanvas */}
      <div
        className="offcanvas offcanvas-end loc-panel"
        id="merchantPanel"
        data-bs-backdrop="false"
        data-bs-scroll="true"
        data-bs-keyboard="true"
        tabIndex="-1"
      >
        {selMerchant && (
          <div className="offcanvas-body p-0">
            <MerchantPanel merchant={selMerchant} isAdmin={isAdmin} locations={locs} />
          </div>
        )}
      </div>
    </div>
  );
}

/* components/MapOverlay.js */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";

/**
 * MapOverlay
 * - Renders route vectors from map_route_segments + map_route_points
 * - Provides multi-route visibility toggles
 * - Admin-only: graph editor (branch from any point/segment, lift pen, save adds)
 *
 *
 * Integration expectations (map.js will be updated next):
 * - Render <MapOverlay imgRef={imgRef} scaleX={SCALE_X} scaleY={SCALE_Y} isAdmin={isAdmin} />
 * - Keep pins above overlays via z-index (globals.scss update will come later)
 */

const DEFAULT_TRADE_COLOR = "#00ffff";
const DEFAULT_EXCURSION_COLOR = "#ffa500";
const DEFAULT_OTHER_COLOR = "rgba(255,255,255,0.35)";

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function makeTempKey() {
  try {
    // browsers that support it
    return `t:${crypto.randomUUID()}`;
  } catch {
    // fallback
    return `t:${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }
}

function routeStroke(route) {
  const c = String(route?.color || "").trim();
  if (c) return c;
  const t = String(route?.route_type || "").trim().toLowerCase();
  if (t === "trade") return DEFAULT_TRADE_COLOR;
  if (t === "excursion") return DEFAULT_EXCURSION_COLOR;
  return DEFAULT_OTHER_COLOR;
}

function rawFromDbPoint(p, scaleX, scaleY) {
  return {
    x: toNum(p?.x) * (toNum(scaleX, 1) || 1),
    y: toNum(p?.y) * (toNum(scaleY, 1) || 1),
  };
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Distance from point P to segment AB in 2D
function pointToSegDistance(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;

  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return dist(p, a);

  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return dist(p, b);

  const t = c1 / c2;
  const proj = { x: a.x + t * vx, y: a.y + t * vy };
  return dist(p, proj);
}

function eventToRawPct(e, imgEl) {
  const rect = imgEl?.getBoundingClientRect?.();
  if (!rect) return null;
  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;
  if (px < 0 || py < 0 || px > 1 || py > 1) return null;
  return {
    x: Math.round(px * 1000) / 10, // 0..100 with 0.1 precision
    y: Math.round(py * 1000) / 10,
  };
}

function rawPctToDb(raw, scaleX, scaleY) {
  if (!raw) return null;
  const sx = toNum(scaleX, 1) || 1;
  const sy = toNum(scaleY, 1) || 1;
  return { x: raw.x / sx, y: raw.y / sy };
}

/**
 * Persist visible routes to localStorage so your map view stays stable across reloads.
 */
const LS_KEY_VISIBLE = "dndnext_visible_routes_v1";

function loadVisibleSet() {
  try {
    const raw = localStorage.getItem(LS_KEY_VISIBLE);
    const arr = JSON.parse(raw || "[]");
    if (Array.isArray(arr)) return new Set(arr.map((v) => String(v)));
  } catch {}
  return new Set();
}

function saveVisibleSet(set) {
  try {
    localStorage.setItem(LS_KEY_VISIBLE, JSON.stringify(Array.from(set)));
  } catch {}
}

export default function MapOverlay({
  imgRef,
  scaleX = 1,
  scaleY = 1,
  isAdmin = false,
  className = "",
}) {
  const sx = toNum(scaleX, 1) || 1;
  const sy = toNum(scaleY, 1) || 1;

  // Routes list (metadata)
  const [routes, setRoutes] = useState([]);
  const routesById = useMemo(() => {
    const m = new Map();
    (routes || []).forEach((r) => m.set(String(r.id), r));
    return m;
  }, [routes]);

  // Visibility
  const [panelOpen, setPanelOpen] = useState(false);
  const [visibleRouteIds, setVisibleRouteIds] = useState(() => loadVisibleSet());

  // Graph cache for visible routes
  const [pointsById, setPointsById] = useState(() => new Map()); // pointId -> point row
  const [segments, setSegments] = useState([]); // rows: {id, route_id, a_point_id, b_point_id}

  // Editor state (admin only)
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState("existing"); // "existing" | "new"
  const [editRouteId, setEditRouteId] = useState(""); // existing route id when editTarget="existing"
  const [draftMeta, setDraftMeta] = useState({
    name: "",
    route_type: "", // freeform text allowed; blank ok
    color: DEFAULT_TRADE_COLOR,
  });

  // Draft graph adds (works for "new" route OR "add to existing route")
  const [draftPoints, setDraftPoints] = useState([]); // { key, x, y } where key is "t:..." only
  const [draftEdges, setDraftEdges] = useState([]); // { aKey, bKey } where keys can be "p:<id>" or "t:..."
  const [anchorKey, setAnchorKey] = useState(null);

  // Route-point dragging (SVG)
  const svgRef = useRef(null);
  const suppressNextOverlayClickRef = useRef(false);
  const dragRef = useRef({
    active: false,
    kind: null, // 'draft' | 'existing'
    key: null, // 't:<id>' | 'p:<id>'
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    moved: false,
  });

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const hoverRef = useRef(null); // { raw:{x,y}, db:{x,y} }

  const clearDraft = useCallback(() => {
    setDraftPoints([]);
    setDraftEdges([]);
    setAnchorKey(null);
  }, []);

  // ---------- Load routes list ----------
  const loadRoutes = useCallback(async () => {
    const { data, error } = await supabase
      .from("map_routes")
      .select("id,name,route_type,color,is_loop")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setMsg(error.message || "Failed to load routes.");
      return;
    }

    const rows = (data || []).map((r) => ({
      ...r,
      id: String(r.id),
    }));

    setRoutes(rows);

    // Default visibility: if nothing stored yet, show trade routes by default.
    setVisibleRouteIds((prev) => {
      const prevHasAny = prev && prev.size > 0;
      if (prevHasAny) return prev;

      const next = new Set();
      rows.forEach((r) => {
        const t = String(r.route_type || "").toLowerCase();
        if (t === "trade") next.add(String(r.id));
      });
      saveVisibleSet(next);
      return next;
    });

    // Default edit route selection
    if (!editRouteId && rows.length) setEditRouteId(String(rows[0].id));
  }, [editRouteId]);

  // ---------- Load graph for visible routes ----------
  const loadGraph = useCallback(
    async (visibleIds) => {
      const ids = Array.from(visibleIds || []).map((v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
      });

      if (!ids.length) {
        setSegments([]);
        setPointsById(new Map());
        return;
      }

      // 1) segments for visible routes
      const segRes = await supabase
        .from("map_route_segments")
        .select("id,route_id,a_point_id,b_point_id")
        .in("route_id", ids);

      if (segRes.error) {
        console.error(segRes.error);
        setMsg(segRes.error.message || "Failed loading route segments.");
        return;
      }

      const segs = (segRes.data || []).map((s) => ({
        ...s,
        route_id: String(s.route_id),
        a_point_id: Number(s.a_point_id),
        b_point_id: Number(s.b_point_id),
      }));

      // 2) points needed by those segments (supports cross-route edges)
      const pointIds = Array.from(
        new Set(
          segs.flatMap((s) => [s.a_point_id, s.b_point_id]).filter((x) => Number.isFinite(x))
        )
      );

      if (!pointIds.length) {
        setSegments(segs);
        setPointsById(new Map());
        return;
      }

      const ptsRes = await supabase
        .from("map_route_points")
        .select("id,route_id,seq,x,y,location_id")
        .in("id", pointIds);

      if (ptsRes.error) {
        console.error(ptsRes.error);
        setMsg(ptsRes.error.message || "Failed loading route points.");
        return;
      }

      const map = new Map();
      (ptsRes.data || []).forEach((p) => {
        map.set(Number(p.id), {
          ...p,
          id: Number(p.id),
          route_id: String(p.route_id),
          seq: Number(p.seq),
          x: toNum(p.x),
          y: toNum(p.y),
          location_id: p.location_id ?? null,
        });
      });

      setSegments(segs);
      setPointsById(map);
    },
    []
  );

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  useEffect(() => {
    saveVisibleSet(visibleRouteIds);
    loadGraph(visibleRouteIds);
  }, [visibleRouteIds, loadGraph]);

  // ---------- Visibility toggles ----------
  const toggleVisible = useCallback((routeId) => {
    setVisibleRouteIds((prev) => {
      const next = new Set(prev);
      const key = String(routeId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveVisibleSet(next);
      return next;
    });
  }, []);

  const setOnlyVisible = useCallback((routeId) => {
    const next = new Set([String(routeId)]);
    saveVisibleSet(next);
    setVisibleRouteIds(next);
  }, []);

  // ---------- Editor: hit testing ----------
  const allRenderablePoints = useMemo(() => {
    const pts = [];

    // existing points (only those currently loaded via visible segments)
    pointsById.forEach((p) => {
      pts.push({ key: `p:${p.id}`, x: p.x, y: p.y, existingId: p.id });
    });

    // draft points
    (draftPoints || []).forEach((p) => {
      pts.push({ key: p.key, x: p.x, y: p.y, existingId: null });
    });

    return pts;
  }, [pointsById, draftPoints]);

  const draftPointByKey = useMemo(() => {
    const m = new Map();
    (draftPoints || []).forEach((p) => m.set(p.key, p));
    return m;
  }, [draftPoints]);

  const pointByKey = useCallback(
    (key) => {
      const k = String(key || "");
      if (k.startsWith("p:")) {
        const id = Number(k.slice(2));
        return pointsById.get(id) || null;
      }
      if (draftPointByKey.has(k)) return draftPointByKey.get(k);
      return null;
    },
    [pointsById, draftPointByKey]
  );

  const findNearestPointKey = useCallback(
    (rawPt) => {
      const threshold = 1.2; // in SVG units (0..100)
      let best = null;
      let bestD = Infinity;

      for (const p of allRenderablePoints) {
        const pr = { x: p.x * sx, y: p.y * sy };
        const d = dist(rawPt, pr);
        if (d < threshold && d < bestD) {
          bestD = d;
          best = p.key;
        }
      }
      return best;
    },
    [allRenderablePoints, sx, sy]
  );

  const findNearestSegment = useCallback(
    (rawPt) => {
      const threshold = 0.9; // in SVG units (0..100)
      let best = null;
      let bestD = Infinity;

      // existing segments (visible)
      for (const s of segments || []) {
        const a = pointsById.get(s.a_point_id);
        const b = pointsById.get(s.b_point_id);
        if (!a || !b) continue;
        const ar = { x: a.x * sx, y: a.y * sy };
        const br = { x: b.x * sx, y: b.y * sy };
        const d = pointToSegDistance(rawPt, ar, br);
        if (d < threshold && d < bestD) {
          bestD = d;
          best = {
            kind: "existing",
            route_id: String(s.route_id),
            aKey: `p:${a.id}`,
            bKey: `p:${b.id}`,
            segId: s.id,
          };
        }
      }

      // draft segments
      for (const s of draftEdges || []) {
        const a = pointByKey(s.aKey);
        const b = pointByKey(s.bKey);
        if (!a || !b) continue;
        const ar = { x: toNum(a.x) * sx, y: toNum(a.y) * sy };
        const br = { x: toNum(b.x) * sx, y: toNum(b.y) * sy };
        const d = pointToSegDistance(rawPt, ar, br);
        if (d < threshold && d < bestD) {
          bestD = d;
          best = { kind: "draft", aKey: s.aKey, bKey: s.bKey };
        }
      }

      return best;
    },
    [segments, pointsById, draftEdges, pointByKey, sx, sy]
  );

  // ---------- Editor: add nodes/edges ----------
  const addDraftPoint = useCallback((dbPt) => {
    const key = makeTempKey();
    const p = { key, x: toNum(dbPt.x), y: toNum(dbPt.y) };
    setDraftPoints((prev) => [...prev, p]);
    return key;
  }, []);

  const addEdge = useCallback((aKey, bKey) => {
    if (!aKey || !bKey || aKey === bKey) return;

    const ak = String(aKey);
    const bk = String(bKey);
    const k1 = ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;

    setDraftEdges((prev) => {
      const seen = new Set(prev.map((e) => (e.aKey < e.bKey ? `${e.aKey}|${e.bKey}` : `${e.bKey}|${e.aKey}`)));
      if (seen.has(k1)) return prev;
      return [...prev, { aKey: ak, bKey: bk }];
    });
  }, []);

  const clearAnchor = useCallback(() => setAnchorKey(null), []);

  // ---------- Click handling (editor overlay catches clicks) ----------
  const onOverlayClick = useCallback(
    (e) => {
      if (!editOpen || !isAdmin) return;

      // If we just initiated a point-drag, ignore the synthetic click that
      // fires after pointerup. Without this, dragging a point can be
      // interpreted as a normal overlay click which (a) sets anchor or
      // (b) creates a new point/edge.
      if (suppressNextOverlayClickRef.current) {
        suppressNextOverlayClickRef.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // If a drag is currently active, ignore overlay clicks.
      if (dragRef.current?.active) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const imgEl = imgRef?.current;
      const raw = eventToRawPct(e, imgEl);
      if (!raw) return;

      // prevent map.js parent click handling (add location, etc.)
      e.preventDefault();
      e.stopPropagation();

      const rawPt = { x: raw.x, y: raw.y };
      const db = rawPctToDb(raw, sx, sy);
      hoverRef.current = { raw, db };

      // 1) point hit
      const hitPointKey = findNearestPointKey(rawPt);
      if (hitPointKey) {
        if (!anchorKey) {
          setAnchorKey(hitPointKey);
        } else {
          addEdge(anchorKey, hitPointKey);
          setAnchorKey(hitPointKey); // continue from new point (still allows “lift pen” via Clear Anchor)
        }
        return;
      }

      // 2) segment hit (branch from segment)
      const hitSeg = findNearestSegment(rawPt);
      if (hitSeg) {
        const newKey = addDraftPoint(db);

        // connect to segment endpoints to create a proper junction
        addEdge(hitSeg.aKey, newKey);
        addEdge(hitSeg.bKey, newKey);

        // if we already had an anchor, branch from it too
        if (anchorKey) addEdge(anchorKey, newKey);

        setAnchorKey(newKey);
        return;
      }

      // 3) empty space: create point; connect if anchored
      const newKey = addDraftPoint(db);
      if (anchorKey) addEdge(anchorKey, newKey);
      setAnchorKey(newKey);
    },
    [
      editOpen,
      isAdmin,
      imgRef,
      sx,
      sy,
      findNearestPointKey,
      findNearestSegment,
      anchorKey,
      addDraftPoint,
      addEdge,
    ]
  );

  const getXYFromPointerEvent = useCallback(
    (e) => {
      const svgEl = svgRef.current;
      if (!svgEl) return null;
      const rect = svgEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      return { x: clamp01(x), y: clamp01(y) };
    },
    []
  );

  const beginPointDrag = useCallback(
    (e, pointKey) => {
      if (!editOpen || !isAdmin || !editMode) return;

      // Prevent the overlay click (add-point) from firing after a drag.
      suppressNextOverlayClickRef.current = true;
      e.preventDefault();
      e.stopPropagation();

      dragRef.current = {
        active: true,
        key: pointKey,
        kind: pointKey.startsWith("t:") ? "draft" : "existing",
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        moved: false,
      };

      try {
        svgRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    },
    [editOpen, isAdmin, editMode]
  );

  const onOverlayPointerMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d?.active) return;
      if (d.pointerId != null && e.pointerId !== d.pointerId) return;

      const pos = getXYFromPointerEvent(e);
      if (!pos) return;

      const movedEnough =
        Math.abs(e.clientX - d.startClientX) + Math.abs(e.clientY - d.startClientY) > 3;
      if (movedEnough) d.moved = true;

      if (d.kind === "draft") {
        setDraftPoints((prev) =>
          prev.map((p) => (p.key === d.key ? { ...p, x: pos.x, y: pos.y } : p))
        );
        return;
      }

      const pointId = Number(d.key.startsWith("p:") ? d.key.slice(2) : d.key);
      if (!Number.isFinite(pointId)) return;

      setPointsById((prev) => {
        const next = new Map(prev);
        const cur = next.get(pointId);
        if (!cur) return prev;
        next.set(pointId, { ...cur, x: pos.x, y: pos.y });
        return next;
      });
    },
    [getXYFromPointerEvent]
  );

  const onOverlayPointerUp = useCallback(
    async (e) => {
      const d = dragRef.current;
      if (!d?.active) return;
      if (d.pointerId != null && e.pointerId !== d.pointerId) return;

      // Release pointer capture
      try {
        svgRef.current?.releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }

      dragRef.current = {
        active: false,
        kind: null,
        key: null,
        pointerId: null,
        startClientX: 0,
        startClientY: 0,
        moved: false,
      };

      // If no movement, treat it as a normal click (anchor selection, edge split, etc.)
      // Clear suppression immediately so the upcoming click event is handled normally.
      if (!d.moved) {
        suppressNextOverlayClickRef.current = false;
        return;
      }

      // Keep suppression enabled; the synthetic click after pointerup will be
      // consumed by onOverlayClick, which will clear the flag.

      // Persist existing point position changes to DB.
      if (d.kind === "existing") {
        const pointId = Number(d.key.startsWith("p:") ? d.key.slice(2) : d.key);
        if (!Number.isFinite(pointId)) return;
        const latest = pointsById.get(pointId);
        if (!latest) return;

        const { error } = await supabase
          .from("map_route_points")
          .update({ x: latest.x, y: latest.y })
          .eq("id", pointId);
        if (error) {
          console.error("Failed to update route point position", error);
        }
      }
    },
    [pointsById, supabase]
  );

  // ---------- Save (writes only when you click save) ----------
  const saveDraft = useCallback(async () => {
    if (!isAdmin) return;

    const isNew = editTarget === "new";
    const targetRouteId = isNew ? null : String(editRouteId || "");

    if (busy) return;
    setMsg("");

    // Basic validation
    const name = String(draftMeta.name || "").trim();
    if (isNew && !name) {
      setMsg("Route name is required to save a new route.");
      return;
    }

    if (!draftEdges.length) {
      setMsg("No segments to save yet. Create at least one edge/segment.");
      return;
    }

    setBusy(true);

    try {
      let routeId = targetRouteId;

      // Create route only at save-time (per your requirement)
      if (isNew) {
        const route_type = String(draftMeta.route_type || "").trim() || null;
        const color = String(draftMeta.color || "").trim() || null;

        const ins = await supabase
          .from("map_routes")
          .insert({
            name,
            route_type,
            color,
          })
          .select("id")
          .single();

        if (ins.error) throw ins.error;
        routeId = String(ins.data.id);
      }

      if (!routeId) {
        throw new Error("No route selected/created.");
      }

      // Determine seq base for new points
      let baseSeq = 0;
      const maxRes = await supabase
        .from("map_route_points")
        .select("seq")
        .eq("route_id", routeId)
        .order("seq", { ascending: false })
        .limit(1);

      if (!maxRes.error && (maxRes.data || []).length) {
        baseSeq = Number(maxRes.data[0].seq) || 0;
      }

      // Insert new points (draftPoints only)
      const tempToInsertedId = new Map();
      if (draftPoints.length) {
        const payload = draftPoints.map((p, i) => ({
          route_id: routeId,
          seq: baseSeq + i + 1,
          x: toNum(p.x),
          y: toNum(p.y),
          location_id: null,
        }));

        const ptsIns = await supabase
          .from("map_route_points")
          .insert(payload)
          .select("id,seq,x,y");

        if (ptsIns.error) throw ptsIns.error;

        // Map draft points in insertion order to returned rows (Supabase returns in inserted order)
        (ptsIns.data || []).forEach((row, idx) => {
          const key = draftPoints[idx]?.key;
          if (key) tempToInsertedId.set(key, Number(row.id));
        });
      }

      // Resolve an edge endpoint key into a point_id
      const resolveKeyToPointId = (key) => {
        const k = String(key || "");
        if (k.startsWith("p:")) return Number(k.slice(2));
        if (tempToInsertedId.has(k)) return tempToInsertedId.get(k);
        return null;
      };

      // Insert segments
      const segPayload = [];
      for (const e of draftEdges) {
        const aId = resolveKeyToPointId(e.aKey);
        const bId = resolveKeyToPointId(e.bKey);
        if (!aId || !bId || aId === bId) continue;
        segPayload.push({
          route_id: routeId,
          a_point_id: aId,
          b_point_id: bId,
        });
      }

      if (!segPayload.length) {
        throw new Error("No valid segments to insert (endpoint resolution failed).");
      }

      const segIns = await supabase.from("map_route_segments").insert(segPayload);
      if (segIns.error) throw segIns.error;

      // Reload and clear draft
      await loadRoutes();
      setVisibleRouteIds((prev) => {
        const next = new Set(prev);
        next.add(String(routeId));
        saveVisibleSet(next);
        return next;
      });

      clearDraft();
      setEditTarget("existing");
      setEditRouteId(String(routeId));
      setDraftMeta((m) => ({
        ...m,
        name: "",
        route_type: "",
        color: DEFAULT_TRADE_COLOR,
      }));

      setMsg("Saved.");
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [
    isAdmin,
    editTarget,
    editRouteId,
    draftMeta,
    draftPoints,
    draftEdges,
    busy,
    loadRoutes,
    clearDraft,
  ]);

  // ---------- Render helpers ----------
  const visibleSegments = useMemo(() => {
    const vis = visibleRouteIds;
    if (!vis.size) return [];

    return (segments || []).filter((s) => vis.has(String(s.route_id)));
  }, [segments, visibleRouteIds]);

  const renderLines = useMemo(() => {
    const lines = [];

    for (const s of visibleSegments) {
      const a = pointsById.get(s.a_point_id);
      const b = pointsById.get(s.b_point_id);
      if (!a || !b) continue;

      const ar = rawFromDbPoint(a, sx, sy);
      const br = rawFromDbPoint(b, sx, sy);

      const r = routesById.get(String(s.route_id));
      const stroke = routeStroke(r);

      lines.push({
        key: `seg:${s.id}`,
        routeId: String(s.route_id),
        aKey: `p:${a.id}`,
        bKey: `p:${b.id}`,
        x1: ar.x,
        y1: ar.y,
        x2: br.x,
        y2: br.y,
        stroke,
      });
    }

    // Draft edges preview (yellow)
    for (let i = 0; i < (draftEdges || []).length; i++) {
      const e = draftEdges[i];
      const a = pointByKey(e.aKey);
      const b = pointByKey(e.bKey);
      if (!a || !b) continue;

      const ar = { x: toNum(a.x) * sx, y: toNum(a.y) * sy };
      const br = { x: toNum(b.x) * sx, y: toNum(b.y) * sy };

      lines.push({
        key: `draft:${i}`,
        routeId: "draft",
        aKey: e.aKey,
        bKey: e.bKey,
        x1: ar.x,
        y1: ar.y,
        x2: br.x,
        y2: br.y,
        stroke: "rgba(255, 202, 40, 0.95)",
        draft: true,
      });
    }

    return lines;
  }, [visibleSegments, pointsById, sx, sy, routesById, draftEdges, pointByKey]);

  const renderPoints = useMemo(() => {
    if (!editOpen) return [];

    const pts = [];

    // Existing points that are part of visible segments
    const usedIds = new Set();
    visibleSegments.forEach((s) => {
      usedIds.add(s.a_point_id);
      usedIds.add(s.b_point_id);
    });

    usedIds.forEach((id) => {
      const p = pointsById.get(id);
      if (!p) return;
      pts.push({
        key: `p:${p.id}`,
        x: p.x * sx,
        y: p.y * sy,
        kind: "existing",
      });
    });

    // Draft points
    (draftPoints || []).forEach((p) => {
      pts.push({
        key: p.key,
        x: p.x * sx,
        y: p.y * sy,
        kind: "draft",
      });
    });

    return pts;
  }, [editOpen, visibleSegments, pointsById, draftPoints, sx, sy]);

  // ---------- UI ----------
  return (
    <>
      {/* Floating controls panel (routes visibility always; editor only for admins) */}
      <div className="route-float-panel" style={{ position: "absolute", left: 10, top: 10, zIndex: 50 }}>
        <div className="card" style={{ minWidth: 260, maxWidth: 340 }}>
          <div className="card-header d-flex align-items-center justify-content-between py-2">
            <div className="fw-bold">Routes</div>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPanelOpen((v) => !v);
              }}
              type="button"
            >
              {panelOpen ? "Hide" : "Show"}
            </button>
          </div>

          {panelOpen && (
            <div className="card-body py-2">
              <div className="small text-muted mb-2">Toggle multiple routes on/off.</div>

              <div className="d-flex flex-column gap-1" style={{ maxHeight: 220, overflowY: "auto" }}>
                {(routes || []).map((r) => {
                  const rid = String(r.id);
                  const checked = visibleRouteIds.has(rid);
                  const stroke = routeStroke(r);

                  return (
                    <label key={rid} className="form-check d-flex align-items-center gap-2 mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleVisible(rid)}
                      />
                      <span
                        className="rounded"
                        style={{
                          width: 14,
                          height: 14,
                          background: stroke,
                          border: "1px solid rgba(255,255,255,0.25)",
                          display: "inline-block",
                        }}
                        title={stroke}
                      />
                      <span className="form-check-label" style={{ cursor: "pointer" }}>
                        {r.name}
                        {r.route_type ? <span className="text-muted"> ({r.route_type})</span> : null}
                      </span>

                      {checked && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-dark ms-auto"
                          title="Solo"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOnlyVisible(rid);
                          }}
                        >
                          Solo
                        </button>
                      )}
                    </label>
                  );
                })}
              </div>

              {isAdmin && (
                <>
                  <hr className="my-2" />
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="fw-bold">Editor</div>
                    <button
                      type="button"
                      className={`btn btn-sm ${editOpen ? "btn-info" : "btn-outline-info"}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditOpen((v) => !v);
                        setMsg("");
                        clearDraft();
                      }}
                    >
                      {editOpen ? "Exit" : "Edit"}
                    </button>
                  </div>

                  {editOpen && (
                    <div className="mt-2">
                      <div className="mb-2">
                        <div className="btn-group w-100">
                          <button
                            type="button"
                            className={`btn btn-sm ${editTarget === "existing" ? "btn-primary" : "btn-outline-primary"}`}
                            onClick={() => {
                              setEditTarget("existing");
                              setMsg("");
                              clearDraft();
                            }}
                          >
                            Add to existing
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${editTarget === "new" ? "btn-primary" : "btn-outline-primary"}`}
                            onClick={() => {
                              setEditTarget("new");
                              setMsg("");
                              clearDraft();
                            }}
                          >
                            New route
                          </button>
                        </div>
                      </div>

                      {editTarget === "existing" && (
                        <div className="mb-2">
                          <label className="form-label small mb-1">Route</label>
                          <select
                            className="form-select form-select-sm"
                            value={editRouteId}
                            onChange={(e) => {
                              setEditRouteId(e.target.value);
                              setMsg("");
                              clearDraft();
                            }}
                          >
                            {(routes || []).map((r) => (
                              <option key={String(r.id)} value={String(r.id)}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          <div className="form-text">
                            You can anchor from any visible point/segment and save new segments into this route.
                          </div>
                        </div>
                      )}

                      {editTarget === "new" && (
                        <div className="mb-2">
                          <label className="form-label small mb-1">New route metadata (saved only on Save)</label>

                          <input
                            className="form-control form-control-sm mb-2"
                            placeholder="Route name"
                            value={draftMeta.name}
                            onChange={(e) => setDraftMeta((m) => ({ ...m, name: e.target.value }))}
                          />

                          <input
                            className="form-control form-control-sm mb-2"
                            placeholder="Route type (optional): trade / excursion / etc"
                            value={draftMeta.route_type}
                            onChange={(e) => setDraftMeta((m) => ({ ...m, route_type: e.target.value }))}
                            list="routeTypeHints"
                          />
                          <datalist id="routeTypeHints">
                            <option value="trade" />
                            <option value="excursion" />
                            <option value="adventure" />
                          </datalist>

                          <div className="d-flex align-items-center gap-2">
                            <label className="form-label small mb-0">Color</label>
                            <input
                              type="color"
                              value={draftMeta.color || DEFAULT_TRADE_COLOR}
                              onChange={(e) => setDraftMeta((m) => ({ ...m, color: e.target.value }))}
                              title="Pick route color"
                            />
                            <span className="small text-muted">{draftMeta.color}</span>
                          </div>
                        </div>
                      )}

                      <div className="d-flex flex-wrap gap-2 mt-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            clearAnchor();
                          }}
                          disabled={!anchorKey}
                          title="Lift pen"
                        >
                          Clear anchor
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDraftEdges((prev) => prev.slice(0, -1));
                          }}
                          disabled={!draftEdges.length}
                        >
                          Undo edge
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            clearDraft();
                          }}
                          disabled={!draftEdges.length && !draftPoints.length && !anchorKey}
                        >
                          Clear draft
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-success ms-auto"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            saveDraft();
                          }}
                          disabled={busy || !draftEdges.length}
                          title="Writes points + segments to DB"
                        >
                          {busy ? "Saving…" : "Save"}
                        </button>
                      </div>

                      <div className="small text-muted mt-2">
                        Anchor: {anchorKey ? <code>{anchorKey}</code> : "none"} • Draft points:{" "}
                        {draftPoints.length} • Draft edges: {draftEdges.length}
                      </div>

                      {msg && <div className="small mt-2 text-warning">{msg}</div>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SVG overlay (routes below pins; admin clicks captured only when editOpen) */}
      <svg
        ref={svgRef}
        className={`map-vectors route-overlay ${className}`.trim()}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          // allow pointer events only for editing
          pointerEvents: editOpen && isAdmin ? "auto" : "none",
        }}
        onClick={onOverlayClick}
        onPointerMove={onOverlayPointerMove}
        onPointerUp={onOverlayPointerUp}
      >
        {/* Existing segments */}
        {renderLines.map((ln) => (
          <line
            key={ln.key}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke={ln.stroke}
            strokeWidth={ln.draft ? 0.7 : 0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={ln.draft ? 0.95 : 0.7}
            style={{
              // in edit mode, allow clicking near segments
              pointerEvents: editOpen && isAdmin ? "stroke" : "none",
              cursor: editOpen && isAdmin ? "crosshair" : "default",
            }}
          />
        ))}

        {/* Point markers (editor only) */}
        {renderPoints.map((p) => (
          <circle
            key={p.key}
            cx={p.x}
            cy={p.y}
            r={p.key === anchorKey ? 1.2 : p.kind === "draft" ? 1.0 : 0.8}
            fill={
              p.key === anchorKey
                ? "rgba(255, 202, 40, 0.95)"
                : p.kind === "draft"
                ? "rgba(255,255,255,0.95)"
                : "rgba(0,230,255,0.95)"
            }
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={0.2}
            onPointerDown={(e) => beginPointDrag(e, p.key)}
            style={{
              pointerEvents: editOpen && isAdmin ? "auto" : "none",
              cursor: editOpen && isAdmin && editMode ? "move" : "default",
            }}
          />
        ))}
      </svg>
    </>
  );
}

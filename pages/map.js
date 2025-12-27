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

    // pathing state
    route_id: row.route_id,
    route_mode: row.route_mode,
    state: row.state,
    rest_until: row.rest_until,
    route_point_seq: row.route_point_seq,
    route_segment_progress: row.route_segment_progress,
    current_point_seq: row.current_point_seq,
    next_point_seq: row.next_point_seq,
    prev_point_seq: row.prev_point_seq,
    segment_started_at: row.segment_started_at,
    segment_ends_at: row.segment_ends_at,
  };
};

function distPoint(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// point-to-segment distance in DB coords
function distPointToSegment(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;

  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return distPoint(p, a);

  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return distPoint(p, b);

  const t = c1 / c2;
  const proj = { x: a.x + t * vx, y: a.y + t * vy };
  return distPoint(p, proj);
}

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
  const [showGrid, setShowGrid] = useState(false);
  const [gridStep, setGridStep] = useState(5); // in DB “map units” (0..100 space)
  const [hoverPt, setHoverPt] = useState(null); // DB coords {x,y}
  const [lastClickPt, setLastClickPt] = useState(null); // DB coords {x,y}

  // Ruler (DB coords; click to start, mouse moves end, click to stop)
  const [rulerArmed, setRulerArmed] = useState(false);
  const [rulerActive, setRulerActive] = useState(false);
  const [rulerStart, setRulerStart] = useState(null); // DB coords {x,y}
  const [rulerEnd, setRulerEnd] = useState(null); // DB coords {x,y}

  // Routes (graph-based)
  const [routes, setRoutes] = useState([]); // map_routes rows
  const [routePoints, setRoutePoints] = useState([]); // map_route_points rows
  const [routeEdges, setRouteEdges] = useState([]); // map_route_edges rows

  const [visibleRouteIds, setVisibleRouteIds] = useState([]); // multi-route visibility
  const [routePanelOpen, setRoutePanelOpen] = useState(false); // offcanvas show
  const [routeEdit, setRouteEdit] = useState(false); // admin edit mode
  const [activeRouteId, setActiveRouteId] = useState(null);

  // Draft route (local until Save)
  const [draftRouteId, setDraftRouteId] = useState(null); // bigint for existing route, null for new
  const [draftMeta, setDraftMeta] = useState({
    name: "",
    route_type: "trade",
    color: "#00ffff",
    is_loop: false,
  });
  const [draftPoints, setDraftPoints] = useState([]); // [{id? bigint, tempId? string, seq, x,y, location_id?, dwell_seconds}]
  const [draftEdges, setDraftEdges] = useState([]); // [{a, b}] where a/b are point keys (db id or tempId)
  const [draftAnchor, setDraftAnchor] = useState(null); // point key to connect next segment from
  const [draftDirty, setDraftDirty] = useState(false);

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
          "rest_until",
          "route_point_seq",
          "route_segment_progress",
          "current_point_seq",
          "next_point_seq",
          "prev_point_seq",
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
    const { data, error } = await supabase
      .from("map_routes")
      .select("id,name,code,route_type,color,is_loop")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setErr(error.message);
      return;
    }

    const list = data || [];
    setRoutes(list);

    // default visibility: show trade/teal routes if nothing selected yet
    setVisibleRouteIds((prev) => {
      if (prev && prev.length) return prev;
      const trade = list
        .filter((r) => ["trade", "teal"].includes(String(r.route_type || "").toLowerCase()))
        .map((r) => r.id);
      return trade.length ? trade : list.map((r) => r.id);
    });

    // default active route for admin editing
    if (!activeRouteId && list.length) setActiveRouteId(list[0].id);
  }, [activeRouteId]);

  const loadRouteGraph = useCallback(async (routeIds) => {
    const ids = (routeIds || []).filter(Boolean);
    if (!ids.length) {
      setRoutePoints([]);
      setRouteEdges([]);
      return;
    }

    const [ptsRes, edgRes] = await Promise.all([
      supabase
        .from("map_route_points")
        .select("id,route_id,seq,x,y,location_id,dwell_seconds")
        .in("route_id", ids),
      supabase
        .from("map_route_edges")
        .select("id,route_id,a_point_id,b_point_id")
        .in("route_id", ids),
    ]);

    if (ptsRes.error) {
      console.error(ptsRes.error);
      setErr(ptsRes.error.message);
    } else {
      setRoutePoints(ptsRes.data || []);
    }

    if (edgRes.error) {
      console.error(edgRes.error);
      setErr(edgRes.error.message);
    } else {
      setRouteEdges(edgRes.data || []);
    }
  }, []);

  /* Initial load */
  useEffect(() => {
    (async () => {
      await checkAdmin();
      await Promise.all([loadLocations(), loadMerchants(), loadRoutes()]);
    })();
  }, [checkAdmin, loadLocations, loadMerchants, loadRoutes]);

  /* Load graph for visible routes (and keep it fresh when toggles change) */
  useEffect(() => {
    loadRouteGraph(visibleRouteIds);
  }, [visibleRouteIds, loadRouteGraph]);

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

  useEffect(() => {
    if (!routePanelOpen) return;
    const el = document.getElementById("routePanel");
    if (el && window.bootstrap) window.bootstrap.Offcanvas.getOrCreateInstance(el).show();
  }, [routePanelOpen]);

  // Ensure dim clears even on ESC/backdrop dismiss
  useEffect(() => {
    const locEl = document.getElementById("locPanel");
    const merEl = document.getElementById("merchantPanel");
    const routeEl = document.getElementById("routePanel");

    const clearSel = () => {
      setSelLoc(null);
      setSelMerchant(null);
    };
    const clearRoute = () => setRoutePanelOpen(false);

    if (locEl) locEl.addEventListener("hidden.bs.offcanvas", clearSel);
    if (merEl) merEl.addEventListener("hidden.bs.offcanvas", clearSel);
    if (routeEl) routeEl.addEventListener("hidden.bs.offcanvas", clearRoute);

    return () => {
      if (locEl) locEl.removeEventListener("hidden.bs.offcanvas", clearSel);
      if (merEl) merEl.removeEventListener("hidden.bs.offcanvas", clearSel);
      if (routeEl) routeEl.removeEventListener("hidden.bs.offcanvas", clearRoute);
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
        setDraftAnchor(null);
        setRepositionLocId("");
        setRepositionMerchId("");
      } else {
        setRulerActive(false);
      }
      return next;
    });
  }

  function clearRuler() {
    setRulerActive(false);
    setRulerStart(null);
    setRulerEnd(null);
  }

  function toggleRouteEdit() {
    if (!isAdmin) return;
    setRouteEdit((v) => {
      const next = !v;
      if (next) {
        setAddMode(false);
        setRulerArmed(false);
        setRulerActive(false);
        setRepositionLocId("");
        setRepositionMerchId("");
        setShowGrid(true);
      } else {
        setDraftAnchor(null);
      }
      return next;
    });
  }

  async function copyText(s) {
    try {
      await navigator.clipboard.writeText(s);
    } catch {
      alert(s); // fallback
    }
  }

  /* ---------- Routes: derived maps ---------- */
  const pointsById = useMemo(() => {
    const m = new Map();
    for (const p of routePoints || []) m.set(String(p.id), p);
    return m;
  }, [routePoints]);

  const routeStrokeFor = useCallback((r) => {
    const t = String(r?.route_type || "").toLowerCase();
    const c = String(r?.color || "").trim();
    if (c) return c;
    if (t === "excursion" || t === "adventure") return "rgba(255,165,0,0.75)";
    // trade/teal default
    return "rgba(0,255,255,0.65)";
  }, []);

  const visibleRoutes = useMemo(() => {
    const set = new Set(visibleRouteIds || []);
    return (routes || []).filter((r) => set.has(r.id));
  }, [routes, visibleRouteIds]);

  const visibleEdges = useMemo(() => {
    const set = new Set(visibleRouteIds || []);
    return (routeEdges || []).filter((e) => set.has(e.route_id));
  }, [routeEdges, visibleRouteIds]);

  /* ---------- Draft helpers ---------- */
  const draftKey = (p) => (p.id != null ? String(p.id) : String(p.tempId));

  const draftPointByKey = useMemo(() => {
    const m = new Map();
    for (const p of draftPoints || []) m.set(draftKey(p), p);
    return m;
  }, [draftPoints]);

  function nextDraftSeq() {
    const seqs = (draftPoints || []).map((p) => Number(p.seq) || 0);
    const max = seqs.length ? Math.max(...seqs) : 0;
    return max + 1;
  }

  function addDraftPoint(db) {
    const tempId = `tmp-${Math.random().toString(16).slice(2, 10)}`;
    const p = {
      tempId,
      seq: nextDraftSeq(),
      x: db.x,
      y: db.y,
      location_id: null,
      dwell_seconds: 0,
    };
    setDraftPoints((prev) => [...prev, p]);
    setDraftDirty(true);
    return draftKey(p);
  }

  function edgeKey(a, b) {
    const aa = String(a);
    const bb = String(b);
    return aa < bb ? `${aa}|${bb}` : `${bb}|${aa}`;
  }

  function addDraftEdge(a, b) {
    if (!a || !b || a === b) return;
    const k = edgeKey(a, b);
    setDraftEdges((prev) => {
      if (prev.some((e) => edgeKey(e.a, e.b) === k)) return prev;
      return [...prev, { a, b }];
    });
    setDraftDirty(true);
  }

  function removeDraftEdgeByKey(k) {
    setDraftEdges((prev) => prev.filter((e) => edgeKey(e.a, e.b) !== k));
    setDraftDirty(true);
  }

  function findDraftHit(db) {
    const pts = draftPoints || [];
    if (!pts.length) return { hitPoint: null, hitEdge: null };

    // point hit
    const ptTol = 1.0; // DB units
    let bestPt = null;
    let bestD = Infinity;
    for (const p of pts) {
      const d = distPoint(db, { x: p.x, y: p.y });
      if (d < bestD) {
        bestD = d;
        bestPt = p;
      }
    }
    if (bestPt && bestD <= ptTol) return { hitPoint: draftKey(bestPt), hitEdge: null };

    // edge hit
    const edTol = 0.7;
    let bestEdge = null;
    let bestEd = Infinity;
    for (const e of draftEdges || []) {
      const a = draftPointByKey.get(String(e.a));
      const b = draftPointByKey.get(String(e.b));
      if (!a || !b) continue;
      const d = distPointToSegment(db, { x: a.x, y: a.y }, { x: b.x, y: b.y });
      if (d < bestEd) {
        bestEd = d;
        bestEdge = edgeKey(e.a, e.b);
      }
    }
    if (bestEdge && bestEd <= edTol) return { hitPoint: null, hitEdge: bestEdge };

    return { hitPoint: null, hitEdge: null };
  }

  /* ---------- Routes: load into draft ---------- */
  async function beginEditRoute(routeId) {
    if (!isAdmin) return;
    const rid = Number(routeId);
    if (!rid) return;

    const r = routes.find((x) => x.id === rid);
    if (!r) return;

    // load points + edges for this route (fresh)
    const [ptsRes, edgRes] = await Promise.all([
      supabase
        .from("map_route_points")
        .select("id,route_id,seq,x,y,location_id,dwell_seconds")
        .eq("route_id", rid)
        .order("seq", { ascending: true }),
      supabase
        .from("map_route_edges")
        .select("id,route_id,a_point_id,b_point_id")
        .eq("route_id", rid),
    ]);

    if (ptsRes.error) return alert(ptsRes.error.message);
    if (edgRes.error) return alert(edgRes.error.message);

    setDraftRouteId(rid);
    setDraftMeta({
      name: r.name || "",
      route_type: r.route_type || "trade",
      color: r.color || "#00ffff",
      is_loop: !!r.is_loop,
    });

    const pts = (ptsRes.data || []).map((p) => ({
      id: p.id,
      seq: p.seq,
      x: Number(p.x),
      y: Number(p.y),
      location_id: p.location_id ?? null,
      dwell_seconds: Number(p.dwell_seconds || 0),
    }));

    const edges = (edgRes.data || []).map((e) => ({
      a: String(e.a_point_id),
      b: String(e.b_point_id),
    }));

    setDraftPoints(pts);
    setDraftEdges(edges);
    setDraftAnchor(null);
    setDraftDirty(false);

    // ensure editor is on (but keep panel layout)
    setRouteEdit(true);
  }

  function beginNewRoute() {
    if (!isAdmin) return;
    setDraftRouteId(null);
    setDraftMeta({
      name: "",
      route_type: "trade",
      color: "#00ffff",
      is_loop: false,
    });
    setDraftPoints([]);
    setDraftEdges([]);
    setDraftAnchor(null);
    setDraftDirty(false);
    setRouteEdit(true);
  }

  async function saveDraftRoute() {
    if (!isAdmin) return;

    const name = String(draftMeta.name || "").trim();
    if (!name) return alert("Route name is required.");
    if (!draftPoints.length) return alert("Add at least one point.");
    if (!draftEdges.length) return alert("Add at least one edge.");

    let routeId = draftRouteId;

    // Create route on save (new routes are local until this point)
    if (!routeId) {
      const code = `${slugify(name)}-${Math.random().toString(16).slice(2, 6)}`;
      const ins = await supabase
        .from("map_routes")
        .insert({
          name,
          code,
          route_type: String(draftMeta.route_type || "trade"),
          color: String(draftMeta.color || "").trim() || null,
          is_loop: !!draftMeta.is_loop,
        })
        .select("id")
        .single();

      if (ins.error) return alert(ins.error.message);
      routeId = ins.data?.id;
      if (!routeId) return alert("Failed to create route (no id returned).");
    } else {
      const upd = await supabase
        .from("map_routes")
        .update({
          name,
          route_type: String(draftMeta.route_type || "trade"),
          color: String(draftMeta.color || "").trim() || null,
          is_loop: !!draftMeta.is_loop,
        })
        .eq("id", routeId);

      if (upd.error) return alert(upd.error.message);
    }

    // Points: upsert existing, insert new; keep IDs stable
    const existing = draftPoints.filter((p) => p.id != null);
    const created = draftPoints.filter((p) => p.id == null);

    if (existing.length) {
      const up = await supabase.from("map_route_points").upsert(
        existing.map((p) => ({
          id: p.id,
          route_id: routeId,
          seq: Number(p.seq) || 1,
          x: Number(p.x) || 0,
          y: Number(p.y) || 0,
          location_id: p.location_id ?? null,
          dwell_seconds: Number(p.dwell_seconds || 0),
        })),
        { onConflict: "id" }
      );
      if (up.error) return alert(up.error.message);
    }

    // Insert new points (assign them seq values already in draft)
    let inserted = [];
    if (created.length) {
      const insPts = await supabase
        .from("map_route_points")
        .insert(
          created.map((p) => ({
            route_id: routeId,
            seq: Number(p.seq) || 1,
            x: Number(p.x) || 0,
            y: Number(p.y) || 0,
            location_id: p.location_id ?? null,
            dwell_seconds: Number(p.dwell_seconds || 0),
          }))
        )
        .select("id,seq");
      if (insPts.error) return alert(insPts.error.message);
      inserted = insPts.data || [];
    }

    // Map temp points to new DB ids by seq (seq must be unique per route)
    const seqToId = new Map(inserted.map((r) => [Number(r.seq), String(r.id)]));
    const keyToDbId = new Map();

    for (const p of draftPoints) {
      if (p.id != null) keyToDbId.set(draftKey(p), String(p.id));
      else keyToDbId.set(draftKey(p), seqToId.get(Number(p.seq)));
    }

    // Delete all edges for this route, then recreate (simple + reliable)
    const delE = await supabase.from("map_route_edges").delete().eq("route_id", routeId);
    if (delE.error) return alert(delE.error.message);

    const edgePayload = (draftEdges || [])
      .map((e) => {
        const a = keyToDbId.get(String(e.a));
        const b = keyToDbId.get(String(e.b));
        if (!a || !b || a === b) return null;
        return { route_id: routeId, a_point_id: Number(a), b_point_id: Number(b) };
      })
      .filter(Boolean);

    if (!edgePayload.length) return alert("No valid edges to save.");

    const insE = await supabase.from("map_route_edges").insert(edgePayload);
    if (insE.error) return alert(insE.error.message);

    // Reload routes + graph
    await loadRoutes();
    setDraftRouteId(routeId);
    setDraftDirty(false);

    setVisibleRouteIds((prev) => {
      const set = new Set(prev || []);
      set.add(routeId);
      return Array.from(set);
    });

    const nextVisible = Array.from(new Set([...(visibleRouteIds || []), routeId]));
    await loadRouteGraph(nextVisible);

    alert("Route saved.");
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
        const { error } = await supabase.from("locations").update({ x: db.x, y: db.y }).eq("id", repositionLocId);
        if (error) alert(error.message);
        setRepositionLocId("");
        await loadLocations();
      })();
      return;
    }

    if (repositionMerchId && db) {
      (async () => {
        const { error } = await supabase.from("merchants").update({ x: db.x, y: db.y }).eq("id", repositionMerchId);
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

    // Route editor (admin)
    if (routeEdit && isAdmin && db) {
      const hit = findDraftHit(db);

      // split edge if clicked
      if (hit.hitEdge) {
        const [aKey, bKey] = hit.hitEdge.split("|");
        const newKey = addDraftPoint(db);
        removeDraftEdgeByKey(hit.hitEdge);
        addDraftEdge(aKey, newKey);
        addDraftEdge(newKey, bKey);
        setDraftAnchor(newKey);
        return;
      }

      // connect from anchor to clicked point, or set anchor
      if (hit.hitPoint) {
        if (!draftAnchor) {
          setDraftAnchor(hit.hitPoint);
        } else {
          addDraftEdge(draftAnchor, hit.hitPoint);
          setDraftAnchor(hit.hitPoint);
        }
        return;
      }

      // empty: add a point and (if anchor exists) connect
      const newKey = addDraftPoint(db);
      if (draftAnchor) addDraftEdge(draftAnchor, newKey);
      setDraftAnchor(newKey);
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

  const gridOverlayStyle = useMemo(() => {
    const stepX = Math.max(1, Number(gridStep) || 5) * SCALE_X;
    const stepY = Math.max(1, Number(gridStep) || 5) * SCALE_Y;

    return {
      position: "absolute",
      inset: 0,
      zIndex: 2,
      pointerEvents: "none",
      backgroundImage:
        "linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)",
      backgroundSize: `${stepX}% ${stepY}%`,
      mixBlendMode: "overlay",
    };
  }, [gridStep]);

  const vectorsStyle = useMemo(
    () => ({
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      zIndex: 3,
      pointerEvents: "none",
    }),
    []
  );

  const pinsOverlayStyle = useMemo(
    () => ({
      position: "absolute",
      inset: 0,
      zIndex: 4,
      pointerEvents: "none",
    }),
    []
  );

  const rulerRawStart = useMemo(() => dbToRawPct(rulerStart), [rulerStart, dbToRawPct]);
  const rulerRawEnd = useMemo(() => dbToRawPct(rulerEnd), [rulerEnd, dbToRawPct]);
  const hoverRaw = useMemo(() => dbToRawPct(hoverPt), [hoverPt, dbToRawPct]);

  // Left docked route panel: keep below navbar, narrow width
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
                setDraftAnchor(null);
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

        <button
          className="btn btn-sm btn-outline-info"
          onClick={() => setRoutePanelOpen(true)}
          title="Show/hide routes"
        >
          Routes
        </button>

        {isAdmin && (
          <>
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
                setDraftAnchor(null);
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
                setDraftAnchor(null);
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

      {/* Map */}
      <div className="map-shell">
        {/* Visual dim: never blocks clicks */}
        <div className={`map-dim${selLoc || selMerchant ? " show" : ""}`} style={{ pointerEvents: "none" }} />

        <div
          className="map-wrap"
          style={{ position: "relative", display: "inline-block" }}
          onClick={handleMapClick}
          onMouseMove={handleMapMouseMove}
          onMouseLeave={() => setHoverPt(null)}
        >
          <img ref={imgRef} src={BASE_MAP_SRC} alt="World map" className="map-img" />

          {/* Grid (fixed: independent of globals.scss class name matching) */}
          {showGrid && <div className="map-grid" style={gridOverlayStyle} />}

          {/* Routes + vectors (routes below pins; ruler above routes) */}
          <svg className="map-vectors" style={vectorsStyle} viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Visible routes from DB */}
            {visibleRoutes.map((r) => {
              const stroke = routeStrokeFor(r);
              const edges = visibleEdges.filter((e) => e.route_id === r.id);
              return (
                <g key={`route-${r.id}`}>
                  {edges.map((e) => {
                    const a = pointsById.get(String(e.a_point_id));
                    const b = pointsById.get(String(e.b_point_id));
                    if (!a || !b) return null;
                    const ar = dbToRawPct({ x: Number(a.x), y: Number(a.y) });
                    const br = dbToRawPct({ x: Number(b.x), y: Number(b.y) });
                    if (!ar || !br) return null;
                    return (
                      <line
                        key={`edge-${e.id}`}
                        x1={ar.rawX}
                        y1={ar.rawY}
                        x2={br.rawX}
                        y2={br.rawY}
                        stroke={stroke}
                        strokeWidth="0.55"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Draft route overlay (admin edit mode) */}
            {isAdmin &&
              routeEdit &&
              draftEdges.map((e, i) => {
                const a = draftPointByKey.get(String(e.a));
                const b = draftPointByKey.get(String(e.b));
                if (!a || !b) return null;
                const ar = dbToRawPct({ x: a.x, y: a.y });
                const br = dbToRawPct({ x: b.x, y: b.y });
                if (!ar || !br) return null;
                return (
                  <line
                    key={`dedge-${i}`}
                    x1={ar.rawX}
                    y1={ar.rawY}
                    x2={br.rawX}
                    y2={br.rawY}
                    stroke={draftMeta.color || "rgba(0,200,255,.95)"}
                    strokeWidth="0.9"
                    strokeLinecap="round"
                  />
                );
              })}

            {isAdmin &&
              routeEdit &&
              draftPoints.map((p, i) => {
                const raw = dbToRawPct({ x: p.x, y: p.y });
                if (!raw) return null;
                const key = draftKey(p);
                const isAnchor = draftAnchor && String(draftAnchor) === String(key);
                return (
                  <circle
                    key={`dpt-${i}`}
                    cx={raw.rawX}
                    cy={raw.rawY}
                    r={isAnchor ? "1.25" : "0.95"}
                    fill={isAnchor ? "rgba(255,255,255,.95)" : "rgba(0,200,255,.95)"}
                    stroke="rgba(0,0,0,.6)"
                    strokeWidth="0.25"
                  />
                );
              })}

            {/* Ruler */}
            {rulerStart && rulerEnd && rulerRawStart && rulerRawEnd && (
              <>
                <line
                  x1={rulerRawStart.rawX}
                  y1={rulerRawStart.rawY}
                  x2={rulerRawEnd.rawX}
                  y2={rulerRawEnd.rawY}
                  stroke="rgba(255,193,7,.95)"
                  strokeWidth="0.55"
                />
                <circle cx={rulerRawStart.rawX} cy={rulerRawStart.rawY} r="0.85" fill="rgba(255,193,7,.95)" />
                <circle cx={rulerRawEnd.rawX} cy={rulerRawEnd.rawY} r="0.85" fill="rgba(255,193,7,.95)" />
              </>
            )}

            {/* Hover marker */}
            {hoverRaw && (rulerArmed || (routeEdit && isAdmin)) && (
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
          <div className="map-overlay" style={pinsOverlayStyle}>
            {/* Locations */}
            {locs.map((l) => {
              const lx = asPct(l.x);
              const ly = asPct(l.y);
              if (!Number.isFinite(lx) || !Number.isFinite(ly)) return null;

              return (
                <button
                  key={l.id}
                  className="map-pin pin-location"
                  style={{ left: `${lx * SCALE_X}%`, top: `${ly * SCALE_Y}%`, pointerEvents: "auto" }}
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
                  style={{ left: `${mx * SCALE_X}%`, top: `${my * SCALE_Y}%`, pointerEvents: "auto" }}
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
                  pointerEvents: "none",
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

      {/* Routes Offcanvas (LEFT + NARROW + editor inside) */}
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
            {routes.map((r) => {
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
                    style={{ background: r.color || undefined, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}
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

          {/* Route Editor section (moved here to reduce toolbar bloat) */}
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
                  {routes.map((r) => (
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
    </div>
  );
}

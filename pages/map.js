/*               pages/map.js   */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import RoutesPanel from "../components/RoutesPanel";
import { supabase } from "../utils/supabaseClient";
import MerchantPanel from "../components/MerchantPanel";
import NpcPanel from "../components/NpcPanel";
import LocationSideBar from "../components/LocationSideBar";
import LocationIconDrawer from "../components/LocationIconDrawer";
import { themeFromMerchant as detectTheme, emojiForTheme } from "../utils/merchantTheme";
import { MAP_ICONS_BUCKET, LOCAL_FALLBACK_ICON, mapIconDisplay } from "../utils/mapIcons";

/* ===== Map calibration (X had been saved in 4:3 space) =====
   Render uses SCALE_*; DB writes use inverse SCALE_*.
   After you re-save everything once, set SCALE_X back to 1.
*/
// Coordinate scaling was used temporarily during a coordinate migration.
// Dragging and hit-testing should track the cursor exactly.
const SCALE_X = 1.0;
const SCALE_Y = 1.0;

// NPC sprite sheet defaults (map-icons/npc-icons)
// Sprite-sheet defaults (can be overridden per-NPC later if we add metadata)
// Current placeholder sheets are 4-direction rows (D,L,R,U) with 9 frames each, 32x32 frames.
const SPRITE_FRAME_W = 32;
const SPRITE_FRAME_H = 32;
// Current NPC sheets in map-icons/npc-icons are 4-direction rows × 3-frame walk cycle columns.
// If we later mix formats, we'll store per-sheet metadata (frameW/frameH/framesPerDir/dirOrder) in manifest.json.
const SPRITE_FRAMES_PER_DIR = 3;
// Row order used by the free sheet you're using: down, left, right, up
const SPRITE_DIR_ORDER = ["down", "left", "right", "up"];

// Determine a 4-dir sprite facing based on velocity (vx/vy). Deadzone prevents jitter near zero.
function spriteDirFromVelocity(vx, vy, fallback = "down") {
  const dx = Number(vx || 0);
  const dy = Number(vy || 0);
  const dead = 0.00005;
  if (Math.abs(dx) < dead && Math.abs(dy) < dead) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}



// Map assets (must exist in /public)
const BASE_MAP_SRC = "/Wmap.jpg";

/* Utilities */
const asPct = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  const n = parseFloat(s.replace("%", ""));
  return Number.isFinite(n) ? n : NaN;
};

// Locations historically used either 0..1 (fraction) or 0..100 (percent).
// Normalize to 0..100 percent for rendering to fix X-axis drift on older rows.
const asLocPct = (v) => {
  const n = asPct(v);
  if (!Number.isFinite(n)) return NaN;
  if (n >= 0 && n <= 1.5) return n * 100;
  return n;
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
    inventory: row.inventory || [],
    icon: row.map_icons?.name || row.icon || null,
    map_icon_id: row.map_icon_id || null,
    map_icon: row.map_icons || null,
    roaming_speed: row.roaming_speed,
    location_id: row.location_id,
    last_known_location_id: row.last_known_location_id,
    projected_destination_id: row.projected_destination_id,
    bg_url: row.storefront_bg_url || row.bg_url || null,
    bg_image_url: row.storefront_bg_image_url || row.bg_image_url || null,
    bg_video_url: row.storefront_bg_video_url || row.bg_video_url || null,

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

// Shallow-route helper: update /map query params without a full reload.
// (Used for deep-linking to a selected location/NPC/merchant.)
function nextQuery(router, patch) {
  const curr = { ...(router?.query || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === null || v === undefined || v === "") delete curr[k];
    else curr[k] = v;
  }
  return curr;
}

export default function MapPage() {
  const router = useRouter();
  const openedMerchantFromQueryRef = useRef(false);
  const openedLocationFromQueryRef = useRef(false);
  const openedNpcFromQueryRef = useRef(false);

  const [locs, setLocs] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [mapNpcs, setMapNpcs] = useState([]);
  const [allNpcs, setAllNpcs] = useState([]); // used by LocationIconDrawer NPCs tab

  // NPC movement (right-click target)
  const [activeNpcId, setActiveNpcId] = useState(null); // selected in NPC drawer
  // Ref mirror so event handlers / RAF loops can read the current active NPC without stale closures.
  const activeNpcIdRef = useRef(null);
  const [npcMoveTargets, setNpcMoveTargets] = useState({}); // { [npcId]: { x, y, speed } } in raw pct coords
  // Global override speed for right-click movement (useful for testing / tuning)
  const [npcMoveSpeed, setNpcMoveSpeed] = useState(0.15);
  const npcMoveSpeedRef = useRef(0.15);
  const npcMoveTargetsRef = useRef({});
  const mapNpcsRef = useRef([]);

  // ---------------------------------------------------------------------------
  // Client-side smoothing for pins
  // We keep a lightweight velocity estimate per entity and extrapolate a short
  // window (<= ~12s). This removes the "tick" feel even when the DB updates are
  // coming from cron every 10s.
  // ---------------------------------------------------------------------------
  const motionRef = useRef({}); // { [key]: { x, y, tMs, vx, vy } }
  const MOTION_EXTRAP_MAX_S = 12;

  const ingestMotionSamples = useCallback((kind, rows) => {
    const nowMs = Date.now();
    const next = { ...(motionRef.current || {}) };
    (rows || []).forEach((r) => {
      if (!r?.id) return;
      const key = `${kind}:${r.id}`;
      const x = Number(r.x);
      const y = Number(r.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const prev = next[key];
      if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y) && Number.isFinite(prev.tMs)) {
        const dt = Math.max(0.001, (nowMs - prev.tMs) / 1000);
        const dx = x - prev.x;
        const dy = y - prev.y;
        // Basic velocity estimate; clamped to avoid crazy spikes on teleports.
        const vx = Math.max(-50, Math.min(50, dx / dt));
        const vy = Math.max(-50, Math.min(50, dy / dt));
        next[key] = { x, y, tMs: nowMs, vx, vy };
      } else {
        next[key] = { x, y, tMs: nowMs, vx: 0, vy: 0 };
      }
    });
    motionRef.current = next;
  }, []);

  useEffect(() => {
    npcMoveTargetsRef.current = npcMoveTargets;
  }, [npcMoveTargets]);

  useEffect(() => {
    npcMoveSpeedRef.current = npcMoveSpeed;
  }, [npcMoveSpeed]);

  useEffect(() => {
    mapNpcsRef.current = mapNpcs;
  }, [mapNpcs]);

  useEffect(() => {
    ingestMotionSamples('merchant', merchants);
  }, [merchants, ingestMotionSamples]);

  useEffect(() => {
    ingestMotionSamples('npc', mapNpcs);
  }, [mapNpcs, ingestMotionSamples]);

  useEffect(() => {
    activeNpcIdRef.current = activeNpcId;
  }, [activeNpcId]);

  // Right-click behavior:
  // 1) If you right-click on top of an NPC sprite, we "focus" that NPC
  //    (open the NPC tab in the drawer and set it active).
  // 2) Otherwise, if an NPC is active, we drop a temporary target and the NPC
  //    walks toward it (removing the marker on arrival).
  const pickNpcAtPct = useCallback((xPct, yPct) => {
    const npcs = mapNpcsRef.current || [];
    const base = 32; // frame size

    // Iterate top-to-bottom: last drawn is visually on top. mapNpcs is rendered in order.
    for (let i = npcs.length - 1; i >= 0; i -= 1) {
      const n = npcs[i];
      if (!n) continue;
      const sx = Number(n.x ?? n.x_pct ?? n.xPct ?? NaN);
      const sy = Number(n.y ?? n.y_pct ?? n.yPct ?? NaN);
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;

      const sc = Number.isFinite(Number(n.sprite_scale)) ? Number(n.sprite_scale) : 0.7;
      const halfW = (base * sc) / 2;
      const halfH = (base * sc) / 2;

      if (Math.abs(xPct - sx) <= halfW && Math.abs(yPct - sy) <= halfH) {
        return n;
      }
    }
    return null;
  }, []);


  const [addMode, setAddMode] = useState(false);
  const [clickPt, setClickPt] = useState(null); // raw/rendered 0..100 (% of visible map)
  const [err, setErr] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [selLoc, setSelLoc] = useState(null);
  const [selMerchant, setSelMerchant] = useState(null);
  const [selNpc, setSelNpc] = useState(null);

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

  // Drag & drop (admin-only): move NPC/Merchant pins on the map
  // Rule: "On Map" implies location_id is NULL and is_hidden is false.
  // Dragging also removes the character from any active route (route_id cleared).
  const dragRef = useRef(null); // { id, kind, startDb:{x,y}, didDrag:boolean }
  const lastDragTsRef = useRef(0);
  const [dragPreview, setDragPreview] = useState({});
  const [draggingKey, setDraggingKey] = useState(null); // previewKey(kind,id) while dragging

  // Location outline visibility (purple boxes)
  const [showLocationOutlines, setShowLocationOutlines] = useState(false);
  const [locationIcons, setLocationIcons] = useState([]);
  // Location marker palette + placement tool (admin)
  const [locationDrawerOpen, setLocationDrawerOpen] = useState(false);
  const [locationDrawerDefaultTab, setLocationDrawerDefaultTab] = useState("markers");
  const [placingLocation, setPlacingLocation] = useState(false);
  const [snapLocations, setSnapLocations] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem("dndnext_snap_locations") === "1";
    } catch {
      return true;
    }
  });

  // Prevent accidental location-marker drags. Admin can hold Alt to override while locked.
  const [lockLocationMarkers, setLockLocationMarkers] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const v = window.localStorage.getItem("dndnext_lock_location_markers");
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });


  // Marker config is used both for *placing* a new location and for *editing* an existing one.
  // If edit_location_id is non-null, the drawer is in "edit existing" mode.
  const [placeCfg, setPlaceCfg] = useState({
    icon_id: "",
    name: "",
    scale: 1,
    // UI uses a friendly anchor label; DB also stores numeric anchors.
    anchor: "Center",
    anchor_x: 0.5,
    // All location icons use a center anchor.
    anchor_y: 0.5,
    // Pixel offsets (stored in DB as *_px columns)
    x_offset_px: 0,
    y_offset_px: 0,
    rotation_deg: 0,
    edit_location_id: null,
  });


  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setPlacingLocation(false);
        // Also close the location UI stack (left panel + right marker drawer)
        setLocationDrawerOpen(false);
        setSelLoc(null);
        setPlaceCfg((c) => ({ ...c, edit_location_id: null }));
        try {
          const el = document.getElementById("locPanel");
          if (el && window.bootstrap) {
            const inst = window.bootstrap.Offcanvas.getInstance(el);
            if (inst) inst.hide();
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);



  useEffect(() => {
    try {
      const v = localStorage.getItem("dndnext_show_location_outlines");
      if (v === "1") setShowLocationOutlines(true);
    } catch {
      // ignore
    }
  }, []);

  const toggleLocationOutlines = useCallback(() => {
    setShowLocationOutlines((v) => {
      const next = !v;
      try {
        localStorage.setItem("dndnext_show_location_outlines", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem("dndnext_snap_locations");
      if (v === "0") setSnapLocations(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSnapLocations = useCallback(() => {
    setSnapLocations((v) => {
      const next = !v;
      try {
        localStorage.setItem("dndnext_snap_locations", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleLockLocationMarkers = useCallback(() => {
    setLockLocationMarkers((v) => {
      const next = !v;
      try {
        localStorage.setItem("dndnext_lock_location_markers", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);


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

  // Drag-to-move draft route points
  // Drag state: use a ref for logic (mousemove/mouseup need immediate value);
  // keep React state only for UI/highlighting.
  const [dragPointKey, setDragPointKey] = useState(null); // point key (db id or tempId)
  const dragPointKeyRef = useRef(null);
  const dragMovedRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const dragStartRawRef = useRef(null);
  const [pendingSnap, setPendingSnap] = useState(null); // { pointKey, location }

  const imgRef = useRef(null);
  const mapWrapRef = useRef(null);

  /* ---------- Offcanvas: enforce ONLY ONE open at a time ---------- */
  const OFFCANVAS_IDS = useMemo(() => ["locPanel", "merchantPanel", "npcPanel", "routePanel"], []);

  const hideOffcanvas = useCallback((id) => {
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (!el || !window.bootstrap) return;
    const inst = window.bootstrap.Offcanvas.getInstance(el);
    if (inst) inst.hide();
  }, []);

  /**
   * Location tokens drive two UIs:
   *  - Left: Location panel (Bootstrap Offcanvas)
   *  - Right: Marker drawer (LocationIconDrawer)
   *
   * UX expectation: they open/close together when interacting with a location.
   */
  const closeLocationUIs = useCallback(() => {
    setLocationDrawerOpen(false);
    setPlacingLocation(false);
    setPlaceCfg((prev) => ({ ...prev, edit_location_id: null }));
    setSelLoc(null);
    hideOffcanvas("locPanel");
  }, [hideOffcanvas]);

  // Close *everything* that can obscure the map. Used when clicking a pin so
  // the user never ends up with multiple overlapping drawers/panels.
  const closeAllMapPanels = useCallback(() => {
    setLocationDrawerOpen(false);
    setPlacingLocation(false);
    setPlaceCfg((prev) => ({ ...prev, edit_location_id: null }));
    setSelLoc(null);
    setSelMerchant(null);
    setSelNpc(null);
    setRoutePanelOpen(false);
    hideOffcanvas("locPanel");
    hideOffcanvas("merchantPanel");
    hideOffcanvas("npcPanel");
    hideOffcanvas("routePanel");
    // Clear any deep-link query parameters when closing all panels. This prevents panels from
    // reopening on page refresh. We use router.replace with shallow routing to avoid a full reload.
    if (router) {
      router.replace({ pathname: router.pathname, query: {} }, undefined, { shallow: true });
    }
  }, [hideOffcanvas, router]);

  const showExclusiveOffcanvas = useCallback(
    (id) => {
      if (!window.bootstrap) return;
      for (const other of OFFCANVAS_IDS) {
        if (other !== id) hideOffcanvas(other);
      }
      const el = document.getElementById(id);
      if (!el) return;
      window.bootstrap.Offcanvas.getOrCreateInstance(el).show();
    },
    [OFFCANVAS_IDS, hideOffcanvas]
  );

  /* ---------- Helpers: coordinate conversions ---------- */
  const eventToRawPct = useCallback((e) => {
    const el = imgRef.current;
    const rect = el?.getBoundingClientRect?.();
    if (!rect) return null;

    // If the map image is being "contained" inside its box, adjust for letterboxing.
    // This fixes X/Y drift where the farther-right you go, the further off the click/marker appears.
    const nw = Number(el?.naturalWidth || 0);
    const nh = Number(el?.naturalHeight || 0);

    let contentLeft = rect.left;
    let contentTop = rect.top;
    let contentW = rect.width;
    let contentH = rect.height;

    if (nw > 0 && nh > 0 && rect.width > 0 && rect.height > 0) {
      const naturalRatio = nw / nh;
      const boxRatio = rect.width / rect.height;

      if (boxRatio > naturalRatio) {
        // horizontal letterbox
        contentW = rect.height * naturalRatio;
        const padX = (rect.width - contentW) / 2;
        contentLeft = rect.left + padX;
      } else if (boxRatio < naturalRatio) {
        // vertical letterbox
        contentH = rect.width / naturalRatio;
        const padY = (rect.height - contentH) / 2;
        contentTop = rect.top + padY;
      }
    }

    const px = (e.clientX - contentLeft) / contentW;
    const py = (e.clientY - contentTop) / contentH;
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

  /* ---------- Drag & Drop pins (admin only) ---------- */
  const previewKey = (kind, id) => `${kind}:${id}`;

  const findCharRow = useCallback(
    (kind, id) => {
      if (kind === "location") return (locs || []).find((l) => l.id === id) || null;
      if (kind === "merchant") return (merchants || []).find((m) => m.id === id) || null;
      // NPCs can be placed from the drawer even if currently hidden/off-map.
      return (allNpcs || []).find((n) => n.id === id) || (mapNpcs || []).find((n) => n.id === id) || null;
    },
    [locs, merchants, mapNpcs, allNpcs]
  );

  const beginDragPin = useCallback(
    (e, kind, id) => {
      if (!isAdmin) return;
      e.preventDefault();
      e.stopPropagation();

      const row = findCharRow(kind, id);
      const startDb = row ? { x: Number(row.x) || 0, y: Number(row.y) || 0 } : { x: 0, y: 0 };

      dragRef.current = { id, kind, startDb, didDrag: false };
      setDraggingKey(previewKey(kind, id));
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    },
    [isAdmin, findCharRow]
  );

  const updateDragPreview = useCallback(
    (kind, id, db) => {
      const key = previewKey(kind, id);
      setDragPreview((prev) => ({ ...(prev || {}), [key]: db }));
    },
    []
  );

  const clearDragPreview = useCallback((kind, id) => {
    const key = previewKey(kind, id);
    setDragPreview((prev) => {
      const next = { ...(prev || {}) };
      delete next[key];
      return next;
    });
  }, []);

  const onPinPointerMove = useCallback(
    (e) => {
      const st = dragRef.current;
      if (!st) return;
      const raw = eventToRawPct(e);
      if (!raw) return;
      const db = rawPctToDb(raw);
      if (!db) return;

      // Optional snapping for location markers
      if (st.kind === "location" && snapLocations) {
        const step = 0.25; // percent step (0.25% feels good for map placement)
        db.x = Math.round(db.x / step) * step;
        db.y = Math.round(db.y / step) * step;
      }

      // Threshold before we treat it as a drag (prevents click suppression on tiny jitters)
      const dx = db.x - st.startDb.x;
      const dy = db.y - st.startDb.y;
      if (!st.didDrag && Math.sqrt(dx * dx + dy * dy) >= 0.2) st.didDrag = true;

      updateDragPreview(st.kind, st.id, db);
    },
    [eventToRawPct, rawPctToDb, updateDragPreview]
  );

  const commitPinPosition = useCallback(
    async (kind, id, db) => {
      // Rule: On Map => is_hidden=false, location_id=NULL
      // Dragging also removes from route traversal.
      const row = findCharRow(kind, id);
      const lastKnown = row?.location_id ?? row?.last_known_location_id ?? null;

      const payload =
        kind === "location"
          ? { x: db.x, y: db.y }
          : {
              x: db.x,
              y: db.y,
              is_hidden: false,
              location_id: null,
              last_known_location_id: lastKnown,

              // Remove from route state
              route_id: null,
              state: "resting",
              route_point_seq: 1,
              route_segment_progress: 0,
              current_point_seq: null,
              next_point_seq: null,
              prev_point_seq: null,
              segment_started_at: null,
              segment_ends_at: null,
            };

      // Optimistic local update: prevents snap-back until realtime delivers the updated row
      if (kind === "location") {
        setLocs((prev) => (prev || []).map((l) => (l.id === id ? { ...l, x: payload.x, y: payload.y } : l)));
      } else if (kind === "merchant") {
        setMerchants((prev) => (prev || []).map((m) => (m.id === id ? { ...m, ...payload } : m)));
      } else {
        setMapNpcs((prev) => (prev || []).map((n) => (n.id === id ? { ...n, ...payload } : n)));
      }

      let error = null;

      if (kind === "location") {
        const res = await supabase.from("locations").update({ x: payload.x, y: payload.y }).eq("id", id);
        error = res.error;
      } else {
        const res = await supabase.from("characters").update(payload).eq("id", id);
        error = res.error;
      }

      if (error) {
        console.error(error);
        setErr(error.message);
      }
    },
    [findCharRow]
  );

  const onPinPointerUp = useCallback(
    async (e) => {
      const st = dragRef.current;
      if (!st) return;

      const raw = eventToRawPct(e);
      const db = raw ? rawPctToDb(raw) : st.startDb;

      dragRef.current = null;
      clearDragPreview(st.kind, st.id);
      setDraggingKey(null);

      if (st.didDrag) {
        lastDragTsRef.current = Date.now();
        await commitPinPosition(st.kind, st.id, db);
      }
    },
    [eventToRawPct, rawPctToDb, clearDragPreview, commitPinPosition]
  );

  const onPinPointerCancel = useCallback(
    (e) => {
      const st = dragRef.current;
      if (!st) return;
      dragRef.current = null;
      clearDragPreview(st.kind, st.id);
      setDraggingKey(null);
    },
    [clearDragPreview]
  );

  const suppressClickIfJustDragged = useCallback((e) => {
    const dt = Date.now() - (lastDragTsRef.current || 0);
    if (dt < 250) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    return false;
  }, []);

  const shouldSuppressClick = useCallback(() => {
    return Date.now() - (lastDragTsRef.current || 0) < 250;
  }, []);

  const distanceNow = useMemo(() => {
    if (!rulerStart || !rulerEnd) return null;
    return dist(rulerStart, rulerEnd);
  }, [rulerStart, rulerEnd, dist]);

  /* ---------- Data loaders ---------- */
  const checkAdmin = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      setIsAdmin(false);
      return;
    }

    // Prefer the SECURITY DEFINER RPC so admin detection doesn't depend on user_profiles RLS.
    const { data: isAdminRpc, error: rpcErr } = await supabase.rpc("is_admin", { uid: user.id });
    if (!rpcErr) {
      setIsAdmin(!!isAdminRpc);
      return;
    }

    // Fallback for environments where the RPC isn't present.
    let data = null;
    let error = null;
    // Try selecting metadata; if the column doesn't exist yet, retry without it.
    {
      const res1 = await supabase
        .from("characters")
        .select(
          [
            "id",
            "name",
            "kind",
            "x",
            "y",
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
            "storefront_bg_url",
            "storefront_bg_image_url",
            "storefront_bg_video_url",
            "map_icon_id",
            "map_icons:map_icon_id(id,name,category,storage_path,metadata,sort_order)",
          ].join(",")
        )
        .eq("kind", "merchant")
        .neq("is_hidden", true)
        .order("updated_at", { ascending: false });

      data = res1.data;
      error = res1.error;

      const missingMeta =
        error &&
        (String(error.code) === "42703" || String(error.message || "").toLowerCase().includes("metadata"));

      if (missingMeta) {
        const res2 = await supabase
          .from("characters")
          .select(
            [
              "id",
              "name",
              "kind",
              "x",
              "y",
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
              "storefront_bg_url",
              "storefront_bg_image_url",
              "storefront_bg_video_url",
              "map_icon_id",
              "map_icons:map_icon_id(id,name,category,storage_path,sort_order)",
            ].join(",")
          )
          .eq("kind", "merchant")
          .neq("is_hidden", true)
          .order("updated_at", { ascending: false });
        data = res2.data;
        error = res2.error;
      }
    }

    if (error) {
      console.error(rpcErr);
      console.error(error);
      setIsAdmin(false);
      return;
    }
    setIsAdmin(data?.role === "admin");
  }, []);

  const loadLocations = useCallback(async () => {
    const { data, error } = await supabase.from("locations").select("*").order("id");
    if (error) setErr(error.message);
	    // Normalize legacy schemas: some DBs store the display name in `label`.
	    const normalized = (data || []).map((l) => ({
	      ...l,
	      name: l?.name ?? l?.label ?? "",
	    }));
	    setLocs(normalized);
  }, []);

  const deleteLocation = useCallback(
    async (loc) => {
      const id = loc?.id;
      const name = loc?.name || "this location";
      if (!id) return;
      const ok = window.confirm(`Delete location "${name}"?\n\nThis will remove it from the map and delete it from the database.`);
      if (!ok) return;

      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) {
        alert(error.message);
        return;
      }

      setSelLoc(null);
      await loadLocations();
    },
    [loadLocations]
  );

  
  const loadLocationIcons = useCallback(async () => {
    // Optional table. If it doesn't exist yet, we just skip icon support.
    const { data, error } = await supabase.from("location_icons").select("*").order("name");
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (String(error.code) === "42P01" || msg.includes("does not exist")) {
        setLocationIcons([]);
        return;
      }
      console.error(error);
      setErr(error.message);
      return;
    }

    // Precompute public URLs (storage_path can also be a direct URL).
    // NOTE: Some older rows store storage_path including the bucket prefix (e.g. "location-icons/foo.png").
    // Supabase Storage expects an *object key* (e.g. "foo.png"), so we normalize both formats.
    const normalizeObjectKey = (storagePath) => {
      let sp = String(storagePath || "").trim();
      if (!sp) return "";
      // Already a full URL
      if (/^https?:\/\//i.test(sp)) return sp;
      // Strip leading slashes
      sp = sp.replace(/^\/+/, "");
      // Some rows accidentally include the bucket prefix (or even include it twice).
      // Keep stripping until it's gone.
      while (/^location-icons\//i.test(sp)) sp = sp.replace(/^location-icons\//i, "");
      return sp;
    };

    const rows = (data || []).map((r) => {
      const sp = String(r.storage_path || "");
      if (!sp) return { ...r, public_url: "" };

      // Direct URL stored in DB
      if (/^https?:\/\//i.test(sp)) return { ...r, public_url: sp };

      const key = normalizeObjectKey(sp);
      if (!key || /^https?:\/\//i.test(key)) return { ...r, public_url: key || "" };

      try {
        const { data: pub } = supabase.storage.from("location-icons").getPublicUrl(key);
        return { ...r, public_url: pub?.publicUrl || "" };
      } catch {
        return { ...r, public_url: "" };
      }
    });

    setLocationIcons(rows);
  }, []);

  const deleteLocationIcon = useCallback(
    async (icon) => {
      if (!isAdmin) return;
      const id = icon?.id;
      const name = icon?.name || "this icon";
      if (!id) return;

      const ok = window.confirm(
        `Delete icon "${name}"?\n\nThis will:\n• remove it from the icon palette\n• set any locations using it to no icon\n• attempt to delete the storage object (if present)`
      );
      if (!ok) return;

      // Best-effort: remove object from Storage if storage_path is an object key.
      const sp = String(icon?.storage_path || "").trim();
      // Normalize bucket-prefixed paths ("location-icons/foo.png") to object keys ("foo.png")
      const key = sp
        ? sp.replace(/^\/+/, "").replace(/^location-icons\//i, "")
        : "";

      if (key && !/^https?:\/\//i.test(key)) {
        const { error: storageErr } = await supabase.storage.from("location-icons").remove([key]);
        // If the object doesn't exist, we still proceed with DB deletion.
        if (storageErr && !String(storageErr.message || "").toLowerCase().includes("not found")) {
          console.warn("storage remove failed", storageErr);
        }
      }

      const { error } = await supabase.from("location_icons").delete().eq("id", id);
      if (error) {
        alert(error.message);
        return;
      }

      // If the current stamp tool is using this icon, clear it.
      setPlaceCfg((p) => {
        if (String(p?.icon_id || "") !== String(id)) return p;
        return { ...p, icon_id: "" };
      });

      await loadLocationIcons();
    },
    [isAdmin, loadLocationIcons]
  );

  // Update marker-related fields for an existing location.
  // This is used when an admin clicks a placed location icon and edits marker settings in the right-hand drawer.
  const updateLocationMarker = useCallback(
    async (locationId, patch) => {
      if (!isAdmin) return { ok: false, error: new Error("Not authorized") };
      if (!locationId) return { ok: false, error: new Error("Missing locationId") };

      const { data, error } = await supabase
        .from("locations")
        .update(patch)
        .eq("id", locationId)
        .select(
          // IMPORTANT:
          // Our `locations` table uses the *_px suffix for offset columns.
          // PostgREST will reject the PATCH if we request/select columns that don't exist.
          "id,name,x,y,icon_id,is_hidden,marker_scale,marker_rotation,marker_rotation_deg,marker_anchor,marker_anchor_x,marker_anchor_y,marker_x_offset_px,marker_y_offset_px"
        )
        .maybeSingle();

      if (error) return { ok: false, error };

	      // Normalize legacy schemas (some DBs store name as `label`).
	      const normalized = {
	        ...data,
	        name: data?.name ?? data?.label ?? patch?.name ?? patch?.label ?? "",
	      };

	      // Keep local state in sync so edits are immediately reflected on the map.
	      setLocs((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
	        return arr.map((l) => (String(l.id) === String(locationId) ? { ...l, ...normalized } : l));
      });

      // If we're editing the currently selected location, keep that in sync too.
	      setSelLoc((prev) => {
        if (!prev) return prev;
        if (String(prev.id) !== String(locationId)) return prev;
	        return { ...prev, ...normalized };
      });

	      return { ok: true, data: normalized };
    },
    [isAdmin, supabase]
  );

	const loadMerchants = useCallback(async () => {
    const selectWithMeta = [
      "id",
      "name",
      "kind",
      "x",
      "y",
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
      "storefront_bg_url",
      "storefront_bg_image_url",
      "storefront_bg_video_url",
      "map_icon_id",
      // join map_icons for icon rendering (Option 2)
      "map_icons:map_icon_id(id,name,category,storage_path,metadata,sort_order)",
    ].join(",");

    const selectNoMeta = [
      "id",
      "name",
      "kind",
      "x",
      "y",
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
      "storefront_bg_url",
      "storefront_bg_image_url",
      "storefront_bg_video_url",
      "map_icon_id",
      "map_icons:map_icon_id(id,name,category,storage_path)",
    ].join(",");

    let res = await supabase
      .from("characters")
      .select(selectWithMeta)
      .eq("kind", "merchant")
      .neq("is_hidden", true)
      .is("location_id", null)
      .order("updated_at", { ascending: false });

    // If the DB hasn't been migrated to include map_icons.metadata yet, retry with a narrower select.
    if (res.error && (res.error.code === "42703" || String(res.error.message || "").includes("metadata"))) {
      res = await supabase
        .from("characters")
        .select(selectNoMeta)
        .eq("kind", "merchant")
        .neq("is_hidden", true)
        .is("location_id", null)
        .order("updated_at", { ascending: false });
    }

    const { data, error } = res;
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

  const loadNpcs = useCallback(async () => {
    // NPC pins live in public.characters (kind='npc'). This table is typically RLS-protected,
    // so we only attempt to load pins when a user is authenticated.
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    const selectWithMeta = [
      'id',
      'name',
      'kind',
      'x',
      'y',
      'location_id',
      'last_known_location_id',
      'is_hidden',
      // Sprite sheet fields
      'sprite_path',
      'sprite_scale',
      // Per-NPC roaming speed
      'roaming_speed',
      // Pathing fields (so NPCs on-map can start moving)
      'route_id',
      'route_mode',
      'state',
      'route_point_seq',
      'rest_until',
      'route_segment_progress',
      'current_point_seq',
      'next_point_seq',
      // Map icon id / metadata
      'map_icon_id',
      'map_icons:map_icon_id(id,name,category,storage_path,metadata,sort_order)',
    ].join(',');

    const selectNoMeta = [
      'id',
      'name',
      'kind',
      'x',
      'y',
      'location_id',
      'last_known_location_id',
      'is_hidden',
      // Sprite sheet fields
      'sprite_path',
      'sprite_scale',
      // Per-NPC roaming speed
      'roaming_speed',
      // Pathing fields
      'route_id',
      'route_mode',
      'state',
      'route_point_seq',
      'rest_until',
      'route_segment_progress',
      'current_point_seq',
      'next_point_seq',
      // Map icon
      'map_icon_id',
      'map_icons:map_icon_id(id,name,category,storage_path)',
    ].join(',');

    let res = await supabase
      .from('characters')
      .select(selectWithMeta)
      .eq('kind', 'npc')
      .neq('is_hidden', true)
      .is('location_id', null)
      .order('updated_at', { ascending: false });
    if (res.error && (res.error.code === '42703' || String(res.error.message || '').includes('metadata'))) {
      res = await supabase
        .from('characters')
        .select(selectNoMeta)
        .eq('kind', 'npc')
        .neq('is_hidden', true)
        .is('location_id', null)
        .order('updated_at', { ascending: false });
    }

    if (res.error) {
      // Non-fatal; keep last known state
      console.warn('loadNpcs error:', res.error.message);
      return;
    }

    setMapNpcs(res.data || []);
  }, []);

  const loadAllNpcs = useCallback(async () => {
    // Full NPC list for the "NPCs" tab in the right-side marker drawer.
    // This is admin tooling; if unauthenticated, skip.
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    const selectWithMeta = [
      'id',
      'name',
      'kind',
      'status',
      'role',
      'affiliation',
      'race',
      'x',
      'y',
      'location_id',
      'last_known_location_id',
      'is_hidden',
      // Sprite sheet settings
      'sprite_path',
      'sprite_scale',
      // Per-NPC roaming speed
      'roaming_speed',
      // Route/pathing fields
      'route_id',
      'route_mode',
      'route_point_seq',
      'state',
      'rest_until',
      'route_segment_progress',
      'current_point_seq',
      'next_point_seq',
      // Map icon reference
      'map_icon_id',
      'map_icons:map_icon_id(id,name,category,storage_path,metadata,sort_order)',
    ].join(',');

    const selectNoMeta = [
      'id',
      'name',
      'kind',
      'status',
      'role',
      'affiliation',
      'race',
      'x',
      'y',
      'location_id',
      'last_known_location_id',
      'is_hidden',
      // Sprite sheet settings
      'sprite_path',
      'sprite_scale',
      // Per-NPC roaming speed
      'roaming_speed',
      // Route/pathing fields
      'route_id',
      'route_mode',
      'route_point_seq',
      'state',
      'rest_until',
      'route_segment_progress',
      'current_point_seq',
      'next_point_seq',
      // Map icon reference
      'map_icon_id',
      'map_icons:map_icon_id(id,name,category,storage_path)',
    ].join(',');

    let res = await supabase.from('characters').select(selectWithMeta).eq('kind', 'npc').order('name', { ascending: true });
    if (res.error && (res.error.code === '42703' || String(res.error.message || '').includes('metadata'))) {
      res = await supabase.from('characters').select(selectNoMeta).eq('kind', 'npc').order('name', { ascending: true });
    }
    if (res.error) {
      console.warn('loadAllNpcs error:', res.error.message);
      return;
    }
    setAllNpcs(res.data || []);
  }, []);

  // Helper to update a character row. This attempts to call the `update_character`
  // SECURITY DEFINER function first to bypass any RLS restrictions. If the RPC is
  // missing or errors, it falls back to a direct table update. After writing to
  // the DB, it performs optimistic updates on our local state so the UI updates
  // immediately. Any errors are logged to the console and also set in `err`.
  const updateCharacter = useCallback(
    async (characterId, patch) => {
      if (!characterId || !patch || typeof patch !== 'object') return;
      try {
        const { error: rpcErr } = await supabase.rpc('update_character', {
          p_character_id: characterId,
          p_patch: patch,
        });
        if (rpcErr) {
          console.warn('update_character RPC error', rpcErr);
          const { error: updateErr } = await supabase.from('characters').update(patch).eq('id', characterId);
          if (updateErr) {
            throw updateErr;
          }
        }
        // Optimistically update cached NPC lists
        setAllNpcs((prev) =>
          (prev || []).map((n) => (n.id === characterId ? { ...n, ...patch } : n))
        );
        setMapNpcs((prev) =>
          (prev || []).map((n) => (n.id === characterId ? { ...n, ...patch } : n))
        );
      } catch (err) {
        console.error(err);
        setErr(err?.message || String(err));
      }
    },
    []
  );

  const setNpcMapIcon = useCallback(
    async (npcId, iconId) => {
      if (!npcId) return;
      const payload = { map_icon_id: iconId || null };
      await updateCharacter(npcId, payload);
    },
    [updateCharacter]
  );

  const setNpcSprite = useCallback(
    async (npcId, spritePath) => {
      if (!npcId) return;
      const payload = { sprite_path: spritePath || null };
      await updateCharacter(npcId, payload);
    },
    [updateCharacter]
  );

  const setNpcSpriteScale = useCallback(
    async (npcId, scale) => {
      if (!npcId) return;
      const payload = { sprite_scale: typeof scale === 'number' ? scale : null };
      await updateCharacter(npcId, payload);
    },
    [updateCharacter]
  );

  // Persist an NPC's roaming speed. Uses updateCharacter helper so the update
  // bypasses RLS via the RPC if available. Accepts a speed in pct/sec (0.02–2.0).
  const setNpcRoamingSpeed = useCallback(
    async (npcId, speed) => {
      if (!npcId) return;
      const payload = { roaming_speed: typeof speed === 'number' ? speed : null };
      await updateCharacter(npcId, payload);
    },
    [updateCharacter]
  );

  const setNpcMapPos = useCallback(async (npcId, xPct, yPct) => {
    if (!npcId) return;
    const x = Math.max(0, Math.min(100, Number(xPct)));
    const y = Math.max(0, Math.min(100, Number(yPct)));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    // When an NPC is on the map, it is not "at" a location.
    const payload = { x, y, location_id: null };
    await updateCharacter(npcId, payload);
    // Ensure the pin appears on the map if this NPC was previously off-map.
    setMapNpcs((prev) => {
      const curr = prev || [];
      if (curr.some((n) => n.id === npcId)) return curr;
      const full = (allNpcs || []).find((n) => n.id === npcId);
      if (!full) return curr;
      if (full.is_hidden) return curr;
      return [...curr, { ...full, ...payload }];
    });
  }, [allNpcs, updateCharacter]);

  // Right-click target movement loop (admin-only)
  useEffect(() => {
    if (!isAdmin) return;

    const tickMs = 120;
    const arriveEps = 0.25; // in raw pct

    const interval = setInterval(() => {
      const targets = npcMoveTargetsRef.current || {};
      const ids = Object.keys(targets);
      if (!ids.length) return;

      let nextTargets = { ...targets };
      const arrivals = [];

      setMapNpcs((prev) => {
        const curr = prev || [];
        return curr.map((n) => {
          const t = targets[n.id];
          if (!t) return n;

          const dx = (t.x ?? 0) - (n.x ?? 0);
          const dy = (t.y ?? 0) - (n.y ?? 0);
          const dist = Math.hypot(dx, dy);

          if (dist <= arriveEps) {
            delete nextTargets[n.id];
            arrivals.push({ id: n.id, x: t.x, y: t.y });
            return { ...n, x: t.x, y: t.y, state: 'resting', sprite_dir: n.sprite_dir || 'down' };
          }

          // Use the NPC's own roaming_speed when available.
          const speed = Math.max(0.02, Number(n.roaming_speed) || 0.15); // pct per second
          const step = speed * (tickMs / 1000);
          const k = Math.min(step, dist) / dist;
          const nx = (n.x ?? 0) + dx * k;
          const ny = (n.y ?? 0) + dy * k;

          // 4-direction facing, based on dominant axis
          let sprite_dir = n.sprite_dir || 'down';
          if (Math.abs(dx) >= Math.abs(dy)) sprite_dir = dx >= 0 ? 'right' : 'left';
          else sprite_dir = dy >= 0 ? 'down' : 'up';

          return { ...n, x: nx, y: ny, state: 'moving', sprite_dir };
        });
      });

      // Keep allNpcs in sync for the drawer list, too
      setAllNpcs((prev) => {
        const curr = prev || [];
        return curr.map((n) => {
          const t = targets[n.id];
          if (!t) return n;
          // If it is on-map, its location_id should be null while moving
          const dx = (t.x ?? 0) - (n.x ?? 0);
          const dy = (t.y ?? 0) - (n.y ?? 0);
          const dist = Math.hypot(dx, dy);
          if (dist <= arriveEps) return { ...n, x: t.x, y: t.y, state: 'resting', location_id: null };
          const speed = Math.max(0.02, Number(n.roaming_speed) || 0.15);
          const step = speed * (tickMs / 1000);
          const k = Math.min(step, dist) / dist;
          return { ...n, x: (n.x ?? 0) + dx * k, y: (n.y ?? 0) + dy * k, state: 'moving', location_id: null };
        });
      });

      // Commit: targets + arrival DB writes
      if (Object.keys(nextTargets).length !== Object.keys(targets).length) {
        npcMoveTargetsRef.current = nextTargets;
        setNpcMoveTargets(nextTargets);
      }
      if (arrivals.length) {
        arrivals.forEach((a) => {
          // Fire and forget; we only persist final position.
          setNpcMapPos(a.id, a.x, a.y);
        });
      }
    }, tickMs);

    return () => clearInterval(interval);
  }, [isAdmin, setNpcMapPos]);

  const setNpcHidden = useCallback(
    async (npcId, hidden) => {
      if (!npcId) return;
      const payload = { is_hidden: !!hidden };
      await updateCharacter(npcId, payload);
      if (hidden) {
        // remove from map pins view
        setMapNpcs((prev) => (prev || []).filter((n) => n.id !== npcId));
      } else {
        setMapNpcs((prev) => {
          const curr = prev || [];
          if (curr.some((n) => n.id === npcId)) {
            return curr;
          }
          const full = (allNpcs || []).find((n) => n.id === npcId);
          if (!full) return curr;
          if (full.location_id == null) return [...curr, { ...full, ...payload }];
          return curr;
        });
      }
    },
    [allNpcs, updateCharacter]
  );

  const loadRoutes = useCallback(async () => {
    // Global route visibility (Option B): stored on map_routes.is_visible.
    // If the column is not present yet, we fall back to the old in-memory defaults.
    let res = await supabase
      .from("map_routes")
      .select("id,name,code,route_type,color,is_loop,is_visible")
      .order("name", { ascending: true });

    if (res.error && (res.error.code === "42703" || String(res.error.message || "").includes("is_visible"))) {
      res = await supabase
        .from("map_routes")
        .select("id,name,code,route_type,color,is_loop")
        .order("name", { ascending: true });
    }

    if (res.error) {
      console.error(res.error);
      setErr(res.error.message);
      return;
    }

    const list = res.data || [];
    setRoutes(list);

    // default visibility:
    // - if is_visible exists, use it
    // - otherwise, show trade routes by default (legacy)
    setVisibleRouteIds(() => {
      const hasIsVisible = list.some((r) => Object.prototype.hasOwnProperty.call(r, "is_visible"));
      if (hasIsVisible) {
        const vis = list.filter((r) => r.is_visible).map((r) => r.id);
        return vis;
      }
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
      supabase.from("map_route_points").select("id,route_id,seq,x,y,location_id,dwell_seconds").in("route_id", ids),
      supabase.from("map_route_edges").select("id,route_id,a_point_id,b_point_id").in("route_id", ids),
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
      await Promise.all([loadLocations(), loadLocationIcons(), loadMerchants(), loadNpcs(), loadAllNpcs(), loadRoutes()]);
    })();
  }, [checkAdmin, loadLocations, loadLocationIcons, loadMerchants, loadNpcs, loadAllNpcs, loadRoutes]);

  // Refresh NPC pins when auth state changes (e.g., after login)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (sess?.user) {
        loadNpcs();
        loadAllNpcs();
      } else {
        setMapNpcs([]);
        setAllNpcs([]);
      }
    });
    return () => data?.subscription?.unsubscribe?.();
  }, [loadNpcs, loadAllNpcs]);

  // ---- Deep-link panels removed ----
  // The map previously auto-opened panels based on URL query parameters (merchant, location, npc).
  // To avoid panels reopening on refresh and to give users control over when panels appear, we no longer
  // automatically open any offcanvas panels based on the query string. Panels now open only via user
  // interactions (clicks on pins or the map). The URL query is still updated on click for sharing,
  // but refresh does not trigger any UI changes.


  /* Load graph for visible routes */
  useEffect(() => {
    loadRouteGraph(visibleRouteIds);
  }, [visibleRouteIds, loadRouteGraph]);

  /* Realtime: merchants */
  useEffect(() => {
    const channel = supabase
      .channel("map-merchants")
      .on("postgres_changes", { event: "*", schema: "public", table: "characters",
          filter: "kind=eq.merchant" }, (payload) => {
        setMerchants((current) => {
          const curr = current || [];

          const newRow = payload.new ? projectMerchantRow(payload.new) : null;
          const shouldBeOnMap = (row) => !!row && !row.is_hidden && (row.location_id == null);

          if (payload.eventType === "INSERT") {
            if (!shouldBeOnMap(newRow)) return curr;
            if (curr.some((m) => m.id === newRow.id)) {
              return curr.map((m) => (m.id === newRow.id ? { ...m, ...newRow } : m));
            }
            return [newRow, ...curr];
          }

          if (payload.eventType === "UPDATE") {
            if (!newRow) return curr;
            if (!shouldBeOnMap(newRow)) {
              return curr.filter((m) => m.id !== newRow.id);
            }
            if (!curr.some((m) => m.id === newRow.id)) {
              return [newRow, ...curr];
            }
            return curr.map((m) => (m.id === newRow.id ? { ...m, ...newRow } : m));
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

  /* Realtime: NPC pins (on-map only) */
  useEffect(() => {
    const channel = supabase
      .channel("map-npcs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "characters", filter: "kind=eq.npc" },
        () => {
          // Realtime payloads don't include joined map_icons, so do a refresh.
          loadNpcs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNpcs]);

  /* Realtime: route visibility + list changes (global Option B) */
  useEffect(() => {
    const channel = supabase
      .channel("map-routes")
      .on("postgres_changes", { event: "*", schema: "public", table: "map_routes" }, (payload) => {
        // Keep it simple and consistent: reload routes when any route changes.
        loadRoutes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRoutes]);

  /* ---------- Offcanvas show (exclusive) ---------- */
  useEffect(() => {
    if (!selLoc) return;
    showExclusiveOffcanvas("locPanel");
  }, [selLoc, showExclusiveOffcanvas]);

  useEffect(() => {
    if (!selMerchant) return;
    showExclusiveOffcanvas("merchantPanel");
  }, [selMerchant, showExclusiveOffcanvas]);

  useEffect(() => {
    if (!selNpc) return;
    showExclusiveOffcanvas("npcPanel");
  }, [selNpc, showExclusiveOffcanvas]);

  useEffect(() => {
    if (!routePanelOpen) return;
    showExclusiveOffcanvas("routePanel");
  }, [routePanelOpen, showExclusiveOffcanvas]);

  /* IMPORTANT FIX:
     Do NOT clear BOTH selections when ANY panel closes.
     Each panel clears ONLY its own state. */
  useEffect(() => {
    const locEl = document.getElementById("locPanel");
    const merEl = document.getElementById("merchantPanel");
    const npcEl = document.getElementById("npcPanel");
    const routeEl = document.getElementById("routePanel");

    const onLocHidden = () => {
      // Keep marker drawer in sync with the location panel.
      setSelLoc(null);
      setLocationDrawerOpen(false);
      setPlacingLocation(false);
      setPlaceCfg((c) => ({ ...c, edit_location_id: null }));
    };
    const onMerHidden = () => setSelMerchant(null);
    const onNpcHidden = () => setSelNpc(null);
    const onRouteHidden = () => setRoutePanelOpen(false);

    if (locEl) locEl.addEventListener("hidden.bs.offcanvas", onLocHidden);
    if (merEl) merEl.addEventListener("hidden.bs.offcanvas", onMerHidden);
    if (npcEl) npcEl.addEventListener("hidden.bs.offcanvas", onNpcHidden);
    if (routeEl) routeEl.addEventListener("hidden.bs.offcanvas", onRouteHidden);

    return () => {
      if (locEl) locEl.removeEventListener("hidden.bs.offcanvas", onLocHidden);
      if (merEl) merEl.removeEventListener("hidden.bs.offcanvas", onMerHidden);
      if (npcEl) npcEl.removeEventListener("hidden.bs.offcanvas", onNpcHidden);
      if (routeEl) routeEl.removeEventListener("hidden.bs.offcanvas", onRouteHidden);
    };
  }, []);

  /* ---------- Helper: merchant fallback position ---------- */
  function pinPosForMerchant(m) {
    const prev = dragPreview?.[previewKey("merchant", m.id)];
    if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
      const x = Math.min(100, Math.max(0, Number(prev.x)));
      const y = Math.min(100, Math.max(0, Number(prev.y)));
      return [x, y];
    }

    // Smooth position between DB ticks using a short extrapolation window.
    // Falls back to raw DB position if we don't have a sample yet.
    const sample = motionRef.current?.[`merchant:${m.id}`];
    let x = Number.isFinite(sample?.x) ? Number(sample.x) : Number(m.x);
    let y = Number.isFinite(sample?.y) ? Number(sample.y) : Number(m.y);

    if (sample && Number.isFinite(sample.vx) && Number.isFinite(sample.vy) && Number.isFinite(sample.tMs)) {
      const dt = Math.min(MOTION_EXTRAP_MAX_S, Math.max(0, (Date.now() - sample.tMs) / 1000));
      x = x + sample.vx * dt;
      y = y + sample.vy * dt;
    }

    // Treat non-finite or (0,0) as "unset"; fall back to the character's location coords.
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) {
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

  function pinPosForNpc(n) {
    const prev = dragPreview?.[previewKey("npc", n.id)];
    if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
      const x = Math.min(100, Math.max(0, Number(prev.x)));
      const y = Math.min(100, Math.max(0, Number(prev.y)));
      return [x, y];
    }
    // Smooth position between DB ticks.
    const sample = motionRef.current?.[`npc:${n.id}`];
    if (sample && Number.isFinite(sample.x) && Number.isFinite(sample.y)) {
      let x = Number(sample.x);
      let y = Number(sample.y);
      if (Number.isFinite(sample.vx) && Number.isFinite(sample.vy) && Number.isFinite(sample.tMs)) {
        const dt = Math.min(MOTION_EXTRAP_MAX_S, Math.max(0, (Date.now() - sample.tMs) / 1000));
        x = x + sample.vx * dt;
        y = y + sample.vy * dt;
      }
      x = Math.min(100, Math.max(0, x));
      y = Math.min(100, Math.max(0, y));
      return [x, y];
    }

    // Fallback: same logic as merchants (location fallback, drag preview).
    return pinPosForMerchant(n);
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
        setRoutePanelOpen(false);
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
      supabase.from("map_route_edges").select("id,route_id,a_point_id,b_point_id").eq("route_id", rid),
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

    // ensure editor is on
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
      let ins = await supabase
        .from("map_routes")
        .insert({
          name,
          code,
          route_type: String(draftMeta.route_type || "trade"),
          color: String(draftMeta.color || "").trim() || null,
          is_loop: !!draftMeta.is_loop,
          // New routes should be visible immediately after creation (admin expectation)
          is_visible: true,
        })
        .select("id")
        .single();

      // If schema hasn't been migrated yet (no is_visible), retry without it.
      if (ins.error && (ins.error.code === "42703" || String(ins.error.message || "").includes("is_visible"))) {
        ins = await supabase
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
      }

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

    // Insert new points
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

    // Map temp points to new DB ids by seq
    const seqToId = new Map(inserted.map((r) => [Number(r.seq), String(r.id)]));
    const keyToDbId = new Map();

    for (const p of draftPoints) {
      if (p.id != null) keyToDbId.set(draftKey(p), String(p.id));
      else keyToDbId.set(draftKey(p), seqToId.get(Number(p.seq)));
    }

    // Delete edges for this route, then recreate
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

  // Persist route visibility globally (Option B): map_routes.is_visible
  const toggleRouteVisibility = useCallback(
    async (routeId, nextVisible) => {
      const rid = Number(routeId);
      if (!rid) return;

      // optimistic UI
      setRoutes((prev) => (prev || []).map((r) => (r.id === rid ? { ...r, is_visible: !!nextVisible } : r)));
      setVisibleRouteIds((prev) => {
        const set = new Set(prev || []);
        if (nextVisible) set.add(rid);
        else set.delete(rid);
        return Array.from(set);
      });

      const { error } = await supabase.from("map_routes").update({ is_visible: !!nextVisible }).eq("id", rid);
      if (error) {
        console.error(error);
        setErr(error.message);
        // best-effort rollback by reloading authoritative state
        await loadRoutes();
      }
    },
    [loadRoutes]
  );

  const deleteRoute = useCallback(
    async (routeId) => {
      if (!isAdmin) return;
      const rid = Number(routeId);
      if (!rid) return;

      const r = routes.find((x) => x.id === rid);
      const name = r?.name || `Route ${rid}`;

      const ok = window.confirm(`Delete route "${name}"?\n\nThis will remove the route and all its points/edges.`);
      if (!ok) return;

      // Clear any characters currently referencing this route (FK guard)
      const clr = await supabase.from("characters").update({ route_id: null }).eq("route_id", rid);
      if (clr.error) {
        alert(clr.error.message);
        return;
      }

      // Delete edges then points, then the route
      const delE = await supabase.from("map_route_edges").delete().eq("route_id", rid);
      if (delE.error) {
        alert(delE.error.message);
        return;
      }

      const delP = await supabase.from("map_route_points").delete().eq("route_id", rid);
      if (delP.error) {
        alert(delP.error.message);
        return;
      }

      const delR = await supabase.from("map_routes").delete().eq("id", rid);
      if (delR.error) {
        alert(delR.error.message);
        return;
      }

      // Local cleanup
      setVisibleRouteIds((prev) => (prev || []).filter((id) => Number(id) !== rid));
      if (activeRouteId === rid) setActiveRouteId(null);
      if (draftRouteId === rid) {
        setDraftRouteId(null);
        setDraftPoints([]);
        setDraftEdges([]);
        setDraftAnchor(null);
        setDraftDirty(false);
      }

      await loadRoutes();
    },
    [isAdmin, routes, activeRouteId, draftRouteId, loadRoutes]
  );

  /* ---------- Map click / move ---------- */
  // -------------------------
  // Draft route point dragging + snapping
  // -------------------------
  function findClosestLocationToDb(db, thresholdPct = 1.2) {
    if (!db || !locs?.length) return null;
    let best = null;
    let bestD2 = thresholdPct * thresholdPct;
    for (const l of locs) {
      // rawPctToDb() returns { x, y } in DB coordinate space.
      // Older route-drag code used dbX/dbY; keep everything on {x,y}.
      const dx = (l.x ?? 0) - db.x;
      const dy = (l.y ?? 0) - db.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = l;
      }
    }
    return best;
  }

  function handleDraftPointClick(pointKey) {
    if (!pointKey) return;
    if (!draftAnchor) setDraftAnchor(pointKey);
    else {
      addDraftEdge(draftAnchor, pointKey);
      setDraftAnchor(pointKey);
    }
  }

  function handleMapMouseDown(e) {
    /*
     * ROUTE EDIT DRAGGING (DO NOT REGRESS):
     * - Drag must be allowed whenever (routeEdit && isAdmin). Do NOT gate on activeRouteId.
     *   New/unsaved routes may not have an activeRouteId yet, but nodes must still be draggable.
     * - Draft route points do NOT have a `.key` property. Always use `draftKey(p)` (id/tempId)
     *   when comparing/updating a specific draft point during drag/snap/unsnap.
     */

    if (!(routeEdit && isAdmin)) return;
    const raw = eventToRawPct(e);
    if (!raw) return;
    const db = rawPctToDb(raw);
    if (!db) return;
    const hit = findDraftHit(db);
    if (hit?.hitPoint) {
      // IMPORTANT: write to ref so mousemove sees it immediately.
      dragPointKeyRef.current = hit.hitPoint;
      setDragPointKey(hit.hitPoint); // UI only
      dragMovedRef.current = false;
      dragStartRawRef.current = raw;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function handleMapMouseUp(e) {
    const key = dragPointKeyRef.current;
    if (!key) return;
    // We're handling a point drag/click; prevent bubbling to the map click handler.
    e.preventDefault();
    e.stopPropagation();
    dragPointKeyRef.current = null;
    setDragPointKey(null);

    const raw = eventToRawPct(e);
    const db = raw ? rawPctToDb(raw) : null;

    const didMove = !!dragMovedRef.current;

    // Suppress the subsequent click event (mouseup triggers click) so we don't add a new point after dragging.
    if (didMove) {
      suppressNextClickRef.current = true;
      setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
    }

    dragMovedRef.current = false;
    dragStartRawRef.current = null;

    if (!didMove) {
      handleDraftPointClick(key);
      return;
    }

    if (db) {
      const loc = findClosestLocationToDb(db, 1.2);
      if (loc) {
        setPendingSnap({ pointKey: key, location: loc });
        return;
      }
    }

    setDraftPoints((prev) =>
      (prev || []).map((p) =>
        draftKey(p) === key ? { ...p, location_id: null, dwell_seconds: 0 } : p
      )
    );
  }

  // -------------------------
  // Main click handler
  // -------------------------
  function handleMapClick(e) {
    // If we just dragged a draft point, don't treat this as a click.
    if (dragPointKeyRef.current || dragMovedRef.current || suppressNextClickRef.current) return;
    const raw = eventToRawPct(e);
    if (!raw) return;
    const db = rawPctToDb(raw);
    if (db) setLastClickPt(db);

    // Shift + Left click: place a temporary movement marker for the currently-selected NPC.
    // This is admin-only and intentionally avoids the browser right-click menu.
    if (isAdmin && e?.shiftKey) {
      const npcId = activeNpcIdRef.current;
      if (npcId) {
        e.preventDefault();
        e.stopPropagation();
        setNpcMoveTargets((prev) => ({
          ...prev,
          [npcId]: { x: raw.rawX, y: raw.rawY, placedAt: Date.now() },
        }));
        return;
      }
    }

    // Placement tool: click map to stamp a new location marker
    if (placingLocation && isAdmin && db && placeCfg.icon_id) {
      const step = 0.25;
      const placed = { ...db };
      if (snapLocations) {
        placed.x = Math.round(placed.x / step) * step;
        placed.y = Math.round(placed.y / step) * step;
      }

      const icon = (locationIcons || []).find((i) => String(i.id) === String(placeCfg.icon_id));
      const name = (placeCfg.name || "").trim() || (icon?.name || "New Location");

      const basePatch = {
        name,
        description: null,
        x: placed.x,
        y: placed.y,
      };

      const patchWithIcon = {
        ...basePatch,
        icon_id: placeCfg.icon_id,
        is_hidden: !!placeCfg.is_hidden,
        marker_scale: Number(placeCfg.scale || 1) || 1,
        marker_anchor_x: Number(placeCfg.anchor_x ?? 0.5),
        // Center-anchor all location icons.
        marker_anchor_y: Number(placeCfg.anchor_y ?? 0.5),
        marker_rotation_deg: Number(placeCfg.rotation_deg || 0) || 0,
      };

      (async () => {
        // Insert with extra columns if present; otherwise retry without them.
        let res = await supabase.from("locations").insert(patchWithIcon).select("*").single();
        const missingCols =
          res.error &&
          (String(res.error.code) === "42703" ||
            String(res.error.message || "").toLowerCase().includes("icon_id") ||
            String(res.error.message || "").toLowerCase().includes("marker_anchor") ||
            String(res.error.message || "").toLowerCase().includes("marker_rotation") ||
            String(res.error.message || "").toLowerCase().includes("marker_scale"));

        if (missingCols) {
          res = await supabase.from("locations").insert(basePatch).select("*").single();
        }

        if (res.error) {
          alert(res.error.message);
          return;
        }

        // Optimistic local add so it appears instantly
        if (res.data) {
          setLocs((prev) => [res.data, ...(prev || [])]);
          setSelLoc(res.data);
        } else {
          await loadLocations();
        }
      })();

      return;
    }

    // Ruler
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

      if (hit.hitEdge) {
        const [aKey, bKey] = hit.hitEdge.split("|");
        const newKey = addDraftPoint(db);
        removeDraftEdgeByKey(hit.hitEdge);
        addDraftEdge(aKey, newKey);
        addDraftEdge(newKey, bKey);
        setDraftAnchor(newKey);
        return;
      }

      if (hit.hitPoint) {
        if (!draftAnchor) setDraftAnchor(hit.hitPoint);
        else {
          addDraftEdge(draftAnchor, hit.hitPoint);
          setDraftAnchor(hit.hitPoint);
        }
        return;
      }

      const newKey = addDraftPoint(db);
      if (draftAnchor) addDraftEdge(draftAnchor, newKey);
      setDraftAnchor(newKey);
      return;
    }

    // Add flow (preview)
    if (!addMode) return;
    setClickPt({ x: raw.rawX, y: raw.rawY });

    const el = document.getElementById("addLocModal");
    if (el && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(el).show();
  }

  // HTML5 drag/drop: drop NPC from LocationIconDrawer "NPCs" tab onto the map
  const handleMapDragOver = useCallback((e) => {
    // Allow drop if we recognize the payload
    const types = Array.from(e.dataTransfer?.types || []);
    if (types.includes('application/x-dndnext')) e.preventDefault();
  }, []);

  const handleMapDrop = useCallback(
    async (e) => {
      const json = e.dataTransfer?.getData?.('application/x-dndnext');
      if (!json) return;
      e.preventDefault();
      e.stopPropagation();

      let payload = null;
      try {
        payload = JSON.parse(json);
      } catch {
        return;
      }
      if (!payload || payload.kind !== 'npc' || !payload.id) return;

      const raw = eventToRawPct(e);
      if (!raw) return;
      const db = rawPctToDb(raw);
      if (!db) return;

      await commitPinPosition('npc', payload.id, db);

      // Open the player-facing NPC panel when a drop happens (nice UX for immediate preview)
      const npcRow = (allNpcs || []).find((n) => n.id === payload.id) || (mapNpcs || []).find((n) => n.id === payload.id);
      if (npcRow) {
        setSelNpc(npcRow);
        showExclusiveOffcanvas('npcPanel');
      }
    },
    [eventToRawPct, rawPctToDb, commitPinPosition, allNpcs, mapNpcs, showExclusiveOffcanvas]
  );

  function handleMapMouseMove(e) {
    const raw = eventToRawPct(e);
    if (!raw) {
      setHoverPt(null);
      return;
    }
    const db = rawPctToDb(raw);
    setHoverPt(db);

    // Dragging a draft route point
    const activeKey = dragPointKeyRef.current;
    if (activeKey && db) {
      const start = dragStartRawRef.current;
      if (start) {
        const dx = Math.abs(raw.rawX - start.rawX);
        const dy = Math.abs(raw.rawY - start.rawY);
        if (dx > 0.05 || dy > 0.05) dragMovedRef.current = true; // ~0.05% threshold
      }

      setDraftPoints((prev) =>
        (prev || []).map((p) => (p.key === activeKey ? { ...p, x: db.x, y: db.y } : p))
      );
      setDraftDirty(true);
    }

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

  const locationIconsById = useMemo(
    () => new Map((locationIcons || []).map((i) => [String(i.id), i])),
    [locationIcons]
  );

  // LEFT dock style (shared by Routes + Location)
  const leftDockStyle = useMemo(
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
        {/* Add Location is now a tab in the Markers drawer (admin-only). */}

        <button
          className={`btn btn-sm ${showLocationOutlines ? "btn-secondary" : "btn-outline-secondary"}`}
          onClick={toggleLocationOutlines}
          title="Show/hide location outlines"
        >
          Locations
        </button>

        <button
          className={`btn btn-sm ${snapLocations ? "btn-secondary" : "btn-outline-secondary"}`}
          onClick={toggleSnapLocations}
          title="Snap location markers while dragging"
        >
          Snap
        </button>

        

        {isAdmin && (
          <button
            className={`btn btn-sm ${lockLocationMarkers ? "btn-secondary" : "btn-outline-secondary"}`}
            onClick={toggleLockLocationMarkers}
            title="Lock location markers in place (hold Alt to drag while locked)"
          >
            {lockLocationMarkers ? "Unlock Markers" : "Lock Markers"}
          </button>
        )}
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
          onClick={() => {
            // open routes, close others
            setSelLoc(null);
            setSelMerchant(null);
            setRoutePanelOpen(true);
          }}
          title="Show/hide routes"
        >
          Routes
        </button>

        

        {isAdmin && (
          <button
            className="btn btn-sm btn-outline-success"
            onClick={async () => {
              try {
                setErr(null);
                const { error } = await supabase.rpc("advance_all_characters_v3", {});
                if (error) throw error;
                // Force-refresh pins immediately (realtime will also update, but this is deterministic for testing)
                await Promise.allSettled([loadMerchants(), loadNpcs()]);
              } catch (e) {
                setErr(e?.message || String(e));
              }
            }}
            title="Admin: run one movement tick (advance_all_characters_v3)"
          >
            Advance Tick
          </button>
        )}
{isAdmin && (
          <button
            className={`btn btn-sm ${locationDrawerOpen ? "btn-info" : "btn-outline-info"}`}
            onClick={() => setLocationDrawerOpen((v) => !v)}
            title="Location marker palette"
          >
            Markers
          </button>
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
        <div
          className={`map-dim${selLoc || selMerchant || routePanelOpen ? " show" : ""}`}
          style={{ pointerEvents: "none" }}
        />

        <div
          className={`map-wrap${showLocationOutlines ? "" : " hide-location-outlines"}`}
          style={{ position: "relative", display: "inline-block" }}
          ref={mapWrapRef}
          onClick={handleMapClick}
          onMouseDown={handleMapMouseDown}
          onMouseUp={handleMapMouseUp}
          onDragOver={handleMapDragOver}
          onDrop={handleMapDrop}
          onMouseMove={handleMapMouseMove}
          onMouseLeave={() => setHoverPt(null)}
        >
          <img ref={imgRef} src={BASE_MAP_SRC} alt="World map" className="map-img" />

          {showGrid && <div className="map-grid" style={gridOverlayStyle} />}

          {/* Routes + vectors */}
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

	            {/* NPC move targets (right-click) */}
	            {Object.entries(npcMoveTargets).map(([npcId, t]) => {
	              if (!t) return null;
	              return (
	                <g key={`npc-target-${npcId}`}>
	                  <circle
	                    cx={t.x}
	                    cy={t.y}
	                    r={0.75}
	                    stroke="rgba(255,255,255,.75)"
	                    strokeWidth={0.15}
	                    fill="rgba(0,0,0,.25)"
	                  />
	                  <line
	                    x1={t.x - 0.6}
	                    y1={t.y}
	                    x2={t.x + 0.6}
	                    y2={t.y}
	                    stroke="rgba(255,255,255,.55)"
	                    strokeWidth={0.15}
	                  />
	                  <line
	                    x1={t.x}
	                    y1={t.y - 0.6}
	                    x2={t.x}
	                    y2={t.y + 0.6}
	                    stroke="rgba(255,255,255,.55)"
	                    strokeWidth={0.15}
	                  />
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
                    className="route-line"
                    data-edge-key={`e-${e.a}-${e.b}`}
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
                    className={`route-point-dot${isAnchor ? " is-anchor" : ""}`}
                    data-point-key={`p-${key}`}
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
              const lx = asLocPct(l.x);
              const ly = asLocPct(l.y);
              if (!Number.isFinite(lx) || !Number.isFinite(ly)) return null;

              const icon = l.icon_id ? locationIconsById.get(String(l.icon_id)) : null;
              const src = icon?.public_url || "";
              const scale = Number(l.marker_scale || 1) || 1;
              // Location markers should behave consistently: always center-anchored on the map.
// (We still honor per-location pixel offsets + rotation; we just don't let the hitbox drift.)
               const ax = 0.5;
               const ay = 0.5;
               const rot = Number(l.marker_rotation_deg ?? 0) || 0;
               const isDragging = draggingKey === previewKey("location", l.id);
               const iconPx = Math.max(8, Math.round(26 * scale));
               // Shrink clickable/drag target ~60% to reduce misclicks between nearby towns.
               const hitPx = Math.max(6, Math.round(iconPx * 0.4));

              return (
                <button
                  key={l.id}
                  className={`map-pin pin-location${src ? " has-marker" : ""}${isAdmin ? " draggable" : ""}${isDragging ? " is-dragging" : ""}`}
                  style={{
                    left: `${lx * SCALE_X}%`,
                    top: `${ly * SCALE_Y}%`,
                    width: `${hitPx}px`,
                    height: `${hitPx}px`,
                    minWidth: `${hitPx}px`,
                    minHeight: `${hitPx}px`,
                    pointerEvents: "auto",
                     overflow: "visible",
                    transform: `translate(-50%, -50%) translate(${l.marker_x_offset_px ?? 0}px, ${l.marker_y_offset_px ?? 0}px)`,
                  }}
                  title={l.name}
                  onPointerDown={(ev) => {
                    if (!isAdmin) return;
                    if (lockLocationMarkers && !ev.altKey) return;
                    beginDragPin(ev, "location", l.id);
                  }}
                  onPointerMove={onPinPointerMove}
                  onPointerUp={onPinPointerUp}
                  onPointerCancel={onPinPointerCancel}
                  onClick={(ev) => {
                    // Unified click handler for location pins. Shift + click opens marker drawer (admin only).
                    // Normal click opens the location side panel for everyone; if admin, also opens the marker drawer.
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (shouldSuppressClick()) return;
                    if (ev.shiftKey) {
                      // Shift-click: admin-only marker drawer for this location
                      if (!isAdmin) return;
                      closeAllMapPanels();
                      setLocationDrawerDefaultTab("markers");
                      setLocationDrawerOpen(true);
                      setPlacingLocation(false);
                      setPlaceCfg({
                        icon_id: l.icon_id || "",
                        name: l.name || "",
                        scale: l.marker_scale ?? 1,
                        anchor: l.marker_anchor || "Center",
                        anchor_x: l.marker_anchor_x ?? 0.5,
                        anchor_y: l.marker_anchor_y ?? 0.5,
                        rotation_deg: l.marker_rotation_deg ?? 0,
                        x_offset_px: l.marker_x_offset_px ?? 0,
                        y_offset_px: l.marker_y_offset_px ?? -4,
                        is_hidden: !!l.is_hidden,
                        edit_location_id: l.id,
                      });
                      // Update query for sharing
                      router.replace(
                        { pathname: router.pathname, query: nextQuery(router, { location: l.id, npc: null, merchant: null }) },
                        undefined,
                        { shallow: true }
                      );
                    } else {
                      // Normal click: open location side panel. Do not fully close location panels to prevent
                      // bootstrap events from clearing the new selection. Instead, close other panels and
                      // update the selected location. If admin, also open the marker drawer.
                      // Close merchant/npc/route panels only
                      setSelMerchant(null);
                      setSelNpc(null);
                      setRoutePanelOpen(false);
                      hideOffcanvas("merchantPanel");
                      hideOffcanvas("npcPanel");
                      hideOffcanvas("routePanel");
                      // Select this location (opens LocationSideBar via useEffect)
                      setSelLoc(l);
                      // Update query for sharing
                      router.replace(
                        { pathname: router.pathname, query: nextQuery(router, { location: l.id, npc: null, merchant: null }) },
                        undefined,
                        { shallow: true }
                      );
                      if (isAdmin) {
                        setLocationDrawerDefaultTab("markers");
                        setLocationDrawerOpen(true);
                        setPlacingLocation(false);
                        setPlaceCfg({
                          icon_id: l.icon_id || "",
                          name: l.name || "",
                          scale: l.marker_scale ?? 1,
                          anchor: l.marker_anchor || "Center",
                          anchor_x: l.marker_anchor_x ?? 0.5,
                          anchor_y: l.marker_anchor_y ?? 0.5,
                          rotation_deg: l.marker_rotation_deg ?? 0,
                          x_offset_px: l.marker_x_offset_px ?? 0,
                          y_offset_px: l.marker_y_offset_px ?? -4,
                          is_hidden: !!l.is_hidden,
                          edit_location_id: l.id,
                        });
                      }
                    }
                  }}
                >
                  {src ? (
                    <span
                      className="pin-glyph"
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: `${iconPx}px`,
                        height: `${iconPx}px`,
                        transform: `translate(-50%, -50%) rotate(${rot}deg)`,
                        pointerEvents: "none",
                      }}
                      aria-hidden="true"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                      src={src}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      pointerEvents: "none",
                      }}
                      onError={(e) => {
                        if (e?.currentTarget) e.currentTarget.style.display = "none";
                      }}
                    />
                    </span>
                  ) : (
                    <span className="loc-dot" aria-hidden="true" />
                  )}
                  <span className="pin-label">{l.name}</span>
                </button>
              );
            })}

            {/* Merchants */}
            {merchants.map((m) => {
              const [mx, my] = pinPosForMerchant(m);
              const theme = detectTheme(m);
              const disp = mapIconDisplay(m.map_icon, { bucket: MAP_ICONS_BUCKET, fallbackSrc: LOCAL_FALLBACK_ICON });
              const isDragging = draggingKey === previewKey("merchant", m.id);
              return (
                <button
                  key={`mer-${m.id}`}
                  className={`map-pin pin-merchant pin-pill pill-${theme}${isAdmin ? " draggable" : ""}${isDragging ? " is-dragging" : ""}`}
                  style={{ left: `${mx * SCALE_X}%`, top: `${my * SCALE_Y}%`, pointerEvents: "auto" }}
                  onPointerDown={(ev) => beginDragPin(ev, "merchant", m.id)}
                  onPointerMove={onPinPointerMove}
                  onPointerUp={onPinPointerUp}
                  onPointerCancel={onPinPointerCancel}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (shouldSuppressClick()) return;
                    closeAllMapPanels();
                    setSelMerchant(m);
                    router.replace(
                      { pathname: router.pathname, query: nextQuery(router, { merchant: m.id, location: null, npc: null }) },
                      undefined,
                      { shallow: true }
                    );
                  }}
                  title={m.name}
                >
                  <span className="pill-ico">
                    {disp?.type === "emoji" ? (
                      <span aria-hidden="true">{disp.emoji}</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={disp?.src || LOCAL_FALLBACK_ICON}
                        alt=""
                        width={32}
                        height={32}
                        onError={(e) => {
                          if (e?.currentTarget && e.currentTarget.src !== LOCAL_FALLBACK_ICON) e.currentTarget.src = LOCAL_FALLBACK_ICON;
                        }}
                      />
                    )}
                  </span>
                  <span className="pin-label">{m.name}</span>
                </button>
              );
            })}

            {/* NPC pins */}
            {mapNpcs.map((n) => {
              const [nx, ny] = pinPosForNpc(n);
              const disp = mapIconDisplay(n.map_icons, n.name);
              const isDragging = draggingKey === previewKey("npc", n.id);

              // Optional sprite sheets (map-icons/npc-icons). If sprite_path is set on the character, we render a single
              // frame from the sheet instead of a static icon.
              const hasSprite = !!n.sprite_path;
              const spriteUrl = hasSprite
                ? supabase.storage.from(MAP_ICONS_BUCKET).getPublicUrl(n.sprite_path).data.publicUrl
                : null;

              // If we ever add real pathing, this can be driven by velocity.
              const isMoving = n.state === "moving" || n.state === "excursion";
const fallbackDir = (n.sprite_dir && SPRITE_DIR_ORDER.includes(n.sprite_dir) && n.sprite_dir) || "down";
// While moving/excursion, face travel direction based on smoothed velocity.
const mv = motionRef?.current?.[ `npc:${n.id}` ];
const dir = isMoving ? spriteDirFromVelocity(mv?.vx ?? 0, mv?.vy ?? 0, fallbackDir) : fallbackDir;

              const row = Math.max(0, SPRITE_DIR_ORDER.indexOf(dir));
              const frame = isMoving ? (Math.floor(Date.now() / 140) % SPRITE_FRAMES_PER_DIR) : 0;
              const scale = typeof n.sprite_scale === "number" ? n.sprite_scale : 0.7;
              const spriteStyle = hasSprite
                ? {
                    width: `${SPRITE_FRAME_W * scale}px`,
                    height: `${SPRITE_FRAME_H * scale}px`,
                    backgroundImage: spriteUrl ? `url("${spriteUrl}")` : "none",
                    backgroundRepeat: "no-repeat",
                    // Percentage-based slicing avoids subpixel seams/cropping at non-integer scales.
                    // (Sprite sheets are 3 cols x 4 rows.)
                    backgroundSize: `${SPRITE_FRAME_W * SPRITE_FRAMES_PER_DIR * scale}px ${SPRITE_FRAME_H * SPRITE_DIR_ORDER.length * scale}px`,
backgroundPosition: `${-frame * SPRITE_FRAME_W * scale}px ${-row * SPRITE_FRAME_H * scale}px`,

                    imageRendering: "pixelated",
                  }
                : null;
              const spriteScale = typeof n.sprite_scale === "number" ? n.sprite_scale : 0.7;
              return (
                <button
                  key={`npc-${n.id}`}
                  className={`map-pin pin-npc${hasSprite ? " npc-sprite-pin" : ""}${isAdmin ? " draggable" : ""}${isDragging ? " is-dragging" : ""}`}
                  style={{
                    left: `${nx * SCALE_X}%`,
                    top: `${ny * SCALE_Y}%`,
                    ...(hasSprite ? { background: "transparent", boxShadow: "none", border: "none" } : {}),
                  }}
                  title={n.name}
                  onPointerDown={(ev) => beginDragPin(ev, "npc", n.id)}
                  onPointerMove={onPinPointerMove}
                  onPointerUp={onPinPointerUp}
                  onPointerCancel={onPinPointerCancel}
                  onClick={(e) => {
                    // Unified click handler for NPC pins. Shift + left click opens the NPC drawer (admin only).
                    // Normal left click opens the NPC profile panel.
                    e.preventDefault();
                    e.stopPropagation();
                    if (shouldSuppressClick()) return;
                    if (e.shiftKey) {
                      // Admin-only marker drawer for NPCs
                      if (!isAdmin) return;
                      closeAllMapPanels();
                      setActiveNpcId(n.id);
                      setLocationDrawerDefaultTab("npcs");
                      setLocationDrawerOpen(true);
                      router.replace(
                        { pathname: router.pathname, query: nextQuery(router, { npc: n.id, location: null, merchant: null }) },
                        undefined,
                        { shallow: true }
                      );
                    } else {
                      // Normal click: open NPC profile overlay
                      closeAllMapPanels();
                      setSelNpc(n);
                      router.replace(
                        { pathname: router.pathname, query: nextQuery(router, { npc: n.id, location: null, merchant: null }) },
                        undefined,
                        { shallow: true }
                      );
                    }
                  }}
                >
                  <span className="npc-ico">
                    {hasSprite ? (
                      <span
                        className="npc-sprite"
                        style={{
                          width: SPRITE_FRAME_W * scale,
                          height: SPRITE_FRAME_H * scale,
                          backgroundImage: `url(${spriteUrl})`,
                          backgroundRepeat: "no-repeat",
                          // Percentage-based slicing avoids subpixel seams/cropping at non-integer scales.
                          backgroundSize: `${SPRITE_FRAMES_PER_DIR * 100}% ${SPRITE_DIR_ORDER.length * 100}%`,
                          backgroundPosition: `${(SPRITE_FRAMES_PER_DIR === 1 ? 0 : (frame / (SPRITE_FRAMES_PER_DIR - 1)) * 100)}% ${
                            SPRITE_DIR_ORDER.length === 1 ? 0 : (row / (SPRITE_DIR_ORDER.length - 1)) * 100
                          }%`,
                          imageRendering: "pixelated",
                          transformOrigin: "50% 50%",
                        }}
                      />
                    ) : disp?.emoji ? (
                      <span style={{ fontSize: 16, lineHeight: "16px" }}>{disp.emoji}</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={disp?.src || LOCAL_FALLBACK_ICON}
                        alt=""
                        width={18}
                        height={18}
                        onError={(e) => {
                          if (e?.currentTarget && e.currentTarget.src !== LOCAL_FALLBACK_ICON) e.currentTarget.src = LOCAL_FALLBACK_ICON;
                        }}
                      />
                    )}
                  </span>
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

              const iconId = (fd.get("icon_id") || "").toString().trim() || null;
              const scale = Number(fd.get("marker_scale") || 1) || 1;

              // Center-anchor all icons by default.
              const anchor = (fd.get("marker_anchor") || "center").toString();
              const rotationDeg = Number(fd.get("marker_rotation_deg") || 0) || 0;

              const anchorMap = {
                bottom: { x: 0.5, y: 1.0 },
                center: { x: 0.5, y: 0.5 },
                topleft: { x: 0.0, y: 0.0 },
                topright: { x: 1.0, y: 0.0 },
                bottomleft: { x: 0.0, y: 1.0 },
                bottomright: { x: 1.0, y: 1.0 },
              };

              const ax = anchorMap[anchor]?.x ?? 0.5;
              const ay = anchorMap[anchor]?.y ?? 0.5;

              const basePatch = {
                name: (fd.get("name") || "").toString().trim(),
                description: (fd.get("description") || "").toString().trim() || null,
                x: clickPt ? clickPt.x / SCALE_X : null,
                y: clickPt ? clickPt.y / SCALE_Y : null,
              };

              const patchWithMarker = {
                ...basePatch,
                marker_scale: scale,
                marker_anchor_x: ax,
                marker_anchor_y: ay,
                marker_rotation_deg: rotationDeg,
              };

              const patchWithIcon = { ...patchWithMarker, icon_id: iconId };

              let res = await supabase.from("locations").insert(patchWithIcon);
              const missingCols =
                res.error &&
                (String(res.error.code) === "42703" ||
                  String(res.error.message || "").toLowerCase().includes("icon_id") ||
                  String(res.error.message || "").toLowerCase().includes("marker_scale") ||
                  String(res.error.message || "").toLowerCase().includes("marker_anchor") ||
                  String(res.error.message || "").toLowerCase().includes("marker_rotation"));
              if (missingCols) res = await supabase.from("locations").insert(basePatch);

              if (res.error) alert(res.error.message);
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
              <div className="mb-2">
                <label className="form-label">Marker Icon</label>
                <select name="icon_id" className="form-select">
                  <option value="">(default outline)</option>
                  {(locationIcons || [])
                    .filter((i) => i.is_active !== false)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
                <div className="form-text">Icons come from the optional <code>location_icons</code> table.</div>
              </div>
              <div className="mb-2">
                <label className="form-label">Marker Scale</label>
                <input name="marker_scale" type="number" step="0.05" min="0.2" max="4" defaultValue="1" className="form-control" />
              </div>
              <div className="mb-2">
                <label className="form-label">Marker Anchor</label>
                <select name="marker_anchor" className="form-select" defaultValue="center">
                  <option value="center">Center (default)</option>
                  <option value="bottom">Bottom Center</option>
                  <option value="topleft">Top Left</option>
                  <option value="topright">Top Right</option>
                  <option value="bottomleft">Bottom Left</option>
                  <option value="bottomright">Bottom Right</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label">Rotation (deg)</label>
                <input name="marker_rotation_deg" type="number" step="1" min="-180" max="180" defaultValue="0" className="form-control" />

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

      {/* Snap-to-location prompt for dragged draft points */}
      {pendingSnap && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 4000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => {
            // clicking backdrop = decline
            const key = pendingSnap.pointKey;
            setPendingSnap(null);
            setDraftPoints((prev) =>
              (prev || []).map((p) =>
                p.key === key ? { ...p, location_id: null, dwell_seconds: 0 } : p
              )
            );
          }}
        >
          <div
            className="card"
            style={{ maxWidth: 520, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-body">
              <h5 className="card-title mb-2">Snap point to location?</h5>
              <div className="text-muted mb-3">
                Snap this route point to <b>{pendingSnap.location?.name}</b> so it becomes a location node (dwell applies).
              </div>
              <div className="d-flex gap-2 justify-content-end">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    const key = pendingSnap.pointKey;
                    setPendingSnap(null);
                    setDraftPoints((prev) =>
                      (prev || []).map((p) =>
                        p.key === key ? { ...p, location_id: null, dwell_seconds: 0 } : p
                      )
                    );
                  }}
                >
                  No
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const key = pendingSnap.pointKey;
                    const loc = pendingSnap.location;
                    setPendingSnap(null);
                    if (!loc) return;
                    setDraftPoints((prev) =>
                      (prev || []).map((p) =>
                        p.key === key
                          ? {
                              ...p,
                              x: Number(loc.x),
                              y: Number(loc.y),
                              location_id: loc.id,
                              dwell_seconds: 0,
                            }
                          : p
                      )
                    );
                    setDraftDirty(true);
                  }}
                >
                  Yes, snap
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/*         Location Offcanvas (LEFT dock — same slot as Routes) */}
      <div
        className="offcanvas offcanvas-start loc-panel"
        id="locPanel"
        style={leftDockStyle}
        data-bs-backdrop="false"
        data-bs-scroll="true"
        data-bs-keyboard="true"
        tabIndex="-1"
      >
        {selLoc && (
          <LocationSideBar
            location={selLoc}
            isAdmin={isAdmin}
            merchants={merchants}
            onDeleteLocation={deleteLocation}
            onOpenMerchant={(m) => {
              setRoutePanelOpen(false);
              setSelLoc(null);
              setSelMerchant(m); // opens RIGHT panel
            }}
            onClose={() => setSelLoc(null)}
            onReload={loadLocations}
          />
        )}
      </div>

      {/* Merchant Offcanvas (RIGHT — unchanged) */}
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

      {/* NPC Offcanvas (RIGHT — player-facing) */}
      <div
        className="offcanvas offcanvas-end loc-panel"
        id="npcPanel"
        data-bs-backdrop="false"
        data-bs-scroll="true"
        data-bs-keyboard="true"
        tabIndex="-1"
      >
        {selNpc && (
          <div className="offcanvas-body p-0">
            <NpcPanel npc={selNpc} isAdmin={isAdmin} locations={locs} />
          </div>
        )}
      </div>

      
      <LocationIconDrawer
        open={locationDrawerOpen}
        isAdmin={isAdmin}
        icons={locationIcons}
        npcs={allNpcs}
        locations={locs}
        placing={placingLocation}
        placeConfig={placeCfg}
        addMode={addMode}
        defaultTab={locationDrawerDefaultTab}
        onNpcSetIcon={setNpcMapIcon}
        onNpcSetSprite={setNpcSprite}
        onNpcSetSpriteScale={setNpcSpriteScale}
        npcMoveSpeed={npcMoveSpeed}
        onNpcSetMoveSpeed={setNpcRoamingSpeed}
        activeNpcId={activeNpcId}
        onNpcSelect={(id) => {
          setActiveNpcId(id);
          if (!id) return;
          // Ensure only one UI stack is open: close any offcanvas panels, then show the marker drawer.
          closeAllMapPanels();
          setLocationDrawerDefaultTab("npcs");
          setLocationDrawerOpen(true);
          router.replace(
            { pathname: router.pathname, query: nextQuery(router, { npc: id }) },
            undefined,
            { shallow: true }
          );
        }}
        onNpcSetHidden={setNpcHidden}
        onNpcDropToMap={() => {}}
        onToggleAddMode={() => {
          setAddMode((v) => {
            const next = !v;
            if (next) {
              // disable other tools
              setPlacingLocation(false);
              setRulerArmed(false);
              setRulerActive(false);
              setRouteEdit(false);
              setDraftAnchor(null);
              setRoutePanelOpen(false);
            }
            return next;
          });
          setLocationDrawerOpen(true);
        }}
        onClose={() => closeLocationUIs()}
        onPickIcon={(icon) => {
          setPlaceCfg((p) => ({
            ...p,
            icon_id: String(icon?.id || ""),
            name: (p.name || "").trim() ? p.name : String(icon?.name || ""),
          }));
          // If we're editing an existing location, don't arm "place mode".
          // Otherwise, selecting an icon should arm placing.
          if (!placeCfg?.edit_location_id) setPlacingLocation(true);
          setLocationDrawerOpen(true);
          // disable other tools
          setAddMode(false);
          setRulerArmed(false);
          setRouteEdit(false);
          setDraftAnchor(null);
          setRoutePanelOpen(false);
        }}
        onDeleteIcon={deleteLocationIcon}
        onTogglePlacing={() => {
          // When arming placement for a *new* marker, clear any previously-selected location name.
          // Otherwise, it's easy to accidentally place a new marker that inherits the last edited name.
          setPlacingLocation((v) => {
            const next = !v;
            if (next) {
              setPlaceCfg((p) => ({
                ...p,
                edit_location_id: null,
                // Keep the currently-selected icon for convenience, but reset editable fields.
                name: "",
                is_hidden: false,
                scale: 1,
                rotation_deg: 0,
                anchor: "Center",
                anchor_x: 0.5,
                anchor_y: 0.5,
                x_offset_px: 0,
                y_offset_px: -4,
              }));
            }
            return next;
          });
          setLocationDrawerOpen(true);
          // disable other tools
          setAddMode(false);
          setRulerArmed(false);
          setRouteEdit(false);
          setDraftAnchor(null);
          setRoutePanelOpen(false);
        }}
        onChangeConfig={(patch) => setPlaceCfg((p) => ({ ...p, ...patch }))}
        onCancelEdit={() => {
          setPlaceCfg((p) => ({ ...p, edit_location_id: null }));
          setLocationDrawerOpen(false);
          setPlacingLocation(false);
        }}
        onSaveEdit={async () => {
          const locId = placeCfg?.edit_location_id;
          if (!locId) return;

          const patch = {
            name: (placeCfg.name || "").trim() || null,
            icon_id: placeCfg.icon_id || null,
            is_hidden: !!placeCfg.is_hidden,
            marker_scale: Number(placeCfg.scale) || 1,
            // Keep both rotation columns aligned (some legacy code still reads marker_rotation)
            marker_rotation_deg: Number(placeCfg.rotation_deg) || 0,
            marker_rotation: Number(placeCfg.rotation_deg) || 0,

            marker_anchor: placeCfg.anchor || "Center",
            marker_anchor_x: Number(placeCfg.anchor_x) || 0.5,
            marker_anchor_y: Number(placeCfg.anchor_y) || 0.5,

            marker_x_offset_px: Number(placeCfg.x_offset_px) || 0,
            marker_y_offset_px: Number(placeCfg.y_offset_px) || -4,
          };

          // never write null name unless the user explicitly clears it; keep existing name if blank
          if (!patch.name) delete patch.name;

          const { ok, error, data } = await updateLocationMarker(locId, patch);
          if (!ok) {
            console.error("Failed to update location marker", error);
            alert("Failed to save marker changes. Check console for details.");
            return;
          }

          // Optimistically update local state so the map refreshes immediately
          if (data?.id) {
            setLocations((prev) =>
              (prev || []).map((l) => (l.id === data.id ? { ...l, ...data } : l))
            );
            // keep the left panel in sync too
            setSelLoc((prev) => (prev && prev.id === data.id ? { ...prev, ...data } : prev));
          }

          setPlaceCfg((p) => ({ ...p, edit_location_id: null }));
          setLocationDrawerOpen(false);
          setPlacingLocation(false);
        }}
      />
{/*    Routes Panel Component (LEFT dock) */}
      <RoutesPanel
        isAdmin={isAdmin}
        routes={routes}
        visibleRouteIds={visibleRouteIds}
        onToggleRouteVisibility={toggleRouteVisibility}
        routeEdit={routeEdit}
        toggleRouteEdit={toggleRouteEdit}
        beginNewRoute={beginNewRoute}
        beginEditRoute={beginEditRoute}
        draftRouteId={draftRouteId}
        draftMeta={draftMeta}
        setDraftMeta={setDraftMeta}
        draftAnchor={draftAnchor}
        setDraftDirty={setDraftDirty}
        draftPoints={draftPoints}
        draftEdges={draftEdges}
        setDraftPoints={setDraftPoints}
        setDraftEdges={setDraftEdges}
        setDraftAnchor={setDraftAnchor}
        saveDraftRoute={saveDraftRoute}
        draftDirty={draftDirty}
        deleteRoute={deleteRoute}
      />
    </div>
  );
}

// Force /map to render on the server at request time.
// This prevents Next from trying to prerender the page during build/export,
// which can fail for interactive map code that expects a browser runtime.
export async function getServerSideProps() {
  return { props: {} };
}
/* pages/map.js  */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import RoutesPanel from "../components/RoutesPanel";
import { supabase } from "../utils/supabaseClient";
import MerchantPanel from "../components/MerchantPanel";
import LocationSideBar from "../components/LocationSideBar";
import LocationIconDrawer from "../components/LocationIconDrawer";
import { themeFromMerchant as detectTheme, emojiForTheme } from "../utils/merchantTheme";
import { MAP_ICONS_BUCKET, LOCAL_FALLBACK_ICON, mapIconDisplay } from "../utils/mapIcons";

/* ===== Map calibration (X had been saved in 4:3 space) =====
   Render uses SCALE_*; DB writes use inverse SCALE_*.
   After you re-save everything once, set SCALE_X back to 1.
*/
//  Coordinate scaling was used temporarily during a coordinate migration.
//  Dragging and hit-testing should track the cursor exactly.
const SCALE_X = 1.0;
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

export default function MapPage() {
  const router = useRouter();
  const openedMerchantFromQueryRef = useRef(false);

  const [locs, setLocs] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [mapNpcs, setMapNpcs] = useState([]);

  const [addMode, setAddMode] = useState(false);
  const [clickPt, setClickPt] = useState(null); // raw/rendered 0..100 (% of visible map)
  const [err, setErr] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [selLoc, setSelLoc] = useState(null);
  const [selMerchant, setSelMerchant] = useState(null);

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
  const [placingLocation, setPlacingLocation] = useState(false);
  const [snapLocations, setSnapLocations] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem("dndnext_snap_locations") === "1";
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
    // When true, this location should be hidden from non-admin users.
    is_hidden: false,
    edit_location_id: null,
  });


  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setPlacingLocation(false);
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

  /* ---------- Offcanvas: enforce ONLY ONE open at a time ---------- */
  const OFFCANVAS_IDS = useMemo(() => ["locPanel", "merchantPanel", "routePanel"], []);

  const hideOffcanvas = useCallback((id) => {
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (!el || !window.bootstrap) return;
    const inst = window.bootstrap.Offcanvas.getInstance(el);
    if (inst) inst.hide();
  }, []);

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
      return (mapNpcs || []).find((n) => n.id === id) || null;
    },
    [locs, merchants, mapNpcs]
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
    // Non-admin users should not see pre-staged (hidden) locations.
    // We also handle the case where the column hasn't been added yet.
    const run = async (withHiddenFilter) => {
      let q = supabase.from("locations").select("*").order("id");
      if (withHiddenFilter) q = q.eq("is_hidden", false);
      return await q;
    };

    const { data, error } = await run(!isAdmin);
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      // Back-compat: if the migration isn't applied yet, fall back to fetching all.
      if (msg.includes("is_hidden") && msg.includes("does not exist")) {
        const retry = await run(false);
        if (retry.error) setErr(retry.error.message);
        setLocs(retry.data || []);
        return;
      }
      setErr(error.message);
    }
    setLocs(data || []);
  }, [isAdmin]);

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
          "id,name,x,y,icon_id,marker_scale,marker_rotation,marker_rotation_deg,marker_anchor,marker_anchor_x,marker_anchor_y,marker_x_offset_px,marker_y_offset_px"
        )
        .maybeSingle();

      if (error) return { ok: false, error };

      // Keep local state in sync so edits are immediately reflected on the map.
      setLocs((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.map((l) => (String(l.id) === String(locationId) ? { ...l, ...data } : l));
      });

      // If we're editing the currently selected location, keep that in sync too.
      setSelLoc((prev) => {
        if (!prev) return prev;
        if (String(prev.id) !== String(locationId)) return prev;
        return { ...prev, ...data };
      });

      return { ok: true, data };
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
      await Promise.all([loadLocations(), loadLocationIcons(), loadMerchants(), loadNpcs(), loadRoutes()]);
    })();
  }, [checkAdmin, loadLocations, loadLocationIcons, loadMerchants, loadNpcs, loadRoutes]);

  // Refresh NPC pins when auth state changes (e.g., after login)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (sess?.user) loadNpcs();
      else setMapNpcs([]);
    });
    return () => data?.subscription?.unsubscribe?.();
  }, [loadNpcs]);

  // Deep link: open merchant storefront from /map?merchant=<uuid>
  useEffect(() => {
    if (!router.isReady) return;
    const mId = typeof router.query.merchant === "string" ? router.query.merchant : null;
    if (!mId) return;
    if (openedMerchantFromQueryRef.current) return;
    if (!merchants || !merchants.length) return;

    const m = merchants.find((x) => x.id === mId);
    if (!m) return;

    openedMerchantFromQueryRef.current = true;
    setSelMerchant(m);
    showExclusiveOffcanvas("merchantPanel");
  }, [router.isReady, router.query.merchant, merchants]);


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
    if (!routePanelOpen) return;
    showExclusiveOffcanvas("routePanel");
  }, [routePanelOpen, showExclusiveOffcanvas]);

  /* IMPORTANT FIX:
     Do NOT clear BOTH selections when ANY panel closes.
     Each panel clears ONLY its own state. */
  useEffect(() => {
    const locEl = document.getElementById("locPanel");
    const merEl = document.getElementById("merchantPanel");
    const routeEl = document.getElementById("routePanel");

    const onLocHidden = () => setSelLoc(null);
    const onMerHidden = () => setSelMerchant(null);
    const onRouteHidden = () => setRoutePanelOpen(false);

    if (locEl) locEl.addEventListener("hidden.bs.offcanvas", onLocHidden);
    if (merEl) merEl.addEventListener("hidden.bs.offcanvas", onMerHidden);
    if (routeEl) routeEl.addEventListener("hidden.bs.offcanvas", onRouteHidden);

    return () => {
      if (locEl) locEl.removeEventListener("hidden.bs.offcanvas", onLocHidden);
      if (merEl) merEl.removeEventListener("hidden.bs.offcanvas", onMerHidden);
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

    let x = Number(m.x);
    let y = Number(m.y);

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
  function handleMapClick(e) {
    const raw = eventToRawPct(e);
    if (!raw) return;
    const db = rawPctToDb(raw);
    if (db) setLastClickPt(db);

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
            String(res.error.message || "").toLowerCase().includes("is_hidden") ||
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
          onClick={handleMapClick}
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
              const lx = asLocPct(l.x);
              const ly = asLocPct(l.y);
              if (!Number.isFinite(lx) || !Number.isFinite(ly)) return null;

              const icon = l.icon_id ? locationIconsById.get(String(l.icon_id)) : null;
              const src = icon?.public_url || "";
              const scale = Number(l.marker_scale || 1) || 1;
              const ax = Number(l.marker_anchor_x ?? 0.5);
              // Enforce center anchor by default; DB values can override.
              const ay = Number(l.marker_anchor_y ?? 0.5);
              const rot = Number(l.marker_rotation_deg ?? 0) || 0;
              const isDragging = draggingKey === previewKey("location", l.id);
              const iconPx = Math.max(8, Math.round(26 * scale));

              return (
                <button
                  key={l.id}
                  className={`map-pin pin-location${src ? " has-marker" : ""}${isAdmin ? " draggable" : ""}${isDragging ? " is-dragging" : ""}`}
                  style={{
                    left: `${lx * SCALE_X}%`,
                    top: `${ly * SCALE_Y}%`,
                    width: `${iconPx}px`,
                    height: `${iconPx}px`,
                    minWidth: `${iconPx}px`,
                    minHeight: `${iconPx}px`,
                    pointerEvents: "auto",
                    transform: `translate(${-ax * 100}%, ${-ay * 100}%) rotate(${rot}deg)`,
                  }}
                  title={l.name}
                  onPointerDown={(ev) => beginDragPin(ev, "location", l.id)}
                  onPointerMove={onPinPointerMove}
                  onPointerUp={onPinPointerUp}
                  onPointerCancel={onPinPointerCancel}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (shouldSuppressClick()) return;

                    // Open location (LEFT), close other panels
                    setRoutePanelOpen(false);
                    setSelMerchant(null);
                    setSelLoc(l);

                    // Admin QoL: clicking an existing marker opens the right-hand marker drawer
                    // preloaded with this location's marker settings so they can be edited in-place.
                    if (isAdmin) {
                      setLocationDrawerOpen(true);
                      setPlacingLocation(false);
                      setPlaceCfg({
                        icon_id: l.icon_id || "",
                        name: l.name || "",
                        is_hidden: !!l.is_hidden,
                        scale: l.marker_scale ?? 1,
                        anchor: l.marker_anchor || "Center",
                        anchor_x: l.marker_anchor_x ?? 0.5,
                        anchor_y: l.marker_anchor_y ?? 0.5,
                        rotation_deg: l.marker_rotation_deg ?? 0,
                        x_offset_px: l.marker_x_offset_px ?? 0,
                        y_offset_px: l.marker_y_offset_px ?? -4,
                        edit_location_id: l.id,
                      });
                    }
                  }}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        // Rotate only the glyph, not the label.
                        transform: `rotate(${rot}deg)`,
                      pointerEvents: "none",
                      }}
                      onError={(e) => {
                        if (e?.currentTarget) e.currentTarget.style.display = "none";
                      }}
                    />
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
                    // Open merchant (RIGHT), close other panels
                    setRoutePanelOpen(false);
                    setSelLoc(null);
                    setSelMerchant(m);
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
              return (
                <button
                  key={`npc-${n.id}`}
                  className={`map-pin pin-npc${isAdmin ? " draggable" : ""}${isDragging ? " is-dragging" : ""}`}
                  style={{ left: `${nx * SCALE_X}%`, top: `${ny * SCALE_Y}%` }}
                  title={n.name}
                  onPointerDown={(ev) => beginDragPin(ev, "npc", n.id)}
                  onPointerMove={onPinPointerMove}
                  onPointerUp={onPinPointerUp}
                  onPointerCancel={onPinPointerCancel}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (shouldSuppressClick()) return;
                    router.push(`/npcs?focus=npc:${encodeURIComponent(n.id)}`);
                  }}
                >
                  <span className="npc-ico">
                    {disp?.emoji ? (
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

      {/* Location Offcanvas (LEFT dock — same slot as Routes) */}
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

      
      <LocationIconDrawer
        open={locationDrawerOpen}
        isAdmin={isAdmin}
        icons={locationIcons}
        placing={placingLocation}
        placeConfig={placeCfg}
        addMode={addMode}
        defaultTab={"markers"}
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
        onClose={() => {
          setLocationDrawerOpen(false);
          setPlacingLocation(false);
          // leaving an edit session should not keep stale edit metadata around
          setPlaceCfg((p) => ({ ...p, edit_location_id: null }));
        }}
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
          setPlacingLocation((v) => !v);
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
{/* Routes Panel Component (LEFT dock) */}
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

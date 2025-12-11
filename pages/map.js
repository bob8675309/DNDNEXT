/* pages/map.js */
import { useEffect, useRef, useState, useCallback } from "react";
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

/* Utilities */
const asPct = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

export default function MapPage() {
  const [locs, setLocs] = useState([]);
  const [merchants, setMerchants] = useState([]);

  const [addMode, setAddMode] = useState(false);
  const [clickPt, setClickPt] = useState(null);
  const [err, setErr] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [selLoc, setSelLoc] = useState(null);
  const [selMerchant, setSelMerchant] = useState(null);

  // Reposition dropdowns
  const [repositionLocId, setRepositionLocId] = useState("");
  const [repositionMerchId, setRepositionMerchId] = useState("");

  const imgRef = useRef(null);

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

    const rows = data || [];
    setMerchants(rows);

    // Keep the currently-open merchant panel in sync with fresh DB data
    setSelMerchant((prev) => {
      if (!prev) return prev;
      const fresh = rows.find((m) => m.id === prev.id);
      return fresh || prev;
    });
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      await checkAdmin();
      await Promise.all([loadLocations(), loadMerchants()]);
    })();
  }, [checkAdmin, loadLocations, loadMerchants]);

  /* ---------- Offcanvas show when a selection is set ---------- */
  useEffect(() => {
    if (!selLoc) return;
    const el = document.getElementById("locPanel");
    if (el && window.bootstrap) {
      window.bootstrap.Offcanvas.getOrCreateInstance(el).show();
    }
  }, [selLoc]);

  useEffect(() => {
    if (!selMerchant) return;
    const el = document.getElementById("merchantPanel");
    if (el && window.bootstrap) {
      window.bootstrap.Offcanvas.getOrCreateInstance(el).show();
    }
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

  // Realtime subscription: keep merchants in sync with DB changes
  useEffect(() => {
    const channel = supabase
      .channel("merchants_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchants" },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row) return;

          setMerchants((prev) => {
            const idx = prev.findIndex((m) => m.id === row.id);

            if (payload.eventType === "DELETE") {
              if (idx === -1) return prev;
              const next = prev.slice();
              next.splice(idx, 1);
              return next;
            }

            const merged = idx === -1 ? row : { ...prev[idx], ...row };
            if (idx === -1) return [...prev, merged];

            const next = prev.slice();
            next[idx] = merged;
            return next;
          });

          // keep the open panel merchant fresh
          setSelMerchant((prev) =>
            prev && prev.id === row.id ? { ...prev, ...row } : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
        x = 50;
        y = 50;
      }
    }
    return { x, y };
  }

  /* ---------- Mouse → percentage coordinates ---------- */
  function handleMapClick(ev) {
    if (!addMode) return;
    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const rawX = ((ev.clientX - rect.left) / rect.width) * 100;
    const rawY = ((ev.clientY - rect.top) / rect.height) * 100;

    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;

    setClickPt({ x: rawX, y: rawY });
    const el = document.getElementById("addLocModal");
    if (el && window.bootstrap) {
      window.bootstrap.Modal.getOrCreateInstance(el).show();
    }
  }

  const handleRepositionSubmit = async (ev) => {
    ev.preventDefault();
    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const rawX = ((ev.nativeEvent.offsetX ?? 0) / rect.width) * 100;
    const rawY = ((ev.nativeEvent.offsetY ?? 0) / rect.height) * 100;

    const dbX = rawX * SCALE_X;
    const dbY = rawY * SCALE_Y;

    try {
      if (repositionLocId) {
        const { error } = await supabase
          .from("locations")
          .update({ x: dbX, y: dbY })
          .eq("id", repositionLocId);
        if (error) throw error;
        await loadLocations();
      } else if (repositionMerchId) {
        const { error } = await supabase
          .from("merchants")
          .update({ x: dbX, y: dbY })
          .eq("id", repositionMerchId);
        if (error) throw error;
        await loadMerchants();
      }
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to reposition.");
    } finally {
      setRepositionLocId("");
      setRepositionMerchId("");
    }
  };

  /* ---------- Render ---------- */
  return (
    <div className="container-fluid my-3 map-page">
      {/* Toolbar */}
      <div className="d-flex gap-3 align-items-center mb-2 flex-wrap">
        <button
          className={`btn btn-sm ${addMode ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setAddMode((v) => !v)}
        >
          {addMode ? "Click on the map…" : "Add Location"}
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
              style={{ width: 260 }}
              value={repositionMerchId}
              onChange={(e) => {
                setRepositionMerchId(e.target.value);
                setRepositionLocId("");
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
      </div>

      {err && (
        <div className="alert alert-danger py-1 mb-2">
          <small>{err}</small>
        </div>
      )}

      {/* Map shell */}
      <div className="map-shell">
        <div className="map-wrap" onClick={addMode ? handleMapClick : undefined}>
          <img
            ref={imgRef}
            src="/world-map.png"
            alt="World map"
            className="map-img"
          />

          {/* Overlay pins */}
          <div className="map-overlay" onClick={repositionLocId || repositionMerchId ? handleRepositionSubmit : undefined}>
            {/* Locations */}
            {locs.map((loc) => (
              <button
                key={loc.id}
                type="button"
                className="map-pin btn btn-sm btn-outline-light"
                style={{
                  left: `${asPct(loc.x) / SCALE_X}%`,
                  top: `${asPct(loc.y) / SCALE_Y}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelLoc(loc);
                }}
              >
                {loc.name}
              </button>
            ))}

            {/* Merchants */}
            {merchants.map((m) => {
              const pos = pinPosForMerchant(m);
              const theme = detectTheme(m);
              const emoji = emojiForTheme(theme);
              return (
                <button
                  key={m.id}
                  type="button"
                  className="map-merchant-pill btn btn-sm btn-outline-info"
                  style={{
                    left: `${pos.x / SCALE_X}%`,
                    top: `${pos.y / SCALE_Y}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelMerchant(m);
                  }}
                >
                  <span className="pill-emoji">{emoji}</span>
                  <span className="pill-label">{m.name}</span>
                </button>
              );
            })}
          </div>
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
        {selLoc && (
          <LocationSideBar
            location={selLoc}
            onClose={() => setSelLoc(null)}
            onReload={loadLocations}
          />
        )}
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
            <MerchantPanel
              merchant={selMerchant}
              isAdmin={isAdmin}
              locations={locs}
            />
          </div>
        )}
      </div>
    </div>
  );
}

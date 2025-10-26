/* pages/map.js */
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";
import MerchantPanel from "../components/MerchantPanel";
import LocationSideBar from "../components/LocationSideBar";
import { themeFromMerchant as detectTheme } from "../utils/merchantTheme";

/* ===== Map calibration (X had been saved in 4:3 space) =====
   Render uses SCALE_*; DB writes use inverse SCALE_*.
   After you re-save everything once, set SCALE_X back to 1.
*/
const SCALE_X = 0.75;
const SCALE_Y = 1.0;

/* Utilities */
const asPct = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  const n = parseFloat(s.replace("%", ""));
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
        "id,name,x,y,inventory,icon,location_id,last_known_location_id,projected_destination_id"
      )
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    setMerchants(data || []);
  }, []);

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

  // Keep React state in sync if user closes an offcanvas by ESC or the close button
  useEffect(() => {
    const locEl = document.getElementById("locPanel");
    const merchEl = document.getElementById("merchantPanel");
    const onHiddenLoc = () => setSelLoc(null);
    const onHiddenMerch = () => setSelMerchant(null);
    locEl?.addEventListener("hidden.bs.offcanvas", onHiddenLoc);
    merchEl?.addEventListener("hidden.bs.offcanvas", onHiddenMerch);
    return () => {
      locEl?.removeEventListener("hidden.bs.offcanvas", onHiddenLoc);
      merchEl?.removeEventListener("hidden.bs.offcanvas", onHiddenMerch);
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

  /* ---------- Map click: add or reposition ---------- */
  function handleMapClick(e) {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawX = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const rawY = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;

    // Reposition flows (inverse scale to DB)
    if (repositionLocId) {
      (async () => {
        const dbX = rawX / SCALE_X;
        const dbY = rawY / SCALE_Y;
        const { error } = await supabase
          .from("locations")
          .update({ x: dbX, y: dbY })
          .eq("id", repositionLocId);
        if (error) alert(error.message);
        setRepositionLocId("");
        await loadLocations();
      })();
      return;
    }

    if (repositionMerchId) {
      (async () => {
        const dbX = rawX / SCALE_X;
        const dbY = rawY / SCALE_Y;
        const { error } = await supabase
          .from("merchants")
          .update({ x: dbX, y: dbY })
          .eq("id", repositionMerchId);
        if (error) alert(error.message);
        setRepositionMerchId("");
        await loadMerchants();
      })();
      return;
    }

    // Add flow
    if (!addMode) return;
    setClickPt({ x: rawX, y: rawY });
    const el = document.getElementById("addLocModal");
    if (el && window.bootstrap) {
      window.bootstrap.Modal.getOrCreateInstance(el).show();
    }
  }

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
              style={{ width: 240 }}
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

        {err && <div className="text-danger small">{err}</div>}
      </div>

      {/* Map */}
      <div className="map-shell">
        {/* Visual dim: never blocks clicks */}
        <div
          className={`map-dim${selLoc || selMerchant ? " show" : ""}`}
          style={{ pointerEvents: "none" }}
        />

        <div className="map-wrap" onClick={handleMapClick}>
          <img ref={imgRef} src="/Wmap.jpg" alt="World map" className="map-img" />

          <div className="map-overlay" style={{ pointerEvents: "auto" }}>
            {/* Locations */}
            {locs.map((l) => {
              const lx = asPct(l.x);
              const ly = asPct(l.y);
              if (!Number.isFinite(lx) || !Number.isFinite(ly)) return null;
              return (
                <button
                  key={l.id}
                  className="map-pin pin-location"
                  style={{
                    left: `${lx * SCALE_X}%`,
                    top: `${ly * SCALE_Y}%`,
                  }}
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
              const theme = detectTheme(m); // smith, weapons, alchemy, etc.
              const emojiMap = {
                smith: "⚒️",
                weapons: "🗡️",
                alchemy: "🧪",
                herbalist: "🌿",
                caravan: "🐪",
                stable: "🐎",
                clothier: "🧵",
                jeweler: "💎",
                arcanist: "📜",
                general: "🛍️",
              };
              const emoji = emojiMap[theme] || "🛍️";

              return (
                <button
                  key={`mer-${m.id}`}
                  className={`map-pin pin-merchant pin-pill pill-${theme}`}
                  style={{
                    left: `${mx * SCALE_X}%`,
                    top: `${my * SCALE_Y}%`,
                  }}
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
                  background: "rgba(126,88,255,.25)",
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
        {selLoc && (
          <LocationSideBar
            location={selLoc}
            onClose={() => setSelLoc(null)}
            onReload={loadLocations}
          />
        )}
      </div>

      {/* Merchant Offcanvas (z-index raised in CSS so cards float above map) */}
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
            <div className="offcanvas-header">
              <h5 className="offcanvas-title">{selMerchant.name}’s Wares</h5>
              <button
                className="btn-close"
                data-bs-dismiss="offcanvas"
                onClick={() => setSelMerchant(null)}
              />
            </div>
            <div className="p-3">
              <MerchantPanel merchant={selMerchant} isAdmin={isAdmin} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

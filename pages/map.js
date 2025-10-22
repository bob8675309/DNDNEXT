// /pages/map.js
import { useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import MerchantPanel from "@/components/MerchantPanel";

/* =========================
   Theme helper + tiny pill (inline)
   ========================= */
function themeFromMerchant(m) {
  const s = (m?.icon || m?.name || "").toLowerCase();
  if (/(smith|anvil|forge|hammer)/.test(s)) return "smith";
  if (/(weapon|blade|sword)/.test(s)) return "weapons";
  if (/(potion|alch)/.test(s)) return "alchemy";
  if (/(leaf|herb|plant)/.test(s)) return "herbalist";
  if (/(camel|caravan|trader)/.test(s)) return "caravan";
  if (/(horse|stable|courier)/.test(s)) return "stable";
  if (/(cloak|cloth|tailor)/.test(s)) return "clothier";
  if (/(gem|jewel)/.test(s)) return "jeweler";
  if (/(book|scribe|tome|arcane|wizard|mage)/.test(s)) return "arcanist";
  return "general";
}
function Pill({ theme, label }) {
  const emoji =
    {
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
    }[theme] || "🛍️";
  return (
    <span className={`pill pill-sm pill-${theme}`}>
      <span className="pill-ico">{emoji}</span>
      <span className="pill-txt d-none d-sm-inline">{label}</span>
    </span>
  );
}

/* =========================
   Calibration (4/3 → *0.75). Set to 1 when done.
   ========================= */
const SCALE_X = 0.75;
const SCALE_Y = 1.0;

/* =========================
   Robust parsing for TEXT x/y (“44.2%”, “”, null → number|NaN)
   ========================= */
function asPctNumber(v) {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  const n = parseFloat(s.replace("%", ""));
  return Number.isFinite(n) ? n : NaN;
}

export default function MapPage() {
  const [locs, setLocs] = useState([]);
  const [merchants, setMerchants] = useState([]);

  const [addMode, setAddMode] = useState(false);
  const [clickPt, setClickPt] = useState(null);
  const [err, setErr] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [selMerchant, setSelMerchant] = useState(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [selNPCs, setSelNPCs] = useState([]);
  const [selQuests, setSelQuests] = useState([]);
  const [allNPCs, setAllNPCs] = useState([]);
  const [allQuests, setAllQuests] = useState([]);

  // Admin: choose an existing location to reposition by clicking
  const [repositionId, setRepositionId] = useState(null);

  const imgRef = useRef(null);

  useEffect(() => {
    (async () => {
      await checkAdmin();
      await Promise.all([loadLocations(), loadMerchants(), loadNPCs(), loadQuests()]);
    })();
  }, []);

  /* ---------- data loads ---------- */
  async function checkAdmin() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const { data } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    setIsAdmin(data?.role === "admin");
  }

  async function loadLocations() {
    const { data, error } = await supabase.from("locations").select("*").order("id");
    if (error) setErr(error.message);
    setLocs(data || []);
  }

  async function loadMerchants() {
    const { data, error } = await supabase
      .from("merchants")
      .select(
        "id,name,x,y,inventory,icon,location_id,last_known_location_id,projected_destination_id"
      )
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    setMerchants(data || []);
  }

  async function loadNPCs() {
    const { data, error } = await supabase
      .from("npcs")
      .select("id,name,race,role")
      .order("name", { ascending: true });
    if (error) console.error(error);
    setAllNPCs(data || []);
  }

  async function loadQuests() {
    const { data, error } = await supabase
      .from("quests")
      .select("id,name,description,status")
      .order("name", { ascending: true });
    if (error) console.error(error);
    setAllQuests(data || []);
  }

  async function hydrateLocation(l) {
    setPanelLoading(true);
    const npcIds = idsFrom(l.npcs);
    const questIds = idsFrom(l.quests);
    const [npcsRes, questsRes] = await Promise.all([
      npcIds.length
        ? supabase.from("npcs").select("id,name,race,role").in("id", npcIds)
        : Promise.resolve({ data: [] }),
      questIds.length
        ? supabase.from("quests").select("id,name,description,status").in("id", questIds)
        : Promise.resolve({ data: [] }),
    ]);
    setSelNPCs(npcsRes.data || []);
    setSelQuests(questsRes.data || []);
    setPanelLoading(false);
  }

  function idsFrom(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map((v) => String(v));
    try {
      const arr = JSON.parse(val);
      return Array.isArray(arr) ? arr.map((v) => String(v)) : [];
    } catch {
      return [];
    }
  }

  /* ---------- panel helpers ---------- */
  function openLocationPanel(l) {
    setSel(l);
    hydrateLocation(l);
    const el = document.getElementById("locPanel");
    if (el && window.bootstrap) {
      const oc = window.bootstrap.Offcanvas.getOrCreateInstance(el, {
        backdrop: false,
        scroll: true,
        keyboard: true,
      });
      oc.show();
      setPanelOpen(true);
      el.addEventListener(
        "hidden.bs.offcanvas",
        () => {
          setPanelOpen(false);
          setSel(null);
        },
        { once: true }
      );
    }
  }

  function openMerchantPanel(m) {
    setSelMerchant(m);
    const el = document.getElementById("merchantPanel");
    if (el && window.bootstrap) {
      const oc = window.bootstrap.Offcanvas.getOrCreateInstance(el, {
        backdrop: false,
        scroll: true,
        keyboard: true,
      });
      oc.show();
      setPanelOpen(true);
      el.addEventListener(
        "hidden.bs.offcanvas",
        () => {
          setPanelOpen(false);
          setSelMerchant(null);
        },
        { once: true }
      );
    }
  }

  // Positioning for merchant pins; falls back to attached location w/ tiny jitter.
  // IMPORTANT: returns NUMBERS (no %). We add % only in style.
  function pinPosForMerchant(m, locsArr) {
    const inRange = (n) => Number.isFinite(n) && n >= 0 && n <= 100;
    let x = Number(m.x),
      y = Number(m.y);
    if (!inRange(x) || !inRange(y)) {
      const locId = m.location_id ?? m.last_known_location_id;
      const loc = locsArr.find((l) => String(l.id) === String(locId));
      if (loc) {
        const jx = (Math.random() - 0.5) * 0.8;
        const jy = (Math.random() - 0.5) * 0.8;
        const lx = asPctNumber(loc.x);
        const ly = asPctNumber(loc.y);
        x = Math.min(100, Math.max(0, (Number.isFinite(lx) ? lx : 0) + jx));
        y = Math.min(100, Math.max(0, (Number.isFinite(ly) ? ly : 0) + jy));
      }
    }
    x = Math.min(100, Math.max(0, Number.isFinite(x) ? x : 0));
    y = Math.min(100, Math.max(0, Number.isFinite(y) ? y : 0));
    return [x, y]; // numbers
  }

  /* ---------- UI ---------- */
  function handleMapClick(e) {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    // raw click in percentage space
    const rawX = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const rawY = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;

    // If repositioning: save DB value as inverse-calibrated
    if (repositionId) {
      (async () => {
        const dbX = rawX / SCALE_X;
        const dbY = rawY / SCALE_Y;
        const { error } = await supabase
          .from("locations")
          .update({ x: dbX, y: dbY })
          .eq("id", repositionId);
        if (error) alert(error.message);
        else {
          await loadLocations();
          setRepositionId(null);
        }
      })();
      return;
    }

    if (!addMode) return;
    setClickPt({ x: rawX, y: rawY });
    const el = document.getElementById("addLocModal");
    if (el && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(el).show();
  }

  return (
    <div className="container-fluid my-3 map-page">
      <div className="d-flex gap-3 align-items-center mb-2 flex-wrap">
        <button
          className={`btn btn-sm ${addMode ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setAddMode((v) => !v)}
        >
          {addMode ? "Click on the map…" : "Add Location"}
        </button>

        {isAdmin && (
          <div className="d-flex gap-2 align-items-center">
            <select
              className="form-select form-select-sm"
              style={{ width: 260 }}
              value={repositionId ?? ""}
              onChange={(e) => setRepositionId(e.target.value || null)}
            >
              <option value="">Reposition location…</option>
              {locs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {repositionId && (
              <span className="text-muted small">Click on the map to set a new position</span>
            )}
          </div>
        )}

        {err && <div className="text-danger small">{err}</div>}
      </div>

      <div className="map-shell">
        {/* Dim: visible when panels open, but never blocks clicks */}
        <div
          className={`map-dim${panelOpen ? " show" : ""}`}
          style={{ pointerEvents: "none" }}
        />

        <div className="map-wrap" onClick={handleMapClick}>
          {/* Keep your actual asset name */}
          <img ref={imgRef} src="/Wmap.jpg" alt="World map" className="map-img" />

          {/* Ensure overlay is clickable */}
          <div className="map-overlay" style={{ pointerEvents: "auto" }}>
            {/* Locations */}
            {locs.map((l) => {
              const lx = asPctNumber(l.x);
              const ly = asPctNumber(l.y);
              if (!Number.isFinite(lx) || !Number.isFinite(ly)) return null;
              return (
                <button
                  key={l.id}
                  className="map-pin pin-location"
                  style={{ left: `${lx * SCALE_X}%`, top: `${ly * SCALE_Y}%` }}
                  title={l.name}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openLocationPanel(l);
                  }}
                />
              );
            })}

            {/* Merchants: icon-only pill; name bubble via CSS on hover/focus */}
            {merchants.map((m) => {
              const [mx, my] = pinPosForMerchant(m, locs);
              const theme = themeFromMerchant(m);
              const emoji =
                {
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
                }[theme] || "🛍️";
              return (
                <button
                  key={`mer-${m.id}`}
                  type="button"
                  className={`map-pin pin-merchant pin-pill pill-${theme}`}
                  style={{ left: `${mx * SCALE_X}%`, top: `${my * SCALE_Y}%` }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openMerchantPanel(m);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      openMerchantPanel(m);
                    }
                  }}
                  aria-label={m.name}
                  title={m.name}
                >
                  <span className="pill-ico" aria-hidden="true">
                    {emoji}
                  </span>
                  <span className="pin-label">{m.name}</span>
                </button>
              );
            })}

            {/* Preview dot during Add mode */}
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

      {/* =================== Add Location Modal =================== */}
      <div className="modal fade" id="addLocModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <form
            className="modal-content"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const patch = {
                name: (fd.get("name") || "").toString().trim(),
                description: (fd.get("description") || "").toString().trim() || null,
                // write inverse-calibrated values so next render matches click
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
              {clickPt && (
                <div className="small text-muted">
                  Position: {clickPt.x.toFixed(1)}%, {clickPt.y.toFixed(1)}%
                </div>
              )}
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

      {/* =================== Location Panel =================== */}
      <div
        className="offcanvas offcanvas-end loc-panel"
        id="locPanel"
        data-bs-backdrop="false"
        data-bs-scroll="true"
        data-bs-keyboard="true"
        tabIndex="-1"
        aria-labelledby="locPanelLabel"
      >
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id="locPanelLabel">
            {sel?.name || "Location"}
          </h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          {panelLoading && <div className="text-muted small mb-3">Loading…</div>}
          {sel?.description && <p className="loc-desc">{sel.description}</p>}

          {/* Quests */}
          <div className="loc-sec">
            <div className="loc-sec-title">
              <span>Quests</span>
              {isAdmin && (
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#linkQuestModal">
                    Link
                  </button>
                  <button className="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#createQuestModal">
                    + New
                  </button>
                </div>
              )}
            </div>
            {selQuests.length === 0 && <div className="text-muted small">No quests linked.</div>}
            {selQuests.map((q) => (
              <div key={q.id} className="loc-item">
                <div className="fw-semibold">{q.name}</div>
                {q.status && <span className="badge-soft ms-2 align-middle">{q.status}</span>}
                {q.description && <div className="text-muted small mt-1">{q.description}</div>}
              </div>
            ))}
          </div>

          {/* NPCs */}
          <div className="loc-sec">
            <div className="loc-sec-title">
              <span>NPCs</span>
              {isAdmin && (
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#linkNpcModal">
                    Link
                  </button>
                  <button className="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#createNpcModal">
                    + New
                  </button>
                </div>
              )}
            </div>
            {selNPCs.length === 0 && <div className="text-muted small">No notable NPCs recorded.</div>}
            {selNPCs.map((n) => (
              <div key={n.id} className="loc-item">
                <div className="fw-semibold">{n.name}</div>
                <div className="small text-muted">{[n.race, n.role].filter(Boolean).join(" • ")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Merchant Offcanvas ===== */}
      <div
        className="offcanvas offcanvas-end position-fixed border-0 loc-panel"
        id="merchantPanel"
        tabIndex="-1"
        aria-labelledby="merchantPanelLabel"
        style={{ display: selMerchant ? "block" : "none", width: 420, zIndex: 2000 }}
      >
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id="merchantPanelLabel">
            {selMerchant ? `${selMerchant.name}’s Wares` : "Merchant"}
          </h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          {selMerchant && <MerchantPanel merchant={selMerchant} isAdmin={true} />}
        </div>
      </div>
    </div>
  );
}

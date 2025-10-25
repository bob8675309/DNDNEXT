// /pages/map.js
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MerchantPanel from "../components/MerchantPanel";
import LocationSideBar from "../components/LocationSideBar";
/** ********************************************************************
 * MapPage
 * - Loads locations, merchants, NPCs, quests
 * - Adds new location (admin)
 * - Reposition existing locations or merchants (admin)
 * - Opens Location panel (right offcanvas)
 * - Opens Merchant panel (right offcanvas with MerchantPanel inside)
 * - Merchant pins are icon-only pills; show name bubble on hover/focus
 *
 * IMPORTANT: we keep a temporary X calibration so legacy coordinates
 *   still render where they were placed when the map was “stretched”.
 *   Once you finish repositioning, set SCALE_X = 1.
 ********************************************************************* */
const SCALE_X = 0.75; // <-- temporary calibration for legacy X values

export default function MapPage() {
  const [locs, setLocs] = useState([]);
  const [merchants, setMerchants] = useState([]);

  const [addMode, setAddMode] = useState(false);
  const [repositionLocId, setRepositionLocId] = useState("");      // bigint
  const [repositionMerchId, setRepositionMerchId] = useState("");  // uuid

  const [clickPt, setClickPt] = useState(null);
  const [err, setErr] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Right-drawer selection
  const [sel, setSel] = useState(null);               // location
  const [selMerchant, setSelMerchant] = useState(null);

  // Location panel hydrated data
  const [panelLoading, setPanelLoading] = useState(false);
  const [selNPCs, setSelNPCs] = useState([]);
  const [selQuests, setSelQuests] = useState([]);
  const [allNPCs, setAllNPCs] = useState([]);
  const [allQuests, setAllQuests] = useState([]);

  const imgRef = useRef(null);

  useEffect(() => {
    checkAdmin();
    loadLocations();
    loadMerchants();
    loadNPCs();
    loadQuests();
  }, []);

  /* -------------------------- loads -------------------------- */
  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsAdmin(false); return; }
    const { data } = await supabase
      .from("user_profiles").select("role")
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
      .select("id,name,x,y,inventory,icon,location_id,last_known_location_id,projected_destination_id,created_at")
      .order("created_at", { ascending: true });
    if (error) setErr(error.message);
    setMerchants(data || []);
  }

  async function loadNPCs() {
    try {
      const { data, error } = await supabase
        .from("npcs")
        .select("id, name, race, role")
        .order("name");
      if (error) throw error;
      setAllNPCs(data || []);
    } catch (e) {
      console.error("loadNPCs failed:", e);
    }
  }

  async function loadQuests() {
    try {
      const { data, error } = await supabase
        .from("quests")
        .select("id, name, description, status")
        .order("name");
      if (error) throw error;
      setAllQuests(data || []);
    } catch (e) {
      console.error("loadQuests failed:", e);
    }
  }

  /* --------------------- location hydrate -------------------- */
  function idsFrom(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map((v) => String(v));
    try {
      const arr = JSON.parse(val);
      return Array.isArray(arr) ? arr.map((v) => String(v)) : [];
    } catch { return []; }
  }

  async function hydrateLocation(l) {
    setPanelLoading(true);
    const npcIds   = idsFrom(l.npcs);
    const questIds = idsFrom(l.quests);
    const [npcsRes, questsRes] = await Promise.all([
      npcIds.length   ? supabase.from("npcs").select("id,name,race,role").in("id", npcIds)   : Promise.resolve({ data: [] }),
      questIds.length ? supabase.from("quests").select("id,name,description,status").in("id", questIds) : Promise.resolve({ data: [] }),
    ]);
    setSelNPCs(npcsRes.data || []);
    setSelQuests(questsRes.data || []);
    setPanelLoading(false);
  }

  /* ----------------------- offcanvas open -------------------- */
  function openLocationPanel(l) {
    setSel(l);
    hydrateLocation(l);
    const el = document.getElementById("locPanel");
    if (el && window.bootstrap) {
      const oc = window.bootstrap.Offcanvas.getOrCreateInstance(el, { backdrop: false, scroll: true, keyboard: true });
      oc.show(); setPanelOpen(true);
      el.addEventListener("hidden.bs.offcanvas", () => { setPanelOpen(false); setSel(null); }, { once: true });
    }
  }

  function openMerchantPanel(m) {
    setSelMerchant(m);
    const el = document.getElementById("merchantPanel");
    if (el && window.bootstrap) {
      const oc = window.bootstrap.Offcanvas.getOrCreateInstance(el, { backdrop: false, scroll: true, keyboard: true });
      oc.show(); setPanelOpen(true);
      el.addEventListener("hidden.bs.offcanvas", () => { setPanelOpen(false); setSelMerchant(null); }, { once: true });
    }
  }

  /* --------------------- pin positioning --------------------- */
  // Merchant: use stored (x,y) if sane; otherwise attach near a linked location with small jitter.
  function pinPosForMerchant(m, locsArr) {
    const inRange = (n) => Number.isFinite(n) && n >= 0 && n <= 100;
    let x = Number(m.x), y = Number(m.y);
    if (!inRange(x) || !inRange(y)) {
      const locId = m.location_id ?? m.last_known_location_id;
      const loc = locsArr.find((l) => String(l.id) === String(locId));
      if (loc) {
        const jx = (Math.random() - 0.5) * 0.8;
        const jy = (Math.random() - 0.5) * 0.8;
        x = Math.min(100, Math.max(0, parseFloat(loc.x) + jx));
        y = Math.min(100, Math.max(0, parseFloat(loc.y) + jy));
      }
    }
    // Apply visual calibration for legacy X values
    const left = `${(Number.isFinite(x) ? x : 0) * SCALE_X}%`;
    const top  = `${Math.min(100, Math.max(0, Number.isFinite(y) ? y : 0))}%`;
    return [left, top];
  }

  /* --------------------- add / reposition -------------------- */
  function getClickPercents(e) {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }

  async function createLocation(fd) {
    const patch = {
      name: (fd.get("name") || "").toString().trim(),
      x: clickPt?.x != null ? String(Math.round(clickPt.x / SCALE_X * 10) / 10) : null, // store de-calibrated x
      y: clickPt?.y != null ? String(clickPt.y) : null,
      description: (fd.get("description") || "").toString().trim() || null,
    };
    const { error } = await supabase.from("locations").insert(patch);
    if (error) return alert(error.message);
    await loadLocations(); setAddMode(false); setClickPt(null);
  }

  async function saveRepositionLocation(id, pt) {
    const patch = { x: String(Math.round(pt.x / SCALE_X * 10) / 10), y: String(pt.y) };
    const { error } = await supabase.from("locations").update(patch).eq("id", id);
    if (error) return alert(error.message);
    await loadLocations();
  }

  async function saveRepositionMerchant(id, pt) {
    const patch = { x: Math.round(pt.x / SCALE_X * 10) / 10, y: pt.y };
    const { error } = await supabase.from("merchants").update(patch).eq("id", id);
    if (error) return alert(error.message);
    await loadMerchants();
  }

  function handleMapClick(e) {
    const pt = getClickPercents(e);
    if (!pt) return;

    // Preview marker (for Add Location modal)
    setClickPt(pt);

    // Reposition mode overrides add mode
    if (repositionLocId) {
      saveRepositionLocation(repositionLocId, pt).then(() => {
        setRepositionLocId("");
        setClickPt(null);
      });
      return;
    }
    if (repositionMerchId) {
      saveRepositionMerchant(repositionMerchId, pt).then(() => {
        setRepositionMerchId("");
        setClickPt(null);
      });
      return;
    }

    if (addMode) {
      const el = document.getElementById("addLocModal");
      if (el && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(el).show();
    }
  }

  /* --------------------------- UI ---------------------------- */
  return (
    <div className="container-fluid my-3 map-page">
      {/* Top controls */}
      <div className="d-flex gap-2 align-items-center mb-2">
        <button
          className={`btn btn-sm ${addMode ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setAddMode(v => !v)}
        >
          {addMode ? "Click on the map…" : "Add Location"}
        </button>

        {isAdmin && (
          <>
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 240 }}
              value={repositionLocId}
              onChange={(e) => setRepositionLocId(e.target.value)}
            >
              <option value="">Reposition location…</option>
              {locs.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
            </select>

            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 240 }}
              value={repositionMerchId}
              onChange={(e) => setRepositionMerchId(e.target.value)}
            >
              <option value="">Reposition merchant…</option>
              {merchants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </>
        )}

        {err && <div className="text-danger small ms-2">{err}</div>}
      </div>

      {/* Map shell */}
      <div className="map-shell">
        {/* Visual dim when any panel is open (doesn't block clicks) */}
        <div className={`map-dim${panelOpen ? " show" : ""}`} />

        <div className="map-wrap" onClick={handleMapClick}>
          <img ref={imgRef} src="/Wmap.jpg" alt="World map" className="map-img" />

          {/* overlay */}
          <div className="map-overlay">
            {/* Locations */}
            {locs.map((l) => {
              const left = `${Number(l.x) * SCALE_X}%`;
              const top  = `${Number(l.y)}%`;
              return (
                <button
                  key={l.id}
                  className="map-pin pin-location"
                  style={{ left, top }}
                  title={l.name}
                  onClick={(ev) => { ev.stopPropagation(); openLocationPanel(l); }}
                />
              );
            })}

            {/* Merchants: pills with hover/focus label */}
            {merchants.map((m) => {
              const [left, top] = pinPosForMerchant(m, locs);
              const theme = detectTheme(m);
              const emoji = {
                smith: "⚒️", weapons: "🗡️", alchemist: "🧪", apothecary: "🌿", herbalist: "🌿",
                caravan: "🐪", stable: "🐎", clothier: "🧵", jeweler: "💎",
                arcane: "🔮", arcanist: "📜", occult: "☽", dwarven: "⛏️", drow: "🕷️", kaorti: "🩸",
                general: "🧳",
              }[theme] || "🧳";

              return (
                <button
                  key={`mer-${m.id}`}
                  type="button"
                  className={`map-pin pin-merchant pin-pill pill-${theme}`}
                  style={{ left, top }}
                  onClick={(ev) => { ev.stopPropagation(); openMerchantPanel(m); }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openMerchantPanel(m); }
                  }}
                  aria-label={m.name}
                  title={m.name}
                >
                  <span className="pill-ico" aria-hidden="true">{emoji}</span>
                  <span className="pin-label">{m.name}</span>
                </button>
              );
            })}

            {/* Preview marker for add/reposition */}
            {(addMode || repositionLocId || repositionMerchId) && clickPt && (
              <div
                className="map-pin"
                style={{
                  left: `${clickPt.x}%`,
                  top:  `${clickPt.y}%`,
                  border: "2px dashed #bfa3ff",
                  background: "rgba(126,88,255,.25)"
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
            onSubmit={async (e) => { e.preventDefault(); await createLocation(new FormData(e.currentTarget)); }}
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
              {clickPt && (<div className="small text-muted">Position: {clickPt.x}%, {clickPt.y}%</div>)}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button className="btn btn-primary" type="submit">Save</button>
            </div>
          </form>
        </div>
      </div>

      {/* =================== Location Panel =================== */}
      <div className="offcanvas offcanvas-end loc-panel"
           id="locPanel"
           data-bs-backdrop="false"
           data-bs-scroll="true"
           data-bs-keyboard="true"
           tabIndex="-1"
           aria-labelledby="locPanelLabel">
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id="locPanelLabel">{sel?.name || "Location"}</h5>
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
                  <button className="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#linkQuestModal">Link</button>
                  <button className="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#createQuestModal">+ New</button>
                </div>
              )}
            </div>
            {selQuests.length === 0 && <div className="text-muted small">No quests linked.</div>}
            {selQuests.map((q) => (
              <div key={q.id} className="loc-item">
                <div className="fw-semibold">{q.name}</div>
                {q.status && <span className="badge-soft ms-2 align-middle">{q.status}</span>}
                {q.description && <div className="text-muted small mt-1">{q.description}</div>}
                {isAdmin && (
                  <div className="mt-2 d-flex gap-2 small">
                    <button className="btn btn-link p-0" data-bs-toggle="modal" data-bs-target={`#editQuestModal-${q.id}`}>Edit</button>
                    <button
                      className="btn btn-link text-danger p-0"
                      onClick={async () => {
                        const ids = idsFrom(sel?.quests).filter((x) => String(x) !== String(q.id));
                        const { error } = await supabase.from("locations").update({ quests: ids }).eq("id", sel.id);
                        if (error) alert(error.message); else hydrateLocation(sel);
                      }}
                    >Remove</button>
                  </div>
                )}

                {/* Edit quest modal */}
                {isAdmin && (
                  <div className="modal fade" id={`editQuestModal-${q.id}`} tabIndex="-1" aria-hidden="true">
                    <div className="modal-dialog">
                      <form
                        className="modal-content"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          const patch = {
                            name: (fd.get("name") || "").toString().trim(),
                            status: (fd.get("status") || "").toString().trim() || null,
                            description: (fd.get("description") || "").toString().trim() || null,
                          };
                          const { error } = await supabase.from("quests").update(patch).eq("id", q.id);
                          if (error) alert(error.message); else hydrateLocation(sel);
                        }}
                      >
                        <div className="modal-header">
                          <h5 className="modal-title">Edit Quest</h5>
                          <button className="btn-close" data-bs-dismiss="modal" />
                        </div>
                        <div className="modal-body">
                          <div className="mb-2"><label className="form-label">Name</label>
                            <input name="name" className="form-control" defaultValue={q.name} required />
                          </div>
                          <div className="mb-2"><label className="form-label">Status</label>
                            <input name="status" className="form-control" defaultValue={q.status || ""} />
                          </div>
                          <div className="mb-2"><label className="form-label">Description</label>
                            <textarea name="description" className="form-control" rows={3} defaultValue={q.description || ""} />
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                          <button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Save</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* NPCs */}
          <div className="loc-sec">
            <div className="loc-sec-title">
              <span>NPCs</span>
              {isAdmin && (
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#linkNpcModal">Link</button>
                  <button className="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#createNpcModal">+ New</button>
                </div>
              )}
            </div>
            {selNPCs.length === 0 && <div className="text-muted small">No notable NPCs recorded.</div>}
            {selNPCs.map((n) => (
              <div key={n.id} className="loc-item">
                <div className="fw-semibold">{n.name}</div>
                <div className="small text-muted">{[n.race, n.role].filter(Boolean).join(" • ")}</div>
                {isAdmin && (
                  <div className="mt-2 d-flex gap-2 small">
                    <button className="btn btn-link p-0" data-bs-toggle="modal" data-bs-target={`#editNpcModal-${n.id}`}>Edit</button>
                    <button
                      className="btn btn-link text-danger p-0"
                      onClick={async () => {
                        const ids = idsFrom(sel?.npcs).filter((x) => String(x) !== String(n.id));
                        const { error } = await supabase.from("locations").update({ npcs: ids }).eq("id", sel.id);
                        if (error) alert(error.message); else hydrateLocation(sel);
                      }}
                    >Remove</button>
                  </div>
                )}

                {/* Edit NPC modal */}
                {isAdmin && (
                  <div className="modal fade" id={`editNpcModal-${n.id}`} tabIndex="-1" aria-hidden="true">
                    <div className="modal-dialog">
                      <form
                        className="modal-content"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          const patch = {
                            name: (fd.get("name") || "").toString().trim() || null,
                            race: (fd.get("race") || "").toString().trim() || null,
                            role: (fd.get("role") || "").toString().trim() || null,
                          };
                          const { error } = await supabase.from("npcs").update(patch).eq("id", n.id);
                          if (error) alert(error.message); else hydrateLocation(sel);
                        }}
                      >
                        <div className="modal-header"><h5 className="modal-title">Edit NPC</h5><button className="btn-close" data-bs-dismiss="modal" /></div>
                        <div className="modal-body">
                          <div className="mb-2"><label className="form-label">Name</label><input name="name" className="form-control" defaultValue={n.name} required /></div>
                          <div className="mb-2"><label className="form-label">Race</label><input name="race" className="form-control" defaultValue={n.race || ""} /></div>
                          <div className="mb-2"><label className="form-label">Role</label><input name="role" className="form-control" defaultValue={n.role || ""} /></div>
                        </div>
                        <div className="modal-footer"><button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Save</button></div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =================== Merchant Panel (offcanvas wrapper) =================== */}
      <div className="offcanvas offcanvas-end loc-panel"
           id="merchantPanel"
           data-bs-backdrop="false"
           data-bs-scroll="true"
           data-bs-keyboard="true"
           tabIndex="-1"
           aria-labelledby="merchantPanelLabel">
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id="merchantPanelLabel">{selMerchant?.name || "Merchant"}</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          {selMerchant && (
            <MerchantPanel merchant={selMerchant} isAdmin={isAdmin} />
          )}
        </div>
      </div>

      {/* =================== Link/Create Modals (Location) =================== */}
      {isAdmin && (
        <>
          {/* Link NPC */}
          <div className="modal fade" id="linkNpcModal" tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog">
              <form className="modal-content" onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const id = fd.get("npc_id");
                if (!id) return;
                const ids = [...new Set([...idsFrom(sel?.npcs), String(id)])];
                const { error } = await supabase.from("locations").update({ npcs: ids }).eq("id", sel.id);
                if (error) alert(error.message); else hydrateLocation(sel);
              }}>
                <div className="modal-header"><h5 className="modal-title">Link NPC</h5><button className="btn-close" data-bs-dismiss="modal" /></div>
                <div className="modal-body">
                  <select name="npc_id" className="form-select" required>
                    <option value="">Choose NPC…</option>
                    {allNPCs.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                  <button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Link</button>
                </div>
              </form>
            </div>
          </div>

          {/* Create NPC then link */}
          <div className="modal fade" id="createNpcModal" tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog">
              <form className="modal-content" onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const patch = {
                  id: (fd.get("id") || undefined) || undefined,
                  name: (fd.get("name") || "").toString().trim(),
                  race: (fd.get("race") || "").toString().trim() || null,
                  role: (fd.get("role") || "").toString().trim() || null,
                };
                const { error, data } = await supabase.from("npcs").insert(patch).select("id").single();
                if (error) return alert(error.message);
                const ids = [...new Set([...idsFrom(sel?.npcs), String(data.id)])];
                const u = await supabase.from("locations").update({ npcs: ids }).eq("id", sel.id);
                if (u.error) alert(u.error.message); else hydrateLocation(sel);
              }}>
                <div className="modal-header"><h5 className="modal-title">Create NPC</h5><button className="btn-close" data-bs-dismiss="modal" /></div>
                <div className="modal-body">
                  <div className="mb-2"><label className="form-label">ID (optional)</label><input name="id" className="form-control" /></div>
                  <div className="mb-2"><label className="form-label">Name</label><input name="name" className="form-control" required /></div>
                  <div className="mb-2"><label className="form-label">Race</label><input name="race" className="form-control" /></div>
                  <div className="mb-2"><label className="form-label">Role</label><input name="role" className="form-control" /></div>
                </div>
                <div className="modal-footer"><button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Save</button></div>
              </form>
            </div>
          </div>

          {/* Link Quest */}
          <div className="modal fade" id="linkQuestModal" tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog">
              <form className="modal-content" onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const id = fd.get("quest_id");
                if (!id) return;
                const ids = [...new Set([...idsFrom(sel?.quests), String(id)])];
                const { error } = await supabase.from("locations").update({ quests: ids }).eq("id", sel.id);
                if (error) alert(error.message); else hydrateLocation(sel);
              }}>
                <div className="modal-header"><h5 className="modal-title">Link Quest</h5><button className="btn-close" data-bs-dismiss="modal" /></div>
                <div className="modal-body">
                  <select name="quest_id" className="form-select" required>
                    <option value="">Choose Quest…</option>
                    {allQuests.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                  </select>
                </div>
                <div className="modal-footer"><button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Link</button></div>
              </form>
            </div>
          </div>

          {/* Create Quest then link */}
          <div className="modal fade" id="createQuestModal" tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog">
              <form className="modal-content" onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const patch = {
                  id: (fd.get("id") || "").toString().trim() || undefined,
                  name: (fd.get("name") || "").toString().trim(),
                  status: (fd.get("status") || "").toString().trim() || null,
                  description: (fd.get("description") || "").toString().trim() || null,
                };
                const { error, data } = await supabase.from("quests").insert(patch).select("id").single();
                if (error) return alert(error.message);
                const ids = [...new Set([...idsFrom(sel?.quests), String(data.id)])];
                const u = await supabase.from("locations").update({ quests: ids }).eq("id", sel.id);
                if (u.error) alert(u.error.message); else hydrateLocation(sel);
              }}>
                <div className="modal-header"><h5 className="modal-title">Create Quest</h5><button className="btn-close" data-bs-dismiss="modal" /></div>
                <div className="modal-body">
                  <div className="mb-2"><label className="form-label">ID (optional)</label><input name="id" className="form-control" /></div>
                  <div className="mb-2"><label className="form-label">Name</label><input name="name" className="form-control" required /></div>
                  <div className="mb-2"><label className="form-label">Status</label><input name="status" className="form-control" /></div>
                  <div className="mb-2"><label className="form-label">Description</label><textarea name="description" className="form-control" rows={3} /></div>
                </div>
                <div className="modal-footer"><button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Save</button></div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

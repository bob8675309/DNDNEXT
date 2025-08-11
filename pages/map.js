// pages/map.js
import { useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";

export default function MapPage() {
  const [locs, setLocs] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [addMode, setAddMode] = useState(false);
  const [clickPt, setClickPt] = useState(null);
  const [err, setErr] = useState("");

  // admin check
  const [isAdmin, setIsAdmin] = useState(false);

  // selected location & hydrated rows
  const [sel, setSel] = useState(null);
  const [selNPCs, setSelNPCs] = useState([]);
  const [selQuests, setSelQuests] = useState([]);
  const [panelLoading, setPanelLoading] = useState(false);

  // selected merchant
  const [selMerchant, setSelMerchant] = useState(null);

  // caches for link/create modals
  const [allNPCs, setAllNPCs] = useState([]);
  const [allQuests, setAllQuests] = useState([]);

  const imgRef = useRef(null);

  /* ---------- helpers ---------- */
  function idsFrom(v) {
    if (v == null) return [];
    let arr = v;
    if (typeof arr === "string") { try { arr = JSON.parse(arr); } catch { return []; } }
    if (!Array.isArray(arr)) return [];
    return arr.map(x => (x && typeof x === "object") ? (x.id ?? x.value ?? null) : x)
              .filter(Boolean).map(String);
  }

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsAdmin(false); return; }
    const { data } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
    setIsAdmin(data?.role === "admin");
  }

  async function loadLocations() {
    const { data, error } = await supabase.from("locations").select("*").order("id", { ascending: true });
    if (error) setErr(error.message);
    setLocs(data || []);
  }

  async function loadMerchants() {
    const { data } = await supabase
      .from("merchants")
      .select("id,name,x,y,inventory,icon,location_id,last_known_location_id,projected_destination_id")
      .order("created_at", { ascending: false });
    setMerchants(data || []);
  }

  async function hydrateLocation(l) {
    setPanelLoading(true);
    const npcIds = idsFrom(l.npcs);
    const questIds = idsFrom(l.quests);

    const [npcsRes, questsRes] = await Promise.all([
      npcIds.length ? supabase.from("npcs").select("id,name,race,role").in("id", npcIds) : Promise.resolve({ data: [] }),
      questIds.length ? supabase.from("quests").select("id,name,status,description").in("id", questIds) : Promise.resolve({ data: [] }),
    ]);
    setSelNPCs(npcsRes.data || []);
    setSelQuests(questsRes.data || []);
    setPanelLoading(false);
  }

  useEffect(() => {
    checkAdmin();
    loadLocations();
    loadMerchants();

    const ch1 = supabase.channel("loc-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, loadLocations)
      .subscribe();
    const ch2 = supabase.channel("merch-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchants" }, loadMerchants)
      .subscribe();

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);

  // Preload choices for admin link modals
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [{ data: npcs = [] }, { data: quests = [] }] = await Promise.all([
        supabase.from("npcs").select("id,name,race,role").order("name"),
        supabase.from("quests").select("id,name,status").order("name"),
      ]);
      setAllNPCs(npcs); setAllQuests(quests);
    })();
  }, [isAdmin]);

  /* ---------- map interactivity ---------- */
  function handleMapClick(e) {
    if (!addMode) return;
    const img = imgRef.current; if (!img) return;
    const r = img.getBoundingClientRect();
    const xPct = ((e.clientX - r.left) / r.width) * 100;
    const yPct = ((e.clientY - r.top) / r.height) * 100;
    const x = Math.max(0, Math.min(100, xPct)).toFixed(4);
    const y = Math.max(0, Math.min(100, yPct)).toFixed(4);
    setClickPt({ x, y });
    const m = document.getElementById("addLocModal");
    if (m && window.bootstrap) new window.bootstrap.Modal(m).show();
  }

  async function createLocation(e) {
    e.preventDefault();
    if (!clickPt) return;
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") || "").toString().trim();
    const description = (fd.get("description") || "").toString().trim() || null;
    if (!name) return;

    const { error } = await supabase.from("locations").insert({ name, description, x: clickPt.x, y: clickPt.y });
    if (error) { setErr(error.message); return; }
    await loadLocations();
    setAddMode(false); setClickPt(null); e.currentTarget.reset();
  }

  function openLocationPanel(l) {
    setSel(l);
    hydrateLocation(l);
    const el = document.getElementById("locPanel");
    if (el && window.bootstrap) window.bootstrap.Offcanvas.getOrCreateInstance(el).show();
  }

  function openMerchantPanel(m) {
    setSelMerchant(m);
    const el = document.getElementById("merchantPanel");
    if (el && window.bootstrap) window.bootstrap.Offcanvas.getOrCreateInstance(el).show();
  }

  /* ---------- admin: link/unlink & CRUD ---------- */
  async function updateLocArray(field, updater) {
    const arr = idsFrom(sel?.[field]);
    const next = updater(arr);
    const { error } = await supabase.from("locations").update({ [field]: next }).eq("id", sel.id);
    if (error) { alert(error.message); return; }
    // update local sel + rehydrate
    const updated = { ...sel, [field]: next };
    setSel(updated);
    await hydrateLocation(updated);
    await loadLocations();
  }

  async function linkNPC(id)   { await updateLocArray("npcs",   (a) => Array.from(new Set([...a, String(id)]))); }
  async function unlinkNPC(id) { await updateLocArray("npcs",   (a) => a.filter(x => String(x) !== String(id))); }
  async function linkQuest(id) { await updateLocArray("quests", (a) => Array.from(new Set([...a, String(id)]))); }
  async function unlinkQuest(id){await updateLocArray("quests", (a) => a.filter(x => String(x) !== String(id))); }

  async function createNPC(fd) {
    const payload = {
      id: (fd.get("id") || "").toString().trim() || crypto.randomUUID(),
      name: (fd.get("name") || "").toString().trim(),
      race: (fd.get("race") || "").toString().trim() || null,
      role: (fd.get("role") || "").toString().trim() || null,
    };
    if (!payload.name) return alert("Name required.");
    const { error } = await supabase.from("npcs").insert(payload);
    if (error) return alert(error.message);
    await linkNPC(payload.id);
  }

  async function updateNPC(fd) {
    const id = fd.get("id");
    const patch = {
      name: (fd.get("name") || "").toString().trim(),
      race: (fd.get("race") || "").toString().trim() || null,
      role: (fd.get("role") || "").toString().trim() || null,
    };
    const { error } = await supabase.from("npcs").update(patch).eq("id", id);
    if (error) return alert(error.message);
    await hydrateLocation(sel);
  }

  async function createQuest(fd) {
    const payload = {
      id: (fd.get("id") || "").toString().trim() || crypto.randomUUID(),
      name: (fd.get("name") || "").toString().trim(),
      status: (fd.get("status") || "").toString().trim() || null,
      description: (fd.get("description") || "").toString().trim() || null,
    };
    if (!payload.name) return alert("Name required.");
    const { error } = await supabase.from("quests").insert(payload);
    if (error) return alert(error.message);
    await linkQuest(payload.id);
  }

  async function updateQuest(fd) {
    const id = fd.get("id");
    const patch = {
      name: (fd.get("name") || "").toString().trim(),
      status: (fd.get("status") || "").toString().trim() || null,
      description: (fd.get("description") || "").toString().trim() || null,
    };
    const { error } = await supabase.from("quests").update(patch).eq("id", id);
    if (error) return alert(error.message);
    await hydrateLocation(sel);
  }

  /* ---------- UI ---------- */
  return (
    <div className="container-fluid my-3 map-page">
      <div className="d-flex gap-2 align-items-center mb-2">
        <button
          className={`btn btn-sm ${addMode ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setAddMode(v => !v)}
        >
          {addMode ? "Click on the map…" : "Add Location"}
        </button>
        {err && <div className="text-danger small">{err}</div>}
      </div>

      <div className="map-shell">
        <div className="map-wrap" onClick={handleMapClick}>
          <img ref={imgRef} src="/Wmap.jpg" alt="World map" className="map-img" />

          {/* Location pins */}
          <div className="map-overlay">
            {locs.map(l => {
              const x = parseFloat(l.x), y = parseFloat(l.y);
              if (!Number.isFinite(x) || !Number.isFinite(y) || x<0 || x>100 || y<0 || y>100) return null;
              return (
                <div
                  key={`loc-${l.id}`}
                  className="map-pin"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={l.name}
                  onClick={ev => { ev.stopPropagation(); openLocationPanel(l); }}
                />
              );
            })}

            {/* Merchants */}
            {merchants.map(m => {
              const x = Number(m.x), y = Number(m.y);
              if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
              return (
                <div
                  key={`mer-${m.id}`}
                  className="merchant-pin"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={m.name}
                  onClick={ev => { ev.stopPropagation(); openMerchantPanel(m); }}
                />
              );
            })}

            {/* temp preview for add-mode click */}
            {addMode && clickPt && (
              <div className="map-pin" style={{ left: `${clickPt.x}%`, top: `${clickPt.y}%`, background:"#ffc107" }} />
            )}
          </div>
        </div>
      </div>

      {/* Create Location Modal */}
      <div className="modal fade" id="addLocModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <form className="modal-content" onSubmit={createLocation}>
            <div className="modal-header">
              <h5 className="modal-title">New Location</h5>
              <button className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Name</label>
                <input name="name" className="form-control" required />
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea name="description" className="form-control" rows="3" />
              </div>
              {clickPt && <div className="small text-muted">Position: {clickPt.x}%, {clickPt.y}%</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button className="btn btn-primary" type="submit">Save</button>
            </div>
          </form>
        </div>
      </div>

      {/* Location panel */}
      <div className="offcanvas offcanvas-end loc-panel" tabIndex="-1" id="locPanel" aria-labelledby="locPanelLabel">
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id="locPanelLabel">{sel?.name || "Location"}</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          {panelLoading && <div className="text-muted small mb-3">Loading…</div>}
          {sel?.description && <p className="loc-desc">{sel.description}</p>}

          {/* Quests */}
          <div className="loc-sec">
            <div className="loc-sec-title d-flex align-items-center justify-content-between">
              <span>Quests</span>
              {isAdmin && (
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#linkQuestModal">Link</button>
                  <button className="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#createQuestModal">+ New</button>
                </div>
              )}
            </div>
            {selQuests.length === 0 && <div className="text-muted small">No quests here.</div>}
            {selQuests.map(q => (
              <div key={q.id} className="loc-item">
                <div className="fw-semibold">{q.name} {q.status && <span className="badge-soft ms-2">{q.status}</span>}</div>
                {q.description && <div className="small text-muted mt-1">{q.description}</div>}
                {isAdmin && (
                  <div className="mt-2 d-flex gap-2 small">
                    <button className="btn btn-link p-0" data-bs-toggle="modal" data-bs-target={`#editQuestModal-${q.id}`}>Edit</button>
                    <button className="btn btn-link text-danger p-0" onClick={() => unlinkQuest(q.id)}>Remove</button>
                  </div>
                )}
                {/* Edit quest modal (per row) */}
                {isAdmin && (
                  <div className="modal fade" id={`editQuestModal-${q.id}`} tabIndex="-1" aria-hidden="true">
                    <div className="modal-dialog">
                      <form className="modal-content" onSubmit={async (e)=>{e.preventDefault(); await updateQuest(new FormData(e.currentTarget));}}>
                        <div className="modal-header"><h5 className="modal-title">Edit Quest</h5>
                          <button className="btn-close" data-bs-dismiss="modal" />
                        </div>
                        <div className="modal-body">
                          <input type="hidden" name="id" defaultValue={q.id}/>
                          <div className="mb-2"><label className="form-label">Name</label><input name="name" defaultValue={q.name} className="form-control" required/></div>
                          <div className="mb-2"><label className="form-label">Status</label><input name="status" defaultValue={q.status||""} className="form-control"/></div>
                          <div className="mb-2"><label className="form-label">Description</label><textarea name="description" defaultValue={q.description||""} className="form-control" rows="4"/></div>
                        </div>
                        <div className="modal-footer"><button className="btn btn-secondary" data-bs-dismiss="modal">Close</button><button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Save</button></div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* NPCs */}
          <div className="loc-sec">
            <div className="loc-sec-title d-flex align-items-center justify-content-between">
              <span>NPCs</span>
              {isAdmin && (
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#linkNpcModal">Link</button>
                  <button className="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#createNpcModal">+ New</button>
                </div>
              )}
            </div>
            {selNPCs.length === 0 && <div className="text-muted small">No notable NPCs recorded.</div>}
            {selNPCs.map(n => (
              <div key={n.id} className="loc-item">
                <div className="fw-semibold">{n.name}</div>
                <div className="small text-muted">{[n.race, n.role].filter(Boolean).join(" • ")}</div>
                {isAdmin && (
                  <div className="mt-2 d-flex gap-2 small">
                    <button className="btn btn-link p-0" data-bs-toggle="modal" data-bs-target={`#editNpcModal-${n.id}`}>Edit</button>
                    <button className="btn btn-link text-danger p-0" onClick={() => unlinkNPC(n.id)}>Remove</button>
                  </div>
                )}
                {/* Edit NPC modal (per row) */}
                {isAdmin && (
                  <div className="modal fade" id={`editNpcModal-${n.id}`} tabIndex="-1" aria-hidden="true">
                    <div className="modal-dialog">
                      <form className="modal-content" onSubmit={async (e)=>{e.preventDefault(); await updateNPC(new FormData(e.currentTarget));}}>
                        <div className="modal-header"><h5 className="modal-title">Edit NPC</h5>
                          <button className="btn-close" data-bs-dismiss="modal" />
                        </div>
                        <div className="modal-body">
                          <input type="hidden" name="id" defaultValue={n.id}/>
                          <div className="mb-2"><label className="form-label">Name</label><input name="name" defaultValue={n.name} className="form-control" required/></div>
                          <div className="mb-2"><label className="form-label">Race</label><input name="race" defaultValue={n.race||""} className="form-control"/></div>
                          <div className="mb-2"><label className="form-label">Role</label><input name="role" defaultValue={n.role||""} className="form-control"/></div>
                        </div>
                        <div className="modal-footer"><button className="btn btn-secondary" data-bs-dismiss="modal">Close</button><button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Save</button></div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-secondary btn-sm" data-bs-dismiss="offcanvas">Close</button>
          </div>
        </div>
      </div>

      {/* Link/Create MODALS (shared) */}
      {/* Link existing NPC */}
      <div className="modal fade" id="linkNpcModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <form className="modal-content" onSubmit={async (e)=>{e.preventDefault(); const id=(new FormData(e.currentTarget)).get("npc"); if(id) await linkNPC(id);}}>
            <div className="modal-header"><h5 className="modal-title">Link NPC</h5>
              <button className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <select name="npc" className="form-select" defaultValue="">
                <option value="" disabled>Choose NPC…</option>
                {allNPCs.filter(n=>!idsFrom(sel?.npcs).includes(String(n.id))).map(n=>(
                  <option key={n.id} value={n.id}>{n.name} {n.race||""} {n.role?`• ${n.role}`:""}</option>
                ))}
              </select>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" data-bs-dismiss="modal">Close</button><button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Link</button></div>
          </form>
        </div>
      </div>

      {/* Create NPC */}
      <div className="modal fade" id="createNpcModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <form className="modal-content" onSubmit={async (e)=>{e.preventDefault(); await createNPC(new FormData(e.currentTarget));}}>
            <div className="modal-header"><h5 className="modal-title">New NPC</h5>
              <button className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <div className="mb-2"><label className="form-label">Custom ID (optional)</label><input name="id" className="form-control" placeholder="auto if left blank"/></div>
              <div className="mb-2"><label className="form-label">Name</label><input name="name" className="form-control" required/></div>
              <div className="mb-2"><label className="form-label">Race</label><input name="race" className="form-control"/></div>
              <div className="mb-2"><label className="form-label">Role</label><input name="role" className="form-control"/></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" data-bs-dismiss="modal">Close</button><button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Create & Link</button></div>
          </form>
        </div>
      </div>

      {/* Link existing Quest */}
      <div className="modal fade" id="linkQuestModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <form className="modal-content" onSubmit={async (e)=>{e.preventDefault(); const id=(new FormData(e.currentTarget)).get("quest"); if(id) await linkQuest(id);}}>
            <div className="modal-header"><h5 className="modal-title">Link Quest</h5>
              <button className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <select name="quest" className="form-select" defaultValue="">
                <option value="" disabled>Choose Quest…</option>
                {allQuests.filter(q=>!idsFrom(sel?.quests).includes(String(q.id))).map(q=>(
                  <option key={q.id} value={q.id}>{q.name}{q.status?` • ${q.status}`:""}</option>
                ))}
              </select>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" data-bs-dismiss="modal">Close</button><button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Link</button></div>
          </form>
        </div>
      </div>

      {/* Create Quest */}
      <div className="modal fade" id="createQuestModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <form className="modal-content" onSubmit={async (e)=>{e.preventDefault(); await createQuest(new FormData(e.currentTarget));}}>
            <div className="modal-header"><h5 className="modal-title">New Quest</h5>
              <button className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <div className="mb-2"><label className="form-label">Custom ID (optional)</label><input name="id" className="form-control" placeholder="auto if left blank"/></div>
              <div className="mb-2"><label className="form-label">Name</label><input name="name" className="form-control" required/></div>
              <div className="mb-2"><label className="form-label">Status</label><input name="status" className="form-control" placeholder="available/active/complete…"/></div>
              <div className="mb-2"><label className="form-label">Description</label><textarea name="description" className="form-control" rows="4"/></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" data-bs-dismiss="modal">Close</button><button className="btn btn-primary" type="submit" data-bs-dismiss="modal">Create & Link</button></div>
          </form>
        </div>
      </div>

      {/* Merchant panel (read-only for now) */}
      <div className="offcanvas offcanvas-end loc-panel" tabIndex="-1" id="merchantPanel" aria-labelledby="merchantPanelLabel">
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id="merchantPanelLabel">{selMerchant?.name || "Merchant"}</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          {selMerchant && (
            <>
              <div className="text-muted small mb-2">
                Pos: {Number(selMerchant.x).toFixed(2)}%, {Number(selMerchant.y).toFixed(2)}%
              </div>
              <div className="loc-sec">
                <div className="loc-sec-title">Inventory</div>
                {Array.isArray(selMerchant.inventory) && selMerchant.inventory.length > 0 ? (
                  <ul className="mb-0">
                    {selMerchant.inventory.map((it, i) =>
                      <li key={i}>{typeof it === "string" ? it : JSON.stringify(it)}</li>
                    )}
                  </ul>
                ) : <div className="text-muted small">—</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// /pages/map.js
import { useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";

/* =========================
   Inline SVG icons for merchants (stroke-only; no color tint)
   ========================= */
function MerchIcon({ kind }) {
  const stroke = "#ffffff";
  const p = {
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (kind) {
    case "camel":
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path {...p} d="M6 36h8M34 36h8M14 36c0-8 6-12 10-12s10 4 10 12M14 22l-4-4 2-4 4 2M22 18l4-4 4 4" />
        </svg>
      );
    case "horse":
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path {...p} d="M6 36h6M36 36h6M12 36c0-7 6-12 12-12l6-6 6 6M14 18l-4-4 4-2 4 4" />
        </svg>
      );
    case "anvil": // smith
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path {...p} d="M6 30h18l4-6h14M20 30v6h8v-6M6 36h18" />
        </svg>
      );
    case "sword": // weapon vendor
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path {...p} d="M6 42l8-8m0 0 16-16 8-2-2 8L20 40m-6-6 8 8" />
        </svg>
      );
    case "potion": // alchemist
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path {...p} d="M20 6h8M22 6v6l-6 8a10 10 0 0 0 16 0l-6-8V6" />
          <path {...p} d="M16 28h16" />
        </svg>
      );
    case "leaf": // herbalist
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path {...p} d="M8 34c16 0 24-8 28-22-14 4-22 12-28 28" />
        </svg>
      );
    default: // cart (fallback)
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path {...p} d="M6 12h6l4 16h18l4-10H16M18 36a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm18 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
        </svg>
      );
  }
}

// pick an icon based on merchant.icon or name
function iconKind(m) {
  const s = (m?.icon || m?.name || "").toLowerCase();
  if (s.includes("camel")) return "camel";
  if (s.includes("horse")) return "horse";
  if (s.includes("smith") || s.includes("anvil") || s.includes("hammer")) return "anvil";
  if (s.includes("weapon") || s.includes("blade") || s.includes("sword")) return "sword";
  if (s.includes("herb") || s.includes("leaf") || s.includes("plant")) return "leaf";
  if (s.includes("potion") || s.includes("alch")) return "potion";
  return "cart";
}

export default function MapPage() {
  const [locs, setLocs] = useState([]);
  const [merchants, setMerchants] = useState([]);

  const [addMode, setAddMode] = useState(false);
  const [clickPt, setClickPt] = useState(null);
  const [err, setErr] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);

  const [sel, setSel] = useState(null);
  const [selNPCs, setSelNPCs] = useState([]);
  const [selQuests, setSelQuests] = useState([]);
  const [panelLoading, setPanelLoading] = useState(false);

  const [selMerchant, setSelMerchant] = useState(null);

  const [allNPCs, setAllNPCs] = useState([]);
  const [allQuests, setAllQuests] = useState([]);

  // track offcanvas open to show map-only dim
  const [panelOpen, setPanelOpen] = useState(false);

  const imgRef = useRef(null);

  /* ---------- tiny helpers ---------- */
  function idsFrom(v) {
    if (v == null) return [];
    let arr = v;
    if (typeof arr === "string") {
      try {
        arr = JSON.parse(arr);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => (x && typeof x === "object" ? x.id ?? x.value ?? null : x))
      .filter(Boolean)
      .map(String);
  }
  const clamp01 = (n) => Math.min(100, Math.max(0, Number(n)));

  function parseInventory(any) {
    if (!any) return [];
    if (Array.isArray(any)) return any;
    if (typeof any === "string") {
      try {
        const j = JSON.parse(any);
        return Array.isArray(j) ? j : [];
      } catch {
        return any
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    return [];
  }

  /* ---------- data loads ---------- */
  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    const { data } = await supabase
      .from("merchants")
      .select(
        "id,name,x,y,inventory,icon,location_id,last_known_location_id,projected_destination_id"
      )
      .order("created_at", { ascending: false });
    setMerchants(data || []);
  }
  async function hydrateLocation(l) {
    setPanelLoading(true);
    const npcIds = idsFrom(l.npcs);
    const questIds = idsFrom(l.quests);
    const [npcsRes, questsRes] = await Promise.all([
      npcIds.length
        ? supabase
            .from("npcs")
            .select("id,name,race,role")
            .in("id", npcIds)
        : Promise.resolve({ data: [] }),
      questIds.length
        ? supabase
            .from("quests")
            .select("id,name,status,description")
            .in("id", questIds)
        : Promise.resolve({ data: [] }),
    ]);
    setSelNPCs(npcsRes.data || []);
    setSelQuests(questsRes.data || []);
    setPanelLoading(false);
  }

  useEffect(() => {
    checkAdmin();
    loadLocations();
    loadMerchants();
    const ch1 = supabase
      .channel("loc-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, loadLocations)
      .subscribe();
    const ch2 = supabase
      .channel("merch-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchants" }, loadMerchants)
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, []);

  // preload choices for link modals
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [{ data: np = [] }, { data: qs = [] }] = await Promise.all([
        supabase.from("npcs").select("id,name,race,role").order("name"),
        supabase.from("quests").select("id,name,status").order("name"),
      ]);
      setAllNPCs(np);
      setAllQuests(qs);
    })();
  }, [isAdmin]);

  /* ---------- map clicks ---------- */
  function handleMapClick(e) {
    if (!addMode) return;
    const img = imgRef.current;
    if (!img) return;
    const r = img.getBoundingClientRect();
    const xPct = ((e.clientX - r.left) / r.width) * 100;
    const yPct = ((e.clientY - r.top) / r.height) * 100;
    const x = clamp01(xPct).toFixed(4);
    const y = clamp01(yPct).toFixed(4);
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
    const { error } = await supabase
      .from("locations")
      .insert({ name, description, x: clickPt.x, y: clickPt.y });
    if (error) {
      setErr(error.message);
      return;
    }
    await loadLocations();
    setAddMode(false);
    setClickPt(null);
    e.currentTarget.reset();
  }

  /* ---------- open panels ---------- */
  function openLocationPanel(l) {
    setSel(l);
    hydrateLocation(l);
    const el = document.getElementById("locPanel");
    if (el && window.bootstrap) {
      // enable Esc via keyboard:true
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
      // enable Esc via keyboard:true
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

  // --- merchant icon helpers from your previous draft (kept for compatibility) ---
  function pinClassFromIcon(icon) {
    // icon format: "<shape>" or "<shape>-<tint>"
    const safe = (icon || "camel").toLowerCase().trim();
    const [shape, tint] = safe.split("-");
    const shapeClass = ["camel", "horse", "hammer", "plant", "sword"].includes(shape)
      ? `merchant--${shape}`
      : "merchant--camel";
    const tintClass = ["amber", "teal", "violet", "blue", "red", "green", "gray"].includes(tint)
      ? `tint-${tint}`
      : "";
    return `${shapeClass} ${tintClass}`.trim();
  }

  function pinPosForMerchant(m, locsArr) {
    const inRange = (n) => Number.isFinite(n) && n >= 0 && n <= 100;
    let x = Number(m.x),
      y = Number(m.y);

    // If missing or out of bounds, derive from attached location (with tiny jitter).
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
    // Final clamp
    x = Math.min(100, Math.max(0, Number.isFinite(x) ? x : 0));
    y = Math.min(100, Math.max(0, Number.isFinite(y) ? y : 0));
    return [`${x}%`, `${y}%`];
  }

  /* ---------- admin helpers (locations) ---------- */
  async function updateLocArray(field, updater) {
    const arr = idsFrom(sel?.[field]);
    const next = updater(arr);
    const { error } = await supabase.from("locations").update({ [field]: next }).eq("id", sel.id);
    if (error) return alert(error.message);
    const updated = { ...sel, [field]: next };
    setSel(updated);
    await hydrateLocation(updated);
    await loadLocations();
  }
  const linkNPC = async (id) =>
    updateLocArray("npcs", (a) => Array.from(new Set([...a, String(id)])));
  const unlinkNPC = async (id) =>
    updateLocArray("npcs", (a) => a.filter((x) => String(x) !== String(id)));
  const linkQuest = async (id) =>
    updateLocArray("quests", (a) => Array.from(new Set([...a, String(id)])));
  const unlinkQuest = async (id) =>
    updateLocArray("quests", (a) => a.filter((x) => String(x) !== String(id)));

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

  /* ---------- admin helpers (merchants) ---------- */
  async function moveMerchantToCoords(id, x, y) {
    const patch = {
      x: clamp01(x),
      y: clamp01(y),
      last_known_location_id: null,
      location_id: null,
    };
    const { error } = await supabase.from("merchants").update(patch).eq("id", id);
    if (error) return alert(error.message);
    await loadMerchants();
    setSelMerchant((m) => (m?.id === id ? { ...m, ...patch } : m));
  }
  async function snapMerchantToLocation(merchId, locId) {
    const loc = locs.find((l) => String(l.id) === String(locId));
    if (!loc) return;
    // tiny jitter so pins don’t overlap exactly on the dot
    const jx = (Math.random() - 0.5) * 1.2;
    const jy = (Math.random() - 0.5) * 1.2;
    const x = clamp01(parseFloat(loc.x) + jx);
    const y = clamp01(parseFloat(loc.y) + jy);
    const patch = { x, y, location_id: loc.id, last_known_location_id: loc.id };
    const { error } = await supabase.from("merchants").update(patch).eq("id", merchId);
    if (error) return alert(error.message);
    await loadMerchants();
    setSelMerchant((m) => (m?.id === merchId ? { ...m, ...patch } : m));
  }
  async function setMerchantRoute(merchId, destLocId) {
    const { error } = await supabase
      .from("merchants")
      .update({ projected_destination_id: destLocId })
      .eq("id", merchId);
    if (error) return alert(error.message);
    setSelMerchant((m) =>
      m?.id === merchId ? { ...m, projected_destination_id: destLocId } : m
    );
  }
  async function restockMerchant(merchId, inventoryArray) {
    const { error } = await supabase
      .from("merchants")
      .update({ inventory: inventoryArray })
      .eq("id", merchId);
    if (error) return alert(error.message);
    await loadMerchants();
    setSelMerchant((m) =>
      m?.id === merchId ? { ...m, inventory: inventoryArray } : m
    );
  }

  /* ---------- UI ---------- */
  return (
    <div className="container-fluid my-3 map-page">
      <div className="d-flex gap-2 align-items-center mb-2">
        <button
          className={`btn btn-sm ${addMode ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setAddMode((v) => !v)}
        >
          {addMode ? "Click on the map…" : "Add Location"}
        </button>
        {err && <div className="text-danger small">{err}</div>}
      </div>

      <div className="map-shell">
        {/* map-only dim, shown when either offcanvas is open */}
        <div className={`map-dim${panelOpen ? " show" : ""}`} />

        <div className="map-wrap" onClick={handleMapClick}>
          <img ref={imgRef} src="/Wmap.jpg" alt="World map" className="map-img" />

          <div className="map-overlay">
            {/* Locations */}
            {locs.map((l) => {
              const x = parseFloat(l.x),
                y = parseFloat(l.y);
              if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
              return (
                <div
                  key={`loc-${l.id}`}
                  className="map-pin"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    // ensure fully transparent visual
                    background: "transparent",
                    borderColor: "transparent",
                    boxShadow: "none",
                  }}
                  title={l.name}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openLocationPanel(l);
                  }}
                />
              );
            })}

            {/* Merchants (SVG icons; larger; untinted) */}
            {merchants.map((m) => {
              const [left, top] = pinPosForMerchant(m, locs);
              return (
                <button
                  key={`mer-${m.id}`}
                  className="merch-pin"
                  style={{
                    left,
                    top,
                    position: "absolute",
                    transform: "translate(-50%, -100%)",
                    width: 34,
                    height: 34,
                    padding: 0,
                    background: "transparent",
                    border: 0,
                    pointerEvents: "auto",
                    zIndex: 3,
                  }}
                  title={m.name}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openMerchantPanel(m);
                  }}
                >
                  <MerchIcon kind={iconKind(m)} />
                </button>
              );
            })}

            {/* preview during add mode */}
            {addMode && clickPt && (
              <div
                className="map-pin"
                style={{
                  left: `${clickPt.x}%`,
                  top: `${clickPt.y}%`,
                  background: "#ffc107",
                }}
              />
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
              {clickPt && (
                <div className="small text-muted">
                  Position: {clickPt.x}%, {clickPt.y}%
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
                  <button
                    className="btn btn-outline-primary btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#linkQuestModal"
                  >
                    Link
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#createQuestModal"
                  >
                    + New
                  </button>
                </div>
              )}
            </div>
            {selQuests.length === 0 && <div className="text-muted small">No quests here.</div>}
            {selQuests.map((q) => (
              <div key={q.id} className="loc-item">
                <div className="fw-semibold">
                  {q.name} {q.status && <span className="badge-soft ms-2">{q.status}</span>}
                </div>
                {q.description && <div className="small text-muted mt-1">{q.description}</div>}
                {isAdmin && (
                  <div className="mt-2 d-flex gap-2 small">
                    <button
                      className="btn btn-link p-0"
                      data-bs-toggle="modal"
                      data-bs-target={`#editQuestModal-${q.id}`}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-link text-danger p-0"
                      onClick={() => unlinkQuest(q.id)}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {/* per-row edit modal */}
                {isAdmin && (
                  <div className="modal fade" id={`editQuestModal-${q.id}`} tabIndex="-1" aria-hidden="true">
                    <div className="modal-dialog">
                      <form
                        className="modal-content"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await updateQuest(new FormData(e.currentTarget));
                        }}
                      >
                        <div className="modal-header">
                          <h5 className="modal-title">Edit Quest</h5>
                          <button className="btn-close" data-bs-dismiss="modal" />
                        </div>
                        <div className="modal-body">
                          <input type="hidden" name="id" defaultValue={q.id} />
                          <div className="mb-2">
                            <label className="form-label">Name</label>
                            <input name="name" defaultValue={q.name} className="form-control" required />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Status</label>
                            <input name="status" defaultValue={q.status || ""} className="form-control" />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Description</label>
                            <textarea
                              name="description"
                              defaultValue={q.description || ""}
                              className="form-control"
                              rows="4"
                            />
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button className="btn btn-secondary" data-bs-dismiss="modal">
                            Close
                          </button>
                          <button className="btn btn-primary" type="submit" data-bs-dismiss="modal">
                            Save
                          </button>
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
                  <button
                    className="btn btn-outline-primary btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#linkNpcModal"
                  >
                    Link
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#createNpcModal"
                  >
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
                {isAdmin && (
                  <div className="mt-2 d-flex gap-2 small">
                    <button
                      className="btn btn-link p-0"
                      data-bs-toggle="modal"
                      data-bs-target={`#editNpcModal-${n.id}`}
                    >
                      Edit
                    </button>
                    <button className="btn btn-link text-danger p-0" onClick={() => unlinkNPC(n.id)}>
                      Remove
                    </button>
                  </div>
                )}
                {isAdmin && (
                  <div className="modal fade" id={`editNpcModal-${n.id}`} tabIndex="-1" aria-hidden="true">
                    <div className="modal-dialog">
                      <form
                        className="modal-content"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await updateNPC(new FormData(e.currentTarget));
                        }}
                      >
                        <div className="modal-header">
                          <h5 className="modal-title">Edit NPC</h5>
                          <button className="btn-close" data-bs-dismiss="modal" />
                        </div>
                        <div className="modal-body">
                          <input type="hidden" name="id" defaultValue={n.id} />
                          <div className="mb-2">
                            <label className="form-label">Name</label>
                            <input name="name" defaultValue={n.name} className="form-control" required />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Race</label>
                            <input name="race" defaultValue={n.race || ""} className="form-control" />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Role</label>
                            <input name="role" defaultValue={n.role || ""} className="form-control" />
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button className="btn btn-secondary" data-bs-dismiss="modal">
                            Close
                          </button>
                          <button className="btn btn-primary" type="submit" data-bs-dismiss="modal">
                            Save
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Link/Create MODALS (Location) */}
      <div className="modal fade" id="linkNpcModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <form
            className="modal-content"
            onSubmit={async (e) => {
              e.preventDefault();
              const id = new FormData(e.currentTarget).get("npc");
              if (id) await linkNPC(id);
            }}
          >
            <div className="modal-header">
              <h5 className="modal-title">Link NPC</h5>
              <button className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <select name="npc" className="form-select" defaultValue="">
                <option value="" disabled>
                  Choose NPC…
                </option>
                {allNPCs
                  .filter((n) => !idsFrom(sel?.npcs).includes(String(n.id)))
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                      {n.race ? ` • ${n.race}` : ""}
                      {n.role ? ` • ${n.role}` : ""}
                    </option>
                  ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">
                Close
              </button>
              <button className="btn btn-primary" type="submit" data-bs-dismiss="modal">
                Link
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal fade" id="createNpcModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <form
            className="modal-content"
            onSubmit={async (e) => {
              e.preventDefault();
              await createNPC(new FormData(e.currentTarget));
            }}
          >
            <div className="modal-header">
              <h5 className="modal-title">New NPC</h5>
              <button className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <div className="mb-2">
                <label className="form-label">Custom ID (optional)</label>
                <input name="id" className="form-control" placeholder="auto if blank" />
              </div>
              <div className="mb-2">
                <label className="form-label">Name</label>
                <input name="name" className="form-control" required />
              </div>
              <div className="mb-2">
                <label className="form-label">Race</label>
                <input name="race" className="form-control" />
              </div>
              <div className="mb-2">
                <label className="form-label">Role</label>
                <input name="role" className="form-control" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">
                Close
              </button>
              <button className="btn btn-primary" type="submit" data-bs-dismiss="modal">
                Create &amp; Link
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal fade" id="linkQuestModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <form
            className="modal-content"
            onSubmit={async (e) => {
              e.preventDefault();
              const id = new FormData(e.currentTarget).get("quest");
              if (id) await linkQuest(id);
            }}
          >
            <div className="modal-header">
              <h5 className="modal-title">Link Quest</h5>
              <button className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <select name="quest" className="form-select" defaultValue="">
                <option value="" disabled>
                  Choose Quest…
                </option>
                {allQuests
                  .filter((q) => !idsFrom(sel?.quests).includes(String(q.id)))
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                      {q.status ? ` • ${q.status}` : ""}
                    </option>
                  ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">
                Close
              </button>
              <button className="btn btn-primary" type="submit" data-bs-dismiss="modal">
                Link
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal fade" id="createQuestModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog">
          <form
            className="modal-content"
            onSubmit={async (e) => {
              e.preventDefault();
              await createQuest(new FormData(e.currentTarget));
            }}
          >
            <div className="modal-header">
              <h5 className="modal-title">New Quest</h5>
              <button className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              <div className="mb-2">
                <label className="form-label">Custom ID (optional)</label>
                <input name="id" className="form-control" placeholder="auto if blank" />
              </div>
              <div className="mb-2">
                <label className="form-label">Name</label>
                <input name="name" className="form-control" required />
              </div>
              <div className="mb-2">
                <label className="form-label">Status</label>
                <input name="status" className="form-control" placeholder="available/active/complete…" />
              </div>
              <div className="mb-2">
                <label className="form-label">Description</label>
                <textarea name="description" className="form-control" rows="4" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal">
                Close
              </button>
              <button className="btn btn-primary" type="submit" data-bs-dismiss="modal">
                Create &amp; Link
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* =================== Merchant Panel =================== */}
      <div
        className="offcanvas offcanvas-end loc-panel"
        id="merchantPanel"
        data-bs-backdrop="false"
        data-bs-scroll="true"
        data-bs-keyboard="true"
        tabIndex="-1"
        aria-labelledby="merchantPanelLabel"
      >
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id="merchantPanelLabel">
            {selMerchant?.name || "Merchant"}
          </h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          {selMerchant && (
            <>
              <div className="text-muted small mb-2">
                Pos: {Number(selMerchant.x).toFixed(2)}%, {Number(selMerchant.y).toFixed(2)}%
              </div>

              {/* Inventory */}
              <div className="loc-sec">
                <div className="loc-sec-title">
                  <span>Inventory</span>
                  {isAdmin && <span className="small text-muted">restock / prune</span>}
                </div>
                {parseInventory(selMerchant.inventory).length ? (
                  <ul className="mb-2">
                    {parseInventory(selMerchant.inventory).map((it, i) => (
                      <li key={i} className="d-flex justify-content-between align-items-start">
                        <span className="me-2">
                          {typeof it === "string" ? it : JSON.stringify(it)}
                        </span>
                        {isAdmin && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={async () => {
                              const next = parseInventory(selMerchant.inventory).toSpliced(i, 1);
                              await restockMerchant(selMerchant.id, next);
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted small mb-2">— empty —</div>
                )}

                {isAdmin && (
                  <div className="d-flex gap-2">
                    <input
                      id="newInv"
                      className="form-control"
                      placeholder='e.g. "Potion of Healing" or {"name":"+1 Dagger","qty":1}'
                    />
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        const v = document.getElementById("newInv").value.trim();
                        if (!v) return;
                        let item = v;
                        try {
                          item = JSON.parse(v);
                        } catch {
                          /* keep string */
                        }
                        const next = [...parseInventory(selMerchant.inventory), item];
                        await restockMerchant(selMerchant.id, next);
                        document.getElementById("newInv").value = "";
                      }}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Movement */}
              <div className="loc-sec">
                <div className="loc-sec-title">
                  <span>Travel &amp; Position</span>
                </div>
                <div className="row g-2">
                  <div className="col-12">
                    <div className="small text-muted mb-1">Snap to location</div>
                    <div className="d-flex gap-2">
                      <select id="snapLoc" className="form-select">
                        {locs.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      {isAdmin && (
                        <button
                          className="btn btn-outline-primary"
                          onClick={async () => {
                            const locId = document.getElementById("snapLoc").value;
                            await snapMerchantToLocation(selMerchant.id, locId);
                          }}
                        >
                          Snap
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="small text-muted mb-1">Free move (percent coords)</div>
                    <div className="d-flex gap-2">
                      <input
                        id="mx"
                        className="form-control"
                        placeholder="x%"
                        defaultValue={selMerchant.x}
                      />
                      <input
                        id="my"
                        className="form-control"
                        placeholder="y%"
                        defaultValue={selMerchant.y}
                      />
                      {isAdmin && (
                        <button
                          className="btn btn-outline-secondary"
                          onClick={async () => {
                            const x = parseFloat(document.getElementById("mx").value);
                            const y = parseFloat(document.getElementById("my").value);
                            if (!Number.isFinite(x) || !Number.isFinite(y))
                              return alert("Enter numbers 0–100");
                            await moveMerchantToCoords(selMerchant.id, x, y);
                          }}
                        >
                          Move
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="small text-muted mb-1">Set destination (route)</div>
                    <div className="d-flex gap-2">
                      <select
                        id="routeLoc"
                        className="form-select"
                        defaultValue={selMerchant.projected_destination_id || ""}
                      >
                        <option value="">— none —</option>
                        {locs.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      {isAdmin && (
                        <button
                          className="btn btn-outline-warning"
                          onClick={async () => {
                            const d = document.getElementById("routeLoc").value || null;
                            await setMerchantRoute(selMerchant.id, d);
                          }}
                        >
                          Set
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

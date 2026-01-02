// /pages/npcs.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import CharacterSheetPanel from "../components/CharacterSheetPanel";

const glassPanelStyle = {
  background: "rgba(8, 10, 16, 0.88)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const MUTED = "rgba(255,255,255,0.72)";
const DIM = "rgba(255,255,255,0.60)";
const BORDER = "rgba(255,255,255,0.12)";

function safeStr(v) {
  return String(v ?? "").trim();
}
function isSupabaseMissingTable(err) {
  const msg = String(err?.message || "");
  return msg.includes("relation") && msg.includes("does not exist");
}

// roster key helpers
const keyOf = (type, id) => `${type}:${String(id)}`;
const parseKey = (k) => {
  const [type, ...rest] = String(k || "").split(":");
  return { type, id: rest.join(":") };
};

export default function NpcsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [players, setPlayers] = useState([]);
  const [locations, setLocations] = useState([]);

  const [npcs, setNpcs] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [merchantProfiles, setMerchantProfiles] = useState(new Map()); // merchant_id -> profile row

  const [selectedKey, setSelectedKey] = useState(null); // "npc:id" or "merchant:uuid"

  // selected sheet + notes
  const [sheet, setSheet] = useState(null);
  const [notes, setNotes] = useState([]);
  const [notesEnabled, setNotesEnabled] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // edit
  const [editOpen, setEditOpen] = useState(false);
  const [editType, setEditType] = useState(null); // "npc" | "merchant"
  const [editNpc, setEditNpc] = useState(null);
  const [editMerchant, setEditMerchant] = useState(null); // merged view
  const [editSheet, setEditSheet] = useState(null);

  // new note
  const [noteScope, setNoteScope] = useState("private"); // private/shared
  const [noteAllPlayers, setNoteAllPlayers] = useState(true);
  const [noteVisibleTo, setNoteVisibleTo] = useState([]);
  const [noteBody, setNoteBody] = useState("");

  const [lastRoll, setLastRoll] = useState(null);

  const locationNameById = useMemo(() => {
    const m = new Map();
    for (const l of locations || []) m.set(String(l.id), l.name);
    return m;
  }, [locations]);

  // Build a unified roster list (NPCs + Merchants)
  const roster = useMemo(() => {
    const list = [];

    for (const n of npcs || []) {
      list.push({
        type: "npc",
        id: String(n.id),
        name: n.name,
        race: n.race,
        role: n.role,
        affiliation: n.affiliation,
        status: n.status || "alive",
        location_id: n.location_id ?? null,
        description: n.description,
        motivation: n.motivation,
        quirk: n.quirk,
        mannerism: n.mannerism,
        voice: n.voice,
        secret: n.secret,
        tags: n.tags,
        updated_at: n.updated_at,
        // background for NPCs can live inside npc_sheets.sheet.background (shown in UI)
        background: null,
      });
    }

    for (const m of merchants || []) {
      const prof = merchantProfiles.get(String(m.id)) || {};
      list.push({
        type: "merchant",
        id: String(m.id),
        name: m.name,
        race: prof.race || null,
        role: prof.role || "Merchant",
        affiliation: prof.affiliation || null,
        status: prof.status || (m.is_hidden ? "hidden" : "alive"),
        location_id: m.location_id ?? m.last_known_location_id ?? null,
        merchant_state: m.state || null,
        merchant_route_mode: m.route_mode || null,
        description: prof.description || null,
        motivation: prof.motivation || null,
        quirk: prof.quirk || null,
        mannerism: prof.mannerism || null,
        voice: prof.voice || null,
        secret: prof.secret || null,
        tags: prof.tags || [],
        updated_at: prof.updated_at || null,
        background: prof.background || null,
      });
    }

    // filtering
    const query = safeStr(q).toLowerCase();
    const filtered = list.filter((e) => {
      if (roleFilter && String(e.role || "") !== roleFilter) return false;
      if (statusFilter && String(e.status || "") !== statusFilter) return false;

      if (!query) return true;
      const hay = [e.name, e.race, e.role, e.affiliation, e.description, (e.tags || []).join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });

    filtered.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    return filtered;
  }, [npcs, merchants, merchantProfiles, q, roleFilter, statusFilter]);

  const uniqueRoles = useMemo(() => {
    const set = new Set(roster.map((r) => String(r.role || "").trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [roster]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set(roster.map((r) => String(r.status || "alive")));
    const list = Array.from(set);
    list.sort((a, b) => (a === "alive" ? -1 : b === "alive" ? 1 : a.localeCompare(b)));
    return list;
  }, [roster]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    const { type, id } = parseKey(selectedKey);
    return roster.find((r) => r.type === type && String(r.id) === String(id)) || null;
  }, [selectedKey, roster]);

  const canSeeNote = useCallback(
    (note) => {
      if (isAdmin) return true;
      if (!userId) return false;

      if (note.scope === "private") return String(note.author_user_id) === String(userId);

      const arr = note.visible_to_user_ids;
      if (!arr || !Array.isArray(arr) || arr.length === 0) return true; // null/empty => all players
      return arr.some((id) => String(id) === String(userId));
    },
    [isAdmin, userId]
  );

  /* ------------------- load auth/admin ------------------- */
  const loadAuth = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user || null;
    setUserId(user?.id || null);

    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data, error } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
    if (error) return setIsAdmin(false);
    setIsAdmin(data?.role === "admin");
  }, []);

  /* ------------------- load basics ------------------- */
  const loadPlayers = useCallback(async () => {
    const res = await supabase.from("players").select("user_id,name").order("name", { ascending: true });
    if (!res.error) setPlayers(res.data || []);
  }, []);

  const loadLocations = useCallback(async () => {
    const res = await supabase.from("locations").select("id,name").order("id");
    if (!res.error) setLocations(res.data || []);
  }, []);

  const loadNpcs = useCallback(async () => {
    const { data, error } = await supabase
      .from("npcs")
      .select(
        [
          "id",
          "name",
          "race",
          "role",
          "description",
          "motivation",
          "quirk",
          "mannerism",
          "voice",
          "secret",
          "affiliation",
          "status",
          "location_id",
          "tags",
          "updated_at",
        ].join(",")
      );

    if (error) {
      setErr(error.message);
      setNpcs([]);
      return;
    }
    setNpcs(data || []);
  }, []);

  const loadMerchants = useCallback(async () => {
    const { data, error } = await supabase
      .from("merchants")
      .select("id,name,location_id,last_known_location_id,is_hidden,state,route_mode")
      .order("name", { ascending: true });

    if (error) {
      console.warn("merchants load error:", error.message);
      setMerchants([]);
      return;
    }
    setMerchants(data || []);
  }, []);

  const loadMerchantProfiles = useCallback(async () => {
    const res = await supabase
      .from("merchant_profiles")
      .select(
        "merchant_id,race,role,background,description,motivation,quirk,mannerism,voice,secret,affiliation,status,tags,sheet,updated_at"
      );

    if (res.error) {
      if (isSupabaseMissingTable(res.error)) {
        setMerchantProfiles(new Map());
        return;
      }
      setMerchantProfiles(new Map());
      return;
    }

    const m = new Map();
    for (const row of res.data || []) m.set(String(row.merchant_id), row);
    setMerchantProfiles(m);
  }, []);

  /* ------------------- sheet + notes loaders ------------------- */
  const loadSelectedSheet = useCallback(async (key) => {
    if (!key) return setSheet(null);
    const { type, id } = parseKey(key);

    if (type === "npc") {
      const res = await supabase.from("npc_sheets").select("sheet").eq("npc_id", id).single();
      if (res.error) return setSheet(null);
      return setSheet(res.data?.sheet || null);
    }

    if (type === "merchant") {
      const res = await supabase.from("merchant_profiles").select("sheet").eq("merchant_id", id).single();
      if (res.error) return setSheet(null);
      return setSheet(res.data?.sheet || null);
    }

    setSheet(null);
  }, []);

  const loadSelectedNotes = useCallback(
    async (key) => {
      if (!key) return setNotes([]);
      if (!notesEnabled) return;

      const { type, id } = parseKey(key);

      if (type === "npc") {
        const res = await supabase
          .from("npc_notes")
          .select("id,npc_id,author_user_id,scope,visible_to_user_ids,body,created_at")
          .eq("npc_id", id)
          .order("created_at", { ascending: false });

        if (res.error) {
          if (isSupabaseMissingTable(res.error)) {
            setNotesEnabled(false);
            setNotes([]);
            return;
          }
          setNotes([]);
          return;
        }
        setNotes(res.data || []);
        return;
      }

      if (type === "merchant") {
        const res = await supabase
          .from("merchant_notes")
          .select("id,merchant_id,author_user_id,scope,visible_to_user_ids,body,created_at")
          .eq("merchant_id", id)
          .order("created_at", { ascending: false });

        if (res.error) {
          if (isSupabaseMissingTable(res.error)) {
            setNotes([]);
            return;
          }
          setNotes([]);
          return;
        }
        setNotes(res.data || []);
        return;
      }

      setNotes([]);
    },
    [notesEnabled]
  );

  /* ------------------- initial load ------------------- */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      await loadAuth();
      await Promise.all([loadPlayers(), loadLocations(), loadNpcs(), loadMerchants(), loadMerchantProfiles()]);
      setLoading(false);
    })();
  }, [loadAuth, loadPlayers, loadLocations, loadNpcs, loadMerchants, loadMerchantProfiles]);

  /* pick default selection once roster exists */
  useEffect(() => {
    if (selectedKey) return;
    if (!roster.length) return;

    try {
      const sp = new URLSearchParams(window.location.search);
      const focus = sp.get("focus");
      if (focus) {
        const exists = roster.find((r) => r.type === "npc" && String(r.id) === String(focus));
        if (exists) {
          setSelectedKey(keyOf("npc", focus));
          return;
        }
      }
    } catch {}

    setSelectedKey(keyOf(roster[0].type, roster[0].id));
  }, [roster, selectedKey]);

  /* reload selected sheet + notes when selection changes */
  useEffect(() => {
    (async () => {
      if (!selectedKey) return;
      await Promise.all([loadSelectedSheet(selectedKey), loadSelectedNotes(selectedKey)]);
      setEditOpen(false);
      setLastRoll(null);
    })();
  }, [selectedKey, loadSelectedSheet, loadSelectedNotes]);

  /* ------------------- edit handlers ------------------- */
  async function startEdit() {
    if (!isAdmin || !selected) return;

    setEditType(selected.type);

    if (selected.type === "npc") {
      const row = npcs.find((n) => String(n.id) === String(selected.id));
      setEditNpc(row ? { ...row } : { ...selected });
      setEditMerchant(null);
      setEditSheet(sheet ? structuredClone(sheet) : {});
      setEditOpen(true);
      return;
    }

    if (selected.type === "merchant") {
      const base = merchants.find((m) => String(m.id) === String(selected.id));
      const prof = merchantProfiles.get(String(selected.id)) || {};
      setEditMerchant({
        id: selected.id,
        name: base?.name || selected.name,
        location_id: base?.location_id ?? base?.last_known_location_id ?? "",
        affiliation: prof.affiliation || "",
        status: prof.status || "alive",
        background: prof.background || "",
        description: prof.description || "",
        motivation: prof.motivation || "",
        quirk: prof.quirk || "",
        mannerism: prof.mannerism || "",
        voice: prof.voice || "",
        secret: prof.secret || "",
        tags: Array.isArray(prof.tags) ? prof.tags : [],
      });
      setEditNpc(null);
      setEditSheet(prof.sheet ? structuredClone(prof.sheet) : {});
      setEditOpen(true);
      return;
    }
  }

  async function saveEdit() {
    if (!isAdmin || !selected) return;

    if (editType === "npc" && editNpc) {
      const npcPatch = {
        name: safeStr(editNpc.name),
        race: safeStr(editNpc.race) || null,
        role: safeStr(editNpc.role) || null,
        description: safeStr(editNpc.description) || null,
        motivation: safeStr(editNpc.motivation) || null,
        quirk: safeStr(editNpc.quirk) || null,
        mannerism: safeStr(editNpc.mannerism) || null,
        voice: safeStr(editNpc.voice) || null,
        secret: safeStr(editNpc.secret) || null,
        affiliation: safeStr(editNpc.affiliation) || null,
        status: safeStr(editNpc.status) || "alive",
        location_id: editNpc.location_id ? Number(editNpc.location_id) : null,
        tags: Array.isArray(editNpc.tags) ? editNpc.tags : [],
        updated_at: new Date().toISOString(),
      };

      const upd = await supabase.from("npcs").update(npcPatch).eq("id", selected.id);
      if (upd.error) return alert(upd.error.message);

      const up = await supabase.from("npc_sheets").upsert(
        { npc_id: selected.id, sheet: editSheet || {}, updated_at: new Date().toISOString() },
        { onConflict: "npc_id" }
      );
      if (up.error && !isSupabaseMissingTable(up.error)) return alert(up.error.message);

      await loadNpcs();
      await loadSelectedSheet(selectedKey);
      setEditOpen(false);
      return;
    }

    if (editType === "merchant" && editMerchant) {
      const locPatch = {
        location_id: editMerchant.location_id ? Number(editMerchant.location_id) : null,
      };
      const updM = await supabase.from("merchants").update(locPatch).eq("id", selected.id);
      if (updM.error) return alert(updM.error.message);

      const profPatch = {
        merchant_id: selected.id,
        affiliation: safeStr(editMerchant.affiliation) || null,
        status: safeStr(editMerchant.status) || "alive",
        background: safeStr(editMerchant.background) || null,
        description: safeStr(editMerchant.description) || null,
        motivation: safeStr(editMerchant.motivation) || null,
        quirk: safeStr(editMerchant.quirk) || null,
        mannerism: safeStr(editMerchant.mannerism) || null,
        voice: safeStr(editMerchant.voice) || null,
        secret: safeStr(editMerchant.secret) || null,
        tags: Array.isArray(editMerchant.tags) ? editMerchant.tags : [],
        sheet: editSheet || {},
        updated_at: new Date().toISOString(),
      };

      const upP = await supabase.from("merchant_profiles").upsert(profPatch, { onConflict: "merchant_id" });
      if (upP.error && !isSupabaseMissingTable(upP.error)) return alert(upP.error.message);

      await Promise.all([loadMerchants(), loadMerchantProfiles()]);
      await loadSelectedSheet(selectedKey);
      setEditOpen(false);
      return;
    }
  }

  /* ------------------- notes ------------------- */
  async function addNote() {
    if (!selected) return;
    if (!userId) return alert("You must be logged in to add notes.");
    const body = safeStr(noteBody);
    if (!body) return;

    const visibility = noteScope === "shared" ? (noteAllPlayers ? null : noteVisibleTo) : null;

    if (selected.type === "npc") {
      const payload = {
        npc_id: selected.id,
        author_user_id: userId,
        scope: noteScope,
        visible_to_user_ids: visibility,
        body,
      };
      const res = await supabase.from("npc_notes").insert(payload);
      if (res.error) return alert(res.error.message);
    }

    if (selected.type === "merchant") {
      const payload = {
        merchant_id: selected.id,
        author_user_id: userId,
        scope: noteScope,
        visible_to_user_ids: visibility,
        body,
      };
      const res = await supabase.from("merchant_notes").insert(payload);
      if (res.error) return alert(res.error.message);
    }

    setNoteBody("");
    setNoteAllPlayers(true);
    setNoteVisibleTo([]);
    await loadSelectedNotes(selectedKey);
  }

  /* ------------------- render guards ------------------- */
  if (loading) {
    return (
      <div className="container-fluid my-3 npcs-page">
        <div style={{ color: MUTED }}>Loading NPCs…</div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="container-fluid my-3 npcs-page">
        <div className="alert alert-danger">{err}</div>
      </div>
    );
  }
  if (!roster.length) {
    return (
      <div className="container-fluid my-3 npcs-page">
        <div style={{ color: MUTED }}>No NPCs or merchants found.</div>
      </div>
    );
  }

  const panelHeight = { height: "calc(100vh - 170px)" };

  const backgroundText = selected
    ? (selected.background || sheet?.background || "")
    : "";

  return (
    <div className="container-fluid my-3 npcs-page">
      <div className="d-flex align-items-center mb-2">
        <h1 className="h4 mb-0">NPCs</h1>
        <div className="ms-auto small" style={{ color: DIM }}>
          {isAdmin ? "Admin" : "Player"} view
        </div>
      </div>

      <div className="row g-3">
        {/* LEFT: roster */}
        <div className="col-12 col-lg-4">
          <div className="p-2 rounded-3 d-flex flex-column npc-panel" style={{ ...glassPanelStyle, ...panelHeight }}>
            <div className="d-flex gap-2 mb-2">
              <input
                className="form-control form-control-sm"
                placeholder="Search NPCs & merchants…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="d-flex gap-2 mb-2">
              <select className="form-select form-select-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All roles</option>
                {uniqueRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <select className="form-select form-select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {uniqueStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="list-group flex-grow-1 overflow-auto npc-roster-list">
              {roster.map((r) => {
                const active = String(selectedKey) === keyOf(r.type, r.id);
                const status = String(r.status || "alive");

                const badgeClass =
                  status === "alive"
                    ? "text-bg-success"
                    : status === "dead"
                    ? "text-bg-secondary"
                    : status === "hidden"
                    ? "text-bg-dark"
                    : "text-bg-dark";

                return (
                  <button
                    key={keyOf(r.type, r.id)}
                    type="button"
                    className={`list-group-item list-group-item-action ${active ? "active" : ""}`}
                    style={{
                      background: active ? "rgba(255,255,255,0.08)" : "transparent",
                      color: "rgba(255,255,255,0.95)",
                      borderColor: "rgba(255,255,255,0.08)",
                    }}
                    onClick={() => setSelectedKey(keyOf(r.type, r.id))}
                  >
                    <div className="d-flex align-items-center">
                      <div className="fw-semibold">
                        {r.name}{" "}
                        {r.type === "merchant" && (
                          <span className="badge ms-2 text-bg-info" style={{ fontSize: 11 }}>
                            Store
                          </span>
                        )}
                      </div>
                      <span className={`badge ms-auto ${badgeClass}`}>{status}</span>
                    </div>

                    <div className="small npc-muted">
                      {[
                        r.type === "npc" ? r.race : null,
                        r.role,
                        r.affiliation,
                        r.type === "merchant" && r.merchant_state ? `(${r.merchant_state})` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "—"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: details */}
        <div className="col-12 col-lg-8">
          <div className="p-3 rounded-3 npc-panel npc-panel-scroll" style={{ ...glassPanelStyle, ...panelHeight, overflowY: "auto" }}>
            {!selected ? (
              <div style={{ color: MUTED }}>Select an NPC…</div>
            ) : (
              <>
                <div className="d-flex align-items-start">
                  <div>
                    <div className="h5 mb-1">{selected.name}</div>
                    <div className="small npc-muted">
                      {[
                        selected.type === "npc" ? selected.race : null,
                        selected.role,
                        selected.affiliation,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "—"}
                      {selected.location_id ? (
                        <>
                          {" "}
                          • <span style={{ color: "rgba(255,255,255,0.88)" }}>
                            {locationNameById.get(String(selected.location_id)) || "Unknown location"}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {isAdmin && (
                    <button className="btn btn-sm btn-outline-light ms-auto" onClick={startEdit}>
                      Edit
                    </button>
                  )}
                </div>

                <hr style={{ borderColor: BORDER }} />

                <div className="row g-3">
                  {/* Left: Background + hooks */}
                  <div className="col-12 col-xl-5">
                    <div className="fw-semibold mb-1">Background</div>
                    <div className="small mb-2 npc-muted">
                      Where they come from; ties; history; why they matter.
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>
                      {backgroundText ? backgroundText : <span className="npc-muted">—</span>}
                    </div>

                    <div className="mt-3 fw-semibold mb-2">Quick hooks</div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>Motivation / Want</div>
                      <div style={{ color: "rgba(255,255,255,0.92)" }}>
                        {selected.motivation || <span className="npc-muted">—</span>}
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>Personality / Quirk</div>
                      <div style={{ color: "rgba(255,255,255,0.92)" }}>
                        {selected.quirk || <span className="npc-muted">—</span>}
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>Mannerism / Voice</div>
                      <div style={{ color: "rgba(255,255,255,0.92)" }}>
                        {[selected.mannerism, selected.voice].filter(Boolean).join(" • ") || (
                          <span className="npc-muted">—</span>
                        )}
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>Secret (optional)</div>
                      <div style={{ color: "rgba(255,255,255,0.92)" }}>
                        {selected.secret || <span className="npc-muted">—</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: Character sheet */}
                  <div className="col-12 col-xl-7">
                    <div className="fw-semibold mb-2">Character sheet</div>
                    <CharacterSheetPanel
                      sheet={sheet || {}}
                      characterName={selected.name}
                      onRoll={(r) => setLastRoll(r)}
                    />

                    {lastRoll && (
                      <div className="alert alert-dark py-2 mt-2 mb-0" style={{ borderColor: BORDER }}>
                        <div className="small" style={{ color: "rgba(255,255,255,0.92)" }}>
                          <span className="fw-semibold">{lastRoll.label}</span>: d20{" "}
                          <span>{lastRoll.roll}</span> {lastRoll.mod >= 0 ? "+" : "-"}{" "}
                          <span>{Math.abs(lastRoll.mod)}</span> ={" "}
                          <span className="fw-semibold">{lastRoll.total}</span>
                        </div>
                      </div>
                    )}

                    <details className="mt-2">
                      <summary className="small" style={{ color: DIM, cursor: "pointer" }}>
                        View raw sheet JSON
                      </summary>
                      <pre className="mt-2 p-2 rounded" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "rgba(255,255,255,0.88)" }}>
                        {JSON.stringify(sheet || {}, null, 2)}
                      </pre>
                    </details>

                    <div className="mt-3">
                      <div className="fw-semibold mb-1">Description</div>
                      <div style={{ color: MUTED }}>{selected.description || "—"}</div>
                    </div>
                  </div>
                </div>

                <hr className="my-3" style={{ borderColor: BORDER }} />

                {/* Notes */}
                <div className="fw-semibold mb-2">Notes</div>

                {!userId ? (
                  <div style={{ color: MUTED }}>Log in to add/view notes.</div>
                ) : (
                  <>
                    <div className="row g-2 align-items-end mb-2">
                      <div className="col-12 col-md-3">
                        <label className="form-label form-label-sm" style={{ color: MUTED }}>
                          Scope
                        </label>
                        <select className="form-select form-select-sm" value={noteScope} onChange={(e) => setNoteScope(e.target.value)}>
                          <option value="private">Private (only me)</option>
                          <option value="shared">Shared</option>
                        </select>
                      </div>

                      {noteScope === "shared" && (
                        <div className="col-12 col-md-9">
                          <div className="d-flex align-items-center gap-3 flex-wrap">
                            <label className="form-check mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={noteAllPlayers}
                                onChange={(e) => setNoteAllPlayers(e.target.checked)}
                              />
                              <span className="form-check-label" style={{ color: "rgba(255,255,255,0.92)" }}>
                                Visible to all players
                              </span>
                            </label>

                            {!noteAllPlayers && (
                              <div className="d-flex flex-wrap gap-2">
                                {(players || []).map((p) => (
                                  <label key={p.user_id} className="form-check mb-0">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={noteVisibleTo.some((id) => String(id) === String(p.user_id))}
                                      onChange={(e) => {
                                        setNoteVisibleTo((prev) => {
                                          const set = new Set(prev.map(String));
                                          const k = String(p.user_id);
                                          if (e.target.checked) set.add(k);
                                          else set.delete(k);
                                          return Array.from(set);
                                        });
                                      }}
                                    />
                                    <span className="form-check-label" style={{ color: "rgba(255,255,255,0.92)" }}>
                                      {p.name || "Player"}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="col-12">
                        <textarea
                          className="form-control"
                          rows={2}
                          placeholder="Add a note (damage taken, buffs, rumors, reminders)…"
                          value={noteBody}
                          onChange={(e) => setNoteBody(e.target.value)}
                        />
                      </div>

                      <div className="col-12 d-flex">
                        <button className="btn btn-sm btn-success ms-auto" onClick={addNote}>
                          Add Note
                        </button>
                      </div>
                    </div>

                    <div className="d-flex flex-column gap-2">
                      {(notes || []).filter(canSeeNote).map((n) => (
                        <div
                          key={n.id}
                          className="p-2 rounded"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            color: "rgba(255,255,255,0.92)",
                          }}
                        >
                          <div className="d-flex align-items-center mb-1">
                            <span className="badge text-bg-dark">{n.scope === "private" ? "Private" : "Shared"}</span>
                            <span className="ms-auto small" style={{ color: DIM }}>
                              {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                            </span>
                          </div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
                        </div>
                      ))}
                      {(notes || []).filter(canSeeNote).length === 0 && <div style={{ color: MUTED }}>No visible notes yet.</div>}
                    </div>
                  </>
                )}

                {/* Admin edit panel */}
                {isAdmin && editOpen && (
                  <>
                    <hr className="my-3" style={{ borderColor: BORDER }} />
                    <div className="d-flex align-items-center mb-2">
                      <div className="fw-semibold">Edit {editType === "merchant" ? "Merchant" : "NPC"}</div>
                      <div className="ms-auto d-flex gap-2">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditOpen(false)}>
                          Cancel
                        </button>
                        <button className="btn btn-sm btn-primary" onClick={saveEdit}>
                          Save
                        </button>
                      </div>
                    </div>

                    {editType === "npc" && editNpc && (
                      <div className="row g-2">
                        <div className="col-12 col-md-6">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Name</label>
                          <input className="form-control form-control-sm" value={editNpc.name || ""} onChange={(e) => setEditNpc((p) => ({ ...p, name: e.target.value }))} />
                        </div>

                        <div className="col-6 col-md-3">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Race</label>
                          <input className="form-control form-control-sm" value={editNpc.race || ""} onChange={(e) => setEditNpc((p) => ({ ...p, race: e.target.value }))} />
                        </div>

                        <div className="col-6 col-md-3">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Role</label>
                          <input className="form-control form-control-sm" value={editNpc.role || ""} onChange={(e) => setEditNpc((p) => ({ ...p, role: e.target.value }))} />
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Affiliation</label>
                          <input className="form-control form-control-sm" value={editNpc.affiliation || ""} onChange={(e) => setEditNpc((p) => ({ ...p, affiliation: e.target.value }))} />
                        </div>

                        <div className="col-6 col-md-3">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Status</label>
                          <input className="form-control form-control-sm" value={editNpc.status || "alive"} onChange={(e) => setEditNpc((p) => ({ ...p, status: e.target.value }))} />
                        </div>

                        <div className="col-6 col-md-3">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Location</label>
                          <select className="form-select form-select-sm" value={editNpc.location_id || ""} onChange={(e) => setEditNpc((p) => ({ ...p, location_id: e.target.value || null }))}>
                            <option value="">—</option>
                            {(locations || []).map((l) => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Description</label>
                          <textarea className="form-control form-control-sm" rows={2} value={editNpc.description || ""} onChange={(e) => setEditNpc((p) => ({ ...p, description: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Motivation</label>
                          <input className="form-control form-control-sm" value={editNpc.motivation || ""} onChange={(e) => setEditNpc((p) => ({ ...p, motivation: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Quirk</label>
                          <input className="form-control form-control-sm" value={editNpc.quirk || ""} onChange={(e) => setEditNpc((p) => ({ ...p, quirk: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Mannerism</label>
                          <input className="form-control form-control-sm" value={editNpc.mannerism || ""} onChange={(e) => setEditNpc((p) => ({ ...p, mannerism: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Voice</label>
                          <input className="form-control form-control-sm" value={editNpc.voice || ""} onChange={(e) => setEditNpc((p) => ({ ...p, voice: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Secret</label>
                          <input className="form-control form-control-sm" value={editNpc.secret || ""} onChange={(e) => setEditNpc((p) => ({ ...p, secret: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Sheet overlay (JSON)</label>
                          <div className="small mb-1" style={{ color: DIM }}>
                            Tip: you can store NPC background here as <code>{"{ background: \"...\" }"}</code>
                          </div>
                          <textarea
                            className="form-control"
                            rows={8}
                            value={JSON.stringify(editSheet || {}, null, 2)}
                            onChange={(e) => {
                              try {
                                const next = JSON.parse(e.target.value);
                                setEditSheet(next);
                              } catch {}
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {editType === "merchant" && editMerchant && (
                      <div className="row g-2">
                        <div className="col-12 col-md-6">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Name (read-only)</label>
                          <input className="form-control form-control-sm" value={editMerchant.name || ""} disabled />
                        </div>

                        <div className="col-6 col-md-3">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Status</label>
                          <input className="form-control form-control-sm" value={editMerchant.status || "alive"} onChange={(e) => setEditMerchant((p) => ({ ...p, status: e.target.value }))} />
                        </div>

                        <div className="col-6 col-md-3">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Location</label>
                          <select className="form-select form-select-sm" value={editMerchant.location_id || ""} onChange={(e) => setEditMerchant((p) => ({ ...p, location_id: e.target.value || null }))}>
                            <option value="">—</option>
                            {(locations || []).map((l) => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Affiliation</label>
                          <input className="form-control form-control-sm" value={editMerchant.affiliation || ""} onChange={(e) => setEditMerchant((p) => ({ ...p, affiliation: e.target.value }))} />
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Background</label>
                          <input className="form-control form-control-sm" value={editMerchant.background || ""} onChange={(e) => setEditMerchant((p) => ({ ...p, background: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Description</label>
                          <textarea className="form-control form-control-sm" rows={2} value={editMerchant.description || ""} onChange={(e) => setEditMerchant((p) => ({ ...p, description: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Motivation</label>
                          <input className="form-control form-control-sm" value={editMerchant.motivation || ""} onChange={(e) => setEditMerchant((p) => ({ ...p, motivation: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Quirk</label>
                          <input className="form-control form-control-sm" value={editMerchant.quirk || ""} onChange={(e) => setEditMerchant((p) => ({ ...p, quirk: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Mannerism</label>
                          <input className="form-control form-control-sm" value={editMerchant.mannerism || ""} onChange={(e) => setEditMerchant((p) => ({ ...p, mannerism: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Voice</label>
                          <input className="form-control form-control-sm" value={editMerchant.voice || ""} onChange={(e) => setEditMerchant((p) => ({ ...p, voice: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Secret</label>
                          <input className="form-control form-control-sm" value={editMerchant.secret || ""} onChange={(e) => setEditMerchant((p) => ({ ...p, secret: e.target.value }))} />
                        </div>

                        <div className="col-12">
                          <label className="form-label form-label-sm" style={{ color: MUTED }}>Sheet overlay (JSON)</label>
                          <textarea
                            className="form-control"
                            rows={8}
                            value={JSON.stringify(editSheet || {}, null, 2)}
                            onChange={(e) => {
                              try {
                                const next = JSON.parse(e.target.value);
                                setEditSheet(next);
                              } catch {}
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

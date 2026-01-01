import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

import SkillRolls from "../components/npcs/SkillRolls";
import CharacterSheetGrid from "../components/npcs/CharacterSheetGrid";
import NpcEditPanel from "../components/npcs/NpcEditPanel";

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
function isSupabaseMissingColumn(err) {
  const msg = String(err?.message || "");
  return msg.includes("column") && msg.includes("does not exist");
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

  // npc background column may not exist yet
  const [npcHasBackgroundCol, setNpcHasBackgroundCol] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // edit
  const [editOpen, setEditOpen] = useState(false);
  const [editType, setEditType] = useState(null); // "npc" | "merchant"
  const [editNpc, setEditNpc] = useState(null);
  const [editMerchant, setEditMerchant] = useState(null);
  const [editSheet, setEditSheet] = useState(null);

  // new note
  const [noteScope, setNoteScope] = useState("private"); // private/shared
  const [noteAllPlayers, setNoteAllPlayers] = useState(true);
  const [noteVisibleTo, setNoteVisibleTo] = useState([]);
  const [noteBody, setNoteBody] = useState("");

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
        background: n.background ?? null,
        description: n.description,
        motivation: n.motivation,
        quirk: n.quirk,
        mannerism: n.mannerism,
        voice: n.voice,
        secret: n.secret,
        tags: n.tags,
        updated_at: n.updated_at,
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
        background: prof.background || null,
        description: prof.description || null,
        motivation: prof.motivation || null,
        quirk: prof.quirk || null,
        mannerism: prof.mannerism || null,
        voice: prof.voice || null,
        secret: prof.secret || null,
        tags: prof.tags || [],
        updated_at: prof.updated_at || null,
      });
    }

    // filtering
    const query = safeStr(q).toLowerCase();
    const filtered = list.filter((e) => {
      if (roleFilter && String(e.role || "") !== roleFilter) return false;
      if (statusFilter && String(e.status || "") !== statusFilter) return false;

      if (!query) return true;
      const hay = [
        e.name,
        e.race,
        e.role,
        e.affiliation,
        e.background,
        e.description,
        (e.tags || []).join(" "),
      ]
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
      if (!arr || !Array.isArray(arr) || arr.length === 0) return true;
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
    // try with background column first
    const colsWithBg = [
      "id",
      "name",
      "race",
      "role",
      "background",
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
    ].join(",");

    let res = await supabase.from("npcs").select(colsWithBg);

    if (res.error && isSupabaseMissingColumn(res.error)) {
      // background column not there yet
      setNpcHasBackgroundCol(false);

      const colsNoBg = [
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
      ].join(",");

      res = await supabase.from("npcs").select(colsNoBg);
    } else {
      setNpcHasBackgroundCol(true);
    }

    if (res.error) {
      setErr(res.error.message);
      setNpcs([]);
      return;
    }
    setNpcs(res.data || []);
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
        [
          "merchant_id",
          "race",
          "role",
          "background",
          "description",
          "motivation",
          "quirk",
          "mannerism",
          "voice",
          "secret",
          "affiliation",
          "status",
          "tags",
          "sheet",
          "updated_at",
        ].join(",")
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

    // support ?focus=<npc_id> (npc only)
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
        race: prof.race || "",
        role: prof.role || "Merchant",
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

      // only write background if the column exists (or after you run the ALTER TABLE)
      if (npcHasBackgroundCol) {
        npcPatch.background = safeStr(editNpc.background) || null;
      }

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
      // update merchant location on merchants table
      const locPatch = {
        location_id: editMerchant.location_id ? Number(editMerchant.location_id) : null,
      };
      const updM = await supabase.from("merchants").update(locPatch).eq("id", selected.id);
      if (updM.error) return alert(updM.error.message);

      // upsert merchant profile + sheet
      const profPatch = {
        merchant_id: selected.id,
        race: safeStr(editMerchant.race) || null,
        role: safeStr(editMerchant.role) || "Merchant",
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
      <div className="container-fluid my-3">
        <div style={{ color: MUTED }}>Loading NPCs…</div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="container-fluid my-3">
        <div className="alert alert-danger">{err}</div>
      </div>
    );
  }
  if (!roster.length) {
    return (
      <div className="container-fluid my-3">
        <div style={{ color: MUTED }}>No NPCs or merchants found.</div>
      </div>
    );
  }

  // layout: fixed-height panels, independent scroll
  const panelHeight = { height: "calc(100vh - 170px)" };

  return (
    <div className="container-fluid my-3">
      <div className="d-flex align-items-center mb-2">
        <h1 className="h4 mb-0">NPCs</h1>
        <div className="ms-auto small" style={{ color: DIM }}>
          {isAdmin ? "Admin" : "Player"} view
        </div>
      </div>

      <div className="row g-3">
        {/* LEFT: roster */}
        <div className="col-12 col-lg-4">
          <div className="p-2 rounded-3 d-flex flex-column" style={{ ...glassPanelStyle, ...panelHeight }}>
            <div className="d-flex gap-2 mb-2">
              <input
                className="form-control form-control-sm"
                placeholder="Search NPCs & merchants…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="d-flex gap-2 mb-2">
              <select
                className="form-select form-select-sm"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All roles</option>
                {uniqueRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {uniqueStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="list-group flex-grow-1 overflow-auto">
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

                    <div className="small" style={{ color: DIM }}>
                      {[
                        r.race || null,
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
          <div className="p-3 rounded-3" style={{ ...glassPanelStyle, ...panelHeight, overflowY: "auto" }}>
            {!selected ? (
              <div style={{ color: MUTED }}>Select an NPC…</div>
            ) : (
              <>
                <div className="d-flex align-items-start">
                  <div>
                    <div className="h5 mb-1">{selected.name}</div>
                    <div className="small" style={{ color: DIM }}>
                      {[
                        selected.race || null,
                        selected.role || null,
                        selected.affiliation || null,
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
                  {/* LEFT column: Background + Quick hooks */}
                  <div className="col-12 col-xl-6">
                    <div className="fw-semibold mb-1">Background</div>
                    <div className="small mb-2" style={{ color: DIM }}>
                      Where they come from; ties; history; why they matter.
                    </div>

                    <div style={{ color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>
                      {selected.background || <span style={{ color: DIM }}>—</span>}
                    </div>

                    <div className="fw-semibold mt-3 mb-1">Quick hooks</div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>
                        Motivation / Want
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.92)" }}>
                        {selected.motivation || <span style={{ color: DIM }}>—</span>}
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>
                        Personality / Quirk
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.92)" }}>
                        {selected.quirk || <span style={{ color: DIM }}>—</span>}
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>
                        Mannerism / Voice
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.92)" }}>
                        {[selected.mannerism, selected.voice].filter(Boolean).join(" • ") || (
                          <span style={{ color: DIM }}>—</span>
                        )}
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>
                        Secret (optional)
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.92)" }}>
                        {selected.secret || <span style={{ color: DIM }}>—</span>}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="fw-semibold mb-1">Description</div>
                      <div style={{ color: MUTED, whiteSpace: "pre-wrap" }}>{selected.description || "—"}</div>
                    </div>
                  </div>

                  {/* RIGHT column: Tabs (Skills / Sheet) */}
                  <div className="col-12 col-xl-6">
                    <ul className="nav nav-tabs" role="tablist" style={{ borderColor: BORDER }}>
                      <li className="nav-item" role="presentation">
                        <button
                          className="nav-link active"
                          data-bs-toggle="tab"
                          data-bs-target="#npcSkillsTab"
                          type="button"
                          role="tab"
                          style={{ color: "rgba(255,255,255,0.92)" }}
                        >
                          Skills
                        </button>
                      </li>
                      <li className="nav-item" role="presentation">
                        <button
                          className="nav-link"
                          data-bs-toggle="tab"
                          data-bs-target="#npcSheetTab"
                          type="button"
                          role="tab"
                          style={{ color: "rgba(255,255,255,0.92)" }}
                        >
                          Sheet
                        </button>
                      </li>
                    </ul>

                    <div className="tab-content pt-3">
                      <div className="tab-pane fade show active" id="npcSkillsTab" role="tabpanel">
                        <SkillRolls sheet={sheet} />
                      </div>

                      <div className="tab-pane fade" id="npcSheetTab" role="tabpanel">
                        <CharacterSheetGrid
                          sheet={sheet}
                          fallbackName={selected.name}
                          backgroundText={selected.background}
                        />
                      </div>
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
                        <select
                          className="form-select form-select-sm"
                          value={noteScope}
                          onChange={(e) => setNoteScope(e.target.value)}
                        >
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
                      {(notes || []).filter(canSeeNote).length === 0 && (
                        <div style={{ color: MUTED }}>No visible notes yet.</div>
                      )}
                    </div>
                  </>
                )}

                {/* Admin edit panel */}
                {isAdmin && editOpen && (
                  <NpcEditPanel
                    editType={editType}
                    editNpc={editNpc}
                    setEditNpc={setEditNpc}
                    editMerchant={editMerchant}
                    setEditMerchant={setEditMerchant}
                    editSheet={editSheet}
                    setEditSheet={setEditSheet}
                    locations={locations}
                    onCancel={() => setEditOpen(false)}
                    onSave={saveEdit}
                    MUTED={MUTED}
                    DIM={DIM}
                    BORDER={BORDER}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// /pages/npcs.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const glassPanelStyle = {
  background: "rgba(8, 10, 16, 0.88)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

function safeStr(v) {
  return String(v ?? "").trim();
}

function isSupabaseMissingTable(err) {
  const msg = String(err?.message || "");
  return msg.includes("relation") && msg.includes("does not exist");
}

function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

export default function NpcsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [players, setPlayers] = useState([]); // for visibility checkboxes (optional)
  const [locations, setLocations] = useState([]);

  const [npcs, setNpcs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [sheet, setSheet] = useState(null); // npc_sheets.sheet
  const [notes, setNotes] = useState([]);
  const [notesEnabled, setNotesEnabled] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // admin edit form
  const [editOpen, setEditOpen] = useState(false);
  const [editNpc, setEditNpc] = useState(null);
  const [editSheet, setEditSheet] = useState(null);

  // new note
  const [noteScope, setNoteScope] = useState("private"); // private/shared
  const [noteAllPlayers, setNoteAllPlayers] = useState(true);
  const [noteVisibleTo, setNoteVisibleTo] = useState([]); // user_id[]
  const [noteBody, setNoteBody] = useState("");

  const selectedNpc = useMemo(
    () => (npcs || []).find((n) => String(n.id) === String(selectedId)) || null,
    [npcs, selectedId]
  );

  const locationNameById = useMemo(() => {
    const m = new Map();
    for (const l of locations || []) m.set(String(l.id), l.name);
    return m;
  }, [locations]);

  const filteredNpcs = useMemo(() => {
    const query = safeStr(q).toLowerCase();
    return (npcs || [])
      .filter((n) => {
        if (roleFilter && String(n.role || "") !== roleFilter) return false;
        if (statusFilter && String(n.status || "") !== statusFilter) return false;

        if (!query) return true;
        const hay = [
          n.name,
          n.race,
          n.role,
          n.affiliation,
          n.tags?.join?.(" "),
          n.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [npcs, q, roleFilter, statusFilter]);

  const uniqueRoles = useMemo(() => {
    const set = new Set((npcs || []).map((n) => String(n.role || "").trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [npcs]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set((npcs || []).map((n) => String(n.status || "alive")));
    const list = Array.from(set);
    // keep alive near top if present
    list.sort((a, b) => (a === "alive" ? -1 : b === "alive" ? 1 : a.localeCompare(b)));
    return list;
  }, [npcs]);

  const canSeeNote = useCallback(
    (note) => {
      if (isAdmin) return true;
      if (!userId) return false;

      if (note.scope === "private") return String(note.author_user_id) === String(userId);

      // shared
      const arr = note.visible_to_user_ids;
      if (!arr || !Array.isArray(arr) || arr.length === 0) return true; // null/empty => all players
      return arr.some((id) => String(id) === String(userId));
    },
    [isAdmin, userId]
  );

  const loadAuth = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user || null;
    setUserId(user?.id || null);

    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error) {
      setIsAdmin(false);
      return;
    }
    setIsAdmin(data?.role === "admin");
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
    // default select first
    setSelectedId((prev) => prev || (data?.[0]?.id ?? null));
  }, []);

  const loadPlayers = useCallback(async () => {
    // used only for per-user visibility checkboxes
    const res = await supabase.from("players").select("user_id,name").order("name", { ascending: true });
    if (res.error) return;
    setPlayers(res.data || []);
  }, []);

  const loadLocations = useCallback(async () => {
    const res = await supabase.from("locations").select("id,name").order("id");
    if (res.error) return;
    setLocations(res.data || []);
  }, []);

  const loadNpcSheet = useCallback(async (npcId) => {
    if (!npcId) {
      setSheet(null);
      return;
    }
    const res = await supabase.from("npc_sheets").select("sheet").eq("npc_id", npcId).single();
    if (res.error) {
      if (isSupabaseMissingTable(res.error)) {
        setSheet(null);
        return;
      }
      // no row is OK
      setSheet(null);
      return;
    }
    setSheet(res.data?.sheet || null);
  }, []);

  const loadNpcNotes = useCallback(async (npcId) => {
    if (!npcId) {
      setNotes([]);
      return;
    }
    if (!notesEnabled) return;

    const res = await supabase
      .from("npc_notes")
      .select("id,npc_id,author_user_id,scope,visible_to_user_ids,body,created_at")
      .eq("npc_id", npcId)
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
  }, [notesEnabled]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      await loadAuth();
      await Promise.all([loadNpcs(), loadPlayers(), loadLocations()]);
      setLoading(false);
    })();
  }, [loadAuth, loadNpcs, loadPlayers, loadLocations]);

  useEffect(() => {
    (async () => {
      if (!selectedId) return;
      await Promise.all([loadNpcSheet(selectedId), loadNpcNotes(selectedId)]);
      setEditOpen(false);
    })();
  }, [selectedId, loadNpcSheet, loadNpcNotes]);

  // helpers for “rolls”
  const perceptionMod = useMemo(() => {
    // You can decide your final JSON shape later; these are safe fallbacks.
    const v =
      sheet?.skills?.perception ??
      sheet?.skill_mods?.perception ??
      sheet?.perception ??
      sheet?.passivePerceptionMod; // just in case
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }, [sheet]);

  const [lastRoll, setLastRoll] = useState(null);

  async function startEdit() {
    if (!isAdmin || !selectedNpc) return;
    setEditNpc({ ...selectedNpc });
    setEditSheet(sheet ? structuredClone(sheet) : {});
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!isAdmin || !editNpc || !selectedNpc) return;

    // update NPC profile fields
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

    const upd = await supabase.from("npcs").update(npcPatch).eq("id", selectedNpc.id);
    if (upd.error) return alert(upd.error.message);

    // upsert sheet overlay
    const up = await supabase.from("npc_sheets").upsert(
      {
        npc_id: selectedNpc.id,
        sheet: editSheet || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "npc_id" }
    );
    if (up.error && !isSupabaseMissingTable(up.error)) return alert(up.error.message);

    await loadNpcs();
    await loadNpcSheet(selectedNpc.id);
    setEditOpen(false);
  }

  async function addNote() {
    if (!selectedNpc) return;
    if (!userId) return alert("You must be logged in to add notes.");
    const body = safeStr(noteBody);
    if (!body) return;

    const payload = {
      npc_id: selectedNpc.id,
      author_user_id: userId,
      scope: noteScope,
      visible_to_user_ids:
        noteScope === "shared" ? (noteAllPlayers ? null : noteVisibleTo) : null,
      body,
    };

    const res = await supabase.from("npc_notes").insert(payload);
    if (res.error) return alert(res.error.message);

    setNoteBody("");
    setNoteAllPlayers(true);
    setNoteVisibleTo([]);
    await loadNpcNotes(selectedNpc.id);
  }

  if (loading) {
    return (
      <div className="container-fluid my-3">
        <div className="text-muted">Loading NPCs…</div>
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

  if (!npcs.length) {
    return (
      <div className="container-fluid my-3">
        <div className="text-muted">No NPCs found.</div>
      </div>
    );
  }

  return (
    <div className="container-fluid my-3">
      <div className="d-flex align-items-center mb-2">
        <h1 className="h4 mb-0">NPCs</h1>
        <div className="ms-auto small text-muted">
          {isAdmin ? "Admin" : "Player"} view
        </div>
      </div>

      <div className="row g-3">
        {/* LEFT: roster */}
        <div className="col-12 col-lg-4">
          <div className="p-2 rounded-3" style={glassPanelStyle}>
            <div className="d-flex gap-2 mb-2">
              <input
                className="form-control form-control-sm"
                placeholder="Search NPCs…"
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

            <div className="list-group">
              {filteredNpcs.map((npc) => {
                const active = String(npc.id) === String(selectedId);
                const status = String(npc.status || "alive");
                return (
                  <button
                    key={npc.id}
                    type="button"
                    className={`list-group-item list-group-item-action ${
                      active ? "active" : ""
                    }`}
                    style={{
                      background: active ? "rgba(255,255,255,0.08)" : "transparent",
                      color: "rgba(255,255,255,0.92)",
                      borderColor: "rgba(255,255,255,0.08)",
                    }}
                    onClick={() => setSelectedId(npc.id)}
                  >
                    <div className="d-flex align-items-center">
                      <div className="fw-semibold">{npc.name}</div>
                      <span
                        className={`badge ms-auto ${
                          status === "alive"
                            ? "text-bg-success"
                            : status === "dead"
                            ? "text-bg-secondary"
                            : "text-bg-dark"
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <div className="small text-muted">
                      {[npc.race, npc.role, npc.affiliation].filter(Boolean).join(" • ") || "—"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: details */}
        <div className="col-12 col-lg-8">
          <div className="p-3 rounded-3" style={glassPanelStyle}>
            {!selectedNpc ? (
              <div className="text-muted">Select an NPC…</div>
            ) : (
              <>
                <div className="d-flex align-items-start">
                  <div>
                    <div className="h5 mb-1">{selectedNpc.name}</div>
                    <div className="small text-muted">
                      {[selectedNpc.race, selectedNpc.role, selectedNpc.affiliation]
                        .filter(Boolean)
                        .join(" • ") || "—"}
                      {selectedNpc.location_id ? (
                        <>
                          {" "}
                          • <span className="text-light">
                            {locationNameById.get(String(selectedNpc.location_id)) || "Unknown location"}
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

                <hr style={{ borderColor: "rgba(255,255,255,0.12)" }} />

                {/* Profile (guidelines fields) */}
                <div className="row g-3">
                  <div className="col-12 col-xl-6">
                    <div className="fw-semibold mb-1">At a glance</div>
                    <div className="small text-muted mb-2">
                      Keep it playable: wants + vibe + role.
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Motivation / Want</div>
                      <div>{selectedNpc.motivation || <span className="text-muted">—</span>}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Personality / Quirk</div>
                      <div>{selectedNpc.quirk || <span className="text-muted">—</span>}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Mannerism / Voice</div>
                      <div>
                        {[selectedNpc.mannerism, selectedNpc.voice].filter(Boolean).join(" • ") || (
                          <span className="text-muted">—</span>
                        )}
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Secret (optional)</div>
                      <div>{selectedNpc.secret || <span className="text-muted">—</span>}</div>
                    </div>
                  </div>

                  {/* Sheet quick tools */}
                  <div className="col-12 col-xl-6">
                    <div className="fw-semibold mb-1">Sheet & quick rolls</div>
                    <div className="small text-muted mb-2">
                      Full sheet lives in <code>npc_sheets.sheet</code> (JSON overlay).
                    </div>

                    <div className="d-flex align-items-center gap-2 mb-2">
                      <button
                        className="btn btn-sm btn-outline-warning"
                        disabled={perceptionMod == null}
                        onClick={() => {
                          const roll = d20();
                          const total = roll + (perceptionMod || 0);
                          setLastRoll({ type: "Perception", roll, mod: perceptionMod || 0, total });
                        }}
                        title={perceptionMod == null ? "No perception mod stored yet" : "Roll Perception"}
                      >
                        Roll Perception
                      </button>

                      <div className="small text-muted">
                        Mod:{" "}
                        <span className="text-light">
                          {perceptionMod == null ? "—" : (perceptionMod >= 0 ? `+${perceptionMod}` : `${perceptionMod}`)}
                        </span>
                      </div>
                    </div>

                    {lastRoll && (
                      <div className="alert alert-dark py-2 mb-0" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                        <div className="small">
                          <span className="fw-semibold">{lastRoll.type}</span>: d20{" "}
                          <span className="text-light">{lastRoll.roll}</span>{" "}
                          {lastRoll.mod >= 0 ? "+" : "-"}{" "}
                          <span className="text-light">{Math.abs(lastRoll.mod)}</span>{" "}
                          = <span className="fw-semibold text-light">{lastRoll.total}</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-3">
                      <div className="fw-semibold mb-1">Description</div>
                      <div className="text-muted">{selectedNpc.description || "—"}</div>
                    </div>
                  </div>
                </div>

                <hr className="my-3" style={{ borderColor: "rgba(255,255,255,0.12)" }} />

                {/* Notes */}
                <div className="fw-semibold mb-2">Notes</div>

                {!userId ? (
                  <div className="text-muted">Log in to add/view notes.</div>
                ) : (
                  <>
                    <div className="row g-2 align-items-end mb-2">
                      <div className="col-12 col-md-3">
                        <label className="form-label form-label-sm text-muted">Scope</label>
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
                              <span className="form-check-label text-light">Visible to all players</span>
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
                                    <span className="form-check-label text-light">{p.name || "Player"}</span>
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
                          }}
                        >
                          <div className="d-flex align-items-center mb-1">
                            <span className="badge text-bg-dark">
                              {n.scope === "private" ? "Private" : "Shared"}
                            </span>
                            <span className="ms-auto small text-muted">
                              {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                            </span>
                          </div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
                        </div>
                      ))}
                      {(notes || []).filter(canSeeNote).length === 0 && (
                        <div className="text-muted">No visible notes yet.</div>
                      )}
                    </div>
                  </>
                )}

                {/* Admin edit panel */}
                {isAdmin && editOpen && editNpc && (
                  <>
                    <hr className="my-3" style={{ borderColor: "rgba(255,255,255,0.12)" }} />
                    <div className="d-flex align-items-center mb-2">
                      <div className="fw-semibold">Edit NPC</div>
                      <div className="ms-auto d-flex gap-2">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditOpen(false)}>
                          Cancel
                        </button>
                        <button className="btn btn-sm btn-primary" onClick={saveEdit}>
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <label className="form-label form-label-sm text-muted">Name</label>
                        <input
                          className="form-control form-control-sm"
                          value={editNpc.name || ""}
                          onChange={(e) => setEditNpc((p) => ({ ...p, name: e.target.value }))}
                        />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label form-label-sm text-muted">Race</label>
                        <input
                          className="form-control form-control-sm"
                          value={editNpc.race || ""}
                          onChange={(e) => setEditNpc((p) => ({ ...p, race: e.target.value }))}
                        />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label form-label-sm text-muted">Role</label>
                        <input
                          className="form-control form-control-sm"
                          value={editNpc.role || ""}
                          onChange={(e) => setEditNpc((p) => ({ ...p, role: e.target.value }))}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label form-label-sm text-muted">Affiliation</label>
                        <input
                          className="form-control form-control-sm"
                          value={editNpc.affiliation || ""}
                          onChange={(e) => setEditNpc((p) => ({ ...p, affiliation: e.target.value }))}
                        />
                      </div>

                      <div className="col-6 col-md-3">
                        <label className="form-label form-label-sm text-muted">Status</label>
                        <input
                          className="form-control form-control-sm"
                          value={editNpc.status || "alive"}
                          onChange={(e) => setEditNpc((p) => ({ ...p, status: e.target.value }))}
                        />
                      </div>

                      <div className="col-6 col-md-3">
                        <label className="form-label form-label-sm text-muted">Location</label>
                        <select
                          className="form-select form-select-sm"
                          value={editNpc.location_id || ""}
                          onChange={(e) => setEditNpc((p) => ({ ...p, location_id: e.target.value || null }))}
                        >
                          <option value="">—</option>
                          {(locations || []).map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-12">
                        <label className="form-label form-label-sm text-muted">Motivation</label>
                        <input
                          className="form-control form-control-sm"
                          value={editNpc.motivation || ""}
                          onChange={(e) => setEditNpc((p) => ({ ...p, motivation: e.target.value }))}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label form-label-sm text-muted">Quirk</label>
                        <input
                          className="form-control form-control-sm"
                          value={editNpc.quirk || ""}
                          onChange={(e) => setEditNpc((p) => ({ ...p, quirk: e.target.value }))}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label form-label-sm text-muted">Mannerism</label>
                        <input
                          className="form-control form-control-sm"
                          value={editNpc.mannerism || ""}
                          onChange={(e) => setEditNpc((p) => ({ ...p, mannerism: e.target.value }))}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label form-label-sm text-muted">Voice</label>
                        <input
                          className="form-control form-control-sm"
                          value={editNpc.voice || ""}
                          onChange={(e) => setEditNpc((p) => ({ ...p, voice: e.target.value }))}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label form-label-sm text-muted">Secret</label>
                        <input
                          className="form-control form-control-sm"
                          value={editNpc.secret || ""}
                          onChange={(e) => setEditNpc((p) => ({ ...p, secret: e.target.value }))}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label form-label-sm text-muted">
                          Sheet overlay (quick start)
                        </label>
                        <div className="small text-muted mb-1">
                          For now you can store <code>{"{ skills: { perception: 3 } }"}</code> etc. We’ll build the full
                          “exact PC sheet” editor next.
                        </div>
                        <textarea
                          className="form-control"
                          rows={5}
                          value={JSON.stringify(editSheet || {}, null, 2)}
                          onChange={(e) => {
                            try {
                              const next = JSON.parse(e.target.value);
                              setEditSheet(next);
                            } catch {
                              // ignore invalid JSON while typing
                            }
                          }}
                        />
                      </div>
                    </div>
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

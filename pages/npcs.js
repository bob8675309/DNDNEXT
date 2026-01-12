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

function deepClone(obj) {
  try {
    return structuredClone(obj ?? {});
  } catch {
    return JSON.parse(JSON.stringify(obj ?? {}));
  }
}

function jsonEqual(a, b) {
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return false;
  }
}

// roster key helpers
const keyOf = (type, id) => `${type}:${String(id)}`;
const parseKey = (k) => {
  const [type, ...rest] = String(k || "").split(":");
  return { type, id: rest.join(":") };
};

function buildMetaLine({ selected, role, affiliation, sheetDraft }) {
  const parts = [];

  const race = safeStr(selected?.race);
  if (race) parts.push(race);

  const r = safeStr(role);
  if (r) parts.push(r);

  const aff = safeStr(affiliation);
  if (aff) parts.push(aff);

  const s = sheetDraft || {};
  const meta = (s && typeof s === "object" && s.meta && typeof s.meta === "object") ? s.meta : {};

  const alignment = safeStr(s.alignment ?? meta.alignment);
  if (alignment) parts.push(alignment);

  const className = safeStr(
    s.className ?? s.class ?? meta.className ?? meta.class
  );
  const level = Number.isFinite(Number(s.level ?? meta.level)) ? Number(s.level ?? meta.level) : null;
  if (className && level != null) parts.push(`${className} Lvl ${level}`);
  else if (className) parts.push(className);

  const xp = Number.isFinite(Number(s.xp ?? meta.xp)) ? Number(s.xp ?? meta.xp) : null;
  const xpNext = Number.isFinite(Number(s.xpNext ?? s.xpToNext ?? meta.xpNext ?? meta.xpToNext))
    ? Number(s.xpNext ?? s.xpToNext ?? meta.xpNext ?? meta.xpToNext)
    : null;

  if (xp != null && xpNext != null) parts.push(`XP ${xp}/${xpNext}`);
  else if (xp != null) parts.push(`XP ${xp}`);

  return parts.filter(Boolean).join(" • ");
}

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
  // Controlled sheet draft/edit mode so we can edit parts of the sheet outside the CharacterSheetPanel.
  const [sheetDraft, setSheetDraft] = useState({});
  const [sheetEditMode, setSheetEditMode] = useState(false);

  // narrative/profile fields stored outside the sheet JSON
  const [detailsBase, setDetailsBase] = useState(null);
  const [detailsDraft, setDetailsDraft] = useState(null);

  const [notes, setNotes] = useState([]);
  const [notesEnabled, setNotesEnabled] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // new note
  const [noteScope, setNoteScope] = useState("private"); // private/shared
  const [noteAllPlayers, setNoteAllPlayers] = useState(true);
  const [noteVisibleTo, setNoteVisibleTo] = useState([]);
  const [noteBody, setNoteBody] = useState("");

  const [lastRoll, setLastRoll] = useState(null);

  // Equipped items for selected NPC or merchant
  const [equippedRows, setEquippedRows] = useState([]);
  // Inventory deep link (Inventory page supports ownerType/ownerId query params)
  const ownerInfo = parseKey(selectedKey);
  const inventoryHref =
    ownerInfo?.type && ownerInfo?.id
      ? `/inventory?ownerType=${encodeURIComponent(ownerInfo.type)}&ownerId=${encodeURIComponent(ownerInfo.id)}`
      : "";

  // Keep draft in sync when selection changes / sheet reloads.
  useEffect(() => {
    setSheetDraft(deepClone(sheet || {}));
    setSheetEditMode(false);
  }, [sheet, selectedKey]);

  const locationNameById = useMemo(() => {
    const m = new Map();
    for (const l of locations || []) m.set(String(l.id), l.name);
    return m;
  }, [locations]);

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
          "affiliation",
          "status",
          "location_id",
          "tags",
          "updated_at",
          "description",
          "background",
          "motivation",
          "quirk",
          "mannerism",
          "voice",
          "secret",
        ].join(",")
      )
      .order("name", { ascending: true });

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

  /* ------------------- roster merge ------------------- */
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
        background: n.background,
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
        description: prof.description || null,
        background: prof.background || null,
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

  // Load equipped items for NPC/merchant when selection changes
  useEffect(() => {
    async function loadEquipped() {
      if (!selectedKey) {
        setEquippedRows([]);
        return;
      }
      const { type, id } = parseKey(selectedKey);
      const ownerType = type;
      const ownerId = id;
      // Fetch equipped items
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .eq("is_equipped", true)
        .order("created_at", { ascending: false });
      if (!error) setEquippedRows(data || []);
      else setEquippedRows([]);
    }
    loadEquipped();
  }, [selectedKey]);

  // When equippedRows changes, update sheetDraft with equipment names and item bonuses
  useEffect(() => {
    // Build a string of equipped item names (one per line)
    const eqString = (equippedRows || [])
      .map((row) => {
        const payload = row.card_payload || {};
        return (
          payload.item_name ||
          payload.name ||
          row.item_name ||
          row.name ||
          null
        );
      })
      .filter(Boolean)
      .join("\n");

    // Aggregate item bonuses from equipped items
    function aggregateItemBonuses(rows) {
      const bonuses = { ac: 0, savesAll: 0, saves: {}, skillsAll: 0, skills: {} };
      for (const row of rows || []) {
        const p = row.card_payload || {};
        // global bonuses
        if (p.bonusAc) bonuses.ac += parseInt(p.bonusAc);
        if (p.bonusSavingThrow) bonuses.savesAll += parseInt(p.bonusSavingThrow);
        // handle modifiers structure for per-save/per-skill bonuses
        const mods = p.modifiers || {};
        if (mods.saves) {
          for (const k in mods.saves) {
            const val = parseInt(mods.saves[k]);
            if (k === 'all') bonuses.savesAll += val;
            else bonuses.saves[k] = (bonuses.saves[k] || 0) + val;
          }
        }
        if (mods.checks) {
          for (const k in mods.checks) {
            const val = parseInt(mods.checks[k]);
            if (k === 'all') bonuses.skillsAll += val;
            else bonuses.skills[k] = (bonuses.skills[k] || 0) + val;
          }
        }
      }
      return bonuses;
    }

    const itemBonuses = aggregateItemBonuses(equippedRows);

    // Update sheet draft if different
    setSheetDraft((prev) => {
      if (!prev || typeof prev !== 'object') return prev;
      let changed = false;
      const next = deepClone(prev);
      if ((next.equipment || "") !== eqString) {
        next.equipment = eqString;
        changed = true;
      }
      // Compare itemBonuses
      if (!jsonEqual(next.itemBonuses, itemBonuses)) {
        next.itemBonuses = itemBonuses;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [equippedRows]);

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

  /* ------------------- narrative base/draft sync ------------------- */
  const buildDetailsBase = useCallback(
    (sel) => {
      if (!sel) return null;

      if (sel.type === "npc") {
        const row = (npcs || []).find((n) => String(n.id) === String(sel.id)) || sel;
        return {
          role: safeStr(row.role),
          affiliation: safeStr(row.affiliation),
          description: safeStr(row.description),
          background: safeStr(row.background),
          motivation: safeStr(row.motivation),
          quirk: safeStr(row.quirk),
          mannerism: safeStr(row.mannerism),
          voice: safeStr(row.voice),
          secret: safeStr(row.secret),
        };
      }

      if (sel.type === "merchant") {
        const prof = merchantProfiles.get(String(sel.id)) || {};
        return {
          role: safeStr(prof.role || sel.role),
          affiliation: safeStr(prof.affiliation || sel.affiliation),
          description: safeStr(prof.description || sel.description),
          background: safeStr(prof.background || sel.background),
          motivation: safeStr(prof.motivation || sel.motivation),
          quirk: safeStr(prof.quirk || sel.quirk),
          mannerism: safeStr(prof.mannerism || sel.mannerism),
          voice: safeStr(prof.voice || sel.voice),
          secret: safeStr(prof.secret || sel.secret),
        };
      }

      return null;
    },
    [npcs, merchantProfiles]
  );

  useEffect(() => {
    if (!selected) {
      setDetailsBase(null);
      setDetailsDraft(null);
      return;
    }

    const base = buildDetailsBase(selected);
    setDetailsBase(base);
    setDetailsDraft(deepClone(base || {}));
  }, [selectedKey, selected, buildDetailsBase]);

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
      setLastRoll(null);
    })();
  }, [selectedKey, loadSelectedSheet, loadSelectedNotes]);

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

  const canEditNarrative = !!isAdmin && !!sheetEditMode;

  const details = detailsDraft || {};
  const detailsDirty = !jsonEqual(detailsDraft, detailsBase);

  const roleText = canEditNarrative ? details.role : safeStr(selected?.role);
  const affiliationText = canEditNarrative ? details.affiliation : safeStr(selected?.affiliation);

  const backgroundText = canEditNarrative
    ? details.background
    : safeStr(selected?.background || sheetDraft?.background || "");

  const descriptionText = canEditNarrative ? details.description : safeStr(selected?.description || "");

  const personality = (sheetDraft && typeof sheetDraft === "object" && sheetDraft.personality) ? sheetDraft.personality : {};
  const traitsText = safeStr(sheetDraft?.traits ?? personality?.traits);
  const idealsText = safeStr(sheetDraft?.ideals ?? personality?.ideals);
  const bondsText = safeStr(sheetDraft?.bonds ?? personality?.bonds);
  const flawsText = safeStr(sheetDraft?.flaws ?? personality?.flaws);

  const setPersonalityField = (field, value) => {
    setSheetDraft((prev) => {
      const next = deepClone(prev || {});
      next.personality = { ...(next.personality || {}) };
      next.personality[field] = value;
      // mirror to legacy top-level keys for backwards compatibility
      next[field] = value;
      return next;
    });
  };

  const setDetailsField = (field, value) => {
    setDetailsDraft((prev) => ({
      ...(prev || {}),
      [field]: value,
    }));
  };

  const metaLine = buildMetaLine({
    selected,
    role: roleText,
    affiliation: affiliationText,
    sheetDraft,
  });

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
          <div
            className="p-3 rounded-3 npc-panel npc-panel-scroll"
            style={{ ...glassPanelStyle, ...panelHeight, overflowY: "auto" }}
          >
            {!selected ? (
              <div style={{ color: MUTED }}>Select an NPC…</div>
            ) : (
              <>
                <div className="d-flex align-items-start">
                  <div style={{ minWidth: 0 }}>
                    <div className="h5 mb-1">{selected.name}</div>
                    <div className="small npc-muted" style={{ minWidth: 0 }}>
                      {[
                        selected.type === "npc" ? selected.race : null,
                        roleText,
                        affiliationText,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "—"}
                      {selected.location_id ? (
                        <>
                          {" "}•{" "}
                          <span style={{ color: "rgba(255,255,255,0.88)" }}>
                            {locationNameById.get(String(selected.location_id)) || "Unknown location"}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {canEditNarrative ? (
                      <div className="d-flex gap-2 mt-2 flex-wrap">
                        <div style={{ minWidth: 160 }}>
                          <div className="small" style={{ color: MUTED }}>
                            Role
                          </div>
                          <input
                            className="form-control form-control-sm"
                            value={details.role || ""}
                            onChange={(e) => setDetailsField("role", e.target.value)}
                          />
                        </div>

                        <div style={{ minWidth: 220, flex: 1 }}>
                          <div className="small" style={{ color: MUTED }}>
                            Affiliation
                          </div>
                          <input
                            className="form-control form-control-sm"
                            value={details.affiliation || ""}
                            onChange={(e) => setDetailsField("affiliation", e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <hr style={{ borderColor: BORDER }} />

                <div className="row g-3">
                  {/* Left: Description / Background / Personality / Hooks / Notes */}
                  <div className="col-12 col-xl-5">
                    <div className="fw-semibold mb-1">Description</div>
                    {canEditNarrative ? (
                      <textarea
                        className="form-control form-control-sm"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${BORDER}`,
                          color: "rgba(255,255,255,0.92)",
                        }}
                        rows={3}
                        value={details.description || ""}
                        onChange={(e) => setDetailsField("description", e.target.value)}
                      />
                    ) : (
                      <div style={{ color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>
                        {descriptionText || <span className="npc-muted">—</span>}
                      </div>
                    )}

                    <div className="mt-3 fw-semibold mb-1">Background</div>
                    <div className="small mb-2 npc-muted">Where they come from; ties; history; why they matter.</div>
                    {canEditNarrative ? (
                      <textarea
                        className="form-control form-control-sm"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${BORDER}`,
                          color: "rgba(255,255,255,0.92)",
                        }}
                        rows={3}
                        value={details.background || ""}
                        onChange={(e) => setDetailsField("background", e.target.value)}
                      />
                    ) : (
                      <div style={{ color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>
                        {backgroundText ? backgroundText : <span className="npc-muted">—</span>}
                      </div>
                    )}

                    <div className="mt-3 fw-semibold mb-2">Personality</div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>
                        Traits
                      </div>
                      {canEditNarrative ? (
                        <textarea
                          className="form-control form-control-sm"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${BORDER}`,
                            color: "rgba(255,255,255,0.92)",
                          }}
                          rows={2}
                          value={traitsText}
                          onChange={(e) => setPersonalityField("traits", e.target.value)}
                        />
                      ) : (
                        <div style={{ color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>
                          {traitsText || <span className="npc-muted">—</span>}
                        </div>
                      )}
                    </div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>
                        Ideals
                      </div>
                      {canEditNarrative ? (
                        <textarea
                          className="form-control form-control-sm"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${BORDER}`,
                            color: "rgba(255,255,255,0.92)",
                          }}
                          rows={2}
                          value={idealsText}
                          onChange={(e) => setPersonalityField("ideals", e.target.value)}
                        />
                      ) : (
                        <div style={{ color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>
                          {idealsText || <span className="npc-muted">—</span>}
                        </div>
                      )}
                    </div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>
                        Bonds
                      </div>
                      {canEditNarrative ? (
                        <textarea
                          className="form-control form-control-sm"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${BORDER}`,
                            color: "rgba(255,255,255,0.92)",
                          }}
                          rows={2}
                          value={bondsText}
                          onChange={(e) => setPersonalityField("bonds", e.target.value)}
                        />
                      ) : (
                        <div style={{ color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>
                          {bondsText || <span className="npc-muted">—</span>}
                        </div>
                      )}
                    </div>

                    <div className="mb-2">
                      <div className="small" style={{ color: MUTED }}>
                        Flaws
                      </div>
                      {canEditNarrative ? (
                        <textarea
                          className="form-control form-control-sm"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${BORDER}`,
                            color: "rgba(255,255,255,0.92)",
                          }}
                          rows={2}
                          value={flawsText}
                          onChange={(e) => setPersonalityField("flaws", e.target.value)}
                        />
                      ) : (
                        <div style={{ color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>
                          {flawsText || <span className="npc-muted">—</span>}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 fw-semibold mb-2">Quick hooks</div>

                    {canEditNarrative ? (
                      <div className="row g-2">
                        <div className="col-12">
                          <div className="small" style={{ color: MUTED }}>
                            Motivation / Want
                          </div>
                          <input
                            className="form-control form-control-sm"
                            value={details.motivation || ""}
                            onChange={(e) => setDetailsField("motivation", e.target.value)}
                          />
                        </div>
                        <div className="col-12">
                          <div className="small" style={{ color: MUTED }}>
                            Personality / Quirk
                          </div>
                          <input
                            className="form-control form-control-sm"
                            value={details.quirk || ""}
                            onChange={(e) => setDetailsField("quirk", e.target.value)}
                          />
                        </div>
                        <div className="col-12">
                          <div className="small" style={{ color: MUTED }}>
                            Mannerism
                          </div>
                          <input
                            className="form-control form-control-sm"
                            value={details.mannerism || ""}
                            onChange={(e) => setDetailsField("mannerism", e.target.value)}
                          />
                        </div>
                        <div className="col-12">
                          <div className="small" style={{ color: MUTED }}>
                            Voice
                          </div>
                          <input
                            className="form-control form-control-sm"
                            value={details.voice || ""}
                            onChange={(e) => setDetailsField("voice", e.target.value)}
                          />
                        </div>
                        <div className="col-12">
                          <div className="small" style={{ color: MUTED }}>
                            Secret (optional)
                          </div>
                          <input
                            className="form-control form-control-sm"
                            value={details.secret || ""}
                            onChange={(e) => setDetailsField("secret", e.target.value)}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-2">
                          <div className="small" style={{ color: MUTED }}>
                            Motivation / Want
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.92)" }}>
                            {selected.motivation || <span className="npc-muted">—</span>}
                          </div>
                        </div>

                        <div className="mb-2">
                          <div className="small" style={{ color: MUTED }}>
                            Personality / Quirk
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.92)" }}>
                            {selected.quirk || <span className="npc-muted">—</span>}
                          </div>
                        </div>

                        <div className="mb-2">
                          <div className="small" style={{ color: MUTED }}>
                            Mannerism / Voice
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.92)" }}>
                            {[selected.mannerism, selected.voice].filter(Boolean).join(" • ") || (
                              <span className="npc-muted">—</span>
                            )}
                          </div>
                        </div>

                        <div className="mb-2">
                          <div className="small" style={{ color: MUTED }}>
                            Secret (optional)
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.92)" }}>
                            {selected.secret || <span className="npc-muted">—</span>}
                          </div>
                        </div>
                      </>
                    )}

                    <hr className="my-3" style={{ borderColor: BORDER }} />

                    {/* Notes */}
                    <div className="fw-semibold mb-2">Notes</div>

                    {!userId ? (
                      <div style={{ color: MUTED }}>Log in to add/view notes.</div>
                    ) : (
                      <>
                        <div className="row g-2 align-items-end mb-2">
                          <div className="col-12 col-md-4">
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
                            <div className="col-12 col-md-8">
                              <div className="d-flex align-items-center gap-3 flex-wrap">
                                <label className="form-check mb-0">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={noteAllPlayers}
                                    onChange={(e) => setNoteAllPlayers(e.target.checked)}
                                  />
                                  <span
                                    className="form-check-label"
                                    style={{ color: "rgba(255,255,255,0.92)" }}
                                  >
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
                                              const has = prev.some((id) => String(id) === String(p.user_id));
                                              if (e.target.checked && !has) return [...prev, p.user_id];
                                              if (!e.target.checked && has)
                                                return prev.filter((id) => String(id) !== String(p.user_id));
                                              return prev;
                                            });
                                          }}
                                        />
                                        <span
                                          className="form-check-label"
                                          style={{ color: "rgba(255,255,255,0.92)" }}
                                        >
                                          {p.name}
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
                                <span className="badge text-bg-dark">
                                  {n.scope === "private" ? "Private" : "Shared"}
                                </span>
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
                  </div>

                  {/* Right: Character sheet */}
                  <div className="col-12 col-xl-7">
                    <div className="fw-semibold mb-2">Character sheet</div>

                    {/* Show last roll result above the sheet */}
                    {lastRoll && (
                      <div
                        className="small mb-2"
                        style={{ color: "rgba(255,255,255,0.92)" }}
                      >
                        <span className="fw-semibold">{lastRoll.label}</span>: d20 {lastRoll.roll} {lastRoll.mod >= 0 ? "+" : "-"} {Math.abs(lastRoll.mod)} = <span className="fw-semibold">{lastRoll.total}</span>
                      </div>
                    )}

                    <CharacterSheetPanel
                      sheet={sheet}
                      draft={sheetDraft}
                      setDraft={setSheetDraft}
                      editMode={sheetEditMode}
                      setEditMode={setSheetEditMode}
                      characterName={selected.name}
                      metaLine={metaLine}
                      editable={isAdmin}
                      canSave={isAdmin}
                      extraDirty={detailsDirty}
                      inventoryHref={inventoryHref || null}
                      inventoryText="Inventory"
                      onSave={async (nextSheet) => {
                        if (!selected) return;

                        const updated_at = new Date().toISOString();

                        // Save narrative fields
                        if (isAdmin && detailsDraft) {
                          if (selected.type === "npc") {
                            const npcPatch = {
                              role: safeStr(detailsDraft.role) || null,
                              affiliation: safeStr(detailsDraft.affiliation) || null,
                              description: safeStr(detailsDraft.description) || null,
                              background: safeStr(detailsDraft.background) || null,
                              motivation: safeStr(detailsDraft.motivation) || null,
                              quirk: safeStr(detailsDraft.quirk) || null,
                              mannerism: safeStr(detailsDraft.mannerism) || null,
                              voice: safeStr(detailsDraft.voice) || null,
                              secret: safeStr(detailsDraft.secret) || null,
                              updated_at,
                            };

                            const upd = await supabase.from("npcs").update(npcPatch).eq("id", selected.id);
                            if (upd.error) throw upd.error;
                          }

                          if (selected.type === "merchant") {
                            const profPatch = {
                              merchant_id: selected.id,
                              role: safeStr(detailsDraft.role) || null,
                              affiliation: safeStr(detailsDraft.affiliation) || null,
                              description: safeStr(detailsDraft.description) || null,
                              background: safeStr(detailsDraft.background) || null,
                              motivation: safeStr(detailsDraft.motivation) || null,
                              quirk: safeStr(detailsDraft.quirk) || null,
                              mannerism: safeStr(detailsDraft.mannerism) || null,
                              voice: safeStr(detailsDraft.voice) || null,
                              secret: safeStr(detailsDraft.secret) || null,
                              sheet: nextSheet || {},
                              updated_at,
                            };

                            const up = await supabase
                              .from("merchant_profiles")
                              .upsert(profPatch, { onConflict: "merchant_id" });
                            if (up.error) throw up.error;
                          }
                        }

                        // Save sheet overlay
                        if (selected.type === "npc") {
                          const up = await supabase
                            .from("npc_sheets")
                            .upsert({ npc_id: selected.id, sheet: nextSheet || {}, updated_at }, { onConflict: "npc_id" });

                          if (up.error && !isSupabaseMissingTable(up.error)) throw up.error;
                        }

                        // Reset dirty baselines immediately to avoid UI flicker
                        setDetailsBase(deepClone(detailsDraft || {}));

                        // Refresh data + displayed sheet
                        await Promise.all([
                          loadNpcs(),
                          loadMerchantProfiles(),
                          loadSelectedSheet(selectedKey),
                        ]);
                      }}
                      onRoll={(r) => setLastRoll(r)}
                    />

                    {/* Roll result moved above the sheet */}

                    <details className="mt-2">
                      <summary className="small" style={{ color: DIM, cursor: "pointer" }}>
                        View raw sheet JSON
                      </summary>
                      <pre
                        className="mt-2 p-2 rounded"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${BORDER}`,
                          color: "rgba(255,255,255,0.88)",
                        }}
                      >
                        {JSON.stringify(sheetDraft || {}, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

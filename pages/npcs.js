// pages\npcs.js
//
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import CharacterSheetPanel from "../components/CharacterSheetPanel";
import { deriveEquippedItemEffects, hashEquippedRowsForKey } from "../utils/equipmentEffects";

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
  const meta = s && typeof s === "object" && s.meta && typeof s.meta === "object" ? s.meta : {};

  const alignment = safeStr(s.alignment ?? meta.alignment);
  if (alignment) parts.push(alignment);

  const className = safeStr(s.className ?? s.class ?? meta.className ?? meta.class);
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

function pickNameFromRow(row) {
  const payload = row?.card_payload || {};
  return safeStr(payload.item_name || payload.name || row?.item_name || row?.name || "");
}

function aggregateItemBonuses(rows) {
  const bonuses = { ac: 0, savesAll: 0, saves: {}, skillsAll: 0, skills: {} };

  for (const row of rows || []) {
    const p = row?.card_payload || {};

    // tolerate a few possible shapes
    const bonusAc = Number(p.bonusAc ?? p.acBonus ?? p.bonus_ac ?? 0) || 0;
    const bonusSavingThrow = Number(p.bonusSavingThrow ?? p.saveBonus ?? p.bonus_saving_throw ?? 0) || 0;

    bonuses.ac += bonusAc;
    bonuses.savesAll += bonusSavingThrow;

    const mods = p.modifiers || {};

    if (mods.saves && typeof mods.saves === "object") {
      for (const k of Object.keys(mods.saves)) {
        const val = Number(mods.saves[k]) || 0;
        if (k === "all") bonuses.savesAll += val;
        else bonuses.saves[k] = (Number(bonuses.saves[k]) || 0) + val;
      }
    }

    if (mods.checks && typeof mods.checks === "object") {
      for (const k of Object.keys(mods.checks)) {
        const val = Number(mods.checks[k]) || 0;
        if (k === "all") bonuses.skillsAll += val;
        else bonuses.skills[k] = (Number(bonuses.skills[k]) || 0) + val;
      }
    }
  }

  return bonuses;
}

function buildEquipmentBreakdown(rows) {
  const out = [];

  for (const row of rows || []) {
    const name = pickNameFromRow(row) || "Unnamed item";
    const p = row?.card_payload || {};
    const parts = [];

    const bonusAc = Number(p.bonusAc ?? p.acBonus ?? p.bonus_ac ?? 0) || 0;
    const bonusSavingThrow = Number(p.bonusSavingThrow ?? p.saveBonus ?? p.bonus_saving_throw ?? 0) || 0;

    if (bonusAc) parts.push(`${bonusAc >= 0 ? "+" : ""}${bonusAc} AC`);
    if (bonusSavingThrow) parts.push(`${bonusSavingThrow >= 0 ? "+" : ""}${bonusSavingThrow} all saves`);

    const mods = p.modifiers || {};

    if (mods.saves && typeof mods.saves === "object") {
      for (const k of Object.keys(mods.saves)) {
        const val = Number(mods.saves[k]) || 0;
        if (!val) continue;
        if (k === "all") parts.push(`${val >= 0 ? "+" : ""}${val} all saves`);
        else parts.push(`${val >= 0 ? "+" : ""}${val} ${k.toUpperCase()} saves`);
      }
    }

    if (mods.checks && typeof mods.checks === "object") {
      for (const k of Object.keys(mods.checks)) {
        const val = Number(mods.checks[k]) || 0;
        if (!val) continue;
        if (k === "all") parts.push(`${val >= 0 ? "+" : ""}${val} all checks`);
        else parts.push(`${val >= 0 ? "+" : ""}${val} ${k} checks`);
      }
    }

    if (parts.length) out.push(`${name}: ${parts.join(", ")}`);
  }

  return out;
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
  const [merchantProfiles, setMerchantProfiles] = useState(new Map());
  const [mapIcons, setMapIcons] = useState([]);
  const [charPerm, setCharPerm] = useState(null);
 // merchant_id -> profile row

  const [selectedKey, setSelectedKey] = useState(null); // "npc:id" or "merchant:uuid"

  // selected sheet + notes
  const [sheet, setSheet] = useState(null);

  // Controlled draft/edit mode
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

  // Equipped items for selected NPC or merchant (display-only overlays)
  const [equippedRows, setEquippedRows] = useState([]);

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

    // Prefer SECURITY DEFINER RPC (works even if user_profiles is RLS-restricted).
    const { data: adminVal, error: adminErr } = await supabase.rpc("is_admin", { uid: user.id });
    if (!adminErr) {
      setIsAdmin(!!adminVal);
      return;
    }

    // Fallback to user_profiles for older DB installs.
    const { data: prof, error: profErr } = await supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
    if (profErr) return setIsAdmin(false);
    setIsAdmin(prof?.role === "admin");
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

  const loadMapIcons = useCallback(async () => {
    const res = await supabase
      .from("map_icons")
      .select("id,name,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    const { data, error } = res;

    if (error) {
      if (!isSupabaseMissingTable(error)) console.error(error);
      setMapIcons([]);
      return;
    }

    setMapIcons(data || []);
  }, []);


  const loadNpcs = useCallback(async () => {
    const res = await supabase
      .from("characters")
      .select(
        [
          "id",
          "name",
          "kind",
          "race",
          "role",
          "affiliation",
          "status",
          "location_id",
          "tags",
          "description",
          "background",
          "motivation",
          "quirk",
          "mannerism",
          "voice",
          "secret",
          "map_icon_id",
          "updated_at",
          "is_hidden",
        ].join(",")
      )
      .eq("kind", "npc")
      .order("name", { ascending: true });

    const { data, error } = res;

    if (error) {
      console.error(error);
      setNpcs([]);
      return;
    }

    const rows = (data || []).map((r) => ({
      ...r,
      status: r.is_hidden ? "hidden" : r.status || "alive",
    }));

    setNpcs(rows);
  }, []);

  const loadMerchants = useCallback(async () => {
    const res = await supabase
      .from("characters")
      .select(
        [
          "id",
          "name",
          "kind",
          "location_id",
          "last_known_location_id",
          "state",
          "route_mode",
          "status",
          "storefront_enabled",
          "map_icon_id",
          "is_hidden",
          "updated_at",
        ].join(",")
      )
      .eq("kind", "merchant")
      .order("updated_at", { ascending: false });

    const { data, error } = res;

    if (error) {
      console.error(error);
      setMerchants([]);
      return;
    }

    const rows = (data || []).map((r) => ({
      ...r,
      status: r.is_hidden ? "hidden" : r.status || "alive",
    }));

    setMerchants(rows);
  }, []);

  const loadMerchantProfiles = useCallback(async () => {
    const res = await supabase
      .from("characters")
      .select(
        [
          "id",
          "race",
          "role",
          "affiliation",
          "description",
          "background",
          "motivation",
          "quirk",
          "mannerism",
          "voice",
          "secret",
          "tags",
          "status",
          "updated_at",
        ].join(",")
      )
      .eq("kind", "merchant");

    const { data, error } = res;

    if (error) {
      console.error(error);
      setMerchantProfiles(new Map());
      return;
    }

    const m = new Map();
    for (const row of data || []) {
      m.set(String(row.id), row);
    }
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
        map_icon_id: n.map_icon_id ?? null,
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
        map_icon_id: m.map_icon_id ?? null,
        merchant_state: m.state || null,
        merchant_route_mode: m.route_mode || null,
        storefront_enabled: !!m.storefront_enabled,
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

  // Resolve the selected character's map icon record (for showing next to the name).
  const selectedMapIcon = useMemo(() => {
    if (!selected?.map_icon_id) return null;
    return (mapIcons || []).find((mi) => String(mi.id) === String(selected.map_icon_id)) || null;
  }, [selected?.map_icon_id, mapIcons]);

  // Load character-level permissions for non-admins (enables store toggle, editing, conversions)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setCharPerm(null);
      if (!userId || !selected?.id) return;
      if (isAdmin) {
        if (!cancelled) setCharPerm({ can_inventory: true, can_edit: true, can_convert: true });
        return;
      }

      const { data, error } = await supabase
        .from("character_permissions")
        .select("can_inventory,can_edit,can_convert")
        .eq("character_id", selected.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error(error);
        setCharPerm(null);
        return;
      }
      setCharPerm(data || null);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, isAdmin, selected?.id]);

  /* ------------------- sheet + notes loaders ------------------- */
  const loadSelectedSheet = useCallback(async (key) => {
    if (!key) return;

    const parsed = parseKey(key);
    const id = parsed?.id || null;
    if (!id) return;

    const res = await supabase.from("character_sheets").select("sheet").eq("character_id", id).maybeSingle();

    const { data, error } = res;

    if (error) {
      if (!isSupabaseMissingTable(error)) console.error(error);
    }

    const next = data?.sheet || {};
    setSheet(next);
    setSheetDraft(deepClone(next));
    setSheetEditMode(false);
  }, []);

  // Load equipped items for NPC/merchant when selection changes
  useEffect(() => {
    async function loadEquipped() {
      if (!selectedKey) {
        setEquippedRows([]);
        return;
      }

      const { type, id } = parseKey(selectedKey);
      if (!type || !id) {
        setEquippedRows([]);
        return;
      }

      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("owner_type", type)
        .eq("owner_id", id)
        .eq("is_equipped", true)
        .order("updated_at", { ascending: false });

      if (!error) setEquippedRows(data || []);
      else setEquippedRows([]);
    }

    loadEquipped();
  }, [selectedKey]);

  const equippedEquipmentText = useMemo(() => {
    return (equippedRows || [])
      .map((row) => pickNameFromRow(row))
      .filter(Boolean)
      .join("\n");
  }, [equippedRows]);

  const { effects: equippedEffects, breakdown: equippedBreakdown } = useMemo(() => deriveEquippedItemEffects(equippedRows), [equippedRows]);

  const effectsKey = useMemo(() => {
    return `${selectedKey || ""}|${hashEquippedRowsForKey(equippedRows)}`;
  }, [selectedKey, equippedRows]);

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
      if (!key) {
        setNotes([]);
        return;
      }
      if (!notesEnabled) return;

      const parsed = parseKey(key);
      const id = parsed?.id || null;

      if (!id) {
        setNotes([]);
        return;
      }

      const res = await supabase
        .from("character_notes")
        .select("id,character_id,author_user_id,scope,visible_to_user_ids,body,created_at")
        .eq("character_id", id)
        .order("updated_at", { ascending: false });

      if (res.error) {
        if (isSupabaseMissingTable(res.error)) {
          setNotesEnabled(false);
          setNotes([]);
          return;
        }
        console.error(res.error);
        setNotes([]);
        return;
      }

      setNotes(res.data || []);
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
      await Promise.all([loadPlayers(), loadLocations(), loadMapIcons(), loadNpcs(), loadMerchants(), loadMerchantProfiles()]);
      setLoading(false);
    })();
  }, [loadAuth, loadPlayers, loadLocations, loadNpcs, loadMerchants, loadMerchantProfiles]);

  /* pick default selection once roster exists */
  useEffect(() => {
    if (selectedKey) return;
    if (!roster.length) return;

    try {
      const sp = new URLSearchParams(window.location.search);
      const focusRaw = sp.get("focus");

      if (focusRaw) {
        // accept both: "npc:<id>" / "merchant:<id>" / "<npcId>"
        const focusKey = focusRaw.includes(":") ? focusRaw : `npc:${focusRaw}`;
        const { type, id } = parseKey(focusKey);

        const exists = roster.find((r) => r.type === type && String(r.id) === String(id));
        if (exists) {
          setSelectedKey(keyOf(type, id));
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
    if (!selected || !noteBody.trim()) return;

    const updated_at = new Date().toISOString();

    const payload = {
      character_id: selected.id,
      author_user_id: userId || null,
      scope: noteScope,
      visible_to_user_ids: noteScope === "shared" ? (noteAllPlayers ? null : noteVisibleTo) : null,
      body: noteBody.trim(),
      created_at: updated_at,
      updated_at,
    };

    const res = await supabase.from("character_notes").insert(payload);

    if (res.error) {
      if (isSupabaseMissingTable(res.error)) {
        setNotesEnabled(false);
        return;
      }
      console.error(res.error);
      alert(res.error.message || "Failed to add note");
      return;
    }

    setNoteBody("");
    setNoteVisibleTo([]);
    setNoteAllPlayers(true);

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

  const canEditCharacter = !!isAdmin || !!charPerm?.can_edit;
  const canStoreToggle = !!isAdmin || !!charPerm?.can_inventory || !!charPerm?.can_edit;
  const canConvertKind = !!isAdmin || !!charPerm?.can_convert;
  const canEditNarrative = canEditCharacter && !!sheetEditMode;

  const details = detailsDraft || {};
  const detailsDirty = !jsonEqual(detailsDraft, detailsBase);

  const roleText = canEditNarrative ? details.role : safeStr(selected?.role);
  const affiliationText = canEditNarrative ? details.affiliation : safeStr(selected?.affiliation);

  const backgroundText = canEditNarrative ? details.background : safeStr(selected?.background || sheetDraft?.background || "");
  const descriptionText = canEditNarrative ? details.description : safeStr(selected?.description || "");

  const personality = sheetDraft && typeof sheetDraft === "object" && sheetDraft.personality ? sheetDraft.personality : {};
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
                        {r.type === "merchant" && r.storefront_enabled && (
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
                  <div style={{ minWidth: 0 }}>
                    <div className="h5 mb-1">{selected.name}</div>
                    <div className="small npc-muted" style={{ minWidth: 0 }}>
                      {[selected.type === "npc" ? selected.race : null, roleText, affiliationText].filter(Boolean).join(" • ") || "—"}
                      {selected.location_id ? (
                        <>
                          {" "}
                          •{" "}
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
                          <input className="form-control form-control-sm" value={details.role || ""} onChange={(e) => setDetailsField("role", e.target.value)} />
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
                  {/* Left */}
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
                          <input className="form-control form-control-sm" value={details.motivation || ""} onChange={(e) => setDetailsField("motivation", e.target.value)} />
                        </div>
                        <div className="col-12">
                          <div className="small" style={{ color: MUTED }}>
                            Personality / Quirk
                          </div>
                          <input className="form-control form-control-sm" value={details.quirk || ""} onChange={(e) => setDetailsField("quirk", e.target.value)} />
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
                          <input className="form-control form-control-sm" value={details.voice || ""} onChange={(e) => setDetailsField("voice", e.target.value)} />
                        </div>
                        <div className="col-12">
                          <div className="small" style={{ color: MUTED }}>
                            Secret (optional)
                          </div>
                          <input className="form-control form-control-sm" value={details.secret || ""} onChange={(e) => setDetailsField("secret", e.target.value)} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-2">
                          <div className="small" style={{ color: MUTED }}>
                            Motivation / Want
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.92)" }}>{selected.motivation || <span className="npc-muted">—</span>}</div>
                        </div>

                        <div className="mb-2">
                          <div className="small" style={{ color: MUTED }}>
                            Personality / Quirk
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.92)" }}>{selected.quirk || <span className="npc-muted">—</span>}</div>
                        </div>

                        <div className="mb-2">
                          <div className="small" style={{ color: MUTED }}>
                            Mannerism / Voice
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.92)" }}>
                            {[selected.mannerism, selected.voice].filter(Boolean).join(" • ") || <span className="npc-muted">—</span>}
                          </div>
                        </div>

                        <div className="mb-2">
                          <div className="small" style={{ color: MUTED }}>
                            Secret (optional)
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.92)" }}>{selected.secret || <span className="npc-muted">—</span>}</div>
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
                            <select className="form-select form-select-sm" value={noteScope} onChange={(e) => setNoteScope(e.target.value)}>
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
                                              const has = prev.some((id) => String(id) === String(p.user_id));
                                              if (e.target.checked && !has) return [...prev, p.user_id];
                                              if (!e.target.checked && has) return prev.filter((id) => String(id) !== String(p.user_id));
                                              return prev;
                                            });
                                          }}
                                        />
                                        <span className="form-check-label" style={{ color: "rgba(255,255,255,0.92)" }}>
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
                  </div>

                  {/* Right: Character sheet */}
                  <div className="col-12 col-xl-7">
                    <div className="fw-semibold mb-2">Character sheet</div>

                    {lastRoll && (
                      <div className="small mb-2" style={{ color: "rgba(255,255,255,0.92)" }}>
                        <span className="fw-semibold">{lastRoll.label}</span>:
                        {Array.isArray(lastRoll.rolls) && lastRoll.rolls.length === 2 && lastRoll.mode && lastRoll.mode !== "normal" ? (
                          <>
                            d20 ({lastRoll.mode === "adv" ? "adv" : "dis"}) [{lastRoll.rolls[0]}, {lastRoll.rolls[1]}] → {lastRoll.roll} {lastRoll.mod >= 0 ? "+" : "-"}{" "}
                            {Math.abs(lastRoll.mod)} = <span className="fw-semibold">{lastRoll.total}</span>
                          </>
                        ) : (
                          <>
                            d20 {lastRoll.roll} {lastRoll.mod >= 0 ? "+" : "-"}{" "}
                            {Math.abs(lastRoll.mod)} = <span className="fw-semibold">{lastRoll.total}</span>
                          </>
                        )}
                      </div>
                    )}

                    <CharacterSheetPanel
                      sheet={sheet}
                      draft={sheetDraft}
                      setDraft={setSheetDraft}
                      editMode={sheetEditMode}
                      setEditMode={setSheetEditMode}
                      characterName={
                        <span className="d-inline-flex align-items-center gap-2 flex-wrap">
                          <span>{selected.name}</span>
                          <span
                            className={`badge rounded-pill border ${
                              selectedMapIcon?.name ? "text-bg-dark" : "text-bg-secondary opacity-75"
                            }`}
                            title={
                              selectedMapIcon?.name
                                ? `Map icon: ${selectedMapIcon.name}`
                                : "No map icon selected (click Edit to choose)"
                            }
                            style={{ fontWeight: 500 }}
                          >
                            <span aria-hidden="true" className="me-1">
                              📍
                            </span>
                            {selectedMapIcon?.name || "Choose icon"}
                          </span>
                        </span>
                      }
                      nameRight={(
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <select
                            className="form-select form-select-sm"
                            style={{ width: 170 }}
                            value={selected?.map_icon_id || ""}
                            disabled={!canEditCharacter}
                            onChange={async (e) => {
                              const prev = selected?.map_icon_id || null;
                              const next = e.target.value || null;

                              // Optimistic UI update so the selection doesn't snap back while the
                              // network call and roster reload complete.
                              const patchLocal = (val) => {
                                setNpcs((arr) =>
                                  (arr || []).map((c) =>
                                    String(c.id) === String(selected.id) ? { ...c, map_icon_id: val } : c
                                  )
                                );
                                setMerchants((arr) =>
                                  (arr || []).map((c) =>
                                    String(c.id) === String(selected.id) ? { ...c, map_icon_id: val } : c
                                  )
                                );
                              };
                              patchLocal(next);
                              const upd = await supabase
                                .from("characters")
                                .update({ map_icon_id: next, updated_at: new Date().toISOString() })
                                .eq("id", selected.id);
                              if (upd.error) {
                                console.error(upd.error);
                                patchLocal(prev);
                                alert(upd.error.message || "Failed to save icon");
                                return;
                              }
                              await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles()]);
                            }}
                            title="Map icon"
                          >
                            <option value="">Map icon…</option>
                            {(mapIcons || []).map((ic) => (
                              <option key={ic.id} value={ic.id}>
                                {ic.name}
                              </option>
                            ))}
                          </select>

                          {selected?.type === "merchant" ? (
                            <div className="form-check form-switch m-0" title="Storefront enabled">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={!!selected?.storefront_enabled}
                                disabled={!canStoreToggle}
                                onChange={async (e) => {
                                  const next = !!e.target.checked;
                                  const upd = await supabase
                                    .from("characters")
                                    .update({ storefront_enabled: next, updated_at: new Date().toISOString() })
                                    .eq("id", selected.id);
                                  if (upd.error) {
                                    console.error(upd.error);
                                    alert(upd.error.message || "Failed to update storefront");
                                    return;
                                  }
                                  await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles()]);
                                }}
                              />
                              <label className="form-check-label" style={{ color: "rgba(255,255,255,0.85)" }}>
                                Store
                              </label>
                            </div>
                          ) : null}

                          {canConvertKind ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-warning"
                              onClick={async () => {
                                const target = selected?.type === "merchant" ? "npc" : "merchant";
                                const ok = window.confirm(`Convert ${selected?.name || "character"} to ${target}?`);
                                if (!ok) return;

                                let rpcErr = null;
                                try {
                                  const r = await supabase.rpc("set_character_kind", {
                                    p_character_id: selected.id,
                                    p_target: target,
                                  });
                                  if (r.error) rpcErr = r.error;
                                } catch (e2) {
                                  rpcErr = e2;
                                }

                                if (rpcErr) {
                                  // fallback: basic kind update
                                  const upd = await supabase
                                    .from("characters")
                                    .update({ kind: target, storefront_enabled: target === "merchant" ? true : false, updated_at: new Date().toISOString() })
                                    .eq("id", selected.id);
                                  if (upd.error) {
                                    console.error(upd.error);
                                    alert(upd.error.message || "Conversion failed");
                                    return;
                                  }
                                }

                                await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles()]);
                                setSelectedKey(`${target}:${selected.id}`);
                              }}
                            >
                              {selected?.type === "merchant" ? "To NPC" : "To Merchant"}
                            </button>
                          ) : null}
                        </div>
                      )}
                      metaLine={metaLine}
                      editable={canEditCharacter}
                      canSave={canEditCharacter}
                      extraDirty={detailsDirty}
                      inventoryHref={inventoryHref || null}
                      inventoryText="Inventory"
                      // Merchants have storefronts. (NPCs without a merchant record do not.)
                      storeHref={selected?.type === "merchant" && selected?.id && selected?.storefront_enabled ? `/map?merchant=${selected.id}` : null}
                      itemBonuses={equippedEffects}
                      equipmentOverride={equippedEquipmentText || null}
                      equipmentBreakdown={equippedBreakdown}
                      effectsKey={effectsKey}
                      onSave={async (nextSheet) => {
                        if (!selected) return;

                        const updated_at = new Date().toISOString();

                        // Save narrative fields
                        if (canEditCharacter && detailsDraft) {
                          const patch = {
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

                          const upd = await supabase.from("characters").update(patch).eq("id", selected.id);
                          if (upd.error) throw upd.error;
                        }

                        // Save sheet overlay
                        const up = await supabase
                          .from("character_sheets")
                          .upsert({ character_id: selected.id, sheet: nextSheet || {}, updated_at }, { onConflict: "character_id" });

                        if (up.error && !isSupabaseMissingTable(up.error)) throw up.error;

                        setDetailsBase(deepClone(detailsDraft || {}));

                        await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles(), loadSelectedSheet(selectedKey)]);
                      }}
                      onRoll={(r) => setLastRoll(r)}
                    />

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

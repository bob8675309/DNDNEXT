//  pages\npcs.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import CharacterSheetPanel from "../components/CharacterSheetPanel";
import { deriveEquippedItemEffects, hashEquippedRowsForKey } from "../utils/equipmentEffects";
import MapIconPicker from "../components/MapIconPicker";
import KindPicker from "../components/KindPicker";
import { MAP_ICONS_BUCKET, LOCAL_FALLBACK_ICON, mapIconDisplay } from "../utils/mapIcons";

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
    // Include x/y so NPCs/merchants can be placed at a location immediately when toggled onto the map.
    const res = await supabase.from("locations").select("id,name,x,y").order("id");
    if (!res.error) setLocations(res.data || []);
  }, []);

  const loadMapIcons = useCallback(async () => {
    // Prefer the expanded shape (Option 2) but gracefully fall back if columns are missing.
    let res = await supabase
      .from("map_icons")
      .select("id,name,is_active,sort_order,category,storage_path,metadata")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (res.error && (res.error.code === "42703" || String(res.error.message || "").includes("metadata"))) {
      res = await supabase
        .from("map_icons")
        .select("id,name,is_active,sort_order,category,storage_path")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
    }

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
          "x",
          "y",
          "roaming_speed",
          "last_known_location_id",
          "projected_destination_id",
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
          "projected_destination_id",
          "x",
          "y",
          "roaming_speed",
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
        kind: n.kind || "npc",
        race: n.race,
        role: n.role,
        affiliation: n.affiliation,
        status: n.status || "alive",
        location_id: n.location_id ?? null,
        last_known_location_id: n.last_known_location_id ?? null,
        projected_destination_id: n.projected_destination_id ?? null,
        map_icon_id: n.map_icon_id ?? null,
        is_hidden: !!n.is_hidden,
        x: typeof n.x === "number" ? n.x : Number(n.x) || 0,
        y: typeof n.y === "number" ? n.y : Number(n.y) || 0,
        roaming_speed: typeof n.roaming_speed === "number" ? n.roaming_speed : Number(n.roaming_speed) || 0,
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
        kind: m.kind || "merchant",
        race: prof.race || null,
        role: prof.role || "Merchant",
        affiliation: prof.affiliation || null,
        status: prof.status || (m.is_hidden ? "hidden" : "alive"),
        location_id: m.location_id ?? m.last_known_location_id ?? null,
        last_known_location_id: m.last_known_location_id ?? null,
        projected_destination_id: m.projected_destination_id ?? null,
        map_icon_id: m.map_icon_id ?? null,
        merchant_state: m.state || null,
        merchant_route_mode: m.route_mode || null,
        storefront_enabled: !!m.storefront_enabled,
        is_hidden: !!m.is_hidden,
        x: typeof m.x === "number" ? m.x : Number(m.x) || 0,
        y: typeof m.y === "number" ? m.y : Number(m.y) || 0,
        roaming_speed: typeof m.roaming_speed === "number" ? m.roaming_speed : Number(m.roaming_speed) || 0,
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

  const selectedLocation = useMemo(() => {
    if (!selected?.location_id) return null;
    return (locations || []).find((l) => String(l.id) === String(selected.location_id)) || null;
  }, [selected?.location_id, locations]);

  const isListedAtLocation = useMemo(() => {
    if (!selectedLocation || !selected?.id) return false;
    const arr = Array.isArray(selectedLocation.npcs) ? selectedLocation.npcs : [];
    return arr.some((x) => String(x && typeof x === "object" ? x.id : x) === String(selected.id));
  }, [selectedLocation, selected?.id]);


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
    let cancelled = false;

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
      const ownerId = String(id);

      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("owner_type", type)
        .eq("owner_id", ownerId)
        .eq("is_equipped", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (!error) setEquippedRows(data || []);
      else setEquippedRows([]);
    }

    loadEquipped();
    return () => {
      cancelled = true;
    };
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


  const panelHeight = { height: "calc(100vh - 170px)" };

  const canEditCharacter = !!isAdmin || !!charPerm?.can_edit;
  const canStoreToggle = !!isAdmin || !!charPerm?.can_inventory || !!charPerm?.can_edit;
  const canConvertKind = !!isAdmin || !!charPerm?.can_convert;
  const canEditNarrative = canEditCharacter && !!sheetEditMode;

  // Location assignment lives in the sheet header (next to the map toggle).
  // This keeps "list at location" semantics unified for both NPCs and merchants.
  const setCharacterLocation = useCallback(
    async (nextLocIdRaw) => {
      if (!selected?.id) return;
      if (!canEditCharacter) return;

      const nextLocId = nextLocIdRaw ? String(nextLocIdRaw) : null;
      const prevLocId = selected?.location_id ? String(selected.location_id) : null;

      if (nextLocId === prevLocId) return;

      const idStr = String(selected.id);

      // Helper: normalize an entry (string | {id,type} | {id}) to string id
      const entryId = (x) => String(x && typeof x === "object" ? x.id : x);
      const makeEntry = () => ({ id: idStr, type: selected.type || "npc" });

      // Optimistic local update for the character.
      const applyCharLocal = (locId, extra = null) => {
        const upd = (arr) => (arr || []).map((c) => (String(c.id) === idStr ? { ...c, location_id: locId, is_hidden: true, ...(extra || {}) } : c));
        if (selected.type === "merchant") setMerchants(upd);
        else setNpcs(upd);
      };

      // Optimistic local update for locations.npcs arrays.
      const applyLocLocal = (locId, fn) => {
        if (!locId) return;
        setLocations((prev) => (prev || []).map((l) => (String(l.id) === String(locId) ? { ...l, npcs: fn(Array.isArray(l.npcs) ? l.npcs : []) } : l)));
      };

      // Compute next location rosters (so we can persist without relying on async state updates).
      const prevLoc = prevLocId ? (locations || []).find((l) => String(l.id) === String(prevLocId)) || null : null;
      const nextLoc = nextLocId ? (locations || []).find((l) => String(l.id) === String(nextLocId)) || null : null;

      const prevArr = Array.isArray(prevLoc?.npcs) ? prevLoc.npcs : [];
      const nextArr = Array.isArray(nextLoc?.npcs) ? nextLoc.npcs : [];

      const nextPrevArr = prevLocId ? prevArr.filter((x) => entryId(x) !== idStr) : null;
      const nextNextArr = nextLocId ? (nextArr.some((x) => entryId(x) === idStr) ? nextArr : [...nextArr, makeEntry()]) : null;

      // Optimistic local location updates.
      if (prevLocId) applyLocLocal(prevLocId, () => nextPrevArr);
      if (nextLocId) applyLocLocal(nextLocId, () => nextNextArr);

      // If the pin hasn't been positioned yet, snap it to the location when a location is selected.
      // Snap pins to the new location if they haven't been placed yet.
      const xNum = Number(selected?.x);
      const yNum = Number(selected?.y);
      const hasPos = Number.isFinite(xNum) && Number.isFinite(yNum) && !(xNum === 0 && yNum === 0);

      const patch = {
        location_id: nextLocId,
        is_hidden: true,
      };

      if (!hasPos && nextLoc && Number.isFinite(Number(nextLoc.x)) && Number.isFinite(Number(nextLoc.y))) {
        patch.x = Number(nextLoc.x);
        patch.y = Number(nextLoc.y);
        applyCharLocal(nextLocId, { x: patch.x, y: patch.y });
      } else {
        applyCharLocal(nextLocId, null);
      }

      // Persist character.
      const updChar = await supabase.from("characters").update(patch).eq("id", selected.id);
      if (updChar.error) {
        console.error(updChar.error);
        alert(updChar.error.message || "Failed to update location");
        // Best-effort reload to restore consistent state.
        await Promise.all([loadLocations(), loadNpcs(), loadMerchants(), loadMerchantProfiles()]);
        return;
      }

      // Persist locations list changes (best effort, sequential to avoid overwriting).
      try {
        if (prevLocId) {
          const resPrev = await supabase.from("locations").update({ npcs: nextPrevArr }).eq("id", prevLocId);
          if (resPrev.error) throw resPrev.error;
        }
        if (nextLocId) {
          const resNext = await supabase.from("locations").update({ npcs: nextNextArr }).eq("id", nextLocId);
          if (resNext.error) throw resNext.error;
        }
      } catch (e) {
        console.error(e);
        alert(e?.message || "Location list updated, but saving the location roster failed. Reloading to recover.");
        await loadLocations();
      }
    },
    [selected, canEditCharacter, locations]
  );

  // Hard delete: remove character row + all related data. Admin-only by policy.
  const hardDeleteSelectedCharacter = useCallback(async () => {
    if (!selected?.id) return;
    if (!canEditCharacter) return;

    const idStr = String(selected.id);
    const kind = selected?.type === "merchant" ? "merchant" : "npc";

    const ok = window.confirm(
      `Permanently delete ${selected.name || "this character"}? This cannot be undone.`
    );
    if (!ok) return;

    // Remove from any location rosters that contain this id.
    const locs = Array.isArray(locations) ? locations : [];
    const entryId = (x) => String(x && typeof x === "object" ? x.id : x);
    const touched = locs.filter((l) => Array.isArray(l.npcs) && l.npcs.some((x) => entryId(x) === idStr));

    try {
      for (const l of touched) {
        const nextArr = (Array.isArray(l.npcs) ? l.npcs : []).filter((x) => entryId(x) !== idStr);
        const res = await supabase.from("locations").update({ npcs: nextArr }).eq("id", l.id);
        if (res.error) throw res.error;
      }
    } catch (e) {
      console.error(e);
      // Continue deletion even if roster cleanup fails; we'll reload afterwards.
    }

    // Delete inventory rows owned by this character.
    try {
      const invDel = await supabase
        .from("inventory_items")
        .delete()
        .eq("owner_type", kind)
        .eq("owner_id", idStr);
      if (invDel.error) throw invDel.error;
    } catch (e) {
      console.error(e);
    }

    // Best-effort cleanup of auxiliary character tables.
    const bestEffortDeletes = [
      "character_stock",
      "character_sheets",
      "character_notes",
      "character_permissions",
    ];
    for (const t of bestEffortDeletes) {
      try {
        const r = await supabase.from(t).delete().eq("character_id", idStr);
        // Ignore missing-table errors (some deployments may not have every table).
        if (r.error && !isSupabaseMissingTable(r.error)) {
          console.error(r.error);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Delete the character row.
    const del = await supabase.from("characters").delete().eq("id", idStr);
    if (del.error) {
      console.error(del.error);
      alert(del.error.message || "Failed to delete character");
      return;
    }

    // Local state cleanup (optimistic) + reload for safety.
    setNpcs((arr) => (arr || []).filter((c) => String(c.id) !== idStr));
    setMerchants((arr) => (arr || []).filter((c) => String(c.id) !== idStr));
    setMerchantProfiles((prev) => {
      const next = new Map(prev || []);
      next.delete(idStr);
      return next;
    });
    setSelectedKey(null);
    setSheet({});
    setSheetDraft({});
    setDetailsDraft(null);
    setDetailsDirty(false);

    await Promise.all([loadLocations(), loadNpcs(), loadMerchants(), loadMerchantProfiles()]);
  }, [selected, canEditCharacter, locations]);

  const toggleMapVisibility = useCallback(async () => {
    if (!selected?.id) return;
    if (!canEditCharacter) return;

    const nextHidden = !Boolean(selected.is_hidden);

    // When placing a character on the map for the first time, default the pin to the character's current location.
    const patch = { is_hidden: nextHidden };
    if (!nextHidden) {
      const xNum = Number(selected.x);
      const yNum = Number(selected.y);
      const hasPos = Number.isFinite(xNum) && Number.isFinite(yNum) && !(xNum === 0 && yNum === 0);

      if (!hasPos && selectedLocation && Number.isFinite(Number(selectedLocation.x)) && Number.isFinite(Number(selectedLocation.y))) {
        patch.x = Number(selectedLocation.x);
        patch.y = Number(selectedLocation.y);
      }
    }

    // Optimistic local update
    const applyLocal = (valHidden, patchPos) => {
      const upd = (arr) =>
        (arr || []).map((c) => (String(c.id) === String(selected.id) ? { ...c, is_hidden: valHidden, ...(patchPos || {}) } : c));
      if (selected.type === "merchant") setMerchants(upd);
      else setNpcs(upd);
    };

    applyLocal(nextHidden, { x: patch.x, y: patch.y });

    const { error } = await supabase.from("characters").update(patch).eq("id", selected.id);
    if (error) {
      alert(error.message);
      // revert
      applyLocal(!nextHidden, null);
    }
  }, [selected, selectedLocation, canEditCharacter]);

  const toggleLocationListing = useCallback(async () => {
    if (!selected?.id) return;
    if (!canEditCharacter) return;
    if (!selectedLocation?.id) {
      alert("Set a location first (or pick a location in edit mode).");
      return;
    }

    const arr = Array.isArray(selectedLocation.npcs) ? selectedLocation.npcs : [];
    const already = arr.some((x) => String(x && typeof x === "object" ? x.id : x) === String(selected.id));
    const next = already
      ? arr.filter((x) => String(x && typeof x === "object" ? x.id : x) !== String(selected.id))
      : [...arr, String(selected.id)];

    // optimistic
    setLocations((prev) => (prev || []).map((l) => (String(l.id) === String(selectedLocation.id) ? { ...l, npcs: next } : l)));

    const { error } = await supabase.from("locations").update({ npcs: next }).eq("id", selectedLocation.id);
    if (error) {
      alert(error.message);
      // revert
      setLocations((prev) => (prev || []).map((l) => (String(l.id) === String(selectedLocation.id) ? { ...l, npcs: arr } : l)));
    }
  }, [selected, selectedLocation, canEditCharacter]);

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
                // Roster badge rule:
                // - If the character is NOT assigned to a location AND is NOT on the map, show "hidden".
                // - Otherwise show "alive".
                // "On Map" is represented by is_hidden === false.
                const isOnMap = r.is_hidden === false;
                const hasLocation = !!r.location_id;
                const status = !hasLocation && !isOnMap ? "hidden" : "alive";

                const badgeClass = status === "alive" ? "text-bg-success" : "text-bg-dark";

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
                        (() => {
                          const disp = selected?.map_icon_id && selectedMapIcon ? mapIconDisplay(selectedMapIcon, { bucket: MAP_ICONS_BUCKET, fallbackSrc: LOCAL_FALLBACK_ICON }) : { type: "emoji", emoji: "📍" };
                          return (
                            <span className="d-inline-flex align-items-center gap-2 flex-wrap">
                              <span
                                className="mi-name-icon"
                                title={selectedMapIcon?.name ? `Map icon: ${selectedMapIcon.name}` : "No map icon selected"}
                              >
                                {disp?.type === "emoji" ? (
                                  <span aria-hidden="true">{disp.emoji}</span>
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={disp?.src || LOCAL_FALLBACK_ICON}
                                    alt=""
                                    width={18}
                                    height={18}
                                    onError={(e) => {
                                      if (e?.currentTarget && e.currentTarget.src !== LOCAL_FALLBACK_ICON) {
                                        e.currentTarget.src = LOCAL_FALLBACK_ICON;
                                      }
                                    }}
                                  />
                                )}
                              </span>
                              <span>{selected.name}</span>
                            </span>
                          );
                        })()
                      }
                      nameRight={sheetEditMode ? (
                        <div className="d-flex align-items-center gap-2 flex-wrap">

                          {/* On Map / Off Map toggle (admin/editor only). */}
                          {canEditCharacter && selected?.id ? (
                            <button
                              type="button"
                              className={`btn btn-sm ${selected?.is_hidden ? "btn-secondary" : "btn-success"}`}
                              onClick={toggleMapVisibility}
                              title={selected?.is_hidden ? "Show on map" : "Hide from map"}
                            >
                              {selected?.is_hidden ? "Off Map" : "On Map"}
                            </button>
                          ) : null}
                          
                          <MapIconPicker
                            icons={mapIcons}
                            value={selected?.map_icon_id || null}
                            disabled={!canEditCharacter}
                            onChange={async (next) => {
                              const prev = selected?.map_icon_id || null;

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
                          />


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
                            <KindPicker
                              value={selected?.type || "npc"}
                              disabled={!canConvertKind}
                              onChange={async (target) => {
                                if (!selected?.id) return;
                                if (target !== "npc" && target !== "merchant") return;
                                if (target === selected?.type) return;

                                const idStr = String(selected.id);
                                const nowISO = new Date().toISOString();

                                // --- optimistic local move so the UI updates immediately ---
                                if (target === "merchant") {
                                  setNpcs((arr) => (arr || []).filter((c) => String(c.id) !== idStr));
                                  setMerchants((arr) => {
                                    const without = (arr || []).filter((c) => String(c.id) !== idStr);
                                    return [
                                      ...without,
                                      {
                                        id: selected.id,
                                        name: selected.name,
                                        kind: "merchant",
                                        location_id: selected.location_id ?? null,
                                        last_known_location_id: selected.last_known_location_id ?? selected.location_id ?? null,
                                        projected_destination_id: selected.projected_destination_id ?? null,
                                        x: selected.x ?? 0,
                                        y: selected.y ?? 0,
                                        roaming_speed: selected.roaming_speed ?? 0,
                                        state: selected.merchant_state ?? null,
                                        route_mode: selected.merchant_route_mode ?? null,
                                        status: selected.status ?? "alive",
                                        storefront_enabled: true,
                                        map_icon_id: selected.map_icon_id ?? null,
                                        is_hidden: !!selected.is_hidden,
                                        updated_at: nowISO,
                                      },
                                    ];
                                  });
                                  setMerchantProfiles((prev) => {
                                    const next = new Map(prev || []);
                                    next.set(idStr, {
                                      id: selected.id,
                                      race: selected.race || null,
                                      role: selected.role || null,
                                      affiliation: selected.affiliation || null,
                                      description: selected.description || null,
                                      background: selected.background || null,
                                      motivation: selected.motivation || null,
                                      quirk: selected.quirk || null,
                                      mannerism: selected.mannerism || null,
                                      voice: selected.voice || null,
                                      secret: selected.secret || null,
                                      tags: Array.isArray(selected.tags) ? selected.tags : [],
                                      status: selected.status || "alive",
                                      updated_at: nowISO,
                                    });
                                    return next;
                                  });
                                } else {
                                  // target === "npc"
                                  setMerchants((arr) => (arr || []).filter((c) => String(c.id) !== idStr));
                                  setNpcs((arr) => {
                                    const without = (arr || []).filter((c) => String(c.id) !== idStr);
                                    return [
                                      ...without,
                                      {
                                        id: selected.id,
                                        name: selected.name,
                                        kind: "npc",
                                        race: selected.race || null,
                                        role: selected.role || null,
                                        affiliation: selected.affiliation || null,
                                        status: selected.status || "alive",
                                        location_id: selected.location_id ?? null,
                                        last_known_location_id: selected.last_known_location_id ?? null,
                                        projected_destination_id: selected.projected_destination_id ?? null,
                                        map_icon_id: selected.map_icon_id ?? null,
                                        is_hidden: !!selected.is_hidden,
                                        x: selected.x ?? 0,
                                        y: selected.y ?? 0,
                                        roaming_speed: selected.roaming_speed ?? 0,
                                        tags: Array.isArray(selected.tags) ? selected.tags : [],
                                        description: selected.description || null,
                                        background: selected.background || null,
                                        motivation: selected.motivation || null,
                                        quirk: selected.quirk || null,
                                        mannerism: selected.mannerism || null,
                                        voice: selected.voice || null,
                                        secret: selected.secret || null,
                                        updated_at: nowISO,
                                      },
                                    ];
                                  });
                                  setMerchantProfiles((prev) => {
                                    const next = new Map(prev || []);
                                    next.delete(idStr);
                                    return next;
                                  });
                                }

                                // Update the focused entity immediately.
                                setSelectedKey(`${target}:${selected.id}`);

                                // --- server-side conversion ---
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
                                    .update({
                                      kind: target,
                                      storefront_enabled: target === "merchant" ? true : false,
                                      updated_at: nowISO,
                                    })
                                    .eq("id", selected.id);

                                  if (upd.error) {
                                    console.error(upd.error);
                                    alert(upd.error.message || "Conversion failed");
                                    await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles()]);
                                    return;
                                  }
                                }

                                // Reconcile with the DB.
                                await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles()]);
                              }}
                            />
                          ) : null}
                        </div>
                      ) : null}
                      metaLine={metaLine}
                      editable={canEditCharacter}
                      canSave={canEditCharacter}
                      extraDirty={detailsDirty}
                      inventoryHref={inventoryHref || null}
                      inventoryText="Inventory"
                      onDelete={isAdmin ? hardDeleteSelectedCharacter : null}
                      deleteDisabled={!isAdmin}
                      deleteTitle="Permanently delete this character"
                      // Merchants have storefronts. (NPCs without a merchant record do not.)
                      storeHref={selected?.type === "merchant" && selected?.id && selected?.storefront_enabled ? `/map?merchant=${selected.id}` : null}
                      itemBonuses={equippedEffects}
                      // Always render equipment from equipped inventory rows.
                      // NOTE: empty string is intentional (prevents falling back to legacy sheet.equipment).
                      equipmentOverride={equippedEquipmentText}
                      equipmentBreakdown={equippedBreakdown}
                      locationLabel={
                        selected?.location_id
                          ? (locationNameById.get(String(selected.location_id)) || "Unknown location")
                          : "Not listed"
                      }
                      locationValue={selected?.location_id ? String(selected.location_id) : ""}
                      locationOptions={(locations || []).map((l) => ({ id: String(l.id), name: l.name }))}
                      onChangeLocation={setCharacterLocation}
                      locationDisabled={!canEditCharacter}
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

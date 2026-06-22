import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { NPC_PORTRAIT_BUCKET, publicPortraitUrl } from "../utils/characterPortraits";

function safeStr(value) {
  return String(value ?? "").trim();
}

function isMissingRpc(error) {
  const msg = String(error?.message || error?.details || "").toLowerCase();
  return msg.includes("function") && (msg.includes("does not exist") || msg.includes("not found"));
}

function imageUrlFor(row) {
  const direct = safeStr(row?.public_url || row?.url);
  if (direct) return direct;
  return publicPortraitUrl(supabase, row?.storage_path, row?.bucket || NPC_PORTRAIT_BUCKET);
}

function assignmentKey(row) {
  const path = safeStr(row?.storage_path);
  if (path) return `path:${path}`;
  const url = imageUrlFor(row);
  return url ? `url:${url}` : "";
}

export default function PortraitPickerModal({
  show = false,
  characterId,
  characterName = "Character",
  canEdit = false,
  currentStoragePath = "",
  currentUrl = "",
  onClose,
  onSelected,
}) {
  const [libraryRows, setLibraryRows] = useState([]);
  const [assignedRows, setAssignedRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!show) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");
      try {
        const [libraryRes, assignedRes] = await Promise.all([
          supabase
            .from("npc_portrait_library")
            .select("id,name,bucket,storage_path,public_url,category,tags,species_tags,profession_tags,theme_tags,width,height,sort_order,is_active")
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
          supabase
            .from("characters")
            .select("id,name,portrait_storage_path,portrait_url,portrait_shop_url,image_url")
            .or("portrait_storage_path.not.is.null,portrait_url.not.is.null,portrait_shop_url.not.is.null,image_url.not.is.null")
            .order("name", { ascending: true }),
        ]);

        if (cancelled) return;
        if (libraryRes.error) throw libraryRes.error;
        if (assignedRes.error) throw assignedRes.error;

        setLibraryRows(libraryRes.data || []);
        setAssignedRows(assignedRes.data || []);
      } catch (error) {
        if (!cancelled) {
          setErr(error?.message || "Failed to load portrait library.");
          setLibraryRows([]);
          setAssignedRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [show]);

  const assignmentsByKey = useMemo(() => {
    const map = new Map();
    for (const row of assignedRows || []) {
      const keys = [];
      if (row?.portrait_storage_path) keys.push(`path:${row.portrait_storage_path}`);
      for (const value of [row?.portrait_shop_url, row?.portrait_url, row?.image_url]) {
        const clean = safeStr(value);
        if (clean) keys.push(`url:${clean}`);
      }
      for (const key of keys) {
        if (!key) continue;
        const list = map.get(key) || [];
        list.push({ id: row.id, name: row.name || "Assigned character" });
        map.set(key, list);
      }
    }
    return map;
  }, [assignedRows]);

  const filteredRows = useMemo(() => {
    const q = safeStr(query).toLowerCase();
    if (!q) return libraryRows;
    return (libraryRows || []).filter((row) => {
      const hay = [
        row?.name,
        row?.category,
        ...(Array.isArray(row?.tags) ? row.tags : []),
        ...(Array.isArray(row?.species_tags) ? row.species_tags : []),
        ...(Array.isArray(row?.profession_tags) ? row.profession_tags : []),
        ...(Array.isArray(row?.theme_tags) ? row.theme_tags : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [libraryRows, query]);

  if (!show) return null;

  const currentKey = currentStoragePath ? `path:${currentStoragePath}` : currentUrl ? `url:${currentUrl}` : "";

  async function choosePortrait(row) {
    if (!canEdit || !characterId || savingKey) return;

    const key = assignmentKey(row);
    const storagePath = safeStr(row?.storage_path);
    const url = imageUrlFor(row);
    const patch = {
      portrait_storage_path: storagePath || null,
      portrait_url: url || null,
      portrait_thumb_url: url || null,
      portrait_shop_url: url || null,
      portrait_source: "library",
      image_url: url || null,
    };

    setSavingKey(key || row?.id || "saving");
    setErr("");
    try {
      const rpc = await supabase.rpc("set_character_portrait_v1", {
        p_character_id: characterId,
        p_storage_path: patch.portrait_storage_path,
        p_url: patch.portrait_url,
        p_thumb_url: patch.portrait_thumb_url,
        p_shop_url: patch.portrait_shop_url,
        p_source: patch.portrait_source,
      });

      if (rpc.error) {
        if (!isMissingRpc(rpc.error)) throw rpc.error;
        const direct = await supabase
          .from("characters")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", characterId);
        if (direct.error) throw direct.error;
      }

      onSelected?.(patch);
      onClose?.();
    } catch (error) {
      setErr(error?.message || "Failed to assign portrait.");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <div className="portrait-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? onClose?.() : null}>
      <div className="portrait-picker-modal" role="dialog" aria-modal="true" aria-label="Choose profile portrait">
        <div className="portrait-picker-head">
          <div>
            <div className="portrait-picker-kicker">Profile portrait</div>
            <h3>Choose portrait for {characterName}</h3>
            <p>All library portraits remain selectable. Assigned portraits are marked with the current character names.</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
        </div>

        <div className="portrait-picker-toolbar">
          <input
            className="form-control form-control-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, species, profession, theme…"
          />
          <span>{filteredRows.length} shown</span>
        </div>

        {err ? <div className="portrait-picker-alert">{err}</div> : null}
        {loading ? <div className="portrait-picker-empty">Loading portrait library…</div> : null}

        {!loading ? (
          <div className="portrait-picker-grid">
            {filteredRows.map((row) => {
              const url = imageUrlFor(row);
              const key = assignmentKey(row) || String(row.id);
              const assigned = (assignmentsByKey.get(key) || []).filter((entry) => String(entry.id) !== String(characterId));
              const isCurrent = key && key === currentKey;
              const label = row.name || row.storage_path || "Portrait";
              return (
                <button
                  key={row.id || key}
                  type="button"
                  className={`portrait-picker-card ${isCurrent ? "is-current" : ""}`}
                  onClick={() => choosePortrait(row)}
                  disabled={!canEdit || !!savingKey}
                  title={assigned.length ? `Already assigned to: ${assigned.map((entry) => entry.name).join(", ")}` : label}
                >
                  <span className="portrait-picker-image">
                    {url ? <img src={url} alt="" loading="lazy" /> : <span>No image</span>}
                  </span>
                  <span className="portrait-picker-name">{label}</span>
                  {isCurrent ? <span className="portrait-picker-current">Current</span> : null}
                  {assigned.length ? <span className="portrait-picker-bookmark">🔖 {assigned.map((entry) => entry.name).join(", ")}</span> : null}
                  {savingKey === key ? <span className="portrait-picker-saving">Saving…</span> : null}
                </button>
              );
            })}
            {!filteredRows.length ? <div className="portrait-picker-empty">No portraits match that search.</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { LOCAL_FALLBACK_ICON } from "../utils/mapIcons";

const NPC_SPRITE_BUCKET = "map-icons";
const NPC_SPRITE_FOLDER = "npc-icons";

function safeStr(value) {
  return String(value ?? "").trim();
}

function publicSpriteUrl(path) {
  const clean = safeStr(path);
  if (!clean) return LOCAL_FALLBACK_ICON;
  try {
    return supabase.storage.from(NPC_SPRITE_BUCKET).getPublicUrl(clean).data?.publicUrl || LOCAL_FALLBACK_ICON;
  } catch {
    return LOCAL_FALLBACK_ICON;
  }
}

export default function SpritePickerModal({
  show = false,
  sprites = [],
  value = null,
  characterName = "Character",
  disabled = false,
  onClose,
  onChange,
}) {
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [storageSprites, setStorageSprites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!show) return;
    if (Array.isArray(sprites) && sprites.length) {
      setStorageSprites(sprites);
      return;
    }

    let cancelled = false;
    async function loadSprites() {
      setLoading(true);
      setErr("");
      const { data, error } = await supabase.storage
        .from(NPC_SPRITE_BUCKET)
        .list(NPC_SPRITE_FOLDER, { limit: 500, sortBy: { column: "name", order: "asc" } });

      if (cancelled) return;
      if (error) {
        setErr(error.message || "Failed to load NPC sprites.");
        setStorageSprites([]);
      } else {
        setStorageSprites(
          (data || [])
            .filter((file) => file?.name && String(file.name).toLowerCase().endsWith(".png"))
            .map((file, index) => {
              const path = `${NPC_SPRITE_FOLDER}/${file.name}`;
              return {
                id: path,
                name: file.name,
                path,
                url: publicSpriteUrl(path),
                sort_order: index,
              };
            })
        );
      }
      setLoading(false);
    }

    loadSprites();
    return () => {
      cancelled = true;
    };
  }, [show, sprites]);

  const filtered = useMemo(() => {
    const term = safeStr(query).toLowerCase();
    const base = Array.isArray(storageSprites) ? storageSprites : [];
    const list = term
      ? base.filter((sprite) => {
          const hay = [sprite?.name, sprite?.path]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(term);
        })
      : base;

    return [...list].sort((a, b) => {
      const ao = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : 9999;
      const bo = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : 9999;
      if (ao !== bo) return ao - bo;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [storageSprites, query]);

  if (!show) return null;

  async function choose(nextPath) {
    if (disabled || savingId !== null) return;
    setSavingId(nextPath || "clear");
    try {
      if (typeof onChange === "function") await onChange(nextPath || null);
      onClose?.();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="sprite-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? onClose?.() : null}>
      <div className="sprite-picker-modal" role="dialog" aria-modal="true" aria-label="Choose NPC sprite">
        <div className="sprite-picker-head">
          <div>
            <div className="sprite-picker-kicker">NPC sprite</div>
            <h3>Choose sprite for {characterName}</h3>
            <p>This changes the character’s walking/map sprite only; it does not change portrait or profile art.</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
        </div>

        <div className="sprite-picker-toolbar">
          <input
            className="form-control form-control-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search NPC sprites…"
          />
          <span>{loading ? "Loading…" : `${filtered.length} shown`}</span>
        </div>

        {err ? <div className="portrait-picker-alert">{err}</div> : null}

        <div className="sprite-picker-grid">
          <button
            type="button"
            className={`sprite-picker-card ${!value ? "is-current" : ""}`}
            disabled={disabled || savingId !== null}
            onClick={() => choose(null)}
            title="Clear NPC sprite"
          >
            <span className="sprite-picker-image"><img src={LOCAL_FALLBACK_ICON} alt="" /></span>
            <span className="sprite-picker-name">No sprite</span>
            {!value ? <span className="sprite-picker-current">Current</span> : null}
          </button>

          {filtered.map((sprite) => {
            const path = sprite.path || sprite.id;
            const isCurrent = String(path) === String(value);
            return (
              <button
                key={path}
                type="button"
                className={`sprite-picker-card ${isCurrent ? "is-current" : ""}`}
                disabled={disabled || savingId !== null}
                onClick={() => choose(path)}
                title={sprite.name || path || "NPC sprite"}
              >
                <span className="sprite-picker-image"><img src={sprite.url || publicSpriteUrl(path)} alt="" loading="lazy" /></span>
                <span className="sprite-picker-name">{sprite.name || path || "NPC sprite"}</span>
                {isCurrent ? <span className="sprite-picker-current">Current</span> : null}
                {savingId === path ? <span className="sprite-picker-saving">Saving…</span> : null}
              </button>
            );
          })}

          {!loading && !filtered.length ? <div className="sprite-picker-empty">No NPC sprites match that search.</div> : null}
        </div>
      </div>
    </div>
  );
}

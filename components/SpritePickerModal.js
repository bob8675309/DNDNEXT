import { useEffect, useMemo, useState } from "react";
import SpriteSheetPreview, { DEFAULT_DIRECTIONS } from "./SpriteSheetPreview";
import { supabase } from "../utils/supabaseClient";
import { LOCAL_FALLBACK_ICON } from "../utils/mapIcons";

const LEGACY_BUCKET = "map-icons";
const LEGACY_FOLDER = "npc-icons";

function text(value) { return String(value ?? "").trim(); }

function spriteUrl(asset) {
  if (!asset?.sprite_path) return "";
  try { return supabase.storage.from(asset.sprite_bucket || LEGACY_BUCKET).getPublicUrl(asset.sprite_path).data?.publicUrl || ""; }
  catch { return ""; }
}

function legacyUrl(path) {
  const clean = text(path);
  if (!clean) return LOCAL_FALLBACK_ICON;
  try { return supabase.storage.from(LEGACY_BUCKET).getPublicUrl(clean).data?.publicUrl || LOCAL_FALLBACK_ICON; }
  catch { return LOCAL_FALLBACK_ICON; }
}

function searchText(asset) {
  return [asset?.name, asset?.sprite_path, ...(asset?.species_tags || []), ...(asset?.role_tags || []), ...(asset?.theme_tags || []), asset?.notes]
    .filter(Boolean).join(" ").toLowerCase();
}

export default function SpritePickerModal({
  show = false,
  characterId = null,
  characterName = "Character",
  canEdit = false,
  currentVisualAssetId = "",
  portraitLibraryId = "",
  onClose,
  onSelected,
  // Legacy /npcs call sites use path-based selection until their large source surface is
  // explicitly migrated. Rich assets are never exposed through this compatibility mode.
  sprites = [],
  value = null,
  disabled = false,
  onChange,
}) {
  const richMode = Boolean(characterId);
  const [assets, setAssets] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [direction, setDirection] = useState("down");
  const [walking, setWalking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setSelectedId(richMode ? String(currentVisualAssetId || "") : String(value || ""));
    setQuery("");
    setError("");
    let active = true;

    (async () => {
      setLoading(true);
      if (!richMode) {
        if (Array.isArray(sprites) && sprites.length) {
          setAssets(sprites.map((sprite, index) => ({
            id: sprite.path || sprite.id || `legacy-${index}`,
            name: sprite.name || sprite.path || "Sprite",
            sprite_path: sprite.path || sprite.id || "",
            url: sprite.url || legacyUrl(sprite.path || sprite.id),
            sort_order: Number(sprite.sort_order ?? index),
            legacy: true,
          })));
          setSuggestions([]);
          setLoading(false);
          return;
        }
        const storageResult = await supabase.storage.from(LEGACY_BUCKET).list(LEGACY_FOLDER, { limit: 500, sortBy: { column: "name", order: "asc" } });
        if (!active) return;
        if (storageResult.error) {
          setError(storageResult.error.message || "Failed to load legacy map sprites.");
          setAssets([]);
        } else {
          setAssets((storageResult.data || []).filter((file) => file?.name && /\.png$/i.test(file.name)).map((file, index) => {
            const path = `${LEGACY_FOLDER}/${file.name}`;
            return { id: path, name: file.name, sprite_path: path, url: legacyUrl(path), sort_order: index, legacy: true };
          }));
        }
        setSuggestions([]);
        setLoading(false);
        return;
      }

      const [assetRes, suggestionRes] = await Promise.all([
        supabase.from("npc_visual_assets").select("id,name,sprite_bucket,sprite_path,sprite_format,frame_width,frame_height,direction_order,idle_frame,walk_frames,fps,default_scale,overworld_scale,tactical_scale,species_tags,role_tags,theme_tags,is_active,notes").eq("is_active", true).order("name"),
        portraitLibraryId
          ? supabase.from("portrait_sprite_suggestions").select("visual_asset_id,suggestion_rank,is_primary").eq("portrait_library_id", portraitLibraryId).order("suggestion_rank")
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (!active) return;
      if (assetRes.error) setError(assetRes.error.message || "Could not load sprite library.");
      setAssets(assetRes.data || []);
      setSuggestions(suggestionRes.error ? [] : suggestionRes.data || []);
      setLoading(false);
    })();

    return () => { active = false; };
  }, [currentVisualAssetId, portraitLibraryId, richMode, show, sprites, value]);

  const suggestionMap = useMemo(() => new Map((suggestions || []).map((row) => [String(row.visual_asset_id), row])), [suggestions]);

  const filtered = useMemo(() => {
    const q = text(query).toLowerCase();
    return (assets || [])
      .filter((asset) => !q || searchText(asset).includes(q))
      .slice()
      .sort((a, b) => {
        if (!richMode) {
          const ao = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : 9999;
          const bo = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : 9999;
          if (ao !== bo) return ao - bo;
          return String(a.name || "").localeCompare(String(b.name || ""));
        }
        const as = suggestionMap.get(String(a.id));
        const bs = suggestionMap.get(String(b.id));
        if (Boolean(as) !== Boolean(bs)) return as ? -1 : 1;
        if (as && bs) {
          if (Boolean(as.is_primary) !== Boolean(bs.is_primary)) return as.is_primary ? -1 : 1;
          const rankDelta = Number(as.suggestion_rank || 100) - Number(bs.suggestion_rank || 100);
          if (rankDelta) return rankDelta;
        }
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [assets, query, richMode, suggestionMap]);

  const selected = useMemo(() => assets.find((asset) => String(asset.id) === String(selectedId)) || null, [assets, selectedId]);
  const directions = richMode && selected?.direction_order?.length ? selected.direction_order : DEFAULT_DIRECTIONS;

  useEffect(() => { if (!directions.includes(direction)) setDirection(directions[0] || "down"); }, [direction, directions]);

  if (!show) return null;

  async function saveSelection() {
    if (saving || disabled) return;
    setSaving(true); setError("");
    try {
      if (richMode) {
        if (!canEdit) throw new Error("This character cannot be edited from this sprite picker.");
        const nextId = selectedId || null;
        const { error: saveError } = await supabase.rpc("set_character_visual_asset_v1", {
          p_character_id: characterId,
          p_visual_asset_id: nextId,
        });
        if (saveError) throw saveError;
        onSelected?.({ visual_asset_id: nextId, sprite_key: nextId, sprite_asset: selected || null });
      } else {
        if (typeof onChange !== "function") throw new Error("Legacy sprite picker is missing its save callback.");
        await onChange(selected?.sprite_path || null);
      }
      onClose?.();
    } catch (saveError) {
      setError(saveError.message || "Could not update character sprite.");
    } finally {
      setSaving(false);
    }
  }

  if (!richMode) {
    return (
      <div className="sprite-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? onClose?.() : null}>
        <div className="sprite-picker-modal" role="dialog" aria-modal="true" aria-label="Choose legacy NPC sprite">
          <div className="sprite-picker-head"><div><div className="sprite-picker-kicker">Legacy map sprite</div><h3>Choose sprite for {characterName}</h3><p>This compatibility picker remains limited to the current 4-direction map sheets until the world renderer migration lands.</p></div><button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button></div>
          <div className="sprite-picker-toolbar"><input className="form-control form-control-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search current map sprites…" /><span>{loading ? "Loading…" : `${filtered.length} shown`}</span></div>
          {error ? <div className="portrait-picker-alert">{error}</div> : null}
          <div className="sprite-picker-grid">
            <button type="button" className={`sprite-picker-card ${!selectedId ? "is-current" : ""}`} disabled={disabled || saving} onClick={() => setSelectedId("")}><span className="sprite-picker-image"><img src={LOCAL_FALLBACK_ICON} alt="" /></span><span className="sprite-picker-name">No sprite</span>{!selectedId ? <span className="sprite-picker-current">Current</span> : null}</button>
            {filtered.map((asset) => <button key={asset.id} type="button" className={`sprite-picker-card ${String(asset.id) === String(selectedId) ? "is-current" : ""}`} disabled={disabled || saving} onClick={() => setSelectedId(String(asset.id))}><span className="sprite-picker-image"><img src={asset.url || legacyUrl(asset.sprite_path)} alt="" loading="lazy" /></span><span className="sprite-picker-name">{asset.name || asset.sprite_path}</span>{String(asset.id) === String(selectedId) ? <span className="sprite-picker-current">Current</span> : null}</button>)}
            {!loading && !filtered.length ? <div className="sprite-picker-empty">No current map sprites match this search.</div> : null}
          </div>
          <div className="d-flex justify-content-end gap-2 mt-3"><button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Cancel</button><button type="button" className="btn btn-sm btn-primary" disabled={disabled || saving} onClick={saveSelection}>{saving ? "Saving…" : "Use sprite"}</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="portrait-picker-backdrop sprite-picker-backdrop rich-sprite-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? onClose?.() : null}>
      <div className="portrait-picker-modal sprite-picker-modal rich-sprite-picker-modal" role="dialog" aria-modal="true" aria-label={`Choose sprite for ${characterName}`}>
        <div className="portrait-picker-head"><div><div className="portrait-picker-kicker">Map &amp; tactical sprite</div><h3>Choose sprite for {characterName}</h3><p>Suggested matches are shown first when available. Portrait and sprite remain independent choices.</p></div><button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button></div>
        <div className="portrait-picker-toolbar"><input className="form-control form-control-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sprites by name, species, role, theme…" /><span>{loading ? "Loading…" : `${filtered.length} shown`}</span></div>
        {error ? <div className="portrait-picker-alert">{error}</div> : null}
        <div className="rich-sprite-picker-layout">
          <div className="rich-sprite-picker-list">
            <button type="button" className={`rich-sprite-picker-row ${!selectedId ? "is-current" : ""}`} onClick={() => setSelectedId("")}><span><strong>No sprite</strong><small>Keep the portrait but remove the map/tactical sprite.</small></span></button>
            {filtered.map((asset) => {
              const suggestion = suggestionMap.get(String(asset.id));
              const current = String(selectedId) === String(asset.id);
              return <button key={asset.id} type="button" className={`rich-sprite-picker-row ${current ? "is-current" : ""}`} onClick={() => setSelectedId(String(asset.id))}><span><strong>{asset.name}</strong><small>{asset.frame_width}×{asset.frame_height} • {asset.direction_order?.length || 8} directions • {asset.fps || 7} FPS</small></span>{suggestion ? <b>{suggestion.is_primary ? "Suggested match" : `Suggested #${suggestion.suggestion_rank}`}</b> : null}</button>;
            })}
          </div>
          <div className="rich-sprite-picker-preview">
            <div className="rich-sprite-picker-stage"><SpriteSheetPreview asset={selected} spriteUrl={spriteUrl(selected)} direction={direction} walking={walking} displaySize={148} /></div>
            <div className="rich-sprite-picker-controls"><label><span>Facing</span><select value={direction} onChange={(event) => setDirection(event.target.value)}>{directions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label><label className="rich-sprite-picker-walk"><input type="checkbox" checked={walking} onChange={(event) => setWalking(event.target.checked)} /><span>Walking preview</span></label>{selected ? <div className="small text-muted">Overworld ×{selected.overworld_scale ?? selected.default_scale ?? 0.35} • Tactical ×{selected.tactical_scale ?? 1}</div> : null}</div>
          </div>
        </div>
        <div className="rich-sprite-picker-footer"><span>{selected ? selected.name : "No sprite selected"}</span><div><button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Cancel</button><button type="button" className="btn btn-sm btn-primary" disabled={saving || disabled || !canEdit} onClick={saveSelection}>{saving ? "Saving…" : "Use sprite"}</button></div></div>
        <style jsx global>{`
          .rich-sprite-picker-backdrop{z-index:1095}.rich-sprite-picker-modal{width:min(980px,94vw);max-width:none}.rich-sprite-picker-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:12px;min-height:0}.rich-sprite-picker-list{display:grid;align-content:start;gap:6px;max-height:58vh;overflow:auto;padding-right:4px}.rich-sprite-picker-row{display:flex;justify-content:space-between;gap:10px;text-align:left;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.025);color:#eee;border-radius:9px;padding:10px}.rich-sprite-picker-row:hover,.rich-sprite-picker-row.is-current{border-color:#aa66ff;background:rgba(137,75,255,.14)}.rich-sprite-picker-row span{display:grid;gap:3px}.rich-sprite-picker-row small{color:rgba(255,255,255,.58);font-size:.7rem}.rich-sprite-picker-row b{align-self:start;color:#84eadb;font-size:.64rem;text-transform:uppercase}.rich-sprite-picker-preview{display:grid;align-content:start;gap:10px}.rich-sprite-picker-stage{min-height:230px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:linear-gradient(135deg,rgba(49,39,68,.82),rgba(12,30,36,.8));overflow:hidden}.rich-sprite-picker-controls{display:grid;gap:8px}.rich-sprite-picker-controls label{display:grid;gap:4px}.rich-sprite-picker-walk{grid-template-columns:auto 1fr!important;align-items:center}.rich-sprite-picker-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px}.rich-sprite-picker-footer>div{display:flex;gap:8px}@media(max-width:780px){.rich-sprite-picker-layout{grid-template-columns:1fr}.rich-sprite-picker-list{max-height:38vh}.rich-sprite-picker-stage{min-height:180px}}
        `}</style>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import SpriteSheetPreview, { DEFAULT_DIRECTIONS } from "./SpriteSheetPreview";
import { supabase } from "../utils/supabaseClient";

function text(value) { return String(value ?? "").trim(); }

function spriteUrl(asset) {
  if (!asset?.sprite_path) return "";
  try { return supabase.storage.from(asset.sprite_bucket || "map-icons").getPublicUrl(asset.sprite_path).data?.publicUrl || ""; }
  catch { return ""; }
}

function searchText(asset) {
  return [asset?.name, asset?.sprite_path, ...(asset?.species_tags || []), ...(asset?.role_tags || []), ...(asset?.theme_tags || []), asset?.notes]
    .filter(Boolean).join(" ").toLowerCase();
}

export default function SpritePickerModal({
  show = false,
  characterId,
  characterName = "Character",
  canEdit = false,
  currentVisualAssetId = "",
  portraitLibraryId = "",
  onClose,
  onSelected,
  // Legacy call sites can still pass these props while they migrate.
  sprites = [],
  value = null,
  disabled = false,
  onChange,
}) {
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
    setSelectedId(String(currentVisualAssetId || ""));
    setQuery("");
    setError("");
    let active = true;
    (async () => {
      setLoading(true);
      const [assetRes, suggestionRes] = await Promise.all([
        supabase.from("npc_visual_assets").select("id,name,sprite_bucket,sprite_path,sprite_format,frame_width,frame_height,direction_order,idle_frame,walk_frames,fps,default_scale,overworld_scale,tactical_scale,species_tags,role_tags,theme_tags,is_active,notes").eq("is_active", true).order("name"),
        portraitLibraryId
          ? supabase.from("portrait_sprite_suggestions").select("visual_asset_id,suggestion_rank,is_primary").eq("portrait_library_id", portraitLibraryId).order("suggestion_rank")
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (!active) return;
      if (assetRes.error) setError(assetRes.error.message || "Could not load sprite library.");
      let rows = assetRes.data || [];
      // Preserve compatibility for an older caller that supplies a local list while the
      // character has not yet been migrated to visual_asset_id.
      if (!rows.length && Array.isArray(sprites) && sprites.length) {
        rows = sprites.map((sprite, index) => ({
          id: sprite.id || sprite.path || `legacy-${index}`,
          name: sprite.name || sprite.path || "Sprite",
          sprite_bucket: "map-icons",
          sprite_path: sprite.path || sprite.id || "",
          sprite_format: "legacy_4dir_3frame_32",
          frame_width: 32,
          frame_height: 32,
          direction_order: ["down", "left", "right", "up"],
          idle_frame: 0,
          walk_frames: [0, 1, 2],
          fps: 7,
          default_scale: 0.7,
          overworld_scale: 0.7,
          tactical_scale: 1,
          is_active: true,
        }));
      }
      setAssets(rows);
      setSuggestions(suggestionRes.error ? [] : suggestionRes.data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [currentVisualAssetId, portraitLibraryId, show, sprites]);

  const suggestionMap = useMemo(() => new Map((suggestions || []).map((row) => [String(row.visual_asset_id), row])), [suggestions]);

  const filtered = useMemo(() => {
    const q = text(query).toLowerCase();
    return (assets || [])
      .filter((asset) => !q || searchText(asset).includes(q))
      .slice()
      .sort((a, b) => {
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
  }, [assets, query, suggestionMap]);

  const selected = useMemo(() => assets.find((asset) => String(asset.id) === String(selectedId)) || null, [assets, selectedId]);
  const directions = selected?.direction_order?.length ? selected.direction_order : DEFAULT_DIRECTIONS;

  useEffect(() => { if (!directions.includes(direction)) setDirection(directions[0] || "down"); }, [direction, directions]);

  if (!show) return null;

  async function saveSelection() {
    if (saving || disabled) return;
    setSaving(true); setError("");
    const nextId = selectedId || null;
    try {
      if (characterId && canEdit) {
        const { error: saveError } = await supabase.rpc("set_character_visual_asset_v1", {
          p_character_id: characterId,
          p_visual_asset_id: nextId,
        });
        if (saveError) throw saveError;
        onSelected?.({ visual_asset_id: nextId, sprite_key: nextId, sprite_asset: selected || null });
      } else if (typeof onChange === "function") {
        // Compatibility: legacy callers expected the raw sprite path.
        await onChange(selected?.sprite_path || value || null);
      } else {
        throw new Error("This character cannot be edited from this sprite picker.");
      }
      onClose?.();
    } catch (saveError) {
      setError(saveError.message || "Could not update character sprite.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="portrait-picker-backdrop sprite-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? onClose?.() : null}>
      <div className="portrait-picker-modal sprite-picker-modal" role="dialog" aria-modal="true" aria-label={`Choose sprite for ${characterName}`}>
        <div className="portrait-picker-head"><div><div className="portrait-picker-kicker">Map &amp; tactical sprite</div><h3>Choose sprite for {characterName}</h3><p>Suggested matches are shown first when available. Portrait and sprite remain independent choices.</p></div><button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button></div>
        <div className="portrait-picker-toolbar"><input className="form-control form-control-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sprites by name, species, role, theme…" /><span>{loading ? "Loading…" : `${filtered.length} shown`}</span></div>
        {error ? <div className="portrait-picker-alert">{error}</div> : null}
        <div className="sprite-picker-layout">
          <div className="sprite-picker-list">
            <button type="button" className={`sprite-picker-row ${!selectedId ? "is-current" : ""}`} onClick={() => setSelectedId("")}><span><strong>No sprite</strong><small>Keep the portrait but remove the map/tactical sprite.</small></span></button>
            {filtered.map((asset) => {
              const suggestion = suggestionMap.get(String(asset.id));
              const current = String(selectedId) === String(asset.id);
              return <button key={asset.id} type="button" className={`sprite-picker-row ${current ? "is-current" : ""}`} onClick={() => setSelectedId(String(asset.id))}><span><strong>{asset.name}</strong><small>{asset.frame_width}×{asset.frame_height} • {asset.direction_order?.length || 8} directions • {asset.fps || 7} FPS</small></span>{suggestion ? <b>{suggestion.is_primary ? "Suggested match" : `Suggested #${suggestion.suggestion_rank}`}</b> : null}</button>;
            })}
          </div>
          <div className="sprite-picker-preview">
            <div className="sprite-picker-stage"><SpriteSheetPreview asset={selected} spriteUrl={spriteUrl(selected)} direction={direction} walking={walking} displaySize={148} /></div>
            <div className="sprite-picker-controls"><label><span>Facing</span><select value={direction} onChange={(event) => setDirection(event.target.value)}>{directions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label><label className="sprite-picker-walk"><input type="checkbox" checked={walking} onChange={(event) => setWalking(event.target.checked)} /><span>Walking preview</span></label>{selected ? <div className="small text-muted">Overworld ×{selected.overworld_scale ?? selected.default_scale ?? 0.35} • Tactical ×{selected.tactical_scale ?? 1}</div> : null}</div>
          </div>
        </div>
        <div className="sprite-picker-footer"><span>{selected ? selected.name : "No sprite selected"}</span><div><button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Cancel</button><button type="button" className="btn btn-sm btn-primary" disabled={saving || disabled || (characterId ? !canEdit : typeof onChange !== "function")} onClick={saveSelection}>{saving ? "Saving…" : "Use sprite"}</button></div></div>
        <style jsx global>{`
          .sprite-picker-backdrop{z-index:1095}.sprite-picker-modal{width:min(980px,94vw);max-width:none}.sprite-picker-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:12px;min-height:0}.sprite-picker-list{display:grid;align-content:start;gap:6px;max-height:58vh;overflow:auto;padding-right:4px}.sprite-picker-row{display:flex;justify-content:space-between;gap:10px;text-align:left;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.025);color:#eee;border-radius:9px;padding:10px}.sprite-picker-row:hover,.sprite-picker-row.is-current{border-color:#aa66ff;background:rgba(137,75,255,.14)}.sprite-picker-row span{display:grid;gap:3px}.sprite-picker-row small{color:rgba(255,255,255,.58);font-size:.7rem}.sprite-picker-row b{align-self:start;color:#84eadb;font-size:.64rem;text-transform:uppercase}.sprite-picker-preview{display:grid;align-content:start;gap:10px}.sprite-picker-stage{min-height:230px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:linear-gradient(135deg,rgba(49,39,68,.82),rgba(12,30,36,.8));overflow:hidden}.sprite-picker-controls{display:grid;gap:8px}.sprite-picker-controls label{display:grid;gap:4px}.sprite-picker-walk{grid-template-columns:auto 1fr!important;align-items:center}.sprite-picker-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px}.sprite-picker-footer>div{display:flex;gap:8px}@media(max-width:780px){.sprite-picker-layout{grid-template-columns:1fr}.sprite-picker-list{max-height:38vh}.sprite-picker-stage{min-height:180px}}
        `}</style>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import PortraitPickerModal from "./PortraitPickerModal";
import SpritePickerModal from "./SpritePickerModal";
import SpriteSheetPreview from "./SpriteSheetPreview";
import { resolveCharacterPortrait } from "../utils/characterPortraits";
import { supabase } from "../utils/supabaseClient";

function text(value) { return String(value ?? "").trim(); }

function spriteUrl(asset) {
  if (!asset?.sprite_path) return "";
  try { return supabase.storage.from(asset.sprite_bucket || "map-icons").getPublicUrl(asset.sprite_path).data?.publicUrl || ""; }
  catch { return ""; }
}

export default function CharacterVisualsPanel({ character = null, canEdit = false }) {
  const characterId = character?.id || null;
  const [row, setRow] = useState(character || null);
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [portraitOpen, setPortraitOpen] = useState(false);
  const [spriteOpen, setSpriteOpen] = useState(false);
  const [direction, setDirection] = useState("down");
  const [walking, setWalking] = useState(true);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("characters")
      .select("id,name,kind,race,role,portrait_library_id,portrait_url,portrait_storage_path,portrait_thumb_url,portrait_shop_url,portrait_source,image_url,visual_asset_id,sprite_key,sprite_path,sprite_scale")
      .eq("id", characterId)
      .single();
    if (loadError) {
      setError(loadError.message || "Could not load character visuals.");
      setLoading(false);
      return;
    }
    setRow(data || null);
    if (data?.visual_asset_id) {
      const { data: assetRow, error: assetError } = await supabase
        .from("npc_visual_assets")
        .select("id,name,sprite_bucket,sprite_path,sprite_format,frame_width,frame_height,direction_order,idle_frame,walk_frames,fps,default_scale,overworld_scale,tactical_scale,species_tags,role_tags,theme_tags,is_active,notes")
        .eq("id", data.visual_asset_id)
        .maybeSingle();
      if (!assetError) setAsset(assetRow || null);
      else setAsset(null);
    } else {
      setAsset(null);
    }
    setLoading(false);
  }, [characterId]);

  useEffect(() => { setRow(character || null); }, [character]);
  useEffect(() => { load(); }, [load]);

  const portrait = useMemo(() => resolveCharacterPortrait(row || character || {}, supabase, { includeDefault: false }), [character, row]);
  const directions = asset?.direction_order?.length ? asset.direction_order : ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"];

  useEffect(() => { if (!directions.includes(direction)) setDirection(directions[0] || "down"); }, [direction, directions]);

  function handlePortraitSelected(patch) {
    setRow((current) => ({ ...(current || {}), ...patch }));
    setTimeout(() => load(), 0);
  }

  function handleSpriteSelected(patch) {
    setRow((current) => ({ ...(current || {}), visual_asset_id: patch?.visual_asset_id || null, sprite_key: patch?.sprite_key || null }));
    setAsset(patch?.sprite_asset || null);
    setTimeout(() => load(), 0);
  }

  if (!characterId) return <div className="npc-card"><div className="text-muted">No character selected.</div></div>;

  return (
    <div className="character-visuals-workspace">
      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
        <div><div className="spell-admin-kicker">Visual identity</div><h4 className="mb-1">Portrait &amp; Sprite</h4><div className="small text-muted">Choose these independently. A portrait may suggest a matching sprite, but neither asset forces the other.</div></div>
        <button type="button" className="btn btn-sm btn-outline-light" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="character-visuals-grid">
        <section className="npc-card character-visual-card">
          <div className="character-visual-card__head"><div><div className="npc-card-title">Portrait</div><div className="small text-muted">Profile, shop, dialogue, and character identity art.</div></div>{canEdit ? <button type="button" className="btn btn-sm btn-outline-info" onClick={() => setPortraitOpen(true)}>Choose portrait</button> : null}</div>
          <div className="character-portrait-stage">{portrait.url ? <img src={portrait.url} alt="" /> : <div className="text-muted">No portrait selected</div>}</div>
          <div className="small text-muted text-break">{row?.portrait_storage_path || row?.portrait_source || "No library portrait"}</div>
        </section>

        <section className="npc-card character-visual-card">
          <div className="character-visual-card__head"><div><div className="npc-card-title">Sprite</div><div className="small text-muted">Shared animated asset for overworld presence and future tactical combat.</div></div>{canEdit ? <button type="button" className="btn btn-sm btn-outline-info" onClick={() => setSpriteOpen(true)}>Choose sprite</button> : null}</div>
          <div className="character-sprite-stage"><SpriteSheetPreview asset={asset} spriteUrl={spriteUrl(asset)} direction={direction} walking={walking} displaySize={164} /></div>
          {asset ? <><div className="character-sprite-meta"><strong>{asset.name}</strong><span>{asset.frame_width}×{asset.frame_height} • {asset.direction_order?.length || 8} directions • {asset.fps || 7} FPS</span><span>Overworld ×{asset.overworld_scale ?? asset.default_scale ?? 0.35} • Tactical ×{asset.tactical_scale ?? 1}</span></div><div className="character-sprite-controls"><label><span>Facing</span><select value={direction} onChange={(event) => setDirection(event.target.value)}>{directions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label><label><input type="checkbox" checked={walking} onChange={(event) => setWalking(event.target.checked)} /><span>Walking preview</span></label></div></> : <div className="small text-muted">No sprite selected. This does not affect the character portrait or sheet.</div>}
        </section>
      </div>

      <PortraitPickerModal
        show={portraitOpen}
        characterId={characterId}
        characterName={row?.name || character?.name || "Character"}
        canEdit={canEdit}
        currentStoragePath={row?.portrait_storage_path || ""}
        currentUrl={portrait.url || ""}
        onClose={() => setPortraitOpen(false)}
        onSelected={handlePortraitSelected}
      />
      <SpritePickerModal
        show={spriteOpen}
        characterId={characterId}
        characterName={row?.name || character?.name || "Character"}
        canEdit={canEdit}
        currentVisualAssetId={row?.visual_asset_id || ""}
        portraitLibraryId={row?.portrait_library_id || ""}
        onClose={() => setSpriteOpen(false)}
        onSelected={handleSpriteSelected}
      />

      <style jsx>{`
        .character-visuals-grid{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:1rem}.character-visual-card{display:grid;align-content:start;gap:.8rem}.character-visual-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.character-portrait-stage,.character-sprite-stage{min-height:330px;display:grid;place-items:center;border-radius:.8rem;border:1px solid rgba(255,255,255,.09);background:linear-gradient(135deg,rgba(64,45,82,.55),rgba(11,34,40,.58));overflow:hidden}.character-portrait-stage img{display:block;width:100%;height:100%;max-height:430px;object-fit:contain}.character-sprite-meta{display:grid;gap:.2rem}.character-sprite-meta span{font-size:.78rem;color:rgba(255,255,255,.62)}.character-sprite-controls{display:flex;gap:1rem;align-items:end;flex-wrap:wrap}.character-sprite-controls label{display:flex;align-items:center;gap:.4rem}.character-sprite-controls label:first-child{display:grid;gap:.3rem}.character-sprite-controls select{min-width:160px}@media(max-width:800px){.character-visuals-grid{grid-template-columns:1fr}.character-portrait-stage,.character-sprite-stage{min-height:240px}}
      `}</style>
    </div>
  );
}

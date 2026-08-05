import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { NPC_PORTRAIT_BUCKET, publicPortraitUrl } from "../utils/characterPortraits";
import SpriteSheetPreview, { DEFAULT_DIRECTIONS } from "./SpriteSheetPreview";

function text(value) { return String(value ?? "").trim(); }

function portraitUrl(row) {
  const direct = text(row?.public_url);
  if (direct) return direct;
  return publicPortraitUrl(supabase, row?.storage_path, row?.bucket || NPC_PORTRAIT_BUCKET);
}

function spriteUrl(asset) {
  const direct = text(asset?.public_url);
  if (direct) return direct;
  const path = text(asset?.sprite_path);
  if (!path) return "";
  try {
    return supabase.storage.from(asset?.sprite_bucket || "map-icons").getPublicUrl(path).data?.publicUrl || "";
  } catch {
    return "";
  }
}

function assetSummary(asset) {
  if (!asset) return "No sprite selected";
  const dirs = Array.isArray(asset.direction_order) ? asset.direction_order.length : 0;
  const walk = Array.isArray(asset.walk_frames) ? asset.walk_frames.length : 0;
  return `${dirs || 8}-direction • ${asset.frame_width || 64}×${asset.frame_height || 64} • idle + ${walk || 3} walk`;
}

function searchablePortrait(row) {
  return [
    row?.name,
    row?.category,
    ...(Array.isArray(row?.tags) ? row.tags : []),
    ...(Array.isArray(row?.species_tags) ? row.species_tags : []),
    ...(Array.isArray(row?.profession_tags) ? row.profession_tags : []),
    ...(Array.isArray(row?.theme_tags) ? row.theme_tags : []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function searchableAsset(row) {
  return [
    row?.name,
    row?.sprite_format,
    ...(Array.isArray(row?.species_tags) ? row.species_tags : []),
    ...(Array.isArray(row?.role_tags) ? row.role_tags : []),
    ...(Array.isArray(row?.theme_tags) ? row.theme_tags : []),
    row?.notes,
  ].filter(Boolean).join(" ").toLowerCase();
}

export default function NpcForgePortraitPickerModal({
  show = false,
  currentPortraitId = "",
  currentSpriteId = "",
  onClose,
  onSelect,
}) {
  const [portraits, setPortraits] = useState([]);
  const [assets, setAssets] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [portraitQuery, setPortraitQuery] = useState("");
  const [spriteQuery, setSpriteQuery] = useState("");
  const [selectedPortraitId, setSelectedPortraitId] = useState("");
  const [selectedSpriteId, setSelectedSpriteId] = useState("");
  const [previewDirection, setPreviewDirection] = useState("down");
  const [previewWalking, setPreviewWalking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setSelectedPortraitId(String(currentPortraitId || ""));
    setSelectedSpriteId(String(currentSpriteId || ""));
    setPortraitQuery("");
    setSpriteQuery("");
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      const [portraitRes, assetRes, suggestionRes] = await Promise.all([
        supabase
          .from("npc_portrait_library")
          .select("id,name,bucket,storage_path,public_url,category,tags,species_tags,profession_tags,theme_tags,width,height,aspect_ratio,sort_order,is_active")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("npc_visual_assets")
          .select("id,portrait_library_id,name,sprite_bucket,sprite_path,sprite_format,frame_width,frame_height,direction_order,idle_frame,walk_frames,fps,default_scale,overworld_scale,tactical_scale,species_tags,role_tags,theme_tags,is_default,is_active,notes")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("portrait_sprite_suggestions")
          .select("portrait_library_id,visual_asset_id,suggestion_rank,is_primary")
          .order("suggestion_rank", { ascending: true }),
      ]);
      if (!active) return;
      if (portraitRes.error) {
        setError(portraitRes.error.message || "Could not load portrait library.");
        setPortraits([]);
      } else {
        setPortraits((portraitRes.data || []).filter((row) => !/\.svg(?:$|[?#])/i.test(portraitUrl(row))));
      }
      setAssets(assetRes.error ? [] : assetRes.data || []);
      setSuggestions(suggestionRes.error ? [] : suggestionRes.data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [currentPortraitId, currentSpriteId, show]);

  const filteredPortraits = useMemo(() => {
    const q = text(portraitQuery).toLowerCase();
    if (!q) return portraits;
    return portraits.filter((row) => searchablePortrait(row).includes(q));
  }, [portraitQuery, portraits]);

  const suggestionMap = useMemo(() => {
    const map = new Map();
    for (const row of suggestions || []) {
      const portraitId = String(row?.portrait_library_id || "");
      const spriteId = String(row?.visual_asset_id || "");
      if (!portraitId || !spriteId) continue;
      const key = `${portraitId}:${spriteId}`;
      map.set(key, {
        rank: Number(row?.suggestion_rank || 100),
        primary: Boolean(row?.is_primary),
      });
    }
    return map;
  }, [suggestions]);

  const filteredAssets = useMemo(() => {
    const q = text(spriteQuery).toLowerCase();
    const portraitId = String(selectedPortraitId || "");
    return (assets || [])
      .filter((row) => !q || searchableAsset(row).includes(q))
      .slice()
      .sort((a, b) => {
        const aSuggestion = suggestionMap.get(`${portraitId}:${a.id}`);
        const bSuggestion = suggestionMap.get(`${portraitId}:${b.id}`);
        if (Boolean(aSuggestion) !== Boolean(bSuggestion)) return aSuggestion ? -1 : 1;
        if (aSuggestion && bSuggestion) {
          if (Boolean(aSuggestion.primary) !== Boolean(bSuggestion.primary)) return aSuggestion.primary ? -1 : 1;
          if (aSuggestion.rank !== bSuggestion.rank) return aSuggestion.rank - bSuggestion.rank;
        }
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [assets, selectedPortraitId, spriteQuery, suggestionMap]);

  const selectedPortrait = useMemo(
    () => portraits.find((row) => String(row.id) === String(selectedPortraitId)) || null,
    [portraits, selectedPortraitId]
  );
  const selectedAsset = useMemo(
    () => assets.find((row) => String(row.id) === String(selectedSpriteId)) || null,
    [assets, selectedSpriteId]
  );
  const selectedSpriteUrl = spriteUrl(selectedAsset);

  const selectedDirections = Array.isArray(selectedAsset?.direction_order) && selectedAsset.direction_order.length
    ? selectedAsset.direction_order
    : DEFAULT_DIRECTIONS;

  useEffect(() => {
    if (!selectedDirections.includes(previewDirection)) setPreviewDirection(selectedDirections[0] || "down");
  }, [previewDirection, selectedDirections]);

  if (!show) return null;

  function confirmSelection() {
    if (!selectedPortrait) return;
    const url = portraitUrl(selectedPortrait);
    const asset = selectedAsset || null;
    onSelect?.({
      portraitLibraryId: String(selectedPortrait.id),
      portraitName: selectedPortrait.name || "Portrait",
      portraitUrl: url || "",
      portraitStoragePath: selectedPortrait.storage_path || "",
      portraitThumbUrl: url || "",
      portraitShopUrl: url || "",
      portraitSource: "library",
      visualAssetId: asset?.id ? String(asset.id) : "",
      spriteKey: asset?.id ? String(asset.id) : "",
      spritePath: asset?.sprite_path || "",
      spriteScale: Number(asset?.overworld_scale || asset?.default_scale || 0.35),
      spriteAsset: asset,
    });
    onClose?.();
  }

  return (
    <div className="portrait-picker-backdrop npc-forge-portrait-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? onClose?.() : null}>
      <div className="portrait-picker-modal npc-forge-visual-picker" role="dialog" aria-modal="true" aria-label="Choose portrait and sprite">
        <div className="portrait-picker-head">
          <div>
            <div className="portrait-picker-kicker">Character visual identity</div>
            <h3>Choose portrait &amp; sprite</h3>
            <p>Portrait and sprite are independent. Suggested matches appear first, but any sprite can be paired with any portrait.</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
        </div>

        {error ? <div className="portrait-picker-alert">{error}</div> : null}

        <div className="npc-forge-visual-picker-layout">
          <section className="npc-forge-visual-picker-pane">
            <div className="npc-forge-visual-picker-title"><strong>1. Portrait</strong><span>{selectedPortrait?.name || "Choose one"}</span></div>
            <input className="form-control form-control-sm" value={portraitQuery} onChange={(event) => setPortraitQuery(event.target.value)} placeholder="Search portraits by name, species, profession, theme…" />
            <div className="portrait-picker-grid npc-forge-visual-picker-grid">
              {filteredPortraits.map((row) => {
                const url = portraitUrl(row);
                const current = String(selectedPortraitId || "") === String(row.id);
                return (
                  <button key={row.id} type="button" className={`portrait-picker-card ${current ? "is-current" : ""}`} onClick={() => setSelectedPortraitId(String(row.id))}>
                    <span className="portrait-picker-image">{url ? <img src={url} alt="" loading="lazy" /> : <span>No image</span>}</span>
                    <span className="portrait-picker-name">{row.name || row.storage_path || "Portrait"}</span>
                    {current ? <span className="portrait-picker-current">Selected</span> : null}
                  </button>
                );
              })}
              {!loading && !filteredPortraits.length ? <div className="portrait-picker-empty">No portraits match that search.</div> : null}
            </div>
          </section>

          <section className="npc-forge-visual-picker-pane">
            <div className="npc-forge-visual-picker-title"><strong>2. Sprite</strong><span>{selectedAsset?.name || "Optional until library is populated"}</span></div>
            <input className="form-control form-control-sm" value={spriteQuery} onChange={(event) => setSpriteQuery(event.target.value)} placeholder="Search sprites by name, species, role, theme…" />
            <div className="npc-forge-sprite-list">
              <button type="button" className={`npc-forge-sprite-card ${!selectedSpriteId ? "is-current" : ""}`} onClick={() => setSelectedSpriteId("")}>
                <span><strong>No sprite yet</strong><small>Portrait remains usable; add a sprite later.</small></span>
              </button>
              {filteredAssets.map((asset) => {
                const current = String(selectedSpriteId || "") === String(asset.id);
                const suggestion = suggestionMap.get(`${String(selectedPortraitId || "")}:${asset.id}`);
                return (
                  <button key={asset.id} type="button" className={`npc-forge-sprite-card ${current ? "is-current" : ""}`} onClick={() => setSelectedSpriteId(String(asset.id))}>
                    <span>
                      <strong>{asset.name || "Sprite"}</strong>
                      <small>{assetSummary(asset)}</small>
                    </span>
                    {suggestion ? <b>{suggestion.primary ? "Suggested match" : `Suggested #${suggestion.rank}`}</b> : null}
                  </button>
                );
              })}
              {!loading && !filteredAssets.length ? <div className="portrait-picker-empty">No sprite assets are registered yet.</div> : null}
            </div>

            <div className="npc-forge-sprite-preview-panel">
              <div className="npc-forge-sprite-preview-stage">
                <SpriteSheetPreview asset={selectedAsset} spriteUrl={selectedSpriteUrl} direction={previewDirection} walking={previewWalking} displaySize={112} />
              </div>
              <div className="npc-forge-sprite-preview-controls">
                <label><span>Facing</span><select value={previewDirection} onChange={(event) => setPreviewDirection(event.target.value)}>{selectedDirections.map((direction) => <option key={direction} value={direction}>{direction}</option>)}</select></label>
                <label className="npc-forge-preview-toggle"><input type="checkbox" checked={previewWalking} onChange={(event) => setPreviewWalking(event.target.checked)} /><span>Walking preview</span></label>
                <small>{assetSummary(selectedAsset)}</small>
              </div>
            </div>
          </section>
        </div>

        <div className="npc-forge-visual-picker-footer">
          <span>{loading ? "Loading visual library…" : `${filteredPortraits.length} portraits • ${filteredAssets.length} sprites`}</span>
          <div><button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Cancel</button><button type="button" className="btn btn-sm btn-primary" disabled={!selectedPortrait} onClick={confirmSelection}>Use selections</button></div>
        </div>

        <style jsx global>{`
          .npc-forge-portrait-picker-backdrop{z-index:1095}.npc-forge-visual-picker{width:min(1180px,94vw);max-width:none}.npc-forge-visual-picker-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.8fr);gap:14px;min-height:0}.npc-forge-visual-picker-pane{display:flex;flex-direction:column;min-width:0;min-height:0;gap:8px;border:1px solid rgba(176,132,255,.24);border-radius:12px;background:rgba(10,12,21,.72);padding:10px}.npc-forge-visual-picker-title{display:flex;justify-content:space-between;gap:12px;align-items:center}.npc-forge-visual-picker-title span{color:rgba(255,255,255,.62);font-size:.72rem;text-align:right}.npc-forge-visual-picker-grid{max-height:54vh;overflow:auto}.npc-forge-sprite-list{display:grid;gap:6px;max-height:30vh;overflow:auto;padding-right:3px}.npc-forge-sprite-card{display:flex;justify-content:space-between;gap:10px;text-align:left;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.025);color:#eee;border-radius:9px;padding:9px 10px}.npc-forge-sprite-card:hover,.npc-forge-sprite-card.is-current{border-color:#aa66ff;background:rgba(137,75,255,.14)}.npc-forge-sprite-card span{display:grid;gap:3px}.npc-forge-sprite-card small{color:rgba(255,255,255,.58);font-size:.68rem}.npc-forge-sprite-card b{align-self:start;color:#84eadb;font-size:.64rem;text-transform:uppercase;letter-spacing:.04em}.npc-forge-sprite-preview-panel{display:grid;grid-template-columns:140px minmax(0,1fr);gap:12px;align-items:center;border-top:1px solid rgba(255,255,255,.1);padding-top:10px}.npc-forge-sprite-preview-stage{min-height:132px;display:grid;place-items:center;border-radius:10px;background:linear-gradient(135deg,rgba(49,39,68,.8),rgba(12,30,36,.78));overflow:hidden}.sprite-sheet-preview{position:relative;overflow:hidden}.sprite-sheet-preview.is-empty{display:grid;place-items:center;min-width:112px;min-height:112px;color:rgba(255,255,255,.45);font-size:.7rem}.npc-forge-sprite-preview-controls{display:grid;gap:8px}.npc-forge-sprite-preview-controls label{display:grid;gap:4px}.npc-forge-sprite-preview-controls select{width:100%}.npc-forge-preview-toggle{grid-template-columns:auto 1fr!important;align-items:center}.npc-forge-sprite-preview-controls small{color:rgba(255,255,255,.58)}.npc-forge-visual-picker-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px}.npc-forge-visual-picker-footer>div{display:flex;gap:8px}.npc-forge-visual-picker-footer>span{color:rgba(255,255,255,.6);font-size:.72rem}@media(max-width:900px){.npc-forge-visual-picker-layout{grid-template-columns:1fr}.npc-forge-visual-picker-grid{max-height:34vh}.npc-forge-sprite-list{max-height:24vh}}@media(max-width:560px){.npc-forge-sprite-preview-panel{grid-template-columns:1fr}.npc-forge-visual-picker-footer{align-items:stretch;flex-direction:column}.npc-forge-visual-picker-footer>div{justify-content:flex-end}}
        `}</style>
      </div>
    </div>
  );
}

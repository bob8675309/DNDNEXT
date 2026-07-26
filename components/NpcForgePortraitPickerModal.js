import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { NPC_PORTRAIT_BUCKET, publicPortraitUrl } from "../utils/characterPortraits";

function text(value) { return String(value ?? "").trim(); }

function portraitUrl(row) {
  const direct = text(row?.public_url);
  if (direct) return direct;
  return publicPortraitUrl(supabase, row?.storage_path, row?.bucket || NPC_PORTRAIT_BUCKET);
}

function assetSummary(asset) {
  if (!asset) return "Portrait only";
  const dirs = Array.isArray(asset.direction_order) ? asset.direction_order.length : 0;
  const walk = Array.isArray(asset.walk_frames) ? asset.walk_frames.length : 0;
  return `${dirs || 4}-direction • ${asset.frame_width || 32}×${asset.frame_height || 32} • idle + ${walk || 3} walk`;
}

export default function NpcForgePortraitPickerModal({
  show = false,
  currentPortraitId = "",
  onClose,
  onSelect,
}) {
  const [portraits, setPortraits] = useState([]);
  const [assets, setAssets] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      const [portraitRes, assetRes] = await Promise.all([
        supabase
          .from("npc_portrait_library")
          .select("id,name,bucket,storage_path,public_url,category,tags,species_tags,profession_tags,theme_tags,width,height,aspect_ratio,sort_order,is_active")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("npc_visual_assets")
          .select("id,portrait_library_id,name,sprite_bucket,sprite_path,sprite_format,frame_width,frame_height,direction_order,idle_frame,walk_frames,fps,default_scale,is_default,is_active")
          .eq("is_active", true)
          .order("is_default", { ascending: false })
          .order("name", { ascending: true }),
      ]);
      if (!active) return;
      if (portraitRes.error) {
        setError(portraitRes.error.message || "Could not load portrait library.");
        setPortraits([]);
      } else {
        setPortraits(portraitRes.data || []);
      }
      // Keep portraits usable if an older database has not received the visual-asset migration yet.
      if (!assetRes.error) setAssets(assetRes.data || []);
      else setAssets([]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [show]);

  const assetByPortrait = useMemo(() => {
    const map = new Map();
    for (const asset of assets || []) {
      const key = String(asset?.portrait_library_id || "");
      if (!key || map.has(key)) continue;
      map.set(key, asset);
    }
    return map;
  }, [assets]);

  const filtered = useMemo(() => {
    const q = text(query).toLowerCase();
    if (!q) return portraits;
    return (portraits || []).filter((row) => [
      row?.name,
      row?.category,
      ...(Array.isArray(row?.tags) ? row.tags : []),
      ...(Array.isArray(row?.species_tags) ? row.species_tags : []),
      ...(Array.isArray(row?.profession_tags) ? row.profession_tags : []),
      ...(Array.isArray(row?.theme_tags) ? row.theme_tags : []),
    ].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [portraits, query]);

  if (!show) return null;

  function choose(row) {
    const asset = assetByPortrait.get(String(row.id)) || null;
    const url = portraitUrl(row);
    onSelect?.({
      portraitLibraryId: String(row.id),
      portraitName: row.name || "Portrait",
      portraitUrl: url || "",
      portraitStoragePath: row.storage_path || "",
      portraitThumbUrl: url || "",
      portraitShopUrl: url || "",
      portraitSource: "library",
      visualAssetId: asset?.id ? String(asset.id) : "",
      spriteKey: asset?.id ? String(asset.id) : "",
      spritePath: asset?.sprite_path || "",
      spriteScale: Number(asset?.default_scale || 0.7),
      spriteAsset: asset,
    });
    onClose?.();
  }

  return (
    <div className="portrait-picker-backdrop npc-forge-portrait-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? onClose?.() : null}>
      <div className="portrait-picker-modal" role="dialog" aria-modal="true" aria-label="Choose portrait and linked sprite">
        <div className="portrait-picker-head">
          <div>
            <div className="portrait-picker-kicker">Character visual identity</div>
            <h3>Choose portrait</h3>
            <p>Portraits can carry a pre-built map sprite association. Existing 4-direction sprites remain supported; new portrait-linked assets can use richer metadata.</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
        </div>
        <div className="portrait-picker-toolbar">
          <input className="form-control form-control-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, species, profession, theme…" />
          <span>{loading ? "Loading…" : `${filtered.length} shown`}</span>
        </div>
        {error ? <div className="portrait-picker-alert">{error}</div> : null}
        <div className="portrait-picker-grid">
          {filtered.map((row) => {
            const url = portraitUrl(row);
            const asset = assetByPortrait.get(String(row.id)) || null;
            const current = String(currentPortraitId || "") === String(row.id);
            return (
              <button key={row.id} type="button" className={`portrait-picker-card ${current ? "is-current" : ""}`} onClick={() => choose(row)}>
                <span className="portrait-picker-image">{url ? <img src={url} alt="" loading="lazy" /> : <span>No image</span>}</span>
                <span className="portrait-picker-name">{row.name || row.storage_path || "Portrait"}</span>
                <span className={`npc-forge-portrait-sprite-status ${asset ? "has-sprite" : ""}`}>{assetSummary(asset)}</span>
                {current ? <span className="portrait-picker-current">Selected</span> : null}
              </button>
            );
          })}
          {!loading && !filtered.length ? <div className="portrait-picker-empty">No portraits match that search.</div> : null}
        </div>
        <style jsx global>{`
          .npc-forge-portrait-sprite-status{display:block;margin-top:4px;color:rgba(255,255,255,.55);font-size:.66rem;line-height:1.25}.npc-forge-portrait-sprite-status.has-sprite{color:#8ceadd}.npc-forge-portrait-picker-backdrop{z-index:1095}
        `}</style>
      </div>
    </div>
  );
}

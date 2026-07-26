import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SpriteSheetPreview from "../../components/SpriteSheetPreview";
import { supabase } from "../../utils/supabaseClient";

const DIRECTION_ORDER = Object.freeze(["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"]);
const WALK_FRAMES = Object.freeze([1, 2, 3]);
const FRAME_W = 64;
const FRAME_H = 64;
const SHEET_W = FRAME_W * 4;
const SHEET_H = FRAME_H * 8;

function text(value) { return String(value ?? "").trim(); }
function slug(value) { return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54) || "sprite"; }
function tags(value) { return Array.from(new Set(text(value).split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean))); }

function publicSpriteUrl(asset) {
  if (!asset?.sprite_path) return "";
  try { return supabase.storage.from(asset.sprite_bucket || "map-icons").getPublicUrl(asset.sprite_path).data?.publicUrl || ""; }
  catch { return ""; }
}

async function inspectSpriteFile(file) {
  if (!file) throw new Error("Choose a PNG sprite sheet.");
  if (file.type !== "image/png" && !/\.png$/i.test(file.name || "")) throw new Error("Production sprite sheets must be PNG files.");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read sprite image."));
      img.src = url;
    });
    if (image.naturalWidth !== SHEET_W || image.naturalHeight !== SHEET_H) {
      throw new Error(`Sprite sheet must be exactly ${SHEET_W}×${SHEET_H}px (${FRAME_W}×${FRAME_H} frames, 4 columns × 8 rows). This file is ${image.naturalWidth}×${image.naturalHeight}px.`);
    }
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparentPixels = 0;
    const sampleStep = 16;
    for (let index = 3; index < pixels.length; index += 4 * sampleStep) if (pixels[index] < 250) transparentPixels += 1;
    if (!transparentPixels) throw new Error("Sprite sheet needs a transparent background; no transparent pixels were detected.");
    return { width: image.naturalWidth, height: image.naturalHeight, transparent: true };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function emptyForm() {
  return {
    id: "",
    name: "",
    spritePath: "",
    speciesTags: "",
    roleTags: "",
    themeTags: "",
    overworldScale: "0.35",
    tacticalScale: "1.0",
    fps: "7",
    notes: "",
    active: true,
  };
}

export default function SpriteAssetsAdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assets, setAssets] = useState([]);
  const [portraits, setPortraits] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(() => emptyForm());
  const [file, setFile] = useState(null);
  const [fileCheck, setFileCheck] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [suggestionPortraitId, setSuggestionPortraitId] = useState("");
  const [suggestionAssetId, setSuggestionAssetId] = useState("");
  const [suggestionRank, setSuggestionRank] = useState("1");
  const [suggestionPrimary, setSuggestionPrimary] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (!sessionData?.session?.user) { setAuthChecked(true); return; }
      const { data } = await supabase.rpc("is_admin");
      if (!active) return;
      setIsAdmin(Boolean(data));
      setAuthChecked(true);
    })();
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [assetRes, portraitRes, suggestionRes] = await Promise.all([
      supabase.from("npc_visual_assets").select("id,name,sprite_bucket,sprite_path,sprite_format,frame_width,frame_height,direction_order,idle_frame,walk_frames,fps,default_scale,overworld_scale,tactical_scale,species_tags,role_tags,theme_tags,is_active,notes,created_at,updated_at").order("name"),
      supabase.from("npc_portrait_library").select("id,name,storage_path,public_url,is_active").eq("is_active", true).order("name"),
      supabase.from("portrait_sprite_suggestions").select("portrait_library_id,visual_asset_id,suggestion_rank,is_primary,notes").order("suggestion_rank"),
    ]);
    if (assetRes.error || portraitRes.error || suggestionRes.error) setError((assetRes.error || portraitRes.error || suggestionRes.error)?.message || "Could not load sprite library.");
    setAssets(assetRes.data || []);
    setPortraits(portraitRes.data || []);
    setSuggestions(suggestionRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (authChecked && isAdmin) load(); }, [authChecked, isAdmin, load]);

  const filteredAssets = useMemo(() => {
    const q = text(query).toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) => [asset.name, asset.sprite_path, ...(asset.species_tags || []), ...(asset.role_tags || []), ...(asset.theme_tags || []), asset.notes].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [assets, query]);

  const suggestionCounts = useMemo(() => {
    const map = new Map();
    suggestions.forEach((row) => map.set(String(row.visual_asset_id), (map.get(String(row.visual_asset_id)) || 0) + 1));
    return map;
  }, [suggestions]);

  function patchForm(values) { setForm((current) => ({ ...current, ...values })); setMessage(""); setError(""); }

  async function chooseFile(event) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setFileCheck(null);
    setMessage("");
    setError("");
    if (!selected) return;
    try { setFileCheck(await inspectSpriteFile(selected)); }
    catch (inspectionError) { setError(inspectionError.message || "Sprite validation failed."); }
  }

  function editAsset(asset) {
    setForm({
      id: asset.id,
      name: asset.name || "",
      spritePath: asset.sprite_path || "",
      speciesTags: (asset.species_tags || []).join(", "),
      roleTags: (asset.role_tags || []).join(", "),
      themeTags: (asset.theme_tags || []).join(", "),
      overworldScale: String(asset.overworld_scale ?? asset.default_scale ?? 0.35),
      tacticalScale: String(asset.tactical_scale ?? 1),
      fps: String(asset.fps ?? 7),
      notes: asset.notes || "",
      active: asset.is_active !== false,
    });
    setFile(null);
    setFileCheck(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAsset() {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    let path = text(form.spritePath);
    try {
      if (file) {
        const inspection = fileCheck || await inspectSpriteFile(file);
        if (!inspection?.transparent) throw new Error("Sprite transparency validation did not pass.");
        path = `npc-sprites/${slug(form.name)}-${Date.now()}.png`;
        const upload = await supabase.storage.from("map-icons").upload(path, file, { cacheControl: "3600", upsert: false, contentType: "image/png" });
        if (upload.error) throw upload.error;
      }
      if (!text(form.name)) throw new Error("Sprite name is required.");
      if (!path) throw new Error("Upload a sprite sheet or provide an existing map-icons path.");
      const payload = {
        id: form.id || undefined,
        name: text(form.name),
        sprite_bucket: "map-icons",
        sprite_path: path,
        sprite_format: "eight_direction_idle_walk_v1",
        frame_width: FRAME_W,
        frame_height: FRAME_H,
        direction_order: DIRECTION_ORDER,
        idle_frame: 0,
        walk_frames: WALK_FRAMES,
        fps: Number(form.fps || 7),
        overworld_scale: Number(form.overworldScale || 0.35),
        tactical_scale: Number(form.tacticalScale || 1),
        species_tags: tags(form.speciesTags),
        role_tags: tags(form.roleTags),
        theme_tags: tags(form.themeTags),
        notes: text(form.notes) || null,
        is_active: Boolean(form.active),
      };
      const { data, error: saveError } = await supabase.rpc("admin_upsert_sprite_asset_v1", { p_payload: payload });
      if (saveError) throw saveError;
      setMessage(`${payload.name} saved to the sprite library.`);
      setForm(emptyForm());
      setFile(null);
      setFileCheck(null);
      if (data) setSuggestionAssetId(String(data));
      await load();
    } catch (saveError) {
      setError(saveError.message || "Could not save sprite asset.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveAsset(asset) {
    if (!asset?.id || !window.confirm(`Archive ${asset.name}? Existing character references stay intact, but the sprite will disappear from new selection lists.`)) return;
    setError(""); setMessage("");
    const { error: archiveError } = await supabase.rpc("admin_archive_sprite_asset_v1", { p_visual_asset_id: asset.id });
    if (archiveError) setError(archiveError.message || "Could not archive sprite.");
    else { setMessage(`${asset.name} archived.`); await load(); }
  }

  async function saveSuggestion() {
    if (!suggestionPortraitId || !suggestionAssetId) { setError("Choose both a portrait and a sprite."); return; }
    setError(""); setMessage("");
    const { error: suggestionError } = await supabase.rpc("admin_set_portrait_sprite_suggestion_v1", {
      p_portrait_library_id: suggestionPortraitId,
      p_visual_asset_id: suggestionAssetId,
      p_suggestion_rank: Math.max(1, Number(suggestionRank || 1)),
      p_is_primary: suggestionPrimary,
      p_notes: null,
    });
    if (suggestionError) setError(suggestionError.message || "Could not save suggestion.");
    else { setMessage("Portrait/sprite suggestion saved. It remains optional in the creator."); await load(); }
  }

  if (!authChecked) return <main className="container my-4"><div className="text-muted">Checking admin access…</div></main>;
  if (!isAdmin) return <main className="container my-4"><h1 className="h4">Sprite Library</h1><p className="text-muted">Admin access is required.</p></main>;

  return (
    <main className="container-fluid my-3 px-3 admin-dark sprite-assets-admin">
      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
        <div><div className="spell-admin-kicker">Character Visuals</div><h1 className="h3 mb-1">8-Direction Sprite Library</h1><div className="small text-muted">Production contract: {SHEET_W}×{SHEET_H}px PNG, eight 64px directional rows, idle + three walking frames. Portraits only suggest sprites; they never force them.</div></div>
        <div className="d-flex gap-2"><Link href="/admin/character-options" className="btn btn-sm btn-outline-light">Character Options</Link><Link href="/admin" className="btn btn-sm btn-outline-light">Admin</Link></div>
      </div>

      {message ? <div className="alert alert-success py-2">{message}</div> : null}
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <section className="npc-card sprite-admin-sticky">
            <div className="npc-card-title">{form.id ? "Edit sprite" : "Register sprite"}</div>
            <div className="small text-muted mb-3">Only vetted sheets should enter this catalogue. Upload validation checks exact packing dimensions and transparent background.</div>
            <div className="row g-2">
              <div className="col-12"><label className="form-label small">Name</label><input className="form-control" value={form.name} onChange={(event) => patchForm({ name: event.target.value })} placeholder="Human Ranger — green cloak" /></div>
              <div className="col-12"><label className="form-label small">PNG upload</label><input type="file" accept="image/png,.png" className="form-control" onChange={chooseFile} />{fileCheck ? <div className="small text-success mt-1">Validated: {fileCheck.width}×{fileCheck.height}px with transparency.</div> : null}</div>
              <div className="col-12"><label className="form-label small">Existing map-icons path</label><input className="form-control" value={form.spritePath} onChange={(event) => patchForm({ spritePath: event.target.value })} placeholder="npc-sprites/example.png" /><div className="small text-muted mt-1">Use this instead of upload when the PNG already exists in Storage.</div></div>
              <div className="col-6"><label className="form-label small">Overworld scale</label><input type="number" step="0.05" min="0.05" className="form-control" value={form.overworldScale} onChange={(event) => patchForm({ overworldScale: event.target.value })} /></div>
              <div className="col-6"><label className="form-label small">Tactical scale</label><input type="number" step="0.05" min="0.05" className="form-control" value={form.tacticalScale} onChange={(event) => patchForm({ tacticalScale: event.target.value })} /></div>
              <div className="col-6"><label className="form-label small">Animation FPS</label><input type="number" step="1" min="1" max="20" className="form-control" value={form.fps} onChange={(event) => patchForm({ fps: event.target.value })} /></div>
              <div className="col-6 d-flex align-items-end"><label className="form-check mb-2"><input className="form-check-input" type="checkbox" checked={form.active} onChange={(event) => patchForm({ active: event.target.checked })} /><span className="form-check-label ms-1">Active</span></label></div>
              <div className="col-12"><label className="form-label small">Species tags</label><input className="form-control" value={form.speciesTags} onChange={(event) => patchForm({ speciesTags: event.target.value })} placeholder="human, elf, hobgoblin" /></div>
              <div className="col-12"><label className="form-label small">Role tags</label><input className="form-control" value={form.roleTags} onChange={(event) => patchForm({ roleTags: event.target.value })} placeholder="ranger, merchant, mage" /></div>
              <div className="col-12"><label className="form-label small">Theme tags</label><input className="form-control" value={form.themeTags} onChange={(event) => patchForm({ themeTags: event.target.value })} placeholder="forest, scholar, armored" /></div>
              <div className="col-12"><label className="form-label small">Notes</label><textarea className="form-control" rows="3" value={form.notes} onChange={(event) => patchForm({ notes: event.target.value })} placeholder="Art batch, visual notes, source reference…" /></div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3"><button className="btn btn-sm btn-outline-light" type="button" onClick={() => { setForm(emptyForm()); setFile(null); setFileCheck(null); }}>Clear</button><button className="btn btn-sm btn-warning" type="button" disabled={saving} onClick={saveAsset}>{saving ? "Saving…" : form.id ? "Save changes" : "Register sprite"}</button></div>
          </section>

          <section className="npc-card mt-3">
            <div className="npc-card-title">Suggest a portrait match</div>
            <div className="small text-muted mb-2">Suggestions change sorting/badges only. The creator can still choose any other sprite.</div>
            <label className="form-label small">Portrait</label><select className="form-select mb-2" value={suggestionPortraitId} onChange={(event) => setSuggestionPortraitId(event.target.value)}><option value="">Choose portrait</option>{portraits.map((portrait) => <option key={portrait.id} value={portrait.id}>{portrait.name}</option>)}</select>
            <label className="form-label small">Sprite</label><select className="form-select mb-2" value={suggestionAssetId} onChange={(event) => setSuggestionAssetId(event.target.value)}><option value="">Choose sprite</option>{assets.filter((asset) => asset.is_active !== false).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select>
            <div className="row g-2"><div className="col-6"><label className="form-label small">Rank</label><input type="number" min="1" className="form-control" value={suggestionRank} onChange={(event) => setSuggestionRank(event.target.value)} /></div><div className="col-6 d-flex align-items-end"><label className="form-check mb-2"><input className="form-check-input" type="checkbox" checked={suggestionPrimary} onChange={(event) => setSuggestionPrimary(event.target.checked)} /><span className="form-check-label ms-1">Primary match</span></label></div></div>
            <button className="btn btn-sm btn-outline-info w-100 mt-2" type="button" onClick={saveSuggestion}>Save suggestion</button>
          </section>
        </div>

        <div className="col-12 col-xl-8">
          <section className="npc-card">
            <div className="d-flex justify-content-between gap-3 align-items-end flex-wrap mb-3"><div><div className="npc-card-title">Registered sprites</div><div className="small text-muted">{assets.filter((asset) => asset.is_active !== false).length} active • {assets.length} total</div></div><input className="form-control sprite-admin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, species, role, theme…" /></div>
            {loading ? <div className="text-muted">Loading sprite library…</div> : null}
            <div className="sprite-admin-grid">
              {filteredAssets.map((asset) => {
                const url = publicSpriteUrl(asset);
                return <article key={asset.id} className={`sprite-admin-card ${asset.is_active === false ? "is-archived" : ""}`}>
                  <div className="sprite-admin-preview"><SpriteSheetPreview asset={asset} spriteUrl={url} direction="down" walking displaySize={104} /></div>
                  <div className="sprite-admin-copy"><div className="d-flex align-items-start justify-content-between gap-2"><div><strong>{asset.name}</strong><div className="small text-muted">{asset.frame_width}×{asset.frame_height} • {asset.direction_order?.length || 0} directions • {asset.fps} FPS</div></div><span className={`badge ${asset.is_active === false ? "text-bg-secondary" : "text-bg-success"}`}>{asset.is_active === false ? "Archived" : "Active"}</span></div><div className="small mt-2 text-break">{asset.sprite_path}</div><div className="small text-muted mt-1">Overworld ×{asset.overworld_scale} • Tactical ×{asset.tactical_scale} • {suggestionCounts.get(String(asset.id)) || 0} suggested portraits</div>{asset.species_tags?.length ? <div className="sprite-admin-tags mt-2">{asset.species_tags.map((tag) => <span key={`s-${tag}`}>{tag}</span>)}</div> : null}{asset.role_tags?.length ? <div className="sprite-admin-tags mt-1">{asset.role_tags.map((tag) => <span key={`r-${tag}`}>{tag}</span>)}</div> : null}{asset.notes ? <div className="small mt-2">{asset.notes}</div> : null}<div className="d-flex gap-2 mt-3"><button className="btn btn-sm btn-outline-light" type="button" onClick={() => editAsset(asset)}>Edit</button>{asset.is_active !== false ? <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => archiveAsset(asset)}>Archive</button> : null}</div></div>
                </article>;
              })}
              {!loading && !filteredAssets.length ? <div className="text-muted">No sprites match this search. Register the first approved 8-direction sheet using the form.</div> : null}
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .sprite-admin-sticky{position:sticky;top:1rem}.sprite-admin-search{max-width:420px}.sprite-admin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:.75rem}.sprite-admin-card{display:grid;grid-template-columns:118px minmax(0,1fr);gap:.75rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);border-radius:.75rem;padding:.7rem}.sprite-admin-card.is-archived{opacity:.55}.sprite-admin-preview{display:grid;place-items:center;min-height:118px;border-radius:.6rem;background:linear-gradient(135deg,rgba(72,48,91,.6),rgba(15,39,45,.65));overflow:hidden}.sprite-admin-copy{min-width:0}.sprite-admin-tags{display:flex;gap:.3rem;flex-wrap:wrap}.sprite-admin-tags span{font-size:.67rem;border:1px solid rgba(135,215,206,.3);background:rgba(70,167,157,.1);padding:.12rem .35rem;border-radius:999px}@media(max-width:1199px){.sprite-admin-sticky{position:static}}@media(max-width:520px){.sprite-admin-card{grid-template-columns:1fr}.sprite-admin-search{max-width:none;width:100%}}
      `}</style>
    </main>
  );
}

import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) {
    console.warn(`${label}: expected one match, found ${count}; leaving source unchanged.`);
    return source;
  }
  return source.replace(before, after);
}

function write(filePath, original, source, label) {
  if (source !== original) {
    fs.writeFileSync(filePath, source, "utf8");
    console.log(`Applied ${label}.`);
  } else {
    console.log(`${label} already current or anchors not present.`);
  }
}

function patchCharacterCreation() {
  const filePath = path.join(process.cwd(), "utils", "characterCreation.js");
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;
  source = replaceOnce(source, '    appearance: cleanText(draft.appearance),', '    appearance: cleanText(draft.appearance),\n    portrait: {\n      url: cleanText(draft.portraitUrl),\n      storagePath: cleanText(draft.portraitStoragePath),\n      thumbUrl: cleanText(draft.portraitThumbUrl),\n      shopUrl: cleanText(draft.portraitShopUrl),\n      source: cleanText(draft.portraitSource) || "default",\n      prompt: cleanText(draft.portraitPrompt),\n      recommendedMasterSize: "1536x2048",\n      aspectRatio: "3:4",\n    },', "character sheet portrait object");
  source = replaceOnce(source, '    storefront_tagline: kind === "merchant" && Boolean(draft.storefrontEnabled ?? true) ? cleanText(draft.storefrontTagline) || null : null,\n    location_id:', '    storefront_tagline: kind === "merchant" && Boolean(draft.storefrontEnabled ?? true) ? cleanText(draft.storefrontTagline) || null : null,\n    portrait_url: cleanText(draft.portraitUrl) || null,\n    portrait_storage_path: cleanText(draft.portraitStoragePath) || null,\n    portrait_thumb_url: cleanText(draft.portraitThumbUrl) || null,\n    portrait_shop_url: cleanText(draft.portraitShopUrl) || null,\n    portrait_source: cleanText(draft.portraitSource) || (cleanText(draft.portraitUrl) || cleanText(draft.portraitStoragePath) ? "upload" : "default"),\n    portrait_prompt: cleanText(draft.portraitPrompt) || null,\n    image_url: cleanText(draft.portraitUrl) || null,\n    location_id:', "character create payload portrait fields");
  write(filePath, original, source, "character creation portrait payload patch");
}

function patchNewNpcModal() {
  const filePath = path.join(process.cwd(), "components", "NewNpcModal.js");
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;
  source = replaceOnce(source, 'import { useMemo, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";', "NewNpcModal useEffect import");
  if (!source.includes('from "../utils/characterPortraits"')) {
    source = replaceOnce(source, '} from "../utils/characterCreation";', '} from "../utils/characterCreation";\nimport { NPC_PORTRAIT_ASPECT_RATIO, NPC_PORTRAIT_BUCKET, NPC_PORTRAIT_MINIMUM_SIZE, NPC_PORTRAIT_RECOMMENDED_SIZE, publicPortraitUrl, slugifyPortraitName } from "../utils/characterPortraits";', "NewNpcModal portrait helper import");
  }
  source = replaceOnce(source, '    storefrontTagline: "",\n  };', '    storefrontTagline: "",\n    portraitUrl: "",\n    portraitStoragePath: "",\n    portraitThumbUrl: "",\n    portraitShopUrl: "",\n    portraitSource: "default",\n    portraitPrompt: "",\n  };', "NewNpcModal initial portrait fields");
  source = replaceOnce(source, '  const [tagInput, setTagInput] = useState("");', '  const [tagInput, setTagInput] = useState("");\n  const [portraitLibrary, setPortraitLibrary] = useState([]);\n  const [portraitUploading, setPortraitUploading] = useState(false);', "NewNpcModal portrait state");
  source = replaceOnce(source, '  const availableFeats = useMemo(() => FEAT_OPTIONS.filter((feat) => feat.minimumLevel <= Number(draft.level || 1)), [draft.level]);', '  const availableFeats = useMemo(() => FEAT_OPTIONS.filter((feat) => feat.minimumLevel <= Number(draft.level || 1)), [draft.level]);\n  const portraitPreviewUrl = draft.portraitUrl || publicPortraitUrl(supabase, draft.portraitStoragePath);\n\n  useEffect(() => {\n    let cancelled = false;\n    async function loadPortraitLibrary() {\n      const { data, error } = await supabase\n        .from("npc_portrait_library")\n        .select("id,name,bucket,storage_path,public_url,category,tags,profession_tags,theme_tags,sort_order")\n        .eq("is_active", true)\n        .order("sort_order", { ascending: true })\n        .order("name", { ascending: true })\n        .limit(96);\n      if (cancelled) return;\n      if (error) {\n        console.warn("Portrait library load failed", error.message);\n        setPortraitLibrary([]);\n        return;\n      }\n      setPortraitLibrary(data || []);\n    }\n    loadPortraitLibrary();\n    return () => { cancelled = true; };\n  }, []);', "NewNpcModal portrait library loader");
  source = replaceOnce(source, '  function addTag() {\n    const value = String(tagInput || "").trim().toLowerCase();\n    if (!value) return;\n    patch({ tags: Array.from(new Set([...(draft.tags || []), value])) });\n    setTagInput("");\n  }', '  function addTag() {\n    const value = String(tagInput || "").trim().toLowerCase();\n    if (!value) return;\n    patch({ tags: Array.from(new Set([...(draft.tags || []), value])) });\n    setTagInput("");\n  }\n\n  function choosePortrait(row) {\n    const storagePath = row?.storage_path || "";\n    const url = row?.public_url || publicPortraitUrl(supabase, storagePath, row?.bucket || NPC_PORTRAIT_BUCKET);\n    patch({ portraitUrl: url, portraitStoragePath: storagePath, portraitThumbUrl: url, portraitShopUrl: url, portraitSource: "library" });\n  }\n\n  async function uploadPortraitFile(file) {\n    if (!file) return;\n    setPortraitUploading(true);\n    setError("");\n    try {\n      const ext = String(file.name || "portrait.webp").split(".").pop()?.toLowerCase() || "webp";\n      const base = slugifyPortraitName(draft.name || draft.role || "new-npc");\n      const storagePath = `inbox/npc-forge/${Date.now()}-${base}.${ext}`;\n      const { error: uploadError } = await supabase.storage.from(NPC_PORTRAIT_BUCKET).upload(storagePath, file, { upsert: true, contentType: file.type || undefined });\n      if (uploadError) throw uploadError;\n      const url = publicPortraitUrl(supabase, storagePath);\n      patch({ portraitUrl: url, portraitStoragePath: storagePath, portraitThumbUrl: url, portraitShopUrl: url, portraitSource: "upload" });\n    } catch (err) {\n      setError(String(err?.message || err || "Portrait upload failed."));\n    } finally {\n      setPortraitUploading(false);\n    }\n  }', "NewNpcModal portrait helpers");

  const portraitSection = [
    '',
    '                <div className="npc-forge-subheading mt-4">Portrait</div>',
    '                <div className="npc-forge-portrait-tools">',
    '                  <div className="npc-forge-portrait-preview">',
    '                    {portraitPreviewUrl ? <img src={portraitPreviewUrl} alt={draft.name ? `${draft.name} portrait preview` : "NPC portrait preview"} /> : <div><strong>Portrait drop zone</strong><span>Recommended {NPC_PORTRAIT_RECOMMENDED_SIZE}, {NPC_PORTRAIT_ASPECT_RATIO}. Minimum {NPC_PORTRAIT_MINIMUM_SIZE}.</span></div>}',
    '                  </div>',
    '                  <div className="npc-forge-portrait-controls">',
    '                    <label><span>Upload portrait</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={portraitUploading || creating} onChange={(event) => uploadPortraitFile(event.target.files?.[0])} /></label>',
    '                    <label><span>Portrait URL</span><input value={draft.portraitUrl} onChange={(event) => patch({ portraitUrl: event.target.value, portraitSource: event.target.value ? "external" : draft.portraitSource })} placeholder="https://... or choose/upload below" /></label>',
    '                    <label><span>Storage path</span><input value={draft.portraitStoragePath} onChange={(event) => patch({ portraitStoragePath: event.target.value, portraitSource: event.target.value ? "library" : draft.portraitSource })} placeholder="library/smithing/dwarf-smith-01.webp" /></label>',
    '                    <label><span>Portrait prompt / notes</span><input value={draft.portraitPrompt} onChange={(event) => patch({ portraitPrompt: event.target.value })} placeholder="Optional generation prompt or source note" /></label>',
    '                    <small>{portraitUploading ? "Uploading portrait..." : `Bucket: ${NPC_PORTRAIT_BUCKET} • Use library/* for bulk drops and inbox/npc-forge/* for creator uploads.`}</small>',
    '                  </div>',
    '                </div>',
    '                {portraitLibrary.length ? <div className="npc-forge-portrait-library mt-2">{portraitLibrary.slice(0, 12).map((row) => { const url = row.public_url || publicPortraitUrl(supabase, row.storage_path, row.bucket || NPC_PORTRAIT_BUCKET); return <button key={row.id || row.storage_path} type="button" onClick={() => choosePortrait(row)} className={draft.portraitStoragePath === row.storage_path ? "is-active" : ""}>{url ? <img src={url} alt="" /> : <span>{row.category}</span>}<strong>{row.name}</strong><small>{row.category}</small></button>; })}</div> : <div className="npc-forge-callout mt-2"><strong>Portrait library ready</strong><span>Drop portraits into the {NPC_PORTRAIT_BUCKET} bucket and add rows to npc_portrait_library. Defaults are seeded as placeholders.</span></div>}',
    ''
  ].join('\n');
  source = replaceOnce(source, '                <div className="npc-forge-subheading mt-4">Additional feats</div>', `${portraitSection}\n                <div className="npc-forge-subheading mt-4">Additional feats</div>`, "NewNpcModal portrait section");
  source = replaceOnce(source, '            <div className="npc-forge-preview-label">Live sheet summary</div>', '            {portraitPreviewUrl ? <div className="npc-forge-preview-portrait"><img src={portraitPreviewUrl} alt="" /></div> : null}\n            <div className="npc-forge-preview-label">Live sheet summary</div>', "NewNpcModal portrait preview aside");
  write(filePath, original, source, "NewNpcModal portrait UI patch");
}

function patchNpcPanel() {
  const filePath = path.join(process.cwd(), "components", "NpcPanel.js");
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;
  if (!source.includes('from "../utils/characterPortraits"')) source = replaceOnce(source, 'import { supabase } from "../utils/supabaseClient";', 'import { supabase } from "../utils/supabaseClient";\nimport { resolveCharacterPortrait } from "../utils/characterPortraits";', "NpcPanel portrait import");
  source = replaceOnce(source, '            "map_icon_id",', '            "map_icon_id",\n            "portrait_url",\n            "portrait_storage_path",\n            "portrait_thumb_url",\n            "portrait_shop_url",\n            "portrait_source",\n            "image_url",', "NpcPanel portrait select fields");
  source = replaceOnce(source, '  const blurb = (view.description || "").toString().trim();', '  const blurb = (view.description || "").toString().trim();\n  const portrait = useMemo(() => resolveCharacterPortrait(view, supabase), [view]);', "NpcPanel portrait resolver");
  source = replaceOnce(source, '          <div className="npc-portrait" aria-hidden="true">\n            <div className="npc-portrait-placeholder">Portrait</div>\n          </div>', '          <div className="npc-portrait" aria-hidden="true">\n            {portrait.url ? <img src={portrait.url} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="npc-portrait-placeholder">Portrait</div>}\n          </div>', "NpcPanel portrait image");
  write(filePath, original, source, "NpcPanel portrait display patch");
}

function patchMerchantPanel() {
  const filePath = path.join(process.cwd(), "components", "MerchantPanel.js");
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;
  if (!source.includes('from "../utils/characterPortraits"')) source = replaceOnce(source, 'import { themeFromMerchant as detectTheme, Pill } from "../utils/merchantTheme";', 'import { themeFromMerchant as detectTheme, Pill } from "../utils/merchantTheme";\nimport { resolveCharacterPortrait } from "../utils/characterPortraits";', "MerchantPanel portrait import");
  source = replaceOnce(source, '  const theme = useMemo(() => detectTheme(merchant), [merchant]);', '  const theme = useMemo(() => detectTheme(merchant), [merchant]);\n  const merchantPortrait = useMemo(() => resolveCharacterPortrait(merchant, supabase), [merchant]);', "MerchantPanel portrait resolver");
  source = replaceOnce(source, '    merchant?.bgImageUrl ||\n    merchant?.bgUrl ||\n    "/parchment.jpg";', '    merchant?.bgImageUrl ||\n    merchant?.bgUrl ||\n    merchantPortrait.url ||\n    "/parchment.jpg";', "MerchantPanel portrait fallback background");
  write(filePath, original, source, "MerchantPanel portrait fallback patch");
}

function patchTownPage() {
  const filePath = path.join(process.cwd(), "pages", "town", "[id].js");
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;
  source = replaceOnce(source, '    storefront_bg_video_url: row.storefront_bg_video_url || null,\n    tags:', '    storefront_bg_video_url: row.storefront_bg_video_url || null,\n    portrait_url: row.portrait_url || null,\n    portrait_storage_path: row.portrait_storage_path || null,\n    portrait_thumb_url: row.portrait_thumb_url || null,\n    portrait_shop_url: row.portrait_shop_url || null,\n    portrait_source: row.portrait_source || null,\n    image_url: row.image_url || null,\n    character_sheet: row.character_sheets?.sheet || row.character_sheet || null,\n    tags:', "Town merchant portrait normalization");
  source = replaceOnce(source, '.select("id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id,tags")', '.select("id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id,tags,portrait_url,portrait_storage_path,portrait_thumb_url,portrait_shop_url,portrait_source,image_url")', "Town roster portrait select");
  source = replaceOnce(source, '          "storefront_bg_video_url",\n          "tags",', '          "storefront_bg_video_url",\n          "portrait_url",\n          "portrait_storage_path",\n          "portrait_thumb_url",\n          "portrait_shop_url",\n          "portrait_source",\n          "image_url",\n          "character_sheets(sheet)",\n          "tags",', "Town merchant portrait select");
  write(filePath, original, source, "Town portrait select/normalization patch");
}

function patchItemsCrafterPortrait() {
  const filePath = path.join(process.cwd(), "pages", "items.js");
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;
  if (!source.includes('from "../utils/characterPortraits"')) source = replaceOnce(source, 'import { supabase } from "../utils/supabaseClient";', 'import { supabase } from "../utils/supabaseClient";\nimport { resolveCharacterPortrait } from "../utils/characterPortraits";', "items portrait import");
  source = replaceOnce(source, '  const activeCrafterContext = requestedCrafter ? { character: requestedCrafter, sheet: requestedCrafter.character_sheet || {}, townValid: requestedCrafterTownValid } : null;', '  const activeCrafterContext = requestedCrafter ? { character: requestedCrafter, sheet: requestedCrafter.character_sheet || {}, townValid: requestedCrafterTownValid, portraitUrl: resolveCharacterPortrait(requestedCrafter, supabase).url } : null;', "items crafter portrait context");
  source = replaceOnce(source, '          <div className="craft-kicker">Crafter\'s Counter</div>', '          {crafterContext?.portraitUrl ? <div className="craft-provider-portrait"><img src={crafterContext.portraitUrl} alt="" /></div> : null}\n          <div className="craft-kicker">Crafter\'s Counter</div>', "items crafter portrait visual");
  write(filePath, original, source, "items crafter portrait patch");
}

function patchStyles() {
  const filePath = path.join(process.cwd(), "styles", "globals.scss");
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;
  const marker = "/* ===== NPC portrait foundation ===== */";
  if (!source.includes(marker)) {
    source += `\n\n${marker}\n.npc-forge-portrait-tools { display: grid; grid-template-columns: minmax(160px, 240px) 1fr; gap: 1rem; align-items: stretch; }\n.npc-forge-portrait-preview { min-height: 270px; border: 1px solid rgba(148, 118, 196, .45); border-radius: 18px; overflow: hidden; background: radial-gradient(circle at 30% 20%, rgba(145, 95, 210, .18), rgba(14, 12, 23, .94)); display: grid; place-items: center; color: rgba(245,238,255,.75); text-align: center; padding: 1rem; }\n.npc-forge-portrait-preview img, .npc-forge-preview-portrait img, .npc-portrait img { width: 100%; height: 100%; object-fit: cover; display: block; }\n.npc-forge-portrait-preview strong { display: block; color: #fff4ca; }\n.npc-forge-portrait-preview span { display: block; font-size: .8rem; margin-top: .35rem; }\n.npc-forge-portrait-controls { display: grid; gap: .65rem; }\n.npc-forge-portrait-controls label { display: grid; gap: .25rem; }\n.npc-forge-portrait-library { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: .6rem; }\n.npc-forge-portrait-library button { min-height: 145px; border: 1px solid rgba(122, 96, 160, .45); border-radius: 14px; background: rgba(22, 18, 34, .82); color: #f5edff; padding: .5rem; text-align: left; overflow: hidden; }\n.npc-forge-portrait-library button.is-active { border-color: #e8b45b; box-shadow: 0 0 0 2px rgba(232,180,91,.18); }\n.npc-forge-portrait-library img { width: 100%; height: 92px; object-fit: cover; border-radius: 10px; margin-bottom: .35rem; }\n.npc-forge-portrait-library strong, .npc-forge-portrait-library small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.npc-forge-preview-portrait { height: 260px; border-radius: 20px; overflow: hidden; border: 1px solid rgba(226,176,92,.45); margin-bottom: 1rem; background: rgba(10,8,16,.7); }\n.npc-portrait { overflow: hidden; }\n.craft-provider-portrait { width: 118px; height: 150px; border-radius: 18px; overflow: hidden; border: 1px solid rgba(236, 192, 112, .52); float: left; margin: 0 1rem .75rem 0; background: rgba(13,11,19,.78); }\n.craft-provider-portrait img { width: 100%; height: 100%; object-fit: cover; display: block; }\n@media (max-width: 800px) { .npc-forge-portrait-tools { grid-template-columns: 1fr; } .craft-provider-portrait { float: none; width: 100%; max-width: 260px; height: 300px; } }\n`;
  }
  write(filePath, original, source, "NPC portrait styles patch");
}

patchCharacterCreation();
patchNewNpcModal();
patchNpcPanel();
patchMerchantPanel();
patchTownPage();
patchItemsCrafterPortrait();
patchStyles();

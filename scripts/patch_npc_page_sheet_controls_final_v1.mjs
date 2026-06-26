import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function write(rel, source) {
  fs.writeFileSync(path.join(process.cwd(), rel), source, "utf8");
}

function insertAfter(source, anchor, insertion, label) {
  if (source.includes(insertion.trim())) return source;
  const idx = source.indexOf(anchor);
  if (idx === -1) {
    console.warn(`${label}: anchor not found`);
    return source;
  }
  return `${source.slice(0, idx + anchor.length)}${insertion}${source.slice(idx + anchor.length)}`;
}

function replaceRegex(source, regex, replacement, label) {
  if (!regex.test(source)) {
    console.warn(`${label}: regex anchor not found`);
    return source;
  }
  regex.lastIndex = 0;
  return source.replace(regex, replacement);
}

let changedAny = false;

// -----------------------------------------------------------------------------
// CharacterSheetPanel: ensure Profile and Store can use in-panel actions.
// This script runs last in the NPC page cluster so generated patches cannot undo it.
// -----------------------------------------------------------------------------
{
  const rel = "components/CharacterSheetPanel.js";
  let source = read(rel);
  const original = source;

  if (!source.includes("onOpenProfile = null")) {
    source = source.replace(
      /metaLine = null,\n\s*inventoryHref = null,/,
      'metaLine = null,\n  profileHref = null,\n  profileText = "Profile",\n  onOpenProfile = null,\n  inventoryHref = null,'
    );
  }

  if (!source.includes("onOpenStore = null")) {
    source = source.replace(
      /storeHref = null,\n\s*storeText = "Store",/,
      'storeHref = null,\n  onOpenStore = null,\n  storeText = "Store",'
    );
  }

  if (source.includes('{storeHref ? (') && !source.includes('typeof onOpenStore === "function"')) {
    source = source.replace(
      /          \{storeHref \? \([\s\S]*?          \) : null\}/,
      `          {typeof onOpenStore === "function" ? (\n            <button\n              type="button"\n              className="btn btn-sm me-2"\n              onClick={onOpenStore}\n              title="Open this character's storefront"\n              style={{ backgroundColor: "#12c6ff", border: "0", color: "#001019" }}\n            >\n              {storeText}\n            </button>\n          ) : storeHref ? (\n            <a\n              className="btn btn-sm me-2"\n              href={storeHref}\n              target="_blank"\n              rel="noreferrer"\n              title="Open this character's storefront"\n              style={{ backgroundColor: "#12c6ff", border: "0", color: "#001019" }}\n            >\n              {storeText}\n            </a>\n          ) : null}`
    );
  }

  if (source !== original) {
    write(rel, source);
    changedAny = true;
    console.log("Finalized CharacterSheetPanel Profile/Store actions.");
  }
}

// -----------------------------------------------------------------------------
// NPC page: force final profile, portrait, sprite, sheet, shop, and delete controls.
// -----------------------------------------------------------------------------
{
  const rel = "pages/npcs.js";
  let source = read(rel);
  const original = source;

  // Imports needed for in-place panel, portrait picker, and sprite picker.
  if (!source.includes('import NpcPanel from "../components/NpcPanel";')) {
    source = insertAfter(source, 'import NewNpcModal from "../components/NewNpcModal";', '\nimport NpcPanel from "../components/NpcPanel";', "NpcPanel import");
  }
  if (!source.includes('import PortraitPickerModal from "../components/PortraitPickerModal";')) {
    source = insertAfter(source, 'import NewNpcModal from "../components/NewNpcModal";', '\nimport PortraitPickerModal from "../components/PortraitPickerModal";', "PortraitPicker import");
  }
  if (!source.includes('import SpritePickerModal from "../components/SpritePickerModal";')) {
    source = insertAfter(source, 'import MapIconPicker from "../components/MapIconPicker";', '\nimport SpritePickerModal from "../components/SpritePickerModal";', "SpritePicker import");
  }
  if (!source.includes('from "../utils/characterPortraits"')) {
    source = insertAfter(source, 'import { MAP_ICONS_BUCKET, LOCAL_FALLBACK_ICON, mapIconDisplay } from "../utils/mapIcons";', '\nimport { resolveCharacterPortrait } from "../utils/characterPortraits";', "character portrait import");
  }

  if (!source.includes('const NPC_SPRITE_BUCKET = "map-icons"')) {
    source = insertAfter(
      source,
      'const BORDER = "rgba(255,255,255,0.12)";\n',
      '\nconst NPC_SPRITE_BUCKET = "map-icons";\n\nfunction publicNpcSpriteUrl(spritePath) {\n  const clean = safeStr(spritePath);\n  if (!clean) return LOCAL_FALLBACK_ICON;\n  try {\n    return supabase.storage.from(NPC_SPRITE_BUCKET).getPublicUrl(clean).data?.publicUrl || LOCAL_FALLBACK_ICON;\n  } catch {\n    return LOCAL_FALLBACK_ICON;\n  }\n}\n',
      "NPC sprite helper"
    );
  }

  // Include portrait and sprite columns in character selects.
  source = source.replace(/"projected_destination_id",\n(?!\s*"portrait_url")/g, '"projected_destination_id",\n          "portrait_url",\n          "portrait_storage_path",\n          "portrait_thumb_url",\n          "portrait_shop_url",\n          "portrait_source",\n          "image_url",\n          "sprite_path",\n          "sprite_scale",\n          "camp_sprite_path",\n');
  source = source.replace(/"map_icon_id",\n(?!\s*"portrait_url"|\s*"sprite_path")/g, '"map_icon_id",\n          "portrait_url",\n          "portrait_storage_path",\n          "portrait_thumb_url",\n          "portrait_shop_url",\n          "portrait_source",\n          "image_url",\n          "sprite_path",\n          "sprite_scale",\n          "camp_sprite_path",\n');
  source = source.replace(/"status",\n\s*"updated_at",/g, '"status",\n          "portrait_url",\n          "portrait_storage_path",\n          "portrait_thumb_url",\n          "portrait_shop_url",\n          "portrait_source",\n          "image_url",\n          "updated_at",');

  // Normalize portrait and sprite fields onto roster rows.
  source = source.replace(/map_icon_id: n\.map_icon_id \?\? null,\n(?!\s*portrait_url|\s*sprite_path)/g, 'map_icon_id: n.map_icon_id ?? null,\n        portrait_url: n.portrait_url || null,\n        portrait_storage_path: n.portrait_storage_path || null,\n        portrait_thumb_url: n.portrait_thumb_url || null,\n        portrait_shop_url: n.portrait_shop_url || null,\n        portrait_source: n.portrait_source || null,\n        image_url: n.image_url || null,\n        sprite_path: n.sprite_path || null,\n        sprite_scale: n.sprite_scale ?? null,\n        camp_sprite_path: n.camp_sprite_path || null,\n');
  source = source.replace(/map_icon_id: m\.map_icon_id \?\? null,\n(?!\s*portrait_url|\s*sprite_path)/g, 'map_icon_id: m.map_icon_id ?? null,\n        portrait_url: m.portrait_url || prof.portrait_url || null,\n        portrait_storage_path: m.portrait_storage_path || prof.portrait_storage_path || null,\n        portrait_thumb_url: m.portrait_thumb_url || prof.portrait_thumb_url || null,\n        portrait_shop_url: m.portrait_shop_url || prof.portrait_shop_url || null,\n        portrait_source: m.portrait_source || prof.portrait_source || null,\n        image_url: m.image_url || prof.image_url || null,\n        sprite_path: m.sprite_path || null,\n        sprite_scale: m.sprite_scale ?? null,\n        camp_sprite_path: m.camp_sprite_path || null,\n');

  // State used by the portrait, profile, and sprite modals.
  if (!source.includes("const [portraitPickerOpen, setPortraitPickerOpen]")) {
    source = source.replace(
      /const \[showNewNpcModal, setShowNewNpcModal\] = useState\(false\);/,
      'const [showNewNpcModal, setShowNewNpcModal] = useState(false);\n  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);'
    );
  }
  if (!source.includes("const [profilePanelOpen, setProfilePanelOpen]")) {
    source = source.replace(
      /const \[showNewNpcModal, setShowNewNpcModal\] = useState\(false\);/,
      'const [showNewNpcModal, setShowNewNpcModal] = useState(false);\n  const [profilePanelOpen, setProfilePanelOpen] = useState(false);'
    );
  }
  if (!source.includes("const [profilePanelInitialView, setProfilePanelInitialView]")) {
    source = source.replace(
      /const \[profilePanelOpen, setProfilePanelOpen\] = useState\(false\);/,
      'const [profilePanelOpen, setProfilePanelOpen] = useState(false);\n  const [profilePanelInitialView, setProfilePanelInitialView] = useState("profile");'
    );
  }
  if (!source.includes("const [spritePickerOpen, setSpritePickerOpen]")) {
    source = source.replace(
      /const \[profilePanelInitialView, setProfilePanelInitialView\] = useState\("profile"\);/,
      'const [profilePanelInitialView, setProfilePanelInitialView] = useState("profile");\n  const [spritePickerOpen, setSpritePickerOpen] = useState(false);'
    );
  }

  // Selected portrait resolver for the NPC page profile thumb and portrait picker.
  if (!source.includes("const selectedPortrait = useMemo")) {
    source = source.replace(
      /  const selectedLocation = useMemo\(\(\) => \{\n    if \(!selected\?\.location_id\) return null;\n    return \(locations \|\| \[\]\)\.find\(\(l\) => String\(l\.id\) === String\(selected\.location_id\)\) \|\| null;\n  \}, \[selected\?\.location_id, locations\]\);/,
      `  const selectedLocation = useMemo(() => {\n    if (!selected?.location_id) return null;\n    return (locations || []).find((l) => String(l.id) === String(selected.location_id)) || null;\n  }, [selected?.location_id, locations]);\n\n  const selectedPortrait = useMemo(() => {\n    if (!selected) return { url: "", source: "none", storagePath: "" };\n    return resolveCharacterPortrait(selected, supabase);\n  }, [selected]);`
    );
  }

  const spritePatchFn = `  async function applySpritePatchToSelected(nextSpritePath) {\n    if (!selected?.id) return;\n    const previous = selected?.sprite_path || null;\n    const idStr = String(selected.id);\n    const patchLocal = (value) => {\n      setNpcs((rows) => (rows || []).map((row) => String(row.id) === idStr ? { ...row, sprite_path: value } : row));\n      setMerchants((rows) => (rows || []).map((row) => String(row.id) === idStr ? { ...row, sprite_path: value } : row));\n    };\n\n    patchLocal(nextSpritePath || null);\n    const upd = await supabase\n      .from("characters")\n      .update({ sprite_path: nextSpritePath || null, updated_at: new Date().toISOString() })\n      .eq("id", selected.id);\n\n    if (upd.error) {\n      console.error(upd.error);\n      patchLocal(previous);\n      alert(upd.error.message || "Failed to save NPC sprite");\n      return;\n    }\n\n    await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles()]);\n  }`;

  const portraitPatchFn = `  function applyPortraitPatchToSelected(patch) {\n    if (!selected?.id || !patch) return;\n    const idStr = String(selected.id);\n    const apply = (row) => (String(row.id) === idStr ? { ...row, ...patch } : row);\n    if (selected.type === "merchant") {\n      setMerchants((rows) => (rows || []).map(apply));\n      setMerchantProfiles((prev) => {\n        const next = new Map(prev || []);\n        next.set(idStr, { ...(next.get(idStr) || {}), id: selected.id, ...patch });\n        return next;\n      });\n    } else {\n      setNpcs((rows) => (rows || []).map(apply));\n    }\n    setSheet((prev) => {\n      const next = deepClone(prev || {});\n      next.portrait = {\n        ...(next.portrait || {}),\n        url: patch.portrait_url || "",\n        storagePath: patch.portrait_storage_path || "",\n        thumbUrl: patch.portrait_thumb_url || "",\n        shopUrl: patch.portrait_shop_url || "",\n        source: patch.portrait_source || "library",\n        recommendedMasterSize: "1536x2048",\n        aspectRatio: "3:4",\n      };\n      setSheetDraft(deepClone(next));\n      return next;\n    });\n  }`;

  const combinedPatchFns = `${spritePatchFn}\n\n${portraitPatchFn}`;
  if (source.includes("async function applySpritePatchToSelected") && source.includes("function applyPortraitPatchToSelected")) {
    source = source.replace(/  async function applySpritePatchToSelected[\s\S]*?\n  \}\n\n  function applyPortraitPatchToSelected[\s\S]*?\n  \}\n\n  \/\/ Location assignment lives/, `${combinedPatchFns}\n\n  // Location assignment lives`);
  } else if (source.includes("async function applySpritePatchToSelected")) {
    source = source.replace(/  async function applySpritePatchToSelected[\s\S]*?\n  \}\n\n  \/\/ Location assignment lives/, `${combinedPatchFns}\n\n  // Location assignment lives`);
  } else if (source.includes("function applyPortraitPatchToSelected")) {
    source = source.replace(/  function applyPortraitPatchToSelected[\s\S]*?\n  \}\n\n  \/\/ Location assignment lives/, `${combinedPatchFns}\n\n  // Location assignment lives`);
  } else {
    source = source.replace(
      /  const canEditNarrative = canEditCharacter && !!sheetEditMode;\n/,
      `  const canEditNarrative = canEditCharacter && !!sheetEditMode;\n\n${combinedPatchFns}\n\n`
    );
  }

  // Replace legacy manual delete logic with the DB-owned RPC and remove stale undefined state names.
  const deleteHandler = `  async function handleDeleteNpc(characterId) {\n    if (!characterId) return;\n    if (!(isAdmin || charPerm?.can_edit)) return;\n\n    const target = roster.find((entry) => String(entry.id) === String(characterId)) || selected;\n    const name = target?.name || "this character";\n\n    if (typeof window !== "undefined") {\n      const ok = window.confirm(\`Delete \${name}? This cannot be undone.\`);\n      if (!ok) return;\n    }\n\n    const { error } = await supabase.rpc("delete_character_v1", { p_character_id: characterId });\n    if (error) {\n      console.error("Delete NPC error", error);\n      alert(error.message || "Failed to delete character");\n      return;\n    }\n\n    setSelectedKey(null);\n    setSheet(null);\n    setDetailsBase(null);\n    setDetailsDraft(null);\n    setNotes([]);\n    setEquippedRows([]);\n\n    await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles(), loadLocations()]);\n  }`;

  if (!source.includes('rpc("delete_character_v1"')) {
    source = replaceRegex(
      source,
      /  async function handleDeleteNpc\(characterId\) \{[\s\S]*?\n  \}\n\n\n\n  \/\* reload selected sheet \+ notes when selection changes \*\//,
      `${deleteHandler}\n\n\n\n  /* reload selected sheet + notes when selection changes */`,
      "NPC delete RPC handler"
    );
  }

  // Replace the profile heading with an editable portrait thumbnail.
  if (!source.includes("npc-page-profile-thumb")) {
    source = source.replace(
      `                <div className="d-flex align-items-start">\n                  <div style={{ minWidth: 0 }}>\n                    <div className="h5 mb-1">{selected.name}</div>`,
      `                <div className="d-flex align-items-start gap-3">\n                  <button\n                    type="button"\n                    className={\`npc-page-profile-thumb \${canEditCharacter ? "npc-page-profile-thumb--editable" : ""}\`}\n                    disabled={!canEditCharacter}\n                    onDoubleClick={() => canEditCharacter ? setPortraitPickerOpen(true) : null}\n                    title={canEditCharacter ? "Double-click to change this profile portrait" : "Profile portrait"}\n                  >\n                    {selectedPortrait.url ? <img src={selectedPortrait.url} alt="" /> : <span>Portrait</span>}\n                  </button>\n                  <div style={{ minWidth: 0 }}>\n                    <div className="h5 mb-1">{selected.name}</div>`
    );
  }

  // Remove the redundant label above the sheet.
  source = source.replace(/\s*<div className="fw-semibold mb-2">Character sheet<\/div>\n\n\s*\{lastRoll && \(/, '\n                    {lastRoll && (');

  // Replace the sheet characterName block with actual NPC sprite_path display.
  const newCharacterName = `characterName={\n                        <span className="d-inline-flex align-items-center gap-2 flex-wrap">\n                          <button\n                            type="button"\n                            className={\`npc-sheet-sprite-thumb \${canEditCharacter ? "npc-sheet-sprite-thumb--editable" : ""}\`}\n                            disabled={!canEditCharacter}\n                            onDoubleClick={() => canEditCharacter ? setSpritePickerOpen(true) : null}\n                            title={selected?.sprite_path ? "NPC sprite. Double-click to change." : "No NPC sprite selected. Double-click to choose one."}\n                          >\n                            <img\n                              src={publicNpcSpriteUrl(selected?.sprite_path)}\n                              alt=""\n                              width={24}\n                              height={24}\n                              onError={(event) => {\n                                if (event?.currentTarget && event.currentTarget.src !== LOCAL_FALLBACK_ICON) {\n                                  event.currentTarget.src = LOCAL_FALLBACK_ICON;\n                                }\n                              }}\n                            />\n                          </button>\n                          <span>{selected.name}</span>\n                        </span>\n                      }\n                      nameRight=`;

  source = replaceRegex(
    source,
    /characterName=\{[\s\S]*?\n\s*\}\n\s*nameRight=/,
    newCharacterName,
    "sheet characterName sprite header"
  );

  // Force profile props beside inventory and make Store open the in-panel Shop tab.
  if (!source.includes('onOpenProfile={() => { setProfilePanelInitialView("profile"); setProfilePanelOpen(true); }}')) {
    source = source.replace(
      /(extraDirty=\{detailsDirty\}\n\s*)inventoryHref=\{inventoryHref \|\| null\}/,
      '$1profileHref={selected?.id ? `/map?npc=${encodeURIComponent(selected.id)}` : null}\n                       profileText="Profile"\n                       onOpenProfile={() => { setProfilePanelInitialView("profile"); setProfilePanelOpen(true); }}\n                       inventoryHref={inventoryHref || null}'
    );
  }

  if (!source.includes('onOpenStore={selected?.type === "merchant"')) {
    source = source.replace(
      /(storeHref=\{selected\?\.type === "merchant" && selected\?\.id && selected\?\.storefront_enabled \? `\/map\?merchant=\$\{selected\.id\}` : null\})/,
      '$1\n                       onOpenStore={selected?.type === "merchant" && selected?.id && selected?.storefront_enabled ? () => { setProfilePanelInitialView("shop"); setProfilePanelOpen(true); } : null}'
    );
  }

  // Add modal renders just before NewNpcModal.
  if (!source.includes('<PortraitPickerModal\n        show={portraitPickerOpen}')) {
    source = source.replace(
      /\s*<NewNpcModal\n\s*show=\{showNewNpcModal\}/,
      `\n    {portraitPickerOpen && selected ? (\n      <PortraitPickerModal\n        show={portraitPickerOpen}\n        characterId={selected.id}\n        characterName={selected.name || "Character"}\n        canEdit={canEditCharacter}\n        currentStoragePath={selected.portrait_storage_path || selectedPortrait.storagePath || ""}\n        currentUrl={selectedPortrait.url || ""}\n        onClose={() => setPortraitPickerOpen(false)}\n        onSelected={applyPortraitPatchToSelected}\n      />\n    ) : null}\n\n    <NewNpcModal\n        show={showNewNpcModal}`
    );
  }

  if (!source.includes('<SpritePickerModal\n        show={spritePickerOpen}')) {
    source = source.replace(
      /\s*<NewNpcModal\n\s*show=\{showNewNpcModal\}/,
      `\n    {spritePickerOpen && selected ? (\n      <SpritePickerModal\n        show={spritePickerOpen}\n        value={selected.sprite_path || null}\n        characterName={selected.name || "Character"}\n        disabled={!canEditCharacter}\n        onClose={() => setSpritePickerOpen(false)}\n        onChange={applySpritePatchToSelected}\n      />\n    ) : null}\n\n    <NewNpcModal\n        show={showNewNpcModal}`
    );
  }

  if (!source.includes('<NpcPanel\n            npc={selected}')) {
    source = source.replace(
      /\s*<NewNpcModal\n\s*show=\{showNewNpcModal\}/,
      `\n    {profilePanelOpen && selected ? (\n      <div className="npc-page-profile-panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? setProfilePanelOpen(false) : null}>\n        <div className="npc-page-profile-panel-shell">\n          <NpcPanel\n            npc={selected}\n            isAdmin={isAdmin}\n            locations={locations}\n            initialView={profilePanelInitialView}\n            onClose={() => setProfilePanelOpen(false)}\n            onOpenDrawer={() => {}}\n            onBrowseWares={() => {}}\n          />\n        </div>\n      </div>\n    ) : null}\n\n    <NewNpcModal\n        show={showNewNpcModal}`
    );
  } else if (!source.includes('initialView={profilePanelInitialView}')) {
    source = source.replace(
      /(<NpcPanel\n\s*npc=\{selected\}\n\s*isAdmin=\{isAdmin\}\n\s*locations=\{locations\}\n)/,
      '$1            initialView={profilePanelInitialView}\n'
    );
  }

  if (source !== original) {
    write(rel, source);
    changedAny = true;
    console.log("Finalized NPC page portrait, sheet, Profile, Store, sprite_path, and delete controls.");
  }
}

// -----------------------------------------------------------------------------
// CSS: final controls are now source-owned in styles/npc-page-controls.css and
// styles/npc-profile-panel.css. This no-op block only preserves idempotent logs.
// -----------------------------------------------------------------------------
{
  const rel = "styles/npc-profile-panel.css";
  const source = read(rel);
  if (!source.includes("npc-page-profile-panel-shell")) {
    console.warn("NPC profile panel shell CSS was not found; check styles/npc-profile-panel.css.");
  }
}

if (changedAny) {
  console.log("Applied final NPC page controls patch.");
} else {
  console.log("Final NPC page controls already current.");
}

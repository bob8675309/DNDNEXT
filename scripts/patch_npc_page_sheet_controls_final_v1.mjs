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
// CharacterSheetPanel: ensure Profile action exists beside Inventory.
// This script runs last in prebuild so later generated patches cannot undo it.
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

  if (!source.includes('title="Open this character profile"')) {
    source = source.replace(
      /          \{inventoryHref \? \([\s\S]*?          \) : null\}/,
      `          {inventoryHref ? (\n            <a\n              className="btn btn-sm btn-outline-light me-2"\n              href={inventoryHref}\n              target="_blank"\n              rel="noreferrer"\n              title="Open this character's inventory"\n            >\n              {inventoryText}\n            </a>\n          ) : null}\n\n          {typeof onOpenProfile === "function" ? (\n            <button\n              type="button"\n              className="btn btn-sm btn-outline-info me-2"\n              onClick={onOpenProfile}\n              title="Open this character profile"\n            >\n              {profileText}\n            </button>\n          ) : profileHref ? (\n            <a\n              className="btn btn-sm btn-outline-info me-2"\n              href={profileHref}\n              title="Open this character profile"\n            >\n              {profileText}\n            </a>\n          ) : null}`
    );
  }

  if (source !== original) {
    write(rel, source);
    changedAny = true;
    console.log("Finalized CharacterSheetPanel Profile action.");
  }
}

// -----------------------------------------------------------------------------
// NPC page: force final sheet header controls to the requested state.
// -----------------------------------------------------------------------------
{
  const rel = "pages/npcs.js";
  let source = read(rel);
  const original = source;

  // Imports needed for in-place panel and sprite picker.
  if (!source.includes('import NpcPanel from "../components/NpcPanel";')) {
    source = insertAfter(source, 'import NewNpcModal from "../components/NewNpcModal";', '\nimport NpcPanel from "../components/NpcPanel";', "NpcPanel import");
  }
  if (!source.includes('import SpritePickerModal from "../components/SpritePickerModal";')) {
    source = insertAfter(source, 'import MapIconPicker from "../components/MapIconPicker";', '\nimport SpritePickerModal from "../components/SpritePickerModal";', "SpritePicker import");
  }

  if (!source.includes('const NPC_SPRITE_BUCKET = "map-icons"')) {
    source = insertAfter(
      source,
      'const BORDER = "rgba(255,255,255,0.12)";\n',
      '\nconst NPC_SPRITE_BUCKET = "map-icons";\n\nfunction publicNpcSpriteUrl(spritePath) {\n  const clean = safeStr(spritePath);\n  if (!clean) return LOCAL_FALLBACK_ICON;\n  try {\n    return supabase.storage.from(NPC_SPRITE_BUCKET).getPublicUrl(clean).data?.publicUrl || LOCAL_FALLBACK_ICON;\n  } catch {\n    return LOCAL_FALLBACK_ICON;\n  }\n}\n',
      "NPC sprite helper"
    );
  }

  // Include sprite columns in character selects.
  source = source.replace(/"map_icon_id",\n(?!\s*"sprite_path")/g, '"map_icon_id",\n          "sprite_path",\n          "sprite_scale",\n          "camp_sprite_path",\n');
  source = source.replace(/map_icon_id: n\.map_icon_id \?\? null,\n(?!\s*sprite_path)/g, 'map_icon_id: n.map_icon_id ?? null,\n        sprite_path: n.sprite_path || null,\n        sprite_scale: n.sprite_scale ?? null,\n        camp_sprite_path: n.camp_sprite_path || null,\n');
  source = source.replace(/map_icon_id: m\.map_icon_id \?\? null,\n(?!\s*sprite_path)/g, 'map_icon_id: m.map_icon_id ?? null,\n        sprite_path: m.sprite_path || null,\n        sprite_scale: m.sprite_scale ?? null,\n        camp_sprite_path: m.camp_sprite_path || null,\n');

  // State used by the profile and sprite modals.
  if (!source.includes("const [profilePanelOpen, setProfilePanelOpen]")) {
    source = source.replace(
      /const \[portraitPickerOpen, setPortraitPickerOpen\] = useState\(false\);/,
      'const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);\n  const [profilePanelOpen, setProfilePanelOpen] = useState(false);'
    );
  }
  if (!source.includes("const [spritePickerOpen, setSpritePickerOpen]")) {
    source = source.replace(
      /const \[profilePanelOpen, setProfilePanelOpen\] = useState\(false\);/,
      'const [profilePanelOpen, setProfilePanelOpen] = useState(false);\n  const [spritePickerOpen, setSpritePickerOpen] = useState(false);'
    );
  }

  const spritePatchFn = `  async function applySpritePatchToSelected(nextSpritePath) {\n    if (!selected?.id) return;\n    const previous = selected?.sprite_path || null;\n    const idStr = String(selected.id);\n    const patchLocal = (value) => {\n      setNpcs((rows) => (rows || []).map((row) => String(row.id) === idStr ? { ...row, sprite_path: value } : row));\n      setMerchants((rows) => (rows || []).map((row) => String(row.id) === idStr ? { ...row, sprite_path: value } : row));\n    };\n\n    patchLocal(nextSpritePath || null);\n    const upd = await supabase\n      .from("characters")\n      .update({ sprite_path: nextSpritePath || null, updated_at: new Date().toISOString() })\n      .eq("id", selected.id);\n\n    if (upd.error) {\n      console.error(upd.error);\n      patchLocal(previous);\n      alert(upd.error.message || "Failed to save NPC sprite");\n      return;\n    }\n\n    await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles()]);\n  }`;

  if (source.includes("async function applySpritePatchToSelected")) {
    source = source.replace(/  async function applySpritePatchToSelected\([\s\S]*?\n  \}\n\n  function applyPortraitPatchToSelected/, `${spritePatchFn}\n\n  function applyPortraitPatchToSelected`);
  } else {
    source = source.replace(/  function applyPortraitPatchToSelected/, `${spritePatchFn}\n\n  function applyPortraitPatchToSelected`);
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

  // Force profile props beside inventory.
  if (!source.includes('onOpenProfile={() => setProfilePanelOpen(true)}')) {
    source = source.replace(
      /(extraDirty=\{detailsDirty\}\n\s*)inventoryHref=\{inventoryHref \|\| null\}/,
      '$1profileHref={selected?.id ? `/map?npc=${encodeURIComponent(selected.id)}` : null}\n                       profileText="Profile"\n                       onOpenProfile={() => setProfilePanelOpen(true)}\n                       inventoryHref={inventoryHref || null}'
    );
  }

  // Add modal renders just before NewNpcModal.
  if (!source.includes('<SpritePickerModal\n        show={spritePickerOpen}')) {
    source = source.replace(
      /\s*<NewNpcModal\n\s*show=\{showNewNpcModal\}/,
      `\n    {spritePickerOpen && selected ? (\n      <SpritePickerModal\n        show={spritePickerOpen}\n        value={selected.sprite_path || null}\n        characterName={selected.name || "Character"}\n        disabled={!canEditCharacter}\n        onClose={() => setSpritePickerOpen(false)}\n        onChange={applySpritePatchToSelected}\n      />\n    ) : null}\n\n    <NewNpcModal\n        show={showNewNpcModal}`
    );
  }

  if (!source.includes('<NpcPanel\n            npc={selected}')) {
    source = source.replace(
      /\s*<NewNpcModal\n\s*show=\{showNewNpcModal\}/,
      `\n    {profilePanelOpen && selected ? (\n      <div className="npc-page-profile-panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? setProfilePanelOpen(false) : null}>\n        <div className="npc-page-profile-panel-shell">\n          <NpcPanel\n            npc={selected}\n            isAdmin={isAdmin}\n            locations={locations}\n            onClose={() => setProfilePanelOpen(false)}\n            onOpenDrawer={() => {}}\n            onBrowseWares={() => {}}\n          />\n        </div>\n      </div>\n    ) : null}\n\n    <NewNpcModal\n        show={showNewNpcModal}`
    );
  }

  if (source !== original) {
    write(rel, source);
    changedAny = true;
    console.log("Finalized NPC page sheet Profile + sprite_path controls.");
  }
}

// -----------------------------------------------------------------------------
// CSS: make the final controls visually stable even if earlier CSS was skipped.
// -----------------------------------------------------------------------------
{
  const rel = "styles/npc-profile-panel.css";
  let source = read(rel);
  const original = source;
  const marker = "/* ===== final NPC sheet profile/sprite controls v1 ===== */";

  if (!source.includes(marker)) {
    source = `${source.trimEnd()}\n\n${marker}\n.npc-sheet-sprite-thumb {\n  width: 30px;\n  height: 30px;\n  flex: 0 0 30px;\n  display: inline-grid;\n  place-items: center;\n  border: 1px solid rgba(255,255,255,0.18);\n  border-radius: 9px;\n  background: rgba(255,255,255,0.055);\n  color: #f5f7ff;\n  padding: 0;\n  overflow: hidden;\n}\n.npc-sheet-sprite-thumb:disabled { opacity: 1; }\n.npc-sheet-sprite-thumb img {\n  width: 24px;\n  height: 24px;\n  object-fit: contain;\n  display: block;\n}\n.npc-sheet-sprite-thumb--editable { cursor: zoom-in; }\n.npc-sheet-sprite-thumb--editable:hover,\n.npc-sheet-sprite-thumb--editable:focus-visible {\n  outline: 2px solid rgba(255, 210, 109, 0.9);\n  outline-offset: 2px;\n}\n.npc-page-profile-panel-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 4700;\n  background: rgba(0,0,0,0.64);\n  display: flex;\n  align-items: stretch;\n  justify-content: flex-end;\n  padding: 1rem;\n}\n.npc-page-profile-panel-shell {\n  width: min(1120px, calc(100vw - 2rem));\n  max-height: calc(100vh - 2rem);\n  border-radius: 18px;\n  overflow: hidden;\n  background: rgba(4,5,10,0.98);\n  border: 1px solid rgba(255,255,255,0.14);\n  box-shadow: 0 28px 80px rgba(0,0,0,0.55);\n}\n.npc-page-profile-panel-shell .npc-panel-inner { height: 100%; }\n`;
  }

  if (source !== original) {
    write(rel, source);
    changedAny = true;
    console.log("Finalized NPC sheet control CSS.");
  }
}

if (changedAny) {
  console.log("Applied final NPC sheet profile/sprite controls patch.");
} else {
  console.log("Final NPC sheet profile/sprite controls already current.");
}

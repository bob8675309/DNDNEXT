import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function write(rel, source) {
  fs.writeFileSync(path.join(process.cwd(), rel), source, "utf8");
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) {
    console.warn(`${label}: expected one match, found ${count}; leaving source unchanged.`);
    return source;
  }
  return source.replace(before, after);
}

function appendOnce(source, marker, block) {
  if (source.includes(marker)) return source;
  return `${source.trimEnd()}\n\n${block}\n`;
}

let changedAny = false;

// -----------------------------------------------------------------------------
// CharacterSheetPanel: make Profile a real button action beside Inventory.
// -----------------------------------------------------------------------------
{
  const rel = "components/CharacterSheetPanel.js";
  let source = read(rel);
  const before = source;

  if (!source.includes("onOpenProfile = null")) {
    if (source.includes('  metaLine = null,\n  inventoryHref = null,')) {
      source = source.replace(
        '  metaLine = null,\n  inventoryHref = null,',
        '  metaLine = null,\n  profileHref = null,\n  profileText = "Profile",\n  onOpenProfile = null,\n  inventoryHref = null,'
      );
    } else if (source.includes('  inventoryText = "Inventory",\n  editable = false,')) {
      source = source.replace(
        '  inventoryText = "Inventory",\n  editable = false,',
        '  inventoryText = "Inventory",\n  profileHref = null,\n  profileText = "Profile",\n  onOpenProfile = null,\n  editable = false,'
      );
    }
  }

  if (!source.includes('title="Open this character profile"')) {
    source = replaceOnce(
      source,
      `          {inventoryHref ? (\n            <a\n              className="btn btn-sm btn-outline-light me-2"\n              href={inventoryHref}\n              target="_blank"\n              rel="noreferrer"\n              title="Open this character's inventory"\n            >\n              {inventoryText}\n            </a>\n          ) : null}`,
      `          {inventoryHref ? (\n            <a\n              className="btn btn-sm btn-outline-light me-2"\n              href={inventoryHref}\n              target="_blank"\n              rel="noreferrer"\n              title="Open this character's inventory"\n            >\n              {inventoryText}\n            </a>\n          ) : null}\n\n          {typeof onOpenProfile === "function" ? (\n            <button\n              type="button"\n              className="btn btn-sm btn-outline-info me-2"\n              onClick={onOpenProfile}\n              title="Open this character profile"\n            >\n              {profileText}\n            </button>\n          ) : profileHref ? (\n            <a\n              className="btn btn-sm btn-outline-info me-2"\n              href={profileHref}\n              title="Open this character profile"\n            >\n              {profileText}\n            </a>\n          ) : null}`,
      "CharacterSheetPanel profile button beside inventory"
    );
  }

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched CharacterSheetPanel Profile action.");
  }
}

// -----------------------------------------------------------------------------
// NPC page: sheet header uses characters.sprite_path, not the legacy map_icon_id.
// The old map icon field remains untouched for existing marker behavior.
// -----------------------------------------------------------------------------
{
  const rel = "pages/npcs.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    'import MapIconPicker from "../components/MapIconPicker";\nimport KindPicker from "../components/KindPicker";',
    'import MapIconPicker from "../components/MapIconPicker";\nimport SpritePickerModal from "../components/SpritePickerModal";\nimport KindPicker from "../components/KindPicker";',
    "NPC page SpritePicker import"
  );

  if (!source.includes('const NPC_SPRITE_BUCKET = "map-icons"')) {
    source = replaceOnce(
      source,
      'const BORDER = "rgba(255,255,255,0.12)";\n',
      'const BORDER = "rgba(255,255,255,0.12)";\nconst NPC_SPRITE_BUCKET = "map-icons";\n\nfunction publicNpcSpriteUrl(spritePath) {\n  const clean = safeStr(spritePath);\n  if (!clean) return LOCAL_FALLBACK_ICON;\n  try {\n    return supabase.storage.from(NPC_SPRITE_BUCKET).getPublicUrl(clean).data?.publicUrl || LOCAL_FALLBACK_ICON;\n  } catch {\n    return LOCAL_FALLBACK_ICON;\n  }\n}\n',
      "NPC page sprite URL helper"
    );
  }

  if (!source.includes("const [spritePickerOpen, setSpritePickerOpen]")) {
    source = replaceOnce(
      source,
      '  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);\n  const [profilePanelOpen, setProfilePanelOpen] = useState(false);',
      '  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);\n  const [profilePanelOpen, setProfilePanelOpen] = useState(false);\n  const [spritePickerOpen, setSpritePickerOpen] = useState(false);',
      "NPC page sprite picker state"
    );
  }

  // Carry sprite columns into NPC/merchant rows and merged roster.
  for (const anchor of [
    '          "map_icon_id",\n          "updated_at",',
    '          "map_icon_id",\n          "is_hidden",',
  ]) {
    source = replaceOnce(
      source,
      anchor,
      anchor.replace('          "map_icon_id",', '          "map_icon_id",\n          "sprite_path",\n          "sprite_scale",\n          "camp_sprite_path",'),
      "NPC page select sprite columns"
    );
  }

  source = replaceOnce(
    source,
    '        map_icon_id: n.map_icon_id ?? null,\n        is_hidden: !!n.is_hidden,',
    '        map_icon_id: n.map_icon_id ?? null,\n        sprite_path: n.sprite_path || null,\n        sprite_scale: n.sprite_scale ?? null,\n        camp_sprite_path: n.camp_sprite_path || null,\n        is_hidden: !!n.is_hidden,',
    "NPC roster sprite fields"
  );

  source = replaceOnce(
    source,
    '        map_icon_id: m.map_icon_id ?? null,\n        merchant_state: m.state || null,',
    '        map_icon_id: m.map_icon_id ?? null,\n        sprite_path: m.sprite_path || null,\n        sprite_scale: m.sprite_scale ?? null,\n        camp_sprite_path: m.camp_sprite_path || null,\n        merchant_state: m.state || null,',
    "Merchant roster sprite fields"
  );

  if (!source.includes("const selectedSpriteUrl = useMemo")) {
    source = replaceOnce(
      source,
      '  const selectedPortrait = useMemo(() => {\n    if (!selected) return { url: "", source: "none", storagePath: "" };\n    return resolveCharacterPortrait(selected, supabase);\n  }, [selected]);',
      '  const selectedPortrait = useMemo(() => {\n    if (!selected) return { url: "", source: "none", storagePath: "" };\n    return resolveCharacterPortrait(selected, supabase);\n  }, [selected]);\n\n  const selectedSpriteUrl = useMemo(() => publicNpcSpriteUrl(selected?.sprite_path), [selected?.sprite_path]);',
      "NPC page selected sprite URL"
    );
  }

  // Replace old helper if present, otherwise add new helper before portrait helper.
  if (source.includes("async function applySpritePatchToSelected(nextIconId)")) {
    const start = source.indexOf("  async function applySpritePatchToSelected(nextIconId)");
    const end = source.indexOf("\n\n  function applyPortraitPatchToSelected", start);
    if (start !== -1 && end !== -1) {
      const fn = `  async function applySpritePatchToSelected(nextSpritePath) {\n    if (!selected?.id) return;\n    const prev = selected?.sprite_path || null;\n    const idStr = String(selected.id);\n    const patchLocal = (val) => {\n      setNpcs((arr) =>\n        (arr || []).map((c) =>\n          String(c.id) === idStr ? { ...c, sprite_path: val } : c\n        )\n      );\n      setMerchants((arr) =>\n        (arr || []).map((c) =>\n          String(c.id) === idStr ? { ...c, sprite_path: val } : c\n        )\n      );\n    };\n\n    patchLocal(nextSpritePath || null);\n    const upd = await supabase\n      .from("characters")\n      .update({ sprite_path: nextSpritePath || null, updated_at: new Date().toISOString() })\n      .eq("id", selected.id);\n\n    if (upd.error) {\n      console.error(upd.error);\n      patchLocal(prev);\n      alert(upd.error.message || "Failed to save sprite");\n      return;\n    }\n\n    await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles()]);\n  }`;
      source = `${source.slice(0, start)}${fn}${source.slice(end)}`;
    }
  } else {
    source = replaceOnce(
      source,
      `  function applyPortraitPatchToSelected(patch) {`,
      `  async function applySpritePatchToSelected(nextSpritePath) {\n    if (!selected?.id) return;\n    const prev = selected?.sprite_path || null;\n    const idStr = String(selected.id);\n    const patchLocal = (val) => {\n      setNpcs((arr) =>\n        (arr || []).map((c) =>\n          String(c.id) === idStr ? { ...c, sprite_path: val } : c\n        )\n      );\n      setMerchants((arr) =>\n        (arr || []).map((c) =>\n          String(c.id) === idStr ? { ...c, sprite_path: val } : c\n        )\n      );\n    };\n\n    patchLocal(nextSpritePath || null);\n    const upd = await supabase\n      .from("characters")\n      .update({ sprite_path: nextSpritePath || null, updated_at: new Date().toISOString() })\n      .eq("id", selected.id);\n\n    if (upd.error) {\n      console.error(upd.error);\n      patchLocal(prev);\n      alert(upd.error.message || "Failed to save sprite");\n      return;\n    }\n\n    await Promise.all([loadNpcs(), loadMerchants(), loadMerchantProfiles()]);\n  }\n\n  function applyPortraitPatchToSelected(patch) {`,
      "NPC page sprite path patch helper"
    );
  }

  source = replaceOnce(
    source,
    `                    <div className="fw-semibold mb-1">Description</div>\n                    <div className="npc-page-description-flow">\n                      <button\n                        type="button"\n                        className={\`npc-page-profile-thumb npc-page-profile-thumb--inline \${canEditCharacter ? "npc-page-profile-thumb--editable" : ""}\`}\n                        disabled={!canEditCharacter}\n                        onDoubleClick={() => canEditCharacter ? setPortraitPickerOpen(true) : null}\n                        title={canEditCharacter ? "Double-click to change this profile portrait" : "Profile portrait"}\n                      >\n                        {selectedPortrait.url ? <img src={selectedPortrait.url} alt="" /> : <span>Portrait</span>}\n                      </button>\n\n                      {canEditNarrative ? (`,
    `                    <div className="npc-page-description-flow">\n                      <button\n                        type="button"\n                        className={\`npc-page-profile-thumb npc-page-profile-thumb--inline \${canEditCharacter ? "npc-page-profile-thumb--editable" : ""}\`}\n                        disabled={!canEditCharacter}\n                        onDoubleClick={() => canEditCharacter ? setPortraitPickerOpen(true) : null}\n                        title={canEditCharacter ? "Double-click to change this profile portrait" : "Profile portrait"}\n                      >\n                        {selectedPortrait.url ? <img src={selectedPortrait.url} alt="" /> : <span>Portrait</span>}\n                      </button>\n\n                      <div className="fw-semibold mb-1 npc-page-description-label">Description</div>\n\n                      {canEditNarrative ? (`,
    "NPC page description label beside portrait"
  );

  source = replaceOnce(
    source,
    '                    <div className="fw-semibold mb-2">Character sheet</div>\n\n                    {lastRoll && (',
    '                    {lastRoll && (',
    "NPC page remove Character sheet label"
  );

  // Old legacy map icon block -> sprite_path button.
  source = replaceOnce(
    source,
    `                              <span\n                                className="mi-name-icon"\n                                title={selectedMapIcon?.name ? \`Map icon: \${selectedMapIcon.name}\` : "No map icon selected"}\n                              >\n                                {disp?.type === "emoji" ? (\n                                  <span aria-hidden="true">{disp.emoji}</span>\n                                ) : (\n                                  // eslint-disable-next-line @next/next/no-img-element\n                                  <img\n                                    src={disp?.src || LOCAL_FALLBACK_ICON}\n                                    alt=""\n                                    width={18}\n                                    height={18}\n                                    onError={(e) => {\n                                      if (e?.currentTarget && e.currentTarget.src !== LOCAL_FALLBACK_ICON) {\n                                        e.currentTarget.src = LOCAL_FALLBACK_ICON;\n                                      }\n                                    }}\n                                  />\n                                )}\n                              </span>\n                              <span>{selected.name}</span>`,
    `                              <button\n                                type="button"\n                                className={\`npc-sheet-sprite-thumb \${canEditCharacter ? "npc-sheet-sprite-thumb--editable" : ""}\`}\n                                disabled={!canEditCharacter}\n                                onDoubleClick={() => canEditCharacter ? setSpritePickerOpen(true) : null}\n                                title={selected?.sprite_path ? "NPC sprite. Double-click to change." : "No NPC sprite selected. Double-click to choose one."}\n                              >\n                                <img\n                                  src={selectedSpriteUrl || LOCAL_FALLBACK_ICON}\n                                  alt=""\n                                  width={24}\n                                  height={24}\n                                  onError={(e) => {\n                                    if (e?.currentTarget && e.currentTarget.src !== LOCAL_FALLBACK_ICON) {\n                                      e.currentTarget.src = LOCAL_FALLBACK_ICON;\n                                    }\n                                  }}\n                                />\n                              </button>\n                              <span>{selected.name}</span>`,
    "NPC page sheet header legacy pin to sprite thumbnail"
  );

  // Previous patch button using map icon display -> sprite_path button.
  const oldSpriteButtonStart = '                              <button\n                                type="button"\n                                className={`npc-sheet-sprite-thumb ${canEditCharacter ? "npc-sheet-sprite-thumb--editable" : ""}`}' ;
  if (source.includes(oldSpriteButtonStart) && source.includes('disp?.type === "emoji"')) {
    source = source.replace(
      /                              <button\n                                type="button"\n                                className=\{`npc-sheet-sprite-thumb \$\{canEditCharacter \? "npc-sheet-sprite-thumb--editable" : ""\}`\}\n                                disabled=\{!canEditCharacter\}\n                                onDoubleClick=\{\(\) => canEditCharacter \? setSpritePickerOpen\(true\) : null\}\n                                title=\{selectedMapIcon\?\.name \? `Sprite: \$\{selectedMapIcon\.name\}\. Double-click to change\.` : "No sprite selected\. Double-click to choose one\."\}\n                              >[\s\S]*?                              <\/button>\n                              <span>\{selected\.name\}<\/span>/,
      `                              <button\n                                type="button"\n                                className={\`npc-sheet-sprite-thumb \${canEditCharacter ? "npc-sheet-sprite-thumb--editable" : ""}\`}\n                                disabled={!canEditCharacter}\n                                onDoubleClick={() => canEditCharacter ? setSpritePickerOpen(true) : null}\n                                title={selected?.sprite_path ? "NPC sprite. Double-click to change." : "No NPC sprite selected. Double-click to choose one."}\n                              >\n                                <img\n                                  src={selectedSpriteUrl || LOCAL_FALLBACK_ICON}\n                                  alt=""\n                                  width={24}\n                                  height={24}\n                                  onError={(e) => {\n                                    if (e?.currentTarget && e.currentTarget.src !== LOCAL_FALLBACK_ICON) {\n                                      e.currentTarget.src = LOCAL_FALLBACK_ICON;\n                                    }\n                                  }}\n                                />\n                              </button>\n                              <span>{selected.name}</span>`
    );
  }

  // Add profile props if missing.
  if (!source.includes('onOpenProfile={() => setProfilePanelOpen(true)}')) {
    source = replaceOnce(
      source,
      '                       extraDirty={detailsDirty}\n                       inventoryHref={inventoryHref || null}',
      '                       extraDirty={detailsDirty}\n                       profileHref={selected?.id ? `/map?npc=${encodeURIComponent(selected.id)}` : null}\n                       profileText="Profile"\n                       onOpenProfile={() => setProfilePanelOpen(true)}\n                       inventoryHref={inventoryHref || null}',
      "NPC page add profile prop fallback"
    );
  }

  source = replaceOnce(
    source,
    `    {profilePanelOpen && selected ? (`,
    `    {spritePickerOpen && selected ? (\n      <SpritePickerModal\n        show={spritePickerOpen}\n        value={selected.sprite_path || null}\n        characterName={selected.name || "Character"}\n        disabled={!canEditCharacter}\n        onClose={() => setSpritePickerOpen(false)}\n        onChange={applySpritePatchToSelected}\n      />\n    ) : null}\n\n    {profilePanelOpen && selected ? (`,
    "NPC page sprite picker modal render"
  );

  // If old modal render exists from previous patch, rewrite it to value sprite_path and no map-icons prop.
  source = source.replace(
    `      <SpritePickerModal\n        show={spritePickerOpen}\n        icons={mapIcons}\n        value={selected.map_icon_id || null}\n        characterName={selected.name || "Character"}\n        disabled={!canEditCharacter}\n        onClose={() => setSpritePickerOpen(false)}\n        onChange={applySpritePatchToSelected}\n      />`,
    `      <SpritePickerModal\n        show={spritePickerOpen}\n        value={selected.sprite_path || null}\n        characterName={selected.name || "Character"}\n        disabled={!canEditCharacter}\n        onClose={() => setSpritePickerOpen(false)}\n        onChange={applySpritePatchToSelected}\n      />`
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NPC page sheet header/profile polish.");
  }
}

// -----------------------------------------------------------------------------
// Styling for description label, sheet spacing, header sprite thumb, and picker.
// -----------------------------------------------------------------------------
{
  const rel = "styles/npc-profile-panel.css";
  let source = read(rel);
  const before = source;
  const marker = "/* ===== NPC page sheet header sprite/profile polish v2 ===== */";
  source = appendOnce(source, marker, `${marker}\n.npc-page-description-label {\n  padding-top: 0.05rem;\n}\n.npc-page-description-flow .form-control {\n  min-height: 112px;\n}\n.npc-page-profile-thumb--inline {\n  margin-top: 0;\n}\n.npc-page-profile-thumb--inline + .npc-page-description-label {\n  line-height: 1.2;\n}\n.npc-page-description-text {\n  margin-top: 0.25rem;\n}\n.npc-page-profile-thumb--inline ~ .npc-page-description-text {\n  display: block;\n}\n.npc-page-profile-thumb--inline ~ .form-control {\n  margin-top: 0.25rem;\n}\n.npc-page-profile-panel-shell .npc-panel-header {\n  border-top-left-radius: 18px;\n  border-top-right-radius: 18px;\n}\n.npc-sheet-sprite-thumb {\n  width: 30px;\n  height: 30px;\n  flex: 0 0 30px;\n  display: inline-grid;\n  place-items: center;\n  border: 1px solid rgba(255,255,255,0.18);\n  border-radius: 9px;\n  background: rgba(255,255,255,0.055);\n  color: #f5f7ff;\n  padding: 0;\n  overflow: hidden;\n}\n.npc-sheet-sprite-thumb:disabled {\n  opacity: 1;\n}\n.npc-sheet-sprite-thumb img {\n  width: 24px;\n  height: 24px;\n  object-fit: contain;\n  display: block;\n}\n.npc-sheet-sprite-thumb--editable {\n  cursor: zoom-in;\n}\n.npc-sheet-sprite-thumb--editable:hover,\n.npc-sheet-sprite-thumb--editable:focus-visible {\n  outline: 2px solid rgba(255, 210, 109, 0.9);\n  outline-offset: 2px;\n}\n.sprite-picker-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 5100;\n  background: rgba(0,0,0,0.72);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 18px;\n}\n.sprite-picker-modal {\n  width: min(900px, calc(100vw - 36px));\n  max-height: min(760px, calc(100vh - 36px));\n  display: flex;\n  flex-direction: column;\n  border-radius: 20px;\n  border: 1px solid rgba(255,255,255,0.16);\n  background: linear-gradient(180deg, rgba(21,17,29,0.98), rgba(8,9,14,0.98));\n  box-shadow: 0 28px 80px rgba(0,0,0,0.55);\n  color: #f4f7ff;\n  overflow: hidden;\n}\n.sprite-picker-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 16px;\n  padding: 16px 18px;\n  border-bottom: 1px solid rgba(255,255,255,0.1);\n}\n.sprite-picker-head h3 { margin: 2px 0 4px; }\n.sprite-picker-head p { margin: 0; color: rgba(232,238,255,0.72); }\n.sprite-picker-kicker {\n  font-size: 10px;\n  letter-spacing: .22em;\n  text-transform: uppercase;\n  color: #8dd3ff;\n}\n.sprite-picker-toolbar {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 12px 18px;\n  border-bottom: 1px solid rgba(255,255,255,0.08);\n}\n.sprite-picker-toolbar input { max-width: 460px; }\n.sprite-picker-toolbar span { color: rgba(232,238,255,0.66); font-size: 12px; white-space: nowrap; }\n.sprite-picker-grid {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow: auto;\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));\n  gap: 12px;\n  padding: 16px 18px 20px;\n}\n.sprite-picker-card {\n  position: relative;\n  min-height: 132px;\n  border: 1px solid rgba(255,255,255,0.12);\n  border-radius: 16px;\n  background: rgba(255,255,255,0.045);\n  color: #f5f7ff;\n  padding: 10px;\n  text-align: center;\n  overflow: hidden;\n}\n.sprite-picker-card:hover:not(:disabled),\n.sprite-picker-card:focus-visible {\n  border-color: rgba(255,210,109,0.72);\n  box-shadow: 0 0 0 2px rgba(255,210,109,0.12);\n}\n.sprite-picker-card.is-current {\n  border-color: rgba(95,211,166,0.9);\n}\n.sprite-picker-image {\n  display: grid;\n  place-items: center;\n  width: 64px;\n  height: 64px;\n  margin: 0 auto 8px;\n  border-radius: 14px;\n  overflow: hidden;\n  background: rgba(0,0,0,0.26);\n}\n.sprite-picker-image img {\n  width: 46px;\n  height: 46px;\n  object-fit: contain;\n  display: block;\n}\n.sprite-picker-name {\n  display: block;\n  font-weight: 700;\n  font-size: 0.78rem;\n  line-height: 1.2;\n}\n.sprite-picker-current,\n.sprite-picker-saving {\n  position: absolute;\n  top: 8px;\n  right: 8px;\n  border-radius: 999px;\n  padding: 3px 7px;\n  font-size: 10px;\n  background: rgba(36,160,95,0.9);\n  color: #fff;\n}\n.sprite-picker-saving { background: rgba(75,118,225,0.92); }\n.sprite-picker-empty {\n  color: rgba(232,238,255,0.66);\n  padding: 18px;\n}`);

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NPC page sheet/sprite styles.");
  }
}

if (changedAny) {
  console.log("Applied NPC page sheet header sprite/profile polish patch.");
} else {
  console.log("NPC page sheet header sprite/profile polish already current.");
}

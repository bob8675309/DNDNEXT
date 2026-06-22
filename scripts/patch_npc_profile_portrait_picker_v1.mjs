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
// Location side panel roster polish: display only full names; keep role/title in
// hover text; click still opens the NPC profile panel.
// -----------------------------------------------------------------------------
{
  const rel = "components/LocationSideBar.js";
  let source = read(rel);
  const before = source;

  const oldBlock = `            {presentPeople.length ? presentPeople.map((p) => (\n              <li key={p.id || p.title || p.name}>\n                <button\n                  type="button"\n                  className="town-quick-profile-link"\n                  onClick={() => typeof onOpenMerchant === "function" ? onOpenMerchant(p) : null}\n                  title="Open character profile"\n                >\n                  <span>{p.name || p.title}</span>\n                  <small>{p.role || p.kind || "Profile"}</small>\n                </button>\n              </li>\n            )) : <li>No one surfaced</li>}`;
  const newBlock = `            {presentPeople.length ? presentPeople.map((p) => {\n              const hoverTitle = [p.role || p.kind || "Profile", p.affiliation].filter(Boolean).join(" • ");\n              return (\n                <li key={p.id || p.title || p.name}>\n                  <button\n                    type="button"\n                    className="town-quick-profile-link town-quick-profile-link--name-only"\n                    onClick={() => typeof onOpenMerchant === "function" ? onOpenMerchant(p) : null}\n                    title={hoverTitle || "Open character profile"}\n                  >\n                    <span>{p.name || p.title}</span>\n                  </button>\n                </li>\n              );\n            }) : <li>No one surfaced</li>}`;
  source = replaceOnce(source, oldBlock, newBlock, "LocationSideBar full-name profile roster links");

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched LocationSideBar roster name display.");
  }
}

// -----------------------------------------------------------------------------
// CharacterSheetPanel: add a Profile action button to sheet headers when the
// parent provides a profile link.
// -----------------------------------------------------------------------------
{
  const rel = "components/CharacterSheetPanel.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    '  nameRight = null,\n  metaLine = null,\n  inventoryHref = null,',
    '  nameRight = null,\n  metaLine = null,\n  profileHref = null,\n  profileText = "Profile",\n  inventoryHref = null,',
    "CharacterSheetPanel profile props"
  );

  source = replaceOnce(
    source,
    '        <div className="csheet-actions">\n          {storeHref ? (',
    '        <div className="csheet-actions">\n          {profileHref ? (\n            <a\n              className="btn btn-sm btn-outline-info me-2"\n              href={profileHref}\n              title="Open this character profile"\n            >\n              {profileText}\n            </a>\n          ) : null}\n\n          {storeHref ? (',
    "CharacterSheetPanel profile action"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched CharacterSheetPanel profile action.");
  }
}

// -----------------------------------------------------------------------------
// Map profile panel: double-click portrait opens the portrait grid for admins and
// users with can_edit on that character.
// -----------------------------------------------------------------------------
{
  const rel = "components/NpcPanel.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    'import { resolveCharacterPortrait } from "../utils/characterPortraits";\nimport CharacterSheetPanel from "./CharacterSheetPanel";',
    'import { resolveCharacterPortrait } from "../utils/characterPortraits";\nimport CharacterSheetPanel from "./CharacterSheetPanel";\nimport PortraitPickerModal from "./PortraitPickerModal";',
    "NpcPanel portrait picker import"
  );

  source = replaceOnce(
    source,
    '  const [inventoryAccess, setInventoryAccess] = useState({ checked: false, canView: false, canManage: false });\n  const [lastRoll, setLastRoll] = useState(null);',
    '  const [inventoryAccess, setInventoryAccess] = useState({ checked: false, canView: false, canManage: false, canEdit: false });\n  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);\n  const [lastRoll, setLastRoll] = useState(null);',
    "NpcPanel portrait state"
  );

  source = source.replaceAll(
    'setInventoryAccess({ checked: true, canView: false, canManage: false });',
    'setInventoryAccess({ checked: true, canView: false, canManage: false, canEdit: false });'
  );
  source = source.replaceAll(
    'setInventoryAccess({ checked: true, canView: true, canManage: true });',
    'setInventoryAccess({ checked: true, canView: true, canManage: true, canEdit: true });'
  );
  source = replaceOnce(
    source,
    '      const can = !!data?.can_inventory || !!data?.can_edit;\n      setInventoryAccess({ checked: true, canView: can, canManage: can });',
    '      const can = !!data?.can_inventory || !!data?.can_edit;\n      setInventoryAccess({ checked: true, canView: can, canManage: can, canEdit: !!data?.can_edit });',
    "NpcPanel can_edit portrait access"
  );

  source = replaceOnce(
    source,
    '  const portrait = useMemo(() => resolveCharacterPortrait(view, supabase), [view]);\n  const equippedEquipmentText = useMemo(() => (equippedRows || []).map(pickItemName).filter(Boolean).join("\\n"), [equippedRows]);',
    '  const portrait = useMemo(() => resolveCharacterPortrait(view, supabase), [view]);\n  const canChangePortrait = !!isAdmin || !!inventoryAccess.canEdit;\n  const equippedEquipmentText = useMemo(() => (equippedRows || []).map(pickItemName).filter(Boolean).join("\\n"), [equippedRows]);',
    "NpcPanel canChangePortrait"
  );

  source = replaceOnce(
    source,
    '  return (\n    <div className="npc-panel-inner">',
    '  return (\n    <>\n    <div className="npc-panel-inner">',
    "NpcPanel return fragment open"
  );

  source = replaceOnce(
    source,
    `            <div className="npc-portrait" aria-hidden="true">\n              {portrait.url ? <img src={portrait.url} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="npc-portrait-placeholder">Portrait</div>}\n            </div>`,
    `            <button\n              type="button"\n              className={\`npc-portrait \${canChangePortrait ? "npc-portrait--editable" : ""}\`}\n              disabled={!canChangePortrait}\n              onDoubleClick={() => canChangePortrait ? setPortraitPickerOpen(true) : null}\n              title={canChangePortrait ? "Double-click to change this profile portrait" : "Profile portrait"}\n            >\n              {portrait.url ? <img src={portrait.url} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="npc-portrait-placeholder">Portrait</div>}\n            </button>`,
    "NpcPanel editable portrait button"
  );

  source = replaceOnce(
    source,
    '    </div>\n  );\n}',
    `    </div>\n    {portraitPickerOpen ? (\n      <PortraitPickerModal\n        show={portraitPickerOpen}\n        characterId={npcId}\n        characterName={view.name || "Character"}\n        canEdit={canChangePortrait}\n        currentStoragePath={view.portrait_storage_path || portrait.storagePath || ""}\n        currentUrl={portrait.url || ""}\n        onClose={() => setPortraitPickerOpen(false)}\n        onSelected={(patch) => {\n          setFullNpc((prev) => ({ ...(prev || view || {}), ...(patch || {}) }));\n          setSheet((prev) => {\n            const next = deepClone(prev || {});\n            next.portrait = {\n              ...(next.portrait || {}),\n              url: patch?.portrait_url || "",\n              storagePath: patch?.portrait_storage_path || "",\n              thumbUrl: patch?.portrait_thumb_url || "",\n              shopUrl: patch?.portrait_shop_url || "",\n              source: patch?.portrait_source || "library",\n              recommendedMasterSize: "1536x2048",\n              aspectRatio: "3:4",\n            };\n            return next;\n          });\n        }}\n      />\n    ) : null}\n    </>\n  );\n}`,
    "NpcPanel return fragment close and modal"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NpcPanel portrait picker.");
  }
}

// -----------------------------------------------------------------------------
// NPCs page: carry portrait fields, show editable profile thumbnail, and add a
// CharacterSheetPanel Profile button.
// -----------------------------------------------------------------------------
{
  const rel = "pages/npcs.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    'import NewNpcModal from "../components/NewNpcModal";\nimport { MAP_ICONS_BUCKET, LOCAL_FALLBACK_ICON, mapIconDisplay } from "../utils/mapIcons";',
    'import NewNpcModal from "../components/NewNpcModal";\nimport PortraitPickerModal from "../components/PortraitPickerModal";\nimport { MAP_ICONS_BUCKET, LOCAL_FALLBACK_ICON, mapIconDisplay } from "../utils/mapIcons";\nimport { resolveCharacterPortrait } from "../utils/characterPortraits";',
    "NPC page portrait imports"
  );

  source = replaceOnce(
    source,
    '  const [showNewNpcModal, setShowNewNpcModal] = useState(false);',
    '  const [showNewNpcModal, setShowNewNpcModal] = useState(false);\n  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);',
    "NPC page portrait picker state"
  );

  source = replaceOnce(
    source,
    '          "projected_destination_id",\n        ].join(",")',
    '          "projected_destination_id",\n          "portrait_url",\n          "portrait_storage_path",\n          "portrait_thumb_url",\n          "portrait_shop_url",\n          "portrait_source",\n          "image_url",\n        ].join(",")',
    "NPC select portrait fields"
  );

  source = replaceOnce(
    source,
    '          "is_hidden",\n          "updated_at",\n        ].join(",")',
    '          "is_hidden",\n          "portrait_url",\n          "portrait_storage_path",\n          "portrait_thumb_url",\n          "portrait_shop_url",\n          "portrait_source",\n          "image_url",\n          "updated_at",\n        ].join(",")',
    "Merchant select portrait fields"
  );

  source = replaceOnce(
    source,
    '          "status",\n          "updated_at",\n        ].join(",")',
    '          "status",\n          "portrait_url",\n          "portrait_storage_path",\n          "portrait_thumb_url",\n          "portrait_shop_url",\n          "portrait_source",\n          "image_url",\n          "updated_at",\n        ].join(",")',
    "Merchant profile select portrait fields"
  );

  source = replaceOnce(
    source,
    '        projected_destination_id: n.projected_destination_id ?? null,\n        map_icon_id: n.map_icon_id ?? null,',
    '        projected_destination_id: n.projected_destination_id ?? null,\n        map_icon_id: n.map_icon_id ?? null,\n        portrait_url: n.portrait_url || null,\n        portrait_storage_path: n.portrait_storage_path || null,\n        portrait_thumb_url: n.portrait_thumb_url || null,\n        portrait_shop_url: n.portrait_shop_url || null,\n        portrait_source: n.portrait_source || null,\n        image_url: n.image_url || null,',
    "NPC roster portrait fields"
  );

  source = replaceOnce(
    source,
    '        map_icon_id: m.map_icon_id ?? null,\n        merchant_state: m.state || null,',
    '        map_icon_id: m.map_icon_id ?? null,\n        portrait_url: m.portrait_url || prof.portrait_url || null,\n        portrait_storage_path: m.portrait_storage_path || prof.portrait_storage_path || null,\n        portrait_thumb_url: m.portrait_thumb_url || prof.portrait_thumb_url || null,\n        portrait_shop_url: m.portrait_shop_url || prof.portrait_shop_url || null,\n        portrait_source: m.portrait_source || prof.portrait_source || null,\n        image_url: m.image_url || prof.image_url || null,\n        merchant_state: m.state || null,',
    "Merchant roster portrait fields"
  );

  source = replaceOnce(
    source,
    '  const selectedLocation = useMemo(() => {\n    if (!selected?.location_id) return null;\n    return (locations || []).find((l) => String(l.id) === String(selected.location_id)) || null;\n  }, [selected?.location_id, locations]);',
    '  const selectedLocation = useMemo(() => {\n    if (!selected?.location_id) return null;\n    return (locations || []).find((l) => String(l.id) === String(selected.location_id)) || null;\n  }, [selected?.location_id, locations]);\n\n  const selectedPortrait = useMemo(() => {\n    if (!selected) return { url: "", source: "none", storagePath: "" };\n    return resolveCharacterPortrait(selected, supabase);\n  }, [selected]);',
    "NPC page selected portrait"
  );

  source = replaceOnce(
    source,
    '  const canEditNarrative = canEditCharacter && !!sheetEditMode;\n',
    `  const canEditNarrative = canEditCharacter && !!sheetEditMode;\n\n  function applyPortraitPatchToSelected(patch) {\n    if (!selected?.id || !patch) return;\n    const idStr = String(selected.id);\n    const apply = (row) => (String(row.id) === idStr ? { ...row, ...patch } : row);\n    if (selected.type === "merchant") {\n      setMerchants((rows) => (rows || []).map(apply));\n      setMerchantProfiles((prev) => {\n        const next = new Map(prev || []);\n        next.set(idStr, { ...(next.get(idStr) || {}), id: selected.id, ...patch });\n        return next;\n      });\n    } else {\n      setNpcs((rows) => (rows || []).map(apply));\n    }\n    setSheet((prev) => {\n      const next = deepClone(prev || {});\n      next.portrait = {\n        ...(next.portrait || {}),\n        url: patch.portrait_url || "",\n        storagePath: patch.portrait_storage_path || "",\n        thumbUrl: patch.portrait_thumb_url || "",\n        shopUrl: patch.portrait_shop_url || "",\n        source: patch.portrait_source || "library",\n        recommendedMasterSize: "1536x2048",\n        aspectRatio: "3:4",\n      };\n      setSheetDraft(deepClone(next));\n      return next;\n    });\n  }\n`,
    "NPC page apply portrait patch"
  );

  source = replaceOnce(
    source,
    '                <div className="d-flex align-items-start">\n                  <div style={{ minWidth: 0 }}>\n                    <div className="h5 mb-1">{selected.name}</div>',
    '                <div className="d-flex align-items-start gap-3">\n                  <button\n                    type="button"\n                    className={`npc-page-profile-thumb ${canEditCharacter ? "npc-page-profile-thumb--editable" : ""}`}\n                    disabled={!canEditCharacter}\n                    onDoubleClick={() => canEditCharacter ? setPortraitPickerOpen(true) : null}\n                    title={canEditCharacter ? "Double-click to change this profile portrait" : "Profile portrait"}\n                  >\n                    {selectedPortrait.url ? <img src={selectedPortrait.url} alt="" /> : <span>Portrait</span>}\n                  </button>\n                  <div style={{ minWidth: 0 }}>\n                    <div className="h5 mb-1">{selected.name}</div>',
    "NPC page profile thumbnail"
  );

  source = replaceOnce(
    source,
    '                       extraDirty={detailsDirty}\n                       inventoryHref={inventoryHref || null}',
    '                       extraDirty={detailsDirty}\n                       profileHref={selected?.id ? `/map?npc=${encodeURIComponent(selected.id)}` : null}\n                       profileText="Profile"\n                       inventoryHref={inventoryHref || null}',
    "NPC page sheet profile button"
  );

  source = replaceOnce(
    source,
    '    <NewNpcModal\n        show={showNewNpcModal}',
    '    {portraitPickerOpen && selected ? (\n      <PortraitPickerModal\n        show={portraitPickerOpen}\n        characterId={selected.id}\n        characterName={selected.name || "Character"}\n        canEdit={canEditCharacter}\n        currentStoragePath={selected.portrait_storage_path || selectedPortrait.storagePath || ""}\n        currentUrl={selectedPortrait.url || ""}\n        onClose={() => setPortraitPickerOpen(false)}\n        onSelected={applyPortraitPatchToSelected}\n      />\n    ) : null}\n\n    <NewNpcModal\n        show={showNewNpcModal}',
    "NPC page portrait picker modal"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NPC page portrait picker and profile action.");
  }
}

// -----------------------------------------------------------------------------
// Styling: roster name-only buttons, editable portraits, and the reusable picker.
// -----------------------------------------------------------------------------
{
  const rel = "styles/npc-profile-panel.css";
  let source = read(rel);
  const before = source;
  const marker = "/* ===== NPC portrait picker and profile roster polish v1 ===== */";
  source = appendOnce(source, marker, `${marker}\n.town-quick-profile-link--name-only {\n  justify-content: flex-start;\n  min-width: 0;\n}\n.town-quick-profile-link--name-only span {\n  white-space: normal;\n  overflow: visible;\n  text-overflow: clip;\n  line-height: 1.15;\n}\n.npc-portrait {\n  border: 0;\n  padding: 0;\n  text-align: inherit;\n}\n.npc-portrait:disabled {\n  opacity: 1;\n}\n.npc-portrait--editable,\n.npc-page-profile-thumb--editable {\n  cursor: zoom-in;\n}\n.npc-portrait--editable:hover,\n.npc-portrait--editable:focus-visible,\n.npc-page-profile-thumb--editable:hover,\n.npc-page-profile-thumb--editable:focus-visible {\n  outline: 2px solid rgba(255, 210, 109, 0.9);\n  outline-offset: 3px;\n}\n.npc-page-profile-thumb {\n  width: 110px;\n  height: 146px;\n  flex: 0 0 110px;\n  border: 1px solid rgba(255,255,255,0.16);\n  border-radius: 14px;\n  overflow: hidden;\n  padding: 0;\n  background: rgba(255,255,255,0.05);\n  color: rgba(255,255,255,0.72);\n  display: grid;\n  place-items: center;\n}\n.npc-page-profile-thumb:disabled { opacity: 1; }\n.npc-page-profile-thumb img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n}\n.portrait-picker-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 5000;\n  background: rgba(0,0,0,0.72);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 18px;\n}\n.portrait-picker-modal {\n  width: min(1180px, calc(100vw - 36px));\n  max-height: min(860px, calc(100vh - 36px));\n  display: flex;\n  flex-direction: column;\n  border-radius: 20px;\n  border: 1px solid rgba(255,255,255,0.16);\n  background: linear-gradient(180deg, rgba(21,17,29,0.98), rgba(8,9,14,0.98));\n  box-shadow: 0 28px 80px rgba(0,0,0,0.55);\n  color: #f4f7ff;\n  overflow: hidden;\n}\n.portrait-picker-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 16px;\n  padding: 16px 18px;\n  border-bottom: 1px solid rgba(255,255,255,0.1);\n}\n.portrait-picker-head h3 { margin: 2px 0 4px; }\n.portrait-picker-head p { margin: 0; color: rgba(232,238,255,0.72); }\n.portrait-picker-kicker {\n  font-size: 10px;\n  letter-spacing: .22em;\n  text-transform: uppercase;\n  color: #8dd3ff;\n}\n.portrait-picker-toolbar {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 12px 18px;\n  border-bottom: 1px solid rgba(255,255,255,0.08);\n}\n.portrait-picker-toolbar input { max-width: 520px; }\n.portrait-picker-toolbar span { color: rgba(232,238,255,0.66); font-size: 12px; white-space: nowrap; }\n.portrait-picker-alert {\n  margin: 12px 18px 0;\n  padding: 10px 12px;\n  border-radius: 12px;\n  border: 1px solid rgba(255,95,95,0.28);\n  background: rgba(120,30,30,0.32);\n  color: #ffd8d8;\n}\n.portrait-picker-grid {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow: auto;\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));\n  gap: 12px;\n  padding: 16px 18px 20px;\n}\n.portrait-picker-card {\n  position: relative;\n  min-height: 240px;\n  border: 1px solid rgba(255,255,255,0.12);\n  border-radius: 16px;\n  background: rgba(255,255,255,0.045);\n  color: #f5f7ff;\n  padding: 8px;\n  text-align: left;\n  overflow: hidden;\n}\n.portrait-picker-card:hover:not(:disabled),\n.portrait-picker-card:focus-visible {\n  border-color: rgba(255,210,109,0.72);\n  box-shadow: 0 0 0 2px rgba(255,210,109,0.12);\n}\n.portrait-picker-card.is-current {\n  border-color: rgba(95,211,166,0.9);\n}\n.portrait-picker-image {\n  display: block;\n  width: 100%;\n  aspect-ratio: 3 / 4;\n  border-radius: 12px;\n  overflow: hidden;\n  background: rgba(0,0,0,0.26);\n}\n.portrait-picker-image img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n}\n.portrait-picker-name {\n  display: block;\n  margin-top: 8px;\n  font-weight: 700;\n  font-size: 0.88rem;\n  line-height: 1.2;\n}\n.portrait-picker-bookmark {\n  position: absolute;\n  top: 10px;\n  left: 10px;\n  right: 10px;\n  border-radius: 999px;\n  padding: 4px 8px;\n  background: rgba(15,10,5,0.78);\n  color: #ffe6a6;\n  font-size: 11px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.portrait-picker-current,\n.portrait-picker-saving {\n  position: absolute;\n  bottom: 42px;\n  right: 10px;\n  border-radius: 999px;\n  padding: 4px 8px;\n  font-size: 11px;\n  background: rgba(36,160,95,0.9);\n  color: #fff;\n}\n.portrait-picker-saving { background: rgba(75,118,225,0.92); }\n.portrait-picker-empty {\n  color: rgba(232,238,255,0.66);\n  padding: 18px;\n}\n@media (max-width: 760px) {\n  .portrait-picker-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }\n  .portrait-picker-card { min-height: 210px; }\n  .npc-page-profile-thumb { width: 84px; height: 112px; flex-basis: 84px; }\n}`);

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched portrait picker styles.");
  }
}

if (changedAny) {
  console.log("Applied NPC portrait picker/profile roster polish patch.");
} else {
  console.log("NPC portrait picker/profile roster polish already current.");
}

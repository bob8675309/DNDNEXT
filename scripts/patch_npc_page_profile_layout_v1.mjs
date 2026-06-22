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
// CharacterSheetPanel: allow parent pages to open a profile panel in-place rather
// than only navigating with a href.
// -----------------------------------------------------------------------------
{
  const rel = "components/CharacterSheetPanel.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    '  profileHref = null,\n  profileText = "Profile",\n  inventoryHref = null,',
    '  profileHref = null,\n  profileText = "Profile",\n  onOpenProfile = null,\n  inventoryHref = null,',
    "CharacterSheetPanel onOpenProfile prop"
  );

  source = replaceOnce(
    source,
    `          {profileHref ? (\n            <a\n              className="btn btn-sm btn-outline-info me-2"\n              href={profileHref}\n              title="Open this character profile"\n            >\n              {profileText}\n            </a>\n          ) : null}\n\n          {storeHref ? (`,
    `          {typeof onOpenProfile === "function" ? (\n            <button\n              type="button"\n              className="btn btn-sm btn-outline-info me-2"\n              onClick={onOpenProfile}\n              title="Open this character profile"\n            >\n              {profileText}\n            </button>\n          ) : profileHref ? (\n            <a\n              className="btn btn-sm btn-outline-info me-2"\n              href={profileHref}\n              title="Open this character profile"\n            >\n              {profileText}\n            </a>\n          ) : null}\n\n          {storeHref ? (`,
    "CharacterSheetPanel profile button action"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched CharacterSheetPanel in-place profile action.");
  }
}

// -----------------------------------------------------------------------------
// NPC page: move portrait into description flow and open NpcPanel in-place.
// This script intentionally runs after patch_npc_profile_portrait_picker_v1.
// -----------------------------------------------------------------------------
{
  const rel = "pages/npcs.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    'import NewNpcModal from "../components/NewNpcModal";\nimport PortraitPickerModal from "../components/PortraitPickerModal";',
    'import NewNpcModal from "../components/NewNpcModal";\nimport NpcPanel from "../components/NpcPanel";\nimport PortraitPickerModal from "../components/PortraitPickerModal";',
    "NPC page NpcPanel import"
  );

  source = replaceOnce(
    source,
    '  const [showNewNpcModal, setShowNewNpcModal] = useState(false);\n  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);',
    '  const [showNewNpcModal, setShowNewNpcModal] = useState(false);\n  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);\n  const [profilePanelOpen, setProfilePanelOpen] = useState(false);',
    "NPC page profile panel state"
  );

  source = replaceOnce(
    source,
    `                <div className="d-flex align-items-start gap-3">\n                  <button\n                    type="button"\n                    className={\`npc-page-profile-thumb \${canEditCharacter ? "npc-page-profile-thumb--editable" : ""}\`}\n                    disabled={!canEditCharacter}\n                    onDoubleClick={() => canEditCharacter ? setPortraitPickerOpen(true) : null}\n                    title={canEditCharacter ? "Double-click to change this profile portrait" : "Profile portrait"}\n                  >\n                    {selectedPortrait.url ? <img src={selectedPortrait.url} alt="" /> : <span>Portrait</span>}\n                  </button>\n                  <div style={{ minWidth: 0 }}>\n                    <div className="h5 mb-1">{selected.name}</div>`,
    `                <div className="d-flex align-items-start">\n                  <div style={{ minWidth: 0 }}>\n                    <div className="h5 mb-1">{selected.name}</div>`,
    "NPC page remove header thumbnail"
  );

  source = replaceOnce(
    source,
    `                    <div className="fw-semibold mb-1">Description</div>\n                    {canEditNarrative ? (\n                      <textarea\n                        className="form-control form-control-sm"\n                        style={{\n                          background: "rgba(255,255,255,0.04)",\n                          border: \`1px solid \${BORDER}\`,\n                          color: "rgba(255,255,255,0.92)",\n                        }}\n                        rows={3}\n                        value={details.description || ""}\n                        onChange={(e) => setDetailsField("description", e.target.value)}\n                      />\n                    ) : (\n                      <div style={{ color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>\n                        {descriptionText || <span className="npc-muted">—</span>}\n                      </div>\n                    )}`,
    `                    <div className="fw-semibold mb-1">Description</div>\n                    <div className="npc-page-description-flow">\n                      <button\n                        type="button"\n                        className={\`npc-page-profile-thumb npc-page-profile-thumb--inline \${canEditCharacter ? "npc-page-profile-thumb--editable" : ""}\`}\n                        disabled={!canEditCharacter}\n                        onDoubleClick={() => canEditCharacter ? setPortraitPickerOpen(true) : null}\n                        title={canEditCharacter ? "Double-click to change this profile portrait" : "Profile portrait"}\n                      >\n                        {selectedPortrait.url ? <img src={selectedPortrait.url} alt="" /> : <span>Portrait</span>}\n                      </button>\n\n                      {canEditNarrative ? (\n                        <textarea\n                          className="form-control form-control-sm"\n                          style={{\n                            background: "rgba(255,255,255,0.04)",\n                            border: \`1px solid \${BORDER}\`,\n                            color: "rgba(255,255,255,0.92)",\n                          }}\n                          rows={5}\n                          value={details.description || ""}\n                          onChange={(e) => setDetailsField("description", e.target.value)}\n                        />\n                      ) : (\n                        <div className="npc-page-description-text" style={{ color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap" }}>\n                          {descriptionText || <span className="npc-muted">—</span>}\n                        </div>\n                      )}\n                    </div>`,
    "NPC page description portrait flow"
  );

  source = replaceOnce(
    source,
    '                       profileHref={selected?.id ? `/map?npc=${encodeURIComponent(selected.id)}` : null}\n                       profileText="Profile"\n                       inventoryHref={inventoryHref || null}',
    '                       profileHref={selected?.id ? `/map?npc=${encodeURIComponent(selected.id)}` : null}\n                       profileText="Profile"\n                       onOpenProfile={() => setProfilePanelOpen(true)}\n                       inventoryHref={inventoryHref || null}',
    "NPC page sheet opens inline profile panel"
  );

  source = replaceOnce(
    source,
    `    {portraitPickerOpen && selected ? (\n      <PortraitPickerModal`,
    `    {profilePanelOpen && selected ? (\n      <div className="npc-page-profile-panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? setProfilePanelOpen(false) : null}>\n        <div className="npc-page-profile-panel-shell">\n          <NpcPanel\n            npc={selected}\n            isAdmin={isAdmin}\n            locations={locations}\n            onClose={() => setProfilePanelOpen(false)}\n            onOpenDrawer={() => {}}\n            onBrowseWares={(merchant) => {\n              if (merchant?.id) window.location.href = \`/map?merchant=\${encodeURIComponent(merchant.id)}\`;\n            }}\n          />\n        </div>\n      </div>\n    ) : null}\n\n    {portraitPickerOpen && selected ? (\n      <PortraitPickerModal`,
    "NPC page inline profile panel render"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NPC page portrait flow and inline profile panel.");
  }
}

// -----------------------------------------------------------------------------
// CSS for inline description portrait and NPC-page profile panel overlay.
// -----------------------------------------------------------------------------
{
  const rel = "styles/npc-profile-panel.css";
  let source = read(rel);
  const before = source;
  const marker = "/* ===== NPC page description portrait and inline profile panel v1 ===== */";
  source = appendOnce(source, marker, `${marker}\n.npc-page-description-flow::after {\n  content: \"\";\n  display: block;\n  clear: both;\n}\n.npc-page-profile-thumb--inline {\n  float: left;\n  margin: 0.15rem 1rem 0.65rem 0;\n}\n.npc-page-description-text {\n  line-height: 1.55;\n}\n.npc-page-profile-panel-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 4700;\n  background: rgba(0,0,0,0.64);\n  display: flex;\n  align-items: stretch;\n  justify-content: flex-end;\n  padding: 1rem;\n}\n.npc-page-profile-panel-shell {\n  width: min(1120px, calc(100vw - 2rem));\n  max-height: calc(100vh - 2rem);\n  border-radius: 18px;\n  overflow: hidden;\n  background: rgba(4,5,10,0.98);\n  border: 1px solid rgba(255,255,255,0.14);\n  box-shadow: 0 28px 80px rgba(0,0,0,0.55);\n}\n.npc-page-profile-panel-shell .npc-panel-inner {\n  height: 100%;\n}\n@media (max-width: 720px) {\n  .npc-page-profile-thumb--inline {\n    float: none;\n    margin: 0 0 0.75rem 0;\n  }\n  .npc-page-profile-panel-backdrop {\n    padding: 0.5rem;\n  }\n  .npc-page-profile-panel-shell {\n    width: calc(100vw - 1rem);\n    max-height: calc(100vh - 1rem);\n  }\n}`);

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NPC page profile layout styles.");
  }
}

if (changedAny) {
  console.log("Applied NPC page profile layout/profile panel patch.");
} else {
  console.log("NPC page profile layout/profile panel patch already current.");
}

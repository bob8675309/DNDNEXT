import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function write(rel, source) {
  fs.writeFileSync(path.join(process.cwd(), rel), source, "utf8");
}

function insertAfter(source, needle, insert, label) {
  if (source.includes(insert.trim())) return source;
  if (!source.includes(needle)) {
    console.warn(`${label}: anchor not found; leaving source unchanged.`);
    return source;
  }
  return source.replace(needle, `${needle}${insert}`);
}

let changed = false;

// -----------------------------------------------------------------------------
// EquipmentDiagram: keep selected-item preview clean and move item transfer into
// the backpack column, where the owner chooses carried/equipped items.
// -----------------------------------------------------------------------------
{
  const rel = "components/EquipmentDiagram.js";
  let source = read(rel);
  const before = source;

  source = source.replace(
    /\n            \{canTransfer && transferOptions\.length \? \(\n              <div className="equipment-workbench__transfer">[\s\S]*?\n            \) : null\}/,
    ""
  );

  const browserInsertAnchor = `          {!filteredRows.length ? <div className="equipment-workbench__empty">No carried items match this filter.</div> : null}\n        </div>`;
  const browserTransferBlock = [
    "",
    "",
    "        {canTransfer && transferOptions.length ? (",
    '          <div className="equipment-workbench__transfer equipment-workbench__transfer--backpack">',
    '            <div className="equipment-workbench__transfer-label">Send selected item</div>',
    '            <div className="equipment-workbench__transfer-row">',
    "              <select",
    "                value={transferTargetKey}",
    "                onChange={(event) => setTransferTargetKey(event.target.value)}",
    "                disabled={transferBusy}",
    '                aria-label="Send item target"',
    "              >",
    '                <option value="">Choose target…</option>',
    "                {transferOptions.map((target) => (",
    "                  <option key={target.key} value={target.key}>",
    '                    {target.group ? `${target.group}: ` : ""}{target.label}',
    "                  </option>",
    "                ))}",
    "              </select>",
    '              <button type="button" onClick={sendSelectedItem} disabled={transferBusy || !transferTargetKey || !selectedRow?.id}>',
    '                {transferBusy ? "Sending…" : "Send"}',
    "              </button>",
    "            </div>",
    '            {transferMessage ? <div className="equipment-workbench__transfer-message">{transferMessage}</div> : null}',
    "          </div>",
    "        ) : null}",
  ].join("\n");

  if (!source.includes('equipment-workbench__transfer--backpack')) {
    source = insertAfter(source, browserInsertAnchor, browserTransferBlock, "EquipmentDiagram backpack transfer controls");
  }

  if (source !== before) {
    write(rel, source);
    changed = true;
    console.log("Patched EquipmentDiagram transfer placement.");
  }
}

// -----------------------------------------------------------------------------
// NPC page: make the in-place profile panel owned here as a fallback/source of
// truth even when older generated profile scripts no-op.
// -----------------------------------------------------------------------------
{
  const rel = "pages/npcs.js";
  let source = read(rel);
  const before = source;

  if (!source.includes('import NpcPanel from "../components/NpcPanel";')) {
    source = source.replace(
      'import NewNpcModal from "../components/NewNpcModal";',
      'import NewNpcModal from "../components/NewNpcModal";\nimport NpcPanel from "../components/NpcPanel";'
    );
  }

  if (!source.includes('const [profilePanelOpen, setProfilePanelOpen]')) {
    source = source.replace(
      '  const [showNewNpcModal, setShowNewNpcModal] = useState(false);',
      '  const [showNewNpcModal, setShowNewNpcModal] = useState(false);\n  const [profilePanelOpen, setProfilePanelOpen] = useState(false);'
    );
  }

  if (!source.includes('onOpenProfile={() => setProfilePanelOpen(true)}')) {
    if (source.includes('                       profileText="Profile"\n                       inventoryHref={inventoryHref || null}')) {
      source = source.replace(
        '                       profileText="Profile"\n                       inventoryHref={inventoryHref || null}',
        '                       profileText="Profile"\n                       onOpenProfile={() => setProfilePanelOpen(true)}\n                       inventoryHref={inventoryHref || null}'
      );
    } else if (source.includes('                       inventoryText="Inventory"\n                       // Merchants have storefronts.')) {
      source = source.replace(
        '                       inventoryText="Inventory"\n                       // Merchants have storefronts.',
        '                       inventoryText="Inventory"\n                       profileText="Profile"\n                       onOpenProfile={() => setProfilePanelOpen(true)}\n                       // Merchants have storefronts.'
      );
    }
  }

  if (!source.includes('npc-page-profile-panel-shell')) {
    source = source.replace(
      '    <NewNpcModal',
      `    {profilePanelOpen && selected ? (\n      <div className="npc-page-profile-panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? setProfilePanelOpen(false) : null}>\n        <div className="npc-page-profile-panel-shell">\n          <NpcPanel\n            npc={selected}\n            isAdmin={isAdmin}\n            locations={locations}\n            onClose={() => setProfilePanelOpen(false)}\n            onOpenDrawer={() => {}}\n            onBrowseWares={(merchant) => {\n              if (merchant?.id) window.location.href = \`/map?merchant=\${encodeURIComponent(merchant.id)}\`;\n            }}\n          />\n        </div>\n      </div>\n    ) : null}\n\n    <NewNpcModal`
    );
  }

  if (source !== before) {
    write(rel, source);
    changed = true;
    console.log("Patched NPC page inline profile panel fallback.");
  }
}

// -----------------------------------------------------------------------------
// CSS: profile-panel layout must apply both to the map offcanvas (#npcPanel) and
// the /npcs page overlay (.npc-page-profile-panel-shell).
// -----------------------------------------------------------------------------
{
  const rel = "styles/npc-profile-panel.css";
  let source = read(rel);
  const before = source;
  const marker = "/* ===== NPC page profile panel shell parity v2 ===== */";

  if (!source.includes(marker)) {
    source = `${source.trimEnd()}

${marker}
.npc-page-profile-panel-backdrop {
  position: fixed;
  inset: 0;
  z-index: 4700;
  background: rgba(0,0,0,0.64);
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  padding: 1rem;
}

.npc-page-profile-panel-shell {
  width: min(1180px, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  border-radius: 18px;
  overflow: hidden;
  background: rgba(4,5,10,0.98);
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: 0 28px 80px rgba(0,0,0,0.55);
}

.npc-page-profile-panel-shell .npc-panel-inner {
  height: 100%;
  overflow: hidden;
}

.npc-page-profile-panel-shell .npc-panel-body {
  grid-template-columns: minmax(320px, 380px) 1fr;
  overflow-y: auto;
  overflow-x: hidden;
  align-content: start;
  padding-right: 0.5rem;
  padding-bottom: 2rem;
  scrollbar-gutter: stable;
}

.npc-page-profile-panel-shell .npc-panel-body.d-block {
  display: block !important;
  overflow-y: auto;
  overflow-x: hidden;
}

.npc-page-profile-panel-shell .npc-left {
  min-width: 0;
  align-self: start;
}

.npc-page-profile-panel-shell .npc-right {
  overflow: visible;
  align-self: start;
}

.npc-page-profile-panel-shell .npc-portrait {
  width: 100%;
  height: auto;
  min-height: 0;
  aspect-ratio: 3 / 4;
  align-items: stretch;
  justify-content: stretch;
}

.npc-page-profile-panel-shell .npc-portrait img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.npc-page-profile-panel-shell .npc-portrait-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.npc-page-profile-panel-shell .npc-panel-body > .npc-card:last-child {
  margin-top: 0.75rem !important;
}

.npc-page-profile-panel-shell .npc-panel-inventory-workbench {
  min-width: 0;
}

.npc-page-profile-panel-shell .npc-panel-inventory-workbench .equipment-workbench {
  --eq-top-panel-height: clamp(560px, 52vw, 720px);
  grid-template-columns: minmax(600px, 1.35fr) minmax(160px, 0.28fr) minmax(300px, 0.62fr) !important;
  gap: 0.65rem !important;
  margin: 0 !important;
  max-width: none !important;
}

.npc-page-profile-panel-shell .npc-panel-inventory-workbench .equipment-workbench__stage-card,
.npc-page-profile-panel-shell .npc-panel-inventory-workbench .equipment-workbench__browser-card,
.npc-page-profile-panel-shell .npc-panel-inventory-workbench .equipment-workbench__detail-card {
  min-width: 0 !important;
}

.npc-page-profile-panel-shell .npc-panel-inventory-workbench .equipment-workbench__drag-help {
  display: none !important;
}

@media (min-width: 981px) {
  .npc-page-profile-panel-shell .npc-left {
    grid-column: 1 / 2;
    grid-row: 1 / span 99;
  }

  .npc-page-profile-panel-shell .npc-right {
    display: contents;
  }

  .npc-page-profile-panel-shell .npc-right > .npc-card,
  .npc-page-profile-panel-shell .npc-panel-body > .npc-card:last-child {
    grid-column: 2 / 3 !important;
  }
}

@media (max-width: 1220px) {
  .npc-page-profile-panel-shell .npc-panel-inventory-workbench .equipment-workbench {
    grid-template-columns: minmax(520px, 1fr) minmax(150px, 0.28fr) minmax(270px, 0.55fr) !important;
  }
}

@media (max-width: 980px) {
  .npc-page-profile-panel-backdrop {
    padding: 0.5rem;
  }

  .npc-page-profile-panel-shell {
    width: calc(100vw - 1rem);
    max-height: calc(100vh - 1rem);
  }

  .npc-page-profile-panel-shell .npc-panel-body {
    grid-template-columns: 1fr;
  }

  .npc-page-profile-panel-shell .npc-right {
    display: block;
  }

  .npc-page-profile-panel-shell .npc-portrait {
    max-width: 420px;
  }

  .npc-page-profile-panel-shell .npc-panel-inventory-workbench .equipment-workbench {
    grid-template-columns: 1fr !important;
  }

  .npc-page-profile-panel-shell .npc-panel-inventory-workbench .equipment-workbench__browser-card,
  .npc-page-profile-panel-shell .npc-panel-inventory-workbench .equipment-workbench__detail-card {
    grid-column: auto !important;
  }
}
`;
  }

  if (source !== before) {
    write(rel, source);
    changed = true;
    console.log("Patched NPC page profile panel CSS parity.");
  }
}

if (!changed) {
  console.log("NPC equipment/profile finish patch already current.");
}

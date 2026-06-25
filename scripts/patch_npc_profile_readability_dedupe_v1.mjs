import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function write(rel, source) {
  fs.writeFileSync(path.join(process.cwd(), rel), source, "utf8");
}

let changed = false;

// Final pass for CharacterSheetPanel after the generated NPC page patches run.
// Older patches could leave a legacy Profile action before Store while the newer
// source renders Profile after Inventory. Keep the newer placement only.
{
  const rel = "components/CharacterSheetPanel.js";
  let source = read(rel);
  const before = source;

  source = source.replace(
    /\n          \{typeof onOpenProfile === "function" \? \([\s\S]*?\n          \) : null\}\n\n          \{storeHref \? \(/,
    "\n          {storeHref ? ("
  );

  // If any source path passes both a href and an in-place handler, the handler is
  // authoritative. This prevents fallback duplication if the component changes.
  source = source.replace(
    /\s+profileHref=\{selected\?\.id \? `\/map\?npc=\$\{encodeURIComponent\(selected\.id\)\}` : null\}/g,
    ""
  );

  if (source !== before) {
    write(rel, source);
    changed = true;
    console.log("Normalized NPC sheet Profile action placement.");
  }
}

// Final contrast pass for the /npcs in-place profile overlay. The map offcanvas
// has its own styling; this targets only the NPC-page shell.
{
  const rel = "styles/npc-profile-panel.css";
  let source = read(rel);
  const before = source;
  const marker = "/* ===== NPC page profile readability and dedupe v1 ===== */";

  if (!source.includes(marker)) {
    source = `${source.trimEnd()}

${marker}
.npc-page-profile-panel-shell {
  color: #f6f0ff;
  background: rgba(5, 5, 12, 0.99) !important;
}

.npc-page-profile-panel-shell .npc-panel-body {
  background: rgba(5, 5, 12, 0.985);
}

.npc-page-profile-panel-shell .npc-card,
.npc-page-profile-panel-shell .npc-panel-body .npc-card,
.npc-page-profile-panel-shell .npc-panel-body .rounded-3 {
  background: rgba(20, 17, 27, 0.94) !important;
  border-color: rgba(255, 255, 255, 0.14) !important;
  color: #f5efff !important;
}

.npc-page-profile-panel-shell .npc-card-title,
.npc-page-profile-panel-shell .fw-semibold,
.npc-page-profile-panel-shell .npc-name,
.npc-page-profile-panel-shell h1,
.npc-page-profile-panel-shell h2,
.npc-page-profile-panel-shell h3,
.npc-page-profile-panel-shell h4,
.npc-page-profile-panel-shell h5,
.npc-page-profile-panel-shell h6 {
  color: #fff7e6 !important;
}

.npc-page-profile-panel-shell .npc-text,
.npc-page-profile-panel-shell .npc-details,
.npc-page-profile-panel-shell .npc-details div,
.npc-page-profile-panel-shell .npc-panel-body p,
.npc-page-profile-panel-shell .npc-panel-body div {
  color: #f4efff;
}

.npc-page-profile-panel-shell .text-muted,
.npc-page-profile-panel-shell .small.text-muted,
.npc-page-profile-panel-shell .npc-subline,
.npc-page-profile-panel-shell .npc-dialogue-hint,
.npc-page-profile-panel-shell .npc-panel-body .small {
  color: rgba(229, 219, 255, 0.78) !important;
}

.npc-page-profile-panel-shell .badge.bg-secondary,
.npc-page-profile-panel-shell .npc-status {
  color: #ffffff !important;
}

.npc-page-profile-panel-shell .btn-outline-light,
.npc-page-profile-panel-shell .btn-outline-info {
  color: #f8f3ff !important;
  border-color: rgba(255, 255, 255, 0.72) !important;
}

.npc-page-profile-panel-shell .btn-outline-info {
  border-color: rgba(74, 211, 255, 0.85) !important;
}

.npc-page-profile-panel-shell .btn-outline-warning {
  color: #ffd76d !important;
}

.npc-page-profile-panel-shell .btn-primary {
  color: #ffffff !important;
}
`;
  }

  if (source !== before) {
    write(rel, source);
    changed = true;
    console.log("Added NPC page profile readability overrides.");
  }
}

if (!changed) {
  console.log("NPC profile readability/dedupe patch already current.");
}

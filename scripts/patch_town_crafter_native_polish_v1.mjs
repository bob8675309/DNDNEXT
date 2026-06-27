import fs from "node:fs";
import path from "node:path";

const cssPath = path.join(process.cwd(), "styles", "npc-profile-panel.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* ===== Town native crafter storefront polish v1 ===== */";

if (!css.includes(marker)) {
  css += `\n\n${marker}\n.town-crafter-storefront {\n  width: min(1500px, calc(100vw - 24px)) !important;\n  min-height: min(860px, calc(100vh - 36px));\n  max-height: calc(100vh - 28px);\n  grid-template-columns: minmax(285px, 34%) minmax(0, 1fr) !important;\n  gap: 1.25rem !important;\n  padding: 1.1rem !important;\n  overflow: auto;\n}\n.town-crafter-storefront::before {\n  position: sticky;\n  top: 0;\n  min-height: min(78vh, 840px) !important;\n  height: calc(100vh - 70px);\n  background-color: rgba(38, 22, 45, 0.92);\n}\n.town-crafter-storefront > * {\n  min-width: 0;\n}\n.town-crafter-storefront .craft-step-grid,\n.town-crafter-storefront .crafter-step-grid,\n.town-crafter-storefront [class*="stepGrid"] {\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n}\n.town-crafter-storefront .craft-bench-grid,\n.town-crafter-storefront .craft-bench-selection-grid,\n.town-crafter-storefront [class*="benchGrid"],\n.town-crafter-storefront [class*="selectionGrid"] {\n  grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr) !important;\n}\n.town-crafter-storefront .craft-section,\n.town-crafter-storefront .craft-panel,\n.town-crafter-storefront [class*="section"],\n.town-crafter-storefront [class*="panel"] {\n  min-width: 0;\n}\n.town-crafter-storefront .craft-preview-card,\n.town-crafter-storefront [class*="preview"] {\n  min-width: 0;\n}\n.town-crafter-storefront .town-crafter-workshop-frame {\n  display: none !important;\n}\n@media (max-width: 1120px) {\n  .town-crafter-storefront {\n    grid-template-columns: 1fr !important;\n  }\n  .town-crafter-storefront::before {\n    position: relative;\n    min-height: 360px !important;\n    height: 42vh;\n  }\n  .town-crafter-storefront > * {\n    grid-column: 1 / -1;\n  }\n  .town-crafter-storefront .craft-bench-grid,\n  .town-crafter-storefront .craft-bench-selection-grid,\n  .town-crafter-storefront [class*="benchGrid"],\n  .town-crafter-storefront [class*="selectionGrid"] {\n    grid-template-columns: 1fr !important;\n  }\n}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
  console.log("Applied native town crafter storefront polish.");
} else {
  console.log("Native town crafter storefront polish already present.");
}

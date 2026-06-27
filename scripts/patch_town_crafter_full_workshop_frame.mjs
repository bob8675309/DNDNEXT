import fs from "node:fs";
import path from "node:path";

const townPath = path.join(process.cwd(), "components", "TownSheet.js");
let source = fs.readFileSync(townPath, "utf8");

if (!source.includes('town-crafter-workshop-frame')) {
  const anchor = '  const fullWorkshopHref = {';
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) throw new Error("Town crafter full workshop href anchor not found");

  const returnIndex = source.indexOf('\n  return (', anchorIndex);
  if (returnIndex < 0) throw new Error("Town crafter modal return anchor not found after fullWorkshopHref");

  const injection = `
  const fullWorkshopSrc = "/items?discipline=" + encodeURIComponent(fullWorkshopDiscipline) + "&crafter=" + encodeURIComponent(crafter?.id || "") + "&from=town&embed=1&townWorkshop=1";

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={cls(styles.crafterModal, styles.crafterModalBuilder, "town-crafter-storefront", "town-crafter-full-workshop")} style={typeof crafterStorefrontStyle === "object" ? crafterStorefrontStyle : undefined} onClick={(event) => event.stopPropagation()}>
        <div className={styles.crafterModalHead}>
          <div>
            <div className={styles.eyebrow}>Workshop</div>
            <div className={styles.crafterModalTitle}>{crafter?.name || "Crafter"}</div>
            <div className={styles.muted}>{(crafterTypes || []).map(humanizeCraftType).join(" • ")} • same crafting workflow</div>
          </div>
          <div className="d-flex flex-wrap justify-content-end gap-2">
            <Link className="btn btn-sm btn-warning" href={fullWorkshopHref}>Open Full Workshop</Link>
            <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
          </div>
        </div>
        <iframe className="town-crafter-workshop-frame" src={fullWorkshopSrc} title={(crafter?.name || "Crafter") + " crafting workflow"} loading="eager" />
      </div>
    </div>
  );
`;

  source = source.slice(0, returnIndex) + injection + source.slice(returnIndex);
  fs.writeFileSync(townPath, source, "utf8");
  console.log("Patched TownSheet town crafter modal to show the real crafting workflow inside the storefront shell.");
} else {
  console.log("Town crafter full workflow frame already present.");
}

const cssPath = path.join(process.cwd(), "styles", "npc-profile-panel.css");
let css = fs.readFileSync(cssPath, "utf8");
const cssMarker = "/* ===== Town embedded full workflow frame v3 ===== */";
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.town-crafter-full-workshop {\n  width: min(1720px, calc(100vw - 20px)) !important;\n  height: min(960px, calc(100vh - 20px)) !important;\n  max-height: calc(100vh - 20px) !important;\n  display: grid !important;\n  grid-template-columns: minmax(260px, 26%) minmax(0, 1fr) !important;\n  grid-template-rows: auto minmax(0, 1fr) !important;\n  gap: 0.95rem !important;\n  padding: 1rem !important;\n  overflow: hidden !important;\n}\n.town-crafter-full-workshop::before {\n  grid-column: 1 / 2 !important;\n  grid-row: 1 / 3 !important;\n  min-height: 0 !important;\n  height: 100% !important;\n  border-radius: 1.15rem !important;\n  background-position: center top !important;\n}\n.town-crafter-full-workshop > :not(.town-crafter-workshop-frame) {\n  grid-column: 2 / 3 !important;\n  grid-row: 1 / 2 !important;\n}\n.town-crafter-full-workshop .town-crafter-workshop-frame {\n  grid-column: 2 / 3 !important;\n  grid-row: 2 / 3 !important;\n  display: block !important;\n  width: 100% !important;\n  height: 100% !important;\n  min-height: 0 !important;\n  border: 1px solid rgba(255,255,255,0.14) !important;\n  border-radius: 1rem !important;\n  background: #120a1f !important;\n}\n@media (max-width: 1050px) {\n  .town-crafter-full-workshop {\n    grid-template-columns: 1fr !important;\n    grid-template-rows: auto auto minmax(720px, 1fr) !important;\n    overflow: auto !important;\n  }\n  .town-crafter-full-workshop::before {\n    grid-column: 1 / -1 !important;\n    grid-row: 1 / 2 !important;\n    height: 380px !important;\n  }\n  .town-crafter-full-workshop > :not(.town-crafter-workshop-frame) {\n    grid-column: 1 / -1 !important;\n    grid-row: 2 / 3 !important;\n  }\n  .town-crafter-full-workshop .town-crafter-workshop-frame {\n    grid-column: 1 / -1 !important;\n    grid-row: 3 / 4 !important;\n    min-height: 720px !important;\n  }\n}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
  console.log("Patched TownSheet full crafting workflow storefront CSS.");
}

if (!source.includes('town-crafter-workshop-frame')) throw new Error("TownSheet full workflow frame validation failed");

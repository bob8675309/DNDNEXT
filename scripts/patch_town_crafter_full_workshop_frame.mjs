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
            <div className={styles.muted}>{(crafterTypes || []).map(humanizeCraftType).join(" • ")} • Browse known recipes first</div>
          </div>
          <div className="d-flex flex-wrap justify-content-end gap-2">
            <Link className="btn btn-sm btn-warning" href={fullWorkshopHref}>Open Full Workshop</Link>
            <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
          </div>
        </div>
        <iframe className="town-crafter-workshop-frame" src={fullWorkshopSrc} title={(crafter?.name || "Crafter") + " full workshop"} loading="eager" />
      </div>
    </div>
  );
`;

  source = source.slice(0, returnIndex) + injection + source.slice(returnIndex);
  fs.writeFileSync(townPath, source, "utf8");
  console.log("Patched TownSheet town crafter modal to embed the full crafting workflow.");
} else {
  console.log("Town crafter full workshop frame already present.");
}

const cssPath = path.join(process.cwd(), "styles", "npc-profile-panel.css");
let css = fs.readFileSync(cssPath, "utf8");
const cssMarker = "/* ===== Town embedded full workshop frame v2 ===== */";
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.town-crafter-full-workshop {\n  width: min(1580px, calc(100vw - 28px));\n  height: min(940px, calc(100vh - 28px));\n  max-height: calc(100vh - 28px);\n  display: grid !important;\n  grid-template-columns: minmax(250px, 28%) minmax(0, 1fr);\n  gap: 1rem;\n  overflow: hidden;\n}\n.town-crafter-full-workshop .town-crafter-workshop-frame {\n  grid-column: 2 / 3;\n  flex: 1 1 auto;\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  border: 1px solid rgba(255,255,255,0.12);\n  border-radius: 1rem;\n  background: #120a1f;\n}\n.town-crafter-full-workshop .TownSheet_crafterModalHead__UNUSED,\n.town-crafter-full-workshop > :not(.town-crafter-workshop-frame) {\n  grid-column: 2 / 3;\n}\n@media (max-width: 1050px) {\n  .town-crafter-full-workshop { grid-template-columns: 1fr; }\n  .town-crafter-full-workshop::before,\n  .town-crafter-full-workshop > *,\n  .town-crafter-full-workshop .town-crafter-workshop-frame { grid-column: 1 / -1; }\n  .town-crafter-full-workshop .town-crafter-workshop-frame { min-height: 720px; }\n}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
  console.log("Patched TownSheet full workshop frame CSS.");
}

if (!source.includes('town-crafter-workshop-frame')) throw new Error("TownSheet full workshop frame validation failed");

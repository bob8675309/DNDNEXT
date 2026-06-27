import fs from "node:fs";
import path from "node:path";

const townPath = path.join(process.cwd(), "components", "TownSheet.js");
let source = fs.readFileSync(townPath, "utf8");

if (!source.includes('town-crafter-workshop-frame')) {
  const marker = `  const fullWorkshopHref = {
    pathname: "/items",
    query: { discipline: fullWorkshopDiscipline, craft: "1", crafter: crafter?.id || "", from: "town" },
  };

  return (`;

  const replacement = `  const fullWorkshopHref = {
    pathname: "/items",
    query: { discipline: fullWorkshopDiscipline, craft: "1", crafter: crafter?.id || "", from: "town" },
  };
  const fullWorkshopSrc = "/items?discipline=" + encodeURIComponent(fullWorkshopDiscipline) + "&craft=1&crafter=" + encodeURIComponent(crafter?.id || "") + "&from=town&embed=1";

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={cls(styles.crafterModal, styles.crafterModalBuilder, "town-crafter-full-workshop")} onClick={(event) => event.stopPropagation()}>
        <div className={styles.crafterModalHead}>
          <div>
            <div className={styles.eyebrow}>Workshop</div>
            <div className={styles.crafterModalTitle}>{crafter?.name || "Crafter"}</div>
            <div className={styles.muted}>{(crafterTypes || []).map(humanizeCraftType).join(" • ")}</div>
          </div>
          <div className="d-flex flex-wrap justify-content-end gap-2">
            <Link className="btn btn-sm btn-warning" href={fullWorkshopHref}>Open Full Workshop</Link>
            <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
          </div>
        </div>
        <iframe className="town-crafter-workshop-frame" src={fullWorkshopSrc} title={(crafter?.name || "Crafter") + " full workshop"} />
      </div>
    </div>
  );

  return (`;

  const count = source.split(marker).length - 1;
  if (count !== 1) throw new Error(`Town crafter full workshop marker expected one match, found ${count}`);
  source = source.replace(marker, replacement);
  fs.writeFileSync(townPath, source, "utf8");
  console.log("Patched TownSheet town crafter modal to embed the full crafting workflow.");
} else {
  console.log("Town crafter full workshop frame already present.");
}

const cssPath = path.join(process.cwd(), "styles", "npc-profile-panel.css");
let css = fs.readFileSync(cssPath, "utf8");
const cssMarker = "/* ===== Town embedded full workshop frame v1 ===== */";
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.town-crafter-full-workshop {\n  width: min(1500px, calc(100vw - 28px));\n  height: min(930px, calc(100vh - 28px));\n  max-height: calc(100vh - 28px);\n  display: flex !important;\n  flex-direction: column;\n  overflow: hidden;\n}\n.town-crafter-workshop-frame {\n  flex: 1 1 auto;\n  width: 100%;\n  min-height: 0;\n  border: 1px solid rgba(255,255,255,0.12);\n  border-radius: 1rem;\n  background: #120a1f;\n}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
  console.log("Patched TownSheet full workshop frame CSS.");
}

if (!source.includes('town-crafter-workshop-frame')) throw new Error("TownSheet full workshop frame validation failed");

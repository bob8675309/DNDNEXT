import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
let source = fs.readFileSync(panelPath, "utf8");

const before = [
  '            <div className="btn-group btn-group-sm" role="tablist" aria-label="NPC profile views">',
  '              <button type="button" className={`btn ${activeView === "profile" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("profile")}>Profile</button>',
  '              <button type="button" className={`btn ${activeView === "sheet" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("sheet")}>Sheet & Rolls</button>',
  '              <button type="button" className={`btn ${activeView === "inventory" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("inventory")}>Inventory</button>',
  '              {isMerchantView ? <button type="button" className={`btn ${activeView === "shop" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("shop")}>Shop</button> : null}',
  '            </div>',
].join("\n");

const after = [
  '            {typeof renderInteractionTabs === "function" && !hasCraftCapability ? renderInteractionTabs() : (',
  '              <div className="btn-group btn-group-sm" role="tablist" aria-label="NPC profile views">',
  '                <button type="button" className={`btn ${activeView === "profile" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("profile")}>Profile</button>',
  '                <button type="button" className={`btn ${activeView === "sheet" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("sheet")}>Sheet & Rolls</button>',
  '                <button type="button" className={`btn ${activeView === "inventory" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("inventory")}>Inventory</button>',
  '                {isMerchantView ? <button type="button" className={`btn ${activeView === "shop" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setActiveView("shop")}>Shop</button> : null}',
  '              </div>',
  '            )}',
].join("\n");

if (source.includes(after)) {
  console.log("NpcPanel wrapper tab renderer already wired with craft fallback guard.");
  process.exit(0);
}

const count = source.split(before).length - 1;
if (count !== 1) {
  throw new Error(`NpcPanel wrapper tabs patch expected one tab block match, found ${count}`);
}

source = source.replace(before, after);
fs.writeFileSync(panelPath, source, "utf8");
console.log("Patched NpcPanel to use wrapper tab renderer for non-crafters while preserving fallback tabs.");

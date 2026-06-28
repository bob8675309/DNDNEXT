import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "NpcPanel.js");
let source = fs.readFileSync(panelPath, "utf8");

const before = '      {activeView === "sheet" ? (';
const after = [
  '      {activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function" ? (',
  '        <div className="npc-panel-body d-block">',
  '          {renderCraftView()}',
  '        </div>',
  '      ) : activeView === "sheet" ? (',
].join("\n");

if (source.includes(after)) {
  console.log("NpcPanel craft placeholder body branch already exists.");
  process.exit(0);
}

const count = source.split(before).length - 1;
if (count !== 1) {
  throw new Error(`NpcPanel craft placeholder body patch expected one body branch match, found ${count}`);
}

source = source.replace(before, after);
fs.writeFileSync(panelPath, source, "utf8");
console.log("Patched NpcPanel with guarded craft placeholder body branch.");

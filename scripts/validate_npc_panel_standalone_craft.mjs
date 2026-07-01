import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "components/NpcPanel.js"), "utf8");

function requireToken(token) {
  if (!source.includes(token)) throw new Error(`NpcPanel standalone craft: missing ${token}`);
}

function requireAbsent(token) {
  if (source.includes(token)) throw new Error(`NpcPanel standalone craft: forbidden ${token}`);
}

for (const token of [
  'import { resolveCraftProfession } from "../utils/craftProfession";',
  'const CraftingWorkspace = dynamic(() => import("./CraftingWorkspace"), { ssr: false });',
  'const fallbackCraftProfession = useMemo(() => resolveCraftProfession(view, sheet || {}), [view, sheet]);',
  'const effectiveCraftProfession = craftProfession || fallbackCraftProfession || "";',
  'const effectiveHasCraftCapability = !!hasCraftCapability || (!!effectiveCraftProfession && effectiveCraftProfession !== "Scribe");',
  'function renderStandaloneCraftPanel() {',
  'mode="panel"',
  'disciplineLock={effectiveCraftProfession}',
  'crafterId={npcId}',
  'crafter={view}',
  'startView="recipes"',
  'showDisciplineSwitcher={false}',
  'effectiveHasCraftCapability ? <button type="button" className={`btn ${activeView === "craft" ? "btn-primary" : "btn-outline-light"}`} onClick={() => setPanelView("craft")}>Craft</button> : null',
  'activeView === "craft" && effectiveHasCraftCapability',
  'typeof renderCraftView === "function" ? renderCraftView() : renderStandaloneCraftPanel()',
]) requireToken(token);

for (const token of [
  'activeView === "craft" && hasCraftCapability && typeof renderCraftView === "function"',
]) requireAbsent(token);

console.log("NpcPanel standalone craft capability validated.");

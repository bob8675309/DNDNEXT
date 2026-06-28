import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const target = path.join(process.cwd(), "components", "NpcPanel.js");
let source = fs.readFileSync(target, "utf8");

source = replaceOnce(
  source,
  'import { resolveCharacterPortrait } from "../utils/characterPortraits";',
  'import { resolveCharacterPortrait } from "../utils/characterPortraits";\nimport { resolveCraftProfession } from "../utils/craftProfession";',
  "NpcPanel craft profession import"
);

source = replaceOnce(
  source,
  '  const sheetMetaLine = [view.race, role, affiliation].filter(Boolean).join(" • ");',
  '  const sheetMetaLine = [view.race, role, affiliation].filter(Boolean).join(" • ");\n  const craftProfession = useMemo(() => resolveCraftProfession(view, sheet), [view, sheet]);\n  const canCraft = !!craftProfession && craftProfession !== "Scribe";',
  "NpcPanel craft profession memo"
);

source = replaceOnce(
  source,
  '             {subline ? <div className="npc-subline text-truncate">{subline}</div> : null}',
  '             {subline ? <div className="npc-subline text-truncate">{subline}</div> : null}\n             {canCraft ? <div className="npc-subline text-truncate">Crafting: {craftProfession}</div> : null}',
  "NpcPanel craft capability subline"
);

fs.writeFileSync(target, source, "utf8");

for (const token of ['resolveCraftProfession', 'craftProfession', 'canCraft', 'Crafting: {craftProfession}']) {
  if (!source.includes(token)) throw new Error(`NPC craft capability validation failed: ${token}`);
}
console.log("Patched NPC panel craft capability detection.");

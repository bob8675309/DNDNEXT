import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const forgePath = path.join(root, "components", "NewNpcModalV3Refined.js");
const validatorPath = path.join(root, "scripts", "validate_npc_page_panel_wrapper_adoption.mjs");
const docsPath = path.join(root, "docs", "CHARACTER_FORGE_VIEWPORT_PORTAL_FIX.md");

function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one source match, found ${count}`);
  return source.replace(from, to);
}

let forge = fs.readFileSync(forgePath, "utf8");
forge = replaceOnce(
  forge,
  '    <style jsx global>{`\n      .npc-forge-modal-v2 .npc-forge-body',
  '    <style jsx global>{`\n      .npc-forge-portal-root .npc-forge-backdrop{z-index:4900!important}\n      .npc-forge-modal-v2 .npc-forge-body',
  "player Forge portal stacking layer",
);
fs.writeFileSync(forgePath, forge);

let validator = fs.readFileSync(validatorPath, "utf8");
validator = replaceOnce(
  validator,
  'requireContains(forgeSource, \'createPortal(<div className="unified-player-character-forge npc-forge-portal-root">{forgeWindow}</div>, document.body)\', "player Forge body portal boundary");\n',
  'requireContains(forgeSource, \'createPortal(<div className="unified-player-character-forge npc-forge-portal-root">{forgeWindow}</div>, document.body)\', "player Forge body portal boundary");\nrequireContains(forgeSource, \' .npc-forge-portal-root .npc-forge-backdrop{z-index:4900!important}\'.trim(), "player Forge portal stack boundary");\n',
  "player Forge portal stack validator",
);
fs.writeFileSync(validatorPath, validator);

let docs = fs.readFileSync(docsPath, "utf8");
const note = `\n## Portal stacking boundary\n\nBecause the persistent profile backdrop remains mounted while Character Forge is open and uses a higher application-layer stack than the legacy Forge backdrop, the body-level player Forge portal explicitly raises its own backdrop to z-index 4900. This keeps the portaled Forge above the inert profile host while leaving the global navbar and unrelated page systems unchanged.\n`;
if (!docs.includes("## Portal stacking boundary")) docs += note;
fs.writeFileSync(docsPath, docs);

console.log("Player Forge portal stacking boundary materialized.");
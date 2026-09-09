import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const forgePath = path.join(root, "components", "NewNpcModalV3Refined.js");
const validatorPath = path.join(root, "scripts", "validate_npc_page_panel_wrapper_adoption.mjs");
const docsPath = path.join(root, "docs", "CHARACTER_FORGE_CLASS_HERO_ARTWORK_STATUS.md");

function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one source match, found ${count}`);
  return source.replace(from, to);
}

let forge = fs.readFileSync(forgePath, "utf8");
forge = replaceOnce(
  forge,
  'import { useEffect, useRef } from "react";\n',
  'import { useEffect, useRef } from "react";\nimport { createPortal } from "react-dom";\n',
  "React portal import",
);
forge = replaceOnce(
  forge,
  '  if (!show) return null;\n  return <NpcForgeControllerProvider controller={controller}><div className="npc-forge-backdrop" role="presentation"><div ref={modalRef} className={`npc-forge-modal npc-forge-modal-v2 ${playerMode ? "is-player-mode" : "is-npc-mode"}`} role="dialog" aria-modal="true">\n',
  '  if (!show) return null;\n  const forgeWindow = <NpcForgeControllerProvider controller={controller}><div className="npc-forge-backdrop" role="presentation"><div ref={modalRef} className={`npc-forge-modal npc-forge-modal-v2 ${playerMode ? "is-player-mode" : "is-npc-mode"}`} role="dialog" aria-modal="true">\n',
  "Forge window JSX assignment",
);
forge = replaceOnce(
  forge,
  '  </div></div></NpcForgeControllerProvider>;\n}\n',
  '  </div></div></NpcForgeControllerProvider>;\n\n  if (!playerMode || typeof document === "undefined") return forgeWindow;\n  return createPortal(<div className="unified-player-character-forge npc-forge-portal-root">{forgeWindow}</div>, document.body);\n}\n',
  "player Forge body portal return",
);
fs.writeFileSync(forgePath, forge);

let validator = fs.readFileSync(validatorPath, "utf8");
validator = replaceOnce(
  validator,
  'requireContains(forgeSource, \'className={`npc-forge-modal npc-forge-modal-v2\', "shared Forge modal shell");\nrequireContains(forgeSource, \'className="npc-forge-header"\', "shared Forge drag handle");\n',
  'requireContains(forgeSource, \'className={`npc-forge-modal npc-forge-modal-v2\', "shared Forge modal shell");\nrequireContains(forgeSource, \'className="npc-forge-header"\', "shared Forge drag handle");\nrequireContains(forgeSource, \'import { createPortal } from "react-dom";\', "player Forge viewport portal import");\nrequireContains(forgeSource, \'const forgeWindow = <NpcForgeControllerProvider\', "player Forge portal window assignment");\nrequireContains(forgeSource, \'createPortal(<div className="unified-player-character-forge npc-forge-portal-root">{forgeWindow}</div>, document.body)\', "player Forge body portal boundary");\nrequireContains(forgeSource, \'if (!playerMode || typeof document === "undefined") return forgeWindow;\', "NPC/SSR non-portal fallback");\n',
  "Forge portal validator tokens",
);
validator = replaceOnce(
  validator,
  'if (windowSource.includes(\'shell.classList.contains("is-player-character-forge")\')) {\n  throw new Error("Character Forge is still excluded from the shared desktop window controller.");\n}\n',
  'if (windowSource.includes(\'shell.classList.contains("is-player-character-forge")\')) {\n  throw new Error("Character Forge is still excluded from the shared desktop window controller.");\n}\n\nif (!forgeSource.includes("npc-forge-portal-root") || !forgeSource.includes("document.body")) {\n  throw new Error("Player Character Forge must escape the profile-shell containing block before desktop drag/resize geometry is applied.");\n}\n',
  "Forge containing-block guard",
);
fs.writeFileSync(validatorPath, validator);

let docs = fs.readFileSync(docsPath, "utf8");
const portalNote = `\n## 2026-09-08 viewport portal correction\n\nFollow-up video review showed the previous full-visibility clamp was mathematically correct but operating in the wrong coordinate space: the player Forge still lived inside the centered persistent profile host, so its fixed-position left/top values could be resolved against an offset containing block. The result was the exact failure shown in the recording — the Forge could jump hundreds of pixels right/down on first drag and still be moved partly or fully outside the visible browser area.\n\nThe player Forge now portals its window root to document.body while preserving the existing React providers and the unified-player-character-forge styling scope. NPC Forge keeps its existing non-portal path. This gives the shared drag/resize controller a true viewport coordinate system, so the existing viewport clamps and resize geometry finally operate against the same origin as getBoundingClientRect().\n\nThis correction does not change class rules, subclass persistence, creation authority, Supabase data, world/town maps, crafting, travel, encounter, inventory, or merchant behavior.\n`;
if (!docs.includes("## 2026-09-08 viewport portal correction")) docs += portalNote;
fs.writeFileSync(docsPath, docs);

console.log("Player Forge viewport portal fix materialized.");
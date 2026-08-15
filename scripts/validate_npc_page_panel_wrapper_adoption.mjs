import fs from "node:fs";
import path from "node:path";

const read = (...parts) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
const source = read("pages", "npcs.js");
const appSource = read("pages", "_app.js");
const dragSource = read("components", "ProfilePanelDragController.js");
const dragStyles = read("styles", "profile-panel-drag.css");
const playerProfileSource = read("components", "PlayerCharacterProfilePanelUnified.js");

function requireExact(token, label = token) {
  const count = source.split(token).length - 1;
  if (count !== 1) {
    throw new Error(`NPC page wrapper adoption validation failed for ${label}: expected 1, found ${count}`);
  }
}

function requireContains(haystack, token, label = token) {
  if (!haystack.includes(token)) {
    throw new Error(`NPC page wrapper adoption validation failed for ${label}: missing ${token}`);
  }
}

requireExact('import NpcPanel from "../components/character/CharacterInteractionPanel";', "wrapper import");
requireExact('{profilePanelOpen && selected ? (', "profile panel overlay gate");
requireExact('<div className="npc-page-profile-panel-shell">', "profile panel shell");
requireExact('<NpcPanel', "single panel JSX use");
requireExact('initialView={profilePanelInitialView}', "profile panel initial view prop");
requireExact('onClose={() => setProfilePanelOpen(false)}', "profile panel close prop");

const forbidden = [
  'import NpcPanel from "../components/NpcPanel";',
  'useCharacterInteractionShell={true}',
  'CraftingWorkspace',
];

for (const token of forbidden) {
  if (source.includes(token)) {
    throw new Error(`NPC page wrapper adoption contains forbidden token: ${token}`);
  }
}

requireContains(appSource, 'import ProfilePanelDragController from "../components/ProfilePanelDragController";', "global drag-controller import");
requireContains(appSource, '<ProfilePanelDragController />', "global drag-controller mount");
requireContains(appSource, 'import "../styles/profile-panel-drag.css";', "profile drag stylesheet import");

for (const token of [
  'const PANEL_SELECTOR = ".npc-page-profile-panel-shell";',
  'const HANDLE_SELECTOR = ".npc-panel-header, .player-character-forge-toolbar";',
  "INTERACTIVE_SELECTOR",
  "DESKTOP_MIN_WIDTH = 981",
  "MIN_VISIBLE_X = 180",
  "MIN_VISIBLE_HEADER = 48",
  'shell.classList.contains("is-player-character-forge")',
  'document.addEventListener("pointerdown", onPointerDown, true)',
  'document.addEventListener("pointermove", onPointerMove, true)',
  'document.addEventListener("pointerup", onPointerEnd, true)',
  'document.addEventListener("pointercancel", onPointerEnd, true)',
  "shell.setPointerCapture?.(event.pointerId)",
  "shell.releasePointerCapture?.(activePointerId)",
  'writeOffset(shell, { x: 0, y: 0 })',
]) requireContains(dragSource, token, `drag controller token ${token}`);

for (const token of [
  ".npc-page-profile-panel-shell",
  "left: var(--profile-panel-drag-x, 0px)",
  "top: var(--profile-panel-drag-y, 0px)",
  ".npc-page-profile-panel-shell:not(.is-player-character-forge) .npc-panel-header",
  ".npc-page-profile-panel-shell.is-player-character-forge",
  "cursor: grab",
  "cursor: grabbing",
  "@media (max-width: 980px)",
]) requireContains(dragStyles, token, `drag style token ${token}`);

requireContains(playerProfileSource, "npc-page-profile-panel-shell", "player profile shared shell");
requireContains(playerProfileSource, "is-player-character-forge", "player Forge drag opt-out class");

const protectedBoundaryText = [dragSource, dragStyles].join("\n");
for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "town-map", "world-map", "TownSheet"]) {
  if (protectedBoundaryText.includes(token)) {
    throw new Error(`Profile panel drag patch crossed a protected map boundary: ${token}`);
  }
}

console.log("NPC/player profile panel wrapper adoption and draggable-shell behavior validated.");

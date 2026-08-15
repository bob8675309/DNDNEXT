import fs from "node:fs";
import path from "node:path";

const read = (...parts) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
const source = read("pages", "npcs.js");
const appSource = read("pages", "_app.js");
const windowSource = read("components", "ProfilePanelDragController.js");
const windowStyles = read("styles", "profile-panel-drag.css");
const playerProfileSource = read("components", "PlayerCharacterProfilePanelUnified.js");
const accountSource = read("components", "PlayerAccountPanel.js");
const interactionSource = read("components", "character", "CharacterInteractionPanel.js");
const navbarSource = read("components", "AppNavbar.js");
const profilePageSource = read("pages", "profile.js");
const accountStyles = read("styles", "player-account-panel.css");
const portraitBleedStyles = read("styles", "profile-portrait-bleed-overrides.css");
const forgeSource = read("components", "NewNpcModalV3Refined.js");
const portraitPickerSource = read("components", "PortraitPickerModal.js");
const spritePickerSource = read("components", "SpritePickerModal.js");

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

requireContains(appSource, 'import ProfilePanelDragController from "../components/ProfilePanelDragController";', "global window-controller import");
requireContains(appSource, '<ProfilePanelDragController />', "global window-controller mount");
requireContains(appSource, 'import "../styles/profile-panel-drag.css";', "desktop window stylesheet import");
requireContains(appSource, 'import "../styles/player-account-panel.css";', "player Account stylesheet import");

for (const token of [
  '".npc-page-profile-panel-shell:not(.is-player-character-forge)"',
  '".npc-forge-modal"',
  '".portrait-picker-modal"',
  '".sprite-picker-modal"',
  '"[data-app-window-panel=\'true\']"',
  '".npc-panel-header"',
  '".npc-forge-header"',
  '".portrait-picker-head"',
  '".sprite-picker-head"',
  "INTERACTIVE_SELECTOR",
  "DESKTOP_MIN_WIDTH = 981",
  "CORNER_HIT_SIZE = 16",
  "MIN_VISIBLE_X = 180",
  "MIN_VISIBLE_HEADER = 48",
  "function promoteToDesktopWindow(shell)",
  "function resizeGeometry(shell, direction, startRect, dx, dy)",
  "function resetDesktopWindow(shell)",
  "function resetForgeHostWindow(target = null)",
  'interaction.type === "resize"',
  'type: "drag"',
  'document.addEventListener("pointerdown", onPointerDown, true)',
  'document.addEventListener("pointermove", onPointerMove, true)',
  'document.addEventListener("pointerup", onPointerEnd, true)',
  'document.addEventListener("pointercancel", onPointerEnd, true)',
  "shell.setPointerCapture?.(event.pointerId)",
  "shell.releasePointerCapture?.(activePointerId)",
  'document.querySelectorAll(".npc-page-profile-panel-shell.is-player-character-forge.is-app-windowed").forEach(resetDesktopWindow)',
  "document.querySelectorAll(PANEL_SELECTOR).forEach(resetDesktopWindow)",
]) requireContains(windowSource, token, `desktop window controller token ${token}`);

for (const token of [
  ".is-app-windowed",
  "position: fixed !important",
  ".npc-page-profile-panel-shell.is-player-character-forge",
  ".npc-page-profile-panel-shell.is-player-character-forge > .persistent-player-character-forge",
  ".npc-page-profile-panel-shell:not(.is-player-character-forge) .npc-panel-header",
  ".npc-forge-modal.is-app-windowed",
  "container-name: forge-window",
  "@container forge-window (max-width: 980px)",
  "grid-template-columns: minmax(0, 1fr) !important",
  ".npc-forge-modal > .npc-forge-header",
  ".portrait-picker-modal > .portrait-picker-head",
  ".sprite-picker-modal > .sprite-picker-head",
  "cursor: grab",
  "cursor: grabbing",
  "nwse-resize",
  "nesw-resize",
  "@media (max-width: 980px)",
]) requireContains(windowStyles, token, `desktop window style token ${token}`);

requireContains(playerProfileSource, "npc-page-profile-panel-shell", "player profile shared shell");
requireContains(playerProfileSource, "is-player-character-forge", "player Forge shared-shell mode class");
requireContains(playerProfileSource, 'import("./PlayerAccountPanel")', "Account panel lazy import");
requireContains(playerProfileSource, 'className="player-character-forge-toolbar__actions"', "profile toolbar right actions");
requireContains(playerProfileSource, 'aria-label="Close profile panel"', "top profile close button");
requireContains(playerProfileSource, "accountContent={accountContent}", "Account view content routing");

for (const token of [
  'from("players")',
  'from("user_profiles")',
  'supabase.auth.updateUser({ data: { character_name: cleanName } })',
  'supabase.auth.updateUser({ password: newPassword })',
  "MIN_PASSWORD_LENGTH = 8",
  "Player profile",
  "Change password",
]) requireContains(accountSource, token, `Account authority ${token}`);

for (const token of [
  '"account"',
  'case "account": return "Account";',
  "hasAccountCapability = false",
  'if (view === "account") return !!hasAccountCapability;',
  'interactionView === "account" && hasAccountCapability',
  "CharacterAccountShell",
]) requireContains(interactionSource, token, `Account interaction routing ${token}`);

for (const token of [
  'import { useRouter } from "next/router";',
  "function openProfilePanel()",
  'characterProfile: "1"',
  'pathname: router.pathname',
  '{ shallow: true, scroll: false }',
  'onClick={openProfilePanel}>Profile</button>',
]) requireContains(navbarSource, token, `global Profile nav behavior ${token}`);

for (const token of [
  "openedRef",
  'router.replace("/login?next=/profile")',
  'characterProfile: "1"',
  'className="profile-panel-host-page"',
]) requireContains(profilePageSource, token, `blank Profile host ${token}`);
if (profilePageSource.includes("Change password") || profilePageSource.includes("Save profile")) {
  throw new Error("Standalone /profile account cards still render behind the global Profile Panel.");
}

for (const token of [
  ".player-character-forge-toolbar__actions",
  ".player-character-forge-toolbar__close",
  '.persistent-player-character-profile .npc-panel-header button[aria-label="Close"]',
  ".profile-panel-host-page",
  ".player-account-panel__grid",
]) requireContains(accountStyles, token, `Account/profile toolbar style ${token}`);

for (const token of [
  ".persistent-player-character-profile .npc-profile-description-thumb",
  ".persistent-player-character-profile .npc-profile-description-thumb::after",
  "rgba(5,5,12,0.62) 64%",
  ".merchant-market-shell .merchant-scene",
  ".merchant-market-shell .merchant-scene::after",
  ".merchant-market-shell .merchant-stock-workspace",
]) requireContains(portraitBleedStyles, token, `portrait bleed style ${token}`);
if (portraitBleedStyles.includes(".merchant-panel-body") || portraitBleedStyles.includes(".merchant-grid")) {
  throw new Error("Merchant portrait bleed regressed to obsolete MerchantPanel selectors.");
}

requireContains(forgeSource, 'className={`npc-forge-modal npc-forge-modal-v2', "shared Forge modal shell");
requireContains(forgeSource, 'className="npc-forge-header"', "shared Forge drag handle");
requireContains(portraitPickerSource, 'className="portrait-picker-modal"', "portrait picker window shell");
requireContains(portraitPickerSource, 'className="portrait-picker-head"', "portrait picker drag handle");
requireContains(spritePickerSource, 'className="sprite-picker-modal"', "sprite picker window shell");
requireContains(spritePickerSource, "sprite-picker-head", "sprite picker drag handle");

if (windowSource.includes('shell.classList.contains("is-player-character-forge")')) {
  throw new Error("Character Forge is still excluded from the shared desktop window controller.");
}

if (windowSource.includes('".npc-page-profile-panel-shell",\n  ".npc-forge-modal"')) {
  throw new Error("Character Forge host shell is still independently draggable/resizable around the Forge modal.");
}

const protectedBoundaryText = [windowSource, windowStyles, accountSource, accountStyles, portraitBleedStyles].join("\n");
for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "town-map", "world-map", "TownSheet"]) {
  if (protectedBoundaryText.includes(token)) {
    throw new Error(`Profile consolidation crossed a protected map boundary: ${token}`);
  }
}

console.log("NPC/player profile windows, global Profile navigation, Account tab, portrait fades, MerchantPanel fade, Forge host isolation, and protected boundaries validated.");

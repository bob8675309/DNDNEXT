import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
}

function replaceOnce(path, before, after, label) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one source match in ${path}, found ${count}`);
  }
  write(path, source.replace(before, after));
}

function appendOnce(path, marker, addition, label) {
  const source = read(path);
  if (source.includes(marker)) return;
  write(path, `${source.trimEnd()}\n\n${addition.trim()}\n`);
  if (!read(path).includes(marker)) throw new Error(`${label}: append marker did not materialize`);
}

replaceOnce(
  "components/ProfilePanelDragController.js",
  `const CORNER_HIT_SIZE = 16;\nconst MIN_VISIBLE_X = 180;\nconst MIN_VISIBLE_HEADER = 48;\nconst RESIZE_DIRECTIONS = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];`,
  `const CORNER_HIT_SIZE = 16;\nconst RESIZE_DIRECTIONS = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];`,
  "remove permissive off-screen visibility constants",
);

replaceOnce(
  "components/ProfilePanelDragController.js",
  `function dragPosition(shell, startRect, dx, dy) {\n  const minLeft = MIN_VISIBLE_X - startRect.width;\n  const maxLeft = window.innerWidth - MIN_VISIBLE_X;\n  const minTop = EDGE_GAP;\n  const maxTop = Math.max(minTop, window.innerHeight - MIN_VISIBLE_HEADER);\n  setImportantPx(shell, "left", clamp(startRect.left + dx, minLeft, maxLeft));\n  setImportantPx(shell, "top", clamp(startRect.top + dy, minTop, maxTop));\n}`,
  `function fullyVisiblePositionBounds(width, height) {\n  const resolvedWidth = Math.min(Math.max(0, Number(width || 0)), Math.max(0, window.innerWidth - EDGE_GAP * 2));\n  const resolvedHeight = Math.min(Math.max(0, Number(height || 0)), Math.max(0, window.innerHeight - EDGE_GAP * 2));\n  return {\n    minLeft: EDGE_GAP,\n    maxLeft: Math.max(EDGE_GAP, window.innerWidth - resolvedWidth - EDGE_GAP),\n    minTop: EDGE_GAP,\n    maxTop: Math.max(EDGE_GAP, window.innerHeight - resolvedHeight - EDGE_GAP),\n  };\n}\n\nfunction dragPosition(shell, startRect, dx, dy) {\n  const bounds = fullyVisiblePositionBounds(startRect.width, startRect.height);\n  setImportantPx(shell, "left", clamp(startRect.left + dx, bounds.minLeft, bounds.maxLeft));\n  setImportantPx(shell, "top", clamp(startRect.top + dy, bounds.minTop, bounds.maxTop));\n}`,
  "keep dragged app windows fully visible",
);

replaceOnce(
  "components/ProfilePanelDragController.js",
  `  const left = clamp(numericPx(shell.style.left, rect.left), MIN_VISIBLE_X - width, window.innerWidth - MIN_VISIBLE_X);\n  const top = clamp(numericPx(shell.style.top, rect.top), EDGE_GAP, Math.max(EDGE_GAP, window.innerHeight - MIN_VISIBLE_HEADER));`,
  `  const bounds = fullyVisiblePositionBounds(width, height);\n  const left = clamp(numericPx(shell.style.left, rect.left), bounds.minLeft, bounds.maxLeft);\n  const top = clamp(numericPx(shell.style.top, rect.top), bounds.minTop, bounds.maxTop);`,
  "reclamp resized windows to full viewport visibility",
);

replaceOnce(
  "components/ProfilePanelDragController.js",
  `      const { shell, pointerId: activePointerId } = interaction;\n      shell.classList.remove("is-app-window-dragging", "is-app-window-resizing");`,
  `      const { shell, pointerId: activePointerId } = interaction;\n      reclampWindow(shell);\n      shell.classList.remove("is-app-window-dragging", "is-app-window-resizing");`,
  "reclamp at interaction completion",
);

replaceOnce(
  "styles/character-forge-class-final-corners.css",
  `  .unified-player-character-forge .npc-forge-modal-v2.is-player-mode:has(.npc-forge-body.npc-forge-step-class .npc-forge-class-guide.is-class-fighter .npc-forge-class-guide__overview-book) {\n    --npc-forge-class-cinematic-art: url("/media/classes/cinematic-fighter.webp");\n  }`,
  `  .unified-player-character-forge .npc-forge-modal-v2.is-player-mode:has(.npc-forge-body.npc-forge-step-class .npc-forge-class-guide.is-class-fighter .npc-forge-class-guide__overview-book) {\n    --npc-forge-class-cinematic-art: url("/media/classes/cinematic-fighter.webp");\n    --npc-forge-class-art-position: 70% 6%;\n  }`,
  "protect Fighter upper-body framing",
);

replaceOnce(
  "styles/character-forge-class-final-corners.css",
  `  .unified-player-character-forge .npc-forge-modal-v2.is-player-mode:has(.npc-forge-body.npc-forge-step-class .npc-forge-class-guide.is-class-wizard .npc-forge-class-guide__overview-book) {\n    --npc-forge-class-cinematic-art: url("/media/classes/cinematic-wizard.webp");\n  }`,
  `  .unified-player-character-forge .npc-forge-modal-v2.is-player-mode:has(.npc-forge-body.npc-forge-step-class .npc-forge-class-guide.is-class-wizard .npc-forge-class-guide__overview-book) {\n    --npc-forge-class-cinematic-art: url("/media/classes/cinematic-wizard.webp");\n    --npc-forge-class-art-position: 68% 10%;\n  }`,
  "protect Wizard upper-body framing",
);

replaceOnce(
  "styles/character-forge-class-final-corners.css",
  `    background:\n      linear-gradient(90deg, rgba(4, 7, 14, .42) 0%, rgba(4, 7, 14, .22) 24%, rgba(4, 7, 14, .08) 38%, rgba(4, 7, 14, .02) 48%, rgba(4, 7, 14, 0) 58%),\n      linear-gradient(0deg, rgba(4, 7, 13, .12) 0%, rgba(4, 7, 13, 0) 20%),\n      var(--npc-forge-class-cinematic-art) center center / cover no-repeat;`,
  `    background:\n      linear-gradient(90deg, rgba(3, 5, 12, .80) 0%, rgba(3, 5, 12, .72) 22%, rgba(3, 5, 12, .58) 38%, rgba(3, 5, 12, .40) 52%, rgba(3, 5, 12, .24) 63%, rgba(3, 5, 12, .10) 72%, rgba(3, 5, 12, 0) 80%),\n      linear-gradient(0deg, rgba(3, 5, 11, .20) 0%, rgba(3, 5, 11, 0) 24%),\n      var(--npc-forge-class-cinematic-art) var(--npc-forge-class-art-position, center center) / cover no-repeat;`,
  "darken the left cinematic reading zone without blur",
);

replaceOnce(
  "styles/character-forge-class-final-corners.css",
  `  .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class:has(.npc-forge-class-guide__overview-book .npc-forge-class-guide__hero-art img[src*="/media/classes/cinematic-"]) .npc-forge-class-guide {\n    box-shadow: none !important;\n  }\n}`,
  `  .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class:has(.npc-forge-class-guide__overview-book .npc-forge-class-guide__hero-art img[src*="/media/classes/cinematic-"]) .npc-forge-class-guide {\n    box-shadow: none !important;\n  }\n\n  .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class:has(.npc-forge-class-guide__overview-book .npc-forge-class-guide__hero-art img[src*="/media/classes/cinematic-"]) .npc-forge-class-guide__hero-kicker,\n  .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class:has(.npc-forge-class-guide__overview-book .npc-forge-class-guide__hero-art img[src*="/media/classes/cinematic-"]) .npc-forge-class-guide__hero-copy > h2,\n  .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class:has(.npc-forge-class-guide__overview-book .npc-forge-class-guide__hero-art img[src*="/media/classes/cinematic-"]) .npc-forge-class-guide__hero-tagline {\n    text-shadow: 0 1px 3px rgba(0, 0, 0, .92), 0 0 14px rgba(0, 0, 0, .46);\n  }\n}`,
  "add subtle text contrast without blurring artwork",
);

replaceOnce(
  "scripts/validate_npc_page_panel_wrapper_adoption.mjs",
  `  "CORNER_HIT_SIZE = 16",\n  "MIN_VISIBLE_X = 180",\n  "MIN_VISIBLE_HEADER = 48",\n  "function promoteToDesktopWindow(shell)",`,
  `  "CORNER_HIT_SIZE = 16",\n  "function fullyVisiblePositionBounds(width, height)",\n  "window.innerWidth - resolvedWidth - EDGE_GAP",\n  "window.innerHeight - resolvedHeight - EDGE_GAP",\n  "reclampWindow(shell);",\n  "function promoteToDesktopWindow(shell)",`,
  "guard full viewport visibility contract",
);

replaceOnce(
  "scripts/validate_npc_page_panel_wrapper_adoption.mjs",
  `if (windowSource.includes('shell.classList.contains("is-player-character-forge")')) {\n  throw new Error("Character Forge is still excluded from the shared desktop window controller.");\n}\n`,
  `if (windowSource.includes('shell.classList.contains("is-player-character-forge")')) {\n  throw new Error("Character Forge is still excluded from the shared desktop window controller.");\n}\n\nif (windowSource.includes("MIN_VISIBLE_X") || windowSource.includes("MIN_VISIBLE_HEADER")) {\n  throw new Error("Desktop app windows can still be dragged almost completely off-screen.");\n}\n`,
  "forbid permissive off-screen drag bounds",
);

replaceOnce(
  "scripts/validate_class_hero_framing.mjs",
  `  "var(--npc-forge-class-cinematic-art) center center / cover no-repeat",`,
  `  "var(--npc-forge-class-cinematic-art) var(--npc-forge-class-art-position, center center) / cover no-repeat",\n  "--npc-forge-class-art-position: 70% 6%",\n  "--npc-forge-class-art-position: 68% 10%",\n  "text-shadow: 0 1px 3px rgba(0, 0, 0, .92), 0 0 14px rgba(0, 0, 0, .46)",`,
  "guard focal position and text contrast",
);

replaceOnce(
  "scripts/validate_class_hero_framing.mjs",
  `assert(finalCorners.includes("rgba(4, 7, 14, .02) 48%") && finalCorners.includes("rgba(4, 7, 14, 0) 58%"), "Final Class cinematic fade must clear early enough to preserve crisp center/environment art.");`,
  `assert(finalCorners.includes("rgba(3, 5, 12, .80) 0%") && finalCorners.includes("rgba(3, 5, 12, .10) 72%") && finalCorners.includes("rgba(3, 5, 12, 0) 80%"), "Final Class cinematic fade must keep the left reading zone dark while clearing before the right-side subject.");`,
  "guard stronger transparent readability fade",
);

replaceOnce(
  "scripts/validate_class_hero_framing.mjs",
  `console.log("Class hero framing validation passed: one crisp modal-owned cinematic image reaches the Forge border with an early transparent text fade, Wizard subclass art fills its native wide slot, nested duplicate/blur layers stay suppressed, and protected boundaries are untouched.");`,
  `console.log("Class hero framing validation passed: one crisp modal-owned cinematic image reaches the Forge border with a dark transparent left reading fade, resize-safe focal framing, Wizard subclass art filling its native wide slot, nested duplicate/blur layers suppressed, and protected boundaries untouched.");`,
  "refresh Class hero validation summary",
);

appendOnce(
  "docs/CHARACTER_FORGE_CLASS_HERO_ARTWORK_STATUS.md",
  "## 2026-09-08 resize/readability correction",
  `## 2026-09-08 resize/readability correction\n\nBrowser review after the clean Wizard replacement established two additional presentation requirements:\n\n- The modal-owned cinematic remains one sharp image, but the left reading zone now carries a stronger transparent black/navy scrim. It darkens the Class title/tagline area without blur or a second cropped image, then clears before the right-side hero subject.\n- Fighter and Wizard provide explicit cinematic focal positions so resizing favors the character's head and upper body instead of center-cropping the face out of the frame.\n- The shared desktop window controller no longer allows a resized Forge to be dragged almost completely outside the viewport. Drag and post-interaction reclamping now keep the full window inside the usable viewport bounds.\n- Double-click/double-tap header reset remains available, but it is recovery convenience rather than the only way to rescue a lost Forge window.\n\nThis correction is presentation/window-management only: no Class rules, subclass authority, Supabase schema/data, world-map, town/city-map, crafting, travel, encounter, or inventory behavior changed.`,
  "document Class resize/readability correction",
);

console.log("Applied bounded Character Forge resize/readability correction.");

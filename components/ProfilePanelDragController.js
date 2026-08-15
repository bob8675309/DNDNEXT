import { useEffect } from "react";

const PANEL_SELECTOR = [
  ".npc-page-profile-panel-shell:not(.is-player-character-forge)",
  ".npc-forge-modal",
  ".portrait-picker-modal",
  ".sprite-picker-modal",
  "[data-app-window-panel='true']",
].join(",");

const HANDLE_SELECTOR = [
  ".npc-panel-header",
  ".player-character-forge-toolbar",
  ".npc-forge-header",
  ".portrait-picker-head",
  ".sprite-picker-head",
  "[data-app-window-handle='true']",
].join(",");

const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "option",
  "label",
  "summary",
  "[role='button']",
  "[contenteditable='true']",
  "[contenteditable='']",
  "[data-profile-panel-no-drag]",
  "[data-app-window-no-drag]",
].join(",");

const DESKTOP_MIN_WIDTH = 981;
const EDGE_GAP = 8;
const CORNER_HIT_SIZE = 16;
const MIN_VISIBLE_X = 180;
const MIN_VISIBLE_HEADER = 48;
const RESIZE_DIRECTIONS = ["nw", "ne", "sw", "se"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numericPx(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function setImportantPx(shell, property, value) {
  if (!shell) return;
  shell.style.setProperty(property, `${Number(value || 0)}px`, "important");
}

function panelMinimums(shell) {
  if (shell?.matches?.(".npc-forge-modal")) return { width: 760, height: 460 };
  if (shell?.matches?.(".npc-page-profile-panel-shell")) return { width: 680, height: 430 };
  if (shell?.matches?.(".portrait-picker-modal, .sprite-picker-modal")) return { width: 520, height: 380 };
  return { width: 480, height: 340 };
}

function isEligibleShell(shell) {
  return shell instanceof HTMLElement;
}

function shellForTarget(target) {
  const shell = target?.closest?.(PANEL_SELECTOR) || null;
  return isEligibleShell(shell) ? shell : null;
}

function handleForShell(target, shell) {
  const handle = target?.closest?.(HANDLE_SELECTOR) || null;
  if (!handle || !shell?.contains(handle)) return null;
  return handle.closest(PANEL_SELECTOR) === shell ? handle : null;
}

function clearLegacyDragState(shell) {
  if (!shell) return;
  delete shell.dataset.profileDragX;
  delete shell.dataset.profileDragY;
  shell.style.removeProperty("--profile-panel-drag-x");
  shell.style.removeProperty("--profile-panel-drag-y");
}

function promoteToDesktopWindow(shell) {
  if (!isEligibleShell(shell) || window.innerWidth < DESKTOP_MIN_WIDTH) return null;
  if (shell.classList.contains("is-app-windowed")) return shell.getBoundingClientRect();

  const rect = shell.getBoundingClientRect();
  clearLegacyDragState(shell);
  shell.classList.add("is-app-windowed");
  shell.dataset.appWindowed = "true";
  setImportantPx(shell, "left", rect.left);
  setImportantPx(shell, "top", rect.top);
  setImportantPx(shell, "width", rect.width);
  setImportantPx(shell, "height", rect.height);
  shell.style.setProperty("max-width", "none", "important");
  shell.style.setProperty("max-height", "none", "important");
  shell.style.setProperty("right", "auto", "important");
  shell.style.setProperty("bottom", "auto", "important");
  shell.style.setProperty("transform", "none", "important");
  return shell.getBoundingClientRect();
}

function resetDesktopWindow(shell) {
  if (!isEligibleShell(shell)) return;
  clearLegacyDragState(shell);
  shell.classList.remove("is-app-windowed", "is-app-window-dragging", "is-app-window-resizing");
  delete shell.dataset.appWindowed;
  for (const property of ["left", "top", "width", "height", "max-width", "max-height", "right", "bottom", "transform"]) {
    shell.style.removeProperty(property);
  }
}

function resetForgeHostWindow(target = null) {
  const host = target?.closest?.(".npc-page-profile-panel-shell.is-player-character-forge") || null;
  if (host?.classList?.contains("is-app-windowed")) resetDesktopWindow(host);
}

function cornerDirection(shell, clientX, clientY, target = null) {
  if (!isEligibleShell(shell) || window.innerWidth < DESKTOP_MIN_WIDTH) return "";
  if (target?.closest?.(INTERACTIVE_SELECTOR)) return "";

  const rect = shell.getBoundingClientRect();
  const withinX = clientX >= rect.left - 1 && clientX <= rect.right + 1;
  const withinY = clientY >= rect.top - 1 && clientY <= rect.bottom + 1;
  if (!withinX || !withinY) return "";

  const left = clientX - rect.left <= CORNER_HIT_SIZE;
  const right = rect.right - clientX <= CORNER_HIT_SIZE;
  const top = clientY - rect.top <= CORNER_HIT_SIZE;
  const bottom = rect.bottom - clientY <= CORNER_HIT_SIZE;

  if (left && top) return "nw";
  if (right && top) return "ne";
  if (left && bottom) return "sw";
  if (right && bottom) return "se";
  return "";
}

function setResizeHover(direction = "") {
  for (const value of RESIZE_DIRECTIONS) document.body?.classList.remove(`is-app-window-resize-hover-${value}`);
  if (direction) document.body?.classList.add(`is-app-window-resize-hover-${direction}`);
}

function clearInteractionClasses() {
  document.body?.classList.remove("is-app-window-drag-active", "is-app-window-resize-active");
  setResizeHover("");
}

function dragPosition(shell, startRect, dx, dy) {
  const minLeft = MIN_VISIBLE_X - startRect.width;
  const maxLeft = window.innerWidth - MIN_VISIBLE_X;
  const minTop = EDGE_GAP;
  const maxTop = Math.max(minTop, window.innerHeight - MIN_VISIBLE_HEADER);
  setImportantPx(shell, "left", clamp(startRect.left + dx, minLeft, maxLeft));
  setImportantPx(shell, "top", clamp(startRect.top + dy, minTop, maxTop));
}

function resizeGeometry(shell, direction, startRect, dx, dy) {
  const minimums = panelMinimums(shell);
  const minWidth = Math.min(minimums.width, Math.max(320, window.innerWidth - EDGE_GAP * 2));
  const minHeight = Math.min(minimums.height, Math.max(260, window.innerHeight - EDGE_GAP * 2));
  const maxViewportWidth = Math.max(minWidth, window.innerWidth - EDGE_GAP * 2);
  const maxViewportHeight = Math.max(minHeight, window.innerHeight - EDGE_GAP * 2);

  let left = startRect.left;
  let top = startRect.top;
  let width = startRect.width;
  let height = startRect.height;

  if (direction.includes("e")) {
    const maxWidth = Math.max(minWidth, window.innerWidth - EDGE_GAP - startRect.left);
    width = clamp(startRect.width + dx, minWidth, Math.min(maxViewportWidth, maxWidth));
  }

  if (direction.includes("w")) {
    const right = startRect.right;
    const maxWidth = Math.max(minWidth, right - EDGE_GAP);
    width = clamp(startRect.width - dx, minWidth, Math.min(maxViewportWidth, maxWidth));
    left = right - width;
  }

  if (direction.includes("s")) {
    const maxHeight = Math.max(minHeight, window.innerHeight - EDGE_GAP - startRect.top);
    height = clamp(startRect.height + dy, minHeight, Math.min(maxViewportHeight, maxHeight));
  }

  if (direction.includes("n")) {
    const bottom = startRect.bottom;
    const maxHeight = Math.max(minHeight, bottom - EDGE_GAP);
    height = clamp(startRect.height - dy, minHeight, Math.min(maxViewportHeight, maxHeight));
    top = bottom - height;
  }

  setImportantPx(shell, "left", left);
  setImportantPx(shell, "top", top);
  setImportantPx(shell, "width", width);
  setImportantPx(shell, "height", height);
}

function reclampWindow(shell) {
  if (!isEligibleShell(shell) || !shell.classList.contains("is-app-windowed")) return;
  const rect = shell.getBoundingClientRect();
  const minimums = panelMinimums(shell);
  const maxWidth = Math.max(320, window.innerWidth - EDGE_GAP * 2);
  const maxHeight = Math.max(260, window.innerHeight - EDGE_GAP * 2);
  const width = clamp(rect.width, Math.min(minimums.width, maxWidth), maxWidth);
  const height = clamp(rect.height, Math.min(minimums.height, maxHeight), maxHeight);
  const left = clamp(numericPx(shell.style.left, rect.left), MIN_VISIBLE_X - width, window.innerWidth - MIN_VISIBLE_X);
  const top = clamp(numericPx(shell.style.top, rect.top), EDGE_GAP, Math.max(EDGE_GAP, window.innerHeight - MIN_VISIBLE_HEADER));

  setImportantPx(shell, "width", width);
  setImportantPx(shell, "height", height);
  setImportantPx(shell, "left", left);
  setImportantPx(shell, "top", top);
}

export default function ProfilePanelDragController() {
  useEffect(() => {
    let interaction = null;

    function finishInteraction(pointerId = null) {
      if (!interaction) {
        clearInteractionClasses();
        return;
      }
      if (pointerId != null && pointerId !== interaction.pointerId) return;

      const { shell, pointerId: activePointerId } = interaction;
      shell.classList.remove("is-app-window-dragging", "is-app-window-resizing");
      try {
        shell.releasePointerCapture?.(activePointerId);
      } catch {}
      interaction = null;
      clearInteractionClasses();
    }

    function onPointerDown(event) {
      if (window.innerWidth < DESKTOP_MIN_WIDTH || event.button !== 0 || event.isPrimary === false) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      resetForgeHostWindow(target);
      const shell = shellForTarget(target);
      if (!shell) return;

      const direction = cornerDirection(shell, event.clientX, event.clientY, target);
      if (direction) {
        const rect = promoteToDesktopWindow(shell);
        if (!rect) return;
        interaction = {
          type: "resize",
          shell,
          direction,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startRect: shell.getBoundingClientRect(),
        };
        shell.classList.add("is-app-window-resizing");
        document.body?.classList.add("is-app-window-resize-active");
        setResizeHover(direction);
      } else {
        const handle = handleForShell(target, shell);
        if (!handle || target.closest(INTERACTIVE_SELECTOR)) return;
        promoteToDesktopWindow(shell);
        interaction = {
          type: "drag",
          shell,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startRect: shell.getBoundingClientRect(),
        };
        shell.classList.add("is-app-window-dragging");
        document.body?.classList.add("is-app-window-drag-active");
      }

      try {
        shell.setPointerCapture?.(event.pointerId);
      } catch {}
      event.preventDefault();
      event.stopPropagation();
    }

    function onPointerMove(event) {
      if (interaction && event.pointerId === interaction.pointerId) {
        const dx = event.clientX - interaction.startX;
        const dy = event.clientY - interaction.startY;
        if (interaction.type === "resize") resizeGeometry(interaction.shell, interaction.direction, interaction.startRect, dx, dy);
        else dragPosition(interaction.shell, interaction.startRect, dx, dy);
        event.preventDefault();
        return;
      }

      if (window.innerWidth < DESKTOP_MIN_WIDTH) {
        setResizeHover("");
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      resetForgeHostWindow(target);
      const shell = target ? shellForTarget(target) : null;
      setResizeHover(shell ? cornerDirection(shell, event.clientX, event.clientY, target) : "");
    }

    function onPointerEnd(event) {
      finishInteraction(event.pointerId);
    }

    function onWindowBlur() {
      finishInteraction();
    }

    function onResize() {
      document.querySelectorAll(".npc-page-profile-panel-shell.is-player-character-forge.is-app-windowed").forEach(resetDesktopWindow);
      if (window.innerWidth < DESKTOP_MIN_WIDTH) {
        document.querySelectorAll(PANEL_SELECTOR).forEach(resetDesktopWindow);
        finishInteraction();
        return;
      }
      document.querySelectorAll(PANEL_SELECTOR).forEach(reclampWindow);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerEnd, true);
    document.addEventListener("pointercancel", onPointerEnd, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      finishInteraction();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerEnd, true);
      document.removeEventListener("pointercancel", onPointerEnd, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, []);

  return null;
}

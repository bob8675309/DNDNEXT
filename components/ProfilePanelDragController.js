import { useEffect } from "react";

const PANEL_SELECTOR = ".npc-page-profile-panel-shell";
const HANDLE_SELECTOR = ".npc-panel-header, .player-character-forge-toolbar";
const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "option",
  "label",
  "[role='button']",
  "[contenteditable='true']",
  "[contenteditable='']",
  "[data-profile-panel-no-drag]",
].join(",");

const DESKTOP_MIN_WIDTH = 981;
const EDGE_GAP = 8;
const MIN_VISIBLE_X = 180;
const MIN_VISIBLE_HEADER = 48;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readOffset(shell) {
  return {
    x: Number(shell?.dataset?.profileDragX || 0) || 0,
    y: Number(shell?.dataset?.profileDragY || 0) || 0,
  };
}

function writeOffset(shell, next = { x: 0, y: 0 }) {
  if (!shell) return;
  const x = Number(next.x || 0) || 0;
  const y = Number(next.y || 0) || 0;
  shell.dataset.profileDragX = String(x);
  shell.dataset.profileDragY = String(y);
  shell.style.setProperty("--profile-panel-drag-x", `${x}px`);
  shell.style.setProperty("--profile-panel-drag-y", `${y}px`);
}

function dragBounds(shell, offset) {
  const rect = shell.getBoundingClientRect();
  const handle = shell.querySelector(HANDLE_SELECTOR);
  const handleRect = handle?.getBoundingClientRect?.() || rect;
  const baseLeft = rect.left - offset.x;
  const baseRight = rect.right - offset.x;
  const baseHeaderTop = handleRect.top - offset.y;

  return {
    minX: MIN_VISIBLE_X - baseRight,
    maxX: window.innerWidth - MIN_VISIBLE_X - baseLeft,
    minY: EDGE_GAP - baseHeaderTop,
    maxY: window.innerHeight - MIN_VISIBLE_HEADER - baseHeaderTop,
  };
}

function eligibleShell(shell) {
  return shell instanceof HTMLElement && !shell.classList.contains("is-player-character-forge");
}

export default function ProfilePanelDragController() {
  useEffect(() => {
    let drag = null;

    function finishDrag(pointerId = null) {
      if (!drag) return;
      if (pointerId != null && pointerId !== drag.pointerId) return;
      const { shell, pointerId: activePointerId } = drag;
      shell.classList.remove("is-profile-panel-dragging");
      document.body?.classList.remove("is-profile-panel-drag-active");
      try {
        shell.releasePointerCapture?.(activePointerId);
      } catch {}
      drag = null;
    }

    function onPointerDown(event) {
      if (window.innerWidth < DESKTOP_MIN_WIDTH || event.button !== 0 || event.isPrimary === false) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const shell = target.closest(PANEL_SELECTOR);
      if (!eligibleShell(shell)) return;

      const handle = target.closest(HANDLE_SELECTOR);
      if (!handle && target !== shell) return;
      if (target.closest(INTERACTIVE_SELECTOR)) return;

      const offset = readOffset(shell);
      drag = {
        shell,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffset: offset,
        bounds: dragBounds(shell, offset),
      };

      shell.classList.add("is-profile-panel-dragging");
      document.body?.classList.add("is-profile-panel-drag-active");
      try {
        shell.setPointerCapture?.(event.pointerId);
      } catch {}
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const next = {
        x: clamp(
          drag.startOffset.x + event.clientX - drag.startX,
          drag.bounds.minX,
          drag.bounds.maxX
        ),
        y: clamp(
          drag.startOffset.y + event.clientY - drag.startY,
          drag.bounds.minY,
          drag.bounds.maxY
        ),
      };
      writeOffset(drag.shell, next);
    }

    function onPointerEnd(event) {
      finishDrag(event.pointerId);
    }

    function onResize() {
      if (window.innerWidth < DESKTOP_MIN_WIDTH) {
        document.querySelectorAll(PANEL_SELECTOR).forEach((shell) => {
          writeOffset(shell, { x: 0, y: 0 });
          shell.classList.remove("is-profile-panel-dragging");
        });
        finishDrag();
        return;
      }

      document.querySelectorAll(PANEL_SELECTOR).forEach((shell) => {
        if (!eligibleShell(shell)) return;
        const offset = readOffset(shell);
        const bounds = dragBounds(shell, offset);
        writeOffset(shell, {
          x: clamp(offset.x, bounds.minX, bounds.maxX),
          y: clamp(offset.y, bounds.minY, bounds.maxY),
        });
      });
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerEnd, true);
    document.addEventListener("pointercancel", onPointerEnd, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", finishDrag);

    return () => {
      finishDrag();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerEnd, true);
      document.removeEventListener("pointercancel", onPointerEnd, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", finishDrag);
    };
  }, []);

  return null;
}

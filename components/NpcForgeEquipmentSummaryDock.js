import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCopper, magicAllowanceLabel } from "../utils/playerForgeStartingEquipment";

const DOCK_GUTTER = 12;
const DOCK_WIDTH = 370;
const DOCK_MIN_WIDTH = 320;
const DOCK_MAX_WIDTH = 460;
const DOCK_HEADER_VISIBLE = 56;

function boundedPosition(position = {}) {
  if (typeof window === "undefined") return position;
  const viewportWidth = Math.max(1, Number(window.innerWidth || 1));
  const viewportHeight = Math.max(1, Number(window.innerHeight || 1));
  const width = Math.min(
    Math.max(Number(position.width || DOCK_WIDTH), Math.min(DOCK_MIN_WIDTH, viewportWidth - DOCK_GUTTER * 2)),
    Math.max(DOCK_MIN_WIDTH, Math.min(DOCK_MAX_WIDTH, viewportWidth - DOCK_GUTTER * 2)),
  );
  return {
    left: Math.min(Math.max(Number(position.left ?? DOCK_GUTTER), DOCK_GUTTER), Math.max(DOCK_GUTTER, viewportWidth - width - DOCK_GUTTER)),
    top: Math.min(Math.max(Number(position.top ?? DOCK_GUTTER), DOCK_GUTTER), Math.max(DOCK_GUTTER, viewportHeight - DOCK_HEADER_VISIBLE - DOCK_GUTTER)),
    width,
  };
}

function defaultPosition() {
  if (typeof window === "undefined" || typeof document === "undefined") return { left: DOCK_GUTTER, top: 96, width: DOCK_WIDTH };
  const forge = document.querySelector(".npc-forge-modal-v2.is-player-mode")?.getBoundingClientRect();
  const width = Math.min(DOCK_WIDTH, Math.max(DOCK_MIN_WIDTH, window.innerWidth - DOCK_GUTTER * 2));
  return boundedPosition({
    left: forge ? forge.right - width - 18 : window.innerWidth - width - 24,
    top: forge ? forge.top + 96 : 88,
    width,
  });
}

export default function NpcForgeEquipmentSummaryDock({
  presentation = "floating",
  ruleset = "dndnext-homebrew",
  budgetCopper = 0,
  spentCopper = 0,
  remainingCopper = 0,
  vanillaSourceCopper = 0,
  classCashCopper = 0,
  backgroundCashCopper = 0,
  level = 1,
  purchases = [],
  onRemovePurchase = null,
}) {
  const floating = presentation === "floating";
  const dockRef = useRef(null);
  const dragRef = useRef(null);
  const [portalHost, setPortalHost] = useState(null);
  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!floating || typeof window === "undefined" || typeof document === "undefined") {
      setPortalHost(null);
      setPosition(null);
      return undefined;
    }
    const desktop = window.matchMedia("(min-width: 901px)");
    let frame = 0;
    function sync() {
      if (!desktop.matches) {
        setPortalHost(null);
        setPosition(null);
        return;
      }
      frame = window.requestAnimationFrame(() => {
        setPosition(defaultPosition());
        setPortalHost(document.body);
      });
    }
    sync();
    desktop.addEventListener?.("change", sync);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      desktop.removeEventListener?.("change", sync);
    };
  }, [floating]);

  useEffect(() => {
    if (!floating || typeof window === "undefined") return undefined;
    const keepVisible = () => setPosition((current) => current ? boundedPosition(current) : current);
    window.addEventListener("resize", keepVisible);
    return () => window.removeEventListener("resize", keepVisible);
  }, [floating]);

  function startDrag(event) {
    if (!floating) return;
    if (event.button != null && event.button !== 0) return;
    if (event.target?.closest?.("button,a,input,select,textarea,summary")) return;
    const rect = dockRef.current?.getBoundingClientRect();
    if (!rect) return;
    const current = boundedPosition({ left: rect.left, top: rect.top, width: rect.width || DOCK_WIDTH });
    setPosition(current);
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: Number(event.clientX || 0) - rect.left,
      offsetY: Number(event.clientY || 0) - rect.top,
      width: current.width,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(boundedPosition({
      left: Number(event.clientX || 0) - drag.offsetX,
      top: Number(event.clientY || 0) - drag.offsetY,
      width: drag.width,
    }));
  }

  function endDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  const totalItems = (purchases || []).reduce((sum, entry) => sum + Math.max(0, Number(entry?.qty || 0)), 0);
  const body = <aside
    ref={dockRef}
    className={`npc-forge-equipment-summary-dock ${presentation === "rail" ? "is-rail" : "is-floating"} ${collapsed ? "is-collapsed" : ""} ${dragging ? "is-dragging" : ""}`}
    style={portalHost && position ? { left: position.left, top: position.top, width: position.width } : undefined}
    aria-label="Starting market summary"
  >
    <header
      className="npc-forge-equipment-summary-dock__head"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div><span>Starting cart</span><strong>{totalItems} item{totalItems === 1 ? "" : "s"}</strong></div>
      <div className="npc-forge-equipment-summary-dock__head-actions">
        <em>{formatCopper(remainingCopper)} left</em>
        <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand starting cart summary" : "Collapse starting cart summary"}>{collapsed ? "▣" : "—"}</button>
      </div>
    </header>

    {!collapsed ? <div className="npc-forge-equipment-summary-dock__body">
      <div className="npc-forge-equipment-summary-dock__totals">
        <div><span>Total gold</span><strong>{formatCopper(budgetCopper)}</strong></div>
        <div><span>Spent</span><strong>{formatCopper(spentCopper)}</strong></div>
        <div className="is-remaining"><span>Remaining</span><strong>{formatCopper(remainingCopper)}</strong></div>
      </div>

      <section className="npc-forge-equipment-summary-dock__cart">
        <div className="npc-forge-starting-cart__items">
          {purchases.length ? purchases.map((entry) => <div key={`${entry.merchantId}:${entry.stockId}`}>
            <span><strong>{entry.qty > 1 ? `${entry.qty}× ` : ""}{entry.itemName}</strong><small>{entry.merchantName || "Merchant"} · {entry.priceGp} gp each</small></span>
            <button type="button" onClick={() => onRemovePurchase?.(entry.stockId)} aria-label={`Remove one ${entry.itemName}`}>−</button>
          </div>) : <p>No purchases yet. Keeping gold is allowed.</p>}
        </div>
      </section>

      <details className="npc-forge-equipment-summary-dock__rules">
        <summary>Rules &amp; source purse</summary>
        <dl className="npc-forge-equipment-summary">
          <div><dt>Ruleset</dt><dd>{ruleset === "vanilla" ? "Vanilla source rules" : "DNDNext Homebrew"}</dd></div>
          <div><dt>Vanilla source purse</dt><dd>{formatCopper(vanillaSourceCopper)}</dd></div>
          <div><dt>Class source cash</dt><dd>{formatCopper(classCashCopper)}</dd></div>
          <div><dt>Background source cash</dt><dd>{formatCopper(backgroundCashCopper)}</dd></div>
          <div><dt>Higher-level magic</dt><dd>{magicAllowanceLabel(level)}</dd></div>
        </dl>
        <p className="npc-forge-equipment-note"><strong>DM guide only:</strong> the higher-level magic-item allowance remains a review guide; the Forge does not grant free magic items.</p>
      </details>
    </div> : null}
  </aside>;

  return portalHost ? createPortal(body, portalHost) : body;
}

import { useEffect, useRef, useState } from "react";
import ClassFeatureText from "./ClassFeatureText";
import ItemCard from "./ItemCard";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { classPresentationSummary } from "../utils/classes/classPresentation";

const DOCK_GUTTER = 10;
const DOCK_MIN_WIDTH = 300;
const DOCK_MAX_WIDTH = 520;
const DOCK_VISIBLE_HEADER = 54;

function safeText(value) {
  return String(value ?? "").trim();
}

function boundedDockPosition(position = {}) {
  if (typeof window === "undefined") return position;
  const width = Math.min(Math.max(Number(position.width || DOCK_MIN_WIDTH), DOCK_MIN_WIDTH), Math.max(DOCK_MIN_WIDTH, Math.min(DOCK_MAX_WIDTH, window.innerWidth - (DOCK_GUTTER * 2))));
  const maxLeft = Math.max(DOCK_GUTTER, window.innerWidth - width - DOCK_GUTTER);
  const maxTop = Math.max(DOCK_GUTTER, window.innerHeight - DOCK_VISIBLE_HEADER - DOCK_GUTTER);
  return {
    left: Math.min(Math.max(Number(position.left || DOCK_GUTTER), DOCK_GUTTER), maxLeft),
    top: Math.min(Math.max(Number(position.top || DOCK_GUTTER), DOCK_GUTTER), maxTop),
    width,
  };
}

export default function NpcForgeClassFeatureDock({ detail = null, selectedClass = null }) {
  const dockRef = useRef(null);
  const dragRef = useRef(null);
  const [collapsed, setCollapsed] = useState(true);
  const [floatingPosition, setFloatingPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const feature = detail?.type === "classFeature" ? detail.feature : null;
  const title = feature?.name || selectedClass?.class_name || "Class feature details";
  const description = feature?.description
    ? formatPlayerFacingText(feature.description)
    : formatPlayerFacingText(
      classPresentationSummary(selectedClass),
      "Hover or focus a class or subclass feature to inspect it here without leaving the class catalogue.",
    );
  const source = feature || selectedClass ? safeText(feature?.source || selectedClass?.source || "Campaign") : "";
  const level = Number(feature?.level || 0);
  const isListedOption = feature?.type === "listed-option";
  const type = isListedOption ? "Listed Option" : feature?.type === "subclass" ? "Subclass Feature" : feature ? "Class Feature" : "Class Overview";
  const parentFeatureName = safeText(feature?.parentFeatureName || detail?.parentFeatureName);
  const canonicalItem = isListedOption && feature?.detailKind === "item" && feature?.metadata?.itemCard
    ? feature.metadata.itemCard
    : null;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const frame = window.requestAnimationFrame(() => {
      const rect = dockRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      setFloatingPosition(boundedDockPosition({ left: rect.left, top: rect.top, width: rect.width }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    function keepDockVisible() {
      setFloatingPosition((current) => current ? boundedDockPosition(current) : current);
    }
    window.addEventListener("resize", keepDockVisible);
    return () => window.removeEventListener("resize", keepDockVisible);
  }, []);

  function handleDragStart(event) {
    if (event.button != null && event.button !== 0) return;
    if (event.target?.closest?.("button,a,input,select,textarea,summary")) return;
    const rect = dockRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position = boundedDockPosition({ left: rect.left, top: rect.top, width: rect.width });
    setFloatingPosition(position);
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: Number(event.clientX || 0) - rect.left,
      offsetY: Number(event.clientY || 0) - rect.top,
      width: position.width,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function handleDragMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setFloatingPosition(boundedDockPosition({
      left: Number(event.clientX || 0) - drag.offsetX,
      top: Number(event.clientY || 0) - drag.offsetY,
      width: drag.width,
    }));
  }

  function handleDragEnd(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  const floatingStyle = floatingPosition ? {
    left: `${floatingPosition.left}px`,
    top: `${floatingPosition.top}px`,
    width: `${floatingPosition.width}px`,
    "--npc-forge-class-dock-top": `${floatingPosition.top}px`,
  } : undefined;

  return (
    <section ref={dockRef} style={floatingStyle} className={`npc-forge-class-feature-dock${feature ? " has-feature" : " is-placeholder"}${collapsed ? " is-collapsed" : ""}${floatingPosition ? " is-floating" : ""}${dragging ? " is-dragging" : ""}`}>
      <div className="npc-forge-class-feature-dock__head" onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd} title="Drag to move this description window">
        <div>
          <span>{type}</span>
          <h3>{detail?.subclassName && feature?.type === "subclass" ? `${detail.subclassName}: ` : ""}{title}</h3>
        </div>
        <div className="npc-forge-class-feature-dock__head-actions">
          {source ? <em>{source}</em> : null}
          <button type="button" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed} aria-label={collapsed ? "Expand class feature details" : "Collapse class feature details"} title={collapsed ? "Expand details" : "Collapse details"}>{collapsed ? "⌃" : "⌄"}</button>
        </div>
      </div>
      <div className="npc-forge-class-feature-dock__body" hidden={collapsed}>
        <div className="npc-forge-class-feature-dock__meta">
          {level ? <span>Level {level}</span> : null}
          {selectedClass?.class_name ? <span>{selectedClass.class_name}</span> : null}
          {feature?.type === "subclass" && detail?.subclassName ? <span>{detail.subclassName}</span> : null}
          {isListedOption && parentFeatureName ? <span>From {parentFeatureName}</span> : null}
        </div>
        <ClassFeatureText text={description} entries={feature?.entries || null} compact />
        {canonicalItem ? <div className="npc-forge-class-feature-dock__item-card" aria-label={`${title} canonical item card`}><ItemCard item={canonicalItem} /></div> : null}
        {!feature ? <small>Feature descriptions will appear here as you move through the progression table or detailed guide.</small> : null}
        {isListedOption ? <div className="npc-forge-class-feature-dock__listed-note">This is a listed option inside <strong>{parentFeatureName || "the selected feature"}</strong>. The description comes from the normalized class-option or canonical item catalogue when a matching entry exists; otherwise the parent feature remains the mechanical authority.</div> : null}
        {selectedClass ? <div className="npc-forge-class-feature-dock__routing-note">Read feature rules here. Persistent selections such as Invocations, Fighting Styles, maneuvers, plans, and higher-level feats are completed in <strong>Training → Feats & Class Abilities</strong>; spell-specific selections are completed in <strong>Spells</strong>.</div> : null}
      </div>
      <style jsx global>{`
        .npc-forge-class-feature-dock__head{cursor:grab;touch-action:none;user-select:none}.npc-forge-class-feature-dock.is-dragging .npc-forge-class-feature-dock__head{cursor:grabbing}.npc-forge-class-feature-dock__head-actions{display:flex;align-items:center;gap:7px}.npc-forge-class-feature-dock__head-actions>button{display:grid;place-items:center;width:27px;height:27px;padding:0;border:1px solid rgba(168,108,255,.42);border-radius:7px;color:#f0e8ff;background:rgba(126,72,199,.14);font-size:.78rem;font-weight:900;line-height:1}.npc-forge-class-feature-dock__head-actions>button:hover{border-color:#a86cff;background:rgba(126,72,199,.26)}.npc-forge-class-feature-dock__body[hidden]{display:none!important}.npc-forge-class-feature-dock.is-collapsed{min-height:0!important}.npc-forge-class-feature-dock__routing-note,.npc-forge-class-feature-dock__listed-note{margin-top:10px;padding:9px 11px;border-left:3px solid #58d6c7;border-radius:8px;color:rgba(255,255,255,.78);background:rgba(88,214,199,.065);font-size:.68rem;line-height:1.5}.npc-forge-class-feature-dock__listed-note{border-left-color:#a86cff;background:rgba(126,72,199,.075)}.npc-forge-class-feature-dock__routing-note strong,.npc-forge-class-feature-dock__listed-note strong{color:#d8fff9}.npc-forge-class-feature-dock__item-card{margin-top:11px}.npc-forge-class-feature-dock__item-card .sitem-card{margin-bottom:0!important;background:rgba(12,15,24,.94)}.npc-forge-class-feature-dock__item-card .card-body{padding:.8rem}.npc-forge-class-feature-dock__item-card .sitem-title{font-size:.82rem}.npc-forge-class-feature-dock__item-card .sitem-section{font-size:.68rem;line-height:1.5}@media(min-width:901px){.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-feature-dock.is-floating{position:fixed!important;right:auto!important;bottom:auto!important;z-index:12550!important;align-self:auto!important;max-width:calc(100vw - 20px)!important;max-height:min(62dvh,calc(100dvh - var(--npc-forge-class-dock-top,120px) - 10px))!important;margin:0!important;overflow:auto!important;overscroll-behavior:contain;box-shadow:0 18px 55px rgba(0,0,0,.48),0 0 0 1px rgba(168,108,255,.16)}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-feature-dock.is-floating.is-collapsed{max-height:58px!important;overflow:hidden!important}}@media(max-width:900px){.npc-forge-class-feature-dock__head{cursor:default;touch-action:auto}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-feature-dock.is-floating{position:static!important;width:100%!important;max-width:none!important;max-height:none!important;margin-top:8px!important;box-shadow:none}}
      `}</style>
    </section>
  );
}

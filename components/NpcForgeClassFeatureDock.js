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

function classOverviewHighlights(classRow = {}) {
  const byLevel = classRow?.class_features_by_level || classRow?.raw_payload?.class_features_by_level || {};
  const seen = new Set();
  const highlights = [];
  const rows = Object.entries(byLevel).sort(([a], [b]) => Number(a || 0) - Number(b || 0));
  for (const [, features] of rows) {
    for (const entry of Array.isArray(features) ? features : []) {
      const name = safeText(String(entry || "").split("|")[0]);
      const key = name.toLowerCase();
      if (!name || seen.has(key) || key === "ability score improvement" || key === "epic boon") continue;
      seen.add(key);
      highlights.push(name);
      if (highlights.length >= 4) return highlights;
    }
  }
  return highlights;
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
  const isOverview = !feature;
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
  const overviewHighlights = isOverview && selectedClass ? classOverviewHighlights(selectedClass) : [];
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
        <div className="npc-forge-class-feature-dock__title-group">
          <span>{type}</span>
          <h3>{detail?.subclassName && feature?.type === "subclass" ? `${detail.subclassName}: ` : ""}{title}</h3>
        </div>
        <div className="npc-forge-class-feature-dock__head-actions">
          {source ? <em>{source}</em> : null}
          <button type="button" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed} aria-label={collapsed ? "Expand class feature details" : "Collapse class feature details"} title={collapsed ? "Expand details" : "Collapse details"}>{collapsed ? "Expand" : "Collapse"}</button>
        </div>
      </div>
      <div className="npc-forge-class-feature-dock__body" hidden={collapsed}>
        {isOverview && selectedClass?.class_name ? <span className="npc-forge-class-feature-dock__class-chip">{selectedClass.class_name}</span> : null}
        <div className="npc-forge-class-feature-dock__summary">
          <ClassFeatureText text={description} entries={feature?.entries || null} compact />
        </div>
        {isOverview && overviewHighlights.length ? <div className="npc-forge-class-feature-dock__highlights">
          <strong>Feature Highlights</strong>
          <ul>{overviewHighlights.map((name) => <li key={name}>{name}</li>)}</ul>
        </div> : null}
        <div className="npc-forge-class-feature-dock__meta">
          {level ? <span>Level {level}</span> : null}
          {!isOverview && selectedClass?.class_name ? <span>{selectedClass.class_name}</span> : null}
          {feature?.type === "subclass" && detail?.subclassName ? <span>{detail.subclassName}</span> : null}
          {isListedOption && parentFeatureName ? <span>From {parentFeatureName}</span> : null}
        </div>
        {canonicalItem ? <div className="npc-forge-class-feature-dock__item-card" aria-label={`${title} canonical item card`}><ItemCard item={canonicalItem} /></div> : null}
        {!feature && !selectedClass ? <small>Feature descriptions will appear here as you move through the progression table or detailed guide.</small> : null}
        {isListedOption ? <div className="npc-forge-class-feature-dock__listed-note">This is a listed option inside <strong>{parentFeatureName || "the selected feature"}</strong>. The description comes from the normalized class-option or canonical item catalogue when a matching entry exists; otherwise the parent feature remains the mechanical authority.</div> : null}
        {selectedClass ? <div className="npc-forge-class-feature-dock__routing-note">Read feature rules here. Persistent selections such as Invocations, Fighting Styles, maneuvers, plans, and higher-level feats are completed in <strong>Training → Feats & Class Abilities</strong>; spell-specific selections are completed in <strong>Spells</strong>.</div> : null}
        <div className="npc-forge-class-feature-dock__drag-cue" aria-hidden="true">Drag to move <span>✥</span></div>
      </div>
      <style jsx global>{`
        .npc-forge-class-feature-dock{border:1px solid rgba(168,108,255,.72)!important;border-radius:10px!important;background:linear-gradient(155deg,rgba(37,24,55,.985),rgba(17,20,32,.985) 62%,rgba(13,22,31,.985))!important;box-shadow:inset 0 1px rgba(255,255,255,.035),0 14px 36px rgba(0,0,0,.34)!important}.npc-forge-class-feature-dock__head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important;min-height:52px!important;padding:9px 10px!important;border-bottom:1px solid rgba(168,108,255,.15)!important;cursor:grab;touch-action:none;user-select:none}.npc-forge-class-feature-dock.is-collapsed .npc-forge-class-feature-dock__head{align-items:center!important;border-bottom:0!important}.npc-forge-class-feature-dock.is-dragging .npc-forge-class-feature-dock__head{cursor:grabbing}.npc-forge-class-feature-dock__title-group{display:grid;gap:2px;min-width:0}.npc-forge-class-feature-dock__title-group>span{color:#d6b9ff!important;font-size:.48rem!important;font-weight:900!important;letter-spacing:.1em!important;text-transform:uppercase}.npc-forge-class-feature-dock__title-group>h3{margin:0!important;color:#fff!important;font-size:.88rem!important;font-weight:750!important;line-height:1.15!important}.npc-forge-class-feature-dock__head-actions{display:flex;align-items:center;gap:7px;flex:0 0 auto}.npc-forge-class-feature-dock__head-actions>em{padding:3px 6px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:6px!important;color:rgba(255,255,255,.72)!important;background:rgba(255,255,255,.045)!important;font-size:.42rem!important;font-style:normal!important;font-weight:850!important;letter-spacing:.045em!important}.npc-forge-class-feature-dock__head-actions>button{min-width:58px;height:27px;padding:0 8px;border:1px solid rgba(168,108,255,.42);border-radius:6px;color:#f0e8ff;background:rgba(10,12,20,.72);font-size:.5rem;font-weight:800;line-height:1}.npc-forge-class-feature-dock__head-actions>button:hover{border-color:#a86cff;background:rgba(126,72,199,.26)}.npc-forge-class-feature-dock__body{position:relative;display:grid;gap:9px;padding:10px 11px 12px!important}.npc-forge-class-feature-dock__body[hidden]{display:none!important}.npc-forge-class-feature-dock.is-collapsed{min-height:0!important}.npc-forge-class-feature-dock__class-chip{justify-self:start;padding:3px 7px;border:1px solid rgba(168,108,255,.35);border-radius:999px;color:#d8c8ff;background:rgba(126,72,199,.12);font-size:.48rem;font-weight:800}.npc-forge-class-feature-dock__summary{color:rgba(255,255,255,.82)}.npc-forge-class-feature-dock__summary .class-feature-text,.npc-forge-class-feature-dock__summary p{font-size:.62rem!important;line-height:1.48!important}.npc-forge-class-feature-dock__highlights{display:grid;gap:5px;padding-top:2px}.npc-forge-class-feature-dock__highlights>strong{color:#d2a9ff;font-size:.46rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.npc-forge-class-feature-dock__highlights ul{display:grid;gap:3px;margin:0;padding-left:15px;color:rgba(255,255,255,.76);font-size:.54rem;line-height:1.35}.npc-forge-class-feature-dock__meta{display:flex!important;flex-wrap:wrap!important;gap:5px!important;margin:0!important}.npc-forge-class-feature-dock__meta:empty{display:none!important}.npc-forge-class-feature-dock__meta>span{padding:3px 6px!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:6px!important;color:rgba(255,255,255,.67)!important;background:rgba(5,8,15,.38)!important;font-size:.45rem!important}.npc-forge-class-feature-dock__routing-note,.npc-forge-class-feature-dock__listed-note{margin-top:1px;padding:9px 10px;border:1px solid rgba(88,214,199,.2);border-left:3px solid #58d6c7;border-radius:7px;color:rgba(226,255,250,.82);background:linear-gradient(90deg,rgba(18,70,73,.2),rgba(8,20,28,.35));font-size:.52rem;line-height:1.45}.npc-forge-class-feature-dock__listed-note{border-color:rgba(168,108,255,.2);border-left-color:#a86cff;background:rgba(126,72,199,.075)}.npc-forge-class-feature-dock__routing-note strong,.npc-forge-class-feature-dock__listed-note strong{color:#d8fff9}.npc-forge-class-feature-dock__drag-cue{justify-self:end;color:rgba(255,255,255,.42);font-size:.42rem;letter-spacing:.025em}.npc-forge-class-feature-dock__drag-cue span{color:#8ae7db;font-size:.65rem}.npc-forge-class-feature-dock__item-card{margin-top:2px}.npc-forge-class-feature-dock__item-card .sitem-card{margin-bottom:0!important;background:rgba(12,15,24,.94)}.npc-forge-class-feature-dock__item-card .card-body{padding:.8rem}.npc-forge-class-feature-dock__item-card .sitem-title{font-size:.82rem}.npc-forge-class-feature-dock__item-card .sitem-section{font-size:.68rem;line-height:1.5}@media(min-width:901px){.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-feature-dock.is-floating{position:fixed!important;right:auto!important;bottom:auto!important;z-index:12550!important;align-self:auto!important;max-width:calc(100vw - 20px)!important;max-height:min(62dvh,calc(100dvh - var(--npc-forge-class-dock-top,120px) - 10px))!important;margin:0!important;overflow:auto!important;overscroll-behavior:contain;box-shadow:0 18px 55px rgba(0,0,0,.5),0 0 0 1px rgba(168,108,255,.18)!important}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-feature-dock.is-floating.is-collapsed{max-height:58px!important;overflow:hidden!important}}@media(max-width:900px){.npc-forge-class-feature-dock__head{cursor:default;touch-action:auto}.npc-forge-class-feature-dock__drag-cue{display:none}.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-2 .npc-forge-class-feature-dock.is-floating{position:static!important;width:100%!important;max-width:none!important;max-height:none!important;margin-top:8px!important;box-shadow:none}}
      `}</style>
    </section>
  );
}

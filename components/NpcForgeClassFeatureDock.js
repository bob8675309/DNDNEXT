import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ClassFeatureText from "./ClassFeatureText";
import ItemCard from "./ItemCard";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { classPresentationSummary } from "../utils/classes/classPresentation";
import { subclassArtworkFor, handleSubclassArtworkError } from "../utils/classes/subclassArtwork";

const DOCK_GUTTER = 12;
const DOCK_MIN_WIDTH = 300;
const DOCK_DEFAULT_WIDTH = 390;
const DOCK_MAX_WIDTH = 460;
const DOCK_VISIBLE_HEADER = 60;

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
  const viewportWidth = Math.max(1, Number(window.innerWidth || 1));
  const viewportHeight = Math.max(1, Number(window.innerHeight || 1));
  const width = Math.min(
    Math.max(Number(position.width || DOCK_DEFAULT_WIDTH), Math.min(DOCK_MIN_WIDTH, viewportWidth - (DOCK_GUTTER * 2))),
    Math.max(DOCK_MIN_WIDTH, Math.min(DOCK_MAX_WIDTH, viewportWidth - (DOCK_GUTTER * 2))),
  );
  const maxLeft = Math.max(DOCK_GUTTER, viewportWidth - width - DOCK_GUTTER);
  const maxTop = Math.max(DOCK_GUTTER, viewportHeight - DOCK_VISIBLE_HEADER - DOCK_GUTTER);
  return {
    left: Math.min(Math.max(Number(position.left ?? DOCK_GUTTER), DOCK_GUTTER), maxLeft),
    top: Math.min(Math.max(Number(position.top ?? DOCK_GUTTER), DOCK_GUTTER), maxTop),
    width,
  };
}

function defaultDockPosition() {
  if (typeof window === "undefined" || typeof document === "undefined") return { left: DOCK_GUTTER, top: 112, width: DOCK_DEFAULT_WIDTH };
  const lane = document.querySelector(".npc-forge-class-guide__dock-lane")?.getBoundingClientRect();
  if (lane?.width > 40 && lane?.height > 40) {
    const width = Math.min(DOCK_DEFAULT_WIDTH, Math.max(DOCK_MIN_WIDTH, lane.width - 10));
    return boundedDockPosition({ left: lane.left + Math.max(0, (lane.width - width) / 2), top: lane.top + 4, width });
  }
  const forge = document.querySelector(".unified-player-character-forge")?.getBoundingClientRect();
  const width = Math.min(DOCK_DEFAULT_WIDTH, Math.max(DOCK_MIN_WIDTH, Number(forge?.width || window.innerWidth) * .27));
  return boundedDockPosition({
    left: forge ? forge.right - width - 24 : window.innerWidth - width - 24,
    top: forge ? forge.top + Math.min(210, Math.max(118, forge.height * .2)) : 112,
    width,
  });
}

export default function NpcForgeClassFeatureDock({ detail = null, selectedClass = null }) {
  const dockRef = useRef(null);
  const dragRef = useRef(null);
  const [closedDetailKey, setClosedDetailKey] = useState("");
  const [floatingPosition, setFloatingPosition] = useState(null);
  const [portalHost, setPortalHost] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [subclassTab, setSubclassTab] = useState("overview");
  const feature = detail?.type === "classFeature" ? detail.feature : null;
  const subclassOption = detail?.subclassOption?.key ? detail.subclassOption : null;
  const subclassFeatures = (subclassOption?.features || []).filter((entry) => !entry?.isIntroduction);
  const subclassIntro = (subclassOption?.features || []).find((entry) => entry?.isIntroduction && safeText(entry?.description)) || null;
  const subclassSpellFeatures = subclassFeatures.filter((entry) => /(?:spell|cantrip|magic)/i.test(`${safeText(entry?.name)} ${safeText(entry?.description)}`));
  const isSubclassInspector = Boolean(subclassOption);
  const isOverview = !feature;
  const title = feature?.name || selectedClass?.class_name || "Class feature details";
  const description = feature?.description
    ? formatPlayerFacingText(feature.description)
    : formatPlayerFacingText(
      classPresentationSummary(selectedClass),
      selectedClass ? "Hover, focus, or select a class feature or subclass to inspect its deeper rules here." : "Feature descriptions will appear here as you move through the class guide.",
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
  const classIdentity = safeText(selectedClass?.id || selectedClass?.class_key || selectedClass?.class_name || "unselected");
  const featureIdentity = feature ? safeText(feature?.id || feature?.key || feature?.name || "feature") : "overview";
  const currentDetailKey = `${isOverview ? "overview" : "feature"}:${classIdentity}:${featureIdentity}:${level}`;
  const dismissed = closedDetailKey === currentDetailKey;

  useEffect(() => {
    setSubclassTab("overview");
  }, [subclassOption?.key]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;
    const desktop = window.matchMedia("(min-width: 901px)");
    let frame = null;

    function syncDockMode() {
      if (!desktop.matches) {
        if (frame != null) window.cancelAnimationFrame(frame);
        setPortalHost(null);
        setFloatingPosition(null);
        return;
      }

      frame = window.requestAnimationFrame(() => {
        setFloatingPosition(defaultDockPosition());
        setPortalHost(document.body);
      });
    }

    syncDockMode();
    desktop.addEventListener?.("change", syncDockMode);
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame);
      desktop.removeEventListener?.("change", syncDockMode);
    };
  }, [selectedClass?.class_key, selectedClass?.id]);

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
    const position = boundedDockPosition({ left: rect.left, top: rect.top, width: rect.width || DOCK_DEFAULT_WIDTH });
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

  const floatingStyle = portalHost && floatingPosition ? {
    left: `${floatingPosition.left}px`,
    top: `${floatingPosition.top}px`,
    width: `${floatingPosition.width}px`,
    "--npc-forge-class-dock-top": `${floatingPosition.top}px`,
  } : undefined;

  const dock = (
    <section ref={dockRef} style={floatingStyle} className={`npc-forge-class-feature-dock${feature ? " has-feature" : " is-placeholder"}${portalHost ? " is-floating is-viewport-floating" : ""}${dragging ? " is-dragging" : ""}`}>
      <div className="npc-forge-class-feature-dock__head" onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd} title={portalHost ? "Drag to move this description window anywhere in the viewport" : undefined}>
        <div className="npc-forge-class-feature-dock__title-group">
          <span>{type}</span>
          <h3>{detail?.subclassName && feature?.type === "subclass" ? `${detail.subclassName}: ` : ""}{title}</h3>
        </div>
        <div className="npc-forge-class-feature-dock__head-actions">
          {source ? <em>{source}</em> : null}
          <button type="button" onClick={() => setClosedDetailKey(currentDetailKey)} aria-label="Close class feature details" title="Close details">Close</button>
        </div>
      </div>
      <div className={`npc-forge-class-feature-dock__body${isSubclassInspector ? " is-subclass-inspector" : ""}`}>
        {isSubclassInspector ? <>
          <nav className="npc-forge-subclass-inspector__tabs" aria-label={`${subclassOption.name} details`}>
            {[
              ["overview", "Overview"],
              ["features", "Features"],
              ["lore", "Lore"],
              ["spells", "Spells"],
            ].map(([key, label]) => <button key={key} type="button" className={subclassTab === key ? "is-active" : ""} onClick={() => setSubclassTab(key)}>{label}</button>)}
          </nav>
          <div className="npc-forge-subclass-inspector__content">
            {subclassTab === "overview" ? <>
              <div className="npc-forge-subclass-inspector__identity">
                <div><span>{selectedClass?.class_name || "Class"} Subclass</span><h4>{subclassOption.name}</h4><small>{safeText(subclassOption.source || "Campaign")}</small></div>
                <img src={subclassArtworkFor(selectedClass?.class_key || "", subclassOption)} onError={(event) => handleSubclassArtworkError(event, selectedClass?.class_key || "")} alt="" aria-hidden="true" />
              </div>
              <ClassFeatureText text={subclassIntro?.description || feature?.description} entries={subclassIntro?.entries || null} compact />
              <div className="npc-forge-subclass-inspector__feature-strip">
                {subclassFeatures.slice(0, 5).map((entry) => <div key={`${entry.level}-${entry.name}`}><b>{Number(entry.level || subclassOption.firstLevel || 1)}</b><span>{entry.name}</span></div>)}
              </div>
            </> : null}
            {subclassTab === "features" ? <div className="npc-forge-subclass-inspector__feature-list">
              {subclassFeatures.length ? subclassFeatures.map((entry) => <details key={`${entry.level}-${entry.name}`}><summary><span>Level {Number(entry.level || subclassOption.firstLevel || 1)}</span><strong>{entry.name}</strong></summary><ClassFeatureText text={entry.description} entries={entry.entries || null} compact /></details>) : <p>No source-backed subclass features are available for this entry.</p>}
            </div> : null}
            {subclassTab === "lore" ? <div className="npc-forge-subclass-inspector__reading"><h4>{subclassOption.name}</h4>{subclassIntro?.description ? <ClassFeatureText text={subclassIntro.description} entries={subclassIntro.entries || null} compact /> : <p>No separate source-backed lore text is available for this subclass.</p>}</div> : null}
            {subclassTab === "spells" ? <div className="npc-forge-subclass-inspector__feature-list">
              {subclassSpellFeatures.length ? subclassSpellFeatures.map((entry) => <details key={`${entry.level}-${entry.name}`} open><summary><span>Level {Number(entry.level || subclassOption.firstLevel || 1)}</span><strong>{entry.name}</strong></summary><ClassFeatureText text={entry.description} entries={entry.entries || null} compact /></details>) : <p>No subclass-specific spell information is present in this source entry.</p>}
            </div> : null}
          </div>
        </> : <>
          {isOverview && selectedClass?.class_name ? <span className="npc-forge-class-feature-dock__class-chip">{selectedClass.class_name}</span> : null}
          <div className="npc-forge-class-feature-dock__meta">
            {level ? <span>Level {level}</span> : null}
            {!isOverview && selectedClass?.class_name ? <span>{selectedClass.class_name}</span> : null}
            {feature?.type === "subclass" && detail?.subclassName ? <span>{detail.subclassName}</span> : null}
            {isListedOption && parentFeatureName ? <span>From {parentFeatureName}</span> : null}
          </div>
          <div className="npc-forge-class-feature-dock__summary"><ClassFeatureText text={description} entries={feature?.entries || null} compact /></div>
          {isOverview && overviewHighlights.length ? <div className="npc-forge-class-feature-dock__highlights"><strong>Feature Highlights</strong><ul>{overviewHighlights.map((name) => <li key={name}>{name}</li>)}</ul></div> : null}
          {canonicalItem ? <div className="npc-forge-class-feature-dock__item-card" aria-label={`${title} canonical item card`}><ItemCard item={canonicalItem} /></div> : null}
          {!feature && !selectedClass ? <small>Feature descriptions will appear here as you move through the progression table or detailed guide.</small> : null}
          {isListedOption ? <div className="npc-forge-class-feature-dock__listed-note">This is a listed option inside <strong>{parentFeatureName || "the selected feature"}</strong>. The description comes from the normalized class-option or canonical item catalogue when a matching entry exists; otherwise the parent feature remains the mechanical authority.</div> : null}
          {selectedClass ? <div className="npc-forge-class-feature-dock__routing-note">{feature ? "Select another feature or subclass to inspect it here." : "Select a feature or subclass to see more detail here."}</div> : null}
          {portalHost ? <div className="npc-forge-class-feature-dock__drag-cue" aria-hidden="true">Drag header to move <span>✥</span></div> : null}
        </>}
      </div>
      <style jsx global>{`
        .npc-forge-class-feature-dock{border:1px solid rgba(168,108,255,.72)!important;border-radius:12px!important;background:linear-gradient(155deg,rgba(37,24,55,.985),rgba(17,20,32,.985) 62%,rgba(13,22,31,.985))!important;box-shadow:inset 0 1px rgba(255,255,255,.035),0 14px 36px rgba(0,0,0,.34)!important}
        .npc-forge-class-feature-dock__head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:12px!important;min-height:58px!important;padding:11px 12px!important;border-bottom:1px solid rgba(168,108,255,.18)!important;user-select:none}
        .npc-forge-class-feature-dock.is-viewport-floating .npc-forge-class-feature-dock__head{position:sticky;top:0;z-index:3;cursor:grab;touch-action:none;background:linear-gradient(155deg,rgba(43,27,63,.995),rgba(18,21,34,.995))!important;box-shadow:0 7px 16px rgba(0,0,0,.18)}
        .npc-forge-class-feature-dock.is-dragging .npc-forge-class-feature-dock__head{cursor:grabbing}
        .npc-forge-class-feature-dock__title-group{display:grid;gap:3px;min-width:0}
        .npc-forge-class-feature-dock__title-group>span{color:#d6b9ff!important;font-size:.56rem!important;font-weight:900!important;letter-spacing:.11em!important;text-transform:uppercase}
        .npc-forge-class-feature-dock__title-group>h3{margin:0!important;color:#fff!important;font-size:1rem!important;font-weight:780!important;line-height:1.22!important}
        .npc-forge-class-feature-dock__head-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}
        .npc-forge-class-feature-dock__head-actions>em{padding:4px 7px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:7px!important;color:rgba(255,255,255,.75)!important;background:rgba(255,255,255,.045)!important;font-size:.5rem!important;font-style:normal!important;font-weight:850!important;letter-spacing:.045em!important}
        .npc-forge-class-feature-dock__head-actions>button{min-width:52px;height:30px;padding:0 9px;border:1px solid rgba(168,108,255,.42);border-radius:7px;color:#f0e8ff;background:rgba(10,12,20,.72);font-size:.56rem;font-weight:800;line-height:1}
        .npc-forge-class-feature-dock__head-actions>button:hover{border-color:#a86cff;background:rgba(126,72,199,.26)}
        .npc-forge-class-feature-dock__body{position:relative;display:grid;gap:12px;padding:13px 14px 15px!important}
        .npc-forge-class-feature-dock__class-chip{justify-self:start;padding:4px 8px;border:1px solid rgba(168,108,255,.35);border-radius:999px;color:#d8c8ff;background:rgba(126,72,199,.12);font-size:.54rem;font-weight:800}
        .npc-forge-class-feature-dock__summary{color:rgba(255,255,255,.84)}
        .npc-forge-class-feature-dock__summary .class-feature-text,.npc-forge-class-feature-dock__summary p{font-size:.72rem!important;line-height:1.58!important}
        .npc-forge-class-feature-dock__summary li{font-size:.69rem!important;line-height:1.55!important}
        .npc-forge-class-feature-dock__highlights{display:grid;gap:7px;padding:9px 10px;border:1px solid rgba(168,108,255,.16);border-radius:8px;background:rgba(126,72,199,.055)}
        .npc-forge-class-feature-dock__highlights>strong{color:#d2a9ff;font-size:.52rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
        .npc-forge-class-feature-dock__highlights ul{display:grid;gap:5px;margin:0;padding-left:17px;color:rgba(255,255,255,.78);font-size:.61rem;line-height:1.45}
        .npc-forge-class-feature-dock__meta{display:flex!important;flex-wrap:wrap!important;gap:6px!important;margin:0!important}
        .npc-forge-class-feature-dock__meta:empty{display:none!important}
        .npc-forge-class-feature-dock__meta>span{padding:4px 7px!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:7px!important;color:rgba(255,255,255,.7)!important;background:rgba(5,8,15,.38)!important;font-size:.51rem!important}
        .npc-forge-class-feature-dock__routing-note,.npc-forge-class-feature-dock__listed-note{margin-top:1px;padding:10px 11px;border:1px solid rgba(88,214,199,.2);border-left:3px solid #58d6c7;border-radius:8px;color:rgba(226,255,250,.84);background:linear-gradient(90deg,rgba(18,70,73,.2),rgba(8,20,28,.35));font-size:.61rem;line-height:1.52}
        .npc-forge-class-feature-dock__listed-note{border-color:rgba(168,108,255,.2);border-left-color:#a86cff;background:rgba(126,72,199,.075)}
        .npc-forge-class-feature-dock__routing-note strong,.npc-forge-class-feature-dock__listed-note strong{color:#d8fff9}
        .npc-forge-class-feature-dock__drag-cue{justify-self:end;color:rgba(255,255,255,.46);font-size:.49rem;letter-spacing:.025em}
        .npc-forge-class-feature-dock__drag-cue span{color:#8ae7db;font-size:.72rem}
        .npc-forge-class-feature-dock__item-card{margin-top:2px}
        .npc-forge-class-feature-dock__item-card .sitem-card{margin-bottom:0!important;background:rgba(12,15,24,.94)}
        .npc-forge-class-feature-dock__item-card .card-body{padding:.9rem}
        .npc-forge-class-feature-dock__item-card .sitem-title{font-size:.9rem}
        .npc-forge-class-feature-dock__item-card .sitem-section{font-size:.72rem;line-height:1.55}
        .npc-forge-class-feature-dock__body.is-subclass-inspector{gap:0!important;padding:0!important;background:linear-gradient(160deg,rgba(7,13,18,.99),rgba(8,18,23,.985) 55%,rgba(10,12,18,.99))}
        .npc-forge-subclass-inspector__tabs{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid rgba(209,158,67,.48);background:rgba(5,10,14,.9)}
        .npc-forge-subclass-inspector__tabs button{min-height:42px;border:0;border-right:1px solid rgba(209,158,67,.28);border-radius:0;color:#d8c6a3;background:rgba(9,15,20,.72);font:700 .64rem/1 Georgia,serif;letter-spacing:.02em}
        .npc-forge-subclass-inspector__tabs button:last-child{border-right:0}.npc-forge-subclass-inspector__tabs button:hover{color:#ffe2a2;background:rgba(92,58,22,.22)}.npc-forge-subclass-inspector__tabs button.is-active{color:#1b1208;background:linear-gradient(#f2d29b,#c99755);box-shadow:inset 0 -2px rgba(100,54,16,.45)}
        .npc-forge-subclass-inspector__content{min-height:310px;padding:18px;color:#eee5d4}.npc-forge-subclass-inspector__identity{display:grid;grid-template-columns:minmax(0,1fr) 108px;gap:14px;align-items:start;margin-bottom:14px}.npc-forge-subclass-inspector__identity h4,.npc-forge-subclass-inspector__reading h4{margin:3px 0 2px;color:#f0c979;font:700 1.45rem/1.05 Georgia,serif}.npc-forge-subclass-inspector__identity span{color:#cda65f;font-size:.66rem}.npc-forge-subclass-inspector__identity small{color:rgba(255,255,255,.55);font-size:.55rem}.npc-forge-subclass-inspector__identity img{width:108px;aspect-ratio:7/12;object-fit:cover;border:1px solid rgba(221,169,73,.62);border-radius:5px;box-shadow:0 8px 24px rgba(0,0,0,.42)}
        .npc-forge-subclass-inspector__content .class-feature-text,.npc-forge-subclass-inspector__content p{font-size:.72rem!important;line-height:1.6!important;color:rgba(244,239,226,.88)!important}.npc-forge-subclass-inspector__feature-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(58px,1fr));gap:7px;margin-top:16px;padding-top:13px;border-top:1px solid rgba(209,158,67,.25)}.npc-forge-subclass-inspector__feature-strip>div{display:grid;gap:4px;text-align:center}.npc-forge-subclass-inspector__feature-strip b{margin:auto;display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(225,173,76,.65);border-radius:50%;color:#f4cc79;background:radial-gradient(circle,rgba(121,72,23,.42),rgba(12,17,21,.92));font-size:.58rem}.npc-forge-subclass-inspector__feature-strip span{color:#dfd1b7;font-size:.52rem;line-height:1.2}
        .npc-forge-subclass-inspector__feature-list{display:grid;gap:8px}.npc-forge-subclass-inspector__feature-list details{border:1px solid rgba(209,158,67,.24);border-radius:6px;background:rgba(12,18,22,.72);overflow:hidden}.npc-forge-subclass-inspector__feature-list summary{display:grid;grid-template-columns:58px 1fr;gap:9px;align-items:center;padding:10px 11px;cursor:pointer;list-style:none}.npc-forge-subclass-inspector__feature-list summary::-webkit-details-marker{display:none}.npc-forge-subclass-inspector__feature-list summary span{color:#c69b53;font-size:.52rem;text-transform:uppercase}.npc-forge-subclass-inspector__feature-list summary strong{color:#f1dfbd;font:700 .72rem/1.25 Georgia,serif}.npc-forge-subclass-inspector__feature-list details>.class-feature-text{padding:0 12px 12px}.npc-forge-subclass-inspector__reading{display:grid;gap:8px}

        .npc-forge-class-feature-dock.is-viewport-floating{position:fixed!important;right:auto!important;bottom:auto!important;z-index:14050!important;max-width:calc(100vw - 24px)!important;max-height:min(72dvh,calc(100dvh - var(--npc-forge-class-dock-top,112px) - 12px))!important;margin:0!important;overflow:auto!important;overscroll-behavior:contain;box-shadow:0 22px 68px rgba(0,0,0,.58),0 0 0 1px rgba(168,108,255,.22),0 0 42px rgba(126,72,199,.13)!important}

        @media(min-width:901px){
          .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class{position:relative;isolation:isolate;background:radial-gradient(circle at 76% 16%,rgba(122,70,206,.16),transparent 30%),radial-gradient(circle at 18% 76%,rgba(67,184,177,.07),transparent 31%),linear-gradient(116deg,rgba(6,11,25,.995),rgba(9,12,28,.985) 50%,rgba(11,13,31,.995))!important}
          .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class>.npc-forge-workspace,.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class>.npc-forge-preview{background:transparent!important}
          .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class>.npc-forge-workspace{border-right:1px solid rgba(155,111,220,.16)}
          .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class .npc-forge-level-row>label,.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class .npc-forge-level-row>div{border:1px solid rgba(164,126,218,.18)!important;border-radius:9px!important;background:linear-gradient(145deg,rgba(34,24,50,.76),rgba(11,17,30,.84))!important;box-shadow:inset 0 1px rgba(255,255,255,.025)!important}
          .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class .npc-forge-class-catalog-row,.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class .npc-forge-class-family-row{border-color:rgba(151,118,201,.18)!important;border-radius:9px!important;background:linear-gradient(96deg,rgba(27,24,42,.94),rgba(11,17,30,.94))!important;box-shadow:inset 0 1px rgba(255,255,255,.018)!important}
          .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class .npc-forge-class-catalog-row:hover,.unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class .npc-forge-class-family-row:hover{border-color:rgba(168,108,255,.58)!important;background:linear-gradient(96deg,rgba(46,31,66,.96),rgba(12,20,33,.95))!important}
          .unified-player-character-forge .npc-forge-body.is-player-mode.npc-forge-step-class .npc-forge-class-catalog-row.is-active{border-color:rgba(180,126,255,.9)!important;background:linear-gradient(96deg,rgba(115,63,171,.28),rgba(23,39,48,.92))!important;box-shadow:inset 3px 0 #a86cff,0 0 24px rgba(126,72,199,.08)!important}
        }

        @media(max-width:900px){
          .npc-forge-class-feature-dock__head{cursor:default;touch-action:auto}
          .npc-forge-class-feature-dock__drag-cue{display:none}
          .npc-forge-class-feature-dock{position:static!important;width:100%!important;max-width:none!important;max-height:none!important;margin-top:8px!important;box-shadow:none!important}
        }
      `}</style>
    </section>
  );

  if (dismissed) return null;
  return portalHost ? createPortal(dock, portalHost) : dock;
}
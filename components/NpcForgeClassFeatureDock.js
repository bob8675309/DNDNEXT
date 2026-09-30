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
const DOCK_MAX_WIDTH = 780;
const DOCK_VISIBLE_HEADER = 60;

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizedSpellName(value) {
  return safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const DUNAMANCY_SPELL_NAMES = [
  "Sapping Sting",
  "Gift of Alacrity",
  "Magnify Gravity",
  "Fortune's Favor",
  "Immovable Object",
  "Wristpocket",
  "Pulse Wave",
  "Gravity Sinkhole",
  "Temporal Shunt",
  "Gravity Fissure",
  "Tether Essence",
  "Dark Star",
  "Reality Break",
  "Ravenous Void",
  "Time Ravage",
];

function playerFacingSubclassLore(value) {
  return safeText(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^[^|]+\|[^|]+\|\|[^|]+\|\|\d+$/.test(line))
    .filter((line) => !/this subclass has access to dunamancy spells/i.test(line))
    .join("\n\n");
}

function subclassHasDunamancyAccess(intro = null) {
  const sourceText = `${safeText(intro?.description)} ${JSON.stringify(intro?.entries || [])}`;
  return /dunamancy spells/i.test(sourceText);
}

function collectSpellTokens(value, unlockLabel = "", output = []) {
  if (typeof value === "string") {
    const pattern = /\{@spell\s+([^}|]+)(?:\|([^}|]+))?[^}]*\}/gi;
    let match = pattern.exec(value);
    while (match) {
      output.push({ name: safeText(match[1]), source: safeText(match[2]), unlockLabel: safeText(unlockLabel) });
      match = pattern.exec(value);
    }
    return output;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectSpellTokens(entry, unlockLabel, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value.rows)) {
    for (const row of value.rows) {
      const rowLabel = Array.isArray(row) ? safeText(row[0]) : unlockLabel;
      if (Array.isArray(row)) row.slice(1).forEach((cell) => collectSpellTokens(cell, rowLabel || unlockLabel, output));
      else collectSpellTokens(row, unlockLabel, output);
    }
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key === "rows") continue;
    collectSpellTokens(entry, unlockLabel, output);
  }
  return output;
}

function subclassSpellReferences(features = []) {
  const refs = [];
  for (const feature of features) {
    const name = safeText(feature?.name);
    const description = safeText(feature?.description);
    const grantLike = /\bspells?\b/i.test(name)
      || /(?:always have|learn|gain|know|prepare|prepared|added to)[^.!?]{0,90}\bspells?\b/i.test(description)
      || /\bspells?\b[^.!?]{0,90}(?:prepared|known|spell list)/i.test(description);
    if (!grantLike) continue;
    collectSpellTokens(feature?.entries, "", refs);
  }
  const seen = new Set();
  return refs.filter((ref) => {
    const key = normalizedSpellName(ref.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveSubclassSpells(refs = [], catalog = []) {
  const byName = new Map();
  for (const spell of catalog) {
    const key = normalizedSpellName(spell?.name);
    if (key && !byName.has(key)) byName.set(key, spell);
  }
  return refs.map((ref) => ({ ...(byName.get(normalizedSpellName(ref.name)) || {}), ...ref, name: ref.name }));
}

function progressionFeatureName(value) {
  if (typeof value === "string") return safeText(value.split("|")[0]);
  return safeText(value?.name || value?.label || value?.title);
}

function isGenericSubclassFeatureName(value) {
  const key = safeText(value).toLowerCase();
  return key === "subclass" || key === "subclass feature" || key.endsWith(" subclass feature");
}

function uniqueProgressionFeatures(features = []) {
  const seen = new Set();
  return features.filter((feature) => {
    const key = normalizedSpellName(feature?.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSubclassProgressionRows(rows = [], subclassFeatures = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const baseSource = Array.isArray(row?.guideFeatures) && row.guideFeatures.length
      ? row.guideFeatures.filter((feature) => feature?.type !== "subclass")
      : (Array.isArray(row?.features) ? row.features : []);
    const baseFeatures = uniqueProgressionFeatures(baseSource
      .map((feature) => typeof feature === "string"
        ? { name: progressionFeatureName(feature), type: "class", source: "", description: "" }
        : { ...feature, name: progressionFeatureName(feature), type: "class" })
      .filter((feature) => feature.name && !isGenericSubclassFeatureName(feature.name)));
    const subclassAtLevel = uniqueProgressionFeatures(subclassFeatures
      .filter((feature) => Number(feature?.level) === Number(row?.class_level))
      .map((feature) => ({ ...feature, name: safeText(feature?.name), type: "subclass" }))
      .filter((feature) => feature.name));
    return {
      level: Number(row?.class_level || 0),
      proficiencyBonus: Number(row?.proficiency_bonus || 2),
      baseFeatures,
      subclassFeatures: subclassAtLevel,
    };
  }).filter((row) => row.level > 0);
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

export default function NpcForgeClassFeatureDock({ detail = null, selectedClass = null, onFeatureDetail = null }) {
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
  const isSubclassInspector = Boolean(subclassOption);
  const spellCatalog = Array.isArray(detail?.spellCatalog) ? detail.spellCatalog : [];
  const subclassSpellRefs = subclassSpellReferences(subclassFeatures);
  const subclassSpells = resolveSubclassSpells(subclassSpellRefs, spellCatalog);
  const dunamancySpells = subclassHasDunamancyAccess(subclassIntro)
    ? resolveSubclassSpells(DUNAMANCY_SPELL_NAMES.map((name) => ({ name, source: "EGW", unlockLabel: "Dunamancy" })), spellCatalog)
    : [];
  const progressionRows = buildSubclassProgressionRows(detail?.progressionRows || [], subclassFeatures);
  const currentLevel = Math.max(1, Number(detail?.currentLevel || 1));
  const isOverview = !feature;
  const title = isSubclassInspector ? subclassOption.name : feature?.name || selectedClass?.class_name || "Class feature details";
  const description = feature?.description
    ? formatPlayerFacingText(feature.description)
    : formatPlayerFacingText(
      classPresentationSummary(selectedClass),
      selectedClass ? "Hover, focus, or select a class feature or subclass to inspect its deeper rules here." : "Feature descriptions will appear here as you move through the class guide.",
    );
  const source = isSubclassInspector
    ? safeText(subclassOption?.source || "Campaign")
    : feature || selectedClass ? safeText(feature?.source || selectedClass?.source || "Campaign") : "";
  const level = Number(feature?.level || 0);
  const isListedOption = feature?.type === "listed-option";
  const type = isSubclassInspector
    ? `${selectedClass?.class_name || "Class"} Subclass`
    : isListedOption ? "Listed Option" : feature?.type === "subclass" ? "Subclass Feature" : feature ? "Class Feature" : "Class Overview";
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
        const base = defaultDockPosition();
        setFloatingPosition(boundedDockPosition({
          ...base,
          width: isSubclassInspector ? 720 : DOCK_DEFAULT_WIDTH,
        }));
        setPortalHost(document.body);
      });
    }

    syncDockMode();
    desktop.addEventListener?.("change", syncDockMode);
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame);
      desktop.removeEventListener?.("change", syncDockMode);
    };
  }, [isSubclassInspector, selectedClass?.class_key, selectedClass?.id]);

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
    <section ref={dockRef} style={floatingStyle} className={`npc-forge-class-feature-dock${feature ? " has-feature" : " is-placeholder"}${isSubclassInspector ? " is-subclass-inspector" : ""}${portalHost ? " is-floating is-viewport-floating" : ""}${dragging ? " is-dragging" : ""}`}>
      <div className="npc-forge-class-feature-dock__head" onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd} title={portalHost ? "Drag to move this description window anywhere in the viewport" : undefined}>
        <div className="npc-forge-class-feature-dock__title-group">
          <span>{type}</span>
          <h3>{!isSubclassInspector && detail?.subclassName && feature?.type === "subclass" ? `${detail.subclassName}: ` : ""}{title}</h3>
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
            <div className="npc-forge-subclass-inspector__art-backdrop" aria-hidden="true">
              <img src={subclassArtworkFor(selectedClass?.class_key || "", subclassOption)} onError={(event) => handleSubclassArtworkError(event, selectedClass?.class_key || "")} alt="" />
            </div>
            <div className="npc-forge-subclass-inspector__content-layer">
            {subclassTab === "overview" ? <>
              <div className="npc-forge-subclass-inspector__identity">
                <div className="npc-forge-subclass-inspector__identity-heading">
                  <h4>{subclassOption.name}</h4>
                  <span>{selectedClass?.class_name || "Class"} subclass</span>
                </div>
                <section className="npc-forge-subclass-inspector__overview-lore" aria-label={`${subclassOption.name} lore`}>
                  <div className="npc-forge-subclass-inspector__overview-lore-scroll">
                    {subclassIntro?.description ? <ClassFeatureText text={playerFacingSubclassLore(subclassIntro.description)} compact /> : <p>No separate source-backed lore text is available for this subclass.</p>}
                  </div>
                </section>
              </div>
              <section className="npc-forge-subclass-inspector__progression is-overview-progression">
                <header>
                  <div><strong>Class + Subclass Progression</strong><small>{selectedClass?.class_name || "Class"} features use the base color; {subclassOption.name} additions are highlighted. Select a feature to open its Feature panel.</small></div>
                  <div className="npc-forge-subclass-inspector__progression-legend"><span>Class</span><span className="is-subclass">Subclass</span></div>
                </header>
                <div className="npc-forge-subclass-inspector__progression-table" role="table" aria-label={`${selectedClass?.class_name || "Class"} and ${subclassOption.name} progression`}>
                  <div className="npc-forge-subclass-inspector__progression-row is-head" role="row"><div>Level</div><div>PB</div><div>Features</div></div>
                  {progressionRows.length ? progressionRows.map((row) => <div key={row.level} className={`npc-forge-subclass-inspector__progression-row${row.level === currentLevel ? " is-current" : ""}`} role="row">
                    <div><strong>{row.level}</strong>{row.level === currentLevel ? <small>Current</small> : null}</div>
                    <div>+{row.proficiencyBonus}</div>
                    <div className="npc-forge-subclass-inspector__progression-features">
                      {row.baseFeatures.map((entry) => <button type="button" key={`base-${row.level}-${entry.name}`} onClick={() => onFeatureDetail?.({ type: "classFeature", feature: { ...entry, level: row.level } })}>{entry.name}</button>)}
                      {row.subclassFeatures.map((entry) => <button type="button" className="is-subclass" key={`subclass-${row.level}-${entry.name}`} onClick={() => onFeatureDetail?.({ type: "classFeature", feature: { ...entry, level: row.level }, subclassName: subclassOption.name })}>{entry.name}</button>)}
                      {!row.baseFeatures.length && !row.subclassFeatures.length ? <em>—</em> : null}
                    </div>
                  </div>) : <div className="npc-forge-subclass-inspector__empty-note"><span>No class progression rows are available for this source entry.</span></div>}
                </div>
              </section>
            </> : null}
            {subclassTab === "features" ? <div className="npc-forge-subclass-inspector__feature-list">
              {subclassFeatures.length ? subclassFeatures.map((entry) => <details key={`${entry.level}-${entry.name}`}><summary><span>Level {Number(entry.level || subclassOption.firstLevel || 1)}</span><strong>{entry.name}</strong></summary><ClassFeatureText text={entry.description} compact /></details>) : <p>No source-backed subclass features are available for this entry.</p>}
            </div> : null}
            {subclassTab === "lore" ? <div className="npc-forge-subclass-inspector__reading"><h4>{subclassOption.name}</h4>{subclassIntro?.description ? <ClassFeatureText text={playerFacingSubclassLore(subclassIntro.description)} compact /> : <p>No separate source-backed lore text is available for this subclass.</p>}</div> : null}
            {subclassTab === "spells" ? <div className="npc-forge-subclass-inspector__spells">
              {dunamancySpells.length ? <section className="npc-forge-subclass-inspector__spell-grants is-dunamancy">
                <div className="npc-forge-subclass-inspector__section-head"><span>Dunamancy Spells</span><small>Source-backed EGW spell access granted by this subclass</small></div>
                <div className="npc-forge-subclass-inspector__spell-cards">{dunamancySpells.map((spell) => <article key={`dunamancy-${spell.name}`}><div><strong>{spell.name}</strong><small>{Number(spell.level || 0) === 0 ? "Cantrip" : `Spell level ${Number(spell.level)}`}</small></div><span>{spell.school || "Spell"} • {spell.source || "EGW"}</span></article>)}</div>
              </section> : null}
              {subclassSpells.length ? <section className="npc-forge-subclass-inspector__spell-grants">
                <div className="npc-forge-subclass-inspector__section-head"><span>Subclass Spell Grants</span><small>Source-backed additions and always-prepared spells</small></div>
                <div className="npc-forge-subclass-inspector__spell-cards">{subclassSpells.map((spell) => <article key={`${spell.name}-${spell.unlockLabel}`}><div><strong>{spell.name}</strong><small>{spell.unlockLabel ? `Class level ${spell.unlockLabel}` : "Subclass spell"}</small></div><span>{Number.isFinite(Number(spell.level)) ? (Number(spell.level) === 0 ? "Cantrip" : `Spell ${Number(spell.level)}`) : "Spell"}{spell.school ? ` • ${spell.school}` : ""}</span></article>)}</div>
              </section> : null}
              {!dunamancySpells.length && !subclassSpells.length ? <div className="npc-forge-subclass-inspector__empty-note"><strong>No separate subclass spell list</strong><span>{subclassOption.name} does not grant a structured spell list in the imported source.</span></div> : null}
            </div> : null}
            </div>
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
        .npc-forge-class-feature-dock.is-subclass-inspector{border-color:rgba(213,163,74,.72)!important;background:linear-gradient(155deg,rgba(12,15,18,.99),rgba(7,14,18,.99) 62%,rgba(12,10,10,.99))!important;box-shadow:inset 0 0 0 1px rgba(255,219,151,.06),0 20px 58px rgba(0,0,0,.54),0 0 28px rgba(161,104,34,.10)!important}
        body > .npc-forge-class-feature-dock.is-viewport-floating.is-subclass-inspector{width:min(720px,calc(100vw - 36px))!important;max-width:min(720px,calc(100vw - 36px))!important}
        .npc-forge-class-feature-dock.is-subclass-inspector .npc-forge-class-feature-dock__head{min-height:42px!important;padding:6px 9px!important;justify-content:flex-end!important;border-bottom-color:rgba(213,163,74,.24)!important;background:linear-gradient(155deg,rgba(20,17,14,.995),rgba(8,15,18,.995))!important}
        .npc-forge-class-feature-dock.is-subclass-inspector .npc-forge-class-feature-dock__title-group{display:none!important}
        .npc-forge-class-feature-dock.is-subclass-inspector .npc-forge-class-feature-dock__head-actions>em{display:none!important}.npc-forge-class-feature-dock.is-subclass-inspector .npc-forge-class-feature-dock__head-actions>button{border-color:rgba(213,163,74,.42)!important;color:#ead6ad!important}
        .npc-forge-class-feature-dock__body.is-subclass-inspector{gap:0!important;padding:0!important;background:linear-gradient(160deg,rgba(7,13,18,.99),rgba(8,18,23,.985) 55%,rgba(10,12,18,.99))}
        .npc-forge-subclass-inspector__tabs{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid rgba(209,158,67,.48);background:rgba(5,10,14,.9)}
        .npc-forge-subclass-inspector__tabs button{min-height:44px;border:0;border-right:1px solid rgba(209,158,67,.28);border-radius:0;color:#d8c6a3;background:rgba(9,15,20,.72);font:700 .72rem/1 Georgia,serif;letter-spacing:.02em}
        .npc-forge-subclass-inspector__tabs button:last-child{border-right:0}.npc-forge-subclass-inspector__tabs button:hover{color:#ffe2a2;background:rgba(92,58,22,.22)}.npc-forge-subclass-inspector__tabs button.is-active{color:#1b1208;background:linear-gradient(#f2d29b,#c99755);box-shadow:inset 0 -2px rgba(100,54,16,.45)}
        .npc-forge-subclass-inspector__content{position:relative;min-height:350px;padding:22px;color:#eee5d4;overflow:hidden}.npc-forge-subclass-inspector__art-backdrop{position:absolute;z-index:0;top:0;right:0;bottom:0;width:86%;pointer-events:none;opacity:.25;-webkit-mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.22) 12%,rgba(0,0,0,.78) 44%,#000 100%);mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.22) 12%,rgba(0,0,0,.78) 44%,#000 100%)}.npc-forge-subclass-inspector__art-backdrop::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,13,18,.95) 0%,rgba(7,13,18,.38) 36%,rgba(7,13,18,.08) 72%,rgba(7,13,18,.18) 100%)}.npc-forge-subclass-inspector__art-backdrop img{width:100%;height:100%;object-fit:cover;object-position:center 28%;filter:saturate(.92) brightness(.98) contrast(1.04);transform:scale(1.18)}.npc-forge-subclass-inspector__content-layer{position:relative;z-index:1;min-height:306px}.npc-forge-subclass-inspector__identity{display:grid;gap:12px;align-content:start;margin-bottom:18px}.npc-forge-subclass-inspector__identity-heading{display:flex;align-items:baseline;gap:9px;min-width:0}.npc-forge-subclass-inspector__identity h4,.npc-forge-subclass-inspector__reading h4{margin:0;color:#f0c979;font:700 1.65rem/1.06 Georgia,serif}.npc-forge-subclass-inspector__identity-heading>span{color:rgba(205,166,95,.7);font-size:.53rem;font-weight:750;letter-spacing:.055em;text-transform:uppercase;white-space:nowrap}
        .npc-forge-subclass-inspector__content .class-feature-text,.npc-forge-subclass-inspector__content p{font-size:.82rem!important;line-height:1.68!important;color:rgba(244,239,226,.91)!important}.npc-forge-subclass-inspector__content .class-feature-text p+p{margin-top:.82rem!important}.npc-forge-subclass-inspector__overview-lore{width:min(76%,520px);height:250px;min-height:0;display:grid;margin:0;padding:13px 14px;border:1px solid rgba(209,158,67,.22);border-radius:7px;background:linear-gradient(180deg,rgba(8,15,19,.90),rgba(7,13,17,.84));box-shadow:inset 0 1px rgba(255,255,255,.025),0 10px 32px rgba(0,0,0,.16)}.npc-forge-subclass-inspector__section-head>span{color:#d7ac62;font-size:.62rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.npc-forge-subclass-inspector__overview-lore-scroll{min-height:0;overflow:auto;padding-right:7px;scrollbar-width:thin;scrollbar-color:rgba(209,158,67,.45) rgba(255,255,255,.04)}.npc-forge-subclass-inspector__overview-lore-scroll::-webkit-scrollbar{width:7px}.npc-forge-subclass-inspector__overview-lore-scroll::-webkit-scrollbar-track{background:rgba(255,255,255,.035);border-radius:999px}.npc-forge-subclass-inspector__overview-lore-scroll::-webkit-scrollbar-thumb{background:rgba(209,158,67,.42);border-radius:999px}.npc-forge-subclass-inspector__feature-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:9px;margin-top:18px;padding-top:15px;border-top:1px solid rgba(209,158,67,.25)}.npc-forge-subclass-inspector__feature-strip>div{display:grid;gap:6px;text-align:center}.npc-forge-subclass-inspector__feature-strip b{margin:auto;display:grid;place-items:center;width:34px;height:34px;border:1px solid rgba(225,173,76,.65);border-radius:50%;color:#f4cc79;background:radial-gradient(circle,rgba(121,72,23,.42),rgba(12,17,21,.92));font-size:.65rem}.npc-forge-subclass-inspector__feature-strip span{color:#e5d6bb;font-size:.61rem;line-height:1.3}
        .npc-forge-subclass-inspector__progression{display:grid;gap:11px}.npc-forge-subclass-inspector__progression>header{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;padding:0 2px 9px;border-bottom:1px solid rgba(209,158,67,.22)}.npc-forge-subclass-inspector__progression>header>div:first-child{display:grid;gap:3px}.npc-forge-subclass-inspector__progression>header strong{color:#f0cf8b;font:700 .86rem/1.2 Georgia,serif}.npc-forge-subclass-inspector__progression>header small{color:rgba(236,224,202,.58);font-size:.56rem;line-height:1.35}.npc-forge-subclass-inspector__progression-legend{display:flex;gap:6px;flex:0 0 auto}.npc-forge-subclass-inspector__progression-legend span,.npc-forge-subclass-inspector__progression-features button{appearance:none;display:inline-flex;align-items:center;width:max-content;max-width:100%;padding:3px 7px;border:1px solid rgba(174,132,222,.33);border-radius:999px;color:#eadfff;background:rgba(105,68,156,.20);font-family:inherit;font-size:.56rem;font-weight:650;line-height:1.25}.npc-forge-subclass-inspector__progression-legend span.is-subclass,.npc-forge-subclass-inspector__progression-features button.is-subclass{border-color:rgba(58,188,220,.58);color:#d9f8ff;background:rgba(28,128,151,.22)}.npc-forge-subclass-inspector__progression-table{max-height:370px;overflow:auto;border:1px solid rgba(209,158,67,.18);border-radius:8px;background:rgba(5,11,15,.62);scrollbar-width:thin;scrollbar-color:rgba(209,158,67,.42) rgba(255,255,255,.03)}.npc-forge-subclass-inspector__progression-row{display:grid;grid-template-columns:48px 44px minmax(0,1fr);gap:8px;align-items:start;min-height:36px;padding:7px 9px;border-bottom:1px solid rgba(255,255,255,.055)}.npc-forge-subclass-inspector__progression-row:last-child{border-bottom:0}.npc-forge-subclass-inspector__progression-row.is-head{position:sticky;top:0;z-index:2;min-height:30px;align-items:center;color:rgba(238,219,181,.66);background:rgba(12,17,21,.96);font-size:.52rem;font-weight:850;letter-spacing:.055em;text-transform:uppercase}.npc-forge-subclass-inspector__progression-row.is-current{box-shadow:inset 3px 0 #d2a44f;background:rgba(112,75,24,.09)}.npc-forge-subclass-inspector__progression-row>div:first-child{display:grid;gap:1px;color:#f1dcae}.npc-forge-subclass-inspector__progression-row>div:first-child>strong{font-size:.68rem}.npc-forge-subclass-inspector__progression-row>div:first-child>small{color:#d8ae60;font-size:.44rem;text-transform:uppercase}.npc-forge-subclass-inspector__progression-row>div:nth-child(2){padding-top:2px;color:rgba(239,226,203,.68);font-size:.6rem}.npc-forge-subclass-inspector__progression-features{display:flex;flex-wrap:wrap;gap:5px;min-width:0}.npc-forge-subclass-inspector__progression-features button{cursor:pointer;transition:border-color .14s ease,background .14s ease,transform .14s ease}.npc-forge-subclass-inspector__progression-features button:hover,.npc-forge-subclass-inspector__progression-features button:focus-visible{border-color:rgba(229,198,255,.74);background:rgba(126,78,186,.32);transform:translateY(-1px);outline:none}.npc-forge-subclass-inspector__progression-features button.is-subclass:hover,.npc-forge-subclass-inspector__progression-features button.is-subclass:focus-visible{border-color:rgba(91,220,246,.82);background:rgba(28,128,151,.34)}.npc-forge-subclass-inspector__progression-features em{color:rgba(255,255,255,.35);font-size:.62rem;font-style:normal}.npc-forge-subclass-inspector__progression.is-overview-progression{margin-top:18px;padding-top:14px;border-top:1px solid rgba(209,158,67,.24)}
        .npc-forge-subclass-inspector__feature-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.npc-forge-subclass-inspector__feature-list details{border:1px solid rgba(209,158,67,.24);border-radius:7px;background:rgba(12,18,22,.72);overflow:hidden;min-width:0}.npc-forge-subclass-inspector__feature-list details[open]{grid-column:1/-1}.npc-forge-subclass-inspector__feature-list summary{display:grid;grid-template-columns:76px minmax(0,1fr);gap:12px;align-items:center;padding:12px 14px;cursor:pointer;list-style:none}.npc-forge-subclass-inspector__feature-list summary::-webkit-details-marker{display:none}.npc-forge-subclass-inspector__feature-list summary span{color:#c69b53;font-size:.58rem;font-weight:800;text-transform:uppercase}.npc-forge-subclass-inspector__feature-list summary strong{color:#f1dfbd;font:700 .82rem/1.28 Georgia,serif}.npc-forge-subclass-inspector__feature-list details>.class-feature-text{padding:2px 14px 15px}.npc-forge-subclass-inspector__reading{display:grid;gap:11px}.npc-forge-subclass-inspector__reading .class-feature-text{padding:13px 14px;border:1px solid rgba(209,158,67,.18);border-radius:7px;background:rgba(10,17,21,.58)}
        .npc-forge-subclass-inspector__spells{display:grid;gap:18px}.npc-forge-subclass-inspector__spell-grants,.npc-forge-subclass-inspector__class-spells{display:grid;gap:10px}.npc-forge-subclass-inspector__section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding-bottom:8px;border-bottom:1px solid rgba(209,158,67,.22)}.npc-forge-subclass-inspector__section-head small{color:rgba(240,229,205,.58);font-size:.58rem;line-height:1.3;text-align:right}
        .npc-forge-subclass-inspector__spell-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.npc-forge-subclass-inspector__spell-cards article{display:grid;gap:7px;padding:10px 11px;border:1px solid rgba(209,158,67,.22);border-radius:7px;background:rgba(14,21,24,.72)}.npc-forge-subclass-inspector__spell-cards article>div{display:grid;gap:2px}.npc-forge-subclass-inspector__spell-cards strong{color:#f1dfbd;font-size:.74rem}.npc-forge-subclass-inspector__spell-cards small,.npc-forge-subclass-inspector__spell-cards article>span{color:rgba(229,213,184,.66);font-size:.56rem;line-height:1.35}
        .npc-forge-subclass-inspector__empty-note{display:grid;gap:4px;padding:11px 12px;border:1px solid rgba(209,158,67,.18);border-left:3px solid rgba(209,158,67,.55);border-radius:7px;background:rgba(80,54,22,.10)}.npc-forge-subclass-inspector__empty-note strong{color:#e5c47e;font-size:.7rem}.npc-forge-subclass-inspector__empty-note span{color:rgba(240,232,215,.74);font-size:.65rem;line-height:1.5}
        .npc-forge-subclass-inspector__class-spells>details{border:1px solid rgba(209,158,67,.18);border-radius:7px;background:rgba(9,16,20,.66);overflow:hidden}.npc-forge-subclass-inspector__class-spells>details>summary{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;cursor:pointer;list-style:none}.npc-forge-subclass-inspector__class-spells>details>summary::-webkit-details-marker{display:none}.npc-forge-subclass-inspector__class-spells>details>summary strong{color:#ead6af;font-size:.7rem}.npc-forge-subclass-inspector__class-spells>details>summary span{display:grid;place-items:center;min-width:24px;height:22px;padding:0 6px;border:1px solid rgba(209,158,67,.26);border-radius:999px;color:#d9b66f;font-size:.56rem}.npc-forge-subclass-inspector__spell-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:0 10px 11px}.npc-forge-subclass-inspector__spell-grid>div{display:grid;gap:2px;padding:7px 8px;border:1px solid rgba(255,255,255,.07);border-radius:6px;background:rgba(255,255,255,.025)}.npc-forge-subclass-inspector__spell-grid strong{color:#eee0c4;font-size:.64rem}.npc-forge-subclass-inspector__spell-grid small{color:rgba(234,221,196,.52);font-size:.52rem}

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
          .npc-forge-subclass-inspector__feature-list,.npc-forge-subclass-inspector__spell-cards{grid-template-columns:1fr}
          .npc-forge-subclass-inspector__art-backdrop{width:86%;opacity:.16}
          .npc-forge-subclass-inspector__overview-lore{width:100%}
          .npc-forge-subclass-inspector__progression>header{align-items:flex-start;flex-direction:column}
          .npc-forge-subclass-inspector__tabs{grid-template-columns:repeat(4,minmax(0,1fr))}
          .npc-forge-subclass-inspector__tabs button{font-size:.62rem}
        }
      `}</style>
    </section>
  );

  if (dismissed) return null;
  return portalHost ? createPortal(dock, portalHost) : dock;
}
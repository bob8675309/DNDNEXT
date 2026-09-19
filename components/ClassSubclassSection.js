import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { handleSubclassArtworkError, subclassArtworkFor } from "../utils/classes/subclassArtwork";

const text = (value) => String(value ?? "").trim();
const FRONT_CENTER_SLOT = 1;
const FACE_UP_RADIUS = 2;
const INTERACTIVE_RADIUS = 1;
const VISIBLE_RADIUS = 4;
const DRAG_THRESHOLD_PX = 6;
const FLICK_PROJECTION_MS = 150;

const ORBIT_VISUAL_PROFILE = [
  { x: 0, y: 55, yaw: 0, scale: 1.10, opacity: 1, z: 132, depthZ: 0 },
  { x: 16, y: 54, yaw: 8, scale: 0.96, opacity: 1, z: 122, depthZ: 0 },
  { x: 32, y: 50, yaw: 20, scale: 0.80, opacity: 0.72, z: 88, depthZ: 0 },
  { x: 40, y: 43, yaw: 48, scale: 0.64, opacity: 0.46, z: 54, depthZ: 24 },
  { x: 45, y: 34, yaw: 68, scale: 0.52, opacity: 0.25, z: 32, depthZ: 12 },
  { x: 48, y: 28, yaw: 82, scale: 0.44, opacity: 0, z: 20, depthZ: 0 },
];

function optionEntryLevel(option = {}) {
  return Math.max(1, Number(option?.firstLevel || 1));
}

function isCatalogReferenceLine(value = "") {
  const line = text(value);
  if (!line.includes("|")) return false;
  const parts = line.split("|").map((part) => text(part));
  if (parts.length < 4) return false;
  const hasLevel = parts.some((part) => /^\d{1,2}$/.test(part));
  const shortFields = parts.filter((part) => part.length <= 48).length;
  return hasLevel && shortFields >= Math.max(3, parts.length - 1);
}

function cleanSubclassSummaryText(value = "") {
  const lines = text(value)
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((line) => text(line))
    .filter((line) => line && !isCatalogReferenceLine(line))
    .map((line) => line
      .replace(/\{@\w+\s+([^}|]+)(?:\|[^}]*)?\}/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/[*_]{2,}/g, " ")
      .replace(/\s+/g, " ")
      .trim())
    .filter(Boolean);

  if (lines.length > 1 && lines[0].length <= 80 && !/[.!?:;—]$/.test(lines[0])) {
    lines[0] = `${lines[0]} —`;
  }

  return lines
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function subclassSummary(option = {}) {
  const features = Array.isArray(option?.features) ? option.features : [];
  const intro = features.find((feature) => feature?.isIntroduction && cleanSubclassSummaryText(feature?.description));
  const described = intro || features.find((feature) => cleanSubclassSummaryText(feature?.description));
  const raw = cleanSubclassSummaryText(described?.description);
  if (!raw) return "Explore this subclass path, its defining features, and the role it can play in your character's story.";
  if (raw.length <= 330) return raw;
  const clipped = raw.slice(0, 327).replace(/\s+\S*$/, "").trim();
  return `${clipped || raw.slice(0, 327).trim()}…`;
}

function classLabelFor(classKey = "", fallback = "") {
  const direct = text(fallback);
  if (direct) return direct;
  const normalized = text(classKey).replace(/[-_]+/g, " ").trim();
  if (!normalized) return "Class";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeOrbitOffset(value, total) {
  const count = Math.max(1, Number(total || 1));
  return ((Number(value || 0) % count) + count) % count;
}

function signedOrbitSlots(value, total) {
  const count = Math.max(1, Number(total || 1));
  let wrapped = normalizeOrbitOffset(value, count);
  if (wrapped > count / 2) wrapped -= count;
  return wrapped;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function orbitVisualProfile(distance) {
  const bounded = clamp(Number(distance || 0), 0, ORBIT_VISUAL_PROFILE.length - 1);
  const lowerIndex = Math.floor(bounded);
  const upperIndex = Math.min(ORBIT_VISUAL_PROFILE.length - 1, Math.ceil(bounded));
  const lower = ORBIT_VISUAL_PROFILE[lowerIndex];
  const upper = ORBIT_VISUAL_PROFILE[upperIndex];
  const mix = bounded - lowerIndex;
  const lerp = (from, to) => from + ((to - from) * mix);

  return {
    x: lerp(lower.x, upper.x),
    y: lerp(lower.y, upper.y),
    yaw: lerp(lower.yaw, upper.yaw),
    scale: lerp(lower.scale, upper.scale),
    opacity: lerp(lower.opacity, upper.opacity),
    z: Math.round(lerp(lower.z, upper.z)),
    depthZ: Math.round(lerp(lower.depthZ, upper.depthZ)),
  };
}

function orbitPlacement(optionIndex, orbitOffset, total) {
  const count = Math.max(1, Number(total || 1));
  const frontCenter = orbitOffset + FRONT_CENTER_SLOT;
  const signedSlots = signedOrbitSlots(optionIndex - frontCenter, count);
  const snappedCenterIndex = Math.round(normalizeOrbitOffset(frontCenter, count)) % count;
  const snappedSlots = signedOrbitSlots(optionIndex - snappedCenterIndex, count);
  const snappedDistance = Math.abs(snappedSlots);
  const isFront = count <= 3 || snappedDistance <= INTERACTIVE_RADIUS;
  const showsFrontFace = count <= 5 || snappedDistance <= FACE_UP_RADIUS;
  const isVisible = count <= 9 || snappedDistance <= VISIBLE_RADIUS;

  const absSlots = Math.abs(signedSlots);
  const direction = signedSlots === 0 ? 0 : Math.sign(signedSlots);
  const visual = orbitVisualProfile(absSlots);
  const x = 50 + (direction * visual.x);
  const yaw = direction * visual.yaw;

  return {
    signedSlots,
    depth: 1 - clamp(absSlots / (VISIBLE_RADIUS + 1), 0, 1),
    isFront,
    showsFrontFace,
    isVisible,
    style: {
      "--orbit-x": `${x.toFixed(3)}%`,
      "--orbit-y": `${visual.y.toFixed(3)}%`,
      "--orbit-yaw": `${yaw.toFixed(2)}deg`,
      "--orbit-back-yaw": `${(-yaw).toFixed(2)}deg`,
      "--orbit-scale": visual.scale.toFixed(4),
      "--orbit-opacity": (isVisible ? visual.opacity : 0).toFixed(3),
      "--orbit-z": String(isVisible ? visual.z : 0),
      "--orbit-depth-z": `${visual.depthZ}px`,
    },
  };
}

function pixelsPerCardFor(width, total) {
  const count = Math.max(1, Number(total || 1));
  const visibleSpan = clamp(count, 5, 8);
  return clamp(Number(width || 900) / visibleSpan, 92, 178);
}

export default function ClassSubclassSection({
  model,
  classKey = "",
  onInspectSubclass = null,
  detailed = false,
}) {
  const options = model?.options || [];
  const selected = model?.selected || null;
  const currentLevel = Math.max(1, Number(model?.currentLevel || 1));
  const entryLevel = Math.max(1, Number(model?.entryLevel || options[0]?.firstLevel || 1));
  const required = (model?.eligible || []).length > 0;
  const optionSignature = options.map((option) => option.key).join("|");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [orbitOffset, setOrbitOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOrbitSettled, setIsOrbitSettled] = useState(true);
  const [inspectedKey, setInspectedKey] = useState("");
  const autoOpenedForRef = useRef("");
  const lastClassKeyRef = useRef(classKey);
  const orbitRef = useRef(null);
  const dragStateRef = useRef(null);
  const suppressClickUntilRef = useRef(0);
  const settleTimerRef = useRef(null);

  const orbitOptions = useMemo(() => options.map((option, optionIndex) => ({
    option,
    optionIndex,
    ...orbitPlacement(optionIndex, orbitOffset, options.length),
  })), [orbitOffset, options]);

  const browsedIndex = options.length
    ? Math.round(normalizeOrbitOffset(orbitOffset + FRONT_CENTER_SLOT, options.length)) % options.length
    : 0;
  const inspectedOption = options.find((option) => option.key === inspectedKey) || null;
  const inspectedSummary = useMemo(
    () => inspectedOption
      ? subclassSummary(inspectedOption)
      : "Click any of the three front cards to inspect that path. Dragging the carousel will not change your choice.",
    [inspectedOption],
  );
  const classLabel = classLabelFor(classKey, model?.className);

  useEffect(() => {
    if (lastClassKeyRef.current !== classKey) {
      lastClassKeyRef.current = classKey;
      autoOpenedForRef.current = "";
      setSelectorOpen(false);
    }
    setOrbitOffset(0);
    setIsOrbitSettled(true);
    setInspectedKey("");
  }, [classKey, optionSignature]);

  useEffect(() => {
    if (!options.length || selected || currentLevel < entryLevel) return;
    const autoOpenKey = `${classKey}:${entryLevel}:${optionSignature}`;
    if (autoOpenedForRef.current === autoOpenKey) return;
    autoOpenedForRef.current = autoOpenKey;
    setSelectorOpen(true);
  }, [classKey, currentLevel, entryLevel, optionSignature, options.length, selected]);

  useEffect(() => {
    if (!selectorOpen || !selected || !options.length) return;
    const selectedIndex = options.findIndex((option) => option.key === selected.key);
    if (selectedIndex < 0) return;
    setOrbitOffset(normalizeOrbitOffset(selectedIndex - FRONT_CENTER_SLOT, options.length));
    setInspectedKey(selected.key);
  }, [selectorOpen, optionSignature]);

  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

  useEffect(() => {
    if (!selectorOpen || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectorOpen(false);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        rotateCarousel(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        rotateCarousel(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectorOpen, options.length]);

  if (!options.length) {
    return (
      <section className={`npc-forge-class-guide__subclasses is-compact class-subclass-section is-empty${detailed ? " is-detailed" : ""}`}>
        <div className="npc-forge-class-guide__subhead">
          <div><span>Subclass</span><strong>No subclasses listed</strong></div>
        </div>
      </section>
    );
  }

  function clearSelection() {
    model.selectSubclass(null);
    setInspectedKey("");
    setSelectorOpen(true);
  }

  function scheduleOrbitSettled() {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      setIsOrbitSettled(true);
      settleTimerRef.current = null;
    }, 520);
  }

  function rotateCarousel(direction) {
    if (options.length <= 1) return;
    const normalizedDirection = direction < 0 ? -1 : 1;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    setIsOrbitSettled(false);
    setOrbitOffset((current) => normalizeOrbitOffset(Math.round(current) + normalizedDirection, options.length));
    scheduleOrbitSettled();
  }

  function showInspectedDetails() {
    if (!inspectedOption) return;
    model?.setPreviewKey?.(inspectedOption.key);
    onInspectSubclass?.(inspectedOption);
  }

  function handleOrbitPointerDown(event) {
    if (options.length <= 1) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    setIsOrbitSettled(false);
    const bounds = orbitRef.current?.getBoundingClientRect();
    const now = Number(event.timeStamp || performance.now());
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startOffset: orbitOffset,
      currentOffset: orbitOffset,
      lastX: event.clientX,
      lastAt: now,
      velocityX: 0,
      pixelsPerCard: pixelsPerCardFor(bounds?.width, options.length),
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleOrbitPointerMove(event) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;

    drag.moved = true;
    setIsDragging(true);
    event.preventDefault();

    const nextOffset = normalizeOrbitOffset(
      drag.startOffset - (deltaX / drag.pixelsPerCard),
      options.length,
    );
    const now = Number(event.timeStamp || performance.now());
    const elapsed = Math.max(1, now - drag.lastAt);
    drag.velocityX = (event.clientX - drag.lastX) / elapsed;
    drag.lastX = event.clientX;
    drag.lastAt = now;
    drag.currentOffset = nextOffset;
    setOrbitOffset(nextOffset);
  }

  function finishOrbitPointer(event, cancelled = false) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }

    if (drag.moved) {
      const offsetVelocity = -(drag.velocityX / drag.pixelsPerCard);
      const projectedCards = cancelled
        ? 0
        : clamp(offsetVelocity * FLICK_PROJECTION_MS, -1.75, 1.75);
      setOrbitOffset(normalizeOrbitOffset(
        Math.round(drag.currentOffset + projectedCards),
        options.length,
      ));
      suppressClickUntilRef.current = Date.now() + 240;
      scheduleOrbitSettled();
    } else {
      setIsOrbitSettled(true);
    }

    dragStateRef.current = null;
    setIsDragging(false);
  }

  function handleCardClick(event, option, isFront) {
    if (!isFront || Date.now() < suppressClickUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    setInspectedKey(option.key);
    model?.setPreviewKey?.(option.key);
    onInspectSubclass?.(option);

    if (optionEntryLevel(option) <= currentLevel) {
      model.selectSubclass(option);
    }
  }

  const selectorModal = selectorOpen && typeof document !== "undefined"
    ? createPortal(
      <div
        className="class-subclass-carousel-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Choose a ${classLabel} subclass`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectorOpen(false);
        }}
      >
        <div className="class-subclass-carousel-modal__panel">
          <div className="class-subclass-carousel-modal__scene" aria-hidden="true" />
          <div className="class-subclass-carousel-modal__ambient-smoke" aria-hidden="true" />

          <header className="class-subclass-carousel-modal__head">
            <div>
              <span>Subclass Path</span>
              <h3>Choose your subclass</h3>
              <p>Step onto a greater path. Each card reveals a different destiny.</p>
            </div>
            <button type="button" className="class-subclass-carousel-modal__close" onClick={() => setSelectorOpen(false)} aria-label="Close subclass selector">×</button>
          </header>

          <div className="class-subclass-carousel-modal__stage">
            <div className="class-subclass-carousel-modal__table" aria-hidden="true" />
            <div className="class-subclass-carousel-modal__smoke-back" aria-hidden="true" />

            <button type="button" className="class-subclass-carousel-modal__nav is-prev" onClick={() => rotateCarousel(-1)} aria-label="Previous subclass" disabled={options.length <= 1}>‹</button>

            <div
              ref={orbitRef}
              className={`class-subclass-carousel-modal__orbit${isDragging ? " is-dragging" : ""}`}
              role="list"
              aria-label="Subclass catalogue. Drag to spin the carousel."
              onPointerDown={handleOrbitPointerDown}
              onPointerMove={handleOrbitPointerMove}
              onPointerUp={(event) => finishOrbitPointer(event)}
              onPointerCancel={(event) => finishOrbitPointer(event, true)}
            >
              {orbitOptions.map(({ option, optionIndex, signedSlots, depth, isFront, showsFrontFace, isVisible, style }) => {
                const isSelected = selected?.key === option.key;
                const isInspected = inspectedKey === option.key;
                const eligible = optionEntryLevel(option) <= currentLevel;
                const isRestingCenter = isOrbitSettled && !isDragging && Math.abs(signedSlots) < 0.001;
                const inspectionScale = isInspected && showsFrontFace ? 1.065 : 1;
                const cardStyle = {
                  ...style,
                  "--orbit-scale": (Number(style["--orbit-scale"]) * inspectionScale).toFixed(4),
                  "--inspection-scale": inspectionScale.toFixed(3),
                  "--orbit-z": String(Number(style["--orbit-z"]) + (isInspected && showsFrontFace ? 14 : 0)),
                };
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="listitem"
                    className={`class-subclass-carousel-card${isRestingCenter ? " is-resting-center" : ""}${isInspected ? " is-inspected" : ""}${isSelected ? " is-selected" : ""}${isFront ? " is-orbit-front" : showsFrontFace ? " is-orbit-edge" : " is-orbit-back"}${showsFrontFace ? " is-orbit-face-up" : ""}${isVisible ? "" : " is-orbit-hidden"}${eligible ? " is-eligible" : " is-locked"}`}
                    style={cardStyle}
                    aria-pressed={isSelected}
                    aria-hidden={isFront ? undefined : "true"}
                    tabIndex={isFront ? 0 : -1}
                    aria-posinset={optionIndex + 1}
                    aria-setsize={options.length}
                    aria-label={`${option.name}, ${eligible ? "click to select" : `available at level ${optionEntryLevel(option)}`}`}
                    data-orbit-distance={Math.abs(signedSlots).toFixed(3)}
                    data-orbit-depth={depth.toFixed(3)}
                    onClick={(event) => handleCardClick(event, option, isFront)}
                  >
                    <span className="class-subclass-carousel-card__surface">
                      <span className="class-subclass-carousel-card__face is-front">
                        <span className="class-subclass-carousel-card__art" aria-hidden="true">
                          <img
                            src={subclassArtworkFor(classKey, option)}
                            onError={(event) => handleSubclassArtworkError(event, classKey)}
                            alt=""
                            width={840}
                            height={1440}
                            draggable="false"
                            decoding="async"
                          />
                        </span>
                        <span className="class-subclass-carousel-card__shade" aria-hidden="true" />
                        {isSelected ? (
                          <span className="class-subclass-carousel-card__copy">
                            <small>Selected</small>
                          </span>
                        ) : null}
                      </span>
                      <span className="class-subclass-carousel-card__face is-back" aria-hidden="true">
                        <span className="class-subclass-carousel-card__back-rune">✦</span>
                        <span className="class-subclass-carousel-card__back-title">DNDNEXT</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="class-subclass-carousel-modal__smoke-front" aria-hidden="true" />

            <button type="button" className="class-subclass-carousel-modal__nav is-next" onClick={() => rotateCarousel(1)} aria-label="Next subclass" disabled={options.length <= 1}>›</button>

            <div className="class-subclass-carousel-modal__position" aria-live="polite">
              <span>{browsedIndex + 1}</span><b>/</b><span>{options.length}</span>
            </div>
            <div className="class-subclass-carousel-modal__hint">Drag to browse · Click any of the three front cards</div>
          </div>

          <section className="class-subclass-carousel-modal__details" aria-live="polite">
            <div className="class-subclass-carousel-modal__details-icon" aria-hidden="true"><span>✦</span></div>
            <div className="class-subclass-carousel-modal__details-copy">
              <span>{classLabel} Subclass</span>
              <h4>{inspectedOption?.name || "Choose a card"}</h4>
              <p>{inspectedSummary}</p>
              {inspectedOption && optionEntryLevel(inspectedOption) > currentLevel ? <small>Available at level {optionEntryLevel(inspectedOption)}</small> : null}
              {selected?.key === inspectedOption?.key ? <small className="is-selected-note">Currently selected</small> : null}
            </div>
            <button type="button" className="class-subclass-carousel-modal__details-button" onClick={showInspectedDetails} disabled={!inspectedOption}>
              <span>View Details</span><b aria-hidden="true">→</b>
            </button>
          </section>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <section className={`npc-forge-class-guide__subclasses is-compact class-subclass-section is-card-launcher${detailed ? " is-detailed" : ""}${required && !selected ? " is-required" : ""}`}>
        {selected ? (
          <div className="class-subclass-selected-card-shell">
            <button
              type="button"
              className="class-subclass-selected-card"
              onClick={() => onInspectSubclass?.(selected)}
              onDoubleClick={() => setSelectorOpen(true)}
              aria-label={`Show ${selected.name} details. Double click to change subclass.`}
            >
              <span className="class-subclass-selected-card__art" aria-hidden="true">
                <img src={subclassArtworkFor(classKey, selected)} onError={(event) => handleSubclassArtworkError(event, classKey)} alt="" />
              </span>
              <span className="class-subclass-selected-card__shade" aria-hidden="true" />
              <span className="class-subclass-selected-card__copy">
                <span>Selected subclass</span>
                <strong>{selected.name}</strong>
                <small>Double-click to reopen the subclass gallery</small>
              </span>
            </button>
            <div className="class-subclass-selected-card-shell__actions">
              <button type="button" onClick={() => setSelectorOpen(true)}>Change Subclass</button>
              <button type="button" className="is-muted" onClick={clearSelection}>Clear</button>
            </div>
          </div>
        ) : (
          <button type="button" className="class-subclass-launcher" onClick={() => setSelectorOpen(true)}>
            <span className="class-subclass-launcher__icon" aria-hidden="true">✦</span>
            <span>
              <strong>{currentLevel >= entryLevel ? "Choose your subclass" : `Subclass unlocks at level ${entryLevel}`}</strong>
              <small>{currentLevel >= entryLevel ? "Open the subclass gallery" : "Preview the paths available to this class"}</small>
            </span>
            <b aria-hidden="true">›</b>
          </button>
        )}
        <span className="visually-hidden">{required && !selected ? "Choose an eligible subclass before continuing." : `Subclass selection unlocks at level ${entryLevel}.`}</span>
      </section>

      {selectorModal}
    </>
  );
}

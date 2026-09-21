import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { handleSubclassArtworkError, subclassArtworkFor } from "../utils/classes/subclassArtwork";

const text = (value) => String(value ?? "").trim();
const FRONT_CENTER_SLOT = 1;
const FACE_UP_ARC_DEGREES = 72;
const DRAG_THRESHOLD_PX = 6;
const FLICK_PROJECTION_MS = 180;

function optionEntryLevel(option = {}) {
  return Math.max(1, Number(option?.firstLevel || 1));
}

function subclassSummary(option = {}) {
  const features = Array.isArray(option?.features) ? option.features : [];
  const intro = features.find((feature) => feature?.isIntroduction && text(feature?.description));
  const described = intro || features.find((feature) => text(feature?.description));
  const raw = text(described?.description).replace(/\s+/g, " ");
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

function orbitProfileFor(total) {
  const count = Math.max(1, Number(total || 1));
  const density = clamp((count - 4) / 10, 0, 1);

  // One ring, mildly expanding with catalogue size. Small classes remain
  // centered on the same table; large classes use more of its perimeter.
  const horizontalRadius = 31 + (density * 6.5);
  const verticalRadius = 22 + (density * 2.5);
  const verticalCenter = 52.5;

  // Keep the physical render size large enough for the native 840x1440 Tarot
  // art, but ease very large catalogues down slightly to preserve breathing room.
  const maxWidth = count <= 4 ? 300
    : count <= 6 ? 292
      : count <= 8 ? 282
        : count <= 10 ? 270
          : count <= 12 ? 258
            : 248;

  const minWidth = Math.round(maxWidth * 0.68);
  const viewportWidth = count <= 4 ? 16.4
    : count <= 6 ? 15.9
      : count <= 8 ? 15.2
        : count <= 10 ? 14.6
          : count <= 12 ? 14.0
            : 13.5;

  return {
    horizontalRadius,
    verticalRadius,
    verticalCenter,
    minWidth,
    viewportWidth,
    maxWidth,
    heroMinWidth: Math.round(minWidth * 1.055),
    heroViewportWidth: viewportWidth * 1.055,
    heroMaxWidth: Math.round(maxWidth * 1.055),
  };
}

function orbitPlacement(optionIndex, orbitOffset, total) {
  const count = Math.max(1, Number(total || 1));
  const frontCenter = orbitOffset + FRONT_CENTER_SLOT;
  const signedSlots = signedOrbitSlots(optionIndex - frontCenter, count);
  const angleStep = 360 / count;
  const angleDegrees = signedSlots * angleStep;
  const absoluteAngle = Math.abs(angleDegrees);
  const angle = (angleDegrees * Math.PI) / 180;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const depth = (cosine + 1) / 2;
  const profile = orbitProfileFor(count);

  const isCenter = Math.abs(signedSlots) <= 0.015;
  const isFaceUp = count === 1 || absoluteAngle <= FACE_UP_ARC_DEGREES + 0.01;
  const isInteractive = isFaceUp;

  // Yaw follows the perimeter rather than fixed slot rules. Rear cards keep a
  // broad readable silhouette; the surface itself flips to the ornate card back.
  const yaw = clamp(angleDegrees * 0.5, -68, 68);

  const x = 50 + (sine * profile.horizontalRadius);
  const y = profile.verticalCenter + (cosine * profile.verticalRadius);

  // Depth is continuous for every catalogue size. Only the exact front card is
  // the hero; every other card remains seated at its natural point on the ring.
  const scale = isCenter ? 1 : 0.56 + (depth * 0.40);
  const opacity = isCenter ? 0.985 : 0.22 + (depth * 0.73);
  const zIndex = 30 + Math.round(depth * 96) + (isCenter ? 16 : 0);

  return {
    signedSlots,
    angleDegrees,
    depth,
    isCenter,
    isFaceUp,
    isInteractive,
    style: {
      "--orbit-x": `${x.toFixed(3)}%`,
      "--orbit-y": `${y.toFixed(3)}%`,
      "--orbit-yaw": `${yaw.toFixed(2)}deg`,
      "--orbit-scale": scale.toFixed(4),
      "--orbit-opacity": opacity.toFixed(3),
      "--orbit-z": String(zIndex),
      "--orbit-depth-z": "0px",
      "--orbit-card-min": `${profile.minWidth}px`,
      "--orbit-card-vw": `${profile.viewportWidth.toFixed(2)}vw`,
      "--orbit-card-max": `${profile.maxWidth}px`,
      "--orbit-hero-min": `${profile.heroMinWidth}px`,
      "--orbit-hero-vw": `${profile.heroViewportWidth.toFixed(2)}vw`,
      "--orbit-hero-max": `${profile.heroMaxWidth}px`,
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
  const [inspectedKey, setInspectedKey] = useState("");
  const autoOpenedForRef = useRef("");
  const lastClassKeyRef = useRef(classKey);
  const orbitRef = useRef(null);
  const dragStateRef = useRef(null);
  const suppressClickUntilRef = useRef(0);

  const orbitOptions = useMemo(() => options.map((option, optionIndex) => ({
    option,
    optionIndex,
    ...orbitPlacement(optionIndex, orbitOffset, options.length),
  })), [orbitOffset, options]);

  const browsedIndex = options.length
    ? Math.round(normalizeOrbitOffset(orbitOffset + FRONT_CENTER_SLOT, options.length)) % options.length
    : 0;
  const inspectedOption = options.find((option) => option.key === inspectedKey) || null;
  const inspectedSummary = useMemo(() => subclassSummary(inspectedOption), [inspectedOption]);
  const classLabel = classLabelFor(classKey, model?.className);

  useEffect(() => {
    if (lastClassKeyRef.current !== classKey) {
      lastClassKeyRef.current = classKey;
      autoOpenedForRef.current = "";
      setSelectorOpen(false);
    }
    setOrbitOffset(0);
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
  }, [selectorOpen, selected?.key, optionSignature]);

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

  function rotateCarousel(direction) {
    if (options.length <= 1) return;
    const normalizedDirection = direction < 0 ? -1 : 1;
    setOrbitOffset((current) => normalizeOrbitOffset(Math.round(current) + normalizedDirection, options.length));
  }

  function showInspectedDetails() {
    if (!inspectedOption) return;
    model?.setPreviewKey?.(inspectedOption.key);
    onInspectSubclass?.(inspectedOption);
  }

  function handleOrbitPointerDown(event) {
    if (options.length <= 1) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
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
  }

  function handleOrbitPointerMove(event) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;

    drag.moved = true;
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
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
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
    } catch {
      // Pointer capture may already be released by the browser.
    }

    if (drag.moved) {
      const offsetVelocity = -(drag.velocityX / drag.pixelsPerCard);
      const projectedCards = cancelled
        ? 0
        : clamp(offsetVelocity * FLICK_PROJECTION_MS, -2.25, 2.25);
      setOrbitOffset(normalizeOrbitOffset(
        Math.round(drag.currentOffset + projectedCards),
        options.length,
      ));
      suppressClickUntilRef.current = Date.now() + 240;
    }

    dragStateRef.current = null;
    setIsDragging(false);
  }

  function handleCardClick(event, option, optionIndex, isInteractive) {
    if (!isInteractive || Date.now() < suppressClickUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Clicking a visible front-half card rotates that exact card to the single
    // hero position. Selection/inspection remain explicit user actions.
    setOrbitOffset(normalizeOrbitOffset(optionIndex - FRONT_CENTER_SLOT, options.length));
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
              {orbitOptions.map(({ option, optionIndex, signedSlots, angleDegrees, depth, isInteractive, isFaceUp, isCenter, style }) => {
                const isSelected = selected?.key === option.key;
                const isInspected = inspectedOption?.key === option.key;
                const eligible = optionEntryLevel(option) <= currentLevel;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="listitem"
                    className={`class-subclass-carousel-card${isCenter ? " is-orbit-center" : ""}${isInspected ? " is-inspected" : ""}${isSelected ? " is-selected" : ""}${isInteractive ? " is-orbit-front" : " is-orbit-back"}${isFaceUp ? " is-orbit-face-up" : ""}${eligible ? " is-eligible" : " is-locked"}`}
                    style={style}
                    aria-pressed={isSelected}
                    aria-hidden={isInteractive ? undefined : "true"}
                    tabIndex={isInteractive ? 0 : -1}
                    aria-posinset={optionIndex + 1}
                    aria-setsize={options.length}
                    aria-label={`${option.name}, ${eligible ? "click to rotate to the hero position and select" : `available at level ${optionEntryLevel(option)}`}`}
                    data-orbit-distance={Math.abs(signedSlots).toFixed(3)}
                    data-orbit-angle={angleDegrees.toFixed(3)}
                    data-orbit-depth={depth.toFixed(3)}
                    onClick={(event) => handleCardClick(event, option, optionIndex, isInteractive)}
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
                        {null}
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

            <button type="button" className="class-subclass-carousel-modal__nav is-next" onClick={() => rotateCarousel(1)} aria-label="Next subclass" disabled={options.length <= 1}>›</button>

            <div className="class-subclass-carousel-modal__position" aria-live="polite">
              <span>{browsedIndex + 1}</span><b>/</b><span>{options.length}</span>
            </div>
            <div className="class-subclass-carousel-modal__hint">Drag the table, use the arrows, or click a face-up card to bring it to the hero position.</div>
          </div>

          {inspectedOption ? (
            <section className="class-subclass-carousel-modal__details" aria-live="polite">
              <div className="class-subclass-carousel-modal__details-icon" aria-hidden="true"><span>✦</span></div>
              <div className="class-subclass-carousel-modal__details-copy">
                <span>{classLabel} Subclass</span>
                <h4>{inspectedOption.name}</h4>
                <p>{inspectedSummary}</p>
                {optionEntryLevel(inspectedOption) > currentLevel ? <small>Available at level {optionEntryLevel(inspectedOption)}</small> : null}
                {selected && selected.key === inspectedOption.key ? <small className="is-selected-note">Currently selected</small> : null}
              </div>
              <button type="button" className="class-subclass-carousel-modal__details-button" onClick={showInspectedDetails}>
                <span>View Details</span><b aria-hidden="true">→</b>
              </button>
            </section>
          ) : null}
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

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { handleSubclassArtworkError, subclassArtworkFor } from "../utils/classes/subclassArtwork";

const text = (value) => String(value ?? "").trim();
const FRONT_CENTER_SLOT = 0;
const DRAG_THRESHOLD_PX = 7;
const FLICK_PROJECTION_MS = 185;

function optionEntryLevel(option = {}) {
  return Math.max(1, Number(option?.firstLevel || 1));
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

function faceUpArcDegreesFor(total) {
  const count = Math.max(1, Number(total || 1));
  if (count <= 4) return 112;
  if (count <= 6) return 102;
  if (count <= 8) return 92;
  if (count <= 10) return 84;
  if (count <= 12) return 76;
  return 68;
}

function orbitProfileFor(total) {
  const count = Math.max(1, Number(total || 1));
  const density = clamp((count - 4) / 10, 0, 1);

  // One physical ellipse follows the visible runic table. Larger catalogues use
  // slightly more of the rim but never switch to a second carousel geometry.
  const horizontalRadius = 36.5 + (density * 4.5);
  const verticalRadius = 17.4 + (density * 1.2);
  const verticalCenter = 61.4;

  // Non-hero cards stay intentionally smaller so dense catalogues can bend
  // around the table without rendering every 840x1440 Tarot front at hero size.
  const maxWidth = count <= 4 ? 224
    : count <= 6 ? 210
      : count <= 8 ? 198
        : count <= 10 ? 186
          : count <= 12 ? 176
            : 164;

  const minWidth = Math.round(maxWidth * 0.72);
  const viewportWidth = count <= 4 ? 12.6
    : count <= 6 ? 11.8
      : count <= 8 ? 11.1
        : count <= 10 ? 10.5
          : count <= 12 ? 9.9
            : 9.3;

  return {
    horizontalRadius,
    verticalRadius,
    verticalCenter,
    minWidth,
    viewportWidth,
    maxWidth,
    heroMinWidth: 220,
    heroViewportWidth: 17.2,
    heroMaxWidth: 306,
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
  const faceUpArcDegrees = faceUpArcDegreesFor(count);
  const isFaceUp = count === 1 || absoluteAngle <= faceUpArcDegrees + 0.01;
  const isInteractive = isFaceUp;

  // Yaw follows the ring tangent so the cards visibly bend around the table.
  // Rear cards keep the same geometry but their surface flips to the common back.
  const yaw = clamp(angleDegrees * 0.58, -70, 70);
  const x = 50 + (sine * profile.horizontalRadius);
  const y = profile.verticalCenter + (cosine * profile.verticalRadius);

  const scale = isCenter ? 1 : 0.46 + (depth * 0.48);
  const opacity = isCenter ? 1 : 0.40 + (depth * 0.58);
  const zIndex = 40 + Math.round(depth * 120) + (isCenter ? 32 : 0);

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
  return clamp(Number(width || 900) / visibleSpan, 96, 184);
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

  const heroIndex = options.length
    ? Math.round(normalizeOrbitOffset(orbitOffset + FRONT_CENTER_SLOT, options.length)) % options.length
    : 0;
  const heroOption = options[heroIndex] || null;
  const classLabel = classLabelFor(classKey, model?.className);

  useEffect(() => {
    if (lastClassKeyRef.current !== classKey) {
      lastClassKeyRef.current = classKey;
      autoOpenedForRef.current = "";
      setSelectorOpen(false);
    }
    setOrbitOffset(0);
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
  }, [selectorOpen, selected?.key, optionSignature, options.length]);

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
    setSelectorOpen(true);
  }

  function rotateCarousel(direction) {
    if (options.length <= 1) return;
    const normalizedDirection = direction < 0 ? -1 : 1;
    setOrbitOffset((current) => normalizeOrbitOffset(Math.round(current) + normalizedDirection, options.length));
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
      // Pointer capture may already have been released by the browser.
    }

    if (drag.moved) {
      const offsetVelocity = -(drag.velocityX / drag.pixelsPerCard);
      const projectedCards = cancelled
        ? 0
        : clamp(offsetVelocity * FLICK_PROJECTION_MS, -2.2, 2.2);
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

    // Explicit card clicks own player intent. The same click rotates the chosen
    // card to hero, publishes its detail target, and persists it only if legal.
    setOrbitOffset(normalizeOrbitOffset(optionIndex - FRONT_CENTER_SLOT, options.length));
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
          <h3 className="class-subclass-carousel-modal__title">Choose your Fate</h3>
          <button
            type="button"
            className="class-subclass-carousel-modal__close"
            onClick={() => setSelectorOpen(false)}
            aria-label="Close subclass selector"
          >
            ×
          </button>

          <div className="class-subclass-carousel-modal__stage">
            <button
              type="button"
              className="class-subclass-carousel-modal__nav is-prev"
              onClick={() => rotateCarousel(-1)}
              aria-label="Previous subclass"
              disabled={options.length <= 1}
            >
              ‹
            </button>

            <div
              ref={orbitRef}
              className={`class-subclass-carousel-modal__orbit${isDragging ? " is-dragging" : ""}`}
              role="list"
              aria-label="Subclass Tarot ring. Drag to rotate."
              onPointerDown={handleOrbitPointerDown}
              onPointerMove={handleOrbitPointerMove}
              onPointerUp={(event) => finishOrbitPointer(event)}
              onPointerCancel={(event) => finishOrbitPointer(event, true)}
            >
              {orbitOptions.map(({ option, optionIndex, signedSlots, angleDegrees, depth, isInteractive, isFaceUp, isCenter, style }) => {
                const isSelected = selected?.key === option.key;
                const eligible = optionEntryLevel(option) <= currentLevel;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="listitem"
                    className={`class-subclass-carousel-card${isCenter ? " is-orbit-center" : ""}${isSelected ? " is-selected" : ""}${isInteractive ? " is-orbit-front" : " is-orbit-back"}${isFaceUp ? " is-orbit-face-up" : ""}${eligible ? " is-eligible" : " is-locked"}`}
                    style={style}
                    aria-pressed={isSelected}
                    aria-hidden={isInteractive ? undefined : "true"}
                    tabIndex={isInteractive ? 0 : -1}
                    aria-posinset={optionIndex + 1}
                    aria-setsize={options.length}
                    aria-label={`${option.name}, ${eligible ? "select and bring to the hero position" : `available at level ${optionEntryLevel(option)}`}`}
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
                      </span>
                      <span className="class-subclass-carousel-card__face is-back" aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="class-subclass-carousel-modal__nav is-next"
              onClick={() => rotateCarousel(1)}
              aria-label="Next subclass"
              disabled={options.length <= 1}
            >
              ›
            </button>

            <div className="class-subclass-carousel-modal__sr-status visually-hidden" aria-live="polite">
              {heroOption ? `${heroOption.name}, card ${heroIndex + 1} of ${options.length}` : ""}
            </div>
          </div>
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
                <small>Double-click to reopen the Tarot selector</small>
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
              <small>{currentLevel >= entryLevel ? "Open the Tarot selector" : "Preview the paths available to this class"}</small>
            </span>
            <b aria-hidden="true">→</b>
          </button>
        )}
        <span className="visually-hidden">{required && !selected ? "Choose an eligible subclass before continuing." : `Subclass selection unlocks at level ${entryLevel}.`}</span>
      </section>
      {selectorModal}
    </>
  );
}

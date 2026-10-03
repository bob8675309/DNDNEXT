import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

  // Keep one continuous free-floating carousel path for every catalogue size.
  // The cards no longer imply contact with a physical table or floor; depth is
  // communicated through vertical travel, yaw, z-order, and physical card size.
  // Catalogue density changes card sizing only, never the carousel path itself.
  const horizontalRadius = 39.1;
  const verticalRadius = 18.5;
  const verticalCenter = 59.2;

  // Non-hero cards stay intentionally smaller so dense catalogues keep several
  // readable depth steps without rendering every 840x1440 Tarot front at hero size.
  const maxWidth = count <= 4 ? 236
    : count <= 6 ? 228
      : count <= 8 ? 220
        : count <= 10 ? 214
          : count <= 12 ? 208
            : 202;

  const minWidth = Math.round(maxWidth * 0.72);
  const viewportWidth = count <= 4 ? 13.2
    : count <= 6 ? 12.8
      : count <= 8 ? 12.4
        : count <= 10 ? 12.0
          : count <= 12 ? 11.7
            : 11.4;

  return {
    horizontalRadius,
    verticalRadius,
    verticalCenter,
    minWidth,
    viewportWidth,
    maxWidth,
    heroMinWidth: 220,
    heroViewportWidth: 17.2,
    heroMaxWidth: 312,
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

  // Restrained yaw turns the floating cards through depth without pretending
  // they are attached to a physical surface. Rear positions use the shared back.
  // Keep cards face-on while travelling; depth is conveyed by size/position rather than Y-axis corkscrew.
  const yaw = 0;
  const x = 50 + (sine * profile.horizontalRadius);
  const y = profile.verticalCenter + (cosine * profile.verticalRadius);

  // Stronger non-linear physical-size falloff creates several readable depth
  // steps around the ring without soft transform scaling.
  const physicalSize = isCenter
    ? 1
    : 0.26 + (Math.pow(depth, 1.72) * 0.74);
  const opacity = isFaceUp ? 1 : 0.84 + (depth * 0.14);
  // Keep front-facing cards in a higher stacking band than rear/back cards.
  // This makes each card an atomic depth layer and prevents a rear card from
  // slicing across a nearer face-up card while the carousel is in motion.
  const zIndex = isCenter
    ? 820
    : isFaceUp
      ? 520 + Math.round(depth * 180)
      : 100 + Math.round(depth * 120);
  // Give each non-hero card a deterministic motion signature so the orbit feels
  // suspended rather than synchronized. Keep this index-derived (not random)
  // so React renders never restart or reshuffle the ambient motion.
  const floatSeed = ((optionIndex * 37) + (count * 11)) % 17;
  const floatDelay = -((floatSeed * 0.83) % 9.4);
  const floatDuration = 8.7 + ((floatSeed % 7) * 0.71);
  const floatX = 0.8 + ((floatSeed % 5) * 0.42);
  const floatY = 1.8 + (((floatSeed * 3) % 6) * 0.48);
  const floatTilt = 0.08 + (((floatSeed * 5) % 5) * 0.055);
  const floatDirection = floatSeed % 2 === 0 ? 1 : -1;

  const cardMin = isCenter
    ? profile.heroMinWidth
    : Math.round(profile.minWidth * physicalSize);
  const cardViewport = isCenter
    ? profile.heroViewportWidth
    : profile.viewportWidth * physicalSize;
  const cardMax = isCenter
    ? profile.heroMaxWidth
    : Math.round(profile.maxWidth * physicalSize);

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
      "--orbit-opacity": opacity.toFixed(3),
      "--orbit-z": String(zIndex),
      "--orbit-float-delay": `${floatDelay.toFixed(2)}s`,
      "--orbit-float-duration": `${floatDuration.toFixed(2)}s`,
      "--orbit-float-x": `${(floatX * floatDirection).toFixed(2)}px`,
      "--orbit-float-y-up": `${(-floatY).toFixed(2)}px`,
      "--orbit-float-y-down": `${(floatY * 0.42).toFixed(2)}px`,
      "--orbit-float-tilt": `${(floatTilt * floatDirection).toFixed(3)}deg`,
      "--orbit-float-tilt-alt": `${(-floatTilt * floatDirection * 0.7).toFixed(3)}deg`,
      "--orbit-card-min": `${cardMin}px`,
      "--orbit-card-vw": `${cardViewport.toFixed(2)}vw`,
      "--orbit-card-max": `${cardMax}px`,
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
  const lastClassKeyRef = useRef(classKey);
  const orbitRef = useRef(null);
  const dragStateRef = useRef(null);
  const suppressClickUntilRef = useRef(0);
  const cardRefsRef = useRef(new Map());
  const pendingGlideRectsRef = useRef(null);
  const glideAnimationsRef = useRef(new Map());
  const glideUntilRef = useRef(0);

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

  function captureGlideRects() {
    const rects = new Map();
    for (const [key, node] of cardRefsRef.current.entries()) {
      const glide = node?.querySelector?.(".class-subclass-carousel-card__glide");
      if (!glide) continue;
      rects.set(key, glide.getBoundingClientRect());
    }
    pendingGlideRectsRef.current = rects.size ? rects : null;
  }

  useLayoutEffect(() => {
    if (isDragging) return;
    const previousRects = pendingGlideRectsRef.current;
    if (!previousRects?.size) return;
    pendingGlideRectsRef.current = null;
    const duration = 1180;
    glideUntilRef.current = Date.now() + duration;

    for (const [key, node] of cardRefsRef.current.entries()) {
      const glide = node?.querySelector?.(".class-subclass-carousel-card__glide");
      const previous = previousRects.get(key);
      if (!glide || !previous) continue;

      const active = glideAnimationsRef.current.get(key);
      active?.cancel?.();

      const next = node.getBoundingClientRect();
      if (!next.width || !next.height) continue;

      // The orbit is anchored at each card's bottom-center. Animate only that anchor's
      // travel between slots. Scaling the FLIP layer made hero-to-rear transitions
      // temporarily magnify cards toward the viewer, especially during repeated input.
      const previousCenterX = previous.left + (previous.width / 2);
      const nextCenterX = next.left + (next.width / 2);
      const dx = previousCenterX - nextCenterX;
      const dy = previous.bottom - next.bottom;
      const movement = Math.hypot(dx, dy);
      const orbitWidth = Number(orbitRef.current?.getBoundingClientRect()?.width || 0);
      // One rear card wraps across the signed-angle seam on some arrow presses.
      // Skip that hidden/back-of-ring teleport rather than flying it across the viewport.
      if (orbitWidth > 0 && movement > orbitWidth * .58) continue;
      if (movement < .5) continue;

      const animation = glide.animate(
        [
          { transform: `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        {
          duration,
          easing: "cubic-bezier(.32,.035,.18,1)",
          fill: "both",
        },
      );
      glideAnimationsRef.current.set(key, animation);
      animation.onfinish = () => {
        if (glideAnimationsRef.current.get(key) !== animation) return;
        animation.cancel();
        glideAnimationsRef.current.delete(key);
      };
      animation.oncancel = () => {
        if (glideAnimationsRef.current.get(key) === animation) glideAnimationsRef.current.delete(key);
      };
    }
  }, [isDragging, orbitOffset, optionSignature]);

  useEffect(() => {
    if (lastClassKeyRef.current !== classKey) {
      lastClassKeyRef.current = classKey;
      setSelectorOpen(false);
    }
    setOrbitOffset(0);
  }, [classKey, optionSignature]);

  // Character Forge also serves advancement. Crossing a subclass-entry level should
  // signal that a choice is ready without stealing focus or opening a modal automatically.
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

  function rotateCarousel(direction) {
    if (options.length <= 1) return;
    captureGlideRects();
    const normalizedDirection = direction < 0 ? -1 : 1;
    setOrbitOffset((current) => normalizeOrbitOffset(Math.round(current) + normalizedDirection, options.length));
  }

  function handleOrbitPointerDown(event) {
    if (options.length <= 1) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (Date.now() < glideUntilRef.current) return;
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
      captureGlideRects();
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

  function inspectOption(option, selectedOverride = false) {
    if (!option?.key) return;
    const eligible = optionEntryLevel(option) <= currentLevel;
    const selectedNow = selectedOverride || selected?.key === option.key;
    const browse = () => setSelectorOpen(true);
    const choose = eligible && !selectedNow ? () => {
      model.selectSubclass(option);
      setSelectorOpen(false);
      model?.setPreviewKey?.(option.key);
      onInspectSubclass?.(option, {
        eligible: true,
        selected: true,
        choose: null,
        browse,
      });
    } : null;

    onInspectSubclass?.(option, {
      eligible,
      selected: selectedNow,
      choose,
      browse,
    });
  }

  function handleCardClick(event, option, optionIndex, isInteractive) {
    if (!isInteractive || Date.now() < suppressClickUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Explicit card clicks own player intent. Capture the card's current visual
    // pose before changing slots so the compositor can glide from that exact pose
    // into the new orbit destination without a layout-property snap.
    captureGlideRects();
    setOrbitOffset(normalizeOrbitOffset(optionIndex - FRONT_CENTER_SLOT, options.length));
    model?.setPreviewKey?.(option.key);
    inspectOption(option);
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
          <h3 className="class-subclass-carousel-modal__title"><span>Choose Your</span><strong>Subclass</strong></h3>
          <button
            type="button"
            className="class-subclass-carousel-modal__close"
            onClick={() => setSelectorOpen(false)}
            aria-label="Close subclass selector"
          >
            ×
          </button>

          <div className="class-subclass-carousel-modal__stage">
            <span className="class-subclass-carousel-modal__flame is-flame-left-upper" aria-hidden="true" />
            <span className="class-subclass-carousel-modal__flame is-flame-left-mid" aria-hidden="true" />
            <span className="class-subclass-carousel-modal__flame is-flame-right-upper" aria-hidden="true" />
            <span className="class-subclass-carousel-modal__flame is-flame-right-mid" aria-hidden="true" />

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
              aria-label="Subclass Tarot carousel. Drag to rotate."
              onPointerDown={handleOrbitPointerDown}
              onPointerMove={handleOrbitPointerMove}
              onPointerUp={(event) => finishOrbitPointer(event)}
              onPointerCancel={(event) => finishOrbitPointer(event, true)}
            >
              <div className="class-subclass-carousel-modal__smoke-mid-right" aria-hidden="true" />
              {orbitOptions.map(({ option, optionIndex, signedSlots, angleDegrees, depth, isInteractive, isFaceUp, isCenter, style }) => {
                const isSelected = selected?.key === option.key;
                const eligible = optionEntryLevel(option) <= currentLevel;
                const artworkSrc = subclassArtworkFor(classKey, option);
                return (
                  <button
                    key={option.key}
                    ref={(node) => {
                      if (node) cardRefsRef.current.set(option.key, node);
                      else cardRefsRef.current.delete(option.key);
                    }}
                    type="button"
                    role="listitem"
                    className={`class-subclass-carousel-card${isCenter ? " is-orbit-center" : ""}${isSelected ? " is-selected" : ""}${isInteractive ? " is-orbit-front" : " is-orbit-back"}${isFaceUp ? " is-orbit-face-up" : ""}${eligible ? " is-eligible" : " is-locked"}`}
                    style={style}
                    aria-pressed={isSelected}
                    aria-hidden={isInteractive ? undefined : "true"}
                    tabIndex={isInteractive ? 0 : -1}
                    aria-posinset={optionIndex + 1}
                    aria-setsize={options.length}
                    aria-label={`${option.name}, ${eligible ? "preview and bring to the hero position" : `available at level ${optionEntryLevel(option)}`}`}
                    data-orbit-distance={Math.abs(signedSlots).toFixed(3)}
                    data-orbit-angle={angleDegrees.toFixed(3)}
                    data-orbit-depth={depth.toFixed(3)}
                    onClick={(event) => handleCardClick(event, option, optionIndex, isInteractive)}
                  >
                    <span className="class-subclass-carousel-card__glide">
                      <span className="class-subclass-carousel-card__yaw">
                        <span className="class-subclass-carousel-card__float">
                          <span className="class-subclass-carousel-card__surface">
                          <span className="class-subclass-carousel-card__face is-front">
                        <span className="class-subclass-carousel-card__art" aria-hidden="true">
                          <img
                            src={artworkSrc}
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
                        </span>
                      </span>
                    </span>

                  </button>
                );
              })}
              <div className="class-subclass-carousel-modal__smoke-near" aria-hidden="true" />
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
      <section className={`npc-forge-class-guide__subclasses is-compact class-subclass-section is-card-launcher${selected ? " has-selection" : ""}${detailed ? " is-detailed" : ""}${required && !selected ? " is-required" : ""}`}>
        {selected ? (
          <div className="class-subclass-selected-card-shell">
            <span className="class-subclass-selected-card__art" aria-hidden="true">
              <img src={subclassArtworkFor(classKey, selected)} onError={(event) => handleSubclassArtworkError(event, classKey)} alt="" />
            </span>
            <div className="class-subclass-selected-card__copy">
              <strong>{selected.name}</strong>
              <button type="button" onClick={() => inspectOption(selected, true)} aria-label={`Open the ${selected.name} subclass Codex.`}>Open Codex</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="class-subclass-launcher"
            onClick={() => setSelectorOpen(true)}
            aria-label={currentLevel >= entryLevel ? "Open Subclass Browser" : `Open Subclass Browser. Subclass selection unlocks at level ${entryLevel}.`}
            title={currentLevel >= entryLevel ? "Open the subclass Tarot browser" : `Preview subclasses. Selection unlocks at level ${entryLevel}.`}
          >
            <strong>Subclass Browser</strong>
          </button>
        )}
        <span className="visually-hidden">{required && !selected ? "Choose an eligible subclass before continuing." : `Subclass selection unlocks at level ${entryLevel}.`}</span>
      </section>
      {selectorModal}
    </>
  );
}

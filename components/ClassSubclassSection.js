import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { handleSubclassArtworkError, subclassArtworkFor } from "../utils/classes/subclassArtwork";

const text = (value) => String(value ?? "").trim();
const FRONT_CENTER_SLOT = 1;
const VISIBLE_CARD_CAP = 9;
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

function orbitThetaDegrees(distance) {
  const d = Math.max(0, Number(distance || 0));
  if (d <= 1) return d * 28;
  if (d <= 2) return 28 + ((d - 1) * 29);
  if (d <= 3) return 57 + ((d - 2) * 58);
  if (d <= 4) return 115 + ((d - 3) * 40);
  return Math.min(180, 155 + ((d - 4) * 38));
}

function orbitPlacement(optionIndex, orbitOffset, total) {
  const count = Math.max(1, Number(total || 1));
  const visualSlotCount = Math.min(count, VISIBLE_CARD_CAP);
  const frontCenter = orbitOffset + FRONT_CENTER_SLOT;
  const signedSlots = signedOrbitSlots(optionIndex - frontCenter, count);
  const absoluteSlots = Math.abs(signedSlots);
  const direction = signedSlots === 0 ? 0 : Math.sign(signedSlots);

  // The catalogue remains complete. Only the nearest visual ring is painted.
  // A small rear-seam allowance crossfades the outgoing/incoming card during
  // drag so the ring never visibly pops.
  const visibleRadius = Math.floor(visualSlotCount / 2);
  const isVisible = count <= VISIBLE_CARD_CAP || absoluteSlots <= visibleRadius + 0.18;

  // The front half deliberately uses more of the table rim than equal angular
  // slots would. This gives the five readable cards the same graceful spread
  // as the approved visual reference while the rear cards curl around behind.
  const isFront = absoluteSlots <= 1.01;
  const faceUpRadius = count <= 4 ? 1 : 2;
  const isFaceUp = count <= 3 || absoluteSlots <= faceUpRadius + 0.01;
  const isCenter = absoluteSlots <= 0.015;
  const isOpposite = count % 2 === 0 && Math.abs(absoluteSlots - (count / 2)) <= 0.015;

  const thetaDegrees = isOpposite ? 180 : orbitThetaDegrees(absoluteSlots);
  const theta = (thetaDegrees * Math.PI) / 180;
  const sine = Math.sin(theta);
  const cosine = Math.cos(theta);
  const depth = (cosine + 1) / 2;

  // Position on the ellipse and card-facing angle are intentionally separate:
  // cards follow the table edge while their faces progressively bend into it.
  const faceUpYawMagnitude = absoluteSlots <= 1
    ? absoluteSlots * 18
    : 18 + ((absoluteSlots - 1) * 18);

  const yaw = isFaceUp
    ? direction * Math.min(40, faceUpYawMagnitude)
    : direction * Math.min(180, 104 + ((thetaDegrees - 90) * 0.76));

  // The card's bottom-center, not its center, traces the physical table rim.
  // This makes the Tarot deck look planted on the table instead of floating
  // over an unrelated ellipse.
  const horizontalRadius = 31.5;
  const verticalCenter = 54;
  const verticalRadius = 25;
  const x = 50 + (direction * sine * horizontalRadius);
  const y = verticalCenter + (cosine * verticalRadius);

  const scale = isCenter
    ? 1
    : isFront
      ? 0.94
      : isFaceUp
        ? 0.79 + (depth * 0.04)
        : 0.50 + (depth * 0.16);

  const opacity = isFront
    ? 0.955
    : isFaceUp
      ? 0.86 + (depth * 0.06)
      : 0.20 + (depth * 0.22);

  const zIndex = isCenter
    ? 142
    : isFront
      ? 126 + Math.round(depth * 8)
      : isFaceUp
        ? 98 + Math.round(depth * 12)
        : 30 + Math.round(depth * 26);

  return {
    signedSlots,
    depth,
    isFront,
    isFaceUp,
    isCenter,
    isVisible,
    style: {
      "--orbit-x": `${x.toFixed(3)}%`,
      "--orbit-y": `${y.toFixed(3)}%`,
      "--orbit-yaw": `${yaw.toFixed(2)}deg`,
      "--orbit-scale": scale.toFixed(4),
      "--orbit-opacity": (isVisible ? opacity : 0).toFixed(3),
      "--orbit-z": String(isVisible ? zIndex : 0),
      "--orbit-depth-z": `${isFaceUp ? 0 : Math.round(depth * 28)}px`,
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
  const browsedOption = options[browsedIndex] || null;
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
              {orbitOptions.map(({ option, optionIndex, signedSlots, depth, isFront, isFaceUp, isCenter, isVisible, style }) => {
                const isSelected = selected?.key === option.key;
                const isInspected = inspectedOption?.key === option.key;
                const eligible = optionEntryLevel(option) <= currentLevel;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="listitem"
                    className={`class-subclass-carousel-card${isCenter ? " is-orbit-center" : ""}${isInspected ? " is-inspected" : ""}${isSelected ? " is-selected" : ""}${isFront ? " is-orbit-front" : " is-orbit-back"}${isFaceUp ? " is-orbit-face-up" : ""}${isVisible ? "" : " is-orbit-hidden"}${eligible ? " is-eligible" : " is-locked"}`}
                    style={style}
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
            <div className="class-subclass-carousel-modal__hint">Drag the table or use the arrows. Only the three front cards can be chosen.</div>
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

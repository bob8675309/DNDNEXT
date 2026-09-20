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

function orbitPlacement(optionIndex, orbitOffset, total) {
  const count = Math.max(1, Number(total || 1));
  const visualSlotCount = Math.min(count, VISIBLE_CARD_CAP);
  const step = (Math.PI * 2) / visualSlotCount;
  const stepDegrees = 360 / visualSlotCount;
  const frontCenter = orbitOffset + FRONT_CENTER_SLOT;
  const signedSlots = signedOrbitSlots(optionIndex - frontCenter, count);
  const absoluteSlots = Math.abs(signedSlots);

  // Keep the whole logical catalogue, but only draw the nearest visual ring.
  // A half-slot rear seam allowance lets the outgoing/incoming card crossfade
  // behind the carousel during drag instead of popping at the cull boundary.
  const isVisible = count <= VISIBLE_CARD_CAP || absoluteSlots <= (VISIBLE_CARD_CAP / 2) + 0.15;

  const angle = (Math.PI / 2) + (signedSlots * step);
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const depth = (sine + 1) / 2;
  const positionalYaw = signedSlots * stepDegrees;
  const isFront = absoluteSlots <= 1.01;
  const isFaceUp = count <= 3 || Math.abs(positionalYaw) <= 90.01;
  const direction = signedSlots === 0 ? 0 : Math.sign(signedSlots);

  // Position and card-facing are related but not identical. The cards still
  // travel through evenly spaced ellipse slots, while the readable front half
  // uses a shallower yaw so artwork stays legible at the larger render size.
  const faceUpYawMagnitude = absoluteSlots <= 1
    ? absoluteSlots * 22
    : 22 + ((absoluteSlots - 1) * 26);

  const yaw = isFaceUp
    ? direction * Math.min(54, faceUpYawMagnitude)
    : direction * Math.min(
      180,
      102 + (clamp((Math.abs(positionalYaw) - 90) / 90, 0, 1) * 78),
    );

  // A deliberately taller ellipse: the front settles lower on the runic table,
  // while the back rises into the cathedral so its nearly-transparent motion
  // remains visible behind the readable cards.
  const x = 50 - (cosine * 40.5);
  const y = 36.5 + (sine * 21.5);

  const scale = isFront
    ? 1
    : isFaceUp
      ? 0.78 + (depth * 0.10)
      : 0.54 + (depth * 0.20);

  const opacity = isFront
    ? 0.955
    : isFaceUp
      ? 0.82 + (depth * 0.12)
      : 0.055 + (depth * 0.18);

  const zIndex = isFront
    ? 116 + Math.round(depth * 18)
    : isFaceUp
      ? 82 + Math.round(depth * 18)
      : 24 + Math.round(depth * 28);

  return {
    signedSlots,
    depth,
    isFront,
    isVisible,
    style: {
      "--orbit-x": `${x.toFixed(3)}%`,
      "--orbit-y": `${y.toFixed(3)}%`,
      "--orbit-yaw": `${yaw.toFixed(2)}deg`,
      "--orbit-scale": scale.toFixed(4),
      "--orbit-opacity": (isVisible ? opacity : 0).toFixed(3),
      "--orbit-z": String(isVisible ? zIndex : 0),
      "--orbit-depth-z": `${isFaceUp ? 0 : Math.round(depth * 34)}px`,
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
  const inspectedOption = options.find((option) => option.key === inspectedKey) || browsedOption;
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
    setInspectedKey("");
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
    setInspectedKey("");
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
              {orbitOptions.map(({ option, optionIndex, signedSlots, depth, isFront, isVisible, style }) => {
                const isSelected = selected?.key === option.key;
                const isInspected = inspectedOption?.key === option.key;
                const eligible = optionEntryLevel(option) <= currentLevel;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="listitem"
                    className={`class-subclass-carousel-card${isInspected ? " is-inspected" : ""}${isSelected ? " is-selected" : ""}${isFront ? " is-orbit-front" : " is-orbit-back"}${isVisible ? "" : " is-orbit-hidden"}${eligible ? " is-eligible" : " is-locked"}`}
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
                        {(!eligible || isSelected) ? (
                          <span className="class-subclass-carousel-card__copy">
                            <small>{!eligible ? `Unlocks at level ${optionEntryLevel(option)}` : "Selected"}</small>
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
            <div className="class-subclass-carousel-modal__hint">Drag the table or use the arrows. Only the three front cards can be chosen.</div>
          </div>

          <section className="class-subclass-carousel-modal__details" aria-live="polite">
            <div className="class-subclass-carousel-modal__details-icon" aria-hidden="true"><span>✦</span></div>
            <div className="class-subclass-carousel-modal__details-copy">
              <span>{classLabel} Subclass</span>
              <h4>{inspectedOption?.name || "Subclass"}</h4>
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

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { handleSubclassArtworkError, subclassArtworkFor } from "../utils/classes/subclassArtwork";

const text = (value) => String(value ?? "").trim();

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

function orbitPlacement(optionIndex, carouselStart, total) {
  const count = Math.max(1, Number(total || 1));
  const relative = (optionIndex - carouselStart + count) % count;
  const frontCount = Math.min(4, count);
  const step = (Math.PI * 2) / count;
  const frontSpan = Math.max(0, frontCount - 1) * step;
  const offset = (Math.PI / 2) - (frontSpan / 2);
  const angle = offset + (relative * step);
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const isFront = relative < frontCount;
  const x = 50 - (cosine * 40.5);
  const y = 43 + (sine * 20.5);
  const depth = (sine + 1) / 2;
  const yaw = isFront ? cosine * 18 : cosine * 72;
  const scale = isFront ? 1 + (Math.max(0, sine) * 0.07) : 0.56 + (depth * 0.16);
  const opacity = isFront ? 1 : 0.16 + (depth * 0.24);
  const zIndex = isFront ? 100 + Math.round(depth * 18) : 18 + Math.round(depth * 18);

  return {
    relative,
    isFront,
    style: {
      "--orbit-x": `${x.toFixed(3)}%`,
      "--orbit-y": `${y.toFixed(3)}%`,
      "--orbit-yaw": `${yaw.toFixed(2)}deg`,
      "--orbit-scale": scale.toFixed(3),
      "--orbit-opacity": opacity.toFixed(3),
      "--orbit-z": String(zIndex),
    },
  };
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
  const [carouselStart, setCarouselStart] = useState(0);
  const autoOpenedForRef = useRef("");
  const lastClassKeyRef = useRef(classKey);

  const orbitOptions = useMemo(() => options.map((option, optionIndex) => ({
    option,
    optionIndex,
    ...orbitPlacement(optionIndex, carouselStart, options.length),
  })), [carouselStart, options]);

  const focusedSlot = Math.min(1, Math.max(0, options.length - 1));
  const focusedIndex = options.length ? (carouselStart + focusedSlot) % options.length : 0;
  const focusedOption = options[focusedIndex] || null;
  const focusedSummary = useMemo(() => subclassSummary(focusedOption), [focusedOption]);
  const classLabel = classLabelFor(classKey, model?.className);

  useEffect(() => {
    if (lastClassKeyRef.current !== classKey) {
      lastClassKeyRef.current = classKey;
      autoOpenedForRef.current = "";
      setSelectorOpen(false);
    }
    setCarouselStart(0);
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
    const focusSlot = Math.min(1, Math.max(0, options.length - 1));
    setCarouselStart((selectedIndex - focusSlot + options.length) % options.length);
  }, [selectorOpen, selected?.key, optionSignature]);

  useEffect(() => {
    if (!selectorOpen || !focusedOption?.key) return;
    model?.setPreviewKey?.(focusedOption.key);
  }, [focusedOption?.key, selectorOpen]);

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

  function choose(option) {
    onInspectSubclass?.(option);
    if (optionEntryLevel(option) > currentLevel) return;
    model.setPreviewKey(option.key);
    model.selectSubclass(option);
    setSelectorOpen(false);
  }

  function clearSelection() {
    model.selectSubclass(null);
    setSelectorOpen(true);
  }

  function rotateCarousel(direction) {
    if (options.length <= 1) return;
    const normalizedDirection = direction < 0 ? -1 : 1;
    setCarouselStart((current) => {
      const length = options.length;
      return (current + normalizedDirection + length) % length;
    });
  }

  function showFocusedDetails() {
    if (!focusedOption) return;
    model?.setPreviewKey?.(focusedOption.key);
    onInspectSubclass?.(focusedOption);
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

            <button
              type="button"
              className="class-subclass-carousel-modal__nav is-prev"
              onClick={() => rotateCarousel(-1)}
              aria-label="Previous subclass"
              disabled={options.length <= 1}
            >‹</button>

            <div className="class-subclass-carousel-modal__orbit" role="list" aria-label="Subclass catalogue">
              {orbitOptions.map(({ option, optionIndex, relative, isFront, style }) => {
                const isSelected = selected?.key === option.key;
                const isFocused = focusedOption?.key === option.key;
                const eligible = optionEntryLevel(option) <= currentLevel;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="listitem"
                    className={`class-subclass-carousel-card${isFocused ? " is-focused" : ""}${isSelected ? " is-selected" : ""}${isFront ? " is-orbit-front" : " is-orbit-back"}${eligible ? " is-eligible" : " is-locked"}`}
                    style={style}
                    aria-pressed={isSelected}
                    aria-hidden={isFront ? undefined : "true"}
                    tabIndex={isFront ? 0 : -1}
                    aria-posinset={optionIndex + 1}
                    aria-setsize={options.length}
                    aria-label={`${option.name}, ${eligible ? "selectable now" : `available at level ${optionEntryLevel(option)}`}`}
                    data-orbit-slot={relative}
                    onClick={() => choose(option)}
                  >
                    <span className="class-subclass-carousel-card__art" aria-hidden="true">
                      <img src={subclassArtworkFor(classKey, option)} onError={(event) => handleSubclassArtworkError(event, classKey)} alt="" />
                    </span>
                    <span className="class-subclass-carousel-card__shade" aria-hidden="true" />
                    {(!eligible || isSelected) ? (
                      <span className="class-subclass-carousel-card__copy">
                        <small>{!eligible ? `Unlocks at level ${optionEntryLevel(option)}` : "Selected"}</small>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="class-subclass-carousel-modal__smoke-front" aria-hidden="true" />

            <button
              type="button"
              className="class-subclass-carousel-modal__nav is-next"
              onClick={() => rotateCarousel(1)}
              aria-label="Next subclass"
              disabled={options.length <= 1}
            >›</button>

            <div className="class-subclass-carousel-modal__position" aria-live="polite">
              <span>{focusedIndex + 1}</span><b>/</b><span>{options.length}</span>
            </div>
            <div className="class-subclass-carousel-modal__hint">Slide left or right. The path is endless.</div>
          </div>

          <section className="class-subclass-carousel-modal__details" aria-live="polite">
            <div className="class-subclass-carousel-modal__details-icon" aria-hidden="true"><span>✦</span></div>
            <div className="class-subclass-carousel-modal__details-copy">
              <span>{classLabel} Subclass</span>
              <h4>{focusedOption?.name || "Subclass"}</h4>
              <p>{focusedSummary}</p>
              {focusedOption && optionEntryLevel(focusedOption) > currentLevel ? <small>Available at level {optionEntryLevel(focusedOption)}</small> : null}
            </div>
            <button type="button" className="class-subclass-carousel-modal__details-button" onClick={showFocusedDetails} disabled={!focusedOption}>
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

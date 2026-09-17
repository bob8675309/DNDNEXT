import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { handleSubclassArtworkError, subclassArtworkFor } from "../utils/classes/subclassArtwork";

const text = (value) => String(value ?? "").trim();

function optionEntryLevel(option = {}) {
  return Math.max(1, Number(option?.firstLevel || 1));
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
  const [carouselDirection, setCarouselDirection] = useState(0);
  const [visibleCount, setVisibleCount] = useState(4);
  const autoOpenedForRef = useRef("");
  const lastClassKeyRef = useRef(classKey);

  const visibleOptions = useMemo(() => {
    if (!options.length) return [];
    const count = Math.min(visibleCount, options.length);
    return Array.from({ length: count }, (_, slot) => {
      const optionIndex = (carouselStart + slot) % options.length;
      return { option: options[optionIndex], optionIndex, slot };
    });
  }, [carouselStart, options, visibleCount]);

  useEffect(() => {
    if (lastClassKeyRef.current !== classKey) {
      lastClassKeyRef.current = classKey;
      autoOpenedForRef.current = "";
      setSelectorOpen(false);
    }
    setCarouselStart(0);
    setCarouselDirection(0);
  }, [classKey, optionSignature]);

  useEffect(() => {
    if (!options.length || selected || currentLevel < entryLevel) return;
    const autoOpenKey = `${classKey}:${entryLevel}:${optionSignature}`;
    if (autoOpenedForRef.current === autoOpenKey) return;
    autoOpenedForRef.current = autoOpenKey;
    setSelectorOpen(true);
  }, [classKey, currentLevel, entryLevel, optionSignature, options.length, selected]);

  useEffect(() => {
    if (!selectorOpen || typeof window === "undefined") return undefined;
    const syncVisibleCount = () => {
      const width = window.innerWidth;
      setVisibleCount(width < 620 ? 1 : width < 860 ? 2 : width < 1180 ? 3 : 4);
    };
    syncVisibleCount();
    window.addEventListener("resize", syncVisibleCount);
    return () => window.removeEventListener("resize", syncVisibleCount);
  }, [selectorOpen]);

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
    setCarouselDirection(normalizedDirection);
    setCarouselStart((current) => {
      const length = options.length;
      return (current + normalizedDirection + length) % length;
    });
  }

  const selectorModal = selectorOpen && typeof document !== "undefined"
    ? createPortal(
      <div
        className="class-subclass-carousel-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Choose a ${text(model?.className) || "class"} subclass`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectorOpen(false);
        }}
      >
        <div className="class-subclass-carousel-modal__panel">
          <header className="class-subclass-carousel-modal__head">
            <div>
              <span>Subclass Path</span>
              <h3>Choose your subclass</h3>
              <p>Browse up to four paths at once. Each arrow moves exactly one card and the gallery loops continuously.</p>
            </div>
            <button type="button" className="class-subclass-carousel-modal__close" onClick={() => setSelectorOpen(false)} aria-label="Close subclass selector">×</button>
          </header>

          <div className="class-subclass-carousel-modal__stage">
            <button
              type="button"
              className="class-subclass-carousel-modal__nav is-prev"
              onClick={() => rotateCarousel(-1)}
              aria-label="Previous subclass"
              disabled={options.length <= 1}
            >‹</button>
            <div
              className={`class-subclass-carousel-modal__rail${carouselDirection < 0 ? " is-prev" : carouselDirection > 0 ? " is-next" : ""}`}
              role="list"
              aria-label="Subclass catalogue"
              style={{ "--subclass-visible-count": String(Math.max(1, visibleOptions.length)) }}
            >
              {visibleOptions.map(({ option, optionIndex, slot }) => {
                const isSelected = selected?.key === option.key;
                const eligible = optionEntryLevel(option) <= currentLevel;
                return (
                  <button
                    key={`${carouselStart}-${optionIndex}-${option.key}-${slot}`}
                    type="button"
                    role="listitem"
                    className={`class-subclass-carousel-card${isSelected ? " is-selected" : ""}${eligible ? " is-eligible" : " is-locked"}`}
                    aria-pressed={isSelected}
                    aria-posinset={optionIndex + 1}
                    aria-setsize={options.length}
                    aria-label={`${option.name}, ${eligible ? "selectable now" : `available at level ${optionEntryLevel(option)}`}`}
                    onClick={() => choose(option)}
                  >
                    <span className="class-subclass-carousel-card__art" aria-hidden="true">
                      <img src={subclassArtworkFor(classKey, option)} onError={(event) => handleSubclassArtworkError(event, classKey)} alt="" />
                    </span>
                    <span className="class-subclass-carousel-card__shade" aria-hidden="true" />
                    <span className="class-subclass-carousel-card__copy">
                      <strong>{text(option.name) || "Subclass"}</strong>
                      {!eligible ? <small>Unlocks at level {optionEntryLevel(option)}</small> : isSelected ? <small>Selected</small> : <small>Select path</small>}
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
            >›</button>
          </div>

          <footer className="class-subclass-carousel-modal__foot">
            <span>{currentLevel < entryLevel ? `Subclass selection unlocks at level ${entryLevel}.` : "Use the arrows to move one card at a time. After the final card, the first continues naturally as the next card."}</span>
            <button type="button" onClick={() => setSelectorOpen(false)}>Close</button>
          </footer>
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

      <style jsx global>{`
        .class-subclass-section.is-card-launcher{padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
        .class-subclass-section.is-card-launcher:not(.is-detailed){width:min(38%,470px);max-width:470px;align-self:start}
        .class-subclass-launcher{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;padding:9px 11px;border:1px solid rgba(var(--class-accent),.34);border-radius:10px;color:#f4ebfa;background:linear-gradient(120deg,rgba(var(--class-accent),.15),rgba(8,12,21,.9) 58%,rgba(var(--class-secondary),.07));text-align:left;box-shadow:0 8px 24px rgba(0,0,0,.12);transition:border-color .16s ease,transform .16s ease,box-shadow .16s ease}.class-subclass-launcher:hover,.class-subclass-launcher:focus-visible{border-color:rgba(var(--class-secondary),.7);transform:translateY(-1px);outline:none;box-shadow:0 10px 28px rgba(0,0,0,.2)}
        .class-subclass-launcher__icon{display:grid;place-items:center;width:32px;height:32px;border:1px solid rgba(var(--class-accent),.52);border-radius:50%;color:#e3c3ff;background:rgba(var(--class-accent),.12)}.class-subclass-launcher>span:nth-child(2){display:grid;gap:2px}.class-subclass-launcher strong{font-family:Georgia,"Times New Roman",serif;font-size:.78rem}.class-subclass-launcher small{color:rgba(255,255,255,.56);font-size:.5rem}.class-subclass-launcher>b{font-size:1.15rem;color:rgba(var(--class-secondary),.92)}
        .class-subclass-selected-card-shell{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch}.class-subclass-selected-card{position:relative;isolation:isolate;display:block;width:100%;min-height:112px;overflow:hidden;padding:0;border:1px solid rgba(var(--class-accent),.5);border-radius:11px;background:#080c14;text-align:left;box-shadow:0 10px 24px rgba(0,0,0,.18)}.class-subclass-selected-card:hover,.class-subclass-selected-card:focus-visible{border-color:rgba(var(--class-secondary),.75);outline:none}.class-subclass-selected-card__art{position:absolute;inset:0;z-index:-2}.class-subclass-selected-card__art img{display:block;width:100%;height:100%;object-fit:cover;object-position:center;filter:saturate(1.02) contrast(1.05)}.class-subclass-selected-card__shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(5,8,15,.94) 0%,rgba(5,8,15,.7) 46%,rgba(5,8,15,.08) 100%),linear-gradient(0deg,rgba(5,8,15,.7),transparent 62%)}.class-subclass-selected-card__copy{display:grid;gap:3px;align-content:end;min-height:112px;padding:14px 42% 12px 13px}.class-subclass-selected-card__copy>span{text-transform:uppercase;letter-spacing:.12em;color:#d7b4ff;font-size:.46rem;font-weight:800}.class-subclass-selected-card__copy strong{font-family:Georgia,"Times New Roman",serif;color:#fff;font-size:1.02rem;line-height:1.05}.class-subclass-selected-card__copy small{color:rgba(255,255,255,.58);font-size:.48rem}.class-subclass-selected-card-shell__actions{display:flex;flex-direction:column;justify-content:center;gap:5px}.class-subclass-selected-card-shell__actions button{padding:7px 9px;border:1px solid rgba(var(--class-accent),.42);border-radius:7px;color:#fff;background:linear-gradient(180deg,rgba(var(--class-accent),.35),rgba(54,34,90,.64));font-size:.48rem;font-weight:800;white-space:nowrap}.class-subclass-selected-card-shell__actions button.is-muted{border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.55);background:rgba(255,255,255,.025)}.class-subclass-selected-card-shell__actions button:hover,.class-subclass-selected-card-shell__actions button:focus-visible{border-color:rgba(var(--class-secondary),.68);outline:none}
        .class-subclass-carousel-modal{position:fixed;inset:0;z-index:2147482500;display:grid;place-items:center;padding:clamp(14px,3vw,36px);background:rgba(2,4,10,.82);backdrop-filter:blur(6px)}.class-subclass-carousel-modal__panel{display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(1460px,96vw);max-height:min(900px,94vh);overflow:hidden;border:1px solid rgba(var(--class-accent),.42);border-radius:18px;background:linear-gradient(145deg,rgba(13,16,27,.98),rgba(4,8,15,.985));box-shadow:0 30px 90px rgba(0,0,0,.7),0 0 60px rgba(var(--class-accent),.08)}.class-subclass-carousel-modal__head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:start;padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,.09);background:linear-gradient(90deg,rgba(var(--class-accent),.13),rgba(255,255,255,.015) 58%,rgba(var(--class-secondary),.05))}.class-subclass-carousel-modal__head>div{display:grid;gap:3px}.class-subclass-carousel-modal__head span{color:#d8b8ff;font-size:.5rem;font-weight:850;letter-spacing:.16em;text-transform:uppercase}.class-subclass-carousel-modal__head h3{margin:0;color:#fff;font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.3rem,2vw,2rem);font-weight:650}.class-subclass-carousel-modal__head p{max-width:760px;margin:0;color:rgba(255,255,255,.64);font-size:.72rem}.class-subclass-carousel-modal__close{display:grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid rgba(255,255,255,.17);border-radius:9px;color:#fff;background:rgba(255,255,255,.035);font-size:1.35rem;line-height:1}.class-subclass-carousel-modal__close:hover,.class-subclass-carousel-modal__close:focus-visible{border-color:rgba(var(--class-secondary),.72);outline:none}
        .class-subclass-carousel-modal__stage{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;min-height:0;padding:22px 10px 24px;background:radial-gradient(circle at 50% 42%,rgba(var(--class-accent),.12),transparent 50%),linear-gradient(180deg,rgba(255,255,255,.025),rgba(0,0,0,.08))}.class-subclass-carousel-modal__nav{position:relative;z-index:2;display:grid;place-items:center;width:42px;height:72px;padding:0;border:1px solid rgba(255,255,255,.16);border-radius:11px;color:#fff;background:rgba(5,8,15,.66);font-size:2.2rem;line-height:1}.class-subclass-carousel-modal__nav:hover,.class-subclass-carousel-modal__nav:focus-visible{border-color:rgba(var(--class-secondary),.78);background:rgba(var(--class-accent),.24);outline:none}.class-subclass-carousel-modal__nav:disabled{opacity:.32;cursor:default}.class-subclass-carousel-modal__rail{display:grid;grid-template-columns:repeat(var(--subclass-visible-count,4),minmax(0,1fr));gap:clamp(10px,1vw,16px);align-items:center;width:min(100%,1180px);min-width:0;margin:0 auto;overflow:hidden;padding:8px 10px 14px}.class-subclass-carousel-modal__rail.is-next .class-subclass-carousel-card{animation:subclass-carousel-card-next .22s ease both}.class-subclass-carousel-modal__rail.is-prev .class-subclass-carousel-card{animation:subclass-carousel-card-prev .22s ease both}
        .class-subclass-carousel-card{position:relative;isolation:isolate;width:100%;min-width:0;aspect-ratio:7/12;overflow:hidden;padding:0;border:1px solid rgba(255,255,255,.18);border-radius:14px;color:#fff;background:#0c111b;text-align:left;box-shadow:0 18px 36px rgba(0,0,0,.3);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,opacity .18s ease}.class-subclass-carousel-card:hover,.class-subclass-carousel-card:focus-visible{z-index:3;transform:translateY(-5px) scale(1.012);border-color:rgba(var(--class-secondary),.78);outline:none;box-shadow:0 24px 50px rgba(0,0,0,.46),0 0 26px rgba(var(--class-accent),.14)}.class-subclass-carousel-card.is-selected{border-color:rgba(var(--class-secondary),.98);box-shadow:0 24px 54px rgba(0,0,0,.5),0 0 0 2px rgba(var(--class-secondary),.2),0 0 38px rgba(var(--class-accent),.16)}.class-subclass-carousel-card.is-locked{opacity:.88;filter:saturate(.92)}.class-subclass-carousel-card.is-locked:hover,.class-subclass-carousel-card.is-locked:focus-visible{opacity:1;filter:saturate(1)}.class-subclass-carousel-card__art{position:absolute;inset:0;z-index:-3}.class-subclass-carousel-card__art img{display:block;width:100%;height:100%;object-fit:cover;object-position:center;filter:brightness(1.12) saturate(1.08) contrast(1.03)}.class-subclass-carousel-card__shade{position:absolute;inset:0;z-index:-2;background:linear-gradient(0deg,rgba(3,5,10,.78) 0%,rgba(3,5,10,.48) 14%,rgba(3,5,10,.09) 34%,rgba(3,5,10,0) 62%),linear-gradient(90deg,rgba(4,7,12,.07),transparent 42%,rgba(4,7,12,.04))}.class-subclass-carousel-card__copy{position:absolute;inset:auto 0 0;display:grid;gap:4px;padding:18px 15px 16px;text-align:center}.class-subclass-carousel-card__copy strong{font-family:Georgia,"Times New Roman",serif;font-size:clamp(.92rem,1.35vw,1.15rem);font-weight:650;letter-spacing:.025em;text-shadow:0 2px 10px #000}.class-subclass-carousel-card__copy small{color:rgba(255,255,255,.72);font-size:.52rem;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.class-subclass-carousel-card.is-selected .class-subclass-carousel-card__copy small{color:rgb(var(--class-secondary))}
        .class-subclass-carousel-modal__foot{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:11px 18px;border-top:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6);background:rgba(4,7,13,.84);font-size:.57rem}.class-subclass-carousel-modal__foot button{padding:7px 13px;border:1px solid rgba(255,255,255,.16);border-radius:7px;color:#fff;background:rgba(255,255,255,.04);font-size:.53rem;font-weight:800}.class-subclass-carousel-modal__foot button:hover,.class-subclass-carousel-modal__foot button:focus-visible{border-color:rgba(var(--class-secondary),.68);outline:none}
        @keyframes subclass-carousel-card-next{from{opacity:.72;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}@keyframes subclass-carousel-card-prev{from{opacity:.72;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}
        @media(max-width:1179px){.class-subclass-section.is-card-launcher:not(.is-detailed){width:min(44%,470px)}.class-subclass-carousel-modal__rail{width:min(100%,900px)}}
        @media(max-width:859px){.class-subclass-section.is-card-launcher:not(.is-detailed){width:100%;max-width:none}.class-subclass-carousel-modal{padding:10px}.class-subclass-carousel-modal__panel{width:100%;max-height:94vh}.class-subclass-carousel-modal__stage{grid-template-columns:36px minmax(0,1fr) 36px;padding-inline:2px}.class-subclass-carousel-modal__nav{width:34px;height:60px}.class-subclass-carousel-modal__rail{width:min(100%,620px)}.class-subclass-selected-card-shell{grid-template-columns:1fr}.class-subclass-selected-card-shell__actions{flex-direction:row;justify-content:flex-end}}
        @media(max-width:619px){.class-subclass-carousel-modal__head{padding:13px 14px 11px}.class-subclass-carousel-modal__head p{display:none}.class-subclass-carousel-modal__stage{grid-template-columns:30px minmax(0,1fr) 30px}.class-subclass-carousel-modal__nav{width:28px;height:54px;font-size:1.7rem}.class-subclass-carousel-modal__rail{width:min(100%,320px);padding-inline:6px}.class-subclass-carousel-modal__foot{align-items:flex-start;flex-direction:column;gap:7px}.class-subclass-selected-card__copy{padding-right:18px}}
        @media(prefers-reduced-motion:reduce){.class-subclass-launcher,.class-subclass-carousel-card{transition:none}.class-subclass-carousel-modal__rail.is-next .class-subclass-carousel-card,.class-subclass-carousel-modal__rail.is-prev .class-subclass-carousel-card{animation:none}}
      `}</style>
    </>
  );
}

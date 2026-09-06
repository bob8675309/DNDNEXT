import { useEffect, useMemo, useState } from "react";
import { classFeatureInline } from "./ClassFeatureText";
import { handleSubclassArtworkError, subclassArtworkFor } from "../utils/classes/subclassArtwork";

const text = (value) => String(value ?? "").trim();

function sourceLabel(source = "") {
  if (source === "XPHB") return "2024";
  if (source === "PHB") return "2014";
  return source || "Campaign";
}

function optionEntryLevel(option = {}) {
  return Math.max(1, Number(option?.firstLevel || 1));
}

function optionSummary(option = {}) {
  const features = Array.isArray(option?.features) ? option.features : [];
  const intro = features.find((feature) => feature?.isIntroduction) || features[0] || null;
  return classFeatureInline(
    intro?.description,
    `Explore the defining features and play style of ${option?.name || "this subclass"}.`,
  );
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
  const entryLevel = Number(model?.entryLevel || options[0]?.firstLevel || 1);
  const required = (model?.eligible || []).length > 0;
  const optionSignature = options.map((option) => option.key).join("|");
  const [expanded, setExpanded] = useState(!selected);

  useEffect(() => {
    setExpanded(!model?.selected);
  }, [optionSignature]);

  useEffect(() => {
    if (!selected) setExpanded(true);
  }, [selected]);

  const orderedOptions = useMemo(() => {
    if (!selected) return options;
    return [selected, ...options.filter((option) => option.key !== selected.key)];
  }, [options, selected]);

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
    setExpanded(false);
  }

  function clearSelection() {
    model.selectSubclass(null);
    setExpanded(true);
  }

  if (selected && !expanded) {
    return (
      <section className={`npc-forge-class-guide__subclasses is-compact class-subclass-section is-collapsed${detailed ? " is-detailed" : ""}`}>
        <div className="class-subclass-selected-row">
          <button
            type="button"
            className="class-subclass-selected-row__summary"
            onClick={() => onInspectSubclass?.(selected)}
            aria-label={`Show ${selected.name} details`}
          >
            <span className="class-subclass-selected-row__art" aria-hidden="true">
              <img src={subclassArtworkFor(classKey, selected)} onError={(event) => handleSubclassArtworkError(event, classKey)} alt="" />
            </span>
            <span className="class-subclass-selected-row__copy">
              <small>Selected subclass · {sourceLabel(selected.source)} · Level {optionEntryLevel(selected)}</small>
              <strong>{selected.name}</strong>
              <em>{optionSummary(selected)}</em>
            </span>
            <span className="class-subclass-selected-row__mark" aria-hidden="true">✓</span>
          </button>
          <div className="class-subclass-selected-row__actions">
            <button type="button" onClick={() => setExpanded(true)}>Change</button>
            <button type="button" className="is-muted" onClick={clearSelection}>Clear</button>
          </div>
        </div>

        <style jsx global>{`
          .class-subclass-section.is-collapsed{padding:0!important;border:0!important;background:transparent!important}
          .class-subclass-selected-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:stretch;padding:4px 5px;border:1px solid rgba(var(--class-accent),.22);border-radius:7px;background:linear-gradient(120deg,rgba(var(--class-accent),.1),rgba(7,12,21,.87) 58%,rgba(var(--class-secondary),.045))}
          .class-subclass-selected-row__summary{display:grid;grid-template-columns:58px minmax(0,1fr) 20px;gap:6px;align-items:center;min-width:0;padding:0;border:0;color:inherit;background:transparent;text-align:left}
          .class-subclass-selected-row__summary:focus-visible{outline:1px solid rgba(var(--class-secondary),.7);outline-offset:2px}
          .class-subclass-selected-row__art{display:block;width:58px;height:30px;overflow:hidden;border:1px solid rgba(var(--class-accent),.38);border-radius:5px;background:#090d15}.class-subclass-selected-row__art img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}
          .class-subclass-selected-row__mark{display:grid;place-items:center;width:19px;height:19px;border:1px solid rgba(var(--class-secondary),.58);border-radius:50%;color:#d8fff9;background:rgba(var(--class-secondary),.1);font-size:.52rem}
          .class-subclass-selected-row__copy{display:grid;gap:0;min-width:0}.class-subclass-selected-row__copy small{color:rgba(255,255,255,.4);font-size:.37rem;font-weight:800;letter-spacing:.035em;text-transform:uppercase}.class-subclass-selected-row__copy strong{color:#f4ebfa;font-family:Georgia,"Times New Roman",serif;font-size:.63rem;font-weight:650;line-height:1.2}.class-subclass-selected-row__copy em{overflow:hidden;color:rgba(255,255,255,.56);font-size:.43rem;font-style:normal;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}
          .class-subclass-selected-row__actions{display:flex;align-items:center;gap:4px}.class-subclass-selected-row__actions button{padding:4px 7px;border:1px solid rgba(var(--class-accent),.46);border-radius:6px;color:#fff;background:linear-gradient(180deg,rgba(var(--class-accent),.35),rgba(54,34,90,.64));font-size:.43rem;font-weight:800}.class-subclass-selected-row__actions button.is-muted{border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.52);background:rgba(255,255,255,.02)}.class-subclass-selected-row__actions button:hover,.class-subclass-selected-row__actions button:focus-visible{border-color:rgba(var(--class-secondary),.65);outline:none}
          @media(max-width:760px){.class-subclass-selected-row{grid-template-columns:1fr}.class-subclass-selected-row__actions{justify-content:flex-end}}
        `}</style>
      </section>
    );
  }

  return (
    <section className={`npc-forge-class-guide__subclasses is-compact class-subclass-section is-two-column${detailed ? " is-detailed" : ""}${required && !selected ? " is-required" : ""}`}>
      <div className="class-subclass-two-column__head">
        <span className="class-subclass-two-column__head-icon" aria-hidden="true">✦</span>
        <div>
          <span>Choose your subclass</span>
          <small>Select a subclass to add its features to progression. Click any row to show details in the movable Feature card.</small>
        </div>
        {selected ? <button type="button" className="class-subclass-two-column__collapse" onClick={() => setExpanded(false)} aria-label="Collapse subclass selector">⌃</button> : null}
      </div>

      <div className="class-subclass-two-column__scroll" role="list" aria-label="Subclass catalogue">
        <div className="class-subclass-two-column__grid">
          {orderedOptions.map((option) => {
            const isSelected = selected?.key === option.key;
            const eligible = optionEntryLevel(option) <= currentLevel;
            return (
              <button
                key={option.key}
                type="button"
                role="listitem"
                className={`class-subclass-two-column__card${isSelected ? " is-selected" : ""}${eligible ? " is-eligible" : " is-locked"}`}
                aria-pressed={isSelected}
                aria-label={`${option.name}, ${eligible ? "selectable now" : `available at level ${optionEntryLevel(option)}`}`}
                onClick={() => choose(option)}
              >
                <span className="class-subclass-two-column__art" aria-hidden="true">
                  <img src={subclassArtworkFor(classKey, option)} onError={(event) => handleSubclassArtworkError(event, classKey)} alt="" />
                </span>
                <span className="class-subclass-two-column__copy">
                  <strong>{text(option.name) || "Subclass"}</strong>
                  <small>{optionSummary(option)}</small>
                </span>
                <span className="class-subclass-two-column__source">{sourceLabel(option.source)}</span>
                <span className={`class-subclass-two-column__status${isSelected ? " is-selected" : ""}`} aria-hidden="true">{isSelected ? "✓" : eligible ? "" : `L${optionEntryLevel(option)}`}</span>
              </button>
            );
          })}
        </div>
      </div>

      {required && !selected ? <p className="npc-forge-class-guide__requirement">Choose an eligible subclass before continuing.</p> : null}
      {!required && entryLevel ? <p className="npc-forge-class-guide__subclass-level-note">You can review every subclass now. Selection unlocks at level {entryLevel}.</p> : null}

      <style jsx global>{`
        .class-subclass-section.is-two-column{display:grid;gap:4px!important;padding:5px 6px 6px!important;border:1px solid rgba(var(--class-accent),.22)!important;border-radius:8px!important;background:linear-gradient(145deg,rgba(19,17,31,.68),rgba(6,12,21,.82))!important}
        .class-subclass-two-column__head{display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:6px;padding:0 1px 4px;border-bottom:1px solid rgba(var(--class-accent),.13)}.class-subclass-two-column__head-icon{display:grid!important;place-items:center;width:22px;height:22px;border:1px solid rgba(var(--class-accent),.44);border-radius:5px;color:#d7b4ff!important;background:rgba(var(--class-accent),.08);font-size:.52rem!important}.class-subclass-two-column__head>div{display:grid;gap:0;min-width:0}.class-subclass-two-column__head>div>span{color:#d4a8ff;font-family:Georgia,"Times New Roman",serif;font-size:.67rem;font-weight:650;letter-spacing:.025em;text-transform:uppercase}.class-subclass-two-column__head small{overflow:hidden;color:rgba(255,255,255,.48);font-size:.43rem;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}.class-subclass-two-column__collapse{display:grid;place-items:center;width:22px;height:22px;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:6px;color:rgba(255,255,255,.72);background:rgba(255,255,255,.025);font-size:.62rem;font-weight:900}.class-subclass-two-column__collapse:hover,.class-subclass-two-column__collapse:focus-visible{border-color:rgba(var(--class-secondary),.52);color:#fff;outline:none}
        .class-subclass-two-column__scroll{max-height:min(22vh,164px);overflow-y:auto;overscroll-behavior:contain;padding:0 3px 0 0;scrollbar-gutter:stable}.class-subclass-two-column__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}
        .class-subclass-two-column__card{display:grid;grid-template-columns:60px minmax(0,1fr) auto 20px;gap:5px;align-items:center;min-width:0;min-height:38px;padding:3px 5px;border:1px solid rgba(255,255,255,.1);border-radius:6px;color:rgba(255,255,255,.78);background:linear-gradient(145deg,rgba(14,18,29,.94),rgba(7,11,19,.98));text-align:left;transition:border-color .15s ease,background .15s ease,box-shadow .15s ease}.class-subclass-two-column__card:hover,.class-subclass-two-column__card:focus-visible{border-color:rgba(var(--class-secondary),.44);background:linear-gradient(145deg,rgba(14,33,39,.46),rgba(8,13,22,.98));outline:none}.class-subclass-two-column__card.is-selected{border-color:rgba(var(--class-accent),.86);background:linear-gradient(145deg,rgba(var(--class-accent),.2),rgba(9,15,26,.98));box-shadow:inset 2px 0 rgb(var(--class-secondary)),0 0 12px rgba(var(--class-accent),.07)}.class-subclass-two-column__card.is-locked{opacity:.64}.class-subclass-two-column__card.is-locked:hover,.class-subclass-two-column__card.is-locked:focus-visible{opacity:1}
        .class-subclass-two-column__art{display:block;width:60px;height:30px;overflow:hidden;border:1px solid rgba(var(--class-accent),.28);border-radius:4px;background:#080c14}.class-subclass-two-column__art img{display:block;width:100%;height:100%;object-fit:cover;object-position:center;filter:saturate(.95) contrast(1.04)}.class-subclass-two-column__copy{display:grid;gap:0;min-width:0}.class-subclass-two-column__copy strong{overflow:hidden;color:#f2eaf9;font-family:Georgia,"Times New Roman",serif;font-size:.57rem;font-weight:650;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}.class-subclass-two-column__copy small{overflow:hidden;color:rgba(255,255,255,.45);font-size:.39rem;line-height:1.18;text-overflow:ellipsis;white-space:nowrap}.class-subclass-two-column__source{padding:1px 4px;border:1px solid rgba(var(--class-secondary),.17);border-radius:999px;color:rgba(215,255,249,.68);background:rgba(var(--class-secondary),.045);font-size:.34rem;font-weight:900;white-space:nowrap}.class-subclass-two-column__status{display:grid;place-items:center;min-width:18px;height:18px;color:rgba(255,255,255,.35);font-size:.34rem;font-weight:900}.class-subclass-two-column__status.is-selected{border:1px solid rgba(var(--class-secondary),.6);border-radius:50%;color:#d8fff9;background:rgba(var(--class-secondary),.11);font-size:.48rem}
        .class-subclass-section.is-two-column .npc-forge-class-guide__requirement,.class-subclass-section.is-two-column .npc-forge-class-guide__subclass-level-note{padding:1px 2px 0!important;font-size:.42rem!important}
        @media(max-width:760px){.class-subclass-two-column__grid{grid-template-columns:1fr}.class-subclass-two-column__scroll{max-height:min(34vh,245px)}.class-subclass-two-column__head small{white-space:normal}.class-subclass-two-column__card{grid-template-columns:62px minmax(0,1fr) auto 20px}}
      `}</style>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import ClassFeatureText, { classFeatureInline } from "./ClassFeatureText";

const text = (value) => String(value ?? "").trim();
const normalized = (value) => text(value).toLowerCase();

function introFeature(option = {}) {
  return option?.features?.find((feature) => feature?.isIntroduction) || option?.features?.[0] || null;
}

function optionSummary(option = {}) {
  const intro = introFeature(option);
  return classFeatureInline(
    intro?.description,
    `Explore the defining features and play style of ${option?.name || "this subclass"}.`,
  );
}

function featurePreview(option = {}) {
  return (option?.features || [])
    .filter((feature) => !feature?.isIntroduction)
    .slice(0, 6);
}

export default function ClassSubclassSection({ model, onPreviewSubclass = null, detailed = false }) {
  const [browserOpen, setBrowserOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [expandedKey, setExpandedKey] = useState("");
  const options = model?.options || [];
  const selected = model?.selected || null;
  const required = (model?.eligible || []).length > 0;
  const optionSignature = options.map((option) => option.key).join("|");

  useEffect(() => {
    setBrowserOpen(false);
    setSearch("");
    setSource("all");
    setExpandedKey("");
  }, [optionSignature]);

  const sources = useMemo(() => [
    "all",
    ...Array.from(new Set(options.map((option) => text(option.source)).filter(Boolean))),
  ], [options]);

  const filtered = useMemo(() => {
    const query = normalized(search);
    return options.filter((option) => {
      const matchesSource = source === "all" || text(option.source) === source;
      if (!matchesSource) return false;
      if (!query) return true;
      return normalized(`${option.name} ${option.source} ${optionSummary(option)}`).includes(query);
    });
  }, [options, search, source]);

  if (!options.length) {
    return <section className={`npc-forge-class-guide__subclasses is-compact class-subclass-section is-empty${detailed ? " is-detailed" : ""}`}>
      <div className="class-subclass-summary__eyebrow"><span>Subclass</span><strong>No subclasses listed</strong></div>
      <p>No imported subclass catalogue is available for this class.</p>
    </section>;
  }

  const summary = selected
    ? optionSummary(selected)
    : "Browse every published specialization for this class without crowding the overview. You can inspect any option now and choose it once your current level makes it eligible.";
  const unlockLevel = Number(model?.entryLevel || options[0]?.firstLevel || 1);

  const previewOption = (option, expand = false) => {
    onPreviewSubclass?.(option);
    if (expand) setExpandedKey((current) => current === option.key ? "" : option.key);
  };

  const chooseOption = (option) => {
    onPreviewSubclass?.(option);
    if (Number(option.firstLevel || 1) <= Number(model?.currentLevel || 1)) model.selectSubclass(option);
  };

  return <section
    className={`npc-forge-class-guide__subclasses is-compact class-subclass-section${detailed ? " is-detailed" : ""}${required && !selected ? " is-required" : ""}${browserOpen ? " is-browser-open" : ""}`}
    onKeyDown={(event) => { if (event.key === "Escape" && browserOpen) setBrowserOpen(false); }}
  >
    <div className="class-subclass-summary">
      <div className="class-subclass-summary__copy">
        <div className="class-subclass-summary__eyebrow">
          <span>Subclass</span>
          <strong>{selected ? "Selected" : model?.currentLevel >= unlockLevel ? `Available now · level ${unlockLevel}` : `Available at level ${unlockLevel}`}</strong>
        </div>
        <h3>{selected ? selected.name : "Choose your specialization"}</h3>
        {selected ? <div className="class-subclass-summary__meta"><span>{selected.source || "Campaign"}</span><span>Level {selected.firstLevel || unlockLevel}</span></div> : null}
        <p>{summary}</p>
      </div>
      <div className="class-subclass-summary__actions">
        <button type="button" className="is-primary" aria-expanded={browserOpen} aria-controls="class-subclass-browser" onClick={() => setBrowserOpen((open) => !open)}>{browserOpen ? "Close Browser" : selected ? "Change Subclass" : "Browse Subclasses"}</button>
        {selected ? <button type="button" onClick={() => model.selectSubclass(null)}>Clear choice</button> : null}
      </div>
    </div>

    {required && !selected ? <p className="npc-forge-class-guide__requirement">Choose an eligible subclass before continuing.</p> : null}
    {!required && model?.entryLevel ? <p className="npc-forge-class-guide__subclass-level-note">You can browse every subclass now. Selection opens at level {model.entryLevel}.</p> : null}

    {browserOpen ? <div id="class-subclass-browser" className="class-subclass-browser">
      <div className="class-subclass-browser__header">
        <div><span>Subclass Browser</span><strong>{filtered.length} of {options.length}</strong></div>
        <button type="button" aria-label="Close subclass browser" onClick={() => setBrowserOpen(false)}>×</button>
      </div>
      <div className="class-subclass-browser__toolbar">
        <label className="class-subclass-browser__search"><span>Search subclasses</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subclasses..." /></label>
        <div className="class-subclass-browser__sources" aria-label="Subclass source filters">
          {sources.map((entry) => <button key={entry} type="button" className={source === entry ? "is-active" : ""} aria-pressed={source === entry} onClick={() => setSource(entry)}>{entry === "all" ? "All" : entry}</button>)}
        </div>
      </div>

      {filtered.length ? <div className="class-subclass-browser__results" role="list" aria-label="Subclass catalogue">
        {filtered.map((option) => {
          const isSelected = selected?.key === option.key;
          const isExpanded = expandedKey === option.key;
          const eligible = Number(option.firstLevel || 1) <= Number(model?.currentLevel || 1);
          const features = featurePreview(option);
          const intro = introFeature(option);
          return <article key={option.key} role="listitem" className={`class-subclass-card${isSelected ? " is-selected" : ""}${isExpanded ? " is-expanded" : ""}`}>
            <div className="class-subclass-card__head">
              <div><h4>{option.name}</h4><div className="class-subclass-card__meta"><span>{option.source || "Campaign"}</span><span>Level {option.firstLevel || unlockLevel}</span>{isSelected ? <b>Selected</b> : null}</div></div>
              <span className="class-subclass-card__mark" aria-hidden="true">{isSelected ? "✓" : "✦"}</span>
            </div>
            <p className="class-subclass-card__summary">{optionSummary(option)}</p>
            {isExpanded ? <div className="class-subclass-card__details">
              <ClassFeatureText text={intro?.description} entries={intro?.entries || null} fallback="Its source-backed features are shown at the levels where they become available." />
              {features.length ? <div className="class-subclass-card__feature-list">{features.map((feature, index) => <span key={`${feature.name}-${feature.level}-${index}`}><b>Level {feature.level || option.firstLevel || unlockLevel}</b>{feature.name}</span>)}</div> : null}
            </div> : null}
            <div className="class-subclass-card__actions">
              <button type="button" aria-expanded={isExpanded} onClick={() => previewOption(option, true)}>{isExpanded ? "Collapse" : "Details"}</button>
              <button type="button" className="is-primary" disabled={!eligible || isSelected} onClick={() => chooseOption(option)}>{isSelected ? "Selected" : eligible ? "Choose" : `Available at level ${option.firstLevel || unlockLevel}`}</button>
            </div>
          </article>;
        })}
      </div> : <div className="class-subclass-browser__empty">No subclasses match <strong>{search ? `“${search}”` : "this source"}</strong>.<button type="button" onClick={() => { setSearch(""); setSource("all"); }}>Clear filters</button></div>}
    </div> : null}

    <style jsx global>{`
      .class-subclass-section{position:relative;display:grid;gap:8px!important;padding:0!important;background:transparent!important}
      .class-subclass-section.is-required{padding:7px 8px!important}
      .class-subclass-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;min-height:92px;padding:12px 13px;border:1px solid rgba(var(--class-accent),.2);border-radius:10px;background:linear-gradient(120deg,rgba(17,17,30,.9),rgba(8,13,22,.8) 64%,rgba(var(--class-accent),.07));box-shadow:inset 0 1px rgba(255,255,255,.025)}
      .class-subclass-summary__copy{min-width:0}.class-subclass-summary__eyebrow{display:flex;align-items:baseline;gap:9px;margin-bottom:3px}.class-subclass-summary__eyebrow span{color:#d4a8ff;font-family:Georgia,"Times New Roman",serif;font-size:.72rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase}.class-subclass-summary__eyebrow strong{color:rgba(255,255,255,.46);font-size:.52rem;font-weight:700}.class-subclass-summary h3{margin:0 0 3px;color:#f6efe6;font-family:Georgia,"Times New Roman",serif;font-size:.94rem;font-weight:600}.class-subclass-summary p{max-width:76ch;margin:0;color:rgba(245,238,226,.7);font-size:.61rem;line-height:1.48}.class-subclass-summary__meta{display:flex;gap:6px;margin-bottom:5px}.class-subclass-summary__meta span{padding:2px 6px;border:1px solid rgba(var(--class-secondary),.18);border-radius:999px;color:rgba(255,255,255,.5);background:rgba(6,14,22,.45);font-size:.46rem;font-weight:800}.class-subclass-summary__actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}.class-subclass-summary__actions button,.class-subclass-browser button,.class-subclass-card__actions button{border:1px solid rgba(255,255,255,.14);border-radius:7px;color:rgba(255,255,255,.78);background:rgba(255,255,255,.025);font-size:.56rem;font-weight:800}.class-subclass-summary__actions button{padding:7px 9px}.class-subclass-summary__actions button.is-primary,.class-subclass-card__actions button.is-primary{border-color:rgba(var(--class-accent),.7);color:#fff;background:linear-gradient(180deg,rgba(var(--class-accent),.48),rgba(56,34,92,.76))}
      .class-subclass-browser{display:grid;gap:9px;padding:10px;border:1px solid rgba(var(--class-accent),.28);border-radius:11px;background:rgba(6,10,18,.95);box-shadow:0 16px 32px rgba(0,0,0,.26),inset 0 1px rgba(255,255,255,.025);backdrop-filter:blur(9px)}
      .class-subclass-browser__header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:7px;border-bottom:1px solid rgba(var(--class-accent),.14)}.class-subclass-browser__header>div{display:flex;align-items:baseline;gap:8px}.class-subclass-browser__header span{color:#dec2ff;font-family:Georgia,"Times New Roman",serif;font-size:.76rem;font-weight:700;letter-spacing:.045em;text-transform:uppercase}.class-subclass-browser__header strong{color:rgba(255,255,255,.42);font-size:.5rem}.class-subclass-browser__header>button{display:grid;place-items:center;width:25px;height:25px;padding:0;font-size:.95rem}
      .class-subclass-browser__toolbar{display:grid;grid-template-columns:minmax(190px,.75fr) minmax(0,1.25fr);gap:9px;align-items:end}.class-subclass-browser__search{display:grid;gap:4px}.class-subclass-browser__search span{color:rgba(255,255,255,.42);font-size:.47rem;font-weight:800;letter-spacing:.055em;text-transform:uppercase}.class-subclass-browser__search input{width:100%;min-height:32px;padding:6px 8px;border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#f4edf9;background:rgba(3,7,13,.86);font-size:.61rem;outline:none}.class-subclass-browser__search input:focus{border-color:rgba(var(--class-secondary),.52);box-shadow:0 0 0 2px rgba(var(--class-secondary),.07)}.class-subclass-browser__sources{display:flex;justify-content:flex-end;gap:5px;overflow-x:auto;padding-bottom:1px}.class-subclass-browser__sources button{flex:0 0 auto;padding:6px 8px}.class-subclass-browser__sources button.is-active{border-color:rgba(var(--class-secondary),.54);color:#bff9f1;background:rgba(var(--class-secondary),.11)}
      .class-subclass-browser__results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:min(48vh,520px);overflow-y:auto;overscroll-behavior:contain;padding:1px 4px 2px 1px;scrollbar-gutter:stable}.class-subclass-card{display:grid;align-content:start;gap:7px;min-width:0;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:linear-gradient(145deg,rgba(14,18,29,.94),rgba(7,11,19,.98));box-shadow:inset 0 1px rgba(255,255,255,.015)}.class-subclass-card.is-selected{border-color:rgba(var(--class-secondary),.56);box-shadow:inset 3px 0 rgba(var(--class-secondary),.72),0 0 16px rgba(var(--class-secondary),.06)}.class-subclass-card.is-expanded{grid-column:1/-1;border-color:rgba(var(--class-accent),.58);background:linear-gradient(145deg,rgba(var(--class-accent),.1),rgba(7,11,19,.98))}.class-subclass-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.class-subclass-card h4{margin:0;color:#f2eaf9;font-family:Georgia,"Times New Roman",serif;font-size:.7rem;font-weight:650;line-height:1.25}.class-subclass-card__meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:3px}.class-subclass-card__meta span,.class-subclass-card__meta b{color:rgba(255,255,255,.38);font-size:.43rem;font-weight:800}.class-subclass-card__meta b{color:#9cece2}.class-subclass-card__mark{display:grid;place-items:center;flex:0 0 auto;width:22px;height:22px;border:1px solid rgba(var(--class-accent),.3);border-radius:50%;color:rgb(var(--class-secondary));background:rgba(var(--class-accent),.06);font-size:.58rem}.class-subclass-card__summary{display:-webkit-box;overflow:hidden;margin:0;color:rgba(255,255,255,.62);font-size:.55rem;line-height:1.46;-webkit-line-clamp:3;-webkit-box-orient:vertical}.class-subclass-card.is-expanded .class-subclass-card__summary{display:none}.class-subclass-card__details{display:grid;gap:8px;padding-top:2px;border-top:1px solid rgba(255,255,255,.07)}.class-subclass-card__details p,.class-subclass-card__details li{color:rgba(255,255,255,.72);font-size:.59rem;line-height:1.52}.class-subclass-card__feature-list{display:flex;gap:5px;flex-wrap:wrap}.class-subclass-card__feature-list span{display:grid;gap:1px;padding:5px 7px;border:1px solid rgba(var(--class-accent),.14);border-radius:6px;color:rgba(255,255,255,.66);background:rgba(8,12,20,.64);font-size:.49rem}.class-subclass-card__feature-list b{color:#b9efe9;font-size:.4rem;text-transform:uppercase}.class-subclass-card__actions{display:flex;justify-content:flex-end;gap:6px;margin-top:auto}.class-subclass-card__actions button{padding:6px 8px}.class-subclass-card__actions button:disabled{opacity:.48;cursor:not-allowed}.class-subclass-browser__empty{display:grid;place-items:center;gap:7px;min-height:110px;color:rgba(255,255,255,.54);font-size:.6rem;text-align:center}.class-subclass-browser__empty button{padding:6px 9px}
      @media(max-width:900px){.class-subclass-summary{grid-template-columns:1fr}.class-subclass-summary__actions{justify-content:flex-start}.class-subclass-browser__toolbar{grid-template-columns:1fr}.class-subclass-browser__sources{justify-content:flex-start}.class-subclass-browser__results{grid-template-columns:1fr;max-height:min(54vh,560px)}}
    `}</style>
  </section>;
}

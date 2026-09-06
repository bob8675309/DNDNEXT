const text = (value) => String(value ?? "").trim();

function sourceLabel(source = "") {
  if (source === "XPHB") return "2024";
  if (source === "PHB") return "2014";
  return source || "Campaign";
}

function optionEntryLevel(option = {}) {
  return Math.max(1, Number(option?.firstLevel || 1));
}

export default function ClassSubclassSection({
  model,
  onInspectSubclass = null,
  detailed = false,
}) {
  const options = model?.options || [];
  const selected = model?.selected || null;
  const currentLevel = Math.max(1, Number(model?.currentLevel || 1));
  const entryLevel = Number(model?.entryLevel || options[0]?.firstLevel || 1);
  const required = (model?.eligible || []).length > 0;

  if (!options.length) {
    return (
      <section className={`npc-forge-class-guide__subclasses is-compact class-subclass-section is-empty${detailed ? " is-detailed" : ""}`}>
        <div className="npc-forge-class-guide__subhead">
          <div><span>Subclass</span><strong>No subclasses listed</strong></div>
        </div>
      </section>
    );
  }

  function inspect(option) {
    onInspectSubclass?.(option);
  }

  function choose(option) {
    inspect(option);
    if (optionEntryLevel(option) > currentLevel) return;
    model.setPreviewKey(option.key);
    model.selectSubclass(option);
  }

  function clearSelection() {
    model.selectSubclass(null);
  }

  const status = selected
    ? `Selected: ${selected.name}`
    : currentLevel >= entryLevel
      ? "Choose a specialization"
      : `Selection opens at level ${entryLevel}`;

  return (
    <section className={`npc-forge-class-guide__subclasses is-compact class-subclass-section is-inline-selector${detailed ? " is-detailed" : ""}${required && !selected ? " is-required" : ""}`}>
      <div className="npc-forge-class-guide__subhead class-subclass-inline__head">
        <div><span>Subclass</span><strong>{status}</strong></div>
        {selected ? <button type="button" className="class-subclass-inline__clear" onClick={clearSelection}>Clear</button> : null}
      </div>

      <div className="npc-forge-class-guide__subclass-grid class-subclass-inline__grid" role="list" aria-label="Subclass catalogue">
        {options.map((option) => {
          const isSelected = selected?.key === option.key;
          const eligible = optionEntryLevel(option) <= currentLevel;
          return (
            <button
              key={option.key}
              type="button"
              role="listitem"
              className={`${isSelected ? "is-active is-selected" : ""}${eligible ? " is-eligible" : " is-locked"}`}
              aria-pressed={isSelected}
              aria-label={`${option.name}, ${eligible ? "selectable now" : `available at level ${optionEntryLevel(option)}`}`}
              title={eligible ? `Select ${option.name}` : `${option.name} can be inspected now and selected at level ${optionEntryLevel(option)}`}
              onMouseEnter={() => inspect(option)}
              onFocus={() => inspect(option)}
              onClick={() => choose(option)}
            >
              <span className="npc-forge-class-guide__subclass-mark" aria-hidden="true">{isSelected ? "✓" : eligible ? "✦" : "◇"}</span>
              <span className="npc-forge-class-guide__subclass-label">
                <strong>{text(option.name) || "Subclass"}</strong>
                <small>{sourceLabel(option.source)} · L{optionEntryLevel(option)}{isSelected ? " · selected" : eligible ? "" : " · preview"}</small>
              </span>
            </button>
          );
        })}
      </div>

      {required && !selected ? <p className="npc-forge-class-guide__requirement">Choose an eligible subclass before continuing.</p> : null}
      {!required && entryLevel ? <p className="npc-forge-class-guide__subclass-level-note">Hover or focus any subclass to inspect it in the movable Feature card. Selection unlocks at level {entryLevel}.</p> : null}

      <style jsx global>{`
        .class-subclass-section.is-inline-selector{display:grid;gap:6px!important;padding:7px 8px 8px!important;border:1px solid rgba(var(--class-accent),.17)!important;border-radius:9px!important;background:linear-gradient(145deg,rgba(20,18,32,.62),rgba(6,12,21,.74))!important}
        .class-subclass-inline__head{padding-bottom:5px!important}.class-subclass-inline__head>div:first-child{min-width:0}.class-subclass-inline__head strong{max-width:min(520px,55vw)}
        .class-subclass-inline__clear{padding:4px 7px;border:1px solid rgba(255,255,255,.13);border-radius:6px;color:rgba(255,255,255,.72);background:rgba(255,255,255,.025);font-size:.5rem;font-weight:800}.class-subclass-inline__clear:hover,.class-subclass-inline__clear:focus-visible{border-color:rgba(var(--class-secondary),.48);color:#fff;outline:none}
        .class-subclass-inline__grid{grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:5px!important}
        .class-subclass-inline__grid>button{min-height:34px!important;padding:5px 6px!important}.class-subclass-inline__grid .npc-forge-class-guide__subclass-mark{width:18px;height:18px;font-size:.5rem}.class-subclass-inline__grid .npc-forge-class-guide__subclass-label strong{font-size:.55rem}.class-subclass-inline__grid .npc-forge-class-guide__subclass-label small{font-size:.39rem}
        .class-subclass-inline__grid>button.is-locked{opacity:.72}.class-subclass-inline__grid>button.is-locked:hover,.class-subclass-inline__grid>button.is-locked:focus-visible{opacity:1;border-color:rgba(var(--class-secondary),.46);background:linear-gradient(145deg,rgba(14,34,40,.42),rgba(9,14,23,.98))}.class-subclass-inline__grid>button.is-locked .npc-forge-class-guide__subclass-mark{color:rgba(255,255,255,.48);border-color:rgba(255,255,255,.15)}
        @media(max-width:1280px){.class-subclass-inline__grid{grid-template-columns:repeat(5,minmax(0,1fr))!important}}
        @media(max-width:1040px){.class-subclass-inline__grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
        @media(max-width:760px){.class-subclass-inline__grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.class-subclass-inline__head strong{max-width:70vw}}
      `}</style>
    </section>
  );
}

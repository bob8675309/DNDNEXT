import { ABILITY_LABELS } from "../utils/characterCreation";
import { classArtworkFor, handleClassArtworkError } from "../utils/classes/classArtwork";
import ClassFeatureText, { classFeatureInline, normalizeClassFeatureText } from "./ClassFeatureText";
import { classSlotSummary, classSourceLabel, useNpcForgeClassGuideModel } from "./NpcForgeClassGuideModel";
import NpcForgeClassGuideStyles from "./NpcForgeClassGuideStyles";

function cleanPlayerCopy(value, fallback = "") {
  return classFeatureInline(value, fallback);
}

function heroFacts(selectedClass, currentLevel) {
  return [
    ["Hit Die", `d${selectedClass?.hit_die || 8}`],
    ["Starting Level", currentLevel],
    ["Saving Throws", (selectedClass?.saving_throws || []).map((key) => ABILITY_LABELS[key] || key).join(", ") || "Varies"],
    ["Spellcasting", ABILITY_LABELS[selectedClass?.spellcasting_ability] || "None at base class"],
  ];
}

function featureDetailPayload(feature, level, preview) {
  return {
    type: "classFeature",
    feature: {
      ...feature,
      description: normalizeClassFeatureText(feature?.description, "No source description is available for this feature."),
      level: Number(level || feature?.level || 1),
    },
    subclassName: feature?.type === "subclass" ? preview?.name || "Subclass" : "",
  };
}

function publishFeature(model, onFeatureDetail, feature, level) {
  const payload = featureDetailPayload(feature, level, model.preview);
  model.setPinned(payload.feature);
  onFeatureDetail?.(payload);
}

function ForgeClassHero({ selectedClass, currentLevel }) {
  return (
    <header id="forge-class-guide-introduction" className="class-book-guide__hero npc-forge-class-guide__book-hero">
      <div className="npc-forge-class-guide__hero-copy">
        <div className="spell-admin-kicker">{classSourceLabel(selectedClass.source)}</div>
        <h2>{selectedClass.class_name}</h2>
        <p>{cleanPlayerCopy(selectedClass.summary, `A complete level-by-level guide to the ${selectedClass.class_name} class.`)}</p>
        <div className="npc-forge-class-guide__hero-facts">
          {heroFacts(selectedClass, currentLevel).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
      </div>
      <img src={classArtworkFor(selectedClass.class_key)} onError={handleClassArtworkError} alt={`${selectedClass.class_name} class reference artwork`} />
    </header>
  );
}

function ForgeSubclassSelection({ model }) {
  const required = model.eligible.length > 0;
  return (
    <section className={`npc-forge-class-guide__subclasses ${required && !model.selected ? "is-required" : ""}`}>
      <div className="npc-forge-class-guide__subhead">
        <div><span>Subclass</span><strong>{model.selected ? `${model.selected.name} selected` : required ? "Selection required" : model.entryLevel ? `Available at level ${model.entryLevel}` : "No subclasses listed"}</strong></div>
        {model.options.length > 1 ? <label><input type="checkbox" checked={model.compareAll} onChange={(event) => model.setCompareAll(event.target.checked)} /> Compare all</label> : null}
      </div>
      {model.options.length ? (
        <div className="npc-forge-class-guide__controls">
          <label><span>Preview subclass</span><select value={model.preview?.key || ""} onChange={(event) => model.setPreviewKey(event.target.value)}>{model.options.map((option) => <option key={option.key} value={option.key}>{option.name} • {option.source}{Number(option.firstLevel || 1) > model.currentLevel ? ` • level ${option.firstLevel}` : ""}</option>)}</select></label>
          <button type="button" className="is-primary" disabled={!model.previewEligible || model.selected?.key === model.preview?.key} onClick={() => model.selectSubclass(model.preview)}>{model.selected?.key === model.preview?.key ? "Selected" : model.previewEligible ? "Choose subclass" : `Available at level ${model.preview?.firstLevel || model.entryLevel}`}</button>
          {model.selected ? <button type="button" onClick={() => model.selectSubclass(null)}>Clear choice</button> : null}
        </div>
      ) : <p>No imported subclass catalogue is available for this class.</p>}
      {required && !model.selected ? <p className="npc-forge-class-guide__requirement">Choose an eligible subclass before continuing. Previewing does not select it.</p> : null}
      {!required && model.entryLevel ? <p>Subclasses may be previewed now. Selection opens at level {model.entryLevel}.</p> : null}
      {model.compareAll ? (
        <details className="npc-forge-class-guide__compare-drawer"><summary>Compare subclass summaries</summary><div>{model.options.map((option) => <button key={option.key} type="button" className={model.preview?.key === option.key ? "is-active" : ""} onClick={() => model.setPreviewKey(option.key)}><strong>{option.name}</strong><small>{option.source} • first feature level {option.firstLevel}</small><span>{cleanPlayerCopy(option.features?.find((feature) => feature.isIntroduction)?.description, "Preview this subclass in the guide below.")}</span></button>)}</div></details>
      ) : null}
    </section>
  );
}

function ProgressionTable({ model, onFeatureDetail }) {
  return (
    <section className="npc-card class-level-guide__table-card npc-forge-class-guide__table-card">
      <div className="class-level-guide__table" role="table">
        <div className="class-level-guide__row is-head" role="row"><div>Level</div><div>PB</div><div>Features</div><div>Cantrips</div><div>Known / Prepared</div><div>Spell Slots</div></div>
        {model.rows.map((row) => (
          <div key={row.class_level} className={`class-level-guide__row ${Number(row.class_level) === model.currentLevel ? "is-current" : ""}`} role="row">
            <div><strong>{row.class_level}</strong>{Number(row.class_level) === model.currentLevel ? <span>Current</span> : null}</div>
            <div>+{Number(row.proficiency_bonus || 2)}</div>
            <div className="class-level-guide__features">{row.guideFeatures.length ? row.guideFeatures.map((feature, index) => <button type="button" key={`${feature.type}-${feature.name}-${index}`} className={feature.type === "subclass" ? "is-subclass" : ""} title={cleanPlayerCopy(feature.description)} onMouseEnter={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onFocus={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onClick={() => publishFeature(model, onFeatureDetail, feature, row.class_level)}>{feature.type === "subclass" && model.preview ? `${model.preview.name}: ` : ""}{feature.name}</button>) : <span className="text-muted">—</span>}</div>
            <div>{row.cantrips_known ?? "—"}</div><div>{row.spells_known ?? "—"}</div><div className="class-level-guide__slots">{classSlotSummary(row.spell_slots)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SubclassIntro({ model, detailed = false }) {
  if (!model.preview) return null;
  return (
    <section id={detailed ? "forge-class-guide-subclass" : undefined} className={`class-book-guide__subclass-intro ${detailed ? "" : "npc-forge-class-guide__subclass-intro"}`}>
      <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap"><div><div className="spell-admin-kicker">{model.selected?.key === model.preview.key ? "Selected Subclass" : "Previewed Subclass"}</div><h3>{model.preview.name}</h3></div><span className="badge text-bg-info">{model.preview.source}</span></div>
      <ClassFeatureText text={model.intro?.description} fallback={detailed ? "Its source-backed features are included at the applicable levels below." : "Its features are included at the levels where they become available."} />
      {detailed && model.preview.isLegacyCompatibility ? <div className="class-book-guide__compatibility-note">This supplemental subclass uses its published feature text with its entry level aligned to the 2024 level-3 subclass slot.</div> : null}
    </section>
  );
}

function ForgeOverview({ selectedClass, model, onFeatureDetail }) {
  return <article className="npc-card class-book-guide__content npc-forge-class-guide__overview-book"><ForgeClassHero selectedClass={selectedClass} currentLevel={model.currentLevel} /><div className="npc-forge-class-guide__overview-body"><ForgeSubclassSelection model={model} /><SubclassIntro model={model} /><ProgressionTable model={model} onFeatureDetail={onFeatureDetail} /></div></article>;
}

function ForgeDetailedGuide({ selectedClass, model, onFeatureDetail }) {
  const visibleRows = model.rows.filter((row) => row.guideFeatures.length);
  return (
    <div className="class-book-guide npc-forge-class-guide__book">
      <aside className="npc-card class-book-guide__outline"><div className="spell-admin-kicker">Guide Outline</div><a href="#forge-class-guide-introduction">{selectedClass.class_name}</a>{model.preview ? <a href="#forge-class-guide-subclass">{model.preview.name}</a> : null}<div className="class-book-guide__outline-levels">{visibleRows.map((row) => <a key={row.class_level} href={`#forge-class-guide-level-${row.class_level}`}>Level {row.class_level}</a>)}</div></aside>
      <article className="npc-card class-book-guide__content">
        <ForgeClassHero selectedClass={selectedClass} currentLevel={model.currentLevel} />
        <div className="npc-forge-class-guide__detailed-controls"><ForgeSubclassSelection model={model} /></div>
        <SubclassIntro model={model} detailed />
        <div className="class-book-guide__levels">{visibleRows.map((row) => (
          <section key={row.class_level} id={`forge-class-guide-level-${row.class_level}`} className={Number(row.class_level) === model.currentLevel ? "is-current" : ""}>
            <div className="class-book-guide__level-heading npc-forge-class-guide__level-heading"><div><div className="spell-admin-kicker">Level {row.class_level}</div><h3>{selectedClass.class_name} {row.class_level}</h3></div><div className="class-book-guide__level-stats"><span>PB +{Number(row.proficiency_bonus || 2)}</span>{row.cantrips_known != null ? <span>{row.cantrips_known} cantrips</span> : null}{row.spells_known != null ? <span>{row.spels_known} known/prepared</span> : null}</div></div>
            {row.guideFeatures.map((feature, index) => (
              <div key={`${feature.type}-${feature.name}-${index}`} className={`class-book-guide__feature ${feature.type === "subclass" ? "is-subclass" : ""}`} role="button" tabIndex={0} onMouseEnter={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onFocus={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onClick={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") publishFeature(model, onFeatureDetail, feature, row.class_level); }}>
                <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap"><h4>{feature.type === "subclass" && model.preview ? `${model.preview.name}: ` : ""}{feature.name}</h4><span>{feature.source || "Campaign"}</span></div>
                <ClassFeatureText text={feature.description} fallback="No imported description is available for this feature yet." />
              </div>
            ))}
          </section>
        ))}</div>
      </article>
    </div>
  );
}

export default function NpcForgeClassGuide({ selectedClass = null, level = 1, onFeatureDetail = null }) {
  const model = useNpcForgeClassGuideModel(selectedClass, level);
  if (!selectedClass) return <div className="npc-forge-context-card"><h3>Choose a class</h3><p>Select a class to read its progression and compare subclasses.</p></div>;
  return (
    <div className="npc-forge-context-card npc-forge-class-guide">
      <section className="npc-card class-level-guide__intro npc-forge-class-guide__view-header"><div><div className="spell-admin-kicker">Class View</div><h2 className="h5 mb-1">Build from the same class guide used on the character profile</h2><div className="small text-muted">Review the progression, compare subclasses, and choose the option that belongs to this starting level.</div></div><div className="npc-forge-class-guide__tabs"><button type="button" className={model.view === "overview" ? "is-active" : ""} onClick={() => model.setView("overview")}>Class Overview</button><button type="button" className={model.view === "detailed" ? "is-active" : ""} onClick={() => model.setView("detailed")}>Detailed Guide</button></div></section>
      {model.error ? <div className="npc-forge-class-guide__warning">{model.error}</div> : null}
      {model.loading ? <div className="npc-forge-class-guide__loading">Loading the complete class progression…</div> : null}
      {!model.loading && model.view === "overview" ? <ForgeOverview selectedClass={selectedClass} model={model} onFeatureDetail={onFeatureDetail} /> : null}
      {!model.loading && model.view === "detailed" ? <ForgeDetailedGuide selectedClass={selectedClass} model={model} onFeatureDetail={onFeatureDetail} /> : null}
      <div className="npc-forge-context-note">Hover, focus, or click a feature to place its card in the left description window. Class and subclass choices can also guide identity, motivations, affiliations, and story.</div>
      <NpcForgeClassGuideStyles />
    </div>
  );
}

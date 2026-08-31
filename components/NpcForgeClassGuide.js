import { ABILITY_LABELS } from "../utils/characterCreation";
import { classArtworkFor, handleClassArtworkError } from "../utils/classes/classArtwork";
import { classMagicPresentation, classPresentationSummary, classPrimaryAbilities } from "../utils/classes/classPresentation";
import ClassFeatureText, { classFeatureInline, normalizeClassFeatureText } from "./ClassFeatureText";
import { classSlotSummary, classSourceLabel, useNpcForgeClassGuideModel } from "./NpcForgeClassGuideModel";
import NpcForgeClassGuideStyles from "./NpcForgeClassGuideStyles";

function cleanPlayerCopy(value, fallback = "") { return classFeatureInline(value, fallback); }
function classThemeKey(selectedClass = {}) { return String(selectedClass?.class_key || selectedClass?.class_name || "adventurer").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
function heroFacts(selectedClass, currentLevel) {
  const primary = classPrimaryAbilities(selectedClass).map((key) => ABILITY_LABELS[key] || key).join(", ") || "Varies";
  return [["Hit Die", `d${selectedClass?.hit_die || 8}`], ["Starting Level", currentLevel], ["Primary Ability", primary], ["Saving Throws", (selectedClass?.saving_throws || []).map((key) => ABILITY_LABELS[key] || key).join(", ") || "Varies"], ["Power System", classMagicPresentation(selectedClass, ABILITY_LABELS)]];
}
function featureDetailPayload(feature, level, preview) { return { type: "classFeature", feature: { ...feature, description: normalizeClassFeatureText(feature?.description, "No source description is available for this feature."), level: Number(level || feature?.level || 1) }, subclassName: feature?.type === "subclass" ? preview?.name || "Subclass" : "" }; }
function publishFeature(model, onFeatureDetail, feature, level) { const payload = featureDetailPayload(feature, level, model.preview); model.setPinned(payload.feature); onFeatureDetail?.(payload); }
function publishListedOption(model, onFeatureDetail, parentFeature, item, level) {
  const listed = model.resolveListedDetail?.(item, parentFeature, level);
  if (!listed) return;
  const payload = { type: "classFeature", feature: listed, parentFeatureName: parentFeature?.name || "" };
  model.setPinned(listed);
  onFeatureDetail?.(payload);
}
function ForgeClassHero({ selectedClass, currentLevel }) {
  const summary = classPresentationSummary(selectedClass, `A complete level-by-level guide to the ${selectedClass.class_name} class.`);
  return <header id="forge-class-guide-introduction" className="class-book-guide__hero npc-forge-class-guide__book-hero">
    <div className="npc-forge-class-guide__hero-copy">
      <div className="npc-forge-class-guide__hero-kicker"><span>Class View</span><em>{classSourceLabel(selectedClass.source)}</em></div>
      <h2>{selectedClass.class_name}</h2>
      <p>{cleanPlayerCopy(summary)}</p>
      <div className="npc-forge-class-guide__hero-facts">{heroFacts(selectedClass, currentLevel).map(([label, value], index) => <div key={label} className={`is-fact-${index + 1}`}><span>{label}</span><strong>{value}</strong></div>)}</div>
    </div>
    <div className="npc-forge-class-guide__hero-art" aria-hidden="true"><img src={classArtworkFor(selectedClass.class_key)} onError={handleClassArtworkError} alt="" /></div>
  </header>;
}
function previewSubclass(model, option) {
  if (!option?.key) return;
  model.setPreviewKey(option.key);
}
function ForgeSubclassSelection({ model }) {
  const required = model.eligible.length > 0;
  return <section className={`npc-forge-class-guide__subclasses ${required && !model.selected ? "is-required" : ""}`}>
    <div className="npc-forge-class-guide__subhead">
      <div><span>Subclass</span><strong>{model.selected ? `${model.selected.name} selected` : required ? "Choose an eligible specialization" : model.entryLevel ? `Available at level ${model.entryLevel}` : "No subclasses listed"}</strong></div>
      <div className="npc-forge-class-guide__subhead-actions">
        {model.options.length > 1 ? <label><input type="checkbox" checked={model.compareAll} onChange={(event) => model.setCompareAll(event.target.checked)} /> Compare all</label> : null}
        {model.selected ? <button type="button" onClick={() => model.selectSubclass(null)}>Clear choice</button> : null}
      </div>
    </div>
    {model.options.length ? <>
      <div className="npc-forge-class-guide__subclass-grid" role="list" aria-label="Available subclasses">
        {model.options.map((option) => {
          const active = model.preview?.key === option.key;
          const selected = model.selected?.key === option.key;
          const eligible = Number(option.firstLevel || 1) <= model.currentLevel;
          return <button key={option.key} type="button" role="listitem" className={`${active ? "is-active" : ""}${selected ? " is-selected" : ""}`} onMouseEnter={() => previewSubclass(model, option)} onFocus={() => previewSubclass(model, option)} onClick={() => previewSubclass(model, option)}>
            <span className="npc-forge-class-guide__subclass-mark" aria-hidden="true">✦</span>
            <span className="npc-forge-class-guide__subclass-label"><strong>{option.name}</strong><small>{option.source}{eligible ? "" : ` • L${option.firstLevel}`}</small></span>
          </button>;
        })}
      </div>
      <div className="npc-forge-class-guide__subclass-confirm">
        <span>{model.preview ? `Previewing ${model.preview.name}` : "Choose a subclass above to preview it."}</span>
        {model.preview ? <button type="button" className="is-primary" disabled={!model.previewEligible || model.selected?.key === model.preview?.key} onClick={() => model.selectSubclass(model.preview)}>{model.selected?.key === model.preview?.key ? "Selected" : model.previewEligible ? "Choose subclass" : `Available at level ${model.preview?.firstLevel || model.entryLevel}`}</button> : null}
      </div>
    </> : <p>No imported subclass catalogue is available for this class.</p>}
    {required && !model.selected ? <p className="npc-forge-class-guide__requirement">Choose an eligible subclass before continuing. Previewing does not select it.</p> : null}
    {!required && model.entryLevel ? <p>Subclasses may be previewed now. Selection opens at level {model.entryLevel}.</p> : null}
    {model.compareAll ? <details className="npc-forge-class-guide__compare-drawer"><summary>Compare subclass summaries</summary><div>{model.options.map((option) => <button key={option.key} type="button" className={model.preview?.key === option.key ? "is-active" : ""} onClick={() => model.setPreviewKey(option.key)}><strong>{option.name}</strong><small>{option.source} • first feature level {option.firstLevel}</small><span>{cleanPlayerCopy(option.features?.find((feature) => feature.isIntroduction)?.description, "Preview this subclass in the guide below.")}</span></button>)}</div></details> : null}
  </section>;
}
function ChoiceRoutingNote({ model }) {
  const groups = model.choiceGroups || [];
  const trainingCount = groups.filter((group) => ["class", "training"].includes(group.placement || "class")).length;
  const spellCount = groups.filter((group) => group.placement === "spells").length;
  return <section className="npc-forge-class-guide__choice-routing">
    <div className="npc-forge-class-guide__choice-routing-icon" aria-hidden="true">⌛</div>
    <div><span>Deferred resolutions</span><strong>Use this page to understand the class. Make its mechanical choices in the tab that owns them.</strong><small>Tools, skills, feats, fighting styles, maneuvers, invocations, and similar training choices resolve in Training. Spell selections resolve in Spells. Equipment choices resolve in Equipment.</small></div>
    <div className="npc-forge-class-guide__choice-routing-counts">{trainingCount ? <span><b>{trainingCount}</b> Training group{trainingCount === 1 ? "" : "s"}</span> : null}{spellCount ? <span><b>{spellCount}</b> Spell group{spellCount === 1 ? "" : "s"}</span> : null}</div>
  </section>;
}
function ProgressionTable({ model, onFeatureDetail }) {
  return <section className="npc-card class-level-guide__table-card npc-forge-class-guide__table-card"><div className="npc-forge-class-guide__section-title"><span>Class Progression</span><small>Hover, focus, or click a feature to inspect its rules.</small></div><div className="class-level-guide__table" role="table"><div className="class-level-guide__row is-head" role="row"><div>Level</div><div>PB</div><div>Features</div><div>Cantrips</div><div>Known / Prepared</div><div>Spell Slots</div></div>{model.rows.map((row) => <div key={row.class_level} className={`class-level-guide__row ${Number(row.class_level) === model.currentLevel ? "is-current" : ""}`} role="row"><div><strong>{row.class_level}</strong>{Number(row.class_level) === model.currentLevel ? <span>Current</span> : null}</div><div>+{Number(row.proficiency_bonus || 2)}</div><div className="class-level-guide__features">{row.guideFeatures.length ? row.guideFeatures.map((feature, index) => <button type="button" key={`${feature.type}-${feature.name}-${index}`} className={feature.type === "subclass" ? "is-subclass" : ""} aria-label={`View ${feature.name} details`} onMouseEnter={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onFocus={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onClick={() => publishFeature(model, onFeatureDetail, feature, row.class_level)}>{feature.type === "subclass" && model.preview ? `${model.preview.name}: ` : ""}{feature.name}</button>) : <span className="text-muted">—</span>}</div><div>{row.cantrips_known ?? "—"}</div><div>{row.spells_known ?? "—"}</div><div className="class-level-guide__slots">{classSlotSummary(row.spell_slots)}</div></div>)}</div></section>;
}
function SubclassIntro({ model, detailed = false }) {
  if (!model.preview) return null;
  return <section id={detailed ? "forge-class-guide-subclass" : undefined} className={`class-book-guide__subclass-intro ${detailed ? "" : "npc-forge-class-guide__subclass-intro"}`}><div className="d-flex align-items-start justify-content-between gap-2 flex-wrap"><div><div className="spell-admin-kicker">{model.selected?.key === model.preview.key ? "Selected Subclass" : "Previewed Subclass"}</div><h3>{model.preview.name}</h3></div><span className="badge text-bg-info">{model.preview.source}</span></div><ClassFeatureText text={model.intro?.description} entries={model.intro?.entries || null} fallback={detailed ? "Its source-backed features are included at the applicable levels below." : "Its features are included at the levels where they become available."} />{detailed && model.preview.isLegacyCompatibility ? <div className="class-book-guide__compatibility-note">This supplemental subclass uses its published feature text with its entry level aligned to the 2024 level-3 subclass slot.</div> : null}</section>;
}
function ForgeOverview({ selectedClass, model, onFeatureDetail }) { return <article className="npc-card class-book-guide__content npc-forge-class-guide__overview-book"><ForgeClassHero selectedClass={selectedClass} currentLevel={model.currentLevel} /><div className="npc-forge-class-guide__overview-body"><ForgeSubclassSelection model={model} /><ChoiceRoutingNote model={model} /><SubclassIntro model={model} /><ProgressionTable model={model} onFeatureDetail={onFeatureDetail} /></div></article>; }
function ForgeDetailedGuide({ selectedClass, model, onFeatureDetail }) {
  const visibleRows = model.rows.filter((row) => row.guideFeatures.length);
  return <div className="class-book-guide npc-forge-class-guide__book"><aside className="npc-card class-book-guide__outline"><div className="spell-admin-kicker">Guide Outline</div><a href="#forge-class-guide-introduction">{selectedClass.class_name}</a>{model.preview ? <a href="#forge-class-guide-subclass">{model.preview.name}</a> : null}<div className="class-book-guide__outline-levels">{visibleRows.map((row) => <a key={row.class_level} href={`#forge-class-guide-level-${row.class_level}`}>Level {row.class_level}</a>)}</div></aside><article className="npc-card class-book-guide__content"><ForgeClassHero selectedClass={selectedClass} currentLevel={model.currentLevel} /><div className="npc-forge-class-guide__detailed-controls"><ForgeSubclassSelection model={model} /><ChoiceRoutingNote model={model} /></div><SubclassIntro model={model} detailed /><div className="class-book-guide__levels">{visibleRows.map((row) => <details key={row.class_level} id={`forge-class-guide-level-${row.class_level}`} className={`npc-forge-class-guide__level ${Number(row.class_level) === model.currentLevel ? "is-current" : ""}`} defaultOpen={Number(row.class_level) === model.currentLevel}><summary className="class-book-guide__level-heading npc-forge-class-guide__level-heading"><div><div className="spell-admin-kicker">Level {row.class_level}</div><h3>{selectedClass.class_name} {row.class_level}</h3></div><div className="class-book-guide__level-stats"><span>PB +{Number(row.proficiency_bonus || 2)}</span>{row.cantrips_known != null ? <span>{row.cantrips_known} cantrips</span> : null}{row.spells_known != null ? <span>{row.spells_known} known/prepared</span> : null}</div></summary><div className="npc-forge-class-guide__level-content">{row.guideFeatures.map((feature, index) => <div key={`${feature.type}-${feature.name}-${index}`} className={`class-book-guide__feature ${feature.type === "subclass" ? "is-subclass" : ""}`} role="button" tabIndex={0} onMouseEnter={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onFocus={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onClick={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") publishFeature(model, onFeatureDetail, feature, row.class_level); }}><div className="d-flex align-items-center justify-content-between gap-2 flex-wrap"><h4>{feature.type === "subclass" && model.preview ? `${model.preview.name}: ` : ""}{feature.name}</h4><span>{feature.source || "Campaign"}</span></div><ClassFeatureText text={feature.description} entries={feature.entries || null} fallback="No imported description is available for this feature yet." onListItemDetail={(item) => publishListedOption(model, onFeatureDetail, feature, item, row.class_level)} /></div>)}</div></details>)}</div></article></div>;
}
export default function NpcForgeClassGuide({ selectedClass = null, level = 1, onFeatureDetail = null }) {
  const model = useNpcForgeClassGuideModel(selectedClass, level);
  if (!selectedClass) return <div className="npc-forge-context-card"><h3>Choose a class</h3><p>Select a class to read its progression and compare subclasses.</p></div>;
  const theme = classThemeKey(selectedClass);
  return <div className={`npc-forge-context-card npc-forge-class-guide is-class-${theme}`}><section className="npc-card class-level-guide__intro npc-forge-class-guide__view-header"><div><div className="spell-admin-kicker">Class Guide</div><h2 className="h5 mb-1">Understand the class, its subclasses, and every level of progression</h2><div className="small text-muted">The Class tab is informational except for class identity and subclass selection. Tools, skills, feats, spells, equipment, and similar choices are resolved later in their owning tabs.</div></div><div className="npc-forge-class-guide__tabs"><button type="button" className={model.view === "overview" ? "is-active" : ""} onClick={() => model.setView("overview")}>Class Overview</button><button type="button" className={model.view === "detailed" ? "is-active" : ""} onClick={() => model.setView("detailed")}>Detailed Guide</button></div></section>{model.error ? <div className="npc-forge-class-guide__warning">{model.error}</div> : null}{model.loading ? <div className="npc-forge-class-guide__loading">Loading the complete class progression…</div> : null}{!model.loading && model.view === "overview" ? <ForgeOverview selectedClass={selectedClass} model={model} onFeatureDetail={onFeatureDetail} /> : null}{!model.loading && model.view === "detailed" ? <ForgeDetailedGuide selectedClass={selectedClass} model={model} onFeatureDetail={onFeatureDetail} /> : null}<div className="npc-forge-context-note">Hover, focus, or click a feature to place its rules in the movable description window. Detailed Guide levels can be opened and closed independently. Listed options remain clickable; known plans/items use their canonical catalogue descriptions and item cards. Choose the subclass here; complete persistent training options in Training, spell-specific choices in Spells, and gear choices in Equipment.</div><NpcForgeClassGuideStyles /><style jsx global>{`
    .npc-forge-class-guide .class-book-guide__feature{padding:18px 20px;border-radius:12px}.npc-forge-class-guide .class-book-guide__feature h4{font-size:1rem;line-height:1.35}.npc-forge-class-guide .class-book-guide__feature p,.npc-forge-class-guide .class-book-guide__feature li{max-width:78ch;color:rgba(255,255,255,.82);font-size:.82rem;line-height:1.68}.npc-forge-class-guide .class-book-guide__feature p+p{margin-top:.8rem}.npc-forge-class-guide .class-book-guide__feature ul,.npc-forge-class-guide .class-book-guide__feature ol{display:grid;gap:.42rem;padding-left:1.3rem}.npc-forge-class-guide__hero-facts{grid-template-columns:repeat(auto-fit,minmax(118px,1fr))!important}.npc-forge-class-guide__level{scroll-margin-top:74px}.npc-forge-class-guide__level>summary{list-style:none;cursor:pointer;position:relative;padding-right:3rem!important}.npc-forge-class-guide__level>summary::-webkit-details-marker{display:none}.npc-forge-class-guide__level>summary::after{content:"+";position:absolute;right:1rem;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:1.7rem;height:1.7rem;border:1px solid rgba(168,108,255,.42);border-radius:999px;color:#eadfff;background:rgba(126,72,199,.12);font-size:1rem;font-weight:900}.npc-forge-class-guide__level[open]>summary::after{content:"–"}.npc-forge-class-guide__level:not([open])>summary{margin-bottom:.45rem!important;padding-top:.62rem!important;padding-bottom:.62rem!important}.npc-forge-class-guide__level:not([open])>summary h3{font-size:1rem!important}.npc-forge-class-guide__level-content{display:grid;gap:.15rem;padding-bottom:.8rem}
  `}</style></div>;
}

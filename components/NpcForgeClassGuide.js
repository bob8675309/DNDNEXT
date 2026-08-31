import { ABILITY_LABELS } from "../utils/characterCreation";
import { classArtworkFor, handleClassArtworkError } from "../utils/classes/classArtwork";
import { classPresentationSummary, classPrimaryAbilities } from "../utils/classes/classPresentation";
import ClassFeatureText, { classFeatureInline, normalizeClassFeatureText } from "./ClassFeatureText";
import { classSlotSummary, classSourceLabel, useNpcForgeClassGuideModel } from "./NpcForgeClassGuideModel";
import NpcForgeClassGuideStyles from "./NpcForgeClassGuideStyles";

function cleanPlayerCopy(value, fallback = "") { return classFeatureInline(value, fallback); }
function classThemeKey(selectedClass = {}) { return String(selectedClass?.class_key || selectedClass?.class_name || "adventurer").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
function classOverviewSummary(selectedClass = {}) {
  if (classThemeKey(selectedClass) === "artificer") return "Artificers are innovators, artisans, and problem solvers who blend magic with technology. They create magic items, enhance equipment, and bring ingenuity to every challenge.";
  return cleanPlayerCopy(classPresentationSummary(selectedClass, `Explore the defining features, progression, and specialties of the ${selectedClass?.class_name || "selected"} class.`));
}
function classHeroTagline(selectedClass = {}) {
  if (classThemeKey(selectedClass) === "artificer") return "A master of invention who turns ideas into reality.";
  const copy = classOverviewSummary(selectedClass);
  const firstStop = copy.search(/[.!?](?:\s|$)/);
  return firstStop >= 0 ? copy.slice(0, firstStop + 1) : copy;
}
function heroFacts(selectedClass) {
  const primary = classPrimaryAbilities(selectedClass).map((key) => ABILITY_LABELS[key] || key).join(", ") || "Varies";
  const saves = (selectedClass?.saving_throws || []).map((key) => ABILITY_LABELS[key] || key).join(", ") || "Varies";
  return [["Hit Die", `d${selectedClass?.hit_die || 8}`], ["Saving Throws", saves], ["Primary Ability", primary]];
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
function subclassPreviewFeature(option = {}) {
  const intro = option?.features?.find((feature) => feature?.isIntroduction) || option?.features?.[0] || null;
  return {
    name: option?.name || "Subclass",
    source: option?.source || "Campaign",
    type: "subclass",
    level: Number(option?.firstLevel || intro?.level || 1),
    description: normalizeClassFeatureText(intro?.description, `Preview the ${option?.name || "selected"} subclass and its source-backed features in the Detailed Guide.`),
    entries: intro?.entries || null,
  };
}
function previewSubclass(model, onFeatureDetail, option) {
  if (!option?.key) return;
  model.setPreviewKey(option.key);
  const feature = subclassPreviewFeature(option);
  model.setPinned(feature);
  onFeatureDetail?.({ type: "classFeature", feature, subclassName: option.name || "Subclass" });
}
function ForgeClassHero({ selectedClass }) {
  return <header id="forge-class-guide-introduction" className="class-book-guide__hero npc-forge-class-guide__book-hero">
    <div className="npc-forge-class-guide__hero-copy">
      <div className="npc-forge-class-guide__hero-kicker"><span>Class View</span><em>{classSourceLabel(selectedClass.source)}</em></div>
      <h2>{selectedClass.class_name}</h2>
      <p className="npc-forge-class-guide__hero-tagline">{classHeroTagline(selectedClass)}</p>
      <div className="npc-forge-class-guide__hero-facts">{heroFacts(selectedClass).map(([label, value], index) => <div key={label} className={`is-fact-${index + 1}`}><span>{label}</span><strong>{value}</strong></div>)}</div>
    </div>
    <div className="npc-forge-class-guide__hero-art" aria-hidden="true"><img src={classArtworkFor(selectedClass.class_key)} onError={handleClassArtworkError} alt="" /></div>
  </header>;
}
function ClassOverviewCopy({ selectedClass }) {
  return <section className="npc-forge-class-guide__overview-copy"><p>{classOverviewSummary(selectedClass)}</p></section>;
}
function SubclassButton({ option, model, onFeatureDetail }) {
  const active = model.preview?.key === option.key;
  const selected = model.selected?.key === option.key;
  const eligible = Number(option.firstLevel || 1) <= model.currentLevel;
  return <button type="button" role="listitem" className={`${active ? "is-active" : ""}${selected ? " is-selected" : ""}`} onMouseEnter={() => previewSubclass(model, onFeatureDetail, option)} onFocus={() => previewSubclass(model, onFeatureDetail, option)} onClick={() => previewSubclass(model, onFeatureDetail, option)}>
    <span className="npc-forge-class-guide__subclass-mark" aria-hidden="true">✦</span>
    <span className="npc-forge-class-guide__subclass-label"><strong>{option.name}</strong><small>{selected ? "Selected" : eligible ? option.source : `${option.source} • L${option.firstLevel}`}</small></span>
  </button>;
}
function ForgeSubclassSelection({ model, onFeatureDetail, detailed = false }) {
  const required = model.eligible.length > 0;
  const primary = model.options.slice(0, 4);
  const more = model.options.slice(4);
  return <section className={`npc-forge-class-guide__subclasses${detailed ? " is-detailed" : " is-compact"}${required && !model.selected ? " is-required" : ""}`}>
    <div className="npc-forge-class-guide__subhead">
      <div><span>Subclass</span><strong>{model.selected ? `${model.selected.name} selected` : required ? "Choose an eligible specialization" : model.entryLevel ? `Available at level ${model.entryLevel}` : "No subclasses listed"}</strong></div>
      <div className="npc-forge-class-guide__subhead-actions">
        {detailed && model.options.length > 1 ? <label><input type="checkbox" checked={model.compareAll} onChange={(event) => model.setCompareAll(event.target.checked)} /> Compare all</label> : null}
        {model.selected ? <button type="button" onClick={() => model.selectSubclass(null)}>Clear choice</button> : null}
      </div>
    </div>
    {model.options.length ? <>
      <div className="npc-forge-class-guide__subclass-grid" role="list" aria-label="Available subclasses">
        {primary.map((option) => <SubclassButton key={option.key} option={option} model={model} onFeatureDetail={onFeatureDetail} />)}
        {more.length ? <details className="npc-forge-class-guide__subclass-more">
          <summary><span aria-hidden="true">＋</span><strong>More</strong><small>{more.length} more</small></summary>
          <div>{more.map((option) => <SubclassButton key={option.key} option={option} model={model} onFeatureDetail={onFeatureDetail} />)}</div>
        </details> : null}
      </div>
      <div className="npc-forge-class-guide__subclass-confirm">
        <span>{model.preview ? `Hover or select a subclass to inspect ${model.preview.name}.` : "Hover or select a subclass to view its unique features and specialization."}</span>
        {model.preview ? <button type="button" className="is-primary" disabled={!model.previewEligible || model.selected?.key === model.preview?.key} onClick={() => model.selectSubclass(model.preview)}>{model.selected?.key === model.preview?.key ? "Selected" : model.previewEligible ? "Choose subclass" : `Available at level ${model.preview?.firstLevel || model.entryLevel}`}</button> : null}
      </div>
    </> : <p>No imported subclass catalogue is available for this class.</p>}
    {required && !model.selected ? <p className="npc-forge-class-guide__requirement">Choose an eligible subclass before continuing. Previewing does not select it.</p> : null}
    {!required && model.entryLevel ? <p className="npc-forge-class-guide__subclass-level-note">Subclass selection opens at level {model.entryLevel}; previews are available now.</p> : null}
    {detailed && model.compareAll ? <details className="npc-forge-class-guide__compare-drawer"><summary>Compare subclass summaries</summary><div>{model.options.map((option) => <button key={option.key} type="button" className={model.preview?.key === option.key ? "is-active" : ""} onClick={() => previewSubclass(model, onFeatureDetail, option)}><strong>{option.name}</strong><small>{option.source} • first feature level {option.firstLevel}</small><span>{cleanPlayerCopy(option.features?.find((feature) => feature.isIntroduction)?.description, "Preview this subclass in the guide below.")}</span></button>)}</div></details> : null}
  </section>;
}
function ChoiceRoutingNote({ model, compact = false }) {
  const groups = model.choiceGroups || [];
  const trainingCount = groups.filter((group) => ["class", "training"].includes(group.placement || "class")).length;
  const spellCount = groups.filter((group) => group.placement === "spells").length;
  if (compact) return <section className="npc-forge-class-guide__choice-routing is-compact">
    <div className="npc-forge-class-guide__choice-routing-icon" aria-hidden="true">i</div>
    <div><strong>Choices for tools, feats, skills, spells, and other options are made in their respective tabs (Training, Spells, Equipment, etc.), not here.</strong></div>
  </section>;
  return <section className="npc-forge-class-guide__choice-routing">
    <div className="npc-forge-class-guide__choice-routing-icon" aria-hidden="true">⌛</div>
    <div><span>Deferred resolutions</span><strong>Use this page to understand the class. Make its mechanical choices in the tab that owns them.</strong><small>Tools, skills, feats, fighting styles, maneuvers, invocations, and similar training choices resolve in Training. Spell selections resolve in Spells. Equipment choices resolve in Equipment.</small></div>
    <div className="npc-forge-class-guide__choice-routing-counts">{trainingCount ? <span><b>{trainingCount}</b> Training group{trainingCount === 1 ? "" : "s"}</span> : null}{spellCount ? <span><b>{spellCount}</b> Spell group{spellCount === 1 ? "" : "s"}</span> : null}</div>
  </section>;
}
function ProgressionTable({ selectedClass, model, onFeatureDetail }) {
  const hasSpellProgression = model.rows.some((row) => row.cantrips_known != null || row.spells_known != null || row.spell_slots);
  return <section className="npc-card class-level-guide__table-card npc-forge-class-guide__table-card">
    <div className="npc-forge-class-guide__section-title"><span>Class Progression</span><small>Hover, focus, or click a feature to inspect its rules.</small></div>
    <div className="class-level-guide__table" role="table"><div className="class-level-guide__row is-head" role="row"><div>Level</div><div>PB</div><div>Features</div><div>Cantrips</div><div>Known / Prepared</div><div>Spell Slots</div></div>{model.rows.map((row) => <div key={row.class_level} className={`class-level-guide__row ${Number(row.class_level) === model.currentLevel ? "is-current" : ""}`} role="row"><div><strong>{row.class_level}</strong>{Number(row.class_level) === model.currentLevel ? <span>Current</span> : null}</div><div>+{Number(row.proficiency_bonus || 2)}</div><div className="class-level-guide__features">{row.guideFeatures.length ? row.guideFeatures.map((feature, index) => <button type="button" key={`${feature.type}-${feature.name}-${index}`} className={feature.type === "subclass" ? "is-subclass" : ""} aria-label={`View ${feature.name} details`} onMouseEnter={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onFocus={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onClick={() => publishFeature(model, onFeatureDetail, feature, row.class_level)}>{feature.type === "subclass" && model.preview ? `${model.preview.name}: ` : ""}{feature.name}</button>) : <span className="text-muted">—</span>}</div><div>{row.cantrips_known ?? "—"}</div><div>{row.spells_known ?? "—"}</div><div className="class-level-guide__slots">{classSlotSummary(row.spell_slots)}</div></div>)}</div>
    {hasSpellProgression ? <div className="npc-forge-class-guide__table-footnote"><span aria-hidden="true">i</span><p>Spell choices for the {selectedClass?.class_name || "selected class"} are resolved in the Spells tab; this table is the progression reference.</p></div> : null}
  </section>;
}
function SubclassIntro({ model, detailed = false }) {
  if (!model.preview) return null;
  return <section id={detailed ? "forge-class-guide-subclass" : undefined} className={`class-book-guide__subclass-intro ${detailed ? "" : "npc-forge-class-guide__subclass-intro"}`}><div className="d-flex align-items-start justify-content-between gap-2 flex-wrap"><div><div className="spell-admin-kicker">{model.selected?.key === model.preview.key ? "Selected Subclass" : "Previewed Subclass"}</div><h3>{model.preview.name}</h3></div><span className="badge text-bg-info">{model.preview.source}</span></div><ClassFeatureText text={model.intro?.description} entries={model.intro?.entries || null} fallback={detailed ? "Its source-backed features are included at the applicable levels below." : "Its features are included at the levels where they become available."} />{detailed && model.preview.isLegacyCompatibility ? <div className="class-book-guide__compatibility-note">This supplemental subclass uses its published feature text with its entry level aligned to the 2024 level-3 subclass slot.</div> : null}</section>;
}
function ForgeOverview({ selectedClass, model, onFeatureDetail }) {
  return <article className="npc-card class-book-guide__content npc-forge-class-guide__overview-book">
    <ForgeClassHero selectedClass={selectedClass} />
    <div className="npc-forge-class-guide__overview-layout">
      <div className="npc-forge-class-guide__overview-main">
        <ClassOverviewCopy selectedClass={selectedClass} />
        <ChoiceRoutingNote model={model} compact />
        <ForgeSubclassSelection model={model} onFeatureDetail={onFeatureDetail} />
        <ProgressionTable selectedClass={selectedClass} model={model} onFeatureDetail={onFeatureDetail} />
      </div>
      <aside className="npc-forge-class-guide__dock-lane" aria-hidden="true"><span>Feature details</span></aside>
    </div>
  </article>;
}
function ForgeDetailedGuide({ selectedClass, model, onFeatureDetail }) {
  const visibleRows = model.rows.filter((row) => row.guideFeatures.length);
  return <div className="class-book-guide npc-forge-class-guide__book"><aside className="npc-card class-book-guide__outline"><div className="spell-admin-kicker">Guide Outline</div><a href="#forge-class-guide-introduction">{selectedClass.class_name}</a>{model.preview ? <a href="#forge-class-guide-subclass">{model.preview.name}</a> : null}<div className="class-book-guide__outline-levels">{visibleRows.map((row) => <a key={row.class_level} href={`#forge-class-guide-level-${row.class_level}`}>Level {row.class_level}</a>)}</div></aside><article className="npc-card class-book-guide__content"><ForgeClassHero selectedClass={selectedClass} /><div className="npc-forge-class-guide__detailed-controls"><ForgeSubclassSelection model={model} onFeatureDetail={onFeatureDetail} detailed /><ChoiceRoutingNote model={model} /></div><SubclassIntro model={model} detailed /><div className="class-book-guide__levels">{visibleRows.map((row) => <details key={row.class_level} id={`forge-class-guide-level-${row.class_level}`} className={`npc-forge-class-guide__level ${Number(row.class_level) === model.currentLevel ? "is-current" : ""}`} defaultOpen={Number(row.class_level) === model.currentLevel}><summary className="class-book-guide__level-heading npc-forge-class-guide__level-heading"><div><div className="spell-admin-kicker">Level {row.class_level}</div><h3>{selectedClass.class_name} {row.class_level}</h3></div><div className="class-book-guide__level-stats"><span>PB +{Number(row.proficiency_bonus || 2)}</span>{row.cantrips_known != null ? <span>{row.cantrips_known} cantrips</span> : null}{row.spells_known != null ? <span>{row.spells_known} known/prepared</span> : null}</div></summary><div className="npc-forge-class-guide__level-content">{row.guideFeatures.map((feature, index) => <div key={`${feature.type}-${feature.name}-${index}`} className={`class-book-guide__feature ${feature.type === "subclass" ? "is-subclass" : ""}`} role="button" tabIndex={0} onMouseEnter={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onFocus={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onClick={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") publishFeature(model, onFeatureDetail, feature, row.class_level); }}><div className="d-flex align-items-center justify-content-between gap-2 flex-wrap"><h4>{feature.type === "subclass" && model.preview ? `${model.preview.name}: ` : ""}{feature.name}</h4><span>{feature.source || "Campaign"}</span></div><ClassFeatureText text={feature.description} entries={feature.entries || null} fallback="No imported description is available for this feature yet." onListItemDetail={(item) => publishListedOption(model, onFeatureDetail, feature, item, row.class_level)} /></div>)}</div></details>)}</div></article></div>;
}
export default function NpcForgeClassGuide({ selectedClass = null, level = 1, onFeatureDetail = null }) {
  const model = useNpcForgeClassGuideModel(selectedClass, level);
  if (!selectedClass) return <div className="npc-forge-context-card"><h3>Choose a class</h3><p>Select a class to read its progression and compare subclasses.</p></div>;
  const theme = classThemeKey(selectedClass);
  return <div className={`npc-forge-context-card npc-forge-class-guide is-class-${theme}`}>
    <nav className="npc-forge-class-guide__view-header" aria-label="Class guide view"><div className="npc-forge-class-guide__tabs"><button type="button" className={model.view === "overview" ? "is-active" : ""} onClick={() => model.setView("overview")}>Class Overview</button><button type="button" className={model.view === "detailed" ? "is-active" : ""} onClick={() => model.setView("detailed")}>Detailed Guide</button></div></nav>
    {model.error ? <div className="npc-forge-class-guide__warning">{model.error}</div> : null}
    {model.loading ? <div className="npc-forge-class-guide__loading">Loading the complete class progression…</div> : null}
    {!model.loading && model.view === "overview" ? <ForgeOverview selectedClass={selectedClass} model={model} onFeatureDetail={onFeatureDetail} /> : null}
    {!model.loading && model.view === "detailed" ? <ForgeDetailedGuide selectedClass={selectedClass} model={model} onFeatureDetail={onFeatureDetail} /> : null}
    <div className="npc-forge-context-note npc-forge-class-guide__footer-note">Hover, focus, or click a feature to place its rules in the movable description window. Detailed Guide levels can be opened and closed independently. Choose the subclass here; complete persistent training options in Training, spell-specific choices in Spells, and gear choices in Equipment.</div>
    <NpcForgeClassGuideStyles />
    <style jsx global>{`
      .npc-forge-class-guide .class-book-guide__feature{padding:18px 20px;border-radius:12px}.npc-forge-class-guide .class-book-guide__feature h4{font-size:1rem;line-height:1.35}.npc-forge-class-guide .class-book-guide__feature p,.npc-forge-class-guide .class-book-guide__feature li{max-width:78ch;color:rgba(255,255,255,.82);font-size:.82rem;line-height:1.68}.npc-forge-class-guide .class-book-guide__feature p+p{margin-top:.8rem}.npc-forge-class-guide .class-book-guide__feature ul,.npc-forge-class-guide .class-book-guide__feature ol{display:grid;gap:.42rem;padding-left:1.3rem}.npc-forge-class-guide__level{scroll-margin-top:74px}.npc-forge-class-guide__level>summary{list-style:none;cursor:pointer;position:relative;padding-right:3rem!important}.npc-forge-class-guide__level>summary::-webkit-details-marker{display:none}.npc-forge-class-guide__level>summary::after{content:"+";position:absolute;right:1rem;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:1.7rem;height:1.7rem;border:1px solid rgba(168,108,255,.42);border-radius:999px;color:#eadfff;background:rgba(126,72,199,.12);font-size:1rem;font-weight:900}.npc-forge-class-guide__level[open]>summary::after{content:"–"}.npc-forge-class-guide__level:not([open])>summary{margin-bottom:.45rem!important;padding-top:.62rem!important;padding-bottom:.62rem!important}.npc-forge-class-guide__level:not([open])>summary h3{font-size:1rem!important}.npc-forge-class-guide__level-content{display:grid;gap:.15rem;padding-bottom:.8rem}
    `}</style>
  </div>;
}
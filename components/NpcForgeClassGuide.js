import { ABILITY_LABELS } from "../utils/characterCreation";
import { classHeroArtworkFor, handleClassArtworkError } from "../utils/classes/classArtwork";
import { classPresentationSummary, classPrimaryAbilities } from "../utils/classes/classPresentation";
import ClassFeatureText, { classFeatureInline, normalizeClassFeatureText } from "./ClassFeatureText";
import { classSourceLabel, useNpcForgeClassGuideModel } from "./NpcForgeClassGuideModel";
import NpcForgeClassGuideStyles from "./NpcForgeClassGuideStyles";
import ClassSubclassSection from "./ClassSubclassSection";

function cleanPlayerCopy(value, fallback = "") { return classFeatureInline(value, fallback); }
function classThemeKey(selectedClass = {}) { return String(selectedClass?.class_key || selectedClass?.class_name || "adventurer").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
function classOverviewSummary(selectedClass = {}) {
  return cleanPlayerCopy(classPresentationSummary(selectedClass, `Explore the defining features, progression, and specialties of the ${selectedClass?.class_name || "selected"} class.`));
}
function heroFacts(selectedClass) {
  const primary = classPrimaryAbilities(selectedClass).map((key) => ABILITY_LABELS[key] || key).join(", ") || "Varies";
  const saves = (selectedClass?.saving_throws || []).map((key) => ABILITY_LABELS[key] || key).join(", ") || "Varies";
  return [["Hit Die", `d${selectedClass?.hit_die || 8}`], ["Saving Throws", saves], ["Primary Ability", primary]];
}
function featureDetailPayload(feature, level, selectedSubclass) {
  return {
    type: "classFeature",
    feature: {
      ...feature,
      description: normalizeClassFeatureText(feature?.description, "No source description is available for this feature."),
      level: Number(level || feature?.level || 1),
    },
    subclassName: feature?.type === "subclass" ? selectedSubclass?.name || "Subclass" : "",
  };
}
function publishFeature(model, onFeatureDetail, feature, level) {
  const payload = featureDetailPayload(feature, level, model.selected);
  model.setPinned(payload.feature);
  onFeatureDetail?.(payload);
}
function publishListedOption(model, onFeatureDetail, parentFeature, item, level) {
  const listed = model.resolveListedDetail?.(item, parentFeature, level);
  if (!listed) return;
  const payload = { type: "classFeature", feature: listed, parentFeatureName: parentFeature?.name || "" };
  model.setPinned(listed);
  onFeatureDetail?.(payload);
}
function subclassPreviewFeature(option = {}) {
  const features = Array.isArray(option?.features) ? option.features : [];
  const intro = features.find((feature) => feature?.isIntroduction) || features[0] || null;
  const summary = normalizeClassFeatureText(
    intro?.description,
    `Preview the ${option?.name || "selected"} subclass and its source-backed features.`,
  );
  const featureLines = [];
  const seen = new Set();
  for (const feature of features) {
    if (!feature || feature === intro || feature?.isIntroduction || !feature?.name) continue;
    const key = `${Number(feature.level || option?.firstLevel || 1)}:${String(feature.name).trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    featureLines.push(`Level ${Number(feature.level || option?.firstLevel || 1)} — ${feature.name}`);
  }
  const progression = featureLines.length ? `\n\nSubclass feature progression:\n\n${featureLines.join("\n\n")}` : "";
  return {
    name: option?.name || "Subclass",
    source: option?.source || "Campaign",
    type: "subclass",
    level: Number(option?.firstLevel || intro?.level || 1),
    description: normalizeClassFeatureText(`${summary}${progression}`),
    entries: null,
  };
}
function inspectSubclass(model, onFeatureDetail, option) {
  if (!option?.key) return;
  const feature = subclassPreviewFeature(option);
  model.setPinned(feature);
  onFeatureDetail?.({ type: "classFeature", feature, subclassName: option.name || "Subclass" });
}
function selectedRowFeatures(model, row) {
  const base = (row?.guideFeatures || []).filter((feature) => feature?.type !== "subclass");
  if (!model?.selected || model?.preview?.key !== model.selected.key) return base;
  return row.guideFeatures || base;
}
function spellSlotCells(slots) {
  const cells = Array(9).fill("—");
  if (Array.isArray(slots)) {
    for (let index = 0; index < Math.min(9, slots.length); index += 1) {
      const count = Number(slots[index] || 0);
      cells[index] = count > 0 ? String(count) : "—";
    }
    return cells;
  }
  const pactSlots = Number(slots?.pactSlots || 0);
  const pactLevel = Number(slots?.pactSlotLevel || 0);
  if (pactSlots > 0 && pactLevel >= 1 && pactLevel <= 9) cells[pactLevel - 1] = `${pactSlots}p`;
  return cells;
}
function ForgeClassHero({ selectedClass }) {
  return <header id="forge-class-guide-introduction" className="class-book-guide__hero npc-forge-class-guide__book-hero">
    <div className="npc-forge-class-guide__hero-copy">
      <div className="npc-forge-class-guide__hero-kicker"><span>Class View</span><em>{classSourceLabel(selectedClass.source)}</em></div>
      <h2>{selectedClass.class_name}</h2>
      <p className="npc-forge-class-guide__hero-tagline">{classOverviewSummary(selectedClass)}</p>
      <div className="npc-forge-class-guide__hero-facts">{heroFacts(selectedClass).map(([label, value], index) => <div key={label} className={`is-fact-${index + 1}`}><span>{label}</span><strong>{value}</strong></div>)}</div>
    </div>
    <div className="npc-forge-class-guide__hero-art" aria-hidden="true"><img src={classHeroArtworkFor(selectedClass.class_key)} onError={handleClassArtworkError} alt="" /></div>
  </header>;
}
function ForgeSubclassSelection({ selectedClass, model, onFeatureDetail, detailed = false }) {
  return <ClassSubclassSection
    model={model}
    classKey={selectedClass?.class_key || ""}
    detailed={detailed}
    onInspectSubclass={(option) => inspectSubclass(model, onFeatureDetail, option)}
  />;
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
  const slotLabels = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
  const rowClassName = (row) => `class-level-guide__row${hasSpellProgression ? " is-spell-progression" : ""}${Number(row?.class_level) === model.currentLevel ? " is-current" : ""}`;
  return <section className="npc-card class-level-guide__table-card npc-forge-class-guide__table-card">
    <div className="npc-forge-class-guide__section-title"><span>Class Progression</span><small>Selected subclass features join the table automatically. Click a feature bubble to show its rules in the movable Feature card.</small></div>
    <div className={`class-level-guide__table${hasSpellProgression ? " has-spell-progression" : ""}`} role="table">
      <div className={`class-level-guide__row is-head${hasSpellProgression ? " is-spell-progression" : ""}`} role="row">
        <div>Level</div><div>PB</div><div>Features</div>
        {hasSpellProgression ? <><div>Cantrips</div><div>Known / Prepared</div>{slotLabels.map((label) => <div key={label} className="class-level-guide__slot-head" title={`${label} level spell slots`}>{label}</div>)}</> : null}
      </div>
      {model.rows.map((row) => {
        const features = selectedRowFeatures(model, row);
        const slots = spellSlotCells(row.spell_slots);
        return <div key={row.class_level} className={rowClassName(row)} role="row">
          <div><strong>{row.class_level}</strong>{Number(row.class_level) === model.currentLevel ? <span>Current</span> : null}</div>
          <div>+{Number(row.proficiency_bonus || 2)}</div>
          <div className="class-level-guide__features">{features.length ? features.map((feature, index) => <button type="button" key={`${feature.type}-${feature.name}-${index}`} className={feature.type === "subclass" ? "is-subclass" : ""} aria-label={`View ${feature.name} details`} onClick={() => publishFeature(model, onFeatureDetail, feature, row.class_level)}>{feature.type === "subclass" && model.selected ? `${model.selected.name}: ` : ""}{feature.name}</button>) : <span className="text-muted">—</span>}</div>
          {hasSpellProgression ? <><div>{row.cantrips_known ?? "—"}</div><div>{row.spells_known ?? "—"}</div>{slots.map((count, index) => <div key={`${row.class_level}-slot-${index}`} className="class-level-guide__slot-cell">{count}</div>)}</> : null}
        </div>;
      })}
    </div>
    {hasSpellProgression ? <div className="npc-forge-class-guide__table-footnote"><span aria-hidden="true">i</span><p>Spell choices for the {selectedClass?.class_name || "selected class"} are resolved in the Spells tab; this table is the progression reference. A value ending in “p” denotes pact slots.</p></div> : null}
  </section>;
}
function ForgeOverview({ selectedClass, model, onFeatureDetail }) {
  return <article className="npc-card class-book-guide__content npc-forge-class-guide__overview-book">
    <ForgeClassHero selectedClass={selectedClass} />
    <div className="npc-forge-class-guide__overview-layout">
      <div className="npc-forge-class-guide__overview-main">
        <ForgeSubclassSelection selectedClass={selectedClass} model={model} onFeatureDetail={onFeatureDetail} />
        <ProgressionTable selectedClass={selectedClass} model={model} onFeatureDetail={onFeatureDetail} />
      </div>
    </div>
  </article>;
}
function ForgeDetailedGuide({ selectedClass, model, onFeatureDetail }) {
  const visibleRows = model.rows
    .map((row) => ({ ...row, visibleFeatures: selectedRowFeatures(model, row) }))
    .filter((row) => row.visibleFeatures.length);
  return <div className="class-book-guide npc-forge-class-guide__book"><aside className="npc-card class-book-guide__outline"><div className="spell-admin-kicker">Guide Outline</div><a href="#forge-class-guide-introduction">{selectedClass.class_name}</a><div className="class-book-guide__outline-levels">{visibleRows.map((row) => <a key={row.class_level} href={`#forge-class-guide-level-${row.class_level}`}>Level {row.class_level}</a>)}</div></aside><article className="npc-card class-book-guide__content"><ForgeClassHero selectedClass={selectedClass} /><div className="npc-forge-class-guide__detailed-controls"><ForgeSubclassSelection selectedClass={selectedClass} model={model} onFeatureDetail={onFeatureDetail} detailed /><ChoiceRoutingNote model={model} /></div><div className="class-book-guide__levels">{visibleRows.map((row) => <details key={row.class_level} id={`forge-class-guide-level-${row.class_level}`} className={`npc-forge-class-guide__level ${Number(row.class_level) === model.currentLevel ? "is-current" : ""}`} defaultOpen={Number(row.class_level) === model.currentLevel}><summary className="class-book-guide__level-heading npc-forge-class-guide__level-heading"><div><div className="spell-admin-kicker">Level {row.class_level}</div><h3>{selectedClass.class_name} {row.class_level}</h3></div><div className="class-book-guide__level-stats"><span>PB +{Number(row.proficiency_bonus || 2)}</span>{row.cantrips_known != null ? <span>{row.cantrips_known} cantrips</span> : null}{row.spells_known != null ? <span>{row.spells_known} known/prepared</span> : null}</div></summary><div className="npc-forge-class-guide__level-content">{row.visibleFeatures.map((feature, index) => <div key={`${feature.type}-${feature.name}-${index}`} className={`class-book-guide__feature ${feature.type === "subclass" ? "is-subclass" : ""}`} role="button" tabIndex={0} onClick={() => publishFeature(model, onFeatureDetail, feature, row.class_level)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") publishFeature(model, onFeatureDetail, feature, row.class_level); }}><div className="d-flex align-items-center justify-content-between gap-2 flex-wrap"><h4>{feature.type === "subclass" && model.selected ? `${model.selected.name}: ` : ""}{feature.name}</h4><span>{feature.source || "Campaign"}</span></div><ClassFeatureText text={feature.description} entries={feature.entries || null} fallback="No imported description is available for this feature yet." onListItemDetail={(item) => publishListedOption(model, onFeatureDetail, feature, item, row.class_level)} /></div>)}</div></details>)}</div></article></div>;
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
    <div className="npc-forge-context-note npc-forge-class-guide__footer-note">Click a subclass to select or inspect it in the movable Feature card. Select an eligible subclass to add its features to progression. Click any feature bubble for full rules. Persistent training options still belong in Training, spell choices in Spells, and gear choices in Equipment.</div>
    <NpcForgeClassGuideStyles />
    <style jsx global>{`
      .npc-forge-class-guide .class-book-guide__feature{padding:18px 20px;border-radius:12px}.npc-forge-class-guide .class-book-guide__feature h4{font-size:1rem;line-height:1.35}.npc-forge-class-guide .class-book-guide__feature p,.npc-forge-class-guide .class-book-guide__feature li{max-width:78ch;color:rgba(255,255,255,.82);font-size:.82rem;line-height:1.68}.npc-forge-class-guide .class-book-guide__feature p+p{margin-top:.8rem}.npc-forge-class-guide .class-book-guide__feature ul,.npc-forge-class-guide .class-book-guide__feature ol{display:grid;gap:.42rem;padding-left:1.3rem}.npc-forge-class-guide__level{scroll-margin-top:74px}.npc-forge-class-guide__level>summary{list-style:none;cursor:pointer;position:relative;padding-right:3rem!important}.npc-forge-class-guide__level>summary::-webkit-details-marker{display:none}.npc-forge-class-guide__level>summary::after{content:"+";position:absolute;right:1rem;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:1.7rem;height:1.7rem;border:1px solid rgba(168,108,255,.42);border-radius:999px;color:#eadfff;background:rgba(126,72,199,.12);font-size:1rem;font-weight:900}.npc-forge-class-guide__level[open]>summary::after{content:"–"}.npc-forge-class-guide__level:not([open])>summary{margin-bottom:.45rem!important;padding-top:.62rem!important;padding-bottom:.62rem!important}.npc-forge-class-guide__level:not([open])>summary h3{font-size:1rem!important}.npc-forge-class-guide__level-content{display:grid;gap:.15rem;padding-bottom:.8rem}
      .npc-forge-class-guide__overview-layout{grid-template-columns:minmax(0,1fr)!important;gap:8px!important;padding:10px 12px 12px!important}.npc-forge-class-guide__overview-main{width:100%;min-width:0}.npc-forge-class-guide__dock-lane{display:none!important}
      .npc-forge-class-guide__table-card{width:min(74%,860px)!important;max-width:860px!important;align-self:start!important;max-height:435px!important;padding:5px!important;overflow:auto!important}.npc-forge-class-guide__table-card .class-level-guide__table{width:100%!important;min-width:0!important;box-sizing:border-box!important}.npc-forge-class-guide__table-card .class-level-guide__row{grid-template-columns:58px 52px minmax(300px,1.7fr) 72px 108px minmax(160px,.9fr)!important;gap:.28rem!important;min-height:34px!important;padding:.22rem .38rem!important}.npc-forge-class-guide__table-card .class-level-guide__row>div{padding:2px 3px!important;font-size:.57rem!important;line-height:1.26!important}.npc-forge-class-guide__table-card .class-level-guide__row.is-head{min-height:28px!important}
      .npc-forge-class-guide__table-card .class-level-guide__features{display:flex!important;flex-wrap:wrap!important;gap:.24rem!important}.npc-forge-class-guide__table-card .class-level-guide__features button{appearance:none!important;padding:.16rem .34rem!important;border:1px solid rgba(196,163,255,.28)!important;border-radius:999px!important;color:rgba(255,255,255,.94)!important;background:rgba(126,75,202,.14)!important;font-family:inherit!important;font-size:.56rem!important;font-weight:650!important;line-height:1.18!important;text-decoration:none!important;transition:border-color 120ms ease,background 120ms ease,transform 120ms ease!important}.npc-forge-class-guide__table-card .class-level-guide__features button:hover,.npc-forge-class-guide__table-card .class-level-guide__features button:focus-visible{border-color:rgba(213,184,255,.82)!important;color:#fff!important;background:rgba(142,82,231,.3)!important;transform:translateY(-1px);outline:none!important}.npc-forge-class-guide__table-card .class-level-guide__features button.is-subclass{border-color:rgba(58,188,220,.58)!important;background:rgba(28,128,151,.2)!important}.npc-forge-class-guide__table-card .class-level-guide__slots{font-size:.56rem!important;line-height:1.35!important;white-space:normal!important}
      .npc-forge-class-guide__table-card .class-level-guide__table.has-spell-progression{min-width:0!important}.npc-forge-class-guide__table-card .class-level-guide__row.is-spell-progression{grid-template-columns:40px 34px minmax(190px,2.15fr) 46px 62px repeat(9,minmax(24px,.32fr))!important;gap:.14rem!important}.npc-forge-class-guide__table-card .class-level-guide__row:not(.is-spell-progression){grid-template-columns:46px 44px minmax(340px,1fr)!important;gap:.32rem!important}.npc-forge-class-guide__table-card .class-level-guide__slot-head,.npc-forge-class-guide__table-card .class-level-guide__slot-cell{text-align:center!important;font-variant-numeric:tabular-nums}.npc-forge-class-guide__table-card .class-level-guide__slot-head{color:rgba(255,255,255,.56)!important;font-size:.47rem!important}.npc-forge-class-guide__table-card .class-level-guide__slot-cell{color:rgba(255,255,255,.76)!important;font-size:.53rem!important}.npc-forge-class-guide__table-card .class-level-guide__row.is-spell-progression>div{min-width:0!important;padding-left:2px!important;padding-right:2px!important;text-align:center!important;box-sizing:border-box!important}.npc-forge-class-guide__table-card .class-level-guide__row.is-spell-progression>div:nth-child(3){text-align:left!important}.npc-forge-class-guide__table-card .class-level-guide__row.is-spell-progression>.class-level-guide__features{justify-content:flex-start!important}.npc-forge-class-guide__table-card .class-level-guide__row.is-head.is-spell-progression>div:nth-child(5){white-space:normal!important;line-height:1.05!important}.npc-forge-class-guide__table-card .class-level-guide__features button{cursor:pointer}.npc-forge-class-guide__table-card .class-level-guide__features button:focus-visible{outline:1px solid rgba(var(--class-secondary),.8)!important;outline-offset:1px!important}





      @media(max-width:900px){.npc-forge-class-guide__overview-layout{padding:10px!important}.npc-forge-class-guide__table-card{width:100%!important;max-width:none!important}.npc-forge-class-guide__table-card .class-level-guide__table{min-width:720px!important}.npc-forge-class-guide__table-card .class-level-guide__table.has-spell-progression{min-width:1080px!important}}
    `}</style>
  </div>;
}

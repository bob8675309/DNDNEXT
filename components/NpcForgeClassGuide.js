import { ABILITY_LABELS } from "../utils/characterCreation";
import { classArtworkFor, handleClassArtworkError } from "../utils/classes/classArtwork";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { classSlotSummary, classSourceLabel, useNpcForgeClassGuideModel } from "./NpcForgeClassGuideModel";
import NpcForgeClassGuideStyles from "./NpcForgeClassGuideStyles";

function statsFor(row) {
  return [
    ["Hit Die", `d${row?.hit_die || 8}`],
    ["Primary abilities", (row?.primary_abilities || []).map((key) => ABILITY_LABELS[key] || key).join(", ") || "Varies"],
    ["Saving throws", (row?.saving_throws || []).map((key) => ABILITY_LABELS[key] || key).join(", ") || "Varies"],
    ["Spellcasting", ABILITY_LABELS[row?.spellcasting_ability] || "None at base class"],
  ];
}

export default function NpcForgeClassGuide({ selectedClass = null, level = 1 }) {
  const model = useNpcForgeClassGuideModel(selectedClass, level);
  if (!selectedClass) return <div className="npc-forge-context-card"><h3>Choose a class</h3><p>Select a class to read its progression and compare subclasses.</p></div>;
  const required = model.eligible.length > 0;
  const comparisons = model.compareAll ? model.options : model.preview ? [model.preview] : [];

  return <div className="npc-forge-context-card npc-forge-class-guide">
    <header className="npc-forge-class-guide__hero">
      <div><span>{classSourceLabel(selectedClass.source)}</span><h3>{selectedClass.class_name}</h3><p>{formatPlayerFacingText(selectedClass.summary, `A complete guide to the ${selectedClass.class_name} class.`)}</p><div><b>Hit Die d{selectedClass.hit_die || 8}</b><b>Starting level {model.currentLevel}</b></div></div>
      <img src={classArtworkFor(selectedClass.class_key)} onError={handleClassArtworkError} alt={`${selectedClass.class_name} class reference artwork`} />
    </header>

    <div className="npc-forge-class-guide__tabs"><button type="button" className={model.view === "overview" ? "is-active" : ""} onClick={() => model.setView("overview")}>Class Overview</button><button type="button" className={model.view === "detailed" ? "is-active" : ""} onClick={() => model.setView("detailed")}>Detailed Guide</button></div>

    <section className={`npc-forge-class-guide__subclasses ${required && !model.selected ? "is-required" : ""}`}>
      <div className="npc-forge-class-guide__subhead"><div><span>Subclass</span><strong>{model.selected ? `${model.selected.name} selected` : required ? "Selection required" : model.entryLevel ? `Available at level ${model.entryLevel}` : "No subclasses listed"}</strong></div>{model.options.length ? <label><input type="checkbox" checked={model.compareAll} onChange={(event) => model.setCompareAll(event.target.checked)} /> Compare all</label> : null}</div>
      {model.options.length ? <div className="npc-forge-class-guide__controls"><label><span>Preview subclass</span><select value={model.preview?.key || ""} onChange={(event) => model.setPreviewKey(event.target.value)}>{model.options.map((option) => <option key={option.key} value={option.key}>{option.name} • {option.source}{Number(option.firstLevel || 1) > model.currentLevel ? ` • level ${option.firstLevel}` : ""}</option>)}</select></label><button type="button" className="is-primary" disabled={!model.previewEligible || model.selected?.key === model.preview?.key} onClick={() => model.selectSubclass(model.preview)}>{model.selected?.key === model.preview?.key ? "Selected" : model.previewEligible ? "Choose subclass" : `Available at level ${model.preview?.firstLevel || model.entryLevel}`}</button>{model.selected ? <button type="button" onClick={() => model.selectSubclass(null)}>Clear choice</button> : null}</div> : <p>No imported subclass catalogue is available for this class.</p>}
      {required && !model.selected ? <p className="npc-forge-class-guide__requirement">Choose an eligible subclass before continuing. Previewing or comparing does not select it.</p> : null}
      {!required && model.entryLevel ? <p>Subclasses may be previewed now. Selection opens at level {model.entryLevel}.</p> : null}
    </section>

    {comparisons.length ? <section className={`npc-forge-class-guide__compare ${model.compareAll ? "is-all" : ""}`}>{comparisons.map((option) => <article key={option.key} className={model.selected?.key === option.key ? "is-selected" : ""}><span>{option.source}</span><strong>{option.name}</strong><small>First feature: level {option.firstLevel}</small><p>{formatPlayerFacingText(option.features?.find((feature) => feature.isIntroduction)?.description, "Source-backed subclass features appear at the applicable levels below.")}</p>{option.isLegacyCompatibility ? <em>Legacy subclass aligned to the 2024 level-3 subclass slot.</em> : null}</article>)}</section> : null}

    {model.error ? <div className="npc-forge-class-guide__warning">{model.error}</div> : null}
    {model.loading ? <div className="npc-forge-class-guide__loading">Loading the complete class progression…</div> : null}

    {!model.loading && model.view === "overview" ? <>
      <div className="npc-forge-class-guide__stats">{statsFor(selectedClass).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <section className="npc-forge-class-guide__table" role="table"><div className="is-head"><div>Lvl</div><div>PB</div><div>Features</div><div>Cantrips</div><div>Known / Prepared</div><div>Slots</div></div>{model.rows.map((row) => <div key={row.class_level} className={Number(row.class_level) === model.currentLevel ? "is-current" : ""}><div><strong>{row.class_level}</strong>{Number(row.class_level) === model.currentLevel ? <span>Current</span> : null}</div><div>+{Number(row.proficiency_bonus || 2)}</div><div className="npc-forge-class-guide__features">{row.guideFeatures.length ? row.guideFeatures.map((feature, index) => <button type="button" key={`${feature.type}-${feature.name}-${index}`} className={feature.type === "subclass" ? "is-subclass" : ""} onClick={() => model.setPinned({ ...feature, level: row.class_level })}>{feature.type === "subclass" && model.preview ? `${model.preview.name}: ` : ""}{feature.name}</button>) : "—"}</div><div>{row.cantrips_known ?? "—"}</div><div>{row.spells_known ?? "—"}</div><div>{classSlotSummary(row.spell_slots)}</div></div>)}</section>
      <section className="npc-forge-class-guide__detail"><span>Feature description</span>{model.pinned ? <><div><strong>{model.pinned.name}</strong><small>Level {model.pinned.level} • {model.pinned.source || "Campaign"}</small></div><p>{model.pinned.description}</p></> : <p>Click a feature in the table to keep its full description here.</p>}</section>
    </> : null}

    {!model.loading && model.view === "detailed" ? <section className="npc-forge-class-guide__detailed">{model.preview ? <article className="is-subclass-intro"><span>Previewed subclass</span><h4>{model.preview.name}</h4><p>{formatPlayerFacingText(model.intro?.description, "Its features are included at the levels where they become available.")}</p></article> : null}{model.rows.filter((row) => row.guideFeatures.length).map((row) => <article key={row.class_level} className={Number(row.class_level) === model.currentLevel ? "is-current" : ""}><header><div><span>Level {row.class_level}</span><h4>{selectedClass.class_name} {row.class_level}</h4></div><b>PB +{Number(row.proficiency_bonus || 2)}</b></header>{row.guideFeatures.map((feature, index) => <div key={`${feature.type}-${feature.name}-${index}`} className={feature.type === "subclass" ? "is-subclass" : ""}><strong>{feature.type === "subclass" && model.preview ? `${model.preview.name}: ` : ""}{feature.name}</strong><small>{feature.source || "Campaign"}</small><p>{feature.description}</p></div>)}</article>)}</section> : null}

    <div className="npc-forge-context-note">Class and subclass choices determine progression and can guide identity, motivations, affiliations, and story.</div>
    <NpcForgeClassGuideStyles />
  </div>;
}

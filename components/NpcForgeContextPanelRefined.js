import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";
import { ABILITY_DESCRIPTIONS } from "../utils/characterCreationGuidance";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { hasDedicatedSpeciesArtwork, handleSpeciesArtworkError, speciesArtworkFor } from "../utils/speciesArtwork";
import { speciesFlavorLore } from "../utils/speciesLore";
import { formatSpeciesMovement } from "../utils/speciesPresentation";
import { backgroundStoryDescription } from "../utils/backgroundPresentation";

const SIZE_LABELS = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan", V: "Variable (see Size feature)" };

function safeText(value) { return String(value ?? "").trim(); }
function sourceLabel(source = "") {
  if (source === "XPHB") return "2024 Player's Handbook";
  if (source === "PHB") return "2014 Player's Handbook";
  if (source === "CAMPAIGN") return "Campaign";
  return source || "Source unknown";
}
function labelList(values = [], labels = {}) {
  return (Array.isArray(values) ? values : []).map((value) => labels[value] || value).filter(Boolean).join(", ");
}

function DetailHeader({ eyebrow, title, source }) {
  return <div className="npc-forge-context-head"><div><span>{eyebrow}</span><h3>{title}</h3></div>{source ? <span className="npc-forge-context-source">{sourceLabel(source)}</span> : null}</div>;
}

function InfoRows({ rows = [] }) {
  return (
    <div className="npc-forge-context-rows">
      {rows.filter((row) => row?.value !== undefined && row?.value !== null && row?.value !== "").map((row) => {
        const details = (Array.isArray(row.details) ? row.details : []).filter((entry) => entry?.description);
        const interactive = details.length || row.control;
        if (!interactive) return <div key={row.label} className="npc-forge-context-row"><span>{row.label}</span><strong>{row.value}</strong></div>;
        return (
          <details key={row.label} className="npc-forge-context-row is-interactive" open={Boolean(row.defaultOpen)}>
            <summary title="Click to open or close"><span>{row.label}</span><strong>{row.value}<em>{row.actionLabel || "Info"}</em></strong></summary>
            <div className="npc-forge-context-row-details">
              {row.control || null}
              {details.map((entry, index) => <article key={`${entry.label || row.label}-${index}`}><div><b>{entry.label || row.label}</b>{entry.source ? <small>{sourceLabel(entry.source)}</small> : null}</div><p>{formatPlayerFacingText(entry.description)}</p>{entry.prerequisite ? <small>Prerequisite: {formatPlayerFacingText(entry.prerequisite)}</small> : null}</article>)}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function SpeciesTraitDetails({ details = [], traits = [] }) {
  const described = details.filter((entry) => entry?.name && entry?.description);
  const describedNames = new Set(described.map((entry) => entry.name));
  const concise = traits.filter((trait) => trait && !describedNames.has(trait));
  if (!described.length && !concise.length) return null;
  return <div className="npc-forge-context-section npc-forge-species-features"><span>Species features</span>{described.length ? <div className="npc-forge-species-feature-list">{described.map((entry, index) => <details key={`${entry.name}-${index}`} open={index < 2}><summary>{entry.name}</summary><p>{formatPlayerFacingText(entry.description)}</p></details>)}</div> : null}{concise.length ? <div className="npc-forge-context-chips">{concise.slice(0, 12).map((trait) => <b key={trait}>{trait}</b>)}</div> : null}</div>;
}

function BackgroundSkillChooser({ groups = [], selections = {}, onToggle }) {
  if (!groups.length) return null;
  return <div className="npc-forge-context-choice-stack">{groups.map((group) => {
    const selected = selections[group.id] || [];
    return <section key={group.id}><div className="npc-forge-context-choice-head"><b>Choose {group.count} skill{group.count === 1 ? "" : "s"}</b><small>{selected.length}/{group.count} selected</small></div><div className="npc-forge-context-choice-grid">{group.options.map((option) => <button key={option.key} type="button" className={selected.includes(option.key) ? "is-selected" : ""} onClick={() => onToggle?.(group.id, option.key, group.count)}><strong>{option.label}</strong><span>{option.description}</span></button>)}</div></section>;
  })}</div>;
}

function BackgroundFeatChooser({ options = [], selectedFeat = null, onSelect }) {
  if (!options.length) return null;
  return <div className="npc-forge-context-choice-grid feats">{options.map((feat) => <button key={feat.id} type="button" className={selectedFeat?.id === feat.id ? "is-selected" : ""} onClick={() => onSelect?.(feat.id)}><strong>{feat.name}</strong><small>{sourceLabel(feat.source)}</small><span>{formatPlayerFacingText(feat.description, "This feat is granted by the background.")}</span></button>)}</div>;
}

function BackgroundFeatureList({ features = [] }) {
  if (!features.length) return null;
  return <div className="npc-forge-context-section npc-forge-background-features"><span>Background feature{features.length === 1 ? "" : "s"}</span><div>{features.map((feature, index) => <details key={`${feature.name}-${index}`} open={features.length === 1}><summary>{feature.name}</summary><p>{formatPlayerFacingText(feature.description)}</p></details>)}</div></div>;
}

function ExpandedSpellList({ groups = [] }) {
  if (!groups.length) return null;
  return <details className="npc-forge-context-section npc-forge-background-spells"><summary><span>Expanded spell list</span><em>Info</em></summary><div className="npc-forge-background-spell-body"><p>Available to choose when this character's class grants Spellcasting or Pact Magic; not automatically known or prepared.</p>{groups.map((group) => <div key={group.level}><strong>{group.label}</strong><span>{group.spells.join(", ")}</span></div>)}</div></details>;
}

export default function NpcForgeContextPanel({
  step = 0, detail = null, selectedSpecies = null, selectedBackground = null,
  backgroundMechanicDetails = null, selectedBackgroundFeat = null, backgroundFeatOptions = [],
  backgroundSkillSelections = {}, onToggleBackgroundSkill = null, onSelectBackgroundFeat = null,
  selectedClass = null, selectedSkill = null, selectedProfession = null,
  rolls = [], allocation = {}, finalAbilities = {}, draft = {},
}) {
  const activeSpecies = detail?.type === "species" && detail.option ? detail.option : step === 0 ? selectedSpecies : null;
  const activeBackground = detail?.type === "background" && detail.option ? detail.option : step === 1 ? selectedBackground : null;
  const activeClass = detail?.type === "class" && detail.option ? detail.option : step === 2 ? selectedClass : null;

  if (activeSpecies) {
    const option = activeSpecies;
    const hasDedicatedArtwork = hasDedicatedSpeciesArtwork(option.name);
    return <div className="npc-forge-context-card is-origin is-species"><figure className="npc-forge-species-artwork"><img src={speciesArtworkFor(option.name)} onError={handleSpeciesArtworkError} alt={`Original ${option.name} species reference artwork`} /><figcaption><span>{option.name} reference</span>{!hasDedicatedArtwork ? <small>Neutral reference art</small> : null}</figcaption></figure><div className="npc-forge-species-lore"><span>In the world</span><p>{speciesFlavorLore(option)}</p></div><InfoRows rows={[{ label: "Speed", value: formatSpeciesMovement(option.metadata?.speed ?? option.speed) }, { label: "Size", value: labelList(option.size, SIZE_LABELS) || "Source default" }, { label: "Creature type", value: labelList(option.creatureTypes) || "Humanoid" }, { label: "Darkvision", value: option.darkvision ? `${option.darkvision} ft.` : "Not listed" }, { label: "Lineage", value: labelList(option.lineages) || "None required" }, { label: "Languages", value: labelList(option.languages) || safeText(draft.languagesText) || "Chosen for character" }]} /><SpeciesTraitDetails details={option.traitDetails} traits={option.traits} /><div className="npc-forge-context-note">Species describes ancestry and innate traits. Background and class are selected separately.</div></div>;
  }

  if (activeBackground) {
    const option = activeBackground;
    const skills = backgroundMechanicDetails?.skills || [];
    const selectedChoiceLabels = (backgroundMechanicDetails?.skillChoices || []).flatMap((group) => (backgroundSkillSelections[group.id] || []).map((key) => group.options.find((optionRow) => optionRow.key === key)?.label || key));
    const skillValue = labelList([...skills.map((entry) => entry.label), ...selectedChoiceLabels]) || (backgroundMechanicDetails?.skillChoices?.length ? "Choice required" : "None listed");
    const originFeatValue = backgroundMechanicDetails?.originFeatValue || selectedBackgroundFeat?.name || option.originFeat || "None listed";
    const skillControl = <BackgroundSkillChooser groups={backgroundMechanicDetails?.skillChoices || []} selections={backgroundSkillSelections} onToggle={onToggleBackgroundSkill} />;
    const featControl = backgroundMechanicDetails?.featRequiresChoice ? <BackgroundFeatChooser options={backgroundFeatOptions} selectedFeat={selectedBackgroundFeat} onSelect={onSelectBackgroundFeat} /> : null;
    return <div className="npc-forge-context-card is-origin"><DetailHeader eyebrow="Background" title={option.name} source={option.source} /><div className="npc-forge-background-story"><span>Before adventuring</span>{backgroundStoryDescription(option).split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><BackgroundFeatureList features={option.features || []} /><InfoRows rows={[{ label: "Skills", value: skillValue, details: skills, control: skillControl, actionLabel: backgroundMechanicDetails?.skillChoices?.length ? "Choose" : "Info", defaultOpen: Boolean(backgroundMechanicDetails?.skillChoices?.length) }, { label: "Tools", value: labelList(option.tools) || "None listed", details: backgroundMechanicDetails?.tools }, { label: "Origin feat", value: originFeatValue, details: backgroundMechanicDetails?.originFeat, control: featControl, actionLabel: backgroundMechanicDetails?.featRequiresChoice ? "Choose" : "Info", defaultOpen: Boolean(backgroundMechanicDetails?.featRequiresChoice) }]} /><ExpandedSpellList groups={backgroundMechanicDetails?.spellList || []} /><div className="npc-forge-context-note">Use this history to choose former allies, obligations, rivals, and unfinished business that can matter during play.</div><style jsx global>{`
      .npc-forge-context-panel{padding:22px!important}.npc-forge-context-card{padding:22px!important;gap:17px!important}.npc-forge-background-story{padding:17px 18px!important;gap:10px!important}.npc-forge-background-story p{font-size:.86rem!important;line-height:1.72!important;max-width:none!important}.npc-forge-context-row{grid-template-columns:105px minmax(0,1fr)!important;padding:11px 13px!important}.npc-forge-context-row>summary{grid-template-columns:105px minmax(0,1fr)!important}.npc-forge-context-row-details{gap:11px!important;padding:8px 2px 2px!important}.npc-forge-context-row-details article{padding:11px 8px!important}.npc-forge-context-row-details p{font-size:.78rem!important;line-height:1.62!important;white-space:normal!important}.npc-forge-context-choice-stack{display:grid;gap:14px}.npc-forge-context-choice-stack section{display:grid;gap:8px}.npc-forge-context-choice-head{display:flex;justify-content:space-between;gap:12px}.npc-forge-context-choice-head b{color:#eadfff;font-size:.76rem}.npc-forge-context-choice-head small{color:rgba(255,255,255,.55)}.npc-forge-context-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.npc-forge-context-choice-grid button{display:grid;gap:4px;min-width:0;padding:10px;border:1px solid rgba(255,255,255,.11);border-radius:9px;color:rgba(255,255,255,.72);background:rgba(255,255,255,.025);text-align:left}.npc-forge-context-choice-grid button:hover{border-color:rgba(168,108,255,.55)}.npc-forge-context-choice-grid button.is-selected{border-color:#a86cff;background:rgba(126,72,199,.2);box-shadow:inset 3px 0 #a86cff}.npc-forge-context-choice-grid button strong{display:block;color:#fff;font-size:.76rem}.npc-forge-context-choice-grid button small{color:#8ce8dc;font-size:.62rem}.npc-forge-context-choice-grid button span{color:rgba(255,255,255,.6);font-size:.69rem;line-height:1.42;text-transform:none}.npc-forge-context-choice-grid.feats{grid-template-columns:1fr}.npc-forge-background-features>div{display:grid;gap:8px}.npc-forge-background-features details,.npc-forge-background-spells{border:1px solid rgba(168,108,255,.22);border-radius:10px;background:rgba(112,61,183,.07);overflow:hidden}.npc-forge-background-features summary,.npc-forge-background-spells>summary{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 13px;color:#eadfff;cursor:pointer;font-size:.78rem;font-weight:800;list-style:none}.npc-forge-background-features summary::-webkit-details-marker,.npc-forge-background-spells>summary::-webkit-details-marker{display:none}.npc-forge-background-features p{margin:0;padding:0 13px 13px;color:rgba(255,255,255,.72);font-size:.8rem;line-height:1.64}.npc-forge-background-spells>summary span{color:#d7bfff;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase}.npc-forge-background-spells>summary em{padding:2px 7px;border:1px solid rgba(168,108,255,.3);border-radius:999px;font-size:.57rem;font-style:normal;text-transform:uppercase}.npc-forge-background-spell-body{display:grid;gap:8px;padding:0 12px 12px}.npc-forge-background-spell-body p{margin:0 0 3px;color:rgba(255,255,255,.7);font-size:.76rem;line-height:1.55}.npc-forge-background-spell-body>div{display:grid;grid-template-columns:90px minmax(0,1fr);gap:12px;padding:9px 10px;border:1px solid rgba(255,255,255,.07);border-radius:9px;background:rgba(255,255,255,.035)}@media(max-width:720px){.npc-forge-context-choice-grid{grid-template-columns:1fr}}
    `}</style></div>;
  }

  if (activeClass) {
    const option = activeClass;
    return <div className="npc-forge-context-card is-class"><DetailHeader eyebrow="Class" title={option.class_name} source={option.source} /><p>{formatPlayerFacingText(option.summary, "No class summary is available.")}</p><InfoRows rows={[{ label: "Hit Die", value: `d${option.hit_die || 8}` }, { label: "Primary abilities", value: labelList(option.primary_abilities, ABILITY_LABELS) || "Varies" }, { label: "Saving throws", value: labelList(option.saving_throws, ABILITY_LABELS) || "Varies" }, { label: "Spellcasting", value: ABILITY_LABELS[option.spellcasting_ability] || "None at base class" }, { label: "Rules", value: option.ruleset || sourceLabel(option.source) }]} /><div className="npc-forge-context-note">Class controls combat progression and class features. It never replaces the NPC's in-world title, trade, or affiliation.</div></div>;
  }

  if (detail?.type === "ability" && detail.key) {
    const key = detail.key;
    return <div className="npc-forge-context-card is-ability"><DetailHeader eyebrow="Ability" title={ABILITY_LABELS[key] || key.toUpperCase()} /><p>{ABILITY_DESCRIPTIONS[key] || "This ability contributes to checks, saving throws, and class features."}</p><InfoRows rows={[{ label: "Base score", value: draft.baseAbilities?.[key] ?? 10 }, { label: "Final score", value: finalAbilities?.[key] ?? draft.baseAbilities?.[key] ?? 10 }, { label: "Assigned roll", value: allocation?.[key] ? rolls.find((roll) => roll.id === allocation[key])?.total : "Not assigned" }]} /><div className="npc-forge-context-note">A score of 10–11 is average. Every 2 points above or below 10 changes the modifier by 1.</div></div>;
  }

  if (detail?.type === "skill" && selectedSkill) return <div className="npc-forge-context-card is-training"><DetailHeader eyebrow="Skill" title={selectedSkill.label} source={selectedSkill.source} /><p>{selectedSkill.description || "No source description is available."}</p><InfoRows rows={[{ label: "Governing ability", value: ABILITY_LABELS[selectedSkill.ability] || selectedSkill.ability?.toUpperCase() }]} /><div className="npc-forge-context-note">Proficiency adds the character's proficiency bonus. Expertise doubles that bonus.</div></div>;
  if (detail?.type === "profession" && selectedProfession) return <div className="npc-forge-context-card is-training"><DetailHeader eyebrow="Profession" title={selectedProfession.label} /><p>{selectedProfession.description || `Professional training using ${selectedProfession.tool || "specialized tools"}.`}</p><InfoRows rows={[{ label: "Tool", value: selectedProfession.tool }, { label: "Abilities", value: labelList(selectedProfession.abilities, ABILITY_LABELS) }]} /><div className="npc-forge-context-note">Workshop service remains an explicit toggle. A title such as “smith” does not grant crafting access by itself.</div></div>;

  const fallbacks = {
    0: ["Species", "Choose a species", "Select a species to see its original reference artwork, source description, physical profile, lineage choices, and innate features."],
    1: ["Background", "Choose a formative background", "Select a background to read its life story, source feature, trained skills, tools, feat choices, and expanded spells."],
    2: ["Class", selectedClass?.class_name || "Choose a class", "Choose a class to inspect hit dice, primary abilities, saving throws, spellcasting, and rules source."],
    3: ["Ability Scores", "Roll, then allocate", "Each score uses 4d6 and discards the lowest die. Click or drag a Die Roll card onto an ability to assign it."],
  };
  const fallback = fallbacks[step] || ["Character", "Continue building", "Select an entry in the workspace to inspect its rules and purpose here."];
  return <div className={`npc-forge-context-card ${step === 3 ? "is-ability" : "is-origin"}`}><DetailHeader eyebrow={fallback[0]} title={fallback[1]} /><p>{fallback[2]}</p>{step === 3 ? <div className="npc-forge-context-ability-list">{ABILITY_KEYS.map((key) => <div key={key}><strong>{ABILITY_LABELS[key]}</strong><span>{ABILITY_DESCRIPTIONS[key]}</span></div>)}</div> : null}</div>;
}

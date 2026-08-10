import { useEffect, useMemo, useState } from "react";
import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";
import { ABILITY_DESCRIPTIONS } from "../utils/characterCreationGuidance";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { hasDedicatedSpeciesArtwork, handleSpeciesArtworkError, speciesArtworkFor } from "../utils/speciesArtwork";
import { speciesFlavorLore } from "../utils/speciesLore";
import { extractSpeciesTraitChoiceRules, formatSpeciesMovement, speciesFixedLanguages, speciesTraitChoiceRuleComplete } from "../utils/speciesPresentation";
import { backgroundStoryDescription } from "../utils/backgroundPresentation";
import { supabase } from "../utils/supabaseClient";
import { useNpcForgeSpeciesChoices } from "./NpcForgeSpeciesChoiceContext";

const SIZE_LABELS = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan", V: "Variable" };
const SPELL_SOURCE_PRIORITY = { XPHB: 0, PHB: 1 };
const safeText = (value) => String(value ?? "").trim();
function sourceLabel(source = "") { if (source === "XPHB") return "2024 Player's Handbook"; if (source === "PHB") return "2014 Player's Handbook"; if (source === "CAMPAIGN") return "Campaign"; return source || "Source unknown"; }
function labelList(values = [], labels = {}) { return (Array.isArray(values) ? values : []).map((value) => labels[value] || value).filter(Boolean).join(", "); }
function normalizeName(value = "") { return safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function DetailHeader({ eyebrow, title, source }) { return <div className="npc-forge-context-head"><div><span>{eyebrow}</span><h3>{title}</h3></div>{source ? <span className="npc-forge-context-source">{sourceLabel(source)}</span> : null}</div>; }

function InfoRows({ rows = [], wideDetails = false }) {
  return <div className={`npc-forge-context-rows${wideDetails ? " npc-forge-background-info-rows" : ""}`}>{rows.filter((row) => row?.value !== undefined && row?.value !== null && row?.value !== "").map((row) => {
    const details = (Array.isArray(row.details) ? row.details : []).filter((entry) => entry?.description);
    const interactive = details.length || row.control;
    if (!interactive) return <div key={row.label} className="npc-forge-context-row"><span>{row.label}</span><strong>{row.value}</strong></div>;
    return <details key={row.label} className="npc-forge-context-row is-interactive" defaultOpen={Boolean(row.defaultOpen)}><summary><span>{row.label}</span><strong>{row.value}<em>{row.actionLabel || "Info"}</em></strong></summary><div className="npc-forge-context-row-details">{row.control || null}{details.map((entry, index) => <article key={`${entry.label || row.label}-${index}`}><div><b>{entry.label || row.label}</b>{entry.source ? <small>{sourceLabel(entry.source)}</small> : null}</div><p>{formatPlayerFacingText(entry.description)}</p>{entry.prerequisite ? <small>Prerequisite: {formatPlayerFacingText(entry.prerequisite)}</small> : null}</article>)}</div></details>;
  })}</div>;
}

function SpellChoiceHelp({ spell }) {
  if (!spell) return null;
  const metadata = [
    spell.casting_time ? `Casting: ${spell.casting_time}` : "",
    spell.range_text ? `Range: ${spell.range_text}` : "",
    spell.duration_text ? `Duration: ${spell.duration_text}` : "",
  ].filter(Boolean);
  return <span className="npc-forge-species-spell-help" role="tooltip"><span><strong>{spell.name}</strong><em>{spell.source || "Spell"}</em></span>{metadata.length ? <small>{metadata.join(" • ")}</small> : null}<p>{formatPlayerFacingText(spell.description, "Open the Spells step later for the complete source entry.")}</p></span>;
}

function SpeciesTraitChoiceControl({ rule, selections = {}, onSelect, spellHelp = {} }) {
  const selected = selections?.[rule.id] || {};
  const complete = speciesTraitChoiceRuleComplete(rule, selections);
  return <div className={`npc-forge-species-choice ${complete ? "is-complete" : "is-required"}`}><div className="npc-forge-species-choice-head"><strong>{complete ? "Choice complete" : "Choice required"}</strong><span>{complete ? "Saved with this character" : "Choose below to continue"}</span></div>{(rule.fields || []).map((field) => <div className="npc-forge-species-choice-field" key={`${rule.id}-${field.id}`}><span>{field.label}</span><div className="npc-forge-species-choice-options">{(field.options || []).map((option) => {
    const help = field.kind === "spell" ? spellHelp[normalizeName(option.label || option.value)] : null;
    return <button key={option.value} type="button" className={`${selected[field.id] === option.value ? "is-selected" : ""} ${help ? "has-spell-help" : ""}`} onClick={() => onSelect?.(rule.id, field.id, option.value)}>{option.label}<SpellChoiceHelp spell={help} /></button>;
  })}</div></div>)}</div>;
}

function SpeciesTraitDetails({ details = [], traits = [], choiceRules = [], selections = {}, onSelectChoice, spellHelp = {} }) {
  const described = details.filter((entry) => entry?.name && entry?.description);
  const names = new Set(described.map((entry) => entry.name));
  const concise = traits.filter((trait) => trait && !names.has(trait));
  return <div className="npc-forge-context-section npc-forge-species-features"><span>Species features</span><div className="npc-forge-species-feature-list">{described.map((entry, index) => {
    const rule = choiceRules.find((candidate) => candidate.traitName === entry.name);
    const complete = rule ? speciesTraitChoiceRuleComplete(rule, selections) : true;
    return <details key={`${entry.name}-${index}`} defaultOpen={Boolean(rule && !complete)}><summary><span>{entry.name}</span>{rule ? <em className={complete ? "is-complete" : "is-required"}>{complete ? "Selected" : "Choose"}</em> : <em>Open</em>}</summary><p>{formatPlayerFacingText(entry.description)}</p>{rule ? <SpeciesTraitChoiceControl rule={rule} selections={selections} onSelect={onSelectChoice} spellHelp={spellHelp} /> : null}</details>;
  })}{concise.map((trait) => <details key={trait}><summary><span>{trait}</span><em>Open</em></summary><p>This source feature is listed for the selected species. Its complete imported description will appear here when available.</p></details>)}</div></div>;
}

function BackgroundSkillChooser({ groups = [], selections = {}, onToggle }) { return <div className="npc-forge-context-choice-stack">{groups.map((group) => { const selected = selections[group.id] || []; return <section key={group.id}><div className="npc-forge-context-choice-head"><b>Choose {group.count} skill{group.count === 1 ? "" : "s"}</b><small>{selected.length}/{group.count} selected</small></div><div className="npc-forge-context-choice-grid">{group.options.map((option) => <button key={option.key} type="button" className={selected.includes(option.key) ? "is-selected" : ""} onClick={() => onToggle?.(group.id, option.key, group.count)}><strong>{option.label}</strong><span>{option.description}</span></button>)}</div></section>; })}</div>; }
function BackgroundFeatChooser({ options = [], selectedFeat, onSelect }) { return <div className="npc-forge-context-choice-grid feats">{options.map((feat) => <button key={feat.id} type="button" className={selectedFeat?.id === feat.id ? "is-selected" : ""} onClick={() => onSelect?.(feat.id)}><strong>{feat.name}</strong><small>{sourceLabel(feat.source)}</small><span>{formatPlayerFacingText(feat.description, "This feat is granted by the background.")}</span></button>)}</div>; }
function BackgroundFeatureList({ features = [] }) { return features.length ? <div className="npc-forge-context-section npc-forge-background-features"><span>Background feature{features.length === 1 ? "" : "s"}</span><div>{features.map((feature, index) => <details key={`${feature.name}-${index}`} defaultOpen={features.length === 1}><summary>{feature.name}</summary><p>{formatPlayerFacingText(feature.description)}</p></details>)}</div></div> : null; }
function ExpandedSpellList({ groups = [] }) { return groups.length ? <details className="npc-forge-context-section npc-forge-background-spells"><summary><span>Expanded spell list</span><em>Info</em></summary><div className="npc-forge-background-spell-body"><p>These spells join the class list when a class grants Spellcasting or Pact Magic; they are not automatically known or prepared.</p>{groups.map((group) => <div key={group.level}><strong>{group.label}</strong><span>{group.spells.join(", ")}</span></div>)}</div></details> : null; }

export default function NpcForgeContextPanel({ playerMode = false, step = 0, stepKey = "", detail = null, selectedSpecies = null, selectedBackground = null, backgroundMechanicDetails = null, selectedBackgroundFeat = null, backgroundFeatOptions = [], backgroundSkillSelections = {}, onToggleBackgroundSkill = null, onSelectBackgroundFeat = null, selectedClass = null, selectedSkill = null, selectedProfession = null, rolls = [], allocation = {}, finalAbilities = {}, draft = {} }) {
  const activeSpecies = detail?.type === "species" && detail.option ? detail.option : stepKey === "species" || step === 0 ? selectedSpecies : null;
  const activeBackground = detail?.type === "background" && detail.option ? detail.option : stepKey === "background" || step === 1 ? selectedBackground : null;
  const { state: speciesChoiceState, registerSpecies, selectChoice } = useNpcForgeSpeciesChoices();
  const speciesChoiceRules = useMemo(() => activeSpecies ? extractSpeciesTraitChoiceRules(activeSpecies) : [], [activeSpecies]);
  const [speciesSpellHelp, setSpeciesSpellHelp] = useState({});
  const spellChoiceNames = useMemo(() => [...new Set(speciesChoiceRules.flatMap((rule) => (rule.fields || []).filter((field) => field.kind === "spell").flatMap((field) => (field.options || []).map((option) => safeText(option.label || option.value))).filter(Boolean)))], [speciesChoiceRules]);
  const activeSpeciesId = String(activeSpecies?.id || activeSpecies?.name || "");
  const speciesChoiceSelections = speciesChoiceState.speciesId === activeSpeciesId ? speciesChoiceState.selections || {} : {};
  useEffect(() => { if (stepKey === "species" || step === 0) registerSpecies(activeSpecies, speciesChoiceRules); }, [activeSpecies, registerSpecies, speciesChoiceRules, step, stepKey]);
  useEffect(() => {
    let active = true;
    if (!spellChoiceNames.length) {
      setSpeciesSpellHelp({});
      return () => { active = false; };
    }
    supabase.from("spells_catalog")
      .select("name,source,casting_time,range_text,duration_text,description")
      .in("name", spellChoiceNames)
      .then(({ data, error }) => {
        if (!active || error) return;
        const preferred = new Map();
        for (const spell of data || []) {
          const key = normalizeName(spell.name);
          const current = preferred.get(key);
          const nextRank = Number(SPELL_SOURCE_PRIORITY[spell.source] ?? 9);
          const currentRank = Number(SPELL_SOURCE_PRIORITY[current?.source] ?? 9);
          if (!current || nextRank < currentRank) preferred.set(key, spell);
        }
        setSpeciesSpellHelp(Object.fromEntries(preferred));
      });
    return () => { active = false; };
  }, [spellChoiceNames]);

  if (activeSpecies) {
    const option = activeSpecies;
    const fixedLanguages = speciesFixedLanguages(option);
    const facts = [
      ["Speed", formatSpeciesMovement(option.metadata?.speed ?? option.speed)],
      ["Size", labelList(option.size, SIZE_LABELS) || "Source default"],
      ["Creature", labelList(option.creatureTypes) || "Humanoid"],
      ["Darkvision", option.darkvision ? `${option.darkvision} ft.` : null],
      ...(!playerMode ? [["Lineage", labelList(option.lineages) || "None required"]] : []),
      ["Languages", fixedLanguages.length ? fixedLanguages.join(", ") : labelList(option.languages) || safeText(draft.languagesText) || null],
    ].filter(([, value]) => value && value !== "Not listed");
    return <div className="npc-forge-context-card is-origin is-species"><section className="npc-forge-species-hero"><figure className="npc-forge-species-artwork"><img src={speciesArtworkFor(option.name)} onError={handleSpeciesArtworkError} alt={`Original ${option.name} species reference artwork`} /><figcaption><span>{option.name} reference</span>{!hasDedicatedSpeciesArtwork(option.name) ? <small>Neutral reference art</small> : null}</figcaption></figure><div className="npc-forge-species-hero__copy"><span>In the world</span><p>{speciesFlavorLore(option)}</p><div className="npc-forge-species-facts">{facts.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div></div></section><SpeciesTraitDetails details={option.traitDetails} traits={option.traits} choiceRules={speciesChoiceRules} selections={speciesChoiceSelections} onSelectChoice={selectChoice} spellHelp={speciesSpellHelp} /><div className="npc-forge-context-note">Open the purple feature cards for complete rules. Required species choices appear inside their owning feature.</div><style jsx global>{`
      .npc-forge-context-card.is-species{display:grid!important;grid-template-columns:1fr!important}.npc-forge-species-hero{display:grid;grid-template-columns:minmax(280px,42%) minmax(0,1fr);min-height:360px;overflow:hidden;border:1px solid rgba(168,108,255,.34);border-radius:15px;background:radial-gradient(circle at 20% 20%,rgba(126,72,199,.2),transparent 55%),rgba(10,12,20,.92)}.npc-forge-species-hero .npc-forge-species-artwork{height:100%;min-height:360px;aspect-ratio:auto;border:0;border-radius:0}.npc-forge-species-hero .npc-forge-species-artwork img{object-fit:cover;object-position:center top}.npc-forge-species-hero__copy{display:flex;flex-direction:column;justify-content:center;gap:14px;padding:clamp(18px,3vw,34px)}.npc-forge-species-hero__copy>span{color:#d7bfff;font-size:.68rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.npc-forge-species-hero__copy>p{margin:0;color:rgba(255,255,255,.82);font-size:.88rem;line-height:1.72}.npc-forge-species-facts{display:flex;flex-wrap:wrap;gap:7px}.npc-forge-species-facts>div{display:grid;gap:1px;padding:6px 9px;border:1px solid rgba(88,214,199,.25);border-radius:8px;background:rgba(88,214,199,.07)}.npc-forge-species-facts small{color:rgba(255,255,255,.48);font-size:.52rem;text-transform:uppercase}.npc-forge-species-facts strong{color:#d8fff9;font-size:.66rem}.npc-forge-species-feature-list{align-items:start}.npc-forge-species-feature-list details{align-self:start;border-color:rgba(168,108,255,.34)!important;background:linear-gradient(90deg,rgba(126,72,199,.15),rgba(88,214,199,.035))!important}@media(max-width:850px){.npc-forge-species-hero{grid-template-columns:1fr}.npc-forge-species-hero .npc-forge-species-artwork{min-height:420px}.npc-forge-species-hero__copy{justify-content:start}}
    `}</style></div>;
  }

  if (activeBackground) {
    const option = activeBackground;
    const skills = backgroundMechanicDetails?.skills || [];
    const selectedChoiceLabels = (backgroundMechanicDetails?.skillChoices || []).flatMap((group) => (backgroundSkillSelections[group.id] || []).map((key) => group.options.find((row) => row.key === key)?.label || key));
    return <div className="npc-forge-context-card is-origin"><DetailHeader eyebrow="Background" title={option.name} source={option.source} /><div className="npc-forge-background-story"><span>Before adventuring</span>{backgroundStoryDescription(option).split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><BackgroundFeatureList features={option.features || []} /><InfoRows wideDetails rows={[{ label: "Skills", value: labelList([...skills.map((entry) => entry.label), ...selectedChoiceLabels]) || "Choice required", details: skills, control: <BackgroundSkillChooser groups={backgroundMechanicDetails?.skillChoices || []} selections={backgroundSkillSelections} onToggle={onToggleBackgroundSkill} />, actionLabel: backgroundMechanicDetails?.skillChoices?.length ? "Choose" : "Info", defaultOpen: Boolean(backgroundMechanicDetails?.skillChoices?.length) }, { label: "Tools", value: labelList(option.tools) || "None listed", details: backgroundMechanicDetails?.tools }, { label: "Origin feat", value: backgroundMechanicDetails?.originFeatValue || selectedBackgroundFeat?.name || "None listed", details: backgroundMechanicDetails?.originFeat, control: backgroundMechanicDetails?.featRequiresChoice ? <BackgroundFeatChooser options={backgroundFeatOptions} selectedFeat={selectedBackgroundFeat} onSelect={onSelectBackgroundFeat} /> : null, actionLabel: backgroundMechanicDetails?.featRequiresChoice ? "Choose" : "Info", defaultOpen: Boolean(backgroundMechanicDetails?.featRequiresChoice) }]} /><ExpandedSpellList groups={backgroundMechanicDetails?.spellList || []} /><div className="npc-forge-context-note">Use this history to choose former allies, obligations, rivals, and unfinished business that can matter during play.</div></div>;
  }

  if (detail?.type === "ability" && detail.key) return <div className="npc-forge-context-card is-ability"><DetailHeader eyebrow="Ability" title={ABILITY_LABELS[detail.key]} /><p>{ABILITY_DESCRIPTIONS[detail.key]}</p><InfoRows rows={[{ label: "Base score", value: draft.baseAbilities?.[detail.key] ?? 10 }, { label: "Final score", value: finalAbilities?.[detail.key] ?? 10 }, { label: "Assigned roll", value: allocation?.[detail.key] ? rolls.find((roll) => roll.id === allocation[detail.key])?.total : "Not assigned" }]} /><div className="npc-forge-context-note">A score of 10–11 is average. Every 2 points above or below 10 changes the modifier by 1.</div></div>;
  if (detail?.type === "skill" && selectedSkill) return <div className="npc-forge-context-card is-training"><DetailHeader eyebrow="Skill" title={selectedSkill.label} source={selectedSkill.source} /><p>{selectedSkill.description}</p><InfoRows rows={[{ label: "Governing ability", value: ABILITY_LABELS[selectedSkill.ability] || selectedSkill.ability }]} /><div className="npc-forge-context-note">Proficiency adds the character's proficiency bonus. Expertise is granted by an eligible feature or the Game Master.</div></div>;
  if (detail?.type === "profession" && selectedProfession) return <div className="npc-forge-context-card is-training"><DetailHeader eyebrow="Profession" title={selectedProfession.label} /><p>{selectedProfession.description || `Professional training using ${selectedProfession.tool}.`}</p><InfoRows rows={[{ label: "Tool", value: selectedProfession.tool }, { label: "Abilities", value: labelList(selectedProfession.abilities, ABILITY_LABELS) }]} /><div className="npc-forge-context-note">Selecting a crafting profession uses one Training choice. Most recipes use rest-based work and any recipe-specific work-site requirement.</div></div>;

  const fallbacks = {
    species: ["Species", "Choose a species", "Select a species to read its lore and open its feature rules."],
    background: ["Background", "Choose a background", "Select a background to read its history, skills, tools, feat, and expanded spells."],
    class: ["Class", selectedClass?.class_name || "Choose a class", "Choose a class to inspect its full progression and subclasses."],
    abilities: ["Ability Scores", "Choose a generation method", "Generate or assign the six base scores, then choose one Species Bonus package."],
    training: ["Training", "Skills, feats, and class abilities", "Use Skills & Proficiencies for training, then Feats & Class Abilities for persistent progression choices."],
    spells: ["Starting Magic", "Choose legal class spells", "The class and starting level determine cantrip, known, spellbook, prepared, and spell-level limits."],
  };
  const fallback = fallbacks[stepKey] || ["Character", "Continue building", "Complete this section, then review the finished character dossier."];
  return <div className={`npc-forge-context-card ${stepKey === "abilities" ? "is-ability" : "is-origin"}`}><DetailHeader eyebrow={fallback[0]} title={fallback[1]} /><p>{fallback[2]}</p>{stepKey === "abilities" ? <div className="npc-forge-context-ability-list">{ABILITY_KEYS.map((key) => <div key={key}><strong>{ABILITY_LABELS[key]}</strong><span>{ABILITY_DESCRIPTIONS[key]}</span></div>)}</div> : null}</div>;
}

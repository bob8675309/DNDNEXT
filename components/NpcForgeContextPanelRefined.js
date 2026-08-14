import { useEffect, useMemo, useState } from "react";
import { ABILITY_KEYS, ABILITY_LABELS, ALIGNMENT_OPTIONS } from "../utils/characterCreation";
import { ABILITY_DESCRIPTIONS } from "../utils/characterCreationGuidance";
import { STRIXHAVEN_COLLEGES } from "../utils/playerForgeFeatChoiceRouting";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { handleSpeciesArtworkError, hasSpeciesPortraitArtwork, speciesPortraitArtworkFor } from "../utils/speciesArtwork";
import { speciesFlavorLore } from "../utils/speciesLore";
import { extractSpeciesTraitChoiceRules, formatSpeciesMovement, speciesFixedLanguages, speciesTraitChoiceRuleComplete } from "../utils/speciesPresentation";
import { sourceChoiceFieldIsActive } from "../utils/playerForgeSourceChoices";
import {
  speciesCreatureTypeLabel,
  speciesFeaturePresentation,
  speciesFixedLanguageFact,
  speciesVisionExplanation,
} from "../utils/speciesForgePresentation";
import { backgroundStoryDescription } from "../utils/backgroundPresentation";
import { supabase } from "../utils/supabaseClient";
import ForgeSemanticIcon, { speciesFeatureIconKind } from "./ForgeSemanticIcon";
import NpcForgeEmbeddedSourceChoices, {
  sourceChoiceDisplayValue,
  sourceChoiceGroupHasKind,
  sourceChoiceGroupsHaveChoices,
  sourceChoiceGroupsNeedInput,
} from "./NpcForgeEmbeddedSourceChoices";
import { sourceChoiceGroupsForPlacement, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import { useNpcForgeSpeciesChoices } from "./NpcForgeSpeciesChoiceContext";

const SIZE_LABELS = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan", V: "Variable" };
const GENDER_PRESENTATION_OPTIONS = Object.freeze([
  { key: "female", label: "Female" },
  { key: "male", label: "Male" },
  { key: "neutral", label: "Nonbinary / neutral" },
]);
const SPELL_SOURCE_PRIORITY = { XPHB: 0, PHB: 1 };
const safeText = (value) => String(value ?? "").trim();
function sourceLabel(source = "") { if (source === "XPHB") return "2024 Player's Handbook"; if (source === "PHB") return "2014 Player's Handbook"; if (source === "CAMPAIGN") return "Campaign"; return source || "Source unknown"; }
function labelList(values = [], labels = {}) { return (Array.isArray(values) ? values : []).map((value) => labels[value] || value).filter(Boolean).join(", "); }
function normalizeName(value = "") { return safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function DetailHeader({ eyebrow, title, source }) { return <div className="npc-forge-context-head"><div><span>{eyebrow}</span><h3>{title}</h3></div>{source ? <span className="npc-forge-context-source">{sourceLabel(source)}</span> : null}</div>; }

function readableRuleParagraphs(value, fallback = "") {
  const formatted = formatPlayerFacingText(value, fallback);
  if (!formatted) return [];
  const sectioned = formatted.replace(/(?<=[.!?])\s+(?=[A-Z][A-Za-z'’/-]*(?:\s+[A-Z][A-Za-z'’/-]*){0,3}\.\s+(?:You|Your|When|Whenever|While|If|Choose|Increase|As|The)\b)/g, "\n\n");
  return sectioned.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function RuleCopy({ text, fallback = "" }) {
  const paragraphs = readableRuleParagraphs(text, fallback);
  return paragraphs.length ? <div className="npc-forge-rule-copy">{paragraphs.map((paragraph, index) => <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>)}</div> : null;
}

function InfoRows({ rows = [], wideDetails = false }) {
  return <div className={`npc-forge-context-rows${wideDetails ? " npc-forge-background-info-rows" : ""}`}>{rows.filter((row) => row?.value !== undefined && row?.value !== null && row?.value !== "").map((row) => {
    const details = (Array.isArray(row.details) ? row.details : []).filter((entry) => entry?.description);
    const interactive = details.length || row.control;
    if (!interactive) return <div key={row.label} className="npc-forge-context-row"><span>{row.label}</span><strong>{row.value}</strong></div>;
    return <details key={row.label} className="npc-forge-context-row is-interactive" defaultOpen={Boolean(row.defaultOpen)}><summary><span>{row.label}</span><strong>{row.value}<em>{row.actionLabel || "Info"}</em></strong></summary><div className="npc-forge-context-row-details">{row.control || null}{details.map((entry, index) => <article key={`${entry.label || row.label}-${index}`}><div><b>{entry.label || row.label}</b>{entry.source ? <small>{sourceLabel(entry.source)}</small> : null}</div><RuleCopy text={entry.description} />{entry.prerequisite ? <small>Prerequisite: {formatPlayerFacingText(entry.prerequisite)}</small> : null}</article>)}</div></details>;
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

function playerSpellFeature(entry = {}) {
  const description = safeText(entry.description);
  if (!description || !/(?:cantrip|\bspell\b|spellcasting ability)/i.test(description)) return false;
  return /(?:you know|you learn|you can cast|spellcasting ability|cantrip)/i.test(description);
}

function sourceGroupMatchesTrait(group = {}, traitName = "") {
  const trait = normalizeName(traitName);
  if (!trait) return false;
  if (normalizeName(group.label) === trait || normalizeName(group.metadata?.sourceTrait) === trait) return true;
  const fields = group.fields || [];
  if (/\blanguages?\b/.test(trait) && fields.some((field) => field.kind === "language")) return true;
  if (trait === "size" && fields.some((field) => field.kind === "size")) return true;
  if (trait === "eladrin seasons" && group.metadata?.family === "eladrin-season") return true;
  return false;
}

function routedBadge(training, spells) {
  if (training && spells) return "Training / Spells";
  if (training) return "Training";
  if (spells) return "Spells";
  return "Open";
}

function SpeciesFeatureTitle({ label }) {
  const iconKind = speciesFeatureIconKind(label);
  return <span className="npc-forge-species-feature-title"><ForgeSemanticIcon kind={iconKind} /><span>{label}</span></span>;
}

function sourceFactGroups(groups = [], kind = "", selections = {}) {
  return groups.filter((group) => (group.fields || []).some((field) => field.kind === kind && !field.autoSelect && sourceChoiceFieldIsActive(field, selections)));
}

function selectedSourceFactLabels(groups = [], kind = "", selections = {}) {
  const labels = [];
  for (const group of groups) {
    for (const field of group.fields || []) {
      if (field.kind !== kind || field.autoSelect || !sourceChoiceFieldIsActive(field, selections)) continue;
      for (const key of selections?.[group.id]?.[field.id] || []) {
        const label = (field.options || []).find((option) => option.key === key)?.label;
        if (label && normalizeName(label) !== "common" && !labels.includes(label)) labels.push(label);
      }
    }
  }
  return labels;
}

function factChoicePresentationGroups(groups = [], kind = "", selections = {}) {
  return groups.map((group) => ({
    ...group,
    fields: (group.fields || []).filter((field) => field.kind === kind && !field.autoSelect && sourceChoiceFieldIsActive(field, selections)).map((field) => ({
      ...field,
      label: kind === "language" ? "Origin language" : field.label,
      helper: "",
      options: kind === "language" ? (field.options || []).filter((option) => normalizeName(option.label) !== "common") : field.options,
    })),
  })).filter((group) => group.fields.length);
}

function SpeciesStaticFact({ kind, title, value, tooltip = "" }) {
  const tooltipId = tooltip ? `species-${kind}-explanation` : undefined;
  return <div data-icon-kind={kind} className={tooltip ? "has-fact-tooltip" : ""} tabIndex={tooltip ? 0 : undefined} aria-describedby={tooltipId}><ForgeSemanticIcon kind={kind} /><span className="npc-forge-species-fact-copy"><small>{title}</small><strong>{value}</strong></span>{tooltip ? <span id={tooltipId} className="npc-forge-species-fact-tooltip" role="tooltip">{tooltip}</span> : null}</div>;
}

function SpeciesChoiceFact({ kind, title, groups = [], selections = {}, onToggle = null, onSet = null, prefixValue = "" }) {
  const iconKind = kind === "language" ? "languages" : kind;
  const presentationGroups = factChoicePresentationGroups(groups, kind, selections);
  const count = groups.reduce((total, group) => total + (group.fields || []).filter((field) => field.kind === kind && !field.autoSelect && sourceChoiceFieldIsActive(field, selections)).reduce((sum, field) => sum + Number(field.count || 1), 0), 0);
  const selected = selectedSourceFactLabels(groups, kind, selections);
  const needsInput = sourceChoiceGroupsNeedInput(presentationGroups, selections);
  const originLanguages = kind === "language" && groups.some((group) => group.id === "origin-standard-languages");
  const prompt = originLanguages && count === 2
    ? "Click here to select two Origin languages"
    : `Click here to select ${count > 1 ? `${count} ${title}` : `a ${title.toLowerCase()}`}`;
  const value = needsInput ? prompt : [prefixValue, ...selected].filter(Boolean).join(", ");
  const helper = originLanguages
    ? "Select two Origin languages (besides Common). Common is automatic for player characters."
    : `Select ${count > 1 ? count : "a"} ${title.toLowerCase()}.`;
  return <details className={`npc-forge-species-fact-choice${needsInput ? " is-required" : " is-complete"}`} data-icon-kind={iconKind}><summary><ForgeSemanticIcon kind={iconKind} /><span className="npc-forge-species-fact-copy"><small>{title}</small><strong>{value}</strong></span></summary><div className="npc-forge-species-fact-choice__body"><p>{helper}</p><NpcForgeEmbeddedSourceChoices groups={presentationGroups} selections={selections} onToggle={onToggle} onSet={onSet} compact /></div></details>;
}

function SpeciesIdentityFact({ gender = "neutral", alignment = "N", onPatch = null }) {
  const genderLabel = GENDER_PRESENTATION_OPTIONS.find((option) => option.key === gender)?.label || "Nonbinary / neutral";
  const alignmentKey = String(alignment || "N").toUpperCase();
  const alignmentLabel = ALIGNMENT_OPTIONS.find((option) => option.key === alignmentKey)?.label || "Neutral";
  return <details className="npc-forge-species-fact-choice npc-forge-species-identity-fact is-complete" data-icon-kind="identity"><summary><ForgeSemanticIcon kind="identity" /><span className="npc-forge-species-fact-copy"><small>Presentation &amp; alignment</small><strong>{genderLabel} • {alignmentLabel}</strong></span></summary><div className="npc-forge-species-fact-choice__body"><p>These character details do not change the selected Species rules.</p><div className="npc-forge-species-identity-controls"><label><span>Gender presentation</span><select value={gender} onChange={(event) => onPatch?.({ gender: event.target.value })}>{GENDER_PRESENTATION_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><label><span>Alignment</span><select value={alignmentKey} onChange={(event) => onPatch?.({ alignment: event.target.value })}>{ALIGNMENT_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label></div></div></details>;
}

function SpeciesFeatureOptionCards({ label = "Available options", options = [] }) {
  if (!options.length) return null;
  return <section className="npc-forge-species-option-cards" aria-label={label}><span>{label}</span><div>{options.map((option) => <article key={option.name}><strong>{option.name}</strong><RuleCopy text={option.description} /></article>)}</div></section>;
}

function SpeciesTraitDetails({ playerMode = false, details = [], traits = [], choiceRules = [], selections = {}, onSelectChoice, spellHelp = {}, sourceGroups = [], trainingGroups = [], spellGroups = [], sourceSelections = {}, onToggleSource = null, onSetSource = null }) {
  const described = details.filter((entry) => entry?.name && entry?.description);
  const names = new Set(described.map((entry) => entry.name));
  const concise = traits.filter((trait) => trait && !names.has(trait));
  const consumed = new Set();
  const takeGroups = (traitName) => sourceGroups.filter((group) => !consumed.has(group.id) && sourceGroupMatchesTrait(group, traitName)).map((group) => { consumed.add(group.id); return group; });
  const describedCards = described.map((entry, index) => {
    const rule = choiceRules.find((candidate) => candidate.traitName === entry.name);
    const ownedGroups = takeGroups(entry.name);
    const hasEmbeddedChoice = sourceChoiceGroupsHaveChoices(ownedGroups, sourceSelections);
    const sourceNeedsInput = sourceChoiceGroupsNeedInput(ownedGroups, sourceSelections);
    const ruleComplete = rule ? speciesTraitChoiceRuleComplete(rule, selections) : true;
    const complete = ruleComplete && !sourceNeedsInput;
    const routedTraining = playerMode && trainingGroups.some((group) => sourceGroupMatchesTrait(group, entry.name));
    const routedSpells = playerMode && (spellGroups.some((group) => sourceGroupMatchesTrait(group, entry.name)) || (!rule && !hasEmbeddedChoice && playerSpellFeature(entry)));
    const hasChoice = Boolean(rule || hasEmbeddedChoice);
    return <details key={`${entry.name}-${index}`} data-feature-kind={speciesFeatureIconKind(entry.name)} defaultOpen={Boolean((hasChoice && !complete) || sourceNeedsInput)}><summary><SpeciesFeatureTitle label={entry.name} />{hasChoice ? <em className={complete ? "is-complete" : "is-required"}>{complete ? "Selected" : "Choose"}</em> : routedTraining || routedSpells ? <em className="is-routed">{routedBadge(routedTraining, routedSpells)}</em> : <em>Open</em>}</summary><RuleCopy text={entry.description} />{!hasEmbeddedChoice && !rule ? <SpeciesFeatureOptionCards label={entry.optionCardsLabel} options={entry.optionCards || []} /> : null}{routedTraining ? <div className="npc-forge-species-spell-route is-training"><strong>Resolved in Training</strong><span>Choose this species-granted proficiency in Training → Skills & Proficiencies, where the skill descriptions and the character's other proficiencies are visible.</span></div> : null}{routedSpells ? <div className="npc-forge-species-spell-route"><strong>Resolved in Spells</strong><span>Any spell or cantrip selection for this feature is completed on the Spells step. When the source allows Intelligence, Wisdom, or Charisma, the Forge automatically uses the highest eligible final ability instead of asking for a separate casting-stat choice.</span></div> : null}{rule ? <SpeciesTraitChoiceControl rule={rule} selections={selections} onSelect={onSelectChoice} spellHelp={spellHelp} /> : null}<NpcForgeEmbeddedSourceChoices groups={ownedGroups} selections={sourceSelections} onToggle={onToggleSource} onSet={onSetSource} compact /></details>;
  });
  const conciseCards = concise.map((trait) => {
    const ownedGroups = takeGroups(trait);
    const hasEmbeddedChoice = sourceChoiceGroupsHaveChoices(ownedGroups, sourceSelections);
    const needsInput = sourceChoiceGroupsNeedInput(ownedGroups, sourceSelections);
    const routedTraining = playerMode && trainingGroups.some((group) => sourceGroupMatchesTrait(group, trait));
    const routedSpells = playerMode && spellGroups.some((group) => sourceGroupMatchesTrait(group, trait));
    return <details key={trait} data-feature-kind={speciesFeatureIconKind(trait)} defaultOpen={needsInput}><summary><SpeciesFeatureTitle label={trait} />{hasEmbeddedChoice ? <em className={needsInput ? "is-required" : "is-complete"}>{needsInput ? "Choose" : "Selected"}</em> : routedTraining || routedSpells ? <em className="is-routed">{routedBadge(routedTraining, routedSpells)}</em> : <em>Open</em>}</summary><p>This source feature is listed for the selected species. Its complete imported description will appear here when available.</p>{routedTraining ? <div className="npc-forge-species-spell-route is-training"><strong>Resolved in Training</strong><span>Choose this species-granted proficiency in Training → Skills & Proficiencies.</span></div> : null}{routedSpells ? <div className="npc-forge-species-spell-route"><strong>Resolved in Spells</strong><span>Species magic is completed on the Spells step; flexible casting ability is derived from final ability scores.</span></div> : null}<NpcForgeEmbeddedSourceChoices groups={ownedGroups} selections={sourceSelections} onToggle={onToggleSource} onSet={onSetSource} compact /></details>;
  });
  const unmatched = sourceGroups.filter((group) => !consumed.has(group.id) && sourceChoiceGroupsHaveChoices([group], sourceSelections));
  const fallbackCards = unmatched.map((group) => {
    const needsInput = sourceChoiceGroupsNeedInput([group], sourceSelections);
    return <details key={`source-${group.id}`} className="npc-forge-species-source-fallback" data-feature-kind={speciesFeatureIconKind(group.label)} defaultOpen={needsInput}><summary><SpeciesFeatureTitle label={group.label} /><em className={needsInput ? "is-required" : "is-complete"}>{needsInput ? "Choose" : "Selected"}</em></summary><NpcForgeEmbeddedSourceChoices groups={[group]} selections={sourceSelections} onToggle={onToggleSource} onSet={onSetSource} compact /></details>;
  });
  return <div className="npc-forge-context-section npc-forge-species-features"><span>Species features</span><div className="npc-forge-species-feature-list">{describedCards}{conciseCards}{fallbackCards}</div></div>;
}

function BackgroundSkillChooser({ groups = [], selections = {}, onToggle }) { return <div className="npc-forge-context-choice-stack">{groups.map((group) => { const selected = selections[group.id] || []; return <section key={group.id}><div className="npc-forge-context-choice-head"><b>Choose {group.count} skill{group.count === 1 ? "" : "s"}</b><small>{selected.length}/{group.count} selected</small></div><div className="npc-forge-context-choice-grid">{group.options.map((option) => <button key={option.key} type="button" className={selected.includes(option.key) ? "is-selected" : ""} onClick={() => onToggle?.(group.id, option.key, group.count)}><strong>{option.label}</strong><span>{option.description}</span></button>)}</div></section>; })}</div>; }
function BackgroundFeatChooser({ options = [], selectedFeat, onSelect }) { return <div className="npc-forge-context-choice-grid feats">{options.map((feat) => <button key={feat.id} type="button" className={selectedFeat?.id === feat.id ? "is-selected" : ""} onClick={() => onSelect?.(feat.id)}><strong>{feat.name}</strong><small>{sourceLabel(feat.source)}</small><span>{formatPlayerFacingText(feat.description, "This feat is granted by the background.")}</span></button>)}</div>; }

function backgroundFeatureTextForDisplay(background, value) {
  const formatted = formatPlayerFacingText(value);
  if (safeText(background?.source).toUpperCase() !== "SCC") return formatted;
  return formatted
    .replace(/\s*Consider customizing your spells[\s\S]*$/i, "")
    .replace(/\s*(?:Lorehold|Prismari|Quandrix|Silverquill|Witherbloom) spells might[\s\S]*$/i, "")
    .trim();
}

function BackgroundFeatureList({ background = null, features = [] }) { return features.length ? <div className="npc-forge-context-section npc-forge-background-features"><span>Background feature{features.length === 1 ? "" : "s"}</span><div>{features.map((feature, index) => <details key={`${feature.name}-${index}`} defaultOpen={features.length === 1}><summary>{feature.name}</summary><RuleCopy text={backgroundFeatureTextForDisplay(background, feature.description)} /></details>)}</div></div> : null; }

function ExpandedSpellList({ groups = [] }) {
  const [spellHelp, setSpellHelp] = useState({});
  const spellNames = useMemo(() => [...new Set((Array.isArray(groups) ? groups : []).flatMap((group) => Array.isArray(group?.spells) ? group.spells : []).map(safeText).filter(Boolean))], [groups]);
  useEffect(() => {
    let active = true;
    if (!spellNames.length) { setSpellHelp({}); return () => { active = false; }; }
    supabase.from("spells_catalog")
      .select("name,source,casting_time,range_text,duration_text,description")
      .in("name", spellNames)
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
        setSpellHelp(Object.fromEntries(preferred));
      });
    return () => { active = false; };
  }, [spellNames]);

  return groups.length ? <details className="npc-forge-context-section npc-forge-background-spells"><summary><span>Expanded spell list</span><em>Info</em></summary><div className="npc-forge-background-spell-body"><p>These spells join the class list when a class grants Spellcasting or Pact Magic; they are not automatically known or prepared.</p>{groups.map((group) => <div key={group.level}><strong>{group.label}</strong><span className="npc-forge-background-spell-names">{group.spells.map((name, index) => {
    const help = spellHelp[normalizeName(name)];
    return <span key={name} className={`npc-forge-background-spell-name ${help ? "has-spell-help" : ""}`} tabIndex={help ? 0 : undefined}>{name}<SpellChoiceHelp spell={help} />{index < group.spells.length - 1 ? <i>, </i> : null}</span>;
  })}</span></div>)}</div></details> : null;
}

function strixhavenCollegeForBackground(background = null) {
  const name = normalizeName(background?.name || background?.sourceName || "");
  return Object.entries(STRIXHAVEN_COLLEGES).find(([key]) => name.includes(key))?.[1] || null;
}
function backgroundFeatDetailsForDisplay(background, details = []) {
  const college = strixhavenCollegeForBackground(background);
  if (!college) return details;
  return (details || []).map((entry) => normalizeName(entry?.label) === "strixhaven initiate" ? {
    ...entry,
    description: `${college.label} is fixed by this background. Strixhaven Initiate grants two cantrips chosen from ${college.cantrips.join(", ")} and one level 1 ${college.classes.join(" or ")} spell. Complete those spell choices on the Spells step. When the feat allows Intelligence, Wisdom, or Charisma, the Forge automatically uses the highest eligible final ability.`,
  } : entry);
}

function BackgroundSourceFallback({ groups = [], selections = {}, onToggle = null, onSet = null }) {
  const visible = groups.filter((group) => sourceChoiceGroupsHaveChoices([group], selections));
  if (!visible.length) return null;
  return <div className="npc-forge-context-section npc-forge-background-source-fallback"><span>Additional source choices</span><div>{visible.map((group) => {
    const needsInput = sourceChoiceGroupsNeedInput([group], selections);
    return <details key={group.id} defaultOpen={needsInput}><summary><span>{group.label}</span><em>{needsInput ? "Choose" : "Selected"}</em></summary><NpcForgeEmbeddedSourceChoices groups={[group]} selections={selections} onToggle={onToggle} onSet={onSet} compact /></details>;
  })}</div></div>;
}

export default function NpcForgeContextPanel({ playerMode = false, step = 0, stepKey = "", detail = null, selectedSpecies = null, selectedBackground = null, backgroundMechanicDetails = null, selectedBackgroundFeat = null, backgroundFeatOptions = [], backgroundSkillSelections = {}, onToggleBackgroundSkill = null, onSelectBackgroundFeat = null, selectedClass = null, selectedSkill = null, selectedProfession = null, rolls = [], allocation = {}, finalAbilities = {}, draft = {}, onPatch = null }) {
  const activeSpecies = detail?.type === "species" && detail.option ? detail.option : stepKey === "species" || step === 0 ? selectedSpecies : null;
  const activeBackground = detail?.type === "background" && detail.option ? detail.option : stepKey === "background" || step === 1 ? selectedBackground : null;
  const { state: speciesChoiceState, registerSpecies, selectChoice } = useNpcForgeSpeciesChoices();
  const { state: sourceChoiceState, toggleChoice: toggleSourceChoice, setChoice: setSourceChoice } = useNpcForgeSourceChoices();
  const speciesChoiceRules = useMemo(() => {
    if (!activeSpecies) return [];
    const rules = extractSpeciesTraitChoiceRules(activeSpecies);
    return playerMode ? rules.filter((rule) => !(rule.fields || []).some((field) => field.kind === "spell" || field.kind === "skill")) : rules;
  }, [activeSpecies, playerMode]);
  const [speciesSpellHelp, setSpeciesSpellHelp] = useState({});
  const spellChoiceNames = useMemo(() => [...new Set(speciesChoiceRules.flatMap((rule) => (rule.fields || []).filter((field) => field.kind === "spell").flatMap((field) => (field.options || []).map((option) => safeText(option.label || option.value))).filter(Boolean)))], [speciesChoiceRules]);
  const activeSpeciesId = String(activeSpecies?.id || activeSpecies?.name || "");
  const speciesChoiceSelections = speciesChoiceState.speciesId === activeSpeciesId ? speciesChoiceState.selections || {} : {};
  const eligibleSourceGroups = (placement) => sourceChoiceGroupsForPlacement(sourceChoiceState, placement).filter((group) => Number(group.level || 1) <= Number(draft.level || 1));
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
    const sourceGroups = playerMode ? eligibleSourceGroups("species") : [];
    const sourceSelections = sourceChoiceState.selections || {};
    const languageGroups = sourceFactGroups(sourceGroups, "language", sourceSelections);
    const sizeGroups = sourceFactGroups(sourceGroups, "size", sourceSelections);
    const featureSourceGroups = sourceGroups.flatMap((group) => {
      const fields = (group.fields || []).filter((field) => field.kind !== "language" && field.kind !== "size");
      return fields.length ? [{ ...group, fields }] : [];
    });
    const featurePresentation = speciesFeaturePresentation(option);
    const fixedLanguageValue = speciesFixedLanguageFact(fixedLanguages);
    const staticFacts = [
      { kind: "speed", title: "Speed", value: formatSpeciesMovement(option.metadata?.speed ?? option.speed) },
      ...(!sizeGroups.length ? [{ kind: "size", title: "Size", value: labelList(option.size, SIZE_LABELS) || "Source default" }] : []),
      { kind: "creature", title: "Creature type", value: speciesCreatureTypeLabel(option) },
      { kind: "vision", title: "Darkvision", value: option.darkvision ? `${option.darkvision} ft.` : null, tooltip: speciesVisionExplanation(option) },
      ...(!playerMode ? [{ kind: "ancestry", title: "Lineage", value: labelList(option.lineages) || "None required" }] : []),
      ...(!languageGroups.length ? [{ kind: "languages", title: "Languages", value: fixedLanguages.length ? fixedLanguageValue : labelList(option.languages) || safeText(draft.languagesText) || null }] : []),
    ].filter(({ value }) => value && value !== "Not listed");
    const staticFactByKind = Object.fromEntries(staticFacts.map((fact) => [fact.kind, fact]));
    const factElements = [
      staticFactByKind.speed ? <SpeciesStaticFact key="speed" {...staticFactByKind.speed} /> : null,
      sizeGroups.length ? <SpeciesChoiceFact key="size" kind="size" title="Size" groups={sizeGroups} selections={sourceSelections} onToggle={toggleSourceChoice} onSet={setSourceChoice} /> : staticFactByKind.size ? <SpeciesStaticFact key="size" {...staticFactByKind.size} /> : null,
      staticFactByKind.creature ? <SpeciesStaticFact key="creature" {...staticFactByKind.creature} /> : null,
      staticFactByKind.vision ? <SpeciesStaticFact key="vision" {...staticFactByKind.vision} /> : null,
      staticFactByKind.ancestry ? <SpeciesStaticFact key="ancestry" {...staticFactByKind.ancestry} /> : null,
      languageGroups.length ? <SpeciesChoiceFact key="languages" kind="language" title="Languages" groups={languageGroups} selections={sourceSelections} onToggle={toggleSourceChoice} onSet={setSourceChoice} prefixValue={fixedLanguageValue} /> : staticFactByKind.languages ? <SpeciesStaticFact key="languages" {...staticFactByKind.languages} /> : null,
      <SpeciesIdentityFact key="identity" gender={draft.gender} alignment={draft.alignment} onPatch={onPatch} />,
    ].filter(Boolean);
    const trainingGroups = playerMode ? eligibleSourceGroups("training").filter((group) => String(group.ownerType || "").startsWith("species")) : [];
    const spellGroups = playerMode ? eligibleSourceGroups("spells").filter((group) => String(group.ownerType || "").startsWith("species")) : [];
    return <div className="npc-forge-context-card is-origin is-species"><section className="npc-forge-species-hero"><figure className="npc-forge-species-artwork"><img src={speciesPortraitArtworkFor(option.name)} onError={handleSpeciesArtworkError} alt={`${option.name} species reference artwork`} /><figcaption><span>{option.name} reference</span>{!hasSpeciesPortraitArtwork(option.name) ? <small>Neutral reference art</small> : null}</figcaption></figure><div className="npc-forge-species-hero__copy"><h2>{option.name}</h2><span>In the world</span><p>{speciesFlavorLore(option)}</p><div className="npc-forge-species-facts">{factElements}</div></div></section><SpeciesTraitDetails playerMode={playerMode} details={featurePresentation.details} traits={featurePresentation.traits} choiceRules={speciesChoiceRules} selections={speciesChoiceSelections} onSelectChoice={selectChoice} spellHelp={speciesSpellHelp} sourceGroups={featureSourceGroups} trainingGroups={trainingGroups} spellGroups={spellGroups} sourceSelections={sourceSelections} onToggleSource={toggleSourceChoice} onSetSource={setSourceChoice} /><div className="npc-forge-context-note">Required species choices are made inside the relevant feature above, or directly in the promoted Size and Languages facts. Common is automatic for player characters. Species-granted skill proficiencies are resolved in Training, while species magic is resolved in Spells; flexible Intelligence/Wisdom/Charisma casting uses the highest eligible final ability automatically.</div><style jsx global>{`
      .npc-forge-context-card.is-species{display:grid!important;grid-template-columns:1fr!important}.npc-forge-species-hero{display:grid;grid-template-columns:minmax(280px,42%) minmax(0,1fr);min-height:360px;overflow:hidden;border:1px solid rgba(168,108,255,.34);border-radius:15px;background:radial-gradient(circle at 20% 20%,rgba(126,72,199,.2),transparent 55%),rgba(10,12,20,.92)}.npc-forge-species-hero .npc-forge-species-artwork{height:100%;min-height:360px;aspect-ratio:auto;border:0;border-radius:0}.npc-forge-species-hero .npc-forge-species-artwork img{object-fit:cover;object-position:center top}.npc-forge-species-hero__copy{display:flex;flex-direction:column;justify-content:center;gap:12px;padding:clamp(18px,3vw,34px)}.npc-forge-species-hero__copy>h2{margin:0 0 2px;color:#fff;font-size:clamp(1.2rem,2vw,1.65rem);line-height:1.15}.npc-forge-species-hero__copy>span{color:#d7bfff;font-size:.68rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.npc-forge-species-hero__copy>p{margin:0;color:rgba(255,255,255,.82);font-size:.88rem;line-height:1.72}.npc-forge-species-facts{display:flex;flex-wrap:wrap;gap:7px}.npc-forge-species-facts>div{display:grid;gap:1px;padding:6px 9px;border:1px solid rgba(88,214,199,.25);border-radius:8px;background:rgba(88,214,199,.07)}.npc-forge-species-facts small{color:rgba(255,255,255,.48);font-size:.52rem;text-transform:uppercase}.npc-forge-species-facts strong{color:#d8fff9;font-size:.66rem}.npc-forge-species-feature-list{align-items:start}.npc-forge-species-feature-list details{align-self:start;border-color:rgba(168,108,255,.34)!important;background:linear-gradient(90deg,rgba(126,72,199,.15),rgba(88,214,199,.035))!important}.npc-forge-species-feature-list em.is-routed{color:#9cece2!important}.npc-forge-species-spell-route{display:grid;gap:3px;margin-top:8px;padding:8px 10px;border-left:3px solid #58d6c7;border-radius:7px;background:rgba(88,214,199,.07)}.npc-forge-species-spell-route.is-training{border-left-color:#a86cff;background:rgba(126,72,199,.075)}.npc-forge-species-spell-route strong{color:#c9fff7;font-size:.64rem}.npc-forge-species-spell-route.is-training strong{color:#eadfff}.npc-forge-species-spell-route span{color:rgba(255,255,255,.72);font-size:.65rem;line-height:1.45}@media(max-width:850px){.npc-forge-species-hero{grid-template-columns:1fr}.npc-forge-species-hero .npc-forge-species-artwork{min-height:420px}.npc-forge-species-hero__copy{justify-content:start}}
    `}</style></div>;
  }

  if (activeBackground) {
    const option = activeBackground;
    const skills = backgroundMechanicDetails?.skills || [];
    const originFeatDetails = backgroundFeatDetailsForDisplay(option, backgroundMechanicDetails?.originFeat || []);
    const selectedChoiceLabels = (backgroundMechanicDetails?.skillChoices || []).flatMap((group) => (backgroundSkillSelections[group.id] || []).map((key) => group.options.find((row) => row.key === key)?.label || key));
    const sourceGroups = playerMode ? eligibleSourceGroups("background") : [];
    const featNames = new Set([selectedBackgroundFeat?.name, ...originFeatDetails.map((entry) => entry.label)].map(normalizeName).filter(Boolean));
    const featGroups = sourceGroups.filter((group) => featNames.has(normalizeName(group.label)) || featNames.has(normalizeName(group.metadata?.featName)));
    const claimed = new Set(featGroups.map((group) => group.id));
    const languageGroups = sourceGroups.filter((group) => !claimed.has(group.id) && sourceChoiceGroupHasKind(group, "language"));
    languageGroups.forEach((group) => claimed.add(group.id));
    const toolGroups = sourceGroups.filter((group) => !claimed.has(group.id) && sourceChoiceGroupHasKind(group, "tool"));
    toolGroups.forEach((group) => claimed.add(group.id));
    const skillSourceGroups = sourceGroups.filter((group) => !claimed.has(group.id) && sourceChoiceGroupHasKind(group, "skill"));
    skillSourceGroups.forEach((group) => claimed.add(group.id));
    const fallbackGroups = sourceGroups.filter((group) => !claimed.has(group.id));
    const sourceSelections = sourceChoiceState.selections || {};
    const backgroundRows = [];
    if (skills.length || selectedChoiceLabels.length || skillSourceGroups.length) backgroundRows.push({
      label: "Skills",
      value: sourceChoiceDisplayValue(skillSourceGroups, sourceSelections, labelList([...skills.map((entry) => entry.label), ...selectedChoiceLabels]) || "Choice required"),
      details: skills,
      control: <div className="npc-forge-background-row-controls"><BackgroundSkillChooser groups={backgroundMechanicDetails?.skillChoices || []} selections={backgroundSkillSelections} onToggle={onToggleBackgroundSkill} /><NpcForgeEmbeddedSourceChoices groups={skillSourceGroups} selections={sourceSelections} onToggle={toggleSourceChoice} onSet={setSourceChoice} compact /></div>,
      actionLabel: backgroundMechanicDetails?.skillChoices?.length || skillSourceGroups.length ? "Choose" : "Info",
      defaultOpen: Boolean(backgroundMechanicDetails?.skillChoices?.length || sourceChoiceGroupsNeedInput(skillSourceGroups, sourceSelections)),
    });
    if ((option.tools || []).length || toolGroups.length) backgroundRows.push({
      label: "Tools",
      value: sourceChoiceDisplayValue(toolGroups, sourceSelections, labelList(option.tools) || "Choice required"),
      details: backgroundMechanicDetails?.tools,
      control: toolGroups.length ? <NpcForgeEmbeddedSourceChoices groups={toolGroups} selections={sourceSelections} onToggle={toggleSourceChoice} onSet={setSourceChoice} compact /> : null,
      actionLabel: toolGroups.length ? "Choose" : "Info",
      defaultOpen: sourceChoiceGroupsNeedInput(toolGroups, sourceSelections),
    });
    if (languageGroups.length) backgroundRows.push({
      label: "Languages",
      value: sourceChoiceDisplayValue(languageGroups, sourceSelections, "Choice required"),
      control: <NpcForgeEmbeddedSourceChoices groups={languageGroups} selections={sourceSelections} onToggle={toggleSourceChoice} onSet={setSourceChoice} compact />,
      actionLabel: "Choose",
      defaultOpen: sourceChoiceGroupsNeedInput(languageGroups, sourceSelections),
    });
    const originFeatValue = backgroundMechanicDetails?.originFeatValue || selectedBackgroundFeat?.name || "";
    if ((originFeatValue && originFeatValue !== "None listed") || originFeatDetails.length || featGroups.length) backgroundRows.push({
      label: "Origin feat",
      value: originFeatValue || "Choice required",
      details: originFeatDetails,
      control: <div className="npc-forge-background-row-controls">{backgroundMechanicDetails?.featRequiresChoice ? <BackgroundFeatChooser options={backgroundFeatOptions} selectedFeat={selectedBackgroundFeat} onSelect={onSelectBackgroundFeat} /> : null}<NpcForgeEmbeddedSourceChoices groups={featGroups} selections={sourceSelections} onToggle={toggleSourceChoice} onSet={setSourceChoice} compact /></div>,
      actionLabel: backgroundMechanicDetails?.featRequiresChoice || featGroups.length ? "Choose" : "Info",
      defaultOpen: Boolean(backgroundMechanicDetails?.featRequiresChoice || sourceChoiceGroupsNeedInput(featGroups, sourceSelections)),
    });
    return <div className="npc-forge-context-card is-origin"><DetailHeader eyebrow="Background" title={option.name} source={option.source} /><div className="npc-forge-background-story"><span>Before adventuring</span>{backgroundStoryDescription(option).split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><BackgroundFeatureList background={option} features={option.features || []} /><InfoRows wideDetails rows={backgroundRows} /><BackgroundSourceFallback groups={fallbackGroups} selections={sourceSelections} onToggle={toggleSourceChoice} onSet={setSourceChoice} /><ExpandedSpellList groups={backgroundMechanicDetails?.spellList || []} /><div className="npc-forge-context-note">Use this history to choose former allies, obligations, rivals, and unfinished business that can matter during play. Background-granted language and tool choices stay with the background that grants them; spell choices granted by a fixed feat are resolved on the Spells step.</div></div>;
  }

  if (detail?.type === "ability" && detail.key) return <div className="npc-forge-context-card is-ability"><DetailHeader eyebrow="Ability" title={ABILITY_LABELS[detail.key]} /><p>{ABILITY_DESCRIPTIONS[detail.key]}</p><InfoRows rows={[{ label: "Base score", value: draft.baseAbilities?.[detail.key] ?? 10 }, { label: "Final score", value: finalAbilities?.[detail.key] ?? 10 }, { label: "Assigned roll", value: allocation?.[detail.key] ? rolls.find((roll) => roll.id === allocation[detail.key])?.total : "Not assigned" }]} /><div className="npc-forge-context-note">A score of 10–11 is average. Every 2 points above or below 10 changes the modifier by 1.</div></div>;
  if (detail?.type === "skill" && selectedSkill) return <div className="npc-forge-context-card is-training"><DetailHeader eyebrow="Skill" title={selectedSkill.label} source={selectedSkill.source} /><p>{selectedSkill.description}</p><InfoRows rows={[{ label: "Governing ability", value: ABILITY_LABELS[selectedSkill.ability] || selectedSkill.ability }]} /><div className="npc-forge-context-note">Proficiency adds the character's proficiency bonus. Expertise is granted by an eligible feature or the Game Master.</div></div>;
  if (detail?.type === "profession" && selectedProfession) return <div className="npc-forge-context-card is-training"><DetailHeader eyebrow="Profession" title={selectedProfession.label} /><p>{selectedProfession.description || `Professional training using ${selectedProfession.tool}.`}</p><InfoRows rows={[{ label: "Tool", value: selectedProfession.tool }, { label: "Abilities", value: labelList(selectedProfession.abilities, ABILITY_LABELS) }]} /><div className="npc-forge-context-note">Selecting a crafting profession uses one Training choice. Most recipes use rest-based work and any recipe-specific work-site requirement.</div></div>;

  const fallbacks = {
    species: ["Species", "Choose a species", "Select a species to read its lore and open its feature rules."],
    background: ["Background", "Choose a background", "Select a background to read its history, skills, tools, languages, feat, and expanded spells."],
    class: ["Class", selectedClass?.class_name || "Choose a class", "Choose a class to inspect its full progression and subclasses."],
    abilities: ["Ability Scores", "Choose a generation method", "Generate or assign the six base scores, then choose one Species Bonus package."],
    training: ["Training", "Skills, feats, and class abilities", "Use Skills & Proficiencies for training, then Feats & Class Abilities for persistent progression choices."],
    spells: ["Starting Magic", "Resolve every spell source", "Class, species, feat, background, and class-feature spell choices are resolved here when applicable."],
  };
  const fallback = fallbacks[stepKey] || ["Character", "Continue building", "Complete this section, then review the finished character dossier."];
  return <div className={`npc-forge-context-card ${stepKey === "abilities" ? "is-ability" : "is-origin"}`}><DetailHeader eyebrow={fallback[0]} title={fallback[1]} /><p>{fallback[2]}</p>{stepKey === "abilities" ? <div className="npc-forge-context-ability-list">{ABILITY_KEYS.map((key) => <div key={key}><strong>{ABILITY_LABELS[key]}</strong><span>{ABILITY_DESCRIPTIONS[key]}</span></div>)}</div> : null}</div>;
}

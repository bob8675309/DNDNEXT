import { useEffect, useMemo, useState } from "react";
import { backgroundFeatPresentation, backgroundFeatRouteNote, featSectionsAreChoiceOptions } from "../utils/backgroundFeatPresentation";
import { backgroundStoryDescription } from "../utils/backgroundPresentation";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { supabase } from "../utils/supabaseClient";
import NpcForgeEmbeddedSourceChoices, {
  sourceChoiceDisplayValue,
  sourceChoiceGroupHasKind,
  sourceChoiceGroupsHaveChoices,
  sourceChoiceGroupsNeedInput,
} from "./NpcForgeEmbeddedSourceChoices";
import { sourceChoiceGroupsForPlacement, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const array = (value) => Array.isArray(value) ? value : [];
const SPELL_SOURCE_PRIORITY = { XPHB: 0, PHB: 1 };

function sourceLabel(source = "") {
  if (source === "XPHB") return "2024 Player's Handbook";
  if (source === "PHB") return "2014 Player's Handbook";
  if (source === "CAMPAIGN") return "Campaign";
  return source || "Source";
}

function backgroundPayload(background = {}) {
  return background.rawPayload || background.raw_payload || background.metadata?.rawPayload || background.metadata?.raw_payload || {};
}

function RuleCopy({ value = "" }) {
  const paragraphs = formatPlayerFacingText(value, "").split(/\n\s*\n/).map((entry) => entry.trim()).filter(Boolean);
  return paragraphs.length ? <div className="npc-forge-bg-rule-copy">{paragraphs.map((paragraph, index) => <p key={`${paragraph.slice(0, 28)}-${index}`}>{paragraph}</p>)}</div> : null;
}

function sourceListItems(background = {}, sectionName = "") {
  const entries = array(backgroundPayload(background).entries);
  const section = entries.find((entry) => entry && typeof entry === "object" && norm(entry.name) === norm(sectionName));
  if (!section) return [];
  const lists = [];
  function inspect(node) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(inspect); return; }
    if (typeof node !== "object") return;
    if (node.type === "list" && Array.isArray(node.items)) lists.push(node);
    if (node.entries) inspect(node.entries);
    if (node.items && node.type !== "list") inspect(node.items);
  }
  inspect(section.entries || section.entry || []);
  return lists.flatMap((list) => array(list.items).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const label = formatPlayerFacingText(item.name || "", "").replace(/[.:]+$/g, "").trim();
    const description = formatPlayerFacingText(array(item.entries).join("\n\n") || item.entry || "", "").trim();
    return label && description ? [{ label, description }] : [];
  }));
}

function backgroundFeatureTextForDisplay(background, value) {
  const formatted = formatPlayerFacingText(value, "");
  if (text(background?.source).toUpperCase() !== "SCC") return formatted;
  return formatted
    .split(/\n\s*\n/)
    .filter((paragraph) => !/^(?:Lorehold|Prismari|Quandrix|Silverquill|Witherbloom) Spells$/i.test(paragraph.trim()))
    .filter((paragraph) => !/^Spell Level:\s*.+?\s+•\s+Spells:/i.test(paragraph.trim()))
    .join("\n\n")
    .replace(/\s*Consider customizing your spells[\s\S]*$/i, "")
    .replace(/\s*(?:Lorehold|Prismari|Quandrix|Silverquill|Witherbloom) spells might[\s\S]*$/i, "")
    .trim();
}

function BackgroundFeatures({ background = {}, features = [], featOptions = [] }) {
  const featNames = new Set(array(featOptions).map((feat) => norm(feat?.name)).filter(Boolean));
  const visible = array(features).filter((feature) => {
    if (!feature?.name || !feature?.description) return false;
    const grantOnly = featNames.has(norm(feature.name)) && /^you gain (?:the )?.+ feat\.?$/i.test(formatPlayerFacingText(feature.description, "").trim());
    return !grantOnly;
  });
  if (!visible.length) return null;
  return <section className="npc-forge-bg-section npc-forge-bg-features"><header><span>Background features</span><small>{visible.length} source feature{visible.length === 1 ? "" : "s"}</small></header><div>{visible.map((feature, index) => {
    const listItems = sourceListItems(background, feature.name);
    return <details key={`${feature.name}-${index}`}><summary><strong>{feature.name}</strong><em>Open</em></summary><div className="npc-forge-bg-feature-body"><RuleCopy value={backgroundFeatureTextForDisplay(background, feature.description)} />{listItems.length ? <div className="npc-forge-bg-mini-cards">{listItems.map((item) => <article key={item.label}><strong>{item.label}</strong><p>{item.description}</p></article>)}</div> : null}</div></details>;
  })}</div></section>;
}

function FeatTable({ table }) {
  if (!table?.rows?.length) return null;
  return <div className="npc-forge-bg-feat-table"><strong>{table.title || "Options"}</strong>{table.headers?.length ? <div className="npc-forge-bg-feat-table__row is-head">{table.headers.map((header, index) => <span key={`${header}-${index}`}>{header}</span>)}</div> : null}{table.rows.map((row, rowIndex) => <div className="npc-forge-bg-feat-table__row" key={rowIndex}>{row.map((cell, cellIndex) => <span key={`${rowIndex}-${cellIndex}`}>{cell}</span>)}</div>)}</div>;
}

function BackgroundFeatDetail({ feat = null, routeNote = "" }) {
  if (!feat) return null;
  const presentation = backgroundFeatPresentation(feat);
  const choiceDriven = featSectionsAreChoiceOptions(feat.name);
  const visibleSections = choiceDriven ? presentation.sections.filter((section) => section.generalRule) : presentation.sections;
  const visibleTables = choiceDriven ? [] : presentation.tables;
  return <article className="npc-forge-bg-feat-detail"><header><div><span>Feat</span><strong>{feat.name}</strong></div><small>{sourceLabel(feat.source)}</small></header>{presentation.intro.length ? <div className="npc-forge-bg-feat-intro">{presentation.intro.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div> : null}{visibleSections.length ? <div className="npc-forge-bg-feat-sections">{visibleSections.map((section, index) => <section key={`${section.title}-${index}`}><strong>{section.title}</strong>{section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}{section.tables.map((table, tableIndex) => <FeatTable table={table} key={tableIndex} />)}</section>)}</div> : null}{visibleTables.map((table, index) => <FeatTable table={table} key={index} />)}{routeNote ? <div className="npc-forge-bg-route-note">{routeNote}</div> : null}</article>;
}

function CompactFeatChooser({ options = [], selectedFeat = null, onSelect = null }) {
  if (options.length <= 1) return null;
  if (options.length > 4) return <label className="npc-forge-bg-feat-select"><span>Choose the feat granted by this background</span><select value={selectedFeat?.id || ""} onChange={(event) => onSelect?.(event.target.value)}><option value="">Choose a feat…</option>{options.map((feat) => <option key={feat.id} value={feat.id}>{feat.name} • {feat.source || "Source"}</option>)}</select></label>;
  return <div className="npc-forge-bg-feat-buttons">{options.map((feat) => <button key={feat.id} type="button" className={selectedFeat?.id === feat.id ? "is-selected" : ""} onClick={() => onSelect?.(feat.id)}><strong>{feat.name}</strong><small>{sourceLabel(feat.source)}</small></button>)}</div>;
}

function GrantCard({ label, value, badge = "", children = null, required = false }) {
  return <section className={`npc-forge-bg-grant-card${required ? " is-required" : ""}`}><header><span>{label}</span>{badge ? <em>{badge}</em> : null}</header><strong>{value || "Not listed"}</strong>{children}</section>;
}

function selectedLabels(groups = [], selections = {}) {
  const labels = [];
  for (const group of groups) {
    for (const field of group.fields || []) {
      for (const key of selections?.[group.id]?.[field.id] || []) {
        const label = (field.options || []).find((option) => option.key === key)?.label;
        if (label && !labels.includes(label)) labels.push(label);
      }
    }
  }
  return labels;
}

function ExpandedSpellList({ groups = [] }) {
  const [spellHelp, setSpellHelp] = useState({});
  const names = useMemo(() => [...new Set(array(groups).flatMap((group) => array(group?.spells)).map(text).filter(Boolean))], [groups]);
  useEffect(() => {
    let active = true;
    if (!names.length) { setSpellHelp({}); return () => { active = false; }; }
    supabase.from("spells_catalog").select("name,source,casting_time,range_text,duration_text,description").in("name", names).then(({ data, error }) => {
      if (!active || error) return;
      const preferred = new Map();
      for (const spell of data || []) {
        const key = norm(spell.name);
        const current = preferred.get(key);
        const nextRank = Number(SPELL_SOURCE_PRIORITY[spell.source] ?? 9);
        const currentRank = Number(SPELL_SOURCE_PRIORITY[current?.source] ?? 9);
        if (!current || nextRank < currentRank) preferred.set(key, spell);
      }
      setSpellHelp(Object.fromEntries(preferred));
    });
    return () => { active = false; };
  }, [names]);
  if (!groups.length) return null;
  return <details className="npc-forge-bg-spells"><summary><strong>Expanded spell list</strong><em>Info</em></summary><div><p>These spells join the class list when a class grants Spellcasting or Pact Magic; they are not automatically known or prepared.</p>{groups.map((group) => <section key={group.level}><strong>{group.label}</strong><div>{group.spells.map((name) => {
    const help = spellHelp[norm(name)];
    return <span className="npc-forge-bg-spell-chip" key={name} tabIndex={help ? 0 : undefined}>{name}{help ? <span role="tooltip"><strong>{help.name}</strong><small>{[help.casting_time && `Casting: ${help.casting_time}`, help.range_text && `Range: ${help.range_text}`, help.duration_text && `Duration: ${help.duration_text}`].filter(Boolean).join(" • ")}</small><p>{formatPlayerFacingText(help.description, "")}</p></span> : null}</span>;
  })}</div></section>)}</div></details>;
}

export default function NpcForgeBackgroundGuide({
  selectedBackground = null,
  backgroundMechanicDetails = null,
  selectedBackgroundFeat = null,
  backgroundFeatOptions = [],
  onSelectBackgroundFeat = null,
  draft = {},
}) {
  const { state: sourceState, toggleChoice, setChoice } = useNpcForgeSourceChoices();
  if (!selectedBackground) return null;
  const selections = sourceState.selections || {};
  const groups = sourceChoiceGroupsForPlacement(sourceState, "background").filter((group) => Number(group.level || 1) <= Number(draft.level || 1));
  const matchesFeat = (group) => {
    const names = new Set([selectedBackgroundFeat?.name, ...backgroundFeatOptions.map((feat) => feat?.name)].map(norm).filter(Boolean));
    return names.has(norm(group.label)) || names.has(norm(group.metadata?.featName));
  };
  const featGroups = groups.filter((group) => matchesFeat(group) && sourceChoiceGroupsHaveChoices([group], selections));
  const claimed = new Set(groups.filter(matchesFeat).map((group) => group.id));
  const languageGroups = groups.filter((group) => !claimed.has(group.id) && sourceChoiceGroupHasKind(group, "language"));
  languageGroups.forEach((group) => claimed.add(group.id));
  const toolGroups = groups.filter((group) => !claimed.has(group.id) && sourceChoiceGroupHasKind(group, "tool"));
  toolGroups.forEach((group) => claimed.add(group.id));
  const runeStyleGroups = groups.filter((group) => !claimed.has(group.id) && group.metadata?.family === "rune-style");
  runeStyleGroups.forEach((group) => claimed.add(group.id));
  const fallbackGroups = groups.filter((group) => !claimed.has(group.id) && sourceChoiceGroupsHaveChoices([group], selections));

  const skillEntries = array(backgroundMechanicDetails?.skills);
  const skillValue = skillEntries.map((entry) => entry.label).filter(Boolean).join(", ") || "Not listed";
  const toolFallback = array(selectedBackground.tools).join(", ") || "Not listed";
  const toolValue = toolGroups.length ? sourceChoiceDisplayValue(toolGroups, selections, toolFallback) : toolFallback;
  const languageValue = languageGroups.length ? sourceChoiceDisplayValue(languageGroups, selections, "Choice required") : array(selectedBackground.languages).join(", ") || "None listed";
  const featValue = selectedBackgroundFeat?.name || backgroundMechanicDetails?.originFeatValue || (backgroundFeatOptions.length > 1 ? "Choice required" : backgroundFeatOptions[0]?.name || "None listed");
  const featNeedsInput = Boolean(backgroundFeatOptions.length > 1 && !selectedBackgroundFeat) || sourceChoiceGroupsNeedInput(featGroups, selections);
  const selectedFeat = selectedBackgroundFeat || (backgroundFeatOptions.length === 1 ? backgroundFeatOptions[0] : null);
  const routeNote = selectedFeat ? backgroundFeatRouteNote(selectedFeat) : "";

  return <div className="npc-forge-background-guide">
    <header className="npc-forge-bg-hero"><div><span>Background</span><h2>{selectedBackground.name}</h2><p>{backgroundStoryDescription(selectedBackground)}</p></div><em>{sourceLabel(selectedBackground.source)}</em></header>

    <section className="npc-forge-bg-section npc-forge-bg-grants"><header><span>Background grants</span><small>At a glance</small></header><div className="npc-forge-bg-grant-grid">
      <GrantCard label="Skills" value={skillValue} badge={skillEntries.some((entry) => entry.routed === "training") ? "Training" : "Granted"}>{skillEntries.length ? <details><summary>What these skills do</summary><div className="npc-forge-bg-info-list">{skillEntries.map((entry, index) => <article key={`${entry.label}-${index}`}><strong>{entry.label}</strong><RuleCopy value={entry.description} /></article>)}</div></details> : null}</GrantCard>
      <GrantCard label="Tools" value={toolValue} badge={sourceChoiceGroupsNeedInput(toolGroups, selections) ? "Choose" : "Granted"} required={sourceChoiceGroupsNeedInput(toolGroups, selections)}>{sourceChoiceGroupsHaveChoices(toolGroups, selections) ? <NpcForgeEmbeddedSourceChoices groups={toolGroups} selections={selections} onToggle={toggleChoice} onSet={setChoice} compact /> : null}{backgroundMechanicDetails?.tools?.length ? <details><summary>What the tool can do</summary><div className="npc-forge-bg-info-list">{backgroundMechanicDetails.tools.map((entry, index) => <article key={`${entry.label}-${index}`}><strong>{entry.label}</strong><RuleCopy value={entry.description} /></article>)}</div></details> : null}</GrantCard>
      {languageGroups.length || languageValue !== "None listed" ? <GrantCard label="Languages" value={languageValue} badge={sourceChoiceGroupsNeedInput(languageGroups, selections) ? "Choose" : "Granted"} required={sourceChoiceGroupsNeedInput(languageGroups, selections)}>{sourceChoiceGroupsHaveChoices(languageGroups, selections) ? <NpcForgeEmbeddedSourceChoices groups={languageGroups} selections={selections} onToggle={toggleChoice} onSet={setChoice} compact /> : null}</GrantCard> : null}
      <GrantCard label="Origin feat" value={featValue} badge={featNeedsInput ? "Choose" : routeNote ? routeNote.includes("Spells") ? "Spells" : routeNote.includes("Training") ? "Training" : "Granted" : "Granted"} required={featNeedsInput}><CompactFeatChooser options={backgroundFeatOptions} selectedFeat={selectedBackgroundFeat} onSelect={onSelectBackgroundFeat} />{featGroups.length ? <NpcForgeEmbeddedSourceChoices groups={featGroups} selections={selections} onToggle={toggleChoice} onSet={setChoice} compact /> : null}{selectedFeat ? <details className="npc-forge-bg-feat-disclosure"><summary>Read {selectedFeat.name}</summary><BackgroundFeatDetail feat={selectedFeat} routeNote={routeNote} /></details> : null}</GrantCard>
    </div></section>

    {runeStyleGroups.length ? <section className="npc-forge-bg-section npc-forge-bg-signature-choice"><header><span>Rune style &amp; medium</span><small>{sourceChoiceGroupsNeedInput(runeStyleGroups, selections) ? "Choose" : selectedLabels(runeStyleGroups, selections).join(", ")}</small></header><p>Choose how this Rune Carver normally inscribes runes. This is a character detail, not a restriction on Rune Shaper magic.</p><NpcForgeEmbeddedSourceChoices groups={runeStyleGroups} selections={selections} onToggle={toggleChoice} onSet={setChoice} compact /></section> : null}

    <BackgroundFeatures background={selectedBackground} features={selectedBackground.features || []} featOptions={backgroundFeatOptions} />
    {fallbackGroups.length ? <section className="npc-forge-bg-section"><header><span>Background choices</span><small>{sourceChoiceGroupsNeedInput(fallbackGroups, selections) ? "Choose" : "Complete"}</small></header><NpcForgeEmbeddedSourceChoices groups={fallbackGroups} selections={selections} onToggle={toggleChoice} onSet={setChoice} /></section> : null}
    <ExpandedSpellList groups={backgroundMechanicDetails?.spellList || []} />
    <div className="npc-forge-bg-footer-note">Background choices belong to the background that grants them. Skill choices routed to Training do not consume the class skill-choice allowance; spell choices routed to Spells are completed there.</div>
  </div>;
}

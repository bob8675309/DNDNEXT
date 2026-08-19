import { useEffect, useMemo, useState } from "react";
import {
  FaAnchor,
  FaBookOpen,
  FaComments,
  FaCompass,
  FaCrown,
  FaCross,
  FaDice,
  FaEye,
  FaFeatherAlt,
  FaFistRaised,
  FaGhost,
  FaHammer,
  FaLeaf,
  FaRunning,
  FaScroll,
  FaShieldAlt,
  FaStar,
  FaTheaterMasks,
  FaTools,
  FaUserSecret,
} from "react-icons/fa";
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

function backgroundStoryParts(background = {}) {
  const story = backgroundStoryDescription(background).trim();
  if (!story) return { headline: "", body: "" };
  const normalized = story.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.{18,180}?[.!?])(?:\s+)([\s\S]+)$/);
  if (!match) return { headline: "", body: story };
  const headline = match[1].trim();
  const body = story.replace(headline, "").trim();
  return { headline, body: body || story };
}

function backgroundIconFor(name = "") {
  const value = norm(name);
  if (/guard|warden|watch|soldier|knight|mercenary|marine/.test(value)) return FaShieldAlt;
  if (/gambler|carouser/.test(value)) return FaDice;
  if (/sailor|ship|seafar|smuggler/.test(value)) return FaAnchor;
  if (/guide|wayfarer|wander|explorer|outlander/.test(value)) return FaCompass;
  if (/artisan|crafter|smith|guild|shipwright/.test(value)) return FaHammer;
  if (/haunted|ruined|reborn|spirit/.test(value)) return FaGhost;
  if (/acolyte|priest|relig|cloister/.test(value)) return FaCross;
  if (/charlatan|criminal|faceless|inquisitor|spy/.test(value)) return FaUserSecret;
  if (/entertainer|gladiator|athlete|perform/.test(value)) return FaTheaterMasks;
  if (/farmer|hermit|nature|folk/.test(value)) return FaLeaf;
  if (/noble|courtier/.test(value)) return FaCrown;
  if (/sage|scribe|student|scholar|investigator|inheritor|mage/.test(value)) return FaBookOpen;
  if (/giant|warrior|fighter/.test(value)) return FaFistRaised;
  return FaScroll;
}

function skillIconFor(label = "") {
  const value = norm(label);
  if (/athletics|acrobatics|stealth|sleight/.test(value)) return FaRunning;
  if (/perception|insight|investigation/.test(value)) return FaEye;
  if (/arcana|history|nature|religion|medicine|survival/.test(value)) return FaBookOpen;
  if (/deception|persuasion|performance|intimidation/.test(value)) return FaComments;
  return FaStar;
}

function firstSentence(value = "") {
  const cleaned = formatPlayerFacingText(value, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const match = cleaned.match(/^(.{12,190}?[.!?])(?:\s|$)/);
  return (match?.[1] || cleaned).trim();
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
  return <section className="npc-forge-bg-section npc-forge-bg-showcase-lower npc-forge-bg-features">
    <header><span>Background features</span><small>{visible.length} source feature{visible.length === 1 ? "" : "s"}</small></header>
    <div>{visible.map((feature, index) => {
      const listItems = sourceListItems(background, feature.name);
      return <details key={`${feature.name}-${index}`}><summary><strong>{feature.name}</strong><em>Open</em></summary><div className="npc-forge-bg-feature-body"><RuleCopy value={backgroundFeatureTextForDisplay(background, feature.description)} />{listItems.length ? <div className="npc-forge-bg-mini-cards">{listItems.map((item) => <article key={item.label}><strong>{item.label}</strong><p>{item.description}</p></article>)}</div> : null}</div></details>;
    })}</div>
  </section>;
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

function BackgroundInteractiveCard({ kind, label, value, badge = "", required = false, children = null, hint = "" }) {
  const Icon = kind === "tools" ? FaTools : kind === "languages" ? FaComments : FaStar;
  if (!children) return <section className={`npc-forge-bg-showcase-card is-${kind}`}><header><span className="npc-forge-bg-showcase-card-icon"><Icon /></span><div><small>{label}</small><strong>{value || "Not listed"}</strong>{hint ? <p>{hint}</p> : null}</div>{badge ? <em>{badge}</em> : null}</header></section>;
  return <details className={`npc-forge-bg-showcase-card is-${kind}${required ? " is-required" : ""}`} defaultOpen={required}><summary><span className="npc-forge-bg-showcase-card-icon"><Icon /></span><div><small>{label}</small><strong>{value || "Not listed"}</strong>{hint ? <p>{hint}</p> : null}</div>{badge ? <em>{badge}</em> : null}</summary><div className="npc-forge-bg-showcase-card-body">{children}</div></details>;
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
  return <details className="npc-forge-bg-spells npc-forge-bg-showcase-lower"><summary><strong>Expanded spell list</strong><em>Info</em></summary><div><p>These spells join the class list when a class grants Spellcasting or Pact Magic; they are not automatically known or prepared.</p>{groups.map((group) => <section key={group.level}><strong>{group.label}</strong><div>{group.spells.map((name) => {
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
  const languageValue = languageGroups.length ? sourceChoiceDisplayValue(languageGroups, selections, "Choice required") : array(selectedBackground.languages).join(", ") || "None";
  const featValue = selectedBackgroundFeat?.name || backgroundMechanicDetails?.originFeatValue || (backgroundFeatOptions.length > 1 ? "Choice required" : backgroundFeatOptions[0]?.name || "None listed");
  const featNeedsInput = Boolean(backgroundFeatOptions.length > 1 && !selectedBackgroundFeat) || sourceChoiceGroupsNeedInput(featGroups, selections);
  const selectedFeat = selectedBackgroundFeat || (backgroundFeatOptions.length === 1 ? backgroundFeatOptions[0] : null);
  const routeNote = selectedFeat ? backgroundFeatRouteNote(selectedFeat) : "";
  const toolNeedsInput = sourceChoiceGroupsNeedInput(toolGroups, selections);
  const languageNeedsInput = sourceChoiceGroupsNeedInput(languageGroups, selections);
  const story = backgroundStoryParts(selectedBackground);
  const HeroIcon = backgroundIconFor(selectedBackground.name);
  const featSummary = selectedFeat ? firstSentence(selectedFeat.description) : "";
  const toolSummary = toolNeedsInput
    ? "Choose the tool proficiency granted by this background."
    : firstSentence(backgroundMechanicDetails?.tools?.[0]?.description || "");
  const languageSummary = languageNeedsInput
    ? "Choose the language granted by this background."
    : languageValue === "None" ? "No additional language is granted here." : "";

  return <div className="npc-forge-background-guide is-showcase-one">
    <header className="npc-forge-bg-showcase-hero">
      <div className="npc-forge-bg-showcase-crest"><HeroIcon /></div>
      <div className="npc-forge-bg-showcase-hero-copy"><span>Background</span><h2>{selectedBackground.name}</h2>{story.headline ? <p>{story.headline}</p> : null}</div>
      <em>{sourceLabel(selectedBackground.source)}</em>
      <div className="npc-forge-bg-showcase-watermark" aria-hidden="true"><HeroIcon /></div>
    </header>

    <section className="npc-forge-bg-showcase-story">
      <span className="npc-forge-bg-showcase-story-icon"><FaFeatherAlt /></span>
      <div><strong>Before adventuring</strong>{(story.body || backgroundStoryDescription(selectedBackground)).split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    </section>

    <div className="npc-forge-bg-showcase-grants">
      <section className="npc-forge-bg-showcase-skills">
        <header><span><FaStar /> Skills</span><em>{skillEntries.some((entry) => entry.routed === "training") ? "Training" : "Granted"}</em></header>
        <div>{skillEntries.length ? skillEntries.map((entry, index) => {
          const Icon = skillIconFor(entry.label);
          return <article key={`${entry.label}-${index}`}><span className="npc-forge-bg-showcase-skill-icon"><Icon /></span><div><strong>{entry.label}</strong><RuleCopy value={entry.description} /></div></article>;
        }) : <p className="npc-forge-bg-showcase-empty">{skillValue}</p>}</div>
      </section>

      <div className="npc-forge-bg-showcase-side">
        <BackgroundInteractiveCard
          kind="tools"
          label="Tools"
          value={toolValue}
          badge={toolNeedsInput ? "Choose" : backgroundMechanicDetails?.tools?.length ? "Info" : "Granted"}
          required={toolNeedsInput}
          hint={toolSummary}
        >
          {sourceChoiceGroupsHaveChoices(toolGroups, selections) ? <NpcForgeEmbeddedSourceChoices groups={toolGroups} selections={selections} onToggle={toggleChoice} onSet={setChoice} compact /> : null}
          {backgroundMechanicDetails?.tools?.length ? <div className="npc-forge-bg-info-list">{backgroundMechanicDetails.tools.map((entry, index) => <article key={`${entry.label}-${index}`}><strong>{entry.label}</strong><RuleCopy value={entry.description} /></article>)}</div> : null}
        </BackgroundInteractiveCard>

        <BackgroundInteractiveCard
          kind="languages"
          label="Languages"
          value={languageValue}
          badge={languageNeedsInput ? "Choose" : languageGroups.length || languageValue !== "None" ? "Granted" : ""}
          required={languageNeedsInput}
          hint={languageSummary}
        >
          {sourceChoiceGroupsHaveChoices(languageGroups, selections) ? <NpcForgeEmbeddedSourceChoices groups={languageGroups} selections={selections} onToggle={toggleChoice} onSet={setChoice} compact /> : null}
        </BackgroundInteractiveCard>

        <BackgroundInteractiveCard
          kind="feat"
          label="Origin feat"
          value={featValue}
          badge={featNeedsInput ? "Choose" : routeNote.includes("Spells") ? "Spells" : routeNote.includes("Training") ? "Training" : "Info"}
          required={featNeedsInput}
          hint={featSummary}
        >
          <CompactFeatChooser options={backgroundFeatOptions} selectedFeat={selectedBackgroundFeat} onSelect={onSelectBackgroundFeat} />
          {featGroups.length ? <NpcForgeEmbeddedSourceChoices groups={featGroups} selections={selections} onToggle={toggleChoice} onSet={setChoice} compact /> : null}
          {selectedFeat ? <BackgroundFeatDetail feat={selectedFeat} routeNote={routeNote} /> : null}
        </BackgroundInteractiveCard>
      </div>
    </div>

    {runeStyleGroups.length ? <section className="npc-forge-bg-section npc-forge-bg-showcase-lower npc-forge-bg-signature-choice"><header><span>Rune style &amp; medium</span><small>{sourceChoiceGroupsNeedInput(runeStyleGroups, selections) ? "Choose" : selectedLabels(runeStyleGroups, selections).join(", ")}</small></header><p>Choose how this Rune Carver normally inscribes runes. This is a character detail, not a restriction on Rune Shaper magic.</p><NpcForgeEmbeddedSourceChoices groups={runeStyleGroups} selections={selections} onToggle={toggleChoice} onSet={setChoice} compact /></section> : null}

    <BackgroundFeatures background={selectedBackground} features={selectedBackground.features || []} featOptions={backgroundFeatOptions} />
    {fallbackGroups.length ? <section className="npc-forge-bg-section npc-forge-bg-showcase-lower"><header><span>Background choices</span><small>{sourceChoiceGroupsNeedInput(fallbackGroups, selections) ? "Choose" : "Complete"}</small></header><NpcForgeEmbeddedSourceChoices groups={fallbackGroups} selections={selections} onToggle={toggleChoice} onSet={setChoice} /></section> : null}
    <ExpandedSpellList groups={backgroundMechanicDetails?.spellList || []} />
    <div className="npc-forge-bg-footer-note npc-forge-bg-showcase-note"><FaBookOpen /><span>Use this history to choose former allies, obligations, rivals, and unfinished business that can matter during play. Background-granted tool and language choices stay with the background that grants them; feat-owned skill or spell choices are completed on the Training or Spells step.</span></div>

    <style jsx global>{`
      .unified-player-character-forge .npc-forge-background-guide.is-showcase-one{display:grid!important;gap:10px!important;width:100%!important;min-width:0!important;padding:8px 10px 16px!important;color:#fff}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-hero{position:relative;isolation:isolate;display:grid;grid-template-columns:72px minmax(0,1fr) auto;align-items:center;gap:14px;min-height:112px;padding:14px 16px;overflow:hidden;border:1px solid rgba(160,111,229,.32);border-radius:11px;background:radial-gradient(circle at 76% 28%,rgba(41,94,130,.19),transparent 36%),linear-gradient(105deg,rgba(68,36,110,.28),rgba(12,18,31,.9) 46%,rgba(8,17,27,.98));box-shadow:inset 0 1px rgba(255,255,255,.035)}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-crest{position:relative;z-index:2;display:grid;place-items:center;width:64px;height:72px;border:1px solid rgba(211,170,89,.44);border-radius:18px 18px 24px 24px;color:#e2c578;background:linear-gradient(160deg,rgba(118,61,175,.38),rgba(34,27,51,.84));box-shadow:0 7px 20px rgba(0,0,0,.28),inset 0 0 18px rgba(143,91,210,.16);font-size:1.65rem}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-hero-copy{position:relative;z-index:2;display:grid;gap:4px;min-width:0}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-hero-copy>span{color:#cdb5f5;font-size:.56rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-hero-copy h2{margin:0;color:#fff4df;font-family:Georgia,"Times New Roman",serif;font-size:1.48rem;line-height:1.05}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-hero-copy p{max-width:72ch;margin:2px 0 0;color:rgba(255,255,255,.78);font-size:.73rem;line-height:1.5}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-hero>em{position:relative;z-index:2;align-self:start;padding:6px 10px;border:1px solid rgba(68,209,199,.44);border-radius:999px;color:#bffff6;background:rgba(14,78,83,.22);font-size:.55rem;font-style:normal;font-weight:800;text-align:center}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-watermark{position:absolute;z-index:1;right:28px;bottom:-30px;color:rgba(129,100,190,.13);font-size:9rem;transform:rotate(-6deg);pointer-events:none}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-story{display:grid;grid-template-columns:44px minmax(0,1fr);gap:11px;align-items:start;padding:11px 14px;border:1px solid rgba(168,108,255,.28);border-left:3px solid #a86cff;border-radius:9px;background:linear-gradient(90deg,rgba(72,36,99,.23),rgba(15,21,32,.85))}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-story-icon{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(168,108,255,.32);border-radius:50%;color:#d4b8ff;background:rgba(126,72,199,.12)}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-story>div{display:grid;gap:5px;min-width:0}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-story strong{color:#d8b8ff;font-size:.57rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-story p{max-width:100ch;margin:0;color:rgba(255,255,255,.84);font-size:.72rem;line-height:1.58}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-grants{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(260px,.92fr);gap:9px;align-items:stretch}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills,.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card{min-width:0;border:1px solid rgba(192,155,94,.22);border-radius:9px;background:linear-gradient(135deg,rgba(17,27,43,.96),rgba(11,17,29,.92));box-shadow:inset 0 1px rgba(255,255,255,.025)}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills{padding:10px 12px}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills>header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.06)}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills>header>span{display:flex;align-items:center;gap:6px;color:#d9bd7a;font-size:.6rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills>header>em,.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card summary>em,.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card>header>em{padding:3px 6px;border:1px solid rgba(168,108,255,.34);border-radius:999px;color:#e5d6ff;background:rgba(126,72,199,.11);font-size:.5rem;font-style:normal;font-weight:800;text-transform:uppercase}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;margin-top:4px}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills article{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;min-width:0;padding:10px 9px}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills article+article{border-left:1px solid rgba(255,255,255,.07)}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skill-icon{display:grid;place-items:center;width:31px;height:31px;border:1px solid rgba(168,108,255,.34);border-radius:50%;color:#cfacff;background:rgba(126,72,199,.12)}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills article strong{color:#fff;font-size:.68rem}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills .npc-forge-bg-rule-copy{gap:2px!important;margin-top:3px}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills .npc-forge-bg-rule-copy p{color:rgba(255,255,255,.72)!important;font-size:.61rem!important;line-height:1.45!important}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-side{display:grid;grid-template-rows:repeat(3,minmax(0,auto));gap:7px}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card{overflow:hidden}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card.is-tools{border-color:rgba(193,155,88,.24)}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card.is-languages{border-color:rgba(88,214,199,.24)}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card.is-feat{border-color:rgba(168,108,255,.27)}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card.is-required{box-shadow:inset 3px 0 #a86cff}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card>header,.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card>summary{display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:58px;padding:8px 10px;list-style:none;cursor:pointer}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card>header{cursor:default}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card summary::-webkit-details-marker{display:none}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card-icon{display:grid;place-items:center;width:31px;height:31px;border:1px solid rgba(200,168,101,.26);border-radius:50%;color:#dfc27b;background:rgba(93,75,40,.13)}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card.is-languages .npc-forge-bg-showcase-card-icon{color:#75e0d3;border-color:rgba(88,214,199,.3);background:rgba(42,136,124,.11)}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card.is-feat .npc-forge-bg-showcase-card-icon{color:#d2b5ff;border-color:rgba(168,108,255,.32);background:rgba(126,72,199,.1)}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card summary>div,.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card>header>div{display:grid;gap:2px;min-width:0}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card small{color:rgba(255,255,255,.48);font-size:.5rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card summary strong,.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card>header strong{color:#fff;font-size:.68rem;line-height:1.3}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card summary p,.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card>header p{max-width:58ch;margin:0;color:rgba(255,255,255,.61);font-size:.56rem;line-height:1.35}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-card-body{display:grid;gap:8px;padding:9px 10px 10px;border-top:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.13)}.unified-player-character-forge .is-showcase-one .npc-forge-bg-info-list{margin-top:0}
      .unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-lower,.unified-player-character-forge .is-showcase-one .npc-forge-bg-spells{margin:0;padding:9px 11px;border:1px solid rgba(168,108,255,.19);border-radius:9px;background:rgba(12,17,27,.82)}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-lower>header,.unified-player-character-forge .is-showcase-one .npc-forge-bg-spells>summary{display:flex;align-items:center;justify-content:space-between;gap:10px}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-note{display:grid!important;grid-template-columns:32px minmax(0,1fr);gap:9px;align-items:center;padding:9px 11px!important;border-left:3px solid #58d6c7!important;border-radius:8px;color:rgba(255,255,255,.76)!important;background:linear-gradient(90deg,rgba(25,103,99,.19),rgba(10,23,29,.78))!important;font-size:.6rem!important;line-height:1.45!important}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-note>svg{justify-self:center;color:#71dfd3;font-size:1rem}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-section-heading{display:none!important}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-workspace{padding:10px!important;background:linear-gradient(180deg,rgba(73,39,108,.1),transparent 32%),rgba(7,10,18,.93)}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog{display:grid;gap:7px;padding:9px;border:1px solid rgba(168,108,255,.2);border-radius:10px;background:linear-gradient(180deg,rgba(52,31,76,.32),rgba(10,14,23,.84))}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-head{display:flex;align-items:center;justify-content:space-between;min-height:24px;padding:0 2px}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-head span{color:#d8bc88;font-family:Georgia,"Times New Roman",serif;font-size:.76rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-head strong{display:grid;place-items:center;min-width:24px;height:20px;padding:0 6px;border-radius:999px;color:#cafff8;background:rgba(47,132,124,.21);font-size:.58rem}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-search{min-height:35px;padding:7px 10px!important;border-color:rgba(255,255,255,.1)!important;border-radius:7px!important;background:#080c15!important}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list{display:grid;gap:4px}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button{display:grid!important;grid-template-columns:31px minmax(0,1fr)!important;align-items:center!important;gap:8px!important;min-height:45px!important;padding:5px 8px!important;border:1px solid rgba(255,255,255,.075)!important;border-radius:7px!important;color:#fff!important;background:linear-gradient(90deg,rgba(19,25,39,.96),rgba(13,18,29,.92))!important;text-align:left!important}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button::before{content:"✦";display:grid;place-items:center;width:27px;height:31px;border:1px solid rgba(197,158,91,.24);border-radius:7px;color:#d2b271;background:rgba(80,62,37,.15);font-size:.62rem}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button>span{display:grid!important;gap:1px!important;min-width:0}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button strong{color:#fff!important;font-size:.65rem!important}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button small{justify-self:start;padding:1px 5px;border-radius:999px;color:rgba(255,255,255,.63)!important;background:rgba(255,255,255,.045);font-size:.48rem!important}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button:hover{border-color:rgba(168,108,255,.36)!important;background:linear-gradient(90deg,rgba(48,34,68,.88),rgba(17,24,38,.95))!important}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.is-active{border-color:#a86cff!important;background:linear-gradient(90deg,rgba(91,47,129,.52),rgba(31,26,55,.94))!important;box-shadow:inset 3px 0 #a86cff,0 0 0 1px rgba(168,108,255,.08)!important}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.is-active::before{border-color:rgba(214,177,96,.52);color:#f3d68b;background:linear-gradient(160deg,rgba(111,63,159,.42),rgba(76,57,34,.25))}.unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-workspace-note{margin-top:8px!important;padding:8px 10px!important;border-left-color:#a86cff!important;color:rgba(255,255,255,.68)!important;background:rgba(51,35,76,.22)!important;font-size:.58rem!important;line-height:1.45!important}
      @media(max-width:980px){.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-grants{grid-template-columns:1fr}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills>div{grid-template-columns:1fr}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-skills article+article{border-left:0;border-top:1px solid rgba(255,255,255,.07)}}
      @media(max-width:680px){.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-hero{grid-template-columns:54px minmax(0,1fr);padding:12px}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-crest{width:50px;height:56px;font-size:1.2rem}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-hero>em{grid-column:1/-1;justify-self:start}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-watermark{font-size:6rem}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-story{grid-template-columns:34px minmax(0,1fr);padding:9px}.unified-player-character-forge .is-showcase-one .npc-forge-bg-showcase-story-icon{width:30px;height:30px}}
    `}</style>
  </div>;
}

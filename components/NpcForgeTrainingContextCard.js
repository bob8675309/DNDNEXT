import { useEffect } from "react";
import {
  FaBookOpen,
  FaEye,
  FaLeaf,
  FaMagic,
  FaPlusCircle,
  FaSearch,
} from "react-icons/fa";
import { ABILITY_LABELS } from "../utils/characterCreation";
import { formatPrerequisiteText } from "../utils/formatPrerequisiteText";
import { featRuleSectionsFromDescription } from "../utils/featRulePresentation";
import NpcForgeSourceChoiceFields from "./NpcForgeSourceChoiceFields";
import { sourceChoiceGroupsForResolverPlacement, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import { useNpcForgeControllerContext } from "./NpcForgeControllerContext";

const TRAINING_ASSET_ROOT = "/ui/forge/training";
const normalized = (value) => String(value ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const SKILL_ICONS = Object.freeze({
  arcana: FaMagic,
  history: FaBookOpen,
  investigation: FaSearch,
  perception: FaEye,
  medicine: FaPlusCircle,
  nature: FaLeaf,
});

const SKILL_USES = Object.freeze({
  acrobatics: ["Keep your balance on unstable or narrow footing", "Escape or maneuver through physically awkward positions", "Perform controlled tumbling or agile movement"],
  animalHandling: ["Calm or control a domesticated animal", "Read an animal's behavior or emotional state", "Guide a mount through a difficult situation"],
  arcana: ["Identify magical effects, items, and phenomena", "Recall lore about spells, magic items, and mystical creatures", "Understand magical runes, symbols, and arcane writings", "Recognize dangerous or unusual magical workings"],
  athletics: ["Climb, jump, swim, or force movement with raw physical power", "Break, lift, push, pull, or hold heavy objects", "Overcome strenuous physical obstacles"],
  deception: ["Conceal the truth or maintain a convincing lie", "Disguise motives and misdirect suspicion", "Pass false information convincingly"],
  history: ["Recall historical events, cultures, wars, and rulers", "Recognize important names, places, relics, and traditions", "Connect present circumstances to recorded history"],
  insight: ["Read body language, tone, and intent", "Judge whether someone appears sincere or evasive", "Infer motives, fears, or emotional pressure"],
  intimidation: ["Pressure someone through threats or force of personality", "Use a frightening display to influence behavior", "Establish dominance in a tense exchange"],
  investigation: ["Find clues by examining a scene or object closely", "Deduce how a mechanism, puzzle, or sequence of events works", "Connect details that reveal hidden information"],
  medicine: ["Recognize wounds, illness, or signs of death", "Stabilize or assess an injured creature", "Apply practical medical knowledge during treatment"],
  nature: ["Recall lore about terrain, plants, animals, and natural cycles", "Identify natural hazards or unusual environmental signs", "Recognize beasts, plants, and wilderness phenomena"],
  perception: ["Notice hidden, distant, or subtle sights and sounds", "Spot approaching danger or unusual movement", "Detect details that are easy to overlook"],
  performance: ["Entertain an audience through music, acting, dance, or oratory", "Hold attention with a practiced public performance", "Judge how well a performance is landing with an audience"],
  persuasion: ["Influence someone through reason, tact, or good faith", "Negotiate an agreement or request cooperation", "Present an argument in a socially effective way"],
  religion: ["Recall lore about gods, rites, holy symbols, and religious traditions", "Recognize religious practices, cults, and sacred institutions", "Interpret theological or ritual significance"],
  sleightOfHand: ["Hide, palm, plant, or manipulate a small object unnoticed", "Perform delicate manual tricks under observation", "Handle an object discreetly without drawing attention"],
  stealth: ["Move quietly and avoid being noticed", "Hide from observers or remain concealed", "Approach or withdraw without revealing your position"],
  survival: ["Track creatures and follow signs through the wilderness", "Navigate natural terrain and recognize environmental hazards", "Find practical signs of shelter, routes, or changing conditions"],
});

const PROFESSION_USES = Object.freeze({
  alchemy: ["Brew campaign alchemical recipes when you know the recipe and have the required equipment", "Identify and process ingredients used by alchemical formulas", "Use Alchemy as the campaign crafting proficiency; an ordinary copy of Alchemist's Supplies does not grant the Trade Skill or Expertise"],
  smithing: ["Forge and repair mundane metal weapons and armor with the required equipment", "Work metals and smithing materials during campaign crafting", "Use Smithing as the campaign crafting proficiency; an ordinary copy of Smith's Tools does not grant the Trade Skill or Expertise"],
  scribe: ["Prepare written magical or technical works supported by campaign recipes and required equipment", "Produce precise inscriptions, diagrams, and formal records", "Use Scribe as the campaign crafting proficiency; an ordinary copy of Calligrapher's Supplies does not grant the Trade Skill or Expertise"],
  enchanting: ["Apply supported magical imbuements to eligible equipment at an appropriate crafting site", "Work with magical components during campaign enchanting", "Use Enchanting as the campaign crafting proficiency; an ordinary copy of Enchanter's Tools does not grant the Trade Skill or Expertise"],
  cooking: ["Prepare meals, rations, and other food with appropriate cooking equipment", "Judge ingredients, spoilage, seasoning, and food preparation", "Use Cooking as the campaign proficiency when future dedicated cooking recipes call for it"],
  tinkering: ["Build, repair, or diagnose small mechanisms with appropriate equipment", "Work precisely on compact mechanical assemblies", "Use Tinkering as the campaign proficiency when future dedicated tinkering recipes call for it"],
  jewelcraft: ["Appraise, cut, set, repair, or fashion gems and fine decorative work with appropriate equipment", "Perform precision work with valuable small materials", "Use Jewelcraft as the campaign proficiency when future dedicated jewelcraft recipes call for it"],
  brewing: ["Prepare and evaluate brewed drinks and fermentation processes with appropriate equipment", "Control ingredients, sanitation, and flavor", "Use Brewing as the campaign proficiency when future dedicated brewing recipes call for it"],
});

const PROFESSION_ICON = Object.freeze({
  alchemy: `${TRAINING_ASSET_ROOT}/profession-alchemy.svg`,
  smithing: `${TRAINING_ASSET_ROOT}/profession-smithing.svg`,
  scribe: `${TRAINING_ASSET_ROOT}/profession-scribe.svg`,
  enchanting: `${TRAINING_ASSET_ROOT}/profession-enchanting.svg`,
});

function SkillIcon({ skillKey }) {
  const Icon = SKILL_ICONS[skillKey] || FaBookOpen;
  return <Icon aria-hidden="true" focusable="false" />;
}

function featGroupMatches(group = {}, feat = {}, featInstanceId = "") {
  if (String(group?.ownerType || "") !== "feat") return false;
  const groupInstanceId = String(group?.metadata?.featInstanceId || group?.ownerKey || "");
  if (featInstanceId && groupInstanceId === String(featInstanceId)) return true;
  const featId = String(feat?.id || "");
  const groupFeatId = String(group?.metadata?.featOptionId || "");
  if (featId && groupFeatId && featId === groupFeatId) return true;
  const featName = normalized(feat?.name);
  const groupName = normalized(group?.metadata?.featName || group?.label);
  const featSource = String(feat?.source || "");
  const groupSource = String(group?.metadata?.featSource || group?.source || "");
  return Boolean(featName && groupName === featName && (!featSource || !groupSource || featSource === groupSource));
}

function genericFeatRuleSections(feat = {}) {
  return featRuleSectionsFromDescription(feat.description || "");
}

function sourceOptionPrerequisite(option = {}, selectedClass = null) {
  const direct = option.metadata?.prerequisiteText || option.prerequisite || option.requires || "";
  if (direct) return formatPrerequisiteText(direct);
  const prerequisites = option.metadata?.prerequisites || {};
  if (!prerequisites || typeof prerequisites !== "object") return "";
  const parts = [];
  if (Number(prerequisites.minClassLevel || 0) > 0) parts.push(`${selectedClass?.class_name || selectedClass?.name || "Class"} level ${Number(prerequisites.minClassLevel)}+`);
  if (Array.isArray(prerequisites.requiresOptions) && prerequisites.requiresOptions.length) parts.push(`Requires ${prerequisites.requiresOptions.join(", ")}`);
  return parts.join(" • ");
}

function sourceOptionMeta(option = {}, field = {}, group = {}) {
  const facts = [];
  facts.push({ label: "Source", value: option.source || group.source || "Campaign" });
  if (group.level) facts.push({ label: "Gained At", value: `Level ${group.level}` });
  if (field.replacementCadence) facts.push({ label: "May Replace", value: String(field.replacementCadence).replace(/-/g, " ") });
  if (field.kind) facts.push({ label: "Choice Type", value: String(field.kind).replace(/-/g, " ") });
  return facts;
}

function featRuleSections(feat = {}, matchingGroups = []) {
  const crafterCampaignRule = normalized(feat.name) === "crafter"
    && matchingGroups.some((group) => group.metadata?.campaignRule === "crafter-profession-skills");
  if (!crafterCampaignRule) return genericFeatRuleSections(feat);

  return [
    {
      title: "Profession Training",
      body: "DnDNext replaces Crafter's three raw Artisan's Tool proficiency picks with three additional Profession Skills. Choose any three of Alchemy, Smithing, Scribe, Enchanting, Cooking, Tinkering, Jewelcraft, or Brewing in Skills → Trade Skills. Each available profession is labeled as granted by Crafter, and these feat-granted choices do not spend your class Skill / Trade Skill allowance.",
    },
    {
      title: "Discount",
      body: "The feat's source rule is unchanged: whenever you buy a nonmagical item, you receive a 20 percent discount on it.",
    },
    {
      title: "Fast Crafting",
      body: "The feat's Fast Crafting feature remains otherwise unchanged. Its temporary-gear list, Long Rest timing, and normal crafting requirements still follow the source rule; only the three proficiency selections are replaced by Profession Skills in this campaign.",
    },
  ];
}

function FeatRuleList({ feat = {}, matchingGroups = [] }) {
  return <div className="npc-forge-training-feat-rule-list">{featRuleSections(feat, matchingGroups).map((section, index) => section.intro
    ? <p key={`intro-${index}`} className="npc-forge-training-feat-rule-intro">{section.body}</p>
    : <article key={`${section.title || "rule"}-${index}`}>{section.title ? <strong>{section.title}</strong> : null}<p>{section.body}</p></article>)}</div>;
}

function ContextShell({ icon, iconIsImage = false, title, badge, selected, description, actionLabel = "", onAction = null, actionDisabled = false, children }) {
  return <div className="npc-forge-training-context-dossier">
    <h3>Current Selection</h3>
    <div className="npc-forge-training-context-hero">
      <span className="npc-forge-training-context-icon">{iconIsImage ? <img src={icon} alt="" aria-hidden="true" /> : icon}</span>
      <div className="npc-forge-training-context-copy"><div><h2>{title}</h2>{badge ? <em>{badge}</em> : null}</div><p>{description}</p></div>
      {onAction ? <button type="button" className={`npc-forge-training-context-action ${selected ? "is-selected" : ""}`} aria-pressed={selected} disabled={actionDisabled} onClick={onAction}>{actionLabel || (selected ? "Selected" : "Select")}</button> : <strong className={selected ? "is-selected" : ""}>{selected ? "Selected" : "Available"}</strong>}
    </div>
    <div className="npc-forge-training-context-divider" />
    {children}
    <div className="npc-forge-training-context-note"><span>ⓘ</span><p>You can change your selections until you continue.<br />All choices can be reviewed on the final step.</p></div>
    <style jsx global>{`
      .npc-forge-training-context-dossier{display:flex;flex-direction:column;min-height:100%;padding:4px 2px 2px}.npc-forge-training-context-dossier>h3{margin:0 0 18px;color:#fff;font-size:1rem}.npc-forge-training-context-hero{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:14px;align-items:center}.npc-forge-training-context-icon{display:grid;place-items:center;width:48px;height:48px;border:1px solid rgba(168,108,255,.2);border-radius:9px;color:#bd85ff;background:rgba(126,72,199,.08);font-size:1.65rem}.npc-forge-training-context-icon img{width:34px;height:34px;object-fit:contain}.npc-forge-training-context-copy{display:grid;gap:5px;min-width:0}.npc-forge-training-context-copy>div{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.npc-forge-training-context-copy h2{margin:0;color:#fff;font-size:1.22rem;line-height:1.1}.npc-forge-training-context-copy em{padding:4px 8px;border-radius:999px;color:#d9bfff;background:rgba(126,72,199,.15);font-size:.61rem;font-style:normal}.npc-forge-training-context-copy p{margin:0;color:rgba(255,255,255,.7);font-size:.72rem;line-height:1.55}.npc-forge-training-context-hero>strong,.npc-forge-training-context-action{align-self:start;margin-top:4px;padding:4px 10px;border:1px solid transparent;border-radius:999px;color:rgba(255,255,255,.56);background:rgba(255,255,255,.05);font-size:.62rem}.npc-forge-training-context-hero>strong.is-selected,.npc-forge-training-context-action.is-selected{color:#83f4df;background:rgba(19,164,139,.16)}.npc-forge-training-context-action{border-color:rgba(168,108,255,.38);color:#f0e6ff;background:rgba(126,72,199,.12);cursor:pointer}.npc-forge-training-context-action:hover:not(:disabled),.npc-forge-training-context-action:focus-visible{border-color:rgba(193,145,255,.78);background:rgba(126,72,199,.24);outline:none}.npc-forge-training-context-action:disabled{cursor:default;opacity:1}.npc-forge-training-context-divider{height:1px;margin:18px 0;background:rgba(255,255,255,.09)}.npc-forge-training-context-section{display:grid;gap:12px}.npc-forge-training-context-section+ .npc-forge-training-context-section{margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)}.npc-forge-training-context-section>h4{margin:0;color:#fff;font-size:.76rem}.npc-forge-training-class-option-copy{padding:2px 0 8px}.npc-forge-training-class-option-copy p{margin:0;color:rgba(255,255,255,.79);font-size:.72rem;line-height:1.64;white-space:pre-line}.npc-forge-training-context-section ul{display:grid;gap:9px;margin:0;padding-left:20px;color:rgba(255,255,255,.7);font-size:.7rem;line-height:1.5}.npc-forge-training-context-section>p{margin:0;color:rgba(255,255,255,.72);font-size:.72rem;line-height:1.65;white-space:pre-line}.npc-forge-training-feat-rule-list{display:grid;gap:0}.npc-forge-training-feat-rule-intro{margin:0;padding:2px 0 10px;color:rgba(255,255,255,.74);font-size:.69rem;line-height:1.62}.npc-forge-training-feat-rule-list article{position:relative;display:grid;gap:4px;padding:9px 4px 9px 13px;border:0;border-left:2px solid rgba(168,108,255,.38);border-radius:0;background:transparent}.npc-forge-training-feat-rule-list article+article{border-top:1px solid rgba(255,255,255,.055)}.npc-forge-training-feat-rule-list article>strong{color:#e5d2ff;font-size:.68rem;letter-spacing:.01em}.npc-forge-training-feat-rule-list article>p{margin:0;color:rgba(255,255,255,.76);font-size:.69rem;line-height:1.62}.npc-forge-training-context-facts{display:flex;flex-wrap:wrap;gap:0;margin-top:2px;border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07)}.npc-forge-training-context-facts>span{display:grid;gap:2px;min-width:140px;padding:8px 12px 8px 0}.npc-forge-training-context-facts>span+span{padding-left:12px;border-left:1px solid rgba(255,255,255,.07)}.npc-forge-training-context-facts small{color:rgba(255,255,255,.43);font-size:.52rem;text-transform:uppercase}.npc-forge-training-context-facts b{color:#fff;font-size:.67rem}.npc-forge-training-context-choices{gap:9px!important}.npc-forge-training-context-choices>p{max-width:720px}.npc-forge-training-context-choices .npc-forge-source-choices{gap:8px;margin-top:0}.npc-forge-training-context-choices .npc-forge-source-choices__heading{display:none}.npc-forge-training-context-choices .npc-forge-source-choice-group{gap:8px;padding:10px 11px}.npc-forge-training-context-choices .npc-forge-source-choice-group>header small{font-size:.58rem}.npc-forge-training-context-choices .npc-forge-source-choice-slots{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}.npc-forge-training-context-route{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:start;padding:8px 2px 8px 10px;border:0;border-left:2px solid rgba(168,108,255,.42);border-radius:0;background:transparent}.npc-forge-training-context-route>span{display:grid;place-items:center;width:20px;height:20px;color:#d8c2fb;background:transparent;font-size:.7rem}.npc-forge-training-context-route>div{display:grid;gap:3px}.npc-forge-training-context-route strong{color:#fff;font-size:.68rem}.npc-forge-training-context-route p{margin:0;color:rgba(255,255,255,.65);font-size:.62rem;line-height:1.5}.npc-forge-training-context-route b{color:#e7d7ff}.npc-forge-training-context-note{display:flex;gap:10px;align-items:flex-start;width:min(560px,100%);margin-top:28px;padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(7,10,18,.32)}.npc-forge-training-context-note>span{color:#d4dcff;font-size:.8rem}.npc-forge-training-context-note p{margin:0;color:rgba(255,255,255,.64);font-size:.68rem;line-height:1.55}@media(max-width:720px){.npc-forge-training-context-hero{grid-template-columns:42px minmax(0,1fr)}.npc-forge-training-context-hero>strong{grid-column:2;justify-self:start;margin:0}.npc-forge-training-context-icon{width:42px;height:42px}.npc-forge-training-context-note{margin-top:24px}.npc-forge-training-context-choices .npc-forge-source-choice-slots{grid-template-columns:1fr}}
    `}</style>
  </div>;
}

export default function NpcForgeTrainingContextCard({ detail = null, selectedSkill = null, selectedProfession = null, selectedClass = null, draft = {} }) {
  const { state: sourceChoiceState, toggleChoice: toggleSourceChoice, setChoice: setSourceChoice } = useNpcForgeSourceChoices();
  const controller = useNpcForgeControllerContext() || {};

  useEffect(() => {
    if (typeof document === "undefined") return;
    const panel = document.querySelector(".npc-forge-step-training .npc-forge-context-panel");
    const dossier = panel?.querySelector(".npc-forge-training-context-dossier");
    dossier?.scrollTo?.({ top: 0, behavior: "auto" });
  }, [detail?.type, detail?.key, detail?.groupId, detail?.fieldId, detail?.optionKey, detail?.option?.id]);

  if (detail?.type === "trainingOverview") {
    const metrics = Array.isArray(detail.metrics) ? detail.metrics : [];
    const sources = Array.isArray(detail.sources) ? detail.sources : [];
    return <div className="npc-forge-training-context-dossier npc-forge-training-overview">
      <h3>Current Selection</h3>
      <div className="npc-forge-training-overview__head">
        <span className="npc-forge-training-context-icon"><img src={detail.icon || `${TRAINING_ASSET_ROOT}/summary-training.svg`} alt="" aria-hidden="true" /></span>
        <div><span>Training section</span><h2>{detail.title || "Training"}</h2><p>{detail.description || "Review where these choices come from and how many remain."}</p></div>
      </div>
      <div className="npc-forge-training-context-divider" />
      <section className="npc-forge-training-overview__metrics" aria-label="Training choice breakdown">
        {metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong>{metric.detail ? <small>{metric.detail}</small> : null}</div>)}
      </section>
      {sources.length ? <section className="npc-forge-training-overview__sources"><h4>Where these come from</h4>{sources.map((source, index) => <div key={`${source.label}-${index}`}><span><strong>{source.label}</strong>{source.detail ? <small>{source.detail}</small> : null}</span><b>{source.value}</b></div>)}</section> : null}
      <div className="npc-forge-training-context-note"><span>ⓘ</span><p>Click a specific choice on the left to inspect it here. Moving the mouse over another row will no longer replace what you were reading.</p></div>
      <style jsx global>{`
        .npc-forge-training-overview__head{display:grid;grid-template-columns:48px minmax(0,1fr);gap:14px;align-items:center}.npc-forge-training-overview__head>div{display:grid;gap:3px}.npc-forge-training-overview__head>div>span{color:#bc91ff;font-size:.54rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.npc-forge-training-overview__head h2{margin:0;color:#fff;font-size:1.18rem}.npc-forge-training-overview__head p{margin:0;max-width:70ch;color:rgba(255,255,255,.67);font-size:.7rem;line-height:1.55}.npc-forge-training-overview__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:0;border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07)}.npc-forge-training-overview__metrics>div{display:grid;gap:2px;padding:10px 12px}.npc-forge-training-overview__metrics>div+div{border-left:1px solid rgba(255,255,255,.07)}.npc-forge-training-overview__metrics span,.npc-forge-training-overview__sources h4{color:rgba(255,255,255,.47);font-size:.52rem;font-weight:800;letter-spacing:.055em;text-transform:uppercase}.npc-forge-training-overview__metrics strong{color:#f3eaff;font-size:.85rem}.npc-forge-training-overview__metrics small{color:rgba(255,255,255,.5);font-size:.52rem;line-height:1.4}.npc-forge-training-overview__sources{display:grid;gap:0;margin-top:18px}.npc-forge-training-overview__sources h4{margin:0 0 5px}.npc-forge-training-overview__sources>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 2px;border-top:1px solid rgba(255,255,255,.065)}.npc-forge-training-overview__sources>div>span{display:grid;gap:2px}.npc-forge-training-overview__sources strong{color:#fff;font-size:.7rem}.npc-forge-training-overview__sources small{color:rgba(255,255,255,.5);font-size:.56rem;line-height:1.4}.npc-forge-training-overview__sources b{color:#bff8ef;font-size:.68rem;font-weight:700}@media(max-width:720px){.npc-forge-training-overview__metrics{grid-template-columns:1fr}.npc-forge-training-overview__metrics>div+div{border-left:0;border-top:1px solid rgba(255,255,255,.07)}}
      `}</style>
    </div>;
  }

  if (detail?.type === "classSourceOption" && detail.groupId && detail.fieldId) {
    const group = (sourceChoiceState.groups || []).find((entry) => entry.id === detail.groupId) || detail.group || {};
    const field = (group.fields || []).find((entry) => entry.id === detail.fieldId) || detail.field || {};
    const option = (field.options || []).find((entry) => entry.key === detail.optionKey) || detail.option || {};
    const selectedKeys = Array.isArray(sourceChoiceState.selections?.[group.id]?.[field.id]) ? sourceChoiceState.selections[group.id][field.id] : [];
    const selected = selectedKeys.includes(option.key);
    const count = Math.max(1, Number(field.count || 1));
    const full = !selected && selectedKeys.length >= count && count > 1;
    const prerequisite = sourceOptionPrerequisite(option, selectedClass);
    const childFields = (group.fields || []).filter((candidate) => candidate.id !== field.id && candidate.activeWhen?.values?.includes(option.key));
    const actionLabel = selected ? "Selected" : full ? "Selection Full" : selectedKeys.length && count === 1 ? "Replace Selection" : "Select";
    const chooseOption = () => {
      if (!selected && !full) toggleSourceChoice?.(group.id, field.id, option.key);
    };
    const facts = sourceOptionMeta(option, field, group);

    return <ContextShell
      icon={`${TRAINING_ASSET_ROOT}/summary-training.svg`}
      iconIsImage
      title={option.label || option.name || "Class Choice"}
      badge={field.label || group.label || "Class Choice"}
      selected={selected}
      description={prerequisite ? `Prerequisite: ${prerequisite}` : group.helper || "This option is granted by your class progression."}
      onAction={chooseOption}
      actionLabel={actionLabel}
      actionDisabled={selected || full}
    >
      <section className="npc-forge-training-context-section">
        <h4>{group.label || "Class Choice"}</h4>
        <div className="npc-forge-training-class-option-copy">
          <p>{option.description || "This source-backed option has no additional imported description."}</p>
        </div>
        <div className="npc-forge-training-context-facts">
          {facts.map((fact) => <span key={fact.label}><small>{fact.label}</small><b>{fact.value}</b></span>)}
          {prerequisite ? <span><small>Prerequisite</small><b>{prerequisite}</b></span> : null}
        </div>
      </section>
      {childFields.length ? <section className="npc-forge-training-context-section">
        <div className="npc-forge-training-context-route"><span>→</span><div><strong>Additional choice follows this option</strong><p>{selected ? "The follow-up field is now available in Class Choices on the left. Click one of its options to inspect and select it here." : "Select this option first. Its dependent choice will then appear in Class Choices on the left."}</p></div></div>
      </section> : null}
    </ContextShell>;
  }

  if (detail?.type === "feat" && detail.option) {
    const feat = detail.option;
    const prerequisite = formatPrerequisiteText(feat.prerequisite_text || feat.prerequisiteText || "");
    const matchingGroups = (sourceChoiceState.groups || []).filter((group) => featGroupMatches(group, feat, detail?.featInstanceId || ""));
    const matchingState = { ...sourceChoiceState, groups: matchingGroups };
    const trainingGroups = sourceChoiceGroupsForResolverPlacement(matchingState, "training");
    const skillsRoutedGroups = trainingGroups.filter((group) => group.metadata?.trainingSection === "skills");
    const featTrainingGroups = trainingGroups.filter((group) => group.metadata?.trainingSection !== "skills");
    const spellGroups = sourceChoiceGroupsForResolverPlacement(matchingState, "spells");
    const selected = Boolean(detail?.granted)
      || matchingGroups.length > 0
      || String(draft.speciesBonus?.featId || "") === String(feat.id || "");
    const selectableBonusFeat = detail?.selectionKind === "species-bonus-feat";
    const chooseFeat = selectableBonusFeat ? () => {
      controller.setSpeciesBonus?.({ featId: feat.id });
    } : null;
    return <ContextShell icon={`${TRAINING_ASSET_ROOT}/summary-feat.svg`} iconIsImage title={feat.name} badge={feat.category || "Feat"} selected={selected} description={prerequisite ? `Prerequisite: ${prerequisite}` : "No prerequisite is listed for this feat."} onAction={chooseFeat} actionLabel={selected ? "Selected" : "Select Feat"} actionDisabled={selected}>
      <section className="npc-forge-training-context-section"><h4>Feat Rules</h4><FeatRuleList feat={feat} matchingGroups={matchingGroups} /><div className="npc-forge-training-context-facts"><span><small>Source</small><b>{feat.source || "Campaign"}</b></span><span><small>Category</small><b>{feat.category || "Feat"}</b></span>{prerequisite ? <span><small>Prerequisite</small><b>{prerequisite}</b></span> : null}</div></section>
      {skillsRoutedGroups.length ? <section className="npc-forge-training-context-section"><div className="npc-forge-training-context-route"><span>←</span><div><strong>Profession choices resolve in Skills</strong><p>This feat adds {skillsRoutedGroups.reduce((count, group) => count + (group.fields || []).reduce((sum, field) => sum + Number(field.count || 1), 0), 0)} additional Profession Skill choices. Make them in <b>Skills → Trade Skills</b>; each available or granted row is labeled with this feat as its source and does not spend the class Skill / Trade Skill allowance.</p></div></div></section> : null}
      {featTrainingGroups.length ? <section className="npc-forge-training-context-section npc-forge-training-context-choices"><h4>Required Feat Choices</h4><p>Every permanent non-spell decision owned by this feat is completed here beside its rules. Skill, tool, or instrument grants are reflected in Skills after you choose them.</p><NpcForgeSourceChoiceFields placement="training" inline groupsOverride={featTrainingGroups} title="Required feat choices" /></section> : null}
      {spellGroups.length ? <section className="npc-forge-training-context-section"><div className="npc-forge-training-context-route"><span>→</span><div><strong>Granted spells resolve on the next tab</strong><p>This feat grants {spellGroups.reduce((count, group) => count + (group.fields || []).filter((field) => field.required !== false).length, 0)} spell choice{spellGroups.reduce((count, group) => count + (group.fields || []).filter((field) => field.required !== false).length, 0) === 1 ? "" : "s"}. They are intentionally completed in <b>Spells</b>, where the spell catalogue, descriptions, levels, and spell-specific rules already live.</p></div></div></section> : null}
    </ContextShell>;
  }

  if (detail?.type === "profession" && selectedProfession) {
    const key = String(detail.key || "");
    const profession = draft.professions?.[key] || {};
    const sourceSelected = detail?.sourceGroupId && detail?.sourceFieldId && detail?.sourceOptionKey
      ? (sourceChoiceState.selections?.[detail.sourceGroupId]?.[detail.sourceFieldId] || []).includes(detail.sourceOptionKey)
      : false;
    const selected = detail?.selectionKind === "granted-profession"
      || sourceSelected
      || Number(profession.rank || 0) > 0;
    const abilities = (selectedProfession.abilities || []).map((ability) => ABILITY_LABELS[ability] || ability).join(" or ");
    const runtimeNote = selectedProfession.runtimeEnabled === false
      ? " This proficiency is available in Character Forge now; its dedicated recipe/progression system is intentionally deferred."
      : "";
    const sourceAvailable = detail?.selectionKind === "source-profession" && !sourceSelected;
    const grantNote = detail?.grantSource && selected
      ? ` ${detail.grantSource} explicitly grants this Trade Skill because its source rule grants the matching professional tool proficiency. This is Proficiency, not Expertise.`
      : sourceAvailable && detail?.grantSource
        ? ` ${detail.grantSource} can grant this Trade Skill without spending the shared Class Skill / Trade Skill allowance.`
        : ` ${selectedProfession.tool} is the associated mundane tool, but an ordinary copy or incidental tool grant does not grant this Trade Skill or Expertise.`;

    const selectProfession = () => {
      if (selected || !detail?.canSelect) return;
      if (detail?.selectionKind === "source-profession" && detail.sourceGroupId && detail.sourceFieldId && detail.sourceOptionKey) {
        const count = Math.max(1, Number(detail.sourceCount || 1));
        const current = Array.isArray(sourceChoiceState.selections?.[detail.sourceGroupId]?.[detail.sourceFieldId])
          ? [...sourceChoiceState.selections[detail.sourceGroupId][detail.sourceFieldId]]
          : [];
        const next = count === 1
          ? [detail.sourceOptionKey]
          : current.includes(detail.sourceOptionKey)
            ? current
            : current.length < count
              ? [...current, detail.sourceOptionKey]
              : [...current.slice(0, Math.max(0, count - 1)), detail.sourceOptionKey];
        setSourceChoice?.(detail.sourceGroupId, detail.sourceFieldId, next);
      } else if (detail?.selectionKind === "trade-skill") {
        controller.setProfession?.(key, "rank", 1);
      }
      controller.setDetail?.({ ...detail });
    };

    const actionAvailable = !selected && ["source-profession", "trade-skill"].includes(detail?.selectionKind);
    const actionLabel = selected ? "Selected" : detail?.canSelect === false ? "Selection Full" : "Select Trade Skill";
    return <ContextShell icon={PROFESSION_ICON[key] || `${TRAINING_ASSET_ROOT}/choice-tool.svg`} iconIsImage title={selectedProfession.label} badge="Trade Skill" selected={selected} description={`${selectedProfession.label} is the character's crafting proficiency.${grantNote} The associated tool is still normally required to perform the craft.${runtimeNote}`} onAction={actionAvailable ? selectProfession : null} actionLabel={actionLabel} actionDisabled={selected || detail?.canSelect === false}>
      <section className="npc-forge-training-context-section"><h4>Typical Uses</h4><ul>{(PROFESSION_USES[key] || ["Apply this Trade Skill when a supported campaign crafting or professional task calls for it."]).map((use) => <li key={use}>{use}</li>)}</ul><div className="npc-forge-training-context-facts"><span><small>Associated Tool</small><b>{selectedProfession.tool}</b></span><span><small>Crafting Ability</small><b>{profession.ability ? ABILITY_LABELS[profession.ability] || profession.ability : abilities}</b></span><span><small>Campaign Support</small><b>{selectedProfession.runtimeEnabled === false ? "Proficiency now • recipes later" : "Crafting runtime active"}</b></span>{detail?.grantSource ? <span><small>{selected ? "Granted By" : "Available From"}</small><b>{detail.grantSource}</b></span> : null}</div></section>
    </ContextShell>;
  }

  if (selectedSkill) {
    const key = selectedSkill.key;
    const backgroundSelected = detail?.backgroundGroupId
      ? (draft.backgroundSkillChoices?.[detail.backgroundGroupId] || []).includes(key)
      : false;
    const sourceSelected = detail?.sourceGroupId && detail?.sourceFieldId && detail?.sourceOptionKey
      ? (sourceChoiceState.selections?.[detail.sourceGroupId]?.[detail.sourceFieldId] || []).includes(detail.sourceOptionKey)
      : false;
    const classSelected = (draft.selectedClassSkills || []).includes(key);
    const selected = Boolean(detail?.granted)
      || backgroundSelected
      || sourceSelected
      || classSelected;
    const availableFromClass = Boolean(selectedClass);

    const selectSkill = () => {
      if (selected || detail?.canSelect === false) return;
      if (detail?.selectionKind === "background-skill" && detail.backgroundGroupId) {
        if (classSelected) controller.toggleClassSkill?.(key);
        controller.toggleBackgroundSkill?.(detail.backgroundGroupId, key, Math.max(1, Number(detail.backgroundCount || 1)));
      } else if (detail?.selectionKind === "source-skill" && detail.sourceGroupId && detail.sourceFieldId && detail.sourceOptionKey) {
        if (classSelected) controller.toggleClassSkill?.(key);
        const count = Math.max(1, Number(detail.sourceCount || 1));
        const current = Array.isArray(sourceChoiceState.selections?.[detail.sourceGroupId]?.[detail.sourceFieldId])
          ? [...sourceChoiceState.selections[detail.sourceGroupId][detail.sourceFieldId]]
          : [];
        const next = count === 1
          ? [detail.sourceOptionKey]
          : current.includes(detail.sourceOptionKey)
            ? current
            : current.length < count
              ? [...current, detail.sourceOptionKey]
              : [...current.slice(0, Math.max(0, count - 1)), detail.sourceOptionKey];
        setSourceChoice?.(detail.sourceGroupId, detail.sourceFieldId, next);
      } else if (detail?.selectionKind === "class-skill") {
        controller.toggleClassSkill?.(key);
      }
      controller.setDetail?.({ ...detail });
    };

    const actionAvailable = !selected && ["background-skill", "source-skill", "class-skill"].includes(detail?.selectionKind);
    const actionLabel = selected ? "Selected" : detail?.canSelect === false ? "Selection Full" : "Select Skill";
    return <ContextShell icon={<SkillIcon skillKey={key} />} title={selectedSkill.label} badge={availableFromClass ? "Class Skill" : "Skill"} selected={selected} description={selectedSkill.description || "Use this skill when its governing ability and trained application are relevant."} onAction={actionAvailable ? selectSkill : null} actionLabel={actionLabel} actionDisabled={selected || detail?.canSelect === false}>
      <section className="npc-forge-training-context-section"><h4>Typical Uses</h4><ul>{(SKILL_USES[key] || ["Apply this skill when the Game Master calls for a check involving its trained area of expertise."]).map((use) => <li key={use}>{use}</li>)}</ul><div className="npc-forge-training-context-facts"><span><small>Governing Ability</small><b>{ABILITY_LABELS[selectedSkill.ability] || selectedSkill.ability || "Varies"}</b></span>{detail?.grantSource ? <span><small>{selected ? "Granted By" : "Available From"}</small><b>{detail.grantSource}</b></span> : null}</div></section>
    </ContextShell>;
  }

  return <div className="npc-forge-training-context-dossier"><h3>Current Selection</h3><p>Click a Skill, Trade Skill, feat, or Class Choice on the left to keep its details here.</p></div>;
}

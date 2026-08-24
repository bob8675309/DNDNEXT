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
import { formatPlayerFacingText } from "../utils/playerFacingText";
import NpcForgeSourceChoiceFields from "./NpcForgeSourceChoiceFields";
import { sourceChoiceGroupsForResolverPlacement, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

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
  alchemy: ["Brew campaign alchemical recipes when you know the recipe", "Identify and process ingredients used by alchemical formulas", "Use Alchemist's Supplies for ordinary tool work and campaign Alchemy checks"],
  smithing: ["Forge and repair mundane metal weapons and armor", "Work metals and smithing materials during campaign crafting", "Use Smith's Tools for ordinary tool work and campaign Smithing checks"],
  scribe: ["Prepare written magical or technical works supported by campaign recipes", "Produce precise inscriptions, diagrams, and formal records", "Use Calligrapher's Supplies for ordinary tool work and campaign Scribing checks"],
  enchanting: ["Apply supported magical imbuements to eligible equipment", "Work with magical components at an enchanting station or equivalent site", "Use Enchanter's Tools for ordinary tool work and campaign Enchanting checks"],
  cooking: ["Prepare meals, rations, and other food with trained Cook's Utensils technique", "Judge ingredients, spoilage, seasoning, and food preparation", "Use Cooking as the campaign proficiency when future dedicated cooking recipes call for it"],
  tinkering: ["Build, repair, or diagnose small mechanisms and practical devices", "Work precisely with Tinker's Tools on compact mechanical assemblies", "Use Tinkering as the campaign proficiency when future dedicated tinkering recipes call for it"],
  jewelcraft: ["Appraise, cut, set, repair, or fashion gems and fine decorative work", "Perform precision work with Jeweler's Tools and valuable small materials", "Use Jewelcraft as the campaign proficiency when future dedicated jewelcraft recipes call for it"],
  brewing: ["Prepare and evaluate brewed drinks and fermentation processes", "Use Brewer's Supplies to control ingredients, sanitation, and flavor", "Use Brewing as the campaign proficiency when future dedicated brewing recipes call for it"],
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
  const formatted = formatPlayerFacingText(feat.description || "", "").trim();
  if (!formatted) return [{ title: "Rules", body: "No source description is available for this feat." }];
  return formatted.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph) => {
    const heading = paragraph.match(/^([^.!?]{2,48})\.\s+([\s\S]+)$/);
    return heading
      ? { title: heading[1].trim(), body: heading[2].trim() }
      : { title: "", body: paragraph };
  });
}

function featRuleSections(feat = {}, matchingGroups = []) {
  const crafterCampaignRule = normalized(feat.name) === "crafter"
    && matchingGroups.some((group) => group.metadata?.campaignRule === "crafter-profession-skills");
  if (!crafterCampaignRule) return genericFeatRuleSections(feat);

  return [
    {
      title: "Profession Training",
      body: "DnDNext replaces Crafter's three raw Artisan's Tool proficiency picks with three additional Profession Skills. Choose any three of Alchemy, Smithing, Scribe, Enchanting, Cooking, Tinkering, Jewelcraft, or Brewing below. Each Profession Skill also includes proficiency with its mapped tool, and these feat-granted choices do not spend your class Skill / Trade Skill allowance.",
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
  return <div className="npc-forge-training-feat-rule-list">{featRuleSections(feat, matchingGroups).map((section, index) => <article key={`${section.title || "rule"}-${index}`}>{section.title ? <strong>{section.title}</strong> : null}<p>{section.body}</p></article>)}</div>;
}

function ContextShell({ icon, iconIsImage = false, title, badge, selected, description, children }) {
  return <div className="npc-forge-training-context-dossier">
    <h3>Current Selection</h3>
    <div className="npc-forge-training-context-hero">
      <span className="npc-forge-training-context-icon">{iconIsImage ? <img src={icon} alt="" aria-hidden="true" /> : icon}</span>
      <div className="npc-forge-training-context-copy"><div><h2>{title}</h2>{badge ? <em>{badge}</em> : null}</div><p>{description}</p></div>
      <strong className={selected ? "is-selected" : ""}>{selected ? "Selected" : "Available"}</strong>
    </div>
    <div className="npc-forge-training-context-divider" />
    {children}
    <div className="npc-forge-training-context-note"><span>ⓘ</span><p>You can change your selections until you continue.<br />All choices can be reviewed on the final step.</p></div>
    <style jsx global>{`
      .npc-forge-training-context-dossier{display:flex;flex-direction:column;min-height:100%;padding:4px 2px 2px}.npc-forge-training-context-dossier>h3{margin:0 0 18px;color:#fff;font-size:1rem}.npc-forge-training-context-hero{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:14px;align-items:center}.npc-forge-training-context-icon{display:grid;place-items:center;width:48px;height:48px;border:1px solid rgba(168,108,255,.2);border-radius:9px;color:#bd85ff;background:rgba(126,72,199,.08);font-size:1.65rem}.npc-forge-training-context-icon img{width:34px;height:34px;object-fit:contain}.npc-forge-training-context-copy{display:grid;gap:5px;min-width:0}.npc-forge-training-context-copy>div{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.npc-forge-training-context-copy h2{margin:0;color:#fff;font-size:1.22rem;line-height:1.1}.npc-forge-training-context-copy em{padding:4px 8px;border-radius:999px;color:#d9bfff;background:rgba(126,72,199,.15);font-size:.61rem;font-style:normal}.npc-forge-training-context-copy p{margin:0;color:rgba(255,255,255,.7);font-size:.72rem;line-height:1.55}.npc-forge-training-context-hero>strong{align-self:start;margin-top:4px;padding:4px 10px;border-radius:999px;color:rgba(255,255,255,.56);background:rgba(255,255,255,.05);font-size:.62rem}.npc-forge-training-context-hero>strong.is-selected{color:#83f4df;background:rgba(19,164,139,.16)}.npc-forge-training-context-divider{height:1px;margin:18px 0;background:rgba(255,255,255,.09)}.npc-forge-training-context-section{display:grid;gap:12px}.npc-forge-training-context-section+ .npc-forge-training-context-section{margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)}.npc-forge-training-context-section>h4{margin:0;color:#fff;font-size:.76rem}.npc-forge-training-context-section ul{display:grid;gap:9px;margin:0;padding-left:20px;color:rgba(255,255,255,.7);font-size:.7rem;line-height:1.5}.npc-forge-training-context-section>p{margin:0;color:rgba(255,255,255,.72);font-size:.72rem;line-height:1.65;white-space:pre-line}.npc-forge-training-feat-rule-list{display:grid;gap:8px}.npc-forge-training-feat-rule-list article{display:grid;gap:4px;padding:9px 10px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:rgba(255,255,255,.022)}.npc-forge-training-feat-rule-list article>strong{color:#e5d2ff;font-size:.66rem}.npc-forge-training-feat-rule-list article>p{margin:0;color:rgba(255,255,255,.74);font-size:.69rem;line-height:1.58}.npc-forge-training-context-facts{display:flex;flex-wrap:wrap;gap:8px}.npc-forge-training-context-facts>span{display:grid;gap:2px;min-width:150px;padding:8px 10px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.025)}.npc-forge-training-context-facts small{color:rgba(255,255,255,.43);font-size:.52rem;text-transform:uppercase}.npc-forge-training-context-facts b{color:#fff;font-size:.67rem}.npc-forge-training-context-choices{gap:9px!important}.npc-forge-training-context-choices>p{max-width:720px}.npc-forge-training-context-choices .npc-forge-source-choices{gap:8px;margin-top:0}.npc-forge-training-context-choices .npc-forge-source-choices__heading{display:none}.npc-forge-training-context-choices .npc-forge-source-choice-group{gap:8px;padding:10px 11px}.npc-forge-training-context-choices .npc-forge-source-choice-group>header small{font-size:.58rem}.npc-forge-training-context-choices .npc-forge-source-choice-slots{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}.npc-forge-training-context-route{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:start;padding:10px 11px;border:1px solid rgba(168,108,255,.18);border-radius:9px;background:rgba(126,72,199,.045)}.npc-forge-training-context-route>span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;color:#d8c2fb;background:rgba(126,72,199,.14);font-size:.7rem}.npc-forge-training-context-route>div{display:grid;gap:3px}.npc-forge-training-context-route strong{color:#fff;font-size:.68rem}.npc-forge-training-context-route p{margin:0;color:rgba(255,255,255,.65);font-size:.62rem;line-height:1.5}.npc-forge-training-context-route b{color:#e7d7ff}.npc-forge-training-context-note{display:flex;gap:10px;align-items:flex-start;width:min(560px,100%);margin-top:28px;padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(7,10,18,.32)}.npc-forge-training-context-note>span{color:#d4dcff;font-size:.8rem}.npc-forge-training-context-note p{margin:0;color:rgba(255,255,255,.64);font-size:.68rem;line-height:1.55}@media(max-width:720px){.npc-forge-training-context-hero{grid-template-columns:42px minmax(0,1fr)}.npc-forge-training-context-hero>strong{grid-column:2;justify-self:start;margin:0}.npc-forge-training-context-icon{width:42px;height:42px}.npc-forge-training-context-note{margin-top:24px}.npc-forge-training-context-choices .npc-forge-source-choice-slots{grid-template-columns:1fr}}
    `}</style>
  </div>;
}

export default function NpcForgeTrainingContextCard({ detail = null, selectedSkill = null, selectedProfession = null, selectedClass = null, draft = {} }) {
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();

  if (detail?.type === "feat" && detail.option) {
    const feat = detail.option;
    const prerequisite = formatPrerequisiteText(feat.prerequisite_text || feat.prerequisiteText || "");
    const matchingGroups = (sourceChoiceState.groups || []).filter((group) => featGroupMatches(group, feat, detail?.featInstanceId || ""));
    const matchingState = { ...sourceChoiceState, groups: matchingGroups };
    const trainingGroups = sourceChoiceGroupsForResolverPlacement(matchingState, "training");
    const spellGroups = sourceChoiceGroupsForResolverPlacement(matchingState, "spells");
    const selected = Boolean(detail?.granted)
      || matchingGroups.length > 0
      || String(draft.speciesBonus?.featId || "") === String(feat.id || "");
    return <ContextShell icon={`${TRAINING_ASSET_ROOT}/summary-feat.svg`} iconIsImage title={feat.name} badge={feat.category || "Feat"} selected={selected} description={prerequisite ? `Prerequisite: ${prerequisite}` : "No prerequisite is listed for this feat."}>
      <section className="npc-forge-training-context-section"><h4>Feat Rules</h4><FeatRuleList feat={feat} matchingGroups={matchingGroups} /><div className="npc-forge-training-context-facts"><span><small>Source</small><b>{feat.source || "Campaign"}</b></span><span><small>Category</small><b>{feat.category || "Feat"}</b></span>{prerequisite ? <span><small>Prerequisite</small><b>{prerequisite}</b></span> : null}</div></section>
      {trainingGroups.length ? <section className="npc-forge-training-context-section npc-forge-training-context-choices"><h4>Required Feat Choices</h4><p>Every permanent non-spell decision owned by this feat is completed here beside its rules. Profession, skill, tool, or instrument grants are reflected in Skills after you choose them.</p><NpcForgeSourceChoiceFields placement="training" inline groupsOverride={trainingGroups} title="Required feat choices" /></section> : null}
      {spellGroups.length ? <section className="npc-forge-training-context-section"><div className="npc-forge-training-context-route"><span>→</span><div><strong>Granted spells resolve on the next tab</strong><p>This feat grants {spellGroups.reduce((count, group) => count + (group.fields || []).filter((field) => field.required !== false).length, 0)} spell choice{spellGroups.reduce((count, group) => count + (group.fields || []).filter((field) => field.required !== false).length, 0) === 1 ? "" : "s"}. They are intentionally completed in <b>Spells</b>, where the spell catalogue, descriptions, levels, and spell-specific rules already live.</p></div></div></section> : null}
    </ContextShell>;
  }

  if (detail?.type === "profession" && selectedProfession) {
    const key = String(detail.key || "");
    const profession = draft.professions?.[key] || {};
    const selected = Boolean(detail?.granted) || Number(profession.rank || 0) > 0;
    const abilities = (selectedProfession.abilities || []).map((ability) => ABILITY_LABELS[ability] || ability).join(" or ");
    const runtimeNote = selectedProfession.runtimeEnabled === false
      ? " This proficiency is available in Character Forge now; its dedicated recipe/progression system is intentionally deferred."
      : "";
    return <ContextShell icon={PROFESSION_ICON[key] || `${TRAINING_ASSET_ROOT}/choice-tool.svg`} iconIsImage title={selectedProfession.label} badge="Trade Skill" selected={selected} description={`${selectedProfession.tool} proficiency and the ${selectedProfession.label} Trade Skill are the same campaign proficiency. A source that grants the tool grants this Trade Skill without requiring a second Training pick.${runtimeNote}`}>
      <section className="npc-forge-training-context-section"><h4>Typical Uses</h4><ul>{(PROFESSION_USES[key] || ["Apply this Trade Skill when a supported campaign crafting or professional task calls for it."]).map((use) => <li key={use}>{use}</li>)}</ul><div className="npc-forge-training-context-facts"><span><small>Associated Tool</small><b>{selectedProfession.tool}</b></span><span><small>Crafting Ability</small><b>{profession.ability ? ABILITY_LABELS[profession.ability] || profession.ability : abilities}</b></span><span><small>Campaign Support</small><b>{selectedProfession.runtimeEnabled === false ? "Proficiency now • recipes later" : "Crafting runtime active"}</b></span>{detail?.grantSource ? <span><small>Granted By</small><b>{detail.grantSource}</b></span> : null}</div></section>
    </ContextShell>;
  }

  if (selectedSkill) {
    const key = selectedSkill.key;
    const selected = (draft.selectedClassSkills || []).includes(key) || Boolean(detail?.granted);
    const availableFromClass = Boolean(selectedClass);
    return <ContextShell icon={<SkillIcon skillKey={key} />} title={selectedSkill.label} badge={availableFromClass ? "Class Skill" : "Skill"} selected={selected} description={selectedSkill.description || "Use this skill when its governing ability and trained application are relevant."}>
      <section className="npc-forge-training-context-section"><h4>Typical Uses</h4><ul>{(SKILL_USES[key] || ["Apply this skill when the Game Master calls for a check involving its trained area of expertise."]).map((use) => <li key={use}>{use}</li>)}</ul><div className="npc-forge-training-context-facts"><span><small>Governing Ability</small><b>{ABILITY_LABELS[selectedSkill.ability] || selectedSkill.ability || "Varies"}</b></span>{detail?.grantSource ? <span><small>Granted By</small><b>{detail.grantSource}</b></span> : null}</div></section>
    </ContextShell>;
  }

  return <div className="npc-forge-training-context-dossier"><h3>Current Selection</h3><p>Hover, focus, or select a Skill, Trade Skill, Training choice, or feat to see its details here.</p></div>;
}

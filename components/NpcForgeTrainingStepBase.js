import { useEffect, useMemo, useState } from "react";
import { ABILITY_LABELS } from "../utils/characterCreation";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import { sourceChoiceGroupComplete } from "../utils/playerForgeSourceChoices";
import NpcForgeClassFeatureChoices from "./NpcForgeClassFeatureChoices";
import NpcForgeSourceChoiceFields from "./NpcForgeSourceChoiceFields";
import { useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

const normalized = (value) => String(value ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export default function NpcForgeTrainingStep({
  playerMode,
  backgroundSkills = [],
  backgroundSkillChoices = [],
  backgroundSkillSelections = {},
  onToggleBackgroundSkill = null,
  classSkillConfig,
  selectedClass,
  selectedClassSkills = [],
  professions = {},
  titleForSkill,
  onToggleClassSkill,
  onToggleExpertise,
  expertiseSkills = [],
  onSetProfession,
  onDetail,
}) {
  const { state: classChoiceState, toggleFeatureOption } = useNpcForgeClassChoice();
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();
  const [playerTab, setPlayerTab] = useState("skills");
  const selectedSkillKeys = [...new Set([...backgroundSkills, ...selectedClassSkills])];
  const eligibleExpertiseNames = selectedSkillKeys.map((key) => titleForSkill(key));
  const eligibleExpertiseKey = eligibleExpertiseNames.map(normalized).join("|");
  const eligibleExpertiseSet = useMemo(() => new Set(eligibleExpertiseNames.map(normalized)), [eligibleExpertiseKey]);
  const trainingChoiceGroups = useMemo(() => (classChoiceState.featureGroups || []).filter((group) => (group.placement || "class") === "training"), [classChoiceState.featureGroups]);
  const classAbilityGroups = useMemo(() => (classChoiceState.featureGroups || []).filter((group) => (group.placement || "class") === "class"), [classChoiceState.featureGroups]);
  const trainedProfessionCount = PROFESSION_KEYS.filter((key) => Number(professions?.[key]?.rank || 0) > 0).length;
  const totalTrainingChoices = Number(classSkillConfig?.totalCount ?? classSkillConfig?.count ?? 0);
  const usedTrainingChoices = selectedClassSkills.length + (playerMode ? trainedProfessionCount : 0);
  const remainingTrainingChoices = Math.max(0, totalTrainingChoices - usedTrainingChoices);
  const incompleteBackgroundSkills = backgroundSkillChoices.some((group) => (backgroundSkillSelections?.[group.id] || []).length !== Number(group.count || 1));

  const incompleteTrainingFeature = trainingChoiceGroups.some((group) => group.required && (classChoiceState.featureSelections?.[group.id] || []).length !== Number(group.count || 0));
  const incompleteClassAbility = classAbilityGroups.some((group) => group.required && (classChoiceState.featureSelections?.[group.id] || []).length !== Number(group.count || 0));
  const sourceTrainingGroups = useMemo(() => (sourceChoiceState.groups || []).filter((group) => group.placement === "training"), [sourceChoiceState.groups]);
  const sourceClassAbilityGroups = useMemo(() => (sourceChoiceState.groups || []).filter((group) => ["class", "advancement"].includes(group.placement)), [sourceChoiceState.groups]);
  const incompleteSourceTraining = sourceTrainingGroups.some((group) => !sourceChoiceGroupComplete(group, sourceChoiceState.selections || {}));
  const incompleteSourceClassAbility = sourceClassAbilityGroups.some((group) => !sourceChoiceGroupComplete(group, sourceChoiceState.selections || {}));

  useEffect(() => {
    if (!playerMode) return;
    for (const group of trainingChoiceGroups) {
      if (group.kind !== "expertise") continue;
      for (const key of classChoiceState.featureSelections?.[group.id] || []) {
        const option = group.options?.find((candidate) => candidate.key === key);
        if (option && !eligibleExpertiseSet.has(normalized(option.name))) toggleFeatureOption(group.id, key);
      }
    }
  }, [classChoiceState.featureSelections, eligibleExpertiseKey, eligibleExpertiseSet, playerMode, toggleFeatureOption, trainingChoiceGroups]);

  useEffect(() => {
    if (!playerMode || typeof document === "undefined") return undefined;
    function blockIncompleteTrainingChoice(event) {
      const button = event.target?.closest?.("button");
      if (!button || button.textContent?.trim() !== "Continue") return;
      const needsSkillsTab = incompleteBackgroundSkills || incompleteTrainingFeature || incompleteSourceTraining;
      const needsAbilitiesTab = incompleteClassAbility || incompleteSourceClassAbility;
      if (!needsSkillsTab && !needsAbilitiesTab) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setPlayerTab(needsSkillsTab ? "skills" : "abilities");
      setTimeout(() => button.closest(".npc-forge-modal-v2")?.querySelector(".npc-forge-training-step .is-required")?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 0);
    }
    document.addEventListener("click", blockIncompleteTrainingChoice, true);
    return () => document.removeEventListener("click", blockIncompleteTrainingChoice, true);
  }, [incompleteBackgroundSkills, incompleteClassAbility, incompleteSourceClassAbility, incompleteSourceTraining, incompleteTrainingFeature, playerMode]);

  const backgroundSkillChoicePanel = backgroundSkillChoices.length ? <div className="npc-forge-background-skill-choices">
    <div className="npc-forge-subheading mt-3">Background skill choices <small>Granted by the Background • do not use class Training choices</small></div>
    {backgroundSkillChoices.map((group) => {
      const selected = backgroundSkillSelections?.[group.id] || [];
      const complete = selected.length === Number(group.count || 1);
      return <section key={group.id} className={complete ? "is-complete" : "is-required"}><div className="npc-forge-context-choice-head"><b>Choose {group.count} skill{group.count === 1 ? "" : "s"}</b><small>{selected.length}/{group.count} selected</small></div><div className="npc-forge-context-choice-grid">{(group.options || []).map((option) => <button key={option.key} type="button" className={selected.includes(option.key) ? "is-selected" : ""} onClick={() => onToggleBackgroundSkill?.(group.id, option.key, group.count)} onMouseEnter={() => onDetail?.({ type: "skill", key: option.key })}><strong>{option.label}</strong><span>{option.description}</span></button>)}</div></section>;
    })}
  </div> : null;

  const skillsAndProficiencies = <>
    <div className={`npc-forge-training-explainer ${playerMode ? "is-player" : ""}`}>
      <div><strong>Background grants</strong><span>{backgroundSkills.length ? `${backgroundSkills.length} skill${backgroundSkills.length === 1 ? "" : "s"} are already trained by the selected background. These do not use a Training choice.` : backgroundSkillChoices.length ? "Complete the Background skill choice below. The resulting proficiency does not use a class Training choice." : "This background does not list skill proficiencies."}</span></div>
      <div><strong>Training choices</strong><span>Choose exactly {totalTrainingChoices} total option{totalTrainingChoices === 1 ? "" : "s"} from the {selectedClass?.class_name || "class"} skill pool and crafting professions. {usedTrainingChoices}/{totalTrainingChoices} used.</span></div>
      {!playerMode ? <div><strong>Expertise</strong><span>NPC expertise can be assigned directly when building a bespoke NPC.</span></div> : null}
    </div>

    {playerMode ? backgroundSkillChoicePanel : null}

    <div className="npc-forge-subheading mt-3">Background-granted skills</div>
    <div className="npc-forge-chip-row">{backgroundSkills.length ? backgroundSkills.map((key) => <button key={key} type="button" className="is-fixed" onClick={() => onDetail({ type: "skill", key })}>{titleForSkill(key)}</button>) : <span className="is-fixed">{backgroundSkillChoices.length ? "Complete the Background skill choice above" : "No Background skill proficiencies"}</span>}</div>

    <div className="npc-forge-subheading mt-4">Class skills <small>{usedTrainingChoices}/{totalTrainingChoices} Training choices used • {selectedClassSkills.length} class skill{selectedClassSkills.length === 1 ? "" : "s"}</small></div>
    <div className="npc-forge-skill-grid">{classSkillConfig.options.map((key) => {
      const selected = selectedClassSkills.includes(key);
      const backgroundGranted = backgroundSkills.includes(key);
      const disabled = playerMode && !selected && !backgroundGranted && remainingTrainingChoices <= 0;
      return <button key={key} type="button" disabled={disabled} className={`${selected ? "is-active" : ""} ${backgroundGranted ? "is-background" : ""}`} onClick={() => backgroundGranted ? onDetail({ type: "skill", key }) : onToggleClassSkill(key)}><span>{titleForSkill(key)}</span><small>{backgroundGranted ? "Already granted by Background" : selected ? "Training choice selected" : disabled ? "No Training choices remaining" : "Available from class pool"}</small></button>;
    })}</div>

    {playerMode && trainingChoiceGroups.length ? <NpcForgeClassFeatureChoices groups={classChoiceState.featureGroups || []} selections={classChoiceState.featureSelections || {}} level={classChoiceState.level || 1} onToggle={toggleFeatureOption} placement="training" eligibleOptionNames={eligibleExpertiseNames} heading="Assign Expertise after proficiency is established" description="Only persistent Training-stage choices appear here. Expertise can be assigned only to a skill the character is already proficient in." /> : null}

    {!playerMode ? <><div className="npc-forge-subheading mt-4">Expertise <small>NPC-only direct assignment</small></div><div className="npc-forge-chip-row">{selectedSkillKeys.map((key) => <button key={key} type="button" className={expertiseSkills.includes(key) ? "is-active" : ""} onClick={() => onToggleExpertise(key)}>{titleForSkill(key)}</button>)}</div></> : null}

    <div className="npc-forge-subheading mt-4">Crafting professions <small>{trainedProfessionCount} selected • each uses one Training choice</small></div>
    {playerMode ? <div className="npc-forge-crafting-house-rule"><strong>Campaign crafting house rule</strong><p>Players can pursue a profession and create items by selecting a crafting skill. Crafting time varies by recipe, but most items are crafted during a Short or Long Rest after a successful DC check. Some recipes may require a physical work site, such as a forge, enchanting station, ley line, laboratory, or a properly deployed caravan workshop.</p></div> : null}
    <div className="npc-forge-profession-list">{PROFESSION_KEYS.map((key) => {
      const definition = PROFESSION_DEFINITIONS[key];
      const profession = professions?.[key] || { rank: 0, ability: definition.abilities[0], offersService: false };
      const currentlyTrained = Number(profession.rank || 0) > 0;
      const cannotTrain = playerMode && !currentlyTrained && remainingTrainingChoices <= 0;
      return <div key={key} className={`npc-forge-profession ${profession.offersService ? "is-provider" : ""}`} onMouseEnter={() => onDetail({ type: "profession", key })}><div><strong>{definition.label}</strong><small>{definition.tool}{playerMode ? " • uses one Training choice" : ""}</small></div><label><span>Rank</span><select value={profession.rank} onChange={(event) => onSetProfession(key, "rank", Number(event.target.value))}><option value={0}>Untrained</option><option value={1} disabled={cannotTrain}>Proficient</option>{!playerMode ? <option value={2}>Expertise</option> : null}</select></label><label><span>Ability</span><select value={profession.ability} onChange={(event) => onSetProfession(key, "ability", event.target.value)}>{definition.abilities.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}</select></label>{!playerMode ? <label className="npc-forge-service-toggle"><input type="checkbox" checked={Boolean(profession.offersService)} disabled={Number(profession.rank || 0) === 0} onChange={(event) => onSetProfession(key, "offersService", event.target.checked)} /><span>Offers workshop service</span></label> : null}</div>;
    })}</div>
    {playerMode ? <NpcForgeSourceChoiceFields placement="training" title="Tool, instrument, and Training-stage source choices" /> : null}
  </>;

  const featsAndClassAbilities = <>
    <div className="npc-forge-training-decision-intro"><strong>Feats & Class Abilities</strong><p>Class features are explained on the Class step. Make their persistent mechanical selections here, with complete option descriptions and source prerequisites. Spell choices that belong to a feature remain on the Spells step.</p></div>
    <NpcForgeClassFeatureChoices groups={classChoiceState.featureGroups || []} selections={classChoiceState.featureSelections || {}} level={classChoiceState.level || 1} onToggle={toggleFeatureOption} placement="class" heading="Class and subclass ability choices" description="Choose the persistent options granted by the selected class, subclass, and starting level." />
    <NpcForgeSourceChoiceFields placement="class" ownerType="feat" title="Feat-granted follow-up choices" />
    <NpcForgeSourceChoiceFields placement="advancement" title="Higher-level feat and Epic Boon decisions" />
  </>;

  return <div className="npc-forge-section npc-forge-training-step">
    <div className="npc-forge-section-heading"><div><span>Training</span><h3>{playerMode ? "Skills, feats, and class abilities" : "Skills, Expertise, and crafting professions"}</h3></div><p>{playerMode ? "Resolve Background skill grants and proficiencies first, then make persistent feat and class-feature decisions with full context." : "Background grants are automatic. Class skills and crafting professions establish proficiency first; Expertise is assigned afterward."}</p></div>
    {playerMode ? <div className="npc-forge-training-tabs" role="tablist" aria-label="Training sections"><button type="button" role="tab" aria-selected={playerTab === "skills"} className={playerTab === "skills" ? "is-active" : ""} onClick={() => setPlayerTab("skills")}>Skills & Proficiencies{(incompleteBackgroundSkills || incompleteTrainingFeature || incompleteSourceTraining) ? <em>Required</em> : null}</button><button type="button" role="tab" aria-selected={playerTab === "abilities"} className={playerTab === "abilities" ? "is-active" : ""} onClick={() => setPlayerTab("abilities")}>Feats & Class Abilities{(incompleteClassAbility || incompleteSourceClassAbility) ? <em>Required</em> : null}</button></div> : null}
    {!playerMode || playerTab === "skills" ? skillsAndProficiencies : featsAndClassAbilities}

    <style jsx global>{`
      .npc-forge-training-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:14px;padding:5px;border:1px solid rgba(168,108,255,.22);border-radius:11px;background:rgba(126,72,199,.055)}.npc-forge-training-tabs button{display:flex;align-items:center;justify-content:center;gap:8px;padding:9px 11px;border:1px solid transparent;border-radius:8px;color:rgba(255,255,255,.7);background:transparent;font-weight:800}.npc-forge-training-tabs button.is-active{border-color:rgba(168,108,255,.48);color:#fff;background:rgba(126,72,199,.17)}.npc-forge-training-tabs em{padding:2px 6px;border-radius:999px;color:#ffe0a0;background:rgba(246,190,90,.12);font-size:.54rem;font-style:normal;text-transform:uppercase}.npc-forge-training-decision-intro{margin-bottom:12px;padding:12px 14px;border-left:3px solid #a86cff;border-radius:9px;background:rgba(126,72,199,.08)}.npc-forge-training-decision-intro strong{color:#eadfff}.npc-forge-training-decision-intro p{margin:5px 0 0;color:rgba(255,255,255,.72);font-size:.74rem;line-height:1.55}.npc-forge-training-explainer{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:4px}.npc-forge-training-explainer.is-player{grid-template-columns:repeat(2,minmax(0,1fr))}.npc-forge-training-explainer>div{display:grid;gap:5px;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.025)}.npc-forge-training-explainer strong{color:#fff;font-size:.75rem}.npc-forge-training-explainer span{color:rgba(255,255,255,.62);font-size:.69rem;line-height:1.45}.npc-forge-background-skill-choices{display:grid;gap:9px}.npc-forge-background-skill-choices>section{display:grid;gap:8px;padding:10px 11px;border:1px solid rgba(88,214,199,.26);border-radius:10px;background:rgba(88,214,199,.045)}.npc-forge-background-skill-choices>section.is-required{border-color:rgba(243,191,99,.52);box-shadow:inset 3px 0 rgba(243,191,99,.8)}.npc-forge-background-skill-choices>section.is-complete{box-shadow:inset 3px 0 rgba(88,214,199,.72)}.npc-forge-background-skill-choices .npc-forge-context-choice-grid button span{display:block;margin-top:4px;color:rgba(255,255,255,.66);font-size:.66rem;line-height:1.45}.npc-forge-crafting-house-rule{margin-bottom:10px;padding:12px 14px;border-left:3px solid #58d6c7;border-radius:9px;background:rgba(88,214,199,.075)}.npc-forge-crafting-house-rule strong{color:#bffbf3}.npc-forge-crafting-house-rule p{margin:5px 0 0;color:rgba(255,255,255,.72);font-size:.75rem;line-height:1.58}@media(max-width:900px){.npc-forge-training-tabs,.npc-forge-training-explainer,.npc-forge-training-explainer.is-player{grid-template-columns:1fr}}
    `}</style>
  </div>;
}

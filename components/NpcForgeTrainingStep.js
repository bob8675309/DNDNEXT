import { useEffect, useMemo } from "react";
import { ABILITY_LABELS } from "../utils/characterCreation";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import NpcForgeClassFeatureChoices from "./NpcForgeClassFeatureChoices";
import { useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";

const normalized = (value) => String(value ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export default function NpcForgeTrainingStep({
  playerMode,
  backgroundSkills = [],
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
  const selectedSkillKeys = [...new Set([...backgroundSkills, ...selectedClassSkills])];
  const eligibleExpertiseNames = selectedSkillKeys.map((key) => titleForSkill(key));
  const eligibleExpertiseKey = eligibleExpertiseNames.map(normalized).join("|");
  const eligibleExpertiseSet = useMemo(() => new Set(eligibleExpertiseNames.map(normalized)), [eligibleExpertiseKey]);
  const trainingChoiceGroups = useMemo(() => (classChoiceState.featureGroups || []).filter((group) => (group.placement || "class") === "training"), [classChoiceState.featureGroups]);
  const trainedProfessionCount = PROFESSION_KEYS.filter((key) => Number(professions?.[key]?.rank || 0) > 0).length;
  const totalTrainingChoices = Number(classSkillConfig?.totalCount ?? classSkillConfig?.count ?? 0);
  const usedTrainingChoices = selectedClassSkills.length + (playerMode ? trainedProfessionCount : 0);
  const remainingTrainingChoices = Math.max(0, totalTrainingChoices - usedTrainingChoices);

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
    if (!playerMode || !trainingChoiceGroups.length || typeof document === "undefined") return undefined;
    function blockIncompleteTrainingChoice(event) {
      const button = event.target?.closest?.("button");
      if (!button || button.textContent?.trim() !== "Continue") return;
      const incomplete = trainingChoiceGroups.some((group) => group.required && (classChoiceState.featureSelections?.[group.id] || []).length !== Number(group.count || 0));
      if (!incomplete) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      button.closest(".npc-forge-modal-v2")?.querySelector(".npc-forge-class-choices.is-placement-training .npc-forge-class-choice-group.is-required")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
    document.addEventListener("click", blockIncompleteTrainingChoice, true);
    return () => document.removeEventListener("click", blockIncompleteTrainingChoice, true);
  }, [classChoiceState.featureSelections, playerMode, trainingChoiceGroups]);

  return <div className="npc-forge-section npc-forge-training-step">
    <div className="npc-forge-section-heading"><div><span>Training</span><h3>Skills, Expertise, and crafting professions</h3></div><p>Background grants are automatic. Class skills and crafting professions establish proficiency first; Expertise is assigned afterward.</p></div>
    <div className={`npc-forge-training-explainer ${playerMode ? "is-player" : ""}`}>
      <div><strong>Background grants</strong><span>{backgroundSkills.length ? `${backgroundSkills.length} skill${backgroundSkills.length === 1 ? "" : "s"} are already trained by the selected background. These do not use a Training choice.` : "This background does not list fixed skills."}</span></div>
      <div><strong>Training choices</strong><span>Choose exactly {totalTrainingChoices} total option{totalTrainingChoices === 1 ? "" : "s"} from the {selectedClass?.class_name || "class"} skill pool and crafting professions. {usedTrainingChoices}/{totalTrainingChoices} used.</span></div>
      {!playerMode ? <div><strong>Expertise</strong><span>NPC expertise can be assigned directly when building a bespoke NPC.</span></div> : null}
    </div>

    <div className="npc-forge-subheading mt-3">Background skills</div>
    <div className="npc-forge-chip-row">{backgroundSkills.length ? backgroundSkills.map((key) => <button key={key} type="button" className="is-fixed" onClick={() => onDetail({ type: "skill", key })}>{titleForSkill(key)}</button>) : <span className="is-fixed">No fixed background skills</span>}</div>

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

    <style jsx global>{`
      .npc-forge-training-explainer{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:4px}.npc-forge-training-explainer.is-player{grid-template-columns:repeat(2,minmax(0,1fr))}.npc-forge-training-explainer>div{display:grid;gap:5px;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.025)}.npc-forge-training-explainer strong{color:#fff;font-size:.75rem}.npc-forge-training-explainer span{color:rgba(255,255,255,.62);font-size:.69rem;line-height:1.45}.npc-forge-crafting-house-rule{margin-bottom:10px;padding:12px 14px;border-left:3px solid #58d6c7;border-radius:9px;background:rgba(88,214,199,.075)}.npc-forge-crafting-house-rule strong{color:#bffbf3}.npc-forge-crafting-house-rule p{margin:5px 0 0;color:rgba(255,255,255,.72);font-size:.75rem;line-height:1.58}@media(max-width:900px){.npc-forge-training-explainer,.npc-forge-training-explainer.is-player{grid-template-columns:1fr}}
    `}</style>
  </div>;
}

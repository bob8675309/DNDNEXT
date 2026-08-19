import { useEffect, useMemo, useRef } from "react";
import { ABILITY_LABELS, SKILL_DEFINITIONS } from "../utils/characterCreation";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import { sourceChoiceGroupComplete } from "../utils/playerForgeSourceChoices";
import NpcForgeClassFeatureChoices from "./NpcForgeClassFeatureChoices";
import NpcForgeSourceChoiceFields from "./NpcForgeSourceChoiceFields";
import NpcForgeTrainingStepBase from "./NpcForgeTrainingStepBase";
import { useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

const normalized = (value) => String(value ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const SKILL_BY_KEY = Object.freeze(Object.fromEntries(SKILL_DEFINITIONS.map((skill) => [skill.key, skill])));
const TRAINING_ASSET_ROOT = "/ui/forge/training";
const PROFESSION_ICON = Object.freeze({
  alchemy: `${TRAINING_ASSET_ROOT}/profession-alchemy.svg`,
  smithing: `${TRAINING_ASSET_ROOT}/profession-smithing.svg`,
  scribe: `${TRAINING_ASSET_ROOT}/profession-scribe.svg`,
  enchanting: `${TRAINING_ASSET_ROOT}/profession-enchanting.svg`,
});
const SOURCE_KIND_ICON = Object.freeze({
  tool: `${TRAINING_ASSET_ROOT}/choice-tool.svg`,
  instrument: `${TRAINING_ASSET_ROOT}/choice-instrument.svg`,
  language: `${TRAINING_ASSET_ROOT}/choice-language.svg`,
});

// Legacy validation markers are intentionally retained here while NPC Forge continues through NpcForgeTrainingStepBase:
// Background grants • Training choices • each uses one Training choice • Campaign crafting house rule • Short or Long Rest
// physical work site • successful DC check • properly deployed caravan workshop • Skills & Proficiencies • Feats & Class Abilities

function SummaryCard({ icon, label, value, note, state = "" }) {
  return <div className={`npc-forge-training-summary-card ${state ? `is-${state}` : ""}`}>
    <img src={`${TRAINING_ASSET_ROOT}/${icon}`} alt="" aria-hidden="true" />
    <span><strong>{label}</strong><small>{note}</small></span>
    <b>{value}</b>
  </div>;
}

function PlayerTrainingStep({
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
  onSetProfession,
  onDetail,
}) {
  const { state: classChoiceState, toggleFeatureOption } = useNpcForgeClassChoice();
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();
  const initialDetailSet = useRef(false);

  const selectedSkillKeys = useMemo(() => [...new Set([...backgroundSkills, ...selectedClassSkills])], [backgroundSkills, selectedClassSkills]);
  const eligibleExpertiseNames = selectedSkillKeys.map((key) => titleForSkill(key));
  const eligibleExpertiseKey = eligibleExpertiseNames.map(normalized).join("|");
  const eligibleExpertiseSet = useMemo(() => new Set(eligibleExpertiseNames.map(normalized)), [eligibleExpertiseKey]);
  const trainingChoiceGroups = useMemo(() => (classChoiceState.featureGroups || []).filter((group) => (group.placement || "class") === "training"), [classChoiceState.featureGroups]);
  const classAbilityGroups = useMemo(() => (classChoiceState.featureGroups || []).filter((group) => (group.placement || "class") === "class"), [classChoiceState.featureGroups]);
  const sourceTrainingGroups = useMemo(() => (sourceChoiceState.groups || []).filter((group) => group.placement === "training"), [sourceChoiceState.groups]);
  const sourceClassAbilityGroups = useMemo(() => (sourceChoiceState.groups || []).filter((group) => ["class", "advancement"].includes(group.placement)), [sourceChoiceState.groups]);

  const trainedProfessionCount = PROFESSION_KEYS.filter((key) => Number(professions?.[key]?.rank || 0) > 0).length;
  const totalTrainingChoices = Number(classSkillConfig?.totalCount ?? classSkillConfig?.count ?? 0);
  const usedTrainingChoices = selectedClassSkills.length + trainedProfessionCount;
  const remainingTrainingChoices = Math.max(0, totalTrainingChoices - usedTrainingChoices);

  const backgroundChoiceTarget = backgroundSkillChoices.reduce((total, group) => total + Number(group.count || 1), 0);
  const backgroundChoiceDone = backgroundSkillChoices.reduce((total, group) => total + Math.min(Number(group.count || 1), (backgroundSkillSelections?.[group.id] || []).length), 0);
  const backgroundGrantTarget = backgroundSkills.length + backgroundChoiceTarget;
  const backgroundGrantDone = backgroundSkills.length + backgroundChoiceDone;

  const incompleteBackgroundSkills = backgroundSkillChoices.some((group) => (backgroundSkillSelections?.[group.id] || []).length !== Number(group.count || 1));
  const incompleteTrainingFeature = trainingChoiceGroups.some((group) => group.required && (classChoiceState.featureSelections?.[group.id] || []).length !== Number(group.count || 0));
  const incompleteClassAbility = classAbilityGroups.some((group) => group.required && (classChoiceState.featureSelections?.[group.id] || []).length !== Number(group.count || 0));
  const incompleteSourceTraining = sourceTrainingGroups.some((group) => !sourceChoiceGroupComplete(group, sourceChoiceState.selections || {}));
  const incompleteSourceClassAbility = sourceClassAbilityGroups.some((group) => !sourceChoiceGroupComplete(group, sourceChoiceState.selections || {}));

  const requiredClassGroups = classAbilityGroups.filter((group) => group.required);
  const requiredSourceGroups = sourceClassAbilityGroups.filter((group) => group.required !== false);
  const featChoiceTarget = requiredClassGroups.length + requiredSourceGroups.length;
  const featChoiceDone = requiredClassGroups.filter((group) => (classChoiceState.featureSelections?.[group.id] || []).length === Number(group.count || 0)).length
    + requiredSourceGroups.filter((group) => sourceChoiceGroupComplete(group, sourceChoiceState.selections || {})).length;

  const sourceTrainingKinds = useMemo(() => {
    const kinds = new Set();
    sourceTrainingGroups.forEach((group) => (group.fields || []).forEach((field) => {
      if (SOURCE_KIND_ICON[field.kind]) kinds.add(field.kind);
    }));
    return [...kinds];
  }, [sourceTrainingGroups]);

  useEffect(() => {
    for (const group of trainingChoiceGroups) {
      if (group.kind !== "expertise") continue;
      for (const key of classChoiceState.featureSelections?.[group.id] || []) {
        const option = group.options?.find((candidate) => candidate.key === key);
        if (option && !eligibleExpertiseSet.has(normalized(option.name))) toggleFeatureOption(group.id, key);
      }
    }
  }, [classChoiceState.featureSelections, eligibleExpertiseKey, eligibleExpertiseSet, toggleFeatureOption, trainingChoiceGroups]);

  useEffect(() => {
    if (initialDetailSet.current) return;
    const key = selectedClassSkills[0] || backgroundSkills[0] || classSkillConfig?.options?.[0];
    if (!key) return;
    initialDetailSet.current = true;
    onDetail?.({ type: "skill", key });
  }, [backgroundSkills, classSkillConfig?.options, onDetail, selectedClassSkills]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    function blockIncompleteTrainingChoice(event) {
      const button = event.target?.closest?.("button");
      if (!button || button.textContent?.trim() !== "Continue") return;
      const incomplete = incompleteBackgroundSkills || incompleteTrainingFeature || incompleteClassAbility || incompleteSourceTraining || incompleteSourceClassAbility;
      if (!incomplete) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const host = button.closest(".npc-forge-modal-v2")?.querySelector(".npc-forge-training-player-layout");
      const target = host?.querySelector(".is-required");
      if (target?.tagName === "DETAILS") target.open = true;
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
    document.addEventListener("click", blockIncompleteTrainingChoice, true);
    return () => document.removeEventListener("click", blockIncompleteTrainingChoice, true);
  }, [incompleteBackgroundSkills, incompleteClassAbility, incompleteSourceClassAbility, incompleteSourceTraining, incompleteTrainingFeature]);

  const backgroundChoicePanel = backgroundSkillChoices.length ? <details className={`npc-forge-training-choice-section npc-forge-training-background-choice ${incompleteBackgroundSkills ? "is-required" : "is-complete"}`} defaultOpen={incompleteBackgroundSkills}>
    <summary><span><img src={`${TRAINING_ASSET_ROOT}/summary-background.svg`} alt="" aria-hidden="true" /><b>Background skill choice</b></span><em>{backgroundChoiceDone}/{backgroundChoiceTarget} chosen</em></summary>
    <div className="npc-forge-training-choice-body">
      {backgroundSkillChoices.map((group) => {
        const selected = backgroundSkillSelections?.[group.id] || [];
        return <section key={group.id}><div className="npc-forge-training-choice-head"><span>Choose {group.count} skill{Number(group.count || 1) === 1 ? "" : "s"}</span><small>{selected.length}/{group.count}</small></div><div className="npc-forge-training-option-grid">{(group.options || []).map((option) => <button key={option.key} type="button" className={selected.includes(option.key) ? "is-selected" : ""} onMouseEnter={() => onDetail?.({ type: "skill", key: option.key })} onFocus={() => onDetail?.({ type: "skill", key: option.key })} onClick={() => { onDetail?.({ type: "skill", key: option.key }); onToggleBackgroundSkill?.(group.id, option.key, group.count); }}>{option.label}</button>)}</div></section>;
      })}
    </div>
  </details> : null;

  return <div className="npc-forge-section npc-forge-training-step npc-forge-training-player-layout">
    <div className="npc-forge-training-summary" aria-label="Training progress">
      <SummaryCard icon="summary-background.svg" label="Background Grants" value={backgroundGrantTarget ? `${backgroundGrantDone}/${backgroundGrantTarget}` : "—"} note="Granted automatically" state={incompleteBackgroundSkills ? "required" : "complete"} />
      <SummaryCard icon="summary-skills.svg" label="Class Skills" value={`${selectedClassSkills.length}`} note={`${selectedClass?.class_name || "Class"} skill picks`} />
      <SummaryCard icon="summary-training.svg" label="Training Choices" value={`${usedTrainingChoices}/${totalTrainingChoices}`} note={`${remainingTrainingChoices} remaining`} state={remainingTrainingChoices === 0 ? "complete" : ""} />
      <SummaryCard icon="summary-feat.svg" label="Feat Choices" value={featChoiceTarget ? `${featChoiceDone}/${featChoiceTarget}` : "—"} note={featChoiceTarget ? "Required choices" : "No required pick"} state={(incompleteClassAbility || incompleteSourceClassAbility) ? "required" : "complete"} />
    </div>

    <div className="npc-forge-training-picks">
      {backgroundSkills.length ? <div className="npc-forge-training-fixed-grants"><span>Background skills</span><div>{backgroundSkills.map((key) => <button key={key} type="button" onMouseEnter={() => onDetail?.({ type: "skill", key })} onFocus={() => onDetail?.({ type: "skill", key })} onClick={() => onDetail?.({ type: "skill", key })}>{titleForSkill(key)}<small>Granted</small></button>)}</div></div> : null}
      {backgroundChoicePanel}

      <section className="npc-forge-training-pick-group">
        <div className="npc-forge-training-group-head"><span><img src={`${TRAINING_ASSET_ROOT}/summary-skills.svg`} alt="" aria-hidden="true" /><b>Class Skills</b></span><small>{selectedClassSkills.length} selected • {remainingTrainingChoices} Training choice{remainingTrainingChoices === 1 ? "" : "s"} remaining</small></div>
        <div className="npc-forge-training-skill-list">{(classSkillConfig?.options || []).map((key) => {
          const selected = selectedClassSkills.includes(key);
          const backgroundGranted = backgroundSkills.includes(key);
          const disabled = !selected && !backgroundGranted && remainingTrainingChoices <= 0;
          const definition = SKILL_BY_KEY[key];
          return <button key={key} type="button" disabled={disabled} className={`${selected ? "is-selected" : ""} ${backgroundGranted ? "is-background" : ""}`} onMouseEnter={() => onDetail?.({ type: "skill", key })} onFocus={() => onDetail?.({ type: "skill", key })} onClick={() => { onDetail?.({ type: "skill", key }); if (!backgroundGranted) onToggleClassSkill(key); }}><span><b>{titleForSkill(key)}</b><small>{ABILITY_LABELS[definition?.ability] || "Skill"}</small></span><em>{backgroundGranted ? "Background" : selected ? "Selected" : disabled ? "Full" : "Choose"}</em></button>;
        })}</div>
      </section>

      <details className={`npc-forge-training-choice-section ${(incompleteTrainingFeature || incompleteSourceTraining) ? "is-required" : ""}`} defaultOpen={incompleteTrainingFeature || incompleteSourceTraining}>
        <summary><span><img src={`${TRAINING_ASSET_ROOT}/summary-training.svg`} alt="" aria-hidden="true" /><b>Training Choices</b>{sourceTrainingKinds.length ? <i>{sourceTrainingKinds.map((kind) => <img key={kind} src={SOURCE_KIND_ICON[kind]} alt="" aria-hidden="true" />)}</i> : null}</span><em>{(incompleteTrainingFeature || incompleteSourceTraining) ? "Required" : "Open"}</em></summary>
        <div className="npc-forge-training-choice-body">
          {trainingChoiceGroups.length ? <NpcForgeClassFeatureChoices groups={classChoiceState.featureGroups || []} selections={classChoiceState.featureSelections || {}} level={classChoiceState.level || 1} onToggle={toggleFeatureOption} placement="training" eligibleOptionNames={eligibleExpertiseNames} heading="Feature-granted Training choices" description="These choices come from a feat, class feature, species, or other source. They do not silently become class-skill picks." /> : null}
          <NpcForgeSourceChoiceFields placement="training" title="Tool, instrument, language, and other Training choices" />
          {!trainingChoiceGroups.length && !sourceTrainingGroups.length ? <p className="npc-forge-training-empty">No additional Training-stage source choices are required for this character.</p> : null}
        </div>
      </details>

      <section className="npc-forge-training-pick-group npc-forge-training-crafting">
        <div className="npc-forge-training-group-head"><span><img src={`${TRAINING_ASSET_ROOT}/choice-tool.svg`} alt="" aria-hidden="true" /><b>Crafting Professions</b></span><small>{trainedProfessionCount} selected • each uses one Training choice</small></div>
        <div className="npc-forge-training-profession-grid">{PROFESSION_KEYS.map((key) => {
          const definition = PROFESSION_DEFINITIONS[key];
          const profession = professions?.[key] || { rank: 0, ability: definition.abilities[0], offersService: false };
          const trained = Number(profession.rank || 0) > 0;
          const cannotTrain = !trained && remainingTrainingChoices <= 0;
          return <article key={key} className={trained ? "is-selected" : ""} onMouseEnter={() => onDetail?.({ type: "profession", key })}>
            <button type="button" className="npc-forge-training-profession-main" disabled={cannotTrain} onFocus={() => onDetail?.({ type: "profession", key })} onClick={() => { onDetail?.({ type: "profession", key }); onSetProfession(key, "rank", trained ? 0 : 1); }}><img src={PROFESSION_ICON[key]} alt="" aria-hidden="true" /><span><b>{definition.label}</b><small>{definition.tool}</small></span><em>{trained ? "Selected" : cannotTrain ? "Full" : "Choose"}</em></button>
            {trained ? <label><span>Ability</span><select value={profession.ability} onFocus={() => onDetail?.({ type: "profession", key })} onChange={(event) => onSetProfession(key, "ability", event.target.value)}>{definition.abilities.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}</select></label> : null}
          </article>;
        })}</div>
        <p className="npc-forge-training-crafting-note">Campaign rule: a trained crafting profession uses one Training choice. Recipe-specific work sites and crafting times are handled by the Crafting system.</p>
      </section>

      <details className={`npc-forge-training-choice-section npc-forge-training-feat-section ${(incompleteClassAbility || incompleteSourceClassAbility) ? "is-required" : ""}`} defaultOpen={incompleteClassAbility || incompleteSourceClassAbility}>
        <summary><span><img src={`${TRAINING_ASSET_ROOT}/summary-feat.svg`} alt="" aria-hidden="true" /><b>Feat &amp; Class Choices</b></span><em>{featChoiceTarget ? `${featChoiceDone}/${featChoiceTarget}` : "Open"}</em></summary>
        <div className="npc-forge-training-choice-body">
          <NpcForgeClassFeatureChoices groups={classChoiceState.featureGroups || []} selections={classChoiceState.featureSelections || {}} level={classChoiceState.level || 1} onToggle={toggleFeatureOption} placement="class" heading="Class and subclass ability choices" description="Persistent class and subclass choices are made here. Spell selections remain on the Spells step." />
          <NpcForgeSourceChoiceFields placement="class" ownerType="feat" title="Feat-granted follow-up choices" />
          <NpcForgeSourceChoiceFields placement="advancement" title="Higher-level feat and Epic Boon decisions" />
        </div>
      </details>
    </div>

    <div className="npc-forge-training-help"><span>Need help?</span><p>Hover or focus a skill or profession to see its explanation in the panel on the right. You can revise choices until you continue.</p></div>

    <style jsx global>{`
      .npc-forge-body:has(.npc-forge-training-player-layout){grid-template-columns:minmax(420px,44fr) minmax(0,56fr)!important}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-workspace{padding:12px!important}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-preview{padding:12px 14px!important;background:radial-gradient(circle at 50% 0,rgba(126,72,199,.06),transparent 46%),#090b12}.npc-forge-training-player-layout{display:grid;gap:10px}.npc-forge-training-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.npc-forge-training-summary-card{display:grid;grid-template-columns:27px minmax(0,1fr) auto;gap:8px;align-items:center;min-width:0;padding:8px 9px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:linear-gradient(135deg,rgba(255,255,255,.035),rgba(126,72,199,.035))}.npc-forge-training-summary-card>img{width:25px;height:25px;object-fit:contain}.npc-forge-training-summary-card>span{display:grid;gap:1px;min-width:0}.npc-forge-training-summary-card strong{overflow:hidden;color:#f0e9ff;font-size:.64rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-summary-card small{overflow:hidden;color:rgba(255,255,255,.46);font-size:.51rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-summary-card>b{color:#fff;font-size:.74rem}.npc-forge-training-summary-card.is-required{border-color:rgba(243,191,99,.42)}.npc-forge-training-summary-card.is-complete>b{color:#9cece2}.npc-forge-training-picks{display:grid;gap:8px}.npc-forge-training-fixed-grants{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:center;padding:7px 9px;border:1px solid rgba(88,214,199,.16);border-radius:8px;background:rgba(88,214,199,.035)}.npc-forge-training-fixed-grants>span{color:rgba(255,255,255,.48);font-size:.55rem;font-weight:800;text-transform:uppercase}.npc-forge-training-fixed-grants>div{display:flex;flex-wrap:wrap;gap:5px}.npc-forge-training-fixed-grants button{display:flex;gap:6px;align-items:center;padding:4px 7px;border:1px solid rgba(88,214,199,.26);border-radius:999px;color:#c9fff7;background:rgba(88,214,199,.07);font-size:.62rem}.npc-forge-training-fixed-grants button small{color:rgba(201,255,247,.55);font-size:.48rem}.npc-forge-training-pick-group,.npc-forge-training-choice-section{border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(255,255,255,.022)}.npc-forge-training-pick-group{padding:9px}.npc-forge-training-group-head,.npc-forge-training-choice-section>summary{display:flex;align-items:center;justify-content:space-between;gap:10px}.npc-forge-training-group-head{margin-bottom:7px}.npc-forge-training-group-head>span,.npc-forge-training-choice-section>summary>span{display:flex;align-items:center;gap:7px;min-width:0}.npc-forge-training-group-head img,.npc-forge-training-choice-section>summary>span>img{width:20px;height:20px;object-fit:contain}.npc-forge-training-group-head b,.npc-forge-training-choice-section>summary b{color:#e7d9ff;font-size:.68rem;text-transform:uppercase;letter-spacing:.045em}.npc-forge-training-group-head small{color:rgba(255,255,255,.48);font-size:.55rem}.npc-forge-training-skill-list{display:grid;gap:4px}.npc-forge-training-skill-list>button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;min-height:34px;padding:6px 8px;border:1px solid rgba(255,255,255,.085);border-radius:7px;color:rgba(255,255,255,.78);background:rgba(3,5,10,.38);text-align:left}.npc-forge-training-skill-list>button>span{display:flex;align-items:baseline;gap:7px;min-width:0}.npc-forge-training-skill-list>button b{color:#fff;font-size:.68rem}.npc-forge-training-skill-list>button span small{color:rgba(255,255,255,.38);font-size:.52rem}.npc-forge-training-skill-list>button>em{padding:2px 6px;border-radius:999px;color:rgba(255,255,255,.46);background:rgba(255,255,255,.035);font-size:.49rem;font-style:normal}.npc-forge-training-skill-list>button.is-selected{border-color:rgba(168,108,255,.62);background:linear-gradient(90deg,rgba(126,72,199,.17),rgba(126,72,199,.045))}.npc-forge-training-skill-list>button.is-selected>em{color:#ddc9ff;background:rgba(126,72,199,.18)}.npc-forge-training-skill-list>button.is-background{border-color:rgba(88,214,199,.28)}.npc-forge-training-skill-list>button:disabled{opacity:.46}.npc-forge-training-choice-section{overflow:hidden}.npc-forge-training-choice-section>summary{list-style:none;cursor:pointer;padding:8px 9px}.npc-forge-training-choice-section>summary::-webkit-details-marker{display:none}.npc-forge-training-choice-section>summary em{padding:2px 6px;border-radius:999px;color:#d8c2fb;background:rgba(126,72,199,.11);font-size:.5rem;font-style:normal}.npc-forge-training-choice-section.is-required{border-color:rgba(243,191,99,.48);box-shadow:inset 3px 0 rgba(243,191,99,.72)}.npc-forge-training-choice-section.is-required>summary em{color:#ffe0a0;background:rgba(243,191,99,.1)}.npc-forge-training-choice-section>summary i{display:flex;gap:3px;margin-left:3px}.npc-forge-training-choice-section>summary i img{width:15px;height:15px;opacity:.8}.npc-forge-training-choice-body{display:grid;gap:8px;padding:8px 9px 10px;border-top:1px solid rgba(255,255,255,.07)}.npc-forge-training-choice-head{display:flex;justify-content:space-between;color:#fff;font-size:.64rem}.npc-forge-training-choice-head small{color:rgba(255,255,255,.5)}.npc-forge-training-option-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:6px}.npc-forge-training-option-grid button{padding:7px 8px;border:1px solid rgba(255,255,255,.09);border-radius:6px;color:rgba(255,255,255,.75);background:rgba(0,0,0,.2);font-size:.62rem;text-align:left}.npc-forge-training-option-grid button.is-selected{border-color:#a86cff;color:#fff;background:rgba(126,72,199,.18)}.npc-forge-training-empty{margin:0;color:rgba(255,255,255,.52);font-size:.64rem}.npc-forge-training-profession-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.npc-forge-training-profession-grid article{display:grid;gap:5px;padding:5px;border:1px solid rgba(255,255,255,.08);border-radius:7px;background:rgba(0,0,0,.18)}.npc-forge-training-profession-grid article.is-selected{border-color:rgba(88,214,199,.48);background:rgba(88,214,199,.055)}.npc-forge-training-profession-main{display:grid;grid-template-columns:25px minmax(0,1fr);gap:6px;align-items:center;padding:0;border:0;color:inherit;background:transparent;text-align:left}.npc-forge-training-profession-main>img{width:24px;height:24px;object-fit:contain}.npc-forge-training-profession-main>span{display:grid;min-width:0}.npc-forge-training-profession-main b{color:#fff;font-size:.61rem}.npc-forge-training-profession-main small{overflow:hidden;color:rgba(255,255,255,.4);font-size:.47rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-profession-main em{grid-column:1/-1;justify-self:start;padding:1px 5px;border-radius:999px;color:#cbb4ee;background:rgba(126,72,199,.1);font-size:.46rem;font-style:normal}.npc-forge-training-profession-grid article.is-selected .npc-forge-training-profession-main em{color:#bffbf3;background:rgba(88,214,199,.1)}.npc-forge-training-profession-grid article label{display:grid;gap:2px}.npc-forge-training-profession-grid article label span{color:rgba(255,255,255,.42);font-size:.46rem;text-transform:uppercase}.npc-forge-training-profession-grid select{min-width:0;width:100%;padding:4px 5px;border:1px solid rgba(255,255,255,.12);border-radius:5px;color:#fff;background:#090b12;font-size:.54rem}.npc-forge-training-crafting-note{margin:7px 0 0;color:rgba(255,255,255,.44);font-size:.54rem;line-height:1.4}.npc-forge-training-help{display:flex;gap:8px;align-items:flex-start;padding:7px 9px;border-left:3px solid #58d6c7;border-radius:7px;background:rgba(88,214,199,.055)}.npc-forge-training-help span{color:#c9fff7;font-size:.6rem;font-weight:800}.npc-forge-training-help p{margin:0;color:rgba(255,255,255,.5);font-size:.56rem;line-height:1.4}.npc-forge-training-choice-body .npc-forge-feature-choice-group,.npc-forge-training-choice-body .npc-forge-source-choice-group{margin-top:0!important}.npc-forge-training-choice-body .npc-forge-subheading{margin-top:0!important}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-context-card.is-training{min-height:100%;align-content:start}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-context-card.is-training>p{font-size:.82rem;line-height:1.65}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-context-note{margin-top:12px}@media(max-width:1220px){.npc-forge-training-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.npc-forge-training-profession-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:980px){.npc-forge-body:has(.npc-forge-training-player-layout){grid-template-columns:1fr!important}.npc-forge-training-summary{grid-template-columns:repeat(4,minmax(0,1fr))}.npc-forge-training-profession-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:720px){.npc-forge-training-summary,.npc-forge-training-profession-grid,.npc-forge-training-option-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `}</style>
  </div>;
}

export default function NpcForgeTrainingStep(props) {
  if (!props.playerMode) return <NpcForgeTrainingStepBase {...props} />;
  return <PlayerTrainingStep {...props} />;
}

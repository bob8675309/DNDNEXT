import { useEffect, useMemo, useRef } from "react";
import { FaBookOpen, FaEye, FaLeaf, FaMagic, FaPlusCircle, FaSearch } from "react-icons/fa";
import { ABILITY_LABELS, SKILL_DEFINITIONS } from "../utils/characterCreation";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";
import { sourceChoiceGroupComplete } from "../utils/playerForgeSourceChoices";
import NpcForgeClassFeatureChoices from "./NpcForgeClassFeatureChoices";
import NpcForgeSourceChoiceFields from "./NpcForgeSourceChoiceFields";
import NpcForgeTrainingStepBase from "./NpcForgeTrainingStepBase";
import { useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import { useNpcForgeControllerContext } from "./NpcForgeControllerContext";

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
const SKILL_ICON = Object.freeze({
  arcana: FaMagic,
  history: FaBookOpen,
  investigation: FaSearch,
  perception: FaEye,
  medicine: FaPlusCircle,
  nature: FaLeaf,
});

function SkillGlyph({ skillKey }) {
  const Icon = SKILL_ICON[skillKey] || FaBookOpen;
  return <span className="npc-forge-training-skill-icon" aria-hidden="true"><Icon focusable="false" /></span>;
}

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
  selectedClassSkills = [],
  professions = {},
  titleForSkill,
  onToggleClassSkill,
  onSetProfession,
  onDetail,
}) {
  const controller = useNpcForgeControllerContext() || {};
  const { state: classChoiceState, toggleFeatureOption } = useNpcForgeClassChoice();
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();
  const initialDetailSet = useRef(false);

  const speciesBonus = controller.draft?.speciesBonus || {};
  const bonusFeatRequired = speciesBonus.mode === "feat";
  const selectedBonusFeat = controller.speciesBonusFeat || null;
  const featOptions = controller.featOptions || [];

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
  const incompleteBonusFeat = bonusFeatRequired && !selectedBonusFeat;

  const requiredClassGroups = classAbilityGroups.filter((group) => group.required);
  const requiredSourceGroups = sourceClassAbilityGroups.filter((group) => group.required !== false);
  const featChoiceTarget = requiredClassGroups.length + requiredSourceGroups.length + (bonusFeatRequired ? 1 : 0);
  const featChoiceDone = requiredClassGroups.filter((group) => (classChoiceState.featureSelections?.[group.id] || []).length === Number(group.count || 0)).length
    + requiredSourceGroups.filter((group) => sourceChoiceGroupComplete(group, sourceChoiceState.selections || {})).length
    + (bonusFeatRequired && selectedBonusFeat ? 1 : 0);

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
      const incomplete = incompleteBackgroundSkills || incompleteTrainingFeature || incompleteClassAbility || incompleteSourceTraining || incompleteSourceClassAbility || incompleteBonusFeat;
      if (!incomplete) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (incompleteBonusFeat) controller.setError?.("Choose your Bonus Feat in Training before continuing.");
      const host = button.closest(".npc-forge-modal-v2")?.querySelector(".npc-forge-training-player-layout");
      const target = host?.querySelector(".is-required");
      if (target?.tagName === "DETAILS") target.open = true;
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
    document.addEventListener("click", blockIncompleteTrainingChoice, true);
    return () => document.removeEventListener("click", blockIncompleteTrainingChoice, true);
  }, [controller, incompleteBackgroundSkills, incompleteBonusFeat, incompleteClassAbility, incompleteSourceClassAbility, incompleteSourceTraining, incompleteTrainingFeature]);

  const backgroundChoicePanel = backgroundSkillChoices.length ? <details className={`npc-forge-training-choice-section npc-forge-training-background-choice ${incompleteBackgroundSkills ? "is-required" : "is-complete"}`} defaultOpen={incompleteBackgroundSkills}>
    <summary><span><img src={`${TRAINING_ASSET_ROOT}/summary-background.svg`} alt="" aria-hidden="true" /><b>Background skill choices</b></span><em>{backgroundChoiceDone}/{backgroundChoiceTarget} chosen</em></summary>
    <div className="npc-forge-training-choice-body">
      <p className="npc-forge-training-route-note">Granted by the Background • do not use class Training choices.</p>
      {backgroundSkillChoices.map((group) => {
        const selected = backgroundSkillSelections?.[group.id] || [];
        return <section key={group.id}><div className="npc-forge-training-choice-head"><span>Choose {group.count} skill{Number(group.count || 1) === 1 ? "" : "s"}</span><small>{selected.length}/{group.count}</small></div><div className="npc-forge-training-option-grid">{(group.options || []).map((option) => <button key={option.key} type="button" className={selected.includes(option.key) ? "is-selected" : ""} onMouseEnter={() => onDetail?.({ type: "skill", key: option.key })} onFocus={() => onDetail?.({ type: "skill", key: option.key })} onClick={() => { onDetail?.({ type: "skill", key: option.key }); onToggleBackgroundSkill?.(group.id, option.key, group.count); }}>{option.label}</button>)}</div></section>;
      })}
    </div>
  </details> : null;

  return <div className="npc-forge-section npc-forge-training-step npc-forge-training-player-layout">
    <div className="npc-forge-training-summary" aria-label="Training progress">
      <SummaryCard icon="summary-background.svg" label="Background Grants" value={backgroundGrantTarget ? `${backgroundGrantDone}/${backgroundGrantTarget}` : "—"} note="Skills granted by your background" state={incompleteBackgroundSkills ? "required" : "complete"} />
      <SummaryCard icon="summary-skills.svg" label="Skills Selected" value={`${selectedClassSkills.length}`} note="Class skills chosen" />
      <SummaryCard icon="summary-training.svg" label="Training Choices" value={`${usedTrainingChoices}/${totalTrainingChoices}`} note="Skills or Trade Skills" state={remainingTrainingChoices === 0 ? "complete" : ""} />
      <SummaryCard icon="summary-feat.svg" label="Feat Choices" value={featChoiceTarget ? `${featChoiceDone}/${featChoiceTarget}` : "—"} note={bonusFeatRequired ? "Includes Bonus Feat" : featChoiceTarget ? "Class feat picks" : "No required pick"} state={(incompleteBonusFeat || incompleteClassAbility || incompleteSourceClassAbility) ? "required" : "complete"} />
    </div>

    <div className="npc-forge-training-picks">
      <header className="npc-forge-training-picks-head"><h3>Training Picks</h3><p>Choose skills, Trade Skills, and source-granted training below.</p></header>

      {backgroundSkills.length ? <div className="npc-forge-training-fixed-grants"><span>Background skills</span><div>{backgroundSkills.map((key) => <button key={key} type="button" onMouseEnter={() => onDetail?.({ type: "skill", key })} onFocus={() => onDetail?.({ type: "skill", key })} onClick={() => onDetail?.({ type: "skill", key })}>{titleForSkill(key)}<small>Granted</small></button>)}</div></div> : null}
      {backgroundChoicePanel}

      <section className="npc-forge-training-pick-group npc-forge-training-class-skills">
        <div className="npc-forge-training-group-head"><span><img src={`${TRAINING_ASSET_ROOT}/summary-skills.svg`} alt="" aria-hidden="true" /><b>Class Skills</b></span><small>{selectedClassSkills.length} selected • {remainingTrainingChoices} choice{remainingTrainingChoices === 1 ? "" : "s"} remaining</small></div>
        <div className="npc-forge-training-skill-list">{(classSkillConfig?.options || []).map((key) => {
          const selected = selectedClassSkills.includes(key);
          const backgroundGranted = backgroundSkills.includes(key);
          const disabled = !selected && !backgroundGranted && remainingTrainingChoices <= 0;
          const definition = SKILL_BY_KEY[key];
          return <button key={key} type="button" disabled={disabled} className={`${selected ? "is-selected" : ""} ${backgroundGranted ? "is-background" : ""}`} onMouseEnter={() => onDetail?.({ type: "skill", key })} onFocus={() => onDetail?.({ type: "skill", key })} onClick={() => { onDetail?.({ type: "skill", key }); if (!backgroundGranted) onToggleClassSkill(key); }}><SkillGlyph skillKey={key} /><span><b>{titleForSkill(key)}</b><small>{ABILITY_LABELS[definition?.ability] || "Skill"}</small></span><em>{backgroundGranted ? "B" : selected ? "✓" : "○"}</em></button>;
        })}</div>
      </section>

      <section className="npc-forge-training-pick-group npc-forge-training-trade-skills">
        <div className="npc-forge-training-group-head"><span><img src={`${TRAINING_ASSET_ROOT}/choice-tool.svg`} alt="" aria-hidden="true" /><b>Trade Skills</b></span><small>{trainedProfessionCount} selected • {remainingTrainingChoices} choice{remainingTrainingChoices === 1 ? "" : "s"} remaining</small></div>
        <p className="npc-forge-training-group-copy">Each Trade Skill uses one Training choice and includes proficiency with its listed tool. Tool proficiency alone does not unlock the Trade Skill.</p>
        <div className="npc-forge-training-trade-list">{PROFESSION_KEYS.map((key) => {
          const definition = PROFESSION_DEFINITIONS[key];
          const profession = professions?.[key] || { rank: 0, ability: definition.abilities[0], offersService: false };
          const trained = Number(profession.rank || 0) > 0;
          const cannotTrain = !trained && remainingTrainingChoices <= 0;
          return <article key={key} className={trained ? "is-selected" : ""} onMouseEnter={() => onDetail?.({ type: "profession", key })}>
            <button type="button" className="npc-forge-training-trade-main" disabled={cannotTrain} onFocus={() => onDetail?.({ type: "profession", key })} onClick={() => { onDetail?.({ type: "profession", key }); onSetProfession(key, "rank", trained ? 0 : 1); }}><img src={PROFESSION_ICON[key]} alt="" aria-hidden="true" /><span><b>{definition.label}</b><small>{definition.tool}</small></span><em>{trained ? "✓" : "○"}</em></button>
            {trained ? <label className="npc-forge-training-trade-ability"><span>Ability</span><select value={profession.ability} onFocus={() => onDetail?.({ type: "profession", key })} onChange={(event) => onSetProfession(key, "ability", event.target.value)}>{definition.abilities.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}</select></label> : null}
          </article>;
        })}</div>
      </section>

      <details className={`npc-forge-training-choice-section npc-forge-training-source-section ${(incompleteTrainingFeature || incompleteSourceTraining) ? "is-required" : ""}`}>
        <summary><span><img src={`${TRAINING_ASSET_ROOT}/summary-training.svg`} alt="" aria-hidden="true" /><b>Training Choices</b>{sourceTrainingKinds.length ? <i>{sourceTrainingKinds.map((kind) => <img key={kind} src={SOURCE_KIND_ICON[kind]} alt="" aria-hidden="true" />)}</i> : null}</span><em>{(incompleteTrainingFeature || incompleteSourceTraining) ? "Required" : "Open"}</em></summary>
        <div className="npc-forge-training-choice-body">
          {trainingChoiceGroups.length ? <NpcForgeClassFeatureChoices groups={classChoiceState.featureGroups || []} selections={classChoiceState.featureSelections || {}} level={classChoiceState.level || 1} onToggle={toggleFeatureOption} placement="training" eligibleOptionNames={eligibleExpertiseNames} heading="Feature-granted Training choices" description="These choices come from a feat, class feature, species, or other source. They do not silently become class-skill picks." /> : null}
          <NpcForgeSourceChoiceFields placement="training" inline title="Tool, instrument, language, and other Training choices" />
          {!trainingChoiceGroups.length && !sourceTrainingGroups.length ? <p className="npc-forge-training-empty">No additional Training-stage source choices are required for this character.</p> : null}
        </div>
      </details>

      <details className={`npc-forge-training-choice-section npc-forge-training-feat-section ${(incompleteBonusFeat || incompleteClassAbility || incompleteSourceClassAbility) ? "is-required" : ""}`} defaultOpen={incompleteBonusFeat}>
        <summary><span><img src={`${TRAINING_ASSET_ROOT}/summary-feat.svg`} alt="" aria-hidden="true" /><b>Feat &amp; Class Choices</b></span><em>{featChoiceTarget ? `${featChoiceDone}/${featChoiceTarget}` : "Open"}</em></summary>
        <div className="npc-forge-training-choice-body">
          {bonusFeatRequired ? <label className="npc-forge-training-bonus-feat"><span>Bonus Feat</span><select value={speciesBonus.featId || ""} onChange={(event) => controller.setSpeciesBonus?.({ featId: event.target.value })}><option value="">Choose feat…</option>{featOptions.map((feat) => <option key={feat.id} value={feat.id}>{feat.name} • {feat.category || feat.source || "Feat"}</option>)}</select><small>This is the Bonus Feat package chosen in Abilities. Any permanent choices owned by the selected feat appear below.</small></label> : null}
          <NpcForgeClassFeatureChoices groups={classChoiceState.featureGroups || []} selections={classChoiceState.featureSelections || {}} level={classChoiceState.level || 1} onToggle={toggleFeatureOption} placement="class" heading="Class and subclass ability choices" description="Persistent class and subclass choices are made here. Spell selections remain on the Spells step." />
          <NpcForgeSourceChoiceFields placement="class" ownerType="feat" inline title="Feat-granted follow-up choices" />
          <NpcForgeSourceChoiceFields placement="advancement" inline title="Higher-level feat and Epic Boon decisions" />
        </div>
      </details>
    </div>

    <div className="npc-forge-training-help"><span>ⓘ</span><div><strong>Need help?</strong><p>Hover any Skill or Trade Skill to learn more in Current Selection. You can revise choices until you continue.</p></div></div>

    {/* Compatibility/source-authority markers for Forge validation:
      Background grants • Training choices • each uses one Training choice • Campaign crafting house rule
      Short or Long Rest • physical work site • successful DC check • properly deployed caravan workshop
      Skills & Proficiencies • Feats & Class Abilities • Assign Expertise after proficiency is established
      Trade Skills include their associated tool proficiency; tool proficiency alone does not unlock a Trade Skill.
    */}

    <style jsx global>{`
      .npc-forge-modal-v2:has(.npc-forge-training-player-layout){width:min(1260px,calc(100vw - 32px))!important;max-width:1260px!important}.npc-forge-body:has(.npc-forge-training-player-layout){grid-template-columns:minmax(450px,43fr) minmax(0,57fr)!important}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-workspace{padding:14px 12px!important;background:linear-gradient(180deg,rgba(126,72,199,.025),transparent 26%)}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-preview{padding:14px 16px!important;background:radial-gradient(circle at 40% 0,rgba(126,72,199,.055),transparent 44%),#0a0d15}.npc-forge-training-player-layout{display:grid;gap:11px}.npc-forge-training-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(255,255,255,.018);overflow:hidden}.npc-forge-training-summary-card{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:10px;align-items:center;min-width:0;padding:12px 14px;border-right:1px solid rgba(255,255,255,.075);background:linear-gradient(135deg,rgba(255,255,255,.02),rgba(126,72,199,.018))}.npc-forge-training-summary-card:last-child{border-right:0}.npc-forge-training-summary-card>img{width:28px;height:28px;object-fit:contain}.npc-forge-training-summary-card>span{display:grid;gap:2px;min-width:0}.npc-forge-training-summary-card strong{overflow:hidden;color:#f3efff;font-size:.68rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-summary-card small{overflow:hidden;color:rgba(255,255,255,.47);font-size:.53rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-summary-card>b{color:#fff;font-size:.72rem}.npc-forge-training-summary-card.is-required{box-shadow:inset 0 -2px rgba(243,191,99,.5)}.npc-forge-training-summary-card.is-complete>b{color:#9cece2}.npc-forge-training-picks{display:grid;gap:8px;padding:12px 14px 13px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:linear-gradient(135deg,rgba(255,255,255,.025),rgba(126,72,199,.025))}.npc-forge-training-picks-head{display:grid;gap:2px;margin-bottom:1px}.npc-forge-training-picks-head h3{margin:0;color:#fff;font-size:.82rem}.npc-forge-training-picks-head p{margin:0;color:rgba(255,255,255,.54);font-size:.59rem}.npc-forge-training-fixed-grants{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.055)}.npc-forge-training-fixed-grants>span{color:rgba(255,255,255,.42);font-size:.5rem;font-weight:900;text-transform:uppercase}.npc-forge-training-fixed-grants>div{display:flex;flex-wrap:wrap;gap:5px}.npc-forge-training-fixed-grants button{display:flex;gap:6px;align-items:center;padding:3px 7px;border:1px solid rgba(88,214,199,.22);border-radius:999px;color:#c9fff7;background:rgba(88,214,199,.055);font-size:.56rem}.npc-forge-training-fixed-grants button small{color:rgba(201,255,247,.48);font-size:.44rem}.npc-forge-training-pick-group,.npc-forge-training-choice-section{border:0;border-radius:0;background:transparent}.npc-forge-training-pick-group{padding:2px 0}.npc-forge-training-group-head,.npc-forge-training-choice-section>summary{display:flex;align-items:center;justify-content:space-between;gap:10px}.npc-forge-training-group-head{margin-bottom:5px}.npc-forge-training-group-head>span,.npc-forge-training-choice-section>summary>span{display:flex;align-items:center;gap:7px;min-width:0}.npc-forge-training-group-head img,.npc-forge-training-choice-section>summary>span>img{width:18px;height:18px;object-fit:contain}.npc-forge-training-group-head b,.npc-forge-training-choice-section>summary b{color:#ba87ff;font-size:.58rem;text-transform:uppercase;letter-spacing:.055em}.npc-forge-training-group-head small{color:rgba(255,255,255,.48);font-size:.5rem}.npc-forge-training-skill-list,.npc-forge-training-trade-list{display:grid;gap:3px}.npc-forge-training-skill-list>button,.npc-forge-training-trade-list>article{min-height:32px;border:1px solid rgba(255,255,255,.085);border-radius:6px;background:rgba(3,5,10,.3)}.npc-forge-training-skill-list>button{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:8px;align-items:center;padding:5px 8px;color:rgba(255,255,255,.78);text-align:left}.npc-forge-training-skill-icon{display:grid;place-items:center;width:22px;height:22px;color:#aa72ff;font-size:.77rem}.npc-forge-training-skill-list>button>span{display:flex;align-items:baseline;gap:7px;min-width:0}.npc-forge-training-skill-list>button b{color:#fff;font-size:.63rem}.npc-forge-training-skill-list>button span small{color:rgba(255,255,255,.38);font-size:.47rem}.npc-forge-training-skill-list>button>em,.npc-forge-training-trade-main>em{display:grid;place-items:center;width:17px;height:17px;border:1px solid rgba(255,255,255,.18);border-radius:50%;color:rgba(255,255,255,.42);font-size:.52rem;font-style:normal}.npc-forge-training-skill-list>button.is-selected{border-color:rgba(168,108,255,.66);background:linear-gradient(90deg,rgba(126,72,199,.16),rgba(126,72,199,.035))}.npc-forge-training-skill-list>button.is-selected>em{border-color:#8d58ff;color:#0b0912;background:#8d58ff}.npc-forge-training-skill-list>button.is-background{border-color:rgba(88,214,199,.26)}.npc-forge-training-skill-list>button:disabled,.npc-forge-training-trade-main:disabled{opacity:.46}.npc-forge-training-group-copy{margin:-1px 0 5px;color:rgba(255,255,255,.48);font-size:.5rem;line-height:1.4}.npc-forge-training-trade-list>article{display:grid;grid-template-columns:minmax(0,1fr) 116px;gap:7px;align-items:center;padding:4px 7px}.npc-forge-training-trade-list>article.is-selected{border-color:rgba(88,214,199,.48);background:linear-gradient(90deg,rgba(88,214,199,.075),rgba(88,214,199,.02))}.npc-forge-training-trade-main{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:8px;align-items:center;min-width:0;padding:0;border:0;color:rgba(255,255,255,.78);background:transparent;text-align:left}.npc-forge-training-trade-main>img{width:22px;height:22px;object-fit:contain}.npc-forge-training-trade-main>span{display:flex;align-items:baseline;gap:7px;min-width:0}.npc-forge-training-trade-main b{color:#fff;font-size:.63rem}.npc-forge-training-trade-main small{overflow:hidden;color:rgba(255,255,255,.4);font-size:.47rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-trade-list>article.is-selected .npc-forge-training-trade-main>em{border-color:#58d6c7;color:#07110f;background:#58d6c7}.npc-forge-training-trade-ability{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px;align-items:center}.npc-forge-training-trade-ability>span{color:rgba(255,255,255,.4);font-size:.44rem;text-transform:uppercase}.npc-forge-training-trade-ability select{min-width:0;width:100%;padding:3px 5px;border:1px solid rgba(255,255,255,.12);border-radius:5px;color:#fff;background:#090b12;font-size:.5rem}.npc-forge-training-choice-section{overflow:hidden;border-top:1px solid rgba(255,255,255,.055)}.npc-forge-training-choice-section>summary{list-style:none;cursor:pointer;padding:8px 0 6px}.npc-forge-training-choice-section>summary::-webkit-details-marker{display:none}.npc-forge-training-choice-section>summary em{padding:2px 6px;border-radius:999px;color:#d8c2fb;background:rgba(126,72,199,.1);font-size:.47rem;font-style:normal}.npc-forge-training-choice-section.is-required>summary em{color:#ffe0a0;background:rgba(243,191,99,.1)}.npc-forge-training-choice-section>summary i{display:flex;gap:3px;margin-left:3px}.npc-forge-training-choice-section>summary i img{width:14px;height:14px;opacity:.82}.npc-forge-training-choice-body{display:grid;gap:8px;padding:7px 0 4px}.npc-forge-training-choice-head{display:flex;justify-content:space-between;color:#fff;font-size:.6rem}.npc-forge-training-choice-head small{color:rgba(255,255,255,.5)}.npc-forge-training-route-note{margin:0;color:rgba(255,255,255,.5);font-size:.54rem}.npc-forge-training-option-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:6px}.npc-forge-training-option-grid button{padding:6px 8px;border:1px solid rgba(255,255,255,.09);border-radius:6px;color:rgba(255,255,255,.75);background:rgba(0,0,0,.2);font-size:.57rem;text-align:left}.npc-forge-training-option-grid button.is-selected{border-color:#a86cff;color:#fff;background:rgba(126,72,199,.18)}.npc-forge-training-empty{margin:0;color:rgba(255,255,255,.52);font-size:.59rem}.npc-forge-training-bonus-feat{display:grid;gap:4px;padding:8px 9px;border:1px solid rgba(243,191,99,.28);border-radius:7px;background:rgba(243,191,99,.045)}.npc-forge-training-bonus-feat>span{color:#ffe0a0;font-size:.58rem;font-weight:800;text-transform:uppercase}.npc-forge-training-bonus-feat select{width:100%;min-width:0}.npc-forge-training-bonus-feat small{color:rgba(255,255,255,.5);font-size:.51rem;line-height:1.45}.npc-forge-training-help{display:flex;gap:9px;align-items:flex-start;padding:8px 10px;border-top:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.5)}.npc-forge-training-help>span{color:#aeb9df;font-size:.76rem}.npc-forge-training-help>div{display:grid;gap:1px}.npc-forge-training-help strong{color:#fff;font-size:.61rem}.npc-forge-training-help p{margin:0;color:rgba(255,255,255,.5);font-size:.5rem}.npc-forge-training-player-layout .npc-forge-source-choices{gap:7px;margin-top:0}.npc-forge-training-player-layout .npc-forge-source-choices__heading{display:none}.npc-forge-training-player-layout .npc-forge-source-choice-group{gap:7px;padding:8px 9px;border-radius:7px}.npc-forge-training-player-layout .npc-forge-source-choice-group>header strong{font-size:.66rem}.npc-forge-training-player-layout .npc-forge-source-choice-group>header small{font-size:.52rem}.npc-forge-training-player-layout .npc-forge-source-choice-field>span,.npc-forge-training-player-layout .npc-forge-source-choice-slots label>span{font-size:.54rem}.npc-forge-training-player-layout .npc-forge-source-choice-slots{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.npc-forge-training-player-layout .npc-forge-rich-choice__grid{grid-template-columns:1fr!important}.npc-forge-training-player-layout .npc-forge-rich-choice__head{grid-template-columns:1fr!important}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-context-panel{overflow:auto}.npc-forge-body:has(.npc-forge-training-player-layout) .npc-forge-training-context-dossier{min-height:100%}@media(max-width:1180px){.npc-forge-modal-v2:has(.npc-forge-training-player-layout){width:calc(100vw - 24px)!important;max-width:none!important}.npc-forge-body:has(.npc-forge-training-player-layout){grid-template-columns:minmax(400px,47fr) minmax(0,53fr)!important}.npc-forge-training-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.npc-forge-training-summary-card:nth-child(2){border-right:0}.npc-forge-training-summary-card:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.075)}}@media(max-width:900px){.npc-forge-body:has(.npc-forge-training-player-layout){grid-template-columns:1fr!important}.npc-forge-training-summary{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:720px){.npc-forge-training-summary,.npc-forge-training-option-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.npc-forge-training-trade-list>article{grid-template-columns:1fr}.npc-forge-training-trade-ability{padding-left:32px}}
    `}</style>
  </div>;
}

export default function NpcForgeTrainingStep(props) {
  if (!props.playerMode) return <NpcForgeTrainingStepBase {...props} />;
  return <PlayerTrainingStep {...props} />;
}

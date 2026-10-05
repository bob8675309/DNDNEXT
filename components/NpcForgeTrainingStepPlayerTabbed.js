import { useEffect, useMemo, useRef, useState } from "react";
import { TRADE_SKILL_KEYS } from "../utils/craftingProfessions";
import { selectedSourceChoiceOptions, sourceChoiceFieldIsActive, sourceChoiceGroupComplete } from "../utils/playerForgeSourceChoices";
import { activeClassFeatureGroups } from "../utils/classFeatureChoices";
import { useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import { useNpcForgeControllerContext } from "./NpcForgeControllerContext";
import { sourceChoiceGroupsForPlacement, sourceChoiceGroupsForResolverPlacement, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import NpcForgeTrainingStepPlayer from "./NpcForgeTrainingStepPlayer";

const TRAINING_ASSET_ROOT = "/ui/forge/training";
function classGroupsIncomplete(groups = [], selections = {}) {
  return groups.some((group) => group?.required && (selections?.[group.id] || []).length !== Number(group.count || 0));
}

function classGroupProgress(groups = [], selections = {}) {
  return groups.reduce((progress, group) => {
    const target = Math.max(0, Number(group?.count || 0));
    const done = Math.min(target, (selections?.[group.id] || []).length);
    return { target: progress.target + target, done: progress.done + done };
  }, { target: 0, done: 0 });
}

function sourceGroupProgress(groups = [], selections = {}) {
  return groups.reduce((progress, group) => {
    const requiredFields = (group?.fields || []).filter((field) => field?.required !== false && sourceChoiceFieldIsActive(field, selections));
    const target = requiredFields.reduce((total, field) => total + Math.max(1, Number(field?.count || 1)), 0);
    const done = requiredFields.reduce((total, field) => total + Math.min(Math.max(1, Number(field?.count || 1)), (selections?.[group.id]?.[field.id] || []).length), 0);
    return { target: progress.target + target, done: progress.done + done };
  }, { target: 0, done: 0 });
}

function titleCase(value = "") {
  return String(value || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

function playerList(values = []) {
  const list = values.filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}


export default function NpcForgeTrainingStepPlayerTabbed(props) {
  const [activeView, setActiveView] = useState("skills");
  const shellRef = useRef(null);
  const controller = useNpcForgeControllerContext() || {};
  const { state: classChoiceState } = useNpcForgeClassChoice();
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();

  const classGroups = classChoiceState.featureGroups || [];
  const classSelections = classChoiceState.featureSelections || {};
  const sourceSelections = sourceChoiceState.selections || {};
  const activeClassGroups = useMemo(() => activeClassFeatureGroups(classGroups, classSelections), [classGroups, classSelections]);

  const trainingClassGroups = useMemo(() => activeClassGroups.filter((group) => (group.placement || "class") === "training"), [activeClassGroups]);
  const classFeatureGroups = useMemo(() => activeClassGroups.filter((group) => (group.placement || "class") === "class"), [activeClassGroups]);
  const resolverTrainingGroups = useMemo(() => sourceChoiceGroupsForResolverPlacement(sourceChoiceState, "training"), [sourceChoiceState]);
  const trainingSourceGroups = useMemo(() => resolverTrainingGroups.filter((group) => (
    group.placement === "training"
    && (group.ownerType !== "feat" || Boolean(group.metadata?.proficiencyFeat))
  )), [resolverTrainingGroups]);
  const featSourceGroups = useMemo(() => resolverTrainingGroups.filter((group) => (
    group.ownerType === "feat" && !group.metadata?.proficiencyFeat
  )), [resolverTrainingGroups]);
  const classSourceGroups = useMemo(() => {
    const routed = resolverTrainingGroups.filter((group) => group.ownerType !== "feat" && ["class", "advancement"].includes(group.placement));
    const classOptions = sourceChoiceGroupsForPlacement(sourceChoiceState, "class").filter((group) => group.ownerType === "class-option");
    const byId = new Map([...routed, ...classOptions].map((group) => [group.id, group]));
    return [...byId.values()];
  }, [resolverTrainingGroups, sourceChoiceState]);

  const sourceGrantedTradeSkills = new Set(controller.sourceGrantedTradeSkillKeys || []);
  const trainedTradeSkills = TRADE_SKILL_KEYS.filter((key) => Number(props.professions?.[key]?.rank || 0) > 0);
  const paidTradeSkills = trainedTradeSkills.filter((key) => !sourceGrantedTradeSkills.has(key));
  const sharedChoiceTarget = Number(props.classSkillConfig?.totalCount ?? props.classSkillConfig?.count ?? 0);
  const sharedChoiceDone = (props.selectedClassSkills || []).length + paidTradeSkills.length;
  const incompleteSharedChoices = sharedChoiceDone !== sharedChoiceTarget;

  const backgroundChoiceTarget = (props.backgroundSkillChoices || []).reduce((total, group) => total + Number(group.count || 1), 0);
  const backgroundChoiceDone = (props.backgroundSkillChoices || []).reduce((total, group) => total + Math.min(Number(group.count || 1), (props.backgroundSkillSelections?.[group.id] || []).length), 0);
  const incompleteBackgroundChoices = backgroundChoiceDone !== backgroundChoiceTarget;
  const incompleteTrainingClass = classGroupsIncomplete(trainingClassGroups, classSelections);
  const incompleteTrainingSource = trainingSourceGroups.some((group) => !sourceChoiceGroupComplete(group, sourceSelections));

  const bonusFeatRequired = controller.draft?.speciesBonus?.mode === "feat";
  const incompleteBonusFeat = bonusFeatRequired && !controller.speciesBonusFeat;
  const incompleteFeatSource = featSourceGroups.some((group) => !sourceChoiceGroupComplete(group, sourceSelections));
  const incompleteClassFeature = classGroupsIncomplete(classFeatureGroups, classSelections);
  const incompleteClassSource = classSourceGroups.some((group) => !sourceChoiceGroupComplete(group, sourceSelections));

  const skillsIncomplete = incompleteBackgroundChoices || incompleteSharedChoices || incompleteTrainingClass || incompleteTrainingSource;
  const featsIncomplete = incompleteBonusFeat || incompleteFeatSource;
  const classChoicesIncomplete = incompleteClassFeature || incompleteClassSource;
  const featsHaveChoices = bonusFeatRequired || featSourceGroups.length > 0 || Boolean(controller.selectedBackgroundFeat);
  const classChoicesHaveChoices = classFeatureGroups.length > 0 || classSourceGroups.length > 0;

  useEffect(() => {
    if (!["feats", "class"].includes(activeView)) return;
    const featSection = shellRef.current?.querySelector("details.npc-forge-training-feat-section");
    if (featSection) featSection.open = true;
  }, [activeView, controller.speciesBonusFeat, classSelections, sourceSelections]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    function routeContinueToUnfinishedView(event) {
      const button = event.target?.closest?.("button");
      if (!button || button.textContent?.trim() !== "Continue") return;
      if (incompleteBonusFeat) selectView("feats");
      else if (skillsIncomplete) selectView("skills");
      else if (featsIncomplete) selectView("feats");
      else if (classChoicesIncomplete) selectView("class");
    }
    window.addEventListener("click", routeContinueToUnfinishedView, true);
    return () => window.removeEventListener("click", routeContinueToUnfinishedView, true);
  }, [classChoicesIncomplete, featsIncomplete, incompleteBonusFeat, skillsIncomplete]);

  function overviewDetail(view) {
    const trainingProgress = classGroupProgress(trainingClassGroups, classSelections);
    const trainingSourceProgress = sourceGroupProgress(trainingSourceGroups, sourceSelections);
    const classProgress = classGroupProgress(classFeatureGroups, classSelections);
    const classSourceProgress = sourceGroupProgress(classSourceGroups, sourceSelections);
    const featProgress = sourceGroupProgress(featSourceGroups, sourceSelections);
    const backgroundName = controller.selectedBackground?.name || controller.selectedBackground?.class_name || "Background";
    const className = controller.selectedClass?.class_name || controller.selectedClass?.name || "Class";
    const subclassName = controller.selectedSubclass?.name || "";
    const backgroundSourceSkillOptions = selectedSourceChoiceOptions(sourceChoiceState.groups || [], sourceSelections, { ownerType: "background" })
      .filter((option) => option.fieldKind === "skill" || option.kind === "skill");
    const backgroundSkillKeys = new Set([
      ...(props.backgroundSkills || []).map((value) => String(value || "").trim().toLowerCase()),
      ...(props.backgroundSkillChoices || []).flatMap((group) => (props.backgroundSkillSelections?.[group.id] || []).map((value) => String(value || "").trim().toLowerCase())),
      ...backgroundSourceSkillOptions.map((option) => String(option.value || option.label || option.key || "").trim().toLowerCase()),
    ].filter(Boolean));
    const backgroundFixed = backgroundSkillKeys.size;
    const backgroundSkillNames = [...backgroundSkillKeys].map(titleCase);
    const backgroundSkillSentence = backgroundSkillNames.length
      ? `Grants you access to the ${playerList(backgroundSkillNames)} Skill${backgroundSkillNames.length === 1 ? "" : "s"}.`
      : "Provides the skills listed by your Background.";
    const selectedBonusName = controller.speciesBonusFeat?.name || "";

    if (view === "feats") {
      return {
        type: "trainingOverview",
        view,
        icon: `${TRAINING_ASSET_ROOT}/summary-feat.svg`,
        title: "Feats",
        description: "Feat grants are kept separate from class feature choices. Click a feat in the catalogue to read it here, then confirm a selectable feat with the button in this panel.",
        metrics: [
          { label: "Bonus Feat", value: bonusFeatRequired ? (selectedBonusName ? "1/1" : "0/1") : "—", detail: bonusFeatRequired ? (selectedBonusName || "Selection required") : "No bonus-feat pick at this level" },
          { label: "Feat follow-ups", value: featProgress.target ? `${featProgress.done}/${featProgress.target}` : "0", detail: "Non-spell choices owned by granted feats" },
          { label: "Background feat", value: controller.selectedBackgroundFeat ? "1" : "0", detail: controller.selectedBackgroundFeat?.name || backgroundName },
        ],
        sources: [
          ...(bonusFeatRequired ? [{ label: "Species / Origin bonus", detail: selectedBonusName || "Choose one eligible feat", value: selectedBonusName ? "Selected" : "Pending" }] : []),
          ...(controller.selectedBackgroundFeat ? [{ label: backgroundName, detail: controller.selectedBackgroundFeat.name, value: "Granted" }] : []),
          ...(featSourceGroups.length ? [{ label: "Granted feat features", detail: `${featSourceGroups.length} source-owned follow-up group${featSourceGroups.length === 1 ? "" : "s"}`, value: featSourceGroups.every((group) => sourceChoiceGroupComplete(group, sourceSelections)) ? "Complete" : "Choices left" }] : []),
        ],
      };
    }

    if (view === "class") {
      const families = new Map();
      for (const group of classSourceGroups) {
        const family = group.metadata?.family || group.label || "Class option";
        if (!families.has(family)) families.set(family, []);
        families.get(family).push(group);
      }
      return {
        type: "trainingOverview",
        view,
        icon: `${TRAINING_ASSET_ROOT}/summary-training.svg`,
        title: "Class Choices",
        description: "Persistent choices granted by your class or subclass live here: invocations, fighting styles, maneuvers, magic-item plans, and similar advancement decisions.",
        metrics: [
          { label: "Required class choices", value: (classProgress.target + classSourceProgress.target) ? `${classProgress.done + classSourceProgress.done}/${classProgress.target + classSourceProgress.target}` : "0", detail: "Active class, subclass, and source-backed decisions" },
          { label: "Feature choices", value: classProgress.target ? `${classProgress.done}/${classProgress.target}` : "0", detail: className },
          { label: "Subclass", value: subclassName || "None", detail: subclassName ? "Selected subclass source" : "No subclass selected at this level" },
        ],
        sources: [
          { label: className, detail: `Level ${controller.draft?.level || 1} class progression`, value: classChoicesIncomplete ? "Choices left" : "Current" },
          ...(subclassName ? [{ label: subclassName, detail: "Subclass-granted permanent choices", value: "Included" }] : []),
          ...[...families.entries()].map(([family, groups]) => {
            const progress = sourceGroupProgress(groups, sourceSelections);
            return { label: titleCase(family), detail: `${groups.length} slot${groups.length === 1 ? "" : "s"} granted by class progression`, value: progress.target ? `${progress.done}/${progress.target}` : "Ready" };
          }),
        ],
      };
    }

    return {
      type: "trainingOverview",
      view: "skills",
      icon: `${TRAINING_ASSET_ROOT}/summary-skills.svg`,
      title: "Skills & Training",
      description: "",
      metrics: [
        { label: "Class Skill Choices", value: `${sharedChoiceDone}/${sharedChoiceTarget}`, detail: sharedChoiceTarget === 1 ? `Choose one skill from your ${className} list.` : `Choose ${sharedChoiceTarget} skills from your ${className} list.` },
        { label: "Background Skills", value: String(backgroundFixed), detail: backgroundSkillNames.length ? playerList(backgroundSkillNames) : backgroundName },
        { label: "Additional Training", value: (trainingProgress.target + trainingSourceProgress.target) ? `${trainingProgress.done + trainingSourceProgress.done}/${trainingProgress.target + trainingSourceProgress.target}` : "0", detail: "Expertise, tools, or languages from your features." },
      ],
      sources: [
        { label: "Background", name: backgroundName, detail: backgroundSkillSentence, value: `${backgroundFixed} skill${backgroundFixed === 1 ? "" : "s"}` },
        { label: "Class", name: className, detail: sharedChoiceTarget === 1 ? "Grants you one skill choice from the list provided." : `Grants you ${sharedChoiceTarget} skill choices from the list provided.`, value: `${sharedChoiceDone}/${sharedChoiceTarget}` },
        ...(trainingProgress.target ? [{ label: "Class Feature", name: className, detail: "Provides an additional training choice from one of your class features.", value: `${trainingProgress.done}/${trainingProgress.target}` }] : []),
      ],
    };
  }

  function selectView(view) {
    setActiveView(view);
    controller.setError?.("");
    props.onDetail?.(overviewDetail(view));
  }

  useEffect(() => {
    props.onDetail?.(overviewDetail("skills"));
    // Seed one stable section summary when Training first opens. Later detail changes are click-owned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skillsStatus = skillsIncomplete ? "Needs choice" : "Complete";
  const featsStatus = featsIncomplete ? "Needs choice" : featsHaveChoices ? "Complete" : "No choices";
  const classStatus = classChoicesIncomplete ? "Needs choice" : classChoicesHaveChoices ? "Complete" : "No choices";

  return <div ref={shellRef} className={`npc-forge-training-tabbed-shell is-${activeView}`}>
    <div className="npc-forge-training-mode-switch" role="tablist" aria-label="Training sections">
      <button type="button" role="tab" aria-selected={activeView === "skills"} className={activeView === "skills" ? "is-active" : ""} onClick={() => selectView("skills")}>
        <img src={`${TRAINING_ASSET_ROOT}/summary-skills.svg`} alt="" aria-hidden="true" />
        <span><strong>Skills</strong><small>Skills, Trade Skills &amp; additional training</small></span>
        <em className={skillsIncomplete ? "is-required" : "is-complete"}>{skillsStatus}</em>
      </button>
      <button type="button" role="tab" aria-selected={activeView === "feats"} className={activeView === "feats" ? "is-active" : ""} onClick={() => selectView("feats")}>
        <img src={`${TRAINING_ASSET_ROOT}/summary-feat.svg`} alt="" aria-hidden="true" />
        <span><strong>Feats</strong><small>Feat catalogue &amp; feat-owned follow-ups</small></span>
        <em className={featsIncomplete ? "is-required" : "is-complete"}>{featsStatus}</em>
      </button>
      <button type="button" role="tab" aria-selected={activeView === "class"} className={`${activeView === "class" ? "is-active " : ""}is-class-choice-tab`} onClick={() => selectView("class")}>
        <img src={`${TRAINING_ASSET_ROOT}/summary-training.svg`} alt="" aria-hidden="true" />
        <span><strong><span>Class</span><span>Choices</span></strong><small>Invocations, styles, maneuvers &amp; class options</small></span>
        <em className={classChoicesIncomplete ? "is-required" : "is-complete"}>{classStatus}</em>
      </button>
    </div>

    <div className="npc-forge-training-tabbed-panel" role="tabpanel" aria-label={activeView === "skills" ? "Skills" : activeView === "feats" ? "Feats" : "Class Choices"}>
      <NpcForgeTrainingStepPlayer {...props} />
    </div>

    {activeView !== "skills" ? <div className="npc-forge-training-tabbed-help">
      <span>ⓘ</span>
      <p>{activeView === "feats"
        ? "Click a feat to inspect it on the right. For selectable bonus feats, confirm the choice with Select Feat in Current Selection. Feat-owned non-spell follow-ups remain with the feat; granted spells continue to Spells."
        : "Resolve persistent class and subclass choices here, including Eldritch Invocations, fighting styles, maneuvers, Artificer plans, and similar level-based options."}</p>
    </div> : null}

    <style jsx global>{`
      .npc-forge-training-tabbed-shell{display:grid;gap:9px}.npc-forge-training-mode-switch{display:flex;gap:3px;align-items:stretch;width:100%;padding:4px;border:1px solid rgba(168,108,255,.28);border-radius:999px;background:linear-gradient(180deg,rgba(38,25,61,.92),rgba(7,9,16,.96));box-shadow:inset 0 1px rgba(255,255,255,.045),0 8px 24px rgba(0,0,0,.18)}.npc-forge-training-mode-switch>button{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:9px;align-items:center;flex:1 1 0;min-width:0;min-height:50px;padding:7px 11px;border:1px solid transparent;border-radius:999px;color:rgba(255,255,255,.68);background:transparent;text-align:left;transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease}.npc-forge-training-mode-switch>button:hover{border-color:rgba(168,108,255,.28);background:rgba(126,72,199,.07);transform:translateY(-1px)}.npc-forge-training-mode-switch>button.is-active{border-color:rgba(168,108,255,.68);background:linear-gradient(110deg,rgba(126,72,199,.32),rgba(75,42,124,.16));box-shadow:inset 0 0 0 1px rgba(220,190,255,.06),0 4px 14px rgba(126,72,199,.16)}.npc-forge-training-mode-switch>button>img{width:25px;height:25px;object-fit:contain}.npc-forge-training-mode-switch>button>span{display:grid;gap:1px;min-width:0}.npc-forge-training-mode-switch>button strong{color:#fff;font-size:.72rem;white-space:nowrap}.npc-forge-training-mode-switch>button.is-class-choice-tab strong{display:grid;gap:0;font-size:.65rem;line-height:.92;white-space:normal}.npc-forge-training-mode-switch>button.is-class-choice-tab strong>span{display:block}.npc-forge-training-mode-switch>button small{overflow:hidden;color:rgba(255,255,255,.48);font-size:.48rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-mode-switch>button>em{padding:4px 7px;border-radius:999px;color:rgba(255,255,255,.58);background:rgba(255,255,255,.055);font-size:.46rem;font-style:normal;white-space:nowrap}.npc-forge-training-mode-switch>button>em.is-required{color:#ffe0a0;background:rgba(243,191,99,.12)}.npc-forge-training-mode-switch>button>em.is-complete{color:#9cece2;background:rgba(88,214,199,.1)}.npc-forge-training-tabbed-shell .npc-forge-training-summary--unified{display:none!important}.npc-forge-training-tabbed-shell .npc-forge-training-help{display:none!important}.npc-forge-training-tabbed-shell.is-skills .npc-forge-training-feat-section{display:none!important}.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-class-skills,.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-trade-skills,.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-source-section,.npc-forge-training-tabbed-shell.is-class .npc-forge-training-class-skills,.npc-forge-training-tabbed-shell.is-class .npc-forge-training-trade-skills,.npc-forge-training-tabbed-shell.is-class .npc-forge-training-source-section{display:none!important}.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-feat-section,.npc-forge-training-tabbed-shell.is-class .npc-forge-training-feat-section{display:block!important;border-top:0!important}.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-feat-section>summary,.npc-forge-training-tabbed-shell.is-class .npc-forge-training-feat-section>summary{display:none!important}.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-feat-section .npc-forge-training-choice-body,.npc-forge-training-tabbed-shell.is-class .npc-forge-training-feat-section .npc-forge-training-choice-body{padding:1px 0 4px}.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-picks,.npc-forge-training-tabbed-shell.is-class .npc-forge-training-picks{padding-top:11px}.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-class-only{display:none!important}.npc-forge-training-tabbed-shell.is-class .npc-forge-training-feat-only{display:none!important}.npc-forge-training-tabbed-shell .npc-forge-training-source-section>summary b{font-size:0}.npc-forge-training-tabbed-shell .npc-forge-training-source-section>summary b::after{content:"Additional Training";font-size:.57rem}.npc-forge-training-tabbed-help{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-top:1px solid rgba(255,255,255,.065);color:rgba(255,255,255,.52)}.npc-forge-training-tabbed-help>span{color:#cfd8ff;font-size:.72rem}.npc-forge-training-tabbed-help p{margin:0;font-size:.5rem;line-height:1.45}@media(max-width:1180px){.npc-forge-training-mode-switch>button small{display:none}.npc-forge-training-mode-switch>button{grid-template-columns:25px minmax(0,1fr) auto;padding-inline:8px}.npc-forge-training-mode-switch>button strong{font-size:.66rem}.npc-forge-training-mode-switch>button>em{font-size:.43rem}}@media(max-width:720px){.npc-forge-training-mode-switch{border-radius:18px;flex-direction:column}.npc-forge-training-mode-switch>button{grid-template-columns:28px minmax(0,1fr) auto;min-height:48px;border-radius:14px;padding:7px 9px}.npc-forge-training-mode-switch>button>img{width:24px;height:24px}}
    `}</style>
  </div>;
}

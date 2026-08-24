import { useEffect, useMemo, useRef, useState } from "react";
import { TRADE_SKILL_KEYS } from "../utils/craftingProfessions";
import { professionKeysForTools } from "../utils/craftingToolProfessions";
import { selectedSourceChoiceOptions, sourceChoiceGroupComplete } from "../utils/playerForgeSourceChoices";
import { useNpcForgeClassChoice } from "./NpcForgeClassChoiceContext";
import { useNpcForgeControllerContext } from "./NpcForgeControllerContext";
import { sourceChoiceGroupsForResolverPlacement, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import NpcForgeTrainingStepPlayer from "./NpcForgeTrainingStepPlayer";

const TRAINING_ASSET_ROOT = "/ui/forge/training";
const normalized = (value) => String(value ?? "").trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function classGroupsIncomplete(groups = [], selections = {}) {
  return groups.some((group) => group?.required && (selections?.[group.id] || []).length !== Number(group.count || 0));
}

function ownerToolEntries(entries = []) {
  return entries.filter((entry) => entry.kind === "tool" || entry.fieldKind === "tool" || entry.fieldKind === "skill-or-tool");
}

function featOptionForGroup(group = {}, options = []) {
  const optionId = String(group?.metadata?.featOptionId || "");
  const name = normalized(group?.metadata?.featName || group?.label);
  const source = String(group?.metadata?.featSource || group?.source || "");
  return options.find((option) => optionId && String(option?.id || "") === optionId)
    || options.find((option) => name && normalized(option?.name) === name && (!source || String(option?.source || "") === source))
    || options.find((option) => name && normalized(option?.name) === name)
    || null;
}

export default function NpcForgeTrainingStepPlayerTabbed(props) {
  const [activeView, setActiveView] = useState("skills");
  const shellRef = useRef(null);
  const controller = useNpcForgeControllerContext() || {};
  const { state: classChoiceState } = useNpcForgeClassChoice();
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();

  const classGroups = classChoiceState.featureGroups || [];
  const classSelections = classChoiceState.featureSelections || {};
  const sourceGroups = sourceChoiceState.groups || [];
  const sourceSelections = sourceChoiceState.selections || {};

  const trainingClassGroups = useMemo(() => classGroups.filter((group) => (group.placement || "class") === "training"), [classGroups]);
  const featClassGroups = useMemo(() => classGroups.filter((group) => (group.placement || "class") === "class"), [classGroups]);
  const resolverTrainingGroups = useMemo(() => sourceChoiceGroupsForResolverPlacement(sourceChoiceState, "training"), [sourceChoiceState]);
  const trainingSourceGroups = useMemo(() => resolverTrainingGroups.filter((group) => (
    group.placement === "training"
    && (group.ownerType !== "feat" || Boolean(group.metadata?.proficiencyFeat))
  )), [resolverTrainingGroups]);
  const featSourceGroups = useMemo(() => resolverTrainingGroups.filter((group) => (
    (group.ownerType === "feat" && !group.metadata?.proficiencyFeat)
    || ["class", "advancement"].includes(group.placement)
  )), [resolverTrainingGroups]);

  const selectedSourceOptions = useMemo(() => selectedSourceChoiceOptions(sourceGroups, sourceSelections), [sourceGroups, sourceSelections]);
  const sourceGrantedTradeSkills = useMemo(() => new Set(professionKeysForTools(ownerToolEntries(selectedSourceOptions).map((entry) => entry.value || entry.label))), [selectedSourceOptions]);
  const explicitTradeSkills = TRADE_SKILL_KEYS.filter((key) => Number(props.professions?.[key]?.rank || 0) > 0);
  const paidTradeSkills = explicitTradeSkills.filter((key) => !sourceGrantedTradeSkills.has(key));

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
  const incompleteFeatClass = classGroupsIncomplete(featClassGroups, classSelections);
  const incompleteFeatSource = featSourceGroups.some((group) => !sourceChoiceGroupComplete(group, sourceSelections));

  const skillsIncomplete = incompleteBackgroundChoices || incompleteSharedChoices || incompleteTrainingClass || incompleteTrainingSource;
  const featsIncomplete = incompleteBonusFeat || incompleteFeatClass || incompleteFeatSource;
  const featsHaveChoices = bonusFeatRequired || featClassGroups.length > 0 || featSourceGroups.length > 0;

  useEffect(() => {
    if (activeView !== "feats") return;
    const featSection = shellRef.current?.querySelector("details.npc-forge-training-feat-section");
    if (featSection) featSection.open = true;
  }, [activeView, controller.speciesBonusFeat, classSelections, sourceSelections]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    function routeContinueToUnfinishedView(event) {
      const button = event.target?.closest?.("button");
      if (!button || button.textContent?.trim() !== "Continue") return;
      if (incompleteBonusFeat) setActiveView("feats");
      else if (skillsIncomplete) setActiveView("skills");
      else if (featsIncomplete) setActiveView("feats");
    }
    window.addEventListener("click", routeContinueToUnfinishedView, true);
    return () => window.removeEventListener("click", routeContinueToUnfinishedView, true);
  }, [featsIncomplete, incompleteBonusFeat, skillsIncomplete]);

  function selectView(view) {
    setActiveView(view);
    controller.setError?.("");
    if (view !== "feats") return;
    if (controller.speciesBonusFeat) {
      const option = (controller.featOptions || []).find((feat) => String(feat.id) === String(controller.speciesBonusFeat.id || controller.draft?.speciesBonus?.featId || ""));
      if (option) props.onDetail?.({ type: "feat", option, granted: true, featInstanceId: "species-bonus-feat" });
      return;
    }
    const firstFeatGroup = featSourceGroups.find((group) => group.ownerType === "feat");
    if (!firstFeatGroup) return;
    const option = featOptionForGroup(firstFeatGroup, controller.featOptions || []) || {
      id: firstFeatGroup.metadata?.featOptionId || firstFeatGroup.ownerKey,
      name: firstFeatGroup.metadata?.featName || firstFeatGroup.label || "Feat",
      source: firstFeatGroup.metadata?.featSource || firstFeatGroup.source || "Campaign",
      category: firstFeatGroup.metadata?.featCategory || "Feat",
      description: firstFeatGroup.helper || "Complete this feat's required follow-up choices.",
    };
    props.onDetail?.({ type: "feat", option, granted: true, featInstanceId: firstFeatGroup.metadata?.featInstanceId || firstFeatGroup.ownerKey });
  }

  const skillsStatus = skillsIncomplete ? "Needs choice" : "Complete";
  const featsStatus = featsIncomplete ? "Needs choice" : featsHaveChoices ? "Complete" : "No choices";

  return <div ref={shellRef} className={`npc-forge-training-tabbed-shell is-${activeView}`}>
    <div className="npc-forge-training-mode-switch" role="tablist" aria-label="Training sections">
      <button type="button" role="tab" aria-selected={activeView === "skills"} className={activeView === "skills" ? "is-active" : ""} onClick={() => selectView("skills")}>
        <img src={`${TRAINING_ASSET_ROOT}/summary-skills.svg`} alt="" aria-hidden="true" />
        <span><strong>Skills</strong><small>Skills, Trade Skills &amp; additional training</small></span>
        <em className={skillsIncomplete ? "is-required" : "is-complete"}>{skillsStatus}</em>
      </button>
      <button type="button" role="tab" aria-selected={activeView === "feats"} className={activeView === "feats" ? "is-active" : ""} onClick={() => selectView("feats")}>
        <img src={`${TRAINING_ASSET_ROOT}/summary-feat.svg`} alt="" aria-hidden="true" />
        <span><strong>Feats</strong><small>Feat catalogue &amp; permanent feat choices</small></span>
        <em className={featsIncomplete ? "is-required" : "is-complete"}>{featsStatus}</em>
      </button>
    </div>

    <div className="npc-forge-training-tabbed-panel" role="tabpanel" aria-label={activeView === "skills" ? "Skills" : "Feats"}>
      <NpcForgeTrainingStepPlayer {...props} />
    </div>

    <div className="npc-forge-training-tabbed-help">
      <span>ⓘ</span>
      <p>{activeView === "skills"
        ? "Choose Skills, Trade Skills, languages, instruments, and other training proficiencies here. Feat-granted Profession choices such as Crafter also resolve here and are labeled with their granting source."
        : "Choose granted feats on the left. Any non-spell choice owned by the selected feat is completed beside its rules in Current Selection; Crafter's Profession grants are the exception and resolve in Skills; feat-granted spell choices continue to the Spells step."}</p>
    </div>

    <style jsx global>{`
      .npc-forge-training-tabbed-shell{display:grid;gap:9px}.npc-forge-training-mode-switch{display:flex;gap:3px;align-items:stretch;width:100%;padding:4px;border:1px solid rgba(168,108,255,.28);border-radius:999px;background:linear-gradient(180deg,rgba(38,25,61,.92),rgba(7,9,16,.96));box-shadow:inset 0 1px rgba(255,255,255,.045),0 8px 24px rgba(0,0,0,.18)}.npc-forge-training-mode-switch>button{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:9px;align-items:center;flex:1 1 0;min-width:0;min-height:50px;padding:7px 11px;border:1px solid transparent;border-radius:999px;color:rgba(255,255,255,.68);background:transparent;text-align:left;transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease}.npc-forge-training-mode-switch>button:hover{border-color:rgba(168,108,255,.28);background:rgba(126,72,199,.07);transform:translateY(-1px)}.npc-forge-training-mode-switch>button.is-active{border-color:rgba(168,108,255,.68);background:linear-gradient(110deg,rgba(126,72,199,.32),rgba(75,42,124,.16));box-shadow:inset 0 0 0 1px rgba(220,190,255,.06),0 4px 14px rgba(126,72,199,.16)}.npc-forge-training-mode-switch>button>img{width:25px;height:25px;object-fit:contain}.npc-forge-training-mode-switch>button>span{display:grid;gap:1px;min-width:0}.npc-forge-training-mode-switch>button strong{color:#fff;font-size:.72rem}.npc-forge-training-mode-switch>button small{overflow:hidden;color:rgba(255,255,255,.48);font-size:.48rem;white-space:nowrap;text-overflow:ellipsis}.npc-forge-training-mode-switch>button>em{padding:4px 7px;border-radius:999px;color:rgba(255,255,255,.58);background:rgba(255,255,255,.055);font-size:.46rem;font-style:normal;white-space:nowrap}.npc-forge-training-mode-switch>button>em.is-required{color:#ffe0a0;background:rgba(243,191,99,.12)}.npc-forge-training-mode-switch>button>em.is-complete{color:#9cece2;background:rgba(88,214,199,.1)}.npc-forge-training-tabbed-shell .npc-forge-training-summary--unified{display:none!important}.npc-forge-training-tabbed-shell .npc-forge-training-help{display:none!important}.npc-forge-training-tabbed-shell.is-skills .npc-forge-training-feat-section{display:none!important}.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-class-skills,.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-trade-skills,.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-source-section{display:none!important}.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-feat-section{display:block!important;border-top:0!important}.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-feat-section>summary{display:none!important}.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-feat-section .npc-forge-training-choice-body{padding:1px 0 4px}.npc-forge-training-tabbed-shell.is-feats .npc-forge-training-picks{padding-top:11px}.npc-forge-training-tabbed-shell .npc-forge-training-source-section>summary b{font-size:0}.npc-forge-training-tabbed-shell .npc-forge-training-source-section>summary b::after{content:"Additional Training";font-size:.57rem}.npc-forge-training-tabbed-help{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-top:1px solid rgba(255,255,255,.065);color:rgba(255,255,255,.52)}.npc-forge-training-tabbed-help>span{color:#cfd8ff;font-size:.72rem}.npc-forge-training-tabbed-help p{margin:0;font-size:.5rem;line-height:1.45}@media(max-width:920px){.npc-forge-training-mode-switch>button small{display:none}.npc-forge-training-mode-switch>button{grid-template-columns:26px minmax(0,1fr) auto;padding-inline:9px}}@media(max-width:720px){.npc-forge-training-mode-switch{border-radius:18px;flex-direction:column}.npc-forge-training-mode-switch>button{grid-template-columns:28px minmax(0,1fr) auto;min-height:48px;border-radius:14px;padding:7px 9px}.npc-forge-training-mode-switch>button>img{width:24px;height:24px}}
    `}</style>
  </div>;
}

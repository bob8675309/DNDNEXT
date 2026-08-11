import NpcForgeContextPanelRefined from "./NpcForgeContextPanelRefined";
import NpcForgeClassGuide from "./NpcForgeClassGuide";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import { projectSelectedSpeciesVariant } from "../utils/speciesVariantFamilies";

export default function NpcForgeContextPanel(props) {
  const activeClass = props?.detail?.type === "class" && props.detail.option
    ? props.detail.option
    : props?.stepKey === "class" || Number(props?.step) === 2
      ? props?.selectedClass
      : null;
  const { state: sourceChoiceState } = useNpcForgeSourceChoices();
  if (activeClass) return <NpcForgeClassGuide selectedClass={activeClass} level={props?.draft?.level || 1} onFeatureDetail={props?.onFeatureDetail} />;

  const projectSpecies = (species) => projectSelectedSpeciesVariant(species, sourceChoiceState.groups || [], sourceChoiceState.selections || {});
  const projectedSelectedSpecies = projectSpecies(props?.selectedSpecies);
  const projectedDetail = props?.detail?.type === "species" && props.detail.option
    ? { ...props.detail, option: projectSpecies(props.detail.option) }
    : props?.detail;

  return <NpcForgeContextPanelRefined {...props} selectedSpecies={projectedSelectedSpecies} detail={projectedDetail} />;
}

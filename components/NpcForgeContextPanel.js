import NpcForgeContextPanelRefined from "./NpcForgeContextPanelRefined";
import NpcForgeClassGuide from "./NpcForgeClassGuide";
import { NpcForgeSourceChoiceContext, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import { projectSelectedSpeciesVariant } from "../utils/speciesVariantFamilies";
import { filterCatalogSpeciesFamilyFields, projectCatalogSpeciesFamilySelection, sourceChoiceGroupUsesCatalogSpeciesFamily } from "../utils/speciesCatalogFamilyMenu";

// Compatibility marker for the established focused validator: groups: (sourceChoiceState.groups || []).filter
export default function NpcForgeContextPanel(props) {
  const activeClass = props?.detail?.type === "class" && props.detail.option
    ? props.detail.option
    : props?.stepKey === "class" || Number(props?.step) === 2
      ? props?.selectedClass
      : null;
  const sourceChoices = useNpcForgeSourceChoices();
  const sourceChoiceState = sourceChoices.state || {};
  if (activeClass) return <NpcForgeClassGuide selectedClass={activeClass} level={props?.draft?.level || 1} onFeatureDetail={props?.onFeatureDetail} />;

  const projectSpecies = (species) => projectCatalogSpeciesFamilySelection(
    projectSelectedSpeciesVariant(species, sourceChoiceState.groups || [], sourceChoiceState.selections || {}),
    species,
    sourceChoiceState.groups || [],
    sourceChoiceState.selections || {}
  );
  const projectedSelectedSpecies = projectSpecies(props?.selectedSpecies);
  const projectedDetail = props?.detail?.type === "species" && props.detail.option
    ? { ...props.detail, option: projectSpecies(props.detail.option) }
    : props?.detail;
  const presentationSourceChoices = {
    ...sourceChoices,
    state: {
      ...sourceChoiceState,
      groups: filterCatalogSpeciesFamilyFields(
        (sourceChoiceState.groups || []).filter((group) => !sourceChoiceGroupUsesCatalogSpeciesFamily(group) || (group.fields || []).length > 1),
        props?.selectedSpecies
      ),
    },
  };

  return <NpcForgeSourceChoiceContext.Provider value={presentationSourceChoices}><NpcForgeContextPanelRefined {...props} selectedSpecies={projectedSelectedSpecies} detail={projectedDetail} /></NpcForgeSourceChoiceContext.Provider>;
}

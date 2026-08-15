import NpcForgeContextPanelRefined from "./NpcForgeContextPanelRefined";
import NpcForgeClassGuide from "./NpcForgeClassGuide";
import { NpcForgeSourceChoiceContext, useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";
import { projectSelectedSpeciesVariant } from "../utils/speciesVariantFamilies";
import { filterCatalogSpeciesFamilyFields, projectCatalogSpeciesFamilySelection, sourceChoiceGroupUsesCatalogSpeciesFamily } from "../utils/speciesCatalogFamilyMenu";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function playerSpeciesPresentation(species = null, playerMode = false) {
  if (!species || !playerMode) return species;
  const name = norm(species.name);
  const source = String(species.source || "").toUpperCase();

  if (name === "custom lineage" && source === "TCE") {
    const redundant = (value) => {
      const normalized = norm(value);
      return normalized.startsWith("instead of choosing one of the games races")
        || normalized.startsWith("your race is considered to be a custom lineage");
    };
    return {
      ...species,
      traits: (species.traits || []).filter((trait) => !redundant(trait)),
    };
  }

  if (name === "human" && source === "XPHB") {
    const renameVersatile = (value) => norm(value) === "versatile" ? "Versatile — Feat Selection" : value;
    return {
      ...species,
      traits: (species.traits || []).map(renameVersatile),
      traitDetails: (species.traitDetails || []).map((entry) => norm(entry?.name) === "versatile" ? {
        ...entry,
        name: "Versatile — Feat Selection",
        description: "Versatile grants one bonus Origin feat. Choose it in Training → Feats & Class Abilities from the full imported Origin-feat catalogue.",
      } : entry),
    };
  }

  return species;
}

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

  const projectSpecies = (species) => playerSpeciesPresentation(projectCatalogSpeciesFamilySelection(
    projectSelectedSpeciesVariant(species, sourceChoiceState.groups || [], sourceChoiceState.selections || {}),
    species,
    sourceChoiceState.groups || [],
    sourceChoiceState.selections || {}
  ), props?.playerMode);
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

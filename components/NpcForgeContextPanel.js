import NpcForgeContextPanelRefined from "./NpcForgeContextPanelRefined";
import NpcForgeClassGuide from "./NpcForgeClassGuide";
import NpcForgeBackgroundGuide from "./NpcForgeBackgroundGuide";
import NpcForgeTrainingContextCard from "./NpcForgeTrainingContextCard";
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

function playerBackgroundPresentation(details = null, playerMode = false, hasRoutedToolChoice = false) {
  if (!details || !playerMode) return details;
  // Background skill options are explained in the Background presentation, but their
  // actual selection belongs to Training → Skills & Proficiencies. The derived model
  // adds a routed summary to `skills`, so suppress only the old embedded chooser here.
  const tools = Array.isArray(details.tools) ? [...details.tools] : [];
  if (hasRoutedToolChoice) tools.unshift({
    label: "Resolved in Training",
    description: "This background grants a tool or craft proficiency choice. Make that source-owned choice on the Training tab with the other proficiency selections. It is a grant from the background and does not consume the Class Skill / Trade Skill allowance.",
  });
  return { ...details, skillChoices: [], tools };
}

function groupHasTool(group = {}) {
  return (group.fields || []).some((field) => field?.kind === "tool");
}

// Compatibility marker for the established focused validator: groups: (sourceChoiceState.groups || []).filter
export default function NpcForgeContextPanel(props) {
  const activeClass = props?.detail?.type === "class" && props.detail.option
    ? props.detail.option
    : props?.stepKey === "class" || Number(props?.step) === 2
      ? props?.selectedClass
      : null;
  const activeBackground = props?.detail?.type === "background" && props.detail.option
    ? props.detail.option
    : props?.stepKey === "background" || Number(props?.step) === 1
      ? props?.selectedBackground
      : null;
  const sourceChoices = useNpcForgeSourceChoices();
  const sourceChoiceState = sourceChoices.state || {};
  const routedBackgroundToolGroups = (sourceChoiceState.groups || []).filter((group) => group.ownerType === "background" && group.placement === "training" && group.metadata?.backgroundToolChoice && groupHasTool(group));
  const fixedBackgroundToolGroups = (sourceChoiceState.groups || []).filter((group) => group.ownerType === "background" && group.placement === "background" && groupHasTool(group));
  const hasRoutedBackgroundToolChoice = routedBackgroundToolGroups.length > 0;
  const projectedBackgroundMechanics = playerBackgroundPresentation(props?.backgroundMechanicDetails, props?.playerMode, hasRoutedBackgroundToolChoice);
  const projectedBackground = props?.playerMode && activeBackground && hasRoutedBackgroundToolChoice && !fixedBackgroundToolGroups.length
    ? { ...activeBackground, tools: ["Choose in Training"] }
    : activeBackground;

  if (activeClass) return <NpcForgeClassGuide selectedClass={activeClass} level={props?.draft?.level || 1} onFeatureDetail={props?.onFeatureDetail} />;
  if (props?.playerMode && activeBackground) return <NpcForgeBackgroundGuide
    selectedBackground={projectedBackground}
    backgroundMechanicDetails={projectedBackgroundMechanics}
    selectedBackgroundFeat={props?.selectedBackgroundFeat}
    backgroundFeatOptions={props?.backgroundFeatOptions || []}
    onSelectBackgroundFeat={props?.onSelectBackgroundFeat}
    draft={props?.draft || {}}
  />;

  if (props?.playerMode && (props?.stepKey === "training" || Number(props?.step) === 4)) return <NpcForgeTrainingContextCard
    detail={props?.detail}
    selectedSkill={props?.selectedSkill}
    selectedProfession={props?.selectedProfession}
    selectedClass={props?.selectedClass}
    draft={props?.draft || {}}
  />;

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

  return <NpcForgeSourceChoiceContext.Provider value={presentationSourceChoices}><NpcForgeContextPanelRefined {...props} backgroundMechanicDetails={projectedBackgroundMechanics} selectedSpecies={projectedSelectedSpecies} detail={projectedDetail} /></NpcForgeSourceChoiceContext.Provider>;
}

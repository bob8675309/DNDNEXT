import { useEffect, useMemo } from "react";
import { evaluateFeatPrerequisites, progressionState } from "../utils/characterProgressionResolver";
import { useNpcForgeSourceChoices } from "./NpcForgeSourceChoiceContext";

const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slug = (value) => norm(value).replace(/\s+/g, "-");

function is2024Human(species = null) {
  return norm(species?.name) === "human" && String(species?.source || "").toUpperCase() === "XPHB";
}

function featOption(feat, prerequisiteResult) {
  return {
    key: text(feat.id || feat.option_key || `${slug(feat.name)}|${feat.source || "XPHB"}`),
    value: text(feat.id || feat.option_key || feat.name),
    label: feat.name,
    source: feat.source || "XPHB",
    kind: "feat",
    description: text(feat.description),
    metadata: {
      optionId: feat.id || null,
      optionKey: feat.option_key || null,
      category: feat.category || null,
      prerequisiteText: feat.prerequisite_text || null,
      prerequisites: feat.metadata?.prerequisite || [],
      prerequisiteResult,
      acquisitionLevel: 1,
      repeatable: Boolean(feat.metadata?.repeatable),
    },
  };
}

export default function NpcForgeHumanVersatileRegistrar({ playerMode = false, controller = null }) {
  const { registerGroups } = useNpcForgeSourceChoices();
  const selectedSpecies = controller?.selectedSpecies || null;
  const human = Boolean(playerMode && is2024Human(selectedSpecies));
  const scope = "human-versatile";

  const groups = useMemo(() => {
    if (!human) return [];
    const state = progressionState({
      level: 1,
      abilities: controller?.finalAbilities || {},
      selectedClass: controller?.selectedClass || null,
      selectedSpecies,
      selectedBackground: controller?.selectedBackground || null,
      feats: [controller?.selectedBackgroundFeat].filter(Boolean),
      spellcasting: Boolean(controller?.selectedClass?.spellcasting_ability || /pact/i.test(String(controller?.selectedClass?.caster_progression || ""))),
    });
    const originFeats = (controller?.featOptions || []).filter((feat) => String(feat?.category || "").toUpperCase() === "O").flatMap((feat) => {
      const result = evaluateFeatPrerequisites(feat, state, 1);
      return result.eligible ? [featOption(feat, result)] : [];
    }).sort((a, b) => a.label.localeCompare(b.label) || a.source.localeCompare(b.source));
    if (!originFeats.length) return [];
    return [{
      id: `advancement-${slug(selectedSpecies.id || selectedSpecies.name)}-versatile-origin-feat`,
      ownerType: "advancement",
      ownerKey: `species:${selectedSpecies.id || selectedSpecies.name}:versatile`,
      label: "Human Versatile — Origin Feat",
      source: selectedSpecies.source || "XPHB",
      placement: "class",
      level: 1,
      helper: "Versatile grants one Origin feat at character creation. Choose from the full imported Origin-feat catalogue; normal prerequisites still apply.",
      metadata: {
        sourceTrait: "Versatile",
        primaryFeatGrant: true,
        surfaceWithFeatChoices: true,
        resolverPlacement: "training",
        acquisitionOwnerType: "species",
        acquisitionLevel: 1,
        canonicalPoolCount: originFeats.length,
      },
      fields: [{
        id: "feat",
        label: "Choose Human Versatile Origin feat",
        kind: "feat",
        count: 1,
        required: true,
        cadence: "creation",
        options: originFeats,
        metadata: {
          sourceFeature: "Versatile",
          featureLevel: 1,
          prerequisiteEvaluation: "before-feat-benefits",
          canonicalPoolCount: originFeats.length,
        },
      }],
    }];
  }, [controller?.featOptions, controller?.finalAbilities, controller?.selectedBackground, controller?.selectedBackgroundFeat, controller?.selectedClass, human, selectedSpecies]);

  useEffect(() => {
    registerGroups(groups, true, scope);
    return () => registerGroups([], true, scope);
  }, [groups, registerGroups]);

  return null;
}

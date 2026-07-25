import { backgroundFeatureDetails as refinedBackgroundFeatureDetails } from "./backgroundMechanicsRefined.js";
import {
  neutralizeBackgroundFeature,
  playerFacingBackgroundFeatureName,
} from "./backgroundNeutralization.js";

export * from "./backgroundMechanicsRefined.js";

export function backgroundFeatureDetails(background = {}) {
  const sourceName = background.sourceName || background.source_name || background.name || background.key || "";
  const rawFeatures = refinedBackgroundFeatureDetails({
    ...background,
    name: `${sourceName || "background"}__feature`,
  });

  return rawFeatures.map((feature) => ({
    ...feature,
    name: playerFacingBackgroundFeatureName(sourceName, feature.name),
    description: neutralizeBackgroundFeature(sourceName, feature.name, feature.description),
  }));
}

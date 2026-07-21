import assert from "node:assert/strict";
import { formatPlayerFacingInline, formatPlayerFacingText, isInternalReferenceLine } from "../utils/playerFacingText.js";
import { extractSpeciesTraitDetails } from "../utils/speciesPresentation.js";
import { hasDedicatedSpeciesArtwork, speciesArtworkFor } from "../utils/speciesArtwork.js";

const importedSubclassText = [
  "Arcane Archers weave magic into their arrows.",
  "",
  "Arcane Archer Lore|Fighter|Arcane Archer|XGE|3",
  "",
  "Arcane Shot|Fighter|Arcane Archer|XGE|3",
].join("\n");

assert.equal(isInternalReferenceLine("Arcane Shot|Fighter|Arcane Archer|XGE|3"), true);
assert.equal(isInternalReferenceLine("Choose Strength | Dexterity as your ability."), false);
assert.equal(formatPlayerFacingText(importedSubclassText), "Arcane Archers weave magic into their arrows.");
assert.equal(formatPlayerFacingInline("Use {@skill Perception|PHB} to notice it."), "Use Perception to notice it.");

const traits = extractSpeciesTraitDetails({
  traits: [
    { name: "Dive Attack", entries: ["If you fly at least 30 feet, the attack deals {@damage 1d6} extra damage."] },
    { name: "Legacy Pointer", entries: ["Legacy Pointer|Species|Aarakocra|DMG|1"] },
  ],
});
assert.equal(traits[0].name, "Dive Attack");
assert.equal(traits[0].description, "If you fly at least 30 feet, the attack deals 1d6 extra damage.");
assert.equal(traits[1].description, "");

assert.equal(hasDedicatedSpeciesArtwork("Aarakocra"), true);
assert.equal(speciesArtworkFor("Aarakocra"), "/media/species/aarakocra.webp");
assert.equal(speciesArtworkFor("Astral Elf"), "/media/species/adventurer.webp");

console.log("Player-facing text and species presentation tests passed.");

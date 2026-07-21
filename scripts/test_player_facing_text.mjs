import assert from "node:assert/strict";
import { formatPlayerFacingInline, formatPlayerFacingText, isInternalReferenceLine } from "../utils/playerFacingText.js";
import { extractSpeciesTraitDetails } from "../utils/speciesPresentation.js";
import { hasDedicatedSpeciesArtwork, speciesArtworkFor } from "../utils/speciesArtwork.js";
import { backgroundStoryDescription, importedNarrative } from "../utils/backgroundPresentation.js";

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
assert.equal(hasDedicatedSpeciesArtwork("Aetherborn"), true);
assert.equal(speciesArtworkFor("Astral Elf"), "/media/species/astral-elf.webp");
assert.equal(speciesArtworkFor("Autognome"), "/media/species/autognome.webp");
assert.equal(speciesArtworkFor("Aven"), "/media/species/aven.webp");
assert.equal(speciesArtworkFor("Dragonborn (Gem)"), "/media/species/dragonborn.webp");
assert.equal(speciesArtworkFor("Human (Ixalan)"), "/media/species/human.webp");
assert.equal(speciesArtworkFor("Sea Elf"), "/media/species/elf.webp");

const mechanicalBackground = [
  "Ability Scores:.",
  "",
  "Strength, Constitution, Charisma",
  "",
  "Feat:.",
  "",
  "Vampire's Plaything",
  "",
  "Skill Proficiencies:.",
  "",
  "Persuasion and Stealth",
].join("\n");
assert.equal(importedNarrative(mechanicalBackground), "");
assert.match(backgroundStoryDescription({ name: "Vampire Devotee", description: mechanicalBackground }), /faith, mystery, or sacred community/);
assert.match(backgroundStoryDescription({ name: "Soldier", description: mechanicalBackground }), /Military service taught you discipline/);

const narrativeBackground = "Skill Proficiencies:.\n\nHistory and Survival\n\nYou spent years crossing forgotten ruins, learning to recognize the marks left by vanished peoples. One discovery still follows you into the present.";
assert.match(backgroundStoryDescription({ name: "Archaeologist", description: narrativeBackground }), /forgotten ruins/);

console.log("Player-facing text, species, and background presentation tests passed.");

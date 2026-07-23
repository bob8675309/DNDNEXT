import assert from "node:assert/strict";
import { formatPlayerFacingInline, formatPlayerFacingText, isInternalReferenceLine } from "../utils/playerFacingText.js";
import { extractSpeciesTraitDetails, formatSpeciesMovement, speciesDefaultCharacterSize } from "../utils/speciesPresentation.js";
import { hasDedicatedSpeciesArtwork, speciesArtworkFor } from "../utils/speciesArtwork.js";
import { backgroundStoryDescription, importedNarrative } from "../utils/backgroundPresentation.js";
import { speciesFlavorLore } from "../utils/speciesLore.js";

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
assert.equal(speciesArtworkFor("Boggart"), "/media/species/boggart.webp");
assert.equal(speciesArtworkFor("Bullywug"), "/media/species/bullywug.webp");
assert.equal(speciesArtworkFor("Centaur"), "/media/species/centaur.webp");
assert.equal(speciesArtworkFor("Dhampir"), "/media/species/dhampir.webp");
assert.equal(speciesArtworkFor("Faerie"), "/media/species/fairy.webp");
assert.equal(speciesArtworkFor("Firbolg"), "/media/species/firbolg.webp");
assert.equal(speciesArtworkFor("Flamekin"), "/media/species/genasi.webp");
assert.equal(speciesArtworkFor("Giff"), "/media/species/giff.webp");
assert.equal(speciesArtworkFor("Githyanki"), "/media/species/gith.webp");
assert.equal(speciesArtworkFor("Githzerai"), "/media/species/gith.webp");
assert.equal(speciesArtworkFor("Gnoll"), "/media/species/gnoll.webp");
assert.equal(speciesArtworkFor("Goblin"), "/media/species/goblin.webp");
assert.equal(speciesArtworkFor("Grung"), "/media/species/grung.webp");
assert.equal(speciesArtworkFor("Grimlock"), "/media/species/grimlock.webp");
assert.equal(speciesArtworkFor("Hobgoblin"), "/media/species/hobgoblin.webp");
assert.equal(speciesArtworkFor("Kalashtar"), "/media/species/kalashtar.webp");
assert.equal(speciesArtworkFor("Kender"), "/media/species/kender.webp");
assert.equal(speciesArtworkFor("Kithkin"), "/media/species/kithkin.webp");
assert.equal(speciesArtworkFor("Khenra"), "/media/species/khenra.webp");
assert.equal(speciesArtworkFor("Kenku"), "/media/species/kenku.webp");
assert.equal(speciesArtworkFor("Kobold"), "/media/species/kobold.webp");
assert.equal(speciesArtworkFor("Kor"), "/media/species/kor.webp");
assert.equal(speciesArtworkFor("Kuo-Toa"), "/media/species/kuo-toa.webp");
assert.equal(speciesArtworkFor("Leonin"), "/media/species/leonin.webp");
assert.equal(speciesArtworkFor("Locathah"), "/media/species/locathah.webp");
assert.equal(speciesArtworkFor("Loxodon"), "/media/species/loxodon.webp");
assert.equal(speciesArtworkFor("Lupin"), "/media/species/lupin.webp");
assert.equal(speciesArtworkFor("Merfolk"), "/media/species/merfolk.webp");
assert.equal(speciesArtworkFor("Minotaur"), "/media/species/minotaur.webp");
assert.equal(speciesArtworkFor("Naga"), "/media/species/naga.webp");
assert.equal(speciesArtworkFor("Owlin"), "/media/species/owlin.webp");
assert.equal(speciesArtworkFor("Plasmoid"), "/media/species/plasmoid.webp");
assert.equal(speciesArtworkFor("Tabaxi"), "/media/species/tabaxi.webp");
assert.equal(speciesArtworkFor("Thri-kreen"), "/media/species/thri-kreen.webp");
assert.equal(speciesArtworkFor("Tortle"), "/media/species/tortle.webp");
assert.equal(speciesArtworkFor("Triton"), "/media/species/triton.webp");
assert.equal(speciesArtworkFor("Dragonborn (Gem)"), "/media/species/dragonborn.webp");
assert.equal(speciesArtworkFor("Goblin (Dankwood)"), "/media/species/goblin.webp");
assert.equal(speciesArtworkFor("Human (Ixalan)"), "/media/species/human.webp");
assert.equal(speciesArtworkFor("Minotaur (Amonkhet)"), "/media/species/minotaur.webp");
assert.equal(speciesArtworkFor("Sea Elf"), "/media/species/elf.webp");

const faerie = { name: "Faerie", size: ["S"], lore: "An inherited source description that does not mention stature." };
assert.equal(speciesDefaultCharacterSize(faerie), "Small");
assert.match(speciesFlavorLore(faerie), /Small.*two to three feet tall.*four gossamer wings/i);
assert.equal(speciesDefaultCharacterSize({ name: "Variable Species", size: ["S", "M"] }), "");
assert.equal(formatSpeciesMovement({ walk: 30, fly: true, swim: 30 }), "Walking 30 ft., Flying equal to walking speed, Swimming 30 ft.");

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

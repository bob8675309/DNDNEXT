import assert from "node:assert/strict";
import { formatPlayerFacingInline, formatPlayerFacingText, isInternalReferenceLine } from "../utils/playerFacingText.js";
import { extractSpeciesTraitDetails, formatSpeciesMovement, speciesDefaultCharacterSize } from "../utils/speciesPresentation.js";
import { hasDedicatedSpeciesArtwork, speciesArtworkFor } from "../utils/speciesArtwork.js";
import { backgroundStoryDescription, importedNarrative } from "../utils/backgroundPresentation.js";
import { speciesFlavorLore } from "../utils/speciesLore.js";
import { BACKGROUND_LORE_CATALOG } from "../utils/backgroundLoreCatalog.js";
import { BLOCKED_BACKGROUND_LOCATIONS } from "../utils/backgroundNeutralization.js";

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
assert.equal(speciesArtworkFor("Fairy"), "/media/species/fairy.webp");
assert.equal(speciesArtworkFor("Faerie"), "/media/species/fairy.webp");
assert.equal(speciesArtworkFor("Firbolg"), "/media/species/firbolg.webp");
assert.equal(speciesArtworkFor("Flamekin"), "/media/species/flamekin.webp");
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
assert.equal(speciesArtworkFor("Dragonborn (Gem)"), "/media/species/dragonborn-gem.webp");
assert.equal(speciesArtworkFor("Goblin (Dankwood)"), "/media/species/goblin.webp");
assert.equal(speciesArtworkFor("Elf (Kaladesh)"), "/media/species/elf-kaladesh.webp");
assert.equal(speciesArtworkFor("Elf (Zendikar)"), "/media/species/elf-zendikar.webp");
assert.equal(speciesArtworkFor("Half-Elf"), "/media/species/half-elf.webp");
assert.equal(speciesArtworkFor("Khoravar"), "/media/species/khoravar.webp");
assert.equal(speciesArtworkFor("Human (Innistrad)"), "/media/species/human-innistrad.webp");
assert.equal(speciesArtworkFor("Human (Ixalan)"), "/media/species/human-ixalan.webp");
assert.equal(speciesArtworkFor("Human (Kaladesh)"), "/media/species/human-kaladesh.webp");
assert.equal(speciesArtworkFor("Human (Zendikar)"), "/media/species/human-zendikar.webp");
assert.equal(speciesArtworkFor("Minotaur (Amonkhet)"), "/media/species/minotaur-amonkhet.webp");
assert.equal(speciesArtworkFor("Sea Elf"), "/media/species/sea-elf.webp");
assert.equal(speciesArtworkFor("Custom Lineage"), "/media/species/custom-lineage.webp");
assert.equal(speciesArtworkFor("Deep Gnome"), "/media/species/deep-gnome.webp");
assert.equal(speciesArtworkFor("Dragonborn (Chromatic)"), "/media/species/dragonborn-chromatic.webp");
assert.equal(speciesArtworkFor("Dragonborn (Metallic)"), "/media/species/dragonborn-metallic.webp");
assert.equal(speciesArtworkFor("Duergar"), "/media/species/duergar.webp");
assert.equal(speciesArtworkFor("Eladrin"), "/media/species/eladrin.webp");
assert.equal(speciesArtworkFor("Reborn"), "/media/species/reborn.webp");
assert.equal(speciesArtworkFor("Rimekin"), "/media/species/rimekin.webp");
assert.equal(speciesArtworkFor("Shadar-Kai"), "/media/species/shadar-kai.webp");
assert.equal(speciesArtworkFor("Shifter"), "/media/species/shifter.webp");
assert.equal(speciesArtworkFor("Simic Hybrid"), "/media/species/simic-hybrid.webp");
assert.equal(speciesArtworkFor("Siren"), "/media/species/siren.webp");
assert.equal(speciesArtworkFor("Skeleton"), "/media/species/skeleton.webp");
assert.equal(speciesArtworkFor("Troglodyte"), "/media/species/troglodyte.webp");
assert.equal(speciesArtworkFor("Vampire"), "/media/species/vampire.webp");
assert.equal(speciesArtworkFor("Vedalken"), "/media/species/vedalken.webp");
assert.equal(speciesArtworkFor("Verdan"), "/media/species/verdan.webp");
assert.equal(speciesArtworkFor("Yuan-Ti"), "/media/species/yuan-ti.webp");
assert.equal(speciesArtworkFor("Yuan-ti Pureblood"), "/media/species/yuan-ti-pureblood.webp");
assert.equal(speciesArtworkFor("Zombie"), "/media/species/zombie.webp");

const fairy = { name: "Fairy", size: ["S"], lore: "An inherited source description that does not mention stature." };
assert.equal(speciesDefaultCharacterSize(fairy), "Small");
assert.match(speciesFlavorLore(fairy), /Small.*two to three feet tall.*four gossamer wings/i);
assert.match(speciesFlavorLore({ name: "Kithkin", lore: "" }), /stout legs.*long arms.*empathic web.*betrayal/i);
for (const name of [
  "Bullywug", "Custom Lineage", "Gnoll", "Grimlock", "Grung", "Kithkin",
  "Kuo-Toa", "Sea Elf", "Shadar-Kai", "Skeleton", "Troglodyte",
  "Yuan-ti Pureblood", "Zombie",
]) {
  const lore = speciesFlavorLore({ name, lore: "" });
  assert.ok(lore.length >= 120, `${name} should retain species-specific fallback lore.`);
  assert.doesNotMatch(lore, /adventurers bring the customs/i);
}
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
assert.match(backgroundStoryDescription({ name: "Vampire Devotee", source: "ABH", description: mechanicalBackground }), /vampire/i);
assert.match(backgroundStoryDescription({ name: "Soldier", source: "XPHB", description: mechanicalBackground }), /war|battle|soldier|discipline/i);

const narrativeBackground = "Skill Proficiencies:.\n\nHistory and Survival\n\nYou spent years crossing forgotten ruins, learning to recognize the marks left by vanished peoples. One discovery still follows you into the present.";
assert.match(backgroundStoryDescription({ name: "Archaeologist", description: narrativeBackground }), /forgotten ruins/);

const backgroundLoreRows = Object.values(BACKGROUND_LORE_CATALOG);
assert.equal(backgroundLoreRows.length, 148);
for (const row of backgroundLoreRows) {
  assert.ok(row.lore.length >= 100, `${row.name} should have substantial Background lore.`);
  for (const place of BLOCKED_BACKGROUND_LOCATIONS) {
    assert.doesNotMatch(row.lore, new RegExp(place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `${row.name} should not mention ${place}.`);
  }
}
const iceFisherLore = backgroundStoryDescription({ name: "Ice Fisher", source: "FRHoF", description: mechanicalBackground });
assert.match(iceFisherLore, /frozen lakes.*winter waters.*thin ice/i);
assert.doesNotMatch(iceFisherLore, /Icewind Dale|Ten-Towns/i);
assert.match(backgroundStoryDescription({ name: "Astral Drifter", source: "AAG", description: mechanicalBackground }), /Astral Sea.*stopped aging.*psychic winds/i);

console.log("Player-facing text, species, and background presentation tests passed.");

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;

const coreSource = read("components/NpcForgeCoreSupport.js");
const contextPanelSource = read("components/NpcForgeContextPanelRefined.js");
const artworkSource = read("utils/speciesArtwork.js");
const loreSource = read("utils/speciesLore.js");

for (const token of [
  "useState",
  "expandedSpeciesRows",
  "npc-forge-catalog-expand-toggle",
  "aria-expanded={expanded}",
  "toggleRowExpansion",
  "setRowExpanded(row, true)",
  "SpeciesCatalogPortrait",
  "speciesPortraitArtworkFor",
  "speciesCatalogSummary",
  "npc-forge-catalog-species-summary",
  "npc-forge-catalog-child-check",
  "data-selected-portrait",
]) assert.ok(coreSource.includes(token), `Species catalogue portrait/collapse UI missing ${token}`);
assert.ok(contextPanelSource.includes("speciesPortraitArtworkFor(option.name)"), "large Forge Species hero must use the Forge portrait resolver");
assert.ok(!contextPanelSource.includes("speciesArtworkFor(option.name)"), "large Forge Species hero must not bypass dedicated child portraits");
assert.ok(!/hue-rotate|body:has\(\[data-selected-portrait/.test(coreSource), "obsolete CSS recoloring/crop stand-ins must remain removed");
assert.ok(!coreSource.includes("active && (family || sourceVariants.length) ? \"⌄\" : \"›\""), "expand/collapse must no longer be coupled to active selection state");
assert.ok(coreSource.includes("expanded && parentSelected && family"), "family children must render from independent expanded state");
assert.ok(coreSource.includes("expanded && sourceVariants.length"), "setting children must render from independent expanded state");

for (const token of [
  "SPECIES_DEDICATED_VARIANT_ARTWORK",
  "speciesPortraitArtworkFor",
  "gold-dragonborn",
  "fire-genasi",
  "air-genasi",
  "earth-genasi",
  "water-genasi",
  "hawk-headed-aven",
  "drow",
  "forest-gnome",
  "beasthide-shifter",
  "lorwyn-fairy",
  "shadowmoor-kithkin",
  "dwarf-kaladesh",
  "goblin-dankwood",
  "orc-ixalan",
]) assert.ok(artworkSource.includes(token), `Species variant portrait authority missing ${token}`);

for (const token of [
  "Air genasi",
  "Gold Dragonborn",
  "Hawk-Headed Aven",
  "Drow are an elven lineage",
  "Forest Gnomes",
  "Beasthide Shifters",
  "Lorwyn Fairies",
  "Shadowmoor Kithkin",
  "Innistrad Humans",
  "Kaladesh Dwarves",
  "Ixalan Orcs",
  "Dankwood Goblins",
  "speciesCatalogSummary",
]) assert.ok(loreSource.includes(token), `Species catalogue lore coverage missing ${token}`);

const goldArtworkPath = path.join(root, "public/media/species/gold-dragonborn.webp");
assert.ok(fs.existsSync(goldArtworkPath), "dedicated generated Species artwork missing public/media/species/gold-dragonborn.webp");
assert.ok(fs.statSync(goldArtworkPath).size > 20000, "Gold Dragonborn must contain a real generated image rather than a placeholder");

const dedicatedGenasiCases = [
  ["Air Genasi", "air-genasi.webp", 9000],
  ["Earth Genasi", "earth-genasi.webp", 10000],
  ["Fire Genasi", "fire-genasi.webp", 12000],
  ["Water Genasi", "water-genasi.webp", 11000],
];
for (const [name, fileName, minimumBytes] of dedicatedGenasiCases) {
  const artworkPath = path.join(root, "public/media/species", fileName);
  assert.ok(fs.existsSync(artworkPath), `dedicated generated Species artwork missing public/media/species/${fileName}`);
  assert.ok(fs.statSync(artworkPath).size > minimumBytes, `${name} must contain a real generated image rather than a placeholder`);
  const artwork = fs.readFileSync(artworkPath);
  assert.equal(artwork.subarray(0, 4).toString("ascii"), "RIFF", `${name} dedicated asset must be a valid RIFF WebP container`);
  assert.equal(artwork.subarray(8, 12).toString("ascii"), "WEBP", `${name} dedicated asset must be a valid WebP image`);
}

const { speciesArtworkFor, speciesPortraitArtworkFor, hasDedicatedSpeciesArtwork, hasSpeciesPortraitArtwork } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const { speciesFlavorLore, speciesCatalogSummary } = await import(pathToFileURL(path.join(root, "utils/speciesLore.js")).href);

// Existing canonical artwork contracts remain stable for non-Forge consumers.
for (const name of ["Air Genasi", "Earth Genasi", "Fire Genasi", "Water Genasi"]) {
  assert.equal(speciesArtworkFor(name), "/media/species/genasi.webp", `canonical ${name} source artwork must remain the shared Genasi image outside the Forge`);
}
assert.equal(speciesArtworkFor("Gold Dragonborn"), "/media/species/dragonborn-metallic.webp", "canonical Gold Dragonborn source artwork must remain the metallic family image outside the Forge");
assert.equal(speciesArtworkFor("Amethyst Gem Dragonborn"), "/media/species/dragonborn-gem.webp", "canonical Gem Dragonborn source artwork must remain the Gem family image");
assert.equal(hasDedicatedSpeciesArtwork("Water Genasi"), true, "canonical shared aliases must remain recognized as intentional artwork");

// Dedicated generated files win in the Forge as soon as they are committed.
for (const [name, fileName] of dedicatedGenasiCases) {
  assert.equal(speciesPortraitArtworkFor(name), `/media/species/${fileName}`, `${name} must use its generated dedicated portrait`);
  assert.equal(hasSpeciesPortraitArtwork(name), true, `${name} dedicated generated art must count as Forge portrait coverage`);
  assert.ok(speciesFlavorLore(name).length >= 70, `${name} must retain unique lore while dedicated artwork rolls out`);
}
assert.equal(speciesPortraitArtworkFor("Gold Dragonborn"), "/media/species/gold-dragonborn.webp", "Gold Dragonborn must use its generated dedicated portrait");

const portraitCases = [
  ["Amethyst Gem Dragonborn", "amethyst-gem-dragonborn.webp"],
  ["Hawk-Headed Aven", "hawk-headed-aven.webp"],
  ["Drow", "drow.webp"],
  ["Forest Gnome", "forest-gnome.webp"],
  ["Wildhunt Shifter", "wildhunt-shifter.webp"],
  ["Shadowmoor Fairy", "shadowmoor-fairy.webp"],
  ["Lorwyn Kithkin", "lorwyn-kithkin.webp"],
  ["Dwarf (Kaladesh)", "dwarf-kaladesh.webp"],
  ["Goblin (Dankwood)", "goblin-dankwood.webp"],
  ["Orc (Ixalan)", "orc-ixalan.webp"],
];
for (const [name, expected] of portraitCases) {
  assert.ok(speciesPortraitArtworkFor(name).endsWith(expected), `${name} must retain its dedicated Forge portrait presentation`);
  assert.equal(hasSpeciesPortraitArtwork(name), true, `${name} must be recognized as having intentional Forge portrait coverage`);
  const lore = speciesFlavorLore(name);
  assert.ok(lore.length >= 70, `${name} must have a meaningful unique description`);
  const summary = speciesCatalogSummary(name);
  assert.ok(summary.length >= 30 && summary.length <= 109, `${name} must have a compact catalogue summary`);
}

assert.equal(hasSpeciesPortraitArtwork("Gold Dragonborn"), true, "Gold Dragonborn dedicated generated art must count as Forge portrait coverage");
assert.ok(speciesFlavorLore("Gold Dragonborn").length >= 70, "Gold Dragonborn must retain unique lore while dedicated artwork rolls out");
assert.equal(speciesPortraitArtworkFor("Human (Innistrad)"), "/media/species/human-innistrad.webp", "existing dedicated setting artwork must remain authoritative in the Forge");
assert.match(speciesFlavorLore("Water Genasi"), /breathe both air and water/i, "Water Genasi description must remain lineage-specific");
assert.match(speciesFlavorLore("Ibis-Headed Aven"), /broad, angular wings|disciplined thought/i, "Ibis-Headed Aven description must preserve non-campaign-specific source identity");
assert.match(speciesFlavorLore("Gold Dragonborn"), /fire-linked ancestry/i, "Gold Dragonborn description must be ancestry-specific without personality stereotyping");
assert.doesNotMatch(speciesFlavorLore("Hawk-Headed Aven"), /Naktamun|Hekma|God-Pharaoh/i, "Aven catalogue lore must omit campaign-specific plot language");

for (const source of [coreSource, artworkSource, loreSource]) assert.ok(!protectedPattern.test(source), "Species portrait/catalogue work crossed a protected map/travel boundary");

console.log("Forge Species catalogue portraits validated: expandable parents have independent chevrons, parent/child rows carry concise unique lore, canonical artwork remains stable outside the Forge, completed variants use real dedicated Forge assets without temporary recolor stand-ins, and protected map/travel boundaries remain untouched.");

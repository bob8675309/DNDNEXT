import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;
const artworkSource = fs.readFileSync(path.join(root, "utils/speciesArtwork.js"), "utf8");

const cases = [
  ["Black Dragonborn", "black-dragonborn.webp", 3500],
  ["Blue Dragonborn", "blue-dragonborn.webp", 5000],
  ["Green Dragonborn", "green-dragonborn.webp", 5000],
  ["Red Dragonborn", "red-dragonborn.webp", 5000],
  ["White Dragonborn", "white-dragonborn.webp", 5000],
];

for (const [name, fileName, minimumBytes] of cases) {
  const artworkPath = path.join(root, "public/media/species", fileName);
  assert.ok(fs.existsSync(artworkPath), `dedicated Chromatic Dragonborn artwork missing ${fileName}`);
  assert.ok(fs.statSync(artworkPath).size > minimumBytes, `${name} must contain a real generated image rather than a placeholder`);
  const artwork = fs.readFileSync(artworkPath);
  assert.equal(artwork.subarray(0, 4).toString("ascii"), "RIFF", `${name} must be a valid RIFF WebP container`);
  assert.equal(artwork.subarray(8, 12).toString("ascii"), "WEBP", `${name} must be a valid WebP image`);
}

const { speciesArtworkFor, speciesPortraitArtworkFor, hasSpeciesPortraitArtwork } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const { speciesFlavorLore } = await import(pathToFileURL(path.join(root, "utils/speciesLore.js")).href);

for (const [name, fileName] of cases) {
  assert.equal(speciesArtworkFor(name), "/media/species/dragonborn-chromatic.webp", `canonical ${name} artwork must stay on the shared Chromatic source image outside the Forge`);
  assert.equal(speciesPortraitArtworkFor(name), `/media/species/${fileName}`, `${name} must use its dedicated generated artwork in the Forge`);
  assert.equal(hasSpeciesPortraitArtwork(name), true, `${name} must count as intentional Forge portrait coverage`);
  assert.ok(speciesFlavorLore(name).length >= 70, `${name} must retain a meaningful ancestry-specific description`);
}

assert.equal(speciesPortraitArtworkFor("Gold Dragonborn"), "/media/species/gold-dragonborn.webp", "Gold Dragonborn dedicated Forge artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Brass Dragonborn"), "/media/species/brass-dragonborn.webp", "completed Metallic Dragonborn artwork must remain dedicated after the Chromatic pass");
assert.equal(speciesPortraitArtworkFor("Amethyst Gem Dragonborn"), "/media/species/amethyst-gem-dragonborn.webp", "completed Gem Dragonborn artwork must remain dedicated after the Chromatic pass");
assert.ok(!protectedPattern.test(artworkSource), "Chromatic Dragonborn artwork work crossed a protected map/travel boundary");

console.log("Chromatic Dragonborn Forge artwork validated: Black, Blue, Green, Red, and White use real dedicated WebP assets in the Forge, canonical shared artwork stays stable outside the Forge, completed Metallic/Gem artwork remains compatible, and protected map/travel boundaries remain untouched.");
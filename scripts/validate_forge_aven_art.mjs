import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;
const artworkSource = fs.readFileSync(path.join(root, "utils/speciesArtwork.js"), "utf8");

const cases = [
  ["Hawk-Headed Aven", "hawk-headed-aven.webp", 20000, /heads of hawks|birds of prey|quick, controlled flight/i],
  ["Ibis-Headed Aven", "ibis-headed-aven.webp", 20000, /long-necked ibis features|broad, angular wings|disciplined thought/i],
];

for (const [name, fileName, minimumBytes] of cases) {
  const artworkPath = path.join(root, "public/media/species", fileName);
  assert.ok(fs.existsSync(artworkPath), `dedicated Aven artwork missing ${fileName}`);
  assert.ok(fs.statSync(artworkPath).size > minimumBytes, `${name} must contain a real generated image rather than a placeholder`);
  const artwork = fs.readFileSync(artworkPath);
  assert.equal(artwork.subarray(0, 4).toString("ascii"), "RIFF", `${name} must be a valid RIFF WebP container`);
  assert.equal(artwork.subarray(8, 12).toString("ascii"), "WEBP", `${name} must be a valid WebP image`);
}

const { speciesArtworkFor, speciesPortraitArtworkFor, hasSpeciesPortraitArtwork } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const { speciesFlavorLore } = await import(pathToFileURL(path.join(root, "utils/speciesLore.js")).href);

assert.equal(speciesArtworkFor("Aven"), "/media/species/aven.webp", "canonical Aven artwork must remain the shared parent image outside the Forge");
for (const [name, fileName, , lorePattern] of cases) {
  assert.equal(speciesArtworkFor(name), "/media/species/aven.webp", `canonical ${name} artwork must stay on the shared Aven source image outside the Forge`);
  assert.equal(speciesPortraitArtworkFor(name), `/media/species/${fileName}`, `${name} must use its dedicated generated artwork in the Forge`);
  assert.equal(hasSpeciesPortraitArtwork(name), true, `${name} must count as intentional Forge portrait coverage`);
  const lore = speciesFlavorLore(name);
  assert.ok(lore.length >= 70, `${name} must retain a meaningful subrace-specific description`);
  assert.match(lore, lorePattern, `${name} lore must preserve its source-backed physical identity`);
  assert.doesNotMatch(lore, /Naktamun|Hekma|God-Pharaoh/i, `${name} catalogue lore must remain free of campaign-specific plot language`);
}

assert.equal(speciesPortraitArtworkFor("Amethyst Gem Dragonborn"), "/media/species/amethyst-gem-dragonborn.webp", "completed Gem Dragonborn artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Black Dragonborn"), "/media/species/black-dragonborn.webp", "completed Chromatic Dragonborn artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Gold Dragonborn"), "/media/species/gold-dragonborn.webp", "completed Metallic Dragonborn artwork must remain intact");
assert.ok(!protectedPattern.test(artworkSource), "Aven artwork work crossed a protected map/travel boundary");

console.log("Aven Forge artwork validated: Hawk-Headed and Ibis-Headed Aven use real dedicated WebP assets in the Forge; canonical Aven artwork remains stable outside the Forge; source-backed lore stays distinct; completed Dragonborn artwork remains intact; and protected map/travel boundaries remain untouched.");
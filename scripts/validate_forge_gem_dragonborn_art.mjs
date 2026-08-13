import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;
const artworkSource = fs.readFileSync(path.join(root, "utils/speciesArtwork.js"), "utf8");

const cases = [
  ["Amethyst Gem Dragonborn", "amethyst-gem-dragonborn.webp", /force-linked ancestry/i],
  ["Crystal Gem Dragonborn", "crystal-gem-dragonborn.webp", /radiant-linked ancestry/i],
  ["Emerald Gem Dragonborn", "emerald-gem-dragonborn.webp", /psychic-linked ancestry/i],
  ["Sapphire Gem Dragonborn", "sapphire-gem-dragonborn.webp", /thunder-linked ancestry/i],
  ["Topaz Gem Dragonborn", "topaz-gem-dragonborn.webp", /necrotic-linked ancestry/i],
];

for (const [name, fileName] of cases) {
  const artworkPath = path.join(root, "public/media/species", fileName);
  assert.ok(fs.existsSync(artworkPath), `dedicated Gem Dragonborn artwork missing ${fileName}`);
  assert.ok(fs.statSync(artworkPath).size > 7000, `${name} must contain a real generated image rather than a placeholder`);
  const artwork = fs.readFileSync(artworkPath);
  assert.equal(artwork.subarray(0, 4).toString("ascii"), "RIFF", `${name} must be a valid RIFF WebP container`);
  assert.equal(artwork.subarray(8, 12).toString("ascii"), "WEBP", `${name} must be a valid WebP image`);
}

const { speciesArtworkFor, speciesPortraitArtworkFor, hasSpeciesPortraitArtwork } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const { speciesFlavorLore } = await import(pathToFileURL(path.join(root, "utils/speciesLore.js")).href);

for (const [name, fileName, lorePattern] of cases) {
  assert.equal(speciesArtworkFor(name), "/media/species/dragonborn-gem.webp", `canonical ${name} artwork must stay on the shared Gem source image outside the Forge`);
  assert.equal(speciesPortraitArtworkFor(name), `/media/species/${fileName}`, `${name} must use its dedicated generated artwork in the Forge`);
  assert.equal(hasSpeciesPortraitArtwork(name), true, `${name} must count as intentional Forge portrait coverage`);
  const lore = speciesFlavorLore(name);
  assert.ok(lore.length >= 70, `${name} must retain a meaningful ancestry-specific description`);
  assert.match(lore, lorePattern, `${name} lore must preserve its ancestry-specific damage affinity`);
}

assert.equal(speciesPortraitArtworkFor("Black Dragonborn"), "/media/species/black-dragonborn.webp", "Chromatic Dragonborn dedicated artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Brass Dragonborn"), "/media/species/brass-dragonborn.webp", "Metallic Dragonborn dedicated artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Gold Dragonborn"), "/media/species/gold-dragonborn.webp", "Gold Dragonborn dedicated artwork must remain intact");
assert.ok(!protectedPattern.test(artworkSource), "Gem Dragonborn artwork work crossed a protected map/travel boundary");

console.log("Gem Dragonborn Forge artwork validated: Amethyst, Crystal, Emerald, Sapphire, and Topaz use real dedicated WebP assets in the Forge; canonical shared Gem artwork remains stable outside the Forge; Chromatic/Metallic artwork remains intact; ancestry lore stays distinct; and protected map/travel boundaries remain untouched.");

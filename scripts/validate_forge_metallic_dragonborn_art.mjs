import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;
const artworkSource = fs.readFileSync(path.join(root, "utils/speciesArtwork.js"), "utf8");

const cases = [
  ["Brass Dragonborn", "brass-dragonborn.webp", 9000, /fire-linked ancestry/i],
  ["Bronze Dragonborn", "bronze-dragonborn.webp", 9000, /lightning-linked ancestry/i],
  ["Copper Dragonborn", "copper-dragonborn.webp", 9000, /acid-linked ancestry/i],
  ["Silver Dragonborn", "silver-dragonborn.webp", 9000, /cold-linked ancestry/i],
];

for (const [name, fileName, minimumBytes] of cases) {
  const artworkPath = path.join(root, "public/media/species", fileName);
  assert.ok(fs.existsSync(artworkPath), `dedicated Metallic Dragonborn artwork missing ${fileName}`);
  assert.ok(fs.statSync(artworkPath).size > minimumBytes, `${name} must contain a real generated image rather than a placeholder`);
  const artwork = fs.readFileSync(artworkPath);
  assert.equal(artwork.subarray(0, 4).toString("ascii"), "RIFF", `${name} must be a valid RIFF WebP container`);
  assert.equal(artwork.subarray(8, 12).toString("ascii"), "WEBP", `${name} must be a valid WebP image`);
}

const { speciesArtworkFor, speciesPortraitArtworkFor, hasSpeciesPortraitArtwork } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const { speciesFlavorLore } = await import(pathToFileURL(path.join(root, "utils/speciesLore.js")).href);

for (const [name, fileName, , lorePattern] of cases) {
  assert.equal(speciesArtworkFor(name), "/media/species/dragonborn-metallic.webp", `canonical ${name} artwork must stay on the shared Metallic source image outside the Forge`);
  assert.equal(speciesPortraitArtworkFor(name), `/media/species/${fileName}`, `${name} must use its dedicated generated artwork in the Forge`);
  assert.equal(hasSpeciesPortraitArtwork(name), true, `${name} must count as intentional Forge portrait coverage`);
  const lore = speciesFlavorLore(name);
  assert.ok(lore.length >= 70, `${name} must retain a meaningful ancestry-specific description`);
  assert.match(lore, lorePattern, `${name} lore must preserve its ancestry-specific damage affinity`);
}

assert.equal(speciesArtworkFor("Gold Dragonborn"), "/media/species/dragonborn-metallic.webp", "canonical Gold Dragonborn artwork must remain the shared Metallic source image outside the Forge");
assert.equal(speciesPortraitArtworkFor("Gold Dragonborn"), "/media/species/gold-dragonborn.webp", "Gold Dragonborn dedicated Forge artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Amethyst Gem Dragonborn"), "/media/species/amethyst-gem-dragonborn.webp", "completed Gem Dragonborn artwork must remain dedicated after the Metallic pass");
assert.ok(!protectedPattern.test(artworkSource), "Metallic Dragonborn artwork work crossed a protected map/travel boundary");

console.log("Metallic Dragonborn Forge artwork validated: Brass, Bronze, Copper, Gold, and Silver use dedicated Forge artwork while canonical shared Metallic artwork remains stable outside the Forge; completed Gem artwork remains compatible; ancestry lore stays distinct; and protected map/travel boundaries remain untouched.");
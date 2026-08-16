import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;
const artworkSource = fs.readFileSync(path.join(root, "utils/speciesArtwork.js"), "utf8");
const expansionSource = fs.readFileSync(path.join(root, "utils/speciesCatalogExpansion.js"), "utf8");
const expectedWidth = 1536;
const expectedHeight = 2048;

function readWebPDimensions(artwork, name) {
  assert.equal(artwork.subarray(0, 4).toString("ascii"), "RIFF", `${name} must be a valid RIFF WebP container`);
  assert.equal(artwork.subarray(8, 12).toString("ascii"), "WEBP", `${name} must be a valid WebP image`);
  assert.equal(artwork.subarray(12, 16).toString("ascii"), "VP8 ", `${name} must use the supported lossy VP8 WebP encoding`);
  assert.deepEqual([...artwork.subarray(23, 26)], [0x9d, 0x01, 0x2a], `${name} must contain a valid VP8 frame header`);
  return {
    width: artwork.readUInt16LE(26) & 0x3fff,
    height: artwork.readUInt16LE(28) & 0x3fff,
  };
}

const cases = [
  ["Beasthide Shifter", "beasthide-shifter.webp", /thickened|durable|toughness|protection/i],
  ["Longtooth Shifter", "longtooth-shifter.webp", /pronounced fangs|close combat|biting attack/i],
  ["Swiftstride Shifter", "swiftstride-shifter.webp", /leaner and faster|movement|repositioning|speed/i],
  ["Wildhunt Shifter", "wildhunt-shifter.webp", /heightened instincts|awareness|Wisdom|nearby enemies/i],
];

for (const [name, fileName] of cases) {
  const artworkPath = path.join(root, "public/media/species", fileName);
  assert.ok(fs.existsSync(artworkPath), `dedicated Shifter artwork missing ${fileName}`);
  assert.ok(fs.statSync(artworkPath).size > 20000, `${name} must contain a real generated image rather than a placeholder`);
  const dimensions = readWebPDimensions(fs.readFileSync(artworkPath), name);
  assert.deepEqual(dimensions, { width: expectedWidth, height: expectedHeight }, `${name} must be a high-resolution 3:4 portrait`);
}

const { speciesArtworkFor, speciesPortraitArtworkFor, hasSpeciesPortraitArtwork } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const { speciesFlavorLore } = await import(pathToFileURL(path.join(root, "utils/speciesLore.js")).href);

for (const [name, fileName, lorePattern] of cases) {
  assert.equal(speciesArtworkFor(name), "/media/species/shifter.webp", `canonical ${name} artwork must stay on the shared Shifter image outside the Forge`);
  assert.equal(speciesPortraitArtworkFor(name), `/media/species/${fileName}`, `${name} must use its dedicated generated artwork in the Forge`);
  assert.equal(hasSpeciesPortraitArtwork(name), true, `${name} must count as intentional Forge portrait coverage`);
  const lore = speciesFlavorLore(name);
  assert.ok(lore.length >= 70, `${name} must retain a meaningful form-specific description`);
  assert.match(lore, lorePattern, `${name} lore must preserve its Shifting form identity`);
}

for (const token of [
  'parentName: "Shifter"',
  'id: "shifter-subtype"',
  'traitName: "Shifting"',
  'displayName: (label) => `${label} Shifter`',
]) assert.ok(expansionSource.includes(token), `Shifter must retain its source-owned parent choice model: missing ${token}`);

assert.equal(speciesPortraitArtworkFor("Drow"), "/media/species/drow.webp", "completed Elf artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Hawk-Headed Aven"), "/media/species/hawk-headed-aven.webp", "completed Aven artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Amethyst Gem Dragonborn"), "/media/species/amethyst-gem-dragonborn.webp", "completed Gem Dragonborn artwork must remain intact");
assert.ok(!protectedPattern.test(artworkSource), "Shifter artwork work crossed a protected map/travel boundary");
assert.ok(!protectedPattern.test(expansionSource), "Shifter source-choice work crossed a protected map/travel boundary");

console.log("Shifter Forge artwork validated: Beasthide, Longtooth, Swiftstride, and Wildhunt use 1536x2048 dedicated WebP assets in the Forge; canonical shared Shifter artwork remains stable outside the Forge; the parent-persisted Shifting choice remains source-owned; completed family artwork remains intact; form lore stays distinct; and protected map/travel boundaries remain untouched.");

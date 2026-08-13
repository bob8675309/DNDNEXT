import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;
const artworkSource = fs.readFileSync(path.join(root, "utils/speciesArtwork.js"), "utf8");
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
  ["Drow", "drow.webp", 10000, "elf", /exceptional Darkvision|shadow-and-faerie/i],
  ["High Elf", "high-elf.webp", 12000, "elf", /arcane tradition|flexible cantrip|teleportation/i],
  ["Wood Elf", "wood-elf.webp", 10000, "elf", /swift-footed|wilderness magic|increased speed/i],
  ["Forest Gnome", "forest-gnome.webp", 11000, "gnome", /subtle illusion|small animals|woodland/i],
  ["Rock Gnome", "rock-gnome.webp", 11000, "gnome", /practical invention|mending|mechanical devices/i],
];

for (const [name, fileName, minimumBytes] of cases) {
  const artworkPath = path.join(root, "public/media/species", fileName);
  assert.ok(fs.existsSync(artworkPath), `dedicated Elf/Gnome artwork missing ${fileName}`);
  assert.ok(fs.statSync(artworkPath).size > minimumBytes, `${name} must contain a real generated image rather than a placeholder`);
  const dimensions = readWebPDimensions(fs.readFileSync(artworkPath), name);
  assert.deepEqual(dimensions, { width: expectedWidth, height: expectedHeight }, `${name} must be a high-resolution 3:4 portrait`);
}

const { speciesArtworkFor, speciesPortraitArtworkFor, hasSpeciesPortraitArtwork } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const { speciesFlavorLore } = await import(pathToFileURL(path.join(root, "utils/speciesLore.js")).href);

for (const [name, fileName, , parentKey, lorePattern] of cases) {
  assert.equal(speciesArtworkFor(name), `/media/species/${parentKey}.webp`, `canonical ${name} artwork must stay on the shared ${parentKey} image outside the Forge`);
  assert.equal(speciesPortraitArtworkFor(name), `/media/species/${fileName}`, `${name} must use its dedicated generated artwork in the Forge`);
  assert.equal(hasSpeciesPortraitArtwork(name), true, `${name} must count as intentional Forge portrait coverage`);
  const lore = speciesFlavorLore(name);
  assert.ok(lore.length >= 70, `${name} must retain a meaningful lineage-specific description`);
  assert.match(lore, lorePattern, `${name} lore must preserve its lineage identity`);
}

assert.equal(speciesPortraitArtworkFor("Hawk-Headed Aven"), "/media/species/hawk-headed-aven.webp", "completed Aven artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Amethyst Gem Dragonborn"), "/media/species/amethyst-gem-dragonborn.webp", "completed Gem Dragonborn artwork must remain intact");
assert.ok(!protectedPattern.test(artworkSource), "Elf/Gnome artwork work crossed a protected map/travel boundary");

console.log("Elf/Gnome Forge artwork validated: Drow, High Elf, Wood Elf, Forest Gnome, and Rock Gnome use 1536x2048 dedicated WebP assets in the Forge; canonical shared Elf/Gnome artwork remains stable outside the Forge; completed Aven/Gem artwork remains intact; lineage lore stays distinct; and protected map/travel boundaries remain untouched.");

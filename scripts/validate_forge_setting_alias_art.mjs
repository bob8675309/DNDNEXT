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
  assert.ok(artwork.length >= 30, `${name} must contain a complete WebP frame`);
  assert.equal(artwork.subarray(0, 4).toString("ascii"), "RIFF", `${name} must be a valid RIFF WebP container`);
  assert.equal(artwork.readUInt32LE(4) + 8, artwork.length, `${name} RIFF container must not be truncated`);
  assert.equal(artwork.subarray(8, 12).toString("ascii"), "WEBP", `${name} must be a valid WebP image`);
  assert.equal(artwork.subarray(12, 16).toString("ascii"), "VP8 ", `${name} must use the supported lossy VP8 WebP encoding`);
  const frameLength = artwork.readUInt32LE(16);
  assert.ok(20 + frameLength + (frameLength % 2) <= artwork.length, `${name} VP8 frame payload must be complete`);
  assert.deepEqual([...artwork.subarray(23, 26)], [0x9d, 0x01, 0x2a], `${name} must contain a valid VP8 frame header`);
  return {
    width: artwork.readUInt16LE(26) & 0x3fff,
    height: artwork.readUInt16LE(28) & 0x3fff,
  };
}

const cases = [
  ["Dwarf (Kaladesh)", "dwarf-kaladesh.webp", "dwarf", /dwarven endurance|craft|ambitious construction|technical traditions/i],
  ["Goblin (Dankwood)", "goblin-dankwood.webp", "goblin", /affinity for small animals|Small or smaller beasts/i],
  ["Orc (Ixalan)", "orc-ixalan.webp", "orc", /seafaring toughness|relentless endurance|difficult to put down/i],
];

for (const [name, fileName] of cases) {
  const artworkPath = path.join(root, "public/media/species", fileName);
  assert.ok(fs.existsSync(artworkPath), `dedicated setting-variant artwork missing ${fileName}`);
  assert.ok(fs.statSync(artworkPath).size > 20000, `${name} must contain a real generated image rather than a placeholder`);
  const dimensions = readWebPDimensions(fs.readFileSync(artworkPath), name);
  assert.deepEqual(dimensions, { width: expectedWidth, height: expectedHeight }, `${name} must be a high-resolution 3:4 portrait`);
}

const { speciesArtworkFor, speciesPortraitArtworkFor, hasSpeciesPortraitArtwork } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const { speciesFlavorLore } = await import(pathToFileURL(path.join(root, "utils/speciesLore.js")).href);

for (const [name, fileName, parentKey, lorePattern] of cases) {
  assert.equal(speciesArtworkFor(name), `/media/species/${parentKey}.webp`, `canonical ${name} artwork must stay on the shared ${parentKey} image outside the Forge`);
  assert.equal(speciesPortraitArtworkFor(name), `/media/species/${fileName}`, `${name} must use its dedicated generated artwork in the Forge`);
  assert.equal(hasSpeciesPortraitArtwork(name), true, `${name} must count as intentional Forge portrait coverage`);
  const lore = speciesFlavorLore(name);
  assert.ok(lore.length >= 70, `${name} must retain a meaningful source-specific description`);
  assert.match(lore, lorePattern, `${name} lore must preserve its source-setting identity`);
}

for (const token of [
  '{ parentName: "Dwarf", parentSource: "XPHB", children: [["Dwarf (Kaladesh)", "PSK"]] }',
  '{ parentName: "Goblin", parentSource: "MPMM", children: [["Goblin (Dankwood)", "AWM"]] }',
  '{ parentName: "Orc", parentSource: "XPHB", children: [["Orc (Ixalan)", "PSX"]] }',
  "catalogSourceVariants: children.map",
  "catalogHidden: true",
]) assert.ok(expansionSource.includes(token), `setting variants must retain the existing catalogue-source grouping model: missing ${token}`);

assert.equal(speciesPortraitArtworkFor("Lorwyn Fairy"), "/media/species/lorwyn-fairy.webp", "completed Fairy artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Beasthide Shifter"), "/media/species/beasthide-shifter.webp", "completed Shifter artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Drow"), "/media/species/drow.webp", "completed Elf artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Hawk-Headed Aven"), "/media/species/hawk-headed-aven.webp", "completed Aven artwork must remain intact");

for (const source of [artworkSource, expansionSource]) {
  assert.ok(!protectedPattern.test(source), "setting-variant artwork work crossed a protected map/travel boundary");
}

console.log("Setting-variant Forge artwork validated: Dwarf (Kaladesh), Goblin (Dankwood), and Orc (Ixalan) use complete 1536x2048 dedicated WebP assets in the Forge; canonical parent artwork remains stable outside the Forge; source-setting lore and existing catalogue grouping stay intact; completed family artwork is preserved; and protected map/travel boundaries remain untouched.");

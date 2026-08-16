import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;
const artworkSource = fs.readFileSync(path.join(root, "utils/speciesArtwork.js"), "utf8");
const expansionSource = fs.readFileSync(path.join(root, "utils/speciesCatalogExpansion.js"), "utf8");
const catalogSource = fs.readFileSync(path.join(root, "utils/npcForgeCatalog.js"), "utf8");
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
  ["Lorwyn Fairy", "lorwyn-fairy.webp", "fairy", /bright-winged|natural flight|faerie magic|without the deeper darkness/i],
  ["Shadowmoor Fairy", "shadowmoor-fairy.webp", "fairy", /dusk-adapted|Darkvision|flight|faerie magic/i],
  ["Lorwyn Kithkin", "lorwyn-kithkin.webp", "kithkin", /communal awareness|shared feeling|trust|sturdy resolve/i],
  ["Shadowmoor Kithkin", "shadowmoor-kithkin.webp", "kithkin", /empathic bonds|Darkvision|shadowed lineage/i],
];

for (const [name, fileName] of cases) {
  const artworkPath = path.join(root, "public/media/species", fileName);
  assert.ok(fs.existsSync(artworkPath), `dedicated Fairy/Kithkin artwork missing ${fileName}`);
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
  assert.ok(lore.length >= 70, `${name} must retain a meaningful lineage-specific description`);
  assert.match(lore, lorePattern, `${name} lore must preserve its source lineage identity`);
}

for (const token of [
  'parentName: "Fairy"',
  'id: "faerie-lineage"',
  'traitName: "Faerie Lineage"',
  'displayName: (label) => `${label} Fairy`',
  'parentName: "Kithkin"',
  'id: "kithkin-lineage"',
  'traitName: "Kithkin Lineage"',
  'displayName: (label) => `${label} Kithkin`',
]) assert.ok(expansionSource.includes(token), `Fairy/Kithkin must retain the source-owned parent choice model: missing ${token}`);

assert.equal(
  (expansionSource.match(/lorwyn: \{ artworkName: "Lorwyn (?:Fairy|Kithkin)", darkvision: null \}, shadowmoor: \{ artworkName: "Shadowmoor (?:Fairy|Kithkin)", darkvision: 120 \}/g) || []).length,
  2,
  "Fairy and Kithkin must keep neutral Lorwyn presentation and project 120-foot Darkvision only for Shadowmoor",
);
assert.ok(catalogSource.includes('new Set(["faerie-lineage", "kithkin-lineage"])'), "Fairy and Kithkin must keep the existing standalone source-choice persistence bridge");

assert.equal(speciesPortraitArtworkFor("Beasthide Shifter"), "/media/species/beasthide-shifter.webp", "completed Shifter artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Drow"), "/media/species/drow.webp", "completed Elf artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Hawk-Headed Aven"), "/media/species/hawk-headed-aven.webp", "completed Aven artwork must remain intact");
assert.equal(speciesPortraitArtworkFor("Amethyst Gem Dragonborn"), "/media/species/amethyst-gem-dragonborn.webp", "completed Gem Dragonborn artwork must remain intact");
for (const source of [artworkSource, expansionSource, catalogSource]) {
  assert.ok(!protectedPattern.test(source), "Fairy/Kithkin artwork work crossed a protected map/travel boundary");
}

console.log("Fairy/Kithkin Forge artwork validated: Lorwyn and Shadowmoor variants use complete 1536x2048 dedicated WebP assets in the Forge; canonical Fairy and Kithkin artwork remains stable outside the Forge; source-owned lineage choices and Shadowmoor-only Darkvision remain intact; completed family artwork is preserved; lineage lore stays distinct; and protected map/travel boundaries remain untouched.");

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;

const families = {
  Genasi: ["air-genasi", "earth-genasi", "fire-genasi", "water-genasi"],
  Chromatic: ["black-dragonborn", "blue-dragonborn", "green-dragonborn", "red-dragonborn", "white-dragonborn"],
  Metallic: ["brass-dragonborn", "bronze-dragonborn", "copper-dragonborn", "gold-dragonborn", "silver-dragonborn"],
  Gem: ["amethyst-gem-dragonborn", "crystal-gem-dragonborn", "emerald-gem-dragonborn", "sapphire-gem-dragonborn", "topaz-gem-dragonborn"],
  Aven: ["hawk-headed-aven", "ibis-headed-aven"],
};

function webpDimensions(buffer) {
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF", "portrait must be a RIFF container");
  assert.equal(buffer.subarray(8, 12).toString("ascii"), "WEBP", "portrait must be a WebP image");
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "VP8 ", "portrait must contain a complete lossy VP8 payload");
  assert.deepEqual([...buffer.subarray(23, 26)], [0x9d, 0x01, 0x2a], "portrait must contain a complete VP8 keyframe header");
  return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
}

const allHashes = new Map();
for (const [family, keys] of Object.entries(families)) {
  const familyHashes = new Set();
  for (const key of keys) {
    const fileName = `${key}.webp`;
    const artworkPath = path.join(root, "public/media/species", fileName);
    assert.ok(fs.existsSync(artworkPath), `${family} portrait missing ${fileName}`);
    const artwork = fs.readFileSync(artworkPath);
    assert.ok(artwork.length > 100000, `${family} portrait ${fileName} must be a high-resolution production asset`);
    assert.deepEqual(webpDimensions(artwork), { width: 1536, height: 2048 }, `${fileName} must be exact 1536 × 2048 (3:4)`);
    const hash = crypto.createHash("sha256").update(artwork).digest("hex");
    assert.ok(!familyHashes.has(hash), `${family} contains an exact duplicate portrait: ${fileName}`);
    assert.ok(!allHashes.has(hash), `${fileName} exactly duplicates ${allHashes.get(hash)}`);
    familyHashes.add(hash);
    allHashes.set(hash, fileName);
  }
}

const { normalizeSpeciesArtworkKey, speciesArtworkFor, speciesPortraitArtworkFor } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const rawNameCases = [
  ["Genasi (Air)", "air-genasi", "/media/species/genasi.webp"],
  ["Genasi (Earth)", "earth-genasi", "/media/species/genasi.webp"],
  ["Genasi (Fire)", "fire-genasi", "/media/species/genasi.webp"],
  ["Genasi (Water)", "water-genasi", "/media/species/genasi.webp"],
  ["Aven (Hawk-Headed)", "hawk-headed-aven", "/media/species/aven.webp"],
  ["Aven (Ibis-Headed)", "ibis-headed-aven", "/media/species/aven.webp"],
];
for (const [rawName, key, canonical] of rawNameCases) {
  assert.equal(normalizeSpeciesArtworkKey(rawName), key, `${rawName} raw catalogue name must normalize to its dedicated key`);
  assert.equal(speciesPortraitArtworkFor(rawName), `/media/species/${key}.webp`, `${rawName} must use its dedicated Forge portrait`);
  assert.equal(speciesArtworkFor(rawName), canonical, `${rawName} must retain its canonical non-Forge family image`);
}

const coreSource = read("components/NpcForgeCoreSupport.js");
const contextSource = read("components/NpcForgeContextPanelRefined.js");
const importerSource = read("scripts/import_5etools_character_options_refined.mjs");
for (const source of [coreSource, contextSource, importerSource]) assert.ok(!protectedPattern.test(source), "Species portrait/import work crossed a protected map/travel boundary");
assert.ok(contextSource.includes("speciesPortraitArtworkFor(option.name)"), "large Forge Species hero must use the dedicated portrait resolver");
assert.ok(!/hue-rotate|body:has\(\[data-selected-portrait/.test(coreSource), "dedicated portraits must not be altered by legacy recolor filters");
assert.ok(importerSource.includes("description: fullDescription(row.entries || [])"), "Species importer must retain full flattened descriptions");
assert.ok(importerSource.includes("This command never writes directly to Supabase."), "Species import must remain preview/review only");

console.log("Forge Species portrait integrity validated: all 21 regenerated Genasi/Dragonborn/Aven files are unique complete 1536 × 2048 WebPs; raw parenthetical catalogue names route correctly; the large Forge hero uses dedicated portraits; legacy recolor filters are gone; the Species importer retains full descriptions without writing to Supabase; and protected map/travel boundaries remain untouched.");

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;

const cases = [
  ["Accursed", "accursed"],
  ["Arisen", "arisen"],
  ["Disembodied", "disembodied"],
  ["Downcast", "downcast"],
  ["Dreamer", "dreamer"],
  ["Grudgel", "grudgel"],
  ["Laneshi", "laneshi"],
  ["Ogresh", "ogresh"],
  ["Wechselkind", "wechselkind"],
  ["Wulven", "wulven"],
];

const sourceVariantCases = [
  ["Dhampir (Grim Hollow)", "dhampir", "/media/species/cinematic-dhampir.webp", "/media/species/dhampir.webp"],
  ["Dragonborn (Grim Hollow)", "dragonborn", "/media/species/cinematic-dragonborn.webp", "/media/species/dragonborn.webp"],
  ["Dwarf (Grim Hollow)", "dwarf", "/media/species/cinematic-dwarf.webp", "/media/species/dwarf.webp"],
  ["Elf (Grim Hollow)", "elf", "/media/species/cinematic-elf.webp", "/media/species/elf.webp"],
  ["Gnome (Grim Hollow)", "gnome", "/media/species/cinematic-gnome.webp", "/media/species/gnome.webp"],
  ["Halfling (Grim Hollow)", "halfling", "/media/species/cinematic-halfling.webp", "/media/species/halfling.webp"],
  ["Human (Grim Hollow)", "human", "/media/species/cinematic-human.webp", "/media/species/human.webp"],
];

function webpDimensions(buffer) {
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF", "portrait must be a RIFF container");
  assert.equal(buffer.subarray(8, 12).toString("ascii"), "WEBP", "portrait must be a WebP image");
  const chunk = buffer.subarray(12, 16).toString("ascii");
  if (chunk === "VP8 ") {
    assert.deepEqual([...buffer.subarray(23, 26)], [0x9d, 0x01, 0x2a], "lossy WebP must contain a complete VP8 keyframe header");
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8X") {
    return {
      width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
      height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16),
    };
  }
  if (chunk === "VP8L") {
    const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
    return {
      width: 1 + (b1 | ((b2 & 0x3f) << 8)),
      height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)),
    };
  }
  throw new Error(`unsupported WebP chunk ${chunk}`);
}

const {
  hasSpeciesPortraitArtwork,
  normalizeSpeciesArtworkKey,
  speciesArtworkFor,
  speciesPortraitArtworkFor,
} = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);

const hashes = new Set();
for (const [name, key] of cases) {
  const expected = `/media/species/cinematic-${key}.webp`;
  assert.equal(normalizeSpeciesArtworkKey(name), key, `${name} must normalize to its dedicated artwork key`);
  assert.equal(speciesPortraitArtworkFor(name), expected, `${name} must use its approved cinematic Forge portrait`);
  assert.equal(speciesArtworkFor(name), expected, `${name} must not fall through to neutral non-Forge artwork`);
  assert.equal(hasSpeciesPortraitArtwork(name), true, `${name} must count as intentional portrait coverage`);
  assert.notEqual(speciesPortraitArtworkFor(name), "/media/species/adventurer.webp", `${name} must never use the neutral placeholder`);

  const file = path.join(root, "public", expected.replace(/^\/+/, ""));
  assert.ok(fs.existsSync(file), `${name} portrait is missing ${expected}`);
  const artwork = fs.readFileSync(file);
  assert.ok(artwork.length > 50_000, `${name} portrait must be a production-quality asset`);
  assert.deepEqual(webpDimensions(artwork), { width: 720, height: 960 }, `${name} must be exact 720 × 960 (3:4), matching the established cinematic Species portrait system`);
  const hash = crypto.createHash("sha256").update(artwork).digest("hex");
  assert.ok(!hashes.has(hash), `${name} must not exactly duplicate another Grim Hollow portrait`);
  hashes.add(hash);
}

for (const [name, key, portrait, canonical] of sourceVariantCases) {
  assert.equal(normalizeSpeciesArtworkKey(name), key, `${name} must reuse its established parent Species artwork identity`);
  assert.equal(speciesPortraitArtworkFor(name), portrait, `${name} must reuse the established cinematic parent portrait rather than a placeholder`);
  assert.equal(speciesArtworkFor(name), canonical, `${name} must retain the established canonical non-Forge parent artwork`);
  assert.equal(hasSpeciesPortraitArtwork(name), true, `${name} must count as intentional portrait coverage`);
}

const artworkSource = fs.readFileSync(path.join(root, "utils/speciesArtwork.js"), "utf8");
assert.ok(!protectedPattern.test(artworkSource), "Grim Hollow Species artwork work crossed a protected map/travel boundary");

console.log("Grim Hollow Species art validated: 10/10 new Species use unique approved 720 × 960 cinematic WebPs, all seven same-name source variants reuse established parent portraits, no Grim Hollow Species falls through to adventurer.webp, and protected map/travel boundaries remain untouched.");

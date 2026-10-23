import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const dir = "public/npc-portraits/library/player-species-20261021";
const sqlFile = "sql/20261023_01_player_species_portrait_library.sql";
const expected = new Map([
  ["wechselkind", 11], ["wulven", 2], ["downcast", 2], ["dreamer", 2],
  ["disembodied", 2], ["arisen", 2], ["dhampir", 2], ["accursed", 2], ["laneshi", 2],
]);
const files = fs.readdirSync(dir).sort();
assert.equal(files.length, 27, "Portrait batch must contain exactly 27 image assets.");
const actual = new Map();
const sql = fs.readFileSync(sqlFile, "utf8");
assert.match(sql, /ON CONFLICT \(bucket, storage_path\) DO NOTHING;/);
assert.equal((sql.match(/'repo-static'/g) || []).length, 27, "Exactly 27 idempotent portrait registrations must exist.");
for (const name of files) {
  const parsed = /^profile-([a-z]+)-[a-z0-9-]+\.webp$/.exec(name);
  assert.ok(parsed, `Unexpected asset name: ${name}`);
  const species = parsed[1];
  assert.ok(expected.has(species), `Unexpected species ${species}`);
  actual.set(species, (actual.get(species) || 0) + 1);
  const b = fs.readFileSync(path.join(dir, name));
  assert.ok(b.length >= 200000 && b.length <= 1000000, `Unexpected file size: ${name}`);
  assert.equal(b.toString("ascii", 0, 4), "RIFF");
  assert.equal(b.toString("ascii", 8, 12), "WEBP");
  assert.equal(b.toString("ascii", 12, 16), "VP8 ");
  assert.equal(b.toString("hex", 23, 26), "9d012a");
  assert.equal(b.readUInt16LE(26) & 0x3fff, 939, `Invalid portrait width: ${name}`);
  assert.equal(b.readUInt16LE(28) & 0x3fff, 1252, `Invalid portrait height: ${name}`);
  assert.ok(sql.includes(`/npc-portraits/library/player-species-20261021/${name}`), `Missing SQL registration: ${name}`);
}
assert.deepEqual([...actual].sort(), [...expected].sort(), "Species portrait totals mismatch.");
assert.ok(files.includes("profile-wechselkind-ruins-warlock-refined-20261023.webp"), "Approved revised portrait missing.");
console.log("Verified 27 unique profile portraits, dimensions, file signatures, species distribution and SQL records.");

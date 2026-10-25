// Generated SQL seed for genuine DnDWeb structured-catalogue parity fixtures.
// No database/network calls; no personal character data. Never used in production.
import assert from "node:assert/strict";
import fs from "node:fs";
const path = "scripts/fixtures/common_equipment_catalog_source_snapshot_20261024.json";
const snapshot = JSON.parse(fs.readFileSync(path, "utf8"));
assert.equal(snapshot.snapshotVersion, 1);
assert.equal(snapshot.rows.length, 16);
const byName = new Map(snapshot.rows.map(row => [row.itemName, row]));
assert.equal(byName.size, 16);
for (const row of snapshot.rows) {
  assert.ok(row.itemKey && row.itemName && row.payload, "Missing source identity");
  assert.equal(row.payload.item_key, row.itemKey);
  assert.equal(row.payload.item_name, row.itemName);
  assert.match(row.fullPayloadMd5, /^[0-9a-f]{32}$/);
  // Preserve the exact structured source values. Do not fabricate defaults.
  assert.equal(typeof row.payload, "object");
}
const field = (name, key) => byName.get(name)?.payload[key];
assert.equal(field("Ring of Protection", "bonusSavingThrow"), "+1");
assert.equal(field("Ring of Protection", "bonusAc"), "+1");
assert.equal(field("+2 Ring of Protection", "bonusSavingThrow"), "+2");
assert.equal(field("Cloak of Protection", "bonusSavingThrow"), "+1");
assert.equal(field("Staff of Power", "bonusAc"), "+2");
assert.equal(field("Staff of Power", "bonusSavingThrow"), "+2");
assert.equal(field("Leather Armor", "ac"), 11);
assert.equal(field("Scale Mail", "ac"), 14);
assert.equal(field("Chain Mail", "ac"), 16);
assert.equal(field("Shield", "ac"), 2);
assert.equal(field("Ascendant Scaled Ornament", "modifySpeed").equal.fly, "walk");
assert.equal(field("Gloves of Soul Catching", "ability").static.con, 20);
assert.equal(field("Ioun Stone, Mastery", "bonusProficiencyBonus"), "+1");
assert.equal(field("Robe of the Archmagi", "bonusSpellSaveDc"), "+2");
assert.equal(field("Ring of Fire Resistance", "damageReductionByType").fire, 10);
assert.ok(Array.isArray(field("Staff of Power", "reqAttuneTags")));
const sql = s => "'" + s.replaceAll("'", "''") + "'";
if (process.argv.includes("--verify")) {
  console.log("Real catalogue source snapshot contract passed (16 items).");
} else {
  console.log("-- Structured fields copied from DnDWeb item catalogue; fixture only.");
  for (const row of snapshot.rows) {
    console.log("insert into public.items_catalog(item_key,item_name,payload) values (" +
      sql(row.itemKey) + "," + sql(row.itemName) + "," +
      sql(JSON.stringify(row.payload)) + "::jsonb);");
  }
}

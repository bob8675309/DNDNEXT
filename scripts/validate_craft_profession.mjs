import { strict as assert } from "node:assert";
import { resolveCraftProfession, canCraft } from "../utils/craftProfession.js";

const cases = [
  [{ profession: "Alchemy" }, {}, "Alchemy"],
  [{ role: "Town Alchemist" }, {}, "Alchemy"],
  [{ role: "Blacksmith" }, {}, "Smithing"],
  [{ title: "Master Enchanter" }, {}, "Enchanting"],
  [{ role: "scribe" }, {}, "Scribe"],
  [{ role: "Guard Captain" }, {}, null],
  [{ tags: ["merchant", "forge"] }, {}, "Smithing"],
  [{}, { skills: { profession: { name: "Enchanting", stat: "Int" } } }, "Enchanting"],
  [{}, { profile: { professions: ["apothecary"] } }, "Alchemy"],
];

for (const [character, sheet, expected] of cases) {
  assert.equal(resolveCraftProfession(character, sheet), expected, JSON.stringify({ character, sheet }));
}

assert.equal(canCraft({ profession: "Smithing" }, {}), true);
assert.equal(canCraft({ profession: "Scribe" }, {}), false);
assert.equal(canCraft({ role: "Guard" }, {}), false);

console.log("Craft profession resolver validation passed.");

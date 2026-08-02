import fs from "node:fs";
import path from "node:path";
import {
  calculateArmorClass,
  calculateInitiativeModifier,
  calculatePassivePerception,
  calculateUnarmoredBaseAc,
  hasStoredBaseAc,
  resolveClassUnarmoredDefense,
} from "../utils/characterSheetRules.js";

const root = process.cwd();
const sheetSource = fs.readFileSync(path.join(root, "components/CharacterSheet5e.js"), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function expectEqual(actual, expected, message) {
  expect(Object.is(actual, expected), `${message}: expected ${expected}, received ${actual}`);
}

// Missing/blank/zero stored AC must use the standard 10 + effective Dexterity modifier.
for (const stored of [null, undefined, "", "   ", 0, "0"]) {
  expect(!hasStoredBaseAc(stored), `stored AC ${JSON.stringify(stored)} must be treated as unset`);
  expectEqual(calculateUnarmoredBaseAc(stored, 1), 11, `Pip unarmored AC for ${JSON.stringify(stored)}`);
}
expect(hasStoredBaseAc(13), "explicit alternative AC must be retained");
expectEqual(calculateUnarmoredBaseAc(13, 4), 13, "alternative unarmored base replaces 10 + Dex");

const pip = calculateArmorClass({ storedBaseAc: null, dexterityModifier: 1 });
expectEqual(pip.total, 11, "Pip AC");
expectEqual(pip.dexApplied, 1, "Pip Dex contribution");
expect(!pip.usedStoredBaseAc, "Pip must use standard unarmored formula");

const vargesDefense = resolveClassUnarmoredDefense(
  { meta: { classKey: "barbarian" } },
  { dex: 2, con: 3, wis: 1 }
);
expectEqual(vargesDefense.modifier, 3, "Varges Constitution contribution");
expectEqual(vargesDefense.label, "Barbarian Unarmored Defense", "Varges defense label");
const varges = calculateArmorClass({
  storedBaseAc: null,
  dexterityModifier: 2,
  unarmoredDefenseModifier: vargesDefense.modifier,
  unarmoredDefenseLabel: vargesDefense.label,
});
expectEqual(varges.total, 15, "Varges Barbarian Unarmored Defense AC");
expectEqual(varges.unarmoredDefenseModifier, 3, "Varges AC Constitution contribution");

const monkDefense = resolveClassUnarmoredDefense(
  { className: "Monk" },
  { dex: 4, con: 1, wis: 3 }
);
expectEqual(monkDefense.modifier, 3, "Monk Wisdom contribution");
expectEqual(calculateArmorClass({
  dexterityModifier: 4,
  unarmoredDefenseModifier: monkDefense.modifier,
}).total, 17, "Monk Unarmored Defense AC");

const letho = calculateArmorClass({
  dexterityModifier: 5,
  armor: { category: "light", baseAc: 12 },
});
expectEqual(letho.total, 17, "Letho studded leather AC");

const raska = calculateArmorClass({
  dexterityModifier: 3,
  armor: { category: "heavy", baseAc: 16 },
  shieldBonus: 2,
});
expectEqual(raska.total, 18, "Raska chain mail and shield AC");

const aurelia = calculateArmorClass({
  dexterityModifier: -1,
  armor: { category: "medium", baseAc: 14 },
  shieldBonus: 2,
});
expectEqual(aurelia.total, 15, "Aurelia scale mail and shield AC");
expectEqual(aurelia.dexApplied, -1, "negative Dexterity applies to medium armor");

// Initiative is a Dexterity check, not a Dexterity saving throw.
expectEqual(calculateInitiativeModifier({ dexterityModifier: 1 }), 1, "plain initiative");
expectEqual(calculateInitiativeModifier({ dexterityModifier: 1, gearBonus: 2, sheetBonus: 1 }), 4, "initiative-only bonuses");
expectEqual(calculateInitiativeModifier({ dexterityModifier: -1, checkBonus: 2 }), 1, "generic check bonus support");

// Passive Perception is 10 + Perception check bonus, adjusted by +/-5 for Adv/Dis.
expectEqual(calculatePassivePerception(4), 14, "normal passive perception");
expectEqual(calculatePassivePerception(4, "adv"), 19, "advantaged passive perception");
expectEqual(calculatePassivePerception(4, "dis"), 9, "disadvantaged passive perception");
expectEqual(calculatePassivePerception(4, "normal"), 14, "canceled advantage/disadvantage passive perception");

for (const token of [
  'from "../utils/characterSheetRules"',
  "calculateArmorClass({",
  "resolveClassUnarmoredDefense(s, abilityMods)",
  "calculateInitiativeModifier({",
  "calculatePassivePerception(perceptionCheckBonus, perceptionRollMode)",
  'title={passivePerceptionTitle}',
  "Alternative AC (no armor)",
  "Dexterity save proficiency does not apply.",
  "10 + Wisdom (Perception) check bonus",
]) expect(sheetSource.includes(token), `Character sheet missing ${JSON.stringify(token)}`);

for (const forbidden of [
  "const dexSaveProf",
  "const dexSaveTotal",
  "DEX save mod",
  "Number(stored);\n    const base = Number.isFinite(storedNum)",
]) expect(!sheetSource.includes(forbidden), `Character sheet retains obsolete formula token ${JSON.stringify(forbidden)}`);

if (failures.length) {
  console.error("Character sheet rule validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Character sheet rule validation passed.");

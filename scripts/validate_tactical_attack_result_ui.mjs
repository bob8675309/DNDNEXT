import fs from "node:fs";
import path from "node:path";
import {
  formatAttackRollBreakdown,
  hasAttackRollBreakdown,
} from "../utils/encounterAttackResult.js";

const root = process.cwd();
const combatPath = path.join(root, "pages/encounters/combat.js");
const source = fs.readFileSync(combatPath, "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function expectIncludes(value, expected, label) {
  expect(String(value).includes(expected), `${label}: expected ${JSON.stringify(expected)} in ${JSON.stringify(value)}`);
}

const dodgeResult = {
  hit: true,
  roll: 14,
  total: 21,
  attackBonus: 7,
  targetAc: 13,
  baseTargetAc: 13,
  damage: 6,
  damageType: "bludgeoning",
  dodging: true,
  attackRoll: {
    firstRoll: 20,
    secondRoll: 14,
    roll: 14,
    disadvantage: true,
  },
};
const dodgeText = formatAttackRollBreakdown(dodgeResult, { attackName: "Unarmed Strike" });
expectIncludes(dodgeText, "Disadvantage (Dodge)", "Dodge source");
expectIncludes(dodgeText, "rolled 20 and 14, kept 14", "two-roll disclosure");
expectIncludes(dodgeText, "14 + 7 = 21 vs AC 13", "modifier and AC breakdown");
expectIncludes(dodgeText, "Hit for 6 bludgeoning damage", "damage result");
expect(!dodgeText.includes("Critical hit"), "Dodge must prevent the discarded natural 20 from appearing critical");

const advantageText = formatAttackRollBreakdown({
  hit: false,
  roll: 12,
  total: 17,
  attackBonus: 5,
  targetAc: 18,
  guidingBoltAdvantage: true,
  attackRoll: { firstRoll: 4, secondRoll: 12, roll: 12, advantage: true, guidingBoltAdvantage: true },
}, { attackName: "Fire Bolt" });
expectIncludes(advantageText, "Advantage (Guiding Bolt)", "Advantage source");
expectIncludes(advantageText, "rolled 4 and 12, kept 12", "Advantage kept roll");
expectIncludes(advantageText, "Miss.", "miss result");

const canceledText = formatAttackRollBreakdown({
  hit: true,
  roll: 11,
  total: 16,
  attackBonus: 5,
  targetAc: 14,
  damage: { damage: 4, damageType: "fire" },
  dodging: true,
  guidingBoltAdvantage: true,
  advantageCanceledByDisadvantage: true,
  attackRoll: {
    firstRoll: 11,
    roll: 11,
    advantageCanceledByDisadvantage: true,
    guidingBoltAdvantage: true,
  },
}, { attackName: "Fire Bolt" });
expectIncludes(canceledText, "Normal roll (Guiding Bolt Advantage canceled by Dodge Disadvantage)", "canceled sources");

const coverText = formatAttackRollBreakdown({
  hit: false,
  roll: 10,
  total: 15,
  attackBonus: 5,
  targetAc: 17,
  baseTargetAc: 15,
  coverAcBonus: 2,
  attackRoll: { firstRoll: 10, roll: 10 },
});
expectIncludes(coverText, "AC 17 (base 15 + 2 cover)", "cover AC breakdown");

expect(hasAttackRollBreakdown(dodgeResult), "recognized attack result");
expect(!hasAttackRollBreakdown({ saveTotal: 14, saveDc: 13 }), "saving throw must not be treated as attack roll");

for (const token of [
  'formatAttackRollBreakdown(data, { attackName: "Unarmed Strike" })',
  'formatAttackRollBreakdown(data, { attackName: data?.weapon || weapon.name })',
  'hasAttackRollBreakdown(row.detail?.attack || row.detail)',
  'row.event_type === "unarmed_strike" ? "Unarmed Strike" : undefined',
  'className="attack-breakdown"',
  'formatAttackRollBreakdown(data, { attackName: "Fire Bolt" })',
  'formatAttackRollBreakdown(data, { attackName: "Guiding Bolt" })',
]) {
  expect(source.includes(token), `Combat UI missing integration token: ${token}`);
}

if (failures.length) {
  console.error("Tactical attack-result UI validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Tactical attack-result UI validation passed.");

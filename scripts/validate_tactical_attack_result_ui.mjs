import fs from "node:fs";
import path from "node:path";
import {
  formatAttackRollBreakdown,
  hasAttackRollBreakdown,
} from "../utils/encounterAttackResult.js";

const root = process.cwd();
const componentPath = path.join(root, "components/TacticalAttackResultPanel.js");
const appPath = path.join(root, "pages/_app.js");
const component = fs.readFileSync(componentPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");
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
expect(!dodgeText.includes("Critical hit"), "discarded natural 20 must not appear critical");

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
  attackRoll: { firstRoll: 11, roll: 11, advantageCanceledByDisadvantage: true, guidingBoltAdvantage: true },
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
  'router.pathname === "/encounters/combat"',
  'main.combat-page select',
  'document.querySelectorAll("main.combat-page .log-list > article")',
  'if (!row.text) return;',
  'includes(row.summary)',
  'article.append(mountNode)',
  'data-tactical-attack-details',
  '.limit(40)',
  'setRows((current) => sameLogRows(current, nextRows) ? current : nextRows)',
  'portalTargets.map(({ node, row }) => createPortal(',
  '<details className="tactical-attack-log-details"',
  'tactical-attack-log-details__closed">Details',
  'tactical-attack-log-details__open">Hide',
  '.combat-page .log-list article{position:relative',
  'background:linear-gradient(100deg,rgba(77,43,104,.24)',
  'formatAttackRollBreakdown(result, { attackName: attackName(row, result) })',
]) expect(component.includes(token), `Per-entry attack details missing integration token: ${token}`);

for (const removed of [
  "Latest attack",
  'currentPanel.querySelector(".log-head")',
  "tactical-attack-result__summary",
  "Previous attack rolls",
]) expect(!component.includes(removed), `Separate latest-attack surface must remain removed: ${removed}`);

expect(app.includes('import TacticalAttackResultPanel from "../components/TacticalAttackResultPanel";'), "App missing attack-details component import");
expect(app.includes('<TacticalAttackResultPanel />'), "App missing attack-details component mount");

for (const forbidden of ["encounter_unarmed_strike_v1", "encounter_weapon_attack_v1", "map_routes", "map_route_points", "town_map"]) {
  expect(!component.includes(forbidden), `Presentation component must not invoke or reference ${forbidden}`);
}

if (failures.length) {
  console.error("Tactical attack-result UI validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Tactical attack-result UI validation passed.");

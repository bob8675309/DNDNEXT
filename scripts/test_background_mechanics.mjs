import assert from "node:assert/strict";
import {
  backgroundExpandedSpellNames,
  backgroundFeatRule,
  extractBackgroundSpellList,
  resolveBackgroundFeatOptions,
  spellMatchesExpandedList,
} from "../utils/backgroundMechanics.js";

const feats = [
  { id: "alert", name: "Alert", source: "XPHB", category: "O" },
  { id: "skilled", name: "Skilled", source: "XPHB", category: "O" },
  { id: "tough", name: "Tough", source: "XPHB", category: "O" },
  { id: "survivor", name: "Survivor", source: "RHW", category: "O" },
  { id: "living-shadow", name: "Living Shadow", source: "VRGR", category: "DG" },
];

const ruined = {
  source: "BMT",
  raw_payload: {
    feats: [
      { "alert|phb": true },
      { "skilled|phb": true },
      { "tough|phb": true },
    ],
  },
};
assert.deepEqual(backgroundFeatRule(ruined), {
  directNames: ["alert", "skilled", "tough"],
  categoryCodes: [],
  requiresChoice: true,
  fixedName: "",
});
assert.deepEqual(resolveBackgroundFeatOptions(ruined, feats).map((feat) => feat.name), ["Alert", "Skilled", "Tough"]);

const haunted = {
  source: "RHW",
  raw_payload: {
    feats: [
      { "survivor|rhw": true },
      { anyFromCategory: { category: ["DG"] } },
    ],
  },
};
assert.deepEqual(resolveBackgroundFeatOptions(haunted, feats).map((feat) => feat.name), ["Survivor", "Living Shadow"]);

const witherbloom = {
  raw_payload: {
    additionalSpells: [{
      expanded: {
        s1: ["cure wounds", "inflict wounds"],
        s2: ["lesser restoration", "wither and bloom|scc"],
      },
    }],
  },
};
assert.deepEqual(extractBackgroundSpellList(witherbloom), [
  { level: 1, label: "Level 1", spells: ["Cure Wounds", "Inflict Wounds"] },
  { level: 2, label: "Level 2", spells: ["Lesser Restoration", "Wither and Bloom"] },
]);
assert.equal(spellMatchesExpandedList({ name: "Wither and Bloom" }, backgroundExpandedSpellNames(witherbloom)), true);
assert.equal(spellMatchesExpandedList({ name: "Fireball" }, backgroundExpandedSpellNames(witherbloom)), false);

console.log("Background feat and expanded-spell mechanics validation passed.");

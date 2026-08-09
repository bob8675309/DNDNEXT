import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const helperText = read("utils/artificerPlanChoices.js");
const registrarText = read("components/NpcForgeFeatChoiceRegistrar.js");
const guideText = read("components/NpcForgeClassGuideModel.js");
const migration60 = read("sql/20260808_60_artificer_magic_item_plan_instances.sql");
const migration61 = read("sql/20260808_61_artificer_plan_projection_parent_fix.sql");
const migration62 = read("sql/20260808_62_artificer_common_magic_item_identity.sql");
const { buildArtificerPlanSourceGroups, EFA_ARTIFICER_PLAN_SLOT_LEVELS } = await import(pathToFileURL(path.join(root, "utils/artificerPlanChoices.js")).href);

assert.deepEqual(EFA_ARTIFICER_PLAN_SLOT_LEVELS, [2, 2, 2, 2, 6, 10, 14, 18], "Artificer plan slot chronology must stay source-correct");
assert.match(migration60, /jsonb_path_query[\s\S]*magic item plan/i, "migration must derive plans from imported EFA tables");
assert.match(migration60, /option_type[^\n]*'artificer-plan'/i, "migration must normalize Artificer plan catalogue rows");
assert.match(migration60, /distinctPerRepeat[^\n]*true/i, "wildcard plans must require distinct concrete items per repeat");
assert.match(migration60, /excludeTypes[\s\S]*potion[\s\S]*scroll/i, "Common wildcard must exclude Potions and Scrolls");
assert.match(migration60, /excludeCursed[^\n]*true/i, "wildcard plans must exclude cursed items");
assert.match(migration62, /v_is_magic_item/i, "wildcard validator must positively identify canonical magic-item rows");
assert.match(migration62, /payload->>'type'/i, "non-Wondrous imported magic items must be recognized through source item type");
assert.match(migration62, /payload->>'wondrous'/i, "Wondrous Items must be recognized explicitly");
assert.match(migration60, /character_class_option_grant_instances/i, "learned plans must materialize as normalized class-option instances");
assert.doesNotMatch(migration60, /insert\s+into\s+public\.inventory_items/i, "learning a plan must never create inventory");
assert.match(migration60, /materializesInventory'\s*,\s*false/i, "plan instance metadata must record the non-inventory boundary");
assert.match(migration60, /apply_level_up_artificer_plans_v1/i, "earned progression must use an Artificer-specific apply adapter");
assert.match(migration60, /artificer-plan-replacement/i, "level-up must expose optional Artificer plan replacement");
assert.match(migration60, /complete_character_level_up_v5/i, "Artificer plan progression must enter the active level-up completion path");
assert.match(migration61, /classFeatureChoices/i, "projection follow-up must guard the legacy sheet projection parent");
assert.match(registrarText, /buildArtificerPlanSourceGroups/, "Player Forge must register source-owned Artificer plan slots");
assert.match(registrarText, /option_type[^\n]*artificer-plan/i, "Player Forge must load normalized Artificer plans");
assert.match(guideText, /normalizedClassOptionFamilies\.has\("artificer-plan"\)/, "normalized Artificer plan authority must suppress the duplicate legacy group");
assert.match(helperText, /function isMagicItem/, "client wildcard filtering must also require positive magic-item identity");
assert.doesNotMatch(helperText, /inventory_items|player_wallets|MapPageClient/, "Artificer plan UI helper must not cross protected inventory/wallet/world-map boundaries");

const selectedClass = { class_key: "artificer", source: "EFA" };
const fixedPlan = {
  id: "00000000-0000-0000-0000-000000000001",
  option_key: "artificer-plan:bag-of-holding|EFA",
  option_type: "artificer-plan",
  name: "Bag of Holding",
  source: "EFA",
  class_key: "artificer",
  repeatable: false,
  prerequisites: { minClassLevel: 2 },
  choice_schema: {},
};
const wildcardPlan = {
  id: "00000000-0000-0000-0000-000000000002",
  option_key: "artificer-plan:common-magic-item-that-isnt-a-potion-a-scroll-or-cursed|EFA",
  option_type: "artificer-plan",
  name: "Common magic item that isn't a Potion, a Scroll, or cursed",
  source: "EFA",
  class_key: "artificer",
  repeatable: true,
  prerequisites: { minClassLevel: 2 },
  choice_schema: { kind: "magic-item", rarity: "common", excludeTypes: ["potion", "scroll"], excludeCursed: true, distinctPerRepeat: true },
};
const uncommonWildcard = {
  ...wildcardPlan,
  id: "00000000-0000-0000-0000-000000000003",
  option_key: "artificer-plan:uncommon-wondrous-item-that-isnt-cursed|EFA",
  name: "Uncommon Wondrous Item that isn't cursed",
  prerequisites: { minClassLevel: 10 },
  choice_schema: { kind: "magic-item", rarity: "uncommon", itemType: "wondrous item", excludeCursed: true, distinctPerRepeat: true },
};
const items = [
  { id: "10000000-0000-0000-0000-000000000001", item_name: "Clockwork Amulet", item_key: "clockwork-amulet|XDMG", item_type: "Wondrous Item", item_rarity: "common", payload: { source: "XDMG", wondrous: true } },
  { id: "10000000-0000-0000-0000-000000000002", item_name: "Moon-Touched Sword", item_key: "moon-touched-sword|XDMG", item_type: "Weapon", item_rarity: "common", payload: { source: "XDMG", type: "M" } },
  { id: "10000000-0000-0000-0000-000000000003", item_name: "Potion of Healing", item_key: "potion-of-healing|XDMG", item_type: "Potion", item_rarity: "common", payload: { source: "XDMG", type: "P" } },
  { id: "10000000-0000-0000-0000-000000000004", item_name: "Cursed Trinket", item_key: "cursed-trinket|TEST", item_type: "Wondrous Item", item_rarity: "common", payload: { source: "TEST", wondrous: true, curse: true } },
  { id: "10000000-0000-0000-0000-000000000005", item_name: "Winged Boots", item_key: "winged-boots|XDMG", item_type: "Wondrous Item", item_rarity: "uncommon", payload: { source: "XDMG", wondrous: true } },
  { id: "10000000-0000-0000-0000-000000000006", item_name: "Ashbark Flake", item_key: "alchemy:ingredient:ashbark-flake", item_type: "Plant / Herb", item_rarity: "Common", payload: { source: "DNDNext Alchemy Codex", rarity: "Common", alchemy: { kind: "ingredient" } } },
  { id: "10000000-0000-0000-0000-000000000007", item_name: "Recipe: Antitoxin", item_key: "recipe:test", item_type: "Recipe", item_rarity: "Common", payload: { source: "DNDNext Recipe Catalog", rarity: "Common" } },
];

const level1 = buildArtificerPlanSourceGroups({ selectedClass, level: 1, optionRows: [fixedPlan, wildcardPlan, uncommonWildcard], itemRows: items });
assert.equal(level1.length, 0, "Replicate Magic Item must not appear before Artificer 2");
const level2 = buildArtificerPlanSourceGroups({ selectedClass, level: 2, optionRows: [fixedPlan, wildcardPlan, uncommonWildcard], itemRows: items });
assert.equal(level2.length, 4, "Artificer 2 must have four plan slots");
assert.ok(level2.every((group) => group.metadata?.family === "artificer-plan"), "every normalized slot must use the Artificer plan family");
assert.ok(level2.every((group) => !group.fields[0].options.some((option) => option.key === uncommonWildcard.option_key)), "level-10 plans must be unavailable at Artificer 2");
const wildcardField = level2[0].fields.find((field) => field.metadata?.planOptionKey === wildcardPlan.option_key);
assert.ok(wildcardField, "Common wildcard must expose a dependent concrete-item field");
assert.deepEqual(wildcardField.options.map((option) => option.label), ["Clockwork Amulet", "Moon-Touched Sword"], "Common wildcard client filtering must exclude Potion, cursed, reagent, and recipe rows");
assert.ok(!wildcardField.options.some((option) => option.label === "Ashbark Flake"), "alchemy reagents must never satisfy a Common magic-item wildcard");
assert.ok(!wildcardField.options.some((option) => option.label.startsWith("Recipe:")), "recipe catalogue rows must never satisfy a Common magic-item wildcard");

const firstSelections = {
  "artificer-plan-slot-1": {
    plan: [wildcardPlan.option_key],
    [wildcardField.id]: [items[0].id],
  },
};
const afterFirstWildcard = buildArtificerPlanSourceGroups({ selectedClass, level: 2, optionRows: [fixedPlan, wildcardPlan], itemRows: items, selections: firstSelections });
const secondWildcardField = afterFirstWildcard[1].fields.find((field) => field.metadata?.planOptionKey === wildcardPlan.option_key);
assert.ok(afterFirstWildcard[1].fields[0].options.some((option) => option.key === wildcardPlan.option_key), "repeatable wildcard parent plan must remain selectable");
assert.ok(!secondWildcardField.options.some((option) => option.key === items[0].id), "repeating a wildcard plan must exclude the concrete item already used by an earlier slot");
assert.ok(secondWildcardField.options.some((option) => option.key === items[1].id), "a different eligible concrete item must remain available");

const fixedSelections = { "artificer-plan-slot-1": { plan: [fixedPlan.option_key] } };
const afterFixed = buildArtificerPlanSourceGroups({ selectedClass, level: 2, optionRows: [fixedPlan, wildcardPlan], itemRows: items, selections: fixedSelections });
assert.ok(!afterFixed[1].fields[0].options.some((option) => option.key === fixedPlan.option_key), "nonrepeatable fixed plans must disappear after selection");
assert.equal(buildArtificerPlanSourceGroups({ selectedClass, level: 6, optionRows: [fixedPlan, wildcardPlan, uncommonWildcard], itemRows: items }).length, 5, "Artificer 6 must expose five plan slots");
assert.equal(buildArtificerPlanSourceGroups({ selectedClass, level: 10, optionRows: [fixedPlan, wildcardPlan, uncommonWildcard], itemRows: items }).length, 6, "Artificer 10 must expose six plan slots");

console.log("Artificer Magic Item Plan validation passed.");

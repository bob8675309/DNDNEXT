import assert from "node:assert/strict";
import {
  compareAttunedPlayerSheetWeaponActions,
} from "../utils/attunedPlayerSheetWeaponShadow.js";
import {
  buildCharacterSheetActions,
  resolveCharacterSheetActionMode,
} from "../utils/characterSheetActions.js";

const characterId = "cccccccc-0000-4000-8000-000000000001";
const swordId = "eeeeeeee-0000-4000-8000-000000000016";
const maulId = "eeeeeeee-0000-4000-8000-000000000018";
const rapierId = "eeeeeeee-0000-4000-8000-000000000006";
const pactId = "eeeeeeee-0000-4000-8000-000000000022";
const bowId = "eeeeeeee-0000-4000-8000-000000000017";
const sharedId = "eeeeeeee-0000-4000-8000-000000000009";

const mods = (values) => ({
  abilities: Object.fromEntries(
    ["str", "dex", "con", "int", "wis", "cha"].map((key) => [
      key, { effectiveMod: values[key] ?? 0 },
    ])
  ),
});
const ability = (baseline, shadow, enabled = true) => ({
  schemaVersion: 1, attunementEnabled: enabled, consumerEnforced: false,
  baseline: mods(baseline), shadow: mods(shadow),
});
const gate = (items, enabled = true) => ({
  schemaVersion: 1, characterId,
  attunementEnabled: enabled, consumerEnforced: false,
  items: items.map(([id, eligible, verified = true]) => ({
    inventoryItemId: id, physicalEquipped: true,
    magicRiderEligible: eligible, sourceMagicVerified: verified,
  })),
});
const weapon = (id, name, payload, overrides = {}) => ({
  id, item_name: name, item_type: "Martial Melee Weapon",
  is_equipped: true, equip_slot: "weapon_1",
  card_payload: { weapon: true, type: "M", dmg1: "1d8", dmgType: "S", ...payload },
  ...overrides,
});
const selection = (items, enabled) => gate(items, enabled);
const compare = (options) => compareAttunedPlayerSheetWeaponActions({
  characterId, proficiencyBonus: 3, featureRows: [], ...options,
});
const lookup = (comparison, id, part = "shadowActions") =>
  comparison[part].find((a) => a.id === "weapon:" + id);

const inventory = [
  weapon(swordId, "Longsword +2", { bonusWeapon: "+2" }),
  weapon(maulId, "Tempered Maul", { dmg1: "2d6", smith_tier: 2, dmgType: "B" }),
  weapon(rapierId, "Rapier", { dmgType: "P", property: ["F|XPHB"] }),
  weapon(bowId, "Longbow +1", {
    type: "R", bonus_weapon: "+1", dmgType: "P", range: "150/600",
  }, { item_type: "Martial Ranged Weapon" }),
];
const original = structuredClone(inventory);
const barbarian = {
  meta: { classKey: "barbarian" },
  rages: 3, rageDamageBonus: 2,
  actionState: { rage: { active: true, usesRemaining: 2, usesMax: 3 } },
  speciesTraits: ["Long-Limbed"],
};
const baseline = { str: 5, dex: 5, con: 3, cha: 1 };
const projected = { str: 3, dex: 2, con: 3, cha: 1 };
const input = {
  sheet: barbarian,
  inventoryRows: inventory,
  abilityShadow: ability(baseline, projected),
  sourceGate: selection([[swordId, false], [maulId, false], [rapierId, true], [bowId, false]]),
};
const comparison = compare(input);
const swordBefore = lookup(comparison, swordId, "baselineActions");
const swordAfter = lookup(comparison, swordId);
assert.equal(swordBefore.attackBonus, 10);
assert.equal(swordBefore.damageFormula, "1d8+9");
assert.equal(swordAfter.attackBonus, 6);
assert.equal(swordAfter.damageFormula, "1d8+5");
assert.equal(swordAfter.damageType, "slashing");
assert.equal(swordAfter.equipped, true);
assert.equal(swordAfter.id, swordBefore.id);
assert.equal(swordAfter.statusLabel, "Equipped");

const bow = lookup(comparison, bowId);
assert.equal(bow.ability, "dex");
assert.equal(bow.attackBonus, 5);
assert.equal(bow.damageFormula, "1d8+2");
assert.equal(bow.damageType, "piercing");
assert.equal(bow.detail.includes("150/600"), true);
const rapier = lookup(comparison, rapierId);
assert.equal(rapier.ability, "str");
assert.equal(rapier.attackBonus, 6);
assert.equal(rapier.damageFormula, "1d8+5");
assert.equal(rapier.damageType, "piercing");
const maul = lookup(comparison, maulId);
assert.equal(maul.attackBonus, 8);
assert.equal(maul.damageFormula, "2d6+7");
assert.ok(comparison.unresolvedSources.some((s) =>
  s.inventoryItemId === maulId && s.reason === "smith_tier_physical_or_magic_unknown"));
assert.deepEqual(inventory, original, "Shadow may not alter caller inventory payloads");
assert.equal(comparison.consumerEnforced, false);
assert.equal(comparison.sheetWeaponParityReady, false);
assert.equal(comparison.spellConsumerParityReady, false);
assert.equal(comparison.baselineActions[0].kind, "feature-toggle");
assert.deepEqual(comparison.baselineActions[0], comparison.shadowActions[0],
  "Rage feature activation must stay identical");

// OFF must return the exact canonical action output, even without selections.
const off = compare({
  ...input,
  abilityShadow: ability(baseline, baseline, false),
  sourceGate: selection([[swordId, true],[maulId,true],[rapierId,true],[bowId,true]], false),
});
const canonical = buildCharacterSheetActions({
  sheet: barbarian, inventoryRows: inventory,
  abilityModifiers: baseline, proficiencyBonus: 3,
});
assert.deepEqual(off.baselineActions, canonical);
assert.deepEqual(off.shadowActions, canonical);
assert.equal(off.changes.length, 0);

// Selecting both a sword and a bow retains their own enhancements, while
// not restoring unrelated ability-score boosters.
const selected = compare({
  ...input, sourceGate: selection([[swordId, true],[maulId,false],[rapierId,true],[bowId,true]]),
});
assert.equal(lookup(selected,swordId).attackBonus, 8);
assert.equal(lookup(selected,swordId).damageFormula, "1d8+7");
assert.equal(lookup(selected,bowId).attackBonus, 6);
assert.equal(lookup(selected,bowId).damageFormula, "1d8+3");

// Thrown weapon still exposes two modes, with rage and reach intact.
const thrownId = "eeeeeeee-0000-4000-8000-000000000020";
const javelin = weapon(thrownId, "Javelin +1", {
  type: "M", dmg1: "1d6", dmgType: "P", property: ["T"],
  bonusWeapon: "+1", rangeText: "Thrown 30/120 ft.",
});
const thrown = compare({
  ...input, inventoryRows: [javelin], sourceGate: selection([[thrownId,false]]),
});
const thrownAction=lookup(thrown,thrownId);
assert.equal(thrownAction.modes.length,2);
assert.equal(resolveCharacterSheetActionMode(thrownAction,"melee").damageFormula,"1d6+5");
assert.equal(resolveCharacterSheetActionMode(thrownAction,"thrown").damageFormula,"1d6+5");
assert.ok(resolveCharacterSheetActionMode(thrownAction,"thrown").detail.includes("Thrown 30/120"));
assert.ok(resolveCharacterSheetActionMode(thrownAction,"melee").detail.includes("Reach 10 ft."));

// Hexblade/Pact of the Blade keeps CHA proficiency and action feature logic,
// while selection gates this exact weapon's +2 rider.
const pact = compare({
  sheet: {
    meta: { classKey: "warlock", subclass: "Hexblade" },
    classFeatures: ["Pact of the Blade"],
  },
  inventoryRows: [weapon(pactId, "Pact Longsword +2", { bonusWeapon: "+2" })],
  abilityShadow: ability({ str: 1, dex: 2, cha: 4 }, { str: 1, dex: 2, cha: 2 }),
  sourceGate: selection([[pactId,false]]),
});
assert.equal(lookup(pact,pactId,"baselineActions").ability,"cha");
assert.equal(lookup(pact,pactId,"baselineActions").attackBonus,9);
assert.equal(lookup(pact,pactId).ability,"cha");
assert.equal(lookup(pact,pactId).attackBonus,5);
assert.equal(lookup(pact,pactId).damageFormula,"1d8+2");

// Unverified item carries the original source truth in an unresolved audit.
const unverified = compare({
  ...input, inventoryRows: [weapon(swordId,"Unverified rare +2",{bonusWeapon:"+2"})],
  sourceGate: selection([[swordId,false,false]]),
});
assert.equal(lookup(unverified,swordId).attackBonus,6);
assert.ok(unverified.unresolvedSources.some((s)=>s.reason==="unverified_magic_source_payload"));

// One account-owned physical sword remains visible to another character,
// but its claimed magic rider does not cross the character boundary.
const shared = compare({
  ...input, inventoryRows: [weapon(sharedId,"Shared Longsword",{bonusWeapon:"+2"})],
  sourceGate: selection([[sharedId,false]]),
});
assert.equal(lookup(shared,sharedId).attackBonus,6);

// A missing / duplicate trusted source is an error, not a permissive fallback.
assert.throws(()=>compare({...input,sourceGate:selection([[swordId,false]])}),
  /lacks verified character source/);
assert.throws(()=>compare({...input,sourceGate:selection([
  [swordId,false],[swordId,true],[maulId,false],[rapierId,true],[bowId,false],
])}),/Duplicate/);
assert.throws(()=>compare({...input,characterId:"wrong-character"}),
  /Exact trusted character identity/);

// Mixed smith_tier and magic enhancement must not promote a smith bonus into
// a replacement magical contribution when the source is unselected.
const mixed = compare({
  ...input,
  inventoryRows: [weapon(swordId,"Tempered Enchanted Blade",{bonusWeapon:"+2",smith_tier:1})],
  sourceGate:selection([[swordId,false]]),
});
assert.equal(lookup(mixed,swordId).attackBonus,6);
assert.ok(mixed.unresolvedSources.some((s)=>s.reason==="mixed_smith_and_magical_bonus_unknown"));

console.log("Player sheet weapon shadow: OFF exact actions, selected magic, Rage, Pact CHA, finesse, thrown, smithing and cross-character source tests passed.");

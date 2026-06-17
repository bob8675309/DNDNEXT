import assert from "node:assert/strict";
import {
  buildEnchantingPreview,
  enchantingRequirementCheck,
  enchantingSlotForRarity,
  isEnchantingCatalyst,
  isEnchantingRecipeFuture,
} from "../utils/enchanting.js";

const commonCatalyst = { id: "c1", name: "Arcane Catalyst", category: "Catalyst", rarity: "Common", tags: ["arcane"] };
const uncommonCatalyst = { id: "c2", name: "Sigil Dust", category: "Catalyst", rarity: "Uncommon", tags: ["sigil"] };
const rareCatalyst = { id: "c3", name: "Planar Core", category: "Catalyst", rarity: "Rare", tags: ["core"] };

assert.equal(enchantingSlotForRarity("Common"), "A");
assert.equal(enchantingSlotForRarity("Uncommon"), "A");
assert.equal(enchantingSlotForRarity("Rare"), "B");
assert.equal(enchantingSlotForRarity("Very Rare"), "C");
assert.equal(enchantingSlotForRarity("Legendary"), "");

const rareWeaponRecipe = {
  id: "enchant:wounding",
  key: "wounding",
  name: "Weapon of Wounding",
  rarity: "Rare",
  applies_to: ["weapon"],
  variant: {
    key: "wounding",
    rarity: "rare",
    appliesTo: ["weapon"],
    requires: { weaponFamily: ["sword"] },
    textByKind: { weapon: "On a hit, the target takes an extra 1d8 Necrotic damage." },
  },
};

const plusOneSword = { name: "+1 Longsword", type: "M", rarity: "Uncommon", payload: { damageType: "S" } };
const plusThreeSword = {
  name: "+3 Longsword — Moon-Touched / Warning",
  type: "M",
  rarity: "Very Rare",
  payload: {
    damageType: "S",
    enchanting: {
      base_name: "+3 Longsword",
      base_entries: ["Base weapon rule."],
      slots: {
        A: { slot: "A", key: "moon_touched", name: "Moon-Touched", rarity: "Common", effect_text: "Glows in darkness.", entries: ["Glows in darkness."] },
        C: { slot: "C", key: "warning", name: "Weapon of Warning", rarity: "Very Rare", effect_text: "Warns its bearer.", entries: ["Warns its bearer."] },
      },
    },
  },
};

assert.equal(enchantingRequirementCheck(plusOneSword, rareWeaponRecipe).ok, false, "Slot B must reject +1 gear");
assert.equal(enchantingRequirementCheck(plusThreeSword, rareWeaponRecipe).ok, true, "legacy sword-only naming must remain broad Weapon compatibility");
assert.equal(isEnchantingCatalyst(commonCatalyst, rareWeaponRecipe, "B"), false, "Slot B needs Uncommon or better catalyst");
assert.equal(isEnchantingCatalyst(uncommonCatalyst, rareWeaponRecipe, "B"), true);
assert.equal(isEnchantingCatalyst(rareCatalyst, rareWeaponRecipe, "C"), true);

const preview = buildEnchantingPreview(rareWeaponRecipe, plusThreeSword, null, uncommonCatalyst);
assert.equal(preview.valid, true);
assert.equal(preview.slot, "B");
assert.equal(preview.nextSlots.A.key, "moon_touched", "Slot A must be inherited");
assert.equal(preview.nextSlots.C.key, "warning", "Slot C must be inherited");
assert.equal(preview.nextSlots.B.key, "wounding", "Slot B must be replaced/created");
assert.match(preview.finalName, /^\+3 Longsword — Moon-Touched \/ Wounding \/ Warning$/);
assert.deepEqual(preview.baseEntries, ["Base weapon rule."]);

const slashingRecipe = {
  ...rareWeaponRecipe,
  key: "sharpness",
  name: "Weapon of Sharpness",
  variant: { ...rareWeaponRecipe.variant, key: "sharpness", requires: { damageType: ["slashing"] } },
};
const mace = { name: "+3 Mace", type: "M", rarity: "Very Rare", payload: { damageType: "B" } };
assert.equal(enchantingRequirementCheck(mace, slashingRecipe).ok, false, "real damage-type restrictions must remain enforced");

assert.equal(isEnchantingRecipeFuture({ key: "vorpal", rarity: "Legendary" }), true);
assert.equal(isEnchantingRecipeFuture({ key: "enspell_weapon", rarity: "Varies" }), true);

console.log("Enchanting model tests passed.");

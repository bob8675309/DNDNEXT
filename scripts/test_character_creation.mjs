import assert from "node:assert/strict";
import {
  availableProfessionsForCharacter,
  professionModifierFromSheet,
  providerOffersProfession,
} from "../utils/craftingProfessions.js";
import {
  BACKGROUND_DEFINITIONS,
  CLASS_DEFINITIONS,
  SPECIES_DEFINITIONS,
  applyBackgroundAbilityBoosts,
  buildCharacterCreatePayload,
  buildCharacterSheetFromDraft,
  defaultBackgroundBoosts,
  maximumHitPoints,
  proficiencyBonusForLevel,
  standardAbilityScores,
  validateCharacterDraft,
  workshopTagsFromProfessions,
} from "../utils/characterCreation.js";

assert.deepEqual(Object.keys(SPECIES_DEFINITIONS).filter((key) => key !== "custom"), [
  "aasimar", "dragonborn", "dwarf", "elf", "gnome", "goliath", "halfling", "human", "orc", "tiefling",
]);
assert.equal(CLASS_DEFINITIONS.civilian.label, "No Adventuring Class");
assert.equal(BACKGROUND_DEFINITIONS.artisan.feat, "Crafter");
assert.deepEqual(standardAbilityScores("fighter"), { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 });
assert.equal(proficiencyBonusForLevel(1), 2);
assert.equal(proficiencyBonusForLevel(5), 3);
assert.equal(proficiencyBonusForLevel(17), 6);
assert.equal(maximumHitPoints({ classKey: "fighter", level: 5, constitutionScore: 14 }), 44);

const boosts = defaultBackgroundBoosts("soldier", "fighter");
const boosted = applyBackgroundAbilityBoosts(standardAbilityScores("fighter"), "soldier", boosts);
assert.equal(boosted.str, 17);
assert.equal(boosted.dex, 15);
assert.equal(boosted.con, 13);

const professions = {
  alchemy: { rank: 1, ability: "int", offersService: true },
  smithing: { rank: 2, ability: "str", offersService: true },
  scribe: { rank: 0, ability: "int", offersService: false },
  enchanting: { rank: 1, ability: "cha", offersService: false },
};
assert.deepEqual(workshopTagsFromProfessions(professions), ["alchemist", "blacksmith"]);
assert.equal(workshopTagsFromProfessions({ jeweler: { rank: 2, offersService: true } }).includes("jeweler"), false);

assert.deepEqual(availableProfessionsForCharacter({ role: "Master Armorer", name: "Blacksmith Bob", affiliation: "Smith Guild" }), []);
assert.deepEqual(availableProfessionsForCharacter({ tags: ["blacksmith", "alchemist"] }).sort(), ["alchemy", "smithing"]);
assert.equal(providerOffersProfession({ tags: ["blacksmith"] }, "smithing"), true);
assert.equal(providerOffersProfession({ role: "Blacksmith" }, "smithing"), false);
assert.deepEqual(availableProfessionsForCharacter({}, {
  professions: {
    smithing: { rank: 1, ability: "str", offersService: true },
    enchanting: { rank: 1, ability: "int", offersService: false },
  },
}), ["smithing"]);
assert.equal(professionModifierFromSheet({
  proficiencyBonus: 3,
  abilities: { str: { score: 16 } },
  professions: { smithing: { rank: 2, ability: "str", offersService: true } },
}, "smithing").totalModifier, 9);

const draft = {
  name: "Marta Ironroot",
  kind: "merchant",
  role: "Master Armorer",
  affiliation: "Gray Hall Smiths' Guild",
  speciesKey: "dwarf",
  backgroundKey: "artisan",
  classKey: "fighter",
  level: 5,
  baseAbilities: standardAbilityScores("fighter"),
  backgroundBoosts: defaultBackgroundBoosts("artisan", "fighter"),
  selectedClassSkills: ["athletics", "history"],
  expertiseSkills: ["investigation"],
  professions,
  additionalFeats: ["Heavy Armor Master"],
  storefrontEnabled: true,
  storefrontTitle: "Ironroot Armory",
  locationId: "56",
};

assert.deepEqual(validateCharacterDraft(draft), []);
const sheet = buildCharacterSheetFromDraft(draft);
assert.equal(sheet.className, "Fighter");
assert.equal(sheet.level, 5);
assert.equal(sheet.proficiencyBonus, 3);
assert.equal(sheet.background, "Artisan");
assert.equal(sheet.professions.smithing.rank, 2);
assert.equal(sheet.proficiencies.skills.investigation.expertise, true);
assert.equal(sheet.meta.creator, "npc_forge_v1");

const payload = buildCharacterCreatePayload(draft);
assert.equal(payload.kind, "merchant");
assert.equal(payload.role, "Master Armorer", "in-world role must remain separate from class");
assert.equal(payload.sheet.className, "Fighter");
assert.equal(payload.storefront_enabled, true);
assert.equal(payload.is_hidden, true, "new characters must start off-map");
assert.deepEqual(payload.tags.sort(), ["alchemist", "blacksmith"]);
assert.equal(payload.location_id, 56);

const invalidServiceDraft = {
  ...draft,
  professions: {
    ...professions,
    scribe: { rank: 0, ability: "int", offersService: true },
  },
};
assert.match(validateCharacterDraft(invalidServiceDraft).join(" "), /Scribe must be proficient/);

const customDraft = {
  ...draft,
  name: "Skritch",
  kind: "npc",
  role: "Tunnel Scout",
  speciesKey: "custom",
  customSpecies: "Goblin",
  backgroundKey: "custom",
  customBackground: "Undercity Runner",
  classKey: "rogue",
  selectedClassSkills: ["acrobatics", "investigation", "sleightOfHand", "stealth"],
  backgroundBoosts: { mode: "three", plusOnes: ["dex", "int", "wis"] },
  professions: {},
  locationId: "",
};
assert.deepEqual(validateCharacterDraft(customDraft), []);
assert.equal(buildCharacterSheetFromDraft(customDraft).species, "Goblin");
assert.equal(buildCharacterSheetFromDraft(customDraft).background, "Undercity Runner");

console.log("Canonical NPC character creation model tests passed.");
import assert from "node:assert/strict";
import {
  ALIGNMENT_OPTIONS,
  SIZE_OPTIONS,
  buildCharacterCreatePayload,
  buildCharacterSheetFromDraft,
  validateCharacterDraft,
} from "../utils/characterCreation.js";

const draft = {
  name: "Test Scribe",
  kind: "merchant",
  role: "Court Scribe",
  affiliation: "Gray Hall Archives",
  speciesKey: "elf",
  lineage: "High Elf",
  size: "Medium",
  alignment: "LN",
  languagesText: "Common, Elvish, Draconic",
  backgroundKey: "scribe",
  classKey: "wizard",
  level: 5,
  abilityMethod: "standard",
  baseAbilities: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 },
  backgroundBoosts: { mode: "twoOne", plusTwo: "int", plusOne: "wis", plusOnes: ["dex", "int", "wis"] },
  selectedClassSkills: ["arcana", "history"],
  expertiseSkills: ["investigation"],
  professions: {
    alchemy: { rank: 0, ability: "int", offersService: false },
    smithing: { rank: 0, ability: "str", offersService: false },
    scribe: { rank: 2, ability: "int", offersService: true },
    enchanting: { rank: 1, ability: "int", offersService: false },
  },
  additionalFeats: ["Ritual Caster"],
  equipment: "Calligrapher's Supplies, spellbook, ink, parchment",
  treasure: "50 GP",
  appearance: "Ink-stained fingers and formal archive robes.",
  preparedSpellsText: "Detect Magic, Identify, Comprehend Languages",
  attacks: "Quarterstaff +5, 1d6 bludgeoning.",
  storefrontEnabled: true,
  storefrontTitle: "Test Scribe's Desk",
  storefrontTagline: "Scrollwork and records.",
  tags: ["archive"],
};

assert.ok(ALIGNMENT_OPTIONS.some((option) => option.key === "LN"));
assert.ok(SIZE_OPTIONS.some((option) => option.key === "Medium"));
assert.deepEqual(validateCharacterDraft(draft), []);

const sheet = buildCharacterSheetFromDraft(draft);
assert.equal(sheet.alignment, "LN");
assert.equal(sheet.size, "Medium");
assert.deepEqual(sheet.languages, ["Common", "Elvish", "Draconic"]);
assert.equal(sheet.appearance, "Ink-stained fingers and formal archive robes.");
assert.equal(sheet.equipment, "Calligrapher's Supplies, spellbook, ink, parchment");
assert.equal(sheet.treasure, "50 GP");
assert.equal(sheet.meta.alignment, "LN");
assert.deepEqual(sheet.meta.languages, ["Common", "Elvish", "Draconic"]);
assert.equal(sheet.spellcasting.catalogStatus, "manual_until_spell_catalog_import");
assert.equal(sheet.professions.scribe.rank, 2);

const payload = buildCharacterCreatePayload(draft);
assert.equal(payload.kind, "merchant");
assert.equal(payload.storefront_enabled, true);
assert.ok(payload.tags.includes("scribe"));
assert.equal(payload.sheet.alignment, "LN");
assert.deepEqual(payload.sheet.languages, ["Common", "Elvish", "Draconic"]);

console.log("NPC Forge character creation detail tests passed.");
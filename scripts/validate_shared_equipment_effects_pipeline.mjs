import fs from "node:fs";
import path from "node:path";
import {
  authoritativeEffectsRevision,
  characterIdFromEffectsKey,
  mergeAuthoritativeEquipmentEffects,
} from "../utils/authoritativeEquipmentEffects.js";

const root = process.cwd();
const sql03 = fs.readFileSync(path.join(root, "sql/20260801_03_shared_equipment_effects_pipeline.sql"), "utf8");
const sql04 = fs.readFileSync(path.join(root, "sql/20260801_04_shared_equipment_effects_tactical_modifiers.sql"), "utf8");
const wrapper = fs.readFileSync(path.join(root, "components/CharacterSheetPanel.js"), "utf8");
const base = fs.readFileSync(path.join(root, "components/CharacterSheetPanelBase.js"), "utf8");
const helper = fs.readFileSync(path.join(root, "utils/authoritativeEquipmentEffects.js"), "utf8");
const docs = fs.readFileSync(path.join(root, "docs/Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md"), "utf8");
const docsIndex = fs.readFileSync(path.join(root, "docs/README.md"), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function expectIncludes(source, token, label) {
  expect(source.includes(token), `${label} missing ${JSON.stringify(token)}`);
}

const characterId = "12e3ef86-1883-4c6c-bd5f-524ee606cc75";
expect(characterIdFromEffectsKey(`${characterId}|a,b`) === characterId, "plain effectsKey UUID extraction");
expect(characterIdFromEffectsKey(`npc:${characterId}|a,b`) === characterId, "typed effectsKey UUID extraction");
expect(characterIdFromEffectsKey("no-character") === "", "effectsKey without UUID must stay local-only");

const local = {
  ac: 9,
  savesAll: 8,
  saves: { dex: 7 },
  skillsAll: 6,
  skills: { stealth: 5 },
  abilities: { str: 4, dex: 4, con: 4, int: 4, wis: 4, cha: 4 },
  abilityMods: { str: 3, dex: 3, con: 3, int: 3, wis: 3, cha: 3 },
  initiative: 12,
  advantage: { savesAll: false, saves: {}, skillsAll: false, skills: { perception: true } },
  disadvantage: { savesAll: false, saves: {}, skillsAll: false, skills: { stealth: true } },
  equipment: {
    armor: { name: "Wrong-slot Armor", category: "heavy", baseAc: 99, stealthDisadvantage: true },
    shield: { name: "Local Shield", bonusAc: 9 },
    warnings: ["Keep this warning"],
    reminders: ["Keep this reminder"],
  },
};

const authoritative = {
  schemaVersion: 1,
  abilities: {
    str: { scoreBonus: 2, modBonus: 1 },
    dex: { scoreBonus: 4, modBonus: 2 },
    con: { scoreBonus: 0, modBonus: 0 },
    int: { scoreBonus: 0, modBonus: 0 },
    wis: { scoreBonus: 0, modBonus: 0 },
    cha: { scoreBonus: 0, modBonus: 0 },
  },
  ac: {
    total: 18,
    base: 16,
    armorCategory: "heavy",
    armorBase: 16,
    armorItemId: "71ad926e-e58e-404d-956d-5730175724ae",
    armorName: "Chain Mail",
    shieldBonus: 2,
    shieldItemId: "b0f7efab-9304-4f0f-820a-8d0bd7739649",
    shieldName: "Shield",
    otherBonus: 0,
  },
  savesAll: 1,
  saves: { dex: 2 },
  skillsAll: 3,
  skills: { stealth: 4 },
  initiative: 5,
  equippedItemIds: ["b", "a"],
};

const merged = mergeAuthoritativeEquipmentEffects(local, authoritative);
expect(merged.ac === 0, "authoritative other AC bonus must replace local numeric AC bonus");
expect(merged.savesAll === 1 && merged.saves.dex === 2, "authoritative save bonuses");
expect(merged.skillsAll === 3 && merged.skills.stealth === 4, "authoritative skill bonuses");
expect(merged.abilities.str === 2 && merged.abilities.dex === 4, "authoritative ability-score bonuses");
expect(merged.abilityMods.str === 1 && merged.abilityMods.dex === 2, "authoritative direct ability-modifier bonuses");
expect(merged.initiative === 5, "authoritative initiative bonus");
expect(merged.equipment.armor?.name === "Chain Mail" && merged.equipment.armor?.baseAc === 16, "authoritative body armor must replace local armor selection");
expect(merged.equipment.shield?.name === "Shield" && merged.equipment.shield?.bonusAc === 2, "authoritative shield selection");
expect(merged.equipment.armor?.stealthDisadvantage === true, "local presentation-only armor detail remains available");
expect(merged.advantage.skills.perception === true, "local Advantage presentation survives numeric merge");
expect(merged.disadvantage.skills.stealth === true, "local Disadvantage presentation survives numeric merge");
expect(merged.equipment.warnings[0] === "Keep this warning", "local warnings survive numeric merge");
expect(merged.equipment.reminders[0] === "Keep this reminder", "local reminders survive numeric merge");
expect(authoritativeEffectsRevision(authoritative) === "v1:a,b", "stable authoritative revision ordering");

const noArmor = mergeAuthoritativeEquipmentEffects(local, {
  ...authoritative,
  ac: { total: 11, base: 11, armorItemId: null, shieldItemId: null, shieldBonus: 0, otherBonus: 0 },
});
expect(noArmor.equipment.armor === null, "server must reject locally inferred armor in an invalid slot");
expect(noArmor.equipment.shield === null, "server must remove locally inferred unequipped shield");

for (const token of [
  "private.character_equipment_effects_v1(p_character_id uuid)",
  "public.character_equipment_effects_v1(p_character_id uuid)",
  "lower(coalesce(v_item.equip_slot,''))='body'",
  "modifiers->'abilityMods'",
  "modifiers->'abilityModifiers'",
  "'effectiveScore'",
  "'effectiveMod'",
  "'otherBonus'",
  "private.can_access_character_v1",
  "private.encounter_equipped_armor_class_v1",
  "public.encounter_canonical_combat_snapshot_v1",
]) expectIncludes(sql03, token, "shared equipment migration");

for (const token of [
  "coalesce(private.current_user_is_admin(),false)",
  "coalesce(private.can_access_character_v1(p_character_id,'read'),false)",
  "'strMod'",
  "'dexMod'",
  "Weapon profile modifier declaration anchor mismatch",
  "Weapon profile snapshot anchor mismatch",
  "Weapon profile ability anchor mismatch",
  "v_ability_mod := v_dex_mod",
  "v_ability_mod := v_str_mod",
  "v_dex_mod > v_str_mod",
]) expectIncludes(sql04, token, "tactical modifier migration");

expect((sql04.match(/v_occurrences<>1/g) || []).length === 3, "weapon profile patch must have three fail-closed source anchors");

for (const token of [
  "CharacterSheetPanelBase",
  "characterIdFromEffectsKey(props.effectsKey)",
  "loadAuthoritativeEquipmentEffects(supabase, characterId)",
  "mergeAuthoritativeEquipmentEffects(props.itemBonuses, authoritativeEffects)",
  "authoritativeEffectsRevision(authoritativeEffects)",
  "PGRST202",
]) expectIncludes(wrapper, token, "character sheet authority wrapper");

for (const token of [
  "character_equipment_effects_v1",
  "scoreBonus",
  "modBonus",
  "armorItemId",
  "shieldItemId",
  "warnings",
  "reminders",
]) expectIncludes(helper, token, "client authority adapter");

expectIncludes(base, "title={locationToggleTitle ||", "preserved character sheet base behavior");
expect(!base.includes("loadAuthoritativeEquipmentEffects"), "base component must remain presentation-only");
expectIncludes(docs, "# Crafting → Equipment → Character Sheet → Tactical Combat Pipeline", "architecture handoff");
expectIncludes(docs, "Encounter snapshot boundary", "architecture handoff");
expectIncludes(docsIndex, "Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md", "documentation index");

for (const source of [sql03, sql04]) {
  for (const forbidden of [
    "map_routes",
    "map_route_points",
    "world_map",
    "town_map",
    "update public.encounter_participants",
    "update public.encounters",
    "delete from public.encounter",
  ]) expect(!source.includes(forbidden), `shared equipment migrations must not reference or mutate ${forbidden}`);
}

if (failures.length) {
  console.error("Shared equipment-effects pipeline validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Shared equipment-effects pipeline validation passed.");

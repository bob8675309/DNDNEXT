import assert from "node:assert/strict";
import fs from "node:fs";
const read = (path) => fs.readFileSync(path, "utf8");
const sql = read("sql/20261026_04_attuned_spell_list_hand_evidence.sql");
const fixture = read("scripts/fixtures/attuned_spell_list_hand_evidence.sql");
const workflow = read(".github/workflows/validate-attuned-spell-list-hand-evidence.yml");
for (const marker of [
 "private.encounter_attuned_spell_list_hand_evidence_v1",
 "private.encounter_attuned_focus_provenance_shadow_v1",
 "unnest(coalesce(v_spell.classes",
 "public.character_progression cp",
 "class_progression_ambiguous",
 "catalog_lists_class_but_grant_unverified",
 "exact_catalog_does_not_list_class",
 "multiple_equipped_items_same_hand_slot",
 "shared_account_hand_custody_unverified",
 "classGrantVerified',false",
 "activeHandsVerified',false",
 "consumerEnforced',false",
]) assert.ok(sql.includes(marker), "Expected source contract: " + marker);
for (const marker of [
 "class-list",
 "Same-hand",
 "Shared account",
 "spell-slot",
]) assert.ok(fixture.toLowerCase().includes(marker.toLowerCase()), "Missing regression: "+marker);
for (const marker of [
 "validate_attuned_spell_list_hand_evidence.mjs",
 "attuned_spell_list_hand_evidence.sql",
]) assert.ok(workflow.includes(marker), "Missing workflow step: "+marker);
console.log("Spell-list and hand slot conservative source contracts passed");

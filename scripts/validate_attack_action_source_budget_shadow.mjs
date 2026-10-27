import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => fs.readFileSync(path,"utf8");
const sql=read("sql/20261027_01_attack_action_source_budget_shadow.sql");
const fixture=read("scripts/fixtures/attack_action_source_budget_shadow.sql");
const wf=read(".github/workflows/validate-attack-action-source-budget-shadow.yml");
const canonical=read("sql/20260729_03_tactical_attack_roll_modifiers.sql");
const prior=read("sql/20261026_09_encounter_attack_action_sequence_audit_shadow.sql");
for(const marker of [
 "private.encounter_attack_capacity_source_shadow_v1",
 "public.character_progression cp",
 "public.class_catalog c",
 "public.class_feature_catalog f",
 "upper(btrim(f.class_source))=v_book",
 "upper(btrim(f.source))=v_book",
 "lower(btrim(f.feature_type))='class'",
 "f.subclass_name is null",
 "f.level<=v_level",
 "'Three Extra Attacks'",
 "'Two Extra Attacks'",
 "'Extra Attack (3)'",
 "'Extra Attack (2)'",
 "v_class in ('barbarian','monk','paladin','ranger')",
 "missing_source_fighter_two_extra_attacks",
 "unsupported_class_source_or_special_progression",
 "'subclassFeaturesVerified',false",
 "public.encounter_attack_action_sessions_shadow_v1",
 "public.encounter_attack_events_shadow_v1",
 "unique(participant_id,round,turn_index)",
 "unique(action_request_id,event_ordinal)",
 "enable row level security",
 "public.begin_encounter_attack_action_shadow_v1",
 "public.record_encounter_attack_event_shadow_v1",
 "public.encounter_can_control_participant_v1",
 "for update",
 "v_e.active_participant_id is distinct from v_p.id",
 "v_e.round<>p_expected_round",
 "v_e.turn_index<>p_expected_turn_index",
 "not v_p.action_available",
 "canonical attack already occurred",
 "'simulatedAttackSlotOnly',true",
 "'canonicalActionSpent',false",
 "'damageApplied',false",
 "'combatConsumerEnforced',false",
 "from public,anon,authenticated",
]) {
 if(!sql.toLowerCase().includes(marker.toLowerCase())) throw Error("Source-derived attack sequence missing "+marker);
}
for(const forbidden of ["update public.encounter_participants", "update public.encounters", "update public.inventory_items", "update public.encounter_spell_slots",
"public.encounter_weapon_attack_v1(", "public.encounter_unarmed_strike_v1(", "public.encounter_cast_spell_v"])assert.ok(!sql.toLowerCase().includes(forbidden.toLowerCase()),"Shadow must not invoke canonical writer "+forbidden);
assert.ok(prior.includes("'extraAttackExecutionSupported',false"),"Previous readiness boundary changed");
assert.ok(canonical.includes("if not v_a.action_available then raise exception 'Action already spent'"),"Canonical attack contract drift");
assert.ok(canonical.includes("update public.encounter_participants set action_available=false"),"Canonical attack spender drift");
for(const marker of [
 "encounter_attack_action_sequence_audit_shadow.sql",
 "20261027_01_attack_action_source_budget_shadow.sql",
 "Level 4 fighter gained unearned Extra Attack",
 "XPHB Fighter Extra Attack level 5 missing",
 "XPHB Fighter two Extra Attacks tier missing",
 "XPHB Fighter three Extra Attacks tier missing",
 "PHB Fighter sourced progression mixed 2024 tiers",
 "Unselected Wizard Bladesinger subclass grant was silently assumed",
 "Missing required exact source feature quietly granted attacks",
 "Fighter 11 attack sequence did not derive THREE shadow slots",
 "Duplicate different Attack action request accepted same turn",
 "Reused Attack action UUID accepted changed turn",
 "Skipped attack ordinal accepted",
 "Reused event UUID allowed different attack ordinal",
 "Fourth attack exceeded Fighter level 11 source capacity",
 "Replay after canonical Action spent was not idempotent",
 "Other account replayed shadow Attack event",
 "Shadow Attack sequence touched real equipment, combat, spells or hands"
])assert.ok(fixture.includes(marker),"Fixture missing "+marker);
for(const marker of ["validate_attack_action_source_budget_shadow.mjs","attack_action_source_budget_shadow.sql"])assert.ok(wf.includes(marker),"Workflow missing "+marker);
console.log("Trusted PHB/XPHB Attack grant budgeting, idempotent shadow event ordering and canonical consumer isolation source checks passed.");

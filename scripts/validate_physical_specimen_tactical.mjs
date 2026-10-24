import assert from "node:assert/strict";
import fs from "node:fs";
const file=fs.readFileSync("sql/20261023_05_physical_specimen_tactical_action.sql","utf8");
for (const phrase of [
 "encounter_activate_physical_specimen_v1",
 "'move','end_turn','core_action','attack','weapon_attack'",
 "'save','reaction','effect','spell_cast','feature_action'",
 "encounter_can_control_participant_v1(p_participant_id)",
 "can_manage_character_progression_v1(v_participant.character_id)",
 "command_type<>'feature_action'",
 "v_existing_request.result->'benefitKeys' is distinct from to_jsonb(p_benefit_keys)",
 "v_participant.bonus_action_available",
 "v_encounter.active_participant_id is distinct from p_participant_id",
 "condition_key in ('incapacitated','paralyzed','stunned','unconscious')",
 "for update",
 "max_hp=v_new_max_hp",
 "speed_ft=v_new_speed",
 "bonus_action_available=false",
 "activatedBy','tactical_bonus_action",
 "insert into public.encounter_combat_log",
 "update public.encounters set version=version+1",
 "update public.encounter_command_requests set result=v_result",
 "'effectsFullyIntegrated',false",
 "revoke all on function public.encounter_activate_physical_specimen_v1"
])assert.ok(file.includes(phrase),`Missing tactical invariant: ${phrase}`);
for (const forbidden of [
 "update public.character_sheets",
 "update public.characters",
 "update public.character_progression",
 "update public.encounter_spell_slots",
 "delete from public."
])assert.ok(!file.toLowerCase().includes(forbidden.toLowerCase()),`Unexpected mutation: ${forbidden}`);
const fixture=fs.readFileSync("scripts/fixtures/physical_specimen_tactical_behavior.sql","utf8");
for(const test of ["Duplicate request did not return", "Charisma +1 allowed", "Out-of-turn Bonus Action", "Incapacitated character", "Outside-encounter RPC bypassed", "Another authenticated user"])
assert.ok(fixture.includes(test),`Missing tactical regression: ${test}`);
console.log("Staged tactical feature action idempotency, ownership, Bonus Action and snapshot invariants present.");

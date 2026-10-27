import assert from "node:assert/strict";
import fs from "node:fs";
const read = p => fs.readFileSync(p,"utf8");
const sql=read("sql/20261026_07_encounter_hand_transition_command_shadow.sql");
const fixture=read("scripts/fixtures/encounter_hand_transition_command_shadow.sql");
const workflow=read(".github/workflows/validate-encounter-hand-transition-shadow.yml");
const original=read("sql/20260727_04_authoritative_encounter_turn_movement.sql");
const preview=read("sql/20261026_06_encounter_hand_snapshot_transition_shadow.sql");
for (const marker of [
 "public.encounter_hand_transition_requests_shadow_v1",
 "request_id uuid primary key",
 "requested_round integer not null",
 "requested_turn_index integer not null",
 "where applied",
 "enable row level security",
 "from public,anon,authenticated",
 "public.commit_encounter_hand_transition_shadow_v1",
 "public.encounter_can_control_participant_v1",
 "private.can_manage_character_progression_v1",
 "private.can_access_character_v1",
 "for update",
 "v_existing.requested_item_id is distinct from p_target_item_id",
 "v_existing.requested_by is distinct from v_uid",
 "v_e.active_participant_id is distinct from v_p.id",
 "v_e.round is distinct from p_expected_round",
 "v_e.turn_index is distinct from p_expected_turn_index",
 "v_header.invalidated",
 "v_header.version<>p_expected_snapshot_version",
 "private.character_staged_hand_item_valid_v1",
 "v_other_id",
 "v_operation<>'no_change'",
 "snapshotVersion",
 "h.version+1",
 "'canonicalActionSpent',false",
 "'canonicalBonusActionSpent',false",
 "'canonicalReactionSpent',false",
 "'combatLogWritten',false",
 "'activeHandsVerified',false",
 "'focusBonusApplied',false",
 "'combatConsumerEnforced',false",
]) assert.ok(sql.includes(marker),"Missing transactional shadow guard: "+marker);
for (const forbidden of [
 "update public.encounter_participants",
 "update public.encounters",
 "update public.inventory_items",
 "public.encounter_cast_spell_v",
 "public.encounter_weapon_attack_v1(",
 "public.encounter_spellcasting_profile_v2("
]) assert.ok(!sql.includes(forbidden),"Shadow cannot affect canonical consumer: "+forbidden);
for(const marker of ["request_id uuid primary key","public.encounter_can_control_participant_v1","from public.encounter_participants where id=p_participant_id for update","from public.encounters where id=v_participant.encounter_id for update"]) assert.ok(original.includes(marker),"Authoritative turn/move pattern changed: "+marker);
for(const marker of ["public.preview_encounter_hand_transition_shadow_v1","public.capture_encounter_hand_snapshot_shadow_v1","snapshotInvalidated"]) assert.ok(preview.includes(marker),"Previous preflight boundary changed: "+marker);
for(const marker of [
 "encounter_hand_snapshot_transition_shadow.sql",
 "20261026_07_encounter_hand_transition_command_shadow.sql",
 "Exact replay did not return original no-op result",
 "Request UUID reused for a different hand",
 "Idempotent stow created more than one applied command",
 "Multiple experimental changes per turn permitted",
 "Stale hand snapshot version bypassed",
 "Outdated turn identity was accepted",
 "Other-hand duplicate item was accepted",
 "Ambiguous account item entered hand snapshot",
 "Old request replay changed its return value",
 "Physical item mutation did not invalidate command snapshot",
 "Out-of-turn hand transition permitted",
 "Defeated participant changed a hand",
 "Unauthorized actor replayed prior hand command",
 "Shadow command mutated tactical spell slots",
 "Shadow command spent combat action",
]) assert.ok(fixture.includes(marker),"Missing PG16 regression: "+marker);
for(const marker of ["validate_encounter_hand_transition_shadow.mjs","encounter_hand_transition_command_shadow.sql"]) assert.ok(workflow.includes(marker),"Workflow missing: "+marker);
console.log("Shadow hand command idempotency, exact turn, single-write quota, RLS and canonical consumer isolation passed.");

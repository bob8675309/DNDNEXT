import assert from "node:assert/strict";
import fs from "node:fs";
const read = p => fs.readFileSync(p,"utf8");
const audit=read("sql/20261026_09_encounter_attack_action_sequence_audit_shadow.sql");
const fixture=read("scripts/fixtures/encounter_attack_action_sequence_audit_shadow.sql");
const wf=read(".github/workflows/validate-attack-action-sequence-audit-shadow.yml");
const weapon=read("sql/20260729_03_tactical_attack_roll_modifiers.sql");
const core=read("sql/20260727_06_core_combat_actions.sql");
const combat=read("pages/encounters/combat.js");
for(const marker of [
 "private.encounter_attack_action_sequence_audit_shadow_v1",
 "public.encounter_combat_log",
 "public.encounter_command_requests",
 "c.request_id::text=l.detail->>'requestId'",
 "l.actor_participant_id=p_participant_id",
 "l.round=v_e.round",
 "l.turn_index=v_e.turn_index",
 "'weapon_attack'",
 "'unarmed_strike'",
 "'currentTurnAttackEventCount'",
 "'canonicalActionAvailable'",
 "'canonicalWeaponWriterConsumesActionPerAttack',true",
 "'canonicalUnarmedWriterConsumesActionPerAttack',true",
 "'canonicalPerAttackSequenceStatePresent',false",
 "'extraAttackFeatureGrantVerified',false",
 "'extraAttackCountVerified',false",
 "'extraAttackExecutionSupported',false",
 "'attackActionWeaponInteractionCounterPresent',false",
 "'shieldUtilizeActionImplemented',false",
 "'combatConsumerEnforced',false",
 "'auditOnly',true",
 "revoke all on function private.encounter_attack_action_sequence_audit_shadow_v1",
 "to service_role"
])assert.ok(audit.includes(marker),"Audit evidence contract missing "+marker);
for(const forbidden of [
 "update public.", "insert into public.", "delete from public.",
 "public.encounter_weapon_attack_v1(", "public.encounter_use_core_action_v1(",
 "public.commit_encounter_hand_transition_shadow_v1("
])assert.ok(!audit.toLowerCase().includes(forbidden.toLowerCase()),"Read-only diagnostic called a canonical writer: "+forbidden);
// Treat source drift as a HARD FAIL: cannot continue claiming the canonical
// one-attack-per-Action limitation after the real writer changes.
assert.ok(weapon.includes("if not v_a.action_available then raise exception 'Action already spent'; end if;"),"Actual weapon attack action gate changed; re-audit");
assert.ok(weapon.includes("update public.encounter_participants set action_available=false"),"Weapon attack stopped spending the Action; re-audit");
assert.ok(weapon.includes("'weapon_attack'"),"Canonical weapon event provenance changed");
assert.ok(weapon.includes("'unarmed_strike'"),"Canonical unarmed event provenance changed");
assert.ok(core.includes("if p_action not in ('dash','disengage','dodge')"),"Core actions now include different choices; re-audit Utilize");
assert.ok(core.includes("update public.encounter_participants set action_available=false"),"Core action resource ownership changed");
assert.ok(combat.includes('"encounter_weapon_attack_v1"'),"Attack UI route changed");
for(const marker of [
 "encounter_hand_rules_constraints_shadow.sql",
 "20261026_09_encounter_attack_action_sequence_audit_shadow.sql",
 "Real writer one attack/Action gap hidden",
 "Attack events leaked across actor/round/turn",
 "Legacy/unlinked attack incorrectly proved Extra Attack support",
 "Other participant not scoped independently",
 "Read-only Attack sequencing diagnostic modified inventory",
])assert.ok(fixture.includes(marker),"Missing isolated PG16 case "+marker);
for(const marker of [
 "validate_attack_action_sequence_audit_shadow.mjs",
 "encounter_attack_action_sequence_audit_shadow.sql"
])assert.ok(wf.includes(marker),"Missing CI definition "+marker);
console.log("Real canonical Attack action writer/turn/event source drift checks and audit isolation passed.");

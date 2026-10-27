import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
const sql=read("sql/20261027_02_attack_resolver_preflight_parity_shadow.sql");
const fixture=read("scripts/fixtures/attack_resolver_preflight_parity_shadow.sql");
const wf=read(".github/workflows/validate-attack-resolver-preflight-shadow.yml");
const canonical=read("sql/20260729_03_tactical_attack_roll_modifiers.sql");
const prior=read("sql/20261027_01_attack_action_source_budget_shadow.sql");
for(const marker of [
 "private.encounter_weapon_event_resolver_preflight_shadow_v1",
 "public.encounter_attack_action_sessions_shadow_v1",
 "private.character_staged_hand_item_valid_v1",
 "v_s.round<>v_e.round",
 "p_expected_ordinal<>v_s.attacks_recorded+1",
 "not v_p.action_available",
 "public.encounter_combat_log",
 "public.encounter_weapon_profile_internal_v1",
 "public.encounter_targeting_context_internal_v1",
 "where c.item_key=v_exact_key",
 "v_targeting->>'hasLineOfSight'",
 "v_profile->>'normalRangeFt'",
 "v_profile->>'longRangeFt'",
 "v_profile->>'isThrown'",
 "v_t.dodging",
 "'canonicalWeaponProfile',v_profile",
 "'canonicalTargeting',v_targeting",
 "'guidingBoltEffectConsumed',false",
 "'attackSlotNotReserved',true",
 "'damageApplied',false",
 "'canonicalActionSpent',false",
 "'combatConsumerEnforced',false",
 "to service_role"
])assert.ok(sql.includes(marker),"Missing canonical preflight contract "+marker);
for(const banned of [
 "private.encounter_resolve_attack_roll_v1(",
 "public.encounter_apply_damage_internal_v1(",
 "public.encounter_weapon_attack_v1(",
 "public.encounter_unarmed_strike_v1(",
 "update public.", "insert into public.", "delete from public.",
 "random()", "set_config(", "public.record_encounter_attack_event_shadow_v1("
])assert.ok(!sql.toLowerCase().includes(banned.toLowerCase()),"Preview must never execute irreversible actions "+banned);
for(const marker of [
 "public.encounter_weapon_profile_internal_v1(v_a.id,p_inventory_item_id)",
 "public.encounter_targeting_context_internal_v1(v_a.id,v_t.id)",
 "private.encounter_resolve_attack_roll_v1(v_a.id,v_t.id,v_base_disadvantage)",
 "public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage",
 "update public.encounter_participants set action_available=false",
])assert.ok(canonical.includes(marker),"Canonical weapon writer drift "+marker);
assert.ok(prior.includes("public.encounter_attack_action_sessions_shadow_v1"),"Missing prior sourced slot authority");
for(const marker of [
 "attack_action_source_budget_shadow.sql",
 "20261027_02_attack_resolver_preflight_parity_shadow.sql",
 "Exact canonical profile preview overclaimed effects",
 "Canonical ranged long/normal distance or cover calculation diverged",
 "Blocked LOS accepted",
 "Beyond-long-range bow accepted",
 "Beyond-melee-reach sword accepted",
 "Unknown catalogue item accepted as trusted weapon",
 "Skipped attack ordinal accepted by resolver preflight",
 "Canonical Action-spent preflight bypassed",
 "Out-of-turn resolver preview accepted",
 "Read-only resolver preflight changed game, idempotency or attack slots"
])assert.ok(fixture.includes(marker),"Missing PG16 regression "+marker);
for(const marker of [
 "validate_attack_resolver_preflight_parity_shadow.mjs",
 "attack_resolver_preflight_parity_shadow.sql"
])assert.ok(wf.includes(marker),"Missing workflow "+marker);
console.log("Canonical weapon/LOS read parity, exact catalog identity, and zero roll/effect/damage side effects verified.");

import assert from "node:assert/strict";
import fs from "node:fs";
const read=path=>fs.readFileSync(path,"utf8");
const original=read("sql/20260801_04_shared_equipment_effects_tactical_modifiers.sql");
const exact=read("scripts/fixtures/legacy_tactical_weapon_profile_v1.sql");
const shadow=read("sql/20261025_09_attuned_weapon_profile_shadow.sql");
const fixture=read("scripts/fixtures/attuned_weapon_profile_shadow.sql");
const wf=read(".github/workflows/validate-attuned-weapon-profile-shadow.yml");
const start=original.indexOf("create or replace function public.encounter_canonical_combat_snapshot_v1(");
assert.ok(start>=0,"Canonical snapshot boundary missing");
assert.equal(
  exact.slice(exact.indexOf("create or replace function public.encounter_canonical_combat_snapshot_v1(")).trim(),
  original.slice(start).trim(),
  "Test snapshot/weapon profile MUST equal the exact canonical SQL source"
);
for(const marker of [
  "private.encounter_attuned_weapon_profile_shadow_v1",
  "public.encounter_weapon_profile_internal_v1(p_participant_id,p_inventory_item_id)",
  "private.character_attuned_ability_shadow_v1(v_p.character_id)",
  "private.character_magic_effect_source_gate_shadow_v1(v_p.character_id)",
  "v_baseline->>'magicBonus'",
  "v_baseline->>'proficiencyBonus'",
  "v_baseline->>'isRanged'",
  "v_baseline->>'isFinesse'",
  "v_effects#>>'{abilities,str,effectiveMod}'",
  "v_effects#>>'{abilities,dex,effectiveMod}'",
  "'bonusWeapon','bonus_weapon','enhancement_bonus'",
  "v_bonus_key='smith_tier'",
  "v_unresolved:=v_unresolved",
  "v_magic:=0",
  "'attackBonus',v_attack",
  "'shadowFlatDamageBonus',v_damage_flat",
  "'weaponSourceParityReady',false",
  "'consumerEnforced',false",
  "revoke all on function private.encounter_attuned_weapon_profile_shadow_v1",
  "to service_role",
]) assert.ok(shadow.includes(marker),"Shadow weapon source contract missing: "+marker);
for(const forbidden of [
  "update public.encounter_participants",
  "update public.inventory_items",
  "update public.character_sheets",
  "create or replace function public.encounter_weapon_profile_internal_v1",
  "create or replace function public.encounter_weapon_attack_v1"
]) assert.ok(!shadow.toLowerCase().includes(forbidden),"Shadow may not replace combat authority: "+forbidden);
const writer=read("sql/20260727_08_equipped_weapon_attacks.sql");
for(const part of [
  "v_total := v_roll + coalesce((v_profile->>'attackBonus')::integer,0)",
  "v_magic_bonus := coalesce((v_profile->>'magicBonus')::integer,0)",
  "v_damage := greatest(0,v_damage_roll+v_ability_mod+v_magic_bonus)"
]) assert.ok(writer.includes(part),"Attack writer profile contract changed: "+part);
for (const part of [
  "attuned_armor_shield_channel_audit.sql",
  "legacy_tactical_weapon_profile_v1.sql",
  "20261025_09_attuned_weapon_profile_shadow.sql",
  "Weapon OFF legacy exact profile parity",
  "Unselected +2 sword damage/attack separation",
  "Mundane finesse kept physical weapon",
  "Selected bow + boots source bonus parity",
  "Finesse did not rechoose",
  "Smith tier was incorrectly",
  "Unverified rare weapon bypassed",
  "Shared player magic weapon leaked"
]) assert.ok(fixture.includes(part),"PostgreSQL weapon fixture missing: "+part);
for(const marker of [
 "validate_shared_equipment_effects_pipeline.mjs",
 "validate_attuned_weapon_profile_shadow.mjs",
 "attuned_weapon_profile_shadow.sql"
]) assert.ok(wf.includes(marker),"Exact head workflow missing: "+marker);
console.log("Canonical tactical snapshot/weapon profile exact-source check, inert comparison, and attack/damage parity contracts passed.");

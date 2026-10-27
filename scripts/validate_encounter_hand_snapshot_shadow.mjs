import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
const sql=read("sql/20261026_06_encounter_hand_snapshot_transition_shadow.sql");
const fixture=read("scripts/fixtures/encounter_hand_snapshot_transition_shadow.sql");
const wf=read(".github/workflows/validate-encounter-hand-snapshot-shadow.yml");
const prior=read("sql/20261026_05_character_hand_loadout_staging.sql");
for(const marker of [
 "public.encounter_hand_snapshot_header_shadow_v1",
 "public.encounter_hand_snapshot_items_shadow_v1",
 "unique(participant_id,inventory_item_id)",
 "invalidated boolean not null default false",
 "enable row level security",
 "private.character_staged_hand_item_valid_v1",
 "public.encounter_can_control_participant_v1",
 "private.can_manage_character_progression_v1",
 "private.can_access_character_v1",
 "public.get_encounter_hand_snapshot_shadow_v1",
 "public.capture_encounter_hand_snapshot_shadow_v1",
 "public.preview_encounter_hand_transition_shadow_v1",
 "v_e.status not in ('draft','ready','initiative')",
 "v_e.status<>'active'",
 "v_e.active_participant_id is distinct from v_p.id",
 "hashtextextended(",
 "for update",
 "snapshotInvalidated",
 "p_expected_snapshot_version",
 "private.invalidate_encounter_hand_snapshot_shadow_v1",
 "version=h.version+1",
 "old.equip_slot is distinct from new.equip_slot",
 "'actionCostVerified',false",
 "'activeHandsVerified',false",
 "'focusBonusApplied',false",
 "'combatConsumerEnforced',false",
 "from public,anon,authenticated"
]) assert.ok(sql.includes(marker),"Missing encounter-hand shadow safeguard: "+marker);
for(const marker of [
 "character_hand_loadout_staging_v1",
 "('weapon_1','weapon_2','weapon_3')",
 "private.assert_character_resource_not_active_v1",
]) assert.ok(prior.includes(marker),"Existing staging guard changed: "+marker);
for(const forbidden of [
 "update public.inventory_items", "update public.encounter_participants",
 "update public.encounter_spell_slots", "public.encounter_cast_spell_v",
 "public.encounter_spellcasting_profile_v2"
]) assert.ok(!sql.includes(forbidden),"Shadow must not modify gameplay: "+forbidden);
for(const marker of [
 "character_hand_loadout_staging.sql",
 "20261026_06_encounter_hand_snapshot_transition_shadow.sql",
 "Unauthorized encounter hand capture permitted",
 "Inactive encounter preview was accepted",
 "Active encounter snapshot was silently recaptured",
 "Out-of-turn participant could preview a hand change",
 "Defeated participant could preview action",
 "Preview allowed same physical item in both hands",
 "Stale expected snapshot version was accepted",
 "Physical item edit failed to invalidate entire encounter capture",
 "Partially invalidated encounter hand snapshot still authorized preview",
 "Hand snapshot operations spent or synced spell slots",
 "Hand snapshot operations changed participant combat resources",
]) assert.ok(fixture.includes(marker),"Missing disposable PG16 fixture: "+marker);
for(const marker of ["validate_encounter_hand_snapshot_shadow.mjs","encounter_hand_snapshot_transition_shadow.sql"]) assert.ok(wf.includes(marker),"Workflow incomplete: "+marker);
console.log("Encounter-scoped snapshot, active-turn-only dry-run, invalidation and unchanged live gameplay contract passed.");

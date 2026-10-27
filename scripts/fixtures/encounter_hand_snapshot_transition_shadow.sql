\set ON_ERROR_STOP on
-- Full existing spell and physical inventory ownership fixtures.
\i scripts/fixtures/character_hand_loadout_staging.sql

-- Previous fixture intentionally transfers/unequips items. Restore ONLY
-- disposable fixture data before testing encounter hand captures.
update public.inventory_items set
 owner_type='character',owner_id='cccccccc-0000-4000-8000-000000000001',
 is_equipped=true,equip_slot='weapon_2'
 where id='eeeeeeee-0000-4000-8000-000000000030';
update public.inventory_items set
 is_equipped=true,equip_slot='weapon_3'
 where id='eeeeeeee-0000-4000-8000-000000000031';

create table public.encounters(
 id uuid primary key,status text not null,active_participant_id uuid,
 version bigint default 1
);
alter table public.encounter_participants
 add column encounter_id uuid,
 add column is_defeated boolean default false;
insert into public.encounters(id,status,active_participant_id) values
 ('ffffffff-0000-4000-8000-000000000001','draft',null);
update public.encounter_participants set
 encounter_id='ffffffff-0000-4000-8000-000000000001';
\i sql/20261026_06_encounter_hand_snapshot_transition_shadow.sql

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 other uuid:='cccccccc-0000-4000-8000-000000000002';
 p uuid:='dddddddd-0000-4000-8000-000000000001';
 other_p uuid:='dddddddd-0000-4000-8000-000000000002';
 rod uuid:='eeeeeeee-0000-4000-8000-000000000030';
 wand uuid:='eeeeeeee-0000-4000-8000-000000000031';
 staff uuid:='eeeeeeee-0000-4000-8000-000000000002';
 shared uuid:='eeeeeeee-0000-4000-8000-000000000009';
 v jsonb;
 items_before jsonb;
 items_after jsonb;
 spells_before jsonb;
 spells_after jsonb;
 combat_before jsonb;
 combat_after jsonb;
 snapshot_before jsonb;
 snapshot_after jsonb;
 blocked boolean;
 ver integer;
begin
 if has_table_privilege('authenticated','public.encounter_hand_snapshot_header_shadow_v1','SELECT')
 or has_table_privilege('authenticated','public.encounter_hand_snapshot_items_shadow_v1','INSERT')
 or has_function_privilege('anon','public.capture_encounter_hand_snapshot_shadow_v1(uuid)','EXECUTE')
 or has_function_privilege('anon','public.preview_encounter_hand_transition_shadow_v1(uuid,text,uuid,integer)','EXECUTE')
 or not has_function_privilege('authenticated','public.get_encounter_hand_snapshot_shadow_v1(uuid)','EXECUTE')
 then raise exception 'Encounter hand shadow direct table or RPC ACL is unsafe'; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb)
 into items_before from public.inventory_items i;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into spells_before from public.encounter_spell_slots s;
 select coalesce(jsonb_agg(to_jsonb(ep) order by ep.id),'[]'::jsonb)
 into combat_before from public.encounter_participants ep;
 v:=public.get_encounter_hand_snapshot_shadow_v1(p);
 if v->>'initialized'<>'false'
 or v->>'activeHandsVerified'<>'false'
 or v->>'combatConsumerEnforced'<>'false'
 or jsonb_array_length(v->'hands')<>0 then
   raise exception 'Missing encounter hand snapshot was treated as initialized %',v; end if;

 -- Unbound player-account inventory is deliberately not usable for
 -- physical hands even if older inventory views show it as equipped.
 blocked:=false;
 begin perform public.set_character_hand_loadout_staging_v1(c,shared,null);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Ambiguous account item unexpectedly staged as hand'; end if;

 perform public.set_character_hand_loadout_staging_v1(c,rod,wand);
 v:=public.capture_encounter_hand_snapshot_shadow_v1(p);
 if v->>'initialized'<>'true' or v->>'snapshotVersion'<>'1'
 or v->>'snapshotInvalidated'<>'false'
 or jsonb_array_length(v->'hands')<>2
 or v->>'actionEconomyVerified'<>'false'
 or v->>'focusBonusApplied'<>'false'
 then raise exception 'Draft encounter snapshot capture failed %',v; end if;
 v:=public.capture_encounter_hand_snapshot_shadow_v1(p);
 if v->>'snapshotVersion'<>'2'
 or jsonb_array_length(v->'hands')<>2 then
   raise exception 'Recapture failed to increment encounter snapshot version %',v; end if;
 ver:=(v->>'snapshotVersion')::integer;

 -- Another character is editable but cannot borrow this character's
 -- precise staged item identity for an unrelated encounter participant.
 v:=public.capture_encounter_hand_snapshot_shadow_v1(other_p);
 if v->>'initialized'<>'true' or jsonb_array_length(v->'hands')<>0 then
   raise exception 'Other participant unexpectedly captured first participant hands %',v; end if;

 -- Cross-account users cannot capture/read or preview somebody else's
 -- encounter participant, even if service role can run source audits.
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000009',true);
 blocked:=false;
 begin perform public.capture_encounter_hand_snapshot_shadow_v1(p);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Unauthorized encounter hand capture permitted'; end if;
 blocked:=false;
 begin perform public.get_encounter_hand_snapshot_shadow_v1(p);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Unauthorized encounter hand read permitted'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);

 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb)
 into items_after from public.inventory_items i;
 if items_after is distinct from items_before then
   raise exception 'Snapshot capture moved or equipped physical inventory'; end if;

 -- Neither before-active nor out-of-turn commands can preview a draw.
 blocked:=false;
 begin perform public.preview_encounter_hand_transition_shadow_v1(
 p,'main',staff,ver);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Inactive encounter preview was accepted'; end if;

 update public.encounters set status='active',active_participant_id=p
 where id='ffffffff-0000-4000-8000-000000000001';

 blocked:=false;
 begin perform public.capture_encounter_hand_snapshot_shadow_v1(p);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Active encounter snapshot was silently recaptured'; end if;

 v:=public.preview_encounter_hand_transition_shadow_v1(p,'main',rod,ver);
 if v->>'proposedCommand'<>'no_change'
 or v->>'weaponSwapApplied'<>'false'
 or v->>'actionCostVerified'<>'false'
 or v->>'activeHandsVerified'<>'false'
 or v->>'combatConsumerEnforced'<>'false'
 then raise exception 'Preview no-op claimed gameplay action %',v; end if;
 v:=public.preview_encounter_hand_transition_shadow_v1(p,'main',null,ver);
 if v->>'proposedCommand'<>'stow'
 or v->>'requestedInventoryItemId' is not null then
   raise exception 'Empty main hand failed stow preview %',v; end if;
 v:=public.preview_encounter_hand_transition_shadow_v1(p,'off',staff,ver);
 if v->>'proposedCommand'<>'replace'
 or v->>'priorInventoryItemId'<>wand::text
 or v->>'requestedInventoryItemId'<>staff::text
 or v->>'weaponSwapApplied'<>'false'
 then raise exception 'Replacement preview changed actual hand state %',v; end if;

 blocked:=false;
 begin perform public.preview_encounter_hand_transition_shadow_v1(
 p,'off',rod,ver);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Preview allowed same physical item in both hands'; end if;

 blocked:=false;
 begin perform public.preview_encounter_hand_transition_shadow_v1(
 p,'main',shared,ver);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Preview borrowed shared-account physical inventory'; end if;

 blocked:=false;
 begin perform public.preview_encounter_hand_transition_shadow_v1(
 p,'main',staff,ver-1);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Stale expected snapshot version was accepted'; end if;

 blocked:=false;
 begin perform public.preview_encounter_hand_transition_shadow_v1(
 other_p,'main',null,1);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Out-of-turn participant could preview a hand change'; end if;

 update public.encounter_participants set is_defeated=true where id=p;
 blocked:=false;
 begin perform public.preview_encounter_hand_transition_shadow_v1(
 p,'main',null,ver);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Defeated participant could preview action'; end if;
 update public.encounter_participants set is_defeated=false where id=p;

 select coalesce(jsonb_agg(to_jsonb(h) order by h.participant_id,h.hand),'[]'::jsonb)
 into snapshot_before from public.encounter_hand_snapshot_items_shadow_v1 h;
 perform public.preview_encounter_hand_transition_shadow_v1(p,'off',staff,ver);
 select coalesce(jsonb_agg(to_jsonb(h) order by h.participant_id,h.hand),'[]'::jsonb)
 into snapshot_after from public.encounter_hand_snapshot_items_shadow_v1 h;
 if snapshot_before is distinct from snapshot_after then
   raise exception 'Read-only preview unexpectedly changed encounter hands'; end if;

 -- During active combat a physical item modification must INVALIDATE
 -- the entire capture/version, not silently leave an apparently valid
 -- one-handed partial snapshot after clearing the affected hand.
 update public.inventory_items set equip_slot='weapon_1' where id=rod;
 v:=public.get_encounter_hand_snapshot_shadow_v1(p);
 if v->>'snapshotInvalidated'<>'true'
 or (v->>'snapshotVersion')::integer<>ver+1
 or jsonb_array_length(v->'hands')<>1 then
   raise exception 'Physical item edit failed to invalidate entire encounter capture %',v; end if;
 blocked:=false;
 begin perform public.preview_encounter_hand_transition_shadow_v1(
 p,'off',staff,ver+1);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then
   raise exception 'Partially invalidated encounter hand snapshot still authorized preview'; end if;
 blocked:=false;
 begin perform public.capture_encounter_hand_snapshot_shadow_v1(p);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Active encounter allowed invalidated recapture'; end if;

 -- No spell slot writer, HP/turn writer or equipped inventory operation
 -- may be triggered by capture/preview; only fixture's explicit edits count.
 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into spells_after from public.encounter_spell_slots s;
 if spells_after is distinct from spells_before then
   raise exception 'Hand snapshot operations spent or synced spell slots'; end if;
 select coalesce(jsonb_agg(to_jsonb(ep) order by ep.id),'[]'::jsonb)
 into combat_after from public.encounter_participants ep;
 -- Fixture explicitly flips is_defeated then resets it; otherwise unchanged.
 if combat_after is distinct from combat_before then
   raise exception 'Hand snapshot operations changed participant combat resources'; end if;
end $test$;
select 'Encounter hand shadow captured precombat, previewed turn-scoped commands, denied stale/foreign/active edits and preserved resources' as result;

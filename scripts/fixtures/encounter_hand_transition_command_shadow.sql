\set ON_ERROR_STOP on
-- Disposable PG16 ONLY. Compose all prior source/attunement/equipment, spell
-- and encounter preflight tests, without calling any live battle writer.
\i scripts/fixtures/encounter_hand_snapshot_transition_shadow.sql
-- The prior encounter fixture models a minimal schema. Include the actual
-- live turn identifiers used by encounter_end_turn_v1.
alter table public.encounters add column round integer not null default 1,
 add column turn_index integer not null default 0;
alter table public.encounter_participants
 add column action_available boolean not null default true,
 add column bonus_action_available boolean not null default true,
 add column reaction_available boolean not null default true,
 add column current_hp integer not null default 20;
\i sql/20261026_07_encounter_hand_transition_command_shadow.sql

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 p uuid:='dddddddd-0000-4000-8000-000000000001';
 other_p uuid:='dddddddd-0000-4000-8000-000000000002';
 e uuid:='ffffffff-0000-4000-8000-000000000001';
 rod uuid:='eeeeeeee-0000-4000-8000-000000000030';
 wand uuid:='eeeeeeee-0000-4000-8000-000000000031';
 staff uuid:='eeeeeeee-0000-4000-8000-000000000002';
 shared uuid:='eeeeeeee-0000-4000-8000-000000000009';
 req_none uuid:='bbbbbbbb-eeee-4000-8000-000000000001';
 req_first uuid:='bbbbbbbb-eeee-4000-8000-000000000002';
 req_second uuid:='bbbbbbbb-eeee-4000-8000-000000000003';
 req_third uuid:='bbbbbbbb-eeee-4000-8000-000000000004';
 req_next uuid:='bbbbbbbb-eeee-4000-8000-000000000005';
 snapshot jsonb;
 v jsonb;
 replay jsonb;
 before_inventory jsonb;
 after_inventory jsonb;
 before_slots jsonb;
 after_slots jsonb;
 before_combat jsonb;
 after_combat jsonb;
 blocked boolean;
 version0 integer;
begin
 if has_table_privilege('anon','public.encounter_hand_transition_requests_shadow_v1','SELECT')
 or has_table_privilege('authenticated','public.encounter_hand_transition_requests_shadow_v1','INSERT')
 or has_function_privilege('anon',
  'public.commit_encounter_hand_transition_shadow_v1(uuid,text,uuid,integer,integer,integer,uuid)','EXECUTE')
 or not has_function_privilege('authenticated',
  'public.commit_encounter_hand_transition_shadow_v1(uuid,text,uuid,integer,integer,integer,uuid)','EXECUTE')
 then raise exception 'Encounter shadow command or request ledger ACL failure'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);

 -- The prior fixture intentionally invalidated hand capture during active
 -- combat. Restore physical items in this disposable DB and recapture while
 -- NOT active, then start the simulated participant turn.
 update public.encounters set status='ready',active_participant_id=null
 where id=e;
 update public.inventory_items set is_equipped=true,equip_slot='weapon_2'
 where id=rod;
 update public.inventory_items set is_equipped=true,equip_slot='weapon_3'
 where id=wand;
 perform public.set_character_hand_loadout_staging_v1(c,rod,wand);
 snapshot:=public.capture_encounter_hand_snapshot_shadow_v1(p);
 version0:=(snapshot->>'snapshotVersion')::integer;
 if snapshot->>'initialized'<>'true'
 or snapshot->>'snapshotInvalidated'<>'false'
 or jsonb_array_length(snapshot->'hands')<>2 then
   raise exception 'Fresh precombat snapshot not restored %',snapshot; end if;
 update public.encounters set status='active',active_participant_id=p,
    round=1,turn_index=0 where id=e;

 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb)
 into before_inventory from public.inventory_items i;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into before_slots from public.encounter_spell_slots s;
 select coalesce(jsonb_agg(to_jsonb(ep) order by ep.id),'[]'::jsonb)
 into before_combat from public.encounter_participants ep;

 -- No-change request remains idempotent and never consumes the experimental
 -- one-transition-per-turn allowance.
 v:=public.commit_encounter_hand_transition_shadow_v1(
 p,'main',rod,version0,1,0,req_none);
 if v->>'operation'<>'no_change'
 or v->>'shadowHandStateTransitioned'<>'false'
 or (v->>'snapshotVersion')::integer<>version0
 or v->>'canonicalActionSpent'<>'false'
 or v->>'combatConsumerEnforced'<>'false'
 then raise exception 'No-op command affected game or snapshot %',v; end if;
 replay:=public.commit_encounter_hand_transition_shadow_v1(
 p,'main',rod,version0,1,0,req_none);
 if replay is distinct from v then
   raise exception 'Exact replay did not return original no-op result'; end if;
 blocked:=false;
 begin perform public.commit_encounter_hand_transition_shadow_v1(
 p,'off',rod,version0,1,0,req_none);
 exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Request UUID reused for a different hand'; end if;

 -- A real SHADOW stow atomically removes main hand and increments its version.
 v:=public.commit_encounter_hand_transition_shadow_v1(
 p,'main',null,version0,1,0,req_first);
 if v->>'operation'<>'stow'
 or v->>'shadowHandStateTransitioned'<>'true'
 or (v->>'snapshotVersion')::integer<>version0+1
 or v->>'canonicalActionSpent'<>'false'
 or v->>'focusBonusApplied'<>'false'
 then raise exception 'Stow did not change SHADOW hand atomically %',v; end if;
 snapshot:=public.get_encounter_hand_snapshot_shadow_v1(p);
 if (snapshot->>'snapshotVersion')::integer<>version0+1
 or jsonb_array_length(snapshot->'hands')<>1 then
   raise exception 'Stow failed to preserve other hand and version %',snapshot; end if;
 replay:=public.commit_encounter_hand_transition_shadow_v1(
 p,'main',null,version0,1,0,req_first);
 if replay is distinct from v then
   raise exception 'Duplicate request re-applied a stow'; end if;
 if (select count(*) from public.encounter_hand_transition_requests_shadow_v1
   where participant_id=p and applied)<>1 then
   raise exception 'Idempotent stow created more than one applied command'; end if;

 -- A second applied change in the same exact round/turn is blocked by both
 -- the function and the independent unique partial index.
 blocked:=false;
 begin perform public.commit_encounter_hand_transition_shadow_v1(
 p,'main',staff,version0+1,1,0,req_second);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Multiple experimental changes per turn permitted'; end if;
 blocked:=false;
 begin perform public.commit_encounter_hand_transition_shadow_v1(
 p,'main',staff,version0,1,0,req_second);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Stale hand snapshot version bypassed'; end if;

 -- New turn is simulated explicitly in the fixture. The shadow command
 -- still never changes round/turn fields itself.
 update public.encounters set round=2,turn_index=0 where id=e;
 blocked:=false;
 begin perform public.commit_encounter_hand_transition_shadow_v1(
 p,'main',staff,version0+1,1,0,req_third);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Outdated turn identity was accepted'; end if;
 blocked:=false;
 begin perform public.commit_encounter_hand_transition_shadow_v1(
 p,'off',wand,version0+1,2,0,req_third);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Other-hand duplicate item was accepted'; end if;

 blocked:=false;
 begin perform public.commit_encounter_hand_transition_shadow_v1(
 p,'main',shared,version0+1,2,0,req_third);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Ambiguous account item entered hand snapshot'; end if;

 v:=public.commit_encounter_hand_transition_shadow_v1(
 p,'main',staff,version0+1,2,0,req_next);
 if v->>'operation'<>'draw'
 or v->>'shadowHandStateTransitioned'<>'true'
 or (v->>'snapshotVersion')::integer<>version0+2 then
   raise exception 'Following turn did not permit one draw %',v; end if;

 -- A replay on the following turn of the *old* successful command returns
 -- the stored result instead of charging it again or changing current hands.
 replay:=public.commit_encounter_hand_transition_shadow_v1(
 p,'main',null,version0,1,0,req_first);
 if replay->>'snapshotVersion'<>>(version0+1)::text then
   raise exception 'Old request replay changed its return value'; end if;

 -- Invalidated captures cannot be used even with a new fresh request ID.
 update public.inventory_items
   set card_payload=card_payload||'{"changed":"invalidates"}'::jsonb
 where id=staff;
 snapshot:=public.get_encounter_hand_snapshot_shadow_v1(p);
 if snapshot->>'snapshotInvalidated'<>'true'
 or (snapshot->>'snapshotVersion')::integer<>version0+3 then
   raise exception 'Physical item mutation did not invalidate command snapshot %',snapshot; end if;
 blocked:=false;
 begin perform public.commit_encounter_hand_transition_shadow_v1(
 p,'main',null,version0+3,2,0,req_second);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Invalidated snapshot accepted a fresh command'; end if;

 -- Out-of-turn, defeated and unauthorized requests fail even with an
 -- optimistic request version. Replays still require caller authorization.
 update public.encounters set active_participant_id=other_p where id=e;
 blocked:=false;
 begin perform public.commit_encounter_hand_transition_shadow_v1(
 p,'off',null,version0+3,2,0,req_second);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Out-of-turn hand transition permitted'; end if;
 update public.encounters set active_participant_id=p where id=e;
 update public.encounter_participants set is_defeated=true where id=p;
 blocked:=false;
 begin perform public.commit_encounter_hand_transition_shadow_v1(
 p,'off',null,version0+3,2,0,req_second);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Defeated participant changed a hand'; end if;
 update public.encounter_participants set is_defeated=false where id=p;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000009',true);
 blocked:=false;
 begin perform public.commit_encounter_hand_transition_shadow_v1(
 p,'main',null,version0,1,0,req_first);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Unauthorized actor replayed prior hand command'; end if;
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);

 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb)
 into after_inventory from public.inventory_items i;
 -- The fixture intentionally edited ONLY staff.card_payload; shadow RPC
 -- must not move, remove or equip items or alter their owner/slot.
 if (select count(*) from public.inventory_items i
   where i.id=rod and i.is_equipped and i.equip_slot='weapon_2')<>1
 or (select count(*) from public.inventory_items i
   where i.id=wand and i.is_equipped and i.equip_slot='weapon_3')<>1
 then raise exception 'Shadow command altered physical equipment'; end if;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into after_slots from public.encounter_spell_slots s;
 if after_slots is distinct from before_slots then
   raise exception 'Shadow command mutated tactical spell slots'; end if;
 select coalesce(jsonb_agg(to_jsonb(ep) order by ep.id),'[]'::jsonb)
 into after_combat from public.encounter_participants ep;
 if after_combat is distinct from before_combat then
   raise exception 'Shadow command spent combat action, changed HP or turn participants'; end if;
 if exists(select 1 from public.encounter_hand_transition_requests_shadow_v1
   where result->>'combatConsumerEnforced'<>'false'
   or result->>'activeHandsVerified'<>'false'
   or result->>'canonicalActionSpent'<>'false') then
   raise exception 'Shadow ledger incorrectly asserted live action/effect enforcement'; end if;
end $test$;
select 'Transactional shadow hand changes: request replay, one-per-turn, stale/turn/custody denial and unchanged gameplay passed' result;

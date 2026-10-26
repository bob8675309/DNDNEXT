\set ON_ERROR_STOP on
-- Disposable PG16 only. Compose actual owner/permission, slot/cast, item
-- selection and spell-source fixture data from draft #285.
\i scripts/fixtures/attuned_spell_list_hand_evidence.sql
-- Prior fixture uses legacy main_hand/off_hand values as evidence probes.
-- Authoritative equipment RPC accepts weapon_1..3 instead. Reset the
-- chosen physical rows before staging migration/trigger installation.
update public.inventory_items set equip_slot='weapon_2'
 where id='eeeeeeee-0000-4000-8000-000000000030';
update public.inventory_items set equip_slot='weapon_3'
 where id='eeeeeeee-0000-4000-8000-000000000031';
\i sql/20261026_05_character_hand_loadout_staging.sql

do $test$
declare
 c uuid:='cccccccc-0000-4000-8000-000000000001';
 other uuid:='cccccccc-0000-4000-8000-000000000002';
 rod uuid:='eeeeeeee-0000-4000-8000-000000000030';
 wand uuid:='eeeeeeee-0000-4000-8000-000000000031';
 staff uuid:='eeeeeeee-0000-4000-8000-000000000002';
 shared uuid:='eeeeeeee-0000-4000-8000-000000000009';
 foreign_item uuid:='eeeeeeee-0000-4000-8000-000000000010';
 unequipped uuid:='eeeeeeee-0000-4000-8000-000000000008';
 v jsonb;
 before_items jsonb;
 after_items jsonb;
 before_slots jsonb;
 after_slots jsonb;
 blocked boolean;
begin
 if has_table_privilege('anon','public.character_hand_loadout_staging_v1','SELECT')
 or has_table_privilege('authenticated','public.character_hand_loadout_staging_v1','INSERT')
 or has_table_privilege('authenticated','public.character_hand_loadout_staging_v1','DELETE')
 or has_function_privilege('anon','public.set_character_hand_loadout_staging_v1(uuid,uuid,uuid)','EXECUTE')
 or has_function_privilege('anon','public.get_character_hand_loadout_staging_v1(uuid)','EXECUTE')
 or not has_function_privilege('authenticated','public.set_character_hand_loadout_staging_v1(uuid,uuid,uuid)','EXECUTE')
 then raise exception 'Hand loadout grants expose private rows or fail authenticated RPC'; end if;
 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb)
 into before_items from public.inventory_items i;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into before_slots from public.encounter_spell_slots s;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 v:=public.get_character_hand_loadout_staging_v1(c);
 if v->>'activeHoldVerified'<>'false'
 or v->>'combatSnapshotVerified'<>'false'
 or v->>'focusConsumerEnforced'<>'false'
 or jsonb_array_length(v->'staged')<>0
 then raise exception 'Empty loadout is not fail-closed %',v; end if;

 v:=public.set_character_hand_loadout_staging_v1(c,rod,wand);
 if jsonb_array_length(v->'staged')<>2
    or v->>'physicalInventoryChanged'<>'false'
    or v->>'activeHoldVerified'<>'false'
    or (select count(*) from public.character_hand_loadout_staging_v1 where character_id=c)<>2
 then raise exception 'Character-selected two-hand staging failed %',v; end if;
 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb)
 into after_items from public.inventory_items i;
 if after_items is distinct from before_items then
   raise exception 'Hand staging changed physical equipment rows'; end if;

 -- Idempotent replacement, one hand clear, and an entirely empty state.
 v:=public.set_character_hand_loadout_staging_v1(c,rod,null);
 if jsonb_array_length(v->'staged')<>1
 or exists(select 1 from public.character_hand_loadout_staging_v1
           where character_id=c and hand='off') then
   raise exception 'Clearing the off-hand did not preserve main-hand %',v; end if;
 v:=public.set_character_hand_loadout_staging_v1(c,null,null);
 if jsonb_array_length(v->'staged')<>0
 then raise exception 'Empty hand loadout was rejected %',v; end if;

 blocked:=false;
 begin perform public.set_character_hand_loadout_staging_v1(c,rod,rod);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Duplicate physical item occupied both hands'; end if;

 blocked:=false;
 begin perform public.set_character_hand_loadout_staging_v1(c,shared,null);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Account-shared item treated as exclusive physical custody'; end if;

 blocked:=false;
 begin perform public.set_character_hand_loadout_staging_v1(c,foreign_item,null);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Other-character item bypassed ownership check'; end if;
 blocked:=false;
 begin perform public.set_character_hand_loadout_staging_v1(c,unequipped,null);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Unequipped item used for a staged hand'; end if;

 -- Valid source in a nonweapon slot cannot claim a hand simply by name.
 blocked:=false;
 begin perform public.set_character_hand_loadout_staging_v1(c,
   'eeeeeeee-0000-4000-8000-000000000001'::uuid,null);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Ring slot improperly accepted as physical hand'; end if;

 -- No arbitrary writes by a user without management rights.
 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000009',true);
 blocked:=false;
 begin perform public.set_character_hand_loadout_staging_v1(c,rod,null);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Unauthorized user staged someone else hands'; end if;
 blocked:=false;
 begin perform public.get_character_hand_loadout_staging_v1(c);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Unauthorized user read other character hands'; end if;

 perform set_config('fixture.uid','aaaaaaaa-0000-4000-8000-000000000002',true);
 insert into public.active_test_encounters values(c);
 blocked:=false;
 begin perform public.set_character_hand_loadout_staging_v1(c,rod,wand);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Active encounter failed to lock hand loadout changes'; end if;
 delete from public.active_test_encounters where character_id=c;

 -- Test all invalidation inputs without mutating physical items in the setter.
 perform public.set_character_hand_loadout_staging_v1(c,rod,wand);
 update public.inventory_items set equip_slot='weapon_1' where id=rod;
 if exists(select 1 from public.character_hand_loadout_staging_v1 where inventory_item_id=rod)
 then raise exception 'Moved equipment slot retained obsolete hand declaration'; end if;
 if not exists(select 1 from public.character_hand_loadout_staging_v1 where inventory_item_id=wand)
 then raise exception 'Other hand unexpectedly cleared by a separate slot move'; end if;
 update public.inventory_items set is_equipped=false where id=wand;
 if exists(select 1 from public.character_hand_loadout_staging_v1 where inventory_item_id=wand)
 then raise exception 'Unequip failed to invalidate staged hand'; end if;

 perform public.set_character_hand_loadout_staging_v1(c,staff,null);
 update public.inventory_items
 set card_payload=card_payload || '{"changed":"source"}'::jsonb where id=staff;
 if exists(select 1 from public.character_hand_loadout_staging_v1 where inventory_item_id=staff)
 then raise exception 'Source identity edit failed to revoke loadout'; end if;

 perform public.set_character_hand_loadout_staging_v1(c,rod,null);
 update public.inventory_items set owner_id=other::text where id=rod;
 if exists(select 1 from public.character_hand_loadout_staging_v1 where inventory_item_id=rod)
 then raise exception 'Owner transfer failed to revoke staged hand'; end if;
 update public.inventory_items set owner_id=c::text where id=rod;
 if exists(select 1 from public.character_hand_loadout_staging_v1 where inventory_item_id=rod)
 then raise exception 'Transfer back resurrected old hand declaration'; end if;

 select coalesce(jsonb_agg(to_jsonb(s) order by s.participant_id,s.slot_level),'[]'::jsonb)
 into after_slots from public.encounter_spell_slots s;
 if before_slots is distinct from after_slots then
   raise exception 'Hand staging touched tactical spell-slot resources'; end if;
end $test$;
select 'Character-scoped precombat hand staging, ACL, custody, combat lock and inventory invalidation passed' as result;

\set ON_ERROR_STOP on
-- Extend the #257..#263 isolated PostgreSQL fixture, never production.
-- Use production-shaped authoritative rest state, with minimal mock class
-- restoration and permissions to test the ORIGINAL rest function body.
alter table public.character_rest_log
  add column if not exists completed_by uuid,
  add column if not exists restored_spell_slots integer,
  add column if not exists restored_spell_uses integer;
alter table public.character_rest_log alter column id set default gen_random_uuid();

create table public.character_spell_slots(
 character_id uuid, slots_max integer, slots_remaining integer,
 recharge_key text, updated_at timestamptz
);
create table public.character_spells(
 character_id uuid, uses_max integer, uses_remaining integer,
 recharge text, updated_at timestamptz
);
create or replace function private.sync_character_spell_slots_v1(p_character_id uuid)
returns void language plpgsql as $f$begin return; end $f$;
create or replace function private.can_manage_character_progression_v1(p_character_id uuid)
returns boolean language sql stable
as $f$select private.current_user_is_admin() or exists(
  select 1 from public.character_permissions
  where character_id=p_character_id and user_id=auth.uid() and can_edit
)$f$;
create or replace function private.restore_character_rest_action_state_v1(
 p_character_id uuid,p_rest_type text
) returns jsonb language sql stable as $f$
select '{"restoredClassFeatureUses":0,"features":[],"sheet":{}}'::jsonb
$f$;
create or replace function private.character_sheet_resource_profile_json_v1(
 p_character_id uuid
) returns jsonb language sql stable as $f$
select '{"resourceProfile":{"source":"isolated-test"}}'::jsonb
$f$;

-- Exact production INSERT guard behavior: an active encounter rejects
-- canonical rest-log insertion and rolls back spell slots/uses.
create or replace function private.guard_character_rest_insert_v1()
returns trigger language plpgsql as $f$
begin
 perform private.assert_character_resource_not_active_v1(new.character_id);
 return new;
end $f$;
create trigger fixture_guard_character_rest_insert
before insert on public.character_rest_log
for each row execute function private.guard_character_rest_insert_v1();

insert into public.character_spell_slots
(character_id,slots_max,slots_remaining,recharge_key)
values('aaaaaaaa-0000-4000-8000-000000000001',2,0,'short_rest');
insert into public.character_spells
(character_id,uses_max,uses_remaining,recharge)
values('aaaaaaaa-0000-4000-8000-000000000001',3,1,'short_rest');

do $cases$
declare
 c uuid:='aaaaaaaa-0000-4000-8000-000000000001';
 item uuid:='dddddddd-0000-4000-8000-000000000005'; -- trusted Cloak
 first_id uuid:='88888888-0000-4000-8000-000000000001';
 second_id uuid:='88888888-0000-4000-8000-000000000002';
 v jsonb;
 v_rest_id uuid;
 v_rest_count integer;
 v_link_count integer;
 denied boolean;
begin
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000001',true); -- admin
 select count(*) into v_rest_count from public.character_rest_log;
 select count(*) into v_link_count from private.attunement_focus_rest_links_v1;
 v:=private.begin_attunement_world_focus_v1(c,item,first_id);
 if v->>'status'<>'focus_started_unverified' then
  raise exception 'Unable to begin verified cloak focus %',v; end if;
 denied:=false;
 begin
  perform private.record_attunement_focused_short_rest_v1(c,first_id);
 exception when check_violation then denied:=true; end;
 if not denied then raise exception 'World hour not elapsed but rest completed'; end if;
 if (select count(*) from public.character_rest_log)<>v_rest_count then
  raise exception 'Premature rest logged on world-time denial'; end if;

 -- The service role without an authenticated admin must fail even after
 -- time has elapsed; no service-key-only grant of rest/effect authority.
 update public.world_state set world_time=world_time+interval '61 minutes' where id=1;
 perform set_config('fixture.uid','',true);
 denied:=false;
 begin
  perform private.record_attunement_focused_short_rest_v1(c,first_id);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Service without admin identity completed rest'; end if;
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000002',true); -- player
 denied:=false;
 begin
  perform private.record_attunement_focused_short_rest_v1(c,first_id);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Non-admin completed attunement rest'; end if;
 perform set_config('fixture.uid','bbbbbbbb-0000-4000-8000-000000000001',true);

 -- The bridge calls the canonical rest RPC (spell slots/limited uses and
 -- class action state), and captures its exact RETURNED log id.
 v:=private.record_attunement_focused_short_rest_v1(c,first_id);
 v_rest_id:=(v->>'restLogId')::uuid;
 if v_rest_id is null or v->>'status'<>'rest_logged_unverified'
    or v->>'canCreateBond'<>'false'
    or v->>'attunementQualified'<>'false'
 then raise exception 'Canonical rest bridge returned unsafe result %',v; end if;
 if not exists(select 1 from public.character_rest_log
    where id=v_rest_id and character_id=c and rest_type='short_rest'
    and restored_spell_slots=2 and restored_spell_uses=2)
 then raise exception 'Canonical rest identity or resources not recorded'; end if;
 if (select slots_remaining from public.character_spell_slots where character_id=c)<>2
   or (select uses_remaining from public.character_spells where character_id=c)<>3
 then raise exception 'Existing canonical Short Rest resource restoration regressed'; end if;
 if (select count(*) from public.character_rest_log)<>v_rest_count+1 then
   raise exception 'Canonical rest inserted unexpected number of logs'; end if;
 if not exists(select 1 from private.attunement_focus_rest_links_v1
    where attempt_id=first_id and rest_log_id=v_rest_id and character_id=c and inventory_item_id=item)
 then raise exception 'Exact canonical rest row not linked to focused world-time attempt'; end if;
 if (select status from private.attunement_focus_sessions_v1 where attempt_id=first_id)
    <>'rest_logged_unverified'
 then raise exception 'Consumed world-time focus remains active'; end if;
 v:=private.inspect_attunement_world_focus_v1(c,first_id);
 if v->>'status'<>'rest_logged_unverified'
 then raise exception 'Read inspector incorrectly labels linked rest aborted %',v; end if;
 v:=private.record_attunement_focused_short_rest_v1(c,first_id);
 if v->>'replayed'<>'true' or (v->>'restLogId')::uuid<>v_rest_id
 then raise exception 'Rest idempotent replay generated a new receipt %',v; end if;
 if (select count(*) from public.character_rest_log)<>v_rest_count+1
    or (select count(*) from private.attunement_focus_rest_links_v1)<>v_link_count+1
 then raise exception 'Replay added another rest or link'; end if;
 if exists (select 1 from public.character_item_attunements
    where character_id=c and inventory_item_id=item)
 then raise exception 'Canonical focused rest prematurely attuned magic'; end if;

 -- Try a second focus, this time an active encounter is raised at rest
 -- INSERT after slot restoration. The SQL exception rolls back ALL changes.
 update public.character_spell_slots set slots_remaining=0 where character_id=c;
 update public.character_spells set uses_remaining=0 where character_id=c;
 v:=private.begin_attunement_world_focus_v1(c,item,second_id);
 update public.world_state set world_time=world_time+interval '62 minutes' where id=1;
 insert into public.test_active_encounters values(c);
 denied:=false;
 begin
  perform private.record_attunement_focused_short_rest_v1(c,second_id);
 exception when check_violation then denied:=true; end;
 if not denied then raise exception 'Active encounter failed to block canonical rest insert'; end if;
 if (select slots_remaining from public.character_spell_slots where character_id=c)<>0
    or (select uses_remaining from public.character_spells where character_id=c)<>0
 then raise exception 'Failed canonical rest mutated resources despite rollback'; end if;
 if (select count(*) from public.character_rest_log)<>v_rest_count+1
    or (select count(*) from private.attunement_focus_rest_links_v1)<>v_link_count+1
 then raise exception 'Rejected encounter rest logged an unauthorized receipt'; end if;
 if (select status from private.attunement_focus_sessions_v1 where attempt_id=second_id)<>'active'
 then raise exception 'Failed rest consumed focus attempt despite rollback'; end if;
 delete from public.test_active_encounters where character_id=c;
 if not private.abort_attunement_world_focus_v1(c,second_id)
 then raise exception 'Failed attempt could not be aborted'; end if;

 if has_function_privilege('authenticated','private.record_attunement_focused_short_rest_v1(uuid,uuid)','EXECUTE')
   or has_function_privilege('anon','private.record_attunement_focused_short_rest_v1(uuid,uuid)','EXECUTE')
   or has_table_privilege('authenticated','private.attunement_focus_rest_links_v1','INSERT')
 then raise exception 'Atomic rest bridge exposed to browser roles'; end if;
end $cases$;
select 'Atomic rest-log ID correlation, canonical restoration, replay, ACL and rollback passed' as result;

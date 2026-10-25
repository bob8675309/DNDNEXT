\set ON_ERROR_STOP on
-- All objects and items come from disposable staged #257-#262 test database.
-- This fixture advances the GAME clock explicitly; no real-time sleep needed.
create table public.world_state(id integer primary key,world_time timestamptz not null);
insert into public.world_state values(1,'2028-10-24T00:00:00+00');
create table public.test_active_encounters(character_id uuid primary key);
create or replace function private.assert_character_resource_not_active_v1(p_id uuid)
returns void language plpgsql as $f$
begin
 if exists(select 1 from public.test_active_encounters where character_id=p_id)
 then raise exception 'Active encounter prevents a rest' using errcode='23514'; end if;
end $f$;
do $world$
declare
 c uuid:='aaaaaaaa-0000-4000-8000-000000000001';
 other uuid:='aaaaaaaa-0000-4000-8000-000000000002';
 staff uuid:='dddddddd-0000-4000-8000-000000000002';
 ring uuid:='eeeeeeee-0000-4000-8000-000000000003';
 shield uuid:='dddddddd-0000-4000-8000-000000000003';
 unknown_item uuid:='eeeeeeee-0000-4000-8000-000000000002';
 request_id uuid:='99999999-0000-4000-8000-000000000001';
 second_id uuid:='99999999-0000-4000-8000-000000000002';
 third_id uuid:='99999999-0000-4000-8000-000000000003';
 v jsonb;
 blocked boolean;
 before_rests integer;
 before_bonds integer;
begin
 -- Previous tests inserted a mock Staff bond only to test the read model.
 -- Remove it within the disposable fixture, never in live Supabase.
 delete from public.character_item_attunements
 where character_id=c and inventory_item_id=staff;
 select count(*) into before_rests from public.character_rest_log;
 select count(*) into before_bonds from public.character_item_attunements;
 v:=private.begin_attunement_world_focus_v1(c,staff,request_id);
 if v->>'status'<>'focus_started_unverified'
   or v->>'replayed'<>'false' or v->>'canCreateBond'<>'false'
   or v->>'startedWorldTime'<>'2028-10-24T00:00:00+00:00'
 then raise exception 'Canonical game-world session start failed %',v; end if;
 v:=private.begin_attunement_world_focus_v1(c,staff,request_id);
 if v->>'replayed'<>'true' then raise exception 'Same-request replay reset rest clock %',v; end if;
 blocked:=false;
 begin
  perform private.begin_attunement_world_focus_v1(c,ring,second_id);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Simultaneous second attunement focus started'; end if;
 blocked:=false;
 begin
  perform private.begin_attunement_world_focus_v1(other,staff,request_id);
 exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Foreign actor reused another actor request ID'; end if;
 v:=private.inspect_attunement_world_focus_v1(c,request_id);
 if v->>'status'<>'world_hour_not_elapsed'
   or v->>'attunementQualified'<>'false' or v->>'canCreateBond'<>'false'
 then raise exception 'New session qualified early %',v; end if;
 update public.world_state set world_time=world_time+interval '59 minutes' where id=1;
 v:=private.inspect_attunement_world_focus_v1(c,request_id);
 if v->>'status'<>'world_hour_not_elapsed' then raise exception '59 game minutes accepted %',v; end if;
 update public.world_state set world_time=world_time+interval '1 minute' where id=1;
 v:=private.inspect_attunement_world_focus_v1(c,request_id);
 if v->>'status'<>'world_hour_elapsed_unverified_contact_and_interruptions'
   or v->>'canCreateBond'<>'false' or v->>'needsCanonicalRestCommit'<>'true'
 then raise exception 'Elapsed game hour prematurely completed a rest %',v; end if;
 update public.world_state set world_time='2028-10-23T23:00:00+00' where id=1;
 v:=private.inspect_attunement_world_focus_v1(c,request_id);
 if v->>'status'<>'world_clock_regressed'
 then raise exception 'Rewound world clock accepted %',v; end if;
 update public.world_state set world_time='2028-10-24T02:00:00+00' where id=1;
 -- Transferring an item invalidates snapshot eligibility without making
 -- the function write/delete any canonical bond or inventory data.
 update public.inventory_items
 set owner_id='aaaaaaaa-0000-4000-8000-000000000002'
 where id=staff;
 v:=private.inspect_attunement_world_focus_v1(c,request_id);
 if v->>'status'<>'source_owner_or_class_invalid'
 then raise exception 'Transferred item allowed same focus %',v; end if;
 update public.inventory_items
 set owner_id='aaaaaaaa-0000-4000-8000-000000000001'
 where id=staff;
 if not private.abort_attunement_world_focus_v1(c,request_id)
 then raise exception 'Failed to abort active focus'; end if;
 if private.abort_attunement_world_focus_v1(c,request_id)
 then raise exception 'Repeated abort reported a new change'; end if;
 v:=private.inspect_attunement_world_focus_v1(c,request_id);
 if v->>'status'<>'aborted' then raise exception 'Aborted focus treated active %',v; end if;
 blocked:=false;
 begin
  perform private.begin_attunement_world_focus_v1(c,staff,request_id);
 exception when unique_violation then blocked:=true; end;
 if not blocked then raise exception 'Aborted request ID improperly reused'; end if;
 insert into public.test_active_encounters values(c);
 blocked:=false;
 begin
  perform private.begin_attunement_world_focus_v1(c,staff,second_id);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Active encounter resource guard bypassed'; end if;
 delete from public.test_active_encounters where character_id=c;
 -- Source must require attunement and canonical class must qualify;
 -- mundane shields and unknown edition variants are not valid focus.
 blocked:=false;
 begin
  perform private.begin_attunement_world_focus_v1(c,shield,second_id);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Mundane shield began magical attunement'; end if;
 blocked:=false;
 begin
  perform private.begin_attunement_world_focus_v1(c,unknown_item,second_id);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Unknown edition source began attunement'; end if;
 v:=private.begin_attunement_world_focus_v1(c,ring,second_id);
 if v->>'status'<>'focus_started_unverified'
 then raise exception 'Verified ring failed to start fresh attempt %',v; end if;
 v:=private.inspect_attunement_world_focus_v1(c,second_id);
 if v->>'status'<>'world_hour_not_elapsed'
 then raise exception 'New item inherited another focus hour %',v; end if;
 if not private.abort_attunement_world_focus_v1(c,second_id)
 then raise exception 'Could not abort fresh ring focus'; end if;
 -- Owner ambiguity remains fail-closed even with valid item source.
 blocked:=false;
 begin
  perform private.begin_attunement_world_focus_v1(other,staff,third_id);
 exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Wrong owner started focus'; end if;
 if (select count(*) from public.character_rest_log)<>before_rests
 then raise exception 'Focus progress wrote a false completed rest'; end if;
 if (select count(*) from public.character_item_attunements)<>before_bonds
 then raise exception 'Focus progress wrote an attunement bond'; end if;
 if has_function_privilege('authenticated','private.begin_attunement_world_focus_v1(uuid,uuid,uuid)','EXECUTE')
   or has_function_privilege('anon','private.inspect_attunement_world_focus_v1(uuid,uuid)','EXECUTE')
   or has_table_privilege('authenticated','private.attunement_focus_sessions_v1','INSERT')
 then raise exception 'Private focus operations exposed to the browser'; end if;
end $world$;
select 'Game-clock focus sessions: timer, replay, owner, encounter and abort gates passed' result;

\set ON_ERROR_STOP on
-- PG16 MOCK identity only; run after NPC research fixture. No live writes.
alter table public.encounter_participants add column movement_bonus_ft integer not null default 0,add column disengaged boolean not null default false;
alter table public.encounter_command_requests add column request_intent jsonb;
\i sql/candidates/20261101_core_action_encounter_first_private_candidate.sql
do $acl$ begin
 if has_function_privilege('authenticated','private.encounter_core_action_transaction_candidate_v1(uuid,text,uuid)','EXECUTE') or has_function_privilege('anon','private.encounter_core_action_transaction_candidate_v1(uuid,text,uuid)','EXECUTE') then raise exception 'Candidate exposed'; end if;
end $acl$;
create function public.p2_mock_core(uuid,text,uuid) returns jsonb language sql security definer set search_path='pg_catalog','public','private','auth' as $f$
select private.encounter_core_action_transaction_candidate_v1($1,$2,$3)
$f$;
revoke all on function public.p2_mock_core(uuid,text,uuid) from public,anon,service_role;
grant execute on function public.p2_mock_core(uuid,text,uuid) to authenticated;
insert into public.characters(id,kind) values(public.p2_id(331),'npc'),(public.p2_id(332),'npc'),(public.p2_id(333),'npc');
insert into public.encounters(id,status,active_participant_id,round,turn_index,version,updated_at) values(public.p2_id(182),'active',public.p2_id(301),1,0,1,now());
insert into public.encounter_participants(id,encounter_id,character_id,controller_user_id,display_name,team,speed_ft)
values(public.p2_id(301),public.p2_id(182),public.p2_id(331),public.p2_id(41),'Dash','allies',30),
(public.p2_id(302),public.p2_id(182),public.p2_id(332),public.p2_id(41),'Dodge','allies',30),
(public.p2_id(303),public.p2_id(182),public.p2_id(333),public.p2_id(41),'Disengage','allies',30);
insert into public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert,can_control) values(public.p2_id(331),public.p2_id(42),true,false,false,false);
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $owner$ declare x jsonb;y jsonb;begin
 x:=public.p2_mock_core(public.p2_id(301),'dash',public.p2_id(401));
 y:=public.p2_mock_core(public.p2_id(301),'dash',public.p2_id(401));
 if x is distinct from y or x->>'action'<>'dash' or (x->>'movementBonusFt')::int<>30 then raise exception 'Dash or replay changed';end if;
end $owner$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(42)::text,false);
do $foreign$ declare denied bool:=false;begin
 begin perform public.p2_mock_core(public.p2_id(301),'dash',public.p2_id(401)); exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Foreign controller replay';end if;
end $foreign$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $intent$ declare denied bool:=false;begin
 begin perform public.p2_mock_core(public.p2_id(301),'dodge',public.p2_id(401));exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Changed action replay';end if;
end $intent$;
reset role;
update public.encounter_participants set controller_user_id=null where id=public.p2_id(301);
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $revoked$ declare denied bool:=false;begin
 begin perform public.p2_mock_core(public.p2_id(301),'dash',public.p2_id(401));exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Revoked controller replay';end if;
end $revoked$;
reset role;
update public.encounter_participants set controller_user_id=public.p2_id(41) where id=public.p2_id(301);
insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
values(public.p2_id(402),public.p2_id(182),public.p2_id(301),'core_action',public.p2_id(41));
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $legacy$ declare denied bool:=false;begin
 begin perform public.p2_mock_core(public.p2_id(301),'dash',public.p2_id(402));exception when sqlstate '42501' then denied:=true;end;
 if not denied then raise exception 'Unversioned request accepted';end if;
end $legacy$;
reset role;
update public.encounters set active_participant_id=public.p2_id(302) where id=public.p2_id(182);
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $dodge$declare x jsonb;begin
 x:=public.p2_mock_core(public.p2_id(302),'dodge',public.p2_id(404));
 if x->>'action'<>'dodge' or (x->>'dodging')::bool<>true or (x->>'actionAvailable')::bool<>false then raise exception 'Dodge changed';end if;
end $dodge$;
reset role;
update public.encounters set active_participant_id=public.p2_id(303) where id=public.p2_id(182);
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $disengage$declare x jsonb;begin
 x:=public.p2_mock_core(public.p2_id(303),'disengage',public.p2_id(405));
 if x->>'action'<>'disengage' or (x->>'disengaged')::bool<>true or (x->>'actionAvailable')::bool<>false then raise exception 'Disengage changed';end if;
end $disengage$;
reset role;
do $final$begin
 if (select count(*) from public.encounter_combat_log where encounter_id=public.p2_id(182) and event_type='core_action')<>3 or
 (select count(*) from public.encounter_command_requests where encounter_id=public.p2_id(182) and result is not null)<>3 or
 (select version from public.encounters where id=public.p2_id(182))<>4
 then raise exception 'Core-action replays changed encounter twice';end if;
end $final$;
select 'PASS PG16 mock: Dash Dodge Disengage, exact replay, wrong owner/intent, revoked and old request denial';

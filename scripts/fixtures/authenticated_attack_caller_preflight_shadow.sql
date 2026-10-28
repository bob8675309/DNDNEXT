\set ON_ERROR_STOP on
-- Disposable PG16 ONLY. Composite fixtures do NOT use live Supabase.
\i scripts/fixtures/canonical_roll_damage_parity_candidate.sql

-- Current genuine controller function reads these fields. Previous isolated
-- attack fixtures intentionally used a narrower mock permission helper.
alter table public.encounter_participants
 add column controller_user_id uuid;
create or replace function public.is_admin(p_user_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,public
as $f$
 select exists(select 1 from public.user_profiles
  where id=p_user_id and role='admin')
$f$;
-- Restore actual canonical participant controller logic, no shortcut that
-- returns TRUE just because a fixture service-role setting was present.
\i scripts/fixtures/canonical_controller_acl_pg16.sql

-- Replace the previous fixture.uid/fixture.role test functions with a
-- simulation of Supabase API's VERIFIED JWT context propagation.
-- Critically this fixture does NOT validate JWT signatures; the real API
-- platform verifies them BEFORE loading request.jwt.claim.* into Postgres.
create or replace function auth.uid() returns uuid language sql stable
set search_path=pg_catalog as $f$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$f$;
create or replace function auth.role() returns text language sql stable
set search_path=pg_catalog as $f$
 select nullif(current_setting('request.jwt.claim.role',true),'')
$f$;

grant usage on schema auth to authenticated,anon,service_role;
grant execute on function auth.uid() to authenticated,anon,service_role;
grant execute on function auth.role() to authenticated,anon,service_role;
grant execute on function public.is_admin(uuid) to authenticated,anon,service_role;
grant execute on function public.encounter_can_control_participant_v1(uuid)
 to authenticated,service_role;

insert into public.user_profiles(id,role) values
('aaaaaaaa-0000-4000-8000-000000000003','player'),
('aaaaaaaa-0000-4000-8000-000000000004','player');

update public.encounter_participants
 set controller_user_id='aaaaaaaa-0000-4000-8000-000000000004'
 where id='dddddddd-0000-4000-8000-000000000001';
update public.encounters set status='active',
 active_participant_id='dddddddd-0000-4000-8000-000000000001',
 round=9,turn_index=0
 where id='ffffffff-0000-4000-8000-000000000001';
update public.encounter_participants
 set is_defeated=false,action_available=true
 where id='dddddddd-0000-4000-8000-000000000001';

\i sql/20261027_04_authenticated_attack_caller_preflight_shadow.sql

-- Every test case invokes the exact public RPC under a PostgreSQL role.
-- No arbitrary caller UUID is accepted anywhere by the new RPC.
do $permissions$
begin
 if has_function_privilege('anon',
  'public.encounter_attack_caller_preflight_shadow_v1(uuid,uuid,integer,integer)','EXECUTE')
 or has_function_privilege('service_role',
  'public.encounter_attack_caller_preflight_shadow_v1(uuid,uuid,integer,integer)','EXECUTE')
 or not has_function_privilege('authenticated',
  'public.encounter_attack_caller_preflight_shadow_v1(uuid,uuid,integer,integer)','EXECUTE')
 then raise exception 'Authenticated Attack preflight ACL incorrect'; end if;
end $permissions$;

set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000002',false);
do $authenticated$
declare
 p uuid:='dddddddd-0000-4000-8000-000000000001';
 other uuid:='dddddddd-0000-4000-8000-000000000002';
 e uuid:='ffffffff-0000-4000-8000-000000000001';
 v jsonb;
 blocked boolean;
begin
 v:=public.encounter_attack_caller_preflight_shadow_v1(p,e,9,0);
 if v->>'callerAuthMode'<>'authenticated_jwt_context'
 or v->>'callerUserId'<>'aaaaaaaa-0000-4000-8000-000000000002'
 or v->>'participantId'<>p::text or v->>'encounterId'<>e::text
 or v->>'attacksAllowed'<>'3'
 or v->>'controllerChecked'<>'true'
 or v->>'roleBypassUsed'<>'false'
 or v->>'trustedEndpointIdentityHandoffReady'<>'false'
 or v->>'jwtSignatureVerifiedByDatabase'<>'false'
 or v->>'atomicCandidateCalled'<>'false'
 or v->>'attackActionSpent'<>'false'
 or v->>'diceRolled'<>'false'
 or v->>'damageApplied'<>'false'
 or v->>'combatConsumerEnabled'<>'false'
 then raise exception 'Permissioned JWT-controlled player preview incorrect %',v; end if;
 blocked:=false;
 begin perform public.encounter_attack_caller_preflight_shadow_v1(p,e,10,0);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Stale round was accepted'; end if;
 blocked:=false;
 begin perform public.encounter_attack_caller_preflight_shadow_v1(p,e,9,1);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Stale turn index was accepted'; end if;
 blocked:=false;
 begin perform public.encounter_attack_caller_preflight_shadow_v1(p,
  'bbbbbbbb-bbbb-4000-8000-000000000099',9,0);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Wrong encounter was accepted'; end if;
 blocked:=false;
 begin perform public.encounter_attack_caller_preflight_shadow_v1(other,e,9,0);
 exception when object_not_in_prerequisite_state then blocked:=true; end;
 if not blocked then raise exception 'Non-active controlled participant was accepted'; end if;
end $authenticated$;

-- User 004 controls by controller_user_id but has no edit permission.
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000004',false);
do $controller$
declare v jsonb;
begin
 v:=public.encounter_attack_caller_preflight_shadow_v1(
  'dddddddd-0000-4000-8000-000000000001',
  'ffffffff-0000-4000-8000-000000000001',9,0);
 if v->>'controllerChecked'<>'true'
 or v->>'callerUserId'<>'aaaaaaaa-0000-4000-8000-000000000004'
 then raise exception 'Exact direct participant controller rejected %',v; end if;
end $controller$;

-- User 003 neither controls the participant nor edits its character.
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000003',false);
do $foreign$
declare blocked boolean:=false;
begin
 begin
  perform public.encounter_attack_caller_preflight_shadow_v1(
   'dddddddd-0000-4000-8000-000000000001',
   'ffffffff-0000-4000-8000-000000000001',9,0);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Foreign player received participant/class data'; end if;
end $foreign$;

-- True user-profile admin retains canonical permission even without
-- character_permissions; no client-provided is_admin argument exists.
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
do $admin$
declare v jsonb;
begin
 v:=public.encounter_attack_caller_preflight_shadow_v1(
  'dddddddd-0000-4000-8000-000000000001',
  'ffffffff-0000-4000-8000-000000000001',9,0);
 if v->>'controllerChecked'<>'true'
 or v->>'callerUserId'<>'aaaaaaaa-0000-4000-8000-000000000001'
 then raise exception 'Trusted admin ownership check failed %',v; end if;
end $admin$;

-- A missing UID is not a valid JWT caller even with the role claim.
select set_config('request.jwt.claim.sub','',false);
do $missing$
declare blocked boolean:=false;
begin
 begin
  perform public.encounter_attack_caller_preflight_shadow_v1(
   'dddddddd-0000-4000-8000-000000000001',
   'ffffffff-0000-4000-8000-000000000001',9,0);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Authenticated role with null UID was trusted'; end if;
end $missing$;

-- Even a full user UUID cannot substitute for an authenticated JWT role.
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000002',false);
select set_config('request.jwt.claim.role','service_role',false);
do $spoof$
declare blocked boolean:=false;
begin
 begin
  perform public.encounter_attack_caller_preflight_shadow_v1(
   'dddddddd-0000-4000-8000-000000000001',
   'ffffffff-0000-4000-8000-000000000001',9,0);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Service role JWT claim bypassed user-specific gate'; end if;
end $spoof$;
reset role;

-- Actual service_role Postgres role is not granted EXECUTE regardless of
-- manually injected matching user/role claim.
set role service_role;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000002',false);
do $service$
declare blocked boolean:=false;
begin
 begin
  perform public.encounter_attack_caller_preflight_shadow_v1(
   'dddddddd-0000-4000-8000-000000000001',
   'ffffffff-0000-4000-8000-000000000001',9,0);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Service-role connection gained player preflight EXECUTE'; end if;
end $service$;
reset role;

-- Anonymous SQL role denied even with a forged authenticated claim.
set role anon;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000002',false);
do $anonymous$
declare blocked boolean:=false;
begin
 begin
  perform public.encounter_attack_caller_preflight_shadow_v1(
   'dddddddd-0000-4000-8000-000000000001',
   'ffffffff-0000-4000-8000-000000000001',9,0);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Anon Postgres role reached authenticated preflight'; end if;
end $anonymous$;
reset role;

-- Source of truth unchanged: no auth role can invoke the actual candidate.
do $no_actions$
begin
 if has_function_privilege('authenticated',
  'private.encounter_weapon_attack_atomic_candidate_v1(uuid,uuid,uuid,uuid,uuid,integer,integer,integer)','EXECUTE')
 or has_function_privilege('anon',
  'private.encounter_weapon_attack_atomic_candidate_v1(uuid,uuid,uuid,uuid,uuid,integer,integer,integer)','EXECUTE')
 then raise exception 'Live weapon executor accidentally exposed'; end if;
end $no_actions$;

select 'JWT context/controller/GM/foreign/anon/service role, stale turn and no live Attack execution passed' result;

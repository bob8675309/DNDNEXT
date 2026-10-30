\set ON_ERROR_STOP on
-- ONLY for disposable PG16. This test cannot prove signed JWT authenticity.
create or replace function auth.jwt() returns jsonb language sql stable
as $f$ select coalesce(nullif(current_setting('fixture.jwt',true),'')::jsonb,'{}'::jsonb) $f$;
\i sql/candidates/20261030_eldritch_blast_authenticated_bridge_candidate.sql
do $security$
begin
 if has_function_privilege('anon',
  'public.encounter_cast_eldritch_blast_candidate_v1(uuid,uuid,uuid[],uuid)','EXECUTE')
 or has_function_privilege('authenticated',
  'public.encounter_cast_eldritch_blast_candidate_v1(uuid,uuid,uuid[],uuid)','EXECUTE')
 or has_function_privilege('service_role',
  'public.encounter_cast_eldritch_blast_candidate_v1(uuid,uuid,uuid[],uuid)','EXECUTE')
 then raise exception 'DRAFT bridge accidentally granted execution'; end if;
end $security$;
-- Grant only in throwaway test DB; never in source candidate or live schema.
grant execute on function public.encounter_cast_eldritch_blast_candidate_v1(
  uuid,uuid,uuid[],uuid) to authenticated;
select set_config('fixture.role','authenticated',false);
select set_config('fixture.uid',public.fixture_uuid(41)::text,false);
select set_config('fixture.jwt','{"is_anonymous":false}',false);
update public.encounters set status='active',
  active_participant_id=public.fixture_uuid(11);
update public.encounter_participants set action_available=true
  where id=public.fixture_uuid(11);
set role anon;
do $unauth$
declare denied boolean:=false;
begin
 begin
 perform public.encounter_cast_eldritch_blast_candidate_v1(
  public.fixture_uuid(11),public.fixture_uuid(51),
  array[public.fixture_uuid(21)],public.fixture_uuid(300));
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anon executed bridge'; end if;
end $unauth$;
reset role;
set role authenticated;
do $auth_tests$
declare denied boolean; output jsonb;
begin
 -- Mock JWT anonymous sign-ins must not pass even with authenticated role.
 perform set_config('fixture.jwt','{"is_anonymous":true}',true);
 denied:=false;
 begin perform public.encounter_cast_eldritch_blast_candidate_v1(
  public.fixture_uuid(11),public.fixture_uuid(51),
  array[public.fixture_uuid(21)],public.fixture_uuid(301));
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anonymous signed-in session accepted'; end if;
 perform set_config('fixture.jwt','{"is_anonymous":false}',true);
 perform set_config('fixture.uid',public.fixture_uuid(99)::text,true);
 denied:=false;
 begin perform public.encounter_cast_eldritch_blast_candidate_v1(
  public.fixture_uuid(11),public.fixture_uuid(51),
  array[public.fixture_uuid(21)],public.fixture_uuid(302));
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Wrong controller allowed to cast'; end if;
 perform set_config('fixture.uid',public.fixture_uuid(41)::text,true);
 output:=public.encounter_cast_eldritch_blast_candidate_v1(
  public.fixture_uuid(11),public.fixture_uuid(51),
  array[public.fixture_uuid(21)],public.fixture_uuid(303));
 if (output->>'beamCount')::int<>1 or
    (output#>>'{beams,0,agonizingBlastDamageModifier}')::int<>5
 then raise exception 'Allowed signed-in fixture caller did not resolve spell'; end if;
 raise notice 'Draft bridge PG-role/permissions and mock auth tests PASS (NOT JWT verified)';
end $auth_tests$;
reset role;

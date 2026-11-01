\set ON_ERROR_STOP on
-- RESEARCH ONLY. This imports a HELD PRIVATE wrapper into disposable PG16
-- after the original v11 SQL is loaded and characterized.
\i sql/candidates/20261031_fire_bolt_guarded_replay_candidate.sql

do $no_grant$
begin
  if has_function_privilege('authenticated',
    'private.encounter_fire_bolt_guarded_candidate_v1(uuid,uuid,uuid,integer,uuid)','EXECUTE')
     or has_function_privilege('anon',
    'private.encounter_fire_bolt_guarded_candidate_v1(uuid,uuid,uuid,integer,uuid)','EXECUTE')
  then raise exception 'Held private candidate unexpectedly executable'; end if;
end $no_grant$;
-- TEST DATABASE ONLY. Neither grant appears in the candidate SQL.
grant usage on schema private to authenticated;
grant execute on function private.encounter_fire_bolt_guarded_candidate_v1(
  uuid,uuid,uuid,integer,uuid) to authenticated;

-- Establish a harmless, successful cantrip cast and an exact replay.
update public.encounter_participants
set action_available=true where id=public.p2_id(11);
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
select set_config('fixture.attack_roll','1',false);
do $authorized$
declare result jsonb; repeated jsonb;
begin
  result:=private.encounter_fire_bolt_guarded_candidate_v1(
    public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(104));
  if (result->>'hit')::boolean or result->>'damageDice'<>'2d10' then
    raise exception 'Authorized Fire Bolt candidate changed original 2d10 miss behavior';
  end if;
  repeated:=private.encounter_fire_bolt_guarded_candidate_v1(
    public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(104));
  if repeated is distinct from result then raise exception 'Exact replay did not preserve result'; end if;
end $authorized$;
reset role;

-- Fail-closed: second authenticated user may not replay existing result.
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(42)::text,false);
do $deny_foreign_replay$
declare rejected boolean:=false;
begin
  begin
    perform private.encounter_fire_bolt_guarded_candidate_v1(
      public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(104));
  exception when sqlstate '42501' then rejected:=true; end;
  if not rejected then raise exception 'CANDIDATE: cross-user replay was accepted'; end if;
end $deny_foreign_replay$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $deny_changed_intent$
declare rejected boolean;
begin
  rejected:=false;
  begin
    perform private.encounter_fire_bolt_guarded_candidate_v1(
      public.p2_id(11),public.p2_id(51),public.p2_id(22),null,public.p2_id(104));
  exception when sqlstate '42501' then rejected:=true; end;
  if not rejected then raise exception 'CANDIDATE: changed target replay accepted'; end if;
  rejected:=false;
  begin
    perform private.encounter_fire_bolt_guarded_candidate_v1(
      public.p2_id(11),public.p2_id(54),public.p2_id(21),null,public.p2_id(104));
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'CANDIDATE: changed assignment replay accepted'; end if;
end $deny_changed_intent$;
reset role;

-- Explicitly fail closed on known=false and a mismatched class-source row.
update public.encounter_participants set action_available=true where id=public.p2_id(11);
set role authenticated;
do $deny_grant$
declare rejected boolean;
begin
  rejected:=false;
  begin
    perform private.encounter_fire_bolt_guarded_candidate_v1(
      public.p2_id(11),public.p2_id(53),public.p2_id(21),null,public.p2_id(105));
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'CANDIDATE: known=false class grant cast'; end if;
  rejected:=false;
  begin
    perform private.encounter_fire_bolt_guarded_candidate_v1(
      public.p2_id(11),public.p2_id(54),public.p2_id(21),null,public.p2_id(106));
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'CANDIDATE: mismatched class spell source cast'; end if;
  rejected:=false;
  begin
    perform private.encounter_fire_bolt_guarded_candidate_v1(
      public.p2_id(11),public.p2_id(52),public.p2_id(21),null,public.p2_id(107));
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'CANDIDATE: feat-only assignment cast through class adapter'; end if;
end $deny_grant$;
reset role;

-- If the target becomes hidden after an otherwise valid cast, fail closed
-- even for a cached replay. Do not leak target identity via old result.
update public.encounter_participants set is_hidden=true where id=public.p2_id(21);
set role authenticated;
do $deny_hidden_replay$
declare rejected boolean:=false;
begin
  begin
    perform private.encounter_fire_bolt_guarded_candidate_v1(
      public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(104));
  exception when sqlstate '42501' then rejected:=true; end;
  if not rejected then raise exception 'CANDIDATE: hidden-target replay accepted'; end if;
end $deny_hidden_replay$;
reset role;
update public.encounter_participants set is_hidden=false where id=public.p2_id(21);

-- Change controller before replay; old result must no longer be disclosed.
update public.encounter_participants
set controller_user_id=public.p2_id(42) where id=public.p2_id(11);
set role authenticated;
do $deny_revoked_replay$
declare rejected boolean:=false;
begin
  begin
    perform private.encounter_fire_bolt_guarded_candidate_v1(
      public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(104));
  exception when sqlstate '42501' then rejected:=true; end;
  if not rejected then raise exception 'CANDIDATE: replay after controller revocation was allowed'; end if;
end $deny_revoked_replay$;
reset role;
update public.encounter_participants
set controller_user_id=public.p2_id(41) where id=public.p2_id(11);

-- Do not replay an unfinished/pending ledger result, even with ownership.
insert into public.encounter_command_requests(
  request_id,encounter_id,participant_id,command_type,requested_by,result
) values(
  public.p2_id(108),public.p2_id(81),public.p2_id(11),
  'spell_cast',public.p2_id(41),null
);
set role authenticated;
do $deny_pending$
declare rejected boolean:=false;
begin
  begin
    perform private.encounter_fire_bolt_guarded_candidate_v1(
      public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(108));
  exception when sqlstate '42501' then rejected:=true; end;
  if not rejected then raise exception 'CANDIDATE: unbound pending request replayed'; end if;
end $deny_pending$;
reset role;

do $audit$
begin
  if (select count(*) from public.encounter_combat_log where event_type='spell_cast')<>3
     or (select version from public.encounters where id=public.p2_id(81))<>4
     or (select count(*) from public.encounter_command_requests
       where result is not null)<>3
  then raise exception 'CANDIDATE: replay/invalid grant caused extra combat mutations'; end if;
  raise notice 'P2 PRIVATE CANDIDATE PASS: exact owner replay, foreign/changed/hidden/revoked/invalid/pending denied; NO new live SQL';
end $audit$;

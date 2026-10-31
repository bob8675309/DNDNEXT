#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
const output=process.argv[2];
assert.ok(output && process.env.CI==="true" && process.env.GITHUB_ACTIONS==="true");
const src=fs.readFileSync("scripts/fixtures/eldritch_blast_candidate_pg16.sql","utf8");
const uuid=src.slice(src.indexOf("create function public.fixture_uuid("),src.indexOf("create function auth.uid()"));
const core=src.slice(src.indexOf("create table public.encounters("),src.indexOf("-- Reusable source-bound invocation primitive"));
assert.ok(uuid.startsWith("create function public.fixture_uuid("));
assert.ok(core.includes("\\i sql/candidates/20261029_eldritch_blast_atomic_candidate.sql"));
let schema=core.replace("current_hp int default 1000,is_hidden","current_hp int default 1000,temp_hp int default 0,is_hidden");
assert.notEqual(schema,core);
schema=schema.replace("as $f$select current_setting('fixture.admin',true)='yes'$f$;","as $f$select false$f$;");
assert.ok(schema.includes("as $f$select false$f$;"));
const head=String.raw`\set ON_ERROR_STOP on
-- Disposable LOCAL Supabase only. Preserve real auth.uid/auth.role/auth.jwt.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
`;
const tail=String.raw`
-- Minimal mitigation stub for JWT authorization/state smoke tests, not full engine parity.
create or replace function public.encounter_apply_damage_internal_v1(
 p_target uuid,p_amount integer,p_type text) returns jsonb language plpgsql
 security definer set search_path=pg_catalog,public
as $damage$
declare t public.encounter_participants%rowtype; dmg int; absorbed int; hp int; thp int;
begin
 select * into t from public.encounter_participants where id=p_target for update;
 if not found or p_amount<0 then raise exception 'Bad damage input';end if;
 dmg:=case when p_type=any(t.damage_immunities) then 0
  when p_type=any(t.damage_resistances) then floor(p_amount/2.0)::int else p_amount end;
 absorbed:=least(coalesce(t.temp_hp,0),dmg);
 thp:=greatest(0,coalesce(t.temp_hp,0)-absorbed);
 hp:=greatest(0,t.current_hp-(dmg-absorbed));
 update public.encounter_participants set current_hp=hp,temp_hp=thp,is_defeated=(hp<=0) where id=p_target;
 return jsonb_build_object('damage',dmg,'targetHp',hp,'targetTempHp',thp);
end;
$damage$;
create or replace function public.eb_ci_identity_v1() returns jsonb
language sql stable security invoker set search_path=pg_catalog,auth
as $identity$
select jsonb_build_object('uid',auth.uid(),'role',auth.role());
$identity$;
revoke all on function public.eb_ci_identity_v1() from public,anon,service_role;
grant execute on function public.eb_ci_identity_v1() to authenticated;
alter table public.encounters enable row level security;
alter table public.encounter_participants enable row level security;
alter table public.encounter_combat_log enable row level security;
alter table public.encounter_command_requests enable row level security;
grant select on public.encounters,public.encounter_participants,public.encounter_combat_log to authenticated;
create policy eb_encounter_read on public.encounters for select to authenticated using(status='active');
create policy eb_participant_read on public.encounter_participants for select to authenticated
 using(not is_hidden or controller_user_id=auth.uid());
create policy eb_log_read on public.encounter_combat_log for select to authenticated
 using(exists(select 1 from public.encounter_participants p
  where p.id=encounter_combat_log.actor_participant_id and p.controller_user_id=auth.uid()));
\i sql/candidates/20261030_eldritch_blast_authenticated_bridge_candidate.sql
grant execute on function public.encounter_cast_eldritch_blast_candidate_v1(uuid,uuid,uuid[],uuid) to authenticated;
do $acl$
begin
 if has_function_privilege('anon','public.encounter_cast_eldritch_blast_candidate_v1(uuid,uuid,uuid[],uuid)','EXECUTE')
 or has_function_privilege('service_role','public.encounter_cast_eldritch_blast_candidate_v1(uuid,uuid,uuid[],uuid)','EXECUTE')
 or has_function_privilege('authenticated','private.encounter_eldritch_blast_candidate_v1(uuid,uuid,uuid[],uuid)','EXECUTE')
 then raise exception 'Unsafe test grants';end if;
end;
$acl$;
`;
const sql=head+uuid+schema+tail;
assert.ok(!sql.includes("create function auth.uid()")&&!sql.includes("create function auth.role()"));
fs.writeFileSync(output,sql,{mode:0o600});
console.log("Generated disposable Supabase SQL with real auth functions.");

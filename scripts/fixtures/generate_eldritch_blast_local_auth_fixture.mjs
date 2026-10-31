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
schema=schema.replace("damage_immunities text[] default '{}',updated_at",
 "damage_immunities text[] default '{}',damage_vulnerabilities text[] default '{}',updated_at");
assert.ok(schema.includes("damage_vulnerabilities text[] default '{}',updated_at"),
 "Production-shaped vulnerability array is required");
schema=schema.replace("as $f$select current_setting('fixture.admin',true)='yes'$f$;","as $f$select false$f$;");
assert.ok(schema.includes("as $f$select false$f$;"));
const head=String.raw`\set ON_ERROR_STOP on
-- Disposable LOCAL Supabase only. Preserve real auth.uid/auth.role/auth.jwt.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
`;
const tail=String.raw`
-- Use the actual live damage/mitigation functions on disposable inventory.
create table public.inventory_items(
 id uuid primary key,item_id text not null,item_name text not null,
 owner_type text,owner_id text,is_equipped boolean not null default false,
 card_payload jsonb
);
create table public.items_catalog(
 id uuid primary key default gen_random_uuid(),item_key text,item_name text not null,
 payload jsonb not null default '{}'::jsonb
);
\i scripts/fixtures/eldritch_blast_production_damage_pg17.sql
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
assert.ok(sql.includes("\\i scripts/fixtures/eldritch_blast_production_damage_pg17.sql"));
fs.writeFileSync(output,sql,{mode:0o600});
console.log("Generated disposable Supabase SQL with real auth functions.");

#!/usr/bin/env node
// Generate disposable Postgres for REAL local Supabase GoTrue/PostgREST.
import assert from "node:assert/strict";
import fs from "node:fs";
const e=process.env,output=process.argv[2];
assert.ok(output && e.GITHUB_ACTIONS==="true" && e.CI==="true" &&
  e.DNDNEXT_NPC_LOCAL_CI_CONFIRM==="CI_DISPOSABLE_NPC_GOTRUE_ONLY" &&
  e.PGHOST==="127.0.0.1" && e.PGPORT==="54322" &&
  e.PGDATABASE==="postgres","Only isolated local CI is accepted");
const source=fs.readFileSync("scripts/fixtures/fire_bolt_p2_disposable_pg16.sql","utf8");
const from=source.indexOf("create table public.characters(");
assert.ok(from>0);
let body=source.slice(from);
const old="create table public.characters(id uuid primary key,kind text not null default 'npc');";
assert.ok(body.includes(old));
body=body.replace(old,
 "create table public.characters(id uuid primary key,kind text not null default 'npc',name text not null default 'Fixture');");
assert.ok(!body.includes("create function auth.uid()") && !body.includes("create function auth.role()"));
const head=String.raw`
\set ON_ERROR_STOP on
-- LOCAL Supabase only; DO NOT OVERRIDE GoTrue's auth.uid/auth.role.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create function public.p2_id(n integer) returns uuid language sql immutable
as $f$select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$f$;
create table public.p2_local_npc_admins(user_id uuid primary key);
revoke all on public.p2_local_npc_admins from public,anon,authenticated;
create function private.current_user_is_admin() returns boolean
language sql stable security definer set search_path=pg_catalog,public,auth
as $f$select exists(select 1 from public.p2_local_npc_admins where user_id=auth.uid())$f$;
create function public.is_admin(uid uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,auth
as $f$select exists(select 1 from public.p2_local_npc_admins where user_id=uid)$f$;
create function public.is_admin() returns boolean
language sql stable security definer set search_path=pg_catalog,public,private,auth
as $f$select private.current_user_is_admin()$f$;
revoke all on function public.is_admin(uuid),public.is_admin() from public,anon,service_role;
grant execute on function public.is_admin(uuid),public.is_admin() to authenticated;
`;
const tail=String.raw`
-- ACTUAL held SQL: no test-only reimplementation of delegation/resolver.
\i sql/candidates/20261031_fire_bolt_transaction_integrated_candidate.sql
\i sql/candidates/20261101_npc_delegated_control_candidate.sql
-- Build simplified RLS tables only for the separate local fixture.
alter table public.character_permissions enable row level security;
grant select on public.character_permissions to authenticated;
create policy p2_local_perm_read on public.character_permissions
for select to authenticated
using(user_id=(select auth.uid()) or (select public.is_admin(auth.uid())));
alter table public.characters enable row level security;
grant select on public.characters to authenticated;
create policy p2_local_char_admin_read on public.characters
for select to authenticated using((select public.is_admin(auth.uid())));
grant select on public.encounter_participants to authenticated;
alter table public.encounters enable row level security;
grant select on public.encounters to authenticated;
create policy p2_local_active_encounter_read on public.encounters
for select to authenticated using(status='active');
-- LOCAL ONLY: authenticated HTTP bridge to ungranted private held resolver.
create function public.p2_local_npc_cast(
 p_caster_id uuid,p_assignment_id uuid,p_target_id uuid,
 p_slot_level integer,p_request_id uuid)
returns jsonb language sql security definer
set search_path=pg_catalog,public,private,auth
as $cast$
select private.encounter_cast_spell_v11_transaction_candidate_v1(
 p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id)
$cast$;
revoke all on function public.p2_local_npc_cast(uuid,uuid,uuid,integer,uuid)
 from public,anon,service_role;
grant execute on function public.p2_local_npc_cast(uuid,uuid,uuid,integer,uuid)
 to authenticated;
insert into public.characters(id,kind,name)
values(public.p2_id(32),'npc','NPC CTRL TEST - Local Familiar');
insert into public.character_progression(character_id,class_id,class_level)
values(public.p2_id(32),public.p2_id(71),5);
insert into public.character_spells(
 id,character_id,spell_id,source_type,source_key,source_label,
 known,prepared,always_available,casting_stat)
values(public.p2_id(58),public.p2_id(32),public.p2_id(61),
 'class','wizard','wizard',true,false,false,'int');
insert into public.encounter_participants(
 id,encounter_id,character_id,controller_user_id,display_name,
 team,q,r,armor_class,current_hp,action_available,is_hidden)
values(public.p2_id(33),public.p2_id(81),public.p2_id(32),null,
 'NPC CTRL TEST - Familiar','allies',1,2,14,100,true,true);
update public.encounters set active_participant_id=public.p2_id(33)
where id=public.p2_id(81);
do $g$
begin
 if has_function_privilege('anon',
  'public.p2_local_npc_cast(uuid,uuid,uuid,integer,uuid)','EXECUTE')
 or has_function_privilege('anon',
  'public.admin_set_npc_control_v1(uuid,uuid,boolean)','EXECUTE')
 or has_function_privilege('authenticated',
  'private.encounter_cast_spell_v11_transaction_candidate_v1(uuid,uuid,uuid,integer,uuid)','EXECUTE')
 then raise exception 'Local fixture leaked a privileged function'; end if;
end $g$;
notify pgrst, 'reload schema';
`;
const sql=(head+"\n"+body+"\n"+tail);
assert.ok(!sql.includes("create function auth.uid()"));
assert.ok(sql.includes("\i sql/candidates/20261101_npc_delegated_control_candidate.sql"));
fs.writeFileSync(output,sql,{mode:0o600});
console.log("Generated isolated NPC fixture; real Supabase auth.uid/auth.role preserved.");

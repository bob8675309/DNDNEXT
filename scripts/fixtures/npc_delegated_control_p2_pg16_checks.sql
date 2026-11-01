\set ON_ERROR_STOP on
-- Research-only pg16 fixture, invoked AFTER historical Fire Bolt tests.
-- The candidate SQL is imported verbatim to prove its grants/functions.
-- Mock auth.uid() is NOT signed-in Supabase Auth, nor production evidence.

-- Existing permissions include edit-only legacy NPC grants, which must keep
-- control after migrating to independent can_control.
insert into public.characters(id,kind) values
  (public.p2_id(32),'npc'),
  (public.p2_id(34),'merchant'),
  (public.p2_id(36),'player');
insert into public.encounter_participants(
  id,encounter_id,character_id,controller_user_id,display_name,team,q,r,
  armor_class,current_hp,action_available,is_hidden
) values
  (public.p2_id(33),public.p2_id(81),public.p2_id(32),null,
  'Companion','allies',1,2,14,100,true,true),
  (public.p2_id(35),public.p2_id(81),public.p2_id(34),null,
  'Merchant NPC','allies',2,2,14,100,true,false),
  (public.p2_id(37),public.p2_id(81),public.p2_id(36),null,
  'Player Character','allies',3,2,14,100,true,false);
insert into public.character_permissions(
  character_id,user_id,can_edit,can_inventory,can_convert
) values (public.p2_id(32),public.p2_id(44),true,true,false);

-- In a disposable local SQL fixture, represent the existing admin role only.
create or replace function private.current_user_is_admin()
returns boolean language sql stable
as $admin$select auth.uid()=public.p2_id(40)$admin$;
create or replace function public.is_admin(p_user_id uuid)
returns boolean language sql stable
as $admin$select p_user_id=public.p2_id(40) and auth.uid()=p_user_id$admin$;

-- Match real character permission policy's ADMIN-write/SELF-read boundary.
alter table public.character_permissions enable row level security;
grant select,insert,update,delete on public.character_permissions to authenticated;
create policy p2_cp_self_read on public.character_permissions for select to authenticated
using (user_id=auth.uid() or public.is_admin(auth.uid()));
create policy p2_cp_admin_write on public.character_permissions for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Hidden participant reads require the delegated grant.
alter table public.encounter_participants enable row level security;
grant select on public.encounter_participants to authenticated;

\i sql/candidates/20261101_npc_delegated_control_candidate.sql

do $pre$
begin
  if has_function_privilege('anon','public.admin_set_npc_control_v1(uuid,uuid,boolean)','execute') then
    raise exception 'Anonymous NPC permission mutation unexpectedly allowed'; end if;
  if not has_function_privilege('authenticated','public.admin_set_npc_control_v1(uuid,uuid,boolean)','execute') then
    raise exception 'Authenticated admin control RPC unexpectedly not executable'; end if;
  if (select can_control from public.character_permissions
      where character_id=public.p2_id(32) and user_id=public.p2_id(44))
      is distinct from true then
    raise exception 'Legacy editor lost NPC combat control during backfill'; end if;
end $pre$;

set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $ordinary_cannot_grant$
declare denied boolean:=false;
begin
  begin
    perform public.admin_set_npc_control_v1(public.p2_id(32),public.p2_id(41),true);
  exception when sqlstate '42501' then denied:=true; end;
  if not denied then raise exception 'Ordinary player administered NPC permission'; end if;
end $ordinary_cannot_grant$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(40)::text,false);
do $admin_grants$
declare x jsonb;
begin
  x:=public.admin_set_npc_control_v1(public.p2_id(32),public.p2_id(41),true);
  if (x->>'canControl')::boolean is distinct from true
    or (x->>'canEdit')::boolean is distinct from false then
    raise exception 'Control grant must not confer sheet edit: %',x; end if;
  perform public.admin_set_npc_control_v1(public.p2_id(32),public.p2_id(43),true);
  perform public.admin_set_npc_control_v1(public.p2_id(34),public.p2_id(43),true);
end $admin_grants$;

do $deny_pc_target$
declare denied boolean:=false;
begin
  begin
    perform public.admin_set_npc_control_v1(public.p2_id(36),public.p2_id(43),true);
  exception when sqlstate '22023' then denied:=true; end;
  if not denied then raise exception 'NPC-only admin API granted PC control'; end if;
end $deny_pc_target$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $player_one$
begin
  -- The player already controls their original character through direct
  -- encounter assignment. Now also controls a hidden companion by grant.
  if public.encounter_can_control_participant_v1(public.p2_id(11)) is distinct from true
    or public.encounter_can_control_participant_v1(public.p2_id(33)) is distinct from true
    or public.encounter_can_control_participant_v1(public.p2_id(35)) is distinct from false
    or public.encounter_can_control_participant_v1(public.p2_id(37)) is distinct from false
  then raise exception 'Player/companion control scope mismatch'; end if;
  if (select count(*) from public.encounter_participants
    where id=public.p2_id(33))<>1 then
    raise exception 'Assigned player cannot read hidden companion encounter token'; end if;
  if (select can_edit from public.character_permissions
    where character_id=public.p2_id(32) and user_id=public.p2_id(41)) is distinct from false then
    raise exception 'Battle control inadvertently granted edit'; end if;
end $player_one$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(43)::text,false);
do $player_two$
begin
  if public.encounter_can_control_participant_v1(public.p2_id(33)) is distinct from true
    or public.encounter_can_control_participant_v1(public.p2_id(35)) is distinct from true
    or public.encounter_can_control_participant_v1(public.p2_id(11)) is distinct from false then
    raise exception 'Second player NPC grants overlap incorrectly'; end if;
  if (select count(*) from public.encounter_participants where id=public.p2_id(33))<>1
    then raise exception 'Second delegated controller cannot see hidden companion'; end if;
end $player_two$;
reset role;

-- Revocation of a delegated NPC grant affects that NPC only, not the
-- player's own character, another player's grant or can_edit.
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(40)::text,false);
do $revoke$
begin
  perform public.admin_set_npc_control_v1(public.p2_id(32),public.p2_id(41),false);
end $revoke$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $revoked$
begin
  if public.encounter_can_control_participant_v1(public.p2_id(33)) is distinct from false
   or public.encounter_can_control_participant_v1(public.p2_id(11)) is distinct from true then
   raise exception 'Grant revocation also altered own-character control'; end if;
  if (select count(*) from public.encounter_participants where id=public.p2_id(33))<>0 then
   raise exception 'Revoked player can still view hidden companion encounter token'; end if;
end $revoked$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(43)::text,false);
do $unaffected$
begin
  if public.encounter_can_control_participant_v1(public.p2_id(33)) is distinct from true then
    raise exception 'Revoked another player''s NPC control'; end if;
end $unaffected$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(44)::text,false);
do $legacy_editor$
begin
  if public.encounter_can_control_participant_v1(public.p2_id(33)) is distinct from true then
    raise exception 'Legacy can_edit combat control regressed'; end if;
end $legacy_editor$;
reset role;

do $audit$
begin
 if (select count(*) from public.character_permissions
      where character_id=public.p2_id(32))<>3
  or (select count(*) from public.character_permissions
      where character_id=public.p2_id(32) and can_edit)=0
  or (select count(*) from public.character_permissions
      where character_id=public.p2_id(32) and can_control)=0
 then raise exception 'Delegated grant ledger unexpectedly changed edit or concurrent permission'; end if;
 raise notice 'PASS: two players can control same NPC, one can also control own PC; admin-only grant/revoke; hidden token RLS; editor compatibility; no sheet edit escalation (MOCK Auth only)';
end $audit$;

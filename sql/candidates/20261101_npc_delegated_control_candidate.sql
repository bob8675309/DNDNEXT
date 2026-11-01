-- RESEARCH CANDIDATE ONLY — NOT AN APPROVED/DEPLOYABLE MIGRATION.
-- P2 delegated NPC/familiar/henchman battle control.
-- Requires separate staging review, RLS/grants audit, player-facing acceptance
-- and owner authorization before ANY production SQL change.
--
-- The admin toggle grants combat control independently of sheet/inventory
-- editing. Existing can_edit and direct per-encounter controllers remain valid.
-- This is ADDITIVE: an "off" toggle removes only this delegated grant, not
-- separate sheet-edit access or a per-encounter controller_user_id.
alter table public.character_permissions
  add column if not exists can_control boolean not null default false;

-- IMPORTANT: Do not backfill can_edit into can_control.
-- Existing can_edit users still control NPCs through the independent
-- encounter_can_control_participant_v1 OR predicate below. Copying their
-- grant into can_control would create latent combat permission persisting
-- after a later can_edit revocation, contrary to least privilege.
-- Only explicit Admin assignments may ever set can_control=true.

create or replace function public.admin_set_npc_control_v1(
  p_character_id uuid,p_user_id uuid,p_can_control boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $npc_control$
declare
  v_kind text;
  v_result public.character_permissions%rowtype;
begin
  if auth.uid() is null or not private.current_user_is_admin() then
    raise exception 'Admin privileges required for NPC control assignments'
      using errcode='42501';
  end if;
  if p_character_id is null or p_user_id is null or p_can_control is null then
    raise exception 'Character, player and explicit permission value are required'
      using errcode='22023';
  end if;
  select c.kind into v_kind
  from public.characters c where c.id=p_character_id for share;
  if not found or v_kind not in ('npc','merchant') then
    raise exception 'Only NPCs and merchants can receive delegated NPC control'
      using errcode='22023';
  end if;
  -- Keep all existing can_edit/can_inventory/can_convert fields intact.
  -- The FK to auth.users enforces a real registered account.
  insert into public.character_permissions(character_id,user_id,can_control)
  values(p_character_id,p_user_id,p_can_control)
  on conflict(character_id,user_id) do update
    set can_control=excluded.can_control
  returning * into v_result;
  return jsonb_build_object(
    'characterId',v_result.character_id,
    'userId',v_result.user_id,
    'canControl',v_result.can_control,
    'canEdit',v_result.can_edit,
    'controllerInheritedFromEdit',v_result.can_edit
  );
end
$npc_control$;
revoke all on function public.admin_set_npc_control_v1(uuid,uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.admin_set_npc_control_v1(uuid,uuid,boolean)
  to authenticated;

-- Existing combat access remains valid for every character whose controller
-- is the explicitly assigned encounter user or whose user can edit a sheet.
-- Add independent can_control, checked using auth.uid() on EVERY command.
create or replace function public.encounter_can_control_participant_v1(
  p_participant_id uuid
) returns boolean
language plpgsql
stable security definer
set search_path to 'pg_catalog','public','private','auth'
as $control$
declare
  v_uid uuid := auth.uid();
  v_participant public.encounter_participants%rowtype;
begin
  if coalesce(auth.role(),'')='service_role' then return true; end if;
  if v_uid is null then return false; end if;
  if public.is_admin(v_uid) then return true; end if;
  select * into v_participant from public.encounter_participants
    where id=p_participant_id;
  if not found then return false; end if;
  if v_participant.controller_user_id=v_uid then return true; end if;
  if v_participant.character_id is not null and exists(
    select 1 from public.character_permissions cp
    where cp.character_id=v_participant.character_id
      and cp.user_id=v_uid
      and (coalesce(cp.can_edit,false) or coalesce(cp.can_control,false))
  ) then return true; end if;
  return false;
end
$control$;

-- The live controller RPC is already authenticated executable; keep its
-- existing grants. Do not broaden service/anonymous access.
revoke all on function public.encounter_can_control_participant_v1(uuid)
  from public,anon;
grant execute on function public.encounter_can_control_participant_v1(uuid)
  to authenticated;

-- Preserve hidden NPC visibility rules: a controller explicitly assigned
-- via can_control must be able to see their OWN encounter participant.
-- This does not grant source character secrets, sheet edits or admin access.
drop policy if exists encounter_participants_authenticated_read
  on public.encounter_participants;
create policy encounter_participants_authenticated_read
on public.encounter_participants for select to authenticated
using (
  not is_hidden
  or controller_user_id=(select auth.uid())
  or (select public.is_admin(auth.uid()))
  or exists (
    select 1 from public.character_permissions cp
    where cp.character_id=encounter_participants.character_id
      and cp.user_id=(select auth.uid())
      and (cp.can_control or cp.can_edit)
  )
);

-- IMPORTANT: no standalone NPC controller can call a cast as another user.
-- Each existing action RPC must check encounter_can_control_participant_v1
-- after the already-documented replay-auth transaction fix. Changing this
-- function alone does not cure legacy pre-auth cache-return vulnerabilities.

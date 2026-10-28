-- Isolated-only exact production encounter controller function.
-- Does not change live authorization and is byte-checked against source.
create or replace function public.encounter_can_control_participant_v1(p_participant_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_participant public.encounter_participants%rowtype;
begin
  if coalesce(auth.role(), '') = 'service_role' then return true; end if;
  if v_uid is null then return false; end if;
  if public.is_admin(v_uid) then return true; end if;
  select * into v_participant from public.encounter_participants where id=p_participant_id;
  if not found then return false; end if;
  if v_participant.controller_user_id = v_uid then return true; end if;
  if v_participant.character_id is not null and exists (
    select 1 from public.character_permissions cp
    where cp.character_id=v_participant.character_id and cp.user_id=v_uid and coalesce(cp.can_edit,false)
  ) then return true; end if;
  return false;
end;
$function$;

-- Exact live source snapshot for public.encounter_can_control_participant_v1, MD5 b91d975f399efb2ed2db8519f633fae7
CREATE OR REPLACE FUNCTION public.encounter_can_control_participant_v1(p_participant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
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

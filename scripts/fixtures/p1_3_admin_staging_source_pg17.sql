-- EXACT deployed staging-only Admin writer; DnDWeb SELECT-only 2026-11-03.
-- MD5 190bbed26d2067905b00000686c17176; disposable PG17 only. Do not apply to live DnDWeb.
CREATE OR REPLACE FUNCTION public.admin_update_encounter_participant_staging_v1(p_participant_id uuid, p_q integer DEFAULT NULL::integer, p_r integer DEFAULT NULL::integer, p_team text DEFAULT NULL::text, p_controller_user_id uuid DEFAULT NULL::uuid, p_initiative numeric DEFAULT NULL::numeric, p_initiative_tiebreaker numeric DEFAULT NULL::numeric, p_is_hidden boolean DEFAULT NULL::boolean, p_state jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_encounter_id uuid;
  v_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  select p.encounter_id,e.status into v_encounter_id,v_status
  from public.encounter_participants p join public.encounters e on e.id=p.encounter_id
  where p.id=p_participant_id for update of p;
  if not found then raise exception 'Participant not found'; end if;
  if v_status not in ('draft','ready','initiative') then raise exception 'Staging changes are locked after active play begins'; end if;
  if p_team is not null and p_team not in ('players','allies','enemies','neutral') then raise exception 'Invalid participant team'; end if;

  update public.encounter_participants
  set q=coalesce(p_q,q), r=coalesce(p_r,r), team=coalesce(p_team,team),
      controller_user_id=p_controller_user_id,
      initiative=p_initiative, initiative_tiebreaker=p_initiative_tiebreaker,
      is_hidden=coalesce(p_is_hidden,is_hidden), state=coalesce(p_state,state),
      updated_at=timezone('utc',now())
  where id=p_participant_id;
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_encounter_id;
end;
$function$;

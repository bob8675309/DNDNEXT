-- P1.3: exact source-derived core-action RPC (live MD5 74a43a001247f5fa491b057c97ca4014)
-- Disposable PG17 fixture only; this function stays ungranted to authenticated in candidate test.
CREATE OR REPLACE FUNCTION public.encounter_use_core_action_v1(p_participant_id uuid, p_action text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),''); v_p public.encounter_participants%rowtype; v_e public.encounters%rowtype; v_existing public.encounter_command_requests%rowtype; v_inserted integer:=0; v_result jsonb;
begin
  if p_participant_id is null or p_request_id is null then raise exception 'Participant and request id are required'; end if;
  if p_action not in ('dash','disengage','dodge') then raise exception 'Unsupported core action'; end if;
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  select p_request_id,p.encounter_id,p.id,'core_action',v_uid from public.encounter_participants p where p.id=p_participant_id on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then select * into v_existing from public.encounter_command_requests where request_id=p_request_id; if not found or v_existing.command_type<>'core_action' or v_existing.participant_id<>p_participant_id then raise exception 'Request id is already used for another command'; end if; return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true)); end if;
  select * into v_p from public.encounter_participants where id=p_participant_id for update; if not found then raise exception 'Participant not found'; end if;
  select * into v_e from public.encounters where id=v_p.encounter_id for update; if not found then raise exception 'Encounter not found'; end if;
  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_p.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_p.id) then raise exception 'Not authorized to control this participant'; end if;
  if v_p.is_defeated then raise exception 'Defeated participants cannot act'; end if;
  if not v_p.action_available then raise exception 'Action already spent'; end if;
  update public.encounter_participants set action_available=false,
    movement_bonus_ft=case when p_action='dash' then movement_bonus_ft+speed_ft else movement_bonus_ft end,
    disengaged=case when p_action='disengage' then true else disengaged end,
    dodging=case when p_action='dodge' then true else dodging end,
    updated_at=timezone('utc',now()) where id=v_p.id;
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,v_p.id,'core_action',v_p.display_name||' used '||initcap(p_action)||'.',jsonb_build_object('action',p_action));
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  select jsonb_build_object('requestId',p_request_id,'action',p_action,'actionAvailable',action_available,'movementBonusFt',movement_bonus_ft,'disengaged',disengaged,'dodging',dodging) into v_result from public.encounter_participants where id=v_p.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;$function$;

-- P2 RESEARCH ONLY — PRIVATE, UNGRANTED EXECUTOR. NOT A PRODUCTION MIGRATION.
-- Requires the fixture-only column public.encounter_command_requests.request_intent
-- JSONB; no current live DnDWeb deployment has that column.
-- NEVER promote this single command separately from old ledger-first RPCs:
-- mixed encounter/actor/ledger lock order can deadlock.
--
-- Exact legacy effects retained for Dash / Disengage / Dodge. The *only*
-- deliberate change is canonical typed intent, requester ownership, current
-- controller authorization, fail-closed replay and encounter-FIRST locking.
create or replace function private.encounter_core_action_transaction_candidate_v1(
  p_participant_id uuid,p_action text,p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $core$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(),'');
  v_actor_encounter_id uuid;
  v_p public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_existing public.encounter_command_requests%rowtype;
  v_inserted integer;
  v_intent jsonb;
  v_result jsonb;
begin
  if p_participant_id is null or p_request_id is null then
    raise exception 'Participant and request id are required' using errcode='22023';
  end if;
  if p_action not in ('dash','disengage','dodge') then
    raise exception 'Unsupported core action' using errcode='22023';
  end if;
  if v_uid is null and v_role <> 'service_role' then
    raise exception 'Signed-in controller required' using errcode='42501';
  end if;

  -- Unlocked actor lookup ONLY to discover encounter. Revalidate actor's
  -- encounter after obtaining E then actor C locks. No result is returned
  -- and no ledger is inserted before current controller authorization.
  select encounter_id into v_actor_encounter_id
  from public.encounter_participants where id=p_participant_id;
  if v_actor_encounter_id is null then
    raise exception 'Participant not found' using errcode='P0002';
  end if;
  select * into v_e from public.encounters
  where id=v_actor_encounter_id for update;
  if not found then
    raise exception 'Encounter not found' using errcode='P0002';
  end if;
  select * into v_p from public.encounter_participants
  where id=p_participant_id for update;
  if not found or v_p.encounter_id is distinct from v_e.id then
    raise exception 'Participant encounter changed during command'
    using errcode='40001';
  end if;

  if v_role<>'service_role' and
     not public.encounter_can_control_participant_v1(v_p.id) then
    raise exception 'Not authorized to control this participant' using errcode='42501';
  end if;

  v_intent:=jsonb_build_object(
    'version',1,'encounterId',v_e.id,'participantId',v_p.id,
    'commandType','core_action','action',p_action
  );
  -- Only after E,C locks and current control check: read/lock ledger.
  -- Existing request must bind owner, actor, encounter and the ENTIRE
  -- versioned intent. Legacy unversioned/null intent must fail closed.
  select * into v_existing
  from public.encounter_command_requests
  where request_id=p_request_id for update;
  if found then
    if v_existing.requested_by is distinct from v_uid or
       v_existing.encounter_id is distinct from v_e.id or
       v_existing.participant_id is distinct from v_p.id or
       v_existing.command_type is distinct from 'core_action' or
       v_existing.request_intent is distinct from v_intent then
      raise exception 'Request owner or immutable command intent mismatch'
      using errcode='42501';
    end if;
    if v_existing.result is null or
       jsonb_typeof(v_existing.result)<>'object' or
       v_existing.result->>'action' is distinct from p_action then
      raise exception 'Request result is incomplete or untrusted'
      using errcode='55000';
    end if;
    return v_existing.result;
  end if;

  -- ORIGINAL new-command active-turn/Action/defeat checks. They must not
  -- precede exact completed replay, since replay spends no new resources.
  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_p.id then
    raise exception 'It is not this participant''s active turn' using errcode='55000';
  end if;
  if v_p.is_defeated then
    raise exception 'Defeated participants cannot act' using errcode='55000';
  end if;
  if not v_p.action_available then
    raise exception 'Action already spent' using errcode='55000';
  end if;

  insert into public.encounter_command_requests(
    request_id,encounter_id,participant_id,command_type,requested_by,request_intent
  ) values (p_request_id,v_e.id,v_p.id,'core_action',v_uid,v_intent)
    on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted<>1 then
    -- A request may have been inserted between the initial ledger read and
    -- INSERT; no other action/log/turn should occur. Fail closed and allow
    -- explicit retry, never accept a concurrent unknown cached result.
    raise exception 'Request id already in use; retry with new request'
    using errcode='40001';
  end if;

  update public.encounter_participants
  set action_available=false,
      movement_bonus_ft=case when p_action='dash'
        then movement_bonus_ft+speed_ft else movement_bonus_ft end,
      disengaged=case when p_action='disengage' then true else disengaged end,
      dodging=case when p_action='dodge' then true else dodging end,
      updated_at=timezone('utc',now())
  where id=v_p.id;

  insert into public.encounter_combat_log(
    encounter_id,round,turn_index,actor_participant_id,
    event_type,summary,detail
  ) values (
    v_e.id,v_e.round,v_e.turn_index,v_p.id,
    'core_action',v_p.display_name||' used '||initcap(p_action)||'.',
    jsonb_build_object('action',p_action)
  );

  update public.encounters
  set version=version+1,updated_at=timezone('utc',now())
  where id=v_e.id;

  select jsonb_build_object(
    'requestId',p_request_id,'action',p_action,
    'actionAvailable',action_available,
    'movementBonusFt',movement_bonus_ft,
    'disengaged',disengaged,'dodging',dodging
  ) into v_result
  from public.encounter_participants where id=v_p.id;
  update public.encounter_command_requests
  set result=v_result
  where request_id=p_request_id;
  return v_result;
end $core$;

-- DDL DEFAULT PUBLIC FUNCTION EXECUTE MUST BE REVOKED. No production
-- SELECT, GRANT, RLS, role or function is touched by this file.
revoke all on function private.encounter_core_action_transaction_candidate_v1(
 uuid,text,uuid) from public,anon,authenticated,service_role;

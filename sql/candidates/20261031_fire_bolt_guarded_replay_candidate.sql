-- P2 HELD RESEARCH ONLY. NEVER DEPLOY OR GRANT THIS FUNCTION IN PRODUCTION.
-- This test-only private wrapper characterizes fail-closed checks for the
-- existing v11 Fire Bolt RPC. It is NOT a replacement for fixing all direct
-- public v1/v11/pre_1v entry points. Requires full server-side refactoring,
-- verified lock ordering and actual signed-in Auth before a real release.
create or replace function private.encounter_fire_bolt_guarded_candidate_v1(
  p_caster_id uuid,p_assignment_id uuid,p_target_id uuid,
  p_slot_level integer,p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $held$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(),'');
  v_c public.encounter_participants%rowtype;
  v_t public.encounter_participants%rowtype;
  v_assignment public.character_spells%rowtype;
  v_spell public.spells_catalog%rowtype;
  v_request public.encounter_command_requests%rowtype;
begin
  if p_caster_id is null or p_assignment_id is null
     or p_target_id is null or p_request_id is null then
    raise exception 'Caster, assignment, target and request id required';
  end if;
  -- A signed-in user is required. No service-role bypass in this held probe.
  if v_role <> 'authenticated' or v_uid is null then
    raise exception 'Only signed-in controllers may use this candidate' using errcode='42501';
  end if;
  select * into v_c from public.encounter_participants where id=p_caster_id;
  if not found then raise exception 'Caster not found'; end if;
  if not public.encounter_can_control_participant_v1(v_c.id) then
    raise exception 'Not authorized to control this participant' using errcode='42501';
  end if;
  select * into v_t from public.encounter_participants
   where id=p_target_id and encounter_id=v_c.encounter_id;
  if not found then raise exception 'Target not found in encounter'; end if;
  if v_t.is_hidden and v_t.controller_user_id is distinct from v_uid
     and not public.is_admin(v_uid) then
    raise exception 'Target hidden from this controller' using errcode='42501';
  end if;
  select * into v_assignment from public.character_spells
    where id=p_assignment_id and character_id=v_c.character_id;
  if not found then raise exception 'Spell assignment does not belong to caster'; end if;
  select * into v_spell from public.spells_catalog where id=v_assignment.spell_id;
  if not found or lower(v_spell.spell_key)<>'fire-bolt|xphb'
     or v_spell.source<>'XPHB' or v_spell.level<>0 then
    raise exception 'Only XPHB Fire Bolt is reviewed by this candidate';
  end if;
  if p_slot_level is not null and p_slot_level<>0 then
    raise exception 'Fire Bolt cannot use a spell slot';
  end if;
  if lower(coalesce(v_assignment.source_type,''))<>'class'
     or not coalesce(v_assignment.known,false) then
    raise exception 'Fire Bolt class grant not known or not supported';
  end if;
  if not exists (
    select 1 from public.character_progression cp
    join public.class_catalog cc on cc.id=cp.class_id
    where cp.character_id=v_c.character_id
      and upper(cc.source)='XPHB'
      and lower(coalesce(v_assignment.source_key,''))=lower(cc.class_key)
      and lower(coalesce(v_assignment.source_label,''))=lower(cc.class_key)
      and exists (
        select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) listed
        where lower(btrim(listed))=lower(cc.class_name)
      )
  ) then raise exception 'Fire Bolt class-source grant not canonical'; end if;
  -- Bind actor, original requester, target, assignment and spell to replay.
  -- Reject pending/old unbound ledger rows. This MUST eventually live inside
  -- the authoritative transaction, not in a separate advisory preflight.
  select * into v_request from public.encounter_command_requests
    where request_id=p_request_id;
  if found then
    if v_request.command_type<>'spell_cast'
       or v_request.encounter_id is distinct from v_c.encounter_id
       or v_request.participant_id is distinct from v_c.id
       or v_request.requested_by is distinct from v_uid then
      raise exception 'Request belongs to a different controller or command' using errcode='42501';
    end if;
    if v_request.result is null
       or jsonb_typeof(v_request.result)<>'object'
       or (v_request.result->>'requestId') is distinct from p_request_id::text
       or (v_request.result->>'casterId') is distinct from v_c.id::text
       or (v_request.result->>'targetId') is distinct from p_target_id::text
       or (v_request.result->>'assignmentId') is distinct from p_assignment_id::text
       or (v_request.result->>'spellId') is distinct from v_spell.id::text then
      raise exception 'Request intent changed or cached result not bound' using errcode='42501';
    end if;
  end if;
  -- The original v11 resolver still owns all locking, rolls, damage,
  -- action spending, command ledger and result persistence. This wrapper
  -- alone does NOT remove its original public entry points.
  return public.encounter_cast_spell_v11(
    p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
end
$held$;

revoke all on function private.encounter_fire_bolt_guarded_candidate_v1(
  uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
-- No grants here. Disposable PG16 checks explicitly grant authenticated.

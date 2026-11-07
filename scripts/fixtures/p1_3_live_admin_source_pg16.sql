-- Verbatim live pg_get_functiondef snapshot 2026-11-01: admin_set_encounter_status_v1 MD5=ab4592dc22632d646886f0d808cfb95f
CREATE OR REPLACE FUNCTION public.admin_set_encounter_status_v1(p_encounter_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_current text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  if p_status not in ('draft','ready','initiative','active','paused','resolved','archived') then raise exception 'Invalid encounter status'; end if;

  select status into v_current from public.encounters where id=p_encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  if v_current='archived' and p_status <> 'archived' then raise exception 'Archived encounters cannot be reopened'; end if;

  -- Preserve the v1 compatibility entry point, but staged -> active must use
  -- the same atomic authority as the Milestone 2 Start Encounter command.
  if p_status='active' and v_current in ('draft','ready','initiative') then
    perform public.admin_start_encounter_v1(p_encounter_id);
    return;
  end if;

  if p_status='active' and not exists(select 1 from public.encounter_participants where encounter_id=p_encounter_id) then raise exception 'Add at least one participant before activation'; end if;

  update public.encounters
  set status=p_status,
      phase=case p_status when 'draft' then 'staging' when 'ready' then 'staging' when 'initiative' then 'initiative' when 'active' then 'turns' when 'paused' then 'paused' when 'resolved' then 'resolved' else 'archived' end,
      round=case when p_status='active' and round=0 then 1 else round end,
      started_at=case when p_status='active' then coalesce(started_at,timezone('utc',now())) else started_at end,
      resolved_at=case when p_status='resolved' then timezone('utc',now()) when p_status not in ('resolved','archived') then null else resolved_at end,
      version=version+1,
      updated_at=timezone('utc',now())
  where id=p_encounter_id;
end;
$function$;

-- Verbatim live pg_get_functiondef snapshot 2026-11-01: admin_start_encounter_v1 MD5=ce7bb040cb09d9dac85517ea8206b44e
CREATE OR REPLACE FUNCTION public.admin_start_encounter_v1(p_encounter_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_encounter public.encounters%rowtype;
  v_first_participant_id uuid;
  v_first_name text;
  v_participant_count integer;
  v_missing_initiative integer;
  v_radius integer;
  v_now timestamptz := timezone('utc', now());
  v_result jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (v_uid is null or not public.is_admin(v_uid)) then
    raise exception 'Admin required';
  end if;

  select * into v_encounter
  from public.encounters
  where id = p_encounter_id
  for update;

  if not found then raise exception 'Encounter not found'; end if;
  if v_encounter.status not in ('draft','ready','initiative') then
    raise exception 'Only staged encounters can be started';
  end if;

  select radius into v_radius
  from public.encounter_maps
  where id = v_encounter.map_id and is_active;
  if not found then raise exception 'Active encounter map not found'; end if;

  select count(*), count(*) filter (where initiative is null)
  into v_participant_count, v_missing_initiative
  from public.encounter_participants
  where encounter_id = p_encounter_id and not is_defeated;

  if v_participant_count = 0 then raise exception 'Stage at least one participant before starting'; end if;
  if v_missing_initiative > 0 then raise exception 'Every non-defeated participant needs initiative before starting'; end if;

  if exists (
    select 1
    from public.encounter_participants p
    where p.encounter_id = p_encounter_id
      and not p.is_defeated
      and greatest(abs(p.q), abs(p.r), abs(p.q + p.r)) > v_radius
  ) then
    raise exception 'A participant is staged outside the encounter map';
  end if;

  if exists (
    select 1
    from public.encounter_participants p
    join public.encounter_hex_overrides h
      on h.map_id = v_encounter.map_id and h.q = p.q and h.r = p.r
    where p.encounter_id = p_encounter_id
      and not p.is_defeated
      and h.terrain_type = 'blocked'
  ) or exists (
    select 1
    from public.encounter_participants p
    join public.encounter_map_objects o
      on o.map_id = v_encounter.map_id and o.q = p.q and o.r = p.r
    where p.encounter_id = p_encounter_id
      and not p.is_defeated
      and o.blocks_movement
  ) then
    raise exception 'A participant is staged on a blocked hex';
  end if;

  if exists (
    select 1
    from public.encounter_participants p
    where p.encounter_id = p_encounter_id and not p.is_defeated
    group by p.q, p.r
    having count(*) > 1
  ) then
    raise exception 'Two participants cannot start on the same hex';
  end if;

  select p.id, p.display_name
  into v_first_participant_id, v_first_name
  from public.encounter_participants p
  where p.encounter_id = p_encounter_id and not p.is_defeated
  order by p.initiative desc, p.initiative_tiebreaker desc nulls last, p.created_at, p.id
  limit 1;

  update public.encounter_participants p
  set movement_spent_ft = 0,
      movement_bonus_ft = 0,
      action_available = true,
      bonus_action_available = true,
      reaction_available = true,
      disengaged = false,
      dodging = false,
      speed_ft = greatest(0, public.encounter_canonical_speed_ft_v1(p.character_id)),
      turn_started_at = case when p.id = v_first_participant_id then v_now else null end,
      updated_at = v_now
  where p.encounter_id = p_encounter_id and not p.is_defeated;

  update public.encounters
  set status = 'active',
      phase = 'turns',
      round = 1,
      turn_index = 0,
      active_participant_id = v_first_participant_id,
      started_at = coalesce(started_at, v_now),
      resolved_at = null,
      version = version + 1,
      updated_at = v_now
  where id = p_encounter_id;

  v_result := jsonb_build_object(
    'encounterId', p_encounter_id,
    'status', 'active',
    'round', 1,
    'turnIndex', 0,
    'activeParticipantId', v_first_participant_id,
    'activeParticipantName', v_first_name,
    'participantCount', v_participant_count
  );

  insert into public.encounter_combat_log(
    encounter_id, round, turn_index, actor_participant_id, event_type, summary, detail
  ) values (
    p_encounter_id, 1, 0, v_first_participant_id, 'encounter_started',
    'Encounter started. ' || v_first_name || ' has the first turn.', v_result
  );

  return v_result;
end;
$function$;

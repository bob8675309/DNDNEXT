begin;

create or replace function public.admin_start_encounter_v1(p_encounter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
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

revoke all on function public.admin_start_encounter_v1(uuid) from public, anon;
grant execute on function public.admin_start_encounter_v1(uuid) to authenticated, service_role;

do $validation$
begin
  if has_function_privilege('anon','public.admin_start_encounter_v1(uuid)','EXECUTE') then
    raise exception 'anon must not invoke encounter start RPC';
  end if;
  if not has_function_privilege('authenticated','public.admin_start_encounter_v1(uuid)','EXECUTE') then
    raise exception 'authenticated role must be able to invoke guarded encounter start RPC';
  end if;
end;
$validation$;

commit;

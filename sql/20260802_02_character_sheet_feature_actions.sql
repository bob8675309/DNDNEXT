-- Persistent standalone Sheet & Rolls feature actions.
-- Encounter play must continue to use encounter-scoped guarded RPCs instead.

create or replace function public.update_character_sheet_action_state_v1(
  p_character_id uuid,
  p_action_key text,
  p_operation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_sheet jsonb;
  v_action_key text := lower(trim(coalesce(p_action_key,'')));
  v_operation text := lower(trim(coalesce(p_operation,'')));
  v_class_key text;
  v_level integer;
  v_max integer;
  v_remaining integer;
  v_active boolean;
  v_current_state jsonb;
  v_next_state jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to use this character''s sheet actions.' using errcode = '42501';
  end if;
  if v_operation not in ('activate','deactivate','reset') then
    raise exception 'Unsupported sheet action operation.' using errcode = '22023';
  end if;

  select sheet into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;

  if v_sheet is null then
    raise exception 'No character sheet exists for this character.' using errcode = 'P0002';
  end if;

  v_class_key := lower(trim(coalesce(
    v_sheet->>'classKey',
    v_sheet#>>'{meta,classKey}',
    v_sheet->>'className',
    v_sheet->>'class',
    ''
  )));
  v_class_key := regexp_replace(v_class_key,'[^a-z0-9]+','-','g');
  v_class_key := trim(both '-' from v_class_key);

  if coalesce(v_sheet->>'level',v_sheet#>>'{meta,level}','') ~ '^\d+$' then
    v_level := greatest(1,least(20,coalesce(v_sheet->>'level',v_sheet#>>'{meta,level}')::integer));
  else
    v_level := 1;
  end if;

  if v_action_key = 'rage' then
    if v_class_key <> 'barbarian' then
      raise exception 'Rage is only available to a Barbarian sheet.' using errcode = '22023';
    end if;
    if coalesce(v_sheet->>'rages','') ~ '^\d+$' then
      v_max := greatest(0,least(99,(v_sheet->>'rages')::integer));
    else
      v_max := case
        when v_level <= 2 then 2
        when v_level <= 5 then 3
        when v_level <= 11 then 4
        when v_level <= 16 then 5
        else 6
      end;
    end if;
  else
    raise exception 'Unsupported sheet action.' using errcode = '22023';
  end if;

  v_current_state := case
    when jsonb_typeof(v_sheet#>'{actionState,rage}') = 'object' then v_sheet#>'{actionState,rage}'
    else '{}'::jsonb
  end;
  v_active := coalesce((v_current_state->>'active')::boolean,false);
  if coalesce(v_current_state->>'usesRemaining','') ~ '^\d+$' then
    v_remaining := greatest(0,least(v_max,(v_current_state->>'usesRemaining')::integer));
  else
    v_remaining := v_max;
  end if;

  if v_operation = 'activate' and not v_active then
    if v_remaining <= 0 then
      raise exception 'No Rage uses remain. Reset uses after the appropriate rest.' using errcode = '22023';
    end if;
    v_remaining := v_remaining-1;
    v_active := true;
  elsif v_operation = 'deactivate' then
    v_active := false;
  elsif v_operation = 'reset' then
    v_active := false;
    v_remaining := v_max;
  end if;

  v_next_state := jsonb_build_object(
    'active',v_active,
    'usesRemaining',v_remaining,
    'usesMax',v_max,
    'updatedAt',timezone('utc',now())
  );
  v_sheet := jsonb_set(v_sheet,'{actionState}',coalesce(v_sheet->'actionState','{}'::jsonb),true);
  v_sheet := jsonb_set(v_sheet,'{actionState,rage}',v_next_state,true);

  update public.character_sheets
  set sheet=v_sheet,updated_at=now()
  where character_id=p_character_id;

  update public.players p
  set sheet=v_sheet,updated_at=now()
  where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id=p_character_id and cp.can_edit
  );

  return jsonb_build_object(
    'characterId',p_character_id,
    'actionKey',v_action_key,
    'operation',v_operation,
    'active',v_active,
    'usesRemaining',v_remaining,
    'usesMax',v_max,
    'sheet',v_sheet
  );
end;
$$;

revoke all on function public.update_character_sheet_action_state_v1(uuid,text,text) from public, anon;
grant execute on function public.update_character_sheet_action_state_v1(uuid,text,text) to authenticated, service_role;

comment on function public.update_character_sheet_action_state_v1(uuid,text,text) is
  'Updates persistent standalone Sheet & Rolls feature state after can_manage_character_progression_v1 authorization. Encounter state must use encounter RPCs.';

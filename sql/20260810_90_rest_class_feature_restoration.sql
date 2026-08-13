-- Migration 90: extend the existing sheet-side rest authority to source-backed class action state.
-- Scope is deliberately narrow: Rage is the only class feature action currently persisted in
-- character_sheets.sheet.actionState and supported by update_character_sheet_action_state_v1.
-- XPHB Rage regains one expended use on a Short Rest and all expended uses on a Long Rest.
-- PHB Rage remains Long-Rest-only. No encounter/tactical state is changed here.

create or replace function private.restore_character_rest_action_state_v1(
  p_character_id uuid,
  p_rest_type text
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $$
declare
  v_sheet jsonb;
  v_class_key text := '';
  v_class_source text := '';
  v_level integer := 1;
  v_current jsonb := '{}'::jsonb;
  v_next jsonb := '{}'::jsonb;
  v_max integer := 0;
  v_remaining integer := 0;
  v_next_remaining integer := 0;
  v_restored integer := 0;
  v_active boolean := false;
begin
  select cs.sheet,
         lower(coalesce(cc.class_key,'')),
         upper(coalesce(cc.source,'')),
         greatest(1,least(20,coalesce(cp.class_level,1)))
  into v_sheet,v_class_key,v_class_source,v_level
  from public.character_sheets cs
  left join public.character_progression cp on cp.character_id=cs.character_id
  left join public.class_catalog cc on cc.id=cp.class_id
  where cs.character_id=p_character_id
  for update of cs;

  if v_sheet is null then
    return jsonb_build_object('restoredClassFeatureUses',0,'sheet',null,'features','[]'::jsonb);
  end if;

  if v_class_key <> 'barbarian' then
    return jsonb_build_object('restoredClassFeatureUses',0,'sheet',v_sheet,'features','[]'::jsonb);
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

  v_current := case
    when jsonb_typeof(v_sheet#>'{actionState,rage}')='object' then v_sheet#>'{actionState,rage}'
    else '{}'::jsonb
  end;
  v_active := coalesce((v_current->>'active')::boolean,false);
  if coalesce(v_current->>'usesRemaining','') ~ '^\d+$' then
    v_remaining := greatest(0,least(v_max,(v_current->>'usesRemaining')::integer));
  else
    v_remaining := v_max;
  end if;

  v_next_remaining := v_remaining;
  if v_class_source='XPHB' and p_rest_type='short_rest' then
    v_next_remaining := least(v_max,v_remaining+1);
  elsif p_rest_type='long_rest' then
    v_next_remaining := v_max;
  end if;
  v_restored := greatest(0,v_next_remaining-v_remaining);

  v_next := jsonb_build_object(
    'active',false,
    'usesRemaining',v_next_remaining,
    'usesMax',v_max,
    'updatedAt',timezone('utc',now())
  );
  v_sheet := jsonb_set(v_sheet,'{actionState}',coalesce(v_sheet->'actionState','{}'::jsonb),true);
  v_sheet := jsonb_set(v_sheet,'{actionState,rage}',v_next,true);

  update public.character_sheets
  set sheet=v_sheet,updated_at=now()
  where character_id=p_character_id;

  -- Preserve the existing legacy player-sheet compatibility projection used by the
  -- sheet action RPC. Character-scoped character_sheets remains authoritative.
  update public.players p
  set sheet=v_sheet,updated_at=now()
  where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id=p_character_id and cp.can_edit
  );

  return jsonb_build_object(
    'restoredClassFeatureUses',v_restored,
    'sheet',v_sheet,
    'features',jsonb_build_array(jsonb_build_object(
      'actionKey','rage',
      'classSource',v_class_source,
      'usesBefore',v_remaining,
      'usesRemaining',v_next_remaining,
      'usesMax',v_max,
      'restoredUses',v_restored,
      'activeBeforeRest',v_active,
      'active',false
    ))
  );
end;
$$;

revoke all on function private.restore_character_rest_action_state_v1(uuid,text) from public;
revoke all on function private.restore_character_rest_action_state_v1(uuid,text) from anon;
revoke all on function private.restore_character_rest_action_state_v1(uuid,text) from authenticated;
grant execute on function private.restore_character_rest_action_state_v1(uuid,text) to service_role;

create or replace function public.complete_character_rest_v1(p_character_id uuid, p_rest_type text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $$
declare
  v_rest_type text := lower(replace(replace(btrim(coalesce(p_rest_type,'')),' ','_'),'-','_'));
  v_slots_restored integer := 0;
  v_uses_restored integer := 0;
  v_class_uses_restored integer := 0;
  v_profile jsonb;
  v_action_result jsonb := '{}'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to complete rests for this character.' using errcode='42501';
  end if;
  if v_rest_type not in ('short_rest','long_rest') then
    raise exception 'Rest type must be short_rest or long_rest.' using errcode='22023';
  end if;

  perform private.sync_character_spell_slots_v1(p_character_id);

  select coalesce(sum(slots_max-slots_remaining),0)::integer
  into v_slots_restored
  from public.character_spell_slots
  where character_id=p_character_id
    and slots_remaining<slots_max
    and (v_rest_type='long_rest' or recharge_key='short_rest');

  update public.character_spell_slots
  set slots_remaining=slots_max,updated_at=timezone('utc',now())
  where character_id=p_character_id
    and slots_remaining<slots_max
    and (v_rest_type='long_rest' or recharge_key='short_rest');

  select coalesce(sum(uses_max-coalesce(uses_remaining,uses_max)),0)::integer
  into v_uses_restored
  from public.character_spells
  where character_id=p_character_id
    and uses_max is not null and uses_max>0
    and coalesce(uses_remaining,uses_max)<uses_max
    and case
      when v_rest_type='long_rest' then lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_')) in ('short_rest','long_rest')
      else lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_'))='short_rest'
    end;

  update public.character_spells
  set uses_remaining=uses_max,updated_at=timezone('utc',now())
  where character_id=p_character_id
    and uses_max is not null and uses_max>0
    and coalesce(uses_remaining,uses_max)<uses_max
    and case
      when v_rest_type='long_rest' then lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_')) in ('short_rest','long_rest')
      else lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_'))='short_rest'
    end;

  v_action_result := private.restore_character_rest_action_state_v1(p_character_id,v_rest_type);
  v_class_uses_restored := coalesce((v_action_result->>'restoredClassFeatureUses')::integer,0);

  insert into public.character_rest_log(
    character_id,rest_type,completed_by,restored_spell_slots,restored_spell_uses,details
  ) values(
    p_character_id,v_rest_type,auth.uid(),v_slots_restored,v_uses_restored,
    jsonb_build_object(
      'scope','standalone_character_sheet',
      'encounterStateChanged',false,
      'restoredClassFeatureUses',v_class_uses_restored,
      'classFeatures',coalesce(v_action_result->'features','[]'::jsonb),
      'restores',case when v_rest_type='short_rest'
        then jsonb_build_array('short-rest spell slots','short-rest limited spell uses','source-backed short-rest class feature uses')
        else jsonb_build_array('all spell slots','short-rest limited spell uses','long-rest limited spell uses','source-backed long-rest class feature uses')
      end
    )
  );

  -- The rest-log insert above still passes through the existing active-encounter guard.
  -- If that guard rejects the rest, this entire transaction (including sheet action state)
  -- rolls back atomically.
  v_profile:=private.character_sheet_resource_profile_json_v1(p_character_id);
  return v_profile || jsonb_build_object(
    'sheet',v_action_result->'sheet',
    'restResult',jsonb_build_object(
      'restType',v_rest_type,
      'restoredSpellSlots',v_slots_restored,
      'restoredSpellUses',v_uses_restored,
      'restoredClassFeatureUses',v_class_uses_restored,
      'classFeatures',coalesce(v_action_result->'features','[]'::jsonb)
    )
  );
end;
$$;

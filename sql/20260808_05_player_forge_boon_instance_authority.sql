-- Epic Boons use option_type='boon' in the imported option catalogue.  They
-- participate in the same per-acquisition authority model as feats so level-19
-- creation and ordinary level-up can share one grant-instance contract.

create or replace function private.validate_player_forge_feat_instances_v1(p_sheet jsonb)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_instances jsonb := coalesce(p_sheet -> 'featGrantInstances', '[]'::jsonb);
  v_instance jsonb;
  v_instance_key text;
  v_option_id uuid;
  v_catalog public.character_option_catalog%rowtype;
  v_level integer := greatest(1, least(20, coalesce(nullif(p_sheet ->> 'level', '')::integer, 1)));
  v_seen_keys text[] := '{}'::text[];
  v_seen_nonrepeatable uuid[] := '{}'::uuid[];
begin
  if jsonb_typeof(v_instances) <> 'array' then
    raise exception 'featGrantInstances must be a JSON array.';
  end if;
  if jsonb_array_length(v_instances) > 100 then
    raise exception 'Too many feat or boon grant instances.';
  end if;

  for v_instance in select value from jsonb_array_elements(v_instances)
  loop
    if jsonb_typeof(v_instance) <> 'object' then
      raise exception 'Each feat or boon grant instance must be an object.';
    end if;
    v_instance_key := nullif(btrim(v_instance ->> 'instanceId'), '');
    if v_instance_key is null then
      raise exception 'Every feat or boon grant instance requires an instanceId.';
    end if;
    if v_instance_key = any(v_seen_keys) then
      raise exception 'Duplicate feat or boon grant instance %.', v_instance_key;
    end if;
    v_seen_keys := array_append(v_seen_keys, v_instance_key);

    begin
      v_option_id := nullif(btrim(v_instance ->> 'optionId'), '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Grant instance % has an invalid optionId.', v_instance_key;
    end;
    if v_option_id is null then
      raise exception 'Grant instance % must reference a canonical feat or boon option.', v_instance_key;
    end if;

    select * into v_catalog
    from public.character_option_catalog
    where id = v_option_id and option_type in ('feat','boon');
    if not found then
      raise exception 'Grant instance % references an unavailable feat or boon.', v_instance_key;
    end if;
    if private.normalize_player_choice_name_v1(v_instance ->> 'name') <> private.normalize_player_choice_name_v1(v_catalog.name) then
      raise exception 'Grant instance % does not match its canonical option name.', v_instance_key;
    end if;
    if nullif(btrim(v_instance ->> 'source'), '') is not null and upper(btrim(v_instance ->> 'source')) <> upper(v_catalog.source) then
      raise exception 'Grant instance % does not match its canonical option source.', v_instance_key;
    end if;
    if nullif(btrim(v_instance ->> 'optionType'), '') is not null and lower(btrim(v_instance ->> 'optionType')) <> lower(v_catalog.option_type) then
      raise exception 'Grant instance % does not match its canonical option type.', v_instance_key;
    end if;
    if coalesce((v_instance ->> 'acquisitionLevel')::integer, 1) < 1 or coalesce((v_instance ->> 'acquisitionLevel')::integer, 1) > v_level then
      raise exception 'Grant instance % has an invalid acquisition level.', v_instance_key;
    end if;
    if jsonb_typeof(coalesce(v_instance -> 'choices', '{}'::jsonb)) <> 'object' then
      raise exception 'Grant instance % choices must be an object.', v_instance_key;
    end if;
    if jsonb_typeof(coalesce(v_instance -> 'fixedEffects', '[]'::jsonb)) <> 'array' then
      raise exception 'Grant instance % effects must be an array.', v_instance_key;
    end if;

    if not coalesce((v_catalog.metadata ->> 'repeatable')::boolean, false) then
      if v_option_id = any(v_seen_nonrepeatable) then
        raise exception '% is not repeatable.', v_catalog.name;
      end if;
      v_seen_nonrepeatable := array_append(v_seen_nonrepeatable, v_option_id);
    end if;
  end loop;
end;
$function$;

create or replace function private.materialize_player_forge_feat_instances_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_sheet jsonb;
  v_instance jsonb;
  v_option_id uuid;
  v_catalog public.character_option_catalog%rowtype;
begin
  select cs.sheet into v_sheet
  from public.character_sheets cs
  where cs.character_id = new.character_id;

  if coalesce(v_sheet #>> '{meta,creator}', '') <> 'shared_character_forge_player_v2' then
    return new;
  end if;

  perform private.validate_player_forge_feat_instances_v1(v_sheet);

  for v_instance in
    select value from jsonb_array_elements(coalesce(v_sheet -> 'featGrantInstances', '[]'::jsonb))
  loop
    v_option_id := (v_instance ->> 'optionId')::uuid;
    select * into v_catalog
    from public.character_option_catalog
    where id = v_option_id and option_type in ('feat','boon');

    insert into public.character_option_grant_instances(
      character_id, option_id, option_key, option_type, option_name, option_source,
      instance_key, acquisition_owner_type, acquisition_owner_key, acquisition_label,
      acquisition_level, choices, effects, fixed_spell_tokens, repeatable, granted_by, updated_at
    ) values (
      new.character_id,
      v_catalog.id,
      v_catalog.option_key,
      v_catalog.option_type,
      v_catalog.name,
      v_catalog.source,
      v_instance ->> 'instanceId',
      nullif(v_instance ->> 'acquisitionOwnerType', ''),
      nullif(v_instance ->> 'acquisitionOwnerKey', ''),
      nullif(v_instance ->> 'acquisitionLabel', ''),
      coalesce((v_instance ->> 'acquisitionLevel')::integer, 1),
      coalesce(v_instance -> 'choices', '{}'::jsonb),
      coalesce(v_instance -> 'fixedEffects', '[]'::jsonb),
      coalesce(v_instance -> 'fixedSpellTokens', '[]'::jsonb),
      coalesce((v_catalog.metadata ->> 'repeatable')::boolean, false),
      new.created_by,
      now()
    )
    on conflict (character_id, instance_key) do update
      set choices = excluded.choices,
          effects = excluded.effects,
          fixed_spell_tokens = excluded.fixed_spell_tokens,
          acquisition_owner_type = excluded.acquisition_owner_type,
          acquisition_owner_key = excluded.acquisition_owner_key,
          acquisition_label = excluded.acquisition_label,
          acquisition_level = excluded.acquisition_level,
          option_type = excluded.option_type,
          updated_at = now();

    insert into public.character_option_grants(character_id, option_id, notes, granted_by, updated_at)
    values (
      new.character_id,
      v_catalog.id,
      case when v_catalog.option_type = 'boon'
        then 'Character Forge Epic Boon grant; see character_option_grant_instances for source-owned instance choices.'
        else 'Character Forge feat grant; see character_option_grant_instances for source-owned instance choices.' end,
      new.created_by,
      now()
    )
    on conflict (character_id, option_id) do nothing;
  end loop;

  return new;
end;
$function$;

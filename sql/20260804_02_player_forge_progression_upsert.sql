-- The character_sheets progression trigger may initialize the selected class/level
-- before create_player_character_v2 reaches its progression step. Use an upsert so
-- player creation is safe with or without that trigger on fresh/restored databases.

create or replace function public.create_player_character_v2(
  p_payload jsonb,
  p_spell_choices jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_user uuid := auth.uid();
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_sheet jsonb;
  v_name text;
  v_class_key text;
  v_level integer;
  v_class public.class_catalog%rowtype;
  v_level_row public.class_level_progression%rowtype;
  v_character_id uuid;
  v_tags text[] := array['player-character']::text[];
  v_creation_request_id uuid;
  v_portrait_library_id uuid;
  v_visual_asset_id uuid;
  v_portrait public.npc_portrait_library%rowtype;
  v_asset public.npc_visual_assets%rowtype;
  v_portrait_url text;
  v_portrait_storage_path text;
  v_portrait_thumb_url text;
  v_portrait_shop_url text;
  v_portrait_source text;
  v_image_url text;
  v_sprite_path text;
  v_sprite_key text;
  v_sprite_scale double precision;
  v_choice jsonb;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_seen uuid[] := '{}'::uuid[];
  v_prepared boolean;
  v_has_spell_choices boolean := false;
  v_spell_selection_pending boolean := false;
begin
  if v_user is null then
    raise exception 'Sign in is required to create a player character.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Character payload must be a JSON object.';
  end if;
  if jsonb_typeof(coalesce(p_spell_choices, '[]'::jsonb)) <> 'array' then
    raise exception 'Spell choices must be an array.';
  end if;
  if jsonb_array_length(coalesce(p_spell_choices, '[]'::jsonb)) > 100 then
    raise exception 'Too many starting spell choices.';
  end if;

  if nullif(btrim(v_payload->>'creation_request_id'), '') is not null then
    begin
      v_creation_request_id := (v_payload->>'creation_request_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'creation_request_id must be a valid UUID.';
    end;

    select c.id into v_character_id
    from public.characters c
    join public.character_permissions cp on cp.character_id = c.id
    where c.creation_request_id = v_creation_request_id
      and cp.user_id = v_user
      and cp.can_edit
    limit 1;
    if found then return v_character_id; end if;

    if exists (select 1 from public.characters where creation_request_id = v_creation_request_id) then
      raise exception 'This creation request belongs to another account.' using errcode = '42501';
    end if;
  end if;

  v_name := btrim(coalesce(v_payload->>'name', ''));
  if char_length(v_name) < 2 then raise exception 'Character name must be at least 2 characters.'; end if;
  if char_length(v_name) > 120 then raise exception 'Character name must be 120 characters or fewer.'; end if;
  if exists (select 1 from public.characters where lower(name) = lower(v_name)) then
    raise exception 'A character named % already exists.', v_name using errcode = '23505';
  end if;

  v_sheet := coalesce(v_payload->'sheet', '{}'::jsonb);
  if jsonb_typeof(v_sheet) <> 'object' then raise exception 'Character sheet must be a JSON object.'; end if;
  v_class_key := lower(btrim(coalesce(v_sheet->>'classKey', v_sheet->'meta'->>'classKey', '')));
  if v_class_key = '' or v_class_key = 'civilian' then
    raise exception 'Choose an adventuring class.';
  end if;

  begin
    v_level := coalesce(nullif(v_sheet->>'level', '')::integer, 1);
  exception when invalid_text_representation then
    raise exception 'Starting level must be a whole number from 1 to 20.';
  end;
  if v_level < 1 or v_level > 20 then
    raise exception 'Starting level must be between 1 and 20.';
  end if;

  select * into v_class
  from public.class_catalog
  where class_key = v_class_key
  order by case source when 'XPHB' then 0 when 'PHB' then 1 else 2 end, updated_at desc
  limit 1;
  if v_class.id is null then
    raise exception 'The class % is not available.', v_class_key using errcode = 'P0002';
  end if;

  select * into v_level_row
  from public.class_level_progression
  where class_id = v_class.id and class_level = v_level;
  if v_level_row.class_id is null then
    raise exception 'Progression metadata for % level % is unavailable.', v_class.class_name, v_level using errcode = 'P0002';
  end if;

  if jsonb_typeof(v_payload->'tags') = 'array' then
    select array_agg(distinct tag order by tag) into v_tags
    from (
      select lower(btrim(value)) as tag
      from jsonb_array_elements_text(v_payload->'tags')
      where btrim(value) <> ''
      union all select 'player-character'
    ) normalized;
  end if;

  if nullif(btrim(v_payload->>'portrait_library_id'), '') is not null then
    begin v_portrait_library_id := (v_payload->>'portrait_library_id')::uuid;
    exception when invalid_text_representation then raise exception 'portrait_library_id must be a valid UUID.'; end;
    select * into v_portrait from public.npc_portrait_library where id = v_portrait_library_id and is_active;
    if not found then raise exception 'Selected portrait is not active or was not found.'; end if;
  end if;

  if nullif(btrim(v_payload->>'visual_asset_id'), '') is not null then
    begin v_visual_asset_id := (v_payload->>'visual_asset_id')::uuid;
    exception when invalid_text_representation then raise exception 'visual_asset_id must be a valid UUID.'; end;
    select * into v_asset from public.npc_visual_assets where id = v_visual_asset_id and is_active;
    if not found then raise exception 'Selected visual asset is not active or was not found.'; end if;
    if v_portrait_library_id is not null and v_asset.portrait_library_id <> v_portrait_library_id then
      raise exception 'Selected sprite asset does not belong to the selected portrait.';
    end if;
    if v_portrait_library_id is null then
      v_portrait_library_id := v_asset.portrait_library_id;
      select * into v_portrait from public.npc_portrait_library where id = v_portrait_library_id and is_active;
      if not found then raise exception 'Sprite asset portrait is not active or was not found.'; end if;
    end if;
  end if;

  v_portrait_storage_path := coalesce(nullif(btrim(v_portrait.storage_path), ''), nullif(btrim(v_payload->>'portrait_storage_path'), ''));
  v_portrait_url := coalesce(nullif(btrim(v_portrait.public_url), ''), nullif(btrim(v_payload->>'portrait_url'), ''));
  v_portrait_thumb_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'portrait_thumb_url'), ''));
  v_portrait_shop_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'portrait_shop_url'), ''));
  v_portrait_source := case when v_portrait_library_id is not null then 'library' else coalesce(nullif(btrim(v_payload->>'portrait_source'), ''), 'default') end;
  v_image_url := coalesce(v_portrait_url, nullif(btrim(v_payload->>'image_url'), ''));
  v_sprite_path := coalesce(nullif(btrim(v_asset.sprite_path), ''), nullif(btrim(v_payload->>'sprite_path'), ''));
  v_sprite_key := coalesce(case when v_visual_asset_id is not null then v_visual_asset_id::text end, nullif(btrim(v_payload->>'sprite_key'), ''));
  v_sprite_scale := coalesce(v_asset.default_scale::double precision, nullif(v_payload->>'sprite_scale', '')::double precision);

  v_has_spell_choices := jsonb_array_length(coalesce(p_spell_choices, '[]'::jsonb)) > 0;
  v_spell_selection_pending := v_class.spellcasting_ability is not null and not v_has_spell_choices;

  v_sheet := v_sheet || jsonb_build_object(
    'classKey', v_class.class_key,
    'className', v_class.class_name,
    'class', v_class.class_name,
    'level', v_level,
    'rulesetSource', v_class.source,
    'ruleset', v_class.ruleset,
    'proficiencyBonus', v_level_row.proficiency_bonus,
    'hitDice', v_level::text || 'd' || coalesce(v_class.hit_die, 8)::text,
    'spellSlots', v_level_row.spell_slots,
    'startingSpellSelectionPending', v_spell_selection_pending
  );
  v_sheet := v_sheet || jsonb_build_object(
    'meta', coalesce(v_sheet->'meta', '{}'::jsonb) || jsonb_build_object(
      'classKey', v_class.class_key,
      'className', v_class.class_name,
      'level', v_level,
      'rulesetSource', v_class.source,
      'ruleset', v_class.ruleset,
      'creator', 'shared_character_forge_player_v2',
      'creationRequestId', v_creation_request_id,
      'startingSpellSelectionPending', v_spell_selection_pending
    )
  );

  insert into public.characters(
    name, race, role, description, motivation, quirk, mannerism, voice, secret, affiliation,
    status, background, tags, kind, storefront_enabled,
    portrait_library_id, visual_asset_id, creation_request_id,
    portrait_url, portrait_storage_path, portrait_thumb_url, portrait_shop_url, portrait_source, image_url,
    sprite_key, sprite_path, sprite_scale,
    location_id, last_known_location_id, home_location_id, is_hidden, state, updated_at
  ) values (
    v_name,
    nullif(btrim(v_payload->>'race'), ''),
    coalesce(nullif(btrim(v_payload->>'role'), ''), v_class.class_name),
    nullif(btrim(v_payload->>'description'), ''),
    nullif(btrim(v_payload->>'motivation'), ''),
    nullif(btrim(v_payload->>'quirk'), ''),
    nullif(btrim(v_payload->>'mannerism'), ''),
    nullif(btrim(v_payload->>'voice'), ''),
    nullif(btrim(v_payload->>'secret'), ''),
    nullif(btrim(v_payload->>'affiliation'), ''),
    'alive',
    nullif(btrim(v_payload->>'background'), ''),
    coalesce(v_tags, array['player-character']::text[]),
    'npc', false,
    v_portrait_library_id, v_visual_asset_id, v_creation_request_id,
    v_portrait_url, v_portrait_storage_path, v_portrait_thumb_url, v_portrait_shop_url, v_portrait_source, v_image_url,
    v_sprite_key, v_sprite_path, v_sprite_scale,
    null, null, null, true, 'resting', now()
  ) returning id into v_character_id;

  insert into public.character_sheets(character_id, sheet, updated_at)
  values(v_character_id, v_sheet, now());

  insert into public.character_permissions(character_id, user_id, can_inventory, can_edit, can_convert)
  values(v_character_id, v_user, true, true, false);

  insert into public.character_progression(
    character_id, class_id, class_level, experience_points, pending_level_up, created_by, updated_at
  ) values(
    v_character_id, v_class.id, v_level, v_level_row.xp_threshold, false, v_user, now()
  )
  on conflict (character_id) do update
  set class_id = excluded.class_id,
      class_level = excluded.class_level,
      experience_points = excluded.experience_points,
      pending_level_up = false,
      created_by = coalesce(public.character_progression.created_by, excluded.created_by),
      updated_at = now();

  insert into public.character_level_events(
    character_id, event_type, from_level, to_level, xp_before, xp_after, details, created_by
  ) values(
    v_character_id, 'player_character_created', null, v_level, null, v_level_row.xp_threshold,
    jsonb_build_object(
      'classKey', v_class.class_key,
      'source', v_class.source,
      'ruleset', v_class.ruleset,
      'startingLevel', v_level,
      'startingSpellSelectionPending', v_spell_selection_pending
    ),
    v_user
  );

  for v_choice in select value from jsonb_array_elements(coalesce(p_spell_choices, '[]'::jsonb)) loop
    begin
      v_spell_id := (v_choice->>'spell_id')::uuid;
    exception when others then
      raise exception 'Every spell choice must include a valid spell_id.';
    end;
    if v_spell_id = any(v_seen) then raise exception 'Duplicate spell choices are not allowed.'; end if;
    v_seen := array_append(v_seen, v_spell_id);

    select * into v_spell from public.spells_catalog where id = v_spell_id;
    if v_spell.id is null then raise exception 'A selected spell was not found.' using errcode = 'P0002'; end if;
    if not exists (
      select 1 from unnest(coalesce(v_spell.classes, '{}'::text[])) class_name
      where lower(class_name) = lower(v_class.class_name)
    ) then
      raise exception '% is not on the % class spell list.', v_spell.name, v_class.class_name;
    end if;
    begin v_prepared := coalesce((v_choice->>'prepared')::boolean, false); exception when others then v_prepared := false; end;

    insert into public.character_spells(
      character_id, spell_id, source_type, source_label, prepared, always_available, casting_stat, raw_payload
    ) values(
      v_character_id, v_spell_id, 'class', v_class.class_name,
      case when v_spell.level = 0 then true else v_prepared end,
      v_spell.level = 0,
      v_class.spellcasting_ability,
      jsonb_build_object('grantedAtCreationLevel', v_level, 'creator', 'shared_character_forge_player_v2')
    );
  end loop;

  insert into public.players(user_id, name, sheet, updated_at)
  values(v_user, v_name, v_sheet, now())
  on conflict (user_id) do update
  set sheet = excluded.sheet,
      updated_at = now();

  return v_character_id;
exception
  when unique_violation then
    if v_creation_request_id is not null then
      select c.id into v_character_id
      from public.characters c
      join public.character_permissions cp on cp.character_id = c.id
      where c.creation_request_id = v_creation_request_id
        and cp.user_id = v_user
        and cp.can_edit
      limit 1;
      if found then return v_character_id; end if;
    end if;
    raise;
end;
$$;

revoke all on function public.create_player_character_v2(jsonb, jsonb) from public, anon;
grant execute on function public.create_player_character_v2(jsonb, jsonb) to authenticated;

begin;

create or replace function public.admin_upsert_sprite_asset_v1(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_id uuid;
  v_name text;
  v_bucket text;
  v_path text;
  v_format text;
  v_frame_width integer;
  v_frame_height integer;
  v_direction_order text[];
  v_idle_frame integer;
  v_walk_frames integer[];
  v_fps numeric;
  v_overworld_scale numeric;
  v_tactical_scale numeric;
  v_species_tags text[];
  v_role_tags text[];
  v_theme_tags text[];
  v_notes text;
begin
  perform private.require_character_admin_v1();

  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Sprite asset payload must be an object';
  end if;

  if nullif(btrim(v_payload->>'id'), '') is not null then
    begin v_id := (v_payload->>'id')::uuid;
    exception when invalid_text_representation then raise exception 'Sprite asset id must be a valid UUID'; end;
  else
    v_id := gen_random_uuid();
  end if;

  v_name := btrim(coalesce(v_payload->>'name', ''));
  v_bucket := btrim(coalesce(nullif(v_payload->>'sprite_bucket', ''), 'map-icons'));
  v_path := btrim(coalesce(v_payload->>'sprite_path', ''));
  v_format := lower(btrim(coalesce(nullif(v_payload->>'sprite_format', ''), 'eight_direction_idle_walk_v1')));
  v_frame_width := coalesce(nullif(v_payload->>'frame_width', '')::integer, 64);
  v_frame_height := coalesce(nullif(v_payload->>'frame_height', '')::integer, 64);
  v_idle_frame := coalesce(nullif(v_payload->>'idle_frame', '')::integer, 0);
  v_fps := coalesce(nullif(v_payload->>'fps', '')::numeric, 7);
  v_overworld_scale := coalesce(nullif(v_payload->>'overworld_scale', '')::numeric, 0.35);
  v_tactical_scale := coalesce(nullif(v_payload->>'tactical_scale', '')::numeric, 1.0);
  v_notes := nullif(btrim(coalesce(v_payload->>'notes', '')), '');

  if v_name = '' then raise exception 'Sprite asset name is required'; end if;
  if v_path = '' then raise exception 'Sprite path is required'; end if;
  if v_format <> 'eight_direction_idle_walk_v1' then raise exception 'Unsupported sprite format: %', v_format; end if;
  if v_frame_width <= 0 or v_frame_height <= 0 then raise exception 'Frame dimensions must be positive'; end if;
  if v_idle_frame < 0 then raise exception 'Idle frame must be zero or greater'; end if;
  if v_fps <= 0 then raise exception 'FPS must be positive'; end if;
  if v_overworld_scale <= 0 or v_tactical_scale <= 0 then raise exception 'Sprite scales must be positive'; end if;

  if jsonb_typeof(v_payload->'direction_order') = 'array' then
    select coalesce(array_agg(value order by ordinality), '{}'::text[])
      into v_direction_order
    from jsonb_array_elements_text(v_payload->'direction_order') with ordinality;
  else
    v_direction_order := array['down','down-left','left','up-left','up','up-right','right','down-right']::text[];
  end if;

  if v_direction_order <> array['down','down-left','left','up-left','up','up-right','right','down-right']::text[] then
    raise exception 'Direction order must use the DNDNext eight-direction standard';
  end if;

  if jsonb_typeof(v_payload->'walk_frames') = 'array' then
    select coalesce(array_agg(value::integer order by ordinality), '{}'::integer[])
      into v_walk_frames
    from jsonb_array_elements_text(v_payload->'walk_frames') with ordinality;
  else
    v_walk_frames := array[1,2,3]::integer[];
  end if;

  if v_walk_frames <> array[1,2,3]::integer[] then
    raise exception 'Walk frames must use the DNDNext [1,2,3] production cycle';
  end if;

  select coalesce(array_agg(distinct lower(btrim(value)) order by lower(btrim(value))), '{}'::text[])
    into v_species_tags
  from jsonb_array_elements_text(case when jsonb_typeof(v_payload->'species_tags') = 'array' then v_payload->'species_tags' else '[]'::jsonb end)
  where btrim(value) <> '';

  select coalesce(array_agg(distinct lower(btrim(value)) order by lower(btrim(value))), '{}'::text[])
    into v_role_tags
  from jsonb_array_elements_text(case when jsonb_typeof(v_payload->'role_tags') = 'array' then v_payload->'role_tags' else '[]'::jsonb end)
  where btrim(value) <> '';

  select coalesce(array_agg(distinct lower(btrim(value)) order by lower(btrim(value))), '{}'::text[])
    into v_theme_tags
  from jsonb_array_elements_text(case when jsonb_typeof(v_payload->'theme_tags') = 'array' then v_payload->'theme_tags' else '[]'::jsonb end)
  where btrim(value) <> '';

  insert into public.npc_visual_assets (
    id, portrait_library_id, name, sprite_bucket, sprite_path, sprite_format,
    frame_width, frame_height, direction_order, idle_frame, walk_frames, fps,
    default_scale, overworld_scale, tactical_scale, species_tags, role_tags,
    theme_tags, is_default, is_active, notes, updated_at
  ) values (
    v_id, null, v_name, v_bucket, v_path, v_format,
    v_frame_width, v_frame_height, v_direction_order, v_idle_frame, v_walk_frames, v_fps,
    v_overworld_scale, v_overworld_scale, v_tactical_scale, v_species_tags, v_role_tags,
    v_theme_tags, false, coalesce((v_payload->>'is_active')::boolean, true), v_notes, now()
  )
  on conflict (id) do update set
    portrait_library_id = null,
    name = excluded.name,
    sprite_bucket = excluded.sprite_bucket,
    sprite_path = excluded.sprite_path,
    sprite_format = excluded.sprite_format,
    frame_width = excluded.frame_width,
    frame_height = excluded.frame_height,
    direction_order = excluded.direction_order,
    idle_frame = excluded.idle_frame,
    walk_frames = excluded.walk_frames,
    fps = excluded.fps,
    default_scale = excluded.default_scale,
    overworld_scale = excluded.overworld_scale,
    tactical_scale = excluded.tactical_scale,
    species_tags = excluded.species_tags,
    role_tags = excluded.role_tags,
    theme_tags = excluded.theme_tags,
    is_default = false,
    is_active = excluded.is_active,
    notes = excluded.notes,
    updated_at = now();

  return v_id;
end;
$function$;

create or replace function public.admin_archive_sprite_asset_v1(p_visual_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
begin
  perform private.require_character_admin_v1();
  if p_visual_asset_id is null then raise exception 'Missing sprite asset id'; end if;
  update public.npc_visual_assets set is_active = false, updated_at = now() where id = p_visual_asset_id;
  if not found then raise exception 'Sprite asset not found'; end if;
end;
$function$;

create or replace function public.admin_set_portrait_sprite_suggestion_v1(
  p_portrait_library_id uuid,
  p_visual_asset_id uuid,
  p_suggestion_rank integer default 100,
  p_is_primary boolean default false,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
begin
  perform private.require_character_admin_v1();
  if p_portrait_library_id is null or p_visual_asset_id is null then raise exception 'Portrait and sprite are required'; end if;
  if not exists (select 1 from public.npc_portrait_library where id = p_portrait_library_id and is_active) then raise exception 'Portrait not found or inactive'; end if;
  if not exists (select 1 from public.npc_visual_assets where id = p_visual_asset_id and is_active) then raise exception 'Sprite not found or inactive'; end if;
  if coalesce(p_suggestion_rank, 0) <= 0 then raise exception 'Suggestion rank must be positive'; end if;

  if coalesce(p_is_primary, false) then
    update public.portrait_sprite_suggestions
    set is_primary = false, updated_at = now()
    where portrait_library_id = p_portrait_library_id
      and visual_asset_id <> p_visual_asset_id
      and is_primary;
  end if;

  insert into public.portrait_sprite_suggestions (
    portrait_library_id, visual_asset_id, suggestion_rank, is_primary, notes, updated_at
  ) values (
    p_portrait_library_id, p_visual_asset_id, p_suggestion_rank, coalesce(p_is_primary, false), nullif(btrim(coalesce(p_notes, '')), ''), now()
  )
  on conflict (portrait_library_id, visual_asset_id) do update set
    suggestion_rank = excluded.suggestion_rank,
    is_primary = excluded.is_primary,
    notes = excluded.notes,
    updated_at = now();
end;
$function$;

create or replace function public.admin_remove_portrait_sprite_suggestion_v1(
  p_portrait_library_id uuid,
  p_visual_asset_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
begin
  perform private.require_character_admin_v1();
  delete from public.portrait_sprite_suggestions
  where portrait_library_id = p_portrait_library_id
    and visual_asset_id = p_visual_asset_id;
end;
$function$;

revoke all on function public.admin_upsert_sprite_asset_v1(jsonb) from public, anon;
revoke all on function public.admin_archive_sprite_asset_v1(uuid) from public, anon;
revoke all on function public.admin_set_portrait_sprite_suggestion_v1(uuid, uuid, integer, boolean, text) from public, anon;
revoke all on function public.admin_remove_portrait_sprite_suggestion_v1(uuid, uuid) from public, anon;

grant execute on function public.admin_upsert_sprite_asset_v1(jsonb) to authenticated, service_role;
grant execute on function public.admin_archive_sprite_asset_v1(uuid) to authenticated, service_role;
grant execute on function public.admin_set_portrait_sprite_suggestion_v1(uuid, uuid, integer, boolean, text) to authenticated, service_role;
grant execute on function public.admin_remove_portrait_sprite_suggestion_v1(uuid, uuid) to authenticated, service_role;

do $postconditions$
begin
  if has_function_privilege('anon', 'public.admin_upsert_sprite_asset_v1(jsonb)', 'EXECUTE') then
    raise exception 'anon must not execute sprite asset admin RPC';
  end if;
  if has_function_privilege('anon', 'public.admin_set_portrait_sprite_suggestion_v1(uuid,uuid,integer,boolean,text)', 'EXECUTE') then
    raise exception 'anon must not execute sprite suggestion admin RPC';
  end if;
end
$postconditions$;

commit;

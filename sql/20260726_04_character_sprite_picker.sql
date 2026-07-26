begin;

create or replace function public.set_character_visual_asset_v1(
  p_character_id uuid,
  p_visual_asset_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_asset public.npc_visual_assets%rowtype;
  v_visual jsonb := 'null'::jsonb;
begin
  if p_character_id is null then raise exception 'Missing character id'; end if;
  if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then raise exception 'Not authenticated'; end if;

  if coalesce(auth.role(), '') = 'service_role' then
    v_is_admin := true;
  else
    select public.is_admin(v_uid) into v_is_admin;
  end if;

  if not coalesce(v_is_admin, false) then
    select coalesce(cp.can_edit, false)
      into v_can_edit
    from public.character_permissions cp
    where cp.character_id = p_character_id
      and cp.user_id = v_uid
    limit 1;

    if not coalesce(v_can_edit, false) then
      raise exception 'Not authorized to change this character sprite';
    end if;
  end if;

  if not exists (select 1 from public.characters where id = p_character_id) then
    raise exception 'Character not found';
  end if;

  if p_visual_asset_id is not null then
    select * into v_asset
    from public.npc_visual_assets
    where id = p_visual_asset_id
      and is_active;

    if not found then raise exception 'Selected sprite is not active or was not found'; end if;

    v_visual := jsonb_build_object(
      'id', v_asset.id,
      'spritePath', v_asset.sprite_path,
      'spriteBucket', v_asset.sprite_bucket,
      'format', v_asset.sprite_format,
      'frameWidth', v_asset.frame_width,
      'frameHeight', v_asset.frame_height,
      'directionOrder', to_jsonb(v_asset.direction_order),
      'idleFrame', v_asset.idle_frame,
      'walkFrames', to_jsonb(v_asset.walk_frames),
      'fps', v_asset.fps,
      'defaultScale', v_asset.default_scale,
      'overworldScale', v_asset.overworld_scale,
      'tacticalScale', v_asset.tactical_scale
    );
  end if;

  -- The existing character trigger remains the compatibility boundary for sprite_path.
  -- Until the world renderer migration lands, rich 8-direction assets remain selected via
  -- visual_asset_id while legacy sprite_path stays NULL unless a compatibility path exists.
  update public.characters
  set
    visual_asset_id = p_visual_asset_id,
    sprite_key = case when p_visual_asset_id is null then null else sprite_key end,
    sprite_path = case when p_visual_asset_id is null then null else sprite_path end,
    sprite_scale = case when p_visual_asset_id is null then null else sprite_scale end,
    updated_at = timezone('utc', now())
  where id = p_character_id;

  insert into public.character_sheets (character_id, sheet, updated_at)
  values (
    p_character_id,
    jsonb_build_object('visualAsset', v_visual),
    timezone('utc', now())
  )
  on conflict (character_id) do update
  set
    sheet = jsonb_set(coalesce(public.character_sheets.sheet, '{}'::jsonb), '{visualAsset}', v_visual, true),
    updated_at = timezone('utc', now());
end;
$function$;

revoke all on function public.set_character_visual_asset_v1(uuid, uuid) from public, anon;
grant execute on function public.set_character_visual_asset_v1(uuid, uuid) to authenticated, service_role;

do $postconditions$
begin
  if has_function_privilege('anon', 'public.set_character_visual_asset_v1(uuid,uuid)', 'EXECUTE') then
    raise exception 'anon must not execute character sprite picker RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.set_character_visual_asset_v1(uuid,uuid)', 'EXECUTE') then
    raise exception 'authenticated must be able to call character sprite picker RPC';
  end if;
end
$postconditions$;

commit;

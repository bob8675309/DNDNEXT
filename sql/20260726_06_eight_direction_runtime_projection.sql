begin;

-- Phase 0 runtime cutover: rich visual assets are now safe to project into the
-- existing character sprite compatibility columns because the world renderer
-- will distinguish rich visual_asset_id rows from legacy raw sprite_path rows.
-- Existing legacy rows remain untouched until approved 8-direction replacements
-- are assigned, so this migration does not remove any current map presence.

do $preconditions$
begin
  if exists (
    select 1
    from public.npc_visual_assets a
    where a.is_active
      and (
        coalesce(a.sprite_format, '') <> 'eight_direction_idle_walk_v1'
        or coalesce(a.sprite_bucket, '') <> 'map-icons'
        or coalesce(a.frame_width, 0) <> 64
        or coalesce(a.frame_height, 0) <> 64
        or coalesce(a.direction_order, '{}'::text[]) <> array['down','down-left','left','up-left','up','up-right','right','down-right']::text[]
        or coalesce(a.idle_frame, -1) <> 0
        or coalesce(a.walk_frames, '{}'::integer[]) <> array[1,2,3]::integer[]
        or coalesce(a.fps, 0) <> 7
      )
  ) then
    raise exception 'Active sprite assets must satisfy the DNDNext 8-direction runtime contract before cutover';
  end if;
end
$preconditions$;

alter table public.npc_visual_assets
  drop constraint if exists npc_visual_assets_runtime_contract_ck;

alter table public.npc_visual_assets
  add constraint npc_visual_assets_runtime_contract_ck check (
    not coalesce(is_active, true)
    or (
      sprite_format = 'eight_direction_idle_walk_v1'
      and sprite_bucket = 'map-icons'
      and frame_width = 64
      and frame_height = 64
      and direction_order = array['down','down-left','left','up-left','up','up-right','right','down-right']::text[]
      and idle_frame = 0
      and walk_frames = array[1,2,3]::integer[]
      and fps = 7
    )
  );

create or replace function private.guard_character_visual_asset_sprite_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_asset public.npc_visual_assets%rowtype;
begin
  if new.visual_asset_id is null then
    return new;
  end if;

  select * into v_asset
  from public.npc_visual_assets
  where id = new.visual_asset_id
    and is_active;

  if not found then
    raise exception 'Selected sprite asset is not active or was not found';
  end if;

  if v_asset.sprite_format <> 'eight_direction_idle_walk_v1'
     or v_asset.sprite_bucket <> 'map-icons'
     or v_asset.frame_width <> 64
     or v_asset.frame_height <> 64
     or v_asset.direction_order <> array['down','down-left','left','up-left','up','up-right','right','down-right']::text[]
     or v_asset.idle_frame <> 0
     or v_asset.walk_frames <> array[1,2,3]::integer[]
     or v_asset.fps <> 7 then
    raise exception 'Selected sprite asset does not satisfy the DNDNext 8-direction runtime contract';
  end if;

  new.sprite_key := v_asset.id::text;
  new.sprite_path := v_asset.sprite_path;
  new.sprite_scale := coalesce(v_asset.overworld_scale::double precision, v_asset.default_scale::double precision, 0.35);
  return new;
end;
$function$;

revoke all on function private.guard_character_visual_asset_sprite_v1() from public, anon, authenticated;
grant execute on function private.guard_character_visual_asset_sprite_v1() to service_role;

-- Re-project any already-associated rich assets through the updated trigger.
-- Legacy raw sprite rows (visual_asset_id IS NULL) are intentionally untouched.
update public.characters
set visual_asset_id = visual_asset_id,
    updated_at = updated_at
where visual_asset_id is not null;

do $postconditions$
begin
  if exists (
    select 1
    from public.characters c
    join public.npc_visual_assets a on a.id = c.visual_asset_id
    where c.visual_asset_id is not null
      and (
        c.sprite_key is distinct from a.id::text
        or c.sprite_path is distinct from a.sprite_path
        or abs(coalesce(c.sprite_scale, 0)::numeric - coalesce(a.overworld_scale, a.default_scale, 0.35)::numeric) > 0.000001
      )
  ) then
    raise exception 'Rich character sprite projection postcondition failed';
  end if;

  if exists (
    select 1
    from public.npc_visual_assets a
    where a.is_active
      and (
        a.sprite_format <> 'eight_direction_idle_walk_v1'
        or a.sprite_bucket <> 'map-icons'
        or a.frame_width <> 64
        or a.frame_height <> 64
        or a.direction_order <> array['down','down-left','left','up-left','up','up-right','right','down-right']::text[]
        or a.idle_frame <> 0
        or a.walk_frames <> array[1,2,3]::integer[]
        or a.fps <> 7
      )
  ) then
    raise exception 'Active sprite runtime contract postcondition failed';
  end if;
end
$postconditions$;

commit;

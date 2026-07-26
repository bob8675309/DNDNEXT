begin;

alter table public.npc_visual_assets
  add column if not exists legacy_sprite_path text;

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
  where id = new.visual_asset_id;

  if not found then
    return new;
  end if;

  new.sprite_key := v_asset.id::text;
  new.sprite_scale := coalesce(v_asset.default_scale::double precision, new.sprite_scale);

  -- Existing MapPageClient remains fixed at 32x32, 4 rows (down/left/right/up),
  -- and three walk frames. A rich 8-direction master may therefore provide a
  -- generated compatibility derivative without changing movement/render logic.
  if v_asset.sprite_format = 'legacy_4dir_3frame_32' then
    new.sprite_path := v_asset.sprite_path;
  elsif nullif(btrim(v_asset.legacy_sprite_path), '') is not null then
    new.sprite_path := v_asset.legacy_sprite_path;
  else
    new.sprite_path := null;
  end if;

  return new;
end;
$function$;

commit;

begin;

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

  -- MapPageClient currently slices legacy sheets as 32x32, 3 columns, and the
  -- rows down/left/right/up. Rich portrait-linked assets stay associated through
  -- visual_asset_id but are not copied into sprite_path until that renderer opts in.
  if v_asset.sprite_format = 'legacy_4dir_3frame_32' then
    new.sprite_path := v_asset.sprite_path;
  else
    new.sprite_path := null;
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_character_visual_asset_sprite_v1() from public, anon, authenticated;
grant execute on function private.guard_character_visual_asset_sprite_v1() to service_role;

drop trigger if exists guard_character_visual_asset_sprite_v1 on public.characters;
create trigger guard_character_visual_asset_sprite_v1
before insert or update of visual_asset_id on public.characters
for each row execute function private.guard_character_visual_asset_sprite_v1();

commit;

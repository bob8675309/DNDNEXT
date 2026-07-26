begin;

-- The existing create_character_v1 RPC still contains compatibility logic that compares
-- npc_visual_assets.portrait_library_id with the selected portrait. Keep the column for
-- function/rowtype compatibility, but deliberately retire it as a relationship field.
-- portrait_sprite_suggestions is now the sole portrait<->sprite recommendation layer.
update public.npc_visual_assets
set portrait_library_id = null
where portrait_library_id is not null;

drop index if exists public.npc_visual_assets_one_default_per_portrait_idx;

alter table public.npc_visual_assets
  drop constraint if exists npc_visual_assets_portrait_link_unused_ck;

alter table public.npc_visual_assets
  add constraint npc_visual_assets_portrait_link_unused_ck
  check (portrait_library_id is null);

comment on column public.npc_visual_assets.portrait_library_id is
  'Deprecated compatibility field retained for create_character_v1 rowtype compatibility. Must remain NULL. Use portrait_sprite_suggestions for optional curated matches.';

do $postconditions$
declare
  v_non_null bigint;
begin
  select count(*) into v_non_null
  from public.npc_visual_assets
  where portrait_library_id is not null;

  if v_non_null <> 0 then
    raise exception 'Sprite registry still contains forced portrait links';
  end if;

  if to_regclass('public.portrait_sprite_suggestions') is null then
    raise exception 'portrait_sprite_suggestions must exist before enforcing independence';
  end if;
end
$postconditions$;

commit;

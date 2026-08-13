-- Character Forge PR A: remove SVG portrait records and make player tags server-authoritative.

-- No live character, visual asset, or suggestion references existed at audit time.
delete from public.npc_portrait_library
where lower(coalesce(public_url, '')) ~ '\.svg([?#].*)?$'
   or lower(coalesce(storage_path, '')) ~ '\.svg([?#].*)?$';

alter table public.npc_portrait_library
  drop constraint if exists npc_portrait_library_no_svg_v1;

alter table public.npc_portrait_library
  add constraint npc_portrait_library_no_svg_v1
  check (
    lower(coalesce(public_url, '')) !~ '\.svg([?#].*)?$'
    and lower(coalesce(storage_path, '')) !~ '\.svg([?#].*)?$'
  );

create or replace function private.player_character_tag_slug_v1(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select nullif(trim(both '-' from regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g')), '');
$$;

create or replace function private.derive_player_character_tags_v1(
  p_sheet jsonb,
  p_existing_tags text[] default '{}'::text[],
  p_preserve_campaign_tags boolean default true
)
returns text[]
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sheet jsonb := coalesce(p_sheet, '{}'::jsonb);
  v_tags text[] := '{}'::text[];
  v_species text;
  v_class text;
  v_background text;
  v_profession record;
begin
  if p_preserve_campaign_tags then
    select coalesce(array_agg(distinct lower(btrim(tag)) order by lower(btrim(tag))), '{}'::text[])
      into v_tags
    from unnest(coalesce(p_existing_tags, '{}'::text[])) as tag
    where btrim(tag) <> ''
      and lower(btrim(tag)) <> 'player-character'
      and lower(btrim(tag)) !~ '^(species|class|background|profession):';
  end if;

  v_tags := array_append(v_tags, 'player-character');
  v_species := private.player_character_tag_slug_v1(coalesce(v_sheet #>> '{meta,speciesKey}', v_sheet->>'species', v_sheet->>'race'));
  v_class := private.player_character_tag_slug_v1(coalesce(v_sheet #>> '{meta,classKey}', v_sheet->>'classKey', v_sheet->>'className', v_sheet->>'class'));
  v_background := private.player_character_tag_slug_v1(coalesce(v_sheet #>> '{meta,backgroundKey}', v_sheet->>'background'));

  if v_species is not null then v_tags := array_append(v_tags, 'species:' || v_species); end if;
  if v_class is not null then v_tags := array_append(v_tags, 'class:' || v_class); end if;
  if v_background is not null then v_tags := array_append(v_tags, 'background:' || v_background); end if;

  if jsonb_typeof(v_sheet->'professions') = 'object' then
    for v_profession in
      select key, value
      from jsonb_each(v_sheet->'professions')
    loop
      if coalesce(v_profession.value->>'rank', '') ~ '^[0-9]+$'
         and (v_profession.value->>'rank')::integer > 0 then
        v_tags := array_append(v_tags, 'profession:' || private.player_character_tag_slug_v1(v_profession.key));
      end if;
    end loop;
  end if;

  return (
    select coalesce(array_agg(distinct tag order by tag), '{}'::text[])
    from unnest(v_tags) as tag
    where tag is not null and btrim(tag) <> ''
  );
end;
$$;

create or replace function private.sync_player_character_tags_from_sheet_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_existing text[];
begin
  select c.tags into v_existing
  from public.characters c
  where c.id = new.character_id
    and 'player-character' = any(coalesce(c.tags, '{}'::text[]));

  if not found then return new; end if;

  update public.characters
  set tags = private.derive_player_character_tags_v1(
    new.sheet,
    v_existing,
    tg_op = 'UPDATE'
  )
  where id = new.character_id;

  return new;
end;
$$;

create or replace function private.guard_player_character_tag_update_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
begin
  if new.tags is distinct from old.tags
     and 'player-character' = any(coalesce(old.tags, '{}'::text[]))
     and pg_trigger_depth() = 1
     and auth.uid() is not null
     and not private.current_user_is_admin() then
    raise exception 'Player character tags are managed by campaign authority.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists character_sheets_sync_player_tags_v1 on public.character_sheets;
create trigger character_sheets_sync_player_tags_v1
after insert or update of sheet on public.character_sheets
for each row execute function private.sync_player_character_tags_from_sheet_v1();

drop trigger if exists characters_guard_player_tags_v1 on public.characters;
create trigger characters_guard_player_tags_v1
before update of tags on public.characters
for each row execute function private.guard_player_character_tag_update_v1();

-- Reconcile existing player characters while preserving any non-system campaign tags.
update public.characters c
set tags = private.derive_player_character_tags_v1(cs.sheet, c.tags, true)
from public.character_sheets cs
where cs.character_id = c.id
  and 'player-character' = any(coalesce(c.tags, '{}'::text[]));

revoke all on function private.player_character_tag_slug_v1(text) from public;
revoke all on function private.derive_player_character_tags_v1(jsonb, text[], boolean) from public;
revoke all on function private.sync_player_character_tags_from_sheet_v1() from public;
revoke all on function private.guard_player_character_tag_update_v1() from public;

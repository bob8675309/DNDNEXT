begin;

create or replace function private.sync_character_portrait_library_id_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_match uuid;
begin
  if lower(coalesce(new.portrait_source, '')) <> 'library' then
    new.portrait_library_id := null;
    return new;
  end if;

  select p.id into v_match
  from public.npc_portrait_library p
  where p.is_active
    and (
      (nullif(btrim(coalesce(new.portrait_storage_path, '')), '') is not null and p.storage_path = new.portrait_storage_path)
      or
      (nullif(btrim(coalesce(new.portrait_url, '')), '') is not null and p.public_url = new.portrait_url)
    )
  order by case when p.storage_path = new.portrait_storage_path then 0 else 1 end, p.sort_order, p.name
  limit 1;

  new.portrait_library_id := v_match;
  return new;
end;
$function$;

drop trigger if exists sync_character_portrait_library_id_v1 on public.characters;
create trigger sync_character_portrait_library_id_v1
before insert or update of portrait_storage_path, portrait_url, portrait_source
on public.characters
for each row
execute function private.sync_character_portrait_library_id_v1();

-- Backfill existing library-sourced portraits when the current path/url resolves unambiguously.
update public.characters c
set portrait_library_id = p.id
from lateral (
  select pl.id
  from public.npc_portrait_library pl
  where pl.is_active
    and (
      (nullif(btrim(coalesce(c.portrait_storage_path, '')), '') is not null and pl.storage_path = c.portrait_storage_path)
      or
      (nullif(btrim(coalesce(c.portrait_url, '')), '') is not null and pl.public_url = c.portrait_url)
    )
  order by case when pl.storage_path = c.portrait_storage_path then 0 else 1 end, pl.sort_order, pl.name
  limit 1
) p
where lower(coalesce(c.portrait_source, '')) = 'library'
  and c.portrait_library_id is distinct from p.id;

commit;

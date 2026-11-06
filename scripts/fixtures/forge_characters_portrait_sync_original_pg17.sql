-- Original deployed PG17 source, read-only verified 2026-11-05.
-- md5(pg_get_functiondef) = 74cb0bf9d7a614a860344f12cf787e05
-- DISPOSABLE PG17 acceptance fixture only, NOT a production migration.
CREATE OR REPLACE FUNCTION private.sync_character_portrait_library_id_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
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

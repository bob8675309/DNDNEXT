-- Preserve the legacy Mog delete guard while allowing an explicit, session-local
-- maintenance override for controlled database resets.
create or replace function private.protect_mog_delete_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if current_setting('app.allow_delete_mog', true) = 'on' then
    return old;
  end if;

  if old.id = 'c0a40081-9bab-402d-8437-62267e596c4f'::uuid
     or lower(btrim(old.name)) = 'mog' then
    raise exception 'Mog is protected and cannot be deleted' using errcode = '42501';
  end if;

  return old;
end;
$$;

comment on function private.protect_mog_delete_v1()
is 'Protects Mog from ordinary deletes. Set app.allow_delete_mog=on locally in an explicit maintenance transaction to permit a controlled delete.';

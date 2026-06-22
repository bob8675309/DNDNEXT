-- Character portrait picker support.
-- Allows admins and users with character_permissions.can_edit to change a character portrait.
-- Does not change schemas or policies.

create or replace function public.set_character_portrait_v1(
  p_character_id uuid,
  p_storage_path text default null,
  p_url text default null,
  p_thumb_url text default null,
  p_shop_url text default null,
  p_source text default 'library'
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_can_edit boolean := false;
  v_source text := coalesce(nullif(trim(p_source), ''), 'library');
begin
  if p_character_id is null then
    raise exception 'Missing character id';
  end if;

  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select public.is_admin(v_uid) into v_is_admin;

  if not coalesce(v_is_admin, false) then
    select coalesce(cp.can_edit, false)
      into v_can_edit
    from public.character_permissions cp
    where cp.character_id = p_character_id
      and cp.user_id = v_uid
    limit 1;

    if not coalesce(v_can_edit, false) then
      raise exception 'Not authorized to change this character portrait';
    end if;
  end if;

  if v_source not in ('library', 'upload', 'default', 'external', 'generated') then
    v_source := 'library';
  end if;

  update public.characters
  set
    portrait_storage_path = nullif(trim(coalesce(p_storage_path, '')), ''),
    portrait_url = nullif(trim(coalesce(p_url, '')), ''),
    portrait_thumb_url = nullif(trim(coalesce(p_thumb_url, p_url, '')), ''),
    portrait_shop_url = nullif(trim(coalesce(p_shop_url, p_url, '')), ''),
    portrait_source = v_source,
    image_url = nullif(trim(coalesce(p_shop_url, p_url, '')), ''),
    updated_at = timezone('utc', now())
  where id = p_character_id;

  if not found then
    raise exception 'Character not found';
  end if;

  insert into public.character_sheets (character_id, sheet, updated_at)
  values (
    p_character_id,
    jsonb_build_object(
      'portrait', jsonb_build_object(
        'url', nullif(trim(coalesce(p_url, '')), ''),
        'storagePath', nullif(trim(coalesce(p_storage_path, '')), ''),
        'thumbUrl', nullif(trim(coalesce(p_thumb_url, p_url, '')), ''),
        'shopUrl', nullif(trim(coalesce(p_shop_url, p_url, '')), ''),
        'source', v_source,
        'recommendedMasterSize', '1536x2048',
        'aspectRatio', '3:4'
      )
    ),
    timezone('utc', now())
  )
  on conflict (character_id) do update
  set
    sheet = coalesce(public.character_sheets.sheet, '{}'::jsonb) || jsonb_build_object(
      'portrait', jsonb_build_object(
        'url', nullif(trim(coalesce(p_url, '')), ''),
        'storagePath', nullif(trim(coalesce(p_storage_path, '')), ''),
        'thumbUrl', nullif(trim(coalesce(p_thumb_url, p_url, '')), ''),
        'shopUrl', nullif(trim(coalesce(p_shop_url, p_url, '')), ''),
        'source', v_source,
        'recommendedMasterSize', '1536x2048',
        'aspectRatio', '3:4'
      )
    ),
    updated_at = timezone('utc', now());
end;
$$;

grant execute on function public.set_character_portrait_v1(uuid, text, text, text, text, text) to authenticated;

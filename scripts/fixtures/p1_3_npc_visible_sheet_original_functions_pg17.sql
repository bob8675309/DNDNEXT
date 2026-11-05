-- Exact DnDWeb live function definitions captured SELECT-only 2026-11-04.
-- Install ONLY in disposable local PG17 fixture. Never replay in production.
-- private.can_access_character_v1 md5(pg_get_functiondef)=97b5e6b059e6467e24c4283fe420c83e
CREATE OR REPLACE FUNCTION private.can_access_character_v1(p_character_id uuid, p_permission text DEFAULT 'read'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select
    private.current_user_is_admin()
    or exists (
      select 1
      from public.character_permissions cp
      where cp.character_id = p_character_id
        and cp.user_id = auth.uid()
        and case lower(coalesce(p_permission, 'read'))
          when 'inventory' then cp.can_inventory or cp.can_edit
          when 'convert' then cp.can_convert or cp.can_edit
          when 'edit' then cp.can_edit
          else cp.can_inventory or cp.can_edit or cp.can_convert
        end
    );
$function$;

-- public.get_my_player_characters_v2 md5(pg_get_functiondef)=deca87aaad0dce214743c87cdca03f36
CREATE OR REPLACE FUNCTION public.get_my_player_characters_v2()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select coalesce(jsonb_agg(
    to_jsonb(c)
    || jsonb_build_object(
      'character_sheet', coalesce(cs.sheet, '{}'::jsonb),
      'permission', to_jsonb(cp)
    )
    order by cp.created_at asc, c.name asc
  ), '[]'::jsonb)
  from public.character_permissions cp
  join public.characters c on c.id = cp.character_id
  left join public.character_sheets cs on cs.character_id = c.id
  where cp.user_id = auth.uid()
    and (cp.can_edit or cp.can_inventory or cp.can_convert)
    and 'player-character' = any(coalesce(c.tags, '{}'::text[]));
$function$;

-- get_character_secrets_v1 source MD5=2f28c77dcda18aed1c654515b26ec438; exact 2026-11-04 live function text
CREATE OR REPLACE FUNCTION public.get_character_secrets_v1(p_character_ids uuid[])
 RETURNS TABLE(character_id uuid, secret text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select c.id, c.secret
  from public.characters c
  where c.id = any(coalesce(p_character_ids, '{}'::uuid[]))
    and private.can_access_character_v1(c.id, 'edit');
$function$;

-- get_my_player_character_v1 source MD5=b6049deb0b4d59daf15d7dd6e8ac1079; exact 2026-11-04 live function text
CREATE OR REPLACE FUNCTION public.get_my_player_character_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_user uuid := auth.uid();
  v_character public.characters%rowtype;
  v_sheet jsonb;
  v_permission public.character_permissions%rowtype;
begin
  if v_user is null then
    raise exception 'Sign in is required.' using errcode = '42501';
  end if;

  select cp.* into v_permission
  from public.character_permissions cp
  join public.characters c on c.id = cp.character_id
  where cp.user_id = v_user
    and cp.can_edit
    and 'player-character' = any(coalesce(c.tags,'{}'::text[]))
  order by cp.created_at asc
  limit 1;

  if v_permission.character_id is null then return null; end if;

  select * into v_character from public.characters where id = v_permission.character_id;
  select sheet into v_sheet from public.character_sheets where character_id = v_permission.character_id;

  return to_jsonb(v_character)
    || jsonb_build_object(
      'character_sheet', coalesce(v_sheet,'{}'::jsonb),
      'permission', to_jsonb(v_permission)
    );
end;
$function$;

-- set_character_secret_v1 source MD5=13bdb65758552362bc7049b65131c9aa; exact 2026-11-04 live function text
CREATE OR REPLACE FUNCTION public.set_character_secret_v1(p_character_id uuid, p_secret text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
begin
  if auth.uid() is null or not private.can_access_character_v1(p_character_id, 'edit') then
    raise exception 'Not authorized to edit this character secret' using errcode = '42501';
  end if;

  update public.characters
  set secret = nullif(btrim(p_secret), ''), updated_at = timezone('utc', now())
  where id = p_character_id;

  if not found then
    raise exception 'Character not found' using errcode = 'P0002';
  end if;
end;
$function$;

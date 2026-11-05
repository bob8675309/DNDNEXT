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

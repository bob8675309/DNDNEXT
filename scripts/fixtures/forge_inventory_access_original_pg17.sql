-- Exact private.can_access_character_v1 read-only source from DnDWeb PG17, 2026-11-05.
-- No mutation to live. Disposable J85+ current-permission policy test only.
-- MD5 pg_get_functiondef = 97b5e6b059e6467e24c4283fe420c83e
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

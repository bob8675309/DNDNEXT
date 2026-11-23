-- DO NOT APPLY TO HOSTED DNDNEXT. Reduced temporary PG17/GoTrue/PostgREST fixture ONLY.
-- Selected source-exact function bodies, not full Stage1/2/3 migrations.
-- From held PR #345 SQL Stage2 blob afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac
-- Stage3 blob 01e48823ac3a46aa5880e98200e97c2595501ce7
-- Original access helper blob 9c479d3f044268f73da3a5515d229096ce03f94a

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

CREATE OR REPLACE FUNCTION public.get_npc_dossier_admin_v1(p_character_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $fn$
DECLARE v_dossier jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.current_user_is_admin() THEN
  RAISE EXCEPTION 'GM-only NPC dossier access denied' USING errcode='42501';
 END IF;

 SELECT to_jsonb(c)
  || jsonb_build_object(
    'character_sheet',coalesce(cs.sheet,'{}'::jsonb)
  )
 INTO v_dossier
 FROM public.characters c
 LEFT JOIN public.character_sheets cs ON cs.character_id=c.id
 WHERE c.id=p_character_id;

 RETURN v_dossier;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_character_editor_narrative_v1(p_character_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $fn$
  SELECT jsonb_build_object(
    'id',c.id,
    'background',c.background,
    'motivation',c.motivation,
    'quirk',c.quirk,
    'mannerism',c.mannerism,
    'voice',c.voice
  )
  FROM public.characters c
  WHERE c.id=p_character_id
    AND auth.uid() IS NOT NULL
    AND private.can_access_character_v1(c.id,'edit');
$fn$;

CREATE OR REPLACE FUNCTION private.can_access_creator_backstory_v1(p_character_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $access$
 SELECT auth.uid() IS NOT NULL AND (
   private.current_user_is_admin()
   OR (
     private.can_access_character_v1(p_character_id,'edit')
     AND EXISTS (
       SELECT 1 FROM private.character_creator_attribution attr
       WHERE attr.character_id=p_character_id
         AND attr.creator_user_id=auth.uid()
     )
   )
 );
$access$;

CREATE OR REPLACE FUNCTION public.can_edit_creator_backstory_v1(p_character_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'pg_catalog','public','private','auth'
AS $can$
 SELECT auth.uid() IS NOT NULL
    AND private.can_access_creator_backstory_v1(p_character_id);
$can$;

REVOKE ALL ON FUNCTION public.get_npc_dossier_admin_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_npc_dossier_admin_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_character_editor_narrative_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_character_editor_narrative_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.can_access_creator_backstory_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_access_creator_backstory_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.can_edit_creator_backstory_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_edit_creator_backstory_v1(uuid) TO authenticated;

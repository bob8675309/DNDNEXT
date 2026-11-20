-- DNDNext T46-P3-P3A NONMAP RESEARCH ONLY, NEVER production migration.
-- Requires source-original #345 Stage1->2->3, T46 source-derived GM aliases,
-- and source-exact private.can_access_character_v1. Signed current auth.uid only.
-- This projection intentionally never serializes canonical character_sheets.
BEGIN;
DO $preflight$
BEGIN
 IF current_database() <> 'postgres'
   OR current_setting('server_version_num')::int < 170000
   OR to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NULL
   OR to_regprocedure('public.get_npc_dossier_admin_v1(uuid)') IS NULL
   OR to_regprocedure('private.can_access_character_v1(uuid,text)') IS NULL
   OR to_regprocedure('private.current_user_is_admin()') IS NULL
   OR to_regclass('public.user_profiles') IS NULL
 THEN RAISE EXCEPTION 'T46-P3-P3 requires disposable local original staged PG17/auth source'; END IF;
END $preflight$;

-- GM gets existing full character metadata but NEVER a canonical Sheet. The
-- player roster uses the exact original #345 server-filtered public Profile.
-- Inventory-only/convert-only permissions cannot open hidden NPC records.
CREATE OR REPLACE FUNCTION public.c34_t46_get_npc_manager_roster_v1()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $npc_roster$
SELECT coalesce(
 jsonb_agg(
   CASE WHEN private.current_user_is_admin()
     THEN to_jsonb(c)
     ELSE public.get_npc_profile_visible_v1(c.id)
   END
   ORDER BY c.name,c.id
 ),'[]'::jsonb
)
FROM public.characters c
WHERE auth.uid() IS NOT NULL
 AND auth.role()='authenticated'
 AND c.kind IN ('npc','merchant')
 AND (
  NOT coalesce(c.is_hidden,false)
  OR private.current_user_is_admin()
  OR private.can_access_character_v1(c.id,'edit')
 );
$npc_roster$;
REVOKE ALL ON FUNCTION public.c34_t46_get_npc_manager_roster_v1()
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.c34_t46_get_npc_manager_roster_v1()
 TO authenticated;

-- The manager MUST independently re-check this trusted server capability
-- before reading or printing a private Sheet, and on actor/permission changes.
-- Do not infer GM from can_edit, inventory, visibility or a client prop.
CREATE OR REPLACE FUNCTION public.c34_t46_get_npc_manager_authority_v1(p_character_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $npc_auth$
SELECT jsonb_build_object(
 'is_gm',private.current_user_is_admin(),
 'can_edit',private.current_user_is_admin() OR
             private.can_access_character_v1(c.id,'edit'),
 'can_inventory',private.current_user_is_admin() OR
      coalesce(cp.can_inventory,false) OR coalesce(cp.can_edit,false),
 'can_convert',private.current_user_is_admin() OR coalesce(cp.can_convert,false)
)
FROM public.characters c
LEFT JOIN public.character_permissions cp
 ON cp.character_id=c.id AND cp.user_id=auth.uid()
WHERE c.id=p_character_id AND c.kind IN ('npc','merchant')
 AND auth.uid() IS NOT NULL AND auth.role()='authenticated'
 AND (NOT coalesce(c.is_hidden,false)
      OR private.current_user_is_admin()
      OR private.can_access_character_v1(c.id,'edit'));
$npc_auth$;
REVOKE ALL ON FUNCTION public.c34_t46_get_npc_manager_authority_v1(uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.c34_t46_get_npc_manager_authority_v1(uuid)
 TO authenticated;
-- No browser-supplied uid/role is trusted. This replaces the legacy
-- admin-only UI helper without widening the existing is_admin RPC itself.
CREATE OR REPLACE FUNCTION public.c34_t46_get_npc_manager_identity_v1()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $npc_identity$
SELECT auth.uid() IS NOT NULL AND auth.role()='authenticated'
  AND private.current_user_is_admin();
$npc_identity$;
REVOKE ALL ON FUNCTION public.c34_t46_get_npc_manager_identity_v1()
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.c34_t46_get_npc_manager_identity_v1()
 TO authenticated;
COMMIT;

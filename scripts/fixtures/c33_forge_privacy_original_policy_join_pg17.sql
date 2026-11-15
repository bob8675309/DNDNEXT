-- C3.3: strict source-original Forge + staged privacy compatibility model.
-- Disposable Supabase CLI / PG17 / GoTrue only; never DnDWeb production.
-- Installed AFTER forge_creation_replay_local_auth_pg17.sql with
-- -v DNDNEXT_C33_PRIVACY_STAGE3_CREATOR=1; its old creator trigger is omitted.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
  IF current_database() <> 'postgres'
     OR current_setting('server_version_num')::int < 170000
     OR to_regclass('auth.users') IS NULL
     OR to_regclass('public.characters') IS NULL
     OR to_regclass('private.character_creator_attribution') IS NOT NULL
     OR to_regprocedure('public.create_player_character_v2(jsonb,jsonb)') IS NULL
     OR to_regprocedure('public.create_player_character_v3(jsonb,jsonb,jsonb)') IS NULL
  THEN
    RAISE EXCEPTION 'C3.3 combined fixture requires empty disposable Forge PG17 with original v2/v3 and NO creator trigger';
  END IF;
END $guard$;

-- Copy verbatim original private.require_character_admin_v1 body, except
-- its local-only private.current_user_is_admin reads private.test_admins.
-- This function is required by original create_character_v1, not by the privacy SQL.
CREATE OR REPLACE FUNCTION private.require_character_admin_v1()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.current_user_is_admin() then
    raise exception 'Only an administrator can manage campaign characters' using errcode = '42501';
  end if;
end;
$function$;

-- Same READ-ONLY captured original access/secret/PC serializers as the
-- standalone NPC privacy suite. MD5 release preflights remain unchanged.
\i scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql

-- Live-shaped privileges and security policy; no anonymous/grant escalation.
-- Authenticated can update its own sheet; the source-character INSERT stays
-- Admin-only and canonical Forge creation runs via existing SECURITY DEFINER.
REVOKE ALL ON public.characters,public.character_sheets,public.character_permissions
  FROM PUBLIC,anon,authenticated;
GRANT SELECT (
 id,name,kind,race,role,affiliation,status,description,background,motivation,
 quirk,mannerism,voice,location_id,is_hidden,storefront_enabled,
 portrait_url,portrait_storage_path,portrait_thumb_url,portrait_shop_url,
 portrait_source,image_url,tags
) ON public.characters TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.character_sheets TO authenticated;
GRANT SELECT ON public.character_permissions TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_character_v1(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_player_characters_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_player_character_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_character_secrets_v1(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_character_secret_v1(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_player_characters_v2() FROM anon;
REVOKE ALL ON FUNCTION public.get_my_player_character_v1() FROM anon;
REVOKE ALL ON FUNCTION public.get_character_secrets_v1(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.set_character_secret_v1(uuid,text) FROM anon;

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY characters_select_visible_or_assigned
ON public.characters FOR SELECT TO authenticated
USING ((NOT coalesce(is_hidden,false)) OR
       (SELECT private.can_access_character_v1(id,'read')));
CREATE POLICY characters_insert_admin ON public.characters FOR INSERT
TO authenticated WITH CHECK ((SELECT private.current_user_is_admin()));
CREATE POLICY characters_update_editor ON public.characters FOR UPDATE
TO authenticated
USING ((SELECT private.can_access_character_v1(id,'edit')))
WITH CHECK ((SELECT private.can_access_character_v1(id,'edit')));
CREATE POLICY character_sheets_select_visible_or_assigned
ON public.character_sheets FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.characters c
 WHERE c.id=character_sheets.character_id));
CREATE POLICY character_sheets_insert_editor
ON public.character_sheets FOR INSERT TO authenticated
WITH CHECK ((SELECT private.can_access_character_v1(character_id,'edit')));
CREATE POLICY character_sheets_update_editor
ON public.character_sheets FOR UPDATE TO authenticated
USING ((SELECT private.can_access_character_v1(character_id,'edit')))
WITH CHECK ((SELECT private.can_access_character_v1(character_id,'edit')));
CREATE POLICY character_permissions_select_self
ON public.character_permissions FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) OR
       (SELECT private.current_user_is_admin()));

-- Explicit fixture integrity: original functions are source-exact, NOT mocks.
DO $verify$
BEGIN
 IF md5(pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure))
      <> '0351f0a00acae023278e1b8b065b00c9'
 OR md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))
      <> '6ba73e6f12fcf826cc0a739cce45ff40'
 OR md5(pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure))
      <> '97b5e6b059e6467e24c4283fe420c83e'
 THEN RAISE EXCEPTION 'Original creation/privacy function source fingerprint drift'; END IF;
END $verify$;
-- Isolated C3P Chromium fixture ONLY. The actual app calls public.is_admin;
-- this reduced local DB has private.test_admins but not production user_profiles
-- or the production is_admin RPC. Never install this adapter on live Supabase.
-- Its SECURITY DEFINER body reads current JWT identity, and may never check
-- a different caller-supplied uid. This is test routing, not an Admin bypass.
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','private','auth'
AS $c33p_fixture$
 SELECT auth.uid() IS NOT NULL
   AND (uid IS NULL OR uid=auth.uid())
   AND private.current_user_is_admin()
$c33p_fixture$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
\echo 'PASS C3J00: original Forge v2/v3, original pre-stage privacy readers, current-role RLS installed in disposable PG17'

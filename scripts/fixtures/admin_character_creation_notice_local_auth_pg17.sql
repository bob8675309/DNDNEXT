-- DNDNext Admin notices: ephemeral free Supabase local GoTrue PG17 ONLY.
-- Real JWT identity comes from auth.uid(); no production records.
\set ON_ERROR_STOP on
DO $only_local$
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::integer<170000
 THEN RAISE EXCEPTION 'Admin notice true-JWT fixture requires disposable PG17 postgres'; END IF;
END $only_local$;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE public.characters(
 id uuid PRIMARY KEY, name text NOT NULL, kind text NOT NULL DEFAULT 'npc'
);
CREATE TABLE public.character_level_events(
 id uuid PRIMARY KEY,
 character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 event_type text NOT NULL,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE private.admin_notice_auth_fixture_admins(id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION private.current_user_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','private','auth'
AS $function$
 SELECT EXISTS(
  SELECT 1 FROM private.admin_notice_auth_fixture_admins a
  WHERE a.id=auth.uid()
 )
$function$;
REVOKE ALL ON FUNCTION private.current_user_is_admin()
FROM PUBLIC, anon, authenticated;
-- Live DnDWeb allows authenticated clients to execute this boolean RLS
-- helper, but not anonymous callers. Mirror those exact ACL boundaries
-- here because character_permissions policies invoke it as authenticated.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_is_admin() TO authenticated;

-- Source-shaped existing permission flags. This is the same Admin/self RLS
-- design verified read-only on DnDWeb, reproduced only in the disposable DB.
CREATE TABLE public.character_permissions (
  character_id uuid NOT NULL REFERENCES public.characters(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  can_edit boolean NOT NULL DEFAULT false,
  can_inventory boolean NOT NULL DEFAULT false,
  can_convert boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(character_id,user_id)
);
ALTER TABLE public.character_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_permissions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.character_permissions TO authenticated;
CREATE POLICY character_permissions_admin_write
ON public.character_permissions FOR ALL TO authenticated
USING ((SELECT private.current_user_is_admin()))
WITH CHECK ((SELECT private.current_user_is_admin()));
CREATE POLICY character_permissions_select_self
ON public.character_permissions FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR
       (SELECT private.current_user_is_admin()));

ALTER TABLE public.character_level_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.character_level_events FROM PUBLIC, anon, authenticated;
\i sql/candidates/20261104_admin_character_creation_notices_v1.sql
NOTIFY pgrst,'reload schema';

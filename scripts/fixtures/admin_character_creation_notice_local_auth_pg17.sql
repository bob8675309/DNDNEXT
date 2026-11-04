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
ALTER TABLE public.character_level_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.character_level_events FROM PUBLIC, anon, authenticated;
\i sql/candidates/20261104_admin_character_creation_notices_v1.sql
NOTIFY pgrst,'reload schema';

-- DNDNext P1.3 source-exact visible NPC / player-sheet authorization fixture.
-- Emulates currently deployed policies and saved original functions in
-- disposable local Supabase/PostgreSQL 17 only, never production.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::int<170000
    OR EXISTS (SELECT 1 FROM pg_class WHERE relname='characters'
      AND relnamespace='public'::regnamespace)
 THEN RAISE EXCEPTION 'Only empty disposable PostgreSQL 17 postgres DB'; END IF;
END $guard$;

CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE public.characters (
 id uuid PRIMARY KEY,name text NOT NULL,kind text NOT NULL DEFAULT 'npc',
 race text,role text,affiliation text,status text,description text,
 background text,motivation text,quirk text,mannerism text,voice text,
 secret text,location_id bigint, is_hidden boolean DEFAULT true,
 storefront_enabled boolean DEFAULT false,
 portrait_url text,portrait_storage_path text,portrait_thumb_url text,
 portrait_shop_url text,portrait_source text,image_url text,tags text[]
);
CREATE TABLE public.character_sheets (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id),
 sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.character_permissions (
 character_id uuid NOT NULL REFERENCES public.characters(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 can_inventory boolean NOT NULL DEFAULT false,
 can_edit boolean NOT NULL DEFAULT false,
 can_convert boolean NOT NULL DEFAULT false,
 created_at timestamptz DEFAULT now(),
 PRIMARY KEY(character_id,user_id)
);
CREATE TABLE private.npc_profile_test_admins (id uuid PRIMARY KEY);
CREATE FUNCTION private.current_user_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','auth','private'
AS $$
 SELECT EXISTS(SELECT 1 FROM private.npc_profile_test_admins
 WHERE id=auth.uid());
$$;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_is_admin() TO authenticated;

\i scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql
GRANT EXECUTE ON FUNCTION private.can_access_character_v1(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_player_characters_v2() TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_player_characters_v2() FROM anon;

-- Real production: most characters columns are authenticated SELECT grants
-- but the separate "secret" column is denied. Model that boundary exactly.
REVOKE ALL ON public.characters,public.character_sheets,public.character_permissions
FROM PUBLIC,anon,authenticated;
GRANT SELECT (
 id,name,kind,race,role,affiliation,status,description,background,motivation,
 quirk,mannerism,voice,location_id,is_hidden,storefront_enabled,
 portrait_url,portrait_storage_path,portrait_thumb_url,portrait_shop_url,
 portrait_source,image_url,tags
) ON public.characters TO authenticated;
GRANT SELECT ON public.character_sheets TO authenticated;
GRANT SELECT ON public.character_permissions TO authenticated;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY characters_select_visible_or_assigned
ON public.characters FOR SELECT TO authenticated
USING ((NOT coalesce(is_hidden,false)) OR
       (SELECT private.can_access_character_v1(id,'read')));
CREATE POLICY character_sheets_select_visible_or_assigned
ON public.character_sheets FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.characters c
 WHERE c.id=character_sheets.character_id));
CREATE POLICY character_permissions_select_self
ON public.character_permissions FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) OR
       (SELECT private.current_user_is_admin()));
-- Deliberately no write grants to the client; the fixture creates synthetic
-- rows through local psql only and tests signed-in reads through PostgREST.
NOTIFY pgrst,'reload schema';

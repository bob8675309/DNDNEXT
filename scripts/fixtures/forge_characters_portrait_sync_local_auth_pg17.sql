-- J133-J141. Research-only source-original library portrait linkage in local PG17.
-- Run after authenticated J00-J132, never on production or staging Supabase.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('public.npc_portrait_library') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR to_regprocedure('private.current_user_is_admin()') IS NULL
 OR to_regprocedure('private.guard_player_character_tag_update_v1()') IS NULL
 OR md5(pg_get_functiondef('private.guard_player_character_tag_update_v1()'::regprocedure))
    <> 'b8b0008a718de1aa3e74d66b30f1a679'
 THEN RAISE EXCEPTION 'Portrait research fixture requires safe J132 disposable PG17 state'; END IF;
 IF to_regprocedure('private.sync_character_portrait_library_id_v1()') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.characters'::regclass
           AND tgname='sync_character_portrait_library_id_v1')
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.characters'::regclass AND relrowsecurity)
 OR EXISTS(SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='npc_portrait_library'
            AND column_name IN ('name','sort_order'))
 THEN RAISE EXCEPTION 'J133 original portrait fixture expected reduced local catalog/RLS'; END IF;
END $gate$;

-- Only columns absent from prior REDUCED fixture, mirroring observed live names/types.
-- Not the complete production portrait catalogue, indexes, storage or ACL.
ALTER TABLE public.npc_portrait_library
 ADD COLUMN name text NOT NULL DEFAULT 'local-fixture',
 ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

\i scripts/fixtures/forge_characters_portrait_sync_original_pg17.sql

DO $fidelity$
BEGIN
 IF md5(pg_get_functiondef('private.sync_character_portrait_library_id_v1()'::regprocedure))
    <> '74cb0bf9d7a614a860344f12cf787e05'
 THEN RAISE EXCEPTION 'Original deployed portrait-library sync source MD5 mismatch'; END IF;
END $fidelity$;

CREATE TRIGGER sync_character_portrait_library_id_v1
 BEFORE INSERT OR UPDATE OF portrait_storage_path, portrait_url, portrait_source ON public.characters
 FOR EACH ROW EXECUTE FUNCTION private.sync_character_portrait_library_id_v1();

DO $trigger$
DECLARE ddl text;
BEGIN
 SELECT pg_get_triggerdef(t.oid,true) INTO ddl
 FROM pg_trigger t WHERE t.tgrelid='public.characters'::regclass
 AND t.tgname='sync_character_portrait_library_id_v1' AND NOT t.tgisinternal;
 IF ddl IS NULL
 OR position('BEFORE INSERT OR UPDATE OF' in ddl)=0
 OR position('portrait_storage_path' in ddl)=0
 OR position('portrait_url' in ddl)=0
 OR position('portrait_source' in ddl)=0
 OR position('private.sync_character_portrait_library_id_v1()' in ddl)=0
 THEN RAISE EXCEPTION 'Original portrait trigger event/handler differs: %',ddl; END IF;
END $trigger$;

-- Reuse J125 REDUCED local editor-only characters RLS, no live permissions.
GRANT UPDATE(portrait_source,portrait_storage_path,portrait_url)
 ON public.characters TO authenticated;
REVOKE ALL ON public.characters FROM anon;
NOTIFY pgrst,'reload schema';
\echo 'PASS J133 original source-hashed portrait link trigger installed in disposable PG17'

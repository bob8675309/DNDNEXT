-- Research-only J125-J132: original player tags guard. AFTER genuine local J00-J124.
-- Never run on production; no live project identifiers or privileged keys.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('public.character_permissions') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regprocedure('private.current_user_is_admin()') IS NULL
 OR to_regprocedure('private.sync_player_character_tags_from_sheet_v1()') IS NULL
 OR to_regclass('public.character_sheets') IS NULL
 THEN RAISE EXCEPTION 'Original character tags guard fixture requires disposable J00-J124 PG17'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.characters'::regclass AND tgname='characters_guard_player_tags_v1')
 OR to_regprocedure('private.guard_player_character_tag_update_v1()') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_class WHERE oid='public.characters'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Unexpected prior tag guard or character RLS state'; END IF;
 IF md5(pg_get_functiondef('private.sync_player_character_tags_from_sheet_v1()'::regprocedure))
  <> 'a135ca951f81d2a9546d783afe665c52'
 THEN RAISE EXCEPTION 'Nested sheet tag-sync original has changed'; END IF;
END $gate$;

\i scripts/fixtures/forge_characters_tag_guard_original_pg17.sql
DO $original_source$
BEGIN
 IF md5(pg_get_functiondef('private.guard_player_character_tag_update_v1()'::regprocedure))
  <> 'b8b0008a718de1aa3e74d66b30f1a679'
 THEN RAISE EXCEPTION 'Original deployed player tags guard source MD5 differs'; END IF;
END $original_source$;

CREATE TRIGGER characters_guard_player_tags_v1
 BEFORE UPDATE OF tags ON public.characters
 FOR EACH ROW EXECUTE FUNCTION private.guard_player_character_tag_update_v1();

DO $original_trigger$
DECLARE ddl text;
BEGIN
 SELECT pg_get_triggerdef(oid,true) INTO ddl
 FROM pg_trigger WHERE tgrelid='public.characters'::regclass
 AND tgname='characters_guard_player_tags_v1' AND NOT tgisinternal;
 IF ddl IS NULL OR position('BEFORE UPDATE OF tags' in ddl)=0
 OR position('private.guard_player_character_tag_update_v1()' in ddl)=0
 THEN RAISE EXCEPTION 'Original trigger event/handler mismatch: %',ddl; END IF;
END $original_trigger$;

-- Explicitly REDUCED local editor-only RLS, not production character permissions.
GRANT SELECT, UPDATE(tags) ON public.characters TO authenticated;
REVOKE ALL ON public.characters FROM anon;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY j125_characters_select_editor ON public.characters
 FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.character_permissions p
   WHERE p.character_id=characters.id AND p.user_id=auth.uid() AND p.can_edit)
 );
CREATE POLICY j125_characters_update_tags_editor ON public.characters
 FOR UPDATE TO authenticated USING (
  EXISTS(SELECT 1 FROM public.character_permissions p
   WHERE p.character_id=characters.id AND p.user_id=auth.uid() AND p.can_edit)
 ) WITH CHECK (
  EXISTS(SELECT 1 FROM public.character_permissions p
   WHERE p.character_id=characters.id AND p.user_id=auth.uid() AND p.can_edit)
 );
NOTIFY pgrst,'reload schema';
\echo 'PASS J125 original character player tags guard hash/trigger with reduced local RLS'

-- PR #324: original immediate sheet guard and derived player-tag sync.
-- DISPOSABLE Supabase CLI PG17 ONLY, after J00-J21. No production migration.
\set ON_ERROR_STOP on
DO $local_guard$
BEGIN
 IF current_database() <> 'postgres'
 OR current_setting('server_version_num')::int < 170000
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('public.character_currency') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='character_sheets_validate_player_forge_starting_equipment_v1')
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname IN (
   'character_sheets_authority_fields_guard_v1','character_sheets_sync_player_tags_v1'))
 THEN RAISE EXCEPTION 'Refusing non-disposable or wrongly sequenced sheet authority fixture';
 END IF;
END $local_guard$;

-- Source-exact deployed function bodies:
--   guard_direct_character_authority_mutation_v1: 04596b0a3fdfb71c1b357056e8c6023b
--   sync_player_character_tags_from_sheet_v1: a135ca951f81d2a9546d783afe665c52
--   derive_player_character_tags_v1: d62bab7f326330ddbeb6ccede172d19f
--   player_character_tag_slug_v1: aba97a1c7478159d182e38cda4ca8383
\i scripts/fixtures/forge_sheet_authority_tags_original_pg17.sql

CREATE TRIGGER character_sheets_authority_fields_guard_v1
 BEFORE INSERT OR UPDATE OF sheet ON public.character_sheets
 FOR EACH ROW EXECUTE FUNCTION private.guard_direct_character_authority_mutation_v1();
CREATE TRIGGER character_sheets_sync_player_tags_v1
 AFTER INSERT OR UPDATE OF sheet ON public.character_sheets
 FOR EACH ROW EXECUTE FUNCTION private.sync_player_character_tags_from_sheet_v1();

-- Reduced single-table permissions/RLS used ONLY to route genuine GoTrue
-- authenticated PostgREST UPDATE to the original SECURITY INVOKER guard.
-- Production uses private.can_access_character_v1 with more complex checks;
-- these narrow local policies do NOT claim equivalent production RLS or ACL.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_is_admin() TO authenticated;
GRANT SELECT ON public.character_permissions TO authenticated;
GRANT SELECT,UPDATE,INSERT ON public.character_sheets TO authenticated;
REVOKE ALL ON public.character_sheets FROM anon;
ALTER TABLE public.character_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY local_forge_sheet_select_editor ON public.character_sheets
 FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.character_permissions cp
  WHERE cp.character_id=character_sheets.character_id
   AND cp.user_id=auth.uid() AND cp.can_edit)
 );
CREATE POLICY local_forge_sheet_update_editor ON public.character_sheets
 FOR UPDATE TO authenticated USING (
 EXISTS(SELECT 1 FROM public.character_permissions cp
  WHERE cp.character_id=character_sheets.character_id
   AND cp.user_id=auth.uid() AND cp.can_edit)
 ) WITH CHECK (
 EXISTS(SELECT 1 FROM public.character_permissions cp
  WHERE cp.character_id=character_sheets.character_id
   AND cp.user_id=auth.uid() AND cp.can_edit)
 );
CREATE POLICY local_forge_sheet_insert_editor ON public.character_sheets
 FOR INSERT TO authenticated WITH CHECK (
 EXISTS(SELECT 1 FROM public.character_permissions cp
  WHERE cp.character_id=character_sheets.character_id
   AND cp.user_id=auth.uid() AND cp.can_edit)
 );

DO $loaded$
DECLARE v_auth bool;v_tag bool;
BEGIN
 SELECT count(*)=2 INTO v_auth FROM pg_trigger t
 JOIN pg_class c ON c.oid=t.tgrelid
 WHERE c.relname='character_sheets' AND t.tgname IN(
  'character_sheets_authority_fields_guard_v1',
  'character_sheets_sync_player_tags_v1');
 IF NOT v_auth THEN RAISE EXCEPTION 'Original immediate sheet authority or tags trigger missing'; END IF;
END $loaded$;
NOTIFY pgrst,'reload schema';
\echo 'PASS FIXTURE local source-original sheet authority/tag triggers and restricted editor-only PostgREST policy loaded'

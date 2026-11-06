-- J85+ disposable local GoTrue research: replicate four LIVE inventory RLS
-- policies and table DML grants *after* original J00-J84.
-- This is a scratch-only source policy model, NOT a production migration.
\set ON_ERROR_STOP on
DO $scope$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('public.inventory_items') IS NULL
 OR to_regprocedure('private.materialize_player_forge_starting_equipment_v1(uuid)') IS NULL
 OR (SELECT count(*) FROM pg_constraint
       WHERE conrelid='public.inventory_items'::regclass
       AND conname IN ('inventory_items_owner_type_chk','inventory_items_owner_type_check'))<>2
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>0
 THEN RAISE EXCEPTION 'J85+ inventory policy fixture requires exact disposable J84 state'; END IF;
END $scope$;

-- Source-original permission predicate, the production authority reused
-- in the proposed character-owned SELECT RLS filter.
\i scripts/fixtures/forge_inventory_access_original_pg17.sql
DO $auth_source$
BEGIN
 IF md5(pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure))
     <> '97b5e6b059e6467e24c4283fe420c83e'
 THEN RAISE EXCEPTION 'Inventory permission source drift'; END IF;
END $auth_source$;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_character_v1(uuid,text) TO authenticated;

-- These are unmodified predicate expressions from live pg_policies.
-- private.current_user_is_admin() is reduced to the existing local GoTrue
-- Admin fixture; production function is not overwritten.
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_insert_owner_or_admin ON public.inventory_items
 FOR INSERT TO authenticated
 WITH CHECK ((user_id = (SELECT auth.uid())) OR (SELECT private.current_user_is_admin()));
CREATE POLICY inventory_items_select_owner_or_admin ON public.inventory_items
 FOR SELECT TO authenticated
 USING ((user_id = (SELECT auth.uid())) OR (SELECT private.current_user_is_admin()));
CREATE POLICY inventory_items_update_owner_or_admin ON public.inventory_items
 FOR UPDATE TO authenticated
 USING ((user_id = (SELECT auth.uid())) OR (SELECT private.current_user_is_admin()))
 WITH CHECK ((user_id = (SELECT auth.uid())) OR (SELECT private.current_user_is_admin()));
CREATE POLICY inventory_items_delete_owner_or_admin ON public.inventory_items
 FOR DELETE TO authenticated
 USING ((user_id = (SELECT auth.uid())) OR (SELECT private.current_user_is_admin()));

-- PR324 earlier correctly revoked all direct table DML for authenticated.
-- Restore actual live inventory DML grants ONLY INSIDE disposable DB.
GRANT SELECT,INSERT,UPDATE,DELETE ON public.inventory_items TO authenticated;
REVOKE ALL ON public.inventory_items FROM anon;

DO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.inventory_items'::regclass)
 OR NOT has_table_privilege('authenticated','public.inventory_items','INSERT')
 OR NOT has_table_privilege('authenticated','public.inventory_items','UPDATE')
 OR NOT has_table_privilege('authenticated','public.inventory_items','DELETE')
 OR has_table_privilege('anon','public.inventory_items','INSERT')
 THEN RAISE EXCEPTION 'Wrong live-style scratch table grants/policies'; END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
\echo 'PASS J85 disposable local PG17 live-policy-equivalent role RLS/DML grants installed (real GoTrue identity)'

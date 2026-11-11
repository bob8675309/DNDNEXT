-- I2-B: disposable ONLY. Demonstrate Option A direct-client
-- account-profile compatibility and denial of legacy sheet writes.
-- THIS IS A LOCAL ROLE TEST, NOT A PRODUCTION PRIVILEGE MIGRATION.
-- Original P1.3 disposable players table only has user_id/sheet/updated_at;
-- add the historical account profile 'name' column locally before grants.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.p13_levelup_case_guard') IS NULL
 OR to_regclass('public.players') IS NULL
 OR md5(pg_get_functiondef('public.complete_character_rest_v1(uuid,text)'::regprocedure))
    <>'fffbf0705d640a7d2bfb08aa78ad521a'
 THEN RAISE EXCEPTION 'I2-B role fixture forbidden outside disposable signed P1.3 scratch'; END IF;
END $guard$;

ALTER TABLE public.players ADD COLUMN name text NOT NULL DEFAULT 'Original account';
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY i2b_player_read_self ON public.players
  FOR SELECT TO authenticated
  USING (user_id=(select auth.uid()));
CREATE POLICY i2b_player_insert_self ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (user_id=(select auth.uid()));
CREATE POLICY i2b_player_update_self ON public.players
  FOR UPDATE TO authenticated
  USING (user_id=(select auth.uid()))
  WITH CHECK (user_id=(select auth.uid()));

REVOKE ALL ON TABLE public.players FROM PUBLIC,anon,authenticated;
-- Authenticated is now restricted to profile identity fields only.
-- IMPORTANT: revoking UPDATE(sheet) alone cannot override table-wide UPDATE.
GRANT SELECT ON TABLE public.players TO authenticated;
GRANT INSERT (user_id,name) ON TABLE public.players TO authenticated;
GRANT UPDATE (name,updated_at) ON TABLE public.players TO authenticated;
NOTIFY pgrst,'reload schema';

DO $verify$
BEGIN
 IF has_table_privilege('authenticated','public.players','UPDATE')
 OR has_table_privilege('authenticated','public.players','INSERT')
 OR has_column_privilege('authenticated','public.players','sheet','UPDATE')
 OR has_column_privilege('authenticated','public.players','sheet','INSERT')
 OR NOT has_column_privilege('authenticated','public.players','name','UPDATE')
 OR NOT has_column_privilege('authenticated','public.players','name','INSERT')
 OR NOT has_column_privilege('authenticated','public.players','user_id','INSERT')
 OR NOT has_column_privilege('authenticated','public.players','sheet','SELECT')
 OR has_table_privilege('anon','public.players','SELECT')
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.players'::regclass)
 THEN RAISE EXCEPTION 'I2-B profile-only ACL fails closed'; END IF;
END $verify$;
\echo 'PASS I2B-ACL: scratch profile-only INSERT/UPDATE, sheet UPDATE/INSERT denied, RLS enabled; no live changes'

-- I2-C signup+Forge owner Option A profile-column ACL.
-- DISPOSABLE LOCAL PG17 ONLY, after exact v1/v2 original RED and scratch freeze.
-- This SQL is NOT a hosted migration or a complete Admin/service-role review.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR md5(pg_get_functiondef('public.sync_user_profile()'::regprocedure))<>'dd7113eec05655a661309838acce6030'
 OR to_regclass('public.players') IS NULL
 THEN RAISE EXCEPTION 'I2C profile-only role fixture requires signed scratch signup/FORGE'; END IF;
END $guard$;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY i2c_players_select_self ON public.players
 FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
CREATE POLICY i2c_players_insert_self ON public.players
 FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()));
CREATE POLICY i2c_players_update_self ON public.players
 FOR UPDATE TO authenticated USING (user_id=(select auth.uid()))
 WITH CHECK (user_id=(select auth.uid()));

REVOKE ALL ON TABLE public.players FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.players TO authenticated;
GRANT INSERT(user_id,name) ON public.players TO authenticated;
GRANT UPDATE(user_id,name,updated_at) ON public.players TO authenticated;
NOTIFY pgrst,'reload schema';

DO $check$
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.players'::regclass)
 OR has_table_privilege('authenticated','public.players','INSERT')
 OR has_table_privilege('authenticated','public.players','UPDATE')
 OR has_column_privilege('authenticated','public.players','sheet','UPDATE')
 OR has_column_privilege('authenticated','public.players','sheet','INSERT')
 OR NOT has_column_privilege('authenticated','public.players','name','UPDATE')
 OR NOT has_column_privilege('authenticated','public.players','name','INSERT')
 OR NOT has_column_privilege('authenticated','public.players','user_id','INSERT')
 OR has_table_privilege('anon','public.players','SELECT')
 THEN RAISE EXCEPTION 'I2-C account name grants / sheet denial failed'; END IF;
END $check$;
\echo 'PASS I2C-ACL: scratch authenticated player name insert/update/upsert allowed, direct legacy-sheet insertion/update rejected'

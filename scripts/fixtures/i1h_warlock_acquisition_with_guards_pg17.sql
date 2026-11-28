-- I1-H disposable-only source-original Warlock acquisition integration.
-- Source bodies copied verbatim into i1g_warlock_original_acquisition_pg17.sql.
-- Requires BOTH I1-G guards active. Never run against hosted Supabase.
\set ON_ERROR_STOP on
DO $i1h_preflight$
BEGIN
 IF current_database() <> 'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR to_regclass('auth.users') IS NULL
    OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
    OR to_regclass('public.character_class_option_grant_instances') IS NULL
    OR to_regprocedure('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)') IS NULL
    OR (SELECT count(*) FROM pg_trigger
        WHERE tgrelid='public.character_progression'::regclass
          AND NOT tgisinternal AND tgenabled='O'
          AND tgname IN (
           'character_progression_reject_unmarked_legacy_warlock_invocation',
           'character_progression_validate_player_forge_class_options_v2')) <> 2
    OR EXISTS (SELECT 1 FROM pg_trigger
       WHERE tgrelid='public.character_progression'::regclass
       AND tgname='character_progression_validate_player_forge_class_options_v1')
 THEN RAISE EXCEPTION 'I1-H may only install original acquisition on isolated I1-G PG17 with BOTH guards enabled';
 END IF;
END $i1h_preflight$;

\i scripts/fixtures/i1g_warlock_original_acquisition_pg17.sql

CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_class_options_v1
 AFTER INSERT ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.validate_and_materialize_player_forge_class_options_v1();

REVOKE ALL ON FUNCTION private.xphb_warlock_invocation_slot_level_v1(integer),
 private.validate_and_materialize_player_forge_class_options_v1()
 FROM PUBLIC, anon, authenticated;

DO $i1h_original_gate$
DECLARE v_def text;
BEGIN
 IF md5(pg_get_functiondef('private.validate_and_materialize_player_forge_class_options_v1()'::regprocedure))
      <> '6df5aee6f0519c9c77758d6e887ed8e4'
 OR md5(pg_get_functiondef('private.xphb_warlock_invocation_slot_level_v1(integer)'::regprocedure))
      <> '942dd3a4e08b8874f3e42cbbb8323038'
 OR md5(pg_get_functiondef('private.reject_unmarked_legacy_warlock_invocations_v1()'::regprocedure))
      <> '631fbb585f47e71a619ca8ac8e212407'
 OR md5(pg_get_functiondef('private.validate_existing_normalized_warlock_invocations_v2()'::regprocedure))
      <> '4f1752db655b6ba490113f604c7583ef'
 THEN RAISE EXCEPTION 'I1-H original source function hash drift';
 END IF;
 SELECT pg_get_triggerdef(t.oid,true) INTO v_def FROM pg_trigger t
 WHERE t.tgrelid='public.character_progression'::regclass
 AND t.tgname='character_progression_validate_player_forge_class_options_v1'
 AND NOT t.tgisinternal AND t.tgenabled='O' AND t.tgdeferrable AND t.tginitdeferred;
 IF v_def IS NULL OR v_def NOT LIKE '%AFTER INSERT ON%'
     OR v_def NOT LIKE '%DEFERRABLE INITIALLY DEFERRED%'
     OR v_def NOT LIKE '%private.validate_and_materialize_player_forge_class_options_v1()%'
 THEN RAISE EXCEPTION 'I1-H source-original acquisition trigger timing/handler drift';
 END IF;
END $i1h_original_gate$;
NOTIFY pgrst,'reload schema';
\echo 'PASS I1H-SOURCE: unchanged original Warlock acquisition plus BOTH original I1-G deferred safeguards installed and enabled'

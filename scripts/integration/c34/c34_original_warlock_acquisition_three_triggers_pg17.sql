-- C34 T18 original source-owned Warlock acquisition joined to the two
-- already enabled original safeguards. Disposable PG17/GoTrue ONLY.
-- Six original Warlock private function bodies + three original deferred DDL
-- are preserved verbatim under scripts/integration/c34/sources/14-17_*.
\set ON_ERROR_STOP on
DO $t18_acq_pre$
DECLARE n int;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR md5(pg_get_functiondef('private.reject_unmarked_legacy_warlock_invocations_v1()'::regprocedure))<>'631fbb585f47e71a619ca8ac8e212407'
 OR md5(pg_get_functiondef('private.validate_existing_normalized_warlock_invocations_v2()'::regprocedure))<>'4f1752db655b6ba490113f604c7583ef'
 OR md5(pg_get_functiondef('private.xphb_warlock_invocation_count_v1(integer)'::regprocedure))<>'61c83f0172b33386f0a50435c2fe1ddb'
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass
 AND NOT tgisinternal AND tgenabled='O' AND tgname IN
 ('character_progression_reject_unmarked_legacy_warlock_invocation',
  'character_progression_validate_player_forge_class_options_v2'))<>2
 OR to_regprocedure('private.validate_and_materialize_player_forge_class_options_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'T18 source-original acquisition preflight failed'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND
 c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF n<>31 THEN RAISE EXCEPTION 'T18 needs 28 originals+3 held after two guard DDL; found %',n; END IF;
END $t18_acq_pre$;
\i scripts/integration/c34/sources/15_i1g_original_warlock_acquisition_pg17.sql
-- EXACT original held I1-H AFTER INSERT DEFERRABLE INITIALLY DEFERRED DDL.
CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_class_options_v1
 AFTER INSERT ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.validate_and_materialize_player_forge_class_options_v1();
REVOKE ALL ON FUNCTION private.xphb_warlock_invocation_slot_level_v1(integer),
 private.validate_and_materialize_player_forge_class_options_v1()
 FROM PUBLIC,anon,authenticated;
DO $t18_post$
DECLARE n int; v_def text;
BEGIN
 IF md5(pg_get_functiondef('private.validate_and_materialize_player_forge_class_options_v1()'::regprocedure))<>'6df5aee6f0519c9c77758d6e887ed8e4'
 OR md5(pg_get_functiondef('private.xphb_warlock_invocation_slot_level_v1(integer)'::regprocedure))<>'942dd3a4e08b8874f3e42cbbb8323038'
 OR has_function_privilege('authenticated','private.validate_and_materialize_player_forge_class_options_v1()','EXECUTE')
 THEN RAISE EXCEPTION 'T18 original Warlock source functions/grants drift'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND
 c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF n<>32 THEN RAISE EXCEPTION 'T18 expected 29 originals+3 held; found %',n; END IF;
 SELECT pg_get_triggerdef(oid,true) INTO v_def FROM pg_trigger
 WHERE tgrelid='public.character_progression'::regclass
 AND tgname='character_progression_validate_player_forge_class_options_v1'
 AND NOT tgisinternal AND tgenabled='O' AND tgdeferrable AND tginitdeferred;
 IF v_def IS NULL OR v_def NOT LIKE '%AFTER INSERT ON%'
 OR v_def NOT LIKE '%DEFERRABLE INITIALLY DEFERRED%'
 OR v_def NOT LIKE '%private.validate_and_materialize_player_forge_class_options_v1()%'
 THEN RAISE EXCEPTION 'T18 original acquisition trigger event or timing drift'; END IF;
 IF to_regprocedure('public._force_depart_on_route_assign()') IS NOT NULL
 THEN RAISE EXCEPTION 'T18 world-map movement guard unexpectedly present'; END IF;
END $t18_post$;
\echo 'PASS C34 T18 joined all THREE original Warlock deferred acquisition/guards; 29/31 originals, protected world-map excluded'

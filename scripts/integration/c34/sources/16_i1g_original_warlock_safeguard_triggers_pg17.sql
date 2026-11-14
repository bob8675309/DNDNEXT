-- I1-G PHASE 2: original safeguards installed AFTER signed Warlock
-- baseline fixtures. New signed creation without original Acquisition is
-- intentionally expected to FAIL CLOSED; do not silently bypass the count.
-- Only disposable local PG17/GoTrue; never apply to hosted Supabase.
\set ON_ERROR_STOP on
DO $require_prepared$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.player_forge_source_choice_legacy_v1') IS NULL
 OR to_regprocedure('private.reject_unmarked_legacy_warlock_invocations_v1()') IS NULL
 OR to_regprocedure('private.validate_existing_normalized_warlock_invocations_v2()') IS NULL
 OR (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal
     AND tgrelid='public.character_progression'::regclass
     AND tgname IN ('character_progression_reject_unmarked_legacy_warlock_invocation',
                    'character_progression_validate_player_forge_class_options_v2'))<>0
 THEN RAISE EXCEPTION 'I1-G original safeguard installation requires phase1-only disposable PG17';
 END IF;
END $require_prepared$;
-- Both original DDLs retrieved SELECT-only from live pg_get_triggerdef,
-- preserving original specific UPDATE OF and DEFERRABLE COMMIT semantics.
CREATE CONSTRAINT TRIGGER character_progression_reject_unmarked_legacy_warlock_invocation
 AFTER INSERT OR UPDATE OF class_id,class_level,level_choices
 ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.reject_unmarked_legacy_warlock_invocations_v1();
CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_class_options_v2
 AFTER UPDATE OF class_id,class_level,level_choices
 ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.validate_existing_normalized_warlock_invocations_v2();
REVOKE ALL ON FUNCTION private.reject_unmarked_legacy_warlock_invocations_v1(),
 private.validate_existing_normalized_warlock_invocations_v2() FROM PUBLIC,anon,authenticated;

DO $trigger_source$
DECLARE a text; b text;
BEGIN
 SELECT pg_get_triggerdef(oid,true) INTO a FROM pg_trigger
 WHERE tgrelid='public.character_progression'::regclass
 AND tgname='character_progression_reject_unmarked_legacy_warlock_invocation';
 SELECT pg_get_triggerdef(oid,true) INTO b FROM pg_trigger
 WHERE tgrelid='public.character_progression'::regclass
 AND tgname='character_progression_validate_player_forge_class_options_v2';
 IF a IS NULL OR a NOT LIKE '%AFTER INSERT OR UPDATE OF%'
 OR a NOT LIKE '%DEFERRABLE INITIALLY DEFERRED%'
 OR a NOT LIKE '%private.reject_unmarked_legacy_warlock_invocations_v1()%'
 OR b IS NULL OR b NOT LIKE '%AFTER UPDATE OF%'
 OR b NOT LIKE '%DEFERRABLE INITIALLY DEFERRED%'
 OR b NOT LIKE '%private.validate_existing_normalized_warlock_invocations_v2()%'
 THEN RAISE EXCEPTION 'I1-G exact original Warlock trigger DDL/timing drift'; END IF;
 IF (SELECT count(*) FROM public.class_feature_option_catalog
 WHERE option_type='eldritch-invocation' AND source='XPHB' AND class_key='warlock')<>16
 THEN RAISE EXCEPTION 'I1-G source-grounded Warlock catalog source drift'; END IF;
END $trigger_source$;
NOTIFY pgrst,'reload schema';
\echo 'PASS I1G-TRIGGERS: original two Warlock deferred safeguards with source-grounded class, choices, spell/feat specimens'

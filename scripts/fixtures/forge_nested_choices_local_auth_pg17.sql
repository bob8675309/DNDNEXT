-- J161 original deferred nested class-choice dependency validation.
-- Disposable local PG17/GoTrue ONLY; never execute on production/staging.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
  OR to_regclass('public.character_sheets') IS NULL
  OR to_regclass('public.character_option_catalog_preferred') IS NULL
  OR to_regprocedure('private.validate_player_forge_nested_choice_payload_v1()') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='character_progression_validate_player_forge_nested_choices_v1')
  OR md5(pg_get_functiondef('private.normalize_player_choice_name_v1(text)'::regprocedure))
       <> 'dd8cdd5b47efe99b1cfff9c2bf7635dd'
  OR md5(pg_get_functiondef('private.validate_player_forge_authority_payload_v1()'::regprocedure))
       <> '48006f8db76e9b32c96fcd2b6a4b3080'
  OR (SELECT count(*) FROM information_schema.columns
       WHERE table_schema='public' AND table_name='character_progression'
       AND column_name IN ('class_id','class_level','subclass_name','subclass_source','level_choices'))<>5
  OR NOT EXISTS(SELECT 1 FROM public.character_option_catalog_preferred
    WHERE option_type='feat' AND category='FS' AND name='Defense' AND source='XPHB')
  OR NOT EXISTS(SELECT 1 FROM public.class_catalog
    WHERE class_key='fighter' AND source='XPHB' AND hit_die=10)
 THEN RAISE EXCEPTION 'Original nested-choice fixture requires isolated completed J160 source-authentic PG17 baseline';
 END IF;
END $gate$;

-- This function is copied EXACTLY from live PG17 pg_get_functiondef.
-- No alteration to the production source body, prior handlers or catalog.
\i scripts/fixtures/forge_nested_choices_original_pg17.sql
DO $source$
BEGIN
 IF md5(pg_get_functiondef('private.validate_player_forge_nested_choice_payload_v1()'::regprocedure))
    <> 'df2861cc76b0b74bb7cd57fbe61c9a05'
 THEN RAISE EXCEPTION 'Original nested-choice source fingerprint does not match live definition'; END IF;
END $source$;

-- Exact read-only live constraint trigger on public.character_progression.
CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_nested_choices_v1
 AFTER INSERT OR UPDATE OF class_id, class_level, subclass_name, subclass_source, level_choices
 ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.validate_player_forge_nested_choice_payload_v1();

DO $check$
DECLARE t record;
BEGIN
 SELECT pg_get_triggerdef(oid,true) AS definition,tgdeferrable,tginitdeferred,tgfoid::regprocedure::text AS handler
 INTO t FROM pg_trigger
 WHERE tgrelid='public.character_progression'::regclass
  AND tgname='character_progression_validate_player_forge_nested_choices_v1'
  AND NOT tgisinternal;
 IF t.definition IS NULL OR NOT t.tgdeferrable OR NOT t.tginitdeferred
   OR t.handler<>'private.validate_player_forge_nested_choice_payload_v1()'
   OR t.definition NOT LIKE '%AFTER INSERT OR UPDATE OF class_id, class_level, subclass_name, subclass_source, level_choices%'
   OR t.definition NOT LIKE '%DEFERRABLE INITIALLY DEFERRED FOR EACH ROW%'
 THEN RAISE EXCEPTION 'Nested-choice original trigger event/deferral/handler drift'; END IF;
END $check$;
\echo 'PASS J161 exact original source-hashed nested-choice handler and deferred event trigger installed in isolated PostgreSQL17'

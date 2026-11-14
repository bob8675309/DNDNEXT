-- C34-T9 disposable PostgreSQL17 + signed GoTrue ONLY.
-- Source-original nested dependent class-choice handler from held #324,
-- unchanged Git blob 6eb50c0d0bd63da6ffd5d20c0e2fa09b8dcbf17a. Never deploy as a production migration.
\set ON_ERROR_STOP on
DO $t9_pre$
DECLARE n integer;
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
  OR to_regclass('public.character_sheets') IS NULL
  OR to_regclass('public.character_progression') IS NULL
  OR to_regclass('public.character_option_catalog_preferred') IS NULL
  OR to_regprocedure('private.validate_player_forge_nested_choice_payload_v1()') IS NOT NULL
  OR md5(pg_get_functiondef('private.normalize_player_choice_name_v1(text)'::regprocedure))
     <> 'dd8cdd5b47efe99b1cfff9c2bf7635dd'
  OR md5(pg_get_functiondef('private.validate_player_forge_authority_payload_v1()'::regprocedure))
     <> '48006f8db76e9b32c96fcd2b6a4b3080'
  OR md5(pg_get_functiondef('private.validate_player_forge_starting_magic_exactness_v1()'::regprocedure))
     <> 'ba645ad0f2c17addad0b40e0602c2ac8'
  OR (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='character_progression'
    AND column_name IN ('class_id','class_level','subclass_name','subclass_source','level_choices'))<>5
  OR NOT EXISTS (SELECT 1 FROM public.character_option_catalog_preferred
    WHERE option_type='feat' AND category='FS' AND name='Defense' AND source='XPHB')
  OR EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
    AND tgname='character_progression_validate_player_forge_nested_choices_v1')
 THEN RAISE EXCEPTION 'C34 T9 requires original disposable signed T1-T8, no existing nested handler'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
  AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF n<>19 THEN RAISE EXCEPTION 'C34 T9 requires original 16 +2 held privacy +1 creator seed, got %',n; END IF;
 IF EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
   ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'C34 T9 protects world-map route and rest/camp triggers'; END IF;
END $t9_pre$;

-- The real original handler is loaded via its unchanged, separately SHA-pinned file.
\i scripts/fixtures/forge_nested_choices_original_pg17.sql
DO $t9_fn$
BEGIN
 IF md5(pg_get_functiondef('private.validate_player_forge_nested_choice_payload_v1()'::regprocedure))
  <> 'df2861cc76b0b74bb7cd57fbe61c9a05'
 THEN RAISE EXCEPTION 'C34 T9 original nested-choice function MD5 drift'; END IF;
END $t9_fn$;

CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_nested_choices_v1
 AFTER INSERT OR UPDATE OF class_id, class_level, subclass_name, subclass_source, level_choices
 ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.validate_player_forge_nested_choice_payload_v1();

DO $t9_post$
DECLARE d text; n integer;
BEGIN
 SELECT pg_get_triggerdef(oid,true) INTO d FROM pg_trigger
 WHERE tgrelid='public.character_progression'::regclass
 AND tgname='character_progression_validate_player_forge_nested_choices_v1'
 AND NOT tgisinternal AND tgenabled='O';
 IF d IS NULL
 OR position('AFTER INSERT OR UPDATE OF class_id, class_level, subclass_name, subclass_source, level_choices' in d)=0
 OR position('DEFERRABLE INITIALLY DEFERRED' in d)=0
 OR position('private.validate_player_forge_nested_choice_payload_v1()' in d)=0
 THEN RAISE EXCEPTION 'C34 T9 original trigger event/timing differs: %',d; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
 AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF n<>20 THEN RAISE EXCEPTION 'C34 T9 expected original 17/31 plus 3 held, got %',n; END IF;
END $t9_post$;
\echo 'PASS C34 T9: unmodified source-original deferred nested-choice validator; 17/31 original +2 privacy +1 held seed'

-- C34-T6: ORIGINAL feat-instance grant materializer, source-exact #324.
-- Disposable local PG17 + genuine GoTrue ONLY. No production data or migration.
-- T1 created an unused one-column scratch grant-instance placeholder. T6 must
-- reject any nonempty/nontrivial table before replacing it with source-original
-- exact deployed schema/constraints and all five downstream trigger families.
\set ON_ERROR_STOP on
DO $preflight$
DECLARE v_count integer;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('private.character_creator_attribution') IS NULL
 OR to_regclass('public.character_option_catalog_preferred') IS NULL
 OR to_regclass('public.character_currency') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR to_regclass('public.character_option_grants') IS NOT NULL
 OR to_regprocedure('private.validate_player_forge_authority_payload_v1()') IS NULL
 OR to_regprocedure('private.guard_direct_character_authority_mutation_v1()') IS NULL
 OR to_regprocedure('private.materialize_player_forge_feat_instances_v1()') IS NOT NULL
 OR EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
     AND tgrelid='public.character_option_grant_instances'::regclass)
 OR (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='character_option_grant_instances')<>1
 OR NOT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='character_option_grant_instances'
       AND column_name='id' AND data_type='uuid' AND is_nullable='NO')
 OR (SELECT count(*) FROM pg_constraint
     WHERE conrelid='public.character_option_grant_instances'::regclass)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_constraint
     WHERE conrelid='public.character_option_grant_instances'::regclass AND contype='p')
 OR EXISTS(SELECT 1 FROM public.character_option_grant_instances)
 OR EXISTS(SELECT 1 FROM pg_depend d JOIN pg_class c
    ON c.oid=d.refobjid
    WHERE c.oid='public.character_option_grant_instances'::regclass
      AND d.deptype='n' AND d.classid='pg_rewrite'::regclass)
 THEN RAISE EXCEPTION 'C34-T6 refuses replacing anything except empty single-column local grant stub';
 END IF;
 SELECT count(*) INTO v_count
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
  AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF v_count<>16
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
   AND tgname='character_progression_validate_player_forge_authority_v1'
   AND tgdeferrable AND tginitdeferred)
 THEN RAISE EXCEPTION 'C34-T6 expected fully passing T1-T5 original 14+2 local trigger setup; found %',v_count;
 END IF;
END $preflight$;

-- This is the only C34-T6 dropped object: verified EMPTY one-column scratch
-- fixture, never a real grant table. Production and main are not connected.
DROP TABLE public.character_option_grant_instances;

-- Entire original held #324 J39 installation intact: exact original table
-- columns, FKs, CHECK, UNIQUE; six original functions and six exact triggers
-- (one progression + five downstream grant-table triggers), all MD5-guarded.
\i scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql

DO $after$
DECLARE v_original integer;v_downstream integer;
BEGIN
 IF to_regclass('public.character_option_grant_instances') IS NULL
 OR to_regclass('public.character_option_grants') IS NULL
 OR md5(pg_get_functiondef(
  'private.materialize_player_forge_feat_instances_v1()'::regprocedure))
    <> 'c27c4181a51cfd018bbb8244e9931550'
 THEN RAISE EXCEPTION 'C34-T6 original function/table not source-verified';
 END IF;
 SELECT count(*) INTO v_original
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
 AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF v_original<>17 THEN
   RAISE EXCEPTION 'C34-T6 expected 15 original Forge triggers and two proposed NPC privacy; got %',v_original;
 END IF;
 SELECT count(*) INTO v_downstream
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
 AND c.relname IN ('character_option_grant_instances','character_option_grants');
 IF v_downstream<>5 THEN
   RAISE EXCEPTION 'C34-T6 missing five source-original grant-table downstream guards/hooks, found %',v_downstream;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger t
  WHERE t.tgrelid='public.character_progression'::regclass
    AND t.tgname='character_progression_materialize_player_forge_feat_instances_v'
    AND NOT t.tgisinternal AND t.tgenabled='O'
    AND pg_get_triggerdef(t.oid,true) LIKE '%AFTER INSERT%')
 THEN RAISE EXCEPTION 'C34-T6 original feat materializer event or trigger missing'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
 AND tgname IN ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'C34-T6 explicitly excludes world-map movement triggers'; END IF;
END $after$;
NOTIFY pgrst,'reload schema';
\echo 'PASS C34-T6-SETUP: 15 original /31 progression+other triggers, 2 held privacy, 5 exact grant-side original triggers; no hosted writes'

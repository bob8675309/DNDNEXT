-- C34 T7 disposable research only: original #324 source-exact candidate
-- to seed current-transaction verified creator BEFORE original immediate feat
-- materializer. Do not apply to a hosted or persistent database.
\set ON_ERROR_STOP on
DO $c34_t7_guard$
DECLARE n int;
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('private.character_creator_attribution') IS NULL
  OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
  OR to_regprocedure('private.capture_character_creator_on_insert_v1()') IS NULL
  OR to_regprocedure('private.materialize_player_forge_feat_instances_v1()') IS NULL
  OR to_regprocedure('private.seed_verified_forge_progression_creator_v1()') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_trigger
   WHERE NOT tgisinternal AND tgname='character_progression_seed_verified_forge_creator_v1')
 THEN RAISE EXCEPTION 'C34 T7 requires unchanged local T6 sources; deny other targets'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
  AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF n<>17 THEN RAISE EXCEPTION 'C34 T7 requires 15 source-original+2 held privacy triggers; found %',n; END IF;
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE NOT t.tgisinternal AND t.tgenabled='O'
      AND c.relname IN ('character_option_grant_instances','character_option_grants'))<>5
 THEN RAISE EXCEPTION 'C34 T7 requires all five source-exact grant-side trigger guards'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.character_option_grant_instances gi
       JOIN public.character_progression cp ON cp.character_id=gi.character_id
       WHERE gi.granted_by IS NULL AND cp.created_by IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM public.character_option_grants g
       JOIN public.character_progression cp ON cp.character_id=g.character_id
       WHERE g.granted_by IS NULL AND cp.created_by IS NOT NULL)
 THEN RAISE EXCEPTION 'C34 T7 requires observed original NULL actor RED baseline on BOTH grant tables'; END IF;
END $c34_t7_guard$;

-- Exact held #324 candidate, source SHA ecddcd514917a4d379d14b02477dfb41dbf44f29.
-- Does not alter any original source-original functions, backfill grant rows,
-- create new external RPCs, or add grants for unrelated/Admin NPC records.
\i sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql

DO $c34_t7_after$
DECLARE d text;n int;
BEGIN
 SELECT pg_get_triggerdef(t.oid,true) INTO d
 FROM pg_trigger t
 WHERE t.tgname='character_progression_seed_verified_forge_creator_v1'
  AND t.tgrelid='public.character_progression'::regclass
  AND NOT t.tgisinternal AND t.tgenabled='O';
 IF d IS NULL OR position('BEFORE INSERT ON character_progression' in d)=0
    OR position('private.seed_verified_forge_progression_creator_v1()' in d)=0
 THEN RAISE EXCEPTION 'C34 T7 source-only verified creator seed DDL/timing differs: %',d; END IF;
 IF md5(pg_get_functiondef('private.sync_character_progression_from_sheet_v1()'::regprocedure))
       <> 'bb1a3a2d1600ce33cd4fcadac5e0f3a9'
 OR md5(pg_get_functiondef('private.materialize_player_forge_feat_instances_v1()'::regprocedure))
       <> 'c27c4181a51cfd018bbb8244e9931550'
 THEN RAISE EXCEPTION 'C34 T7 original source fingerprint changed'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
  AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF n<>18 THEN RAISE EXCEPTION 'C34 T7 expected 15 original+2 held privacy+1 held candidate, found %',n; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
    ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'World-map triggers prohibited from T7 fixture'; END IF;
END $c34_t7_after$;
NOTIFY pgrst,'reload schema';
\echo 'PASS C34-T7-SETUP: unchanged original #324 BEFORE creator seed applied only after T6 NULL actor RED; no old grant backfill'

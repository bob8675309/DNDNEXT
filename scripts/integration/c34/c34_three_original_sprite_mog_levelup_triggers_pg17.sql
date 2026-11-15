-- C34-T3: three more ORIGINAL deployed source-exact creation-adjacent
-- triggers from held #345, in the same disposable signed PG17 DB as T1/T2.
-- No production, Vercel, map movement, route or rendering changes.
-- Original SQL files are byte-identical Git blobs, not hand-rewritten bodies.
\set ON_ERROR_STOP on
DO $t3_guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('private.character_creator_attribution') IS NULL
 OR to_regclass('public.character_sheets') IS NULL
 OR to_regclass('public.inventory_items') IS NULL
 OR to_regprocedure('private.sync_character_portrait_library_id_v1()') IS NULL
 OR to_regprocedure('private.guard_player_character_tag_update_v1()') IS NULL
 OR to_regprocedure('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)') IS NULL
 OR to_regclass('public.character_level_up_sessions') IS NOT NULL
 OR to_regprocedure('private.guard_character_visual_asset_sprite_v1()') IS NOT NULL
 OR to_regprocedure('private.protect_mog_delete_v1()') IS NOT NULL
 OR to_regprocedure('private.cancel_invalid_level_up_session_v1()') IS NOT NULL
 OR (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE NOT t.tgisinternal AND t.tgenabled='O'
      AND c.relname IN ('character_progression','character_sheets','characters','inventory_items'))<>11
 THEN RAISE EXCEPTION 'C34-T3 requires exactly the source-verified 9 originals + 2 HELD NPC privacy triggers, disposable only';
 END IF;
END $t3_guard$;

-- Source-original SQL contains its own preflight, full original handler,
-- original trigger timing, original pg_get_functiondef MD5 guard, and
-- disposable synthetic reference catalog / session compatibility data.
\i scripts/fixtures/c33_forge_original_levelup_cancel_local_pg17.sql
\i scripts/fixtures/c33_forge_original_sprite_guard_local_pg17.sql
\i scripts/fixtures/c33_forge_original_mog_guard_local_pg17.sql

DO $t3_after$
BEGIN
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE NOT t.tgisinternal AND t.tgenabled='O'
        AND c.relname IN ('character_progression','character_sheets','characters','inventory_items'))<>14
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
      ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'C34-T3 must retain 12 original + 2 held privacy; world movement triggers must stay OUT'; END IF;
 IF md5(pg_get_functiondef('private.guard_character_visual_asset_sprite_v1()'::regprocedure))
      <> '7f9bda0599640617039a841b35e5d5a6'
 OR md5(pg_get_functiondef('private.protect_mog_delete_v1()'::regprocedure))
      <> '80798b0ae487f01f1b9c3025fbfe992b'
 OR md5(pg_get_functiondef('private.cancel_invalid_level_up_session_v1()'::regprocedure))
      <> 'f6dcf56f72091961d0e9958e86367dd1'
 THEN RAISE EXCEPTION 'C34-T3 original source function MD5 drift'; END IF;
END $t3_after$;
NOTIFY pgrst,'reload schema';
\echo 'PASS C34-T3-SETUP: 12 original triggers + 2 HELD privacy, world movement triggers NOT installed'

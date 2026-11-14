-- C34 research ONLY: genuine nonce ledger + ORIGINAL materializer under local GoTrue.
-- This deliberately does NOT create the scratch duplicate nonce table from J85.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR to_regclass('auth.users') IS NULL
    OR to_regclass('private.test_admins') IS NULL
    OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
    OR to_regclass('private.character_creator_attribution') IS NULL
    OR to_regclass('public.character_backstory_secrets') IS NULL
    OR to_regprocedure('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)') IS NULL
    OR to_regclass('public.inventory_items') IS NOT NULL
 THEN RAISE EXCEPTION 'C34 requires original signed I1C suite on disposable PG17 + GoTrue; refusing setup'; END IF;
 IF (SELECT count(*) FROM pg_constraint
     WHERE conrelid='private.player_creation_intent_reservations_v1'::regclass
       AND conname='completed_intent_consistent')<>1
 THEN RAISE EXCEPTION 'C34 refuses the earlier dummy/incorrect nonce table'; END IF;
END $guard$;
-- The original J85 materializer uses these two guard-only scratch tables.
-- They are not a production implementation of option grants or wallets.
CREATE TABLE public.character_option_grant_instances(id uuid PRIMARY KEY);
CREATE TABLE public.player_wallets(user_id uuid PRIMARY KEY);
\i scripts/fixtures/forge_materializer_local_auth_extension_pg17.sql
DO $source$
BEGIN
 IF md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure))
       <> '653e1b9d7cc47dcff2cef33a674b97f4'
 OR md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_trigger_v1()'::regprocedure))
       <> '23fa54dd0a6d7b42b802d613f39ea27c'
 OR md5(pg_get_functiondef('private.sync_character_progression_from_sheet_v1()'::regprocedure))
       <> 'bb1a3a2d1600ce33cd4fcadac5e0f3a9'
 THEN RAISE EXCEPTION 'C34 original equipment source drift'; END IF;
END $source$;
\echo 'PASS C34-JOIN01: real original nonce table coexists with original deferred equipment materializer (source-exact)'

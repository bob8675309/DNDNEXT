-- I1-D disposable source-composed Forge/Story/inventory setup ONLY.
-- Requires source-original #324 nonce + #345 privacy Stage1-3 + signed I1-C.
-- In contrast to C33's pre-nonce scratch, KEEP the REAL #324 reservation
-- table; do not replace it with any guard-only stub.
-- Six equipment selection helpers remain documented reduced synthetic stubs.
-- NOT a migration; NEVER execute outside a local disposable PG17/GoTrue DB.
\set ON_ERROR_STOP on
DO $i1d_guard$
BEGIN
 IF current_database()<>'postgres'
   OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
   OR to_regclass('auth.users') IS NULL
   OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
   OR to_regclass('private.character_creator_attribution') IS NULL
   OR to_regprocedure('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)') IS NULL
   OR to_regclass('public.inventory_items') IS NOT NULL
   OR to_regclass('public.character_option_grant_instances') IS NOT NULL
   OR to_regclass('public.player_wallets') IS NOT NULL
   OR to_regprocedure('private.can_access_character_v1(uuid,text)') IS NULL
   OR (SELECT count(*) FROM pg_attribute
        WHERE attrelid='private.player_creation_intent_reservations_v1'::regclass
          AND attname IN ('request_id','owner_user_id','creation_api','intent_sha256','character_id')
          AND NOT attisdropped)<>5
 THEN RAISE EXCEPTION 'I1-D must start from source-locked signed I1-C on disposable PG17';
 END IF;
END $i1d_guard$;

-- Guard-only slots required by the original equipment materializer. These
-- are NOT a source implementation or validation of actual option grants/wallet.
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
 OR (SELECT count(*) FROM pg_trigger
    WHERE NOT tgisinternal
      AND ((tgrelid='public.character_progression'::regclass
            AND tgname='character_progression_materialize_player_forge_starting_equipme'
            AND tgdeferrable AND tginitdeferred)
        OR (tgrelid='public.character_sheets'::regclass
            AND tgname='sync_character_progression_from_sheet_v1')))<>2
 THEN RAISE EXCEPTION 'I1-D original materializer/progression source drift';
 END IF;
END $source$;
NOTIFY pgrst,'reload schema';
\echo 'PASS I1D-SETUP: ORIGINAL deferred equipment/sheet sync, true #324 nonce and I1-C Story wrapper coexist; other original trigger dependencies still omitted'

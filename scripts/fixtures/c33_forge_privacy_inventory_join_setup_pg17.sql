-- C3.3 joint original-Forge + three-stage NPC privacy + inventory CHECK/RLS.
-- Disposable PG17 local GoTrue research only. This file is NOT a migration.
-- Run only after C3J00–C3J11 signed character/privacy acceptance, in the same
-- empty CI database, before combined owner-check hardening.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database() <> 'postgres'
   OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
   OR to_regclass('auth.users') IS NULL
   OR to_regclass('public.characters') IS NULL
   OR to_regclass('public.inventory_items') IS NOT NULL
   OR to_regclass('private.character_creator_attribution') IS NULL
   OR to_regprocedure('private.can_access_character_v1(uuid,text)') IS NULL
   OR md5(pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure))
     <> '97b5e6b059e6467e24c4283fe420c83e'
   OR (SELECT count(*) FROM pg_trigger t
       WHERE t.tgrelid='public.characters'::regclass
         AND t.tgname IN (
           'characters_capture_creator_at_insert_v1',
           'characters_guard_player_gm_secret_at_insert_v1'
         ) AND NOT t.tgisinternal)<>2
 THEN RAISE EXCEPTION 'C3.3 joint inventory extension requires exact disposable signed privacy state';
 END IF;
END $gate$;

-- Guard-only scratch compatibility tables. These are NOT the real immutable
-- intent / option-grant / wallet implementation and are NEVER used as proof
-- of those systems. The original materializer and J78/J85 helper guards only
-- check that these named tables exist; the six source helper stubs remain
-- the same documented subset as the previously green Forge J12–J102 suite.
CREATE TABLE private.player_creation_intent_reservations_v1 (request_id uuid PRIMARY KEY);
CREATE TABLE public.character_option_grant_instances (id uuid PRIMARY KEY);
CREATE TABLE public.player_wallets (user_id uuid PRIMARY KEY);

-- Install exactly the already verified source-original materializer,
-- deferred progression trigger and sheet->progression sync. Retain original
-- function MD5s and separately inspect other missing trigger definitions.
\i scripts/fixtures/forge_materializer_local_auth_extension_pg17.sql

DO $source$
BEGIN
 IF md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure))
      <> '653e1b9d7cc47dcff2cef33a674b97f4'
 OR md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_trigger_v1()'::regprocedure))
      <> '23fa54dd0a6d7b42b802d613f39ea27c'
 OR md5(pg_get_functiondef('private.sync_character_progression_from_sheet_v1()'::regprocedure))
      <> 'bb1a3a2d1600ce33cd4fcadac5e0f3a9'
 THEN RAISE EXCEPTION 'C3.3 joint original materializer source changed'; END IF;
END $source$;
NOTIFY pgrst,'reload schema';
\echo 'PASS C3I00: joined original Forge v2/v3 + NPC privacy stages now has original deferred equipment/sheet-sync trigger subset'

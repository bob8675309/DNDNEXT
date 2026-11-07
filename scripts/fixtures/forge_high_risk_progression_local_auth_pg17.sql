-- Research PR #324 J103–J110: bounded source-original progression trigger expansion.
-- ONLY disposable PG17 local Supabase GoTrue after J00–J102.
-- This is NOT a database migration or full 31-trigger production clone.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('private.test_admins') IS NULL
  OR to_regclass('public.character_option_grant_instances') IS NULL
  OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
  OR to_regclass('public.character_currency') IS NULL
  OR to_regclass('public.class_feature_option_catalog') IS NOT NULL
  OR to_regclass('public.character_class_option_grant_instances') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_constraint
     WHERE conrelid='public.inventory_items'::regclass
       AND conname='inventory_items_owner_type_chk')
  OR (SELECT count(*) FROM pg_policy
      WHERE polrelid='public.inventory_items'::regclass)<>4
  OR md5(pg_get_functiondef(
      'private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure))
        <>'653e1b9d7cc47dcff2cef33a674b97f4'
  THEN RAISE EXCEPTION 'J103 source trigger fixture only after safe J102 disposable PG17'; END IF;
END $gate$;

-- Live-schema shaped columns ONLY. No production Warlock or spell catalogs are
-- loaded; those branches cannot be claimed covered. These two tables only
-- satisfy source function rowtype declarations and unused branch references.
CREATE TABLE public.class_feature_option_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 option_key text NOT NULL, option_type text NOT NULL, name text NOT NULL,
 source text NOT NULL, class_key text, feature_types text[] NOT NULL DEFAULT '{}',
 page integer, description text, prerequisites jsonb NOT NULL DEFAULT '{}',
 additional_spells jsonb NOT NULL DEFAULT '[]',
 repeatable boolean NOT NULL DEFAULT false,
 choice_schema jsonb NOT NULL DEFAULT '{}',
 metadata jsonb NOT NULL DEFAULT '{}',
 raw_payload jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.character_class_option_grant_instances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL, instance_key text NOT NULL,
 option_catalog_id uuid NOT NULL, option_type text NOT NULL,
 acquired_level integer NOT NULL,
 choices jsonb NOT NULL DEFAULT '{}',
 metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- Preserve original function bodies verbatim. PG17 checks all three MD5s.
\i scripts/fixtures/forge_high_risk_original_progression_triggers_pg17.sql

DO $sources$
BEGIN
 IF md5(pg_get_functiondef('private.materialize_player_forge_source_magic_v1()'::regprocedure))
    <>'4c35eaab8dff7d3d15b64ed71881d4a6'
 OR md5(pg_get_functiondef('private.validate_and_materialize_player_forge_class_options_v1()'::regprocedure))
    <>'6df5aee6f0519c9c77758d6e887ed8e4'
 OR md5(pg_get_functiondef('private.validate_player_forge_starting_magic_exactness_v1()'::regprocedure))
    <>'ba645ad0f2c17addad0b40e0602c2ac8'
 THEN RAISE EXCEPTION 'J103 original progression trigger source drift'; END IF;
END $sources$;

-- EXACT live PG17 trigger names, event sets and deferral semantics.
CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_source_magic_v1
 AFTER INSERT ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.materialize_player_forge_source_magic_v1();

CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_class_options_v1
 AFTER INSERT ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.validate_and_materialize_player_forge_class_options_v1();

CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_starting_magic_exac
 AFTER INSERT OR UPDATE ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.validate_player_forge_starting_magic_exactness_v1();

DO $trigger_check$
BEGIN
 IF (SELECT count(*) FROM pg_trigger
   WHERE tgrelid='public.character_progression'::regclass
     AND NOT tgisinternal
     AND tgname IN (
       'character_progression_materialize_player_forge_source_magic_v1',
       'character_progression_validate_player_forge_class_options_v1',
       'character_progression_validate_player_forge_starting_magic_exac')
     AND tgenabled='O' AND tgdeferrable AND tginitdeferred)<>3
 OR (SELECT count(*) FROM pg_trigger
   WHERE tgrelid='public.character_progression'::regclass
     AND NOT tgisinternal AND tgdeferrable AND tginitdeferred)<3
 THEN RAISE EXCEPTION 'J103 trigger count/timing parity'; END IF;
END $trigger_check$;
\echo 'PASS J103 original source-magic, Warlock class options, and starting-magic exactness triggers installed; reduced catalog / scope explicit'

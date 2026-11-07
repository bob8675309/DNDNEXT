-- Disposable-only original deferred starting-equipment sheet validator.
-- Install AFTER J00-J16 original Forge/nonce/materializer tests so early tests
-- retain their previous reduced-scope fixture. NOT a live migration.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
   OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
   OR to_regclass('public.character_option_catalog') IS NULL
   OR to_regclass('public.character_currency') IS NULL
   OR to_regclass('private.test_admins') IS NULL
   OR EXISTS(SELECT 1 FROM pg_trigger
       WHERE tgname='character_sheets_validate_player_forge_starting_equipment_v1')
 THEN RAISE EXCEPTION 'Only local PG17 after original gear JWT test setup'; END IF;
END $guard$;
-- A disposable sourced Background. Actual class and source catalogue
-- variants are NOT reproduced; this is one valid XPHB matching-background case.
INSERT INTO public.character_option_catalog(id,option_type,name,source,metadata)
VALUES('00000000-0000-0000-0000-000000009150','background','Soldier','XPHB',
 '{"equipment":[]}'::jsonb);
\i scripts/fixtures/forge_equipment_validator_original_pg17.sql
CREATE CONSTRAINT TRIGGER character_sheets_validate_player_forge_starting_equipment_v1
 AFTER INSERT OR UPDATE OF sheet ON public.character_sheets
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.validate_player_forge_starting_equipment_sheet_v1();
\echo 'PASS FIXTURE: installed source-original deferred sheet equipment validator with Soldier Background'

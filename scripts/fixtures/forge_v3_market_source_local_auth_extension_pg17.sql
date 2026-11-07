-- Source-qualified Fighter v3 starting-market AFTER J00–J93 success.
-- Disposable GoTrue/PostgREST PG17 only, NEVER apply to DnDWeb production.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR to_regclass('public.character_currency') IS NULL
 OR to_regclass('public.character_stock') IS NULL
 OR to_regprocedure('public.create_player_character_v3(jsonb,jsonb,jsonb)') IS NULL
 OR to_regprocedure('private.materialize_player_forge_starting_equipment_v1(uuid)') IS NULL
 OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass AND conname='inventory_items_owner_type_chk')
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4
 OR md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure))<>'653e1b9d7cc47dcff2cef33a674b97f4'
 THEN RAISE EXCEPTION 'J94 source market must run only after disposable J93 combined RLS candidate'; END IF;
END $gate$;
-- Original cash option and currency formatter from DnDWeb, unchanged.
\i scripts/fixtures/forge_market_cash_original_functions_pg17.sql
DO $source$
BEGIN
 IF md5(pg_get_functiondef('private.player_forge_cash_equipment_option_v1(jsonb)'::regprocedure))<>'78231b02e56477cedd90992e42826597'
 OR md5(pg_get_functiondef('private.format_copper_currency_v1(bigint)'::regprocedure))<>'f7f8dce93e3d20a5c35fccee0bcf374b'
 THEN RAISE EXCEPTION 'J94 actual cash/formatter original source drift'; END IF;
END $source$;
-- Direct read-only live XPHB Fighter startingEquipment defaultData captured 2026-11-05.
-- Real 2024 cash option C=15500 copper; homebrew budget floor is 30000.
-- dndnext-homebrew uses a 30000 copper starting-market floor, vanilla uses 15500.
UPDATE public.class_catalog
SET raw_payload=jsonb_set(raw_payload,'{startingEquipment}',
 '{"defaultData": [{"A": [{"item": "Chain Mail|XPHB"}, {"item": "Greatsword|XPHB"}, {"item": "Flail|XPHB"}, {"item": "Javelin|XPHB", "quantity": 8}, {"item": "Dungeoneer''s Pack|XPHB"}, {"value": 400}]}, {"B": [{"item": "Studded Leather Armor|XPHB"}, {"item": "Scimitar|XPHB"}, {"item": "Shortsword|XPHB"}, {"item": "Longbow|XPHB"}, {"item": "Arrow|XPHB", "quantity": 20}, {"item": "Quiver|XPHB"}, {"item": "Dungeoneer''s Pack|XPHB"}, {"value": 1100}]}, {"C": [{"value": 15500}]}]}'::jsonb,true)
WHERE class_key='fighter' AND source='XPHB';
DO $class$
DECLARE v_cash jsonb;
BEGIN
 SELECT private.player_forge_cash_equipment_option_v1(raw_payload#>'{startingEquipment,defaultData}') INTO v_cash
 FROM public.class_catalog WHERE class_key='fighter' AND source='XPHB';
 IF v_cash->>'key'<>'C' OR (v_cash->>'copper')::bigint<>15500
 THEN RAISE EXCEPTION 'J94 live XPHB Fighter cash alternative differs'; END IF;
END $class$;
NOTIFY pgrst,'reload schema';
\echo 'PASS J94 source-original cash/formatters and live XPHB Fighter market alternative installed after hardened inventory candidate'

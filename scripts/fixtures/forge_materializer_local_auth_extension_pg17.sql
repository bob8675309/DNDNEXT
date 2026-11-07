-- DNDNext Research PR #324, local Auth follow-up.
-- Install ORIGINAL private deferred starting equipment materializer, deferred
-- trigger body, and sheet->progression trigger after the earlier J00-J11 tests.
-- Original functions copied unchanged from held PR #317; 19 other CP triggers,
-- real item catalogs, and 4 sheet triggers NOT replicated. Never production.
\set ON_ERROR_STOP on
DO $local_guard$
BEGIN
 IF current_database() <> 'postgres'
   OR current_setting('server_version_num')::int < 170000
   OR to_regclass('private.test_admins') IS NULL
   OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
   OR to_regclass('public.character_currency') IS NOT NULL
   OR to_regclass('auth.users') IS NULL
 THEN RAISE EXCEPTION 'Only PR324 disposable local Auth PG17 after replay setup'; END IF;
END $local_guard$;

ALTER TABLE public.class_catalog
  ADD COLUMN raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE public.character_option_catalog (
 id uuid PRIMARY KEY,option_type text,name text,source text,metadata jsonb
);
CREATE TABLE public.items_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_key text UNIQUE,item_name text,item_type text,item_rarity text,
 description text,weight_lb numeric,payload jsonb
);
CREATE TABLE public.character_stock (
 id uuid PRIMARY KEY,character_id uuid REFERENCES public.characters(id),
 qty integer,display_name text,card_payload jsonb,price_gp numeric,item_id text
);
CREATE TABLE public.inventory_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid,item_id text,item_name text,item_type text,item_rarity text,
 item_description text,item_weight text,item_cost text,
 card_payload jsonb,owner_type text,owner_id text,is_equipped boolean,
 quantity integer,equip_slot text,updated_at timestamptz
);
CREATE TABLE public.character_currency (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id),
 copper_value bigint NOT NULL,source_breakdown jsonb NOT NULL,
 updated_at timestamptz NOT NULL,updated_by uuid
);
-- These SIX existing live helpers are deliberate simplified test stubs.
-- Their results exercise only package mode / a single source-like item.
CREATE FUNCTION private.player_forge_higher_level_wealth_v1(int,int)
RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $fn$ SELECT '{"copper":0,"magicItems":{}}'::jsonb $fn$;
CREATE FUNCTION private.player_forge_equipment_option_parts_v1(jsonb,text)
RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $fn$ SELECT CASE WHEN $2='A' AND
 jsonb_array_length(coalesce($1,'[]'::jsonb))>0
 THEN '[{"item":"training-dagger","quantity":1}]'::jsonb
 ELSE NULL::jsonb END $fn$;
CREATE FUNCTION private.player_forge_equipment_choice_allowed_v1(text,text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$ SELECT TRUE $fn$;
CREATE FUNCTION private.player_forge_cash_equipment_option_v1(jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $fn$ SELECT NULL::jsonb $fn$;
CREATE FUNCTION private.format_copper_currency_v1(bigint)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$ SELECT $1::text || ' cp' $fn$;
CREATE FUNCTION public.xp_threshold_for_level_v1(int)
RETURNS bigint LANGUAGE sql IMMUTABLE
AS $fn$ SELECT (ARRAY[0::bigint,300,900,2700,6500,14000,23000,34000,48000,64000,
 85000,100000,120000,140000,165000,195000,225000,265000,305000,355000])[
 greatest(1,least(20,coalesce($1,1)))] $fn$;

-- The next three CREATE FUNCTIONs are the original deployed source texts
-- with MD5 23fa54dd / 653e1b9d / bb1a3a2d.
\i scripts/fixtures/forge_materializer_original_functions_pg17.sql

UPDATE public.class_catalog
SET raw_payload='{"startingEquipment":{"defaultData":[{"key":"A"}]}}'::jsonb
WHERE class_key='fighter' AND source='XPHB';
INSERT INTO public.items_catalog(item_key,item_name,item_type,item_rarity,
 description,weight_lb,payload)
VALUES('training-dagger','Training Dagger','weapon','mundane',
 'Disposable source-like starting dagger',1,
 '{"source":"XPHB","value":200}'::jsonb);

-- Source-exact trigger class and timing; separate sheet-sync trigger can
-- expose CP/CS ordering but this reduced test does NOT establish global order.
CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_starting_equipme
 AFTER INSERT ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.materialize_player_forge_starting_equipment_trigger_v1();
CREATE TRIGGER sync_character_progression_from_sheet_v1
 AFTER INSERT OR UPDATE OF sheet ON public.character_sheets
 FOR EACH ROW EXECUTE FUNCTION private.sync_character_progression_from_sheet_v1();

DO $assert$
BEGIN
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid
     WHERE c.relname IN ('character_progression','character_sheets')
       AND t.tgname IN (
         'character_progression_materialize_player_forge_starting_equipme',
         'sync_character_progression_from_sheet_v1'))<>2
 THEN RAISE EXCEPTION 'Original deferred and sheet sync triggers not installed'; END IF;
END $assert$;
\echo 'PASS FIXTURE: source-original deferred materializer and sheet sync installed with six helper stubs'

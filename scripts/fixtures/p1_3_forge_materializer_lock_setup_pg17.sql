-- DNDNext P1.3 — disposable PG17 source-faithful Forge equipment lock slice.
-- This fixture creates scratch public/private schemas on an empty CI database;
-- it MUST NOT run on DnDWeb. Three exact function definitions come from the
-- live DnDWeb 2026-11-04 SELECT-only pg_get_functiondef inspection.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
  IF current_database() <> 'postgres'
     OR current_setting('server_version_num')::integer < 170000
     OR EXISTS (SELECT 1 FROM pg_class WHERE relname = 'characters'
                AND relnamespace = 'public'::regnamespace)
  THEN RAISE EXCEPTION 'Refusing source fixture outside empty disposable PG17 postgres DB'; END IF;
END $guard$;
CREATE SCHEMA private;

CREATE TABLE public.characters (
 id uuid PRIMARY KEY, name text NOT NULL,
 tags text[] NOT NULL DEFAULT '{}', storefront_enabled boolean DEFAULT false
);
CREATE TABLE public.class_catalog (
 id uuid PRIMARY KEY, class_key text NOT NULL, source text NOT NULL,
 raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.class_level_progression (class_id uuid, class_level int);
CREATE TABLE public.character_progression (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id),
 class_id uuid REFERENCES public.class_catalog(id),
 class_level int NOT NULL DEFAULT 1,
 experience_points bigint DEFAULT 0,
 pending_level_up boolean DEFAULT false,
 created_by uuid,
 updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.character_sheets (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id),
 sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.character_permissions (
 character_id uuid REFERENCES public.characters(id),
 user_id uuid NOT NULL,can_edit boolean NOT NULL DEFAULT false,
 created_at timestamptz DEFAULT now(),
 PRIMARY KEY(character_id,user_id)
);
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

-- The original materializer calls these already-existing live helpers.
-- They are REPLACED WITH MINIMAL TEST STUBS, so this fixture proves the
-- source lock prefix + one package inventory path, NOT full source recipes.
CREATE FUNCTION private.player_forge_higher_level_wealth_v1(int,int)
RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $fn$ SELECT '{"copper":0,"magicItems":{}}'::jsonb $fn$;
CREATE FUNCTION private.player_forge_equipment_option_parts_v1(jsonb,text)
RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $fn$
 SELECT CASE WHEN $2='A'
              AND jsonb_array_length(coalesce($1,'[]'::jsonb))>0
             THEN '[{"item":"training-dagger","quantity":1}]'::jsonb
             ELSE NULL::jsonb END
$fn$;
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

-- Source-exact functions retain original SQL, locking and transaction work.
\i scripts/fixtures/p1_3_forge_materializer_original_functions_pg17.sql

INSERT INTO public.class_catalog(id,class_key,source,raw_payload)
VALUES ('00000000-0000-0000-0000-000000003001','fighter','XPHB',
  '{"startingEquipment":{"defaultData":[{"key":"A"}]}}');
INSERT INTO public.items_catalog(item_key,item_name,item_type,item_rarity,
 description,weight_lb,payload)
VALUES ('training-dagger','Training Dagger','weapon','mundane',
 'Source-like scratch training item',1,'{"source":"XPHB","value":200}'::jsonb);
INSERT INTO public.characters(id,name) VALUES
 ('00000000-0000-0000-0000-000000003011','Deferred Materializer A'),
 ('00000000-0000-0000-0000-000000003012','Sheet Sync Race B');

-- Initial rows are inserted before attaching the sheet-sync trigger to avoid
-- accidentally starting a progression before the explicit deferred INSERT.
INSERT INTO public.character_sheets(character_id,sheet)
VALUES
 ('00000000-0000-0000-0000-000000003011',
  '{"classKey":"fighter","level":1,"meta":{"creator":"shared_character_forge_player_v2"},
     "startingEquipmentSelections":{"mode":"package","classOption":"A","ruleset":"vanilla"}}'::jsonb),
 ('00000000-0000-0000-0000-000000003012',
  '{"classKey":"fighter","level":1,"meta":{"creator":"shared_character_forge_player_v2"},
     "startingEquipmentSelections":{"mode":"package","classOption":"A","ruleset":"vanilla"}}'::jsonb);

-- Exact two original trigger definitions for the *relevant* slice.
-- Other live character_progression triggers deliberately NOT installed.
CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_starting_equipme
  AFTER INSERT ON public.character_progression
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION private.materialize_player_forge_starting_equipment_trigger_v1();
CREATE TRIGGER sync_character_progression_from_sheet_v1
  AFTER INSERT OR UPDATE OF sheet ON public.character_sheets
  FOR EACH ROW EXECUTE FUNCTION private.sync_character_progression_from_sheet_v1();

-- Case F01: check actual deferred scheduling and original inventory write.
BEGIN;
INSERT INTO public.character_progression(
 character_id,class_id,class_level,experience_points,created_by
) VALUES (
 '00000000-0000-0000-0000-000000003011',
 '00000000-0000-0000-0000-000000003001',1,0,
 '00000000-0000-0000-0000-000000003101'
);
DO $not_yet$
BEGIN
 IF EXISTS (SELECT 1 FROM public.inventory_items
   WHERE owner_id='00000000-0000-0000-0000-000000003011')
 OR EXISTS(SELECT 1 FROM public.character_currency
   WHERE character_id='00000000-0000-0000-0000-000000003011')
 THEN RAISE EXCEPTION 'Deferred materialization ran before COMMIT'; END IF;
END $not_yet$;
COMMIT;

DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.inventory_items
      WHERE owner_type='character' AND owner_id='00000000-0000-0000-0000-000000003011'
        AND card_payload->>'startingEquipment'='true')<>1
 OR (SELECT count(*) FROM public.character_currency
      WHERE character_id='00000000-0000-0000-0000-000000003011')<>1
 OR (SELECT sheet->'startingEquipmentSummary'
      FROM public.character_sheets
      WHERE character_id='00000000-0000-0000-0000-000000003011')='[]'::jsonb
 THEN RAISE EXCEPTION 'Original deferred materializer did not create expected inventory/currency/sheet'; END IF;
END $verify$;
\echo 'PASS F01 original deferred materializer writes exactly one item/currency at COMMIT'

-- Second character with a source-valid completed selection. The original
-- deferred trigger materializes it at COMMIT. A later original helper call
-- still acquires CP->CS before its already-materialized currency return.
-- CAUTION: a missing startingEquipmentSelections field does NOT reliably
-- early-return in deployed source, because jsonb_typeof(NULL) <> 'object'
-- evaluates to NULL (not TRUE). See the paired research report.
INSERT INTO public.character_progression(character_id,class_id,class_level,created_by)
VALUES ('00000000-0000-0000-0000-000000003012',
 '00000000-0000-0000-0000-000000003001',1,
 '00000000-0000-0000-0000-000000003102');

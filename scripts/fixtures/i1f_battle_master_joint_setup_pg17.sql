-- I1-F research ONLY: install exact original Battle Master handlers from live
-- pg_get_functiondef in an existing disposable I1-E PG17 / genuine GoTrue DB.
-- Preserve I1-C Story nonce, I1-D Stage4 and I1-E Wizard signed contracts.
-- Source-correct option IDs/name/source sourced SELECT-only from live catalog,
-- but other catalog metadata and all other class options are NOT copied here.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regprocedure('private.materialize_player_forge_wizard_final_v1()') IS NULL
 OR to_regprocedure('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)') IS NULL
 OR to_regclass('public.class_feature_catalog') IS NULL
 OR to_regclass('public.class_feature_option_catalog') IS NOT NULL
 OR to_regclass('public.character_class_option_grant_instances') IS NOT NULL
 OR to_regprocedure('private.materialize_player_forge_battle_master_maneuvers_v1()') IS NOT NULL
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4
 THEN RAISE EXCEPTION 'I1-F requires source-original I1-E signed disposable PostgreSQL17 schema'; END IF;
END $guard$;

-- Real original XPHB Fighter subclass identity; only synthetic class-feature
-- specimen metadata, with original source spell catalog left untouched.
INSERT INTO public.class_feature_catalog
(id,feature_key,feature_type,name,source,class_key,class_name,
 class_source,subclass_name,subclass_short_name,level)
VALUES
('00000000-0000-0000-0000-000000008804',
 'subclass:fighter:xphb:battle-master:battle-master:xphb:3',
 'subclass','Battle Master','XPHB','fighter','Fighter','XPHB',
 'Battle Master','Battle Master',3);
INSERT INTO public.class_level_progression
(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots)
VALUES
('00000000-0000-0000-0000-000000000001',3,900,2,'[]'::jsonb),
('00000000-0000-0000-0000-000000000001',10,64000,4,'[]'::jsonb);

-- The original handlers reference these two real production table types.
-- Recreate only the required constraints/columns here; owner-RLS and grants
-- from production are NOT represented by this reduced test table.
CREATE TABLE public.class_feature_option_catalog(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 option_key text NOT NULL UNIQUE,
 option_type text NOT NULL,
 name text NOT NULL,
 source text NOT NULL,
 class_key text,
 feature_types text[] NOT NULL DEFAULT '{}'::text[],
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.character_class_option_grant_instances(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 instance_key text NOT NULL,
 option_catalog_id uuid NOT NULL REFERENCES public.class_feature_option_catalog(id) ON DELETE RESTRICT,
 option_type text NOT NULL,
 acquired_level integer NOT NULL CHECK (acquired_level BETWEEN 1 AND 20),
 choices jsonb NOT NULL DEFAULT '{}'::jsonb,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (character_id,instance_key)
);
-- Scratch public tables have no direct browser-role DML. The original
-- private source functions run as SECURITY DEFINER under the local owner.
ALTER TABLE public.class_feature_option_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_class_option_grant_instances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.class_feature_option_catalog,public.character_class_option_grant_instances FROM PUBLIC,anon,authenticated;

-- Original live XPHB Fighter maneuver IDs, keys, names and source (read-only).
-- Distinct canonical identity and level-gated slots, not fabricated catalog.
INSERT INTO public.class_feature_option_catalog
(id,option_key,option_type,name,source,class_key) VALUES
 ('37457afe-5996-4502-9651-130d25c059e6','optional-feature:ambush|XPHB','battle-master-maneuver','Ambush','XPHB','fighter'),
 ('e50d1c2c-3c17-4fcd-ae00-9df2a4dee83a','optional-feature:bait-and-switch|XPHB','battle-master-maneuver','Bait and Switch','XPHB','fighter'),
 ('cb18f479-a1a1-4455-9db9-c14dd591c9d8','optional-feature:commanders-strike|XPHB','battle-master-maneuver','Commander''s Strike','XPHB','fighter'),
 ('5988a57f-2afb-43e0-b5e1-1a9fe59f215a','optional-feature:commanding-presence|XPHB','battle-master-maneuver','Commanding Presence','XPHB','fighter'),
 ('b3b35d8d-ca6a-471e-9835-3ce5a1ef4666','optional-feature:disarming-attack|XPHB','battle-master-maneuver','Disarming Attack','XPHB','fighter'),
 ('4e6e3e61-f5fc-4d12-ae03-b6220d5b540c','optional-feature:distracting-strike|XPHB','battle-master-maneuver','Distracting Strike','XPHB','fighter'),
 ('f8a5b869-0690-4d6a-97a6-dd3f97219cbc','optional-feature:evasive-footwork|XPHB','battle-master-maneuver','Evasive Footwork','XPHB','fighter'),
 ('cb02ba27-0ba9-41c8-b55e-0a06421da568','optional-feature:feinting-attack|XPHB','battle-master-maneuver','Feinting Attack','XPHB','fighter'),
 ('5af72334-d553-448e-a146-8e8aa270d024','optional-feature:goading-attack|XPHB','battle-master-maneuver','Goading Attack','XPHB','fighter'),
 ('959e68df-9541-4e89-92bb-30c3ec75c0ba','optional-feature:lunging-attack|XPHB','battle-master-maneuver','Lunging Attack','XPHB','fighter'),
 ('689feabb-37c2-4d7e-830a-6e28ecc5a615','optional-feature:maneuvering-attack|XPHB','battle-master-maneuver','Maneuvering Attack','XPHB','fighter'),
 ('59ccbe6c-ccc7-4aab-b363-e20721915f88','optional-feature:menacing-attack|XPHB','battle-master-maneuver','Menacing Attack','XPHB','fighter');

\i scripts/fixtures/i1f_battle_master_original_functions_pg17.sql

-- Source original DDL confirmed by SELECT-only live pg_get_triggerdef:
-- AFTER INSERT DEFERRABLE INITIALLY DEFERRED materialization
-- AFTER UPDATE OF class_id,subclass_name,subclass_source,class_level,
-- level_choices DEFERRABLE INITIALLY DEFERRED validation.
CREATE CONSTRAINT TRIGGER character_progression_materialize_battle_master_maneuvers_v1
 AFTER INSERT ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.materialize_player_forge_battle_master_maneuvers_v1();
CREATE CONSTRAINT TRIGGER character_progression_validate_battle_master_maneuvers_v1
 AFTER UPDATE OF class_id,subclass_name,subclass_source,class_level,level_choices
 ON public.character_progression DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.validate_existing_battle_master_maneuvers_v1();

-- Internal definer functions are not a public API.
REVOKE ALL ON FUNCTION private.is_xphb_battle_master_v1(uuid,text,text),
 private.materialize_player_forge_battle_master_maneuvers_v1(),
 private.validate_existing_battle_master_maneuvers_v1()
 FROM PUBLIC,anon,authenticated;

DO $verify$
DECLARE materializer text; validator text;
BEGIN
 SELECT pg_get_triggerdef(oid,true) INTO materializer
 FROM pg_trigger WHERE tgname='character_progression_materialize_battle_master_maneuvers_v1'
 AND tgrelid='public.character_progression'::regclass AND NOT tgisinternal;
 SELECT pg_get_triggerdef(oid,true) INTO validator
 FROM pg_trigger WHERE tgname='character_progression_validate_battle_master_maneuvers_v1'
 AND tgrelid='public.character_progression'::regclass AND NOT tgisinternal;
 IF materializer IS NULL OR materializer NOT LIKE '%AFTER INSERT%'
 OR materializer NOT LIKE '%DEFERRABLE INITIALLY DEFERRED%'
 OR materializer NOT LIKE '%private.materialize_player_forge_battle_master_maneuvers_v1()%'
 OR validator IS NULL OR validator NOT LIKE '%AFTER UPDATE OF%'
 OR validator NOT LIKE '%DEFERRABLE INITIALLY DEFERRED%'
 OR validator NOT LIKE '%private.validate_existing_battle_master_maneuvers_v1()%'
 THEN RAISE EXCEPTION 'I1-F trigger event/timing source contract mismatch'; END IF;
 IF (SELECT count(*) FROM public.class_feature_option_catalog
     WHERE source='XPHB' AND option_type='battle-master-maneuver' AND class_key='fighter')<>12
 THEN RAISE EXCEPTION 'I1-F canonical source-grounded Battle Master catalog incomplete'; END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
\echo 'PASS I1F SETUP: two original deferred Battle Master handlers, three exact helper bodies and 12 live-grounded XPHB options installed in local PG17'

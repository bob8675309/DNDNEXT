-- C34-T5 RESEARCH ONLY: original deferred Forge progression AUTHORITY handler.
-- Runs strictly after signed T1-T4 on disposable PG17/GoTrue/PostgREST.
-- Does NOT apply migrations, alter production DB, or rewrite original functions.
-- Source-original five function bodies: scripts/fixtures/forge_progression_authority_original_pg17.sql
-- Two original preferred-option view definitions extracted unchanged from
-- held #324 blob 413a82dc3c1913cb5f71c28531d31e19da89e02d.
\set ON_ERROR_STOP on
DO $c34_preflight$
DECLARE v_count integer;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('private.character_creator_attribution') IS NULL
 OR to_regclass('public.character_currency') IS NULL
 OR to_regclass('public.character_option_catalog') IS NULL
 OR to_regclass('public.class_feature_catalog') IS NULL
 OR to_regclass('public.character_sheets') IS NULL
 OR to_regclass('public.character_spells') IS NULL
 OR to_regclass('public.spells_catalog') IS NULL
 OR to_regclass('public.inventory_items') IS NULL
 OR to_regprocedure('private.apply_character_forge_subclass_choice_v1()') IS NULL
 OR to_regprocedure('private.validate_player_forge_authority_payload_v1()') IS NOT NULL
 OR to_regclass('public.character_option_visibility') IS NOT NULL
 OR to_regclass('private.player_forge_source_choice_legacy_v1') IS NOT NULL
 OR to_regclass('public.character_option_catalog_preferred') IS NOT NULL
 OR to_regclass('public.character_option_catalog_all_preferred') IS NOT NULL
 OR EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='character_option_catalog'
       AND column_name IN ('option_key','category','prerequisite_text','raw_payload','tags'))
 OR EXISTS(SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='spells_catalog'
       AND column_name='casting_time')
 THEN RAISE EXCEPTION 'C34-T5 requires original post-T4 reduced fixture, no pre-existing authority/catalog views'; END IF;
 SELECT count(*) INTO v_count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND
 c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF v_count<>15 THEN RAISE EXCEPTION 'C34-T5 requires 13 original+2 held privacy triggers, got %',v_count; END IF;
END $c34_preflight$;

-- Add only original source-REFERENCED columns. Do not change the existing
-- class_feature_catalog or subclass_name/source created by T4.
ALTER TABLE public.character_option_catalog
 ADD COLUMN option_key text,
 ADD COLUMN category text,
 ADD COLUMN description text,
 ADD COLUMN prerequisite_text text,
 ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
 ADD COLUMN raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.spells_catalog
 ADD COLUMN ritual boolean DEFAULT false,
 ADD COLUMN damage_types text[] DEFAULT '{}'::text[],
 ADD COLUMN damage_dice text,
 ADD COLUMN school text,
 ADD COLUMN school_code text,
 ADD COLUMN casting_time text;
CREATE TABLE public.character_option_visibility (
 scope_key text NOT NULL DEFAULT 'default',
 option_id uuid NOT NULL,
 is_visible boolean NOT NULL DEFAULT true,
 updated_by uuid,
 updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.character_option_visibility ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_option_visibility FROM PUBLIC,anon,authenticated;
CREATE TABLE private.player_forge_source_choice_legacy_v1(
 character_id uuid PRIMARY KEY,
 recorded_at timestamptz DEFAULT now()
);
REVOKE ALL ON private.player_forge_source_choice_legacy_v1 FROM PUBLIC,anon,authenticated;

-- Five untouched original live PG17 function bodies from original #324 blob
-- 3a0b6caeb6712f67af7895433df15f1439b19581.
\i scripts/fixtures/forge_progression_authority_original_pg17.sql

-- Both original pg_get_viewdef definitions, copied verbatim from the held
-- J31 source, inside this disposable installer only.
CREATE VIEW public.character_option_catalog_all_preferred AS
WITH eligible AS (
         SELECT o.id,
            o.option_key,
            o.option_type,
            o.name,
            o.source,
            o.category,
            o.description,
            o.prerequisite_text,
            o.tags,
            o.metadata,
            o.raw_payload,
            o.created_at,
            o.updated_at,
                CASE
                    WHEN o.option_type = 'species'::text AND lower(btrim(o.name)) = 'faerie'::text THEN 'Fairy'::text
                    ELSE o.name
                END AS preferred_name
           FROM character_option_catalog o
          WHERE NOT (o.option_type = 'species'::text AND (lower(btrim(o.name)) = ANY (ARRAY['fairy'::text, 'gnome (deep)'::text, 'gith'::text])))
        ), preferred AS (
         SELECT DISTINCT ON (o.option_type, (lower(regexp_replace(btrim(o.preferred_name), '\s+'::text, ' '::text, 'g'::text)))) o.id,
            o.option_key,
            o.option_type,
            o.name,
            o.source,
            o.category,
            o.description,
            o.prerequisite_text,
            o.tags,
            o.metadata,
            o.raw_payload,
            o.created_at,
            o.updated_at,
            o.preferred_name
           FROM eligible o
          ORDER BY o.option_type, (lower(regexp_replace(btrim(o.preferred_name), '\s+'::text, ' '::text, 'g'::text))), (
                CASE
                    WHEN o.option_type = 'species'::text AND upper(o.source) = 'XPHB'::text THEN 0
                    WHEN o.option_type = 'species'::text AND upper(o.source) = 'MPMM'::text THEN 1
                    ELSE character_source_priority_v1(o.source) + 2
                END), o.source, o.updated_at DESC, o.id
        )
 SELECT id,
    option_key,
    option_type,
    preferred_name AS name,
    source,
    category,
    description,
    prerequisite_text,
    tags,
    metadata,
    raw_payload,
    created_at,
    updated_at
   FROM preferred;
CREATE VIEW public.character_option_catalog_preferred AS
SELECT p.id,
    p.option_key,
    p.option_type,
    p.name,
    p.source,
    p.category,
    p.description,
    p.prerequisite_text,
    p.tags,
    p.metadata,
    p.raw_payload,
    p.created_at,
    p.updated_at
   FROM character_option_catalog_all_preferred p
     LEFT JOIN character_option_visibility v ON v.scope_key = 'default'::text AND v.option_id = p.id
  WHERE p.option_type <> 'background'::text OR COALESCE(v.is_visible, true);

-- Reduced catalog rows from original J31 fixture, NOT full feat/source parity.
INSERT INTO public.character_option_catalog
 (id,option_key,option_type,name,source,category,metadata)
VALUES
 ('00000000-0000-0000-0000-000000009153','defense','feat','Defense','XPHB','FS','{}'::jsonb),
 ('00000000-0000-0000-0000-000000009154','lucky','feat','Lucky','XPHB','O','{"repeatable":false}'::jsonb);

DO $original_md5$
DECLARE v_ddl text;v_count integer;
BEGIN
 IF md5(pg_get_functiondef('private.validate_player_forge_authority_payload_v1()'::regprocedure))
     <> '48006f8db76e9b32c96fcd2b6a4b3080'
 OR md5(pg_get_functiondef('private.validate_player_forge_feat_instances_v1(jsonb)'::regprocedure))
     <> '409802af8c5255171ff41bb4a0da694f'
 OR md5(pg_get_functiondef('private.normalize_player_choice_name_v1(text)'::regprocedure))
     <> 'dd8cdd5b47efe99b1cfff9c2bf7635dd'
 OR md5(pg_get_functiondef('private.player_forge_choice_option_is_valid_v1(uuid,integer,text,jsonb,jsonb)'::regprocedure))
     <> '586637a9e0e55e19ee335c3efd6ea2b9'
 OR md5(pg_get_functiondef('public.character_source_priority_v1(text)'::regprocedure))
     <> 'fdcc080cd95e6ce282631191869893c1'
 THEN RAISE EXCEPTION 'C34-T5 original source guard MD5 mismatch'; END IF;
END $original_md5$;

CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_authority_v1
 AFTER INSERT OR UPDATE OF class_id, class_level ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.validate_player_forge_authority_payload_v1();

DO $t5_after$
DECLARE v_ddl text; v_total integer;
BEGIN
 SELECT pg_get_triggerdef(t.oid,true) INTO v_ddl FROM pg_trigger t
 WHERE t.tgname='character_progression_validate_player_forge_authority_v1'
  AND t.tgrelid='public.character_progression'::regclass
  AND NOT t.tgisinternal AND t.tgenabled='O';
 IF v_ddl IS NULL
  OR position('AFTER INSERT OR UPDATE OF class_id, class_level' IN v_ddl)=0
  OR position('DEFERRABLE INITIALLY DEFERRED' IN v_ddl)=0
  OR position('private.validate_player_forge_authority_payload_v1()' IN v_ddl)=0
 THEN RAISE EXCEPTION 'C34-T5 wrong original deferred authority event/handler %',v_ddl; END IF;
 SELECT count(*) INTO v_total FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
  AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF v_total<>16 THEN RAISE EXCEPTION 'C34-T5 requires 14 original + 2 held privacy; got %',v_total; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
  AND tgname IN ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'C34-T5 refuses world-map route or resting/camping triggers'; END IF;
END $t5_after$;
NOTIFY pgrst,'reload schema';
\echo 'PASS C34-T5-SETUP: source-original deferred progression validator and all five functions, 14/31 original +2 held privacy'

-- Research only: source-exact additional original progression authority validator.
-- Requires disposable PG17 local GoTrue with J00-J30 successfully completed.
-- DO NOT APPLY TO PRODUCTION.  The source functions below are unchanged;
-- selected catalog records are explicit test specimens, NOT production data.
\set ON_ERROR_STOP on
DO $local_guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int < 170000
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('public.character_currency') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='character_sheets_authority_fields_guard_v1')
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='character_sheets_sync_player_tags_v1')
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='character_progression_validate_player_forge_authority_v1')
 THEN RAISE EXCEPTION 'Refuse non-disposable or out-of-order progression-authority source fixture'; END IF;
END $local_guard$;

-- Upgrade the REDUCED test catalogue with only the exact column shapes
-- referenced by the source-deployed view/functions. Not real catalog parity.
ALTER TABLE public.character_option_catalog
 ADD COLUMN option_key text, ADD COLUMN category text,
 ADD COLUMN description text, ADD COLUMN prerequisite_text text,
 ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
 ADD COLUMN raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.character_progression
 ADD COLUMN subclass_name text, ADD COLUMN subclass_source text;
ALTER TABLE public.spells_catalog
 ADD COLUMN ritual boolean DEFAULT false,
 ADD COLUMN damage_types text[] DEFAULT '{}'::text[],
 ADD COLUMN damage_dice text,
 ADD COLUMN school text, ADD COLUMN school_code text,
 ADD COLUMN casting_time text;

CREATE TABLE public.class_feature_catalog(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),feature_key text,
 feature_type text,name text,source text,
 class_key text,class_name text,class_source text,
 subclass_name text,subclass_short_name text,level smallint,
 description text,entries jsonb NOT NULL DEFAULT '[]'::jsonb,
 raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.character_option_visibility(
 scope_key text NOT NULL DEFAULT 'default',
 option_id uuid NOT NULL, is_visible boolean NOT NULL DEFAULT true,
 updated_by uuid, updated_at timestamptz DEFAULT now()
);
CREATE TABLE private.player_forge_source_choice_legacy_v1(
 character_id uuid PRIMARY KEY,recorded_at timestamptz DEFAULT now()
);
-- Four private validation helper bodies and one public source-priority
-- function copied byte-for-byte from live PG17; no permissive validation stubs.
\i scripts/fixtures/forge_progression_authority_original_pg17.sql

-- Both original live view definitions from pg_get_viewdef(...,true).
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

-- Deliberate isolated XPHB catalog entries for feat source validation.
INSERT INTO public.character_option_catalog(
 id,option_key,option_type,name,source,category,metadata)
VALUES
 ('00000000-0000-0000-0000-000000009153','defense','feat','Defense','XPHB','FS','{}'::jsonb),
 ('00000000-0000-0000-0000-000000009154','lucky','feat','Lucky','XPHB','O','{"repeatable":false}'::jsonb);

-- Compare the locally installed original handler functions to the exact
-- live read-only md5(pg_get_functiondef) source fingerprints at runtime.
DO $source_fidelity$
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
 THEN RAISE EXCEPTION 'Original deferred progression validator/helper source fingerprint mismatch'; END IF;
END $source_fidelity$;

CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_authority_v1
 AFTER INSERT OR UPDATE OF class_id, class_level ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.validate_player_forge_authority_payload_v1();
\echo 'PASS FIXTURE: deployed original progression authority validation and five exact-source functions, preferred-option view and specimen catalog installed'

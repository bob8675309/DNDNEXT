-- J164 original preferred-spell source helper and production-view SELECT.
-- Read-only live PG17 pg_get_functiondef md5 68993ebe31db168b77329aea0f466c5d
-- Read-only live PG17 pg_get_viewdef md5 84e356955cf21dca1df26ee3c1cd227a
-- Only disposable local PG17/GoTrue. The earlier minimal helper is a local
-- compatibility stub and is replaced with the UNEDITED live function after J163.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('public.spells_catalog') IS NULL
  OR to_regclass('public.spells_catalog_preferred') IS NOT NULL
  OR to_regprocedure('public.is_preferred_spell_version_v1(uuid)') IS NULL
  OR to_regprocedure('public.character_source_priority_v1(text)') IS NULL
  OR md5(pg_get_functiondef('public.character_source_priority_v1(text)'::regprocedure))<>'fdcc080cd95e6ce282631191869893c1'
  OR md5(pg_get_functiondef('private.validate_player_forge_nested_choice_payload_v1()'::regprocedure))<>'df2861cc76b0b74bb7cd57fbe61c9a05'
 THEN RAISE EXCEPTION 'Original preferred-spell view/function requires disposable post-J163 original source fixture';
 END IF;
END $gate$;

-- Local table deliberately omitted other source view projection columns.
-- Add only the missing type-compatible local projections. This is NOT full
-- production spell catalog, schema defaults, grants, RLS, or source inventory.
ALTER TABLE public.spells_catalog
 ADD COLUMN IF NOT EXISTS spell_key text,
 ADD COLUMN IF NOT EXISTS slug text,
 ADD COLUMN IF NOT EXISTS source_file text,
 ADD COLUMN IF NOT EXISTS page integer,
 ADD COLUMN IF NOT EXISTS subclasses text[],
 ADD COLUMN IF NOT EXISTS concentration boolean,
 ADD COLUMN IF NOT EXISTS casting_time_json jsonb,
 ADD COLUMN IF NOT EXISTS range_text text,
 ADD COLUMN IF NOT EXISTS range_type text,
 ADD COLUMN IF NOT EXISTS range_json jsonb,
 ADD COLUMN IF NOT EXISTS area_type text,
 ADD COLUMN IF NOT EXISTS area_size numeric,
 ADD COLUMN IF NOT EXISTS area_unit text,
 ADD COLUMN IF NOT EXISTS components_v boolean,
 ADD COLUMN IF NOT EXISTS components_s boolean,
 ADD COLUMN IF NOT EXISTS components_m boolean,
 ADD COLUMN IF NOT EXISTS material_text text,
 ADD COLUMN IF NOT EXISTS components_json jsonb,
 ADD COLUMN IF NOT EXISTS duration_text text,
 ADD COLUMN IF NOT EXISTS duration_json jsonb,
 ADD COLUMN IF NOT EXISTS saving_throw_abilities text[],
 ADD COLUMN IF NOT EXISTS healing_dice text,
 ADD COLUMN IF NOT EXISTS scaling_text text,
 ADD COLUMN IF NOT EXISTS scaling_json jsonb,
 ADD COLUMN IF NOT EXISTS description text,
 ADD COLUMN IF NOT EXISTS higher_level_text text,
 ADD COLUMN IF NOT EXISTS tags text[],
 ADD COLUMN IF NOT EXISTS misc_tags text[],
 ADD COLUMN IF NOT EXISTS area_tags text[],
 ADD COLUMN IF NOT EXISTS raw_payload jsonb,
 ADD COLUMN IF NOT EXISTS created_at timestamp with time zone,
 ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone,
 ADD COLUMN IF NOT EXISTS imported_at timestamp with time zone;

-- Verbatim server-rendered SELECT from live pg_get_viewdef(TRUE). Local
-- column projections supplied above; original source ordering preserved.
CREATE VIEW public.spells_catalog_preferred AS
SELECT DISTINCT ON ((lower(regexp_replace(btrim(name), '\s+'::text, ' '::text, 'g'::text)))) id,
    spell_key,
    slug,
    name,
    source,
    source_file,
    page,
    level,
    school_code,
    school,
    classes,
    subclasses,
    ritual,
    concentration,
    casting_time,
    casting_time_json,
    range_text,
    range_type,
    range_distance,
    range_unit,
    range_json,
    area_type,
    area_size,
    area_unit,
    components_v,
    components_s,
    components_m,
    material_text,
    components_json,
    duration_text,
    duration_json,
    saving_throw_abilities,
    attack_type,
    damage_dice,
    damage_types,
    healing_dice,
    scaling_text,
    scaling_json,
    description,
    higher_level_text,
    tags,
    misc_tags,
    area_tags,
    raw_payload,
    created_at,
    updated_at,
    imported_at
   FROM spells_catalog s
  ORDER BY (lower(regexp_replace(btrim(name), '\s+'::text, ' '::text, 'g'::text))), (character_source_priority_v1(source)), source, updated_at DESC, id;

-- Original reduced helper used argument name p_id; PostgreSQL won't rename
-- the argument via CREATE OR REPLACE. Drop only that disposable stub without
-- CASCADE, then restore the exact live p_spell_id signature and function text.
DROP FUNCTION public.is_preferred_spell_version_v1(uuid);
CREATE OR REPLACE FUNCTION public.is_preferred_spell_version_v1(p_spell_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select exists(select 1 from public.spells_catalog_preferred where id=p_spell_id);
$function$;

DO $fingerprints$
BEGIN
 IF md5(pg_get_functiondef('public.is_preferred_spell_version_v1(uuid)'::regprocedure))
    <> '68993ebe31db168b77329aea0f466c5d'
 OR md5(pg_get_viewdef('public.spells_catalog_preferred'::regclass,true))
    <> '84e356955cf21dca1df26ee3c1cd227a'
 OR (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='spells_catalog_preferred')<>47
 THEN RAISE EXCEPTION 'Exact original preferred-spell function/view fidelity mismatch';
 END IF;
END $fingerprints$;
\echo 'PASS J164 original live preferred-spell function MD5 and exact source-priority preferred view loaded in isolated PG17'

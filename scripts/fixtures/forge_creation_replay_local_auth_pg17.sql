-- Disposable Supabase CLI PostgreSQL 17 WITH REAL auth.users, auth.uid(),
-- auth.role(), GoTrue and PostgREST. Do not execute on production.
\set ON_ERROR_STOP on
DO $safe$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
   OR to_regclass('public.characters') IS NOT NULL
   OR to_regclass('auth.users') IS NULL
 THEN RAISE EXCEPTION 'Requires EMPTY local Supabase PG17 postgres, not DnDWeb production'; END IF;
END $safe$;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE public.class_catalog (
 id uuid PRIMARY KEY, class_key text, class_name text, source text,
 ruleset text, updated_at timestamptz DEFAULT now(), hit_die integer,
 spellcasting_ability text
);
CREATE TABLE public.class_level_progression (
 class_id uuid, class_level integer, xp_threshold bigint,
 proficiency_bonus integer, spell_slots jsonb
);
CREATE TABLE public.npc_portrait_library (
 id uuid PRIMARY KEY, is_active boolean, storage_path text, public_url text
);
CREATE TABLE public.npc_visual_assets (
 id uuid PRIMARY KEY, is_active boolean, portrait_library_id uuid,
 sprite_path text, default_scale double precision
);
CREATE TABLE public.spells_catalog (
 id uuid PRIMARY KEY, name text, level integer, classes text[]
);
CREATE TABLE public.characters (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 race text, role text, description text, motivation text, quirk text,
 mannerism text, voice text, secret text, affiliation text,
 status text, background text, tags text[], kind text,
 storefront_enabled boolean, portrait_library_id uuid, visual_asset_id uuid,
 creation_request_id uuid UNIQUE,
 portrait_url text, portrait_storage_path text, portrait_thumb_url text,
 portrait_shop_url text, portrait_source text, image_url text,
 sprite_key text, sprite_path text, sprite_scale double precision,
 location_id uuid, last_known_location_id uuid, home_location_id uuid,
 is_hidden boolean, state text, updated_at timestamptz
);
CREATE TABLE public.character_sheets (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id),
 sheet jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.character_permissions (
 character_id uuid NOT NULL REFERENCES public.characters(id),
 user_id uuid NOT NULL, can_inventory boolean NOT NULL,
 can_edit boolean NOT NULL, can_convert boolean NOT NULL,
 created_at timestamptz DEFAULT now(), PRIMARY KEY(character_id,user_id)
);
CREATE TABLE public.character_progression (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id),
 class_id uuid NOT NULL, class_level integer, experience_points bigint,
 pending_level_up boolean, created_by uuid, updated_at timestamptz
);
CREATE TABLE public.character_level_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id),
 event_type text NOT NULL, from_level integer, to_level integer,
 xp_before bigint, xp_after bigint, details jsonb NOT NULL,
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.character_spells (
 character_id uuid NOT NULL, spell_id uuid NOT NULL,
 source_type text, source_label text, prepared boolean,
 always_available boolean, casting_stat text, raw_payload jsonb
);
CREATE TABLE public.players (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid UNIQUE, name text NOT NULL,
 sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.class_catalog (
 id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability
) VALUES (
 '00000000-0000-0000-0000-000000000001',
 'fighter','Fighter','XPHB','2024',10,NULL
);
INSERT INTO public.class_level_progression (
 class_id,class_level,xp_threshold,proficiency_bonus,spell_slots
) VALUES (
 '00000000-0000-0000-0000-000000000001',1,0,2,'{}'::jsonb
);



-- Local-only Admin identity source. The exact original require_character_admin
-- function will query this reduced role helper. This is NOT live user_profiles.
CREATE TABLE private.test_admins(id uuid PRIMARY KEY);
CREATE FUNCTION private.current_user_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','private','auth'
AS $f$ SELECT EXISTS(SELECT 1 FROM private.test_admins WHERE id=auth.uid()) $f$;
ALTER TABLE public.spells_catalog ADD COLUMN source text DEFAULT 'XPHB';
ALTER TABLE public.character_spells
 ADD COLUMN source_key text NOT NULL DEFAULT 'class',
 ADD COLUMN known boolean NOT NULL DEFAULT true,
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX character_spells_source_unique
 ON public.character_spells(character_id,spell_id,source_type,source_key);
ALTER TABLE public.characters ADD COLUMN storefront_title text;
ALTER TABLE public.characters ADD COLUMN storefront_tagline text;
ALTER TABLE public.characters ADD COLUMN portrait_prompt text;
ALTER TABLE public.characters ALTER COLUMN location_id TYPE bigint USING null::bigint;
ALTER TABLE public.characters ALTER COLUMN last_known_location_id TYPE bigint USING null::bigint;
ALTER TABLE public.characters ALTER COLUMN home_location_id TYPE bigint USING null::bigint;
ALTER TABLE public.npc_visual_assets ADD COLUMN sprite_bucket text;
ALTER TABLE public.npc_visual_assets ADD COLUMN sprite_format text;
ALTER TABLE public.npc_visual_assets ADD COLUMN frame_width int;
ALTER TABLE public.npc_visual_assets ADD COLUMN frame_height int;
ALTER TABLE public.npc_visual_assets ADD COLUMN direction_order text[];
ALTER TABLE public.npc_visual_assets ADD COLUMN idle_frame int;
ALTER TABLE public.npc_visual_assets ADD COLUMN walk_frames int[];
ALTER TABLE public.npc_visual_assets ADD COLUMN fps int;
CREATE TABLE public.locations(id bigint PRIMARY KEY,npcs jsonb NOT NULL DEFAULT '[]'::jsonb);
CREATE FUNCTION private.location_roster_character_id_v1(p_entry jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT p_entry->>'id' $f$;
CREATE FUNCTION public.is_preferred_spell_version_v1(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE
AS $f$ SELECT EXISTS(SELECT 1 FROM public.spells_catalog WHERE id=p_id) $f$;
INSERT INTO public.class_catalog
(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability)
VALUES('00000000-0000-0000-0000-000000000002','wizard','Wizard','XPHB','2024',6,'int');
INSERT INTO public.class_level_progression
(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots)
VALUES('00000000-0000-0000-0000-000000000002',1,0,2,'{"1":2}'::jsonb);
INSERT INTO public.spells_catalog(id,name,level,classes,source) VALUES
 ('00000000-0000-0000-0000-000000000901','Fire Bolt',0,ARRAY['Wizard'],'XPHB'),
 ('00000000-0000-0000-0000-000000000902','Ray of Frost',0,ARRAY['Wizard'],'XPHB');

\i scripts/fixtures/forge_creator_trigger_original_stage3_pg17.sql
\i scripts/fixtures/forge_creation_original_functions_pg17.sql

REVOKE ALL ON FUNCTION public.create_player_character_v2(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_player_character_v2(jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.create_player_character_v3(jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_player_character_v3(jsonb,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.create_character_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_character_v1(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';

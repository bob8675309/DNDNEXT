-- P1.3 held-source additional Admin CP -> CS race fixture, PG17 only.
-- Execute AFTER p1_3_forge_materializer_lock_setup_pg17.sql (F01 prep).
-- DO NOT RUN AGAINST LIVE SUPABASE OR ANY DATABASE WITH REAL CHARACTERS.
\set ON_ERROR_STOP on
DO $only_scratch$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
    OR to_regclass('private.player_creation_intent_reservations_v1') IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.characters
      WHERE id='00000000-0000-0000-0000-000000003012'::uuid
        AND name='Sheet Sync Race B')
    OR NOT EXISTS(SELECT 1 FROM pg_trigger
      WHERE tgname='sync_character_progression_from_sheet_v1' AND NOT tgisinternal)
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='set_character_progression_v1')
 THEN RAISE EXCEPTION 'Refuse Admin progression race outside scratch PG17 Forge source setup'; END IF;
END $only_scratch$;

-- These supplementary class/event columns are from the live Admin source
-- dependency surface. Other live domain/enum and audit triggers stay omitted.
ALTER TABLE public.class_catalog
 ADD COLUMN class_name text, ADD COLUMN ruleset text, ADD COLUMN hit_die int;
UPDATE public.class_catalog SET class_name='Fighter',ruleset='XPHB',hit_die=10
 WHERE class_key='fighter' AND source='XPHB';
ALTER TABLE public.character_progression
 ADD COLUMN subclass_name text, ADD COLUMN subclass_source text;
CREATE TABLE public.character_level_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id),
 event_type text NOT NULL,
 from_level int,to_level int,xp_before bigint,xp_after bigint,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_by uuid,created_at timestamptz DEFAULT now()
);
CREATE SCHEMA auth;
-- Original public Admin RPC source is complete and unchanged, but these
-- three dependencies are deliberately REDUCED scratch helper stubs.
-- No real authenticated JWT, Admin-role authorization or browser is tested.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $f$ SELECT '00000000-0000-0000-0000-000000003199'::uuid $f$;
CREATE FUNCTION private.require_character_admin_v1() RETURNS void
 LANGUAGE plpgsql AS $f$ BEGIN RETURN; END $f$;
CREATE FUNCTION public.get_character_progression_v1(uuid) RETURNS jsonb
 LANGUAGE sql STABLE AS $f$
 SELECT jsonb_build_object('characterId',$1,'classLevel',p.class_level)
 FROM public.character_progression p WHERE p.character_id=$1 $f$;
-- Exact-original live source, not the fixture helper stubs:
\i scripts/fixtures/p1_3_admin_progression_original_pg17.sql

DO $fingerprint$
BEGIN
 IF md5(pg_get_functiondef(
  'public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)'::regprocedure))
  <> 'eb467b7c7a8d548581a36cfcb0d8f77b'
 OR md5(pg_get_functiondef(
  'private.sync_character_progression_from_sheet_v1()'::regprocedure))
  <> 'bb1a3a2d1600ce33cd4fcadac5e0f3a9'
 OR md5(pg_get_functiondef(
  'private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure))
  <> '653e1b9d7cc47dcff2cef33a674b97f4'
 THEN RAISE EXCEPTION 'Original Admin/Forge CP-CS source hash drift'; END IF;
END $fingerprint$;
\echo 'PASS F04 fixture source md5 runtime: original Admin CP->CS writer and original CS->CP sync, reduced Admin/helper context'

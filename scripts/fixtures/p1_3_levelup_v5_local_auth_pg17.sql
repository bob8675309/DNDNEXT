-- P1.3: actual SOURCE-ORIGINAL v5→v4→v3→base-v3 Fighter Lv1→Lv2,
-- original sheet-sync and class-spell-summary, with real local GoTrue auth.uid().
-- Disposable Supabase CLI PostgreSQL17 only. DO NOT APPLY TO LIVE DATABASE.
-- Only the no-options Fighter helper tails are reduced, explicitly checked.
\set ON_ERROR_STOP on
DO $check$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 OR to_regclass('auth.users') IS NULL OR to_regclass('public.characters') IS NOT NULL
 OR to_regclass('private.p13_levelup_case_guard') IS NOT NULL
 THEN RAISE EXCEPTION 'P1.3 levelup case refuses non-empty or non-Auth scratch DB'; END IF;
END $check$;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE private.p13_levelup_case_guard (scope text PRIMARY KEY);
INSERT INTO private.p13_levelup_case_guard VALUES('disposable');
CREATE TABLE public.characters(id uuid PRIMARY KEY,name text,kind text NOT NULL DEFAULT 'npc');
CREATE TABLE public.character_permissions(
 character_id uuid REFERENCES public.characters(id),user_id uuid NOT NULL REFERENCES auth.users(id),
 can_edit boolean NOT NULL DEFAULT false,
 PRIMARY KEY(character_id,user_id));
CREATE TABLE public.class_catalog(
 id uuid PRIMARY KEY,class_key text NOT NULL,class_name text NOT NULL,
 source text NOT NULL,ruleset text,hit_die int,spellcasting_ability text);
CREATE TABLE public.class_level_progression(
 class_id uuid REFERENCES public.class_catalog(id),class_level int,
 features jsonb NOT NULL DEFAULT '[]'::jsonb,xp_threshold bigint NOT NULL DEFAULT 0,
 proficiency_bonus int DEFAULT 2,cantrips_known int DEFAULT 0,spells_known int,
 spell_slots jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(class_id,class_level));
CREATE TABLE public.character_progression(
 character_id uuid PRIMARY KEY REFERENCES public.characters(id),
 class_id uuid REFERENCES public.class_catalog(id),class_level int NOT NULL DEFAULT 1,
 experience_points bigint NOT NULL DEFAULT 0,pending_level_up boolean NOT NULL DEFAULT false,
 subclass_name text,subclass_source text,created_by uuid,
 level_choices jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.character_sheets(
 character_id uuid PRIMARY KEY REFERENCES public.characters(id),
 sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.character_level_up_sessions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid REFERENCES public.characters(id),
 from_level int,to_level int,status text NOT NULL DEFAULT 'open',
 metadata_ready boolean NOT NULL DEFAULT true,
 preview jsonb NOT NULL DEFAULT '{}'::jsonb,
 required_choices jsonb NOT NULL DEFAULT '[]'::jsonb,
 selections jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_by uuid,completed_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.character_level_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id),
 event_type text NOT NULL,from_level int,to_level int,xp_before bigint,xp_after bigint,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.players(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 sheet jsonb NOT NULL DEFAULT '{}'::jsonb,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.spells_catalog(
 id uuid PRIMARY KEY,name text NOT NULL,level int NOT NULL);
CREATE TABLE public.character_spells(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid REFERENCES public.characters(id),
 spell_id uuid REFERENCES public.spells_catalog(id),
 source_type text,source_key text,source_label text,
 known boolean,prepared boolean,always_available boolean,
 casting_stat text,raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE public.character_option_catalog(
 id uuid PRIMARY KEY,name text,source text,option_type text,metadata jsonb);

-- Local helpers below deliberately cover ONLY a featureless Fighter at level 2.
-- They fail closed for other classes, target levels, or nonempty choices.
CREATE FUNCTION private.current_user_is_admin() RETURNS boolean LANGUAGE sql STABLE
 AS $f$ SELECT false $f$;
CREATE FUNCTION private.p13_only_plain_fighter(p_character_id uuid,p_to_level int)
RETURNS void LANGUAGE plpgsql STABLE AS $f$
DECLARE v_class text;
BEGIN
 SELECT cc.class_key INTO v_class FROM public.character_progression cp
 JOIN public.class_catalog cc ON cc.id=cp.class_id WHERE cp.character_id=p_character_id;
 IF v_class IS DISTINCT FROM 'fighter' OR p_to_level<>2
 THEN RAISE EXCEPTION 'Reduced P1.3 fixture only supports featureless Fighter level 2'; END IF;
END $f$;
CREATE FUNCTION private.p13_only_empty(p_payload jsonb) RETURNS void LANGUAGE plpgsql IMMUTABLE
AS $f$
BEGIN
 IF p_payload IS NULL THEN RETURN; END IF;
 IF jsonb_typeof(p_payload)='object' AND p_payload='{}'::jsonb THEN RETURN; END IF;
 IF jsonb_typeof(p_payload)='array' AND p_payload='[]'::jsonb THEN RETURN; END IF;
 RAISE EXCEPTION 'Reduced P1.3 fixture prohibits class-specific choices';
END $f$;
CREATE FUNCTION private.apply_level_up_warlock_invocation_replacement_v2(uuid,int,jsonb,jsonb,jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,$2);
 PERFORM private.p13_only_empty($3); PERFORM private.p13_only_empty($4); PERFORM private.p13_only_empty($5);
 RETURN '[]'::jsonb;
END $f$;
CREATE FUNCTION private.apply_level_up_battle_master_maneuvers_v1(uuid,int,jsonb,text)
RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,$2);
 PERFORM private.p13_only_empty($3);
 IF nullif($4,'') IS NOT NULL THEN RAISE EXCEPTION 'No subclass source choices in lv2 test'; END IF;
 RETURN '[]'::jsonb;
END $f$;
CREATE FUNCTION private.apply_level_up_wizard_savant_v1(uuid,int,jsonb,text)
RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,$2); PERFORM private.p13_only_empty($3);
 IF nullif($4,'') IS NOT NULL THEN RAISE EXCEPTION 'No Wizard in lv2 test'; END IF;
 RETURN '[]'::jsonb;
END $f$;
CREATE FUNCTION private.apply_level_up_artificer_plans_v1(uuid,int,jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,$2); PERFORM private.p13_only_empty($3);
 RETURN '{"added":[],"replacements":[]}'::jsonb;
END $f$;
CREATE FUNCTION private.apply_level_up_replacements_v1(uuid,int,jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,$2); PERFORM private.p13_only_empty($3);
 RETURN '[]'::jsonb;
END $f$;
CREATE FUNCTION private.apply_level_up_wizard_signature_spells_v1(uuid,int,jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,$2); PERFORM private.p13_only_empty($3);
 RETURN '[]'::jsonb;
END $f$;
CREATE FUNCTION private.sync_character_eldritch_invocations_v1(uuid)
RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,2);
END $f$;
CREATE FUNCTION private.apply_level_up_warlock_invocations_v1(uuid,int,jsonb,jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,$2); PERFORM private.p13_only_empty($3);
 PERFORM private.p13_only_empty($4); RETURN '[]'::jsonb;
END $f$;
CREATE FUNCTION private.apply_level_up_subclass_choices_v1(uuid,int,jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,$2); PERFORM private.p13_only_empty($3);
 RETURN '[]'::jsonb;
END $f$;
CREATE FUNCTION private.apply_tough_progression_bonus_v1(uuid,int)
RETURNS int LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,$2); RETURN 0;
END $f$;
CREATE FUNCTION private.level_up_persistent_choice_gaps_v1(text,text,int,int)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $f$
BEGIN
 IF $1<>'fighter' OR $2<>'XPHB' OR $3<>1 OR $4<>2
 THEN RAISE EXCEPTION 'Reduced P1.3 persistent choice helper supports only Fighter 1→2'; END IF;
 RETURN '[]'::jsonb;
END $f$;
CREATE FUNCTION private.simple_level_class_choice_groups_v1(uuid,int)
RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,$2); RETURN '[]'::jsonb;
END $f$;
CREATE FUNCTION private.additional_level_class_choice_groups_v1(uuid,int)
RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
 PERFORM private.p13_only_plain_fighter($1,$2); RETURN '[]'::jsonb;
END $f$;
CREATE FUNCTION private.level_has_feature_v1(jsonb,text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $f$
BEGIN
 IF coalesce($1,'[]'::jsonb)<>'[]'::jsonb
 THEN RAISE EXCEPTION 'Reduced P1.3 Fighter fixture contains unexpected level feature'; END IF;
 RETURN false;
END $f$;
CREATE FUNCTION private.highest_spell_level_from_slots_v1(jsonb)
RETURNS int LANGUAGE plpgsql IMMUTABLE AS $f$
BEGIN
 IF coalesce($1,'{}'::jsonb)<>'{}'::jsonb THEN RAISE EXCEPTION 'No caster spell slots in Fighter fixture'; END IF;
 RETURN 0;
END $f$;
CREATE FUNCTION public.is_preferred_class_version_v1(uuid)
RETURNS boolean LANGUAGE sql STABLE AS $f$
 SELECT EXISTS(SELECT 1 FROM public.class_catalog WHERE id=$1 AND source='XPHB' AND class_key='fighter') $f$;
CREATE FUNCTION public.xp_threshold_for_level_v1(int)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $f$
 SELECT CASE WHEN $1<=1 THEN 0 WHEN $1=2 THEN 300 WHEN $1=3 THEN 900 ELSE 100000 END $f$;
CREATE FUNCTION public.get_character_progression_v1(uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT jsonb_build_object('characterId',cp.character_id,'classLevel',cp.class_level,
 'xp',cp.experience_points,'pending',cp.pending_level_up)
 FROM public.character_progression cp WHERE cp.character_id=$1 $f$;

-- Original source code is NEVER rewritten; all 7 functions hash checked.
\i scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql
DO $source_check$
BEGIN
 IF md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))
     <> '02d74b973a763c53c595be20e35e512f'
 OR md5(pg_get_functiondef('public.complete_character_level_up_v4(uuid,jsonb)'::regprocedure))
     <> 'f8338ef170c6e27b972e777eeae406b8'
 OR md5(pg_get_functiondef('public.complete_character_level_up_v3(uuid,jsonb)'::regprocedure))
     <> '4467e166234c67fc12dd73da0e46b379'
 OR md5(pg_get_functiondef('private.complete_character_level_up_base_v3(uuid,jsonb)'::regprocedure))
     <> 'e33639d549ef557976a3970ea51f5238'
 OR md5(pg_get_functiondef('private.can_manage_character_progression_v1(uuid)'::regprocedure))
     <> 'ac70e4ec033d86c4e0a254d50d429a45'
 OR md5(pg_get_functiondef('private.sync_player_forge_class_spell_summary_v1(uuid)'::regprocedure))
     <> '5b1b275a268a57591a2e35a05ce7480d'
 OR md5(pg_get_functiondef('private.sync_character_progression_from_sheet_v1()'::regprocedure))
     <> 'bb1a3a2d1600ce33cd4fcadac5e0f3a9'
 THEN RAISE EXCEPTION 'Fighter level-up function source drift relative to read-only live PG17'; END IF;
END $source_check$;

INSERT INTO public.class_catalog(id,class_key,class_name,source,ruleset,hit_die)
VALUES ('00000000-0000-0000-0000-000000008201','fighter','Fighter','XPHB','2024',10);
INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,features,proficiency_bonus,spell_slots)
VALUES
('00000000-0000-0000-0000-000000008201',1,0,'[]',2,'{}'),
('00000000-0000-0000-0000-000000008201',2,300,'[]',2,'{}');

-- Temporary timing fixture. Called ONLY by test RPC to hold CS lock before
-- the ACTUAL original sheet AFTER UPDATE sync trigger tries to lock CP.
CREATE FUNCTION private.p13_sheet_hold_after_update() RETURNS trigger
LANGUAGE plpgsql AS $f$
BEGIN
 IF coalesce(current_setting('p13.test_hold',true),'')='on'
 THEN PERFORM pg_sleep(3.4); END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER p13_hold_before_original_sheet_sync
AFTER UPDATE OF sheet ON public.character_sheets
FOR EACH ROW EXECUTE FUNCTION private.p13_sheet_hold_after_update();
CREATE TRIGGER sync_character_progression_from_sheet_v1
AFTER INSERT OR UPDATE OF sheet ON public.character_sheets
FOR EACH ROW EXECUTE FUNCTION private.sync_character_progression_from_sheet_v1();

-- This endpoint exists ONLY in disposable CI, accepts JWT identity, and
-- performs ordinary UPDATE CS under its real table RLS and original trigger.
CREATE FUNCTION public.p13_test_sheet_edit_hold_v1(p_character_id uuid,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog','public','private','auth'
AS $f$
BEGIN
 PERFORM set_config('p13.test_hold','on',true);
 UPDATE public.character_sheets
 SET sheet=sheet||jsonb_build_object('coeditorNote',p_note),updated_at=now()
 WHERE character_id=p_character_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sheet editor lacks current access' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('updated',true);
END $f$;

-- Test-only authenticated wrapper: acquire CP FIRST using explicit
-- SELECT FOR UPDATE and publish a transaction advisory marker, sleep,
-- then execute the UNCHANGED complete_character_level_up_v5 RPC.
-- Only this test wrapper contains synthetic timing/locking; it is NOT
-- a proposed production lock-order implementation or full service path.
CREATE FUNCTION public.p13_test_levelup_cp_prelock_v1(p_character_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $f$
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_character_progression_v1(p_character_id)
 THEN RAISE EXCEPTION 'No current level-up editor permission' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.character_progression
 WHERE character_id=p_character_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Character progression unavailable' USING ERRCODE='P0002'; END IF;
 PERFORM pg_advisory_xact_lock(9313,1);
 PERFORM pg_sleep(2.5);
 RETURN public.complete_character_level_up_v5(p_character_id,'{"hp_method":"fixed"}'::jsonb);
END $f$;

-- Editor-only permissions, do not grant full sheet to unrelated players.
ALTER TABLE public.character_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY p13_sheet_editor_read ON public.character_sheets
 FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.character_permissions cp WHERE cp.character_id=character_sheets.character_id
 AND cp.user_id=auth.uid() AND cp.can_edit));
CREATE POLICY p13_sheet_editor_update ON public.character_sheets
 FOR UPDATE TO authenticated
 USING (EXISTS(SELECT 1 FROM public.character_permissions cp WHERE cp.character_id=character_sheets.character_id
 AND cp.user_id=auth.uid() AND cp.can_edit))
 WITH CHECK (EXISTS(SELECT 1 FROM public.character_permissions cp WHERE cp.character_id=character_sheets.character_id
 AND cp.user_id=auth.uid() AND cp.can_edit));
REVOKE ALL ON public.character_sheets, public.character_permissions FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE(sheet,updated_at) ON public.character_sheets TO authenticated;
GRANT SELECT ON public.character_permissions TO authenticated;
ALTER TABLE public.character_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY p13_own_permissions_read ON public.character_permissions
 FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON FUNCTION public.complete_character_level_up_v5(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.p13_test_sheet_edit_hold_v1(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.p13_test_levelup_cp_prelock_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_character_level_up_v5(uuid,jsonb),
 public.p13_test_sheet_edit_hold_v1(uuid,text),
 public.p13_test_levelup_cp_prelock_v1(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_character_level_up_v3(uuid,jsonb),
 public.complete_character_level_up_v4(uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

DO $assert_acl$
BEGIN
 IF has_function_privilege('anon','public.complete_character_level_up_v5(uuid,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.complete_character_level_up_v5(uuid,jsonb)','EXECUTE')
 OR has_function_privilege('anon','public.p13_test_sheet_edit_hold_v1(uuid,text)','EXECUTE')
 OR has_function_privilege('anon','public.p13_test_levelup_cp_prelock_v1(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'P13 source level-up test-only ACL not restricted'; END IF;
END $assert_acl$;
NOTIFY pgrst,'reload schema';
\echo 'PASS F06 original source v5/v4/v3/base auth-visible fixture installed, with reduced Fighter-only helper exits and editor RLS'
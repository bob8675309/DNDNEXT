-- P1.3 F17-F21 authentic level-4 player-earned feat G under v5→v4→v3→advancement.
-- APPEND AFTER THE COMPLETED F06-F16 CASES in disposable Supabase PG17/GoTrue only.
-- Original production function bodies: scripts/fixtures/p1_3_level4_advancement_original_pg17.sql
-- NOT A PRODUCTION MIGRATION; DO NOT APPLY TO DnDWeb.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.p13_levelup_case_guard') IS NULL
 OR to_regclass('public.character_option_grants') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NOT NULL
 OR to_regprocedure('public.grant_character_option_v1(uuid,uuid,text)') IS NULL
 OR to_regprocedure('public.complete_character_level_up_v5(uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'F17-F21 refuse live/non-empty or wrongly ordered PG17 fixture'; END IF;
 IF md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))<>'02d74b973a763c53c595be20e35e512f'
 OR md5(pg_get_functiondef('public.complete_character_level_up_v3(uuid,jsonb)'::regprocedure))<>'4467e166234c67fc12dd73da0e46b379'
 OR md5(pg_get_functiondef('public.grant_character_option_v1(uuid,uuid,text)'::regprocedure))<>'aa0f6a0c6c6a6f2b9aacf57bd40e434c'
 THEN RAISE EXCEPTION 'Preexisting source-original levelup/Admin G source drift'; END IF;
END $gate$;

-- Existing F06-F16 deliberately used a featureless 1->2 fighter. Extend ONLY
-- the scratch helper scopes so the same unchanged original v5→v3 can reach a
-- source-qualified 3->4 advancement. This does NOT replace production helpers.
CREATE OR REPLACE FUNCTION private.p13_only_plain_fighter(p_character_id uuid,p_to_level int)
RETURNS void LANGUAGE plpgsql STABLE AS $f$
DECLARE v_class text;
BEGIN
 SELECT cc.class_key INTO v_class FROM public.character_progression cp
 JOIN public.class_catalog cc ON cc.id=cp.class_id WHERE cp.character_id=p_character_id;
 IF v_class IS DISTINCT FROM 'fighter' OR p_to_level NOT IN (2,4)
 THEN RAISE EXCEPTION 'Reduced P1.3 fixture only supports Fighter 1->2 or 3->4'; END IF;
END $f$;
CREATE OR REPLACE FUNCTION private.level_up_persistent_choice_gaps_v1(text,text,int,int)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $f$
BEGIN
 IF NOT ($1='fighter' AND $2='XPHB' AND (($3=1 AND $4=2) OR ($3=3 AND $4=4)))
 THEN RAISE EXCEPTION 'Reduced persistent choice helper only accepts Fighter 1->2 or 3->4'; END IF;
 RETURN '[]'::jsonb;
END $f$;

-- Extend source-shaped catalog ONLY after the F11-F16 original Admin tests.
ALTER TABLE public.character_option_catalog
 ADD COLUMN option_key text, ADD COLUMN category text;
UPDATE public.character_option_catalog
 SET option_key='feat:lucky|XPHB',category='O'
 WHERE id='00000000-0000-0000-0000-000000008292';
INSERT INTO public.character_option_catalog(id,option_key,name,source,option_type,category,metadata)
VALUES (
 '7fea59fa-064e-40dd-8f25-dcebe28f1e9d',
 'feat:ability-score-improvement|XPHB','Ability Score Improvement','XPHB','feat','G',
 '{"page":202,"ability":[{"choose":{"from":["str","dex","con","int","wis","cha"],"amount":2},"hidden":true},{"choose":{"from":["str","dex","con","int","wis","cha"],"count":2},"hidden":true}],"repeatable":true,"prerequisite":[{"level":4}],"additionalSpells":[],"toolProficiencies":[],"armorProficiencies":[],"skillProficiencies":[],"weaponProficiencies":[]}'::jsonb
);
-- Source-required preferred-catalog identity is a reduced positive-view subset:
-- original character_option_catalog_all_preferred and visibility tables omitted.
CREATE VIEW public.character_option_catalog_preferred AS
 SELECT * FROM public.character_option_catalog
 WHERE option_type='feat' AND category='G' AND source='XPHB';

-- Source-backed Champion subclass row for a valid pre-existing Fighter Lv3.
-- The research fixture is reduced to the subclass fields the unchanged
-- original resolve_subclass_choice_v1 uses.
CREATE TABLE public.class_feature_catalog(
 class_key text,class_source text,subclass_name text,subclass_short_name text,
 source text,feature_type text,level integer,name text,description text
);
INSERT INTO public.class_feature_catalog
(class_key,class_source,subclass_name,subclass_short_name,source,feature_type,level,name)
VALUES ('fighter','XPHB','Champion','Champion','XPHB','subclass',3,'Champion');

INSERT INTO public.class_level_progression
(class_id,class_level,xp_threshold,features,proficiency_bonus,spell_slots)
VALUES
('00000000-0000-0000-0000-000000008201',3,900,'[]',2,'{}'),
('00000000-0000-0000-0000-000000008201',4,2700,'[{"name":"Ability Score Improvement"}]',2,'{}');

-- Exact canonical instance columns/unique identifier, with reduced RLS.
CREATE TABLE public.character_option_grant_instances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 option_id uuid NOT NULL REFERENCES public.character_option_catalog(id),
 option_key text NOT NULL,option_type text NOT NULL,option_name text NOT NULL,
 option_source text NOT NULL,instance_key text NOT NULL,
 acquisition_owner_type text,acquisition_owner_key text,acquisition_label text,
 acquisition_level integer,choices jsonb NOT NULL DEFAULT '{}'::jsonb,
 effects jsonb NOT NULL DEFAULT '[]'::jsonb,
 fixed_spell_tokens jsonb NOT NULL DEFAULT '[]'::jsonb,
 repeatable boolean NOT NULL DEFAULT false,
 granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT character_option_grant_instances_character_id_instance_key_key
 UNIQUE(character_id,instance_key)
);
ALTER TABLE public.character_option_grant_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY p13_instance_rpc_only ON public.character_option_grant_instances
 FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.character_option_grant_instances FROM PUBLIC,anon,authenticated;

-- Full unchanged source functions (including downstream instance triggers).
-- Some unrelated specialization sub-branches cannot be reached by this ASI
-- fixture, so absence of their tables/helpers remains an explicit limitation.
\i scripts/fixtures/p1_3_level4_advancement_original_pg17.sql

DO $source_check$
BEGIN
 IF md5(pg_get_functiondef('private.apply_character_level_advancement_v1(uuid,integer,uuid,jsonb)'::regprocedure))<>'46dd0af4f6ca816422a75e91a292c634'
 OR md5(pg_get_functiondef('private.level_up_advancement_option_id_v1(uuid,integer,jsonb,boolean)'::regprocedure))<>'ee7e6204a499abfe69aaa0c7f304aed2'
 OR md5(pg_get_functiondef('private.level_up_ability_increases_v1(uuid,jsonb)'::regprocedure))<>'6ac310ae1358a3e827e6b15446d3d5f0'
 OR md5(pg_get_functiondef('private.materialize_level_up_advancement_spells_v1(uuid,integer,uuid,jsonb)'::regprocedure))<>'805b8ea43cdc2b9e4f88f7adb637f0fb'
 OR md5(pg_get_functiondef('private.character_option_prerequisites_met_v1(uuid,uuid,integer)'::regprocedure))<>'21f370cac373521d64a55eebbd61d1bd'
 OR md5(pg_get_functiondef('private.level_has_feature_v1(jsonb,text)'::regprocedure))<>'7616660880fb69db21c4d9b2416c1694'
 OR md5(pg_get_functiondef('private.resolve_subclass_choice_v1(text,text,text,text)'::regprocedure))<>'df25069121f0889de0574e0a28151301'
 OR md5(pg_get_functiondef('private.materialize_boon_energy_resistance_instance_v1()'::regprocedure))<>'35cb3d6560ffde5a94b019a9f373f65d'
 OR md5(pg_get_functiondef('private.materialize_cartomancer_instance_v1()'::regprocedure))<>'30939673464de80a0791a89017d48065'
 OR md5(pg_get_functiondef('private.materialize_feat_runtime_expertise_instance_v1()'::regprocedure))<>'c56af0b4f49f024a18baf396eeb2d1e2'
 OR md5(pg_get_functiondef('private.cartomancer_family_v1(text,text)'::regprocedure))<>'3801761f8bc46c5af10fca5e5ae73e60'
 OR md5(pg_get_functiondef('private.feat_runtime_expertise_family_v1(text,text)'::regprocedure))<>'be000f9e6d6e129cb9505b110a1021ed'
 THEN RAISE EXCEPTION 'F17-F21 original player advancement source hash drift'; END IF;
END $source_check$;

CREATE TRIGGER character_option_grant_instances_direct_authority_guard_v1
 BEFORE INSERT OR UPDATE OR DELETE ON public.character_option_grant_instances
 FOR EACH ROW EXECUTE FUNCTION private.guard_direct_character_authority_mutation_v1();
CREATE TRIGGER character_option_grant_instance_boon_energy_resistance_v1
 AFTER INSERT ON public.character_option_grant_instances
 FOR EACH ROW EXECUTE FUNCTION private.materialize_boon_energy_resistance_instance_v1();
CREATE TRIGGER character_option_grant_instance_cartomancer_v1
 AFTER INSERT ON public.character_option_grant_instances
 FOR EACH ROW EXECUTE FUNCTION private.materialize_cartomancer_instance_v1();
CREATE TRIGGER character_option_grant_instance_feat_runtime_expertise_v1
 AFTER INSERT ON public.character_option_grant_instances
 FOR EACH ROW EXECUTE FUNCTION private.materialize_feat_runtime_expertise_instance_v1();

-- Test-only observable CP prelock before the unchanged public v5 RPC.
CREATE FUNCTION public.p13_test_level4_advancement_cp_prelock_v1(p_character_id uuid,p_instance jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $test$
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_character_progression_v1(p_character_id)
 THEN RAISE EXCEPTION 'Current editor permission required for Lv4 source test' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.character_progression WHERE character_id=p_character_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing progression row' USING ERRCODE='P0002'; END IF;
 PERFORM pg_advisory_xact_lock(9316,1);
 PERFORM pg_sleep(4.0);
 RETURN public.complete_character_level_up_v5(p_character_id,
 jsonb_build_object('hp_method','fixed','advancement_instance',p_instance));
END $test$;
REVOKE ALL ON FUNCTION public.p13_test_level4_advancement_cp_prelock_v1(uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p13_test_level4_advancement_cp_prelock_v1(uuid,jsonb)
 TO authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated;
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.p13_test_level4_advancement_cp_prelock_v1(uuid,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.p13_test_level4_advancement_cp_prelock_v1(uuid,jsonb)','EXECUTE')
 OR has_table_privilege('authenticated','public.character_option_grant_instances','INSERT')
 THEN RAISE EXCEPTION 'F17-F21 scoped grant instance RPC-only ACL incorrect'; END IF;
END $acl$;
NOTIFY pgrst,'reload schema';
\echo 'PASS F17 original player advancement functions/instance triggers installed into disposable Lv4 local JWT fixture'

-- P1.3 isolated original Admin feat grant G versus original player v5 CP/CS.
-- Extends the source-original Fighter 1->2 local GoTrue fixture AFTER F06-F10.
-- Disposable CI Postgres 17 only; NEVER apply to DnDWeb or another database.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database() <> 'postgres'
    OR current_setting('server_version_num')::integer < 170000
    OR to_regclass('auth.users') IS NULL
    OR to_regclass('private.p13_levelup_case_guard') IS NULL
    OR to_regclass('public.character_option_grants') IS NOT NULL
    OR to_regprocedure('public.complete_character_level_up_v5(uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'Refusing non-disposable or misordered P1.3 grant test'; END IF;
 IF md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))
       <> '02d74b973a763c53c595be20e35e512f'
    OR md5(pg_get_functiondef('private.sync_character_progression_from_sheet_v1()'::regprocedure))
       <> 'bb1a3a2d1600ce33cd4fcadac5e0f3a9'
 THEN RAISE EXCEPTION 'Underlying original v5 or sheet sync source drift'; END IF;
END $gate$;

-- Source-shaped grant table, real unique key, and two-source permissions.
-- Reduced scratch profile/catalogue/permission model: NOT production RLS parity.
CREATE TABLE public.user_profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id),
 role text DEFAULT 'player'
);
CREATE TABLE public.character_option_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 option_id uuid NOT NULL REFERENCES public.character_option_catalog(id) ON DELETE CASCADE,
 notes text,
 granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT character_option_grants_character_id_option_id_key UNIQUE(character_id,option_id)
);
ALTER TABLE public.character_option_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY p13_grants_rpc_only ON public.character_option_grants
 FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.character_option_grants FROM PUBLIC,anon,authenticated;

-- The file below copies live PG17 pg_get_functiondef() bodies verbatim.
-- The test-only existing current_user_is_admin FALSE stub is intentionally
-- replaced by the unchanged live source AFTER baseline tests F06-F10.
\i scripts/fixtures/p1_3_admin_grant_original_source_pg17.sql
DO $source_gate$
BEGIN
 IF md5(pg_get_functiondef('private.current_user_is_admin()'::regprocedure))
     <> '1fc5fbcb121b2862eeab869edfb3a209'
 OR md5(pg_get_functiondef('public.is_admin()'::regprocedure))
     <> '629e70fee675bf18f353a19d807e4416'
 OR md5(pg_get_functiondef('private.guard_direct_character_authority_mutation_v1()'::regprocedure))
     <> '04596b0a3fdfb71c1b357056e8c6023b'
 OR md5(pg_get_functiondef('private.sync_admin_feature_array_v1(uuid,text,text,boolean)'::regprocedure))
     <> 'f2b6190ecc9400772e054892f63cdc47'
 OR md5(pg_get_functiondef('public.grant_character_option_v1(uuid,uuid,text)'::regprocedure))
     <> 'aa0f6a0c6c6a6f2b9aacf57bd40e434c'
 THEN RAISE EXCEPTION 'Original Admin G/CS authority source drift'; END IF;
END $source_gate$;

CREATE TRIGGER character_option_grants_direct_authority_guard_v1
 BEFORE INSERT OR DELETE OR UPDATE ON public.character_option_grants
 FOR EACH ROW EXECUTE FUNCTION private.guard_direct_character_authority_mutation_v1();
CREATE TRIGGER character_sheets_authority_fields_guard_v1
 BEFORE INSERT OR UPDATE OF sheet ON public.character_sheets
 FOR EACH ROW EXECUTE FUNCTION private.guard_direct_character_authority_mutation_v1();

INSERT INTO public.character_option_catalog(id,name,source,option_type,metadata)
VALUES ('00000000-0000-0000-0000-000000008292','Lucky','XPHB','feat','{}'::jsonb);

-- TEST-ONLY: This observer holds the already-written Admin sheet (CS) row
-- after ORIGINAL Admin grant inserted G, but before ORIGINAL sheet->CP sync.
-- It does not alter source functions or grant/level-up results.
CREATE FUNCTION private.p13_admin_grant_cs_hold_probe_v1() RETURNS trigger
 LANGUAGE plpgsql SET search_path TO 'pg_catalog','public','private','auth'
AS $test$
BEGIN
 IF OLD.sheet->'adminGrantedFeats' IS DISTINCT FROM NEW.sheet->'adminGrantedFeats'
    AND private.current_user_is_admin() THEN
   PERFORM pg_advisory_xact_lock(9314,1);
   PERFORM pg_sleep(4.1);
 END IF;
 RETURN NEW;
END $test$;
CREATE TRIGGER p13_admin_grant_cs_hold_probe_v1
 AFTER UPDATE OF sheet ON public.character_sheets
 FOR EACH ROW EXECUTE FUNCTION private.p13_admin_grant_cs_hold_probe_v1();

-- TEST-ONLY: Publish an observable CP lock before the entire ORIGINAL v5 chain.
CREATE FUNCTION public.p13_test_grant_race_levelup_prelock_v1(p_character_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $test$
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_character_progression_v1(p_character_id)
 THEN RAISE EXCEPTION 'Current level-up editing permission required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.character_progression WHERE character_id=p_character_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No existing character progression' USING ERRCODE='P0002'; END IF;
 PERFORM pg_advisory_xact_lock(9315,1);
 PERFORM pg_sleep(4.0);
 RETURN public.complete_character_level_up_v5(p_character_id,'{"hp_method":"fixed"}'::jsonb);
END $test$;

REVOKE ALL ON FUNCTION public.grant_character_option_v1(uuid,uuid,text),
 public.p13_test_grant_race_levelup_prelock_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.grant_character_option_v1(uuid,uuid,text),
 public.p13_test_grant_race_levelup_prelock_v1(uuid) TO authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
DO $acl_gate$
BEGIN
 IF has_function_privilege('anon','public.grant_character_option_v1(uuid,uuid,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.grant_character_option_v1(uuid,uuid,text)','EXECUTE')
    OR has_function_privilege('anon','public.p13_test_grant_race_levelup_prelock_v1(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Original Admin grant scratch ACL mismatch'; END IF;
END $acl_gate$;
\echo 'PASS F11 original Admin grant G, source security guards and timing probes installed in disposable auth fixture'

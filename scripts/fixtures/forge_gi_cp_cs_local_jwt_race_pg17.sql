-- DNDNext / PR #324 scratch Auth-only G/I + CP/CS concurrency slice.
-- This is TEST INFRASTRUCTURE, not a migration, and is installed only AFTER
-- original Forge source v2/v3 + canonical Lucky G and deferred I are tested.
-- Direct DnDWeb production SQL, persistent DB, or browser exposure forbidden.
\set ON_ERROR_STOP on
DO $assert$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::integer<170000
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('private.character_creator_attribution') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR to_regclass('public.character_option_grants') IS NULL
 OR to_regclass('public.inventory_items') IS NULL
 OR to_regclass('public.character_currency') IS NULL
 OR to_regprocedure('private.seed_verified_forge_progression_creator_v1()') IS NULL
 OR to_regprocedure('private.materialize_player_forge_feat_instances_v1()') IS NULL
 OR to_regprocedure('private.materialize_player_forge_starting_equipment_v1(uuid)') IS NULL
 THEN RAISE EXCEPTION 'Refuse non-disposable or out-of-order G/I JWT concurrency fixture'; END IF;
 IF md5(pg_get_functiondef('private.materialize_player_forge_feat_instances_v1()'::regprocedure))
       <> 'c27c4181a51cfd018bbb8244e9931550'
 OR md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure))
       <> '653e1b9d7cc47dcff2cef33a674b97f4'
 OR md5(pg_get_functiondef('private.sync_character_progression_from_sheet_v1()'::regprocedure))
       <> 'bb1a3a2d1600ce33cd4fcadac5e0f3a9'
 THEN RAISE EXCEPTION 'Original source G/I/CS lock participant function drift'; END IF;
END $assert$;

-- Test-only CP→CS path: same server-original equipment function, but an
-- observable CP FOR UPDATE prelock makes the opposing CS→CP path reachable.
-- The prelock / marker / pause IS NOT part of original production behavior.
CREATE FUNCTION public.test_forge_gear_cp_prelock_v1(p_character_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $test$
DECLARE v_uid uuid:=auth.uid();
BEGIN
 IF v_uid IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.character_permissions cp
   WHERE cp.character_id=p_character_id AND cp.user_id=v_uid
     AND coalesce(cp.can_edit,false))
 THEN
   RAISE EXCEPTION 'No current character edit grant for gear-source test'
     USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.character_progression
 WHERE character_id=p_character_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Character progression unavailable' USING ERRCODE='P0002';
 END IF;
 PERFORM pg_advisory_xact_lock(9360,1);
 PERFORM pg_sleep(2.6);
 RETURN private.materialize_player_forge_starting_equipment_v1(p_character_id);
END $test$;

-- The original AFTER UPDATE sheet→progression sync stays unchanged, with
-- a separate test-only alphabetically earlier trigger pausing after CS lock
-- but before the original sync tries CP.
CREATE FUNCTION private.test_forge_cs_hold_before_original_sync_v1()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public','private'
AS $test$
BEGIN
 IF current_setting('p13.forge_gi_hold',true)='on'
 THEN PERFORM pg_sleep(3.3); END IF;
 RETURN NEW;
END $test$;
CREATE TRIGGER a_p13_gi_pause_before_original_sync
AFTER UPDATE OF sheet ON public.character_sheets FOR EACH ROW
EXECUTE FUNCTION private.test_forge_cs_hold_before_original_sync_v1();

-- Ordinary invoker RLS + original authority guard and original CS sync:
-- can edit notes but does not acquire feat/grant/gear privileges.
CREATE FUNCTION public.test_forge_sheet_note_hold_v1(p_character_id uuid,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog','public','private','auth'
AS $test$
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Signed-in editor required' USING ERRCODE='42501';
 END IF;
 PERFORM set_config('p13.forge_gi_hold','on',true);
 UPDATE public.character_sheets
 SET sheet=jsonb_set(sheet,'{note}',to_jsonb(p_note),true),updated_at=now()
 WHERE character_id=p_character_id;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Sheet editor lacks current access' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object('updated',true);
END $test$;

REVOKE ALL ON FUNCTION public.test_forge_gear_cp_prelock_v1(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.test_forge_sheet_note_hold_v1(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.test_forge_gear_cp_prelock_v1(uuid),
 public.test_forge_sheet_note_hold_v1(uuid,text) TO authenticated;
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.test_forge_gear_cp_prelock_v1(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.test_forge_sheet_note_hold_v1(uuid,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.test_forge_gear_cp_prelock_v1(uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.test_forge_sheet_note_hold_v1(uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Scratch G/I timing functions unexpectedly exposed'; END IF;
END $acl$;
NOTIFY pgrst,'reload schema';
\echo 'PASS JWT G/I source-fixture installed: original Lucky grant + deferred gear functions source-hashed, timed wrappers test-only'

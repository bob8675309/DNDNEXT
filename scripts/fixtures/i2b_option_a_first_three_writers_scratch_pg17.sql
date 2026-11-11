-- I2-B: OWNER-APPROVED OPTION A, SOURCE-EXACT FIRST NO-MIRROR SLICE.
-- Installs ONLY in disposable local P1.3/I1-P signed PG17 AFTER the
-- unmodified original RED and I1-P bounded GREEN suites have passed.
-- Canonical gameplay sources and original public RPCs remain byte-exact.
-- NOT a production migration. NOT a complete 34+3 freeze.
\set ON_ERROR_STOP on
DO $i2b_freeze$
DECLARE
  x record;
  v_current text;v_original text;v_guarded_where text;
  v_frozen text;v_after text;
  v_sentinel text := 'NULL; -- I2B_OPTION_A_FROZEN_LEGACY_MIRROR';
BEGIN
 IF current_database() <> 'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR to_regclass('private.p13_levelup_case_guard') IS NULL
    OR to_regprocedure('public.complete_character_rest_v1(uuid,text)') IS NULL
    OR md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure)) <> '02d74b973a763c53c595be20e35e512f'
    OR md5(pg_get_functiondef('public.complete_character_rest_v1(uuid,text)'::regprocedure)) <> 'fffbf0705d640a7d2bfb08aa78ad521a'
 THEN RAISE EXCEPTION 'I2B requires disposable I1P signed source and original public v5/rest orchestration'; END IF;
 FOR x IN SELECT * FROM (VALUES
   ('private.complete_character_level_up_base_v3(uuid,jsonb)','e33639d549ef557976a3970ea51f5238','where p.user_id in (
    select cp.user_id from public.character_permissions cp where cp.character_id = p_character_id
  );','update public.players p set sheet = v_sheet, updated_at = now()
  where p.user_id in (
    select cp.user_id from public.character_permissions cp where cp.character_id = p_character_id
  );'),
   ('private.restore_character_rest_action_state_v1(uuid,text)','d75edf2ac583e3790882155c702e2165','where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id=p_character_id and cp.can_edit
  );','update public.players p
  set sheet=v_sheet,updated_at=now()
  where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id=p_character_id and cp.can_edit
  );'),
   ('private.sync_player_forge_class_spell_summary_v1(uuid)','5b1b275a268a57591a2e35a05ce7480d','where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);','update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);')
 ) AS data(signature,original_md5,original_where,original_update)
 LOOP
   v_current := pg_get_functiondef(x.signature::regprocedure);
   v_guarded_where := left(x.original_where,length(x.original_where)-1) || chr(10)
       || '    and (p.sheet = ''{}''::jsonb or '
       || 'p.sheet #>> ''{meta,creationRequestId}'' = '
       || '(select c.creation_request_id::text from public.characters c where c.id=p_character_id));';
   IF length(v_current)-length(replace(v_current,v_guarded_where,''))<>length(v_guarded_where)
   THEN RAISE EXCEPTION 'I2B inherited I1P guarded WHERE source missing/duplicated: %',x.signature; END IF;
   -- First reconstruct *exact* unmodified live source and prove its MD5.
   v_original := replace(v_current,v_guarded_where,x.original_where);
   IF md5(v_original)<>x.original_md5
      OR length(v_original)-length(replace(v_original,x.original_update,''))<>length(x.original_update)
   THEN RAISE EXCEPTION 'I2B original UPDATE source drift: %',x.signature; END IF;
   -- The statement has no downstream FOUND/ROW_COUNT dependency (confirmed
   -- against all three held deployed original source tails in the audit).
   -- Use NULL instead of a tautological UPDATE or WHERE false to guarantee
   -- no target row lock or account-sheet updated_at mutation.
   v_frozen := replace(v_original,x.original_update,v_sentinel);
   EXECUTE v_frozen;
   v_after := pg_get_functiondef(x.signature::regprocedure);
   IF md5(replace(v_after,v_sentinel,x.original_update))<>x.original_md5
      OR position('update public.players' IN lower(v_after))>0
   THEN RAISE EXCEPTION 'I2B changed source beyond removal of legacy account UPDATE: %',x.signature; END IF;
 END LOOP;
 IF md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure)) <> '02d74b973a763c53c595be20e35e512f'
    OR md5(pg_get_functiondef('public.complete_character_rest_v1(uuid,text)'::regprocedure)) <> 'fffbf0705d640a7d2bfb08aa78ad521a'
    OR md5(pg_get_functiondef('private.sync_character_spell_slots_v1(uuid)'::regprocedure)) <> '6c276ab2135fb90894fd8684e39ce1c3'
    OR md5(pg_get_functiondef('private.character_sheet_resource_profile_json_v1(uuid)'::regprocedure)) <> '2c798f8351282d80e63ab8e9e9019272'
 THEN RAISE EXCEPTION 'I2B modified immutable public/gameplay source'; END IF;
END $i2b_freeze$;
\echo 'PASS I2B-SOURCE: 3 exact live mirror statements replaced by no-op only; source originals recover by reversing one token each'

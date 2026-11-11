-- I1-P research-only scratch mirror-identity candidate.
-- Install ONLY after signed SOURCE RED in P1.3 full original earned v5
-- and exact source-original complete_character_rest_v1. No live migration.
\set ON_ERROR_STOP on
DO $candidate$
DECLARE r record; v_src text; v_old text;v_new text;v_after text;v_previous text;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.p13_levelup_case_guard') IS NULL
 OR to_regprocedure('public.complete_character_rest_v1(uuid,text)') IS NULL
 OR md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))<>'02d74b973a763c53c595be20e35e512f'
 OR md5(pg_get_functiondef('public.complete_character_rest_v1(uuid,text)'::regprocedure))<>'fffbf0705d640a7d2bfb08aa78ad521a'
 THEN RAISE EXCEPTION 'I1-P candidate requires disposable signed source RED with complete original v5 and rest'; END IF;
 FOR r IN
   SELECT * FROM (VALUES
   ('private.sync_player_forge_class_spell_summary_v1(uuid)','5b1b275a268a57591a2e35a05ce7480d','where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);'),
   ('private.complete_character_level_up_base_v3(uuid,jsonb)','e33639d549ef557976a3970ea51f5238','where p.user_id in (
    select cp.user_id from public.character_permissions cp where cp.character_id = p_character_id
  );'),
   ('private.restore_character_rest_action_state_v1(uuid,text)','d75edf2ac583e3790882155c702e2165','where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id=p_character_id and cp.can_edit
  );')
   ) AS x(sig,original_md5,original_where)
 LOOP
   v_src:=pg_get_functiondef(r.sig::regprocedure);
   v_old:=r.original_where;
   IF md5(v_src)<>r.original_md5
    OR length(v_src)-length(replace(v_src,v_old,''))<>length(v_old)
   THEN RAISE EXCEPTION 'I1-P original writer not source-exact: %',r.sig; END IF;
   v_new:=left(v_old,length(v_old)-1) || chr(10) ||
     '    and (p.sheet = ''{}''::jsonb or ' ||
     'p.sheet #>> ''{meta,creationRequestId}'' = ' ||
     '(select c.creation_request_id::text from public.characters c where c.id=p_character_id));';
   EXECUTE replace(v_src,v_old,v_new);
   v_after:=pg_get_functiondef(r.sig::regprocedure);
   IF md5(replace(v_after,v_new,v_old))<>r.original_md5
    OR md5(v_after)=r.original_md5
   THEN RAISE EXCEPTION 'I1-P modified source outside exact legacy mirror WHERE: %',r.sig; END IF;
 END LOOP;
 IF md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))<>'02d74b973a763c53c595be20e35e512f'
 OR md5(pg_get_functiondef('public.complete_character_rest_v1(uuid,text)'::regprocedure))<>'fffbf0705d640a7d2bfb08aa78ad521a'
 OR md5(pg_get_functiondef('private.sync_character_spell_slots_v1(uuid)'::regprocedure))<>'6c276ab2135fb90894fd8684e39ce1c3'
 OR md5(pg_get_functiondef('private.character_sheet_resource_profile_json_v1(uuid)'::regprocedure))<>'2c798f8351282d80e63ab8e9e9019272'
 THEN RAISE EXCEPTION 'I1-P non-mirror earn/rest sources were changed'; END IF;
END $candidate$;
\echo 'PASS I1P-CANDIDATE: only three individual account-wide mirror predicates changed, earned v5/rest orchestrator/source math intact'

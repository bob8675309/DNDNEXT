-- I1-O disposable source-pinned COMPATIBILITY CANDIDATE. NOT A LIVE MIGRATION.
-- Only after original-source signed HP and Admin progression RED are asserted.
-- Change ONE legacy account-mirror predicate each in two ORIGINAL public RPCs;
-- preserve their canonical character_sheets write, auth checks, event/grants.
\set ON_ERROR_STOP on
DO $i1o_candidate$
DECLARE
 v_target record;
 v_source text;
 v_repaired text;
 v_old text := 'where p.user_id in ('||chr(10)||
   '    select cp.user_id'||chr(10)||
   '    from public.character_permissions cp'||chr(10)||
   '    where cp.character_id=p_character_id and cp.can_edit'||chr(10)||
   '  );';
 v_new text := 'where p.user_id in ('||chr(10)||
   '    select cp.user_id'||chr(10)||
   '    from public.character_permissions cp'||chr(10)||
   '    where cp.character_id=p_character_id and cp.can_edit'||chr(10)||
   '  ) and ('||chr(10)||
   '    p.sheet = ''{}''::jsonb'||chr(10)||
   '    or p.sheet #>> ''{meta,creationRequestId}'' = ('||chr(10)||
   '      select c.creation_request_id::text from public.characters c where c.id=p_character_id'||chr(10)||
   '    )'||chr(10)||
   '  );';
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
  OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
  OR md5(pg_get_functiondef('private.materialize_player_forge_artificer_plans_v1()'::regprocedure))<>'67766989a466b82f170b5e00f9154e24'
  THEN RAISE EXCEPTION 'I1-O candidate only after disposable signed I1-M and I1-O ORIGINAL RED'; END IF;
 FOR v_target IN
  SELECT 'public.adjust_character_hit_points_v1(uuid,integer,integer)' AS sig,
   'f855be60d971aa63e32ade327d14c369' AS original_md5
  UNION ALL
  SELECT 'public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text)',
   'c4ea1c7993912f6b4c6fe9ee7b25343f'
 LOOP
  v_source := pg_get_functiondef(v_target.sig::regprocedure);
  IF md5(v_source)<>v_target.original_md5
   OR length(v_source)-length(replace(v_source,v_old,''))<>length(v_old)
  THEN RAISE EXCEPTION 'I1-O original function changed before scratch candidate: %',v_target.sig; END IF;
  EXECUTE replace(v_source,v_old,v_new);
  v_repaired:=pg_get_functiondef(v_target.sig::regprocedure);
  IF md5(replace(v_repaired,v_new,v_old))<>v_target.original_md5
   OR md5(v_repaired)=v_target.original_md5
  THEN RAISE EXCEPTION 'I1-O modified more than guarded mirror clause: %',v_target.sig; END IF;
 END LOOP;
 IF md5(pg_get_functiondef('public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)'::regprocedure))
   <> 'eb467b7c7a8d548581a36cfcb0d8f77b'
 OR md5(pg_get_functiondef('private.can_manage_character_progression_v1(uuid)'::regprocedure))
   <> 'ac70e4ec033d86c4e0a254d50d429a45'
 THEN RAISE EXCEPTION 'I1-O source-original authorization/progression dependencies changed'; END IF;
END $i1o_candidate$;
\echo 'PASS I1O-CANDIDATE: exact HP/Admin progression source retained except shared account mirror predicates; no live migration'

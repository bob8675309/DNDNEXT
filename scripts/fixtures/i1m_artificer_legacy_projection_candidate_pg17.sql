-- I1-M RESEARCH-ONLY two-issue candidate in disposable local PG17.
-- Must run after unmodified I1-L Artificer RED and #319-style v2 guard RED.
-- Preserve original I1-L one-condition NULL fix and keep grant materializer unchanged.
\set ON_ERROR_STOP on
DO $i1m_guard$
DECLARE
  v_source text;
  v_repaired text;
  v_old text := 'where p.user_id in('||chr(10)||
    '    select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id'||chr(10)||
    '  );';
  v_new text := 'where p.user_id in('||chr(10)||
    '    select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id'||chr(10)||
    '  ) and (p.sheet = ''{}''::jsonb'||chr(10)||
    '    or p.sheet #>> ''{meta,creationRequestId}'' = (select c.creation_request_id::text from public.characters c where c.id=p_character_id));';
  v_materializer_md5 text;
  v_original_projection text;
BEGIN
  IF current_database()<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
     OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
     OR md5(pg_get_functiondef('private.materialize_player_forge_artificer_plans_v1()'::regprocedure))<>'67766989a466b82f170b5e00f9154e24'
  THEN RAISE EXCEPTION 'I1-M candidate requires original Artificer local signed test state'; END IF;
  v_source:=pg_get_functiondef('private.sync_character_artificer_plan_projection_v1(uuid)'::regprocedure);
  v_original_projection:=replace(v_source,
    'if coalesce(jsonb_typeof(v_sheet->''classFeatureChoices''),'''')<>''object'' then',
    'if jsonb_typeof(v_sheet->''classFeatureChoices'')<>''object'' then');
  IF md5(v_original_projection)<>'5ebf572db01143e9b523c7dba0d43ad5'
     OR length(v_source)-length(replace(v_source,v_old,''))<>length(v_old)
  THEN RAISE EXCEPTION 'I1-M expected exact I1-L projection candidate source and one mirror clause'; END IF;
  v_repaired:=replace(v_source,v_old,v_new);
  EXECUTE v_repaired;
  v_repaired:=pg_get_functiondef('private.sync_character_artificer_plan_projection_v1(uuid)'::regprocedure);
  IF md5(replace(v_repaired,v_new,v_old))<>md5(v_source)
     OR md5(pg_get_functiondef('private.materialize_player_forge_artificer_plans_v1()'::regprocedure))<>'67766989a466b82f170b5e00f9154e24'
  THEN RAISE EXCEPTION 'I1-M replaced more than the account-wide legacy mirror predicate'; END IF;
END $i1m_guard$;
\echo 'PASS I1M-CANDIDATE: exact I1-L projection retained, account legacy mirror restricted to empty or same creation nonce'

-- P1.3 OPTIONAL scratch viewer projection for first-execution hidden results.
-- Installed by the JS test ONLY AFTER it has first demonstrated unsafe
-- raw hidden End Turn/Move responses from the prior source-derived candidate.
-- This is NOT production migration SQL nor final concealment/timing policy.
\set ON_ERROR_STOP on
DO $local$ BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 THEN RAISE EXCEPTION 'P1.3 privacy candidate refuses nonlocal PG17'; END IF;
END $local$;
CREATE OR REPLACE FUNCTION private.p13_project_hidden_activity_v1(
 p_family text,p_result jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $project$
DECLARE v_hidden_id uuid; v_hide boolean := false;
BEGIN
 IF p_result IS NULL OR jsonb_typeof(p_result)<>'object'
 THEN RAISE EXCEPTION 'P13_INVALID_PRIVATE_RESULT' USING ERRCODE='22023'; END IF;
 IF p_family='end_turn' THEN
   v_hidden_id:=nullif(p_result->>'nextParticipantId','')::uuid;
 ELSIF p_family='move' AND
       coalesce((p_result->>'reactionRequired')::boolean,false) THEN
   v_hidden_id:=nullif(p_result->>'reactorParticipantId','')::uuid;
 ELSE RETURN p_result; END IF;
 IF v_hidden_id IS NOT NULL THEN
  SELECT EXISTS(
   SELECT 1 FROM public.encounter_participants p
   WHERE p.id=v_hidden_id AND p.is_hidden
     AND NOT public.is_admin(auth.uid())
     AND p.controller_user_id IS DISTINCT FROM auth.uid()
  ) INTO v_hide;
 END IF;
 IF v_hide THEN
   -- **Only** the original submitter-known UUID + ambiguous owner label.
   -- No actor/encounter ID, window ID, position, reaction flag, event type,
   -- initiative, action economy, or other hidden source fields.
   RETURN jsonb_build_object(
    'requestId',p_result->>'requestId','notice','Unknown Events');
 END IF;
 RETURN p_result;
END $project$;
REVOKE ALL ON FUNCTION private.p13_project_hidden_activity_v1(text,jsonb)
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.p13_candidate_end_turn_v1(
 p_participant_id uuid,p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $endturn$
DECLARE v_guard jsonb;v_intent jsonb;v_result jsonb;v_eid uuid;
BEGIN
 IF p_participant_id IS NULL OR p_request_id IS NULL
 THEN RAISE EXCEPTION 'P13_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
 v_intent:=jsonb_build_object('family','end_turn','version','candidate-v1');
 v_guard:=private.p13_guard_enter_v1(
   p_request_id,p_participant_id,NULL,'end_turn',v_intent);
 IF v_guard->>'kind'='replay' THEN
   RETURN private.p13_project_hidden_activity_v1('end_turn',v_guard->'result');
 END IF;
 SELECT encounter_id INTO v_eid
 FROM public.encounter_participants WHERE id=p_participant_id;
 -- E is already held by the common guard; lock all P in stable order
 -- before executing the source-exact End Turn body (including next actor).
 PERFORM id FROM public.encounter_participants
 WHERE encounter_id=v_eid ORDER BY id FOR UPDATE;
 v_result:=public.encounter_end_turn_v1(p_participant_id,p_request_id);
 UPDATE private.p13_guarded_commands SET result=v_result WHERE request_id=p_request_id;
 RETURN private.p13_project_hidden_activity_v1('end_turn',v_result);
END $endturn$;

CREATE OR REPLACE FUNCTION public.p13_candidate_move_v1(
 p_participant_id uuid,p_path jsonb,p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $move$
DECLARE v_guard jsonb;v_intent jsonb;v_result jsonb;v_step jsonb;
BEGIN
 IF p_participant_id IS NULL OR p_request_id IS NULL
   OR p_path IS NULL OR jsonb_typeof(p_path)<>'array'
   OR jsonb_array_length(p_path)<1 OR jsonb_array_length(p_path)>30
 THEN RAISE EXCEPTION 'P13_INVALID_PATH' USING ERRCODE='22023'; END IF;
 FOR v_step IN SELECT value FROM jsonb_array_elements(p_path) LOOP
  IF jsonb_typeof(v_step)<>'object'
    OR NOT (v_step ?& array['q','r'])
    OR (SELECT count(*) FROM jsonb_object_keys(v_step))<>2
    OR jsonb_typeof(v_step->'q')<>'number'
    OR jsonb_typeof(v_step->'r')<>'number'
  THEN RAISE EXCEPTION 'P13_INVALID_PATH' USING ERRCODE='22023'; END IF;
  IF abs((v_step->>'q')::numeric)>100000 OR abs((v_step->>'r')::numeric)>100000
    OR (v_step->>'q')::numeric<>trunc((v_step->>'q')::numeric)
    OR (v_step->>'r')::numeric<>trunc((v_step->>'r')::numeric)
  THEN RAISE EXCEPTION 'P13_INVALID_PATH' USING ERRCODE='22023'; END IF;
 END LOOP;
 v_intent:=jsonb_build_object('family','move','version','candidate-v1','path',p_path);
 v_guard:=private.p13_guard_enter_v1(
   p_request_id,p_participant_id,NULL,'move',v_intent);
 IF v_guard->>'kind'='replay' THEN
   RETURN private.p13_project_hidden_activity_v1('move',v_guard->'result');
 END IF;
 v_result:=public.encounter_move_active_participant_v1(
   p_participant_id,p_path,p_request_id);
 UPDATE private.p13_guarded_commands SET result=v_result WHERE request_id=p_request_id;
 RETURN private.p13_project_hidden_activity_v1('move',v_result);
END $move$;

-- Keep old-direct functions unavailable and new source guarded in scratch.
DO $grant$
BEGIN
 IF has_function_privilege('authenticated',
    'public.encounter_end_turn_v1(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
    'public.encounter_move_active_participant_v1(uuid,jsonb,uuid)','EXECUTE')
 OR has_function_privilege('anon',
    'public.p13_candidate_end_turn_v1(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
    'public.p13_candidate_move_v1(uuid,jsonb,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'P13 privacy model guard/grant mismatch'; END IF;
END $grant$;
NOTIFY pgrst,'reload schema';

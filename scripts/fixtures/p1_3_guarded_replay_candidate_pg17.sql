-- P1.3 protected replay + encounter-first candidate MODEL, ONLY disposable GitHub
-- Actions local Supabase PG17. This file is not a production migration.
-- Original deployed processors remain unchanged; only test wrappers/guards are new.
-- Callers of legacy direct RPCs must be revoked/retired in a real atomic cutover.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 THEN RAISE EXCEPTION 'P1.3 candidate refuses non-local PG17'; END IF;
END $guard$;
ALTER TABLE public.encounter_participants
 ADD COLUMN movement_bonus_ft integer NOT NULL DEFAULT 0,
 ADD COLUMN disengaged boolean NOT NULL DEFAULT false,
 ADD COLUMN dodging boolean NOT NULL DEFAULT false,
 ADD COLUMN speed_ft integer NOT NULL DEFAULT 30;
\i scripts/fixtures/p1_3_legacy_core_action_live_pg17.sql

CREATE TABLE private.p13_guarded_commands (
 request_id uuid PRIMARY KEY,
 encounter_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 requested_by uuid NOT NULL,
 family text NOT NULL,
 canonical_intent jsonb NOT NULL,
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (family IN ('spell_single','core_action')),
 CHECK (jsonb_typeof(canonical_intent)='object')
);
REVOKE ALL ON TABLE private.p13_guarded_commands FROM PUBLIC,anon,authenticated;
-- All SQL command entry points in this local model share one guard. It is
-- deliberately not a universal live migration; Admin/trigger writers remain open.
CREATE OR REPLACE FUNCTION private.p13_guard_enter_v1(
 p_request uuid,p_actor uuid,p_target uuid,p_family text,p_intent jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $gate$
DECLARE
 v_uid uuid:=auth.uid();
 v_role text:=coalesce(auth.role(),'');
 v_e_id uuid;
 v_e public.encounters%rowtype;
 v_actor public.encounter_participants%rowtype;
 v_target public.encounter_participants%rowtype;
 v_prev private.p13_guarded_commands%rowtype;
 v_locked uuid;
 v_has_permission boolean:=false;
BEGIN
 IF v_role<>'authenticated' OR v_uid IS NULL
 THEN RAISE EXCEPTION 'P13_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_actor IS NULL OR p_family NOT IN ('spell_single','core_action')
    OR p_intent IS NULL OR jsonb_typeof(p_intent)<>'object'
 THEN RAISE EXCEPTION 'P13_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
 -- Unlocked discovery is NOT authority; revalidate everything after E/P locks.
 SELECT encounter_id INTO v_e_id FROM public.encounter_participants WHERE id=p_actor;
 IF v_e_id IS NULL THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_e FROM public.encounters WHERE id=v_e_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 -- E first, then each required P in deterministic ascending UUID order.
 FOR v_locked IN SELECT id FROM public.encounter_participants
    WHERE id=p_actor OR (p_target IS NOT NULL AND id=p_target)
    ORDER BY id FOR UPDATE
 LOOP NULL; END LOOP;
 SELECT * INTO v_actor FROM public.encounter_participants WHERE id=p_actor;
 IF v_actor.encounter_id IS DISTINCT FROM v_e.id
 THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 IF p_target IS NOT NULL THEN
  SELECT * INTO v_target FROM public.encounter_participants WHERE id=p_target;
  IF NOT FOUND OR v_target.encounter_id IS DISTINCT FROM v_e.id
  THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 END IF;
 -- Permission validation precedes even looking up a request result. Lock a
 -- permission row where an editor grant is the reason for authority; revocation
 -- by UPDATE then cannot change that grant until this transaction ends.
 IF public.is_admin(v_uid) OR v_actor.controller_user_id=v_uid THEN
   v_has_permission:=true;
 ELSIF v_actor.character_id IS NOT NULL THEN
   SELECT true INTO v_has_permission
     FROM public.character_permissions cp
     WHERE cp.character_id=v_actor.character_id AND cp.user_id=v_uid AND cp.can_edit IS TRUE
     FOR SHARE;
 END IF;
 IF NOT coalesce(v_has_permission,false)
 THEN RAISE EXCEPTION 'P13_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 -- Fail closed for hidden target results: no unreviewed JSON redaction/projection.
 IF p_target IS NOT NULL AND v_target.is_hidden
   AND NOT public.is_admin(v_uid) AND v_target.controller_user_id IS DISTINCT FROM v_uid
 THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_prev FROM private.p13_guarded_commands WHERE request_id=p_request FOR UPDATE;
 IF FOUND THEN
  IF v_prev.requested_by IS DISTINCT FROM v_uid
  THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
  IF v_prev.encounter_id IS DISTINCT FROM v_e.id
   OR v_prev.actor_id IS DISTINCT FROM p_actor
   OR v_prev.family IS DISTINCT FROM p_family
   OR v_prev.canonical_intent IS DISTINCT FROM p_intent
  THEN RAISE EXCEPTION 'P13_REQUEST_CONFLICT' USING ERRCODE='23505'; END IF;
  IF v_prev.result IS NULL THEN
    RAISE EXCEPTION 'P13_PENDING_REQUEST' USING ERRCODE='55000';
  END IF;
  RETURN jsonb_build_object('kind','replay','result',v_prev.result);
 END IF;
 -- Original legacy requests have no provable typed intent. Never "adopt"
 -- their UUID into the new namespace and silently disclose the old cache.
 IF EXISTS(SELECT 1 FROM public.encounter_command_requests WHERE request_id=p_request)
 THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 INSERT INTO private.p13_guarded_commands(
   request_id,encounter_id,actor_id,requested_by,family,canonical_intent
 ) VALUES(p_request,v_e.id,p_actor,v_uid,p_family,p_intent);
 RETURN jsonb_build_object('kind','new');
END $gate$;

CREATE OR REPLACE FUNCTION public.p13_candidate_cast_spell_v1(
 p_caster_id uuid,p_assignment_id uuid,p_target_id uuid,
 p_slot_level integer,p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $cast$
DECLARE
 v_intent jsonb;
 v_guard jsonb;
 v_result jsonb;
 v_spell_key text;
BEGIN
 IF p_caster_id IS NULL OR p_assignment_id IS NULL OR p_target_id IS NULL OR p_request_id IS NULL
 THEN RAISE EXCEPTION 'P13_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
 -- Exact typed operands, including null versus integer level.
 -- The source-qualified identity is resolved on server; this fixture uses
 -- stable synthetic spell assignments (mutation concurrency is still unproven).
 SELECT lower(s.spell_key) INTO v_spell_key
   FROM public.encounter_participants p
   JOIN public.character_spells cs ON cs.character_id=p.character_id AND cs.id=p_assignment_id
   JOIN public.spells_catalog s ON s.id=cs.spell_id
   WHERE p.id=p_caster_id;
 IF v_spell_key IS NULL THEN
   RAISE EXCEPTION 'P13_INVALID_ASSIGNMENT' USING ERRCODE='22023';
 END IF;
 v_intent:=jsonb_build_object(
  'family','spell_single','version','candidate-v1','legacyHandler','v9',
  'assignmentId',p_assignment_id,'targetId',p_target_id,
  'slotLevel',p_slot_level,'spellKey',v_spell_key
 );
 v_guard:=private.p13_guard_enter_v1(
    p_request_id,p_caster_id,p_target_id,'spell_single',v_intent);
 IF v_guard->>'kind'='replay' THEN RETURN v_guard->'result'; END IF;
 v_result:=public.encounter_cast_spell_v9(
    p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
 UPDATE private.p13_guarded_commands SET result=v_result WHERE request_id=p_request_id;
 RETURN v_result;
END $cast$;

CREATE OR REPLACE FUNCTION public.p13_candidate_core_action_v1(
 p_participant_id uuid,p_action text,p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $core$
DECLARE v_guard jsonb; v_intent jsonb; v_result jsonb;
BEGIN
 IF p_participant_id IS NULL OR p_request_id IS NULL
   OR p_action NOT IN ('dash','disengage','dodge')
 THEN RAISE EXCEPTION 'P13_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
 v_intent:=jsonb_build_object(
  'family','core_action','version','candidate-v1','action',p_action
 );
 v_guard:=private.p13_guard_enter_v1(
    p_request_id,p_participant_id,NULL,'core_action',v_intent);
 IF v_guard->>'kind'='replay' THEN RETURN v_guard->'result'; END IF;
 v_result:=public.encounter_use_core_action_v1(p_participant_id,p_action,p_request_id);
 UPDATE private.p13_guarded_commands SET result=v_result WHERE request_id=p_request_id;
 RETURN v_result;
END $core$;
-- The scratch "cutover" MUST deny direct authenticated bypass of originals,
-- including versions/wrappers. Do not copy any of this grant action to live SQL.
REVOKE ALL ON FUNCTION public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.encounter_use_core_action_v1(uuid,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p13_candidate_cast_spell_v1(uuid,uuid,uuid,integer,uuid)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.p13_candidate_core_action_v1(uuid,text,uuid)
 TO authenticated;
DO $assert$
DECLARE v_version integer;
BEGIN
 IF has_function_privilege('authenticated','public.encounter_cast_spell_v9(uuid,uuid,uuid,integer,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.encounter_use_core_action_v1(uuid,text,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.p13_candidate_cast_spell_v1(uuid,uuid,uuid,integer,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.p13_candidate_core_action_v1(uuid,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'P13 invalid public function grants'; END IF;
END $assert$;
NOTIFY pgrst,'reload schema';

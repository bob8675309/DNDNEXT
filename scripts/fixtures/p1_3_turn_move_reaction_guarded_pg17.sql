-- P1.3 End Turn / Move / Reaction candidate, disposable GitHub Supabase PG17.
-- Source-exact public implementations are loaded below, not rewritten.
-- This file is NOT a live migration. It extends the scratch test environment.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 THEN RAISE EXCEPTION 'P1.3 test must run only on disposable PG17'; END IF;
END $guard$;
ALTER TABLE public.encounters ADD COLUMN map_id uuid;
ALTER TABLE public.encounter_participants
 ADD COLUMN initiative integer DEFAULT 0,
 ADD COLUMN initiative_tiebreaker integer DEFAULT 0,
 ADD COLUMN created_at timestamptz DEFAULT now(),
 ADD COLUMN q integer DEFAULT 0,
 ADD COLUMN r integer DEFAULT 0,
 ADD COLUMN facing text DEFAULT 'east',
 ADD COLUMN team text DEFAULT 'players',
 ADD COLUMN reaction_available boolean NOT NULL DEFAULT true,
 ADD COLUMN bonus_action_available boolean NOT NULL DEFAULT true,
 ADD COLUMN movement_spent_ft integer NOT NULL DEFAULT 0,
 ADD COLUMN turn_started_at timestamptz;
ALTER TABLE public.encounter_conditions
 ADD COLUMN remaining_target_turn_ends integer DEFAULT 0,
 ADD COLUMN updated_at timestamptz DEFAULT now();
CREATE TABLE public.encounter_timed_effects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 encounter_id uuid,
 participant_id uuid,
 source_participant_id uuid,
 expiry_trigger text,
 effect_key text,
 remaining_target_turn_starts integer,
 updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.encounter_reaction_windows(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 encounter_id uuid,
 mover_participant_id uuid,
 reactor_participant_id uuid,
 round integer,
 turn_index integer,
 from_q integer, from_r integer, to_q integer, to_r integer,
 status text NOT NULL DEFAULT 'pending',
 choice text,
 weapon_inventory_item_id uuid,
 result jsonb,
 resolved_at timestamptz
);
CREATE TABLE public.encounter_maps(id uuid PRIMARY KEY,radius integer NOT NULL);
CREATE TABLE public.encounter_hex_overrides(
 map_id uuid,q integer,r integer,terrain_type text,movement_multiplier numeric
);
CREATE TABLE public.encounter_map_objects(
 map_id uuid,q integer,r integer,blocks_movement boolean DEFAULT false
);
-- Selected movement and speed dependencies modeled, NOT real production rules.
CREATE FUNCTION public.encounter_canonical_speed_ft_v1(p_character uuid)
RETURNS integer LANGUAGE sql STABLE AS $speed$ SELECT 30 $speed$;
CREATE FUNCTION private.encounter_timed_speed_penalty_ft_v1(p_participant uuid)
RETURNS integer LANGUAGE sql STABLE AS $penalty$ SELECT 0 $penalty$;
CREATE FUNCTION public.encounter_are_hostile_internal_v1(p_team_a text,p_team_b text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $hostile$
 SELECT p_team_a IS DISTINCT FROM p_team_b $hostile$;
CREATE FUNCTION public.encounter_threat_reach_ft_internal_v1(p_reactor uuid)
RETURNS integer LANGUAGE sql STABLE AS $reach$ SELECT 5 $reach$;
-- Pass choice doesn't invoke the actual opportunity attack; attack remains
-- UNTESTED and must never silently use a mocked combat roll.
\i scripts/fixtures/p1_3_turn_move_reaction_live_pg17.sql

-- Extend the *existing* single private ledger, not a competing request table.
ALTER TABLE private.p13_guarded_commands
 DROP CONSTRAINT p13_guarded_commands_family_check;
ALTER TABLE private.p13_guarded_commands
 ADD CONSTRAINT p13_guarded_commands_family_check
 CHECK (family IN ('spell_single','core_action','end_turn','move','reaction'));

-- Explicitly replace the existing family allowlist in the scratch guard while
-- preserving its source and prior behavior. Reject unexpected changes.
DO $function$
DECLARE
  original text := pg_get_functiondef(
    'private.p13_guard_enter_v1(uuid,uuid,uuid,text,jsonb)'::regprocedure);
  from_text text := 'p_family NOT IN (''spell_single'',''core_action'')';
  to_text text := 'p_family NOT IN (''spell_single'',''core_action'',''end_turn'',''move'',''reaction'')';
BEGIN
 IF position(from_text IN original)=0
 THEN RAISE EXCEPTION 'P1.3 guard family list changed; review required'; END IF;
 EXECUTE replace(original,from_text,to_text);
END $function$;

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
 -- Exact source-aware typed axial path, order material; no unknown step keys.
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
 IF v_guard->>'kind'='replay' THEN RETURN v_guard->'result'; END IF;
 v_result:=public.encounter_move_active_participant_v1(
   p_participant_id,p_path,p_request_id);
 UPDATE private.p13_guarded_commands SET result=v_result WHERE request_id=p_request_id;
 RETURN v_result;
END $move$;

CREATE OR REPLACE FUNCTION public.p13_candidate_end_turn_v1(
 p_participant_id uuid,p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $endturn$
DECLARE v_guard jsonb;v_intent jsonb;v_result jsonb;v_eid uuid;v_next uuid;
BEGIN
 IF p_participant_id IS NULL OR p_request_id IS NULL
 THEN RAISE EXCEPTION 'P13_INVALID_REQUEST' USING ERRCODE='22023'; END IF;
 v_intent:=jsonb_build_object('family','end_turn','version','candidate-v1');
 v_guard:=private.p13_guard_enter_v1(
   p_request_id,p_participant_id,NULL,'end_turn',v_intent);
 IF v_guard->>'kind'='replay' THEN
   -- A turn handoff result names a second participant. Fail closed if this
   -- target later becomes hidden from this caller; safe projection is unproven.
   v_next:=nullif(v_guard->'result'->>'nextParticipantId','')::uuid;
   IF v_next IS NOT NULL AND EXISTS(
     SELECT 1 FROM public.encounter_participants p
     WHERE p.id=v_next AND p.is_hidden
       AND NOT public.is_admin(auth.uid())
       AND p.controller_user_id IS DISTINCT FROM auth.uid())
   THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
   RETURN v_guard->'result';
 END IF;
 SELECT encounter_id INTO v_eid FROM public.encounter_participants
   WHERE id=p_participant_id;
 -- End Turn advances another actor, so lock *all* participants in stable
 -- order after the guard acquired E; earlier guard locked only actor P.
 PERFORM id FROM public.encounter_participants
   WHERE encounter_id=v_eid ORDER BY id FOR UPDATE;
 v_result:=public.encounter_end_turn_v1(p_participant_id,p_request_id);
 UPDATE private.p13_guarded_commands SET result=v_result WHERE request_id=p_request_id;
 RETURN v_result;
END $endturn$;

CREATE OR REPLACE FUNCTION public.p13_candidate_reaction_v1(
 p_window_id uuid,p_choice text,p_inventory_item_id uuid,p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $reaction$
DECLARE
 v_actor uuid;v_mover uuid;v_guard jsonb;v_intent jsonb;
 v_result jsonb;v_window public.encounter_reaction_windows%rowtype;
BEGIN
 IF p_window_id IS NULL OR p_request_id IS NULL
   OR p_choice NOT IN ('attack','pass')
 THEN RAISE EXCEPTION 'P13_INVALID_REACTION' USING ERRCODE='22023'; END IF;
 -- Attack branch needs exact weapon/attack authority integration; fail closed.
 IF p_choice='attack' OR p_inventory_item_id IS NOT NULL
 THEN RAISE EXCEPTION 'P13_GM_ASSISTED_REACTION_ATTACK' USING ERRCODE='22023'; END IF;
 SELECT reactor_participant_id,mover_participant_id INTO v_actor,v_mover
   FROM public.encounter_reaction_windows WHERE id=p_window_id;
 IF v_actor IS NULL OR v_mover IS NULL THEN
   RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 v_intent:=jsonb_build_object(
   'family','reaction','version','candidate-v1',
   'windowId',p_window_id,'choice',p_choice,
   'weaponInstanceId',p_inventory_item_id);
 -- Guard E then deterministic reactor/mover P, then W inside source function.
 v_guard:=private.p13_guard_enter_v1(
   p_request_id,v_actor,v_mover,'reaction',v_intent);
 IF v_guard->>'kind'='replay' THEN RETURN v_guard->'result'; END IF;
 SELECT * INTO v_window FROM public.encounter_reaction_windows
   WHERE id=p_window_id FOR UPDATE;
 IF NOT FOUND OR v_window.status<>'pending'
 THEN RAISE EXCEPTION 'P13_WINDOW_RESOLVED' USING ERRCODE='22023'; END IF;
 -- Recheck target linkage under W lock, not just discovered actor values.
 IF v_window.reactor_participant_id IS DISTINCT FROM v_actor
   OR v_window.mover_participant_id IS DISTINCT FROM v_mover
 THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 v_result:=public.encounter_resolve_opportunity_reaction_v1(
   p_window_id,p_choice,p_inventory_item_id,p_request_id);
 UPDATE private.p13_guarded_commands SET result=v_result WHERE request_id=p_request_id;
 RETURN v_result;
END $reaction$;

-- NEW scratch API functions are not public by default; never expose unguarded
-- direct implementations in a real cutover. These revokes are test-local only.
REVOKE ALL ON FUNCTION public.p13_candidate_move_v1(uuid,jsonb,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.p13_candidate_end_turn_v1(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.p13_candidate_reaction_v1(uuid,text,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.encounter_move_active_participant_v1(uuid,jsonb,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.encounter_end_turn_v1(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.encounter_resolve_opportunity_reaction_v1(uuid,text,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p13_candidate_move_v1(uuid,jsonb,uuid)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.p13_candidate_end_turn_v1(uuid,uuid)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.p13_candidate_reaction_v1(uuid,text,uuid,uuid)
 TO authenticated;
DO $grants$
BEGIN
 IF has_function_privilege('anon','public.p13_candidate_move_v1(uuid,jsonb,uuid)','EXECUTE')
 OR has_function_privilege('anon','public.p13_candidate_end_turn_v1(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon','public.p13_candidate_reaction_v1(uuid,text,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.encounter_move_active_participant_v1(uuid,jsonb,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.encounter_end_turn_v1(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.encounter_resolve_opportunity_reaction_v1(uuid,text,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'P13 turn/move/reaction grant isolation failed'; END IF;
END $grants$;
INSERT INTO public.encounter_maps(id,radius) VALUES(public.p13_auth_uuid(333),5);
INSERT INTO public.characters VALUES
 (public.p13_auth_uuid(630),'TEST Turn-Mover','npc'),
 (public.p13_auth_uuid(631),'TEST Opportunity Reactor','npc');
INSERT INTO public.encounters(id,status,round,turn_index,active_participant_id,map_id)
 VALUES(public.p13_auth_uuid(903),'active',1,0,public.p13_auth_uuid(1030),
        public.p13_auth_uuid(333));
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,current_hp,max_hp,is_hidden,
 controller_user_id,initiative,q,r,team,action_available)
VALUES
 (public.p13_auth_uuid(1030),public.p13_auth_uuid(903),
  public.p13_auth_uuid(630),'TEST Mover',20,20,false,NULL,20,0,0,'players',true),
 (public.p13_auth_uuid(1031),public.p13_auth_uuid(903),
  public.p13_auth_uuid(631),'TEST Reactor',20,20,false,NULL,10,1,0,'enemy',true);
INSERT INTO public.encounter_conditions(participant_id,condition_key,remaining_target_turn_ends)
 VALUES(public.p13_auth_uuid(1030),'test_expiring_condition',1);
INSERT INTO public.encounter_timed_effects(
 encounter_id,participant_id,source_participant_id,expiry_trigger,effect_key,
 remaining_target_turn_starts)
VALUES(public.p13_auth_uuid(903),public.p13_auth_uuid(1030),
 public.p13_auth_uuid(1031),'target_turn_end','test_expiring_effect',1);
-- Separate synthetic encounter for Move versus End Turn contention.
INSERT INTO public.characters VALUES
 (public.p13_auth_uuid(640),'TEST Race Mover','npc'),
 (public.p13_auth_uuid(641),'TEST Race Next','npc'),
 (public.p13_auth_uuid(650),'TEST Reaction Race Mover','npc'),
 (public.p13_auth_uuid(651),'TEST Reaction Race Reactor','npc');
INSERT INTO public.encounters(id,status,round,turn_index,active_participant_id,map_id)
VALUES
 (public.p13_auth_uuid(904),'active',1,0,public.p13_auth_uuid(1040),public.p13_auth_uuid(333)),
 (public.p13_auth_uuid(905),'active',1,0,public.p13_auth_uuid(1050),public.p13_auth_uuid(333));
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,current_hp,max_hp,is_hidden,
 controller_user_id,initiative,q,r,team,action_available)
VALUES
 (public.p13_auth_uuid(1040),public.p13_auth_uuid(904),public.p13_auth_uuid(640),
 'TEST Race Mover',20,20,false,NULL,20,0,0,'players',true),
 (public.p13_auth_uuid(1041),public.p13_auth_uuid(904),public.p13_auth_uuid(641),
 'TEST Race Next',20,20,false,NULL,10,3,0,'players',true),
 (public.p13_auth_uuid(1050),public.p13_auth_uuid(905),public.p13_auth_uuid(650),
 'TEST Reaction Race Mover',20,20,false,NULL,20,0,0,'players',true),
 (public.p13_auth_uuid(1051),public.p13_auth_uuid(905),public.p13_auth_uuid(651),
 'TEST Reaction Race Reactor',20,20,false,NULL,10,1,0,'enemy',true);
INSERT INTO public.encounter_reaction_windows(
 id,encounter_id,mover_participant_id,reactor_participant_id,
 round,turn_index,from_q,from_r,to_q,to_r)
VALUES
 (public.p13_auth_uuid(5050),public.p13_auth_uuid(905),
 public.p13_auth_uuid(1050),public.p13_auth_uuid(1051),1,0,0,0,-1,0),
 (public.p13_auth_uuid(5051),public.p13_auth_uuid(905),
 public.p13_auth_uuid(1050),public.p13_auth_uuid(1051),1,0,0,0,0,-1);
NOTIFY pgrst,'reload schema';

-- P1.3 original Opportunity Attack + original damage processor, restricted
-- UNARMED RESEARCH ONLY with deterministic synthetic attack roll and stats.
-- Disposable GitHub GoTrue/PostgreSQL 17, NOT production SQL or deployable rules.
\set ON_ERROR_STOP on
DO $g$ BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 THEN RAISE EXCEPTION 'P1.3 unarmed model requires disposable local PG17'; END IF;
END $g$;
ALTER TABLE public.encounter_participants
 ADD COLUMN armor_class integer NOT NULL DEFAULT 10,
 ADD COLUMN temp_hp integer NOT NULL DEFAULT 0,
 ADD COLUMN damage_resistances text[] NOT NULL DEFAULT '{}'::text[],
 ADD COLUMN damage_immunities text[] NOT NULL DEFAULT '{}'::text[],
 ADD COLUMN damage_vulnerabilities text[] NOT NULL DEFAULT '{}'::text[];
-- All actual combat roll/weapon/equipment dependencies remain explicit
-- test doubles. Source-exact weapon profile and real D20 advantage logic have
-- NOT been run; no assertion of normal gameplay fidelity.
CREATE FUNCTION public.encounter_canonical_combat_snapshot_v1(p_character_id uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $snapshot$
 SELECT '{"str":16,"dex":10,"prof":2}'::jsonb $snapshot$;
CREATE FUNCTION public.encounter_weapon_profile_internal_v1(
 p_participant_id uuid,p_inventory_item_id uuid
) RETURNS jsonb LANGUAGE sql STABLE AS $weapon$
 SELECT NULL::jsonb $weapon$;
CREATE FUNCTION private.encounter_equipped_damage_mitigation_v1(
 p_character_id uuid,p_damage_type text
) RETURNS jsonb LANGUAGE sql STABLE AS $mitigation$
 SELECT '{"resistant":false,"flatReduction":0,"sources":[]}'::jsonb $mitigation$;
CREATE FUNCTION private.encounter_resolve_attack_roll_v1(
 p_attacker_id uuid,p_target_id uuid,p_base_disadvantage boolean DEFAULT false
) RETURNS jsonb LANGUAGE sql STABLE AS $roll$
 SELECT '{"roll":15,"secondRoll":null,"advantage":false,"disadvantage":false,
          "guidingBoltAdvantage":false,"guidingBoltEffectConsumed":false,
          "advantageCanceledByDisadvantage":false}'::jsonb $roll$;
-- Exact original deployed internal reaction, damage, suppression functions,
-- each with its live source MD5 in the imported SQL file.
\i scripts/fixtures/p1_3_reaction_attack_damage_live_pg17.sql
-- Prohibit direct browser access to new original internal functions.
REVOKE ALL ON FUNCTION public.encounter_opportunity_attack_internal_v1(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.encounter_apply_damage_internal_v1(uuid,integer,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.encounter_has_timed_effect_v1(uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.encounter_canonical_combat_snapshot_v1(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.encounter_weapon_profile_internal_v1(uuid,uuid)
 FROM PUBLIC,anon,authenticated;

-- Separate opt-in unarmed-only research RPC. The normal five-family candidate
-- still deliberately blocks Attack. No synthetic weapon roll is authorized.
CREATE OR REPLACE FUNCTION public.p13_candidate_unarmed_reaction_research_v1(
 p_window_id uuid,p_inventory_item_id uuid,p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $attack$
DECLARE
 v_actor uuid;v_mover uuid;v_guard jsonb;v_intent jsonb;
 v_window public.encounter_reaction_windows%rowtype;v_result jsonb;
BEGIN
 IF p_window_id IS NULL OR p_request_id IS NULL
 THEN RAISE EXCEPTION 'P13_INVALID_REACTION' USING ERRCODE='22023'; END IF;
 IF p_inventory_item_id IS NOT NULL
 THEN RAISE EXCEPTION 'P13_GM_ASSISTED_WEAPON_ATTACK' USING ERRCODE='22023'; END IF;
 SELECT reactor_participant_id,mover_participant_id
 INTO v_actor,v_mover FROM public.encounter_reaction_windows
 WHERE id=p_window_id;
 IF v_actor IS NULL OR v_mover IS NULL
 THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 v_intent:=jsonb_build_object(
  'family','reaction','version','candidate-v1','windowId',p_window_id,
  'choice','attack','weaponInstanceId',p_inventory_item_id);
 -- Guard acquires E, then sorted reactor/mover P, validates controller and
 -- target visibility, then checks original request ID / exact typed intent.
 v_guard:=private.p13_guard_enter_v1(
   p_request_id,v_actor,v_mover,'reaction',v_intent);
 IF v_guard->>'kind'='replay' THEN RETURN v_guard->'result'; END IF;
 SELECT * INTO v_window FROM public.encounter_reaction_windows
 WHERE id=p_window_id FOR UPDATE;
 IF NOT FOUND OR v_window.status<>'pending'
 THEN RAISE EXCEPTION 'P13_WINDOW_RESOLVED' USING ERRCODE='22023'; END IF;
 IF v_window.reactor_participant_id IS DISTINCT FROM v_actor
    OR v_window.mover_participant_id IS DISTINCT FROM v_mover
 THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 -- Original source outer reaction function calls the original attack,
 -- original damage and suppression processors below synthetic roll helpers.
 v_result:=public.encounter_resolve_opportunity_reaction_v1(
   p_window_id,'attack',NULL,p_request_id);
 UPDATE private.p13_guarded_commands SET result=v_result WHERE request_id=p_request_id;
 RETURN v_result;
END $attack$;
REVOKE ALL ON FUNCTION public.p13_candidate_unarmed_reaction_research_v1(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p13_candidate_unarmed_reaction_research_v1(uuid,uuid,uuid)
 TO authenticated;
DO $grant$
BEGIN
 IF has_function_privilege('anon',
   'public.p13_candidate_unarmed_reaction_research_v1(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.encounter_opportunity_attack_internal_v1(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.encounter_apply_damage_internal_v1(uuid,integer,text)','EXECUTE')
 THEN RAISE EXCEPTION 'P13 unarmed research direct grant violation'; END IF;
END $grant$;

-- Self-contained synthetic reactions: x=12..19 corresponds to E912..E919,
-- P1120/P1121 through P1190/P1191, and W5120 through W5190.
INSERT INTO public.characters(id,name,kind)
SELECT public.p13_auth_uuid(720+10*(x-12)),'Unarmed mover '||x,'npc'
FROM generate_series(12,19) x
UNION ALL
SELECT public.p13_auth_uuid(721+10*(x-12)),'Unarmed reactor '||x,'npc'
FROM generate_series(12,19) x;
INSERT INTO public.encounters(
 id,status,round,turn_index,active_participant_id,map_id)
SELECT public.p13_auth_uuid(900+x),'active',1,0,
 public.p13_auth_uuid(1000+10*x),public.p13_auth_uuid(333)
FROM generate_series(12,19) x;
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,current_hp,max_hp,
 is_hidden,controller_user_id,initiative,q,r,team,action_available,reaction_available)
SELECT public.p13_auth_uuid(1000+10*x),public.p13_auth_uuid(900+x),
 public.p13_auth_uuid(720+10*(x-12)),'Unarmed target '||x,20,20,
 false,NULL,20,0,0,'players',true,true
FROM generate_series(12,19) x
UNION ALL
SELECT public.p13_auth_uuid(1001+10*x),public.p13_auth_uuid(900+x),
 public.p13_auth_uuid(721+10*(x-12)),'Unarmed attacker '||x,20,20,
 false,NULL,10,1,0,'enemy',true,true
FROM generate_series(12,19) x;
INSERT INTO public.encounter_reaction_windows(
 id,encounter_id,mover_participant_id,reactor_participant_id,
 round,turn_index,from_q,from_r,to_q,to_r)
SELECT public.p13_auth_uuid(5000+10*x),public.p13_auth_uuid(900+x),
 public.p13_auth_uuid(1000+10*x),public.p13_auth_uuid(1001+10*x),
 1,0,0,0,-1,0
FROM generate_series(12,19) x;
-- Stress the ORIGINAL damage source branches with synthetic typed effects.
UPDATE public.encounter_participants
 SET damage_resistances=ARRAY['bludgeoning']
 WHERE id=public.p13_auth_uuid(1180);
UPDATE public.encounter_participants
 SET damage_immunities=ARRAY['bludgeoning']
 WHERE id=public.p13_auth_uuid(1190);
NOTIFY pgrst,'reload schema';

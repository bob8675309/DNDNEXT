-- P1.3 exact original weapon profile, isolated research only.
-- Runs AFTER original roll/effect JWT cases; never against production.
\set ON_ERROR_STOP on
DO $local$ BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 THEN RAISE EXCEPTION 'P13 research requires disposable PG17'; END IF;
END $local$;
CREATE TABLE public.inventory_items(
 id uuid PRIMARY KEY,item_id text NOT NULL,item_name text NOT NULL,
 item_type text,owner_type text,owner_id text,is_equipped boolean NOT NULL DEFAULT false,
 card_payload jsonb,equip_slot text
);
CREATE TABLE public.items_catalog(
 item_key text PRIMARY KEY,item_name text NOT NULL,payload jsonb NOT NULL
);
CREATE TABLE public.character_sheets(
 character_id uuid PRIMARY KEY,sheet jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.class_catalog_preferred(
 class_key text PRIMARY KEY,raw_payload jsonb
);
\i scripts/fixtures/p1_3_original_weapon_profile_live_pg17.sql
REVOKE ALL ON FUNCTION public.encounter_weapon_profile_internal_v1(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
DO $g$ BEGIN
 IF has_function_privilege('authenticated',
   'public.encounter_weapon_profile_internal_v1(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Original source weapon profile is public'; END IF;
END $g$;
-- The existing unarmed-only RPC remains intact; a distinct test RPC exposes
-- ONLY equipped melee weapon path with the shared original typed guard.
CREATE OR REPLACE FUNCTION public.p13_candidate_weapon_reaction_research_v1(
 p_window_id uuid,p_inventory_item_id uuid,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $weapon$
DECLARE v_actor uuid;v_mover uuid;v_guard jsonb;v_intent jsonb;
 v_window public.encounter_reaction_windows%rowtype;v_result jsonb;
BEGIN
 IF p_window_id IS NULL OR p_inventory_item_id IS NULL OR p_request_id IS NULL
 THEN RAISE EXCEPTION 'P13_INVALID_WEAPON_REQUEST' USING ERRCODE='22023'; END IF;
 SELECT reactor_participant_id,mover_participant_id INTO v_actor,v_mover
 FROM public.encounter_reaction_windows WHERE id=p_window_id;
 IF v_actor IS NULL OR v_mover IS NULL
 THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 v_intent:=jsonb_build_object(
 'family','reaction','version','candidate-v1','windowId',p_window_id,
 'choice','attack','weaponInstanceId',p_inventory_item_id);
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
 -- Exact original resolver invokes original weapon profile, original roll
 -- (including X), original damage and reaction budget. Inventory read locking
 -- against concurrent equip/ownership changes is NOT yet demonstrated.
 v_result:=public.encounter_resolve_opportunity_reaction_v1(
 p_window_id,'attack',p_inventory_item_id,p_request_id);
 UPDATE private.p13_guarded_commands
 SET result=v_result WHERE request_id=p_request_id;
 RETURN v_result;
END $weapon$;
REVOKE ALL ON FUNCTION public.p13_candidate_weapon_reaction_research_v1(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p13_candidate_weapon_reaction_research_v1(uuid,uuid,uuid)
 TO authenticated;
-- Synthetic E930..E937, P1300..P1371, W5300..W5370.
INSERT INTO public.characters(id,name,kind)
SELECT public.p13_auth_uuid(940+10*(n-30)),'Weapon target '||n,'npc'
FROM generate_series(30,37) n
UNION ALL
SELECT public.p13_auth_uuid(941+10*(n-30)),'Weapon reactor '||n,'npc'
FROM generate_series(30,37) n;
INSERT INTO public.encounters(id,status,round,turn_index,active_participant_id,map_id)
SELECT public.p13_auth_uuid(900+n),'active',1,0,
 public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(333)
FROM generate_series(30,37) n;
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,current_hp,max_hp,
 is_hidden,controller_user_id,initiative,q,r,team,action_available,reaction_available)
SELECT public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(940+10*(n-30)),'Weapon target '||n,20,20,
 false,NULL::uuid,20,0,0,'players',true,true
FROM generate_series(30,37) n
UNION ALL
SELECT public.p13_auth_uuid(1001+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(941+10*(n-30)),'Weapon attacker '||n,20,20,
 false,NULL::uuid,10,1,0,'enemy',true,true
FROM generate_series(30,37) n;
INSERT INTO public.encounter_reaction_windows(
 id,encounter_id,mover_participant_id,reactor_participant_id,
 round,turn_index,from_q,from_r,to_q,to_r)
SELECT public.p13_auth_uuid(5000+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(1001+10*n),
 1,0,0,0,-1,0 FROM generate_series(30,37) n;
INSERT INTO public.class_catalog_preferred(class_key,raw_payload)
 VALUES('fighter','{"starting_proficiencies":{"weapons":["martial"]}}'::jsonb);
INSERT INTO public.character_sheets(character_id,sheet)
SELECT public.p13_auth_uuid(941+10*(n-30)),
 '{"meta":{"classKey":"fighter"},"proficiencyBonus":2}'::jsonb
FROM generate_series(30,37) n;
INSERT INTO public.items_catalog(item_key,item_name,payload)
VALUES
 ('test-blade','Fixture Blade','{"name":"Fixture Blade","item_type":"Melee Weapon","type":"M","weapon":"true","dmg1":"1d1","dmgType":"S","weaponCategory":"martial","property":[]}'::jsonb),
 ('test-bow','Fixture Bow','{"name":"Fixture Bow","item_type":"Ranged Weapon","type":"R","weapon":"true","dmg1":"1d1","dmgType":"P","weaponCategory":"martial","property":[]}'::jsonb),
 ('test-reach','Fixture Reach Weapon','{"name":"Fixture Reach Weapon","item_type":"Melee Weapon","type":"M","weapon":"true","dmg1":"1d1","dmgType":"P","weaponCategory":"martial","property":["R"]}'::jsonb);
-- Each equipped item belongs to its original character, except E937:
-- player-owned inventory must have matching character_permissions.can_edit
-- under the CURRENT live source. Combat-only can_control is not accepted yet.
INSERT INTO public.inventory_items(
 id,item_id,item_name,item_type,owner_type,owner_id,is_equipped,card_payload,equip_slot)
SELECT public.p13_auth_uuid(6000+10*n),
 CASE WHEN n=33 THEN 'test-bow' WHEN n=36 THEN 'test-reach' ELSE 'test-blade' END,
 CASE WHEN n=33 THEN 'Fixture Bow' WHEN n=36 THEN 'Fixture Reach Weapon' ELSE 'Fixture Blade' END,
 CASE WHEN n=33 THEN 'Ranged Weapon' ELSE 'Melee Weapon' END,
 CASE WHEN n=37 THEN 'player' ELSE 'npc' END,
 CASE WHEN n=37 THEN '00000000-0000-0000-0000-000000000001'
      ELSE public.p13_auth_uuid(941+10*(n-30))::text END,
 n<>32,'{}'::jsonb,'mainhand'
FROM generate_series(30,37) n;
NOTIFY pgrst,'reload schema';

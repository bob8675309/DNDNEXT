-- P1.3 inventory-row I race / combat-only item authority; disposable PG17.
-- Builds on verified source-accurate opportunity/weapon fixtures. NOT migration.
\set ON_ERROR_STOP on
DO $g$ BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 THEN RAISE EXCEPTION 'P13 inventory isolation requires disposable PG17'; END IF;
END $g$;
ALTER TABLE public.character_permissions
 ADD COLUMN can_inventory boolean NOT NULL DEFAULT false,
 ADD COLUMN can_convert boolean NOT NULL DEFAULT false;
ALTER TABLE public.inventory_items
 ADD COLUMN user_id uuid,
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE public.players(user_id uuid PRIMARY KEY);
CREATE FUNCTION private.current_user_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $admin$ SELECT public.is_admin(auth.uid()) $admin$;
\i scripts/fixtures/p1_3_equipment_mutation_live_pg17.sql
-- Exact original writer RPCs are callable to signed-in editor/inventory roles
-- in the scratch model; anonymous/browser raw table access remains forbidden.
REVOKE ALL ON FUNCTION public.set_character_inventory_equipment_v1(uuid,uuid,boolean,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.transfer_inventory_item_v1(uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_character_inventory_equipment_v1(uuid,uuid,boolean,text)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_inventory_item_v1(uuid,text,text)
 TO authenticated;
REVOKE ALL ON FUNCTION private.can_access_character_v1(uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.inventory_items,public.character_sheets,
 public.character_permissions FROM PUBLIC,anon,authenticated;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_permissions ENABLE ROW LEVEL SECURITY;

-- Clone the *exact existing original* profile into a private, combat-only
-- helper and modify ONLY the player-owned item association test:
-- can_inventory OR can_edit on the ACTUAL ITEM OWNER (not the controller).
-- The shared guard must separately verify the caller controls the actor.
-- Original public weapon-profile body remains unmodified and private from users.
DO $clone$
DECLARE v_src text:=pg_get_functiondef(
 'public.encounter_weapon_profile_internal_v1(uuid,uuid)'::regprocedure);
BEGIN
 IF position('public.encounter_weapon_profile_internal_v1(' IN v_src)=0
    OR position('and coalesce(cp.can_edit,false)' IN v_src)=0
 THEN RAISE EXCEPTION 'Original weapon profile changed; source-review needed'; END IF;
 v_src:=replace(v_src,
  'public.encounter_weapon_profile_internal_v1(',
  'private.p13_combat_weapon_profile_v1(');
 v_src:=replace(v_src,
  'and coalesce(cp.can_edit,false)',
  'and (coalesce(cp.can_edit,false) or coalesce(cp.can_inventory,false))');
 EXECUTE v_src;
END $clone$;
REVOKE ALL ON FUNCTION private.p13_combat_weapon_profile_v1(uuid,uuid)
 FROM PUBLIC,anon,authenticated;

-- For the disposable combat-only candidate, rewrite ONLY the named helper
-- call in a scratch copy of original attack internals. Other attack/damage
-- source operations and original public weapon-profile RPC remain unchanged.
DO $attack$
DECLARE v_src text:=pg_get_functiondef(
 'public.encounter_opportunity_attack_internal_v1(uuid,uuid,uuid)'::regprocedure);
  from_call text:='public.encounter_weapon_profile_internal_v1(v_r.id,p_inventory_item_id)';
  to_call text:='private.p13_combat_weapon_profile_v1(v_r.id,p_inventory_item_id)';
BEGIN
 IF position(from_call IN v_src)=0 THEN
  RAISE EXCEPTION 'Attack helper call changed; review source before test'; END IF;
 EXECUTE replace(v_src,from_call,to_call);
END $attack$;

-- After E/P/request guard, acquire selected inventory I row FOR UPDATE
-- BEFORE the original W and attack helper. This yields E -> P -> L -> I -> W
-- in this *bounded* test; cross-route ordering with C/S/X is NOT proven.
CREATE OR REPLACE FUNCTION public.p13_candidate_locked_weapon_reaction_v1(
 p_window_id uuid,p_inventory_item_id uuid,p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $locked$
DECLARE v_actor uuid;v_mover uuid;v_guard jsonb;v_intent jsonb;
 v_win public.encounter_reaction_windows%rowtype;
 v_actor_row public.encounter_participants%rowtype;
 v_inv public.inventory_items%rowtype; v_linked boolean;v_result jsonb;
BEGIN
 IF p_window_id IS NULL OR p_inventory_item_id IS NULL OR p_request_id IS NULL
 THEN RAISE EXCEPTION 'P13_INVALID_WEAPON_REQUEST' USING ERRCODE='22023'; END IF;
 SELECT reactor_participant_id,mover_participant_id INTO v_actor,v_mover
 FROM public.encounter_reaction_windows WHERE id=p_window_id;
 IF v_actor IS NULL OR v_mover IS NULL
 THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 v_intent:=jsonb_build_object(
 'family','reaction','version','candidate-v1',
 'windowId',p_window_id,'choice','attack','weaponInstanceId',p_inventory_item_id);
 v_guard:=private.p13_guard_enter_v1(
 p_request_id,v_actor,v_mover,'reaction',v_intent);
 -- E and sorted P are held. Determine canonical character from DB, not client.
 SELECT * INTO v_actor_row FROM public.encounter_participants WHERE id=v_actor;
 SELECT * INTO v_inv FROM public.inventory_items
 WHERE id=p_inventory_item_id FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(v_inv.is_equipped,false)
 THEN RAISE EXCEPTION 'P13_EQUIPMENT_NOT_AVAILABLE' USING ERRCODE='42501'; END IF;
 v_linked:=(v_inv.owner_id=v_actor_row.character_id::text
      AND lower(coalesce(v_inv.owner_type,'')) IN ('npc','merchant','character'))
  OR (lower(coalesce(v_inv.owner_type,''))='player' AND EXISTS(
    SELECT 1 FROM public.character_permissions cp
    WHERE cp.character_id=v_actor_row.character_id
      AND cp.user_id::text=v_inv.owner_id
      AND (coalesce(cp.can_inventory,false) OR coalesce(cp.can_edit,false))));
 IF NOT v_linked THEN
   RAISE EXCEPTION 'P13_EQUIPMENT_NOT_AVAILABLE' USING ERRCODE='42501'; END IF;
 IF v_guard->>'kind'='replay' THEN
   -- Conservative privacy: an item transferred/revoked since original action
   -- cannot be used to retrieve old private weapon details. Policy provisional.
   RETURN v_guard->'result';
 END IF;
 SELECT * INTO v_win FROM public.encounter_reaction_windows
 WHERE id=p_window_id FOR UPDATE;
 IF NOT FOUND OR v_win.status<>'pending'
 THEN RAISE EXCEPTION 'P13_WINDOW_RESOLVED' USING ERRCODE='22023'; END IF;
 IF v_win.reactor_participant_id IS DISTINCT FROM v_actor
 OR v_win.mover_participant_id IS DISTINCT FROM v_mover
 THEN RAISE EXCEPTION 'P13_REQUEST_REJECTED' USING ERRCODE='42501'; END IF;
 v_result:=public.encounter_resolve_opportunity_reaction_v1(
 p_window_id,'attack',p_inventory_item_id,p_request_id);
 UPDATE private.p13_guarded_commands SET result=v_result
 WHERE request_id=p_request_id;
 RETURN v_result;
END $locked$;
REVOKE ALL ON FUNCTION public.p13_candidate_locked_weapon_reaction_v1(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p13_candidate_locked_weapon_reaction_v1(uuid,uuid,uuid)
 TO authenticated;

-- Controlled clock barrier: mutate row under the exact original equip or
-- transfer writer, then hold the I-row lock for one second using an isolated
-- BEFORE UPDATE trigger. Its advisory xact lock is only a test handshake.
CREATE OR REPLACE FUNCTION private.p13_inventory_race_barrier_v1()
RETURNS trigger LANGUAGE plpgsql AS $barrier$
BEGIN
 IF (new.is_equipped IS DISTINCT FROM old.is_equipped OR
     new.owner_id IS DISTINCT FROM old.owner_id)
    AND new.id IN (
      public.p13_auth_uuid(6400),
      public.p13_auth_uuid(6410),
      public.p13_auth_uuid(6420)
    ) THEN
  PERFORM pg_advisory_xact_lock(131303);
  PERFORM pg_sleep(1.1);
 END IF;
 RETURN new;
END $barrier$;
CREATE TRIGGER p13_inventory_race_barrier
BEFORE UPDATE OF is_equipped,owner_id ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION private.p13_inventory_race_barrier_v1();

-- Test encounters E940-947 / W5400-5470 / actors P1400-1471.
INSERT INTO public.characters(id,name,kind)
SELECT public.p13_auth_uuid(1040+10*(n-40)),'I-race target '||n,'npc'
FROM generate_series(40,47) n
UNION ALL
SELECT public.p13_auth_uuid(1041+10*(n-40)),'I-race reactor '||n,'npc'
FROM generate_series(40,47) n;
INSERT INTO public.encounters(id,status,round,turn_index,active_participant_id,map_id)
SELECT public.p13_auth_uuid(900+n),'active',1,0,
 public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(333)
FROM generate_series(40,47) n;
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,current_hp,max_hp,
 is_hidden,controller_user_id,initiative,q,r,team,action_available,reaction_available)
SELECT public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(1040+10*(n-40)),'I-race target '||n,20,20,
 false,NULL::uuid,20,0,0,'players',true,true
FROM generate_series(40,47) n
UNION ALL
SELECT public.p13_auth_uuid(1001+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(1041+10*(n-40)),'I-race reactor '||n,20,20,
 false,NULL::uuid,10,1,0,'enemy',true,true
FROM generate_series(40,47) n;
INSERT INTO public.encounter_reaction_windows(
 id,encounter_id,mover_participant_id,reactor_participant_id,
 round,turn_index,from_q,from_r,to_q,to_r)
SELECT public.p13_auth_uuid(5000+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(1001+10*n),
 1,0,0,0,-1,0 FROM generate_series(40,47) n;
INSERT INTO public.character_sheets(character_id,sheet)
SELECT public.p13_auth_uuid(1041+10*(n-40)),
 '{"meta":{"classKey":"fighter"},"proficiencyBonus":2}'::jsonb
FROM generate_series(40,47) n;
INSERT INTO public.inventory_items(
 id,item_id,item_name,item_type,owner_type,owner_id,is_equipped,card_payload,equip_slot)
SELECT public.p13_auth_uuid(6000+10*n),'test-blade','Fixture Blade',
 'Melee Weapon','npc',
 public.p13_auth_uuid(1041+10*(n-40))::text,
 true,'{}'::jsonb,'weapon_1'
FROM generate_series(40,47) n;
-- Owner_type/player scenario E944: actual owner ID is populated by the JS
-- test AFTER genuine local user signup; player has can_inventory, not can_edit.
NOTIFY pgrst,'reload schema';

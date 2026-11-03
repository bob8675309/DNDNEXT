-- P1.3 in-flight grant/controller races with source RLS policy parity.
-- Runs AFTER existing 48-141 cases; disposable GitHub PG17 ONLY.
\set ON_ERROR_STOP on
DO $check$ BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 THEN RAISE EXCEPTION 'P13 local PG17 only'; END IF;
END $check$;
-- The live schema has is_hidden on characters; earlier scratch table did not.
ALTER TABLE public.characters ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.encounter_participants ADD COLUMN state jsonb;

-- Recreate EXACT policy predicates from read-only public.pg_policies audit,
-- with the same authenticated role grant, but without any production rows.
-- These policies are test-local. Do not claim full RLS parity for other tables.
GRANT SELECT ON public.characters,public.character_sheets,
 public.inventory_items,public.character_permissions TO authenticated;
GRANT UPDATE ON public.character_permissions TO authenticated;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY p13_live_char_visible ON public.characters
 FOR SELECT TO authenticated
 USING ((NOT COALESCE(is_hidden,false)) OR
        (SELECT private.can_access_character_v1(characters.id,'read')));
CREATE POLICY p13_live_sheet_visible ON public.character_sheets
 FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.characters c
               WHERE c.id=character_sheets.character_id));
CREATE POLICY p13_live_inventory_select ON public.inventory_items
 FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid())
        OR (SELECT private.current_user_is_admin()));
CREATE POLICY p13_live_permissions_admin_write ON public.character_permissions
 FOR ALL TO authenticated
 USING ((SELECT private.current_user_is_admin()))
 WITH CHECK ((SELECT private.current_user_is_admin()));
CREATE POLICY p13_live_permissions_select_self ON public.character_permissions
 FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) OR
        (SELECT private.current_user_is_admin()));

-- Exact original Admin staging writer refuses changing active encounters.
\i scripts/fixtures/p1_3_admin_staging_source_pg17.sql
REVOKE ALL ON FUNCTION public.admin_update_encounter_participant_staging_v1(
 uuid,integer,integer,text,uuid,numeric,numeric,boolean,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_encounter_participant_staging_v1(
 uuid,integer,integer,text,uuid,numeric,numeric,boolean,jsonb)
 TO authenticated;

-- Genuine signed-in admin CP UPDATE locks grant-row G first; test trigger holds
-- the row during revocation so an I-only reader can observe old grant.
CREATE OR REPLACE FUNCTION private.p13_grant_revocation_barrier_v1()
RETURNS trigger LANGUAGE plpgsql AS $barrier$
BEGIN
 IF old.can_inventory AND NOT new.can_inventory
  AND new.character_id IN ('00000000-0000-0000-0000-000000001121'::uuid,
                           '00000000-0000-0000-0000-000000001131'::uuid) THEN
  PERFORM pg_advisory_xact_lock(131307);
  PERFORM pg_sleep(1.1);
 END IF;
 RETURN new;
END $barrier$;
CREATE TRIGGER p13_grant_revocation_barrier
 BEFORE UPDATE OF can_inventory ON public.character_permissions
 FOR EACH ROW EXECUTE FUNCTION private.p13_grant_revocation_barrier_v1();

-- Test-only active Admin path. The real staging API cannot alter active P.
-- This modeled path locks E then P before assignment; no live equivalent
-- is asserted or deployed. Audit Admin/trigger routes before migration.
CREATE OR REPLACE FUNCTION public.p13_reassign_active_controller_research_v1(
 p_actor uuid,p_new_controller uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $reassign$
DECLARE v_eid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid())
 THEN RAISE EXCEPTION 'P13_ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT encounter_id INTO v_eid
 FROM public.encounter_participants WHERE id=p_actor;
 IF v_eid IS NULL THEN RAISE EXCEPTION 'P13_ACTOR_NOT_FOUND' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.encounters WHERE id=v_eid FOR UPDATE;
 PERFORM id FROM public.encounter_participants WHERE id=p_actor FOR UPDATE;
 UPDATE public.encounter_participants SET
   controller_user_id=p_new_controller,updated_at=now()
 WHERE id=p_actor;
 RETURN true;
END $reassign$;
REVOKE ALL ON FUNCTION public.p13_reassign_active_controller_research_v1(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p13_reassign_active_controller_research_v1(uuid,uuid)
 TO authenticated;
CREATE OR REPLACE FUNCTION private.p13_controller_reassignment_barrier_v1()
RETURNS trigger LANGUAGE plpgsql AS $barrier$
BEGIN
 IF new.id='00000000-0000-0000-0000-000000001501'::uuid
 AND new.controller_user_id IS DISTINCT FROM old.controller_user_id THEN
   PERFORM pg_advisory_xact_lock(131308);
   PERFORM pg_sleep(1.1);
 END IF;
 RETURN new;
END $barrier$;
CREATE TRIGGER p13_controller_reassignment_barrier
 BEFORE UPDATE OF controller_user_id ON public.encounter_participants
 FOR EACH ROW EXECUTE FUNCTION private.p13_controller_reassignment_barrier_v1();

-- E948-955, participants P1480..P1551 and weapons I6480..I6550.
INSERT INTO public.characters(id,name,kind)
SELECT public.p13_auth_uuid(1040+10*(n-40)),
 'Grant-test target '||n,'npc' FROM generate_series(48,55) n
UNION ALL
SELECT public.p13_auth_uuid(1041+10*(n-40)),
 'Grant-test actor '||n,'npc' FROM generate_series(48,55) n;
INSERT INTO public.encounters(id,status,round,turn_index,
 active_participant_id,map_id)
SELECT public.p13_auth_uuid(900+n),'active',1,0,
 public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(333)
FROM generate_series(48,55) n;
INSERT INTO public.encounter_participants(id,encounter_id,character_id,
 display_name,current_hp,max_hp,is_hidden,controller_user_id,
 initiative,q,r,team,action_available,reaction_available)
SELECT public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(1040+10*(n-40)),
 'Grant target '||n,20,20,false,NULL::uuid,20,0,0,'players',true,true
FROM generate_series(48,55) n
UNION ALL
SELECT public.p13_auth_uuid(1001+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(1041+10*(n-40)),
 'Grant actor '||n,20,20,false,NULL::uuid,10,1,0,'enemy',true,true
FROM generate_series(48,55) n;
INSERT INTO public.encounter_reaction_windows(id,encounter_id,
 mover_participant_id,reactor_participant_id,round,turn_index,
 from_q,from_r,to_q,to_r)
SELECT public.p13_auth_uuid(5000+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(1001+10*n),
 1,0,0,0,-1,0 FROM generate_series(48,55) n;
INSERT INTO public.character_sheets(character_id,sheet)
SELECT public.p13_auth_uuid(1041+10*(n-40)),
 jsonb_build_object('meta',jsonb_build_object('classKey','fighter'),
   'secretFixture','NON-PRODUCTION-TEST-NPC-SHEET-'||n)
FROM generate_series(48,55) n;
INSERT INTO public.inventory_items(id,item_id,item_name,item_type,
 owner_type,owner_id,is_equipped,card_payload,equip_slot)
SELECT public.p13_auth_uuid(6000+10*n),'test-blade',
 'Fixture Blade','Melee Weapon','npc',
 public.p13_auth_uuid(1041+10*(n-40))::text,
 true,'{}'::jsonb,'weapon_1'
FROM generate_series(48,55) n;
-- The hidden actor's sheet is reachable to its owner only under source-like
-- characters+sheet RLS; the combat controller has NO character permission.
UPDATE public.characters SET is_hidden=true
WHERE id=public.p13_auth_uuid(1171);
NOTIFY pgrst,'reload schema';

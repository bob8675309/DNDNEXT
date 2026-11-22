-- C34 B14-P16: UNINSTALLED, DISPOSABLE PostgreSQL17 / signed GoTrue only.
-- PROTOTYPE of coordinated legacy NPC consent / raw-owner-DML cutover.
-- This file is NOT a production migration or permission-release instruction.
-- Never run on hosted Supabase. Do NOT modify world-map, Town, merchant sources.
--
-- Earlier P6/P8/P14 genuine signed tests MUST run before this installation.
-- The research runner restores original fixture grants/objects after testing.
-- The direct NPC/merchant INSERT guard intentionally preserves GM creation,
-- and does NOT claim to close all 34 historical sheet/materializer writers.
BEGIN;
DO $p16_guard$
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('public.inventory_items') IS NULL
  OR to_regclass('public.character_permissions') IS NULL
  OR to_regclass('private.c34_b14_p14_batch_offer_links') IS NULL
  OR to_regprocedure('public.c34_b14_p14_my_intent_status_v1(uuid)') IS NULL
  OR to_regprocedure('public.c34_b14_p8_gm_decide_item_offer_v1(uuid,boolean)') IS NULL
  OR to_regprocedure('public.transfer_inventory_item_v1(uuid,text,text)') IS NULL
  OR to_regprocedure('public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)') IS NULL
  OR NOT EXISTS(
   SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='character_permissions'
    AND column_name='can_control')
 THEN
  RAISE EXCEPTION 'P16 candidate must use isolated signed PG17, P2/P6/P8/P14 and PR312-style scoped control column'
   USING ERRCODE='42501';
 END IF;
END $p16_guard$;

-- This helper is a deliberately separate NPC/companion source capability:
-- character-level can_control OR original can_edit; NOT encounter participant
-- controller_user_id, can_inventory, backpack view, GM role or a backfill.
-- The true owner policy for persistent companion control needs owner approval.
CREATE OR REPLACE FUNCTION public.c34_b14_p16_can_offer_forge_to_npc_v1(
 p_npc_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p16_control$
 SELECT auth.uid() IS NOT NULL
  AND EXISTS (
   SELECT 1 FROM public.characters c
   JOIN public.character_permissions cp
    ON cp.character_id=c.id AND cp.user_id=auth.uid()
   WHERE c.id=p_npc_id AND c.kind='npc'
    AND NOT coalesce(c.is_hidden,false)
    AND coalesce(c.state,'')<>'hidden'
    AND NOT ('player-character'=ANY(coalesce(c.tags,'{}'::text[])))
    AND (coalesce(cp.can_control,false) OR coalesce(cp.can_edit,false))
  );
$p16_control$;

REVOKE ALL ON FUNCTION public.c34_b14_p16_can_offer_forge_to_npc_v1(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p16_can_offer_forge_to_npc_v1(uuid)
 TO authenticated;

-- RLS FROM public.inventory_items is intentionally unchanged.
-- A restrictive owner-column privilege cutout prevents a signed browser
-- from UPDATE'ing owner_type/owner_id/user_id even when its old RLS policy
-- checks only resulting user_id. Restore safe equip fields independently.
-- PostgreSQL grants are ADDITIVE; simply revoking one column while keeping
-- table-wide UPDATE would NOT close the direct reassignment path.
REVOKE UPDATE ON TABLE public.inventory_items FROM PUBLIC,anon,authenticated;
REVOKE UPDATE(owner_type,owner_id,user_id)
 ON TABLE public.inventory_items FROM PUBLIC,anon,authenticated;
GRANT UPDATE (is_equipped,equip_slot,updated_at)
 ON TABLE public.inventory_items TO authenticated;

-- This authenticates the currently signed-in actor's GM/DM/Admin role
-- server-side; never accept a manager bit supplied by the browser. It is
-- separate from inventory, combat, and NPC companion permissions.
CREATE OR REPLACE FUNCTION public.c34_b14_p16_is_item_grant_manager_v1()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS $p16_manager$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.user_profiles up
  WHERE up.id=auth.uid() AND up.role IN ('admin','gm','dm')
 );
$p16_manager$;
REVOKE ALL ON FUNCTION public.c34_b14_p16_is_item_grant_manager_v1()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p16_is_item_grant_manager_v1()
 TO authenticated;

-- SECURITY INVOKER trigger inspects the actual invoker. Signed Data API
-- calls have current_user=authenticated, while fully authorized SECURITY
-- DEFINER transfers execute as their trusted function owner.
-- Client direct NPC/merchant creation without GM assignment is denied,
-- but player crafting and Forge character-scoped INSERT are retained pending
-- the COMPLETE writer inventory. This is only a research prototype.
CREATE OR REPLACE FUNCTION private.c34_b14_p16_guard_direct_inventory_dml_v1()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,public,private,auth
AS $p16_dml$
DECLARE
 v_manager boolean:=false;
BEGIN
 IF current_user NOT IN ('authenticated','anon') THEN
  RETURN NEW;
 END IF;
 IF TG_OP='INSERT' AND lower(coalesce(NEW.owner_type,'')) IN ('npc','merchant') THEN
  v_manager:=public.c34_b14_p16_is_item_grant_manager_v1();
  IF NOT coalesce(v_manager,false) THEN
   RAISE EXCEPTION 'Direct character inventory creation requires a game manager'
    USING ERRCODE='42501';
  END IF;
 ELSIF TG_OP='UPDATE' AND (
  NEW.owner_type IS DISTINCT FROM OLD.owner_type OR
  NEW.owner_id IS DISTINCT FROM OLD.owner_id OR
  NEW.user_id IS DISTINCT FROM OLD.user_id
 ) THEN
  RAISE EXCEPTION 'Direct inventory owner reassignment is forbidden; use a server-authorized intent'
   USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$p16_dml$;

CREATE TRIGGER c34_b14_p16_guard_direct_inventory_dml
 BEFORE INSERT OR UPDATE OF owner_type,owner_id,user_id
 ON public.inventory_items
 FOR EACH ROW EXECUTE FUNCTION private.c34_b14_p16_guard_direct_inventory_dml_v1();

-- Close BOTH full-row/hidden-target legacy June entrypoints, the direct
-- P2 single and 1-50 bulk, direct P4 Forge donation and old P6 GM decide.
-- Also retire the unmapped P8 bulk and direct P6 offer entrypoint, while
-- keeping versioned P8 single, P14 batch/status and P8 GM settlement.
-- Do not revoke P6 sender cancellation or GM review/context grants.
REVOKE ALL ON FUNCTION public.list_item_send_targets_v1()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.transfer_inventory_item_v1(uuid,text,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p2_transfer_inventory_item_v1(
 uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p2_transfer_inventory_items_bulk_v1(
 uuid[],text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(
 uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p6_offer_item_v1(
 uuid,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p6_decide_item_offer_v1(
 uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p8_dispatch_batch_intent_v1(
 uuid,uuid[],text,text,text,text) FROM PUBLIC,anon,authenticated;
COMMIT;

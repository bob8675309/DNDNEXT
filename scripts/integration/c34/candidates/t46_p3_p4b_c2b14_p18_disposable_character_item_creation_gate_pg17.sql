-- C34 B14-P18 disposable-only local PG17 character-inventory INSERT gate.
-- Follow P16 signed original no-bypass and P17 AUTHENTICATED RED, then install
-- this candidate AFTER original P16 Town, synthetic Forge and GM positives.
-- NOT a hosted SQL migration, PR merge or deployed player runtime.
-- This does NOT authorize arbitrary new character gear for can_edit,
-- can_inventory or can_control, and does NOT alter owner-column UPDATE.
-- Original Forge SECURITY DEFINER materializers run as their trusted owner;
-- their actual creator/nonce/entitlement validation remains a separate gate.
BEGIN;
DO $p18_guard$
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('public.inventory_items') IS NULL
  OR to_regclass('public.character_permissions') IS NULL
  OR to_regprocedure('public.c34_b14_p16_is_item_grant_manager_v1()') IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.inventory_items'::regclass
     AND tgname='c34_b14_p16_guard_direct_inventory_dml'
     AND NOT tgisinternal
  )
  OR EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.inventory_items'::regclass
     AND tgname='c34_b14_p18_guard_direct_character_item_creation'
     AND NOT tgisinternal
  )
 THEN
  RAISE EXCEPTION
   'P18 requires original P16-protected isolated signed PG17; never run on hosted database'
   USING ERRCODE='42501';
 END IF;
END $p18_guard$;

-- Original user_id-based INSERT RLS never validates a character's owner_id.
-- No direct Data API character-equipment mint is accepted merely because
-- the actor can view, edit, equip, or control that character. GM/Admin/DM
-- explicit item grants are a separate owner-approved gameplay capability.
--
-- SECURITY INVOKER reflects the actual PostgREST role (authenticated/anon).
-- Original source-authorized SECURITY DEFINER materializers run as the
-- definer, not as the end user; do not replace or weaken their creator proof.
-- Every privileged public RPC still needs an independent reviewed ACL.
CREATE OR REPLACE FUNCTION private.c34_b14_p18_guard_character_item_creation_v1()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,public,private,auth
AS $p18_insert$
BEGIN
 IF TG_OP='INSERT'
  AND lower(btrim(coalesce(NEW.owner_type,'')))='character'
  AND current_user IN ('authenticated','anon')
  AND NOT coalesce(public.c34_b14_p16_is_item_grant_manager_v1(),false)
 THEN
  RAISE EXCEPTION
   'Direct character-owned inventory mint requires approved server creation or a game manager'
   USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$p18_insert$;
REVOKE ALL ON FUNCTION private.c34_b14_p18_guard_character_item_creation_v1()
 FROM PUBLIC,anon,authenticated;

CREATE TRIGGER c34_b14_p18_guard_direct_character_item_creation
 BEFORE INSERT ON public.inventory_items
 FOR EACH ROW EXECUTE FUNCTION private.c34_b14_p18_guard_character_item_creation_v1();
COMMIT;

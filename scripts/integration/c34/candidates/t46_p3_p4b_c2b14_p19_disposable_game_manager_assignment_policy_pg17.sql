-- P19 DISPOSABLE-ONLY manager grant research: original direct AssignItemButton
-- NPC/merchant item writes omit user_id. Historical owner RLS permits strict
-- admin but denies game-authorized GM and DM despite P16 delegated checks.
-- Adds a temporary, role-correct INSERT policy solely on signed local PG17,
-- after original GM/DM RED; removes in P19 finally before P18/P16 cleanup.
-- NEVER run on hosted Supabase; NOT an approved Stage4 replacement/migration.
BEGIN;
DO $p19_preflight$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('public.user_profiles') IS NULL
 OR to_regclass('public.inventory_items') IS NULL
 OR to_regprocedure('public.c34_b14_p16_is_item_grant_manager_v1()') IS NULL
 OR NOT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid='public.inventory_items'::regclass
   AND tgname='c34_b14_p16_guard_direct_inventory_dml' AND NOT tgisinternal)
 OR NOT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgrelid='public.inventory_items'::regclass
   AND tgname='c34_b14_p18_guard_direct_character_item_creation' AND NOT tgisinternal)
 OR NOT EXISTS (
  SELECT 1 FROM pg_policy
  WHERE polrelid='public.inventory_items'::regclass
   AND polname='inventory_items_insert_owner_or_admin' AND polcmd='a')
 OR EXISTS (
  SELECT 1 FROM pg_policy
  WHERE polrelid='public.inventory_items'::regclass
   AND polname='c34_b14_p19_temporary_game_manager_insert')
 THEN
  RAISE EXCEPTION
   'P19 requires unchanged original RLS + P16/P18 disposable guards and signed local PG17'
   USING ERRCODE='42501';
 END IF;
END $p19_preflight$;

-- OR with original RLS; original user_id=self behavior remains independently
-- unprotected and is NOT claimed repaired. P16 helper checks the *current*
-- signed auth.uid() and public.user_profiles.role IN (admin,gm,dm).
-- It fails closed for observer even if old public.is_admin(uuid) says true.
CREATE POLICY c34_b14_p19_temporary_game_manager_insert
 ON public.inventory_items
 AS PERMISSIVE
 FOR INSERT TO authenticated
 WITH CHECK (coalesce(public.c34_b14_p16_is_item_grant_manager_v1(),false));

DO $p19_postflight$
BEGIN
 IF (SELECT count(*) FROM pg_policy
  WHERE polrelid='public.inventory_items'::regclass
   AND polname='c34_b14_p19_temporary_game_manager_insert'
   AND polcmd='a' AND polpermissive
   AND polroles=ARRAY['authenticated'::regrole::oid])<>1
 THEN
  RAISE EXCEPTION 'P19 temporary policy shape mismatch' USING ERRCODE='42501';
 END IF;
END $p19_postflight$;
COMMIT;

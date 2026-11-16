-- C34 T31: owner-revised Admin=GM=DM GAME authority, DISPOSABLE PG17 ONLY.
-- Never execute against hosted/production; no gameplay map source changes.
-- T29 commerce-only and T30 strict Admin tests MUST execute FIRST (historical
-- negative evidence). This stage replaces only the local reduced role helper.
\if :{?T31_DISPOSABLE_LOCAL_CONFIRMED}
\else
\echo 'T31 REFUSE: disposable-only confirmation absent'
\quit 1
\endif
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('public.user_profiles') IS NULL
 OR to_regprocedure('private.current_user_is_admin()') IS NULL
 OR position('private.test_admins' in
  pg_get_functiondef('private.current_user_is_admin()'::regprocedure))=0
 OR to_regprocedure('public.get_npc_dossier_admin_v1(uuid)') IS NULL
 OR position('private.current_user_is_admin()' in
  pg_get_functiondef('public.get_npc_dossier_admin_v1(uuid)'::regprocedure))=0
 OR to_regprocedure('public.get_character_secrets_v1(uuid[])') IS NULL
 OR to_regprocedure('public.set_character_secret_v1(uuid,text)') IS NULL
 OR to_regprocedure('private.can_access_creator_backstory_v1(uuid)') IS NULL
 OR to_regprocedure('private.current_user_can_manage_merchant_stock_v1(uuid)') IS NULL
 OR to_regprocedure('private.current_user_can_manage_player_gold_v1(uuid)') IS NULL
 OR md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))
      <> '1dbe8c24c4c718396d7256f6f7465354'
 THEN RAISE EXCEPTION 'T31 REFUSE: expected exact disposable source Stage2/3 + T29/T30 setup';
 END IF;
END $guard$;

-- Same public/original RPCs, but the scratch private Admin guard now treats
-- all three canonical GAME MASTER roles equally. All existing Stage2/3
-- SECURITY DEFINER callers and original RLS still recheck this helper.
CREATE OR REPLACE FUNCTION private.current_user_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $t31$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
  AND p.role IN ('admin','gm','dm')
 );
$t31$;
REVOKE ALL ON FUNCTION private.current_user_is_admin()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_is_admin()
 TO authenticated;

-- Supersede T29's role distinction in the disposable database, so GM/DM
-- inherit Admin's existing game-stock and wallet scope. No original
-- wallet_get/set, stock_merchant_item, reroll or atomic buyer body is edited.
CREATE OR REPLACE FUNCTION private.current_user_can_manage_merchant_stock_v1(p_character_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $t31_stock$
 SELECT auth.uid() IS NOT NULL AND private.current_user_is_admin();
$t31_stock$;
CREATE OR REPLACE FUNCTION private.current_user_can_manage_player_gold_v1(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $t31_wallet$
 SELECT auth.uid() IS NOT NULL AND private.current_user_is_admin();
$t31_wallet$;
REVOKE ALL ON FUNCTION private.current_user_can_manage_merchant_stock_v1(uuid),
 private.current_user_can_manage_player_gold_v1(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_can_manage_merchant_stock_v1(uuid),
 private.current_user_can_manage_player_gold_v1(uuid) TO authenticated;

-- Read-only UI projection only: independently protected APIs and tables are
-- still the authority. No target UID/role argument; no JWT user_metadata.
CREATE OR REPLACE FUNCTION public.c34_game_manager_capabilities_research_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $t31_role$
DECLARE v_role text; v_manager boolean;
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Signed actor required' USING errcode='42501';
 END IF;
 SELECT role INTO v_role FROM public.user_profiles WHERE id=auth.uid();
 v_role := coalesce(v_role,'');
 v_manager := v_role IN ('admin','gm','dm');
 RETURN jsonb_build_object(
  'role',v_role,
  'canEditMerchantStock',v_manager,
  'canSetPlayerGold',v_manager,
  'canEditWorldTravel',v_manager,
  'canReadNpcDossier',v_manager,
  'canEditCharacterPrivacy',v_manager,
  'canManageNpcPlayers',v_manager,
  'canManageCharacterInventory',v_manager
 );
END;
$t31_role$;
REVOKE ALL ON FUNCTION public.c34_game_manager_capabilities_research_v1()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_game_manager_capabilities_research_v1()
 TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
